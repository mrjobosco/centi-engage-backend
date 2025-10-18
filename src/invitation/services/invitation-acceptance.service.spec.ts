import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InvitationAcceptanceService } from './invitation-acceptance.service';
import { PrismaService } from '../../database/prisma.service';
import { GoogleOAuthService } from '../../auth/services/google-oauth.service';
import { GoogleAuthService } from '../../auth/services/google-auth.service';
import { InvitationValidationService } from './invitation-validation.service';
import { InvitationService } from './invitation.service';
import { AuthMethod } from '../dto/invitation-acceptance.dto';

describe('InvitationAcceptanceService', () => {
  let service: InvitationAcceptanceService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let googleOAuthService: jest.Mocked<GoogleOAuthService>;
  let googleAuthService: jest.Mocked<GoogleAuthService>;
  let invitationValidationService: jest.Mocked<InvitationValidationService>;
  let invitationService: jest.Mocked<InvitationService>;

  const mockInvitation = {
    id: 'invitation-1',
    email: 'test@example.com',
    tenantId: 'tenant-1',
    token: 'invitation-token',
    roles: [
      { id: 'role-1', name: 'Member' },
      { id: 'role-2', name: 'Viewer' },
    ],
    tenant: {
      id: 'tenant-1',
      name: 'Test Tenant',
      subdomain: 'test',
    },
  };

  const mockGoogleProfile = {
    id: 'google-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    picture: 'https://example.com/photo.jpg',
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    tenantId: 'tenant-1',
    googleId: 'google-123',
    authMethods: ['google'],
    password: '',
    googleLinkedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
      userRole: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        create: jest.fn(),
      },
      role: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
    };

    const mockGoogleOAuthService = {
      exchangeCodeForTokens: jest.fn(),
      verifyIdToken: jest.fn(),
    };

    const mockGoogleAuthService = {
      authenticateWithGoogle: jest.fn(),
    };

    const mockInvitationValidationService = {
      validateToken: jest.fn(),
    };

    const mockInvitationService = {
      acceptInvitation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationAcceptanceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: GoogleOAuthService, useValue: mockGoogleOAuthService },
        { provide: GoogleAuthService, useValue: mockGoogleAuthService },
        {
          provide: InvitationValidationService,
          useValue: mockInvitationValidationService,
        },
        { provide: InvitationService, useValue: mockInvitationService },
      ],
    }).compile();

    service = module.get<InvitationAcceptanceService>(
      InvitationAcceptanceService,
    );
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    googleOAuthService = module.get(GoogleOAuthService);
    googleAuthService = module.get(GoogleAuthService);
    invitationValidationService = module.get(InvitationValidationService);
    invitationService = module.get(InvitationService);
  });

  describe('acceptInvitation', () => {
    beforeEach(() => {
      invitationValidationService.validateToken.mockResolvedValue({
        isValid: true,
        invitation: mockInvitation,
      });

      prismaService.user.findUnique.mockResolvedValue(null); // No existing user
      prismaService.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'Test Tenant',
        subdomain: 'test',
      });
      prismaService.userRole.findMany.mockResolvedValue([
        { role: { id: 'role-1', name: 'Member' } },
        { role: { id: 'role-2', name: 'Viewer' } },
      ]);
      invitationService.acceptInvitation.mockResolvedValue(undefined);
    });

    describe('Google OAuth flow', () => {
      it('should accept invitation with Google OAuth successfully', async () => {
        const acceptanceDto = {
          token: 'invitation-token',
          authMethod: AuthMethod.GOOGLE,
          googleAuthCode: 'google-auth-code',
        };

        googleOAuthService.exchangeCodeForTokens.mockResolvedValue({
          idToken: 'id-token',
          accessToken: 'access-token',
        });
        googleOAuthService.verifyIdToken.mockResolvedValue(mockGoogleProfile);
        prismaService.tenant.findUnique.mockResolvedValue({
          googleSsoEnabled: true,
          googleAutoProvision: true,
        });
        prismaService.$transaction.mockImplementation(async (callback) => {
          return callback({
            user: {
              create: jest.fn().mockResolvedValue(mockUser),
            },
            userRole: {
              createMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
          });
        });
        jwtService.sign.mockReturnValue('jwt-token');

        const result = await service.acceptInvitation(
          'invitation-token',
          acceptanceDto,
        );

        expect(result).toEqual({
          message: 'Invitation accepted successfully',
          user: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            tenantId: mockUser.tenantId,
          },
          tenant: {
            id: 'tenant-1',
            name: 'Test Tenant',
            subdomain: 'test',
          },
          roles: [
            { id: 'role-1', name: 'Member' },
            { id: 'role-2', name: 'Viewer' },
          ],
          accessToken: 'jwt-token',
        });

        expect(googleOAuthService.exchangeCodeForTokens).toHaveBeenCalledWith(
          'google-auth-code',
        );
        expect(googleOAuthService.verifyIdToken).toHaveBeenCalledWith(
          'id-token',
        );
        expect(invitationService.acceptInvitation).toHaveBeenCalledWith(
          'invitation-token',
        );
      });

      it('should throw error if Google auth code is missing', async () => {
        const acceptanceDto = {
          token: 'invitation-token',
          authMethod: AuthMethod.GOOGLE,
        };

        await expect(
          service.acceptInvitation('invitation-token', acceptanceDto),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw error if Google email does not match invitation email', async () => {
        const acceptanceDto = {
          token: 'invitation-token',
          authMethod: AuthMethod.GOOGLE,
          googleAuthCode: 'google-auth-code',
        };

        googleOAuthService.exchangeCodeForTokens.mockResolvedValue({
          idToken: 'id-token',
          accessToken: 'access-token',
        });
        googleOAuthService.verifyIdToken.mockResolvedValue({
          ...mockGoogleProfile,
          email: 'different@example.com',
        });

        await expect(
          service.acceptInvitation('invitation-token', acceptanceDto),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw error if Google SSO is not enabled for tenant', async () => {
        const acceptanceDto = {
          token: 'invitation-token',
          authMethod: AuthMethod.GOOGLE,
          googleAuthCode: 'google-auth-code',
        };

        googleOAuthService.exchangeCodeForTokens.mockResolvedValue({
          idToken: 'id-token',
          accessToken: 'access-token',
        });
        googleOAuthService.verifyIdToken.mockResolvedValue(mockGoogleProfile);
        prismaService.tenant.findUnique.mockResolvedValue({
          googleSsoEnabled: false,
          googleAutoProvision: false,
        });

        await expect(
          service.acceptInvitation('invitation-token', acceptanceDto),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('Password authentication flow', () => {
      it('should accept invitation with password authentication successfully', async () => {
        const acceptanceDto = {
          token: 'invitation-token',
          authMethod: AuthMethod.PASSWORD,
          password: 'securepassword123',
          firstName: 'John',
          lastName: 'Doe',
        };

        prismaService.$transaction.mockImplementation(async (callback) => {
          return callback({
            user: {
              create: jest.fn().mockResolvedValue({
                ...mockUser,
                authMethods: ['password'],
                googleId: null,
                googleLinkedAt: null,
              }),
            },
            userRole: {
              createMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
          });
        });
        jwtService.sign.mockReturnValue('jwt-token');

        const result = await service.acceptInvitation(
          'invitation-token',
          acceptanceDto,
        );

        expect(result).toEqual({
          message: 'Invitation accepted successfully',
          user: {
            id: mockUser.id,
            email: mockUser.email,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            tenantId: mockUser.tenantId,
          },
          tenant: {
            id: 'tenant-1',
            name: 'Test Tenant',
            subdomain: 'test',
          },
          roles: [
            { id: 'role-1', name: 'Member' },
            { id: 'role-2', name: 'Viewer' },
          ],
          accessToken: 'jwt-token',
        });

        expect(invitationService.acceptInvitation).toHaveBeenCalledWith(
          'invitation-token',
        );
      });

      it('should throw error if required fields are missing for password auth', async () => {
        const acceptanceDto = {
          token: 'invitation-token',
          authMethod: AuthMethod.PASSWORD,
          password: 'securepassword123',
          // Missing firstName and lastName
        };

        await expect(
          service.acceptInvitation('invitation-token', acceptanceDto),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw error if password is too short', async () => {
        const acceptanceDto = {
          token: 'invitation-token',
          authMethod: AuthMethod.PASSWORD,
          password: 'short',
          firstName: 'John',
          lastName: 'Doe',
        };

        await expect(
          service.acceptInvitation('invitation-token', acceptanceDto),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('General validation', () => {
      it('should throw error if invitation token is invalid', async () => {
        invitationValidationService.validateToken.mockResolvedValue({
          isValid: false,
          reason: 'Invalid token',
        });

        const acceptanceDto = {
          token: 'invalid-token',
          authMethod: AuthMethod.PASSWORD,
          password: 'securepassword123',
          firstName: 'John',
          lastName: 'Doe',
        };

        await expect(
          service.acceptInvitation('invalid-token', acceptanceDto),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw error if user already exists in tenant', async () => {
        prismaService.user.findUnique.mockResolvedValue({
          id: 'existing-user',
          email: 'test@example.com',
          tenantId: 'tenant-1',
        });

        const acceptanceDto = {
          token: 'invitation-token',
          authMethod: AuthMethod.PASSWORD,
          password: 'securepassword123',
          firstName: 'John',
          lastName: 'Doe',
        };

        await expect(
          service.acceptInvitation('invitation-token', acceptanceDto),
        ).rejects.toThrow(ConflictException);
      });

      it('should assign default Member role if no roles specified in invitation', async () => {
        const invitationWithoutRoles = {
          ...mockInvitation,
          roles: [],
        };

        invitationValidationService.validateToken.mockResolvedValue({
          isValid: true,
          invitation: invitationWithoutRoles,
        });

        const acceptanceDto = {
          token: 'invitation-token',
          authMethod: AuthMethod.PASSWORD,
          password: 'securepassword123',
          firstName: 'John',
          lastName: 'Doe',
        };

        prismaService.$transaction.mockImplementation(async (callback) => {
          const mockTx = {
            user: {
              create: jest.fn().mockResolvedValue(mockUser),
            },
            role: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'default-role',
                name: 'Member',
              }),
            },
            userRole: {
              create: jest.fn().mockResolvedValue({
                userId: mockUser.id,
                roleId: 'default-role',
              }),
            },
          };
          return callback(mockTx);
        });
        jwtService.sign.mockReturnValue('jwt-token');

        await service.acceptInvitation('invitation-token', acceptanceDto);

        expect(prismaService.$transaction).toHaveBeenCalled();
      });
    });
  });
});
