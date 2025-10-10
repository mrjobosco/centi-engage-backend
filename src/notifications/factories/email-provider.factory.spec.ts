/* eslint-disable @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  EmailProviderFactory,
  TenantEmailConfig,
} from './email-provider.factory';
import { ResendProvider } from '../providers/email/resend.provider';
import { AwsSesProvider } from '../providers/email/aws-ses.provider';
import { OneSignalProvider } from '../providers/email/onesignal.provider';
import { SmtpProvider } from '../providers/email/smtp.provider';

// Mock all provider classes
jest.mock('../providers/email/resend.provider');
jest.mock('../providers/email/aws-ses.provider');
jest.mock('../providers/email/onesignal.provider');
jest.mock('../providers/email/smtp.provider');

describe('EmailProviderFactory', () => {
  let factory: EmailProviderFactory;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProviderFactory,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    factory = module.get<EmailProviderFactory>(EmailProviderFactory);
    configService = module.get(ConfigService);

    // Setup default SMTP config for constructor
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        SMTP_HOST: 'localhost',
        SMTP_PORT: 587,
        SMTP_SECURE: false,
        SMTP_USER: 'test@example.com',
        SMTP_PASSWORD: 'password',
      };
      return config[key] || defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProvider', () => {
    it('should create Resend provider from tenant config', async () => {
      const tenantConfig: TenantEmailConfig = {
        provider: 'resend',
        apiKey: 'tenant-resend-key',
      };

      const mockResendProvider = new ResendProvider('tenant-resend-key');
      (ResendProvider as jest.Mock).mockReturnValue(mockResendProvider);

      const result = factory.createProvider(tenantConfig);

      expect(ResendProvider).toHaveBeenCalledWith('tenant-resend-key');
      expect(result).toBe(mockResendProvider);
    });

    it('should create AWS SES provider from tenant config', async () => {
      const tenantConfig: TenantEmailConfig = {
        provider: 'aws-ses',
        region: 'us-east-1',
        accessKeyId: 'tenant-access-key',
        secretAccessKey: 'tenant-secret-key',
      };

      const mockAwsSesProvider = new AwsSesProvider({
        region: 'us-east-1',
        accessKeyId: 'tenant-access-key',
        secretAccessKey: 'tenant-secret-key',
      });
      (AwsSesProvider as jest.Mock).mockReturnValue(mockAwsSesProvider);

      const result = factory.createProvider(tenantConfig);

      expect(AwsSesProvider).toHaveBeenCalledWith({
        region: 'us-east-1',
        accessKeyId: 'tenant-access-key',
        secretAccessKey: 'tenant-secret-key',
      });
      expect(result).toBe(mockAwsSesProvider);
    });

    it('should create OneSignal provider from tenant config', async () => {
      const tenantConfig: TenantEmailConfig = {
        provider: 'onesignal',
        apiKey: 'tenant-onesignal-key',
        appId: 'tenant-app-id',
      };

      const mockOneSignalProvider = new OneSignalProvider(
        'tenant-onesignal-key',
        'tenant-app-id',
      );
      (OneSignalProvider as jest.Mock).mockReturnValue(mockOneSignalProvider);

      const result = factory.createProvider(tenantConfig);

      expect(OneSignalProvider).toHaveBeenCalledWith(
        'tenant-onesignal-key',
        'tenant-app-id',
      );
      expect(result).toBe(mockOneSignalProvider);
    });

    it('should create SMTP provider from tenant config', async () => {
      const tenantConfig: TenantEmailConfig = {
        provider: 'smtp',
        host: 'tenant-smtp.example.com',
        port: 465,
        secure: true,
        user: 'tenant@example.com',
        password: 'tenant-password',
      };

      const mockSmtpProvider = new SmtpProvider({
        host: 'tenant-smtp.example.com',
        port: 465,
        secure: true,
        user: 'tenant@example.com',
        password: 'tenant-password',
      });
      (SmtpProvider as jest.Mock).mockReturnValue(mockSmtpProvider);

      const result = factory.createProvider(tenantConfig);

      expect(SmtpProvider).toHaveBeenCalledWith({
        host: 'tenant-smtp.example.com',
        port: 465,
        secure: true,
        user: 'tenant@example.com',
        password: 'tenant-password',
      });
      expect(result).toBe(mockSmtpProvider);
    });

    it('should fall back to global Resend provider when tenant config is invalid', async () => {
      const tenantConfig: TenantEmailConfig = {
        provider: 'resend',
        // Missing apiKey
      };

      configService.get.mockImplementation((key: string) => {
        const config = {
          EMAIL_PROVIDER: 'resend',
          EMAIL_API_KEY: 'global-resend-key',
          SMTP_HOST: 'localhost',
          SMTP_PORT: 587,
          SMTP_SECURE: false,
          SMTP_USER: 'test@example.com',
          SMTP_PASSWORD: 'password',
        };
        return config[key];
      });

      const mockResendProvider = new ResendProvider('global-resend-key');
      (ResendProvider as jest.Mock).mockReturnValue(mockResendProvider);

      const result = factory.createProvider(tenantConfig);

      expect(ResendProvider).toHaveBeenCalledWith('global-resend-key');
      expect(result).toBe(mockResendProvider);
    });

    it('should fall back to SMTP when both tenant and global configs fail', async () => {
      const tenantConfig: TenantEmailConfig = {
        provider: 'resend',
        // Missing apiKey
      };

      configService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          const config = {
            EMAIL_PROVIDER: 'resend',
            // Missing EMAIL_API_KEY
            SMTP_HOST: 'localhost',
            SMTP_PORT: 587,
            SMTP_SECURE: false,
            SMTP_USER: 'test@example.com',
            SMTP_PASSWORD: 'password',
          };
          return config[key] || defaultValue;
        },
      );

      const result = factory.createProvider(tenantConfig);

      // Should return the global SMTP provider created in constructor
      expect(result).toBeInstanceOf(SmtpProvider);
    });

    it('should handle unknown provider type gracefully', async () => {
      const tenantConfig: TenantEmailConfig = {
        provider: 'unknown' as any,
        apiKey: 'some-key',
      };

      const result = factory.createProvider(tenantConfig);

      // Should fall back to SMTP
      expect(result).toBeInstanceOf(SmtpProvider);
    });

    it('should handle provider creation errors gracefully', async () => {
      const tenantConfig: TenantEmailConfig = {
        provider: 'resend',
        apiKey: 'tenant-resend-key',
      };

      (ResendProvider as jest.Mock).mockImplementation(() => {
        throw new Error('Provider initialization failed');
      });

      const result = factory.createProvider(tenantConfig);

      // Should fall back to SMTP
      expect(result).toBeInstanceOf(SmtpProvider);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of available providers', () => {
      const providers = factory.getAvailableProviders();
      expect(providers).toEqual(['resend', 'aws-ses', 'onesignal', 'smtp']);
    });
  });

  describe('validateConfig', () => {
    it('should validate Resend config successfully', () => {
      const config: TenantEmailConfig = {
        provider: 'resend',
        apiKey: 'valid-api-key',
      };

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate AWS SES config successfully', () => {
      const config: TenantEmailConfig = {
        provider: 'aws-ses',
        region: 'us-east-1',
        accessKeyId: 'access-key',
        secretAccessKey: 'secret-key',
      };

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate OneSignal config successfully', () => {
      const config: TenantEmailConfig = {
        provider: 'onesignal',
        apiKey: 'api-key',
        appId: 'app-id',
      };

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate SMTP config successfully', () => {
      const config: TenantEmailConfig = {
        provider: 'smtp',
        host: 'smtp.example.com',
        user: 'user@example.com',
        password: 'password',
        port: 587,
      };

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for missing provider', () => {
      const config = {} as TenantEmailConfig;

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Provider type is required');
    });

    it('should return errors for invalid provider', () => {
      const config: TenantEmailConfig = {
        provider: 'invalid' as any,
      };

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid provider type: invalid');
    });

    it('should return errors for incomplete Resend config', () => {
      const config: TenantEmailConfig = {
        provider: 'resend',
        // Missing apiKey
      };

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'API key is required for Resend provider',
      );
    });

    it('should return errors for incomplete AWS SES config', () => {
      const config: TenantEmailConfig = {
        provider: 'aws-ses',
        region: 'us-east-1',
        // Missing accessKeyId and secretAccessKey
      };

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Access Key ID is required for AWS SES provider',
      );
      expect(result.errors).toContain(
        'Secret Access Key is required for AWS SES provider',
      );
    });

    it('should return errors for incomplete OneSignal config', () => {
      const config: TenantEmailConfig = {
        provider: 'onesignal',
        apiKey: 'api-key',
        // Missing appId
      };

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'App ID is required for OneSignal provider',
      );
    });

    it('should return errors for incomplete SMTP config', () => {
      const config: TenantEmailConfig = {
        provider: 'smtp',
        host: 'smtp.example.com',
        // Missing user and password
      };

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User is required for SMTP provider');
      expect(result.errors).toContain('Password is required for SMTP provider');
    });

    it('should return errors for invalid SMTP port', () => {
      const config: TenantEmailConfig = {
        provider: 'smtp',
        host: 'smtp.example.com',
        user: 'user@example.com',
        password: 'password',
        port: 70000, // Invalid port
      };

      const result = factory.validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Port must be between 1 and 65535');
    });
  });
});
