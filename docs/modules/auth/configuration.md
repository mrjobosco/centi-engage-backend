# Authentication Configuration

## Overview

The authentication module requires comprehensive configuration for JWT tokens, Google OAuth, rate limiting, and security settings. This document covers all configuration options, environment variables, and setup procedures.

## Environment Variables

### Required Variables

#### JWT Configuration
```bash
# JWT secret key for token signing and verification
JWT_SECRET=your-super-secure-jwt-secret-key-here

# JWT token expiration time (examples: 1h, 24h, 7d)
JWT_EXPIRES_IN=1h
```

#### Google OAuth Configuration
```bash
# Google OAuth client credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz123456

# OAuth callback URL (must match Google Cloud Console configuration)
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

#### Redis Configuration (for rate limiting and state management)
```bash
# Redis connection settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_DB=0
```

### Optional Rate Limiting Configuration

#### IP-Based Rate Limiting
```bash
# OAuth initiation rate limits (per IP)
GOOGLE_OAUTH_IP_INITIATE_WINDOW_MS=60000        # 1 minute window
GOOGLE_OAUTH_IP_INITIATE_MAX_REQUESTS=10        # 10 requests per window

# OAuth callback rate limits (per IP)
GOOGLE_OAUTH_IP_CALLBACK_WINDOW_MS=60000        # 1 minute window
GOOGLE_OAUTH_IP_CALLBACK_MAX_REQUESTS=15        # 15 requests per window

# Account linking rate limits (per IP)
GOOGLE_OAUTH_IP_LINKING_WINDOW_MS=300000        # 5 minute window
GOOGLE_OAUTH_IP_LINKING_MAX_REQUESTS=5          # 5 requests per window

# Account unlinking rate limits (per IP)
GOOGLE_OAUTH_IP_UNLINK_WINDOW_MS=300000         # 5 minute window
GOOGLE_OAUTH_IP_UNLINK_MAX_REQUESTS=3           # 3 requests per window

# Admin settings rate limits (per IP)
GOOGLE_OAUTH_IP_ADMIN_WINDOW_MS=60000           # 1 minute window
GOOGLE_OAUTH_IP_ADMIN_MAX_REQUESTS=20           # 20 requests per window

# General OAuth rate limits (per IP)
GOOGLE_OAUTH_IP_GENERAL_WINDOW_MS=60000         # 1 minute window
GOOGLE_OAUTH_IP_GENERAL_MAX_REQUESTS=30         # 30 requests per window
```

#### Tenant-Based Rate Limiting
```bash
# OAuth authentication rate limits (per tenant)
GOOGLE_OAUTH_TENANT_AUTH_WINDOW_MS=60000        # 1 minute window
GOOGLE_OAUTH_TENANT_AUTH_MAX_REQUESTS=50        # 50 requests per window

# Account linking rate limits (per tenant)
GOOGLE_OAUTH_TENANT_LINKING_WINDOW_MS=300000    # 5 minute window
GOOGLE_OAUTH_TENANT_LINKING_MAX_REQUESTS=20     # 20 requests per window

# Admin settings rate limits (per tenant)
GOOGLE_OAUTH_TENANT_ADMIN_WINDOW_MS=60000       # 1 minute window
GOOGLE_OAUTH_TENANT_ADMIN_MAX_REQUESTS=100      # 100 requests per window

# General OAuth rate limits (per tenant)
GOOGLE_OAUTH_TENANT_GENERAL_WINDOW_MS=60000     # 1 minute window
GOOGLE_OAUTH_TENANT_GENERAL_MAX_REQUESTS=100    # 100 requests per window
```

#### User-Based Rate Limiting
```bash
# Account linking rate limits (per user)
GOOGLE_OAUTH_USER_LINKING_WINDOW_MS=900000      # 15 minute window
GOOGLE_OAUTH_USER_LINKING_MAX_REQUESTS=3        # 3 requests per window

# Account unlinking rate limits (per user)
GOOGLE_OAUTH_USER_UNLINK_WINDOW_MS=3600000      # 1 hour window
GOOGLE_OAUTH_USER_UNLINK_MAX_REQUESTS=2         # 2 requests per window

# General OAuth rate limits (per user)
GOOGLE_OAUTH_USER_GENERAL_WINDOW_MS=60000       # 1 minute window
GOOGLE_OAUTH_USER_GENERAL_MAX_REQUESTS=10       # 10 requests per window
```

### Optional Security Configuration
```bash
# Password hashing rounds (default: 12)
BCRYPT_ROUNDS=12

# OAuth state parameter TTL in seconds (default: 600 = 10 minutes)
OAUTH_STATE_TTL=600

