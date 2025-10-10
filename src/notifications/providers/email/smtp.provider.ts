import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import {
  IEmailProvider,
  EmailOptions,
  EmailResult,
} from '../../interfaces/email-provider.interface';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

@Injectable()
export class SmtpProvider implements IEmailProvider {
  private readonly logger = new Logger(SmtpProvider.name);
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      this.logger.debug(`Sending email via SMTP to: ${options.to}`);

      const fromAddress = options.fromName
        ? `${options.fromName} <${options.from || this.config.user}>`
        : options.from || this.config.user;

      const mailOptions = {
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.debug(
        `Email sent successfully via SMTP. Message ID: ${info.messageId}`,
      );
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to send email via SMTP: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getProviderName(): string {
    return 'smtp';
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `SMTP connection verification failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
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
