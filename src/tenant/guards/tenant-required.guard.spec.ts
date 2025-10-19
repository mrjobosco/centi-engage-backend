import {
  ExecutionContext,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantRequiredGuard } from './tenant-required.guard';

describe('TenantRequiredGuard', () => {
  let guard: TenantRequiredGuard;
  let mockExecutionContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(() => {
    guard = new TenantRequiredGuard();

    mockRequest = {
      user: null,
      tenantContext: {
        tenantId: null,
        isTenantRequired: false,
      },
    };

    mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;
  });

  describe('canActivate', () => {
    it('should throw UnauthorizedException when user is not authenticated', () => {
      mockRequest.user = null;

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        'Authentication required',
      );
    });

    it('should throw BadRequestException when user has no tenant', () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'test@example.com',
        tenantId: null,
      };

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        BadRequestException,
      );
      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        'Tenant membership required. Please create or join a tenant to access this resource.',
      );
    });

    it('should return true when user has tenant membership', () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
      };

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.tenantContext.isTenantRequired).toBe(true);
    });

    it('should mark tenant context as required when user has tenant', () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
      };

      guard.canActivate(mockExecutionContext);

      expect(mockRequest.tenantContext.isTenantRequired).toBe(true);
    });

    it('should handle missing tenant context gracefully', () => {
      mockRequest.user = {
        id: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-1',
      };
      mockRequest.tenantContext = null;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });
  });
});
