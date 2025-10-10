import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { GoogleOAuthRateLimitService } from '../services';
import { GoogleOAuthErrorFactory } from '../errors/google-oauth.error';

/**
 * Rate limiting guard specifically for Google OAuth endpoints
 * Provides different rate limits for different OAuth operations
 */
@Injectable()
export class GoogleOAuthRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(GoogleOAuthRateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: GoogleOAuthRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if this endpoint should skip Google OAuth rate limiting
    const skipRateLimit = this.reflector.get<boolean>(
      'skipGoogleOAuthRateLimit',
      context.getHandler(),
    );

    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get client IP address
    const clientIp = this.getClientIp(request);

    // Determine the operation type based on the endpoint
    const operationType = this.getOperationType(request);

    // Get tenant ID from request (if available)
    const tenantId = this.getTenantId(request);

    try {
      // Check IP-based rate limit (global protection)
      const ipResult = await this.rateLimitService.checkIpRateLimit(
        clientIp,
        operationType,
      );

      // Check tenant-based rate limit (if tenant is available)
      let tenantResult = null;
      if (tenantId) {
        tenantResult = await this.rateLimitService.checkTenantRateLimit(
          tenantId,
          operationType,
        );
      }

      // Use the most restrictive result
      const result = this.getMostRestrictiveResult(ipResult, tenantResult);

      // Add rate limit headers
      this.addRateLimitHeaders(response, result, operationType);

      if (!result.allowed) {
        this.logger.warn(
          `Google OAuth rate limit exceeded for IP ${clientIp}, operation: ${operationType}`,
          {
            clientIp,
            operationType,
            tenantId,
            remaining: result.remaining,
            resetTime: result.resetTime,
          },
        );

        throw GoogleOAuthErrorFactory.rateLimitExceeded(
          Math.ceil((result.resetTime - Date.now()) / 1000),
        );
      }

      this.logger.debug(
        `Google OAuth rate limit check passed for IP ${clientIp}, operation: ${operationType}`,
        {
          remaining: result.remaining,
          totalHits: result.totalHits,
        },
      );

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Google OAuth rate limiting error for IP ${clientIp}:`,
        error instanceof Error ? error.stack : error,
      );

      // Fail open - allow request if rate limiting service fails
      return true;
    }
  }

  /**
   * Extract client IP address from request
   */
  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Determine the operation type based on the request path
   */
  private getOperationType(request: Request): string {
    const path = request.path;
    const method = request.method;

    // Map endpoints to operation types
    if (path.includes('/auth/google/callback') && method === 'POST') {
      return 'oauth_callback';
    }
    if (path.includes('/auth/google/link/callback') && method === 'POST') {
      return 'link_callback';
    }
    if (path.includes('/auth/google/link') && method === 'GET') {
      return 'link_initiate';
    }
    if (path.includes('/auth/google/unlink') && method === 'POST') {
      return 'unlink';
    }
    if (path.includes('/auth/google') && method === 'GET') {
      return 'oauth_initiate';
    }
    if (path.includes('/tenants') && path.includes('/settings/google')) {
      return 'admin_settings';
    }

    return 'general';
  }

  /**
   * Extract tenant ID from request
   */
  private getTenantId(request: Request): string | null {
    // Try to get tenant ID from various sources
    return (
      (request.headers['x-tenant-id'] as string) ||
      request.body?.tenantId ||
      request.query?.tenantId ||
      request.params?.tenantId ||
      null
    );
  }

  /**
   * Get the most restrictive result from multiple rate limit checks
   */
  private getMostRestrictiveResult(ipResult: any, tenantResult: any): any {
    if (!tenantResult) {
      return ipResult;
    }

    // If either check fails, the request is not allowed
    if (!ipResult.allowed || !tenantResult.allowed) {
      return {
        allowed: false,
        remaining: Math.min(ipResult.remaining, tenantResult.remaining),
        resetTime: Math.max(ipResult.resetTime, tenantResult.resetTime),
        totalHits: Math.max(ipResult.totalHits, tenantResult.totalHits),
        config: ipResult.allowed ? tenantResult.config : ipResult.config,
      };
    }

    // Both checks pass, return the more restrictive one
    return ipResult.remaining <= tenantResult.remaining
      ? ipResult
      : tenantResult;
  }

  /**
   * Add rate limit headers to response
   */
  private addRateLimitHeaders(
    response: Response,
    result: any,
    operationType: string,
  ): void {
    response.setHeader(
      'X-RateLimit-Limit',
      result.config?.maxRequests || 'unknown',
    );
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
    response.setHeader('X-RateLimit-Operation', operationType);

    if (!result.allowed) {
      response.setHeader(
        'Retry-After',
        Math.ceil((result.resetTime - Date.now()) / 1000),
      );
    }
  }
}
