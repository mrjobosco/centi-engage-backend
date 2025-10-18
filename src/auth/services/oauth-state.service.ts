import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as crypto from 'crypto';

interface StateData {
  timestamp: number;
  userId?: string;
  tenantId?: string;
}

@Injectable()
export class OAuthStateService {
  private readonly logger = new Logger(OAuthStateService.name);
  private readonly STATE_PREFIX = 'oauth_state';
  private readonly STATE_EXPIRATION = 600; // 10 minutes in seconds

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Generate a cryptographically secure state parameter
   * @param userId - Optional user ID for linking flows
   * @returns Generated state string
   */
  async generateState(userId?: string, tenantId?: string): Promise<string> {
    try {
      // Generate cryptographically secure random state
      const state = crypto.randomBytes(32).toString('hex');

      const stateData: StateData = {
        timestamp: Date.now(),
        userId: userId || undefined,
        tenantId: tenantId || undefined,
      };

      // Store state in Redis with expiration
      const redisKey = `${this.STATE_PREFIX}:${state}`;
      await this.redis.setex(
        redisKey,
        this.STATE_EXPIRATION,
        JSON.stringify(stateData),
      );

      this.logger.debug(
        `Generated OAuth state: ${state}${userId ? ` for user: ${userId}` : ''}`,
      );

      return state;
    } catch (error) {
      this.logger.error(
        `Failed to generate OAuth state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new Error('Failed to generate OAuth state');
    }
  }

  /**
   * Validate state parameter and clean up
   * @param state - State parameter to validate
   * @param expectedUserId - Expected user ID for linking flows
   * @returns StateData if state is valid
   */
  async validateState(
    state: string,
    expectedUserId?: string,
  ): Promise<StateData | null> {
    if (!state) {
      this.logger.warn('Empty state parameter provided');
      return null;
    }

    try {
      const redisKey = `${this.STATE_PREFIX}:${state}`;
      const stateDataStr = await this.redis.get(redisKey);

      if (!stateDataStr) {
        this.logger.warn(`State not found or expired: ${state}`);
        return null;
      }

      const stateData: StateData = JSON.parse(stateDataStr);

      // Check if state is expired (additional check beyond Redis expiration)
      const now = Date.now();
      const stateAge = now - stateData.timestamp;
      if (stateAge > this.STATE_EXPIRATION * 1000) {
        this.logger.warn(`State expired: ${state}, age: ${stateAge}ms`);
        await this.redis.del(redisKey);
        return null;
      }

      // For linking flow, validate user ID matches
      if (expectedUserId && stateData.userId !== expectedUserId) {
        this.logger.warn(
          `State user ID mismatch. Expected: ${expectedUserId}, Got: ${stateData.userId}`,
        );
        await this.redis.del(redisKey);
        return null;
      }

      // For sign-in flow, ensure no user ID is stored
      if (!expectedUserId && stateData.userId) {
        this.logger.warn(
          `State contains user ID but none expected: ${stateData.userId}`,
        );
        await this.redis.del(redisKey);
        return null;
      }

      // Clean up used state (one-time use)
      await this.redis.del(redisKey);

      this.logger.debug(`State validated successfully: ${state}`);
      return stateData;
    } catch (error) {
      this.logger.error(
        `Failed to validate state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }

  /**
   * Clean up expired states (maintenance method)
   * This is handled automatically by Redis expiration, but can be called manually
   */
  async cleanupExpiredStates(): Promise<number> {
    try {
      const pattern = `${this.STATE_PREFIX}:*`;
      const keys = await this.redis.keys(pattern);

      let deletedCount = 0;
      const now = Date.now();

      for (const key of keys) {
        try {
          const stateDataStr = await this.redis.get(key);
          if (stateDataStr) {
            const stateData: StateData = JSON.parse(stateDataStr);
            const stateAge = now - stateData.timestamp;

            if (stateAge > this.STATE_EXPIRATION * 1000) {
              await this.redis.del(key);
              deletedCount++;
            }
          }
        } catch {
          // If we can't parse the state data, delete it
          await this.redis.del(key);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        this.logger.debug(`Cleaned up ${deletedCount} expired OAuth states`);
      }

      return deletedCount;
    } catch (error) {
      this.logger.error(
        `Failed to cleanup expired states: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return 0;
    }
  }

  /**
   * Get state information (for debugging/monitoring)
   * @param state - State to inspect
   * @returns State data if exists
   */
  async getStateInfo(state: string): Promise<StateData | null> {
    try {
      const redisKey = `${this.STATE_PREFIX}:${state}`;
      const stateDataStr = await this.redis.get(redisKey);

      if (!stateDataStr) {
        return null;
      }

      return JSON.parse(stateDataStr);
    } catch (error) {
      this.logger.error(
        `Failed to get state info: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return null;
    }
  }
}
