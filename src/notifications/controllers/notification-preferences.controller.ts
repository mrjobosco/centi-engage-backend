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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireEmailVerification } from '../../auth/decorators/require-email-verification.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { NotificationRateLimitGuard, TenantIsolationGuard } from '../guards';
import type { RequestUser } from '../../auth/interfaces/request-with-user.interface';

@ApiTags('Notification Preferences')
@ApiBearerAuth('JWT-auth')
@ApiSecurity('tenant-id')
@UseGuards(JwtAuthGuard, TenantIsolationGuard, NotificationRateLimitGuard)
@RequireEmailVerification()
@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(
    private readonly preferenceService: NotificationPreferenceService,
  ) { }

  @Get()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 requests per minute for preferences
  @ApiOperation({
    summary: 'Get user notification preferences',
    description: 'Get all notification preferences for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tenantId: { type: 'string' },
          userId: { type: 'string' },
          category: { type: 'string' },
          inAppEnabled: { type: 'boolean' },
          emailEnabled: { type: 'boolean' },
          smsEnabled: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserPreferences(@CurrentUser() user: RequestUser) {
    return this.preferenceService.getUserPreferences(user.id);
  }

  @Get('categories')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 requests per minute for categories
  @ApiOperation({
    summary: 'Get available notification categories',
    description:
      'Get list of all available notification categories for the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'user_activity',
            'system',
            'invoice',
            'project',
            'security',
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCategories() {
    const categories = await this.preferenceService.getAvailableCategories();
    return { categories };
  }

  @Put(':category')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 preference updates per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update notification preferences for category',
    description:
      'Update notification channel preferences for a specific category',
  })
  @ApiParam({
    name: 'category',
    description: 'Notification category',
    example: 'invoice',
  })
  @ApiResponse({
    status: 200,
    description: 'Preferences updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        userId: { type: 'string' },
        category: { type: 'string' },
        inAppEnabled: { type: 'boolean' },
        emailEnabled: { type: 'boolean' },
        smsEnabled: { type: 'boolean' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid preference data' })
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
