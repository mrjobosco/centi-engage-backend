import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { TenantService } from './tenant.service';
import { CreateTenantForUserDto } from './dto/create-tenant-for-user.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Tenant, TenantInvitation } from '@prisma/client';

export interface TenantCreationResult {
  tenant: Tenant;
  accessToken: string;
}

export interface TenantJoinResult {
  tenant: Tenant;
  accessToken: string;
}

export interface UserTenantStatus {
  hasTenant: boolean;
  tenant?: Tenant;
  availableInvitations: TenantInvitation[];
}

/**
 * Service for managing tenant operations for tenant-less users
 * Handles tenant creation and joining workflows
 */
@Injectable()
export class TenantManagementService {
  private readonly logger = new Logger(TenantManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantService: TenantService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Create a new tenant for a tenant-less user
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
   */
  async createTenantForUser(
    userId: string,
    createTenantDto: CreateTenantForUserDto,
  ): Promise<TenantCreationResult> {
    this.logger.log(
      `Creating tenant for user ${userId}: ${createTenantDto.tenantName}`,
    );

    // Verify user exists and is tenant-less
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.tenantId !== null) {
      throw new BadRequestException('User already belongs to a tenant');
    }

    // Check if tenant name is available
    const existingTenant = await this.prisma.tenant.findFirst({
      where: { name: createTenantDto.tenantName },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant name already exists');
    }

    // Create tenant and assign user as admin
    const result = await this.prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: createTenantDto.tenantName,
          googleSsoEnabled: false,
          googleAutoProvision: false,
        },
      });

      // Create default permissions for tenant
      const defaultPermissions = [
        { action: 'create', subject: 'project' },
        { action: 'read', subject: 'project' },
        { action: 'update', subject: 'project' },
        { action: 'delete', subject: 'project' },
        { action: 'create', subject: 'user' },
        { action: 'read', subject: 'user' },
        { action: 'update', subject: 'user' },
        { action: 'delete', subject: 'user' },
        { action: 'create', subject: 'role' },
        { action: 'read', subject: 'role' },
        { action: 'update', subject: 'role' },
        { action: 'delete', subject: 'role' },
        { action: 'create', subject: 'permission' },
        { action: 'read', subject: 'permission' },
        { action: 'delete', subject: 'permission' },
      ];

      const createdPermissions = await Promise.all(
        defaultPermissions.map((perm) =>
          tx.permission.create({
            data: {
              action: perm.action,
              subject: perm.subject,
              tenantId: tenant.id,
            },
          }),
        ),
      );

      // Create Admin role
      const adminRole = await tx.role.create({
        data: {
          name: 'Admin',
          tenantId: tenant.id,
        },
      });

      // Assign all permissions to Admin role
      await Promise.all(
        createdPermissions.map((permission) =>
          tx.rolePermission.create({
            data: {
              roleId: adminRole.id,
              permissionId: permission.id,
            },
          }),
        ),
      );

      // Create Member role with read permissions
      const memberRole = await tx.role.create({
        data: {
          name: 'Member',
          tenantId: tenant.id,
        },
      });

      // Assign read permissions to Member role
      const readPermissions = createdPermissions.filter((p) =>
        p.action.includes('read'),
      );
      await Promise.all(
        readPermissions.map((permission) =>
          tx.rolePermission.create({
            data: {
              roleId: memberRole.id,
              permissionId: permission.id,
            },
          }),
        ),
      );

      // Update user to belong to tenant
      await tx.user.update({
        where: { id: userId },
        data: {
          tenantId: tenant.id,
        },
      });

      // Assign Admin role to user
      await tx.userRole.create({
        data: {
          userId: userId,
          roleId: adminRole.id,
        },
      });

      return { tenant, adminRole };
    });

    // Generate new JWT token with tenant context
    const payload: JwtPayload = {
      userId: userId,
      tenantId: result.tenant.id,
      roles: [result.adminRole.id],
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(
      `Successfully created tenant ${result.tenant.id} for user ${userId}`,
    );

    return {
      tenant: result.tenant,
      accessToken,
    };
  }

  /**
   * Join an existing tenant via invitation
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
   */
  async joinTenantForUser(
    userId: string,
    invitationToken: string,
  ): Promise<TenantJoinResult> {
    this.logger.log(`User ${userId} attempting to join tenant via invitation`);

    // Verify user exists and is tenant-less
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.tenantId !== null) {
      throw new BadRequestException('User already belongs to a tenant');
    }

    // Find and validate invitation
    const invitation = await this.prisma.tenantInvitation.findUnique({
      where: { token: invitationToken },
      include: {
        tenant: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation is no longer valid');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    if (invitation.email !== user.email) {
      throw new BadRequestException(
        'Invitation email does not match user email',
      );
    }

    // Accept invitation and assign user to tenant
    const result = await this.prisma.$transaction(async (tx) => {
      // Update user to belong to tenant
      await tx.user.update({
        where: { id: userId },
        data: {
          tenantId: invitation.tenantId,
        },
      });

      // Assign roles from invitation
      await Promise.all(
        invitation.roles.map((invitationRole) =>
          tx.userRole.create({
            data: {
              userId: userId,
              roleId: invitationRole.roleId,
            },
          }),
        ),
      );

      // Mark invitation as accepted
      await tx.tenantInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      });

      return {
        tenant: invitation.tenant,
        roles: invitation.roles.map((ir) => ir.role.id),
      };
    });

    // Generate new JWT token with tenant context
    const payload: JwtPayload = {
      userId: userId,
      tenantId: result.tenant.id,
      roles: result.roles,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(
      `User ${userId} successfully joined tenant ${result.tenant.id}`,
    );

    return {
      tenant: result.tenant,
      accessToken,
    };
  }

  /**
   * Get user's tenant status and available invitations
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
   */
  async getUserTenantStatus(userId: string): Promise<UserTenantStatus> {
    this.logger.log(`Getting tenant status for user ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const availableInvitations = await this.prisma.tenantInvitation.findMany({
      where: {
        email: user.email,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        tenant: true,
      },
    });

    return {
      hasTenant: user.tenantId !== null,
      tenant: user.tenant || undefined,
      availableInvitations,
    };
  }
}
