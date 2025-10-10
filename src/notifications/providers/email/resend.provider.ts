import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import {
  IEmailProvider,
  EmailOptions,
  EmailResult,
} from '../../interfaces/email-provider.interface';

@Injectable()
export class ResendProvider implements IEmailProvider {
  private readonly logger = new Logger(ResendProvider.name);
  private readonly resend: Resend;

  constructor(private readonly apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      this.logger.debug(`Sending email via Resend to: ${options.to}`);

      const response = await this.resend.emails.send({
        from: options.from || 'noreply@example.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.subject || 'No content',
      });

      if (response.error) {
        this.logger.error(
          `Resend API error: ${response.error.message}`,
          response.error,
        );
        return {
          success: false,
          error: response.error.message,
        };
      }

      this.logger.debug(
        `Email sent successfully via Resend. Message ID: ${response.data?.id}`,
      );
      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to send email via Resend: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getProviderName(): string {
    return 'resend';
  }

  /**
   * Safely extract error message from unknown error type
   */
  private extractErrorMessage(error: unknown): string {
    // Check if it's a standard Error object
    if (error instanceof Error) {
      return error.message;
    }

    // Check if it's an object with a message property
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }

    // Fallback for any other type
    return 'Unknown error';
  }
}
