import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { GoogleOAuthService } from '../services/google-oauth.service';

describe('HealthController', () => {
  let controller: HealthController;
  let googleOAuthService: jest.Mocked<GoogleOAuthService>;

  beforeEach(async () => {
    const mockGoogleOAuthService = {
      isConfigured: jest.fn(),
      generateAuthUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: GoogleOAuthService,
          useValue: mockGoogleOAuthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    googleOAuthService = module.get(GoogleOAuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkGoogleOAuth', () => {
    it('should return error status when Google OAuth is not configured', () => {
      googleOAuthService.isConfigured.mockReturnValue(false);

      const result = controller.checkGoogleOAuth();

      expect(result.status).toBe('error');
      expect(result.configured).toBe(false);
      expect(result.error).toBe('Google OAuth configuration is missing');
      expect(result.timestamp).toBeDefined();
    });

    it('should return ok status when Google OAuth is configured and connectivity works', () => {
      googleOAuthService.isConfigured.mockReturnValue(true);
      googleOAuthService.generateAuthUrl.mockReturnValue(
        'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=test&scope=email%20profile&response_type=code&state=health-check-123',
      );

      const result = controller.checkGoogleOAuth();

      expect(result.status).toBe('ok');
      expect(result.configured).toBe(true);
      expect(result.connectivity).toBe('ok');
      expect(result.error).toBeUndefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return error status when auth URL generation fails', () => {
      googleOAuthService.isConfigured.mockReturnValue(true);
      googleOAuthService.generateAuthUrl.mockImplementation(() => {
        throw new Error('OAuth client initialization failed');
      });

      const result = controller.checkGoogleOAuth();

      expect(result.status).toBe('error');
      expect(result.configured).toBe(true);
      expect(result.connectivity).toBe('error');
      expect(result.error).toContain('Google API connectivity failed');
      expect(result.timestamp).toBeDefined();
    });

    it('should return error status when auth URL is invalid', () => {
      googleOAuthService.isConfigured.mockReturnValue(true);
      googleOAuthService.generateAuthUrl.mockReturnValue('invalid-url');

      const result = controller.checkGoogleOAuth();

      expect(result.status).toBe('error');
      expect(result.configured).toBe(true);
      expect(result.connectivity).toBe('error');
      expect(result.error).toBe('Invalid auth URL generated');
      expect(result.timestamp).toBeDefined();
    });

    it('should handle unexpected errors gracefully', () => {
      googleOAuthService.isConfigured.mockImplementation(() => {
        throw new Error('Unexpected configuration error');
      });

      const result = controller.checkGoogleOAuth();

      expect(result.status).toBe('error');
      expect(result.configured).toBe(false);
      expect(result.error).toContain('Health check failed');
      expect(result.timestamp).toBeDefined();
    });

    it('should include timestamp in all responses', () => {
      const beforeTime = new Date().toISOString();

      googleOAuthService.isConfigured.mockReturnValue(true);
      googleOAuthService.generateAuthUrl.mockReturnValue(
        'https://accounts.google.com/oauth/authorize?test=true',
      );

      const result = controller.checkGoogleOAuth();
      const afterTime = new Date().toISOString();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp >= beforeTime).toBe(true);
      expect(result.timestamp <= afterTime).toBe(true);
    });
  });

  describe('getGoogleOAuthStatus', () => {
    it('should return healthy status when Google OAuth is working', async () => {
      googleOAuthService.isConfigured.mockReturnValue(true);
      googleOAuthService.generateAuthUrl.mockReturnValue(
        'https://accounts.google.com/oauth/authorize?test=true',
      );

      const result = controller.getGoogleOAuthStatus();

      expect(result.status).toBe('healthy');
    });

    it('should throw error when Google OAuth is not working', async () => {
      googleOAuthService.isConfigured.mockReturnValue(false);

      await expect(controller.getGoogleOAuthStatus()).rejects.toThrow(
        'Google OAuth service is unhealthy',
      );
    });

    it('should throw error when connectivity check fails', async () => {
      googleOAuthService.isConfigured.mockReturnValue(true);
      googleOAuthService.generateAuthUrl.mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await expect(controller.getGoogleOAuthStatus()).rejects.toThrow(
        'Google OAuth service is unhealthy',
      );
    });
  });
});
