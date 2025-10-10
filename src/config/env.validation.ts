import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

enum EmailProvider {
  Resend = 'resend',
  SES = 'ses',
  OneSignal = 'onesignal',
  SMTP = 'smtp',
}

enum SmsProvider {
  Twilio = 'twilio',
  Termii = 'termii',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRATION: string = '15m';

  // Google OAuth Configuration
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  GOOGLE_LINK_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  TENANT_HEADER_NAME: string = 'x-tenant-id';

  @IsBoolean()
  @IsOptional()
  ENABLE_SUBDOMAIN_ROUTING: boolean = false;

  // Redis Configuration
  @IsString()
  @IsOptional()
  REDIS_URL: string = 'redis://localhost:6379';

  // Notification Queue Configuration
  @IsNumber()
  @IsOptional()
  NOTIFICATION_QUEUE_CONCURRENCY: number = 5;

  @IsNumber()
  @IsOptional()
  NOTIFICATION_MAX_RETRIES: number = 3;

  @IsNumber()
  @IsOptional()
  NOTIFICATION_RETRY_DELAY: number = 5000;

  // WebSocket Configuration
  @IsString()
  @IsOptional()
  WEBSOCKET_CORS_ORIGIN: string = 'http://localhost:3000';

  // Email Configuration
  @IsEnum(EmailProvider)
  @IsOptional()
  EMAIL_PROVIDER: EmailProvider = EmailProvider.SMTP;

  @IsString()
  @IsOptional()
  EMAIL_API_KEY?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM_ADDRESS: string = 'noreply@example.com';

  @IsString()
  @IsOptional()
  EMAIL_FROM_NAME: string = 'Notification System';

  // SMTP Configuration
  @IsString()
  @IsOptional()
  SMTP_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  SMTP_PORT: number = 587;

  @IsBoolean()
  @IsOptional()
  SMTP_SECURE: boolean = false;

  @IsString()
  @IsOptional()
  SMTP_USER: string = '';

  @IsString()
  @IsOptional()
  SMTP_PASSWORD: string = '';

  // AWS SES Configuration
  @IsString()
  @IsOptional()
  AWS_REGION: string = 'us-east-1';

  @IsString()
  @IsOptional()
  AWS_ACCESS_KEY_ID: string = '';

  @IsString()
  @IsOptional()
  AWS_SECRET_ACCESS_KEY: string = '';

  // SMS Configuration
  @IsEnum(SmsProvider)
  @IsOptional()
  SMS_PROVIDER: SmsProvider = SmsProvider.Twilio;

  @IsString()
  @IsOptional()
  SMS_API_KEY: string = '';

  @IsString()
  @IsOptional()
  SMS_API_SECRET?: string;

  @IsString()
  @IsOptional()
  SMS_FROM_NUMBER?: string;

  @IsString()
  @IsOptional()
  TERMII_SENDER_ID?: string;

  // Alerting Configuration
  @IsBoolean()
  @IsOptional()
  ALERTING_ENABLED: boolean = false;

  @IsNumber()
  @IsOptional()
  ALERT_FAILURE_RATE_THRESHOLD: number = 5;

  @IsBoolean()
  @IsOptional()
  ALERT_FAILURE_RATE_ENABLED: boolean = true;

  @IsNumber()
  @IsOptional()
  ALERT_QUEUE_DEPTH_THRESHOLD: number = 1000;

  @IsBoolean()
  @IsOptional()
  ALERT_QUEUE_DEPTH_ENABLED: boolean = true;

  @IsNumber()
  @IsOptional()
  ALERT_QUEUE_LAG_THRESHOLD: number = 300;

  @IsBoolean()
  @IsOptional()
  ALERT_QUEUE_LAG_ENABLED: boolean = true;

  @IsNumber()
  @IsOptional()
  ALERT_PROVIDER_ERROR_THRESHOLD: number = 10;

  @IsBoolean()
  @IsOptional()
  ALERT_PROVIDER_ERROR_ENABLED: boolean = true;

  @IsString()
  @IsOptional()
  ALERT_WEBHOOK_URL?: string;

  @IsString()
  @IsOptional()
  ALERT_EMAIL_RECIPIENTS?: string;

  @IsString()
  @IsOptional()
  ALERT_SLACK_WEBHOOK_URL?: string;

  // In-App Notification Configuration
  @IsNumber()
  @IsOptional()
  IN_APP_NOTIFICATION_EXPIRY_DAYS: number = 30;

  @IsNumber()
  @IsOptional()
  MAX_UNREAD_NOTIFICATIONS: number = 100;

  // Data Privacy Configuration
  @IsNumber()
  @IsOptional()
  NOTIFICATION_RETENTION_DAYS: number = 90;

  @IsNumber()
  @IsOptional()
  AUDIT_LOG_RETENTION_DAYS: number = 365;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
