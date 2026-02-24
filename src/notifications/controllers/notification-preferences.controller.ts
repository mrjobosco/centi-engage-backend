import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireEmailVerification } from '../../auth/decorators/require-email-verification.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { NotificationRateLimitGuard, TenantIsolationGuard } from '../guards';
import type { RequestUser } from '../../auth/interfaces/request-with-user.interface';

@UseGuards(JwtAuthGuard, TenantIsolationGuard, NotificationRateLimitGuard)
@RequireEmailVerification()
@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(
    private readonly preferenceService: NotificationPreferenceService,
  ) { }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute for preferences
  async getUserPreferences(@CurrentUser() user: RequestUser) {
    return this.preferenceService.getUserPreferences(user.id);
  }

  @Get('categories')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute for categories
  async getCategories() {
    const categories = await this.preferenceService.getAvailableCategories();
    return { categories };
  }

  @Put(':category')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 preference updates per minute
  @HttpCode(HttpStatus.OK)
  async updatePreference(
    @CurrentUser() user: RequestUser,
    @Param('category') category: string,
    @Body() updatePreferenceDto: UpdatePreferenceDto,
  ) {
    return this.preferenceService.updatePreference(
      user.id,
      category,
      updatePreferenceDto,
    );
  }
}
