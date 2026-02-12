import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from '@nestjs-modules/ioredis';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TenantModule } from '../tenant/tenant.module';

// Controllers
import {
  InvitationController,
  InvitationAcceptanceController,
} from './controllers';

// Services
import {
  InvitationService,
  InvitationValidationService,
  InvitationNotificationService,
  InvitationAcceptanceService,
  InvitationAuditService,
  InvitationRateLimitService,
  InvitationStatusService,
  InvitationManagementService,
} from './services';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    NotificationsModule,
    TenantModule,
    RedisModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url:
          configService.get<string>('REDIS_URL') ||
          configService.get<string>('config.redis.url') ||
          'redis://:redis_password@redis:6379',
      }),
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('config.jwt.secret'),
        signOptions: {
          expiresIn:
            configService.get<string>('config.jwt.expiresIn') || ('15m' as any),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [InvitationController, InvitationAcceptanceController],
  providers: [
    InvitationService,
    InvitationValidationService,
    InvitationNotificationService,
    InvitationAcceptanceService,
    InvitationAuditService,
    InvitationRateLimitService,
    InvitationStatusService,
    InvitationManagementService,
  ],
  exports: [
    InvitationService,
    InvitationValidationService,
    InvitationNotificationService,
    InvitationAcceptanceService,
    InvitationAuditService,
    InvitationRateLimitService,
    InvitationStatusService,
    InvitationManagementService,
  ],
})
export class InvitationModule { }
