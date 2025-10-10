import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ErrorResponseFormatter } from './error-response.formatter';
import { GoogleOAuthError, GoogleOAuthErrorCode } from './google-oauth.error';
import {
  AccountLinkingError,
  AccountLinkingErrorCode,
} from './account-linking.error';

describe('ErrorResponseFormatter', () => {
  const mockPath = '/auth/google/callback';
  const mockRequestId = 'req-123';

  describe('format', () => {
    it('should format GoogleOAuthError correctly', () => {
      const error = new GoogleOAuthError(
        'OAuth failed',
        GoogleOAuthErrorCode.OAUTH_FAILED,
        HttpStatus.BAD_REQUEST,
        { tenantId: 'test-tenant' },
      );

      const result = ErrorResponseFormatter.format(
        error,
        mockPath,
        mockRequestId,
      );

      expect(result).toEqual({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'OAuth failed',
        error: 'GoogleOAuthError',
        code: GoogleOAuthErrorCode.OAUTH_FAILED,
        timestamp: expect.any(String),
        path: mockPath,
        metadata: { tenantId: 'test-tenant' },
        requestId: mockRequestId,
      });
    });

    it('should format AccountLinkingError correctly', () => {
      const error = new AccountLinkingError(
        'Email mismatch',
        AccountLinkingErrorCode.EMAIL_MISMATCH,
        HttpStatus.BAD_REQUEST,
        { userEmail: 'user@test.com', googleEmail: 'google@test.com' },
      );

      const result = ErrorResponseFormatter.format(error, mockPath);

      expect(result).toEqual({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Email mismatch',
        error: 'AccountLinkingError',
        code: AccountLinkingErrorCode.EMAIL_MISMATCH,
        timestamp: expect.any(String),
        path: mockPath,
        metadata: {
          userEmail: 'user@test.com',
          googleEmail: 'google@test.com',
        },
      });
    });

    it('should format standard HttpException correctly', () => {
      const error = new BadRequestException('Invalid input');

      const result = ErrorResponseFormatter.format(error, mockPath);

      expect(result).toEqual({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid input',
        error: 'BadRequestException',
        timestamp: expect.any(String),
        path: mockPath,
      });
    });

    it('should format HttpException with array message correctly', () => {
      const error = new BadRequestException([
        'Field is required',
        'Invalid format',
      ]);

      const result = ErrorResponseFormatter.format(error, mockPath);

      expect(result).toEqual({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Field is required, Invalid format',
        error: 'BadRequestException',
        timestamp: expect.any(String),
        path: mockPath,
      });
    });

    it('should format HttpException with object response correctly', () => {
      const error = new HttpException(
        { message: 'Custom error', details: 'Additional info' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );

      const result = ErrorResponseFormatter.format(error, mockPath);

      expect(result).toEqual({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: 'Custom error',
        error: 'HttpException',
        timestamp: expect.any(String),
        path: mockPath,
      });
    });

    it('should format generic Error correctly', () => {
      const error = new Error('Something went wrong');

      const result = ErrorResponseFormatter.format(error, mockPath);

      expect(result).toEqual({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Something went wrong',
        error: 'InternalServerError',
        timestamp: expect.any(String),
        path: mockPath,
      });
    });

    it('should format error without message correctly', () => {
      const error = new Error();

      const result = ErrorResponseFormatter.format(error, mockPath);

      expect(result).toEqual({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: 'InternalServerError',
        timestamp: expect.any(String),
        path: mockPath,
      });
    });

    it('should include requestId when provided', () => {
      const error = new NotFoundException('Not found');

      const result = ErrorResponseFormatter.format(
        error,
        mockPath,
        mockRequestId,
      );

      expect(result.requestId).toBe(mockRequestId);
    });

    it('should not include metadata when not present', () => {
      const error = new GoogleOAuthError(
        'OAuth failed',
        GoogleOAuthErrorCode.OAUTH_FAILED,
      );

      const result = ErrorResponseFormatter.format(error, mockPath);

      expect(result).not.toHaveProperty('metadata');
    });
  });

  describe('isGoogleOAuthError', () => {
    it('should return true for GoogleOAuthError', () => {
      const error = new GoogleOAuthError(
        'Test',
        GoogleOAuthErrorCode.OAUTH_FAILED,
      );
      expect(ErrorResponseFormatter.isGoogleOAuthError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new BadRequestException('Test');
      expect(ErrorResponseFormatter.isGoogleOAuthError(error)).toBe(false);
    });
  });

  describe('isAccountLinkingError', () => {
    it('should return true for AccountLinkingError', () => {
      const error = new AccountLinkingError(
        'Test',
        AccountLinkingErrorCode.EMAIL_MISMATCH,
      );
      expect(ErrorResponseFormatter.isAccountLinkingError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new BadRequestException('Test');
      expect(ErrorResponseFormatter.isAccountLinkingError(error)).toBe(false);
    });
  });

  describe('isCustomAuthError', () => {
    it('should return true for GoogleOAuthError', () => {
      const error = new GoogleOAuthError(
        'Test',
        GoogleOAuthErrorCode.OAUTH_FAILED,
      );
      expect(ErrorResponseFormatter.isCustomAuthError(error)).toBe(true);
    });

    it('should return true for AccountLinkingError', () => {
      const error = new AccountLinkingError(
        'Test',
        AccountLinkingErrorCode.EMAIL_MISMATCH,
      );
      expect(ErrorResponseFormatter.isCustomAuthError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new BadRequestException('Test');
      expect(ErrorResponseFormatter.isCustomAuthError(error)).toBe(false);
    });
  });

  describe('getErrorCode', () => {
    it('should return code for GoogleOAuthError', () => {
      const error = new GoogleOAuthError(
        'Test',
        GoogleOAuthErrorCode.OAUTH_FAILED,
      );
      expect(ErrorResponseFormatter.getErrorCode(error)).toBe(
        GoogleOAuthErrorCode.OAUTH_FAILED,
      );
    });

    it('should return code for AccountLinkingError', () => {
      const error = new AccountLinkingError(
        'Test',
        AccountLinkingErrorCode.EMAIL_MISMATCH,
      );
      expect(ErrorResponseFormatter.getErrorCode(error)).toBe(
        AccountLinkingErrorCode.EMAIL_MISMATCH,
      );
    });

    it('should return undefined for other errors', () => {
      const error = new BadRequestException('Test');
      expect(ErrorResponseFormatter.getErrorCode(error)).toBeUndefined();
    });
  });

  describe('getErrorMetadata', () => {
    it('should return metadata for GoogleOAuthError', () => {
      const metadata = { tenantId: 'test' };
      const error = new GoogleOAuthError(
        'Test',
        GoogleOAuthErrorCode.OAUTH_FAILED,
        HttpStatus.BAD_REQUEST,
        metadata,
      );
      expect(ErrorResponseFormatter.getErrorMetadata(error)).toEqual(metadata);
    });

    it('should return metadata for AccountLinkingError', () => {
      const metadata = { userId: 'test' };
      const error = new AccountLinkingError(
        'Test',
        AccountLinkingErrorCode.EMAIL_MISMATCH,
        HttpStatus.BAD_REQUEST,
        metadata,
      );
      expect(ErrorResponseFormatter.getErrorMetadata(error)).toEqual(metadata);
    });

    it('should return undefined for other errors', () => {
      const error = new BadRequestException('Test');
      expect(ErrorResponseFormatter.getErrorMetadata(error)).toBeUndefined();
    });

    it('should return undefined when no metadata present', () => {
      const error = new GoogleOAuthError(
        'Test',
        GoogleOAuthErrorCode.OAUTH_FAILED,
      );
      expect(ErrorResponseFormatter.getErrorMetadata(error)).toBeUndefined();
    });
  });
});
