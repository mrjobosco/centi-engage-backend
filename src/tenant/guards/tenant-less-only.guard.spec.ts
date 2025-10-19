import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { TenantLessOnlyGuard } from './tenant-less-only.guard';

describe('TenantLessOnlyGuard', () => {
  let guard: TenantLessOnlyGuard;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  beforeEach(() => {
    guard = new TenantLessOnlyGuard();

    mockRequest = {
      user: null,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when no user is attached to request', () => {
      mockRequest.user = null;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should return true when user has null tenantId (tenant-less user)', () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'user@example.com',
        tenantId: null,
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        roles: [],
      };

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should throw BadRequestException when user has a tenantId', () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'user@example.com',
        tenantId: 'tenant-1',
        firstName: 'John',
        lastName: 'Doe',
        emailVerified: true,
        roles: [],
      };

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        BadRequestException,
      );
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        'This endpoint is only available for users without tenant membership. You already belong to a tenant and cannot perform this action.',
      );
    });

    it('should throw BadRequestException with correct message for users with tenant', () => {
      mockRequest.user = {
        id: 'user-2',
        tenantId: 'some-tenant-id',
      };

      try {
        guard.canActivate(mockExecutionContext);
        fail('Expected BadRequestException to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe(
          'This endpoint is only available for users without tenant membership. You already belong to a tenant and cannot perform this action.',
        );
      }
    });

    it('should handle undefined user gracefully', () => {
      mockRequest.user = undefined;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should handle user with tenantId as empty string', () => {
      mockRequest.user = {
        id: 'user-1',
        tenantId: '',
      };

      // Empty string is not null, so should throw exception
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        BadRequestException,
      );
    });

    it('should handle user with tenantId as 0', () => {
      mockRequest.user = {
        id: 'user-1',
        tenantId: 0,
      };

      // 0 is not null, so should throw exception
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        BadRequestException,
      );
    });
  });
});
