# Users API

The Users API provides endpoints for user management, role assignment, and permission management within a tenant.

## Base Path
```
/api/users
```

## Authentication
All endpoints require JWT authentication and appropriate permissions.

**Headers:**
- `Authorization: Bearer <jwt_token>` (required)
- `x-tenant-id: <tenant_id>` (required)

## Endpoints

### GET /users

List all users in the current tenant.

**Required Permission:** `read:user`

**Response (200):**
```json
[
  {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "tenantId": "tenant_123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "roles": [
      {
        "id": "role_123",
        "name": "Editor",
        "description": "Can edit content"
      }
    ]
  }
]
```

**Error Responses:**
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (missing `read:user` permission)

---

### GET /users/:id

Get a specific user with their roles and permissions.

**Required Permission:** `read:user`

**Path Parameters:**
- `id` (string): User ID

**Response (200):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "roles": [
    {
      "id": "role_123",
      "name": "Editor",
      "description": "Can edit content",
      "permissions": [
        {
          "id": "perm_123",
          "name": "read:user",
          "description": "Can read user data"
        }
      ]
    }
  ],
  "userPermissions": [
    {
      "id": "perm_456",
      "name": "special:access",
      "description": "Special access permission"
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:user` permission)
- `404` - User not found

---

### POST /users

Create a new user in the current tenant.

**Required Permission:** `create:user`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response (201):**
```json
{
  "id": "user_456",
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `create:user` permission)
- `409` - Conflict (email already exists)

**Validation Rules:**
- `email`: Must be a valid email address
- `password`: Minimum 8 characters
- `firstName`, `lastName`: Optional strings

---

### PUT /users/:id

Update user details.

**Required Permission:** `update:user`

**Path Parameters:**
- `id` (string): User ID

**Request Body:**
```json
{
  "firstName": "John Updated",
  "lastName": "Doe Updated"
}
```

**Response (200):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "firstName": "John Updated",
  "lastName": "Doe Updated",
  "tenantId": "tenant_123",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `update:user` permission)
- `404` - User not found

---

### PUT /users/:id/roles

Assign roles to a user (replaces existing roles).

**Required Permission:** `update:user`

**Path Parameters:**
- `id` (string): User ID

**Request Body:**
```json
{
  "roleIds": ["role_123", "role_456"]
}
```

**Response (200):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "roles": [
    {
      "id": "role_123",
      "name": "Editor",
      "description": "Can edit content"
    },
    {
      "id": "role_456",
      "name": "Viewer",
      "description": "Can view content"
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `update:user` permission)
- `404` - User or role not found

---

### PUT /users/:id/permissions

Assign user-specific permissions (replaces existing user permissions).

**Required Permission:** `update:user`

**Path Parameters:**
- `id` (string): User ID

**Request Body:**
```json
{
  "permissionIds": ["perm_123", "perm_456"]
}
```

**Response (200):**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "userPermissions": [
    {
      "id": "perm_123",
      "name": "special:access",
      "description": "Special access permission"
    },
    {
      "id": "perm_456",
      "name": "admin:override",
      "description": "Admin override permission"
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `update:user` permission)
- `404` - User or permission not found

---

### GET /users/:id/permissions

Get all effective permissions for a user (role-based + user-specific).

**Required Permission:** `read:user`

**Path Parameters:**
- `id` (string): User ID

**Response (200):**
```json
{
  "userId": "user_123",
  "effectivePermissions": [
    {
      "id": "perm_123",
      "name": "read:user",
      "description": "Can read user data",
      "source": "role",
      "sourceId": "role_123",
      "sourceName": "Editor"
    },
    {
      "id": "perm_456",
      "name": "special:access",
      "description": "Special access permission",
      "source": "user",
      "sourceId": "user_123",
      "sourceName": "Direct Assignment"
    }
  ]
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:user` permission)
- `404` - User not found

---

### DELETE /users/:id

Delete a user and all their role/permission assignments.

**Required Permission:** `delete:user`

**Path Parameters:**
- `id` (string): User ID

**Response (200):**
```json
{
  "message": "User deleted successfully",
  "deletedUserId": "user_123"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `delete:user` permission)
- `404` - User not found

## Usage Examples

### Create a New User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "firstName": "Jane",
    "lastName": "Smith"
  }'
```

### Assign Roles to User

```bash
curl -X PUT http://localhost:3000/api/users/user_123/roles \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["role_123", "role_456"]
  }'
```

### Get User's Effective Permissions

```bash
curl -X GET http://localhost:3000/api/users/user_123/permissions \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

## Permission System

The Users API integrates with the RBAC (Role-Based Access Control) system:

- **Role-based permissions**: Inherited from assigned roles
- **User-specific permissions**: Directly assigned to individual users
- **Effective permissions**: Combined set of all permissions from roles and direct assignments

### Permission Hierarchy

1. **Role Permissions**: Permissions granted through role membership
2. **User Permissions**: Permissions directly assigned to the user
3. **Effective Permissions**: Union of role and user permissions

## Tenant Isolation

All user operations are automatically scoped to the current tenant:
- Users can only see and manage users within their tenant
- Role and permission assignments are tenant-specific
- Cross-tenant access is prevented at the database level

## Error Handling

Standard error response format:

```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/users"
}
```

Common error scenarios:
- Missing required permissions
- User not found in current tenant
- Email conflicts during user creation
- Invalid role or permission IDs