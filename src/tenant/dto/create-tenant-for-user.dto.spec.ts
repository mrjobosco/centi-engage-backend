import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateTenantForUserDto } from './create-tenant-for-user.dto';

describe('CreateTenantForUserDto', () => {
  const validDto = {
    tenantName: 'Acme Corporation',
    description: 'Our main business organization',
  };

  describe('valid data', () => {
    it('should pass validation with all fields', async () => {
      const dto = plainToClass(CreateTenantForUserDto, validDto);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with required fields only', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        tenantName: 'Acme Corporation',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with minimal valid tenant name', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        tenantName: 'AB',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with maximum length tenant name', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        tenantName: 'a'.repeat(50),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with maximum length description', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        tenantName: 'Test Tenant',
        description: 'a'.repeat(200),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('tenantName validation', () => {
    it('should fail when tenantName is missing', async () => {
      const { tenantName, ...dtoWithoutTenantName } = validDto;
      const dto = plainToClass(CreateTenantForUserDto, dtoWithoutTenantName);
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantName');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when tenantName is empty string', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        tenantName: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantName');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when tenantName is too short', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        tenantName: 'A',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantName');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail when tenantName is too long', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        tenantName: 'a'.repeat(51),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantName');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should fail when tenantName is not a string', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        tenantName: 123,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantName');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when tenantName is null', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        tenantName: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantName');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when tenantName is undefined', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        tenantName: undefined,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantName');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when tenantName is an object', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        tenantName: { name: 'Acme' },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantName');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when tenantName is an array', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        tenantName: ['Acme', 'Corporation'],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantName');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('description validation', () => {
    it('should pass when description is undefined (optional)', async () => {
      const { description, ...dtoWithoutDescription } = validDto;
      const dto = plainToClass(CreateTenantForUserDto, dtoWithoutDescription);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass when description is empty string', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        description: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when description is too long', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        description: 'a'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should fail when description is not a string', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        description: 123,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when description is an object', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        description: { text: 'description' },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when description is an array', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        ...validDto,
        description: ['Our', 'main', 'business'],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('description');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('edge cases and boundary conditions', () => {
    it('should handle special characters in tenant name', async () => {
      const specialNames = [
        'Acme & Co.',
        'Test-Company',
        'Company (LLC)',
        'Café & Restaurant',
        'Tech@Company',
      ];

      for (const tenantName of specialNames) {
        const dto = plainToClass(CreateTenantForUserDto, {
          tenantName,
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should handle unicode characters in tenant name', async () => {
      const unicodeNames = [
        'Société Française',
        'Компания',
        '会社名',
        'Empresa Española',
      ];

      for (const tenantName of unicodeNames) {
        const dto = plainToClass(CreateTenantForUserDto, {
          tenantName,
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should handle whitespace in tenant name', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        tenantName: '  Acme Corporation  ',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle newlines and tabs in description', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        tenantName: 'Test Company',
        description: 'Line 1\nLine 2\tTabbed content',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('multiple field validation', () => {
    it('should fail validation for all invalid fields', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        tenantName: 'A', // too short
        description: 'a'.repeat(201), // too long
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(2);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('tenantName');
      expect(propertyNames).toContain('description');
    });

    it('should fail when all fields are missing', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('tenantName');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when all fields are invalid types', async () => {
      const dto = plainToClass(CreateTenantForUserDto, {
        tenantName: 123,
        description: ['not', 'a', 'string'],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(2);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('tenantName');
      expect(propertyNames).toContain('description');

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isString');
      });
    });
  });
});
