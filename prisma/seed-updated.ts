import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Define all permissions that should exist in the system
const PERMISSION_DEFINITIONS = [
  // Project permissions
  { action: 'create', subject: 'project' },
  { action: 'read', subject: 'project' },
  { action: 'update', subject: 'project' },
  { action: 'delete', subject: 'project' },

  // User permissions
  { action: 'create', subject: 'user' },
  { action: 'read', subject: 'user' },
  { action: 'update', subject: 'user' },
  { action: 'delete', subject: 'user' },

  // Role permissions
  { action: 'create', subject: 'role' },
  { action: 'read', subject: 'role' },
  { action: 'update', subject: 'role' },
  { action: 'delete', subject: 'role' },

  // Permission permissions
  { action: 'create', subject: 'permission' },
  { action: 'read', subject: 'permission' },
  { action: 'delete', subject: 'permission' },

  // Invitation permissions
  { action: 'create', subject: 'invitation' },
  { action: 'read', subject: 'invitation' },
  { action: 'update', subject: 'invitation' },
  { action: 'delete', subject: 'invitation' },

  // Notification permissions
  { action: 'create', subject: 'notification' },
  { action: 'read', subject: 'notification' },
  { action: 'update', subject: 'notification' },
  { action: 'delete', subject: 'notification' },
  { action: 'broadcast', subject: 'notification' },

  // Notification preference permissions
  { action: 'read', subject: 'notification-preference' },
  { action: 'update', subject: 'notification-preference' },

  // Notification template permissions
  { action: 'create', subject: 'notification-template' },
  { action: 'read', subject: 'notification-template' },
  { action: 'update', subject: 'notification-template' },
  { action: 'delete', subject: 'notification-template' },

  // Tenant management permissions
  { action: 'read', subject: 'tenant' },
  { action: 'update', subject: 'tenant' },
  { action: 'manage', subject: 'tenant' },

  // Audit and monitoring permissions
  { action: 'read', subject: 'audit-log' },
  { action: 'export', subject: 'audit-log' },
  { action: 'read', subject: 'system-metrics' },
  { action: 'read', subject: 'system-health' },

  // Google OAuth permissions
  { action: 'manage', subject: 'google-oauth' },
  { action: 'configure', subject: 'google-oauth' },

  // Reporting permissions
  { action: 'read', subject: 'reports' },
  { action: 'export', subject: 'reports' },
  { action: 'create', subject: 'reports' },
];

// Define role configurations
const ROLE_CONFIGURATIONS = {
  Admin: {
    description: 'Full system administrator with all permissions',
    permissions: 'ALL', // Special case - gets all permissions
  },
  Member: {
    description: 'Basic team member with read access and self-management',
    permissions: [
      'read:project',
      'read:user',
      'read:role',
      'read:permission',
      'read:notification',
      'create:notification',
      'update:notification',
      'delete:notification',
      'read:notification-preference',
      'update:notification-preference',
      'read:reports',
    ],
  },
  'Project Manager': {
    description: 'Project management and team coordination',
    permissions: [
      'create:project',
      'read:project',
      'update:project',
      'delete:project',
      'read:user',
      'read:role',
      'read:permission',
      'create:invitation',
      'read:invitation',
      'update:invitation',
      'delete:invitation',
      'create:notification',
      'read:notification',
      'update:notification',
      'delete:notification',
      'read:notification-preference',
      'update:notification-preference',
      'read:reports',
      'export:reports',
    ],
  },
  'HR Manager': {
    description: 'Human resources and user management',
    permissions: [
      'create:user',
      'read:user',
      'update:user',
      'delete:user',
      'create:invitation',
      'read:invitation',
      'update:invitation',
      'delete:invitation',
      'read:role',
      'create:role',
      'update:role',
      'read:permission',
      'read:project',
      'create:notification',
      'read:notification',
      'read:reports',
      'read:audit-log',
    ],
  },
  'Notification Manager': {
    description: 'Notification system management',
    permissions: [
      'create:notification',
      'read:notification',
      'update:notification',
      'delete:notification',
      'broadcast:notification',
      'read:notification-preference',
      'update:notification-preference',
      'create:notification-template',
      'read:notification-template',
      'update:notification-template',
      'delete:notification-template',
      'read:user',
      'read:reports',
    ],
  },
  'System Administrator': {
    description: 'System-level configuration and monitoring',
    permissions: [
      'read:tenant',
      'update:tenant',
      'manage:tenant',
      'manage:google-oauth',
      'configure:google-oauth',
      'read:system-metrics',
      'read:system-health',
      'read:audit-log',
      'export:audit-log',
      'create:notification-template',
      'read:notification-template',
      'update:notification-template',
      'delete:notification-template',
      'read:user',
      'read:role',
      'read:permission',
      'read:reports',
    ],
  },
};

