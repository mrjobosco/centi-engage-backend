import { HttpStatus } from '@nestjs/common';
import {
  GoogleOAuthError,
  GoogleOAuthErrorCode,
  GoogleOAuthErrorFactory,
} from './google-oauth.error';

describe('GoogleOAuthError', () => {
  describe('constructor', () => {
    it('should create error with default status', () => {
      const error = new GoogleOAuthError(
        'Test message',
        GoogleOAuthErrorCode.OAUTH_FAILED,
      );

      expect(error).toBeInstanceOf(GoogleOAuthError);
      expect(error.message).toBe('Test message');
      expect(error.code).toBe(GoogleOAuthErrorCode.OAUTH_FAILED);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.timestamp).toBeDefined();
    });

    it('should create error with custom status', () => {
      const error = new GoogleOAuthError(
        'Unauthorized',
        GoogleOAuthErrorCode.INVALID_TOKEN,
        HttpStatus.UNAUTHORIZED,
      );

      expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should create error with metadata', () => {
      const metadata = { tenantId: 'test-tenant' };
      const error = new GoogleOAuthError(
        'Test message',
        GoogleOAuthErrorCode.TENANT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        metadata,
      );

      const response = error.getResponse() as any;
      expect(response.metadata).toEqual(metadata);
    });

    it('should include all required fields in response', () => {
      const error = new GoogleOAuthError(
        'Test message',
        GoogleOAuthErrorCode.OAUTH_FAILED,
      );

      const response = error.getResponse() as any;
      expect(response).toHaveProperty('statusCode');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('error', 'GoogleOAuthError');
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('timestamp');
    });
  });

  describe('GoogleOAuthErrorFactory', () => {
    describe('oauthCancelled', () => {
      it('should create oauth cancelled error', () => {
        const error = GoogleOAuthErrorFactory.oauthCancelled();

        expect(error).toBeInstanceOf(GoogleOAuthError);
        expect(error.code).toBe(GoogleOAuthErrorCode.OAUTH_CANCELLED);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.message).toContain('cancelled');
      });
    });

    describe('oauthFailed', () => {
      it('should create oauth failed error without reason', () => {
        const error = GoogleOAuthErrorFactory.oauthFailed();

        expect(error.code).toBe(GoogleOAuthErrorCode.OAUTH_FAILED);
        expect(error.message).toBe('OAuth flow failed');
      });

      it('should create oauth failed error with reason', () => {
        const reason = 'Invalid client ID';
        const error = GoogleOAuthErrorFactory.oauthFailed(reason);

        expect(error.message).toBe(`OAuth flow failed: ${reason}`);
      });
    });

    describe('invalidState', () => {
      it('should create invalid state error', () => {
        const error = GoogleOAuthErrorFactory.invalidState();

        expect(error.code).toBe(GoogleOAuthErrorCode.INVALID_STATE);
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(error.message).toContain('CSRF');
      });
    });

    describe('invalidCode', () => {
      it('should create invalid code error', () => {
        const error = GoogleOAuthErrorFactory.invalidCode();

        expect(error.code).toBe(GoogleOAuthErrorCode.INVALID_CODE);
        expect(error.message).toContain('authorization code');
      });
    });

    describe('tokenExchangeFailed', () => {
      it('should create token exchange failed error without reason', () => {
        const error = GoogleOAuthErrorFactory.tokenExchangeFailed();

        expect(error.code).toBe(GoogleOAuthErrorCode.TOKEN_EXCHANGE_FAILED);
        expect(error.message).toBe(
          'Failed to exchange authorization code for tokens',
        );
      });

      it('should create token exchange failed error with reason', () => {
        const reason = 'Network timeout';
        const error = GoogleOAuthErrorFactory.tokenExchangeFailed(reason);

        expect(error.message).toBe(
          `Failed to exchange authorization code for tokens: ${reason}`,
        );
      });
    });

    describe('invalidToken', () => {
      it('should create invalid token error', () => {
        const error = GoogleOAuthErrorFactory.invalidToken();

        expect(error.code).toBe(GoogleOAuthErrorCode.INVALID_TOKEN);
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(error.message).toContain('Invalid or expired');
      });
    });

    describe('tenantNotFound', () => {
      it('should create tenant not found error without tenant ID', () => {
        const error = GoogleOAuthErrorFactory.tenantNotFound();

        expect(error.code).toBe(GoogleOAuthErrorCode.TENANT_NOT_FOUND);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(error.message).toBe('Tenant not found');
      });

      it('should create tenant not found error with tenant ID', () => {
        const tenantId = 'test-tenant-123';
        const error = GoogleOAuthErrorFactory.tenantNotFound(tenantId);

        expect(error.message).toBe(`Tenant not found (ID: ${tenantId})`);
      });
    });

    describe('ssoDisabled', () => {
      it('should create SSO disabled error without tenant name', () => {
        const error = GoogleOAuthErrorFactory.ssoDisabled();

        expect(error.code).toBe(GoogleOAuthErrorCode.SSO_DISABLED);
        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(error.message).toContain('not enabled');
      });

      it('should create SSO disabled error with tenant name', () => {
        const tenantName = 'Acme Corp';
        const error = GoogleOAuthErrorFactory.ssoDisabled(tenantName);

        expect(error.message).toContain(tenantName);
      });
    });

    describe('autoProvisionDisabled', () => {
      it('should create auto provision disabled error', () => {
        const error = GoogleOAuthErrorFactory.autoProvisionDisabled();

        expect(error.code).toBe(GoogleOAuthErrorCode.AUTO_PROVISION_DISABLED);
        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(error.message).toContain('auto-provisioning is disabled');
      });
    });

    describe('crossTenantAccess', () => {
      it('should create cross tenant access error with metadata', () => {
        const userTenant = 'tenant-a';
        const requestedTenant = 'tenant-b';
        const error = GoogleOAuthErrorFactory.crossTenantAccess(
          userTenant,
          requestedTenant,
        );

        expect(error.code).toBe(GoogleOAuthErrorCode.CROSS_TENANT_ACCESS);
        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);

        const response = error.getResponse() as any;
        expect(response.metadata).toEqual({
          userTenant,
          requestedTenant,
        });
      });
    });

    describe('missingConfiguration', () => {
      it('should create missing configuration error', () => {
        const configKey = 'GOOGLE_CLIENT_ID';
        const error = GoogleOAuthErrorFactory.missingConfiguration(configKey);

        expect(error.code).toBe(GoogleOAuthErrorCode.MISSING_CONFIGURATION);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain(configKey);
      });
    });

    describe('invalidConfiguration', () => {
      it('should create invalid configuration error', () => {
        const reason = 'Invalid client secret format';
        const error = GoogleOAuthErrorFactory.invalidConfiguration(reason);

        expect(error.code).toBe(GoogleOAuthErrorCode.INVALID_CONFIGURATION);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain(reason);
      });
    });

    describe('rateLimitExceeded', () => {
      it('should create rate limit exceeded error without retry after', () => {
        const error = GoogleOAuthErrorFactory.rateLimitExceeded();

        expect(error.code).toBe(GoogleOAuthErrorCode.RATE_LIMIT_EXCEEDED);
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(error.message).toContain('Rate limit exceeded');
      });

      it('should create rate limit exceeded error with retry after', () => {
        const retryAfter = 60;
        const error = GoogleOAuthErrorFactory.rateLimitExceeded(retryAfter);

        const response = error.getResponse() as any;
        expect(response.metadata).toEqual({ retryAfter });
      });
    });

    describe('authenticationFailed', () => {
      it('should create authentication failed error without reason', () => {
        const error = GoogleOAuthErrorFactory.authenticationFailed();

        expect(error.code).toBe(GoogleOAuthErrorCode.AUTHENTICATION_FAILED);
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(error.message).toBe('Google authentication failed');
      });

      it('should create authentication failed error with reason', () => {
        const reason = 'Invalid user profile';
        const error = GoogleOAuthErrorFactory.authenticationFailed(reason);

        expect(error.message).toBe(`Google authentication failed: ${reason}`);
      });
    });

    describe('profileExtractionFailed', () => {
      it('should create profile extraction failed error', () => {
        const error = GoogleOAuthErrorFactory.profileExtractionFailed();

        expect(error.code).toBe(GoogleOAuthErrorCode.PROFILE_EXTRACTION_FAILED);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.message).toContain('extract user profile');
      });
    });
  });
});
