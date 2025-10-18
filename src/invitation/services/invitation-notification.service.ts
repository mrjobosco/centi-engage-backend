import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../../notifications/services/notification.service';
import { NotificationTemplateService } from '../../notifications/services/notification-template.service';
import { NotificationChannelType } from '../../notifications/enums/notification-channel.enum';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationPriority } from '../../notifications/enums/notification-priority.enum';
import {
  TenantInvitation,
  TenantInvitationWithRelations,
} from '../interfaces/tenant-invitation.interface';
import { renderEmailTemplate } from '../../notifications/templates/email/template-renderer';
import { InvitationEmailTemplateProps } from '../../notifications/templates/email/invitation.template';

export interface InvitationEmailData {
  invitation: TenantInvitationWithRelations;
  invitationUrl: string;
  customMessage?: string;
  companyName?: string;
  companyLogo?: string;
  supportEmail?: string;
}

export interface InvitationDeliveryResult {
  success: boolean;
  notificationId?: string;
  error?: string;
  deliveryChannels?: NotificationChannelType[];
}

@Injectable()
export class InvitationNotificationService {
  private readonly logger = new Logger(InvitationNotificationService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly templateService: NotificationTemplateService,
  ) { }

  /**
   * Send invitation email to the invitee
   */
  async sendInvitationEmail(
    emailData: InvitationEmailData,
  ): Promise<InvitationDeliveryResult> {
    this.logger.log(
      `Sending invitation email to ${emailData.invitation.email} for tenant ${emailData.invitation.tenantId}`,
    );

    try {
      // Prepare template variables for the invitation email
      const templateVariables: InvitationEmailTemplateProps = {
        inviteeEmail: emailData.invitation.email,
        inviterName: emailData.invitation.inviter?.firstName
          ? `${emailData.invitation.inviter.firstName} ${emailData.invitation.inviter.lastName || ''}`.trim()
          : emailData.invitation.inviter?.email || 'Team Admin',
        tenantName: emailData.invitation.tenant?.name || 'Organization',
        roles: emailData.invitation.roles?.map((role: any) => role.name) || [
          'Member',
        ],
        invitationUrl: emailData.invitationUrl,
        expiresAt: emailData.invitation.expiresAt,
        customMessage: emailData.customMessage,
        companyName: emailData.companyName || 'Your Company',
        companyLogo: emailData.companyLogo,
        supportEmail: emailData.supportEmail || 'support@company.com',
      };

      // Try to get custom template first, fallback to built-in template
      let emailContent: { html: string; text: string };

      try {
        // Check if there's a custom template for tenant invitations
        const customTemplate = await this.templateService.getTemplate(
          'tenant-invitation',
          NotificationChannelType.EMAIL,
          emailData.invitation.tenantId,
        );

        if (customTemplate) {
          this.logger.debug('Using custom invitation template');
          emailContent = await this.templateService.renderEmailTemplate(
            customTemplate.id,
            templateVariables,
          );
        } else {
          throw new Error('No custom template found, using built-in');
        }
      } catch (error) {
        this.logger.debug('Using built-in invitation template');
        // Use the built-in React email template
        const html = await renderEmailTemplate(
          'tenant-invitation',
          templateVariables,
        );
        const text = this.extractTextFromHtml(html);
        emailContent = { html, text };
      }

      // Create notification payload
      const notificationPayload = {
        tenantId: emailData.invitation.tenantId,
        userId: emailData.invitation.invitedBy, // Use inviter's ID for external invitations
        type: NotificationType.INFO,
        category: 'tenant-invitation',
        title: `Invitation to join ${templateVariables.tenantName}`,
        message: `You've been invited to join ${templateVariables.tenantName}`,
        priority: NotificationPriority.HIGH,
        data: {
          invitationId: emailData.invitation.id,
          inviteeEmail: emailData.invitation.email,
          inviterName: templateVariables.inviterName,
          tenantName: templateVariables.tenantName,
          roles: templateVariables.roles,
          expiresAt: emailData.invitation.expiresAt.toISOString(),
          invitationUrl: emailData.invitationUrl,
        },
        // Email-specific data
        emailData: {
          to: emailData.invitation.email,
          subject: `You're invited to join ${templateVariables.tenantName}`,
          html: emailContent.html,
          text: emailContent.text,
        },
      };

      // Send the notification (this will use the email channel)
      const notification =
        await this.notificationService.create(notificationPayload);

      this.logger.log(
        `Invitation email sent successfully to ${emailData.invitation.email}, notification ID: ${notification.id}`,
      );

      return {
        success: true,
        notificationId: notification.id,
        deliveryChannels:
          notification.channelsSent as NotificationChannelType[],
      };
    } catch (error) {
      this.logger.error(
        `Failed to send invitation email to ${emailData.invitation.email}`,
        (error as Error).stack,
      );

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Send invitation reminder email
   */
  async sendInvitationReminder(
    emailData: InvitationEmailData,
  ): Promise<InvitationDeliveryResult> {
    this.logger.log(
      `Sending invitation reminder to ${emailData.invitation.email}`,
    );

    // Add reminder context to the email data
    const reminderEmailData = {
      ...emailData,
      customMessage: emailData.customMessage
        ? `${emailData.customMessage}\n\nThis is a reminder that your invitation will expire soon.`
        : 'This is a reminder that your invitation will expire soon.',
    };

    return this.sendInvitationEmail(reminderEmailData);
  }

  /**
   * Send invitation status notification to the inviter
   */
  async sendInvitationStatusNotification(
    invitation: TenantInvitationWithRelations,
    status: 'accepted' | 'expired' | 'cancelled',
    inviterUserId: string,
  ): Promise<InvitationDeliveryResult> {
    this.logger.log(
      `Sending invitation ${status} notification to inviter ${inviterUserId}`,
    );

    try {
      const statusMessages = {
        accepted: {
          title: 'Invitation Accepted',
          message: `${invitation.email} has accepted your invitation to join ${invitation.tenant?.name || 'the organization'}`,
        },
        expired: {
          title: 'Invitation Expired',
          message: `The invitation for ${invitation.email} to join ${invitation.tenant?.name || 'the organization'} has expired`,
        },
        cancelled: {
          title: 'Invitation Cancelled',
          message: `The invitation for ${invitation.email} to join ${invitation.tenant?.name || 'the organization'} has been cancelled`,
        },
      };

      const statusInfo = statusMessages[status];

      const notificationPayload = {
        tenantId: invitation.tenantId,
        userId: inviterUserId,
        type:
          status === 'accepted'
            ? NotificationType.SUCCESS
            : NotificationType.INFO,
        category: 'invitation-status',
        title: statusInfo.title,
        message: statusInfo.message,
        priority: NotificationPriority.MEDIUM,
        data: {
          invitationId: invitation.id,
          inviteeEmail: invitation.email,
          status,
          tenantName: invitation.tenant?.name,
          roles: invitation.roles?.map((role: any) => role.name) || [],
        },
      };

      const notification = await this.notificationService.sendToUser(
        inviterUserId,
        notificationPayload,
      );

      this.logger.log(
        `Invitation ${status} notification sent to inviter ${inviterUserId}`,
      );

      return {
        success: true,
        notificationId: notification.id,
        deliveryChannels:
          notification.channelsSent as NotificationChannelType[],
      };
    } catch (error) {
      this.logger.error(
        `Failed to send invitation ${status} notification to inviter ${inviterUserId}`,
        (error as Error).stack,
      );

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Send bulk invitation summary to admin
   */
  async sendBulkInvitationSummary(
    invitations: TenantInvitation[],
    adminUserId: string,
    tenantId: string,
  ): Promise<InvitationDeliveryResult> {
    this.logger.log(
      `Sending bulk invitation summary to admin ${adminUserId} for ${invitations.length} invitations`,
    );

    try {
      const successCount = invitations.length;
      const inviteeEmails = invitations.map((inv) => inv.email).join(', ');

      const notificationPayload = {
        tenantId,
        userId: adminUserId,
        type: NotificationType.SUCCESS,
        category: 'bulk-invitation-summary',
        title: 'Bulk Invitations Sent',
        message: `Successfully sent ${successCount} invitation${successCount > 1 ? 's' : ''} to: ${inviteeEmails}`,
        priority: NotificationPriority.MEDIUM,
        data: {
          invitationCount: successCount,
          inviteeEmails: invitations.map((inv) => inv.email),
          invitationIds: invitations.map((inv) => inv.id),
        },
      };

      const notification = await this.notificationService.sendToUser(
        adminUserId,
        notificationPayload,
      );

      this.logger.log(`Bulk invitation summary sent to admin ${adminUserId}`);

      return {
        success: true,
        notificationId: notification.id,
        deliveryChannels:
          notification.channelsSent as NotificationChannelType[],
      };
    } catch (error) {
      this.logger.error(
        `Failed to send bulk invitation summary to admin ${adminUserId}`,
        (error as Error).stack,
      );

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Track email delivery status
   */
  trackEmailDelivery(
    notificationId: string,
    status: 'delivered' | 'bounced' | 'failed',
    metadata?: Record<string, any>,
  ): void {
    this.logger.log(
      `Tracking email delivery status: ${status} for notification ${notificationId}`,
    );

    try {
      // This would typically update the notification record with delivery status
      // For now, we'll log the tracking information
      this.logger.debug('Email delivery tracking', {
        notificationId,
        status,
        metadata,
        timestamp: new Date().toISOString(),
      });

      // In a production system, you might want to:
      // 1. Update the notification record with delivery status
      // 2. Send webhooks to external systems
      // 3. Update metrics and analytics
      // 4. Trigger retry logic for failed deliveries
    } catch (error) {
      this.logger.error(
        `Failed to track email delivery for notification ${notificationId}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Handle email delivery errors and implement retry logic
   */
  async handleEmailDeliveryError(
    emailData: InvitationEmailData,
    error: Error,
    retryCount: number = 0,
  ): Promise<InvitationDeliveryResult> {
    const maxRetries = 3;
    const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

    this.logger.warn(
      `Email delivery failed for ${emailData.invitation.email}, retry ${retryCount}/${maxRetries}`,
      error.stack,
    );

    if (retryCount < maxRetries) {
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelay));

      try {
        return await this.sendInvitationEmail(emailData);
      } catch (retryError) {
        return this.handleEmailDeliveryError(
          emailData,
          retryError as Error,
          retryCount + 1,
        );
      }
    }

    // Max retries exceeded
    this.logger.error(
      `Max retries exceeded for invitation email to ${emailData.invitation.email}`,
    );

    return {
      success: false,
      error: `Email delivery failed after ${maxRetries} retries: ${error.message}`,
    };
  }

  /**
   * Extract plain text from HTML for email text version
   */
  private extractTextFromHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/&quot;/g, '"') // Replace &quot; with "
      .replace(/&#39;/g, "'") // Replace &#39; with '
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .trim();
  }
}
