import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ConflictException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { RegisterTenantDto } from '../auth/dto/register-tenant.dto';
import { UpdateGoogleSettingsDto } from '../auth/dto/update-google-settings.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../notifications/guards/admin-role.guard';
import type { RequestUser } from '../auth/interfaces/request-with-user.interface';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new tenant',
    description:
      'Create a new tenant with an admin user, default roles, and permissions. This endpoint does not require authentication.',
  })
  @ApiResponse({
    status: 201,
    description: 'Tenant created successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Tenant created successfully' },
        data: {
          type: 'object',
          properties: {
            tenant: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                subdomain: { type: 'string', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
            adminUser: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                tenantId: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Email or tenant name already exists',
  })
  async register(@Body() registerTenantDto: RegisterTenantDto) {
    try {
      const result = await this.tenantService.createTenant({
        tenantName: registerTenantDto.tenantName,
        adminEmail: registerTenantDto.adminEmail,
        adminPassword: registerTenantDto.adminPassword,
        adminFirstName: registerTenantDto.adminFirstName,
        adminLastName: registerTenantDto.adminLastName,
      });

      return {
        message: 'Tenant created successfully',
        data: result,
      };
    } catch (error) {
      // Handle duplicate tenant name or email errors
      if (error instanceof ConflictException) {
        throw error;
      }

      // Handle Prisma unique constraint violations
      if (error && typeof error === 'object' && 'code' in error) {
        if (error.code === 'P2002') {
          const meta = 'meta' in error ? error.meta : undefined;
          const target =
            meta && typeof meta === 'object' && 'target' in meta
              ? meta.target
              : undefined;
          if (target && Array.isArray(target)) {
            if (target.includes('email')) {
              throw new ConflictException(
                'Email already exists for this tenant',
              );
            }
            if (target.includes('name')) {
              throw new ConflictException('Tenant name already exists');
            }
          }
          throw new ConflictException('Duplicate entry detected');
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  @Get(':id/settings/google')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Google SSO settings for tenant',
    description:
      'Retrieve current Google SSO configuration for the specified tenant. Requires admin role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Google SSO settings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        googleSsoEnabled: { type: 'boolean', example: true },
        googleAutoProvision: { type: 'boolean', example: false },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  async getGoogleSettings(@Param('id') tenantId: string) {
    const tenant = await this.tenantService.findById(tenantId);
    return {
      googleSsoEnabled: tenant.googleSsoEnabled,
      googleAutoProvision: tenant.googleAutoProvision,
    };
  }

  @Patch(':id/settings/google')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update Google SSO settings for tenant',
    description:
      'Update Google SSO configuration for the specified tenant. Requires admin role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Google SSO settings updated successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Google settings updated successfully',
        },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            googleSsoEnabled: { type: 'boolean' },
            googleAutoProvision: { type: 'boolean' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin role required',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant not found',
  })
  async updateGoogleSettings(
    @Param('id') tenantId: string,
    @Body() updateDto: UpdateGoogleSettingsDto,
    @CurrentUser() user: RequestUser,
  ) {
    const updatedTenant = await this.tenantService.updateGoogleSettings(
      tenantId,
      updateDto,
      user.id,
    );
    return {
      message: 'Google settings updated successfully',
      data: updatedTenant,
    };
  }
}
