import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../constants/queue.constants';
import { EmailJobData, SmsJobData } from '../interfaces/queue-job.interface';
import { NotificationPriority } from '../enums/notification-priority.enum';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
    private emailQueue: Queue<EmailJobData>,
    @InjectQueue(QUEUE_NAMES.SMS_NOTIFICATIONS)
    private smsQueue: Queue<SmsJobData>,
  ) {}

  async addEmailJob(data: EmailJobData): Promise<void> {
    const priority = this.getPriorityValue(data.priority);

    await this.emailQueue.add('send-email', data, {
      priority,
      jobId: `email-${data.notificationId}`,
    });
  }

  async addSmsJob(data: SmsJobData): Promise<void> {
    const priority = this.getPriorityValue(data.priority);

    await this.smsQueue.add('send-sms', data, {
      priority,
      jobId: `sms-${data.notificationId}`,
    });
  }

  private getPriorityValue(priority: NotificationPriority): number {
    switch (priority) {
      case NotificationPriority.URGENT:
        return 10;
      case NotificationPriority.HIGH:
        return 5;
      case NotificationPriority.MEDIUM:
        return 1;
      case NotificationPriority.LOW:
        return 0;
      default:
        return 1;
    }
  }

  async getEmailQueueStats() {
    return {
      waiting: await this.emailQueue.getWaiting(),
      active: await this.emailQueue.getActive(),
      completed: await this.emailQueue.getCompleted(),
      failed: await this.emailQueue.getFailed(),
    };
  }

  async getSmsQueueStats() {
    return {
      waiting: await this.smsQueue.getWaiting(),
      active: await this.smsQueue.getActive(),
      completed: await this.smsQueue.getCompleted(),
      failed: await this.smsQueue.getFailed(),
    };
  }
}
