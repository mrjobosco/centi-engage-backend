# Project API Reference

## Overview

The Project API provides endpoints for managing project entities within a tenant. All endpoints require JWT authentication and appropriate permissions. Projects are automatically scoped to the current tenant and linked to user owners.

## Authentication

All endpoints require:
- **JWT Token**: `Authorization: Bearer <token>`
- **Tenant ID**: `x-tenant-id: <tenant-id>` header
- **Permissions**: Specific permissions as documented for each endpoint

## Endpoints

### List Projects

**GET** `/projects`

Retrieve all projects in the current tenant.

#### Required Permissions
- `read:project`

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
```

#### Response
```json
{
  "status": 200,
  "data": [
    {
      "id": "project-123",
      "name": "My Project",
      "description": "A sample project",
      "tenantId": "tenant-456",
      "ownerId": "user-789",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "owner": {
        "id": "user-789",
        "email": "owner@example.com",
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  ]
}
```

#### Error Responses
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `read:project` permission

---

### Get Project by ID

**GET** `/projects/{id}`

Retrieve a specific project with owner information.

#### Required Permissions
- `read:project`

#### Path Parameters
- `id` (string): Project ID

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
```

#### Response
```json
{
  "id": "project-123",
  "name": "My Project",
  "description": "A detailed project description",
  "tenantId": "tenant-456",
  "ownerId": "user-789",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T12:00:00Z",
  "owner": {
    "id": "user-789",
    "email": "owner@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### Error Responses
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `read:project` permission
- **404 Not Found**: Project not found in current tenant

---

### Create Project

**POST** `/projects`

Create a new project in the current tenant. The authenticated user will be set as the project owner.

#### Required Permissions
- `create:project`

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "New Project",
  "description": "Optional project description"
}
```

#### Request Body Schema
- `name` (string, required): Project name (non-empty)
- `description` (string, optional): Project description

#### Response
```json
{
  "id": "project-new",
  "name": "New Project",
  "description": "Optional project description",
  "tenantId": "tenant-456",
  "ownerId": "user-current",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "owner": {
    "id": "user-current",
    "email": "current@example.com",
    "firstName": "Current",
    "lastName": "User"
  }
}
```

#### Error Responses
- **400 Bad Request**: Invalid input data (empty name, validation errors)
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `create:project` permission

---

### Update Project

**PUT** `/projects/{id}`

Update project details.

#### Required Permissions
- `update:project`

#### Path Parameters
- `id` (string): Project ID

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "Updated Project Name",
  "description": "Updated description"
}
```

#### Request Body Schema
- `name` (string, optional): Updated project name
- `description` (string, optional): Updated project description

#### Response
```json
{
  "id": "project-123",
  "name": "Updated Project Name",
  "description": "Updated description",
  "tenantId": "tenant-456",
  "ownerId": "user-789",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T12:00:00Z",
  "owner": {
    "id": "user-789",
    "email": "owner@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### Error Responses
- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `update:project` permission
- **404 Not Found**: Project not found in current tenant

---

### Delete Project

**DELETE** `/projects/{id}`

Delete a project from the current tenant.

#### Required Permissions
- `delete:project`

#### Path Parameters
- `id` (string): Project ID

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
```

#### Response
```json
{
  "message": "Project deleted successfully"
}
```

#### Error Responses
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `delete:project` permission
- **404 Not Found**: Project not found in current tenant

## Data Models

### Project Entity
```typescript
interface Project {
  id: string;                    // Primary key (CUID)
  name: string;                  // Project name (required)
  description?: string;          // Optional description
  tenantId: string;              // Foreign key to Tenant
  ownerId: string;               // Foreign key to User (owner)
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Last update timestamp
  owner: {                       // Owner information (included in responses)
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}
```

### Create Project DTO
```typescript
interface CreateProjectDto {
  name: string;                  // Required, non-empty
  description?: string;          // Optional
}
```

### Update Project DTO
```typescript
interface UpdateProjectDto {
  name?: string;                 // Optional
  description?: string;          // Optional
}
```

## Business Rules

### Ownership
- Every project must have an owner (user from the same tenant)
- The authenticated user becomes the owner when creating a project
- Owner cannot be changed after project creation (currently)
- Owner must belong to the same tenant as the project

### Tenant Isolation
- Projects are automatically scoped to the current tenant
- Cross-tenant project access is prevented
- All operations validate tenant membership

### Validation
- Project name is required and cannot be empty
- Description is optional
- All string fields are validated for type and format

## Rate Limiting

Project API endpoints are subject to tenant-level rate limiting:
- 100 requests per minute per tenant for read operations
- 50 requests per minute per tenant for write operations

## Common Error Codes

- **400 Bad Request**: Invalid request data or validation errors
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Missing required permissions
- **404 Not Found**: Project not found in current tenant
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

## Usage Examples

### Creating a Project
```bash
curl -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My New Project",
    "description": "This is a new project for our team"
  }'
```

### Updating a Project
```bash
curl -X PUT http://localhost:3000/projects/project-456 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Project Name",
    "description": "Updated project description"
  }'
```

### Getting All Projects
```bash
curl -X GET http://localhost:3000/projects \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123"
```

### Getting a Specific Project
```bash
curl -X GET http://localhost:3000/projects/project-456 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123"
```

### Deleting a Project
```bash
curl -X DELETE http://localhost:3000/projects/project-456 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123"
```