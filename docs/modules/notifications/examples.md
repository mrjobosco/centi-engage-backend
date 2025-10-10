# Notification System Examples

## Overview

This document provides practical examples of using the notification system, including basic usage, advanced features, and integration patterns.

## Basic Usage Examples

### Simple Notification

Send a basic notification to a user:

```typescript
import { NotificationService } from '@/notifications';
import { NotificationType, NotificationPriority } from '@/notifications/enums';

@Injectable()
export class UserService {
  constructor(
    private readonly notificationService: NotificationService
  ) {}

  async welcomeNewUser(userId: string): Promise<void> {
    await this.notificationService.sendToUser(userId, {
      type: NotificationType.INFO,
      category: 'user_activity',
      title: 'Welcome to our platform!',
      message: 'Thank you for joining us. Get started by exploring your dashboard.',
      priority: NotificationPriority.MEDIUM
    });
  }
}
```

### Notification with Expiration

Send a time-sensitive notification:

```typescript
async sendMaintenanceAlert(): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 2); // Expires in 2 hours

  await this.notificationService.sendToTenant({
    type: NotificationType.WARNING,
    category: 'system',
    title: 'Scheduled Maintenance',
    message: 'System maintenance will begin at 2:00 AM EST tonight.',
    priority: NotificationPriority.HIGH,
    expiresAt
  });
}
```

### Notification with Custom Data

Include additional data for rich notifications:

