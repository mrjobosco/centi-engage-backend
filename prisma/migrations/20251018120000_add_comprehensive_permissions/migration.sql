-- Migration: Add comprehensive permissions for invitation system, notifications, and other missing features
-- This migration adds all missing permissions and updates existing roles to include them

-- First, let's add all the missing permissions for each tenant
-- We'll use a function to ensure this works for all existing tenants

DO $$
DECLARE
    tenant_record RECORD;
    permission_id TEXT;
    admin_role_id TEXT;
    member_role_id TEXT;
    pm_role_id TEXT;
BEGIN
    -- Loop through all tenants
    FOR tenant_record IN SELECT id FROM tenants LOOP
        RAISE NOTICE 'Processing tenant: %', tenant_record.id;
        
        -- ========================================
        -- INVITATION PERMISSIONS
        -- ========================================
        
        -- Create invitation permissions
        INSERT INTO permissions (id, action, subject, "tenantId", "createdAt", "updatedAt")
        VALUES 
            (gen_random_uuid()::text, 'create', 'invitation', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'read', 'invitation', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'update', 'invitation', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'delete', 'invitation', tenant_record.id, NOW(), NOW())
        ON CONFLICT (action, subject, "tenantId") DO NOTHING;
        
        -- ========================================
        -- NOTIFICATION PERMISSIONS
        -- ========================================
        
        -- Create notification permissions
        INSERT INTO permissions (id, action, subject, "tenantId", "createdAt", "updatedAt")
        VALUES 
            (gen_random_uuid()::text, 'create', 'notification', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'read', 'notification', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'update', 'notification', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'delete', 'notification', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'broadcast', 'notification', tenant_record.id, NOW(), NOW())
        ON CONFLICT (action, subject, "tenantId") DO NOTHING;
        
        -- Create notification preference permissions
        INSERT INTO permissions (id, action, subject, "tenantId", "createdAt", "updatedAt")
        VALUES 
            (gen_random_uuid()::text, 'read', 'notification-preference', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'update', 'notification-preference', tenant_record.id, NOW(), NOW())
        ON CONFLICT (action, subject, "tenantId") DO NOTHING;
        
        -- Create notification template permissions
        INSERT INTO permissions (id, action, subject, "tenantId", "createdAt", "updatedAt")
        VALUES 
            (gen_random_uuid()::text, 'create', 'notification-template', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'read', 'notification-template', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'update', 'notification-template', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'delete', 'notification-template', tenant_record.id, NOW(), NOW())
        ON CONFLICT (action, subject, "tenantId") DO NOTHING;
        
        -- ========================================
        -- TENANT MANAGEMENT PERMISSIONS
        -- ========================================
        
        -- Create tenant permissions (for tenant settings, configuration, etc.)
        INSERT INTO permissions (id, action, subject, "tenantId", "createdAt", "updatedAt")
        VALUES 
            (gen_random_uuid()::text, 'read', 'tenant', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'update', 'tenant', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'manage', 'tenant', tenant_record.id, NOW(), NOW())
        ON CONFLICT (action, subject, "tenantId") DO NOTHING;
        
        -- ========================================
        -- AUDIT AND MONITORING PERMISSIONS
        -- ========================================
        
        -- Create audit log permissions
        INSERT INTO permissions (id, action, subject, "tenantId", "createdAt", "updatedAt")
        VALUES 
            (gen_random_uuid()::text, 'read', 'audit-log', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'export', 'audit-log', tenant_record.id, NOW(), NOW())
        ON CONFLICT (action, subject, "tenantId") DO NOTHING;
        
        -- Create system monitoring permissions
        INSERT INTO permissions (id, action, subject, "tenantId", "createdAt", "updatedAt")
        VALUES 
            (gen_random_uuid()::text, 'read', 'system-metrics', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'read', 'system-health', tenant_record.id, NOW(), NOW())
        ON CONFLICT (action, subject, "tenantId") DO NOTHING;
        
        -- ========================================
        -- GOOGLE OAUTH PERMISSIONS
        -- ========================================
        
        -- Create Google OAuth management permissions
        INSERT INTO permissions (id, action, subject, "tenantId", "createdAt", "updatedAt")
        VALUES 
            (gen_random_uuid()::text, 'manage', 'google-oauth', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'configure', 'google-oauth', tenant_record.id, NOW(), NOW())
        ON CONFLICT (action, subject, "tenantId") DO NOTHING;
        
        -- ========================================
        -- REPORTING AND ANALYTICS PERMISSIONS
        -- ========================================
        
        -- Create reporting permissions
        INSERT INTO permissions (id, action, subject, "tenantId", "createdAt", "updatedAt")
        VALUES 
            (gen_random_uuid()::text, 'read', 'reports', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'export', 'reports', tenant_record.id, NOW(), NOW()),
            (gen_random_uuid()::text, 'create', 'reports', tenant_record.id, NOW(), NOW())
        ON CONFLICT (action, subject, "tenantId") DO NOTHING;
        
        -- ========================================
        -- UPDATE EXISTING ROLES WITH NEW PERMISSIONS
        -- ========================================
        
        -- Get role IDs for this tenant
        SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' AND "tenantId" = tenant_record.id;
        SELECT id INTO member_role_id FROM roles WHERE name = 'Member' AND "tenantId" = tenant_record.id;
        SELECT id INTO pm_role_id FROM roles WHERE name = 'Project Manager' AND "tenantId" = tenant_record.id;
        
        -- ========================================
        -- ADMIN ROLE PERMISSIONS
        -- ========================================
        IF admin_role_id IS NOT NULL THEN
            RAISE NOTICE 'Updating Admin role permissions for tenant: %', tenant_record.id;
            
            -- Grant ALL permissions to Admin role
            INSERT INTO role_permissions ("roleId", "permissionId")
            SELECT admin_role_id, p.id
            FROM permissions p
            WHERE p."tenantId" = tenant_record.id
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        END IF;
        
        -- ========================================
        -- MEMBER ROLE PERMISSIONS
        -- ========================================
        IF member_role_id IS NOT NULL THEN
            RAISE NOTICE 'Updating Member role permissions for tenant: %', tenant_record.id;
            
            -- Grant read permissions and self-management permissions to Member role
            INSERT INTO role_permissions ("roleId", "permissionId")
            SELECT member_role_id, p.id
            FROM permissions p
            WHERE p."tenantId" = tenant_record.id
            AND (
                -- Read permissions for most resources
                (p.action = 'read' AND p.subject IN ('project', 'user', 'role', 'permission', 'notification', 'notification-preference', 'reports'))
                -- Self-management permissions
                OR (p.action = 'update' AND p.subject = 'notification-preference')
                OR (p.action = 'create' AND p.subject = 'notification')
                OR (p.action = 'update' AND p.subject = 'notification')
                OR (p.action = 'delete' AND p.subject = 'notification')
            )
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        END IF;
        
        -- ========================================
        -- PROJECT MANAGER ROLE PERMISSIONS
        -- ========================================
        IF pm_role_id IS NOT NULL THEN
            RAISE NOTICE 'Updating Project Manager role permissions for tenant: %', tenant_record.id;
            
            -- Grant project management and team coordination permissions
            INSERT INTO role_permissions ("roleId", "permissionId")
            SELECT pm_role_id, p.id
            FROM permissions p
            WHERE p."tenantId" = tenant_record.id
            AND (
                -- Full project management
                (p.subject = 'project')
                -- User read access for team management
                OR (p.action = 'read' AND p.subject = 'user')
                -- Role read access
                OR (p.action = 'read' AND p.subject = 'role')
                -- Permission read access
                OR (p.action = 'read' AND p.subject = 'permission')
                -- Invitation management for team building
                OR (p.subject = 'invitation')
                -- Notification management for team communication
                OR (p.subject = 'notification')
                OR (p.subject = 'notification-preference')
                -- Reporting for project insights
                OR (p.action IN ('read', 'export') AND p.subject = 'reports')
            )
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        END IF;
        
        -- ========================================
        -- CREATE ADDITIONAL SPECIALIZED ROLES
        -- ========================================
        
        -- Create Notification Manager role (if it doesn't exist)
        INSERT INTO roles (id, name, "tenantId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'Notification Manager', tenant_record.id, NOW(), NOW())
        ON CONFLICT (name, "tenantId") DO NOTHING;
        
        -- Get the Notification Manager role ID
        SELECT id INTO permission_id FROM roles WHERE name = 'Notification Manager' AND "tenantId" = tenant_record.id;
        
        IF permission_id IS NOT NULL THEN
            -- Grant notification-related permissions to Notification Manager
            INSERT INTO role_permissions ("roleId", "permissionId")
            SELECT permission_id, p.id
            FROM permissions p
            WHERE p."tenantId" = tenant_record.id
            AND (
                p.subject IN ('notification', 'notification-preference', 'notification-template')
                OR (p.action = 'read' AND p.subject IN ('user', 'reports'))
            )
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        END IF;
        
        -- Create HR Manager role (if it doesn't exist)
        INSERT INTO roles (id, name, "tenantId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'HR Manager', tenant_record.id, NOW(), NOW())
        ON CONFLICT (name, "tenantId") DO NOTHING;
        
        -- Get the HR Manager role ID
        SELECT id INTO permission_id FROM roles WHERE name = 'HR Manager' AND "tenantId" = tenant_record.id;
        
        IF permission_id IS NOT NULL THEN
            -- Grant user and invitation management permissions to HR Manager
            INSERT INTO role_permissions ("roleId", "permissionId")
            SELECT permission_id, p.id
            FROM permissions p
            WHERE p."tenantId" = tenant_record.id
            AND (
                p.subject IN ('user', 'invitation', 'role')
                OR (p.action = 'read' AND p.subject IN ('permission', 'project', 'reports', 'audit-log'))
                OR (p.subject = 'notification' AND p.action IN ('create', 'read'))
            )
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        END IF;
        
        -- Create System Administrator role (if it doesn't exist)
        INSERT INTO roles (id, name, "tenantId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid()::text, 'System Administrator', tenant_record.id, NOW(), NOW())
        ON CONFLICT (name, "tenantId") DO NOTHING;
        
        -- Get the System Administrator role ID
        SELECT id INTO permission_id FROM roles WHERE name = 'System Administrator' AND "tenantId" = tenant_record.id;
        
        IF permission_id IS NOT NULL THEN
            -- Grant system-level permissions to System Administrator
            INSERT INTO role_permissions ("roleId", "permissionId")
            SELECT permission_id, p.id
            FROM permissions p
            WHERE p."tenantId" = tenant_record.id
            AND (
                p.subject IN ('tenant', 'google-oauth', 'system-metrics', 'system-health', 'audit-log')
                OR (p.action = 'read' AND p.subject IN ('user', 'role', 'permission', 'reports'))
                OR (p.subject = 'notification-template')
            )
            ON CONFLICT ("roleId", "permissionId") DO NOTHING;
        END IF;
        
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully!';
END $$;

-- Create indexes for better performance on new permission queries
CREATE INDEX IF NOT EXISTS idx_permissions_action_subject ON permissions(action, subject);
CREATE INDEX IF NOT EXISTS idx_permissions_tenant_subject ON permissions("tenantId", subject);
CREATE INDEX IF NOT EXISTS idx_role_permissions_composite ON role_permissions("roleId", "permissionId");

-- Add some helpful comments
COMMENT ON TABLE permissions IS 'Stores all available permissions in the system with tenant isolation';
COMMENT ON COLUMN permissions.action IS 'The action that can be performed (create, read, update, delete, manage, etc.)';
COMMENT ON COLUMN permissions.subject IS 'The resource or entity the action applies to (user, project, invitation, etc.)';

-- Migration completed successfully