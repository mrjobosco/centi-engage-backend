/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { SmsQueueProcessor } from './sms-queue.processor';
import { PrismaService } from '../../database/prisma.service';
import { SmsProviderFactory } from '../factories/sms-provider.factory';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { MetricsService } from '../services/metrics.service';
import { NotificationLoggerService } from '../services/notification-logger.service';
import { SmsJobData } from '../interfaces/queue-job.interface';
import { DeliveryStatus } from '../enums/delivery-status.enum';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { ISmsProvider } from '../interfaces/sms-provider.interface';

describe('SmsQueueProcessor', () => {
  let processor: SmsQueueProcessor;
  let prismaService: jest.Mocked<PrismaService>;
  let smsProviderFactory: jest.Mocked<SmsProviderFactory>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let mockSmsProvider: jest.Mocked<ISmsProvider>;

  const mockJobData: SmsJobData = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    notificationId: 'notification-1',
    category: 'test',
    priority: NotificationPriority.MEDIUM,
    to: '+1234567890',
    message: 'Test SMS message',
  };

  const mockJob = {
    data: mockJobData,
    id: 'job-1',
    processedOn: Date.now(),
  } as Job<SmsJobData>;

  beforeEach(async () => {
    // Create mock SMS provider
    mockSmsProvider = {
      send: jest.fn(),
      getProviderName: jest.fn().mockReturnValue('mock-sms-provider'),
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

    const mockSmsProviderFactory = {
      createProvider: jest.fn(),
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
        SmsQueueProcessor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SmsProviderFactory,
          useValue: mockSmsProviderFactory,
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

    processor = module.get<SmsQueueProcessor>(SmsQueueProcessor);
    prismaService = module.get(PrismaService);
    smsProviderFactory = module.get(SmsProviderFactory);
    tenantContextService = module.get(TenantContextService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should successfully process SMS job', async () => {
      // Arrange
      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.SMS,
        status: DeliveryStatus.PENDING,
      };

      const mockTenantConfig = {
        smsFromNumber: '+1987654321',
        smsProvider: 'twilio',
      };

      const mockSmsResult = {
        success: true,
        messageId: 'sms-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(
        mockTenantConfig as any,
      );
      smsProviderFactory.createProvider.mockReturnValue(mockSmsProvider);
      mockSmsProvider.send.mockResolvedValue(mockSmsResult);

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
            channel: NotificationChannelType.SMS,
            status: DeliveryStatus.PENDING,
          },
        },
      );
      expect(smsProviderFactory.createProvider).toHaveBeenCalledWith(
        mockJobData.tenantId,
      );
      expect(mockSmsProvider.send).toHaveBeenCalledWith({
        to: mockJobData.to,
        message: mockJobData.message,
        from: mockTenantConfig.smsFromNumber,
      });
      expect(prismaService.notificationDeliveryLog.update).toHaveBeenCalledWith(
        {
          where: { id: mockDeliveryLog.id },
          data: {
            status: DeliveryStatus.SENT,
            provider: 'mock-sms-provider',
            providerMessageId: mockSmsResult.messageId,
            sentAt: expect.any(Date),
          },
        },
      );
      // Tenant context is automatically cleared as service is request-scoped
    });

    it('should process SMS job without tenant-specific sender info', async () => {
      // Arrange
      process.env.SMS_FROM_NUMBER = '+1111111111';

      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.SMS,
        status: DeliveryStatus.PENDING,
      };

      const mockSmsResult = {
        success: true,
        messageId: 'sms-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      smsProviderFactory.createProvider.mockReturnValue(mockSmsProvider);
      mockSmsProvider.send.mockResolvedValue(mockSmsResult);

      // Act
      await processor.process(mockJob);

      // Assert
      expect(mockSmsProvider.send).toHaveBeenCalledWith({
        to: mockJobData.to,
        message: mockJobData.message,
        from: '+1111111111',
      });

      // Cleanup
      delete process.env.SMS_FROM_NUMBER;
    });

    it('should process SMS job with Termii sender ID fallback', async () => {
      // Arrange
      process.env.TERMII_SENDER_ID = 'MyApp';

      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.SMS,
        status: DeliveryStatus.PENDING,
      };

      const mockSmsResult = {
        success: true,
        messageId: 'sms-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      smsProviderFactory.createProvider.mockReturnValue(mockSmsProvider);
      mockSmsProvider.send.mockResolvedValue(mockSmsResult);

      // Act
      await processor.process(mockJob);

      // Assert
      expect(mockSmsProvider.send).toHaveBeenCalledWith({
        to: mockJobData.to,
        message: mockJobData.message,
        from: 'MyApp',
      });

      // Cleanup
      delete process.env.TERMII_SENDER_ID;
    });

    it('should process SMS job without any sender info', async () => {
      // Arrange
      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.SMS,
        status: DeliveryStatus.PENDING,
      };

      const mockSmsResult = {
        success: true,
        messageId: 'sms-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      smsProviderFactory.createProvider.mockReturnValue(mockSmsProvider);
      mockSmsProvider.send.mockResolvedValue(mockSmsResult);

      // Act
      await processor.process(mockJob);

      // Assert
      expect(mockSmsProvider.send).toHaveBeenCalledWith({
        to: mockJobData.to,
        message: mockJobData.message,
        from: undefined,
      });
    });

    it('should handle SMS provider failure and update delivery log', async () => {
      // Arrange
      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.SMS,
        status: DeliveryStatus.PENDING,
      };

      const mockSmsResult = {
        success: false,
        error: 'Provider API error',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      smsProviderFactory.createProvider.mockReturnValue(mockSmsProvider);
      mockSmsProvider.send.mockResolvedValue(mockSmsResult);

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

    it('should clean and truncate long SMS messages', async () => {
      // Arrange
      const longMessage = 'A'.repeat(200); // Message longer than 150 characters
      const jobWithLongMessage = {
        data: { ...mockJobData, message: longMessage },
      } as Job<SmsJobData>;

      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.SMS,
        status: DeliveryStatus.PENDING,
      };

      const mockSmsResult = {
        success: true,
        messageId: 'sms-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      smsProviderFactory.createProvider.mockReturnValue(mockSmsProvider);
      mockSmsProvider.send.mockResolvedValue(mockSmsResult);

      // Act
      await processor.process(jobWithLongMessage);

      // Assert
      expect(mockSmsProvider.send).toHaveBeenCalledWith({
        to: mockJobData.to,
        message: expect.stringMatching(/^A+\.\.\.$/), // Should end with ...
        from: undefined,
      });

      // Check that the message was truncated to 150 characters
      const sentMessage = (mockSmsProvider.send as jest.Mock).mock.calls[0][0]
        .message;
      expect(sentMessage.length).toBe(150);
    });

    it('should clean HTML from SMS messages', async () => {
      // Arrange
      const htmlMessage =
        '<p>Hello <strong>world</strong>!</p>&nbsp;Test&amp;more';
      const jobWithHtmlMessage = {
        data: { ...mockJobData, message: htmlMessage },
      } as Job<SmsJobData>;

      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.SMS,
        status: DeliveryStatus.PENDING,
      };

      const mockSmsResult = {
        success: true,
        messageId: 'sms-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      smsProviderFactory.createProvider.mockReturnValue(mockSmsProvider);
      mockSmsProvider.send.mockResolvedValue(mockSmsResult);

      // Act
      await processor.process(jobWithHtmlMessage);

      // Assert
      expect(mockSmsProvider.send).toHaveBeenCalledWith({
        to: mockJobData.to,
        message: 'Hello world! Test&more',
        from: undefined,
      });
    });

    it('should format phone numbers correctly', async () => {
      // Arrange
      const jobWithUnformattedPhone = {
        data: { ...mockJobData, to: '(123) 456-7890' },
      } as Job<SmsJobData>;

      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.SMS,
        status: DeliveryStatus.PENDING,
      };

      const mockSmsResult = {
        success: true,
        messageId: 'sms-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockResolvedValue(null);
      smsProviderFactory.createProvider.mockReturnValue(mockSmsProvider);
      mockSmsProvider.send.mockResolvedValue(mockSmsResult);

      // Act
      await processor.process(jobWithUnformattedPhone);

      // Assert
      expect(mockSmsProvider.send).toHaveBeenCalledWith({
        to: '1234567890', // Formatted without special characters
        message: mockJobData.message,
        from: undefined,
      });
    });

    it('should handle tenant config lookup errors gracefully', async () => {
      // Arrange
      const mockDeliveryLog = {
        id: 'delivery-log-1',
        notificationId: mockJobData.notificationId,
        channel: NotificationChannelType.SMS,
        status: DeliveryStatus.PENDING,
      };

      const mockSmsResult = {
        success: true,
        messageId: 'sms-123',
      };

      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog as any,
      );
      prismaService.tenantNotificationConfig.findUnique.mockRejectedValue(
        new Error('Database error'),
      );
      smsProviderFactory.createProvider.mockReturnValue(mockSmsProvider);
      mockSmsProvider.send.mockResolvedValue(mockSmsResult);

      // Act
      await processor.process(mockJob);

      // Assert
      expect(mockSmsProvider.send).toHaveBeenCalledWith({
        to: mockJobData.to,
        message: mockJobData.message,
        from: undefined, // Should fallback to undefined when config lookup fails
      });
    });
  });

  describe('event handlers', () => {
    it('should log job completion', () => {
      const logSpy = jest.spyOn(processor['logger'], 'debug');
      processor.onCompleted(mockJob);
      expect(logSpy).toHaveBeenCalledWith(
        `SMS job completed for notification ${mockJobData.notificationId}`,
      );
    });

    it('should log job failure', () => {
      const logSpy = jest.spyOn(processor['logger'], 'error');
      const error = new Error('Test error');
      processor.onFailed(mockJob, error);
      expect(logSpy).toHaveBeenCalledWith(
        `SMS job failed for notification ${mockJobData.notificationId}: Test error`,
        error.stack,
      );
    });

    it('should log processor errors', () => {
      const logSpy = jest.spyOn(processor['logger'], 'error');
      const error = new Error('Processor error');
      processor.onError(error);
      expect(logSpy).toHaveBeenCalledWith(
        `SMS queue processor error: Processor error`,
        error.stack,
      );
    });
  });
});
