import type { InvitationStatus } from '@prisma/client';

/**
 * Interface representing a tenant invitation entity
 * Based on the TenantInvitation Prisma model
 */
export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  token: string;
  invitedBy: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  cancelledAt: Date | null;
  status: InvitationStatus;
  message: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for tenant invitation with populated relationships
 */
export interface TenantInvitationWithRelations extends TenantInvitation {
  tenant?: {
    id: string;
    name: string;
    subdomain: string | null;
  };
  inviter?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  roles?: Array<{
    id: string;
    name: string;
  }>;
}

/**
 * Interface for invitation role assignment
 */
export interface TenantInvitationRole {
  invitationId: string;
  roleId: string;
}

/**
 * Interface for invitation audit log
 */
export interface InvitationAuditLog {
  id: string;
  invitationId: string;
  action: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
