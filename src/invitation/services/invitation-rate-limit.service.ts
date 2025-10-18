import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix: string; // Redis key prefix
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

/**
 * Rate limiting service specifically for invitation operations
 * Provides tenant-level, admin-level, and IP-based rate limiting
 */
@Injectable()
export class InvitationRateLimitService {
  private readonly logger = new Logger(InvitationRateLimitService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check if a request is within rate limits using sliding window
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const window = config.windowMs;
    const limit = config.maxRequests;
    const redisKey = `${config.keyPrefix}:${key}`;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();

      // Remove expired entries (older than window)
      pipeline.zremrangebyscore(redisKey, 0, now - window);

      // Count current requests in window
      pipeline.zcard(redisKey);

      // Add current request with unique identifier
      const requestId = `${now}-${Math.random().toString(36).substr(2, 9)}`;
      pipeline.zadd(redisKey, now, requestId);

      // Set expiration (add buffer for cleanup)
      pipeline.expire(redisKey, Math.ceil(window / 1000) + 60);

      const results = await pipeline.exec();

      if (!results || results.some(([err]) => err)) {
        throw new Error('Redis pipeline execution failed');
      }

      // Get count after cleanup but before adding new request
      const currentCount = results[1][1] as number;
      const allowed = currentCount < limit;

      if (!allowed) {
        // Remove the request we just added since it's not allowed
        await this.redis.zrem(redisKey, requestId);
      }

      const remaining = Math.max(0, limit - currentCount - (allowed ? 1 : 0));
      const resetTime = now + window;

      this.logger.debug(
        `Invitation rate limit check for ${key}: ${currentCount}/${limit}, allowed: ${allowed}`,
      );

      return {
        allowed,
        remaining,
        resetTime,
        totalHits: currentCount + (allowed ? 1 : 0),
      };
    } catch (error) {
      this.logger.error(
        `Invitation rate limiting error for key ${key}:`,
        error instanceof Error ? error.stack : error,
      );

      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
        totalHits: 1,
      };
    }
  }

  /**
   * Get tenant-specific invitation rate limit configuration
   * Default: 100 invitations per day per tenant
   */
  getTenantInvitationRateLimitConfig(): RateLimitConfig {
    return {
      windowMs: this.configService.get<number>(
        'INVITATION_TENANT_RATE_LIMIT_WINDOW_MS',
        24 * 60 * 60 * 1000, // 24 hours
      ),
      maxRequests: this.configService.get<number>(
        'INVITATION_TENANT_RATE_LIMIT_MAX_REQUESTS',
        100, // 100 invitations per day per tenant
      ),
      keyPrefix: 'invitation_tenant_rate_limit',
    };
  }

  /**
   * Get admin-specific invitation rate limit configuration
   * Default: 20 invitations per hour per admin
   */
  getAdminInvitationRateLimitConfig(): RateLimitConfig {
    return {
      windowMs: this.configService.get<number>(
        'INVITATION_ADMIN_RATE_LIMIT_WINDOW_MS',
        60 * 60 * 1000, // 1 hour
      ),
      maxRequests: this.configService.get<number>(
        'INVITATION_ADMIN_RATE_LIMIT_MAX_REQUESTS',
        20, // 20 invitations per hour per admin
      ),
      keyPrefix: 'invitation_admin_rate_limit',
    };
  }

  /**
   * Get IP-specific invitation acceptance rate limit configuration
   * Default: 10 attempts per hour per IP
   */
  getIpInvitationRateLimitConfig(): RateLimitConfig {
    return {
      windowMs: this.configService.get<number>(
        'INVITATION_IP_RATE_LIMIT_WINDOW_MS',
        60 * 60 * 1000, // 1 hour
      ),
      maxRequests: this.configService.get<number>(
        'INVITATION_IP_RATE_LIMIT_MAX_REQUESTS',
        10, // 10 attempts per hour per IP
      ),
      keyPrefix: 'invitation_ip_rate_limit',
    };
  }

  /**
   * Get email-specific invitation rate limit configuration
   * Prevents spam to the same email address
   * Default: 3 invitations per day per email
   */
  getEmailInvitationRateLimitConfig(): RateLimitConfig {
    return {
      windowMs: this.configService.get<number>(
        'INVITATION_EMAIL_RATE_LIMIT_WINDOW_MS',
        24 * 60 * 60 * 1000, // 24 hours
      ),
      maxRequests: this.configService.get<number>(
        'INVITATION_EMAIL_RATE_LIMIT_MAX_REQUESTS',
        3, // 3 invitations per day per email
      ),
      keyPrefix: 'invitation_email_rate_limit',
    };
  }

  /**
   * Check email-specific rate limit for invitation creation
   */
  async checkEmailRateLimit(email: string): Promise<RateLimitResult> {
    const config = this.getEmailInvitationRateLimitConfig();
    return this.checkRateLimit(email.toLowerCase(), config);
  }

  /**
   * Reset rate limit for a specific key and configuration
   */
  async resetRateLimit(key: string, config: RateLimitConfig): Promise<void> {
    try {
      const redisKey = `${config.keyPrefix}:${key}`;
      await this.redis.del(redisKey);
      this.logger.debug(`Invitation rate limit reset for key: ${redisKey}`);
    } catch (error) {
      this.logger.error(
        `Failed to reset invitation rate limit for key ${key}:`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(
    key: string,
    config: RateLimitConfig,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const window = config.windowMs;
    const limit = config.maxRequests;
    const redisKey = `${config.keyPrefix}:${key}`;

    try {
      // Clean up expired entries and count current requests
      await this.redis.zremrangebyscore(redisKey, 0, now - window);
      const currentCount = await this.redis.zcard(redisKey);

      const remaining = Math.max(0, limit - currentCount);
      const resetTime = now + window;

      return {
        allowed: currentCount < limit,
        remaining,
        resetTime,
        totalHits: currentCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get invitation rate limit status for key ${key}:`,
        error instanceof Error ? error.stack : error,
      );

      // Return default values on error
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: now + window,
        totalHits: 0,
      };
    }
  }

  /**
   * Get comprehensive rate limit status for a tenant
   */
  async getTenantRateLimitStatus(tenantId: string): Promise<{
    tenant: RateLimitResult;
  }> {
    const tenantConfig = this.getTenantInvitationRateLimitConfig();

    const [tenantStatus] = await Promise.all([
      this.getRateLimitStatus(tenantId, tenantConfig),
    ]);

    return {
      tenant: tenantStatus,
    };
  }

  /**
   * Get comprehensive rate limit status for an admin user
   */
  async getAdminRateLimitStatus(userId: string): Promise<{
    admin: RateLimitResult;
  }> {
    const adminConfig = this.getAdminInvitationRateLimitConfig();

    const adminStatus = await this.getRateLimitStatus(userId, adminConfig);

    return {
      admin: adminStatus,
    };
  }
}
