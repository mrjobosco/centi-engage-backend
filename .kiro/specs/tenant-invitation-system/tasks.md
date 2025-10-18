# Implementation Plan

- [x] 1. Set up database schema and models
  - Create Prisma schema extensions for TenantInvitation, TenantInvitationRole, and InvitationAuditLog models
  - Generate and run database migration to create new tables with proper indexes and constraints
  - Update existing User and Role models to include invitation relationships
  - _Requirements: 1.1, 2.2, 3.2, 6.2_

- [x] 2. Implement core invitation data models and enums
  - Create InvitationStatus enum with PENDING, ACCEPTED, EXPIRED, CANCELLED values
  - Implement TenantInvitation entity interface with all required fields and relationships
  - Create DTOs for CreateInvitationDto, InvitationAcceptanceDto, and InvitationFilterDto
  - _Requirements: 1.1, 2.1, 3.1, 5.4_

- [-] 3. Build invitation service layer
  - [x] 3.1 Implement InvitationService with core business logic
    - Create invitation creation method with token generation using crypto.randomBytes
    - Implement invitation validation logic with expiration and status checks
    - Add role assignment validation to ensure roles belong to the same tenant
    - _Requirements: 1.1, 2.2, 3.1, 6.1_

  - [x] 3.2 Implement InvitationValidationService for security
    - Create secure token validation with cryptographic verification
    - Implement expiration checking and status validation logic
    - Add audit logging for all validation attempts and security events
    - _Requirements: 6.1, 6.3, 6.4_

  - [ ] 3.3 Write unit tests for invitation services
    - Test invitation creation with various role combinations
    - Test token validation scenarios including expired and invalid tokens
    - Test security measures and rate limiting enforcement
    - _Requirements: 1.1, 2.2, 3.1, 6.1_

- [x] 4. Create invitation management controllers
  - [x] 4.1 Implement InvitationController for admin operations
    - Create POST /invitations endpoint with permission guards and validation
    - Implement GET /invitations with filtering and pagination support
    - Add POST /invitations/:id/resend and DELETE /invitations/:id endpoints
    - _Requirements: 1.2, 5.1, 5.2, 5.3_

  - [x] 4.2 Implement InvitationAcceptanceController for public access
    - Create GET /invitation-acceptance/:token endpoint for invitation validation
    - Implement POST /invitation-acceptance/:token/accept for invitation acceptance
    - Add proper error handling for expired, invalid, and already accepted invitations
    - _Requirements: 4.2, 4.3, 4.5_

  - [x] 4.3 Write controller unit tests
    - Test all endpoints with various permission scenarios
    - Test input validation and error handling
    - Test rate limiting and security measures
    - _Requirements: 1.2, 4.2, 5.1_

- [x] 5. Integrate with notification system
  - [x] 5.1 Create invitation email template
    - Design InvitationEmailTemplate component using existing email template structure
    - Include invitation URL, role information, expiration date, and call-to-action button
    - Add support for custom invitation messages and tenant branding
    - _Requirements: 4.1, 4.2_

  - [x] 5.2 Implement InvitationNotificationService
    - Create service to send invitation emails using existing notification infrastructure
    - Implement email delivery tracking and error handling
    - Add support for invitation reminders and status notifications
    - _Requirements: 1.2, 4.1_

  - [x] 5.3 Write notification integration tests
    - Test email template rendering with various data scenarios
    - Test email delivery success and failure handling
    - Test integration with existing notification providers
    - _Requirements: 1.2, 4.1_

- [ ] 6. Build invitation acceptance flow
  - [ ] 6.1 Create invitation acceptance page/API integration
    - Implement token validation endpoint that returns invitation details
    - Create user registration flow that integrates with existing auth system
    - Add support for both Google OAuth and password-based registration
    - _Requirements: 4.2, 4.3, 7.1, 7.2_

  - [ ] 6.2 Integrate with existing authentication system
    - Modify Google OAuth service to handle invitation token context
    - Update user creation flow to automatically assign invitation roles
    - Implement invitation completion logic that marks invitations as accepted
    - _Requirements: 4.4, 7.1, 7.2, 7.3_

  - [ ] 6.3 Write authentication integration tests
    - Test Google OAuth flow with invitation tokens
    - Test password registration flow with role assignment
    - Test user creation and automatic role assignment
    - _Requirements: 4.3, 4.4, 7.1, 7.2_

- [ ] 7. Implement security and rate limiting
  - [ ] 7.1 Add rate limiting guards and services
    - Create InvitationRateLimitGuard for per-tenant and per-admin limits
    - Implement rate limiting service using Redis for invitation creation
    - Add IP-based rate limiting for invitation acceptance attempts
    - _Requirements: 6.4, 6.5_

  - [ ] 7.2 Implement audit logging system
    - Create InvitationAuditService for comprehensive activity logging
    - Add audit logging to all invitation operations (create, accept, cancel, resend)
    - Implement security event logging for failed validation attempts
    - _Requirements: 6.5, 5.5_

  - [ ]* 7.3 Write security and audit tests
    - Test rate limiting enforcement under various scenarios
    - Test audit log creation for all operations
    - Test security measures and attack prevention
    - _Requirements: 6.4, 6.5_

- [ ] 8. Create invitation management module
  - [ ] 8.1 Implement InvitationModule with all dependencies
    - Create module that imports required services and controllers
    - Configure proper dependency injection for all invitation services
    - Add module exports for services that need to be used by other modules
    - _Requirements: All requirements_

  - [ ] 8.2 Update existing modules for integration
    - Update AuthModule to include invitation acceptance flow
    - Modify UserModule to support invitation-based user creation
    - Update TenantModule to include invitation management capabilities
    - _Requirements: 4.4, 7.3, 7.4_

  - [ ] 8.3 Write module integration tests
    - Test module initialization and dependency injection
    - Test integration between invitation and existing modules
    - Test end-to-end invitation flow across modules
    - _Requirements: All requirements_

- [ ] 9. Add invitation status management and cleanup
  - [ ] 9.1 Implement invitation status tracking
    - Create service methods to update invitation status (accepted, cancelled, expired)
    - Implement automatic expiration checking with scheduled tasks
    - Add invitation cleanup service for expired and old invitations
    - _Requirements: 3.3, 5.1, 5.5_

  - [ ] 9.2 Create invitation management utilities
    - Implement bulk invitation operations for admin efficiency
    - Add invitation statistics and reporting capabilities
    - Create invitation export functionality for admin oversight
    - _Requirements: 5.1, 5.4_

  - [ ] 9.3 Write status management tests
    - Test automatic status updates and expiration handling
    - Test cleanup operations and data retention
    - Test bulk operations and reporting features
    - _Requirements: 3.3, 5.1, 5.5_

- [ ] 10. Finalize integration and testing
  - [ ] 10.1 Create comprehensive integration tests
    - Test complete invitation flow from creation to acceptance
    - Test error scenarios and edge cases across the entire system
    - Test performance under load with multiple concurrent invitations
    - _Requirements: All requirements_

  - [ ] 10.2 Add API documentation and examples
    - Create OpenAPI documentation for all invitation endpoints
    - Add code examples for common invitation scenarios
    - Document error responses and status codes
    - _Requirements: All requirements_

  - [ ] 10.3 Write end-to-end tests
    - Test full user journey from invitation email to successful login
    - Test admin management workflows and bulk operations
    - Test security scenarios and attack prevention
    - _Requirements: All requirements_