import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
// Using string token for Redis injection
import { InvitationRateLimitService } from './invitation-rate-limit.service';
import Redis from 'ioredis';

describe('InvitationRateLimitService', () => {
  let service: InvitationRateLimitService;
  let redis: jest.Mocked<Redis>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockRedis = {
      pipeline: jest.fn(),
      zremrangebyscore: jest.fn(),
      zcard: jest.fn(),
      zadd: jest.fn(),
      expire: jest.fn(),
      zrem: jest.fn(),
      del: jest.fn(),
      exec: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationRateLimitService,
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<InvitationRateLimitService>(
      InvitationRateLimitService,
    );
    redis = module.get('default_IORedisModuleConnectionToken');
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkRateLimit', () => {
    it('should allow request when under rate limit', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1], // zremrangebyscore result
          [null, 5], // zcard result (current count)
          [null, 1], // zadd result
          [null, 1], // expire result
        ]),
      };

      redis.pipeline.mockReturnValue(mockPipeline as any);

      const config = {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test',
      };

      const result = await service.checkRateLimit('test-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 5 - 1 = 4
      expect(result.totalHits).toBe(6); // 5 + 1 = 6
      expect(mockPipeline.zremrangebyscore).toHaveBeenCalled();
      expect(mockPipeline.zcard).toHaveBeenCalled();
      expect(mockPipeline.zadd).toHaveBeenCalled();
      expect(mockPipeline.expire).toHaveBeenCalled();
    });

    it('should deny request when over rate limit', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1], // zremrangebyscore result
          [null, 10], // zcard result (current count at limit)
          [null, 1], // zadd result
          [null, 1], // expire result
        ]),
      };

      redis.pipeline.mockReturnValue(mockPipeline as any);
      redis.zrem.mockResolvedValue(1);

      const config = {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test',
      };

      const result = await service.checkRateLimit('test-key', config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.totalHits).toBe(10);
      expect(redis.zrem).toHaveBeenCalled(); // Should remove the added request
    });

    it('should fail open when Redis is unavailable', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      };

      redis.pipeline.mockReturnValue(mockPipeline as any);

      const config = {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test',
      };

      const result = await service.checkRateLimit('test-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.totalHits).toBe(1);
    });

    it('should handle pipeline execution errors', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          ['Error: Redis error', null], // Error in first operation
          [null, 5],
          [null, 1],
          [null, 1],
        ]),
      };

      redis.pipeline.mockReturnValue(mockPipeline as any);

      const config = {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test',
      };

      const result = await service.checkRateLimit('test-key', config);

      expect(result.allowed).toBe(true); // Should fail open
    });
  });

  describe('configuration methods', () => {
    it('should return tenant invitation rate limit config', () => {
      configService.get
        .mockReturnValueOnce(86400000) // windowMs
        .mockReturnValueOnce(100); // maxRequests

      const config = service.getTenantInvitationRateLimitConfig();

      expect(config).toEqual({
        windowMs: 86400000,
        maxRequests: 100,
        keyPrefix: 'invitation_tenant_rate_limit',
      });
    });

    it('should return admin invitation rate limit config', () => {
      configService.get
        .mockReturnValueOnce(3600000) // windowMs
        .mockReturnValueOnce(20); // maxRequests

      const config = service.getAdminInvitationRateLimitConfig();

      expect(config).toEqual({
        windowMs: 3600000,
        maxRequests: 20,
        keyPrefix: 'invitation_admin_rate_limit',
      });
    });

    it('should return IP invitation rate limit config', () => {
      configService.get
        .mockReturnValueOnce(3600000) // windowMs
        .mockReturnValueOnce(10); // maxRequests

      const config = service.getIpInvitationRateLimitConfig();

      expect(config).toEqual({
        windowMs: 3600000,
        maxRequests: 10,
        keyPrefix: 'invitation_ip_rate_limit',
      });
    });

    it('should return email invitation rate limit config', () => {
      configService.get
        .mockReturnValueOnce(86400000) // windowMs
        .mockReturnValueOnce(3); // maxRequests

      const config = service.getEmailInvitationRateLimitConfig();

      expect(config).toEqual({
        windowMs: 86400000,
        maxRequests: 3,
        keyPrefix: 'invitation_email_rate_limit',
      });
    });

    it('should use default values when config is not provided', () => {
      // Mock to return undefined for all config calls, which should trigger defaults
      configService.get.mockImplementation(
        (key: string, defaultValue?: any) => defaultValue,
      );

      const tenantConfig = service.getTenantInvitationRateLimitConfig();
      const adminConfig = service.getAdminInvitationRateLimitConfig();
      const ipConfig = service.getIpInvitationRateLimitConfig();
      const emailConfig = service.getEmailInvitationRateLimitConfig();

      expect(tenantConfig.windowMs).toBe(24 * 60 * 60 * 1000);
      expect(tenantConfig.maxRequests).toBe(100);
      expect(adminConfig.windowMs).toBe(60 * 60 * 1000);
      expect(adminConfig.maxRequests).toBe(20);
      expect(ipConfig.windowMs).toBe(60 * 60 * 1000);
      expect(ipConfig.maxRequests).toBe(10);
      expect(emailConfig.windowMs).toBe(24 * 60 * 60 * 1000);
      expect(emailConfig.maxRequests).toBe(3);
    });
  });

  describe('checkEmailRateLimit', () => {
    it('should check rate limit for email address', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
        ]),
      };

      redis.pipeline.mockReturnValue(mockPipeline as any);
      configService.get.mockReturnValueOnce(86400000).mockReturnValueOnce(3);

      const result = await service.checkEmailRateLimit('test@example.com');

      expect(result.allowed).toBe(true);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
          [null, 1],
          [null, 1],
        ]),
      };

      redis.pipeline.mockReturnValue(mockPipeline as any);
      configService.get.mockReturnValueOnce(86400000).mockReturnValueOnce(3);

      await service.checkEmailRateLimit('TEST@EXAMPLE.COM');

      // Verify the key used is lowercase
      expect(mockPipeline.zadd).toHaveBeenCalledWith(
        expect.stringContaining('invitation_email_rate_limit:test@example.com'),
        expect.any(Number),
        expect.any(String),
      );
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for a key', async () => {
      redis.del.mockResolvedValue(1);

      const config = {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test',
      };

      await service.resetRateLimit('test-key', config);

      expect(redis.del).toHaveBeenCalledWith('test:test-key');
    });

    it('should handle Redis errors gracefully', async () => {
      redis.del.mockRejectedValue(new Error('Redis error'));

      const config = {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test',
      };

      // Should not throw
      await expect(
        service.resetRateLimit('test-key', config),
      ).resolves.toBeUndefined();
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return current rate limit status', async () => {
      redis.zremrangebyscore.mockResolvedValue(1);
      redis.zcard.mockResolvedValue(5);

      const config = {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test',
      };

      const result = await service.getRateLimitStatus('test-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.totalHits).toBe(5);
    });

    it('should handle Redis errors in status check', async () => {
      redis.zremrangebyscore.mockRejectedValue(new Error('Redis error'));

      const config = {
        windowMs: 60000,
        maxRequests: 10,
        keyPrefix: 'test',
      };

      const result = await service.getRateLimitStatus('test-key', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.totalHits).toBe(0);
    });
  });

  describe('getTenantRateLimitStatus', () => {
    it('should return comprehensive tenant rate limit status', async () => {
      redis.zremrangebyscore.mockResolvedValue(1);
      redis.zcard.mockResolvedValue(5);
      configService.get.mockReturnValueOnce(86400000).mockReturnValueOnce(100);

      const result = await service.getTenantRateLimitStatus('tenant-1');

      expect(result.tenant.allowed).toBe(true);
      expect(result.tenant.remaining).toBe(95);
      expect(result.tenant.totalHits).toBe(5);
    });
  });

  describe('getAdminRateLimitStatus', () => {
    it('should return comprehensive admin rate limit status', async () => {
      redis.zremrangebyscore.mockResolvedValue(1);
      redis.zcard.mockResolvedValue(3);
      configService.get.mockReturnValueOnce(3600000).mockReturnValueOnce(20);

      const result = await service.getAdminRateLimitStatus('user-1');

      expect(result.admin.allowed).toBe(true);
      expect(result.admin.remaining).toBe(17);
      expect(result.admin.totalHits).toBe(3);
    });
  });
});
