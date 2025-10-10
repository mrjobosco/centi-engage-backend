import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { NotificationService } from '../src/notifications/services/notification.service';
import { NotificationPreferenceService } from '../src/notifications/services/notification-preference.service';
import { NotificationChannelFactory } from '../src/notifications/factories/notification-channel.factory';
import { InAppChannelService } from '../src/notifications/channels/in-app-channel.service';
import { EmailChannelService } from '../src/notifications/channels/email-channel.service';
import { SmsChannelService } from '../src/notifications/channels/sms-channel.service';
import { EmailProviderFactory } from '../src/notifications/factories/email-provider.factory';
import { SmsProviderFactory } from '../src/notifications/factories/sms-provider.factory';
import { QueueService } from '../src/notifications/services/queue.service';
import { NotificationGateway } from '../src/notifications/gateways/notification.gateway';
import { TenantContextService } from '../src/tenant/tenant-context.service';
import { PrismaService } from '../src/database/prisma.service';
import { MetricsService } from '../src/notifications/services/metrics.service';
import { NotificationLoggerService } from '../src/notifications/services/notification-logger.service';
import { PhoneNumberService } from '../src/notifications/services/phone-number.service';
import { NotificationType } from '../src/notifications/enums/notification-type.enum';
import { NotificationChannelType } from '../src/notifications/enums/notification-channel.enum';
import { prisma } from './integration-setup';
import { NotificationPayload } from '../src/notifications/interfaces/notification-payload.interface';

// Mock Redis for BullMQ
jest.mock('ioredis', () => {
  const mockRedis: any = {
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    duplicate: jest.fn(() => mockRedis),
    status: 'ready',
  };
  return jest.fn(() => mockRedis);
});

// Mock services
const mockNotificationGateway = {
  emitNotification: jest.fn(),
  emitUnreadCount: jest.fn(),
};

const mockQueueService = {
  addEmailJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
  addSmsJob: jest.fn().mockResolvedValue({ id: 'job-2' }),
  getEmailQueueStats: jest
    .fn()
    .mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
  getSmsQueueStats: jest
    .fn()
    .mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 }),
};

const mockEmailProviderFactory = {
  getProvider: jest.fn().mockResolvedValue({
    send: jest
      .fn()
      .mockResolvedValue({ success: true, messageId: 'email-123' }),
    getProviderName: jest.fn().mockReturnValue('mock-email'),
  }),
};

const mockSmsProviderFactory = {
  getProvider: jest.fn().mockResolvedValue({
    send: jest.fn().mockResolvedValue({ success: true, messageId: 'sms-123' }),
    getProviderName: jest.fn().mockReturnValue('mock-sms'),
  }),
};

