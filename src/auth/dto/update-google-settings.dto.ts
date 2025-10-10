import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateGoogleSettingsDto {
  @ApiProperty({
    description: 'Enable or disable Google SSO for the tenant',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  googleSsoEnabled?: boolean;

  @ApiProperty({
    description:
      'Enable or disable automatic user provisioning for Google sign-ins',
    example: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  googleAutoProvision?: boolean;
}
