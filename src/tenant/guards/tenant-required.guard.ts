import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantRequiredException } from '../exceptions';

/**
 * Guard that ensures only users with tenant membership can access the endpoint
 * Used for endpoints that require tenant context and tenant-specific operations
 */
@Injectable()
export class TenantRequiredGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!user.tenantId) {
      throw new TenantRequiredException();
    }

    // Mark tenant context as required for this request
    if (request.tenantContext) {
      request.tenantContext.isTenantRequired = true;
    }

    return true;
  }
}
