import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateNotificationDto } from './create-notification.dto';
import { NotificationType, NotificationPriority } from '../enums';

describe('CreateNotificationDto', () => {
  const validDto = {
    userId: 'clm123abc456def789',
    category: 'invoice',
    type: NotificationType.INFO,
    title: 'Test Notification',
    message: 'This is a test notification message',
  };

  describe('valid data', () => {
    it('should pass validation with required fields only', async () => {
      const dto = plainToClass(CreateNotificationDto, validDto);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all optional fields', async () => {
      const dtoWithOptionals = {
        ...validDto,
        data: { invoiceId: 'inv_123', amount: 100.5 },
        priority: NotificationPriority.HIGH,
        expiresAt: '2024-12-31T23:59:59.000Z',
        templateId: 'welcome-template',
        templateVariables: { userName: 'John Doe' },
      };

      const dto = plainToClass(CreateNotificationDto, dtoWithOptionals);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('userId validation', () => {
    it('should fail when userId is empty', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        userId: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('userId');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when userId is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { userId, ...dtoWithoutUserId } = validDto;
      const dto = plainToClass(CreateNotificationDto, dtoWithoutUserId);
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('userId');
    });

    it('should fail when userId is not a string', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        userId: 123,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('userId');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('category validation', () => {
    it('should fail when category is empty', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        category: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('category');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail when category exceeds max length', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        category: 'a'.repeat(51), // 51 characters
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('category');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should pass when category is at max length', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        category: 'a'.repeat(50), // 50 characters
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('type validation', () => {
    it('should fail when type is invalid', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        type: 'INVALID_TYPE',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('type');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should pass with all valid notification types', async () => {
      const types = [
        NotificationType.INFO,
        NotificationType.WARNING,
        NotificationType.SUCCESS,
        NotificationType.ERROR,
      ];

      for (const type of types) {
        const dto = plainToClass(CreateNotificationDto, {
          ...validDto,
          type,
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('title validation', () => {
    it('should fail when title is empty', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        title: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('title');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail when title exceeds max length', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        title: 'a'.repeat(256), // 256 characters
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('title');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should pass when title is at max length', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        title: 'a'.repeat(255), // 255 characters
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('message validation', () => {
    it('should fail when message is empty', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        message: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('message');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail when message exceeds max length', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        message: 'a'.repeat(1001), // 1001 characters
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('message');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should pass when message is at max length', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        message: 'a'.repeat(1000), // 1000 characters
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('optional fields validation', () => {
    it('should fail when priority is invalid', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        priority: 'INVALID_PRIORITY',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('priority');
      expect(errors[0].constraints).toHaveProperty('isEnum');
    });

    it('should pass with all valid priority levels', async () => {
      const priorities = [
        NotificationPriority.LOW,
        NotificationPriority.MEDIUM,
        NotificationPriority.HIGH,
        NotificationPriority.URGENT,
      ];

      for (const priority of priorities) {
        const dto = plainToClass(CreateNotificationDto, {
          ...validDto,
          priority,
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should fail when expiresAt is not a valid date string', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        expiresAt: 'invalid-date',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('expiresAt');
      expect(errors[0].constraints).toHaveProperty('isDateString');
    });

    it('should pass when expiresAt is a valid ISO date string', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        expiresAt: '2024-12-31T23:59:59.000Z',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when templateId exceeds max length', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        templateId: 'a'.repeat(101), // 101 characters
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('templateId');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should fail when data is not an object', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        data: 'not-an-object',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('data');
      expect(errors[0].constraints).toHaveProperty('isObject');
    });

    it('should fail when templateVariables is not an object', async () => {
      const dto = plainToClass(CreateNotificationDto, {
        ...validDto,
        templateVariables: 'not-an-object',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('templateVariables');
      expect(errors[0].constraints).toHaveProperty('isObject');
    });
  });
});
