import { HttpException, HttpStatus } from '@nestjs/common';

export class OTPRateLimitException extends HttpException {
  constructor(retryAfter: number, message?: string) {
    const defaultMessage = `Too many OTP requests. Try again in ${retryAfter} seconds`;
    super(
      {
        message: message || defaultMessage,
        error: 'OTP Rate Limit Exceeded',
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        details: {
          retryAfter,
          canResend: false,
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
