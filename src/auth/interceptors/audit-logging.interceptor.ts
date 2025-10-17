import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request } from 'express';
import { AuthAuditService } from '../services/auth-audit.service';
import { ErrorResponseFormatter } from '../errors/error-response.formatter';

/**
 * Interceptor to automatically log Google OAuth authentication events
 * with comprehensive metadata including IP address, user agent, and tenant context
 */
@Injectable()
export class AuditLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLoggingInterceptor.name);

  constructor(private readonly auditService: AuthAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    // Extract request metadata
    const metadata = this.extractRequestMetadata(request);
    const auditContext = this.determineAuditContext(request);

    // Skip if not an auditable endpoint
    if (!auditContext) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap((result) => {
        // Log successful operation
        void this.logSuccessfulOperation(
          auditContext,
          metadata,
          result,
          Date.now() - startTime,
        );
      }),
      catchError((error) => {
        // Log failed operation
        void this.logFailedOperation(
          auditContext,
          metadata,
          error,
          Date.now() - startTime,
        );
        return throwError(() => error);
      }),
    );
  }

  /**
   * Extract comprehensive metadata from the request
   */
  private extractRequestMetadata(request: Request): RequestMetadata {
    return {
      ipAddress: this.extractClientIp(request),
      userAgent: request.headers['user-agent'] || 'unknown',
      tenantId: this.extractTenantId(request),
      requestId: this.generateRequestId(),
      path: request.path,
      method: request.method,
      timestamp: new Date().toISOString(),
      headers: this.sanitizeHeaders(request.headers),
      query: request.query,
      body: this.sanitizeBody(request.body),
    };
  }

  /**
   * Extract client IP address from various headers
   */
  private extractClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      (request.headers['x-client-ip'] as string) ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Extract tenant ID from various sources
   */
  private extractTenantId(request: Request): string | null {
    return (
      (request.headers['x-tenant-id'] as string) ||
      request.body?.tenantId ||
      request.query?.tenantId ||
      request.params?.tenantId ||
      null
    );
  }

  /**
   * Generate a unique request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: any): Record<string, string> {
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];

    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(value);
      }
    }
    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'client_secret',
    ];

    const sanitized = { ...body };
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  /**
   * Determine if this request should be audited and what context to use
   */
  private determineAuditContext(request: Request): AuditContext | null {
    const path = request.path;
    const method = request.method;

    // Google OAuth endpoints
    if (path.includes('/auth/google')) {
      // Check more specific paths first
      if (path.includes('/link/callback') && method === 'POST') {
        return {
          action: 'google_link',
          authMethod: 'google',
          requiresUser: true,
        };
      }
      if (path.includes('/callback') && method === 'POST') {
        return {
          action: 'google_login',
          authMethod: 'google',
          requiresUser: false,
        };
      }
    }

    // Google settings endpoints
    if (path.includes('/tenants') && path.includes('/settings/google')) {
      return {
        action: 'google_settings_update',
        authMethod: 'admin',
        requiresUser: true,
      };
    }

    // Regular login endpoint
    if (path === '/auth/login' && method === 'POST') {
      return {
        action: 'password_login',
        authMethod: 'password',
        requiresUser: false,
      };
    }

    return null;
  }

  /**
   * Log successful operation
   */
  private async logSuccessfulOperation(
    auditContext: AuditContext,
    metadata: RequestMetadata,
    result: any,
    duration: number,
  ): Promise<void> {
    try {
      // For operations that don't require a user (like login), we might get user info from the result
      const userId = this.extractUserIdFromResult(result, auditContext);
      const tenantId =
        metadata.tenantId || this.extractTenantIdFromResult(result);

      if (!userId || !tenantId) {
        this.logger.warn(
          `Cannot log audit event - missing userId (${userId}) or tenantId (${tenantId})`,
          {
            action: auditContext.action,
            path: metadata.path,
            requestId: metadata.requestId,
          },
        );
        return;
      }

      await this.auditService.logAuthEvent({
        userId,
        tenantId,
        action: auditContext.action as any,
        authMethod: auditContext.authMethod as any,
        success: true,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        metadata: {
          requestId: metadata.requestId,
          path: metadata.path,
          method: metadata.method,
          duration,
          responseStatus: 'success',
          timestamp: metadata.timestamp,
          ...this.extractRelevantResultData(result, auditContext),
        },
      });

      this.logger.log(
        `Audit logged: ${auditContext.action} succeeded for user ${userId}`,
        {
          userId,
          tenantId,
          action: auditContext.action,
          duration,
          ipAddress: metadata.ipAddress,
          requestId: metadata.requestId,
        },
      );
    } catch (error) {
      this.logger.error(
        'Failed to log successful audit event',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Log failed operation
   */
  private async logFailedOperation(
    auditContext: AuditContext,
    metadata: RequestMetadata,
    error: any,
    duration: number,
  ): Promise<void> {
    try {
      // For failed operations, we might not have user info
      const userId = 'unknown'; // Will be updated if we can extract it
      const tenantId = metadata.tenantId || 'unknown';

      const errorCode = ErrorResponseFormatter.getErrorCode(error);
      const errorMetadata = ErrorResponseFormatter.getErrorMetadata(error);

      await this.auditService.logAuthEvent({
        userId,
        tenantId,
        action: auditContext.action as any,
        authMethod: auditContext.authMethod as any,
        success: false,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        errorCode,
        errorMessage: error.message || 'Unknown error',
        metadata: {
          requestId: metadata.requestId,
          path: metadata.path,
          method: metadata.method,
          duration,
          responseStatus: 'error',
          timestamp: metadata.timestamp,
          errorType: error.constructor.name,
          statusCode: error.status || error.statusCode || 500,
          ...errorMetadata,
        },
      });

      this.logger.error(`Audit logged: ${auditContext.action} failed`, {
        action: auditContext.action,
        error: error.message,
        errorCode,
        duration,
        ipAddress: metadata.ipAddress,
        requestId: metadata.requestId,
      });
    } catch (auditError) {
      this.logger.error(
        'Failed to log failed audit event',
        auditError instanceof Error ? auditError.stack : auditError,
      );
    }
  }

  /**
   * Extract user ID from operation result
   */
  private extractUserIdFromResult(
    result: any,
    auditContext: AuditContext,
  ): string | null {
    if (!result) return null;

    // For login operations, user info might be in the JWT payload
    if (auditContext.action.includes('login') && result.accessToken) {
      try {
        // Decode JWT payload (without verification since we just need the user ID)
        const payload = JSON.parse(
          Buffer.from(result.accessToken.split('.')[1], 'base64').toString(),
        );
        return payload.userId || null;
      } catch {
        return null;
      }
    }

    // For other operations, user ID might be directly in the result
    return result.userId || result.user?.id || null;
  }

  /**
   * Extract tenant ID from operation result
   */
  private extractTenantIdFromResult(result: any): string | null {
    if (!result) return null;

    // For login operations, tenant info might be in the JWT payload
    if (result.accessToken) {
      try {
        const payload = JSON.parse(
          Buffer.from(result.accessToken.split('.')[1], 'base64').toString(),
        );
        return payload.tenantId || null;
      } catch {
        return null;
      }
    }

    return result.tenantId || result.tenant?.id || null;
  }

  /**
   * Extract relevant data from the result for audit logging
   */
  private extractRelevantResultData(
    result: any,
    auditContext: AuditContext,
  ): any {
    const relevantData: any = {};

    if (auditContext.action.includes('login')) {
      relevantData.hasAccessToken = !!result.accessToken;
      relevantData.tokenType = 'Bearer';
    }

    if (auditContext.action.includes('settings')) {
      relevantData.settingsChanged = Object.keys(result || {});
    }

    return relevantData;
  }
}

/**
 * Interface for request metadata
 */
interface RequestMetadata {
  ipAddress: string;
  userAgent: string;
  tenantId: string | null;
  requestId: string;
  path: string;
  method: string;
  timestamp: string;
  headers: Record<string, string>;
  query: any;
  body: any;
}

/**
 * Interface for audit context
 */
interface AuditContext {
  action: string;
  authMethod: 'google' | 'password' | 'admin';
  requiresUser: boolean;
}