# Audit log retention in days (default: 90)
AUDIT_LOG_RETENTION_DAYS=90
```

## Google OAuth Setup

### 1. Google Cloud Console Configuration

1. **Create a Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Google+ API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

3. **Create OAuth 2.0 Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Add authorized redirect URIs:
     ```
     http://localhost:3000/auth/google/callback  # Development
     https://yourdomain.com/auth/google/callback # Production
     ```

4. **Configure OAuth Consent Screen**:
   - Go to "APIs & Services" > "OAuth consent screen"
   - Fill in application information
   - Add scopes: `email`, `profile`
   - Add test users for development

### 2. Environment Configuration

Create a `.env` file with your Google OAuth credentials:

```bash
# Copy from Google Cloud Console
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here

# Update with your domain
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
```

### 3. Tenant-Level Google OAuth Configuration

Each tenant can have Google OAuth enabled/disabled through the database:

```sql
-- Enable Google OAuth for a tenant
UPDATE tenants 
SET google_sso_enabled = true,
    google_client_id = 'tenant-specific-client-id',  -- Optional: tenant-specific OAuth app
    google_client_secret = 'tenant-specific-secret'  -- Optional: tenant-specific OAuth app
WHERE id = 'tenant-id';
```

## JWT Configuration

### Token Structure

JWT tokens contain the following payload:

```typescript
interface JwtPayload {
  userId: string;    // User's unique identifier
  tenantId: string;  // Tenant identifier for isolation
  roles: string[];   // Array of role IDs for authorization
  iat: number;       // Issued at timestamp
  exp: number;       // Expiration timestamp
}
```

### Security Considerations

1. **Secret Key**: Use a strong, randomly generated secret key
   ```bash
   # Generate a secure secret
   openssl rand -base64 64
   ```

2. **Expiration Time**: Balance security and user experience
   - Short-lived tokens (1h) for high security
   - Longer tokens (24h) for better UX
   - Consider refresh token implementation for longer sessions

3. **Algorithm**: Uses HS256 (HMAC with SHA-256) by default

### Custom JWT Configuration

```typescript
// Custom JWT module configuration
JwtModule.registerAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    secret: configService.get<string>('JWT_SECRET'),
    signOptions: {
      expiresIn: configService.get<string>('JWT_EXPIRES_IN', '1h'),
      issuer: 'your-app-name',
      audience: 'your-app-users',
    },
    verifyOptions: {
      issuer: 'your-app-name',
      audience: 'your-app-users',
    },
  }),
  inject: [ConfigService],
})
```

## Redis Configuration

### Connection Setup

Redis is used for rate limiting and OAuth state management:

```typescript
// Redis module configuration
RedisModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'single',
    url: `redis://:${configService.get('REDIS_PASSWORD')}@${configService.get('REDIS_HOST')}:${configService.get('REDIS_PORT')}/${configService.get('REDIS_DB', 0)}`,
    options: {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    },
  }),
  inject: [ConfigService],
})
```

### Redis Key Patterns

The authentication module uses the following Redis key patterns:

```
# Rate limiting keys
google_oauth_ip_rate_limit:initiate:ip:192.168.1.1
google_oauth_tenant_rate_limit:auth:tenant:tenant-123
google_oauth_user_rate_limit:linking:user:user-456

# OAuth state keys
oauth_state:abc123def456ghi789  # TTL: 10 minutes
oauth_state:user123_abc456def   # TTL: 10 minutes (for linking)

# Audit correlation keys
audit_correlation:req_1234567890_abcdef  # TTL: 1 hour
```

## Rate Limiting Configuration

### Configuration Hierarchy

Rate limits are applied in the following order (most restrictive wins):

1. **IP-based limits**: Prevent abuse from specific IP addresses
2. **Tenant-based limits**: Prevent tenant-level abuse
3. **User-based limits**: Prevent user-level abuse (for authenticated operations)

### Operation Types

Different rate limits apply to different operation types:

- `oauth_initiate`: Starting OAuth flow
- `oauth_callback`: Completing OAuth flow
- `link_initiate`: Starting account linking
- `link_callback`: Completing account linking
- `unlink`: Unlinking accounts
- `admin_settings`: Admin configuration changes
- `general`: All other operations

### Custom Rate Limit Configuration

```typescript
// Custom rate limiting service configuration
@Injectable()
export class CustomRateLimitConfig {
  getIpRateLimitConfig(operationType: string): GoogleOAuthRateLimitConfig {
    const configs = {
      oauth_initiate: {
        windowMs: 60000,      // 1 minute
        maxRequests: 10,      // 10 requests
        keyPrefix: 'custom_oauth_ip_initiate',
      },
      // ... other configurations
    };
    
    return configs[operationType] || configs.general;
  }
}
```

## Security Configuration

### Password Security

```typescript
// Bcrypt configuration
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

// Password hashing
const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

