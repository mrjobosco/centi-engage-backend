import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TenantManagementService } from './tenant-management.service';
import { PrismaService } from '../database/prisma.service';
import { TenantService } from './tenant.service';
import { CreateTenantForUserDto } from './dto/create-tenant-for-user.dto';

describe('TenantManagementService', () => {
  let service: TenantManagementService;
  let prismaService: jest.Mocked<PrismaService>;
  let tenantService: jest.Mocked<TenantService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    tenantId: null,
    firstName: 'John',
    lastName: 'Doe',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTenant = {
    id: 'tenant-1',
    name: 'Test Tenant',
    googleSsoEnabled: false,
    googleAutoProvision: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRole = {
    id: 'role-1',
    name: 'Admin',
    tenantId: 'tenant-1',
  };

  const mockInvitation = {
    id: 'invitation-1',
    email: 'test@example.com',
    token: 'invitation-token',
    status: 'PENDING',
    tenantId: 'tenant-1',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    acceptedAt: null,
    cancelledAt: null,
    tenant: mockTenant,
    roles: [
      {
        role: mockRole,
        roleId: 'role-1',
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      permission: {
        create: jest.fn(),
      },
      role: {
        create: jest.fn(),
      },
      rolePermission: {
        create: jest.fn(),
      },
      userRole: {
        create: jest.fn(),
      },
      tenantInvitation: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockTenantService = {};

    const mockJwtService = {
      sign: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantManagementService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TenantService,
          useValue: mockTenantService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<TenantManagementService>(TenantManagementService);
    prismaService = module.get(PrismaService);
    tenantService = module.get(TenantService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTenantForUser', () => {
    const createTenantDto: CreateTenantForUserDto = {
      tenantName: 'Test Tenant',
      description: 'Test Description',
    };

    it('should create tenant for tenant-less user successfully', async () => {
      // Mock user lookup
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Mock tenant name availability check
      prismaService.tenant.findFirst.mockResolvedValue(null);

      // Mock JWT token generation
      jwtService.sign.mockReturnValue('mock-jwt-token');

      // Mock transaction
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockPermissions = [
          { id: 'perm-1', action: 'create', subject: 'project' },
          { id: 'perm-2', action: 'read', subject: 'project' },
          { id: 'perm-3', action: 'update', subject: 'project' },
          { id: 'perm-4', action: 'delete', subject: 'project' },
          { id: 'perm-5', action: 'read', subject: 'user' },
        ];

        let permissionIndex = 0;

        return callback({
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          permission: {
            create: jest.fn().mockImplementation(() => {
              return Promise.resolve(
                mockPermissions[permissionIndex++] || mockPermissions[0],
              );
            }),
          },
          role: {
            create: jest.fn().mockResolvedValue(mockRole),
          },
          rolePermission: {
            create: jest.fn().mockResolvedValue({}),
          },
          user: {
            update: jest.fn().mockResolvedValue({}),
          },
          userRole: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.createTenantForUser(
        'user-1',
        createTenantDto,
      );

      expect(result).toEqual({
        tenant: mockTenant,
        accessToken: 'mock-jwt-token',
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(prismaService.tenant.findFirst).toHaveBeenCalledWith({
        where: { name: 'Test Tenant' },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        roles: ['role-1'],
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createTenantForUser('user-1', createTenantDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user already has tenant', async () => {
      const userWithTenant = { ...mockUser, tenantId: 'existing-tenant' };
      prismaService.user.findUnique.mockResolvedValue(userWithTenant);

      await expect(
        service.createTenantForUser('user-1', createTenantDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when tenant name already exists', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.tenant.findFirst.mockResolvedValue(mockTenant);

      await expect(
        service.createTenantForUser('user-1', createTenantDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('joinTenantForUser', () => {
    const invitationToken = 'invitation-token';

    it('should join tenant via invitation successfully', async () => {
      // Mock user lookup
      prismaService.user.findUnique.mockResolvedValue(mockUser);

      // Mock invitation lookup
      prismaService.tenantInvitation.findUnique.mockResolvedValue(
        mockInvitation,
      );

      // Mock JWT token generation
      jwtService.sign.mockReturnValue('mock-jwt-token');

      // Mock transaction
      prismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: {
            update: jest.fn().mockResolvedValue({}),
          },
          userRole: {
            create: jest.fn().mockResolvedValue({}),
          },
          tenantInvitation: {
            update: jest.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await service.joinTenantForUser('user-1', invitationToken);

      expect(result).toEqual({
        tenant: mockTenant,
        accessToken: 'mock-jwt-token',
      });
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(prismaService.tenantInvitation.findUnique).toHaveBeenCalledWith({
        where: { token: invitationToken },
        include: {
          tenant: true,
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.joinTenantForUser('user-1', invitationToken),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when user already has tenant', async () => {
      const userWithTenant = { ...mockUser, tenantId: 'existing-tenant' };
      prismaService.user.findUnique.mockResolvedValue(userWithTenant);

      await expect(
        service.joinTenantForUser('user-1', invitationToken),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when invitation does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.tenantInvitation.findUnique.mockResolvedValue(null);

      await expect(
        service.joinTenantForUser('user-1', invitationToken),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when invitation is not pending', async () => {
      const acceptedInvitation = { ...mockInvitation, status: 'ACCEPTED' };
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.tenantInvitation.findUnique.mockResolvedValue(
        acceptedInvitation,
      );

      await expect(
        service.joinTenantForUser('user-1', invitationToken),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when invitation has expired', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      };
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.tenantInvitation.findUnique.mockResolvedValue(
        expiredInvitation,
      );

      await expect(
        service.joinTenantForUser('user-1', invitationToken),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when invitation email does not match user email', async () => {
      const mismatchedInvitation = {
        ...mockInvitation,
        email: 'other@example.com',
      };
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.tenantInvitation.findUnique.mockResolvedValue(
        mismatchedInvitation,
      );

      await expect(
        service.joinTenantForUser('user-1', invitationToken),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserTenantStatus', () => {
    it('should return tenant status for user with tenant', async () => {
      const userWithTenant = {
        ...mockUser,
        tenantId: 'tenant-1',
        tenant: mockTenant,
      };

      prismaService.user.findUnique.mockResolvedValue(userWithTenant);
      prismaService.tenantInvitation.findMany.mockResolvedValue([]);

      const result = await service.getUserTenantStatus('user-1');

      expect(result).toEqual({
        hasTenant: true,
        tenant: mockTenant,
        availableInvitations: [],
      });
    });

    it('should return tenant status for tenant-less user with available invitations', async () => {
      prismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        tenant: null,
      });
      prismaService.tenantInvitation.findMany.mockResolvedValue([
        mockInvitation,
      ]);

      const result = await service.getUserTenantStatus('user-1');

      expect(result).toEqual({
        hasTenant: false,
        tenant: undefined,
        availableInvitations: [mockInvitation],
      });
      expect(prismaService.tenantInvitation.findMany).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          status: 'PENDING',
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        include: {
          tenant: true,
        },
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserTenantStatus('user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
