import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface AuthAuditEvent {
  userId: string;
  tenantId: string;
  action:
  | 'google_login'
  | 'google_link'
  | 'google_unlink'
  | 'password_login'
  | 'google_settings_update';
  authMethod: 'google' | 'password' | 'admin';
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuthAuditService {
  private readonly logger = new Logger(AuthAuditService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Log authentication events to both database and application logs
   */
  async logAuthEvent(event: AuthAuditEvent): Promise<void> {
    try {
      // Log to application logs for immediate visibility
      const logData = {
        event: 'auth_event',
        user_id: event.userId,
        tenant_id: event.tenantId,
        action: event.action,
        auth_method: event.authMethod,
        success: event.success,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        error_code: event.errorCode,
        error_message: event.errorMessage,
        timestamp: new Date().toISOString(),
        ...event.metadata,
      };

      if (event.success) {
        this.logger.log(logData);
      } else {
        this.logger.error(logData);
      }

      // For Google authentication events, we'll create a notification audit log entry
      // since the schema already has auth_method field in notification_audit_logs
      // This provides database persistence for audit trails
      if (event.action.startsWith('google_')) {
        await this.createDatabaseAuditLog(event);
      }
    } catch (error) {
      // Don't let audit logging failures break the main flow
      this.logger.error('Failed to log auth event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event: event.action,
        userId: event.userId,
        tenantId: event.tenantId,
      });
    }
  }

  /**
   * Create a database audit log entry
   * Using notification_audit_logs table as it already has auth_method field
   */
  private async createDatabaseAuditLog(event: AuthAuditEvent): Promise<void> {
    try {
      // Create a dummy notification for audit purposes
      // This is a workaround since we don't have a dedicated auth_audit_logs table
      const auditNotification = await this.prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          userId: event.userId,
          type: 'INFO',
          category: 'auth_audit',
          title: `Authentication Event: ${event.action}`,
          message: `User performed ${event.action} with ${event.authMethod} authentication`,
          data: {
            action: event.action,
            authMethod: event.authMethod,
            success: event.success,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            errorCode: event.errorCode,
            errorMessage: event.errorMessage,
            ...event.metadata,
          },
          channelsSent: [], // No actual delivery needed for audit logs
        },
      });

      // Create the audit log entry
      await this.prisma.notificationAuditLog.create({
        data: {
          notificationId: auditNotification.id,
          action: event.action,
          userId: event.userId,
          tenantId: event.tenantId,
          authMethod: event.authMethod,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          metadata: {
            success: event.success,
            errorCode: event.errorCode,
            errorMessage: event.errorMessage,
            ...event.metadata,
          },
        } as any, // Type assertion to bypass TypeScript issue with authMethod field
      });
    } catch (error) {
      this.logger.error('Failed to create database audit log', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event: event.action,
        userId: event.userId,
        tenantId: event.tenantId,
      });
    }
  }

  /**
   * Log Google sign-in attempt
   */
  async logGoogleSignIn(
    userId: string,
    tenantId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logAuthEvent({
      userId,
      tenantId,
      action: 'google_login',
      authMethod: 'google',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata,
    });
  }

  /**
   * Log Google account linking
   */
  async logGoogleLink(
    userId: string,
    tenantId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logAuthEvent({
      userId,
      tenantId,
      action: 'google_link',
      authMethod: 'google',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata,
    });
  }

  /**
   * Log Google account unlinking
   */
  async logGoogleUnlink(
    userId: string,
    tenantId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logAuthEvent({
      userId,
      tenantId,
      action: 'google_unlink',
      authMethod: 'google',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata,
    });
  }

  /**
   * Log password authentication (for completeness)
   */
  async logPasswordLogin(
    userId: string,
    tenantId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logAuthEvent({
      userId,
      tenantId,
      action: 'password_login',
      authMethod: 'password',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata,
    });
  }

  /**
   * Log Google settings configuration changes
   */
  async logGoogleSettingsUpdate(
    userId: string,
    tenantId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logAuthEvent({
      userId,
      tenantId,
      action: 'google_settings_update',
      authMethod: 'admin',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata,
    });
  }

  /**
   * Query authentication audit logs for a user
   */
  async getUserAuthAuditLogs(
    userId: string,
    tenantId: string,
    limit: number = 50,
  ) {
    return this.prisma.notificationAuditLog.findMany({
      where: {
        userId,
        tenantId,
        action: {
          in: [
            'google_login',
            'google_link',
            'google_unlink',
            'password_login',
            'google_settings_update',
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        action: true,
        authMethod: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      } as any, // Type assertion to bypass TypeScript issue with authMethod field
    });
  }

  /**
   * Query authentication audit logs for a tenant
   */
  async getTenantAuthAuditLogs(
    tenantId: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    return this.prisma.notificationAuditLog.findMany({
      where: {
        tenantId,
        action: {
          in: [
            'google_login',
            'google_link',
            'google_unlink',
            'password_login',
            'google_settings_update',
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        authMethod: true,
        userId: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      } as any, // Type assertion to bypass TypeScript issue with authMethod field
    });
  }
}
