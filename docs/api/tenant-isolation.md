# Tenant Isolation

This document provides comprehensive information about multi-tenant architecture, data isolation, and security measures implemented in the Multi-Tenant NestJS API.

## Overview

The API implements a comprehensive multi-tenant architecture that ensures complete data isolation between tenants while maintaining high performance and security. Each tenant operates in a logically isolated environment with their own data, users, and configurations.

## Tenant Isolation Strategy

### Database-Level Isolation

#### Row-Level Security (RLS)
Every database table includes a `tenantId` column that automatically filters data:

```sql
-- Example table structure
CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  -- other fields
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Automatic filtering by tenant
SELECT * FROM users WHERE tenant_id = $1;
```

#### Prisma Middleware
Automatic tenant filtering is enforced at the ORM level:

```typescript
// Prisma middleware automatically adds tenant filtering
prisma.$use(async (params, next) => {
  if (params.model && tenantAwareModels.includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = {
        ...params.args.where,
        tenantId: getCurrentTenantId()
      };
    }
  }
  return next(params);
});
```

### Application-Level Isolation

#### Tenant Context Service
Manages tenant context throughout the request lifecycle:

```typescript
@Injectable()
export class TenantContextService {
  private tenantId: string | null = null;
  
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }
  
  getTenantId(): string {
    if (!this.tenantId) {
      throw new Error('Tenant context not set');
    }
    return this.tenantId;
  }
}
```

#### Tenant Identification Middleware
Extracts and validates tenant information from requests:

```typescript
@Injectable()
export class TenantIdentificationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }
    
    // Validate tenant exists and is active
    this.validateTenant(tenantId);
    
    // Set tenant context
    this.tenantContextService.setTenantId(tenantId);
    
    next();
  }
}
```

## Tenant Identification Methods

### Header-Based Identification
Primary method using HTTP headers:

```http
x-tenant-id: tenant_123
```

**Advantages:**
- Simple implementation
- Works with any client
- Easy to debug

**Usage:**
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <token>" \
  -H "x-tenant-id: tenant_123"
```

### Subdomain-Based Identification (Future)
Alternative method using subdomains:

```
https://acme.api.yourcompany.com/api/users
```

**Advantages:**
- More user-friendly
- Natural tenant separation
- Better for web applications

### JWT Token-Based Identification
Tenant information embedded in JWT tokens:

```json
{
  "userId": "user_123",
  "tenantId": "tenant_123",
  "roles": ["editor"],
  "iat": 1640995200,
  "exp": 1640998800
}
```

**Advantages:**
- Secure tenant binding
- Prevents tenant switching
- Integrated with authentication

## Data Isolation Patterns

### Complete Isolation
All data is completely separated by tenant:

```typescript
// Users are completely isolated by tenant
async findAllUsers(): Promise<User[]> {
  return this.prisma.user.findMany({
    where: {
      tenantId: this.tenantContext.getTenantId()
    }
  });
}
```

### Shared Reference Data
Some data may be shared across tenants (e.g., system permissions):

```typescript
// System permissions are shared, but tenant-specific permissions are isolated
async findPermissions(): Promise<Permission[]> {
  return this.prisma.permission.findMany({
    where: {
      OR: [
        { tenantId: this.tenantContext.getTenantId() },
        { tenantId: null } // System-wide permissions
      ]
    }
  });
}
```

### Hierarchical Isolation
Some tenants may have sub-tenants or departments:

```typescript
// Support for hierarchical tenant structure
async findHierarchicalData(): Promise<Data[]> {
  const tenantHierarchy = await this.getTenantHierarchy();
  
  return this.prisma.data.findMany({
    where: {
      tenantId: {
        in: tenantHierarchy
      }
    }
  });
}
```

## Security Measures

### Authentication Integration
Tenant isolation is integrated with authentication:

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.userService.findById(payload.userId);
    
    // Verify user belongs to the tenant in context
    if (user.tenantId !== this.tenantContext.getTenantId()) {
      throw new UnauthorizedException('User does not belong to current tenant');
    }
    
    return user;
  }
}
```

### Authorization Guards
Tenant-specific authorization guards:

```typescript
@Injectable()
export class TenantIsolationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = this.tenantContext.getTenantId();
    
    // Ensure user belongs to the current tenant
    return user.tenantId === tenantId;
  }
}
```

### Resource Ownership Validation
Additional validation for resource ownership:

```typescript
@Injectable()
export class NotificationOwnershipGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const notificationId = request.params.id;
    const user = request.user;
    
    const notification = await this.notificationService.findById(notificationId);
    
    // Verify notification belongs to user and tenant
    return notification.userId === user.id && 
           notification.tenantId === user.tenantId;
  }
}
```

