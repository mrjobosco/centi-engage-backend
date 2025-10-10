# Requirements Document

## Introduction

This document outlines the requirements for a foundational NestJS backend application designed as a scalable, secure, and extensible starter project for large, multi-tenant SaaS platforms. The application implements a shared database, shared schema multi-tenancy architecture with robust tenant isolation, JWT-based authentication, and a hybrid RBAC (Role-Based Access Control) system that supports both role-based permissions and user-specific permission overrides. The system ensures complete data isolation between tenants while providing flexible permission management within each tenant.

## Requirements

### Requirement 1: Multi-Tenancy Architecture

**User Story:** As a SaaS platform operator, I want a shared database multi-tenancy architecture with strict tenant isolation, so that I can efficiently manage multiple customers while ensuring their data remains completely separate and secure.

#### Acceptance Criteria

1. WHEN the application is deployed THEN the system SHALL use a shared PostgreSQL database with a shared schema architecture
2. WHEN any tenant-specific table is created THEN the system SHALL include a tenantId discriminator column
3. WHEN any database query is executed for tenant-specific resources THEN the system SHALL automatically scope the query to the current tenant's tenantId using Prisma Middleware
4. IF a query attempts to access data from a different tenant THEN the system SHALL prevent the access and return no results
5. WHEN a request is received THEN the system SHALL identify the tenant via an x-tenant-id header OR by parsing the subdomain
6. WHEN the tenant is identified THEN the system SHALL make the tenantId available throughout the request lifecycle via a request-scoped service

### Requirement 2: Tenant Provisioning

**User Story:** As a new customer, I want to register and automatically get a fully configured tenant with an admin account and default permissions, so that I can immediately start using the platform without manual setup.

#### Acceptance Criteria

1. WHEN a POST request is made to /tenants or /auth/register THEN the system SHALL create a new tenant without requiring authentication
2. WHEN a new tenant is created THEN the system SHALL atomically create a Tenant record, an initial Admin user, default permissions, default roles, and assign the Admin role to the user
3. WHEN default permissions are created THEN the system SHALL include at minimum: create:project, read:project, update:user
4. WHEN default roles are created THEN the system SHALL include at minimum: "Admin" and "Member" roles
5. WHEN the Admin role is created THEN the system SHALL assign all default permissions to it
6. IF any step in the tenant provisioning process fails THEN the system SHALL roll back all changes using a database transaction
7. WHEN tenant provisioning completes successfully THEN the system SHALL return the tenant details and admin user credentials

### Requirement 3: Authentication System

**User Story:** As a user, I want to securely log in to my tenant account using JWT-based authentication, so that I can access the platform's features with proper authorization.

#### Acceptance Criteria

1. WHEN a user submits credentials to POST /auth/login THEN the system SHALL validate the email and password against the specified tenant
2. WHEN credentials are valid THEN the system SHALL generate a JWT token containing userId, tenantId, and assigned roles
3. WHEN a user password is stored THEN the system SHALL hash it using bcrypt
4. WHEN a user password is validated THEN the system SHALL compare the hashed password using bcrypt
5. IF credentials are invalid THEN the system SHALL return an authentication error without revealing whether the email or password was incorrect
6. WHEN a JWT token is generated THEN the system SHALL sign it with a secret key from environment configuration
7. WHEN a protected endpoint is accessed THEN the system SHALL validate the JWT token and extract the user context

### Requirement 4: Role-Based Access Control (RBAC)

**User Story:** As a tenant administrator, I want to define custom roles with specific permissions and assign them to users, so that I can control what actions different users can perform within my tenant.

#### Acceptance Criteria

1. WHEN a permission is created THEN the system SHALL define it as an action-resource pair (e.g., create:invoice, read:user)
2. WHEN a permission is created THEN the system SHALL scope it to a specific tenant
3. WHEN permissions are queried THEN the system SHALL return only permissions belonging to the current tenant
4. WHEN a role is created THEN the system SHALL define it as a named collection of permissions scoped to a tenant
5. WHEN a role name is created within a tenant THEN the system SHALL ensure it is unique within that tenant
6. WHEN a user is assigned a role THEN the system SHALL support assigning multiple roles to a single user
7. WHEN a role's permissions are updated THEN the system SHALL affect all users assigned to that role
8. WHEN a permission is defined THEN the system SHALL enforce uniqueness on the combination of (action, subject, tenantId)

### Requirement 5: User-Specific Permission Overrides

**User Story:** As a tenant administrator, I want to grant specific permissions directly to individual users independent of their roles, so that I can create custom access levels without creating single-use roles.

#### Acceptance Criteria

1. WHEN a user-specific permission is granted THEN the system SHALL allow assigning permissions directly to a user without requiring a role
2. WHEN a user has both role-based and user-specific permissions THEN the system SHALL calculate effective permissions as the UNION of both sets
3. WHEN checking if a user has a permission THEN the system SHALL check both role-based permissions AND user-specific permissions
4. WHEN a user-specific permission is removed THEN the system SHALL only remove that specific permission and not affect role-based permissions
5. WHEN listing a user's permissions THEN the system SHALL clearly indicate which permissions come from roles and which are user-specific

### Requirement 6: Permissions Guard and Route Protection

**User Story:** As a developer, I want a flexible permissions guard that can protect routes based on required permissions, so that I can easily secure endpoints and ensure users can only access authorized resources.

#### Acceptance Criteria

