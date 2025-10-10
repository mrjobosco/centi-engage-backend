import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from '../src/tenant/tenant.service';
import { PrismaService } from '../src/database/prisma.service';
import { AuthAuditService } from '../src/auth/services/auth-audit.service';
import { ConflictException } from '@nestjs/common';
import { prisma } from './integration-setup';

describe('Tenant Provisioning Integration Tests', () => {
  let tenantService: TenantService;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuthAuditService,
          useValue: {
            logAuthEvent: jest.fn(),
            logPasswordLogin: jest.fn(),
            logGoogleSignIn: jest.fn(),
            logGoogleLink: jest.fn(),
            logGoogleUnlink: jest.fn(),
            logGoogleSettingsUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    tenantService = module.get<TenantService>(TenantService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('createTenant', () => {
    it('should create a complete tenant with all required records', async () => {
      // Arrange
      const input = {
        tenantName: 'Test Company',
        adminEmail: 'admin@testcompany.com',
        adminPassword: 'SecurePassword123!',
        adminFirstName: 'John',
        adminLastName: 'Doe',
      };

      // Act
      const result = await tenantService.createTenant(input);

      // Assert - Verify tenant was created
      expect(result.tenant).toBeDefined();
      expect(result.tenant.name).toBe(input.tenantName);
      expect(result.tenant.id).toBeDefined();

      // Assert - Verify admin user was created
      expect(result.adminUser).toBeDefined();
      expect(result.adminUser.email).toBe(input.adminEmail);
      expect(result.adminUser.firstName).toBe(input.adminFirstName);
      expect(result.adminUser.lastName).toBe(input.adminLastName);
      expect(result.adminUser.tenantId).toBe(result.tenant.id);
      expect((result.adminUser as any).password).toBeUndefined(); // Password should not be returned

      // Verify default permissions were created
      const permissions = await prismaService.permission.findMany({
        where: { tenantId: result.tenant.id },
      });
      expect(permissions).toHaveLength(15); // 15 default permissions

      // Verify specific permissions exist
      const permissionActions = permissions.map(
        (p) => `${p.action}:${p.subject}`,
      );
      expect(permissionActions).toContain('create:project');
      expect(permissionActions).toContain('read:project');
      expect(permissionActions).toContain('update:user');
      expect(permissionActions).toContain('delete:project');
      expect(permissionActions).toContain('create:user');
      expect(permissionActions).toContain('read:user');
      expect(permissionActions).toContain('delete:user');
      expect(permissionActions).toContain('create:role');
      expect(permissionActions).toContain('read:role');
      expect(permissionActions).toContain('update:role');
      expect(permissionActions).toContain('delete:role');
      expect(permissionActions).toContain('create:permission');
      expect(permissionActions).toContain('read:permission');
      expect(permissionActions).toContain('delete:permission');

      // Verify default roles were created
      const roles = await prismaService.role.findMany({
        where: { tenantId: result.tenant.id },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
      expect(roles).toHaveLength(2); // Admin and Member roles

      const adminRole = roles.find((r) => r.name === 'Admin');
      const memberRole = roles.find((r) => r.name === 'Member');

      expect(adminRole).toBeDefined();
      expect(memberRole).toBeDefined();

      // Verify Admin role has all permissions
      expect(adminRole!.permissions).toHaveLength(15);

      // Verify Member role has only read permissions
      expect(memberRole!.permissions.length).toBeGreaterThan(0);
      memberRole!.permissions.forEach((rp) => {
        expect(rp.permission.action).toBe('read');
      });

      // Verify admin user has Admin role assigned
      const userRoles = await prismaService.userRole.findMany({
        where: { userId: result.adminUser.id },
        include: { role: true },
      });
      expect(userRoles).toHaveLength(1);
      expect(userRoles[0].role.name).toBe('Admin');

      // Verify password was hashed
      const userWithPassword = await prismaService.user.findUnique({
        where: { id: result.adminUser.id },
      });
      expect(userWithPassword!.password).not.toBe(input.adminPassword);
      expect(userWithPassword!.password).toMatch(/^\$2[aby]\$/); // bcrypt hash pattern
    });

    it('should rollback transaction on failure', async () => {
      // Arrange - Create a tenant first
      const firstInput = {
        tenantName: 'First Tenant',
        adminEmail: 'admin@first.com',
        adminPassword: 'Password123!',
        adminFirstName: 'Jane',
        adminLastName: 'Smith',
      };
      const firstResult = await tenantService.createTenant(firstInput);

      // Now try to create the same tenant again (should fail due to duplicate tenant name)
      const duplicateInput = {
        tenantName: 'First Tenant', // Same name - will fail
        adminEmail: 'different@email.com',
        adminPassword: 'Password123!',
        adminFirstName: 'Bob',
        adminLastName: 'Johnson',
      };

      // Act & Assert
      await expect(tenantService.createTenant(duplicateInput)).rejects.toThrow(
        ConflictException,
      );

      // Verify that no additional tenant was created
      const tenants = await prismaService.tenant.findMany({
        where: { name: 'First Tenant' },
      });
      expect(tenants).toHaveLength(1);

      // Verify no orphaned records - count should match first tenant only
      const allPermissions = await prismaService.permission.findMany();
      const allRoles = await prismaService.role.findMany();

      // All permissions and roles should belong to the first tenant
      allPermissions.forEach((p) => {
        expect(p.tenantId).toBe(firstResult.tenant.id);
      });

      allRoles.forEach((r) => {
        expect(r.tenantId).toBe(firstResult.tenant.id);
      });
    });

    it('should throw ConflictException for duplicate tenant name', async () => {
      // Arrange - Create a tenant first
      const input = {
        tenantName: 'Unique Tenant',
        adminEmail: 'admin@unique.com',
        adminPassword: 'Password123!',
        adminFirstName: 'Alice',
        adminLastName: 'Williams',
      };
      await tenantService.createTenant(input);

      // Try to create another tenant with the same name
      const duplicateInput = {
        ...input,
        adminEmail: 'different@email.com', // Different email
      };

      // Act & Assert
      await expect(tenantService.createTenant(duplicateInput)).rejects.toThrow(
        ConflictException,
      );
      await expect(tenantService.createTenant(duplicateInput)).rejects.toThrow(
        'Tenant name already exists',
      );
    });

    it('should create default permissions correctly', async () => {
      // Arrange
      const input = {
        tenantName: 'Permission Test Tenant',
        adminEmail: 'admin@permtest.com',
        adminPassword: 'Password123!',
        adminFirstName: 'Test',
        adminLastName: 'User',
      };

      // Act
      const result = await tenantService.createTenant(input);

      // Assert - Verify all required default permissions
      const permissions = await prismaService.permission.findMany({
        where: { tenantId: result.tenant.id },
      });

      const expectedPermissions = [
        { action: 'create', subject: 'project' },
        { action: 'read', subject: 'project' },
        { action: 'update', subject: 'project' },
        { action: 'delete', subject: 'project' },
        { action: 'create', subject: 'user' },
        { action: 'read', subject: 'user' },
        { action: 'update', subject: 'user' },
        { action: 'delete', subject: 'user' },
        { action: 'create', subject: 'role' },
        { action: 'read', subject: 'role' },
        { action: 'update', subject: 'role' },
        { action: 'delete', subject: 'role' },
        { action: 'create', subject: 'permission' },
        { action: 'read', subject: 'permission' },
        { action: 'delete', subject: 'permission' },
      ];

      expectedPermissions.forEach((expected) => {
        const found = permissions.find(
          (p) => p.action === expected.action && p.subject === expected.subject,
        );
        expect(found).toBeDefined();
        expect(found!.tenantId).toBe(result.tenant.id);
      });
    });

    it('should create default roles with correct permissions', async () => {
      // Arrange
      const input = {
        tenantName: 'Role Test Tenant',
        adminEmail: 'admin@roletest.com',
        adminPassword: 'Password123!',
        adminFirstName: 'Role',
        adminLastName: 'Tester',
      };

      // Act
      const result = await tenantService.createTenant(input);

      // Assert - Verify Admin role
      const adminRole = await prismaService.role.findFirst({
        where: {
          name: 'Admin',
          tenantId: result.tenant.id,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      expect(adminRole).toBeDefined();
      expect(adminRole!.permissions).toHaveLength(15); // All permissions

      // Assert - Verify Member role
      const memberRole = await prismaService.role.findFirst({
        where: {
          name: 'Member',
          tenantId: result.tenant.id,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

      expect(memberRole).toBeDefined();

      // Member should have read permissions for project, user, role, and permission
      const memberPermissions = memberRole!.permissions.map(
        (rp) => rp.permission,
      );
      expect(memberPermissions.every((p) => p.action === 'read')).toBe(true);

      const memberSubjects = memberPermissions.map((p) => p.subject);
      expect(memberSubjects).toContain('project');
      expect(memberSubjects).toContain('user');
      expect(memberSubjects).toContain('role');
      expect(memberSubjects).toContain('permission');
    });
  });
});
