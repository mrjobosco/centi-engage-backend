# Event-Driven Notification System

This directory contains the event-driven notification system that automatically creates notifications when domain events occur.

## How it works

1. **Event Types**: Defined in `event-types.ts` - these are TypeScript interfaces that describe the structure of events
2. **Event Classes**: Defined in `notification-events.ts` - these are classes that wrap the event data
3. **Event Listener**: The `NotificationEventListener` class listens for events and creates appropriate notifications

## Usage Example

To trigger a notification when a user is created, emit an event from your service:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NOTIFICATION_EVENTS, UserCreatedEvent } from '../notifications/events';

@Injectable()
export class UserService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    // Create the user
    const user = await this.prisma.user.create({ data: userData });

    // Emit the event
    const event: UserCreatedEvent = {
      tenantId: user.tenantId,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      timestamp: new Date(),
    };

    this.eventEmitter.emit(NOTIFICATION_EVENTS.USER_CREATED, event);

    return user;
  }
}
```

## Available Events

### User Events
- `USER_CREATED` - When a new user is created
- `USER_UPDATED` - When a user's profile is updated
- `USER_DELETED` - When a user is deleted

### Project Events
- `PROJECT_CREATED` - When a new project is created
- `PROJECT_UPDATED` - When a project is updated
- `PROJECT_DELETED` - When a project is deleted

### Role and Permission Events
- `ROLE_ASSIGNED` - When a role is assigned to a user
- `ROLE_REVOKED` - When a role is revoked from a user
- `PERMISSION_GRANTED` - When a permission is granted to a user
- `PERMISSION_REVOKED` - When a permission is revoked from a user

### System Events
- `SYSTEM_MAINTENANCE` - When system maintenance is scheduled
- `SECURITY_ALERT` - When a security alert is triggered

### Business Events
- `INVOICE_GENERATED` - When an invoice is generated
- `PAYMENT_RECEIVED` - When a payment is received
- `SUBSCRIPTION_EXPIRED` - When a subscription expires

## Adding New Events

1. Add the event interface to `event-types.ts`
2. Add the event name constant to `NOTIFICATION_EVENTS`
3. Add the event class to `notification-events.ts`
4. Add a handler method to `NotificationEventListener`
5. Write unit tests for the new handler

## Notification Categories

Events are automatically mapped to notification categories:
- `user_management` - User-related events
- `project_management` - Project-related events
- `access_management` - Role and permission events
- `system` - System maintenance and alerts
- `security` - Security-related events
- `billing` - Invoice and payment events

## Error Handling

All event handlers include error handling to ensure that a failed notification doesn't break the application flow. Errors are logged but don't propagate up to the calling code.