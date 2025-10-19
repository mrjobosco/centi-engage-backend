import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResendOTPDto {
  @ApiProperty({
    description: 'Email address to resend OTP to',
    example: 'user@example.com',
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'Email is required' })
  @IsString({ message: 'Email must be a string' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email!: string;
}
