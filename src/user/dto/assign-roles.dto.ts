import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AssignRolesDto {
  @ApiProperty({
    description: 'Array of role IDs to assign to the user',
    example: ['role-id-1', 'role-id-2'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  roleIds!: string[];
}
