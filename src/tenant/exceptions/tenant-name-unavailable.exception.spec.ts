import { HttpStatus } from '@nestjs/common';
import { TenantNameUnavailableException } from './tenant-name-unavailable.exception';

describe('TenantNameUnavailableException', () => {
  it('should create exception with tenant name', () => {
    const tenantName = 'test-tenant';
    const exception = new TenantNameUnavailableException(tenantName);

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toEqual({
      message: `Tenant name '${tenantName}' is already taken. Please choose a different name.`,
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
    });
  });

  it('should create exception with custom message', () => {
    const tenantName = 'test-tenant';
    const customMessage = 'Custom tenant name unavailable message';
    const exception = new TenantNameUnavailableException(
      tenantName,
      customMessage,
    );

    expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(exception.getResponse()).toEqual({
      message: customMessage,
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
    });
  });
});
