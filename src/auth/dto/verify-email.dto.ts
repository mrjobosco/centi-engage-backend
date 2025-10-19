import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, IsNumberString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: '6-digit OTP code sent to email',
    example: '123456',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @IsNumberString({}, { message: 'OTP must contain only numbers' })
  otp!: string;
}
