import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  ISmsProvider,
  SmsOptions,
  SmsResult,
} from '../../interfaces/sms-provider.interface';

@Injectable()
export class TermiiProvider implements ISmsProvider {
  private readonly logger = new Logger(TermiiProvider.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl = 'https://api.ng.termii.com/api/sms/send';

  constructor(
    private readonly apiKey: string,
    private readonly senderId?: string,
  ) {
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async send(options: SmsOptions): Promise<SmsResult> {
    try {
      this.logger.debug(`Sending SMS via Termii to ${options.to}`);

      const payload = {
        to: options.to,
        from: options.from || this.senderId || 'Termii',
        sms: options.message,
        type: 'plain',
        api_key: this.apiKey,
        channel: 'generic',
      };

      const response = await this.httpClient.post(this.baseUrl, payload);

      if (response.data && response.data.message_id) {
        this.logger.debug(
          `SMS sent successfully via Termii: ${response.data.message_id}`,
        );

        return {
          success: true,
          messageId: response.data.message_id,
        };
      } else {
        const errorMessage =
          response.data?.message || 'Unknown error from Termii API';
        this.logger.error(`Failed to send SMS via Termii: ${errorMessage}`);

        return {
          success: false,
          error: errorMessage,
        };
      }
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to send SMS via Termii: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getProviderName(): string {
    return 'termii';
  }

  /**
   * Safely extract error message from unknown error type
   */
  private extractErrorMessage(error: unknown): string {
    // Check if it's an axios error with response data
    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      'data' in error.response &&
      error.response.data &&
      typeof error.response.data === 'object' &&
      'message' in error.response.data &&
      typeof error.response.data.message === 'string'
    ) {
      return error.response.data.message;
    }

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
