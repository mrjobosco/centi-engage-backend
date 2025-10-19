import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class JoinTenantDto {
  @ApiProperty({
    description:
      'Invitation token to join the tenant. Must be a valid, non-expired invitation token.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  invitationToken!: string;
}
