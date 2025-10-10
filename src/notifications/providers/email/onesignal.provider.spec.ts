import { OneSignalProvider } from './onesignal.provider';
import { EmailOptions } from '../../interfaces/email-provider.interface';
import * as OneSignal from 'onesignal-node';

// Mock the onesignal-node module
jest.mock('onesignal-node', () => {
  return {
    Client: jest.fn().mockImplementation(() => ({
      createNotification: jest.fn(),
    })),
  };
});

describe('OneSignalProvider', () => {
  let provider: OneSignalProvider;
  let mockOneSignalClient: any;

  beforeEach(() => {
    mockOneSignalClient = {
      createNotification: jest.fn(),
    };
    (OneSignal.Client as jest.Mock).mockImplementation(
      () => mockOneSignalClient,
    );

    provider = new OneSignalProvider('test-api-key', 'test-app-id');
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
        body: {
          id: 'onesignal-notification-id-123',
          recipients: 1,
          errors: [],
        },
      };
      mockOneSignalClient.createNotification.mockResolvedValue(mockResponse);

      const result = await provider.send(emailOptions);

      expect(mockOneSignalClient.createNotification).toHaveBeenCalledWith({
        contents: {
          en: '<p>Test HTML content</p>',
        },
        headings: {
          en: 'Test Subject',
        },
        email_subject: 'Test Subject',
        email_body: '<p>Test HTML content</p>',
        email_from_name: 'Test Sender',
        email_from_address: 'sender@example.com',
        include_email_tokens: ['test@example.com'],
        template_id: undefined,
      });

      expect(result).toEqual({
        success: true,
        messageId: 'onesignal-notification-id-123',
      });
    });

    it('should use default values when optional fields are not provided', async () => {
      const mockResponse = {
        body: {
          id: 'onesignal-notification-id-123',
          recipients: 1,
          errors: [],
        },
      };
      mockOneSignalClient.createNotification.mockResolvedValue(mockResponse);

      const minimalOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
      };

      await provider.send(minimalOptions);

      expect(mockOneSignalClient.createNotification).toHaveBeenCalledWith({
        contents: {
          en: '<p>Test HTML content</p>',
        },
        headings: {
          en: 'Test Subject',
        },
        email_subject: 'Test Subject',
        email_body: '<p>Test HTML content</p>',
        email_from_name: 'Notification',
        email_from_address: 'noreply@example.com',
        include_email_tokens: ['test@example.com'],
        template_id: undefined,
      });
    });

    it('should fallback to text content when html is not provided', async () => {
      const mockResponse = {
        body: {
          id: 'onesignal-notification-id-123',
          recipients: 1,
          errors: [],
        },
      };
      mockOneSignalClient.createNotification.mockResolvedValue(mockResponse);

      const textOnlyOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
        text: 'Test text content',
      };

      await provider.send(textOnlyOptions);

      expect(mockOneSignalClient.createNotification).toHaveBeenCalledWith({
        contents: {
          en: 'Test text content',
        },
        headings: {
          en: 'Test Subject',
        },
        email_subject: 'Test Subject',
        email_body: undefined,
        email_from_name: 'Notification',
        email_from_address: 'noreply@example.com',
        include_email_tokens: ['test@example.com'],
        template_id: undefined,
      });
    });

    it('should fallback to subject when neither html nor text is provided', async () => {
      const mockResponse = {
        body: {
          id: 'onesignal-notification-id-123',
          recipients: 1,
          errors: [],
        },
      };
      mockOneSignalClient.createNotification.mockResolvedValue(mockResponse);

      const subjectOnlyOptions = {
        to: 'test@example.com',
        subject: 'Test Subject',
      };

      await provider.send(subjectOnlyOptions);

      expect(mockOneSignalClient.createNotification).toHaveBeenCalledWith({
        contents: {
          en: 'Test Subject',
        },
        headings: {
          en: 'Test Subject',
        },
        email_subject: 'Test Subject',
        email_body: undefined,
        email_from_name: 'Notification',
        email_from_address: 'noreply@example.com',
        include_email_tokens: ['test@example.com'],
        template_id: undefined,
      });
    });

    it('should handle OneSignal API errors', async () => {
      const mockResponse = {
        body: {
          id: null,
          recipients: 0,
          errors: ['Invalid email address', 'Missing required field'],
        },
      };
      mockOneSignalClient.createNotification.mockResolvedValue(mockResponse);

      const result = await provider.send(emailOptions);

      expect(result).toEqual({
        success: false,
        error: 'Invalid email address, Missing required field',
      });
    });

    it('should handle network/connection errors', async () => {
      const networkError = new Error('Network connection failed');
      mockOneSignalClient.createNotification.mockRejectedValue(networkError);

      const result = await provider.send(emailOptions);

      expect(result).toEqual({
        success: false,
        error: 'Network connection failed',
      });
    });

    it('should handle successful response with no errors', async () => {
      const mockResponse = {
        body: {
          id: 'onesignal-notification-id-123',
          recipients: 1,
          errors: null, // Sometimes errors can be null instead of empty array
        },
      };
      mockOneSignalClient.createNotification.mockResolvedValue(mockResponse);

      const result = await provider.send(emailOptions);

      expect(result).toEqual({
        success: true,
        messageId: 'onesignal-notification-id-123',
      });
    });
  });

  describe('getProviderName', () => {
    it('should return "onesignal"', () => {
      expect(provider.getProviderName()).toBe('onesignal');
    });
  });

  describe('constructor', () => {
    it('should initialize OneSignal Client with correct configuration', () => {
      new OneSignalProvider('test-api-key', 'test-app-id');

      expect(OneSignal.Client).toHaveBeenCalledWith(
        'test-app-id',
        'test-api-key',
      );
    });
  });
});
