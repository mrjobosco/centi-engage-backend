import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRedisToken } from '@nestjs-modules/ioredis';
import { TenantManagementRateLimitService } from './tenant-management-rate-limit.service';

describe('TenantManagementRateLimitService', () => {
  let service: TenantManagementRateLimitService;
  let mockRedis: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockRedis = {
      pipeline: jest.fn().mockReturnValue({
        zremrangebyscore: jest.fn(),
        zcard: jest.fn(),
        zadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], // zremrangebyscore result
          [null, 2], // zcard result (current count)
          [null, 1], // zadd result
          [null, 1], // expire result
        ]),
      }),
      zrem: jest.fn(),
      del: jest.fn(),
      zremrangebyscore: jest.fn(),
      zcard: jest.fn().mockResolvedValue(2),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultValue: any) => {
        const config = {
          TENANT_CREATION_RATE_LIMIT_WINDOW_MS: 3600000,
          TENANT_CREATION_RATE_LIMIT_MAX_REQUESTS: 3,
          TENANT_JOINING_RATE_LIMIT_WINDOW_MS: 3600000,
          TENANT_JOINING_RATE_LIMIT_MAX_REQUESTS: 10,
          INVITATION_ACCEPTANCE_RATE_LIMIT_WINDOW_MS: 3600000,
          INVITATION_ACCEPTANCE_RATE_LIMIT_MAX_REQUESTS: 10,
        };
        return config[key] || defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantManagementRateLimitService,
        {
          provide: getRedisToken(),
          useValue: mockRedis,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TenantManagementRateLimitService>(
      TenantManagementRateLimitService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkTenantCreationRateLimit', () => {
    it('should allow request when under rate limit', async () => {
      const userId = 'user-123';
      const result = await service.checkTenantCreationRateLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // 3 - 2 - 1 = 0
      expect(result.totalHits).toBe(3);
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it('should deny request when over rate limit', async () => {
      // Mock higher current count
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: jest.fn(),
        zcard: jest.fn(),
        zadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockResolvedValue([
          [null, 0], // zremrangebyscore result
          [null, 3], // zcard result (at limit)
          [null, 1], // zadd result
          [null, 1], // expire result
        ]),
      });

      const userId = 'user-123';
      const result = await service.checkTenantCreationRateLimit(userId);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(mockRedis.zrem).toHaveBeenCalled();
    });
  });

  describe('checkTenantJoiningRateLimit', () => {
    it('should allow request when under rate limit', async () => {
      const userId = 'user-123';
      const result = await service.checkTenantJoiningRateLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(7); // 10 - 2 - 1 = 7
      expect(result.totalHits).toBe(3);
    });
  });

  describe('checkInvitationAcceptanceRateLimit', () => {
    it('should allow request when under rate limit', async () => {
      const userId = 'user-123';
      const result = await service.checkInvitationAcceptanceRateLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(7); // 10 - 2 - 1 = 7
      expect(result.totalHits).toBe(3);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for tenant creation', async () => {
      const userId = 'user-123';
      await service.resetRateLimit(userId, 'creation');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'tenant_management_rate_limit:tenant_creation:user-123',
      );
    });

    it('should reset rate limit for tenant joining', async () => {
      const userId = 'user-123';
      await service.resetRateLimit(userId, 'joining');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'tenant_management_rate_limit:tenant_joining:user-123',
      );
    });

    it('should reset rate limit for invitation acceptance', async () => {
      const userId = 'user-123';
      await service.resetRateLimit(userId, 'invitation');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'tenant_management_rate_limit:invitation_acceptance:user-123',
      );
    });
  });

  describe('getRateLimitStatus', () => {
    it('should get status for tenant creation', async () => {
      const userId = 'user-123';
      const result = await service.getRateLimitStatus(userId, 'creation');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1); // 3 - 2 = 1
      expect(result.totalHits).toBe(2);
    });

    it('should get status for tenant joining', async () => {
      const userId = 'user-123';
      const result = await service.getRateLimitStatus(userId, 'joining');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(8); // 10 - 2 = 8
      expect(result.totalHits).toBe(2);
    });

    it('should get status for invitation acceptance', async () => {
      const userId = 'user-123';
      const result = await service.getRateLimitStatus(userId, 'invitation');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(8); // 10 - 2 = 8
      expect(result.totalHits).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should fail open when Redis is unavailable', async () => {
      mockRedis.pipeline.mockReturnValue({
        zremrangebyscore: jest.fn(),
        zcard: jest.fn(),
        zadd: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      });

      const userId = 'user-123';
      const result = await service.checkTenantCreationRateLimit(userId);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // maxRequests - 1
      expect(result.totalHits).toBe(1);
    });
  });
});
