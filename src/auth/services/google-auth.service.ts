import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { GoogleProfile } from '../interfaces/google-profile.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { User, Tenant } from '@prisma/client';
import { AuthAuditService } from './auth-audit.service';
import { GoogleAuthMetricsService } from './google-auth-metrics.service';

export interface AuthenticationResult {
  accessToken: string;
}

export interface UserWithRoles extends User {
  roles: Array<{
    role: {
      id: string;
      name: string;
    };
  }>;
}

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authAuditService: AuthAuditService,
    private readonly googleAuthMetricsService: GoogleAuthMetricsService,
  ) { }

  /**
   * Validate that a tenant has Google SSO enabled
   */
  async validateTenantGoogleSSO(tenantId: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        googleSsoEnabled: true,
        googleAutoProvision: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        subdomain: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.googleSsoEnabled) {
      throw new ForbiddenException('Google SSO is not enabled for this tenant');
    }

    return tenant;
  }

  /**
   * Authenticate a user with Google profile information - supports tenant-less registration
   */
  async authenticateWithGoogle(
    profile: GoogleProfile,
    tenantId?: string,
  ): Promise<AuthenticationResult> {
    if (!tenantId) {
      // Handle tenant-less Google OAuth
      return this.authenticateWithGoogleTenantless(profile);
    }

    // Record authentication attempt
    this.googleAuthMetricsService.recordSignInAttempt(tenantId, 'callback');

    // Start timing tenant lookup
    const tenantLookupTimer =
      this.googleAuthMetricsService.startTenantLookupTimer(tenantId);

    try {
      // Validate tenant configuration
      const tenant = await this.validateTenantGoogleSSO(tenantId);
      tenantLookupTimer(true);

      let userType: 'new' | 'existing' = 'existing';

      // Check if user exists by Google ID
      let user = await this.prisma.user.findUnique({
        where: { googleId: profile.id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (user) {
        // Existing Google user - verify tenant matches
        if (user.tenantId !== tenantId) {
          this.googleAuthMetricsService.recordSignInFailure(
            tenantId,
            'callback',
            'tenant_mismatch',
            'TENANT_001',
          );
          throw new UnauthorizedException('User belongs to different tenant');
        }
      } else {
        // Check if user exists by email in this tenant
        user = await this.prisma.user.findFirst({
          where: {
            email: profile.email,
            tenantId: tenantId,
          },
          include: {
            roles: {
              include: {
                role: true,
              },
            },
          },
        });

        if (user) {
          // Auto-link existing user
          await this.linkGoogleAccountInternal(user.id, profile);
          // Refresh user data after linking
          user = await this.prisma.user.findUnique({
            where: { id: user.id },
            include: {
              roles: {
                include: {
                  role: true,
                },
              },
            },
          });
        } else if (tenant.googleAutoProvision) {
          // Create new user
          user = (await this.createUserFromGoogle(profile, tenantId)) as any;
          userType = 'new';
        } else {
          this.googleAuthMetricsService.recordSignInFailure(
            tenantId,
            'callback',
            'auto_provision_disabled',
            'PROVISION_001',
          );
          throw new UnauthorizedException(
            'User not found and auto-provisioning is disabled',
          );
        }
      }

      if (!user) {
        this.googleAuthMetricsService.recordSignInFailure(
          tenantId,
          'callback',
          'authentication_failed',
          'AUTH_001',
        );
        throw new UnauthorizedException('Authentication failed');
      }

      // Generate JWT token
      const payload: JwtPayload = {
        userId: user.id,
        tenantId: user.tenantId,
        roles: user.roles.map((ur) => ur.role.id),
      };

      const accessToken = this.jwtService.sign(payload);

      // Record successful authentication
      this.googleAuthMetricsService.recordSignInSuccess(
        tenantId,
        'callback',
        userType,
      );

      // Log successful authentication
      await this.authAuditService.logGoogleSignIn(
        user.id,
        user.tenantId ?? '',
        true,
        undefined, // IP address will be added by controller
        undefined, // User agent will be added by controller
      );

      return { accessToken };
    } catch (error) {
      // Log failed authentication attempt
      // For failed attempts, we might not have a userId, so we'll use a placeholder
      await this.authAuditService.logGoogleSignIn(
        'unknown', // Will be replaced with actual userId if available
        tenantId,
        false,
        undefined, // IP address will be added by controller
        undefined, // User agent will be added by controller
        error instanceof Error ? error.constructor.name : 'UnknownError',
        error instanceof Error ? error.message : 'Unknown error occurred',
        { googleEmail: profile.email },
      );

      throw error;
    }
  }

  /**
   * Create a new user from Google profile information
   */
  async createUserFromGoogle(
    profile: GoogleProfile,
    tenantId: string,
  ): Promise<UserWithRoles> {
    // Get the default Member role for the tenant
    const memberRole = await this.prisma.role.findFirst({
      where: {
        tenantId: tenantId,
        name: 'Member',
      },
    });

    if (!memberRole) {
      throw new NotFoundException('Default Member role not found for tenant');
    }

    // Create user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          email: profile.email,
          firstName: profile.firstName || null,
          lastName: profile.lastName || null,
          tenantId: tenantId,
          googleId: profile.id,
          googleLinkedAt: new Date(),
          authMethods: ['google'],
          password: '', // Empty password for Google-only users
          emailVerified: true, // OAuth users have pre-verified emails
          emailVerifiedAt: new Date(),
        } as any,
      });

      // Assign Member role to the new user
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: memberRole.id,
        },
      });

      // Return user with roles
      return await tx.user.findUnique({
        where: { id: user.id },
        include: {
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

    if (!result) {
      throw new Error('Failed to create user');
    }

    return result as any;
  }

  /**
   * Link a Google account to an existing user
   */
  async linkGoogleAccount(
    userId: string,
    profile: GoogleProfile,
  ): Promise<void> {
    let user: User | null = null;

    try {
      // Get current user
      user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Record linking attempt
      this.googleAuthMetricsService.recordLinkingAttempt(
        user.tenantId ?? 'tenant-less',
        userId,
        'link',
      );

      // Verify email matches
      if (user.email !== profile.email) {
        this.googleAuthMetricsService.recordLinkingFailure(
          user.tenantId ?? 'tenant-less',
          userId,
          'link',
          'email_mismatch',
          'LINK_001',
        );
        throw new BadRequestException(
          'Google email must match your account email',
        );
      }

      // Check if Google ID is already linked to another user
      const existingGoogleUser = await this.prisma.user.findUnique({
        where: { googleId: profile.id },
      });

      if (existingGoogleUser && existingGoogleUser.id !== userId) {
        this.googleAuthMetricsService.recordLinkingFailure(
          user.tenantId ?? 'tenant-less',
          userId,
          'link',
          'already_linked',
          'LINK_002',
        );
        throw new ConflictException(
          'Google account is already linked to another user',
        );
      }

      await this.linkGoogleAccountInternal(userId, profile);

      // Record successful linking
      this.googleAuthMetricsService.recordLinkingSuccess(
        user.tenantId ?? 'tenant-less',
        userId,
        'link',
      );

      // Log successful linking
      await this.authAuditService.logGoogleLink(
        userId,
        user.tenantId ?? 'tenant-less',
        true,
        undefined, // IP address will be added by controller
        undefined, // User agent will be added by controller
      );
    } catch (error) {
      // Log failed linking attempt
      const tenantId = user?.tenantId || 'unknown';
      await this.authAuditService.logGoogleLink(
        userId,
        tenantId,
        false,
        undefined, // IP address will be added by controller
        undefined, // User agent will be added by controller
        error instanceof Error ? error.constructor.name : 'UnknownError',
        error instanceof Error ? error.message : 'Unknown error occurred',
        { googleEmail: profile.email },
      );

      throw error;
    }
  }

  /**
   * Internal method to link Google account (used by both linking and auto-linking)
   */
  private async linkGoogleAccountInternal(
    userId: string,
    profile: GoogleProfile,
  ): Promise<void> {
    // Get current auth methods
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { authMethods: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Add 'google' to auth methods if not already present
    const updatedAuthMethods = user.authMethods.includes('google')
      ? user.authMethods
      : [...user.authMethods, 'google'];

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleId: profile.id,
        googleLinkedAt: new Date(),
        authMethods: updatedAuthMethods,
        emailVerified: true, // Mark email as verified when linking Google account
        emailVerifiedAt: new Date(),
      } as any,
    });
  }

  /**
   * Unlink Google account from a user
   */
  async unlinkGoogleAccount(userId: string): Promise<void> {
    let user: {
      authMethods: string[];
      googleId: string | null;
      tenantId: string | null;
    } | null = null;

    try {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { authMethods: true, googleId: true, tenantId: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Record unlinking attempt
      this.googleAuthMetricsService.recordLinkingAttempt(
        user.tenantId ?? 'tenant-less',
        userId,
        'unlink',
      );

      if (!user.googleId) {
        this.googleAuthMetricsService.recordLinkingFailure(
          user.tenantId ?? 'tenant-less',
          userId,
          'unlink',
          'not_linked',
          'UNLINK_001',
        );
        throw new BadRequestException('Google account is not linked');
      }

      // Ensure user has at least one other auth method
      const otherAuthMethods = user.authMethods.filter(
        (method) => method !== 'google',
      );
      if (otherAuthMethods.length === 0) {
        this.googleAuthMetricsService.recordLinkingFailure(
          user.tenantId ?? 'tenant-less',
          userId,
          'unlink',
          'no_other_auth_methods',
          'UNLINK_002',
        );
        throw new BadRequestException(
          'Cannot unlink Google account - no other authentication methods available',
        );
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleId: null,
          googleLinkedAt: null,
          authMethods: otherAuthMethods,
        },
      });

      // Record successful unlinking
      this.googleAuthMetricsService.recordLinkingSuccess(
        user.tenantId ?? 'tenant-less',
        userId,
        'unlink',
      );

      // Log successful unlinking
      await this.authAuditService.logGoogleUnlink(
        userId,
        user.tenantId ?? 'tenant-less',
        true,
        undefined, // IP address will be added by controller
        undefined, // User agent will be added by controller
      );
    } catch (error) {
      // Log failed unlinking attempt
      const tenantId = user?.tenantId || 'unknown';
      await this.authAuditService.logGoogleUnlink(
        userId,
        tenantId,
        false,
        undefined, // IP address will be added by controller
        undefined, // User agent will be added by controller
        error instanceof Error ? error.constructor.name : 'UnknownError',
        error instanceof Error ? error.message : 'Unknown error occurred',
      );

      throw error;
    }
  }

  /**
   * Get user's available authentication methods
   */
  async getUserAuthMethods(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { authMethods: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.authMethods;
  }

  /**
   * Handle tenant-less Google OAuth authentication
   */
  private async authenticateWithGoogleTenantless(
    profile: GoogleProfile,
  ): Promise<AuthenticationResult> {
    // Check if user exists by Google ID
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (user) {
      // Existing Google user
      if (user.tenantId === null) {
        // Tenant-less user signing in
        return this.generateTokenForUser(user);
      } else {
        // User has tenant - redirect to tenant-specific flow
        throw new BadRequestException(
          'User belongs to a tenant. Please use tenant-specific login.',
        );
      }
    }

    // Check if user exists by email (tenant-less)
    user = (await this.prisma.user.findFirst({
      where: {
        email: profile.email,
        tenantId: {
          equals: null,
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    })) as any;

    if (user) {
      // Auto-link Google account to existing tenant-less user
      await this.linkGoogleAccountInternal(user.id, profile);
      user = (await this.prisma.user.findUnique({
        where: { id: user.id },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      })) as any;
    } else {
      // Create new tenant-less user
      user = (await this.createTenantlessUserFromGoogle(profile)) as any;
    }

    return this.generateTokenForUser(user!);
  }

  /**
   * Generate JWT token for a user
   */
  private generateTokenForUser(user: UserWithRoles): AuthenticationResult {
    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      roles: user.roles.map((ur) => ur.role.id),
    };

    const accessToken = this.jwtService.sign(payload);
    return { accessToken };
  }

  /**
   * Create a new tenant-less user from Google profile
   */
  private async createTenantlessUserFromGoogle(
    profile: GoogleProfile,
  ): Promise<UserWithRoles> {
    // Create tenant-less user
    const user = await this.prisma.user.create({
      data: {
        email: profile.email,
        firstName: profile.firstName || null,
        lastName: profile.lastName || null,
        tenantId: null as any, // Explicitly null for tenant-less users
        googleId: profile.id,
        googleLinkedAt: new Date(),
        authMethods: ['google'],
        password: '', // Empty password for Google-only users
        emailVerified: true, // OAuth users have pre-verified emails
        emailVerifiedAt: new Date(),
      },
      include: {
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

    return user as any;
  }
}
