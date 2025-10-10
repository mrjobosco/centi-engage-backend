/* eslint-disable @typescript-eslint/unbound-method */
import { NotificationPreferencesController } from './notification-preferences.controller';
import { NotificationPreferenceService } from '../services/notification-preference.service';
import { UpdatePreferenceDto } from '../dto/update-preference.dto';
import { RequestUser } from '../../auth/interfaces/request-with-user.interface';

describe('NotificationPreferencesController', () => {
  let controller: NotificationPreferencesController;
  let preferenceService: jest.Mocked<NotificationPreferenceService>;

  const mockUser: RequestUser = {
    id: 'user-123',
    email: 'test@example.com',
    tenantId: 'tenant-123',
    firstName: 'John',
    lastName: 'Doe',
    roles: [],
  };

  const mockPreference = {
    id: 'preference-123',
    tenantId: 'tenant-123',
    userId: 'user-123',
    category: 'invoice',
    inAppEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  const mockPreferences = [
    mockPreference,
    {
      ...mockPreference,
      id: 'preference-456',
      category: 'system',
    },
  ];

  beforeEach(() => {
    preferenceService = {
      getUserPreferences: jest.fn(),
      getAvailableCategories: jest.fn(),
      updatePreference: jest.fn(),
      getEnabledChannels: jest.fn(),
      createDefaultPreferences: jest.fn(),
    } as unknown as jest.Mocked<NotificationPreferenceService>;

    controller = new NotificationPreferencesController(preferenceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserPreferences', () => {
    it('should return user notification preferences', async () => {
      preferenceService.getUserPreferences.mockResolvedValue(mockPreferences);

      const result = await controller.getUserPreferences(mockUser);

      expect(result).toEqual(mockPreferences);
      expect(preferenceService.getUserPreferences).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should return empty array when user has no preferences', async () => {
      preferenceService.getUserPreferences.mockResolvedValue([]);

      const result = await controller.getUserPreferences(mockUser);

      expect(result).toEqual([]);
      expect(preferenceService.getUserPreferences).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      preferenceService.getUserPreferences.mockRejectedValue(error);

      await expect(controller.getUserPreferences(mockUser)).rejects.toThrow(
        error,
      );
    });
  });

  describe('getCategories', () => {
    it('should return available notification categories', async () => {
      const mockCategories = ['invoice', 'system', 'user_activity', 'project'];
      preferenceService.getAvailableCategories.mockResolvedValue(
        mockCategories,
      );

      const result = await controller.getCategories();

      expect(result).toEqual({ categories: mockCategories });
      expect(preferenceService.getAvailableCategories).toHaveBeenCalled();
    });

    it('should return default categories when none exist', async () => {
      const defaultCategories = [
        'user_activity',
        'system',
        'invoice',
        'project',
        'security',
      ];
      preferenceService.getAvailableCategories.mockResolvedValue(
        defaultCategories,
      );

      const result = await controller.getCategories();

      expect(result).toEqual({ categories: defaultCategories });
      expect(preferenceService.getAvailableCategories).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const error = new Error('Database error');
      preferenceService.getAvailableCategories.mockRejectedValue(error);

      await expect(controller.getCategories()).rejects.toThrow(error);
    });
  });

  describe('updatePreference', () => {
    it('should update notification preference successfully', async () => {
      const category = 'invoice';
      const updateDto: UpdatePreferenceDto = {
        inAppEnabled: true,
        emailEnabled: false,
        smsEnabled: true,
      };

      const updatedPreference = {
        ...mockPreference,
        ...updateDto,
        updatedAt: new Date(),
      };

      preferenceService.updatePreference.mockResolvedValue(updatedPreference);

      const result = await controller.updatePreference(
        mockUser,
        category,
        updateDto,
      );

      expect(result).toEqual(updatedPreference);
      expect(preferenceService.updatePreference).toHaveBeenCalledWith(
        mockUser.id,
        category,
        updateDto,
      );
    });

    it('should handle partial updates', async () => {
      const category = 'system';
      const updateDto: UpdatePreferenceDto = {
        emailEnabled: false,
      };

      const updatedPreference = {
        ...mockPreference,
        category,
        emailEnabled: false,
        updatedAt: new Date(),
      };

      preferenceService.updatePreference.mockResolvedValue(updatedPreference);

      const result = await controller.updatePreference(
        mockUser,
        category,
        updateDto,
      );

      expect(result).toEqual(updatedPreference);
      expect(preferenceService.updatePreference).toHaveBeenCalledWith(
        mockUser.id,
        category,
        updateDto,
      );
    });

    it('should create new preference if none exists', async () => {
      const category = 'new_category';
      const updateDto: UpdatePreferenceDto = {
        inAppEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
      };

      const newPreference = {
        id: 'preference-new',
        tenantId: mockUser.tenantId,
        userId: mockUser.id,
        category,
        inAppEnabled: updateDto.inAppEnabled ?? true,
        emailEnabled: updateDto.emailEnabled ?? true,
        smsEnabled: updateDto.smsEnabled ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      preferenceService.updatePreference.mockResolvedValue(newPreference);

      const result = await controller.updatePreference(
        mockUser,
        category,
        updateDto,
      );

      expect(result).toEqual(newPreference);
      expect(preferenceService.updatePreference).toHaveBeenCalledWith(
        mockUser.id,
        category,
        updateDto,
      );
    });

    it('should handle service errors', async () => {
      const category = 'invoice';
      const updateDto: UpdatePreferenceDto = {
        inAppEnabled: true,
      };
      const error = new Error('Database error');

      preferenceService.updatePreference.mockRejectedValue(error);

      await expect(
        controller.updatePreference(mockUser, category, updateDto),
      ).rejects.toThrow(error);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should have proper controller setup', () => {
      // Verify the controller is properly instantiated
      expect(controller).toBeDefined();

      expect(typeof controller.getUserPreferences).toBe('function');

      expect(typeof controller.getCategories).toBe('function');

      expect(typeof controller.updatePreference).toBe('function');
    });
  });

  describe('Tenant Isolation', () => {
    it('should only access preferences through user context', async () => {
      preferenceService.getUserPreferences.mockResolvedValue(mockPreferences);

      await controller.getUserPreferences(mockUser);

      // Verify that the service is called with the user ID from the authenticated user
      expect(preferenceService.getUserPreferences).toHaveBeenCalledWith(
        mockUser.id,
      );
    });

    it('should only update preferences for authenticated user', async () => {
      const category = 'invoice';
      const updateDto: UpdatePreferenceDto = {
        inAppEnabled: false,
      };

      preferenceService.updatePreference.mockResolvedValue(mockPreference);

      await controller.updatePreference(mockUser, category, updateDto);

      // Verify that the service is called with the user ID from the authenticated user
      expect(preferenceService.updatePreference).toHaveBeenCalledWith(
        mockUser.id,
        category,
        updateDto,
      );
    });
  });

  describe('Input Validation', () => {
    it('should accept valid boolean values for preferences', async () => {
      const category = 'invoice';
      const updateDto: UpdatePreferenceDto = {
        inAppEnabled: true,
        emailEnabled: false,
        smsEnabled: true,
      };

      preferenceService.updatePreference.mockResolvedValue(mockPreference);

      await controller.updatePreference(mockUser, category, updateDto);

      expect(preferenceService.updatePreference).toHaveBeenCalledWith(
        mockUser.id,
        category,
        updateDto,
      );
    });

    it('should handle empty update dto', async () => {
      const category = 'invoice';
      const updateDto: UpdatePreferenceDto = {};

      preferenceService.updatePreference.mockResolvedValue(mockPreference);

      await controller.updatePreference(mockUser, category, updateDto);

      expect(preferenceService.updatePreference).toHaveBeenCalledWith(
        mockUser.id,
        category,
        updateDto,
      );
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors for getUserPreferences', async () => {
      const error = new Error('Tenant context is required');
      preferenceService.getUserPreferences.mockRejectedValue(error);

      await expect(controller.getUserPreferences(mockUser)).rejects.toThrow(
        error,
      );
    });

    it('should propagate service errors for getCategories', async () => {
      const error = new Error('Tenant context is required');
      preferenceService.getAvailableCategories.mockRejectedValue(error);

      await expect(controller.getCategories()).rejects.toThrow(error);
    });

    it('should propagate service errors for updatePreference', async () => {
      const category = 'invoice';
      const updateDto: UpdatePreferenceDto = { inAppEnabled: true };
      const error = new Error('Tenant context is required');

      preferenceService.updatePreference.mockRejectedValue(error);

      await expect(
        controller.updatePreference(mockUser, category, updateDto),
      ).rejects.toThrow(error);
    });
  });
});
