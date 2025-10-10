import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * List all projects for the current tenant
   */
  async findAll() {
    const tenantId = this.tenantContext.getRequiredTenantId();

    return await this.prisma.project.findMany({
      where: {
        tenantId,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get project by ID (tenant-scoped)
   */
  async findOne(id: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    const project = await this.prisma.project.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return project;
  }

  /**
   * Create new project that automatically sets tenantId and ownerId
   */
  async create(createProjectDto: CreateProjectDto, ownerId: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    const project = await this.prisma.project.create({
      data: {
        ...createProjectDto,
        tenantId,
        ownerId,
      },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return project;
  }

  /**
   * Update project (tenant-scoped)
   */
  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    // First verify the project exists and belongs to the tenant
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    return await this.prisma.project.update({
      where: {
        id,
      },
      data: updateProjectDto,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Delete project (tenant-scoped)
   */
  async delete(id: string) {
    const tenantId = this.tenantContext.getRequiredTenantId();

    // First verify the project exists and belongs to the tenant
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    await this.prisma.project.delete({
      where: {
        id,
      },
    });

    return { message: 'Project deleted successfully' };
  }
}
