import { Test, TestingModule } from '@nestjs/testing';
import { TwilioProvider } from './twilio.provider';
import { SmsOptions } from '../../interfaces/sms-provider.interface';

// Mock Twilio
const mockTwilioClient = {
  messages: {
    create: jest.fn(),
  },
};

jest.mock('twilio', () => ({
  Twilio: jest.fn().mockImplementation(() => mockTwilioClient),
}));

describe('TwilioProvider', () => {
  let provider: TwilioProvider;
  const mockAccountSid = 'test-account-sid';
  const mockAuthToken = 'test-auth-token';
  const mockFromNumber = '+1234567890';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: TwilioProvider,
          useFactory: () =>
            new TwilioProvider(mockAccountSid, mockAuthToken, mockFromNumber),
        },
      ],
    }).compile();

    provider = module.get<TwilioProvider>(TwilioProvider);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('send', () => {
    const smsOptions: SmsOptions = {
      to: '+0987654321',
      message: 'Test SMS message',
    };

    it('should send SMS successfully', async () => {
      const mockMessageSid = 'SM123456789';
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: mockMessageSid,
      });

      const result = await provider.send(smsOptions);

      expect(result).toEqual({
        success: true,
        messageId: mockMessageSid,
      });

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: smsOptions.message,
        from: mockFromNumber,
        to: smsOptions.to,
      });
    });

    it('should use custom from number when provided', async () => {
      const customFrom = '+1111111111';
      const smsOptionsWithFrom: SmsOptions = {
        ...smsOptions,
        from: customFrom,
      };

      const mockMessageSid = 'SM123456789';
      mockTwilioClient.messages.create.mockResolvedValue({
        sid: mockMessageSid,
      });

      await provider.send(smsOptionsWithFrom);

      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith({
        body: smsOptionsWithFrom.message,
        from: customFrom,
        to: smsOptionsWithFrom.to,
      });
    });

    it('should handle Twilio API errors', async () => {
      const errorMessage = 'Invalid phone number';
      mockTwilioClient.messages.create.mockRejectedValue(
        new Error(errorMessage),
      );

      const result = await provider.send(smsOptions);

      expect(result).toEqual({
        success: false,
        error: errorMessage,
      });
    });

    it('should handle Twilio API errors with status code', async () => {
      const twilioError = {
        message: 'The number +0987654321 is unverified',
        code: 21608,
        status: 400,
      };
      mockTwilioClient.messages.create.mockRejectedValue(twilioError);

      const result = await provider.send(smsOptions);

      expect(result).toEqual({
        success: false,
        error: twilioError.message,
      });
    });
  });

  describe('getProviderName', () => {
    it('should return "twilio"', () => {
      expect(provider.getProviderName()).toBe('twilio');
    });
  });
});
