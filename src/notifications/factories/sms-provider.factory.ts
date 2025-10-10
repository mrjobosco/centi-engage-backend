import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ISmsProvider } from '../interfaces/sms-provider.interface';
import { TwilioProvider } from '../providers/sms/twilio.provider';
import { TermiiProvider } from '../providers/sms/termii.provider';

export interface SmsProviderConfig {
  provider: 'twilio' | 'termii';
  apiKey: string;
  apiSecret?: string;
  fromNumber?: string;
  senderId?: string;
}

@Injectable()
export class SmsProviderFactory {
  private readonly logger = new Logger(SmsProviderFactory.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Create SMS provider instance based on configuration
   * Prioritizes tenant-specific configuration over global configuration
   */
  async createProvider(tenantId?: string): Promise<ISmsProvider> {
    try {
      // Try to get tenant-specific configuration first
      let config: SmsProviderConfig | null = null;

      if (tenantId) {
        config = await this.getTenantSmsConfig(tenantId);
      }

      // Fallback to global configuration if no tenant-specific config
      if (!config) {
        config = this.getGlobalSmsConfig();
      }

      if (!config) {
        throw new Error('No SMS provider configuration found');
      }

      return this.createProviderInstance(config);
    } catch (error) {
      this.logger.error(
        `Failed to create SMS provider: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Get tenant-specific SMS configuration
   */
  private async getTenantSmsConfig(
    tenantId: string,
  ): Promise<SmsProviderConfig | null> {
    try {
      const tenantConfig =
        await this.prismaService.tenantNotificationConfig.findUnique({
          where: { tenantId },
          select: {
            smsProvider: true,
            smsApiKey: true,
            smsApiSecret: true,
            smsFromNumber: true,
          },
        });

      if (!tenantConfig?.smsProvider || !tenantConfig?.smsApiKey) {
        return null;
      }

      return {
        provider: tenantConfig.smsProvider as 'twilio' | 'termii',
        apiKey: tenantConfig.smsApiKey,
        apiSecret: tenantConfig.smsApiSecret || undefined,
        fromNumber: tenantConfig.smsFromNumber || undefined,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to get tenant SMS config for ${tenantId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Get global SMS configuration from environment variables
   */
  private getGlobalSmsConfig(): SmsProviderConfig | null {
    const provider = this.configService.get<string>('SMS_PROVIDER');
    const apiKey = this.configService.get<string>('SMS_API_KEY');

    if (!provider || !apiKey) {
      return null;
    }

    const config: SmsProviderConfig = {
      provider: provider as 'twilio' | 'termii',
      apiKey,
    };

    // Add provider-specific configuration
    if (provider === 'twilio') {
      config.apiSecret = this.configService.get<string>('SMS_API_SECRET');
      config.fromNumber = this.configService.get<string>('SMS_FROM_NUMBER');
    } else if (provider === 'termii') {
      config.senderId = this.configService.get<string>('TERMII_SENDER_ID');
    }

    return config;
  }

  /**
   * Create provider instance based on configuration
   */
  private createProviderInstance(config: SmsProviderConfig): ISmsProvider {
    switch (config.provider) {
      case 'twilio':
        if (!config.apiSecret) {
          throw new Error(
            'Twilio requires both API key (Account SID) and API secret (Auth Token)',
          );
        }
        return new TwilioProvider(
          config.apiKey,
          config.apiSecret,
          config.fromNumber,
        );

      case 'termii':
        return new TermiiProvider(config.apiKey, config.senderId);

      default:
        throw new Error(
          `Unsupported SMS provider: ${config.provider as string}`,
        );
    }
  }

  /**
   * Get available SMS providers
   */
  getAvailableProviders(): string[] {
    return ['twilio', 'termii'];
  }

  /**
   * Validate SMS provider configuration
   */
  validateConfig(config: Partial<SmsProviderConfig>): boolean {
    if (!config.provider || !config.apiKey) {
      return false;
    }

    if (config.provider === 'twilio' && !config.apiSecret) {
      return false;
    }

    return this.getAvailableProviders().includes(config.provider);
  }
}