```typescript
async notifyInvoiceCreated(userId: string, invoice: Invoice): Promise<void> {
  await this.notificationService.sendToUser(userId, {
    type: NotificationType.INFO,
    category: 'invoice',
    title: 'New Invoice Created',
    message: `Invoice #${invoice.number} for $${invoice.amount} has been created.`,
    priority: NotificationPriority.MEDIUM,
    data: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      amount: invoice.amount,
      dueDate: invoice.dueDate,
      downloadUrl: `/invoices/${invoice.id}/download`
    }
  });
}
```

## Template-Based Notifications

### Using Email Templates

Send notifications with rich email templates:

```typescript
async sendPasswordResetNotification(
  userId: string, 
  resetToken: string
): Promise<void> {
  const resetLink = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
  
  await this.notificationService.sendToUser(userId, {
    type: NotificationType.INFO,
    category: 'security',
    title: 'Password Reset Request',
    message: 'Click the link to reset your password.',
    templateId: 'password-reset',
    templateVariables: {
      resetLink,
      expiresIn: '24 hours',
      supportEmail: 'support@example.com'
    }
  });
}
```

### Category-Based Templates

Use templates automatically based on category:

```typescript
async sendWelcomeEmail(userId: string, user: User): Promise<void> {
  // Template will be automatically selected based on 'welcome' category
  await this.notificationService.sendToUser(userId, {
    type: NotificationType.SUCCESS,
    category: 'welcome',
    title: 'Welcome to Our Platform',
    message: 'Get started with your new account.',
    templateVariables: {
      firstName: user.firstName,
      lastName: user.lastName,
      companyName: user.company?.name || 'Your Company',
      dashboardUrl: `${process.env.APP_URL}/dashboard`
    }
  });
}
```

## Preference-Aware Notifications

### Respecting User Preferences

The system automatically respects user preferences:

```typescript
async sendProjectUpdate(projectId: string, update: ProjectUpdate): Promise<void> {
  // Get all project members
  const members = await this.projectService.getProjectMembers(projectId);
  
  for (const member of members) {
    // Notification will only be sent through channels enabled by the user
    await this.notificationService.sendToUser(member.userId, {
      type: NotificationType.INFO,
      category: 'project',
      title: `Project Update: ${update.title}`,
      message: update.description,
      data: {
        projectId,
        updateId: update.id,
        projectName: update.project.name
      }
    });
  }
}
```

### Checking Preferences Before Sending

Manually check preferences for conditional logic:

```typescript
async sendMarketingNotification(userId: string): Promise<void> {
  // Check if user has marketing notifications enabled
  const enabledChannels = await this.preferenceService.getEnabledChannels(
    userId,
    'marketing'
  );
  
  if (enabledChannels.length === 0) {
    console.log(`User ${userId} has disabled marketing notifications`);
    return;
  }
  
  // Check if user has email enabled for marketing
  if (enabledChannels.includes(NotificationChannelType.EMAIL)) {
    await this.notificationService.sendToUser(userId, {
      type: NotificationType.INFO,
      category: 'marketing',
      title: 'Special Offer Just for You!',
      message: 'Check out our latest features and save 20%.',
      templateId: 'marketing-offer',
      templateVariables: {
        discountCode: 'SAVE20',
        validUntil: '2024-12-31'
      }
    });
  }
}
```

## Bulk Notifications

### Tenant-Wide Announcements

Send notifications to all users in a tenant:

```typescript
async sendSystemAnnouncement(announcement: Announcement): Promise<void> {
  await this.notificationService.sendToTenant({
    type: NotificationType.INFO,
    category: 'system',
    title: announcement.title,
    message: announcement.content,
    priority: NotificationPriority.HIGH,
    data: {
      announcementId: announcement.id,
      publishedAt: announcement.publishedAt
    }
  });
}
```

### Selective Bulk Notifications

Send to users based on specific criteria:

```typescript
async notifyActiveUsers(message: string): Promise<void> {
  // Get users active in the last 30 days
  const activeUsers = await this.userService.getActiveUsers(30);
  
  const notifications = activeUsers.map(user => 
    this.notificationService.sendToUser(user.id, {
      type: NotificationType.INFO,
      category: 'user_activity',
      title: 'We Miss You!',
      message,
      templateVariables: {
        firstName: user.firstName,
        lastLoginDate: user.lastLoginAt
      }
    })
  );
  
  // Send all notifications concurrently
  await Promise.allSettled(notifications);
}
```

## Event-Driven Notifications

### Using Event Listeners

Automatically send notifications based on domain events:

```typescript
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class NotificationEventHandler {
  constructor(
    private readonly notificationService: NotificationService
  ) {}

  @OnEvent('user.registered')
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    await this.notificationService.sendToUser(event.userId, {
      type: NotificationType.SUCCESS,
      category: 'welcome',
      title: 'Welcome aboard!',
      message: 'Your account has been created successfully.',
      templateId: 'user-welcome',
      templateVariables: {
        firstName: event.user.firstName,
        verificationUrl: event.verificationUrl
      }
    });
  }

  @OnEvent('invoice.overdue')
  async handleInvoiceOverdue(event: InvoiceOverdueEvent): Promise<void> {
    await this.notificationService.sendToUser(event.userId, {
      type: NotificationType.ERROR,
      category: 'invoice',
      title: 'Invoice Overdue',
      message: `Invoice #${event.invoice.number} is now overdue.`,
      priority: NotificationPriority.HIGH,
      data: {
        invoiceId: event.invoice.id,
        amount: event.invoice.amount,
        daysPastDue: event.daysPastDue
      }
    });
  }

  @OnEvent('project.milestone.completed')
  async handleMilestoneCompleted(event: MilestoneCompletedEvent): Promise<void> {
    // Notify all project stakeholders
    const stakeholders = await this.projectService.getStakeholders(event.projectId);
    
    for (const stakeholder of stakeholders) {
      await this.notificationService.sendToUser(stakeholder.userId, {
        type: NotificationType.SUCCESS,
        category: 'project',
        title: 'Milestone Completed!',
        message: `${event.milestone.name} has been completed.`,
        data: {
          projectId: event.projectId,
          milestoneId: event.milestone.id,
          completedBy: event.completedBy,
          completedAt: event.completedAt
        }
      });
    }
  }
}
```

### Manual Event Emission

Trigger notifications by emitting events:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class OrderService {
  constructor(
    private readonly eventEmitter: EventEmitter2
  ) {}

  async processOrder(order: Order): Promise<void> {
    // Process the order
    await this.fulfillOrder(order);
    
    // Emit event to trigger notifications
    this.eventEmitter.emit('order.processed', {
      orderId: order.id,
      userId: order.userId,
      amount: order.total,
      items: order.items
    });
  }
}
```

## Real-Time Notifications

### WebSocket Integration

Handle real-time notifications on the client side:

