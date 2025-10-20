import { HttpException, HttpStatus } from '@nestjs/common';

export class TenantNameUnavailableException extends HttpException {
  constructor(tenantName: string, message?: string) {
    const defaultMessage = `Tenant name '${tenantName}' is already taken. Please choose a different name.`;

    super(
      {
        message: message || defaultMessage,
        error: 'Tenant Name Unavailable',
        statusCode: HttpStatus.CONFLICT,
        details: {
          action: 'tenant_name_conflict',
          requestedName: tenantName,
          suggestions: [
            `Try '${tenantName}-org'`,
            `Try '${tenantName}-team'`,
            'Add numbers or modify the name',
          ],
        },
      },
      HttpStatus.CONFLICT,
    );
  }
}
