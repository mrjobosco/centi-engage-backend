import { UseGuards } from '@nestjs/common';
import { EmailVerificationGuard } from '../guards/email-verification.guard';

/**
 * Decorator to require email verification for accessing a route.
 * This guard should be applied after JWT authentication guard.
 */
export const RequireEmailVerification = () => UseGuards(EmailVerificationGuard);
