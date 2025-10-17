import { NotificationEvent, NotificationEventName } from './event-types';

/**
 * Base class for all notification events
 * Extends the basic event structure with notification-specific properties
 */
export class NotificationEventBase {
  constructor(
    public readonly name: NotificationEventName,
    public readonly payload: NotificationEvent,
  ) {}
}

/**
 * User Events
 */
export class UserCreatedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('user.created', payload);
  }
}

export class UserUpdatedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('user.updated', payload);
  }
}

export class UserDeletedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('user.deleted', payload);
  }
}

/**
 * Project Events
 */
export class ProjectCreatedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('project.created', payload);
  }
}

export class ProjectUpdatedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('project.updated', payload);
  }
}

export class ProjectDeletedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('project.deleted', payload);
  }
}

/**
 * Role and Permission Events
 */
export class RoleAssignedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('role.assigned', payload);
  }
}

export class RoleRevokedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('role.revoked', payload);
  }
}

export class PermissionGrantedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('permission.granted', payload);
  }
}

export class PermissionRevokedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('permission.revoked', payload);
  }
}

/**
 * System Events
 */
export class SystemMaintenanceNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('system.maintenance', payload);
  }
}

export class SecurityAlertNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('security.alert', payload);
  }
}

/**
 * Business Events
 */
export class InvoiceGeneratedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('invoice.generated', payload);
  }
}

export class PaymentReceivedNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('payment.received', payload);
  }
}

export class SubscriptionExpiredNotificationEvent extends NotificationEventBase {
  constructor(payload: NotificationEvent) {
    super('subscription.expired', payload);
  }
}
