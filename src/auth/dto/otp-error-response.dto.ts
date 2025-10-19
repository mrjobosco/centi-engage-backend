import { ApiProperty } from '@nestjs/swagger';

export class OTPErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode!: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Invalid or expired OTP',
  })
  message!: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Invalid OTP',
  })
  error!: string;

  @ApiProperty({
    description: 'Additional error details',
    required: false,
    example: {
      remainingAttempts: 3,
      retryAfter: 300,
      canResend: true,
    },
  })
  details?: {
    remainingAttempts?: number;
    retryAfter?: number;
    canResend?: boolean;
  };
}
