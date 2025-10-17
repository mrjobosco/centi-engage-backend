import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { AuthAuditService } from './services/auth-audit.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import {
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  Scope,
} from '@nestjs/common';
import { GoogleProfile } from './interfaces/google-profile.interface';

// Mock Prisma Service
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

// Mock Auth Audit Service
const mockAuthAuditService = {
  logGoogleSignIn: jest.fn(),
  logGoogleLink: jest.fn(),
  logGoogleUnlink: jest.fn(),
};

// Mock Config Service
const mockConfigService = {
  get: jest.fn((key: string): string => {
    const config: Record<string, string> = {
      'config.google.clientId': 'test-client-id',
      'config.google.clientSecret': 'test-client-secret',
      'config.google.callbackUrl': 'http://localhost:3000/auth/google/callback',
    };
    return config[key];
  }),
};

describe('Google Authentication Flow Tests', () => {
  let googleAuthService: GoogleAuthService;
  let googleOAuthService: GoogleOAuthService;
  let jwtService: JwtService;
  let mockTenantContext: any;

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
    firstName: 'Test',
    lastName: 'User',
    tenantId: 'tenant-1',
    googleId: null,
    googleLinkedAt: null,
    authMethods: ['password'],
    roles: [
      {
        role: {
          id: 'role-1',
          name: 'Member',
        },
      },
    ],
  };

  beforeAll(async () => {
    // Create mock tenant context
    mockTenantContext = {
      setTenantId: jest.fn(),
      getTenantId: jest.fn(),
      getRequiredTenantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        GoogleOAuthService,
        {
          provide: AuthAuditService,
          useValue: mockAuthAuditService,
        },
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: 'test-secret-key',
            signOptions: { expiresIn: '15m' },
          }),
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TenantContextService,
          scope: Scope.REQUEST,
          useValue: mockTenantContext,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    googleAuthService = module.get<GoogleAuthService>(GoogleAuthService);
    googleOAuthService = module.get<GoogleOAuthService>(GoogleOAuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockTenantContext.getTenantId.mockReturnValue(mockTenant.id);
    mockTenantContext.getRequiredTenantId.mockReturnValue(mockTenant.id);
  });

  describe('Tenant Google SSO Validation', () => {
    it('should validate tenant with Google SSO enabled', async () => {
      // Arrange
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      // Act
      const result = await googleAuthService.validateTenantGoogleSSO(
        mockTenant.id,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockTenant.id);
      expect(result.googleSsoEnabled).toBe(true);
      expect(result.googleAutoProvision).toBe(true);
      expect(mockPrismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: mockTenant.id },
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

    it('should throw ForbiddenException for tenant without Google SSO', async () => {
      // Arrange
      const tenantWithoutSSO = { ...mockTenant, googleSsoEnabled: false };
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenantWithoutSSO);

      // Act & Assert
      await expect(
        googleAuthService.validateTenantGoogleSSO(mockTenant.id),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        googleAuthService.validateTenantGoogleSSO(mockTenant.id),
      ).rejects.toThrow('Google SSO is not enabled for this tenant');
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      // Arrange
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        googleAuthService.validateTenantGoogleSSO('non-existent-tenant-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        googleAuthService.validateTenantGoogleSSO('non-existent-tenant-id'),
      ).rejects.toThrow('Tenant not found');
    });
  });

  describe('Google OAuth URL Generation', () => {
    it('should generate valid Google OAuth URL', () => {
      // Act
      const authUrl = googleOAuthService.generateAuthUrl('test-state');

      // Assert
      expect(authUrl).toBeDefined();
      expect(authUrl).toContain('accounts.google.com');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fgoogle%2Fcallback',
      );
      expect(authUrl).toContain('state=test-state');
      expect(authUrl).toContain('scope=email%20profile');
    });

    it('should generate URL without state parameter', () => {
      // Act
      const authUrl = googleOAuthService.generateAuthUrl();

      // Assert
      expect(authUrl).toBeDefined();
      expect(authUrl).toContain('accounts.google.com');
      expect(authUrl).not.toContain('state=test-state');
    });

    it('should check if Google OAuth is configured', () => {
      // Act
      const isConfigured = googleOAuthService.isConfigured();

      // Assert
      expect(isConfigured).toBe(true);
    });
  });

  describe('Google User Authentication - New User Creation', () => {
    it('should create new user when auto-provisioning is enabled', async () => {
      // Arrange
      const mockGoogleProfile: GoogleProfile = {
        id: 'google123',
        email: 'newuser@example.com',
        firstName: 'New',
        lastName: 'User',
        picture: 'https://example.com/photo.jpg',
      };

      const newUser = {
        ...mockUser,
        id: 'new-user-1',
        email: mockGoogleProfile.email,
        firstName: mockGoogleProfile.firstName,
        lastName: mockGoogleProfile.lastName,
        googleId: mockGoogleProfile.id,
        googleLinkedAt: new Date(),
        authMethods: ['google'],
      };

      const memberRole = {
        id: 'role-1',
        name: 'Member',
        tenantId: mockTenant.id,
      };

      // Setup mocks
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // No existing user by Google ID
        .mockResolvedValueOnce(null); // No existing user by email
      mockPrismaService.role.findFirst.mockResolvedValue(memberRole);
      mockPrismaService.$transaction.mockImplementation((callback) => {
        return callback({
          user: {
            create: jest.fn().mockResolvedValue(newUser),
            findUnique: jest
              .fn()
              .mockResolvedValue({ ...newUser, roles: mockUser.roles }),
          },
          userRole: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      });

      // Act
      const result = await googleAuthService.authenticateWithGoogle(
        mockGoogleProfile,
        mockTenant.id,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(mockAuthAuditService.logGoogleSignIn).toHaveBeenCalledWith(
        newUser.id,
        mockTenant.id,
        true,
        undefined,
        undefined,
      );

      // Verify JWT token contains correct information
      const decoded = jwtService.decode(result.accessToken);
      expect(decoded.userId).toBe(newUser.id);
      expect(decoded.tenantId).toBe(mockTenant.id);
    });

    it('should reject new user creation when auto-provisioning is disabled', async () => {
      // Arrange
      const mockGoogleProfile: GoogleProfile = {
        id: 'google456',
        email: 'newuser2@example.com',
        firstName: 'New',
        lastName: 'User2',
      };

      const tenantWithoutAutoProvision = {
        ...mockTenant,
        googleAutoProvision: false,
      };

      // Setup mocks
      mockPrismaService.tenant.findUnique.mockResolvedValue(
        tenantWithoutAutoProvision,
      );
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // No existing user by Google ID
        .mockResolvedValueOnce(null); // No existing user by email

      // Act & Assert
      await expect(
        googleAuthService.authenticateWithGoogle(
          mockGoogleProfile,
          mockTenant.id,
        ),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        googleAuthService.authenticateWithGoogle(
          mockGoogleProfile,
          mockTenant.id,
        ),
      ).rejects.toThrow('User not found and auto-provisioning is disabled');

      expect(mockAuthAuditService.logGoogleSignIn).toHaveBeenCalledWith(
        'unknown',
        mockTenant.id,
        false,
        undefined,
        undefined,
        'UnauthorizedException',
        'User not found and auto-provisioning is disabled',
        { googleEmail: mockGoogleProfile.email },
      );
    });
  });

  describe('Google User Authentication - Auto-Linking', () => {
    it('should auto-link Google account to existing user with matching email', async () => {
      // Arrange
      const mockGoogleProfile: GoogleProfile = {
        id: 'google789',
        email: mockUser.email,
        firstName: 'Updated',
        lastName: 'Name',
      };

      const updatedUser = {
        ...mockUser,
        googleId: mockGoogleProfile.id,
        googleLinkedAt: new Date(),
        authMethods: ['password', 'google'],
      };

      // Setup mocks
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // No existing user by Google ID
        .mockResolvedValueOnce(mockUser) // Existing user by email
        .mockResolvedValueOnce({ authMethods: ['password'] }) // For internal linking
        .mockResolvedValueOnce({ ...updatedUser, roles: mockUser.roles }); // After linking
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await googleAuthService.authenticateWithGoogle(
        mockGoogleProfile,
        mockTenant.id,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          googleId: mockGoogleProfile.id,
          googleLinkedAt: expect.any(Date),
          authMethods: ['password', 'google'],
        },
      });

      // Verify JWT token contains correct information
      const decoded = jwtService.decode(result.accessToken);
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.tenantId).toBe(mockTenant.id);
    });

    it('should authenticate existing Google user on subsequent sign-ins', async () => {
      // Arrange
      const existingGoogleUser = {
        ...mockUser,
        googleId: 'google999',
        googleLinkedAt: new Date(),
        authMethods: ['password', 'google'],
      };

      const mockGoogleProfile: GoogleProfile = {
        id: 'google999',
        email: mockUser.email,
        firstName: 'Existing',
        lastName: 'User',
      };

      // Setup mocks
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...existingGoogleUser,
        roles: mockUser.roles,
      });

      // Act
      const result = await googleAuthService.authenticateWithGoogle(
        mockGoogleProfile,
        mockTenant.id,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();

      // Verify JWT token contains correct information
      const decoded = jwtService.decode(result.accessToken);
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.tenantId).toBe(mockTenant.id);
    });
  });

  describe('Cross-Tenant Access Prevention', () => {
    it('should prevent user from different tenant authenticating', async () => {
      // Arrange
      const userInOtherTenant = {
        ...mockUser,
        id: 'other-user-1',
        tenantId: 'other-tenant-1',
        googleId: 'google-other-tenant',
        authMethods: ['google'],
      };

      const mockGoogleProfile: GoogleProfile = {
        id: 'google-other-tenant',
        email: 'user@othertenant.com',
        firstName: 'Other',
        lastName: 'User',
      };

      // Setup mocks
      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...userInOtherTenant,
        roles: mockUser.roles,
      });

      // Act & Assert
      await expect(
        googleAuthService.authenticateWithGoogle(
          mockGoogleProfile,
          mockTenant.id,
        ),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        googleAuthService.authenticateWithGoogle(
          mockGoogleProfile,
          mockTenant.id,
        ),
      ).rejects.toThrow('User belongs to different tenant');
    });
  });

  describe('Account Linking', () => {
    it('should successfully link Google account to user with matching email', async () => {
      // Arrange
      const mockGoogleProfile: GoogleProfile = {
        id: 'new-google-link-id',
        email: mockUser.email,
        firstName: 'Updated',
        lastName: 'Name',
      };

      // Setup mocks
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // Get current user
        .mockResolvedValueOnce(null) // No existing Google user
        .mockResolvedValueOnce({ authMethods: ['password'] }); // Get auth methods for update
      mockPrismaService.user.update.mockResolvedValue({});

      // Act
      await googleAuthService.linkGoogleAccount(mockUser.id, mockGoogleProfile);

      // Assert
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          googleId: mockGoogleProfile.id,
          googleLinkedAt: expect.any(Date),
          authMethods: ['password', 'google'],
        },
      });
      expect(mockAuthAuditService.logGoogleLink).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.tenantId,
        true,
        undefined,
        undefined,
      );
    });

    it('should reject linking when Google email does not match user email', async () => {
      // Arrange
      const mockGoogleProfile: GoogleProfile = {
        id: 'different-email-google-id',
        email: 'different@example.com',
        firstName: 'Different',
        lastName: 'User',
      };

      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(
        googleAuthService.linkGoogleAccount(mockUser.id, mockGoogleProfile),
      ).rejects.toThrow(BadRequestException);
      await expect(
        googleAuthService.linkGoogleAccount(mockUser.id, mockGoogleProfile),
      ).rejects.toThrow('Google email must match your account email');
    });

    it('should reject linking when Google account is already linked to another user', async () => {
      // Arrange
      const otherUser = {
        ...mockUser,
        id: 'other-user-1',
        email: 'other@example.com',
        googleId: 'existing-google-id', // This user already has this Google ID
      };
      const mockGoogleProfile: GoogleProfile = {
        id: 'existing-google-id', // Same Google ID as otherUser
        email: mockUser.email, // Same email as current user (passes email check)
        firstName: 'Test',
        lastName: 'User',
      };

      // Setup mocks
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(mockUser) // Get current user (first call)
        .mockResolvedValueOnce(otherUser); // Existing Google user (second call)

      // Act & Assert
      await expect(
        googleAuthService.linkGoogleAccount(mockUser.id, mockGoogleProfile),
      ).rejects.toThrow('Google account is already linked to another user');
    });
  });

  describe('Account Unlinking', () => {
    it('should successfully unlink Google account when user has other auth methods', async () => {
      // Arrange
      const userWithGoogle = {
        ...mockUser,
        googleId: 'google-to-unlink',
        authMethods: ['password', 'google'],
        tenantId: mockUser.tenantId,
      };

      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue(userWithGoogle);
      mockPrismaService.user.update.mockResolvedValue({});

      // Act
      await googleAuthService.unlinkGoogleAccount(mockUser.id);

      // Assert
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          googleId: null,
          googleLinkedAt: null,
          authMethods: ['password'],
        },
      });
      expect(mockAuthAuditService.logGoogleUnlink).toHaveBeenCalledWith(
        mockUser.id,
        userWithGoogle.tenantId,
        true,
        undefined,
        undefined,
      );
    });

    it('should reject unlinking when user has no other auth methods', async () => {
      // Arrange
      const googleOnlyUser = {
        ...mockUser,
        googleId: 'google-only-id',
        authMethods: ['google'],
        tenantId: mockUser.tenantId,
      };

      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue(googleOnlyUser);

      // Act & Assert
      await expect(
        googleAuthService.unlinkGoogleAccount(mockUser.id),
      ).rejects.toThrow(BadRequestException);
      await expect(
        googleAuthService.unlinkGoogleAccount(mockUser.id),
      ).rejects.toThrow(
        'Cannot unlink Google account - no other authentication methods available',
      );
    });

    it('should reject unlinking when user does not have Google account linked', async () => {
      // Arrange
      const userWithoutGoogle = {
        ...mockUser,
        googleId: null,
        authMethods: ['password'],
        tenantId: mockUser.tenantId,
      };

      // Setup mocks
      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutGoogle);

      // Act & Assert
      await expect(
        googleAuthService.unlinkGoogleAccount(mockUser.id),
      ).rejects.toThrow(BadRequestException);
      await expect(
        googleAuthService.unlinkGoogleAccount(mockUser.id),
      ).rejects.toThrow('Google account is not linked');
    });
  });

  describe('Authentication Methods Retrieval', () => {
    it('should return correct auth methods for user with password only', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue({
        authMethods: ['password'],
      });

      // Act
      const result = await googleAuthService.getUserAuthMethods(mockUser.id);

      // Assert
      expect(result).toEqual(['password']);
    });

    it('should return correct auth methods for user with multiple auth methods', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue({
        authMethods: ['password', 'google'],
      });

      // Act
      const result = await googleAuthService.getUserAuthMethods(mockUser.id);

      // Assert
      expect(result).toContain('password');
      expect(result).toContain('google');
      expect(result).toHaveLength(2);
    });

    it('should handle non-existent user for auth methods retrieval', async () => {
      // Arrange
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        googleAuthService.getUserAuthMethods('non-existent-user-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        googleAuthService.getUserAuthMethods('non-existent-user-id'),
      ).rejects.toThrow('User not found');
    });
  });

  describe('Error Handling and Audit Logging', () => {
    it('should log failed authentication attempts', async () => {
      // Arrange
      const mockGoogleProfile: GoogleProfile = {
        id: 'google-fail',
        email: 'fail@example.com',
      };

      // Setup mocks to cause failure
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(
        googleAuthService.authenticateWithGoogle(
          mockGoogleProfile,
          'invalid-tenant',
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockAuthAuditService.logGoogleSignIn).toHaveBeenCalledWith(
        'unknown',
        'invalid-tenant',
        false,
        undefined,
        undefined,
        'NotFoundException',
        'Tenant not found',
        { googleEmail: mockGoogleProfile.email },
      );
    });

    it('should verify all service methods are available', () => {
      // Assert all methods exist
      expect(googleAuthService).toBeDefined();
      expect(typeof googleAuthService.validateTenantGoogleSSO).toBe('function');
      expect(typeof googleAuthService.authenticateWithGoogle).toBe('function');
      expect(typeof googleAuthService.linkGoogleAccount).toBe('function');
      expect(typeof googleAuthService.unlinkGoogleAccount).toBe('function');
      expect(typeof googleAuthService.getUserAuthMethods).toBe('function');

      expect(googleOAuthService).toBeDefined();
      expect(typeof googleOAuthService.generateAuthUrl).toBe('function');
      expect(typeof googleOAuthService.isConfigured).toBe('function');
    });
  });
});
