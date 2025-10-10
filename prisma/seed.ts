import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

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
    },
  });

  console.log(`✅ Created tenant: ${acmeTenant.name}`);

  // Create permissions for Acme Corp
  const acmePermissions = await Promise.all([
    // Project permissions
    prisma.permission.create({
      data: {
        action: 'create',
        subject: 'project',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'read',
        subject: 'project',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'update',
        subject: 'project',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'delete',
        subject: 'project',
        tenantId: acmeTenant.id,
      },
    }),
    // User permissions
    prisma.permission.create({
      data: {
        action: 'create',
        subject: 'user',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'read',
        subject: 'user',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'update',
        subject: 'user',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'delete',
        subject: 'user',
        tenantId: acmeTenant.id,
      },
    }),
    // Role permissions
    prisma.permission.create({
      data: {
        action: 'create',
        subject: 'role',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'read',
        subject: 'role',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'update',
        subject: 'role',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'delete',
        subject: 'role',
        tenantId: acmeTenant.id,
      },
    }),
    // Permission permissions
    prisma.permission.create({
      data: {
        action: 'create',
        subject: 'permission',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'read',
        subject: 'permission',
        tenantId: acmeTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'delete',
        subject: 'permission',
        tenantId: acmeTenant.id,
      },
    }),
  ]);

  console.log(`✅ Created ${acmePermissions.length} permissions for Acme Corp`);

  // Create Admin role with all permissions
  const acmeAdminRole = await prisma.role.create({
    data: {
      name: 'Admin',
      tenantId: acmeTenant.id,
    },
  });

  // Assign all permissions to Admin role
  await Promise.all(
    acmePermissions.map((permission) =>
      prisma.rolePermission.create({
        data: {
          roleId: acmeAdminRole.id,
          permissionId: permission.id,
        },
      }),
    ),
  );

  console.log(`✅ Created Admin role with all permissions`);

  // Create Member role with read-only permissions
  const acmeMemberRole = await prisma.role.create({
    data: {
      name: 'Member',
      tenantId: acmeTenant.id,
    },
  });

  const readPermissions = acmePermissions.filter((p) => p.action === 'read');
  await Promise.all(
    readPermissions.map((permission) =>
      prisma.rolePermission.create({
        data: {
          roleId: acmeMemberRole.id,
          permissionId: permission.id,
        },
      }),
    ),
  );

  console.log(`✅ Created Member role with read permissions`);

  // Create Project Manager role with project management permissions
  const acmeProjectManagerRole = await prisma.role.create({
    data: {
      name: 'Project Manager',
      tenantId: acmeTenant.id,
    },
  });

  const projectManagerPermissions = acmePermissions.filter(
    (p) =>
      p.subject === 'project' || (p.subject === 'user' && p.action === 'read'),
  );
  await Promise.all(
    projectManagerPermissions.map((permission) =>
      prisma.rolePermission.create({
        data: {
          roleId: acmeProjectManagerRole.id,
          permissionId: permission.id,
        },
      }),
    ),
  );

  console.log(`✅ Created Project Manager role`);

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
      roleId: acmeAdminRole.id,
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
      roleId: acmeProjectManagerRole.id,
    },
  });

  console.log(`✅ Created project manager user: ${acmeProjectManager.email}`);

  // Create Member user
  const acmeMember = await prisma.user.create({
    data: {
      email: 'member@acme.com',
      password: hashedPassword,
      firstName: 'Charlie',
      lastName: 'Member',
      tenantId: acmeTenant.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: acmeMember.id,
      roleId: acmeMemberRole.id,
    },
  });

  console.log(`✅ Created member user: ${acmeMember.email}`);

  // Create user with multiple roles
  const acmeMultiRole = await prisma.user.create({
    data: {
      email: 'multi@acme.com',
      password: hashedPassword,
      firstName: 'Diana',
      lastName: 'Multi',
      tenantId: acmeTenant.id,
    },
  });

  await Promise.all([
    prisma.userRole.create({
      data: {
        userId: acmeMultiRole.id,
        roleId: acmeMemberRole.id,
      },
    }),
    prisma.userRole.create({
      data: {
        userId: acmeMultiRole.id,
        roleId: acmeProjectManagerRole.id,
      },
    }),
  ]);

  console.log(`✅ Created user with multiple roles: ${acmeMultiRole.email}`);

  // Create user with user-specific permission override
  const acmeCustomUser = await prisma.user.create({
    data: {
      email: 'custom@acme.com',
      password: hashedPassword,
      firstName: 'Eve',
      lastName: 'Custom',
      tenantId: acmeTenant.id,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: acmeCustomUser.id,
      roleId: acmeMemberRole.id,
    },
  });

  // Grant user-specific permission to delete projects
  const deleteProjectPermission = acmePermissions.find(
    (p) => p.action === 'delete' && p.subject === 'project',
  );
  if (deleteProjectPermission) {
    await prisma.userPermission.create({
      data: {
        userId: acmeCustomUser.id,
        permissionId: deleteProjectPermission.id,
      },
    });
  }

  console.log(
    `✅ Created user with custom permission: ${acmeCustomUser.email}`,
  );

  // Create sample projects
  const acmeProjects = await Promise.all([
    prisma.project.create({
      data: {
        name: 'Website Redesign',
        tenantId: acmeTenant.id,
        ownerId: acmeAdmin.id,
      },
    }),
    prisma.project.create({
      data: {
        name: 'Mobile App Development',
        tenantId: acmeTenant.id,
        ownerId: acmeProjectManager.id,
      },
    }),
    prisma.project.create({
      data: {
        name: 'API Integration',
        tenantId: acmeTenant.id,
        ownerId: acmeProjectManager.id,
      },
    }),
    prisma.project.create({
      data: {
        name: 'Database Migration',
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
    },
  });

  console.log(`✅ Created tenant: ${techStartTenant.name}`);

  // Create permissions for TechStart
  const techStartPermissions = await Promise.all([
    prisma.permission.create({
      data: {
        action: 'create',
        subject: 'project',
        tenantId: techStartTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'read',
        subject: 'project',
        tenantId: techStartTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'update',
        subject: 'project',
        tenantId: techStartTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'delete',
        subject: 'project',
        tenantId: techStartTenant.id,
      },
    }),
    prisma.permission.create({
      data: {
        action: 'read',
        subject: 'user',
        tenantId: techStartTenant.id,
      },
    }),
  ]);

  console.log(
    `✅ Created ${techStartPermissions.length} permissions for TechStart`,
  );

  // Create Admin role for TechStart
  const techStartAdminRole = await prisma.role.create({
    data: {
      name: 'Admin',
      tenantId: techStartTenant.id,
    },
  });

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

  console.log(`✅ Created Admin role for TechStart`);

  // Create admin user for TechStart
  const techStartAdmin = await prisma.user.create({
    data: {
      email: 'admin@techstart.com',
      password: hashedPassword,
      firstName: 'Frank',
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
        tenantId: techStartTenant.id,
        ownerId: techStartAdmin.id,
      },
    }),
    prisma.project.create({
      data: {
        name: 'Market Research',
        tenantId: techStartTenant.id,
        ownerId: techStartAdmin.id,
      },
    }),
  ]);

  console.log(`✅ Created ${techStartProjects.length} projects for TechStart`);

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   - Tenants: 2`);
  console.log(`   - Users: 6`);
  console.log(`   - Roles: 4`);
  console.log(`   - Permissions: 20`);
  console.log(`   - Projects: 6`);
  console.log('\n🔑 Login credentials (password for all users: password123):');
  console.log('   Acme Corp (x-tenant-id: ' + acmeTenant.id + '):');
  console.log('     - admin@acme.com (Admin role)');
  console.log('     - pm@acme.com (Project Manager role)');
  console.log('     - member@acme.com (Member role)');
  console.log('     - multi@acme.com (Member + Project Manager roles)');
  console.log(
    '     - custom@acme.com (Member role + custom delete:project permission)',
  );
  console.log('\n   TechStart Inc (x-tenant-id: ' + techStartTenant.id + '):');
  console.log('     - admin@techstart.com (Admin role)');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
