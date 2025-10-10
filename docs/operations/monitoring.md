# System Monitoring

This document covers monitoring, logging, alerting, and observability for the multi-tenant NestJS application.

## Overview

The application includes comprehensive monitoring capabilities:

- **Metrics Collection** - Prometheus metrics for performance monitoring
- **Health Checks** - Application and dependency health monitoring
- **Logging** - Structured logging with correlation IDs
- **Alerting** - Automated alerts for critical issues
- **Tracing** - Request tracing for debugging (optional)

## Metrics

### Prometheus Metrics

The application exposes Prometheus metrics at `/metrics` endpoint.

#### Built-in Metrics

**HTTP Metrics:**
- `http_requests_total` - Total HTTP requests by method, route, and status
- `http_request_duration_seconds` - HTTP request duration histogram
- `http_request_size_bytes` - HTTP request size histogram
- `http_response_size_bytes` - HTTP response size histogram

**Application Metrics:**
- `nodejs_heap_size_total_bytes` - Node.js heap size
- `nodejs_heap_size_used_bytes` - Node.js heap usage
- `nodejs_external_memory_bytes` - Node.js external memory
- `nodejs_gc_duration_seconds` - Garbage collection duration

**Database Metrics:**
- `database_connections_active` - Active database connections
- `database_query_duration_seconds` - Database query duration
- `database_queries_total` - Total database queries

**Queue Metrics:**
- `queue_jobs_total` - Total queue jobs by status
- `queue_job_duration_seconds` - Queue job processing duration
- `queue_active_jobs` - Currently active jobs
- `queue_waiting_jobs` - Jobs waiting in queue

#### Custom Metrics

**Tenant Metrics:**
```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

// Tenant-specific request counter
const tenantRequestsTotal = new Counter({
  name: 'tenant_requests_total',
  help: 'Total requests per tenant',
  labelNames: ['tenant_id', 'method', 'route'],
});

// Notification metrics
const notificationsSentTotal = new Counter({
  name: 'notifications_sent_total',
  help: 'Total notifications sent',
  labelNames: ['tenant_id', 'channel', 'status'],
});

const notificationDeliveryDuration = new Histogram({
  name: 'notification_delivery_duration_seconds',
  help: 'Notification delivery duration',
  labelNames: ['channel', 'provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Authentication metrics
const authAttemptsTotal = new Counter({
  name: 'auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['tenant_id', 'method', 'status'],
});
```

### Metrics Collection Setup

#### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'nestjs-app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "NestJS Multi-tenant Application",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx errors"
          }
        ]
      }
    ]
  }
}
```

## Logging

### Structured Logging

The application uses structured logging with correlation IDs for request tracing.

#### Log Configuration

```typescript
// logger.config.ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

export const loggerConfig = WinstonModule.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, context, trace, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        context,
        trace,
        ...meta,
      });
    }),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});
