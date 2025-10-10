import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTenantScopingMiddleware } from './prisma-tenant.middleware';
import { TenantContextService } from '../tenant/tenant-context.service';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Optional()
    private readonly tenantContext?: TenantContextService,
  ) {
    super({
      log: ['error', 'warn'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Register tenant-scoping middleware if tenant context is available
    if (this.tenantContext) {
      (this as any).$use(createTenantScopingMiddleware(this.tenantContext));
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
