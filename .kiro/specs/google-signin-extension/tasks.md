# Implementation Plan

- [x] 1. Set up project dependencies and environment configuration
  - Install Google OAuth dependencies (google-auth-library, googleapis)
  - Add Google OAuth environment variables to configuration
  - Update environment validation to include Google OAuth variables
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 2. Create database schema extensions
  - [x] 2.1 Create database migration for Google authentication fields
    - Add google_id, google_linked_at, auth_methods columns to users table
    - Add google_sso_enabled, google_auto_provision columns to tenants table
    - Add auth_method column to notification_audit_logs table
    - Create necessary indexes for performance
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.2 Update Prisma schema to reflect database changes
    - Extend User model with Google authentication fields
    - Extend Tenant model with Google SSO configuration fields
    - Update audit log model with auth_method field
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 2.3 Run database migration and regenerate Prisma client
    - Execute migration against database
    - Generate updated Prisma client with new schema
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 3. Implement core Google OAuth services
  - [x] 3.1 Create GoogleOAuthService for OAuth flow management
    - Implement OAuth2Client initialization with configuration
    - Create generateAuthUrl method for OAuth initiation
    - Implement exchangeCodeForTokens method for token exchange
    - Create verifyIdToken method for ID token validation
    - _Requirements: 1.1, 1.2, 1.3, 4.2, 4.3_

  - [x] 3.2 Create OAuthStateService for CSRF protection
    - Implement state generation with cryptographic randomness
    - Create Redis-based state storage with expiration
    - Implement state validation with cleanup
    - Add support for user-specific state for linking flows
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 3.3 Write unit tests for OAuth services
    - Test GoogleOAuthService methods with mocked Google API responses
    - Test OAuthStateService state generation, validation, and cleanup
    - Test error handling for invalid tokens and expired states
    - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.3, 4.6_

- [x] 4. Implement Google authentication business logic
  - [x] 4.1 Create GoogleAuthService for authentication workflows
    - Implement validateTenantGoogleSSO method for tenant validation
    - Create authenticateWithGoogle method for sign-in flow
    - Implement createUserFromGoogle method for new user creation
    - Add linkGoogleAccount method for account linking
    - Create unlinkGoogleAccount method with validation
    - Implement getUserAuthMethods method for auth method retrieval
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 4.2 Implement audit logging for Google authentication events
    - Extend existing audit service to support Google auth events
    - Log authentication, linking, and unlinking events with metadata
    - Include IP address, user agent, and success/failure status
    - _Requirements: 4.1, 4.7_

  - [x] 4.3 Write unit tests for GoogleAuthService
    - Test tenant validation and SSO configuration checks
    - Test user authentication with various scenarios (new user, existing user, auto-linking)
    - Test account linking and unlinking with validation logic
    - Test error handling for various failure scenarios
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 5. Create DTOs and validation classes
  - [x] 5.1 Create Google OAuth DTOs
    - Implement GoogleCallbackDto with validation decorators
    - Create GoogleLinkCallbackDto for linking flow
    - Add UpdateGoogleSettingsDto for tenant configuration
    - Create GoogleProfile interface for type safety
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 5.2 Write validation tests for DTOs
    - Test DTO validation with valid and invalid inputs
    - Verify required field validation and type checking
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 6. Extend authentication controller with Google OAuth endpoints
  - [x] 6.1 Add Google OAuth initiation endpoint
    - Implement GET /auth/google endpoint for OAuth flow initiation
    - Add tenant validation and Google SSO configuration check
    - Generate state parameter and OAuth URL
    - _Requirements: 1.1, 3.1, 3.6, 7.1_

  - [x] 6.2 Add Google OAuth callback endpoint
    - Implement POST /auth/google/callback for OAuth completion
    - Add state parameter validation and token exchange
    - Handle user authentication and JWT token generation
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.2, 4.3, 7.2_

  - [x] 6.3 Add Google account linking endpoints
    - Implement GET /auth/google/link for linking initiation
    - Add POST /auth/google/link/callback for linking completion
    - Include authentication guards and user validation
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 7.3, 7.4_

  - [x] 6.4 Add Google account management endpoints
    - Implement POST /auth/google/unlink for account unlinking
    - Add GET /auth/me/auth-methods for auth method retrieval
    - Include proper validation and error handling
    - _Requirements: 2.4, 2.5, 2.6, 7.5, 7.6_

  - [x] 6.5 Write controller unit tests
    - Test all new endpoints with various input scenarios
    - Mock service dependencies and verify proper calls
    - Test error handling and validation logic
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 7. Extend tenant controller with Google SSO configuration
  - [x] 7.1 Add Google settings retrieval endpoint
    - Implement GET /tenants/:id/settings/google for configuration retrieval
    - Add admin role guard and tenant validation
    - Return current Google SSO configuration
    - _Requirements: 3.1, 3.2_

  - [x] 7.2 Add Google settings update endpoint
    - Implement PATCH /tenants/:id/settings/google for configuration updates
    - Add validation for Google SSO and auto-provisioning settings
    - Include audit logging for configuration changes
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [x] 7.3 Write tenant controller tests
    - Test Google settings endpoints with admin and non-admin users
    - Verify proper validation and authorization
    - Test configuration update logic
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 8. Update authentication module configuration
  - [x] 8.1 Register new services in AuthModule
    - Add GoogleAuthService, GoogleOAuthService, OAuthStateService to providers
    - Export GoogleAuthService for use in other modules
    - Update module imports and dependencies
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 8.2 Add Google OAuth dependencies to package.json
    - Install google-auth-library and googleapis packages
    - Update package.json with correct versions
    - _Requirements: 1.1, 1.2, 1.3, 4.2, 4.3_