// Password verification
const isValid = await bcrypt.compare(password, hashedPassword);
```

### CSRF Protection

OAuth state parameters provide CSRF protection:

```typescript
// State generation
const state = crypto.randomBytes(32).toString('hex');

// State validation
const isValidState = await this.oauthStateService.validateState(state);
```

### Tenant Isolation

Tenant isolation is enforced at multiple levels:

```typescript
// JWT payload includes tenant ID
const payload: JwtPayload = {
  userId: user.id,
  tenantId: user.tenantId,  // Enforces tenant isolation
  roles: user.roles.map(r => r.id),
};

// Database queries are tenant-scoped
const user = await this.prisma.user.findUnique({
  where: {
    email_tenantId: {  // Composite key ensures tenant isolation
      email,
      tenantId,
    },
  },
});
```

## Development Configuration

### Local Development Setup

1. **Environment File**:
   ```bash
   # .env.development
   JWT_SECRET=dev-secret-key-not-for-production
   JWT_EXPIRES_IN=24h
   
   GOOGLE_CLIENT_ID=your-dev-client-id
   GOOGLE_CLIENT_SECRET=your-dev-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   ```

2. **Docker Compose for Redis**:
   ```yaml
   version: '3.8'
   services:
     redis:
       image: redis:7-alpine
       ports:
         - "6379:6379"
       command: redis-server --requirepass yourpassword
   ```

3. **Development OAuth App**:
   - Create a separate Google OAuth app for development
   - Use `http://localhost:3000` as authorized origin
   - Use `http://localhost:3000/auth/google/callback` as redirect URI

### Testing Configuration

```bash
# .env.test
JWT_SECRET=test-secret-key
JWT_EXPIRES_IN=1h

# Use test Google OAuth credentials or mock the service
GOOGLE_CLIENT_ID=test-client-id
GOOGLE_CLIENT_SECRET=test-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Use separate Redis database for tests
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1
```

## Production Configuration

### Security Checklist

1. **JWT Secret**: Use a strong, randomly generated secret
2. **HTTPS Only**: Ensure all OAuth redirects use HTTPS
3. **Environment Variables**: Never commit secrets to version control
4. **Rate Limiting**: Configure appropriate rate limits for your traffic
5. **Redis Security**: Use password authentication and network isolation
6. **Monitoring**: Set up alerts for authentication failures and rate limit hits

### Production Environment Variables

```bash
# Strong JWT secret (64+ characters)
JWT_SECRET=your-production-jwt-secret-key-here

# Shorter token expiration for security
JWT_EXPIRES_IN=1h

# Production Google OAuth credentials
GOOGLE_CLIENT_ID=your-prod-client-id
GOOGLE_CLIENT_SECRET=your-prod-client-secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback

# Secured Redis instance
REDIS_HOST=your-redis-host
REDIS_PORT=6380
REDIS_PASSWORD=your-strong-redis-password

# Production rate limits (more restrictive)
GOOGLE_OAUTH_IP_INITIATE_MAX_REQUESTS=5
GOOGLE_OAUTH_IP_CALLBACK_MAX_REQUESTS=10
```

### Health Checks

Configure health checks for production monitoring:

```typescript
@Controller('health')
export class AuthHealthController {
  @Get('auth')
  async checkAuthHealth() {
    return {
      database: await this.checkDatabaseConnection(),
      redis: await this.checkRedisConnection(),
      googleOAuth: await this.checkGoogleOAuthConfig(),
      jwtValidation: await this.checkJwtValidation(),
    };
  }
}
```

## Troubleshooting Configuration Issues

### Common Issues

1. **JWT Token Invalid**:
   - Check JWT_SECRET matches between services
   - Verify token expiration time
   - Ensure system clocks are synchronized

2. **Google OAuth Errors**:
   - Verify client ID and secret
   - Check redirect URI matches exactly
   - Ensure OAuth consent screen is configured

3. **Rate Limiting Issues**:
   - Check Redis connectivity
   - Verify rate limit configuration values
   - Monitor rate limit metrics

4. **Tenant Isolation Problems**:
   - Verify tenant ID is properly set in requests
   - Check database tenant filtering
   - Ensure JWT tokens include correct tenant ID

### Configuration Validation

```typescript
@Injectable()
export class AuthConfigValidator {
  validateConfiguration() {
    const errors = [];
    
    if (!process.env.JWT_SECRET) {
      errors.push('JWT_SECRET is required');
    }
    
    if (!process.env.GOOGLE_CLIENT_ID) {
      errors.push('GOOGLE_CLIENT_ID is required');
    }
    
    if (!process.env.REDIS_HOST) {
      errors.push('REDIS_HOST is required');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }
  }
}
```

This configuration guide ensures proper setup of the authentication module with appropriate security measures and scalability considerations.