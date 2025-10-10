import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel } from '../interfaces/notification-channel.interface';
import { NotificationChannelType } from '../enums/notification-channel.enum';

@Injectable()
export class NotificationChannelFactory {
  private readonly logger = new Logger(NotificationChannelFactory.name);
  private readonly channels = new Map<
    NotificationChannelType,
    INotificationChannel
  >();

  /**
   * Register a notification channel handler
   * @param channel The channel handler to register
   */
  registerChannel(channel: INotificationChannel): void {
    const channelType = channel.getChannelType();

    if (this.channels.has(channelType)) {
      this.logger.warn(
        `Channel ${channelType} is already registered, overriding`,
      );
    }

    this.channels.set(channelType, channel);
    this.logger.log(`Registered notification channel: ${channelType}`);
  }

  /**
   * Get a notification channel handler by type
   * @param type The channel type to retrieve
   * @returns The channel handler instance
   * @throws Error if channel is not registered
   */
  getChannel(type: NotificationChannelType): INotificationChannel {
    const channel = this.channels.get(type);

    if (!channel) {
      throw new Error(`Notification channel ${type} is not registered`);
    }

    return channel;
  }

  /**
   * Get all available (registered) notification channel types
   * @returns Array of registered channel types
   */
  getAvailableChannels(): NotificationChannelType[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Check if a specific channel type is registered
   * @param type The channel type to check
   * @returns True if the channel is registered
   */
  isChannelRegistered(type: NotificationChannelType): boolean {
    return this.channels.has(type);
  }

  /**
   * Get all registered channel handlers
   * @returns Map of channel type to handler instance
   */
  getAllChannels(): Map<NotificationChannelType, INotificationChannel> {
    return new Map(this.channels);
  }

  /**
   * Unregister a channel handler
   * @param type The channel type to unregister
   * @returns True if the channel was unregistered, false if it wasn't registered
   */
  unregisterChannel(type: NotificationChannelType): boolean {
    const existed = this.channels.has(type);
    this.channels.delete(type);

    if (existed) {
      this.logger.log(`Unregistered notification channel: ${type}`);
    }

    return existed;
  }

  /**
   * Clear all registered channels
   */
  clearChannels(): void {
    this.channels.clear();
    this.logger.log('Cleared all registered notification channels');
  }

  /**
   * Get the count of registered channels
   * @returns Number of registered channels
   */
  getChannelCount(): number {
    return this.channels.size;
  }
}
