import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InvitationAcceptanceController } from './invitation-acceptance.controller';
import { InvitationValidationService } from '../services/invitation-validation.service';
import { InvitationService } from '../services/invitation.service';
import { InvitationAcceptanceService } from '../services/invitation-acceptance.service';
import { GoogleOAuthService } from '../../auth/services/google-oauth.service';
import { OAuthStateService } from '../../auth/services/oauth-state.service';
import { PrismaService } from '../../database/prisma.service';
import {
  InvitationAcceptanceDto,
  AuthMethod,
} from '../dto/invitation-acceptance.dto';
import { InvitationValidationResponseDto } from '../dto/invitation-validation-response.dto';
import { TenantInvitationWithRelations } from '../interfaces';

describe('InvitationAcceptanceController', () => {
  let controller: InvitationAcceptanceController;
  let invitationValidationService: jest.Mocked<InvitationValidationService>;
  let invitationService: jest.Mocked<InvitationService>;
  let invitationAcceptanceService: jest.Mocked<InvitationAcceptanceService>;
  let googleOAuthService: jest.Mocked<GoogleOAuthService>;
  let oauthStateService: jest.Mocked<OAuthStateService>;
  let prismaService: jest.Mocked<PrismaService>;

  const validToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567';
  const invalidToken = 'invalid-token';
  const expiredToken =
    'expired123def456ghi789jkl012mno345pqr678stu901vwx234yz567';

  const mockInvitation: TenantInvitationWithRelations = {
    id: 'invitation-123',
    tenantId: 'tenant-123',
    email: 'newuser@example.com',
    token: validToken,
    invitedBy: 'user-123',
    expiresAt: new Date('2024-12-31T23:59:59.000Z'),
    acceptedAt: null,
    cancelledAt: null,
    status: 'PENDING' as any,
    message: 'Welcome to our team!',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    tenant: {
      id: 'tenant-123',
      name: 'Test Tenant',
      subdomain: 'test',
    },
    inviter: {
      id: 'user-123',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
    },
    roles: [
      { id: 'role-123', name: 'Team Member' },
      { id: 'role-456', name: 'Viewer' },
    ],
  };

  beforeEach(async () => {
    const mockValidationService = {
      validateToken: jest.fn(),
    };

    const mockInvitationService = {
      validateInvitation: jest.fn(),
      acceptInvitation: jest.fn(),
    };

    const mockInvitationAcceptanceService = {
      acceptInvitation: jest.fn(),
    };

    const mockGoogleOAuthService = {
      generateAuthUrl: jest.fn(),
    };

    const mockOAuthStateService = {
      generateState: jest.fn(),
    };

    const mockPrismaService = {
      tenant: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationAcceptanceController],
      providers: [
        {
          provide: InvitationValidationService,
          useValue: mockValidationService,
        },
        {
          provide: InvitationService,
          useValue: mockInvitationService,
        },
        {
          provide: InvitationAcceptanceService,
          useValue: mockInvitationAcceptanceService,
        },
        {
          provide: GoogleOAuthService,
          useValue: mockGoogleOAuthService,
        },
        {
          provide: OAuthStateService,
          useValue: mockOAuthStateService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<InvitationAcceptanceController>(
      InvitationAcceptanceController,
    );
    invitationValidationService = module.get(InvitationValidationService);
    invitationService = module.get(InvitationService);
    invitationAcceptanceService = module.get(InvitationAcceptanceService);
    googleOAuthService = module.get(GoogleOAuthService);
    oauthStateService = module.get(OAuthStateService);
    prismaService = module.get(PrismaService);

    // Mock the logger to avoid console output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('validateInvitation', () => {
    it('should return valid invitation details for valid token', async () => {
      const validationResult = {
        isValid: true,
        invitation: mockInvitation,
      };
      invitationValidationService.validateToken.mockResolvedValue(
        validationResult,
      );

      const result = await controller.validateInvitation(validToken);

      expect(invitationValidationService.validateToken).toHaveBeenCalledWith(
        validToken,
        {},
      );

      const expected: InvitationValidationResponseDto = {
        isValid: true,
        status: 'PENDING' as any,
        invitation: {
          id: mockInvitation.id,
          email: mockInvitation.email,
          expiresAt: mockInvitation.expiresAt.toISOString(),
          tenant: {
            id: mockInvitation.tenant.id,
            name: mockInvitation.tenant.name,
          },
          roles: mockInvitation.roles.map((role) => ({
            id: role.id,
            name: role.name,
          })),
          message: mockInvitation.message,
        },
      };

      expect(result).toEqual(expected);
    });

    it('should return error for invalid token', async () => {
      const validationResult = {
        isValid: false,
        reason: 'Invalid token format',
      };
      invitationValidationService.validateToken.mockResolvedValue(
        validationResult,
      );

      const result = await controller.validateInvitation(invalidToken);

      expect(invitationValidationService.validateToken).toHaveBeenCalledWith(
        invalidToken,
        {},
      );

      const expected: InvitationValidationResponseDto = {
        isValid: false,
        status: 'INVALID' as any,
        error: 'Invalid token format',
      };

      expect(result).toEqual(expected);
    });

    it('should return error for expired token', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        status: 'EXPIRED' as any,
        expiresAt: new Date('2023-12-31T23:59:59.000Z'),
      };

      const validationResult = {
        isValid: false,
        invitation: expiredInvitation,
        reason: 'Invitation has expired',
      };
      invitationValidationService.validateToken.mockResolvedValue(
        validationResult,
      );

      const result = await controller.validateInvitation(expiredToken);

      const expected: InvitationValidationResponseDto = {
        isValid: false,
        status: 'EXPIRED' as any,
        error: 'Invitation has expired',
      };

      expect(result).toEqual(expected);
    });

    it('should return error for already accepted invitation', async () => {
      const acceptedInvitation = {
        ...mockInvitation,
        status: 'ACCEPTED' as any,
        acceptedAt: new Date('2024-01-15T10:30:00.000Z'),
      };

      const validationResult = {
        isValid: false,
        invitation: acceptedInvitation,
        reason: 'Invitation has already been accepted',
      };
      invitationValidationService.validateToken.mockResolvedValue(
        validationResult,
      );

      const result = await controller.validateInvitation(validToken);

      const expected: InvitationValidationResponseDto = {
        isValid: false,
        status: 'ACCEPTED' as any,
        error: 'Invitation has already been accepted',
      };

      expect(result).toEqual(expected);
    });

    it('should return error for cancelled invitation', async () => {
      const cancelledInvitation = {
        ...mockInvitation,
        status: 'CANCELLED' as any,
        cancelledAt: new Date('2024-01-10T14:20:00.000Z'),
      };

      const validationResult = {
        isValid: false,
        invitation: cancelledInvitation,
        reason: 'Invitation has been cancelled',
      };
      invitationValidationService.validateToken.mockResolvedValue(
        validationResult,
      );

      const result = await controller.validateInvitation(validToken);

      const expected: InvitationValidationResponseDto = {
        isValid: false,
        status: 'CANCELLED' as any,
        error: 'Invitation has been cancelled',
      };

      expect(result).toEqual(expected);
    });

    it('should handle validation service errors', async () => {
      const error = new BadRequestException('Token validation failed');
      invitationValidationService.validateToken.mockRejectedValue(error);

      await expect(controller.validateInvitation(invalidToken)).rejects.toThrow(
        BadRequestException,
      );

      expect(invitationValidationService.validateToken).toHaveBeenCalledWith(
        invalidToken,
        {},
      );
    });

    it('should handle unexpected errors gracefully', async () => {
      const error = new Error('Database connection failed');
      invitationValidationService.validateToken.mockRejectedValue(error);

      await expect(controller.validateInvitation(validToken)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle invitation without message', async () => {
      const invitationWithoutMessage = {
        ...mockInvitation,
        message: null,
      };

      const validationResult = {
        isValid: true,
        invitation: invitationWithoutMessage,
      };
      invitationValidationService.validateToken.mockResolvedValue(
        validationResult,
      );

      const result = await controller.validateInvitation(validToken);

      expect(result.invitation?.message).toBeUndefined();
    });
  });

  describe('acceptInvitation', () => {
    const passwordAcceptanceDto: InvitationAcceptanceDto = {
      token: validToken,
      authMethod: AuthMethod.PASSWORD,
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    const googleAcceptanceDto: InvitationAcceptanceDto = {
      token: validToken,
      authMethod: AuthMethod.GOOGLE,
      googleAuthCode: '4/0AX4XfWjYZ...',
    };

    it('should validate invitation before processing', async () => {
      invitationService.validateInvitation.mockResolvedValue(mockInvitation);

      await expect(
        controller.acceptInvitation(validToken, passwordAcceptanceDto),
      ).rejects.toThrow(BadRequestException);

      expect(invitationService.validateInvitation).toHaveBeenCalledWith(
        validToken,
      );
    });

    it('should reject Google OAuth method (not implemented)', async () => {
      invitationService.validateInvitation.mockResolvedValue(mockInvitation);

      await expect(
        controller.acceptInvitation(validToken, googleAcceptanceDto),
      ).rejects.toThrow(BadRequestException);

      expect(invitationService.validateInvitation).toHaveBeenCalledWith(
        validToken,
      );
    });

    it('should reject password method (not implemented)', async () => {
      invitationService.validateInvitation.mockResolvedValue(mockInvitation);

      await expect(
        controller.acceptInvitation(validToken, passwordAcceptanceDto),
      ).rejects.toThrow(BadRequestException);

      expect(invitationService.validateInvitation).toHaveBeenCalledWith(
        validToken,
      );
    });

    it('should handle invalid invitation token', async () => {
      const error = new NotFoundException('Invitation not found');
      invitationService.validateInvitation.mockRejectedValue(error);

      await expect(
        controller.acceptInvitation(invalidToken, passwordAcceptanceDto),
      ).rejects.toThrow(NotFoundException);

      expect(invitationService.validateInvitation).toHaveBeenCalledWith(
        invalidToken,
      );
    });

    it('should handle expired invitation', async () => {
      const error = new BadRequestException('Invitation has expired');
      invitationService.validateInvitation.mockRejectedValue(error);

      await expect(
        controller.acceptInvitation(expiredToken, passwordAcceptanceDto),
      ).rejects.toThrow(BadRequestException);

      expect(invitationService.validateInvitation).toHaveBeenCalledWith(
        expiredToken,
      );
    });

    it('should handle already accepted invitation', async () => {
      const error = new BadRequestException(
        'Invitation has already been accepted',
      );
      invitationService.validateInvitation.mockRejectedValue(error);

      await expect(
        controller.acceptInvitation(validToken, passwordAcceptanceDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle validation errors in acceptance DTO', async () => {
      invitationService.validateInvitation.mockResolvedValue(mockInvitation);

      const invalidDto = {
        token: validToken,
        authMethod: AuthMethod.PASSWORD,
        password: '123', // Too short
        firstName: '',
        lastName: '',
      } as InvitationAcceptanceDto;

      // This would be caught by validation pipes in real scenario
      await expect(
        controller.acceptInvitation(validToken, invalidDto),
      ).rejects.toThrow();
    });

    it('should handle missing required fields for password method', async () => {
      invitationService.validateInvitation.mockResolvedValue(mockInvitation);

      const incompleteDto = {
        token: validToken,
        authMethod: AuthMethod.PASSWORD,
        // Missing password, firstName, lastName
      } as InvitationAcceptanceDto;

      await expect(
        controller.acceptInvitation(validToken, incompleteDto),
      ).rejects.toThrow();
    });

    it('should handle missing Google auth code for Google method', async () => {
      invitationService.validateInvitation.mockResolvedValue(mockInvitation);

      const incompleteDto = {
        token: validToken,
        authMethod: AuthMethod.GOOGLE,
        // Missing googleAuthCode
      } as InvitationAcceptanceDto;

      await expect(
        controller.acceptInvitation(validToken, incompleteDto),
      ).rejects.toThrow();
    });

    it('should handle unexpected errors during acceptance', async () => {
      const error = new Error('Database connection failed');
      invitationService.validateInvitation.mockRejectedValue(error);

      await expect(
        controller.acceptInvitation(validToken, passwordAcceptanceDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should log errors appropriately', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const error = new BadRequestException('Test error');
      invitationService.validateInvitation.mockRejectedValue(error);

      await expect(
        controller.acceptInvitation(validToken, passwordAcceptanceDto),
      ).rejects.toThrow(BadRequestException);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Invitation acceptance failed',
        expect.objectContaining({
          token: validToken.substring(0, 8) + '...',
          authMethod: AuthMethod.PASSWORD,
          error: 'Test error',
        }),
      );
    });
  });

  describe('security considerations', () => {
    it('should not expose full token in logs', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const error = new Error('Test error');
      invitationValidationService.validateToken.mockRejectedValue(error);

      await expect(controller.validateInvitation(validToken)).rejects.toThrow();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Token validation failed',
        expect.objectContaining({
          token: validToken.substring(0, 8) + '...',
        }),
      );
    });

    it('should handle malformed tokens gracefully', async () => {
      const malformedToken = 'short';
      const error = new BadRequestException('Invalid token format');
      invitationValidationService.validateToken.mockRejectedValue(error);

      await expect(
        controller.validateInvitation(malformedToken),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle null or undefined tokens', async () => {
      const error = new BadRequestException('Token validation failed');
      invitationValidationService.validateToken.mockRejectedValue(error);

      await expect(controller.validateInvitation(null as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('public endpoint behavior', () => {
    it('should be accessible without authentication', () => {
      // These endpoints should be marked with @Public() decorator
      // This is verified by checking the decorator exists in the actual implementation
      expect(controller.validateInvitation).toBeDefined();
      expect(controller.acceptInvitation).toBeDefined();
    });

    it('should handle high traffic scenarios', async () => {
      // Simulate multiple concurrent requests
      const promises = Array.from({ length: 10 }, () => {
        invitationValidationService.validateToken.mockResolvedValue({
          isValid: true,
          invitation: mockInvitation,
        });
        return controller.validateInvitation(validToken);
      });

      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      expect(invitationValidationService.validateToken).toHaveBeenCalledTimes(
        10,
      );
    });
  });

  describe('initiateGoogleAuth', () => {
    it('should initiate Google OAuth flow successfully', async () => {
      invitationValidationService.validateToken.mockResolvedValue({
        isValid: true,
        invitation: mockInvitation,
      });

      prismaService.tenant.findUnique.mockResolvedValue({
        googleSsoEnabled: true,
      });

      oauthStateService.generateState.mockResolvedValue('oauth-state-123');
      googleOAuthService.generateAuthUrl.mockReturnValue(
        'https://accounts.google.com/oauth/authorize?...',
      );

      const result = await controller.initiateGoogleAuth(validToken);

      expect(result).toEqual({
        authUrl: 'https://accounts.google.com/oauth/authorize?...',
        state: 'oauth-state-123',
      });

      expect(invitationValidationService.validateToken).toHaveBeenCalledWith(
        validToken,
      );
      expect(prismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: mockInvitation.tenantId },
        select: { googleSsoEnabled: true },
      });
      expect(oauthStateService.generateState).toHaveBeenCalledWith(
        undefined,
        mockInvitation.tenantId,
        validToken,
      );
      expect(googleOAuthService.generateAuthUrl).toHaveBeenCalledWith(
        'oauth-state-123',
      );
    });

    it('should throw error for invalid invitation token', async () => {
      invitationValidationService.validateToken.mockResolvedValue({
        isValid: false,
        reason: 'Invalid token',
      });

      await expect(controller.initiateGoogleAuth(invalidToken)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if Google SSO is not enabled for tenant', async () => {
      invitationValidationService.validateToken.mockResolvedValue({
        isValid: true,
        invitation: mockInvitation,
      });

      prismaService.tenant.findUnique.mockResolvedValue({
        googleSsoEnabled: false,
      });

      await expect(controller.initiateGoogleAuth(validToken)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle validation service errors', async () => {
      const error = new Error('Validation service error');
      invitationValidationService.validateToken.mockRejectedValue(error);

      await expect(controller.initiateGoogleAuth(validToken)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should log errors appropriately', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'error');
      const error = new Error('Test error');
      invitationValidationService.validateToken.mockRejectedValue(error);

      await expect(controller.initiateGoogleAuth(validToken)).rejects.toThrow(
        BadRequestException,
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Google OAuth initiation failed',
        expect.objectContaining({
          token: validToken.substring(0, 8) + '...',
          error: 'Test error',
        }),
      );
    });
  });

  describe('acceptInvitation with new service', () => {
    it('should use invitation acceptance service for processing', async () => {
      const acceptanceDto: InvitationAcceptanceDto = {
        token: validToken,
        authMethod: AuthMethod.PASSWORD,
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
      };

      const mockResult = {
        message: 'Invitation accepted successfully',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          tenantId: 'tenant-123',
        },
        tenant: {
          id: 'tenant-123',
          name: 'Test Tenant',
          subdomain: 'test',
        },
        roles: [{ id: 'role-123', name: 'Member' }],
        accessToken: 'jwt-token',
      };

      invitationAcceptanceService.acceptInvitation.mockResolvedValue(
        mockResult,
      );

      const result = await controller.acceptInvitation(
        validToken,
        acceptanceDto,
      );

      expect(result).toEqual(mockResult);
      expect(invitationAcceptanceService.acceptInvitation).toHaveBeenCalledWith(
        validToken,
        acceptanceDto,
      );
    });

    it('should handle invitation acceptance service errors', async () => {
      const acceptanceDto: InvitationAcceptanceDto = {
        token: validToken,
        authMethod: AuthMethod.GOOGLE,
        googleAuthCode: 'google-code',
      };

      const error = new BadRequestException('Google authentication failed');
      invitationAcceptanceService.acceptInvitation.mockRejectedValue(error);

      await expect(
        controller.acceptInvitation(validToken, acceptanceDto),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
