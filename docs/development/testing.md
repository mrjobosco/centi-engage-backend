# Testing Guide

This guide covers the testing strategies, setup, and best practices for the multi-tenant NestJS application. The application uses a comprehensive testing approach with unit tests, integration tests, and end-to-end (E2E) tests.

## Testing Strategy Overview

The application follows a three-tier testing strategy:

1. **Unit Tests** - Test individual components in isolation
2. **Integration Tests** - Test module interactions and database operations
3. **End-to-End Tests** - Test complete user workflows and API endpoints

## Test Types and Structure

### Unit Tests

Unit tests focus on testing individual classes, services, and functions in isolation.

**Location**: `src/**/*.spec.ts`
**Purpose**: Test business logic, validation, and individual component behavior
**Mocking**: External dependencies are mocked

**Example Structure**:
```typescript
// src/auth/auth.service.spec.ts
describe('AuthService', () => {
  let service: AuthService;
  let mockPrismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mockPrismaService = module.get(PrismaService);
  });

  it('should validate user credentials', async () => {
    // Test implementation
  });
});
```

### Integration Tests

Integration tests verify that different modules work together correctly, particularly focusing on database operations and tenant isolation.

**Location**: `test/**/*.integration-spec.ts`
**Purpose**: Test module interactions, database operations, and tenant isolation
**Database**: Uses a separate test database with real data

**Key Integration Test Suites**:

1. **Tenant Provisioning** (`tenant-provisioning.integration-spec.ts`)
   - Tests complete tenant registration flow
   - Verifies transaction atomicity
   - Tests default permissions and roles creation

2. **Authentication & Authorization** (`auth-authorization.integration-spec.ts`)
   - Tests JWT authentication flow
   - Verifies role-based access control
   - Tests permission inheritance and effective permissions

3. **Prisma Middleware** (`prisma-middleware.integration-spec.ts`)
   - Tests automatic tenant scoping
   - Verifies cross-tenant access prevention
   - Tests tenant ID injection on creates

4. **Notification System** (`notification-*.integration-spec.ts`)
   - Tests notification creation and delivery
   - Verifies tenant isolation for notifications
   - Tests preference management

### End-to-End Tests

E2E tests simulate real user interactions through the complete application stack.

**Location**: `test/**/*.e2e-spec.ts`
**Purpose**: Test complete user workflows and API endpoints
**Scope**: Full application stack including HTTP requests

**Key E2E Test Suites**:

1. **Application Bootstrap** (`app.e2e-spec.ts`)
   - Tests application startup
   - Verifies health endpoints

2. **Permission System** (`permission-system.e2e-spec.ts`)
   - Tests complete RBAC workflows
   - Verifies API-level permission enforcement

3. **Tenant Isolation** (`tenant-isolation.e2e-spec.ts`)
   - Tests tenant data isolation
   - Verifies cross-tenant access prevention

4. **Notification API** (`notification-*.e2e-spec.ts`)
   - Tests notification API endpoints
   - Verifies authentication and authorization
   - Tests preference management APIs

## Test Database Setup

### Configuration

The application uses separate databases for different test types:

- **Unit Tests**: No database (mocked)
- **Integration Tests**: `multitenant_db_test` (configured in `.env.test`)
- **E2E Tests**: `multitenant_db_test` (shared with integration tests)

### Environment Setup

Create a `.env.test` file with test-specific configuration:

```bash
# Test Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/multitenant_db_test"

# Test JWT Configuration
JWT_SECRET="test-secret-key-for-testing-only"
JWT_EXPIRATION="1h"

# Test Redis (optional, can use same as development)
REDIS_URL="redis://localhost:6379"

# Disable external services in tests
EMAIL_PROVIDER="smtp"
SMS_PROVIDER="twilio"
ALERTING_ENABLED=false

# Test-specific settings
NODE_ENV="test"
PORT=3001
```

### Database Initialization

1. **Create Test Database**:
```bash
createdb multitenant_db_test
```

2. **Run Setup Script**:
```bash
npm run test:integration:setup
```

This script:
- Creates the test database if it doesn't exist
- Runs all migrations
- Prepares the database for testing

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm test

# Run unit tests in watch mode
npm run test:watch

# Run unit tests with coverage
npm run test:cov

# Run specific test file
npm test -- auth.service.spec.ts

# Run tests matching a pattern
npm test -- --testNamePattern="should validate"
```

### Integration Tests

```bash
# Setup test database (run once)
npm run test:integration:setup

# Run all integration tests
npm run test:integration

