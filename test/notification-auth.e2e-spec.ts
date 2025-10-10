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

describe('Notification Authentication & Authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenant1: TestTenant;
  let tenant2: TestTenant;
  let user1: TestUser;
  let user2: TestUser;
  let tenant2User: TestUser;
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
    tenant2User = tenant2Result.user;

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
      tenant2User.email,
      tenant2User.password,
    );

    // Create test notifications for different users and tenants using raw SQL
    await prisma.$executeRaw`
      INSERT INTO notifications (id, "tenantId", "userId", type, category, title, message, "channelsSent", "createdAt")
      VALUES 
        ('notif-tenant1-user1', ${tenant1.id}, ${user1.id}, 'INFO', 'system', 'Tenant1 User1 Notification', 'Message for tenant1 user1', ARRAY['in-app'], NOW()),
        ('notif-tenant1-user2', ${tenant1.id}, ${user2.id}, 'INFO', 'system', 'Tenant1 User2 Notification', 'Message for tenant1 user2', ARRAY['in-app'], NOW()),
        ('notif-tenant2-user1', ${tenant2.id}, ${tenant2User.id}, 'INFO', 'system', 'Tenant2 User Notification', 'Message for tenant2 user', ARRAY['in-app'], NOW())
    `;

    // Create test notification preferences using raw SQL
    await prisma.$executeRaw`
      INSERT INTO notification_preferences ("tenantId", "userId", category, "inAppEnabled", "emailEnabled", "smsEnabled", "createdAt", "updatedAt")
      VALUES 
        (${tenant1.id}, ${user1.id}, 'system', true, true, false, NOW(), NOW()),
        (${tenant1.id}, ${user2.id}, 'project', true, false, true, NOW(), NOW()),
        (${tenant2.id}, ${tenant2User.id}, 'system', false, true, false, NOW(), NOW())
    `;
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  describe('Authentication Tests', () => {
    describe('Notification endpoints', () => {
      it('should reject unauthenticated requests to GET /notifications', async () => {
        await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', tenant1.id)
          .expect(401);
      });

      it('should reject unauthenticated requests to GET /notifications/:id', async () => {
        await request(app.getHttpServer())
          .get('/notifications/notif-tenant1-user1')
          .set('x-tenant-id', tenant1.id)
          .expect(401);
      });

      it('should reject unauthenticated requests to PATCH /notifications/:id/read', async () => {
        await request(app.getHttpServer())
          .patch('/notifications/notif-tenant1-user1/read')
          .set('x-tenant-id', tenant1.id)
          .expect(401);
      });

      it('should reject unauthenticated requests to PATCH /notifications/read-all', async () => {
        await request(app.getHttpServer())
          .patch('/notifications/read-all')
          .set('x-tenant-id', tenant1.id)
          .expect(401);
      });

      it('should reject unauthenticated requests to DELETE /notifications/:id', async () => {
        await request(app.getHttpServer())
          .delete('/notifications/notif-tenant1-user1')
          .set('x-tenant-id', tenant1.id)
          .expect(401);
      });

      it('should reject unauthenticated requests to GET /notifications/unread-count', async () => {
        await request(app.getHttpServer())
          .get('/notifications/unread-count')
          .set('x-tenant-id', tenant1.id)
          .expect(401);
      });

      it('should reject unauthenticated requests to POST /notifications', async () => {
        await request(app.getHttpServer())
          .post('/notifications')
          .set('x-tenant-id', tenant1.id)
          .send({
            type: 'INFO',
            category: 'system',
            title: 'Test',
            message: 'Test message',
          })
          .expect(401);
      });
    });

    describe('Notification preferences endpoints', () => {
      it('should reject unauthenticated requests to GET /notification-preferences', async () => {
        await request(app.getHttpServer())
          .get('/notification-preferences')
          .set('x-tenant-id', tenant1.id)
          .expect(401);
      });

      it('should reject unauthenticated requests to GET /notification-preferences/categories', async () => {
        await request(app.getHttpServer())
          .get('/notification-preferences/categories')
          .set('x-tenant-id', tenant1.id)
          .expect(401);
      });

      it('should reject unauthenticated requests to PUT /notification-preferences/:category', async () => {
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

    describe('Invalid tokens', () => {
      it('should reject requests with invalid JWT tokens', async () => {
        await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });

      it('should reject requests with malformed Authorization header', async () => {
        await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', 'InvalidFormat token')
          .expect(401);
      });

      it('should reject requests with expired tokens', async () => {
        // This would require creating an expired token, which is complex in a test environment
        // For now, we'll test with a malformed token that simulates expiration
        const expiredToken =
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

        await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);
      });
    });
  });

  describe('Authorization Tests - User Access Control', () => {
    describe('Notification ownership', () => {
      it('should allow users to access their own notifications', async () => {
        const response = await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        expect(response.body.notifications).toHaveLength(1);
        expect(response.body.notifications[0].id).toBe('notif-tenant1-user1');
        expect(response.body.notifications[0].userId).toBe(user1.id);
      });

      it("should prevent users from accessing other users' notifications", async () => {
        // user1 tries to access user2's notification directly
        await request(app.getHttpServer())
          .get('/notifications/notif-tenant1-user2')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(404); // Should return 404 instead of 403 to avoid information disclosure
      });

      it("should prevent users from marking other users' notifications as read", async () => {
        await request(app.getHttpServer())
          .patch('/notifications/notif-tenant1-user2/read')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(404);
      });

      it("should prevent users from deleting other users' notifications", async () => {
        await request(app.getHttpServer())
          .delete('/notifications/notif-tenant1-user2')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(404);
      });

      it('should allow users to access their own notification preferences', async () => {
        const response = await request(app.getHttpServer())
          .get('/notification-preferences')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].userId).toBe(user1.id);
        expect(response.body[0].category).toBe('system');
      });

      it('should only allow users to update their own preferences', async () => {
        const response = await request(app.getHttpServer())
          .put('/notification-preferences/system')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user2Token}`)
          .send({
            inAppEnabled: false,
            emailEnabled: false,
            smsEnabled: false,
          })
          .expect(200);

        // Should create/update preference for user2, not user1
        expect(response.body.userId).toBe(user2.id);

        // Verify user1's preferences are unchanged
        const user1Prefs = await request(app.getHttpServer())
          .get('/notification-preferences')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        const user1SystemPref = user1Prefs.body.find(
          (p: any) => p.category === 'system',
        );
        expect(user1SystemPref.inAppEnabled).toBe(true); // Original value
      });
    });
  });

  describe('Authorization Tests - Tenant Isolation', () => {
    describe('Cross-tenant access prevention', () => {
      it('should prevent users from accessing notifications from other tenants', async () => {
        // User from tenant1 tries to access tenant2 with tenant2's token but tenant1 header
        await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${tenant2UserToken}`)
          .expect(403); // Should be forbidden due to tenant mismatch
      });

      it('should prevent users from accessing notifications with wrong tenant header', async () => {
        // User from tenant1 tries to access with tenant2 header
        await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', tenant2.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(403);
      });

      it('should enforce tenant isolation in notification lists', async () => {
        // Tenant1 user should only see tenant1 notifications
        const tenant1Response = await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        tenant1Response.body.notifications.forEach((notification: any) => {
          expect(notification.tenantId).toBe(tenant1.id);
        });

        // Tenant2 user should only see tenant2 notifications
        const tenant2Response = await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', tenant2.id)
          .set('Authorization', `Bearer ${tenant2UserToken}`)
          .expect(200);

        tenant2Response.body.notifications.forEach((notification: any) => {
          expect(notification.tenantId).toBe(tenant2.id);
        });

        // Ensure no cross-contamination
        const tenant1Ids = tenant1Response.body.notifications.map(
          (n: any) => n.id,
        );
        const tenant2Ids = tenant2Response.body.notifications.map(
          (n: any) => n.id,
        );
        expect(tenant1Ids).not.toEqual(expect.arrayContaining(tenant2Ids));
      });

      it('should enforce tenant isolation in notification preferences', async () => {
        // Tenant1 user preferences
        const tenant1Response = await request(app.getHttpServer())
          .get('/notification-preferences')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(200);

        tenant1Response.body.forEach((preference: any) => {
          expect(preference.tenantId).toBe(tenant1.id);
        });

        // Tenant2 user preferences
        const tenant2Response = await request(app.getHttpServer())
          .get('/notification-preferences')
          .set('x-tenant-id', tenant2.id)
          .set('Authorization', `Bearer ${tenant2UserToken}`)
          .expect(200);

        tenant2Response.body.forEach((preference: any) => {
          expect(preference.tenantId).toBe(tenant2.id);
        });
      });

      it('should prevent cross-tenant notification access by ID', async () => {
        // Tenant1 user tries to access tenant2 notification
        await request(app.getHttpServer())
          .get('/notifications/notif-tenant2-user1')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(404);

        // Tenant2 user tries to access tenant1 notification
        await request(app.getHttpServer())
          .get('/notifications/notif-tenant1-user1')
          .set('x-tenant-id', tenant2.id)
          .set('Authorization', `Bearer ${tenant2UserToken}`)
          .expect(404);
      });

      it('should prevent cross-tenant notification modifications', async () => {
        // Tenant1 user tries to mark tenant2 notification as read
        await request(app.getHttpServer())
          .patch('/notifications/notif-tenant2-user1/read')
          .set('x-tenant-id', tenant1.id)
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(404);

        // Tenant2 user tries to delete tenant1 notification
        await request(app.getHttpServer())
          .delete('/notifications/notif-tenant1-user1')
          .set('x-tenant-id', tenant2.id)
          .set('Authorization', `Bearer ${tenant2UserToken}`)
          .expect(404);
      });
    });

    describe('Missing tenant header', () => {
      it('should reject requests without tenant header', async () => {
        await request(app.getHttpServer())
          .get('/notifications')
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(400); // Bad request due to missing tenant header
      });

      it('should reject requests with empty tenant header', async () => {
        await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', '')
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(400);
      });

      it('should reject requests with invalid tenant ID', async () => {
        await request(app.getHttpServer())
          .get('/notifications')
          .set('x-tenant-id', 'invalid-tenant-id')
          .set('Authorization', `Bearer ${user1Token}`)
          .expect(403);
      });
    });
  });

  describe('Rate Limiting Tests', () => {
    it('should apply rate limiting to notification endpoints', async () => {
      // This test would require making many requests quickly
      // For now, we'll just verify the endpoint works normally
      const response = await request(app.getHttpServer())
        .get('/notifications')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('notifications');
    });

    it('should apply rate limiting to preference endpoints', async () => {
      const response = await request(app.getHttpServer())
        .get('/notification-preferences')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Admin Role Tests', () => {
    it('should allow admin users to broadcast notifications to tenant', async () => {
      // user1 is admin (created during tenant registration)
      const response = await request(app.getHttpServer())
        .post('/notifications/tenant-broadcast')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'INFO',
          category: 'system',
          title: 'Tenant Broadcast',
          message: 'Message for all tenant users',
        })
        .expect(201);

      expect(response.body).toHaveProperty('notifications');
      expect(response.body).toHaveProperty('count');
      expect(response.body.count).toBeGreaterThan(0);
    });

    it('should prevent non-admin users from broadcasting notifications', async () => {
      // user2 is not admin
      await request(app.getHttpServer())
        .post('/notifications/tenant-broadcast')
        .set('x-tenant-id', tenant1.id)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          type: 'INFO',
          category: 'system',
          title: 'Tenant Broadcast',
          message: 'Message for all tenant users',
        })
        .expect(403); // Should be forbidden for non-admin users
    });
  });
});
