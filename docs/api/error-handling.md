# API Error Handling

This document provides comprehensive information about error handling patterns, status codes, and error response formats used across all API endpoints.

## Error Response Format

All API errors follow a consistent response structure:

```json
{
  "statusCode": 400,
  "message": "Detailed error description",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

### Response Fields
- `statusCode`: HTTP status code (number)
- `message`: Human-readable error description (string or array)
- `error`: HTTP status text (string)
- `timestamp`: ISO 8601 timestamp when error occurred
- `path`: API endpoint path where error occurred

## HTTP Status Codes

### 2xx Success Codes

| Code | Status | Description | Usage |
|------|--------|-------------|-------|
| 200 | OK | Request successful | GET, PUT, PATCH, DELETE operations |
| 201 | Created | Resource created successfully | POST operations |
| 204 | No Content | Request successful, no content returned | DELETE operations (alternative) |

### 4xx Client Error Codes

| Code | Status | Description | Common Causes |
|------|--------|-------------|---------------|
| 400 | Bad Request | Invalid request data | Validation errors, malformed JSON |
| 401 | Unauthorized | Authentication required | Missing/invalid JWT token |
| 403 | Forbidden | Insufficient permissions | Missing required permissions |
| 404 | Not Found | Resource not found | Invalid resource ID, deleted resource |
| 409 | Conflict | Resource already exists | Duplicate email, name conflicts |
| 422 | Unprocessable Entity | Validation failed | Business logic validation errors |
| 429 | Too Many Requests | Rate limit exceeded | Too many requests in time window |

### 5xx Server Error Codes

| Code | Status | Description | Common Causes |
|------|--------|-------------|---------------|
| 500 | Internal Server Error | Unexpected server error | Database errors, unhandled exceptions |
| 502 | Bad Gateway | Upstream service error | External service failures |
| 503 | Service Unavailable | Service temporarily unavailable | Maintenance, overload |
| 504 | Gateway Timeout | Upstream service timeout | Slow external services |

## Error Categories

### Authentication Errors (401)

#### Missing Token
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

#### Invalid Token
```json
{
  "statusCode": 401,
  "message": "Invalid token",
  "error": "Unauthorized",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

#### Expired Token
```json
{
  "statusCode": 401,
  "message": "Token has expired",
  "error": "Unauthorized",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

### Authorization Errors (403)

#### Insufficient Permissions
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions to access this resource",
  "error": "Forbidden",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

#### Missing Required Permission
```json
{
  "statusCode": 403,
  "message": "Required permission 'create:user' not found",
  "error": "Forbidden",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

#### Tenant Access Denied
```json
{
  "statusCode": 403,
  "message": "Access denied to tenant resources",
  "error": "Forbidden",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

### Validation Errors (400)

#### Single Validation Error
```json
{
  "statusCode": 400,
  "message": "email must be a valid email",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

#### Multiple Validation Errors
```json
{
  "statusCode": 400,
  "message": [
    "email must be a valid email",
    "password must be longer than or equal to 8 characters",
    "firstName should not be empty"
  ],
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

#### Missing Required Fields
```json
{
  "statusCode": 400,
  "message": [
    "email should not be empty",
    "password should not be empty"
  ],
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

### Resource Errors (404)

#### Resource Not Found
```json
{
  "statusCode": 404,
  "message": "User with ID 'user_123' not found",
  "error": "Not Found",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users/user_123"
}
```

#### Endpoint Not Found
```json
{
  "statusCode": 404,
  "message": "Cannot GET /api/invalid-endpoint",
  "error": "Not Found",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/invalid-endpoint"
}
```

### Conflict Errors (409)

#### Duplicate Resource
```json
{
  "statusCode": 409,
  "message": "User with email 'user@example.com' already exists",
  "error": "Conflict",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

#### Business Logic Conflict
```json
{
  "statusCode": 409,
  "message": "Cannot delete role that is assigned to users",
  "error": "Conflict",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/roles/role_123"
}
```

### Rate Limiting Errors (429)

#### Rate Limit Exceeded
```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "ThrottlerException",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login"
}
```

#### Rate Limit with Details
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded: 5 requests per minute",
  "error": "ThrottlerException",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login",
  "retryAfter": 45
}
```

### Server Errors (500)

#### Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

#### Database Connection Error
```json
{
  "statusCode": 500,
  "message": "Database connection failed",
  "error": "Internal Server Error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

## Module-Specific Errors

### Authentication Module Errors

#### Invalid Credentials
```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": "Unauthorized",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login"
}
```

#### Google OAuth Errors
```json
{
  "statusCode": 400,
  "message": "Invalid or expired state parameter",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/google/callback"
}
```

#### Account Linking Errors
```json
{
  "statusCode": 409,
  "message": "Google account already linked to another user",
  "error": "Conflict",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/google/link/callback"
}
```

### Notification Module Errors

#### Notification Not Found
```json
{
  "statusCode": 404,
  "message": "Notification not found or access denied",
  "error": "Not Found",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/notifications/notif_123"
}
```

#### Invalid Notification Data
```json
{
  "statusCode": 400,
  "message": [
    "title must be longer than or equal to 1 characters",
    "message must be longer than or equal to 1 characters",
    "type must be one of the following values: INFO, WARNING, SUCCESS, ERROR"
  ],
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/notifications"
}
```

### Tenant Module Errors

#### Missing Tenant ID
```json
{
  "statusCode": 400,
  "message": "Tenant ID is required",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login"
}
```

#### Invalid Tenant
```json
{
  "statusCode": 403,
  "message": "Invalid tenant or access denied",
  "error": "Forbidden",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

## Error Handling Best Practices

### Client-Side Error Handling

#### Basic Error Handling
```javascript
try {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-id': tenantId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const user = await response.json();
  return user;
} catch (error) {
  console.error('Failed to create user:', error.message);
  throw error;
}
```

#### Comprehensive Error Handling
```javascript
async function handleApiRequest(url, options) {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      
      switch (response.status) {
        case 401:
          // Handle authentication errors
          redirectToLogin();
          break;
        case 403:
          // Handle authorization errors
          showPermissionError();
          break;
        case 429:
          // Handle rate limiting
          const retryAfter = error.retryAfter || 60;
          await delay(retryAfter * 1000);
          return handleApiRequest(url, options); // Retry
        case 500:
          // Handle server errors
          showServerErrorMessage();
          break;
        default:
          // Handle other errors
          showErrorMessage(error.message);
      }
      
      throw new Error(error.message);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'NetworkError') {
      showNetworkErrorMessage();
    }
    throw error;
  }
}
```

### Retry Logic

#### Exponential Backoff
```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

#### Rate Limit Handling
```javascript
async function handleRateLimit(response) {
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || 60;
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return true; // Indicate retry needed
  }
  return false;
}
```

### Error Logging

#### Client-Side Logging
```javascript
function logError(error, context) {
  const errorData = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    context
  };
  
  // Send to logging service
  fetch('/api/logs/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(errorData)
  });
}
```

#### Server-Side Error Context
```typescript
// Errors include additional context for debugging
{
  "statusCode": 500,
  "message": "Database query failed",
  "error": "Internal Server Error",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users",
  "requestId": "req_123456789",
  "userId": "user_123",
  "tenantId": "tenant_123"
}
```

## Error Prevention

### Input Validation
- Validate all input data on both client and server
- Use appropriate data types and constraints
- Sanitize user input to prevent injection attacks

### Authentication Checks
- Always verify JWT tokens before processing requests
- Check token expiration and refresh when necessary
- Validate user permissions for each operation

### Rate Limiting
- Implement appropriate rate limits for different operations
- Use exponential backoff for retry logic
- Monitor and adjust rate limits based on usage patterns

### Error Monitoring
- Implement comprehensive error logging
- Set up alerts for critical errors
- Monitor error rates and patterns
- Use error tracking services for production applications

## Testing Error Scenarios

### Unit Tests
```typescript
describe('User API Error Handling', () => {
  it('should return 400 for invalid email', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'invalid-email', password: 'password123' })
      .expect(400);
    
    expect(response.body.message).toContain('email must be a valid email');
  });
  
  it('should return 401 for missing token', async () => {
    const response = await request(app)
      .get('/api/users')
      .expect(401);
    
    expect(response.body.message).toBe('Unauthorized');
  });
});
```

### Integration Tests
```typescript
describe('Error Handling Integration', () => {
  it('should handle database connection errors gracefully', async () => {
    // Simulate database failure
    await disconnectDatabase();
    
    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(500);
    
    expect(response.body.message).toContain('Database connection failed');
  });
});
```