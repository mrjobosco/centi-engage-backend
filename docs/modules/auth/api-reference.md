# Authentication API Reference

## Overview

This document provides comprehensive API reference for all authentication endpoints, including request/response schemas, authentication requirements, and error handling.

## Base URL

All authentication endpoints are prefixed with `/auth`.

## Authentication Requirements

Most endpoints require either:
- **Public Access**: No authentication required (marked with `@Public()`)
- **JWT Authentication**: Valid JWT token in `Authorization: Bearer <token>` header
- **Tenant Header**: `x-tenant-id` header for tenant identification

## Rate Limiting

All endpoints have rate limiting applied:
- **Login**: 5 requests per minute per IP
- **OAuth Operations**: 10 requests per minute per IP
- **Account Linking**: 5 requests per minute per IP

## Endpoints

### POST /auth/login

Authenticate a user with email and password.

**Authentication**: Public (no token required)  
**Rate Limit**: 5 requests/minute per IP  
**Tenant Required**: Yes (via `x-tenant-id` header)

#### Request

**Headers**:
```
Content-Type: application/json
x-tenant-id: string (required)
```

**Body**:
```typescript
{
  email: string;      // User's email address
  password: string;   // User's password
}
```

**Example**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### Response

**Success (200)**:
```typescript
{
  accessToken: string;  // JWT access token
}
```

**Example**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwidGVuYW50SWQiOiJ0ZW5hbnQtMTIzIiwicm9sZXMiOlsidXNlciJdLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
}
```

#### Error Responses

**400 Bad Request**:
```json
{
  "statusCode": 400,
  "message": "Tenant ID is required",
  "error": "Bad Request"
}
```

**401 Unauthorized**:
```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

**429 Too Many Requests**:
```json
{
  "statusCode": 429,
  "message": "Too many requests",
  "error": "Too Many Requests"
}
```

---

### GET /auth/google

Initiate Google OAuth authentication flow.

**Authentication**: Public  
**Rate Limit**: 10 requests/minute per IP  
**Tenant Required**: Yes (via `x-tenant-id` header)

#### Request

**Headers**:
```
x-tenant-id: string (required)
```

#### Response

**Success (200)**:
```typescript
{
  authUrl: string;  // Google OAuth authorization URL
  state: string;    // CSRF protection state parameter
}
```

**Example**:
```json
{
  "authUrl": "https://accounts.google.com/oauth/authorize?client_id=123&redirect_uri=callback&scope=email%20profile&state=abc123&response_type=code",
  "state": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz"
}
```

#### Error Responses

**400 Bad Request**:
```json
{
  "statusCode": 400,
  "message": "Tenant ID is required",
  "error": "Bad Request"
}
```

**403 Forbidden**:
```json
{
  "statusCode": 403,
  "message": "Google SSO not enabled for tenant",
  "error": "Forbidden"
}
```

---

### POST /auth/google/callback

Complete Google OAuth authentication flow.

**Authentication**: Public  
**Rate Limit**: 10 requests/minute per IP

#### Request

**Body**:
```typescript
{
  code: string;     // Authorization code from Google
  state: string;    // State parameter for CSRF protection
  tenantId: string; // Tenant identifier
}
```

**Example**:
```json
{
  "code": "4/0AX4XfWjYZ1234567890abcdef",
  "state": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
  "tenantId": "tenant-123"
}
```

#### Response

**Success (200)**:
```typescript
{
  accessToken: string;  // JWT access token
}
```

**Example**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Error Responses

**400 Bad Request**:
```json
{
  "statusCode": 400,
  "message": "Invalid or expired state parameter",
  "error": "Bad Request"
}
```

**401 Unauthorized**:
```json
{
  "statusCode": 401,
  "message": "Invalid Google token: Token verification failed",
  "error": "Unauthorized"
}
```

**403 Forbidden**:
```json
{
  "statusCode": 403,
  "message": "Google SSO not enabled for tenant",
  "error": "Forbidden"
}
```

---

### GET /auth/google/link

Initiate Google account linking for authenticated users.

**Authentication**: JWT Required  
**Rate Limit**: 5 requests/minute per IP

#### Request

**Headers**:
```
Authorization: Bearer <jwt-token>
```

#### Response

**Success (200)**:
```typescript
{
  authUrl: string;  // Google OAuth authorization URL
  state: string;    // State parameter with user ID
}
```

