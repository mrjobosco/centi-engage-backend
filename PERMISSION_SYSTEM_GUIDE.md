# Comprehensive Permission System Guide

This document outlines the comprehensive permission system implemented for the multi-tenant NestJS application, including all permissions for the invitation system, notification system, and other features.

## Overview

The permission system is built on a **Role-Based Access Control (RBAC)** model with the following key components:

- **Permissions**: Granular actions that can be performed on specific resources
- **Roles**: Collections of permissions that define what a user can do
- **Users**: Assigned one or more roles within their tenant
- **Tenant Isolation**: All permissions and roles are scoped to specific tenants

## Permission Structure

Permissions follow the format: `action:subject`

### Available Actions
- `create` - Create new resources
- `read` - View/list resources
- `update` - Modify existing resources
- `delete` - Remove resources
- `manage` - Full administrative control
- `configure` - System configuration
- `broadcast` - Send to multiple recipients
- `export` - Export data/reports

### Available Subjects

#### Core Resources
- `project` - Project management
- `user` - User management
- `role` - Role management
- `permission` - Permission management
- `tenant` - Tenant configuration

#### Invitation System
- `invitation` - Tenant invitation management

#### Notification System
- `notification` - Notification management
- `notification-preference` - User notification preferences
- `notification-template` - Notification templates

#### System & Monitoring
- `audit-log` - Audit trail access
- `system-metrics` - System performance metrics
- `system-health` - System health monitoring
- `google-oauth` - Google OAuth configuration
- `reports` - Reporting and analytics

## Complete Permission List

### Project Management
- `create:project` - Create new projects
- `read:project` - View projects
- `update:project` - Modify projects
- `delete:project` - Delete projects

### User Management
- `create:user` - Create new users
- `read:user` - View user information
- `update:user` - Modify user details
- `delete:user` - Remove users

### Role Management
- `create:role` - Create new roles
- `read:role` - View roles
- `update:role` - Modify roles and their permissions
- `delete:role` - Remove roles

### Permission Management
- `create:permission` - Create new permissions
- `read:permission` - View permissions
- `delete:permission` - Remove permissions

### Invitation System
- `create:invitation` - Send invitations
- `read:invitation` - View invitations and statistics
- `update:invitation` - Resend invitations
- `delete:invitation` - Cancel invitations

### Notification System
- `create:notification` - Send notifications
- `read:notification` - View notifications
- `update:notification` - Modify notifications
- `delete:notification` - Remove notifications
- `broadcast:notification` - Send tenant-wide notifications

### Notification Preferences
- `read:notification-preference` - View notification preferences
- `update:notification-preference` - Modify notification preferences

### Notification Templates
- `create:notification-template` - Create templates
- `read:notification-template` - View templates
- `update:notification-template` - Modify templates
- `delete:notification-template` - Remove templates

### Tenant Management
- `read:tenant` - View tenant information
- `update:tenant` - Modify tenant settings
- `manage:tenant` - Full tenant administration

### Audit & Monitoring
- `read:audit-log` - View audit logs
- `export:audit-log` - Export audit data
- `read:system-metrics` - View system metrics
- `read:system-health` - View system health

### Google OAuth
- `manage:google-oauth` - Manage OAuth settings
- `configure:google-oauth` - Configure OAuth parameters

### Reporting
- `read:reports` - View reports
- `export:reports` - Export report data
- `create:reports` - Generate custom reports

## Predefined Roles

### Admin
**Description**: Full system administrator with all permissions
**Permissions**: ALL (automatically gets all current and future permissions)
**Use Case**: System owners, technical administrators

### Member
**Description**: Basic team member with read access and self-management
**Permissions**:
- Read access: `read:project`, `read:user`, `read:role`, `read:permission`, `read:reports`
- Notification management: `create:notification`, `read:notification`, `update:notification`, `delete:notification`
- Self-service: `read:notification-preference`, `update:notification-preference`

**Use Case**: Regular team members, contributors

### Project Manager
**Description**: Project management and team coordination
**Permissions**:
- Full project management: `create:project`, `read:project`, `update:project`, `delete:project`
- Team coordination: `read:user`, `read:role`, `read:permission`
- Invitation management: `create:invitation`, `read:invitation`, `update:invitation`, `delete:invitation`
- Communication: All notification permissions
- Reporting: `read:reports`, `export:reports`

**Use Case**: Project leads, team managers

### HR Manager
**Description**: Human resources and user management
**Permissions**:
- User management: `create:user`, `read:user`, `update:user`, `delete:user`
- Invitation management: All invitation permissions
- Role management: `read:role`, `create:role`, `update:role`
- Oversight: `read:permission`, `read:project`, `read:reports`, `read:audit-log`
- Communication: `create:notification`, `read:notification`

**Use Case**: HR personnel, people managers

### Notification Manager
**Description**: Notification system management
**Permissions**:
- Full notification control: All notification permissions including `broadcast:notification`
- Template management: All notification-template permissions
- User preferences: `read:notification-preference`, `update:notification-preference`
- User access: `read:user`, `read:reports`

**Use Case**: Communication managers, marketing personnel

### System Administrator
**Description**: System-level configuration and monitoring
**Permissions**:
- Tenant management: `read:tenant`, `update:tenant`, `manage:tenant`
- OAuth configuration: `manage:google-oauth`, `configure:google-oauth`
- System monitoring: `read:system-metrics`, `read:system-health`
- Audit access: `read:audit-log`, `export:audit-log`
- Template management: All notification-template permissions
- Basic access: `read:user`, `read:role`, `read:permission`, `read:reports`

