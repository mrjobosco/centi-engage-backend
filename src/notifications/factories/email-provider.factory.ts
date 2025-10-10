import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEmailProvider } from '../interfaces/email-provider.interface';
import { ResendProvider } from '../providers/email/resend.provider';
import {
  AwsSesProvider,
  AwsSesConfig,
} from '../providers/email/aws-ses.provider';
import { OneSignalProvider } from '../providers/email/onesignal.provider';
import { SmtpProvider, SmtpConfig } from '../providers/email/smtp.provider';

export interface TenantEmailConfig {
  provider: 'resend' | 'aws-ses' | 'onesignal' | 'smtp';
  apiKey?: string;
  apiSecret?: string;
  fromAddress?: string;
  fromName?: string;
  // AWS SES specific
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  // OneSignal specific
  appId?: string;
  // SMTP specific
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
}

@Injectable()
export class EmailProviderFactory {
  private readonly logger = new Logger(EmailProviderFactory.name);
  private readonly globalSmtpProvider: SmtpProvider;

  constructor(private readonly configService: ConfigService) {
    // Initialize global SMTP provider as fallback
    const smtpConfig: SmtpConfig = {
      host: this.configService.get<string>('SMTP_HOST', 'localhost'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      user: this.configService.get<string>('SMTP_USER', ''),
      password: this.configService.get<string>('SMTP_PASSWORD', ''),
    };
    this.globalSmtpProvider = new SmtpProvider(smtpConfig);
  }

  /**
   * Create email provider instance based on configuration
   * Falls back to tenant config, then global config, then SMTP
   */
  createProvider(tenantConfig?: TenantEmailConfig): IEmailProvider {
    try {
      // Try tenant-specific configuration first
      if (tenantConfig) {
        const provider = this.createProviderFromConfig(tenantConfig);
        if (provider) {
          this.logger.debug(
            `Using tenant-specific ${tenantConfig.provider} provider`,
          );
          return provider;
        }
      }

      // Fall back to global configuration
      const globalProvider = this.createGlobalProvider();
      if (globalProvider) {
        this.logger.debug(`Using global email provider`);
        return globalProvider;
      }

      // Final fallback to SMTP
      this.logger.warn('Falling back to SMTP provider');
      return this.globalSmtpProvider;
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to create email provider: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      this.logger.warn('Falling back to SMTP provider');
      return this.globalSmtpProvider;
    }
  }

  /**
   * Create provider from specific configuration
   */
  private createProviderFromConfig(
    config: TenantEmailConfig,
  ): IEmailProvider | null {
    try {
      switch (config.provider) {
        case 'resend': {
          if (!config.apiKey) {
            this.logger.warn('Resend API key not provided in tenant config');
            return null;
          }
          return new ResendProvider(config.apiKey);
        }

        case 'aws-ses': {
          if (
            !config.region ||
            !config.accessKeyId ||
            !config.secretAccessKey
          ) {
            this.logger.warn(
              'AWS SES configuration incomplete in tenant config',
            );
            return null;
          }
          const awsConfig: AwsSesConfig = {
            region: config.region,
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          };
          return new AwsSesProvider(awsConfig);
        }

        case 'onesignal': {
          if (!config.apiKey || !config.appId) {
            this.logger.warn(
              'OneSignal configuration incomplete in tenant config',
            );
            return null;
          }
          return new OneSignalProvider(config.apiKey, config.appId);
        }

        case 'smtp': {
          if (!config.host || !config.user || !config.password) {
            this.logger.warn('SMTP configuration incomplete in tenant config');
            return null;
          }
          const smtpConfig: SmtpConfig = {
            host: config.host,
            port: config.port || 587,
            secure: config.secure || false,
            user: config.user,
            password: config.password,
          };
          return new SmtpProvider(smtpConfig);
        }

        default:
          this.logger.warn(
            `Unknown email provider: ${String(config.provider)}`,
          );
          return null;
      }
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to create ${config.provider} provider: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  /**
   * Create provider from global environment configuration
   */
  private createGlobalProvider(): IEmailProvider | null {
    const provider = this.configService.get<string>('EMAIL_PROVIDER');

    if (!provider) {
      this.logger.debug('No global email provider configured');
      return null;
    }

    try {
      switch (provider) {
        case 'resend': {
          const resendApiKey = this.configService.get<string>('EMAIL_API_KEY');
          if (!resendApiKey) {
            this.logger.warn('Resend API key not configured globally');
            return null;
          }
          return new ResendProvider(resendApiKey);
        }

        case 'aws-ses': {
          const awsRegion = this.configService.get<string>('AWS_REGION');
          const awsAccessKeyId =
            this.configService.get<string>('AWS_ACCESS_KEY_ID');
          const awsSecretAccessKey = this.configService.get<string>(
            'AWS_SECRET_ACCESS_KEY',
          );

          if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) {
            this.logger.warn('AWS SES configuration incomplete globally');
            return null;
          }

          const awsConfig: AwsSesConfig = {
            region: awsRegion,
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
          };
          return new AwsSesProvider(awsConfig);
        }

        case 'onesignal': {
          const oneSignalApiKey =
            this.configService.get<string>('EMAIL_API_KEY');
          const oneSignalAppId =
            this.configService.get<string>('ONESIGNAL_APP_ID');

          if (!oneSignalApiKey || !oneSignalAppId) {
            this.logger.warn('OneSignal configuration incomplete globally');
            return null;
          }
          return new OneSignalProvider(oneSignalApiKey, oneSignalAppId);
        }

        case 'smtp':
          // SMTP is handled by the global fallback
          return this.globalSmtpProvider;

        default:
          this.logger.warn(`Unknown global email provider: ${provider}`);
          return null;
      }
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to create global ${provider} provider: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  /**
   * Get available provider types
   */
  getAvailableProviders(): string[] {
    return ['resend', 'aws-ses', 'onesignal', 'smtp'];
  }

  /**
   * Validate provider configuration
   */
  validateConfig(config: TenantEmailConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.provider) {
      errors.push('Provider type is required');
      return { valid: false, errors };
    }

    if (!this.getAvailableProviders().includes(config.provider)) {
      errors.push(`Invalid provider type: ${config.provider}`);
      return { valid: false, errors };
    }

    switch (config.provider) {
      case 'resend':
        if (!config.apiKey) {
          errors.push('API key is required for Resend provider');
        }
        break;

      case 'aws-ses':
        if (!config.region)
          errors.push('Region is required for AWS SES provider');
        if (!config.accessKeyId)
          errors.push('Access Key ID is required for AWS SES provider');
        if (!config.secretAccessKey)
          errors.push('Secret Access Key is required for AWS SES provider');
        break;

      case 'onesignal':
        if (!config.apiKey)
          errors.push('API key is required for OneSignal provider');
        if (!config.appId)
          errors.push('App ID is required for OneSignal provider');
        break;

      case 'smtp':
        if (!config.host) errors.push('Host is required for SMTP provider');
        if (!config.user) errors.push('User is required for SMTP provider');
        if (!config.password)
          errors.push('Password is required for SMTP provider');
        if (config.port && (config.port < 1 || config.port > 65535)) {
          errors.push('Port must be between 1 and 65535');
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Safely extract error message from unknown error type
   */
  private extractErrorMessage(error: unknown): string {
    // Check if it's a standard Error object
    if (error instanceof Error) {
      return error.message;
    }

    // Check if it's an object with a message property
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }

    // Fallback for any other type
    return 'Unknown error';
  }
}
