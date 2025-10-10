# Notification System Deployment Guide

This guide provides comprehensive instructions for deploying the notification system in production environments, including infrastructure setup, configuration, monitoring, and troubleshooting.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Infrastructure Requirements](#infrastructure-requirements)
- [Environment Configuration](#environment-configuration)
- [Provider Setup](#provider-setup)
- [Database Setup](#database-setup)
- [Redis Configuration](#redis-configuration)
- [Application Deployment](#application-deployment)
- [Monitoring and Alerting](#monitoring-and-alerting)
- [Security Considerations](#security-considerations)
- [Performance Tuning](#performance-tuning)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Prerequisites

### System Requirements

- **Node.js**: 18.x or higher
- **PostgreSQL**: 13.x or higher
- **Redis**: 6.x or higher
- **Memory**: Minimum 2GB RAM (4GB+ recommended for production)
- **Storage**: SSD recommended for database and Redis
- **Network**: Outbound HTTPS access for email/SMS providers

### Required Services

- PostgreSQL database server
- Redis server for queue processing
- Email provider (Resend, AWS SES, OneSignal, or SMTP)
- SMS provider (Twilio or Termii) - optional
- Load balancer (for multi-instance deployments)
- Monitoring system (Prometheus, DataDog, etc.)

## Infrastructure Requirements

### Minimum Production Setup

```yaml
# docker-compose.yml example
version: '3.8'
services:
  app:
    image: your-app:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: multitenant_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes Deployment

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: notification-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: notification-app
  template:
    metadata:
      labels:
        app: notification-app
    spec:
      containers:
      - name: app
        image: your-app:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file with the following configuration:

```bash
# =============================================================================
# CORE APPLICATION CONFIGURATION
# =============================================================================

NODE_ENV=production
PORT=3000

# Database - Use connection pooling in production
DATABASE_URL="postgresql://username:password@host:5432/database?connection_limit=20&pool_timeout=20"

# JWT Configuration - Use strong secrets
JWT_SECRET="your-very-secure-jwt-secret-key-at-least-32-characters"
JWT_EXPIRATION="15m"

# Tenant Configuration
TENANT_HEADER_NAME="x-tenant-id"
ENABLE_SUBDOMAIN_ROUTING=true

# CORS - Restrict to your domains
CORS_ORIGIN="https://app.yourdomain.com,https://admin.yourdomain.com"

# =============================================================================
# REDIS CONFIGURATION
# =============================================================================

# Redis with authentication and SSL (recommended for production)
REDIS_URL="rediss://username:password@your-redis-host:6380"

# =============================================================================
# NOTIFICATION QUEUE CONFIGURATION
# =============================================================================

# Adjust based on your server capacity
NOTIFICATION_QUEUE_CONCURRENCY=10
NOTIFICATION_MAX_RETRIES=3
NOTIFICATION_RETRY_DELAY=5000

# WebSocket Configuration
WEBSOCKET_CORS_ORIGIN="https://app.yourdomain.com"

# =============================================================================
# EMAIL PROVIDER CONFIGURATION
# =============================================================================

# Choose your email provider
EMAIL_PROVIDER="resend"  # or "ses", "onesignal", "smtp"
EMAIL_API_KEY="your-email-provider-api-key"
EMAIL_FROM_ADDRESS="noreply@yourdomain.com"
EMAIL_FROM_NAME="Your Company Name"

# SMTP Fallback Configuration
SMTP_HOST="smtp.yourdomain.com"
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER="noreply@yourdomain.com"
SMTP_PASSWORD="your-smtp-password"

# AWS SES Configuration (if using SES)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"

# =============================================================================
# SMS PROVIDER CONFIGURATION
# =============================================================================

SMS_PROVIDER="twilio"  # or "termii"
SMS_API_KEY="your-sms-api-key"
SMS_API_SECRET="your-sms-api-secret"
SMS_FROM_NUMBER="+1234567890"

# Termii Configuration (if using Termii)
TERMII_SENDER_ID="YourApp"

# =============================================================================
# IN-APP NOTIFICATION CONFIGURATION
# =============================================================================

IN_APP_NOTIFICATION_EXPIRY_DAYS=30
MAX_UNREAD_NOTIFICATIONS=100

# =============================================================================
# DATA PRIVACY CONFIGURATION
# =============================================================================

NOTIFICATION_RETENTION_DAYS=90
AUDIT_LOG_RETENTION_DAYS=365

# =============================================================================
# MONITORING AND ALERTING
# =============================================================================

ALERTING_ENABLED=true

# Failure Rate Alerts
ALERT_FAILURE_RATE_THRESHOLD=5
ALERT_FAILURE_RATE_ENABLED=true

# Queue Alerts
ALERT_QUEUE_DEPTH_THRESHOLD=1000
ALERT_QUEUE_DEPTH_ENABLED=true
ALERT_QUEUE_LAG_THRESHOLD=300
ALERT_QUEUE_LAG_ENABLED=true

# Provider Error Alerts
ALERT_PROVIDER_ERROR_THRESHOLD=10
ALERT_PROVIDER_ERROR_ENABLED=true

# Alert Delivery
ALERT_WEBHOOK_URL="https://your-monitoring-system.com/webhooks/alerts"
ALERT_EMAIL_RECIPIENTS="admin@yourdomain.com,devops@yourdomain.com"
ALERT_SLACK_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
```

### Environment Variable Validation

The application validates all environment variables on startup. Required variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `REDIS_URL`

Optional but recommended for production:
- Email provider configuration
- SMS provider configuration
- Monitoring and alerting configuration

## Provider Setup

### Email Providers

#### Resend Setup

1. **Create Account**: Sign up at [resend.com](https://resend.com)
2. **Get API Key**: Generate API key in dashboard
3. **Verify Domain**: Add and verify your sending domain
4. **Configure DNS**: Add required DNS records

```bash
# Environment configuration
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_your_api_key_here
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME="Your Company"
```

#### AWS SES Setup

1. **AWS Account**: Ensure you have AWS account with SES access
2. **Verify Domain**: Verify your sending domain in SES console
3. **Request Production Access**: Move out of sandbox mode
4. **Create IAM User**: Create user with SES sending permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

```bash
# Environment configuration
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME="Your Company"
```

#### OneSignal Setup

1. **Create Account**: Sign up at [onesignal.com](https://onesignal.com)
2. **Create App**: Create new app for email
3. **Get API Key**: Copy REST API key from settings
4. **Configure Email**: Set up email configuration

```bash
# Environment configuration
EMAIL_PROVIDER=onesignal
EMAIL_API_KEY=your_onesignal_api_key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME="Your Company"
```

#### SMTP Setup (Fallback)

Configure SMTP for any email provider:

```bash
# Gmail example
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Custom SMTP server
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-smtp-password
```

### SMS Providers

#### Twilio Setup

1. **Create Account**: Sign up at [twilio.com](https://twilio.com)
2. **Get Credentials**: Copy Account SID and Auth Token
3. **Buy Phone Number**: Purchase a phone number for sending
4. **Verify Recipients**: Add test numbers if in trial mode

```bash
# Environment configuration
SMS_PROVIDER=twilio
SMS_API_KEY=your_account_sid
SMS_API_SECRET=your_auth_token
SMS_FROM_NUMBER=+1234567890
```

#### Termii Setup

1. **Create Account**: Sign up at [termii.com](https://termii.com)
2. **Get API Key**: Generate API key in dashboard
3. **Register Sender ID**: Register your sender ID
4. **Fund Account**: Add credits for sending

```bash
# Environment configuration
SMS_PROVIDER=termii
SMS_API_KEY=your_termii_api_key
TERMII_SENDER_ID=YourApp
```

## Database Setup

### PostgreSQL Configuration

#### Production Database Settings

```sql
-- postgresql.conf optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
```

#### Database Migration

```bash
# Run migrations
npm run prisma:migrate:deploy

# Generate Prisma client
npm run prisma:generate

# Seed initial data (optional)
npm run prisma:seed
```

#### Database Indexes

Ensure these indexes exist for optimal performance:

```sql
-- Notification indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_tenant_user 
ON notifications(tenant_id, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_category 
ON notifications(category);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_read_at 
ON notifications(read_at) WHERE read_at IS NULL;

-- Preference indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_preferences_tenant_user_category 
ON notification_preferences(tenant_id, user_id, category);

-- Delivery log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_delivery_logs_notification 
ON notification_delivery_logs(notification_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_delivery_logs_status 
ON notification_delivery_logs(status);
```

### Connection Pooling

Use connection pooling for production:

```bash
# PgBouncer example
DATABASE_URL="postgresql://username:password@pgbouncer-host:6432/database?pgbouncer=true"

# Direct connection with pool settings
DATABASE_URL="postgresql://username:password@host:5432/database?connection_limit=20&pool_timeout=20"
```

## Redis Configuration

### Production Redis Setup

#### Redis Configuration File

```conf
# redis.conf
bind 0.0.0.0
port 6379
requirepass your_secure_redis_password
maxmemory 1gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
```

#### Redis Cluster (High Availability)

For high availability, consider Redis Cluster or Redis Sentinel:

```bash
# Redis Cluster connection
REDIS_URL="redis://password@node1:6379,node2:6379,node3:6379"

# Redis Sentinel connection
REDIS_URL="redis-sentinel://password@sentinel1:26379,sentinel2:26379/mymaster"
```

#### Memory Optimization

Monitor Redis memory usage and configure appropriately:

```bash
# Check Redis memory usage
redis-cli INFO memory

# Set memory limit
redis-cli CONFIG SET maxmemory 1gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## Application Deployment

### Build Process

```bash
# Install dependencies
npm ci --only=production

# Build application
npm run build

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate:deploy
```

### Process Management

#### PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'notification-app',
    script: 'dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

```bash
# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Systemd Service

```ini
# /etc/systemd/system/notification-app.service
[Unit]
Description=Notification App
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/opt/notification-app
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/notification-app/.env.production

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl enable notification-app
sudo systemctl start notification-app
sudo systemctl status notification-app
```

### Load Balancing

#### Nginx Configuration

```nginx
# /etc/nginx/sites-available/notification-app
upstream notification_app {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    location / {
        proxy_pass http://notification_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://notification_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring and Alerting

### Health Checks

The application provides health check endpoints:

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health check
curl http://localhost:3000/health/detailed
```

### Prometheus Metrics

Configure Prometheus to scrape metrics:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'notification-app'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Grafana Dashboard

Import the notification system dashboard:

```json
{
  "dashboard": {
    "title": "Notification System",
    "panels": [
      {
        "title": "Notification Delivery Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(notifications_sent_total[5m])",
            "legendFormat": "{{channel}}"
          }
        ]
      },
      {
        "title": "Queue Depth",
        "type": "graph",
        "targets": [
          {
            "expr": "notification_queue_depth",
            "legendFormat": "{{queue}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(notifications_failed_total[5m])",
            "legendFormat": "{{channel}}"
          }
        ]
      }
    ]
  }
}
```

### Log Aggregation

#### ELK Stack Configuration

```yaml
# docker-compose.elk.yml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports:
      - "5044:5044"

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
```

#### Logstash Configuration

```ruby
# logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "notification-app" {
    json {
      source => "message"
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "notification-app-%{+YYYY.MM.dd}"
  }
}
```

### Alert Configuration

#### Slack Alerts

```javascript
// Alert webhook handler
app.post('/webhooks/alerts', (req, res) => {
  const alert = req.body;
  
  const slackMessage = {
    text: `🚨 Notification System Alert`,
    attachments: [{
      color: 'danger',
      fields: [
        {
          title: 'Alert Type',
          value: alert.type,
          short: true
        },
        {
          title: 'Threshold',
          value: alert.threshold,
          short: true
        },
        {
          title: 'Current Value',
          value: alert.currentValue,
          short: true
        },
        {
          title: 'Time',
          value: new Date().toISOString(),
          short: true
        }
      ]
    }]
  };
  
  // Send to Slack
  fetch(process.env.ALERT_SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackMessage)
  });
  
  res.status(200).send('OK');
});
```

## Security Considerations

### Environment Security

```bash
# Secure file permissions
chmod 600 .env.production

# Use secrets management
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id prod/notification-app/config

# Kubernetes secrets
kubectl create secret generic app-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=jwt-secret="..." \
  --from-literal=redis-url="redis://..."
```

### Network Security

```bash
# Firewall rules (UFW example)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 3000/tcp   # Block direct app access
sudo ufw deny 6379/tcp   # Block direct Redis access
sudo ufw deny 5432/tcp   # Block direct PostgreSQL access
sudo ufw enable
```

### SSL/TLS Configuration

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## Performance Tuning

### Application Optimization

```javascript
// PM2 cluster configuration
module.exports = {
  apps: [{
    name: 'notification-app',
    script: 'dist/main.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    node_args: [
      '--max-old-space-size=1024',
      '--optimize-for-size'
    ]
  }]
};
```

### Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM notifications 
WHERE tenant_id = 'tenant123' AND user_id = 'user456' 
ORDER BY created_at DESC LIMIT 20;

-- Update table statistics
ANALYZE notifications;
ANALYZE notification_preferences;
ANALYZE notification_delivery_logs;
```

### Redis Optimization

```bash
# Monitor Redis performance
redis-cli --latency-history -i 1

# Optimize Redis configuration
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET save "900 1 300 10 60 10000"
```

### Queue Optimization

```bash
# Adjust queue concurrency based on load
NOTIFICATION_QUEUE_CONCURRENCY=20  # Increase for high throughput
NOTIFICATION_MAX_RETRIES=5         # Increase for better reliability
NOTIFICATION_RETRY_DELAY=3000      # Decrease for faster retries
```

## Troubleshooting

### Common Issues

#### High Memory Usage

```bash
# Check Node.js memory usage
ps aux | grep node

# Monitor heap usage
node --inspect dist/main.js
# Connect to chrome://inspect

# Increase memory limit
node --max-old-space-size=2048 dist/main.js
```

#### Queue Backup

```bash
# Check Redis queue status
redis-cli LLEN bull:email-notifications:waiting
redis-cli LLEN bull:sms-notifications:waiting

# Clear stuck jobs
redis-cli DEL bull:email-notifications:waiting
redis-cli DEL bull:email-notifications:active
```

#### Database Connection Issues

```bash
# Check connection pool
SELECT * FROM pg_stat_activity WHERE datname = 'your_database';

# Check for long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity 
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
```

#### Provider API Errors

```bash
# Check provider status
curl -I https://api.resend.com/health
curl -I https://api.twilio.com/health

# Test provider configuration
npm run test:providers
```

### Debugging

#### Enable Debug Logging

```bash
# Environment variable
DEBUG=notification:*

# Application logging
LOG_LEVEL=debug
```

#### Health Check Endpoints

```bash
# Basic health
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/health/db

# Redis health
curl http://localhost:3000/health/redis

# Provider health
curl http://localhost:3000/health/providers
```

## Maintenance

### Regular Tasks

#### Database Maintenance

```sql
-- Weekly maintenance
VACUUM ANALYZE notifications;
VACUUM ANALYZE notification_delivery_logs;
REINDEX INDEX CONCURRENTLY idx_notifications_tenant_user;

-- Monthly cleanup
DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM notification_delivery_logs 
WHERE created_at < NOW() - INTERVAL '365 days';
```

#### Redis Maintenance

```bash
# Weekly Redis maintenance
redis-cli BGREWRITEAOF
redis-cli BGSAVE

# Monitor Redis memory
redis-cli INFO memory
```

#### Log Rotation

```bash
# Logrotate configuration
# /etc/logrotate.d/notification-app
/opt/notification-app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 app app
    postrotate
        pm2 reloadLogs
    endscript
}
```

### Backup Strategy

#### Database Backup

```bash
#!/bin/bash
# backup-db.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL | gzip > /backups/notification_db_$DATE.sql.gz

# Keep only last 30 days
find /backups -name "notification_db_*.sql.gz" -mtime +30 -delete
```

#### Redis Backup

```bash
#!/bin/bash
# backup-redis.sh
DATE=$(date +%Y%m%d_%H%M%S)
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb /backups/redis_$DATE.rdb

# Keep only last 7 days
find /backups -name "redis_*.rdb" -mtime +7 -delete
```

### Updates and Migrations

#### Application Updates

```bash
# Zero-downtime deployment
pm2 reload notification-app

# Database migrations
npm run prisma:migrate:deploy

# Rollback if needed
npm run prisma:migrate:reset
```

#### Dependency Updates

```bash
# Check for updates
npm audit
npm outdated

# Update dependencies
npm update
npm audit fix
```

This deployment guide provides comprehensive instructions for deploying and maintaining the notification system in production environments. Follow the security best practices and monitoring recommendations to ensure reliable operation.