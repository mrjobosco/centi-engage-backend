# Database Module Documentation

## Overview

The Database module provides the core data persistence layer for the multi-tenant NestJS application. It implements tenant isolation at the database level using Prisma ORM with custom middleware to ensure data security and proper multi-tenancy support.

## Key Features

- **Tenant Isolation**: Automatic tenant-scoping for all database operations
- **Prisma Integration**: Type-safe database operations with generated client
- **Connection Management**: Automatic connection lifecycle management
- **Middleware System**: Custom tenant-scoping middleware for data isolation
- **Migration Support**: Database schema versioning and migration management
- **Seeding**: Automated database seeding for development and testing

## Architecture

### Module Structure

```
src/database/
├── database.module.ts              # Main module configuration
├── prisma.service.ts               # Prisma client service with tenant middleware
├── prisma-tenant.middleware.ts     # Tenant isolation middleware
├── index.ts                        # Module exports
└── interfaces/
    └── tenant-context.interface.ts # Tenant context interface
```

### Dependencies

- **TenantModule**: Required for tenant context resolution
- **@prisma/client**: Database client for type-safe operations
- **NestJS Common**: Core NestJS decorators and interfaces

## Core Components

### DatabaseModule

The main module that configures and exports the database services.

```typescript
@Global()
@Module({
  imports: [forwardRef(() => TenantModule)],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

**Key Features:**
- Global module available throughout the application
- Forward reference to TenantModule to avoid circular dependencies
- Exports PrismaService for use in other modules

### PrismaService

The core database service that extends PrismaClient with tenant-aware functionality.

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Optional() private readonly tenantContext?: TenantContextService) {
    super({
      log: ['error', 'warn'],
      errorFormat: 'pretty',
    });
  }
}
```

**Key Features:**
- Extends Prisma client with NestJS lifecycle hooks
- Optional tenant context injection for flexibility
- Automatic middleware registration for tenant isolation
- Connection management with proper cleanup

### Tenant Isolation Middleware

Automatic tenant-scoping middleware that ensures data isolation between tenants.

```typescript
export function createTenantScopingMiddleware(tenantContext: ITenantContext) {
  return (params: any, next: any) => {
    // Middleware logic for tenant isolation
  };
}
```

**Scoped Operations:**
- **Query Operations**: `findUnique`, `findFirst`, `findMany`, `update`, `updateMany`, `delete`, `deleteMany`, `count`, `aggregate`
- **Create Operations**: `create`, `createMany`, `upsert`
- **Non-Scoped Models**: `Tenant` (excluded from tenant scoping)

## Data Models

### Core Entities

#### Tenant
- **Purpose**: Root entity for multi-tenancy
- **Key Fields**: `id`, `name`, `subdomain`, `googleSsoEnabled`
- **Relationships**: One-to-many with all tenant-scoped entities

#### User
- **Purpose**: User accounts within tenants
- **Key Fields**: `id`, `email`, `tenantId`, `googleId`, `authMethods`
- **Relationships**: Belongs to tenant, many-to-many with roles and permissions

#### Role & Permission
- **Purpose**: Role-based access control (RBAC)
- **Key Fields**: Role (`name`, `tenantId`), Permission (`action`, `subject`, `tenantId`)
- **Relationships**: Many-to-many between roles and permissions, users and roles

#### Project
- **Purpose**: Business entities managed by users
- **Key Fields**: `id`, `name`, `description`, `tenantId`, `ownerId`
- **Relationships**: Belongs to tenant and user (owner)

### Notification System Entities

#### Notification
- **Purpose**: System notifications for users
- **Key Fields**: `id`, `type`, `title`, `message`, `channelsSent`, `readAt`
- **Features**: Privacy controls, retention policies, audit logging

#### NotificationPreference
- **Purpose**: User notification preferences per category
- **Key Fields**: `category`, `inAppEnabled`, `emailEnabled`, `smsEnabled`
- **Scope**: Per user and tenant

#### NotificationTemplate
- **Purpose**: Customizable notification templates
- **Key Fields**: `category`, `channel`, `templateBody`, `variables`
- **Scope**: Global or tenant-specific

## Entity Relationship Diagram

