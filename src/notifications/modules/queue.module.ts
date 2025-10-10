import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationConfig } from '../config/notification.config';
import { QUEUE_NAMES } from '../constants/queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const notificationConfig =
          configService.get<NotificationConfig>('notification');

        return {
          connection: {
            url: notificationConfig?.redis.url,
          },
          defaultJobOptions: {
            removeOnComplete: 100,
            removeOnFail: 50,
            attempts: notificationConfig?.queue.maxRetries || 3,
            backoff: {
              type: 'exponential',
              delay: notificationConfig?.queue.retryDelay || 5000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    // Register email notifications queue
    BullModule.registerQueueAsync({
      name: QUEUE_NAMES.EMAIL_NOTIFICATIONS,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const notificationConfig =
          configService.get<NotificationConfig>('notification');

        return {
          defaultJobOptions: {
            priority: 1, // Default priority, will be overridden by job-specific priority
            delay: 0,
            attempts: notificationConfig?.queue.maxRetries || 3,
            backoff: {
              type: 'exponential',
              delay: notificationConfig?.queue.retryDelay || 5000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    // Register SMS notifications queue
    BullModule.registerQueueAsync({
      name: QUEUE_NAMES.SMS_NOTIFICATIONS,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const notificationConfig =
          configService.get<NotificationConfig>('notification');

        return {
          defaultJobOptions: {
            priority: 1, // Default priority, will be overridden by job-specific priority
            delay: 0,
            attempts: notificationConfig?.queue.maxRetries || 3,
            backoff: {
              type: 'exponential',
              delay: notificationConfig?.queue.retryDelay || 5000,
            },
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
