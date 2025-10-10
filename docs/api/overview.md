# API Reference Overview

This document provides a comprehensive reference for all API endpoints in the Multi-Tenant NestJS application.

## Base URL

```
http://localhost:3000/api
```

## Interactive Documentation

The API includes interactive Swagger documentation available at:
```
http://localhost:3000/api/docs
```

## Authentication

All API endpoints (except public ones) require authentication using JWT Bearer tokens.

### Authentication Header
```http
Authorization: Bearer <jwt_token>
```

### Tenant Identification
Most endpoints require a tenant identifier in the header:
```http
x-tenant-id: <tenant_id>
```

## API Modules

### Core Modules
- [Authentication API](./authentication.md) - User authentication and OAuth flows
- [Users API](./users.md) - User management and permissions
- [Tenants API](./tenants.md) - Tenant management and configuration
- [Roles API](./roles.md) - Role-based access control
- [Permissions API](./permissions.md) - Permission management
- [Projects API](./projects.md) - Project management

### Feature Modules
- [Notifications API](./notifications.md) - Notification system
- [Notification Preferences API](./notification-preferences.md) - User notification preferences

### Reference Documentation
- [API Patterns](./patterns.md) - Common patterns and conventions
- [Error Handling](./error-handling.md) - Error responses and handling
- [Rate Limiting](./rate-limiting.md) - Rate limiting policies and implementation
- [Tenant Isolation](./tenant-isolation.md) - Multi-tenant architecture and data isolation
- [Integration Guide](./integration-guide.md) - Complete integration examples and best practices

## Common Response Patterns

### Success Response
```json
{
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

### Paginated Response
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

## Rate Limiting

API endpoints are protected by rate limiting:
- Authentication endpoints: 5-10 requests per minute
- Read operations: 60-100 requests per minute
- Write operations: 10-30 requests per minute
- Admin operations: 5 requests per 5 minutes

## Status Codes

| Code | Description |
|------|-------------|
| 200  | OK - Request successful |
| 201  | Created - Resource created successfully |
| 400  | Bad Request - Invalid request data |
| 401  | Unauthorized - Authentication required |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource not found |
| 409  | Conflict - Resource already exists |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error - Server error |

## Tenant Isolation

All data operations are automatically isolated by tenant. Users can only access data within their own tenant context.

## Next Steps

- Review the [Authentication API](./authentication.md) to understand login flows
- Check [Common Patterns](./patterns.md) for API usage conventions
- Explore [Error Handling](./error-handling.md) for detailed error responses