# Authentication Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common authentication issues in the multi-tenant NestJS application. It covers problems with JWT tokens, Google OAuth, rate limiting, permissions, and tenant isolation.

## Common Issues and Solutions

### 1. JWT Token Issues

#### Issue: "Invalid token" or "Unauthorized" errors

**Symptoms:**
- 401 Unauthorized responses on protected endpoints
- "Invalid token" error messages
- Users getting logged out unexpectedly

**Possible Causes and Solutions:**

1. **Token Expiration**
   ```bash
   # Check token expiration
   echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." | base64 -d
   ```
   
   **Solution:** Implement token refresh or increase expiration time
   ```typescript
   // In configuration
   JWT_EXPIRES_IN=24h  // Increase from 1h to 24h
   ```

2. **Wrong JWT Secret**
   ```typescript
   // Verify JWT secret matches across all services
   console.log('JWT Secret:', process.env.JWT_SECRET);
   ```
   
   **Solution:** Ensure all services use the same JWT_SECRET

3. **Token Format Issues**
   ```typescript
   // Check token format in request headers
   const authHeader = request.headers.authorization;
   console.log('Auth Header:', authHeader);
   // Should be: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```
   
   **Solution:** Ensure proper "Bearer " prefix

4. **System Clock Skew**
   ```bash
   # Check system time
   date
   # Sync system clock
   sudo ntpdate -s time.nist.gov
   ```

#### Issue: "Token tenant ID does not match request tenant ID"

**Symptoms:**
- 401 Unauthorized with tenant mismatch message
- Users can't access resources in their tenant

**Diagnosis:**
```typescript
// Check JWT payload
const payload = jwt.decode(token);
console.log('Token tenant ID:', payload.tenantId);
console.log('Request tenant ID:', request.headers['x-tenant-id']);
```

**Solutions:**
1. **Frontend sends wrong tenant ID**
   ```typescript
   // Ensure frontend sends correct tenant ID
   const response = await fetch('/api/endpoint', {
     headers: {
       'Authorization': `Bearer ${token}`,
       'x-tenant-id': 'correct-tenant-id', // Must match token
     },
   });
   ```

2. **Token contains wrong tenant ID**
   ```typescript
   // Verify login process includes correct tenant ID
   const payload: JwtPayload = {
     userId: user.id,
     tenantId: user.tenantId, // Ensure this is correct
     roles: user.roles.map(r => r.id),
   };
   ```

### 2. Google OAuth Issues

#### Issue: "Google SSO not enabled for tenant"

**Symptoms:**
- 403 Forbidden when initiating Google OAuth
- "Google SSO not enabled" error message

**Diagnosis:**
```sql
-- Check tenant Google SSO settings
SELECT id, name, google_sso_enabled 
FROM tenants 
WHERE id = 'your-tenant-id';
```

**Solution:**
```sql
-- Enable Google SSO for tenant
UPDATE tenants 
SET google_sso_enabled = true 
WHERE id = 'your-tenant-id';
```

#### Issue: "Invalid Google token" or OAuth callback failures

**Symptoms:**
- 401 Unauthorized during OAuth callback
- "Invalid Google token" error messages
- OAuth flow fails after Google authorization

**Possible Causes and Solutions:**

1. **Wrong Google OAuth Configuration**
   ```typescript
   // Verify Google OAuth settings
   console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID);
   console.log('Google Client Secret:', process.env.GOOGLE_CLIENT_SECRET);
   console.log('Callback URL:', process.env.GOOGLE_CALLBACK_URL);
   ```
   
   **Solution:** Check Google Cloud Console configuration
   - Verify client ID and secret
   - Ensure callback URL matches exactly
   - Check authorized domains

2. **Callback URL Mismatch**
   ```bash
   # Development
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   
   # Production
   GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
   ```
   
   **Solution:** Update Google Cloud Console with correct URLs

3. **Invalid State Parameter**
   ```typescript
   // Check state validation
   const isValidState = await this.oauthStateService.validateState(state);
   console.log('State valid:', isValidState);
   ```
   
   **Solution:** Ensure Redis is working and state TTL is appropriate

#### Issue: "Google account already linked to another user"

**Symptoms:**
- 409 Conflict during account linking
- Cannot link Google account

**Diagnosis:**
```sql
-- Check if Google ID is already linked
SELECT id, email, google_id, tenant_id 
FROM users 
WHERE google_id = 'google-user-id';
```

**Solutions:**
1. **Unlink from previous account first**
2. **Use different Google account**
3. **Admin intervention to resolve conflicts**

### 3. Rate Limiting Issues

#### Issue: "Too Many Requests" (429 errors)

**Symptoms:**
- 429 Too Many Requests responses
- Rate limit exceeded messages
- Users blocked from authentication

**Diagnosis:**
```typescript
// Check rate limit status
const status = await this.rateLimitService.getRateLimitStatus(
  'ip-address',
  'oauth_initiate',
  'ip'
);
console.log('Rate limit status:', status);
```

