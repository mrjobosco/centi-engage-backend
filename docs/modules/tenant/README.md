# Tenant Module Documentation

## Overview

The Tenant module is the cornerstone of the multi-tenant architecture, providing tenant identification, context management, and tenant isolation throughout the application. It ensures that all data operations are properly scoped to the correct tenant and manages the lifecycle of tenant creation and configuration.

## Key Features

- **Tenant Identification**: Automatic tenant resolution from headers or subdomains
- **Context Management**: Request-scoped tenant context for data isolation
- **Tenant Registration**: Complete tenant setup with admin user and RBAC
- **Google SSO Integration**: Tenant-specific Google authentication configuration
- **Audit Logging**: Comprehensive audit trails for tenant operations
- **Middleware Integration**: Seamless integration with database middleware

## Architecture

### Module Structure

```
src/tenant/
├── tenant.module.ts                    # Main module configuration
├── tenant.service.ts                   # Core tenant business logic
├── tenant.controller.ts                # REST API endpoints
├── tenant-context.service.ts           # Request-scoped tenant context
├── tenant-identification.middleware.ts # Tenant resolution middleware
└── index.ts                            # Module exports
```

### Dependencies

- **DatabaseModule**: For tenant data operations
- **AuthAuditService**: For audit logging
- **ConfigService**: For configuration management

## Core Components

### TenantModule

The main module that orchestrates all tenant-related functionality.

```typescript
@Module({
  imports: [forwardRef(() => DatabaseModule)],
  controllers: [TenantController],
  providers: [
    TenantContextService,
    TenantIdentificationMiddleware,
    TenantService,
    AuthAuditService,
  ],
  exports: [TenantContextService, TenantService],
})
export class TenantModule {}
```

**Key Features:**
- Forward reference to DatabaseModule to avoid circular dependencies
- Exports TenantContextService for use throughout the application
- Provides all necessary services for tenant management

### TenantContextService

Request-scoped service that maintains tenant context throughout the request lifecycle.

```typescript
@Injectable({ scope: Scope.REQUEST })
export class TenantContextService implements ITenantContext {
  private tenantId?: string;

  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  getTenantId(): string | undefined {
    return this.tenantId;
  }
}
```

**Key Features:**
- Request-scoped to ensure tenant isolation between concurrent requests
- Implements ITenantContext interface for database middleware integration
- Provides helper methods for tenant context validation

**Methods:**
- `setTenantId(tenantId: string)`: Sets the tenant ID for the current request
- `getTenantId()`: Returns the current tenant ID or undefined
- `getRequiredTenantId()`: Returns tenant ID or throws error if not set
- `hasTenantContext()`: Checks if tenant context is available

### TenantIdentificationMiddleware

Middleware that identifies and sets the tenant context for incoming requests.

```typescript
@Injectable()
export class TenantIdentificationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    let tenantId: string | undefined;

    // Try header-based identification
    tenantId = req.headers[this.tenantHeaderName] as string;

    // Try subdomain-based identification (if enabled)
    if (!tenantId && this.enableSubdomainRouting) {
      tenantId = this.extractTenantFromSubdomain(req.hostname);
    }

    if (!tenantId) {
      throw new BadRequestException('Tenant identification required');
    }

    this.tenantContextService.setTenantId(tenantId);
    next();
  }
}
```

**Identification Methods:**
1. **Header-based**: Uses `x-tenant-id` header (configurable)
2. **Subdomain-based**: Extracts tenant from subdomain (optional)

**Configuration:**
- `tenant.headerName`: Custom header name (default: `x-tenant-id`)
- `tenant.enableSubdomainRouting`: Enable subdomain routing (default: `false`)

### TenantService

Core business logic for tenant management operations.

```typescript
@Injectable()
export class TenantService {
  async createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
    // Transaction-based tenant creation with RBAC setup
  }

  async findById(id: string) {
    // Retrieve tenant by ID with Google SSO settings
  }

  async updateGoogleSettings(tenantId: string, updateDto: UpdateGoogleSettingsDto, userId: string) {
    // Update Google SSO configuration with audit logging
  }
}
```

**Key Operations:**
- **Tenant Creation**: Complete tenant setup with admin user and default RBAC
- **Configuration Management**: Google SSO settings management
- **Audit Integration**: Comprehensive audit logging for all operations

### TenantController

REST API endpoints for tenant management.

