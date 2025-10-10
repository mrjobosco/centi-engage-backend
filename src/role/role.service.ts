import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsToRolesDto } from './dto/assign-permissions.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class RoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * List all roles for the current tenant
   */
  async findAll() {
    const tenantId = this.tenantContext.getRequiredTenantId();

    return this.prisma.role.findMany({
      where: {
        tenantId,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get a role by ID with permissions (tenant-scoped)
   */
  async findOne(id: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    const role = await this.prisma.role.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    return role;
  }

  /**
   * Create a new role with tenantId
   */
  async create(createRoleDto: CreateRoleDto) {
    const tenantId = this.tenantContext.getRequiredTenantId();
    const { name } = createRoleDto;

    try {
      return await this.prisma.role.create({
        data: {
          name,
          tenantId,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    } catch (error) {
      // Handle unique constraint violation for (name, tenantId)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Role with name "${name}" already exists in this tenant`,
        );
      }
      throw error;
    }
  }

  /**
   * Update role name
   */
  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const tenantId = this.tenantContext.getRequiredTenantId();
    const { name } = updateRoleDto;

    // First verify the role exists and belongs to the tenant
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    try {
      return await this.prisma.role.update({
        where: {
          id,
        },
        data: {
          name,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    } catch (error) {
      // Handle unique constraint violation for (name, tenantId)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Role with name "${name}" already exists in this tenant`,
        );
      }
      throw error;
    }
  }

  /**
   * Replace role's permissions via RolePermission join table
   */
  async updatePermissions(
    id: string,
    assignPermissionsDto: AssignPermissionsToRolesDto,
  ) {
    const tenantId = this.tenantContext.getRequiredTenantId();
    const { permissionIds } = assignPermissionsDto;

    // First verify the role exists and belongs to the tenant
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // Validate that all permissions belong to the same tenant as the role
    if (permissionIds.length > 0) {
      const permissions = await this.prisma.permission.findMany({
        where: {
          id: {
            in: permissionIds,
          },
        },
      });

      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException('One or more permissions not found');
      }

      const invalidPermissions = permissions.filter(
        (p) => p.tenantId !== tenantId,
      );

      if (invalidPermissions.length > 0) {
        throw new BadRequestException(
          'Cannot assign permissions from a different tenant',
        );
      }
    }

    // Use transaction to remove existing permissions and add new ones
    return await this.prisma.$transaction(async (tx) => {
      // Remove all existing role permissions
      await tx.rolePermission.deleteMany({
        where: {
          roleId: id,
        },
      });

      // Add new role permissions
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
        });
      }

      // Return the updated role with permissions
      return tx.role.findUnique({
        where: {
          id,
        },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  }

  /**
   * Delete role and cascade to users
   */
  async delete(id: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    // First verify the role exists and belongs to the tenant
    const role = await this.prisma.role.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }

    // Delete the role (cascades to user_roles and role_permissions)
    await this.prisma.role.delete({
      where: {
        id,
      },
    });

    return { message: 'Role deleted successfully' };
  }
}
