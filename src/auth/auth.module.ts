import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { HealthController } from './controllers/health.controller';
import { AuthService } from './auth.service';
import { AuthAuditService } from './services/auth-audit.service';
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { OAuthStateService } from './services/oauth-state.service';
import { GoogleAuthMetricsService } from './services/google-auth-metrics.service';
import { GoogleAuthMetricsModule } from './modules/google-auth-metrics.module';
import { EmailOTPService } from './services/email-otp.service';
import { OTPStorageService } from './services/otp-storage.service';
import { EmailVerificationGuard } from './guards/email-verification.guard';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';
import { RedisModule } from '../redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    TenantModule,
    RedisModule,
    NotificationsModule,
    GoogleAuthMetricsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      global: true,
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('config.jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('config.jwt.expiresIn'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, HealthController],
  providers: [
    AuthService,
    AuthAuditService,
    GoogleAuthService,
    GoogleOAuthService,
    OAuthStateService,
    GoogleAuthMetricsService,
    EmailOTPService,
    OTPStorageService,
    EmailVerificationGuard,
  ],
  exports: [
    AuthService,
    AuthAuditService,
    GoogleAuthService,
    GoogleOAuthService,
    OAuthStateService,
    GoogleAuthMetricsService,
    EmailOTPService,
    OTPStorageService,
    EmailVerificationGuard,
  ],
})
export class AuthModule { }
