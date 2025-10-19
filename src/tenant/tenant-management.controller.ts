import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { TenantManagementService } from './tenant-management.service';
import { CreateTenantForUserDto } from './dto/create-tenant-for-user.dto';
import { JoinTenantDto } from './dto/join-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkipEmailVerification } from '../auth/decorators/skip-email-verification.decorator';
import { TenantLessOnlyGuard } from './guards/tenant-less-only.guard';

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
@UseGuards(JwtAuthGuard, TenantLessOnlyGuard)
@SkipEmailVerification()
@ApiTags('Tenant Management')
@ApiBearerAuth()
export class TenantManagementController {
  constructor(
    private readonly tenantManagementService: TenantManagementService,
  ) { }

  /**
   * Create a new tenant for the current user
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.3, 7.4, 7.5, 7.6, 7.7
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new tenant for current user',
    description:
      'Create a new tenant and assign current user as admin. User must be tenant-less (not belong to any tenant).',
  })
  @ApiBody({ type: CreateTenantForUserDto })
  @ApiResponse({
    status: 201,
    description: 'Tenant created successfully',
    schema: {
      type: 'object',
      properties: {
        tenant: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            googleSsoEnabled: { type: 'boolean' },
            googleAutoProvision: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        accessToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'User already belongs to a tenant or invalid input',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 409,
    description: 'Tenant name already exists',
  })
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Join existing tenant via invitation',
    description:
      'Join a tenant using invitation token. User must be tenant-less and invitation must be valid.',
  })
  @ApiBody({ type: JoinTenantDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully joined tenant',
    schema: {
      type: 'object',
      properties: {
        tenant: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            googleSsoEnabled: { type: 'boolean' },
            googleAutoProvision: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        accessToken: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'User already belongs to a tenant, invitation invalid, or invitation expired',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
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
  @ApiOperation({
    summary: 'Get user tenant status',
    description:
      'Get current user tenant status and list of available invitations.',
  })
  @ApiResponse({
    status: 200,
    description: 'User tenant status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        hasTenant: { type: 'boolean' },
        tenant: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            googleSsoEnabled: { type: 'boolean' },
            googleAutoProvision: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        availableInvitations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              token: { type: 'string' },
              status: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
              tenant: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getTenantStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.tenantManagementService.getUserTenantStatus(user.id);
  }
}
