import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { OTPMetricsService } from '../services/otp-metrics.service';
import { OTPAuditService } from '../services/otp-audit.service';
import type { RequestUser } from '../interfaces/request-with-user.interface';

@Controller('auth/otp/monitoring')
@UseGuards(JwtAuthGuard)
export class OTPMonitoringController {
  constructor(
    private readonly otpMetrics: OTPMetricsService,
    private readonly otpAudit: OTPAuditService,
  ) { }

  @Get('health')
  async getHealthCheck() {
    return await this.otpMetrics.getHealthCheck();
  }

  @Get('metrics')
  async getMetrics(
    @Query('tenantId') tenantId?: string,
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number = 24,
  ) {
    if (hours < 1 || hours > 168) {
      // Max 1 week
      throw new BadRequestException('Hours must be between 1 and 168 (1 week)');
    }

    const timeRange = {
      from: new Date(Date.now() - hours * 60 * 60 * 1000),
      to: new Date(),
    };

    return await this.otpMetrics.getOTPMetrics(tenantId, timeRange);
  }

  @Get('audit/statistics')
  async getAuditStatistics(
    @Query('tenantId') tenantId?: string,
    @Query('userId') userId?: string,
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number = 24,
  ) {
    if (hours < 1 || hours > 168) {
      // Max 1 week
      throw new BadRequestException('Hours must be between 1 and 168 (1 week)');
    }

    const timeRange = {
      from: new Date(Date.now() - hours * 60 * 60 * 1000),
      to: new Date(),
    };

    const query = {
      ...(tenantId && { tenantId }),
      ...(userId && { userId }),
    };

    return await this.otpAudit.getOTPAuditStatistics(query, timeRange);
  }

  @Get('audit/logs/user')
  async getUserAuditLogs(
    @CurrentUser() user: RequestUser,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
  ) {
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    return await this.otpAudit.getUserOTPAuditLogs(
      user.id,
      user.tenantId || 'system-audit',
      limit,
    );
  }

  @Get('audit/logs/tenant')
  async getTenantAuditLogs(
    @CurrentUser() user: RequestUser,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe)
    limit: number = 100,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number = 0,
  ) {
    if (limit < 1 || limit > 500) {
      throw new BadRequestException('Limit must be between 1 and 500');
    }

    if (offset < 0) {
      throw new BadRequestException('Offset must be non-negative');
    }

    const hasAdminRole = user.roles?.some((role) =>
      ['admin', 'super_admin', 'owner'].includes(role.name?.toLowerCase()),
    );
    if (!hasAdminRole) {
      throw new ForbiddenException(
        'Tenant admin role required to view tenant audit logs',
      );
    }

    return await this.otpAudit.getTenantOTPAuditLogs(
      user.tenantId || 'system-audit',
      limit,
      offset,
    );
  }

  @Get('performance/summary')
  getPerformanceSummary(
    @Query('hours', new DefaultValuePipe(1), ParseIntPipe) hours: number = 1,
  ) {
    if (hours < 1 || hours > 24) {
      throw new BadRequestException('Hours must be between 1 and 24');
    }

    const timeRange = {
      from: new Date(Date.now() - hours * 60 * 60 * 1000),
      to: new Date(),
    };

    // This would be implemented with more sophisticated performance tracking
    // For now, return a basic structure
    return {
      timeRange: {
        from: timeRange.from,
        to: timeRange.to,
        hours,
      },
      operations: {
        total: 0,
        successful: 0,
        failed: 0,
        successRate: 100,
      },
      performance: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughputPerHour: 0,
      },
      breakdown: {
        generation: {
          count: 0,
          averageTime: 0,
          successRate: 100,
        },
        verification: {
          count: 0,
          averageTime: 0,
          successRate: 100,
        },
        emailDelivery: {
          count: 0,
          averageTime: 0,
          successRate: 100,
        },
        redisOperations: {
          count: 0,
          averageTime: 0,
          successRate: 100,
        },
      },
    };
  }
}
