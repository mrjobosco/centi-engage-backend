import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { GoogleOAuthService } from '../../auth/services/google-oauth.service';
import { GoogleAuthService } from '../../auth/services/google-auth.service';
import { EmailOTPService } from '../../auth/services/email-otp.service';
import { InvitationValidationService } from './invitation-validation.service';
import { InvitationService } from './invitation.service';
import { InvitationAuditService } from './invitation-audit.service';
import {
  AuthMethod,
  InvitationAcceptanceDto,
} from '../dto/invitation-acceptance.dto';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import * as bcrypt from 'bcrypt';

export interface InvitationAcceptanceResult {
  message: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    tenantId: string;
    emailVerified: boolean;
  };
  tenant: {
    id: string;
    name: string;
    subdomain: string;
  };
  roles: Array<{
    id: string;
    name: string;
  }>;
  accessToken: string;
  verificationRequired?: boolean;
}

@Injectable()
export class InvitationAcceptanceService {
  private readonly logger = new Logger(InvitationAcceptanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly emailOTPService: EmailOTPService,
    private readonly invitationValidationService: InvitationValidationService,
    private readonly invitationService: InvitationService,
    private readonly auditService: InvitationAuditService,
  ) { }

  /**
   * Accept an invitation with the specified authentication method
   */
  async acceptInvitation(
    token: string,
    acceptanceDto: InvitationAcceptanceDto,
  ): Promise<InvitationAcceptanceResult> {
    // First validate the invitation
    const validationResult =
      await this.invitationValidationService.validateToken(token);

    if (!validationResult.isValid || !validationResult.invitation) {
      throw new BadRequestException(
        validationResult.reason || 'Invalid invitation token',
      );
    }

    const invitation = validationResult.invitation;

    // Check if user already exists in the tenant
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: invitation.email,
        tenantId: invitation.tenantId,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this email already exists in the tenant',
      );
    }

    let user: any;
    let accessToken: string;

    if (acceptanceDto.authMethod === AuthMethod.GOOGLE) {
      const result = await this.acceptWithGoogleAuth(invitation, acceptanceDto);
      user = result.user;
      accessToken = result.accessToken;
    } else if (acceptanceDto.authMethod === AuthMethod.PASSWORD) {
      const result = await this.acceptWithPasswordAuth(
        invitation,
        acceptanceDto,
      );
      user = result.user;
      accessToken = result.accessToken;
    } else {
      throw new BadRequestException('Invalid authentication method');
    }

    // Mark invitation as accepted
    await this.invitationService.acceptInvitation(token);

    // Get tenant information
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: invitation.tenantId },
      select: {
        id: true,
        name: true,
        subdomain: true,
      },
    });

    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    // Get assigned roles
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Generate OTP for password-based users who need email verification
    let verificationRequired = false;
    if (
      !user.emailVerified &&
      acceptanceDto.authMethod === AuthMethod.PASSWORD
    ) {
      try {
        await this.emailOTPService.generateOTP(user.id, user.email);
        verificationRequired = true;
        this.logger.log(
          `OTP generated for invited user ${user.id} after invitation acceptance`,
        );
      } catch (error) {
        this.logger.error('Failed to generate OTP for invited user', {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't fail the invitation acceptance if OTP generation fails
      }
    }

    return {
      message: 'Invitation accepted successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: user.tenantId,
        emailVerified: user.emailVerified,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain || '',
      },
      roles: userRoles.map((ur) => ur.role),
      accessToken,
      verificationRequired,
    };
  }

  /**
   * Accept invitation using Google OAuth
   */
  private async acceptWithGoogleAuth(
    invitation: any,
    acceptanceDto: InvitationAcceptanceDto,
  ): Promise<{ user: any; accessToken: string }> {
    if (!acceptanceDto.googleAuthCode) {
      throw new BadRequestException('Google authorization code is required');
    }

    try {
      // Exchange authorization code for tokens
      const { idToken } = await this.googleOAuthService.exchangeCodeForTokens(
        acceptanceDto.googleAuthCode,
      );

      // Verify ID token and get user profile
      const googleProfile =
        await this.googleOAuthService.verifyIdToken(idToken);

      // Verify that Google email matches invitation email
      if (googleProfile.email !== invitation.email) {
        throw new BadRequestException(
          'Google account email must match the invitation email',
        );
      }

      // Check if tenant has Google SSO enabled
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: invitation.tenantId },
        select: {
          googleSsoEnabled: true,
          googleAutoProvision: true,
        },
      });

      if (!tenant?.googleSsoEnabled) {
        throw new BadRequestException(
          'Google SSO is not enabled for this tenant',
        );
      }

      // Create user with Google profile (email pre-verified by Google)
      const user = await this.createUserFromInvitation(invitation, {
        firstName: googleProfile.firstName || null,
        lastName: googleProfile.lastName || null,
        googleId: googleProfile.id,
        authMethods: ['google'],
        password: '', // Empty password for Google-only users
        googleLinkedAt: new Date(),
        emailVerified: true, // Google OAuth users have pre-verified emails
      });

      // Generate JWT token
      const roleIds = invitation.roles?.map((role: any) => role.id) || [];
      const payload: JwtPayload = {
        userId: user.id,
        tenantId: user.tenantId,
        roles: roleIds,
      };

      const accessToken = this.jwtService.sign(payload);

      return { user, accessToken };
    } catch (error) {
      this.logger.error('Google OAuth invitation acceptance failed', {
        invitationId: invitation.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new BadRequestException('Google authentication failed');
    }
  }

  /**
   * Accept invitation using password authentication
   */
  private async acceptWithPasswordAuth(
    invitation: any,
    acceptanceDto: InvitationAcceptanceDto,
  ): Promise<{ user: any; accessToken: string }> {
    if (
      !acceptanceDto.password ||
      !acceptanceDto.firstName ||
      !acceptanceDto.lastName
    ) {
      throw new BadRequestException(
        'Password, first name, and last name are required for password authentication',
      );
    }

    // Validate password strength (basic validation)
    if (acceptanceDto.password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }

    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(acceptanceDto.password, 10);

      // Create user with password (requires email verification)
      const user = await this.createUserFromInvitation(invitation, {
        firstName: acceptanceDto.firstName.trim(),
        lastName: acceptanceDto.lastName.trim(),
        password: hashedPassword,
        authMethods: ['password'],
        emailVerified: false, // Password users need to verify their email
      });

      // Generate JWT token
      const roleIds = invitation.roles?.map((role: any) => role.id) || [];
      const payload: JwtPayload = {
        userId: user.id,
        tenantId: user.tenantId,
        roles: roleIds,
      };

      const accessToken = this.jwtService.sign(payload);

      return { user, accessToken };
    } catch (error) {
      this.logger.error('Password-based invitation acceptance failed', {
        invitationId: invitation.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new BadRequestException('User creation failed');
    }
  }

  /**
   * Create user from invitation with role assignments
   */
  private async createUserFromInvitation(
    invitation: any,
    userData: {
      firstName: string | null;
      lastName: string | null;
      password?: string;
      googleId?: string;
      googleLinkedAt?: Date;
      authMethods: string[];
      emailVerified: boolean;
    },
  ): Promise<any> {
    return await this.prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          email: invitation.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          tenantId: invitation.tenantId,
          password: userData.password || '',
          googleId: userData.googleId || null,
          googleLinkedAt: userData.googleLinkedAt || null,
          authMethods: userData.authMethods,
          emailVerified: userData.emailVerified,
          emailVerifiedAt: userData.emailVerified ? new Date() : null,
        },
      });

      // Assign roles from invitation
      if (invitation.roles && invitation.roles.length > 0) {
        const roleAssignments = invitation.roles.map((role: any) => ({
          userId: user.id,
          roleId: role.id,
        }));

        await tx.userRole.createMany({
          data: roleAssignments,
        });
      } else {
        // If no roles specified, assign default Member role
        const memberRole = await tx.role.findFirst({
          where: {
            tenantId: invitation.tenantId,
            name: 'Member',
          },
        });

        if (memberRole) {
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: memberRole.id,
            },
          });
        }
      }

      return user;
    });
  }
}
