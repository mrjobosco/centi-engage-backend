import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
}

@Injectable()
export class GoogleOAuthService {
  private oauth2Client: OAuth2Client;

  constructor(private configService: ConfigService) {
    const clientId = this.configService.get<string>('config.google.clientId');
    const clientSecret = this.configService.get<string>(
      'config.google.clientSecret',
    );
    const callbackUrl = this.configService.get<string>(
      'config.google.callbackUrl',
    );

    if (!clientId || !clientSecret || !callbackUrl) {
      throw new Error(
        'Google OAuth configuration is missing. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL environment variables.',
      );
    }

    this.oauth2Client = new OAuth2Client(clientId, clientSecret, callbackUrl);
  }

  /**
   * Generate Google OAuth authorization URL
   * @param state - CSRF protection state parameter
   * @returns Authorization URL for Google OAuth flow
   */
  generateAuthUrl(state?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['email', 'profile'],
      state: state, // CSRF protection
      prompt: 'consent', // Force consent screen to ensure refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   * @param code - Authorization code from Google OAuth callback
   * @returns Object containing ID token and access token
   */
  async exchangeCodeForTokens(
    code: string,
  ): Promise<{ idToken: string; accessToken: string }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.id_token || !tokens.access_token) {
        throw new Error('Missing tokens in response');
      }

      return {
        idToken: tokens.id_token,
        accessToken: tokens.access_token,
      };
    } catch (error) {
      throw new UnauthorizedException(
        `Failed to exchange code for tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Verify Google ID token and extract user profile
   * @param idToken - Google ID token to verify
   * @returns Verified Google user profile
   */
  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    try {
      const ticket = await this.oauth2Client.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('config.google.clientId'),
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('Invalid token payload');
      }

      if (!payload.email) {
        throw new Error('Email not provided in Google profile');
      }

      return {
        id: payload.sub,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
        picture: payload.picture,
      };
    } catch (error) {
      throw new UnauthorizedException(
        `Invalid Google token: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if Google OAuth is properly configured
   * @returns True if all required configuration is present
   */
  isConfigured(): boolean {
    const clientId = this.configService.get<string>('config.google.clientId');
    const clientSecret = this.configService.get<string>(
      'config.google.clientSecret',
    );
    const callbackUrl = this.configService.get<string>(
      'config.google.callbackUrl',
    );

    return !!(clientId && clientSecret && callbackUrl);
  }
}
