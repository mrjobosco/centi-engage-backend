/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationChannelFactory } from '../factories/notification-channel.factory';
import { MetricsService } from './metrics.service';
import { NotificationLoggerService } from './notification-logger.service';
import { INotificationChannel } from '../interfaces/notification-channel.interface';
import { NotificationPayload } from '../interfaces/notification-payload.interface';

import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';

describe('NotificationService', () => {
  let service: NotificationService;
  let prismaService: any;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let preferenceService: jest.Mocked<NotificationPreferenceService>;
  let channelFactory: jest.Mocked<NotificationChannelFactory>;

  // Mock channel implementations
  const mockInAppChannel: jest.Mocked<INotificationChannel> = {
    send: jest.fn(),
    validate: jest.fn(),
    getChannelType: jest.fn(),
    isAvailable: jest.fn(),
  };

  const mockEmailChannel: jest.Mocked<INotificationChannel> = {
    send: jest.fn(),
    validate: jest.fn(),
    getChannelType: jest.fn(),
    isAvailable: jest.fn(),
  };

  const mockSmsChannel: jest.Mocked<INotificationChannel> = {
    send: jest.fn(),
    validate: jest.fn(),
    getChannelType: jest.fn(),
    isAvailable: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create: jest.fn(),
              update: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              updateMany: jest.fn(),
              count: jest.fn(),
              delete: jest.fn(),
            },
            user: {
              findMany: jest.fn(),
            },
          } as any,
        },
        {
          provide: TenantContextService,
          useValue: {
            getTenantId: jest.fn(),
          },
        },
        {
          provide: NotificationPreferenceService,
          useValue: {
            getEnabledChannels: jest.fn(),
          },
        },
        {
          provide: NotificationChannelFactory,
          useValue: {
            isChannelRegistered: jest.fn(),
            getChannel: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            startTimer: jest.fn().mockReturnValue(jest.fn()),
            recordDelivery: jest.fn(),
            recordFailure: jest.fn(),
          },
        },
        {
          provide: NotificationLoggerService,
          useValue: {
            logNotificationCreated: jest.fn(),
            logDeliveryAttempt: jest.fn(),
            logDeliverySuccess: jest.fn(),
            logDeliveryFailure: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prismaService = module.get(PrismaService);
    tenantContextService = module.get(TenantContextService);
    preferenceService = module.get(NotificationPreferenceService);
    channelFactory = module.get(NotificationChannelFactory);

    // Setup default mock returns
    tenantContextService.getTenantId.mockReturnValue('tenant-1');
    mockInAppChannel.getChannelType.mockReturnValue(
      NotificationChannelType.IN_APP,
    );
    mockEmailChannel.getChannelType.mockReturnValue(
      NotificationChannelType.EMAIL,
    );
    mockSmsChannel.getChannelType.mockReturnValue(NotificationChannelType.SMS);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockPayload: NotificationPayload = {
      tenantId: 'tenant-1',
      userId: 'user-1',
      category: 'test',
      type: NotificationType.INFO,
      title: 'Test Notification',
      message: 'Test message',
      priority: NotificationPriority.MEDIUM,
    };

    const mockNotification = {
      id: 'notification-1',
      ...mockPayload,
      channelsSent: [],
      readAt: null,
      createdAt: new Date(),
      expiresAt: null,
      data: null,
    };

    it('should create notification successfully with all channels', async () => {
      // Arrange
      preferenceService.getEnabledChannels.mockResolvedValue([
        NotificationChannelType.IN_APP,
        NotificationChannelType.EMAIL,
      ]);

      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        channelsSent: [
          NotificationChannelType.IN_APP,
          NotificationChannelType.EMAIL,
        ],
      });

      channelFactory.isChannelRegistered.mockReturnValue(true);
      channelFactory.getChannel
        .mockReturnValueOnce(mockInAppChannel)
        .mockReturnValueOnce(mockEmailChannel);

      mockInAppChannel.isAvailable.mockResolvedValue(true);
      mockInAppChannel.validate.mockReturnValue(true);
      mockInAppChannel.send.mockResolvedValue({
        success: true,
        channel: NotificationChannelType.IN_APP,
        messageId: 'in-app-1',
      });

      mockEmailChannel.isAvailable.mockResolvedValue(true);
      mockEmailChannel.validate.mockReturnValue(true);
      mockEmailChannel.send.mockResolvedValue({
        success: true,
        channel: NotificationChannelType.EMAIL,
        messageId: 'email-1',
      });

      // Act
      const result = await service.create(mockPayload);

      // Assert
      expect(result.channelsSent).toEqual([
        NotificationChannelType.IN_APP,
        NotificationChannelType.EMAIL,
      ]);
      expect(preferenceService.getEnabledChannels).toHaveBeenCalledWith(
        'user-1',
        'test',
      );
      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          userId: 'user-1',
          type: NotificationType.INFO,
          category: 'test',
          title: 'Test Notification',
          message: 'Test message',
          data: undefined,
          channelsSent: [],
          expiresAt: null,
        },
      });
      expect(mockInAppChannel.send).toHaveBeenCalledWith(mockPayload);
      expect(mockEmailChannel.send).toHaveBeenCalledWith(mockPayload);
    });

    it('should handle partial failures gracefully', async () => {
      // Arrange
      preferenceService.getEnabledChannels.mockResolvedValue([
        NotificationChannelType.IN_APP,
        NotificationChannelType.EMAIL,
      ]);

      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        channelsSent: [NotificationChannelType.IN_APP],
      });

      channelFactory.isChannelRegistered.mockReturnValue(true);
      channelFactory.getChannel
        .mockReturnValueOnce(mockInAppChannel)
        .mockReturnValueOnce(mockEmailChannel);

      mockInAppChannel.isAvailable.mockResolvedValue(true);
      mockInAppChannel.validate.mockReturnValue(true);
      mockInAppChannel.send.mockResolvedValue({
        success: true,
        channel: NotificationChannelType.IN_APP,
        messageId: 'in-app-1',
      });

      mockEmailChannel.isAvailable.mockResolvedValue(true);
      mockEmailChannel.validate.mockReturnValue(true);
      mockEmailChannel.send.mockResolvedValue({
        success: false,
        channel: NotificationChannelType.EMAIL,
        error: 'Email service unavailable',
      });

      // Act
      const result = await service.create(mockPayload);

      // Assert
      expect(result.channelsSent).toEqual([NotificationChannelType.IN_APP]);
      expect(mockInAppChannel.send).toHaveBeenCalled();
      expect(mockEmailChannel.send).toHaveBeenCalled();
    });

    it('should skip unregistered channels', async () => {
      // Arrange
      preferenceService.getEnabledChannels.mockResolvedValue([
        NotificationChannelType.IN_APP,
        NotificationChannelType.SMS,
      ]);

      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        channelsSent: [NotificationChannelType.IN_APP],
      });

      channelFactory.isChannelRegistered
        .mockReturnValueOnce(true) // IN_APP
        .mockReturnValueOnce(false); // SMS

      channelFactory.getChannel.mockReturnValueOnce(mockInAppChannel);

      mockInAppChannel.isAvailable.mockResolvedValue(true);
      mockInAppChannel.validate.mockReturnValue(true);
      mockInAppChannel.send.mockResolvedValue({
        success: true,
        channel: NotificationChannelType.IN_APP,
        messageId: 'in-app-1',
      });

      // Act
      const result = await service.create(mockPayload);

      // Assert
      expect(result.channelsSent).toEqual([NotificationChannelType.IN_APP]);
      expect(channelFactory.getChannel).toHaveBeenCalledTimes(1);
      expect(mockInAppChannel.send).toHaveBeenCalled();
    });

    it('should skip unavailable channels', async () => {
      // Arrange
      preferenceService.getEnabledChannels.mockResolvedValue([
        NotificationChannelType.EMAIL,
      ]);

      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        channelsSent: [],
      });

      channelFactory.isChannelRegistered.mockReturnValue(true);
      channelFactory.getChannel.mockReturnValue(mockEmailChannel);

      mockEmailChannel.isAvailable.mockResolvedValue(false);

      // Act
      const result = await service.create(mockPayload);

      // Assert
      expect(result.channelsSent).toEqual([]);
      expect(mockEmailChannel.send).not.toHaveBeenCalled();
    });

    it('should skip channels with invalid payload', async () => {
      // Arrange
      preferenceService.getEnabledChannels.mockResolvedValue([
        NotificationChannelType.EMAIL,
      ]);

      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        channelsSent: [],
      });

      channelFactory.isChannelRegistered.mockReturnValue(true);
      channelFactory.getChannel.mockReturnValue(mockEmailChannel);

      mockEmailChannel.isAvailable.mockResolvedValue(true);
      mockEmailChannel.validate.mockReturnValue(false);

      // Act
      const result = await service.create(mockPayload);

      // Assert
      expect(result.channelsSent).toEqual([]);
      expect(mockEmailChannel.send).not.toHaveBeenCalled();
    });

    it('should throw error when tenant context is missing', async () => {
      // Arrange
      tenantContextService.getTenantId.mockReturnValue(undefined);

      // Act & Assert
      await expect(service.create(mockPayload)).rejects.toThrow(
        'Tenant context is required',
      );
    });
  });

  describe('sendToUser', () => {
    it('should send notification to specific user with defaults', async () => {
      // Arrange
      const partialPayload = {
        title: 'User Notification',
        message: 'Hello user',
        category: 'user_activity',
      };

      preferenceService.getEnabledChannels.mockResolvedValue([
        NotificationChannelType.IN_APP,
      ]);

      const mockNotification = {
        id: 'notification-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        type: NotificationType.INFO,
        category: 'user_activity',
        title: 'User Notification',
        message: 'Hello user',
        channelsSent: [NotificationChannelType.IN_APP],
        readAt: null,
        createdAt: new Date(),
        expiresAt: null,
        data: null,
      };

      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notification.update.mockResolvedValue(mockNotification);

      channelFactory.isChannelRegistered.mockReturnValue(true);
      channelFactory.getChannel.mockReturnValue(mockInAppChannel);

      mockInAppChannel.isAvailable.mockResolvedValue(true);
      mockInAppChannel.validate.mockReturnValue(true);
      mockInAppChannel.send.mockResolvedValue({
        success: true,
        channel: NotificationChannelType.IN_APP,
        messageId: 'in-app-1',
      });

      // Act
      const result = await service.sendToUser('user-1', partialPayload);

      // Assert
      expect(result).toEqual(mockNotification);
      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          userId: 'user-1',
          type: NotificationType.INFO,
          category: 'user_activity',
          title: 'User Notification',
          message: 'Hello user',
          channelsSent: [],
          data: undefined,
          expiresAt: null,
        }),
      });
    });
  });

  describe('sendToTenant', () => {
    it('should send notification to all users in tenant', async () => {
      // Arrange
      const partialPayload = {
        title: 'Tenant Notification',
        message: 'Hello everyone',
        category: 'system',
      };

      const mockUsers = [{ id: 'user-1' }, { id: 'user-2' }];

      prismaService.user.findMany.mockResolvedValue(mockUsers);

      preferenceService.getEnabledChannels.mockResolvedValue([
        NotificationChannelType.IN_APP,
      ]);

      const mockNotification1 = {
        id: 'notification-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        type: NotificationType.INFO,
        category: 'system',
        title: 'Tenant Notification',
        message: 'Hello everyone',
        channelsSent: [NotificationChannelType.IN_APP],
        readAt: null,
        createdAt: new Date(),
        expiresAt: null,
        data: null,
      };

      const mockNotification2 = {
        ...mockNotification1,
        id: 'notification-2',
        userId: 'user-2',
      };

      prismaService.notification.create
        .mockResolvedValueOnce(mockNotification1)
        .mockResolvedValueOnce(mockNotification2);

      prismaService.notification.update
        .mockResolvedValueOnce(mockNotification1)
        .mockResolvedValueOnce(mockNotification2);

      channelFactory.isChannelRegistered.mockReturnValue(true);
      channelFactory.getChannel.mockReturnValue(mockInAppChannel);

      mockInAppChannel.isAvailable.mockResolvedValue(true);
      mockInAppChannel.validate.mockReturnValue(true);
      mockInAppChannel.send.mockResolvedValue({
        success: true,
        channel: NotificationChannelType.IN_APP,
        messageId: 'in-app-1',
      });

      // Act
      const result = await service.sendToTenant(partialPayload);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user-1');
      expect(result[1].userId).toBe('user-2');
      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        select: { id: true },
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      // Arrange
      const mockNotification = {
        id: 'notification-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        readAt: null,
      };

      prismaService.notification.findFirst.mockResolvedValue(mockNotification);
      prismaService.notification.update.mockResolvedValue({
        ...mockNotification,
        readAt: new Date(),
      });

      // Act
      await service.markAsRead('notification-1', 'user-1');

      // Assert
      expect(prismaService.notification.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'notification-1',
          userId: 'user-1',
          tenantId: 'tenant-1',
        },
      });
      expect(prismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notification-1' },
        data: { readAt: expect.any(Date) },
      });
    });

    it('should throw error if notification not found', async () => {
      // Arrange
      prismaService.notification.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.markAsRead('notification-1', 'user-1'),
      ).rejects.toThrow('Notification not found or access denied');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      // Arrange
      prismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      // Act
      await service.markAllAsRead('user-1');

      // Assert
      expect(prismaService.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          tenantId: 'tenant-1',
          readAt: null,
        },
        data: {
          readAt: expect.any(Date),
        },
      });
    });
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications with filters', async () => {
      // Arrange
      const mockNotifications = [
        {
          id: 'notification-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          type: NotificationType.INFO,
          category: 'test',
          title: 'Test 1',
          message: 'Message 1',
          readAt: null,
          createdAt: new Date(),
        },
      ];

      prismaService.notification.count.mockResolvedValue(10);
      prismaService.notification.findMany.mockResolvedValue(mockNotifications);

      const filters = {
        page: 1,
        limit: 20,
        type: NotificationType.INFO,
        category: 'test',
        unread: true,
      };

      // Act
      const result = await service.getUserNotifications('user-1', filters);

      // Assert
      expect(result).toEqual({
        notifications: mockNotifications,
        total: 10,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      expect(prismaService.notification.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-1',
          tenantId: 'tenant-1',
          type: NotificationType.INFO,
          category: 'test',
          readAt: null,
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should handle search filter', async () => {
      // Arrange
      prismaService.notification.count.mockResolvedValue(1);
      prismaService.notification.findMany.mockResolvedValue([]);

      // Act
      await service.getUserNotifications('user-1', { search: 'test' });

      // Assert
      expect(prismaService.notification.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-1',
          tenantId: 'tenant-1',
          AND: expect.arrayContaining([
            {
              OR: [
                { title: { contains: 'test', mode: 'insensitive' } },
                { message: { contains: 'test', mode: 'insensitive' } },
              ],
            },
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: expect.any(Date) } },
              ],
            },
          ]),
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      // Arrange
      prismaService.notification.count.mockResolvedValue(5);

      // Act
      const result = await service.getUnreadCount('user-1');

      // Assert
      expect(result).toBe(5);
      expect(prismaService.notification.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          tenantId: 'tenant-1',
          readAt: null,
          deletedAt: null,
          AND: [
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: expect.any(Date) } },
              ],
            },
            {
              OR: [
                { retentionDate: null },
                { retentionDate: { gt: expect.any(Date) } },
              ],
            },
          ],
        },
      });
    });
  });

  describe('deleteNotification', () => {
    it('should throw error directing to use privacy service', () => {
      // Act & Assert
      expect(() =>
        service.deleteNotification('notification-1', 'user-1'),
      ).toThrow(
        'Use NotificationPrivacyService.softDeleteNotification instead',
      );
    });

    it('should throw error for any notification ID since method is deprecated', () => {
      // This test verifies the method always throws regardless of input
      expect(() => service.deleteNotification('nonexistent', 'user-1')).toThrow(
        'Use NotificationPrivacyService.softDeleteNotification instead',
      );
    });
  });
});

