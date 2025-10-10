# Authentication API

The Authentication API provides endpoints for user authentication, Google OAuth integration, and account management.

## Base Path
```
/api/auth
```

## Endpoints

### POST /auth/login

Authenticate a user with email and password.

**Headers:**
- `x-tenant-id` (required): Tenant identifier
- `Content-Type: application/json`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400` - Missing tenant ID or invalid credentials
- `401` - Invalid email/password combination
- `429` - Rate limit exceeded (5 requests per minute)

**Rate Limit:** 5 requests per minute

---

### GET /auth/google

Initiate Google OAuth authentication flow.

**Headers:**
- `x-tenant-id` (required): Tenant identifier

**Response (200):**
```json
{
  "authUrl": "https://accounts.google.com/oauth/authorize?...",
  "state": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
}
```

**Error Responses:**
- `400` - Missing tenant ID
- `403` - Google SSO not enabled for tenant
- `429` - Rate limit exceeded (10 requests per minute)

**Rate Limit:** 10 requests per minute

---

### POST /auth/google/callback

Complete Google OAuth authentication flow.

**Request Body:**
```json
{
  "code": "authorization_code_from_google",
  "state": "state_parameter_from_initiation",
  "tenantId": "tenant_identifier"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `400` - Invalid callback data
- `401` - Invalid state or authorization code
- `403` - Google SSO not enabled or user not allowed
- `429` - Rate limit exceeded (10 requests per minute)

**Rate Limit:** 10 requests per minute

---

### GET /auth/google/link

Initiate Google account linking for authenticated users.

**Authentication:** Required (JWT Bearer token)

**Response (200):**
```json
{
  "authUrl": "https://accounts.google.com/oauth/authorize?...",
  "state": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
}
```

**Error Responses:**
- `401` - Authentication required
- `429` - Rate limit exceeded (5 requests per minute)

**Rate Limit:** 5 requests per minute

---

### POST /auth/google/link/callback

Complete Google account linking flow.

**Authentication:** Required (JWT Bearer token)

**Request Body:**
```json
{
  "code": "authorization_code_from_google",
  "state": "state_parameter_from_linking_initiation"
}
```

**Response (200):**
```json
{
  "message": "Google account linked successfully"
}
```

**Error Responses:**
- `400` - Invalid callback data or email mismatch
- `401` - Invalid state or authorization code
- `409` - Google account already linked to another user
- `429` - Rate limit exceeded (5 requests per minute)

**Rate Limit:** 5 requests per minute

---

### POST /auth/google/unlink

Unlink Google account from authenticated user.

**Authentication:** Required (JWT Bearer token)

**Response (200):**
```json
{
  "message": "Google account unlinked successfully"
}
```

**Error Responses:**
- `400` - Cannot unlink only authentication method
- `401` - Authentication required
- `404` - Google account not linked
- `429` - Rate limit exceeded (5 requests per minute)

**Rate Limit:** 5 requests per minute

---

### GET /auth/me/auth-methods

Get available authentication methods for the authenticated user.

**Authentication:** Required (JWT Bearer token)

**Response (200):**
```json
{
  "authMethods": ["password", "google"]
}
```

**Error Responses:**
- `401` - Authentication required
- `404` - User not found

## Authentication Flow Examples

### Standard Login Flow

1. **Login Request:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_123" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

2. **Use Token:**
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant_123"
```

### Google OAuth Flow

1. **Initiate OAuth:**
```bash
curl -X GET http://localhost:3000/api/auth/google \
  -H "x-tenant-id: tenant_123"
```

2. **User completes OAuth on Google's site**

3. **Complete OAuth:**
```bash
curl -X POST http://localhost:3000/api/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "google_auth_code",
    "state": "state_from_step_1",
    "tenantId": "tenant_123"
  }'
```

### Google Account Linking Flow

1. **Authenticate first:**
```bash
# Login with password first
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_123" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'
```

2. **Initiate linking:**
```bash
curl -X GET http://localhost:3000/api/auth/google/link \
  -H "Authorization: Bearer <jwt_token>"
```

3. **User completes OAuth on Google's site**

4. **Complete linking:**
```bash
curl -X POST http://localhost:3000/api/auth/google/link/callback \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "google_auth_code",
    "state": "state_from_linking_initiation"
  }'
```

## Security Considerations

- All OAuth flows use CSRF protection via state parameters
- JWT tokens have configurable expiration times
- Rate limiting prevents brute force attacks
- Google account linking requires email verification
- Users must maintain at least one authentication method

## Error Handling

All authentication endpoints return structured error responses:

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/auth/login"
}
```

Common error scenarios:
- Invalid credentials
- Expired or invalid state parameters
- Rate limit exceeded
- Google SSO disabled for tenant
- Account linking conflicts