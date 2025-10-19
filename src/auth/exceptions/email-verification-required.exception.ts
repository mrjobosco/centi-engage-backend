import { HttpException, HttpStatus } from '@nestjs/common';

export class EmailVerificationRequiredException extends HttpException {
  constructor(message?: string) {
    super(
      message || 'Email verification required to access this resource',
      HttpStatus.FORBIDDEN,
    );
  }
}
