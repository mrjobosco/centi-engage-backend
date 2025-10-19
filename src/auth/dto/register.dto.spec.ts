import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  const validDto = {
    email: 'user@example.com',
    password: 'SecurePass123!',
    firstName: 'John',
    lastName: 'Doe',
  };

  describe('valid data', () => {
    it('should pass validation with all fields', async () => {
      const dto = plainToClass(RegisterDto, validDto);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with required fields only', async () => {
      const dto = plainToClass(RegisterDto, {
        email: 'user@example.com',
        password: 'SecurePass123!',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with minimal valid names', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        firstName: 'Jo',
        lastName: 'Do',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with maximum length names', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        firstName: 'a'.repeat(50),
        lastName: 'b'.repeat(50),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('email validation', () => {
    it('should fail when email is missing', async () => {
      const { email, ...dtoWithoutEmail } = validDto;
      const dto = plainToClass(RegisterDto, dtoWithoutEmail);
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('email');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when email is empty string', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        email: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('email');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when email is not a valid email format', async () => {
      const invalidEmails = [
        'invalid-email',
        'user@',
        '@example.com',
        'user.example.com',
        'user@.com',
        'user@example.',
      ];

      for (const email of invalidEmails) {
        const dto = plainToClass(RegisterDto, {
          ...validDto,
          email,
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(1);
        expect(errors[0].property).toBe('email');
        expect(errors[0].constraints).toHaveProperty('isEmail');
      }
    });

    it('should fail when email is not a string', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        email: 123,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('email');
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });
  });

  describe('password validation', () => {
    it('should fail when password is missing', async () => {
      const { password, ...dtoWithoutPassword } = validDto;
      const dto = plainToClass(RegisterDto, dtoWithoutPassword);
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when password is empty string', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        password: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when password is too short', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        password: 'Short1!',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail when password does not meet complexity requirements', async () => {
      const weakPasswords = [
        'password123', // no uppercase
        'PASSWORD123', // no lowercase
        'PasswordABC', // no number or special char
        'password', // too simple
        '12345678', // only numbers
        'ABCDEFGH', // only uppercase
      ];

      for (const password of weakPasswords) {
        const dto = plainToClass(RegisterDto, {
          ...validDto,
          password,
        });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        const passwordError = errors.find(
          (error) => error.property === 'password',
        );
        expect(passwordError).toBeDefined();
        expect(passwordError?.constraints).toHaveProperty('matches');
      }
    });

    it('should pass with valid complex passwords', async () => {
      const validPasswords = [
        'SecurePass123!',
        'MyPassword1',
        'Test@123',
        'ValidPass9',
        'Strong#Password1',
      ];

      for (const password of validPasswords) {
        const dto = plainToClass(RegisterDto, {
          ...validDto,
          password,
        });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should fail when password is not a string', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        password: 123456789,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('firstName validation', () => {
    it('should pass when firstName is undefined (optional)', async () => {
      const { firstName, ...dtoWithoutFirstName } = validDto;
      const dto = plainToClass(RegisterDto, dtoWithoutFirstName);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when firstName is too short', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        firstName: 'J',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('firstName');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail when firstName is too long', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        firstName: 'a'.repeat(51),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('firstName');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should fail when firstName is not a string', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        firstName: 123,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('firstName');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when firstName is empty string', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        firstName: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('firstName');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });
  });

  describe('lastName validation', () => {
    it('should pass when lastName is undefined (optional)', async () => {
      const { lastName, ...dtoWithoutLastName } = validDto;
      const dto = plainToClass(RegisterDto, dtoWithoutLastName);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when lastName is too short', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        lastName: 'D',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('lastName');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail when lastName is too long', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        lastName: 'b'.repeat(51),
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('lastName');
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should fail when lastName is not a string', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        lastName: 456,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('lastName');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when lastName is empty string', async () => {
      const dto = plainToClass(RegisterDto, {
        ...validDto,
        lastName: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('lastName');
      expect(errors[0].constraints).toHaveProperty('minLength');
    });
  });

  describe('multiple field validation', () => {
    it('should fail validation for all invalid fields', async () => {
      const dto = plainToClass(RegisterDto, {
        email: 'invalid-email',
        password: 'weak',
        firstName: 'J',
        lastName: 'D',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('email');
      expect(propertyNames).toContain('password');
      expect(propertyNames).toContain('firstName');
      expect(propertyNames).toContain('lastName');
    });

    it('should fail when all required fields are missing', async () => {
      const dto = plainToClass(RegisterDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(2);

      const propertyNames = errors.map((error) => error.property);
      expect(propertyNames).toContain('email');
      expect(propertyNames).toContain('password');

      errors.forEach((error) => {
        expect(error.constraints).toHaveProperty('isNotEmpty');
      });
    });
  });
});
