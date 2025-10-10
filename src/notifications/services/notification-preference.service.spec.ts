import { Test, TestingModule } from '@nestjs/testing';
import { NotificationPreferenceService } from './notification-preference.service';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { NotificationChannelType } from '../enums';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';

describe('NotificationPreferenceService', () => {
  let service: NotificationPreferenceService;
  let prismaService: any;
  let tenantContextService: jest.Mocked<TenantContextService>;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-456';
  const mockCategory = 'user_activity';

  const mockPreference = {
    id: 'pref-123',
    tenantId: mockTenantId,
    userId: mockUserId,
    category: mockCategory,
    inAppEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      notificationPreference: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        createMany: jest.fn(),
      },
    } as any;

    const mockTenantContextService = {
      getTenantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferenceService,
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

    service = module.get<NotificationPreferenceService>(
      NotificationPreferenceService,
    );
    prismaService = module.get(PrismaService);
    tenantContextService = module.get(TenantContextService);

    // Default mock setup
    tenantContextService.getTenantId.mockReturnValue(mockTenantId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserPreferences', () => {
    it('should return user preferences', async () => {
      const mockPreferences = [mockPreference];
      prismaService.notificationPreference.findMany.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.getUserPreferences(mockUserId);

      expect(result).toEqual(mockPreferences);
      expect(
        prismaService.notificationPreference.findMany,
      ).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
          userId: mockUserId,
        },
      });
    });

    it('should throw error when tenant context is missing', async () => {
      tenantContextService.getTenantId.mockReturnValue(undefined);

      await expect(service.getUserPreferences(mockUserId)).rejects.toThrow(
        'Tenant context is required',
      );
    });
  });

  describe('getEnabledChannels', () => {
    it('should return enabled channels based on user preference', async () => {
      prismaService.notificationPreference.findUnique.mockResolvedValue(
        mockPreference,
      );

      const result = await service.getEnabledChannels(mockUserId, mockCategory);

      expect(result).toEqual([
        NotificationChannelType.IN_APP,
        NotificationChannelType.EMAIL,
      ]);
      expect(
        prismaService.notificationPreference.findUnique,
      ).toHaveBeenCalledWith({
        where: {
          tenantId_userId_category: {
            tenantId: mockTenantId,
            userId: mockUserId,
            category: mockCategory,
          },
        },
      });
    });

    it('should return all enabled channels including SMS when SMS is enabled', async () => {
      const preferenceWithSms = {
        ...mockPreference,
        smsEnabled: true,
      };
      prismaService.notificationPreference.findUnique.mockResolvedValue(
        preferenceWithSms,
      );

      const result = await service.getEnabledChannels(mockUserId, mockCategory);

      expect(result).toEqual([
        NotificationChannelType.IN_APP,
        NotificationChannelType.EMAIL,
        NotificationChannelType.SMS,
      ]);
    });

    it('should return only enabled channels when some are disabled', async () => {
      const partialPreference = {
        ...mockPreference,
        emailEnabled: false,
        smsEnabled: true,
      };
      prismaService.notificationPreference.findUnique.mockResolvedValue(
        partialPreference,
      );

      const result = await service.getEnabledChannels(mockUserId, mockCategory);

      expect(result).toEqual([
        NotificationChannelType.IN_APP,
        NotificationChannelType.SMS,
      ]);
    });

    it('should return system defaults when no user preference exists', async () => {
      prismaService.notificationPreference.findUnique.mockResolvedValue(null);

      const result = await service.getEnabledChannels(mockUserId, mockCategory);

      expect(result).toEqual([
        NotificationChannelType.IN_APP,
        NotificationChannelType.EMAIL,
      ]);
    });

    it('should throw error when tenant context is missing', async () => {
      tenantContextService.getTenantId.mockReturnValue(undefined);

      await expect(
        service.getEnabledChannels(mockUserId, mockCategory),
      ).rejects.toThrow('Tenant context is required');
    });
  });

  describe('updatePreference', () => {
    const updateData: UpdatePreferenceDto = {
      inAppEnabled: false,
      emailEnabled: true,
      smsEnabled: true,
    };

    it('should update existing preference', async () => {
      const updatedPreference = {
        ...mockPreference,
        ...updateData,
      };
      prismaService.notificationPreference.upsert.mockResolvedValue(
        updatedPreference,
      );

      const result = await service.updatePreference(
        mockUserId,
        mockCategory,
        updateData,
      );

      expect(result).toEqual(updatedPreference);
      expect(prismaService.notificationPreference.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_userId_category: {
            tenantId: mockTenantId,
            userId: mockUserId,
            category: mockCategory,
          },
        },
        update: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
        create: {
          tenantId: mockTenantId,
          userId: mockUserId,
          category: mockCategory,
          inAppEnabled: updateData.inAppEnabled ?? true,
          emailEnabled: updateData.emailEnabled ?? true,
          smsEnabled: updateData.smsEnabled ?? false,
        },
      });
    });

    it('should create new preference with defaults when updating non-existing preference', async () => {
      const partialUpdateData: UpdatePreferenceDto = {
        emailEnabled: false,
      };
      const newPreference = {
        ...mockPreference,
        inAppEnabled: true, // default
        emailEnabled: false, // from update
        smsEnabled: false, // default
      };
      prismaService.notificationPreference.upsert.mockResolvedValue(
        newPreference,
      );

      const result = await service.updatePreference(
        mockUserId,
        mockCategory,
        partialUpdateData,
      );

      expect(result).toEqual(newPreference);
      expect(prismaService.notificationPreference.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_userId_category: {
            tenantId: mockTenantId,
            userId: mockUserId,
            category: mockCategory,
          },
        },
        update: {
          ...partialUpdateData,
          updatedAt: expect.any(Date),
        },
        create: {
          tenantId: mockTenantId,
          userId: mockUserId,
          category: mockCategory,
          inAppEnabled: true, // default when undefined
          emailEnabled: false, // from update
          smsEnabled: false, // default when undefined
        },
      });
    });

    it('should throw error when tenant context is missing', async () => {
      tenantContextService.getTenantId.mockReturnValue(undefined);

      await expect(
        service.updatePreference(mockUserId, mockCategory, updateData),
      ).rejects.toThrow('Tenant context is required');
    });
  });

  describe('createDefaultPreferences', () => {
    it('should create default preferences for common categories', async () => {
      prismaService.notificationPreference.createMany.mockResolvedValue({
        count: 5,
      });

      await service.createDefaultPreferences(mockUserId);

      expect(
        prismaService.notificationPreference.createMany,
      ).toHaveBeenCalledWith({
        data: [
          {
            tenantId: mockTenantId,
            userId: mockUserId,
            category: 'user_activity',
            inAppEnabled: true,
            emailEnabled: true,
            smsEnabled: false,
          },
          {
            tenantId: mockTenantId,
            userId: mockUserId,
            category: 'system',
            inAppEnabled: true,
            emailEnabled: true,
            smsEnabled: false,
          },
          {
            tenantId: mockTenantId,
            userId: mockUserId,
            category: 'invoice',
            inAppEnabled: true,
            emailEnabled: true,
            smsEnabled: false,
          },
          {
            tenantId: mockTenantId,
            userId: mockUserId,
            category: 'project',
            inAppEnabled: true,
            emailEnabled: true,
            smsEnabled: false,
          },
          {
            tenantId: mockTenantId,
            userId: mockUserId,
            category: 'security',
            inAppEnabled: true,
            emailEnabled: true,
            smsEnabled: false,
          },
        ],
        skipDuplicates: true,
      });
    });

    it('should throw error when tenant context is missing', async () => {
      tenantContextService.getTenantId.mockReturnValue(undefined);

      await expect(
        service.createDefaultPreferences(mockUserId),
      ).rejects.toThrow('Tenant context is required');
    });
  });

  describe('getAvailableCategories', () => {
    it('should return existing categories from preferences', async () => {
      const mockPreferences = [
        { category: 'user_activity' },
        { category: 'system' },
        { category: 'invoice' },
      ];
      prismaService.notificationPreference.findMany.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.getAvailableCategories();

      expect(result).toEqual(['invoice', 'system', 'user_activity']); // sorted
      expect(
        prismaService.notificationPreference.findMany,
      ).toHaveBeenCalledWith({
        where: {
          tenantId: mockTenantId,
        },
        select: {
          category: true,
        },
        distinct: ['category'],
      });
    });

    it('should return default categories when no preferences exist', async () => {
      prismaService.notificationPreference.findMany.mockResolvedValue([]);

      const result = await service.getAvailableCategories();

      expect(result).toEqual([
        'user_activity',
        'system',
        'invoice',
        'project',
        'security',
      ]);
    });

    it('should throw error when tenant context is missing', async () => {
      tenantContextService.getTenantId.mockReturnValue(undefined);

      await expect(service.getAvailableCategories()).rejects.toThrow(
        'Tenant context is required',
      );
    });
  });
});
