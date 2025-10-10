# Roles API

The Roles API provides endpoints for managing roles and their associated permissions within a tenant.

## Base Path
```
/api/roles
```

## Authentication
All endpoints require JWT authentication and appropriate permissions.

**Headers:**
- `Authorization: Bearer <jwt_token>` (required)
- `x-tenant-id: <tenant_id>` (required)

## Endpoints

### GET /roles

List all roles in the current tenant.

**Required Permission:** `read:role`

**Response (200):**
```json
[
  {
    "id": "role_123",
    "name": "Editor",
    "description": "Can edit content and manage users",
    "tenantId": "tenant_123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "permissions": [
      {
        "id": "perm_123",
        "name": "read:user",
        "description": "Can read user data"
      },
      {
        "id": "perm_124",
        "name": "update:user",
        "description": "Can update user data"
      }
    ]
  }
]
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:role` permission)

---

### GET /roles/:id

Get a specific role with its permissions.

**Required Permission:** `read:role`

**Path Parameters:**
- `id` (string): Role ID

**Response (200):**
```json
{
  "id": "role_123",
  "name": "Editor",
  "description": "Can edit content and manage users",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "permissions": [
    {
      "id": "perm_123",
      "name": "read:user",
      "description": "Can read user data"
    },
    {
      "id": "perm_124",
      "name": "update:user",
      "description": "Can update user data"
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:role` permission)
- `404` - Role not found

---

### POST /roles

Create a new role in the current tenant.

**Required Permission:** `create:role`

**Request Body:**
```json
{
  "name": "Content Manager",
  "description": "Can manage all content within the tenant"
}
```

**Response (201):**
```json
{
  "id": "role_456",
  "name": "Content Manager",
  "description": "Can manage all content within the tenant",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "permissions": []
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `create:role` permission)
- `409` - Conflict (role name already exists in tenant)

**Validation Rules:**
- `name` (required): Role name, must be unique within tenant
- `description` (optional): Role description

---

### PUT /roles/:id

Update role details.

**Required Permission:** `update:role`

**Path Parameters:**
- `id` (string): Role ID

**Request Body:**
```json
{
  "name": "Senior Editor",
  "description": "Senior editor with additional privileges"
}
```

**Response (200):**
```json
{
  "id": "role_123",
  "name": "Senior Editor",
  "description": "Senior editor with additional privileges",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `update:role` permission)
- `404` - Role not found
- `409` - Conflict (role name already exists)

---

### PUT /roles/:id/permissions

Assign permissions to a role (replaces existing permissions).

**Required Permission:** `update:role`

**Path Parameters:**
- `id` (string): Role ID

**Request Body:**
```json
{
  "permissionIds": ["perm_123", "perm_124", "perm_125"]
}
```

**Response (200):**
```json
{
  "id": "role_123",
  "name": "Editor",
  "description": "Can edit content and manage users",
  "permissions": [
    {
      "id": "perm_123",
      "name": "read:user",
      "description": "Can read user data"
    },
    {
      "id": "perm_124",
      "name": "update:user",
      "description": "Can update user data"
    },
    {
      "id": "perm_125",
      "name": "create:project",
      "description": "Can create projects"
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `update:role` permission)
- `404` - Role or permission not found

---

### DELETE /roles/:id

Delete a role and remove it from all users.

**Required Permission:** `delete:role`

**Path Parameters:**
- `id` (string): Role ID

**Response (200):**
```json
{
  "message": "Role deleted successfully",
  "deletedRoleId": "role_123"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `delete:role` permission)
- `404` - Role not found

## Usage Examples

### Create a New Role

```bash
curl -X POST http://localhost:3000/api/roles \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Content Manager",
    "description": "Can manage all content within the tenant"
  }'
```

### Assign Permissions to Role

```bash
curl -X PUT http://localhost:3000/api/roles/role_123/permissions \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "permissionIds": ["perm_123", "perm_124", "perm_125"]
  }'
```

### Get Role with Permissions

```bash
curl -X GET http://localhost:3000/api/roles/role_123 \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

## Role-Based Access Control (RBAC)

The Roles API is central to the RBAC system:

### Role Hierarchy
- **Admin**: Full system access within tenant
- **Manager**: User and project management
- **Editor**: Content creation and editing
- **Viewer**: Read-only access

### Permission Categories
- **User Management**: `read:user`, `create:user`, `update:user`, `delete:user`
- **Role Management**: `read:role`, `create:role`, `update:role`, `delete:role`
- **Permission Management**: `read:permission`, `create:permission`, `update:permission`, `delete:permission`
- **Project Management**: `read:project`, `create:project`, `update:project`, `delete:project`

### Best Practices
1. **Principle of Least Privilege**: Assign minimum necessary permissions
2. **Role Composition**: Create specific roles for different job functions
3. **Regular Audits**: Review role assignments and permissions regularly
4. **Separation of Duties**: Avoid combining conflicting permissions

## Tenant Isolation

All role operations are automatically scoped to the current tenant:
- Roles are unique within each tenant
- Cross-tenant role access is prevented
- Permission assignments are tenant-specific

## Error Handling

Standard error response format:

```json
{
  "statusCode": 403,
  "message": "Insufficient permissions to create roles",
  "error": "Forbidden",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/roles"
}
```

Common error scenarios:
- Missing required permissions
- Role name conflicts within tenant
- Invalid permission IDs
- Attempting to delete non-existent roles