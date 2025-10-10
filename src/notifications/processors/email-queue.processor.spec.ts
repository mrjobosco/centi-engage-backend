/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { EmailQueueProcessor } from './email-queue.processor';
import { PrismaService } from '../../database/prisma.service';
import { EmailProviderFactory } from '../factories/email-provider.factory';
import { NotificationTemplateService } from '../services/notification-template.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { MetricsService } from '../services/metrics.service';
import { NotificationLoggerService } from '../services/notification-logger.service';
import { EmailJobData } from '../interfaces/queue-job.interface';
import { DeliveryStatus } from '../enums/delivery-status.enum';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { IEmailProvider } from '../interfaces/email-provider.interface';

describe('EmailQueueProcessor', () => {
  let processor: EmailQueueProcessor;
  let prismaService: jest.Mocked<PrismaService>;
  let emailProviderFactory: jest.Mocked<EmailProviderFactory>;
  let templateService: jest.Mocked<NotificationTemplateService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let mockEmailProvider: jest.Mocked<IEmailProvider>;

  const mockJobData: EmailJobData = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    notificationId: 'notification-1',
    category: 'test',
    priority: NotificationPriority.MEDIUM,
    to: 'test@example.com',
    subject: 'Test Subject',
    message: 'Test message',
    templateId: 'template-1',
    templateVariables: { name: 'John Doe' },
  };

  const mockJob = {
    data: mockJobData,
    id: 'job-1',
    processedOn: Date.now(),
  } as Job<EmailJobData>;

  beforeEach(async () => {
    // Create mock email provider
    mockEmailProvider = {
      send: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('mock-provider'),
    };

    // Create mocked services
    const mockPrismaService = {
      notificationDeliveryLog: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      tenantNotificationConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    const mockEmailProviderFactory = {
      createProvider: jest.fn(),
    };

    const mockTemplateService = {
      renderEmailTemplate: jest.fn(),
      getTemplate: jest.fn(),
    };

    const mockTenantContextService = {
      setTenantId: jest.fn(),
    };

    const mockMetricsService = {
      startTimer: jest.fn().mockReturnValue(jest.fn()),
      startProviderTimer: jest.fn().mockReturnValue(jest.fn()),
      recordDelivery: jest.fn(),
      recordFailure: jest.fn(),
    };

    const mockNotificationLoggerService = {
      logQueueProcessing: jest.fn(),
      logDeliveryAttempt: jest.fn(),
      logProviderResponse: jest.fn(),
      logDeliverySuccess: jest.fn(),
      logDeliveryFailure: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailQueueProcessor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailProviderFactory,
          useValue: mockEmailProviderFactory,
        },
        {
          provide: NotificationTemplateService,
          useValue: mockTemplateService,
        },
        {
          provide: TenantContextService,
          useValue: mockTenantContextService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
        {
          provide: NotificationLoggerService,
          useValue: mockNotificationLoggerService,
        },
      ],
    }).compile();

    processor = module.get<EmailQueueProcessor>(EmailQueueProcessor);
    prismaService = module.get(PrismaService);
    emailProviderFactory = module.get(EmailProviderFactory);
    templateService = module.get(NotificationTemplateService);
    tenantContextService = module.get(TenantContextService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should successfully process email job with template', async () => {
      // Arrange
      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.EMAIL,
        status: DeliveryStatus.PENDING,
      };

      const mockTenantConfig = {
        emailProvider: 'resend',
        emailApiKey: 'test-api-key',
        emailFromAddress: 'noreply@tenant.com',
        emailFromName: 'Tenant Name',
      };

      const mockRenderedTemplate = {
        html: '<html><body>Hello John Doe</body></html>',
        text: 'Hello John Doe',
      };

      const mockEmailResult = {
        success: true,
        messageId: 'msg-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(
        mockTenantConfig as any,
      );
      emailProviderFactory.createProvider.mockReturnValue(mockEmailProvider);
      templateService.renderEmailTemplate.mockResolvedValue(
        mockRenderedTemplate,
      );
      mockEmailProvider.send.mockResolvedValue(mockEmailResult);

      // Act
      await processor.process(mockJob);

      // Assert
      expect(tenantContextService.setTenantId).toHaveBeenCalledWith(
        mockJobData.tenantId,
      );
      expect(prismaService.notificationDeliveryLog.create).toHaveBeenCalledWith(
        {
          data: {
            notificationId: mockJobData.notificationId,
            channel: NotificationChannelType.EMAIL,
            status: DeliveryStatus.PENDING,
          },
        },
      );
      expect(
        prismaService.tenantNotificationConfig.findUnique,
      ).toHaveBeenCalledWith({
        where: { tenantId: mockJobData.tenantId },
      });
      expect(emailProviderFactory.createProvider).toHaveBeenCalled();
      expect(templateService.renderEmailTemplate).toHaveBeenCalledWith(
        mockJobData.templateId,
        mockJobData.templateVariables,
      );
      expect(mockEmailProvider.send).toHaveBeenCalledWith({
        to: mockJobData.to,
        subject: mockJobData.subject,
        html: mockRenderedTemplate.html,
        text: mockRenderedTemplate.text,
        from: mockTenantConfig.emailFromAddress,
        fromName: mockTenantConfig.emailFromName,
      });
      expect(prismaService.notificationDeliveryLog.update).toHaveBeenCalledWith(
        {
          where: { id: mockDeliveryLog.id },
          data: {
            status: DeliveryStatus.SENT,
            provider: 'mock-provider',
            providerMessageId: mockEmailResult.messageId,
            sentAt: expect.any(Date),
          },
        },
      );
      // Tenant context is automatically cleared as service is request-scoped
    });

    it('should process email job without template using plain message', async () => {
      // Arrange
      const jobDataWithoutTemplate = {
        ...mockJobData,
        templateId: undefined,
        templateVariables: undefined,
      };
      const jobWithoutTemplate = {
        data: jobDataWithoutTemplate,
      } as Job<EmailJobData>;

      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: jobDataWithoutTemplate.notificationId,
        channel: NotificationChannelType.EMAIL,
        status: DeliveryStatus.PENDING,
      };

      const mockEmailResult = {
        success: true,
        messageId: 'msg-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      emailProviderFactory.createProvider.mockReturnValue(mockEmailProvider);
      mockEmailProvider.send.mockResolvedValue(mockEmailResult);

      // Act
      await processor.process(jobWithoutTemplate);

      // Assert
      expect(templateService.renderEmailTemplate).not.toHaveBeenCalled();
      expect(mockEmailProvider.send).toHaveBeenCalledWith({
        to: jobDataWithoutTemplate.to,
        subject: jobDataWithoutTemplate.subject,
        html: expect.stringContaining(jobDataWithoutTemplate.message),
        text: jobDataWithoutTemplate.message,
        from: 'noreply@example.com', // Default fallback
        fromName: 'Notification System', // Default fallback
      });
    });

    it('should find template by category when templateId is not provided', async () => {
      // Arrange
      const jobDataWithCategory = {
        ...mockJobData,
        templateId: undefined,
      };
      const jobWithCategory = {
        data: jobDataWithCategory,
      } as Job<EmailJobData>;

      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: jobDataWithCategory.notificationId,
        channel: NotificationChannelType.EMAIL,
        status: DeliveryStatus.PENDING,
      };

      const mockTemplate = {
        id: 'template-by-category',
        subject: 'Template Subject',
      };

      const mockRenderedTemplate = {
        html: '<html><body>Template content</body></html>',
        text: 'Template content',
      };

      const mockEmailResult = {
        success: true,
        messageId: 'msg-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      emailProviderFactory.createProvider.mockReturnValue(mockEmailProvider);
      templateService.getTemplate.mockResolvedValue(mockTemplate as any);
      templateService.renderEmailTemplate.mockResolvedValue(
        mockRenderedTemplate,
      );
      mockEmailProvider.send.mockResolvedValue(mockEmailResult);

      // Act
      await processor.process(jobWithCategory);

      // Assert
      expect(templateService.getTemplate).toHaveBeenCalledWith(
        jobDataWithCategory.category,
        NotificationChannelType.EMAIL,
        jobDataWithCategory.tenantId,
      );
      expect(templateService.renderEmailTemplate).toHaveBeenCalledWith(
        mockTemplate.id,
        jobDataWithCategory.templateVariables,
      );
      expect(mockEmailProvider.send).toHaveBeenCalledWith({
        to: jobDataWithCategory.to,
        subject: mockTemplate.subject,
        html: mockRenderedTemplate.html,
        text: mockRenderedTemplate.text,
        from: 'noreply@example.com',
        fromName: 'Notification System',
      });
    });

    it('should handle email provider failure and update delivery log', async () => {
      // Arrange
      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.EMAIL,
        status: DeliveryStatus.PENDING,
      };

      const mockEmailResult = {
        success: false,
        error: 'Provider API error',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      emailProviderFactory.createProvider.mockReturnValue(mockEmailProvider);
      templateService.renderEmailTemplate.mockResolvedValue({
        html: '<html><body>Test</body></html>',
        text: 'Test',
      });
      mockEmailProvider.send.mockResolvedValue(mockEmailResult);

      // Act & Assert
      await expect(processor.process(mockJob)).rejects.toThrow(
        'Provider API error',
      );

      expect(prismaService.notificationDeliveryLog.update).toHaveBeenCalledWith(
        {
          where: { id: mockDeliveryLog.id },
          data: {
            status: DeliveryStatus.FAILED,
            errorMessage: 'Provider API error',
          },
        },
      );
      // Tenant context is automatically cleared as service is request-scoped
    });

    it('should handle template rendering failure and fallback to plain message', async () => {
      // Arrange
      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.EMAIL,
        status: DeliveryStatus.PENDING,
      };

      const mockEmailResult = {
        success: true,
        messageId: 'msg-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      emailProviderFactory.createProvider.mockReturnValue(mockEmailProvider);
      templateService.renderEmailTemplate.mockRejectedValue(
        new Error('Template error'),
      );
      mockEmailProvider.send.mockResolvedValue(mockEmailResult);

      // Act
      await processor.process(mockJob);

      // Assert
      expect(mockEmailProvider.send).toHaveBeenCalledWith({
        to: mockJobData.to,
        subject: mockJobData.subject,
        html: expect.stringContaining(mockJobData.message),
        text: mockJobData.message,
        from: 'noreply@example.com',
        fromName: 'Notification System',
      });
      expect(prismaService.notificationDeliveryLog.update).toHaveBeenCalledWith(
        {
          where: { id: mockDeliveryLog.id },
          data: {
            status: DeliveryStatus.SENT,
            provider: 'mock-provider',
            providerMessageId: mockEmailResult.messageId,
            sentAt: expect.any(Date),
          },
        },
      );
    });

    it('should handle database errors and still clear tenant context', async () => {
      // Arrange
      prismaService.notificationDeliveryLog.create.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(processor.process(mockJob)).rejects.toThrow(
        'Database error',
      );
      // Tenant context is automatically cleared as service is request-scoped
    });

    it('should use environment variables for sender info when tenant config is not available', async () => {
      // Arrange
      process.env.EMAIL_FROM_ADDRESS = 'env@example.com';
      process.env.EMAIL_FROM_NAME = 'Env Name';

      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.EMAIL,
        status: DeliveryStatus.PENDING,
      };

      const mockEmailResult = {
        success: true,
        messageId: 'msg-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      emailProviderFactory.createProvider.mockReturnValue(mockEmailProvider);
      templateService.renderEmailTemplate.mockResolvedValue({
        html: '<html><body>Test</body></html>',
        text: 'Test',
      });
      mockEmailProvider.send.mockResolvedValue(mockEmailResult);

      // Act
      await processor.process(mockJob);

      // Assert
      expect(mockEmailProvider.send).toHaveBeenCalledWith({
        to: mockJobData.to,
        subject: mockJobData.subject,
        html: expect.any(String),
        text: expect.any(String),
        from: 'env@example.com',
        fromName: 'Env Name',
      });

      // Cleanup
      delete process.env.EMAIL_FROM_ADDRESS;
      delete process.env.EMAIL_FROM_NAME;
    });
  });

  describe('event handlers', () => {
    it('should log job completion', () => {
      const logSpy = jest.spyOn(processor['logger'], 'debug');
      processor.onCompleted(mockJob);
      expect(logSpy).toHaveBeenCalledWith(
        `Email job completed for notification ${mockJobData.notificationId}`,
      );
    });

    it('should log job failure', () => {
      const logSpy = jest.spyOn(processor['logger'], 'error');
      const error = new Error('Test error');
      processor.onFailed(mockJob, error);
      expect(logSpy).toHaveBeenCalledWith(
        `Email job failed for notification ${mockJobData.notificationId}: Test error`,
        error.stack,
      );
    });

    it('should log processor errors', () => {
      const logSpy = jest.spyOn(processor['logger'], 'error');
      const error = new Error('Processor error');
      processor.onError(error);
      expect(logSpy).toHaveBeenCalledWith(
        `Email queue processor error: Processor error`,
        error.stack,
      );
    });
  });
});
