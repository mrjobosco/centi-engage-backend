import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { EmailOTPService } from './services/email-otp.service';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailOTPService: EmailOTPService,
  ) { }

  /**
   * Register a new tenant-less user with email/password
   */
  async registerTenantlessUser(registerDto: RegisterDto): Promise<{
    user: Omit<User, 'password'>;
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
        email_verified: false,
      } as any,
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
      console.error('Failed to send verification email:', error);
    }

    const { password, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
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
    accessToken: string;
    emailVerified: boolean;
    requiresVerification: boolean;
    hasTenant: boolean;
  }> {
    const { email, password } = loginDto;
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
      user = await this.prisma.user.findUnique({
        where: {
          email_tenantId: {
            email,
            tenantId,
          },
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

    // Generate JWT token
    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      roles: user.roles?.map((ur) => ur.role.id) || [],
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      emailVerified: (user as any).email_verified || false,
      requiresVerification:
        !(user as any).email_verified && !user.authMethods.includes('google'),
      hasTenant: user.tenantId !== null,
    };
  }

  async findUserByEmailAndTenant(email: string, tenantId: string) {
    return this.prisma.user.findUnique({
      where: {
        email_tenantId: {
          email,
          tenantId,
        },
      },
    });
  }
}
