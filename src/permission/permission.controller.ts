import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireEmailVerification } from '../auth/decorators/require-email-verification.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
@RequireEmailVerification()
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) { }

  @Get()
  @Permissions('read:permission')
  async findAll() {
    return this.permissionService.findAll();
  }

  @Post()
  @Permissions('create:permission')
  async create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionService.create(createPermissionDto);
  }

  @Delete(':id')
  @Permissions('delete:permission')
  async delete(@Param('id') id: string) {
    return this.permissionService.delete(id);
  }
}
