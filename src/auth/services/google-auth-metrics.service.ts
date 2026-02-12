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

  private async sumCounter(
    counter?: Counter<string>,
    filter?: Record<string, string>,
  ): Promise<number> {
    if (!counter) return 0;
    const metric = await (counter as any).get();
    const values = metric?.values || [];
    return values
      .filter((entry: any) =>
        !filter
          ? true
          : Object.entries(filter).every(
            ([key, value]) => entry.labels?.[key] === value,
          ),
      )
      .reduce((sum: number, entry: any) => sum + Number(entry.value || 0), 0);
  }

  private async averageHistogram(
    histogram?: Histogram<string>,
    filter?: Record<string, string>,
  ): Promise<number> {
    if (!histogram) return 0;
    const metric = await (histogram as any).get();
    const values = metric?.values || [];

    const matchesFilter = (entry: any) =>
      !filter
        ? true
        : Object.entries(filter).every(
          ([key, value]) => entry.labels?.[key] === value,
        );

    const sumEntry = values.find(
      (entry: any) => entry.metricName?.endsWith('_sum') && matchesFilter(entry),
    );
    const countEntry = values.find(
      (entry: any) =>
        entry.metricName?.endsWith('_count') && matchesFilter(entry),
    );

    const sum = Number(sumEntry?.value || 0);
    const count = Number(countEntry?.value || 0);
    return count > 0 ? sum / count : 0;
  }

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
  ) {}

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
  async getGoogleAuthMetrics(): Promise<GoogleAuthMetrics> {
    try {
      const [
        googleSignInAttempts,
        googleSignInSuccesses,
        googleSignInFailures,
        accountLinkingAttempts,
        accountLinkingSuccesses,
        accountUnlinkingAttempts,
        accountUnlinkingSuccesses,
        oauthCallbackLatency,
        tenantLookupLatency,
      ] = await Promise.all([
        this.sumCounter(this.authAttemptsCounter),
        this.sumCounter(this.authSuccessCounter),
        this.sumCounter(this.authFailuresCounter),
        this.sumCounter(this.linkingAttemptsCounter, { operation: 'link' }),
        this.sumCounter(this.linkingSuccessCounter, { operation: 'link' }),
        this.sumCounter(this.linkingAttemptsCounter, { operation: 'unlink' }),
        this.sumCounter(this.linkingSuccessCounter, { operation: 'unlink' }),
        this.averageHistogram(this.oauthCallbackHistogram),
        this.averageHistogram(this.tenantLookupHistogram),
      ]);

      return {
        googleSignInAttempts,
        googleSignInSuccesses,
        googleSignInFailures,
        accountLinkingAttempts,
        accountLinkingSuccesses,
        accountUnlinkingAttempts,
        accountUnlinkingSuccesses,
        oauthCallbackLatency,
        tenantLookupLatency,
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
  async getSuccessRate(tenantId: string): Promise<number> {
    try {
      const [attempts, successes] = await Promise.all([
        this.sumCounter(this.authAttemptsCounter, { tenant_id: tenantId }),
        this.sumCounter(this.authSuccessCounter, { tenant_id: tenantId }),
      ]);
      if (attempts === 0) return 0;
      return (successes / attempts) * 100;
    } catch (error) {
      this.logger.error(
        `Failed to calculate success rate for tenant ${tenantId}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Get average OAuth callback latency for a tenant
   */
  async getAverageCallbackLatency(tenantId: string): Promise<number> {
    try {
      return await this.averageHistogram(this.oauthCallbackHistogram, {
        tenant_id: tenantId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to calculate callback latency for tenant ${tenantId}:`,
        error,
      );
      return 0;
    }
  }
}
