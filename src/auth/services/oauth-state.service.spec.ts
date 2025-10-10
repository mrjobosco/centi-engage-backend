import { Test, TestingModule } from '@nestjs/testing';
import { OAuthStateService } from './oauth-state.service';
import Redis from 'ioredis';

describe('OAuthStateService', () => {
  let service: OAuthStateService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    mockRedis = {
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthStateService,
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<OAuthStateService>(OAuthStateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateState', () => {
    it('should generate state without user ID', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const state = await service.generateState();

      expect(state).toBeDefined();
      expect(state).toHaveLength(64); // 32 bytes * 2 (hex)
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `oauth_state:${state}`,
        600,
        expect.stringContaining('"timestamp":'),
      );

      // Verify the stored data doesn't contain userId
      const storedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(storedData.userId).toBeUndefined();
      expect(storedData.timestamp).toBeCloseTo(Date.now(), -2); // Within 100ms
    });

    it('should generate state with user ID', async () => {
      const userId = 'user-123';
      mockRedis.setex.mockResolvedValue('OK');

      const state = await service.generateState(userId);

      expect(state).toBeDefined();
      expect(state).toHaveLength(64);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `oauth_state:${state}`,
        600,
        expect.stringContaining(`"userId":"${userId}"`),
      );

      // Verify the stored data contains userId
      const storedData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(storedData.userId).toBe(userId);
    });

    it('should throw error if Redis operation fails', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.generateState()).rejects.toThrow(
        'Failed to generate OAuth state',
      );
    });

    it('should generate unique states', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const state1 = await service.generateState();
      const state2 = await service.generateState();

      expect(state1).not.toBe(state2);
    });
  });

  describe('validateState', () => {
    const mockState = 'test-state-123';
    const mockStateData = {
      timestamp: Date.now() - 1000, // 1 second ago
      userId: undefined,
    };

    it('should return false for empty state', async () => {
      const result = await service.validateState('');
      expect(result).toBe(false);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should return false for non-existent state', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.validateState(mockState);

      expect(result).toBe(false);
      expect(mockRedis.get).toHaveBeenCalledWith(`oauth_state:${mockState}`);
    });

    it('should validate state successfully for sign-in flow', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockStateData));
      mockRedis.del.mockResolvedValue(1);

      const result = await service.validateState(mockState);

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith(`oauth_state:${mockState}`);
      expect(mockRedis.del).toHaveBeenCalledWith(`oauth_state:${mockState}`);
    });

    it('should validate state successfully for linking flow', async () => {
      const userId = 'user-123';
      const linkingStateData = {
        ...mockStateData,
        userId: userId,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(linkingStateData));
      mockRedis.del.mockResolvedValue(1);

      const result = await service.validateState(mockState, userId);

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith(`oauth_state:${mockState}`);
    });

    it('should return false for expired state', async () => {
      const expiredStateData = {
        timestamp: Date.now() - 700000, // 11+ minutes ago (expired)
        userId: undefined,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(expiredStateData));
      mockRedis.del.mockResolvedValue(1);

      const result = await service.validateState(mockState);

      expect(result).toBe(false);
      expect(mockRedis.del).toHaveBeenCalledWith(`oauth_state:${mockState}`);
    });

    it('should return false for user ID mismatch in linking flow', async () => {
      const linkingStateData = {
        ...mockStateData,
        userId: 'user-123',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(linkingStateData));
      mockRedis.del.mockResolvedValue(1);

      const result = await service.validateState(
        mockState,
        'different-user-456',
      );

      expect(result).toBe(false);
      expect(mockRedis.del).toHaveBeenCalledWith(`oauth_state:${mockState}`);
    });

    it('should return false if state contains user ID but none expected', async () => {
      const linkingStateData = {
        ...mockStateData,
        userId: 'user-123',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(linkingStateData));
      mockRedis.del.mockResolvedValue(1);

      const result = await service.validateState(mockState); // No expected user ID

      expect(result).toBe(false);
      expect(mockRedis.del).toHaveBeenCalledWith(`oauth_state:${mockState}`);
    });

    it('should return false for invalid JSON data', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await service.validateState(mockState);

      expect(result).toBe(false);
    });

    it('should return false if Redis operation fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.validateState(mockState);

      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredStates', () => {
    it('should clean up expired states', async () => {
      const mockKeys = [
        'oauth_state:state1',
        'oauth_state:state2',
        'oauth_state:state3',
      ];
      const expiredStateData = JSON.stringify({
        timestamp: Date.now() - 700000, // Expired
      });
      const validStateData = JSON.stringify({
        timestamp: Date.now() - 100000, // Valid
      });

      mockRedis.keys.mockResolvedValue(mockKeys);
      mockRedis.get
        .mockResolvedValueOnce(expiredStateData) // state1 - expired
        .mockResolvedValueOnce(validStateData) // state2 - valid
        .mockResolvedValueOnce('invalid-json'); // state3 - invalid JSON

      mockRedis.del.mockResolvedValue(1);

      const deletedCount = await service.cleanupExpiredStates();

      expect(deletedCount).toBe(2); // state1 (expired) + state3 (invalid JSON)
      expect(mockRedis.del).toHaveBeenCalledWith('oauth_state:state1');
      expect(mockRedis.del).toHaveBeenCalledWith('oauth_state:state3');
      expect(mockRedis.del).not.toHaveBeenCalledWith('oauth_state:state2');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis connection failed'));

      const deletedCount = await service.cleanupExpiredStates();

      expect(deletedCount).toBe(0);
    });

    it('should return 0 when no states exist', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const deletedCount = await service.cleanupExpiredStates();

      expect(deletedCount).toBe(0);
    });
  });

  describe('getStateInfo', () => {
    const mockState = 'test-state-123';
    const mockStateData = {
      timestamp: Date.now(),
      userId: 'user-123',
    };

    it('should return state info if exists', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockStateData));

      const result = await service.getStateInfo(mockState);

      expect(result).toEqual(mockStateData);
      expect(mockRedis.get).toHaveBeenCalledWith(`oauth_state:${mockState}`);
    });

    it('should return null if state does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.getStateInfo(mockState);

      expect(result).toBeNull();
    });

    it('should return null if Redis operation fails', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.getStateInfo(mockState);

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      mockRedis.get.mockResolvedValue('invalid-json');

      const result = await service.getStateInfo(mockState);

      expect(result).toBeNull();
    });
  });
});
