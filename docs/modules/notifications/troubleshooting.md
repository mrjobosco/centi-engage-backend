# Notification System Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting steps for common notification system issues, including delivery failures, configuration problems, and performance issues.

## Common Issues and Solutions

### 1. Notifications Not Being Delivered

#### Symptoms
- Notifications created but not received by users
- Queue jobs failing repeatedly
- No delivery logs or failed delivery logs

#### Diagnostic Steps

1. **Check Notification Creation**
```bash
# Check if notifications are being created in database
SELECT * FROM notifications 
WHERE user_id = 'user-id' 
ORDER BY created_at DESC 
LIMIT 10;
```

2. **Check User Preferences**
```bash
# Verify user has enabled channels for the category
SELECT * FROM notification_preferences 
WHERE user_id = 'user-id';
```

3. **Check Queue Status**
```bash
# Monitor queue health
curl http://localhost:3000/monitoring/queues/health
```

4. **Check Delivery Logs**
```bash
# Check delivery attempts
SELECT * FROM notification_delivery_logs 
WHERE notification_id = 'notification-id';
```

#### Common Causes and Solutions

**User Preferences Disabled**
```typescript
// Solution: Check and update user preferences
await notificationPreferenceService.updatePreferences(userId, {
  categories: {
    'system': {
      channels: [NotificationChannelType.EMAIL, NotificationChannelType.IN_APP]
    }
  }
});
```

**Provider Configuration Issues**
```typescript
// Solution: Validate provider configuration
const factory = new EmailProviderFactory(configService);
const validation = factory.validateConfig(tenantConfig);
if (!validation.valid) {
  console.log('Configuration errors:', validation.errors);
}
```

**Queue Processing Stopped**
```bash
# Solution: Restart queue workers
pm2 restart notification-workers
# Or check Redis connection
redis-cli ping
```

### 2. Email Delivery Issues

#### AWS SES Issues

**Error: "Email address not verified"**
```bash
# Solution: Verify email addresses in AWS SES console
aws ses verify-email-identity --email-address noreply@yourdomain.com
```

**Error: "Account is in sandbox mode"**
```bash
# Solution: Request production access in AWS SES console
# Or use verified email addresses for testing
```

**Error: "Daily sending quota exceeded"**
```bash
# Solution: Check and increase sending limits
aws ses describe-send-quota
```

#### Resend Issues

**Error: "Domain not verified"**
```bash
# Solution: Verify domain in Resend dashboard
# Add DNS records as specified
```

**Error: "API key invalid"**
```bash
# Solution: Generate new API key
# Update environment variables or tenant configuration
```

#### SMTP Issues

**Error: "Authentication failed"**
```typescript
// Solution: Check SMTP credentials
const smtpProvider = new SmtpProvider({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  user: 'your-email@gmail.com',
  password: 'your-app-password' // Use app password, not regular password
});

// Test connection
const isConnected = await smtpProvider.verifyConnection();
```

**Error: "Connection timeout"**
```bash
# Solution: Check firewall and network connectivity
telnet smtp.gmail.com 587
```

### 3. SMS Delivery Issues

#### Twilio Issues

**Error: "Invalid phone number"**
```typescript
// Solution: Format phone numbers correctly
const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters except +
  const formatted = phone.replace(/[^\d+]/g, '');
  
  // Add country code if missing
  if (!formatted.startsWith('+')) {
    return `+1${formatted}`; // Default to US
  }
  
  return formatted;
};
```

**Error: "Insufficient funds"**
```bash
# Solution: Add funds to Twilio account
# Check account balance in Twilio console
```

**Error: "From number not verified"**
```bash
# Solution: Verify phone number in Twilio console
# Or use Twilio trial number for testing
```

#### Termii Issues

**Error: "Invalid sender ID"**
```bash
# Solution: Register sender ID in Termii dashboard
# Use approved sender ID in configuration
```

**Error: "Insufficient balance"**
```bash
# Solution: Fund Termii account
# Check balance in Termii dashboard
```

### 4. In-App Notification Issues

#### WebSocket Connection Issues

