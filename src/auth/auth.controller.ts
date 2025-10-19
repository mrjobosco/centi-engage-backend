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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './services/google-auth.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { OAuthStateService } from './services/oauth-state.service';
import { GoogleAuthMetricsService } from './services/google-auth-metrics.service';
import {
  LoginDto,
  RegisterDto,
  GoogleCallbackDto,
  GoogleLinkCallbackDto,
  VerifyEmailDto,
  ResendOTPDto,
} from './dto';
import { EmailOTPService } from './services/email-otp.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SkipEmailVerification } from './decorators/skip-email-verification.decorator';
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
    private readonly emailOTPService: EmailOTPService,
  ) { }

  /**
   * Extract IP address and user agent from request for audit logging
   */
  private extractRequestContext(req: Request): {
    ipAddress?: string;
    userAgent?: string;
  } {
    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip;

    const userAgent = req.headers['user-agent'];

    return { ipAddress, userAgent };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for registration
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register new tenant-less user',
    description:
      'Create a new user account without requiring a tenant. User can create or join tenant later.',
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'user_123' },
            email: { type: 'string', example: 'user@example.com' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            tenantId: { type: 'null', example: null },
            emailVerified: { type: 'boolean', example: false },
          },
        },
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        requiresVerification: {
          type: 'boolean',
          example: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Email already registered',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.registerTenantlessUser(registerDto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login - supports both tenant-less and tenant-specific',
    description:
      'Authenticate user. If no tenant header provided, attempts tenant-less login.',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant identifier (optional for tenant-less login)',
    required: false,
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
        emailVerified: {
          type: 'boolean',
          example: false,
        },
        requiresVerification: {
          type: 'boolean',
          example: true,
        },
        hasTenant: {
          type: 'boolean',
          example: false,
        },
      },
    },
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
    // Call AuthService.login with optional tenantId
    return this.authService.login(loginDto, tenantId);
  }

  // Email Verification Endpoints

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes for OTP verification
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with OTP',
    description:
      'Verify user email address using the 6-digit OTP sent to their email. Marks the user as verified upon success.',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant identifier',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Email verified successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid OTP or user not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Find user by email and tenant (since we don't have userId in public endpoint)
    // We'll need to modify this to work with the current user context
    // For now, let's assume we get the user ID from the request body or session
    throw new BadRequestException(
      'This endpoint requires user authentication. Please use the authenticated version.',
    );
  }

  @Post('verify-email/authenticated')
  @UseGuards(JwtAuthGuard)
  @SkipEmailVerification()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes for OTP verification
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with OTP (authenticated)',
    description:
      'Verify authenticated user email address using the 6-digit OTP sent to their email. Marks the user as verified upon success.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Email verified successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid OTP or verification failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async verifyEmailAuthenticated(
    @Body() verifyEmailDto: VerifyEmailDto,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const { ipAddress, userAgent } = this.extractRequestContext(req);

    const result = await this.emailOTPService.verifyOTP(
      user.id,
      verifyEmailDto.otp,
      ipAddress,
      userAgent,
    );

    return {
      success: result.success,
      message: result.message,
      ...(result.remainingAttempts !== undefined && {
        remainingAttempts: result.remainingAttempts,
      }),
    };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour for OTP resend
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP to email',
    description:
      'Resend a new OTP to the specified email address. Invalidates any existing OTP for that user.',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant identifier',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'OTP sent successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid email or user not found',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async resendOTP(
    @Body() resendOTPDto: ResendOTPDto,
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    if (!tenantId) {
      throw new BadRequestException('Tenant ID is required');
    }

    // Find user by email and tenant
    const user = await this.authService.findUserByEmailAndTenant(
      resendOTPDto.email,
      tenantId,
    );
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const { ipAddress, userAgent } = this.extractRequestContext(req);
    const result = await this.emailOTPService.resendOTP(
      user.id,
      ipAddress,
      userAgent,
    );

    return {
      success: result.success,
      message: result.message,
      ...(result.retryAfter !== undefined && { retryAfter: result.retryAfter }),
    };
  }

  @Post('resend-otp/authenticated')
  @UseGuards(JwtAuthGuard)
  @SkipEmailVerification()
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour for OTP resend
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend OTP (authenticated)',
    description:
      'Resend a new OTP to the authenticated user email address. Invalidates any existing OTP for that user.',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'OTP sent successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Resend failed',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Authentication required',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async resendOTPAuthenticated(@CurrentUser() user: User, @Req() req: Request) {
    const { ipAddress, userAgent } = this.extractRequestContext(req);
    const result = await this.emailOTPService.resendOTP(
      user.id,
      ipAddress,
      userAgent,
    );

    return {
      success: result.success,
      message: result.message,
      ...(result.retryAfter !== undefined && { retryAfter: result.retryAfter }),
    };
  }

  // Google OAuth Endpoints

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute for OAuth initiation
  @Get('google')
  @ApiOperation({
    summary: 'Initiate Google OAuth - supports tenant-less registration',
    description:
      'Start Google OAuth flow. If no tenant header provided, creates tenant-less user.',
  })
  @ApiHeader({
    name: 'x-tenant-id',
    description: 'Tenant identifier (optional for tenant-less OAuth)',
    required: false,
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
    status: 403,
    description:
      'Forbidden - Google SSO not enabled for tenant (tenant-specific flow only)',
  })
  async googleAuth(@Headers('x-tenant-id') tenantId?: string) {
    if (tenantId) {
      // Verify tenant has Google SSO enabled (throws exception if disabled)
      await this.googleAuthService.validateTenantGoogleSSO(tenantId);
    }

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
      'Handle Google OAuth callback. Creates tenant-less user if no tenant context.',
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
    description:
      'Forbidden - Google SSO not enabled (tenant-specific flow only)',
  })
  async googleAuthCallback(@Query() callbackDto: GoogleCallbackDto) {
    const { code, state } = callbackDto;

    // Start timing OAuth callback processing
    const callbackTimer =
      this.googleAuthMetricsService.startOAuthCallbackTimer(state);

    try {
      // Validate state parameter
      const stateData = await this.oauthStateService.validateState(state);
      if (stateData === null) {
        callbackTimer(false);
        throw new BadRequestException('Invalid or expired state parameter');
      }

      // Exchange code for tokens
      const { idToken } =
        await this.googleOAuthService.exchangeCodeForTokens(code);

      // Verify and extract profile from ID token
      const googleProfile =
        await this.googleOAuthService.verifyIdToken(idToken);

      // Handle authentication (tenant-less or tenant-specific)
      const result = await this.googleAuthService.authenticateWithGoogle(
        googleProfile,
        stateData.tenantId,
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
