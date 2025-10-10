import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AssignPermissionsDto {
  @ApiProperty({
    description: 'Array of permission IDs to assign to the user',
    example: ['permission-id-1', 'permission-id-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  permissionIds!: string[];
}
