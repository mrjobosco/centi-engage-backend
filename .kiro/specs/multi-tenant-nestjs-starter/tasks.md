# Implementation Plan

- [x] 1. Initialize NestJS project and configure foundational setup
  - Create new NestJS project with TypeScript strict mode
  - Install dependencies: @nestjs/jwt, @nestjs/passport, @nestjs/config, passport-jwt, bcrypt, class-validator, class-transformer, @prisma/client, prisma
  - Configure tsconfig.json with strict mode enabled
  - Set up .env file structure with required environment variables
  - Create configuration module using @nestjs/config
  - _Requirements: 12.1, 12.6_

- [x] 2. Set up Prisma and define database schema
  - Initialize Prisma in the project
  - Create complete Prisma schema with all models (Tenant, User, Role, Permission, UserRole, RolePermission, UserPermission, Project)
  - Add indexes on tenantId and foreign key fields
  - Add unique constraints for (email, tenantId), (name, tenantId), and (action, subject, tenantId)
  - Configure cascade deletes for tenant relationships
  - _Requirements: 1.1, 1.2, 4.8, 9.5_

- [x] 3. Create Prisma service with tenant-scoping middleware
  - [x] 3.1 Implement PrismaService extending PrismaClient
    - Create PrismaService class that extends PrismaClient
    - Implement OnModuleInit and OnModuleDestroy lifecycle hooks
    - Configure connection pooling and graceful shutdown
    - _Requirements: 1.3, 9.5_

  - [x] 3.2 Implement Prisma tenant-scoping middleware
    - Create middleware function that intercepts all Prisma queries
    - Add tenantId to WHERE clauses for findMany, findFirst, findUnique, update, delete operations
    - Add tenantId to data for create operations
    - Maintain whitelist of non-tenant-scoped models (Tenant model itself)
    - Inject TenantContextService to get current tenant ID
    - Register middleware in PrismaService.onModuleInit
    - _Requirements: 1.3, 1.4, 9.5_

- [x] 4. Implement tenant identification system
  - [x] 4.1 Create TenantContextService for request-scoped tenant storage
    - Create request-scoped service to store and retrieve current tenant ID
    - Implement setTenantId and getTenantId methods
    - Add error handling for missing tenant context
    - _Requirements: 1.6_

  - [x] 4.2 Create TenantIdentificationMiddleware
    - Implement NestJS middleware to extract tenant ID from x-tenant-id header
    - Add fallback logic to parse subdomain from hostname
    - Store tenant ID in TenantContextService
    - Throw BadRequestException if tenant cannot be identified
    - _Requirements: 1.5, 1.6_

  - [x] 4.3 Create TenantModule and wire up middleware
    - Create TenantModule with TenantContextService as provider
    - Export TenantContextService for use in other modules
    - Configure middleware in AppModule to run on all routes except public endpoints
    - _Requirements: 1.5, 1.6_

- [x] 5. Implement authentication infrastructure
  - [x] 5.1 Create JWT strategy and auth guard
    - Create JwtStrategy extending PassportStrategy
    - Implement validate method to extract and verify JWT payload
    - Load user from database with roles in validate method
    - Create JwtAuthGuard extending AuthGuard('jwt')
    - _Requirements: 3.6, 3.7_

  - [x] 5.2 Create auth DTOs and interfaces
    - Create LoginDto with email and password validation
    - Create RegisterTenantDto with tenant name, admin email, and password validation
    - Create JwtPayload interface with userId, tenantId, and roles
    - Create RequestWithUser interface extending Express Request
    - _Requirements: 3.1, 10.1_

  - [x] 5.3 Create custom decorators for auth
    - Create @CurrentUser decorator to extract user from request
    - Create @CurrentTenant decorator to extract tenant ID from request
    - Create @Public decorator to mark routes that skip authentication
    - _Requirements: 3.7_

- [x] 6. Implement tenant provisioning and registration
  - [x] 6.1 Create TenantService with provisioning logic
    - Implement createTenant method that uses Prisma transaction
    - Create Tenant record
    - Create default permissions (create:project, read:project, update:user, delete:project, create:user, read:user, delete:user, create:role, read:role, update:role, delete:role, create:permission, read:permission, delete:permission)
    - Create default roles (Admin with all permissions, Member with read permissions)
    - Hash admin password with bcrypt
    - Create admin User record
    - Assign Admin role to user via UserRole join table
    - Return created tenant and user (without password)
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 10.5_

  - [x] 6.2 Create TenantController with registration endpoint
    - Create POST /tenants endpoint (public, no auth required)
    - Use RegisterTenantDto for validation
    - Call TenantService.createTenant
    - Return 201 Created with tenant and admin user details
    - Add error handling for duplicate tenant names or emails
    - _Requirements: 2.1, 2.7_

  - [x] 6.3 Write unit tests for tenant provisioning
    - Test successful tenant creation with all default data
    - Test transaction rollback on failure
    - Test duplicate email handling
    - Test password hashing
    - _Requirements: 11.1_

