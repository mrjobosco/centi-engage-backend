import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

describe('ProjectController', () => {
  let controller: ProjectController;

  const mockProjectService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        {
          provide: ProjectService,
          useValue: mockProjectService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectController>(ProjectController);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all projects', async () => {
      // Arrange
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Project Alpha',
          description: 'First project',
          tenantId: 'tenant-123',
          ownerId: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
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
          tenantId: 'tenant-123',
          ownerId: 'user-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: {
            id: 'user-2',
            email: 'member@example.com',
            firstName: 'Member',
            lastName: 'User',
          },
        },
      ];

      mockProjectService.findAll.mockResolvedValue(mockProjects);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(mockProjectService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockProjects);
    });
  });

  describe('findOne', () => {
    it('should return a project by ID', async () => {
      // Arrange
      const projectId = 'project-123';
      const mockProject = {
        id: projectId,
        name: 'Test Project',
        description: 'Test description',
        tenantId: 'tenant-123',
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

      mockProjectService.findOne.mockResolvedValue(mockProject);

      // Act
      const result = await controller.findOne(projectId);

      // Assert
      expect(mockProjectService.findOne).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(mockProject);
    });
  });

  describe('create', () => {
    it('should create a new project', async () => {
      // Arrange
      const createProjectDto: CreateProjectDto = {
        name: 'New Project',
        description: 'New project description',
      };

      const mockUser = {
        id: 'user-123',
        email: 'user@example.com',
        tenantId: 'tenant-123',
      };

      const mockCreatedProject = {
        id: 'project-123',
        name: createProjectDto.name,
        description: createProjectDto.description,
        tenantId: 'tenant-123',
        ownerId: mockUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        owner: {
          id: mockUser.id,
          email: mockUser.email,
          firstName: 'Test',
          lastName: 'User',
        },
      };

      mockProjectService.create.mockResolvedValue(mockCreatedProject);

      // Act
      const result = await controller.create(createProjectDto, mockUser);

      // Assert
      expect(mockProjectService.create).toHaveBeenCalledWith(
        createProjectDto,
        mockUser.id,
      );
      expect(result).toEqual(mockCreatedProject);
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      // Arrange
      const projectId = 'project-123';
      const updateProjectDto: UpdateProjectDto = {
        name: 'Updated Project',
        description: 'Updated description',
      };

      const mockUpdatedProject = {
        id: projectId,
        name: updateProjectDto.name,
        description: updateProjectDto.description,
        tenantId: 'tenant-123',
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

      mockProjectService.update.mockResolvedValue(mockUpdatedProject);

      // Act
      const result = await controller.update(projectId, updateProjectDto);

      // Assert
      expect(mockProjectService.update).toHaveBeenCalledWith(
        projectId,
        updateProjectDto,
      );
      expect(result).toEqual(mockUpdatedProject);
    });
  });

  describe('delete', () => {
    it('should delete a project', async () => {
      // Arrange
      const projectId = 'project-123';
      const mockResponse = { message: 'Project deleted successfully' };

      mockProjectService.delete.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.delete(projectId);

      // Assert
      expect(mockProjectService.delete).toHaveBeenCalledWith(projectId);
      expect(result).toEqual(mockResponse);
    });
  });
});
