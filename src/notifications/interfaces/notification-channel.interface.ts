import { NotificationChannelType } from '../enums';
import { NotificationPayload } from './notification-payload.interface';
import { NotificationResult } from './notification-result.interface';

export interface INotificationChannel {
  /**
   * Send notification through this channel
   */
  send(payload: NotificationPayload): Promise<NotificationResult>;

  /**
   * Validate notification payload for this channel
   */
  validate(payload: NotificationPayload): boolean;

  /**
   * Get the channel type identifier
   */
  getChannelType(): NotificationChannelType;

  /**
   * Check if channel is available/configured
   */
  isAvailable(): Promise<boolean>;
}
