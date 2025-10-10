# User Module Examples

## Service Integration Examples

### Basic User Operations

#### Creating a User
```typescript
import { UserService } from './user/user.service';
import { CreateUserDto } from './user/dto/create-user.dto';

@Injectable()
export class OnboardingService {
  constructor(private userService: UserService) {}

  async onboardNewUser(userData: CreateUserDto) {
    try {
      // Create user with automatic tenant isolation
      const user = await this.userService.create({
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName
      });

      console.log(`User created: ${user.id}`);
      return user;
    } catch (error) {
      if (error.message.includes('already exists')) {
        throw new ConflictException('User with this email already exists');
      }
      throw error;
    }
  }
}
```

#### Retrieving Users with Filtering
```typescript
@Injectable()
export class UserManagementService {
  constructor(private userService: UserService) {}

  async getUsersWithRoles() {
    // Get all users in current tenant with their roles
    const users = await this.userService.findAll();
    
    // Filter users with specific roles
    const adminUsers = users.filter(user => 
      user.roles.some(userRole => userRole.role.name === 'Admin')
    );

    return {
      totalUsers: users.length,
      adminUsers: adminUsers.length,
      users: users
    };
  }

  async getUserProfile(userId: string) {
    // Get detailed user information
    const user = await this.userService.findOne(userId);
    
    // Get effective permissions
    const permissions = await this.userService.getEffectivePermissions(userId);
    
    return {
      profile: user,
      permissions: permissions.effectivePermissions,
      roleCount: user.roles.length,
      directPermissionCount: user.permissions.length
    };
  }
}
```

### Role and Permission Management

#### Assigning Roles to Users
```typescript
@Injectable()
export class RoleAssignmentService {
  constructor(
    private userService: UserService,
    private roleService: RoleService
  ) {}

  async promoteUserToAdmin(userId: string) {
    // Find admin role in current tenant
    const adminRole = await this.roleService.findByName('Admin');
    
    if (!adminRole) {
      throw new NotFoundException('Admin role not found');
    }

    // Assign admin role to user
    const updatedUser = await this.userService.assignRoles(userId, {
      roleIds: [adminRole.id]
    });

    return {
      message: 'User promoted to admin',
      user: updatedUser
    };
  }

  async assignMultipleRoles(userId: string, roleNames: string[]) {
    // Get roles by names
    const roles = await Promise.all(
      roleNames.map(name => this.roleService.findByName(name))
    );

    const validRoles = roles.filter(role => role !== null);
    const roleIds = validRoles.map(role => role.id);

    // Assign all roles at once
    return await this.userService.assignRoles(userId, { roleIds });
  }
}
```

#### Managing Direct Permissions
```typescript
@Injectable()
export class PermissionService {
  constructor(
    private userService: UserService,
    private permissionService: PermissionService
  ) {}

  async grantProjectAccess(userId: string, projectId: string) {
    // Find project-specific permissions
    const readPermission = await this.permissionService.findByAction('read', 'Project');
    const updatePermission = await this.permissionService.findByAction('update', 'Project');

    // Grant direct permissions to user
    await this.userService.assignPermissions(userId, {
      permissionIds: [readPermission.id, updatePermission.id]
    });

    return { message: 'Project access granted' };
  }

  async auditUserPermissions(userId: string) {
    const permissions = await this.userService.getEffectivePermissions(userId);
    
    return {
      userId,
      summary: {
        totalPermissions: permissions.effectivePermissions.length,
        roleBasedPermissions: permissions.roleBasedPermissions.length,
        directPermissions: permissions.userSpecificPermissions.length
      },
      breakdown: {
        bySource: {
          role: permissions.roleBasedPermissions,
          direct: permissions.userSpecificPermissions
        },
        byAction: this.groupPermissionsByAction(permissions.effectivePermissions)
      }
    };
  }

  private groupPermissionsByAction(permissions: any[]) {
    return permissions.reduce((acc, perm) => {
      const key = `${perm.action}:${perm.subject}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }
}
```

### Authentication Integration

#### Multi-Authentication Method Support
```typescript
@Injectable()
export class AuthenticationService {
  constructor(private userService: UserService) {}

