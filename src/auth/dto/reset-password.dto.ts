import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'One-time password sent to email',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  otp!: string;

  @ApiProperty({
    description: 'New account password',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character',
  })
  password!: string;

  @ApiProperty({
    description:
      'Tenant identifier (optional for tenant-less users, required for tenant-scoped users)',
    required: false,
    example: 'tenant_123',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;
}
