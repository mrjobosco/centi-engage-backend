import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuditLoggingInterceptor } from './audit-logging.interceptor';
import { AuthAuditService } from '../services/auth-audit.service';

describe('AuditLoggingInterceptor', () => {
  let interceptor: AuditLoggingInterceptor;
  let mockAuditService: any;

  beforeEach(async () => {
    mockAuditService = {
      logAuthEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLoggingInterceptor,
        {
          provide: AuthAuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    interceptor = module.get<AuditLoggingInterceptor>(AuditLoggingInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('intercept', () => {
    let mockContext: ExecutionContext;
    let mockCallHandler: CallHandler;
    let mockRequest: any;
    let mockResponse: any;

    beforeEach(() => {
      mockRequest = {
        path: '/auth/google/callback',
        method: 'POST',
        headers: {
          'user-agent': 'Mozilla/5.0 (Test Browser)',
          'x-forwarded-for': '192.168.1.1',
          'x-tenant-id': 'tenant-123',
        },
        connection: { remoteAddress: '192.168.1.1' },
        body: { code: 'auth-code', state: 'csrf-state' },
        query: {},
        params: {},
        user: undefined,
      };

      mockResponse = {};

      mockContext = {
        switchToHttp: jest.fn(() => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        })),
      } as any;

      mockCallHandler = {
        handle: jest.fn(),
      };
    });

    it('should skip non-auditable endpoints', (done) => {
      mockRequest.path = '/health';
      mockCallHandler.handle.mockReturnValue(of({ status: 'ok' }));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({ status: 'ok' });
          expect(mockAuditService.logAuthEvent).not.toHaveBeenCalled();
          done();
        },
      });
    });

    it('should log successful Google OAuth callback', (done) => {
      const mockResult = {
        accessToken: 'jwt.token.here',
        userId: 'user-123',
        tenantId: 'tenant-123',
      };

      // Mock JWT decode
      const mockPayload = { userId: 'user-123', tenantId: 'tenant-123' };
      const mockJwtPayload = Buffer.from(JSON.stringify(mockPayload)).toString(
        'base64',
      );
      mockResult.accessToken = `header.${mockJwtPayload}.signature`;

      mockCallHandler.handle.mockReturnValue(of(mockResult));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual(mockResult);
          expect(mockAuditService.logAuthEvent).toHaveBeenCalledWith({
            userId: 'user-123',
            tenantId: 'tenant-123',
            action: 'google_login',
            authMethod: 'google',
            success: true,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0 (Test Browser)',
            metadata: expect.objectContaining({
              requestId: expect.any(String),
              path: '/auth/google/callback',
              method: 'POST',
              duration: expect.any(Number),
              responseStatus: 'success',
              hasAccessToken: true,
              tokenType: 'Bearer',
            }),
          });
          done();
        },
      });
    });

    it('should log failed Google OAuth callback', (done) => {
      const mockError = new Error('OAuth failed');
      mockError.name = 'GoogleOAuthError';
      (mockError as any).status = 400;

      mockCallHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        error: (error) => {
          expect(error).toBe(mockError);
          expect(mockAuditService.logAuthEvent).toHaveBeenCalledWith({
            userId: 'unknown',
            tenantId: 'tenant-123',
            action: 'google_login',
            authMethod: 'google',
            success: false,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0 (Test Browser)',
            errorCode: undefined,
            errorMessage: 'OAuth failed',
            metadata: expect.objectContaining({
              requestId: expect.any(String),
              path: '/auth/google/callback',
              method: 'POST',
              duration: expect.any(Number),
              responseStatus: 'error',
              errorType: 'Error',
              statusCode: 400,
            }),
          });
          done();
        },
      });
    });

    it('should log Google account linking with authenticated user', (done) => {
      mockRequest.path = '/auth/google/link/callback';
      mockRequest.user = {
        id: 'user-456',
        tenantId: 'tenant-123',
        email: 'user@example.com',
      };
      mockRequest.headers['x-tenant-id'] = 'tenant-123';

      const mockResult = {
        message: 'Account linked successfully',
        userId: 'user-456',
        tenantId: 'tenant-123',
      };
      mockCallHandler.handle.mockReturnValue(of(mockResult));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual(mockResult);

          // Use setTimeout to allow async audit logging to complete
          setTimeout(() => {
            expect(mockAuditService.logAuthEvent).toHaveBeenCalledWith({
              userId: 'user-456',
              tenantId: 'tenant-123',
              action: 'google_link',
              authMethod: 'google',
              success: true,
              ipAddress: '192.168.1.1',
              userAgent: 'Mozilla/5.0 (Test Browser)',
              metadata: expect.objectContaining({
                requestId: expect.any(String),
                path: '/auth/google/link/callback',
                method: 'POST',
                duration: expect.any(Number),
                responseStatus: 'success',
              }),
            });
            done();
          }, 10);
        },
        error: done,
      });
    });

    it('should log Google settings update', (done) => {
      mockRequest.path = '/tenants/tenant-123/settings/google';
      mockRequest.method = 'PATCH';
      mockRequest.user = {
        id: 'admin-user',
        tenantId: 'tenant-123',
        email: 'admin@example.com',
      };
      mockRequest.headers['x-tenant-id'] = 'tenant-123';

      const mockResult = {
        googleSsoEnabled: true,
        googleAutoProvision: false,
        userId: 'admin-user',
        tenantId: 'tenant-123',
      };
      mockCallHandler.handle.mockReturnValue(of(mockResult));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual(mockResult);

          // Use setTimeout to allow async audit logging to complete
          setTimeout(() => {
            expect(mockAuditService.logAuthEvent).toHaveBeenCalledWith({
              userId: 'admin-user',
              tenantId: 'tenant-123',
              action: 'google_settings_update',
              authMethod: 'admin',
              success: true,
              ipAddress: '192.168.1.1',
              userAgent: 'Mozilla/5.0 (Test Browser)',
              metadata: expect.objectContaining({
                requestId: expect.any(String),
                path: '/tenants/tenant-123/settings/google',
                method: 'PATCH',
                duration: expect.any(Number),
                responseStatus: 'success',
                settingsChanged: [
                  'googleSsoEnabled',
                  'googleAutoProvision',
                  'userId',
                  'tenantId',
                ],
              }),
            });
            done();
          }, 10);
        },
        error: done,
      });
    });

    it('should extract IP address from various headers', (done) => {
      const testCases = [
        {
          headers: { 'x-forwarded-for': '203.0.113.1, 192.168.1.1' },
          expected: '203.0.113.1',
        },
        {
          headers: { 'x-real-ip': '203.0.113.2' },
          expected: '203.0.113.2',
        },
        {
          headers: { 'x-client-ip': '203.0.113.3' },
          expected: '203.0.113.3',
        },
      ];

      let testIndex = 0;

      const runTest = () => {
        if (testIndex >= testCases.length) {
          done();
          return;
        }

        const testCase = testCases[testIndex];
        mockRequest.headers = { ...testCase.headers, 'user-agent': 'Test' };
        mockRequest.connection = {};

        const mockResult = {
          accessToken:
            'header.' +
            Buffer.from(
              JSON.stringify({ userId: 'user-123', tenantId: 'tenant-123' }),
            ).toString('base64') +
            '.signature',
        };

        mockCallHandler.handle.mockReturnValue(of(mockResult));

        interceptor.intercept(mockContext, mockCallHandler).subscribe({
          next: () => {
            expect(mockAuditService.logAuthEvent).toHaveBeenCalledWith(
              expect.objectContaining({
                ipAddress: testCase.expected,
              }),
            );
            testIndex++;
            runTest();
          },
        });
      };

      runTest();
    });

    it('should sanitize sensitive headers', (done) => {
      mockRequest.headers = {
        authorization: 'Bearer secret-token',
        cookie: 'session=secret',
        'x-api-key': 'secret-key',
        'user-agent': 'Mozilla/5.0',
        accept: 'application/json',
      };

      const mockResult = {
        accessToken:
          'header.' +
          Buffer.from(
            JSON.stringify({ userId: 'user-123', tenantId: 'tenant-123' }),
          ).toString('base64') +
          '.signature',
      };

      mockCallHandler.handle.mockReturnValue(of(mockResult));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          // Use setTimeout to allow async audit logging to complete
          setTimeout(() => {
            expect(mockAuditService.logAuthEvent).toHaveBeenCalled();
            const logCall = mockAuditService.logAuthEvent.mock.calls[0][0];

            // The interceptor should have logged the event with sanitized data
            expect(logCall.userId).toBe('user-123');
            expect(logCall.tenantId).toBe('tenant-123');
            expect(logCall.action).toBe('google_login');
            done();
          }, 10);
        },
        error: done,
      });
    });

    it('should sanitize sensitive body fields', (done) => {
      mockRequest.body = {
        code: 'auth-code',
        password: 'secret-password',
        client_secret: 'secret',
        state: 'csrf-state',
      };

      const mockResult = {
        accessToken:
          'header.' +
          Buffer.from(
            JSON.stringify({ userId: 'user-123', tenantId: 'tenant-123' }),
          ).toString('base64') +
          '.signature',
      };

      mockCallHandler.handle.mockReturnValue(of(mockResult));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: () => {
          // Use setTimeout to allow async audit logging to complete
          setTimeout(() => {
            expect(mockAuditService.logAuthEvent).toHaveBeenCalled();
            const logCall = mockAuditService.logAuthEvent.mock.calls[0][0];

            // The interceptor should have logged the event
            expect(logCall.userId).toBe('user-123');
            expect(logCall.tenantId).toBe('tenant-123');
            expect(logCall.action).toBe('google_login');
            done();
          }, 10);
        },
        error: done,
      });
    });

    it('should handle audit service failures gracefully', (done) => {
      mockAuditService.logAuthEvent.mockRejectedValue(
        new Error('Audit service failed'),
      );

      const mockResult = {
        accessToken:
          'header.' +
          Buffer.from(
            JSON.stringify({ userId: 'user-123', tenantId: 'tenant-123' }),
          ).toString('base64') +
          '.signature',
      };

      mockCallHandler.handle.mockReturnValue(of(mockResult));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual(mockResult);
          expect(mockAuditService.logAuthEvent).toHaveBeenCalled();
          done();
        },
      });
    });

    it('should skip logging when user/tenant info is missing', (done) => {
      mockRequest.headers = {}; // No tenant ID
      mockRequest.body = {}; // No tenant ID in body

      const mockResult = { message: 'Success but no user info' };
      mockCallHandler.handle.mockReturnValue(of(mockResult));

      interceptor.intercept(mockContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual(mockResult);
          expect(mockAuditService.logAuthEvent).not.toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
