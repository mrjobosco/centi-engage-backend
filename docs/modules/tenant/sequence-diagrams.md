# Tenant Module Sequence Diagrams

## Overview

This document provides detailed sequence diagrams for all major tenant-related flows in the multi-tenant NestJS application.

## 1. Tenant Identification and Context Setup

### Header-Based Tenant Identification

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as TenantIdentificationMiddleware
    participant Context as TenantContextService
    participant Guard as TenantValidationGuard
    participant Service as BusinessService
    participant DB as Database

    Client->>Middleware: HTTP Request with x-tenant-id header
    Middleware->>Middleware: Extract tenant ID from header
    
    alt Tenant ID found
        Middleware->>Context: setTenantId(tenantId)
        Context->>Middleware: Context set successfully
        Middleware->>Guard: Continue to guards
        Guard->>Guard: Validate tenant exists and is active
        Guard->>Service: Proceed to business logic
        Service->>Context: getRequiredTenantId()
        Context->>Service: Return tenant ID
        Service->>DB: Execute tenant-scoped query
        DB->>Service: Return tenant-specific data
        Service->>Client: Response with tenant data
    else No tenant ID in header
        Middleware->>Client: 400 Bad Request - Tenant ID required
    end
```

### Subdomain-Based Tenant Identification

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as TenantIdentificationMiddleware
    participant Context as TenantContextService
    participant Service as BusinessService
    participant DB as Database

    Client->>Middleware: HTTP Request to tenant1.example.com
    Middleware->>Middleware: Extract hostname from request
    Middleware->>Middleware: Parse subdomain (tenant1)
    
    alt Valid subdomain format
        Middleware->>Context: setTenantId("tenant1")
        Context->>Middleware: Context set successfully
        Middleware->>Service: Continue to service
        Service->>Context: getRequiredTenantId()
        Context->>Service: Return "tenant1"
        Service->>DB: Execute query with tenant scope
        DB->>Service: Return tenant1 data
        Service->>Client: Response
    else Invalid subdomain or localhost
        Middleware->>Client: 400 Bad Request - Invalid tenant subdomain
    end
```

## 2. Tenant Registration Flow

### Complete Tenant Setup Process

```mermaid
sequenceDiagram
    participant Client
    participant Controller as TenantController
    participant Service as TenantService
    participant DB as PrismaService
    participant Audit as AuthAuditService

    Client->>Controller: POST /tenants (RegisterTenantDto)
    Controller->>Service: createTenant(input)
    
    Service->>DB: Begin Transaction
    
    Note over Service,DB: Step 1: Create Tenant
    Service->>DB: tenant.create({ name: tenantName })
    DB->>Service: Return created tenant
    
    Note over Service,DB: Step 2: Create Default Permissions
    Service->>DB: Create 15 default permissions
    DB->>Service: Return created permissions
    
    Note over Service,DB: Step 3: Create Default Roles
    Service->>DB: role.create({ name: "Admin", tenantId })
    DB->>Service: Return admin role
    Service->>DB: role.create({ name: "Member", tenantId })
    DB->>Service: Return member role
    
    Note over Service,DB: Step 4: Assign Permissions to Roles
    Service->>DB: Create rolePermission records (Admin gets all)
    DB->>Service: Role permissions created
    Service->>DB: Create rolePermission records (Member gets read-only)
    DB->>Service: Role permissions created
    
    Note over Service,DB: Step 5: Create Admin User
    Service->>DB: user.create({ email, hashedPassword, tenantId })
    DB->>Service: Return created user
    
    Note over Service,DB: Step 6: Assign Admin Role to User
    Service->>DB: userRole.create({ userId, roleId })
    DB->>Service: User role assignment created
    
    Service->>DB: Commit Transaction
    DB->>Service: Transaction committed successfully
    
    Service->>Controller: Return { tenant, adminUser }
    Controller->>Client: 201 Created with tenant data
    
    Note over Client,Controller: Error Handling
    alt Transaction fails
        Service->>DB: Rollback Transaction
        DB->>Service: Transaction rolled back
        Service->>Controller: Throw error
        Controller->>Client: 500 Internal Server Error
    end
    
    alt Duplicate tenant name
        Service->>Controller: Throw ConflictException
        Controller->>Client: 409 Conflict - Tenant name exists
    end
```

