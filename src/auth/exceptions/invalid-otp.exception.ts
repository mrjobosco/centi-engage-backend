import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidOTPException extends HttpException {
  constructor(message?: string, details?: any) {
    const defaultMessage = 'Invalid or expired OTP';
    super(
      {
        message: message || defaultMessage,
        error: 'Invalid OTP',
        statusCode: HttpStatus.BAD_REQUEST,
        ...(details && { details }),
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
