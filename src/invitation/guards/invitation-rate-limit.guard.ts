import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InvitationRateLimitService } from '../services/invitation-rate-limit.service';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

/**
 * Rate limiting guard for invitation operations
 * Implements per-tenant, per-admin, and IP-based rate limiting
 */
@Injectable()
export class InvitationRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(InvitationRateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly rateLimitService: InvitationRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if rate limiting should be skipped for this endpoint
    const skipRateLimit = this.reflector.get<boolean>(
      'skipInvitationRateLimit',
      context.getHandler(),
    );

    if (skipRateLimit) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    const ip = this.getClientIp(request);

    // For invitation creation endpoints, check tenant and admin limits
    if (this.isInvitationCreationEndpoint(request)) {
      await this.checkTenantRateLimit(user?.tenantId, request);
      await this.checkAdminRateLimit(user?.id, request);
    }

    // For invitation acceptance endpoints, check IP-based limits
    if (this.isInvitationAcceptanceEndpoint(request)) {
      await this.checkIpRateLimit(ip, request);
    }

    return true;
  }

  private async checkTenantRateLimit(
    tenantId: string | undefined,
    request: any,
  ): Promise<void> {
    if (!tenantId) {
      this.logger.warn('No tenant ID found for rate limiting check');
      return;
    }

    const config = this.rateLimitService.getTenantInvitationRateLimitConfig();
    const result = await this.rateLimitService.checkRateLimit(tenantId, config);

    if (result) {
      this.setRateLimitHeaders(request.res, result);

      if (!result.allowed) {
        this.logger.warn(
          `Tenant rate limit exceeded for tenant ${tenantId}: ${result.totalHits}/${config.maxRequests}`,
        );
        throw new HttpException(
          `Tenant invitation limit exceeded. Try again in ${Math.ceil(
            (result.resetTime - Date.now()) / 1000,
          )} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private async checkAdminRateLimit(
    userId: string | undefined,
    request: any,
  ): Promise<void> {
    if (!userId) {
      this.logger.warn('No user ID found for admin rate limiting check');
      return;
    }

    const config = this.rateLimitService.getAdminInvitationRateLimitConfig();
    const result = await this.rateLimitService.checkRateLimit(userId, config);

    if (result) {
      this.setRateLimitHeaders(request.res, result);

      if (!result.allowed) {
        this.logger.warn(
          `Admin rate limit exceeded for user ${userId}: ${result.totalHits}/${config.maxRequests}`,
        );
        throw new HttpException(
          `Admin invitation limit exceeded. Try again in ${Math.ceil(
            (result.resetTime - Date.now()) / 1000,
          )} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private async checkIpRateLimit(ip: string, request: any): Promise<void> {
    const config = this.rateLimitService.getIpInvitationRateLimitConfig();
    const result = await this.rateLimitService.checkRateLimit(ip, config);

    if (result) {
      this.setRateLimitHeaders(request.res, result);

      if (!result.allowed) {
        this.logger.warn(
          `IP rate limit exceeded for ${ip}: ${result.totalHits}/${config.maxRequests}`,
        );
        throw new HttpException(
          `Too many invitation attempts from this IP. Try again in ${Math.ceil(
            (result.resetTime - Date.now()) / 1000,
          )} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private isInvitationCreationEndpoint(request: any): boolean {
    const method = request.method;
    const path = request.route?.path || request.url;

    // Check for invitation creation endpoints
    return (
      method === 'POST' &&
      (path.includes('/invitations') || path.endsWith('/invitations'))
    );
  }

  private isInvitationAcceptanceEndpoint(request: any): boolean {
    const method = request.method;
    const path = request.route?.path || request.url;

    // Check for invitation acceptance endpoints
    return (
      (method === 'GET' || method === 'POST') &&
      path.includes('/invitation-acceptance')
    );
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0] ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  private setRateLimitHeaders(response: any, result: any): void {
    if (response && typeof response.set === 'function') {
      response.set({
        'X-RateLimit-Limit': result.totalHits.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      });
    }
  }
}
