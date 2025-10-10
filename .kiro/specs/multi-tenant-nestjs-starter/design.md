# Design Document

## Overview

This design document outlines the architecture for a multi-tenant NestJS application with a shared database, shared schema approach. The system uses PostgreSQL with Prisma ORM, implements JWT-based authentication, and features a hybrid RBAC system that combines role-based permissions with user-specific permission overrides.

The architecture prioritizes:
- **Tenant Isolation**: Automatic tenant scoping at the database layer to prevent data leakage
- **Flexibility**: Hybrid permission system supporting both roles and direct user permissions
- **Scalability**: Shared schema approach for efficient resource utilization
- **Security**: Multi-layered authorization with guards and middleware
- **Maintainability**: Clear separation of concerns with modular NestJS architecture

## Architecture

### High-Level Architecture

```mermaid
graph TB
    Client[Client Application]
    Gateway[API Gateway / Load Balancer]
    
    subgraph "NestJS Application"
        TenantMiddleware[Tenant Identification Middleware]
        AuthGuard[JWT Auth Guard]
        PermissionsGuard[Permissions Guard]
        
        subgraph "Modules"
            AuthModule[Auth Module]
            TenantModule[Tenant Module]
            UserModule[User Module]
            RoleModule[Role Module]
            PermissionModule[Permission Module]
            ProjectModule[Project Module]
        end
        
        subgraph "Core Services"
            TenantService[Tenant Context Service]
            PrismaService[Prisma Service]
        end
    end
    
    Database[(PostgreSQL Database)]
    
    Client --> Gateway
    Gateway --> TenantMiddleware
    TenantMiddleware --> AuthGuard
    AuthGuard --> PermissionsGuard
    PermissionsGuard --> Modules
    Modules --> TenantService
    Modules --> PrismaService
    PrismaService --> Database
```

### Technology Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x (strict mode enabled)
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 5.x
- **Authentication**: JWT (jsonwebtoken + @nestjs/jwt)
- **Validation**: class-validator + class-transformer
- **Testing**: Jest + Supertest
- **Documentation**: Swagger/OpenAPI (@nestjs/swagger)

### Project Structure

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/
│   │   ├── permissions.decorator.ts
│   │   ├── current-user.decorator.ts
│   │   └── current-tenant.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── permissions.guard.ts
│   ├── middleware/
│   │   └── tenant-identification.middleware.ts
│   ├── filters/
│   │   └── global-exception.filter.ts
│   ├── interceptors/
│   │   └── transform.interceptor.ts
│   └── interfaces/
│       ├── request-with-user.interface.ts
│       └── jwt-payload.interface.ts
├── config/
│   └── configuration.ts
├── database/
│   ├── prisma.service.ts
│   └── prisma-tenant.middleware.ts
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/
│   │   │   ├── login.dto.ts
│   │   │   └── register-tenant.dto.ts
│   │   └── strategies/
│   │       └── jwt.strategy.ts
│   ├── tenant/
│   │   ├── tenant.module.ts
│   │   ├── tenant.controller.ts
│   │   ├── tenant.service.ts
│   │   ├── tenant-context.service.ts
│   │   └── dto/
│   │       └── create-tenant.dto.ts
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       ├── update-user.dto.ts
│   │       ├── assign-roles.dto.ts
│   │       └── assign-permissions.dto.ts
│   ├── role/
│   │   ├── role.module.ts
│   │   ├── role.controller.ts
│   │   ├── role.service.ts
│   │   └── dto/
│   │       ├── create-role.dto.ts
│   │       ├── update-role.dto.ts
│   │       └── assign-permissions.dto.ts
│   ├── permission/
│   │   ├── permission.module.ts
│   │   ├── permission.controller.ts
│   │   ├── permission.service.ts
│   │   └── dto/
│   │       └── create-permission.dto.ts
│   └── project/
│       ├── project.module.ts
│       ├── project.controller.ts
│       ├── project.service.ts
│       └── dto/
│           ├── create-project.dto.ts
│           └── update-project.dto.ts
└── prisma/
    ├── schema.prisma
    ├── migrations/
    └── seed.ts
