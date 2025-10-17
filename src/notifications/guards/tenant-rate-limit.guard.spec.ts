import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRateLimitGuard } from './tenant-rate-limit.guard';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

describe('TenantRateLimitGuard', () => {
  let guard: TenantRateLimitGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      get: jest.fn(),
      getAll: jest.fn(),
      getAllAndMerge: jest.fn(),
      getAllAndOverride: jest.fn(),
    } as any;

    const mockOptions = {
      throttlers: [{ name: 'default', ttl: 300000, limit: 5 }],
      skipIf: () => false,
      ignoreUserAgents: [],
      storage: {
        increment: jest
          .fn()
          .mockResolvedValue({ totalHits: 1, timeToExpire: 300000 }),
      } as any,
    };

    guard = new TenantRateLimitGuard(
      mockOptions,
      mockOptions.storage, // storageService
      reflector,
      undefined, // TenantContextService
      undefined, // RateLimitingService
    );
  });

  describe('getTracker', () => {
    it('should return tenant ID when user is authenticated', async () => {
      const mockUser: RequestUser = {
        id: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        roles: [],
      };

      const mockRequest = {
        user: mockUser,
        ip: '127.0.0.1',
      };

      const tracker = await guard['getTracker'](mockRequest);
      expect(tracker).toBe('tenant-456');
    });

    it('should return IP address when user is not authenticated', async () => {
      const mockRequest = {
        user: null,
        ip: '127.0.0.1',
      };

      const tracker = await guard['getTracker'](mockRequest);
      expect(tracker).toBe('127.0.0.1');
    });

    it('should return IP address when user is undefined', async () => {
      const mockRequest = {
        ip: '192.168.1.1',
      };

      const tracker = await guard['getTracker'](mockRequest);
      expect(tracker).toBe('192.168.1.1');
    });
  });

  describe('shouldSkip', () => {
    it('should not skip rate limiting for regular tenants', async () => {
      reflector.get.mockReturnValue(false);

      const mockUser: RequestUser = {
        id: 'user-123',
        tenantId: 'tenant-456',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        roles: [],
      };

      const mockRequest = {
        user: mockUser,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
      } as ExecutionContext;

      const shouldSkip = await guard['shouldSkip'](mockContext);
      expect(shouldSkip).toBe(false);
    });

    it('should not skip rate limiting when user is not authenticated', async () => {
      reflector.get.mockReturnValue(false);

      const mockRequest = {
        user: null,
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
      } as ExecutionContext;

      const shouldSkip = await guard['shouldSkip'](mockContext);
      expect(shouldSkip).toBe(false); // Should not skip when no user
    });
  });
});