describe('tenant isolation', () => {
  let isolationService: NotificationService;
  let isolationTenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: {
            notification: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            getTenantId: jest.fn(),
          },
        },
        {
          provide: NotificationPreferenceService,
          useValue: {
            getUserPreferences: jest.fn(),
          },
        },
        {
          provide: NotificationChannelFactory,
          useValue: {
            createChannel: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            incrementCounter: jest.fn(),
            recordHistogram: jest.fn(),
            startTimer: jest.fn().mockReturnValue(jest.fn()),
            recordFailure: jest.fn(),
          },
        },
        {
          provide: NotificationLoggerService,
          useValue: {
            logNotificationSent: jest.fn(),
            logNotificationFailed: jest.fn(),
          },
        },
      ],
    }).compile();

    isolationService = module.get<NotificationService>(NotificationService);
    isolationTenantContextService = module.get(TenantContextService);
  });

  it('should enforce tenant context in all methods', async () => {
    // Arrange
    isolationTenantContextService.getTenantId.mockReturnValue(undefined);

    // Act & Assert
    await expect(
      isolationService.create({} as NotificationPayload),
    ).rejects.toThrow('Tenant context is required');
    await expect(isolationService.sendToUser('user-1', {})).rejects.toThrow(
      'Tenant context is required',
    );
    await expect(isolationService.sendToTenant({})).rejects.toThrow(
      'Tenant context is required',
    );
    await expect(
      isolationService.markAsRead('notification-1', 'user-1'),
    ).rejects.toThrow('Tenant context is required');
    await expect(isolationService.markAllAsRead('user-1')).rejects.toThrow(
      'Tenant context is required',
    );
    await expect(
      isolationService.getUserNotifications('user-1'),
    ).rejects.toThrow('Tenant context is required');
    await expect(isolationService.getUnreadCount('user-1')).rejects.toThrow(
      'Tenant context is required',
    );
    expect(() =>
      isolationService.deleteNotification('notification-1', 'user-1'),
    ).toThrow('Use NotificationPrivacyService.softDeleteNotification instead');
  });
});
