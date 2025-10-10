import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannelType } from '../enums/notification-channel.enum';
import { NotificationType } from '../enums/notification-type.enum';
import { DeliveryStatus } from '../enums/delivery-status.enum';

export interface NotificationLogContext {
  tenantId: string;
  userId?: string;
  notificationId?: string;
  category: string;
  channel?: NotificationChannelType;
  type?: NotificationType;
  provider?: string;
  messageId?: string;
  deliveryLogId?: string;
  processingTimeMs?: number;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationLoggerService {
  private readonly logger = new Logger(NotificationLoggerService.name);

  /**
   * Log notification creation event
   */
  logNotificationCreated(context: NotificationLogContext): void {
    this.logger.log({
      event: 'notification_created',
      tenant_id: context.tenantId,
      user_id: context.userId,
      notification_id: context.notificationId,
      category: context.category,
      type: context.type,
      timestamp: new Date().toISOString(),
      ...context.metadata,
    });
  }

  /**
   * Log notification delivery attempt
   */
  logDeliveryAttempt(context: NotificationLogContext): void {
    this.logger.log({
      event: 'delivery_attempt',
      tenant_id: context.tenantId,
      user_id: context.userId,
      notification_id: context.notificationId,
      category: context.category,
      channel: context.channel,
      provider: context.provider,
      delivery_log_id: context.deliveryLogId,
      timestamp: new Date().toISOString(),
      ...context.metadata,
    });
  }

  /**
   * Log successful notification delivery
   */
  logDeliverySuccess(context: NotificationLogContext): void {
    this.logger.log({
      event: 'delivery_success',
      tenant_id: context.tenantId,
      user_id: context.userId,
      notification_id: context.notificationId,
      category: context.category,
      channel: context.channel,
      provider: context.provider,
      message_id: context.messageId,
      delivery_log_id: context.deliveryLogId,
      processing_time_ms: context.processingTimeMs,
      timestamp: new Date().toISOString(),
      ...context.metadata,
    });
  }

  /**
   * Log failed notification delivery
   */
  logDeliveryFailure(context: NotificationLogContext): void {
    this.logger.error({
      event: 'delivery_failure',
      tenant_id: context.tenantId,
      user_id: context.userId,
      notification_id: context.notificationId,
      category: context.category,
      channel: context.channel,
      provider: context.provider,
      delivery_log_id: context.deliveryLogId,
      error_code: context.errorCode,
      error_message: context.errorMessage,
      processing_time_ms: context.processingTimeMs,
      timestamp: new Date().toISOString(),
      ...context.metadata,
    });
  }

  /**
   * Log delivery status change
   */
  logDeliveryStatusChange(
    context: NotificationLogContext,
    fromStatus: DeliveryStatus,
    toStatus: DeliveryStatus,
  ): void {
    this.logger.log({
      event: 'delivery_status_change',
      tenant_id: context.tenantId,
      user_id: context.userId,
      notification_id: context.notificationId,
      category: context.category,
      channel: context.channel,
      provider: context.provider,
      delivery_log_id: context.deliveryLogId,
      from_status: fromStatus,
      to_status: toStatus,
      timestamp: new Date().toISOString(),
      ...context.metadata,
    });
  }

  /**
   * Log provider API response
   */
  logProviderResponse(
    context: NotificationLogContext,
    success: boolean,
    responseData?: any,
  ): void {
    const logData = {
      event: 'provider_response',
      tenant_id: context.tenantId,
      user_id: context.userId,
      notification_id: context.notificationId,
      category: context.category,
      channel: context.channel,
      provider: context.provider,
      success,
      processing_time_ms: context.processingTimeMs,
      timestamp: new Date().toISOString(),
      ...context.metadata,
    };

    if (success) {
      this.logger.log({
        ...logData,
        message_id: context.messageId,
        response_data: this.sanitizeResponseData(responseData),
      });
    } else {
      this.logger.error({
        ...logData,
        error_code: context.errorCode,
        error_message: context.errorMessage,
        response_data: this.sanitizeResponseData(responseData),
      });
    }
  }

  /**
   * Log queue processing events
   */
  logQueueProcessing(
    queueName: string,
    jobId: string,
    event: 'started' | 'completed' | 'failed' | 'stalled',
    context?: NotificationLogContext,
    error?: string,
  ): void {
    const logData = {
      event: `queue_${event}`,
      queue_name: queueName,
      job_id: jobId,
      tenant_id: context?.tenantId,
      user_id: context?.userId,
      notification_id: context?.notificationId,
      category: context?.category,
      channel: context?.channel,
      processing_time_ms: context?.processingTimeMs,
      timestamp: new Date().toISOString(),
      ...context?.metadata,
    };

    if (event === 'failed') {
      this.logger.error({
        ...logData,
        error_message: error,
      });
    } else {
      this.logger.log(logData);
    }
  }

  /**
   * Log user preference changes
   */
  logPreferenceChange(
    tenantId: string,
    userId: string,
    category: string,
    changes: Record<string, any>,
  ): void {
    this.logger.log({
      event: 'preference_change',
      tenant_id: tenantId,
      user_id: userId,
      category,
      changes,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log template usage
   */
  logTemplateUsage(
    context: NotificationLogContext,
    templateId: string,
    variables?: Record<string, any>,
  ): void {
    this.logger.log({
      event: 'template_usage',
      tenant_id: context.tenantId,
      user_id: context.userId,
      notification_id: context.notificationId,
      category: context.category,
      channel: context.channel,
      template_id: templateId,
      variables: this.sanitizeVariables(variables),
      timestamp: new Date().toISOString(),
      ...context.metadata,
    });
  }

  /**
   * Log WebSocket events
   */
  logWebSocketEvent(
    event: 'connection' | 'disconnection' | 'notification_pushed' | 'error',
    tenantId: string,
    userId?: string,
    socketId?: string,
    error?: string,
    metadata?: Record<string, any>,
  ): void {
    const logData = {
      event: `websocket_${event}`,
      tenant_id: tenantId,
      user_id: userId,
      socket_id: socketId,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    if (event === 'error') {
      this.logger.error({
        ...logData,
        error_message: error,
      });
    } else {
      this.logger.log(logData);
    }
  }

  /**
   * Log rate limiting events
   */
  logRateLimit(
    tenantId: string,
    userId: string,
    endpoint: string,
    limit: number,
    remaining: number,
    resetTime: Date,
  ): void {
    this.logger.warn({
      event: 'rate_limit_hit',
      tenant_id: tenantId,
      user_id: userId,
      endpoint,
      limit,
      remaining,
      reset_time: resetTime.toISOString(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log security events
   */
  logSecurityEvent(
    event:
      | 'unauthorized_access'
      | 'permission_denied'
      | 'tenant_isolation_violation',
    tenantId: string,
    userId?: string,
    resource?: string,
    details?: Record<string, any>,
  ): void {
    this.logger.error({
      event: `security_${event}`,
      tenant_id: tenantId,
      user_id: userId,
      resource,
      timestamp: new Date().toISOString(),
      ...details,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetric(
    operation: string,
    durationMs: number,
    context?: NotificationLogContext,
  ): void {
    this.logger.log({
      event: 'performance_metric',
      operation,
      duration_ms: durationMs,
      tenant_id: context?.tenantId,
      user_id: context?.userId,
      notification_id: context?.notificationId,
      category: context?.category,
      channel: context?.channel,
      timestamp: new Date().toISOString(),
      ...context?.metadata,
    });
  }

  /**
   * Sanitize response data to remove sensitive information
   */
  private sanitizeResponseData(data: any): any {
    if (!data) return data;

    // Create a copy to avoid modifying the original
    const sanitized = JSON.parse(JSON.stringify(data));

    // Remove common sensitive fields
    const sensitiveFields = [
      'password',
      'token',
      'key',
      'secret',
      'authorization',
      'auth',
      'credential',
      'api_key',
      'apikey',
    ];

    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      for (const key in obj) {
        if (
          sensitiveFields.some((field) => key.toLowerCase().includes(field))
        ) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
      return obj;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Sanitize template variables to remove sensitive information
   */
  private sanitizeVariables(
    variables?: Record<string, any>,
  ): Record<string, any> | undefined {
    if (!variables) return variables;

    const sanitized = { ...variables };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'api_key',
      'credit_card',
    ];

    for (const key in sanitized) {
      if (sensitiveFields.some((field) => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