describe('Notification Preference System Integration Tests (Simple)', () => {
  let notificationService: NotificationService;
  let notificationPreferenceService: NotificationPreferenceService;
  let channelFactory: NotificationChannelFactory;
  let tenantContextService: TenantContextService;
  let prismaService: PrismaService;
  let inAppChannel: InAppChannelService;
  let emailChannel: EmailChannelService;
  let smsChannel: SmsChannelService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        EventEmitterModule.forRoot(),
        BullModule.forRoot({
          connection: {
            host: 'localhost',
            port: 6379,
          },
        }),
      ],
      providers: [
        NotificationService,
        NotificationPreferenceService,
        NotificationChannelFactory,
        InAppChannelService,
        EmailChannelService,
        SmsChannelService,
        {
          provide: TenantContextService,
          useValue: {
            setTenantId: jest.fn(),
            getTenantId: jest.fn(),
            getRequiredTenantId: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: NotificationGateway,
          useValue: mockNotificationGateway,
        },
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: EmailProviderFactory,
          useValue: mockEmailProviderFactory,
        },
        {
          provide: SmsProviderFactory,
          useValue: mockSmsProviderFactory,
        },
        {
          provide: MetricsService,
          useValue: {
            incrementNotificationCount: jest.fn(),
            recordDeliveryTime: jest.fn(),
            incrementFailureCount: jest.fn(),
            recordFailure: jest.fn(),
            recordDelivery: jest.fn(),
            startTimer: jest.fn().mockReturnValue(jest.fn()),
          },
        },
        {
          provide: NotificationLoggerService,
          useValue: {
            logNotificationCreated: jest.fn(),
            logChannelDelivery: jest.fn(),
            logDeliveryFailure: jest.fn(),
          },
        },
        {
          provide: PhoneNumberService,
          useValue: {
            getUserPhoneNumber: jest.fn().mockResolvedValue('+1234567890'),
            isValidPhoneNumber: jest.fn().mockReturnValue(true),
            formatPhoneNumber: jest.fn().mockReturnValue('+1234567890'),
          },
        },
      ],
    }).compile();

    notificationService = module.get<NotificationService>(NotificationService);
    notificationPreferenceService = module.get<NotificationPreferenceService>(
      NotificationPreferenceService,
    );
    channelFactory = module.get<NotificationChannelFactory>(
      NotificationChannelFactory,
    );
    tenantContextService =
      module.get<TenantContextService>(TenantContextService);
    prismaService = module.get<PrismaService>(PrismaService);
    inAppChannel = module.get<InAppChannelService>(InAppChannelService);
    emailChannel = module.get<EmailChannelService>(EmailChannelService);
    smsChannel = module.get<SmsChannelService>(SmsChannelService);

    // Register channels with factory
    channelFactory.registerChannel(inAppChannel);
    channelFactory.registerChannel(emailChannel);
    channelFactory.registerChannel(smsChannel);
  });

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  async function createTestData() {
    // Create test tenant with unique subdomain
    const uniqueId = Math.random().toString(36).substring(7);
    const testTenant = await prismaService.tenant.create({
      data: {
        name: `Test Tenant ${uniqueId}`,
        subdomain: `test-tenant-${uniqueId}`,
      },
    });

    // Create test users with unique emails
    const testUser1 = await prismaService.user.create({
      data: {
        email: `user1-${uniqueId}@example.com`,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User1',
        tenantId: testTenant.id,
      },
    });

    const testUser2 = await prismaService.user.create({
      data: {
        email: `user2-${uniqueId}@example.com`,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User2',
        tenantId: testTenant.id,
      },
    });

    // Mock tenant context service to return the test tenant ID
    (tenantContextService.getTenantId as jest.Mock).mockReturnValue(
      testTenant.id,
    );
    (tenantContextService.getRequiredTenantId as jest.Mock).mockReturnValue(
      testTenant.id,
    );

    return { testTenant, testUser1, testUser2 };
  }

  describe('Basic Preference Operations', () => {
    it('should get enabled channels for user with default preferences', async () => {
      // Arrange
      const { testTenant, testUser1 } = await createTestData();

      // Act - Get enabled channels (should use system defaults)
      const enabledChannels =
        await notificationPreferenceService.getEnabledChannels(
          testUser1.id,
          testTenant.id,
          'system',
        );

      // Assert - Should have default channels enabled
      expect(enabledChannels).toBeDefined();
      expect(Array.isArray(enabledChannels)).toBe(true);
      // Default should include in-app and email, but not SMS
      expect(enabledChannels).toContain(NotificationChannelType.IN_APP);
      expect(enabledChannels).toContain(NotificationChannelType.EMAIL);
    });

    it('should handle non-existent user gracefully', async () => {
      // Arrange
      const { testTenant } = await createTestData();
      const nonExistentUserId = 'non-existent-user-id';

      // Act
      const enabledChannels =
        await notificationPreferenceService.getEnabledChannels(
          nonExistentUserId,
          testTenant.id,
          'system',
        );

      // Assert - Should return default channels
      expect(enabledChannels).toBeDefined();
      expect(Array.isArray(enabledChannels)).toBe(true);
    });
  });

  describe('Notification Creation with Preferences', () => {
    it('should create notification respecting default preferences', async () => {
      // Arrange
      const { testTenant, testUser1 } = await createTestData();

      // Act - Create notification (should use default preferences)
      const notification = await notificationService.create({
        tenantId: testTenant.id,
        userId: testUser1.id,
        category: 'system',
        type: NotificationType.INFO,
        title: 'Test Notification',
        message: 'Testing preference integration',
      });

      // Assert - Notification should be created successfully
      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(notification.tenantId).toBe(testTenant.id);
      expect(notification.userId).toBe(testUser1.id);
      expect(notification.title).toBe('Test Notification');

      // Verify notification exists in database
      const dbNotification = await prismaService.notification.findUnique({
        where: { id: notification.id },
      });
      expect(dbNotification).toBeDefined();
    });

    it('should handle multiple notifications for same user', async () => {
      // Arrange
      const { testTenant, testUser1 } = await createTestData();

      // Act - Create multiple notifications
      const notification1 = await notificationService.create({
        tenantId: testTenant.id,
        userId: testUser1.id,
        category: 'system',
        type: NotificationType.INFO,
        title: 'First Notification',
        message: 'First test notification',
      });

      const notification2 = await notificationService.create({
        tenantId: testTenant.id,
        userId: testUser1.id,
        category: 'system',
        type: NotificationType.WARNING,
        title: 'Second Notification',
        message: 'Second test notification',
      });

      // Assert - Both notifications should be created
      expect(notification1).toBeDefined();
      expect(notification2).toBeDefined();
      expect(notification1.id).not.toBe(notification2.id);

      // Verify both exist in database
      const notifications = await prismaService.notification.findMany({
        where: {
          userId: testUser1.id,
          tenantId: testTenant.id,
        },
      });

      expect(notifications.length).toBeGreaterThan(0);

      // Check that we have notifications with both titles
      const firstNotifications = notifications.filter(
        (n) => n.title === 'First Notification',
      );
      const secondNotifications = notifications.filter(
        (n) => n.title === 'Second Notification',
      );

      expect(firstNotifications.length).toBeGreaterThan(0);
      expect(secondNotifications.length).toBeGreaterThan(0);
    });
  });
});
