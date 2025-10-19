import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

/**
 * Guard that ensures only tenant-less users can access the endpoint
 * Used for tenant management endpoints that are specifically for users without tenants
 */
@Injectable()
export class TenantLessOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      // Let JWT guard handle authentication
      return true;
    }

    if (user.tenantId !== null) {
      throw new BadRequestException(
        'This endpoint is only available for users without tenant membership. You already belong to a tenant and cannot perform this action.',
      );
    }

    return true;
  }
}
