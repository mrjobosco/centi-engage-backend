/**
 * Base interface for all notification events
 */
export interface BaseNotificationEvent {
  tenantId: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * User-related events
 */
export interface UserCreatedEvent extends BaseNotificationEvent {
  userId: string;
  userEmail: string;
  userName: string;
}

export interface UserUpdatedEvent extends BaseNotificationEvent {
  userId: string;
  userEmail: string;
  userName: string;
  changes: Record<string, any>;
}

export interface UserDeletedEvent extends BaseNotificationEvent {
  userId: string;
  userEmail: string;
  userName: string;
}

/**
 * Project-related events
 */
export interface ProjectCreatedEvent extends BaseNotificationEvent {
  projectId: string;
  projectName: string;
  projectDescription?: string;
  createdBy: string;
}

export interface ProjectUpdatedEvent extends BaseNotificationEvent {
  projectId: string;
  projectName: string;
  updatedBy: string;
  changes: Record<string, any>;
}

export interface ProjectDeletedEvent extends BaseNotificationEvent {
  projectId: string;
  projectName: string;
  deletedBy: string;
}

/**
 * Role and Permission events
 */
export interface RoleAssignedEvent extends BaseNotificationEvent {
  userId: string;
  roleId: string;
  roleName: string;
  assignedBy: string;
}

export interface RoleRevokedEvent extends BaseNotificationEvent {
  userId: string;
  roleId: string;
  roleName: string;
  revokedBy: string;
}

export interface PermissionGrantedEvent extends BaseNotificationEvent {
  userId: string;
  permissionId: string;
  permissionName: string;
  grantedBy: string;
}

export interface PermissionRevokedEvent extends BaseNotificationEvent {
  userId: string;
  permissionId: string;
  permissionName: string;
  revokedBy: string;
}

/**
 * System events
 */
export interface SystemMaintenanceEvent extends BaseNotificationEvent {
  maintenanceType: 'scheduled' | 'emergency';
  startTime: Date;
  endTime?: Date;
  description: string;
}

export interface SecurityAlertEvent extends BaseNotificationEvent {
  alertType: 'login_attempt' | 'password_change' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Business events (examples for common B2B scenarios)
 */
export interface InvoiceGeneratedEvent extends BaseNotificationEvent {
  userId: string; // Override to make required for business events
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: Date;
  customerId?: string;
}

export interface PaymentReceivedEvent extends BaseNotificationEvent {
  userId: string; // Override to make required for business events
  paymentId: string;
  invoiceId?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  customerId?: string;
}

export interface SubscriptionExpiredEvent extends BaseNotificationEvent {
  userId: string; // Override to make required for business events
  subscriptionId: string;
  planName: string;
  expiryDate: Date;
  gracePeriodEnd?: Date;
}

/**
 * Union type of all notification events
 */
export type NotificationEvent =
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | ProjectCreatedEvent
  | ProjectUpdatedEvent
  | ProjectDeletedEvent
  | RoleAssignedEvent
  | RoleRevokedEvent
  | PermissionGrantedEvent
  | PermissionRevokedEvent
  | SystemMaintenanceEvent
  | SecurityAlertEvent
  | InvoiceGeneratedEvent
  | PaymentReceivedEvent
  | SubscriptionExpiredEvent;

/**
 * Event name constants
 */
export const NOTIFICATION_EVENTS = {
  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',

  // Project events
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',

  // Role and Permission events
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_REVOKED: 'role.revoked',
  PERMISSION_GRANTED: 'permission.granted',
  PERMISSION_REVOKED: 'permission.revoked',

  // System events
  SYSTEM_MAINTENANCE: 'system.maintenance',
  SECURITY_ALERT: 'security.alert',

  // Business events
  INVOICE_GENERATED: 'invoice.generated',
  PAYMENT_RECEIVED: 'payment.received',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',
} as const;

export type NotificationEventName =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];
