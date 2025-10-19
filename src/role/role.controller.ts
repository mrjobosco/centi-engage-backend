import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsToRolesDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireEmailVerification } from '../auth/decorators/require-email-verification.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('Roles')
@ApiBearerAuth('JWT-auth')
@ApiSecurity('tenant-id')
@Controller('roles')
@UseGuards(JwtAuthGuard)
@RequireEmailVerification()
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

  @Get()
  @Permissions('read:role')
  @ApiOperation({
    summary: 'List all roles',
    description:
      'Get all roles in the current tenant with their associated permissions',
  })
  @ApiResponse({
    status: 200,
    description: 'Roles retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'role_123' },
          name: { type: 'string', example: 'Editor' },
          description: {
            type: 'string',
            example: 'Can edit content and manage users',
          },
          tenantId: { type: 'string', example: 'tenant_123' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          permissions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'perm_123' },
                name: { type: 'string', example: 'read:user' },
                description: { type: 'string', example: 'Can read user data' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Missing permission' })
  async findAll() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @Permissions('read:role')
  @ApiOperation({
    summary: 'Get role by ID',
    description: 'Get a specific role with its permissions',
  })
  @ApiParam({ name: 'id', description: 'Role ID', example: 'role_123' })
  @ApiResponse({
    status: 200,
    description: 'Role retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'role_123' },
        name: { type: 'string', example: 'Editor' },
        description: {
          type: 'string',
          example: 'Can edit content and manage users',
        },
        tenantId: { type: 'string', example: 'tenant_123' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        permissions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'perm_123' },
              name: { type: 'string', example: 'read:user' },
              description: { type: 'string', example: 'Can read user data' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Missing permission' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async findOne(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  @Post()
  @Permissions('create:role')
  @ApiOperation({
    summary: 'Create a new role',
    description: 'Create a new role in the current tenant',
  })
  @ApiResponse({
    status: 201,
    description: 'Role created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'role_456' },
        name: { type: 'string', example: 'Content Manager' },
        description: {
          type: 'string',
          example: 'Can manage all content within the tenant',
        },
        tenantId: { type: 'string', example: 'tenant_123' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        permissions: { type: 'array', items: {}, example: [] },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Missing permission' })
  @ApiResponse({
    status: 409,
    description: 'Role name already exists in tenant',
  })
  async create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Put(':id')
  @Permissions('update:role')
  @ApiOperation({
    summary: 'Update role',
    description: 'Update role name',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(id, updateRoleDto);
  }

  @Put(':id/permissions')
  @Permissions('update:role')
  @ApiOperation({
    summary: 'Update role permissions',
    description: 'Replace all permissions for a role',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({
    status: 200,
    description: 'Permissions updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Role or permission not found' })
  async updatePermissions(
    @Param('id') id: string,
    @Body() assignPermissionsToRolesDto: AssignPermissionsToRolesDto,
  ) {
    return this.roleService.updatePermissions(id, assignPermissionsToRolesDto);
  }

  @Delete(':id')
  @Permissions('delete:role')
  @ApiOperation({
    summary: 'Delete role',
    description: 'Delete a role and remove it from all users',
  })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async delete(@Param('id') id: string) {
    return this.roleService.delete(id);
  }
}
