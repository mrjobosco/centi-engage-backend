import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto, tenantId: string) {
    const { email, password } = loginDto;

    // Query user by email and tenantId
    const user = await this.prisma.user.findUnique({
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

    // Throw UnauthorizedException if user not found
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password using bcrypt.compare
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Load user's roles for JWT payload
    const roleIds = user.roles.map((userRole) => userRole.role.id);

    // Generate JWT token with userId, tenantId, and role IDs
    const payload: JwtPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      roles: roleIds,
    };

    const accessToken = this.jwtService.sign(payload);

    // Return access token
    return {
      accessToken,
    };
  }
}