- [x] 7. Implement authentication endpoints
  - [x] 7.1 Create AuthService with login logic
    - Implement login method that queries user by email and tenantId
    - Verify password using bcrypt.compare
    - Load user's roles for JWT payload
    - Generate JWT token with userId, tenantId, and role IDs
    - Return access token
    - Throw UnauthorizedException for invalid credentials
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 7.2 Create AuthController with login endpoint
    - Create POST /auth/login endpoint (public)
    - Use LoginDto for validation
    - Call AuthService.login
    - Return JWT access token
    - _Requirements: 3.1_

  - [x] 7.3 Write unit tests for authentication
    - Test successful login with valid credentials
    - Test failed login with invalid password
    - Test failed login with non-existent user
    - Test JWT payload structure
    - Test password comparison logic
    - _Requirements: 11.1_

- [x] 8. Implement permissions system
  - [x] 8.1 Create PermissionService with CRUD operations
    - Implement findAll method to list permissions for current tenant
    - Implement findOne method to get permission by ID (tenant-scoped)
    - Implement create method to create new permission with tenantId
    - Implement delete method to remove permission and cascade to roles/users
    - Add validation for unique (action, subject, tenantId)
    - _Requirements: 4.1, 4.2, 4.3, 8.1, 8.2, 8.3_

  - [x] 8.2 Create PermissionController with CRUD endpoints
    - Create GET /permissions endpoint with @Permissions('read:permission')
    - Create POST /permissions endpoint with @Permissions('create:permission')
    - Create DELETE /permissions/:id endpoint with @Permissions('delete:permission')
    - Use CreatePermissionDto for validation
    - _Requirements: 8.7_

  - [x] 8.3 Write unit tests for permission management
    - Test permission creation with automatic tenant scoping
    - Test duplicate permission prevention
    - Test permission deletion cascades to roles and users
    - Test tenant isolation in permission queries
    - _Requirements: 11.1_

- [x] 9. Implement roles system
  - [x] 9.1 Create RoleService with CRUD operations
    - Implement findAll method to list roles for current tenant
    - Implement findOne method to get role by ID with permissions (tenant-scoped)
    - Implement create method to create new role with tenantId
    - Implement update method to update role name
    - Implement updatePermissions method to replace role's permissions via RolePermission join table
    - Implement delete method to remove role and cascade to users
    - Add validation for unique (name, tenantId)
    - Validate that permissions belong to same tenant as role
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 8.4, 8.5, 8.6_

  - [x] 9.2 Create RoleController with CRUD endpoints
    - Create GET /roles endpoint with @Permissions('read:role')
    - Create POST /roles endpoint with @Permissions('create:role')
    - Create PUT /roles/:id endpoint with @Permissions('update:role')
    - Create PUT /roles/:id/permissions endpoint with @Permissions('update:role')
    - Create DELETE /roles/:id endpoint with @Permissions('delete:role')
    - Use CreateRoleDto, UpdateRoleDto, and AssignPermissionsDto for validation
    - _Requirements: 8.7_

  - [x] 9.3 Write unit tests for role management
    - Test role creation with automatic tenant scoping
    - Test duplicate role name prevention within tenant
    - Test role permission assignment
    - Test role deletion cascades to users
    - Test cross-tenant permission assignment prevention
    - _Requirements: 11.1_

- [x] 10. Implement permissions guard and authorization
  - [x] 10.1 Create @Permissions decorator
    - Create custom decorator that accepts permission strings
    - Store required permissions in route metadata using Reflector
    - Support multiple permissions (e.g., @Permissions('read:user', 'update:user'))
    - _Requirements: 6.1_

  - [x] 10.2 Implement PermissionsGuard
    - Create guard implementing CanActivate interface
    - Extract required permissions from route metadata using Reflector
    - Get current user from request
    - Query role-based permissions by joining user roles with role permissions
    - Query user-specific permissions from UserPermission table
    - Compute effective permissions as UNION of both sets
    - Check if all required permissions are present in effective permissions
    - Return true if authorized, throw ForbiddenException if not
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 10.3 Write unit tests for permissions guard
    - Test authorization with role-based permissions only
    - Test authorization with user-specific permissions only
    - Test authorization with combination of both
    - Test denial when permission is missing
    - Test multiple required permissions
    - Test effective permissions calculation
    - _Requirements: 11.1, 11.2_

