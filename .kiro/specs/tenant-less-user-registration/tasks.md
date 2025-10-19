# Implementation Plan

- [x] 1. Database schema modifications for tenant-less users
  - [x] 1.1 Create database migration to make tenantId nullable
    - Make tenant_id column nullable in users table
    - Update unique constraints to handle null tenantId properly
    - Create separate unique indexes for tenant-bound and tenant-less users
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 1.2 Create user_tenants junction table for future multi-tenant support
    - Create user_tenants table with proper relationships
    - Add indexes for performance optimization
    - Set up foreign key constraints and cascading deletes
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 1.3 Update Prisma schema to reflect database changes
    - Make tenantId optional in User model
    - Add UserTenant model for junction table
    - Update relationships and constraints in schema
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 1.4 Run database migration and regenerate Prisma client
    - Execute migration against database
    - Generate updated Prisma client with new schema
    - Verify existing data integrity is maintained
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 2. Update authentication services for tenant-less users
  - [x] 2.1 Enhance AuthService to support tenant-less registration
    - Implement registerTenantlessUser method for email/password registration
    - Update login method to handle both tenant-less and tenant-specific authentication
    - Modify JWT token generation to support null tenantId
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 2.2 Enhance GoogleAuthService for tenant-less Google OAuth
    - Update authenticateWithGoogle to support tenant-less flow
    - Implement createTenantlessUserFromGoogle method
    - Modify token generation for tenant-less Google users
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 2.3 Update JWT payload interface and validation
    - Make tenantId nullable in JwtPayload interface
    - Update JWT strategy to handle null tenantId
    - Ensure JWT validation works for both tenant-less and tenant-bound users
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 2.4 Write unit tests for enhanced authentication services
    - Test tenant-less user registration with email/password
    - Test tenant-less Google OAuth authentication
    - Test JWT token generation and validation for null tenantId
    - Test backward compatibility with existing tenant-bound authentication
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 3. Implement tenant management service for post-registration tenant operations
  - [ ] 3.1 Create TenantManagementService
    - Implement createTenantForUser method for tenant creation
    - Create joinTenantForUser method for invitation acceptance
    - Add getUserTenantStatus method for tenant status retrieval
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 3.2 Implement tenant creation workflow
    - Validate tenant name uniqueness and format
    - Create tenant with default roles and permissions
    - Assign user as tenant admin with proper roles
    - Generate new JWT token with tenant context
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 3.3 Implement tenant joining workflow via invitations
    - Validate invitation token and expiration
    - Verify invitation email matches user email
    - Assign user to tenant with invitation-specified roles
    - Update user tenantId and generate new JWT token
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 3.4 Write unit tests for TenantManagementService
    - Test tenant creation for tenant-less users
    - Test invitation acceptance and tenant joining
    - Test error scenarios (user already has tenant, invalid invitations)
    - Test tenant status retrieval and available invitations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 4. Create DTOs and validation classes for tenant-less operations
  - [ ] 4.1 Create new DTOs for tenant-less registration and tenant management
    - Implement RegisterDto for tenant-less user registration
    - Create CreateTenantForUserDto for tenant creation
    - Add JoinTenantDto for invitation acceptance
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 4.2 Write validation tests for new DTOs
    - Test DTO validation with valid and invalid inputs
    - Verify required field validation and format checking
    - Test edge cases and boundary conditions
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [ ] 5. Update authentication controller for tenant-less flows
  - [ ] 5.1 Enhance AuthController with tenant-less registration
    - Add POST /auth/register endpoint for tenant-less registration
    - Update login endpoint to support both tenant-less and tenant-specific login
    - Modify Google OAuth endpoints to handle tenant-less authentication
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 7.1, 7.2_

  - [ ] 5.2 Update Google OAuth endpoints for tenant-less support
    - Modify GET /auth/google to support tenant-less OAuth initiation
    - Update GET /auth/google/callback to handle tenant-less user creation
    - Ensure backward compatibility with existing tenant-specific flows
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 7.1, 7.2, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ] 5.3 Write controller unit tests for enhanced authentication endpoints
    - Test tenant-less registration endpoint
    - Test enhanced login endpoint with both flows
    - Test Google OAuth endpoints for tenant-less users
    - Test error handling and validation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 7.1, 7.2, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 6. Create tenant management controller
  - [ ] 6.1 Implement TenantManagementController
    - Add POST /tenant-management/create endpoint for tenant creation
    - Create POST /tenant-management/join endpoint for invitation acceptance
    - Implement GET /tenant-management/status endpoint for tenant status
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 6.2 Add proper authentication and authorization guards
    - Ensure endpoints require authentication but not tenant membership
    - Add validation for tenant-less users only
    - Implement proper error handling and user feedback
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 6.3 Write controller unit tests for tenant management endpoints
    - Test tenant creation endpoint with various scenarios
    - Test invitation acceptance endpoint
    - Test tenant status endpoint
    - Test authorization and error handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [ ] 7. Update middleware and guards for tenant-less users
  - [ ] 7.1 Enhance TenantMiddleware to handle tenant-less requests
    - Update middleware to support both tenant-specific and tenant-less requests
    - Store tenant context appropriately for both scenarios
    - Ensure backward compatibility with existing tenant-bound flows
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ] 7.2 Create TenantRequiredGuard for tenant-specific endpoints
    - Implement guard that requires users to have tenant membership
    - Provide clear error messages for tenant-less users
    - Apply to endpoints that require tenant context
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 7.3 Update JwtAuthGuard to accept tenant-less users
    - Modify guard to accept both tenant-less and tenant-bound users
    - Ensure proper JWT validation for null tenantId
    - Maintain security while supporting flexible authentication
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 7.4 Write unit tests for updated middleware and guards
    - Test TenantMiddleware with both tenant-less and tenant-specific requests
    - Test TenantRequiredGuard behavior
    - Test JwtAuthGuard with null tenantId tokens
    - Test backward compatibility scenarios
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 8. Implement error handling and security measures
  - [ ] 8.1 Create custom error classes for tenant-less operations
    - Implement TenantRequiredError for tenant-specific endpoints
    - Create UserAlreadyHasTenantError for invalid tenant operations
    - Add TenantNameUnavailableError for tenant creation conflicts
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 8.2 Add rate limiting for tenant creation and joining
    - Implement rate limiting for tenant creation to prevent abuse
    - Add rate limiting for invitation acceptance
    - Configure appropriate limits for tenant management operations
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 8.3 Implement comprehensive audit logging for tenant-less operations
    - Log tenant-less user registration and authentication events
    - Track tenant creation and joining activities
    - Include appropriate context for tenant-less user activities
    - _Requirements: 4.5, 4.6, 4.7, 8.5, 8.6, 8.7_