## 3. Database Middleware Tenant Scoping

### Query Transformation Process

```mermaid
sequenceDiagram
    participant Service as BusinessService
    participant Context as TenantContextService
    participant Middleware as TenantScopingMiddleware
    participant Prisma as PrismaClient
    participant DB as PostgreSQL

    Service->>Prisma: user.findMany({ where: { active: true } })
    Prisma->>Middleware: Intercept query with middleware
    
    Middleware->>Context: getTenantId()
    Context->>Middleware: Return current tenant ID
    
    alt Tenant-scoped model
        Middleware->>Middleware: Add tenantId to WHERE clause
        Note over Middleware: Transform query:<br/>{ active: true, tenantId: "tenant-123" }
        Middleware->>Prisma: Continue with modified query
    else Non-tenant-scoped model (e.g., Tenant)
        Middleware->>Prisma: Continue with original query
    end
    
    Prisma->>DB: Execute SQL query
    DB->>Prisma: Return query results
    Prisma->>Service: Return tenant-scoped results
```

### Create Operation with Tenant Injection

```mermaid
sequenceDiagram
    participant Service as BusinessService
    participant Context as TenantContextService
    participant Middleware as TenantScopingMiddleware
    participant Prisma as PrismaClient
    participant DB as PostgreSQL

    Service->>Prisma: user.create({ data: { email, name } })
    Prisma->>Middleware: Intercept create operation
    
    Middleware->>Context: getTenantId()
    Context->>Middleware: Return "tenant-123"
    
    Middleware->>Middleware: Inject tenantId into data
    Note over Middleware: Transform data:<br/>{ email, name, tenantId: "tenant-123" }
    
    Middleware->>Prisma: Continue with modified data
    Prisma->>DB: INSERT with tenant ID
    DB->>Prisma: Return created record
    Prisma->>Service: Return user with tenantId
```

## 4. Google SSO Configuration Flow

### Get Google Settings

```mermaid
sequenceDiagram
    participant Client
    participant Controller as TenantController
    participant Guard as AdminRoleGuard
    participant Service as TenantService
    participant DB as PrismaService

    Client->>Controller: GET /tenants/:id/settings/google
    Controller->>Guard: Check admin role
    
    alt User has admin role
        Guard->>Service: Proceed to service
        Service->>DB: tenant.findUnique({ where: { id } })
        DB->>Service: Return tenant with Google settings
        Service->>Controller: Return { googleSsoEnabled, googleAutoProvision }
        Controller->>Client: 200 OK with settings
    else User lacks admin role
        Guard->>Client: 403 Forbidden - Admin role required
    end
```

### Update Google Settings with Audit Logging

```mermaid
sequenceDiagram
    participant Client
    participant Controller as TenantController
    participant Guard as AdminRoleGuard
    participant Service as TenantService
    participant DB as PrismaService
    participant Audit as AuthAuditService

    Client->>Controller: PATCH /tenants/:id/settings/google
    Controller->>Guard: Check admin role
    Guard->>Service: Proceed to service
    
    Service->>DB: findById(tenantId) - Get current settings
    DB->>Service: Return current tenant settings
    
    Service->>DB: tenant.update({ where: { id }, data: updateDto })
    
    alt Update successful
        DB->>Service: Return updated tenant
        Service->>Audit: logGoogleSettingsUpdate(userId, tenantId, true, ...)
        Audit->>DB: Create audit log entry
        DB->>Audit: Audit log created
        Service->>Controller: Return updated settings
        Controller->>Client: 200 OK with updated settings
    else Update failed
        DB->>Service: Throw error
        Service->>Audit: logGoogleSettingsUpdate(userId, tenantId, false, error)
        Audit->>DB: Create failure audit log
        Service->>Controller: Throw error
        Controller->>Client: 500 Internal Server Error
    end
```

