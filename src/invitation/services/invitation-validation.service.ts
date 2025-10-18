import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantInvitationWithRelations } from '../interfaces';
import { createHash, timingSafeEqual } from 'crypto';
// Using string literals for InvitationStatus enum values

export interface ValidationContext {
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  invitation?: TenantInvitationWithRelations;
  reason?: string;
}

@Injectable()
export class InvitationValidationService {
  private readonly logger = new Logger(InvitationValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates invitation token with comprehensive security checks
   * Requirements: 6.1, 6.3, 6.4
   */
  async validateToken(
    token: string,
    context: ValidationContext = {},
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    let validationResult: ValidationResult = { isValid: false };
    let auditAction = 'token_validation_failed';
    const auditMetadata: Record<string, any> = {
      tokenLength: token?.length || 0,
      hasValidFormat: this.isValidTokenFormat(token),
    };

    try {
      // Basic token format validation
      if (!this.isValidTokenFormat(token)) {
        validationResult.reason = 'Invalid token format';
        auditMetadata.reason = validationResult.reason;
        await this.logSecurityEvent(null, auditAction, context, auditMetadata);
        return validationResult;
      }

      // Secure token lookup with timing attack protection
      const invitation = await this.secureTokenLookup(token);

      if (!invitation) {
        validationResult.reason = 'Token not found';
        auditMetadata.reason = validationResult.reason;
        await this.logSecurityEvent(null, auditAction, context, auditMetadata);
        return validationResult;
      }

      auditMetadata.invitationId = invitation.id;
      auditMetadata.tenantId = invitation.tenantId;
      auditMetadata.currentStatus = invitation.status;

      // Check invitation status
      const statusValidation = this.validateInvitationStatus(invitation);
      if (!statusValidation.isValid) {
        validationResult.reason = statusValidation.reason;
        auditMetadata.reason = validationResult.reason;
        await this.logSecurityEvent(
          invitation.id,
          auditAction,
          context,
          auditMetadata,
        );
        return validationResult;
      }

      // Check expiration with automatic status update
      const expirationValidation = await this.validateExpiration(invitation);
      if (!expirationValidation.isValid) {
        validationResult.reason = expirationValidation.reason;
        auditMetadata.reason = validationResult.reason;
        auditMetadata.expiresAt = invitation.expiresAt.toISOString();
        await this.logSecurityEvent(
          invitation.id,
          auditAction,
          context,
          auditMetadata,
        );
        return validationResult;
      }

      // All validations passed
      validationResult = {
        isValid: true,
        invitation: expirationValidation.invitation || invitation,
      };
      auditAction = 'token_validation_success';
      auditMetadata.validationDuration = Date.now() - startTime;

      await this.logSecurityEvent(
        invitation.id,
        auditAction,
        context,
        auditMetadata,
      );

      return validationResult;
    } catch (error) {
      this.logger.error('Token validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context,
        auditMetadata,
      });

      auditMetadata.error =
        error instanceof Error ? error.message : 'Unknown error';
      await this.logSecurityEvent(
        null,
        'token_validation_error',
        context,
        auditMetadata,
      );

      throw new BadRequestException('Token validation failed');
    }
  }

