import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerOptions } from '@nestjs/throttler';
import { NotificationRateLimitGuard } from './notification-rate-limit.guard';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

describe('NotificationRateLimitGuard', () => {
  let guard: NotificationRateLimitGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      get: jest.fn(),
      getAll: jest.fn(),
      getAllAndMerge: jest.fn(),
      getAllAndOverride: jest.fn(),
    } as any;

    const mockOptions = {
      throttlers: [{ name: 'default', ttl: 60000, limit: 10 }],
      skipIf: () => false,
      ignoreUserAgents: [],
      storage: {
        increment: jest
          .fn()
          .mockResolvedValue({ totalHits: 1, timeToExpire: 60000 }),
      } as any,
    };

    guard = new NotificationRateLimitGuard(
      mockOptions,
      mockOptions.storage, // storageService
      reflector,
      undefined, // RateLimitingService
    );
  });

  describe('getTracker', () => {
    it('should return user ID when user is authenticated', async () => {
      const mockUser: RequestUser = {
        id: 'user-123',
        tenantId: 'tenant-123',
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
      expect(tracker).toBe('user-123');
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
    it('should not skip rate limiting for regular users', async () => {
      reflector.get.mockReturnValue(false);

      const mockUser: RequestUser = {
        id: 'user-123',
        tenantId: 'tenant-123',
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
      expect(shouldSkip).toBe(true); // Should skip when no user
    });
  });
});
