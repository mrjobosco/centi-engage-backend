# Manual Testing Guide

This guide provides step-by-step instructions for manually testing all critical flows of the multi-tenant NestJS application.

## Prerequisites

1. Ensure the database is running:
   ```bash
   # PostgreSQL should be running on localhost:5432
   ```

2. Start the application:
   ```bash
   npm run start:dev
   ```

3. The API will be available at: `http://localhost:3000`
4. Swagger documentation: `http://localhost:3000/api`

## Test Flow 1: Tenant Registration and Login

### 1.1 Register First Tenant

**Request:**
```bash
curl -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "subdomain": "acme",
    "adminEmail": "admin@acme.com",
    "adminPassword": "SecurePass123!"
  }'
```

**Expected Response:**
- Status: 201 Created
- Response should contain:
  - `tenant` object with `id`, `name`, `subdomain`
  - `admin` object with `id`, `email`, `firstName`, `lastName` (no password)
  - Admin should have "Admin" role assigned

**Verification:**
- ✅ Tenant created successfully
- ✅ Admin user created
- ✅ Default permissions created (create:project, read:project, etc.)
- ✅ Default roles created (Admin, Member)
- ✅ Admin role has all permissions
- ✅ Password is not returned in response

### 1.2 Login as Admin

**Request:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: <TENANT_ID_FROM_STEP_1>" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response:**
- Status: 200 OK
- Response should contain `accessToken` (JWT)

**Verification:**
- ✅ Login successful
- ✅ JWT token received
- ✅ Token can be decoded to show userId, tenantId, roles

**Save the token for subsequent requests:**
```bash
export ACME_TOKEN="<ACCESS_TOKEN>"
export ACME_TENANT_ID="<TENANT_ID>"
```

### 1.3 Test Invalid Login

**Request:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -d '{
    "email": "admin@acme.com",
    "password": "WrongPassword"
  }'
```

**Expected Response:**
- Status: 401 Unauthorized
- Error message: "Invalid credentials"

**Verification:**
- ✅ Invalid password rejected
- ✅ Generic error message (doesn't reveal if email exists)

## Test Flow 2: Permission System with Different Role Combinations

### 2.1 Create a Custom Permission

**Request:**
```bash
curl -X POST http://localhost:3000/permissions \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{
    "action": "manage",
    "subject": "invoice"
  }'
```

**Expected Response:**
- Status: 201 Created
- Permission object with `id`, `action`, `subject`, `tenantId`

**Verification:**
- ✅ Permission created successfully
- ✅ tenantId automatically set to current tenant

**Save the permission ID:**
```bash
export INVOICE_PERMISSION_ID="<PERMISSION_ID>"
```

### 2.2 Create a Custom Role

**Request:**
```bash
curl -X POST http://localhost:3000/roles \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{
    "name": "Accountant"
  }'
```

**Expected Response:**
- Status: 201 Created
- Role object with `id`, `name`, `tenantId`

**Save the role ID:**
```bash
export ACCOUNTANT_ROLE_ID="<ROLE_ID>"
```

**Verification:**
- ✅ Role created successfully
- ✅ tenantId automatically set

### 2.3 Assign Permissions to Role

**Request:**
```bash
curl -X PUT http://localhost:3000/roles/$ACCOUNTANT_ROLE_ID/permissions \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{
    "permissionIds": ["'$INVOICE_PERMISSION_ID'"]
  }'
```

**Expected Response:**
- Status: 200 OK
- Role object with permissions array

**Verification:**
- ✅ Permissions assigned to role
- ✅ Role now has the invoice permission

### 2.4 Create a New User

**Request:**
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{
    "email": "accountant@acme.com",
    "password": "SecurePass123!",
    "firstName": "Jane",
    "lastName": "Smith"
  }'
```

**Expected Response:**
- Status: 201 Created
- User object (without password)

**Save the user ID:**
```bash
export ACCOUNTANT_USER_ID="<USER_ID>"
```

**Verification:**
- ✅ User created successfully
- ✅ Password not in response
- ✅ tenantId automatically set

### 2.5 Assign Role to User

**Request:**
```bash
curl -X PUT http://localhost:3000/users/$ACCOUNTANT_USER_ID/roles \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{
    "roleIds": ["'$ACCOUNTANT_ROLE_ID'"]
  }'
```

**Expected Response:**
- Status: 200 OK
- User object with roles array

**Verification:**
- ✅ Role assigned to user
- ✅ User now has Accountant role

### 2.6 Login as New User

**Request:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -d '{
    "email": "accountant@acme.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response:**
- Status: 200 OK
- JWT token

**Save the token:**
```bash
export ACCOUNTANT_TOKEN="<ACCESS_TOKEN>"
```

**Verification:**
- ✅ New user can login
- ✅ JWT contains correct userId and tenantId

