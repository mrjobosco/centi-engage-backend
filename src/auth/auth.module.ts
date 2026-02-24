import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { HealthController } from './controllers/health.controller';
import { OTPMonitoringController } from './controllers/otp-monitoring.controller';
import { AuthService } from './auth.service';
import { AuthAuditService } from './services/auth-audit.service';
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { OAuthStateService } from './services/oauth-state.service';
import { GoogleAuthMetricsService } from './services/google-auth-metrics.service';
import { AuthCookieService } from './services/auth-cookie.service';
import { RefreshSessionService } from './services/refresh-session.service';
import { GoogleAuthMetricsModule } from './modules/google-auth-metrics.module';
import { EmailVerificationModule } from './modules/email-verification.module';
import { DatabaseModule } from '../database/database.module';
import { TenantModule } from '../tenant/tenant.module';

@Global()
@Module({
  imports: [
    DatabaseModule,
    TenantModule,
    EmailVerificationModule,
    GoogleAuthMetricsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      global: true,
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
  controllers: [AuthController, HealthController, OTPMonitoringController],
  providers: [
    AuthService,
    AuthAuditService,
    GoogleAuthService,
    GoogleOAuthService,
    OAuthStateService,
    GoogleAuthMetricsService,
    AuthCookieService,
    RefreshSessionService,
  ],
  exports: [
    AuthService,
    AuthAuditService,
    GoogleAuthService,
    GoogleOAuthService,
    OAuthStateService,
    GoogleAuthMetricsService,
    AuthCookieService,
    RefreshSessionService,
    EmailVerificationModule,
  ],
})
export class AuthModule {}
