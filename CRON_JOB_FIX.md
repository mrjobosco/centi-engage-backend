# Cron Job Registration Fix

## Problem
The application was throwing an error:
```
Cannot register cron job "NotificationPrivacyService@cleanupAuditLogs" because it is defined in a non static provider.
```

## Root Cause
The `NotificationPrivacyService` depends on `TenantContextService`, which is decorated with `@Injectable({ scope: Scope.REQUEST })`. This makes it a request-scoped provider. 

In NestJS, cron jobs with the `@Cron` decorator cannot be registered in request-scoped providers because:
- Cron jobs run independently of HTTP requests
- Request-scoped providers are instantiated per HTTP request
- There's no request context available when a cron job executes

## Solution
Created a new singleton service `NotificationSchedulerService` to handle all scheduled tasks. This service:

1. **Uses default (singleton) scope** - Compatible with cron jobs
2. **Only depends on singleton services** - `PrismaService` and `ConfigService`
3. **Contains all scheduled tasks** that were previously in `NotificationPrivacyService`

### Changes Made

#### 1. Created `NotificationSchedulerService`
**File:** `src/notifications/services/notification-scheduler.service.ts`

Contains two cron jobs:
- `cleanupAuditLogs()` - Runs weekly (`CronExpression.EVERY_WEEK`)
  - Deletes audit logs older than configured retention period
  - Default: 365 days
  
- `enforceRetentionPolicy()` - Runs daily at 2 AM (`CronExpression.EVERY_DAY_AT_2AM`)
  - Deletes expired notifications based on retention policy
  - Creates audit logs for sensitive data before deletion
  - Default retention: 90 days

#### 2. Updated `NotificationPrivacyService`
**File:** `src/notifications/services/notification-privacy.service.ts`

- Removed both cron jobs (`cleanupAuditLogs` and `enforceRetentionPolicy`)
- Removed unused imports (`Cron`, `CronExpression`)
- Added documentation explaining where the cron jobs moved
- Kept all other privacy and audit functionality intact

#### 3. Updated Module Configuration
**File:** `src/notifications/notifications.module.ts`

- Added `NotificationSchedulerService` to imports
- Added `NotificationSchedulerService` to providers list

#### 4. Updated Service Exports
**File:** `src/notifications/services/index.ts`

- Exported `NotificationSchedulerService` for consistency

## Configuration
The cron jobs use environment variables for configuration:

```env
# Audit log retention (in days)
AUDIT_LOG_RETENTION_DAYS=365

# Notification retention (in days)
NOTIFICATION_RETENTION_DAYS=90
```

## Testing
The application now builds successfully and can start without the cron job registration error.

To verify cron jobs are working:
1. Check application logs for scheduled task execution
2. Weekly audit log cleanup logs: `"Starting audit log cleanup"`
3. Daily retention policy logs: `"Starting retention policy enforcement"`

## Benefits
- ✅ Cron jobs can now register without errors
- ✅ Clean separation of concerns (scheduled tasks vs request-scoped operations)
- ✅ No impact on existing functionality
- ✅ Easy to add more scheduled tasks in the future

## Migration Notes
If other services need to add cron jobs:
1. Check if the service has request-scoped dependencies
2. If yes, consider moving cron jobs to `NotificationSchedulerService` or create a dedicated scheduler service
3. Keep the cron jobs in singleton (default scope) services only