```mermaid
erDiagram
    Tenant ||--o{ User : "has many"
    Tenant ||--o{ Role : "has many"
    Tenant ||--o{ Permission : "has many"
    Tenant ||--o{ Project : "has many"
    Tenant ||--o{ Notification : "has many"
    
    User ||--o{ Project : "owns"
    User }o--o{ Role : "has roles"
    User }o--o{ Permission : "has permissions"
    Role }o--o{ Permission : "has permissions"
    
    User ||--o{ Notification : "receives"
    User ||--o{ NotificationPreference : "has preferences"
    
    Notification ||--o{ NotificationDeliveryLog : "has delivery logs"
    Notification ||--o{ NotificationAuditLog : "has audit logs"
    
    Tenant ||--o{ NotificationTemplate : "has templates"
    Tenant ||--|| TenantNotificationConfig : "has config"
```

## Configuration

### Database Connection

The database connection is configured through environment variables:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
```

### Prisma Configuration

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

## Migration Management

### Running Migrations

```bash
# Generate migration from schema changes
npx prisma migrate dev --name migration_name

# Apply migrations to production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

### Migration History

The application includes several key migrations:

1. **Initial Migration** (`20251005131304_init`): Core tenant, user, role, permission, and project models
2. **Project Description** (`20251005214956_add_project_description`): Added description field to projects
3. **Notification System** (`20251007114541_add_notification_system`): Complete notification system models
4. **Privacy Features** (`20251008232326_add_notification_privacy_features`): Enhanced privacy and audit features
5. **Google Authentication** (`20251009134846_add_google_authentication`): Google OAuth integration fields

## Database Seeding

### Seed Script

The seed script (`prisma/seed.ts`) creates sample data for development and testing:

```bash
# Run seed script
npx prisma db seed
```

### Seed Data Structure

**Tenants Created:**
- **Acme Corp** (`subdomain: acme`)
  - Admin user: `admin@acme.com`
  - Project Manager: `pm@acme.com`
  - Member: `member@acme.com`
  - Multi-role user: `multi@acme.com`
  - Custom permissions user: `custom@acme.com`

- **TechStart Inc** (`subdomain: techstart`)
  - Admin user: `admin@techstart.com`

**Default Password:** `password123` for all seeded users

### Roles and Permissions

**Standard Roles:**
- **Admin**: Full permissions across all subjects
- **Project Manager**: Project management + user read permissions
- **Member**: Read-only permissions

**Permission Structure:**
- **Actions**: `create`, `read`, `update`, `delete`
- **Subjects**: `project`, `user`, `role`, `permission`

## Usage Examples

