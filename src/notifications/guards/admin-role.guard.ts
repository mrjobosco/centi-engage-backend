import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

/**
 * Guard to verify that a user has admin role for tenant-wide operations
 * Currently checks if user has admin permissions within their tenant
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    try {
      // Check if user has admin role in the current tenant
      const userWithRoles = await this.prisma.user.findFirst({
        where: {
          id: user.id,
          tenantId,
        },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!userWithRoles) {
        throw new ForbiddenException('User not found in tenant');
      }

      // Check if user has admin role or notification management permissions
      const hasAdminAccess = userWithRoles.roles.some((userRole) => {
        const role = userRole.role;

        // Check if role name contains 'admin' (case insensitive)
        if (role.name.toLowerCase().includes('admin')) {
          return true;
        }

        // Check if user has notification management permissions
        return role.permissions.some((rolePermission) => {
          const permission = rolePermission.permission;
          const permissionName = `${permission.action}:${permission.subject}`;
          return (
            permissionName === 'manage:notification' ||
            permissionName === 'broadcast:notification' ||
            permissionName === 'manage:tenant'
          );
        });
      });

      if (!hasAdminAccess) {
        throw new ForbiddenException(
          'Admin role or notification management permissions required',
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Access denied');
    }
  }
}
