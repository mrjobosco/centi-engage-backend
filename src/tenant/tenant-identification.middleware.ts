import {
  Injectable,
  NestMiddleware,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantIdentificationMiddleware implements NestMiddleware {
  private readonly tenantHeaderName: string;
  private readonly enableSubdomainRouting: boolean;

  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly configService: ConfigService,
  ) {
    this.tenantHeaderName =
      this.configService.get<string>('tenant.headerName') || 'x-tenant-id';
    this.enableSubdomainRouting =
      this.configService.get<boolean>('tenant.enableSubdomainRouting') || false;
  }

  use(req: Request, res: Response, next: NextFunction) {
    let tenantId: string | undefined;

    // First, try to get tenant ID from header
    tenantId = req.headers[this.tenantHeaderName] as string;

    // If not found in header and subdomain routing is enabled, try to extract from hostname
    if (!tenantId && this.enableSubdomainRouting) {
      tenantId = this.extractTenantFromSubdomain(req.hostname);
    }

    // Store tenant context (can be null for tenant-less requests)
    if (tenantId) {
      this.tenantContextService.setTenantId(tenantId);
    }

    // Store tenant context information in request for guards to use
    req.tenantContext = {
      tenantId: tenantId || null,
      isTenantRequired: false, // Will be set by guards if needed
    };

    next();
  }

  /**
   * Extract tenant ID from subdomain
   * Assumes format: {tenantId}.domain.com
   * @param hostname - The request hostname
   * @returns The tenant ID or undefined if not found
   */
  private extractTenantFromSubdomain(hostname: string): string | undefined {
    // Skip localhost and IP addresses
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
    ) {
      return undefined;
    }

    // Split hostname by dots
    const parts = hostname.split('.');

    // If there are at least 3 parts (subdomain.domain.tld), extract the first part
    if (parts.length >= 3) {
      return parts[0];
    }

    return undefined;
  }
}
