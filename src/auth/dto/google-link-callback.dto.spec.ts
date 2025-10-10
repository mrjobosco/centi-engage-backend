import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { GoogleLinkCallbackDto } from './google-link-callback.dto';

describe('GoogleLinkCallbackDto', () => {
  describe('valid data', () => {
    it('should pass validation with all required fields', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: '4/0AX4XfWjYZ1234567890abcdef',
        state: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with minimal valid strings', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: 'a',
        state: 'b',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with long strings', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: 'a'.repeat(1000),
        state: 'b'.repeat(1000),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('code validation', () => {
    it('should fail when code is missing', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        state: 'valid-state',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when code is empty string', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: '',
        state: 'valid-state',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when code is not a string', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: 123,
        state: 'valid-state',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when code is null', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: null,
        state: 'valid-state',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when code is undefined', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: undefined,
        state: 'valid-state',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when code is boolean', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: true,
        state: 'valid-state',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('code');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('state validation', () => {
    it('should fail when state is missing', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: 'valid-code',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('state');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when state is empty string', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: 'valid-code',
        state: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('state');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when state is not a string', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: 'valid-code',
        state: 456,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('state');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when state is an object', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: 'valid-code',
        state: { value: 'state' },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('state');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when state is an array', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: 'valid-code',
        state: ['state-value'],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('state');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when state is boolean', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: 'valid-code',
        state: false,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('state');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('multiple field validation', () => {
    it('should fail validation for all invalid fields', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: '',
        state: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(2);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('code');
      expect(propertyNames).toContain('state');
    });

    it('should fail when all fields are missing', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(2);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('code');
      expect(propertyNames).toContain('state');

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isNotEmpty');
      });
    });

    it('should fail with mixed invalid types', async () => {
      const dto = plainToClass(GoogleLinkCallbackDto, {
        code: 123,
        state: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(2);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('code');
      expect(propertyNames).toContain('state');

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isString');
      });
    });
  });
});