## API Endpoint Isolation

### Automatic Tenant Filtering
All API endpoints automatically filter by tenant:

```typescript
@Controller('users')
export class UserController {
  @Get()
  async findAll(): Promise<User[]> {
    // Automatically filtered by tenant through middleware
    return this.userService.findAll();
  }
  
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User> {
    // Automatically ensures user belongs to current tenant
    return this.userService.findOne(id);
  }
}
```

### Cross-Tenant Prevention
Prevents accidental cross-tenant data access:

```typescript
async findUser(id: string): Promise<User> {
  const user = await this.prisma.user.findFirst({
    where: {
      id,
      tenantId: this.tenantContext.getTenantId()
    }
  });
  
  if (!user) {
    throw new NotFoundException('User not found');
  }
  
  return user;
}
```

## Tenant Configuration Isolation

### Tenant-Specific Settings
Each tenant has isolated configuration:

```typescript
interface TenantSettings {
  googleSso: {
    enabled: boolean;
    clientId?: string;
    domain?: string;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    defaultChannels: string[];
  };
  security: {
    passwordPolicy: PasswordPolicy;
    sessionTimeout: number;
    maxLoginAttempts: number;
  };
  features: {
    projects: boolean;
    notifications: boolean;
    analytics: boolean;
  };
}
```

### Feature Flag Isolation
Features can be enabled/disabled per tenant:

```typescript
@Injectable()
export class FeatureGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const tenantId = this.tenantContext.getTenantId();
    const requiredFeature = this.reflector.get<string>('feature', context.getHandler());
    
    const tenant = await this.tenantService.findById(tenantId);
    return tenant.settings.features[requiredFeature] === true;
  }
}

// Usage
@UseGuards(FeatureGuard)
@RequireFeature('analytics')
@Get('analytics')
getAnalytics() {
  // Only available if analytics feature is enabled for tenant
}
```

## Performance Considerations

### Database Indexing
Proper indexing for tenant-aware queries:

```sql
-- Composite indexes for tenant + other fields
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX idx_projects_tenant_created ON projects(tenant_id, created_at);
CREATE INDEX idx_notifications_tenant_user ON notifications(tenant_id, user_id);
```

### Query Optimization
Optimized queries that always include tenant filtering:

```typescript
// Efficient tenant-aware queries
async findUserProjects(userId: string): Promise<Project[]> {
  return this.prisma.project.findMany({
    where: {
      tenantId: this.tenantContext.getTenantId(), // Always first for index usage
      ownerId: userId
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}
```

### Connection Pooling
Tenant-aware connection pooling strategies:

```typescript
// Connection pool configuration
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Connection pooling optimized for multi-tenant usage
  __internal: {
    engine: {
      connectionLimit: 100,
      poolTimeout: 10000
    }
  }
});
```

## Monitoring and Auditing

### Tenant Activity Logging
Comprehensive logging of tenant activities:

```typescript
@Injectable()
export class TenantAuditService {
  async logActivity(action: string, resource: string, details?: any): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        userId: this.getCurrentUserId(),
        action,
        resource,
        details: JSON.stringify(details),
        timestamp: new Date(),
        ipAddress: this.getClientIp()
      }
    });
  }
}
```

### Cross-Tenant Access Detection
Monitoring for potential cross-tenant access attempts:

```typescript
@Injectable()
export class SecurityMonitoringService {
  async detectCrossTenantAccess(userId: string, requestedTenantId: string): Promise<void> {
    const user = await this.userService.findById(userId);
    
    if (user.tenantId !== requestedTenantId) {
      // Log security incident
      await this.logSecurityIncident({
        type: 'CROSS_TENANT_ACCESS_ATTEMPT',
        userId,
        userTenantId: user.tenantId,
        requestedTenantId,
        timestamp: new Date()
      });
      
      // Alert security team
      await this.alertSecurityTeam('Cross-tenant access attempt detected');
    }
  }
}
```

## Testing Tenant Isolation

### Unit Tests
Testing tenant isolation in services:

```typescript
describe('UserService Tenant Isolation', () => {
  it('should only return users from current tenant', async () => {
    // Setup users in different tenants
    await createUser({ tenantId: 'tenant1', email: 'user1@tenant1.com' });
    await createUser({ tenantId: 'tenant2', email: 'user2@tenant2.com' });
    
    // Set tenant context
    tenantContext.setTenantId('tenant1');
    
    const users = await userService.findAll();
    
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe('user1@tenant1.com');
  });
});
```

