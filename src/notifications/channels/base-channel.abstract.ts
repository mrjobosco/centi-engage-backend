import { Logger } from '@nestjs/common';
import { INotificationChannel } from '../interfaces/notification-channel.interface';
import { NotificationPayload } from '../interfaces/notification-payload.interface';
import { NotificationResult } from '../interfaces/notification-result.interface';
import { NotificationChannelType } from '../enums/notification-channel.enum';

export abstract class BaseChannel implements INotificationChannel {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * Send notification through this channel
   * Must be implemented by concrete channel classes
   */
  abstract send(payload: NotificationPayload): Promise<NotificationResult>;

  /**
   * Get the channel type identifier
   * Must be implemented by concrete channel classes
   */
  abstract getChannelType(): NotificationChannelType;

  /**
   * Validate notification payload for this channel
   * Base implementation checks required fields, can be overridden
   */
  validate(payload: NotificationPayload): boolean {
    if (!payload) {
      this.logger.warn('Notification payload is null or undefined');
      return false;
    }

    // Check required fields
    const requiredFields = [
      'tenantId',
      'userId',
      'category',
      'type',
      'title',
      'message',
    ];
    for (const field of requiredFields) {
      if (!payload[field as keyof NotificationPayload]) {
        this.logger.warn(`Missing required field: ${field}`);
        return false;
      }
    }

    // Validate string fields are not empty
    const stringFields = ['tenantId', 'userId', 'category', 'title', 'message'];
    for (const field of stringFields) {
      const value = payload[field as keyof NotificationPayload];
      if (typeof value === 'string' && value.trim().length === 0) {
        this.logger.warn(`Field ${field} cannot be empty`);
        return false;
      }
    }

    return true;
  }

  /**
   * Check if channel is available/configured
   * Base implementation returns true, can be overridden
   */
  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }

  /**
   * Create a successful notification result
   */
  protected createSuccessResult(
    messageId?: string,
    deliveryLogId?: string,
  ): NotificationResult {
    return {
      success: true,
      channel: this.getChannelType(),
      messageId,
      deliveryLogId,
    };
  }

  /**
   * Create a failed notification result
   */
  protected createFailureResult(error: string): NotificationResult {
    return {
      success: false,
      channel: this.getChannelType(),
      error,
    };
  }

  /**
   * Log notification attempt
   */
  protected logNotificationAttempt(payload: NotificationPayload): void {
    this.logger.log(
      `Attempting to send ${this.getChannelType()} notification`,
      {
        tenantId: payload.tenantId,
        userId: payload.userId,
        category: payload.category,
        type: payload.type,
        channel: this.getChannelType(),
      },
    );
  }

  /**
   * Log notification success
   */
  protected logNotificationSuccess(
    payload: NotificationPayload,
    messageId?: string,
  ): void {
    this.logger.log(`Successfully sent ${this.getChannelType()} notification`, {
      tenantId: payload.tenantId,
      userId: payload.userId,
      category: payload.category,
      messageId,
      channel: this.getChannelType(),
    });
  }

  /**
   * Log notification failure
   */
  protected logNotificationFailure(
    payload: NotificationPayload,
    error: string,
  ): void {
    this.logger.error(
      `Failed to send ${this.getChannelType()} notification: ${error}`,
      {
        tenantId: payload.tenantId,
        userId: payload.userId,
        category: payload.category,
        error,
        channel: this.getChannelType(),
      },
    );
  }
}
