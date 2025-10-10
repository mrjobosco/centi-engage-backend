# Permission Implementation Examples

## Overview

This document provides practical examples of implementing permission checks throughout the application, from basic decorator usage to complex business logic scenarios.

## Basic Permission Implementation

### 1. Controller-Level Permissions

```typescript
import { Controller, Get, Post, Put, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/guards';
import { PermissionsGuard } from '@/common/guards';
import { Permissions } from '@/common/decorators';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UserController {
  // Single permission required
  @Get()
  @Permissions('read:user')
  async getUsers() {
    return this.userService.findAll();
  }

  // Multiple permissions required (ALL must be present)
  @Post()
  @Permissions('create:user', 'read:role')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  // Admin-only endpoint
  @Delete(':id')
  @Permissions('delete:user')
  async deleteUser(@Param('id') id: string) {
    return this.userService.delete(id);
  }

  // Complex permission requirement
  @Put(':id/roles')
  @Permissions('update:user', 'read:role', 'assign:role')
  async assignRoles(
    @Param('id') id: string,
    @Body() assignRolesDto: AssignRolesDto
  ) {
    return this.userService.assignRoles(id, assignRolesDto);
  }
}
```

### 2. Method-Level Permission Overrides

```typescript
@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('read:project') // Default permission for all methods
export class ProjectController {
  // Inherits default 'read:project' permission
  @Get()
  async getProjects() {
    return this.projectService.findAll();
  }

  // Override with specific permissions
  @Post()
  @Permissions('create:project')
  async createProject(@Body() createProjectDto: CreateProjectDto) {
    return this.projectService.create(createProjectDto);
  }

  // Multiple permissions override
  @Put(':id/settings')
  @Permissions('update:project', 'admin:project')
  async updateProjectSettings(
    @Param('id') id: string,
    @Body() settings: ProjectSettingsDto
  ) {
    return this.projectService.updateSettings(id, settings);
  }

  // Public endpoint (no permissions required)
  @Get('public')
  @Permissions() // Empty permissions = no requirements
  async getPublicProjects() {
    return this.projectService.findPublic();
  }
}
```

## Advanced Permission Patterns

### 1. Conditional Permissions Based on Context

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/database';
import { CurrentUser } from '@/auth/decorators';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async getProject(projectId: string, currentUser: any) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { owner: true, team: { include: { members: true } } }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check permissions based on context
    const canAccess = await this.checkProjectAccess(project, currentUser);
    
    if (!canAccess) {
      throw new ForbiddenException('Insufficient permissions to access this project');
    }

    return project;
  }

  private async checkProjectAccess(project: any, user: any): Promise<boolean> {
    // Owner can always access
    if (project.ownerId === user.id) {
      return true;
    }

    // Team members can access if they have read permission
    const isTeamMember = project.team?.members.some(member => member.userId === user.id);
    if (isTeamMember && this.hasPermission(user, 'read:project')) {
      return true;
    }

    // Public projects can be accessed by anyone with read permission
    if (project.isPublic && this.hasPermission(user, 'read:project')) {
      return true;
    }

    // Admins can access any project
    if (this.hasPermission(user, 'admin:project')) {
      return true;
    }

    return false;
  }

  private hasPermission(user: any, permission: string): boolean {
    return user.permissions?.includes(permission) || false;
  }
}
```

### 2. Dynamic Permission Checking Service

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database';

@Injectable()
export class PermissionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const effectivePermissions = await this.getEffectivePermissions(userId);
    return effectivePermissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const effectivePermissions = await this.getEffectivePermissions(userId);
    return permissions.some(permission => effectivePermissions.includes(permission));
  }

  /**
   * Check if user has all specified permissions
   */
  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    const effectivePermissions = await this.getEffectivePermissions(userId);
    return permissions.every(permission => effectivePermissions.includes(permission));
  }

  /**
   * Get all effective permissions for a user (cached)
   */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    // Implementation with caching
    const cacheKey = `user_permissions:${userId}`;
    
    // Try to get from cache first
    let permissions = await this.getCachedPermissions(cacheKey);
    
    if (!permissions) {
      permissions = await this.fetchUserPermissions(userId);
      await this.cachePermissions(cacheKey, permissions);
    }
    
    return permissions;
  }

  /**
   * Check resource-specific permissions with context
   */
  async canAccessResource(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string
  ): Promise<boolean> {
    // Check basic permission first
    const hasBasicPermission = await this.hasPermission(userId, `${action}:${resourceType}`);
    
    if (!hasBasicPermission) {
      return false;
    }

    // Check resource-specific rules
    switch (resourceType) {
      case 'project':
        return this.canAccessProject(userId, resourceId, action);
      case 'user':
        return this.canAccessUser(userId, resourceId, action);
      default:
        return hasBasicPermission;
    }
  }

  private async canAccessProject(userId: string, projectId: string, action: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { team: { include: { members: true } } }
    });

    if (!project) {
      return false;
    }

    // Owner can perform any action
    if (project.ownerId === userId) {
      return true;
    }

    // Team members can read and update
    const isTeamMember = project.team?.members.some(member => member.userId === userId);
    if (isTeamMember && ['read', 'update'].includes(action)) {
      return true;
    }

    // Admin can do anything
    return this.hasPermission(userId, 'admin:project');
  }

  private async canAccessUser(userId: string, targetUserId: string, action: string): Promise<boolean> {
    // Users can always access their own data
    if (userId === targetUserId && ['read', 'update'].includes(action)) {
      return true;
    }

    // For other users, check admin permissions
    return this.hasPermission(userId, `admin:user`);
  }

  private async fetchUserPermissions(userId: string): Promise<string[]> {
    // Get role-based permissions
    const rolePermissions = await this.prisma.permission.findMany({
      where: {
        roles: {
          some: {
            role: {
              users: {
                some: { userId }
              }
            }
          }
        }
      },
      select: { action: true, subject: true }
    });

    // Get direct user permissions
    const userPermissions = await this.prisma.permission.findMany({
      where: {
        users: {
          some: { userId }
        }
      },
      select: { action: true, subject: true }
    });

    // Combine and format
    const allPermissions = [...rolePermissions, ...userPermissions];
    const permissionStrings = allPermissions.map(p => `${p.action}:${p.subject}`);
    
    return [...new Set(permissionStrings)];
  }

  private async getCachedPermissions(cacheKey: string): Promise<string[] | null> {
    // Implementation depends on your caching strategy (Redis, in-memory, etc.)
    // Return null if not cached
    return null;
  }

  private async cachePermissions(cacheKey: string, permissions: string[]): Promise<void> {
    // Cache permissions with appropriate TTL
  }
}
```

