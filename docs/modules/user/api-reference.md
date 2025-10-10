# User API Reference

## Overview

The User API provides endpoints for managing user accounts within a tenant. All endpoints require JWT authentication and appropriate permissions. Users can only access and manage other users within their own tenant.

## Authentication

All endpoints require:
- **JWT Token**: `Authorization: Bearer <token>`
- **Tenant ID**: `x-tenant-id: <tenant-id>` header
- **Permissions**: Specific permissions as documented for each endpoint

## Endpoints

### List Users

**GET** `/users`

Retrieve all users in the current tenant.

#### Required Permissions
- `read:user`

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
      "id": "user-123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "tenantId": "tenant-456",
      "authMethods": ["password"],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "roles": [
        {
          "role": {
            "id": "role-789",
            "name": "User",
            "tenantId": "tenant-456"
          }
        }
      ]
    }
  ]
}
```

#### Error Responses
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `read:user` permission

---

### Get User by ID

**GET** `/users/{id}`

Retrieve a specific user with their roles and permissions.

#### Required Permissions
- `read:user`

#### Path Parameters
- `id` (string): User ID

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
```

#### Response
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": "tenant-456",
  "authMethods": ["password", "google"],
  "googleId": "google-user-id",
  "googleLinkedAt": "2024-01-01T00:00:00Z",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "roles": [
    {
      "role": {
        "id": "role-789",
        "name": "Admin",
        "permissions": [
          {
            "permission": {
              "id": "perm-123",
              "action": "create",
              "subject": "User"
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
        "action": "read",
        "subject": "Project"
      }
    }
  ]
}
```

#### Error Responses
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `read:user` permission
- **404 Not Found**: User not found in current tenant

---

### Create User

**POST** `/users`

Create a new user in the current tenant.

#### Required Permissions
- `create:user`

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
Content-Type: application/json
```

#### Request Body
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Smith"
}
```

#### Request Body Schema
- `email` (string, required): Valid email address
- `password` (string, required): Minimum 8 characters
- `firstName` (string, optional): User's first name
- `lastName` (string, optional): User's last name

#### Response
```json
{
  "id": "user-new",
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "tenantId": "tenant-456",
  "authMethods": ["password"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "roles": []
}
```

#### Error Responses
- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `create:user` permission
- **409 Conflict**: Email already exists in tenant

---

### Update User

**PUT** `/users/{id}`

Update user details.

#### Required Permissions
- `update:user`

#### Path Parameters
- `id` (string): User ID

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
Content-Type: application/json
```

#### Request Body
```json
{
  "email": "updated@example.com",
  "firstName": "Updated",
  "lastName": "Name"
}
```

#### Request Body Schema
- `email` (string, optional): Valid email address
- `firstName` (string, optional): User's first name
- `lastName` (string, optional): User's last name

#### Response
```json
{
  "id": "user-123",
  "email": "updated@example.com",
  "firstName": "Updated",
  "lastName": "Name",
  "tenantId": "tenant-456",
  "authMethods": ["password"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T12:00:00Z",
  "roles": [
    {
      "role": {
        "id": "role-789",
        "name": "User"
      }
    }
  ]
}
```

#### Error Responses
- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `update:user` permission
- **404 Not Found**: User not found in current tenant
- **409 Conflict**: Email already exists in tenant

---

### Assign Roles to User

**PUT** `/users/{id}/roles`

Replace user's roles with the provided role IDs.

#### Required Permissions
- `update:user`

#### Path Parameters
- `id` (string): User ID

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
Content-Type: application/json
```

#### Request Body
```json
{
  "roleIds": ["role-123", "role-456"]
}
```

#### Request Body Schema
- `roleIds` (string[], required): Array of role IDs to assign

#### Response
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": "tenant-456",
  "authMethods": ["password"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T12:00:00Z",
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
        "name": "Editor"
      }
    }
  ]
}
```

#### Error Responses
- **400 Bad Request**: Invalid role IDs or roles from different tenant
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `update:user` permission
- **404 Not Found**: User or role not found

---

### Assign Permissions to User

**PUT** `/users/{id}/permissions`

Grant user-specific permissions directly to a user.

#### Required Permissions
- `update:user`

#### Path Parameters
- `id` (string): User ID

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
Content-Type: application/json
```

#### Request Body
```json
{
  "permissionIds": ["perm-123", "perm-456"]
}
```

#### Request Body Schema
- `permissionIds` (string[], required): Array of permission IDs to assign

#### Response
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "tenantId": "tenant-456",
  "authMethods": ["password"],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T12:00:00Z",
  "permissions": [
    {
      "permission": {
        "id": "perm-123",
        "action": "read",
        "subject": "Project"
      }
    },
    {
      "permission": {
        "id": "perm-456",
        "action": "update",
        "subject": "Project"
      }
    }
  ]
}
```

#### Error Responses
- **400 Bad Request**: Invalid permission IDs or permissions from different tenant
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `update:user` permission
- **404 Not Found**: User or permission not found

---

### Get User Effective Permissions

**GET** `/users/{id}/permissions`

Get all effective permissions for a user (role-based + user-specific).

#### Required Permissions
- `read:user`

#### Path Parameters
- `id` (string): User ID

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
```

#### Response
```json
{
  "userId": "user-123",
  "email": "user@example.com",
  "effectivePermissions": [
    {
      "id": "perm-123",
      "action": "create",
      "subject": "User",
      "source": "role",
      "roleName": "Admin"
    },
    {
      "id": "perm-456",
      "action": "read",
      "subject": "Project",
      "source": "user"
    }
  ],
  "roleBasedPermissions": [
    {
      "id": "perm-123",
      "action": "create",
      "subject": "User",
      "source": "role",
      "roleName": "Admin"
    }
  ],
  "userSpecificPermissions": [
    {
      "id": "perm-456",
      "action": "read",
      "subject": "Project",
      "source": "user"
    }
  ]
}
```

#### Error Responses
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `read:user` permission
- **404 Not Found**: User not found in current tenant

---

### Delete User

**DELETE** `/users/{id}`

Delete a user and all their role/permission assignments.

#### Required Permissions
- `delete:user`

#### Path Parameters
- `id` (string): User ID

#### Request Headers
```http
Authorization: Bearer <jwt-token>
x-tenant-id: <tenant-id>
```

#### Response
```json
{
  "message": "User deleted successfully"
}
```

#### Error Responses
- **401 Unauthorized**: Missing or invalid JWT token
- **403 Forbidden**: Missing `delete:user` permission
- **404 Not Found**: User not found in current tenant

## Rate Limiting

User API endpoints are subject to tenant-level rate limiting to prevent abuse. The default limits are:
- 100 requests per minute per tenant for read operations
- 50 requests per minute per tenant for write operations

## Common Error Codes

- **400 Bad Request**: Invalid request data or validation errors
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Missing required permissions
- **404 Not Found**: Resource not found in current tenant
- **409 Conflict**: Resource already exists (e.g., duplicate email)
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error