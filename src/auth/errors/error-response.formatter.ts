import { HttpException, HttpStatus } from '@nestjs/common';
import { GoogleOAuthError } from './google-oauth.error';
import { AccountLinkingError } from './account-linking.error';

/**
 * Interface for standardized error responses
 */
export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  code?: string;
  timestamp: string;
  path: string;
  metadata?: Record<string, any>;
}

/**
 * Utility class for formatting error responses consistently
 */
export class ErrorResponseFormatter {
  /**
   * Format any error into a standardized error response
   */
  static format(
    error: Error | HttpException,
    path: string,
    requestId?: string,
  ): ErrorResponse {
    const timestamp = new Date().toISOString();

    // Handle custom Google OAuth errors
    if (error instanceof GoogleOAuthError) {
      return {
        statusCode: error.getStatus(),
        message: error.message,
        error: 'GoogleOAuthError',
        code: error.code,
        timestamp,
        path,
        ...((error.getResponse() as any).metadata && {
          metadata: (error.getResponse() as any).metadata,
        }),
        ...(requestId && { requestId }),
      };
    }

    // Handle custom Account Linking errors
    if (error instanceof AccountLinkingError) {
      return {
        statusCode: error.getStatus(),
        message: error.message,
        error: 'AccountLinkingError',
        code: error.code,
        timestamp,
        path,
        ...((error.getResponse() as any).metadata && {
          metadata: (error.getResponse() as any).metadata,
        }),
        ...(requestId && { requestId }),
      };
    }

    // Handle standard NestJS HTTP exceptions
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const message =
        typeof response === 'string' ? response : (response as any).message;

      return {
        statusCode: error.getStatus(),
        message: Array.isArray(message) ? message.join(', ') : message,
        error: error.constructor.name,
        timestamp,
        path,
        ...(requestId && { requestId }),
      };
    }

    // Handle generic errors
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: error.message || 'Internal server error',
      error: 'InternalServerError',
      timestamp,
      path,
      ...(requestId && { requestId }),
    };
  }

  /**
   * Check if an error is a Google OAuth related error
   */
  static isGoogleOAuthError(error: any): error is GoogleOAuthError {
    return error instanceof GoogleOAuthError;
  }

  /**
   * Check if an error is an Account Linking related error
   */
  static isAccountLinkingError(error: any): error is AccountLinkingError {
    return error instanceof AccountLinkingError;
  }

  /**
   * Check if an error is a custom authentication error
   */
  static isCustomAuthError(error: any): boolean {
    return this.isGoogleOAuthError(error) || this.isAccountLinkingError(error);
  }

  /**
   * Extract error code from any error type
   */
  static getErrorCode(error: Error | HttpException): string | undefined {
    if (
      error instanceof GoogleOAuthError ||
      error instanceof AccountLinkingError
    ) {
      return error.code;
    }
    return undefined;
  }

  /**
   * Extract metadata from any error type
   */
  static getErrorMetadata(
    error: Error | HttpException,
  ): Record<string, any> | undefined {
    if (
      error instanceof GoogleOAuthError ||
      error instanceof AccountLinkingError
    ) {
      const response = error.getResponse() as any;
      return response.metadata;
    }
    return undefined;
  }
}
