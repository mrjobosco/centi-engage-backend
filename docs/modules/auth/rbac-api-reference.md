# RBAC API Reference

## Overview

This document provides comprehensive API reference for all role-based access control endpoints, including permissions, roles, and user permission management.

## Base Information

**Base URL**: All RBAC endpoints are prefixed with their respective resource paths  
**Authentication**: All endpoints require JWT authentication  
**Tenant Isolation**: All operations are automatically scoped to the authenticated user's tenant

## Permission Management API

### GET /permissions

List all permissions in the current tenant.

**Authentication**: JWT Required  
**Permission**: `read:permission`

#### Response

**Success (200)**:
```json
[
  {
    "id": "perm-123",
    "action": "read",
    "subject": "user",
    "tenantId": "tenant-123",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  },
  {
    "id": "perm-456",
    "action": "create",
    "subject": "project",
    "tenantId": "tenant-123",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
]
```

#### Error Responses

**401 Unauthorized**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**403 Forbidden**:
```json
{
  "statusCode": 403,
  "message": "Missing required permissions: read:permission",
  "error": "Forbidden"
}
```

---

### POST /permissions

Create a new permission in the current tenant.

**Authentication**: JWT Required  
**Permission**: `create:permission`

#### Request

**Body**:
```json
{
  "action": "read",
  "subject": "user"
}
```

**Schema**:
```typescript
interface CreatePermissionDto {
  action: string;  // The action that can be performed (e.g., 'read', 'create', 'update', 'delete')
  subject: string; // The resource/entity the action applies to (e.g., 'user', 'project', 'role')
}
```

#### Response

**Success (201)**:
```json
{
  "id": "perm-789",
  "action": "read",
  "subject": "user",
  "tenantId": "tenant-123",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

#### Error Responses

**409 Conflict**:
```json
{
  "statusCode": 409,
  "message": "Permission with action \"read\" and subject \"user\" already exists",
  "error": "Conflict"
}
```

---

### DELETE /permissions/:id

Delete a permission and remove it from all roles and users.

**Authentication**: JWT Required  
**Permission**: `delete:permission`

#### Parameters

- `id` (string): Permission ID

#### Response

**Success (200)**:
```json
{
  "message": "Permission deleted successfully"
}
```

#### Error Responses

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Permission with ID perm-123 not found",
  "error": "Not Found"
}
```

## Role Management API

### GET /roles

List all roles in the current tenant with their permissions.

**Authentication**: JWT Required  
**Permission**: `read:role`

#### Response

**Success (200)**:
```json
[
  {
    "id": "role-123",
    "name": "Admin",
    "tenantId": "tenant-123",
    "permissions": [
      {
        "permission": {
          "id": "perm-123",
          "action": "read",
          "subject": "user"
        }
      },
      {
        "permission": {
          "id": "perm-456",
          "action": "create",
          "subject": "user"
        }
      }
    ],
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
]
```

---

### GET /roles/:id

Get a specific role with its permissions.

**Authentication**: JWT Required  
**Permission**: `read:role`

#### Parameters

- `id` (string): Role ID

#### Response

**Success (200)**:
```json
{
  "id": "role-123",
  "name": "Admin",
  "tenantId": "tenant-123",
  "permissions": [
    {
      "permission": {
        "id": "perm-123",
        "action": "read",
        "subject": "user"
      }
    },
    {
      "permission": {
        "id": "perm-456",
        "action": "create",
        "subject": "user"
      }
    }
  ],
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

#### Error Responses

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Role with ID role-123 not found",
  "error": "Not Found"
}
```

---

### POST /roles

Create a new role in the current tenant.

**Authentication**: JWT Required  
**Permission**: `create:role`

#### Request

**Body**:
```json
{
  "name": "Manager"
}
```

**Schema**:
```typescript
interface CreateRoleDto {
  name: string; // The name of the role (must be unique within tenant)
}
```

#### Response

