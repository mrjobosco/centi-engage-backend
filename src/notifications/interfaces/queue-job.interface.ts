import { NotificationPriority } from '../enums/notification-priority.enum';

export interface BaseJobData {
  tenantId: string;
  userId: string;
  notificationId: string;
  category: string;
  priority: NotificationPriority;
}

export interface EmailJobData extends BaseJobData {
  to: string;
  subject: string;
  templateId?: string;
  templateVariables?: Record<string, any>;
  message: string;
}

export interface SmsJobData extends BaseJobData {
  to: string;
  message: string;
}
