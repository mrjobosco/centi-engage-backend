import { Module } from '@nestjs/common';
import {
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { GoogleAuthMetricsService } from '../services/google-auth-metrics.service';

@Module({
  imports: [],
  providers: [
    // Google authentication attempt metrics
    makeCounterProvider({
      name: 'google_auth_attempts_total',
      help: 'Total number of Google authentication attempts',
      labelNames: ['tenant_id', 'flow', 'auth_method'],
    }),

    // Google authentication success metrics
    makeCounterProvider({
      name: 'google_auth_success_total',
      help: 'Total number of successful Google authentications',
      labelNames: ['tenant_id', 'flow', 'auth_method', 'user_type'],
    }),

    // Google authentication failure metrics
    makeCounterProvider({
      name: 'google_auth_failures_total',
      help: 'Total number of failed Google authentications',
      labelNames: [
        'tenant_id',
        'flow',
        'auth_method',
        'error_type',
        'error_code',
      ],
    }),

    // Account linking attempt metrics
    makeCounterProvider({
      name: 'google_account_linking_attempts_total',
      help: 'Total number of Google account linking attempts',
      labelNames: ['tenant_id', 'user_id', 'operation'],
    }),

    // Account linking success metrics
    makeCounterProvider({
      name: 'google_account_linking_success_total',
      help: 'Total number of successful Google account linking operations',
      labelNames: ['tenant_id', 'user_id', 'operation'],
    }),

    // Account linking failure metrics
    makeCounterProvider({
      name: 'google_account_linking_failures_total',
      help: 'Total number of failed Google account linking operations',
      labelNames: [
        'tenant_id',
        'user_id',
        'operation',
        'error_type',
        'error_code',
      ],
    }),

    // OAuth callback processing time metrics
    makeHistogramProvider({
      name: 'google_oauth_callback_duration_seconds',
      help: 'Time spent processing Google OAuth callbacks',
      labelNames: ['tenant_id', 'status'],
      buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
    }),

    // Tenant lookup processing time metrics
    makeHistogramProvider({
      name: 'google_tenant_lookup_duration_seconds',
      help: 'Time spent looking up tenant information during Google auth',
      labelNames: ['tenant_id', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    }),

    // Active Google sessions gauge
    makeGaugeProvider({
      name: 'google_active_sessions',
      help: 'Current number of active Google-authenticated sessions',
      labelNames: ['tenant_id'],
    }),

    GoogleAuthMetricsService,
  ],
  exports: [GoogleAuthMetricsService],
})
export class GoogleAuthMetricsModule { }
