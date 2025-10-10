import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    description: 'Permission action (e.g., create, read, update, delete)',
    example: 'read',
  })
  @IsNotEmpty()
  @IsString()
  action!: string;

  @ApiProperty({
    description: 'Permission subject/resource (e.g., User, Project, Role)',
    example: 'Project',
  })
  @IsNotEmpty()
  @IsString()
  subject!: string;
}
