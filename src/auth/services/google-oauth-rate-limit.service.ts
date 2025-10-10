import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface GoogleOAuthRateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyPrefix: string; // Redis key prefix
}

export interface GoogleOAuthRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
  config: GoogleOAuthRateLimitConfig;
}

/**
 * Rate limiting service specifically for Google OAuth operations
 */
@Injectable()
export class GoogleOAuthRateLimitService {
  private readonly logger = new Logger(GoogleOAuthRateLimitService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Check IP-based rate limit for Google OAuth operations
   */
  async checkIpRateLimit(
    ip: string,
    operationType: string,
  ): Promise<GoogleOAuthRateLimitResult> {
    const config = this.getIpRateLimitConfig(operationType);
    return this.checkRateLimit(`ip:${ip}`, config);
  }

  /**
   * Check tenant-based rate limit for Google OAuth operations
   */
  async checkTenantRateLimit(
    tenantId: string,
    operationType: string,
  ): Promise<GoogleOAuthRateLimitResult> {
    const config = this.getTenantRateLimitConfig(operationType);
    return this.checkRateLimit(`tenant:${tenantId}`, config);
  }

  /**
   * Check user-based rate limit for Google OAuth operations (for authenticated operations)
   */
  async checkUserRateLimit(
    userId: string,
    operationType: string,
  ): Promise<GoogleOAuthRateLimitResult> {
    const config = this.getUserRateLimitConfig(operationType);
    return this.checkRateLimit(`user:${userId}`, config);
  }

  /**
   * Core rate limiting logic using sliding window
   */
  private async checkRateLimit(
    key: string,
    config: GoogleOAuthRateLimitConfig,
  ): Promise<GoogleOAuthRateLimitResult> {
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
      const requestId = `${now}-${Math.random()}`;
      pipeline.zadd(redisKey, now, requestId);

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
        await this.redis.zrem(redisKey, requestId);
      }

      const remaining = Math.max(0, limit - currentCount - (allowed ? 1 : 0));
      const resetTime = now + window;

      this.logger.debug(
        `Google OAuth rate limit check for ${key}: ${currentCount}/${limit}, allowed: ${allowed}`,
      );

      return {
        allowed,
        remaining,
        resetTime,
        totalHits: currentCount + (allowed ? 1 : 0),
        config,
      };
    } catch (error) {
      this.logger.error(
        `Google OAuth rate limiting error for key ${key}:`,
        error instanceof Error ? error.stack : error,
      );

      // Fail open - allow request if Redis is down
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
        totalHits: 1,
        config,
      };
    }
  }

  /**
   * Get IP-based rate limit configuration for different operation types
   */
  private getIpRateLimitConfig(
    operationType: string,
  ): GoogleOAuthRateLimitConfig {
    const baseConfig = {
      keyPrefix: 'google_oauth_ip_rate_limit',
    };

    switch (operationType) {
      case 'oauth_initiate':
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_INITIATE_WINDOW_MS',
            60000, // 1 minute
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_INITIATE_MAX_REQUESTS',
            10, // 10 OAuth initiations per minute per IP
          ),
          keyPrefix: `${baseConfig.keyPrefix}:initiate`,
        };

      case 'oauth_callback':
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_CALLBACK_WINDOW_MS',
            60000, // 1 minute
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_CALLBACK_MAX_REQUESTS',
            15, // 15 OAuth callbacks per minute per IP
          ),
          keyPrefix: `${baseConfig.keyPrefix}:callback`,
        };

      case 'link_initiate':
      case 'link_callback':
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_LINKING_WINDOW_MS',
            300000, // 5 minutes
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_LINKING_MAX_REQUESTS',
            5, // 5 linking attempts per 5 minutes per IP
          ),
          keyPrefix: `${baseConfig.keyPrefix}:linking`,
        };

      case 'unlink':
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_UNLINK_WINDOW_MS',
            300000, // 5 minutes
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_UNLINK_MAX_REQUESTS',
            3, // 3 unlink attempts per 5 minutes per IP
          ),
          keyPrefix: `${baseConfig.keyPrefix}:unlink`,
        };

      case 'admin_settings':
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_ADMIN_WINDOW_MS',
            60000, // 1 minute
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_ADMIN_MAX_REQUESTS',
            20, // 20 admin requests per minute per IP
          ),
          keyPrefix: `${baseConfig.keyPrefix}:admin`,
        };

      default:
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_GENERAL_WINDOW_MS',
            60000, // 1 minute
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_IP_GENERAL_MAX_REQUESTS',
            30, // 30 general requests per minute per IP
          ),
          keyPrefix: `${baseConfig.keyPrefix}:general`,
        };
    }
  }

  /**
   * Get tenant-based rate limit configuration for different operation types
   */
  private getTenantRateLimitConfig(
    operationType: string,
  ): GoogleOAuthRateLimitConfig {
    const baseConfig = {
      keyPrefix: 'google_oauth_tenant_rate_limit',
    };

    switch (operationType) {
      case 'oauth_initiate':
      case 'oauth_callback':
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_TENANT_AUTH_WINDOW_MS',
            60000, // 1 minute
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_TENANT_AUTH_MAX_REQUESTS',
            50, // 50 OAuth operations per minute per tenant
          ),
          keyPrefix: `${baseConfig.keyPrefix}:auth`,
        };

      case 'link_initiate':
      case 'link_callback':
      case 'unlink':
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_TENANT_LINKING_WINDOW_MS',
            300000, // 5 minutes
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_TENANT_LINKING_MAX_REQUESTS',
            20, // 20 linking operations per 5 minutes per tenant
          ),
          keyPrefix: `${baseConfig.keyPrefix}:linking`,
        };

      case 'admin_settings':
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_TENANT_ADMIN_WINDOW_MS',
            60000, // 1 minute
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_TENANT_ADMIN_MAX_REQUESTS',
            100, // 100 admin requests per minute per tenant
          ),
          keyPrefix: `${baseConfig.keyPrefix}:admin`,
        };

      default:
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_TENANT_GENERAL_WINDOW_MS',
            60000, // 1 minute
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_TENANT_GENERAL_MAX_REQUESTS',
            100, // 100 general requests per minute per tenant
          ),
          keyPrefix: `${baseConfig.keyPrefix}:general`,
        };
    }
  }

  /**
   * Get user-based rate limit configuration for different operation types
   */
  private getUserRateLimitConfig(
    operationType: string,
  ): GoogleOAuthRateLimitConfig {
    const baseConfig = {
      keyPrefix: 'google_oauth_user_rate_limit',
    };

    switch (operationType) {
      case 'link_initiate':
      case 'link_callback':
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_USER_LINKING_WINDOW_MS',
            900000, // 15 minutes
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_USER_LINKING_MAX_REQUESTS',
            3, // 3 linking attempts per 15 minutes per user
          ),
          keyPrefix: `${baseConfig.keyPrefix}:linking`,
        };

      case 'unlink':
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_USER_UNLINK_WINDOW_MS',
            3600000, // 1 hour
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_USER_UNLINK_MAX_REQUESTS',
            2, // 2 unlink attempts per hour per user
          ),
          keyPrefix: `${baseConfig.keyPrefix}:unlink`,
        };

      default:
        return {
          ...baseConfig,
          windowMs: this.configService.get<number>(
            'GOOGLE_OAUTH_USER_GENERAL_WINDOW_MS',
            60000, // 1 minute
          ),
          maxRequests: this.configService.get<number>(
            'GOOGLE_OAUTH_USER_GENERAL_MAX_REQUESTS',
            10, // 10 general requests per minute per user
          ),
          keyPrefix: `${baseConfig.keyPrefix}:general`,
        };
    }
  }

  /**
   * Reset rate limit for a specific key and operation type
   */
  async resetRateLimit(
    key: string,
    operationType: string,
    limitType: 'ip' | 'tenant' | 'user' = 'ip',
  ): Promise<void> {
    try {
      let config: GoogleOAuthRateLimitConfig;
      let fullKey: string;

      switch (limitType) {
        case 'ip':
          config = this.getIpRateLimitConfig(operationType);
          fullKey = `ip:${key}`;
          break;
        case 'tenant':
          config = this.getTenantRateLimitConfig(operationType);
          fullKey = `tenant:${key}`;
          break;
        case 'user':
          config = this.getUserRateLimitConfig(operationType);
          fullKey = `user:${key}`;
          break;
      }

      const redisKey = `${config.keyPrefix}:${fullKey}`;
      await this.redis.del(redisKey);

      this.logger.debug(`Google OAuth rate limit reset for key: ${redisKey}`);
    } catch (error) {
      this.logger.error(
        `Failed to reset Google OAuth rate limit for key ${key}:`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(
    key: string,
    operationType: string,
    limitType: 'ip' | 'tenant' | 'user' = 'ip',
  ): Promise<GoogleOAuthRateLimitResult> {
    let config: GoogleOAuthRateLimitConfig;
    let fullKey: string;

    switch (limitType) {
      case 'ip':
        config = this.getIpRateLimitConfig(operationType);
        fullKey = `ip:${key}`;
        break;
      case 'tenant':
        config = this.getTenantRateLimitConfig(operationType);
        fullKey = `tenant:${key}`;
        break;
      case 'user':
        config = this.getUserRateLimitConfig(operationType);
        fullKey = `user:${key}`;
        break;
    }

    const now = Date.now();
    const window = config.windowMs;
    const limit = config.maxRequests;
    const redisKey = `${config.keyPrefix}:${fullKey}`;

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
        config,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get Google OAuth rate limit status for key ${key}:`,
        error instanceof Error ? error.stack : error,
      );

      // Return default values on error
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: now + window,
        totalHits: 0,
        config,
      };
    }
  }
}
