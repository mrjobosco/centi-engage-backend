import {
  IsEmail,
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  ArrayNotEmpty,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateInvitationDto {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'newuser@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Array of role IDs to assign to the invited user',
    example: ['clm123abc456def789', 'clm987zyx654wvu321'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleIds!: string[];

  @ApiPropertyOptional({
    description:
      'Custom expiration date for the invitation (ISO string). If not provided, defaults to 7 days from creation.',
    example: '2024-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Optional custom message to include in the invitation email',
    example: 'Welcome to our team! We are excited to have you join us.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  message?: string;
}
