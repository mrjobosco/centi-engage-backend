/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { EmailChannelService } from './email-channel.service';
import { QueueService } from '../services/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { NotificationPayload } from '../interfaces/notification-payload.interface';

describe('EmailChannelService', () => {
  let service: EmailChannelService;
  let queueService: jest.Mocked<QueueService>;
  let prismaService: jest.Mocked<
    Pick<
      PrismaService,
      'user' | 'notification' | 'notificationDeliveryLog' | '$queryRaw'
    >
  >;

  const mockNotificationPayload: NotificationPayload = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    category: 'test',
    type: NotificationType.INFO,
    title: 'Test Email Notification',
    message: 'This is a test email notification',
    priority: NotificationPriority.MEDIUM,
    templateId: 'welcome-template',
    templateVariables: { name: 'John Doe' },
  };

  const mockUser = {
    email: 'user@example.com',
  };

  const mockNotification = {
    id: 'notification-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    type: NotificationType.INFO,
    category: 'test',
    title: 'Test Email Notification',
    message: 'This is a test email notification',
    data: null,
    channelsSent: [NotificationChannelType.EMAIL],
    readAt: null,
    createdAt: new Date(),
    expiresAt: null,
  };

  const mockDeliveryLog = {
    id: 'delivery-log-1',
    notificationId: 'notification-1',
    channel: NotificationChannelType.EMAIL,
    status: 'PENDING' as const,
    provider: null,
    providerMessageId: null,
    errorMessage: null,
    sentAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockQueueService = {
      addEmailJob: jest.fn(),
      getEmailQueueStats: jest.fn(),
    };

    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      notificationDeliveryLog: {
        create: jest.fn(),
      },
      $queryRaw: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailChannelService,
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EmailChannelService>(EmailChannelService);
    queueService = module.get(QueueService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getChannelType', () => {
    it('should return EMAIL channel type', () => {
      expect(service.getChannelType()).toBe(NotificationChannelType.EMAIL);
    });
  });

  describe('send', () => {
    it('should successfully queue email notification', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog,
      );
      queueService.addEmailJob.mockResolvedValue();

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannelType.EMAIL);
      expect(result.messageId).toBe('notification-1');
      expect(result.deliveryLogId).toBe('delivery-log-1');
      expect(result.error).toBeUndefined();

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          tenantId: 'tenant-1',
        },
        select: {
          email: true,
        },
      });

      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          userId: 'user-1',
          type: NotificationType.INFO,
          category: 'test',
          title: 'Test Email Notification',
          message: 'This is a test email notification',
          data: undefined,
          channelsSent: [NotificationChannelType.EMAIL],
          expiresAt: null,
        },
      });

      expect(prismaService.notificationDeliveryLog.create).toHaveBeenCalledWith(
        {
          data: {
            notificationId: 'notification-1',
            channel: NotificationChannelType.EMAIL,
            status: 'PENDING',
          },
        },
      );

      expect(queueService.addEmailJob).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        notificationId: 'notification-1',
        category: 'test',
        priority: NotificationPriority.MEDIUM,
        to: 'user@example.com',
        subject: 'Test Email Notification',
        message: 'This is a test email notification',
        templateId: 'welcome-template',
        templateVariables: { name: 'John Doe' },
      });
    });

    it('should handle user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.EMAIL);
      expect(result.error).toBe('User not found');
      expect(prismaService.notification.create).not.toHaveBeenCalled();
      expect(queueService.addEmailJob).not.toHaveBeenCalled();
    });

    it('should handle notification creation failure', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.notification.create.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.EMAIL);
      expect(result.error).toBe('Database error');
      expect(queueService.addEmailJob).not.toHaveBeenCalled();
    });

    it('should handle queue job failure', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog,
      );
      queueService.addEmailJob.mockRejectedValue(new Error('Queue error'));

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.EMAIL);
      expect(result.error).toBe('Queue error');
    });

    it('should handle invalid payload', async () => {
      const invalidPayload = { ...mockNotificationPayload, title: '' };

      const result = await service.send(invalidPayload);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.EMAIL);
      expect(result.error).toBe('Invalid notification payload');
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should use default priority when not specified', async () => {
      const payloadWithoutPriority = { ...mockNotificationPayload };
      delete payloadWithoutPriority.priority;

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog,
      );
      queueService.addEmailJob.mockResolvedValue();

      await service.send(payloadWithoutPriority);

      expect(queueService.addEmailJob).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: NotificationPriority.MEDIUM,
        }),
      );
    });

    it('should handle notification without template', async () => {
      const payloadWithoutTemplate = {
        ...mockNotificationPayload,
        templateId: undefined,
        templateVariables: undefined,
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog,
      );
      queueService.addEmailJob.mockResolvedValue();

      const result = await service.send(payloadWithoutTemplate);

      expect(result.success).toBe(true);
      expect(queueService.addEmailJob).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: undefined,
          templateVariables: undefined,
        }),
      );
    });
  });

  describe('validate', () => {
    it('should validate correct payload', () => {
      expect(service.validate(mockNotificationPayload)).toBe(true);
    });

    it('should reject payload with past expiry date', () => {
      const pastDate = new Date(Date.now() - 86400000); // 24 hours ago
      const payloadWithPastExpiry = {
        ...mockNotificationPayload,
        expiresAt: pastDate,
      };

      expect(service.validate(payloadWithPastExpiry)).toBe(false);
    });

    it('should accept payload with future expiry date', () => {
      const futureDate = new Date(Date.now() + 86400000); // 24 hours from now
      const payloadWithFutureExpiry = {
        ...mockNotificationPayload,
        expiresAt: futureDate,
      };

      expect(service.validate(payloadWithFutureExpiry)).toBe(true);
    });

    it('should reject payload with invalid template variables', () => {
      const payloadWithInvalidVariables = {
        ...mockNotificationPayload,
        templateVariables: ['invalid', 'array'] as any,
      };

      expect(service.validate(payloadWithInvalidVariables)).toBe(false);
    });

    it('should accept payload with valid template variables', () => {
      const payloadWithValidVariables = {
        ...mockNotificationPayload,
        templateVariables: { name: 'John', age: 30 },
      };

      expect(service.validate(payloadWithValidVariables)).toBe(true);
    });

    it('should reject payload with missing required fields', () => {
      const invalidPayload = { ...mockNotificationPayload, message: '' };
      expect(service.validate(invalidPayload)).toBe(false);
    });
  });

  describe('isAvailable', () => {
    it('should return true when database and queue are available', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      queueService.getEmailQueueStats.mockResolvedValue({
        waiting: [],
        active: [],
        completed: [],
        failed: [],
      });

      const result = await service.isAvailable();

      expect(result).toBe(true);
      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(queueService.getEmailQueueStats).toHaveBeenCalled();
    });

    it('should return false when database is not available', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await service.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false when queue is not available', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      queueService.getEmailQueueStats.mockRejectedValue(
        new Error('Queue not available'),
      );

      const result = await service.isAvailable();

      expect(result).toBe(false);
    });
  });
});
