import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { RateLimitingService } from '../services/rate-limiting.service';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

/**
 * Rate limiting guard for tenant-wide operations
 * Uses tenant ID as the tracker for per-tenant rate limiting
 */
@Injectable()
export class TenantRateLimitGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: any,
    reflector: Reflector,
    private readonly tenantContext?: TenantContextService,
    private readonly rateLimitingService?: RateLimitingService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    await Promise.resolve(); // Ensure async context
    const user = req.user as RequestUser;
    return user?.tenantId || req.ip || 'unknown';
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    await Promise.resolve(); // Ensure async context
    // Check if this endpoint should skip tenant rate limiting
    const skipRateLimit = this.reflector.get<boolean>(
      'skipTenantRateLimit',
      context.getHandler(),
    );

    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    // Check if user has admin role and should skip rate limiting
    if (user?.roles?.some((role) => role.name === 'admin')) {
      return true;
    }

    return false;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const shouldSkip = await this.shouldSkip(context);
    if (shouldSkip) {
      return true;
    }

    return super.canActivate(context);
  }
}
