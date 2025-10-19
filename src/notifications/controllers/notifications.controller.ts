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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
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

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@ApiSecurity('tenant-id')
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
  @ApiOperation({
    summary: 'Create notification',
    description: 'Create a new notification for the current user',
  })
  @ApiBody({
    type: CreateNotificationDto,
    description: 'Notification data',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        userId: { type: 'string' },
        type: { type: 'string', enum: ['INFO', 'WARNING', 'SUCCESS', 'ERROR'] },
        category: { type: 'string' },
        title: { type: 'string' },
        message: { type: 'string' },
        data: { type: 'object', nullable: true },
        channelsSent: { type: 'array', items: { type: 'string' } },
        readAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
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
  @ApiOperation({
    summary: 'Broadcast notification to tenant',
    description:
      'Send a notification to all users in the current tenant (admin only)',
  })
  @ApiBody({
    type: CreateNotificationDto,
    description: 'Notification data',
  })
  @ApiResponse({
    status: 201,
    description: 'Notifications sent to all tenant users',
    schema: {
      type: 'object',
      properties: {
        notifications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tenantId: { type: 'string' },
              userId: { type: 'string' },
              type: {
                type: 'string',
                enum: ['INFO', 'WARNING', 'SUCCESS', 'ERROR'],
              },
              category: { type: 'string' },
              title: { type: 'string' },
              message: { type: 'string' },
              data: { type: 'object', nullable: true },
              channelsSent: { type: 'array', items: { type: 'string' } },
              readAt: { type: 'string', format: 'date-time', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              expiresAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
            },
          },
        },
        count: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
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
  @ApiOperation({
    summary: 'Get user notifications',
    description:
      'Get paginated list of notifications for the current user with filtering options',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        notifications: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tenantId: { type: 'string' },
              userId: { type: 'string' },
              type: {
                type: 'string',
                enum: ['INFO', 'WARNING', 'SUCCESS', 'ERROR'],
              },
              category: { type: 'string' },
              title: { type: 'string' },
              message: { type: 'string' },
              data: { type: 'object', nullable: true },
              channelsSent: { type: 'array', items: { type: 'string' } },
              readAt: { type: 'string', format: 'date-time', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              expiresAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
            },
          },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserNotifications(
    @CurrentUser() user: RequestUser,
    @Query() filters: NotificationFilterDto,
  ) {
    return this.notificationService.getUserNotifications(user.id, filters);
  }

  @Get('unread-count')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 requests per minute for count checks
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Get the count of unread notifications for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        count: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@CurrentUser() user: RequestUser) {
    const count = await this.notificationService.getUnreadCount(user.id);
    return { count };
  }

  @Get(':id')
  @UseGuards(NotificationOwnershipGuard)
  @ApiOperation({
    summary: 'Get notification by ID',
    description:
      'Get a specific notification by ID. User can only access their own notifications.',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        userId: { type: 'string' },
        type: { type: 'string', enum: ['INFO', 'WARNING', 'SUCCESS', 'ERROR'] },
        category: { type: 'string' },
        title: { type: 'string' },
        message: { type: 'string' },
        data: { type: 'object', nullable: true },
        channelsSent: { type: 'array', items: { type: 'string' } },
        readAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or access denied',
  })
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
  @ApiOperation({
    summary: 'Mark notification as read',
    description:
      'Mark a specific notification as read. User can only mark their own notifications.',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or access denied',
  })
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
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all unread notifications as read for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({
    summary: 'Delete notification',
    description:
      'Delete (dismiss) a specific notification. User can only delete their own notifications.',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Notification not found or access denied',
  })
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