## 5. Authentication with Tenant Context

### JWT Authentication with Tenant Validation

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as TenantIdentificationMiddleware
    participant Context as TenantContextService
    participant AuthGuard as JwtAuthGuard
    participant Strategy as JwtStrategy
    participant DB as PrismaService
    participant Service as BusinessService

    Client->>Middleware: Request with x-tenant-id + Authorization header
    Middleware->>Context: setTenantId(tenantId)
    Context->>Middleware: Tenant context set
    
    Middleware->>AuthGuard: Continue to authentication
    AuthGuard->>Strategy: Validate JWT token
    Strategy->>Strategy: Decode JWT payload
    
    Note over Strategy: JWT contains: { sub, email, tenantId, roles }
    
    Strategy->>DB: user.findUnique({ id: sub, tenantId })
    
    alt User exists and belongs to tenant
        DB->>Strategy: Return user data
        Strategy->>Context: Verify tenant context matches JWT
        
        alt Tenant context matches JWT
            Context->>Strategy: Tenant validation passed
            Strategy->>AuthGuard: Return authenticated user
            AuthGuard->>Service: Proceed with authenticated request
            Service->>Client: Return response
        else Tenant mismatch
            Strategy->>Client: 401 Unauthorized - Tenant mismatch
        end
    else User not found or wrong tenant
        DB->>Strategy: Return null
        Strategy->>Client: 401 Unauthorized - Invalid user/tenant
    end
```

## 6. Cross-Tenant Access Prevention

### Resource Ownership Validation

```mermaid
sequenceDiagram
    participant Client
    participant Controller as ResourceController
    participant Guard as ResourceOwnershipGuard
    participant Context as TenantContextService
    participant DB as PrismaService
    participant Service as ResourceService

    Client->>Controller: GET /projects/:id
    Controller->>Guard: Validate resource ownership
    
    Guard->>Context: getRequiredTenantId()
    Context->>Guard: Return current tenant ID
    
    Guard->>DB: project.findUnique({ where: { id }, select: { tenantId } })
    
    alt Resource exists
        DB->>Guard: Return { tenantId: "resource-tenant-id" }
        
        alt Resource belongs to current tenant
            Guard->>Guard: currentTenantId === resourceTenantId
            Guard->>Service: Proceed to service
            Service->>DB: Get full project data (auto-scoped)
            DB->>Service: Return project data
            Service->>Client: 200 OK with project
        else Resource belongs to different tenant
            Guard->>Client: 403 Forbidden - Cross-tenant access denied
        end
    else Resource not found
        DB->>Guard: Return null
        Guard->>Client: 404 Not Found
    end
```

## 7. Tenant Data Isolation Verification

### Isolation Testing Flow

```mermaid
sequenceDiagram
    participant Test as TestSuite
    participant Context as TenantContextService
    participant DB as PrismaService

    Note over Test: Setup Phase
    Test->>DB: Create tenant1 and tenant2
    DB->>Test: Return created tenants
    Test->>DB: Create user1 in tenant1
    Test->>DB: Create user2 in tenant2
    DB->>Test: Users created

    Note over Test: Test Tenant 1 Isolation
    Test->>Context: setTenantId(tenant1.id)
    Context->>Test: Tenant context set
    Test->>DB: user.findMany() - Should only return tenant1 users
    DB->>Test: Return [user1] (tenant1 users only)
    Test->>Test: Assert users.length === 1
    Test->>Test: Assert users[0].tenantId === tenant1.id

    Note over Test: Test Tenant 2 Isolation
    Test->>Context: setTenantId(tenant2.id)
    Context->>Test: Tenant context set
    Test->>DB: user.findMany() - Should only return tenant2 users
    DB->>Test: Return [user2] (tenant2 users only)
    Test->>Test: Assert users.length === 1
    Test->>Test: Assert users[0].tenantId === tenant2.id

    Note over Test: Test Cross-Tenant Access Prevention
    Test->>Context: setTenantId(tenant1.id)
    Test->>DB: user.findUnique({ where: { id: user2.id } })
    DB->>Test: Return null (user2 not accessible from tenant1)
    Test->>Test: Assert user === null
