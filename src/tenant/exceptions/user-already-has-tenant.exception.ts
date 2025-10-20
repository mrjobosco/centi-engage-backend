import { HttpException, HttpStatus } from '@nestjs/common';

export class UserAlreadyHasTenantException extends HttpException {
  constructor(tenantName?: string, message?: string) {
    const defaultMessage = tenantName
      ? `User already belongs to tenant '${tenantName}'. Cannot perform this operation.`
      : 'User already belongs to a tenant. Cannot perform this operation.';

    super(
      {
        message: message || defaultMessage,
        error: 'User Already Has Tenant',
        statusCode: HttpStatus.BAD_REQUEST,
        details: {
          action: 'user_already_has_tenant',
          ...(tenantName && { currentTenant: tenantName }),
          suggestions: [
            'Use tenant-specific operations instead',
            'Switch to a different user account',
          ],
        },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
