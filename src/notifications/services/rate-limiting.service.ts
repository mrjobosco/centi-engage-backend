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

@Injectable()
export class RateLimitingService {
  private readonly logger = new Logger(RateLimitingService.name);

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
        `Rate limit check for ${key}: ${currentCount}/${limit}, allowed: ${allowed}`,
      );

      return {
        allowed,
        remaining,
        resetTime,
        totalHits: currentCount + (allowed ? 1 : 0),
      };
    } catch (error) {
      this.logger.error(
        `Rate limiting error for key ${key}:`,
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
   * Get tenant-specific rate limit configuration
   */
  getTenantRateLimitConfig(tenantId: string): RateLimitConfig {
    return {
      windowMs: this.configService.get<number>(
        'TENANT_RATE_LIMIT_WINDOW_MS',
        60000, // 1 minute
      ),
      maxRequests: this.configService.get<number>(
        'TENANT_RATE_LIMIT_MAX_REQUESTS',
        100, // 100 requests per minute
      ),
      keyPrefix: `tenant_rate_limit:${tenantId}`,
    };
  }

  /**
   * Get user-specific rate limit configuration
   */
  getUserRateLimitConfig(userId: string): RateLimitConfig {
    return {
      windowMs: this.configService.get<number>(
        'USER_RATE_LIMIT_WINDOW_MS',
        60000, // 1 minute
      ),
      maxRequests: this.configService.get<number>(
        'USER_RATE_LIMIT_MAX_REQUESTS',
        50, // 50 requests per minute
      ),
      keyPrefix: `user_rate_limit:${userId}`,
    };
  }

  /**
   * Get notification-specific rate limit configuration
   */
  getNotificationRateLimitConfig(
    userId: string,
    category: string,
  ): RateLimitConfig {
    return {
      windowMs: this.configService.get<number>(
        'NOTIFICATION_RATE_LIMIT_WINDOW_MS',
        3600000, // 1 hour
      ),
      maxRequests: this.configService.get<number>(
        'NOTIFICATION_RATE_LIMIT_MAX_REQUESTS',
        10, // 10 notifications per hour per category
      ),
      keyPrefix: `notification_rate_limit:${userId}:${category}`,
    };
  }

  /**
   * Reset rate limit for a specific key
   */
  async resetRateLimit(key: string, keyPrefix: string): Promise<void> {
    try {
      const redisKey = `${keyPrefix}:${key}`;
      await this.redis.del(redisKey);
      this.logger.debug(`Rate limit reset for key: ${redisKey}`);
    } catch (error) {
      this.logger.error(
        `Failed to reset rate limit for key ${key}:`,
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
        `Failed to get rate limit status for key ${key}:`,
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
