import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  setupTestApp,
  cleanDatabase,
  registerTenant,
  loginUser,
  TestTenant,
  TestUser,
} from './e2e-setup';
import { PrismaService } from '../src/database/prisma.service';

describe('Notification Preferences API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenant1: TestTenant;
  let tenant2: TestTenant;
  let user1: TestUser;
  let user2: TestUser;
  let user1Token: string;
  let user2Token: string;
  let tenant2UserToken: string;

  beforeAll(async () => {
    app = await setupTestApp();
    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();

    // Register two tenants
    const tenant1Result = await registerTenant(app, {
      tenantName: 'Test Tenant 1',
      adminEmail: 'admin1@test.com',
      adminPassword: 'Password123!',
      adminFirstName: 'Admin',
      adminLastName: 'One',
    });
    tenant1 = tenant1Result.tenant;
    user1 = tenant1Result.user;

    const tenant2Result = await registerTenant(app, {
      tenantName: 'Test Tenant 2',
      adminEmail: 'admin2@test.com',
      adminPassword: 'Password123!',
      adminFirstName: 'Admin',
      adminLastName: 'Two',
    });
    tenant2 = tenant2Result.tenant;

    // Create a regular user in tenant1
    const user2Response = await request(app.getHttpServer())
      .post('/users')
      .set('x-tenant-id', tenant1.id)
      .set(
        'Authorization',
        `Bearer ${await loginUser(app, tenant1.id, user1.email, user1.password)}`,
      )
      .send({
        email: 'user2@test.com',
        password: 'Password123!',
        firstName: 'User',
        lastName: 'Two',
      })
      .expect(201);

    user2 = { ...user2Response.body, password: 'Password123!' };

    // Get tokens
    user1Token = await loginUser(app, tenant1.id, user1.email, user1.password);
    user2Token = await loginUser(app, tenant1.id, user2.email, user2.password);
    tenant2UserToken = await loginUser(
      app,
      tenant2.id,
      tenant2Result.user.email,
      tenant2Result.user.password,
    );

    // Create some test notification preferences using raw SQL
    await prisma.$executeRaw`
      INSERT INTO notification_preferences ("tenantId", "userId", category, "inAppEnabled", "emailEnabled", "smsEnabled", "createdAt", "updatedAt")
      VALUES 
        (${tenant1.id}, ${user1.id}, 'system', true, true, false, NOW(), NOW()),
        (${tenant1.id}, ${user1.id}, 'project', true, false, true, NOW(), NOW()),
        (${tenant1.id}, ${user2.id}, 'security', true, true, true, NOW(), NOW()),
        (${tenant2.id}, ${tenant2Result.user.id}, 'system', false, true, false, NOW(), NOW())
    `;
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  describe('GET /notification-preferences', () => {
    it('should return user notification preferences', async () => {
      const response = await request(app.getHttpServer())
        .get('/notification-preferences')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);

      // Should only return preferences for the authenticated user
      response.body.forEach((preference: any) => {
        expect(preference.userId).toBe(user1.id);
        expect(preference.tenantId).toBe(tenant1.id);
        expect(preference).toHaveProperty('id');
        expect(preference).toHaveProperty('category');
        expect(preference).toHaveProperty('inAppEnabled');
        expect(preference).toHaveProperty('emailEnabled');
        expect(preference).toHaveProperty('smsEnabled');
        expect(preference).toHaveProperty('createdAt');
        expect(preference).toHaveProperty('updatedAt');
      });

      // Check specific preferences
      const systemPref = response.body.find(
        (p: any) => p.category === 'system',
      );
      expect(systemPref.inAppEnabled).toBe(true);
      expect(systemPref.emailEnabled).toBe(true);
      expect(systemPref.smsEnabled).toBe(false);

      const projectPref = response.body.find(
        (p: any) => p.category === 'project',
      );
      expect(projectPref.inAppEnabled).toBe(true);
      expect(projectPref.emailEnabled).toBe(false);
      expect(projectPref.smsEnabled).toBe(true);
    });

    it('should return empty array for user with no preferences', async () => {
      // Create a new user with no preferences
      await request(app.getHttpServer())
        .post('/users')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          email: 'newuser@test.com',
          password: 'Password123!',
          firstName: 'New',
          lastName: 'User',
        })
        .expect(201);

      const newUserToken = await loginUser(
        app,
        tenant1.id,
        'newuser@test.com',
        'Password123!',
      );

      const response = await request(app.getHttpServer())
        .get('/notification-preferences')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app.getHttpServer())
        .get('/notification-preferences')
        .set('x-tenant-id', tenant2.id)
        .set('Authorization', `Bearer ${tenant2UserToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].tenantId).toBe(tenant2.id);
      expect(response.body[0].category).toBe('system');
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/notification-preferences')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });
  });

  describe('GET /notification-preferences/categories', () => {
    it('should return available notification categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/notification-preferences/categories')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(response.body.categories.length).toBeGreaterThan(0);

      // Should include common categories
      expect(response.body.categories).toContain('system');
      expect(response.body.categories).toContain('user_activity');
      expect(response.body.categories).toContain('project');
      expect(response.body.categories).toContain('security');
      expect(response.body.categories).toContain('invoice');
    });

    it('should return same categories for different users in same tenant', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/notification-preferences/categories')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/notification-preferences/categories')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(response1.body.categories).toEqual(response2.body.categories);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/notification-preferences/categories')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });
  });

  describe('PUT /notification-preferences/:category', () => {
    it('should update notification preferences for existing category', async () => {
      const updateData = {
        inAppEnabled: false,
        emailEnabled: true,
        smsEnabled: true,
      };

      const response = await request(app.getHttpServer())
        .put('/notification-preferences/system')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.category).toBe('system');
      expect(response.body.userId).toBe(user1.id);
      expect(response.body.tenantId).toBe(tenant1.id);
      expect(response.body.inAppEnabled).toBe(false);
      expect(response.body.emailEnabled).toBe(true);
      expect(response.body.smsEnabled).toBe(true);
      expect(response.body).toHaveProperty('updatedAt');

      // Verify in database
      const result = await prisma.$queryRaw`
        SELECT "inAppEnabled", "emailEnabled", "smsEnabled" 
        FROM notification_preferences 
        WHERE "tenantId" = ${tenant1.id} AND "userId" = ${user1.id} AND category = 'system'
      `;

      const preference = (result as any[])[0];
      expect(preference?.inAppEnabled).toBe(false);
      expect(preference?.emailEnabled).toBe(true);
      expect(preference?.smsEnabled).toBe(true);
    });

    it('should create new preference for non-existing category', async () => {
      const updateData = {
        inAppEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
      };

      const response = await request(app.getHttpServer())
        .put('/notification-preferences/invoice')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.category).toBe('invoice');
      expect(response.body.userId).toBe(user1.id);
      expect(response.body.tenantId).toBe(tenant1.id);
      expect(response.body.inAppEnabled).toBe(true);
      expect(response.body.emailEnabled).toBe(false);
      expect(response.body.smsEnabled).toBe(false);

      // Verify in database
      const result = await prisma.$queryRaw`
        SELECT "inAppEnabled", "emailEnabled", "smsEnabled" 
        FROM notification_preferences 
        WHERE "tenantId" = ${tenant1.id} AND "userId" = ${user1.id} AND category = 'invoice'
      `;

      expect((result as any[]).length).toBeGreaterThan(0);
      const preference = (result as any[])[0];
      expect(preference?.inAppEnabled).toBe(true);
      expect(preference?.emailEnabled).toBe(false);
      expect(preference?.smsEnabled).toBe(false);
    });

    it('should validate request body', async () => {
      // Missing required fields
      await request(app.getHttpServer())
        .put('/notification-preferences/system')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({})
        .expect(400);

      // Invalid data types
      await request(app.getHttpServer())
        .put('/notification-preferences/system')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          inAppEnabled: 'invalid',
          emailEnabled: true,
          smsEnabled: false,
        })
        .expect(400);
    });

    it('should enforce tenant isolation', async () => {
      const updateData = {
        inAppEnabled: true,
        emailEnabled: true,
        smsEnabled: true,
      };

      // User from tenant2 should not be able to update tenant1 preferences
      const response = await request(app.getHttpServer())
        .put('/notification-preferences/system')
        .set('x-tenant-id', tenant2.id)
        .set('Authorization', `Bearer ${tenant2UserToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.tenantId).toBe(tenant2.id);

      // Verify tenant1 preferences are not affected
      const result = await prisma.$queryRaw`
        SELECT "inAppEnabled", "emailEnabled", "smsEnabled" 
        FROM notification_preferences 
        WHERE "tenantId" = ${tenant1.id} AND "userId" = ${user1.id} AND category = 'system'
      `;

      const tenant1Preference = (result as any[])[0];
      expect(tenant1Preference?.inAppEnabled).toBe(true); // Original value
      expect(tenant1Preference?.emailEnabled).toBe(true); // Original value
      expect(tenant1Preference?.smsEnabled).toBe(false); // Original value
    });

    it("should not allow users to update other users' preferences", async () => {
      const updateData = {
        inAppEnabled: false,
        emailEnabled: false,
        smsEnabled: false,
      };

      // user2 tries to update, but it should create/update their own preference
      const response = await request(app.getHttpServer())
        .put('/notification-preferences/system')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user2Token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.userId).toBe(user2.id);

      // Verify user1's preferences are not affected
      const result = await prisma.$queryRaw`
        SELECT "inAppEnabled", "emailEnabled", "smsEnabled" 
        FROM notification_preferences 
        WHERE "tenantId" = ${tenant1.id} AND "userId" = ${user1.id} AND category = 'system'
      `;

      const user1Preference = (result as any[])[0];
      expect(user1Preference?.inAppEnabled).toBe(true); // Original value
      expect(user1Preference?.emailEnabled).toBe(true); // Original value
      expect(user1Preference?.smsEnabled).toBe(false); // Original value
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .put('/notification-preferences/system')
        .set('x-tenant-id', tenant1.id)
        .send({
          inAppEnabled: true,
          emailEnabled: true,
          smsEnabled: true,
        })
        .expect(401);
    });
  });

  describe('Partial updates', () => {
    it('should allow partial updates of preferences', async () => {
      // Update only emailEnabled
      const response = await request(app.getHttpServer())
        .put('/notification-preferences/system')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          emailEnabled: false,
        })
        .expect(200);

      expect(response.body.emailEnabled).toBe(false);
      // Other fields should remain unchanged or use defaults
      expect(response.body.inAppEnabled).toBeDefined();
      expect(response.body.smsEnabled).toBeDefined();
    });
  });
});
