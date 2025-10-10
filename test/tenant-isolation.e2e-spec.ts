import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  cleanDatabase,
  createProject,
  createUserWithPermissions,
  getProject,
  getProjects,
  getUsers,
  loginUser,
  registerTenant,
  runMigrations,
  setupTestApp,
  TestProject,
  TestTenant,
  TestUser,
} from './e2e-setup';

describe('Tenant Isolation E2E Tests', () => {
  let app: INestApplication;

  // Tenant A data
  let tenantA: TestTenant;
  let tenantAAdmin: TestUser;
  let tenantAAdminToken: string;
  let tenantAUser: TestUser;
  let tenantAUserToken: string;
  let tenantAProject1: TestProject;
  let tenantAProject2: TestProject;

  // Tenant B data
  let tenantB: TestTenant;
  let tenantBAdmin: TestUser;
  let tenantBAdminToken: string;
  let tenantBUser: TestUser;
  let tenantBUserToken: string;
  let tenantBProject1: TestProject;
  let tenantBProject2: TestProject;

  beforeAll(async () => {
    // Run migrations
    runMigrations();

    // Setup application
    app = await setupTestApp();

    // Clean database
    await cleanDatabase();

    // Create Tenant A
    const tenantAResult = await registerTenant(app, {
      tenantName: 'Tenant A Corp',
      adminEmail: 'admin@tenanta.com',
      adminPassword: 'Password123!',
      adminFirstName: 'Admin',
      adminLastName: 'TenantA',
    });
    tenantA = tenantAResult.tenant;
    tenantAAdmin = tenantAResult.user;
    tenantAAdminToken = await loginUser(
      app,
      tenantA.id,
      tenantAAdmin.email,
      tenantAAdmin.password,
    );

    // Create additional user in Tenant A with project permissions
    tenantAUser = await createUserWithPermissions(
      app,
      tenantA.id,
      tenantAAdminToken,
      {
        email: 'user@tenanta.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
      },
      ['create:project', 'read:project', 'update:project', 'delete:project'],
    );
    tenantAUserToken = await loginUser(
      app,
      tenantA.id,
      tenantAUser.email,
      tenantAUser.password,
    );

    // Create projects in Tenant A
    tenantAProject1 = await createProject(app, tenantA.id, tenantAAdminToken, {
      name: 'Tenant A Project 1',
      description: 'First project for Tenant A',
    });
    tenantAProject2 = await createProject(app, tenantA.id, tenantAUserToken, {
      name: 'Tenant A Project 2',
      description: 'Second project for Tenant A',
    });

    // Create Tenant B
    const tenantBResult = await registerTenant(app, {
      tenantName: 'Tenant B Inc',
      adminEmail: 'admin@tenantb.com',
      adminPassword: 'Password456!',
      adminFirstName: 'Admin',
      adminLastName: 'TenantB',
    });
    tenantB = tenantBResult.tenant;
    tenantBAdmin = tenantBResult.user;
    tenantBAdminToken = await loginUser(
      app,
      tenantB.id,
      tenantBAdmin.email,
      tenantBAdmin.password,
    );

    // Create additional user in Tenant B with project permissions
    tenantBUser = await createUserWithPermissions(
      app,
      tenantB.id,
      tenantBAdminToken,
      {
        email: 'user@tenantb.com',
        password: 'Password456!',
        firstName: 'Jane',
        lastName: 'Smith',
      },
      ['create:project', 'read:project', 'update:project', 'delete:project'],
    );
    tenantBUserToken = await loginUser(
      app,
      tenantB.id,
      tenantBUser.email,
      tenantBUser.password,
    );

    // Create projects in Tenant B
    tenantBProject1 = await createProject(app, tenantB.id, tenantBAdminToken, {
      name: 'Tenant B Project 1',
      description: 'First project for Tenant B',
    });
    tenantBProject2 = await createProject(app, tenantB.id, tenantBUserToken, {
      name: 'Tenant B Project 2',
      description: 'Second project for Tenant B',
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  describe('Cross-tenant project access prevention', () => {
    it('should return 404 when Tenant A user tries to access Tenant B project', async () => {
      const response = await getProject(
        app,
        tenantA.id,
        tenantAAdminToken,
        tenantBProject1.id,
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should return 404 when Tenant B user tries to access Tenant A project', async () => {
      const response = await getProject(
        app,
        tenantB.id,
        tenantBAdminToken,
        tenantAProject1.id,
      );

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should return 404 when Tenant A regular user tries to access Tenant B project', async () => {
      const response = await getProject(
        app,
        tenantA.id,
        tenantAUserToken,
        tenantBProject2.id,
      );

      expect(response.status).toBe(404);
    });

    it('should return 404 when Tenant B regular user tries to access Tenant A project', async () => {
      const response = await getProject(
        app,
        tenantB.id,
        tenantBUserToken,
        tenantAProject2.id,
      );

      expect(response.status).toBe(404);
    });
  });

  describe('JWT token tenant mismatch', () => {
    it('should fail when using Tenant A JWT with Tenant B tenant ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenantB.id)
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .expect(401);

      expect(response.body.message).toContain('tenant ID');
    });

    it('should fail when using Tenant B JWT with Tenant A tenant ID', async () => {
      const response = await request(app.getHttpServer())
        .get('/projects')
        .set('x-tenant-id', tenantA.id)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(401);

      expect(response.body.message).toContain('tenant ID');
    });

    it('should fail when trying to access Tenant B project with Tenant A JWT and Tenant B tenant ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/projects/${tenantBProject1.id}`)
        .set('x-tenant-id', tenantB.id)
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .expect(401);

      expect(response.body.message).toContain('tenant ID');
    });

    it('should fail when trying to create project with mismatched tenant ID in JWT', async () => {
      const response = await request(app.getHttpServer())
        .post('/projects')
        .set('x-tenant-id', tenantB.id)
        .set('Authorization', `Bearer ${tenantAUserToken}`)
        .send({
          name: 'Malicious Project',
          description: 'Should not be created',
        })
        .expect(401);

      expect(response.body.message).toContain('tenant ID');
    });
  });

  describe('User queries return only tenant-specific data', () => {
    it('should return only Tenant A projects when Tenant A user queries projects', async () => {
      const projects = await getProjects(app, tenantA.id, tenantAAdminToken);

      expect(projects).toHaveLength(2);
      expect(
        projects.every((p: TestProject) => p.tenantId === tenantA.id),
      ).toBe(true);
      expect(projects.map((p: TestProject) => p.id)).toContain(
        tenantAProject1.id,
      );
      expect(projects.map((p: TestProject) => p.id)).toContain(
        tenantAProject2.id,
      );
      expect(projects.map((p: TestProject) => p.id)).not.toContain(
        tenantBProject1.id,
      );
      expect(projects.map((p: TestProject) => p.id)).not.toContain(
        tenantBProject2.id,
      );
    });

    it('should return only Tenant B projects when Tenant B user queries projects', async () => {
      const projects = await getProjects(app, tenantB.id, tenantBAdminToken);

      expect(projects).toHaveLength(2);
      expect(
        projects.every((p: TestProject) => p.tenantId === tenantB.id),
      ).toBe(true);
      expect(projects.map((p: TestProject) => p.id)).toContain(
        tenantBProject1.id,
      );
      expect(projects.map((p: TestProject) => p.id)).toContain(
        tenantBProject2.id,
      );
      expect(projects.map((p: TestProject) => p.id)).not.toContain(
        tenantAProject1.id,
      );
      expect(projects.map((p: TestProject) => p.id)).not.toContain(
        tenantAProject2.id,
      );
    });

    it('should return only Tenant A users when Tenant A admin queries users', async () => {
      const users = await getUsers(app, tenantA.id, tenantAAdminToken);

      expect(users).toHaveLength(2);
      expect(users.every((u: TestUser) => u.tenantId === tenantA.id)).toBe(
        true,
      );
      expect(users.map((u: TestUser) => u.id)).toContain(tenantAAdmin.id);
      expect(users.map((u: TestUser) => u.id)).toContain(tenantAUser.id);
      expect(users.map((u: TestUser) => u.id)).not.toContain(tenantBAdmin.id);
      expect(users.map((u: TestUser) => u.id)).not.toContain(tenantBUser.id);
    });

    it('should return only Tenant B users when Tenant B admin queries users', async () => {
      const users = await getUsers(app, tenantB.id, tenantBAdminToken);

      expect(users).toHaveLength(2);
      expect(users.every((u: TestUser) => u.tenantId === tenantB.id)).toBe(
        true,
      );
      expect(users.map((u: TestUser) => u.id)).toContain(tenantBAdmin.id);
      expect(users.map((u: TestUser) => u.id)).toContain(tenantBUser.id);
      expect(users.map((u: TestUser) => u.id)).not.toContain(tenantAAdmin.id);
      expect(users.map((u: TestUser) => u.id)).not.toContain(tenantAUser.id);
    });
  });

  describe('Cross-tenant resource modification attempts', () => {
    it('should fail when Tenant A user tries to update Tenant B project', async () => {
      const response = await request(app.getHttpServer())
        .put(`/projects/${tenantBProject1.id}`)
        .set('x-tenant-id', tenantA.id)
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .send({
          name: 'Hacked Project Name',
          description: 'Should not be updated',
        })
        .expect(404);

      expect(response.body.message).toContain('not found');

      // Verify project was not modified
      const verifyResponse = await getProject(
        app,
        tenantB.id,
        tenantBAdminToken,
        tenantBProject1.id,
      );
      expect(verifyResponse.body.name).toBe('Tenant B Project 1');
    });

    it('should fail when Tenant B user tries to delete Tenant A project', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/projects/${tenantAProject1.id}`)
        .set('x-tenant-id', tenantB.id)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(404);

      expect(response.body.message).toContain('not found');

      // Verify project still exists
      const verifyResponse = await getProject(
        app,
        tenantA.id,
        tenantAAdminToken,
        tenantAProject1.id,
      );
      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.id).toBe(tenantAProject1.id);
    });

    it('should fail when Tenant A user tries to access Tenant B user details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${tenantBUser.id}`)
        .set('x-tenant-id', tenantA.id)
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .expect(404);

      expect(response.body.message).toContain('not found');
    });

    it('should fail when Tenant B user tries to update Tenant A user', async () => {
      const response = await request(app.getHttpServer())
        .put(`/users/${tenantAUser.id}`)
        .set('x-tenant-id', tenantB.id)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .send({
          firstName: 'Hacked',
          lastName: 'Name',
        })
        .expect(404);

      expect(response.body.message).toContain('not found');

      // Verify user was not modified
      const users = await getUsers(app, tenantA.id, tenantAAdminToken);
      const user = users.find((u: TestUser) => u.id === tenantAUser.id);
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
    });
  });

  describe('Tenant-specific role and permission isolation', () => {
    it('should not allow Tenant A admin to access Tenant B roles', async () => {
      const response = await request(app.getHttpServer())
        .get('/roles')
        .set('x-tenant-id', tenantA.id)
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .expect(200);

      const roles = response.body;
      expect(roles.every((r: any) => r.tenantId === tenantA.id)).toBe(true);
    });

    it('should not allow Tenant B admin to access Tenant A permissions', async () => {
      const response = await request(app.getHttpServer())
        .get('/permissions')
        .set('x-tenant-id', tenantB.id)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(200);

      const permissions = response.body;
      expect(permissions.every((p: any) => p.tenantId === tenantB.id)).toBe(
        true,
      );
    });
  });

  describe('Successful same-tenant access', () => {
    it('should allow Tenant A user to access Tenant A projects', async () => {
      const response = await getProject(
        app,
        tenantA.id,
        tenantAUserToken,
        tenantAProject1.id,
      );

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(tenantAProject1.id);
      expect(response.body.tenantId).toBe(tenantA.id);
    });

    it('should allow Tenant B user to access Tenant B projects', async () => {
      const response = await getProject(
        app,
        tenantB.id,
        tenantBUserToken,
        tenantBProject2.id,
      );

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(tenantBProject2.id);
      expect(response.body.tenantId).toBe(tenantB.id);
    });

    it('should allow Tenant A admin to manage Tenant A users', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${tenantAUser.id}`)
        .set('x-tenant-id', tenantA.id)
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .expect(200);

      expect(response.body.id).toBe(tenantAUser.id);
      expect(response.body.tenantId).toBe(tenantA.id);
    });

    it('should allow Tenant B admin to manage Tenant B users', async () => {
      const response = await request(app.getHttpServer())
        .get(`/users/${tenantBUser.id}`)
        .set('x-tenant-id', tenantB.id)
        .set('Authorization', `Bearer ${tenantBAdminToken}`)
        .expect(200);

      expect(response.body.id).toBe(tenantBUser.id);
      expect(response.body.tenantId).toBe(tenantB.id);
    });
  });
});
