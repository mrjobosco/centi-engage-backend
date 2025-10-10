import { Injectable, Logger } from '@nestjs/common';
import { Twilio } from 'twilio';
import {
  ISmsProvider,
  SmsOptions,
  SmsResult,
} from '../../interfaces/sms-provider.interface';

@Injectable()
export class TwilioProvider implements ISmsProvider {
  private readonly logger = new Logger(TwilioProvider.name);
  private readonly client: Twilio;

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber?: string,
  ) {
    this.client = new Twilio(accountSid, authToken);
  }

  async send(options: SmsOptions): Promise<SmsResult> {
    try {
      this.logger.debug(`Sending SMS via Twilio to ${options.to}`);

      const message = await this.client.messages.create({
        body: options.message,
        from: options.from || this.fromNumber,
        to: options.to,
      });

      this.logger.debug(`SMS sent successfully via Twilio: ${message.sid}`);

      return {
        success: true,
        messageId: message.sid,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to send SMS via Twilio: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getProviderName(): string {
    return 'twilio';
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
