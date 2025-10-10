import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsService } from './metrics.service';
import { QueueMonitoringService } from './queue-monitoring.service';
import { NotificationLoggerService } from './notification-logger.service';

export interface AlertThreshold {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  timeWindow?: number; // in minutes
  enabled: boolean;
}

export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    failureRate: AlertThreshold;
    queueDepth: AlertThreshold;
    queueLag: AlertThreshold;
    providerErrors: AlertThreshold;
  };
  webhookUrl?: string;
  emailRecipients?: string[];
  slackWebhookUrl?: string;
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly alertConfig: AlertConfig;
  private readonly alertHistory = new Map<string, Date>();

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
    private readonly queueMonitoringService: QueueMonitoringService,
    private readonly notificationLogger: NotificationLoggerService,
  ) {
    this.alertConfig = this.loadAlertConfig();
  }

  /**
   * Check alert conditions every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAlertConditions(): Promise<void> {
    if (!this.alertConfig.enabled) {
      return;
    }

    try {
      await Promise.all([
        this.checkFailureRateAlert(),
        this.checkQueueDepthAlert(),
        this.checkQueueLagAlert(),
        this.checkProviderErrorAlert(),
      ]);
    } catch (error) {
      this.logger.error('Error checking alert conditions:', error);
    }
  }

  /**
   * Check failure rate alert
   */
  private async checkFailureRateAlert(): Promise<void> {
    const threshold = this.alertConfig.thresholds.failureRate;
    if (!threshold.enabled) return;

    try {
      // This is a simplified implementation
      // In a real system, you'd query your metrics store (Prometheus, etc.)
      const failureRate = await this.calculateFailureRate();

      if (this.evaluateThreshold(failureRate, threshold)) {
        await this.sendAlert(
          'High Failure Rate',
          `Notification failure rate is ${failureRate.toFixed(2)}%, which exceeds the threshold of ${threshold.threshold}%`,
          'failure_rate',
          { failureRate, threshold: threshold.threshold },
        );
      }
    } catch (error) {
      this.logger.error('Error checking failure rate alert:', error);
    }
  }

  /**
   * Check queue depth alert
   */
  private async checkQueueDepthAlert(): Promise<void> {
    const threshold = this.alertConfig.thresholds.queueDepth;
    if (!threshold.enabled) return;

    try {
      const queueStats = await this.queueMonitoringService.getQueueStatistics();
      const maxDepth = Math.max(queueStats.email.depth, queueStats.sms.depth);

      if (this.evaluateThreshold(maxDepth, threshold)) {
        await this.sendAlert(
          'High Queue Depth',
          `Queue depth is ${maxDepth}, which exceeds the threshold of ${threshold.threshold}`,
          'queue_depth',
          {
            emailDepth: queueStats.email.depth,
            smsDepth: queueStats.sms.depth,
            threshold: threshold.threshold,
          },
        );
      }
    } catch (error) {
      this.logger.error('Error checking queue depth alert:', error);
    }
  }

  /**
   * Check queue lag alert
   */
  private async checkQueueLagAlert(): Promise<void> {
    const threshold = this.alertConfig.thresholds.queueLag;
    if (!threshold.enabled) return;

    try {
      const queueStats = await this.queueMonitoringService.getQueueStatistics();
      const maxLag = Math.max(queueStats.email.lag, queueStats.sms.lag);

      if (this.evaluateThreshold(maxLag, threshold)) {
        await this.sendAlert(
          'High Queue Lag',
          `Queue lag is ${maxLag.toFixed(2)} seconds, which exceeds the threshold of ${threshold.threshold} seconds`,
          'queue_lag',
          {
            emailLag: queueStats.email.lag,
            smsLag: queueStats.sms.lag,
            threshold: threshold.threshold,
          },
        );
      }
    } catch (error) {
      this.logger.error('Error checking queue lag alert:', error);
    }
  }

  /**
   * Check provider error alert
   */
  private async checkProviderErrorAlert(): Promise<void> {
    const threshold = this.alertConfig.thresholds.providerErrors;
    if (!threshold.enabled) return;

    try {
      // This would typically check provider error rates from metrics
      // For now, we'll implement a placeholder
      const providerErrorRate = await this.calculateProviderErrorRate();

      if (this.evaluateThreshold(providerErrorRate, threshold)) {
        await this.sendAlert(
          'High Provider Error Rate',
          `Provider error rate is ${providerErrorRate.toFixed(2)}%, which exceeds the threshold of ${threshold.threshold}%`,
          'provider_errors',
          { providerErrorRate, threshold: threshold.threshold },
        );
      }
    } catch (error) {
      this.logger.error('Error checking provider error alert:', error);
    }
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(
    title: string,
    message: string,
    alertType: string,
    data: Record<string, any>,
  ): Promise<void> {
    // Check if we've already sent this alert recently (avoid spam)
    const alertKey = `${alertType}_${JSON.stringify(data)}`;
    const lastAlert = this.alertHistory.get(alertKey);
    const cooldownMinutes = 30; // Don't send same alert more than once per 30 minutes

    if (
      lastAlert &&
      Date.now() - lastAlert.getTime() < cooldownMinutes * 60 * 1000
    ) {
      return;
    }

    this.alertHistory.set(alertKey, new Date());

    // Log the alert
    this.notificationLogger.logWebSocketEvent(
      'error',
      'system',
      undefined,
      undefined,
      `Alert: ${title}`,
      {
        alert_type: alertType,
        message,
        data,
      },
    );

    this.logger.warn(`ALERT: ${title} - ${message}`, data);

    // Send to configured channels
    const promises: Promise<void>[] = [];

    if (this.alertConfig.webhookUrl) {
      promises.push(this.sendWebhookAlert(title, message, alertType, data));
    }

    if (this.alertConfig.slackWebhookUrl) {
      promises.push(this.sendSlackAlert(title, message, alertType, data));
    }

    if (this.alertConfig.emailRecipients?.length) {
      promises.push(this.sendEmailAlert(title, message, alertType, data));
    }

    await Promise.allSettled(promises);
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(
    title: string,
    message: string,
    alertType: string,
    data: Record<string, any>,
  ): Promise<void> {
    try {
      const response = await fetch(this.alertConfig.webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          message,
          alertType,
          data,
          timestamp: new Date().toISOString(),
          service: 'notification-system',
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook request failed: ${response.status}`);
      }

      this.logger.debug('Webhook alert sent successfully');
    } catch (error) {
      this.logger.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(
    title: string,
    message: string,
    alertType: string,
    data: Record<string, any>,
  ): Promise<void> {
    try {
      const color = this.getAlertColor(alertType);
      const slackMessage = {
        text: `🚨 ${title}`,
        attachments: [
          {
            color,
            fields: [
              {
                title: 'Message',
                value: message,
                short: false,
              },
              {
                title: 'Alert Type',
                value: alertType,
                short: true,
              },
              {
                title: 'Service',
                value: 'notification-system',
                short: true,
              },
              {
                title: 'Data',
                value: `\`\`\`${JSON.stringify(data, null, 2)}\`\`\``,
                short: false,
              },
            ],
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      const response = await fetch(this.alertConfig.slackWebhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(slackMessage),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook request failed: ${response.status}`);
      }

      this.logger.debug('Slack alert sent successfully');
    } catch (error) {
      this.logger.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Send email alert using the notification system
   */
  private async sendEmailAlert(
    title: string,
    message: string,
    alertType: string,
    data: Record<string, any>,
  ): Promise<void> {
    try {
      if (!this.alertConfig.emailRecipients?.length) {
        return;
      }

      // Create email content
      const emailContent = `
        <h2>🚨 ${title}</h2>
        <p><strong>Message:</strong> ${message}</p>
        <p><strong>Alert Type:</strong> ${alertType}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p><strong>Service:</strong> notification-system</p>
        
        <h3>Details:</h3>
        <pre>${JSON.stringify(data, null, 2)}</pre>
        
        <hr>
        <p><small>This is an automated alert from the notification system.</small></p>
      `;

      // Send email to each recipient
      for (const recipient of this.alertConfig.emailRecipients) {
        try {
          // Use a simple HTTP request to send email via external service
          // In a real implementation, you might use the notification service directly
          await this.sendEmailViaWebhook(recipient, title, emailContent);
          this.logger.debug(`Email alert sent to: ${recipient}`);
        } catch (error) {
          this.logger.error(
            `Failed to send email alert to ${recipient}:`,
            error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to send email alert:', error);
    }
  }

  /**
   * Send email via webhook or external service
   */
  private async sendEmailViaWebhook(
    recipient: string,
    subject: string,
    content: string,
  ): Promise<void> {
    const emailWebhookUrl = this.configService.get<string>('EMAIL_WEBHOOK_URL');

    if (!emailWebhookUrl) {
      this.logger.warn(
        'EMAIL_WEBHOOK_URL not configured, skipping email alert',
      );
      return;
    }

    const response = await fetch(emailWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: recipient,
        subject,
        html: content,
        from: this.configService.get<string>(
          'ALERT_EMAIL_FROM',
          'alerts@example.com',
        ),
      }),
    });

    if (!response.ok) {
      throw new Error(`Email webhook request failed: ${response.status}`);
    }
  }

  /**
   * Evaluate if a value meets the threshold condition
   */
  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case 'gt':
        return value > threshold.threshold;
      case 'gte':
        return value >= threshold.threshold;
      case 'lt':
        return value < threshold.threshold;
      case 'lte':
        return value <= threshold.threshold;
      case 'eq':
        return value === threshold.threshold;
      default:
        return false;
    }
  }

  /**
   * Get alert color for Slack
   */
  private getAlertColor(alertType: string): string {
    switch (alertType) {
      case 'failure_rate':
      case 'provider_errors':
        return 'danger';
      case 'queue_depth':
      case 'queue_lag':
        return 'warning';
      default:
        return 'warning';
    }
  }

  /**
   * Calculate failure rate from database metrics
   */
  private async calculateFailureRate(): Promise<number> {
    try {
      // Calculate failure rate from the last hour of delivery logs
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // This would typically use a metrics service or database query
      // For now, we'll use the metrics service to get delivery rates
      const emailRate = await this.metricsService.getDeliveryRate(
        'EMAIL' as any,
      );
      const smsRate = await this.metricsService.getDeliveryRate('SMS' as any);
      const inAppRate = await this.metricsService.getDeliveryRate(
        'IN_APP' as any,
      );

      // Calculate average failure rate across all channels
      const rates = [emailRate, smsRate, inAppRate].filter((rate) => rate > 0);
      if (rates.length === 0) return 0;

      const averageSuccessRate =
        rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
      return Math.max(0, 100 - averageSuccessRate);
    } catch (error) {
      this.logger.error('Failed to calculate failure rate:', error);
      return 0;
    }
  }

  /**
   * Calculate provider error rate from metrics
   */
  private async calculateProviderErrorRate(): Promise<number> {
    try {
      // Get provider response metrics from the metrics service
      // This would typically query provider-specific error rates
      const register = await import('prom-client').then((m) => m.register);
      const providerMetric = register.getSingleMetric(
        'notification_provider_response_duration_seconds',
      );

      if (!providerMetric) {
        return 0;
      }

      const metricValues = await providerMetric.get();
      let totalRequests = 0;
      let errorRequests = 0;

      for (const sample of metricValues.values) {
        totalRequests += sample.value;
        if (sample.labels?.status === 'error') {
          errorRequests += sample.value;
        }
      }

      return totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
    } catch (error) {
      this.logger.error('Failed to calculate provider error rate:', error);
      return 0;
    }
  }

  /**
   * Load alert configuration from environment variables
   */
  private loadAlertConfig(): AlertConfig {
    return {
      enabled: this.configService.get<boolean>('ALERTING_ENABLED', false),
      thresholds: {
        failureRate: {
          metric: 'failure_rate',
          threshold: this.configService.get<number>(
            'ALERT_FAILURE_RATE_THRESHOLD',
            5,
          ),
          operator: 'gt',
          enabled: this.configService.get<boolean>(
            'ALERT_FAILURE_RATE_ENABLED',
            true,
          ),
        },
        queueDepth: {
          metric: 'queue_depth',
          threshold: this.configService.get<number>(
            'ALERT_QUEUE_DEPTH_THRESHOLD',
            1000,
          ),
          operator: 'gt',
          enabled: this.configService.get<boolean>(
            'ALERT_QUEUE_DEPTH_ENABLED',
            true,
          ),
        },
        queueLag: {
          metric: 'queue_lag',
          threshold: this.configService.get<number>(
            'ALERT_QUEUE_LAG_THRESHOLD',
            300,
          ),
          operator: 'gt',
          enabled: this.configService.get<boolean>(
            'ALERT_QUEUE_LAG_ENABLED',
            true,
          ),
        },
        providerErrors: {
          metric: 'provider_errors',
          threshold: this.configService.get<number>(
            'ALERT_PROVIDER_ERROR_THRESHOLD',
            10,
          ),
          operator: 'gt',
          enabled: this.configService.get<boolean>(
            'ALERT_PROVIDER_ERROR_ENABLED',
            true,
          ),
        },
      },
      webhookUrl: this.configService.get<string>('ALERT_WEBHOOK_URL'),
      emailRecipients: this.configService
        .get<string>('ALERT_EMAIL_RECIPIENTS')
        ?.split(','),
      slackWebhookUrl: this.configService.get<string>(
        'ALERT_SLACK_WEBHOOK_URL',
      ),
    };
  }

  /**
   * Manually trigger an alert (for testing)
   */
  async triggerTestAlert(): Promise<void> {
    await this.sendAlert(
      'Test Alert',
      'This is a test alert to verify the alerting system is working correctly.',
      'test',
      { test: true, timestamp: new Date().toISOString() },
    );
  }

  /**
   * Get current alert configuration
   */
  getAlertConfig(): AlertConfig {
    return { ...this.alertConfig };
  }

  /**
   * Get alert history
   */
  getAlertHistory(): Array<{ key: string; lastSent: Date }> {
    return Array.from(this.alertHistory.entries()).map(([key, lastSent]) => ({
      key,
      lastSent,
    }));
  }
}