```typescript
@ApiTags('Tenants')
@Controller('tenants')
export class TenantController {
  @Public()
  @Post()
  async register(@Body() registerTenantDto: RegisterTenantDto) {
    // Public endpoint for tenant registration
  }

  @Get(':id/settings/google')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async getGoogleSettings(@Param('id') tenantId: string) {
    // Get Google SSO settings (admin only)
  }

  @Patch(':id/settings/google')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async updateGoogleSettings(@Param('id') tenantId: string, @Body() updateDto: UpdateGoogleSettingsDto) {
    // Update Google SSO settings (admin only)
  }
}
```

## Tenant Identification Flow

```mermaid
sequenceDiagram
    participant Client
    participant Middleware
    participant Context
    participant Database
    participant Service

    Client->>Middleware: HTTP Request with x-tenant-id
    Middleware->>Middleware: Extract tenant ID from header/subdomain
    alt Tenant ID found
        Middleware->>Context: setTenantId(tenantId)
        Context->>Middleware: Context set
        Middleware->>Service: Continue to service
        Service->>Database: Query with tenant context
        Database->>Service: Tenant-scoped data
        Service->>Client: Response
    else No tenant ID
        Middleware->>Client: 400 Bad Request
    end
```

## Tenant Registration Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Service
    participant Database
    participant Audit

    Client->>Controller: POST /tenants (RegisterTenantDto)
    Controller->>Service: createTenant(input)
    Service->>Database: Begin Transaction
    
    Service->>Database: Create Tenant
    Service->>Database: Create Default Permissions
    Service->>Database: Create Default Roles (Admin, Member)
    Service->>Database: Assign Permissions to Roles
    Service->>Database: Create Admin User
    Service->>Database: Assign Admin Role to User
    
    Database->>Service: Commit Transaction
    Service->>Controller: Return tenant + admin user
    Controller->>Client: 201 Created with tenant data
```

## Configuration

### Environment Variables

```env
# Tenant identification
TENANT_HEADER_NAME=x-tenant-id
TENANT_ENABLE_SUBDOMAIN_ROUTING=false

# Database connection
DATABASE_URL=postgresql://user:pass@localhost:5432/db
```

### Application Configuration

```typescript
// src/config/configuration.ts
export default () => ({
  tenant: {
    headerName: process.env.TENANT_HEADER_NAME || 'x-tenant-id',
    enableSubdomainRouting: process.env.TENANT_ENABLE_SUBDOMAIN_ROUTING === 'true',
  },
});
```

## Usage Examples

### Basic Tenant Operations

```typescript
import { Injectable } from '@nestjs/common';
import { TenantService, TenantContextService } from '../tenant';

@Injectable()
export class MyService {
  constructor(
    private tenantService: TenantService,
    private tenantContext: TenantContextService,
  ) {}

  async getCurrentTenant() {
    const tenantId = this.tenantContext.getRequiredTenantId();
    return this.tenantService.findById(tenantId);
  }

  async createTenant(data: CreateTenantInput) {
    return this.tenantService.createTenant(data);
  }
}
```

### Client-Side Usage

```typescript
// Frontend API calls
const apiClient = axios.create({
  baseURL: 'https://api.example.com',
  headers: {
    'x-tenant-id': 'tenant-123',
    'Authorization': 'Bearer jwt-token',
  },
});

// Create new tenant
const response = await apiClient.post('/tenants', {
  tenantName: 'Acme Corp',
  adminEmail: 'admin@acme.com',
  adminPassword: 'secure-password',
  adminFirstName: 'John',
  adminLastName: 'Doe',
});
```

### Subdomain-Based Routing

```typescript
// Configure subdomain routing
// tenant1.example.com -> tenant ID: "tenant1"
// tenant2.example.com -> tenant ID: "tenant2"

// Enable in configuration
TENANT_ENABLE_SUBDOMAIN_ROUTING=true

