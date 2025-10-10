import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { NotificationFilterDto } from './notification-filter.dto';
import { NotificationType } from '../enums';

describe('NotificationFilterDto', () => {
  describe('valid data', () => {
    it('should pass validation with no filters (defaults)', async () => {
      const dto = plainToClass(NotificationFilterDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);
      expect(dto.sortBy).toBe('createdAt');
      expect(dto.sortOrder).toBe('desc');
    });

    it('should pass validation with all valid filters', async () => {
      const filterData = {
        page: 2,
        limit: 50,
        type: NotificationType.INFO,
        category: 'invoice',
        unread: true,
        sortBy: 'title',
        sortOrder: 'asc',
        search: 'test search',
      };

      const dto = plainToClass(NotificationFilterDto, filterData);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('page validation', () => {
    it('should fail when page is less than 1', async () => {
      const dto = plainToClass(NotificationFilterDto, { page: 0 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail when page is not an integer', async () => {
      const dto = plainToClass(NotificationFilterDto, { page: 1.5 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('page');
      expect(errors[0].constraints).toHaveProperty('isInt');
    });

    it('should convert string numbers to integers', async () => {
      const dto = plainToClass(NotificationFilterDto, { page: '5' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.page).toBe(5);
    });
  });

  describe('limit validation', () => {
    it('should fail when limit is less than 1', async () => {
      const dto = plainToClass(NotificationFilterDto, { limit: 0 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
      expect(errors[0].constraints).toHaveProperty('min');
    });

    it('should fail when limit exceeds 100', async () => {
      const dto = plainToClass(NotificationFilterDto, { limit: 101 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('limit');
      expect(errors[0].constraints).toHaveProperty('max');
    });

    it('should pass when limit is at maximum (100)', async () => {
      const dto = plainToClass(NotificationFilterDto, { limit: 100 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should convert string numbers to integers', async () => {
      const dto = plainToClass(NotificationFilterDto, { limit: '25' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.limit).toBe(25);
    });
  });

  describe('type validation', () => {
    it('should fail when type is invalid', async () => {
      const dto = plainToClass(NotificationFilterDto, { type: 'INVALID_TYPE' });
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
        const dto = plainToClass(NotificationFilterDto, { type });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('unread validation', () => {
    it('should convert string "true" to boolean true', async () => {
      const dto = plainToClass(NotificationFilterDto, { unread: 'true' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.unread).toBe(true);
    });

    it('should convert string "false" to boolean false', async () => {
      const dto = plainToClass(NotificationFilterDto, { unread: 'false' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.unread).toBe(false);
    });

    it('should accept boolean values directly', async () => {
      const dtoTrue = plainToClass(NotificationFilterDto, { unread: true });
      const errorsTrue = await validate(dtoTrue);
      expect(errorsTrue).toHaveLength(0);
      expect(dtoTrue.unread).toBe(true);

      const dtoFalse = plainToClass(NotificationFilterDto, { unread: false });
      const errorsFalse = await validate(dtoFalse);
      expect(errorsFalse).toHaveLength(0);
      expect(dtoFalse.unread).toBe(false);
    });

    it('should fail when unread is not a boolean or valid string', async () => {
      const dto = plainToClass(NotificationFilterDto, { unread: 'invalid' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('unread');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });
  });

  describe('sortBy validation', () => {
    it('should fail when sortBy is invalid', async () => {
      const dto = plainToClass(NotificationFilterDto, {
        sortBy: 'invalidField',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('sortBy');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should pass with all valid sort fields', async () => {
      const validFields = ['createdAt', 'readAt', 'title', 'type'];

      for (const sortBy of validFields) {
        const dto = plainToClass(NotificationFilterDto, { sortBy });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('sortOrder validation', () => {
    it('should fail when sortOrder is invalid', async () => {
      const dto = plainToClass(NotificationFilterDto, { sortOrder: 'invalid' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('sortOrder');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should pass with valid sort orders', async () => {
      const validOrders = ['asc', 'desc'];

      for (const sortOrder of validOrders) {
        const dto = plainToClass(NotificationFilterDto, { sortOrder });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('category validation', () => {
    it('should pass with valid category string', async () => {
      const dto = plainToClass(NotificationFilterDto, { category: 'invoice' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when category is not a string', async () => {
      const dto = plainToClass(NotificationFilterDto, { category: 123 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('category');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('search validation', () => {
    it('should pass with valid search string', async () => {
      const dto = plainToClass(NotificationFilterDto, {
        search: 'test search',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when search is not a string', async () => {
      const dto = plainToClass(NotificationFilterDto, { search: 123 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('search');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });
});
