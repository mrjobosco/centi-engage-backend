import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { OTPMetricsService } from '../services/otp-metrics.service';
import { OTPAuditService } from '../services/otp-audit.service';
import type { User } from '@prisma/client';

@ApiTags('OTP Monitoring')
@Controller('auth/otp/monitoring')
@UseGuards(JwtAuthGuard)
export class OTPMonitoringController {
  constructor(
    private readonly otpMetrics: OTPMetricsService,
    private readonly otpAudit: OTPAuditService,
  ) {}

  @Get('health')
  @ApiOperation({
    summary: 'Get OTP system health check',
    description:
      'Returns the current health status of the OTP system including connectivity checks and performance metrics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health check completed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        checks: {
          type: 'object',
          properties: {
            redisConnectivity: { type: 'boolean' },
            emailService: { type: 'boolean' },
            databaseConnectivity: { type: 'boolean' },
            otpGeneration: { type: 'boolean' },
            otpVerification: { type: 'boolean' },
          },
        },
        metrics: {
          type: 'object',
          properties: {
            responseTime: { type: 'number' },
            errorRate: { type: 'number' },
            throughput: { type: 'number' },
          },
        },
        lastUpdated: { type: 'string', format: 'date-time' },
      },
    },
  })
  async getHealthCheck() {
    return await this.otpMetrics.getHealthCheck();
  }

  @Get('metrics')
  @ApiOperation({
    summary: 'Get OTP system metrics',
    description:
      'Returns comprehensive metrics about OTP operations including generation rates, verification success rates, and performance data.',
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    description: 'Filter metrics by tenant ID',
  })
  @ApiQuery({
    name: 'hours',
    required: false,
    description: 'Number of hours to look back (default: 24)',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        otpGenerationRate: {
          type: 'number',
          description: 'OTPs generated per hour',
        },
        otpGenerationSuccess: {
          type: 'number',
          description: 'Percentage of successful generations',
        },
        otpVerificationRate: {
          type: 'number',
          description: 'Verifications attempted per hour',
        },
        otpVerificationSuccess: {
          type: 'number',
          description: 'Percentage of successful verifications',
        },
        averageVerificationAttempts: {
          type: 'number',
          description: 'Average attempts before success',
        },
        emailDeliverySuccess: {
          type: 'number',
          description: 'Percentage of successful email deliveries',
        },
        emailDeliveryFailure: {
          type: 'number',
          description: 'Percentage of failed email deliveries',
        },
        averageOTPGenerationTime: {
          type: 'number',
          description: 'Average time to generate OTP (ms)',
        },
        averageOTPVerificationTime: {
          type: 'number',
          description: 'Average time to verify OTP (ms)',
        },
        redisOperationSuccess: {
          type: 'number',
          description: 'Percentage of successful Redis operations',
        },
        redisOperationLatency: {
          type: 'number',
          description: 'Average Redis operation latency (ms)',
        },
        rateLimitHitRate: {
          type: 'number',
          description: 'Rate limit violations per hour',
        },
        suspiciousActivityCount: {
          type: 'number',
          description: 'Suspicious activities detected',
        },
        averageTimeToVerify: {
          type: 'number',
          description: 'Average time from generation to verification',
        },
        abandonmentRate: {
          type: 'number',
          description: 'Percentage of OTPs that expire unused',
        },
        resendRate: {
          type: 'number',
          description: 'Percentage of OTPs that are resent',
        },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Get OTP audit statistics',
    description:
      'Returns statistical analysis of OTP audit events including success rates, failure reasons, and usage patterns.',
  })
  @ApiQuery({
    name: 'tenantId',
    required: false,
    description: 'Filter statistics by tenant ID',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter statistics by user ID',
  })
  @ApiQuery({
    name: 'hours',
    required: false,
    description: 'Number of hours to look back (default: 24)',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP audit statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalOTPEvents: { type: 'number' },
        otpGenerationCount: { type: 'number' },
        otpVerificationCount: { type: 'number' },
        successfulVerifications: { type: 'number' },
        failedVerifications: { type: 'number' },
        rateLimitViolations: { type: 'number' },
        averageVerificationTime: { type: 'number' },
        topFailureReasons: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              reason: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        emailDeliveryStats: {
          type: 'object',
          properties: {
            sent: { type: 'number' },
            failed: { type: 'number' },
            pending: { type: 'number' },
          },
        },
        verificationMethodStats: {
          type: 'object',
          properties: {
            emailPassword: { type: 'number' },
            oauthBypass: { type: 'number' },
          },
        },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Get OTP audit logs for current user',
    description:
      'Returns audit logs for OTP operations performed by the current authenticated user.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of logs to return (default: 50, max: 100)',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'User OTP audit logs retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          action: { type: 'string' },
          ipAddress: { type: 'string' },
          userAgent: { type: 'string' },
          metadata: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getUserAuditLogs(
    @CurrentUser() user: User,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
  ) {
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    return await this.otpAudit.getUserOTPAuditLogs(
      user.id,
      user.tenantId,
      limit,
    );
  }

  @Get('audit/logs/tenant')
  @ApiOperation({
    summary: 'Get OTP audit logs for tenant',
    description:
      'Returns audit logs for OTP operations within the current tenant. Requires appropriate permissions.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of logs to return (default: 100, max: 500)',
    type: 'number',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of logs to skip for pagination (default: 0)',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant OTP audit logs retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          action: { type: 'string' },
          userId: { type: 'string' },
          ipAddress: { type: 'string' },
          userAgent: { type: 'string' },
          metadata: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
          user: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              firstName: { type: 'string' },
              lastName: { type: 'string' },
            },
          },
        },
      },
    },
  })
  async getTenantAuditLogs(
    @CurrentUser() user: User,
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

    // TODO: Add permission check for tenant admin access
    // For now, allow any authenticated user to view tenant logs

    return await this.otpAudit.getTenantOTPAuditLogs(
      user.tenantId,
      limit,
      offset,
    );
  }

  @Get('performance/summary')
  @ApiOperation({
    summary: 'Get OTP performance summary',
    description:
      'Returns a summary of OTP system performance including response times, throughput, and error rates.',
  })
  @ApiQuery({
    name: 'hours',
    required: false,
    description: 'Number of hours to look back (default: 1)',
    type: 'number',
  })
  @ApiResponse({
    status: 200,
    description: 'Performance summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        timeRange: {
          type: 'object',
          properties: {
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time' },
            hours: { type: 'number' },
          },
        },
        operations: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            successful: { type: 'number' },
            failed: { type: 'number' },
            successRate: { type: 'number' },
          },
        },
        performance: {
          type: 'object',
          properties: {
            averageResponseTime: { type: 'number' },
            p95ResponseTime: { type: 'number' },
            p99ResponseTime: { type: 'number' },
            throughputPerHour: { type: 'number' },
          },
        },
        breakdown: {
          type: 'object',
          properties: {
            generation: {
              type: 'object',
              properties: {
                count: { type: 'number' },
                averageTime: { type: 'number' },
                successRate: { type: 'number' },
              },
            },
            verification: {
              type: 'object',
              properties: {
                count: { type: 'number' },
                averageTime: { type: 'number' },
                successRate: { type: 'number' },
              },
            },
            emailDelivery: {
              type: 'object',
              properties: {
                count: { type: 'number' },
                averageTime: { type: 'number' },
                successRate: { type: 'number' },
              },
            },
            redisOperations: {
              type: 'object',
              properties: {
                count: { type: 'number' },
                averageTime: { type: 'number' },
                successRate: { type: 'number' },
              },
            },
          },
        },
      },
    },
  })
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
