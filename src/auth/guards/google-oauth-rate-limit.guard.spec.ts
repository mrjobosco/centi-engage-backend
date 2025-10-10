import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GoogleOAuthRateLimitGuard } from './google-oauth-rate-limit.guard';
import { GoogleOAuthRateLimitService } from '../services/google-oauth-rate-limit.service';
import {
  GoogleOAuthError,
  GoogleOAuthErrorCode,
} from '../errors/google-oauth.error';

describe('GoogleOAuthRateLimitGuard', () => {
  let guard: GoogleOAuthRateLimitGuard;
  let mockRateLimitService: any;
  let mockReflector: any;

  beforeEach(async () => {
    mockRateLimitService = {
      checkIpRateLimit: jest.fn(),
      checkTenantRateLimit: jest.fn(),
    };

    mockReflector = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthRateLimitGuard,
        {
          provide: GoogleOAuthRateLimitService,
          useValue: mockRateLimitService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<GoogleOAuthRateLimitGuard>(GoogleOAuthRateLimitGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    let mockContext: ExecutionContext;
    let mockRequest: any;
    let mockResponse: any;

    beforeEach(() => {
      mockRequest = {
        path: '/auth/google',
        method: 'GET',
        headers: {},
        connection: { remoteAddress: '192.168.1.1' },
        body: {},
        query: {},
        params: {},
      };

      mockResponse = {
        setHeader: jest.fn(),
      };

      mockContext = {
        getHandler: jest.fn(),
        switchToHttp: jest.fn(() => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        })),
      } as any;
    });

    it('should skip rate limiting when decorator is present', async () => {
      mockReflector.get.mockReturnValue(true);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRateLimitService.checkIpRateLimit).not.toHaveBeenCalled();
    });

    it('should allow request when under rate limit', async () => {
      mockReflector.get.mockReturnValue(false);
      mockRateLimitService.checkIpRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000,
        totalHits: 5,
        config: { maxRequests: 10 },
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRateLimitService.checkIpRateLimit).toHaveBeenCalledWith(
        '192.168.1.1',
        'oauth_initiate',
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        10,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        5,
      );
    });

    it('should deny request when over rate limit', async () => {
      mockReflector.get.mockReturnValue(false);
      mockRateLimitService.checkIpRateLimit.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + 60000,
        totalHits: 10,
        config: { maxRequests: 10 },
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        GoogleOAuthError,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        expect.objectContaining({
          code: GoogleOAuthErrorCode.RATE_LIMIT_EXCEEDED,
        }),
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Retry-After',
        expect.any(Number),
      );
    });

    it('should check both IP and tenant rate limits when tenant ID is available', async () => {
      mockReflector.get.mockReturnValue(false);
      mockRequest.headers['x-tenant-id'] = 'tenant-123';

      const ipResult = {
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000,
        totalHits: 5,
        config: { maxRequests: 10 },
      };

      const tenantResult = {
        allowed: true,
        remaining: 20,
        resetTime: Date.now() + 60000,
        totalHits: 30,
        config: { maxRequests: 50 },
      };

      mockRateLimitService.checkIpRateLimit.mockResolvedValue(ipResult);
      mockRateLimitService.checkTenantRateLimit.mockResolvedValue(tenantResult);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRateLimitService.checkIpRateLimit).toHaveBeenCalledWith(
        '192.168.1.1',
        'oauth_initiate',
      );
      expect(mockRateLimitService.checkTenantRateLimit).toHaveBeenCalledWith(
        'tenant-123',
        'oauth_initiate',
      );
    });

    it('should use most restrictive result when both IP and tenant limits are checked', async () => {
      mockReflector.get.mockReturnValue(false);
      mockRequest.headers['x-tenant-id'] = 'tenant-123';

      const ipResult = {
        allowed: false, // IP limit exceeded
        remaining: 0,
        resetTime: Date.now() + 60000,
        totalHits: 10,
        config: { maxRequests: 10 },
      };

      const tenantResult = {
        allowed: true, // Tenant limit OK
        remaining: 20,
        resetTime: Date.now() + 60000,
        totalHits: 30,
        config: { maxRequests: 50 },
      };

      mockRateLimitService.checkIpRateLimit.mockResolvedValue(ipResult);
      mockRateLimitService.checkTenantRateLimit.mockResolvedValue(tenantResult);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        GoogleOAuthError,
      );
    });

    it('should fail open when rate limiting service throws error', async () => {
      mockReflector.get.mockReturnValue(false);
      mockRateLimitService.checkIpRateLimit.mockRejectedValue(
        new Error('Redis error'),
      );

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should extract client IP from various headers', async () => {
      mockReflector.get.mockReturnValue(false);
      mockRequest.headers['x-forwarded-for'] = '203.0.113.1, 192.168.1.1';
      mockRateLimitService.checkIpRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000,
        totalHits: 5,
        config: { maxRequests: 10 },
      });

      await guard.canActivate(mockContext);

      expect(mockRateLimitService.checkIpRateLimit).toHaveBeenCalledWith(
        '203.0.113.1', // First IP from x-forwarded-for
        'oauth_initiate',
      );
    });

    it('should extract client IP from x-real-ip header', async () => {
      mockReflector.get.mockReturnValue(false);
      mockRequest.headers['x-real-ip'] = '203.0.113.2';
      mockRateLimitService.checkIpRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000,
        totalHits: 5,
        config: { maxRequests: 10 },
      });

      await guard.canActivate(mockContext);

      expect(mockRateLimitService.checkIpRateLimit).toHaveBeenCalledWith(
        '203.0.113.2',
        'oauth_initiate',
      );
    });

    it('should determine correct operation type from request path', async () => {
      const testCases = [
        { path: '/auth/google', method: 'GET', expected: 'oauth_initiate' },
        {
          path: '/auth/google/callback',
          method: 'POST',
          expected: 'oauth_callback',
        },
        { path: '/auth/google/link', method: 'GET', expected: 'link_initiate' },
        {
          path: '/auth/google/link/callback',
          method: 'POST',
          expected: 'link_callback',
        },
        { path: '/auth/google/unlink', method: 'POST', expected: 'unlink' },
        {
          path: '/tenants/123/settings/google',
          method: 'PATCH',
          expected: 'admin_settings',
        },
        { path: '/unknown/path', method: 'GET', expected: 'general' },
      ];

      mockReflector.get.mockReturnValue(false);
      mockRateLimitService.checkIpRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000,
        totalHits: 5,
        config: { maxRequests: 10 },
      });

      for (const testCase of testCases) {
        mockRequest.path = testCase.path;
        mockRequest.method = testCase.method;

        await guard.canActivate(mockContext);

        expect(mockRateLimitService.checkIpRateLimit).toHaveBeenCalledWith(
          expect.any(String),
          testCase.expected,
        );
      }
    });

    it('should extract tenant ID from various sources', async () => {
      const testCases = [
        { source: 'headers', key: 'x-tenant-id', value: 'tenant-from-header' },
        { source: 'body', key: 'tenantId', value: 'tenant-from-body' },
        { source: 'query', key: 'tenantId', value: 'tenant-from-query' },
        { source: 'params', key: 'tenantId', value: 'tenant-from-params' },
      ];

      mockReflector.get.mockReturnValue(false);
      mockRateLimitService.checkIpRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 5,
        resetTime: Date.now() + 60000,
        totalHits: 5,
        config: { maxRequests: 10 },
      });
      mockRateLimitService.checkTenantRateLimit.mockResolvedValue({
        allowed: true,
        remaining: 20,
        resetTime: Date.now() + 60000,
        totalHits: 30,
        config: { maxRequests: 50 },
      });

      for (const testCase of testCases) {
        // Reset request object
        mockRequest = {
          path: '/auth/google',
          method: 'GET',
          headers: {},
          connection: { remoteAddress: '192.168.1.1' },
          body: {},
          query: {},
          params: {},
        };

        // Set tenant ID in the specific source
        mockRequest[testCase.source][testCase.key] = testCase.value;

        await guard.canActivate(mockContext);

        expect(mockRateLimitService.checkTenantRateLimit).toHaveBeenCalledWith(
          testCase.value,
          'oauth_initiate',
        );
      }
    });
  });
});
