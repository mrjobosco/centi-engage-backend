import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../../redis/redis.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { DatabaseModule } from '../../database/database.module';
import { EmailOTPService } from '../services/email-otp.service';
import { OTPStorageService } from '../services/otp-storage.service';
import { OTPAuditService } from '../services/otp-audit.service';
import { OTPMetricsService } from '../services/otp-metrics.service';
import { EmailVerificationGuard } from '../guards/email-verification.guard';

@Module({
  imports: [ConfigModule, RedisModule, NotificationsModule, DatabaseModule],
  providers: [
    EmailOTPService,
    OTPStorageService,
    OTPAuditService,
    OTPMetricsService,
    EmailVerificationGuard,
  ],
  exports: [
    EmailOTPService,
    OTPStorageService,
    OTPAuditService,
    OTPMetricsService,
    EmailVerificationGuard,
  ],
})
export class EmailVerificationModule { }