### 3. Custom Permission Decorator

```typescript
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Enhanced permissions decorator with options
export const ENHANCED_PERMISSIONS_KEY = 'enhanced_permissions';

export interface PermissionOptions {
  permissions: string[];
  requireAll?: boolean; // Default: true
  allowOwner?: boolean; // Allow resource owner regardless of permissions
  allowSelf?: boolean;  // Allow user to access their own data
}

export const EnhancedPermissions = (options: PermissionOptions) =>
  SetMetadata(ENHANCED_PERMISSIONS_KEY, options);

// Usage examples:
@Controller('projects')
export class ProjectController {
  // Require ALL permissions
  @Get()
  @EnhancedPermissions({
    permissions: ['read:project', 'list:project'],
    requireAll: true
  })
  async getProjects() {
    return this.projectService.findAll();
  }

  // Require ANY permission
  @Get(':id')
  @EnhancedPermissions({
    permissions: ['read:project', 'admin:project'],
    requireAll: false,
    allowOwner: true
  })
  async getProject(@Param('id') id: string) {
    return this.projectService.findOne(id);
  }

  // Allow self-access
  @Get('users/:id/profile')
  @EnhancedPermissions({
    permissions: ['read:user'],
    allowSelf: true
  })
  async getUserProfile(@Param('id') id: string) {
    return this.userService.getProfile(id);
  }
}
```

