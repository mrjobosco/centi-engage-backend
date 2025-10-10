import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge, register } from 'prom-client';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { DeliveryStatus } from '../enums/delivery-status.enum';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectMetric('notification_delivery_total')
    private readonly deliveryCounter: Counter<string>,

    @InjectMetric('notification_delivery_failed_total')
    private readonly failedCounter: Counter<string>,

    @InjectMetric('notification_processing_duration_seconds')
    private readonly processingHistogram: Histogram<string>,

    @InjectMetric('notification_queue_depth')
    private readonly queueDepthGauge: Gauge<string>,

    @InjectMetric('notification_queue_lag_seconds')
    private readonly queueLagGauge: Gauge<string>,

    @InjectMetric('notification_provider_response_duration_seconds')
    private readonly providerResponseHistogram: Histogram<string>,

    @InjectMetric('notification_bounce_rate_total')
    private readonly bounceCounter: Counter<string>,
  ) { }

  /**
   * Record successful notification delivery
   */
  recordDelivery(
    channel: NotificationChannelType,
    category: string,
    tenantId: string,
    provider?: string,
  ): void {
    this.deliveryCounter.inc({
      channel: channel.toLowerCase(),
      category,
      tenant_id: tenantId,
      provider: provider || 'unknown',
      status: 'success',
    });
  }

  /**
   * Record failed notification delivery
   */
  recordFailure(
    channel: NotificationChannelType,
    category: string,
    tenantId: string,
    errorType: string,
    provider?: string,
  ): void {
    this.failedCounter.inc({
      channel: channel.toLowerCase(),
      category,
      tenant_id: tenantId,
      provider: provider || 'unknown',
      error_type: errorType,
    });

    // Also increment the general delivery counter with failed status
    this.deliveryCounter.inc({
      channel: channel.toLowerCase(),
      category,
      tenant_id: tenantId,
      provider: provider || 'unknown',
      status: 'failed',
    });
  }

  /**
   * Record notification processing time
   */
  recordProcessingTime(
    channel: NotificationChannelType,
    category: string,
    durationSeconds: number,
    provider?: string,
  ): void {
    this.processingHistogram.observe(
      {
        channel: channel.toLowerCase(),
        category,
        provider: provider || 'unknown',
      },
      durationSeconds,
    );
  }

  /**
   * Update queue depth metric
   */
  updateQueueDepth(queueName: string, depth: number): void {
    this.queueDepthGauge.set({ queue: queueName }, depth);
  }

  /**
   * Update queue lag metric
   */
  updateQueueLag(queueName: string, lagSeconds: number): void {
    this.queueLagGauge.set({ queue: queueName }, lagSeconds);
  }

  /**
   * Record provider API response time
   */
  recordProviderResponseTime(
    provider: string,
    channel: NotificationChannelType,
    durationSeconds: number,
    success: boolean,
  ): void {
    this.providerResponseHistogram.observe(
      {
        provider,
        channel: channel.toLowerCase(),
        status: success ? 'success' : 'error',
      },
      durationSeconds,
    );
  }

  /**
   * Record bounce/undeliverable notification
   */
  recordBounce(
    channel: NotificationChannelType,
    category: string,
    tenantId: string,
    bounceType: string,
    provider?: string,
  ): void {
    this.bounceCounter.inc({
      channel: channel.toLowerCase(),
      category,
      tenant_id: tenantId,
      provider: provider || 'unknown',
      bounce_type: bounceType,
    });
  }

  /**
   * Record delivery status change
   */
  recordDeliveryStatusChange(
    channel: NotificationChannelType,
    category: string,
    tenantId: string,
    fromStatus: DeliveryStatus,
    toStatus: DeliveryStatus,
    provider?: string,
  ): void {
    // Record the status change as a delivery event
    if (toStatus === DeliveryStatus.SENT) {
      this.recordDelivery(channel, category, tenantId, provider);
    } else if (toStatus === DeliveryStatus.FAILED) {
      this.recordFailure(
        channel,
        category,
        tenantId,
        'status_change',
        provider,
      );
    } else if (toStatus === DeliveryStatus.BOUNCED) {
      this.recordBounce(
        channel,
        category,
        tenantId,
        'delivery_bounce',
        provider,
      );
    }
  }

  /**
   * Get delivery rate for a specific channel
   */
  async getDeliveryRate(channel: NotificationChannelType): Promise<number> {
    try {
      // Get metrics from Prometheus registry
      const metrics = await register.getSingleMetric(
        'notification_delivery_total',
      );

      if (!metrics) {
        return 0;
      }

      // Calculate delivery rate from the counter metrics
      // This is a simplified calculation - in production you'd use proper time-series queries
      const metricValues = await metrics.get();

      let totalDeliveries = 0;
      let successfulDeliveries = 0;

      for (const sample of metricValues.values) {
        if (sample.labels?.channel === channel.toLowerCase()) {
          totalDeliveries += sample.value;
          if (sample.labels?.status === 'success') {
            successfulDeliveries += sample.value;
          }
        }
      }

      return totalDeliveries > 0
        ? (successfulDeliveries / totalDeliveries) * 100
        : 0;
    } catch (error) {
      this.logger.error('Failed to calculate delivery rate:', error);
      return 0;
    }
  }

  /**
   * Get current queue statistics
   */
  async getQueueStats(
    queueName: string,
  ): Promise<{ depth: number; lag: number }> {
    try {
      // Get queue depth from Prometheus metrics
      const depthMetric = await register.getSingleMetric(
        'notification_queue_depth',
      );
      const lagMetric = register.getSingleMetric(
        'notification_queue_lag_seconds',
      );

      let depth = 0;
      let lag = 0;

      if (depthMetric) {
        const depthValues = await depthMetric.get();
        const queueDepthSample = depthValues.values.find(
          (sample) => sample.labels?.queue === queueName,
        );
        depth = queueDepthSample?.value || 0;
      }

      if (lagMetric) {
        const lagValues = await lagMetric.get();
        const queueLagSample = lagValues.values.find(
          (sample) => sample.labels?.queue === queueName,
        );
        lag = queueLagSample?.value || 0;
      }

      return { depth, lag };
    } catch (error) {
      this.logger.error(`Failed to get queue stats for ${queueName}:`, error);
      return { depth: 0, lag: 0 };
    }
  }

  /**
   * Create a timer for measuring processing duration
   */
  startTimer(
    channel: NotificationChannelType,
    category: string,
    provider?: string,
  ): () => void {
    const startTime = Date.now();

    return () => {
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.recordProcessingTime(channel, category, durationSeconds, provider);
    };
  }

  /**
   * Create a timer for measuring provider response time
   */
  startProviderTimer(
    provider: string,
    channel: NotificationChannelType,
  ): (success: boolean) => void {
    const startTime = Date.now();

    return (success: boolean) => {
      const durationSeconds = (Date.now() - startTime) / 1000;
      this.recordProviderResponseTime(
        provider,
        channel,
        durationSeconds,
        success,
      );
    };
  }
}