**Solutions:**

1. **Increase Rate Limits**
   ```bash
   # Increase OAuth rate limits
   GOOGLE_OAUTH_IP_INITIATE_MAX_REQUESTS=20  # Increase from 10
   GOOGLE_OAUTH_TENANT_AUTH_MAX_REQUESTS=100 # Increase from 50
   ```

2. **Reset Rate Limits**
   ```typescript
   // Reset rate limit for specific key
   await this.rateLimitService.resetRateLimit(
     'ip-address',
     'oauth_initiate',
     'ip'
   );
   ```

3. **Check Redis Connection**
   ```bash
   # Test Redis connectivity
   redis-cli ping
   # Should return: PONG
   ```

#### Issue: Rate limiting not working

**Symptoms:**
- No rate limiting applied
- Unlimited requests allowed

**Diagnosis:**
```typescript
// Check Redis connection
try {
  await this.redis.ping();
  console.log('Redis connected');
} catch (error) {
  console.error('Redis connection failed:', error);
}
```

**Solutions:**
1. **Fix Redis Connection**
   ```bash
   # Check Redis configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your-password
   ```

2. **Verify Guard Application**
   ```typescript
   // Ensure rate limit guard is applied
   @UseGuards(GoogleOAuthRateLimitGuard)
   @Get('google')
   async googleAuth() {
     // ...
   }
   ```

### 4. Permission and Authorization Issues

#### Issue: "Missing required permissions" (403 Forbidden)

**Symptoms:**
- 403 Forbidden on protected endpoints
- "Missing required permissions" error

**Diagnosis:**
```sql
-- Check user permissions
SELECT DISTINCT p.action, p.subject
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permission_id
JOIN roles r ON rp.role_id = r.id
JOIN user_roles ur ON r.id = ur.role_id
WHERE ur.user_id = 'user-id'
UNION
SELECT p.action, p.subject
FROM permissions p
JOIN user_permissions up ON p.id = up.permission_id
WHERE up.user_id = 'user-id';
```

**Solutions:**

1. **Assign Required Permissions**
   ```typescript
   // Assign permission to role
   await this.roleService.updatePermissions('role-id', {
     permissionIds: ['permission-id-1', 'permission-id-2']
   });
   ```

2. **Assign Role to User**
   ```typescript
   // Assign role to user
   await this.userService.assignRoles('user-id', {
     roleIds: ['role-id']
   });
   ```

3. **Check Permission Format**
   ```typescript
   // Ensure permissions are formatted correctly
   @Permissions('read:users', 'write:users')
   async getUsers() {
     // Permission format: "action:subject"
   }
   ```

#### Issue: Permission guard not working

**Symptoms:**
- Users can access protected endpoints without permissions
- Permission checks bypassed

**Diagnosis:**
```typescript
// Check guard order
@UseGuards(JwtAuthGuard, PermissionsGuard) // JWT guard must come first
@Permissions('read:users')
async getUsers() {
  // ...
}
```

**Solutions:**
1. **Correct Guard Order**
   ```typescript
   // Always use JwtAuthGuard before PermissionsGuard
   @UseGuards(JwtAuthGuard, PermissionsGuard)
   ```

2. **Verify Permission Decorator**
   ```typescript
   // Check permission decorator is applied
   @Permissions('action:subject')
   ```

### 5. Tenant Isolation Issues

#### Issue: Cross-tenant data access

**Symptoms:**
- Users seeing data from other tenants
- Tenant isolation not working

**Diagnosis:**
```sql
-- Check if data is properly tenant-scoped
SELECT tenant_id, COUNT(*) 
FROM users 
GROUP BY tenant_id;
```

**Solutions:**

1. **Verify Tenant Middleware**
   ```typescript
   // Ensure tenant identification middleware is applied
   app.use(TenantIdentificationMiddleware);
   ```

2. **Check Database Queries**
   ```typescript
   // All queries should include tenant filtering
   const users = await this.prisma.user.findMany({
     where: {
       tenantId: this.tenantContext.getRequiredTenantId(),
       // other conditions
     },
   });
   ```

3. **Verify Prisma Middleware**
   ```typescript
   // Check Prisma tenant middleware is active
   prisma.$use(prismaTenantMiddleware);
   ```

### 6. Database Connection Issues

#### Issue: "Database connection failed"

**Symptoms:**
- Authentication endpoints returning 500 errors
- Database connection timeouts

**Diagnosis:**
```bash
# Test database connection
npx prisma db pull
# Check database URL
echo $DATABASE_URL
```

**Solutions:**

1. **Fix Database URL**
   ```bash
   # Correct format
   DATABASE_URL="postgresql://user:password@localhost:5432/database"
   ```

2. **Check Database Status**
   ```bash
   # PostgreSQL
   sudo systemctl status postgresql
   
   # Docker
   docker ps | grep postgres
   ```

