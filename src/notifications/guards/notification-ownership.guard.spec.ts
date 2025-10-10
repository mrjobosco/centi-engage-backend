import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationOwnershipGuard } from './notification-ownership.guard';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

describe('NotificationOwnershipGuard', () => {
  let guard: NotificationOwnershipGuard;
  let prismaService: jest.Mocked<PrismaService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const mockPrismaService = {
      notification: {
        findFirst: jest.fn(),
      },
    };

    const mockTenantContextService = {
      getTenantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationOwnershipGuard,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TenantContextService, useValue: mockTenantContextService },
      ],
    }).compile();

    guard = module.get<NotificationOwnershipGuard>(NotificationOwnershipGuard);
    prismaService = module.get(PrismaService);
    tenantContextService = module.get(TenantContextService);
  });

  const createMockContext = (
    user: RequestUser | null,
    notificationId?: string,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params: notificationId ? { id: notificationId } : {},
        }),
      }),
    } as ExecutionContext;
  };

  describe('canActivate', () => {
    const mockUser: RequestUser = {
      id: 'user-123',
      tenantId: 'tenant-123',
      email: 'test@example.com',
    };

    it('should throw ForbiddenException when user is not authenticated', async () => {
      const context = createMockContext(null, 'notification-123');

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('User not authenticated'),
      );
    });

    it('should allow access when no notification ID is provided', async () => {
      const context = createMockContext(mockUser);
      tenantContextService.getTenantId.mockReturnValue('tenant-123');

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when tenant context is missing', async () => {
      const context = createMockContext(mockUser, 'notification-123');
      tenantContextService.getTenantId.mockReturnValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Tenant context is required'),
      );
    });

    it('should allow access when user owns the notification', async () => {
      const context = createMockContext(mockUser, 'notification-123');
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
      prismaService.notification.findFirst.mockResolvedValue({
        id: 'notification-123',
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      expect(prismaService.notification.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'notification-123',
          userId: 'user-123',
          tenantId: 'tenant-123',
        },
        select: {
          id: true,
        },
      });
    });

    it('should throw NotFoundException when notification does not exist or user does not own it', async () => {
      const context = createMockContext(mockUser, 'notification-123');
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
      prismaService.notification.findFirst.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new NotFoundException('Notification not found or access denied'),
      );
    });

    it('should throw ForbiddenException when database error occurs', async () => {
      const context = createMockContext(mockUser, 'notification-123');
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
      prismaService.notification.findFirst.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Access denied'),
      );
    });

    it('should preserve NotFoundException when thrown by database', async () => {
      const context = createMockContext(mockUser, 'notification-123');
      tenantContextService.getTenantId.mockReturnValue('tenant-123');
      prismaService.notification.findFirst.mockRejectedValue(
        new NotFoundException('Custom not found'),
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        new NotFoundException('Custom not found'),
      );
    });
  });
});
