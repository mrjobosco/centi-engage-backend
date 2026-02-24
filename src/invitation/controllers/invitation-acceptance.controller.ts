import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { InvitationValidationService } from '../services/invitation-validation.service';
import { InvitationService } from '../services/invitation.service';
import { InvitationAcceptanceService } from '../services/invitation-acceptance.service';
import { GoogleOAuthService } from '../../auth/services/google-oauth.service';
import { OAuthStateService } from '../../auth/services/oauth-state.service';
import { PrismaService } from '../../database/prisma.service';
import { InvitationAcceptanceDto } from '../dto/invitation-acceptance.dto';
import { InvitationValidationResponseDto } from '../dto/invitation-validation-response.dto';

@Controller('invitation-acceptance')
export class InvitationAcceptanceController {
  private readonly logger = new Logger(InvitationAcceptanceController.name);

  constructor(
    private readonly invitationValidationService: InvitationValidationService,
    private readonly invitationService: InvitationService,
    private readonly invitationAcceptanceService: InvitationAcceptanceService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly oauthStateService: OAuthStateService,
    private readonly prisma: PrismaService,
  ) { }

  @Get(':token')
  @Public()
  async validateInvitation(
    @Param('token') token: string,
  ): Promise<InvitationValidationResponseDto> {
    try {
      // Validate the token using the validation service
      const validationResult =
        await this.invitationValidationService.validateToken(token, {
          // Note: In a real application, you might want to capture IP and user agent
          // ipAddress: request.ip,
          // userAgent: request.headers['user-agent'],
        });

      if (!validationResult.isValid) {
        return {
          isValid: false,
          status: validationResult.invitation?.status || ('INVALID' as any),
          error: validationResult.reason || 'Invalid invitation token',
        };
      }

      const invitation = validationResult.invitation!;

      return {
        isValid: true,
        status: invitation.status as any,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          expiresAt: invitation.expiresAt.toISOString(),
          tenant: {
            id: invitation.tenant?.id || '',
            name: invitation.tenant?.name || '',
          },
          roles:
            invitation.roles?.map((role) => ({
              id: role.id,
              name: role.name,
            })) || [],
          message: invitation.message || undefined,
        },
      };
    } catch (error) {
      this.logger.error('Token validation failed', {
        token: token ? token.substring(0, 8) + '...' : 'null/undefined',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Token validation failed');
    }
  }

  @Get(':token/google-auth')
  @Public()
  async initiateGoogleAuth(@Param('token') token: string): Promise<{
    authUrl: string;
    state: string;
  }> {
    try {
      // First validate the invitation token
      const validationResult =
        await this.invitationValidationService.validateToken(token);

      if (!validationResult.isValid || !validationResult.invitation) {
        throw new BadRequestException(
          validationResult.reason || 'Invalid invitation token',
        );
      }

      const invitation = validationResult.invitation;

      // Check if tenant has Google SSO enabled
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: invitation.tenantId },
        select: {
          googleSsoEnabled: true,
        },
      });

      if (!tenant?.googleSsoEnabled) {
        throw new BadRequestException(
          'Google SSO is not enabled for this tenant',
        );
      }

      // Generate state with invitation token
      const state = await this.oauthStateService.generateState(
        undefined, // No user ID for invitation flow
        invitation.tenantId,
        token, // Include invitation token in state
      );

      // Generate Google OAuth URL
      const authUrl = this.googleOAuthService.generateAuthUrl(state);

      return { authUrl, state };
    } catch (error) {
      this.logger.error('Google OAuth initiation failed', {
        token: token ? token.substring(0, 8) + '...' : 'null/undefined',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to initiate Google OAuth');
    }
  }

  @Post(':token/accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Param('token') token: string,
    @Body() acceptanceDto: InvitationAcceptanceDto,
  ): Promise<{
    message: string;
    user: any;
    tenant: any;
    roles: any[];
    accessToken: string;
  }> {
    try {
      // Use the invitation acceptance service to handle the complete flow
      const result = await this.invitationAcceptanceService.acceptInvitation(
        token,
        acceptanceDto,
      );

      return result;
    } catch (error) {
      this.logger.error('Invitation acceptance failed', {
        token: token ? token.substring(0, 8) + '...' : 'null/undefined',
        authMethod: acceptanceDto.authMethod,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      throw new BadRequestException('Invitation acceptance failed');
    }
  }
}
