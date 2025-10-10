import { NotificationChannelType } from '../enums';

export interface NotificationResult {
  success: boolean;
  channel: NotificationChannelType;
  messageId?: string;
  error?: string;
  deliveryLogId?: string;
}
