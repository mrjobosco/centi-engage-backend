import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { AuthCookieService } from '../../auth/services/auth-cookie.service';

@Injectable()
export class CsrfProtectionMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      next();
      return;
    }

    const isCookieAuthenticated =
      Boolean(
        this.authCookieService.getCookie(
          req,
          this.authCookieService.accessCookieName,
        ),
      ) ||
      Boolean(
        this.authCookieService.getCookie(
          req,
          this.authCookieService.refreshCookieName,
        ),
      );

    if (!isCookieAuthenticated) {
      next();
      return;
    }

    if (!this.isAllowedOrigin(req)) {
      throw new ForbiddenException('Invalid request origin');
    }

    if (!this.authCookieService.validateCsrf(req)) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    next();
  }

  private isAllowedOrigin(req: Request): boolean {
    const configured =
      this.configService.get<string>('config.cors.origin') || '*';
    if (configured === '*') {
      return true;
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const source =
      typeof origin === 'string'
        ? origin
        : typeof referer === 'string'
          ? referer
          : '';
    if (!source) {
      return false;
    }

    const allowedOrigins = configured
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    return allowedOrigins.some((allowedOrigin) =>
      source.startsWith(allowedOrigin),
    );
  }
}
