/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unused-vars */
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationChannelFactory } from './notification-channel.factory';
import { INotificationChannel } from '../interfaces/notification-channel.interface';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationPayload } from '../interfaces/notification-payload.interface';
import { NotificationResult } from '../interfaces/notification-result.interface';

// Mock channel implementations for testing
class MockInAppChannel implements INotificationChannel {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: true,
      channel: NotificationChannelType.IN_APP,
      messageId: 'mock-in-app-id',
    };
  }

  validate(payload: NotificationPayload): boolean {
    return !!payload;
  }

  getChannelType(): NotificationChannelType {
    return NotificationChannelType.IN_APP;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

class MockEmailChannel implements INotificationChannel {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: true,
      channel: NotificationChannelType.EMAIL,
      messageId: 'mock-email-id',
    };
  }

  validate(payload: NotificationPayload): boolean {
    return !!payload;
  }

  getChannelType(): NotificationChannelType {
    return NotificationChannelType.EMAIL;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

class MockSmsChannel implements INotificationChannel {
  async send(payload: NotificationPayload): Promise<NotificationResult> {
    return {
      success: true,
      channel: NotificationChannelType.SMS,
      messageId: 'mock-sms-id',
    };
  }

  validate(payload: NotificationPayload): boolean {
    return !!payload;
  }

  getChannelType(): NotificationChannelType {
    return NotificationChannelType.SMS;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

describe('NotificationChannelFactory', () => {
  let factory: NotificationChannelFactory;
  let mockInAppChannel: MockInAppChannel;
  let mockEmailChannel: MockEmailChannel;
  let mockSmsChannel: MockSmsChannel;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationChannelFactory],
    }).compile();

    factory = module.get<NotificationChannelFactory>(
      NotificationChannelFactory,
    );
    mockInAppChannel = new MockInAppChannel();
    mockEmailChannel = new MockEmailChannel();
    mockSmsChannel = new MockSmsChannel();
  });

  afterEach(() => {
    // Clear channels after each test to ensure clean state
    factory.clearChannels();
  });

  describe('registerChannel', () => {
    it('should register a channel successfully', () => {
      factory.registerChannel(mockInAppChannel);

      expect(factory.isChannelRegistered(NotificationChannelType.IN_APP)).toBe(
        true,
      );
      expect(factory.getChannelCount()).toBe(1);
    });

    it('should register multiple channels', () => {
      factory.registerChannel(mockInAppChannel);
      factory.registerChannel(mockEmailChannel);
      factory.registerChannel(mockSmsChannel);

      expect(factory.getChannelCount()).toBe(3);
      expect(factory.isChannelRegistered(NotificationChannelType.IN_APP)).toBe(
        true,
      );
      expect(factory.isChannelRegistered(NotificationChannelType.EMAIL)).toBe(
        true,
      );
      expect(factory.isChannelRegistered(NotificationChannelType.SMS)).toBe(
        true,
      );
    });

    it('should override existing channel when registering same type', () => {
      const firstChannel = mockInAppChannel;
      const secondChannel = new MockInAppChannel();

      factory.registerChannel(firstChannel);
      factory.registerChannel(secondChannel);

      expect(factory.getChannelCount()).toBe(1);
      expect(factory.getChannel(NotificationChannelType.IN_APP)).toBe(
        secondChannel,
      );
    });
  });

  describe('getChannel', () => {
    beforeEach(() => {
      factory.registerChannel(mockInAppChannel);
      factory.registerChannel(mockEmailChannel);
    });

    it('should return registered channel', () => {
      const channel = factory.getChannel(NotificationChannelType.IN_APP);
      expect(channel).toBe(mockInAppChannel);
    });

    it('should return correct channel for each type', () => {
      expect(factory.getChannel(NotificationChannelType.IN_APP)).toBe(
        mockInAppChannel,
      );
      expect(factory.getChannel(NotificationChannelType.EMAIL)).toBe(
        mockEmailChannel,
      );
    });

    it('should throw error for unregistered channel', () => {
      expect(() => {
        factory.getChannel(NotificationChannelType.SMS);
      }).toThrow('Notification channel SMS is not registered');
    });
  });

  describe('getAvailableChannels', () => {
    it('should return empty array when no channels registered', () => {
      const channels = factory.getAvailableChannels();
      expect(channels).toEqual([]);
    });

    it('should return all registered channel types', () => {
      factory.registerChannel(mockInAppChannel);
      factory.registerChannel(mockEmailChannel);

      const channels = factory.getAvailableChannels();
      expect(channels).toHaveLength(2);
      expect(channels).toContain(NotificationChannelType.IN_APP);
      expect(channels).toContain(NotificationChannelType.EMAIL);
    });

    it('should return channels in registration order', () => {
      factory.registerChannel(mockEmailChannel);
      factory.registerChannel(mockInAppChannel);
      factory.registerChannel(mockSmsChannel);

      const channels = factory.getAvailableChannels();
      expect(channels).toEqual([
        NotificationChannelType.EMAIL,
        NotificationChannelType.IN_APP,
        NotificationChannelType.SMS,
      ]);
    });
  });

  describe('isChannelRegistered', () => {
    beforeEach(() => {
      factory.registerChannel(mockInAppChannel);
    });

    it('should return true for registered channel', () => {
      expect(factory.isChannelRegistered(NotificationChannelType.IN_APP)).toBe(
        true,
      );
    });

    it('should return false for unregistered channel', () => {
      expect(factory.isChannelRegistered(NotificationChannelType.EMAIL)).toBe(
        false,
      );
      expect(factory.isChannelRegistered(NotificationChannelType.SMS)).toBe(
        false,
      );
    });
  });

  describe('getAllChannels', () => {
    it('should return empty map when no channels registered', () => {
      const channels = factory.getAllChannels();
      expect(channels.size).toBe(0);
    });

    it('should return map of all registered channels', () => {
      factory.registerChannel(mockInAppChannel);
      factory.registerChannel(mockEmailChannel);

      const channels = factory.getAllChannels();
      expect(channels.size).toBe(2);
      expect(channels.get(NotificationChannelType.IN_APP)).toBe(
        mockInAppChannel,
      );
      expect(channels.get(NotificationChannelType.EMAIL)).toBe(
        mockEmailChannel,
      );
    });

    it('should return a copy of the internal map', () => {
      factory.registerChannel(mockInAppChannel);

      const channels = factory.getAllChannels();
      channels.clear();

      // Original factory should still have the channel
      expect(factory.getChannelCount()).toBe(1);
    });
  });

  describe('unregisterChannel', () => {
    beforeEach(() => {
      factory.registerChannel(mockInAppChannel);
      factory.registerChannel(mockEmailChannel);
    });

    it('should unregister existing channel and return true', () => {
      const result = factory.unregisterChannel(NotificationChannelType.IN_APP);

      expect(result).toBe(true);
      expect(factory.isChannelRegistered(NotificationChannelType.IN_APP)).toBe(
        false,
      );
      expect(factory.getChannelCount()).toBe(1);
    });

    it('should return false for non-existent channel', () => {
      const result = factory.unregisterChannel(NotificationChannelType.SMS);

      expect(result).toBe(false);
      expect(factory.getChannelCount()).toBe(2);
    });

    it('should not affect other channels when unregistering', () => {
      factory.unregisterChannel(NotificationChannelType.IN_APP);

      expect(factory.isChannelRegistered(NotificationChannelType.EMAIL)).toBe(
        true,
      );
      expect(factory.getChannel(NotificationChannelType.EMAIL)).toBe(
        mockEmailChannel,
      );
    });
  });

  describe('clearChannels', () => {
    beforeEach(() => {
      factory.registerChannel(mockInAppChannel);
      factory.registerChannel(mockEmailChannel);
      factory.registerChannel(mockSmsChannel);
    });

    it('should remove all registered channels', () => {
      expect(factory.getChannelCount()).toBe(3);

      factory.clearChannels();

      expect(factory.getChannelCount()).toBe(0);
      expect(factory.getAvailableChannels()).toEqual([]);
    });

    it('should make all channels unavailable after clearing', () => {
      factory.clearChannels();

      expect(() =>
        factory.getChannel(NotificationChannelType.IN_APP),
      ).toThrow();
      expect(() => factory.getChannel(NotificationChannelType.EMAIL)).toThrow();
      expect(() => factory.getChannel(NotificationChannelType.SMS)).toThrow();
    });
  });

  describe('getChannelCount', () => {
    it('should return 0 when no channels registered', () => {
      expect(factory.getChannelCount()).toBe(0);
    });

    it('should return correct count after registering channels', () => {
      factory.registerChannel(mockInAppChannel);
      expect(factory.getChannelCount()).toBe(1);

      factory.registerChannel(mockEmailChannel);
      expect(factory.getChannelCount()).toBe(2);

      factory.registerChannel(mockSmsChannel);
      expect(factory.getChannelCount()).toBe(3);
    });

    it('should return correct count after unregistering channels', () => {
      factory.registerChannel(mockInAppChannel);
      factory.registerChannel(mockEmailChannel);
      expect(factory.getChannelCount()).toBe(2);

      factory.unregisterChannel(NotificationChannelType.IN_APP);
      expect(factory.getChannelCount()).toBe(1);
    });
  });

  describe('integration with actual channel interfaces', () => {
    it('should work with channels that implement INotificationChannel', async () => {
      factory.registerChannel(mockInAppChannel);

      const channel = factory.getChannel(NotificationChannelType.IN_APP);

      // Test that the channel works as expected
      expect(channel.getChannelType()).toBe(NotificationChannelType.IN_APP);
      expect(await channel.isAvailable()).toBe(true);

      const mockPayload: NotificationPayload = {
        tenantId: 'tenant-1',
        userId: 'user-1',
        category: 'test',
        type: 'INFO' as any,
        title: 'Test',
        message: 'Test message',
      };

      expect(channel.validate(mockPayload)).toBe(true);

      const result = await channel.send(mockPayload);
      expect(result.success).toBe(true);
      expect(result.channel).toBe(NotificationChannelType.IN_APP);
    });
  });

  describe('error handling', () => {
    it('should handle channel registration errors gracefully', () => {
      // Test with null channel (should not crash)
      expect(() => {
        factory.registerChannel(null as any);
      }).toThrow();
    });

    it('should provide clear error messages for missing channels', () => {
      expect(() => {
        factory.getChannel(NotificationChannelType.EMAIL);
      }).toThrow('Notification channel EMAIL is not registered');
    });
  });
});
