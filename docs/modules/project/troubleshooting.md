# Project Module Troubleshooting

## Common Issues and Solutions

### Authentication and Authorization Issues

#### Issue: "Unauthorized" (401) responses
**Symptoms:**
- All project API calls return 401 status
- Error message: "Unauthorized"

**Possible Causes:**
1. Missing or invalid JWT token
2. Expired JWT token
3. Token not properly formatted

**Solutions:**
```bash
# Check if token is properly formatted
curl -X GET http://localhost:3000/projects \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "x-tenant-id: YOUR_TENANT_ID"

# Verify token expiration
# Decode JWT token at https://jwt.io
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
// Check user's permissions
const permissions = await userService.getEffectivePermissions(userId);
console.log('User permissions:', permissions.effectivePermissions);

// Required permissions for project endpoints:
// GET /projects requires 'read:project'
// POST /projects requires 'create:project'
// PUT /projects/:id requires 'update:project'
// DELETE /projects/:id requires 'delete:project'
```

**Debug Steps:**
1. Verify user has required role assignments
2. Check if roles have necessary permissions
3. Confirm permission guard is applied to endpoint

---

### Tenant Isolation Issues

#### Issue: Projects not visible or "Project not found" errors
**Symptoms:**
- Projects exist in database but not returned by API
- 404 errors for projects that should exist
- Empty project lists

**Possible Causes:**
1. Missing or incorrect tenant ID header
2. Project belongs to different tenant
3. Tenant context not properly set

**Solutions:**
```bash
# Verify tenant ID header is included
curl -X GET http://localhost:3000/projects \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-id: CORRECT_TENANT_ID"

# Check project's tenant association in database
SELECT id, name, tenant_id, owner_id FROM projects WHERE id = 'project-id';
```

**Debug Steps:**
1. Verify tenant ID in JWT token matches header
2. Check TenantContextService is properly injected
3. Confirm database queries include tenant filtering

---

### Project Creation Issues

#### Issue: Project creation fails with validation errors
**Symptoms:**
- 400 Bad Request on project creation
- Validation error messages

**Possible Causes:**
1. Empty or missing project name
2. Invalid data types
3. Validation rules not met

**Solutions:**
```typescript
// Check validation requirements
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name!: string;  // Required, non-empty string

  @IsOptional()
  @IsString()
  description?: string;  // Optional string
}
```

**Common Validation Errors:**
- Empty project name: Ensure `name` field is not empty
- Wrong data type: Ensure all fields are strings
- Missing required fields: Include `name` in request body

---

#### Issue: Owner assignment problems
**Symptoms:**
- Projects created without proper owner
- Owner information missing from responses
- Database foreign key errors

**Possible Causes:**
1. User ID not extracted from JWT token
2. User doesn't exist in database
3. User belongs to different tenant

**Solutions:**
```typescript
// Debug user extraction from JWT
@Post()
async create(
  @Body() createProjectDto: CreateProjectDto,
  @CurrentUser() user: any,
) {
  console.log('Current user:', user); // Debug user object
  return this.projectService.create(createProjectDto, user.id);
}

// Verify user exists and belongs to tenant
const user = await prisma.user.findFirst({
  where: { id: userId, tenantId: currentTenantId }
});
```

---

### Database and Relationship Issues

#### Issue: Foreign key constraint violations
**Symptoms:**
- Database errors when creating projects
- "Foreign key constraint failed" messages
- 500 Internal Server Error

**Possible Causes:**
1. Owner ID doesn't exist in users table
2. Tenant ID doesn't exist in tenants table
3. Cross-tenant owner assignment

**Solutions:**
```sql
-- Verify user exists in correct tenant
SELECT id, email, tenant_id FROM users 
WHERE id = 'owner-id' AND tenant_id = 'tenant-id';

-- Check tenant exists
SELECT id, name FROM tenants WHERE id = 'tenant-id';

-- Verify project relationships
SELECT 
  p.id,
  p.name,
  p.tenant_id,
  p.owner_id,
  u.email as owner_email,
  u.tenant_id as owner_tenant
FROM projects p
JOIN users u ON p.owner_id = u.id
WHERE p.tenant_id != u.tenant_id; -- Should return no rows
```

**Prevention:**
- Validate user existence before project creation
- Ensure tenant context is properly set
- Use database transactions for related operations

---

#### Issue: Orphaned projects after user deletion
**Symptoms:**
- Projects exist but owner information is missing
- Database queries fail when including owner
- Broken relationships in responses

**Possible Causes:**
1. User deleted without handling project ownership
2. Cascade deletion not properly configured
3. Manual database modifications

**Solutions:**
```sql
-- Find orphaned projects
SELECT p.* FROM projects p
LEFT JOIN users u ON p.owner_id = u.id
WHERE u.id IS NULL;

-- Fix cascade deletion in schema
-- Ensure proper foreign key constraints:
FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
```

**Prevention:**
- Use proper cascade deletion in database schema
- Implement soft deletion for users if needed
- Handle ownership transfer before user deletion

---

### Performance Issues

#### Issue: Slow project queries
**Symptoms:**
- Long response times for project endpoints
- Database query timeouts
- High CPU usage

**Possible Causes:**
1. Missing database indexes
2. N+1 query problems
3. Large result sets without pagination

**Solutions:**
```sql
-- Add missing indexes
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_tenant_owner ON projects(tenant_id, owner_id);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM projects WHERE tenant_id = 'tenant-123';
```

