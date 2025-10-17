import { Test, TestingModule } from '@nestjs/testing';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RegisterTenantDto } from '../auth/dto/register-tenant.dto';
import { UpdateGoogleSettingsDto } from '../auth/dto/update-google-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../notifications/guards/admin-role.guard';
import { RequestUser } from '../auth/interfaces/request-with-user.interface';

describe('TenantController', () => {
  let controller: TenantController;

  const mockTenantService = {
    createTenant: jest.fn(),
    findById: jest.fn(),
    updateGoogleSettings: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantController],
      providers: [
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(AdminRoleGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<TenantController>(TenantController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    const validDto: RegisterTenantDto = {
      tenantName: 'Test Tenant',
      adminEmail: 'admin@test.com',
      adminPassword: 'Test@1234',
      adminFirstName: 'John',
      adminLastName: 'Doe',
    };

    const mockResult = {
      tenant: {
        id: 'tenant-1',
        name: 'Test Tenant',
        subdomain: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      adminUser: {
        id: 'user-1',
        email: 'admin@test.com',
        firstName: 'John',
        lastName: 'Doe',
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    it('should successfully register a tenant', async () => {
      mockTenantService.createTenant.mockResolvedValue(mockResult);

      const result = await controller.register(validDto);

      expect(result).toHaveProperty('message', 'Tenant created successfully');
      expect(result).toHaveProperty('data');
      expect(result.data).toEqual(mockResult);
      expect(mockTenantService.createTenant).toHaveBeenCalledWith({
        tenantName: validDto.tenantName,
        adminEmail: validDto.adminEmail,
        adminPassword: validDto.adminPassword,
        adminFirstName: validDto.adminFirstName,
        adminLastName: validDto.adminLastName,
      });
    });

    it('should throw ConflictException for duplicate tenant name', async () => {
      mockTenantService.createTenant.mockRejectedValue(
        new ConflictException('Tenant name already exists'),
      );

      await expect(controller.register(validDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(controller.register(validDto)).rejects.toThrow(
        'Tenant name already exists',
      );
    });

    it('should handle Prisma unique constraint error for email', async () => {
      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';
      (prismaError as any).meta = { target: ['email', 'tenantId'] };

      mockTenantService.createTenant.mockRejectedValue(prismaError);

      await expect(controller.register(validDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(controller.register(validDto)).rejects.toThrow(
        'Email already exists for this tenant',
      );
    });

    it('should handle Prisma unique constraint error for tenant name', async () => {
      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';
      (prismaError as any).meta = { target: ['name'] };

      mockTenantService.createTenant.mockRejectedValue(prismaError);

      await expect(controller.register(validDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(controller.register(validDto)).rejects.toThrow(
        'Tenant name already exists',
      );
    });

    it('should handle generic Prisma unique constraint error', async () => {
      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';
      (prismaError as any).meta = { target: ['other'] };

      mockTenantService.createTenant.mockRejectedValue(prismaError);

      await expect(controller.register(validDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(controller.register(validDto)).rejects.toThrow(
        'Duplicate entry detected',
      );
    });

    it('should re-throw non-conflict errors', async () => {
      const genericError = new Error('Database connection failed');
      mockTenantService.createTenant.mockRejectedValue(genericError);

      await expect(controller.register(validDto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('getGoogleSettings', () => {
    const mockTenant = {
      id: 'tenant-1',
      name: 'Test Tenant',
      subdomain: null,
      googleSsoEnabled: true,
      googleAutoProvision: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return Google settings for a tenant', async () => {
      mockTenantService.findById.mockResolvedValue(mockTenant);

      const result = await controller.getGoogleSettings('tenant-1');

      expect(result).toEqual({
        googleSsoEnabled: true,
        googleAutoProvision: false,
      });
      expect(mockTenantService.findById).toHaveBeenCalledWith('tenant-1');
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockTenantService.findById.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      await expect(
        controller.getGoogleSettings('invalid-tenant'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.getGoogleSettings('invalid-tenant'),
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('updateGoogleSettings', () => {
    const mockUser: RequestUser = {
      id: 'user-1',
      tenantId: 'tenant-1',
      roles: [
        {
          id: 'role-1',
          name: 'Admin',
          tenantId: 'tenant-1',
        },
      ],
      email: '',
      firstName: null,
      lastName: null,
    };

    const mockUpdatedTenant = {
      id: 'tenant-1',
      name: 'Test Tenant',
      googleSsoEnabled: true,
      googleAutoProvision: true,
      updatedAt: new Date(),
    };

    it('should update Google settings successfully', async () => {
      const updateDto: UpdateGoogleSettingsDto = {
        googleSsoEnabled: true,
        googleAutoProvision: true,
      };

      mockTenantService.updateGoogleSettings.mockResolvedValue(
        mockUpdatedTenant,
      );

      const result = await controller.updateGoogleSettings(
        'tenant-1',
        updateDto,
        mockUser,
      );

      expect(result).toEqual({
        message: 'Google settings updated successfully',
        data: mockUpdatedTenant,
      });
      expect(mockTenantService.updateGoogleSettings).toHaveBeenCalledWith(
        'tenant-1',
        updateDto,
        'user-1',
      );
    });

    it('should update only googleSsoEnabled when provided', async () => {
      const updateDto: UpdateGoogleSettingsDto = {
        googleSsoEnabled: false,
      };

      const partialUpdatedTenant = {
        ...mockUpdatedTenant,
        googleSsoEnabled: false,
      };

      mockTenantService.updateGoogleSettings.mockResolvedValue(
        partialUpdatedTenant,
      );

      const result = await controller.updateGoogleSettings(
        'tenant-1',
        updateDto,
        mockUser,
      );

      expect(result.data.googleSsoEnabled).toBe(false);
      expect(mockTenantService.updateGoogleSettings).toHaveBeenCalledWith(
        'tenant-1',
        updateDto,
        'user-1',
      );
    });

    it('should update only googleAutoProvision when provided', async () => {
      const updateDto: UpdateGoogleSettingsDto = {
        googleAutoProvision: false,
      };

      const partialUpdatedTenant = {
        ...mockUpdatedTenant,
        googleAutoProvision: false,
      };

      mockTenantService.updateGoogleSettings.mockResolvedValue(
        partialUpdatedTenant,
      );

      const result = await controller.updateGoogleSettings(
        'tenant-1',
        updateDto,
        mockUser,
      );

      expect(result.data.googleAutoProvision).toBe(false);
      expect(mockTenantService.updateGoogleSettings).toHaveBeenCalledWith(
        'tenant-1',
        updateDto,
        'user-1',
      );
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      const updateDto: UpdateGoogleSettingsDto = {
        googleSsoEnabled: true,
      };

      mockTenantService.updateGoogleSettings.mockRejectedValue(
        new NotFoundException('Tenant not found'),
      );

      await expect(
        controller.updateGoogleSettings('invalid-tenant', updateDto, mockUser),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.updateGoogleSettings('invalid-tenant', updateDto, mockUser),
      ).rejects.toThrow('Tenant not found');
    });

    it('should handle service errors gracefully', async () => {
      const updateDto: UpdateGoogleSettingsDto = {
        googleSsoEnabled: true,
      };

      const serviceError = new Error('Database connection failed');
      mockTenantService.updateGoogleSettings.mockRejectedValue(serviceError);

      await expect(
        controller.updateGoogleSettings('tenant-1', updateDto, mockUser),
      ).rejects.toThrow('Database connection failed');
    });
  });
});
