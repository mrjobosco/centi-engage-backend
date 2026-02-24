import {
  CallHandler,
  ExecutionContext,
  StreamableFile,
} from '@nestjs/common';
import { of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';

describe('ApiResponseInterceptor', () => {
  let interceptor: ApiResponseInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  const contextWithMethod = (method: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    interceptor = new ApiResponseInterceptor();
    mockExecutionContext = contextWithMethod('GET');
  });

  it('should wrap GET responses with default message', (done) => {
    mockCallHandler = {
      handle: () => of({ id: '123' }),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toEqual({
          success: true,
          message: 'Success',
          data: { id: '123' },
        });
        done();
      },
    });
  });

  it('should set method-specific messages', (done) => {
    mockExecutionContext = contextWithMethod('POST');
    mockCallHandler = {
      handle: () => of({ id: 'new' }),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toEqual({
          success: true,
          message: 'Created successfully',
          data: { id: 'new' },
        });
        done();
      },
    });
  });

  it('should not double wrap responses that already match ApiResponse shape', (done) => {
    const wrapped = {
      success: true,
      message: 'Already wrapped',
      data: { id: '123' },
    };

    mockCallHandler = {
      handle: () => of(wrapped),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toBe(wrapped);
        done();
      },
    });
  });

  it('should normalize legacy success/message responses and preserve payload in data', (done) => {
    mockCallHandler = {
      handle: () =>
        of({
          success: true,
          message: 'Legacy response',
        }),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toEqual({
          success: true,
          message: 'Legacy response',
          data: {
            success: true,
            message: 'Legacy response',
          },
        });
        done();
      },
    });
  });

  it('should bypass StreamableFile payloads', (done) => {
    const streamable = new StreamableFile(Buffer.from('content'));

    mockCallHandler = {
      handle: () => of(streamable),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toBe(streamable);
        done();
      },
    });
  });
});