**Optimization:**
```typescript
// Efficient query with selective field loading
async findAll() {
  return this.prisma.project.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      owner: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}
```

---

### API Integration Issues

#### Issue: Inconsistent response formats
**Symptoms:**
- Different response structures across endpoints
- Missing owner information in some responses
- Inconsistent error formats

**Possible Causes:**
1. Different include/select options in queries
2. Inconsistent error handling
3. Missing response transformations

**Solutions:**
```typescript
// Standardize response format
interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

// Consistent include options
const includeOwner = {
  owner: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
};
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
export class ProjectLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params } = request;
    
    console.log(`Project API: ${method} ${url}`, {
      tenantId: request.headers['x-tenant-id'],
      userId: request.user?.sub,
      projectId: params?.id,
      body: method === 'POST' || method === 'PUT' ? body : undefined,
      timestamp: new Date().toISOString()
    });

    return next.handle();
  }
}
```

### Database Debugging

#### Check Project Data Integrity
```sql
-- Find projects without owners
SELECT p.* FROM projects p
LEFT JOIN users u ON p.owner_id = u.id
WHERE u.id IS NULL;

-- Find projects with cross-tenant owners
SELECT 
  p.id as project_id,
  p.name,
  p.tenant_id as project_tenant,
  u.tenant_id as owner_tenant
FROM projects p
JOIN users u ON p.owner_id = u.id
WHERE p.tenant_id != u.tenant_id;

-- Check project distribution by tenant
SELECT 
  tenant_id,
  COUNT(*) as project_count
FROM projects
GROUP BY tenant_id
ORDER BY project_count DESC;
```

#### Verify Tenant Isolation
```sql
-- Check for potential data leaks
SELECT 
  p.tenant_id as project_tenant,
  u.tenant_id as owner_tenant,
  COUNT(*) as count
FROM projects p
JOIN users u ON p.owner_id = u.id
GROUP BY p.tenant_id, u.tenant_id
HAVING p.tenant_id != u.tenant_id;
```

### API Testing

#### Test Complete Project Workflow
```bash
#!/bin/bash
# Test complete project management flow

# 1. Login to get token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.access_token')

# 2. Create project
PROJECT_ID=$(curl -s -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-123" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Project","description":"Test Description"}' \
  | jq -r '.id')

# 3. Get project
curl -X GET http://localhost:3000/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-123"

# 4. Update project
curl -X PUT http://localhost:3000/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-123" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Project","description":"Updated Description"}'

# 5. List all projects
curl -X GET http://localhost:3000/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-123"

# 6. Delete project
curl -X DELETE http://localhost:3000/projects/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-123"
```

### Error Tracking

#### Implement Error Monitoring
```typescript
@Injectable()
export class ProjectErrorTrackingService {
  trackProjectError(error: Error, context: any) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      context: {
        userId: context.userId,
        tenantId: context.tenantId,
        projectId: context.projectId,
        operation: context.operation,
        timestamp: new Date().toISOString()
      }
    };

    // Send to monitoring service (e.g., Sentry, DataDog)
    console.error('Project module error:', errorData);
  }
}
```

#### Custom Exception Filter
```typescript
@Catch()
export class ProjectExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = 500;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = exception.message;
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      tenantId: request.headers['x-tenant-id'],
      projectId: request.params?.id,
    };

    console.error('Project API Error:', errorResponse);

    response.status(status).json(errorResponse);
  }
}
```

## Prevention Strategies

### Code Quality
- Use TypeScript strict mode for better type safety
- Implement comprehensive unit and integration tests
- Use ESLint and Prettier for code consistency
- Regular code reviews focusing on tenant isolation

### Security
- Regular security audits of project access patterns
- Input validation on all endpoints
- Rate limiting implementation
- Audit logging for sensitive operations

### Monitoring
- Health checks for database connectivity
- Performance monitoring for query execution times
- Error rate tracking and alerting
- Database query performance monitoring

### Documentation
- Keep API documentation synchronized with code
- Document all configuration options
- Maintain troubleshooting guides
- Create runbooks for common operations

### Database Management
- Regular database maintenance and optimization
- Monitor index usage and performance
- Implement proper backup and recovery procedures
- Use database migrations for schema changes

### Testing Strategy
- Unit tests for all service methods
- Integration tests for API endpoints
- End-to-end tests for complete workflows
- Performance tests for high-load scenarios

## Common Troubleshooting Checklist

### When Projects Are Not Visible:
1. ✅ Check JWT token validity and expiration
2. ✅ Verify tenant ID header is present and correct
3. ✅ Confirm user has `read:project` permission
4. ✅ Check database for project existence and tenant association
5. ✅ Verify TenantContextService is working correctly

### When Project Creation Fails:
1. ✅ Validate request body format and required fields
2. ✅ Check user has `create:project` permission
3. ✅ Verify user exists and belongs to correct tenant
4. ✅ Check database constraints and foreign keys
5. ✅ Review validation rules in CreateProjectDto

### When Project Updates Fail:
1. ✅ Confirm project exists in current tenant
2. ✅ Check user has `update:project` permission
3. ✅ Validate update data format
4. ✅ Verify no database constraint violations
5. ✅ Check for concurrent modification issues

### When Project Deletion Fails:
1. ✅ Verify project exists in current tenant
2. ✅ Check user has `delete:project` permission
3. ✅ Look for foreign key constraints preventing deletion
4. ✅ Check for related data that needs cleanup
5. ✅ Verify cascade deletion is properly configured