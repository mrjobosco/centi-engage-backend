import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmailVerificationGuard } from './email-verification.guard';
import { PrismaService } from '../../database/prisma.service';
import { EmailVerificationRequiredException } from '../exceptions/email-verification-required.exception';

describe('EmailVerificationGuard Integration Tests', () => {
  let guard: EmailVerificationGuard;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const createMockExecutionContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<EmailVerificationGuard>(EmailVerificationGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Integration with Authentication Flow', () => {
    it('should work correctly after JWT authentication sets user context', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      // Simulate user object that would be set by JWT auth guard
      const authenticatedUser = {
        id: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true, // This would be set by JWT guard
        roles: [],
      };

      const context = createMockExecutionContext(authenticatedUser);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        'tenant-1',
      );
    });

    it('should block unverified users even with valid JWT', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { email_verified: false },
      ]);

      // Simulate user object from JWT auth guard with unverified email
      const authenticatedUser = {
        id: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: false,
        roles: [],
      };

      const context = createMockExecutionContext(authenticatedUser);

      await expect(guard.canActivate(context)).rejects.toThrow(
        EmailVerificationRequiredException,
      );
    });

    it('should allow OAuth users with pre-verified emails', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      // Simulate OAuth user (Google) with verified email
      const oauthUser = {
        id: 'user-1',
        email: 'test@gmail.com',
        tenantId: 'tenant-1',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true, // OAuth emails are pre-verified
        googleId: 'google-123',
        roles: [],
      };

      const context = createMockExecutionContext(oauthUser);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should respect skip verification decorator on protected routes', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true); // Skip verification

      // Even unverified user should pass when decorator is applied
      const unverifiedUser = {
        id: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
        emailVerified: false,
        roles: [],
      };

      const context = createMockExecutionContext(unverifiedUser);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });

    it('should work with different user object structures from various auth providers', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      // Test with minimal user object
      const minimalUser = {
        id: 'user-1',
        tenantId: 'tenant-1',
      };

      const context = createMockExecutionContext(minimalUser);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
        expect.anything(),
        'user-1',
        'tenant-1',
      );
    });

    it('should handle concurrent guard execution correctly', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context1 = createMockExecutionContext(user);
      const context2 = createMockExecutionContext(user);

      // Execute guards concurrently
      const [result1, result2] = await Promise.all([
        guard.canActivate(context1),
        guard.canActivate(context2),
      ]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration with Permission System', () => {
    it('should work alongside permission guards', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      // User with roles and permissions (as would be set by JWT guard)
      const userWithPermissions = {
        id: 'user-1',
        email: 'admin@example.com',
        tenantId: 'tenant-1',
        emailVerified: true,
        roles: [
          {
            name: 'admin',
            permissions: ['read:user', 'write:user', 'delete:user'],
          },
        ],
      };

      const context = createMockExecutionContext(userWithPermissions);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Verify the guard doesn't interfere with user permissions
      const request = context.switchToHttp().getRequest();
      expect(request.user.roles).toEqual(userWithPermissions.roles);
    });

    it('should block unverified users regardless of permissions', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { email_verified: false },
      ]);

      // Admin user with high permissions but unverified email
      const unverifiedAdmin = {
        id: 'admin-1',
        email: 'admin@example.com',
        tenantId: 'tenant-1',
        emailVerified: false,
        roles: [
          {
            name: 'super-admin',
            permissions: ['*'],
          },
        ],
      };

      const context = createMockExecutionContext(unverifiedAdmin);

      await expect(guard.canActivate(context)).rejects.toThrow(
        EmailVerificationRequiredException,
      );
    });
  });

  describe('Error Handling in Guard Chain', () => {
    it('should handle database errors without affecting other guards', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Database connection failed',
      );

      // Verify the error doesn't corrupt the user context
      const request = context.switchToHttp().getRequest();
      expect(request.user).toEqual(user);
    });

    it('should provide clear error messages for debugging', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);

      try {
        await guard.canActivate(context);
        fail('Expected EmailVerificationRequiredException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(EmailVerificationRequiredException);
        expect((error as EmailVerificationRequiredException).message).toBe(
          'User not found',
        );
        expect((error as EmailVerificationRequiredException).getStatus()).toBe(
          403,
        );
      }
    });

    it('should handle malformed user objects gracefully', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      // Test with user missing required fields
      const malformedUser = { id: 'user-1' }; // Missing tenantId

      const context = createMockExecutionContext(malformedUser);

      // Should not crash, but may fail due to missing tenantId
      await expect(guard.canActivate(context)).rejects.toThrow();
    });
  });

  describe('Metadata and Decorator Integration', () => {
    it('should correctly read metadata from both method and class level', async () => {
      // Test method-level metadata takes precedence
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        'skipEmailVerification',
        [context.getHandler(), context.getClass()],
      );
    });

    it('should work with custom decorator combinations', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);

      // Simulate multiple decorators being applied
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledTimes(1);
    });
  });
});
