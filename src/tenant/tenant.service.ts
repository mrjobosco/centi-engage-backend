import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { UpdateGoogleSettingsDto } from '../auth/dto/update-google-settings.dto';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import { EmailOTPService } from '../auth/services/email-otp.service';

export interface CreateTenantInput {
  tenantName: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

export interface CreateTenantResult {
  tenant: {
    id: string;
    name: string;
    subdomain: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  adminUser: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    tenantId: string | null;
    createdAt: Date;
    updatedAt: Date;
    emailVerified: boolean | null;
  };
  verificationRequired: boolean;
}

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authAuditService: AuthAuditService,
    private readonly emailOTPService: EmailOTPService,
  ) { }

  async createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
    const {
      tenantName,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
    } = input;

    // Check if tenant name already exists
    const existingTenant = await this.prisma.tenant.findFirst({
      where: { name: tenantName },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant name already exists');
    }

    // Hash the admin password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Use a transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Tenant record
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
        },
      });

      // 2. Create default permissions
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

      // 3. Create default roles
      // Admin role with all permissions
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

      // Member role with read permissions only
      const memberRole = await tx.role.create({
        data: {
          name: 'Member',
          tenantId: tenant.id,
        },
      });

      // Assign only read permissions to Member role
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

      // 4. Create admin User record (unverified for email/password registration)
      const adminUser = await tx.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          firstName: adminFirstName,
          lastName: adminLastName,
          tenantId: tenant.id,
          emailVerified: false, // Email verification required for new registrations
        },
      });

      // 5. Assign Admin role to user via UserRole join table
      await tx.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      });

      // Return created tenant and user (without password)
      const userWithoutPassword = {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        tenantId: adminUser.tenantId,
        createdAt: adminUser.createdAt,
        updatedAt: adminUser.updatedAt,
        emailVerified: adminUser.emailVerified,
      };

      return {
        tenant,
        adminUser: userWithoutPassword,
      };
    });

    // Generate and send OTP for email verification
    try {
      await this.emailOTPService.generateOTP(
        result.adminUser.id,
        result.adminUser.email,
      );
    } catch (error) {
      // Log error but don't fail the registration - user can request resend
      console.error('Failed to generate OTP during registration:', error);
    }

    return {
      ...result,
      verificationRequired: true,
    };
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        googleSsoEnabled: true,
        googleAutoProvision: true,
        createdAt: true,
        updatedAt: true,
      } as any, // Type assertion to bypass TypeScript issue with newly added fields
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async updateGoogleSettings(
    tenantId: string,
    updateDto: UpdateGoogleSettingsDto,
    userId: string,
  ) {
    try {
      // Verify tenant exists and get current settings
      const currentTenant = await this.findById(tenantId);

      const updatedTenant = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(updateDto.googleSsoEnabled !== undefined && {
            googleSsoEnabled: updateDto.googleSsoEnabled,
          }),
          ...(updateDto.googleAutoProvision !== undefined && {
            googleAutoProvision: updateDto.googleAutoProvision,
          }),
        } as any, // Type assertion to bypass TypeScript issue with newly added fields
        select: {
          id: true,
          name: true,
          googleSsoEnabled: true,
          googleAutoProvision: true,
          updatedAt: true,
        } as any, // Type assertion to bypass TypeScript issue with newly added fields
      });

      // Log successful configuration change
      await this.authAuditService.logGoogleSettingsUpdate(
        userId,
        tenantId,
        true,
        undefined, // IP address would need to be passed from controller
        undefined, // User agent would need to be passed from controller
        undefined,
        undefined,
        {
          previousSettings: {
            googleSsoEnabled: (currentTenant as any).googleSsoEnabled,
            googleAutoProvision: (currentTenant as any).googleAutoProvision,
          },
          newSettings: {
            googleSsoEnabled: (updatedTenant as any).googleSsoEnabled,
            googleAutoProvision: (updatedTenant as any).googleAutoProvision,
          },
          changes: updateDto,
        },
      );

      return updatedTenant;
    } catch (error) {
      // Log failed configuration change
      await this.authAuditService.logGoogleSettingsUpdate(
        userId,
        tenantId,
        false,
        undefined,
        undefined,
        'SETTINGS_UPDATE_FAILED',
        error instanceof Error ? error.message : 'Unknown error',
        {
          changes: updateDto,
        },
      );

      throw error;
    }
  }
}
