import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to skip Google OAuth rate limiting for specific endpoints
 *
 * @example
 * ```typescript
 * @SkipGoogleOAuthRateLimit()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 * ```
 */
export const SkipGoogleOAuthRateLimit = () =>
  SetMetadata('skipGoogleOAuthRateLimit', true);
