import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { AuthAuditService, AuthAuditEvent } from './auth-audit.service';
import { PrismaService } from '../../database/prisma.service';

describe('AuthAuditService', () => {
  let service: AuthAuditService;
  let prismaService: jest.Mocked<PrismaService>;
  let loggerSpy: jest.SpyInstance;

  const mockAuditEvent: AuthAuditEvent = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    action: 'google_login',
    authMethod: 'google',
    success: true,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    metadata: { test: 'data' },
  };

  const mockNotification = {
    id: 'notification-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    type: 'INFO',
    category: 'auth_audit',
    title: 'Authentication Event: google_login',
    message: 'User performed google_login with google authentication',
    data: expect.any(Object),
    channelsSent: [],
    createdAt: new Date(),
  };

  const mockAuditLog = {
    id: 'audit-1',
    notificationId: 'notification-1',
    action: 'google_login',
    userId: 'user-1',
    tenantId: 'tenant-1',
    authMethod: 'google',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    metadata: expect.any(Object),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      notification: {
        create: jest.fn().mockResolvedValue(mockNotification),
      },
      notificationAuditLog: {
        create: jest.fn().mockResolvedValue(mockAuditLog),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthAuditService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuthAuditService>(AuthAuditService);
    prismaService = module.get(PrismaService);

    // Mock the logger
    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logAuthEvent', () => {
    it('should log successful authentication event', async () => {
      (prismaService.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );
      (
        prismaService.notificationAuditLog.create as jest.Mock
      ).mockResolvedValue(mockAuditLog);

      await service.logAuthEvent(mockAuditEvent);

      expect(loggerSpy).toHaveBeenCalledWith({
        event: 'auth_event',
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        action: 'google_login',
        auth_method: 'google',
        success: true,
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        error_code: undefined,
        error_message: undefined,
        timestamp: expect.any(String),
        test: 'data',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          userId: 'user-1',
          type: 'INFO',
          category: 'auth_audit',
          title: 'Authentication Event: google_login',
          message: 'User performed google_login with google authentication',
          data: {
            action: 'google_login',
            authMethod: 'google',
            success: true,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            errorCode: undefined,
            errorMessage: undefined,
            test: 'data',
          },
          channelsSent: [],
        },
      });

      expect(
        // eslint-disable-next-line @typescript-eslint/unbound-method
        prismaService.notificationAuditLog.create as jest.Mock,
      ).toHaveBeenCalledWith({
        data: {
          notificationId: 'notification-1',
          action: 'google_login',
          userId: 'user-1',
          tenantId: 'tenant-1',
          authMethod: 'google',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: {
            success: true,
            errorCode: undefined,
            errorMessage: undefined,
            test: 'data',
          },
        },
      });
    });

    it('should log failed authentication event', async () => {
      const failedEvent: AuthAuditEvent = {
        ...mockAuditEvent,
        success: false,
        errorCode: 'INVALID_CREDENTIALS',
        errorMessage: 'Invalid Google token',
      };

      (prismaService.notification.create as jest.Mock).mockResolvedValue(
        mockNotification,
      );
      (
        prismaService.notificationAuditLog.create as jest.Mock
      ).mockResolvedValue(mockAuditLog);

      await service.logAuthEvent(failedEvent);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(Logger.prototype.error as jest.Mock).toHaveBeenCalledWith({
        event: 'auth_event',
        user_id: 'user-1',
        tenant_id: 'tenant-1',
        action: 'google_login',
        auth_method: 'google',
        success: false,
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        error_code: 'INVALID_CREDENTIALS',
        error_message: 'Invalid Google token',
        timestamp: expect.any(String),
        test: 'data',
      });
    });

    it('should not create database audit log for non-Google events', async () => {
      const passwordEvent: AuthAuditEvent = {
        ...mockAuditEvent,
        action: 'password_login',
        authMethod: 'password',
      };

      await service.logAuthEvent(passwordEvent);

      expect(loggerSpy).toHaveBeenCalled();
      expect(
        // eslint-disable-next-line @typescript-eslint/unbound-method
        prismaService.notification.create as jest.Mock,
      ).toHaveBeenCalledTimes(0);
      expect(
        // eslint-disable-next-line @typescript-eslint/unbound-method
        prismaService.notificationAuditLog.create as jest.Mock,
      ).toHaveBeenCalledTimes(0);
    });

    it('should handle database errors gracefully', async () => {
      (prismaService.notification.create as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      await service.logAuthEvent(mockAuditEvent);

      expect(loggerSpy).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(Logger.prototype.error as jest.Mock).toHaveBeenCalledWith(
        'Failed to create database audit log',
        expect.objectContaining({
          error: 'Database error',
          event: 'google_login',
          userId: 'user-1',
          tenantId: 'tenant-1',
        }),
      );
    });
  });

  describe('logGoogleSignIn', () => {
    it('should log Google sign-in event', async () => {
      const logAuthEventSpy = jest
        .spyOn(service, 'logAuthEvent')
        .mockResolvedValue();

      await service.logGoogleSignIn(
        'user-1',
        'tenant-1',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
        undefined,
        undefined,
        { test: 'data' },
      );

      expect(logAuthEventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        action: 'google_login',
        authMethod: 'google',
        success: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        errorCode: undefined,
        errorMessage: undefined,
        metadata: { test: 'data' },
      });
    });
  });

  describe('logGoogleLink', () => {
    it('should log Google link event', async () => {
      const logAuthEventSpy = jest
        .spyOn(service, 'logAuthEvent')
        .mockResolvedValue();

      await service.logGoogleLink(
        'user-1',
        'tenant-1',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(logAuthEventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        action: 'google_link',
        authMethod: 'google',
        success: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        errorCode: undefined,
        errorMessage: undefined,
        metadata: undefined,
      });
    });
  });

  describe('logGoogleUnlink', () => {
    it('should log Google unlink event', async () => {
      const logAuthEventSpy = jest
        .spyOn(service, 'logAuthEvent')
        .mockResolvedValue();

      await service.logGoogleUnlink(
        'user-1',
        'tenant-1',
        false,
        '192.168.1.1',
        'Mozilla/5.0',
        'VALIDATION_ERROR',
        'Cannot unlink - no other auth methods',
      );

      expect(logAuthEventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        action: 'google_unlink',
        authMethod: 'google',
        success: false,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Cannot unlink - no other auth methods',
        metadata: undefined,
      });
    });
  });

  describe('logPasswordLogin', () => {
    it('should log password login event', async () => {
      const logAuthEventSpy = jest
        .spyOn(service, 'logAuthEvent')
        .mockResolvedValue();

      await service.logPasswordLogin(
        'user-1',
        'tenant-1',
        true,
        '192.168.1.1',
        'Mozilla/5.0',
      );

      expect(logAuthEventSpy).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        action: 'password_login',
        authMethod: 'password',
        success: true,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        errorCode: undefined,
        errorMessage: undefined,
        metadata: undefined,
      });
    });
  });

  describe('getUserAuthAuditLogs', () => {
    it('should return user auth audit logs', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          action: 'google_login',
          authMethod: 'google',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: { test: 'data' },
          createdAt: new Date(),
        },
      ];

      (
        prismaService.notificationAuditLog.findMany as jest.Mock
      ).mockResolvedValue(mockLogs);

      const result = await service.getUserAuthAuditLogs(
        'user-1',
        'tenant-1',
        25,
      );

      expect(result).toEqual(mockLogs);
      expect(
        // eslint-disable-next-line @typescript-eslint/unbound-method
        prismaService.notificationAuditLog.findMany as jest.Mock,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          tenantId: 'tenant-1',
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
        take: 25,
        select: {
          id: true,
          action: true,
          authMethod: true,
          ipAddress: true,
          userAgent: true,
          metadata: true,
          createdAt: true,
        },
      });
    });
  });

  describe('getTenantAuthAuditLogs', () => {
    it('should return tenant auth audit logs', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          action: 'google_login',
          authMethod: 'google',
          userId: 'user-1',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          metadata: { test: 'data' },
          createdAt: new Date(),
          user: {
            email: 'test@example.com',
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ];

      prismaService.notificationAuditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getTenantAuthAuditLogs('tenant-1', 50, 10);

      expect(result).toEqual(mockLogs);
      expect(
        // eslint-disable-next-line @typescript-eslint/unbound-method
        prismaService.notificationAuditLog.findMany as jest.Mock,
      ).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
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
        take: 50,
        skip: 10,
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
        },
      });
    });
  });
});
