import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleLinkCallbackDto {
  @ApiProperty({
    description:
      'Authorization code returned from Google OAuth for account linking',
    example: '4/0AX4XfWjYZ1234567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    description: 'State parameter for CSRF protection during account linking',
    example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
  })
  @IsString()
  @IsNotEmpty()
  state!: string;
}
