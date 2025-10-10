# Custom Notification Provider Implementation Guide

## Overview

This guide demonstrates how to implement custom notification providers for both email and SMS channels. The notification system's pluggable architecture allows you to integrate with any external service by implementing the appropriate provider interface.

## Email Provider Implementation

### Step 1: Implement the Email Provider Interface

Create a new email provider by implementing the `IEmailProvider` interface:

```typescript
// src/notifications/providers/email/mailgun.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  IEmailProvider,
  EmailOptions,
  EmailResult,
} from '../../interfaces/email-provider.interface';

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  baseUrl?: string;
}

@Injectable()
export class MailgunProvider implements IEmailProvider {
  private readonly logger = new Logger(MailgunProvider.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;

  constructor(private readonly config: MailgunConfig) {
    this.baseUrl = config.baseUrl || 'https://api.mailgun.net/v3';
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      auth: {
        username: 'api',
        password: config.apiKey,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      this.logger.debug(`Sending email via Mailgun to: ${options.to}`);

      // Prepare form data for Mailgun API
      const formData = new URLSearchParams();
      formData.append('from', this.formatFromAddress(options));
      formData.append('to', options.to);
      formData.append('subject', options.subject);
      
      if (options.html) {
        formData.append('html', options.html);
      }
      
      if (options.text) {
        formData.append('text', options.text);
      }

      // Send email via Mailgun API
      const response = await this.httpClient.post(
        `/${this.config.domain}/messages`,
        formData
      );

      if (response.data && response.data.id) {
        this.logger.debug(
          `Email sent successfully via Mailgun. Message ID: ${response.data.id}`
        );
        
        return {
          success: true,
          messageId: response.data.id,
        };
      } else {
        throw new Error('Invalid response from Mailgun API');
      }
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to send email via Mailgun: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getProviderName(): string {
    return 'mailgun';
  }

  /**
   * Format the from address with optional name
   */
  private formatFromAddress(options: EmailOptions): string {
    const fromAddress = options.from || `noreply@${this.config.domain}`;
    
    if (options.fromName) {
      return `${options.fromName} <${fromAddress}>`;
    }
    
    return fromAddress;
  }

  /**
   * Extract error message from various error types
   */
  private extractErrorMessage(error: unknown): string {
    // Handle Axios errors
    if (axios.isAxiosError(error)) {
      if (error.response?.data?.message) {
        return error.response.data.message;
      }
      if (error.response?.statusText) {
        return `HTTP ${error.response.status}: ${error.response.statusText}`;
      }
      return error.message;
    }

    // Handle standard errors
    if (error instanceof Error) {
      return error.message;
    }

    // Handle object with message property
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }

    return 'Unknown error';
  }

  /**
   * Health check method (optional)
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test API connectivity with a simple domain info request
      const response = await this.httpClient.get(`/${this.config.domain}`);
      return response.status === 200;
    } catch (error) {
      this.logger.error('Mailgun health check failed', error);
      return false;
    }
  }
}
```

### Step 2: Add Provider to Factory

Update the email provider factory to include your new provider:

