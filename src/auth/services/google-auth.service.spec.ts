import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { PrismaService } from '../../database/prisma.service';
import { AuthAuditService } from './auth-audit.service';
import { GoogleAuthMetricsService } from './google-auth-metrics.service';
import { GoogleProfile } from '../interfaces/google-profile.interface';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let authAuditService: jest.Mocked<AuthAuditService>;
  let googleAuthMetricsService: jest.Mocked<GoogleAuthMetricsService>;

  const mockGoogleProfile: GoogleProfile = {
    id: 'google-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockTenantlessUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    tenantId: null,
    googleId: 'google-123',
    authMethods: ['google'],
    roles: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    password: '',
    googleLinkedAt: new Date(),
    email_verified: true,
    email_verified_at: new Date(),
    verificationToken: null,
    verificationTokenSentAt: null,
  };

  const mockTenantUser = {
    ...mockTenantlessUser,
    tenantId: 'tenant-1',
    roles: [
      {
        role: {
          id: 'role-1',
          name: 'Member',
        },
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockAuthAuditService = {
      logGoogleSignIn: jest.fn(),
    };

    const mockGoogleAuthMetricsService = {
      recordSignInAttempt: jest.fn(),
      startTenantLookupTimer: jest.fn(),
      recordSignInSuccess: jest.fn(),
      recordSignInFailure: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AuthAuditService, useValue: mockAuthAuditService },
        {
          provide: GoogleAuthMetricsService,
          useValue: mockGoogleAuthMetricsService,
        },
      ],
    }).compile();

    service = module.get<GoogleAuthService>(GoogleAuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    authAuditService = module.get(AuthAuditService);
    googleAuthMetricsService = module.get(GoogleAuthMetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('authenticateWithGoogle - tenant-less', () => {
    it('should authenticate existing tenant-less Google user', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockTenantlessUser);
      jwtService.sign.mockReturnValue('jwt-token');

      // Act
      const result = await service.authenticateWithGoogle(mockGoogleProfile);

      // Assert
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { googleId: mockGoogleProfile.id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        userId: mockTenantlessUser.id,
        tenantId: null,
        roles: [],
      });
      expect(result).toEqual({
        accessToken: 'jwt-token',
      });
    });

    it('should throw BadRequestException if Google user belongs to tenant', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(mockTenantUser);

      // Act & Assert
      await expect(
        service.authenticateWithGoogle(mockGoogleProfile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create new tenant-less user from Google profile', async () => {
      // Arrange
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.findFirst.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockTenantlessUser);
      jwtService.sign.mockReturnValue('jwt-token');

      // Act
      const result = await service.authenticateWithGoogle(mockGoogleProfile);

      // Assert
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: mockGoogleProfile.email,
          firstName: mockGoogleProfile.firstName,
          lastName: mockGoogleProfile.lastName,
          tenantId: null,
          googleId: mockGoogleProfile.id,
          googleLinkedAt: expect.any(Date),
          authMethods: ['google'],
          password: '',
          email_verified: true,
          email_verified_at: expect.any(Date),
        },
        include: {
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
      expect(result).toEqual({
        accessToken: 'jwt-token',
      });
    });

    it('should link Google account to existing tenant-less user', async () => {
      // Arrange
      const existingUser = {
        ...mockTenantlessUser,
        googleId: null,
        authMethods: ['password'],
      };
      prismaService.user.findUnique
        .mockResolvedValueOnce(null) // First call for Google ID lookup
        .mockResolvedValueOnce(existingUser) // Second call after linking
        .mockResolvedValueOnce(existingUser); // Third call for auth methods
      prismaService.user.findFirst.mockResolvedValue(existingUser);
      prismaService.user.update.mockResolvedValue({
        ...existingUser,
        googleId: mockGoogleProfile.id,
        authMethods: ['password', 'google'],
      });
      jwtService.sign.mockReturnValue('jwt-token');

      // Act
      const result = await service.authenticateWithGoogle(mockGoogleProfile);

      // Assert
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          googleId: mockGoogleProfile.id,
          googleLinkedAt: expect.any(Date),
          authMethods: ['password', 'google'],
          email_verified: true,
          email_verified_at: expect.any(Date),
        },
      });
      expect(result).toEqual({
        accessToken: 'jwt-token',
      });
    });
  });

  describe('createTenantlessUserFromGoogle', () => {
    it('should create tenant-less user from Google profile', async () => {
      // Arrange
      prismaService.user.create.mockResolvedValue(mockTenantlessUser);

      // Act
      const result = await (service as any).createTenantlessUserFromGoogle(
        mockGoogleProfile,
      );

      // Assert
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: mockGoogleProfile.email,
          firstName: mockGoogleProfile.firstName,
          lastName: mockGoogleProfile.lastName,
          tenantId: null,
          googleId: mockGoogleProfile.id,
          googleLinkedAt: expect.any(Date),
          authMethods: ['google'],
          password: '',
          email_verified: true,
          email_verified_at: expect.any(Date),
        },
        include: {
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });
      expect(result).toBe(mockTenantlessUser);
    });
  });

  describe('generateTokenForUser', () => {
    it('should generate JWT token for user', () => {
      // Arrange
      jwtService.sign.mockReturnValue('jwt-token');

      // Act
      const result = (service as any).generateTokenForUser(mockTenantlessUser);

      // Assert
      expect(jwtService.sign).toHaveBeenCalledWith({
        userId: mockTenantlessUser.id,
        tenantId: null,
        roles: [],
      });
      expect(result).toEqual({
        accessToken: 'jwt-token',
      });
    });

    it('should generate JWT token for user with roles', () => {
      // Arrange
      jwtService.sign.mockReturnValue('jwt-token');

      // Act
      const result = (service as any).generateTokenForUser(mockTenantUser);

      // Assert
      expect(jwtService.sign).toHaveBeenCalledWith({
        userId: mockTenantUser.id,
        tenantId: 'tenant-1',
        roles: ['role-1'],
      });
      expect(result).toEqual({
        accessToken: 'jwt-token',
      });
    });
  });
});
