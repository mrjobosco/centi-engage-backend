# API Patterns and Conventions

This document outlines common patterns, conventions, and best practices used across all API endpoints in the Multi-Tenant NestJS application.

## Common Request Patterns

### Authentication Pattern

All protected endpoints require JWT authentication:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Tenant Identification Pattern

Most endpoints require tenant identification:

```http
x-tenant-id: tenant_123
```

### Content Type Pattern

For requests with body data:

```http
Content-Type: application/json
```

## Response Patterns

### Success Response Structure

#### Single Resource
```json
{
  "id": "resource_123",
  "name": "Resource Name",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Collection Response
```json
[
  {
    "id": "resource_123",
    "name": "Resource Name"
  },
  {
    "id": "resource_124",
    "name": "Another Resource"
  }
]
```

#### Paginated Response
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10
}
```

#### Operation Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully"
}
```

### Error Response Structure

All error responses follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Detailed error description",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

## Pagination Patterns

### Query Parameters
- `page` (optional): Page number, starts from 1 (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)

### Example Request
```bash
GET /api/users?page=2&limit=20
```

### Example Response
```json
{
  "data": [...],
  "total": 150,
  "page": 2,
  "limit": 20,
  "totalPages": 8
}
```

## Filtering Patterns

### Query Parameter Filtering

#### Basic Filtering
```bash
GET /api/notifications?type=INFO&read=false
```

#### Date Range Filtering
```bash
GET /api/notifications?startDate=2024-01-01&endDate=2024-01-31
```

#### Multiple Value Filtering
```bash
GET /api/users?roles=admin,editor&status=active
```

### Filter Parameter Conventions
- Use camelCase for parameter names
- Use ISO 8601 format for dates
- Use comma-separated values for multiple selections
- Use boolean strings ("true", "false") for boolean filters

## Sorting Patterns

### Query Parameter Sorting
```bash
GET /api/users?sortBy=createdAt&sortOrder=desc
```

### Sort Parameter Conventions
- `sortBy`: Field name to sort by
- `sortOrder`: "asc" or "desc" (default: "asc")

### Multiple Field Sorting
```bash
GET /api/users?sortBy=lastName,firstName&sortOrder=asc,asc
```

## Search Patterns

### Text Search
```bash
GET /api/users?search=john&searchFields=firstName,lastName,email
```

### Search Parameter Conventions
- `search`: Search term
- `searchFields`: Comma-separated list of fields to search in
- Case-insensitive partial matching

## CRUD Operation Patterns

### Create (POST)
```bash
POST /api/resource
Content-Type: application/json

{
  "name": "New Resource",
  "description": "Resource description"
}
```

**Response:** 201 Created with created resource

### Read (GET)
```bash
# Get all resources
GET /api/resource

# Get specific resource
GET /api/resource/123
```

**Response:** 200 OK with resource(s)

### Update (PUT)
```bash
PUT /api/resource/123
Content-Type: application/json

{
  "name": "Updated Resource",
  "description": "Updated description"
}
```

**Response:** 200 OK with updated resource

### Partial Update (PATCH)
```bash
PATCH /api/resource/123
Content-Type: application/json

{
  "name": "New Name Only"
}
```

**Response:** 200 OK with updated resource

### Delete (DELETE)
```bash
DELETE /api/resource/123
```

**Response:** 200 OK with confirmation message

## Relationship Patterns

### Nested Resource Access
```bash
# Get user's roles
GET /api/users/123/roles

# Get user's permissions
GET /api/users/123/permissions

# Get role's permissions
GET /api/roles/456/permissions
```

### Relationship Management
```bash
# Assign roles to user (replace existing)
PUT /api/users/123/roles
{
  "roleIds": ["role_1", "role_2"]
}

