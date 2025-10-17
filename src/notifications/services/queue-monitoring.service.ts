import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MetricsService } from './metrics.service';

@Injectable()
export class QueueMonitoringService implements OnModuleInit {
  constructor(
    @InjectQueue('email-notifications')
    private readonly emailQueue: Queue,

    @InjectQueue('sms-notifications')
    private readonly smsQueue: Queue,

    private readonly metricsService: MetricsService,
  ) {}

  async onModuleInit() {
    // Start monitoring immediately
    await this.updateQueueMetrics();
  }

  /**
   * Update queue metrics every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async updateQueueMetrics(): Promise<void> {
    try {
      await Promise.all([
        this.updateEmailQueueMetrics(),
        this.updateSmsQueueMetrics(),
      ]);
    } catch (error) {
      console.error('Error updating queue metrics:', error);
    }
  }

  /**
   * Update email queue metrics
   */
  private async updateEmailQueueMetrics(): Promise<void> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.emailQueue.getWaiting(),
        this.emailQueue.getActive(),
        this.emailQueue.getCompleted(),
        this.emailQueue.getFailed(),
        this.emailQueue.getDelayed(),
      ]);

      // Calculate queue depth (waiting + active + delayed)
      const depth = waiting.length + active.length + delayed.length;
      this.metricsService.updateQueueDepth('email-notifications', depth);

      // Calculate queue lag (time since oldest waiting job was created)
      if (waiting.length > 0) {
        const oldestJob = waiting[0];
        const lagSeconds = (Date.now() - oldestJob.timestamp) / 1000;
        this.metricsService.updateQueueLag('email-notifications', lagSeconds);
      } else {
        this.metricsService.updateQueueLag('email-notifications', 0);
      }

      // Log queue statistics for debugging
      console.log(
        `Email Queue Stats - Waiting: ${waiting.length}, Active: ${active.length}, Completed: ${completed.length}, Failed: ${failed.length}, Delayed: ${delayed.length}`,
      );
    } catch (error) {
      console.error('Error updating email queue metrics:', error);
    }
  }

  /**
   * Update SMS queue metrics
   */
  private async updateSmsQueueMetrics(): Promise<void> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.smsQueue.getWaiting(),
        this.smsQueue.getActive(),
        this.smsQueue.getCompleted(),
        this.smsQueue.getFailed(),
        this.smsQueue.getDelayed(),
      ]);

      // Calculate queue depth (waiting + active + delayed)
      const depth = waiting.length + active.length + delayed.length;
      this.metricsService.updateQueueDepth('sms-notifications', depth);

      // Calculate queue lag (time since oldest waiting job was created)
      if (waiting.length > 0) {
        const oldestJob = waiting[0];
        const lagSeconds = (Date.now() - oldestJob.timestamp) / 1000;
        this.metricsService.updateQueueLag('sms-notifications', lagSeconds);
      } else {
        this.metricsService.updateQueueLag('sms-notifications', 0);
      }

      // Log queue statistics for debugging
      console.log(
        `SMS Queue Stats - Waiting: ${waiting.length}, Active: ${active.length}, Completed: ${completed.length}, Failed: ${failed.length}, Delayed: ${delayed.length}`,
      );
    } catch (error) {
      console.error('Error updating SMS queue metrics:', error);
    }
  }

  /**
   * Get detailed queue statistics
   */
  async getQueueStatistics(): Promise<{
    email: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      depth: number;
      lag: number;
    };
    sms: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      depth: number;
      lag: number;
    };
  }> {
    const [emailStats, smsStats] = await Promise.all([
      this.getEmailQueueStats(),
      this.getSmsQueueStats(),
    ]);

    return {
      email: emailStats,
      sms: smsStats,
    };
  }

  /**
   * Get email queue statistics
   */
  private async getEmailQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.emailQueue.getWaiting(),
      this.emailQueue.getActive(),
      this.emailQueue.getCompleted(),
      this.emailQueue.getFailed(),
      this.emailQueue.getDelayed(),
    ]);

    const depth = waiting.length + active.length + delayed.length;
    const lag =
      waiting.length > 0 ? (Date.now() - waiting[0].timestamp) / 1000 : 0;

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      depth,
      lag,
    };
  }

  /**
   * Get SMS queue statistics
   */
  private async getSmsQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.smsQueue.getWaiting(),
      this.smsQueue.getActive(),
      this.smsQueue.getCompleted(),
      this.smsQueue.getFailed(),
      this.smsQueue.getDelayed(),
    ]);

    const depth = waiting.length + active.length + delayed.length;
    const lag =
      waiting.length > 0 ? (Date.now() - waiting[0].timestamp) / 1000 : 0;

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      depth,
      lag,
    };
  }
}
