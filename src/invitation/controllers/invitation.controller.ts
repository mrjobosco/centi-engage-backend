import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../auth/decorators/current-tenant.decorator';
import { InvitationService } from '../services/invitation.service';
import { InvitationManagementService } from '../services/invitation-management.service';
import type { BulkInvitationDto } from '../services/invitation-management.service';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { InvitationFilterDto } from '../dto/invitation-filter.dto';
import { TenantInvitationWithRelations } from '../interfaces';

interface AuthenticatedUser {
  id: string;
  email: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  roles: Array<{ id: string; name: string }>;
}

@ApiTags('Invitations')
@ApiBearerAuth()
@Controller('invitations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvitationController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly managementService: InvitationManagementService,
  ) { }

  @Post()
  @Permissions('create:invitation')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new tenant invitation',
    description:
      'Creates a new invitation for a user to join the tenant with specified roles. Requires create:invitation permission.',
  })
  @ApiResponse({
    status: 201,
    description: 'Invitation created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'clm123abc456def789' },
        tenantId: { type: 'string', example: 'clm987zyx654wvu321' },
        email: { type: 'string', example: 'newuser@example.com' },
        token: {
          type: 'string',
          example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
        },
        invitedBy: { type: 'string', example: 'clm456def789ghi012' },
        expiresAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-12-31T23:59:59.000Z',
        },
        status: { type: 'string', example: 'PENDING' },
        message: {
          type: 'string',
          example: 'Welcome to our team!',
          nullable: true,
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-01T00:00:00.000Z',
        },
        updatedAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-01T00:00:00.000Z',
        },
        tenant: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            subdomain: { type: 'string' },
          },
        },
        inviter: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
        roles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation errors or business rule violations',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          oneOf: [
            { type: 'string', example: 'Invalid role IDs for this tenant' },
            {
              type: 'array',
              items: { type: 'string' },
              example: ['email must be an email'],
            },
          ],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - invitation already exists for this email',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example: 'A pending invitation already exists for this email address',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'Missing required permissions: create:invitation',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  async createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentTenant() tenantId: string,
    @Body() createInvitationDto: CreateInvitationDto,
  ): Promise<TenantInvitationWithRelations> {
    return this.invitationService.createInvitation(
      tenantId,
      user.id,
      createInvitationDto,
    );
  }

  @Get()
  @Permissions('read:invitation')
  @ApiOperation({
    summary: 'Get tenant invitations with filtering and pagination',
    description:
      'Retrieves invitations for the current tenant with optional filtering and pagination. Requires read:invitation permission.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'],
    description: 'Filter by invitation status',
  })
  @ApiQuery({
    name: 'email',
    required: false,
    type: String,
    description: 'Filter by recipient email (partial match)',
  })
  @ApiQuery({
    name: 'invitedBy',
    required: false,
    type: String,
    description: 'Filter by inviter user ID',
  })
  @ApiQuery({
    name: 'createdAfter',
    required: false,
    type: String,
    description: 'Filter invitations created after this date (ISO string)',
  })
  @ApiQuery({
    name: 'createdBefore',
    required: false,
    type: String,
    description: 'Filter invitations created before this date (ISO string)',
  })
  @ApiQuery({
    name: 'expiresAfter',
    required: false,
    type: String,
    description: 'Filter invitations expiring after this date (ISO string)',
  })
  @ApiQuery({
    name: 'expiresBefore',
    required: false,
    type: String,
    description: 'Filter invitations expiring before this date (ISO string)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination (1-based)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page (1-100)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'expiresAt', 'email', 'status'],
    description: 'Sort field',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitations retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        invitations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              tenantId: { type: 'string' },
              email: { type: 'string' },
              token: { type: 'string' },
              invitedBy: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
              acceptedAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              cancelledAt: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
              status: { type: 'string' },
              message: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              tenant: { type: 'object' },
              inviter: { type: 'object' },
              roles: { type: 'array', items: { type: 'object' } },
            },
          },
        },
        total: { type: 'number', example: 50 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 3 },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async getInvitations(
    @CurrentTenant() tenantId: string,
    @Query() filters: InvitationFilterDto,
  ): Promise<{
    invitations: TenantInvitationWithRelations[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.invitationService.getInvitations(tenantId, filters);
  }

  @Post(':id/resend')
  @Permissions('update:invitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend an invitation',
    description:
      'Resends an existing invitation by generating a new token and extending the expiration date. Requires update:invitation permission.',
  })
  @ApiParam({
    name: 'id',
    description: 'Invitation ID',
    example: 'clm123abc456def789',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation resent successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        email: { type: 'string' },
        token: { type: 'string', description: 'New token generated' },
        invitedBy: { type: 'string' },
        expiresAt: {
          type: 'string',
          format: 'date-time',
          description: 'Extended expiration date',
        },
        status: { type: 'string', example: 'PENDING' },
        message: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        tenant: { type: 'object' },
        inviter: { type: 'object' },
        roles: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invitation cannot be resent',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Cannot resend invitation with status: ACCEPTED',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Invitation not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async resendInvitation(
    @CurrentTenant() tenantId: string,
    @Param('id') invitationId: string,
  ): Promise<TenantInvitationWithRelations> {
    return this.invitationService.resendInvitation(invitationId, tenantId);
  }

  @Delete(':id')
  @Permissions('delete:invitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an invitation',
    description:
      'Cancels a pending invitation, preventing it from being accepted. Requires delete:invitation permission.',
  })
  @ApiParam({
    name: 'id',
    description: 'Invitation ID',
    example: 'clm123abc456def789',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenantId: { type: 'string' },
        email: { type: 'string' },
        token: { type: 'string' },
        invitedBy: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
        acceptedAt: { type: 'string', format: 'date-time', nullable: true },
        cancelledAt: {
          type: 'string',
          format: 'date-time',
          description: 'Timestamp when invitation was cancelled',
        },
        status: { type: 'string', example: 'CANCELLED' },
        message: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invitation cannot be cancelled',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Cannot cancel invitation with status: ACCEPTED',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async cancelInvitation(
    @CurrentTenant() tenantId: string,
    @Param('id') invitationId: string,
  ): Promise<{ message: string; invitation: any }> {
    const invitation = await this.invitationService.cancelInvitation(
      invitationId,
      tenantId,
    );
    return {
      message: 'Invitation cancelled successfully',
      invitation,
    };
  }

  @Post('bulk')
  @Permissions('create:invitation')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create multiple invitations in bulk',
    description: 'Creates multiple tenant invitations at once for efficiency',
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk invitations created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async createBulkInvitations(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() bulkDto: BulkInvitationDto,
  ) {
    return await this.managementService.createBulkInvitations(
      tenantId,
      user.id,
      bulkDto,
    );
  }

  @Post('bulk/cancel')
  @Permissions('delete:invitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel multiple invitations in bulk',
    description: 'Cancels multiple pending invitations at once',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk cancellation completed',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async cancelBulkInvitations(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { invitationIds: string[] },
  ) {
    return await this.managementService.cancelBulkInvitations(
      tenantId,
      body.invitationIds,
      user.id,
    );
  }

  @Post('bulk/resend')
  @Permissions('update:invitation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend multiple invitations in bulk',
    description: 'Resends multiple pending invitations at once',
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk resend completed',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async resendBulkInvitations(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { invitationIds: string[] },
  ) {
    return await this.managementService.resendBulkInvitations(
      tenantId,
      body.invitationIds,
      user.id,
    );
  }

  @Get('statistics')
  @Permissions('read:invitation')
  @ApiOperation({
    summary: 'Get invitation statistics',
    description: 'Returns comprehensive invitation statistics and analytics',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async getInvitationStatistics(@CurrentTenant() tenantId: string) {
    return await this.managementService.getInvitationStatistics(tenantId);
  }

  @Get('activity-summary')
  @Permissions('read:invitation')
  @ApiOperation({
    summary: 'Get invitation activity summary',
    description: 'Returns recent invitation activity for dashboard display',
  })
  @ApiResponse({
    status: 200,
    description: 'Activity summary retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async getInvitationActivitySummary(@CurrentTenant() tenantId: string) {
    return await this.managementService.getInvitationActivitySummary(tenantId);
  }

  @Get('export/csv')
  @Permissions('read:invitation')
  @ApiOperation({
    summary: 'Export invitations as CSV',
    description: 'Exports invitation data in CSV format for reporting',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by invitation status',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter by start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter by end date (ISO string)',
  })
  @ApiQuery({
    name: 'includeExpired',
    required: false,
    description: 'Include expired invitations',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV export generated successfully',
    headers: {
      'Content-Type': {
        description: 'text/csv',
      },
      'Content-Disposition': {
        description: 'attachment; filename="invitations.csv"',
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async exportInvitationsAsCSV(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const options = {
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeExpired: includeExpired === 'true',
    };

    const csvContent = await this.managementService.exportInvitationReportAsCSV(
      tenantId,
      options,
    );

    return {
      content: csvContent,
      filename: `invitations-${tenantId}-${new Date().toISOString().split('T')[0]}.csv`,
      contentType: 'text/csv',
    };
  }

  @Get('report')
  @Permissions('read:invitation')
  @ApiOperation({
    summary: 'Generate invitation report',
    description: 'Generates a comprehensive invitation report with statistics',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by invitation status',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filter by start date (ISO string)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filter by end date (ISO string)',
  })
  @ApiQuery({
    name: 'includeExpired',
    required: false,
    description: 'Include expired invitations',
  })
  @ApiResponse({
    status: 200,
    description: 'Report generated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async generateInvitationReport(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeExpired') includeExpired?: string,
  ) {
    const options = {
      status: status as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeExpired: includeExpired === 'true',
    };

    return await this.managementService.generateInvitationReport(
      tenantId,
      options,
    );
  }
}