async function createPermissionsForTenant(tenantId: string) {
  const permissions = [];

  for (const permDef of PERMISSION_DEFINITIONS) {
    const permission = await prisma.permission.create({
      data: {
        action: permDef.action,
        subject: permDef.subject,
        tenantId: tenantId,
      },
    });
    permissions.push(permission);
  }

  return permissions;
}

async function createRolesForTenant(tenantId: string, permissions: any[]) {
  const roles = [];

  for (const [roleName, config] of Object.entries(ROLE_CONFIGURATIONS)) {
    // Create the role
    const role = await prisma.role.create({
      data: {
        name: roleName,
        tenantId: tenantId,
      },
    });

    // Assign permissions to the role
    let rolePermissions = [];

    if (config.permissions === 'ALL') {
      // Admin gets all permissions
      rolePermissions = permissions;
    } else {
      // Filter permissions based on the role configuration
      rolePermissions = permissions.filter((p) => {
        const permissionKey = `${p.action}:${p.subject}`;
        return config.permissions.includes(permissionKey);
      });
    }

    // Create role-permission relationships
    await Promise.all(
      rolePermissions.map((permission) =>
        prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        }),
      ),
    );

    console.log(
      `✅ Created role '${roleName}' with ${rolePermissions.length} permissions`,
    );
    roles.push(role);
  }

  return roles;
}

