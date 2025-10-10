import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({
    description: 'The name of the role',
    example: 'Super Admin',
  })
  @IsNotEmpty()
  @IsString()
  name!: string;
}
