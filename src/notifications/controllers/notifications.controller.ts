import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { NotificationService } from '../services/notification.service';
import { NotificationPrivacyService } from '../services/notification-privacy.service';
import { NotificationFilterDto } from '../dto/notification-filter.dto';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireEmailVerification } from '../../auth/decorators/require-email-verification.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import {
  NotificationRateLimitGuard,
  TenantRateLimitGuard,
  NotificationOwnershipGuard,
  AdminRoleGuard,
  TenantIsolationGuard,
} from '../guards';
import type { RequestUser } from '../../auth/interfaces/request-with-user.interface';

@UseGuards(JwtAuthGuard, TenantIsolationGuard, NotificationRateLimitGuard)
@RequireEmailVerification()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly privacyService: NotificationPrivacyService,
  ) { }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 notifications per minute per user
  @HttpCode(HttpStatus.CREATED)
  async createNotification(
    @CurrentUser() user: RequestUser,
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    // Transform the DTO to match the service interface
    const payload = {
      ...createNotificationDto,
      expiresAt: createNotificationDto.expiresAt
        ? new Date(createNotificationDto.expiresAt)
        : undefined,
    };
    return this.notificationService.sendToUser(user.id, payload);
  }

  @Post('tenant-broadcast')
  @UseGuards(AdminRoleGuard, TenantRateLimitGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 tenant broadcasts per 5 minutes
  @HttpCode(HttpStatus.CREATED)
  async broadcastToTenant(
    @CurrentUser() user: RequestUser,
    @Body() createNotificationDto: CreateNotificationDto,
  ) {
    // Transform the DTO to match the service interface
    const payload = {
      ...createNotificationDto,
      expiresAt: createNotificationDto.expiresAt
        ? new Date(createNotificationDto.expiresAt)
        : undefined,
    };
    const notifications = await this.notificationService.sendToTenant(payload);
    return {
      notifications,
      count: notifications.length,
    };
  }

  @Get()
  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 requests per minute for reading
  async getUserNotifications(
    @CurrentUser() user: RequestUser,
    @Query() filters: NotificationFilterDto,
  ) {
    return this.notificationService.getUserNotifications(user.id, filters);
  }

  @Get('unread-count')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute for count checks
  async getUnreadCount(@CurrentUser() user: RequestUser) {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  @Get(':id')
  @UseGuards(NotificationOwnershipGuard)
  async getNotification(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    // Get user notifications with specific ID filter
    const result = await this.notificationService.getUserNotifications(
      user.id,
      {
        page: 1,
        limit: 1,
      },
    );

    // Find the specific notification
    const notification = result.notifications.find((n) => n.id === id);

    if (!notification) {
      throw new Error('Notification not found or access denied');
    }

    return notification;
  }

  @Patch(':id/read')
  @UseGuards(NotificationOwnershipGuard)
  @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 mark-as-read operations per minute
  @HttpCode(HttpStatus.OK)
  async markAsRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.notificationService.markAsRead(id, user.id);
    return {
      success: true,
      message: 'Notification marked as read',
    };
  }

  @Patch('read-all')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 mark-all-as-read operations per minute
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser() user: RequestUser) {
    await this.notificationService.markAllAsRead(user.id);
    return {
      success: true,
      message: 'All notifications marked as read',
    };
  }

  @Delete(':id')
  @UseGuards(NotificationOwnershipGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 delete operations per minute
  @HttpCode(HttpStatus.OK)
  async deleteNotification(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    await this.privacyService.softDeleteNotification(id, user.id, user.id);
    return {
      success: true,
      message: 'Notification deleted successfully',
    };
  }
}
