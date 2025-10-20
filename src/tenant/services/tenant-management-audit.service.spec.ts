import { Test, TestingModule } from '@nestjs/testing';
import { TenantManagementAuditService } from './tenant-management-audit.service';
import { PrismaService } from '../../database/prisma.service';

describe('TenantManagementAuditService', () => {
  let service: TenantManagementAuditService;
  let mockPrismaService: any;

  beforeEach(async () => {
    mockPrismaService = {
      notification: {
        create: jest.fn(),
      },
      notificationAuditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantManagementAuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TenantManagementAuditService>(
      TenantManagementAuditService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logTenantLessRegistration', () => {
    it('should log tenant-less registration successfully', async () => {
      const mockNotification = { id: 'notification-123' };
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);
      mockPrismaService.notificationAuditLog.create.mockResolvedValue({});

      await service.logTenantLessRegistration(
        'user-123',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
        undefined,
        undefined,
        { email: 'test@example.com' },
      );

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: null,
          userId: 'user-123',
          type: 'INFO',
          category: 'tenant_management_audit',
          title: 'Tenant Management Event: tenant_less_registration',
          message:
            'User performed tenant_less_registration with password authentication',
          data: {
            action: 'tenant_less_registration',
            authMethod: 'password',
            success: true,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            errorCode: undefined,
            errorMessage: undefined,
            registrationMethod: 'email_password',
            email: 'test@example.com',
          },
          channelsSent: [],
        },
      });

      expect(
        mockPrismaService.notificationAuditLog.create,
      ).toHaveBeenCalledWith({
        data: {
          notificationId: 'notification-123',
          action: 'tenant_less_registration',
          userId: 'user-123',
          tenantId: null,
          authMethod: 'password',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: {
            success: true,
            errorCode: undefined,
            errorMessage: undefined,
            registrationMethod: 'email_password',
            email: 'test@example.com',
          },
        },
      });
    });
  });

  describe('logTenantCreation', () => {
    it('should log tenant creation successfully', async () => {
      const mockNotification = { id: 'notification-123' };
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);
      mockPrismaService.notificationAuditLog.create.mockResolvedValue({});

      await service.logTenantCreation(
        'user-123',
        'tenant-456',
        'test-tenant',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
        undefined,
        undefined,
        { userRole: 'Admin' },
      );

      expect(mockPrismaService.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-456',
          userId: 'user-123',
          type: 'INFO',
          category: 'tenant_management_audit',
          title: 'Tenant Management Event: tenant_creation',
          message:
            'User performed tenant_creation with password authentication',
          data: {
            action: 'tenant_creation',
            authMethod: 'password',
            success: true,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            errorCode: undefined,
            errorMessage: undefined,
            tenantName: 'test-tenant',
            operation: 'create_tenant',
            userRole: 'Admin',
          },
          channelsSent: [],
        },
      });
    });
  });

  describe('logTenantJoining', () => {
    it('should log tenant joining successfully', async () => {
      const mockNotification = { id: 'notification-123' };
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);
      mockPrismaService.notificationAuditLog.create.mockResolvedValue({});

      await service.logTenantJoining(
        'user-123',
        'tenant-456',
        'invitation-789',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
        undefined,
        undefined,
        { rolesAssigned: ['role-1'] },
      );

      expect(
        mockPrismaService.notificationAuditLog.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'tenant_joining',
          authMethod: 'invitation',
          metadata: expect.objectContaining({
            invitationId: 'invitation-789',
            operation: 'join_tenant',
            rolesAssigned: ['role-1'],
          }),
        }),
      });
    });
  });

  describe('logRateLimitExceeded', () => {
    it('should log rate limit exceeded events', async () => {
      const mockNotification = { id: 'notification-123' };
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);
      mockPrismaService.notificationAuditLog.create.mockResolvedValue({});

      await service.logRateLimitExceeded(
        'user-123',
        'tenant_creation',
        '192.168.1.1',
        'Mozilla/5.0',
        { retryAfter: 3600 },
      );

      expect(
        mockPrismaService.notificationAuditLog.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'tenant_management_rate_limit_exceeded',
          metadata: expect.objectContaining({
            operation: 'tenant_creation',
            rateLimitType: 'tenant_management',
            retryAfter: 3600,
          }),
        }),
      });
    });
  });

  describe('getUserTenantManagementAuditLogs', () => {
    it('should retrieve user audit logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'tenant_creation',
          authMethod: 'password',
          tenantId: 'tenant-123',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: { success: true },
          createdAt: new Date(),
        },
      ];

      mockPrismaService.notificationAuditLog.findMany.mockResolvedValue(
        mockLogs,
      );

      const result = await service.getUserTenantManagementAuditLogs(
        'user-123',
        10,
        0,
      );

      expect(result).toEqual(mockLogs);
      expect(
        mockPrismaService.notificationAuditLog.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
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
        take: 10,
        skip: 0,
        select: expect.any(Object),
      });
    });
  });

  describe('getTenantManagementAuditStats', () => {
    it('should calculate audit statistics', async () => {
      const mockLogs = [
        {
          action: 'tenant_creation',
          authMethod: 'password',
          metadata: { success: true },
        },
        {
          action: 'tenant_joining',
          authMethod: 'invitation',
          metadata: { success: true },
        },
        {
          action: 'tenant_creation',
          authMethod: 'password',
          metadata: { success: false },
        },
      ];

      mockPrismaService.notificationAuditLog.findMany.mockResolvedValue(
        mockLogs,
      );

      const result = await service.getTenantManagementAuditStats();

      expect(result).toEqual({
        totalEvents: 3,
        successfulEvents: 2,
        failedEvents: 1,
        eventsByAction: {
          tenant_creation: 2,
          tenant_joining: 1,
        },
        eventsByAuthMethod: {
          password: 2,
          invitation: 1,
        },
      });
    });
  });

  describe('error handling', () => {
    it('should not throw error when audit logging fails', async () => {
      mockPrismaService.notification.create.mockRejectedValue(
        new Error('Database error'),
      );

      // Should not throw error
      await expect(
        service.logTenantLessRegistration('user-123', true),
      ).resolves.not.toThrow();
    });
  });
});