```

#### Correlation ID Middleware

```typescript
// correlation-id.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] || uuidv4();
    req['correlationId'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
```

#### Logging Service

```typescript
// logging.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class LoggingService extends Logger {
  logWithContext(
    level: string,
    message: string,
    context: string,
    meta: any = {},
  ) {
    const logData = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    super.log(JSON.stringify(logData), context);
  }

  logRequest(req: any, res: any, responseTime: number) {
    this.logWithContext('info', 'HTTP Request', 'HTTP', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      correlationId: req.correlationId,
      tenantId: req.headers['x-tenant-id'],
    });
  }

  logError(error: Error, context: string, meta: any = {}) {
    this.logWithContext('error', error.message, context, {
      stack: error.stack,
      ...meta,
    });
  }
}
```

### Log Aggregation

#### ELK Stack Configuration

**Filebeat Configuration** (`filebeat.yml`):
```yaml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /app/logs/*.log
  json.keys_under_root: true
  json.add_error_key: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "nestjs-app-%{+yyyy.MM.dd}"

processors:
  - add_host_metadata:
      when.not.contains.tags: forwarded
```

**Logstash Configuration** (`logstash.conf`):
```ruby
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "nestjs-app" {
    json {
      source => "message"
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
    
    mutate {
      add_field => { "service" => "nestjs-app" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "nestjs-app-%{+YYYY.MM.dd}"
  }
}
```

## Alerting

### Alert Rules

#### Prometheus Alert Rules

```yaml
# alert_rules.yml
groups:
  - name: nestjs-app
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }} seconds"

      - alert: DatabaseConnectionsHigh
        expr: database_connections_active > 80
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High database connection usage"
          description: "Database connections: {{ $value }}"

      - alert: QueueDepthHigh
        expr: queue_waiting_jobs > 1000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Queue depth is high"
          description: "{{ $value }} jobs waiting in queue"

      - alert: ApplicationDown
        expr: up{job="nestjs-app"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Application is down"
          description: "NestJS application is not responding"
```

#### Application-Level Alerts

```typescript
// alerting.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  constructor(private configService: ConfigService) {}

  async sendAlert(alert: {
    level: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    metadata?: any;
  }) {
    if (!this.configService.get('ALERTING_ENABLED')) {
      return;
    }

    try {
      // Send to webhook
      const webhookUrl = this.configService.get('ALERT_WEBHOOK_URL');
      if (webhookUrl) {
        await axios.post(webhookUrl, {
          ...alert,
          timestamp: new Date().toISOString(),
          service: 'nestjs-app',
        });
      }

      // Send to Slack
      const slackWebhook = this.configService.get('ALERT_SLACK_WEBHOOK_URL');
      if (slackWebhook) {
        await axios.post(slackWebhook, {
          text: `🚨 ${alert.title}`,
          attachments: [
            {
              color: this.getSlackColor(alert.level),
              fields: [
                {
                  title: 'Message',
                  value: alert.message,
                  short: false,
                },
                {
                  title: 'Level',
                  value: alert.level.toUpperCase(),
                  short: true,
                },
                {
                  title: 'Service',
                  value: 'nestjs-app',
                  short: true,
                },
              ],
            },
          ],
        });
      }

      this.logger.log(`Alert sent: ${alert.title}`);
    } catch (error) {
      this.logger.error('Failed to send alert', error.stack);
    }
  }

  private getSlackColor(level: string): string {
    switch (level) {
      case 'critical':
        return 'danger';
      case 'error':
        return 'danger';
      case 'warning':
        return 'warning';
      default:
        return 'good';
    }
  }
}
```

### Notification System Alerts

```typescript
// notification-monitoring.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertingService } from './alerting.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class NotificationMonitoringService {
  constructor(
    private alertingService: AlertingService,
    private metricsService: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkNotificationHealth() {
    const metrics = await this.metricsService.getNotificationMetrics();

    // Check failure rate
    if (metrics.failureRate > 0.05) {
      await this.alertingService.sendAlert({
        level: 'critical',
        title: 'High Notification Failure Rate',
        message: `Notification failure rate is ${(metrics.failureRate * 100).toFixed(2)}%`,
        metadata: { failureRate: metrics.failureRate },
      });
    }

    // Check queue depth
    if (metrics.queueDepth > 1000) {
      await this.alertingService.sendAlert({
        level: 'warning',
        title: 'High Notification Queue Depth',
        message: `${metrics.queueDepth} notifications waiting in queue`,
        metadata: { queueDepth: metrics.queueDepth },
      });
    }

    // Check processing lag
    if (metrics.processingLag > 300) {
      await this.alertingService.sendAlert({
        level: 'warning',
        title: 'High Notification Processing Lag',
        message: `Notification processing lag is ${metrics.processingLag} seconds`,
        metadata: { processingLag: metrics.processingLag },
      });
    }
  }
}
```

## Health Checks

### Application Health Checks

```typescript
// health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { 
  HealthCheck, 
  HealthCheckService, 
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memoryHealth: MemoryHealthIndicator,
    private diskHealth: DiskHealthIndicator,
    private prisma: PrismaService,
    private redis: Redis,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.checkRedis(),
      () => this.memoryHealth.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.diskHealth.checkStorage('storage', { path: '/', threshold: 0.9 }),
    ]);
  }

  @Get('detailed')
  async detailedHealth() {
    const [dbHealth, redisHealth, memoryUsage] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.getMemoryUsage(),
    ]);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version,
      environment: process.env.NODE_ENV,
      database: dbHealth,
      redis: redisHealth,
      memory: memoryUsage,
      queues: await this.getQueueHealth(),
    };
  }

  private async checkRedis() {
    try {
      await this.redis.ping();
      return { redis: { status: 'up' } };
    } catch (error) {
      throw new Error('Redis health check failed');
    }
  }

  private async checkDatabaseHealth() {
    try {
      const result = await this.prisma.$queryRaw`SELECT 1`;
      const connectionCount = await this.prisma.$queryRaw`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;
      
      return {
        status: 'up',
        activeConnections: connectionCount[0].active_connections,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  private async checkRedisHealth() {
    try {
      const info = await this.redis.info('memory');
      const memoryUsage = info.match(/used_memory:(\d+)/)?.[1];
      
      return {
        status: 'up',
        memoryUsage: memoryUsage ? parseInt(memoryUsage) : null,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  private getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
    };
  }

  private async getQueueHealth() {
    // Implementation depends on your queue system
    return {
      email: { waiting: 0, active: 0, failed: 0 },
      sms: { waiting: 0, active: 0, failed: 0 },
    };
  }
}
```

### External Health Monitoring

```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="https://yourdomain.com/health"
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"

check_health() {
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response "$HEALTH_URL")
    local http_code="${response: -3}"
    
    if [ "$http_code" -eq 200 ]; then
        echo "✅ Health check passed"
        return 0
    else
        echo "❌ Health check failed (HTTP $http_code)"
        
        # Send Slack notification
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 Health check failed for $HEALTH_URL (HTTP $http_code)\"}" \
            "$SLACK_WEBHOOK"
        
        return 1
    fi
}

# Run health check
check_health
```

## Performance Monitoring

### Application Performance Monitoring (APM)

#### New Relic Integration

```typescript
// newrelic.js
'use strict';

exports.config = {
  app_name: ['NestJS Multi-tenant App'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  logging: {
    level: 'info',
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*',
    ],
  },
};
```

#### Custom Performance Tracking

```typescript
// performance.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  constructor(private metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();
    
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        
        this.metricsService.recordRequestDuration(
          request.method,
          request.route?.path || request.url,
          duration,
        );
        
        this.metricsService.recordTenantRequest(
          request.headers['x-tenant-id'],
          request.method,
          request.route?.path || request.url,
        );
      }),
    );
  }
}
```

## Monitoring Dashboard

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "NestJS Multi-tenant Application Monitoring",
    "tags": ["nestjs", "multi-tenant"],
    "panels": [
      {
        "title": "Request Rate by Tenant",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(tenant_requests_total[5m])) by (tenant_id)",
            "legendFormat": "Tenant {{tenant_id}}"
          }
        ]
      },
      {
        "title": "Notification Delivery Status",
        "type": "pie",
        "targets": [
          {
            "expr": "sum(notifications_sent_total) by (status)",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "Database Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(database_query_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "rate(database_queries_total[5m])",
            "legendFormat": "Query rate"
          }
        ]
      },
      {
        "title": "Queue Metrics",
        "type": "graph",
        "targets": [
          {
            "expr": "queue_waiting_jobs",
            "legendFormat": "Waiting jobs"
          },
          {
            "expr": "queue_active_jobs",
            "legendFormat": "Active jobs"
          }
        ]
      }
    ]
  }
}
```

This monitoring guide provides comprehensive coverage of metrics, logging, alerting, and health checks for the multi-tenant NestJS application, enabling effective observability and operational monitoring.