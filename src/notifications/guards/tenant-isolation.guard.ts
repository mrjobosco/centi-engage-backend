import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

/**
 * Guard to ensure tenant isolation in all notification operations
 * Verifies that the user's tenant matches the tenant context
 */
@Injectable()
export class TenantIsolationGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('Tenant context is required');
    }

    // Verify that the user's tenant matches the current tenant context
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('User tenant does not match tenant context');
    }

    return true;
  }
}
