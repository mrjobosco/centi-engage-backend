import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './tenant.service';
import { PrismaService } from '../database/prisma.service';
import { ConflictException } from '@nestjs/common';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('TenantService', () => {
  let service: TenantService;

  const mockPrismaService = {
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
    user: {
      create: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuthAuditService,
          useValue: {
            logGoogleSettingsUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTenant', () => {
    const validInput = {
      tenantName: 'Test Tenant',
      adminEmail: 'admin@test.com',
      adminPassword: 'Test@1234',
      adminFirstName: 'John',
      adminLastName: 'Doe',
    };

    const mockTenant = {
      id: 'tenant-1',
      name: 'Test Tenant',
      subdomain: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPermission = {
      id: 'perm-1',
      action: 'create',
      subject: 'project',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockAdminRole = {
      id: 'role-1',
      name: 'Admin',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMemberRole = {
      id: 'role-2',
      name: 'Member',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUser = {
      id: 'user-1',
      email: 'admin@test.com',
      password: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully create a tenant with all default data', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          permission: {
            create: jest.fn().mockResolvedValue(mockPermission),
          },
          role: {
            create: jest
              .fn()
              .mockResolvedValueOnce(mockAdminRole)
              .mockResolvedValueOnce(mockMemberRole),
          },
          rolePermission: {
            create: jest.fn().mockResolvedValue({}),
          },
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          userRole: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return await callback(mockTx);
      });

      const result = await service.createTenant(validInput);

      expect(result).toHaveProperty('tenant');
      expect(result).toHaveProperty('adminUser');
      expect(result.tenant.id).toBe('tenant-1');
      expect(result.adminUser.email).toBe('admin@test.com');
      expect(result.adminUser).not.toHaveProperty('password');
      expect(mockPrismaService.tenant.findFirst).toHaveBeenCalledWith({
        where: { name: validInput.tenantName },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(validInput.adminPassword, 10);
    });

    it('should hash the admin password with bcrypt', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          permission: {
            create: jest.fn().mockResolvedValue(mockPermission),
          },
          role: {
            create: jest
              .fn()
              .mockResolvedValueOnce(mockAdminRole)
              .mockResolvedValueOnce(mockMemberRole),
          },
          rolePermission: {
            create: jest.fn().mockResolvedValue({}),
          },
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          userRole: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return await callback(mockTx);
      });

      await service.createTenant(validInput);

      expect(bcrypt.hash).toHaveBeenCalledWith(validInput.adminPassword, 10);
    });

    it('should throw ConflictException if tenant name already exists', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue(mockTenant);

      await expect(service.createTenant(validInput)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createTenant(validInput)).rejects.toThrow(
        'Tenant name already exists',
      );
    });

    it('should handle duplicate email within transaction', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const duplicateError = new Error('Unique constraint failed');
      (duplicateError as any).code = 'P2002';
      (duplicateError as any).meta = { target: ['email', 'tenantId'] };

      mockPrismaService.$transaction.mockRejectedValue(duplicateError);

      await expect(service.createTenant(validInput)).rejects.toThrow();
    });

    it('should rollback transaction on failure', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const transactionError = new Error('Transaction failed');
      mockPrismaService.$transaction.mockRejectedValue(transactionError);

      await expect(service.createTenant(validInput)).rejects.toThrow(
        'Transaction failed',
      );
    });

    it('should create 15 default permissions', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      let permissionCreateCount = 0;

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          permission: {
            create: jest.fn().mockImplementation(() => {
              permissionCreateCount++;
              return Promise.resolve(mockPermission);
            }),
          },
          role: {
            create: jest
              .fn()
              .mockResolvedValueOnce(mockAdminRole)
              .mockResolvedValueOnce(mockMemberRole),
          },
          rolePermission: {
            create: jest.fn().mockResolvedValue({}),
          },
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          userRole: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return await callback(mockTx);
      });

      await service.createTenant(validInput);

      expect(permissionCreateCount).toBe(15);
    });

    it('should create Admin and Member roles', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const roleCreateMock = jest
        .fn()
        .mockResolvedValueOnce(mockAdminRole)
        .mockResolvedValueOnce(mockMemberRole);

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          permission: {
            create: jest.fn().mockResolvedValue(mockPermission),
          },
          role: {
            create: roleCreateMock,
          },
          rolePermission: {
            create: jest.fn().mockResolvedValue({}),
          },
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          userRole: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return await callback(mockTx);
      });

      await service.createTenant(validInput);

      expect(roleCreateMock).toHaveBeenCalledWith({
        data: {
          name: 'Admin',
          tenantId: mockTenant.id,
        },
      });
      expect(roleCreateMock).toHaveBeenCalledWith({
        data: {
          name: 'Member',
          tenantId: mockTenant.id,
        },
      });
    });

    it('should assign Admin role to the admin user', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const userRoleCreateMock = jest.fn().mockResolvedValue({});

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          permission: {
            create: jest.fn().mockResolvedValue(mockPermission),
          },
          role: {
            create: jest
              .fn()
              .mockResolvedValueOnce(mockAdminRole)
              .mockResolvedValueOnce(mockMemberRole),
          },
          rolePermission: {
            create: jest.fn().mockResolvedValue({}),
          },
          user: {
            create: jest.fn().mockResolvedValue(mockUser),
          },
          userRole: {
            create: userRoleCreateMock,
          },
        };

        return await callback(mockTx);
      });

      await service.createTenant(validInput);

      expect(userRoleCreateMock).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          roleId: mockAdminRole.id,
        },
      });
    });
  });
});
