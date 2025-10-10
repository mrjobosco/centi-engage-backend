/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationTemplateService } from './notification-template.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationChannelType } from '../enums';
import { CreateTemplateDto, UpdateTemplateDto } from '../dto';

// Mock the template renderer
jest.mock('../templates/email/template-renderer', () => ({
  renderEmailTemplate: jest.fn(),
  renderEmailTemplateText: jest.fn(),
}));

import {
  renderEmailTemplate,
  renderEmailTemplateText,
} from '../templates/email/template-renderer';

const mockRenderEmailTemplate = renderEmailTemplate as jest.MockedFunction<
  typeof renderEmailTemplate
>;
const mockRenderEmailTemplateText =
  renderEmailTemplateText as jest.MockedFunction<
    typeof renderEmailTemplateText
  >;

describe('NotificationTemplateService', () => {
  let service: NotificationTemplateService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockTemplate = {
    id: 'template-1',
    tenantId: 'tenant-1',
    category: 'welcome',
    channel: NotificationChannelType.EMAIL,
    subject: 'Welcome to {{appName}}',
    templateBody: 'welcome',
    variables: {
      appName: { required: true, type: 'string' },
      userName: { required: true, type: 'string' },
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGlobalTemplate = {
    ...mockTemplate,
    id: 'global-template-1',
    tenantId: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      notificationTemplate: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationTemplateService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationTemplateService>(
      NotificationTemplateService,
    );
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTemplate', () => {
    it('should return tenant-specific template when available', async () => {
      prismaService.notificationTemplate.findFirst.mockResolvedValueOnce(
        mockTemplate,
      );

      const result = await service.getTemplate(
        'welcome',
        NotificationChannelType.EMAIL,
        'tenant-1',
      );

      expect(result).toEqual(mockTemplate);
      expect(prismaService.notificationTemplate.findFirst).toHaveBeenCalledWith(
        {
          where: {
            tenantId: 'tenant-1',
            category: 'welcome',
            channel: NotificationChannelType.EMAIL,
            isActive: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        },
      );
    });

    it('should fallback to global template when tenant-specific not found', async () => {
      prismaService.notificationTemplate.findFirst
        .mockResolvedValueOnce(null) // No tenant-specific template
        .mockResolvedValueOnce(mockGlobalTemplate); // Global template found

      const result = await service.getTemplate(
        'welcome',
        NotificationChannelType.EMAIL,
        'tenant-1',
      );

      expect(result).toEqual(mockGlobalTemplate);
      expect(
        prismaService.notificationTemplate.findFirst,
      ).toHaveBeenCalledTimes(2);
    });

    it('should return global template when no tenantId provided', async () => {
      prismaService.notificationTemplate.findFirst.mockResolvedValueOnce(
        mockGlobalTemplate,
      );

      const result = await service.getTemplate(
        'welcome',
        NotificationChannelType.EMAIL,
      );

      expect(result).toEqual(mockGlobalTemplate);
      expect(prismaService.notificationTemplate.findFirst).toHaveBeenCalledWith(
        {
          where: {
            tenantId: null,
            category: 'welcome',
            channel: NotificationChannelType.EMAIL,
            isActive: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        },
      );
    });

    it('should return null when no template found', async () => {
      prismaService.notificationTemplate.findFirst.mockResolvedValue(null);

      const result = await service.getTemplate(
        'nonexistent',
        NotificationChannelType.EMAIL,
        'tenant-1',
      );

      expect(result).toBeNull();
    });
  });

  describe('renderEmailTemplate', () => {
    it('should render email template using React-email', async () => {
      const emailTemplate = {
        ...mockTemplate,
        channel: NotificationChannelType.EMAIL,
      };
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(
        emailTemplate,
      );

      mockRenderEmailTemplate.mockResolvedValueOnce(
        '<html>Welcome John</html>',
      );
      mockRenderEmailTemplateText.mockResolvedValueOnce('Welcome John');

      const variables = { appName: 'MyApp', userName: 'John' };
      const result = await service.renderEmailTemplate('template-1', variables);

      expect(result).toEqual({
        html: '<html>Welcome John</html>',
        text: 'Welcome John',
      });
      expect(mockRenderEmailTemplate).toHaveBeenCalledWith(
        'welcome',
        variables,
      );
      expect(mockRenderEmailTemplateText).toHaveBeenCalledWith(
        'welcome',
        variables,
      );
    });

    it('should throw NotFoundException when template not found', async () => {
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.renderEmailTemplate('nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error when template is not an email template', async () => {
      const smsTemplate = {
        ...mockTemplate,
        channel: NotificationChannelType.SMS,
      };
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(
        smsTemplate,
      );

      await expect(
        service.renderEmailTemplate('template-1', {}),
      ).rejects.toThrow('Template template-1 is not an email template');
    });

    it('should fallback to variable substitution when React-email fails', async () => {
      const emailTemplate = {
        ...mockTemplate,
        channel: NotificationChannelType.EMAIL,
        templateBody: 'Welcome {{userName}} to {{appName}}!',
      };
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(
        emailTemplate,
      );

      mockRenderEmailTemplate.mockRejectedValueOnce(
        new Error('Template not found'),
      );

      const variables = { appName: 'MyApp', userName: 'John' };
      const result = await service.renderEmailTemplate('template-1', variables);

      expect(result.html).toBe('Welcome John to MyApp!');
      expect(result.text).toBe('Welcome John to MyApp!');
    });
  });

  describe('renderTemplate', () => {
    it('should render template with variable substitution', async () => {
      const template = {
        ...mockTemplate,
        templateBody: 'Hello {{userName}}, welcome to {{appName}}!',
      };
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(
        template,
      );

      const variables = { userName: 'John', appName: 'MyApp' };
      const result = await service.renderTemplate('template-1', variables);

      expect(result).toBe('Hello John, welcome to MyApp!');
    });

    it('should throw NotFoundException when template not found', async () => {
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(null);

      await expect(service.renderTemplate('nonexistent', {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle missing variables gracefully', async () => {
      const template = {
        ...mockTemplate,
        templateBody: 'Hello {{userName}}, welcome to {{appName}}!',
      };
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(
        template,
      );

      const variables = { userName: 'John' }; // Missing appName
      const result = await service.renderTemplate('template-1', variables);

      expect(result).toBe('Hello John, welcome to !');
    });
  });

  describe('createTemplate', () => {
    it('should create a new template', async () => {
      const createDto: CreateTemplateDto = {
        tenantId: 'tenant-1',
        category: 'welcome',
        channel: NotificationChannelType.EMAIL,
        subject: 'Welcome',
        templateBody: 'welcome',
        variables: { userName: { required: true } },
        isActive: true,
      };

      prismaService.notificationTemplate.create.mockResolvedValueOnce(
        mockTemplate,
      );

      const result = await service.createTemplate(createDto);

      expect(result).toEqual(mockTemplate);
      expect(prismaService.notificationTemplate.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          category: 'welcome',
          channel: NotificationChannelType.EMAIL,
          subject: 'Welcome',
          templateBody: 'welcome',
          variables: { userName: { required: true } },
          isActive: true,
        },
      });
    });

    it('should create global template when tenantId is not provided', async () => {
      const createDto: CreateTemplateDto = {
        category: 'welcome',
        channel: NotificationChannelType.EMAIL,
        subject: 'Welcome',
        templateBody: 'welcome',
        variables: { userName: { required: true } },
      };

      prismaService.notificationTemplate.create.mockResolvedValueOnce(
        mockGlobalTemplate,
      );

      const result = await service.createTemplate(createDto);

      expect(result).toEqual(mockGlobalTemplate);
      expect(prismaService.notificationTemplate.create).toHaveBeenCalledWith({
        data: {
          tenantId: null,
          category: 'welcome',
          channel: NotificationChannelType.EMAIL,
          subject: 'Welcome',
          templateBody: 'welcome',
          variables: { userName: { required: true } },
          isActive: true,
        },
      });
    });
  });

  describe('updateTemplate', () => {
    it('should update an existing template', async () => {
      const updateDto: UpdateTemplateDto = {
        subject: 'Updated Welcome',
        isActive: false,
      };

      const updatedTemplate = { ...mockTemplate, ...updateDto };

      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(
        mockTemplate,
      );
      prismaService.notificationTemplate.update.mockResolvedValueOnce(
        updatedTemplate,
      );

      const result = await service.updateTemplate('template-1', updateDto);

      expect(result).toEqual(updatedTemplate);
      expect(prismaService.notificationTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: {
          tenantId: mockTemplate.tenantId,
          category: mockTemplate.category,
          channel: mockTemplate.channel,
          subject: 'Updated Welcome',
          templateBody: mockTemplate.templateBody,
          variables: mockTemplate.variables,
          isActive: false,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException when template not found', async () => {
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(null);

      await expect(service.updateTemplate('nonexistent', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTemplateById', () => {
    it('should return template by ID', async () => {
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(
        mockTemplate,
      );

      const result = await service.getTemplateById('template-1');

      expect(result).toEqual(mockTemplate);
      expect(
        prismaService.notificationTemplate.findUnique,
      ).toHaveBeenCalledWith({
        where: { id: 'template-1' },
      });
    });

    it('should return null when template not found', async () => {
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(null);

      const result = await service.getTemplateById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getTemplatesForTenant', () => {
    it('should return templates for tenant including global templates', async () => {
      const templates = [mockTemplate, mockGlobalTemplate];
      prismaService.notificationTemplate.findMany.mockResolvedValueOnce(
        templates,
      );

      const result = await service.getTemplatesForTenant('tenant-1');

      expect(result).toEqual(templates);
      expect(prismaService.notificationTemplate.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [{ tenantId: 'tenant-1' }, { tenantId: null }],
        },
        orderBy: [{ tenantId: 'desc' }, { updatedAt: 'desc' }],
      });
    });

    it('should filter by category and channel when provided', async () => {
      prismaService.notificationTemplate.findMany.mockResolvedValueOnce([
        mockTemplate,
      ]);

      await service.getTemplatesForTenant(
        'tenant-1',
        'welcome',
        NotificationChannelType.EMAIL,
      );

      expect(prismaService.notificationTemplate.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [{ tenantId: 'tenant-1' }, { tenantId: null }],
          category: 'welcome',
          channel: NotificationChannelType.EMAIL,
        },
        orderBy: [{ tenantId: 'desc' }, { updatedAt: 'desc' }],
      });
    });
  });

  describe('deleteTemplate', () => {
    it('should soft delete template by setting isActive to false', async () => {
      const deletedTemplate = { ...mockTemplate, isActive: false };

      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(
        mockTemplate,
      );
      prismaService.notificationTemplate.update.mockResolvedValueOnce(
        deletedTemplate,
      );

      const result = await service.deleteTemplate('template-1');

      expect(result).toEqual(deletedTemplate);
      expect(prismaService.notificationTemplate.update).toHaveBeenCalledWith({
        where: { id: 'template-1' },
        data: {
          isActive: false,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException when template not found', async () => {
      prismaService.notificationTemplate.findUnique.mockResolvedValueOnce(null);

      await expect(service.deleteTemplate('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateTemplateVariables', () => {
    it('should return valid when all required variables are provided', async () => {
      const template = {
        ...mockTemplate,
        variables: {
          userName: { required: true },
          appName: { required: true },
          optionalField: { required: false },
        },
      };

      const variables = { userName: 'John', appName: 'MyApp' };
      const result = service.validateTemplateVariables(template, variables);

      expect(result).toEqual({
        isValid: true,
        missingVariables: [],
      });
    });

    it('should return invalid when required variables are missing', async () => {
      const template = {
        ...mockTemplate,
        variables: {
          userName: { required: true },
          appName: { required: true },
          optionalField: { required: false },
        },
      };

      const variables = { userName: 'John' }; // Missing appName
      const result = service.validateTemplateVariables(template, variables);

      expect(result).toEqual({
        isValid: false,
        missingVariables: ['appName'],
      });
    });

    it('should handle empty variables object', async () => {
      const template = {
        ...mockTemplate,
        variables: {
          userName: { required: true },
          appName: { required: true },
        },
      };

      const variables = {};
      const result = service.validateTemplateVariables(template, variables);

      expect(result).toEqual({
        isValid: false,
        missingVariables: ['userName', 'appName'],
      });
    });
  });
});
