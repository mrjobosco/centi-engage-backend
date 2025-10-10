# Notification System Design Document

## Overview

This document outlines the technical design for a comprehensive, multi-channel notification system for the NestJS multi-tenant B2B starter template. The system supports in-app, email, and SMS notifications with a factory pattern architecture for extensibility.

### Key Design Principles

- **Tenant Isolation**: Leverage existing Prisma middleware for automatic tenant scoping
- **Factory Pattern**: Use factory pattern for channel handler creation and management
- **Async Processing**: Queue-based processing for email/SMS to prevent blocking
- **Extensibility**: Easy addition of new channels and providers
- **Type Safety**: Full TypeScript support with strict typing
- **Testability**: Mockable providers and clear separation of concerns

## Architecture

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│              Application Layer                           │
│  (Controllers, Services, Event Emitters)                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│           NotificationService                            │
│  - Create notifications                                  │
│  - Apply user preferences                                │
│  - Coordinate channel delivery                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│        NotificationChannelFactory                        │
│  - Register channel handlers                             │
│  - Create handler instances                              │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
    ┌──────┐ ┌──────┐ ┌──────┐
    │In-App│ │Email │ │ SMS  │
    │Channel│ │Channel│ │Channel│
    └───┬──┘ └───┬──┘ └───┬──┘
        │        │        │
        ▼        ▼        ▼
    ┌──────┐ ┌──────┐ ┌──────┐
    │Prisma│ │Queue │ │Queue │
    └──────┘ └──────┘ └──────┘
```



## Data Models

### Prisma Schema Extensions

The following models will be added to the existing Prisma schema:

```prisma
model Notification {
  id           String    @id @default(cuid())
  tenantId     String
  userId       String
  type         NotificationType
  category     String
  title        String
  message      String    @db.Text
  data         Json?
  channelsSent String[]  // ['in-app', 'email', 'sms']
  readAt       DateTime?
  createdAt    DateTime  @default(now())
  expiresAt    DateTime?

  tenant        Tenant                 @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user          User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  deliveryLogs  NotificationDeliveryLog[]

  @@index([tenantId])
  @@index([userId])
  @@index([category])
  @@index([createdAt])
  @@map("notifications")
}

model NotificationPreference {
  id             String   @id @default(cuid())
  tenantId       String
  userId         String
  category       String
  inAppEnabled   Boolean  @default(true)
  emailEnabled   Boolean  @default(true)
  smsEnabled     Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([tenantId, userId, category])
  @@index([tenantId])
  @@index([userId])
  @@map("notification_preferences")
}


model NotificationDeliveryLog {
  id                 String   @id @default(cuid())
  notificationId     String
  channel            NotificationChannelType
  status             DeliveryStatus
  provider           String?
  providerMessageId  String?
  errorMessage       String?  @db.Text
  sentAt             DateTime?
  createdAt          DateTime @default(now())

  notification Notification @relation(fields: [notificationId], references: [id], onDelete: Cascade)

  @@index([notificationId])
  @@index([status])
  @@map("notification_delivery_logs")
}

model NotificationTemplate {
  id           String   @id @default(cuid())
  tenantId     String?  // null for global templates
  category     String
  channel      NotificationChannelType
  subject      String?
  templateBody String   @db.Text
  variables    Json     // expected variables
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([category])
  @@index([channel])
  @@map("notification_templates")
}

model TenantNotificationConfig {
  id                String   @id @default(cuid())
  tenantId          String   @unique
  emailProvider     String?  // 'resend', 'ses', 'onesignal', 'smtp'
  emailApiKey       String?
  emailFromAddress  String?
  emailFromName     String?
  smsProvider       String?  // 'twilio', 'termii'
  smsApiKey         String?
  smsApiSecret      String?
  smsFromNumber     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("tenant_notification_configs")
}

enum NotificationType {
  INFO
  WARNING
  SUCCESS
  ERROR
}

enum NotificationChannelType {
  IN_APP
  EMAIL
  SMS
}

enum DeliveryStatus {
  PENDING
  SENT
  FAILED
  BOUNCED
}

