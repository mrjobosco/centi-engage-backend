import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantManagementRateLimitGuard } from './tenant-management-rate-limit.guard';
import { TenantManagementRateLimitService } from '../services/tenant-management-rate-limit.service';

describe('TenantManagementRateLimitGuard', () => {
  let guard: TenantManagementRateLimitGuard;
  let mockRateLimitService: jest.Mocked<TenantManagementRateLimitService>;
  let mockReflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    mockRateLimitService = {
      checkTenantCreationRateLimit: jest.fn(),
      checkTenantJoiningRateLimit: jest.fn(),
      checkInvitationAcceptanceRateLimit: jest.fn(),
    } as any;

    mockReflector = {
      get: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantManagementRateLimitGuard,
        {
          provide: TenantManagementRateLimitService,
          useValue: mockRateLimitService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<TenantManagementRateLimitGuard>(
      TenantManagementRateLimitGuard,
    );
  });

  const createMockExecutionContext = (
    user?: any,
    rateLimitOptions?: any,
  ): ExecutionContext => {
    const mockRequest = {
      user,
    };
    const mockResponse = {
      setHeader: jest.fn(),
    };

    mockReflector.get.mockReturnValue(rateLimitOptions);

    return {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
      getHandler: () => ({}),
    } as any;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow request when no user is present', async () => {
    const context = createMockExecutionContext();
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow request when no rate limit configuration is present', async () => {
    const user = { userId: 'user-123', roles: [] };
    const context = createMockExecutionContext(user);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow request when user is admin and skipForAdmin is true', async () => {
    const user = {
      userId: 'user-123',
      roles: [{ name: 'admin' }],
    };
    const rateLimitOptions = {
      operation: 'creation',
      skipForAdmin: true,
    };
    const context = createMockExecutionContext(user, rateLimitOptions);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(
      mockRateLimitService.checkTenantCreationRateLimit,
    ).not.toHaveBeenCalled();
  });

  it('should check tenant creation rate limit', async () => {
    const user = { userId: 'user-123', roles: [] };
    const rateLimitOptions = { operation: 'creation' };
    const context = createMockExecutionContext(user, rateLimitOptions);

    mockRateLimitService.checkTenantCreationRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetTime: Date.now() + 3600000,
      totalHits: 1,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(
      mockRateLimitService.checkTenantCreationRateLimit,
    ).toHaveBeenCalledWith('user-123');
  });

  it('should check tenant joining rate limit', async () => {
    const user = { userId: 'user-123', roles: [] };
    const rateLimitOptions = { operation: 'joining' };
    const context = createMockExecutionContext(user, rateLimitOptions);

    mockRateLimitService.checkTenantJoiningRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 3600000,
      totalHits: 1,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(
      mockRateLimitService.checkTenantJoiningRateLimit,
    ).toHaveBeenCalledWith('user-123');
  });

  it('should check invitation acceptance rate limit', async () => {
    const user = { userId: 'user-123', roles: [] };
    const rateLimitOptions = { operation: 'invitation' };
    const context = createMockExecutionContext(user, rateLimitOptions);

    mockRateLimitService.checkInvitationAcceptanceRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 3600000,
      totalHits: 1,
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(
      mockRateLimitService.checkInvitationAcceptanceRateLimit,
    ).toHaveBeenCalledWith('user-123');
  });

  it('should throw exception when rate limit is exceeded', async () => {
    const user = { userId: 'user-123', roles: [] };
    const rateLimitOptions = { operation: 'creation' };
    const context = createMockExecutionContext(user, rateLimitOptions);

    const resetTime = Date.now() + 3600000;
    mockRateLimitService.checkTenantCreationRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime,
      totalHits: 3,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

    try {
      await guard.canActivate(context);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(error.getResponse()).toMatchObject({
        message: expect.stringContaining(
          'Rate limit exceeded for creation operation',
        ),
        error: 'Tenant Management Rate Limit Exceeded',
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        details: {
          operation: 'creation',
          retryAfter: expect.any(Number),
          remaining: 0,
          resetTime,
          totalHits: 3,
        },
      });
    }
  });

  it('should set rate limit headers when request is allowed', async () => {
    const user = { userId: 'user-123', roles: [] };
    const rateLimitOptions = { operation: 'creation' };
    const context = createMockExecutionContext(user, rateLimitOptions);

    const resetTime = Date.now() + 3600000;
    mockRateLimitService.checkTenantCreationRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 2,
      resetTime,
      totalHits: 1,
    });

    const result = await guard.canActivate(context);
    const response = context.switchToHttp().getResponse();

    expect(result).toBe(true);
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 1);
    expect(response.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 2);
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Reset',
      new Date(resetTime).toISOString(),
    );
  });

  describe('isAdminUser', () => {
    it('should identify admin user with string role', async () => {
      const user = {
        userId: 'user-123',
        roles: ['admin'],
      };
      const rateLimitOptions = {
        operation: 'creation',
        skipForAdmin: true,
      };
      const context = createMockExecutionContext(user, rateLimitOptions);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(
        mockRateLimitService.checkTenantCreationRateLimit,
      ).not.toHaveBeenCalled();
    });

    it('should identify admin user with object role', async () => {
      const user = {
        userId: 'user-123',
        roles: [{ name: 'Admin' }],
      };
      const rateLimitOptions = {
        operation: 'creation',
        skipForAdmin: true,
      };
      const context = createMockExecutionContext(user, rateLimitOptions);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(
        mockRateLimitService.checkTenantCreationRateLimit,
      ).not.toHaveBeenCalled();
    });

    it('should not skip rate limiting for non-admin users', async () => {
      const user = {
        userId: 'user-123',
        roles: [{ name: 'Member' }],
      };
      const rateLimitOptions = {
        operation: 'creation',
        skipForAdmin: true,
      };
      const context = createMockExecutionContext(user, rateLimitOptions);

      mockRateLimitService.checkTenantCreationRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 2,
        resetTime: Date.now() + 3600000,
        totalHits: 1,
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(
        mockRateLimitService.checkTenantCreationRateLimit,
      ).toHaveBeenCalledWith('user-123');
    });
  });
});
