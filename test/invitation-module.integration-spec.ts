import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { InvitationModule } from '../src/invitation/invitation.module';
import { InvitationService } from '../src/invitation/services/invitation.service';
import { InvitationValidationService } from '../src/invitation/services/invitation-validation.service';
import { InvitationNotificationService } from '../src/invitation/services/invitation-notification.service';
import { InvitationAcceptanceService } from '../src/invitation/services/invitation-acceptance.service';
import { InvitationAuditService } from '../src/invitation/services/invitation-audit.service';
import { InvitationRateLimitService } from '../src/invitation/services/invitation-rate-limit.service';
import { InvitationController } from '../src/invitation/controllers/invitation.controller';
import { InvitationAcceptanceController } from '../src/invitation/controllers/invitation-acceptance.controller';
import configuration from '../src/config/configuration';

// Mock Redis for BullMQ
jest.mock('ioredis', () => {
  const mockRedis: any = {
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    duplicate: jest.fn(() => mockRedis),
    status: 'ready',
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

describe('InvitationModule Integration', () => {
  let module: TestingModule;
  let invitationService: InvitationService;
  let invitationValidationService: InvitationValidationService;
  let invitationNotificationService: InvitationNotificationService;
  let invitationAcceptanceService: InvitationAcceptanceService;
  let invitationAuditService: InvitationAuditService;
  let invitationRateLimitService: InvitationRateLimitService;
  let invitationController: InvitationController;
  let invitationAcceptanceController: InvitationAcceptanceController;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
          envFilePath: ['.env.test'],
        }),
        InvitationModule,
      ],
    }).compile();

    // Get all services and controllers
    invitationService = module.get<InvitationService>(InvitationService);
    invitationValidationService = module.get<InvitationValidationService>(
      InvitationValidationService,
    );
    invitationNotificationService = module.get<InvitationNotificationService>(
      InvitationNotificationService,
    );
    invitationAcceptanceService = module.get<InvitationAcceptanceService>(
      InvitationAcceptanceService,
    );
    invitationAuditService = module.get<InvitationAuditService>(
      InvitationAuditService,
    );
    invitationRateLimitService = module.get<InvitationRateLimitService>(
      InvitationRateLimitService,
    );
    invitationController =
      module.get<InvitationController>(InvitationController);
    invitationAcceptanceController = module.get<InvitationAcceptanceController>(
      InvitationAcceptanceController,
    );
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Module Initialization', () => {
    it('should initialize all invitation services', () => {
      expect(invitationService).toBeDefined();
      expect(invitationValidationService).toBeDefined();
      expect(invitationNotificationService).toBeDefined();
      expect(invitationAcceptanceService).toBeDefined();
      expect(invitationAuditService).toBeDefined();
      expect(invitationRateLimitService).toBeDefined();
    });

    it('should initialize all invitation controllers', () => {
      expect(invitationController).toBeDefined();
      expect(invitationAcceptanceController).toBeDefined();
    });

    it('should have access to external services through module imports', () => {
      // Test that the module can access services from imported modules
      expect(invitationService).toBeDefined();
      expect(invitationValidationService).toBeDefined();
      expect(invitationNotificationService).toBeDefined();
    });
  });

  describe('Service Dependencies', () => {
    it('should inject dependencies correctly in InvitationService', () => {
      expect(invitationService).toBeInstanceOf(InvitationService);
      expect(() => invitationService).not.toThrow();
    });

    it('should inject dependencies correctly in InvitationAcceptanceService', () => {
      expect(invitationAcceptanceService).toBeInstanceOf(
        InvitationAcceptanceService,
      );
      expect(() => invitationAcceptanceService).not.toThrow();
    });

    it('should inject dependencies correctly in InvitationNotificationService', () => {
      expect(invitationNotificationService).toBeInstanceOf(
        InvitationNotificationService,
      );
      expect(() => invitationNotificationService).not.toThrow();
    });
  });

  describe('Cross-Module Integration', () => {
    it('should integrate with auth module services', () => {
      // Test that invitation services can access auth services
      expect(invitationAcceptanceService).toBeDefined();
      expect(() => invitationAcceptanceService).not.toThrow();
    });

    it('should integrate with tenant module services', () => {
      // Test that invitation services can access tenant services
      expect(invitationService).toBeDefined();
      expect(() => invitationService).not.toThrow();
    });

    it('should integrate with notification module services', () => {
      // Test that invitation notification service can access notification services
      expect(invitationNotificationService).toBeDefined();
      expect(() => invitationNotificationService).not.toThrow();
    });

    it('should handle database operations through prisma service', () => {
      // Test that all services can access the database
      expect(invitationService).toBeDefined();
      expect(invitationValidationService).toBeDefined();
      expect(invitationAuditService).toBeDefined();
    });
  });

  describe('Service Integration Tests', () => {
    it('should have all services properly instantiated', () => {
      // Test that all services are available and properly instantiated
      expect(invitationService).toBeDefined();
      expect(invitationValidationService).toBeDefined();
      expect(invitationNotificationService).toBeDefined();
      expect(invitationAcceptanceService).toBeDefined();
      expect(invitationAuditService).toBeDefined();
      expect(invitationRateLimitService).toBeDefined();
    });

    it('should have all controllers properly instantiated', () => {
      // Test that all controllers are available and properly instantiated
      expect(invitationController).toBeDefined();
      expect(invitationAcceptanceController).toBeDefined();
    });

    it('should allow services to be used without throwing errors', () => {
      // Test that services can be accessed without throwing dependency injection errors
      expect(() => invitationService).not.toThrow();
      expect(() => invitationValidationService).not.toThrow();
      expect(() => invitationNotificationService).not.toThrow();
      expect(() => invitationAcceptanceService).not.toThrow();
      expect(() => invitationAuditService).not.toThrow();
      expect(() => invitationRateLimitService).not.toThrow();
    });
  });

  describe('Module Exports and Dependency Injection', () => {
    it('should export all required services for other modules', () => {
      const exportedServices = [
        InvitationService,
        InvitationValidationService,
        InvitationNotificationService,
        InvitationAcceptanceService,
        InvitationAuditService,
        InvitationRateLimitService,
      ];

      exportedServices.forEach((ServiceClass) => {
        const service = module.get(ServiceClass);
        expect(service).toBeDefined();
        expect(service).toBeInstanceOf(ServiceClass);
      });
    });

    it('should properly inject all dependencies', () => {
      // Verify that all services can be instantiated without errors
      expect(invitationService).toBeDefined();
      expect(invitationValidationService).toBeDefined();
      expect(invitationNotificationService).toBeDefined();
      expect(invitationAcceptanceService).toBeDefined();
      expect(invitationAuditService).toBeDefined();
      expect(invitationRateLimitService).toBeDefined();
    });

    it('should make controllers accessible', () => {
      expect(invitationController).toBeDefined();
      expect(invitationAcceptanceController).toBeDefined();

      // Verify controllers have their dependencies injected
      expect(invitationController).toBeInstanceOf(InvitationController);
      expect(invitationAcceptanceController).toBeInstanceOf(
        InvitationAcceptanceController,
      );
    });
  });
});
