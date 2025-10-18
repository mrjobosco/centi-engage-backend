import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface OTPRecord {
  otp: string;
  email: string;
  attempts: number;
  createdAt: string;
}

export interface RateLimitRecord {
  attempts: number;
  windowStart: string;
}

@Injectable()
export class OTPStorageService {
  private readonly logger = new Logger(OTPStorageService.name);
  private readonly otpTTL: number;
  private readonly rateLimitWindowMs: number;
  private readonly maxRateLimitAttempts: number;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.otpTTL =
      (this.configService.get<number>('config.otp.expirationMinutes') ?? 30) *
      60; // Convert to seconds
    this.rateLimitWindowMs =
      this.configService.get<number>('config.otp.rateLimitWindowMs') ?? 3600000;
    this.maxRateLimitAttempts =
      this.configService.get<number>('config.otp.rateLimitAttempts') ?? 3;
  }

  /**
   * Store OTP in Redis with TTL
   */
  async storeOTP(userId: string, otp: string, email: string): Promise<void> {
    try {
      const otpRecord: OTPRecord = {
        otp,
        email,
        attempts: 0,
        createdAt: new Date().toISOString(),
      };

      const key = this.getOTPKey(userId);
      await this.redis.setex(key, this.otpTTL, JSON.stringify(otpRecord));

      this.logger.log(`OTP stored for user ${userId} with TTL ${this.otpTTL}s`);
    } catch (error) {
      this.logger.error(`Failed to store OTP for user ${userId}:`, error);
      throw new Error('Failed to store OTP');
    }
  }

  /**
   * Retrieve OTP record from Redis
   */
  async getOTP(userId: string): Promise<OTPRecord | null> {
    try {
      const key = this.getOTPKey(userId);
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as OTPRecord;
    } catch (error) {
      this.logger.error(`Failed to retrieve OTP for user ${userId}:`, error);
      throw new Error('Failed to retrieve OTP');
    }
  }

  /**
   * Delete OTP from Redis
   */
  async deleteOTP(userId: string): Promise<void> {
    try {
      const key = this.getOTPKey(userId);
      await this.redis.del(key);

      this.logger.log(`OTP deleted for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete OTP for user ${userId}:`, error);
      throw new Error('Failed to delete OTP');
    }
  }

  /**
   * Get remaining TTL for OTP in seconds
   */
  async getRemainingTTL(userId: string): Promise<number> {
    try {
      const key = this.getOTPKey(userId);
      const ttl = await this.redis.ttl(key);

      // TTL returns -1 if key exists but has no expiration, -2 if key doesn't exist
      return ttl > 0 ? ttl : 0;
    } catch (error) {
      this.logger.error(`Failed to get TTL for user ${userId}:`, error);
      throw new Error('Failed to get OTP TTL');
    }
  }

  /**
   * Increment verification attempts for an OTP
   */
  async incrementAttempts(userId: string): Promise<number> {
    try {
      const otpRecord = await this.getOTP(userId);
      if (!otpRecord) {
        throw new Error('OTP not found');
      }

      otpRecord.attempts += 1;

      const key = this.getOTPKey(userId);
      const ttl = await this.getRemainingTTL(userId);

      if (ttl > 0) {
        await this.redis.setex(key, ttl, JSON.stringify(otpRecord));
      }

      return otpRecord.attempts;
    } catch (error) {
      this.logger.error(
        `Failed to increment attempts for user ${userId}:`,
        error,
      );
      throw new Error('Failed to increment OTP attempts');
    }
  }

  /**
   * Check if user has exceeded rate limit for OTP generation
   */
  async checkRateLimit(
    userId: string,
  ): Promise<{ allowed: boolean; retryAfter?: number }> {
    try {
      const key = this.getRateLimitKey(userId);
      const data = await this.redis.get(key);

      const now = Date.now();

      if (!data) {
        // No previous attempts, allow and create new record
        const rateLimitRecord: RateLimitRecord = {
          attempts: 1,
          windowStart: new Date(now).toISOString(),
        };

        const windowTTL = Math.ceil(this.rateLimitWindowMs / 1000);
        await this.redis.setex(key, windowTTL, JSON.stringify(rateLimitRecord));

        return { allowed: true };
      }

      const rateLimitRecord: RateLimitRecord = JSON.parse(data);
      const windowStart = new Date(rateLimitRecord.windowStart).getTime();
      const windowEnd = windowStart + this.rateLimitWindowMs;

      if (now > windowEnd) {
        // Window has expired, reset counter
        const newRateLimitRecord: RateLimitRecord = {
          attempts: 1,
          windowStart: new Date(now).toISOString(),
        };

        const windowTTL = Math.ceil(this.rateLimitWindowMs / 1000);
        await this.redis.setex(
          key,
          windowTTL,
          JSON.stringify(newRateLimitRecord),
        );

        return { allowed: true };
      }

      if (rateLimitRecord.attempts >= this.maxRateLimitAttempts) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((windowEnd - now) / 1000);
        return { allowed: false, retryAfter };
      }

      // Increment attempts within current window
      rateLimitRecord.attempts += 1;
      const remainingTTL = Math.ceil((windowEnd - now) / 1000);
      await this.redis.setex(
        key,
        remainingTTL,
        JSON.stringify(rateLimitRecord),
      );

      return { allowed: true };
    } catch (error) {
      this.logger.error(
        `Failed to check rate limit for user ${userId}:`,
        error,
      );
      throw new Error('Failed to check rate limit');
    }
  }

  /**
   * Clear rate limit for a user (useful for testing or admin override)
   */
  async clearRateLimit(userId: string): Promise<void> {
    try {
      const key = this.getRateLimitKey(userId);
      await this.redis.del(key);

      this.logger.log(`Rate limit cleared for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to clear rate limit for user ${userId}:`,
        error,
      );
      throw new Error('Failed to clear rate limit');
    }
  }

  /**
   * Check Redis connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  private getOTPKey(userId: string): string {
    return `otp:${userId}`;
  }

  private getRateLimitKey(userId: string): string {
    return `otp_rate_limit:${userId}`;
  }
}
