import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  assignPermissionsToRole,
  assignPermissionsToUser,
  assignRolesToUser,
  cleanDatabase,
  createRole,
  createUser,
  loginUser,
  registerTenant,
  runMigrations,
  setupTestApp,
  TestTenant,
  TestUser,
} from './e2e-setup';

describe('Permission System E2E Tests', () => {
  let app: INestApplication;
  let tenant: TestTenant;
  let adminUser: TestUser;
  let adminToken: string;

  beforeAll(async () => {
    // Run migrations
    runMigrations();

    // Setup application
    app = await setupTestApp();

    // Clean database
    await cleanDatabase();

    // Create tenant with admin user
    const tenantResult = await registerTenant(app, {
      tenantName: 'Permission Test Corp',
      adminEmail: 'admin@permtest.com',
      adminPassword: 'Password123!',
      adminFirstName: 'Admin',
      adminLastName: 'User',
    });
    tenant = tenantResult.tenant;
    adminUser = tenantResult.user;
    adminToken = await loginUser(
      app,
      tenant.id,
      adminUser.email,
      adminUser.password,
    );
  });

  afterEach(async () => {
    // Longer delay to allow connections to close properly
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  describe('User with permission can access protected route', () => {
    it('should allow user with role-based read:project permission to access GET /projects', async () => {
      // Create a regular user
      const regularUser = await createUser(app, tenant.id, adminToken, {
        email: 'user1@permtest.com',
        password: 'Password123!',
        firstName: 'Regular',
        lastName: 'User',
      });

      // Get the Member role (created by default with read permissions)
      const rolesResponse = await request(app.getHttpServer())
        .get('/roles')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const memberRole = rolesResponse.body.find(
        (r: any) => r.name === 'Member',
      );
      expect(memberRole).toBeDefined();

      // Assign Member role to user
      await assignRolesToUser(app, tenant.id, adminToken, regularUser.id, [
        memberRole.id,
      ]);

      // Login as regular user
      const userToken = await loginUser(
        app,
        tenant.id,
        regularUser.email,
        regularUser.password,
      );

      // User should be able to access projects
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow user with role-based create:project permission to create projects', async () => {
      // Create a user
      const creatorUser = await createUser(app, tenant.id, adminToken, {
        email: 'creator@permtest.com',
        password: 'Password123!',
        firstName: 'Creator',
        lastName: 'User',
      });

      // Get the Admin role (has all permissions)
      const rolesResponse = await request(app.getHttpServer())
        .get('/roles')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const adminRole = rolesResponse.body.find((r: any) => r.name === 'Admin');
      expect(adminRole).toBeDefined();

      // Assign Admin role to user
      await assignRolesToUser(app, tenant.id, adminToken, creatorUser.id, [
        adminRole.id,
      ]);

      // Login as creator user
      const userToken = await loginUser(
        app,
        tenant.id,
        creatorUser.email,
        creatorUser.password,
      );

      // User should be able to create project
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Test Project',
          description: 'Created by user with permission',
        })
        .expect(201);

      expect(response.body.name).toBe('Test Project');
    });
  });

  describe('User without permission gets 403', () => {
    it('should deny access to user without required permission', async () => {
      // Create a user with no roles
      const noPermUser = await createUser(app, tenant.id, adminToken, {
        email: 'noperm@permtest.com',
        password: 'Password123!',
        firstName: 'NoPerm',
        lastName: 'User',
      });

      // Login as user with no permissions
      const userToken = await loginUser(
        app,
        tenant.id,
        noPermUser.email,
        noPermUser.password,
      );

      // User should not be able to access projects
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.message).toContain('Missing required permissions');
    });

    it('should deny project creation to user without create:project permission', async () => {
      // Create a user with only read permissions
      const readOnlyUser = await createUser(app, tenant.id, adminToken, {
        email: 'readonly@permtest.com',
        password: 'Password123!',
        firstName: 'ReadOnly',
        lastName: 'User',
      });

      // Get the Member role (has read permissions only)
      const rolesResponse = await request(app.getHttpServer())
        .get('/roles')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const memberRole = rolesResponse.body.find(
        (r: any) => r.name === 'Member',
      );

      // Assign Member role
      await assignRolesToUser(app, tenant.id, adminToken, readOnlyUser.id, [
        memberRole.id,
      ]);

      // Login as read-only user
      const userToken = await loginUser(
        app,
        tenant.id,
        readOnlyUser.email,
        readOnlyUser.password,
      );

      // User should not be able to create project
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Should Fail',
          description: 'This should not be created',
        })
        .expect(403);

      expect(response.body.message).toContain('Missing required permissions');
    });

    it('should deny user management to user without update:user permission', async () => {
      // Create two users
      const user1 = await createUser(app, tenant.id, adminToken, {
        email: 'user1@test.com',
        password: 'Password123!',
        firstName: 'User',
        lastName: 'One',
      });

      const user2 = await createUser(app, tenant.id, adminToken, {
        email: 'user2@test.com',
        password: 'Password123!',
        firstName: 'User',
        lastName: 'Two',
      });

      // Give user1 only read:user permission via Member role
      const rolesResponse = await request(app.getHttpServer())
        .get('/roles')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const memberRole = rolesResponse.body.find(
        (r: any) => r.name === 'Member',
      );

      await assignRolesToUser(app, tenant.id, adminToken, user1.id, [
        memberRole.id,
      ]);

      // Login as user1
      const user1Token = await loginUser(
        app,
        tenant.id,
        user1.email,
        user1.password,
      );

      // User1 should not be able to update user2
      const response = await request(app.getHttpServer())
        .put(`/users/${user2.id}`)
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        })
        .expect(403);

      expect(response.body.message).toContain('Missing required permissions');
    });
  });

  describe('User-specific permission grants access', () => {
    it('should allow user with direct permission to access protected route', async () => {
      // Create a user with no roles
      const directPermUser = await createUser(app, tenant.id, adminToken, {
        email: 'directperm@permtest.com',
        password: 'Password123!',
        firstName: 'DirectPerm',
        lastName: 'User',
      });

      // Get read:project permission
      const permissionsResponse = await request(app.getHttpServer())
        .get('/permissions')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const readProjectPerm = permissionsResponse.body.find(
        (p: any) => p.action === 'read' && p.subject === 'project',
      );
      expect(readProjectPerm).toBeDefined();

      // Assign permission directly to user
      await assignPermissionsToUser(
        app,
        tenant.id,
        adminToken,
        directPermUser.id,
        [readProjectPerm.id],
      );

      // Login as user
      const userToken = await loginUser(
        app,
        tenant.id,
        directPermUser.email,
        directPermUser.password,
      );

      // User should be able to access projects with direct permission
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow user with direct create:project permission to create projects', async () => {
      // Create a user with no roles
      const directCreateUser = await createUser(app, tenant.id, adminToken, {
        email: 'directcreate@permtest.com',
        password: 'Password123!',
        firstName: 'DirectCreate',
        lastName: 'User',
      });

      // Get create:project permission
      const permissionsResponse = await request(app.getHttpServer())
        .get('/permissions')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const createProjectPerm = permissionsResponse.body.find(
        (p: any) => p.action === 'create' && p.subject === 'project',
      );
      expect(createProjectPerm).toBeDefined();

      // Assign permission directly to user
      await assignPermissionsToUser(
        app,
        tenant.id,
        adminToken,
        directCreateUser.id,
        [createProjectPerm.id],
      );

      // Login as user
      const userToken = await loginUser(
        app,
        tenant.id,
        directCreateUser.email,
        directCreateUser.password,
      );

      // User should be able to create project with direct permission
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Direct Permission Project',
          description: 'Created with direct permission',
        })
        .expect(201);

      expect(response.body.name).toBe('Direct Permission Project');
    });

    it('should combine role-based and user-specific permissions', async () => {
      // Create a user
      const combinedUser = await createUser(app, tenant.id, adminToken, {
        email: 'combined@permtest.com',
        password: 'Password123!',
        firstName: 'Combined',
        lastName: 'User',
      });

      // Get Member role (has read permissions)
      const rolesResponse = await request(app.getHttpServer())
        .get('/roles')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const memberRole = rolesResponse.body.find(
        (r: any) => r.name === 'Member',
      );

      // Assign Member role (gives read permissions)
      await assignRolesToUser(app, tenant.id, adminToken, combinedUser.id, [
        memberRole.id,
      ]);

      // Get create:project permission
      const permissionsResponse = await request(app.getHttpServer())
        .get('/permissions')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const createProjectPerm = permissionsResponse.body.find(
        (p: any) => p.action === 'create' && p.subject === 'project',
      );

      // Add direct create permission
      await assignPermissionsToUser(
        app,
        tenant.id,
        adminToken,
        combinedUser.id,
        [createProjectPerm.id],
      );

      // Login as user
      const userToken = await loginUser(
        app,
        tenant.id,
        combinedUser.email,
        combinedUser.password,
      );

      // User should be able to read (from role)
      await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // User should be able to create (from direct permission)
      await request(app.getHttpServer())
        .post('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Combined Permissions Project',
          description: 'Created with combined permissions',
        })
        .expect(201);
    });
  });

  describe('Permission removal immediately revokes access', () => {
    it('should revoke access when direct permission is removed', async () => {
      // Create a user
      const revokeUser = await createUser(app, tenant.id, adminToken, {
        email: 'revoke@permtest.com',
        password: 'Password123!',
        firstName: 'Revoke',
        lastName: 'User',
      });

      // Get read:project permission
      const permissionsResponse = await request(app.getHttpServer())
        .get('/permissions')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const readProjectPerm = permissionsResponse.body.find(
        (p: any) => p.action === 'read' && p.subject === 'project',
      );

      // Assign permission directly to user
      await assignPermissionsToUser(app, tenant.id, adminToken, revokeUser.id, [
        readProjectPerm.id,
      ]);

      // Login as user
      const userToken = await loginUser(
        app,
        tenant.id,
        revokeUser.email,
        revokeUser.password,
      );

      // User should be able to access projects
      await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Remove the permission
      await assignPermissionsToUser(
        app,
        tenant.id,
        adminToken,
        revokeUser.id,
        [],
      );

      // User should no longer be able to access projects
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.message).toContain('Missing required permissions');
    });

    it('should revoke access when role is removed from user', async () => {
      // Create a user
      const roleRevokeUser = await createUser(app, tenant.id, adminToken, {
        email: 'rolerevoke@permtest.com',
        password: 'Password123!',
        firstName: 'RoleRevoke',
        lastName: 'User',
      });

      // Get Member role
      const rolesResponse = await request(app.getHttpServer())
        .get('/roles')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const memberRole = rolesResponse.body.find(
        (r: any) => r.name === 'Member',
      );

      // Assign Member role
      await assignRolesToUser(app, tenant.id, adminToken, roleRevokeUser.id, [
        memberRole.id,
      ]);

      // Login as user
      const userToken = await loginUser(
        app,
        tenant.id,
        roleRevokeUser.email,
        roleRevokeUser.password,
      );

      // User should be able to access projects
      await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Remove all roles from user
      await assignRolesToUser(
        app,
        tenant.id,
        adminToken,
        roleRevokeUser.id,
        [],
      );

      // User should no longer be able to access projects
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.message).toContain('Missing required permissions');
    });
  });

  describe('Role permission changes affect all users with that role', () => {
    it('should grant access to all users when permission is added to role', async () => {
      // Create a custom role with no permissions
      const customRole = await createRole(app, tenant.id, adminToken, {
        name: 'Custom Role',
      });

      // Create two users with this role
      const user1 = await createUser(app, tenant.id, adminToken, {
        email: 'roleuser1@permtest.com',
        password: 'Password123!',
        firstName: 'RoleUser',
        lastName: 'One',
      });

      const user2 = await createUser(app, tenant.id, adminToken, {
        email: 'roleuser2@permtest.com',
        password: 'Password123!',
        firstName: 'RoleUser',
        lastName: 'Two',
      });

      // Assign custom role to both users
      await assignRolesToUser(app, tenant.id, adminToken, user1.id, [
        customRole.id,
      ]);
      await assignRolesToUser(app, tenant.id, adminToken, user2.id, [
        customRole.id,
      ]);

      // Login both users
      const user1Token = await loginUser(
        app,
        tenant.id,
        user1.email,
        user1.password,
      );
      const user2Token = await loginUser(
        app,
        tenant.id,
        user2.email,
        user2.password,
      );

      // Both users should not be able to access projects (no permissions yet)
      await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);

      // Get read:project permission
      const permissionsResponse = await request(app.getHttpServer())
        .get('/permissions')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const readProjectPerm = permissionsResponse.body.find(
        (p: any) => p.action === 'read' && p.subject === 'project',
      );

      // Add read:project permission to the custom role
      await assignPermissionsToRole(app, tenant.id, adminToken, customRole.id, [
        readProjectPerm.id,
      ]);

      // Both users should now be able to access projects
      await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);
    });

    it('should revoke access from all users when permission is removed from role', async () => {
      // Create a custom role
      const customRole2 = await createRole(app, tenant.id, adminToken, {
        name: 'Custom Role 2',
      });

      // Get read:project permission
      const permissionsResponse = await request(app.getHttpServer())
        .get('/permissions')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const readProjectPerm = permissionsResponse.body.find(
        (p: any) => p.action === 'read' && p.subject === 'project',
      );

      // Add permission to role
      await assignPermissionsToRole(
        app,
        tenant.id,
        adminToken,
        customRole2.id,
        [readProjectPerm.id],
      );

      // Create one user with this role
      const user3 = await createUser(app, tenant.id, adminToken, {
        email: 'roleuser3@permtest.com',
        password: 'Password123!',
        firstName: 'RoleUser',
        lastName: 'Three',
      });

      // Assign custom role to user
      await assignRolesToUser(app, tenant.id, adminToken, user3.id, [
        customRole2.id,
      ]);

      // Login user
      const user3Token = await loginUser(
        app,
        tenant.id,
        user3.email,
        user3.password,
      );

      // User should be able to access projects
      await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${user3Token}`)
        .expect(200);

      // Remove all permissions from the role
      await assignPermissionsToRole(
        app,
        tenant.id,
        adminToken,
        customRole2.id,
        [],
      );

      // User should no longer be able to access projects
      await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${user3Token}`)
        .expect(403);
    });

    it('should affect multiple users when role permissions are updated', async () => {
      // Create a custom role
      const customRole3 = await createRole(app, tenant.id, adminToken, {
        name: 'Custom Role 3',
      });

      // Get permissions
      const permissionsResponse = await request(app.getHttpServer())
        .get('/permissions')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const readProjectPerm = permissionsResponse.body.find(
        (p: any) => p.action === 'read' && p.subject === 'project',
      );
      const createProjectPerm = permissionsResponse.body.find(
        (p: any) => p.action === 'create' && p.subject === 'project',
      );

      // Add only read permission to role
      await assignPermissionsToRole(
        app,
        tenant.id,
        adminToken,
        customRole3.id,
        [readProjectPerm.id],
      );

      // Create users with this role
      const user5 = await createUser(app, tenant.id, adminToken, {
        email: 'roleuser5@permtest.com',
        password: 'Password123!',
        firstName: 'RoleUser',
        lastName: 'Five',
      });

      await assignRolesToUser(app, tenant.id, adminToken, user5.id, [
        customRole3.id,
      ]);

      const user5Token = await loginUser(
        app,
        tenant.id,
        user5.email,
        user5.password,
      );

      // User can read but not create
      await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${user5Token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${user5Token}`)
        .send({
          name: 'Should Fail',
          description: 'No create permission',
        })
        .expect(403);

      // Update role to include create permission
      await assignPermissionsToRole(
        app,
        tenant.id,
        adminToken,
        customRole3.id,
        [readProjectPerm.id, createProjectPerm.id],
      );

      // User should now be able to create
      await request(app.getHttpServer())
        .post('/projects')
        .set('x-tenant-id', tenant.id)
        .set('Authorization', `Bearer ${user5Token}`)
        .send({
          name: 'Success Project',
          description: 'Now has create permission',
        })
        .expect(201);
    });
  });
});
