import { Test, TestingModule } from '@nestjs/testing';
import { InvitationAuditService } from './invitation-audit.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

describe('InvitationAuditService', () => {
  let service: InvitationAuditService;
  let prismaService: jest.Mocked<PrismaService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const mockPrismaService = {
      invitationAuditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const mockTenantContextService = {
      getTenantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationAuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContextService,
        },
      ],
    }).compile();

    service = module.get<InvitationAuditService>(InvitationAuditService);
    prismaService = module.get(PrismaService);
    tenantContextService = module.get(TenantContextService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logInvitationEvent', () => {
    beforeEach(() => {
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
    });

    it('should log successful invitation event', async () => {
      prismaService.invitationAuditLog.create.mockResolvedValue({} as any);

      await service.logInvitationEvent({
        invitationId: 'invitation-123',
        action: 'invitation_created',
        userId: 'user-123',
        success: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: { email: 'test@example.com' },
      });

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: {
          invitationId: 'invitation-123',
          action: 'invitation_created',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: {
            success: true,
            errorCode: undefined,
            errorMessage: undefined,
            tenantId: 'tenant-123',
            email: 'test@example.com',
          },
        },
      });
    });

    it('should log failed invitation event', async () => {
      prismaService.invitationAuditLog.create.mockResolvedValue({} as any);

      await service.logInvitationEvent({
        invitationId: 'invitation-123',
        action: 'invitation_validation_failed',
        success: false,
        errorCode: 'INVALID_TOKEN',
        errorMessage: 'Token is invalid',
        ipAddress: '192.168.1.1',
      });

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: {
          invitationId: 'invitation-123',
          action: 'invitation_validation_failed',
          userId: undefined,
          ipAddress: '192.168.1.1',
          userAgent: undefined,
          metadata: {
            success: false,
            errorCode: 'INVALID_TOKEN',
            errorMessage: 'Token is invalid',
            tenantId: 'tenant-123',
          },
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      prismaService.invitationAuditLog.create.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw error
      await expect(
        service.logInvitationEvent({
          invitationId: 'invitation-123',
          action: 'invitation_created',
          success: true,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('specific logging methods', () => {
    beforeEach(() => {
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
      prismaService.invitationAuditLog.create.mockResolvedValue({} as any);
    });

    it('should log invitation created', async () => {
      await service.logInvitationCreated(
        'invitation-123',
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0',
        { email: 'test@example.com' },
      );

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: 'invitation-123',
          action: 'invitation_created',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: expect.objectContaining({
            success: true,
            email: 'test@example.com',
          }),
        }),
      });
    });

    it('should log invitation sent', async () => {
      await service.logInvitationSent(
        'invitation-123',
        'user-123',
        true,
        undefined,
        undefined,
        { provider: 'email' },
      );

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: 'invitation-123',
          action: 'invitation_sent',
          userId: 'user-123',
          metadata: expect.objectContaining({
            success: true,
            provider: 'email',
          }),
        }),
      });
    });

    it('should log invitation resent', async () => {
      await service.logInvitationResent(
        'invitation-123',
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0',
        true,
      );

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: 'invitation-123',
          action: 'invitation_resent',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: expect.objectContaining({
            success: true,
          }),
        }),
      });
    });

    it('should log invitation cancelled', async () => {
      await service.logInvitationCancelled(
        'invitation-123',
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0',
        { reason: 'admin_cancelled' },
      );

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: 'invitation-123',
          action: 'invitation_cancelled',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: expect.objectContaining({
            success: true,
            reason: 'admin_cancelled',
          }),
        }),
      });
    });

    it('should log invitation accepted', async () => {
      await service.logInvitationAccepted(
        'invitation-123',
        'user-456',
        '192.168.1.1',
        'Mozilla/5.0',
        { authMethod: 'google' },
      );

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: 'invitation-123',
          action: 'invitation_accepted',
          userId: 'user-456',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: expect.objectContaining({
            success: true,
            authMethod: 'google',
          }),
        }),
      });
    });

    it('should log invitation expired', async () => {
      await service.logInvitationExpired('invitation-123', {
        expiredAt: new Date().toISOString(),
      });

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: 'invitation-123',
          action: 'invitation_expired',
          metadata: expect.objectContaining({
            success: true,
            expiredAt: expect.any(String),
          }),
        }),
      });
    });

    it('should log successful invitation validation', async () => {
      await service.logInvitationValidated(
        'invitation-123',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
        undefined,
        undefined,
        { token: 'valid' },
      );

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: 'invitation-123',
          action: 'invitation_validated',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: expect.objectContaining({
            success: true,
            token: 'valid',
          }),
        }),
      });
    });

    it('should log failed invitation validation', async () => {
      await service.logInvitationValidated(
        'invitation-123',
        false,
        '192.168.1.1',
        'Mozilla/5.0',
        'INVALID_TOKEN',
        'Token is expired',
        { token: 'expired' },
      );

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: 'invitation-123',
          action: 'invitation_validation_failed',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: expect.objectContaining({
            success: false,
            errorCode: 'INVALID_TOKEN',
            errorMessage: 'Token is expired',
            token: 'expired',
          }),
        }),
      });
    });

    it('should log rate limit exceeded', async () => {
      await service.logRateLimitExceeded(
        'invitation-123',
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0',
        { limitType: 'tenant' },
      );

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: 'invitation-123',
          action: 'invitation_rate_limit_exceeded',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: expect.objectContaining({
            success: false,
            errorCode: 'RATE_LIMIT_EXCEEDED',
            errorMessage: 'Rate limit exceeded for invitation operation',
            limitType: 'tenant',
          }),
        }),
      });
    });

    it('should log security events', async () => {
      await service.logSecurityEvent(
        'invitation-123',
        'Suspicious token manipulation detected',
        '192.168.1.1',
        'Mozilla/5.0',
        { suspiciousActivity: true },
      );

      expect(prismaService.invitationAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invitationId: 'invitation-123',
          action: 'invitation_validation_failed',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: expect.objectContaining({
            success: false,
            errorCode: 'SECURITY_EVENT',
            errorMessage: 'Suspicious token manipulation detected',
            securityEvent: 'Suspicious token manipulation detected',
            suspiciousActivity: true,
          }),
        }),
      });
    });
  });

  describe('query methods', () => {
    it('should get invitation audit logs', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-1',
          action: 'invitation_created',
          createdAt: new Date(),
          user: { id: 'user-1', email: 'user@example.com' },
        },
      ];

      prismaService.invitationAuditLog.findMany.mockResolvedValue(
        mockAuditLogs as any,
      );

      const result = await service.getInvitationAuditLogs('invitation-123', 25);

      expect(result).toEqual(mockAuditLogs);
      expect(prismaService.invitationAuditLog.findMany).toHaveBeenCalledWith({
        where: { invitationId: 'invitation-123' },
        orderBy: { createdAt: 'desc' },
        take: 25,
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
    });

    it('should get tenant invitation audit logs', async () => {
      const mockAuditLogs = [
        {
          id: 'audit-1',
          action: 'invitation_created',
          createdAt: new Date(),
          invitation: { id: 'inv-1', email: 'test@example.com' },
          user: { id: 'user-1', email: 'user@example.com' },
        },
      ];

      prismaService.invitationAuditLog.findMany.mockResolvedValue(
        mockAuditLogs as any,
      );

      const result = await service.getTenantInvitationAuditLogs(
        'tenant-123',
        50,
        10,
        'invitation_created',
      );

      expect(result).toEqual(mockAuditLogs);
      expect(prismaService.invitationAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          invitation: { tenantId: 'tenant-123' },
          action: 'invitation_created',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 10,
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
    });

    it('should get security events', async () => {
      const mockSecurityEvents = [
        {
          id: 'audit-1',
          action: 'invitation_validation_failed',
          createdAt: new Date(),
          invitation: { id: 'inv-1', email: 'test@example.com' },
        },
      ];

      prismaService.invitationAuditLog.findMany.mockResolvedValue(
        mockSecurityEvents as any,
      );

      const result = await service.getSecurityEvents('tenant-123', 100, 24);

      expect(result).toEqual(mockSecurityEvents);
      expect(prismaService.invitationAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          action: {
            in: [
              'invitation_validation_failed',
              'invitation_rate_limit_exceeded',
            ],
          },
          createdAt: { gte: expect.any(Date) },
          invitation: { tenantId: 'tenant-123' },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
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
    });

    it('should handle query errors gracefully', async () => {
      prismaService.invitationAuditLog.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.getInvitationAuditLogs('invitation-123');

      expect(result).toEqual([]);
    });
  });

  describe('getAuditStatistics', () => {
    it('should calculate audit statistics correctly', async () => {
      const mockAuditLogs = [
        {
          action: 'invitation_created',
          metadata: { success: true },
        },
        {
          action: 'invitation_sent',
          metadata: { success: true },
        },
        {
          action: 'invitation_validation_failed',
          metadata: { success: false },
        },
        {
          action: 'invitation_created',
          metadata: { success: true },
        },
      ];

      prismaService.invitationAuditLog.findMany.mockResolvedValue(
        mockAuditLogs as any,
      );

      const result = await service.getAuditStatistics('tenant-123', 30);

      expect(result).toEqual({
        totalEvents: 4,
        eventsByAction: {
          invitation_created: 2,
          invitation_sent: 1,
          invitation_validation_failed: 1,
        },
        securityEvents: 1,
        successRate: 75, // 3 successful out of 4 total
      });
    });

    it('should handle empty audit logs', async () => {
      prismaService.invitationAuditLog.findMany.mockResolvedValue([]);

      const result = await service.getAuditStatistics('tenant-123', 30);

      expect(result).toEqual({
        totalEvents: 0,
        eventsByAction: {},
        securityEvents: 0,
        successRate: 100,
      });
    });

    it('should handle database errors', async () => {
      prismaService.invitationAuditLog.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.getAuditStatistics('tenant-123', 30);

      expect(result).toEqual({
        totalEvents: 0,
        eventsByAction: {},
        securityEvents: 0,
        successRate: 100,
      });
    });
  });

  describe('cleanupOldAuditLogs', () => {
    it('should cleanup old audit logs', async () => {
      prismaService.invitationAuditLog.deleteMany.mockResolvedValue({
        count: 150,
      });

      const result = await service.cleanupOldAuditLogs(365);

      expect(result).toBe(150);
      expect(prismaService.invitationAuditLog.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should handle cleanup errors', async () => {
      prismaService.invitationAuditLog.deleteMany.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.cleanupOldAuditLogs(365);

      expect(result).toBe(0);
    });
  });
});
