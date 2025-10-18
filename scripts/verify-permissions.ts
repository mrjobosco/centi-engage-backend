import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyPermissions() {
  console.log('🔍 Verifying permission system...\n');

  try {
    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
    });

    console.log(`📊 Found ${tenants.length} tenants`);

    for (const tenant of tenants) {
      console.log(`\n🏢 Tenant: ${tenant.name} (${tenant.id})`);

      // Get permissions for this tenant
      const permissions = await prisma.permission.findMany({
        where: { tenantId: tenant.id },
        select: { action: true, subject: true },
      });

      console.log(`   📋 Permissions: ${permissions.length}`);

      // Group permissions by subject
      const permissionsBySubject = permissions.reduce(
        (acc, perm) => {
          if (!acc[perm.subject]) acc[perm.subject] = [];
          acc[perm.subject].push(perm.action);
          return acc;
        },
        {} as Record<string, string[]>,
      );

      for (const [subject, actions] of Object.entries(permissionsBySubject)) {
        console.log(`      ${subject}: ${actions.join(', ')}`);
      }

      // Get roles for this tenant
      const roles = await prisma.role.findMany({
        where: { tenantId: tenant.id },
        include: {
          _count: {
            select: { permissions: true, users: true },
          },
        },
      });

      console.log(`   👥 Roles: ${roles.length}`);
      for (const role of roles) {
        console.log(
          `      ${role.name}: ${role._count.permissions} permissions, ${role._count.users} users`,
        );
      }

      // Check specific permission combinations
      const invitationPermissions = permissions.filter(
        (p) => p.subject === 'invitation',
      );
      const notificationPermissions = permissions.filter(
        (p) => p.subject === 'notification',
      );

      console.log(
        `   ✉️  Invitation permissions: ${invitationPermissions.length} (${invitationPermissions.map((p) => p.action).join(', ')})`,
      );
      console.log(
        `   🔔 Notification permissions: ${notificationPermissions.length} (${notificationPermissions.map((p) => p.action).join(', ')})`,
      );
    }

    // Check for missing critical permissions
    console.log('\n🔍 Checking for critical permissions...');

    const criticalPermissions = [
      'create:invitation',
      'read:invitation',
      'update:invitation',
      'delete:invitation',
      'create:notification',
      'broadcast:notification',
      'manage:tenant',
      'read:audit-log',
    ];

    for (const tenant of tenants) {
      console.log(`\n   ${tenant.name}:`);
      const existingPerms = await prisma.permission.findMany({
        where: { tenantId: tenant.id },
        select: { action: true, subject: true },
      });

      const existingPermStrings = existingPerms.map(
        (p) => `${p.action}:${p.subject}`,
      );

      for (const criticalPerm of criticalPermissions) {
        const exists = existingPermStrings.includes(criticalPerm);
        console.log(`     ${exists ? '✅' : '❌'} ${criticalPerm}`);
      }
    }

    console.log('\n🎉 Permission verification completed!');
  } catch (error) {
    console.error('❌ Error verifying permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPermissions();
