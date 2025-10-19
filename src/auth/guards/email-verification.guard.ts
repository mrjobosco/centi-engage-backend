import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { EmailVerificationRequiredException } from '../exceptions/email-verification-required.exception';

const SKIP_EMAIL_VERIFICATION_KEY = 'skipEmailVerification';

@Injectable()
export class EmailVerificationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked to skip email verification
    const skipEmailVerification = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipEmailVerification) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user is attached to request, let other guards handle authentication
    if (!user) {
      return true;
    }

    // Check if user's email is verified using raw query to avoid Prisma client issues
    const result = await this.prisma.$queryRaw<
      Array<{ email_verified: boolean }>
    >`
      SELECT email_verified FROM users 
      WHERE id = ${user.id} AND tenant_id = ${user.tenantId}
    `;

    if (!result || result.length === 0) {
      throw new EmailVerificationRequiredException('User not found');
    }

    const isEmailVerified = result[0].email_verified;
    if (!isEmailVerified) {
      throw new EmailVerificationRequiredException(
        'Please verify your email address before accessing this resource. Check your email for the verification code.',
      );
    }

    return true;
  }
}
