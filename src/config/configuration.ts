import { registerAs } from '@nestjs/config';

export default registerAs('config', () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '15m',
  },
  auth: {
    headerFallback: process.env.AUTH_HEADER_FALLBACK !== 'false',
    cookieDomain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    cookieSecure:
      process.env.AUTH_COOKIE_SECURE === undefined
        ? (process.env.NODE_ENV || 'development') === 'production'
        : process.env.AUTH_COOKIE_SECURE === 'true',
    cookieSameSite:
      (process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase() === 'strict'
        ? 'strict'
        : (process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase() === 'none'
          ? 'none'
          : 'lax',
    cookiePath: process.env.AUTH_COOKIE_PATH || '/',
    accessCookieName:
      process.env.AUTH_ACCESS_COOKIE_NAME || '__Host-access_token',
    refreshCookieName:
      process.env.AUTH_REFRESH_COOKIE_NAME || '__Host-refresh_token',
    csrfCookieName: process.env.AUTH_CSRF_COOKIE_NAME || 'csrf-token',
    csrfHeaderName: process.env.AUTH_CSRF_HEADER_NAME || 'x-csrf-token',
    refreshExpiresHours: parseInt(
      process.env.AUTH_REFRESH_EXPIRES_HOURS || '8',
      10,
    ),
    rememberRefreshExpiresDays: parseInt(
      process.env.AUTH_REMEMBER_REFRESH_DAYS || '30',
      10,
    ),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    linkCallbackUrl: process.env.GOOGLE_LINK_CALLBACK_URL,
  },
  tenant: {
    headerName: process.env.TENANT_HEADER_NAME || 'x-tenant-id',
    enableSubdomainRouting: process.env.ENABLE_SUBDOMAIN_ROUTING === 'true',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://:redis_password@redis:6379',
  },
  otp: {
    expirationMinutes: parseInt(process.env.OTP_EXPIRATION_MINUTES || '30', 10),
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
    rateLimitAttempts: parseInt(process.env.OTP_RATE_LIMIT_ATTEMPTS || '3', 10),
    rateLimitWindowMs: parseInt(
      process.env.OTP_RATE_LIMIT_WINDOW_MS || '3600000',
      10,
    ),
    emailTemplateId: process.env.EMAIL_OTP_TEMPLATE_ID || 'otp-verification',
  },
}));
