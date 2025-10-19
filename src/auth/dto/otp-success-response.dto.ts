import { ApiProperty } from '@nestjs/swagger';

export class OTPVerificationSuccessDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Email verified successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Verification status',
    example: true,
  })
  verified!: boolean;

  @ApiProperty({
    description: 'Timestamp of verification',
    example: '2023-10-19T10:30:00Z',
  })
  verifiedAt!: string;
}

export class OTPResendSuccessDto {
  @ApiProperty({
    description: 'Success message',
    example: 'OTP sent successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'Email address where OTP was sent',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'OTP expiration time in minutes',
    example: 30,
  })
  expiresInMinutes!: number;

  @ApiProperty({
    description: 'Next resend allowed after (in seconds)',
    example: 60,
  })
  nextResendAfter?: number;
}
