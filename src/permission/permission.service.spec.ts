import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { Prisma } from '@prisma/client';

describe('PermissionService', () => {
  let service: PermissionService;

  const mockPrismaService = {
    permission: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockTenantContextService = {
    getRequiredTenantId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
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

    service = module.get<PermissionService>(PermissionService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    const tenantId = 'tenant-123';
    const mockPermissions = [
      {
        id: 'perm-1',
        action: 'create',
        subject: 'project',
        tenantId,
        createdAt: new Date('2025-05-10T10:00:00Z'),
        updatedAt: new Date('2025-05-10T10:00:00Z'),
      },
      {
        id: 'perm-2',
        action: 'read',
        subject: 'project',
        tenantId,
        createdAt: new Date('2025-05-10T09:00:00Z'),
        updatedAt: new Date('2025-05-10T09:00:00Z'),
      },
    ];

    it('should return all permissions for the current tenant', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions);

      // Act
      const result = await service.findAll();

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.permission.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toEqual(mockPermissions);
    });

    it('should only return permissions for the current tenant (tenant isolation)', async () => {
      // Arrange
      const tenant1Id = 'tenant-1';

      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenant1Id);

      const tenant1Permissions = [
        {
          id: 'perm-1',
          action: 'create',
          subject: 'project',
          tenantId: tenant1Id,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.permission.findMany.mockResolvedValue(
        tenant1Permissions,
      );

      // Act
      const result = await service.findAll();

      // Assert
      expect(mockPrismaService.permission.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: tenant1Id,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Verify that only tenant1 permissions are returned
      expect(result).toEqual(tenant1Permissions);
      expect(result.every((p) => p.tenantId === tenant1Id)).toBe(true);
    });
  });

  describe('findOne', () => {
    const tenantId = 'tenant-123';
    const permissionId = 'perm-123';
    const mockPermission = {
      id: permissionId,
      action: 'create',
      subject: 'project',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return a permission by ID for the current tenant', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.permission.findFirst.mockResolvedValue(mockPermission);

      // Act
      const result = await service.findOne(permissionId);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.permission.findFirst).toHaveBeenCalledWith({
        where: {
          id: permissionId,
          tenantId,
        },
      });
      expect(result).toEqual(mockPermission);
    });

    it('should throw NotFoundException if permission does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.permission.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(permissionId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(permissionId)).rejects.toThrow(
        `Permission with ID ${permissionId} not found`,
      );
    });

    it('should throw NotFoundException if permission belongs to different tenant', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.permission.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(permissionId)).rejects.toThrow(
        NotFoundException,
      );

      // Verify tenant scoping was applied
      expect(mockPrismaService.permission.findFirst).toHaveBeenCalledWith({
        where: {
          id: permissionId,
          tenantId,
        },
      });
    });
  });

  describe('create', () => {
    const tenantId = 'tenant-123';
    const createPermissionDto: CreatePermissionDto = {
      action: 'create',
      subject: 'project',
    };

    const mockCreatedPermission = {
      id: 'perm-123',
      action: 'create',
      subject: 'project',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a new permission with automatic tenant scoping', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.permission.create.mockResolvedValue(
        mockCreatedPermission,
      );

      // Act
      const result = await service.create(createPermissionDto);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.permission.create).toHaveBeenCalledWith({
        data: {
          action: createPermissionDto.action,
          subject: createPermissionDto.subject,
          tenantId,
        },
      });
      expect(result).toEqual(mockCreatedPermission);
    });

    it('should throw ConflictException for duplicate permission (action, subject, tenantId)', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      mockPrismaService.permission.create.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.create(createPermissionDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createPermissionDto)).rejects.toThrow(
        `Permission with action "${createPermissionDto.action}" and subject "${createPermissionDto.subject}" already exists`,
      );
    });

    it('should allow same action-subject pair in different tenants', async () => {
      // Arrange
      const tenant1Id = 'tenant-1';
      const tenant2Id = 'tenant-2';

      const permission1 = {
        id: 'perm-1',
        action: 'create',
        subject: 'project',
        tenantId: tenant1Id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const permission2 = {
        id: 'perm-2',
        action: 'create',
        subject: 'project',
        tenantId: tenant2Id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create permission for tenant 1
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenant1Id);
      mockPrismaService.permission.create.mockResolvedValue(permission1);

      const result1 = await service.create(createPermissionDto);

      // Create same permission for tenant 2
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenant2Id);
      mockPrismaService.permission.create.mockResolvedValue(permission2);

      const result2 = await service.create(createPermissionDto);

      // Assert
      expect(result1.tenantId).toBe(tenant1Id);
      expect(result2.tenantId).toBe(tenant2Id);
      expect(result1.action).toBe(result2.action);
      expect(result1.subject).toBe(result2.subject);
    });

    it('should rethrow non-Prisma errors', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      const genericError = new Error('Database connection failed');
      mockPrismaService.permission.create.mockRejectedValue(genericError);

      // Act & Assert
      await expect(service.create(createPermissionDto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('delete', () => {
    const tenantId = 'tenant-123';
    const permissionId = 'perm-123';
    const mockPermission = {
      id: permissionId,
      action: 'create',
      subject: 'project',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should delete a permission and cascade to roles/users', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.permission.findFirst.mockResolvedValue(mockPermission);
      mockPrismaService.permission.delete.mockResolvedValue(mockPermission);

      // Act
      const result = await service.delete(permissionId);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();

      // Verify permission existence check
      expect(mockPrismaService.permission.findFirst).toHaveBeenCalledWith({
        where: {
          id: permissionId,
          tenantId,
        },
      });

      // Verify deletion
      expect(mockPrismaService.permission.delete).toHaveBeenCalledWith({
        where: {
          id: permissionId,
        },
      });

      expect(result).toEqual({ message: 'Permission deleted successfully' });
    });

    it('should throw NotFoundException if permission does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.permission.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(permissionId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.delete(permissionId)).rejects.toThrow(
        `Permission with ID ${permissionId} not found`,
      );

      // Verify delete was not called
      expect(mockPrismaService.permission.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if permission belongs to different tenant', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.permission.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(permissionId)).rejects.toThrow(
        NotFoundException,
      );

      // Verify tenant scoping was applied
      expect(mockPrismaService.permission.findFirst).toHaveBeenCalledWith({
        where: {
          id: permissionId,
          tenantId,
        },
      });

      // Verify delete was not called
      expect(mockPrismaService.permission.delete).not.toHaveBeenCalled();
    });

    it('should cascade delete to role_permissions and user_permissions', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.permission.findFirst.mockResolvedValue(mockPermission);
      mockPrismaService.permission.delete.mockResolvedValue(mockPermission);

      // Act
      await service.delete(permissionId);

      // Assert
      // The cascade behavior is handled by Prisma schema (onDelete: Cascade)
      // We verify that delete is called, which triggers the cascade
      expect(mockPrismaService.permission.delete).toHaveBeenCalledWith({
        where: {
          id: permissionId,
        },
      });
    });
  });
});
