import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePreferenceDto {
  @ApiPropertyOptional({
    description: 'Enable or disable in-app notifications for this category',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable email notifications for this category',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable or disable SMS notifications for this category',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;
}