- [x] 11. Implement user management system
  - [x] 11.1 Create UserService with CRUD operations
    - Implement findAll method to list users for current tenant
    - Implement findOne method to get user by ID with roles and permissions (tenant-scoped)
    - Implement create method to create new user with tenantId and hashed password
    - Implement update method to update user details
    - Implement delete method to remove user and cascade role/permission assignments
    - Add validation for unique (email, tenantId)
    - _Requirements: 7.1, 7.2, 7.7_

  - [x] 11.2 Implement role assignment methods in UserService
    - Implement assignRoles method to replace user's roles via UserRole join table
    - Validate that roles belong to same tenant as user
    - Remove existing role assignments and create new ones in transaction
    - _Requirements: 7.4_

  - [x] 11.3 Implement user-specific permission methods in UserService
    - Implement assignPermissions method to add/remove user-specific permissions via UserPermission join table
    - Validate that permissions belong to same tenant as user
    - Implement getEffectivePermissions method that returns UNION of role-based and user-specific permissions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.5_

  - [x] 11.4 Create UserController with CRUD endpoints
    - Create GET /users endpoint with @Permissions('read:user')
    - Create POST /users endpoint with @Permissions('create:user')
    - Create PUT /users/:id endpoint with @Permissions('update:user')
    - Create PUT /users/:id/roles endpoint with @Permissions('update:user')
    - Create PUT /users/:id/permissions endpoint with @Permissions('update:user', 'grant:permission')
    - Create GET /users/:id/permissions endpoint with @Permissions('read:user')
    - Create DELETE /users/:id endpoint with @Permissions('delete:user')
    - Use CreateUserDto, UpdateUserDto, AssignRolesDto, and AssignPermissionsDto for validation
    - _Requirements: 7.3, 7.6_

  - [x] 11.5 Write unit tests for user management
    - Test user creation with automatic tenant scoping
    - Test duplicate email prevention within tenant
    - Test role assignment with validation
    - Test user-specific permission assignment
    - Test effective permissions calculation
    - Test cross-tenant role/permission assignment prevention
    - _Requirements: 11.1, 11.2_

- [x] 12. Implement example resource module (Projects)
  - [x] 12.1 Create ProjectService with CRUD operations
    - Implement findAll method to list projects for current tenant
    - Implement findOne method to get project by ID (tenant-scoped)
    - Implement create method that automatically sets tenantId and ownerId
    - Implement update method to update project (tenant-scoped)
    - Implement delete method to remove project (tenant-scoped)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 12.2 Create ProjectController with CRUD endpoints
    - Create GET /projects endpoint with @Permissions('read:project')
    - Create POST /projects endpoint with @Permissions('create:project')
    - Create PUT /projects/:id endpoint with @Permissions('update:project')
    - Create DELETE /projects/:id endpoint with @Permissions('delete:project')
    - Use CreateProjectDto and UpdateProjectDto for validation
    - _Requirements: 9.1, 9.4_

  - [x] 12.3 Write unit tests for project management
    - Test project creation with automatic tenantId and ownerId
    - Test tenant isolation in project queries
    - Test 404 response for cross-tenant access attempts
    - _Requirements: 11.1_

- [x] 13. Implement global error handling
  - [x] 13.1 Create GlobalExceptionFilter
    - Implement ExceptionFilter interface
    - Handle HttpException with status code and message
    - Handle PrismaClientKnownRequestError and map to appropriate HTTP codes
    - Handle generic errors as 500 Internal Server Error
    - Return standardized JSON error response with statusCode, message, error, timestamp, and path
    - Log errors with appropriate severity levels
    - _Requirements: 10.3, 10.4_

  - [x] 13.2 Register global exception filter in main.ts
    - Apply GlobalExceptionFilter to application
    - Configure global validation pipe with class-validator
    - _Requirements: 10.1, 10.2_

- [x] 14. Wire up application modules and middleware
  - [x] 14.1 Create AppModule with all module imports
    - Import ConfigModule with environment validation
    - Import TenantModule, AuthModule, UserModule, RoleModule, PermissionModule, ProjectModule
    - Configure TenantIdentificationMiddleware to run on all routes except /auth/register, /auth/login, /tenants
    - Register PrismaService as global provider
    - _Requirements: 12.1_

  - [x] 14.2 Configure main.ts bootstrap
    - Enable CORS with appropriate configuration
    - Set global prefix (/api)
    - Configure validation pipe with whitelist and transform options
    - Apply global exception filter
    - Set up Swagger/OpenAPI documentation
    - Configure graceful shutdown
    - _Requirements: 12.4_

- [x] 15. Create database migrations and seed script
  - [x] 15.1 Generate and apply Prisma migrations
    - Run prisma migrate dev to create initial migration
    - Verify migration creates all tables with correct schema
    - _Requirements: 1.1_

  - [x] 15.2 Create seed script for development data
    - Create seed.ts that creates a sample tenant with users, roles, and permissions
    - Create multiple users with different role combinations
    - Create sample projects
    - _Requirements: 11.5_