# Run specific integration test
npm run test:integration -- tenant-provisioning

# Run integration tests with verbose output
npm run test:integration -- --verbose
```

### End-to-End Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific E2E test
npm run test:e2e -- app.e2e-spec.ts

# Run E2E tests with verbose output
npm run test:e2e -- --verbose
```

### All Tests

```bash
# Run all test types
npm run test && npm run test:integration && npm run test:e2e
```

## Testing Tenant-Isolated Functionality

### Tenant Context in Tests

When testing tenant-isolated functionality, always ensure proper tenant context:

```typescript
describe('Tenant-isolated functionality', () => {
  let app: INestApplication;
  let tenant1: TestTenant;
  let tenant2: TestTenant;
  let user1: TestUser;
  let user2: TestUser;

  beforeEach(async () => {
    app = await setupTestApp();
    
    // Create two separate tenants
    const tenant1Data = await registerTenant(app, {
      tenantName: 'Tenant 1',
      adminEmail: 'admin1@tenant1.com',
      adminPassword: 'password123',
      adminFirstName: 'Admin',
      adminLastName: 'One',
    });
    
    const tenant2Data = await registerTenant(app, {
      tenantName: 'Tenant 2',
      adminEmail: 'admin2@tenant2.com',
      adminPassword: 'password123',
      adminFirstName: 'Admin',
      adminLastName: 'Two',
    });

    tenant1 = tenant1Data.tenant;
    tenant2 = tenant2Data.tenant;
    user1 = tenant1Data.user;
    user2 = tenant2Data.user;
  });

  it('should isolate data between tenants', async () => {
    // Login users from different tenants
    const token1 = await loginUser(app, tenant1.id, user1.email, 'password123');
    const token2 = await loginUser(app, tenant2.id, user2.email, 'password123');

    // Create data in tenant 1
    const project1 = await createProject(app, tenant1.id, token1, {
      name: 'Tenant 1 Project',
    });

    // Verify tenant 2 cannot access tenant 1's data
    const response = await request(app.getHttpServer())
      .get(`/projects/${project1.id}`)
      .set('x-tenant-id', tenant2.id)
      .set('Authorization', `Bearer ${token2}`)
      .expect(404);
  });
});
```

### Testing Permission-Based Access

```typescript
describe('Permission-based access', () => {
  it('should enforce permission requirements', async () => {
    // Create user with specific permissions
    const user = await createUserWithPermissions(
      app,
      tenant.id,
      adminToken,
      {
        email: 'user@example.com',
        password: 'password123',
      },
      ['read:project'] // Only read permission, no create
    );

    const userToken = await loginUser(app, tenant.id, user.email, 'password123');

    // Should be able to read projects
    await request(app.getHttpServer())
      .get('/projects')
      .set('x-tenant-id', tenant.id)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // Should NOT be able to create projects
    await request(app.getHttpServer())
      .post('/projects')
      .set('x-tenant-id', tenant.id)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'New Project' })
      .expect(403);
  });
});
```

## Test Data Seeding

### Using Prisma Seed

The application includes a seed script for consistent test data:

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test tenants
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Test Tenant',
      subdomain: 'test',
    },
  });

  // Create test users, roles, permissions, etc.
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Custom Test Helpers

Use the test helpers in `test/e2e-setup.ts` for consistent test data creation:

```typescript
// Create a complete test scenario
const { tenant, user } = await registerTenant(app, {
  tenantName: 'Test Company',
  adminEmail: 'admin@test.com',
  adminPassword: 'password123',
  adminFirstName: 'Test',
  adminLastName: 'Admin',
});

// Create additional users with specific roles
const memberUser = await createUserWithRole(
  app,
  tenant.id,
  adminToken,
  {
    email: 'member@test.com',
    password: 'password123',
  },
  'Member'
);
```

## Writing Effective Tests

### Test Structure Best Practices

1. **Follow AAA Pattern** (Arrange, Act, Assert):
```typescript
it('should create a project', async () => {
  // Arrange
  const projectData = { name: 'Test Project', description: 'Test Description' };
  
  // Act
  const result = await projectService.create(projectData, tenantId, userId);
  
  // Assert
  expect(result).toBeDefined();
  expect(result.name).toBe(projectData.name);
});
```

2. **Use Descriptive Test Names**:
```typescript
// Good
it('should return 403 when user lacks create:project permission')

// Bad
it('should fail')
```

3. **Test Edge Cases**:
```typescript
describe('ProjectService', () => {
  it('should handle empty project name');
  it('should handle duplicate project names');
  it('should handle invalid tenant ID');
  it('should handle missing user permissions');
});
```

