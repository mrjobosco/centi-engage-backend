# Project Module Examples

## Service Integration Examples

### Basic Project Operations

#### Creating Projects
```typescript
import { ProjectService } from './project/project.service';
import { CreateProjectDto } from './project/dto/create-project.dto';

@Injectable()
export class ProjectManagementService {
  constructor(private projectService: ProjectService) {}

  async createProjectForUser(userId: string, projectData: CreateProjectDto) {
    try {
      // Create project with automatic tenant isolation and ownership
      const project = await this.projectService.create(projectData, userId);
      
      console.log(`Project created: ${project.id} owned by ${project.owner.email}`);
      return project;
    } catch (error) {
      console.error('Failed to create project:', error.message);
      throw error;
    }
  }

  async createMultipleProjects(userId: string, projectsData: CreateProjectDto[]) {
    const createdProjects = [];
    
    for (const projectData of projectsData) {
      try {
        const project = await this.projectService.create(projectData, userId);
        createdProjects.push(project);
      } catch (error) {
        console.error(`Failed to create project ${projectData.name}:`, error.message);
        // Continue with other projects
      }
    }
    
    return {
      successful: createdProjects.length,
      total: projectsData.length,
      projects: createdProjects
    };
  }
}
```

#### Retrieving and Filtering Projects
```typescript
@Injectable()
export class ProjectQueryService {
  constructor(private projectService: ProjectService) {}

  async getProjectsWithOwnerInfo() {
    // Get all projects in current tenant with owner details
    const projects = await this.projectService.findAll();
    
    return projects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      owner: {
        name: `${project.owner.firstName} ${project.owner.lastName}`.trim(),
        email: project.owner.email
      },
      createdAt: project.createdAt,
      age: this.calculateProjectAge(project.createdAt)
    }));
  }

  async getProjectsByOwner(ownerId: string) {
    const allProjects = await this.projectService.findAll();
    
    return allProjects.filter(project => project.ownerId === ownerId);
  }

  async getRecentProjects(days: number = 30) {
    const allProjects = await this.projectService.findAll();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return allProjects.filter(project => 
      new Date(project.createdAt) >= cutoffDate
    );
  }

  async getProjectStatistics() {
    const projects = await this.projectService.findAll();
    
    const ownerCounts = projects.reduce((acc, project) => {
      const ownerEmail = project.owner.email;
      acc[ownerEmail] = (acc[ownerEmail] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalProjects: projects.length,
      uniqueOwners: Object.keys(ownerCounts).length,
      averageProjectsPerOwner: projects.length / Object.keys(ownerCounts).length,
      projectsByOwner: ownerCounts,
      oldestProject: projects.reduce((oldest, project) => 
        new Date(project.createdAt) < new Date(oldest.createdAt) ? project : oldest
      ),
      newestProject: projects.reduce((newest, project) => 
        new Date(project.createdAt) > new Date(newest.createdAt) ? project : newest
      )
    };
  }

  private calculateProjectAge(createdAt: Date): string {
    const now = new Date();
    const created = new Date(createdAt);
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) return `${diffDays} days`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
  }
}
```

### Project Management Workflows

