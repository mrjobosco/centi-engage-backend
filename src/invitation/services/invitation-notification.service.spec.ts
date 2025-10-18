import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { InvitationNotificationService } from './invitation-notification.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { NotificationTemplateService } from '../../notifications/services/notification-template.service';
import { NotificationChannelType } from '../../notifications/enums/notification-channel.enum';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationPriority } from '../../notifications/enums/notification-priority.enum';
import { TenantInvitationWithRelations } from '../interfaces/tenant-invitation.interface';
import { InvitationEmailData } from './invitation-notification.service';

// Mock the template renderer
jest.mock('../../notifications/templates/email/template-renderer', () => ({
  renderEmailTemplate: jest.fn(),
}));

describe('InvitationNotificationService', () => {
  let service: InvitationNotificationService;
  let notificationService: jest.Mocked<NotificationService>;
  let templateService: jest.Mocked<NotificationTemplateService>;

  const mockInvitation: TenantInvitationWithRelations = {
    id: 'inv_123',
    tenantId: 'tenant_123',
    email: 'test@example.com',
    token: 'secure_token_123',
    invitedBy: 'user_123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    acceptedAt: null,
    cancelledAt: null,
    status: 'PENDING',
    message: 'Welcome to our team!',
    createdAt: new Date(),
    updatedAt: new Date(),
    tenant: {
      id: 'tenant_123',
      name: 'Test Organization',
      subdomain: 'test-org',
    },
    inviter: {
      id: 'user_123',
      email: 'admin@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
    roles: [
      {
        id: 'role_123',
        name: 'Developer',
      },
    ],
  };

  const mockNotification = {
    id: 'notif_123',
    tenantId: 'tenant_123',
    userId: null,
    type: NotificationType.INFO,
    category: 'tenant-invitation',
    title: 'Invitation to join Test Organization',
    message: "You've been invited to join Test Organization",
    channelsSent: [NotificationChannelType.EMAIL],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockNotificationService = {
      create: jest.fn(),
      sendToUser: jest.fn(),
    };

    const mockTemplateService = {
      getTemplate: jest.fn(),
      renderEmailTemplate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitationNotificationService,
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: NotificationTemplateService,
          useValue: mockTemplateService,
        },
      ],
    }).compile();

    service = module.get<InvitationNotificationService>(
      InvitationNotificationService,
    );
    notificationService = module.get(NotificationService);
    templateService = module.get(NotificationTemplateService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendInvitationEmail', () => {
    const mockEmailData: InvitationEmailData = {
      invitation: mockInvitation,
      invitationUrl:
        'https://app.example.com/accept-invitation/secure_token_123',
      customMessage: 'Welcome to our team!',
      companyName: 'Test Company',
      supportEmail: 'support@example.com',
    };

    it('should send invitation email successfully using built-in template', async () => {
      // Mock template service to return no custom template
      templateService.getTemplate.mockResolvedValue(null);

      // Mock the renderEmailTemplate function
      const {
        renderEmailTemplate,
      } = require('../../notifications/templates/email/template-renderer');
      renderEmailTemplate.mockResolvedValue('<html>Invitation Email</html>');

      // Mock notification service
      notificationService.create.mockResolvedValue(mockNotification as any);

      const result = await service.sendInvitationEmail(mockEmailData);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif_123');
      expect(result.deliveryChannels).toEqual([NotificationChannelType.EMAIL]);

      expect(templateService.getTemplate).toHaveBeenCalledWith(
        'tenant-invitation',
        NotificationChannelType.EMAIL,
        'tenant_123',
      );

      expect(renderEmailTemplate).toHaveBeenCalledWith(
        'tenant-invitation',
        expect.objectContaining({
          inviteeEmail: 'test@example.com',
          inviterName: 'John Doe',
          tenantName: 'Test Organization',
          roles: ['Developer'],
          invitationUrl: mockEmailData.invitationUrl,
          expiresAt: mockInvitation.expiresAt,
          customMessage: 'Welcome to our team!',
          companyName: 'Test Company',
          supportEmail: 'support@example.com',
        }),
      );

      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant_123',
          userId: null,
          type: NotificationType.INFO,
          category: 'tenant-invitation',
          title: 'Invitation to join Test Organization',
          priority: NotificationPriority.HIGH,
          emailData: expect.objectContaining({
            to: 'test@example.com',
            subject: "You're invited to join Test Organization",
            html: '<html>Invitation Email</html>',
          }),
        }),
      );
    });

    it('should use custom template when available', async () => {
      const mockCustomTemplate = {
        id: 'template_123',
        category: 'tenant-invitation',
        channel: NotificationChannelType.EMAIL,
        templateBody: 'custom-template-type',
        isActive: true,
      };

      templateService.getTemplate.mockResolvedValue(mockCustomTemplate as any);
      templateService.renderEmailTemplate.mockResolvedValue({
        html: '<html>Custom Template</html>',
        text: 'Custom Template Text',
      });
      notificationService.create.mockResolvedValue(mockNotification as any);

      const result = await service.sendInvitationEmail(mockEmailData);

      expect(result.success).toBe(true);
      expect(templateService.renderEmailTemplate).toHaveBeenCalledWith(
        'template_123',
        expect.any(Object),
      );
    });

    it('should handle email sending errors gracefully', async () => {
      templateService.getTemplate.mockResolvedValue(null);

      const {
        renderEmailTemplate,
      } = require('../../notifications/templates/email/template-renderer');
      renderEmailTemplate.mockResolvedValue('<html>Invitation Email</html>');

      notificationService.create.mockRejectedValue(
        new Error('Email service unavailable'),
      );

      const result = await service.sendInvitationEmail(mockEmailData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email service unavailable');
      expect(result.notificationId).toBeUndefined();
    });

    it('should handle missing inviter information gracefully', async () => {
      const invitationWithoutInviter = {
        ...mockInvitation,
        inviter: {
          id: 'user_123',
          email: 'admin@example.com',
          firstName: null,
          lastName: null,
        },
      };

      const emailDataWithoutInviter = {
        ...mockEmailData,
        invitation: invitationWithoutInviter,
      };

      templateService.getTemplate.mockResolvedValue(null);

      const {
        renderEmailTemplate,
      } = require('../../notifications/templates/email/template-renderer');
      renderEmailTemplate.mockResolvedValue('<html>Invitation Email</html>');

      notificationService.create.mockResolvedValue(mockNotification as any);

      const result = await service.sendInvitationEmail(emailDataWithoutInviter);

      expect(result.success).toBe(true);
      expect(renderEmailTemplate).toHaveBeenCalledWith(
        'tenant-invitation',
        expect.objectContaining({
          inviterName: 'admin@example.com', // Should fallback to email
        }),
      );
    });
  });

  describe('sendInvitationReminder', () => {
    const mockEmailData: InvitationEmailData = {
      invitation: mockInvitation,
      invitationUrl:
        'https://app.example.com/accept-invitation/secure_token_123',
      customMessage: 'Welcome to our team!',
    };

    it('should send reminder email with updated message', async () => {
      templateService.getTemplate.mockResolvedValue(null);

      const {
        renderEmailTemplate,
      } = require('../../notifications/templates/email/template-renderer');
      renderEmailTemplate.mockResolvedValue('<html>Reminder Email</html>');

      notificationService.create.mockResolvedValue(mockNotification as any);

      const result = await service.sendInvitationReminder(mockEmailData);

      expect(result.success).toBe(true);
      expect(renderEmailTemplate).toHaveBeenCalledWith(
        'tenant-invitation',
        expect.objectContaining({
          customMessage: expect.stringContaining(
            'This is a reminder that your invitation will expire soon',
          ),
        }),
      );
    });
  });

  describe('sendInvitationStatusNotification', () => {
    it('should send accepted status notification to inviter', async () => {
      notificationService.sendToUser.mockResolvedValue(mockNotification as any);

      const result = await service.sendInvitationStatusNotification(
        mockInvitation,
        'accepted',
        'user_123',
      );

      expect(result.success).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          tenantId: 'tenant_123',
          type: NotificationType.SUCCESS,
          category: 'invitation-status',
          title: 'Invitation Accepted',
          message: expect.stringContaining(
            'test@example.com has accepted your invitation',
          ),
        }),
      );
    });

    it('should send expired status notification to inviter', async () => {
      notificationService.sendToUser.mockResolvedValue(mockNotification as any);

      const result = await service.sendInvitationStatusNotification(
        mockInvitation,
        'expired',
        'user_123',
      );

      expect(result.success).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          type: NotificationType.INFO,
          title: 'Invitation Expired',
          message: expect.stringContaining('has expired'),
        }),
      );
    });

    it('should send cancelled status notification to inviter', async () => {
      notificationService.sendToUser.mockResolvedValue(mockNotification as any);

      const result = await service.sendInvitationStatusNotification(
        mockInvitation,
        'cancelled',
        'user_123',
      );

      expect(result.success).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'user_123',
        expect.objectContaining({
          type: NotificationType.INFO,
          title: 'Invitation Cancelled',
          message: expect.stringContaining('has been cancelled'),
        }),
      );
    });

    it('should handle notification service errors', async () => {
      notificationService.sendToUser.mockRejectedValue(
        new Error('Notification failed'),
      );

      const result = await service.sendInvitationStatusNotification(
        mockInvitation,
        'accepted',
        'user_123',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Notification failed');
    });
  });

  describe('sendBulkInvitationSummary', () => {
    const mockInvitations = [
      mockInvitation,
      {
        ...mockInvitation,
        id: 'inv_456',
        email: 'test2@example.com',
      },
    ];

    it('should send bulk invitation summary to admin', async () => {
      notificationService.sendToUser.mockResolvedValue(mockNotification as any);

      const result = await service.sendBulkInvitationSummary(
        mockInvitations,
        'admin_123',
        'tenant_123',
      );

      expect(result.success).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'admin_123',
        expect.objectContaining({
          tenantId: 'tenant_123',
          type: NotificationType.SUCCESS,
          category: 'bulk-invitation-summary',
          title: 'Bulk Invitations Sent',
          message: expect.stringContaining('Successfully sent 2 invitations'),
          data: expect.objectContaining({
            invitationCount: 2,
            inviteeEmails: ['test@example.com', 'test2@example.com'],
            invitationIds: ['inv_123', 'inv_456'],
          }),
        }),
      );
    });

    it('should handle single invitation in bulk summary', async () => {
      notificationService.sendToUser.mockResolvedValue(mockNotification as any);

      const result = await service.sendBulkInvitationSummary(
        [mockInvitation],
        'admin_123',
        'tenant_123',
      );

      expect(result.success).toBe(true);
      expect(notificationService.sendToUser).toHaveBeenCalledWith(
        'admin_123',
        expect.objectContaining({
          message: expect.stringContaining('Successfully sent 1 invitation'),
        }),
      );
    });
  });

  describe('trackEmailDelivery', () => {
    it('should track email delivery status', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      const debugSpy = jest.spyOn(service['logger'], 'debug');

      await service.trackEmailDelivery('notif_123', 'delivered', {
        provider: 'ses',
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        'Tracking email delivery status: delivered for notification notif_123',
      );
      expect(debugSpy).toHaveBeenCalledWith(
        'Email delivery tracking',
        expect.objectContaining({
          notificationId: 'notif_123',
          status: 'delivered',
          metadata: { provider: 'ses' },
        }),
      );
    });

    it('should handle tracking errors gracefully', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');

      // Mock an error in the tracking process
      jest.spyOn(service['logger'], 'debug').mockImplementation(() => {
        throw new Error('Tracking failed');
      });

      service.trackEmailDelivery('notif_123', 'failed');

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to track email delivery for notification notif_123',
        expect.any(String),
      );
    });
  });

  describe('handleEmailDeliveryError', () => {
    const mockEmailData: InvitationEmailData = {
      invitation: mockInvitation,
      invitationUrl:
        'https://app.example.com/accept-invitation/secure_token_123',
    };

    it('should retry email delivery with exponential backoff', async () => {
      const sendEmailSpy = jest.spyOn(service, 'sendInvitationEmail');

      // Mock successful retry
      sendEmailSpy.mockResolvedValueOnce({
        success: true,
        notificationId: 'notif_123',
      });

      const result = await service.handleEmailDeliveryError(
        mockEmailData,
        new Error('Initial failure'),
        0,
      );

      expect(result.success).toBe(true);
      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    });

    it('should return failure after max retries exceeded', async () => {
      const sendEmailSpy = jest.spyOn(service, 'sendInvitationEmail');
      sendEmailSpy.mockRejectedValue(new Error('Persistent failure'));

      const result = await service.handleEmailDeliveryError(
        mockEmailData,
        new Error('Initial failure'),
        3, // Max retries
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Email delivery failed after 3 retries');
      expect(sendEmailSpy).not.toHaveBeenCalled();
    });
  });

  describe('extractTextFromHtml', () => {
    it('should extract plain text from HTML', () => {
      const html =
        '<h1>Hello &amp; Welcome</h1><p>This is a <strong>test</strong> message.</p>';
      const result = service['extractTextFromHtml'](html);

      expect(result).toBe('Hello & WelcomeThis is a test message.');
    });

    it('should handle empty HTML', () => {
      const result = service['extractTextFromHtml']('');
      expect(result).toBe('');
    });

    it('should handle HTML with special characters', () => {
      const html =
        '&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;&nbsp;&nbsp;Text';
      const result = service['extractTextFromHtml'](html);

      expect(result).toBe('<script>alert("test")</script> Text');
    });
  });
});
