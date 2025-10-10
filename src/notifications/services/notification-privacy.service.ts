import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
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

@Injectable()
export class NotificationPrivacyService {
  private readonly logger = new Logger(NotificationPrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService,
  ) { }

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
   * Enforce retention policy - run daily to clean up expired notifications
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async enforceRetentionPolicy(): Promise<void> {
    this.logger.log('Starting retention policy enforcement');

    try {
      const now = new Date();

      // Get default retention period from config (in days)
      const defaultRetentionDays = this.configService.get<number>(
        'NOTIFICATION_RETENTION_DAYS',
        90, // Default to 90 days
      );

      // Calculate default retention date
      const defaultRetentionDate = new Date();
      defaultRetentionDate.setDate(
        defaultRetentionDate.getDate() - defaultRetentionDays,
      );

      // Find notifications that should be deleted based on retention policy
      const expiredNotifications = await this.prisma.notification.findMany({
        where: {
          OR: [
            // Notifications with explicit retention date that has passed
            {
              retentionDate: {
                lte: now,
              },
            },
            // Notifications older than default retention period without explicit retention date
            {
              retentionDate: null,
              createdAt: {
                lte: defaultRetentionDate,
              },
            },
          ],
          deletedAt: null, // Only process non-deleted notifications
        },
        select: {
          id: true,
          tenantId: true,
          userId: true,
          sensitiveData: true,
        },
      });

      this.logger.log(
        `Found ${expiredNotifications.length} notifications to delete based on retention policy`,
      );

      // Delete expired notifications
      for (const notification of expiredNotifications) {
        try {
          // Create audit log for sensitive data before deletion
          if (notification.sensitiveData) {
            await this.prisma.notificationAuditLog.create({
              data: {
                notificationId: notification.id,
                action: 'DELETE',
                userId: 'system',
                tenantId: notification.tenantId,
                metadata: {
                  reason: 'retention_policy',
                  deletedAt: now.toISOString(),
                },
              },
            });
          }

          // Hard delete the notification (cascade will delete related records)
          await this.prisma.notification.delete({
            where: {
              id: notification.id,
            },
          });

          this.logger.debug(
            `Deleted notification ${notification.id} due to retention policy`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to delete notification ${notification.id} during retention enforcement`,
            (error as Error).stack,
          );
        }
      }

      this.logger.log(
        `Retention policy enforcement completed. Deleted ${expiredNotifications.length} notifications`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to enforce retention policy',
        (error as Error).stack,
      );
    }
  }

  /**
   * Clean up old audit logs - run weekly
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupAuditLogs(): Promise<void> {
    this.logger.log('Starting audit log cleanup');

    try {
      // Get audit log retention period from config (in days)
      const auditRetentionDays = this.configService.get<number>(
        'AUDIT_LOG_RETENTION_DAYS',
        365, // Default to 1 year
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - auditRetentionDays);

      // Delete old audit logs
      const result = await this.prisma.notificationAuditLog.deleteMany({
        where: {
          createdAt: {
            lte: cutoffDate,
          },
        },
      });

      this.logger.log(
        `Audit log cleanup completed. Deleted ${result.count} old audit log entries`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup audit logs', (error as Error).stack);
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
