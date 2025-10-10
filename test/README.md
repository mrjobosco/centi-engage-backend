# Integration Tests

This directory contains integration tests for the multi-tenant NestJS application.

## Test Suites

### 1. Tenant Provisioning Tests (`tenant-provisioning.integration-spec.ts`)
Tests the complete tenant registration flow including:
- Creating tenant with all default records (permissions, roles, admin user)
- Transaction rollback on failure
- Duplicate tenant name handling
- Default permissions creation
- Default roles with correct permission assignments
- Password hashing

### 2. Authentication and Authorization Tests (`auth-authorization.integration-spec.ts`)
Tests the authentication and authorization system including:
- Login flow with JWT generation
- JWT validation and user context extraction
- Permissions guard with role-based permissions
- Permissions guard with user-specific permissions
- Effective permissions calculation (UNION of role-based and user-specific)
- Invalid credentials handling

### 3. Prisma Middleware Tests (`prisma-middleware.integration-spec.ts`)
Tests the automatic tenant scoping middleware including:
- Automatic tenant scoping on queries (findMany, findFirst, findUnique)
- Automatic tenantId injection on creates
- Cross-tenant access prevention
- Non-tenant-scoped models (Tenant model itself)

**Note**: The Prisma middleware is also implicitly tested through all other integration tests, as every database operation goes through the middleware when using PrismaService.

## Running Tests

```bash
# Run all integration tests
npm run test:integration

# Run specific test suite
npm run test:integration tenant-provisioning
npm run test:integration auth-authorization
npm run test:integration prisma-middleware
```

## Test Database

Integration tests use a separate test database configured in `.env.test`:
- Database: `multitenant_db_test`
- The database is cleaned before each test to ensure isolation
- Migrations are automatically applied before tests run

## Test Setup

The `integration-setup.ts` file handles:
- Loading test environment variables
- Running database migrations
- Cleaning the database before each test
- Disconnecting from the database after all tests

## Coverage

The integration tests cover:
- ✅ Tenant provisioning with transaction atomicity
- ✅ Authentication (login, JWT generation)
- ✅ Authorization (permissions guard, role-based and user-specific permissions)
- ✅ Tenant isolation at the database level
- ✅ Automatic tenant scoping through Prisma middleware
- ✅ Error handling and validation

## Notes

- Tests run sequentially (`--runInBand`) to avoid database conflicts
- Each test suite is isolated and cleans up after itself
- The test database should be separate from development database
- Middleware functionality is tested both directly and indirectly through other tests
