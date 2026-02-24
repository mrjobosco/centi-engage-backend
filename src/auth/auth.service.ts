import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { EmailOTPService } from './services/email-otp.service';
import { User } from '@prisma/client';
import { RefreshSessionService } from './services/refresh-session.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailOTPService: EmailOTPService,
    private readonly refreshSessionService: RefreshSessionService,
  ) {}

  private toUserResponse(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim(),
      tenantId: user.tenantId,
      emailVerified: user.emailVerified || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Register a new tenant-less user with email/password
   */
  async registerTenantlessUser(registerDto: RegisterDto): Promise<{
    user: ReturnType<AuthService['toUserResponse']>;
    accessToken: string;
    requiresVerification: boolean;
  }> {
    // Check if email already exists (for any tenant or tenant-less)
    const existingUser = await this.prisma.user.findFirst({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create tenant-less user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName || null,
        lastName: registerDto.lastName || null,
        tenantId: null, // Explicitly set to null
        authMethods: ['password'],
        emailVerified: false,
      },
    });

    // Generate JWT token for tenant-less user
    const payload: JwtPayload = {
      userId: user.id,
      tenantId: null,
      roles: [], // No roles until user joins/creates tenant
    };

    const accessToken = this.jwtService.sign(payload);

    // Send verification email
    let requiresVerification = false;
    try {
      await this.emailOTPService.generateOTP(user.id, user.email);
      requiresVerification = true;
    } catch (error) {
      this.logger.error('Failed to send verification email', error);
    }

    return {
      user: this.toUserResponse(user),
      accessToken,
      requiresVerification,
    };
  }

  /**
   * Enhanced login to handle both tenant-less and tenant-specific authentication
   */
  async login(
    loginDto: LoginDto,
    tenantId?: string,
  ): Promise<{
    user: ReturnType<AuthService['toUserResponse']>;
    accessToken: string;
    refreshToken: string;
    emailVerified: boolean;
    requiresVerification: boolean;
    hasTenant: boolean;
    expiresIn: number;
    refreshSessionId: string;
  }> {
    const { email, password, rememberMe = false } = loginDto;
    let user:
      | (User & {
          roles: Array<{
            role: {
              id: string;
              name: string;
            };
          }>;
        })
      | null;

    if (tenantId) {
      // Traditional tenant-specific login
      user = await this.prisma.user.findFirst({
        where: {
          email,
          tenantId,
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    } else {
      // Tenant-less login - find user without tenant
      user = await this.prisma.user.findFirst({
        where: {
          email,
          tenantId: null,
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userRoles = user.roles?.map((ur) => ur.role.id) || [];
    const issuedTokens = await this.issueTokensForUser({
      userId: user.id,
      tenantId: user.tenantId,
      roles: userRoles,
      rememberMe,
    });

    return {
      user: this.toUserResponse(user),
      accessToken: issuedTokens.accessToken,
      refreshToken: issuedTokens.refreshToken,
      emailVerified: user.emailVerified || false,
      requiresVerification:
        !user.emailVerified && !user.authMethods.includes('google'),
      hasTenant: user.tenantId !== null,
      expiresIn: 900,
      refreshSessionId: issuedTokens.sessionId,
    };
  }

  async findUserByEmailAndTenant(email: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        tenantId,
      },
    });
  }

  async findUserByEmail(email: string, tenantId?: string | null) {
    return this.prisma.user.findFirst({
      where: {
        email,
        ...(tenantId === undefined ? {} : { tenantId }),
      },
    });
  }

  async getUserProfile(
    userId: string,
    tenantId?: string | null,
  ): Promise<ReturnType<AuthService['toUserResponse']>> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        ...(tenantId === undefined ? {} : { tenantId }),
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.toUserResponse(user);
  }

  async refreshAccessToken(userId: string, tenantId?: string | null): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    sessionId: string;
  }> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        ...(tenantId === undefined ? {} : { tenantId }),
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userRoles = user.roles?.map((ur) => ur.role.id) || [];
    const issuedTokens = await this.issueTokensForUser({
      userId: user.id,
      tenantId: user.tenantId,
      roles: userRoles,
      rememberMe: false,
    });

    return {
      accessToken: issuedTokens.accessToken,
      refreshToken: issuedTokens.refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      sessionId: issuedTokens.sessionId,
    };
  }

  async refreshWithToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    sessionId: string;
    userId: string;
    tenantId: string | null;
    rememberMe: boolean;
  }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    if (!payload.sessionId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const validSession = await this.refreshSessionService.getValidSession(
      payload.sessionId,
      refreshToken,
    );
    if (!validSession) {
      throw new UnauthorizedException('Refresh session is invalid');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userRoles = user.roles?.map((ur) => ur.role.id) || [];
    const accessPayload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      roles: userRoles,
      tokenType: 'access',
    };

    const accessToken = this.jwtService.sign(accessPayload);
    const refreshExpiryDate = new Date(validSession.expiresAt);
    const newRefreshToken = this.signRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      roles: userRoles,
      sessionId: validSession.id,
      expiresAt: refreshExpiryDate,
    });

    const rotatedSession = await this.refreshSessionService.rotateSession({
      currentSessionId: validSession.id,
      newToken: newRefreshToken,
      newExpiresAt: refreshExpiryDate,
      ipAddress,
      userAgent,
    });

    if (!rotatedSession) {
      throw new UnauthorizedException('Unable to rotate refresh session');
    }

    const finalRefreshToken = this.signRefreshToken({
      userId: user.id,
      tenantId: user.tenantId,
      roles: userRoles,
      sessionId: rotatedSession.id,
      expiresAt: refreshExpiryDate,
    });

    await (this.prisma as any).refreshSession.update({
      where: { id: rotatedSession.id },
      data: {
        tokenHash: this.refreshSessionService.hashToken(finalRefreshToken),
      },
    });

    return {
      accessToken,
      refreshToken: finalRefreshToken,
      expiresIn: 900,
      sessionId: rotatedSession.id,
      userId: user.id,
      tenantId: user.tenantId,
      rememberMe: this.isRememberMeSession(rotatedSession.expiresAt),
    };
  }

  async revokeRefreshSession(refreshToken: string): Promise<void> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      if (!payload.sessionId) {
        return;
      }
      await this.refreshSessionService.revokeSessionById(payload.sessionId);
    } catch (error) {
      this.logger.warn('Failed to revoke refresh session', error);
    }
  }

  async resetPasswordWithOtp(
    email: string,
    otp: string,
    newPassword: string,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        ...(tenantId ? { tenantId } : {}),
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const verificationResult = await this.emailOTPService.verifyOTP(
      user.id,
      otp,
      ipAddress,
      userAgent,
    );

    if (!verificationResult.success) {
      throw new BadRequestException(verificationResult.message);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const authMethods = user.authMethods.includes('password')
      ? user.authMethods
      : [...user.authMethods, 'password'];

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        authMethods,
      },
    });
  }

  /**
   * Set password for users who don't have one (e.g., Google OAuth users)
   */
  async setPassword(userId: string, password: string): Promise<void> {
    // Get current user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { authMethods: true, password: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if user already has a password
    if (user.password && user.password.length > 0) {
      throw new ConflictException('User already has a password set');
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user with password and add 'password' to auth methods
    const updatedAuthMethods = user.authMethods.includes('password')
      ? user.authMethods
      : [...user.authMethods, 'password'];

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        authMethods: updatedAuthMethods,
      },
    });
  }

  /**
   * Check if user needs to set up a password
   */
  async needsPasswordSetup(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, authMethods: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // User needs password setup if they don't have 'password' in authMethods
    // or if their password is empty/null
    return (
      !user.authMethods.includes('password') ||
      !user.password ||
      user.password.length === 0
    );
  }

  private async issueTokensForUser(params: {
    userId: string;
    tenantId: string | null;
    roles: string[];
    rememberMe: boolean;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }> {
    const accessPayload: JwtPayload = {
      userId: params.userId,
      tenantId: params.tenantId,
      roles: params.roles,
      tokenType: 'access',
    };

    const accessToken = this.jwtService.sign(accessPayload);

    const refreshHours =
      this.configService.get<number>('config.auth.refreshExpiresHours') ?? 8;
    const rememberDays =
      this.configService.get<number>('config.auth.rememberRefreshExpiresDays') ??
      30;
    const refreshExpiryDate = new Date(
      Date.now() +
        (params.rememberMe
          ? rememberDays * 24 * 60 * 60 * 1000
          : refreshHours * 60 * 60 * 1000),
    );

    const provisionalRefreshToken = this.signRefreshToken({
      userId: params.userId,
      tenantId: params.tenantId,
      roles: params.roles,
      sessionId: 'pending',
      expiresAt: refreshExpiryDate,
    });

    const session = await this.refreshSessionService.createSession({
      userId: params.userId,
      token: provisionalRefreshToken,
      expiresAt: refreshExpiryDate,
    });

    const refreshToken = this.signRefreshToken({
      userId: params.userId,
      tenantId: params.tenantId,
      roles: params.roles,
      sessionId: session.id,
      expiresAt: refreshExpiryDate,
    });

    await (this.prisma as any).refreshSession.update({
      where: { id: session.id },
      data: {
        tokenHash: this.refreshSessionService.hashToken(refreshToken),
      },
    });

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
    };
  }

  private signRefreshToken(params: {
    userId: string;
    tenantId: string | null;
    roles: string[];
    sessionId: string;
    expiresAt: Date;
  }): string {
    const refreshPayload: JwtPayload = {
      userId: params.userId,
      tenantId: params.tenantId,
      roles: params.roles,
      tokenType: 'refresh',
      sessionId: params.sessionId,
    };
    return this.jwtService.sign(refreshPayload, {
      expiresIn: Math.max(
        Math.floor((params.expiresAt.getTime() - Date.now()) / 1000),
        1,
      ),
    });
  }

  private isRememberMeSession(expiresAt: Date): boolean {
    const refreshHours =
      this.configService.get<number>('config.auth.refreshExpiresHours') ?? 8;
    const thresholdMs = refreshHours * 60 * 60 * 1000;
    return expiresAt.getTime() - Date.now() > thresholdMs;
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('config.jwt.secret'),
      });

      if (payload.tokenType && payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token type');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
