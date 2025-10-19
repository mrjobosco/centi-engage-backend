# Requirements Document

## Introduction

This document outlines the requirements for implementing a tenant-less user registration system that allows users to create accounts using Google OAuth or email/password authentication without requiring a pre-existing tenant. After account creation, users can then create and manage their own tenants. This approach provides a more flexible onboarding experience for B2B SaaS platforms where users should be able to sign up first and then create their organization/workspace.

## Requirements

### Requirement 1: Tenant-less User Registration

**User Story:** As a new user, I want to create an account using Google OAuth or email/password without needing to belong to an existing tenant, so that I can sign up independently and then create my organization later.

#### Acceptance Criteria

1. WHEN a user initiates Google OAuth sign-up THEN the system SHALL create a user account without requiring a tenant ID
2. WHEN a user registers with email/password THEN the system SHALL create a user account without requiring a tenant ID
3. WHEN a tenant-less user is created THEN the system SHALL set their tenantId to null initially
4. WHEN a tenant-less user signs in THEN the system SHALL generate a valid JWT token with null tenantId
5. WHEN a tenant-less user accesses the platform THEN the system SHALL redirect them to tenant creation flow
6. WHEN a tenant-less user's profile is accessed THEN the system SHALL show their account information without tenant-specific data
7. WHEN a tenant-less user attempts tenant-specific operations THEN the system SHALL prompt them to create or join a tenant

### Requirement 2: Post-Registration Tenant Creation

**User Story:** As a registered user without a tenant, I want to create a new tenant/organization, so that I can set up my workspace and become the admin of my organization.

#### Acceptance Criteria

1. WHEN a tenant-less user accesses tenant creation THEN the system SHALL display a tenant creation form
2. WHEN a user submits tenant creation form THEN the system SHALL validate the tenant name is unique
3. WHEN tenant creation succeeds THEN the system SHALL create the tenant with default roles and permissions
4. WHEN tenant creation succeeds THEN the system SHALL assign the user as the tenant admin
5. WHEN tenant creation succeeds THEN the system SHALL update the user's tenantId to the new tenant
6. WHEN tenant creation succeeds THEN the system SHALL generate a new JWT token with the tenant context
7. WHEN tenant creation succeeds THEN the system SHALL redirect the user to their new tenant dashboard

### Requirement 3: Tenant Joining Flow

**User Story:** As a registered user without a tenant, I want to join an existing tenant through an invitation, so that I can become a member of an existing organization instead of creating my own.

#### Acceptance Criteria

1. WHEN a tenant-less user receives a tenant invitation THEN the system SHALL allow them to accept it
2. WHEN a tenant-less user accepts an invitation THEN the system SHALL validate the invitation is still valid
3. WHEN invitation acceptance succeeds THEN the system SHALL assign the user to the inviting tenant
4. WHEN invitation acceptance succeeds THEN the system SHALL assign appropriate roles based on the invitation
5. WHEN invitation acceptance succeeds THEN the system SHALL update the user's tenantId
6. WHEN invitation acceptance succeeds THEN the system SHALL generate a new JWT token with tenant context
7. WHEN a user with a tenant receives additional invitations THEN the system SHALL handle multi-tenant scenarios appropriately

### Requirement 4: Authentication Flow Modifications

**User Story:** As a developer, I want the authentication system to handle both tenant-less and tenant-bound users seamlessly, so that the platform can support flexible user onboarding.

#### Acceptance Criteria

1. WHEN JWT tokens are generated for tenant-less users THEN the system SHALL include null tenantId in the payload
2. WHEN JWT tokens are validated THEN the system SHALL accept both null and valid tenantId values
3. WHEN tenant middleware processes requests THEN the system SHALL handle tenant-less users appropriately
4. WHEN role-based access control is applied THEN the system SHALL handle users without tenant roles
5. WHEN audit logging occurs THEN the system SHALL log events for tenant-less users with appropriate context
6. WHEN user sessions are managed THEN the system SHALL support transitioning from tenant-less to tenant-bound state
7. WHEN authentication guards are applied THEN the system SHALL differentiate between tenant-required and tenant-optional endpoints

### Requirement 5: Database Schema Modifications

**User Story:** As a system administrator, I want the database to support users without tenants while maintaining data integrity, so that the platform can handle the new user registration flow.

#### Acceptance Criteria

