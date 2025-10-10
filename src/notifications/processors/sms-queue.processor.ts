import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { SmsProviderFactory } from '../factories/sms-provider.factory';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { SmsJobData } from '../interfaces/queue-job.interface';
import { QUEUE_NAMES } from '../constants/queue.constants';
import { DeliveryStatus } from '../enums/delivery-status.enum';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { MetricsService } from '../services/metrics.service';
import { NotificationLoggerService } from '../services/notification-logger.service';
// ISmsProvider is used in the processor logic but not directly imported as a type

@Injectable()
@Processor(QUEUE_NAMES.SMS_NOTIFICATIONS)
export class SmsQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsQueueProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsProviderFactory: SmsProviderFactory,
    private readonly tenantContextService: TenantContextService,
    private readonly metricsService: MetricsService,
    private readonly notificationLogger: NotificationLoggerService,
  ) {
    super();
  }

  /**
   * Process SMS notification job
   */
  async process(job: Job<SmsJobData>): Promise<void> {
    const { data } = job;
    const { tenantId, userId, notificationId, to, message, category } = data;

    this.logger.debug(
      `Processing SMS job for notification ${notificationId}, tenant ${tenantId}, user ${userId}`,
    );

    // Start timing the processing
    const endTimer = this.metricsService.startTimer(
      NotificationChannelType.SMS,
      category || 'unknown',
      'sms_processor',
    );

    // Set tenant context for this job
    this.tenantContextService.setTenantId(tenantId);

    let deliveryLogId: string | undefined;
    let provider: any;

    // Log queue processing start
    this.notificationLogger.logQueueProcessing(
      QUEUE_NAMES.SMS_NOTIFICATIONS,
      job.id || 'unknown',
      'started',
      {
        tenantId,
        userId,
        notificationId,
        category: category || 'unknown',
        channel: NotificationChannelType.SMS,
      },
    );

    try {
      // Create initial delivery log entry
      const deliveryLog = await this.prisma.notificationDeliveryLog.create({
        data: {
          notificationId,
          channel: NotificationChannelType.SMS,
          status: DeliveryStatus.PENDING,
        },
      });
      deliveryLogId = deliveryLog.id;

      // Get SMS provider (factory handles tenant-specific vs global config)
      provider = await this.smsProviderFactory.createProvider(tenantId);

      // Log delivery attempt
      this.notificationLogger.logDeliveryAttempt({
        tenantId,
        userId,
        notificationId,
        category: category || 'unknown',
        channel: NotificationChannelType.SMS,
        provider: provider.getProviderName(),
        deliveryLogId,
        metadata: {
          to,
        },
      });

      // Prepare SMS content
      const smsContent = this.prepareSmsContent(message);

      // Get sender information
      const senderInfo = await this.getSenderInfo(tenantId);

      // Send SMS with provider timing
      const endProviderTimer = this.metricsService.startProviderTimer(
        provider.getProviderName(),
        NotificationChannelType.SMS,
      );

      const result = await provider.send({
        to: this.formatPhoneNumber(to),
        message: smsContent,
        from: senderInfo.from,
      });

      endProviderTimer(result.success);

      // Log provider response
      this.notificationLogger.logProviderResponse(
        {
          tenantId,
          userId,
          notificationId,
          category: category || 'unknown',
          channel: NotificationChannelType.SMS,
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
          NotificationChannelType.SMS,
          category || 'unknown',
          tenantId,
          provider.getProviderName(),
        );

        // Log successful delivery
        this.notificationLogger.logDeliverySuccess({
          tenantId,
          userId,
          notificationId,
          category: category || 'unknown',
          channel: NotificationChannelType.SMS,
          provider: provider.getProviderName(),
          messageId: result.messageId,
          deliveryLogId,
          processingTimeMs: Date.now() - job.processedOn!,
        });

        this.logger.debug(
          `SMS sent successfully for notification ${notificationId}, messageId: ${result.messageId}`,
        );
      } else {
        throw new Error(result.error || 'SMS sending failed');
      }
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to send SMS for notification ${notificationId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Record failure metrics
      this.metricsService.recordFailure(
        NotificationChannelType.SMS,
        category || 'unknown',
        tenantId,
        errorMessage,
        provider?.getProviderName() || 'unknown',
      );

      // Log delivery failure
      this.notificationLogger.logDeliveryFailure({
        tenantId,
        userId,
        notificationId,
        category: category || 'unknown',
        channel: NotificationChannelType.SMS,
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
        QUEUE_NAMES.SMS_NOTIFICATIONS,
        job.id || 'unknown',
        'completed',
        {
          tenantId,
          userId,
          notificationId,
          category: category || 'unknown',
          channel: NotificationChannelType.SMS,
          processingTimeMs: Date.now() - job.processedOn!,
        },
      );

      // Tenant context will be automatically cleared as service is request-scoped
    }
  }

  /**
   * Prepare SMS content (truncate if too long, clean up formatting)
   */
  private prepareSmsContent(message: string): string {
    // Remove HTML tags if present
    let cleanMessage = message.replace(/<[^>]*>/g, '');

    // Replace HTML entities
    cleanMessage = cleanMessage
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Normalize whitespace
    cleanMessage = cleanMessage.replace(/\s+/g, ' ').trim();

    // Truncate if too long (SMS limit is typically 160 characters for single SMS)
    // We'll use 150 to be safe and allow for some provider overhead
    const maxLength = 150;
    if (cleanMessage.length > maxLength) {
      cleanMessage = cleanMessage.substring(0, maxLength - 3) + '...';
      this.logger.warn(
        `SMS message truncated to ${maxLength} characters: ${cleanMessage}`,
      );
    }

    return cleanMessage;
  }

  /**
   * Get sender information from tenant config or defaults
   */
  private async getSenderInfo(tenantId: string): Promise<{ from?: string }> {
    try {
      // Try to get tenant-specific sender info
      const tenantConfig =
        await this.prisma.tenantNotificationConfig.findUnique({
          where: { tenantId },
          select: {
            smsFromNumber: true,
            smsProvider: true,
          },
        });

      if (tenantConfig?.smsFromNumber) {
        return { from: tenantConfig.smsFromNumber };
      }

      // Fallback to global configuration
      const globalFromNumber = process.env.SMS_FROM_NUMBER;
      const globalSenderId = process.env.TERMII_SENDER_ID;

      // Return appropriate sender based on provider type
      if (globalFromNumber) {
        return { from: globalFromNumber };
      }

      if (globalSenderId) {
        return { from: globalSenderId };
      }

      // No sender configured - provider will use default
      return {};
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.warn(
        `Failed to get sender info for tenant ${tenantId}: ${errorMessage}`,
      );
      return {};
    }
  }

  /**
   * Format phone number for SMS sending
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    const formatted = phoneNumber.replace(/[^\d+]/g, '');

    // If it doesn't start with +, assume it needs country code
    if (!formatted.startsWith('+')) {
      // For now, we'll just return as-is and let the provider handle it
      // In a real implementation, you might want to add default country code
      this.logger.debug(
        `Phone number ${phoneNumber} doesn't have country code, sending as-is`,
      );
    }

    return formatted;
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
  onCompleted(job: Job<SmsJobData>) {
    this.logger.debug(
      `SMS job completed for notification ${job.data.notificationId}`,
    );
  }

  /**
   * Handle job failure
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<SmsJobData>, error: Error) {
    this.logger.error(
      `SMS job failed for notification ${job.data.notificationId}: ${error.message}`,
      error.stack,
    );
  }

  /**
   * Handle job retry
   */
  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error(
      `SMS queue processor error: ${error.message}`,
      error.stack,
    );
  }
}
