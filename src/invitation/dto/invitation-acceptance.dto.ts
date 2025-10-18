import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum AuthMethod {
  GOOGLE = 'google',
  PASSWORD = 'password',
}

export class InvitationAcceptanceDto {
  @ApiProperty({
    description: 'The invitation token from the invitation URL',
    example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567',
  })
  @IsString()
  token!: string;

  @ApiProperty({
    description: 'Authentication method to use for account creation',
    enum: AuthMethod,
    example: AuthMethod.PASSWORD,
  })
  @IsEnum(AuthMethod)
  authMethod!: AuthMethod;

  @ApiPropertyOptional({
    description:
      'Password for account creation (required when authMethod is "password")',
    example: 'SecurePass123!',
    minLength: 8,
  })
  @ValidateIf((o) => o.authMethod === AuthMethod.PASSWORD)
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    description:
      'First name of the user (required when authMethod is "password")',
    example: 'John',
    maxLength: 100,
  })
  @ValidateIf((o) => o.authMethod === AuthMethod.PASSWORD)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  firstName?: string;

  @ApiPropertyOptional({
    description:
      'Last name of the user (required when authMethod is "password")',
    example: 'Doe',
    maxLength: 100,
  })
  @ValidateIf((o) => o.authMethod === AuthMethod.PASSWORD)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  lastName?: string;

  @ApiPropertyOptional({
    description:
      'Google OAuth authorization code (required when authMethod is "google")',
    example: '4/0AX4XfWjYZ...',
  })
  @ValidateIf((o) => o.authMethod === AuthMethod.GOOGLE)
  @IsString()
  googleAuthCode?: string;
}