### Integration Tests
Testing tenant isolation across API endpoints:

```typescript
describe('API Tenant Isolation', () => {
  it('should prevent cross-tenant data access', async () => {
    const tenant1User = await createUserWithTenant('tenant1');
    const tenant2User = await createUserWithTenant('tenant2');
    
    // Try to access tenant2 user from tenant1 context
    const response = await request(app)
      .get(`/api/users/${tenant2User.id}`)
      .set('Authorization', `Bearer ${tenant1User.token}`)
      .set('x-tenant-id', 'tenant1')
      .expect(404);
    
    expect(response.body.message).toBe('User not found');
  });
});
```

### End-to-End Tests
Complete tenant isolation testing:

```typescript
describe('Tenant Isolation E2E', () => {
  it('should maintain complete data isolation between tenants', async () => {
    // Create data for multiple tenants
    const tenant1Data = await setupTenantData('tenant1');
    const tenant2Data = await setupTenantData('tenant2');
    
    // Verify tenant1 can only access their data
    await verifyTenantDataAccess('tenant1', tenant1Data);
    await verifyTenantDataIsolation('tenant1', tenant2Data);
    
    // Verify tenant2 can only access their data
    await verifyTenantDataAccess('tenant2', tenant2Data);
    await verifyTenantDataIsolation('tenant2', tenant1Data);
  });
});
```

## Error Handling

### Tenant-Related Errors

#### Missing Tenant ID
```json
{
  "statusCode": 400,
  "message": "Tenant ID is required",
  "error": "Bad Request",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
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

#### Cross-Tenant Access Attempt
```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users/user_from_other_tenant"
}
```

## Best Practices

### Development Best Practices

1. **Always Include Tenant Context**: Every database query should include tenant filtering
2. **Validate Tenant Access**: Always verify user belongs to requested tenant
3. **Use Middleware**: Implement tenant identification at the middleware level
4. **Test Isolation**: Comprehensive testing of tenant isolation
5. **Monitor Cross-Tenant Access**: Log and alert on isolation violations

### Security Best Practices

1. **Defense in Depth**: Multiple layers of tenant isolation
2. **Principle of Least Privilege**: Users can only access their tenant's data
3. **Regular Audits**: Regular security audits of tenant isolation
4. **Incident Response**: Clear procedures for isolation violations
5. **Data Encryption**: Encrypt sensitive data at rest and in transit

### Performance Best Practices

1. **Efficient Indexing**: Proper database indexes for tenant queries
2. **Query Optimization**: Always filter by tenant first
3. **Connection Management**: Efficient database connection pooling
4. **Caching Strategy**: Tenant-aware caching mechanisms
5. **Resource Limits**: Per-tenant resource limits and quotas

## Troubleshooting

### Common Issues

#### Data Leakage Between Tenants
- **Symptoms**: Users seeing data from other tenants
- **Causes**: Missing tenant filtering, incorrect middleware configuration
- **Solutions**: Review query filters, check middleware implementation

#### Performance Issues
- **Symptoms**: Slow queries, high database load
- **Causes**: Missing indexes, inefficient tenant filtering
- **Solutions**: Add proper indexes, optimize query patterns

#### Authentication Failures
- **Symptoms**: Users unable to access their data
- **Causes**: Tenant context not set, JWT token issues
- **Solutions**: Verify middleware chain, check token validation

### Debugging Tools

#### Tenant Context Debugging
```typescript
// Debug tenant context
console.log('Current tenant:', this.tenantContext.getTenantId());
console.log('User tenant:', user.tenantId);
console.log('Request tenant:', req.headers['x-tenant-id']);
```

#### Query Debugging
```typescript
// Debug database queries
const query = this.prisma.user.findMany({
  where: {
    tenantId: this.tenantContext.getTenantId()
  }
});

console.log('Generated SQL:', query.toString());
```

## Future Enhancements

### Planned Features

1. **Hierarchical Tenants**: Support for tenant hierarchies and sub-tenants
2. **Tenant Migration**: Tools for moving data between tenants
3. **Cross-Tenant Sharing**: Controlled data sharing between tenants
4. **Tenant Analytics**: Detailed analytics per tenant
5. **Dynamic Tenant Creation**: API endpoints for tenant provisioning

### Advanced Isolation Features

1. **Database-Per-Tenant**: Option for complete database isolation
2. **Geographic Isolation**: Tenant data in specific geographic regions
3. **Compliance Isolation**: Different compliance requirements per tenant
4. **Resource Quotas**: Detailed resource limits and monitoring per tenant