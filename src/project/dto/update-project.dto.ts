import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    description: 'The name of the project',
    example: 'Updated Project Name',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the project',
    example: 'Updated project description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
