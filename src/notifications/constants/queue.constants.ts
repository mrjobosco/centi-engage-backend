export const QUEUE_NAMES = {
  EMAIL_NOTIFICATIONS: 'email-notifications',
  SMS_NOTIFICATIONS: 'sms-notifications',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
