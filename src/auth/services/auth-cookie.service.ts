import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, CookieOptions } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';

@Injectable()
export class AuthCookieService {
  private readonly logger = new Logger(AuthCookieService.name);
  private readonly warnedCookieNames = new Set<string>();

  constructor(private readonly configService: ConfigService) {}

  private get cookieDomain(): string | undefined {
    return this.configService.get<string>('config.auth.cookieDomain');
  }

  private get cookieSecure(): boolean {
    return (
      this.configService.get<boolean>('config.auth.cookieSecure') ??
      this.configService.get<string>('config.nodeEnv') === 'production'
    );
  }

  private get cookiePath(): string {
    return this.configService.get<string>('config.auth.cookiePath') || '/';
  }

  private get cookieSameSite(): 'lax' | 'strict' | 'none' {
    const sameSite =
      this.configService.get<'lax' | 'strict' | 'none'>(
        'config.auth.cookieSameSite',
      ) || 'lax';
    return sameSite;
  }

  get accessCookieName(): string {
    const configuredName =
      this.configService.get<string>('config.auth.accessCookieName') ||
      '__Host-access_token';
    return this.resolveCompatibleCookieName(
      configuredName,
      'config.auth.accessCookieName',
    );
  }

  get refreshCookieName(): string {
    const configuredName =
      this.configService.get<string>('config.auth.refreshCookieName') ||
      '__Host-refresh_token';
    return this.resolveCompatibleCookieName(
      configuredName,
      'config.auth.refreshCookieName',
    );
  }

  get csrfCookieName(): string {
    return (
      this.configService.get<string>('config.auth.csrfCookieName') ||
      'csrf-token'
    );
  }

  get csrfHeaderName(): string {
    return (
      this.configService.get<string>('config.auth.csrfHeaderName') ||
      'x-csrf-token'
    );
  }

  setAuthCookies(
    response: Response,
    tokens: {
      accessToken: string;
      refreshToken: string;
    },
    rememberMe: boolean,
  ): void {
    response.cookie(
      this.accessCookieName,
      tokens.accessToken,
      this.buildCookieOptions({
        httpOnly: true,
        maxAgeMs: 15 * 60 * 1000,
      }),
    );

    const refreshHours =
      this.configService.get<number>('config.auth.refreshExpiresHours') ?? 8;
    const rememberDays =
      this.configService.get<number>(
        'config.auth.rememberRefreshExpiresDays',
      ) ?? 30;

    const refreshMaxAgeMs = rememberMe
      ? rememberDays * 24 * 60 * 60 * 1000
      : refreshHours * 60 * 60 * 1000;

    response.cookie(
      this.refreshCookieName,
      tokens.refreshToken,
      this.buildCookieOptions({
        httpOnly: true,
        maxAgeMs: refreshMaxAgeMs,
      }),
    );
  }

  clearAuthCookies(response: Response): void {
    response.clearCookie(
      this.accessCookieName,
      this.buildCookieOptions({ httpOnly: true }),
    );
    response.clearCookie(
      this.refreshCookieName,
      this.buildCookieOptions({ httpOnly: true }),
    );
  }

  generateAndSetCsrfToken(response: Response): string {
    const token = randomBytes(32).toString('hex');
    response.cookie(
      this.csrfCookieName,
      token,
      this.buildCookieOptions({
        httpOnly: false,
        maxAgeMs: 60 * 60 * 1000,
      }),
    );
    return token;
  }

  validateCsrf(request: Request): boolean {
    const cookieToken = this.getCookie(request, this.csrfCookieName);
    const headerValue =
      request.headers[this.csrfHeaderName] ??
      request.headers[this.csrfHeaderName.toLowerCase()];
    const headerToken =
      typeof headerValue === 'string'
        ? headerValue
        : Array.isArray(headerValue)
          ? headerValue[0]
          : undefined;

    if (!cookieToken || !headerToken) {
      return false;
    }

    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);
    if (cookieBuffer.length !== headerBuffer.length) {
      return false;
    }

    return timingSafeEqual(cookieBuffer, headerBuffer);
  }

  getCookie(request: Request, name: string): string | undefined {
    const cookies = this.parseCookies(request);
    return cookies[name];
  }

  private parseCookies(request: Request): Record<string, string> {
    const typedRequest = request as Request & {
      cookies?: Record<string, string>;
    };

    if (typedRequest.cookies && typeof typedRequest.cookies === 'object') {
      return typedRequest.cookies;
    }

    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return {};
    }

    return cookieHeader
      .split(';')
      .map((part) => part.trim())
      .reduce<Record<string, string>>((acc, entry) => {
        const separatorIndex = entry.indexOf('=');
        if (separatorIndex <= 0) {
          return acc;
        }
        const key = entry.slice(0, separatorIndex).trim();
        const value = entry.slice(separatorIndex + 1).trim();
        acc[key] = decodeURIComponent(value);
        return acc;
      }, {});
  }

  private buildCookieOptions(options: {
    httpOnly: boolean;
    maxAgeMs?: number;
  }): CookieOptions {
    const cookieOptions: CookieOptions = {
      httpOnly: options.httpOnly,
      secure: this.cookieSecure,
      sameSite: this.cookieSameSite,
      path: this.cookiePath,
    };

    if (this.cookieDomain) {
      cookieOptions.domain = this.cookieDomain;
    }

    if (options.maxAgeMs !== undefined) {
      cookieOptions.maxAge = options.maxAgeMs;
    }

    return cookieOptions;
  }

  private resolveCompatibleCookieName(
    configuredName: string,
    configPath: string,
  ): string {
    const hasHostPrefix = configuredName.startsWith('__Host-');
    const hasSecurePrefix = configuredName.startsWith('__Secure-');

    if (!hasHostPrefix && !hasSecurePrefix) {
      return configuredName;
    }

    const hasDomain = Boolean(this.cookieDomain);
    const invalidHostPrefixSetup =
      hasHostPrefix &&
      (!this.cookieSecure || hasDomain || this.cookiePath !== '/');
    const invalidSecurePrefixSetup = hasSecurePrefix && !this.cookieSecure;

    if (!invalidHostPrefixSetup && !invalidSecurePrefixSetup) {
      return configuredName;
    }

    const fallbackName = configuredName
      .replace(/^__Host-/, '')
      .replace(/^__Secure-/, '');

    if (!this.warnedCookieNames.has(configuredName)) {
      this.logger.warn(
        `${configPath}="${configuredName}" is incompatible with current cookie options (secure=${this.cookieSecure}, domain=${this.cookieDomain ?? 'none'}, path=${this.cookiePath}). Using "${fallbackName}" instead.`,
      );
      this.warnedCookieNames.add(configuredName);
    }

    return fallbackName;
  }
}
