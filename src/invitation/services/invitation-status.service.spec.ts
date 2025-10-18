import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InvitationStatusService } from './invitation-status.service';
import { PrismaService } from '../../database/prisma.service';
import { InvitationAuditService } from './invitation-audit.service';
import { InvitationStatus } from '../enums/invitation-status.enum';

describe('InvitationStatusService', () => {
  let service: InvitationStatusService;
  let prismaService: jest.Mocked<PrismaService>;
  let auditService: jest.Mocked<InvitationAuditService>;
  let configService: jest.Mocked<ConfigService>;

  const mockInvitation = {
    id: 'invitation-1',
    tenantId: 'tenant-1',
    email: 'test@example.com',
    token: 'test-token',
    invitedBy: 'user-1',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    status: InvitationStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      tenantInvitation: {
        update: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        deleteMany: jest.fn(),
        groupBy: jest.fn(),
      },
      tenantInvitationRole: {
        deleteMany: jest.fn(),
      },
      invitationAuditLog: {
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const mockAuditService = {
      logInvitationAccepted: jest.fn(),
      logInvitationCancelled: jest.fn(),
      logInvitationExpired: jest.fn(),
      logInvitationCleanup: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationStatusService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: InvitationAuditService,
          useValue: mockAuditService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<InvitationStatusService>(InvitationStatusService);
    prismaService = module.get(PrismaService);
    auditService = module.get(InvitationAuditService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('markAsAccepted', () => {
    it('should mark invitation as accepted and log audit event', async () => {
      const invitationId = 'invitation-1';
      const userId = 'user-1';

      prismaService.tenantInvitation.update.mockResolvedValue({
        ...mockInvitation,
        status: InvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
      });

      await service.markAsAccepted(invitationId, userId);

      expect(prismaService.tenantInvitation.update).toHaveBeenCalledWith({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: expect.any(Date),
        },
      });

      expect(auditService.logInvitationAccepted).toHaveBeenCalledWith(
        invitationId,
        userId,
        undefined,
        undefined,
        {
          statusChange: 'PENDING -> ACCEPTED',
          timestamp: expect.any(String),
        },
      );
    });
  });

  describe('markAsCancelled', () => {
    it('should mark invitation as cancelled and log audit event', async () => {
      const invitationId = 'invitation-1';
      const userId = 'user-1';

      prismaService.tenantInvitation.update.mockResolvedValue({
        ...mockInvitation,
        status: InvitationStatus.CANCELLED,
        cancelledAt: new Date(),
      });

      await service.markAsCancelled(invitationId, userId);

      expect(prismaService.tenantInvitation.update).toHaveBeenCalledWith({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        },
      });

      expect(auditService.logInvitationCancelled).toHaveBeenCalledWith(
        invitationId,
        userId,
        undefined,
        undefined,
        {
          statusChange: 'PENDING -> CANCELLED',
          timestamp: expect.any(String),
        },
      );
    });
  });

  describe('markAsExpired', () => {
    it('should mark invitation as expired and log audit event', async () => {
      const invitationId = 'invitation-1';

      prismaService.tenantInvitation.update.mockResolvedValue({
        ...mockInvitation,
        status: InvitationStatus.EXPIRED,
      });

      await service.markAsExpired(invitationId);

      expect(prismaService.tenantInvitation.update).toHaveBeenCalledWith({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.EXPIRED,
        },
      });

      expect(auditService.logInvitationExpired).toHaveBeenCalledWith(
        invitationId,
        undefined,
        undefined,
        undefined,
        {
          statusChange: 'PENDING -> EXPIRED',
          timestamp: expect.any(String),
        },
      );
    });
  });

  describe('checkExpiredInvitations', () => {
    it('should find and expire pending invitations that have passed expiration', async () => {
      const expiredInvitations = [
        {
          id: 'invitation-1',
          email: 'test1@example.com',
          tenantId: 'tenant-1',
          expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        },
        {
          id: 'invitation-2',
          email: 'test2@example.com',
          tenantId: 'tenant-1',
          expiresAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        },
      ];

      prismaService.tenantInvitation.findMany.mockResolvedValue(
        expiredInvitations,
      );
      prismaService.tenantInvitation.updateMany.mockResolvedValue({ count: 2 });

      await service.checkExpiredInvitations();

      expect(prismaService.tenantInvitation.findMany).toHaveBeenCalledWith({
        where: {
          status: InvitationStatus.PENDING,
          expiresAt: {
            lte: expect.any(Date),
          },
        },
        select: {
          id: true,
          email: true,
          tenantId: true,
          expiresAt: true,
        },
      });

      expect(prismaService.tenantInvitation.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['invitation-1', 'invitation-2'],
          },
        },
        data: {
          status: InvitationStatus.EXPIRED,
        },
      });

      expect(auditService.logInvitationExpired).toHaveBeenCalledTimes(2);
    });

    it('should handle case when no expired invitations are found', async () => {
      prismaService.tenantInvitation.findMany.mockResolvedValue([]);

      await service.checkExpiredInvitations();

      expect(prismaService.tenantInvitation.updateMany).not.toHaveBeenCalled();
      expect(auditService.logInvitationExpired).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      prismaService.tenantInvitation.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw
      await expect(service.checkExpiredInvitations()).resolves.toBeUndefined();
    });
  });

  describe('cleanupOldInvitations', () => {
    beforeEach(() => {
      configService.get.mockReturnValue(90); // 90 days retention
    });

    it('should clean up old invitations based on retention policy', async () => {
      const oldInvitations = [
        {
          id: 'invitation-1',
          status: InvitationStatus.ACCEPTED,
          email: 'test1@example.com',
          tenantId: 'tenant-1',
          createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
          acceptedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
          cancelledAt: null,
        },
        {
          id: 'invitation-2',
          status: InvitationStatus.EXPIRED,
          email: 'test2@example.com',
          tenantId: 'tenant-1',
          createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
          acceptedAt: null,
          cancelledAt: null,
        },
      ];

      prismaService.tenantInvitation.findMany.mockResolvedValue(oldInvitations);
      prismaService.tenantInvitationRole.deleteMany.mockResolvedValue({
        count: 2,
      });
      prismaService.invitationAuditLog.deleteMany.mockResolvedValue({
        count: 5,
      });
      prismaService.tenantInvitation.deleteMany.mockResolvedValue({ count: 2 });

      await service.cleanupOldInvitations();

      expect(prismaService.tenantInvitation.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              status: InvitationStatus.ACCEPTED,
              acceptedAt: {
                lte: expect.any(Date),
              },
            },
            {
              status: InvitationStatus.EXPIRED,
              createdAt: {
                lte: expect.any(Date),
              },
            },
            {
              status: InvitationStatus.CANCELLED,
              cancelledAt: {
                lte: expect.any(Date),
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

      // Should delete in correct order due to foreign key constraints
      expect(prismaService.tenantInvitationRole.deleteMany).toHaveBeenCalled();
      expect(prismaService.invitationAuditLog.deleteMany).toHaveBeenCalled();
      expect(prismaService.tenantInvitation.deleteMany).toHaveBeenCalled();

      expect(auditService.logInvitationCleanup).toHaveBeenCalledTimes(2);
    });

    it('should handle case when no old invitations are found', async () => {
      prismaService.tenantInvitation.findMany.mockResolvedValue([]);

      await service.cleanupOldInvitations();

      expect(
        prismaService.tenantInvitationRole.deleteMany,
      ).not.toHaveBeenCalled();
      expect(prismaService.tenantInvitation.deleteMany).not.toHaveBeenCalled();
      expect(auditService.logInvitationCleanup).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      prismaService.tenantInvitation.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw
      await expect(service.cleanupOldInvitations()).resolves.toBeUndefined();
    });
  });

  describe('getInvitationStatistics', () => {
    it('should return comprehensive invitation statistics', async () => {
      const tenantId = 'tenant-1';
      const statusCounts = [
        { status: InvitationStatus.PENDING, _count: { id: 5 } },
        { status: InvitationStatus.ACCEPTED, _count: { id: 10 } },
        { status: InvitationStatus.EXPIRED, _count: { id: 2 } },
        { status: InvitationStatus.CANCELLED, _count: { id: 1 } },
      ];

      prismaService.tenantInvitation.groupBy.mockResolvedValue(statusCounts);
      prismaService.tenantInvitation.count
        .mockResolvedValueOnce(3) // last 24 hours
        .mockResolvedValueOnce(8) // last 7 days
        .mockResolvedValueOnce(15); // last 30 days

      const result = await service.getInvitationStatistics(tenantId);

      expect(result).toEqual({
        total: 18,
        pending: 5,
        accepted: 10,
        expired: 2,
        cancelled: 1,
        recentActivity: {
          last24Hours: 3,
          last7Days: 8,
          last30Days: 15,
        },
      });

      expect(prismaService.tenantInvitation.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: { tenantId },
        _count: { id: true },
      });

      expect(prismaService.tenantInvitation.count).toHaveBeenCalledTimes(3);
    });
  });

  describe('checkInvitationExpiration', () => {
    it('should expire invitation if it has passed expiration date', async () => {
      const invitationId = 'invitation-1';
      const expiredInvitation = {
        id: invitationId,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      prismaService.tenantInvitation.findUnique.mockResolvedValue(
        expiredInvitation,
      );
      prismaService.tenantInvitation.update.mockResolvedValue({
        ...expiredInvitation,
        status: InvitationStatus.EXPIRED,
      });

      const result = await service.checkInvitationExpiration(invitationId);

      expect(result).toBe(true);
      expect(prismaService.tenantInvitation.update).toHaveBeenCalledWith({
        where: { id: invitationId },
        data: {
          status: InvitationStatus.EXPIRED,
        },
      });
    });

    it('should not expire invitation if it has not passed expiration date', async () => {
      const invitationId = 'invitation-1';
      const validInvitation = {
        id: invitationId,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      };

      prismaService.tenantInvitation.findUnique.mockResolvedValue(
        validInvitation,
      );

      const result = await service.checkInvitationExpiration(invitationId);

      expect(result).toBe(false);
      expect(prismaService.tenantInvitation.update).not.toHaveBeenCalled();
    });

    it('should return false if invitation is not found', async () => {
      const invitationId = 'non-existent';

      prismaService.tenantInvitation.findUnique.mockResolvedValue(null);

      const result = await service.checkInvitationExpiration(invitationId);

      expect(result).toBe(false);
    });

    it('should not expire invitation if it is not pending', async () => {
      const invitationId = 'invitation-1';
      const acceptedInvitation = {
        id: invitationId,
        status: InvitationStatus.ACCEPTED,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      prismaService.tenantInvitation.findUnique.mockResolvedValue(
        acceptedInvitation,
      );

      const result = await service.checkInvitationExpiration(invitationId);

      expect(result).toBe(false);
      expect(prismaService.tenantInvitation.update).not.toHaveBeenCalled();
    });
  });

  describe('getCleanupStatistics', () => {
    beforeEach(() => {
      configService.get.mockReturnValue(90); // 90 days retention
    });

    it('should return cleanup statistics', async () => {
      prismaService.tenantInvitation.count.mockResolvedValue(25);
      prismaService.invitationAuditLog.findFirst.mockResolvedValue({
        createdAt: new Date('2024-01-01'),
      });

      const result = await service.getCleanupStatistics();

      expect(result).toEqual({
        eligibleForCleanup: 25,
        lastCleanupRun: new Date('2024-01-01'),
        retentionDays: 90,
      });

      expect(prismaService.tenantInvitation.count).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              status: InvitationStatus.ACCEPTED,
              acceptedAt: {
                lte: expect.any(Date),
              },
            },
            {
              status: InvitationStatus.EXPIRED,
              createdAt: {
                lte: expect.any(Date),
              },
            },
            {
              status: InvitationStatus.CANCELLED,
              cancelledAt: {
                lte: expect.any(Date),
              },
            },
          ],
        },
      });
    });

    it('should handle case when no cleanup has been run', async () => {
      prismaService.tenantInvitation.count.mockResolvedValue(10);
      prismaService.invitationAuditLog.findFirst.mockResolvedValue(null);

      const result = await service.getCleanupStatistics();

      expect(result).toEqual({
        eligibleForCleanup: 10,
        lastCleanupRun: undefined,
        retentionDays: 90,
      });
    });
  });
});
