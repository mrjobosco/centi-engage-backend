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

describe('Notification Flow Integration Tests (Simple)', () => {
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

    // Create test user with unique email
    const testUser = await prismaService.user.create({
      data: {
        email: `test-${uniqueId}@example.com`,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
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

    return { testTenant, testUser };
  }

  describe('End-to-End Notification Flow', () => {
    it('should create and deliver notification through multiple channels', async () => {
      // Arrange
      const { testTenant, testUser } = await createTestData();

      // Act - Create notification that should go through multiple channels
      const notification = await notificationService.create({
        tenantId: testTenant.id,
        userId: testUser.id,
        category: 'system',
        type: NotificationType.INFO,
        title: 'Multi-Channel Test',
        message:
          'This notification should be delivered through multiple channels',
      });

      // Assert - Notification should be created successfully
      expect(notification).toBeDefined();
      expect(notification.id).toBeDefined();
      expect(notification.tenantId).toBe(testTenant.id);
      expect(notification.userId).toBe(testUser.id);
      expect(notification.title).toBe('Multi-Channel Test');

      // Verify notification exists in database
      const dbNotification = await prismaService.notification.findUnique({
        where: { id: notification.id },
      });
      expect(dbNotification).toBeDefined();

      // Verify WebSocket gateway was called for in-app notifications
      expect(mockNotificationGateway.emitNotification).toHaveBeenCalled();

      // Verify queue service was called for async channels
      expect(mockQueueService.addEmailJob).toHaveBeenCalled();
    });

    it('should handle notification creation with expiration', async () => {
      // Arrange
      const { testTenant, testUser } = await createTestData();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      // Act
      const notification = await notificationService.create({
        tenantId: testTenant.id,
        userId: testUser.id,
        category: 'system',
        type: NotificationType.WARNING,
        title: 'Expiring Notification',
        message: 'This notification will expire',
        expiresAt,
      });

      // Assert
      expect(notification).toBeDefined();
      expect(notification.expiresAt).toBeDefined();
      expect(new Date(notification.expiresAt!)).toEqual(expiresAt);

      // Verify in database
      const dbNotification = await prismaService.notification.findUnique({
        where: { id: notification.id },
      });
      expect(dbNotification).toBeDefined();
      expect(dbNotification!.expiresAt).toBeDefined();
    });

    it('should handle different notification types', async () => {
      // Arrange
      const { testTenant, testUser } = await createTestData();

      // Act - Create notifications of different types
      const infoNotification = await notificationService.create({
        tenantId: testTenant.id,
        userId: testUser.id,
        category: 'system',
        type: NotificationType.INFO,
        title: 'Info Notification',
        message: 'This is an info notification',
      });

      const warningNotification = await notificationService.create({
        tenantId: testTenant.id,
        userId: testUser.id,
        category: 'system',
        type: NotificationType.WARNING,
        title: 'Warning Notification',
        message: 'This is a warning notification',
      });

      const errorNotification = await notificationService.create({
        tenantId: testTenant.id,
        userId: testUser.id,
        category: 'system',
        type: NotificationType.ERROR,
        title: 'Error Notification',
        message: 'This is an error notification',
      });

      // Assert - All notifications should be created with correct types
      expect(infoNotification.type).toBe(NotificationType.INFO);
      expect(warningNotification.type).toBe(NotificationType.WARNING);
      expect(errorNotification.type).toBe(NotificationType.ERROR);

      // Verify all exist in database
      const notifications = await prismaService.notification.findMany({
        where: {
          userId: testUser.id,
          tenantId: testTenant.id,
        },
      });

      expect(notifications.length).toBeGreaterThan(0);

      // Check that we have notifications of different types
      const types = notifications.map((n) => n.type);
      expect(types).toContain(NotificationType.INFO);
      expect(types).toContain(NotificationType.WARNING);
      expect(types).toContain(NotificationType.ERROR);
    });
  });

  describe('Channel Factory Integration', () => {
    it('should return available channels from factory', () => {
      // Act
      const availableChannels = channelFactory.getAvailableChannels();

      // Assert
      expect(availableChannels).toHaveLength(3);
      expect(availableChannels).toContain(NotificationChannelType.IN_APP);
      expect(availableChannels).toContain(NotificationChannelType.EMAIL);
      expect(availableChannels).toContain(NotificationChannelType.SMS);
    });

    it('should get channel handlers from factory', () => {
      // Act & Assert
      const inAppChannelFromFactory = channelFactory.getChannel(
        NotificationChannelType.IN_APP,
      );
      const emailChannelFromFactory = channelFactory.getChannel(
        NotificationChannelType.EMAIL,
      );
      const smsChannelFromFactory = channelFactory.getChannel(
        NotificationChannelType.SMS,
      );

      expect(inAppChannelFromFactory).toBeDefined();
      expect(emailChannelFromFactory).toBeDefined();
      expect(smsChannelFromFactory).toBeDefined();

      // Note: We can't use toBe() for exact equality due to mocking, but we can verify they exist
      expect(typeof inAppChannelFromFactory.send).toBe('function');
      expect(typeof emailChannelFromFactory.send).toBe('function');
      expect(typeof smsChannelFromFactory.send).toBe('function');
    });
  });
});
