import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface TenantRateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix: string; // Redis key prefix
}

export interface TenantRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

export class TenantManagementRateLimitException extends Error {
  constructor(
    public readonly retryAfter: number,
    public readonly operation: string,
    message?: string,
  ) {
    super(
      message ||
      `Rate limit exceeded for ${operation}. Try again in ${retryAfter} seconds.`,
    );
    this.name = 'TenantManagementRateLimitException';
  }
}

/**
 * Rate limiting service specifically for tenant management operations
 * Provides different rate limits for tenant creation and joining operations
 */
@Injectable()
export class TenantManagementRateLimitService {
  private readonly logger = new Logger(TenantManagementRateLimitService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Check rate limit for tenant creation operations
   */
  async checkTenantCreationRateLimit(
    userId: string,
  ): Promise<TenantRateLimitResult> {
    const config = this.getTenantCreationRateLimitConfig();
    return this.checkRateLimit(`tenant_creation:${userId}`, config);
  }

  /**
   * Check rate limit for tenant joining operations
   */
  async checkTenantJoiningRateLimit(
    userId: string,
  ): Promise<TenantRateLimitResult> {
    const config = this.getTenantJoiningRateLimitConfig();
    return this.checkRateLimit(`tenant_joining:${userId}`, config);
  }

  /**
   * Check rate limit for invitation acceptance operations
   */
  async checkInvitationAcceptanceRateLimit(
    userId: string,
  ): Promise<TenantRateLimitResult> {
    const config = this.getInvitationAcceptanceRateLimitConfig();
    return this.checkRateLimit(`invitation_acceptance:${userId}`, config);
  }

  /**
   * Generic rate limit check using sliding window algorithm
   */
  private async checkRateLimit(
    key: string,
    config: TenantRateLimitConfig,
  ): Promise<TenantRateLimitResult> {
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

      // Add current request
      pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);

      // Set expiration
      pipeline.expire(redisKey, Math.ceil(window / 1000));

      const results = await pipeline.exec();

      if (!results) {
        throw new Error('Redis pipeline execution failed');
      }

      // Get count after cleanup but before adding new request
      const currentCount = results[1][1] as number;
      const allowed = currentCount < limit;

      if (!allowed) {
        // Remove the request we just added since it's not allowed
        await this.redis.zrem(redisKey, `${now}-${Math.random()}`);
      }

      const remaining = Math.max(0, limit - currentCount - (allowed ? 1 : 0));
      const resetTime = now + window;

      this.logger.debug(
        `Tenant management rate limit check for ${key}: ${currentCount}/${limit}, allowed: ${allowed}`,
      );

      return {
        allowed,
        remaining,
        resetTime,
        totalHits: currentCount + (allowed ? 1 : 0),
      };
    } catch (error) {
      this.logger.error(
        `Tenant management rate limiting error for key ${key}:`,
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
   * Get rate limit configuration for tenant creation
   * More restrictive than joining since creating tenants is a heavier operation
   */
  private getTenantCreationRateLimitConfig(): TenantRateLimitConfig {
    return {
      windowMs: this.configService.get<number>(
        'TENANT_CREATION_RATE_LIMIT_WINDOW_MS',
        3600000, // 1 hour
      ),
      maxRequests: this.configService.get<number>(
        'TENANT_CREATION_RATE_LIMIT_MAX_REQUESTS',
        3, // 3 tenant creations per hour
      ),
      keyPrefix: 'tenant_management_rate_limit',
    };
  }

  /**
   * Get rate limit configuration for tenant joining
   * Less restrictive than creation since joining is lighter
   */
  private getTenantJoiningRateLimitConfig(): TenantRateLimitConfig {
    return {
      windowMs: this.configService.get<number>(
        'TENANT_JOINING_RATE_LIMIT_WINDOW_MS',
        3600000, // 1 hour
      ),
      maxRequests: this.configService.get<number>(
        'TENANT_JOINING_RATE_LIMIT_MAX_REQUESTS',
        10, // 10 tenant joins per hour
      ),
      keyPrefix: 'tenant_management_rate_limit',
    };
  }

  /**
   * Get rate limit configuration for invitation acceptance
   * Similar to joining but separate tracking
   */
  private getInvitationAcceptanceRateLimitConfig(): TenantRateLimitConfig {
    return {
      windowMs: this.configService.get<number>(
        'INVITATION_ACCEPTANCE_RATE_LIMIT_WINDOW_MS',
        3600000, // 1 hour
      ),
      maxRequests: this.configService.get<number>(
        'INVITATION_ACCEPTANCE_RATE_LIMIT_MAX_REQUESTS',
        10, // 10 invitation acceptances per hour
      ),
      keyPrefix: 'tenant_management_rate_limit',
    };
  }

  /**
   * Reset rate limit for a specific user and operation
   */
  async resetRateLimit(
    userId: string,
    operation: 'creation' | 'joining' | 'invitation',
  ): Promise<void> {
    try {
      const key = `tenant_${operation}:${userId}`;
      const redisKey = `tenant_management_rate_limit:${key}`;
      await this.redis.del(redisKey);
      this.logger.debug(
        `Tenant management rate limit reset for user ${userId}, operation: ${operation}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to reset tenant management rate limit for user ${userId}, operation ${operation}:`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(
    userId: string,
    operation: 'creation' | 'joining' | 'invitation',
  ): Promise<TenantRateLimitResult> {
    let config: TenantRateLimitConfig;
    let key: string;

    switch (operation) {
      case 'creation':
        config = this.getTenantCreationRateLimitConfig();
        key = `tenant_creation:${userId}`;
        break;
      case 'joining':
        config = this.getTenantJoiningRateLimitConfig();
        key = `tenant_joining:${userId}`;
        break;
      case 'invitation':
        config = this.getInvitationAcceptanceRateLimitConfig();
        key = `invitation_acceptance:${userId}`;
        break;
    }

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
        `Failed to get tenant management rate limit status for user ${userId}, operation ${operation}:`,
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
}
