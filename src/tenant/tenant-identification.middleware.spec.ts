import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { TenantIdentificationMiddleware } from './tenant-identification.middleware';
import { TenantContextService } from './tenant-context.service';

describe('TenantIdentificationMiddleware', () => {
  let middleware: TenantIdentificationMiddleware;
  let tenantContextService: TenantContextService;
  let configService: ConfigService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantIdentificationMiddleware,
        {
          provide: TenantContextService,
          useValue: {
            setTenantId: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'tenant.headerName') return 'x-tenant-id';
              if (key === 'tenant.enableSubdomainRouting') return false;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    middleware = module.get<TenantIdentificationMiddleware>(
      TenantIdentificationMiddleware,
    );
    tenantContextService =
      module.get<TenantContextService>(TenantContextService);
    configService = module.get<ConfigService>(ConfigService);

    mockRequest = {
      headers: {},
      hostname: 'localhost',
    };
    mockResponse = {};
    mockNext = jest.fn();
  });

  describe('use', () => {
    it('should set tenant context when tenant ID is provided in header', () => {
      mockRequest.headers = { 'x-tenant-id': 'tenant-1' };

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(tenantContextService.setTenantId).toHaveBeenCalledWith('tenant-1');
      expect(mockRequest['tenantContext']).toEqual({
        tenantId: 'tenant-1',
        isTenantRequired: false,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle tenant-less requests gracefully', () => {
      mockRequest.headers = {};

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(tenantContextService.setTenantId).not.toHaveBeenCalled();
      expect(mockRequest['tenantContext']).toEqual({
        tenantId: null,
        isTenantRequired: false,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract tenant ID from subdomain when enabled', () => {
      // Mock subdomain routing enabled
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'tenant.headerName') return 'x-tenant-id';
        if (key === 'tenant.enableSubdomainRouting') return true;
        return undefined;
      });

      // Create new middleware instance with updated config
      const middlewareWithSubdomain = new TenantIdentificationMiddleware(
        tenantContextService,
        configService,
      );

      mockRequest.headers = {};
      mockRequest = { ...mockRequest, hostname: 'tenant-1.example.com' };

      middlewareWithSubdomain.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(tenantContextService.setTenantId).toHaveBeenCalledWith('tenant-1');
      expect(mockRequest['tenantContext']).toEqual({
        tenantId: 'tenant-1',
        isTenantRequired: false,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should prioritize header over subdomain', () => {
      // Mock subdomain routing enabled
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'tenant.headerName') return 'x-tenant-id';
        if (key === 'tenant.enableSubdomainRouting') return true;
        return undefined;
      });

      const middlewareWithSubdomain = new TenantIdentificationMiddleware(
        tenantContextService,
        configService,
      );

      mockRequest.headers = { 'x-tenant-id': 'header-tenant' };
      mockRequest = {
        ...mockRequest,
        hostname: 'subdomain-tenant.example.com',
      };

      middlewareWithSubdomain.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(tenantContextService.setTenantId).toHaveBeenCalledWith(
        'header-tenant',
      );
      expect(mockRequest['tenantContext']).toEqual({
        tenantId: 'header-tenant',
        isTenantRequired: false,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle localhost gracefully with subdomain routing', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'tenant.headerName') return 'x-tenant-id';
        if (key === 'tenant.enableSubdomainRouting') return true;
        return undefined;
      });

      const middlewareWithSubdomain = new TenantIdentificationMiddleware(
        tenantContextService,
        configService,
      );

      mockRequest.headers = {};
      mockRequest = { ...mockRequest, hostname: 'localhost' };

      middlewareWithSubdomain.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(tenantContextService.setTenantId).not.toHaveBeenCalled();
      expect(mockRequest['tenantContext']).toEqual({
        tenantId: null,
        isTenantRequired: false,
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
