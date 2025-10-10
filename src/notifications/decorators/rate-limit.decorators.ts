import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to skip tenant rate limiting for specific endpoints
 */
export const SkipTenantRateLimit = () =>
  SetMetadata('skipTenantRateLimit', true);

/**
 * Decorator to skip notification rate limiting for specific endpoints
 */
export const SkipNotificationRateLimit = () =>
  SetMetadata('skipNotificationRateLimit', true);

/**
 * Decorator to skip all rate limiting for specific endpoints
 */
export const SkipRateLimit = () => {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (propertyKey !== undefined && descriptor !== undefined) {
      SetMetadata('skipTenantRateLimit', true)(target, propertyKey, descriptor);
      SetMetadata('skipNotificationRateLimit', true)(
        target,
        propertyKey,
        descriptor,
      );
    }
  };
};
