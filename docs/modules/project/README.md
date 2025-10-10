# Project Module

## Purpose

The Project module manages project entities within the multi-tenant NestJS application. It provides comprehensive project management functionality including project creation, ownership tracking, and tenant-specific project isolation. Each project belongs to a specific tenant and has an assigned owner (user), ensuring proper access control and data isolation.

## Key Features

- **Project CRUD Operations**: Create, read, update, and delete project records
- **Tenant Isolation**: All project operations are automatically scoped to the current tenant
- **Ownership Management**: Each project has an assigned owner from the same tenant
- **User Integration**: Projects are linked to users through ownership relationships
- **Security**: Permission-based access control and tenant isolation
- **Audit Trail**: Automatic timestamps for creation and updates

## Dependencies

### Internal Modules
- **DatabaseModule**: Prisma ORM for database operations
- **TenantModule**: Tenant context and isolation
- **AuthModule**: Authentication guards and user context

### External Dependencies
- **class-validator**: Input validation
- **@nestjs/swagger**: API documentation

## Quick Start

### Basic Usage

```typescript
import { ProjectService } from './project/project.service';

@Injectable()
export class MyService {
  constructor(private projectService: ProjectService) {}

  async createProject(userId: string) {
    return await this.projectService.create({
      name: 'My New Project',
      description: 'A sample project description'
    }, userId);
  }

  async getUserProjects() {
    return await this.projectService.findAll();
  }
}
```

### API Usage

```bash
# Create a new project
curl -X POST /projects \
  -H "Authorization: Bearer <jwt-token>" \
  -H "x-tenant-id: <tenant-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Project",
    "description": "Project description"
  }'

# Get all projects in tenant
curl -X GET /projects \
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
The Project entity includes:
- Basic project information (name, description)
- Ownership tracking (ownerId linking to User)
- Tenant association for multi-tenancy
- Timestamps for audit trails

### Service Layer
The ProjectService provides:
- CRUD operations with tenant isolation
- Ownership validation and assignment
- User relationship management
- Automatic tenant context injection

### Integration Points
- **Auth Module**: JWT authentication and permission guards
- **Tenant Module**: Automatic tenant context injection
- **User Module**: Project ownership through user relationships
- **Database Module**: Prisma ORM for data persistence

## Security Considerations

### Authentication & Authorization
- All endpoints require JWT authentication
- Permission-based access control using `@Permissions()` decorator
- Tenant isolation enforced at the service layer

### Data Protection
- Input validation using class-validator decorators
- Tenant isolation prevents cross-tenant data access
- Owner validation ensures proper project access

### Tenant Isolation
- All database queries automatically filtered by tenant ID
- Cross-tenant project access prevented at the service level
- Owner assignments validated for tenant membership