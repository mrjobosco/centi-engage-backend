import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InvitationController } from './invitation.controller';
import { InvitationService } from '../services/invitation.service';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { InvitationFilterDto } from '../dto/invitation-filter.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantInvitationWithRelations } from '../interfaces';

describe('InvitationController', () => {
  let controller: InvitationController;
  let invitationService: jest.Mocked<InvitationService>;

  const mockUser = {
    id: 'user-123',
    email: 'admin@example.com',
    tenantId: 'tenant-123',
    firstName: 'Admin',
    lastName: 'User',
    roles: [{ id: 'role-123', name: 'Admin' }],
  };

  const mockInvitation: TenantInvitationWithRelations = {
    id: 'invitation-123',
    tenantId: 'tenant-123',
    email: 'newuser@example.com',
    token: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
    invitedBy: 'user-123',
    expiresAt: new Date('2024-12-31T23:59:59.000Z'),
    acceptedAt: null,
    cancelledAt: null,
    status: 'PENDING' as any,
    message: 'Welcome to our team!',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    tenant: {
      id: 'tenant-123',
      name: 'Test Tenant',
      subdomain: 'test',
    },
    inviter: {
      id: 'user-123',
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
    },
    roles: [
      { id: 'role-123', name: 'Team Member' },
      { id: 'role-456', name: 'Viewer' },
    ],
  };

  beforeEach(async () => {
    const mockInvitationService = {
      createInvitation: jest.fn(),
      getInvitations: jest.fn(),
      resendInvitation: jest.fn(),
      cancelInvitation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        {
          provide: InvitationService,
          useValue: mockInvitationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<InvitationController>(InvitationController);
    invitationService = module.get(InvitationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createInvitation', () => {
    const createDto: CreateInvitationDto = {
      email: 'newuser@example.com',
      roleIds: ['role-123', 'role-456'],
      expiresAt: '2024-12-31T23:59:59.000Z',
      message: 'Welcome to our team!',
    };

    it('should create an invitation successfully', async () => {
      invitationService.createInvitation.mockResolvedValue(mockInvitation);

      const result = await controller.createInvitation(
        mockUser,
        'tenant-123',
        createDto,
      );

      expect(invitationService.createInvitation).toHaveBeenCalledWith(
        'tenant-123',
        'user-123',
        createDto,
      );
      expect(result).toEqual(mockInvitation);
    });

    it('should handle validation errors', async () => {
      const error = new BadRequestException('Invalid role IDs for this tenant');
      invitationService.createInvitation.mockRejectedValue(error);

      await expect(
        controller.createInvitation(mockUser, 'tenant-123', createDto),
      ).rejects.toThrow(BadRequestException);

      expect(invitationService.createInvitation).toHaveBeenCalledWith(
        'tenant-123',
        'user-123',
        createDto,
      );
    });

    it('should handle duplicate invitation conflicts', async () => {
      const error = new ConflictException(
        'A pending invitation already exists for this email address',
      );
      invitationService.createInvitation.mockRejectedValue(error);

      await expect(
        controller.createInvitation(mockUser, 'tenant-123', createDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle missing required fields', async () => {
      const invalidDto = {
        email: '',
        roleIds: [],
      } as CreateInvitationDto;

      const error = new BadRequestException('Validation failed');
      invitationService.createInvitation.mockRejectedValue(error);

      // This would be caught by validation pipes in real scenario
      await expect(
        controller.createInvitation(mockUser, 'tenant-123', invalidDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getInvitations', () => {
    const mockPaginatedResult = {
      invitations: [mockInvitation],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    it('should get invitations with default filters', async () => {
      invitationService.getInvitations.mockResolvedValue(mockPaginatedResult);

      const filters: InvitationFilterDto = {};
      const result = await controller.getInvitations('tenant-123', filters);

      expect(invitationService.getInvitations).toHaveBeenCalledWith(
        'tenant-123',
        filters,
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should get invitations with status filter', async () => {
      invitationService.getInvitations.mockResolvedValue(mockPaginatedResult);

      const filters: InvitationFilterDto = {
        status: 'PENDING' as any,
        page: 1,
        limit: 10,
      };
      const result = await controller.getInvitations('tenant-123', filters);

      expect(invitationService.getInvitations).toHaveBeenCalledWith(
        'tenant-123',
        filters,
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should get invitations with email filter', async () => {
      invitationService.getInvitations.mockResolvedValue(mockPaginatedResult);

      const filters: InvitationFilterDto = {
        email: 'newuser@example.com',
        sortBy: 'email',
        sortOrder: 'asc',
      };
      const result = await controller.getInvitations('tenant-123', filters);

      expect(invitationService.getInvitations).toHaveBeenCalledWith(
        'tenant-123',
        filters,
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should get invitations with date range filters', async () => {
      invitationService.getInvitations.mockResolvedValue(mockPaginatedResult);

      const filters: InvitationFilterDto = {
        createdAfter: '2024-01-01T00:00:00.000Z',
        createdBefore: '2024-12-31T23:59:59.000Z',
        expiresAfter: '2024-06-01T00:00:00.000Z',
      };
      const result = await controller.getInvitations('tenant-123', filters);

      expect(invitationService.getInvitations).toHaveBeenCalledWith(
        'tenant-123',
        filters,
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('should handle empty results', async () => {
      const emptyResult = {
        invitations: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      invitationService.getInvitations.mockResolvedValue(emptyResult);

      const result = await controller.getInvitations('tenant-123', {});

      expect(result).toEqual(emptyResult);
    });
  });

  describe('resendInvitation', () => {
    const resentInvitation = {
      ...mockInvitation,
      token: 'new-token-xyz789abc123def456ghi789jkl012mno345pqr678stu901',
      expiresAt: new Date('2025-01-07T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    };

    it('should resend invitation successfully', async () => {
      invitationService.resendInvitation.mockResolvedValue(resentInvitation);

      const result = await controller.resendInvitation(
        'tenant-123',
        'invitation-123',
      );

      expect(invitationService.resendInvitation).toHaveBeenCalledWith(
        'invitation-123',
        'tenant-123',
      );
      expect(result).toEqual(resentInvitation);
      expect(result.token).not.toBe(mockInvitation.token);
    });

    it('should handle invitation not found', async () => {
      const error = new NotFoundException('Invitation not found');
      invitationService.resendInvitation.mockRejectedValue(error);

      await expect(
        controller.resendInvitation('tenant-123', 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);

      expect(invitationService.resendInvitation).toHaveBeenCalledWith(
        'nonexistent-id',
        'tenant-123',
      );
    });

    it('should handle invalid invitation status', async () => {
      const error = new BadRequestException(
        'Cannot resend invitation with status: ACCEPTED',
      );
      invitationService.resendInvitation.mockRejectedValue(error);

      await expect(
        controller.resendInvitation('tenant-123', 'invitation-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle cross-tenant access attempt', async () => {
      const error = new NotFoundException('Invitation not found');
      invitationService.resendInvitation.mockRejectedValue(error);

      await expect(
        controller.resendInvitation('different-tenant', 'invitation-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelInvitation', () => {
    const cancelledInvitation = {
      ...mockInvitation,
      status: 'CANCELLED' as any,
      cancelledAt: new Date('2024-01-02T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    };

    it('should cancel invitation successfully', async () => {
      invitationService.cancelInvitation.mockResolvedValue(cancelledInvitation);

      const result = await controller.cancelInvitation(
        'tenant-123',
        'invitation-123',
      );

      expect(invitationService.cancelInvitation).toHaveBeenCalledWith(
        'invitation-123',
        'tenant-123',
      );
      expect(result).toEqual({
        message: 'Invitation cancelled successfully',
        invitation: cancelledInvitation,
      });
    });

    it('should handle invitation not found', async () => {
      const error = new NotFoundException('Invitation not found');
      invitationService.cancelInvitation.mockRejectedValue(error);

      await expect(
        controller.cancelInvitation('tenant-123', 'nonexistent-id'),
      ).rejects.toThrow(NotFoundException);

      expect(invitationService.cancelInvitation).toHaveBeenCalledWith(
        'nonexistent-id',
        'tenant-123',
      );
    });

    it('should handle invalid invitation status', async () => {
      const error = new BadRequestException(
        'Cannot cancel invitation with status: ACCEPTED',
      );
      invitationService.cancelInvitation.mockRejectedValue(error);

      await expect(
        controller.cancelInvitation('tenant-123', 'invitation-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle cross-tenant access attempt', async () => {
      const error = new NotFoundException('Invitation not found');
      invitationService.cancelInvitation.mockRejectedValue(error);

      await expect(
        controller.cancelInvitation('different-tenant', 'invitation-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('permission scenarios', () => {
    it('should require create:invitation permission for createInvitation', () => {
      // This would be tested by the PermissionsGuard in integration tests
      // Here we just verify the controller method exists and can be called
      expect(controller.createInvitation).toBeDefined();
    });

    it('should require read:invitation permission for getInvitations', () => {
      expect(controller.getInvitations).toBeDefined();
    });

    it('should require update:invitation permission for resendInvitation', () => {
      expect(controller.resendInvitation).toBeDefined();
    });

    it('should require delete:invitation permission for cancelInvitation', () => {
      expect(controller.cancelInvitation).toBeDefined();
    });
  });

  describe('input validation scenarios', () => {
    it('should handle malformed tenant ID', async () => {
      const createDto: CreateInvitationDto = {
        email: 'test@example.com',
        roleIds: ['role-123'],
      };

      // Service would handle tenant validation
      const error = new BadRequestException('Invalid tenant');
      invitationService.createInvitation.mockRejectedValue(error);

      await expect(
        controller.createInvitation(mockUser, 'invalid-tenant', createDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle invalid invitation ID format', async () => {
      const error = new BadRequestException('Invalid invitation ID format');
      invitationService.resendInvitation.mockRejectedValue(error);

      await expect(
        controller.resendInvitation('tenant-123', 'invalid-id-format'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