#### Project Lifecycle Management
```typescript
@Injectable()
export class ProjectLifecycleService {
  constructor(
    private projectService: ProjectService,
    private userService: UserService
  ) {}

  async initializeProject(projectData: CreateProjectDto, ownerId: string) {
    // Create the project
    const project = await this.projectService.create(projectData, ownerId);
    
    // Perform initialization tasks
    await this.setupProjectDefaults(project.id);
    
    return {
      project,
      message: 'Project initialized successfully',
      nextSteps: [
        'Add project members',
        'Set up project milestones',
        'Configure project settings'
      ]
    };
  }

  async archiveProject(projectId: string) {
    // Get project details before archiving
    const project = await this.projectService.findOne(projectId);
    
    // Update project with archive status (if you have status field)
    // For now, we'll just add a note to the description
    const archiveNote = `[ARCHIVED ${new Date().toISOString()}] ${project.description || ''}`;
    
    const archivedProject = await this.projectService.update(projectId, {
      description: archiveNote
    });

    return {
      project: archivedProject,
      message: 'Project archived successfully'
    };
  }

  async transferProjectOwnership(projectId: string, newOwnerId: string) {
    // Note: Current implementation doesn't support changing ownership
    // This is a placeholder for future enhancement
    throw new Error('Project ownership transfer not yet implemented');
    
    // Future implementation would:
    // 1. Validate new owner exists and belongs to same tenant
    // 2. Update project.ownerId
    // 3. Log the ownership change
    // 4. Notify relevant parties
  }

  private async setupProjectDefaults(projectId: string) {
    // Placeholder for project initialization logic
    console.log(`Setting up defaults for project ${projectId}`);
    
    // Future enhancements could include:
    // - Creating default project folders
    // - Setting up default permissions
    // - Creating initial project milestones
    // - Sending welcome notifications
  }
}
```

#### Bulk Operations
```typescript
@Injectable()
export class ProjectBulkOperationsService {
  constructor(private projectService: ProjectService) {}

  async bulkUpdateProjects(updates: Array<{ id: string; data: UpdateProjectDto }>) {
    const results = [];
    
    for (const update of updates) {
      try {
        const updatedProject = await this.projectService.update(update.id, update.data);
        results.push({
          id: update.id,
          success: true,
          project: updatedProject
        });
      } catch (error) {
        results.push({
          id: update.id,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      total: updates.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  async bulkDeleteProjects(projectIds: string[]) {
    const results = [];
    
    for (const projectId of projectIds) {
      try {
        await this.projectService.delete(projectId);
        results.push({
          id: projectId,
          success: true
        });
      } catch (error) {
        results.push({
          id: projectId,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      total: projectIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }
}
```

## API Usage Examples

### cURL Examples

#### Create a Project
```bash
curl -X POST http://localhost:3000/projects \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Website Redesign",
    "description": "Complete redesign of the company website with modern UI/UX"
  }'
```

#### Get All Projects
```bash
curl -X GET http://localhost:3000/projects \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123"
```

#### Update a Project
```bash
curl -X PUT http://localhost:3000/projects/project-456 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "x-tenant-id: tenant-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Website Redesign - Phase 1",
    "description": "Phase 1: Research and wireframing for the website redesign project"
  }'
```

### JavaScript/TypeScript Client Examples

#### Using Fetch API
```typescript
class ProjectApiClient {
  constructor(
    private baseUrl: string,
    private token: string,
    private tenantId: string
  ) {}

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'x-tenant-id': this.tenantId,
      'Content-Type': 'application/json'
    };
  }

  async createProject(projectData: CreateProjectDto) {
    const response = await fetch(`${this.baseUrl}/projects`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(projectData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create project: ${error.message}`);
    }

    return response.json();
  }

  async getProjects() {
    const response = await fetch(`${this.baseUrl}/projects`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    return response.json();
  }

  async getProject(id: string) {
    const response = await fetch(`${this.baseUrl}/projects/${id}`, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Project not found');
      }
      throw new Error('Failed to fetch project');
    }

    return response.json();
  }

  async updateProject(id: string, updateData: UpdateProjectDto) {
    const response = await fetch(`${this.baseUrl}/projects/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update project: ${error.message}`);
    }

    return response.json();
  }

  async deleteProject(id: string) {
    const response = await fetch(`${this.baseUrl}/projects/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete project: ${error.message}`);
    }

    return response.json();
  }
}

// Usage example
const client = new ProjectApiClient(
  'http://localhost:3000',
  'your-jwt-token',
  'your-tenant-id'
);

// Create a project
const newProject = await client.createProject({
  name: 'Mobile App Development',
  description: 'Development of a new mobile application for iOS and Android'
});