```typescript
// Client-side WebSocket handling
import { io, Socket } from 'socket.io-client';

class NotificationClient {
  private socket: Socket;

  constructor(token: string) {
    this.socket = io('ws://localhost:3000', {
      auth: { token }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.socket.on('connect', () => {
      console.log('Connected to notification server');
    });

    this.socket.on('notification', (notification) => {
      this.displayNotification(notification);
    });

    this.socket.on('unread_count', (count) => {
      this.updateUnreadBadge(count);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from notification server');
    });
  }

  private displayNotification(notification: any): void {
    // Show browser notification
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/notification-icon.png'
      });
    }

    // Update UI
    this.addToNotificationList(notification);
  }

  markAsRead(notificationId: string): void {
    this.socket.emit('mark_as_read', { notificationId });
  }
}
```

### Server-Side WebSocket Events

Emit custom WebSocket events:

```typescript
@Injectable()
export class ChatService {
  constructor(
    private readonly notificationGateway: NotificationGateway
  ) {}

  async sendMessage(chatId: string, message: ChatMessage): Promise<void> {
    // Save message to database
    await this.saveChatMessage(message);
    
    // Get chat participants
    const participants = await this.getChatParticipants(chatId);
    
    // Send real-time notification to all participants except sender
    for (const participant of participants) {
      if (participant.userId !== message.senderId) {
        this.notificationGateway.emitToUser(participant.userId, 'chat_message', {
          chatId,
          message: {
            id: message.id,
            content: message.content,
            sender: message.sender,
            timestamp: message.createdAt
          }
        });
      }
    }
  }
}
```

## Advanced Features

### Notification Scheduling

Schedule notifications for future delivery:

```typescript
async scheduleReminder(
  userId: string, 
  reminderDate: Date, 
  content: string
): Promise<void> {
  // Calculate delay
  const delay = reminderDate.getTime() - Date.now();
  
  if (delay <= 0) {
    throw new Error('Reminder date must be in the future');
  }
  
  // Schedule notification using a job queue
  await this.queueService.addDelayedJob('send-reminder', {
    userId,
    content,
    scheduledFor: reminderDate
  }, delay);
}
```

### Notification Batching

Batch multiple notifications into a digest:

```typescript
async sendDailyDigest(userId: string): Promise<void> {
  // Get unread notifications from the last 24 hours
  const notifications = await this.getUnreadNotifications(userId, {
    since: new Date(Date.now() - 24 * 60 * 60 * 1000)
  });
  
  if (notifications.length === 0) {
    return; // No notifications to digest
  }
  
  // Group notifications by category
  const groupedNotifications = this.groupByCategory(notifications);
  
  await this.notificationService.sendToUser(userId, {
    type: NotificationType.INFO,
    category: 'system',
    title: `Daily Digest - ${notifications.length} Updates`,
    message: 'Here\'s what happened while you were away.',
    templateId: 'daily-digest',
    templateVariables: {
      notifications: groupedNotifications,
      totalCount: notifications.length,
      digestDate: new Date().toDateString()
    }
  });
}
```

### Conditional Notifications

Send notifications based on complex conditions:

```typescript
async sendSmartNotification(
  userId: string, 
  event: UserActivityEvent
): Promise<void> {
  // Get user's activity pattern
  const activityPattern = await this.getUserActivityPattern(userId);
  
  // Check if user is likely to be online
  const isLikelyOnline = this.isUserLikelyOnline(activityPattern);
  
  // Get user's notification preferences
  const preferences = await this.preferenceService.getUserPreferences(userId);
  
  // Determine optimal notification strategy
  let channels: NotificationChannelType[] = [];
  
  if (isLikelyOnline) {
    // User is likely online, prefer in-app notifications
    channels = [NotificationChannelType.IN_APP];
  } else {
    // User is likely offline, use persistent channels
    channels = [NotificationChannelType.EMAIL];
    
    // Add SMS for urgent notifications if enabled
    if (event.priority === NotificationPriority.URGENT) {
      const smsEnabled = preferences.some(p => 
        p.category === event.category && p.smsEnabled
      );
      if (smsEnabled) {
        channels.push(NotificationChannelType.SMS);
      }
    }
  }
  
  // Send notification through selected channels
  await this.notificationService.sendThroughSpecificChannels(
    userId,
    {
      type: NotificationType.INFO,
      category: event.category,
      title: event.title,
      message: event.message,
      priority: event.priority
    },
    channels
  );
}
```

