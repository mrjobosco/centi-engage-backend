import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { InvitationAuditService } from './invitation-audit.service';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { InvitationStatus } from '../enums/invitation-status.enum';
import { TenantInvitationWithRelations } from '../interfaces';

export interface BulkInvitationDto {
  emails: string[];
  roleIds: string[];
  expiresAt?: Date;
  message?: string;
}

export interface BulkInvitationResult {
  successful: Array<{
    email: string;
    invitationId: string;
  }>;
  failed: Array<{
    email: string;
    error: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface InvitationReport {
  tenantId: string;
  generatedAt: Date;
  summary: {
    total: number;
    pending: number;
    accepted: number;
    expired: number;
    cancelled: number;
  };
  invitations: Array<{
    id: string;
    email: string;
    status: string;
    createdAt: Date;
    expiresAt: Date;
    acceptedAt?: Date;
    cancelledAt?: Date;
    inviterEmail: string;
    roles: string[];
  }>;
}

export interface InvitationStatistics {
  overview: {
    total: number;
    pending: number;
    accepted: number;
    expired: number;
    cancelled: number;
  };
  trends: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
  acceptanceRate: {
    overall: number;
    last30Days: number;
  };
  topInviters: Array<{
    inviterEmail: string;
    invitationCount: number;
  }>;
  roleDistribution: Array<{
    roleName: string;
    count: number;
  }>;
  expirationAnalysis: {
    expiringSoon: number; // within 24 hours
    expiredRecently: number; // within last 7 days
  };
}

/**
 * Service for invitation management utilities including bulk operations,
 * statistics, and reporting capabilities
 * Requirements: 5.1, 5.4
 */
@Injectable()
export class InvitationManagementService {
  private readonly logger = new Logger(InvitationManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: InvitationAuditService,
    private readonly invitationService: InvitationService,
  ) {}

  /**
   * Creates multiple invitations in bulk
   * Requirements: 5.1
   */
  async createBulkInvitations(
    tenantId: string,
    invitedBy: string,
    bulkDto: BulkInvitationDto,
  ): Promise<BulkInvitationResult> {
    this.logger.log(
      `Creating bulk invitations for ${bulkDto.emails.length} emails`,
    );

    const result: BulkInvitationResult = {
      successful: [],
      failed: [],
      summary: {
        total: bulkDto.emails.length,
        successful: 0,
        failed: 0,
      },
    };

    // Validate email list
    if (bulkDto.emails.length === 0) {
      throw new BadRequestException('Email list cannot be empty');
    }

    if (bulkDto.emails.length > 100) {
      throw new BadRequestException(
        'Cannot create more than 100 invitations at once',
      );
    }

    // Remove duplicates and validate email formats
    const uniqueEmails = [
      ...new Set(bulkDto.emails.map((email) => email.toLowerCase().trim())),
    ];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const email of uniqueEmails) {
      try {
        if (!emailRegex.test(email)) {
          result.failed.push({
            email,
            error: 'Invalid email format',
          });
          continue;
        }

        const invitationDto: CreateInvitationDto = {
          email,
          roleIds: bulkDto.roleIds,
          expiresAt: bulkDto.expiresAt,
          message: bulkDto.message,
        };

        const invitation = await this.invitationService.createInvitation(
          tenantId,
          invitedBy,
          invitationDto,
        );

        result.successful.push({
          email,
          invitationId: invitation.id,
        });
      } catch (error) {
        result.failed.push({
          email,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    // Log bulk operation
    await this.auditService.logInvitationEvent({
      invitationId: 'bulk-operation',
      action: 'invitation_created',
      userId: invitedBy,
      success: true,
      metadata: {
        bulkOperation: true,
        totalEmails: bulkDto.emails.length,
        successful: result.summary.successful,
        failed: result.summary.failed,
        tenantId,
      },
    });

    this.logger.log(
      `Bulk invitation completed: ${result.summary.successful} successful, ${result.summary.failed} failed`,
    );

    return result;
  }

  /**
   * Cancels multiple invitations in bulk
   * Requirements: 5.1
   */
  async cancelBulkInvitations(
    tenantId: string,
    invitationIds: string[],
    userId: string,
  ): Promise<BulkInvitationResult> {
    this.logger.log(`Cancelling ${invitationIds.length} invitations in bulk`);

    const result: BulkInvitationResult = {
      successful: [],
      failed: [],
      summary: {
        total: invitationIds.length,
        successful: 0,
        failed: 0,
      },
    };

    if (invitationIds.length === 0) {
      throw new BadRequestException('Invitation ID list cannot be empty');
    }

    if (invitationIds.length > 50) {
      throw new BadRequestException(
        'Cannot cancel more than 50 invitations at once',
      );
    }

    for (const invitationId of invitationIds) {
      try {
        await this.invitationService.cancelInvitation(invitationId, tenantId);

        // Get invitation email for result
        const invitation = await (
          this.prisma as any
        ).tenantInvitation.findUnique({
          where: { id: invitationId },
          select: { email: true },
        });

        result.successful.push({
          email: invitation?.email || 'unknown',
          invitationId,
        });
      } catch (error) {
        result.failed.push({
          email: 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    // Log bulk cancellation
    await this.auditService.logInvitationEvent({
      invitationId: 'bulk-operation',
      action: 'invitation_cancelled',
      userId,
      success: true,
      metadata: {
        bulkOperation: true,
        totalInvitations: invitationIds.length,
        successful: result.summary.successful,
        failed: result.summary.failed,
        tenantId,
      },
    });

    this.logger.log(
      `Bulk cancellation completed: ${result.summary.successful} successful, ${result.summary.failed} failed`,
    );

    return result;
  }

  /**
   * Resends multiple invitations in bulk
   * Requirements: 5.1
   */
  async resendBulkInvitations(
    tenantId: string,
    invitationIds: string[],
    userId: string,
  ): Promise<BulkInvitationResult> {
    this.logger.log(`Resending ${invitationIds.length} invitations in bulk`);

    const result: BulkInvitationResult = {
      successful: [],
      failed: [],
      summary: {
        total: invitationIds.length,
        successful: 0,
        failed: 0,
      },
    };

    if (invitationIds.length === 0) {
      throw new BadRequestException('Invitation ID list cannot be empty');
    }

    if (invitationIds.length > 50) {
      throw new BadRequestException(
        'Cannot resend more than 50 invitations at once',
      );
    }

    for (const invitationId of invitationIds) {
      try {
        await this.invitationService.resendInvitation(invitationId, tenantId);

        // Get invitation email for result
        const invitation = await (
          this.prisma as any
        ).tenantInvitation.findUnique({
          where: { id: invitationId },
          select: { email: true },
        });

        result.successful.push({
          email: invitation?.email || 'unknown',
          invitationId,
        });
      } catch (error) {
        result.failed.push({
          email: 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    result.summary.successful = result.successful.length;
    result.summary.failed = result.failed.length;

    // Log bulk resend
    await this.auditService.logInvitationEvent({
      invitationId: 'bulk-operation',
      action: 'invitation_resent',
      userId,
      success: true,
      metadata: {
        bulkOperation: true,
        totalInvitations: invitationIds.length,
        successful: result.summary.successful,
        failed: result.summary.failed,
        tenantId,
      },
    });

    this.logger.log(
      `Bulk resend completed: ${result.summary.successful} successful, ${result.summary.failed} failed`,
    );

    return result;
  }

  /**
   * Generates comprehensive invitation statistics for a tenant
   * Requirements: 5.1, 5.4
   */
  async getInvitationStatistics(
    tenantId: string,
  ): Promise<InvitationStatistics> {
    this.logger.log(`Generating invitation statistics for tenant ${tenantId}`);

    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get overview statistics
    const statusCounts = await (this.prisma as any).tenantInvitation.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });

    const overview = {
      total: 0,
      pending: 0,
      accepted: 0,
      expired: 0,
      cancelled: 0,
    };

    statusCounts.forEach(({ status, _count }) => {
      overview.total += _count.id;
      overview[status.toLowerCase() as keyof typeof overview] = _count.id;
    });

    // Get trend data
    const [recent24h, recent7d, recent30d] = await Promise.all([
      (this.prisma as any).tenantInvitation.count({
        where: { tenantId, createdAt: { gte: last24Hours } },
      }),
      this.prisma.tenantInvitation.count({
        where: { tenantId, createdAt: { gte: last7Days } },
      }),
      this.prisma.tenantInvitation.count({
        where: { tenantId, createdAt: { gte: last30Days } },
      }),
    ]);

    // Calculate acceptance rates
    const [totalAccepted, acceptedLast30Days, totalSent, sentLast30Days] =
      await Promise.all([
        this.prisma.tenantInvitation.count({
          where: { tenantId, status: InvitationStatus.ACCEPTED },
        }),
        this.prisma.tenantInvitation.count({
          where: {
            tenantId,
            status: InvitationStatus.ACCEPTED,
            acceptedAt: { gte: last30Days },
          },
        }),
        this.prisma.tenantInvitation.count({
          where: { tenantId },
        }),
        this.prisma.tenantInvitation.count({
          where: { tenantId, createdAt: { gte: last30Days } },
        }),
      ]);

    const acceptanceRate = {
      overall: totalSent > 0 ? (totalAccepted / totalSent) * 100 : 0,
      last30Days:
        sentLast30Days > 0 ? (acceptedLast30Days / sentLast30Days) * 100 : 0,
    };

    // Get top inviters
    const topInviters = await this.prisma.tenantInvitation.groupBy({
      by: ['invitedBy'],
      where: { tenantId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const topInvitersWithEmails = await Promise.all(
      topInviters.map(async ({ invitedBy, _count }) => {
        const user = await this.prisma.user.findUnique({
          where: { id: invitedBy },
          select: { email: true },
        });
        return {
          inviterEmail: user?.email || 'Unknown',
          invitationCount: _count.id,
        };
      }),
    );

    // Get role distribution
    const roleDistribution = await this.prisma.tenantInvitationRole.groupBy({
      by: ['roleId'],
      where: {
        invitation: { tenantId },
      },
      _count: { roleId: true },
      orderBy: { _count: { roleId: 'desc' } },
      take: 10,
    });

    const roleDistributionWithNames = await Promise.all(
      roleDistribution.map(async ({ roleId, _count }) => {
        const role = await this.prisma.role.findUnique({
          where: { id: roleId },
          select: { name: true },
        });
        return {
          roleName: role?.name || 'Unknown',
          count: _count.roleId,
        };
      }),
    );

    // Get expiration analysis
    const [expiringSoon, expiredRecently] = await Promise.all([
      this.prisma.tenantInvitation.count({
        where: {
          tenantId,
          status: InvitationStatus.PENDING,
          expiresAt: { lte: next24Hours, gte: now },
        },
      }),
      this.prisma.tenantInvitation.count({
        where: {
          tenantId,
          status: InvitationStatus.EXPIRED,
          expiresAt: { gte: last7Days },
        },
      }),
    ]);

    return {
      overview,
      trends: {
        last24Hours: recent24h,
        last7Days: recent7d,
        last30Days: recent30d,
      },
      acceptanceRate,
      topInviters: topInvitersWithEmails,
      roleDistribution: roleDistributionWithNames,
      expirationAnalysis: {
        expiringSoon,
        expiredRecently,
      },
    };
  }

  /**
   * Generates a comprehensive invitation report for export
   * Requirements: 5.4
   */
  async generateInvitationReport(
    tenantId: string,
    options: {
      status?: InvitationStatus;
      startDate?: Date;
      endDate?: Date;
      includeExpired?: boolean;
    } = {},
  ): Promise<InvitationReport> {
    this.logger.log(`Generating invitation report for tenant ${tenantId}`);

    const { status, startDate, endDate, includeExpired = true } = options;

    // Build where clause
    const where: any = { tenantId };

    if (status) {
      where.status = status;
    }

    if (!includeExpired) {
      where.status = { not: InvitationStatus.EXPIRED };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    // Get invitations with all related data
    const invitations = await this.prisma.tenantInvitation.findMany({
      where,
      include: {
        inviter: {
          select: { email: true },
        },
        roles: {
          include: {
            role: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get summary statistics
    const statusCounts = await this.prisma.tenantInvitation.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const summary = {
      total: 0,
      pending: 0,
      accepted: 0,
      expired: 0,
      cancelled: 0,
    };

    statusCounts.forEach(({ status, _count }) => {
      summary.total += _count.id;
      summary[status.toLowerCase() as keyof typeof summary] = _count.id;
    });

    // Transform invitations for report
    const reportInvitations = invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      cancelledAt: invitation.cancelledAt,
      inviterEmail: invitation.inviter.email,
      roles: invitation.roles.map((r) => r.role.name),
    }));

    return {
      tenantId,
      generatedAt: new Date(),
      summary,
      invitations: reportInvitations,
    };
  }

  /**
   * Exports invitation report as CSV format
   * Requirements: 5.4
   */
  async exportInvitationReportAsCSV(
    tenantId: string,
    options: {
      status?: InvitationStatus;
      startDate?: Date;
      endDate?: Date;
      includeExpired?: boolean;
    } = {},
  ): Promise<string> {
    const report = await this.generateInvitationReport(tenantId, options);

    // CSV headers
    const headers = [
      'ID',
      'Email',
      'Status',
      'Created At',
      'Expires At',
      'Accepted At',
      'Cancelled At',
      'Inviter Email',
      'Roles',
    ];

    // Convert data to CSV rows
    const rows = report.invitations.map((invitation) => [
      invitation.id,
      invitation.email,
      invitation.status,
      invitation.createdAt.toISOString(),
      invitation.expiresAt.toISOString(),
      invitation.acceptedAt?.toISOString() || '',
      invitation.cancelledAt?.toISOString() || '',
      invitation.inviterEmail,
      invitation.roles.join('; '),
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${field}"`).join(','))
      .join('\n');

    // Log export activity
    await this.auditService.logInvitationEvent({
      invitationId: 'export-operation',
      action: 'invitation_validated', // Using existing action for export
      success: true,
      metadata: {
        exportType: 'csv',
        tenantId,
        recordCount: report.invitations.length,
        exportOptions: options,
        generatedAt: new Date().toISOString(),
      },
    });

    return csvContent;
  }

  /**
   * Gets invitation activity summary for dashboard
   * Requirements: 5.1
   */
  async getInvitationActivitySummary(tenantId: string): Promise<{
    todayStats: {
      created: number;
      accepted: number;
      expired: number;
    };
    weeklyTrend: Array<{
      date: string;
      created: number;
      accepted: number;
    }>;
    pendingActions: {
      expiringSoon: number;
      needingResend: number;
    };
  }> {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const weekAgoForResend = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Today's statistics
    const [todayCreated, todayAccepted, todayExpired] = await Promise.all([
      this.prisma.tenantInvitation.count({
        where: { tenantId, createdAt: { gte: todayStart } },
      }),
      this.prisma.tenantInvitation.count({
        where: {
          tenantId,
          status: InvitationStatus.ACCEPTED,
          acceptedAt: { gte: todayStart },
        },
      }),
      this.prisma.tenantInvitation.count({
        where: {
          tenantId,
          status: InvitationStatus.EXPIRED,
          expiresAt: { gte: todayStart, lte: now },
        },
      }),
    ]);

    // Weekly trend (last 7 days)
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      );
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const [created, accepted] = await Promise.all([
        this.prisma.tenantInvitation.count({
          where: {
            tenantId,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
        this.prisma.tenantInvitation.count({
          where: {
            tenantId,
            status: InvitationStatus.ACCEPTED,
            acceptedAt: { gte: dayStart, lt: dayEnd },
          },
        }),
      ]);

      weeklyTrend.push({
        date: dayStart.toISOString().split('T')[0],
        created,
        accepted,
      });
    }

    // Pending actions
    const [expiringSoon, needingResend] = await Promise.all([
      this.prisma.tenantInvitation.count({
        where: {
          tenantId,
          status: InvitationStatus.PENDING,
          expiresAt: { lte: next24Hours, gte: now },
        },
      }),
      this.prisma.tenantInvitation.count({
        where: {
          tenantId,
          status: InvitationStatus.PENDING,
          createdAt: { lte: weekAgoForResend },
        },
      }),
    ]);

    return {
      todayStats: {
        created: todayCreated,
        accepted: todayAccepted,
        expired: todayExpired,
      },
      weeklyTrend,
      pendingActions: {
        expiringSoon,
        needingResend,
      },
    };
  }
}
