import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { JoinTenantDto } from './join-tenant.dto';

describe('JoinTenantDto', () => {
  const validDto = {
    invitationToken:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpbnZpdGF0aW9uSWQiOiJjbWdlMXpnZWIwMDAwdmRjZ3U2bmN3NmgiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJ0ZW5hbnRJZCI6InRlbmFudC0xMjMiLCJpYXQiOjE2MzQ1Njc4OTAsImV4cCI6MTYzNDY1NDI5MH0.abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
  };

  describe('valid data', () => {
    it('should pass validation with valid invitation token', async () => {
      const dto = plainToClass(JoinTenantDto, validDto);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with minimal valid token', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: 'a',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with short token', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: 'short-token-123',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with long token', async () => {
      const longToken = 'a'.repeat(500);
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: longToken,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('invitationToken validation', () => {
    it('should fail when invitationToken is missing', async () => {
      const dto = plainToClass(JoinTenantDto, {});
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('invitationToken');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when invitationToken is empty string', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('invitationToken');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when invitationToken is null', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: null,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('invitationToken');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when invitationToken is undefined', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: undefined,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('invitationToken');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail when invitationToken is not a string', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: 123456789,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('invitationToken');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when invitationToken is an object', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: { token: 'abc123' },
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('invitationToken');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when invitationToken is an array', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: ['token1', 'token2'],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('invitationToken');
      expect(errors[0].constraints).toHaveProperty('isString');
    });

    it('should fail when invitationToken is a boolean', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: true,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('invitationToken');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('token format variations', () => {
    it('should pass validation with JWT-like token', async () => {
      const jwtToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: jwtToken,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with UUID-like token', async () => {
      const uuidToken = '550e8400-e29b-41d4-a716-446655440000';
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: uuidToken,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with random string token', async () => {
      const randomToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz';
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: randomToken,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with base64-like token', async () => {
      const base64Token = 'VGhpcyBpcyBhIHRlc3QgdG9rZW4gZm9yIGludml0YXRpb24=';
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: base64Token,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with token containing special characters', async () => {
      const specialToken = 'token-with_special.chars+and/symbols=';
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: specialToken,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('whitespace handling', () => {
    it('should pass validation with token containing leading/trailing spaces', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: '  valid-token-123  ',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with token containing internal spaces', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: 'token with spaces',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass when invitationToken is only whitespace (no trimming)', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: '   ',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass when invitationToken is only tabs and newlines (no trimming)', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: '\t\n\r',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle very long tokens', async () => {
      const veryLongToken = 'a'.repeat(10000);
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: veryLongToken,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle tokens with unicode characters', async () => {
      const unicodeToken = 'token-with-émojis-🎉-and-ñ-characters';
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: unicodeToken,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle tokens with escape sequences', async () => {
      const escapeToken = 'token\\nwith\\tescapes\\r';
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: escapeToken,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('type coercion', () => {
    it('should handle string numbers as valid tokens', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: '123456789',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle string booleans as valid tokens', async () => {
      const dto = plainToClass(JoinTenantDto, {
        invitationToken: 'true',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
