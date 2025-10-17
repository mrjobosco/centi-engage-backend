import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

/**
 * Guard to verify that a user owns a notification before allowing access
 * Ensures users can only access their own notifications within their tenant
 */
@Injectable()
export class NotificationOwnershipGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    const notificationId = request.params?.id;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!notificationId) {
      // If there's no notification ID in params, allow access
      // This is for endpoints that don't operate on specific notifications
      return true;
    }

    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    try {
      // Check if the notification exists and belongs to the user and tenant
      const notification = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          userId: user.id,
          tenantId,
        },
        select: {
          id: true,
        },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found or access denied');
      }

      return true;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new ForbiddenException('Access denied');
    }
  }
}