1. WHEN a route is decorated with @UseGuards(PermissionsGuard) and @Permissions('create:invoice') THEN the system SHALL verify the user has the required permission
2. WHEN a user's effective permissions are calculated THEN the system SHALL include all permissions from assigned roles UNION all user-specific permissions
3. WHEN a user lacks the required permission THEN the system SHALL return a 403 Forbidden response
4. WHEN multiple permissions are required for a route THEN the system SHALL support checking for all required permissions
5. WHEN a permissions check is performed THEN the system SHALL automatically scope the check to the current tenant
6. IF the JWT token is invalid or missing THEN the system SHALL return a 401 Unauthorized response before checking permissions

### Requirement 7: User Management

**User Story:** As a tenant administrator, I want to manage users within my tenant including creating, updating, and assigning roles and permissions, so that I can control who has access to the platform and what they can do.

#### Acceptance Criteria

1. WHEN listing users THEN the system SHALL return only users belonging to the current tenant
2. WHEN creating a user THEN the system SHALL automatically associate them with the current tenant
3. WHEN an Admin user invites a new user THEN the system SHALL create an invitation that is scoped to the tenant
4. WHEN roles are assigned to a user THEN the system SHALL validate that the roles belong to the same tenant as the user
5. WHEN user-specific permissions are assigned THEN the system SHALL validate that the permissions belong to the same tenant as the user
6. WHEN a user is updated or deleted THEN the system SHALL verify the requesting user has the update:user or delete:user permission
7. WHEN a user is deleted THEN the system SHALL remove all role assignments and user-specific permissions

### Requirement 8: Permission and Role Management

**User Story:** As a tenant administrator, I want full CRUD capabilities for permissions and roles within my tenant, so that I can customize the access control system to match my organization's needs.

#### Acceptance Criteria

1. WHEN creating a permission THEN the system SHALL require an action, subject, and automatically associate it with the current tenant
2. WHEN listing permissions THEN the system SHALL return only permissions for the current tenant
3. WHEN deleting a permission THEN the system SHALL remove it from all roles and users within the tenant
4. WHEN creating a role THEN the system SHALL require a name and automatically associate it with the current tenant
5. WHEN updating a role's permissions THEN the system SHALL replace the entire permission set for that role
6. WHEN deleting a role THEN the system SHALL remove all assignments of that role from users
7. WHEN a role or permission is modified THEN the system SHALL validate that the requesting user has the appropriate permission (create:role, update:role, etc.)

### Requirement 9: Resource Management with Tenant Scoping

**User Story:** As a user, I want to create and manage resources like projects within my tenant, so that I can use the platform's core functionality with automatic tenant isolation.

#### Acceptance Criteria

1. WHEN a project is created THEN the system SHALL automatically associate it with the current tenant's tenantId
2. WHEN projects are listed THEN the system SHALL return only projects belonging to the current tenant
3. WHEN a project is created THEN the system SHALL set the ownerId to the current user's ID
4. WHEN a project is deleted THEN the system SHALL verify it belongs to the current tenant before deletion
5. WHEN any tenant-scoped resource is accessed THEN the system SHALL enforce tenant isolation through Prisma Middleware
6. IF a user attempts to access a resource from another tenant THEN the system SHALL return a 404 Not Found response

### Requirement 10: Data Integrity and Validation

**User Story:** As a platform operator, I want robust validation and error handling throughout the application, so that invalid data is rejected and errors are handled gracefully with clear feedback.

#### Acceptance Criteria

1. WHEN any API request is received THEN the system SHALL validate the request body using class-validator
2. WHEN validation fails THEN the system SHALL return a 400 Bad Request with detailed validation errors
3. WHEN a database constraint is violated THEN the system SHALL return a meaningful error message
4. WHEN an unexpected error occurs THEN the system SHALL log the error and return a standardized JSON error response
5. WHEN complex operations involve multiple database writes THEN the system SHALL use Prisma's $transaction API to ensure atomicity
6. WHEN environment variables are missing or invalid THEN the system SHALL fail to start and log clear error messages

### Requirement 11: Testing and Quality Assurance

**User Story:** As a developer, I want comprehensive test coverage including unit, integration, and E2E tests, so that I can confidently make changes and ensure the multi-tenancy isolation works correctly.

#### Acceptance Criteria

1. WHEN unit tests are run THEN the system SHALL test individual services and controllers in isolation
2. WHEN integration tests are run THEN the system SHALL test module interactions, especially authentication and permissions logic
3. WHEN E2E tests are run THEN the system SHALL test complete API workflows including tenant isolation
4. WHEN E2E tests verify tenant isolation THEN the system SHALL assert that one tenant's credentials cannot access another tenant's data
5. WHEN tests are executed THEN the system SHALL use a separate test database to avoid affecting development data
6. WHEN the test suite completes THEN the system SHALL report code coverage metrics

### Requirement 12: Configuration and Documentation

**User Story:** As a developer setting up the application, I want clear documentation and environment-based configuration, so that I can easily deploy and customize the application for different environments.

#### Acceptance Criteria

1. WHEN the application starts THEN the system SHALL load configuration from environment variables using @nestjs/config
2. WHEN configuration is accessed THEN the system SHALL provide type-safe access to DATABASE_URL, JWT_SECRET, and other settings
3. WHEN the project is cloned THEN the system SHALL include a README.md with setup instructions and API usage guide
4. WHEN the API is documented THEN the system SHALL provide either a Postman collection or OpenAPI/Swagger specification
5. WHEN the README is read THEN the system SHALL explain the multi-tenancy model and permission system architecture
6. WHEN environment variables are missing THEN the system SHALL provide clear error messages indicating which variables are required
