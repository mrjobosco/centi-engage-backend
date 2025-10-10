import { Test, TestingModule } from '@nestjs/testing';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

describe('RoleController', () => {
  let controller: RoleController;

  const mockRoleService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updatePermissions: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [
        {
          provide: RoleService,
          useValue: mockRoleService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RoleController>(RoleController);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all roles', async () => {
      // Arrange
      const mockRoles = [
        {
          id: 'role-1',
          name: 'Admin',
          tenantId: 'tenant-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          permissions: [],
        },
        {
          id: 'role-2',
          name: 'Member',
          tenantId: 'tenant-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          permissions: [],
        },
      ];

      mockRoleService.findAll.mockResolvedValue(mockRoles);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(mockRoleService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockRoles);
    });
  });

  describe('findOne', () => {
    it('should return a role by ID', async () => {
      // Arrange
      const roleId = 'role-123';
      const mockRole = {
        id: roleId,
        name: 'Admin',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      };

      mockRoleService.findOne.mockResolvedValue(mockRole);

      // Act
      const result = await controller.findOne(roleId);

      // Assert
      expect(mockRoleService.findOne).toHaveBeenCalledWith(roleId);
      expect(result).toEqual(mockRole);
    });
  });

  describe('create', () => {
    it('should create a new role', async () => {
      // Arrange
      const createRoleDto: CreateRoleDto = {
        name: 'Editor',
      };

      const mockCreatedRole = {
        id: 'role-123',
        name: 'Editor',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      };

      mockRoleService.create.mockResolvedValue(mockCreatedRole);

      // Act
      const result = await controller.create(createRoleDto);

      // Assert
      expect(mockRoleService.create).toHaveBeenCalledWith(createRoleDto);
      expect(result).toEqual(mockCreatedRole);
    });
  });

  describe('update', () => {
    it('should update a role', async () => {
      // Arrange
      const roleId = 'role-123';
      const updateRoleDto: UpdateRoleDto = {
        name: 'Super Admin',
      };

      const mockUpdatedRole = {
        id: roleId,
        name: 'Super Admin',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      };

      mockRoleService.update.mockResolvedValue(mockUpdatedRole);

      // Act
      const result = await controller.update(roleId, updateRoleDto);

      // Assert
      expect(mockRoleService.update).toHaveBeenCalledWith(
        roleId,
        updateRoleDto,
      );
      expect(result).toEqual(mockUpdatedRole);
    });
  });

  describe('updatePermissions', () => {
    it('should update role permissions', async () => {
      // Arrange
      const roleId = 'role-123';
      const assignPermissionsDto: AssignPermissionsDto = {
        permissionIds: ['perm-1', 'perm-2'],
      };

      const mockUpdatedRole = {
        id: roleId,
        name: 'Admin',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [
          {
            roleId,
            permissionId: 'perm-1',
            permission: {
              id: 'perm-1',
              action: 'create',
              subject: 'project',
              tenantId: 'tenant-123',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          {
            roleId,
            permissionId: 'perm-2',
            permission: {
              id: 'perm-2',
              action: 'read',
              subject: 'project',
              tenantId: 'tenant-123',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      };

      mockRoleService.updatePermissions.mockResolvedValue(mockUpdatedRole);

      // Act
      const result = await controller.updatePermissions(
        roleId,
        assignPermissionsDto,
      );

      // Assert
      expect(mockRoleService.updatePermissions).toHaveBeenCalledWith(
        roleId,
        assignPermissionsDto,
      );
      expect(result).toEqual(mockUpdatedRole);
    });
  });

  describe('delete', () => {
    it('should delete a role', async () => {
      // Arrange
      const roleId = 'role-123';
      const mockResponse = { message: 'Role deleted successfully' };

      mockRoleService.delete.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.delete(roleId);

      // Assert
      expect(mockRoleService.delete).toHaveBeenCalledWith(roleId);
      expect(result).toEqual(mockResponse);
    });
  });
});
