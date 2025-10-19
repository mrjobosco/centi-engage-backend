import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmailVerificationGuard } from './email-verification.guard';
import { PrismaService } from '../../database/prisma.service';
import { EmailVerificationRequiredException } from '../exceptions/email-verification-required.exception';

describe('EmailVerificationGuard', () => {
  let guard: EmailVerificationGuard;
  let reflector: Reflector;
  let prisma: PrismaService;

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
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true when route is marked to skip email verification', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = createMockExecutionContext({
        id: 'user-1',
        tenantId: 'tenant-1',
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        'skipEmailVerification',
        [context.getHandler(), context.getClass()],
      );
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });

    it('should return true when no user is attached to request', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockExecutionContext(null);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });

    it('should return true when user is attached but undefined', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);

      const context = createMockExecutionContext(undefined);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });

    it('should return true when user email is verified', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
        expect.anything(), // The template literal query
        user.id,
        user.tenantId,
      );
    });

    it('should throw EmailVerificationRequiredException when user email is not verified', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([
        { email_verified: false },
      ]);

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);

      await expect(guard.canActivate(context)).rejects.toThrow(
        EmailVerificationRequiredException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Please verify your email address before accessing this resource. Check your email for the verification code.',
      );
    });

    it('should throw EmailVerificationRequiredException when user is not found', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);

      await expect(guard.canActivate(context)).rejects.toThrow(
        EmailVerificationRequiredException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw EmailVerificationRequiredException when query returns null', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue(null);

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);

      await expect(guard.canActivate(context)).rejects.toThrow(
        EmailVerificationRequiredException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User not found',
      );
    });

    it('should handle database errors gracefully', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should check reflector metadata correctly for method and class level decorators', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = createMockExecutionContext({
        id: 'user-1',
        tenantId: 'tenant-1',
      });
      await guard.canActivate(context);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        'skipEmailVerification',
        [context.getHandler(), context.getClass()],
      );
    });

    it('should work with different user object structures', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      // Test with user object that has additional properties
      const user = {
        id: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@example.com',
        name: 'Test User',
      };
      const context = createMockExecutionContext(user);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
        expect.anything(),
        user.id,
        user.tenantId,
      );
    });
  });

  describe('reflector integration', () => {
    it('should prioritize method-level skip decorator over class-level', async () => {
      // Simulate method-level decorator taking precedence
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const context = createMockExecutionContext({
        id: 'user-1',
        tenantId: 'tenant-1',
      });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        'skipEmailVerification',
        [context.getHandler(), context.getClass()],
      );
    });

    it('should handle when reflector returns undefined', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle when reflector returns false explicitly', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      const user = { id: 'user-1', tenantId: 'tenant-1' };
      const context = createMockExecutionContext(user);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('database query validation', () => {
    it('should use correct SQL query structure', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      const user = { id: 'user-123', tenantId: 'tenant-456' };
      const context = createMockExecutionContext(user);
      await guard.canActivate(context);

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
        expect.anything(),
        'user-123',
        'tenant-456',
      );

      // Verify the query was called with the expected parameters
      const callArgs = mockPrismaService.$queryRaw.mock.calls[0];
      expect(callArgs).toHaveLength(3); // query template + 2 parameters
      expect(callArgs[1]).toBe('user-123');
      expect(callArgs[2]).toBe('tenant-456');
    });

    it('should handle special characters in user IDs', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(false);
      mockPrismaService.$queryRaw.mockResolvedValue([{ email_verified: true }]);

      const user = {
        id: 'user-with-special-chars-123!@#',
        tenantId: 'tenant-with-dashes-456',
      };
      const context = createMockExecutionContext(user);
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
        expect.anything(),
        'user-with-special-chars-123!@#',
        'tenant-with-dashes-456',
      );
    });
  });
});
