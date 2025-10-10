import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerOptions } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { RateLimitingService } from '../services/rate-limiting.service';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

/**
 * Rate limiting guard for notification endpoints
 * Provides different rate limits for different types of operations
 */
@Injectable()
export class NotificationRateLimitGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerOptions,
    storageService: any,
    reflector: Reflector,
    private readonly rateLimitingService?: RateLimitingService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user as RequestUser;
    return user?.id || req.ip || 'unknown';
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    // Check if this endpoint should skip notification rate limiting
    const skipRateLimit = this.reflector.get<boolean>(
      'skipNotificationRateLimit',
      context.getHandler(),
    );

    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user?.id) {
      // If no user context, allow the request (other guards will handle this)
      return true;
    }

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
