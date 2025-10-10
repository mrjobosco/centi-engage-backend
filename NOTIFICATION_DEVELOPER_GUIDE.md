# Notification System Developer Guide

This guide provides comprehensive documentation for developers working with the notification system, including how to trigger notifications, create templates, add new channels, and configure providers.

## Table of Contents

- [Getting Started](#getting-started)
- [Triggering Notifications](#triggering-notifications)
- [Creating Custom Templates](#creating-custom-templates)
- [Adding New Notification Channels](#adding-new-notification-channels)
- [Configuring Providers](#configuring-providers)
- [Event-Driven Notifications](#event-driven-notifications)
- [Testing](#testing)
- [Best Practices](#best-practices)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Redis server for queue processing
- PostgreSQL database
- NestJS application with the notification module installed

### Installation

The notification system is already integrated into the application. To use it in your services:

```typescript
import { NotificationService } from '../notifications/services/notification.service';
import { NotificationType, NotificationPriority } from '../notifications/enums';

@Injectable()
export class YourService {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}
}
```

## Triggering Notifications

### Basic Notification Creation

#### Send to Single User

```typescript
import { NotificationService } from '../notifications/services/notification.service';
import { NotificationType, NotificationPriority } from '../notifications/enums';

@Injectable()
export class InvoiceService {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  async createInvoice(invoiceData: CreateInvoiceDto) {
    // Create invoice logic...
    const invoice = await this.createInvoiceRecord(invoiceData);

    // Send notification to user
    await this.notificationService.sendToUser(invoice.userId, {
      category: 'invoice',
      type: NotificationType.INFO,
      title: 'New Invoice Generated',
      message: `Your invoice #${invoice.number} has been generated and is ready for review.`,
      data: {
        invoiceId: invoice.id,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
      },
      priority: NotificationPriority.MEDIUM,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    return invoice;
  }
}
```

#### Send to All Tenant Users (Admin Only)

```typescript
@Injectable()
export class SystemService {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  async scheduleMaintenanceNotification() {
    // Send to all users in the current tenant
    const notifications = await this.notificationService.sendToTenant({
      category: 'system',
      type: NotificationType.WARNING,
      title: 'Scheduled Maintenance',
      message: 'System maintenance is scheduled for tonight from 2:00 AM to 4:00 AM UTC.',
      data: {
        maintenanceStart: '2024-01-16T02:00:00Z',
        maintenanceEnd: '2024-01-16T04:00:00Z',
      },
      priority: NotificationPriority.HIGH,
    });

    return notifications;
  }
}
```

#### Direct Notification Creation

```typescript
@Injectable()
export class ProjectService {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  async notifyProjectUpdate(projectId: string, userId: string) {
    const notification = await this.notificationService.create({
      tenantId: 'current-tenant-id', // Usually from context
      userId,
      category: 'project',
      type: NotificationType.SUCCESS,
      title: 'Project Updated',
      message: 'Your project has been successfully updated.',
      data: { projectId },
      priority: NotificationPriority.LOW,
    });

    return notification;
  }
}
```

### Notification Categories

Use consistent categories across your application:

```typescript
// Common categories
const NOTIFICATION_CATEGORIES = {
  USER_ACTIVITY: 'user_activity',
  SYSTEM: 'system',
  INVOICE: 'invoice',
  PROJECT: 'project',
  SECURITY: 'security',
  PAYMENT: 'payment',
  TEAM: 'team',
} as const;
```

### Notification Types and Priorities

```typescript
// Available types
enum NotificationType {
  INFO = 'INFO',
  WARNING = 'WARNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

// Available priorities
enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}
```

## Creating Custom Templates

### Email Templates with React-Email

#### 1. Create Template Component

Create a new file in `src/notifications/templates/email/`:

```typescript
// src/notifications/templates/email/invoice-ready.template.tsx
import { Button, Section, Text, Hr } from '@react-email/components';
import * as React from 'react';
import { BaseEmailTemplate } from './base-email.template';

export interface InvoiceReadyEmailTemplateProps {
  customerName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  viewInvoiceUrl: string;
  companyName?: string;
  companyLogo?: string;
}

export const InvoiceReadyEmailTemplate = ({
  customerName,
  invoiceNumber,
  amount,
  dueDate,
  viewInvoiceUrl,
  companyName = 'Your Company',
  companyLogo,
}: InvoiceReadyEmailTemplateProps) => (
  <BaseEmailTemplate
    preview={`Invoice ${invoiceNumber} is ready for review`}
    title="Invoice Ready"
    companyName={companyName}
    companyLogo={companyLogo}
  >
    <Text className="text-black text-[14px] leading-[24px]">
      Hello {customerName},
    </Text>
    
    <Text className="text-black text-[14px] leading-[24px]">
      Your invoice <strong>#{invoiceNumber}</strong> has been generated and is ready for review.
    </Text>

    <Section className="bg-gray-50 rounded-lg p-4 my-6">
      <Text className="text-black text-[16px] font-semibold m-0">
        Invoice Details
      </Text>
      <Hr className="border-gray-200 my-2" />
      <Text className="text-black text-[14px] m-0">
        <strong>Invoice Number:</strong> {invoiceNumber}
      </Text>
      <Text className="text-black text-[14px] m-0">
        <strong>Amount:</strong> ${amount.toFixed(2)}
      </Text>
      <Text className="text-black text-[14px] m-0">
        <strong>Due Date:</strong> {new Date(dueDate).toLocaleDateString()}
      </Text>
    </Section>

    <Section className="text-center mt-[32px] mb-[32px]">
      <Button
        className="bg-blue-600 rounded text-white text-[12px] font-semibold no-underline text-center px-6 py-3"
        href={viewInvoiceUrl}
      >
        View Invoice
      </Button>
    </Section>

    <Text className="text-black text-[14px] leading-[24px]">
      Please review the invoice and process payment by the due date to avoid any late fees.
    </Text>
  </BaseEmailTemplate>
);

export default InvoiceReadyEmailTemplate;
```

#### 2. Register Template in Index

Add your template to `src/notifications/templates/email/index.ts`:

```typescript
// src/notifications/templates/email/index.ts
export { WelcomeEmailTemplate } from './welcome.template';
export { PasswordResetEmailTemplate } from './password-reset.template';
export { NotificationDigestEmailTemplate } from './notification-digest.template';
export { InvoiceReadyEmailTemplate } from './invoice-ready.template'; // Add this line

export type EmailTemplateType = 
  | 'welcome'
  | 'password-reset'
  | 'notification-digest'
  | 'invoice-ready'; // Add this line
```

#### 3. Update Template Renderer

Update the template renderer to handle your new template:

```typescript
// src/notifications/templates/email/template-renderer.ts
import { render } from '@react-email/render';
import { 
  WelcomeEmailTemplate,
  PasswordResetEmailTemplate,
  NotificationDigestEmailTemplate,
  InvoiceReadyEmailTemplate, // Add import
  EmailTemplateType 
} from './index';

export async function renderEmailTemplate(
  templateType: EmailTemplateType,
  variables: Record<string, any>,
): Promise<{ html: string; text: string }> {
  let component;

  switch (templateType) {
    case 'welcome':
      component = WelcomeEmailTemplate(variables);
      break;
    case 'password-reset':
      component = PasswordResetEmailTemplate(variables);
      break;
    case 'notification-digest':
      component = NotificationDigestEmailTemplate(variables);
      break;
    case 'invoice-ready': // Add case
      component = InvoiceReadyEmailTemplate(variables);
      break;
    default:
      throw new Error(`Unknown email template type: ${templateType}`);
  }

  const html = render(component);
  const text = render(component, { plainText: true });

  return { html, text };
}
```

#### 4. Use Template in Service

```typescript
@Injectable()
export class InvoiceService {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  async sendInvoiceNotification(invoice: Invoice, user: User) {
    await this.notificationService.sendToUser(user.id, {
      category: 'invoice',
      type: NotificationType.INFO,
      title: 'Invoice Ready',
      message: `Your invoice #${invoice.number} is ready for review.`,
      templateId: 'invoice-ready',
      templateVariables: {
        customerName: user.name,
        invoiceNumber: invoice.number,
        amount: invoice.amount,
        dueDate: invoice.dueDate.toISOString(),
        viewInvoiceUrl: `${process.env.FRONTEND_URL}/invoices/${invoice.id}`,
        companyName: 'Your Company',
      },
      data: {
        invoiceId: invoice.id,
        amount: invoice.amount,
      },
    });
  }
}
```

### Database Templates

You can also create templates stored in the database:

```typescript
@Injectable()
export class TemplateService {
  constructor(
    private readonly templateService: NotificationTemplateService,
  ) {}

  async createEmailTemplate() {
    const template = await this.templateService.createTemplate({
      tenantId: 'tenant-123', // null for global template
      category: 'payment',
      channel: NotificationChannelType.EMAIL,
      subject: 'Payment Received - Invoice {{invoiceNumber}}',
      templateBody: `
        <h2>Payment Confirmation</h2>
        <p>Hello {{customerName}},</p>
        <p>We have received your payment of ${{amount}} for invoice #{{invoiceNumber}}.</p>
        <p>Thank you for your business!</p>
      `,
      variables: {
        customerName: 'string',
        invoiceNumber: 'string',
        amount: 'number',
      },
      isActive: true,
    });

    return template;
  }
}
```

## Adding New Notification Channels

### 1. Create Channel Interface Implementation

```typescript
// src/notifications/channels/push-channel.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel } from '../interfaces/notification-channel.interface';
import { NotificationPayload } from '../interfaces/notification-payload.interface';
import { NotificationResult } from '../interfaces/notification-result.interface';
import { NotificationChannelType } from '../enums/notification-channel.enum';

@Injectable()
export class PushChannelService implements INotificationChannel {
  private readonly logger = new Logger(PushChannelService.name);

  constructor(
    // Inject your push notification service here
    private readonly pushService: PushNotificationService,
  ) {}

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      this.logger.log(`Sending push notification to user ${payload.userId}`);

      // Implement your push notification logic
      const result = await this.pushService.sendPushNotification({
        userId: payload.userId,
        title: payload.title,
        body: payload.message,
        data: payload.data,
      });

      return {
        success: true,
        channel: NotificationChannelType.PUSH,
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send push notification: ${error.message}`);
      return {
        success: false,
        channel: NotificationChannelType.PUSH,
        error: error.message,
      };
    }
  }

  validate(payload: NotificationPayload): boolean {
    return !!(payload.title && payload.message && payload.userId);
  }

  getChannelType(): NotificationChannelType {
    return NotificationChannelType.PUSH;
  }

  async isAvailable(): Promise<boolean> {
    // Check if push service is configured and available
    return this.pushService.isConfigured();
  }
}
```

### 2. Add Channel Type to Enum

```typescript
// src/notifications/enums/notification-channel.enum.ts
export enum NotificationChannelType {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH', // Add new channel type
}
```

### 3. Register Channel in Module

```typescript
// src/notifications/notifications.module.ts
import { PushChannelService } from './channels/push-channel.service';

@Module({
  providers: [
    // ... other providers
    PushChannelService,
  ],
})
export class NotificationsModule implements OnModuleInit {
  constructor(
    private readonly channelFactory: NotificationChannelFactory,
    private readonly pushChannel: PushChannelService,
    // ... other channels
  ) {}

  onModuleInit() {
    // Register all channels
    this.channelFactory.registerChannel(this.pushChannel);
    // ... register other channels
  }
}
```

### 4. Update Database Schema

Add the new channel type to your Prisma schema:

```prisma
enum NotificationChannelType {
  IN_APP
  EMAIL
  SMS
  PUSH
}
```

### 5. Update Preferences

Add the new channel to user preferences:

```typescript
// Update NotificationPreference model in Prisma schema
model NotificationPreference {
  // ... existing fields
  pushEnabled     Boolean  @default(false)
}
```

## Configuring Providers

### Email Providers

#### Resend Configuration

```bash
# .env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=Your Company
```

#### AWS SES Configuration

```bash
# .env
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=Your Company
```

#### SMTP Configuration (Fallback)

```bash
# .env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### SMS Providers

#### Twilio Configuration

```bash
# .env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
```

#### Termii Configuration

```bash
# .env
SMS_PROVIDER=termii
TERMII_API_KEY=your_api_key
TERMII_SENDER_ID=YourApp
```

### Tenant-Specific Configuration

You can override global provider settings per tenant:

```typescript
@Injectable()
export class TenantConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async setTenantEmailConfig(tenantId: string, config: TenantEmailConfig) {
    return this.prisma.tenantNotificationConfig.upsert({
      where: { tenantId },
      update: {
        emailProvider: config.provider,
        emailApiKey: config.apiKey,
        emailFromAddress: config.fromAddress,
        emailFromName: config.fromName,
      },
      create: {
        tenantId,
        emailProvider: config.provider,
        emailApiKey: config.apiKey,
        emailFromAddress: config.fromAddress,
        emailFromName: config.fromName,
      },
    });
  }
}
```

## Event-Driven Notifications

### Creating Event Listeners

```typescript
// src/notifications/listeners/invoice-event.listener.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../services/notification.service';
import { NotificationType } from '../enums';

@Injectable()
export class InvoiceEventListener {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent('invoice.created')
  async handleInvoiceCreated(event: InvoiceCreatedEvent) {
    await this.notificationService.sendToUser(event.userId, {
      category: 'invoice',
      type: NotificationType.INFO,
      title: 'New Invoice Generated',
      message: `Invoice #${event.invoiceNumber} has been created.`,
      data: {
        invoiceId: event.invoiceId,
        amount: event.amount,
      },
      templateId: 'invoice-created',
      templateVariables: {
        invoiceNumber: event.invoiceNumber,
        amount: event.amount,
        customerName: event.customerName,
      },
    });
  }

  @OnEvent('invoice.paid')
  async handleInvoicePaid(event: InvoicePaidEvent) {
    await this.notificationService.sendToUser(event.userId, {
      category: 'invoice',
      type: NotificationType.SUCCESS,
      title: 'Payment Received',
      message: `Payment for invoice #${event.invoiceNumber} has been received.`,
      data: {
        invoiceId: event.invoiceId,
        paymentAmount: event.paymentAmount,
      },
    });
  }
}
```

### Emitting Events

```typescript
@Injectable()
export class InvoiceService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createInvoice(data: CreateInvoiceDto) {
    const invoice = await this.createInvoiceRecord(data);

    // Emit event for notification system
    this.eventEmitter.emit('invoice.created', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      userId: invoice.userId,
      amount: invoice.amount,
      customerName: invoice.customerName,
    });

    return invoice;
  }
}
```

## Testing

### Unit Testing Notifications

```typescript
// src/notifications/services/notification.service.spec.ts
describe('NotificationService', () => {
  let service: NotificationService;
  let mockChannelFactory: jest.Mocked<NotificationChannelFactory>;
  let mockPreferenceService: jest.Mocked<NotificationPreferenceService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: NotificationChannelFactory,
          useValue: {
            getChannel: jest.fn(),
          },
        },
        {
          provide: NotificationPreferenceService,
          useValue: {
            getEnabledChannels: jest.fn(),
          },
        },
        // ... other mocks
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    mockChannelFactory = module.get(NotificationChannelFactory);
    mockPreferenceService = module.get(NotificationPreferenceService);
  });

  it('should send notification to user', async () => {
    // Arrange
    const userId = 'user123';
    const payload = {
      category: 'test',
      type: NotificationType.INFO,
      title: 'Test',
      message: 'Test message',
    };

    mockPreferenceService.getEnabledChannels.mockResolvedValue([
      NotificationChannelType.IN_APP,
    ]);

    const mockChannel = {
      send: jest.fn().mockResolvedValue({ success: true }),
      getChannelType: () => NotificationChannelType.IN_APP,
    };
    mockChannelFactory.getChannel.mockReturnValue(mockChannel);

    // Act
    const result = await service.sendToUser(userId, payload);

    // Assert
    expect(result).toBeDefined();
    expect(mockChannel.send).toHaveBeenCalled();
  });
});
```

### Integration Testing

```typescript
// test/notification-flow.integration-spec.ts
describe('Notification Flow Integration', () => {
  let app: INestApplication;
  let notificationService: NotificationService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    notificationService = moduleFixture.get<NotificationService>(NotificationService);
    await app.init();
  });

  it('should create and deliver notification', async () => {
    // Test end-to-end notification flow
    const notification = await notificationService.sendToUser('user123', {
      category: 'test',
      type: NotificationType.INFO,
      title: 'Integration Test',
      message: 'This is a test notification',
    });

    expect(notification).toBeDefined();
    expect(notification.title).toBe('Integration Test');
  });
});
```

## Best Practices

### 1. Notification Categories

- Use consistent, descriptive category names
- Group related notifications under the same category
- Consider user preferences when choosing categories

```typescript
const CATEGORIES = {
  BILLING: 'billing',
  SECURITY: 'security',
  SYSTEM: 'system',
  USER_ACTIVITY: 'user_activity',
} as const;
```

### 2. Message Content

- Keep titles concise and descriptive
- Include actionable information in messages
- Use consistent tone and language
- Avoid technical jargon for user-facing notifications

### 3. Data Payload

- Include relevant IDs for deep linking
- Keep data payload minimal but useful
- Use consistent data structure across similar notifications

```typescript
// Good data payload structure
const notificationData = {
  entityId: 'invoice_123',
  entityType: 'invoice',
  actionUrl: '/invoices/123',
  metadata: {
    amount: 100.50,
    dueDate: '2024-01-30',
  },
};
```

### 4. Error Handling

- Always handle notification failures gracefully
- Log errors for debugging
- Don't let notification failures break main business logic

```typescript
try {
  await this.notificationService.sendToUser(userId, payload);
} catch (error) {
  this.logger.error(`Failed to send notification: ${error.message}`);
  // Continue with main business logic
}
```

### 5. Performance

- Use appropriate priorities for notifications
- Consider batching notifications for bulk operations
- Use queues for external notifications (email/SMS)
- Cache user preferences when possible

### 6. Privacy and Security

- Respect user notification preferences
- Don't include sensitive data in notification messages
- Use templates for consistent formatting
- Implement proper access controls

### 7. Testing

- Mock external services in unit tests
- Test notification preferences logic
- Verify template rendering
- Test error scenarios

This developer guide provides comprehensive information for working with the notification system. For API documentation, refer to the separate API documentation file.