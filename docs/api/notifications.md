# Notifications API

The Notifications API provides endpoints for creating, managing, and retrieving notifications within a tenant.

## Base Path
```
/api/notifications
```

## Authentication
All endpoints require JWT authentication and tenant identification.

**Headers:**
- `Authorization: Bearer <jwt_token>` (required)
- `x-tenant-id: <tenant_id>` (required)

## Endpoints

### POST /notifications

Create a new notification for the current user.

**Rate Limit:** 10 notifications per minute per user

**Request Body:**
```json
{
  "userId": "user_123",
  "category": "invoice",
  "type": "INFO",
  "title": "New Invoice Generated",
  "message": "Your invoice #INV-001 has been generated and is ready for review.",
  "data": {
    "invoiceId": "inv_123",
    "amount": 100.50
  },
  "priority": "MEDIUM",
  "expiresAt": "2024-12-31T23:59:59.000Z",
  "templateId": "invoice-notification",
  "templateVariables": {
    "userName": "John Doe",
    "invoiceNumber": "INV-001"
  }
}
```

**Response (201):**
```json
{
  "id": "notif_123",
  "tenantId": "tenant_123",
  "userId": "user_123",
  "type": "INFO",
  "category": "invoice",
  "title": "New Invoice Generated",
  "message": "Your invoice #INV-001 has been generated and is ready for review.",
  "data": {
    "invoiceId": "inv_123",
    "amount": 100.50
  },
  "channelsSent": ["in_app", "email"],
  "readAt": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `429` - Too Many Requests (rate limit exceeded)

**Field Descriptions:**
- `userId` (required): Target user ID
- `category` (required): Notification category (1-50 chars)
- `type` (required): Notification type (`INFO`, `WARNING`, `SUCCESS`, `ERROR`)
- `title` (required): Notification title (1-255 chars)
- `message` (required): Notification message (1-1000 chars)
- `data` (optional): Additional structured data
- `priority` (optional): Priority level (`LOW`, `MEDIUM`, `HIGH`, `URGENT`)
- `expiresAt` (optional): Expiration date (ISO string)
- `templateId` (optional): Template ID for rendering
- `templateVariables` (optional): Variables for template rendering

---

### POST /notifications/tenant-broadcast

Send a notification to all users in the current tenant (admin only).

**Rate Limit:** 5 tenant broadcasts per 5 minutes
**Required Role:** Admin

**Request Body:**
```json
{
  "category": "system",
  "type": "INFO",
  "title": "System Maintenance",
  "message": "Scheduled maintenance will occur tonight from 2-4 AM.",
  "priority": "HIGH"
}
```

**Response (201):**
```json
{
  "notifications": [
    {
      "id": "notif_124",
      "tenantId": "tenant_123",
      "userId": "user_123",
      "type": "INFO",
      "category": "system",
      "title": "System Maintenance",
      "message": "Scheduled maintenance will occur tonight from 2-4 AM.",
      "channelsSent": ["in_app", "email"],
      "readAt": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "expiresAt": null
    }
  ],
  "count": 1
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (admin access required)
- `429` - Too Many Requests

---

### GET /notifications

Get paginated list of notifications for the current user with filtering options.

**Rate Limit:** 100 requests per minute

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `type` (optional): Filter by notification type
- `category` (optional): Filter by category
- `read` (optional): Filter by read status (`true`, `false`)
- `startDate` (optional): Filter from date (ISO string)
- `endDate` (optional): Filter to date (ISO string)

**Response (200):**
```json
{
  "notifications": [
    {
      "id": "notif_123",
      "tenantId": "tenant_123",
      "userId": "user_123",
      "type": "INFO",
      "category": "invoice",
      "title": "New Invoice Generated",
      "message": "Your invoice #INV-001 has been generated and is ready for review.",
      "data": {
        "invoiceId": "inv_123",
        "amount": 100.50
      },
      "channelsSent": ["in_app", "email"],
      "readAt": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "expiresAt": "2024-12-31T23:59:59.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```

**Error Responses:**
- `401` - Unauthorized

---

### GET /notifications/unread-count

Get the count of unread notifications for the current user.

**Rate Limit:** 60 requests per minute

**Response (200):**
```json
{
  "count": 5
}
```

**Error Responses:**
- `401` - Unauthorized

---

### GET /notifications/:id

Get a specific notification by ID (user can only access their own notifications).

**Path Parameters:**
- `id` (string): Notification ID

**Response (200):**
```json
{
  "id": "notif_123",
  "tenantId": "tenant_123",
  "userId": "user_123",
  "type": "INFO",
  "category": "invoice",
  "title": "New Invoice Generated",
  "message": "Your invoice #INV-001 has been generated and is ready for review.",
  "data": {
    "invoiceId": "inv_123",
    "amount": 100.50
  },
  "channelsSent": ["in_app", "email"],
  "readAt": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `404` - Notification not found or access denied

---

### PATCH /notifications/:id/read

Mark a specific notification as read.

**Rate Limit:** 50 mark-as-read operations per minute

**Path Parameters:**
- `id` (string): Notification ID

**Response (200):**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

**Error Responses:**
- `401` - Unauthorized
- `404` - Notification not found or access denied

---

### PATCH /notifications/read-all

Mark all unread notifications as read for the current user.

**Rate Limit:** 10 mark-all-as-read operations per minute

**Response (200):**
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

**Error Responses:**
- `401` - Unauthorized

---

### DELETE /notifications/:id

Delete (dismiss) a specific notification.

**Rate Limit:** 30 delete operations per minute

**Path Parameters:**
- `id` (string): Notification ID

**Response (200):**
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

**Error Responses:**
- `401` - Unauthorized
- `404` - Notification not found or access denied

## Usage Examples

### Create a Notification

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "category": "invoice",
    "type": "INFO",
    "title": "New Invoice Generated",
    "message": "Your invoice #INV-001 has been generated.",
    "data": {"invoiceId": "inv_123", "amount": 100.50}
  }'
```

### Get User Notifications with Filtering

```bash
curl -X GET "http://localhost:3000/api/notifications?page=1&limit=10&type=INFO&read=false" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

### Mark Notification as Read

```bash
curl -X PATCH http://localhost:3000/api/notifications/notif_123/read \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

### Broadcast to Tenant (Admin Only)

```bash
curl -X POST http://localhost:3000/api/notifications/tenant-broadcast \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "system",
    "type": "WARNING",
    "title": "System Maintenance",
    "message": "Scheduled maintenance tonight from 2-4 AM."
  }'
```

## Notification Types

| Type | Description | Use Cases |
|------|-------------|-----------|
| `INFO` | Informational messages | Updates, confirmations, general information |
| `WARNING` | Warning messages | Potential issues, reminders |
| `SUCCESS` | Success messages | Completed actions, achievements |
| `ERROR` | Error messages | Failed operations, critical issues |

## Notification Priorities

| Priority | Description | Delivery Behavior |
|----------|-------------|-------------------|
| `LOW` | Low priority | Standard delivery |
| `MEDIUM` | Medium priority | Standard delivery (default) |
| `HIGH` | High priority | Expedited delivery |
| `URGENT` | Urgent | Immediate delivery, bypass some rate limits |

## Delivery Channels

Notifications are automatically delivered through configured channels based on user preferences:

- **In-App**: Always delivered for real-time notifications
- **Email**: Delivered based on user email preferences
- **SMS**: Delivered based on user SMS preferences

## Rate Limiting

Different operations have different rate limits:

- **Create notification**: 10 per minute per user
- **Tenant broadcast**: 5 per 5 minutes (admin only)
- **Read operations**: 60-100 per minute
- **Mark as read**: 50 per minute
- **Delete**: 30 per minute

## Tenant Isolation

All notification operations are automatically scoped to the current tenant:
- Users can only create notifications for users in their tenant
- Users can only access their own notifications
- Admin broadcasts only reach users within the same tenant

## Error Handling

Standard error response format:

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "ThrottlerException",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/notifications"
}
```

Common error scenarios:
- Rate limit exceeded
- Invalid notification data
- Notification not found or access denied
- Insufficient permissions for admin operations