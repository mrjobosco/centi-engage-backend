# API Examples

This document provides comprehensive examples of API usage for the Multi-Tenant NestJS Starter application.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication Flow](#authentication-flow)
3. [User Management](#user-management)
4. [Role Management](#role-management)
5. [Permission Management](#permission-management)
6. [Project Management](#project-management)
7. [Complete Workflows](#complete-workflows)

## Getting Started

### Base URL

```
http://localhost:3000/api
```

### Required Headers

All authenticated requests require:
- `Authorization: Bearer <access_token>`
- `x-tenant-id: <tenant_id>`

## Authentication Flow

### 1. Register a New Tenant

Create a new tenant with an admin user, default roles, and permissions.

**Request:**
```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Acme Corporation",
    "adminEmail": "admin@acme.com",
    "adminPassword": "SecurePass123!",
    "adminFirstName": "John",
    "adminLastName": "Doe"
  }'
```

**Response:**
```json
{
  "message": "Tenant created successfully",
  "data": {
    "tenant": {
      "id": "clx1234567890",
      "name": "Acme Corporation",
      "subdomain": null,
      "createdAt": "2025-05-10T12:00:00.000Z",
      "updatedAt": "2025-05-10T12:00:00.000Z"
    },
    "adminUser": {
      "id": "clx0987654321",
      "email": "admin@acme.com",
      "firstName": "John",
      "lastName": "Doe",
      "tenantId": "clx1234567890",
      "createdAt": "2025-05-10T12:00:00.000Z",
      "updatedAt": "2025-05-10T12:00:00.000Z"
    }
  }
}
```

**Save these values:**
- `tenantId`: clx1234567890
- `userId`: clx0987654321

### 2. Login

Authenticate and receive a JWT access token.

**Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePass123!"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbHgwOTg3NjU0MzIxIiwidGVuYW50SWQiOiJjbHgxMjM0NTY3ODkwIiwicm9sZXMiOlsiY2x4cm9sZTEyMyJdLCJpYXQiOjE3MTU0MzI0MDAsImV4cCI6MTcxNTQzMzMwMH0.signature"
}
```

**Save the access token for subsequent requests.**

## User Management

### List All Users

**Request:**
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

**Response:**
```json
[
  {
    "id": "clx0987654321",
    "email": "admin@acme.com",
    "firstName": "John",
    "lastName": "Doe",
    "tenantId": "clx1234567890",
    "createdAt": "2025-05-10T12:00:00.000Z",
    "updatedAt": "2025-05-10T12:00:00.000Z",
    "roles": [
      {
        "id": "clxrole123",
        "name": "Admin"
      }
    ]
  }
]
```

### Get User by ID

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/clx0987654321 \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

### Create a New User

**Request:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "email": "user@acme.com",
    "password": "UserPass123!",
    "firstName": "Jane",
    "lastName": "Smith"
  }'
```

**Response:**
```json
{
  "id": "clxuser456",
  "email": "user@acme.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "tenantId": "clx1234567890",
  "createdAt": "2025-05-10T12:05:00.000Z",
  "updatedAt": "2025-05-10T12:05:00.000Z"
}
```

### Update User

**Request:**
```bash
curl -X PUT http://localhost:3000/api/users/clxuser456 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "firstName": "Janet",
    "lastName": "Johnson"
  }'
```

### Assign Roles to User

**Request:**
```bash
curl -X PUT http://localhost:3000/api/users/clxuser456/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "roleIds": ["clxrole789"]
  }'
```

### Assign User-Specific Permissions

**Request:**
```bash
curl -X PUT http://localhost:3000/api/users/clxuser456/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "permissionIds": ["clxperm111", "clxperm222"]
  }'
```

### Get User Effective Permissions

Get all permissions for a user (role-based + user-specific).

**Request:**
```bash
curl -X GET http://localhost:3000/api/users/clxuser456/permissions \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

**Response:**
```json
{
  "rolePermissions": [
    {
      "id": "clxperm001",
      "action": "read",
      "subject": "project",
      "source": "role",
      "roleName": "Member"
    }
  ],
  "userPermissions": [
    {
      "id": "clxperm111",
      "action": "create",
      "subject": "project",
      "source": "user"
    }
  ],
  "effectivePermissions": [
    "read:project",
    "create:project"
  ]
}
```

### Delete User

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/users/clxuser456 \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

## Role Management

### List All Roles

**Request:**
```bash
curl -X GET http://localhost:3000/api/roles \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

**Response:**
```json
[
  {
    "id": "clxrole123",
    "name": "Admin",
    "tenantId": "clx1234567890",
    "createdAt": "2025-05-10T12:00:00.000Z",
    "updatedAt": "2025-05-10T12:00:00.000Z"
  },
  {
    "id": "clxrole456",
    "name": "Member",
    "tenantId": "clx1234567890",
    "createdAt": "2025-05-10T12:00:00.000Z",
    "updatedAt": "2025-05-10T12:00:00.000Z"
  }
]
```

### Get Role by ID

**Request:**
```bash
curl -X GET http://localhost:3000/api/roles/clxrole123 \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

**Response:**
```json
{
  "id": "clxrole123",
  "name": "Admin",
  "tenantId": "clx1234567890",
  "permissions": [
    {
      "id": "clxperm001",
      "action": "create",
      "subject": "project"
    },
    {
      "id": "clxperm002",
      "action": "read",
      "subject": "project"
    }
  ]
}
```

### Create a New Role

**Request:**
```bash
curl -X POST http://localhost:3000/api/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "name": "Project Manager"
  }'
```

**Response:**
```json
{
  "id": "clxrole789",
  "name": "Project Manager",
  "tenantId": "clx1234567890",
  "createdAt": "2025-05-10T12:10:00.000Z",
  "updatedAt": "2025-05-10T12:10:00.000Z"
}
```

### Update Role

**Request:**
```bash
curl -X PUT http://localhost:3000/api/roles/clxrole789 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "name": "Senior Project Manager"
  }'
```

### Update Role Permissions

Replace all permissions for a role.

**Request:**
```bash
curl -X PUT http://localhost:3000/api/roles/clxrole789/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "permissionIds": ["clxperm001", "clxperm002", "clxperm003"]
  }'
```

### Delete Role

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/roles/clxrole789 \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

## Permission Management

### List All Permissions

**Request:**
```bash
curl -X GET http://localhost:3000/api/permissions \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

**Response:**
```json
[
  {
    "id": "clxperm001",
    "action": "create",
    "subject": "project",
    "tenantId": "clx1234567890",
    "createdAt": "2025-05-10T12:00:00.000Z",
    "updatedAt": "2025-05-10T12:00:00.000Z"
  },
  {
    "id": "clxperm002",
    "action": "read",
    "subject": "project",
    "tenantId": "clx1234567890",
    "createdAt": "2025-05-10T12:00:00.000Z",
    "updatedAt": "2025-05-10T12:00:00.000Z"
  }
]
```

### Create a New Permission

**Request:**
```bash
curl -X POST http://localhost:3000/api/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "action": "export",
    "subject": "report"
  }'
```

**Response:**
```json
{
  "id": "clxperm999",
  "action": "export",
  "subject": "report",
  "tenantId": "clx1234567890",
  "createdAt": "2025-05-10T12:15:00.000Z",
  "updatedAt": "2025-05-10T12:15:00.000Z"
}
```

### Delete Permission

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/permissions/clxperm999 \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

## Project Management

### List All Projects

**Request:**
```bash
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

**Response:**
```json
[
  {
    "id": "clxproj001",
    "name": "My First Project",
    "description": "A sample project",
    "tenantId": "clx1234567890",
    "ownerId": "clx0987654321",
    "createdAt": "2025-05-10T12:20:00.000Z",
    "updatedAt": "2025-05-10T12:20:00.000Z"
  }
]
```

### Get Project by ID

**Request:**
```bash
curl -X GET http://localhost:3000/api/projects/clxproj001 \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

### Create a New Project

**Request:**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "name": "My First Project",
    "description": "A sample project for testing"
  }'
```

**Response:**
```json
{
  "id": "clxproj001",
  "name": "My First Project",
  "description": "A sample project for testing",
  "tenantId": "clx1234567890",
  "ownerId": "clx0987654321",
  "createdAt": "2025-05-10T12:20:00.000Z",
  "updatedAt": "2025-05-10T12:20:00.000Z"
}
```

### Update Project

**Request:**
```bash
curl -X PUT http://localhost:3000/api/projects/clxproj001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "name": "Updated Project Name",
    "description": "Updated description"
  }'