### 2.7 Test Permission-Based Access

**Try to create a project (should fail - no create:project permission):**
```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACCOUNTANT_TOKEN" \
  -d '{
    "name": "Test Project"
  }'
```

**Expected Response:**
- Status: 403 Forbidden
- Error: "Insufficient permissions"

**Verification:**
- ✅ User without permission is blocked

### 2.8 Grant User-Specific Permission

**As admin, grant create:project permission directly to accountant:**
```bash
# First, get the create:project permission ID
curl -X GET http://localhost:3000/permissions \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"

# Then assign it
curl -X PUT http://localhost:3000/users/$ACCOUNTANT_USER_ID/permissions \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{
    "permissionIds": ["<CREATE_PROJECT_PERMISSION_ID>"]
  }'
```

**Verification:**
- ✅ User-specific permission granted

### 2.9 Test Access After Permission Grant

**Try to create a project again (should succeed now):**
```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACCOUNTANT_TOKEN" \
  -d '{
    "name": "Accounting Project",
    "description": "Project for accounting tasks"
  }'
```

**Expected Response:**
- Status: 201 Created
- Project object

**Verification:**
- ✅ User can now create project with user-specific permission
- ✅ Project automatically scoped to tenant
- ✅ ownerId set to current user

### 2.10 Check Effective Permissions

**Request:**
```bash
curl -X GET http://localhost:3000/users/$ACCOUNTANT_USER_ID/permissions \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"
```

**Expected Response:**
- Status: 200 OK
- Object showing:
  - `roleBasedPermissions`: manage:invoice (from Accountant role)
  - `userSpecificPermissions`: create:project (directly assigned)
  - `effectivePermissions`: UNION of both

**Verification:**
- ✅ Effective permissions correctly calculated
- ✅ Source of each permission is indicated

## Test Flow 3: Tenant Isolation with Multiple Tenants

### 3.1 Register Second Tenant

**Request:**
```bash
curl -X POST http://localhost:3000/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Beta Industries",
    "subdomain": "beta",
    "adminEmail": "admin@beta.com",
    "adminPassword": "SecurePass123!"
  }'
```

**Expected Response:**
- Status: 201 Created
- New tenant and admin user

**Save the tenant ID:**
```bash
export BETA_TENANT_ID="<TENANT_ID>"
```

**Verification:**
- ✅ Second tenant created
- ✅ Has its own admin user
- ✅ Has its own default permissions and roles

### 3.2 Login to Second Tenant

**Request:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $BETA_TENANT_ID" \
  -d '{
    "email": "admin@beta.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response:**
- Status: 200 OK
- JWT token

**Save the token:**
```bash
export BETA_TOKEN="<ACCESS_TOKEN>"
```

**Verification:**
- ✅ Can login to second tenant
- ✅ JWT contains Beta tenant ID

### 3.3 Create Project in Second Tenant

**Request:**
```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $BETA_TENANT_ID" \
  -H "Authorization: Bearer $BETA_TOKEN" \
  -d '{
    "name": "Beta Project",
    "description": "Project for Beta Industries"
  }'
```

**Expected Response:**
- Status: 201 Created
- Project object

**Save the project ID:**
```bash
export BETA_PROJECT_ID="<PROJECT_ID>"
```

**Verification:**
- ✅ Project created in Beta tenant
- ✅ tenantId set to Beta

### 3.4 Test Cross-Tenant Access (Should Fail)

**Try to access Beta's project using Acme's token:**
```bash
curl -X GET http://localhost:3000/projects/$BETA_PROJECT_ID \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"
```

**Expected Response:**
- Status: 404 Not Found

**Verification:**
- ✅ Cross-tenant access blocked
- ✅ Returns 404 (not 403) to avoid information leakage

### 3.5 Test Wrong Tenant ID with Valid Token

**Try to use Acme token with Beta tenant ID:**
```bash
curl -X GET http://localhost:3000/projects \
  -H "x-tenant-id: $BETA_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"
```

**Expected Response:**
- Status: 403 Forbidden or 401 Unauthorized

**Verification:**
- ✅ Mismatched tenant ID and token rejected

### 3.6 List Projects in Each Tenant

**List Acme projects:**
```bash
curl -X GET http://localhost:3000/projects \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"
```

**List Beta projects:**
```bash
curl -X GET http://localhost:3000/projects \
  -H "x-tenant-id: $BETA_TENANT_ID" \
  -H "Authorization: Bearer $BETA_TOKEN"
```

**Verification:**
- ✅ Each tenant only sees their own projects
- ✅ No cross-tenant data leakage

### 3.7 Test User Isolation

**List users in Acme:**
```bash
curl -X GET http://localhost:3000/users \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"
```

