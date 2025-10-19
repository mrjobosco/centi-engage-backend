import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TenantManagementController } from './tenant-management.controller';
import { TenantManagementService } from './tenant-management.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantLessOnlyGuard } from './guards/tenant-less-only.guard';
import { CreateTenantForUserDto } from './dto/create-tenant-for-user.dto';
import { JoinTenantDto } from './dto/join-tenant.dto';

interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string | null;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  roles: any[];
}

describe('TenantManagementController', () => {
  let controller: TenantManagementController;
  let tenantManagementService: jest.Mocked<TenantManagementService>;

  const mockTenantManagementService = {
    createTenantForUser: jest.fn(),
    joinTenantForUser: jest.fn(),
    getUserTenantStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantManagementController],
      providers: [
        {
          provide: TenantManagementService,
          useValue: mockTenantManagementService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(TenantLessOnlyGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<TenantManagementController>(
      TenantManagementController,
    );
    tenantManagementService = module.get(TenantManagementService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTenant', () => {
    const mockUser: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@example.com',
      tenantId: null,
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
      roles: [],
    };

    const createTenantDto: CreateTenantForUserDto = {
      tenantName: 'Test Company',
      description: 'A test company',
    };

    const mockResult = {
      tenant: {
        id: 'tenant-1',
        name: 'Test Company',
        subdomain: null,
        googleSsoEnabled: false,
        googleAutoProvision: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      accessToken: 'jwt-token-123',
    };

    it('should successfully create a tenant for tenant-less user', async () => {
      tenantManagementService.createTenantForUser.mockResolvedValue(mockResult);

      const result = await controller.createTenant(mockUser, createTenantDto);

      expect(result).toEqual(mockResult);
      expect(tenantManagementService.createTenantForUser).toHaveBeenCalledWith(
        'user-1',
        createTenantDto,
      );
    });

    it('should handle ConflictException when tenant name already exists', async () => {
      tenantManagementService.createTenantForUser.mockRejectedValue(
        new ConflictException('Tenant name already exists'),
      );

      await expect(
        controller.createTenant(mockUser, createTenantDto),
      ).rejects.toThrow(ConflictException);
      await expect(
        controller.createTenant(mockUser, createTenantDto),
      ).rejects.toThrow('Tenant name already exists');
    });

    it('should handle BadRequestException when user already has tenant', async () => {
      tenantManagementService.createTenantForUser.mockRejectedValue(
        new BadRequestException('User already belongs to a tenant'),
      );

      await expect(
        controller.createTenant(mockUser, createTenantDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createTenant(mockUser, createTenantDto),
      ).rejects.toThrow('User already belongs to a tenant');
    });

    it('should handle NotFoundException when user not found', async () => {
      tenantManagementService.createTenantForUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.createTenant(mockUser, createTenantDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.createTenant(mockUser, createTenantDto),
      ).rejects.toThrow('User not found');
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Database connection failed');
      tenantManagementService.createTenantForUser.mockRejectedValue(
        serviceError,
      );

      await expect(
        controller.createTenant(mockUser, createTenantDto),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('joinTenant', () => {
    const mockUser: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@example.com',
      tenantId: null,
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
      roles: [],
    };

    const joinTenantDto: JoinTenantDto = {
      invitationToken: 'invitation-token-123',
    };

    const mockResult = {
      tenant: {
        id: 'tenant-1',
        name: 'Existing Company',
        subdomain: null,
        googleSsoEnabled: false,
        googleAutoProvision: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      accessToken: 'jwt-token-456',
    };

    it('should successfully join tenant via invitation', async () => {
      tenantManagementService.joinTenantForUser.mockResolvedValue(mockResult);

      const result = await controller.joinTenant(mockUser, joinTenantDto);

      expect(result).toEqual(mockResult);
      expect(tenantManagementService.joinTenantForUser).toHaveBeenCalledWith(
        'user-1',
        'invitation-token-123',
      );
    });

    it('should handle NotFoundException when invitation not found', async () => {
      tenantManagementService.joinTenantForUser.mockRejectedValue(
        new NotFoundException('Invitation not found'),
      );

      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow('Invitation not found');
    });

    it('should handle BadRequestException when invitation is invalid', async () => {
      tenantManagementService.joinTenantForUser.mockRejectedValue(
        new BadRequestException('Invitation is no longer valid'),
      );

      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow('Invitation is no longer valid');
    });

    it('should handle BadRequestException when invitation has expired', async () => {
      tenantManagementService.joinTenantForUser.mockRejectedValue(
        new BadRequestException('Invitation has expired'),
      );

      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow('Invitation has expired');
    });

    it('should handle BadRequestException when email mismatch', async () => {
      tenantManagementService.joinTenantForUser.mockRejectedValue(
        new BadRequestException('Invitation email does not match user email'),
      );

      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow('Invitation email does not match user email');
    });

    it('should handle BadRequestException when user already has tenant', async () => {
      tenantManagementService.joinTenantForUser.mockRejectedValue(
        new BadRequestException('User already belongs to a tenant'),
      );

      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow('User already belongs to a tenant');
    });

    it('should handle NotFoundException when user not found', async () => {
      tenantManagementService.joinTenantForUser.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow('User not found');
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Database connection failed');
      tenantManagementService.joinTenantForUser.mockRejectedValue(serviceError);

      await expect(
        controller.joinTenant(mockUser, joinTenantDto),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('getTenantStatus', () => {
    const mockUser: AuthenticatedUser = {
      id: 'user-1',
      email: 'user@example.com',
      tenantId: null,
      firstName: 'John',
      lastName: 'Doe',
      emailVerified: true,
      roles: [],
    };

    const mockStatusResult = {
      hasTenant: false,
      tenant: undefined,
      availableInvitations: [
        {
          id: 'invitation-1',
          email: 'user@example.com',
          tenantId: 'tenant-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          token: 'token-123',
          invitedBy: 'admin-1',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          acceptedAt: null,
          cancelledAt: null,
          status: 'PENDING' as any,
          message: null,
          tenant: {
            id: 'tenant-1',
            name: 'Company A',
            subdomain: null,
            googleSsoEnabled: false,
            googleAutoProvision: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
        {
          id: 'invitation-2',
          email: 'user@example.com',
          tenantId: 'tenant-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          token: 'token-456',
          invitedBy: 'admin-2',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
          acceptedAt: null,
          cancelledAt: null,
          status: 'PENDING' as any,
          message: null,
          tenant: {
            id: 'tenant-2',
            name: 'Company B',
            subdomain: null,
            googleSsoEnabled: true,
            googleAutoProvision: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    };

    it('should return tenant status for tenant-less user with invitations', async () => {
      tenantManagementService.getUserTenantStatus.mockResolvedValue(
        mockStatusResult,
      );

      const result = await controller.getTenantStatus(mockUser);

      expect(result).toEqual(mockStatusResult);
      expect(result.hasTenant).toBe(false);
      expect(result.tenant).toBeUndefined();
      expect(result.availableInvitations).toHaveLength(2);
      expect(tenantManagementService.getUserTenantStatus).toHaveBeenCalledWith(
        'user-1',
      );
    });

    it('should return tenant status for tenant-less user without invitations', async () => {
      const statusWithoutInvitations = {
        hasTenant: false,
        tenant: undefined,
        availableInvitations: [],
      };

      tenantManagementService.getUserTenantStatus.mockResolvedValue(
        statusWithoutInvitations,
      );

      const result = await controller.getTenantStatus(mockUser);

      expect(result).toEqual(statusWithoutInvitations);
      expect(result.hasTenant).toBe(false);
      expect(result.availableInvitations).toHaveLength(0);
    });

    it('should return tenant status for user with tenant', async () => {
      const userWithTenant: AuthenticatedUser = {
        ...mockUser,
        tenantId: 'tenant-1',
      };

      const statusWithTenant = {
        hasTenant: true,
        tenant: {
          id: 'tenant-1',
          name: 'User Company',
          subdomain: null,
          googleSsoEnabled: false,
          googleAutoProvision: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        availableInvitations: [],
      };

      tenantManagementService.getUserTenantStatus.mockResolvedValue(
        statusWithTenant,
      );

      const result = await controller.getTenantStatus(userWithTenant);

      expect(result).toEqual(statusWithTenant);
      expect(result.hasTenant).toBe(true);
      expect(result.tenant).toBeDefined();
      expect(result.tenant?.id).toBe('tenant-1');
    });

    it('should handle NotFoundException when user not found', async () => {
      tenantManagementService.getUserTenantStatus.mockRejectedValue(
        new NotFoundException('User not found'),
      );

      await expect(controller.getTenantStatus(mockUser)).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getTenantStatus(mockUser)).rejects.toThrow(
        'User not found',
      );
    });

    it('should handle service errors gracefully', async () => {
      const serviceError = new Error('Database connection failed');
      tenantManagementService.getUserTenantStatus.mockRejectedValue(
        serviceError,
      );

      await expect(controller.getTenantStatus(mockUser)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('Guard Integration', () => {
    it('should be protected by JwtAuthGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        TenantManagementController,
      );
      expect(guards).toContain(JwtAuthGuard);
    });

    it('should be protected by TenantLessOnlyGuard', () => {
      const guards = Reflect.getMetadata(
        '__guards__',
        TenantManagementController,
      );
      expect(guards).toContain(TenantLessOnlyGuard);
    });

    it('should skip email verification', () => {
      const skipEmailVerification = Reflect.getMetadata(
        'skipEmailVerification',
        TenantManagementController,
      );
      expect(skipEmailVerification).toBe(true);
    });
  });
});
