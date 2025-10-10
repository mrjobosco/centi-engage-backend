import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

describe('ProjectService', () => {
  let service: ProjectService;

  const mockPrismaService = {
    project: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockTenantContextService = {
    getRequiredTenantId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContextService,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    const tenantId = 'tenant-123';
    const mockProjects = [
      {
        id: 'project-1',
        name: 'Project Alpha',
        description: 'First project',
        tenantId,
        ownerId: 'user-1',
        createdAt: new Date('2025-05-10T10:00:00Z'),
        updatedAt: new Date('2025-05-10T10:00:00Z'),
        owner: {
          id: 'user-1',
          email: 'owner@example.com',
          firstName: 'Owner',
          lastName: 'User',
        },
      },
      {
        id: 'project-2',
        name: 'Project Beta',
        description: 'Second project',
        tenantId,
        ownerId: 'user-2',
        createdAt: new Date('2025-05-10T09:00:00Z'),
        updatedAt: new Date('2025-05-10T09:00:00Z'),
        owner: {
          id: 'user-2',
          email: 'member@example.com',
          firstName: 'Member',
          lastName: 'User',
        },
      },
    ];

    it('should return all projects for the current tenant', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);

      // Act
      const result = await service.findAll();

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.project.findMany).toHaveBeenCalledWith({
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
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Project Alpha');
      expect(result[1].name).toBe('Project Beta');
    });

    it('should only return projects from the current tenant', async () => {
      // Arrange
      const tenant1Id = 'tenant-1';
      const tenant2Id = 'tenant-2';

      const tenant1Projects = [
        {
          id: 'project-1',
          name: 'Tenant 1 Project',
          tenantId: tenant1Id,
          ownerId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: {
            id: 'user-1',
            email: 'user1@example.com',
            firstName: 'User',
            lastName: 'One',
          },
        },
      ];

      // Query for tenant 1
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenant1Id);
      mockPrismaService.project.findMany.mockResolvedValue(tenant1Projects);

      const result1 = await service.findAll();

      // Assert tenant 1 results
      expect(result1).toHaveLength(1);
      expect(result1[0].tenantId).toBe(tenant1Id);

      // Query for tenant 2
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenant2Id);
      mockPrismaService.project.findMany.mockResolvedValue([]);

      const result2 = await service.findAll();

      // Assert tenant 2 results
      expect(result2).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    const tenantId = 'tenant-123';
    const projectId = 'project-123';
    const mockProject = {
      id: projectId,
      name: 'Test Project',
      description: 'Test description',
      tenantId,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: {
        id: 'user-123',
        email: 'owner@example.com',
        firstName: 'Owner',
        lastName: 'User',
      },
    };

    it('should return a project by ID (tenant-scoped)', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);

      // Act
      const result = await service.findOne(projectId);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: projectId,
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
      expect(result.name).toBe(mockProject.name);
      expect(result.id).toBe(projectId);
    });

    it('should throw NotFoundException if project does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(projectId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(projectId)).rejects.toThrow(
        `Project with ID ${projectId} not found`,
      );
    });

    it('should return 404 for cross-tenant access attempts', async () => {
      // Arrange
      const tenant2Id = 'tenant-2';

      // User from tenant 2 tries to access a project from tenant 1
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenant2Id);
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne(projectId)).rejects.toThrow(
        NotFoundException,
      );

      // Verify the query included tenant scoping
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: projectId,
          tenantId: tenant2Id,
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
    });
  });

  describe('create', () => {
    const tenantId = 'tenant-123';
    const ownerId = 'user-123';
    const createProjectDto: CreateProjectDto = {
      name: 'New Project',
      description: 'New project description',
    };

    const mockCreatedProject = {
      id: 'project-123',
      name: createProjectDto.name,
      description: createProjectDto.description,
      tenantId,
      ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
      owner: {
        id: ownerId,
        email: 'owner@example.com',
        firstName: 'Owner',
        lastName: 'User',
      },
    };

    it('should create a new project with automatic tenantId and ownerId', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.project.create.mockResolvedValue(mockCreatedProject);

      // Act
      const result = await service.create(createProjectDto, ownerId);

      // Assert
      expect(mockTenantContextService.getRequiredTenantId).toHaveBeenCalled();
      expect(mockPrismaService.project.create).toHaveBeenCalledWith({
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
      expect(result.name).toBe(createProjectDto.name);
      expect(result.tenantId).toBe(tenantId);
      expect(result.ownerId).toBe(ownerId);
    });

    it('should automatically set tenantId from context', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.project.create.mockResolvedValue(mockCreatedProject);

      // Act
      await service.create(createProjectDto, ownerId);

      // Assert
      const createCall = mockPrismaService.project.create.mock.calls[0][0];
      expect(createCall.data.tenantId).toBe(tenantId);
    });

    it('should automatically set ownerId from parameter', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.project.create.mockResolvedValue(mockCreatedProject);

      // Act
      await service.create(createProjectDto, ownerId);

      // Assert
      const createCall = mockPrismaService.project.create.mock.calls[0][0];
      expect(createCall.data.ownerId).toBe(ownerId);
    });
  });

  describe('update', () => {
    const tenantId = 'tenant-123';
    const projectId = 'project-123';
    const updateProjectDto: UpdateProjectDto = {
      name: 'Updated Project',
      description: 'Updated description',
    };

    const mockProject = {
      id: projectId,
      name: 'Original Project',
      description: 'Original description',
      tenantId,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdatedProject = {
      ...mockProject,
      name: updateProjectDto.name,
      description: updateProjectDto.description,
      owner: {
        id: 'user-123',
        email: 'owner@example.com',
        firstName: 'Owner',
        lastName: 'User',
      },
    };

    it('should update project (tenant-scoped)', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue(mockUpdatedProject);

      // Act
      const result = await service.update(projectId, updateProjectDto);

      // Assert
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: projectId,
          tenantId,
        },
      });
      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: {
          id: projectId,
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
      expect(result.name).toBe(updateProjectDto.name);
    });

    it('should throw NotFoundException if project does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update(projectId, updateProjectDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.project.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    const tenantId = 'tenant-123';
    const projectId = 'project-123';
    const mockProject = {
      id: projectId,
      name: 'Test Project',
      description: 'Test description',
      tenantId,
      ownerId: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should delete project (tenant-scoped)', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.project.delete.mockResolvedValue(mockProject);

      // Act
      const result = await service.delete(projectId);

      // Assert
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: projectId,
          tenantId,
        },
      });
      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({
        where: {
          id: projectId,
        },
      });
      expect(result).toEqual({ message: 'Project deleted successfully' });
    });

    it('should throw NotFoundException if project does not exist', async () => {
      // Arrange
      mockTenantContextService.getRequiredTenantId.mockReturnValue(tenantId);
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      // Act & Assert
      await expect(service.delete(projectId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.project.delete).not.toHaveBeenCalled();
    });
  });
});
