import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  BadRequestException,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  UseGuards,
  Query,
  UsePipes,
  ValidationPipe,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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
  SetPasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { EmailOTPService } from './services/email-otp.service';
import { AuthCookieService } from './services/auth-cookie.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { SkipEmailVerification } from './decorators/skip-email-verification.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly oauthStateService: OAuthStateService,
    private readonly googleAuthMetricsService: GoogleAuthMetricsService,
    private readonly emailOTPService: EmailOTPService,
    private readonly authCookieService: AuthCookieService,
  ) {}

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
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.registerTenantlessUser(registerDto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Headers('x-tenant-id') tenantId?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    // Call AuthService.login with optional tenantId
    const result = await this.authService.login(loginDto, tenantId);
    if (res) {
      this.authCookieService.setAuthCookies(
        res,
        {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
        loginDto.rememberMe ?? false,
      );
    }
    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = this.authCookieService.getCookie(
      req,
      this.authCookieService.refreshCookieName,
    );
    if (refreshToken) {
      await this.authService.revokeRefreshSession(refreshToken);
    }
    this.authCookieService.clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.authCookieService.getCookie(
      req,
      this.authCookieService.refreshCookieName,
    );
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const { ipAddress, userAgent } = this.extractRequestContext(req);
    const refreshed = await this.authService.refreshWithToken(
      refreshToken,
      ipAddress,
      userAgent,
    );
    this.authCookieService.setAuthCookies(
      res,
      {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
      },
      refreshed.rememberMe,
    );
    return {
      accessToken: refreshed.accessToken,
      expiresIn: refreshed.expiresIn,
    };
  }

  @Public()
  @Get('csrf')
  @HttpCode(HttpStatus.OK)
  getCsrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = this.authCookieService.generateAndSetCsrfToken(res);
    return {
      success: true,
      message: 'CSRF token generated',
      data: {
        csrfToken,
      },
    };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async profile(@CurrentUser() user: User) {
    return this.authService.getUserProfile(user.id, user.tenantId);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    const user = await this.authService.findUserByEmail(
      forgotPasswordDto.email,
      forgotPasswordDto.tenantId,
    );

    // Avoid user enumeration: return success shape even when user doesn't exist
    if (!user) {
      return {
        success: true,
        message: 'If an account exists for this email, an OTP has been sent.',
      };
    }

    const { ipAddress, userAgent } = this.extractRequestContext(req);
    const result = await this.emailOTPService.generateOTP(
      user.id,
      user.email,
      ipAddress,
      userAgent,
    );

    return {
      success: true,
      message: result.success
        ? 'If an account exists for this email, an OTP has been sent.'
        : result.message,
    };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
    @Req() req: Request,
  ) {
    const { ipAddress, userAgent } = this.extractRequestContext(req);
    await this.authService.resetPasswordWithOtp(
      resetPasswordDto.email,
      resetPasswordDto.otp,
      resetPasswordDto.password,
      resetPasswordDto.tenantId,
      ipAddress,
      userAgent,
    );

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  // Email Verification Endpoints

  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes for OTP verification
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Req() req: Request,
    @Headers('x-tenant-id') tenantId?: string,
  ) {
    const { ipAddress, userAgent } = this.extractRequestContext(req);

    // For tenant-less users, we need to find the user by email and OTP
    // Since this is a public endpoint, we'll verify using email + OTP combination
    const result = await this.emailOTPService.verifyOTPByEmail(
      verifyEmailDto.otp,
      tenantId || null, // Allow null for tenant-less users
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

  @Post('verify-email/authenticated')
  @UseGuards(JwtAuthGuard)
  @SkipEmailVerification()
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes for OTP verification
  @HttpCode(HttpStatus.OK)
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
  async googleUnlink(@CurrentUser() user: User) {
    await this.googleAuthService.unlinkGoogleAccount(user.id);
    return { message: 'Google account unlinked successfully' };
  }

  @Get('me/auth-methods')
  @UseGuards(JwtAuthGuard)
  async getAuthMethods(@CurrentUser() user: User) {
    const authMethods = await this.googleAuthService.getUserAuthMethods(
      user.id,
    );
    const needsPasswordSetup = await this.authService.needsPasswordSetup(
      user.id,
    );
    return { authMethods, needsPasswordSetup };
  }

  @Post('set-password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 requests per hour
  @HttpCode(HttpStatus.OK)
  async setPassword(
    @CurrentUser() user: User,
    @Body() setPasswordDto: SetPasswordDto,
  ) {
    await this.authService.setPassword(user.id, setPasswordDto.password);

    // Get updated auth methods
    const authMethods = await this.googleAuthService.getUserAuthMethods(
      user.id,
    );

    return {
      message: 'Password set successfully',
      authMethods,
    };
  }

  @Get('me/needs-password-setup')
  @UseGuards(JwtAuthGuard)
  async needsPasswordSetup(@CurrentUser() user: User) {
    const needsPasswordSetup = await this.authService.needsPasswordSetup(
      user.id,
    );
    return { needsPasswordSetup };
  }
}
