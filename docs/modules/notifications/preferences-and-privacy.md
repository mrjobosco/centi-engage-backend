# Notification Preferences and Privacy Features

## Overview

The notification system provides comprehensive user preference management and privacy controls, ensuring GDPR compliance and giving users full control over their notification experience. The system supports granular channel preferences, data retention policies, audit logging, and privacy-aware notification filtering.

## User Preference Management

### Preference Hierarchy

The system follows a clear preference hierarchy:

1. **User-specific preferences** (highest priority)
2. **System defaults** (fallback when no user preference exists)

### Preference Structure

Each user can configure preferences for different notification categories:

```typescript
interface NotificationPreference {
  id: string;
  tenantId: string;
  userId: string;
  category: string;           // e.g., 'system', 'invoice', 'project'
  inAppEnabled: boolean;      // In-app notifications
  emailEnabled: boolean;      // Email notifications
  smsEnabled: boolean;        // SMS notifications
  createdAt: Date;
  updatedAt: Date;
}
```

### Default Categories

The system provides default categories that cover common notification types:

- **`user_activity`**: User actions and interactions
- **`system`**: System-wide announcements and maintenance
- **`invoice`**: Billing and payment notifications
- **`project`**: Project-related updates and milestones
- **`security`**: Security alerts and authentication events

### System Defaults

When no user preference exists for a category, the system applies these defaults:

```typescript
const DEFAULT_PREFERENCES = {
  inAppEnabled: true,    // Always enabled for immediate visibility
  emailEnabled: true,    // Enabled for important communications
  smsEnabled: false,     // Disabled by default (opt-in for SMS)
};
```

## Preference Management API

### Getting User Preferences

Retrieve all preferences for the current user:

```typescript
// GET /notification-preferences
const preferences = await fetch('/notification-preferences', {
  headers: {
    'Authorization': 'Bearer <jwt-token>',
    'X-Tenant-ID': 'tenant-123'
  }
});

// Response
[
  {
    "id": "pref-123",
    "tenantId": "tenant-123",
    "userId": "user-456",
    "category": "invoice",
    "inAppEnabled": true,
    "emailEnabled": true,
    "smsEnabled": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]
```

### Getting Available Categories

Retrieve all available notification categories:

```typescript
// GET /notification-preferences/categories
const categories = await fetch('/notification-preferences/categories');

// Response
{
  "categories": [
    "user_activity",
    "system", 
    "invoice",
    "project",
    "security"
  ]
}
```

### Updating Preferences

Update preferences for a specific category:

```typescript
// PUT /notification-preferences/invoice
const updatedPreference = await fetch('/notification-preferences/invoice', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <jwt-token>',
    'X-Tenant-ID': 'tenant-123'
  },
  body: JSON.stringify({
    inAppEnabled: true,
    emailEnabled: true,
    smsEnabled: true  // Enable SMS for invoices
  })
});
```

### Preference Resolution Logic

The `NotificationPreferenceService` resolves preferences using this logic:

```typescript
async getEnabledChannels(
  userId: string,
  category: string
): Promise<NotificationChannelType[]> {
  // 1. Try to get user-specific preference
  const preference = await this.prisma.notificationPreference.findUnique({
    where: {
      tenantId_userId_category: {
        tenantId,
        userId,
        category,
      },
    },
  });

  // 2. If no preference exists, use system defaults
  if (!preference) {
    return [NotificationChannelType.IN_APP, NotificationChannelType.EMAIL];
  }

  // 3. Build enabled channels from user preference
  const enabledChannels: NotificationChannelType[] = [];
  
  if (preference.inAppEnabled) {
    enabledChannels.push(NotificationChannelType.IN_APP);
  }
  if (preference.emailEnabled) {
    enabledChannels.push(NotificationChannelType.EMAIL);
  }
  if (preference.smsEnabled) {
    enabledChannels.push(NotificationChannelType.SMS);
  }

  return enabledChannels;
}
```

## Privacy Features

### Data Classification

The system supports marking notifications as containing sensitive data:

```typescript
// Mark notification as sensitive
await notificationPrivacyService.markAsSensitive(notificationId);

// Create notification with sensitive data flag
const notification = await prisma.notification.create({
  data: {
    // ... other fields
    sensitiveData: true,  // Enables enhanced privacy controls
  }
});
```

