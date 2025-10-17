import { Module } from '@nestjs/common';
import {
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from '../services/metrics.service';

@Module({
  imports: [],
  providers: [
    // Delivery metrics
    makeCounterProvider({
      name: 'notification_delivery_total',
      help: 'Total number of notification deliveries',
      labelNames: ['channel', 'category', 'tenant_id', 'provider', 'status'],
    }),

    // Failed delivery metrics
    makeCounterProvider({
      name: 'notification_delivery_failed_total',
      help: 'Total number of failed notification deliveries',
      labelNames: [
        'channel',
        'category',
        'tenant_id',
        'provider',
        'error_type',
      ],
    }),

    // Processing time metrics
    makeHistogramProvider({
      name: 'notification_processing_duration_seconds',
      help: 'Time spent processing notifications',
      labelNames: ['channel', 'category', 'provider'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    }),

    // Queue depth metrics
    makeGaugeProvider({
      name: 'notification_queue_depth',
      help: 'Current depth of notification queues',
      labelNames: ['queue'],
    }),

    // Queue lag metrics
    makeGaugeProvider({
      name: 'notification_queue_lag_seconds',
      help: 'Current lag of notification queues in seconds',
      labelNames: ['queue'],
    }),

    // Provider response time metrics
    makeHistogramProvider({
      name: 'notification_provider_response_duration_seconds',
      help: 'Time spent waiting for provider API responses',
      labelNames: ['provider', 'channel', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    }),

    // Bounce rate metrics
    makeCounterProvider({
      name: 'notification_bounce_rate_total',
      help: 'Total number of bounced/undeliverable notifications',
      labelNames: [
        'channel',
        'category',
        'tenant_id',
        'provider',
        'bounce_type',
      ],
    }),

    MetricsService,
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
