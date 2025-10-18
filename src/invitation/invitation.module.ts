import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
    ScheduleModule.forRoot(),
    RedisModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
      }),
      inject: [ConfigService],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('config.jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('config.jwt.expiresIn'),
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
