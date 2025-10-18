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
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  otp: {
    expirationMinutes: parseInt(process.env.OTP_EXPIRATION_MINUTES || '30', 10),
    length: parseInt(process.env.OTP_LENGTH || '6', 10),
    rateLimitAttempts: parseInt(process.env.OTP_RATE_LIMIT_ATTEMPTS || '3', 10),
    rateLimitWindowMs: parseInt(
      process.env.OTP_RATE_LIMIT_WINDOW_MS || '3600000',
      10,
    ),
  },
}));
