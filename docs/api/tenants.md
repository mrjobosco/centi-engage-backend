# Tenants API

The Tenants API provides endpoints for managing tenant information and tenant-related operations.

## Base Path
```
/api/tenants
```

## Authentication
All endpoints require JWT authentication and appropriate permissions.

**Headers:**
- `Authorization: Bearer <jwt_token>` (required)
- `x-tenant-id: <tenant_id>` (required for most operations)

## Endpoints

### GET /tenants/current

Get information about the current tenant (based on x-tenant-id header).

**Required Permission:** `read:tenant`

**Response (200):**
```json
{
  "id": "tenant_123",
  "name": "Acme Corporation",
  "subdomain": "acme",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "settings": {
    "googleSsoEnabled": true,
    "maxUsers": 100,
    "features": ["notifications", "projects", "analytics"]
  }
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:tenant` permission)
- `404` - Tenant not found

---

### PUT /tenants/current

Update current tenant information.

**Required Permission:** `update:tenant`

**Request Body:**
```json
{
  "name": "Acme Corporation Ltd",
  "subdomain": "acme-corp"
}
```

**Response (200):**
```json
{
  "id": "tenant_123",
  "name": "Acme Corporation Ltd",
  "subdomain": "acme-corp",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `update:tenant` permission)
- `409` - Conflict (subdomain already exists)

**Validation Rules:**
- `name` (optional): Tenant display name
- `subdomain` (optional): Unique subdomain identifier

---

### GET /tenants/current/users

Get all users in the current tenant.

**Required Permission:** `read:user`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `search` (optional): Search term for user names/emails
- `role` (optional): Filter by role name

**Response (200):**
```json
{
  "users": [
    {
      "id": "user_123",
      "email": "user@acme.com",
      "firstName": "John",
      "lastName": "Doe",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "roles": [
        {
          "id": "role_123",
          "name": "Editor"
        }
      ]
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10,
  "totalPages": 3
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:user` permission)

---

### GET /tenants/current/stats

Get statistics and metrics for the current tenant.

**Required Permission:** `read:tenant:stats`

**Response (200):**
```json
{
  "users": {
    "total": 45,
    "active": 42,
    "inactive": 3
  },
  "projects": {
    "total": 12,
    "active": 10,
    "completed": 2
  },
  "notifications": {
    "sent": 1250,
    "delivered": 1200,
    "failed": 50
  },
  "storage": {
    "used": "2.5GB",
    "limit": "10GB",
    "percentage": 25
  },
  "lastActivity": "2024-01-01T12:00:00.000Z"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:tenant:stats` permission)

---

### GET /tenants/current/settings

Get tenant configuration settings.

**Required Permission:** `read:tenant:settings`

**Response (200):**
```json
{
  "googleSso": {
    "enabled": true,
    "clientId": "google_client_id",
    "domain": "acme.com"
  },
  "notifications": {
    "emailEnabled": true,
    "smsEnabled": false,
    "defaultChannels": ["in_app", "email"]
  },
  "security": {
    "passwordPolicy": {
      "minLength": 8,
      "requireUppercase": true,
      "requireNumbers": true,
      "requireSymbols": false
    },
    "sessionTimeout": 3600,
    "maxLoginAttempts": 5
  },
  "features": {
    "projects": true,
    "notifications": true,
    "analytics": false,
    "customBranding": true
  },
  "limits": {
    "maxUsers": 100,
    "maxProjects": 50,
    "storageLimit": "10GB"
  }
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:tenant:settings` permission)

---

### PUT /tenants/current/settings

Update tenant configuration settings.

**Required Permission:** `update:tenant:settings`

**Request Body:**
```json
{
  "googleSso": {
    "enabled": false
  },
  "notifications": {
    "defaultChannels": ["in_app"]
  },
  "security": {
    "passwordPolicy": {
      "minLength": 10,
      "requireSymbols": true
    }
  }
}
```

**Response (200):**
```json
{
  "message": "Tenant settings updated successfully",
  "updatedSettings": {
    "googleSso": {
      "enabled": false
    },
    "notifications": {
      "defaultChannels": ["in_app"]
    },
    "security": {
      "passwordPolicy": {
        "minLength": 10,
        "requireSymbols": true
      }
    }
  }
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `update:tenant:settings` permission)
- `400` - Bad Request (invalid settings)

---

### POST /tenants/current/invite

Invite a new user to the current tenant.

**Required Permission:** `create:user`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "roleIds": ["role_123"],
  "sendInviteEmail": true
}
```

**Response (201):**
```json
{
  "invitation": {
    "id": "invite_123",
    "email": "newuser@example.com",
    "tenantId": "tenant_123",
    "invitedBy": "user_123",
    "expiresAt": "2024-01-08T00:00:00.000Z",
    "status": "pending"
  },
  "message": "Invitation sent successfully"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `create:user` permission)
- `409` - Conflict (user already exists or invited)

---

### GET /tenants/current/invitations

Get pending invitations for the current tenant.

**Required Permission:** `read:user`

**Response (200):**
```json
[
  {
    "id": "invite_123",
    "email": "newuser@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "tenantId": "tenant_123",
    "invitedBy": "user_123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "expiresAt": "2024-01-08T00:00:00.000Z",
    "status": "pending",
    "inviter": {
      "id": "user_123",
      "email": "admin@acme.com",
      "firstName": "Admin",
      "lastName": "User"
    }
  }
]
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `read:user` permission)

---

### DELETE /tenants/current/invitations/:id

Cancel a pending invitation.

**Required Permission:** `delete:user`

**Path Parameters:**
- `id` (string): Invitation ID

**Response (200):**
```json
{
  "message": "Invitation cancelled successfully",
  "cancelledInvitationId": "invite_123"
}
```

**Error Responses:**
- `401` - Unauthorized
- `403` - Forbidden (missing `delete:user` permission)
- `404` - Invitation not found

## Usage Examples

### Get Current Tenant Information

```bash
curl -X GET http://localhost:3000/api/tenants/current \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

### Update Tenant Settings

```bash
curl -X PUT http://localhost:3000/api/tenants/current/settings \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "googleSso": {
      "enabled": true
    },
    "security": {
      "passwordPolicy": {
        "minLength": 12
      }
    }
  }'
```

### Invite New User

```bash
curl -X POST http://localhost:3000/api/tenants/current/invite \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "roleIds": ["role_123"],
    "sendInviteEmail": true
  }'
```

### Get Tenant Statistics

```bash
curl -X GET http://localhost:3000/api/tenants/current/stats \
  -H "Authorization: Bearer <jwt_token>" \
  -H "x-tenant-id: tenant_123"
```

## Tenant Isolation

### Data Isolation
- All tenant operations are automatically scoped to the current tenant
- Cross-tenant data access is prevented at the database level
- Tenant context is established through middleware

### Resource Limits
- Each tenant has configurable resource limits
- Limits are enforced at the API level
- Exceeded limits result in appropriate error responses

### Security Isolation
- Tenant-specific authentication settings
- Isolated permission systems
- Separate encryption keys per tenant (where applicable)

## Tenant Settings

### Google SSO Configuration
```json
{
  "googleSso": {
    "enabled": true,
    "clientId": "google_oauth_client_id",
    "clientSecret": "google_oauth_client_secret",
    "domain": "company.com",
    "autoCreateUsers": true,
    "defaultRole": "role_viewer"
  }
}
```

### Notification Settings
```json
{
  "notifications": {
    "emailEnabled": true,
    "smsEnabled": false,
    "defaultChannels": ["in_app", "email"],
    "emailProvider": "aws_ses",
    "smsProvider": "twilio",
    "templates": {
      "welcome": "custom_welcome_template",
      "invitation": "custom_invitation_template"
    }
  }
}
```

### Security Settings
```json
{
  "security": {
    "passwordPolicy": {
      "minLength": 8,
      "maxLength": 128,
      "requireUppercase": true,
      "requireLowercase": true,
      "requireNumbers": true,
      "requireSymbols": false,
      "preventReuse": 5
    },
    "sessionTimeout": 3600,
    "maxLoginAttempts": 5,
    "lockoutDuration": 900,
    "requireMfa": false,
    "allowedIpRanges": []
  }
}
```

### Feature Flags
```json
{
  "features": {
    "projects": true,
    "notifications": true,
    "analytics": false,
    "customBranding": true,
    "apiAccess": true,
    "webhooks": false,
    "sso": true,
    "auditLogs": true
  }
}
```

## Tenant Lifecycle

### Tenant Creation
1. Tenant is created through registration process
2. Default settings are applied
3. Admin user is created and assigned
4. Initial roles and permissions are set up

### Tenant Configuration
1. Admin configures tenant settings
2. SSO integration is set up (if needed)
3. Notification providers are configured
4. Feature flags are enabled/disabled

### User Management
1. Users are invited to the tenant
2. Roles and permissions are assigned
3. User access is managed within tenant boundaries

### Tenant Deactivation
1. Tenant can be deactivated (future feature)
2. All user access is revoked
3. Data is retained according to retention policy

## Error Handling

Standard error response format:

```json
{
  "statusCode": 403,
  "message": "Insufficient permissions to access tenant settings",
  "error": "Forbidden",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/tenants/current/settings"
}
```

Common error scenarios:
- Missing tenant permissions
- Invalid tenant settings
- Resource limit exceeded
- Subdomain conflicts
- Invalid invitation data