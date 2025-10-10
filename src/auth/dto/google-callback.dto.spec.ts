import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { GoogleCallbackDto } from './google-callback.dto';

describe('GoogleCallbackDto', () => {
  describe('valid data', () => {
    it('should pass validation with all required fields', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: '4/0AX4XfWjYZ1234567890abcdef',
        state: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
        tenantId: 'cmge1zgeb0000vdcgu6ncw6h8',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with minimal valid strings', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: 'a',
        state: 'b',
        tenantId: 'c',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('code validation', () => {
    it('should fail when code is missing', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        state: 'valid-state',
        tenantId: 'valid-tenant-id',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when code is empty string', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: '',
        state: 'valid-state',
        tenantId: 'valid-tenant-id',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when code is not a string', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: 123,
        state: 'valid-state',
        tenantId: 'valid-tenant-id',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when code is null', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: null,
        state: 'valid-state',
        tenantId: 'valid-tenant-id',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when code is undefined', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: undefined,
        state: 'valid-state',
        tenantId: 'valid-tenant-id',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });

  describe('state validation', () => {
    it('should fail when state is missing', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: 'valid-code',
        tenantId: 'valid-tenant-id',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('state');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when state is empty string', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: 'valid-code',
        state: '',
        tenantId: 'valid-tenant-id',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('state');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when state is not a string', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: 'valid-code',
        state: 456,
        tenantId: 'valid-tenant-id',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('state');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when state is an object', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: 'valid-code',
        state: { value: 'state' },
        tenantId: 'valid-tenant-id',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('state');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('tenantId validation', () => {
    it('should fail when tenantId is missing', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: 'valid-code',
        state: 'valid-state',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantId');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when tenantId is empty string', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: 'valid-code',
        state: 'valid-state',
        tenantId: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantId');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when tenantId is not a string', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: 'valid-code',
        state: 'valid-state',
        tenantId: 789,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantId');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when tenantId is an array', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: 'valid-code',
        state: 'valid-state',
        tenantId: ['tenant-id'],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantId');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('multiple field validation', () => {
    it('should fail validation for all invalid fields', async () => {
      const dto = plainToClass(GoogleCallbackDto, {
        code: '',
        state: null,
        tenantId: 123,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(3);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('code');
      expect(propertyNames).toContain('state');
      expect(propertyNames).toContain('tenantId');
    });

    it('should fail when all fields are missing', async () => {
      const dto = plainToClass(GoogleCallbackDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(3);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('code');
      expect(propertyNames).toContain('state');
      expect(propertyNames).toContain('tenantId');

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isNotEmpty');
      });
    });
  });
});
