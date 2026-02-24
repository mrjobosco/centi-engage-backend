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
import { TenantService } from './tenant.service';
import { RegisterTenantDto } from '../auth/dto/register-tenant.dto';
import { UpdateGoogleSettingsDto } from '../auth/dto/update-google-settings.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireEmailVerification } from '../auth/decorators/require-email-verification.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../notifications/guards/admin-role.guard';
import type { RequestUser } from '../auth/interfaces/request-with-user.interface';

@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) { }

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
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
  @RequireEmailVerification()
  async getGoogleSettings(@Param('id') tenantId: string) {
    const tenant = await this.tenantService.findById(tenantId);
    return {
      googleSsoEnabled: tenant.googleSsoEnabled,
      googleAutoProvision: tenant.googleAutoProvision,
    };
  }

  @Patch(':id/settings/google')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @RequireEmailVerification()
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