```

### Delete Project

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/projects/clxproj001 \
  -H "Authorization: Bearer <access_token>" \
  -H "x-tenant-id: clx1234567890"
```

## Complete Workflows

### Workflow 1: Onboard a New Tenant and Create Resources

```bash
# Step 1: Register tenant
TENANT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Acme Corp",
    "adminEmail": "admin@acme.com",
    "adminPassword": "SecurePass123!",
    "adminFirstName": "John",
    "adminLastName": "Doe"
  }')

TENANT_ID=$(echo $TENANT_RESPONSE | jq -r '.data.tenant.id')

# Step 2: Login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePass123!"
  }')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')

# Step 3: Create a project
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "name": "My First Project",
    "description": "Getting started"
  }'
```

### Workflow 2: Create Custom Role with Permissions

```bash
# Assume you have TENANT_ID and ACCESS_TOKEN from login

# Step 1: Create custom permission
PERM_RESPONSE=$(curl -s -X POST http://localhost:3000/api/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "action": "export",
    "subject": "report"
  }')

PERM_ID=$(echo $PERM_RESPONSE | jq -r '.id')

# Step 2: Create role
ROLE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "name": "Report Manager"
  }')

ROLE_ID=$(echo $ROLE_RESPONSE | jq -r '.id')

# Step 3: Assign permission to role
curl -X PUT http://localhost:3000/api/roles/$ROLE_ID/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d "{
    \"permissionIds\": [\"$PERM_ID\"]
  }"
```

