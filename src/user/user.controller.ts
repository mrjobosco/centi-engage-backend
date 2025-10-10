import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@ApiSecurity('tenant-id')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Permissions('read:user')
  @ApiOperation({
    summary: 'List all users',
    description: 'Get all users in the current tenant',
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Missing permission' })
  async findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @Permissions('read:user')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Get a specific user with their roles and permissions',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  @Permissions('create:user')
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Create a new user in the current tenant',
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Put(':id')
  @Permissions('update:user')
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user details',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Put(':id/roles')
  @Permissions('update:user')
  @ApiOperation({
    summary: 'Assign roles to user',
    description: 'Replace user roles with the provided role IDs',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Roles assigned successfully' })
  @ApiResponse({ status: 404, description: 'User or role not found' })
  async assignRoles(
    @Param('id') id: string,
    @Body() assignRolesDto: AssignRolesDto,
  ) {
    return this.userService.assignRoles(id, assignRolesDto);
  }

  @Put(':id/permissions')
  @Permissions('update:user')
  @ApiOperation({
    summary: 'Assign permissions to user',
    description: 'Grant user-specific permissions directly to a user',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Permissions assigned successfully',
  })
  @ApiResponse({ status: 404, description: 'User or permission not found' })
  async assignPermissions(
    @Param('id') id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.userService.assignPermissions(id, assignPermissionsDto);
  }

  @Get(':id/permissions')
  @Permissions('read:user')
  @ApiOperation({
    summary: 'Get user effective permissions',
    description:
      'Get all effective permissions for a user (role-based + user-specific)',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getEffectivePermissions(@Param('id') id: string) {
    return this.userService.getEffectivePermissions(id);
  }

  @Delete(':id')
  @Permissions('delete:user')
  @ApiOperation({
    summary: 'Delete user',
    description: 'Delete a user and all their role/permission assignments',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
