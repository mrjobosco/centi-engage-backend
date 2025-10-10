import { SanitizeResponseInterceptor } from './sanitize-response.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('SanitizeResponseInterceptor', () => {
  let interceptor: SanitizeResponseInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new SanitizeResponseInterceptor();
    mockExecutionContext = {} as ExecutionContext;
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should remove password field from response', (done) => {
    const testData = {
      id: '1',
      email: 'test@example.com',
      password: 'secret123',
      name: 'Test User',
    };

    mockCallHandler = {
      handle: () => of(testData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toEqual({
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        });
        expect(data.password).toBeUndefined();
        done();
      },
    });
  });

  it('should remove multiple sensitive fields from response', (done) => {
    const testData = {
      id: '1',
      email: 'test@example.com',
      password: 'secret123',
      passwordHash: 'hashed',
      secret: 'my-secret',
      token: 'jwt-token',
      name: 'Test User',
    };

    mockCallHandler = {
      handle: () => of(testData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toEqual({
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        });
        expect(data.password).toBeUndefined();
        expect(data.passwordHash).toBeUndefined();
        expect(data.secret).toBeUndefined();
        expect(data.token).toBeUndefined();
        done();
      },
    });
  });

  it('should sanitize nested objects', (done) => {
    const testData = {
      id: '1',
      user: {
        email: 'test@example.com',
        password: 'secret123',
        name: 'Test User',
      },
    };

    mockCallHandler = {
      handle: () => of(testData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data.user.password).toBeUndefined();
        expect(data.user.email).toBe('test@example.com');
        expect(data.user.name).toBe('Test User');
        done();
      },
    });
  });

  it('should sanitize arrays of objects', (done) => {
    const testData = [
      {
        id: '1',
        email: 'test1@example.com',
        password: 'secret123',
      },
      {
        id: '2',
        email: 'test2@example.com',
        password: 'secret456',
      },
    ];

    mockCallHandler = {
      handle: () => of(testData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toHaveLength(2);
        expect(data[0].password).toBeUndefined();
        expect(data[1].password).toBeUndefined();
        expect(data[0].email).toBe('test1@example.com');
        expect(data[1].email).toBe('test2@example.com');
        done();
      },
    });
  });

  it('should handle null and undefined data', (done) => {
    mockCallHandler = {
      handle: () => of(null),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toBeNull();
        done();
      },
    });
  });

  it('should handle primitive values', (done) => {
    mockCallHandler = {
      handle: () => of('test string'),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data).toBe('test string');
        done();
      },
    });
  });

  it('should deeply sanitize nested structures', (done) => {
    const testData = {
      id: '1',
      users: [
        {
          email: 'test1@example.com',
          password: 'secret123',
          profile: {
            name: 'Test User',
            secret: 'hidden',
          },
        },
      ],
    };

    mockCallHandler = {
      handle: () => of(testData),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (data) => {
        expect(data.users[0].password).toBeUndefined();
        expect(data.users[0].profile.secret).toBeUndefined();
        expect(data.users[0].email).toBe('test1@example.com');
        expect(data.users[0].profile.name).toBe('Test User');
        done();
      },
    });
  });
});
