import { Injectable } from '@nestjs/common';
import { NotificationPreference } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { NotificationChannelType } from '../enums';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';

@Injectable()
export class NotificationPreferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Get all notification preferences for a user
   * Returns user-specific preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreference[]> {
    const tenantId = this.tenantContext.getTenantId();

    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    // Get all user preferences
    const userPreferences = await this.prisma.notificationPreference.findMany({
      where: {
        tenantId,
        userId,
      },
    });

    return userPreferences;
  }

  /**
   * Get enabled channels for a specific user and category
   * Applies preference hierarchy: user preferences → system defaults
   */
  async getEnabledChannels(
    userId: string,
    category: string,
  ): Promise<NotificationChannelType[]> {
    const tenantId = this.tenantContext.getTenantId();

    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    const enabledChannels: NotificationChannelType[] = [];

    // Try to get user-specific preference for this category
    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        tenantId_userId_category: {
          tenantId,
          userId,
          category,
        },
      },
    });

    // If no user preference exists, use system defaults
    if (!preference) {
      // System defaults: in-app and email enabled, SMS disabled
      return [NotificationChannelType.IN_APP, NotificationChannelType.EMAIL];
    }

    // Build enabled channels array based on preference
    if (preference.inAppEnabled) {
      enabledChannels.push(NotificationChannelType.IN_APP);
    }
    if (preference.emailEnabled) {
      enabledChannels.push(NotificationChannelType.EMAIL);
    }
    if (preference.smsEnabled) {
      enabledChannels.push(NotificationChannelType.SMS);
    }

    return enabledChannels;
  }

  /**
   * Update notification preference for a specific user and category
   */
  async updatePreference(
    userId: string,
    category: string,
    updateData: UpdatePreferenceDto,
  ): Promise<NotificationPreference> {
    const tenantId = this.tenantContext.getTenantId();

    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    // Use upsert to create or update the preference
    const preference = await this.prisma.notificationPreference.upsert({
      where: {
        tenantId_userId_category: {
          tenantId,
          userId,
          category,
        },
      },
      update: {
        ...updateData,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        userId,
        category,
        inAppEnabled: updateData.inAppEnabled ?? true,
        emailEnabled: updateData.emailEnabled ?? true,
        smsEnabled: updateData.smsEnabled ?? false,
      },
    });

    return preference;
  }

  /**
   * Create default preferences for a new user
   * Creates system default preferences for common categories
   */
  async createDefaultPreferences(userId: string): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();

    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    // Create system default preferences for common categories
    const defaultCategories = [
      'user_activity',
      'system',
      'invoice',
      'project',
      'security',
    ];

    const defaultPreferences = defaultCategories.map((category) => ({
      tenantId,
      userId,
      category,
      inAppEnabled: true,
      emailEnabled: true,
      smsEnabled: false, // SMS disabled by default
    }));

    await this.prisma.notificationPreference.createMany({
      data: defaultPreferences,
      skipDuplicates: true,
    });
  }

  /**
   * Get all available notification categories for a tenant
   */
  async getAvailableCategories(): Promise<string[]> {
    const tenantId = this.tenantContext.getTenantId();

    if (!tenantId) {
      throw new Error('Tenant context is required');
    }

    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        tenantId,
      },
      select: {
        category: true,
      },
      distinct: ['category'],
    });

    const categories = preferences.map((p) => p.category);

    // If no categories exist, return default categories
    if (categories.length === 0) {
      return ['user_activity', 'system', 'invoice', 'project', 'security'];
    }

    return categories.sort();
  }
}