```

## 8. Error Handling and Recovery

### Tenant Context Error Flow

```mermaid
sequenceDiagram
    participant Client
    participant Middleware as TenantIdentificationMiddleware
    participant Filter as TenantContextExceptionFilter
    participant Monitor as SecurityMonitor

    Client->>Middleware: Request without tenant identification
    Middleware->>Middleware: No tenant ID found in header/subdomain
    Middleware->>Filter: Throw TenantContextError
    
    Filter->>Monitor: Log security event
    Monitor->>Monitor: Record potential security issue
    
    Filter->>Client: 400 Bad Request with detailed error
    
    Note over Client,Filter: Error Response:
    Note over Client,Filter: {
    Note over Client,Filter:   "statusCode": 400,
    Note over Client,Filter:   "message": "Tenant identification required",
    Note over Client,Filter:   "details": {
    Note over Client,Filter:     "requiredHeaders": ["x-tenant-id"],
    Note over Client,Filter:     "supportedMethods": ["header", "subdomain"]
    Note over Client,Filter:   }
    Note over Client,Filter: }
```

### Database Transaction Rollback

```mermaid
sequenceDiagram
    participant Service as TenantService
    participant DB as PrismaService
    participant Audit as AuditService

    Service->>DB: Begin transaction for tenant creation
    Service->>DB: Create tenant
    DB->>Service: Tenant created
    Service->>DB: Create permissions
    DB->>Service: Permissions created
    Service->>DB: Create roles
    DB->>Service: Roles created
    Service->>DB: Create admin user
    
    alt User creation fails (e.g., duplicate email)
        DB->>Service: Throw constraint violation error
        Service->>DB: Rollback transaction
        DB->>Service: Transaction rolled back
        Service->>Audit: Log failed tenant creation
        Audit->>DB: Create audit log
        Service->>Service: Throw ConflictException
    else All operations succeed
        Service->>DB: Commit transaction
        DB->>Service: Transaction committed
        Service->>Audit: Log successful tenant creation
    end
```

## 9. Performance Optimization Flows

### Tenant-Aware Caching

```mermaid
sequenceDiagram
    participant Service as BusinessService
    participant Cache as TenantAwareCacheService
    participant Context as TenantContextService
    participant DB as PrismaService

    Service->>Cache: get("user-permissions", userId)
    Cache->>Context: getRequiredTenantId()
    Context->>Cache: Return tenant ID
    Cache->>Cache: Check tenant-specific cache
    
    alt Cache hit
        Cache->>Service: Return cached permissions
    else Cache miss
        Cache->>DB: Query user permissions
        DB->>Cache: Return permissions data
        Cache->>Context: getRequiredTenantId()
        Context->>Cache: Return tenant ID
        Cache->>Cache: Store in tenant-specific cache
        Cache->>Service: Return permissions
    end
```

## 10. Monitoring and Alerting

### Security Violation Detection

```mermaid
sequenceDiagram
    participant Request as IncomingRequest
    participant Monitor as TenantSecurityMonitor
    participant DB as PrismaService
    participant Alert as AlertingService

    Request->>Monitor: Suspicious cross-tenant access attempt
    Monitor->>Monitor: Analyze request pattern
    
    alt Potential violation detected
        Monitor->>DB: Log security violation
        DB->>Monitor: Violation logged
        Monitor->>Alert: Send security alert
        Alert->>Alert: Notify security team
        Alert->>Monitor: Alert sent
        Monitor->>Request: Block request / Return 403
    else Normal request
        Monitor->>Request: Allow request to proceed
    end
```

These sequence diagrams provide a comprehensive view of all tenant-related flows, helping developers understand the complex interactions between components in the multi-tenant architecture.