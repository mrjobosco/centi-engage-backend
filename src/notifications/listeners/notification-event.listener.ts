import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../services/notification.service';
import { NotificationPayload } from '../interfaces/notification-payload.interface';
import { NotificationType, NotificationPriority } from '../enums';
import {
  NOTIFICATION_EVENTS,
  type UserCreatedEvent,
  type UserUpdatedEvent,
  type UserDeletedEvent,
  type ProjectCreatedEvent,
  type ProjectUpdatedEvent,
  type ProjectDeletedEvent,
  type RoleAssignedEvent,
  type RoleRevokedEvent,
  type PermissionGrantedEvent,
  type PermissionRevokedEvent,
  type SystemMaintenanceEvent,
  type SecurityAlertEvent,
  type InvoiceGeneratedEvent,
  type PaymentReceivedEvent,
  type SubscriptionExpiredEvent,
} from '../events/event-types';

@Injectable()
export class NotificationEventListener {
  private readonly logger = new Logger(NotificationEventListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Helper method to handle errors consistently
   */
  private handleError(error: unknown, context: string): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(`${context}: ${message}`, stack);
  }

  /**
   * User Events
   */
  @OnEvent(NOTIFICATION_EVENTS.USER_CREATED)
  async handleUserCreated(event: UserCreatedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.userId,
        category: 'user_management',
        type: NotificationType.SUCCESS,
        title: 'Welcome to the platform!',
        message: `Welcome ${event.userName}! Your account has been successfully created.`,
        priority: NotificationPriority.MEDIUM,
        data: {
          userEmail: event.userEmail,
          userName: event.userName,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(`Created welcome notification for user ${event.userId}`);
    } catch (error) {
      this.handleError(error, 'Failed to create user created notification');
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.USER_UPDATED)
  async handleUserUpdated(event: UserUpdatedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.userId,
        category: 'user_management',
        type: NotificationType.INFO,
        title: 'Profile Updated',
        message: 'Your profile information has been successfully updated.',
        priority: NotificationPriority.LOW,
        data: {
          userEmail: event.userEmail,
          userName: event.userName,
          changes: event.changes,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created profile update notification for user ${event.userId}`,
      );
    } catch (error) {
      this.handleError(error, 'Failed to create user updated notification');
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.USER_DELETED)
  async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    try {
      this.logger.log(
        `User ${event.userId} (${event.userName}) was deleted from tenant ${event.tenantId}`,
      );

      // Send notification to tenant admins about user deletion
      const adminNotification = {
        tenantId: event.tenantId,
        userId: 'system', // System-generated notification
        title: 'User Account Deleted',
        message: `User account ${event.userName} has been deleted from your organization.`,
        category: 'user_management',
        priority: 'medium' as any,
        channels: ['IN_APP', 'EMAIL'],
        data: {
          deletedUserId: event.userId,
          deletedUserName: event.userName,
          deletedAt: new Date().toISOString(),
          reason: 'User account deleted',
        },
        metadata: {
          eventType: 'user_deleted',
          automated: true,
        },
      };

      // Send to all admin users in the tenant
      // Note: This will send to all users in tenant - in a real implementation
      // you would filter by admin roles in the sendToTenant method
      await this.notificationService.sendToTenant(adminNotification);

      // Clean up any pending notifications for the deleted user
      this.cleanupUserNotifications(event.userId, event.tenantId);
    } catch (error) {
      this.handleError(error, 'Failed to handle user deleted event');
    }
  }

  /**
   * Clean up notifications for deleted user
   */
  private cleanupUserNotifications(userId: string, tenantId: string): void {
    try {
      // This would typically involve:
      // 1. Canceling pending notifications
      // 2. Marking in-app notifications as deleted
      // 3. Removing user from notification preferences

      this.logger.debug(
        `Cleaning up notifications for deleted user ${userId} in tenant ${tenantId}`,
      );

      // For now, just log the cleanup action
      // In a full implementation, you would:
      // - Cancel queued notifications
      // - Update notification delivery logs
      // - Clean up user preferences
    } catch (error) {
      this.logger.error(
        `Failed to cleanup notifications for user ${userId}:`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Project Events
   */
  @OnEvent(NOTIFICATION_EVENTS.PROJECT_CREATED)
  async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.createdBy,
        category: 'project_management',
        type: NotificationType.SUCCESS,
        title: 'Project Created',
        message: `Project "${event.projectName}" has been successfully created.`,
        priority: NotificationPriority.MEDIUM,
        data: {
          projectId: event.projectId,
          projectName: event.projectName,
          projectDescription: event.projectDescription,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created project creation notification for project ${event.projectId}`,
      );
    } catch (error) {
      this.handleError(error, 'Failed to create project created notification');
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.PROJECT_UPDATED)
  async handleProjectUpdated(event: ProjectUpdatedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.updatedBy,
        category: 'project_management',
        type: NotificationType.INFO,
        title: 'Project Updated',
        message: `Project "${event.projectName}" has been updated.`,
        priority: NotificationPriority.LOW,
        data: {
          projectId: event.projectId,
          projectName: event.projectName,
          changes: event.changes,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created project update notification for project ${event.projectId}`,
      );
    } catch (error) {
      this.handleError(error, 'Failed to create project updated notification');
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.PROJECT_DELETED)
  async handleProjectDeleted(event: ProjectDeletedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.deletedBy,
        category: 'project_management',
        type: NotificationType.WARNING,
        title: 'Project Deleted',
        message: `Project "${event.projectName}" has been deleted.`,
        priority: NotificationPriority.MEDIUM,
        data: {
          projectId: event.projectId,
          projectName: event.projectName,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created project deletion notification for project ${event.projectId}`,
      );
    } catch (error) {
      this.handleError(error, 'Failed to create project deleted notification');
    }
  }