### 4. Permission-Based Data Filtering

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database';
import { PermissionService } from './permission.service';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private permissionService: PermissionService
  ) {}

  async findAll(userId: string) {
    const hasAdminPermission = await this.permissionService.hasPermission(
      userId,
      'admin:project'
    );

    // Admins can see all projects
    if (hasAdminPermission) {
      return this.prisma.project.findMany({
        include: { owner: true, team: true }
      });
    }

    // Regular users see only their projects and public projects
    return this.prisma.project.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { isPublic: true },
          {
            team: {
              members: {
                some: { userId }
              }
            }
          }
        ]
      },
      include: { owner: true, team: true }
    });
  }

  async findOne(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { 
        owner: true, 
        team: { include: { members: true } },
        _count: { select: { tasks: true } }
      }
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check access permissions
    const canAccess = await this.canUserAccessProject(userId, project);
    
    if (!canAccess) {
      throw new ForbiddenException('Access denied');
    }

    // Filter sensitive data based on permissions
    return this.filterProjectData(project, userId);
  }

  private async canUserAccessProject(userId: string, project: any): Promise<boolean> {
    // Owner can always access
    if (project.ownerId === userId) {
      return true;
    }

    // Team members can access
    const isTeamMember = project.team?.members.some(member => member.userId === userId);
    if (isTeamMember) {
      return true;
    }

    // Public projects with read permission
    if (project.isPublic && await this.permissionService.hasPermission(userId, 'read:project')) {
      return true;
    }

    // Admin can access any project
    return this.permissionService.hasPermission(userId, 'admin:project');
  }

  private async filterProjectData(project: any, userId: string) {
    const hasAdminPermission = await this.permissionService.hasPermission(
      userId,
      'admin:project'
    );

    const isOwner = project.ownerId === userId;

    // Return full data for owners and admins
    if (isOwner || hasAdminPermission) {
      return project;
    }

    // Filter sensitive data for regular users
    const { 
      budget, 
      internalNotes, 
      clientContacts,
      ...filteredProject 
    } = project;

    return filteredProject;
  }
}
```

## Frontend Permission Integration

### 1. React Permission Hook

```typescript
import { useState, useEffect, useContext, createContext } from 'react';
import { useAuth } from './useAuth';