## Error Handling Examples

### Graceful Failure Handling

Handle notification failures gracefully:

```typescript
async sendCriticalNotification(
  userId: string, 
  notification: NotificationPayload
): Promise<void> {
  try {
    const result = await this.notificationService.sendToUser(userId, notification);
    
    // Check if notification was delivered through at least one channel
    if (result.channelsSent.length === 0) {
      // No channels succeeded, try fallback
      await this.sendFallbackNotification(userId, notification);
    }
    
  } catch (error) {
    this.logger.error('Failed to send critical notification', error);
    
    // Try alternative delivery method
    await this.sendEmergencyNotification(userId, notification);
  }
}

private async sendFallbackNotification(
  userId: string, 
  notification: NotificationPayload
): Promise<void> {
  // Try sending via email only as fallback
  try {
    await this.emailService.sendDirectEmail(userId, {
      subject: notification.title,
      body: notification.message
    });
  } catch (error) {
    this.logger.error('Fallback notification also failed', error);
    
    // Log to admin dashboard for manual follow-up
    await this.adminService.logFailedCriticalNotification(userId, notification);
  }
}
```

### Retry Logic

Implement custom retry logic for important notifications:

```typescript
async sendWithRetry(
  userId: string,
  notification: NotificationPayload,
  maxRetries: number = 3
): Promise<void> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.notificationService.sendToUser(userId, notification);
      return; // Success, exit retry loop
      
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        this.logger.warn(
          `Notification attempt ${attempt} failed, retrying in ${delay}ms`,
          error
        );
      }
    }
  }
  
  // All retries failed
  this.logger.error(
    `Failed to send notification after ${maxRetries} attempts`,
    lastError
  );
  
  throw new Error(`Notification delivery failed after ${maxRetries} attempts`);
}
```

## Testing Examples

### Unit Testing Notifications

Test notification service functionality:

```typescript
describe('NotificationService', () => {
  let service: NotificationService;
  let mockPreferenceService: jest.Mocked<NotificationPreferenceService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: NotificationPreferenceService,
          useValue: {
            getEnabledChannels: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    mockPreferenceService = module.get(NotificationPreferenceService);
  });

  it('should send notification through enabled channels only', async () => {
    // Arrange
    mockPreferenceService.getEnabledChannels.mockResolvedValue([
      NotificationChannelType.EMAIL
    ]);

    // Act
    const result = await service.sendToUser('user-123', {
      type: NotificationType.INFO,
      category: 'test',
      title: 'Test',
      message: 'Test message'
    });

    // Assert
    expect(result.channelsSent).toEqual([NotificationChannelType.EMAIL]);
    expect(mockPreferenceService.getEnabledChannels).toHaveBeenCalledWith(
      'user-123',
      'test'
    );
  });
});
```

### Integration Testing

Test end-to-end notification flow:

```typescript
describe('Notification Integration', () => {
  let app: INestApplication;
  let notificationService: NotificationService;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    notificationService = app.get<NotificationService>(NotificationService);
  });

  it('should create and deliver notification', async () => {
    // Create test user with preferences
    const user = await createTestUser({
      preferences: {
        'test_category': {
          inAppEnabled: true,
          emailEnabled: true,
          smsEnabled: false
        }
      }
    });

    // Send notification
    const notification = await notificationService.sendToUser(user.id, {
      type: NotificationType.INFO,
      category: 'test_category',
      title: 'Integration Test',
      message: 'This is a test notification'
    });

    // Verify notification was created
    expect(notification).toBeDefined();
    expect(notification.channelsSent).toContain(NotificationChannelType.IN_APP);
    expect(notification.channelsSent).toContain(NotificationChannelType.EMAIL);
    expect(notification.channelsSent).not.toContain(NotificationChannelType.SMS);

    // Verify notification appears in user's list
    const userNotifications = await notificationService.getUserNotifications(user.id);
    expect(userNotifications.notifications).toHaveLength(1);
    expect(userNotifications.notifications[0].id).toBe(notification.id);
  });
});
```

These examples demonstrate the flexibility and power of the notification system, showing how to handle various use cases from simple notifications to complex, event-driven workflows with proper error handling and testing.