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
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsToRolesDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireEmailVerification } from '../auth/decorators/require-email-verification.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard)
@RequireEmailVerification()
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

  @Get()
  @Permissions('read:role')
  async findAll() {
    return this.roleService.findAll();
  }

  @Get(':id')
  @Permissions('read:role')
  async findOne(@Param('id') id: string) {
    return this.roleService.findOne(id);
  }

  @Post()
  @Permissions('create:role')
  async create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Put(':id')
  @Permissions('update:role')
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(id, updateRoleDto);
  }

  @Put(':id/permissions')
  @Permissions('update:role')
  async updatePermissions(
    @Param('id') id: string,
    @Body() assignPermissionsToRolesDto: AssignPermissionsToRolesDto,
  ) {
    return this.roleService.updatePermissions(id, assignPermissionsToRolesDto);
  }

  @Delete(':id')
  @Permissions('delete:role')
  async delete(@Param('id') id: string) {
    return this.roleService.delete(id);
  }
}