```

## Components and Interfaces

### 1. Tenant Identification System

#### Tenant Identification Middleware

**Purpose**: Extract tenant identifier from incoming requests and make it available throughout the request lifecycle.

**Implementation Strategy**:
- Implements NestJS middleware interface
- Checks for `x-tenant-id` header first
- Falls back to subdomain parsing if header not present
- Stores tenant ID in request-scoped TenantContextService
- Runs before authentication to ensure tenant context is available

```typescript
// Pseudocode
class TenantIdentificationMiddleware {
  use(req, res, next) {
    let tenantId = req.headers['x-tenant-id'];
    
    if (!tenantId) {
      tenantId = extractFromSubdomain(req.hostname);
    }
    
    if (!tenantId) {
      throw new BadRequestException('Tenant identification required');
    }
    
    tenantContextService.setTenantId(tenantId);
    next();
  }
}
```

#### Tenant Context Service

**Purpose**: Provide request-scoped access to the current tenant ID.

**Implementation Strategy**:
- Decorated with `@Injectable({ scope: Scope.REQUEST })`
- Stores tenant ID for the current request
- Injected into services that need tenant context
- Used by Prisma middleware for automatic query scoping

### 2. Database Layer

#### Prisma Service

**Purpose**: Manage database connections and apply tenant-scoping middleware.

**Implementation Strategy**:
- Extends PrismaClient
- Implements OnModuleInit to register middleware
- Configures connection pooling
- Handles graceful shutdown

#### Prisma Tenant Middleware

**Purpose**: Automatically scope all queries to the current tenant.

**Implementation Strategy**:
- Registered as Prisma middleware in PrismaService
- Intercepts all queries before execution
- Adds `tenantId` filter to WHERE clauses for tenant-scoped models
- Adds `tenantId` to data for CREATE operations
- Maintains a whitelist of non-tenant-scoped models (e.g., Tenant itself)

```typescript
// Pseudocode
prisma.$use(async (params, next) => {
  const tenantId = tenantContextService.getTenantId();
  
  if (isTenantScopedModel(params.model)) {
    if (params.action === 'create') {
      params.args.data.tenantId = tenantId;
    }
    
    if (['findMany', 'findFirst', 'findUnique', 'update', 'delete'].includes(params.action)) {
      params.args.where = {
        ...params.args.where,
        tenantId: tenantId
      };
    }
  }
  
  return next(params);
});
```

### 3. Authentication System

#### Auth Module

**Components**:
- AuthController: Handles `/auth/register` and `/auth/login` endpoints
- AuthService: Business logic for authentication
- JwtStrategy: Passport strategy for JWT validation

**Registration Flow**:
1. Receive tenant registration request (POST /auth/register)
2. Validate input (unique email, strong password)
3. Begin database transaction
4. Create Tenant record
5. Create default Permissions for tenant
6. Create default Roles for tenant
7. Hash password with bcrypt
8. Create Admin user
9. Assign Admin role to user
10. Commit transaction
11. Return tenant and user details

**Login Flow**:
1. Receive login request with email, password, and tenant identifier
2. Query user by email and tenantId
3. Verify password using bcrypt.compare
4. Load user's roles and permissions
5. Generate JWT with payload: { userId, tenantId, roles: [roleIds] }
6. Return JWT token

#### JWT Strategy

**Purpose**: Validate JWT tokens and attach user context to requests.

**Implementation Strategy**:
- Extends PassportStrategy
- Validates JWT signature
- Extracts payload (userId, tenantId, roles)
- Loads full user object from database
- Attaches user to request object
- Used by JwtAuthGuard

### 4. Authorization System

#### Permissions Guard

**Purpose**: Enforce permission-based access control on routes.

**Implementation Strategy**:
- Implements CanActivate interface
- Reads required permissions from route metadata (set by @Permissions decorator)
- Calculates user's effective permissions:
  - Load all permissions from user's assigned roles
  - Load user's direct permissions
  - Compute UNION of both sets
- Checks if all required permissions are present
- Returns true if authorized, false otherwise

```typescript
// Pseudocode
class PermissionsGuard {
  async canActivate(context) {
    const requiredPermissions = reflector.get('permissions', context.getHandler());
    const user = request.user;
    
    // Get role-based permissions
    const rolePermissions = await getRolePermissions(user.roles);
    
    // Get user-specific permissions
    const userPermissions = await getUserPermissions(user.id);
    
    // Compute effective permissions (UNION)
    const effectivePermissions = [...rolePermissions, ...userPermissions];
    
    // Check if all required permissions are present
    return requiredPermissions.every(perm => 
      effectivePermissions.some(ep => 
        ep.action === perm.action && ep.subject === perm.subject
      )
    );
  }
}
```

#### Permissions Decorator

**Purpose**: Declaratively specify required permissions for routes.

**Implementation**:
```typescript
@Permissions('create:project', 'read:user')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Post()
createProject() { }
```

### 5. Module Designs

#### User Module

**Responsibilities**:
- CRUD operations for users within a tenant
- Assigning/unassigning roles to users
- Granting/revoking user-specific permissions
- User invitation flow

**Key Methods**:
- `findAll()`: List all users in current tenant
- `findOne(id)`: Get user by ID (tenant-scoped)
- `create(dto)`: Create new user in current tenant
- `update(id, dto)`: Update user details
- `assignRoles(userId, roleIds)`: Assign roles to user
- `assignPermissions(userId, permissionIds)`: Grant direct permissions
- `getEffectivePermissions(userId)`: Calculate user's effective permissions

**Validation**:
- Ensure roles belong to same tenant as user
- Ensure permissions belong to same tenant as user
- Validate email uniqueness within tenant

#### Role Module

**Responsibilities**:
- CRUD operations for roles within a tenant
- Managing role-permission associations

**Key Methods**:
- `findAll()`: List all roles in current tenant
- `findOne(id)`: Get role by ID (tenant-scoped)
- `create(dto)`: Create new role in current tenant
- `update(id, dto)`: Update role name
- `updatePermissions(roleId, permissionIds)`: Replace role's permissions
- `delete(id)`: Delete role and remove from all users

**Validation**:
- Ensure role name is unique within tenant
- Ensure permissions belong to same tenant as role
- Prevent deletion of system roles (Admin, Member)

#### Permission Module

**Responsibilities**:
- CRUD operations for permissions within a tenant
- Defining action-subject pairs

**Key Methods**:
- `findAll()`: List all permissions in current tenant
- `findOne(id)`: Get permission by ID (tenant-scoped)
- `create(dto)`: Create new permission in current tenant
- `delete(id)`: Delete permission and remove from all roles/users

**Validation**:
- Ensure (action, subject, tenantId) is unique
- Validate action and subject format
- Check for dependent roles/users before deletion

#### Project Module (Example Resource)

**Responsibilities**:
- CRUD operations for projects within a tenant
- Demonstrates tenant-scoped resource management

**Key Methods**:
- `findAll()`: List all projects in current tenant
- `findOne(id)`: Get project by ID (tenant-scoped)
- `create(dto)`: Create new project (auto-scoped to tenant)
- `update(id, dto)`: Update project
- `delete(id)`: Delete project (tenant-scoped)

**Automatic Behaviors**:
- tenantId automatically added via Prisma middleware
- ownerId set to current user
- All queries automatically scoped to current tenant

## Data Models

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(cuid())
  name      String
  subdomain String?  @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users       User[]
  roles       Role[]
  permissions Permission[]
  projects    Project[]

  @@map("tenants")
}

model User {
  id        String   @id @default(cuid())
  email     String
  password  String
  firstName String?
  lastName  String?
  tenantId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant      Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  roles       UserRole[]
  permissions UserPermission[]
  projects    Project[]

  @@unique([email, tenantId])
  @@index([tenantId])
  @@map("users")
}

model Role {
  id        String   @id @default(cuid())
  name      String
  tenantId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant      Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  users       UserRole[]
  permissions RolePermission[]

  @@unique([name, tenantId])
  @@index([tenantId])
  @@map("roles")
}

model Permission {
  id        String   @id @default(cuid())
  action    String   // e.g., "create", "read", "update", "delete"
  subject   String   // e.g., "Project", "User", "Role"
  tenantId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant           @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  roles  RolePermission[]
  users  UserPermission[]

  @@unique([action, subject, tenantId])
  @@index([tenantId])
  @@map("permissions")
}

// Join table for User-Role many-to-many
model UserRole {
  userId String
  roleId String

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@index([userId])
  @@index([roleId])
  @@map("user_roles")
}

// Join table for Role-Permission many-to-many
model RolePermission {
  roleId       String
  permissionId String

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@index([roleId])
  @@index([permissionId])
  @@map("role_permissions")
}

// Join table for User-Permission many-to-many (direct permissions)
model UserPermission {
  userId       String
  permissionId String

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([userId, permissionId])
  @@index([userId])
  @@index([permissionId])
  @@map("user_permissions")
}

model Project {
  id        String   @id @default(cuid())
  name      String
  tenantId  String
  ownerId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  owner  User   @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([ownerId])
  @@map("projects")
}
```

