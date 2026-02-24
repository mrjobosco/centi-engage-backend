import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../guards/admin-role.guard';
import { MetricsService } from '../services/metrics.service';
import { QueueMonitoringService } from '../services/queue-monitoring.service';
import { AlertingService } from '../services/alerting.service';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class MonitoringController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly queueMonitoringService: QueueMonitoringService,
    private readonly alertingService: AlertingService,
  ) {}

  @Get('queue-stats')
  async getQueueStats() {
    return await this.queueMonitoringService.getQueueStatistics();
  }

  @Get('alert-config')
  getAlertConfig() {
    return this.alertingService.getAlertConfig();
  }

  @Get('alert-history')
  getAlertHistory() {
    return this.alertingService.getAlertHistory();
  }

  @Post('test-alert')
  async triggerTestAlert() {
    await this.alertingService.triggerTestAlert();
    return { message: 'Test alert triggered successfully' };
  }

  @Post('check-alerts')
  async checkAlerts() {
    await this.alertingService.checkAlertConditions();
    return { message: 'Alert conditions checked successfully' };
  }
}
