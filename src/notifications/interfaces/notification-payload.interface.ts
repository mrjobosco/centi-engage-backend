import { NotificationType, NotificationPriority } from '../enums';

export interface NotificationPayload {
  tenantId: string;
  userId: string;
  category: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: NotificationPriority;
  expiresAt?: Date;
  templateId?: string;
  templateVariables?: Record<string, any>;
}
