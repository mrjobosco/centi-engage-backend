import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { AuthAuditService } from './auth-audit.service';
import { PrismaService } from '../../database/prisma.service';
import { GoogleProfile } from '../interfaces/google-profile.interface';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let authAuditService: jest.Mocked<AuthAuditService>;

  const mockTenant = {
    id: 'tenant-1',
    name: 'Test Tenant',
    googleSsoEnabled: true,
    googleAutoProvision: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    subdomain: 'test',
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: 'hashedpassword',
    firstName: 'John',
    lastName: 'Doe',
    tenantId: 'tenant-1',
    googleId: null,
    googleLinkedAt: null,
    authMethods: ['password'],
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [
      {
        role: {
          id: 'role-1',
          name: 'Member',
        },
      },
    ],
  };

  const mockGoogleProfile: GoogleProfile = {
    id: 'google-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    picture: 'https://example.com/photo.jpg',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      tenant: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      role: {
        findFirst: jest.fn(),
      },
      userRole: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockAuthAuditService = {
      logGoogleSignIn: jest.fn(),
      logGoogleLink: jest.fn(),
      logGoogleUnlink: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AuthAuditService,
          useValue: mockAuthAuditService,
        },
      ],
    }).compile();

    service = module.get<GoogleAuthService>(GoogleAuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    authAuditService = module.get(AuthAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateTenantGoogleSSO', () => {
    it('should return tenant when Google SSO is enabled', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.validateTenantGoogleSSO('tenant-1');

      expect(result).toEqual(mockTenant);
      expect(prismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        select: {
          id: true,
          googleSsoEnabled: true,
          googleAutoProvision: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          subdomain: true,
        },
      });
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      prismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.validateTenantGoogleSSO('invalid-tenant'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when Google SSO is disabled', async () => {
      const disabledTenant = { ...mockTenant, googleSsoEnabled: false };
      prismaService.tenant.findUnique.mockResolvedValue(disabledTenant);

      await expect(service.validateTenantGoogleSSO('tenant-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('authenticateWithGoogle', () => {
    beforeEach(() => {
      prismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      jwtService.sign.mockReturnValue('mock-jwt-token');
      authAuditService.logGoogleSignIn.mockResolvedValue(undefined);
    });

    it('should authenticate existing Google user successfully', async () => {
      const googleUser = {
        ...mockUser,
        googleId: 'google-123',
        authMethods: ['google'],
      };
      prismaService.user.findUnique.mockResolvedValueOnce(googleUser);

      const result = await service.authenticateWithGoogle(
        mockGoogleProfile,
        'tenant-1',
      );

      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        roles: ['role-1'],
      });
      expect(authAuditService.logGoogleSignIn).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
        true,
        undefined,
        undefined,
      );
    });

    it('should throw UnauthorizedException when Google user belongs to different tenant', async () => {
      const googleUser = {
        ...mockUser,
        googleId: 'google-123',
        tenantId: 'other-tenant',
      };
      prismaService.user.findUnique.mockResolvedValueOnce(googleUser);

      await expect(
        service.authenticateWithGoogle(mockGoogleProfile, 'tenant-1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(authAuditService.logGoogleSignIn).toHaveBeenCalledWith(
        'unknown',
        'tenant-1',
        false,
        undefined,
        undefined,
        'UnauthorizedException',
        'User belongs to different tenant',
        { googleEmail: 'test@example.com' },
      );
    });

    it('should auto-link existing user by email', async () => {
      const existingUser = { ...mockUser };
      const linkedUser = {
        ...mockUser,
        googleId: 'google-123',
        authMethods: ['password', 'google'],
      };

      prismaService.user.findUnique
        .mockResolvedValueOnce(null) // No user found by Google ID
        .mockResolvedValueOnce(existingUser) // User found by email
        .mockResolvedValueOnce({ authMethods: ['password'] }) // User for linkGoogleAccountInternal
        .mockResolvedValueOnce(linkedUser); // User after linking

      prismaService.user.update.mockResolvedValue(linkedUser);

      const result = await service.authenticateWithGoogle(
        mockGoogleProfile,
        'tenant-1',
      );

      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          googleId: 'google-123',
          googleLinkedAt: expect.any(Date),
          authMethods: ['password', 'google'],
        },
      });
    });

    it('should create new user when auto-provisioning is enabled', async () => {
      const newUser = {
        ...mockUser,
        id: 'new-user-1',
        googleId: 'google-123',
        authMethods: ['google'],
      };
      const memberRole = {
        id: 'role-member',
        name: 'Member',
        tenantId: 'tenant-1',
      };

      prismaService.user.findUnique
        .mockResolvedValueOnce(null) // No user found by Google ID
        .mockResolvedValueOnce(null); // No user found by email

      prismaService.role.findFirst.mockResolvedValue(memberRole);
      prismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest.fn().mockResolvedValue(newUser),
            findUnique: jest.fn().mockResolvedValue(newUser),
          },
          userRole: {
            create: jest.fn(),
          },
        });
      });

      const result = await service.authenticateWithGoogle(
        mockGoogleProfile,
        'tenant-1',
      );

      expect(result).toEqual({ accessToken: 'mock-jwt-token' });
    });

    it('should throw UnauthorizedException when auto-provisioning is disabled and user not found', async () => {
      const tenantWithoutAutoProvision = {
        ...mockTenant,
        googleAutoProvision: false,
      };
      prismaService.tenant.findUnique.mockResolvedValue(
        tenantWithoutAutoProvision,
      );
      prismaService.user.findUnique
        .mockResolvedValueOnce(null) // No user found by Google ID
        .mockResolvedValueOnce(null); // No user found by email

      await expect(
        service.authenticateWithGoogle(mockGoogleProfile, 'tenant-1'),
      ).rejects.toThrow(UnauthorizedException);

      expect(authAuditService.logGoogleSignIn).toHaveBeenCalledWith(
        'unknown',
        'tenant-1',
        false,
        undefined,
        undefined,
        'UnauthorizedException',
        'User not found and auto-provisioning is disabled',
        { googleEmail: 'test@example.com' },
      );
    });
  });

  describe('createUserFromGoogle', () => {
    it('should create new user with Member role', async () => {
      const memberRole = {
        id: 'role-member',
        name: 'Member',
        tenantId: 'tenant-1',
      };
      const newUser = {
        ...mockUser,
        id: 'new-user-1',
        googleId: 'google-123',
        authMethods: ['google'],
        password: '',
      };

      prismaService.role.findFirst.mockResolvedValue(memberRole);
      prismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest.fn().mockResolvedValue(newUser),
            findUnique: jest.fn().mockResolvedValue(newUser),
          },
          userRole: {
            create: jest.fn(),
          },
        });
      });

      const result = await service.createUserFromGoogle(
        mockGoogleProfile,
        'tenant-1',
      );

      expect(result).toEqual(newUser);
    });

    it('should throw NotFoundException when Member role not found', async () => {
      prismaService.role.findFirst.mockResolvedValue(null);

      await expect(
        service.createUserFromGoogle(mockGoogleProfile, 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('linkGoogleAccount', () => {
    beforeEach(() => {
      authAuditService.logGoogleLink.mockResolvedValue(undefined);
    });

    it('should link Google account successfully', async () => {
      const user = { ...mockUser };
      prismaService.user.findUnique
        .mockResolvedValueOnce(user) // Get current user
        .mockResolvedValueOnce(null) // No existing Google user
        .mockResolvedValueOnce({ authMethods: ['password'] }); // User for linkGoogleAccountInternal

      prismaService.user.update.mockResolvedValue({
        ...user,
        googleId: 'google-123',
        authMethods: ['password', 'google'],
      });

      await service.linkGoogleAccount('user-1', mockGoogleProfile);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          googleId: 'google-123',
          googleLinkedAt: expect.any(Date),
          authMethods: ['password', 'google'],
        },
      });
      expect(authAuditService.logGoogleLink).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
        true,
        undefined,
        undefined,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      prismaService.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.linkGoogleAccount('invalid-user', mockGoogleProfile),
      ).rejects.toThrow(NotFoundException);

      expect(authAuditService.logGoogleLink).toHaveBeenCalledWith(
        'invalid-user',
        'unknown',
        false,
        undefined,
        undefined,
        'NotFoundException',
        'User not found',
        { googleEmail: 'test@example.com' },
      );
    });

    it('should throw BadRequestException when emails do not match', async () => {
      const user = { ...mockUser, email: 'different@example.com' };
      prismaService.user.findUnique.mockResolvedValueOnce(user);

      await expect(
        service.linkGoogleAccount('user-1', mockGoogleProfile),
      ).rejects.toThrow(BadRequestException);

      expect(authAuditService.logGoogleLink).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
        false,
        undefined,
        undefined,
        'BadRequestException',
        'Google email must match your account email',
        { googleEmail: 'test@example.com' },
      );
    });

    it('should throw ConflictException when Google account already linked to another user', async () => {
      const user = { ...mockUser };
      const existingGoogleUser = {
        ...mockUser,
        id: 'other-user',
        googleId: 'google-123',
      };

      prismaService.user.findUnique
        .mockResolvedValueOnce(user) // Get current user
        .mockResolvedValueOnce(existingGoogleUser); // Existing Google user

      await expect(
        service.linkGoogleAccount('user-1', mockGoogleProfile),
      ).rejects.toThrow(ConflictException);

      expect(authAuditService.logGoogleLink).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
        false,
        undefined,
        undefined,
        'ConflictException',
        'Google account is already linked to another user',
        { googleEmail: 'test@example.com' },
      );
    });
  });

  describe('unlinkGoogleAccount', () => {
    beforeEach(() => {
      authAuditService.logGoogleUnlink.mockResolvedValue(undefined);
    });

    it('should unlink Google account successfully', async () => {
      const user = {
        authMethods: ['password', 'google'],
        googleId: 'google-123',
        tenantId: 'tenant-1',
      };
      prismaService.user.findUnique.mockResolvedValue(user);
      prismaService.user.update.mockResolvedValue({
        ...user,
        googleId: null,
        authMethods: ['password'],
      });

      await service.unlinkGoogleAccount('user-1');

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          googleId: null,
          googleLinkedAt: null,
          authMethods: ['password'],
        },
      });
      expect(authAuditService.logGoogleUnlink).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
        true,
        undefined,
        undefined,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.unlinkGoogleAccount('invalid-user')).rejects.toThrow(
        NotFoundException,
      );

      expect(authAuditService.logGoogleUnlink).toHaveBeenCalledWith(
        'invalid-user',
        'unknown',
        false,
        undefined,
        undefined,
        'NotFoundException',
        'User not found',
      );
    });

    it('should throw BadRequestException when Google account is not linked', async () => {
      const user = {
        authMethods: ['password'],
        googleId: null,
        tenantId: 'tenant-1',
      };
      prismaService.user.findUnique.mockResolvedValue(user);

      await expect(service.unlinkGoogleAccount('user-1')).rejects.toThrow(
        BadRequestException,
      );

      expect(authAuditService.logGoogleUnlink).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
        false,
        undefined,
        undefined,
        'BadRequestException',
        'Google account is not linked',
      );
    });

    it('should throw BadRequestException when no other auth methods available', async () => {
      const user = {
        authMethods: ['google'],
        googleId: 'google-123',
        tenantId: 'tenant-1',
      };
      prismaService.user.findUnique.mockResolvedValue(user);

      await expect(service.unlinkGoogleAccount('user-1')).rejects.toThrow(
        BadRequestException,
      );

      expect(authAuditService.logGoogleUnlink).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
        false,
        undefined,
        undefined,
        'BadRequestException',
        'Cannot unlink Google account - no other authentication methods available',
      );
    });
  });

  describe('getUserAuthMethods', () => {
    it('should return user auth methods', async () => {
      const user = { authMethods: ['password', 'google'] };
      prismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.getUserAuthMethods('user-1');

      expect(result).toEqual(['password', 'google']);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { authMethods: true },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserAuthMethods('invalid-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
