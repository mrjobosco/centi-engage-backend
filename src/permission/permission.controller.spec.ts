import { Test, TestingModule } from '@nestjs/testing';
import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

describe('PermissionController', () => {
  let controller: PermissionController;

  const mockPermissionService = {
    findAll: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionController],
      providers: [
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PermissionController>(PermissionController);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all permissions', async () => {
      // Arrange
      const mockPermissions = [
        {
          id: 'perm-1',
          action: 'create',
          subject: 'project',
          tenantId: 'tenant-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'perm-2',
          action: 'read',
          subject: 'project',
          tenantId: 'tenant-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPermissionService.findAll.mockResolvedValue(mockPermissions);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(mockPermissionService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockPermissions);
    });
  });

  describe('create', () => {
    it('should create a new permission', async () => {
      // Arrange
      const createPermissionDto: CreatePermissionDto = {
        action: 'create',
        subject: 'project',
      };

      const mockCreatedPermission = {
        id: 'perm-123',
        action: 'create',
        subject: 'project',
        tenantId: 'tenant-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPermissionService.create.mockResolvedValue(mockCreatedPermission);

      // Act
      const result = await controller.create(createPermissionDto);

      // Assert
      expect(mockPermissionService.create).toHaveBeenCalledWith(
        createPermissionDto,
      );
      expect(result).toEqual(mockCreatedPermission);
    });
  });

  describe('delete', () => {
    it('should delete a permission', async () => {
      // Arrange
      const permissionId = 'perm-123';
      const mockResponse = { message: 'Permission deleted successfully' };

      mockPermissionService.delete.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.delete(permissionId);

      // Assert
      expect(mockPermissionService.delete).toHaveBeenCalledWith(permissionId);
      expect(result).toEqual(mockResponse);
    });
  });
});
