/* eslint-disable @typescript-eslint/unbound-method */
import { NotificationsController } from './notifications.controller';
import { NotificationService } from '../services/notification.service';
import { NotificationPrivacyService } from '../services/notification-privacy.service';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationFilterDto } from '../dto/notification-filter.dto';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationService: jest.Mocked<NotificationService>;
  let privacyService: jest.Mocked<NotificationPrivacyService>;

  const mockUser: RequestUser = {
    id: 'user-123',
    email: 'test@example.com',
    tenantId: 'tenant-123',
    firstName: 'John',
    lastName: 'Doe',
    roles: [],
  };

  const mockNotification = {
    id: 'notification-123',
    tenantId: 'tenant-123',
    userId: 'user-123',
    type: NotificationType.INFO,
    category: 'system',
    title: 'Test Notification',
    message: 'This is a test notification',
    data: null,
    channelsSent: ['in-app'],
    readAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    expiresAt: null,
  };

  const mockPaginatedResult = {
    notifications: [mockNotification],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  beforeEach(() => {
    notificationService = {
      getUserNotifications: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      deleteNotification: jest.fn(),
      create: jest.fn(),
      sendToUser: jest.fn(),
      sendToTenant: jest.fn(),
    } as unknown as jest.Mocked<NotificationService>;

    privacyService = {
      softDeleteNotification: jest.fn(),
      hardDeleteNotification: jest.fn(),
      anonymizeNotification: jest.fn(),
      cleanupExpiredNotifications: jest.fn(),
      getRetentionPolicy: jest.fn(),
    } as unknown as jest.Mocked<NotificationPrivacyService>;

    controller = new NotificationsController(
      notificationService,
      privacyService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserNotifications', () => {
    it('should return paginated notifications for user', async () => {
      const filters: NotificationFilterDto = {
        page: 1,
        limit: 20,
        type: NotificationType.INFO,
      };

      notificationService.getUserNotifications.mockResolvedValue(
        mockPaginatedResult,
      );

      const result = await controller.getUserNotifications(mockUser, filters);

      expect(result).toEqual(mockPaginatedResult);
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(
        mockUser.id,
        filters,
      );
    });

    it('should handle empty filters', async () => {
      const filters: NotificationFilterDto = {};
      notificationService.getUserNotifications.mockResolvedValue(
        mockPaginatedResult,
      );

      const result = await controller.getUserNotifications(mockUser, filters);

      expect(result).toEqual(mockPaginatedResult);
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(
        mockUser.id,
        filters,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const expectedCount = 5;
      notificationService.getUnreadCount.mockResolvedValue(expectedCount);

      const result = await controller.getUnreadCount(mockUser);

      expect(result).toEqual({ count: expectedCount });
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should return zero when no unread notifications', async () => {
      notificationService.getUnreadCount.mockResolvedValue(0);

      const result = await controller.getUnreadCount(mockUser);

      expect(result).toEqual({ count: 0 });
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('getNotification', () => {
    it('should return specific notification when found', async () => {
      const notificationId = 'notification-123';
      notificationService.getUserNotifications.mockResolvedValue(
        mockPaginatedResult,
      );

      const result = await controller.getNotification(mockUser, notificationId);

      expect(result).toEqual(mockNotification);
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(
        mockUser.id,
        { page: 1, limit: 1 },
      );
    });

    it('should throw error when notification not found', async () => {
      const notificationId = 'non-existent-id';
      notificationService.getUserNotifications.mockResolvedValue({
        notifications: [],
        total: 0,
        page: 1,
        limit: 1,
        totalPages: 0,
      });

      await expect(
        controller.getNotification(mockUser, notificationId),
      ).rejects.toThrow('Notification not found or access denied');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read successfully', async () => {
      const notificationId = 'notification-123';
      notificationService.markAsRead.mockResolvedValue(undefined);

      const result = await controller.markAsRead(mockUser, notificationId);

      expect(result).toEqual({
        success: true,
        message: 'Notification marked as read',
      });
      expect(notificationService.markAsRead).toHaveBeenCalledWith(
        notificationId,
        mockUser.id,
      );
    });

    it('should handle service errors', async () => {
      const notificationId = 'notification-123';
      const error = new Error('Notification not found');
      notificationService.markAsRead.mockRejectedValue(error);

      await expect(
        controller.markAsRead(mockUser, notificationId),
      ).rejects.toThrow(error);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read successfully', async () => {
      notificationService.markAllAsRead.mockResolvedValue(undefined);

      const result = await controller.markAllAsRead(mockUser);

      expect(result).toEqual({
        success: true,
        message: 'All notifications marked as read',
      });
      expect(notificationService.markAllAsRead).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      notificationService.markAllAsRead.mockRejectedValue(error);

      await expect(controller.markAllAsRead(mockUser)).rejects.toThrow(error);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      const notificationId = 'notification-123';
      privacyService.softDeleteNotification.mockResolvedValue(undefined);

      const result = await controller.deleteNotification(
        mockUser,
        notificationId,
      );

      expect(result).toEqual({
        success: true,
        message: 'Notification deleted successfully',
      });
      expect(privacyService.softDeleteNotification).toHaveBeenCalledWith(
        notificationId,
        mockUser.id,
        mockUser.id,
      );
    });

    it('should handle service errors', async () => {
      const notificationId = 'notification-123';
      const error = new Error('Notification not found');
      privacyService.softDeleteNotification.mockRejectedValue(error);

      await expect(
        controller.deleteNotification(mockUser, notificationId),
      ).rejects.toThrow(error);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should have proper controller setup', () => {
      // Verify the controller is properly instantiated
      expect(controller).toBeDefined();
      expect(typeof controller.getUserNotifications).toBe('function');
      expect(typeof controller.markAsRead).toBe('function');
      expect(typeof controller.deleteNotification).toBe('function');
    });
  });

  describe('Tenant Isolation', () => {
    it('should only access notifications through user context', async () => {
      const filters: NotificationFilterDto = {};
      notificationService.getUserNotifications.mockResolvedValue(
        mockPaginatedResult,
      );

      await controller.getUserNotifications(mockUser, filters);

      // Verify that the service is called with the user ID from the authenticated user
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(
        mockUser.id,
        filters,
      );
    });

    it('should only mark notifications as read for authenticated user', async () => {
      const notificationId = 'notification-123';
      notificationService.markAsRead.mockResolvedValue(undefined);

      await controller.markAsRead(mockUser, notificationId);

      // Verify that the service is called with both notification ID and user ID
      expect(notificationService.markAsRead).toHaveBeenCalledWith(
        notificationId,
        mockUser.id,
      );
    });

    it('should only delete notifications for authenticated user', async () => {
      const notificationId = 'notification-123';
      privacyService.softDeleteNotification.mockResolvedValue(undefined);

      await controller.deleteNotification(mockUser, notificationId);

      // Verify that the service is called with notification ID, user ID, and deleted by user ID
      expect(privacyService.softDeleteNotification).toHaveBeenCalledWith(
        notificationId,
        mockUser.id,
        mockUser.id,
      );
    });
  });
});
