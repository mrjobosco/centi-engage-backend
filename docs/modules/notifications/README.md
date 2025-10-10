# Notification System

## Overview

The notification system is a comprehensive, multi-tenant notification delivery platform built on NestJS. It provides reliable, scalable notification delivery across multiple channels (in-app, email, SMS) with advanced features including user preferences, privacy controls, rate limiting, and detailed monitoring.

## Key Features

- **Multi-Channel Delivery**: Support for in-app, email, and SMS notifications
- **Multi-Tenant Architecture**: Complete tenant isolation with per-tenant configuration
- **Queue-Based Processing**: Asynchronous delivery using BullMQ for reliability
- **User Preferences**: Granular control over notification channels and categories
- **Privacy Controls**: GDPR-compliant data handling and user consent management
- **Rate Limiting**: Configurable rate limits per tenant and user
- **Template System**: Rich email templates with variable substitution
- **Real-Time Updates**: WebSocket-based real-time notifications
- **Comprehensive Monitoring**: Detailed metrics, logging, and alerting
- **Provider Flexibility**: Support for multiple email and SMS providers

## Architecture Overview

The notification system follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                │
├─────────────────────────────────────────────────────────────┤
│  Controllers  │  Guards  │  Interceptors  │  WebSocket      │
├─────────────────────────────────────────────────────────────┤
│                  Service Layer                              │
├─────────────────────────────────────────────────────────────┤
│ Notification │ Preference │ Template │ Privacy │ Queue      │
│   Service    │  Service   │ Service  │ Service │ Service    │
├─────────────────────────────────────────────────────────────┤
│                 Channel Layer                               │
├─────────────────────────────────────────────────────────────┤
│  In-App      │   Email    │   SMS    │  Channel Factory    │
│  Channel     │  Channel   │ Channel  │                     │
├─────────────────────────────────────────────────────────────┤
│                Provider Layer                               │
├─────────────────────────────────────────────────────────────┤
│ AWS SES │ Resend │ SMTP │ Twilio │ Termii │ OneSignal      │
├─────────────────────────────────────────────────────────────┤
│              Infrastructure Layer                           │
├─────────────────────────────────────────────────────────────┤
│   Database   │   Redis    │   Queue    │   WebSocket       │
│   (Prisma)   │  (Cache)   │ (BullMQ)   │  (Socket.IO)      │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Notification Service
The central orchestrator that handles notification creation and delivery coordination.

**Key Responsibilities:**
- Validate and process notification requests
- Load user preferences to determine enabled channels
- Coordinate delivery across multiple channels
- Handle partial failures gracefully
- Record metrics and audit logs

### 2. Channel Services
Individual channel handlers that implement the `INotificationChannel` interface.

**Available Channels:**
- **In-App Channel**: Real-time notifications via WebSocket
- **Email Channel**: Queue-based email delivery
- **SMS Channel**: Queue-based SMS delivery

### 3. Queue System
Asynchronous processing system using BullMQ for reliable delivery.

**Queue Types:**
- **Email Queue**: Handles email notification processing
- **SMS Queue**: Handles SMS notification processing

### 4. Provider System
Pluggable provider architecture supporting multiple external services.

**Email Providers:**
- AWS SES
- Resend
- SMTP
- OneSignal

**SMS Providers:**
- Twilio
- Termii

## Quick Start

### Basic Notification Sending

```typescript
import { NotificationService } from '@/notifications';
import { NotificationType, NotificationPriority } from '@/notifications/enums';

// Inject the service
constructor(private notificationService: NotificationService) {}

// Send a simple notification
await this.notificationService.sendToUser('user-id', {
  type: NotificationType.INFO,
  category: 'system',
  title: 'Welcome!',
  message: 'Welcome to our platform',
  priority: NotificationPriority.MEDIUM
});
```

### Using Templates

```typescript
// Send notification with template
await this.notificationService.sendToUser('user-id', {
  type: NotificationType.INFO,
  category: 'welcome',
  title: 'Welcome!',
  message: 'Welcome to our platform',
  templateId: 'welcome-email',
  templateVariables: {
    userName: 'John Doe',
    companyName: 'Acme Corp'
  }
});
```

### Tenant-Wide Notifications

```typescript
// Send to all users in current tenant
await this.notificationService.sendToTenant({
  type: NotificationType.INFO,
  category: 'announcement',
  title: 'System Maintenance',
  message: 'Scheduled maintenance tonight at 2 AM'
});
```

## Module Structure

```
src/notifications/
├── channels/              # Channel implementations
│   ├── base-channel.abstract.ts
│   ├── email-channel.service.ts
│   ├── in-app-channel.service.ts
│   └── sms-channel.service.ts
├── config/               # Configuration
├── constants/            # Constants and enums
├── controllers/          # REST API controllers
├── decorators/           # Custom decorators
├── dto/                  # Data transfer objects
├── enums/               # Enumerations
├── events/              # Event definitions
├── factories/           # Provider factories
├── gateways/            # WebSocket gateways
├── guards/              # Security guards
├── interfaces/          # TypeScript interfaces
├── listeners/           # Event listeners
├── modules/             # Sub-modules
├── processors/          # Queue processors
├── providers/           # External service providers
├── services/            # Business logic services
└── templates/           # Notification templates
```

## Dependencies

The notification system integrates with several other modules:

- **Database Module**: Data persistence via Prisma
- **Tenant Module**: Multi-tenant context and isolation
- **Auth Module**: User authentication and authorization
- **Config Module**: Environment configuration

## External Dependencies

- **BullMQ**: Queue processing
- **Redis**: Caching and queue storage
- **Socket.IO**: Real-time WebSocket communication
- **Various Providers**: AWS SES, Twilio, etc.

## Configuration

The system supports both global and tenant-specific configuration:

```typescript
// Global configuration via environment variables
EMAIL_PROVIDER=aws-ses
AWS_REGION=us-east-1
SMS_PROVIDER=twilio

// Tenant-specific configuration via database
{
  tenantId: "tenant-123",
  emailProvider: "resend",
  emailApiKey: "re_...",
  emailFromAddress: "noreply@tenant.com",
  smsProvider: "termii",
  smsApiKey: "TL..."
}
```

## Security Features

- **Tenant Isolation**: Complete data separation between tenants
- **Rate Limiting**: Configurable limits to prevent abuse
- **Permission-Based Access**: Role-based access control
- **Data Privacy**: GDPR-compliant data handling
- **Audit Logging**: Comprehensive activity tracking

## Monitoring and Observability

- **Metrics Collection**: Delivery rates, failure rates, processing times
- **Structured Logging**: Detailed logs for debugging and auditing
- **Health Checks**: System health monitoring
- **Alerting**: Automated alerts for failures and anomalies

## Next Steps

- [Architecture Details](./architecture.md) - Deep dive into system architecture
- [API Reference](./api-reference.md) - Complete API documentation
- [Configuration Guide](./configuration.md) - Setup and configuration
- [Examples](./examples.md) - Usage examples and patterns
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions