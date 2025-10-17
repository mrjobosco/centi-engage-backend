# Design Document

## Overview

The comprehensive Postman collection will be a complete replacement for the existing postman_collection.json file. It will include all API endpoints discovered through code analysis, organized into logical folders with proper environment variable management, test scripts, and realistic example data. The collection will support both development and production environments with proper authentication flows and tenant isolation.

## Architecture

### Collection Structure
```
Multi-Tenant NestJS API/
├── Environment Setup/
│   ├── Health Checks/
│   └── Configuration Tests/
├── Authentication/
│   ├── Basic Auth/
│   ├── Google OAuth Flow/
│   ├── Account Linking/
│   └── Auth Management/
├── Tenant Management/
│   ├── Tenant Registration/
│   └── Google SSO Settings/
├── User Management/
│   ├── CRUD Operations/
│   ├── Role Assignment/
│   └── Permission Management/
├── Role & Permission System/
│   ├── Role Management/
│   └── Permission Management/
├── Project Management/
│   └── CRUD Operations/
├── Notification System/
│   ├── Notification CRUD/
│   ├── Notification Preferences/
│   ├── Broadcasting/
│   └── Privacy Controls/
└── System Monitoring/
    ├── Queue Monitoring/
    ├── Alert Management/
    └── Health Checks/
```

### Environment Variables
- `baseUrl`: API base URL (http://localhost:3000/api for dev)
- `tenantId`: Current tenant identifier
- `accessToken`: JWT authentication token
- `userId`: Current user ID
- `roleId`: Role ID for testing
- `permissionId`: Permission ID for testing
- `projectId`: Project ID for testing
- `notificationId`: Notification ID for testing
- `googleAuthUrl`: Google OAuth authorization URL
- `googleState`: OAuth state parameter

## Components and Interfaces

### Authentication Flow Components

#### Basic Authentication
- **Login Endpoint**: POST /auth/login
  - Captures JWT token automatically
  - Sets tenant context
  - Validates credentials

#### Google OAuth Flow
- **Initiate OAuth**: GET /auth/google
  - Generates authorization URL
  - Captures state parameter
  - Validates tenant Google SSO settings
- **OAuth Callback**: POST /auth/google/callback
  - Exchanges authorization code for JWT
  - Handles authentication completion
- **Account Linking**: GET /auth/google/link + POST /auth/google/link/callback
  - Links Google account to existing user
  - Validates email matching
- **Account Management**: POST /auth/google/unlink, GET /auth/me/auth-methods
  - Manages authentication methods
  - Provides user auth status

### Notification System Components

#### Core Notification Operations
- **Create Notification**: POST /notifications
- **Get User Notifications**: GET /notifications
- **Get Notification by ID**: GET /notifications/:id
- **Mark as Read**: PATCH /notifications/:id/read
- **Mark All as Read**: PATCH /notifications/read-all
- **Delete Notification**: DELETE /notifications/:id
- **Get Unread Count**: GET /notifications/unread-count

#### Broadcasting and Admin Operations
- **Tenant Broadcast**: POST /notifications/tenant-broadcast
  - Admin-only endpoint
  - Sends to all tenant users
  - Rate limited for tenant-wide operations

#### Preference Management
- **Get User Preferences**: GET /notification-preferences
- **Get Available Categories**: GET /notification-preferences/categories
- **Update Category Preferences**: PUT /notification-preferences/:category

### Monitoring and Health Components

#### Health Checks
- **Google OAuth Health**: GET /health/google-oauth
- **OAuth Status Check**: GET /health/google-oauth/status
- **Application Health**: GET / (root endpoint)

#### System Monitoring (Admin Only)
- **Queue Statistics**: GET /monitoring/queue-stats
- **Alert Configuration**: GET /monitoring/alert-config
- **Alert History**: GET /monitoring/alert-history
- **Test Alert**: POST /monitoring/test-alert
- **Check Alerts**: POST /monitoring/check-alerts

## Data Models

### Request/Response Examples

#### Authentication Request
```json
{
  "email": "admin@acme.com",
  "password": "SecurePass123!"
}
```

#### Notification Creation
```json
{
  "type": "INFO",
  "category": "system",
  "title": "Welcome to the platform",
  "message": "Your account has been successfully created.",
  "channels": ["IN_APP", "EMAIL"],
  "data": {
    "actionUrl": "/dashboard",
    "priority": "normal"
  },
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

#### Preference Update
```json
{
  "inAppEnabled": true,
  "emailEnabled": false,
  "smsEnabled": true
}
```

### Environment Variable Chaining

The collection will implement automatic variable capture:
- Login responses capture `accessToken`
- Resource creation captures relevant IDs
- OAuth flow captures `googleAuthUrl` and `googleState`
- Tenant operations capture `tenantId`

## Error Handling

### Response Validation Scripts
Each request will include basic test scripts:
```javascript
// Status code validation
pm.test("Status code is successful", function () {
    pm.expect(pm.response.code).to.be.oneOf([200, 201, 204]);
});

// Response time validation
pm.test("Response time is less than 2000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});

// Content type validation
pm.test("Content-Type is application/json", function () {
    pm.expect(pm.response.headers.get("Content-Type")).to.include("application/json");
});
```

### Authentication Error Handling
- 401 responses for missing/invalid tokens
- 403 responses for insufficient permissions
- 400 responses for missing tenant headers

### Rate Limiting Awareness
- Include rate limiting information in descriptions
- Provide guidance on throttling limits
- Document retry strategies

## Testing Strategy

### Test Categories

#### Smoke Tests
- Basic connectivity tests
- Health check validations
- Authentication flow verification

#### Functional Tests
- CRUD operations for all resources
- Permission and role assignments
- Notification delivery and preferences

#### Integration Tests
- End-to-end user workflows
- Multi-tenant isolation verification
- OAuth integration flows

#### Performance Tests
- Rate limiting validation
- Bulk operation testing
- Concurrent request handling

### Test Data Management

#### Realistic Test Data
- Use consistent naming conventions
- Include edge cases and validation scenarios
- Provide both valid and invalid examples

#### Data Cleanup
- Include cleanup requests where appropriate
- Document data dependencies
- Provide reset/initialization sequences

## Security Considerations

### Authentication Requirements
- All protected endpoints require Bearer token
- Tenant isolation through x-tenant-id header
- Admin endpoints require elevated permissions

### Sensitive Data Handling
- No hardcoded credentials in collection
- Use environment variables for all secrets
- Mask sensitive data in examples

### Rate Limiting Compliance
- Respect documented rate limits
- Include throttling information
- Provide guidance on production usage

## Documentation Integration

### Request Documentation
- Clear descriptions for each endpoint
- Parameter explanations and examples
- Response schema documentation

### Workflow Documentation
- Step-by-step authentication flows
- Common usage patterns
- Troubleshooting guides

### Environment Setup
- Development environment configuration
- Production environment guidelines
- Variable configuration instructions