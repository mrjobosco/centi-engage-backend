import { forwardRef, Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TenantModule } from '../tenant';

@Global()
@Module({
  imports: [forwardRef(() => TenantModule)],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
