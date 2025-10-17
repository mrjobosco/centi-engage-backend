import { Test, TestingModule } from '@nestjs/testing';
import { GoogleAuthMetricsService } from './google-auth-metrics.service';

describe('GoogleAuthMetricsService', () => {
  let service: GoogleAuthMetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleAuthMetricsService],
    }).compile();

    service = module.get<GoogleAuthMetricsService>(GoogleAuthMetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordSignInAttempt', () => {
    it('should not throw error when metrics are not available', () => {
      expect(() =>
        service.recordSignInAttempt('tenant-123', 'signin'),
      ).not.toThrow();
    });
  });

  describe('recordSignInSuccess', () => {
    it('should not throw error when metrics are not available', () => {
      expect(() =>
        service.recordSignInSuccess('tenant-123', 'callback', 'new'),
      ).not.toThrow();
    });
  });

  describe('recordSignInFailure', () => {
    it('should not throw error when metrics are not available', () => {
      expect(() =>
        service.recordSignInFailure(
          'tenant-123',
          'callback',
          'invalid_token',
          'OAUTH_001',
        ),
      ).not.toThrow();
    });

    it('should handle missing error code', () => {
      expect(() =>
        service.recordSignInFailure('tenant-123', 'signin', 'network_error'),
      ).not.toThrow();
    });
  });

  describe('recordLinkingAttempt', () => {
    it('should not throw error when metrics are not available', () => {
      expect(() =>
        service.recordLinkingAttempt('tenant-123', 'user-456', 'link'),
      ).not.toThrow();
    });
  });

  describe('recordLinkingSuccess', () => {
    it('should not throw error when metrics are not available', () => {
      expect(() =>
        service.recordLinkingSuccess('tenant-123', 'user-456', 'unlink'),
      ).not.toThrow();
    });
  });

  describe('recordLinkingFailure', () => {
    it('should not throw error when metrics are not available', () => {
      expect(() =>
        service.recordLinkingFailure(
          'tenant-123',
          'user-456',
          'link',
          'email_mismatch',
          'LINK_001',
        ),
      ).not.toThrow();
    });
  });

  describe('recordOAuthCallbackLatency', () => {
    it('should not throw error when metrics are not available', () => {
      expect(() =>
        service.recordOAuthCallbackLatency('tenant-123', 1.5, true),
      ).not.toThrow();
    });

    it('should handle error status', () => {
      expect(() =>
        service.recordOAuthCallbackLatency('tenant-123', 0.5, false),
      ).not.toThrow();
    });
  });

  describe('recordTenantLookupLatency', () => {
    it('should not throw error when metrics are not available', () => {
      expect(() =>
        service.recordTenantLookupLatency('tenant-123', 0.1, true),
      ).not.toThrow();
    });
  });

  describe('updateActiveGoogleSessions', () => {
    it('should not throw error when metrics are not available', () => {
      expect(() =>
        service.updateActiveGoogleSessions('tenant-123', 42),
      ).not.toThrow();
    });
  });

  describe('startOAuthCallbackTimer', () => {
    it('should return a function that records latency when called', () => {
      const tenantId = 'tenant-123';

      const endTimer = service.startOAuthCallbackTimer(tenantId);

      expect(typeof endTimer).toBe('function');
      expect(() => endTimer(true)).not.toThrow();
    });
  });

  describe('startTenantLookupTimer', () => {
    it('should return a function that records latency when called', () => {
      const tenantId = 'tenant-123';

      const endTimer = service.startTenantLookupTimer(tenantId);

      expect(typeof endTimer).toBe('function');
      expect(() => endTimer(true)).not.toThrow();
    });
  });

  describe('getGoogleAuthMetrics', () => {
    it('should return metrics structure', () => {
      const metrics = service.getGoogleAuthMetrics();

      expect(metrics).toEqual({
        googleSignInAttempts: 0,
        googleSignInSuccesses: 0,
        googleSignInFailures: 0,
        accountLinkingAttempts: 0,
        accountLinkingSuccesses: 0,
        accountUnlinkingAttempts: 0,
        accountUnlinkingSuccesses: 0,
        oauthCallbackLatency: 0,
        tenantLookupLatency: 0,
      });
    });
  });

  describe('getSuccessRate', () => {
    it('should return success rate', () => {
      const tenantId = 'tenant-123';
      const successRate = service.getSuccessRate(tenantId);

      expect(typeof successRate).toBe('number');
      expect(successRate).toBeGreaterThanOrEqual(0);
      expect(successRate).toBeLessThanOrEqual(100);
    });
  });

  describe('getAverageCallbackLatency', () => {
    it('should return average callback latency', () => {
      const tenantId = 'tenant-123';
      const latency = service.getAverageCallbackLatency(tenantId);

      expect(typeof latency).toBe('number');
      expect(latency).toBeGreaterThanOrEqual(0);
    });
  });
});
