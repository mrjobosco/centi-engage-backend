import { Injectable, Logger } from '@nestjs/common';
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from '@aws-sdk/client-ses';
import {
  IEmailProvider,
  EmailOptions,
  EmailResult,
} from '../../interfaces/email-provider.interface';

export interface AwsSesConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

@Injectable()
export class AwsSesProvider implements IEmailProvider {
  private readonly logger = new Logger(AwsSesProvider.name);
  private readonly sesClient: SESClient;

  constructor(private readonly config: AwsSesConfig) {
    this.sesClient = new SESClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      this.logger.debug(`Sending email via AWS SES to: ${options.to}`);

      const fromAddress = options.fromName
        ? `${options.fromName} <${options.from || 'noreply@example.com'}>`
        : options.from || 'noreply@example.com';

      const params: SendEmailCommandInput = {
        Source: fromAddress,
        Destination: {
          ToAddresses: [options.to],
        },
        Message: {
          Subject: {
            Data: options.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: options.html,
              Charset: 'UTF-8',
            },
            ...(options.text && {
              Text: {
                Data: options.text,
                Charset: 'UTF-8',
              },
            }),
          },
        },
      };

      const command = new SendEmailCommand(params);
      const response = await this.sesClient.send(command);

      this.logger.debug(
        `Email sent successfully via AWS SES. Message ID: ${response.MessageId}`,
      );
      return {
        success: true,
        messageId: response.MessageId,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to send email via AWS SES: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getProviderName(): string {
    return 'aws-ses';
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
