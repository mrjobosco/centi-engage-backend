import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantIsolationGuard } from './tenant-isolation.guard';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

describe('TenantIsolationGuard', () => {
  let guard: TenantIsolationGuard;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const mockTenantContextService = {
      getTenantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantIsolationGuard,
        { provide: TenantContextService, useValue: mockTenantContextService },
      ],
    }).compile();

    guard = module.get<TenantIsolationGuard>(TenantIsolationGuard);
    tenantContextService = module.get(TenantContextService);
  });

  const createMockContext = (user: RequestUser | null): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    const mockUser: RequestUser = {
      id: 'user-123',
      tenantId: 'tenant-123',
      email: 'test@example.com',
      firstName: null,
      lastName: null,
      roles: [],
    };

    it('should throw ForbiddenException when user is not authenticated', async () => {
      const context = createMockContext(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('User not authenticated'),
      );
    });

    it('should throw ForbiddenException when tenant context is missing', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Tenant context is required'),
      );
    });

    it('should allow access when user tenant matches tenant context', () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('tenant-123');

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when user tenant does not match tenant context', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('different-tenant');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('User tenant does not match tenant context'),
      );
    });

    it('should handle empty tenant context', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Tenant context is required'),
      );
    });

    it('should handle user with different tenant ID', async () => {
      const userWithDifferentTenant: RequestUser = {
        id: 'user-456',
        tenantId: 'tenant-456',
        email: 'other@example.com',
        firstName: null,
        lastName: null,
        roles: [],
      };

      const context = createMockContext(userWithDifferentTenant);
      tenantContextService.getTenantId.mockReturnValue('tenant-123');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('User tenant does not match tenant context'),
      );
    });
  });
});
