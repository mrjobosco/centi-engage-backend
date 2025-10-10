import { Injectable, Scope } from '@nestjs/common';
import type { ITenantContext } from '../database/interfaces/tenant-context.interface';

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService implements ITenantContext {
  private tenantId?: string;

  /**
   * Set the tenant ID for the current request
   * @param tenantId - The tenant identifier
   */
  setTenantId(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /**
   * Get the tenant ID for the current request
   * @returns The tenant identifier or undefined if not set
   * @throws Error if tenant context is required but not set
   */
  getTenantId(): string | undefined {
    return this.tenantId;
  }

  /**
   * Get the tenant ID and throw an error if not set
   * @returns The tenant identifier
   * @throws Error if tenant context is not set
   */
  getRequiredTenantId(): string {
    if (!this.tenantId) {
      throw new Error('Tenant context is required but not set');
    }
    return this.tenantId;
  }

  /**
   * Check if tenant context is set
   * @returns true if tenant ID is set, false otherwise
   */
  hasTenantContext(): boolean {
    return !!this.tenantId;
  }
}