async function main() {
  console.log('🌱 Starting comprehensive database seed...');

  // Clean existing data (in reverse order of dependencies)
  await prisma.project.deleteMany();
  await prisma.userPermission.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  console.log('✅ Cleaned existing data');

  // Create first tenant: Acme Corp
  const acmeTenant = await prisma.tenant.create({
    data: {
      name: 'Acme Corp',
      subdomain: 'acme',
      googleSsoEnabled: true,
      googleAutoProvision: true,
    },
  });

  console.log(`✅ Created tenant: ${acmeTenant.name}`);

  // Create comprehensive permissions for Acme Corp
  const acmePermissions = await createPermissionsForTenant(acmeTenant.id);
  console.log(`✅ Created ${acmePermissions.length} permissions for Acme Corp`);

  // Create roles with proper permission assignments
  const acmeRoles = await createRolesForTenant(acmeTenant.id, acmePermissions);

  // Get specific roles for user assignment
  const adminRole = acmeRoles.find((r) => r.name === 'Admin');
  const memberRole = acmeRoles.find((r) => r.name === 'Member');
  const pmRole = acmeRoles.find((r) => r.name === 'Project Manager');
  const hrRole = acmeRoles.find((r) => r.name === 'HR Manager');
  const notificationRole = acmeRoles.find(
    (r) => r.name === 'Notification Manager',
  );
  const sysAdminRole = acmeRoles.find((r) => r.name === 'System Administrator');

  // Hash password for all users
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create Admin user
  const acmeAdmin = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      password: hashedPassword,
      firstName: 'Alice',
      lastName: 'Admin',
      tenantId: acmeTenant.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: acmeAdmin.id,
      roleId: adminRole!.id,
    },
  });

  console.log(`✅ Created admin user: ${acmeAdmin.email}`);

  // Create Project Manager user
  const acmeProjectManager = await prisma.user.create({
    data: {
      email: 'pm@acme.com',
      password: hashedPassword,
      firstName: 'Bob',
      lastName: 'Manager',
      tenantId: acmeTenant.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: acmeProjectManager.id,
      roleId: pmRole!.id,
    },
  });

  console.log(`✅ Created project manager user: ${acmeProjectManager.email}`);

  // Create HR Manager user
  const acmeHRManager = await prisma.user.create({
    data: {
      email: 'hr@acme.com',
      password: hashedPassword,
      firstName: 'Carol',
      lastName: 'HR',
      tenantId: acmeTenant.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: acmeHRManager.id,
      roleId: hrRole!.id,
    },
  });

  console.log(`✅ Created HR manager user: ${acmeHRManager.email}`);

  // Create Notification Manager user
  const acmeNotificationManager = await prisma.user.create({
    data: {
      email: 'notifications@acme.com',
      password: hashedPassword,
      firstName: 'Diana',
      lastName: 'Notifications',
      tenantId: acmeTenant.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: acmeNotificationManager.id,
      roleId: notificationRole!.id,
    },
  });

  console.log(
    `✅ Created notification manager user: ${acmeNotificationManager.email}`,
  );

  // Create System Administrator user
  const acmeSysAdmin = await prisma.user.create({
    data: {
      email: 'sysadmin@acme.com',
      password: hashedPassword,
      firstName: 'Eve',
      lastName: 'SysAdmin',
      tenantId: acmeTenant.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: acmeSysAdmin.id,
      roleId: sysAdminRole!.id,
    },
  });

  console.log(`✅ Created system admin user: ${acmeSysAdmin.email}`);

  // Create Member user
  const acmeMember = await prisma.user.create({
    data: {
      email: 'member@acme.com',
      password: hashedPassword,
      firstName: 'Frank',
      lastName: 'Member',
      tenantId: acmeTenant.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: acmeMember.id,
      roleId: memberRole!.id,
    },
  });

  console.log(`✅ Created member user: ${acmeMember.email}`);

  // Create user with multiple roles
  const acmeMultiRole = await prisma.user.create({
    data: {
      email: 'multi@acme.com',
      password: hashedPassword,
      firstName: 'Grace',
      lastName: 'Multi',
      tenantId: acmeTenant.id,
    },
  });

  await Promise.all([
    prisma.userRole.create({
      data: {
        userId: acmeMultiRole.id,
        roleId: memberRole!.id,
      },
    }),
    prisma.userRole.create({
      data: {
        userId: acmeMultiRole.id,
        roleId: pmRole!.id,
      },
    }),
  ]);

  console.log(`✅ Created user with multiple roles: ${acmeMultiRole.email}`);

  // Create sample projects
  const acmeProjects = await Promise.all([
    prisma.project.create({
      data: {
        name: 'Website Redesign',
        description: 'Complete overhaul of the company website',
        tenantId: acmeTenant.id,
        ownerId: acmeAdmin.id,
      },
    }),
    prisma.project.create({
      data: {
        name: 'Mobile App Development',
        description: 'Native mobile application for iOS and Android',
        tenantId: acmeTenant.id,
        ownerId: acmeProjectManager.id,
      },
    }),
    prisma.project.create({
      data: {
        name: 'API Integration',
        description: 'Third-party API integration project',
        tenantId: acmeTenant.id,
        ownerId: acmeProjectManager.id,
      },
    }),
    prisma.project.create({
      data: {
        name: 'Database Migration',
        description: 'Migration to new database infrastructure',
        tenantId: acmeTenant.id,
        ownerId: acmeAdmin.id,
      },
    }),
  ]);

  console.log(`✅ Created ${acmeProjects.length} projects for Acme Corp`);

  // Create second tenant: TechStart Inc
  const techStartTenant = await prisma.tenant.create({
    data: {
      name: 'TechStart Inc',
      subdomain: 'techstart',
      googleSsoEnabled: false,
      googleAutoProvision: false,
    },
  });

  console.log(`✅ Created tenant: ${techStartTenant.name}`);

  // Create permissions for TechStart (subset for smaller company)
  const techStartPermissionDefs = PERMISSION_DEFINITIONS.filter((p) =>
    [
      'project',
      'user',
      'role',
      'permission',
      'notification',
      'notification-preference',
      'reports',
    ].includes(p.subject),
  );

  const techStartPermissions = [];
  for (const permDef of techStartPermissionDefs) {
    const permission = await prisma.permission.create({
      data: {
        action: permDef.action,
        subject: permDef.subject,
        tenantId: techStartTenant.id,
      },
    });
    techStartPermissions.push(permission);
  }

  console.log(
    `✅ Created ${techStartPermissions.length} permissions for TechStart`,
  );

  // Create basic roles for TechStart
  const techStartAdminRole = await prisma.role.create({
    data: {
      name: 'Admin',
      tenantId: techStartTenant.id,
    },
  });

  const techStartMemberRole = await prisma.role.create({
    data: {
      name: 'Member',
      tenantId: techStartTenant.id,
    },
  });

  // Assign all permissions to TechStart Admin
  await Promise.all(
    techStartPermissions.map((permission) =>
      prisma.rolePermission.create({
        data: {
          roleId: techStartAdminRole.id,
          permissionId: permission.id,
        },
      }),
    ),
  );

  // Assign read permissions to TechStart Member
  const readPermissions = techStartPermissions.filter(
    (p) => p.action === 'read',
  );
  await Promise.all(
    readPermissions.map((permission) =>
      prisma.rolePermission.create({
        data: {
          roleId: techStartMemberRole.id,
          permissionId: permission.id,
        },
      }),
    ),
  );

  console.log(`✅ Created roles for TechStart`);

  // Create admin user for TechStart
  const techStartAdmin = await prisma.user.create({
    data: {
      email: 'admin@techstart.com',
      password: hashedPassword,
      firstName: 'Henry',
      lastName: 'Founder',
      tenantId: techStartTenant.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: techStartAdmin.id,
      roleId: techStartAdminRole.id,
    },
  });

  console.log(`✅ Created admin user for TechStart: ${techStartAdmin.email}`);

  // Create projects for TechStart
  const techStartProjects = await Promise.all([
    prisma.project.create({
      data: {
        name: 'MVP Development',
        description: 'Minimum viable product development',
        tenantId: techStartTenant.id,
        ownerId: techStartAdmin.id,
      },
    }),
    prisma.project.create({
      data: {
        name: 'Market Research',
        description: 'Comprehensive market analysis',
        tenantId: techStartTenant.id,
        ownerId: techStartAdmin.id,
      },
    }),
  ]);

  console.log(`✅ Created ${techStartProjects.length} projects for TechStart`);

  // Create notification templates
  console.log('\n📧 Creating notification templates...');

  const otpVerificationTemplate = await prisma.notificationTemplate.create({
    data: {
      tenantId: null, // Global template
      category: 'email_verification',
      channel: 'EMAIL',
      subject: 'Verify your email address',
      templateBody: 'otp-verification', // React-email template type
      variables: {
        firstName: {
          type: 'string',
          required: true,
          description: 'User first name for personalization',
        },
        otp: {
          type: 'string',
          required: true,
          description: 'The 6-digit OTP code',
        },
        expirationTime: {
          type: 'string',
          required: true,
          description: 'Human-readable expiration time (e.g., "30 minutes")',
        },
        companyName: {
          type: 'string',
          required: false,
          description: 'Company name for branding',
          default: 'Your Company',
        },
        supportEmail: {
          type: 'string',
          required: false,
          description: 'Support email for help',
          default: 'support@company.com',
        },
      },
      isActive: true,
    },
  });

  const invitationTemplate = await prisma.notificationTemplate.create({
    data: {
      tenantId: null, // Global template
      category: 'tenant_invitation',
      channel: 'EMAIL',
      subject: "You've been invited to join {{tenantName}}",
      templateBody: 'tenant-invitation', // React-email template type
      variables: {
        inviteeEmail: {
          type: 'string',
          required: true,
          description: 'Email of the person being invited',
        },
        inviterName: {
          type: 'string',
          required: true,
          description: 'Name of the person sending the invitation',
        },
        tenantName: {
          type: 'string',
          required: true,
          description: 'Name of the tenant/organization',
        },
        roles: {
          type: 'array',
          required: true,
          description: 'Array of role names being assigned',
        },
        invitationUrl: {
          type: 'string',
          required: true,
          description: 'URL to accept the invitation',
        },
        expiresAt: {
          type: 'date',
          required: true,
          description: 'Invitation expiration date',
        },
        customMessage: {
          type: 'string',
          required: false,
          description: 'Optional custom message from inviter',
        },
        companyName: {
          type: 'string',
          required: false,
          description: 'Company name for branding',
          default: 'Your Company',
        },
        supportEmail: {
          type: 'string',
          required: false,
          description: 'Support email for help',
          default: 'support@company.com',
        },
      },
      isActive: true,
    },
  });

  console.log(`✅ Created notification templates:`);
  console.log(`   - OTP Verification: ${otpVerificationTemplate.id}`);
  console.log(`   - Tenant Invitation: ${invitationTemplate.id}`);

  console.log('\n🎉 Comprehensive database seeding completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   - Tenants: 2`);
  console.log(`   - Users: 8`);
  console.log(`   - Roles: 8 (6 for Acme Corp, 2 for TechStart)`);
  console.log(
    `   - Permissions: ${acmePermissions.length + techStartPermissions.length}`,
  );
  console.log(`   - Projects: 6`);
  console.log(`   - Notification Templates: 2`);
  console.log('\n🔑 Login credentials (password for all users: password123):');
  console.log('   Acme Corp (x-tenant-id: ' + acmeTenant.id + '):');
  console.log('     - admin@acme.com (Admin role - full access)');
  console.log('     - pm@acme.com (Project Manager role)');
  console.log('     - hr@acme.com (HR Manager role)');
  console.log('     - notifications@acme.com (Notification Manager role)');
  console.log('     - sysadmin@acme.com (System Administrator role)');
  console.log('     - member@acme.com (Member role)');
  console.log('     - multi@acme.com (Member + Project Manager roles)');
  console.log('\n   TechStart Inc (x-tenant-id: ' + techStartTenant.id + '):');
  console.log('     - admin@techstart.com (Admin role)');

  console.log('\n📝 Available Permissions by Category:');
  console.log('   - Project Management: create, read, update, delete project');
  console.log('   - User Management: create, read, update, delete user');
  console.log('   - Role Management: create, read, update, delete role');
  console.log('   - Permission Management: create, read, delete permission');
  console.log(
    '   - Invitation System: create, read, update, delete invitation',
  );
  console.log(
    '   - Notification System: create, read, update, delete, broadcast notification',
  );
  console.log(
    '   - Notification Preferences: read, update notification-preference',
  );
  console.log(
    '   - Notification Templates: create, read, update, delete notification-template',
  );
  console.log('   - Tenant Management: read, update, manage tenant');
  console.log(
    '   - Audit & Monitoring: read, export audit-log; read system-metrics, system-health',
  );
  console.log('   - Google OAuth: manage, configure google-oauth');
  console.log('   - Reporting: read, export, create reports');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