### Mocking Best Practices

1. **Mock External Dependencies**:
```typescript
const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
};

const mockSmsService = {
  sendSms: jest.fn().mockResolvedValue({ success: true }),
};
```

2. **Use Factory Functions for Test Data**:
```typescript
function createMockUser(overrides = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    tenantId: 'tenant-123',
    ...overrides,
  };
}
```

3. **Reset Mocks Between Tests**:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Testing Async Operations

1. **Use async/await**:
```typescript
it('should handle async operations', async () => {
  const result = await service.asyncMethod();
  expect(result).toBeDefined();
});
```

2. **Test Error Handling**:
```typescript
it('should handle service errors', async () => {
  mockService.method.mockRejectedValue(new Error('Service error'));
  
  await expect(service.callMethod()).rejects.toThrow('Service error');
});
```

## Test Coverage

### Coverage Goals

- **Unit Tests**: Aim for 80%+ code coverage
- **Integration Tests**: Cover all critical business flows
- **E2E Tests**: Cover all user-facing functionality

### Generating Coverage Reports

```bash
# Generate coverage report
npm run test:cov

# View coverage report
open coverage/lcov-report/index.html
```

### Coverage Configuration

Coverage is configured in `package.json`:

```json
{
  "jest": {
    "collectCoverageFrom": [
      "**/*.(t|j)s",
      "**/*.(t|j)sx",
      "!**/*.spec.ts",
      "!**/*.e2e-spec.ts",
      "!**/*.integration-spec.ts"
    ],
    "coverageDirectory": "../coverage",
    "coverageReporters": ["text", "lcov", "html"]
  }
}
```

## Debugging Tests

### VS Code Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "name": "Debug Jest Tests",
  "type": "node",
  "request": "launch",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache", "--no-coverage"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen",
  "env": {
    "NODE_ENV": "test"
  }
}
```

### Debug Specific Test

```bash
# Debug specific test file
npm run test:debug -- auth.service.spec.ts

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand auth.service.spec.ts
```

### Common Debugging Techniques

1. **Use console.log for debugging**:
```typescript
it('should debug test', () => {
  console.log('Debug info:', testData);
  expect(result).toBe(expected);
});
```

2. **Use Jest's debugging methods**:
```typescript
// Print object structure
console.log(JSON.stringify(result, null, 2));

// Use Jest's expect.objectContaining for partial matches
expect(result).toEqual(expect.objectContaining({
  id: expect.any(String),
  name: 'Test Project',
}));
```

## Continuous Integration

### GitHub Actions Configuration

The project includes automated testing in CI/CD:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run test
      - run: npm run test:integration
      - run: npm run test:e2e
```

### Test Performance

- **Parallel Execution**: Unit tests run in parallel by default
- **Sequential Execution**: Integration and E2E tests run sequentially (`--runInBand`) to avoid database conflicts
- **Test Timeouts**: Configured appropriately for each test type

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Ensure test database exists
   - Check `.env.test` configuration
   - Verify PostgreSQL is running

2. **Port Conflicts**:
   - Use different ports for test environment
   - Ensure no other services are running on test ports

3. **Memory Issues**:
   - Increase Node.js memory limit: `--max-old-space-size=4096`
   - Clean up resources in test teardown

4. **Flaky Tests**:
   - Ensure proper test isolation
   - Clean database between tests
   - Avoid time-dependent assertions

### Performance Optimization

1. **Database Cleanup**:
   - Use transactions for faster cleanup
   - Truncate tables instead of deleting rows

2. **Test Parallelization**:
   - Run unit tests in parallel
   - Use separate test databases for parallel integration tests

3. **Mock External Services**:
   - Mock HTTP requests
   - Mock file system operations
   - Mock time-dependent functions

## Best Practices Summary

1. **Test Structure**:
   - Use descriptive test names
   - Follow AAA pattern (Arrange, Act, Assert)
   - Group related tests in describe blocks

2. **Test Data**:
   - Use factory functions for test data
   - Clean up data between tests
   - Use realistic test data

3. **Assertions**:
   - Be specific with assertions
   - Test both success and error cases
   - Use appropriate Jest matchers

4. **Maintenance**:
   - Keep tests simple and focused
   - Update tests when code changes
   - Remove obsolete tests

5. **Performance**:
   - Mock external dependencies
   - Use appropriate test timeouts
   - Clean up resources properly

This testing guide provides a comprehensive foundation for maintaining high-quality, reliable tests across the multi-tenant NestJS application.