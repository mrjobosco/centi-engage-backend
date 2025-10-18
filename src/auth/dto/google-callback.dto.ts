import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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

  // Optional Google OAuth parameters that may be included in the callback
  @ApiProperty({
    description: 'OAuth scope returned by Google (optional)',
    required: false,
    example: 'email profile openid',
  })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiProperty({
    description: 'Authenticated user index (optional)',
    required: false,
    example: '0',
  })
  @IsOptional()
  @IsString()
  authuser?: string;

  @ApiProperty({
    description: 'Prompt parameter (optional)',
    required: false,
    example: 'consent',
  })
  @IsOptional()
  @IsString()
  prompt?: string;
}
