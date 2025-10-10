import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminRoleGuard } from './admin-role.guard';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

describe('AdminRoleGuard', () => {
  let guard: AdminRoleGuard;
  let prismaService: jest.Mocked<PrismaService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findFirst: jest.fn(),
      },
    };

    const mockTenantContextService = {
      getTenantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminRoleGuard,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TenantContextService, useValue: mockTenantContextService },
      ],
    }).compile();

    guard = module.get<AdminRoleGuard>(AdminRoleGuard);
    prismaService = module.get(PrismaService);
    tenantContextService = module.get(TenantContextService);
  });

  const createMockContext = (user: RequestUser | null): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    const mockUser: RequestUser = {
      id: 'user-123',
      tenantId: 'tenant-123',
      email: 'admin@example.com',
    };

    it('should throw ForbiddenException when user is not authenticated', async () => {
      const context = createMockContext(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('User not authenticated'),
      );
    });

    it('should throw ForbiddenException when tenant context is missing', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Tenant context is required'),
      );
    });

    it('should throw ForbiddenException when user is not found in tenant', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('User not found in tenant'),
      );
    });

    it('should allow access when user has admin role', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('tenant-123');

      const mockUserWithRoles = {
        id: 'user-123',
        roles: [
          {
            role: {
              name: 'Admin',
              permissions: [],
            },
          },
        ],
      };

      prismaService.user.findFirst.mockResolvedValue(mockUserWithRoles as any);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow access when user has notification management permission', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('tenant-123');

      const mockUserWithRoles = {
        id: 'user-123',
        roles: [
          {
            role: {
              name: 'Manager',
              permissions: [
                {
                  permission: {
                    action: 'manage',
                    subject: 'notification',
                  },
                },
              ],
            },
          },
        ],
      };

      prismaService.user.findFirst.mockResolvedValue(mockUserWithRoles as any);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow access when user has notification broadcast permission', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('tenant-123');

      const mockUserWithRoles = {
        id: 'user-123',
        roles: [
          {
            role: {
              name: 'Broadcaster',
              permissions: [
                {
                  permission: {
                    action: 'broadcast',
                    subject: 'notification',
                  },
                },
              ],
            },
          },
        ],
      };

      prismaService.user.findFirst.mockResolvedValue(mockUserWithRoles as any);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should allow access when user has tenant management permission', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('tenant-123');

      const mockUserWithRoles = {
        id: 'user-123',
        roles: [
          {
            role: {
              name: 'TenantManager',
              permissions: [
                {
                  permission: {
                    action: 'manage',
                    subject: 'tenant',
                  },
                },
              ],
            },
          },
        ],
      };

      prismaService.user.findFirst.mockResolvedValue(mockUserWithRoles as any);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user has no admin permissions', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('tenant-123');

      const mockUserWithRoles = {
        id: 'user-123',
        roles: [
          {
            role: {
              name: 'User',
              permissions: [
                {
                  permission: {
                    action: 'read',
                    subject: 'user',
                  },
                },
              ],
            },
          },
        ],
      };

      prismaService.user.findFirst.mockResolvedValue(mockUserWithRoles as any);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException(
          'Admin role or notification management permissions required',
        ),
      );
    });

    it('should throw ForbiddenException when database error occurs', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
      prismaService.user.findFirst.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Access denied'),
      );
    });
  });
});
