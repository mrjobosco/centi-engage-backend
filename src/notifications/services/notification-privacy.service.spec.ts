import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationPrivacyService } from './notification-privacy.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

describe('NotificationPrivacyService', () => {
  let service: NotificationPrivacyService;
  let prismaService: jest.Mocked<PrismaService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockPrismaService = {
      notification: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
      notificationAuditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockTenantContextService = {
      getTenantId: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPrivacyService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TenantContextService, useValue: mockTenantContextService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<NotificationPrivacyService>(
      NotificationPrivacyService,
    );
    prismaService = module.get(PrismaService);
    tenantContextService = module.get(TenantContextService);
    configService = module.get(ConfigService);
  });

  describe('softDeleteNotification', () => {
    const mockNotification = {
      id: 'notification-123',
      tenantId: 'tenant-123',
      userId: 'user-123',
      sensitiveData: false,
    };

    beforeEach(() => {
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
    });

    it('should soft delete a notification successfully', async () => {
      prismaService.notification.findFirst.mockResolvedValue(
        mockNotification as any,
      );
      prismaService.notification.update.mockResolvedValue(
        mockNotification as any,
      );

      await service.softDeleteNotification(
        'notification-123',
        'user-123',
        'user-123',
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notification.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'notification-123',
          userId: 'user-123',
          tenantId: 'tenant-123',
          deletedAt: null,
        },
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notification.update).toHaveBeenCalledWith({
        where: {
          id: 'notification-123',
        },
        data: {
          deletedAt: expect.any(Date),
          deletedBy: 'user-123',
        },
      });
    });

    it('should create audit log for sensitive notifications', async () => {
      const sensitiveNotification = {
        ...mockNotification,
        sensitiveData: true,
      };
      prismaService.notification.findFirst.mockResolvedValue(
        sensitiveNotification as any,
      );
      prismaService.notification.update.mockResolvedValue(
        sensitiveNotification as any,
      );
      prismaService.notificationAuditLog.create.mockResolvedValue({} as any);

      await service.softDeleteNotification(
        'notification-123',
        'user-123',
        'admin-456',
      );

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notificationAuditLog.create).toHaveBeenCalledWith({
        data: {
          notificationId: 'notification-123',
          action: 'DELETE',
          userId: 'admin-456',
          tenantId: 'tenant-123',
          metadata: {
            softDelete: true,
            originalUserId: 'user-123',
          },
        },
      });
    });

    it('should throw error when tenant context is missing', async () => {
      tenantContextService.getTenantId.mockReturnValue(null);

      await expect(
        service.softDeleteNotification(
          'notification-123',
          'user-123',
          'user-123',
        ),
      ).rejects.toThrow('Tenant context is required');
    });

    it('should throw error when notification is not found', async () => {
      prismaService.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.softDeleteNotification(
          'notification-123',
          'user-123',
          'user-123',
        ),
      ).rejects.toThrow('Notification not found or already deleted');
    });
  });

  describe('restoreNotification', () => {
    const mockDeletedNotification = {
      id: 'notification-123',
      tenantId: 'tenant-123',
      userId: 'user-123',
      sensitiveData: false,
      deletedAt: new Date(),
    };

    beforeEach(() => {
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
    });

    it('should restore a soft-deleted notification successfully', async () => {
      prismaService.notification.findFirst.mockResolvedValue(
        mockDeletedNotification as any,
      );
      prismaService.notification.update.mockResolvedValue(
        mockDeletedNotification as any,
      );

      await service.restoreNotification('notification-123', 'user-123');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notification.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'notification-123',
          userId: 'user-123',
          tenantId: 'tenant-123',
          deletedAt: { not: null },
        },
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notification.update).toHaveBeenCalledWith({
        where: {
          id: 'notification-123',
        },
        data: {
          deletedAt: null,
          deletedBy: null,
        },
      });
    });

    it('should throw error when notification is not found or not deleted', async () => {
      prismaService.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.restoreNotification('notification-123', 'user-123'),
      ).rejects.toThrow('Notification not found or not deleted');
    });
  });

  describe('createAuditLog', () => {
    beforeEach(() => {
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
    });

    it('should create audit log successfully', async () => {
      prismaService.notificationAuditLog.create.mockResolvedValue({} as any);

      await service.createAuditLog({
        notificationId: 'notification-123',
        action: 'READ',
        userId: 'user-123',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        metadata: { test: 'data' },
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notificationAuditLog.create).toHaveBeenCalledWith({
        data: {
          notificationId: 'notification-123',
          action: 'READ',
          userId: 'user-123',
          tenantId: 'tenant-123',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
          metadata: { test: 'data' },
        },
      });
    });

    it('should not throw error when audit log creation fails', async () => {
      prismaService.notificationAuditLog.create.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw error
      await expect(
        service.createAuditLog({
          notificationId: 'notification-123',
          action: 'READ',
          userId: 'user-123',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('markAsSensitive', () => {
    beforeEach(() => {
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
    });

    it('should mark notification as sensitive', async () => {
      prismaService.notification.update.mockResolvedValue({} as any);

      await service.markAsSensitive('notification-123');

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notification.update).toHaveBeenCalledWith({
        where: {
          id: 'notification-123',
          tenantId: 'tenant-123',
        },
        data: {
          sensitiveData: true,
        },
      });
    });
  });

  describe('enforceRetentionPolicy', () => {
    beforeEach(() => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === 'NOTIFICATION_RETENTION_DAYS') return 90;
          return defaultValue;
        },
      );
    });

    it('should delete expired notifications based on retention policy', async () => {
      const expiredNotifications = [
        {
          id: 'notification-1',
          tenantId: 'tenant-123',
          userId: 'user-123',
          sensitiveData: false,
        },
        {
          id: 'notification-2',
          tenantId: 'tenant-123',
          userId: 'user-456',
          sensitiveData: true,
        },
      ];

      prismaService.notification.findMany.mockResolvedValue(
        expiredNotifications as any,
      );
      prismaService.notification.delete.mockResolvedValue({} as any);
      prismaService.notificationAuditLog.create.mockResolvedValue({} as any);

      await service.enforceRetentionPolicy();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notification.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              retentionDate: {
                lte: expect.any(Date),
              },
            },
            {
              retentionDate: null,
              createdAt: {
                lte: expect.any(Date),
              },
            },
          ],
          deletedAt: null,
        },
        select: {
          id: true,
          tenantId: true,
          userId: true,
          sensitiveData: true,
        },
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notification.delete).toHaveBeenCalledTimes(2);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notificationAuditLog.create).toHaveBeenCalledTimes(
        1,
      ); // Only for sensitive data
    });
  });

  describe('getNotificationsWithPrivacyFilters', () => {
    beforeEach(() => {
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
    });

    it('should get notifications with privacy filters applied', async () => {
      const mockNotifications = [
        {
          id: 'notification-1',
          type: 'INFO',
          category: 'system',
          title: 'Test',
          message: 'Test message',
          data: null,
          channelsSent: ['in-app'],
          readAt: null,
          createdAt: new Date(),
          expiresAt: null,
          deletedAt: null,
          sensitiveData: false,
          retentionDate: null,
        },
      ];

      prismaService.notification.findMany.mockResolvedValue(
        mockNotifications as any,
      );
      prismaService.notification.count.mockResolvedValue(1);

      const result = await service.getNotificationsWithPrivacyFilters(
        'user-123',
        {
          page: 1,
          limit: 20,
          includeDeleted: false,
          onlySensitive: false,
        },
      );

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          tenantId: 'tenant-123',
          deletedAt: null,
          OR: [
            { retentionDate: null },
            { retentionDate: { gt: expect.any(Date) } },
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });
    });
  });
});
