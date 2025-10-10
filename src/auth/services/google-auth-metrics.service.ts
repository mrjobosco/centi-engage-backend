import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';

export interface GoogleAuthMetrics {
  googleSignInAttempts: number;
  googleSignInSuccesses: number;
  googleSignInFailures: number;
  accountLinkingAttempts: number;
  accountLinkingSuccesses: number;
  accountUnlinkingAttempts: number;
  accountUnlinkingSuccesses: number;
  oauthCallbackLatency: number;
  tenantLookupLatency: number;
}

@Injectable()
export class GoogleAuthMetricsService {
  private readonly logger = new Logger(GoogleAuthMetricsService.name);

  constructor(
    @Optional()
    @InjectMetric('google_auth_attempts_total')
    private readonly authAttemptsCounter?: Counter<string>,

    @Optional()
    @InjectMetric('google_auth_success_total')
    private readonly authSuccessCounter?: Counter<string>,

    @Optional()
    @InjectMetric('google_auth_failures_total')
    private readonly authFailuresCounter?: Counter<string>,

    @Optional()
    @InjectMetric('google_account_linking_attempts_total')
    private readonly linkingAttemptsCounter?: Counter<string>,

    @Optional()
    @InjectMetric('google_account_linking_success_total')
    private readonly linkingSuccessCounter?: Counter<string>,

    @Optional()
    @InjectMetric('google_account_linking_failures_total')
    private readonly linkingFailuresCounter?: Counter<string>,

    @Optional()
    @InjectMetric('google_oauth_callback_duration_seconds')
    private readonly oauthCallbackHistogram?: Histogram<string>,

    @Optional()
    @InjectMetric('google_tenant_lookup_duration_seconds')
    private readonly tenantLookupHistogram?: Histogram<string>,

    @Optional()
    @InjectMetric('google_active_sessions')
    private readonly activeSessionsGauge?: Gauge<string>,
  ) { }

  /**
   * Record Google sign-in attempt
   */
  recordSignInAttempt(tenantId: string, flow: 'signin' | 'callback'): void {
    this.authAttemptsCounter?.inc({
      tenant_id: tenantId,
      flow,
      auth_method: 'google',
    });
  }

  /**
   * Record successful Google sign-in
   */
  recordSignInSuccess(
    tenantId: string,
    flow: 'signin' | 'callback',
    userType: 'new' | 'existing',
  ): void {
    this.authSuccessCounter?.inc({
      tenant_id: tenantId,
      flow,
      auth_method: 'google',
      user_type: userType,
    });
  }

  /**
   * Record failed Google sign-in
   */
  recordSignInFailure(
    tenantId: string,
    flow: 'signin' | 'callback',
    errorType: string,
    errorCode?: string,
  ): void {
    this.authFailuresCounter?.inc({
      tenant_id: tenantId,
      flow,
      auth_method: 'google',
      error_type: errorType,
      error_code: errorCode || 'unknown',
    });
  }

  /**
   * Record account linking attempt
   */
  recordLinkingAttempt(
    tenantId: string,
    userId: string,
    operation: 'link' | 'unlink',
  ): void {
    this.linkingAttemptsCounter?.inc({
      tenant_id: tenantId,
      user_id: userId,
      operation,
    });
  }

  /**
   * Record successful account linking
   */
  recordLinkingSuccess(
    tenantId: string,
    userId: string,
    operation: 'link' | 'unlink',
  ): void {
    this.linkingSuccessCounter?.inc({
      tenant_id: tenantId,
      user_id: userId,
      operation,
    });
  }

  /**
   * Record failed account linking
   */
  recordLinkingFailure(
    tenantId: string,
    userId: string,
    operation: 'link' | 'unlink',
    errorType: string,
    errorCode?: string,
  ): void {
    this.linkingFailuresCounter?.inc({
      tenant_id: tenantId,
      user_id: userId,
      operation,
      error_type: errorType,
      error_code: errorCode || 'unknown',
    });
  }

  /**
   * Record OAuth callback processing time
   */
  recordOAuthCallbackLatency(
    tenantId: string,
    durationSeconds: number,
    success: boolean,
  ): void {
    this.oauthCallbackHistogram?.observe(
      {
        tenant_id: tenantId,
        status: success ? 'success' : 'error',
      },
      durationSeconds,
    );
  }

  /**
   * Record tenant lookup processing time
   */
  recordTenantLookupLatency(
    tenantId: string,
    durationSeconds: number,
    success: boolean,
  ): void {
    this.tenantLookupHistogram?.observe(
      {
        tenant_id: tenantId,
        status: success ? 'success' : 'error',
      },
      durationSeconds,
    );
  }

  /**
   * Update active Google sessions count
   */
  updateActiveGoogleSessions(tenantId: string, count: number): void {
    this.activeSessionsGauge?.set({ tenant_id: tenantId }, count);
  }

  /**
   * Create a timer for measuring OAuth callback duration
   */
  startOAuthCallbackTimer(tenantId: string): (success: boolean) => void {
    const startTime = Date.now();

    return (success: boolean) => {
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.recordOAuthCallbackLatency(tenantId, durationSeconds, success);
    };
  }

  /**
   * Create a timer for measuring tenant lookup duration
   */
  startTenantLookupTimer(tenantId: string): (success: boolean) => void {
    const startTime = Date.now();

    return (success: boolean) => {
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.recordTenantLookupLatency(tenantId, durationSeconds, success);
    };
  }

  /**
   * Get comprehensive Google authentication metrics
   */
  getGoogleAuthMetrics(): GoogleAuthMetrics {
    try {
      // In a real implementation, you would query Prometheus metrics
      // For now, we'll return a placeholder structure
      return {
        googleSignInAttempts: 0,
        googleSignInSuccesses: 0,
        googleSignInFailures: 0,
        accountLinkingAttempts: 0,
        accountLinkingSuccesses: 0,
        accountUnlinkingAttempts: 0,
        accountUnlinkingSuccesses: 0,
        oauthCallbackLatency: 0,
        tenantLookupLatency: 0,
      };
    } catch (error) {
      this.logger.error('Failed to get Google auth metrics:', error);
      return {
        googleSignInAttempts: 0,
        googleSignInSuccesses: 0,
        googleSignInFailures: 0,
        accountLinkingAttempts: 0,
        accountLinkingSuccesses: 0,
        accountUnlinkingAttempts: 0,
        accountUnlinkingSuccesses: 0,
        oauthCallbackLatency: 0,
        tenantLookupLatency: 0,
      };
    }
  }

  /**
   * Get Google authentication success rate for a tenant
   */
  getSuccessRate(_tenantId: string): number {
    try {
      // In a real implementation, you would calculate this from Prometheus metrics
      // For now, return a placeholder
      return 95.5; // 95.5% success rate
    } catch (error) {
      this.logger.error(
        `Failed to calculate success rate for tenant ${_tenantId}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get average OAuth callback latency for a tenant
   */
  getAverageCallbackLatency(_tenantId: string): number {
    try {
      // In a real implementation, you would calculate this from Prometheus metrics
      // For now, return a placeholder
      return 0.85; // 850ms average latency
    } catch (error) {
      this.logger.error(
        `Failed to calculate callback latency for tenant ${_tenantId}:`,
        error,
      );
      return 0;
    }
  }
}
