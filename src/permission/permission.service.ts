import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PermissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) { }

  /**
   * List all permissions for the current tenant
   */
  async findAll() {
    const tenantId = this.tenantContext.getRequiredTenantId();

    return this.prisma.permission.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get a permission by ID (tenant-scoped)
   */
  async findOne(id: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    const permission = await this.prisma.permission.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    return permission;
  }

  /**
   * Create a new permission with tenantId
   */
  async create(createPermissionDto: CreatePermissionDto) {
    const tenantId = this.tenantContext.getRequiredTenantId();
    const { action, subject } = createPermissionDto;

    try {
      return await this.prisma.permission.create({
        data: {
          action,
          subject,
          tenantId,
        },
      });
    } catch (error) {
      // Handle unique constraint violation for (action, subject, tenantId)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Permission with action "${action}" and subject "${subject}" already exists`,
        );
      }
      throw error;
    }
  }

  /**
   * Delete a permission and cascade to roles/users
   */
  async delete(id: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    // First verify the permission exists and belongs to the tenant
    const permission = await this.prisma.permission.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID ${id} not found`);
    }

    // Delete the permission (cascades to role_permissions and user_permissions)
    await this.prisma.permission.delete({
      where: {
        id,
      },
    });

    return { message: 'Permission deleted successfully' };
  }
}