enum NotificationPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```



## Core Interfaces and Types

### Notification Channel Interface

```typescript
export interface INotificationChannel {
  /**
   * Send notification through this channel
   */
  send(payload: NotificationPayload): Promise<NotificationResult>;

  /**
   * Validate notification payload for this channel
   */
  validate(payload: NotificationPayload): boolean;

  /**
   * Get the channel type identifier
   */
  getChannelType(): NotificationChannelType;

  /**
   * Check if channel is available/configured
   */
  isAvailable(): Promise<boolean>;
}
```

### Notification Payload

```typescript
export interface NotificationPayload {
  tenantId: string;
  userId: string;
  category: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority?: NotificationPriority;
  expiresAt?: Date;
  templateId?: string;
  templateVariables?: Record<string, any>;
}
```

### Notification Result

```typescript
export interface NotificationResult {
  success: boolean;
  channel: NotificationChannelType;
  messageId?: string;
  error?: string;
  deliveryLogId?: string;
}
```



### Email Provider Interface

```typescript
export interface IEmailProvider {
  send(options: EmailOptions): Promise<EmailResult>;
  getProviderName(): string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  fromName?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

### SMS Provider Interface

```typescript
export interface ISmsProvider {
  send(options: SmsOptions): Promise<SmsResult>;
  getProviderName(): string;
}

export interface SmsOptions {
  to: string;
  message: string;
  from?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```



## Components and Interfaces

### 1. NotificationService

Main orchestration service for notification creation and delivery.

**Responsibilities:**
- Create notifications with tenant context
- Load and apply user preferences
- Determine which channels to use
- Coordinate with factory for channel delivery
- Handle synchronous (in-app) and asynchronous (email/SMS) delivery

**Key Methods:**
```typescript
class NotificationService {
  async create(payload: NotificationPayload): Promise<Notification>;
  async sendToUser(userId: string, payload: Partial<NotificationPayload>): Promise<Notification>;
  async sendToTenant(payload: Partial<NotificationPayload>): Promise<Notification[]>;
  async markAsRead(notificationId: string, userId: string): Promise<void>;
  async markAllAsRead(userId: string): Promise<void>;
  async getUserNotifications(userId: string, filters: NotificationFilters): Promise<PaginatedResult<Notification>>;
}
```

### 2. NotificationChannelFactory

Factory for creating and managing channel handlers.

**Responsibilities:**
- Register channel handlers
- Create channel instances with proper configuration
- Manage channel lifecycle

**Key Methods:**
```typescript
class NotificationChannelFactory {
  registerChannel(channel: INotificationChannel): void;
  getChannel(type: NotificationChannelType): INotificationChannel;
  getAvailableChannels(): NotificationChannelType[];
}
```



### 3. Channel Handlers

#### InAppChannelService

**Responsibilities:**
- Create in-app notification records in database
- Emit WebSocket events for real-time delivery
- Handle notification expiration

**Implementation:**
```typescript
class InAppChannelService implements INotificationChannel {
  constructor(
    private prisma: PrismaService,
    private websocketGateway: NotificationGateway,
  ) {}

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    // Create notification in database
    // Emit WebSocket event
    // Return result
  }
}
```

#### EmailChannelService

**Responsibilities:**
- Queue email notifications for async processing
- Select appropriate email provider (tenant-specific or global)
- Render React-email templates
- Handle delivery logging

**Implementation:**
```typescript
class EmailChannelService implements INotificationChannel {
  constructor(
    private queue: Queue,
    private emailProviderFactory: EmailProviderFactory,
    private templateService: NotificationTemplateService,
  ) {}

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    // Queue email job with priority
    // Return pending result
  }
}
```



#### SmsChannelService

**Responsibilities:**
- Queue SMS notifications for async processing
- Select appropriate SMS provider (tenant-specific or global)
- Handle delivery logging

**Implementation:**
```typescript
class SmsChannelService implements INotificationChannel {
  constructor(
    private queue: Queue,
    private smsProviderFactory: SmsProviderFactory,
  ) {}

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    // Queue SMS job with priority
    // Return pending result
  }
}
```

### 4. Provider Adapters

#### Email Providers

**ResendProvider**
```typescript
class ResendProvider implements IEmailProvider {
  constructor(private apiKey: string) {}
  
  async send(options: EmailOptions): Promise<EmailResult> {
    // Use Resend SDK
  }
}
```

**AwsSesProvider**
```typescript
class AwsSesProvider implements IEmailProvider {
  constructor(private config: AwsSesConfig) {}
  
  async send(options: EmailOptions): Promise<EmailResult> {
    // Use AWS SDK v3
  }
}
```

**OneSignalProvider**
```typescript
class OneSignalProvider implements IEmailProvider {
  constructor(private apiKey: string) {}
  
  async send(options: EmailOptions): Promise<EmailResult> {
    // Use OneSignal API
  }
}
```

**SmtpProvider** (Fallback)
```typescript
class SmtpProvider implements IEmailProvider {
  constructor(private config: SmtpConfig) {}
  
  async send(options: EmailOptions): Promise<EmailResult> {
    // Use nodemailer
  }
}
```



#### SMS Providers

**TwilioProvider**
```typescript
class TwilioProvider implements ISmsProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
  ) {}
  
  async send(options: SmsOptions): Promise<SmsResult> {
    // Use Twilio SDK
  }
}
```

**TermiiProvider**
```typescript
class TermiiProvider implements ISmsProvider {
  constructor(private apiKey: string) {}
  
  async send(options: SmsOptions): Promise<SmsResult> {
    // Use Termii API
  }
}
```

### 5. NotificationPreferenceService

**Responsibilities:**
- Manage user notification preferences
- Apply preference hierarchy (tenant defaults → user preferences)
- Provide default preferences for new users

**Key Methods:**
```typescript
class NotificationPreferenceService {
  async getUserPreferences(userId: string): Promise<NotificationPreference[]>;
  async updatePreference(userId: string, category: string, preferences: UpdatePreferenceDto): Promise<NotificationPreference>;
  async getEnabledChannels(userId: string, category: string): Promise<NotificationChannelType[]>;
  async createDefaultPreferences(userId: string): Promise<void>;
}
```



### 6. NotificationTemplateService

**Responsibilities:**
- Manage notification templates
- Render React-email templates with Tailwind
- Support variable substitution
- Handle tenant-specific template overrides

**Key Methods:**
```typescript
class NotificationTemplateService {
  async getTemplate(category: string, channel: NotificationChannelType, tenantId?: string): Promise<NotificationTemplate | null>;
  async renderEmailTemplate(templateId: string, variables: Record<string, any>): Promise<string>;
  async createTemplate(data: CreateTemplateDto): Promise<NotificationTemplate>;
  async updateTemplate(id: string, data: UpdateTemplateDto): Promise<NotificationTemplate>;
}
```

**React-email Integration:**
- Templates stored as React components in `src/notifications/templates/email/`
- Use `@react-email/components` for email-safe components
- Tailwind configured via `@react-email/tailwind`
- Compile to HTML using `render()` function

### 7. Queue Processors

#### EmailQueueProcessor

**Responsibilities:**
- Process queued email jobs
- Select and use appropriate email provider
- Render templates
- Log delivery status
- Handle retries with exponential backoff

**Implementation:**
```typescript
@Processor('email-notifications')
class EmailQueueProcessor {
  @Process()
  async processEmail(job: Job<EmailJobData>): Promise<void> {
    // Get tenant config
    // Select provider
    // Render template
    // Send email
    // Log result
  }
}
```



#### SmsQueueProcessor

**Responsibilities:**
- Process queued SMS jobs
- Select and use appropriate SMS provider
- Log delivery status
- Handle retries with exponential backoff

**Implementation:**
```typescript
@Processor('sms-notifications')
class SmsQueueProcessor {
  @Process()
  async processSms(job: Job<SmsJobData>): Promise<void> {
    // Get tenant config
    // Select provider
    // Send SMS
    // Log result
  }
}
```

### 8. WebSocket Gateway

**Responsibilities:**
- Manage WebSocket connections
- Subscribe users to tenant-specific rooms
- Push real-time notifications
- Emit notification count updates

**Implementation:**
```typescript
@WebSocketGateway()
class NotificationGateway {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket): void {
    // Authenticate user
    // Subscribe to tenant room
  }

  emitNotification(userId: string, notification: Notification): void {
    // Emit to user's socket
  }

  emitUnreadCount(userId: string, count: number): void {
    // Emit count update
  }
}
```



## Module Structure

### Directory Layout

```
src/notifications/
├── notifications.module.ts
├── services/
│   ├── notification.service.ts
│   ├── notification.service.spec.ts
│   ├── notification-preference.service.ts
│   ├── notification-preference.service.spec.ts
│   ├── notification-template.service.ts
│   └── notification-template.service.spec.ts
├── factories/
│   ├── notification-channel.factory.ts
│   ├── notification-channel.factory.spec.ts
│   ├── email-provider.factory.ts
│   ├── email-provider.factory.spec.ts
│   ├── sms-provider.factory.ts
│   └── sms-provider.factory.spec.ts
├── channels/
│   ├── base-channel.abstract.ts
│   ├── in-app-channel.service.ts
│   ├── in-app-channel.service.spec.ts
│   ├── email-channel.service.ts
│   ├── email-channel.service.spec.ts
│   ├── sms-channel.service.ts
│   └── sms-channel.service.spec.ts
├── providers/
│   ├── email/
│   │   ├── resend.provider.ts
│   │   ├── resend.provider.spec.ts
│   │   ├── aws-ses.provider.ts
│   │   ├── aws-ses.provider.spec.ts
│   │   ├── onesignal.provider.ts
│   │   ├── onesignal.provider.spec.ts
│   │   ├── smtp.provider.ts
│   │   └── smtp.provider.spec.ts
│   └── sms/
│       ├── twilio.provider.ts
│       ├── twilio.provider.spec.ts
│       ├── termii.provider.ts
│       └── termii.provider.spec.ts
├── processors/
│   ├── email-queue.processor.ts
│   ├── email-queue.processor.spec.ts
│   ├── sms-queue.processor.ts
│   └── sms-queue.processor.spec.ts
├── gateways/
│   ├── notification.gateway.ts
│   └── notification.gateway.spec.ts
├── controllers/
│   ├── notifications.controller.ts
│   ├── notifications.controller.spec.ts
│   ├── notification-preferences.controller.ts
│   └── notification-preferences.controller.spec.ts
├── dto/
│   ├── create-notification.dto.ts
│   ├── update-preference.dto.ts
│   ├── notification-filter.dto.ts
│   └── create-template.dto.ts
├── interfaces/
│   ├── notification-channel.interface.ts
│   ├── email-provider.interface.ts
│   ├── sms-provider.interface.ts
│   └── notification-payload.interface.ts
├── enums/
│   ├── notification-type.enum.ts
│   ├── notification-channel.enum.ts
│   ├── delivery-status.enum.ts
│   └── notification-priority.enum.ts
├── templates/
│   └── email/
│       ├── welcome.tsx
│       ├── password-reset.tsx
│       └── notification-digest.tsx
└── config/
    └── notification.config.ts
```



## Notification Processing Flow

### 1. Synchronous In-App Notification Flow

```
Application Event
    ↓
NotificationService.create()
    ↓
Load User Preferences
    ↓
Determine Enabled Channels (includes in-app)
    ↓
NotificationChannelFactory.getChannel('in-app')
    ↓
InAppChannelService.send()
    ↓
Create Notification in Database (Prisma)
    ↓
NotificationGateway.emitNotification()
    ↓
WebSocket Push to Connected Client
    ↓
Return Notification Object
```

### 2. Asynchronous Email Notification Flow

```
Application Event
    ↓
NotificationService.create()
    ↓
Load User Preferences
    ↓
Determine Enabled Channels (includes email)
    ↓
NotificationChannelFactory.getChannel('email')
    ↓
EmailChannelService.send()
    ↓
Add Job to Email Queue (BullMQ)
    ↓
Return Pending Result
    ↓
[Async Processing]
    ↓
EmailQueueProcessor.processEmail()
    ↓
Load Tenant Config (API keys)
    ↓
EmailProviderFactory.getProvider()
    ↓
NotificationTemplateService.renderEmailTemplate()
    ↓
Provider.send() (Resend/SES/OneSignal/SMTP)
    ↓
Create NotificationDeliveryLog
    ↓
Update Job Status
```



### 3. Asynchronous SMS Notification Flow

```
Application Event
    ↓
NotificationService.create()
    ↓
Load User Preferences
    ↓
Determine Enabled Channels (includes SMS)
    ↓
NotificationChannelFactory.getChannel('sms')
    ↓
SmsChannelService.send()
    ↓
Add Job to SMS Queue (BullMQ)
    ↓
Return Pending Result
    ↓
[Async Processing]
    ↓
SmsQueueProcessor.processSms()
    ↓
Load Tenant Config (API keys)
    ↓
SmsProviderFactory.getProvider()
    ↓
Provider.send() (Twilio/Termii)
    ↓
Create NotificationDeliveryLog
    ↓
Update Job Status
```

## Configuration

### Environment Variables

```bash
# Redis Configuration (for BullMQ)
REDIS_URL=redis://localhost:6379

# Global Email Configuration
EMAIL_PROVIDER=resend # resend, ses, onesignal, smtp
EMAIL_API_KEY=your_api_key
EMAIL_FROM_ADDRESS=noreply@company.com
EMAIL_FROM_NAME=Company Name

# AWS SES Configuration (if using SES)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# SMTP Configuration (fallback)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_password

# Global SMS Configuration
SMS_PROVIDER=twilio # twilio, termii
SMS_API_KEY=your_api_key
SMS_API_SECRET=your_api_secret
SMS_FROM_NUMBER=+1234567890

# Termii Configuration (if using Termii)
TERMII_SENDER_ID=YourApp

# Queue Configuration
NOTIFICATION_QUEUE_CONCURRENCY=5
NOTIFICATION_MAX_RETRIES=3
NOTIFICATION_RETRY_DELAY=5000

# In-App Configuration
IN_APP_NOTIFICATION_EXPIRY_DAYS=30
MAX_UNREAD_NOTIFICATIONS=100

# WebSocket Configuration
WEBSOCKET_CORS_ORIGIN=http://localhost:3000
```



### Configuration Module

```typescript
export interface NotificationConfig {
  redis: {
    url: string;
  };
  email: {
    provider: 'resend' | 'ses' | 'onesignal' | 'smtp';
    apiKey?: string;
    fromAddress: string;
    fromName: string;
    smtp?: {
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
    };
    aws?: {
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
  sms: {
    provider: 'twilio' | 'termii';
    apiKey: string;
    apiSecret?: string;
    fromNumber?: string;
    senderId?: string;
  };
  queue: {
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
  };
  inApp: {
    expiryDays: number;
    maxUnread: number;
  };
  websocket: {
    corsOrigin: string;
  };
}
```

## Error Handling

### Error Types

```typescript
export class NotificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public channel?: NotificationChannelType,
  ) {
    super(message);
  }
}

export class ProviderError extends NotificationError {
  constructor(
    message: string,
    public provider: string,
    public originalError?: any,
  ) {
    super(message, 'PROVIDER_ERROR');
  }
}

export class TemplateError extends NotificationError {
  constructor(message: string) {
    super(message, 'TEMPLATE_ERROR');
  }
}

export class PreferenceError extends NotificationError {
  constructor(message: string) {
    super(message, 'PREFERENCE_ERROR');
  }
}
```



### Error Handling Strategy

1. **Channel Failures**: If one channel fails, others should still succeed
2. **Provider Failures**: Automatic retry with exponential backoff
3. **Template Errors**: Log error and use fallback plain text
4. **Queue Failures**: Move to dead letter queue after max retries
5. **Validation Errors**: Return clear error messages to caller

## Testing Strategy

### Unit Tests

- Factory pattern creation and registration
- Each channel handler independently
- Provider adapters with mocked APIs
- Preference resolution logic
- Template rendering with React-email

### Integration Tests

- End-to-end notification flow
- Multi-tenant isolation verification
- Queue processing with Redis
- Database operations with Prisma
- WebSocket event emission

### Mock Providers

```typescript
export class MockEmailProvider implements IEmailProvider {
  async send(options: EmailOptions): Promise<EmailResult> {
    return { success: true, messageId: 'mock-id' };
  }
  getProviderName(): string {
    return 'mock';
  }
}

export class MockSmsProvider implements ISmsProvider {
  async send(options: SmsOptions): Promise<SmsResult> {
    return { success: true, messageId: 'mock-id' };
  }
  getProviderName(): string {
    return 'mock';
  }
}
```

## Security Considerations

### Access Control

- Users can only view their own notifications
- Tenant isolation enforced via Prisma middleware
- Admin role can send notifications to all tenant users
- API keys encrypted at rest in tenant config

### Rate Limiting

- Per-user rate limits on notification creation
- Per-tenant rate limits on bulk notifications
- Provider-level throttling to avoid API limits

### Data Privacy

- PII handling in notification content
- GDPR compliance (right to delete)
- Notification retention policies
- Audit trail for sensitive notifications



## API Endpoints

### Notifications Controller

```typescript
// GET /api/notifications
// Get paginated list of user's notifications
// Query params: page, limit, type, category, unread
// Response: PaginatedResult<Notification>

// GET /api/notifications/:id
// Get single notification details
// Response: Notification

// PATCH /api/notifications/:id/read
// Mark notification as read
// Response: Notification

// PATCH /api/notifications/read-all
// Mark all user notifications as read
// Response: { count: number }

// DELETE /api/notifications/:id
// Soft delete notification (user dismisses)
// Response: { success: boolean }
```

### Notification Preferences Controller

```typescript
// GET /api/notification-preferences
// Get all user notification preferences
// Response: NotificationPreference[]

// PUT /api/notification-preferences/:category
// Update preferences for specific category
// Body: { inAppEnabled, emailEnabled, smsEnabled }
// Response: NotificationPreference

// GET /api/notification-preferences/categories
// Get list of all available notification categories
// Response: string[]
```

## Dependencies

### Required NPM Packages

```json
{
  "@nestjs/websockets": "^11.0.0",
  "@nestjs/platform-socket.io": "^11.0.0",
  "@nestjs/bullmq": "^10.0.0",
  "bullmq": "^5.0.0",
  "ioredis": "^5.3.0",
  "socket.io": "^4.6.0",
  "@react-email/components": "^0.0.14",
  "@react-email/render": "^0.0.12",
  "@react-email/tailwind": "^0.0.14",
  "react": "^18.2.0",
  "resend": "^3.0.0",
  "@aws-sdk/client-ses": "^3.500.0",
  "onesignal-node": "^3.4.0",
  "nodemailer": "^6.9.0",
  "twilio": "^4.20.0",
  "axios": "^1.6.0"
}
```

## Monitoring and Observability

### Metrics to Track

- Notification delivery rate by channel
- Failed notification count
- Average processing time
- Queue depth and lag
- Bounce/undeliverable rates
- Provider API response times

### Logging Strategy

- Structured logging for all notification events
- Include tenant_id, user_id, category, channel in logs
- Log provider responses
- Track delivery status changes

### Alerting

- Alert on high failure rates (>5%)
- Alert on queue backup (>1000 jobs)
- Alert on provider API errors
- Alert on WebSocket connection issues

## Performance Considerations

- Use database indexes on tenantId, userId, category, createdAt
- Implement pagination for notification lists
- Cache user preferences in Redis
- Batch WebSocket emissions for multiple users
- Use connection pooling for external APIs
- Implement circuit breaker for provider failures

## Scalability

- Horizontal scaling of queue processors
- Separate queues for different priority levels
- Tenant-specific queues for large tenants (optional)
- Database read replicas for notification queries
- CDN for email template assets
