/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { InAppChannelService } from './in-app-channel.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { NotificationGateway } from '../gateways/notification.gateway';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationPayload } from '../interfaces/notification-payload.interface';

describe('InAppChannelService', () => {
  let service: InAppChannelService;
  let prismaService: jest.Mocked<PrismaService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let notificationGateway: jest.Mocked<NotificationGateway>;

  const mockNotificationPayload: NotificationPayload = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    category: 'test',
    type: NotificationType.INFO,
    title: 'Test Notification',
    message: 'This is a test notification',
    data: { key: 'value' },
  };

  const mockNotification = {
    id: 'notification-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    type: NotificationType.INFO,
    category: 'test',
    title: 'Test Notification',
    message: 'This is a test notification',
    data: { key: 'value' },
    channelsSent: [NotificationChannelType.IN_APP],
    readAt: null,
    createdAt: new Date(),
    expiresAt: null,
  };

  const mockDeliveryLog = {
    id: 'delivery-log-1',
    notificationId: 'notification-1',
    channel: NotificationChannelType.IN_APP,
    status: 'SENT' as const,
    provider: null,
    providerMessageId: null,
    errorMessage: null,
    sentAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      notification: {
        create: jest.fn(),
        count: jest.fn(),
      },
      notificationDeliveryLog: {
        create: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const mockTenantContextService = {
      setTenantId: jest.fn(),
      getTenantId: jest.fn(),
      getRequiredTenantId: jest.fn(),
      hasTenantContext: jest.fn(),
    };

    const mockNotificationGateway = {
      emitNotification: jest.fn(),
      emitUnreadCount: jest.fn(),
      emitToTenant: jest.fn(),
      isUserConnected: jest.fn(),
      getTenantConnectionCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InAppChannelService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContextService,
        },
        {
          provide: NotificationGateway,
          useValue: mockNotificationGateway,
        },
      ],
    }).compile();

    service = module.get<InAppChannelService>(InAppChannelService);
    prismaService = module.get(PrismaService);
    tenantContextService = module.get(TenantContextService);
    notificationGateway = module.get(NotificationGateway);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getChannelType', () => {
    it('should return IN_APP channel type', () => {
      expect(service.getChannelType()).toBe(NotificationChannelType.IN_APP);
    });
  });

  describe('send', () => {
    it('should successfully send in-app notification', async () => {
      (prismaService.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );
      (
        prismaService.notificationDeliveryLog.create as jest.Mock
      ).mockResolvedValue(mockDeliveryLog);
      (prismaService.notification.count as jest.Mock).mockResolvedValue(3);

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannelType.IN_APP);
      expect(result.messageId).toBe('notification-1');
      expect(result.deliveryLogId).toBe('delivery-log-1');
      expect(result.error).toBeUndefined();

      expect(tenantContextService.setTenantId).toHaveBeenCalledWith('tenant-1');
      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          userId: 'user-1',
          type: NotificationType.INFO,
          category: 'test',
          title: 'Test Notification',
          message: 'This is a test notification',
          data: { key: 'value' },
          channelsSent: [NotificationChannelType.IN_APP],
          expiresAt: null,
        },
      });
      expect(prismaService.notificationDeliveryLog.create).toHaveBeenCalledWith(
        {
          data: {
            notificationId: 'notification-1',
            channel: NotificationChannelType.IN_APP,
            status: 'SENT',
            sentAt: expect.any(Date),
          },
        },
      );

      // Verify WebSocket integration
      expect(notificationGateway.emitNotification).toHaveBeenCalledWith(
        'user-1',
        {
          id: 'notification-1',
          type: NotificationType.INFO,
          category: 'test',
          title: 'Test Notification',
          message: 'This is a test notification',
          data: { key: 'value' },
          createdAt: expect.any(Date),
          expiresAt: null,
        },
      );
      expect(notificationGateway.emitUnreadCount).toHaveBeenCalledWith(
        'user-1',
        3,
      );
    });

    it('should handle notification creation failure', async () => {
      const error = new Error('Database error');
      (prismaService.notification.create as jest.Mock).mockRejectedValue(error);

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.IN_APP);
      expect(result.error).toBe('Database error');
      expect(result.messageId).toBeUndefined();
      expect(result.deliveryLogId).toBeUndefined();
      expect(notificationGateway.emitNotification).not.toHaveBeenCalled();
    });

    it('should handle invalid payload', async () => {
      const invalidPayload = { ...mockNotificationPayload, title: '' };

      const result = await service.send(invalidPayload);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.IN_APP);
      expect(result.error).toBe('Invalid notification payload');
      expect(prismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should handle delivery log creation failure', async () => {
      (prismaService.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );
      (
        prismaService.notificationDeliveryLog.create as jest.Mock
      ).mockRejectedValue(new Error('Log creation failed'));

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.IN_APP);
      expect(result.error).toBe('Log creation failed');
      expect(notificationGateway.emitNotification).not.toHaveBeenCalled();
    });

    it('should handle notification with expiry date', async () => {
      const futureDate = new Date(Date.now() + 86400000); // 24 hours from now
      const payloadWithExpiry = {
        ...mockNotificationPayload,
        expiresAt: futureDate,
      };
      const notificationWithExpiry = {
        ...mockNotification,
        expiresAt: futureDate,
      };

      (prismaService.notification.create as jest.Mock).mockResolvedValue(
        notificationWithExpiry,
      );
      (
        prismaService.notificationDeliveryLog.create as jest.Mock
      ).mockResolvedValue(mockDeliveryLog);
      (prismaService.notification.count as jest.Mock).mockResolvedValue(1);

      const result = await service.send(payloadWithExpiry);

      expect(result.success).toBe(true);
      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: futureDate,
        }),
      });
      expect(notificationGateway.emitNotification).toHaveBeenCalled();
      expect(notificationGateway.emitUnreadCount).toHaveBeenCalledWith(
        'user-1',
        1,
      );
    });

    it('should handle WebSocket emission failure gracefully', async () => {
      (prismaService.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );
      (
        prismaService.notificationDeliveryLog.create as jest.Mock
      ).mockResolvedValue(mockDeliveryLog);
      (prismaService.notification.count as jest.Mock).mockResolvedValue(2);
      notificationGateway.emitNotification.mockImplementation(() => {
        throw new Error('WebSocket error');
      });

      const result = await service.send(mockNotificationPayload);

      // Should still succeed even if WebSocket fails
      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannelType.IN_APP);
      expect(result.messageId).toBe('notification-1');
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

    it('should reject payload with missing required fields', () => {
      const invalidPayload = { ...mockNotificationPayload, title: '' };
      expect(service.validate(invalidPayload)).toBe(false);
    });
  });

  describe('isAvailable', () => {
    it('should return true when database is available', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.isAvailable();

      expect(result).toBe(true);
      expect(prismaService.$queryRaw).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should return false when database is not available', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await service.isAvailable();

      expect(result).toBe(false);
    });
  });
});
