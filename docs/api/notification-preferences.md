# Notification Preferences API

The Notification Preferences API provides endpoints for managing user notification preferences across different channels and categories.

## Base Path
```
/api/notification-preferences
```

## Authentication
All endpoints require JWT authentication and tenant identification.

**Headers:**
- `Authorization: Bearer <jwt_token>` (required)
- `x-tenant-id: <tenant_id>` (required)

## Endpoints

### GET /notification-preferences

Get all notification preferences for the current user.

**Rate Limit:** 30 requests per minute

**Response (200):**
```json
[
  {
    "id": "pref_123",
    "tenantId": "tenant_123",
    "userId": "user_123",
    "category": "invoice",
    "inAppEnabled": true,
    "emailEnabled": true,
    "smsEnabled": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "pref_124",
    "tenantId": "tenant_123",
    "userId": "user_123",
    "category": "system",
    "inAppEnabled": true,
    "emailEnabled": false,
    "smsEnabled": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Error Responses:**
- `401` - Unauthorized

---

### GET /notification-preferences/categories

Get list of all available notification categories for the current tenant.

**Rate Limit:** 20 requests per minute

**Response (200):**
```json
{
  "categories": [
    "user_activity",
    "system",
    "invoice",
    "project",
    "security",
    "marketing",
    "support"
  ]
}
```

**Error Responses:**
- `401` - Unauthorized

---

### PUT /notification-preferences/:category

Update notification preferences for a specific category.

**Rate Limit:** 20 preference updates per minute

**Path Parameters:**
- `category` (string): Notification category (e.g., "invoice", "system")

**Request Body:**
```json
{
  "inAppEnabled": true,
  "emailEnabled": false,
  "smsEnabled": true
}
```

**Response (200):**
```json
{
  "id": "pref_123",
  "tenantId": "tenant_123",
  "userId": "user_123",
  "category": "invoice",
  "inAppEnabled": true,
  "emailEnabled": false,
  "smsEnabled": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `400` - Bad Request (invalid preference data)

**Validation Rules:**
- `inAppEnabled` (optional): Boolean, defaults to true
- `emailEnabled` (optional): Boolean, defaults to true
- `smsEnabled` (optional): Boolean, defaults to false

## Usage Examples

### Get User Preferences

```bash
curl -X GET http://localhost:3000/api/notification-preferences \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

### Update Preferences for Invoice Category

```bash
curl -X PUT http://localhost:3000/api/notification-preferences/invoice \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "inAppEnabled": true,
    "emailEnabled": false,
    "smsEnabled": true
  }'
```

### Get Available Categories

```bash
curl -X GET http://localhost:3000/api/notification-preferences/categories \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

## Notification Categories

### Standard Categories

| Category | Description | Default Channels |
|----------|-------------|------------------|
| `user_activity` | User actions and updates | In-App, Email |
| `system` | System maintenance and updates | In-App |
| `invoice` | Billing and invoice notifications | In-App, Email |
| `project` | Project-related notifications | In-App, Email |
| `security` | Security alerts and warnings | In-App, Email, SMS |
| `marketing` | Marketing and promotional content | Email |
| `support` | Support and help notifications | In-App, Email |

### Custom Categories
Tenants can define custom notification categories based on their business needs. Categories are automatically created when first used in notifications.

## Notification Channels

### In-App Notifications
- **Always Available**: In-app notifications are always enabled by default
- **Real-time**: Delivered immediately through WebSocket connections
- **Persistent**: Stored in database until read or dismissed

### Email Notifications
- **Configurable**: Can be enabled/disabled per category
- **Template-based**: Uses customizable email templates
- **Delivery Tracking**: Tracks delivery status and failures

### SMS Notifications
- **Opt-in**: Disabled by default, requires explicit user consent
- **Rate Limited**: Additional rate limiting for SMS to prevent abuse
- **Cost Consideration**: SMS delivery may incur costs

## Preference Management

### Default Behavior
When a user receives their first notification in a category:
1. System creates default preferences if none exist
2. Default settings: In-App (enabled), Email (enabled), SMS (disabled)
3. User can then customize preferences as needed

### Preference Inheritance
- **Global Defaults**: System-wide default preferences
- **Tenant Defaults**: Tenant-specific default preferences
- **User Overrides**: User-specific preference overrides

### Bulk Operations
Future versions may support bulk preference updates:
```json
{
  "preferences": [
    {
      "category": "invoice",
      "inAppEnabled": true,
      "emailEnabled": false,
      "smsEnabled": false
    },
    {
      "category": "system",
      "inAppEnabled": true,
      "emailEnabled": true,
      "smsEnabled": false
    }
  ]
}
```

## Privacy and Consent

### GDPR Compliance
- **Explicit Consent**: SMS notifications require explicit user consent
- **Easy Opt-out**: Users can easily disable any notification channel
- **Data Retention**: Preference data is retained according to privacy policy

### Consent Management
- **Granular Control**: Per-category, per-channel control
- **Audit Trail**: Changes to preferences are logged
- **Withdrawal**: Users can withdraw consent at any time

## Rate Limiting

Different operations have different rate limits:
- **Get preferences**: 30 requests per minute
- **Get categories**: 20 requests per minute
- **Update preferences**: 20 updates per minute

## Integration with Notification System

### Preference Checking
When sending notifications, the system:
1. Checks user preferences for the notification category
2. Determines which channels are enabled
3. Sends notification only through enabled channels
4. Respects user's privacy choices

### Fallback Behavior
- If no preferences exist, uses system defaults
- Critical notifications (security) may override some preferences
- System notifications always use in-app channel

## Tenant Isolation

All preference operations are automatically scoped to the current tenant:
- Preferences are tenant-specific
- Categories are defined per tenant
- Cross-tenant preference access is prevented

## Error Handling

Standard error response format:

```json
{
  "statusCode": 400,
  "message": "Invalid preference data: smsEnabled must be a boolean",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/notification-preferences/invoice"
}
```

Common error scenarios:
- Invalid preference data types
- Unknown notification categories
- Rate limit exceeded
- Missing authentication

## Future Enhancements

### Planned Features
- **Quiet Hours**: Time-based notification preferences
- **Frequency Control**: Digest vs. immediate notifications
- **Priority Filtering**: Preferences based on notification priority
- **Channel Fallback**: Automatic fallback to alternative channels
- **Bulk Management**: Bulk preference updates
- **Template Preferences**: User-customizable notification templates