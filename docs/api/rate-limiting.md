# API Rate Limiting

This document provides comprehensive information about rate limiting implementation, configuration, and best practices for the Multi-Tenant NestJS API.

## Overview

Rate limiting is implemented to protect the API from abuse, ensure fair usage across tenants, and maintain system stability. The API uses multiple layers of rate limiting with different strategies for different types of operations.

## Rate Limiting Strategy

### Multi-Layer Approach

1. **Global Rate Limiting**: Applied to all requests
2. **Endpoint-Specific Limiting**: Different limits for different operations
3. **User-Based Limiting**: Per-user rate limits
4. **Tenant-Based Limiting**: Per-tenant rate limits
5. **IP-Based Limiting**: Per-IP address limits (future enhancement)

### Rate Limiting Headers

All responses include rate limiting information in headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 60
```

**Header Descriptions:**
- `X-RateLimit-Limit`: Maximum requests allowed in the time window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets
- `X-RateLimit-Window`: Time window in seconds

## Rate Limit Categories

### Authentication Endpoints

#### Login Operations
```
POST /auth/login
Rate Limit: 5 requests per minute per IP
```

**Purpose**: Prevent brute force attacks
**Scope**: Per IP address
**Reset**: 60 seconds

#### OAuth Operations
```
GET /auth/google
POST /auth/google/callback
Rate Limit: 10 requests per minute per IP
```

**Purpose**: Prevent OAuth abuse
**Scope**: Per IP address
**Reset**: 60 seconds

#### Account Linking
```
GET /auth/google/link
POST /auth/google/link/callback
POST /auth/google/unlink
Rate Limit: 5 requests per minute per user
```

**Purpose**: Prevent account linking abuse
**Scope**: Per authenticated user
**Reset**: 60 seconds

### Read Operations

#### Standard Read Operations
```
GET /users
GET /roles
GET /permissions
GET /projects
Rate Limit: 100 requests per minute per user
```

**Purpose**: Allow frequent data access while preventing abuse
**Scope**: Per authenticated user
**Reset**: 60 seconds

#### Notification Read Operations
```
GET /notifications
GET /notifications/unread-count
Rate Limit: 100 requests per minute per user
```

**Purpose**: Support real-time notification checking
**Scope**: Per authenticated user
**Reset**: 60 seconds

#### Preference Read Operations
```
GET /notification-preferences
GET /notification-preferences/categories
Rate Limit: 30 requests per minute per user
```

**Purpose**: Allow frequent preference checking
**Scope**: Per authenticated user
**Reset**: 60 seconds

### Write Operations

#### User Management
```
POST /users
PUT /users/:id
DELETE /users/:id
Rate Limit: 10 requests per minute per user
```

**Purpose**: Prevent bulk user operations abuse
**Scope**: Per authenticated user
**Reset**: 60 seconds

#### Role and Permission Management
```
POST /roles
PUT /roles/:id
DELETE /roles/:id
POST /permissions
DELETE /permissions/:id
Rate Limit: 10 requests per minute per user
```

**Purpose**: Prevent security configuration abuse
**Scope**: Per authenticated user
**Reset**: 60 seconds

#### Project Management
```
POST /projects
PUT /projects/:id
DELETE /projects/:id
Rate Limit: 20 requests per minute per user
```

**Purpose**: Allow reasonable project management activity
**Scope**: Per authenticated user
**Reset**: 60 seconds

#### Notification Operations
```
POST /notifications
Rate Limit: 10 requests per minute per user
```

**Purpose**: Prevent notification spam
**Scope**: Per authenticated user
**Reset**: 60 seconds

```
PATCH /notifications/:id/read
Rate Limit: 50 requests per minute per user
```

**Purpose**: Allow frequent read status updates
**Scope**: Per authenticated user
**Reset**: 60 seconds

```
DELETE /notifications/:id
Rate Limit: 30 requests per minute per user
```

**Purpose**: Allow reasonable notification cleanup
**Scope**: Per authenticated user
**Reset**: 60 seconds

#### Preference Updates
```
PUT /notification-preferences/:category
Rate Limit: 20 requests per minute per user
```

**Purpose**: Allow preference adjustments while preventing abuse
**Scope**: Per authenticated user
**Reset**: 60 seconds

### Admin Operations

#### Tenant Broadcast
```
POST /notifications/tenant-broadcast
Rate Limit: 5 requests per 5 minutes per user
```

**Purpose**: Prevent admin notification spam
**Scope**: Per authenticated admin user
**Reset**: 300 seconds (5 minutes)

#### Bulk Operations
```
POST /users/bulk
PATCH /users/bulk
DELETE /users/bulk
Rate Limit: 1 request per minute per user
```

**Purpose**: Prevent system overload from bulk operations
**Scope**: Per authenticated user
**Reset**: 60 seconds

## Rate Limiting Implementation

### Throttler Configuration

The API uses NestJS Throttler with Redis storage for distributed rate limiting:

```typescript
// Rate limiting configuration
@Throttle({ default: { limit: 100, ttl: 60000 } })
@Controller('users')
export class UserController {
  // Controller methods
}
```

### Custom Rate Limiting Guards

#### Notification Rate Limit Guard
```typescript
@UseGuards(NotificationRateLimitGuard)
export class NotificationsController {
  // Applies notification-specific rate limits
}
```

#### Tenant Rate Limit Guard
```typescript
@UseGuards(TenantRateLimitGuard)
export class NotificationsController {
  // Applies tenant-level rate limits
}
```

#### Google OAuth Rate Limit Guard
```typescript
@UseGuards(GoogleOAuthRateLimitGuard)
export class AuthController {
  // Applies OAuth-specific rate limits
}
```

### Rate Limit Bypass

#### Skip Rate Limiting Decorator
```typescript
@SkipGoogleOAuthRateLimit()
@Get('health')
healthCheck() {
  // This endpoint skips OAuth rate limiting
}
```

## Error Responses

### Rate Limit Exceeded (429)

```json
{
  "statusCode": 429,
  "message": "Too Many Requests",
  "error": "ThrottlerException",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login"
}
```

### Rate Limit with Retry Information

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

## Client-Side Handling

### Basic Rate Limit Handling

```javascript
async function makeApiRequest(url, options) {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('X-RateLimit-Reset');
      const resetTime = new Date(parseInt(retryAfter) * 1000);
      const waitTime = resetTime.getTime() - Date.now();
      
      console.log(`Rate limited. Retry after ${waitTime}ms`);
      
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return makeApiRequest(url, options);
    }
    
    return response;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}