### Soft Deletion

Users can delete notifications without permanently removing them from the system:

```typescript
// Soft delete a notification
await notificationPrivacyService.softDeleteNotification(
  notificationId,
  userId,
  deletedBy
);

// Restore a soft-deleted notification
await notificationPrivacyService.restoreNotification(
  notificationId,
  userId
);
```

**Soft Deletion Features:**
- Notifications are marked with `deletedAt` timestamp
- Soft-deleted notifications are excluded from normal queries
- Audit logs are created for sensitive data deletions
- Notifications can be restored if needed

### Data Retention Policies

The system implements automatic data retention with configurable policies:

#### Retention Configuration

```bash
# Environment variables
NOTIFICATION_RETENTION_DAYS=90        # Default retention period
AUDIT_LOG_RETENTION_DAYS=365         # Audit log retention period
```

#### Retention Policy Types

1. **Default Retention**: Applied to all notifications without explicit retention dates
2. **Explicit Retention**: Set per notification for specific requirements
3. **Sensitive Data Retention**: Enhanced controls for sensitive notifications

#### Setting Retention Dates

```typescript
// Set explicit retention date for a notification
const retentionDate = new Date();
retentionDate.setDate(retentionDate.getDate() + 30); // 30 days from now

await notificationPrivacyService.setRetentionDate(
  notificationId,
  retentionDate
);
```

#### Automatic Cleanup

The system runs automated cleanup jobs:

```typescript
// Daily cleanup job (runs at 2 AM)
@Cron(CronExpression.EVERY_DAY_AT_2AM)
async enforceRetentionPolicy(): Promise<void> {
  // 1. Find expired notifications
  const expiredNotifications = await this.prisma.notification.findMany({
    where: {
      OR: [
        // Explicit retention date passed
        { retentionDate: { lte: new Date() } },
        // Default retention period exceeded
        {
          retentionDate: null,
          createdAt: { lte: defaultRetentionDate }
        }
      ],
      deletedAt: null
    }
  });

  // 2. Create audit logs for sensitive data
  // 3. Hard delete expired notifications
}
```

### Audit Logging

The system maintains comprehensive audit logs for sensitive notifications:

#### Audit Log Structure

```typescript
interface NotificationAuditLog {
  id: string;
  notificationId: string;
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT';
  userId: string;
  tenantId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
```

#### Creating Audit Logs

```typescript
// Create audit log entry
await notificationPrivacyService.createAuditLog({
  notificationId: 'notif-123',
  action: 'READ',
  userId: 'user-456',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  metadata: {
    source: 'web_app',
    sessionId: 'session-789'
  }
});
```

#### Retrieving Audit Logs

```typescript
// Get audit logs for a notification
const auditLogs = await notificationPrivacyService.getAuditLogs(notificationId);

// Response includes user information
[
  {
    "id": "audit-123",
    "notificationId": "notif-123",
    "action": "READ",
    "userId": "user-456",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "metadata": { "source": "web_app" },
    "createdAt": "2024-01-01T10:00:00Z",
    "user": {
      "id": "user-456",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
]
```

### Privacy-Aware Filtering

The system provides privacy-aware notification retrieval:

```typescript
// Get notifications with privacy filters
const result = await notificationPrivacyService.getNotificationsWithPrivacyFilters(
  userId,
  {
    page: 1,
    limit: 20,
    includeDeleted: false,    // Exclude soft-deleted notifications
    onlySensitive: false      // Include all notifications
  }
);

// Automatic filtering applied:
// - Excludes soft-deleted notifications (unless requested)
// - Excludes expired notifications (past retention date)
// - Applies tenant isolation
// - Respects user ownership
```

## GDPR Compliance Features

### Right to Access

Users can access all their notification data:

```typescript
// Export user's notification data
const userData = await notificationPrivacyService.exportUserData(userId);

// Includes:
// - All notifications (including soft-deleted)
// - Notification preferences
// - Audit logs
// - Delivery logs
```

### Right to Rectification

Users can update their preferences and notification data:

```typescript
// Update preferences
await notificationPreferenceService.updatePreference(userId, category, {
  emailEnabled: false,
  smsEnabled: false
});

// Update notification read status
await notificationService.markAsRead(notificationId, userId);
```

