import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to skip invitation rate limiting for specific endpoints
 * Use this for internal operations or admin-only endpoints that should bypass rate limits
 */
export const SkipInvitationRateLimit = () =>
  SetMetadata('skipInvitationRateLimit', true);
