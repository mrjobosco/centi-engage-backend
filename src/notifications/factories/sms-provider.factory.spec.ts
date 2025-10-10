import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmsProviderFactory, SmsProviderConfig } from './sms-provider.factory';
import { PrismaService } from '../../database/prisma.service';
import { TwilioProvider } from '../providers/sms/twilio.provider';
import { TermiiProvider } from '../providers/sms/termii.provider';

// Mock the PrismaService
jest.mock('../../database/prisma.service');

describe('SmsProviderFactory', () => {
  let factory: SmsProviderFactory;
  let configService: jest.Mocked<ConfigService>;
  let mockFindUnique: jest.MockedFunction<any>;

  const mockTenantId = 'tenant-123';

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn(),
    };

    mockFindUnique = jest.fn();
    const mockPrismaService = {
      tenantNotificationConfig: {
        findUnique: mockFindUnique,
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsProviderFactory,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    factory = module.get<SmsProviderFactory>(SmsProviderFactory);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('createProvider', () => {
    describe('with tenant-specific configuration', () => {
      it('should create Twilio provider with tenant config', async () => {
        const tenantConfig = {
          smsProvider: 'twilio',
          smsApiKey: 'AC1234567890123456789012345678901234',
          smsApiSecret: 'tenant-auth-token',
          smsFromNumber: '+1234567890',
        };

        mockFindUnique.mockResolvedValue(tenantConfig);

        const provider = await factory.createProvider(mockTenantId);

        expect(provider).toBeInstanceOf(TwilioProvider);
        expect(provider.getProviderName()).toBe('twilio');

        expect(mockFindUnique).toHaveBeenCalledWith({
          where: { tenantId: mockTenantId },
          select: {
            smsProvider: true,
            smsApiKey: true,
            smsApiSecret: true,
            smsFromNumber: true,
          },
        });
      });

      it('should create Termii provider with tenant config', async () => {
        const tenantConfig = {
          smsProvider: 'termii',
          smsApiKey: 'tenant-termii-key',
          smsApiSecret: null,
          smsFromNumber: 'TenantApp',
        };

        mockFindUnique.mockResolvedValue(tenantConfig);

        const provider = await factory.createProvider(mockTenantId);

        expect(provider).toBeInstanceOf(TermiiProvider);
        expect(provider.getProviderName()).toBe('termii');
      });
    });

    describe('with global configuration fallback', () => {
      beforeEach(() => {
        // Mock no tenant config found
        mockFindUnique.mockResolvedValue(null);
      });

      it('should create Twilio provider with global config', async () => {
        configService.get.mockImplementation((key: string) => {
          const config: Record<string, string> = {
            SMS_PROVIDER: 'twilio',
            SMS_API_KEY: 'AC9876543210987654321098765432109876',
            SMS_API_SECRET: 'global-auth-token',
            SMS_FROM_NUMBER: '+0987654321',
          };
          return config[key];
        });

        const provider = await factory.createProvider(mockTenantId);

        expect(provider).toBeInstanceOf(TwilioProvider);
        expect(provider.getProviderName()).toBe('twilio');
      });

      it('should create Termii provider with global config', async () => {
        configService.get.mockImplementation((key: string) => {
          const config: Record<string, string> = {
            SMS_PROVIDER: 'termii',
            SMS_API_KEY: 'global-termii-key',
            TERMII_SENDER_ID: 'GlobalApp',
          };
          return config[key];
        });

        const provider = await factory.createProvider(mockTenantId);

        expect(provider).toBeInstanceOf(TermiiProvider);
        expect(provider.getProviderName()).toBe('termii');
      });

      it('should create provider without tenant ID using global config', async () => {
        configService.get.mockImplementation((key: string) => {
          const config: Record<string, string> = {
            SMS_PROVIDER: 'twilio',
            SMS_API_KEY: 'AC5555555555555555555555555555555555',
            SMS_API_SECRET: 'global-auth-token',
          };
          return config[key];
        });

        const provider = await factory.createProvider();

        expect(provider).toBeInstanceOf(TwilioProvider);

        expect(mockFindUnique).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should throw error when no configuration is found', async () => {
        mockFindUnique.mockResolvedValue(null);
        configService.get.mockReturnValue(undefined);

        await expect(factory.createProvider(mockTenantId)).rejects.toThrow(
          'No SMS provider configuration found',
        );
      });

      it('should throw error for unsupported provider', async () => {
        const tenantConfig = {
          smsProvider: 'unsupported',
          smsApiKey: 'some-key',
          smsApiSecret: null,
          smsFromNumber: null,
        };

        mockFindUnique.mockResolvedValue(tenantConfig);

        await expect(factory.createProvider(mockTenantId)).rejects.toThrow(
          'Unsupported SMS provider: unsupported',
        );
      });

      it('should throw error when Twilio is missing auth token', async () => {
        const tenantConfig = {
          smsProvider: 'twilio',
          smsApiKey: 'account-sid',
          smsApiSecret: null,
          smsFromNumber: null,
        };

        mockFindUnique.mockResolvedValue(tenantConfig);

        await expect(factory.createProvider(mockTenantId)).rejects.toThrow(
          'Twilio requires both API key (Account SID) and API secret (Auth Token)',
        );
      });

      it('should handle database errors gracefully', async () => {
        mockFindUnique.mockRejectedValue(new Error('Database error'));

        configService.get.mockImplementation((key: string) => {
          const config: Record<string, string> = {
            SMS_PROVIDER: 'twilio',
            SMS_API_KEY: 'AC7777777777777777777777777777777777',
            SMS_API_SECRET: 'global-auth-token',
          };
          return config[key];
        });

        // Should fallback to global config when tenant config fails
        const provider = await factory.createProvider(mockTenantId);
        expect(provider).toBeInstanceOf(TwilioProvider);
      });
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of available providers', () => {
      const providers = factory.getAvailableProviders();
      expect(providers).toEqual(['twilio', 'termii']);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid Twilio config', () => {
      const config: SmsProviderConfig = {
        provider: 'twilio',
        apiKey: 'account-sid',
        apiSecret: 'auth-token',
      };

      expect(factory.validateConfig(config)).toBe(true);
    });

    it('should validate valid Termii config', () => {
      const config: SmsProviderConfig = {
        provider: 'termii',
        apiKey: 'termii-key',
      };

      expect(factory.validateConfig(config)).toBe(true);
    });

    it('should reject config without provider', () => {
      const config = {
        apiKey: 'some-key',
      };

      expect(factory.validateConfig(config)).toBe(false);
    });

    it('should reject config without API key', () => {
      const config = {
        provider: 'twilio' as const,
      };

      expect(factory.validateConfig(config)).toBe(false);
    });

    it('should reject Twilio config without auth token', () => {
      const config = {
        provider: 'twilio' as const,
        apiKey: 'account-sid',
      };

      expect(factory.validateConfig(config)).toBe(false);
    });

    it('should reject unsupported provider', () => {
      const config = {
        provider: 'unsupported' as any,
        apiKey: 'some-key',
      };

      expect(factory.validateConfig(config)).toBe(false);
    });
  });
});
