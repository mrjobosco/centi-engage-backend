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
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireEmailVerification } from '../auth/decorators/require-email-verification.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireEmailVerification()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Permissions('read:user')
  async findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @Permissions('read:user')
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Post()
  @Permissions('create:user')
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Put(':id')
  @Permissions('update:user')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Put(':id/roles')
  @Permissions('update:user')
  async assignRoles(
    @Param('id') id: string,
    @Body() assignRolesDto: AssignRolesDto,
  ) {
    return this.userService.assignRoles(id, assignRolesDto);
  }

  @Put(':id/permissions')
  @Permissions('update:user')
  async assignPermissions(
    @Param('id') id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.userService.assignPermissions(id, assignPermissionsDto);
  }

  @Get(':id/permissions')
  @Permissions('read:user')
  async getEffectivePermissions(@Param('id') id: string) {
    return this.userService.getEffectivePermissions(id);
  }

  @Delete(':id')
  @Permissions('delete:user')
  async delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
