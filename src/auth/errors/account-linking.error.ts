import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom error class for account linking related errors
 */
export class AccountLinkingError extends HttpException {
  public readonly code: string;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: AccountLinkingErrorCode,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    metadata?: Record<string, any>,
  ) {
    const errorResponse = {
      statusCode: status,
      message,
      error: 'AccountLinkingError',
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
 * Enum for account linking error codes
 */
export enum AccountLinkingErrorCode {
  // Email validation errors
  EMAIL_MISMATCH = 'EMAIL_MISMATCH',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',

  // Account state errors
  ALREADY_LINKED = 'ALREADY_LINKED',
  NOT_LINKED = 'NOT_LINKED',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',

  // Unlinking validation errors
  CANNOT_UNLINK = 'CANNOT_UNLINK',
  LAST_AUTH_METHOD = 'LAST_AUTH_METHOD',

  // Linking validation errors
  GOOGLE_ID_IN_USE = 'GOOGLE_ID_IN_USE',
  LINKING_DISABLED = 'LINKING_DISABLED',

  // Permission errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  CROSS_TENANT_LINKING = 'CROSS_TENANT_LINKING',

  // Rate limiting errors
  LINKING_RATE_LIMIT = 'LINKING_RATE_LIMIT',

  // General errors
  LINKING_FAILED = 'LINKING_FAILED',
  UNLINKING_FAILED = 'UNLINKING_FAILED',
}

/**
 * Factory methods for common account linking errors
 */
export class AccountLinkingErrorFactory {
  static emailMismatch(
    userEmail: string,
    googleEmail: string,
  ): AccountLinkingError {
    return new AccountLinkingError(
      'Google email must match your account email to link accounts',
      AccountLinkingErrorCode.EMAIL_MISMATCH,
      HttpStatus.BAD_REQUEST,
      {
        userEmail,
        googleEmail,
      },
    );
  }

  static emailNotVerified(): AccountLinkingError {
    return new AccountLinkingError(
      'Google email is not verified',
      AccountLinkingErrorCode.EMAIL_NOT_VERIFIED,
      HttpStatus.BAD_REQUEST,
    );
  }

  static alreadyLinked(userId?: string): AccountLinkingError {
    return new AccountLinkingError(
      'Google account is already linked to this user',
      AccountLinkingErrorCode.ALREADY_LINKED,
      HttpStatus.CONFLICT,
      userId ? { userId } : undefined,
    );
  }

  static notLinked(): AccountLinkingError {
    return new AccountLinkingError(
      'Google account is not linked to this user',
      AccountLinkingErrorCode.NOT_LINKED,
      HttpStatus.BAD_REQUEST,
    );
  }

  static accountNotFound(identifier: string): AccountLinkingError {
    return new AccountLinkingError(
      'User account not found',
      AccountLinkingErrorCode.ACCOUNT_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { identifier },
    );
  }

  static cannotUnlink(reason: string): AccountLinkingError {
    return new AccountLinkingError(
      `Cannot unlink Google account: ${reason}`,
      AccountLinkingErrorCode.CANNOT_UNLINK,
      HttpStatus.BAD_REQUEST,
    );
  }

  static lastAuthMethod(): AccountLinkingError {
    return new AccountLinkingError(
      'Cannot unlink Google account - it is your only authentication method. Please set up a password first.',
      AccountLinkingErrorCode.LAST_AUTH_METHOD,
      HttpStatus.BAD_REQUEST,
    );
  }

  static googleIdInUse(
    googleId: string,
    existingUserId?: string,
  ): AccountLinkingError {
    return new AccountLinkingError(
      'This Google account is already linked to another user',
      AccountLinkingErrorCode.GOOGLE_ID_IN_USE,
      HttpStatus.CONFLICT,
      {
        googleId,
        ...(existingUserId && { existingUserId }),
      },
    );
  }

  static linkingDisabled(): AccountLinkingError {
    return new AccountLinkingError(
      'Account linking is disabled for this tenant',
      AccountLinkingErrorCode.LINKING_DISABLED,
      HttpStatus.FORBIDDEN,
    );
  }

  static insufficientPermissions(): AccountLinkingError {
    return new AccountLinkingError(
      'Insufficient permissions to perform account linking operation',
      AccountLinkingErrorCode.INSUFFICIENT_PERMISSIONS,
      HttpStatus.FORBIDDEN,
    );
  }

  static crossTenantLinking(
    userTenant: string,
    targetTenant: string,
  ): AccountLinkingError {
    return new AccountLinkingError(
      'Cannot link accounts across different tenants',
      AccountLinkingErrorCode.CROSS_TENANT_LINKING,
      HttpStatus.FORBIDDEN,
      {
        userTenant,
        targetTenant,
      },
    );
  }

  static linkingRateLimit(retryAfter?: number): AccountLinkingError {
    return new AccountLinkingError(
      'Too many linking attempts. Please try again later.',
      AccountLinkingErrorCode.LINKING_RATE_LIMIT,
      HttpStatus.TOO_MANY_REQUESTS,
      retryAfter ? { retryAfter } : undefined,
    );
  }

  static linkingFailed(reason?: string): AccountLinkingError {
    return new AccountLinkingError(
      `Account linking failed${reason ? `: ${reason}` : ''}`,
      AccountLinkingErrorCode.LINKING_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  static unlinkingFailed(reason?: string): AccountLinkingError {
    return new AccountLinkingError(
      `Account unlinking failed${reason ? `: ${reason}` : ''}`,
      AccountLinkingErrorCode.UNLINKING_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
