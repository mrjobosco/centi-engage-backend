import { registerAs } from '@nestjs/config';

export interface NotificationConfig {
  redis: {
    url: string;
  };
  email: {
    provider: 'resend' | 'ses' | 'onesignal' | 'smtp';
    apiKey?: string;
    fromAddress: string;
    fromName: string;
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
    };
    aws?: {
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
  sms: {
    provider: 'twilio' | 'termii';
    apiKey: string;
    apiSecret?: string;
    fromNumber?: string;
    senderId?: string;
  };
  queue: {
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
  };
  inApp: {
    expiryDays: number;
    maxUnread: number;
  };
  websocket: {
    corsOrigin: string;
  };
}

export default registerAs(
  'notification',
  (): NotificationConfig => ({
    redis: {
      url: process.env.REDIS_URL || 'redis://:redis_password@redis:6379',
    },
    email: {
      provider:
        (process.env.EMAIL_PROVIDER as
          | 'resend'
          | 'ses'
          | 'onesignal'
          | 'smtp') || 'smtp',
      apiKey: process.env.EMAIL_API_KEY,
      fromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@centihq.com',
      fromName: process.env.EMAIL_FROM_NAME || 'Notification System',
      smtp: {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
      },
      aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    },
    sms: {
      provider: (process.env.SMS_PROVIDER as 'twilio' | 'termii') || 'twilio',
      apiKey: process.env.SMS_API_KEY || '',
      apiSecret: process.env.SMS_API_SECRET,
      fromNumber: process.env.SMS_FROM_NUMBER,
      senderId: process.env.TERMII_SENDER_ID,
    },
    queue: {
      concurrency: parseInt(
        process.env.NOTIFICATION_QUEUE_CONCURRENCY || '5',
        10,
      ),
      maxRetries: parseInt(process.env.NOTIFICATION_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.NOTIFICATION_RETRY_DELAY || '5000', 10),
    },
    inApp: {
      expiryDays: parseInt(
        process.env.IN_APP_NOTIFICATION_EXPIRY_DAYS || '30',
        10,
      ),
      maxUnread: parseInt(process.env.MAX_UNREAD_NOTIFICATIONS || '100', 10),
    },
    websocket: {
      corsOrigin: process.env.WEBSOCKET_CORS_ORIGIN || 'http://localhost:3000',
    },
  }),
);
