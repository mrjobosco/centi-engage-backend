# Tenant Module Usage Examples

## Overview

This document provides practical examples of how to use the tenant module components in various scenarios within the multi-tenant NestJS application.

## Basic Usage Examples

### 1. Setting Up Tenant Identification

#### Configure Tenant Middleware

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TenantIdentificationMiddleware } from './tenant/tenant-identification.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Apply tenant identification middleware to all API routes
  app.use('/api/*', TenantIdentificationMiddleware);
  
  await app.listen(3000);
}
bootstrap();
```

#### Alternative: Apply to Specific Routes

```typescript
// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TenantIdentificationMiddleware } from './tenant/tenant-identification.middleware';

@Module({
  // ... module configuration
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantIdentificationMiddleware)
      .forRoutes(
        'users',
        'projects',
        'notifications',
        // Exclude tenant registration endpoint
        { path: 'tenants', method: RequestMethod.POST, exclude: true }
      );
  }
}
```

### 2. Creating Tenant-Aware Services

#### Basic Tenant-Aware Service

```typescript
// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async findAll() {
    // Tenant scoping is automatic via database middleware
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async create(createUserDto: CreateUserDto) {
    // Tenant ID is automatically injected by middleware
    return this.prisma.user.create({
      data: {
        ...createUserDto,
        password: await bcrypt.hash(createUserDto.password, 10),
      },
    });
  }

  async getCurrentTenantUsers() {
    const tenantId = this.tenantContext.getRequiredTenantId();
    
    // Explicit tenant validation (optional, as middleware handles this)
    return this.prisma.user.findMany({
      where: { tenantId }, // Redundant but explicit
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

#### Advanced Service with Tenant Validation

```typescript
// src/project/project.service.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async findAll(userId?: string) {
    const query: any = {
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    };

    // Filter by user if specified
    if (userId) {
      query.where = { ownerId: userId };
    }

    return this.prisma.project.findMany(query);
  }

  async create(createProjectDto: CreateProjectDto, ownerId: string) {
    // Verify owner belongs to current tenant
    await this.validateUserBelongsToTenant(ownerId);

    return this.prisma.project.create({
      data: {
        ...createProjectDto,
        ownerId,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async update(id: string, updateProjectDto: UpdateProjectDto, userId: string) {
    // First, verify project exists and belongs to current tenant
    const project = await this.findById(id);

    // Check if user can modify this project (owner or admin)
    const canModify = await this.canUserModifyProject(project.id, userId);
    
    if (!canModify) {
      throw new ForbiddenException('You can only modify your own projects');
    }

    return this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  private async validateUserBelongsToTenant(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Additional validation (middleware already ensures tenant scoping)
    const currentTenantId = this.tenantContext.getRequiredTenantId();
    if (user.tenantId !== currentTenantId) {
      throw new ForbiddenException('User does not belong to current tenant');
    }
  }

  private async canUserModifyProject(projectId: string, userId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });

    if (!project) {
      return false;
    }

    // User can modify if they own the project
    if (project.ownerId === userId) {
      return true;
    }

    // Or if they have admin role (implement role checking logic)
    const userRoles = await this.getUserRoles(userId);
    return userRoles.some(role => role.name === 'Admin');
  }

  private async getUserRoles(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return user?.roles.map(ur => ur.role) || [];
  }
}
```

### 3. Client-Side Integration Examples

#### Frontend API Client Setup

```typescript
// frontend/src/api/client.ts
import axios, { AxiosInstance } from 'axios';

class ApiClient {
  private client: AxiosInstance;
  private tenantId: string | null = null;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
    });

    // Add request interceptor to include tenant ID
    this.client.interceptors.request.use((config) => {
      if (this.tenantId) {
        config.headers['x-tenant-id'] = this.tenantId;
      }

      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 400 && 
            error.response?.data?.message?.includes('Tenant identification')) {
          // Redirect to tenant selection or login
          this.handleTenantError();
        }
        return Promise.reject(error);
      }
    );
  }

  setTenant(tenantId: string) {
    this.tenantId = tenantId;
    localStorage.setItem('tenantId', tenantId);
  }

  getTenant(): string | null {
    return this.tenantId || localStorage.getItem('tenantId');
  }

  private handleTenantError() {
    // Clear tenant info and redirect
    this.tenantId = null;
    localStorage.removeItem('tenantId');
    window.location.href = '/select-tenant';
  }

  // API methods
  async getUsers() {
    const response = await this.client.get('/users');
    return response.data;
  }

  async createUser(userData: any) {
    const response = await this.client.post('/users', userData);
    return response.data;
  }

  async getProjects() {
    const response = await this.client.get('/projects');
    return response.data;
  }
}

export const apiClient = new ApiClient(process.env.REACT_APP_API_URL || 'http://localhost:3000/api');
```

#### React Hook for Tenant Management

```typescript
// frontend/src/hooks/useTenant.ts
import { useState, useEffect, createContext, useContext } from 'react';
import { apiClient } from '../api/client';

interface TenantContextType {
  tenantId: string | null;
  tenantInfo: any | null;
  setTenant: (tenantId: string) => Promise<void>;
  clearTenant: () => void;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load tenant from localStorage on app start
    const savedTenantId = localStorage.getItem('tenantId');
    if (savedTenantId) {
      setTenant(savedTenantId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const setTenant = async (newTenantId: string) => {
    setIsLoading(true);
    try {
      apiClient.setTenant(newTenantId);
      
      // Fetch tenant information
      const tenantData = await apiClient.get(`/tenants/${newTenantId}`);
      
      setTenantId(newTenantId);
      setTenantInfo(tenantData);
      localStorage.setItem('tenantId', newTenantId);
    } catch (error) {
      console.error('Failed to set tenant:', error);
      clearTenant();
    } finally {
      setIsLoading(false);
    }
  };

  const clearTenant = () => {
    setTenantId(null);
    setTenantInfo(null);
    localStorage.removeItem('tenantId');
    apiClient.setTenant('');
  };

  return (
    <TenantContext.Provider value={{
      tenantId,
      tenantInfo,
      setTenant,
      clearTenant,
      isLoading,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
```

#### Tenant Selection Component

```typescript
// frontend/src/components/TenantSelector.tsx
import React, { useState, useEffect } from 'react';
import { useTenant } from '../hooks/useTenant';
import { apiClient } from '../api/client';

interface Tenant {
  id: string;
  name: string;
  subdomain: string | null;
}

export function TenantSelector() {
  const { setTenant, isLoading } = useTenant();
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  useEffect(() => {
    loadAvailableTenants();
  }, []);

  const loadAvailableTenants = async () => {
    try {
      // This would typically come from user's accessible tenants
      const tenants = await apiClient.get('/user/tenants');
      setAvailableTenants(tenants);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    }
  };

  const handleTenantSelect = async () => {
    if (selectedTenantId) {
      await setTenant(selectedTenantId);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="tenant-selector">
      <h2>Select Tenant</h2>
      <select 
        value={selectedTenantId} 
        onChange={(e) => setSelectedTenantId(e.target.value)}
      >
        <option value="">Choose a tenant...</option>
        {availableTenants.map(tenant => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name}
          </option>
        ))}
      </select>
      <button 
        onClick={handleTenantSelect}
        disabled={!selectedTenantId}
      >
        Continue
      </button>
    </div>
  );
}
```

## Advanced Usage Examples

### 4. Custom Tenant Guards

#### Tenant Ownership Guard

```typescript
// src/common/guards/tenant-ownership.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

@Injectable()
export class TenantOwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const resourceId = request.params.id;
    const resourceType = this.reflector.get<string>('resourceType', context.getHandler());

    if (!resourceType || !resourceId) {
      return true; // Skip if no resource type specified
    }

    const currentTenantId = this.tenantContext.getRequiredTenantId();

    // Check resource ownership based on type
    const resource = await this.getResource(resourceType, resourceId);

    if (!resource) {
      throw new ForbiddenException('Resource not found');
    }

    if (resource.tenantId !== currentTenantId) {
      throw new ForbiddenException('Resource belongs to different tenant');
    }

    return true;
  }

  private async getResource(resourceType: string, resourceId: string) {
    switch (resourceType) {
      case 'project':
        return this.prisma.project.findUnique({
          where: { id: resourceId },
          select: { tenantId: true },
        });
      case 'user':
        return this.prisma.user.findUnique({
          where: { id: resourceId },
          select: { tenantId: true },
        });
      case 'notification':
        return this.prisma.notification.findUnique({
          where: { id: resourceId },
          select: { tenantId: true },
        });
      default:
        return null;
    }
  }
}

// Decorator to specify resource type
export const ResourceType = (type: string) => SetMetadata('resourceType', type);
```

#### Usage of Custom Guard

```typescript
// src/project/project.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { TenantOwnershipGuard, ResourceType } from '../common/guards/tenant-ownership.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Get(':id')
  @UseGuards(TenantOwnershipGuard)
  @ResourceType('project')
  async findOne(@Param('id') id: string) {
    return this.projectService.findById(id);
  }

  @Delete(':id')
  @UseGuards(TenantOwnershipGuard)
  @ResourceType('project')
  async remove(@Param('id') id: string) {
    return this.projectService.remove(id);
  }
}
```

### 5. Tenant-Aware Caching

#### Redis-Based Tenant Cache

```typescript
// src/cache/tenant-cache.service.ts
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class TenantCacheService {
  private redis: Redis;

  constructor(private tenantContext: TenantContextService) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    });
  }

  private getTenantKey(key: string, tenantId?: string): string {
    const effectiveTenantId = tenantId || this.tenantContext.getRequiredTenantId();
    return `tenant:${effectiveTenantId}:${key}`;
  }

  async get<T>(key: string, tenantId?: string): Promise<T | null> {
    const tenantKey = this.getTenantKey(key, tenantId);
    const value = await this.redis.get(tenantKey);
    return value ? JSON.parse(value) : null;
  }

  async set<T>(key: string, value: T, ttl = 3600, tenantId?: string): Promise<void> {
    const tenantKey = this.getTenantKey(key, tenantId);
    await this.redis.setex(tenantKey, ttl, JSON.stringify(value));
  }

  async del(key: string, tenantId?: string): Promise<void> {
    const tenantKey = this.getTenantKey(key, tenantId);
    await this.redis.del(tenantKey);
  }

  async clearTenant(tenantId: string): Promise<void> {
    const pattern = `tenant:${tenantId}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl = 3600,
    tenantId?: string,
  ): Promise<T> {
    const cached = await this.get<T>(key, tenantId);
    
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl, tenantId);
    return value;
  }
}
```

#### Using Tenant Cache in Services

```typescript
// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { TenantCacheService } from '../cache/tenant-cache.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private tenantCache: TenantCacheService,
  ) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const cacheKey = `user-permissions:${userId}`;
    
    return this.tenantCache.getOrSet(
      cacheKey,
      async () => {
        // Expensive database query
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        });

        // Process and return permissions
        const rolePermissions = user?.roles.flatMap(ur => 
          ur.role.permissions.map(rp => `${rp.permission.action}:${rp.permission.subject}`)
        ) || [];

        const directPermissions = user?.permissions.map(up => 
          `${up.permission.action}:${up.permission.subject}`
        ) || [];

        return [...new Set([...rolePermissions, ...directPermissions])];
      },
      300, // 5 minutes TTL
    );
  }

  async updateUser(userId: string, updateData: any) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Invalidate cache
    await this.tenantCache.del(`user-permissions:${userId}`);

    return user;
  }
}
```

### 6. Tenant Registration Examples

#### Complete Tenant Registration Flow

```typescript
// src/tenant/tenant-registration.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { EmailService } from '../email/email.service';