// Middleware will automatically extract tenant from subdomain
```

## Tenant Registration Process

### Default RBAC Setup

When a new tenant is created, the system automatically sets up:

#### Default Permissions

```typescript
const defaultPermissions = [
  // Project permissions
  { action: 'create', subject: 'project' },
  { action: 'read', subject: 'project' },
  { action: 'update', subject: 'project' },
  { action: 'delete', subject: 'project' },
  
  // User permissions
  { action: 'create', subject: 'user' },
  { action: 'read', subject: 'user' },
  { action: 'update', subject: 'user' },
  { action: 'delete', subject: 'user' },
  
  // Role permissions
  { action: 'create', subject: 'role' },
  { action: 'read', subject: 'role' },
  { action: 'update', subject: 'role' },
  { action: 'delete', subject: 'role' },
  
  // Permission permissions
  { action: 'create', subject: 'permission' },
  { action: 'read', subject: 'permission' },
  { action: 'delete', subject: 'permission' },
];
```

#### Default Roles

**Admin Role:**
- All permissions across all subjects
- Assigned to the initial admin user

**Member Role:**
- Read-only permissions for all subjects
- Default role for new users

### Registration API

```typescript
// POST /tenants
{
  "tenantName": "Acme Corporation",
  "adminEmail": "admin@acme.com",
  "adminPassword": "secure-password-123",
  "adminFirstName": "John",
  "adminLastName": "Doe"
}

// Response
{
  "message": "Tenant created successfully",
  "data": {
    "tenant": {
      "id": "cuid-tenant-id",
      "name": "Acme Corporation",
      "subdomain": null,
      "createdAt": "2023-10-01T12:00:00Z",
      "updatedAt": "2023-10-01T12:00:00Z"
    },
    "adminUser": {
      "id": "cuid-user-id",
      "email": "admin@acme.com",
      "firstName": "John",
      "lastName": "Doe",
      "tenantId": "cuid-tenant-id",
      "createdAt": "2023-10-01T12:00:00Z",
      "updatedAt": "2023-10-01T12:00:00Z"
    }
  }
}
```

## Google SSO Configuration

### Managing Google Settings

```typescript
// Get current Google SSO settings
// GET /tenants/:id/settings/google
{
  "googleSsoEnabled": true,
  "googleAutoProvision": false
}

// Update Google SSO settings
// PATCH /tenants/:id/settings/google
{
  "googleSsoEnabled": true,
  "googleAutoProvision": true
}
```

### Configuration Options

- **googleSsoEnabled**: Enable/disable Google SSO for the tenant
- **googleAutoProvision**: Automatically create users from Google OAuth

### Audit Logging

All Google SSO configuration changes are automatically logged with:
- User who made the change
- Previous and new settings
- Timestamp and metadata
- Success/failure status

## Security Considerations

### Tenant Isolation

- **Request-Scoped Context**: Each request maintains its own tenant context
- **Database Middleware**: Automatic tenant scoping at the database level
- **Header Validation**: Strict tenant ID validation and sanitization
- **Cross-Tenant Prevention**: Middleware prevents cross-tenant data access

### Authentication and Authorization

- **Public Registration**: Tenant registration is publicly accessible
- **Admin-Only Settings**: Google SSO settings require admin role
- **JWT Integration**: Seamless integration with JWT authentication
- **Role-Based Access**: Granular permissions for tenant operations

### Data Protection

- **Password Hashing**: Admin passwords are bcrypt hashed
- **Audit Trails**: Comprehensive logging of all tenant operations
- **Transaction Safety**: Atomic tenant creation with rollback on failure
- **Input Validation**: Strict validation of all tenant data

## Error Handling

### Common Errors

```typescript
// Tenant name already exists
{
  "statusCode": 409,
  "message": "Tenant name already exists",
  "error": "Conflict"
}

// Admin email already exists
{
  "statusCode": 409,
  "message": "Email already exists for this tenant",
  "error": "Conflict"
}

// Missing tenant identification
{
  "statusCode": 400,
  "message": "Tenant identification required. Please provide tenant ID via x-tenant-id header or subdomain.",
  "error": "Bad Request"
}

// Tenant not found
{
  "statusCode": 404,
  "message": "Tenant not found",
  "error": "Not Found"
}
```

### Error Recovery

```typescript
// Handle tenant creation failures
try {
  const result = await this.tenantService.createTenant(input);
  return result;
} catch (error) {
  if (error instanceof ConflictException) {
    // Handle duplicate tenant/email
    throw error;
  }
  
  if (error.code === 'P2002') {
    // Handle Prisma unique constraint violations
    throw new ConflictException('Duplicate entry detected');
  }
  
  // Log and re-throw unexpected errors
  this.logger.error('Tenant creation failed', error);
  throw error;
}
```

## Performance Considerations

### Request-Scoped Services

- **Memory Usage**: Request-scoped services create new instances per request
- **Performance Impact**: Minimal overhead for tenant context management
- **Garbage Collection**: Automatic cleanup after request completion

### Database Optimization

- **Index Strategy**: Proper indexing on tenant_id columns
- **Query Performance**: Tenant scoping reduces query result sets
- **Connection Pooling**: Shared connection pool across all tenants

### Caching Strategies

```typescript
// Cache tenant configuration
@Injectable()
export class TenantCacheService {
  private cache = new Map<string, any>();
  
