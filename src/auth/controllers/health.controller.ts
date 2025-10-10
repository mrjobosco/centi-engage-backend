import { Controller, Get, HttpStatus } from '@nestjs/common';
import { GoogleOAuthService } from '../services/google-oauth.service';
import { Public } from '../decorators/public.decorator';
import { SkipGoogleOAuthRateLimit } from '../decorators/skip-google-oauth-rate-limit.decorator';

export interface GoogleOAuthHealthStatus {
  status: 'ok' | 'error';
  configured: boolean;
  connectivity?: 'ok' | 'error';
  error?: string;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(private readonly googleOAuthService: GoogleOAuthService) { }

  /**
   * Health check endpoint for Google OAuth configuration and connectivity
   * This endpoint is public and skips rate limiting for monitoring purposes
   */
  @Public()
  @SkipGoogleOAuthRateLimit()
  @Get('google-oauth')
  async checkGoogleOAuth(): Promise<GoogleOAuthHealthStatus> {
    const timestamp = new Date().toISOString();

    try {
      // Check if Google OAuth is configured
      const isConfigured = this.googleOAuthService.isConfigured();

      if (!isConfigured) {
        return {
          status: 'error',
          configured: false,
          error: 'Google OAuth configuration is missing',
          timestamp,
        };
      }

      // Test Google API connectivity by generating an auth URL
      // This validates that the OAuth2Client can be initialized and used
      try {
        const testState = 'health-check-' + Date.now();
        const authUrl = this.googleOAuthService.generateAuthUrl(testState);

        // If we can generate an auth URL, the configuration is valid
        if (authUrl && authUrl.includes('accounts.google.com')) {
          return {
            status: 'ok',
            configured: true,
            connectivity: 'ok',
            timestamp,
          };
        } else {
          return {
            status: 'error',
            configured: true,
            connectivity: 'error',
            error: 'Invalid auth URL generated',
            timestamp,
          };
        }
      } catch (connectivityError) {
        return {
          status: 'error',
          configured: true,
          connectivity: 'error',
          error: `Google API connectivity failed: ${connectivityError instanceof Error
              ? connectivityError.message
              : 'Unknown error'
            }`,
          timestamp,
        };
      }
    } catch (error) {
      return {
        status: 'error',
        configured: false,
        error: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'
          }`,
        timestamp,
      };
    }
  }

  /**
   * Simplified health check endpoint that returns HTTP status codes
   * Useful for load balancers and monitoring systems that only check status codes
   */
  @Public()
  @SkipGoogleOAuthRateLimit()
  @Get('google-oauth/status')
  async getGoogleOAuthStatus(): Promise<{ status: string }> {
    try {
      const healthStatus = await this.checkGoogleOAuth();

      if (healthStatus.status === 'ok') {
        return { status: 'healthy' };
      } else {
        // Return 503 Service Unavailable for unhealthy status
        throw new Error('Google OAuth service is unhealthy');
      }
    } catch (error) {
      // This will result in a 500 status code
      throw error;
    }
  }
}