**Example**:
```json
{
  "authUrl": "https://accounts.google.com/oauth/authorize?client_id=123&redirect_uri=callback&scope=email%20profile&state=user123_abc456&response_type=code",
  "state": "user123_abc456def789ghi012jkl345mno678pqr901stu234vwx567yz"
}
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

---

### POST /auth/google/link/callback

Complete Google account linking flow.

**Authentication**: JWT Required  
**Rate Limit**: 5 requests/minute per IP

#### Request

**Headers**:
```
Authorization: Bearer <jwt-token>
```

**Body**:
```typescript
{
  code: string;   // Authorization code from Google
  state: string;  // State parameter with user ID
}
```

**Example**:
```json
{
  "code": "4/0AX4XfWjYZ1234567890abcdef",
  "state": "user123_abc456def789ghi012jkl345mno678pqr901stu234vwx567yz"
}
```

#### Response

**Success (200)**:
```typescript
{
  message: string;  // Success message
}
```

**Example**:
```json
{
  "message": "Google account linked successfully"
}
```

#### Error Responses

**400 Bad Request**:
```json
{
  "statusCode": 400,
  "message": "Invalid or expired state parameter",
  "error": "Bad Request"
}
```

**409 Conflict**:
```json
{
  "statusCode": 409,
  "message": "Google account already linked to another user",
  "error": "Conflict"
}
```

---

### POST /auth/google/unlink

Unlink Google account from authenticated user.

**Authentication**: JWT Required  
**Rate Limit**: 5 requests/minute per IP

#### Request

**Headers**:
```
Authorization: Bearer <jwt-token>
```

#### Response

**Success (200)**:
```typescript
{
  message: string;  // Success message
}
```

**Example**:
```json
{
  "message": "Google account unlinked successfully"
}
```

#### Error Responses

**400 Bad Request**:
```json
{
  "statusCode": 400,
  "message": "Cannot unlink only authentication method",
  "error": "Bad Request"
}
```

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Google account not linked",
  "error": "Not Found"
}
```

---

### GET /auth/me/auth-methods

Get available authentication methods for the authenticated user.

**Authentication**: JWT Required

#### Request

**Headers**:
```
Authorization: Bearer <jwt-token>
```

#### Response

**Success (200)**:
```typescript
{
  authMethods: string[];  // Array of available auth methods
}
```

**Example**:
```json
{
  "authMethods": ["password", "google"]
}
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

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "User not found",
  "error": "Not Found"
}
```

## JWT Token Structure

JWT tokens contain the following payload:

```typescript
interface JwtPayload {
  userId: string;    // User's unique identifier
  tenantId: string;  // Tenant identifier
  roles: string[];   // Array of role IDs
  iat: number;       // Issued at timestamp
  exp: number;       // Expiration timestamp
}
```

**Example Decoded Token**:
```json
{
  "userId": "user-123",
  "tenantId": "tenant-456",
  "roles": ["role-789", "role-012"],
  "iat": 1516239022,
  "exp": 1516242622
}
```

## Error Response Format

All error responses follow a consistent format:

```typescript
interface ErrorResponse {
  statusCode: number;    // HTTP status code
  message: string;       // Error message
  error: string;         // Error type
  timestamp?: string;    // ISO timestamp (optional)
  path?: string;         // Request path (optional)
}
```

## Rate Limiting Headers

Rate-limited endpoints include the following headers in responses:

```
X-RateLimit-Limit: 10              // Maximum requests allowed
X-RateLimit-Remaining: 7           // Remaining requests in window
X-RateLimit-Reset: 1516239082      // Reset time (Unix timestamp)
X-RateLimit-Operation: oauth_initiate  // Operation type
Retry-After: 45                    // Seconds to wait (on 429 only)
```

## Authentication Flow Examples

### Password Authentication Flow

```bash
# 1. Login with credentials
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant-123" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }'

# Response:
# {
#   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }

# 2. Use token for authenticated requests
curl -X GET http://localhost:3000/protected-endpoint \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Google OAuth Flow

```bash
# 1. Initiate OAuth flow
curl -X GET http://localhost:3000/auth/google \
  -H "x-tenant-id: tenant-123"

# Response:
# {
#   "authUrl": "https://accounts.google.com/oauth/authorize?...",
#   "state": "abc123..."
# }

# 2. User completes OAuth flow and returns with code

# 3. Exchange code for token
curl -X POST http://localhost:3000/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0AX4XfWjYZ1234567890abcdef",
    "state": "abc123...",
    "tenantId": "tenant-123"
  }'

# Response:
# {
#   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }
```

### Account Linking Flow

```bash
# 1. Initiate linking (authenticated)
curl -X GET http://localhost:3000/auth/google/link \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Response:
# {
#   "authUrl": "https://accounts.google.com/oauth/authorize?...",
#   "state": "user123_abc456..."
# }

# 2. User completes OAuth flow

# 3. Complete linking
curl -X POST http://localhost:3000/auth/google/link/callback \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "code": "4/0AX4XfWjYZ1234567890abcdef",
    "state": "user123_abc456..."
  }'

# Response:
# {
#   "message": "Google account linked successfully"
# }
```

## Security Considerations

### CSRF Protection
- All OAuth flows use state parameters for CSRF protection
- State parameters are validated on callback endpoints
- State parameters include user context for linking flows

### Rate Limiting
- Different limits for different operation types
- IP-based and tenant-based rate limiting
- Graceful degradation when rate limiting service is unavailable

### Token Security
- JWT tokens include tenant ID validation
- Tokens have configurable expiration times
- Token validation includes user existence checks

### Multi-Tenant Security
- All operations are tenant-isolated
- Cross-tenant access is prevented at multiple levels
- Tenant context is validated in JWT tokens