- [ ] 9. Create integration tests for complete tenant-less flows
  - [ ] 9.1 Write tenant-less registration and tenant creation integration tests
    - Test complete flow from tenant-less registration to tenant creation
    - Test Google OAuth tenant-less registration and tenant setup
    - Test error scenarios and edge cases
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 9.2 Write invitation acceptance integration tests
    - Test complete flow from tenant-less user to invitation acceptance
    - Test invitation validation and tenant joining
    - Test multi-invitation scenarios
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 9.3 Write backward compatibility integration tests
    - Test existing tenant-bound user flows remain unchanged
    - Test existing API endpoints continue to work
    - Test mixed scenarios with both user types
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 10. Update existing services and controllers for compatibility
  - [ ] 10.1 Update existing services to handle nullable tenantId
    - Review and update services that query users by tenantId
    - Ensure proper handling of null tenantId in business logic
    - Update user-related queries and operations
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ] 10.2 Apply TenantRequiredGuard to appropriate endpoints
    - Identify endpoints that require tenant membership
    - Apply TenantRequiredGuard to tenant-specific operations
    - Ensure tenant-less users get appropriate error messages
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ] 10.3 Update user interface guidance and error messages
    - Provide clear guidance for tenant-less users
    - Update error messages to guide users to tenant creation/joining
    - Implement user experience improvements for onboarding flow
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 11. Add monitoring and health checks for tenant-less operations
  - [ ] 11.1 Create metrics for tenant-less user operations
    - Track tenant-less user registrations and conversions
    - Monitor tenant creation and joining success rates
    - Collect performance metrics for new workflows
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ] 11.2 Add health checks for tenant management operations
    - Implement health checks for tenant creation functionality
    - Monitor invitation system integration
    - Add alerts for tenant-less user conversion rates
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 12. Prepare for future multi-tenant user support
  - [ ] 12.1 Design user-tenant relationship management
    - Implement foundation for users belonging to multiple tenants
    - Create tenant switching mechanisms
    - Design active tenant context management
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ] 12.2 Create tenant context switching infrastructure
    - Implement JWT token generation with specific tenant context
    - Create tenant selection and switching endpoints
    - Design user interface for multi-tenant scenarios
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_