# Add permissions to role
PUT /api/roles/456/permissions
{
  "permissionIds": ["perm_1", "perm_2", "perm_3"]
}
```

## Bulk Operation Patterns

### Bulk Create
```bash
POST /api/users/bulk
{
  "users": [
    {"email": "user1@example.com", "name": "User 1"},
    {"email": "user2@example.com", "name": "User 2"}
  ]
}
```

### Bulk Update
```bash
PATCH /api/users/bulk
{
  "updates": [
    {"id": "user_1", "name": "Updated Name 1"},
    {"id": "user_2", "name": "Updated Name 2"}
  ]
}
```

### Bulk Delete
```bash
DELETE /api/users/bulk
{
  "ids": ["user_1", "user_2", "user_3"]
}
```

## Validation Patterns

### Request Validation
- All input data is validated using class-validator decorators
- Validation errors return 400 Bad Request with detailed messages
- Required fields are clearly documented in API specs

### Example Validation Error
```json
{
  "statusCode": 400,
  "message": [
    "email must be a valid email",
    "password must be longer than or equal to 8 characters"
  ],
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

## Rate Limiting Patterns

### Rate Limit Headers
Responses include rate limiting information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Rate Limit Categories
- **Authentication**: 5-10 requests per minute
- **Read Operations**: 60-100 requests per minute
- **Write Operations**: 10-30 requests per minute
- **Admin Operations**: 5 requests per 5 minutes
- **Bulk Operations**: 1-5 requests per minute

## Caching Patterns

### Cache Headers
```http
Cache-Control: public, max-age=300
ETag: "abc123def456"
Last-Modified: Wed, 01 Jan 2024 00:00:00 GMT
```

### Conditional Requests
```bash
GET /api/users/123
If-None-Match: "abc123def456"
```

**Response:** 304 Not Modified (if unchanged)

## Security Patterns

### Permission-Based Access
```bash
# Endpoint requires specific permission
GET /api/users
# Requires: read:user permission
```

### Resource Ownership
```bash
# User can only access their own resources
GET /api/users/me/notifications
# Automatically filtered to current user
```

### Tenant Isolation
```bash
# All operations scoped to tenant
GET /api/users
# Only returns users from current tenant
```

## Versioning Patterns

### URL Versioning (Future)
```bash
GET /api/v1/users
GET /api/v2/users
```

### Header Versioning (Future)
```bash
GET /api/users
Accept: application/vnd.api+json;version=1
```

## Content Negotiation Patterns

### Request Content Types
- `application/json` - Standard JSON requests
- `multipart/form-data` - File uploads
- `application/x-www-form-urlencoded` - Form submissions

### Response Content Types
- `application/json` - Standard JSON responses
- `text/csv` - CSV exports
- `application/pdf` - PDF reports

## Webhook Patterns (Future)

### Webhook Registration
```bash
POST /api/webhooks
{
  "url": "https://example.com/webhook",
  "events": ["user.created", "project.updated"],
  "secret": "webhook_secret"
}
```

### Webhook Payload
```json
{
  "event": "user.created",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "data": {
    "id": "user_123",
    "email": "user@example.com"
  }
}
```

## Best Practices

### Request Best Practices
1. **Use appropriate HTTP methods** for different operations
2. **Include proper headers** for authentication and content type
3. **Validate input data** before sending requests
4. **Handle rate limits** gracefully with exponential backoff
5. **Use pagination** for large data sets

### Response Handling Best Practices
1. **Check status codes** before processing response data
2. **Handle error responses** appropriately
3. **Implement retry logic** for transient failures
4. **Cache responses** when appropriate
5. **Parse JSON safely** with error handling

### Security Best Practices
1. **Always use HTTPS** in production
2. **Store JWT tokens securely** (not in localStorage)
3. **Implement token refresh** logic
4. **Validate server certificates**
5. **Log security events** appropriately

### Performance Best Practices
1. **Use pagination** for large datasets
2. **Implement caching** where appropriate
3. **Minimize request payload** size
4. **Use compression** for large responses
5. **Implement connection pooling** for high-volume applications