**Success (201)**:
```json
{
  "id": "role-456",
  "name": "Manager",
  "tenantId": "tenant-123",
  "permissions": [],
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

#### Error Responses

**409 Conflict**:
```json
{
  "statusCode": 409,
  "message": "Role with name \"Manager\" already exists in this tenant",
  "error": "Conflict"
}
```

---

### PUT /roles/:id

Update role name.

**Authentication**: JWT Required  
**Permission**: `update:role`

#### Parameters

- `id` (string): Role ID

#### Request

**Body**:
```json
{
  "name": "Senior Manager"
}
```

**Schema**:
```typescript
interface UpdateRoleDto {
  name: string; // New name for the role
}
```

#### Response

**Success (200)**:
```json
{
  "id": "role-456",
  "name": "Senior Manager",
  "tenantId": "tenant-123",
  "permissions": [
    {
      "permission": {
        "id": "perm-123",
        "action": "read",
        "subject": "user"
      }
    }
  ],
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

---

### PUT /roles/:id/permissions

Replace all permissions for a role.

**Authentication**: JWT Required  
**Permission**: `update:role`

#### Parameters

- `id` (string): Role ID

#### Request

**Body**:
```json
{
  "permissionIds": ["perm-123", "perm-456", "perm-789"]
}
```

**Schema**:
```typescript
interface AssignPermissionsToRolesDto {
  permissionIds: string[]; // Array of permission IDs to assign to the role
}
```

#### Response

**Success (200)**:
```json
{
  "id": "role-456",
  "name": "Manager",
  "permissions": [
    {
      "permission": {
        "id": "perm-123",
        "action": "read",
        "subject": "user"
      }
    },
    {
      "permission": {
        "id": "perm-456",
        "action": "create",
        "subject": "user"
      }
    },
    {
      "permission": {
        "id": "perm-789",
        "action": "read",
        "subject": "project"
      }
    }
  ]
}
```

#### Error Responses

**400 Bad Request**:
```json
{
  "statusCode": 400,
  "message": "One or more permissions not found",
  "error": "Bad Request"
}
```

**400 Bad Request** (Cross-tenant permissions):
```json
{
  "statusCode": 400,
  "message": "Cannot assign permissions from a different tenant",
  "error": "Bad Request"
}
```

---

### DELETE /roles/:id

Delete a role and remove it from all users.

**Authentication**: JWT Required  
**Permission**: `delete:role`

#### Parameters

- `id` (string): Role ID

#### Response

**Success (200)**:
```json
{
  "message": "Role deleted successfully"
}
```

## User Permission Management API

### GET /users

List all users in the current tenant.

**Authentication**: JWT Required  
**Permission**: `read:user`

#### Response

**Success (200)**:
```json
[
  {
    "id": "user-123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "tenantId": "tenant-123",
    "roles": [
      {
        "role": {
          "id": "role-123",
          "name": "Admin"
        }
      }
    ],
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
]
```

---

### GET /users/:id

Get a specific user with their roles and permissions.

**Authentication**: JWT Required  
**Permission**: `read:user`

#### Parameters

- `id` (string): User ID

#### Response

**Success (200)**:
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": "tenant-123",
  "roles": [
    {
      "role": {
        "id": "role-123",
        "name": "Admin",
        "permissions": [
          {
            "permission": {
              "id": "perm-123",
              "action": "read",
              "subject": "user"
            }
          }
        ]
      }
    }
  ],
  "permissions": [
    {
      "permission": {
        "id": "perm-456",
        "action": "create",
        "subject": "project"
      }
    }
  ],
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

---

### PUT /users/:id/roles

Assign roles to a user (replaces existing roles).

**Authentication**: JWT Required  
**Permission**: `update:user`

#### Parameters

- `id` (string): User ID

#### Request

**Body**:
```json
{
  "roleIds": ["role-123", "role-456"]
}
```

**Schema**:
```typescript
interface AssignRolesDto {
  roleIds: string[]; // Array of role IDs to assign to the user
}
```

#### Response

**Success (200)**:
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "roles": [
    {
      "role": {
        "id": "role-123",
        "name": "Admin"
      }
    },
    {
      "role": {
        "id": "role-456",
        "name": "Manager"
      }
    }
  ]
}
```

#### Error Responses

**400 Bad Request**:
```json
{
  "statusCode": 400,
  "message": "One or more roles not found",
  "error": "Bad Request"
}
```

---

### PUT /users/:id/permissions

Assign direct permissions to a user (replaces existing direct permissions).

**Authentication**: JWT Required  
**Permission**: `update:user`

#### Parameters

- `id` (string): User ID

#### Request

**Body**:
```json
{
  "permissionIds": ["perm-123", "perm-456"]
}
```

**Schema**:
```typescript
interface AssignPermissionsDto {
  permissionIds: string[]; // Array of permission IDs to assign directly to the user
}
```

#### Response

**Success (200)**:
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "permissions": [
    {
      "permission": {
        "id": "perm-123",
        "action": "read",
        "subject": "user"
      }
    },
    {
      "permission": {
        "id": "perm-456",
        "action": "create",
        "subject": "project"
      }
    }
  ]
}
```

