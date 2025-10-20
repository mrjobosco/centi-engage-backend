import { HttpStatus } from '@nestjs/common';
import { TenantRequiredException } from './tenant-required.exception';

describe('TenantRequiredException', () => {
  it('should create exception with default message', () => {
    const exception = new TenantRequiredException();

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toEqual({
      message: 'Tenant membership required. Please create or join a tenant.',
      error: 'Tenant Required',
      statusCode: HttpStatus.BAD_REQUEST,
      details: {
        action: 'tenant_required',
        suggestions: ['Create a new tenant', 'Accept an existing invitation'],
      },
    });
  });

  it('should create exception with custom message', () => {
    const customMessage = 'Custom tenant required message';
    const exception = new TenantRequiredException(customMessage);

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getResponse()).toEqual({
      message: customMessage,
      error: 'Tenant Required',
      statusCode: HttpStatus.BAD_REQUEST,
      details: {
        action: 'tenant_required',
        suggestions: ['Create a new tenant', 'Accept an existing invitation'],
      },
    });
  });
});
