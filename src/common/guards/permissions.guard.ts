import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RequestWithUser } from '../../auth/interfaces/request-with-user.interface';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get effective permissions (role-based + user-specific)
    const effectivePermissions = await this.getEffectivePermissions(user.id);

    // Check if all required permissions are present
    const hasAllPermissions = requiredPermissions.every((required) =>
      effectivePermissions.includes(required),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Missing required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }

  private async getEffectivePermissions(userId: string): Promise<string[]> {
    // Get role-based permissions
    const rolePermissions = await this.prisma.permission.findMany({
      where: {
        roles: {
          some: {
            role: {
              users: {
                some: {
                  userId: userId,
                },
              },
            },
          },
        },
      },
      select: {
        action: true,
        subject: true,
      },
    });

    // Get user-specific permissions
    const userPermissions = await this.prisma.permission.findMany({
      where: {
        users: {
          some: {
            userId: userId,
          },
        },
      },
      select: {
        action: true,
        subject: true,
      },
    });

    // Combine and format permissions as "action:subject"
    const allPermissions = [...rolePermissions, ...userPermissions];
    const permissionStrings = allPermissions.map(
      (p) => `${p.action}:${p.subject}`,
    );

    // Remove duplicates using Set
    return [...new Set(permissionStrings)];
  }
}
