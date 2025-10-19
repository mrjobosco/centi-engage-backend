import { SetMetadata } from '@nestjs/common';

export const SKIP_EMAIL_VERIFICATION_KEY = 'skipEmailVerification';

/**
 * Decorator to skip email verification requirement for a route.
 * Useful for routes like email verification endpoints themselves.
 */
export const SkipEmailVerification = () =>
  SetMetadata(SKIP_EMAIL_VERIFICATION_KEY, true);