### Key Design Decisions

1. **CUID for IDs**: Using CUID instead of auto-increment integers for better security and distributed system compatibility

2. **Composite Unique Constraints**: 
   - `(email, tenantId)` for users allows same email across different tenants
   - `(name, tenantId)` for roles allows same role name across tenants
   - `(action, subject, tenantId)` for permissions ensures uniqueness within tenant

3. **Cascade Deletes**: When a tenant is deleted, all related data is automatically removed

4. **Indexes**: Strategic indexes on `tenantId` and foreign keys for query performance

5. **Join Tables**: Explicit join tables for many-to-many relationships provide flexibility for future enhancements (e.g., adding timestamps or metadata)

## Error Handling

### Global Exception Filter

**Purpose**: Catch all exceptions and return standardized error responses.

**Implementation Strategy**:
- Implements ExceptionFilter interface
- Catches HttpException, PrismaClientKnownRequestError, and generic errors
- Maps Prisma errors to appropriate HTTP status codes
- Returns consistent JSON structure:
  ```json
  {
    "statusCode": 400,
    "message": "Error description",
    "error": "Bad Request",
    "timestamp": "2025-05-10T12:00:00.000Z",
    "path": "/api/users"
  }
  ```

### Error Scenarios

1. **Tenant Not Found**: 404 when tenant identifier doesn't exist
2. **Cross-Tenant Access**: 404 (not 403) to avoid information leakage
3. **Duplicate Email**: 409 Conflict when email exists in tenant
4. **Invalid Credentials**: 401 Unauthorized with generic message
5. **Missing Permissions**: 403 Forbidden with required permission details
6. **Validation Errors**: 400 Bad Request with field-level errors
7. **Database Errors**: 500 Internal Server Error with logged details