### Right to Erasure

Users can request deletion of their notification data:

```typescript
// Soft delete specific notifications
await notificationPrivacyService.softDeleteNotification(
  notificationId,
  userId,
  'user_request'
);

// Hard delete all user notifications (GDPR erasure)
await notificationPrivacyService.eraseUserData(userId, {
  reason: 'gdpr_erasure_request',
  requestedBy: userId,
  verificationToken: 'token-123'
});
```

### Right to Data Portability

Export user data in machine-readable format:

```typescript
// Export in JSON format
const exportData = await notificationPrivacyService.exportUserData(userId, {
  format: 'json',
  includeAuditLogs: true,
  includeDeliveryLogs: true
});

// Export structure
{
  "user": { "id": "user-123", "email": "user@example.com" },
  "notifications": [...],
  "preferences": [...],
  "auditLogs": [...],
  "deliveryLogs": [...],
  "exportedAt": "2024-01-01T00:00:00Z",
  "exportedBy": "user-123"
}
```

### Consent Management

Track and manage user consent for different notification types:

```typescript
// Record consent
await notificationPrivacyService.recordConsent(userId, {
  consentType: 'marketing_emails',
  granted: true,
  consentSource: 'web_form',
  ipAddress: '192.168.1.1',
  userAgent: 'Mozilla/5.0...'
});

// Check consent before sending
const hasConsent = await notificationPrivacyService.hasConsent(
  userId,
  'marketing_emails'
);

if (hasConsent) {
  // Send marketing notification
}
```

## Implementation Examples

### Creating Default Preferences for New Users

```typescript
// In user registration flow
async function createUser(userData: CreateUserDto): Promise<User> {
  // 1. Create user
  const user = await prisma.user.create({ data: userData });
  
  // 2. Create default notification preferences
  await notificationPreferenceService.createDefaultPreferences(user.id);
  
  return user;
}
```

### Preference-Aware Notification Sending

```typescript
// Send notification respecting user preferences
async function sendNotification(payload: NotificationPayload): Promise<void> {
  // 1. Get enabled channels for user and category
  const enabledChannels = await notificationPreferenceService.getEnabledChannels(
    payload.userId,
    payload.category
  );
  
  // 2. Only send through enabled channels
  if (enabledChannels.length === 0) {
    console.log('No channels enabled for user, skipping notification');
    return;
  }
  
  // 3. Send through enabled channels
  await notificationService.sendThroughChannels(payload, enabledChannels);
}
```

### Privacy-Compliant Data Handling

```typescript
// Handle sensitive notification with privacy controls
async function createSensitiveNotification(
  payload: NotificationPayload
): Promise<void> {
  // 1. Create notification
  const notification = await notificationService.create({
    ...payload,
    sensitiveData: true  // Mark as sensitive
  });
  
  // 2. Set retention date (shorter for sensitive data)
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() + 30); // 30 days
  
  await notificationPrivacyService.setRetentionDate(
    notification.id,
    retentionDate
  );
  
  // 3. Create audit log
  await notificationPrivacyService.createAuditLog({
    notificationId: notification.id,
    action: 'CREATE',
    userId: payload.userId,
    metadata: { sensitiveData: true }
  });
}
```

## Best Practices

### Preference Management
- **Provide clear defaults** that respect user privacy
- **Make preferences granular** but not overwhelming
- **Explain the impact** of each preference setting
- **Allow bulk preference updates** for user convenience

### Privacy Controls
- **Mark sensitive data** appropriately
- **Implement proper retention policies** based on data sensitivity
- **Maintain audit logs** for sensitive operations
- **Provide clear data export** functionality

### GDPR Compliance
- **Obtain explicit consent** for marketing communications
- **Provide easy opt-out** mechanisms
- **Implement data portability** features
- **Ensure secure data deletion** when requested

### Performance Considerations
- **Cache preference lookups** for frequently accessed data
- **Batch preference updates** when possible
- **Optimize retention cleanup** jobs for large datasets
- **Index audit logs** for efficient querying

This comprehensive preference and privacy system ensures users have full control over their notification experience while maintaining GDPR compliance and data security.