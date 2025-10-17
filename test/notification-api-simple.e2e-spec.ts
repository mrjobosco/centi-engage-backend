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

describe('Notification API (e2e) - Simple Tests', () => {
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
    it('should return 401 for unauthenticated GET /notifications', async () => {
      await request(app.getHttpServer())
        .get('/notifications')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });

    it('should return 401 for unauthenticated GET /notifications/:id', async () => {
      await request(app.getHttpServer())
        .get('/notifications/test-id')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });

    it('should return 401 for unauthenticated PATCH /notifications/:id/read', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/test-id/read')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });

    it('should return 401 for unauthenticated PATCH /notifications/read-all', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });

    it('should return 401 for unauthenticated DELETE /notifications/:id', async () => {
      await request(app.getHttpServer())
        .delete('/notifications/test-id')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });

    it('should return 401 for unauthenticated GET /notifications/unread-count', async () => {
      await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });
  });

  describe('Basic API Tests', () => {
    it('should return empty notifications list for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('notifications');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('totalPages');

      expect(response.body.notifications).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it('should return 0 unread count for authenticated user', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.count).toBe(0);
    });

    it('should create notification via API', async () => {
      const response = await request(app.getHttpServer())
        .post('/notifications')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          userId: user1.id,
          type: 'INFO',
          category: 'system',
          title: 'Test Notification',
          message: 'This is a test notification',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Notification');
      expect(response.body.message).toBe('This is a test notification');
      expect(response.body.type).toBe('INFO');
      expect(response.body.category).toBe('system');
      expect(response.body.userId).toBe(user1.id);
      expect(response.body.tenantId).toBe(tenant1.id);
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .get('/notifications/non-existent-id')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should return 404 when trying to mark non-existent notification as read', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/non-existent-id/read')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should return 404 when trying to delete non-existent notification', async () => {
      await request(app.getHttpServer())
        .delete('/notifications/non-existent-id')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should successfully mark all notifications as read (even when none exist)', async () => {
      const response = await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('All notifications marked as read');
    });
  });

  describe('Tenant Isolation Tests', () => {
    let tenant2: TestTenant;

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
        .get('/notifications')
        .set('x-tenant-id', tenant2.id)
        .set('Authorization', `Bearer ${user1Token}`);

      expect([401, 403]).toContain(response.status);
    });

    it('should prevent access without tenant header', async () => {
      await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(400);
    });

    it('should prevent access with invalid tenant ID', async () => {
      // This might return 401 if JWT validation fails before tenant check
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('x-tenant-id', 'invalid-tenant-id')
        .set('Authorization', `Bearer ${user1Token}`);

      expect([401, 403]).toContain(response.status);
    });
  });
});