1. WHEN the user table is modified THEN the system SHALL make tenantId nullable
2. WHEN user constraints are updated THEN the system SHALL allow multiple users with null tenantId
3. WHEN user queries are executed THEN the system SHALL handle null tenantId values correctly
4. WHEN tenant-specific data is accessed THEN the system SHALL prevent access for tenant-less users
5. WHEN data migrations are run THEN the system SHALL preserve existing user-tenant relationships
6. WHEN database indexes are updated THEN the system SHALL maintain query performance for both scenarios
7. WHEN referential integrity is maintained THEN the system SHALL handle the nullable tenant relationship properly

### Requirement 6: User Interface and Experience

**User Story:** As a user, I want a smooth onboarding experience that guides me through account creation and tenant setup, so that I can quickly start using the platform.

#### Acceptance Criteria

1. WHEN a new user visits the platform THEN the system SHALL display registration options (Google OAuth, email/password)
2. WHEN a user completes registration THEN the system SHALL show a welcome screen with next steps
3. WHEN a tenant-less user logs in THEN the system SHALL display tenant creation/joining options
4. WHEN a user creates a tenant THEN the system SHALL show a success message and onboarding flow
5. WHEN a user joins a tenant THEN the system SHALL display the tenant dashboard with appropriate permissions
6. WHEN errors occur during tenant operations THEN the system SHALL display helpful error messages
7. WHEN a user has multiple tenant options THEN the system SHALL provide clear selection interface

### Requirement 7: API Endpoints and Integration

**User Story:** As a frontend developer, I want well-defined API endpoints for tenant-less user management and tenant operations, so that I can build the user interface effectively.

#### Acceptance Criteria

1. WHEN POST /auth/register is called THEN the system SHALL create tenant-less users
2. WHEN POST /auth/google/callback is called THEN the system SHALL handle tenant-less Google OAuth users
3. WHEN POST /tenants is called by authenticated user THEN the system SHALL create a new tenant
4. WHEN GET /me/tenant-status is called THEN the system SHALL return user's tenant association status
5. WHEN POST /tenants/join is called with invitation THEN the system SHALL process tenant joining
6. WHEN GET /tenants/available is called THEN the system SHALL return joinable tenants for the user
7. WHEN PATCH /me/tenant is called THEN the system SHALL allow tenant switching for multi-tenant users

### Requirement 8: Security and Validation

**User Story:** As a security administrator, I want proper security controls for tenant-less users and tenant operations, so that the platform remains secure during the flexible onboarding process.

#### Acceptance Criteria

1. WHEN tenant-less users access resources THEN the system SHALL enforce appropriate access controls
2. WHEN tenant creation is attempted THEN the system SHALL validate user permissions and rate limits
3. WHEN tenant names are submitted THEN the system SHALL validate uniqueness and format requirements
4. WHEN invitation acceptance occurs THEN the system SHALL verify invitation authenticity and expiration
5. WHEN JWT tokens are issued THEN the system SHALL include appropriate claims for tenant-less users
6. WHEN audit events are logged THEN the system SHALL track tenant-less user activities appropriately
7. WHEN cross-tenant operations are attempted THEN the system SHALL prevent unauthorized access

### Requirement 9: Backward Compatibility

**User Story:** As an existing user, I want my current tenant-bound account to continue working unchanged, so that the new tenant-less registration doesn't affect existing functionality.

#### Acceptance Criteria

1. WHEN existing users sign in THEN the system SHALL process their authentication exactly as before
2. WHEN existing tenant operations are performed THEN the system SHALL maintain current functionality
3. WHEN existing API endpoints are called THEN the system SHALL return compatible responses
4. WHEN existing JWT tokens are validated THEN the system SHALL continue to work with tenant-bound tokens
5. WHEN existing database queries are executed THEN the system SHALL handle both null and non-null tenantId values
6. WHEN existing middleware is applied THEN the system SHALL maintain current tenant validation for tenant-required endpoints
7. WHEN existing user workflows are followed THEN the system SHALL preserve current user experience for tenant-bound users

### Requirement 10: Multi-Tenant Scenarios

**User Story:** As a user, I want to potentially belong to multiple tenants in the future, so that I can participate in multiple organizations while maintaining a single account.

#### Acceptance Criteria

1. WHEN user-tenant relationships are designed THEN the system SHALL support future multi-tenant membership
2. WHEN tenant switching is implemented THEN the system SHALL allow users to switch between their tenants
3. WHEN JWT tokens are generated THEN the system SHALL support specifying which tenant context to use
4. WHEN user permissions are evaluated THEN the system SHALL consider the active tenant context
5. WHEN audit logging occurs THEN the system SHALL track which tenant context was active
6. WHEN invitation systems are used THEN the system SHALL handle users who already belong to other tenants
7. WHEN tenant operations are performed THEN the system SHALL ensure proper tenant isolation is maintained