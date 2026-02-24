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
import { AuthCookieService } from '../services/auth-cookie.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private reflector: Reflector,
    private tenantContext: TenantContextService,
    private authCookieService: AuthCookieService,
  ) {}

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
      // Support both tenant-less (null) and tenant-bound users
      const requestTenantId = this.tenantContext.getTenantId();

      // For tenant-less users (payload.tenantId is null), allow access regardless of request tenant
      // For tenant-bound users, ensure token tenant matches request tenant (if provided)
      if (
        payload.tenantId !== null &&
        requestTenantId &&
        payload.tenantId !== requestTenantId
      ) {
        throw new UnauthorizedException(
          'Token tenant ID does not match request tenant ID',
        );
      }

      // Load user from database with roles and verification status
      // Handle both tenant-less (null tenantId) and tenant-bound users
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.userId,
          // Handle nullable tenantId properly
          ...(payload.tenantId === null
            ? { tenantId: null }
            : { tenantId: payload.tenantId }),
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

      // Get email verification status directly from user object
      const emailVerified = user.emailVerified || false;

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
    const cookieToken = this.authCookieService.getCookie(
      request,
      this.authCookieService.accessCookieName,
    );
    if (cookieToken) {
      return cookieToken;
    }

    const headerFallback =
      this.configService.get<boolean>('config.auth.headerFallback') ?? true;
    if (!headerFallback) {
      return undefined;
    }

    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
