import { HttpException, HttpStatus } from '@nestjs/common';

export class TenantRequiredException extends HttpException {
  constructor(message?: string) {
    const defaultMessage =
      'Tenant membership required. Please create or join a tenant.';
    super(
      {
        message: message || defaultMessage,
        error: 'Tenant Required',
        statusCode: HttpStatus.BAD_REQUEST,
        details: {
          action: 'tenant_required',
          suggestions: ['Create a new tenant', 'Accept an existing invitation'],
        },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
