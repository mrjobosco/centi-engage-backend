import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantManagementRateLimitService } from '../services/tenant-management-rate-limit.service';

export interface TenantManagementRateLimitOptions {
  operation: 'creation' | 'joining' | 'invitation';
  skipForAdmin?: boolean;
}

/**
 * Decorator to configure tenant management rate limiting
 */
export const TenantManagementRateLimit = (
  options: TenantManagementRateLimitOptions,
) => Reflect.metadata('tenantManagementRateLimit', options);

/**
 * Guard that enforces rate limiting for tenant management operations
 * Provides different rate limits for tenant creation, joining, and invitation acceptance
 */
@Injectable()
export class TenantManagementRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: TenantManagementRateLimitService,
    private readonly reflector: Reflector,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      // If no user, let other guards handle authentication
      return true;
    }

    // Get rate limit configuration from decorator
    const rateLimitOptions =
      this.reflector.get<TenantManagementRateLimitOptions>(
        'tenantManagementRateLimit',
        context.getHandler(),
      );

    if (!rateLimitOptions) {
      // No rate limiting configured for this endpoint
      return true;
    }

    // Skip rate limiting for admin users if configured
    if (rateLimitOptions.skipForAdmin && this.isAdminUser(user)) {
      return true;
    }

    // Check rate limit based on operation type
    let rateLimitResult;
    switch (rateLimitOptions.operation) {
      case 'creation':
        rateLimitResult =
          await this.rateLimitService.checkTenantCreationRateLimit(user.userId);
        break;
      case 'joining':
        rateLimitResult =
          await this.rateLimitService.checkTenantJoiningRateLimit(user.userId);
        break;
      case 'invitation':
        rateLimitResult =
          await this.rateLimitService.checkInvitationAcceptanceRateLimit(
            user.userId,
          );
        break;
    }

    if (!rateLimitResult.allowed) {
      const retryAfter = Math.ceil(
        (rateLimitResult.resetTime - Date.now()) / 1000,
      );

      throw new HttpException(
        {
          message: `Rate limit exceeded for ${rateLimitOptions.operation} operation. Try again in ${retryAfter} seconds.`,
          error: 'Tenant Management Rate Limit Exceeded',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          details: {
            operation: rateLimitOptions.operation,
            retryAfter,
            remaining: rateLimitResult.remaining,
            resetTime: rateLimitResult.resetTime,
            totalHits: rateLimitResult.totalHits,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add rate limit info to response headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', rateLimitResult.totalHits);
    response.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
    response.setHeader(
      'X-RateLimit-Reset',
      new Date(rateLimitResult.resetTime).toISOString(),
    );

    return true;
  }

  /**
   * Check if user has admin role
   */
  private isAdminUser(user: any): boolean {
    return (
      user.roles?.some((role: any) =>
        typeof role === 'string'
          ? role.toLowerCase().includes('admin')
          : role.name?.toLowerCase().includes('admin'),
      ) || false
    );
  }
}
