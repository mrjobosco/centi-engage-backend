import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

export interface InvitationAuditEvent {
  invitationId: string;
  action:
  | 'invitation_created'
  | 'invitation_sent'
  | 'invitation_resent'
  | 'invitation_cancelled'
  | 'invitation_accepted'
  | 'invitation_expired'
  | 'invitation_validated'
  | 'invitation_validation_failed'
  | 'invitation_rate_limit_exceeded'
  | 'invitation_cleanup';
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Service for comprehensive invitation audit logging
 * Tracks all invitation operations for security and compliance
 */
@Injectable()
export class InvitationAuditService {
  private readonly logger = new Logger(InvitationAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  /**
   * Log invitation events to both application logs and database
   */
  async logInvitationEvent(event: InvitationAuditEvent): Promise<void> {
    try {
      // Log to application logs for immediate visibility
      const logData = {
        event: 'invitation_audit',
        invitation_id: event.invitationId,
        action: event.action,
        user_id: event.userId,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        success: event.success,
        error_code: event.errorCode,
        error_message: event.errorMessage,
        timestamp: new Date().toISOString(),
        tenant_id: this.tenantContext.getTenantId(),
        ...event.metadata,
      };

      if (event.success) {
        this.logger.log(logData);
      } else {
        this.logger.warn(logData);
      }

      // Create database audit log entry
      await this.createDatabaseAuditLog(event);
    } catch (error) {
      // Don't let audit logging failures break the main flow
      this.logger.error('Failed to log invitation event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event: event.action,
        invitationId: event.invitationId,
        userId: event.userId,
      });
    }
  }

  /**
   * Create a database audit log entry
   */
  private async createDatabaseAuditLog(
    event: InvitationAuditEvent,
  ): Promise<void> {
    try {
      await this.prisma.invitationAuditLog.create({
        data: {
          invitationId: event.invitationId,
          action: event.action,
          userId: event.userId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          metadata: {
            success: event.success,
            errorCode: event.errorCode,
            errorMessage: event.errorMessage,
            tenantId: this.tenantContext.getTenantId(),
            ...event.metadata,
          },
        },
      });

      this.logger.debug(
        `Created audit log for invitation ${event.invitationId}, action: ${event.action}`,
      );
    } catch (error) {
      this.logger.error('Failed to create database audit log', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event: event.action,
        invitationId: event.invitationId,
        userId: event.userId,
      });
    }
  }

  /**
   * Log invitation creation
   */
  async logInvitationCreated(
    invitationId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logInvitationEvent({
      invitationId,
      action: 'invitation_created',
      userId,
      ipAddress,
      userAgent,
      success: true,
      metadata,
    });
  }

  /**
   * Log invitation email sent
   */
  async logInvitationSent(
    invitationId: string,
    userId: string,
    success: boolean,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logInvitationEvent({
      invitationId,
      action: 'invitation_sent',
      userId,
      success,
      errorCode,
      errorMessage,
      metadata,
    });
  }

  /**
   * Log invitation resent
   */
  async logInvitationResent(
    invitationId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
    success: boolean = true,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logInvitationEvent({
      invitationId,
      action: 'invitation_resent',
      userId,
      ipAddress,
      userAgent,
      success,
      errorCode,
      errorMessage,
      metadata,
    });
  }

  /**
   * Log invitation cancellation
   */
  async logInvitationCancelled(
    invitationId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logInvitationEvent({
      invitationId,
      action: 'invitation_cancelled',
      userId,
      ipAddress,
      userAgent,
      success: true,
      metadata,
    });
  }

  /**
   * Log invitation acceptance
   */
  async logInvitationAccepted(
    invitationId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logInvitationEvent({
      invitationId,
      action: 'invitation_accepted',
      userId,
      ipAddress,
      userAgent,
      success: true,
      metadata,
    });
  }

  /**
   * Log invitation expiration
   */
  async logInvitationExpired(
    invitationId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logInvitationEvent({
      invitationId,
      action: 'invitation_expired',
      success: true,
      metadata,
    });
  }

  /**
   * Log invitation validation attempt
   */
  async logInvitationValidated(
    invitationId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logInvitationEvent({
      invitationId,
      action: success ? 'invitation_validated' : 'invitation_validation_failed',
      ipAddress,
      userAgent,
      success,
      errorCode,
      errorMessage,
      metadata,
    });
  }

  /**
   * Log rate limit exceeded events
   */
  async logRateLimitExceeded(
    invitationId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logInvitationEvent({
      invitationId,
      action: 'invitation_rate_limit_exceeded',
      userId,
      ipAddress,
      userAgent,
      success: false,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      errorMessage: 'Rate limit exceeded for invitation operation',
      metadata,
    });
  }

