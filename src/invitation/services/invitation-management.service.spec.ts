import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import {
  InvitationManagementService,
  BulkInvitationDto,
} from './invitation-management.service';
import { PrismaService } from '../../database/prisma.service';
import { InvitationAuditService } from './invitation-audit.service';
import { InvitationService } from './invitation.service';
import { InvitationStatus } from '../enums/invitation-status.enum';

describe('InvitationManagementService', () => {
  let service: InvitationManagementService;
  let prismaService: jest.Mocked<PrismaService>;
  let auditService: jest.Mocked<InvitationAuditService>;
  let invitationService: jest.Mocked<InvitationService>;

  const mockInvitation = {
    id: 'invitation-1',
    tenantId: 'tenant-1',
    email: 'test@example.com',
    token: 'test-token',
    invitedBy: 'user-1',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: InvitationStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    tenant: { id: 'tenant-1', name: 'Test Tenant', subdomain: 'test' },
    inviter: {
      id: 'user-1',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
    },
    roles: [{ id: 'role-1', name: 'Member' }],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      tenantInvitation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        deleteMany: jest.fn(),
      },
      tenantInvitationRole: {
        deleteMany: jest.fn(),
        groupBy: jest.fn(),
      },
      invitationAuditLog: {
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
    };

    const mockAuditService = {
      logInvitationEvent: jest.fn(),
    };

    const mockInvitationService = {
      createInvitation: jest.fn(),
      cancelInvitation: jest.fn(),
      resendInvitation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationManagementService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: InvitationAuditService,
          useValue: mockAuditService,
        },
        {
          provide: InvitationService,
          useValue: mockInvitationService,
        },
      ],
    }).compile();

    service = module.get<InvitationManagementService>(
      InvitationManagementService,
    );
    prismaService = module.get(PrismaService);
    auditService = module.get(InvitationAuditService);
    invitationService = module.get(InvitationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBulkInvitations', () => {
    const bulkDto: BulkInvitationDto = {
      emails: ['test1@example.com', 'test2@example.com', 'test3@example.com'],
      roleIds: ['role-1', 'role-2'],
      message: 'Welcome to our team!',
    };

    it('should create multiple invitations successfully', async () => {
      invitationService.createInvitation
        .mockResolvedValueOnce({
          ...mockInvitation,
          id: 'invitation-1',
          email: 'test1@example.com',
        })
        .mockResolvedValueOnce({
          ...mockInvitation,
          id: 'invitation-2',
          email: 'test2@example.com',
        })
        .mockResolvedValueOnce({
          ...mockInvitation,
          id: 'invitation-3',
          email: 'test3@example.com',
        });

      const result = await service.createBulkInvitations(
        'tenant-1',
        'user-1',
        bulkDto,
      );

      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);

      expect(invitationService.createInvitation).toHaveBeenCalledTimes(3);
      expect(auditService.logInvitationEvent).toHaveBeenCalledWith({
        invitationId: 'bulk-operation',
        action: 'invitation_created',
        userId: 'user-1',
        success: true,
        metadata: {
          bulkOperation: true,
          totalEmails: 3,
          successful: 3,
          failed: 0,
          tenantId: 'tenant-1',
        },
      });
    });

    it('should handle partial failures gracefully', async () => {
      invitationService.createInvitation
        .mockResolvedValueOnce({
          ...mockInvitation,
          id: 'invitation-1',
          email: 'test1@example.com',
        })
        .mockRejectedValueOnce(new Error('Email already invited'))
        .mockResolvedValueOnce({
          ...mockInvitation,
          id: 'invitation-3',
          email: 'test3@example.com',
        });

      const result = await service.createBulkInvitations(
        'tenant-1',
        'user-1',
        bulkDto,
      );

      expect(result.summary.total).toBe(3);
      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({
        email: 'test2@example.com',
        error: 'Email already invited',
      });
    });

    it('should remove duplicate emails', async () => {
      const duplicateDto: BulkInvitationDto = {
        emails: ['test1@example.com', 'test1@example.com', 'test2@example.com'],
        roleIds: ['role-1'],
      };

      invitationService.createInvitation
        .mockResolvedValueOnce({
          ...mockInvitation,
          id: 'invitation-1',
          email: 'test1@example.com',
        })
        .mockResolvedValueOnce({
          ...mockInvitation,
          id: 'invitation-2',
          email: 'test2@example.com',
        });

      const result = await service.createBulkInvitations(
        'tenant-1',
        'user-1',
        duplicateDto,
      );

      expect(result.summary.total).toBe(3); // Original count
      expect(result.summary.successful).toBe(2); // Unique emails processed
      expect(invitationService.createInvitation).toHaveBeenCalledTimes(2);
    });

    it('should validate email formats and reject invalid ones', async () => {
      const invalidDto: BulkInvitationDto = {
        emails: ['valid@example.com', 'invalid-email', 'another@valid.com'],
        roleIds: ['role-1'],
      };

      invitationService.createInvitation
        .mockResolvedValueOnce({
          ...mockInvitation,
          id: 'invitation-1',
          email: 'valid@example.com',
        })
        .mockResolvedValueOnce({
          ...mockInvitation,
          id: 'invitation-2',
          email: 'another@valid.com',
        });

      const result = await service.createBulkInvitations(
        'tenant-1',
        'user-1',
        invalidDto,
      );

      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.failed[0]).toEqual({
        email: 'invalid-email',
        error: 'Invalid email format',
      });
    });

    it('should throw error for empty email list', async () => {
      const emptyDto: BulkInvitationDto = {
        emails: [],
        roleIds: ['role-1'],
      };

      await expect(
        service.createBulkInvitations('tenant-1', 'user-1', emptyDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for too many emails', async () => {
      const tooManyDto: BulkInvitationDto = {
        emails: Array.from({ length: 101 }, (_, i) => `test${i}@example.com`),
        roleIds: ['role-1'],
      };

      await expect(
        service.createBulkInvitations('tenant-1', 'user-1', tooManyDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelBulkInvitations', () => {
    const invitationIds = ['invitation-1', 'invitation-2', 'invitation-3'];

    it('should cancel multiple invitations successfully', async () => {
      invitationService.cancelInvitation.mockResolvedValue(mockInvitation);
      prismaService.tenantInvitation.findUnique
        .mockResolvedValueOnce({ email: 'test1@example.com' })
        .mockResolvedValueOnce({ email: 'test2@example.com' })
        .mockResolvedValueOnce({ email: 'test3@example.com' });

      const result = await service.cancelBulkInvitations(
        'tenant-1',
        invitationIds,
        'user-1',
      );

      expect(result.summary.successful).toBe(3);
      expect(result.summary.failed).toBe(0);
      expect(invitationService.cancelInvitation).toHaveBeenCalledTimes(3);
      expect(auditService.logInvitationEvent).toHaveBeenCalledWith({
        invitationId: 'bulk-operation',
        action: 'invitation_cancelled',
        userId: 'user-1',
        success: true,
        metadata: {
          bulkOperation: true,
          totalInvitations: 3,
          successful: 3,
          failed: 0,
          tenantId: 'tenant-1',
        },
      });
    });

    it('should handle partial failures in bulk cancellation', async () => {
      invitationService.cancelInvitation
        .mockResolvedValueOnce(mockInvitation)
        .mockRejectedValueOnce(new Error('Invitation not found'))
        .mockResolvedValueOnce(mockInvitation);

      prismaService.tenantInvitation.findUnique
        .mockResolvedValueOnce({ email: 'test1@example.com' })
        .mockResolvedValueOnce({ email: 'test3@example.com' });

      const result = await service.cancelBulkInvitations(
        'tenant-1',
        invitationIds,
        'user-1',
      );

      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(1);
      expect(result.failed[0].error).toBe('Invitation not found');
    });

    it('should throw error for empty invitation list', async () => {
      await expect(
        service.cancelBulkInvitations('tenant-1', [], 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for too many invitations', async () => {
      const tooMany = Array.from({ length: 51 }, (_, i) => `invitation-${i}`);

      await expect(
        service.cancelBulkInvitations('tenant-1', tooMany, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendBulkInvitations', () => {
    const invitationIds = ['invitation-1', 'invitation-2'];

    it('should resend multiple invitations successfully', async () => {
      invitationService.resendInvitation.mockResolvedValue(mockInvitation);
      prismaService.tenantInvitation.findUnique
        .mockResolvedValueOnce({ email: 'test1@example.com' })
        .mockResolvedValueOnce({ email: 'test2@example.com' });

      const result = await service.resendBulkInvitations(
        'tenant-1',
        invitationIds,
        'user-1',
      );

      expect(result.summary.successful).toBe(2);
      expect(result.summary.failed).toBe(0);
      expect(invitationService.resendInvitation).toHaveBeenCalledTimes(2);
    });
  });

  describe('getInvitationStatistics', () => {
    it('should return comprehensive invitation statistics', async () => {
      const statusCounts = [
        { status: InvitationStatus.PENDING, _count: { id: 5 } },
        { status: InvitationStatus.ACCEPTED, _count: { id: 10 } },
        { status: InvitationStatus.EXPIRED, _count: { id: 2 } },
      ];

      const topInviters = [
        { invitedBy: 'user-1', _count: { id: 8 } },
        { invitedBy: 'user-2', _count: { id: 5 } },
      ];

      const roleDistribution = [
        { roleId: 'role-1', _count: { roleId: 10 } },
        { roleId: 'role-2', _count: { roleId: 7 } },
      ];

      prismaService.tenantInvitation.groupBy
        .mockResolvedValueOnce(statusCounts)
        .mockResolvedValueOnce(topInviters);

      prismaService.tenantInvitationRole.groupBy.mockResolvedValue(
        roleDistribution,
      );

      prismaService.tenantInvitation.count
        .mockResolvedValueOnce(3) // last 24 hours
        .mockResolvedValueOnce(8) // last 7 days
        .mockResolvedValueOnce(15) // last 30 days
        .mockResolvedValueOnce(10) // total accepted
        .mockResolvedValueOnce(5) // accepted last 30 days
        .mockResolvedValueOnce(17) // total sent
        .mockResolvedValueOnce(12) // sent last 30 days
        .mockResolvedValueOnce(2) // expiring soon
        .mockResolvedValueOnce(3); // expired recently

      prismaService.user.findUnique
        .mockResolvedValueOnce({ email: 'admin1@example.com' })
        .mockResolvedValueOnce({ email: 'admin2@example.com' });

      prismaService.role.findUnique
        .mockResolvedValueOnce({ name: 'Admin' })
        .mockResolvedValueOnce({ name: 'Member' });

      const result = await service.getInvitationStatistics('tenant-1');

      expect(result.overview.total).toBe(17);
      expect(result.overview.pending).toBe(5);
      expect(result.overview.accepted).toBe(10);
      expect(result.overview.expired).toBe(2);
      expect(result.trends.last24Hours).toBe(3);
      expect(result.trends.last7Days).toBe(8);
      expect(result.trends.last30Days).toBe(15);
      expect(result.acceptanceRate.overall).toBeCloseTo(58.82, 2);
      expect(result.acceptanceRate.last30Days).toBeCloseTo(41.67, 2);
      expect(result.topInviters).toHaveLength(2);
      expect(result.roleDistribution).toHaveLength(2);
      expect(result.expirationAnalysis.expiringSoon).toBe(2);
      expect(result.expirationAnalysis.expiredRecently).toBe(3);
    });
  });

  describe('generateInvitationReport', () => {
    it('should generate comprehensive invitation report', async () => {
      const invitations = [
        {
          id: 'invitation-1',
          email: 'test1@example.com',
          status: InvitationStatus.ACCEPTED,
          createdAt: new Date('2024-01-01'),
          expiresAt: new Date('2024-01-08'),
          acceptedAt: new Date('2024-01-02'),
          cancelledAt: null,
          inviter: { email: 'admin@example.com' },
          roles: [{ role: { name: 'Admin' } }],
        },
        {
          id: 'invitation-2',
          email: 'test2@example.com',
          status: InvitationStatus.PENDING,
          createdAt: new Date('2024-01-03'),
          expiresAt: new Date('2024-01-10'),
          acceptedAt: null,
          cancelledAt: null,
          inviter: { email: 'admin@example.com' },
          roles: [{ role: { name: 'Member' } }],
        },
      ];

      const statusCounts = [
        { status: InvitationStatus.ACCEPTED, _count: { id: 1 } },
        { status: InvitationStatus.PENDING, _count: { id: 1 } },
      ];

      prismaService.tenantInvitation.findMany.mockResolvedValue(invitations);
      prismaService.tenantInvitation.groupBy.mockResolvedValue(statusCounts);

      const result = await service.generateInvitationReport('tenant-1');

      expect(result.tenantId).toBe('tenant-1');
      expect(result.summary.total).toBe(2);
      expect(result.summary.accepted).toBe(1);
      expect(result.summary.pending).toBe(1);
      expect(result.invitations).toHaveLength(2);
      expect(result.invitations[0].roles).toEqual(['Admin']);
      expect(result.invitations[1].roles).toEqual(['Member']);
    });

    it('should filter report by status', async () => {
      prismaService.tenantInvitation.findMany.mockResolvedValue([]);
      prismaService.tenantInvitation.groupBy.mockResolvedValue([]);

      await service.generateInvitationReport('tenant-1', {
        status: InvitationStatus.PENDING,
      });

      expect(prismaService.tenantInvitation.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          status: InvitationStatus.PENDING,
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter report by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      prismaService.tenantInvitation.findMany.mockResolvedValue([]);
      prismaService.tenantInvitation.groupBy.mockResolvedValue([]);

      await service.generateInvitationReport('tenant-1', {
        startDate,
        endDate,
      });

      expect(prismaService.tenantInvitation.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('exportInvitationReportAsCSV', () => {
    it('should export invitation report as CSV format', async () => {
      const mockReport = {
        tenantId: 'tenant-1',
        generatedAt: new Date(),
        summary: {
          total: 1,
          pending: 1,
          accepted: 0,
          expired: 0,
          cancelled: 0,
        },
        invitations: [
          {
            id: 'invitation-1',
            email: 'test@example.com',
            status: 'pending',
            createdAt: new Date('2024-01-01'),
            expiresAt: new Date('2024-01-08'),
            acceptedAt: null,
            cancelledAt: null,
            inviterEmail: 'admin@example.com',
            roles: ['Admin', 'Member'],
          },
        ],
      };

      jest
        .spyOn(service, 'generateInvitationReport')
        .mockResolvedValue(mockReport);

      const csvContent = await service.exportInvitationReportAsCSV('tenant-1');

      expect(csvContent).toContain(
        '"ID","Email","Status","Created At","Expires At"',
      );
      expect(csvContent).toContain('invitation-1');
      expect(csvContent).toContain('test@example.com');
      expect(csvContent).toContain('Admin; Member');

      expect(auditService.logInvitationEvent).toHaveBeenCalledWith({
        invitationId: 'export-operation',
        action: 'invitation_validated',
        success: true,
        metadata: {
          exportType: 'csv',
          tenantId: 'tenant-1',
          recordCount: 1,
          exportOptions: {},
          generatedAt: expect.any(String),
        },
      });
    });
  });

  describe('getInvitationActivitySummary', () => {
    it('should return activity summary for dashboard', async () => {
      // Mock today's stats (3 calls)
      prismaService.tenantInvitation.count
        .mockResolvedValueOnce(5) // today created
        .mockResolvedValueOnce(3) // today accepted
        .mockResolvedValueOnce(1); // today expired

      // Mock weekly trend data (7 days * 2 calls per day = 14 calls)
      for (let i = 0; i < 14; i++) {
        prismaService.tenantInvitation.count.mockResolvedValueOnce(i % 3); // Predictable values
      }

      // Mock pending actions (2 calls)
      prismaService.tenantInvitation.count
        .mockResolvedValueOnce(2) // expiring soon
        .mockResolvedValueOnce(4); // needing resend

      const result = await service.getInvitationActivitySummary('tenant-1');

      expect(result.todayStats.created).toBe(5);
      expect(result.todayStats.accepted).toBe(3);
      expect(result.todayStats.expired).toBe(1);
      expect(result.weeklyTrend).toHaveLength(7);
      expect(result.pendingActions.expiringSoon).toBe(2);
      expect(result.pendingActions.needingResend).toBe(4);
    });
  });
});