- [x] 16. Write integration tests
  - [x] 16.1 Set up test database configuration
    - Configure separate test database URL
    - Create test setup that runs migrations before tests
    - Create test teardown that cleans database after tests
    - _Requirements: 11.5_

  - [x] 16.2 Write integration tests for tenant provisioning
    - Test complete tenant registration flow creates all required records
    - Test transaction rollback on failure
    - Test default permissions and roles are created correctly
    - _Requirements: 11.2_

  - [x] 16.3 Write integration tests for authentication and authorization
    - Test login flow with JWT generation
    - Test JWT validation and user context extraction
    - Test permissions guard with role-based permissions
    - Test permissions guard with user-specific permissions
    - Test effective permissions calculation
    - _Requirements: 11.2_

  - [x] 16.4 Write integration tests for Prisma middleware
    - Test automatic tenant scoping on queries
    - Test automatic tenantId injection on creates
    - Test non-tenant-scoped models are not affected
    - _Requirements: 11.2_

- [-] 17. Write E2E tests for tenant isolation
  - [x] 17.1 Create E2E test setup with Supertest
    - Configure test application with test database
    - Create helper functions for authentication and request making
    - _Requirements: 11.3_

  - [x] 17.2 Write E2E tests for complete user workflows
    - Test: Register tenant → Login → Create project → Access project
    - Test: Admin creates user → Assigns role → User logs in → Accesses resources
    - Test: Admin creates custom permission → Assigns to role → User inherits permission
    - _Requirements: 11.3, 11.4_

  - [x] 17.3 Write E2E tests for tenant isolation
    - Create two separate tenants with users and projects
    - Test: Tenant A user cannot access Tenant B's projects (returns 404)
    - Test: Tenant A JWT doesn't work with Tenant B's tenant ID
    - Test: User queries only return data from their tenant
    - Test: Cross-tenant resource access attempts fail
    - _Requirements: 11.3, 11.4_

  - [x] 17.4 Write E2E tests for permission system
    - Test: User with permission can access protected route
    - Test: User without permission gets 403
    - Test: User-specific permission grants access
    - Test: Permission removal immediately revokes access
    - Test: Role permission changes affect all users with that role
    - _Requirements: 11.3_

- [x] 18. Create documentation
  - [x] 18.1 Write comprehensive README.md
    - Document project overview and architecture
    - Provide setup instructions (prerequisites, installation, database setup)
    - Explain multi-tenancy model and tenant identification
    - Explain hybrid RBAC system (roles + user-specific permissions)
    - Provide API usage examples with curl commands
    - Document environment variables
    - Include testing instructions
    - _Requirements: 12.3, 12.4, 12.5_

  - [x] 18.2 Generate OpenAPI/Swagger documentation
    - Add @nestjs/swagger decorators to all DTOs
    - Add API operation decorators to all controller endpoints
    - Configure Swagger module in main.ts
    - Document authentication requirements
    - Document tenant identification via header
    - _Requirements: 12.4_

  - [x] 18.3 Create API examples and Postman collection
    - Create Postman collection with all endpoints
    - Include environment variables for tenant ID and JWT token
    - Add example requests for complete workflows
    - Export collection to repository
    - _Requirements: 12.4_

- [x] 19. Add security enhancements
  - [x] 19.1 Implement rate limiting on authentication endpoints
    - Install @nestjs/throttler
    - Configure rate limiting for /auth/login endpoint
    - Add appropriate error responses for rate limit exceeded
    - _Requirements: 3.5_

  - [x] 19.2 Add security headers and CORS configuration
    - Configure helmet for security headers
    - Set up CORS with appropriate origin restrictions
    - Configure HTTPS-only cookies for production
    - _Requirements: 10.4_

  - [x] 19.3 Implement response sanitization
    - Create interceptor to remove password fields from responses
    - Ensure sensitive data is never exposed in error messages
    - _Requirements: 10.4_

- [x] 20. Final testing and validation
  - [x] 20.1 Run complete test suite
    - Execute all unit tests and verify coverage
    - Execute all integration tests
    - Execute all E2E tests
    - Generate and review code coverage report
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 20.2 Manual testing of critical flows
    - Manually test tenant registration and login
    - Manually test permission system with different role combinations
    - Manually test tenant isolation with multiple tenants
    - Verify all API endpoints work as documented
    - _Requirements: 11.4_

  - [x] 20.3 Code review and cleanup
    - Review all code for consistency and best practices
    - Remove any debug logging or commented code
    - Ensure all files have appropriate imports and exports
    - Verify TypeScript strict mode compliance
    - _Requirements: 10.1_
