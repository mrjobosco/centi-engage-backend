import {
  Controller,
  Get,
  Post,
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
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@ApiTags('Permissions')
@ApiBearerAuth('JWT-auth')
@ApiSecurity('tenant-id')
@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) { }

  @Get()
  @Permissions('read:permission')
  @ApiOperation({
    summary: 'List all permissions',
    description: 'Get all permissions in the current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'perm_123' },
          name: { type: 'string', example: 'read:user' },
          description: { type: 'string', example: 'Can read user data' },
          tenantId: { type: 'string', example: 'tenant_123' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Missing permission' })
  async findAll() {
    return this.permissionService.findAll();
  }

  @Post()
  @Permissions('create:permission')
  @ApiOperation({
    summary: 'Create a new permission',
    description:
      'Create a new permission in the current tenant. Format: action:subject (e.g., read:project)',
  })
  @ApiResponse({
    status: 201,
    description: 'Permission created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'perm_456' },
        name: { type: 'string', example: 'manage:reports' },
        description: {
          type: 'string',
          example: 'Can create, read, update, and delete reports',
        },
        tenantId: { type: 'string', example: 'tenant_123' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Missing permission' })
  @ApiResponse({
    status: 409,
    description: 'Permission name already exists in tenant',
  })
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionService.create(createPermissionDto);
  }

  @Delete(':id')
  @Permissions('delete:permission')
  @ApiOperation({
    summary: 'Delete permission',
    description: 'Delete a permission and remove it from all roles and users',
  })
  @ApiParam({ name: 'id', description: 'Permission ID', example: 'perm_123' })
  @ApiResponse({
    status: 200,
    description: 'Permission deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Permission deleted successfully' },
        deletedPermissionId: { type: 'string', example: 'perm_123' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Missing permission' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  async delete(@Param('id') id: string) {
    return this.permissionService.delete(id);
  }
}
