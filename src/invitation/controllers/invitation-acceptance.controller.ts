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
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { InvitationValidationService } from '../services/invitation-validation.service';
import { InvitationService } from '../services/invitation.service';
import { InvitationAcceptanceService } from '../services/invitation-acceptance.service';
import { GoogleOAuthService } from '../../auth/services/google-oauth.service';
import { OAuthStateService } from '../../auth/services/oauth-state.service';
import { PrismaService } from '../../database/prisma.service';
import { InvitationAcceptanceDto } from '../dto/invitation-acceptance.dto';
import { InvitationValidationResponseDto } from '../dto/invitation-validation-response.dto';

@ApiTags('Invitation Acceptance')
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
  @ApiOperation({
    summary: 'Validate an invitation token',
    description:
      'Validates an invitation token and returns invitation details if valid. This endpoint is public and does not require authentication.',
  })
  @ApiParam({
    name: 'token',
    description: 'Invitation token from the invitation URL',
    example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
  })
  @ApiResponse({
    status: 200,
    description: 'Token validation result',
    type: InvitationValidationResponseDto,
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            isValid: { type: 'boolean', example: true },
            status: { type: 'string', example: 'PENDING' },
            invitation: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'clm123abc456def789' },
                email: { type: 'string', example: 'user@example.com' },
                expiresAt: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-12-31T23:59:59.000Z',
                },
                tenant: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', example: 'clm987zyx654wvu321' },
                    name: { type: 'string', example: 'Acme Corporation' },
                  },
                },
                roles: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'clm456def789ghi012' },
                      name: { type: 'string', example: 'Team Member' },
                    },
                  },
                },
                message: {
                  type: 'string',
                  example: 'Welcome to our team!',
                  nullable: true,
                },
              },
            },
          },
        },
        {
          type: 'object',
          properties: {
            isValid: { type: 'boolean', example: false },
            status: { type: 'string', example: 'EXPIRED' },
            error: {
              type: 'string',
              example: 'Invitation has expired',
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid token format',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid token format' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Initiate Google OAuth for invitation acceptance',
    description:
      'Initiates Google OAuth flow for invitation acceptance. Returns authorization URL and state parameter.',
  })
  @ApiParam({
    name: 'token',
    description: 'Invitation token from the invitation URL',
    example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
  })
  @ApiResponse({
    status: 200,
    description: 'Google OAuth flow initiated successfully',
    schema: {
      type: 'object',
      properties: {
        authUrl: {
          type: 'string',
          example: 'https://accounts.google.com/oauth/authorize?...',
        },
        state: {
          type: 'string',
          example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid invitation token',
  })
  @ApiResponse({
    status: 404,
    description: 'Invitation not found',
  })
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
  @ApiOperation({
    summary: 'Accept an invitation',
    description:
      'Accepts an invitation and creates a user account with the specified authentication method. This endpoint is public and does not require authentication.',
  })
  @ApiParam({
    name: 'token',
    description: 'Invitation token from the invitation URL',
    example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
  })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Invitation accepted successfully',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clm789ghi012jkl345' },
            email: { type: 'string', example: 'user@example.com' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            tenantId: { type: 'string', example: 'clm987zyx654wvu321' },
          },
        },
        tenant: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clm987zyx654wvu321' },
            name: { type: 'string', example: 'Acme Corporation' },
            subdomain: { type: 'string', example: 'acme' },
          },
        },
        roles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'clm456def789ghi012' },
              name: { type: 'string', example: 'Team Member' },
            },
          },
        },
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          description: 'JWT access token for immediate login',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation errors or invitation issues',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          oneOf: [
            { type: 'string', example: 'Invitation has expired' },
            { type: 'string', example: 'Invitation has already been accepted' },
            {
              type: 'array',
              items: { type: 'string' },
              example: [
                'password must be longer than or equal to 8 characters',
              ],
            },
          ],
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
    status: 409,
    description: 'Conflict - user already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example: 'User with this email already exists in the tenant',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
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
