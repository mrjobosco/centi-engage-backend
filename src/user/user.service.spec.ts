import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    role: {
      findMany: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
    userRole: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    userPermission: {
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
        UserService,
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

    service = module.get<UserService>(UserService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    const tenantId = 'tenant-123';
    const mockUsers = [
      {
        id: 'user-1',
        email: 'admin@example.com',
        password: 'hashed-password',
        firstName: 'Admin',
        lastName: 'User',
        tenantId,
        createdAt: new Date('2025-05-10T10:00:00Z'),
        updatedAt: new Date('2025-05-10T10:00:00Z'),
        roles: [],
      },
      {
        id: 'user-2',
        email: 'member@example.com',
        password: 'hashed-password',
        firstName: 'Member',
        lastName: 'User',
        tenantId,
        createdAt: new Date('2025-05-10T09:00:00Z'),
        updatedAt: new Date('2025-05-10T09:00:00Z'),
        roles: [],
      },
    ];

    it('should return all users for the current tenant without passwords', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      // Act
      const result = await service.findAll();

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('password');
      expect(result[1]).not.toHaveProperty('password');
    });
  });

  describe('findOne', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const mockUser = {
      id: userId,
      email: 'user@example.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [],
      permissions: [],
    };

    it('should return a user by ID without password', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act
      const result = await service.findOne(userId);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
          tenantId,
        },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(userId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(userId)).rejects.toThrow(
        `User with ID ${userId} not found`,
      );
    });
  });

  describe('create', () => {
    const tenantId = 'tenant-123';
    const createUserDto: CreateUserDto = {
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
    };

    const hashedPassword = 'hashed-password-123';

    const mockCreatedUser = {
      id: 'user-123',
      email: createUserDto.email,
      password: hashedPassword,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [],
    };

    it('should create a new user with automatic tenant scoping and hashed password', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: createUserDto.email,
          password: hashedPassword,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          tenantId,
          authMethods: ['password'],
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(createUserDto.email);
    });

    it('should throw ConflictException for duplicate email within tenant', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.0.0',
        },
      );

      mockPrismaService.user.create.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createUserDto)).rejects.toThrow(
        `User with email "${createUserDto.email}" already exists in this tenant`,
      );
    });

    it('should allow same email in different tenants', async () => {
      // Arrange
      const tenant1Id = 'tenant-1';
      const tenant2Id = 'tenant-2';

      const user1 = {
        id: 'user-1',
        email: 'user@example.com',
        password: hashedPassword,
        firstName: 'User',
        lastName: 'One',
        tenantId: tenant1Id,
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [],
      };

      const user2 = {
        id: 'user-2',
        email: 'user@example.com',
        password: hashedPassword,
        firstName: 'User',
        lastName: 'Two',
        tenantId: tenant2Id,
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [],
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      // Create user for tenant 1
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenant1Id);
      mockPrismaService.user.create.mockResolvedValue(user1);

      const result1 = await service.create({
        email: 'user@example.com',
        password: 'password123',
      });

      // Create same email for tenant 2
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenant2Id);
      mockPrismaService.user.create.mockResolvedValue(user2);

      const result2 = await service.create({
        email: 'user@example.com',
        password: 'password123',
      });

      // Assert
      expect(result1.tenantId).toBe(tenant1Id);
      expect(result2.tenantId).toBe(tenant2Id);
      expect(result1.email).toBe(result2.email);
    });
  });

  describe('update', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const updateUserDto: UpdateUserDto = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    const mockUser = {
      id: userId,
      email: 'user@example.com',
      password: 'hashed-password',
      firstName: 'Original',
      lastName: 'Name',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdatedUser = {
      ...mockUser,
      firstName: 'Updated',
      lastName: 'Name',
      roles: [],
    };

    it('should update user details', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await service.update(userId, updateUserDto);

      // Assert
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
          tenantId,
        },
      });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: {
          id: userId,
        },
        data: updateUserDto,
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
      expect(result).not.toHaveProperty('password');
      expect(result.firstName).toBe('Updated');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(userId, updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const mockUser = {
      id: userId,
      email: 'user@example.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should delete a user and cascade role/permission assignments', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.delete.mockResolvedValue(mockUser);

      // Act
      const result = await service.delete(userId);

      // Assert
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
          tenantId,
        },
      });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: {
          id: userId,
        },
      });
      expect(result).toEqual({ message: 'User deleted successfully' });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(userId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('assignRoles', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const roleIds = ['role-1', 'role-2'];
    const assignRolesDto: AssignRolesDto = {
      roleIds,
    };

    const mockUser = {
      id: userId,
      email: 'user@example.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockRoles = [
      {
        id: 'role-1',
        name: 'Admin',
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'role-2',
        name: 'Member',
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockUpdatedUser = {
      ...mockUser,
      roles: mockRoles.map((r) => ({
        userId,
        roleId: r.id,
        role: r,
      })),
    };

    it('should assign roles to user with validation', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.role.findMany.mockResolvedValue(mockRoles);

      mockPrismaService.$transaction.mockImplementation((callback) => {
        const mockTx = {
          userRole: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUpdatedUser),
          },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.assignRoles(userId, assignRolesDto);

      // Assert
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
          tenantId,
        },
      });
      expect(mockPrismaService.role.findMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: roleIds,
          },
        },
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.assignRoles(userId, assignRolesDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if role not found', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.role.findMany.mockResolvedValue([mockRoles[0]]);

      // Act & Assert
      await expect(service.assignRoles(userId, assignRolesDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.assignRoles(userId, assignRolesDto)).rejects.toThrow(
        'One or more roles not found',
      );
    });

    it('should prevent cross-tenant role assignment', async () => {
      // Arrange
      const differentTenantId = 'tenant-456';
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const crossTenantRoles = [
        {
          id: 'role-1',
          name: 'Admin',
          tenantId: differentTenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'role-2',
          name: 'Member',
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.role.findMany.mockResolvedValue(crossTenantRoles);

      // Act & Assert
      await expect(service.assignRoles(userId, assignRolesDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.assignRoles(userId, assignRolesDto)).rejects.toThrow(
        'Cannot assign roles from a different tenant',
      );
    });
  });

  describe('assignPermissions', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const permissionIds = ['perm-1', 'perm-2'];
    const assignPermissionsDto: AssignPermissionsDto = {
      permissionIds,
    };

    const mockUser = {
      id: userId,
      email: 'user@example.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
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

    const mockUpdatedUser = {
      ...mockUser,
      permissions: mockPermissions.map((p) => ({
        userId,
        permissionId: p.id,
        permission: p,
      })),
    };

    it('should assign user-specific permissions with validation', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.permission.findMany.mockResolvedValue(mockPermissions);

      mockPrismaService.$transaction.mockImplementation((callback) => {
        const mockTx = {
          userPermission: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(mockUpdatedUser),
          },
        };
        return callback(mockTx);
      });

      // Act
      const result = await service.assignPermissions(
        userId,
        assignPermissionsDto,
      );

      // Assert
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
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
      expect(result).not.toHaveProperty('password');
    });

    it('should prevent cross-tenant permission assignment', async () => {
      // Arrange
      const differentTenantId = 'tenant-456';
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

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
        service.assignPermissions(userId, assignPermissionsDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.assignPermissions(userId, assignPermissionsDto),
      ).rejects.toThrow('Cannot assign permissions from a different tenant');
    });
  });

  describe('getEffectivePermissions', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';

    const mockRolePermissions = [
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

    const mockUserPermissions = [
      {
        id: 'perm-3',
        action: 'delete',
        subject: 'project',
        tenantId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockUser = {
      id: userId,
      email: 'user@example.com',
      password: 'hashed-password',
      firstName: 'Test',
      lastName: 'User',
      tenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: [
        {
          userId,
          roleId: 'role-1',
          role: {
            id: 'role-1',
            name: 'Admin',
            tenantId,
            permissions: mockRolePermissions.map((p) => ({
              roleId: 'role-1',
              permissionId: p.id,
              permission: p,
            })),
          },
        },
      ],
      permissions: mockUserPermissions.map((p) => ({
        userId,
        permissionId: p.id,
        permission: p,
      })),
    };

    it('should calculate effective permissions as UNION of role-based and user-specific', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act
      const result = await service.getEffectivePermissions(userId);

      // Assert
      expect(result.userId).toBe(userId);
      expect(result.email).toBe(mockUser.email);
      expect(result.effectivePermissions).toHaveLength(3);
      expect(result.roleBasedPermissions).toHaveLength(2);
      expect(result.userSpecificPermissions).toHaveLength(1);

      // Verify role-based permissions have source and roleName
      expect(result.roleBasedPermissions[0]).toHaveProperty('source', 'role');
      expect(result.roleBasedPermissions[0]).toHaveProperty(
        'roleName',
        'Admin',
      );

      // Verify user-specific permissions have source
      expect(result.userSpecificPermissions[0]).toHaveProperty(
        'source',
        'user',
      );
    });

    it('should deduplicate permissions by ID', async () => {
      // Arrange
      const duplicatePermission = mockRolePermissions[0];

      const userWithDuplicates = {
        ...mockUser,
        permissions: [
          ...mockUser.permissions,
          {
            userId,
            permissionId: duplicatePermission.id,
            permission: duplicatePermission,
          },
        ],
      };

      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(userWithDuplicates);

      // Act
      const result = await service.getEffectivePermissions(userId);

      // Assert
      // Should still have 3 unique permissions (not 4)
      expect(result.effectivePermissions).toHaveLength(3);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getEffectivePermissions(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByAuthMethod', () => {
    it('should return users with specific auth method', async () => {
      // Arrange
      const authMethod = 'google';
      const tenantId = 'tenant-123';
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          password: 'hashed-password',
          authMethods: ['password', 'google'],
          roles: [],
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          password: 'hashed-password',
          authMethods: ['google'],
          roles: [],
        },
      ];

      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

      // Act
      const result = await service.findByAuthMethod(authMethod);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          authMethods: {
            has: authMethod,
          },
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).not.toHaveProperty('password');
      expect(result[1]).not.toHaveProperty('password');
    });
  });

  describe('hasAuthMethod', () => {
    it('should return true if user has the auth method', async () => {
      // Arrange
      const userId = 'user-123';
      const authMethod = 'google';
      const tenantId = 'tenant-123';
      const mockUser = {
        authMethods: ['password', 'google'],
      };

      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act
      const result = await service.hasAuthMethod(userId, authMethod);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
          tenantId,
        },
        select: {
          authMethods: true,
        },
      });
      expect(result).toBe(true);
    });

    it('should return false if user does not have the auth method', async () => {
      // Arrange
      const userId = 'user-123';
      const authMethod = 'google';
      const tenantId = 'tenant-123';
      const mockUser = {
        authMethods: ['password'],
      };

      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act
      const result = await service.hasAuthMethod(userId, authMethod);

      // Assert
      expect(result).toBe(false);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      const userId = 'non-existent-user';
      const authMethod = 'google';
      const tenantId = 'tenant-123';

      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.hasAuthMethod(userId, authMethod)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAuthMethods', () => {
    it('should return user auth methods', async () => {
      // Arrange
      const userId = 'user-123';
      const tenantId = 'tenant-123';
      const mockUser = {
        authMethods: ['password', 'google'],
      };

      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      // Act
      const result = await service.getAuthMethods(userId);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
          tenantId,
        },
        select: {
          authMethods: true,
        },
      });
      expect(result).toEqual(['password', 'google']);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      const userId = 'non-existent-user';
      const tenantId = 'tenant-123';

      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getAuthMethods(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
