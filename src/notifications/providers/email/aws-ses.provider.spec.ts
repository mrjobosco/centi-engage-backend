import { AwsSesProvider, AwsSesConfig } from './aws-ses.provider';
import { EmailOptions } from '../../interfaces/email-provider.interface';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-ses', () => {
  return {
    SESClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
    })),
    SendEmailCommand: jest.fn(),
  };
});

describe('AwsSesProvider', () => {
  let provider: AwsSesProvider;
  let mockSesClient: any;
  let mockSendEmailCommand: jest.Mock;

  const mockConfig: AwsSesConfig = {
    region: 'us-east-1',
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
  };

  beforeEach(() => {
    mockSesClient = {
      send: jest.fn(),
    };
    (SESClient as jest.Mock).mockImplementation(() => mockSesClient);

    mockSendEmailCommand = SendEmailCommand as unknown as jest.Mock;

    provider = new AwsSesProvider(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send', () => {
    const emailOptions: EmailOptions = {
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test HTML content</p>',
      text: 'Test text content',
      from: 'sender@example.com',
      fromName: 'Test Sender',
    };

    it('should send email successfully', async () => {
      const mockResponse = {
        MessageId: 'aws-ses-message-id-123',
      };
      mockSesClient.send.mockResolvedValue(mockResponse);

      const result = await provider.send(emailOptions);

      expect(mockSendEmailCommand).toHaveBeenCalledWith({
        Source: 'Test Sender <sender@example.com>',
        Destination: {
          ToAddresses: ['test@example.com'],
        },
        Message: {
          Subject: {
            Data: 'Test Subject',
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: '<p>Test HTML content</p>',
              Charset: 'UTF-8',
            },
            Text: {
              Data: 'Test text content',
              Charset: 'UTF-8',
            },
          },
        },
      });

      expect(result).toEqual({
        success: true,
        messageId: 'aws-ses-message-id-123',
      });
    });

    it('should use default from address when not provided', async () => {
      const mockResponse = {
        MessageId: 'aws-ses-message-id-123',
      };
      mockSesClient.send.mockResolvedValue(mockResponse);

      const optionsWithoutFrom = { ...emailOptions };
      delete optionsWithoutFrom.from;
      delete optionsWithoutFrom.fromName;

      await provider.send(optionsWithoutFrom);

      expect(mockSendEmailCommand).toHaveBeenCalledWith({
        Source: 'noreply@example.com',
        Destination: {
          ToAddresses: ['test@example.com'],
        },
        Message: {
          Subject: {
            Data: 'Test Subject',
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: '<p>Test HTML content</p>',
              Charset: 'UTF-8',
            },
            Text: {
              Data: 'Test text content',
              Charset: 'UTF-8',
            },
          },
        },
      });
    });

    it('should format from address without fromName', async () => {
      const mockResponse = {
        MessageId: 'aws-ses-message-id-123',
      };
      mockSesClient.send.mockResolvedValue(mockResponse);

      const optionsWithoutFromName = { ...emailOptions };
      delete optionsWithoutFromName.fromName;

      await provider.send(optionsWithoutFromName);

      expect(mockSendEmailCommand).toHaveBeenCalledWith({
        Source: 'sender@example.com',
        Destination: {
          ToAddresses: ['test@example.com'],
        },
        Message: {
          Subject: {
            Data: 'Test Subject',
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: '<p>Test HTML content</p>',
              Charset: 'UTF-8',
            },
            Text: {
              Data: 'Test text content',
              Charset: 'UTF-8',
            },
          },
        },
      });
    });

    it('should send email without text content', async () => {
      const mockResponse = {
        MessageId: 'aws-ses-message-id-123',
      };
      mockSesClient.send.mockResolvedValue(mockResponse);

      const optionsWithoutText = { ...emailOptions };
      delete optionsWithoutText.text;

      const result = await provider.send(optionsWithoutText);

      expect(mockSendEmailCommand).toHaveBeenCalledWith({
        Source: 'Test Sender <sender@example.com>',
        Destination: {
          ToAddresses: ['test@example.com'],
        },
        Message: {
          Subject: {
            Data: 'Test Subject',
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: '<p>Test HTML content</p>',
              Charset: 'UTF-8',
            },
          },
        },
      });

      expect(result.success).toBe(true);
    });

    it('should handle AWS SES errors', async () => {
      const awsError = new Error('MessageRejected: Email address not verified');
      mockSesClient.send.mockRejectedValue(awsError);

      const result = await provider.send(emailOptions);

      expect(result).toEqual({
        success: false,
        error: 'MessageRejected: Email address not verified',
      });
    });

    it('should handle network/connection errors', async () => {
      const networkError = new Error('Network connection failed');
      mockSesClient.send.mockRejectedValue(networkError);

      const result = await provider.send(emailOptions);

      expect(result).toEqual({
        success: false,
        error: 'Network connection failed',
      });
    });
  });

  describe('getProviderName', () => {
    it('should return "aws-ses"', () => {
      expect(provider.getProviderName()).toBe('aws-ses');
    });
  });

  describe('constructor', () => {
    it('should initialize SESClient with correct configuration', () => {
      new AwsSesProvider(mockConfig);

      expect(SESClient).toHaveBeenCalledWith({
        region: 'us-east-1',
        credentials: {
          accessKeyId: 'test-access-key',
          secretAccessKey: 'test-secret-key',
        },
      });
    });
  });
});
