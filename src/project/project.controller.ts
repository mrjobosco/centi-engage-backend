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
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequireEmailVerification } from '../auth/decorators/require-email-verification.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireEmailVerification()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @Permissions('read:project')
  async findAll() {
    return this.projectService.findAll();
  }

  @Get(':id')
  @Permissions('read:project')
  async findOne(@Param('id') id: string) {
    return this.projectService.findOne(id);
  }

  @Post()
  @Permissions('create:project')
  async create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() user: any,
  ) {
    return this.projectService.create(createProjectDto, user.id);
  }

  @Put(':id')
  @Permissions('update:project')
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectService.update(id, updateProjectDto);
  }

  @Delete(':id')
  @Permissions('delete:project')
  async delete(@Param('id') id: string) {
    return this.projectService.delete(id);
  }
}
