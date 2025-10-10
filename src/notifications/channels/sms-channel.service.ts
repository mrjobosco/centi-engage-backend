import { Injectable } from '@nestjs/common';
import { BaseChannel } from './base-channel.abstract';
import { NotificationPayload } from '../interfaces/notification-payload.interface';
import { NotificationResult } from '../interfaces/notification-result.interface';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { QueueService } from '../services/queue.service';
import { SmsJobData } from '../interfaces/queue-job.interface';
import { PrismaService } from '../../database/prisma.service';
import { PhoneNumberService } from '../services/phone-number.service';

@Injectable()
export class SmsChannelService extends BaseChannel {
  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
    private readonly phoneNumberService: PhoneNumberService,
  ) {
    super();
  }

  getChannelType(): NotificationChannelType {
    return NotificationChannelType.SMS;
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      this.logNotificationAttempt(payload);

      // Basic payload validation first (without phone number check)
      if (!super.validate(payload)) {
        const error = 'Invalid notification payload';
        this.logNotificationFailure(payload, error);
        return this.createFailureResult(error);
      }

      // Get user first to check if they exist
      const user = await this.prisma.user.findUnique({
        where: {
          id: payload.userId,
          tenantId: payload.tenantId,
        },
        select: {
          id: true,
          // Note: In a real implementation, you'd have a phone field
          // For now, we'll assume phone is in the payload data or use a default
        },
      });

      if (!user) {
        const error = 'User not found';
        this.logNotificationFailure(payload, error);
        return this.createFailureResult(error);
      }

      // Get phone number from user profile or payload data
      const phoneNumber = await this.phoneNumberService.getUserPhoneNumber(
        payload.userId,
        payload.tenantId,
        payload.data,
      );

      if (!phoneNumber) {
        const error = 'Phone number not available for user';
        this.logNotificationFailure(payload, error);
        return this.createFailureResult(error);
      }

      // Parse and validate phone number
      const phoneInfo = this.phoneNumberService.parsePhoneNumber(phoneNumber);
      if (!phoneInfo.isValid) {
        const error = 'Invalid phone number format';
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
          channelsSent: [NotificationChannelType.SMS],
          expiresAt: payload.expiresAt || null,
        },
      });

      // Create pending delivery log
      const deliveryLog = await this.prisma.notificationDeliveryLog.create({
        data: {
          notificationId: notification.id,
          channel: NotificationChannelType.SMS,
          status: 'PENDING',
        },
      });

      // Prepare SMS job data
      const smsJobData: SmsJobData = {
        tenantId: payload.tenantId,
        userId: payload.userId,
        notificationId: notification.id,
        category: payload.category,
        priority: payload.priority || NotificationPriority.MEDIUM,
        to: phoneInfo.formatted,
        message: this.formatSmsMessage(payload.title, payload.message),
      };

      // Queue SMS job
      await this.queueService.addSmsJob(smsJobData);

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
   * Enhanced validation for SMS notifications
   */
  validate(payload: NotificationPayload): boolean {
    // Use base validation first
    if (!super.validate(payload)) {
      return false;
    }

    // Additional validation for SMS notifications
    if (payload.expiresAt && payload.expiresAt <= new Date()) {
      this.logger.warn('Notification expiry date is in the past');
      return false;
    }

    // Check message length (SMS has character limits)
    const formattedMessage = this.formatSmsMessage(
      payload.title,
      payload.message,
    );
    if (formattedMessage.length > 1600) {
      // Standard SMS limit with some buffer
      this.logger.warn('SMS message too long');
      return false;
    }

    // For SMS, we'll validate phone number during send() since it comes from user profile
    // Check if phone number is provided in data (optional override)
    const phoneNumber = payload.data?.phoneNumber ?? payload.data?.phone;
    if (phoneNumber !== undefined && phoneNumber !== null) {
      if (!this.isValidPhoneNumber(phoneNumber)) {
        this.logger.warn('Invalid phone number format in payload data');
        return false;
      }
    }

    return true;
  }

  /**
   * Check if SMS channel is available
   * SMS notifications depend on queue service and database
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if database connection is available
      await this.prisma.$queryRaw`SELECT 1`;

      // Check if queue service is available by getting stats
      await this.queueService.getSmsQueueStats();

      return true;
    } catch (error) {
      this.logger.error('SMS channel not available', error);
      return false;
    }
  }

  /**
   * Format SMS message by combining title and message
   */
  private formatSmsMessage(title: string, message: string): string {
    // For SMS, we typically combine title and message
    // Keep it concise due to character limits
    if (title === message) {
      return message;
    }
    return `${title}: ${message}`;
  }

  /**
   * Basic phone number validation
   * In a real implementation, you might use a library like libphonenumber
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }

    // Trim whitespace
    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      return false;
    }

    // Basic validation: should start with + and contain only digits, spaces, hyphens, parentheses
    const cleanedNumber = trimmed.replace(/[\s\-()]/g, '');

    // Must start with + followed by country code (1-9, not 0)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;

    // Check for letters or other invalid characters
    if (/[a-zA-Z]/.test(cleanedNumber)) {
      return false;
    }

    return (
      phoneRegex.test(cleanedNumber) &&
      cleanedNumber.length >= 8 && // Minimum: +1234567 (7 digits + country code)
      cleanedNumber.length <= 16 // Maximum: +123456789012345 (15 digits + country code)
    );
  }
}
