import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { BaseChannel } from './base-channel.abstract';
import { NotificationPayload } from '../interfaces/notification-payload.interface';
import { NotificationResult } from '../interfaces/notification-result.interface';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { NotificationGateway } from '../gateways/notification.gateway';

@Injectable()
export class InAppChannelService extends BaseChannel {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(forwardRef(() => NotificationGateway))
    private readonly notificationGateway: NotificationGateway,
  ) {
    super();
  }

  getChannelType(): NotificationChannelType {
    return NotificationChannelType.IN_APP;
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      this.logNotificationAttempt(payload);

      // Validate payload
      if (!this.validate(payload)) {
        const error = 'Invalid notification payload';
        this.logNotificationFailure(payload, error);
        return this.createFailureResult(error);
      }

      // Set tenant context for Prisma middleware
      this.tenantContext.setTenantId(payload.tenantId);

      // Create notification in database
      const notification = await this.prisma.notification.create({
        data: {
          tenantId: payload.tenantId,
          userId: payload.userId,
          type: payload.type,
          category: payload.category,
          title: payload.title,
          message: payload.message,
          data: payload.data || undefined,
          channelsSent: [NotificationChannelType.IN_APP],
          expiresAt: payload.expiresAt || null,
        },
      });

      // Create delivery log
      const deliveryLog = await this.prisma.notificationDeliveryLog.create({
        data: {
          notificationId: notification.id,
          channel: NotificationChannelType.IN_APP,
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      // Emit real-time notification via WebSocket
      try {
        this.notificationGateway.emitNotification(payload.userId, {
          id: notification.id,
          type: notification.type,
          category: notification.category,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          createdAt: notification.createdAt,
          expiresAt: notification.expiresAt,
        });

        // Get and emit updated unread count
        const unreadCount = await this.getUnreadCount(payload.userId);
        this.notificationGateway.emitUnreadCount(payload.userId, unreadCount);
      } catch (wsError) {
        // Log WebSocket error but don't fail the notification
        this.logger.warn(
          `Failed to emit WebSocket notification for user ${payload.userId}: ${(wsError as Error).message}`,
        );
      }

      this.logNotificationSuccess(payload, notification.id);

      return this.createSuccessResult(notification.id, deliveryLog.id);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logNotificationFailure(payload, errorMessage);
      return this.createFailureResult(errorMessage);
    }
  }

  /**
   * Enhanced validation for in-app notifications
   */
  validate(payload: NotificationPayload): boolean {
    // Use base validation first
    if (!super.validate(payload)) {
      return false;
    }

    // Additional validation for in-app notifications
    if (payload.expiresAt && payload.expiresAt <= new Date()) {
      this.logger.warn('Notification expiry date is in the past');
      return false;
    }

    return true;
  }

  /**
   * Check if in-app channel is available
   * In-app notifications are always available as they don't depend on external services
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if database connection is available
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error(
        'Database connection not available for in-app notifications',
        error,
      );
      return false;
    }
  }

  /**
   * Get unread notification count for a user
   */
  private async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await this.prisma.notification.count({
        where: {
          userId,
          readAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      return count;
    } catch (error) {
      this.logger.error(`Failed to get unread count for user ${userId}`, error);
      return 0;
    }
  }
}
