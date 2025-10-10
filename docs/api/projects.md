# Projects API

The Projects API provides endpoints for managing projects within a tenant.

## Base Path
```
/api/projects
```

## Authentication
All endpoints require JWT authentication and appropriate permissions.

**Headers:**
- `Authorization: Bearer <jwt_token>` (required)
- `x-tenant-id: <tenant_id>` (required)

## Endpoints

### GET /projects

List all projects in the current tenant.

**Required Permission:** `read:project`

**Response (200):**
```json
[
  {
    "id": "proj_123",
    "name": "Website Redesign",
    "description": "Complete redesign of the company website",
    "ownerId": "user_123",
    "tenantId": "tenant_123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "owner": {
      "id": "user_123",
      "email": "owner@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  },
  {
    "id": "proj_124",
    "name": "Mobile App Development",
    "description": "Development of iOS and Android mobile applications",
    "ownerId": "user_124",
    "tenantId": "tenant_123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "owner": {
      "id": "user_124",
      "email": "manager@example.com",
      "firstName": "Jane",
      "lastName": "Smith"
    }
  }
]
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:project` permission)

---

### GET /projects/:id

Get a specific project by ID.

**Required Permission:** `read:project`

**Path Parameters:**
- `id` (string): Project ID

**Response (200):**
```json
{
  "id": "proj_123",
  "name": "Website Redesign",
  "description": "Complete redesign of the company website with modern UI/UX principles",
  "ownerId": "user_123",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "owner": {
    "id": "user_123",
    "email": "owner@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:project` permission)
- `404` - Project not found

---

### POST /projects

Create a new project in the current tenant. The current user will be set as the owner.

**Required Permission:** `create:project`

**Request Body:**
```json
{
  "name": "E-commerce Platform",
  "description": "Development of a new e-commerce platform with advanced features"
}
```

**Response (201):**
```json
{
  "id": "proj_456",
  "name": "E-commerce Platform",
  "description": "Development of a new e-commerce platform with advanced features",
  "ownerId": "user_123",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "owner": {
    "id": "user_123",
    "email": "creator@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `create:project` permission)
- `409` - Conflict (project name already exists in tenant)

**Validation Rules:**
- `name` (required): Project name, must be unique within tenant
- `description` (optional): Project description

---

### PUT /projects/:id

Update project details.

**Required Permission:** `update:project`

**Path Parameters:**
- `id` (string): Project ID

**Request Body:**
```json
{
  "name": "Website Redesign v2",
  "description": "Complete redesign of the company website with modern UI/UX principles and mobile-first approach"
}
```

**Response (200):**
```json
{
  "id": "proj_123",
  "name": "Website Redesign v2",
  "description": "Complete redesign of the company website with modern UI/UX principles and mobile-first approach",
  "ownerId": "user_123",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:00:00.000Z",
  "owner": {
    "id": "user_123",
    "email": "owner@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `update:project` permission)
- `404` - Project not found
- `409` - Conflict (project name already exists)

---

### DELETE /projects/:id

Delete a project.

**Required Permission:** `delete:project`

**Path Parameters:**
- `id` (string): Project ID

**Response (200):**
```json
{
  "message": "Project deleted successfully",
  "deletedProjectId": "proj_123"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `delete:project` permission)
- `404` - Project not found

## Usage Examples

### Create a New Project

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-commerce Platform",
    "description": "Development of a new e-commerce platform with advanced features"
  }'
```

### Update Project

```bash
curl -X PUT http://localhost:3000/api/projects/proj_123 \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Website Redesign v2",
    "description": "Complete redesign with mobile-first approach"
  }'
```

### Get All Projects

```bash
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

### Delete Project

```bash
curl -X DELETE http://localhost:3000/api/projects/proj_123 \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

## Project Ownership

### Owner Responsibilities
- **Full Control**: Project owners have full control over their projects
- **Access Management**: Can manage who has access to the project
- **Lifecycle Management**: Can update or delete the project

### Ownership Transfer
Currently, project ownership is set during creation and assigned to the creating user. Future versions may support ownership transfer.

## Permission-Based Access

Projects respect the permission system:

### Read Access
- Users with `read:project` permission can view all projects in the tenant
- Users with `read:project:own` permission can only view their own projects

### Write Access
- Users with `create:project` permission can create new projects
- Users with `update:project` permission can update any project
- Users with `update:project:own` permission can only update their own projects

### Delete Access
- Users with `delete:project` permission can delete any project
- Users with `delete:project:own` permission can only delete their own projects

## Project Lifecycle

### Creation
1. User creates project with name and description
2. System assigns current user as owner
3. Project is created within current tenant context

### Management
1. Project details can be updated by authorized users
2. Ownership information is maintained
3. All changes are tracked with timestamps

### Deletion
1. Authorized users can delete projects
2. Deletion is permanent (no soft delete currently implemented)
3. All associated data should be cleaned up

## Tenant Isolation

All project operations are automatically scoped to the current tenant:
- Projects are unique within each tenant (name constraint)
- Cross-tenant project access is prevented
- Project ownership is tenant-specific

## Future Enhancements

The Projects API is designed to support future enhancements:

### Planned Features
- **Team Management**: Assign teams to projects
- **Status Tracking**: Project status and progress tracking
- **File Management**: Attach files and documents to projects
- **Task Management**: Break projects into tasks and subtasks
- **Time Tracking**: Track time spent on projects
- **Collaboration**: Comments and collaboration features

### API Extensibility
The current API structure allows for easy extension:
- Additional fields can be added to project model
- New endpoints can be added for enhanced functionality
- Relationship endpoints can be added for team/task management

## Error Handling

Standard error response format:

```json
{
  "statusCode": 409,
  "message": "Project name already exists in tenant",
  "error": "Conflict",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/projects"
}
```

Common error scenarios:
- Missing required permissions
- Project name conflicts within tenant
- Attempting to access non-existent projects
- Insufficient permissions for project operations