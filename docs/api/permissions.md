# Permissions API

The Permissions API provides endpoints for managing permissions within a tenant.

## Base Path
```
/api/permissions
```

## Authentication
All endpoints require JWT authentication and appropriate permissions.

**Headers:**
- `Authorization: Bearer <jwt_token>` (required)
- `x-tenant-id: <tenant_id>` (required)

## Endpoints

### GET /permissions

List all permissions in the current tenant.

**Required Permission:** `read:permission`

**Response (200):**
```json
[
  {
    "id": "perm_123",
    "name": "read:user",
    "description": "Can read user data",
    "tenantId": "tenant_123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "id": "perm_124",
    "name": "create:user",
    "description": "Can create new users",
    "tenantId": "tenant_123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:permission` permission)

---

### GET /permissions/:id

Get a specific permission by ID.

**Required Permission:** `read:permission`

**Path Parameters:**
- `id` (string): Permission ID

**Response (200):**
```json
{
  "id": "perm_123",
  "name": "read:user",
  "description": "Can read user data",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:permission` permission)
- `404` - Permission not found

---

### POST /permissions

Create a new permission in the current tenant.

**Required Permission:** `create:permission`

**Request Body:**
```json
{
  "name": "manage:reports",
  "description": "Can create, read, update, and delete reports"
}
```

**Response (201):**
```json
{
  "id": "perm_456",
  "name": "manage:reports",
  "description": "Can create, read, update, and delete reports",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `create:permission` permission)
- `409` - Conflict (permission name already exists in tenant)

**Validation Rules:**
- `name` (required): Permission name, must be unique within tenant
- `description` (required): Permission description

---

### PUT /permissions/:id

Update permission details.

**Required Permission:** `update:permission`

**Path Parameters:**
- `id` (string): Permission ID

**Request Body:**
```json
{
  "name": "manage:advanced:reports",
  "description": "Can create, read, update, and delete advanced reports with analytics"
}
```

**Response (200):**
```json
{
  "id": "perm_456",
  "name": "manage:advanced:reports",
  "description": "Can create, read, update, and delete advanced reports with analytics",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `update:permission` permission)
- `404` - Permission not found
- `409` - Conflict (permission name already exists)

---

### DELETE /permissions/:id

Delete a permission and remove it from all roles and users.

**Required Permission:** `delete:permission`

**Path Parameters:**
- `id` (string): Permission ID

**Response (200):**
```json
{
  "message": "Permission deleted successfully",
  "deletedPermissionId": "perm_456"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `delete:permission` permission)
- `404` - Permission not found

## Usage Examples

### Create a New Permission

```bash
curl -X POST http://localhost:3000/api/permissions \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "manage:reports",
    "description": "Can create, read, update, and delete reports"
  }'
```

### Update Permission

```bash
curl -X PUT http://localhost:3000/api/permissions/perm_456 \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "manage:advanced:reports",
    "description": "Can create, read, update, and delete advanced reports with analytics"
  }'
```

### List All Permissions

```bash
curl -X GET http://localhost:3000/api/permissions \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

## Permission Naming Conventions

Permissions follow a structured naming convention:

### Format
```
<action>:<resource>[:<scope>]
```

### Examples
- `read:user` - Can read user data
- `create:user` - Can create new users
- `update:user` - Can update user data
- `delete:user` - Can delete users
- `manage:user` - Can perform all user operations
- `read:project:own` - Can read own projects only
- `admin:tenant` - Full admin access within tenant

### Action Types
- `read` - View/retrieve data
- `create` - Create new resources
- `update` - Modify existing resources
- `delete` - Remove resources
- `manage` - Full CRUD operations
- `admin` - Administrative access

### Resource Types
- `user` - User management
- `role` - Role management
- `permission` - Permission management
- `project` - Project management
- `tenant` - Tenant administration
- `notification` - Notification system

### Scope Modifiers
- `own` - Only resources owned by the user
- `team` - Resources within user's team
- `tenant` - All resources within tenant
- `system` - System-wide access (super admin)

## Standard Permission Sets

### Viewer Role Permissions
```json
[
  "read:user",
  "read:project",
  "read:role",
  "read:permission"
]
```

### Editor Role Permissions
```json
[
  "read:user",
  "read:project",
  "create:project",
  "update:project:own",
  "read:role",
  "read:permission"
]
```

### Manager Role Permissions
```json
[
  "read:user",
  "create:user",
  "update:user",
  "read:project",
  "create:project",
  "update:project",
  "delete:project",
  "read:role",
  "update:role",
  "read:permission"
]
```

### Admin Role Permissions
```json
[
  "manage:user",
  "manage:project",
  "manage:role",
  "manage:permission",
  "admin:tenant"
]
```

## Permission Inheritance

Permissions can be inherited through multiple paths:

1. **Direct Assignment**: Permissions assigned directly to a user
2. **Role-Based**: Permissions inherited from assigned roles
3. **Hierarchical**: Some permissions may imply others (e.g., `manage:user` includes `read:user`)

## Tenant Isolation

All permission operations are automatically scoped to the current tenant:
- Permissions are unique within each tenant
- Cross-tenant permission access is prevented
- Permission assignments are tenant-specific

## Error Handling

Standard error response format:

```json
{
  "statusCode": 409,
  "message": "Permission name already exists in tenant",
  "error": "Conflict",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/permissions"
}
```

Common error scenarios:
- Missing required permissions
- Permission name conflicts within tenant
- Attempting to delete non-existent permissions
- Invalid permission name format