3. **Connection Pool Settings**
   ```typescript
   // Adjust Prisma connection pool
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     connectionLimit = 10
   }
   ```

## Debugging Tools and Commands

### 1. JWT Token Debugging

```bash
# Decode JWT token (without verification)
node -e "
const token = 'your-jwt-token-here';
const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
console.log(JSON.stringify(payload, null, 2));
"
```

### 2. Redis Debugging

```bash
# Connect to Redis
redis-cli

# Check rate limit keys
KEYS google_oauth_*

# Check specific rate limit
ZRANGE google_oauth_ip_rate_limit:initiate:ip:192.168.1.1 0 -1 WITHSCORES

# Check OAuth state
GET oauth_state:your-state-here
```

### 3. Database Debugging

```sql
-- Check user authentication data
SELECT u.id, u.email, u.tenant_id, u.google_id, u.created_at
FROM users u
WHERE u.email = 'user@example.com';

-- Check user roles and permissions
SELECT u.email, r.name as role_name, p.action, p.subject
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE u.id = 'user-id';

-- Check tenant settings
SELECT id, name, google_sso_enabled, created_at
FROM tenants
WHERE id = 'tenant-id';
```

### 4. Application Debugging

```typescript
// Enable debug logging
import { Logger } from '@nestjs/common';

const logger = new Logger('AuthDebug');

// Log authentication attempts
logger.debug(`Login attempt for ${email} in tenant ${tenantId}`);

// Log JWT validation
logger.debug(`JWT validation for user ${userId}, tenant ${tenantId}`);

// Log permission checks
logger.debug(`Permission check: ${requiredPermissions} for user ${userId}`);
```

## Health Check Endpoints

### Authentication Health Check

```typescript
@Controller('health')
export class AuthHealthController {
  @Get('auth')
  async checkAuthHealth() {
    const health = {
      database: false,
      redis: false,
      googleOAuth: false,
      jwtValidation: false,
    };

    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;
      health.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    try {
      // Test Redis connection
      await this.redis.ping();
      health.redis = true;
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    try {
      // Test Google OAuth configuration
      health.googleOAuth = this.googleOAuthService.isConfigured();
    } catch (error) {
      console.error('Google OAuth health check failed:', error);
    }

    try {
      // Test JWT validation
      const testPayload = { userId: 'test', tenantId: 'test', roles: [] };
      const token = this.jwtService.sign(testPayload);
      await this.jwtService.verifyAsync(token);
      health.jwtValidation = true;
    } catch (error) {
      console.error('JWT health check failed:', error);
    }

    return health;
  }
}
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Authentication Success Rate**
   ```typescript
   // Monitor login success/failure ratio
   const successRate = successfulLogins / totalLoginAttempts;
   ```

2. **OAuth Flow Completion Rate**
   ```typescript
   // Monitor OAuth callback success rate
   const oauthSuccessRate = successfulCallbacks / initiatedFlows;
   ```

3. **Rate Limit Hit Rate**
   ```typescript
   // Monitor rate limiting effectiveness
   const rateLimitHitRate = rateLimitHits / totalRequests;
   ```

4. **Token Validation Errors**
   ```typescript
   // Monitor JWT validation failures
   const tokenErrorRate = tokenValidationErrors / totalTokenValidations;
   ```

### Alert Conditions

1. **High Authentication Failure Rate**
   - Alert if login failure rate > 50% over 5 minutes
   - Possible brute force attack

2. **OAuth Configuration Issues**
   - Alert if OAuth success rate < 90% over 10 minutes
   - Possible configuration problems

3. **Rate Limiting Triggered**
   - Alert if rate limit hit rate > 10% over 5 minutes
   - Possible abuse or misconfiguration

4. **Database Connection Issues**
   - Alert if database connection failures > 5% over 1 minute
   - Critical system issue

## Performance Optimization

### Common Performance Issues

1. **Slow JWT Validation**
   ```typescript
   // Cache user data during request lifecycle
   @Injectable()
   export class UserCacheService {
     private cache = new Map();
     
     async getUser(userId: string) {
       if (!this.cache.has(userId)) {
         const user = await this.prisma.user.findUnique({
           where: { id: userId },
           include: { roles: true },
         });
         this.cache.set(userId, user);
       }
       return this.cache.get(userId);
     }
   }
   ```

2. **Slow Permission Queries**
   ```sql
   -- Add database indexes
   CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
   CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
   CREATE INDEX idx_users_email_tenant ON users(email, tenant_id);
   ```

3. **Redis Connection Pool**
   ```typescript
   // Optimize Redis connection pool
   const redis = new Redis({
     host: 'localhost',
     port: 6379,
     maxRetriesPerRequest: 3,
     retryDelayOnFailover: 100,
     lazyConnect: true,
     keepAlive: 30000,
   });
   ```

This troubleshooting guide provides comprehensive solutions for common authentication issues, helping developers quickly identify and resolve problems in production environments.