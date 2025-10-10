# User Module Troubleshooting

## Common Issues and Solutions

### Authentication Issues

#### Issue: "Unauthorized" (401) responses
**Symptoms:**
- All user API calls return 401 status
- Error message: "Unauthorized"

**Possible Causes:**
1. Missing or invalid JWT token
2. Expired JWT token
3. Token not properly formatted

**Solutions:**
```bash
# Check if token is properly formatted
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "x-tenant-id: YOUR_TENANT_ID"

# Verify token expiration
# Decode JWT token at https://jwt.io or use:
node -e "console.log(JSON.parse(Buffer.from('PAYLOAD_PART'.split('.')[1], 'base64')))"
```

**Prevention:**
- Implement token refresh mechanism
- Check token expiration before API calls
- Store tokens securely

---

#### Issue: "Forbidden" (403) responses
**Symptoms:**
- API calls return 403 status
- Error message: "Forbidden - Missing permission"

**Possible Causes:**
1. User lacks required permissions
2. Permission guard not properly configured
3. Role assignments missing

**Solutions:**
```typescript
// Check user's effective permissions
const permissions = await userService.getEffectivePermissions(userId);
console.log('User permissions:', permissions.effectivePermissions);

// Verify required permissions for endpoint
// GET /users requires 'read:user'
// POST /users requires 'create:user'
// PUT /users/:id requires 'update:user'
// DELETE /users/:id requires 'delete:user'
```

**Debug Steps:**
1. Verify user has required role assignments
2. Check if roles have necessary permissions
3. Confirm permission guard is applied to endpoint

---

### Tenant Isolation Issues

#### Issue: Users not visible or "User not found" errors
**Symptoms:**
- Users exist in database but not returned by API
- 404 errors for users that should exist
- Empty user lists

**Possible Causes:**
1. Missing or incorrect tenant ID header
2. User belongs to different tenant
3. Tenant context not properly set

**Solutions:**
```bash
# Verify tenant ID header is included
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-id: CORRECT_TENANT_ID"

# Check user's tenant association in database
SELECT id, email, tenant_id FROM users WHERE email = 'user@example.com';
```

**Debug Steps:**
1. Verify tenant ID in JWT token matches header
2. Check TenantContextService is properly injected
3. Confirm database queries include tenant filtering

---

### User Creation Issues

#### Issue: "Email already exists" (409) errors
**Symptoms:**
- Cannot create user with specific email
- 409 Conflict response
- Error message mentions email already exists

**Possible Causes:**
1. Email already used by another user in same tenant
2. Case sensitivity issues
3. Previous failed deletion

**Solutions:**
```sql
-- Check if email exists in tenant
SELECT id, email, tenant_id FROM users 
WHERE email = 'user@example.com' AND tenant_id = 'your-tenant-id';

-- Check for case variations
SELECT id, email, tenant_id FROM users 
WHERE LOWER(email) = LOWER('user@example.com') AND tenant_id = 'your-tenant-id';
```

**Prevention:**
- Implement email validation and normalization
- Use proper error handling in client applications
- Consider soft deletion for user accounts

---

#### Issue: Password validation errors
**Symptoms:**
- 400 Bad Request on user creation
- Validation error messages about password

**Possible Causes:**
1. Password doesn't meet minimum requirements
2. Password validation rules changed
3. Special characters causing issues

**Solutions:**
```typescript
// Check password requirements
export class CreateUserDto {
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
  })
  password!: string;
}
```

**Best Practices:**
- Clearly document password requirements
- Provide helpful validation error messages
- Test password validation with various inputs

---

### Role and Permission Issues

#### Issue: Role assignment failures
**Symptoms:**
- 400 Bad Request when assigning roles
- Error message about roles not found or invalid

**Possible Causes:**
1. Role IDs don't exist
2. Roles belong to different tenant
3. User doesn't exist in current tenant

**Solutions:**
```typescript
// Verify roles exist and belong to correct tenant
const roles = await prisma.role.findMany({
  where: {
    id: { in: roleIds },
    tenantId: currentTenantId
  }
});

if (roles.length !== roleIds.length) {
  throw new BadRequestException('One or more roles not found');
}
```

**Debug Steps:**
1. Check role IDs are valid UUIDs/CUIDs
2. Verify roles exist in current tenant
3. Confirm user exists and belongs to tenant

---

#### Issue: Permission calculation errors
**Symptoms:**
- Unexpected permission results
- Users have more/fewer permissions than expected
- Permission inheritance not working

**Possible Causes:**
1. Role-permission associations missing
2. Direct user permissions overriding roles
3. Permission deduplication issues

