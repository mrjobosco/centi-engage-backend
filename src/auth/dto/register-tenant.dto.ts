import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterTenantDto {
  @ApiProperty({
    description: 'The name of the tenant organization',
    example: 'Acme Corporation',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  tenantName!: string;

  @ApiProperty({
    description: 'Email address for the tenant administrator',
    example: 'admin@acme.com',
  })
  @IsEmail()
  @IsNotEmpty()
  adminEmail!: string;

  @ApiProperty({
    description:
      'Password for the administrator account. Must contain at least one uppercase letter, one lowercase letter, and one number or special character',
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
  adminPassword!: string;

  @ApiProperty({
    description: 'First name of the tenant administrator',
    example: 'John',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  adminFirstName!: string;

  @ApiProperty({
    description: 'Last name of the tenant administrator',
    example: 'Doe',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  adminLastName!: string;
}