```

### Advanced Rate Limit Handling with Exponential Backoff

```javascript
class ApiClient {
  constructor() {
    this.rateLimitInfo = new Map();
  }
  
  async request(url, options, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        // Update rate limit info
        this.updateRateLimitInfo(url, response.headers);
        
        if (response.status === 429) {
          const backoffTime = this.calculateBackoff(attempt);
          console.log(`Rate limited. Backing off for ${backoffTime}ms`);
          await this.delay(backoffTime);
          continue;
        }
        
        return response;
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;
        await this.delay(this.calculateBackoff(attempt));
      }
    }
  }
  
  updateRateLimitInfo(url, headers) {
    this.rateLimitInfo.set(url, {
      limit: parseInt(headers.get('X-RateLimit-Limit')),
      remaining: parseInt(headers.get('X-RateLimit-Remaining')),
      reset: parseInt(headers.get('X-RateLimit-Reset')),
      window: parseInt(headers.get('X-RateLimit-Window'))
    });
  }
  
  calculateBackoff(attempt) {
    return Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getRateLimitInfo(url) {
    return this.rateLimitInfo.get(url);
  }
}
```

### Proactive Rate Limit Management

```javascript
class RateLimitManager {
  constructor() {
    this.requestQueue = [];
    this.processing = false;
  }
  
  async queueRequest(url, options) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, options, resolve, reject });
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const { url, options, resolve, reject } = this.requestQueue.shift();
      
      try {
        const response = await fetch(url, options);
        
        if (response.status === 429) {
          // Re-queue the request
          this.requestQueue.unshift({ url, options, resolve, reject });
          
          const retryAfter = response.headers.get('Retry-After') || 60;
          await this.delay(parseInt(retryAfter) * 1000);
          continue;
        }
        
        resolve(response);
        
        // Add small delay between requests to avoid hitting limits
        await this.delay(100);
      } catch (error) {
        reject(error);
      }
    }
    
    this.processing = false;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Monitoring and Analytics