## Testing Strategy

### Unit Tests

**Scope**: Individual services and their methods in isolation.

**Approach**:
- Mock all dependencies (PrismaService, TenantContextService, etc.)
- Test business logic without database
- Focus on edge cases and error conditions

**Key Test Cases**:
- AuthService: Password hashing, JWT generation, validation logic
- PermissionsGuard: Effective permission calculation, authorization logic
- TenantService: Tenant provisioning transaction logic
- UserService: Role/permission assignment validation

### Integration Tests

**Scope**: Module interactions and database operations.

**Approach**:
- Use test database with Prisma
- Test module wiring and dependency injection
- Verify database transactions and rollbacks

**Key Test Cases**:
- Tenant provisioning creates all required records atomically
- Prisma middleware correctly scopes queries to tenant
- Role changes affect user permissions correctly
- Permission deletion cascades to roles and users

### E2E Tests

**Scope**: Complete API workflows through HTTP requests.

**Approach**:
- Use Supertest to make HTTP requests
- Test complete user journeys
- Verify tenant isolation rigorously

**Critical Test Cases**:
1. **Tenant Isolation**:
   - Create two tenants with users
   - Verify Tenant A's user cannot access Tenant B's data
   - Verify Tenant A's JWT doesn't work for Tenant B's resources

2. **Permission System**:
   - User with role-based permission can access protected route
   - User with direct permission can access protected route
   - User without permission gets 403
   - Permission removal immediately revokes access

3. **Complete Workflows**:
   - Register tenant → Login → Create project → Access project
   - Admin creates user → Assigns role → User logs in → Accesses resources
   - Admin creates custom permission → Assigns to role → User inherits permission

### Test Database Strategy

