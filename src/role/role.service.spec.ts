import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { Prisma } from '@prisma/client';

describe('RoleService', () => {
  let service: RoleService;

  const mockPrismaService = {
    role: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
    rolePermission: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockTenantContextService = {
    getRequiredTenantId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContextService,
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    const tenantId = 'tenant-123';
    const mockRoles = [
      {
        id: 'role-1',
        name: 'Admin',
        tenantId,
        createdAt: new Date('2025-05-10T10:00:00Z'),
        updatedAt: new Date('2025-05-10T10:00:00Z'),
        permissions: [],
      },
      {
        id: 'role-2',
        name: 'Member',
        tenantId,
        createdAt: new Date('2025-05-10T09:00:00Z'),
        updatedAt: new Date('2025-05-10T09:00:00Z'),
        permissions: [],
      },
    ];

    it('should return all roles for the current tenant', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findMany.mockResolvedValue(mockRoles);

      // Act
      const result = await service.findAll();

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.role.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual(mockRoles);
    });
  });

  describe('findOne', () => {
    const tenantId = 'tenant-123';
    const roleId = 'role-123';
    const mockRole = {
      id: roleId,
      name: 'Admin',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: [],
    };

    it('should return a role by ID for the current tenant', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(mockRole);

      // Act
      const result = await service.findOne(roleId);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.role.findFirst).toHaveBeenCalledWith({
        where: {
          id: roleId,
          tenantId,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
      expect(result).toEqual(mockRole);
    });

    it('should throw NotFoundException if role does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(roleId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(roleId)).rejects.toThrow(
        `Role with ID ${roleId} not found`,
      );
    });
  });

  describe('create', () => {
    const tenantId = 'tenant-123';
    const createRoleDto: CreateRoleDto = {
      name: 'Editor',
    };

    const mockCreatedRole = {
      id: 'role-123',
      name: 'Editor',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: [],
    };

    it('should create a new role with automatic tenant scoping', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.create.mockResolvedValue(mockCreatedRole);

      // Act
      const result = await service.create(createRoleDto);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.role.create).toHaveBeenCalledWith({
        data: {
          name: createRoleDto.name,
          tenantId,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
      expect(result).toEqual(mockCreatedRole);
    });

    it('should throw ConflictException for duplicate role name within tenant', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      mockPrismaService.role.create.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.create(createRoleDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createRoleDto)).rejects.toThrow(
        `Role with name "${createRoleDto.name}" already exists in this tenant`,
      );
    });

    it('should allow same role name in different tenants', async () => {
      // Arrange
      const tenant1Id = 'tenant-1';
      const tenant2Id = 'tenant-2';

      const role1 = {
        id: 'role-1',
        name: 'Admin',
        tenantId: tenant1Id,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      };

      const role2 = {
        id: 'role-2',
        name: 'Admin',
        tenantId: tenant2Id,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      };

      // Create role for tenant 1
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenant1Id);
      mockPrismaService.role.create.mockResolvedValue(role1);

      const result1 = await service.create({ name: 'Admin' });

      // Create same role for tenant 2
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenant2Id);
      mockPrismaService.role.create.mockResolvedValue(role2);

      const result2 = await service.create({ name: 'Admin' });

      // Assert
      expect(result1.tenantId).toBe(tenant1Id);
      expect(result2.tenantId).toBe(tenant2Id);
      expect(result1.name).toBe(result2.name);
    });
  });

  describe('update', () => {
    const tenantId = 'tenant-123';
    const roleId = 'role-123';
    const updateRoleDto: UpdateRoleDto = {
      name: 'Super Admin',
    };

    const mockRole = {
      id: roleId,
      name: 'Admin',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdatedRole = {
      ...mockRole,
      name: 'Super Admin',
      permissions: [],
    };

    it('should update role name', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(mockRole);
      mockPrismaService.role.update.mockResolvedValue(mockUpdatedRole);

      // Act
      const result = await service.update(roleId, updateRoleDto);

      // Assert
      expect(mockPrismaService.role.findFirst).toHaveBeenCalledWith({
        where: {
          id: roleId,
          tenantId,
        },
      });
      expect(mockPrismaService.role.update).toHaveBeenCalledWith({
        where: {
          id: roleId,
        },
        data: {
          name: updateRoleDto.name,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
      expect(result).toEqual(mockUpdatedRole);
    });

    it('should throw NotFoundException if role does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(roleId, updateRoleDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException for duplicate role name', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(mockRole);

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      mockPrismaService.role.update.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.update(roleId, updateRoleDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updatePermissions', () => {
    const tenantId = 'tenant-123';
    const roleId = 'role-123';
    const permissionIds = ['perm-1', 'perm-2'];
    const assignPermissionsDto: AssignPermissionsDto = {
      permissionIds,
    };

    const mockRole = {
      id: roleId,
      name: 'Admin',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPermissions = [
      {
        id: 'perm-1',
        action: 'create',
        subject: 'project',
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'perm-2',
        action: 'read',
        subject: 'project',
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockUpdatedRole = {
      ...mockRole,
      permissions: mockPermissions.map((p) => ({
        roleId,
        permissionId: p.id,
        permission: p,
      })),
    };

    it('should replace role permissions', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(mockRole);
      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions);

      mockPrismaService.$transaction.mockImplementation((callback) => {
        const mockTx = {
          rolePermission: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          role: {
            findUnique: jest.fn().mockResolvedValue(mockUpdatedRole),
          },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.updatePermissions(
        roleId,
        assignPermissionsDto,
      );

      // Assert
      expect(mockPrismaService.role.findFirst).toHaveBeenCalledWith({
        where: {
          id: roleId,
          tenantId,
        },
      });
      expect(mockPrismaService.permission.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: permissionIds,
          },
        },
      });
      expect(result).toEqual(mockUpdatedRole);
    });

    it('should throw NotFoundException if role does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updatePermissions(roleId, assignPermissionsDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if permission not found', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(mockRole);
      mockPrismaService.permission.findMany.mockResolvedValue([
        mockPermissions[0],
      ]);

      // Act & Assert
      await expect(
        service.updatePermissions(roleId, assignPermissionsDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updatePermissions(roleId, assignPermissionsDto),
      ).rejects.toThrow('One or more permissions not found');
    });

    it('should prevent cross-tenant permission assignment', async () => {
      // Arrange
      const differentTenantId = 'tenant-456';
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(mockRole);

      const crossTenantPermissions = [
        {
          id: 'perm-1',
          action: 'create',
          subject: 'project',
          tenantId: differentTenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'perm-2',
          action: 'read',
          subject: 'project',
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.permission.findMany.mockResolvedValue(
        crossTenantPermissions,
      );

      // Act & Assert
      await expect(
        service.updatePermissions(roleId, assignPermissionsDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updatePermissions(roleId, assignPermissionsDto),
      ).rejects.toThrow('Cannot assign permissions from a different tenant');
    });

    it('should allow empty permission list', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(mockRole);

      const emptyDto: AssignPermissionsDto = {
        permissionIds: [],
      };

      const roleWithNoPermissions = {
        ...mockRole,
        permissions: [],
      };

      mockPrismaService.$transaction.mockImplementation((callback) => {
        const mockTx = {
          rolePermission: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            createMany: jest.fn(),
          },
          role: {
            findUnique: jest.fn().mockResolvedValue(roleWithNoPermissions),
          },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.updatePermissions(roleId, emptyDto);

      // Assert
      expect(result).toEqual(roleWithNoPermissions);
    });
  });

  describe('delete', () => {
    const tenantId = 'tenant-123';
    const roleId = 'role-123';
    const mockRole = {
      id: roleId,
      name: 'Admin',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should delete a role and cascade to users', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(mockRole);
      mockPrismaService.role.delete.mockResolvedValue(mockRole);

      // Act
      const result = await service.delete(roleId);

      // Assert
      expect(mockPrismaService.role.findFirst).toHaveBeenCalledWith({
        where: {
          id: roleId,
          tenantId,
        },
      });
      expect(mockPrismaService.role.delete).toHaveBeenCalledWith({
        where: {
          id: roleId,
        },
      });
      expect(result).toEqual({ message: 'Role deleted successfully' });
    });

    it('should throw NotFoundException if role does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(roleId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.role.delete).not.toHaveBeenCalled();
    });

    it('should cascade delete to user_roles', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.role.findFirst.mockResolvedValue(mockRole);
      mockPrismaService.role.delete.mockResolvedValue(mockRole);

      // Act
      await service.delete(roleId);

      // Assert
      // The cascade behavior is handled by Prisma schema (onDelete: Cascade)
      // We verify that delete is called, which triggers the cascade
      expect(mockPrismaService.role.delete).toHaveBeenCalledWith({
        where: {
          id: roleId,
        },
      });
    });
  });
});