interface TenantRegistrationInput {
  tenantName: string;
  subdomain?: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  companySize?: string;
  industry?: string;
}

@Injectable()
export class TenantRegistrationService {
  constructor(
    private tenantService: TenantService,
    private emailService: EmailService,
  ) {}

  async registerTenant(input: TenantRegistrationInput) {
    // Validate subdomain availability if provided
    if (input.subdomain) {
      await this.validateSubdomain(input.subdomain);
    }

    // Create tenant with admin user
    const result = await this.tenantService.createTenant({
      tenantName: input.tenantName,
      adminEmail: input.adminEmail,
      adminPassword: input.adminPassword,
      adminFirstName: input.adminFirstName,
      adminLastName: input.adminLastName,
    });

    // Update tenant with additional info
    if (input.subdomain) {
      await this.prisma.tenant.update({
        where: { id: result.tenant.id },
        data: { subdomain: input.subdomain },
      });
    }

    // Send welcome email
    await this.sendWelcomeEmail(result.adminUser.email, {
      tenantName: result.tenant.name,
      tenantId: result.tenant.id,
      adminName: `${result.adminUser.firstName} ${result.adminUser.lastName}`,
    });

    // Create sample data (optional)
    await this.createSampleData(result.tenant.id, result.adminUser.id);

    return {
      tenant: result.tenant,
      adminUser: result.adminUser,
      loginUrl: this.getLoginUrl(result.tenant),
    };
  }