  async getTenantConfig(tenantId: string) {
    if (this.cache.has(tenantId)) {
      return this.cache.get(tenantId);
    }
    
    const config = await this.tenantService.findById(tenantId);
    this.cache.set(tenantId, config);
    return config;
  }
}
```

## Integration with Other Modules

### Database Module

```typescript
// Automatic tenant scoping through middleware
const users = await this.prisma.user.findMany(); // Only returns current tenant's users
```

### Authentication Module

```typescript
// Tenant-aware authentication
@Injectable()
export class AuthService {
  async validateUser(email: string, password: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();
    
    const user = await this.prisma.user.findUnique({
      where: { 
        email_tenantId: { email, tenantId } // Composite unique key
      },
    });
    
    return user;
  }
}
```

### Notification Module

```typescript
// Tenant-scoped notifications
@Injectable()
export class NotificationService {
  async sendNotification(userId: string, message: string) {
    // Tenant context automatically applied through database middleware
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        message,
        // tenantId automatically added by middleware
      },
    });
    
    return notification;
  }
}
```

## Testing

### Unit Testing

```typescript
describe('TenantService', () => {
  let service: TenantService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should create tenant with admin user', async () => {
    const input = {
      tenantName: 'Test Tenant',
      adminEmail: 'admin@test.com',
      adminPassword: 'password123',
      adminFirstName: 'Admin',
      adminLastName: 'User',
    };

    const result = await service.createTenant(input);

    expect(result.tenant.name).toBe('Test Tenant');
    expect(result.adminUser.email).toBe('admin@test.com');
  });
});
```

### Integration Testing

```typescript
describe('Tenant Integration', () => {
  it('should isolate data between tenants', async () => {
    // Create two tenants
    const tenant1 = await createTestTenant('Tenant 1');
    const tenant2 = await createTestTenant('Tenant 2');

    // Set tenant context for tenant 1
    tenantContext.setTenantId(tenant1.id);
    const users1 = await prisma.user.findMany();

    // Set tenant context for tenant 2
    tenantContext.setTenantId(tenant2.id);
    const users2 = await prisma.user.findMany();

    // Verify isolation
    expect(users1.every(u => u.tenantId === tenant1.id)).toBe(true);
    expect(users2.every(u => u.tenantId === tenant2.id)).toBe(true);
  });
});
```

## Best Practices

### 1. Always Use Tenant Context

```typescript
// ✅ Good: Use tenant context service
@Injectable()
export class MyService {
  constructor(private tenantContext: TenantContextService) {}

  async getMyData() {
    const tenantId = this.tenantContext.getRequiredTenantId();
    // Use tenantId for operations
  }
}

// ❌ Bad: Hardcode tenant ID
async getMyData() {
  const tenantId = 'hardcoded-tenant-id'; // Never do this
}
```

### 2. Handle Tenant Context Errors

```typescript
// ✅ Good: Proper error handling
try {
  const tenantId = this.tenantContext.getRequiredTenantId();
  return await this.processData(tenantId);
} catch (error) {
  if (error.message.includes('Tenant context')) {
    throw new BadRequestException('Tenant identification required');
  }
  throw error;
}
```

### 3. Use Transactions for Complex Operations

```typescript
// ✅ Good: Use transactions for multi-step operations
async createTenantWithCustomSetup(input: any) {
  return this.prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: input.tenant });
    const user = await tx.user.create({ data: { ...input.user, tenantId: tenant.id } });
    const role = await tx.role.create({ data: { ...input.role, tenantId: tenant.id } });
    
    return { tenant, user, role };
  });
}
```

### 4. Validate Tenant Access

```typescript
// ✅ Good: Validate tenant access for sensitive operations
async updateTenantSettings(tenantId: string, settings: any) {
  const currentTenantId = this.tenantContext.getRequiredTenantId();
  
  if (tenantId !== currentTenantId) {
    throw new ForbiddenException('Cannot modify other tenant settings');
  }
  
  return this.updateSettings(tenantId, settings);
}
```

This comprehensive documentation provides everything needed to understand and work with the tenant module in the multi-tenant NestJS application.