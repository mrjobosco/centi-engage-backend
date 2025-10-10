import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleCallbackDto {
  @ApiProperty({
    description: 'Authorization code returned from Google OAuth',
    example: '4/0AX4XfWjYZ1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    description: 'State parameter for CSRF protection',
    example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
  })
  @IsString()
  @IsNotEmpty()
  state!: string;

  @ApiProperty({
    description: 'Tenant ID for multi-tenant authentication',
    example: 'cmge1zgeb0000vdcgu6ncw6h8',
  })
  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}
