import { HttpStatus } from '@nestjs/common';
import {
  AccountLinkingError,
  AccountLinkingErrorCode,
  AccountLinkingErrorFactory,
} from './account-linking.error';

describe('AccountLinkingError', () => {
  describe('constructor', () => {
    it('should create error with default status', () => {
      const error = new AccountLinkingError(
        'Test message',
        AccountLinkingErrorCode.EMAIL_MISMATCH,
      );

      expect(error).toBeInstanceOf(AccountLinkingError);
      expect(error.message).toBe('Test message');
      expect(error.code).toBe(AccountLinkingErrorCode.EMAIL_MISMATCH);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.timestamp).toBeDefined();
    });

    it('should create error with custom status', () => {
      const error = new AccountLinkingError(
        'Conflict',
        AccountLinkingErrorCode.ALREADY_LINKED,
        HttpStatus.CONFLICT,
      );

      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it('should create error with metadata', () => {
      const metadata = { userId: 'test-user' };
      const error = new AccountLinkingError(
        'Test message',
        AccountLinkingErrorCode.ACCOUNT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
        metadata,
      );

      const response = error.getResponse() as any;
      expect(response.metadata).toEqual(metadata);
    });

    it('should include all required fields in response', () => {
      const error = new AccountLinkingError(
        'Test message',
        AccountLinkingErrorCode.LINKING_FAILED,
      );

      const response = error.getResponse() as any;
      expect(response).toHaveProperty('statusCode');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('error', 'AccountLinkingError');
      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('timestamp');
    });
  });

  describe('AccountLinkingErrorFactory', () => {
    describe('emailMismatch', () => {
      it('should create email mismatch error with metadata', () => {
        const userEmail = 'user@example.com';
        const googleEmail = 'different@example.com';
        const error = AccountLinkingErrorFactory.emailMismatch(
          userEmail,
          googleEmail,
        );

        expect(error).toBeInstanceOf(AccountLinkingError);
        expect(error.code).toBe(AccountLinkingErrorCode.EMAIL_MISMATCH);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.message).toContain('must match');

        const response = error.getResponse() as any;
        expect(response.metadata).toEqual({
          userEmail,
          googleEmail,
        });
      });
    });

    describe('emailNotVerified', () => {
      it('should create email not verified error', () => {
        const error = AccountLinkingErrorFactory.emailNotVerified();

        expect(error.code).toBe(AccountLinkingErrorCode.EMAIL_NOT_VERIFIED);
        expect(error.message).toContain('not verified');
      });
    });

    describe('alreadyLinked', () => {
      it('should create already linked error without user ID', () => {
        const error = AccountLinkingErrorFactory.alreadyLinked();

        expect(error.code).toBe(AccountLinkingErrorCode.ALREADY_LINKED);
        expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(error.message).toContain('already linked');
      });

      it('should create already linked error with user ID', () => {
        const userId = 'test-user-123';
        const error = AccountLinkingErrorFactory.alreadyLinked(userId);

        const response = error.getResponse() as any;
        expect(response.metadata).toEqual({ userId });
      });
    });

    describe('notLinked', () => {
      it('should create not linked error', () => {
        const error = AccountLinkingErrorFactory.notLinked();

        expect(error.code).toBe(AccountLinkingErrorCode.NOT_LINKED);
        expect(error.message).toContain('not linked');
      });
    });

    describe('accountNotFound', () => {
      it('should create account not found error with identifier', () => {
        const identifier = 'user@example.com';
        const error = AccountLinkingErrorFactory.accountNotFound(identifier);

        expect(error.code).toBe(AccountLinkingErrorCode.ACCOUNT_NOT_FOUND);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(error.message).toContain('not found');

        const response = error.getResponse() as any;
        expect(response.metadata).toEqual({ identifier });
      });
    });

    describe('cannotUnlink', () => {
      it('should create cannot unlink error with reason', () => {
        const reason = 'Account is locked';
        const error = AccountLinkingErrorFactory.cannotUnlink(reason);

        expect(error.code).toBe(AccountLinkingErrorCode.CANNOT_UNLINK);
        expect(error.message).toContain(reason);
      });
    });

    describe('lastAuthMethod', () => {
      it('should create last auth method error', () => {
        const error = AccountLinkingErrorFactory.lastAuthMethod();

        expect(error.code).toBe(AccountLinkingErrorCode.LAST_AUTH_METHOD);
        expect(error.message).toContain('only authentication method');
        expect(error.message).toContain('password first');
      });
    });

    describe('googleIdInUse', () => {
      it('should create google ID in use error without existing user ID', () => {
        const googleId = 'google-123';
        const error = AccountLinkingErrorFactory.googleIdInUse(googleId);

        expect(error.code).toBe(AccountLinkingErrorCode.GOOGLE_ID_IN_USE);
        expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(error.message).toContain('already linked to another user');

        const response = error.getResponse() as any;
        expect(response.metadata).toEqual({ googleId });
      });

      it('should create google ID in use error with existing user ID', () => {
        const googleId = 'google-123';
        const existingUserId = 'existing-user-456';
        const error = AccountLinkingErrorFactory.googleIdInUse(
          googleId,
          existingUserId,
        );

        const response = error.getResponse() as any;
        expect(response.metadata).toEqual({
          googleId,
          existingUserId,
        });
      });
    });

    describe('linkingDisabled', () => {
      it('should create linking disabled error', () => {
        const error = AccountLinkingErrorFactory.linkingDisabled();

        expect(error.code).toBe(AccountLinkingErrorCode.LINKING_DISABLED);
        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(error.message).toContain('disabled');
      });
    });

    describe('insufficientPermissions', () => {
      it('should create insufficient permissions error', () => {
        const error = AccountLinkingErrorFactory.insufficientPermissions();

        expect(error.code).toBe(
          AccountLinkingErrorCode.INSUFFICIENT_PERMISSIONS,
        );
        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(error.message).toContain('Insufficient permissions');
      });
    });

    describe('crossTenantLinking', () => {
      it('should create cross tenant linking error with metadata', () => {
        const userTenant = 'tenant-a';
        const targetTenant = 'tenant-b';
        const error = AccountLinkingErrorFactory.crossTenantLinking(
          userTenant,
          targetTenant,
        );

        expect(error.code).toBe(AccountLinkingErrorCode.CROSS_TENANT_LINKING);
        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(error.message).toContain('across different tenants');

        const response = error.getResponse() as any;
        expect(response.metadata).toEqual({
          userTenant,
          targetTenant,
        });
      });
    });

    describe('linkingRateLimit', () => {
      it('should create linking rate limit error without retry after', () => {
        const error = AccountLinkingErrorFactory.linkingRateLimit();

        expect(error.code).toBe(AccountLinkingErrorCode.LINKING_RATE_LIMIT);
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(error.message).toContain('Too many linking attempts');
      });

      it('should create linking rate limit error with retry after', () => {
        const retryAfter = 300;
        const error = AccountLinkingErrorFactory.linkingRateLimit(retryAfter);

        const response = error.getResponse() as any;
        expect(response.metadata).toEqual({ retryAfter });
      });
    });

    describe('linkingFailed', () => {
      it('should create linking failed error without reason', () => {
        const error = AccountLinkingErrorFactory.linkingFailed();

        expect(error.code).toBe(AccountLinkingErrorCode.LINKING_FAILED);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.message).toBe('Account linking failed');
      });

      it('should create linking failed error with reason', () => {
        const reason = 'Database connection failed';
        const error = AccountLinkingErrorFactory.linkingFailed(reason);

        expect(error.message).toBe(`Account linking failed: ${reason}`);
      });
    });

    describe('unlinkingFailed', () => {
      it('should create unlinking failed error without reason', () => {
        const error = AccountLinkingErrorFactory.unlinkingFailed();

        expect(error.code).toBe(AccountLinkingErrorCode.UNLINKING_FAILED);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.message).toBe('Account unlinking failed');
      });

      it('should create unlinking failed error with reason', () => {
        const reason = 'Transaction rollback failed';
        const error = AccountLinkingErrorFactory.unlinkingFailed(reason);

        expect(error.message).toBe(`Account unlinking failed: ${reason}`);
      });
    });
  });
});