```typescript
// src/notifications/factories/email-provider.factory.ts
import { MailgunProvider, MailgunConfig } from '../providers/email/mailgun.provider';

export interface TenantEmailConfig {
  provider: 'resend' | 'aws-ses' | 'onesignal' | 'smtp' | 'mailgun';
  apiKey?: string;
  apiSecret?: string;
  fromAddress?: string;
  fromName?: string;
  // ... existing fields
  // Mailgun specific
  domain?: string;
}

@Injectable()
export class EmailProviderFactory {
  // ... existing code

  private createProviderFromConfig(
    config: TenantEmailConfig,
  ): IEmailProvider | null {
    try {
      switch (config.provider) {
        // ... existing cases

        case 'mailgun': {
          if (!config.apiKey || !config.domain) {
            this.logger.warn(
              'Mailgun configuration incomplete in tenant config'
            );
            return null;
          }
          
          const mailgunConfig: MailgunConfig = {
            apiKey: config.apiKey,
            domain: config.domain,
          };
          
          return new MailgunProvider(mailgunConfig);
        }

        // ... rest of cases
      }
    } catch (error) {
      // ... error handling
    }
  }

  private createGlobalProvider(): IEmailProvider | null {
    const provider = this.configService.get<string>('EMAIL_PROVIDER');

    if (!provider) {
      return null;
    }

    try {
      switch (provider) {
        // ... existing cases

        case 'mailgun': {
          const mailgunApiKey = this.configService.get<string>('MAILGUN_API_KEY');
          const mailgunDomain = this.configService.get<string>('MAILGUN_DOMAIN');

          if (!mailgunApiKey || !mailgunDomain) {
            this.logger.warn('Mailgun configuration incomplete globally');
            return null;
          }

          const mailgunConfig: MailgunConfig = {
            apiKey: mailgunApiKey,
            domain: mailgunDomain,
          };

          return new MailgunProvider(mailgunConfig);
        }

        // ... rest of cases
      }
    } catch (error) {
      // ... error handling
    }
  }

  validateConfig(config: TenantEmailConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // ... existing validation

    switch (config.provider) {
      // ... existing cases

      case 'mailgun':
        if (!config.apiKey) {
          errors.push('API key is required for Mailgun provider');
        }
        if (!config.domain) {
          errors.push('Domain is required for Mailgun provider');
        }
        break;

      // ... rest of cases
    }

    return { valid: errors.length === 0, errors };
  }

  getAvailableProviders(): string[] {
    return ['resend', 'aws-ses', 'onesignal', 'smtp', 'mailgun'];
  }
}
```

### Step 3: Add Configuration Support

Update environment configuration:

```bash
# .env
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_domain.com
```

Add validation to configuration schema:

```typescript
// src/config/env.validation.ts
export const envValidationSchema = Joi.object({
  // ... existing validation

  // Mailgun configuration
  MAILGUN_API_KEY: Joi.string().when('EMAIL_PROVIDER', {
    is: 'mailgun',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  MAILGUN_DOMAIN: Joi.string().when('EMAIL_PROVIDER', {
    is: 'mailgun',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});
```

## SMS Provider Implementation

### Step 1: Implement the SMS Provider Interface

Create a new SMS provider:

