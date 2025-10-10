import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import {
  EmailProviderFactory,
  TenantEmailConfig,
} from '../factories/email-provider.factory';
import { NotificationTemplateService } from '../services/notification-template.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { EmailJobData } from '../interfaces/queue-job.interface';
import { QUEUE_NAMES } from '../constants/queue.constants';
import { DeliveryStatus } from '../enums/delivery-status.enum';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { MetricsService } from '../services/metrics.service';
import { NotificationLoggerService } from '../services/notification-logger.service';
// IEmailProvider is used in the processor logic but not directly imported as a type

@Injectable()
@Processor(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
export class EmailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProviderFactory: EmailProviderFactory,
    private readonly templateService: NotificationTemplateService,
    private readonly tenantContextService: TenantContextService,
    private readonly metricsService: MetricsService,
    private readonly notificationLogger: NotificationLoggerService,
  ) {
    super();
  }

  /**
   * Process email notification job
   */
  async process(job: Job<EmailJobData>): Promise<void> {
    const { data } = job;
    const {
      tenantId,
      userId,
      notificationId,
      to,
      subject,
      message,
      templateId,
      templateVariables,
      category,
    } = data;

    this.logger.debug(
      `Processing email job for notification ${notificationId}, tenant ${tenantId}, user ${userId}`,
    );

    // Start timing the processing
    const endTimer = this.metricsService.startTimer(
      NotificationChannelType.EMAIL,
      category,
      'email_processor',
    );

    // Set tenant context for this job
    this.tenantContextService.setTenantId(tenantId);

    let deliveryLogId: string | undefined;
    let provider: any;

    // Log queue processing start
    this.notificationLogger.logQueueProcessing(
      QUEUE_NAMES.EMAIL_NOTIFICATIONS,
      job.id || 'unknown',
      'started',
      {
        tenantId,
        userId,
        notificationId,
        category,
        channel: NotificationChannelType.EMAIL,
      },
    );

    try {
      // Create initial delivery log entry
      const deliveryLog = await this.prisma.notificationDeliveryLog.create({
        data: {
          notificationId,
          channel: NotificationChannelType.EMAIL,
          status: DeliveryStatus.PENDING,
        },
      });
      deliveryLogId = deliveryLog.id;

      // Load tenant-specific email configuration
      const tenantConfig = await this.loadTenantEmailConfig(tenantId);

      // Get email provider
      provider = this.emailProviderFactory.createProvider(tenantConfig);

      // Log delivery attempt
      this.notificationLogger.logDeliveryAttempt({
        tenantId,
        userId,
        notificationId,
        category,
        channel: NotificationChannelType.EMAIL,
        provider: provider.getProviderName(),
        deliveryLogId,
        metadata: {
          to,
          has_template: !!templateId,
        },
      });

      // Prepare email content
      const emailContent = await this.prepareEmailContent(
        subject,
        message,
        templateId,
        templateVariables,
        tenantId,
        category,
      );

      // Get sender information
      const senderInfo = this.getSenderInfo(tenantConfig);

      // Send email with provider timing
      const endProviderTimer = this.metricsService.startProviderTimer(
        provider.getProviderName(),
        NotificationChannelType.EMAIL,
      );

      const result = await provider.send({
        to,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        from: senderInfo.fromAddress,
        fromName: senderInfo.fromName,
      });

      endProviderTimer(result.success);

      // Log provider response
      this.notificationLogger.logProviderResponse(
        {
          tenantId,
          userId,
          notificationId,
          category,
          channel: NotificationChannelType.EMAIL,
          provider: provider.getProviderName(),
          messageId: result.messageId,
          processingTimeMs: Date.now() - job.processedOn!,
        },
        result.success,
        result,
      );

      if (result.success) {
        // Update delivery log with success
        await this.prisma.notificationDeliveryLog.update({
          where: { id: deliveryLogId },
          data: {
            status: DeliveryStatus.SENT,
            provider: provider.getProviderName(),
            providerMessageId: result.messageId,
            sentAt: new Date(),
          },
        });

        // Record successful delivery metrics
        this.metricsService.recordDelivery(
          NotificationChannelType.EMAIL,
          category,
          tenantId,
          provider.getProviderName(),
        );

        // Log successful delivery
        this.notificationLogger.logDeliverySuccess({
          tenantId,
          userId,
          notificationId,
          category,
          channel: NotificationChannelType.EMAIL,
          provider: provider.getProviderName(),
          messageId: result.messageId,
          deliveryLogId,
          processingTimeMs: Date.now() - job.processedOn!,
        });

        this.logger.debug(
          `Email sent successfully for notification ${notificationId}, messageId: ${result.messageId}`,
        );
      } else {
        throw new Error(result.error || 'Email sending failed');
      }
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to send email for notification ${notificationId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Record failure metrics
      this.metricsService.recordFailure(
        NotificationChannelType.EMAIL,
        category,
        tenantId,
        errorMessage,
        provider?.getProviderName() || 'unknown',
      );

      // Log delivery failure
      this.notificationLogger.logDeliveryFailure({
        tenantId,
        userId,
        notificationId,
        category,
        channel: NotificationChannelType.EMAIL,
        provider: provider?.getProviderName() || 'unknown',
        deliveryLogId,
        errorMessage,
        processingTimeMs: Date.now() - job.processedOn!,
      });

      // Update delivery log with failure
      if (deliveryLogId) {
        await this.prisma.notificationDeliveryLog.update({
          where: { id: deliveryLogId },
          data: {
            status: DeliveryStatus.FAILED,
            errorMessage,
          },
        });
      }

      // Re-throw error to trigger retry mechanism
      throw error;
    } finally {
      // End timing
      endTimer();

      // Log queue processing completion
      this.notificationLogger.logQueueProcessing(
        QUEUE_NAMES.EMAIL_NOTIFICATIONS,
        job.id || 'unknown',
        'completed',
        {
          tenantId,
          userId,
          notificationId,
          category,
          channel: NotificationChannelType.EMAIL,
          processingTimeMs: Date.now() - job.processedOn!,
        },
      );

      // Tenant context will be automatically cleared as service is request-scoped
    }
  }

  /**
   * Load tenant-specific email configuration
   */
  private async loadTenantEmailConfig(
    tenantId: string,
  ): Promise<TenantEmailConfig | undefined> {
    try {
      const tenantConfig =
        await this.prisma.tenantNotificationConfig.findUnique({
          where: { tenantId },
        });

      if (!tenantConfig) {
        this.logger.debug(
          `No tenant-specific email config found for tenant ${tenantId}`,
        );
        return undefined;
      }

      // Map database config to factory config
      const config: TenantEmailConfig = {
        provider: tenantConfig.emailProvider as any,
        apiKey: tenantConfig.emailApiKey || undefined,
        fromAddress: tenantConfig.emailFromAddress || undefined,
        fromName: tenantConfig.emailFromName || undefined,
      };

      // Add provider-specific fields if available
      if (tenantConfig.emailProvider === 'aws-ses') {
        // For AWS SES, we might store additional config in a JSON field
        // For now, we'll use environment variables as fallback
        config.region = process.env.AWS_REGION;
        config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      }

      return config;
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to load tenant email config for tenant ${tenantId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return undefined;
    }
  }

  /**
   * Prepare email content (render template or use plain message)
   */
  private async prepareEmailContent(
    subject: string,
    message: string,
    templateId?: string,
    templateVariables?: Record<string, any>,
    tenantId?: string,
    category?: string,
  ): Promise<{ subject: string; html: string; text: string }> {
    try {
      // If templateId is provided, use it directly
      if (templateId) {
        const rendered = await this.templateService.renderEmailTemplate(
          templateId,
          templateVariables || {},
        );
        return {
          subject,
          html: rendered.html,
          text: rendered.text,
        };
      }

      // Try to find a template for the category
      if (category && tenantId) {
        const template = await this.templateService.getTemplate(
          category,
          NotificationChannelType.EMAIL,
          tenantId,
        );

        if (template) {
          const rendered = await this.templateService.renderEmailTemplate(
            template.id,
            templateVariables || {},
          );
          return {
            subject: template.subject || subject,
            html: rendered.html,
            text: rendered.text,
          };
        }
      }

      // Fallback to plain message
      const html = this.convertMessageToHtml(message);
      return {
        subject,
        html,
        text: message,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.warn(
        `Failed to render email template, using plain message: ${errorMessage}`,
      );

      // Fallback to plain message
      const html = this.convertMessageToHtml(message);
      return {
        subject,
        html,
        text: message,
      };
    }
  }

  /**
   * Get sender information from tenant config or defaults
   */
  private getSenderInfo(tenantConfig?: TenantEmailConfig): {
    fromAddress: string;
    fromName: string;
  } {
    return {
      fromAddress:
        tenantConfig?.fromAddress ||
        process.env.EMAIL_FROM_ADDRESS ||
        'noreply@example.com',
      fromName:
        tenantConfig?.fromName ||
        process.env.EMAIL_FROM_NAME ||
        'Notification System',
    };
  }

  /**
   * Convert plain text message to basic HTML
   */
  private convertMessageToHtml(message: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            ${message.replace(/\n/g, '<br>')}
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Extract error message from unknown error type
   */
  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }

    return 'Unknown error';
  }

  /**
   * Handle job completion
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<EmailJobData>) {
    this.logger.debug(
      `Email job completed for notification ${job.data.notificationId}`,
    );
  }

  /**
   * Handle job failure
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJobData>, error: Error) {
    this.logger.error(
      `Email job failed for notification ${job.data.notificationId}: ${error.message}`,
      error.stack,
    );
  }

  /**
   * Handle job retry
   */
  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error(
      `Email queue processor error: ${error.message}`,
      error.stack,
    );
  }
}