  /**
   * Log security events (failed validations, suspicious activity)
   */
  async logSecurityEvent(
    invitationId: string,
    securityEvent: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logInvitationEvent({
      invitationId,
      action: 'invitation_validation_failed',
      ipAddress,
      userAgent,
      success: false,
      errorCode: 'SECURITY_EVENT',
      errorMessage: securityEvent,
      metadata: {
        securityEvent,
        ...metadata,
      },
    });
  }

  /**
   * Get audit logs for a specific invitation
   */
  async getInvitationAuditLogs(
    invitationId: string,
    limit: number = 50,
  ): Promise<any[]> {
    try {
      return await this.prisma.invitationAuditLog.findMany({
        where: {
          invitationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
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
      });
    } catch (error) {
      this.logger.error(
        `Failed to get audit logs for invitation ${invitationId}`,
        error instanceof Error ? error.stack : error,
      );
      return [];
    }
  }

  /**
   * Get audit logs for a tenant (admin view)
   */
  async getTenantInvitationAuditLogs(
    tenantId: string,
    limit: number = 100,
    offset: number = 0,
    action?: string,
  ): Promise<any[]> {
    try {
      const whereClause: any = {
        invitation: {
          tenantId,
        },
      };

      if (action) {
        whereClause.action = action;
      }

      return await this.prisma.invitationAuditLog.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
        include: {
          invitation: {
            select: {
              id: true,
              email: true,
              status: true,
              createdAt: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to get tenant audit logs for tenant ${tenantId}`,
        error instanceof Error ? error.stack : error,
      );
      return [];
    }
  }

  /**
   * Get security events for monitoring
   */
  async getSecurityEvents(
    tenantId?: string,
    limit: number = 100,
    hoursBack: number = 24,
  ): Promise<any[]> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

      const whereClause: any = {
        action: {
          in: [
            'invitation_validation_failed',
            'invitation_rate_limit_exceeded',
          ],
        },
        createdAt: {
          gte: cutoffTime,
        },
      };

      if (tenantId) {
        whereClause.invitation = {
          tenantId,
        };
      }

      return await this.prisma.invitationAuditLog.findMany({
        where: whereClause,
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        include: {
          invitation: {
            select: {
              id: true,
              email: true,
              tenantId: true,
              status: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to get security events',
        error instanceof Error ? error.stack : error,
      );
      return [];
    }
  }

  /**
   * Get audit statistics for a tenant
   */
  async getAuditStatistics(
    tenantId: string,
    daysBack: number = 30,
  ): Promise<{
    totalEvents: number;
    eventsByAction: Record<string, number>;
    securityEvents: number;
    successRate: number;
  }> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - daysBack);

      const auditLogs = await this.prisma.invitationAuditLog.findMany({
        where: {
          invitation: {
            tenantId,
          },
          createdAt: {
            gte: cutoffTime,
          },
        },
        select: {
          action: true,
          metadata: true,
        },
      });

      const totalEvents = auditLogs.length;
      const eventsByAction: Record<string, number> = {};
      let securityEvents = 0;
      let successfulEvents = 0;

      auditLogs.forEach((log) => {
        eventsByAction[log.action] = (eventsByAction[log.action] || 0) + 1;

        if (
          log.action === 'invitation_validation_failed' ||
          log.action === 'invitation_rate_limit_exceeded'
        ) {
          securityEvents++;
        }

        const metadata = log.metadata as Record<string, any>;
        if (
          metadata &&
          typeof metadata === 'object' &&
          metadata.success === true
        ) {
          successfulEvents++;
        }
      });

      const successRate =
        totalEvents > 0 ? (successfulEvents / totalEvents) * 100 : 100;

      return {
        totalEvents,
        eventsByAction,
        securityEvents,
        successRate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get audit statistics for tenant ${tenantId}`,
        error instanceof Error ? error.stack : error,
      );
      return {
        totalEvents: 0,
        eventsByAction: {},
        securityEvents: 0,
        successRate: 100,
      };
    }
  }

  /**
   * Log invitation cleanup
   */
  async logInvitationCleanup(
    invitationId: string,
    userId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logInvitationEvent({
      invitationId,
      action: 'invitation_cleanup',
      userId,
      ipAddress,
      userAgent,
      success: true,
      metadata,
    });
  }

  /**
   * Clean up old audit logs (called by scheduled task)
   */
  async cleanupOldAuditLogs(retentionDays: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.prisma.invitationAuditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(
        `Cleaned up ${result.count} old invitation audit log entries`,
      );

      return result.count;
    } catch (error) {
      this.logger.error(
        'Failed to cleanup old invitation audit logs',
        error instanceof Error ? error.stack : error,
      );
      return 0;
    }
  }
}
