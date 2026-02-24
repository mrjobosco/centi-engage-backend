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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequireEmailVerification } from '../../auth/decorators/require-email-verification.decorator';
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

@Controller('invitations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireEmailVerification()
export class InvitationController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly managementService: InvitationManagementService,
  ) { }

  @Post()
  @Permissions('create:invitation')
  @HttpCode(HttpStatus.CREATED)
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
  async resendInvitation(
    @CurrentTenant() tenantId: string,
    @Param('id') invitationId: string,
  ): Promise<TenantInvitationWithRelations> {
    return this.invitationService.resendInvitation(invitationId, tenantId);
  }

  @Delete(':id')
  @Permissions('delete:invitation')
  @HttpCode(HttpStatus.OK)
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
  async getInvitationStatistics(@CurrentTenant() tenantId: string) {
    return await this.managementService.getInvitationStatistics(tenantId);
  }

  @Get('activity-summary')
  @Permissions('read:invitation')
  async getInvitationActivitySummary(@CurrentTenant() tenantId: string) {
    return await this.managementService.getInvitationActivitySummary(tenantId);
  }

  @Get('export/csv')
  @Permissions('read:invitation')
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