  /**
   * Validates token with cryptographic verification
   * Requirements: 6.1, 6.3
   */
  async validateTokenCryptographically(
    token: string,
    context: ValidationContext = {},
  ): Promise<boolean> {
    try {
      // First perform standard validation
      const result = await this.validateToken(token, context);

      if (!result.isValid || !result.invitation) {
        return false;
      }

      // Perform timing-safe token comparison to prevent timing attacks
      const storedToken = result.invitation.token;
      const providedTokenHash = createHash('sha256').update(token).digest();
      const storedTokenHash = createHash('sha256').update(storedToken).digest();

      const isTokenValid = timingSafeEqual(providedTokenHash, storedTokenHash);

      if (!isTokenValid) {
        await this.logSecurityEvent(
          result.invitation.id,
          'token_cryptographic_mismatch',
          context,
          { tokenProvided: token.substring(0, 8) + '...' },
        );
      }

      return isTokenValid;
    } catch (error) {
      this.logger.error('Cryptographic token validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context,
      });
      return false;
    }
  }

  /**
   * Checks if invitation has expired and updates status if needed
   * Requirements: 6.1, 6.3
   */
  async checkExpiration(invitationId: string): Promise<boolean> {
    const invitation = await (this.prisma as any).tenantInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return true; // Consider non-existent invitations as expired
    }

    const isExpired = invitation.expiresAt <= new Date();

    // Update status to expired if needed
    if (isExpired && invitation.status === 'PENDING') {
      await (this.prisma as any).tenantInvitation.update({
        where: { id: invitationId },
        data: { status: 'EXPIRED' },
      });

      await this.logSecurityEvent(
        invitationId,
        'invitation_auto_expired',
        {},
        {
          expiresAt: invitation.expiresAt.toISOString(),
          previousStatus: 'PENDING',
        },
      );
    }

    return isExpired;
  }

  /**
   * Validates token format to prevent malformed input attacks
   * Requirements: 6.3
   */
  private isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Token should be 64 characters (32 bytes in hex)
    if (token.length !== 64) {
      return false;
    }

    // Token should only contain hexadecimal characters
    const hexPattern = /^[a-f0-9]+$/i;
    return hexPattern.test(token);
  }

  /**
   * Performs secure token lookup with timing attack protection
   * Requirements: 6.3
   */
  private async secureTokenLookup(
    token: string,
  ): Promise<TenantInvitationWithRelations | null> {
    try {
      const invitation = await (this.prisma as any).tenantInvitation.findUnique(
        {
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
        },
      );

      if (!invitation) {
        return null;
      }

      return {
        ...invitation,
        roles: invitation.roles.map((r: any) => r.role),
      };
    } catch (error) {
      this.logger.error('Secure token lookup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenLength: token?.length || 0,
      });
      return null;
    }
  }

  /**
   * Validates invitation status
   * Requirements: 6.1
   */
  private validateInvitationStatus(
    invitation: TenantInvitationWithRelations,
  ): ValidationResult {
    switch (invitation.status) {
      case 'PENDING':
        return { isValid: true };
      case 'ACCEPTED':
        return {
          isValid: false,
          reason: 'Invitation has already been accepted',
        };
      case 'CANCELLED':
        return {
          isValid: false,
          reason: 'Invitation has been cancelled',
        };
      case 'EXPIRED':
        return {
          isValid: false,
          reason: 'Invitation has expired',
        };
      default:
        return {
          isValid: false,
          reason: 'Invalid invitation status',
        };
    }
  }

  /**
   * Validates expiration and updates status if needed
   * Requirements: 6.1, 6.3
   */
  private async validateExpiration(
    invitation: TenantInvitationWithRelations,
  ): Promise<ValidationResult> {
    const now = new Date();
    const isExpired = invitation.expiresAt <= now;

    if (!isExpired) {
      return { isValid: true, invitation };
    }

    // Update status to expired if still pending
    if (invitation.status === 'PENDING') {
      const updatedInvitation = await (
        this.prisma as any
      ).tenantInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
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
        isValid: false,
        reason: 'Invitation has expired',
        invitation: {
          ...updatedInvitation,
          roles: updatedInvitation.roles.map((r: any) => r.role),
        },
      };
    }

    return {
      isValid: false,
      reason: 'Invitation has expired',
      invitation,
    };
  }

  /**
   * Logs security events and validation attempts
   * Requirements: 6.4
   */
  private async logSecurityEvent(
    invitationId: string | null,
    action: string,
    context: ValidationContext,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    try {
      if (invitationId) {
        const auditData = {
          invitationId,
          action,
          userId: context.userId || null,
          ipAddress: context.ipAddress || null,
          userAgent: context.userAgent || null,
          metadata: {
            ...metadata,
            timestamp: new Date().toISOString(),
          },
        };

        await (this.prisma as any).invitationAuditLog.create({
          data: auditData,
        });
      }

      // Also log to application logger for monitoring
      this.logger.log('Security event logged', {
        action,
        invitationId,
        context,
        metadata,
      });
    } catch (error) {
      this.logger.error('Failed to log security event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        action,
        invitationId,
        context,
        metadata,
      });
    }
  }
}
