# Deployment Guide

This guide covers deployment procedures, environment configuration, and operational considerations for the multi-tenant NestJS application.

## Deployment Overview

The application supports multiple deployment strategies:

1. **Traditional Server Deployment** - Deploy to VPS or dedicated servers
2. **Container Deployment** - Deploy using Docker containers
3. **Cloud Platform Deployment** - Deploy to cloud platforms (AWS, GCP, Azure)
4. **Serverless Deployment** - Deploy to serverless platforms

## Prerequisites

### System Requirements

**Minimum Requirements:**
- CPU: 2 cores
- RAM: 4GB
- Storage: 20GB SSD
- Network: 100 Mbps

**Recommended Requirements:**
- CPU: 4+ cores
- RAM: 8GB+
- Storage: 50GB+ SSD
- Network: 1 Gbps

### Required Services

1. **PostgreSQL Database** (v13+)
2. **Redis Server** (v6+)
3. **Node.js Runtime** (v18+)
4. **Process Manager** (PM2, systemd, or Docker)

### Optional Services

1. **Load Balancer** (Nginx, HAProxy)
2. **SSL Certificate** (Let's Encrypt, commercial)
3. **Monitoring Stack** (Prometheus, Grafana)
4. **Log Aggregation** (ELK Stack, Fluentd)

## Environment Configuration

### Production Environment Variables

Create a `.env.production` file with production-specific settings:

```bash
# Application Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL="postgresql://username:password@db-host:5432/production_db"

# Security Configuration
JWT_SECRET="your-super-secure-jwt-secret-key-change-this"
JWT_EXPIRATION="15m"

# CORS Configuration
CORS_ORIGIN="https://yourdomain.com,https://app.yourdomain.com"

# Tenant Configuration
TENANT_HEADER_NAME="x-tenant-id"
ENABLE_SUBDOMAIN_ROUTING=true

# Redis Configuration
REDIS_URL="redis://redis-host:6379"

# Google OAuth (if enabled)
GOOGLE_CLIENT_ID="your-production-google-client-id"
GOOGLE_CLIENT_SECRET="your-production-google-client-secret"
GOOGLE_CALLBACK_URL="https://yourdomain.com/auth/google/callback"
GOOGLE_LINK_CALLBACK_URL="https://yourdomain.com/auth/google/link/callback"

# Email Configuration
EMAIL_PROVIDER="ses"  # or resend, smtp
EMAIL_FROM_ADDRESS="noreply@yourdomain.com"
EMAIL_FROM_NAME="Your Application"

# AWS SES Configuration (if using SES)
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"

# SMS Configuration
SMS_PROVIDER="twilio"
SMS_API_KEY="your-twilio-account-sid"
SMS_API_SECRET="your-twilio-auth-token"
SMS_FROM_NUMBER="+1234567890"

# Rate Limiting
TENANT_RATE_LIMIT_WINDOW_MS=60000
TENANT_RATE_LIMIT_MAX_REQUESTS=1000
USER_RATE_LIMIT_WINDOW_MS=60000
USER_RATE_LIMIT_MAX_REQUESTS=500

# Queue Configuration
NOTIFICATION_QUEUE_CONCURRENCY=10
NOTIFICATION_MAX_RETRIES=3
NOTIFICATION_RETRY_DELAY=5000

# Alerting Configuration
ALERTING_ENABLED=true
ALERT_FAILURE_RATE_THRESHOLD=5
ALERT_QUEUE_DEPTH_THRESHOLD=1000
ALERT_WEBHOOK_URL="https://your-monitoring-webhook.com/alerts"
ALERT_EMAIL_RECIPIENTS="admin@yourdomain.com,devops@yourdomain.com"

# Data Retention
NOTIFICATION_RETENTION_DAYS=90
AUDIT_LOG_RETENTION_DAYS=365

# WebSocket Configuration
WEBSOCKET_CORS_ORIGIN="https://yourdomain.com"
```

### Environment-Specific Configurations

#### Staging Environment
```bash
NODE_ENV=staging
DATABASE_URL="postgresql://username:password@staging-db:5432/staging_db"
CORS_ORIGIN="https://staging.yourdomain.com"
ALERTING_ENABLED=false
```

#### Development Environment
```bash
NODE_ENV=development
DATABASE_URL="postgresql://username:password@localhost:5432/dev_db"
CORS_ORIGIN="*"
ALERTING_ENABLED=false
```

## Deployment Methods

### 1. Traditional Server Deployment

#### Using PM2 (Recommended)

1. **Install PM2 globally**:
```bash
npm install -g pm2
```

2. **Create PM2 ecosystem file** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'nestjs-app',
    script: 'dist/main.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env.production',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=2048'
  }]
};
```

3. **Deploy the application**:
```bash
# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

