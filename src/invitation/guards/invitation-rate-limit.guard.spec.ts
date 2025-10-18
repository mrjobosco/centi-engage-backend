import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InvitationRateLimitGuard } from './invitation-rate-limit.guard';
import { InvitationRateLimitService } from '../services/invitation-rate-limit.service';

describe('InvitationRateLimitGuard', () => {
  let guard: InvitationRateLimitGuard;
  let rateLimitService: jest.Mocked<InvitationRateLimitService>;
  let reflector: jest.Mocked<Reflector>;
  let configService: jest.Mocked<ConfigService>;

  const mockExecutionContext = (
    method: string,
    path: string,
    user?: any,
    ip = '127.0.0.1',
  ) => {
    const mockRequest = {
      method,
      route: { path },
      url: path,
      user,
      ip,
      headers: {},
      connection: {},
      socket: {},
    };

    const mockResponse = {
      set: jest.fn(),
    };

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: () => ({}),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const mockRateLimitService = {
      getTenantInvitationRateLimitConfig: jest.fn(),
      getAdminInvitationRateLimitConfig: jest.fn(),
      getIpInvitationRateLimitConfig: jest.fn(),
      checkRateLimit: jest.fn(),
    };

    const mockReflector = {
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationRateLimitGuard,
        {
          provide: InvitationRateLimitService,
          useValue: mockRateLimitService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<InvitationRateLimitGuard>(InvitationRateLimitGuard);
    rateLimitService = module.get(InvitationRateLimitService);
    reflector = module.get(Reflector);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow request when rate limiting is skipped', async () => {
      reflector.get.mockReturnValue(true);
      const context = mockExecutionContext('POST', '/invitations');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).not.toHaveBeenCalled();
    });

    it('should check tenant and admin rate limits for invitation creation', async () => {
      reflector.get.mockReturnValue(false);
      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = mockExecutionContext('POST', '/invitations', user);

      const mockRateLimitResult = {
        allowed: true,
        remaining: 99,
        resetTime: Date.now() + 3600000,
        totalHits: 1,
      };

      rateLimitService.getTenantInvitationRateLimitConfig.mockReturnValue({
        windowMs: 86400000,
        maxRequests: 100,
        keyPrefix: 'invitation_tenant_rate_limit',
      });

      rateLimitService.getAdminInvitationRateLimitConfig.mockReturnValue({
        windowMs: 3600000,
        maxRequests: 20,
        keyPrefix: 'invitation_admin_rate_limit',
      });

      rateLimitService.checkRateLimit.mockResolvedValue(mockRateLimitResult);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledTimes(2);
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Object),
      );
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        'user-1',
        expect.any(Object),
      );
    });

    it('should check IP rate limit for invitation acceptance', async () => {
      reflector.get.mockReturnValue(false);
      const context = mockExecutionContext(
        'POST',
        '/invitation-acceptance/token/accept',
        undefined,
        '192.168.1.1',
      );

      const mockRateLimitResult = {
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 3600000,
        totalHits: 1,
      };

      rateLimitService.getIpInvitationRateLimitConfig.mockReturnValue({
        windowMs: 3600000,
        maxRequests: 10,
        keyPrefix: 'invitation_ip_rate_limit',
      });

      rateLimitService.checkRateLimit.mockResolvedValue(mockRateLimitResult);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        '192.168.1.1',
        expect.any(Object),
      );
    });

    it('should throw HttpException when tenant rate limit is exceeded', async () => {
      reflector.get.mockReturnValue(false);
      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = mockExecutionContext('POST', '/invitations', user);

      const mockRateLimitResult = {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 3600000,
        totalHits: 100,
      };

      rateLimitService.getTenantInvitationRateLimitConfig.mockReturnValue({
        windowMs: 86400000,
        maxRequests: 100,
        keyPrefix: 'invitation_tenant_rate_limit',
      });

      rateLimitService.checkRateLimit.mockResolvedValue(mockRateLimitResult);

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should throw HttpException when admin rate limit is exceeded', async () => {
      reflector.get.mockReturnValue(false);
      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = mockExecutionContext('POST', '/invitations', user);

      const tenantRateLimitResult = {
        allowed: true,
        remaining: 99,
        resetTime: Date.now() + 3600000,
        totalHits: 1,
      };

      const adminRateLimitResult = {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 3600000,
        totalHits: 20,
      };

      rateLimitService.getTenantInvitationRateLimitConfig.mockReturnValue({
        windowMs: 86400000,
        maxRequests: 100,
        keyPrefix: 'invitation_tenant_rate_limit',
      });

      rateLimitService.getAdminInvitationRateLimitConfig.mockReturnValue({
        windowMs: 3600000,
        maxRequests: 20,
        keyPrefix: 'invitation_admin_rate_limit',
      });

      rateLimitService.checkRateLimit
        .mockResolvedValueOnce(tenantRateLimitResult)
        .mockResolvedValueOnce(adminRateLimitResult);

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should throw HttpException when IP rate limit is exceeded', async () => {
      reflector.get.mockReturnValue(false);
      const context = mockExecutionContext(
        'POST',
        '/invitation-acceptance/token/accept',
        undefined,
        '192.168.1.1',
      );

      const mockRateLimitResult = {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 3600000,
        totalHits: 10,
      };

      rateLimitService.getIpInvitationRateLimitConfig.mockReturnValue({
        windowMs: 3600000,
        maxRequests: 10,
        keyPrefix: 'invitation_ip_rate_limit',
      });

      rateLimitService.checkRateLimit.mockResolvedValue(mockRateLimitResult);

      await expect(guard.canActivate(context)).rejects.toThrow(HttpException);
    });

    it('should handle missing tenant ID gracefully', async () => {
      reflector.get.mockReturnValue(false);
      const user = { id: 'user-1' }; // No tenantId
      const context = mockExecutionContext('POST', '/invitations', user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Should not call rate limit check for tenant
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledTimes(1); // Only admin check
    });

    it('should handle missing user ID gracefully', async () => {
      reflector.get.mockReturnValue(false);
      const user = { tenantId: 'tenant-1' }; // No id
      const context = mockExecutionContext('POST', '/invitations', user);

      const mockRateLimitResult = {
        allowed: true,
        remaining: 99,
        resetTime: Date.now() + 3600000,
        totalHits: 1,
      };

      rateLimitService.getTenantInvitationRateLimitConfig.mockReturnValue({
        windowMs: 86400000,
        maxRequests: 100,
        keyPrefix: 'invitation_tenant_rate_limit',
      });

      rateLimitService.checkRateLimit.mockResolvedValue(mockRateLimitResult);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Should not call rate limit check for admin
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledTimes(1); // Only tenant check
    });

    it('should extract IP from various headers', async () => {
      reflector.get.mockReturnValue(false);
      const mockRequest = {
        method: 'POST',
        route: { path: '/invitation-acceptance/token/accept' },
        url: '/invitation-acceptance/token/accept',
        headers: {
          'x-forwarded-for': '203.0.113.1, 192.168.1.1',
          'x-real-ip': '203.0.113.2',
        },
        connection: { remoteAddress: '203.0.113.3' },
        socket: { remoteAddress: '203.0.113.4' },
        ip: '203.0.113.5',
      };

      const mockResponse = { set: jest.fn() };
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
        getHandler: () => ({}),
      } as ExecutionContext;

      const mockRateLimitResult = {
        allowed: true,
        remaining: 9,
        resetTime: Date.now() + 3600000,
        totalHits: 1,
      };

      rateLimitService.getIpInvitationRateLimitConfig.mockReturnValue({
        windowMs: 3600000,
        maxRequests: 10,
        keyPrefix: 'invitation_ip_rate_limit',
      });

      rateLimitService.checkRateLimit.mockResolvedValue(mockRateLimitResult);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Should use the first IP from x-forwarded-for
      expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
        '203.0.113.1',
        expect.any(Object),
      );
    });
  });
});