- Use separate PostgreSQL database for tests
- Reset database before each test suite
- Use Prisma migrations to set up schema
- Optionally use in-memory SQLite for faster unit tests (with limitations)

## Security Considerations

### Authentication Security

1. **Password Storage**: Bcrypt with salt rounds of 10-12
2. **JWT Security**: 
   - Short expiration (15 minutes for access tokens)
   - Secure secret key from environment
   - Consider refresh token strategy for production
3. **Rate Limiting**: Implement on login endpoint to prevent brute force

### Authorization Security

1. **Tenant Isolation**: Multiple layers of defense:
   - Middleware sets tenant context
   - Prisma middleware enforces at database level
   - Service methods validate tenant ownership
2. **Permission Checks**: Always check permissions before operations
3. **Resource Ownership**: Verify user has access to specific resource instances

### Data Security

1. **SQL Injection**: Prevented by Prisma's parameterized queries
2. **Input Validation**: class-validator on all DTOs
3. **Output Sanitization**: Remove sensitive fields (password) from responses
4. **CORS**: Configure appropriately for production

### Operational Security

1. **Environment Variables**: Never commit secrets to repository
2. **Logging**: Log security events (failed logins, permission denials)
3. **Error Messages**: Don't leak sensitive information in error responses
4. **Database Credentials**: Use connection pooling and secure credentials

## Configuration Management

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/multitenant_db"

# JWT
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRATION="15m"

# Application
PORT=3000
NODE_ENV="development"

# Tenant Identification
TENANT_HEADER_NAME="x-tenant-id"
ENABLE_SUBDOMAIN_ROUTING=true
```

### Configuration Module

**Implementation**:
- Use @nestjs/config
- Load and validate environment variables at startup
- Provide type-safe configuration service
- Support .env files for local development

## Performance Considerations

### Database Optimization

1. **Indexes**: Strategic indexes on tenantId and foreign keys
2. **Connection Pooling**: Configure Prisma connection pool size
3. **Query Optimization**: Use Prisma's select and include judiciously
4. **Pagination**: Implement cursor-based pagination for large datasets

### Caching Strategy

1. **Permission Caching**: Cache user's effective permissions in memory (with TTL)
2. **Role Caching**: Cache role-permission mappings
3. **Tenant Caching**: Cache tenant lookup results
4. **Cache Invalidation**: Clear cache on permission/role changes

### Scalability

1. **Horizontal Scaling**: Stateless design allows multiple instances
2. **Database Scaling**: PostgreSQL read replicas for read-heavy workloads
3. **Request-Scoped Services**: Minimize memory footprint per request
4. **Async Operations**: Use async/await throughout for non-blocking I/O

## Deployment Considerations

### Production Checklist

1. Set strong JWT_SECRET
2. Configure CORS for production domains
3. Enable HTTPS only
4. Set up database backups
5. Configure logging and monitoring
6. Set up rate limiting
7. Review and harden security headers
8. Set up health check endpoints
9. Configure graceful shutdown
10. Set up CI/CD pipeline with automated tests

### Monitoring

1. **Application Metrics**: Request latency, error rates
2. **Database Metrics**: Query performance, connection pool usage
3. **Business Metrics**: Tenant count, user count, API usage per tenant
4. **Security Metrics**: Failed login attempts, permission denials

## Future Enhancements

### Potential Extensions

1. **Super Admin**: System-level admin that can manage all tenants
2. **Tenant Customization**: Allow tenants to customize branding, features
3. **Audit Logging**: Track all changes to permissions, roles, and sensitive data
4. **Advanced Permissions**: Resource-level permissions (e.g., "read:project:123")
5. **API Rate Limiting**: Per-tenant rate limits
6. **Webhooks**: Allow tenants to configure webhooks for events
7. **Multi-Factor Authentication**: Add MFA support
8. **SSO Integration**: Support SAML/OAuth for enterprise tenants
9. **Tenant Analytics**: Dashboard for tenant admins
10. **Data Export**: Allow tenants to export their data

### Migration Path

If moving from shared schema to isolated schemas per tenant:
1. Create migration script to export tenant data
2. Create new database per tenant
3. Import data into isolated databases
4. Update tenant record with database connection string
5. Modify PrismaService to use tenant-specific connections
