/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { InvitationNotificationService } from './invitation-notification.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { NotificationTemplateService } from '../../notifications/services/notification-template.service';
import { NotificationChannelType } from '../../notifications/enums/notification-channel.enum';
import { TenantInvitationWithRelations } from '../interfaces/tenant-invitation.interface';

import * as templateRenderer from '../../notifications/templates/email/template-renderer';

// Mock the template renderer
jest.mock('../../notifications/templates/email/template-renderer', () => ({
  renderEmailTemplate: jest.fn(),
}));

describe('InvitationNotificationService Integration', () => {
  let service: InvitationNotificationService;
  let templateService: jest.Mocked<NotificationTemplateService>;

  const mockTenantId = 'test-tenant-123';
  const mockUserId = 'test-user-123';

  const mockInvitation: TenantInvitationWithRelations = {
    id: 'inv_integration_test',
    tenantId: mockTenantId,
    email: 'integration-test@example.com',
    token: 'integration_test_token',
    invitedBy: mockUserId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    acceptedAt: null,
    cancelledAt: null,
    status: 'PENDING' as const,
    message: 'Integration test invitation',
    createdAt: new Date(),
    updatedAt: new Date(),
    tenant: {
      id: mockTenantId,
      name: 'Integration Test Org',
      subdomain: 'integration-test-org',
    },
    inviter: {
      id: mockUserId,
      email: 'admin@integration-test.com',
      firstName: 'Integration',
      lastName: 'Admin',
    },
    roles: [
      {
        id: 'role_integration_test',
        name: 'Integration Tester',
      },
    ],
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
    templateService = module.get(NotificationTemplateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Template Integration', () => {
    it('should render invitation email template with all variables', async () => {
      const emailData = {
        invitation: mockInvitation,
        invitationUrl:
          'https://app.example.com/accept-invitation/integration_test_token',
        customMessage: 'Welcome to our integration test!',
        companyName: 'Integration Test Company',
        companyLogo: 'https://example.com/logo.png',
        supportEmail: 'support@integration-test.com',
      };

      // Mock template service to return no custom template (use built-in)
      templateService.getTemplate.mockResolvedValue(null);

      // Mock the renderEmailTemplate function
      const mockedTemplateRenderer = jest.mocked(templateRenderer);
      mockedTemplateRenderer.renderEmailTemplate.mockResolvedValue(
        '<html>Integration Test Email</html>',
      );

      // Mock notification service
      const notificationService = service['notificationService'];
      jest.spyOn(notificationService, 'create').mockResolvedValue({
        id: 'notif_integration_test',
        tenantId: mockTenantId,
        userId: null,
        channelsSent: [NotificationChannelType.EMAIL],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await service.sendInvitationEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif_integration_test');
      expect(result.deliveryChannels).toContain(NotificationChannelType.EMAIL);

      // Verify template service was called

      expect(templateService.getTemplate).toHaveBeenCalledWith(
        'tenant-invitation',
        NotificationChannelType.EMAIL,
        mockTenantId,
      );

      // Verify built-in template was used

      expect(mockedTemplateRenderer.renderEmailTemplate).toHaveBeenCalledWith(
        'tenant-invitation',
        expect.objectContaining({
          inviteeEmail: 'integration-test@example.com',
          inviterName: 'Integration Admin',
          tenantName: 'Integration Test Org',
          roles: ['Integration Tester'],
          invitationUrl: emailData.invitationUrl,
          customMessage: 'Welcome to our integration test!',
          companyName: 'Integration Test Company',
          supportEmail: 'support@integration-test.com',
        }),
      );
    });

    it('should use custom template when available for tenant', async () => {
      const customTemplate = {
        id: 'custom_template_123',
        tenantId: mockTenantId,
        category: 'tenant-invitation',
        channel: NotificationChannelType.EMAIL,
        subject: 'Custom Invitation Subject',
        templateBody: 'custom-invitation-template',
        variables: {},
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      templateService.getTemplate.mockResolvedValue(customTemplate);
      templateService.renderEmailTemplate.mockResolvedValue({
        html: '<html>Custom Template HTML</html>',
        text: 'Custom Template Text',
      });

      // Mock notification service
      const notificationService = service['notificationService'];
      jest.spyOn(notificationService, 'create').mockResolvedValue({
        id: 'notif_custom_template',
        channelsSent: [NotificationChannelType.EMAIL],
      } as any);

      const emailData = {
        invitation: mockInvitation,
        invitationUrl:
          'https://app.example.com/accept-invitation/integration_test_token',
      };

      const result = await service.sendInvitationEmail(emailData);

      expect(result.success).toBe(true);

      expect(templateService.renderEmailTemplate).toHaveBeenCalledWith(
        'custom_template_123',
        expect.any(Object),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle email provider failures gracefully', async () => {
      const emailData = {
        invitation: mockInvitation,
        invitationUrl:
          'https://app.example.com/accept-invitation/integration_test_token',
      };

      templateService.getTemplate.mockResolvedValue(null);

      const mockedTemplateRenderer = jest.mocked(templateRenderer);
      mockedTemplateRenderer.renderEmailTemplate.mockResolvedValue(
        '<html>Email Content</html>',
      );

      // Mock notification service to fail
      const notificationService = service['notificationService'];
      jest
        .spyOn(notificationService, 'create')
        .mockRejectedValue(new Error('Email provider unavailable'));

      const result = await service.sendInvitationEmail(emailData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email provider unavailable');
    });
  });
});
