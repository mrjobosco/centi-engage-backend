import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';

// Services
import { NotificationService } from './services/notification.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { NotificationPrivacyService } from './services/notification-privacy.service';
import { NotificationSchedulerService } from './services/notification-scheduler.service';
import { QueueService } from './services/queue.service';
import { RateLimitingService } from './services/rate-limiting.service';
import { PhoneNumberService } from './services/phone-number.service';

// Factories
import { NotificationChannelFactory } from './factories/notification-channel.factory';
import { EmailProviderFactory } from './factories/email-provider.factory';
import { SmsProviderFactory } from './factories/sms-provider.factory';

// Channel handlers
import { InAppChannelService } from './channels/in-app-channel.service';
import { EmailChannelService } from './channels/email-channel.service';
import { SmsChannelService } from './channels/sms-channel.service';

// Queue module
import { QueueModule } from './modules/queue.module';

// Metrics module
import { MetricsModule } from './modules/metrics.module';

// Monitoring services

import { QueueMonitoringService } from './services/queue-monitoring.service';
import { NotificationLoggerService } from './services/notification-logger.service';
import { AlertingService } from './services/alerting.service';

// Queue processors
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { SmsQueueProcessor } from './processors/sms-queue.processor';

// WebSocket Gateway
import { NotificationGateway } from './gateways/notification.gateway';

// Controllers
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationPreferencesController } from './controllers/notification-preferences.controller';
import { MonitoringController } from './controllers/monitoring.controller';

// Event Listeners
import { NotificationEventListener } from './listeners/notification-event.listener';

// Guards
import {
  NotificationRateLimitGuard,
  TenantRateLimitGuard,
  NotificationOwnershipGuard,
  AdminRoleGuard,
  TenantIsolationGuard,
} from './guards';

@Module({
  imports: [
    ConfigModule, // Required for factories that use ConfigService
    DatabaseModule,
    TenantModule,
    QueueModule,
    MetricsModule, // Add metrics module
    ScheduleModule.forRoot(), // Enable cron jobs
    JwtModule.register({}), // Empty config - will use global JWT config
    RedisModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second
        limit: 3, // 3 requests per second (default fallback)
      },
      {
        name: 'medium',
        ttl: 10000, // 10 seconds
        limit: 20, // 20 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    EventEmitterModule.forRoot({
      // Set this to `true` to use wildcards
      wildcard: false,
      // The delimiter used to segment namespaces
      delimiter: '.',
      // Set this to `true` if you want to emit the newListener event
      newListener: false,
      // Set this to `true` if you want to emit the removeListener event
      removeListener: false,
      // The maximum amount of listeners that can be assigned to an event
      maxListeners: 10,
      // Show event name in memory leak message when more than maximum amount of listeners is assigned
      verboseMemoryLeak: false,
      // Disable throwing uncaughtException if an error event is emitted and it has no listeners
      ignoreErrors: false,
    }),
  ],
  controllers: [
    NotificationsController,
    NotificationPreferencesController,
    MonitoringController,
  ],
  providers: [
    // Services
    NotificationService,
    NotificationPreferenceService,
    NotificationTemplateService,
    NotificationPrivacyService,
    NotificationSchedulerService,
    QueueService,
    RateLimitingService,
    PhoneNumberService,
    QueueMonitoringService,
    NotificationLoggerService,
    AlertingService,

    // Factories
    NotificationChannelFactory,
    EmailProviderFactory,
    SmsProviderFactory,

    // Channel handlers
    InAppChannelService,
    EmailChannelService,
    SmsChannelService,

    // Queue processors
    EmailQueueProcessor,
    SmsQueueProcessor,

    // WebSocket Gateway
    NotificationGateway,

    // Event Listeners
    NotificationEventListener,

    // Guards
    NotificationRateLimitGuard,
    TenantRateLimitGuard,
    NotificationOwnershipGuard,
    AdminRoleGuard,
    TenantIsolationGuard,
  ],
  exports: [
    NotificationService,
    NotificationChannelFactory,
    NotificationPreferenceService,
    NotificationTemplateService,
    NotificationPrivacyService,
    QueueService,
    RateLimitingService,
    PhoneNumberService,
    QueueMonitoringService,
    NotificationLoggerService,
    AlertingService,
    EmailProviderFactory,
    SmsProviderFactory,
    InAppChannelService,
    EmailChannelService,
    SmsChannelService,
    NotificationGateway,
  ],
})
export class NotificationsModule implements OnModuleInit {
  constructor(
    private readonly channelFactory: NotificationChannelFactory,
    private readonly inAppChannel: InAppChannelService,
    private readonly emailChannel: EmailChannelService,
    private readonly smsChannel: SmsChannelService,
  ) {}

  /**
   * Register all channel handlers with the factory when the module initializes
   */
  onModuleInit() {
    // Register all available channel handlers
    this.channelFactory.registerChannel(this.inAppChannel);
    this.channelFactory.registerChannel(this.emailChannel);
    this.channelFactory.registerChannel(this.smsChannel);
  }
}
