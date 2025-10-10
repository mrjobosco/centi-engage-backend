/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { SmsChannelService } from './sms-channel.service';
import { QueueService } from '../services/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { PhoneNumberService } from '../services/phone-number.service';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationPriority } from '../enums/notification-priority.enum';
import { NotificationPayload } from '../interfaces/notification-payload.interface';

describe('SmsChannelService', () => {
  let service: SmsChannelService;
  let queueService: jest.Mocked<QueueService>;
  let prismaService: jest.Mocked<PrismaService>;
  let phoneNumberService: any;

  const mockNotificationPayload: NotificationPayload = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    category: 'test',
    type: NotificationType.INFO,
    title: 'Test SMS',
    message: 'This is a test SMS notification',
    priority: NotificationPriority.HIGH,
    data: {
      phoneNumber: '+1234567890',
    },
  };

  const mockUser = {
    id: 'user-1',
  };

  const mockNotification = {
    id: 'notification-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    type: NotificationType.INFO,
    category: 'test',
    title: 'Test SMS',
    message: 'This is a test SMS notification',
    data: { phoneNumber: '+1234567890' },
    channelsSent: [NotificationChannelType.SMS],
    readAt: null,
    createdAt: new Date(),
    expiresAt: null,
  };

  const mockDeliveryLog = {
    id: 'delivery-log-1',
    notificationId: 'notification-1',
    channel: NotificationChannelType.SMS,
    status: 'PENDING' as const,
    provider: null,
    providerMessageId: null,
    errorMessage: null,
    sentAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockQueueService = {
      addSmsJob: jest.fn(),
      getSmsQueueStats: jest.fn(),
    };

    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      notificationDeliveryLog: {
        create: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const mockPhoneNumberService = {
      getUserPhoneNumber: jest.fn(),
      parsePhoneNumber: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsChannelService,
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PhoneNumberService,
          useValue: mockPhoneNumberService,
        },
      ],
    }).compile();

    service = module.get<SmsChannelService>(SmsChannelService);
    queueService = module.get(QueueService);
    prismaService = module.get(PrismaService);
    phoneNumberService = module.get(PhoneNumberService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getChannelType', () => {
    it('should return SMS channel type', () => {
      expect(service.getChannelType()).toBe(NotificationChannelType.SMS);
    });
  });

  describe('send', () => {
    it('should successfully queue SMS notification', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog,
      );
      queueService.addSmsJob.mockResolvedValue();
      phoneNumberService.getUserPhoneNumber.mockResolvedValue('+1234567890');
      phoneNumberService.parsePhoneNumber.mockReturnValue({
        isValid: true,
        formatted: '+1234567890',
      });

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannelType.SMS);
      expect(result.messageId).toBe('notification-1');
      expect(result.deliveryLogId).toBe('delivery-log-1');
      expect(result.error).toBeUndefined();

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          tenantId: 'tenant-1',
        },
        select: {
          id: true,
        },
      });

      expect(prismaService.notification.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          userId: 'user-1',
          type: NotificationType.INFO,
          category: 'test',
          title: 'Test SMS',
          message: 'This is a test SMS notification',
          data: { phoneNumber: '+1234567890' },
          channelsSent: [NotificationChannelType.SMS],
          expiresAt: null,
        },
      });

      expect(queueService.addSmsJob).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        notificationId: 'notification-1',
        category: 'test',
        priority: NotificationPriority.HIGH,
        to: '+1234567890',
        message: 'Test SMS: This is a test SMS notification',
      });
    });

    it('should handle user not found', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.SMS);
      expect(result.error).toBe('User not found');
      expect(prismaService.notification.create).not.toHaveBeenCalled();
      expect(queueService.addSmsJob).not.toHaveBeenCalled();
    });

    it('should handle missing phone number', async () => {
      const payloadWithoutPhone = {
        ...mockNotificationPayload,
        data: {},
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      phoneNumberService.getUserPhoneNumber.mockResolvedValue(null);

      const result = await service.send(payloadWithoutPhone);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.SMS);
      expect(result.error).toBe('Phone number not available for user');
      expect(prismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should handle invalid phone number', async () => {
      const payloadWithInvalidPhone = {
        ...mockNotificationPayload,
        data: { phoneNumber: 'invalid-phone' },
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      phoneNumberService.getUserPhoneNumber.mockResolvedValue('invalid-phone');
      phoneNumberService.parsePhoneNumber.mockReturnValue({
        isValid: false,
        formatted: null,
      });

      const result = await service.send(payloadWithInvalidPhone);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.SMS);
      expect(result.error).toBe('Invalid phone number format');
      expect(prismaService.notification.create).not.toHaveBeenCalled();
    });

    it('should handle notification creation failure', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      phoneNumberService.getUserPhoneNumber.mockResolvedValue('+1234567890');
      phoneNumberService.parsePhoneNumber.mockReturnValue({
        isValid: true,
        formatted: '+1234567890',
      });
      prismaService.notification.create.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.SMS);
      expect(result.error).toBe('Database error');
      expect(queueService.addSmsJob).not.toHaveBeenCalled();
    });

    it('should handle queue job failure', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      phoneNumberService.getUserPhoneNumber.mockResolvedValue('+1234567890');
      phoneNumberService.parsePhoneNumber.mockReturnValue({
        isValid: true,
        formatted: '+1234567890',
      });
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog,
      );
      queueService.addSmsJob.mockRejectedValue(new Error('Queue error'));

      const result = await service.send(mockNotificationPayload);

      expect(result.success).toBe(false);
      expect(result.channel).toBe(NotificationChannelType.SMS);
      expect(result.error).toBe('Queue error');
    });

    it('should use default priority when not specified', async () => {
      const payloadWithoutPriority = { ...mockNotificationPayload };
      delete payloadWithoutPriority.priority;

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      phoneNumberService.getUserPhoneNumber.mockResolvedValue('+1234567890');
      phoneNumberService.parsePhoneNumber.mockReturnValue({
        isValid: true,
        formatted: '+1234567890',
      });
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog,
      );
      queueService.addSmsJob.mockResolvedValue();

      await service.send(payloadWithoutPriority);

      expect(queueService.addSmsJob).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: NotificationPriority.MEDIUM,
        }),
      );
    });

    it('should format message correctly when title equals message', async () => {
      const payloadWithSameTitleMessage = {
        ...mockNotificationPayload,
        title: 'Same message',
        message: 'Same message',
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      phoneNumberService.getUserPhoneNumber.mockResolvedValue('+1234567890');
      phoneNumberService.parsePhoneNumber.mockReturnValue({
        isValid: true,
        formatted: '+1234567890',
      });
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog,
      );
      queueService.addSmsJob.mockResolvedValue();

      await service.send(payloadWithSameTitleMessage);

      expect(queueService.addSmsJob).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Same message',
        }),
      );
    });

    it('should handle phone number from phone field', async () => {
      const payloadWithPhoneField = {
        ...mockNotificationPayload,
        data: { phone: '+9876543210' },
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      phoneNumberService.getUserPhoneNumber.mockResolvedValue('+9876543210');
      phoneNumberService.parsePhoneNumber.mockReturnValue({
        isValid: true,
        formatted: '+9876543210',
      });
      prismaService.notification.create.mockResolvedValue(mockNotification);
      prismaService.notificationDeliveryLog.create.mockResolvedValue(
        mockDeliveryLog,
      );
      queueService.addSmsJob.mockResolvedValue();

      await service.send(payloadWithPhoneField);

      expect(queueService.addSmsJob).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+9876543210',
        }),
      );
    });
  });

  describe('validate', () => {
    it('should validate correct payload', () => {
      expect(service.validate(mockNotificationPayload)).toBe(true);
    });

    it('should reject payload with past expiry date', () => {
      const pastDate = new Date(Date.now() - 86400000); // 24 hours ago
      const payloadWithPastExpiry = {
        ...mockNotificationPayload,
        expiresAt: pastDate,
      };

      expect(service.validate(payloadWithPastExpiry)).toBe(false);
    });

    it('should accept payload with future expiry date', () => {
      const futureDate = new Date(Date.now() + 86400000); // 24 hours from now
      const payloadWithFutureExpiry = {
        ...mockNotificationPayload,
        expiresAt: futureDate,
      };

      expect(service.validate(payloadWithFutureExpiry)).toBe(true);
    });

    it('should accept payload without phone number in data', () => {
      const payloadWithoutPhone = {
        ...mockNotificationPayload,
        data: {},
      };

      expect(service.validate(payloadWithoutPhone)).toBe(true);
    });

    it('should reject payload with invalid phone number', () => {
      const payloadWithInvalidPhone = {
        ...mockNotificationPayload,
        data: { phoneNumber: 'invalid' },
      };

      expect(service.validate(payloadWithInvalidPhone)).toBe(false);
    });

    it('should reject payload with message too long', () => {
      const longMessage = 'a'.repeat(1600);
      const payloadWithLongMessage = {
        ...mockNotificationPayload,
        message: longMessage,
      };

      expect(service.validate(payloadWithLongMessage)).toBe(false);
    });

    it('should accept various valid phone number formats', () => {
      const validPhoneNumbers = [
        '+1234567890',
        '+12345678901',
        '+123456789012345', // Max 15 digits
      ];

      validPhoneNumbers.forEach((phoneNumber) => {
        const payload = {
          ...mockNotificationPayload,
          data: { phoneNumber },
        };
        expect(service.validate(payload)).toBe(true);
      });
    });

    it('should reject invalid phone number formats', () => {
      const invalidPhoneNumbers = [
        '1234567890', // No country code
        '+0123456789', // Starts with 0
        '+12345678901234567', // Too long
        'abc123', // Contains letters
        '', // Empty
      ];

      invalidPhoneNumbers.forEach((phoneNumber) => {
        const payload = {
          ...mockNotificationPayload,
          data: { phoneNumber },
        };
        expect(service.validate(payload)).toBe(false);
      });
    });
  });

  describe('isAvailable', () => {
    it('should return true when database and queue are available', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      queueService.getSmsQueueStats.mockResolvedValue({
        waiting: [],
        active: [],
        completed: [],
        failed: [],
      });

      const result = await service.isAvailable();

      expect(result).toBe(true);
      expect(prismaService.$queryRaw).toHaveBeenCalled();
      expect(queueService.getSmsQueueStats).toHaveBeenCalled();
    });

    it('should return false when database is not available', async () => {
      prismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await service.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false when queue is not available', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      queueService.getSmsQueueStats.mockRejectedValue(
        new Error('Queue not available'),
      );

      const result = await service.isAvailable();

      expect(result).toBe(false);
    });
  });
});