### Basic Database Operations

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  // Tenant isolation is automatic
  async findUsers() {
    return this.prisma.user.findMany(); // Only returns users for current tenant
  }

  async createUser(data: CreateUserDto) {
    return this.prisma.user.create({
      data, // tenantId is automatically added by middleware
    });
  }
}
```

### Transaction Support

```typescript
async transferProjectOwnership(projectId: string, newOwnerId: string) {
  return this.prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    return tx.project.update({
      where: { id: projectId },
      data: { ownerId: newOwnerId },
    });
  });
}
```

### Raw Queries (with Tenant Awareness)

```typescript
async getProjectStats() {
  const tenantId = this.tenantContext.getTenantId();
  
  return this.prisma.$queryRaw`
    SELECT 
      COUNT(*) as total_projects,
      COUNT(DISTINCT owner_id) as unique_owners
    FROM projects 
    WHERE tenant_id = ${tenantId}
  `;
}
```

## Security Considerations

### Tenant Isolation

- **Automatic Scoping**: All queries are automatically scoped to the current tenant
- **Middleware Protection**: Prevents cross-tenant data access at the database level
- **Non-Scoped Models**: Only the `Tenant` model is excluded from tenant scoping

### Data Protection

- **Sensitive Data Handling**: Notification system includes privacy controls
- **Audit Logging**: Comprehensive audit trails for notification operations
- **Retention Policies**: Automatic data cleanup based on retention settings

### Connection Security

- **Connection Pooling**: Prisma handles connection pooling automatically
- **SSL Support**: Database connections support SSL encryption
- **Error Handling**: Sanitized error messages to prevent information leakage

## Performance Considerations

### Indexing Strategy

```sql
-- Key indexes for performance
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX idx_notifications_user_tenant ON notifications(user_id, tenant_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

### Query Optimization

- **Selective Fields**: Use `select` to limit returned fields
- **Pagination**: Implement cursor-based pagination for large datasets
- **Eager Loading**: Use `include` strategically to avoid N+1 queries

```typescript
// Optimized query example
async findProjectsWithOwner(page: number, limit: number) {
  return this.prisma.project.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    skip: page * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
  });
}
```

## Troubleshooting

### Common Issues

#### 1. Tenant Context Not Available

**Symptom**: Queries return data from all tenants or fail with tenant context errors

**Solution**:
```typescript
// Ensure tenant context is properly set
if (!this.tenantContext.getTenantId()) {
  throw new Error('Tenant context not available');
}
```

#### 2. Migration Failures

**Symptom**: Migration fails with constraint violations

**Solution**:
```bash
# Check migration status
npx prisma migrate status

# Resolve conflicts manually
npx prisma migrate resolve --applied migration_name

# Reset and re-run (development only)
npx prisma migrate reset
```

#### 3. Connection Pool Exhaustion

**Symptom**: Database connection timeouts or pool exhaustion errors

**Solution**:
```typescript
// Configure connection pool in schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection pool configuration
}
```

#### 4. Seed Script Failures

**Symptom**: Seed script fails with duplicate key errors

**Solution**:
```bash
# Reset database and re-seed
npx prisma migrate reset --force
npx prisma db seed
```

### Performance Issues

#### Slow Queries

1. **Enable Query Logging**:
```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

2. **Analyze Query Plans**:
```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE tenant_id = 'tenant_id';
```

3. **Add Missing Indexes**:
```sql
CREATE INDEX CONCURRENTLY idx_table_column ON table_name(column_name);
```

### Development Tips

#### Database Inspection

```bash
# Open Prisma Studio for visual database inspection
npx prisma studio

# Generate and view database schema
npx prisma db pull
npx prisma generate
```

#### Testing Database Operations

```typescript
// Use test database for integration tests
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL,
    },
  },
});
```

## Integration with Other Modules

### Authentication Module

The database module provides user authentication data and supports multiple authentication methods:

```typescript
// User model supports multiple auth methods
authMethods: ['password', 'google']
googleId: string | null
googleLinkedAt: DateTime | null
```

### Tenant Module

Tight integration with tenant context for automatic data scoping:

```typescript
// Tenant context is injected into PrismaService
constructor(@Optional() private readonly tenantContext?: TenantContextService)
```

### Notification Module

Comprehensive notification system with privacy and audit features:

```typescript
// Notification models with tenant isolation
Notification, NotificationPreference, NotificationTemplate, NotificationAuditLog
```

## Best Practices

### 1. Always Use Service Layer

```typescript
// ❌ Don't inject PrismaService directly in controllers
@Controller()
export class UserController {
  constructor(private prisma: PrismaService) {} // Avoid this
}

// ✅ Use dedicated service layer
@Controller()
export class UserController {
  constructor(private userService: UserService) {} // Preferred
}
```

### 2. Handle Transactions Properly

```typescript
// ✅ Use transactions for related operations
async createUserWithRole(userData: CreateUserDto, roleId: string) {
  return this.prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: userData });
    await tx.userRole.create({
      data: { userId: user.id, roleId },
    });
    return user;
  });
}
```

### 3. Implement Proper Error Handling

```typescript
// ✅ Handle Prisma-specific errors
try {
  return await this.prisma.user.create({ data });
} catch (error) {
  if (error.code === 'P2002') {
    throw new ConflictException('User already exists');
  }
  throw error;
}
```

### 4. Use Type-Safe Queries

```typescript
// ✅ Leverage Prisma's type safety
async findUserWithRoles(userId: string): Promise<UserWithRoles> {
  return this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });
}
```

This documentation provides a comprehensive guide to the database module, covering architecture, usage, troubleshooting, and best practices for maintaining the multi-tenant database layer.