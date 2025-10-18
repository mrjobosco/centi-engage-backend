# Implementation Plan

- [x] 1. Set up database schema and Redis infrastructure
  - Add email verification fields to User model in Prisma schema
  - Create database migration for new fields
  - Set up Redis module configuration for OTP storage
  - _Requirements: 1.2, 2.1, 6.3_

- [x] 2. Create core OTP storage and management services
- [x] 2.1 Implement OTP storage service with Redis
  - Create OTPStorageService with Redis operations for storing, retrieving, and deleting OTPs
  - Implement TTL management and rate limiting storage
  - Add error handling for Redis connection issues
  - _Requirements: 1.2, 1.3, 4.1, 4.4_

- [x] 2.2 Implement email OTP service with generation and validation
  - Create EmailOTPService with OTP generation, validation, and user verification logic
  - Implement 6-digit numeric OTP generation with crypto randomness
  - Add OTP validation with attempt tracking and expiration checks
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4_

- [ ]* 2.3 Write unit tests for OTP services
  - Test OTP generation, validation, and storage operations
  - Test rate limiting and expiration logic
  - Test Redis error handling scenarios
  - _Requirements: 1.1, 2.1, 4.1_

- [ ] 3. Integrate OTP verification with authentication flows
- [ ] 3.1 Extend user registration to generate and send OTP
  - Modify existing registration endpoint to create unverified users
  - Integrate OTP generation and email sending after user creation
  - Update registration response to indicate verification requirement
  - _Requirements: 1.1, 1.3, 1.4, 5.2_

- [ ] 3.2 Create email verification endpoints
  - Implement POST /auth/verify-email endpoint for OTP verification
  - Implement POST /auth/resend-otp endpoint for OTP resending
  - Add proper validation, rate limiting, and error responses
  - _Requirements: 2.1, 2.2, 4.1, 4.2, 4.4, 5.3_

- [ ] 3.3 Update OAuth flows to set email as verified
  - Modify Google OAuth registration to set emailVerified: true
  - Ensure OAuth users bypass OTP verification entirely
  - Update existing OAuth user linking to maintain verification status
  - _Requirements: 6.1, 6.2_

- [ ]* 3.4 Write integration tests for authentication flows
  - Test complete registration and verification flow
  - Test OAuth bypass behavior
  - Test rate limiting and error scenarios
  - _Requirements: 1.1, 2.1, 6.1_

- [ ] 4. Implement verification guards and middleware
- [ ] 4.1 Create email verification guard
  - Implement EmailVerificationGuard to check user verification status
  - Add decorator for easy application to protected routes
  - Handle unverified user access with appropriate error responses
  - _Requirements: 2.6, 5.1, 5.3_

- [ ] 4.2 Update existing guards to respect verification status
  - Modify JWT auth guard to include verification checks where needed
  - Ensure login flow checks verification status and returns appropriate response
  - Add verification status to JWT payload or user context
  - _Requirements: 5.1, 5.2_

- [ ]* 4.3 Write unit tests for guards and middleware
  - Test guard behavior with verified and unverified users
  - Test decorator functionality and error responses
  - Test integration with existing authentication guards
  - _Requirements: 5.1, 5.2_

- [ ] 5. Create email templates and notification integration
- [ ] 5.1 Create OTP email template
  - Design email template for OTP delivery with clear instructions
  - Include OTP code, expiration time, and security warnings
  - Add template to notification system with proper categorization
  - _Requirements: 1.3, 5.3_

- [ ] 5.2 Integrate OTP sending with notification service
  - Create notification payload for OTP emails
  - Ensure proper tenant context and user preferences are respected
  - Add error handling for email delivery failures
  - _Requirements: 1.3, 1.5, 7.4_

- [ ]* 5.3 Write tests for email template and notification integration
  - Test email template rendering with OTP data
  - Test notification service integration and delivery
  - Test error handling for email failures
  - _Requirements: 1.3, 7.4_

- [ ] 6. Add comprehensive error handling and validation
- [ ] 6.1 Create custom exceptions for OTP operations
  - Implement EmailVerificationRequiredException for unverified access
  - Implement InvalidOTPException for invalid/expired OTPs
  - Implement OTPRateLimitException for rate limit violations
  - _Requirements: 2.3, 2.4, 4.4, 5.1_

- [ ] 6.2 Implement DTOs with validation
  - Create VerifyEmailDto with OTP format validation
  - Create ResendOTPDto with email validation
  - Add proper validation decorators and error messages
  - _Requirements: 2.1, 4.1_

- [ ]* 6.3 Write tests for error handling and validation
  - Test custom exception behavior and responses
  - Test DTO validation with various input scenarios
  - Test error response formatting and user feedback
  - _Requirements: 2.3, 4.4, 5.1_

- [ ] 7. Implement audit logging and monitoring
- [ ] 7.1 Add audit logging for OTP operations
  - Log OTP generation, verification attempts, and outcomes
  - Log rate limiting events and security violations
  - Include user context, IP addresses, and timestamps
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 7.2 Add metrics and monitoring for OTP system
  - Track OTP generation and verification rates
  - Monitor email delivery success rates
  - Add performance metrics for Redis operations
  - _Requirements: 7.1, 7.5_

- [ ]* 7.3 Write tests for audit logging and monitoring
  - Test audit log creation for various OTP events
  - Test metrics collection and reporting
  - Test monitoring integration and alerting
  - _Requirements: 7.1, 7.2_

- [ ] 8. Update existing protected routes and tenant management
- [ ] 8.1 Apply verification requirements to critical endpoints
  - Add email verification guard to tenant management endpoints
  - Update user profile and settings endpoints to require verification
  - Ensure project creation and management requires verified users
  - _Requirements: 3.3, 5.1_

- [ ] 8.2 Update tenant invitation system integration
  - Ensure invited users complete email verification after acceptance
  - Handle verification requirements in invitation acceptance flow
  - Update invitation notifications to include verification instructions
  - _Requirements: 3.3, 6.4_

- [ ]* 8.3 Write integration tests for protected routes
  - Test verification requirements on various endpoints
  - Test tenant management with unverified users
  - Test invitation system integration with verification
  - _Requirements: 3.3, 5.1_

- [ ] 9. Configuration and environment setup
- [ ] 9.1 Add configuration for OTP system
  - Add environment variables for OTP settings (expiration, length, rate limits)
  - Configure Redis connection settings
  - Add email template configuration
  - _Requirements: 1.2, 4.1, 7.5_

- [ ] 9.2 Update module imports and dependency injection
  - Register OTP services in authentication module
  - Configure Redis module with proper settings
  - Update app module to include email verification module
  - _Requirements: 1.1, 1.2_

- [ ]* 9.3 Write configuration tests
  - Test environment variable loading and validation
  - Test module configuration and dependency injection
  - Test Redis connection and configuration
  - _Requirements: 1.2, 7.5_