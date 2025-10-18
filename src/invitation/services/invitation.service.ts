import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { TenantInvitation, TenantInvitationWithRelations } from '../interfaces';
import { randomBytes } from 'crypto';
// Using string literals for InvitationStatus enum values

@Injectable()
export class InvitationService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Creates a new tenant invitation with secure token generation
   * Requirements: 1.1, 2.2, 3.1, 6.1
   */
  async createInvitation(
    tenantId: string,
    invitedBy: string,
    dto: CreateInvitationDto,
  ): Promise<TenantInvitationWithRelations> {
    // Validate that roles belong to the same tenant
    await this.validateRoleAssignments(tenantId, dto.roleIds);

    // Check for existing pending invitation
    await this.checkExistingInvitation(tenantId, dto.email);

    // Generate secure token using crypto.randomBytes
    const token = this.generateSecureToken();

    // Set expiration date (default 7 days if not provided)
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    // Validate expiration date is in the future
    if (expiresAt <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    try {
      // Create invitation with role assignments in a transaction
      const invitation = await this.prisma.$transaction(async (tx) => {
        // Create the invitation
        const newInvitation = await (tx as any).tenantInvitation.create({
          data: {
            tenantId,
            email: dto.email.toLowerCase().trim(),
            token,
            invitedBy,
            expiresAt,
            message: dto.message?.trim(),
            status: 'PENDING',
          },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                subdomain: true,
              },
            },
            inviter: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        // Create role assignments
        await (tx as any).tenantInvitationRole.createMany({
          data: dto.roleIds.map((roleId) => ({
            invitationId: newInvitation.id,
            roleId,
          })),
        });

        // Fetch the complete invitation with roles
        return await (tx as any).tenantInvitation.findUnique({
          where: { id: newInvitation.id },
          include: {
            tenant: {
              select: {
                id: true,
                name: true,
                subdomain: true,
              },
            },
            inviter: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            roles: {
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });
      });

      if (!invitation) {
        throw new Error('Failed to create invitation');
      }

      // Transform the result to match the expected interface
      return {
        ...invitation,
        roles: invitation.roles.map((r: any) => r.role),
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('unique_pending_invitation')
      ) {
        throw new ConflictException(
          'A pending invitation already exists for this email address',
        );
      }
      throw error;
    }
  }

  /**
   * Validates invitation token and returns invitation details
   * Requirements: 3.1, 6.1
   */
  async validateInvitation(
    token: string,
  ): Promise<TenantInvitationWithRelations> {
    const invitation = await (this.prisma as any).tenantInvitation.findUnique({
      where: { token },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    // Check if invitation has expired
    if (invitation.expiresAt <= new Date()) {
      // Update status to expired if not already
      if (invitation.status === 'PENDING') {
        await (this.prisma as any).tenantInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw new BadRequestException('Invitation has expired');
    }

    // Check invitation status
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        `Invitation is ${invitation.status.toLowerCase()} and cannot be used`,
      );
    }

    return {
      ...invitation,
      roles: invitation.roles.map((r: any) => r.role),
    };
  }

  /**
   * Marks an invitation as accepted
   * Requirements: 3.1
   */
  async acceptInvitation(
    token: string,
  ): Promise<TenantInvitationWithRelations> {
    const invitation = await this.validateInvitation(token);

    const updatedInvitation = await (
      this.prisma as any
    ).tenantInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      ...updatedInvitation,
      roles: updatedInvitation.roles.map((r: any) => r.role),
    };
  }

  /**
   * Cancels a pending invitation
   * Requirements: 3.1
   */
  async cancelInvitation(
    invitationId: string,
    tenantId: string,
  ): Promise<TenantInvitation> {
    const invitation = await (this.prisma as any).tenantInvitation.findFirst({
      where: {
        id: invitationId,
        tenantId,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot cancel invitation with status: ${invitation.status}`,
      );
    }

    return await (this.prisma as any).tenantInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Resends an invitation by creating a new token
   * Requirements: 3.1
   */
  async resendInvitation(
    invitationId: string,
    tenantId: string,
  ): Promise<TenantInvitationWithRelations> {
    const invitation = await (this.prisma as any).tenantInvitation.findFirst({
      where: {
        id: invitationId,
        tenantId,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot resend invitation with status: ${invitation.status}`,
      );
    }

    // Generate new token and extend expiration
    const newToken = this.generateSecureToken();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const updatedInvitation = await (
      this.prisma as any
    ).tenantInvitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return {
      ...updatedInvitation,
      roles: updatedInvitation.roles.map((r: any) => r.role),
    };
  }

  /**
   * Generates a cryptographically secure token
   * Requirements: 6.1
   */
  private generateSecureToken(): string {
    // Generate 32 bytes (256 bits) of random data and convert to hex
    return randomBytes(32).toString('hex');
  }

  /**
   * Validates that all role IDs belong to the specified tenant
   * Requirements: 2.2
   */
  private async validateRoleAssignments(
    tenantId: string,
    roleIds: string[],
  ): Promise<void> {
    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
        tenantId,
      },
    });

    if (roles.length !== roleIds.length) {
      const foundRoleIds = roles.map((role) => role.id);
      const invalidRoleIds = roleIds.filter((id) => !foundRoleIds.includes(id));
      throw new BadRequestException(
        `Invalid role IDs for this tenant: ${invalidRoleIds.join(', ')}`,
      );
    }
  }

  /**
   * Checks for existing pending invitations for the same email
   * Requirements: 1.1
   */
  private async checkExistingInvitation(
    tenantId: string,
    email: string,
  ): Promise<void> {
    const existingInvitation = await (
      this.prisma as any
    ).tenantInvitation.findFirst({
      where: {
        tenantId,
        email: email.toLowerCase().trim(),
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      throw new ConflictException(
        'A pending invitation already exists for this email address',
      );
    }
  }
}
