import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

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
