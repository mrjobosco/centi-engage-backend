import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

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
} from './services';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    NotificationsModule,
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
  ],
  exports: [
    InvitationService,
    InvitationValidationService,
    InvitationNotificationService,
    InvitationAcceptanceService,
  ],
})
export class InvitationModule {}