// Get all projects
const projects = await client.getProjects();

// Update a project
const updatedProject = await client.updateProject(newProject.id, {
  description: 'Updated: Development of a cross-platform mobile application'
});

// Delete a project
await client.deleteProject(newProject.id);
```

#### Using Axios
```typescript
import axios, { AxiosInstance } from 'axios';

class ProjectService {
  private api: AxiosInstance;

  constructor(baseUrl: string, token: string, tenantId: string) {
    this.api = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          throw new Error('Authentication failed');
        }
        if (error.response?.status === 403) {
          throw new Error('Insufficient permissions');
        }
        if (error.response?.status === 404) {
          throw new Error('Project not found');
        }
        throw error;
      }
    );
  }

  async getProjects() {
    const response = await this.api.get('/projects');
    return response.data;
  }

  async getProject(id: string) {
    const response = await this.api.get(`/projects/${id}`);
    return response.data;
  }

  async createProject(projectData: CreateProjectDto) {
    const response = await this.api.post('/projects', projectData);
    return response.data;
  }

  async updateProject(id: string, updateData: UpdateProjectDto) {
    const response = await this.api.put(`/projects/${id}`, updateData);
    return response.data;
  }

  async deleteProject(id: string) {
    const response = await this.api.delete(`/projects/${id}`);
    return response.data;
  }

  // Advanced operations
  async getProjectsByOwner(ownerEmail: string) {
    const projects = await this.getProjects();
    return projects.filter(project => project.owner.email === ownerEmail);
  }

  async searchProjects(searchTerm: string) {
    const projects = await this.getProjects();
    return projects.filter(project => 
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }
}
```

### React Component Examples

#### Project List Component
```typescript
import React, { useState, useEffect } from 'react';
import { ProjectService } from './project.service';

interface Project {
  id: string;
  name: string;
  description?: string;
  owner: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectService = new ProjectService(
    process.env.REACT_APP_API_URL!,
    localStorage.getItem('token')!,
    localStorage.getItem('tenantId')!
  );

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsData = await projectService.getProjects();
      setProjects(projectsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project?')) {
      return;
    }

