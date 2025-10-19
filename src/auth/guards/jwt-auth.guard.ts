import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private reflector: Reflector,
    private tenantContext: TenantContextService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('config.jwt.secret'),
      });

      // Validate that JWT's tenant ID matches the request's tenant ID
      const requestTenantId = this.tenantContext.getTenantId();
      if (requestTenantId && payload.tenantId !== requestTenantId) {
        throw new UnauthorizedException(
          'Token tenant ID does not match request tenant ID',
        );
      }

      // Load user from database with roles and verification status
      // Handle both tenant-less (null tenantId) and tenant-bound users
      const user = await this.prisma.user.findUnique({
        where: {
          id: payload.userId,
          tenantId: payload.tenantId,
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
        throw new UnauthorizedException('User not found or invalid token');
      }

      // Get email verification status using raw query to avoid Prisma client issues
      // Handle nullable tenant_id in the query
      const verificationResult = await this.prisma.$queryRaw<
        Array<{ email_verified: boolean }>
      >`
        SELECT email_verified FROM users 
        WHERE id = ${user.id} AND (
          (tenant_id IS NULL AND ${user.tenantId} IS NULL) OR 
          tenant_id = ${user.tenantId}
        )
      `;

      const emailVerified = verificationResult?.[0]?.email_verified || false;

      // Attach user to request with verification status
      request['user'] = {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified,
        roles: user.roles.map((ur) => ur.role),
      };
    } catch (error) {
      // If it's already an UnauthorizedException, rethrow it with the original message
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // For any other error (invalid token, etc.), throw generic unauthorized
      throw new UnauthorizedException();
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
