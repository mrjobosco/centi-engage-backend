import { Test, TestingModule } from '@nestjs/testing';
import { TermiiProvider } from './termii.provider';
import { SmsOptions } from '../../interfaces/sms-provider.interface';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TermiiProvider', () => {
  let provider: TermiiProvider;
  const mockApiKey = 'test-api-key';
  const mockSenderId = 'TestApp';
  const mockAxiosInstance = {
    post: jest.fn(),
  };

  beforeEach(async () => {
    // Mock axios.create to return our mock instance
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TermiiProvider,
          useFactory: () => new TermiiProvider(mockApiKey, mockSenderId),
        },
      ],
    }).compile();

    provider = module.get<TermiiProvider>(TermiiProvider);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('send', () => {
    const smsOptions: SmsOptions = {
      to: '+2348123456789',
      message: 'Test SMS message',
    };

    it('should send SMS successfully', async () => {
      const mockMessageId = 'termii-msg-123';
      const mockResponse = {
        data: {
          message_id: mockMessageId,
          message: 'Successfully Sent',
          balance: 100,
          user: 'test@example.com',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.send(smsOptions);

      expect(result).toEqual({
        success: true,
        messageId: mockMessageId,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://api.ng.termii.com/api/sms/send',
        {
          to: smsOptions.to,
          from: mockSenderId,
          sms: smsOptions.message,
          type: 'plain',
          api_key: mockApiKey,
          channel: 'generic',
        },
      );
    });

    it('should use custom from sender when provided', async () => {
      const customFrom = 'CustomApp';
      const smsOptionsWithFrom: SmsOptions = {
        ...smsOptions,
        from: customFrom,
      };

      const mockMessageId = 'termii-msg-123';
      const mockResponse = {
        data: {
          message_id: mockMessageId,
          message: 'Successfully Sent',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await provider.send(smsOptionsWithFrom);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://api.ng.termii.com/api/sms/send',
        {
          to: smsOptionsWithFrom.to,
          from: customFrom,
          sms: smsOptionsWithFrom.message,
          type: 'plain',
          api_key: mockApiKey,
          channel: 'generic',
        },
      );
    });

    it('should use default sender "Termii" when no senderId provided', async () => {
      // Create provider without senderId
      const providerWithoutSender = new TermiiProvider(mockApiKey);

      const mockMessageId = 'termii-msg-123';
      const mockResponse = {
        data: {
          message_id: mockMessageId,
          message: 'Successfully Sent',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      await providerWithoutSender.send(smsOptions);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        'https://api.ng.termii.com/api/sms/send',
        {
          to: smsOptions.to,
          from: 'Termii',
          sms: smsOptions.message,
          type: 'plain',
          api_key: mockApiKey,
          channel: 'generic',
        },
      );
    });

    it('should handle Termii API errors with error message', async () => {
      const errorMessage = 'Invalid API key';
      const mockResponse = {
        data: {
          message: errorMessage,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.send(smsOptions);

      expect(result).toEqual({
        success: false,
        error: errorMessage,
      });
    });

    it('should handle HTTP errors', async () => {
      const errorMessage = 'Insufficient balance';
      const httpError = {
        response: {
          data: {
            message: errorMessage,
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(httpError);

      const result = await provider.send(smsOptions);

      expect(result).toEqual({
        success: false,
        error: errorMessage,
      });
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      mockAxiosInstance.post.mockRejectedValue(networkError);

      const result = await provider.send(smsOptions);

      expect(result).toEqual({
        success: false,
        error: 'Network Error',
      });
    });

    it('should handle unknown errors', async () => {
      const unknownError = {};
      mockAxiosInstance.post.mockRejectedValue(unknownError);

      const result = await provider.send(smsOptions);

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
      });
    });
  });

  describe('getProviderName', () => {
    it('should return "termii"', () => {
      expect(provider.getProviderName()).toBe('termii');
    });
  });
});
