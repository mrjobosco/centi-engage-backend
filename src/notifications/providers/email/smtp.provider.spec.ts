import { SmtpProvider, SmtpConfig } from './smtp.provider';
import { EmailOptions } from '../../interfaces/email-provider.interface';
import * as nodemailer from 'nodemailer';

// Mock nodemailer
jest.mock('nodemailer', () => {
  return {
    createTransport: jest.fn().mockImplementation(() => ({
      sendMail: jest.fn(),
      verify: jest.fn(),
    })),
  };
});

describe('SmtpProvider', () => {
  let provider: SmtpProvider;
  let mockTransporter: any;

  const mockConfig: SmtpConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'test@gmail.com',
    password: 'test-password',
  };

  beforeEach(() => {
    mockTransporter = {
      sendMail: jest.fn(),
      verify: jest.fn(),
    };
    (nodemailer.createTransport as jest.Mock).mockImplementation(
      () => mockTransporter,
    );

    provider = new SmtpProvider(mockConfig);
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
      const mockInfo = {
        messageId: 'smtp-message-id-123',
        accepted: ['test@example.com'],
        rejected: [],
      };
      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      const result = await provider.send(emailOptions);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'Test Sender <sender@example.com>',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content',
      });

      expect(result).toEqual({
        success: true,
        messageId: 'smtp-message-id-123',
      });
    });

    it('should use config user as default from address when not provided', async () => {
      const mockInfo = {
        messageId: 'smtp-message-id-123',
        accepted: ['test@example.com'],
        rejected: [],
      };
      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      const optionsWithoutFrom = { ...emailOptions };
      delete optionsWithoutFrom.from;
      delete optionsWithoutFrom.fromName;

      await provider.send(optionsWithoutFrom);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@gmail.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content',
      });
    });

    it('should format from address without fromName', async () => {
      const mockInfo = {
        messageId: 'smtp-message-id-123',
        accepted: ['test@example.com'],
        rejected: [],
      };
      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      const optionsWithoutFromName = { ...emailOptions };
      delete optionsWithoutFromName.fromName;

      await provider.send(optionsWithoutFromName);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'sender@example.com',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: 'Test text content',
      });
    });

    it('should send email without text content', async () => {
      const mockInfo = {
        messageId: 'smtp-message-id-123',
        accepted: ['test@example.com'],
        rejected: [],
      };
      mockTransporter.sendMail.mockResolvedValue(mockInfo);

      const optionsWithoutText = { ...emailOptions };
      delete optionsWithoutText.text;

      const result = await provider.send(optionsWithoutText);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'Test Sender <sender@example.com>',
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML content</p>',
        text: undefined,
      });

      expect(result.success).toBe(true);
    });

    it('should handle SMTP errors', async () => {
      const smtpError = new Error('SMTP Authentication failed');
      mockTransporter.sendMail.mockRejectedValue(smtpError);

      const result = await provider.send(emailOptions);

      expect(result).toEqual({
        success: false,
        error: 'SMTP Authentication failed',
      });
    });

    it('should handle network/connection errors', async () => {
      const networkError = new Error('Connection timeout');
      mockTransporter.sendMail.mockRejectedValue(networkError);

      const result = await provider.send(emailOptions);

      expect(result).toEqual({
        success: false,
        error: 'Connection timeout',
      });
    });
  });

  describe('getProviderName', () => {
    it('should return "smtp"', () => {
      expect(provider.getProviderName()).toBe('smtp');
    });
  });

  describe('verifyConnection', () => {
    it('should return true when connection is verified successfully', async () => {
      mockTransporter.verify.mockResolvedValue(true);

      const result = await provider.verifyConnection();

      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when connection verification fails', async () => {
      const verifyError = new Error('Connection failed');
      mockTransporter.verify.mockRejectedValue(verifyError);

      const result = await provider.verifyConnection();

      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('constructor', () => {
    it('should initialize nodemailer transporter with correct configuration', () => {
      new SmtpProvider(mockConfig);

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@gmail.com',
          pass: 'test-password',
        },
      });
    });
  });
});
