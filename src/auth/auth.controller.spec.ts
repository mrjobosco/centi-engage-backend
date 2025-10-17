import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { OAuthStateService } from './services/oauth-state.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { PrismaService } from '../database/prisma.service';
import { LoginDto, GoogleCallbackDto, GoogleLinkCallbackDto } from './dto';
import type { User } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    login: jest.fn(),
  };

  const mockGoogleAuthService = {
    validateTenantGoogleSSO: jest.fn(),
    authenticateWithGoogle: jest.fn(),
    linkGoogleAccount: jest.fn(),
    unlinkGoogleAccount: jest.fn(),
    getUserAuthMethods: jest.fn(),
  };

  const mockGoogleOAuthService = {
    generateAuthUrl: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
    verifyIdToken: jest.fn(),
  };

  const mockOAuthStateService = {
    generateState: jest.fn(),
    validateState: jest.fn(),
  };

  const mockTenantContextService = {
    getRequiredTenantId: jest.fn(),
    getTenantId: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: GoogleAuthService,
          useValue: mockGoogleAuthService,
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
          provide: TenantContextService,
          useValue: mockTenantContextService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    googleAuthService = module.get<GoogleAuthService>(GoogleAuthService);
    googleOAuthService = module.get<GoogleOAuthService>(GoogleOAuthService);
    oauthStateService = module.get<OAuthStateService>(OAuthStateService);
    tenantContextService =
      module.get<TenantContextService>(TenantContextService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    const tenantId = 'tenant-123';

    const mockLoginResponse = {
      accessToken: 'mock-jwt-token',
    };

    it('should call authService.login with correct parameters', async () => {
      // Arrange
      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login(loginDto, tenantId);

      // Assert
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, tenantId);
      expect(result).toEqual(mockLoginResponse);
    });

    it('should return access token on successful login', async () => {
      // Arrange
      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      // Act
      const result = await controller.login(loginDto, tenantId);

      // Assert
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
      });
    });

    it('should throw error if tenant ID is not provided', async () => {
      // Act & Assert
      await expect(controller.login(loginDto, undefined)).rejects.toThrow(
        'Tenant ID is required',
      );

      expect(mockAuthService.login).not.toHaveBeenCalled();
    });

    it('should propagate errors from authService', async () => {
      // Arrange
      const error = new Error('Authentication failed');
      mockAuthService.login.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.login(loginDto, tenantId)).rejects.toThrow(
        'Authentication failed',
      );
    });
  });

  describe('googleAuth', () => {
    const tenantId = 'tenant-123';
    const mockState = 'mock-state-123';
    const mockAuthUrl = 'https://accounts.google.com/oauth/authorize?...';

    it('should initiate Google OAuth flow successfully', async () => {
      // Arrange
      mockGoogleAuthService.validateTenantGoogleSSO.mockResolvedValue({
        id: tenantId,
        googleSsoEnabled: true,
      });
      mockOAuthStateService.generateState.mockResolvedValue(mockState);
      mockGoogleOAuthService.generateAuthUrl.mockReturnValue(mockAuthUrl);

      // Act
      const result = await controller.googleAuth(tenantId);

      // Assert
      expect(
        mockGoogleAuthService.validateTenantGoogleSSO,
      ).toHaveBeenCalledWith(tenantId);
      expect(mockOAuthStateService.generateState).toHaveBeenCalled();
      expect(mockGoogleOAuthService.generateAuthUrl).toHaveBeenCalledWith(
        mockState,
      );
      expect(result).toEqual({
        authUrl: mockAuthUrl,
        state: mockState,
      });
    });

    it('should throw BadRequestException when tenant ID is missing', async () => {
      // Act & Assert
      await expect(controller.googleAuth(undefined)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.googleAuth(undefined)).rejects.toThrow(
        'Tenant ID is required',
      );

      expect(
        mockGoogleAuthService.validateTenantGoogleSSO,
      ).not.toHaveBeenCalled();
    });

    it('should propagate errors from validateTenantGoogleSSO', async () => {
      // Arrange
      const error = new Error('Tenant validation failed');
      mockGoogleAuthService.validateTenantGoogleSSO.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.googleAuth(tenantId)).rejects.toThrow(
        'Tenant validation failed',
      );
    });
  });

  describe('googleAuthCallback', () => {
    const callbackDto: GoogleCallbackDto = {
      code: 'auth-code-123',
      state: 'state-123',
      tenantId: 'tenant-123',
    };

    const mockTokens = {
      idToken: 'mock-id-token',
    };

    const mockGoogleProfile = {
      id: 'google-123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };

    const mockAuthResult = {
      accessToken: 'mock-jwt-token',
    };

    it('should complete Google OAuth flow successfully', async () => {
      // Arrange
      mockOAuthStateService.validateState.mockResolvedValue(true);
      mockGoogleOAuthService.exchangeCodeForTokens.mockResolvedValue(
        mockTokens,
      );
      mockGoogleOAuthService.verifyIdToken.mockResolvedValue(mockGoogleProfile);
      mockGoogleAuthService.authenticateWithGoogle.mockResolvedValue(
        mockAuthResult,
      );

      // Act
      const result = await controller.googleAuthCallback(callbackDto);

      // Assert
      expect(mockOAuthStateService.validateState).toHaveBeenCalledWith(
        callbackDto.state,
      );
      expect(mockGoogleOAuthService.exchangeCodeForTokens).toHaveBeenCalledWith(
        callbackDto.code,
      );
      expect(mockGoogleOAuthService.verifyIdToken).toHaveBeenCalledWith(
        mockTokens.idToken,
      );
      expect(mockGoogleAuthService.authenticateWithGoogle).toHaveBeenCalledWith(
        mockGoogleProfile,
        callbackDto.tenantId,
      );
      expect(result).toEqual(mockAuthResult);
    });

    it('should throw BadRequestException for invalid state', async () => {
      // Arrange
      mockOAuthStateService.validateState.mockResolvedValue(false);

      // Act & Assert
      await expect(controller.googleAuthCallback(callbackDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.googleAuthCallback(callbackDto)).rejects.toThrow(
        'Invalid or expired state parameter',
      );

      expect(
        mockGoogleOAuthService.exchangeCodeForTokens,
      ).not.toHaveBeenCalled();
    });

    it('should propagate errors from token exchange', async () => {
      // Arrange
      mockOAuthStateService.validateState.mockResolvedValue(true);
      const error = new Error('Token exchange failed');
      mockGoogleOAuthService.exchangeCodeForTokens.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.googleAuthCallback(callbackDto)).rejects.toThrow(
        'Token exchange failed',
      );
    });

    it('should propagate errors from authentication', async () => {
      // Arrange
      mockOAuthStateService.validateState.mockResolvedValue(true);
      mockGoogleOAuthService.exchangeCodeForTokens.mockResolvedValue(
        mockTokens,
      );
      mockGoogleOAuthService.verifyIdToken.mockResolvedValue(mockGoogleProfile);
      const error = new Error('Authentication failed');
      mockGoogleAuthService.authenticateWithGoogle.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.googleAuthCallback(callbackDto)).rejects.toThrow(
        'Authentication failed',
      );
    });
  });

  describe('googleLink', () => {
    const mockUser: User = {
      id: 'user-123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      tenantId: 'tenant-123',
    } as User;

    const mockState = 'link-state-123';
    const mockAuthUrl = 'https://accounts.google.com/oauth/authorize?...';

    it('should initiate Google account linking successfully', async () => {
      // Arrange
      mockOAuthStateService.generateState.mockResolvedValue(mockState);
      mockGoogleOAuthService.generateAuthUrl.mockReturnValue(mockAuthUrl);

      // Act
      const result = await controller.googleLink(mockUser);

      // Assert
      expect(mockOAuthStateService.generateState).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(mockGoogleOAuthService.generateAuthUrl).toHaveBeenCalledWith(
        mockState,
      );
      expect(result).toEqual({
        authUrl: mockAuthUrl,
        state: mockState,
      });
    });

    it('should propagate errors from state generation', async () => {
      // Arrange
      const error = new Error('State generation failed');
      mockOAuthStateService.generateState.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.googleLink(mockUser)).rejects.toThrow(
        'State generation failed',
      );
    });
  });

  describe('googleLinkCallback', () => {
    const mockUser: User = {
      id: 'user-123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      tenantId: 'tenant-123',
    } as User;

    const linkCallbackDto: GoogleLinkCallbackDto = {
      code: 'link-code-123',
      state: 'link-state-123',
    };

    const mockTokens = {
      idToken: 'mock-id-token',
    };

    const mockGoogleProfile = {
      id: 'google-123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
    };

    it('should complete Google account linking successfully', async () => {
      // Arrange
      mockOAuthStateService.validateState.mockResolvedValue(true);
      mockGoogleOAuthService.exchangeCodeForTokens.mockResolvedValue(
        mockTokens,
      );
      mockGoogleOAuthService.verifyIdToken.mockResolvedValue(mockGoogleProfile);
      mockGoogleAuthService.linkGoogleAccount.mockResolvedValue(undefined);

      // Act
      const result = await controller.googleLinkCallback(
        mockUser,
        linkCallbackDto,
      );

      // Assert
      expect(mockOAuthStateService.validateState).toHaveBeenCalledWith(
        linkCallbackDto.state,
        mockUser.id,
      );
      expect(mockGoogleOAuthService.exchangeCodeForTokens).toHaveBeenCalledWith(
        linkCallbackDto.code,
      );
      expect(mockGoogleOAuthService.verifyIdToken).toHaveBeenCalledWith(
        mockTokens.idToken,
      );
      expect(mockGoogleAuthService.linkGoogleAccount).toHaveBeenCalledWith(
        mockUser.id,
        mockGoogleProfile,
      );
      expect(result).toEqual({
        message: 'Google account linked successfully',
      });
    });

    it('should throw BadRequestException for invalid state', async () => {
      // Arrange
      mockOAuthStateService.validateState.mockResolvedValue(false);

      // Act & Assert
      await expect(
        controller.googleLinkCallback(mockUser, linkCallbackDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.googleLinkCallback(mockUser, linkCallbackDto),
      ).rejects.toThrow('Invalid or expired state parameter');

      expect(
        mockGoogleOAuthService.exchangeCodeForTokens,
      ).not.toHaveBeenCalled();
    });

    it('should propagate errors from account linking', async () => {
      // Arrange
      mockOAuthStateService.validateState.mockResolvedValue(true);
      mockGoogleOAuthService.exchangeCodeForTokens.mockResolvedValue(
        mockTokens,
      );
      mockGoogleOAuthService.verifyIdToken.mockResolvedValue(mockGoogleProfile);
      const error = new Error('Account linking failed');
      mockGoogleAuthService.linkGoogleAccount.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.googleLinkCallback(mockUser, linkCallbackDto),
      ).rejects.toThrow('Account linking failed');
    });
  });

  describe('googleUnlink', () => {
    const mockUser: User = {
      id: 'user-123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      tenantId: 'tenant-123',
    } as User;

    it('should unlink Google account successfully', async () => {
      // Arrange
      mockGoogleAuthService.unlinkGoogleAccount.mockResolvedValue(undefined);

      // Act
      const result = await controller.googleUnlink(mockUser);

      // Assert
      expect(mockGoogleAuthService.unlinkGoogleAccount).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(result).toEqual({
        message: 'Google account unlinked successfully',
      });
    });

    it('should propagate errors from account unlinking', async () => {
      // Arrange
      const error = new Error('Cannot unlink only authentication method');
      mockGoogleAuthService.unlinkGoogleAccount.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.googleUnlink(mockUser)).rejects.toThrow(
        'Cannot unlink only authentication method',
      );
    });
  });

  describe('getAuthMethods', () => {
    const mockUser: User = {
      id: 'user-123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      tenantId: 'tenant-123',
    } as User;

    const mockAuthMethods = ['password', 'google'];

    it('should return user authentication methods successfully', async () => {
      // Arrange
      mockGoogleAuthService.getUserAuthMethods.mockResolvedValue(
        mockAuthMethods,
      );

      // Act
      const result = await controller.getAuthMethods(mockUser);

      // Assert
      expect(mockGoogleAuthService.getUserAuthMethods).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(result).toEqual({
        authMethods: mockAuthMethods,
      });
    });

    it('should propagate errors from getUserAuthMethods', async () => {
      // Arrange
      const error = new Error('User not found');
      mockGoogleAuthService.getUserAuthMethods.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.getAuthMethods(mockUser)).rejects.toThrow(
        'User not found',
      );
    });
  });
});
