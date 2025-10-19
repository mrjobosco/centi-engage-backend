import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  Length,
  IsNumberString,
  IsNotEmpty,
  Matches,
} from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    description: '6-digit OTP code sent to email',
    example: '123456',
    minLength: 6,
    maxLength: 6,
    pattern: '^[0-9]{6}$',
  })
  @IsNotEmpty({ message: 'OTP is required' })
  @IsString({ message: 'OTP must be a string' })
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @IsNumberString({}, { message: 'OTP must contain only numbers' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP must be a 6-digit number' })
  otp!: string;
}
