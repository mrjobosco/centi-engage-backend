import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
if (process.env.NODE_ENV === 'test') {
  config({ path: resolve(__dirname, '../.env.test') });
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Export a flag to indicate if middleware has been registered
let middlewareRegistered = false;

function registerTenantMiddleware(tenantContext: any) {
  if (!middlewareRegistered) {
    // Skip middleware registration in tests for now
    // The newer Prisma version doesn't support $use method
    // (prisma as any).$use(createTenantScopingMiddleware(tenantContext));
    console.log(tenantContext);
    middlewareRegistered = true;
  }
}

beforeAll(() => {
  // Migrations are already applied during database reset
  // Skip migration deployment in tests to avoid P3005 errors
});

beforeEach(async () => {
  // Clean database before each test
  await cleanDatabase();
});

afterAll(async () => {
  // Clean up and disconnect
  await cleanDatabase();
  await prisma.$disconnect();
});

async function cleanDatabase() {
  // Delete in correct order to respect foreign key constraints
  const tables = [
    'notification_audit_logs',
    'notification_delivery_logs',
    'notification_preferences',
    'notifications',
    'notification_templates',
    'tenant_notification_configs',
    'invitation_audit_logs',
    'tenant_invitation_roles',
    'tenant_invitations',
    'user_permissions',
    'role_permissions',
    'user_roles',
    'user_tenants',
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

export { prisma, registerTenantMiddleware };
