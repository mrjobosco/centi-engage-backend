import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationTemplate } from '@prisma/client';
import { NotificationChannelType } from '../enums';
import { CreateTemplateDto, UpdateTemplateDto } from '../dto';
import {
  renderEmailTemplate,
  renderEmailTemplateText,
} from '../templates/email/template-renderer';
import { EmailTemplateType } from '../templates/email';

@Injectable()
export class NotificationTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get template with tenant override logic
   * Priority: tenant-specific template > global template
   */
  async getTemplate(
    category: string,
    channel: NotificationChannelType,
    tenantId?: string,
  ): Promise<NotificationTemplate | null> {
    // First try to find tenant-specific template if tenantId is provided
    if (tenantId) {
      const tenantTemplate = await this.prisma.notificationTemplate.findFirst({
        where: {
          tenantId,
          category,
          channel,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      if (tenantTemplate) {
        return tenantTemplate;
      }
    }

    // Fallback to global template
    const globalTemplate = await this.prisma.notificationTemplate.findFirst({
      where: {
        tenantId: null,
        category,
        channel,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return globalTemplate;
  }

  /**
   * Render email template using @react-email/render
   */
  async renderEmailTemplate(
    templateId: string,
    variables: Record<string, any>,
  ): Promise<{ html: string; text: string }> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    if (
      (template.channel as NotificationChannelType) !==
      NotificationChannelType.EMAIL
    ) {
      throw new Error(`Template ${templateId} is not an email template`);
    }

    // For React-email templates, the templateBody should contain the template type
    const templateType = template.templateBody as EmailTemplateType;

    try {
      // Render HTML version
      const html = await renderEmailTemplate(templateType, variables as any);

      // Render plain text version
      const text = await renderEmailTemplateText(
        templateType,
        variables as any,
      );

      return { html, text };
    } catch {
      // If React-email template fails, fallback to simple template substitution
      const html = this.substituteVariables(template.templateBody, variables);
      const text = this.stripHtml(html);

      return { html, text };
    }
  }

  /**
   * Render template with variable substitution (fallback for non-React templates)
   */
  async renderTemplate(
    templateId: string,
    variables: Record<string, any>,
  ): Promise<string> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${templateId} not found`);
    }

    return this.substituteVariables(template.templateBody, variables);
  }

  /**
   * Create a new template
   */
  async createTemplate(data: CreateTemplateDto): Promise<NotificationTemplate> {
    return this.prisma.notificationTemplate.create({
      data: {
        tenantId: data.tenantId || null,
        category: data.category,
        channel: data.channel,
        subject: data.subject,
        templateBody: data.templateBody,
        variables: data.variables,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    id: string,
    data: UpdateTemplateDto,
  ): Promise<NotificationTemplate> {
    const existingTemplate = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        tenantId:
          data.tenantId !== undefined
            ? data.tenantId
            : existingTemplate.tenantId,
        category: data.category ?? existingTemplate.category,
        channel: data.channel ?? existingTemplate.channel,
        subject:
          data.subject !== undefined ? data.subject : existingTemplate.subject,
        templateBody: data.templateBody ?? existingTemplate.templateBody,
        variables:
          data.variables ?? (existingTemplate.variables as Record<string, any>),
        isActive: data.isActive ?? existingTemplate.isActive,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<NotificationTemplate | null> {
    return this.prisma.notificationTemplate.findUnique({
      where: { id },
    });
  }

  /**
   * Get all templates for a tenant (including global templates)
   */
  async getTemplatesForTenant(
    tenantId?: string,
    category?: string,
    channel?: NotificationChannelType,
  ): Promise<NotificationTemplate[]> {
    const where: any = {
      isActive: true,
      OR: [
        { tenantId: tenantId || null },
        { tenantId: null }, // Include global templates
      ],
    };

    if (category) {
      where.category = category;
    }

    if (channel) {
      where.channel = channel;
    }

    return this.prisma.notificationTemplate.findMany({
      where,
      orderBy: [
        { tenantId: 'desc' }, // Tenant-specific templates first
        { updatedAt: 'desc' },
      ],
    });
  }

  /**
   * Delete a template (soft delete by setting isActive to false)
   */
  async deleteTemplate(id: string): Promise<NotificationTemplate> {
    const existingTemplate = await this.prisma.notificationTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Validate template variables against expected variables
   */
  validateTemplateVariables(
    template: NotificationTemplate,
    variables: Record<string, any>,
  ): { isValid: boolean; missingVariables: string[] } {
    const expectedVariables = template.variables as Record<string, any>;
    const missingVariables: string[] = [];

    // Check if all required variables are provided
    for (const [key, config] of Object.entries(expectedVariables)) {
      if (config.required && !(key in variables)) {
        missingVariables.push(key);
      }
    }

    return {
      isValid: missingVariables.length === 0,
      missingVariables,
    };
  }

  /**
   * Private method to substitute variables in template body
   */
  private substituteVariables(
    templateBody: string,
    variables: Record<string, any>,
  ): string {
    let result = templateBody;

    // Replace variables in the format {{variableName}}
    // First, replace all provided variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value || ''));
    }

    // Then, replace any remaining variables with empty string
    result = result.replace(/{{[^}]*}}/g, '');

    return result;
  }

  /**
   * Private method to strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .trim();
  }
}
