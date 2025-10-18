import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { InvitationAuditService } from './invitation-audit.service';
import { InvitationStatus } from '../enums/invitation-status.enum';

/**
 * Service for managing invitation status tracking and automated cleanup
 * Requirements: 3.3, 5.1, 5.5
 */
@Injectable()
export class InvitationStatusService {
  private readonly logger = new Logger(InvitationStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: InvitationAuditService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Updates invitation status to accepted
   * Requirements: 3.3, 5.1
   */
  async markAsAccepted(invitationId: string, userId?: string): Promise<void> {
    await (this.prisma as any).tenantInvitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    await this.auditService.logInvitationAccepted(
      invitationId,
      userId,
      undefined,
      undefined,
      {
        statusChange: 'PENDING -> ACCEPTED',
        timestamp: new Date().toISOString(),
      },
    );

    this.logger.log(`Invitation ${invitationId} marked as accepted`);
  }

  /**
   * Updates invitation status to cancelled
   * Requirements: 3.3, 5.1
   */
  async markAsCancelled(invitationId: string, userId?: string): Promise<void> {
    await (this.prisma as any).tenantInvitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await this.auditService.logInvitationCancelled(
      invitationId,
      userId,
      undefined,
      undefined,
      {
        statusChange: 'PENDING -> CANCELLED',
        timestamp: new Date().toISOString(),
      },
    );

    this.logger.log(`Invitation ${invitationId} marked as cancelled`);
  }

  /**
   * Updates invitation status to expired
   * Requirements: 3.3, 5.1
   */
  async markAsExpired(invitationId: string): Promise<void> {
    await (this.prisma as any).tenantInvitation.update({
      where: { id: invitationId },
      data: {
        status: InvitationStatus.EXPIRED,
      },
    });

    await this.auditService.logInvitationExpired(invitationId, {
      statusChange: 'PENDING -> EXPIRED',
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Invitation ${invitationId} marked as expired`);
  }

  /**
   * Checks for expired invitations and updates their status
   * Runs every hour to check for expired invitations
   * Requirements: 3.3, 5.1
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredInvitations(): Promise<void> {
    this.logger.log('Starting expired invitations check');

    try {
      const now = new Date();

      // Find all pending invitations that have expired
      const expiredInvitations = await (
        this.prisma as any
      ).tenantInvitation.findMany({
        where: {
          status: InvitationStatus.PENDING,
          expiresAt: {
            lte: now,
          },
        },
        select: {
          id: true,
          email: true,
          tenantId: true,
          expiresAt: true,
        },
      });

      if (expiredInvitations.length === 0) {
        this.logger.log('No expired invitations found');
        return;
      }

      this.logger.log(`Found ${expiredInvitations.length} expired invitations`);

      // Update all expired invitations in batch
      const updateResult = await (
        this.prisma as any
      ).tenantInvitation.updateMany({
        where: {
          id: {
            in: expiredInvitations.map((inv: any) => inv.id),
          },
        },
        data: {
          status: InvitationStatus.EXPIRED,
        },
      });

      // Log each expiration for audit trail
      for (const invitation of expiredInvitations) {
        await this.auditService.logInvitationExpired(invitation.id, {
          statusChange: 'PENDING -> EXPIRED',
          expiredAt: invitation.expiresAt.toISOString(),
          checkedAt: now.toISOString(),
          email: invitation.email,
          tenantId: invitation.tenantId,
        });
      }

      this.logger.log(`Successfully expired ${updateResult.count} invitations`);
    } catch (error) {
      this.logger.error('Error checking expired invitations:', error);
    }
  }

  /**
   * Cleans up old invitations based on retention policy
   * Runs daily at 3 AM to clean up old invitations
   * Requirements: 5.5
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldInvitations(): Promise<void> {
    this.logger.log('Starting invitation cleanup');

    try {
      const retentionDays = this.configService.get<number>(
        'INVITATION_RETENTION_DAYS',
        90,
      );
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Find invitations to be cleaned up
      const invitationsToCleanup = await (
        this.prisma as any
      ).tenantInvitation.findMany({
        where: {
          OR: [
            {
              status: InvitationStatus.ACCEPTED,
              acceptedAt: {
                lte: cutoffDate,
              },
            },
            {
              status: InvitationStatus.EXPIRED,
              createdAt: {
                lte: cutoffDate,
              },
            },
            {
              status: InvitationStatus.CANCELLED,
              cancelledAt: {
                lte: cutoffDate,
              },
            },
          ],
        },
        select: {
          id: true,
          status: true,
          email: true,
          tenantId: true,
          createdAt: true,
          acceptedAt: true,
          cancelledAt: true,
        },
      });

      if (invitationsToCleanup.length === 0) {
        this.logger.log('No old invitations to cleanup');
        return;
      }

      this.logger.log(
        `Found ${invitationsToCleanup.length} invitations to cleanup`,
      );

      // Delete invitation role assignments first (due to foreign key constraints)
      await (this.prisma as any).tenantInvitationRole.deleteMany({
        where: {
          invitationId: {
            in: invitationsToCleanup.map((inv: any) => inv.id),
          },
        },
      });

      // Delete audit logs for these invitations
      await (this.prisma as any).invitationAuditLog.deleteMany({
        where: {
          invitationId: {
            in: invitationsToCleanup.map((inv: any) => inv.id),
          },
        },
      });

      // Delete the invitations
      const deleteResult = await (
        this.prisma as any
      ).tenantInvitation.deleteMany({
        where: {
          id: {
            in: invitationsToCleanup.map((inv: any) => inv.id),
          },
        },
      });

      this.logger.log(
        `Successfully cleaned up ${deleteResult.count} old invitations`,
      );

      // Log cleanup activity
      for (const invitation of invitationsToCleanup) {
        await this.auditService.logInvitationCleanup(
          invitation.id,
          undefined,
          undefined,
          undefined,
          {
            cleanupReason: 'retention_policy',
            retentionDays,
            status: invitation.status,
            email: invitation.email,
            tenantId: invitation.tenantId,
            createdAt: invitation.createdAt.toISOString(),
            cleanedAt: new Date().toISOString(),
          },
        );
      }
    } catch (error) {
      this.logger.error('Error during invitation cleanup:', error);
    }
  }

  /**
   * Gets invitation statistics for a tenant
   * Requirements: 5.1
   */
  async getInvitationStatistics(tenantId: string): Promise<{
    total: number;
    pending: number;
    accepted: number;
    expired: number;
    cancelled: number;
    recentActivity: {
      last24Hours: number;
      last7Days: number;
      last30Days: number;
    };
  }> {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get status counts
    const statusCounts = await (this.prisma as any).tenantInvitation.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: {
        id: true,
      },
    });

    // Get recent activity counts
    const [recent24h, recent7d, recent30d] = await Promise.all([
      (this.prisma as any).tenantInvitation.count({
        where: {
          tenantId,
          createdAt: { gte: last24Hours },
        },
      }),
      (this.prisma as any).tenantInvitation.count({
        where: {
          tenantId,
          createdAt: { gte: last7Days },
        },
      }),
      (this.prisma as any).tenantInvitation.count({
        where: {
          tenantId,
          createdAt: { gte: last30Days },
        },
      }),
    ]);

    // Transform status counts into a more usable format
    const stats = {
      total: 0,
      pending: 0,
      accepted: 0,
      expired: 0,
      cancelled: 0,
    };

    statusCounts.forEach(({ status, _count }: any) => {
      stats.total += _count.id;
      stats[status.toLowerCase() as keyof typeof stats] = _count.id;
    });

    return {
      ...stats,
      recentActivity: {
        last24Hours: recent24h,
        last7Days: recent7d,
        last30Days: recent30d,
      },
    };
  }

  /**
   * Forces expiration check for a specific invitation
   * Requirements: 3.3
   */
  async checkInvitationExpiration(invitationId: string): Promise<boolean> {
    const invitation = await (this.prisma as any).tenantInvitation.findUnique({
      where: { id: invitationId },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!invitation) {
      return false;
    }

    if (
      invitation.status === InvitationStatus.PENDING &&
      invitation.expiresAt <= new Date()
    ) {
      await this.markAsExpired(invitationId);
      return true;
    }

    return false;
  }

  /**
   * Gets cleanup statistics
   * Requirements: 5.5
   */
  async getCleanupStatistics(): Promise<{
    eligibleForCleanup: number;
    lastCleanupRun?: Date;
    retentionDays: number;
  }> {
    const retentionDays = this.configService.get<number>(
      'INVITATION_RETENTION_DAYS',
      90,
    );
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const eligibleForCleanup = await (
      this.prisma as any
    ).tenantInvitation.count({
      where: {
        OR: [
          {
            status: InvitationStatus.ACCEPTED,
            acceptedAt: {
              lte: cutoffDate,
            },
          },
          {
            status: InvitationStatus.EXPIRED,
            createdAt: {
              lte: cutoffDate,
            },
          },
          {
            status: InvitationStatus.CANCELLED,
            cancelledAt: {
              lte: cutoffDate,
            },
          },
        ],
      },
    });

    // Try to get the last cleanup run from audit logs
    const lastCleanupLog = await (
      this.prisma as any
    ).invitationAuditLog.findFirst({
      where: {
        action: 'invitation_cleanup',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    return {
      eligibleForCleanup,
      lastCleanupRun: lastCleanupLog?.createdAt,
      retentionDays,
    };
  }
}
