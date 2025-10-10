import { ResendProvider } from './resend.provider';
import { EmailOptions } from '../../interfaces/email-provider.interface';
import { Resend } from 'resend';

// Mock the Resend module
jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn(),
      },
    })),
  };
});

describe('ResendProvider', () => {
  let provider: ResendProvider;
  let mockResendInstance: any;

  beforeEach(() => {
    mockResendInstance = {
      emails: {
        send: jest.fn(),
      },
    };
    (Resend as jest.Mock).mockImplementation(() => mockResendInstance);

    provider = new ResendProvider('test-api-key');
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
    };

    it('should send email successfully', async () => {
      const mockResponse = {
        data: { id: 'resend-message-id-123' },
        error: null,
      };
      mockResendInstance.emails.send.mockResolvedValue(mockResponse);

      const result = await provider.send(emailOptions);

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'sender@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content',
      });

      expect(result).toEqual({
        success: true,
        messageId: 'resend-message-id-123',
      });
    });

    it('should use default from address when not provided', async () => {
      const mockResponse = {
        data: { id: 'resend-message-id-123' },
        error: null,
      };
      mockResendInstance.emails.send.mockResolvedValue(mockResponse);

      const optionsWithoutFrom = { ...emailOptions };
      delete optionsWithoutFrom.from;

      await provider.send(optionsWithoutFrom);

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content',
      });
    });

    it('should handle Resend API errors', async () => {
      const mockResponse = {
        data: null,
        error: {
          message: 'Invalid API key',
          name: 'validation_error',
        },
      };
      mockResendInstance.emails.send.mockResolvedValue(mockResponse);

      const result = await provider.send(emailOptions);

      expect(result).toEqual({
        success: false,
        error: 'Invalid API key',
      });
    });

    it('should handle network/connection errors', async () => {
      const networkError = new Error('Network connection failed');
      mockResendInstance.emails.send.mockRejectedValue(networkError);

      const result = await provider.send(emailOptions);

      expect(result).toEqual({
        success: false,
        error: 'Network connection failed',
      });
    });

    it('should send email without text content', async () => {
      const mockResponse = {
        data: { id: 'resend-message-id-123' },
        error: null,
      };
      mockResendInstance.emails.send.mockResolvedValue(mockResponse);

      const optionsWithoutText = { ...emailOptions };
      delete optionsWithoutText.text;

      const result = await provider.send(optionsWithoutText);

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'sender@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test Subject', // Falls back to subject when text is undefined
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getProviderName', () => {
    it('should return "resend"', () => {
      expect(provider.getProviderName()).toBe('resend');
    });
  });
});