  async checkUserAuthMethods(userId: string) {
    const authMethods = await this.userService.getAuthMethods(userId);
    
    return {
      userId,
      supportedMethods: authMethods,
      hasPasswordAuth: authMethods.includes('password'),
      hasGoogleAuth: authMethods.includes('google'),
      canUseSSO: authMethods.includes('google')
    };
  }

  async findGoogleUsers() {
    // Find users who have Google authentication enabled
    const googleUsers = await this.userService.findByAuthMethod('google');
    
    return {
      count: googleUsers.length,
      users: googleUsers.map(user => ({
        id: user.id,
        email: user.email,
        googleLinkedAt: user.googleLinkedAt,
        hasPasswordFallback: user.authMethods.includes('password')
      }))
    };
  }
}
```

## API Usage Examples

### cURL Examples

#### Create a New User
```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

#### Get User with Permissions
```bash
curl -X GET http://localhost:3000/users/user-456/permissions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123"
```

#### Assign Roles to User
```bash
curl -X PUT http://localhost:3000/users/user-456/roles \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123" \
  -H "Content-Type: application/json" \
  -d '{
    "roleIds": ["role-admin", "role-editor"]
  }'
```

### JavaScript/TypeScript Client Examples

#### Using Fetch API
```typescript
class UserApiClient {
  constructor(
    private baseUrl: string,
    private token: string,
    private tenantId: string
  ) {}

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'x-tenant-id': this.tenantId,
      'Content-Type': 'application/json'
    };
  }

  async createUser(userData: CreateUserDto) {
    const response = await fetch(`${this.baseUrl}/users`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create user: ${error.message}`);
    }

    return response.json();
  }

  async getUserPermissions(userId: string) {
    const response = await fetch(`${this.baseUrl}/users/${userId}/permissions`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user permissions');
    }

    return response.json();
  }

  async assignRoles(userId: string, roleIds: string[]) {
    const response = await fetch(`${this.baseUrl}/users/${userId}/roles`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ roleIds })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to assign roles: ${error.message}`);
    }

    return response.json();
  }
}

// Usage
const client = new UserApiClient(
  'http://localhost:3000',
  'your-jwt-token',
  'your-tenant-id'
);

// Create user
const newUser = await client.createUser({
  email: 'user@example.com',
  password: 'SecurePass123!',
  firstName: 'Jane',
  lastName: 'Smith'
});

// Get permissions
const permissions = await client.getUserPermissions(newUser.id);

// Assign roles
await client.assignRoles(newUser.id, ['role-user', 'role-editor']);
```

#### Using Axios
```typescript
import axios, { AxiosInstance } from 'axios';

class UserService {
  private api: AxiosInstance;

  constructor(baseUrl: string, token: string, tenantId: string) {
    this.api = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          throw new Error('Authentication failed');
        }
        if (error.response?.status === 403) {
          throw new Error('Insufficient permissions');
        }
        if (error.response?.status === 404) {
          throw new Error('User not found');
        }
        throw error;
      }
    );
  }

  async getUsers() {
    const response = await this.api.get('/users');
    return response.data;
  }

  async getUser(id: string) {
    const response = await this.api.get(`/users/${id}`);
    return response.data;
  }

  async createUser(userData: CreateUserDto) {
    const response = await this.api.post('/users', userData);
    return response.data;
  }

  async updateUser(id: string, userData: UpdateUserDto) {
    const response = await this.api.put(`/users/${id}`, userData);
    return response.data;
  }

  async deleteUser(id: string) {
    const response = await this.api.delete(`/users/${id}`);
    return response.data;
  }

  async assignRoles(id: string, roleIds: string[]) {
    const response = await this.api.put(`/users/${id}/roles`, { roleIds });
    return response.data;
  }

  async assignPermissions(id: string, permissionIds: string[]) {
    const response = await this.api.put(`/users/${id}/permissions`, { permissionIds });
    return response.data;
  }

  async getUserPermissions(id: string) {
    const response = await this.api.get(`/users/${id}/permissions`);
    return response.data;
  }
}
```

## Testing Examples

### Unit Testing User Service
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

