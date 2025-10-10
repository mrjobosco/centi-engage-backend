import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdatePreferenceDto } from './update-preference.dto';

describe('UpdatePreferenceDto', () => {
  describe('valid data', () => {
    it('should pass validation with no fields (all optional)', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all fields set to true', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        inAppEnabled: true,
        emailEnabled: true,
        smsEnabled: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all fields set to false', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        inAppEnabled: false,
        emailEnabled: false,
        smsEnabled: false,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with mixed boolean values', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        inAppEnabled: true,
        emailEnabled: false,
        smsEnabled: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only one field set', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        inAppEnabled: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('inAppEnabled validation', () => {
    it('should fail when inAppEnabled is not a boolean', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        inAppEnabled: 'true',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('inAppEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when inAppEnabled is a number', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        inAppEnabled: 1,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('inAppEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should pass when inAppEnabled is undefined (optional field)', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        inAppEnabled: undefined,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('emailEnabled validation', () => {
    it('should fail when emailEnabled is not a boolean', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        emailEnabled: 'false',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('emailEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when emailEnabled is a number', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        emailEnabled: 0,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('emailEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when emailEnabled is an object', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        emailEnabled: {},
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('emailEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });
  });

  describe('smsEnabled validation', () => {
    it('should fail when smsEnabled is not a boolean', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        smsEnabled: 'yes',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('smsEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when smsEnabled is a number', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        smsEnabled: 1,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('smsEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when smsEnabled is an array', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        smsEnabled: [],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('smsEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should pass when smsEnabled is undefined (optional field)', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        smsEnabled: undefined,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('multiple field validation', () => {
    it('should fail validation for multiple invalid fields', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        inAppEnabled: 'invalid',
        emailEnabled: 123,
        smsEnabled: 'not-boolean',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(3);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('inAppEnabled');
      expect(propertyNames).toContain('emailEnabled');
      expect(propertyNames).toContain('smsEnabled');

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isBoolean');
      });
    });

    it('should pass validation with some valid and some undefined fields', async () => {
      const dto = plainToClass(UpdatePreferenceDto, {
        inAppEnabled: true,
        emailEnabled: undefined,
        smsEnabled: false,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
