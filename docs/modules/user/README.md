# User Module

## Purpose

The User module manages user accounts within the multi-tenant NestJS application. It provides comprehensive user management functionality including user creation, authentication, role assignment, and permission management. The module ensures strict tenant isolation, meaning users can only access and manage other users within their own tenant.

## Key Features

- **User CRUD Operations**: Create, read, update, and delete user accounts
- **Tenant Isolation**: All user operations are automatically scoped to the current tenant
- **Role Management**: Assign and manage user roles through the RBAC system
- **Permission Management**: Direct user permission assignment and effective permission calculation
- **Authentication Integration**: Support for multiple authentication methods (password, Google OAuth)
- **Security**: Password hashing, input validation, and authorization checks

## Dependencies

### Internal Modules
- **DatabaseModule**: Prisma ORM for database operations
- **TenantModule**: Tenant context and isolation
- **AuthModule**: Authentication guards and decorators

### External Dependencies
- **bcrypt**: Password hashing
- **class-validator**: Input validation
- **@nestjs/swagger**: API documentation

## Quick Start

### Basic Usage

```typescript
import { UserService } from './user/user.service';

@Injectable()
export class MyService {
  constructor(private userService: UserService) {}

  async createUser() {
    return await this.userService.create({
      email: 'user@example.com',
      password: 'SecurePass123!',
      firstName: 'John',
      lastName: 'Doe'
    });
  }

  async getUserWithPermissions(userId: string) {
    return await this.userService.getEffectivePermissions(userId);
  }
}
```

### API Usage

```bash
# Create a new user
curl -X POST /users \
  -H "Authorization: Bearer <jwt-token>" \
  -H "x-tenant-id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Get user with roles and permissions
curl -X GET /users/{userId} \
  -H "Authorization: Bearer <jwt-token>" \
  -H "x-tenant-id: <tenant-id>"
```

## Architecture Overview

### Design Patterns
- **Repository Pattern**: Service layer abstracts database operations
- **Tenant Context Pattern**: Automatic tenant scoping for all operations
- **DTO Pattern**: Data transfer objects for API validation
- **Guard Pattern**: Authorization and authentication protection

### Data Model
The User entity includes:
- Basic profile information (email, firstName, lastName)
- Authentication data (password, authMethods, googleId)
- Tenant association for multi-tenancy
- Timestamps for audit trails

### Service Layer
The UserService provides:
- CRUD operations with tenant isolation
- Role and permission management
- Authentication method tracking
- Effective permission calculation

### Integration Points
- **Auth Module**: JWT authentication and permission guards
- **Tenant Module**: Automatic tenant context injection
- **Role/Permission Modules**: RBAC system integration
- **Database Module**: Prisma ORM for data persistence

## Security Considerations

### Authentication & Authorization
- All endpoints require JWT authentication
- Permission-based access control using `@Permissions()` decorator
- Tenant isolation enforced at the service layer

### Data Protection
- Passwords are hashed using bcrypt with salt rounds
- Sensitive data (passwords) excluded from API responses
- Input validation using class-validator decorators

### Tenant Isolation
- All database queries automatically filtered by tenant ID
- Cross-tenant data access prevented at the service level
- Role and permission assignments validated for tenant membership