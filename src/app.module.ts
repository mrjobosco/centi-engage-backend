import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import notificationConfig from './notifications/config/notification.config';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { TenantModule } from './tenant';
import { TenantIdentificationMiddleware } from './tenant/tenant-identification.middleware';
import { AuthModule } from './auth/auth.module';
import { PermissionModule } from './permission/permission.module';
import { RoleModule } from './role/role.module';
import { UserModule } from './user/user.module';
import { ProjectModule } from './project/project.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SharedMetricsModule } from './common/modules/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, notificationConfig],
      envFilePath: ['.env.test', '.env'],
      validate,
      ignoreEnvFile: false,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 10, // 10 requests per ttl
      },
    ]),
    SharedMetricsModule,
    DatabaseModule,
    TenantModule,
    AuthModule,
    PermissionModule,
    RoleModule,
    UserModule,
    ProjectModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Only apply throttler guard in non-test environments
    ...(process.env.NODE_ENV !== 'test'
      ? [
          {
            provide: 'APP_GUARD',
            useClass: ThrottlerGuard,
          },
        ]
      : []),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantIdentificationMiddleware)
      .exclude(
        // Public endpoints that don't require tenant identification
        '/auth/login',
        '/auth/register',
        '/auth/google/callback',
        '/tenants',
        '/',
      )
      .forRoutes('*');
  }
}
