import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthRateLimitService } from './google-oauth-rate-limit.service';

describe('GoogleOAuthRateLimitService', () => {
  let service: GoogleOAuthRateLimitService;
  let mockRedis: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockRedis = {
      pipeline: jest.fn(() => ({
        zremrangebyscore: jest.fn(),
        zcard: jest.fn(),
        zadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn(),
      })),
      zrem: jest.fn(),
      del: jest.fn(),
      zremrangebyscore: jest.fn(),
      zcard: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue: any) => defaultValue),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthRateLimitService,
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

    service = module.get<GoogleOAuthRateLimitService>(
      GoogleOAuthRateLimitService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkIpRateLimit', () => {
    it('should allow request when under limit', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], // zremrangebyscore result
          [null, 5], // zcard result (current count)
          [null, 1], // zadd result
          [null, 1], // expire result
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.checkIpRateLimit(
        '192.168.1.1',
        'oauth_initiate',
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 5 - 1 = 4
      expect(result.totalHits).toBe(6); // 5 + 1
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should deny request when over limit', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], // zremrangebyscore result
          [null, 10], // zcard result (current count at limit)
          [null, 1], // zadd result
          [null, 1], // expire result
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline);
      mockRedis.zrem.mockResolvedValue(1);

      const result = await service.checkIpRateLimit(
        '192.168.1.1',
        'oauth_initiate',
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.totalHits).toBe(10);
      expect(mockRedis.zrem).toHaveBeenCalled();
    });

    it('should fail open when Redis fails', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis error')),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.checkIpRateLimit(
        '192.168.1.1',
        'oauth_initiate',
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // maxRequests - 1
      expect(result.totalHits).toBe(1);
    });
  });

  describe('checkTenantRateLimit', () => {
    it('should check tenant rate limit with correct configuration', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 25], // Current count
          [null, 1],
          [null, 1],
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.checkTenantRateLimit(
        'tenant-123',
        'oauth_callback',
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(24); // 50 - 25 - 1 = 24
      expect(result.config.keyPrefix).toContain('tenant_rate_limit');
    });
  });

  describe('checkUserRateLimit', () => {
    it('should check user rate limit for linking operations', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 1], // Current count
          [null, 1],
          [null, 1],
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline);

      const result = await service.checkUserRateLimit(
        'user-123',
        'link_initiate',
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // 3 - 1 - 1 = 1
      expect(result.config.maxRequests).toBe(3); // Default for linking
    });

    it('should deny user linking when at limit', async () => {
      const mockPipeline = {
        zremrangebyscore: jest.fn().mockReturnThis(),
        zcard: jest.fn().mockReturnThis(),
        zadd: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 0],
          [null, 3], // At limit
          [null, 1],
          [null, 1],
        ]),
      };

      mockRedis.pipeline.mockReturnValue(mockPipeline);
      mockRedis.zrem.mockResolvedValue(1);

      const result = await service.checkUserRateLimit(
        'user-123',
        'link_initiate',
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset IP rate limit', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.resetRateLimit('192.168.1.1', 'oauth_initiate', 'ip');

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(
          'google_oauth_ip_rate_limit:initiate:ip:192.168.1.1',
        ),
      );
    });

    it('should reset tenant rate limit', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.resetRateLimit('tenant-123', 'oauth_callback', 'tenant');

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(
          'google_oauth_tenant_rate_limit:auth:tenant:tenant-123',
        ),
      );
    });

    it('should reset user rate limit', async () => {
      mockRedis.del.mockResolvedValue(1);

      await service.resetRateLimit('user-123', 'link_initiate', 'user');

      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(
          'google_oauth_user_rate_limit:linking:user:user-123',
        ),
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        service.resetRateLimit('192.168.1.1', 'oauth_initiate', 'ip'),
      ).resolves.not.toThrow();
    });
  });

  describe('getRateLimitStatus', () => {
    it('should get current status without incrementing', async () => {
      mockRedis.zremrangebyscore.mockResolvedValue(0);
      mockRedis.zcard.mockResolvedValue(5);

      const result = await service.getRateLimitStatus(
        '192.168.1.1',
        'oauth_initiate',
        'ip',
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // 10 - 5
      expect(result.totalHits).toBe(5);
      expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
      expect(mockRedis.zcard).toHaveBeenCalled();
    });

    it('should handle Redis errors in status check', async () => {
      mockRedis.zremrangebyscore.mockRejectedValue(new Error('Redis error'));

      const result = await service.getRateLimitStatus(
        '192.168.1.1',
        'oauth_initiate',
        'ip',
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // Default fallback
      expect(result.totalHits).toBe(0);
    });
  });

  describe('configuration methods', () => {
    it('should return correct IP rate limit config for different operations', () => {
      const initiateConfig = (service as any).getIpRateLimitConfig(
        'oauth_initiate',
      );
      const callbackConfig = (service as any).getIpRateLimitConfig(
        'oauth_callback',
      );
      const linkingConfig = (service as any).getIpRateLimitConfig(
        'link_initiate',
      );
      const unlinkConfig = (service as any).getIpRateLimitConfig('unlink');
      const adminConfig = (service as any).getIpRateLimitConfig(
        'admin_settings',
      );
      const generalConfig = (service as any).getIpRateLimitConfig('unknown');

      expect(initiateConfig.maxRequests).toBe(10);
      expect(callbackConfig.maxRequests).toBe(15);
      expect(linkingConfig.maxRequests).toBe(5);
      expect(unlinkConfig.maxRequests).toBe(3);
      expect(adminConfig.maxRequests).toBe(20);
      expect(generalConfig.maxRequests).toBe(30);

      expect(initiateConfig.keyPrefix).toContain('initiate');
      expect(callbackConfig.keyPrefix).toContain('callback');
      expect(linkingConfig.keyPrefix).toContain('linking');
      expect(unlinkConfig.keyPrefix).toContain('unlink');
      expect(adminConfig.keyPrefix).toContain('admin');
      expect(generalConfig.keyPrefix).toContain('general');
    });

    it('should return correct tenant rate limit config for different operations', () => {
      const authConfig = (service as any).getTenantRateLimitConfig(
        'oauth_initiate',
      );
      const linkingConfig = (service as any).getTenantRateLimitConfig(
        'link_initiate',
      );
      const adminConfig = (service as any).getTenantRateLimitConfig(
        'admin_settings',
      );
      const generalConfig = (service as any).getTenantRateLimitConfig(
        'unknown',
      );

      expect(authConfig.maxRequests).toBe(50);
      expect(linkingConfig.maxRequests).toBe(20);
      expect(adminConfig.maxRequests).toBe(100);
      expect(generalConfig.maxRequests).toBe(100);
    });

    it('should return correct user rate limit config for different operations', () => {
      const linkingConfig = (service as any).getUserRateLimitConfig(
        'link_initiate',
      );
      const unlinkConfig = (service as any).getUserRateLimitConfig('unlink');
      const generalConfig = (service as any).getUserRateLimitConfig('unknown');

      expect(linkingConfig.maxRequests).toBe(3);
      expect(linkingConfig.windowMs).toBe(900000); // 15 minutes
      expect(unlinkConfig.maxRequests).toBe(2);
      expect(unlinkConfig.windowMs).toBe(3600000); // 1 hour
      expect(generalConfig.maxRequests).toBe(10);
    });
  });
});
