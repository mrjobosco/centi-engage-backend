import { HttpStatus } from '@nestjs/common';
import { UserAlreadyHasTenantException } from './user-already-has-tenant.exception';

describe('UserAlreadyHasTenantException', () => {
  it('should create exception with default message', () => {
    const exception = new UserAlreadyHasTenantException();

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toEqual({
      message:
        'User already belongs to a tenant. Cannot perform this operation.',
      error: 'User Already Has Tenant',
      statusCode: HttpStatus.BAD_REQUEST,
      details: {
        action: 'user_already_has_tenant',
        suggestions: [
          'Use tenant-specific operations instead',
          'Switch to a different user account',
        ],
      },
    });
  });

  it('should create exception with tenant name', () => {
    const tenantName = 'test-tenant';
    const exception = new UserAlreadyHasTenantException(tenantName);

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toEqual({
      message: `User already belongs to tenant '${tenantName}'. Cannot perform this operation.`,
      error: 'User Already Has Tenant',
      statusCode: HttpStatus.BAD_REQUEST,
      details: {
        action: 'user_already_has_tenant',
        currentTenant: tenantName,
        suggestions: [
          'Use tenant-specific operations instead',
          'Switch to a different user account',
        ],
      },
    });
  });

  it('should create exception with custom message', () => {
    const tenantName = 'test-tenant';
    const customMessage = 'Custom user already has tenant message';
    const exception = new UserAlreadyHasTenantException(
      tenantName,
      customMessage,
    );

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toEqual({
      message: customMessage,
      error: 'User Already Has Tenant',
      statusCode: HttpStatus.BAD_REQUEST,
      details: {
        action: 'user_already_has_tenant',
        currentTenant: tenantName,
        suggestions: [
          'Use tenant-specific operations instead',
          'Switch to a different user account',
        ],
      },
    });
  });
});
