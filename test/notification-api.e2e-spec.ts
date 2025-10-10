import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  setupTestApp,
  cleanDatabase,
  registerTenant,
  loginUser,
  TestTenant,
  TestUser,
} from './e2e-setup';
import { PrismaService } from '../src/database/prisma.service';
import { NotificationType } from '../src/notifications/enums/notification-type.enum';

describe('Notification API (e2e)', () => {
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

    // Test data will be created via API calls in individual tests
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  describe('GET /notifications', () => {
    it('should return paginated notifications for authenticated user', async () => {
      // Create test notifications via API
      await request(app.getHttpServer())
        .post('/notifications')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'INFO',
          category: 'system',
          title: 'Welcome',
          message: 'Welcome to the platform',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/notifications')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'SUCCESS',
          category: 'project',
          title: 'Project Created',
          message: 'Your project has been created',
        })
        .expect(201);

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

      expect(response.body.notifications).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);

      // Should only return notifications for the authenticated user
      response.body.notifications.forEach((notification: any) => {
        expect(notification.userId).toBe(user1.id);
        expect(notification.tenantId).toBe(tenant1.id);
      });
    });

    it('should support pagination', async () => {
      // Create test notifications
      await request(app.getHttpServer())
        .post('/notifications')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'INFO',
          category: 'system',
          title: 'Notification 1',
          message: 'First notification',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/notifications')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'INFO',
          category: 'system',
          title: 'Notification 2',
          message: 'Second notification',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/notifications?page=1&limit=1')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.total).toBe(2);
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(1);
      expect(response.body.totalPages).toBe(2);
    });

    it('should support filtering by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications?type=SUCCESS')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.notifications[0].type).toBe('SUCCESS');
      expect(response.body.notifications[0].title).toBe('Project Created');
    });

    it('should support filtering by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications?category=system')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.notifications[0].category).toBe('system');
      expect(response.body.notifications[0].title).toBe('Welcome');
    });

    it('should support filtering by read status', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications?unread=true')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.notifications[0].readAt).toBeNull();
      expect(response.body.notifications[0].title).toBe('Welcome');
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('x-tenant-id', tenant2.id)
        .set('Authorization', `Bearer ${tenant2UserToken}`)
        .expect(200);

      expect(response.body.notifications).toHaveLength(1);
      expect(response.body.notifications[0].tenantId).toBe(tenant2.id);
      expect(response.body.notifications[0].title).toBe('System Error');
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/notifications')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });
  });

  describe('GET /notifications/:id', () => {
    it('should return specific notification for owner', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/notif-1')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.id).toBe('notif-1');
      expect(response.body.title).toBe('Welcome');
      expect(response.body.userId).toBe(user1.id);
      expect(response.body.tenantId).toBe(tenant1.id);
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .get('/notifications/non-existent')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it("should return 404 when trying to access another user's notification", async () => {
      await request(app.getHttpServer())
        .get('/notifications/notif-3')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/notifications/notif-1')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const response = await request(app.getHttpServer())
        .patch('/notifications/notif-1/read')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notification marked as read');

      // Verify notification is marked as read in database
      const result = await prisma.$queryRaw`
        SELECT "readAt" FROM notifications WHERE id = 'notif-1'
      `;
      expect((result as any)[0]?.readAt).not.toBeNull();
    });

    it("should return 404 when trying to mark another user's notification as read", async () => {
      await request(app.getHttpServer())
        .patch('/notifications/notif-3/read')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/non-existent/read')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/notif-1/read')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });
  });

  describe('PATCH /notifications/read-all', () => {
    it('should mark all user notifications as read', async () => {
      const response = await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('All notifications marked as read');

      // Verify all user1's notifications are marked as read
      const user1Notifications = await prisma.$queryRaw`
        SELECT "readAt" FROM notifications WHERE "userId" = ${user1.id} AND "tenantId" = ${tenant1.id}
      `;
      (user1Notifications as any[]).forEach((notification) => {
        expect(notification.readAt).not.toBeNull();
      });

      // Verify user2's notifications are not affected
      const user2Notifications = await prisma.$queryRaw`
        SELECT "readAt" FROM notifications WHERE "userId" = ${user2.id} AND "tenantId" = ${tenant1.id}
      `;
      expect((user2Notifications as any[])[0]?.readAt).toBeNull();
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });
  });

  describe('DELETE /notifications/:id', () => {
    it('should soft delete notification', async () => {
      const response = await request(app.getHttpServer())
        .delete('/notifications/notif-1')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notification deleted successfully');

      // Verify notification is soft deleted (should still exist but marked as deleted)
      const result = await prisma.$queryRaw`
        SELECT id FROM notifications WHERE id = 'notif-1'
      `;
      expect((result as any[]).length).toBeGreaterThan(0);
      // Note: The actual soft delete implementation might set a deletedAt field
      // This test assumes the notification still exists but is marked as deleted
    });

    it("should return 404 when trying to delete another user's notification", async () => {
      await request(app.getHttpServer())
        .delete('/notifications/notif-3')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should return 404 for non-existent notification', async () => {
      await request(app.getHttpServer())
        .delete('/notifications/non-existent')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(404);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .delete('/notifications/notif-1')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('should return unread notification count', async () => {
      const response = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.count).toBe(1); // Only notif-1 is unread for user1
    });

    it('should return 0 when all notifications are read', async () => {
      // Mark all as read first
      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body.count).toBe(0);
    });

    it('should return 401 for unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('x-tenant-id', tenant1.id)
        .expect(401);
    });
  });
});
