import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantContextService } from './tenant-context.service';
import { TenantIdentificationMiddleware } from './tenant-identification.middleware';
import { TenantService } from './tenant.service';
import { TenantManagementService } from './tenant-management.service';
import { TenantController } from './tenant.controller';
import { AuthAuditService } from '../auth/services/auth-audit.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    forwardRef(() => DatabaseModule),
    JwtModule.register({}), // JWT configuration will be provided by global config
  ],
  controllers: [TenantController],
  providers: [
    TenantContextService,
    TenantIdentificationMiddleware,
    TenantService,
    TenantManagementService,
    AuthAuditService,
  ],
  exports: [TenantContextService, TenantService, TenantManagementService],
})
export class TenantModule { }
