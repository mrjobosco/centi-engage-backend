import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantForUserDto {
  @ApiProperty({
    description: 'Name of the tenant to create',
    example: 'Acme Corporation',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  tenantName!: string;

  @ApiProperty({
    description: 'Optional description for the tenant',
    example: 'Our main business organization',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