#### Using systemd

1. **Create systemd service file** (`/etc/systemd/system/nestjs-app.service`):
```ini
[Unit]
Description=NestJS Multi-tenant Application
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/nestjs-app
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=nestjs-app
Environment=NODE_ENV=production
EnvironmentFile=/opt/nestjs-app/.env.production

[Install]
WantedBy=multi-user.target
```

2. **Enable and start the service**:
```bash
sudo systemctl enable nestjs-app
sudo systemctl start nestjs-app
sudo systemctl status nestjs-app
```

### 2. Docker Deployment

#### Dockerfile

```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

USER nestjs

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

#### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/nestjs_app
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:13-alpine
    environment:
      - POSTGRES_DB=nestjs_app
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:6-alpine
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

### 3. Cloud Platform Deployment

#### AWS Deployment

**Using AWS ECS with Fargate:**

1. **Create ECS Task Definition**:
```json
{
  "family": "nestjs-app",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "nestjs-app",
      "image": "your-account.dkr.ecr.region.amazonaws.com/nestjs-app:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:database-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/nestjs-app",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

2. **Create ECS Service**:
```bash
aws ecs create-service \
  --cluster production-cluster \
  --service-name nestjs-app \
  --task-definition nestjs-app:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
```

#### Google Cloud Platform

**Using Cloud Run:**

1. **Build and push container**:
```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/nestjs-app
```

2. **Deploy to Cloud Run**:
```bash
gcloud run deploy nestjs-app \
  --image gcr.io/PROJECT-ID/nestjs-app \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=database-url:latest
```

## Database Migration and Setup

### Production Database Setup

1. **Create production database**:
```bash
createdb -h db-host -U username production_db
```

2. **Run migrations**:
```bash
# Set production database URL
export DATABASE_URL="postgresql://username:password@db-host:5432/production_db"

# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

3. **Seed initial data** (if needed):
```bash
npx prisma db seed
```

### Migration Strategy

1. **Zero-downtime migrations**:
   - Use backward-compatible schema changes
   - Deploy application before removing old columns
   - Use feature flags for breaking changes

2. **Migration rollback plan**:
   - Always backup database before migrations
   - Test migrations on staging environment
   - Have rollback scripts ready

3. **Data migration**:
   - Use separate migration scripts for data changes
   - Run data migrations during maintenance windows
   - Monitor migration progress

## Load Balancing and Reverse Proxy

### Nginx Configuration

```nginx
upstream nestjs_app {
    least_conn;
    server app1:3000 max_fails=3 fail_timeout=30s;
    server app2:3000 max_fails=3 fail_timeout=30s;
    server app3:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;

    location / {
        proxy_pass http://nestjs_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://nestjs_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://nestjs_app;
        access_log off;
    }
}
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

1. **Install Certbot**:
```bash
sudo apt install certbot python3-certbot-nginx
```

2. **Obtain certificate**:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

3. **Auto-renewal**:
```bash
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Manual SSL Certificate

1. **Generate private key**:
```bash
openssl genrsa -out private.key 2048
```

2. **Generate CSR**:
```bash
openssl req -new -key private.key -out certificate.csr
```

3. **Install certificate** in Nginx configuration

## Monitoring and Health Checks

### Application Health Checks

The application includes built-in health check endpoints:

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health information
- `GET /metrics` - Prometheus metrics

### External Health Monitoring

```bash
# Simple health check script
#!/bin/bash
HEALTH_URL="https://yourdomain.com/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "Application is healthy"
    exit 0
else
    echo "Application is unhealthy (HTTP $RESPONSE)"
    exit 1
fi
```

### Database Health Monitoring

```sql
-- Check database connections
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- Check database size
SELECT pg_size_pretty(pg_database_size('production_db')) as db_size;

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

## Backup and Disaster Recovery

### Database Backup

1. **Automated backup script**:
```bash
#!/bin/bash
BACKUP_DIR="/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="production_db"

# Create backup
pg_dump -h db-host -U username $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/backup_$DATE.sql.gz s3://your-backup-bucket/postgresql/
```

2. **Schedule with cron**:
```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup-script.sh
```

### Application Backup

1. **Code and configuration backup**:
```bash
#!/bin/bash
BACKUP_DIR="/backups/application"
DATE=$(date +%Y%m%d_%H%M%S)

# Create application backup
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz \
  /opt/nestjs-app \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=logs

# Upload to S3
aws s3 cp $BACKUP_DIR/app_backup_$DATE.tar.gz s3://your-backup-bucket/application/
```

### Disaster Recovery Plan

1. **Recovery Time Objective (RTO)**: 4 hours
2. **Recovery Point Objective (RPO)**: 1 hour

**Recovery Steps**:

1. **Assess the situation**:
   - Identify the scope of the outage
   - Determine if it's a partial or complete failure

2. **Database recovery**:
   ```bash
   # Restore from latest backup
   gunzip -c backup_latest.sql.gz | psql -h new-db-host -U username production_db
   ```

3. **Application recovery**:
   ```bash
   # Deploy to new infrastructure
   docker-compose up -d
   
   # Or restore from backup
   tar -xzf app_backup_latest.tar.gz -C /opt/
   ```

4. **DNS and traffic routing**:
   - Update DNS records to point to new infrastructure
   - Update load balancer configuration

5. **Verification**:
   - Run health checks
   - Verify critical functionality
   - Monitor application metrics

## Performance Optimization

### Application-Level Optimizations

1. **Enable compression**:
```typescript
// In main.ts
import * as compression from 'compression';
app.use(compression());
```

2. **Configure caching**:
```typescript
// Redis caching for frequently accessed data
@Injectable()
export class CacheService {
  constructor(private redis: Redis) {}

  async get(key: string): Promise<any> {
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }
}
```

3. **Database query optimization**:
```typescript
// Use database indexes
// Add to Prisma schema
model User {
  @@index([tenantId])
  @@index([email, tenantId])
}

// Use efficient queries
const users = await prisma.user.findMany({
  where: { tenantId },
  select: { id: true, email: true, firstName: true }, // Only select needed fields
  take: 20, // Limit results
  skip: offset, // Pagination
});
```

### Infrastructure-Level Optimizations

1. **Database optimization**:
```sql
-- PostgreSQL configuration
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

2. **Redis optimization**:
```conf
# Redis configuration
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

3. **Node.js optimization**:
```bash
# Environment variables
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=2048"
UV_THREADPOOL_SIZE=16
```

## Scaling Strategies

### Horizontal Scaling

1. **Load balancer configuration**:
   - Use multiple application instances
   - Implement session affinity if needed
   - Configure health checks

2. **Database scaling**:
   - Read replicas for read-heavy workloads
   - Connection pooling
   - Query optimization

3. **Cache scaling**:
   - Redis cluster for high availability
   - Distributed caching strategies

### Vertical Scaling

1. **Resource monitoring**:
   - Monitor CPU, memory, and I/O usage
   - Scale resources based on metrics
   - Use auto-scaling groups in cloud environments

2. **Performance testing**:
   - Load testing with realistic scenarios
   - Identify bottlenecks
   - Optimize based on results

## Security Considerations

### Production Security Checklist

- [ ] Use HTTPS everywhere
- [ ] Implement proper CORS policies
- [ ] Use secure headers (HSTS, CSP, etc.)
- [ ] Enable rate limiting
- [ ] Use strong JWT secrets
- [ ] Implement proper input validation
- [ ] Use parameterized queries
- [ ] Enable audit logging
- [ ] Regular security updates
- [ ] Implement proper error handling
- [ ] Use environment variables for secrets
- [ ] Enable database encryption at rest
- [ ] Implement proper backup encryption

### Security Headers

```typescript
// In main.ts
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));
```

## Troubleshooting

### Common Deployment Issues

1. **Port binding errors**:
   - Check if port is already in use
   - Verify firewall settings
   - Check application configuration

2. **Database connection issues**:
   - Verify connection string
   - Check network connectivity
   - Verify database credentials

3. **Memory issues**:
   - Monitor memory usage
   - Increase Node.js heap size
   - Check for memory leaks

4. **Performance issues**:
   - Monitor application metrics
   - Check database query performance
   - Verify cache hit rates

### Deployment Rollback

```bash
# PM2 rollback
pm2 reload ecosystem.config.js --update-env

# Docker rollback
docker-compose down
docker-compose up -d --scale app=3

# Database rollback (if needed)
psql -h db-host -U username -d production_db -f rollback_script.sql
```

This deployment guide provides comprehensive coverage of deployment procedures, environment configuration, and operational considerations for the multi-tenant NestJS application.