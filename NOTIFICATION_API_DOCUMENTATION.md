# Notification System API Documentation

This document provides comprehensive API documentation for the notification system endpoints, including request/response examples, query parameters, and filters.

## Table of Contents

- [Authentication](#authentication)
- [Notifications API](#notifications-api)
- [Notification Preferences API](#notification-preferences-api)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)

## Authentication

All notification endpoints require JWT authentication and tenant context:

- **Authorization Header**: `Bearer <jwt_token>`
- **Tenant Header**: `x-tenant-id: <tenant_id>`

## Notifications API

### Base URL
```
/api/notifications
```

### 1. Create Notification

Create a new notification for a specific user.

**Endpoint**: `POST /api/notifications`

**Rate Limit**: 10 requests per minute per user

**Request Body**:
```json
{
  "userId": "clm123abc456def789",
  "category": "invoice",
  "type": "INFO",
  "title": "New Invoice Generated",
  "message": "Your invoice #INV-001 has been generated and is ready for review.",
  "data": {
    "invoiceId": "inv_123",
    "amount": 100.5
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

**Request Body Schema**:
| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| userId | string | Yes | User ID to send notification to | "clm123abc456def789" |
| category | string | Yes | Notification category (1-50 chars) | "invoice" |
| type | enum | Yes | Notification type: INFO, WARNING, SUCCESS, ERROR | "INFO" |
| title | string | Yes | Notification title (1-255 chars) | "New Invoice Generated" |
| message | string | Yes | Notification message (1-1000 chars) | "Your invoice has been generated" |
| data | object | No | Additional notification data | {"invoiceId": "inv_123"} |
| priority | enum | No | Priority: LOW, MEDIUM, HIGH, URGENT | "MEDIUM" |
| expiresAt | string | No | Expiration date (ISO string) | "2024-12-31T23:59:59.000Z" |
| templateId | string | No | Template ID for rendering | "invoice-template" |
| templateVariables | object | No | Variables for template rendering | {"userName": "John"} |

**Success Response** (201):
```json
{
  "id": "clm456def789ghi012",
  "tenantId": "tenant_123",
  "userId": "clm123abc456def789",
  "type": "INFO",
  "category": "invoice",
  "title": "New Invoice Generated",
  "message": "Your invoice #INV-001 has been generated and is ready for review.",
  "data": {
    "invoiceId": "inv_123",
    "amount": 100.5
  },
  "channelsSent": ["in-app", "email"],
  "readAt": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

### 2. Broadcast Notification to Tenant

Send a notification to all users in the current tenant (admin only).

**Endpoint**: `POST /api/notifications/tenant-broadcast`

**Rate Limit**: 5 requests per 5 minutes per tenant

**Authorization**: Admin role required

**Request Body**: Same as create notification (userId field is ignored)

**Success Response** (201):
```json
{
  "notifications": [
    {
      "id": "clm456def789ghi012",
      "tenantId": "tenant_123",
      "userId": "user_1",
      "type": "INFO",
      "category": "system",
      "title": "System Maintenance",
      "message": "Scheduled maintenance will occur tonight.",
      "data": null,
      "channelsSent": ["in-app", "email"],
      "readAt": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "expiresAt": null
    }
  ],
  "count": 1
}
```

### 3. Get User Notifications

Get paginated list of notifications for the current user with filtering options.

**Endpoint**: `GET /api/notifications`

**Rate Limit**: 100 requests per minute per user

**Query Parameters**:
| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| page | number | 1 | Page number (min: 1) | 2 |
| limit | number | 20 | Items per page (1-100) | 50 |
| type | enum | - | Filter by type: INFO, WARNING, SUCCESS, ERROR | INFO |
| category | string | - | Filter by category | "invoice" |
| unread | boolean | - | Filter by read status (true=read, false=unread) | false |
| sortBy | enum | createdAt | Sort field: createdAt, readAt, title, type | "createdAt" |
| sortOrder | enum | desc | Sort order: asc, desc | "desc" |
| search | string | - | Search in title and message | "invoice" |

**Example Request**:
```
GET /api/notifications?page=1&limit=20&type=INFO&category=invoice&unread=false&sortBy=createdAt&sortOrder=desc&search=payment
```

**Success Response** (200):
```json
{
  "notifications": [
    {
      "id": "clm456def789ghi012",
      "tenantId": "tenant_123",
      "userId": "clm123abc456def789",
      "type": "INFO",
      "category": "invoice",
      "title": "Payment Received",
      "message": "Payment for invoice #INV-001 has been received.",
      "data": {
        "invoiceId": "inv_123",
        "amount": 100.5
      },
      "channelsSent": ["in-app", "email"],
      "readAt": "2024-01-15T11:00:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "expiresAt": null
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

### 4. Get Unread Notification Count

Get the count of unread notifications for the current user.

**Endpoint**: `GET /api/notifications/unread-count`

**Rate Limit**: 60 requests per minute per user

**Success Response** (200):
```json
{
  "count": 5
}
```

### 5. Get Notification by ID

Get a specific notification by ID. User can only access their own notifications.

**Endpoint**: `GET /api/notifications/:id`

**Path Parameters**:
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| id | string | Notification ID | "clm456def789ghi012" |

**Success Response** (200):
```json
{
  "id": "clm456def789ghi012",
  "tenantId": "tenant_123",
  "userId": "clm123abc456def789",
  "type": "INFO",
  "category": "invoice",
  "title": "New Invoice Generated",
  "message": "Your invoice #INV-001 has been generated and is ready for review.",
  "data": {
    "invoiceId": "inv_123",
    "amount": 100.5
  },
  "channelsSent": ["in-app", "email"],
  "readAt": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "expiresAt": "2024-12-31T23:59:59.000Z"
}
```

### 6. Mark Notification as Read

Mark a specific notification as read. User can only mark their own notifications.

**Endpoint**: `PATCH /api/notifications/:id/read`

**Rate Limit**: 50 requests per minute per user

**Path Parameters**:
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| id | string | Notification ID | "clm456def789ghi012" |

**Success Response** (200):
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

### 7. Mark All Notifications as Read

Mark all unread notifications as read for the current user.

**Endpoint**: `PATCH /api/notifications/read-all`

**Rate Limit**: 10 requests per minute per user

**Success Response** (200):
```json
{
  "success": true,
  "message": "All notifications marked as read"
}
```

### 8. Delete Notification

Delete (dismiss) a specific notification. User can only delete their own notifications.

**Endpoint**: `DELETE /api/notifications/:id`

**Rate Limit**: 30 requests per minute per user

**Path Parameters**:
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| id | string | Notification ID | "clm456def789ghi012" |

**Success Response** (200):
```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

## Notification Preferences API

### Base URL
```
/api/notification-preferences
```

### 1. Get User Notification Preferences

Get all notification preferences for the current user.

**Endpoint**: `GET /api/notification-preferences`

**Rate Limit**: 30 requests per minute per user

**Success Response** (200):
```json
[
  {
    "id": "pref_123",
    "tenantId": "tenant_123",
    "userId": "clm123abc456def789",
    "category": "invoice",
    "inAppEnabled": true,
    "emailEnabled": true,
    "smsEnabled": false,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  },
  {
    "id": "pref_124",
    "tenantId": "tenant_123",
    "userId": "clm123abc456def789",
    "category": "system",
    "inAppEnabled": true,
    "emailEnabled": false,
    "smsEnabled": false,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
]
```

### 2. Get Available Notification Categories

Get list of all available notification categories for the current tenant.

**Endpoint**: `GET /api/notification-preferences/categories`

**Rate Limit**: 20 requests per minute per user

**Success Response** (200):
```json
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

### 3. Update Notification Preferences for Category

Update notification channel preferences for a specific category.

**Endpoint**: `PUT /api/notification-preferences/:category`

**Rate Limit**: 20 requests per minute per user

**Path Parameters**:
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| category | string | Notification category | "invoice" |

**Request Body**:
```json
{
  "inAppEnabled": true,
  "emailEnabled": true,
  "smsEnabled": false
}
```

**Request Body Schema**:
| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| inAppEnabled | boolean | No | Enable/disable in-app notifications | true |
| emailEnabled | boolean | No | Enable/disable email notifications | true |
| smsEnabled | boolean | No | Enable/disable SMS notifications | false |

**Success Response** (200):
```json
{
  "id": "pref_123",
  "tenantId": "tenant_123",
  "userId": "clm123abc456def789",
  "category": "invoice",
  "inAppEnabled": true,
  "emailEnabled": true,
  "smsEnabled": false,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T12:00:00.000Z"
}
```

## Error Responses

### Common Error Codes

| Status Code | Description | Example Response |
|-------------|-------------|------------------|
| 400 | Bad Request - Invalid input data | `{"statusCode": 400, "message": ["title must be longer than or equal to 1 characters"], "error": "Bad Request"}` |
| 401 | Unauthorized - Missing or invalid JWT token | `{"statusCode": 401, "message": "Unauthorized"}` |
| 403 | Forbidden - Insufficient permissions | `{"statusCode": 403, "message": "Forbidden - Admin access required"}` |
| 404 | Not Found - Resource not found or access denied | `{"statusCode": 404, "message": "Notification not found or access denied"}` |
| 429 | Too Many Requests - Rate limit exceeded | `{"statusCode": 429, "message": "ThrottlerException: Too Many Requests"}` |
| 500 | Internal Server Error | `{"statusCode": 500, "message": "Internal server error"}` |

### Validation Error Example

```json
{
  "statusCode": 400,
  "message": [
    "title must be longer than or equal to 1 characters",
    "message must be longer than or equal to 1 characters",
    "type must be one of the following values: INFO, WARNING, SUCCESS, ERROR"
  ],
  "error": "Bad Request"
}
```

## Rate Limiting

The notification system implements rate limiting to prevent abuse:

### Notification Endpoints
- **Create notification**: 10 requests per minute per user
- **Tenant broadcast**: 5 requests per 5 minutes per tenant
- **Get notifications**: 100 requests per minute per user
- **Get unread count**: 60 requests per minute per user
- **Mark as read**: 50 requests per minute per user
- **Mark all as read**: 10 requests per minute per user
- **Delete notification**: 30 requests per minute per user

### Preference Endpoints
- **Get preferences**: 30 requests per minute per user
- **Get categories**: 20 requests per minute per user
- **Update preferences**: 20 requests per minute per user

### Rate Limit Headers

When rate limits are enforced, the following headers are included in responses:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1642248000
```

## WebSocket Real-Time Notifications

The notification system also supports real-time notifications via WebSocket connections:

### Connection
```javascript
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  },
  extraHeaders: {
    'x-tenant-id': 'your-tenant-id'
  }
});
```

### Events

#### Receive New Notification
```javascript
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});
```

#### Receive Unread Count Update
```javascript
socket.on('unread-count', (data) => {
  console.log('Unread count:', data.count);
});
```

## Swagger/OpenAPI

The notification API is fully documented with Swagger/OpenAPI. You can access the interactive API documentation at:

```
http://localhost:3000/api
```

The Swagger documentation includes:
- Complete endpoint descriptions
- Request/response schemas
- Authentication requirements
- Rate limiting information
- Example requests and responses
- Parameter validation rules

## SDK Examples

### JavaScript/TypeScript

```typescript
// Create notification
const notification = await fetch('/api/notifications', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-tenant-id': tenantId,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user123',
    category: 'invoice',
    type: 'INFO',
    title: 'New Invoice',
    message: 'Your invoice is ready'
  })
});

// Get notifications with filters
const notifications = await fetch('/api/notifications?page=1&limit=20&unread=false', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-tenant-id': tenantId
  }
});

// Update preferences
const preferences = await fetch('/api/notification-preferences/invoice', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'x-tenant-id': tenantId,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    inAppEnabled: true,
    emailEnabled: true,
    smsEnabled: false
  })
});
```

### cURL Examples

```bash
# Create notification
curl -X POST http://localhost:3000/api/notifications \
  -H "Authorization: Bearer your-jwt-token" \
  -H "x-tenant-id: your-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "category": "invoice",
    "type": "INFO",
    "title": "New Invoice",
    "message": "Your invoice is ready"
  }'

# Get notifications
curl -X GET "http://localhost:3000/api/notifications?page=1&limit=20" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "x-tenant-id: your-tenant-id"

# Update preferences
curl -X PUT http://localhost:3000/api/notification-preferences/invoice \
  -H "Authorization: Bearer your-jwt-token" \
  -H "x-tenant-id: your-tenant-id" \
  -H "Content-Type: application/json" \
  -d '{
    "inAppEnabled": true,
    "emailEnabled": true,
    "smsEnabled": false
  }'
```