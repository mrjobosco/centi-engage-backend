import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom error class for Google OAuth related errors
 */
export class GoogleOAuthError extends HttpException {
  public readonly code: string;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: GoogleOAuthErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    metadata?: Record<string, any>,
  ) {
    const errorResponse = {
      statusCode: status,
      message,
      error: 'GoogleOAuthError',
      code,
      timestamp: new Date().toISOString(),
      ...(metadata && { metadata }),
    };

    super(errorResponse, status);
    this.code = code;
    this.timestamp = errorResponse.timestamp;
  }
}

/**
 * Enum for Google OAuth error codes
 */
export enum GoogleOAuthErrorCode {
  // OAuth flow errors
  OAUTH_CANCELLED = 'OAUTH_CANCELLED',
  OAUTH_FAILED = 'OAUTH_FAILED',
  INVALID_STATE = 'INVALID_STATE',
  INVALID_CODE = 'INVALID_CODE',
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  INVALID_TOKEN = 'INVALID_TOKEN',

  // Tenant related errors
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',
  SSO_DISABLED = 'SSO_DISABLED',
  AUTO_PROVISION_DISABLED = 'AUTO_PROVISION_DISABLED',
  CROSS_TENANT_ACCESS = 'CROSS_TENANT_ACCESS',

  // Configuration errors
  MISSING_CONFIGURATION = 'MISSING_CONFIGURATION',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',

  // Rate limiting errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // General errors
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  PROFILE_EXTRACTION_FAILED = 'PROFILE_EXTRACTION_FAILED',
}

/**
 * Factory methods for common Google OAuth errors
 */
export class GoogleOAuthErrorFactory {
  static oauthCancelled(): GoogleOAuthError {
    return new GoogleOAuthError(
      'OAuth flow was cancelled by the user',
      GoogleOAuthErrorCode.OAUTH_CANCELLED,
      HttpStatus.BAD_REQUEST,
    );
  }

  static oauthFailed(reason?: string): GoogleOAuthError {
    return new GoogleOAuthError(
      `OAuth flow failed${reason ? `: ${reason}` : ''}`,
      GoogleOAuthErrorCode.OAUTH_FAILED,
      HttpStatus.BAD_REQUEST,
    );
  }

  static invalidState(): GoogleOAuthError {
    return new GoogleOAuthError(
      'Invalid or expired state parameter - possible CSRF attack',
      GoogleOAuthErrorCode.INVALID_STATE,
      HttpStatus.UNAUTHORIZED,
    );
  }

  static invalidCode(): GoogleOAuthError {
    return new GoogleOAuthError(
      'Invalid authorization code provided',
      GoogleOAuthErrorCode.INVALID_CODE,
      HttpStatus.BAD_REQUEST,
    );
  }

  static tokenExchangeFailed(reason?: string): GoogleOAuthError {
    return new GoogleOAuthError(
      `Failed to exchange authorization code for tokens${reason ? `: ${reason}` : ''}`,
      GoogleOAuthErrorCode.TOKEN_EXCHANGE_FAILED,
      HttpStatus.BAD_REQUEST,
    );
  }

  static invalidToken(): GoogleOAuthError {
    return new GoogleOAuthError(
      'Invalid or expired Google token',
      GoogleOAuthErrorCode.INVALID_TOKEN,
      HttpStatus.UNAUTHORIZED,
    );
  }

  static tenantNotFound(tenantId?: string): GoogleOAuthError {
    return new GoogleOAuthError(
      `Tenant not found${tenantId ? ` (ID: ${tenantId})` : ''}`,
      GoogleOAuthErrorCode.TENANT_NOT_FOUND,
      HttpStatus.NOT_FOUND,
    );
  }

  static ssoDisabled(tenantName?: string): GoogleOAuthError {
    return new GoogleOAuthError(
      `Google SSO is not enabled for this tenant${tenantName ? ` (${tenantName})` : ''}`,
      GoogleOAuthErrorCode.SSO_DISABLED,
      HttpStatus.FORBIDDEN,
    );
  }

  static autoProvisionDisabled(): GoogleOAuthError {
    return new GoogleOAuthError(
      'User not found and auto-provisioning is disabled for this tenant',
      GoogleOAuthErrorCode.AUTO_PROVISION_DISABLED,
      HttpStatus.FORBIDDEN,
    );
  }

  static crossTenantAccess(
    userTenant: string,
    requestedTenant: string,
  ): GoogleOAuthError {
    return new GoogleOAuthError(
      'User belongs to a different tenant',
      GoogleOAuthErrorCode.CROSS_TENANT_ACCESS,
      HttpStatus.FORBIDDEN,
      {
        userTenant,
        requestedTenant,
      },
    );
  }

  static missingConfiguration(configKey: string): GoogleOAuthError {
    return new GoogleOAuthError(
      `Missing required Google OAuth configuration: ${configKey}`,
      GoogleOAuthErrorCode.MISSING_CONFIGURATION,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  static invalidConfiguration(reason: string): GoogleOAuthError {
    return new GoogleOAuthError(
      `Invalid Google OAuth configuration: ${reason}`,
      GoogleOAuthErrorCode.INVALID_CONFIGURATION,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  static rateLimitExceeded(retryAfter?: number): GoogleOAuthError {
    return new GoogleOAuthError(
      'Rate limit exceeded for Google OAuth operations',
      GoogleOAuthErrorCode.RATE_LIMIT_EXCEEDED,
      HttpStatus.TOO_MANY_REQUESTS,
      retryAfter ? { retryAfter } : undefined,
    );
  }

  static authenticationFailed(reason?: string): GoogleOAuthError {
    return new GoogleOAuthError(
      `Google authentication failed${reason ? `: ${reason}` : ''}`,
      GoogleOAuthErrorCode.AUTHENTICATION_FAILED,
      HttpStatus.UNAUTHORIZED,
    );
  }

  static profileExtractionFailed(): GoogleOAuthError {
    return new GoogleOAuthError(
      'Failed to extract user profile from Google token',
      GoogleOAuthErrorCode.PROFILE_EXTRACTION_FAILED,
      HttpStatus.BAD_REQUEST,
    );
  }
}
