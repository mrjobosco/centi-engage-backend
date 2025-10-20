import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface TenantManagementAuditEvent {
  userId: string;
  tenantId?: string | null; // Can be null for tenant-less operations
  action:
  | 'tenant_less_registration'
  | 'tenant_less_google_registration'
  | 'tenant_less_login'
  | 'tenant_less_google_login'
  | 'tenant_creation'
  | 'tenant_joining'
  | 'invitation_acceptance'
  | 'tenant_status_check'
  | 'tenant_management_rate_limit_exceeded';
  authMethod: 'google' | 'password' | 'invitation';
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Service for comprehensive audit logging of tenant-less operations
 * Tracks all tenant management activities for security and compliance
 */
@Injectable()
export class TenantManagementAuditService {
  private readonly logger = new Logger(TenantManagementAuditService.name);

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Log tenant management events to both application logs and database
   */
  async logTenantManagementEvent(
    event: TenantManagementAuditEvent,
  ): Promise<void> {
    try {
      // Log to application logs for immediate visibility
      const logData = {
        event: 'tenant_management_event',
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

      // Create database audit log entry
      await this.createDatabaseAuditLog(event);
    } catch (error) {
      // Don't let audit logging failures break the main flow
      this.logger.error('Failed to log tenant management event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event: event.action,
        userId: event.userId,
        tenantId: event.tenantId,
      });
    }
  }

  /**
   * Create a database audit log entry using notification audit logs table
   */
  private async createDatabaseAuditLog(
    event: TenantManagementAuditEvent,
  ): Promise<void> {
    try {
      // For tenant-less operations, use a special system tenant ID
      const auditTenantId = event.tenantId || 'system-audit';

      // Create a dummy notification for audit purposes
      const auditNotification = await this.prisma.notification.create({
        data: {
          tenantId: auditTenantId,
          userId: event.userId,
          type: 'INFO',
          category: 'tenant_management_audit',
          title: `Tenant Management Event: ${event.action}`,
          message: `User performed ${event.action} with ${event.authMethod} authentication`,
          data: {
            action: event.action,
            authMethod: event.authMethod,
            success: event.success,
            ipAddress: event.ipAddress,
            userAgent: event.userAgent,
            errorCode: event.errorCode,
            errorMessage: event.errorMessage,
            originalTenantId: event.tenantId, // Store the original tenantId (which may be null)
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
          tenantId: auditTenantId,
          authMethod: event.authMethod,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          metadata: {
            success: event.success,
            errorCode: event.errorCode,
            errorMessage: event.errorMessage,
            originalTenantId: event.tenantId, // Store the original tenantId (which may be null)
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
   * Log tenant-less user registration with email/password
   */
  async logTenantLessRegistration(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logTenantManagementEvent({
      userId,
      tenantId: null,
      action: 'tenant_less_registration',
      authMethod: 'password',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata: {
        registrationMethod: 'email_password',
        ...metadata,
      },
    });
  }

  /**
   * Log tenant-less user registration with Google OAuth
   */
  async logTenantLessGoogleRegistration(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logTenantManagementEvent({
      userId,
      tenantId: null,
      action: 'tenant_less_google_registration',
      authMethod: 'google',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata: {
        registrationMethod: 'google_oauth',
        ...metadata,
      },
    });
  }

  /**
   * Log tenant-less user login with email/password
   */
  async logTenantLessLogin(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logTenantManagementEvent({
      userId,
      tenantId: null,
      action: 'tenant_less_login',
      authMethod: 'password',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata: {
        loginMethod: 'email_password',
        ...metadata,
      },
    });
  }

  /**
   * Log tenant-less user login with Google OAuth
   */
  async logTenantLessGoogleLogin(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logTenantManagementEvent({
      userId,
      tenantId: null,
      action: 'tenant_less_google_login',
      authMethod: 'google',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata: {
        loginMethod: 'google_oauth',
        ...metadata,
      },
    });
  }

  /**
   * Log tenant creation by tenant-less user
   */
  async logTenantCreation(
    userId: string,
    tenantId: string,
    tenantName: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logTenantManagementEvent({
      userId,
      tenantId,
      action: 'tenant_creation',
      authMethod: 'password', // Default, could be either
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata: {
        tenantName,
        operation: 'create_tenant',
        ...metadata,
      },
    });
  }

  /**
   * Log tenant joining by tenant-less user
   */
  async logTenantJoining(
    userId: string,
    tenantId: string,
    invitationId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logTenantManagementEvent({
      userId,
      tenantId,
      action: 'tenant_joining',
      authMethod: 'invitation',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata: {
        invitationId,
        operation: 'join_tenant',
        ...metadata,
      },
    });
  }

  /**
   * Log invitation acceptance by tenant-less user
   */
  async logInvitationAcceptance(
    userId: string,
    tenantId: string,
    invitationId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logTenantManagementEvent({
      userId,
      tenantId,
      action: 'invitation_acceptance',
      authMethod: 'invitation',
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata: {
        invitationId,
        operation: 'accept_invitation',
        ...metadata,
      },
    });
  }

  /**
   * Log tenant status check by user
   */
  async logTenantStatusCheck(
    userId: string,
    tenantId: string | null,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logTenantManagementEvent({
      userId,
      tenantId,
      action: 'tenant_status_check',
      authMethod: 'password', // Default
      success,
      ipAddress,
      userAgent,
      metadata: {
        operation: 'get_tenant_status',
        ...metadata,
      },
    });
  }

  /**
   * Log rate limit exceeded events
   */
  async logRateLimitExceeded(
    userId: string,
    operation: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logTenantManagementEvent({
      userId,
      tenantId: null,
      action: 'tenant_management_rate_limit_exceeded',
      authMethod: 'password', // Default
      success: false,
      ipAddress,
      userAgent,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      errorMessage: `Rate limit exceeded for ${operation} operation`,
      metadata: {
        operation,
        rateLimitType: 'tenant_management',
        ...metadata,
      },
    });
  }

  /**
   * Query tenant management audit logs for a user
   */
  async getUserTenantManagementAuditLogs(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    return this.prisma.notificationAuditLog.findMany({
      where: {
        userId,
        action: {
          in: [
            'tenant_less_registration',
            'tenant_less_google_registration',
            'tenant_less_login',
            'tenant_less_google_login',
            'tenant_creation',
            'tenant_joining',
            'invitation_acceptance',
            'tenant_status_check',
            'tenant_management_rate_limit_exceeded',
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
        tenantId: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      } as any,
    });
  }

  /**
   * Query tenant management audit logs for a tenant
   */
  async getTenantManagementAuditLogs(
    tenantId: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    return this.prisma.notificationAuditLog.findMany({
      where: {
        tenantId,
        action: {
          in: [
            'tenant_creation',
            'tenant_joining',
            'invitation_acceptance',
            'tenant_status_check',
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
      } as any,
    });
  }

  /**
   * Query all tenant-less user activities (for admin monitoring)
   */
  async getTenantLessUserActivities(limit: number = 100, offset: number = 0) {
    return this.prisma.notificationAuditLog.findMany({
      where: {
        tenantId: 'system-audit',
        action: {
          in: [
            'tenant_less_registration',
            'tenant_less_google_registration',
            'tenant_less_login',
            'tenant_less_google_login',
            'tenant_management_rate_limit_exceeded',
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
      } as any,
    });
  }

  /**
   * Get audit statistics for tenant management operations
   */
  async getTenantManagementAuditStats(
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    eventsByAction: Record<string, number>;
    eventsByAuthMethod: Record<string, number>;
  }> {
    const whereClause: any = {
      action: {
        in: [
          'tenant_less_registration',
          'tenant_less_google_registration',
          'tenant_less_login',
          'tenant_less_google_login',
          'tenant_creation',
          'tenant_joining',
          'invitation_acceptance',
          'tenant_status_check',
          'tenant_management_rate_limit_exceeded',
        ],
      },
    };

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = startDate;
      if (endDate) whereClause.createdAt.lte = endDate;
    }

    const logs = await this.prisma.notificationAuditLog.findMany({
      where: whereClause,
      select: {
        action: true,
        authMethod: true,
        metadata: true,
      } as any,
    });

    const totalEvents = logs.length;
    const successfulEvents = logs.filter(
      (log) => (log.metadata as any)?.success === true,
    ).length;
    const failedEvents = totalEvents - successfulEvents;

    const eventsByAction: Record<string, number> = {};
    const eventsByAuthMethod: Record<string, number> = {};

    logs.forEach((log) => {
      // Count by action
      eventsByAction[log.action] = (eventsByAction[log.action] || 0) + 1;

      // Count by auth method
      const authMethod = (log as any).authMethod || 'unknown';
      eventsByAuthMethod[authMethod] =
        (eventsByAuthMethod[authMethod] || 0) + 1;
    });

    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      eventsByAction,
      eventsByAuthMethod,
    };
  }
}
