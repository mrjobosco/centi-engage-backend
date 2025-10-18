import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvitationStatus } from '../enums';

export class InvitationValidationResponseDto {
  @ApiProperty({
    description: 'Whether the invitation token is valid',
    example: true,
  })
  isValid!: boolean;

  @ApiProperty({
    description: 'Current status of the invitation',
    enum: InvitationStatus,
    example: InvitationStatus.PENDING,
  })
  status!: InvitationStatus;

  @ApiPropertyOptional({
    description: 'Invitation details if valid',
  })
  invitation?: {
    id: string;
    email: string;
    expiresAt: string;
    tenant: {
      id: string;
      name: string;
    };
    roles: Array<{
      id: string;
      name: string;
    }>;
    message?: string;
  };

  @ApiPropertyOptional({
    description: 'Error message if invitation is invalid',
    example: 'Invitation has expired',
  })
  error?: string;
}
