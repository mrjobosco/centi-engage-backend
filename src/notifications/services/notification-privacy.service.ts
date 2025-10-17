import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

export interface AuditLogData {
  notificationId: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT';
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Service for managing notification privacy and audit logging.
 *
 * Note: Scheduled tasks (cron jobs) for cleanup and retention policy enforcement
 * have been moved to NotificationSchedulerService to avoid conflicts with
 * request-scoped dependencies (this service depends on TenantContextService
 * which is request-scoped).
 */
@Injectable()
export class NotificationPrivacyService {
  private readonly logger = new Logger(NotificationPrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Soft delete a notification
   */
  async softDeleteNotification(
    notificationId: string,
    userId: string,
    deletedBy: string,
  ): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    try {
      // Verify the notification belongs to the user and tenant
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
          tenantId,
          deletedAt: null, // Only soft delete if not already deleted
        },
      });

      if (!notification) {
        throw new Error('Notification not found or already deleted');
      }

      // Soft delete the notification
      await this.prisma.notification.update({
        where: {
          id: notificationId,
        },
        data: {
          deletedAt: new Date(),
          deletedBy,
        },
      });

      // Log the deletion if it's sensitive data
      if (notification.sensitiveData) {
        await this.createAuditLog({
          notificationId,
          action: 'DELETE',
          userId: deletedBy,
          metadata: {
            softDelete: true,
            originalUserId: userId,
          },
        });
      }

      this.logger.log(
        `Soft deleted notification ${notificationId} for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to soft delete notification ${notificationId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Restore a soft-deleted notification
   */
  async restoreNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    try {
      // Verify the notification belongs to the user and tenant and is soft deleted
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId,
          tenantId,
          deletedAt: { not: null }, // Only restore if soft deleted
        },
      });

      if (!notification) {
        throw new Error('Notification not found or not deleted');
      }

      // Restore the notification
      await this.prisma.notification.update({
        where: {
          id: notificationId,
        },
        data: {
          deletedAt: null,
          deletedBy: null,
        },
      });

      // Log the restoration if it's sensitive data
      if (notification.sensitiveData) {
        await this.createAuditLog({
          notificationId,
          action: 'UPDATE',
          userId,
          metadata: {
            action: 'restore',
          },
        });
      }

      this.logger.log(
        `Restored notification ${notificationId} for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to restore notification ${notificationId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Set retention date for a notification
   */
  async setRetentionDate(
    notificationId: string,
    retentionDate: Date,
  ): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    try {
      await this.prisma.notification.update({
        where: {
          id: notificationId,
          tenantId, // Ensure tenant isolation
        },
        data: {
          retentionDate,
        },
      });

      this.logger.debug(
        `Set retention date for notification ${notificationId} to ${retentionDate.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to set retention date for notification ${notificationId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Create an audit log entry for sensitive notifications
   */
  async createAuditLog(data: AuditLogData): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    try {
      await this.prisma.notificationAuditLog.create({
        data: {
          notificationId: data.notificationId,
          action: data.action,
          userId: data.userId,
          tenantId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata,
        },
      });

      this.logger.debug(
        `Created audit log for notification ${data.notificationId}, action: ${data.action}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create audit log for notification ${data.notificationId}`,
        (error as Error).stack,
      );
      // Don't throw error for audit logging failures to avoid breaking main functionality
    }
  }

  /**
   * Get audit logs for a notification
   */
  async getAuditLogs(notificationId: string): Promise<any[]> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    try {
      return await this.prisma.notificationAuditLog.findMany({
        where: {
          notificationId,
          tenantId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get audit logs for notification ${notificationId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Mark notification as containing sensitive data
   */
  async markAsSensitive(notificationId: string): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    try {
      await this.prisma.notification.update({
        where: {
          id: notificationId,
          tenantId, // Ensure tenant isolation
        },
        data: {
          sensitiveData: true,
        },
      });

      this.logger.debug(`Marked notification ${notificationId} as sensitive`);
    } catch (error) {
      this.logger.error(
        `Failed to mark notification ${notificationId} as sensitive`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Get notifications with privacy filters applied
   */
  async getNotificationsWithPrivacyFilters(
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      includeDeleted?: boolean;
      onlySensitive?: boolean;
    } = {},
  ): Promise<any> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    const {
      page = 1,
      limit = 20,
      includeDeleted = false,
      onlySensitive = false,
    } = filters;

    try {
      const where: any = {
        userId,
        tenantId,
      };

      // Apply soft delete filter
      if (!includeDeleted) {
        where.deletedAt = null;
      }

      // Apply sensitive data filter
      if (onlySensitive) {
        where.sensitiveData = true;
      }

      // Apply retention policy filter (don't show expired notifications)
      const now = new Date();
      where.OR = [{ retentionDate: null }, { retentionDate: { gt: now } }];

      const skip = (page - 1) * limit;

      const [notifications, total] = await Promise.all([
        this.prisma.notification.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
          select: {
            id: true,
            type: true,
            category: true,
            title: true,
            message: true,
            data: true,
            channelsSent: true,
            readAt: true,
            createdAt: true,
            expiresAt: true,
            deletedAt: true,
            sensitiveData: true,
            retentionDate: true,
          },
        }),
        this.prisma.notification.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        notifications,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get notifications with privacy filters for user ${userId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
