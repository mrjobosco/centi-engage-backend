import { Injectable } from '@nestjs/common';
import { BaseChannel } from './base-channel.abstract';
import { NotificationPayload } from '../interfaces/notification-payload.interface';
import { NotificationResult } from '../interfaces/notification-result.interface';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { QueueService } from '../services/queue.service';
import { EmailJobData } from '../interfaces/queue-job.interface';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class EmailChannelService extends BaseChannel {
  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  getChannelType(): NotificationChannelType {
    return NotificationChannelType.EMAIL;
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      this.logNotificationAttempt(payload);

      // Validate payload
      if (!this.validate(payload)) {
        const error = 'Invalid notification payload';
        this.logNotificationFailure(payload, error);
        return this.createFailureResult(error);
      }

      // Get user email address
      const user = await this.prisma.user.findUnique({
        where: {
          id: payload.userId,
          tenantId: payload.tenantId,
        },
        select: {
          email: true,
        },
      });

      if (!user) {
        const error = 'User not found';
        this.logNotificationFailure(payload, error);
        return this.createFailureResult(error);
      }

      // Create notification record first to get ID
      const notification = await this.prisma.notification.create({
        data: {
          tenantId: payload.tenantId,
          userId: payload.userId,
          type: payload.type,
          category: payload.category,
          title: payload.title,
          message: payload.message,
          data: payload.data || undefined,
          channelsSent: [NotificationChannelType.EMAIL],
          expiresAt: payload.expiresAt || null,
        },
      });

      // Create pending delivery log
      const deliveryLog = await this.prisma.notificationDeliveryLog.create({
        data: {
          notificationId: notification.id,
          channel: NotificationChannelType.EMAIL,
          status: 'PENDING',
        },
      });

      // Prepare email job data
      const emailJobData: EmailJobData = {
        tenantId: payload.tenantId,
        userId: payload.userId,
        notificationId: notification.id,
        category: payload.category,
        priority: payload.priority || NotificationPriority.MEDIUM,
        to: user.email,
        subject: payload.title,
        message: payload.message,
        templateId: payload.templateId,
        templateVariables: payload.templateVariables,
      };

      // Queue email job
      await this.queueService.addEmailJob(emailJobData);

      this.logNotificationSuccess(payload, notification.id);

      return this.createSuccessResult(notification.id, deliveryLog.id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logNotificationFailure(payload, errorMessage);
      return this.createFailureResult(errorMessage);
    }
  }

  /**
   * Enhanced validation for email notifications
   */
  validate(payload: NotificationPayload): boolean {
    // Use base validation first
    if (!super.validate(payload)) {
      return false;
    }

    // Additional validation for email notifications
    if (payload.expiresAt && payload.expiresAt <= new Date()) {
      this.logger.warn('Notification expiry date is in the past');
      return false;
    }

    // Validate template variables if template is specified
    if (payload.templateId && payload.templateVariables) {
      if (
        typeof payload.templateVariables !== 'object' ||
        Array.isArray(payload.templateVariables)
      ) {
        this.logger.warn('Template variables must be an object');
        return false;
      }
    }

    return true;
  }

  /**
   * Check if email channel is available
   * Email notifications depend on queue service and database
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if database connection is available
      await this.prisma.$queryRaw`SELECT 1`;

      // Check if queue service is available by getting stats
      await this.queueService.getEmailQueueStats();

      return true;
    } catch (error) {
      this.logger.error('Email channel not available', error);
      return false;
    }
  }
}