**Error: "WebSocket connection failed"**
```typescript
// Client-side debugging
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

**Error: "Authentication failed"**
```typescript
// Solution: Check JWT token validity
const decoded = jwt.verify(token, process.env.JWT_SECRET);
console.log('Token payload:', decoded);
```

#### Real-time Updates Not Working

**Missing Events**
```typescript
// Solution: Ensure proper event emission
this.notificationGateway.emitNotification(userId, {
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  createdAt: notification.createdAt
});
```

**User Not in Room**
```typescript
// Solution: Check room membership
const rooms = this.server.sockets.adapter.rooms;
const userRoom = rooms.get(`user:${userId}`);
console.log('Users in room:', userRoom?.size || 0);
```

### 5. Queue and Performance Issues

#### High Queue Backlog

**Symptoms**
- Large number of waiting jobs
- Slow notification delivery
- High memory usage

**Diagnostic Commands**
```bash
# Check queue statistics
curl http://localhost:3000/monitoring/queues/email/stats
curl http://localhost:3000/monitoring/queues/sms/stats
```

**Solutions**
```typescript
// Increase worker concurrency
const queueOptions = {
  concurrency: 10, // Increase from default 5
  maxStalledCount: 3,
  stalledInterval: 30000
};

// Add more worker instances
// Scale horizontally by adding more servers
```

#### Memory Leaks

**Symptoms**
- Increasing memory usage over time
- Application crashes with out-of-memory errors

**Diagnostic Steps**
```bash
# Monitor memory usage
ps aux | grep node
top -p $(pgrep node)

# Use Node.js memory profiling
node --inspect app.js
```

**Solutions**
```typescript
// Implement proper cleanup
process.on('SIGTERM', async () => {
  await queue.close();
  await redis.disconnect();
  process.exit(0);
});

// Configure job cleanup
const jobOptions = {
  removeOnComplete: 100,  // Keep only last 100 completed jobs
  removeOnFail: 50,       // Keep only last 50 failed jobs
};
```

#### Redis Connection Issues

**Error: "Redis connection lost"**
```bash
# Solution: Check Redis server status
redis-cli ping

# Check Redis configuration
redis-cli config get maxmemory
redis-cli config get maxmemory-policy
```

**Error: "Too many connections"**
```bash
# Solution: Configure connection pooling
const redisConfig = {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true,
  maxmemoryPolicy: 'allkeys-lru'
};
```

### 6. Configuration Issues

#### Environment Variables Not Loaded

**Symptoms**
- Default configurations being used
- Provider initialization failures

**Diagnostic Steps**
```typescript
// Check environment variables
console.log('EMAIL_PROVIDER:', process.env.EMAIL_PROVIDER);
console.log('SMS_PROVIDER:', process.env.SMS_PROVIDER);
console.log('REDIS_URL:', process.env.REDIS_URL);
```

**Solutions**
```bash
# Ensure .env file is loaded
npm install dotenv
# Add to app startup: require('dotenv').config();

# Check file permissions
ls -la .env
chmod 600 .env
```

#### Database Connection Issues

**Error: "Database connection failed"**
```bash
# Solution: Check database connectivity
npx prisma db pull
npx prisma generate
```

**Error: "Migration pending"**
```bash
# Solution: Run pending migrations
npx prisma migrate deploy
```

### 7. Tenant Isolation Issues

#### Cross-Tenant Data Leakage

**Symptoms**
- Users seeing notifications from other tenants
- Incorrect notification counts

**Diagnostic Steps**
```sql
-- Check for cross-tenant data
SELECT tenant_id, COUNT(*) 
FROM notifications 
WHERE user_id = 'user-id' 
GROUP BY tenant_id;
```

**Solutions**
```typescript
// Ensure tenant context is set
this.tenantContextService.setTenantId(tenantId);

