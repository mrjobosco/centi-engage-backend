import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

describe('UserController', () => {
  let controller: UserController;

  const mockUserService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    assignRoles: jest.fn(),
    assignPermissions: jest.fn(),
    getEffectivePermissions: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      // Arrange
      const mockUsers = [
        {
          id: 'user-1',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          tenantId: 'tenant-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          roles: [],
        },
        {
          id: 'user-2',
          email: 'member@example.com',
          firstName: 'Member',
          lastName: 'User',
          tenantId: 'tenant-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          roles: [],
        },
      ];

      mockUserService.findAll.mockResolvedValue(mockUsers);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(mockUserService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });
  });

  describe('findOne', () => {
    it('should return a user by ID', async () => {
      // Arrange
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [],
        permissions: [],
      };

      mockUserService.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await controller.findOne(userId);

      // Assert
      expect(mockUserService.findOne).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'newuser@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };

      const mockCreatedUser = {
        id: 'user-123',
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [],
      };

      mockUserService.create.mockResolvedValue(mockCreatedUser);

      // Act
      const result = await controller.create(createUserDto);

      // Assert
      expect(mockUserService.create).toHaveBeenCalledWith(createUserDto);
      expect(result).toEqual(mockCreatedUser);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      // Arrange
      const userId = 'user-123';
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
        lastName: 'Name',
      };

      const mockUpdatedUser = {
        id: userId,
        email: 'user@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [],
      };

      mockUserService.update.mockResolvedValue(mockUpdatedUser);

      // Act
      const result = await controller.update(userId, updateUserDto);

      // Assert
      expect(mockUserService.update).toHaveBeenCalledWith(
        userId,
        updateUserDto,
      );
      expect(result).toEqual(mockUpdatedUser);
    });
  });

  describe('assignRoles', () => {
    it('should assign roles to a user', async () => {
      // Arrange
      const userId = 'user-123';
      const assignRolesDto: AssignRolesDto = {
        roleIds: ['role-1', 'role-2'],
      };

      const mockUserWithRoles = {
        id: userId,
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [
          {
            userId,
            roleId: 'role-1',
            role: {
              id: 'role-1',
              name: 'Admin',
              tenantId: 'tenant-123',
            },
          },
          {
            userId,
            roleId: 'role-2',
            role: {
              id: 'role-2',
              name: 'Member',
              tenantId: 'tenant-123',
            },
          },
        ],
      };

      mockUserService.assignRoles.mockResolvedValue(mockUserWithRoles);

      // Act
      const result = await controller.assignRoles(userId, assignRolesDto);

      // Assert
      expect(mockUserService.assignRoles).toHaveBeenCalledWith(
        userId,
        assignRolesDto,
      );
      expect(result).toEqual(mockUserWithRoles);
    });
  });

  describe('assignPermissions', () => {
    it('should assign permissions to a user', async () => {
      // Arrange
      const userId = 'user-123';
      const assignPermissionsDto: AssignPermissionsDto = {
        permissionIds: ['perm-1', 'perm-2'],
      };

      const mockUserWithPermissions = {
        id: userId,
        email: 'user@example.com',
        firstName: 'Test',
        lastName: 'User',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [
          {
            userId,
            permissionId: 'perm-1',
            permission: {
              id: 'perm-1',
              action: 'create',
              subject: 'project',
              tenantId: 'tenant-123',
            },
          },
          {
            userId,
            permissionId: 'perm-2',
            permission: {
              id: 'perm-2',
              action: 'read',
              subject: 'project',
              tenantId: 'tenant-123',
            },
          },
        ],
      };

      mockUserService.assignPermissions.mockResolvedValue(
        mockUserWithPermissions,
      );

      // Act
      const result = await controller.assignPermissions(
        userId,
        assignPermissionsDto,
      );

      // Assert
      expect(mockUserService.assignPermissions).toHaveBeenCalledWith(
        userId,
        assignPermissionsDto,
      );
      expect(result).toEqual(mockUserWithPermissions);
    });
  });

  describe('getEffectivePermissions', () => {
    it('should return effective permissions for a user', async () => {
      // Arrange
      const userId = 'user-123';
      const mockEffectivePermissions = {
        userId,
        email: 'user@example.com',
        effectivePermissions: [
          {
            id: 'perm-1',
            action: 'create',
            subject: 'project',
            tenantId: 'tenant-123',
            source: 'role',
            roleName: 'Admin',
          },
          {
            id: 'perm-2',
            action: 'read',
            subject: 'project',
            tenantId: 'tenant-123',
            source: 'user',
          },
        ],
        roleBasedPermissions: [
          {
            id: 'perm-1',
            action: 'create',
            subject: 'project',
            tenantId: 'tenant-123',
            source: 'role',
            roleName: 'Admin',
          },
        ],
        userSpecificPermissions: [
          {
            id: 'perm-2',
            action: 'read',
            subject: 'project',
            tenantId: 'tenant-123',
            source: 'user',
          },
        ],
      };

      mockUserService.getEffectivePermissions.mockResolvedValue(
        mockEffectivePermissions,
      );

      // Act
      const result = await controller.getEffectivePermissions(userId);

      // Assert
      expect(mockUserService.getEffectivePermissions).toHaveBeenCalledWith(
        userId,
      );
      expect(result).toEqual(mockEffectivePermissions);
    });
  });

  describe('delete', () => {
    it('should delete a user', async () => {
      // Arrange
      const userId = 'user-123';
      const mockResponse = { message: 'User deleted successfully' };

      mockUserService.delete.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.delete(userId);

      // Assert
      expect(mockUserService.delete).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResponse);
    });
  });
});