### Rate Limit Metrics

The API tracks rate limiting metrics for monitoring:

- **Requests per endpoint**: Track usage patterns
- **Rate limit hits**: Monitor when limits are exceeded
- **User behavior**: Identify users hitting limits frequently
- **Tenant usage**: Monitor tenant-level usage patterns

### Alerting

Alerts are configured for:
- High rate limit hit rates (>10% of requests)
- Specific users consistently hitting limits
- Potential abuse patterns
- System performance impact from rate limiting

## Configuration

### Environment Variables

```bash
# Rate limiting configuration
THROTTLE_TTL=60000                    # Default TTL in milliseconds
THROTTLE_LIMIT=100                    # Default request limit
THROTTLE_STORAGE=redis                # Storage backend
REDIS_URL=redis://localhost:6379      # Redis connection

# Specific rate limits
AUTH_RATE_LIMIT=5                     # Auth requests per minute
NOTIFICATION_RATE_LIMIT=10            # Notification creation per minute
ADMIN_RATE_LIMIT=5                    # Admin operations per 5 minutes
```

### Dynamic Rate Limit Adjustment

Rate limits can be adjusted dynamically based on:
- System load
- Tenant subscription level
- User behavior patterns
- Time of day/week

## Best Practices

### For API Consumers

1. **Implement Exponential Backoff**: Use exponential backoff for retry logic
2. **Monitor Rate Limit Headers**: Check headers to avoid hitting limits
3. **Cache Responses**: Cache API responses to reduce request frequency
4. **Batch Operations**: Use bulk endpoints when available
5. **Optimize Request Patterns**: Avoid unnecessary API calls

### For API Developers

1. **Set Appropriate Limits**: Balance usability with protection
2. **Provide Clear Error Messages**: Include retry information in errors
3. **Monitor Usage Patterns**: Adjust limits based on actual usage
4. **Implement Graceful Degradation**: Handle rate limits gracefully
5. **Document Limits Clearly**: Make rate limits visible in documentation

## Troubleshooting

### Common Issues

#### Frequent Rate Limit Hits
- **Cause**: Client making too many requests
- **Solution**: Implement proper retry logic and request batching

#### Inconsistent Rate Limiting
- **Cause**: Multiple server instances with different configurations
- **Solution**: Use centralized rate limiting with Redis

#### Rate Limits Too Restrictive
- **Cause**: Limits set too low for legitimate usage
- **Solution**: Monitor usage patterns and adjust limits

#### Rate Limits Too Permissive
- **Cause**: Limits set too high, allowing abuse
- **Solution**: Implement stricter limits and monitoring

### Debugging Rate Limits

```bash
# Check current rate limit status
curl -I http://localhost:3000/api/users \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: <tenant>"

# Look for rate limit headers in response
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Rate Limit Testing

```javascript
// Test rate limiting behavior
async function testRateLimit() {
  const requests = [];
  
  // Make multiple requests quickly
  for (let i = 0; i < 10; i++) {
    requests.push(
      fetch('/api/users', {
        headers: {
          'Authorization': 'Bearer ' + token,
          'x-tenant-id': tenantId
        }
      })
    );
  }
  
  const responses = await Promise.all(requests);
  
  responses.forEach((response, index) => {
    console.log(`Request ${index + 1}:`, {
      status: response.status,
      remaining: response.headers.get('X-RateLimit-Remaining'),
      reset: response.headers.get('X-RateLimit-Reset')
    });
  });
}
```

## Future Enhancements

### Planned Features

1. **Adaptive Rate Limiting**: Adjust limits based on system load
2. **User-Specific Limits**: Different limits for different user tiers
3. **Geographic Rate Limiting**: Different limits by region
4. **API Key Rate Limiting**: Separate limits for API key authentication
5. **Webhook Rate Limiting**: Rate limits for webhook deliveries

### Advanced Features

1. **Machine Learning**: Detect abuse patterns using ML
2. **Predictive Scaling**: Adjust limits based on predicted load
3. **Custom Rate Limit Policies**: Tenant-specific rate limiting rules
4. **Real-time Monitoring**: Live rate limit monitoring dashboard