**List users in Beta:**
```bash
curl -X GET http://localhost:3000/users \
  -H "x-tenant-id: $BETA_TENANT_ID" \
  -H "Authorization: Bearer $BETA_TOKEN"
```

**Verification:**
- ✅ Each tenant only sees their own users
- ✅ Acme users not visible to Beta and vice versa

### 3.8 Test Role and Permission Isolation

**List roles in each tenant:**
```bash
# Acme roles
curl -X GET http://localhost:3000/roles \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"

# Beta roles
curl -X GET http://localhost:3000/roles \
  -H "x-tenant-id: $BETA_TENANT_ID" \
  -H "Authorization: Bearer $BETA_TOKEN"
```

**Verification:**
- ✅ Each tenant has separate roles
- ✅ Custom roles in Acme (Accountant) not visible to Beta
- ✅ Both have default roles (Admin, Member)

## Test Flow 4: API Endpoints Verification

### 4.1 Test All User Endpoints

```bash
# GET /users - List all users
curl -X GET http://localhost:3000/users \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"

# GET /users/:id - Get specific user
curl -X GET http://localhost:3000/users/$ACCOUNTANT_USER_ID \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"

# PUT /users/:id - Update user
curl -X PUT http://localhost:3000/users/$ACCOUNTANT_USER_ID \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{
    "firstName": "Janet",
    "lastName": "Smith-Jones"
  }'

# DELETE /users/:id - Delete user (test with a test user)
# (Create a test user first, then delete)
```

**Verification:**
- ✅ All CRUD operations work
- ✅ All operations are tenant-scoped

### 4.2 Test All Role Endpoints

```bash
# GET /roles - List all roles
curl -X GET http://localhost:3000/roles \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"

# GET /roles/:id - Get specific role
curl -X GET http://localhost:3000/roles/$ACCOUNTANT_ROLE_ID \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"

# PUT /roles/:id - Update role
curl -X PUT http://localhost:3000/roles/$ACCOUNTANT_ROLE_ID \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{
    "name": "Senior Accountant"
  }'

# DELETE /roles/:id - Delete role (test with a test role)
```

**Verification:**
- ✅ All CRUD operations work
- ✅ All operations are tenant-scoped

### 4.3 Test All Permission Endpoints

```bash
# GET /permissions - List all permissions
curl -X GET http://localhost:3000/permissions \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"

# POST /permissions - Create permission (already tested)

# DELETE /permissions/:id - Delete permission (test with a test permission)
```

**Verification:**
- ✅ All operations work
- ✅ All operations are tenant-scoped

### 4.4 Test All Project Endpoints

```bash
# GET /projects - List all projects
curl -X GET http://localhost:3000/projects \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"

# GET /projects/:id - Get specific project
curl -X GET http://localhost:3000/projects/<PROJECT_ID> \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"

# PUT /projects/:id - Update project
curl -X PUT http://localhost:3000/projects/<PROJECT_ID> \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{
    "name": "Updated Project Name",
    "description": "Updated description"
  }'

# DELETE /projects/:id - Delete project
curl -X DELETE http://localhost:3000/projects/<PROJECT_ID> \
  -H "x-tenant-id: $ACME_TENANT_ID" \
  -H "Authorization: Bearer $ACME_TOKEN"
```

**Verification:**
- ✅ All CRUD operations work
- ✅ All operations are tenant-scoped
- ✅ ownerId automatically set on creation

## Test Summary Checklist

### Tenant Registration and Login
- [ ] Tenant registration creates all required records
- [ ] Default permissions and roles are created
- [ ] Admin user can login
- [ ] Invalid credentials are rejected
- [ ] Password is never returned in responses

### Permission System
- [ ] Custom permissions can be created
- [ ] Custom roles can be created
- [ ] Permissions can be assigned to roles
- [ ] Roles can be assigned to users
- [ ] User-specific permissions can be granted
- [ ] Permission checks work correctly
- [ ] Effective permissions are calculated correctly
- [ ] Users without permissions are blocked (403)

### Tenant Isolation
- [ ] Multiple tenants can be created
- [ ] Each tenant has separate data
- [ ] Cross-tenant access is blocked (404)
- [ ] Mismatched tenant ID and token is rejected
- [ ] Users only see data from their tenant
- [ ] Roles and permissions are tenant-scoped

### API Endpoints
- [ ] All user endpoints work correctly
- [ ] All role endpoints work correctly
- [ ] All permission endpoints work correctly
- [ ] All project endpoints work correctly
- [ ] All operations are properly authenticated
- [ ] All operations are properly authorized
- [ ] All operations are tenant-scoped

## Notes

- All tests should be performed with the application running in development mode
- Check the application logs for any errors or warnings
- Verify database state using a database client if needed
- Test with Swagger UI at http://localhost:3000/api for interactive testing
- Use Postman collection (postman_collection.json) for easier testing
