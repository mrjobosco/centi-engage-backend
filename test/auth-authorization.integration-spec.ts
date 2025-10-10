import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/database/prisma.service';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { UnauthorizedException, ExecutionContext, Scope } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '../src/tenant/tenant-context.service';
import { prisma } from './integration-setup';
import * as bcrypt from 'bcrypt';
import configuration from '../src/config/configuration';

describe('Authentication and Authorization Integration Tests', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let jwtAuthGuard: JwtAuthGuard;
  let permissionsGuard: PermissionsGuard;
  let prismaService: PrismaService;
  let reflector: Reflector;
  let mockTenantContext: any;

  let testTenant: any;
  let testUser: any;
  let adminRole: any;
  let memberRole: any;
  let testPermissions: any[];

  beforeAll(async () => {
    // Create mock tenant context that will be updated with actual tenant ID
    mockTenantContext = {
      setTenantId: jest.fn(),
      getTenantId: jest.fn(),
      getRequiredTenantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          isGlobal: true,
        }),
      ],
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: process.env.JWT_SECRET || 'test-secret-key',
            signOptions: { expiresIn: '15m' },
          }),
        },
        JwtAuthGuard,
        PermissionsGuard,
        Reflector,
        ConfigService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: TenantContextService,
          scope: Scope.REQUEST,
          useValue: mockTenantContext,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
    permissionsGuard = module.get<PermissionsGuard>(PermissionsGuard);
    prismaService = module.get<PrismaService>(PrismaService);
    reflector = module.get<Reflector>(Reflector);
  });

  beforeEach(async () => {
    // Create test tenant
    testTenant = await prismaService.tenant.create({
      data: {
        name: 'Test Tenant',
      },
    });

    // Update mock to return the actual tenant ID
    mockTenantContext.getTenantId.mockReturnValue(testTenant.id);
    mockTenantContext.getRequiredTenantId.mockReturnValue(testTenant.id);

    // Create test permissions
    testPermissions = await Promise.all([
      prismaService.permission.create({
        data: {
          action: 'read',
          subject: 'project',
          tenantId: testTenant.id,
        },
      }),
      prismaService.permission.create({
        data: {
          action: 'create',
          subject: 'project',
          tenantId: testTenant.id,
        },
      }),
      prismaService.permission.create({
        data: {
          action: 'update',
          subject: 'project',
          tenantId: testTenant.id,
        },
      }),
      prismaService.permission.create({
        data: {
          action: 'delete',
          subject: 'project',
          tenantId: testTenant.id,
        },
      }),
    ]);

    // Create test roles
    adminRole = await prismaService.role.create({
      data: {
        name: 'Admin',
        tenantId: testTenant.id,
      },
    });

    memberRole = await prismaService.role.create({
      data: {
        name: 'Member',
        tenantId: testTenant.id,
      },
    });

    // Assign all permissions to Admin role
    await Promise.all(
      testPermissions.map((perm) =>
        prismaService.rolePermission.create({
          data: {
            roleId: adminRole.id,
            permissionId: perm.id,
          },
        }),
      ),
    );

    // Assign only read permission to Member role
    await prismaService.rolePermission.create({
      data: {
        roleId: memberRole.id,
        permissionId: testPermissions[0].id, // read:project
      },
    });

    // Create test user with hashed password
    const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
    testUser = await prismaService.user.create({
      data: {
        email: 'test@example.com',
        password: hashedPassword,
        firstName: 'Test',
        lastName: 'User',
        tenantId: testTenant.id,
      },
    });

    // Assign Member role to test user
    await prismaService.userRole.create({
      data: {
        userId: testUser.id,
        roleId: memberRole.id,
      },
    });
  });

  describe('Login Flow', () => {
    it('should successfully login with valid credentials and generate JWT', async () => {
      // Arrange
      const loginDto = {
        email: 'test@example.com',
        password: 'TestPassword123!',
      };

      // Act
      const result = await authService.login(loginDto, testTenant.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');

      // Verify JWT can be decoded
      const decoded = jwtService.decode(result.accessToken);
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.tenantId).toBe(testTenant.id);
      expect(decoded.roles).toEqual([memberRole.id]);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      // Arrange
      const loginDto = {
        email: 'test@example.com',
        password: 'WrongPassword',
      };

      // Act & Assert
      await expect(authService.login(loginDto, testTenant.id)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.login(loginDto, testTenant.id)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      // Arrange
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'TestPassword123!',
      };

      // Act & Assert
      await expect(authService.login(loginDto, testTenant.id)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(authService.login(loginDto, testTenant.id)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should include role IDs in JWT payload', async () => {
      // Arrange - Create user with multiple roles
      const adminUser = await prismaService.user.create({
        data: {
          email: 'admin@example.com',
          password: await bcrypt.hash('AdminPass123!', 10),
          firstName: 'Admin',
          lastName: 'User',
          tenantId: testTenant.id,
        },
      });

      await prismaService.userRole.createMany({
        data: [
          { userId: adminUser.id, roleId: adminRole.id },
          { userId: adminUser.id, roleId: memberRole.id },
        ],
      });

      const loginDto = {
        email: 'admin@example.com',
        password: 'AdminPass123!',
      };

      // Act
      const result = await authService.login(loginDto, testTenant.id);

      // Assert
      const decoded = jwtService.decode(result.accessToken);
      expect(decoded.roles).toHaveLength(2);
      expect(decoded.roles).toContain(adminRole.id);
      expect(decoded.roles).toContain(memberRole.id);
    });
  });

  describe('JWT Validation', () => {
    it('should validate JWT and authenticate user', async () => {
      // Arrange
      const loginDto = { email: testUser.email, password: 'TestPassword123!' };
      const token = await authService.login(loginDto, testTenant.id);
      const mockRequest: any = {
        headers: {
          authorization: `Bearer ${token.accessToken}`,
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      // Act
      const canActivate = await jwtAuthGuard.canActivate(mockContext);

      // Assert
      expect(canActivate).toBe(true);
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user.id).toBe(testUser.id);
      expect(mockRequest.user.email).toBe(testUser.email);
      expect(mockRequest.user.tenantId).toBe(testTenant.id);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      // Arrange
      const mockRequest: any = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      // Act & Assert
      await expect(jwtAuthGuard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for missing token', async () => {
      // Arrange
      const mockRequest: any = {
        headers: {},
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;

      // Act & Assert
      await expect(jwtAuthGuard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Permissions Guard - Role-Based Permissions', () => {
    it('should allow access with role-based permission', async () => {
      // Arrange
      const mockContext = createMockExecutionContext(testUser, [
        'read:project',
      ]);

      // Act
      const result = await permissionsGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny access without required permission', async () => {
      // Arrange
      const mockContext = createMockExecutionContext(
        testUser,
        ['delete:project'], // User only has read:project
      );

      // Act & Assert
      await expect(permissionsGuard.canActivate(mockContext)).rejects.toThrow(
        'Missing required permissions: delete:project',
      );
    });

    it('should allow access when user has all required permissions', async () => {
      // Arrange - Create admin user with all permissions
      const adminUser = await prismaService.user.create({
        data: {
          email: 'admin2@example.com',
          password: await bcrypt.hash('AdminPass123!', 10),
          firstName: 'Admin',
          lastName: 'User',
          tenantId: testTenant.id,
        },
      });

      await prismaService.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      });

      const mockContext = createMockExecutionContext(adminUser, [
        'read:project',
        'create:project',
        'update:project',
      ]);

      // Act
      const result = await permissionsGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Permissions Guard - User-Specific Permissions', () => {
    it('should allow access with user-specific permission', async () => {
      // Arrange - Grant user-specific permission
      await prismaService.userPermission.create({
        data: {
          userId: testUser.id,
          permissionId: testPermissions[1].id, // create:project
        },
      });

      const mockContext = createMockExecutionContext(testUser, [
        'create:project',
      ]);

      // Act
      const result = await permissionsGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should calculate effective permissions from both roles and user-specific', async () => {
      // Arrange - Grant additional user-specific permissions
      await prismaService.userPermission.createMany({
        data: [
          { userId: testUser.id, permissionId: testPermissions[1].id }, // create:project
          { userId: testUser.id, permissionId: testPermissions[2].id }, // update:project
        ],
      });

      // User now has: read:project (from role) + create:project + update:project (user-specific)
      const mockContext = createMockExecutionContext(testUser, [
        'read:project',
        'create:project',
        'update:project',
      ]);

      // Act
      const result = await permissionsGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should deny access when permission is not in either role or user-specific', async () => {
      // Arrange - User has read:project from role, no user-specific permissions
      const mockContext = createMockExecutionContext(testUser, [
        'delete:project',
      ]);

      // Act & Assert
      await expect(permissionsGuard.canActivate(mockContext)).rejects.toThrow(
        'Missing required permissions: delete:project',
      );
    });
  });

  describe('Effective Permissions Calculation', () => {
    it('should compute UNION of role-based and user-specific permissions', async () => {
      // Arrange - User has read:project from Member role
      // Grant additional user-specific permissions
      await prismaService.userPermission.createMany({
        data: [
          { userId: testUser.id, permissionId: testPermissions[1].id }, // create:project
          { userId: testUser.id, permissionId: testPermissions[3].id }, // delete:project
        ],
      });

      // Get effective permissions using the guard's private method (via testing)
      const mockContext = createMockExecutionContext(testUser, [
        'read:project',
        'create:project',
        'delete:project',
      ]);

      // Act
      const result = await permissionsGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should remove duplicate permissions in effective set', async () => {
      // Arrange - Grant user-specific permission that user already has from role
      await prismaService.userPermission.create({
        data: {
          userId: testUser.id,
          permissionId: testPermissions[0].id, // read:project (already has from role)
        },
      });

      const mockContext = createMockExecutionContext(testUser, [
        'read:project',
      ]);

      // Act
      const result = await permissionsGuard.canActivate(mockContext);

      // Assert - Should still work without errors
      expect(result).toBe(true);
    });

    it('should handle user with no roles but user-specific permissions', async () => {
      // Arrange - Create user with no roles
      const noRoleUser = await prismaService.user.create({
        data: {
          email: 'norole@example.com',
          password: await bcrypt.hash('Password123!', 10),
          firstName: 'No',
          lastName: 'Role',
          tenantId: testTenant.id,
        },
      });

      // Grant user-specific permission
      await prismaService.userPermission.create({
        data: {
          userId: noRoleUser.id,
          permissionId: testPermissions[0].id, // read:project
        },
      });

      const mockContext = createMockExecutionContext(noRoleUser, [
        'read:project',
      ]);

      // Act
      const result = await permissionsGuard.canActivate(mockContext);

      // Assert
      expect(result).toBe(true);
    });
  });

  // Helper function to create mock execution context
  function createMockExecutionContext(
    user: any,
    requiredPermissions: string[],
  ): ExecutionContext {
    const mockRequest = {
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
      },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;

    // Mock reflector to return required permissions
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(requiredPermissions);

    return mockContext;
  }
});
