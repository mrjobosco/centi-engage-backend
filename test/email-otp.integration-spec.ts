import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EmailOTPService } from '../src/auth/services/email-otp.service';
import { OTPStorageService } from '../src/auth/services/otp-storage.service';
import { NotificationService } from '../src/notifications/services/notification.service';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/tenant/tenant-context.service';
// import { prisma } from './integration-setup'; // Not needed for this test
import configuration from '../src/config/configuration';

describe('Email OTP Integration Tests', () => {
  let emailOTPService: EmailOTPService;
  let notificationService: NotificationService;
  let prismaService: PrismaService;
  let tenantContextService: TenantContextService;
  let testTenant: any;
  let testUser: any;

  beforeAll(async () => {
    // Create mock prisma service
    const mockPrismaService = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
      },
      tenant: {
        create: jest.fn(),
        delete: jest.fn(),
      },
      $executeRaw: jest.fn(),
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [
        EmailOTPService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: OTPStorageService,
          useValue: {
            checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
            storeOTP: jest.fn().mockResolvedValue(undefined),
            getOTP: jest.fn(),
            deleteOTP: jest.fn().mockResolvedValue(undefined),
            incrementAttempts: jest.fn(),
            getRemainingTTL: jest.fn(),
            clearRateLimit: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendToUser: jest.fn().mockResolvedValue({
              id: 'test-notification-id',
              tenantId: 'test-tenant-id',
              userId: 'test-user-id',
              type: 'INFO',
              category: 'email_verification',
              title: 'Email Verification Required',
              message: 'Your verification code is 123456',
              channelsSent: ['EMAIL'],
              createdAt: new Date(),
            }),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            getTenantId: jest.fn(),
            setTenantId: jest.fn(),
          },
        },
      ],
    }).compile();

    emailOTPService = module.get<EmailOTPService>(EmailOTPService);
    notificationService = module.get<NotificationService>(NotificationService);
    prismaService = module.get<PrismaService>(PrismaService);
    tenantContextService =
      module.get<TenantContextService>(TenantContextService);

    // Create test data
    testTenant = {
      id: 'test-tenant-id',
      name: 'Test Tenant',
      subdomain: 'test-otp',
    };

    testUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      tenantId: testTenant.id,
      emailVerified: false,
      authMethods: ['email'],
    };

    // Set tenant context
    jest
      .spyOn(tenantContextService, 'getTenantId')
      .mockReturnValue(testTenant.id);

    // Mock user lookup for OTP service
    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
      id: testUser.id,
      firstName: testUser.firstName,
      lastName: testUser.lastName,
      tenantId: testUser.tenantId,
    } as any);

    // Mock database operations
    jest.spyOn(prismaService, '$executeRaw').mockResolvedValue(1);
    jest
      .spyOn(prismaService, '$queryRaw')
      .mockResolvedValue([{ email_verified: false, auth_methods: ['email'] }]);
  });

  afterAll(async () => {
    // No cleanup needed for mocked data
  });

  describe('generateOTP', () => {
    it('should generate OTP and send notification with proper template variables', async () => {
      const result = await emailOTPService.generateOTP(
        testUser.id,
        testUser.email,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('OTP generated and sent successfully');

      // Verify notification service was called with correct parameters
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        testUser.id,
        expect.objectContaining({
          type: 'INFO',
          category: 'email_verification',
          title: 'Email Verification Required',
          priority: 'HIGH',
          templateVariables: expect.objectContaining({
            firstName: 'Test',
            otp: expect.any(String),
            expirationTime: '30 minutes',
            companyName: 'Your Company',
            supportEmail: 'support@company.com',
          }),
        }),
      );

      // Verify OTP format (6 digits)
      const call = (notificationService.sendToUser as jest.Mock).mock
        .calls[0][1];
      const otp = call.templateVariables.otp;
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should handle notification service errors gracefully', async () => {
      // Mock notification service to throw error
      jest
        .spyOn(notificationService, 'sendToUser')
        .mockRejectedValueOnce(new Error('Email service unavailable'));

      // OTP generation should still succeed even if email fails
      const result = await emailOTPService.generateOTP(
        testUser.id,
        testUser.email,
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('OTP generated and sent successfully');
    });
  });

  describe('template integration', () => {
    it('should use category-based template lookup for email_verification', async () => {
      await emailOTPService.generateOTP(testUser.id, testUser.email);

      const call = (notificationService.sendToUser as jest.Mock).mock
        .calls[0][1];

      // Should not have templateId (using category-based lookup)
      expect(call.templateId).toBeUndefined();

      // Should have correct category
      expect(call.category).toBe('email_verification');

      // Should have all required template variables
      expect(call.templateVariables).toEqual(
        expect.objectContaining({
          firstName: expect.any(String),
          otp: expect.any(String),
          expirationTime: expect.any(String),
          companyName: expect.any(String),
          supportEmail: expect.any(String),
        }),
      );
    });
  });
});
