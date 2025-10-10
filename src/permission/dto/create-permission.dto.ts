import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    description:
      'Permission name in format action:resource (e.g., read:user, manage:project)',
    example: 'manage:reports',
  })
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiProperty({
    description: 'Human-readable description of what this permission allows',
    example: 'Can create, read, update, and delete reports',
  })
  @IsNotEmpty()
  @IsString()
  description!: string;
}
