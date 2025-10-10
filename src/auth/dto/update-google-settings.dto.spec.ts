import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { UpdateGoogleSettingsDto } from './update-google-settings.dto';

describe('UpdateGoogleSettingsDto', () => {
  describe('valid data', () => {
    it('should pass validation with no fields (all optional)', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all fields set to true', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: true,
        googleAutoProvision: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all fields set to false', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: false,
        googleAutoProvision: false,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with mixed boolean values', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: true,
        googleAutoProvision: false,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only googleSsoEnabled set', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with only googleAutoProvision set', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleAutoProvision: false,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('googleSsoEnabled validation', () => {
    it('should fail when googleSsoEnabled is not a boolean', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: 'true',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('googleSsoEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when googleSsoEnabled is a number', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: 1,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('googleSsoEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when googleSsoEnabled is an object', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: { enabled: true },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('googleSsoEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when googleSsoEnabled is an array', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: [true],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('googleSsoEnabled');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should pass when googleSsoEnabled is null (optional field)', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass when googleSsoEnabled is undefined (optional field)', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: undefined,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('googleAutoProvision validation', () => {
    it('should fail when googleAutoProvision is not a boolean', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleAutoProvision: 'false',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('googleAutoProvision');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when googleAutoProvision is a number', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleAutoProvision: 0,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('googleAutoProvision');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when googleAutoProvision is a string', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleAutoProvision: 'yes',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('googleAutoProvision');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when googleAutoProvision is an object', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleAutoProvision: { provision: false },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('googleAutoProvision');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should fail when googleAutoProvision is an array', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleAutoProvision: [],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('googleAutoProvision');
      expect(errors[0].constraints).toHaveProperty('isBoolean');
    });

    it('should pass when googleAutoProvision is null (optional field)', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleAutoProvision: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass when googleAutoProvision is undefined (optional field)', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleAutoProvision: undefined,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('multiple field validation', () => {
    it('should fail validation for multiple invalid fields', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: 'invalid',
        googleAutoProvision: 123,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(2);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('googleSsoEnabled');
      expect(propertyNames).toContain('googleAutoProvision');

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isBoolean');
      });
    });

    it('should pass validation with some valid and some undefined fields', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: true,
        googleAutoProvision: undefined,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with mixed invalid types', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: 'true',
        googleAutoProvision: [false],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(2);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('googleSsoEnabled');
      expect(propertyNames).toContain('googleAutoProvision');

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isBoolean');
      });
    });

    it('should pass with opposite boolean values', async () => {
      const dto = plainToClass(UpdateGoogleSettingsDto, {
        googleSsoEnabled: false,
        googleAutoProvision: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
