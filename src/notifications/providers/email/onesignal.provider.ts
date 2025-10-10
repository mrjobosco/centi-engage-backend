import { Injectable, Logger } from '@nestjs/common';
import * as OneSignal from 'onesignal-node';
import {
  IEmailProvider,
  EmailOptions,
  EmailResult,
} from '../../interfaces/email-provider.interface';

@Injectable()
export class OneSignalProvider implements IEmailProvider {
  private readonly logger = new Logger(OneSignalProvider.name);
  private readonly client: OneSignal.Client;

  constructor(
    private readonly apiKey: string,
    private readonly appId: string,
  ) {
    this.client = new OneSignal.Client(appId, apiKey);
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      this.logger.debug(`Sending email via OneSignal to: ${options.to}`);

      // OneSignal email notification payload
      const notification = {
        contents: {
          en: options.html || options.text || options.subject,
        },
        headings: {
          en: options.subject,
        },
        email_subject: options.subject,
        email_body: options.html,
        email_from_name: options.fromName || 'Notification',
        email_from_address: options.from || 'noreply@example.com',
        include_email_tokens: [options.to],
        template_id: undefined, // Can be set if using OneSignal templates
      };

      const response = await this.client.createNotification(notification);

      if (response.body.errors && response.body.errors.length > 0) {
        const errorMessage = response.body.errors.join(', ');
        this.logger.error(`OneSignal API error: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
        };
      }

      this.logger.debug(
        `Email sent successfully via OneSignal. Notification ID: ${response.body.id}`,
      );
      return {
        success: true,
        messageId: response.body.id,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(
        `Failed to send email via OneSignal: ${errorMessage}`,
        error,
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getProviderName(): string {
    return 'onesignal';
  }
}