```typescript
// src/notifications/providers/sms/messagebird.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  ISmsProvider,
  SmsOptions,
  SmsResult,
} from '../../interfaces/sms-provider.interface';

export interface MessageBirdConfig {
  apiKey: string;
  originator?: string;
  baseUrl?: string;
}

@Injectable()
export class MessageBirdProvider implements ISmsProvider {
  private readonly logger = new Logger(MessageBirdProvider.name);
  private readonly httpClient: AxiosInstance;

  constructor(private readonly config: MessageBirdConfig) {
    this.httpClient = axios.create({
      baseURL: config.baseUrl || 'https://rest.messagebird.com',
      timeout: 30000,
      headers: {
        'Authorization': `AccessKey ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async send(options: SmsOptions): Promise<SmsResult> {
    try {
      this.logger.debug(`Sending SMS via MessageBird to ${options.to}`);

      const payload = {
        recipients: [this.formatPhoneNumber(options.to)],
        originator: options.from || this.config.originator || 'MessageBird',
        body: options.message,
      };

      const response = await this.httpClient.post('/messages', payload);

      if (response.data && response.data.id) {
        this.logger.debug(
          `SMS sent successfully via MessageBird: ${response.data.id}`
        );

        return {
          success: true,
          messageId: response.data.id,
        };
      } else {
        throw new Error('Invalid response from MessageBird API');
      }
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      this.logger.error(
        `Failed to send SMS via MessageBird: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getProviderName(): string {
    return 'messagebird';
  }

  /**
   * Format phone number for MessageBird API
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let formatted = phoneNumber.replace(/[^\d+]/g, '');

    // MessageBird expects numbers without + prefix
    if (formatted.startsWith('+')) {
      formatted = formatted.substring(1);
    }

    return formatted;
  }

  /**
   * Extract error message from various error types
   */
  private extractErrorMessage(error: unknown): string {
    // Handle MessageBird API errors
    if (axios.isAxiosError(error)) {
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        if (Array.isArray(errors) && errors.length > 0) {
          return errors.map(e => e.description || e.message).join(', ');
        }
      }
      
      if (error.response?.data?.message) {
        return error.response.data.message;
      }
      
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }

  /**
   * Health check method (optional)
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test API connectivity with balance check
      const response = await this.httpClient.get('/balance');
      return response.status === 200;
    } catch (error) {
      this.logger.error('MessageBird health check failed', error);
      return false;
    }
  }
}
```

### Step 2: Add Provider to SMS Factory

Update the SMS provider factory:

```typescript
// src/notifications/factories/sms-provider.factory.ts
import { MessageBirdProvider, MessageBirdConfig } from '../providers/sms/messagebird.provider';

export interface SmsProviderConfig {
  provider: 'twilio' | 'termii' | 'messagebird';
  apiKey: string;
  apiSecret?: string;
  fromNumber?: string;
  senderId?: string;
  // MessageBird specific
  originator?: string;
}

@Injectable()
export class SmsProviderFactory {
  // ... existing code

  private createProviderInstance(config: SmsProviderConfig): ISmsProvider {
    switch (config.provider) {
      // ... existing cases

      case 'messagebird':
        const messageBirdConfig: MessageBirdConfig = {
          apiKey: config.apiKey,
          originator: config.originator || config.senderId,
        };
        return new MessageBirdProvider(messageBirdConfig);

      default:
        throw new Error(
          `Unsupported SMS provider: ${config.provider as string}`
        );
    }
  }

  private getGlobalSmsConfig(): SmsProviderConfig | null {
    const provider = this.configService.get<string>('SMS_PROVIDER');
    const apiKey = this.configService.get<string>('SMS_API_KEY');

    if (!provider || !apiKey) {
      return null;
    }

    const config: SmsProviderConfig = {
      provider: provider as 'twilio' | 'termii' | 'messagebird',
      apiKey,
    };

    // Add provider-specific configuration
    if (provider === 'messagebird') {
      config.originator = this.configService.get<string>('MESSAGEBIRD_ORIGINATOR');
    }
    // ... other providers

    return config;
  }

  getAvailableProviders(): string[] {
    return ['twilio', 'termii', 'messagebird'];
  }

  validateConfig(config: Partial<SmsProviderConfig>): boolean {
    if (!config.provider || !config.apiKey) {
      return false;
    }

    // Provider-specific validation
    if (config.provider === 'messagebird') {
      // MessageBird only requires API key
      return true;
    }

    return this.getAvailableProviders().includes(config.provider);
  }
}
```

## Advanced Provider Features

### Adding Webhook Support

For providers that support webhooks, you can add delivery status tracking:

```typescript
// src/notifications/providers/email/mailgun.provider.ts
export class MailgunProvider implements IEmailProvider {
  // ... existing code

  /**
   * Process webhook events from Mailgun
   */
  async processWebhook(webhookData: any): Promise<void> {
    try {
      const { 'event-data': eventData } = webhookData;
      
      if (!eventData || !eventData['message-id']) {
        return;
      }

      const messageId = eventData['message-id'];
      const eventType = eventData.event;

      // Update delivery status based on webhook event
      switch (eventType) {
        case 'delivered':
          await this.updateDeliveryStatus(messageId, 'DELIVERED');
          break;
        case 'failed':
          await this.updateDeliveryStatus(messageId, 'FAILED', eventData.reason);
          break;
        case 'bounced':
          await this.updateDeliveryStatus(messageId, 'BOUNCED', eventData.reason);
          break;
        case 'complained':
          await this.updateDeliveryStatus(messageId, 'COMPLAINED');
          break;
      }
    } catch (error) {
      this.logger.error('Failed to process Mailgun webhook', error);
    }
  }

  private async updateDeliveryStatus(
    messageId: string,
    status: string,
    reason?: string
  ): Promise<void> {
    // Update delivery log in database
    // This would typically be injected as a service
  }
}
```

### Adding Template Support

For providers with template capabilities:

```typescript
// src/notifications/providers/email/mailgun.provider.ts
export interface MailgunTemplateOptions extends EmailOptions {
  templateName?: string;
  templateVariables?: Record<string, any>;
}

export class MailgunProvider implements IEmailProvider {
  async send(options: EmailOptions): Promise<EmailResult> {
    const mailgunOptions = options as MailgunTemplateOptions;
    
    if (mailgunOptions.templateName) {
      return this.sendWithTemplate(mailgunOptions);
    }
    
    return this.sendRegularEmail(options);
  }

  private async sendWithTemplate(
    options: MailgunTemplateOptions
  ): Promise<EmailResult> {
    try {
      const formData = new URLSearchParams();
      formData.append('from', this.formatFromAddress(options));
      formData.append('to', options.to);
      formData.append('subject', options.subject);
      formData.append('template', options.templateName!);
      
      // Add template variables
      if (options.templateVariables) {
        Object.entries(options.templateVariables).forEach(([key, value]) => {
          formData.append(`v:${key}`, String(value));
        });
      }

      const response = await this.httpClient.post(
        `/${this.config.domain}/messages`,
        formData
      );

      return {
        success: true,
        messageId: response.data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: this.extractErrorMessage(error),
      };
    }
  }
}
```

### Adding Rate Limiting

Implement provider-specific rate limiting:

```typescript
// src/notifications/providers/email/mailgun.provider.ts
import { RateLimiter } from 'limiter';

export class MailgunProvider implements IEmailProvider {
  private rateLimiter: RateLimiter;

  constructor(private readonly config: MailgunConfig) {
    // ... existing initialization

    // Mailgun allows 100 emails per hour on free tier
    this.rateLimiter = new RateLimiter({
      tokensPerInterval: 100,
      interval: 'hour',
    });
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    // Check rate limit before sending
    const remainingRequests = await this.rateLimiter.removeTokens(1);
    
    if (remainingRequests < 0) {
      return {
        success: false,
        error: 'Rate limit exceeded for Mailgun provider',
      };
    }

    // Proceed with sending
    return this.sendEmail(options);
  }
}
```

## Testing Custom Providers

### Unit Tests

Create comprehensive unit tests for your provider:

```typescript
// src/notifications/providers/email/mailgun.provider.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MailgunProvider, MailgunConfig } from './mailgun.provider';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MailgunProvider', () => {
  let provider: MailgunProvider;
  let config: MailgunConfig;

  beforeEach(async () => {
    config = {
      apiKey: 'test-api-key',
      domain: 'test.mailgun.org',
    };

    provider = new MailgunProvider(config);
  });

  describe('send', () => {
    it('should send email successfully', async () => {
      const mockResponse = {
        data: { id: 'test-message-id' },
        status: 200,
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await provider.send({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: 'Test content',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('should handle API errors', async () => {
      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('API Error')),
      } as any);

      const result = await provider.send({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('getProviderName', () => {
    it('should return correct provider name', () => {
      expect(provider.getProviderName()).toBe('mailgun');
    });
  });
});
```

### Integration Tests

Test the provider with the actual service:

```typescript
// test/providers/mailgun.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MailgunProvider } from '../../src/notifications/providers/email/mailgun.provider';

describe('MailgunProvider Integration', () => {
  let provider: MailgunProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [
        {
          provide: MailgunProvider,
          useFactory: () => new MailgunProvider({
            apiKey: process.env.MAILGUN_API_KEY!,
            domain: process.env.MAILGUN_DOMAIN!,
          }),
        },
      ],
    }).compile();

    provider = module.get<MailgunProvider>(MailgunProvider);
  });

  it('should send real email', async () => {
    if (!process.env.MAILGUN_API_KEY) {
      console.log('Skipping integration test - no API key provided');
      return;
    }

    const result = await provider.send({
      to: 'test@example.com',
      subject: 'Integration Test',
      html: '<p>This is a test email</p>',
      text: 'This is a test email',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  }, 30000);
});
```

## Best Practices for Custom Providers

### Error Handling
- Implement comprehensive error handling for all API calls
- Distinguish between retryable and permanent errors
- Log errors with appropriate detail levels
- Return structured error responses

### Configuration Management
- Validate configuration before use
- Support both global and tenant-specific configuration
- Implement secure credential storage
- Provide clear configuration documentation

### Performance Optimization
- Implement connection pooling for HTTP clients
- Add appropriate timeouts for API calls
- Consider rate limiting for provider APIs
- Cache provider instances when possible

### Monitoring and Observability
- Add health check endpoints
- Implement metrics collection
- Log important events and errors
- Support webhook processing for delivery status

### Security Considerations
- Validate all input parameters
- Sanitize data before sending to external APIs
- Implement proper authentication
- Handle sensitive data securely

This guide provides a comprehensive foundation for implementing custom notification providers that integrate seamlessly with the existing notification system architecture.