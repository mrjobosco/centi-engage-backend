import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * List all users for the current tenant
   */
  async findAll() {
    const tenantId = this.tenantContext.getRequiredTenantId();

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Remove password from response
    return users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  /**
   * Get user by ID with roles and permissions (tenant-scoped)
   */
  async findOne(id: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Create new user with tenantId and hashed password
   */
  async create(createUserDto: CreateUserDto) {
    const tenantId = this.tenantContext.getRequiredTenantId();
    const { email, password, firstName, lastName } = createUserDto;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          tenantId,
          authMethods: ['password'], // Set default auth method for email/password users
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      // Remove password from response
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      // Handle unique constraint violation for (email, tenantId)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `User with email "${email}" already exists in this tenant`,
        );
      }
      throw error;
    }
  }

  /**
   * Update user details
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    // First verify the user exists and belongs to the tenant
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: {
          id,
        },
        data: updateUserDto,
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      // Remove password from response
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    } catch (error) {
      // Handle unique constraint violation for (email, tenantId)
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `User with email "${updateUserDto.email}" already exists in this tenant`,
        );
      }
      throw error;
    }
  }

  /**
   * Delete user and cascade role/permission assignments
   */
  async delete(id: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    // First verify the user exists and belongs to the tenant
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Delete the user (cascades to user_roles and user_permissions)
    await this.prisma.user.delete({
      where: {
        id,
      },
    });

    return { message: 'User deleted successfully' };
  }

  /**
   * Replace user's roles via UserRole join table
   */
  async assignRoles(id: string, assignRolesDto: AssignRolesDto) {
    const tenantId = this.tenantContext.getRequiredTenantId();
    const { roleIds } = assignRolesDto;

    // First verify the user exists and belongs to the tenant
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Validate that all roles belong to the same tenant as the user
    if (roleIds.length > 0) {
      const roles = await this.prisma.role.findMany({
        where: {
          id: {
            in: roleIds,
          },
        },
      });

      if (roles.length !== roleIds.length) {
        throw new BadRequestException('One or more roles not found');
      }

      const invalidRoles = roles.filter((r) => r.tenantId !== tenantId);

      if (invalidRoles.length > 0) {
        throw new BadRequestException(
          'Cannot assign roles from a different tenant',
        );
      }
    }

    // Use transaction to remove existing roles and add new ones
    return await this.prisma.$transaction(async (tx) => {
      // Remove all existing user roles
      await tx.userRole.deleteMany({
        where: {
          userId: id,
        },
      });

      // Add new user roles
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId: id,
            roleId,
          })),
        });
      }

      // Return the updated user with roles
      const updatedUser = await tx.user.findUnique({
        where: {
          id,
        },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      // Remove password from response
      if (updatedUser) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
      }

      return updatedUser;
    });
  }

  /**
   * Add/remove user-specific permissions via UserPermission join table
   */
  async assignPermissions(
    id: string,
    assignPermissionsDto: AssignPermissionsDto,
  ) {
    const tenantId = this.tenantContext.getRequiredTenantId();
    const { permissionIds } = assignPermissionsDto;

    // First verify the user exists and belongs to the tenant
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Validate that all permissions belong to the same tenant as the user
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
      // Remove all existing user permissions
      await tx.userPermission.deleteMany({
        where: {
          userId: id,
        },
      });

      // Add new user permissions
      if (permissionIds.length > 0) {
        await tx.userPermission.createMany({
          data: permissionIds.map((permissionId) => ({
            userId: id,
            permissionId,
          })),
        });
      }

      // Return the updated user with permissions
      const updatedUser = await tx.user.findUnique({
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

      // Remove password from response
      if (updatedUser) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = updatedUser;
        return userWithoutPassword;
      }

      return updatedUser;
    });
  }

  /**
   * Find users by authentication method
   */
  async findByAuthMethod(authMethod: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        authMethods: {
          has: authMethod,
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Remove password from response
    return users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  /**
   * Check if user has a specific authentication method
   */
  async hasAuthMethod(userId: string, authMethod: string): Promise<boolean> {
    const tenantId = this.tenantContext.getRequiredTenantId();

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
      select: {
        authMethods: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user.authMethods.includes(authMethod);
  }

  /**
   * Get user's authentication methods
   */
  async getAuthMethods(userId: string): Promise<string[]> {
    const tenantId = this.tenantContext.getRequiredTenantId();

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
      select: {
        authMethods: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user.authMethods;
  }

  /**
   * Get effective permissions (UNION of role-based and user-specific permissions)
   */
  async getEffectivePermissions(id: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    // First verify the user exists and belongs to the tenant
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Collect role-based permissions
    const rolePermissions = user.roles.flatMap((userRole) =>
      userRole.role.permissions.map((rp) => ({
        ...rp.permission,
        source: 'role' as const,
        roleName: userRole.role.name,
      })),
    );

    // Collect user-specific permissions
    const userPermissions = user.permissions.map((up) => ({
      ...up.permission,
      source: 'user' as const,
    }));

    // Combine and deduplicate by permission ID
    const permissionMap = new Map();

    rolePermissions.forEach((perm) => {
      if (!permissionMap.has(perm.id)) {
        permissionMap.set(perm.id, perm);
      }
    });

    userPermissions.forEach((perm) => {
      if (!permissionMap.has(perm.id)) {
        permissionMap.set(perm.id, perm);
      }
    });

    return {
      userId: user.id,
      email: user.email,
      effectivePermissions: Array.from(permissionMap.values()),
      roleBasedPermissions: rolePermissions,
      userSpecificPermissions: userPermissions,
    };
  }
}