    try {
      await projectService.deleteProject(projectId);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  if (loading) return <div>Loading projects...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="project-list">
      <h2>Projects</h2>
      {projects.length === 0 ? (
        <p>No projects found.</p>
      ) : (
        <div className="projects-grid">
          {projects.map(project => (
            <div key={project.id} className="project-card">
              <h3>{project.name}</h3>
              {project.description && <p>{project.description}</p>}
              <div className="project-meta">
                <p>Owner: {project.owner.firstName} {project.owner.lastName} ({project.owner.email})</p>
                <p>Created: {new Date(project.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="project-actions">
                <button onClick={() => handleDeleteProject(project.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectList;
```

#### Project Creation Form
```typescript
import React, { useState } from 'react';
import { ProjectService } from './project.service';

interface CreateProjectFormProps {
  onProjectCreated: (project: any) => void;
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ onProjectCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectService = new ProjectService(
    process.env.REACT_APP_API_URL!,
    localStorage.getItem('token')!,
    localStorage.getItem('tenantId')!
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const newProject = await projectService.createProject({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined
      });
      
      onProjectCreated(newProject);
      setFormData({ name: '', description: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <form onSubmit={handleSubmit} className="create-project-form">
      <h3>Create New Project</h3>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="form-group">
        <label htmlFor="name">Project Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          disabled={loading}
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          disabled={loading}
        />
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Project'}
      </button>
    </form>
  );
};

export default CreateProjectForm;
```

## Testing Examples

### Unit Testing Project Service
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { NotFoundException } from '@nestjs/common';

describe('ProjectService', () => {
  let service: ProjectService;
  let prismaService: PrismaService;
  let tenantContextService: TenantContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            getRequiredTenantId: jest.fn().mockReturnValue('tenant-123'),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    prismaService = module.get<PrismaService>(PrismaService);
    tenantContextService = module.get<TenantContextService>(TenantContextService);
  });

  describe('findAll', () => {
    it('should return projects for current tenant', async () => {
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project',
          description: 'Test Description',
          tenantId: 'tenant-123',
          ownerId: 'user-1',
          owner: {
            id: 'user-1',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe'
          }
        }
      ];

      jest.spyOn(prismaService.project, 'findMany').mockResolvedValue(mockProjects);

      const result = await service.findAll();

      expect(prismaService.project.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-123' },
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
        orderBy: { createdAt: 'desc' }
      });

      expect(result).toEqual(mockProjects);
    });
  });

  describe('create', () => {
    it('should create project with tenant and owner', async () => {
      const createProjectDto = {
        name: 'New Project',
        description: 'New Description'
      };
      const ownerId = 'user-1';

      const mockCreatedProject = {
        id: 'project-new',
        name: 'New Project',
        description: 'New Description',
        tenantId: 'tenant-123',
        ownerId: 'user-1',
        owner: {
          id: 'user-1',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe'
        }
      };

      jest.spyOn(prismaService.project, 'create').mockResolvedValue(mockCreatedProject);

      const result = await service.create(createProjectDto, ownerId);

      expect(prismaService.project.create).toHaveBeenCalledWith({
        data: {
          name: 'New Project',
          description: 'New Description',
          tenantId: 'tenant-123',
          ownerId: 'user-1'
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
        }
      });

      expect(result).toEqual(mockCreatedProject);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException when project not found', async () => {
      jest.spyOn(prismaService.project, 'findFirst').mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        new NotFoundException('Project with ID non-existent not found')
      );
    });
  });
});
```

### Integration Testing
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';

describe('ProjectController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let authToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    
    await app.init();

    // Setup test tenant and get auth token
    const { token, tenant } = await setupTestTenant();
    authToken = token;
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  describe('/projects (POST)', () => {
    it('should create a new project', () => {
      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: 'Test Project',
          description: 'A test project'
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Test Project');
          expect(res.body.description).toBe('A test project');
          expect(res.body.tenantId).toBe(tenantId);
          expect(res.body.owner).toBeDefined();
        });
    });

    it('should return 400 for empty project name', () => {
      return request(app.getHttpServer())
        .post('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          name: '',
          description: 'A test project'
        })
        .expect(400);
    });
  });

  describe('/projects (GET)', () => {
    it('should return projects for current tenant', async () => {
      // Create a test project first
      const project = await createTestProject();
      
      return request(app.getHttpServer())
        .get('/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('owner');
        });
    });
  });
});
```

## Error Handling Examples

### Service-Level Error Handling
```typescript
@Injectable()
export class ProjectManagementService {
  constructor(private projectService: ProjectService) {}

  async safeCreateProject(projectData: CreateProjectDto, ownerId: string) {
    try {
      return await this.projectService.create(projectData, ownerId);
    } catch (error) {
      if (error.message.includes('validation')) {
        return {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Invalid project data provided'
        };
      }

      // Log unexpected errors
      console.error('Unexpected error creating project:', error);
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      };
    }
  }

  async safeDeleteProject(projectId: string) {
    try {
      return await this.projectService.delete(projectId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          success: false,
          error: 'PROJECT_NOT_FOUND',
          message: 'Project not found in current tenant'
        };
      }

      throw error; // Re-throw unexpected errors
    }
  }
}
```

### Client-Side Error Handling
```typescript
class ProjectApiClient {
  async createProjectWithErrorHandling(projectData: CreateProjectDto) {
    try {
      const project = await this.createProject(projectData);
      return { success: true, data: project };
    } catch (error) {
      if (error.response?.status === 400) {
        return {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Please check your input data',
          details: error.response.data
        };
      }

      if (error.response?.status === 403) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to create projects'
        };
      }

      return {
        success: false,
        error: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred'
      };
    }
  }
}
```