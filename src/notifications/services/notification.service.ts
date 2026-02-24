import { Injectable, Logger } from '@nestjs/common';
import { Notification } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationChannelFactory } from '../factories/notification-channel.factory';
import { NotificationPayload } from '../interfaces/notification-payload.interface';
import { NotificationResult } from '../interfaces/notification-result.interface';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { MetricsService } from './metrics.service';
import { NotificationLoggerService } from './notification-logger.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly channelFactory: NotificationChannelFactory,
    private readonly metricsService: MetricsService,
    private readonly notificationLogger: NotificationLoggerService,
  ) {}

  /**
   * Create and send a notification through enabled channels
   * Orchestrates the entire notification creation and delivery process
   */
  async create(payload: NotificationPayload): Promise<Notification> {
    this.logger.log(
      `Creating notification for user ${payload.userId} in category ${payload.category}`,
    );

    // Start timing the overall processing
    const endTimer = this.metricsService.startTimer(
      NotificationChannelType.IN_APP, // Default channel for timing
      payload.category,
      'notification_service',
    );

    try {
      // Validate tenant context
      const tenantId = this.tenantContext.getTenantId();
      if (!tenantId) {
        throw new Error('Tenant context is required');
      }

      // Ensure payload has correct tenant ID
      const validatedPayload = {
        ...payload,
        tenantId,
      };

      // Load user preferences to determine enabled channels
      const enabledChannels = await this.preferenceService.getEnabledChannels(
        payload.userId,
        payload.category,
      );

      this.logger.debug(
        `Enabled channels for user ${payload.userId}, category ${payload.category}: ${enabledChannels.join(', ')}`,
      );

      // Create the notification record first
      const notification = await this.prisma.notification.create({
        data: {
          tenantId: validatedPayload.tenantId,
          userId: validatedPayload.userId,
          type: validatedPayload.type,
          category: validatedPayload.category,
          title: validatedPayload.title,
          message: validatedPayload.message,
          data: validatedPayload.data || undefined,
          channelsSent: [], // Will be updated as channels succeed
          expiresAt: validatedPayload.expiresAt || null,
        },
      });

      // Log notification creation
      this.notificationLogger.logNotificationCreated({
        tenantId: validatedPayload.tenantId,
        userId: validatedPayload.userId,
        notificationId: notification.id,
        category: validatedPayload.category,
        type: validatedPayload.type,
        metadata: {
          enabled_channels: enabledChannels,
          has_template: !!validatedPayload.templateId,
          expires_at: validatedPayload.expiresAt?.toISOString(),
        },
      });

      // Send through enabled channels
      const channelResults = await this.sendThroughChannels(
        validatedPayload,
        enabledChannels,
      );

      // Update the notification with successful channels
      const successfulChannels = channelResults
        .filter((result) => result.success)
        .map((result) => result.channel);

      const updatedNotification = await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          channelsSent: successfulChannels,
        },
      });

      // Log results
      const successCount = channelResults.filter((r) => r.success).length;
      const failureCount = channelResults.length - successCount;

      this.logger.log(
        `Notification ${notification.id} sent: ${successCount} successful, ${failureCount} failed`,
      );

      if (failureCount > 0) {
        const failedChannels = channelResults
          .filter((r) => !r.success)
          .map((r) => `${r.channel}: ${r.error}`)
          .join(', ');
        this.logger.warn(
          `Failed channels for notification ${notification.id}: ${failedChannels}`,
        );
      }

      // Record metrics for successful channels
      successfulChannels.forEach((channel) => {
        this.metricsService.recordDelivery(
          channel,
          payload.category,
          validatedPayload.tenantId,
          'notification_service',
        );
      });

      // Record metrics for failed channels
      channelResults
        .filter((result) => !result.success)
        .forEach((result) => {
          this.metricsService.recordFailure(
            result.channel,
            payload.category,
            validatedPayload.tenantId,
            result.error || 'unknown_error',
            'notification_service',
          );
        });

      // End timing
      endTimer();

      return updatedNotification;
    } catch (error) {
      // Record failure metrics
      this.metricsService.recordFailure(
        NotificationChannelType.IN_APP,
        payload.category,
        payload.tenantId,
        'service_error',
        'notification_service',
      );

      // End timing
      endTimer();

      this.logger.error(
        `Failed to create notification for user ${payload.userId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Send notification through multiple channels, handling partial failures
   * @private
   */
  private async sendThroughChannels(
    payload: NotificationPayload,
    enabledChannels: NotificationChannelType[],
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    // Send through each enabled channel independently
    for (const channelType of enabledChannels) {
      try {
        // Check if channel is registered
        if (!this.channelFactory.isChannelRegistered(channelType)) {
          this.logger.warn(
            `Channel ${channelType} is not registered, skipping`,
          );
          results.push({
            success: false,
            channel: channelType,
            error: 'Channel not registered',
          });
          continue;
        }

        // Get channel handler
        const channel = this.channelFactory.getChannel(channelType);

        // Check if channel is available
        const isAvailable = await channel.isAvailable();
        if (!isAvailable) {
          this.logger.warn(`Channel ${channelType} is not available, skipping`);
          results.push({
            success: false,
            channel: channelType,
            error: 'Channel not available',
          });
          continue;
        }

        // Validate payload for this channel
        const isValid = channel.validate(payload);
        if (!isValid) {
          this.logger.warn(
            `Payload validation failed for channel ${channelType}`,
          );
          results.push({
            success: false,
            channel: channelType,
            error: 'Payload validation failed',
          });
          continue;
        }

        // Send through channel
        const result = await channel.send(payload);
        results.push(result);

        this.logger.debug(
          `Channel ${channelType} result: ${result.success ? 'success' : 'failed'}`,
        );
      } catch (error) {
        this.logger.error(
          `Error sending through channel ${channelType}`,
          (error as Error).stack,
        );
        results.push({
          success: false,
          channel: channelType,
          error: (error as Error).message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Send notification to a specific user
   * Convenience method that fills in common fields
   */
  async sendToUser(
    userId: string,
    payload: Partial<NotificationPayload>,
  ): Promise<Notification> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    // Build complete payload with defaults
    const completePayload: NotificationPayload = {
      tenantId,
      userId,
      type: payload.type || NotificationType.INFO,
      category: payload.category || 'system',
      title: payload.title || 'Notification',
      message: payload.message || '',
      data: payload.data,
      priority: payload.priority || NotificationPriority.MEDIUM,
      expiresAt: payload.expiresAt,
      templateId: payload.templateId,
      templateVariables: payload.templateVariables,
    };

    return this.create(completePayload);
  }

  /**
   * Send notification to all users in the current tenant
   * Creates individual notifications for each user
   */
  async sendToTenant(
    payload: Partial<NotificationPayload>,
  ): Promise<Notification[]> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    this.logger.log(`Sending notification to all users in tenant ${tenantId}`);

    try {
      // Get all users in the tenant
      const users = await this.prisma.user.findMany({
        where: {
          tenantId,
        },
        select: {
          id: true,
        },
      });

      this.logger.debug(`Found ${users.length} users in tenant ${tenantId}`);

      // Create notifications for each user
      const notifications: Notification[] = [];
      const errors: string[] = [];

      for (const user of users) {
        try {
          const notification = await this.sendToUser(user.id, payload);
          notifications.push(notification);
        } catch (error) {
          this.logger.error(
            `Failed to send notification to user ${user.id}`,
            (error as Error).stack,
          );
          errors.push(`User ${user.id}: ${(error as Error).message}`);
        }
      }

      if (errors.length > 0) {
        this.logger.warn(`Some notifications failed: ${errors.join(', ')}`);
      }

      this.logger.log(
        `Sent ${notifications.length} notifications to tenant ${tenantId}`,
      );

      return notifications;
    } catch (error) {
      this.logger.error(
        `Failed to send notifications to tenant ${tenantId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Mark a specific notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
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
        },
      });

      if (!notification) {
        throw new Error('Notification not found or access denied');
      }

      // Update the notification
      await this.prisma.notification.update({
        where: {
          id: notificationId,
        },
        data: {
          readAt: new Date(),
        },
      });

      this.logger.debug(
        `Marked notification ${notificationId} as read for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark notification ${notificationId} as read`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          tenantId,
          readAt: null, // Only update unread notifications
        },
        data: {
          readAt: new Date(),
        },
      });

      this.logger.log(
        `Marked ${result.count} notifications as read for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to mark all notifications as read for user ${userId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Get paginated notifications for a user with filtering
   */
  async getUserNotifications(
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      type?: NotificationType;
      category?: string;
      unread?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      search?: string;
    } = {},
  ): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    const {
      page = 1,
      limit = 20,
      type,
      category,
      unread,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
    } = filters;

    try {
      // Build where clause
      const where: any = {
        userId,
        tenantId,
        deletedAt: null, // Exclude soft-deleted notifications
      };

      // Add filters
      if (type) {
        where.type = type;
      }

      if (category) {
        where.category = category;
      }

      if (unread !== undefined) {
        where.readAt = unread ? null : { not: null };
      }

      // Build AND conditions for search, expiration, and retention
      const andConditions: any[] = [];

      // Add search condition
      if (search) {
        andConditions.push({
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { message: { contains: search, mode: 'insensitive' } },
          ],
        });
      }

      // Add expiration filter (don't show expired notifications)
      andConditions.push({
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      });

      // Add retention policy filter (don't show notifications past retention date)
      andConditions.push({
        OR: [{ retentionDate: null }, { retentionDate: { gt: new Date() } }],
      });

      // Add AND conditions to where clause
      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      // Get total count
      const total = await this.prisma.notification.count({ where });

      // Get notifications
      const notifications = await this.prisma.notification.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      });

      const totalPages = Math.ceil(total / limit);

      this.logger.debug(
        `Retrieved ${notifications.length} notifications for user ${userId} (page ${page}/${totalPages})`,
      );

      return {
        notifications,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get notifications for user ${userId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    try {
      const count = await this.prisma.notification.count({
        where: {
          userId,
          tenantId,
          readAt: null,
          deletedAt: null, // Exclude soft-deleted notifications
          AND: [
            {
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            {
              OR: [
                { retentionDate: null },
                { retentionDate: { gt: new Date() } },
              ],
            },
          ],
        },
      });

      return count;
    } catch (error) {
      this.logger.error(
        `Failed to get unread count for user ${userId}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Soft delete a notification (user dismisses it)
   */
  deleteNotification(notificationId: string, userId: string): void {
    // This method is now deprecated in favor of the privacy service
    // Keeping for backward compatibility
    this.logger.warn({
      event: 'deprecated_delete_notification',
      notificationId,
      userId,
    });
    throw new Error(
      'Use NotificationPrivacyService.softDeleteNotification instead',
    );
  }
}
