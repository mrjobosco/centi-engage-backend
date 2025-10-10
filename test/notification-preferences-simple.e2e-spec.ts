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

describe('Notification Preferences API (e2e) - Simple Tests', () => {
  let app: INestApplication;
  let tenant1: TestTenant;
  let user1: TestUser;
  let user1Token: string;

  beforeAll(async () => {
    app = await setupTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();

    // Register tenant
    const tenant1Result = await registerTenant(app, {
      tenantName: 'Test Tenant 1',
      adminEmail: 'admin1@test.com',
      adminPassword: 'Password123!',
      adminFirstName: 'Admin',
      adminLastName: 'One',
    });
    tenant1 = tenant1Result.tenant;
    user1 = tenant1Result.user;

    // Get token
    user1Token = await loginUser(app, tenant1.id, user1.email, user1.password);
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  describe('Authentication Tests', () => {
    it('should return 401 for unauthenticated GET /notification-preferences', async () => {
      await request(app.getHttpServer())
        .get('/notification-preferences')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });

    it('should return 401 for unauthenticated GET /notification-preferences/categories', async () => {
      await request(app.getHttpServer())
        .get('/notification-preferences/categories')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });

    it('should return 401 for unauthenticated PUT /notification-preferences/:category', async () => {
      await request(app.getHttpServer())
        .put('/notification-preferences/system')
        .set('x-tenant-id', tenant1.id)
        .send({
          inAppEnabled: true,
          emailEnabled: true,
          smsEnabled: false,
        })
        .expect(401);
    });
  });

  describe('Basic API Tests', () => {
    it('should return empty preferences list for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/notification-preferences')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });

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

    it('should create new preference for category', async () => {
      const updateData = {
        inAppEnabled: true,
        emailEnabled: false,
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
      expect(response.body.inAppEnabled).toBe(true);
      expect(response.body.emailEnabled).toBe(false);
      expect(response.body.smsEnabled).toBe(true);
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
    });

    it('should update existing preference for category', async () => {
      // First create a preference
      await request(app.getHttpServer())
        .put('/notification-preferences/system')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          inAppEnabled: true,
          emailEnabled: true,
          smsEnabled: false,
        })
        .expect(200);

      // Then update it
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
      expect(response.body.inAppEnabled).toBe(false);
      expect(response.body.emailEnabled).toBe(true);
      expect(response.body.smsEnabled).toBe(true);
    });

    it('should validate request body', async () => {
      // Invalid data types should return 400
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

      // Empty body might be accepted with defaults, so let's test that it works
      const response = await request(app.getHttpServer())
        .put('/notification-preferences/system')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({})
        .expect(200);

      // Should have default values or the service should handle empty body
      expect(response.body).toHaveProperty('category', 'system');
      expect(response.body).toHaveProperty('userId', user1.id);
      expect(response.body).toHaveProperty('tenantId', tenant1.id);
    });
  });

  describe('Tenant Isolation Tests', () => {
    let tenant2: TestTenant;
    let tenant2UserToken: string;

    beforeEach(async () => {
      // Register second tenant
      const tenant2Result = await registerTenant(app, {
        tenantName: 'Test Tenant 2',
        adminEmail: 'admin2@test.com',
        adminPassword: 'Password123!',
        adminFirstName: 'Admin',
        adminLastName: 'Two',
      });
      tenant2 = tenant2Result.tenant;
      tenant2UserToken = await loginUser(
        app,
        tenant2.id,
        tenant2Result.user.email,
        tenant2Result.user.password,
      );
    });

    it('should prevent cross-tenant access with wrong tenant header', async () => {
      // User from tenant1 tries to access with tenant2 header
      // This might return 401 if JWT validation fails before tenant check
      const response = await request(app.getHttpServer())
        .get('/notification-preferences')
        .set('x-tenant-id', tenant2.id)
        .set('Authorization', `Bearer ${user1Token}`);

      expect([401, 403]).toContain(response.status);
    });

    it('should prevent access without tenant header', async () => {
      await request(app.getHttpServer())
        .get('/notification-preferences')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(400);
    });

    it('should return same categories for different tenants', async () => {
      const response1 = await request(app.getHttpServer())
        .get('/notification-preferences/categories')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/notification-preferences/categories')
        .set('x-tenant-id', tenant2.id)
        .set('Authorization', `Bearer ${tenant2UserToken}`)
        .expect(200);

      expect(response1.body.categories).toEqual(response2.body.categories);
    });
  });
});