---

### GET /users/:id/permissions

Get all effective permissions for a user (role-based + direct).

**Authentication**: JWT Required  
**Permission**: `read:user`

#### Parameters

- `id` (string): User ID

#### Response

**Success (200)**:
```json
{
  "userId": "user-123",
  "effectivePermissions": [
    "read:user",
    "create:user",
    "update:user",
    "read:project",
    "create:project"
  ],
  "roleBasedPermissions": [
    {
      "roleName": "Admin",
      "permissions": [
        "read:user",
        "create:user",
        "update:user"
      ]
    },
    {
      "roleName": "Manager",
      "permissions": [
        "read:project"
      ]
    }
  ],
  "directPermissions": [
    "create:project"
  ]
}
```

## Common Error Responses

### Authentication Errors

**401 Unauthorized** (No token):
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**401 Unauthorized** (Invalid token):
```json
{
  "statusCode": 401,
  "message": "Invalid token",
  "error": "Unauthorized"
}
```

**401 Unauthorized** (Tenant mismatch):
```json
{
  "statusCode": 401,
  "message": "Token tenant ID does not match request tenant ID",
  "error": "Unauthorized"
}
```

### Authorization Errors

**403 Forbidden** (Missing permissions):
```json
{
  "statusCode": 403,
  "message": "Missing required permissions: create:user, read:role",
  "error": "Forbidden"
}
```

**403 Forbidden** (User not authenticated):
```json
{
  "statusCode": 403,
  "message": "User not authenticated",
  "error": "Forbidden"
}
```

### Validation Errors

**400 Bad Request** (Validation failed):
```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "name must be a string"
  ],
  "error": "Bad Request"
}
```

**400 Bad Request** (Business logic violation):
```json
{
  "statusCode": 400,
  "message": "Cannot assign permissions from a different tenant",
  "error": "Bad Request"
}
```

### Resource Not Found

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Role with ID role-123 not found",
  "error": "Not Found"
}
```

### Conflict Errors

**409 Conflict**:
```json
{
  "statusCode": 409,
  "message": "Role with name \"Admin\" already exists in this tenant",
  "error": "Conflict"
}
```

## Usage Examples

### Complete Role Management Flow

```bash
# 1. Create permissions
curl -X POST http://localhost:3000/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "read", "subject": "user"}'

curl -X POST http://localhost:3000/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "create", "subject": "user"}'

# 2. Create a role
curl -X POST http://localhost:3000/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "User Manager"}'

# 3. Assign permissions to role
curl -X PUT http://localhost:3000/roles/role-123/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permissionIds": ["perm-123", "perm-456"]}'

# 4. Assign role to user
curl -X PUT http://localhost:3000/users/user-123/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"roleIds": ["role-123"]}'

# 5. Check user's effective permissions
curl -X GET http://localhost:3000/users/user-123/permissions \
  -H "Authorization: Bearer $TOKEN"
```

### Permission-Based Access Control

```bash
# Try to access protected endpoint
curl -X GET http://localhost:3000/admin/users \
  -H "Authorization: Bearer $TOKEN"

# Response depends on user's permissions:
# - 200 OK if user has required permissions
# - 403 Forbidden if user lacks permissions
# - 401 Unauthorized if token is invalid
```

## Rate Limiting

All RBAC endpoints are subject to standard rate limiting:

- **Authenticated requests**: 100 requests per minute per user
- **Permission checks**: 1000 requests per minute per user (cached)
- **Role/permission modifications**: 20 requests per minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Caching

Permission data is cached to improve performance:

- **User permissions**: Cached for 5 minutes
- **Role permissions**: Cached for 10 minutes
- **Permission definitions**: Cached for 1 hour

Cache is automatically invalidated when:
- User roles are modified
- Role permissions are modified
- Permissions are created/deleted
- User is deleted

## Security Considerations

1. **Tenant Isolation**: All operations are automatically scoped to the user's tenant
2. **Permission Validation**: All permission assignments are validated for tenant consistency
3. **Audit Logging**: All RBAC operations are logged for security auditing
4. **Cascading Deletes**: Deleting roles/permissions automatically removes them from users
5. **Transaction Safety**: Multi-step operations use database transactions for consistency

This API provides comprehensive role-based access control with strong security guarantees and excellent performance through intelligent caching.