**Use Case**: DevOps, system administrators, security personnel

## Implementation Details

### Database Schema
```sql
-- Permissions table
permissions (
  id: string (primary key)
  action: string (e.g., 'create', 'read', 'update', 'delete')
  subject: string (e.g., 'project', 'user', 'invitation')
  tenantId: string (foreign key to tenants)
  createdAt: timestamp
  updatedAt: timestamp
)

-- Roles table
roles (
  id: string (primary key)
  name: string (e.g., 'Admin', 'Member')
  tenantId: string (foreign key to tenants)
  createdAt: timestamp
  updatedAt: timestamp
)

-- Role-Permission junction table
role_permissions (
  roleId: string (foreign key to roles)
  permissionId: string (foreign key to permissions)
)

-- User-Role junction table
user_roles (
  userId: string (foreign key to users)
  roleId: string (foreign key to roles)
)
```

### Usage in Controllers
```typescript
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('invitations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvitationController {
  
  @Post()
  @Permissions('create:invitation')
  async createInvitation() {
    // Only users with create:invitation permission can access
  }
  
  @Get()
  @Permissions('read:invitation')
  async getInvitations() {
    // Only users with read:invitation permission can access
  }
}
```

## Migration and Setup

### Running the Migration
```bash
# Run the comprehensive permission migration
npx prisma migrate deploy

# Or use the provided script
./scripts/update-permissions.sh
```

### Seeding with New Permissions
```bash
# Use the updated seed file
npx prisma db seed

# Or run the update script which handles everything
./scripts/update-permissions.sh
```

## Testing Permissions

### Verify Permission Assignment
```bash
# Open Prisma Studio to browse the database
npx prisma studio

# Check permissions for a specific role
SELECT p.action, p.subject 
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permissionId
JOIN roles r ON rp.roleId = r.id
WHERE r.name = 'Admin' AND r.tenantId = 'your-tenant-id';
```

### API Testing
```bash
# Test with different user roles
curl -H "Authorization: Bearer <admin-token>" \
     -H "x-tenant-id: <tenant-id>" \
     GET /api/invitations

curl -H "Authorization: Bearer <member-token>" \
     -H "x-tenant-id: <tenant-id>" \
     POST /api/invitations
# Should return 403 Forbidden for members
```

## Best Practices

### 1. Principle of Least Privilege
- Assign users the minimum permissions needed for their role
- Regularly review and audit permission assignments
- Use specialized roles instead of giving everyone admin access

### 2. Role Design
- Create roles based on job functions, not individuals
- Keep roles focused and cohesive
- Avoid creating too many granular roles

### 3. Permission Naming
- Use consistent action:subject format
- Keep subject names descriptive but concise
- Group related permissions logically

### 4. Security Considerations
- Always validate permissions at the API level
- Implement tenant isolation consistently
- Log permission-related actions for audit trails
- Regularly review and update permissions

## Troubleshooting

### Common Issues

#### 1. Permission Denied Errors
```
Error: Missing required permissions: create:invitation
```
**Solution**: Check user's role assignments and ensure the role has the required permission.

#### 2. Migration Failures
```
Error: duplicate key value violates unique constraint
```
**Solution**: The migration handles conflicts gracefully. If issues persist, check for data inconsistencies.

#### 3. Seed File Issues
```
Error: Cannot create permission - already exists
```
**Solution**: The seed file uses `ON CONFLICT DO NOTHING` to handle existing data safely.

### Debugging Commands
```bash
# Check user permissions
SELECT u.email, r.name as role, p.action, p.subject
FROM users u
JOIN user_roles ur ON u.id = ur.userId
JOIN roles r ON ur.roleId = r.id
JOIN role_permissions rp ON r.id = rp.roleId
JOIN permissions p ON rp.permissionId = p.id
WHERE u.email = 'user@example.com';

# Check role permissions
SELECT r.name, COUNT(p.id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.roleId
LEFT JOIN permissions p ON rp.permissionId = p.id
GROUP BY r.id, r.name;
```

## Future Enhancements

### Planned Features
1. **Dynamic Permissions**: Runtime permission creation
2. **Permission Groups**: Logical grouping of related permissions
3. **Conditional Permissions**: Context-aware permission evaluation
4. **Permission Inheritance**: Hierarchical permission structures
5. **API Rate Limiting**: Per-permission rate limiting
6. **Permission Analytics**: Usage tracking and optimization

### Custom Role Creation
```typescript
// Example: Creating a custom "Content Manager" role
const contentManagerPermissions = [
  'create:notification',
  'read:notification',
  'update:notification',
  'create:notification-template',
  'read:notification-template',
  'update:notification-template',
  'read:user',
  'read:reports'
];

// Implementation would be added to role management system
```

## Support and Maintenance

### Regular Tasks
1. **Monthly**: Review permission usage analytics
2. **Quarterly**: Audit role assignments and permissions
3. **Annually**: Review and update permission structure
4. **As needed**: Add permissions for new features

### Monitoring
- Track permission denial rates
- Monitor for unused permissions
- Alert on suspicious permission usage patterns
- Log all permission-related changes

---

For questions or issues with the permission system, please refer to the development team or create an issue in the project repository.