**Solutions:**
```typescript
// Debug effective permissions calculation
async debugUserPermissions(userId: string) {
  const user = await this.prisma.user.findFirst({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      },
      permissions: {
        include: { permission: true }
      }
    }
  });

  console.log('User roles:', user.roles);
  console.log('Direct permissions:', user.permissions);
  
  const rolePermissions = user.roles.flatMap(ur => 
    ur.role.permissions.map(rp => rp.permission)
  );
  console.log('Role-based permissions:', rolePermissions);
}
```

---

### Database Issues

#### Issue: Database connection errors
**Symptoms:**
- 500 Internal Server Error
- Database connection timeout
- Prisma client errors

**Possible Causes:**
1. Database server down
2. Connection string incorrect
3. Connection pool exhausted

**Solutions:**
```bash
# Test database connection
npx prisma db pull

# Check connection string
echo $DATABASE_URL

# Verify database is accessible
psql $DATABASE_URL -c "SELECT 1;"
```

**Monitoring:**
```typescript
// Add database health check
@Get('health/db')
async checkDatabase() {
  try {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy' };
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
}
```

---

#### Issue: Migration or schema issues
**Symptoms:**
- Column doesn't exist errors
- Table not found errors
- Type mismatch errors

**Possible Causes:**
1. Database schema out of sync
2. Missing migrations
3. Manual database changes

**Solutions:**
```bash
# Check migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate new Prisma client
npx prisma generate
```

---

### Performance Issues

#### Issue: Slow user queries
**Symptoms:**
- Long response times for user endpoints
- Database query timeouts
- High CPU usage

**Possible Causes:**
1. Missing database indexes
2. N+1 query problems
3. Large result sets without pagination

**Solutions:**
```sql
-- Add missing indexes
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email_tenant ON users(email, tenant_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM users WHERE tenant_id = 'tenant-123';
```

**Optimization:**
```typescript
// Use selective field inclusion
async findAll() {
  return this.prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      // Exclude password and other sensitive fields
    },
    include: {
      roles: {
        select: {
          role: {
            select: { id: true, name: true }
          }
        }
      }
    }
  });
}
```

---

## Debugging Tools and Techniques

### Logging and Monitoring

#### Enable Prisma Query Logging
```typescript
// In main.ts or app module
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

#### Add Request Logging
```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;
    
    console.log(`${method} ${url}`, {
      tenantId: headers['x-tenant-id'],
      userId: request.user?.sub,
      timestamp: new Date().toISOString()
    });

    return next.handle();
  }
}
```

### Database Debugging

#### Check User Data Integrity
```sql
-- Find users without tenant association
SELECT id, email FROM users WHERE tenant_id IS NULL;

-- Find orphaned user roles
SELECT ur.* FROM user_roles ur
LEFT JOIN users u ON ur.user_id = u.id
WHERE u.id IS NULL;

-- Check permission inheritance
SELECT 
  u.email,
  r.name as role_name,
  p.action,
  p.subject
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE u.tenant_id = 'your-tenant-id';
```

#### Verify Tenant Isolation
```sql
-- Check for cross-tenant data leaks
SELECT 
  u.tenant_id as user_tenant,
  r.tenant_id as role_tenant
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.tenant_id != r.tenant_id;
```

### API Testing

#### Test Authentication Flow
```bash
#!/bin/bash
# Test complete user management flow

# 1. Login to get token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.access_token')

# 2. Create user
USER_ID=$(curl -s -X POST http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-123" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}' \
  | jq -r '.id')

# 3. Get user
curl -X GET http://localhost:3000/users/$USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-123"

# 4. Get user permissions
curl -X GET http://localhost:3000/users/$USER_ID/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-123"
```

### Error Tracking

#### Implement Error Monitoring
```typescript
@Injectable()
export class ErrorTrackingService {
  trackUserError(error: Error, context: any) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context: {
        userId: context.userId,
        tenantId: context.tenantId,
        operation: context.operation,
        timestamp: new Date().toISOString()
      }
    };

    // Send to monitoring service (e.g., Sentry, DataDog)
    console.error('User module error:', errorData);
  }
}
```

## Prevention Strategies

### Code Quality
- Use TypeScript strict mode
- Implement comprehensive unit tests
- Add integration tests for critical flows
- Use ESLint and Prettier for code consistency

### Security
- Regular security audits
- Input validation on all endpoints
- Rate limiting implementation
- Audit logging for sensitive operations

### Monitoring
- Health checks for all dependencies
- Performance monitoring
- Error rate tracking
- Database query performance monitoring

### Documentation
- Keep API documentation up to date
- Document all configuration options
- Maintain troubleshooting guides
- Create runbooks for common operations