### Workflow 3: Create User and Assign Role

```bash
# Assume you have TENANT_ID, ACCESS_TOKEN, and ROLE_ID

# Step 1: Create user
USER_RESPONSE=$(curl -s -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{
    "email": "user@acme.com",
    "password": "UserPass123!",
    "firstName": "Jane",
    "lastName": "Smith"
  }')

USER_ID=$(echo $USER_RESPONSE | jq -r '.id')

# Step 2: Assign role to user
curl -X PUT http://localhost:3000/api/users/$USER_ID/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d "{
    \"roleIds\": [\"$ROLE_ID\"]
  }"

# Step 3: Verify user's effective permissions
curl -X GET http://localhost:3000/api/users/$USER_ID/permissions \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
```

### Workflow 4: Grant User-Specific Permission Override

```bash
# Assume you have TENANT_ID, ACCESS_TOKEN, USER_ID, and PERM_ID

# Grant user-specific permission (bypassing role)
curl -X PUT http://localhost:3000/api/users/$USER_ID/permissions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-tenant-id: $TENANT_ID" \
  -d "{
    \"permissionIds\": [\"$PERM_ID\"]
  }"

# Verify effective permissions now include both role and user-specific
curl -X GET http://localhost:3000/api/users/$USER_ID/permissions \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-tenant-id: $TENANT_ID"
```

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["email must be an email"],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Forbidden - Missing required permission: create:project",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "Email already exists for this tenant",
  "error": "Conflict"
}
```

## Notes

- All timestamps are in ISO 8601 format
- IDs use CUID format for security and uniqueness
- Cross-tenant access attempts return 404 (not 403) to prevent information leakage
- JWT tokens expire after 15 minutes by default (configurable)
- All queries are automatically scoped to the tenant via Prisma middleware
