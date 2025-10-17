import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleOAuthService } from './google-oauth.service';
import { OAuth2Client } from 'google-auth-library';

// Mock the google-auth-library
jest.mock('google-auth-library');

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  let mockOAuth2Client: jest.Mocked<OAuth2Client>;

  const mockConfig = {
    'config.google.clientId': 'test-client-id',
    'config.google.clientSecret': 'test-client-secret',
    'config.google.callbackUrl': 'http://localhost:3000/auth/google/callback',
  };

  beforeEach(async () => {
    // Create mock OAuth2Client
    mockOAuth2Client = {
      generateAuthUrl: jest.fn(),
      getToken: jest.fn(),
      verifyIdToken: jest.fn(),
    } as any;

    // Mock the OAuth2Client constructor
    (OAuth2Client as jest.MockedClass<typeof OAuth2Client>).mockImplementation(
      () => mockOAuth2Client,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<GoogleOAuthService>(GoogleOAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize OAuth2Client with correct configuration', () => {
      expect(OAuth2Client).toHaveBeenCalledWith(
        'test-client-id',
        'test-client-secret',
        'http://localhost:3000/auth/google/callback',
      );
    });

    it('should throw error if configuration is missing', () => {
      const incompleteConfig = {
        'config.google.clientId': 'test-client-id',
        // Missing clientSecret and callbackUrl
      };

      const mockIncompleteConfigService = {
        get: jest.fn((key: string) => incompleteConfig[key]),
      };

      expect(() => {
        new GoogleOAuthService(mockIncompleteConfigService as any);
      }).toThrow('Google OAuth configuration is missing');
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate auth URL without state', () => {
      const expectedUrl = 'https://accounts.google.com/oauth/authorize?...';
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const result = service.generateAuthUrl();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: ['email', 'profile'],
        state: undefined,
        prompt: 'consent',
      });
      expect(result).toBe(expectedUrl);
    });

    it('should generate auth URL with state', () => {
      const expectedUrl = 'https://accounts.google.com/oauth/authorize?...';
      const state = 'test-state-123';
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const result = service.generateAuthUrl(state);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: ['email', 'profile'],
        state: state,
        prompt: 'consent',
      });
      expect(result).toBe(expectedUrl);
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should successfully exchange code for tokens', async () => {
      const code = 'test-auth-code';
      const mockTokens = {
        id_token: 'test-id-token',
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      const result = await service.exchangeCodeForTokens(code);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockOAuth2Client.getToken).toHaveBeenCalledWith(code);
      expect(result).toEqual({
        idToken: 'test-id-token',
        accessToken: 'test-access-token',
      });
    });

    it('should throw UnauthorizedException if tokens are missing', async () => {
      const code = 'test-auth-code';
      const mockTokens = {
        // Missing id_token and access_token
        refresh_token: 'test-refresh-token',
      };

      mockOAuth2Client.getToken.mockResolvedValue({ tokens: mockTokens });

      await expect(service.exchangeCodeForTokens(code)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.exchangeCodeForTokens(code)).rejects.toThrow(
        'Failed to exchange code for tokens',
      );
    });

    it('should throw UnauthorizedException if getToken fails', async () => {
      const code = 'test-auth-code';
      const error = new Error('Invalid authorization code');

      mockOAuth2Client.getToken.mockRejectedValue(error);

      await expect(service.exchangeCodeForTokens(code)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.exchangeCodeForTokens(code)).rejects.toThrow(
        'Failed to exchange code for tokens',
      );
    });
  });

  describe('verifyIdToken', () => {
    const mockPayload = {
      sub: 'google-user-id-123',
      email: 'test@example.com',
      given_name: 'John',
      family_name: 'Doe',
      picture: 'https://example.com/avatar.jpg',
    };

    it('should successfully verify ID token and return profile', async () => {
      const idToken = 'test-id-token';
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(mockPayload),
      };

      mockOAuth2Client.verifyIdToken.mockResolvedValue(mockTicket as any);

      const result = await service.verifyIdToken(idToken);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockOAuth2Client.verifyIdToken).toHaveBeenCalledWith({
        idToken,
        audience: 'test-client-id',
      });

      const expectedProfile: GoogleProfile = {
        id: 'google-user-id-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        picture: 'https://example.com/avatar.jpg',
      };

      expect(result).toEqual(expectedProfile);
    });

    it('should handle profile without optional fields', async () => {
      const idToken = 'test-id-token';
      const minimalPayload = {
        sub: 'google-user-id-123',
        email: 'test@example.com',
        // No given_name, family_name, or picture
      };

      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(minimalPayload),
      };

      mockOAuth2Client.verifyIdToken.mockResolvedValue(mockTicket as any);

      const result = await service.verifyIdToken(idToken);

      const expectedProfile: GoogleProfile = {
        id: 'google-user-id-123',
        email: 'test@example.com',
        firstName: undefined,
        lastName: undefined,
        picture: undefined,
      };

      expect(result).toEqual(expectedProfile);
    });

    it('should throw UnauthorizedException if payload is null', async () => {
      const idToken = 'test-id-token';
      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(null),
      };

      mockOAuth2Client.verifyIdToken.mockResolvedValue(mockTicket as any);

      await expect(service.verifyIdToken(idToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyIdToken(idToken)).rejects.toThrow(
        'Invalid Google token',
      );
    });

    it('should throw UnauthorizedException if email is missing', async () => {
      const idToken = 'test-id-token';
      const payloadWithoutEmail = {
        sub: 'google-user-id-123',
        // Missing email
        given_name: 'John',
        family_name: 'Doe',
      };

      const mockTicket = {
        getPayload: jest.fn().mockReturnValue(payloadWithoutEmail),
      };

      mockOAuth2Client.verifyIdToken.mockResolvedValue(mockTicket as any);

      await expect(service.verifyIdToken(idToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyIdToken(idToken)).rejects.toThrow(
        'Email not provided in Google profile',
      );
    });

    it('should throw UnauthorizedException if verifyIdToken fails', async () => {
      const idToken = 'invalid-token';
      const error = new Error('Invalid token');

      mockOAuth2Client.verifyIdToken.mockRejectedValue(error);

      await expect(service.verifyIdToken(idToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.verifyIdToken(idToken)).rejects.toThrow(
        'Invalid Google token',
      );
    });
  });

  describe('isConfigured', () => {
    it('should return true when all configuration is present', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when configuration is missing', () => {
      const incompleteConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'config.google.clientId') return 'test-client-id';
          return undefined; // Missing other config
        }),
      };

      // This should throw during construction, so we test that
      expect(() => {
        new GoogleOAuthService(incompleteConfigService as any);
      }).toThrow('Google OAuth configuration is missing');
    });
  });
});
