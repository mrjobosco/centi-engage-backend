import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service for scheduled notification-related tasks
 * This service uses DEFAULT scope (singleton) to work with cron jobs
 */
@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

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

      // Delete old audit logs across all tenants
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
}
