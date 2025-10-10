import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { MetricsService } from '../services/metrics.service';
import { QueueMonitoringService } from '../services/queue-monitoring.service';
import { AlertingService } from '../services/alerting.service';

@ApiTags('Monitoring')
@Controller('monitoring')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
@ApiBearerAuth()
export class MonitoringController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly queueMonitoringService: QueueMonitoringService,
    private readonly alertingService: AlertingService,
  ) { }

  @Get('queue-stats')
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved successfully',
  })
  async getQueueStats() {
    return await this.queueMonitoringService.getQueueStatistics();
  }

  @Get('alert-config')
  @ApiOperation({ summary: 'Get alert configuration' })
  @ApiResponse({
    status: 200,
    description: 'Alert configuration retrieved successfully',
  })
  getAlertConfig() {
    return this.alertingService.getAlertConfig();
  }

  @Get('alert-history')
  @ApiOperation({ summary: 'Get alert history' })
  @ApiResponse({
    status: 200,
    description: 'Alert history retrieved successfully',
  })
  getAlertHistory() {
    return this.alertingService.getAlertHistory();
  }

  @Post('test-alert')
  @ApiOperation({ summary: 'Trigger a test alert' })
  @ApiResponse({
    status: 200,
    description: 'Test alert triggered successfully',
  })
  async triggerTestAlert() {
    await this.alertingService.triggerTestAlert();
    return { message: 'Test alert triggered successfully' };
  }

  @Post('check-alerts')
  @ApiOperation({ summary: 'Manually check alert conditions' })
  @ApiResponse({
    status: 200,
    description: 'Alert conditions checked successfully',
  })
  async checkAlerts() {
    await this.alertingService.checkAlertConditions();
    return { message: 'Alert conditions checked successfully' };
  }
}
