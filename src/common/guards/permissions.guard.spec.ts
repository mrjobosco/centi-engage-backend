import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PrismaService } from '../../database/prisma.service';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;

  const mockPrismaService = {
    permission: {
      findMany: jest.fn(),
    },
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
        PermissionsGuard,
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

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should return true when no permissions are required', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const context = createMockExecutionContext({ id: 'user-1' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.permission.findMany).not.toHaveBeenCalled();
    });

    it('should return true when empty permissions array is required', async () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);

      const context = createMockExecutionContext({ id: 'user-1' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.permission.findMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user is not authenticated', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['read:user']);

      const context = createMockExecutionContext(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User not authenticated',
      );
    });

    it('should authorize user with role-based permissions only', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['read:user']);

      // Mock role-based permissions
      mockPrismaService.permission.findMany
        .mockResolvedValueOnce([
          { action: 'read', subject: 'user' },
          { action: 'create', subject: 'user' },
        ])
        // Mock user-specific permissions (empty)
        .mockResolvedValueOnce([]);

      const context = createMockExecutionContext({ id: 'user-1' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.permission.findMany).toHaveBeenCalledTimes(2);
    });

    it('should authorize user with user-specific permissions only', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['update:project']);

      // Mock role-based permissions (empty)
      mockPrismaService.permission.findMany
        .mockResolvedValueOnce([])
        // Mock user-specific permissions
        .mockResolvedValueOnce([{ action: 'update', subject: 'project' }]);

      const context = createMockExecutionContext({ id: 'user-1' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.permission.findMany).toHaveBeenCalledTimes(2);
    });

    it('should authorize user with combination of role-based and user-specific permissions', async () => {
      mockReflector.getAllAndOverride.mockReturnValue([
        'read:user',
        'update:project',
      ]);

      // Mock role-based permissions
      mockPrismaService.permission.findMany
        .mockResolvedValueOnce([{ action: 'read', subject: 'user' }])
        // Mock user-specific permissions
        .mockResolvedValueOnce([{ action: 'update', subject: 'project' }]);

      const context = createMockExecutionContext({ id: 'user-1' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockPrismaService.permission.findMany).toHaveBeenCalledTimes(2);
    });

    it('should deny access when permission is missing', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['delete:user']);

      // Mock role-based permissions
      mockPrismaService.permission.findMany
        .mockResolvedValueOnce([{ action: 'read', subject: 'user' }])
        // Mock user-specific permissions (empty)
        .mockResolvedValueOnce([]);

      const context = createMockExecutionContext({ id: 'user-1' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Missing required permissions: delete:user'),
      );
    });

    it('should check all required permissions when multiple are specified', async () => {
      mockReflector.getAllAndOverride.mockReturnValue([
        'read:user',
        'update:user',
        'delete:user',
      ]);

      // Mock role-based permissions (only has read and update)
      mockPrismaService.permission.findMany
        .mockResolvedValueOnce([
          { action: 'read', subject: 'user' },
          { action: 'update', subject: 'user' },
        ])
        // Mock user-specific permissions (empty)
        .mockResolvedValueOnce([]);

      const context = createMockExecutionContext({ id: 'user-1' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException(
          'Missing required permissions: read:user, update:user, delete:user',
        ),
      );
    });

    it('should authorize when all multiple required permissions are present', async () => {
      mockReflector.getAllAndOverride.mockReturnValue([
        'read:user',
        'update:user',
      ]);

      // Mock role-based permissions
      mockPrismaService.permission.findMany
        .mockResolvedValueOnce([
          { action: 'read', subject: 'user' },
          { action: 'update', subject: 'user' },
          { action: 'delete', subject: 'user' },
        ])
        // Mock user-specific permissions (empty)
        .mockResolvedValueOnce([]);

      const context = createMockExecutionContext({ id: 'user-1' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('getEffectivePermissions', () => {
    it('should calculate effective permissions correctly', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['read:user']);

      // Mock role-based permissions
      mockPrismaService.permission.findMany
        .mockResolvedValueOnce([
          { action: 'read', subject: 'user' },
          { action: 'create', subject: 'project' },
        ])
        // Mock user-specific permissions
        .mockResolvedValueOnce([
          { action: 'update', subject: 'user' },
          { action: 'delete', subject: 'project' },
        ]);

      const context = createMockExecutionContext({ id: 'user-1' });
      await guard.canActivate(context);

      // Verify both queries were made
      expect(mockPrismaService.permission.findMany).toHaveBeenCalledTimes(2);

      // Verify role-based permissions query
      expect(mockPrismaService.permission.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          roles: {
            some: {
              role: {
                users: {
                  some: {
                    userId: 'user-1',
                  },
                },
              },
            },
          },
        },
        select: {
          action: true,
          subject: true,
        },
      });

      // Verify user-specific permissions query
      expect(mockPrismaService.permission.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          users: {
            some: {
              userId: 'user-1',
            },
          },
        },
        select: {
          action: true,
          subject: true,
        },
      });
    });

    it('should remove duplicate permissions from effective permissions', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(['read:user']);

      // Mock role-based permissions with duplicate
      mockPrismaService.permission.findMany
        .mockResolvedValueOnce([{ action: 'read', subject: 'user' }])
        // Mock user-specific permissions with same duplicate
        .mockResolvedValueOnce([{ action: 'read', subject: 'user' }]);

      const context = createMockExecutionContext({ id: 'user-1' });
      const result = await guard.canActivate(context);

      // Should still authorize (duplicates handled correctly)
      expect(result).toBe(true);
    });
  });
});
