import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TenantManagementService } from './tenant-management.service';
import { CreateTenantForUserDto } from './dto/create-tenant-for-user.dto';
import { JoinTenantDto } from './dto/join-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkipEmailVerification } from '../auth/decorators/skip-email-verification.decorator';
import { TenantLessOnlyGuard } from './guards/tenant-less-only.guard';
import {
  TenantManagementRateLimitGuard,
  TenantManagementRateLimit,
} from './guards/tenant-management-rate-limit.guard';

interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string | null;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  roles: any[];
}

/**
 * Controller for managing tenant operations for tenant-less users
 * Handles tenant creation, joining, and status retrieval
 */
@Controller('tenant-management')
@UseGuards(JwtAuthGuard, TenantLessOnlyGuard, TenantManagementRateLimitGuard)
@SkipEmailVerification()
export class TenantManagementController {
  constructor(
    private readonly tenantManagementService: TenantManagementService,
  ) { }

  /**
   * Create a new tenant for the current user
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.3, 7.4, 7.5, 7.6, 7.7
   */
  @Post('create')
  @TenantManagementRateLimit({ operation: 'creation', skipForAdmin: true })
  @HttpCode(HttpStatus.CREATED)
  async createTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() createTenantDto: CreateTenantForUserDto,
  ) {
    return this.tenantManagementService.createTenantForUser(
      user.id,
      createTenantDto,
    );
  }

  /**
   * Join an existing tenant via invitation
   * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.3, 7.4, 7.5, 7.6, 7.7
   */
  @Post('join')
  @TenantManagementRateLimit({ operation: 'joining', skipForAdmin: true })
  @HttpCode(HttpStatus.OK)
  async joinTenant(
    @CurrentUser() user: AuthenticatedUser,
    @Body() joinTenantDto: JoinTenantDto,
  ) {
    return this.tenantManagementService.joinTenantForUser(
      user.id,
      joinTenantDto.invitationToken,
    );
  }

  /**
   * Get current user's tenant status and available invitations
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 7.3, 7.4, 7.5, 7.6, 7.7
   */
  @Get('status')
  async getTenantStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantManagementService.getUserTenantStatus(user.id);
  }
}