  private async validateSubdomain(subdomain: string) {
    // Check format
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      throw new ConflictException('Invalid subdomain format');
    }

    // Check availability
    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (existing) {
      throw new ConflictException('Subdomain already taken');
    }

    // Check against reserved words
    const reserved = ['api', 'www', 'admin', 'app', 'mail', 'ftp'];
    if (reserved.includes(subdomain)) {
      throw new ConflictException('Subdomain is reserved');
    }
  }

  private async sendWelcomeEmail(email: string, data: any) {
    await this.emailService.send({
      to: email,
      subject: 'Welcome to Our Platform!',
      template: 'tenant-welcome',
      data,
    });
  }

  private async createSampleData(tenantId: string, adminUserId: string) {
    // Create sample project
    await this.prisma.project.create({
      data: {
        name: 'Sample Project',
        description: 'This is a sample project to get you started',
        tenantId,
        ownerId: adminUserId,
      },
    });

    // Create sample notification preferences
    await this.prisma.notificationPreference.create({
      data: {
        tenantId,
        userId: adminUserId,
        category: 'system',
        inAppEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
      },
    });
  }

  private getLoginUrl(tenant: any): string {
    if (tenant.subdomain) {
      return `https://${tenant.subdomain}.${process.env.APP_DOMAIN}/login`;
    }
    return `https://${process.env.APP_DOMAIN}/login?tenant=${tenant.id}`;
  }
}
```

### 7. Testing Examples

#### Unit Testing with Tenant Context

```typescript
// src/user/user.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;
  let tenantContext: TenantContextService;

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockTenantContext = {
    getRequiredTenantId: jest.fn(),
    getTenantId: jest.fn(),
    setTenantId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContext,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
    tenantContext = module.get<TenantContextService>(TenantContextService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTenantContext.getRequiredTenantId.mockReturnValue('test-tenant-id');
  });

  it('should find all users for current tenant', async () => {
    const mockUsers = [
      { id: '1', email: 'user1@test.com', tenantId: 'test-tenant-id' },
      { id: '2', email: 'user2@test.com', tenantId: 'test-tenant-id' },
    ];

    mockPrismaService.user.findMany.mockResolvedValue(mockUsers);

    const result = await service.findAll();

    expect(result).toEqual(mockUsers);
    expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });
  });

  it('should create user with tenant context', async () => {
    const createUserDto = {
      email: 'newuser@test.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
    };

    const mockCreatedUser = {
      id: '3',
      ...createUserDto,
      tenantId: 'test-tenant-id',
    };

    mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);

    const result = await service.create(createUserDto);

    expect(result).toEqual(mockCreatedUser);
    expect(mockPrismaService.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        password: expect.any(String), // Hashed password
      }),
    });
  });
});
```

#### Integration Testing with Multiple Tenants

```typescript
// test/tenant-isolation.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenant1: any;
  let tenant2: any;
  let user1: any;
  let user2: any;
  let token1: string;
  let token2: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // Create test tenants
    tenant1 = await createTestTenant('Tenant 1');
    tenant2 = await createTestTenant('Tenant 2');

    // Create test users
    user1 = await createTestUser(tenant1.id, 'user1@tenant1.com');
    user2 = await createTestUser(tenant2.id, 'user2@tenant2.com');

    // Get auth tokens
    token1 = await getAuthToken(user1.email, 'password123');
    token2 = await getAuthToken(user2.email, 'password123');
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  it('should isolate users between tenants', async () => {
    // Get users for tenant 1
    const response1 = await request(app.getHttpServer())
      .get('/users')
      .set('x-tenant-id', tenant1.id)
      .set('Authorization', `Bearer ${token1}`)
      .expect(200);

    // Get users for tenant 2
    const response2 = await request(app.getHttpServer())
      .get('/users')
      .set('x-tenant-id', tenant2.id)
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);

    // Verify isolation
    expect(response1.body).toHaveLength(1);
    expect(response2.body).toHaveLength(1);
    expect(response1.body[0].tenantId).toBe(tenant1.id);
    expect(response2.body[0].tenantId).toBe(tenant2.id);
  });

  it('should prevent cross-tenant access', async () => {
    // Try to access tenant 2 data with tenant 1 credentials
    await request(app.getHttpServer())
      .get('/users')
      .set('x-tenant-id', tenant2.id) // Wrong tenant
      .set('Authorization', `Bearer ${token1}`) // Tenant 1 token
      .expect(401); // Should be unauthorized
  });

  it('should prevent access without tenant header', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${token1}`)
      // Missing x-tenant-id header
      .expect(400);
  });

  // Helper functions
  async function createTestTenant(name: string) {
    return prisma.tenant.create({
      data: { name },
    });
  }

  async function createTestUser(tenantId: string, email: string) {
    return prisma.user.create({
      data: {
        email,
        password: await bcrypt.hash('password123', 10),
        firstName: 'Test',
        lastName: 'User',
        tenantId,
      },
    });
  }

  async function getAuthToken(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    return response.body.access_token;
  }

  async function cleanupTestData() {
    await prisma.user.deleteMany({
      where: {
        tenantId: {
          in: [tenant1.id, tenant2.id],
        },
      },
    });

    await prisma.tenant.deleteMany({
      where: {
        id: {
          in: [tenant1.id, tenant2.id],
        },
      },
    });
  }
});
```

These comprehensive examples demonstrate how to effectively use the tenant module in various scenarios, from basic service implementation to advanced caching and testing strategies.