describe('UserService', () => {
  let service: UserService;
  let prismaService: PrismaService;
  let tenantContextService: TenantContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            getRequiredTenantId: jest.fn().mockReturnValue('tenant-123'),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get<PrismaService>(PrismaService);
    tenantContextService = module.get<TenantContextService>(TenantContextService);
  });

  describe('findAll', () => {
    it('should return users for current tenant', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          password: 'hashed-password',
          tenantId: 'tenant-123',
          roles: []
        }
      ];

      jest.spyOn(prismaService.user, 'findMany').mockResolvedValue(mockUsers);

      const result = await service.findAll();

      expect(prismaService.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' }
      });

      expect(result[0]).not.toHaveProperty('password');
      expect(result[0].id).toBe('user-1');
    });
  });

  describe('create', () => {
    it('should create user with hashed password', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'plaintext-password',
        firstName: 'Test',
        lastName: 'User'
      };

      const mockCreatedUser = {
        id: 'user-new',
        email: 'test@example.com',
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        tenantId: 'tenant-123',
        authMethods: ['password'],
        roles: []
      };

      jest.spyOn(prismaService.user, 'create').mockResolvedValue(mockCreatedUser);

      const result = await service.create(createUserDto);

      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          password: expect.any(String), // Hashed password
          firstName: 'Test',
          lastName: 'User',
          tenantId: 'tenant-123',
          authMethods: ['password']
        },
        include: { roles: { include: { role: true } } }
      });

      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe('user-new');
    });
  });
});
```

### Integration Testing
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let authToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // Setup test tenant and get auth token
    const { token, tenant } = await setupTestTenant();
    authToken = token;
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  describe('/users (POST)', () => {
    it('should create a new user', () => {
      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          firstName: 'New',
          lastName: 'User'
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.email).toBe('newuser@example.com');
          expect(res.body.firstName).toBe('New');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should return 409 for duplicate email', () => {
      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123!'
        })
        .expect(409);
    });
  });

  describe('/users/:id/permissions (GET)', () => {
    it('should return user effective permissions', async () => {
      const user = await createTestUser();
      
      return request(app.getHttpServer())
        .get(`/users/${user.id}/permissions`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200)
        .expect((res) => {
          expect(res.body.userId).toBe(user.id);
          expect(res.body.effectivePermissions).toBeInstanceOf(Array);
          expect(res.body.roleBasedPermissions).toBeInstanceOf(Array);
          expect(res.body.userSpecificPermissions).toBeInstanceOf(Array);
        });
    });
  });
});
```

## Error Handling Examples

### Service-Level Error Handling
```typescript
@Injectable()
export class UserManagementService {
  constructor(private userService: UserService) {}

  async safeCreateUser(userData: CreateUserDto) {
    try {
      return await this.userService.create(userData);
    } catch (error) {
      if (error instanceof ConflictException) {
        return {
          success: false,
          error: 'USER_EXISTS',
          message: 'A user with this email already exists'
        };
      }
      
      if (error.message.includes('validation')) {
        return {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid user data provided'
        };
      }

      // Log unexpected errors
      console.error('Unexpected error creating user:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      };
    }
  }

  async safeAssignRoles(userId: string, roleIds: string[]) {
    try {
      return await this.userService.assignRoles(userId, { roleIds });
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found in current tenant'
        };
      }

      if (error instanceof BadRequestException) {
        return {
          success: false,
          error: 'INVALID_ROLES',
          message: 'One or more roles are invalid or from different tenant'
        };
      }

      throw error; // Re-throw unexpected errors
    }
  }
}
```

### Client-Side Error Handling
```typescript
class UserApiClient {
  async createUserWithErrorHandling(userData: CreateUserDto) {
    try {
      const user = await this.createUser(userData);
      return { success: true, data: user };
    } catch (error) {
      if (error.response?.status === 409) {
        return {
          success: false,
          error: 'USER_EXISTS',
          message: 'A user with this email already exists'
        };
      }

      if (error.response?.status === 400) {
        return {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: error.response.data
        };
      }

      if (error.response?.status === 403) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to create users'
        };
      }

      return {
        success: false,
        error: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred'
      };
    }
  }
}
```