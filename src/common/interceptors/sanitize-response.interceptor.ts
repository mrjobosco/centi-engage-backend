import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class SanitizeResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.sanitize(data)));
  }

  private sanitize(data: any): any {
    if (!data) {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    // Handle objects
    if (typeof data === 'object') {
      const sanitized = { ...data };

      // Remove sensitive fields
      const sensitiveFields = ['password', 'passwordHash', 'secret', 'token'];

      for (const field of sensitiveFields) {
        if (field in sanitized) {
          delete sanitized[field];
        }
      }

      // Recursively sanitize nested objects
      for (const key in sanitized) {
        if (sanitized[key] && typeof sanitized[key] === 'object') {
          sanitized[key] = this.sanitize(sanitized[key]);
        }
      }

      return sanitized;
    }

    return data;
  }
}