- [x] 9. Implement error handling and security measures
  - [x] 9.1 Create custom error classes for Google OAuth
    - Implement GoogleOAuthError with specific error codes
    - Create AccountLinkingError for linking-specific errors
    - Add proper error response formatting
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 9.2 Add rate limiting to Google OAuth endpoints
    - Configure rate limiting for authentication endpoints
    - Set appropriate limits for OAuth and linking flows
    - Add rate limiting for admin configuration endpoints
    - _Requirements: 4.5, 4.6_

  - [x] 9.3 Implement comprehensive audit logging
    - Log all Google authentication events with metadata
    - Include IP address, user agent, and tenant context
    - Add success/failure tracking and error codes
    - _Requirements: 4.1, 4.7_

- [x] 10. Create integration tests for complete flows
  - [x] 10.1 Write Google sign-in integration tests
    - Test complete OAuth flow from initiation to token generation
    - Test new user creation and existing user auto-linking
    - Test tenant validation and SSO configuration checks
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 10.2 Write account linking integration tests
    - Test complete linking flow with authenticated users
    - Test unlinking with validation of remaining auth methods
    - Test error scenarios for email mismatches and conflicts
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 10.3 Write multi-tenant isolation tests
    - Test cross-tenant access prevention
    - Verify tenant-specific Google SSO configuration
    - Test user authentication within correct tenant boundaries
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.7_

- [x] 11. Add monitoring and health checks
  - [x] 11.1 Create Google OAuth health check endpoint
    - Implement health check for Google OAuth configuration
    - Verify Google API connectivity and configuration validity
    - Add monitoring for OAuth service availability
    - _Requirements: 1.1, 1.2, 1.3, 4.2, 4.3_

  - [x] 11.2 Add metrics collection for Google authentication
    - Track Google sign-in attempts, successes, and failures
    - Monitor account linking and unlinking operations
    - Collect OAuth callback latency and tenant lookup performance
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 12. Update existing authentication flow compatibility
  - [x] 12.1 Ensure backward compatibility with existing auth
    - Verify existing email/password authentication remains unchanged
    - Test existing JWT token validation and generation
    - Ensure existing API clients continue to work without modification
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 12.2 Update user service to handle multiple auth methods
    - Modify user queries to handle auth_methods array
    - Update user creation logic to set appropriate auth methods
    - Ensure existing user data migration is handled correctly
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_