// Verify Prisma middleware is working
const notifications = await this.prisma.notification.findMany({
  where: { userId } // Tenant filter applied automatically
});
```

#### Tenant Configuration Not Applied

**Symptoms**
- Global configuration used instead of tenant-specific
- Wrong provider being used

**Diagnostic Steps**
```sql
-- Check tenant configuration
SELECT * FROM tenant_notification_config 
WHERE tenant_id = 'tenant-id';
```

**Solutions**
```typescript
// Verify tenant config loading
const tenantConfig = await this.loadTenantEmailConfig(tenantId);
console.log('Tenant config:', tenantConfig);

// Check factory provider selection
const provider = this.emailProviderFactory.createProvider(tenantConfig);
console.log('Selected provider:', provider.getProviderName());
```

## Monitoring and Alerting

### Health Check Endpoints

```bash
# System health
curl http://localhost:3000/health

# Queue health
curl http://localhost:3000/monitoring/queues/health

# Provider health
curl http://localhost:3000/monitoring/providers/health
```

### Log Analysis

**Enable Debug Logging**
```bash
# Set log level
export LOG_LEVEL=debug

# Enable specific module logging
export DEBUG=notification:*
```

**Common Log Patterns**
```bash
# Search for errors
grep -i "error" logs/application.log | tail -20

# Search for specific notification
grep "notification-id-123" logs/application.log

# Search for provider failures
grep -i "provider.*failed" logs/application.log
```

### Metrics and Monitoring

**Key Metrics to Monitor**
- Notification creation rate
- Delivery success rate by channel
- Queue depth and processing time
- Provider response times
- Error rates by category

**Alerting Rules**
```yaml
# Example Prometheus alerting rules
groups:
  - name: notifications
    rules:
      - alert: HighNotificationFailureRate
        expr: notification_failure_rate > 0.1
        for: 5m
        annotations:
          summary: "High notification failure rate detected"
          
      - alert: QueueBacklogHigh
        expr: notification_queue_depth > 1000
        for: 2m
        annotations:
          summary: "Notification queue backlog is high"
```

## Performance Optimization

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at);
CREATE INDEX idx_notifications_tenant_category ON notifications(tenant_id, category);
CREATE INDEX idx_delivery_logs_notification ON notification_delivery_logs(notification_id);
```

### Queue Optimization

```typescript
// Optimize job processing
const jobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: 50,
};

// Use job priorities
await queue.add('send-email', data, {
  priority: getPriorityValue(notification.priority)
});
```

### Provider Optimization

```typescript
// Implement connection pooling
const httpAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
  timeout: 10000
});

// Use provider-specific optimizations
const twilioClient = new Twilio(accountSid, authToken, {
  httpClient: httpAgent
});
```

## Emergency Procedures

### Disable Notifications

```typescript
// Emergency disable all notifications
await this.configService.set('NOTIFICATIONS_ENABLED', 'false');

// Disable specific channels
await this.configService.set('EMAIL_NOTIFICATIONS_ENABLED', 'false');
await this.configService.set('SMS_NOTIFICATIONS_ENABLED', 'false');
```

### Clear Queue Backlog

```bash
# Clear all queues (use with caution)
redis-cli FLUSHDB

# Clear specific queue
redis-cli DEL bull:email-notifications:waiting
redis-cli DEL bull:sms-notifications:waiting
```

### Provider Failover

```typescript
// Switch to backup provider
await this.tenantConfigService.updateConfig(tenantId, {
  emailProvider: 'smtp', // Fallback to SMTP
  smsProvider: 'backup-provider'
});
```

## Getting Help

### Log Collection

When reporting issues, collect these logs:
- Application logs with debug level enabled
- Queue processor logs
- Provider-specific error logs
- Database query logs (if relevant)

### Information to Include

- Notification ID and user ID
- Tenant ID (if multi-tenant)
- Provider configuration (without sensitive data)
- Error messages and stack traces
- Timeline of events
- Environment details (Node.js version, dependencies)

### Support Channels

1. **Check documentation** for known issues
2. **Search existing issues** in the repository
3. **Create detailed bug report** with reproduction steps
4. **Include relevant logs** and configuration
5. **Provide minimal reproduction case** if possible

This troubleshooting guide should help resolve most common notification system issues. For complex problems, enable debug logging and collect detailed information before seeking support.