  /**
   * Role and Permission Events
   */
  @OnEvent(NOTIFICATION_EVENTS.ROLE_ASSIGNED)
  async handleRoleAssigned(event: RoleAssignedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.userId,
        category: 'access_management',
        type: NotificationType.INFO,
        title: 'Role Assigned',
        message: `You have been assigned the role "${event.roleName}".`,
        priority: NotificationPriority.MEDIUM,
        data: {
          roleId: event.roleId,
          roleName: event.roleName,
          assignedBy: event.assignedBy,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created role assignment notification for user ${event.userId}`,
      );
    } catch (error) {
      this.handleError(error, 'Failed to create role assigned notification');
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.ROLE_REVOKED)
  async handleRoleRevoked(event: RoleRevokedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.userId,
        category: 'access_management',
        type: NotificationType.WARNING,
        title: 'Role Revoked',
        message: `Your role "${event.roleName}" has been revoked.`,
        priority: NotificationPriority.HIGH,
        data: {
          roleId: event.roleId,
          roleName: event.roleName,
          revokedBy: event.revokedBy,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created role revocation notification for user ${event.userId}`,
      );
    } catch (error) {
      this.handleError(error, 'Failed to create role revoked notification');
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.PERMISSION_GRANTED)
  async handlePermissionGranted(event: PermissionGrantedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.userId,
        category: 'access_management',
        type: NotificationType.INFO,
        title: 'Permission Granted',
        message: `You have been granted the permission "${event.permissionName}".`,
        priority: NotificationPriority.LOW,
        data: {
          permissionId: event.permissionId,
          permissionName: event.permissionName,
          grantedBy: event.grantedBy,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created permission granted notification for user ${event.userId}`,
      );
    } catch (error) {
      this.handleError(
        error,
        'Failed to create permission granted notification',
      );
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.PERMISSION_REVOKED)
  async handlePermissionRevoked(event: PermissionRevokedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.userId,
        category: 'access_management',
        type: NotificationType.WARNING,
        title: 'Permission Revoked',
        message: `Your permission "${event.permissionName}" has been revoked.`,
        priority: NotificationPriority.MEDIUM,
        data: {
          permissionId: event.permissionId,
          permissionName: event.permissionName,
          revokedBy: event.revokedBy,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created permission revoked notification for user ${event.userId}`,
      );
    } catch (error) {
      this.handleError(
        error,
        'Failed to create permission revoked notification',
      );
    }
  }

  /**
   * System Events
   */
  @OnEvent(NOTIFICATION_EVENTS.SYSTEM_MAINTENANCE)
  async handleSystemMaintenance(event: SystemMaintenanceEvent): Promise<void> {
    try {
      const maintenanceType =
        event.maintenanceType === 'emergency' ? 'Emergency' : 'Scheduled';
      const priority =
        event.maintenanceType === 'emergency'
          ? NotificationPriority.URGENT
          : NotificationPriority.HIGH;

      // Send to all users in the tenant (or all tenants if it's a system-wide maintenance)
      const payload: Omit<NotificationPayload, 'userId'> = {
        tenantId: event.tenantId,
        category: 'system',
        type: NotificationType.WARNING,
        title: `${maintenanceType} Maintenance`,
        message: event.description,
        priority,
        data: {
          maintenanceType: event.maintenanceType,
          startTime: event.startTime,
          endTime: event.endTime,
        },
      };

      // For system maintenance, we might want to send to all users in the tenant
      await this.notificationService.sendToTenant(payload);
      this.logger.log(
        `Created system maintenance notification for tenant ${event.tenantId}`,
      );
    } catch (error) {
      this.handleError(
        error,
        'Failed to create system maintenance notification',
      );
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.SECURITY_ALERT)
  async handleSecurityAlert(event: SecurityAlertEvent): Promise<void> {
    try {
      const priorityMap: Record<string, NotificationPriority> = {
        low: NotificationPriority.LOW,
        medium: NotificationPriority.MEDIUM,
        high: NotificationPriority.HIGH,
        critical: NotificationPriority.URGENT,
      };

      if (event.userId) {
        // Send to specific user
        const payload: NotificationPayload = {
          tenantId: event.tenantId,
          userId: event.userId,
          category: 'security',
          type: NotificationType.ERROR,
          title: 'Security Alert',
          message: event.description,
          priority: priorityMap[event.severity] || NotificationPriority.MEDIUM,
          data: {
            alertType: event.alertType,
            severity: event.severity,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
          },
        };
        await this.notificationService.create(payload);
      } else {
        // If no specific user, send to all users in tenant
        const tenantPayload: Omit<NotificationPayload, 'userId'> = {
          tenantId: event.tenantId,
          category: 'security',
          type: NotificationType.ERROR,
          title: 'Security Alert',
          message: event.description,
          priority: priorityMap[event.severity] || NotificationPriority.MEDIUM,
          data: {
            alertType: event.alertType,
            severity: event.severity,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
          },
        };
        await this.notificationService.sendToTenant(tenantPayload);
      }

      this.logger.log(
        `Created security alert notification for tenant ${event.tenantId}`,
      );
    } catch (error) {
      this.handleError(error, 'Failed to create security alert notification');
    }
  }

  /**
   * Business Events
   */
  @OnEvent(NOTIFICATION_EVENTS.INVOICE_GENERATED)
  async handleInvoiceGenerated(event: InvoiceGeneratedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.userId,
        category: 'billing',
        type: NotificationType.INFO,
        title: 'New Invoice Generated',
        message: `Invoice #${event.invoiceNumber} for ${event.amount} ${event.currency} has been generated.`,
        priority: NotificationPriority.MEDIUM,
        data: {
          invoiceId: event.invoiceId,
          invoiceNumber: event.invoiceNumber,
          amount: event.amount,
          currency: event.currency,
          dueDate: event.dueDate,
          customerId: event.customerId,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created invoice generated notification for invoice ${event.invoiceId}`,
      );
    } catch (error) {
      this.handleError(
        error,
        'Failed to create invoice generated notification',
      );
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.PAYMENT_RECEIVED)
  async handlePaymentReceived(event: PaymentReceivedEvent): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.userId,
        category: 'billing',
        type: NotificationType.SUCCESS,
        title: 'Payment Received',
        message: `Payment of ${event.amount} ${event.currency} has been received via ${event.paymentMethod}.`,
        priority: NotificationPriority.MEDIUM,
        data: {
          paymentId: event.paymentId,
          invoiceId: event.invoiceId,
          amount: event.amount,
          currency: event.currency,
          paymentMethod: event.paymentMethod,
          customerId: event.customerId,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created payment received notification for payment ${event.paymentId}`,
      );
    } catch (error) {
      this.handleError(error, 'Failed to create payment received notification');
    }
  }

  @OnEvent(NOTIFICATION_EVENTS.SUBSCRIPTION_EXPIRED)
  async handleSubscriptionExpired(
    event: SubscriptionExpiredEvent,
  ): Promise<void> {
    try {
      const payload: NotificationPayload = {
        tenantId: event.tenantId,
        userId: event.userId,
        category: 'billing',
        type: NotificationType.ERROR,
        title: 'Subscription Expired',
        message: `Your ${event.planName} subscription has expired. Please renew to continue using the service.`,
        priority: NotificationPriority.URGENT,
        data: {
          subscriptionId: event.subscriptionId,
          planName: event.planName,
          expiryDate: event.expiryDate,
          gracePeriodEnd: event.gracePeriodEnd,
        },
      };

      await this.notificationService.create(payload);
      this.logger.log(
        `Created subscription expired notification for subscription ${event.subscriptionId}`,
      );
    } catch (error) {
      this.handleError(
        error,
        'Failed to create subscription expired notification',
      );
    }
  }
}
