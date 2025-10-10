import { Module, forwardRef } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantIdentificationMiddleware } from './tenant-identification.middleware';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [forwardRef(() => DatabaseModule)],
  controllers: [TenantController],
  providers: [
    TenantContextService,
    TenantIdentificationMiddleware,
    TenantService,
    AuthAuditService,
  ],
  exports: [TenantContextService, TenantService],
})
export class TenantModule { }
