import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { OAuthStateService } from './services/oauth-state.service';
import { GoogleAuthMetricsService } from './services/google-auth-metrics.service';
import { LoginDto, GoogleCallbackDto, GoogleLinkCallbackDto } from './dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { User } from '@prisma/client';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly oauthStateService: OAuthStateService,
    private readonly googleAuthMetricsService: GoogleAuthMetricsService,
  ) { }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description:
      'Authenticate a user with email and password. Returns a JWT access token.',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant identifier',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Missing tenant ID',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid credentials',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    // Get tenant ID from header (middleware is excluded for login endpoint)
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Call AuthService.login
    return this.authService.login(loginDto, tenantId);
  }

  // Google OAuth Endpoints

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute for OAuth initiation
  @Get('google')
  @ApiOperation({
    summary: 'Initiate Google OAuth flow',
    description:
      'Initiates Google OAuth authentication flow. Returns authorization URL and state parameter.',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant identifier',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'OAuth flow initiated successfully',
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
    description: 'Bad request - Missing tenant ID',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Google SSO not enabled for tenant',
  })
  async googleAuth(@Headers('x-tenant-id') tenantId?: string) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Verify tenant has Google SSO enabled (throws exception if disabled)
    await this.googleAuthService.validateTenantGoogleSSO(tenantId);

    // Generate state for CSRF protection
    const state = await this.oauthStateService.generateState(
      undefined,
      tenantId,
    );

    // Generate Google OAuth URL
    const authUrl = this.googleOAuthService.generateAuthUrl(state);

    return { authUrl, state };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute for OAuth callback
  @Get('google/callback')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Allow extra properties beyond the defined ones
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  )
  @ApiOperation({
    summary: 'Complete Google OAuth flow',
    description:
      'Completes Google OAuth authentication flow. Exchanges authorization code for JWT token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid callback data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid state or authorization code',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Google SSO not enabled or user not allowed',
  })
  async googleAuthCallback(@Query() callbackDto: GoogleCallbackDto) {
    const { code, state } = callbackDto;

    // Start timing OAuth callback processing
    const callbackTimer =
      this.googleAuthMetricsService.startOAuthCallbackTimer(state);

    try {
      // Validate state parameter
      const isValidState = await this.oauthStateService.validateState(state);
      if (isValidState === null) {
        callbackTimer(false);
        throw new BadRequestException('Invalid or expired state parameter');
      }

      // Exchange code for tokens
      const { idToken } =
        await this.googleOAuthService.exchangeCodeForTokens(code);

      // Verify and extract profile from ID token
      const googleProfile =
        await this.googleOAuthService.verifyIdToken(idToken);

      // Handle authentication
      const result = await this.googleAuthService.authenticateWithGoogle(
        googleProfile,
        isValidState.tenantId!,
      );

      callbackTimer(true);
      return result;
    } catch (error) {
      callbackTimer(false);
      throw error;
    }
  }

  @Get('google/link')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for account linking
  @ApiOperation({
    summary: 'Initiate Google account linking',
    description:
      'Initiates Google account linking flow for authenticated users. Returns authorization URL and state parameter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account linking flow initiated successfully',
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
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  async googleLink(@CurrentUser() user: User) {
    // Generate state with user ID for linking flow
    const state = await this.oauthStateService.generateState(user.id);

    // Generate Google OAuth URL for linking
    const authUrl = this.googleOAuthService.generateAuthUrl(state);

    return { authUrl, state };
  }

  @Post('google/link/callback')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for linking callback
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete Google account linking',
    description:
      'Completes Google account linking flow. Links Google account to authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Google account linked successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Google account linked successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid callback data or email mismatch',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid state or authorization code',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Google account already linked to another user',
  })
  async googleLinkCallback(
    @CurrentUser() user: User,
    @Body() callbackDto: GoogleLinkCallbackDto,
  ) {
    const { code, state } = callbackDto;

    // Validate state parameter with user ID
    const isValidState = await this.oauthStateService.validateState(
      state,
      user.id,
    );
    if (!isValidState) {
      throw new BadRequestException('Invalid or expired state parameter');
    }

    // Exchange code for tokens
    const { idToken } =
      await this.googleOAuthService.exchangeCodeForTokens(code);

    // Verify and extract profile from ID token
    const googleProfile = await this.googleOAuthService.verifyIdToken(idToken);

    // Link Google account to user
    await this.googleAuthService.linkGoogleAccount(user.id, googleProfile);

    return { message: 'Google account linked successfully' };
  }

  @Post('google/unlink')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for unlinking
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unlink Google account',
    description:
      'Unlinks Google account from authenticated user. Requires at least one other authentication method.',
  })
  @ApiResponse({
    status: 200,
    description: 'Google account unlinked successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Google account unlinked successfully',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Cannot unlink only authentication method',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - Google account not linked',
  })
  async googleUnlink(@CurrentUser() user: User) {
    await this.googleAuthService.unlinkGoogleAccount(user.id);
    return { message: 'Google account unlinked successfully' };
  }

  @Get('me/auth-methods')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get user authentication methods',
    description:
      'Returns the available authentication methods for the authenticated user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication methods retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        authMethods: {
          type: 'array',
          items: {
            type: 'string',
          },
          example: ['password', 'google'],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - User not found',
  })
  async getAuthMethods(@CurrentUser() user: User) {
    const authMethods = await this.googleAuthService.getUserAuthMethods(
      user.id,
    );
    return { authMethods };
  }
}
