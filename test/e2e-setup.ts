import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { config } from 'dotenv';
import { resolve } from 'path';
import request from 'supertest';
import { register } from 'prom-client';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';

// Load test environment variables
config({ path: resolve(__dirname, '../.env.test') });
console.log('E2E Test JWT_SECRET:', process.env.JWT_SECRET);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

export interface TestTenant {
  id: string;
  name: string;
  subdomain: string;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  tenantId: string;
  accessToken?: string;
}

export interface TestProject {
  id: string;
  name: string;
  tenantId: string;
  ownerId: string;
}

/**
 * Setup test application with proper configuration
 */
export async function setupTestApp(): Promise<INestApplication> {
  // Clear Prometheus registry before each test to avoid conflicts
  register.clear();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Apply same configuration as main.ts
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.init();
  return app;
}

/**
 * Run database migrations
 */
export function runMigrations() {
  try {
    execSync('npx prisma migrate deploy', {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }
}

/**
 * Clean all data from database
 */
export async function cleanDatabase() {
  const tables = [
    'notification_audit_logs',
    'notification_delivery_logs',
    'notification_templates',
    'tenant_notification_configs',
    'notification_preferences',
    'notifications',
    'user_permissions',
    'role_permissions',
    'user_roles',
    'projects',
    'users',
    'permissions',
    'roles',
    'tenants',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
}

/**
 * Register a new tenant via API
 */
export async function registerTenant(
  app: INestApplication,
  tenantData: {
    tenantName: string;
    adminEmail: string;
    adminPassword: string;
    adminFirstName: string;
    adminLastName: string;
  },
): Promise<{ tenant: TestTenant; user: TestUser }> {
  const response = await request(app.getHttpServer())
    .post('/tenants')
    .send(tenantData)
    .expect(201);

  return {
    tenant: response.body.data.tenant,
    user: {
      ...response.body.data.adminUser,
      password: tenantData.adminPassword,
    },
  };
}

/**
 * Login a user and get JWT token
 */
export async function loginUser(
  app: INestApplication,
  tenantId: string,
  email: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .set('x-tenant-id', tenantId)
    .send({ email, password })
    .expect(200);

  return response.body.accessToken;
}

/**
 * Create a project via API
 */
export async function createProject(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
  projectData: { name: string; description?: string },
): Promise<TestProject> {
  const response = await request(app.getHttpServer())
    .post('/projects')
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .send(projectData)
    .expect(201);

  return response.body;
}

/**
 * Create a user via API
 */
export async function createUser(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
  userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  },
): Promise<TestUser> {
  const response = await request(app.getHttpServer())
    .post('/users')
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .send(userData)
    .expect(201);

  return {
    ...response.body,
    password: userData.password,
  };
}

/**
 * Create a role via API
 */
export async function createRole(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
  roleData: { name: string },
) {
  const response = await request(app.getHttpServer())
    .post('/roles')
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .send(roleData)
    .expect(201);

  return response.body;
}

/**
 * Create a permission via API
 */
export async function createPermission(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
  permissionData: { action: string; subject: string },
) {
  const response = await request(app.getHttpServer())
    .post('/permissions')
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .send(permissionData)
    .expect(201);

  return response.body;
}

/**
 * Assign roles to a user via API
 */
export async function assignRolesToUser(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
  userId: string,
  roleIds: string[],
) {
  const response = await request(app.getHttpServer())
    .put(`/users/${userId}/roles`)
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ roleIds })
    .expect(200);

  return response.body;
}

/**
 * Assign permissions to a role via API
 */
export async function assignPermissionsToRole(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
  roleId: string,
  permissionIds: string[],
) {
  const response = await request(app.getHttpServer())
    .put(`/roles/${roleId}/permissions`)
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ permissionIds })
    .expect(200);

  return response.body;
}

/**
 * Assign permissions directly to a user via API
 */
export async function assignPermissionsToUser(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
  userId: string,
  permissionIds: string[],
) {
  const response = await request(app.getHttpServer())
    .put(`/users/${userId}/permissions`)
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ permissionIds })
    .expect(200);

  return response.body;
}

/**
 * Get all projects via API
 */
export async function getProjects(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
) {
  const response = await request(app.getHttpServer())
    .get('/projects')
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  return response.body;
}

/**
 * Get a specific project via API
 */
export async function getProject(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
  projectId: string,
) {
  return request(app.getHttpServer())
    .get(`/projects/${projectId}`)
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`);
}

/**
 * Get all users via API
 */
export async function getUsers(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
) {
  const response = await request(app.getHttpServer())
    .get('/users')
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  return response.body;
}

/**
 * Get all roles for a tenant via API
 */
export async function getRoles(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
) {
  const response = await request(app.getHttpServer())
    .get('/roles')
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  return response.body;
}

/**
 * Get all permissions for a tenant via API
 */
export async function getPermissions(
  app: INestApplication,
  tenantId: string,
  accessToken: string,
) {
  const response = await request(app.getHttpServer())
    .get('/permissions')
    .set('x-tenant-id', tenantId)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  return response.body;
}

/**
 * Create a user with specific permissions
 * This is a helper that creates a user and assigns them permissions
 */
export async function createUserWithPermissions(
  app: INestApplication,
  tenantId: string,
  adminToken: string,
  userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  },
  permissionActions: string[], // e.g., ['create:project', 'read:project']
): Promise<TestUser> {
  // Create the user
  const user = await createUser(app, tenantId, adminToken, userData);

  // Get all permissions for the tenant
  const allPermissions = await getPermissions(app, tenantId, adminToken);

  // Filter permissions based on the requested actions
  const permissionIds = allPermissions
    .filter((p: any) => {
      const permKey = `${p.action}:${p.subject}`;
      return permissionActions.includes(permKey);
    })
    .map((p: any) => p.id);

  // Assign permissions to the user
  if (permissionIds.length > 0) {
    await assignPermissionsToUser(
      app,
      tenantId,
      adminToken,
      user.id,
      permissionIds,
    );
  }

  return user;
}

/**
 * Create a user with a specific role
 */
export async function createUserWithRole(
  app: INestApplication,
  tenantId: string,
  adminToken: string,
  userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  },
  roleName: string, // e.g., 'Admin', 'Member'
): Promise<TestUser> {
  // Create the user
  const user = await createUser(app, tenantId, adminToken, userData);

  // Get all roles for the tenant
  const allRoles = await getRoles(app, tenantId, adminToken);

  // Find the role by name
  const role = allRoles.find((r: any) => r.name === roleName);

  if (role) {
    // Assign role to the user
    await assignRolesToUser(app, tenantId, adminToken, user.id, [role.id]);
  }

  return user;
}

export { prisma };