interface PermissionContextType {
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  canAccessResource: (resourceType: string, resourceId: string, action: string) => Promise<boolean>;
  loading: boolean;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export const PermissionProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserPermissions();
    } else {
      setPermissions([]);
      setLoading(false);
    }
  }, [user]);

  const fetchUserPermissions = async () => {
    try {
      const response = await fetch(`/users/${user.id}/permissions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.effectivePermissions);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.some(permission => permissions.includes(permission));
  };

  const hasAllPermissions = (requiredPermissions: string[]): boolean => {
    return requiredPermissions.every(permission => permissions.includes(permission));
  };

  const canAccessResource = async (
    resourceType: string,
    resourceId: string,
    action: string
  ): Promise<boolean> => {
    try {
      const response = await fetch('/permissions/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          resourceType,
          resourceId,
          action,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.allowed;
      }
    } catch (error) {
      console.error('Permission check failed:', error);
    }

    return false;
  };

  return (
    <PermissionContext.Provider value={{
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canAccessResource,
      loading,
    }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
};
```

### 2. Permission-Based Components

```typescript
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

// Higher-order component for permission-based rendering
export const withPermissions = (
  WrappedComponent: React.ComponentType<any>,
  requiredPermissions: string[],
  options: {
    requireAll?: boolean;
    fallback?: React.ComponentType;
  } = {}
) => {
  return (props: any) => {
    const { hasPermission, hasAnyPermission, hasAllPermissions, loading } = usePermissions();
    const { requireAll = true, fallback: Fallback } = options;

    if (loading) {
      return <div>Loading permissions...</div>;
    }

    const hasRequiredPermissions = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);

    if (!hasRequiredPermissions) {
      return Fallback ? <Fallback /> : <div>Access denied</div>;
    }

    return <WrappedComponent {...props} />;
  };
};

// Permission wrapper component
export const PermissionWrapper: React.FC<{
  permissions: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}> = ({ permissions, requireAll = true, fallback, children }) => {
  const { hasAnyPermission, hasAllPermissions, loading } = usePermissions();

  if (loading) {
    return <div>Loading...</div>;
  }

  const hasRequiredPermissions = requireAll
    ? hasAllPermissions(permissions)
    : hasAnyPermission(permissions);

  if (!hasRequiredPermissions) {
    return <>{fallback || <div>You don't have permission to view this content</div>}</>;
  }

  return <>{children}</>;
};

// Usage examples:
const ProjectManagement = () => {
  return (
    <div>
      <h1>Project Management</h1>
      
      {/* Show create button only for users with create permission */}
      <PermissionWrapper permissions={['create:project']}>
        <button>Create New Project</button>
      </PermissionWrapper>
      
      {/* Show admin panel for users with any admin permission */}
      <PermissionWrapper 
        permissions={['admin:project', 'admin:user']} 
        requireAll={false}
      >
        <AdminPanel />
      </PermissionWrapper>
      
      {/* Show different content based on permissions */}
      <PermissionWrapper 
        permissions={['read:project']}
        fallback={<div>Contact admin for project access</div>}
      >
        <ProjectList />
      </PermissionWrapper>
    </div>
  );
};

// Using HOC
const AdminOnlyComponent = withPermissions(
  ({ data }) => <div>Admin content: {data}</div>,
  ['admin:user', 'admin:project'],
  {
    requireAll: false,
    fallback: () => <div>Admin access required</div>
  }
);
```

### 3. Dynamic Menu Based on Permissions

```typescript
import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface MenuItem {
  label: string;
  path: string;
  permissions?: string[];
  requireAll?: boolean;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
  },
  {
    label: 'Projects',
    path: '/projects',
    permissions: ['read:project'],
    children: [
      {
        label: 'All Projects',
        path: '/projects',
        permissions: ['read:project'],
      },
      {
        label: 'Create Project',
        path: '/projects/create',
        permissions: ['create:project'],
      },
    ],
  },
  {
    label: 'Users',
    path: '/users',
    permissions: ['read:user'],
    children: [
      {
        label: 'All Users',
        path: '/users',
        permissions: ['read:user'],
      },
      {
        label: 'Create User',
        path: '/users/create',
        permissions: ['create:user'],
      },
      {
        label: 'Manage Roles',
        path: '/users/roles',
        permissions: ['read:role', 'update:role'],
        requireAll: true,
      },
    ],
  },
  {
    label: 'Admin',
    path: '/admin',
    permissions: ['admin:user', 'admin:project'],
    requireAll: false,
    children: [
      {
        label: 'System Settings',
        path: '/admin/settings',
        permissions: ['admin:system'],
      },
      {
        label: 'Audit Logs',
        path: '/admin/audit',
        permissions: ['admin:audit'],
      },
    ],
  },
];

const Navigation = () => {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const checkMenuItemPermissions = (item: MenuItem): boolean => {
    if (!item.permissions || item.permissions.length === 0) {
      return true;
    }

    return item.requireAll
      ? hasAllPermissions(item.permissions)
      : hasAnyPermission(item.permissions);
  };

  const renderMenuItem = (item: MenuItem) => {
    if (!checkMenuItemPermissions(item)) {
      return null;
    }

    return (
      <li key={item.path}>
        <a href={item.path}>{item.label}</a>
        {item.children && (
          <ul>
            {item.children.map(child => renderMenuItem(child))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <nav>
      <ul>
        {menuItems.map(item => renderMenuItem(item))}
      </ul>
    </nav>
  );
};
```

## Testing Permission Logic

### 1. Unit Tests for Permission Service

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionService } from './permission.service';
import { PrismaService } from '@/database';

describe('PermissionService', () => {
  let service: PermissionService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: PrismaService,
          useValue: {
            permission: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('hasPermission', () => {
    it('should return true when user has the required permission', async () => {
      const mockPermissions = [
        { action: 'read', subject: 'user' },
        { action: 'create', subject: 'project' },
      ];

      jest.spyOn(service, 'getEffectivePermissions').mockResolvedValue([
        'read:user',
        'create:project',
      ]);

      const result = await service.hasPermission('user-123', 'read:user');
      expect(result).toBe(true);
    });

    it('should return false when user lacks the required permission', async () => {
      jest.spyOn(service, 'getEffectivePermissions').mockResolvedValue([
        'read:user',
      ]);

      const result = await service.hasPermission('user-123', 'delete:user');
      expect(result).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when user has all required permissions', async () => {
      jest.spyOn(service, 'getEffectivePermissions').mockResolvedValue([
        'read:user',
        'create:user',
        'update:user',
      ]);

      const result = await service.hasAllPermissions('user-123', [
        'read:user',
        'create:user',
      ]);
      expect(result).toBe(true);
    });

    it('should return false when user lacks some required permissions', async () => {
      jest.spyOn(service, 'getEffectivePermissions').mockResolvedValue([
        'read:user',
      ]);

      const result = await service.hasAllPermissions('user-123', [
        'read:user',
        'delete:user',
      ]);
      expect(result).toBe(false);
    });
  });
});
```

### 2. Integration Tests for Permission Guards

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/database';

describe('Permission Guards (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // Setup test data and get tokens
    ({ userToken, adminToken } = await setupTestData());
  });

  describe('/users (GET)', () => {
    it('should allow access with read:user permission', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should deny access without read:user permission', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tokenWithoutPermission}`)
        .expect(403);
    });
  });

  describe('/users (POST)', () => {
    it('should allow user creation with create:user permission', () => {
      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@example.com',
          firstName: 'New',
          lastName: 'User',
        })
        .expect(201);
    });

    it('should deny user creation without create:user permission', () => {
      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'newuser@example.com',
          firstName: 'New',
          lastName: 'User',
        })
        .expect(403);
    });
  });

  async function setupTestData() {
    // Create test permissions, roles, and users
    // Return tokens for different permission levels
  }
});
```

These examples provide comprehensive patterns for implementing permissions throughout your application, from basic decorator usage to complex business logic scenarios and frontend integration.