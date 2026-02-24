import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponseEnvelope<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request & { method?: string }>();

    return next.handle().pipe(
      map((data) => {
        if (this.shouldBypassEnvelope(data)) {
          return data;
        }

        if (this.isAlreadyWrapped(data)) {
          return data;
        }

        if (this.isLegacyWrapped(data)) {
          const legacyData = data as { success: boolean; message: string };
          return {
            success: legacyData.success,
            message: legacyData.message,
            data: null,
          } satisfies ApiResponseEnvelope;
        }

        const method = request?.method?.toUpperCase() ?? 'GET';

        return {
          success: true,
          message: this.defaultMessageForMethod(method),
          data: data ?? null,
        } satisfies ApiResponseEnvelope;
      }),
    );
  }

  private shouldBypassEnvelope(data: unknown): boolean {
    if (data instanceof StreamableFile) {
      return true;
    }

    if (Buffer.isBuffer(data)) {
      return true;
    }

    return false;
  }

  private isAlreadyWrapped(data: unknown): data is ApiResponseEnvelope {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const candidate = data as Record<string, unknown>;

    return (
      typeof candidate.success === 'boolean' &&
      typeof candidate.message === 'string' &&
      Object.prototype.hasOwnProperty.call(candidate, 'data')
    );
  }

  private isLegacyWrapped(
    data: unknown,
  ): data is { success: boolean; message: string } {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const candidate = data as Record<string, unknown>;
    return (
      typeof candidate.success === 'boolean' &&
      typeof candidate.message === 'string'
    );
  }

  private defaultMessageForMethod(method: string): string {
    switch (method) {
      case 'POST':
        return 'Created successfully';
      case 'PUT':
      case 'PATCH':
        return 'Updated successfully';
      case 'DELETE':
        return 'Deleted successfully';
      case 'GET':
      default:
        return 'Success';
    }
  }
}
