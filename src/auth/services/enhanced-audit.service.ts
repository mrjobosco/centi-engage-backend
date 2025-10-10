import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AuthAuditService, AuthAuditEvent } from './auth-audit.service';

export interface EnhancedAuditEvent extends AuthAuditEvent {
  requestId?: string;
  sessionId?: string;
  deviceFingerprint?: string;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
  riskScore?: number;
  duration?: number;
  responseStatus?: 'success' | 'error' | 'timeout';
  rateLimitHit?: boolean;
  previousAttempts?: number;
}

export interface AuditQuery {
  tenantId?: string;
  userId?: string;
  action?: string;
  authMethod?: string;
  success?: boolean;
  ipAddress?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditStatistics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  uniqueUsers: number;
  uniqueIpAddresses: number;
  topActions: Array<{ action: string; count: number }>;
  topErrorCodes: Array<{ errorCode: string; count: number }>;
  hourlyDistribution: Array<{ hour: number; count: number }>;
  geographicDistribution: Array<{ country: string; count: number }>;
}

/**
 * Enhanced audit service with comprehensive logging, analytics, and security monitoring
 */
@Injectable()
export class EnhancedAuditService extends AuthAuditService {
  private readonly enhancedLogger = new Logger(EnhancedAuditService.name);

  constructor(
    prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    super(prisma);
  }

  /**
   * Log enhanced authentication event with additional security context
   */
  async logEnhancedAuthEvent(event: EnhancedAuditEvent): Promise<void> {
    try {
      // Calculate risk score based on various factors
      const riskScore = this.calculateRiskScore(event);
      const enhancedEvent = { ...event, riskScore };

      // Log to parent service (handles database and application logging)
      await super.logAuthEvent(enhancedEvent);

      // Additional enhanced logging
      await this.logSecurityMetrics(enhancedEvent);
      await this.checkForSuspiciousActivity(enhancedEvent);

      // Log structured data for analytics
      this.logStructuredEvent(enhancedEvent);
    } catch (error) {
      this.enhancedLogger.error('Failed to log enhanced auth event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event: event.action,
        userId: event.userId,
        tenantId: event.tenantId,
      });
    }
  }

  /**
   * Calculate risk score based on various factors
   */
  private calculateRiskScore(event: EnhancedAuditEvent): number {
    let riskScore = 0;

    // Base risk for failed attempts
    if (!event.success) {
      riskScore += 30;
    }

    // Risk based on IP address patterns
    if (event.ipAddress) {
      if (this.isKnownBadIp(event.ipAddress)) {
        riskScore += 50;
      }
      if (this.isUnusualGeolocation(event.geolocation)) {
        riskScore += 20;
      }
    }

    // Risk based on user agent
    if (event.userAgent) {
      if (this.isSuspiciousUserAgent(event.userAgent)) {
        riskScore += 25;
      }
    }

    // Risk based on timing patterns
    if (event.previousAttempts && event.previousAttempts > 3) {
      riskScore += 40;
    }

    // Risk based on rate limiting
    if (event.rateLimitHit) {
      riskScore += 35;
    }

    // Risk based on error patterns
    if (event.errorCode) {
      if (this.isHighRiskErrorCode(event.errorCode)) {
        riskScore += 30;
      }
    }

    return Math.min(riskScore, 100); // Cap at 100
  }

  /**
   * Log security metrics for monitoring
   */
  private async logSecurityMetrics(event: EnhancedAuditEvent): Promise<void> {
    try {
      const metrics = {
        event_type: 'security_metric',
        tenant_id: event.tenantId,
        user_id: event.userId,
        action: event.action,
        auth_method: event.authMethod,
        success: event.success,
        risk_score: event.riskScore,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        timestamp: new Date().toISOString(),
        request_id: event.requestId,
        session_id: event.sessionId,
        device_fingerprint: event.deviceFingerprint,
        geolocation: event.geolocation,
        duration: event.duration,
        rate_limit_hit: event.rateLimitHit,
        previous_attempts: event.previousAttempts,
      };

      // Log to structured logging system (could be sent to external systems)
      this.enhancedLogger.log(metrics, 'SecurityMetrics');

      // Store high-risk events for immediate attention
      if (event.riskScore && event.riskScore > 70) {
        await this.alertHighRiskEvent(event);
      }
    } catch (error) {
      this.enhancedLogger.error('Failed to log security metrics', error);
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  private async checkForSuspiciousActivity(
    event: EnhancedAuditEvent,
  ): Promise<void> {
    try {
      // Check for multiple failed attempts from same IP
      if (!event.success && event.ipAddress) {
        const recentFailures = await this.getRecentFailedAttempts(
          event.ipAddress,
          event.tenantId,
          15, // Last 15 minutes
        );

        if (recentFailures >= 5) {
          await this.alertSuspiciousActivity('multiple_failed_attempts', {
            ipAddress: event.ipAddress,
            tenantId: event.tenantId,
            failureCount: recentFailures,
            timeWindow: '15 minutes',
          });
        }
      }

      // Check for unusual login patterns
      if (event.success && event.action.includes('login')) {
        await this.checkUnusualLoginPatterns(event);
      }

      // Check for rapid account linking/unlinking
      if (event.action.includes('link') || event.action.includes('unlink')) {
        await this.checkRapidAccountChanges(event);
      }
    } catch (error) {
      this.enhancedLogger.error(
        'Failed to check for suspicious activity',
        error,
      );
    }
  }

  /**
   * Log structured event for analytics
   */
  private logStructuredEvent(event: EnhancedAuditEvent): void {
    const structuredEvent = {
      '@timestamp': new Date().toISOString(),
      event: {
        category: 'authentication',
        type: event.action,
        outcome: event.success ? 'success' : 'failure',
        duration: event.duration,
        risk_score: event.riskScore,
      },
      user: {
        id: event.userId,
        tenant_id: event.tenantId,
      },
      source: {
        ip: event.ipAddress,
        geo: event.geolocation,
      },
      user_agent: {
        original: event.userAgent,
      },
      http: {
        request: {
          id: event.requestId,
        },
      },
      auth: {
        method: event.authMethod,
        success: event.success,
      },
      error: event.errorCode
        ? {
          code: event.errorCode,
          message: event.errorMessage,
        }
        : undefined,
      metadata: event.metadata,
    };

    this.enhancedLogger.log(structuredEvent, 'StructuredAuditEvent');
  }

  /**
   * Get recent failed attempts from an IP address
   */
  private async getRecentFailedAttempts(
    ipAddress: string,
    tenantId: string,
    minutesBack: number,
  ): Promise<number> {
    const since = new Date(Date.now() - minutesBack * 60 * 1000);

    try {
      const count = await this.prisma.notificationAuditLog.count({
        where: {
          tenantId,
          ipAddress,
          createdAt: {
            gte: since,
          },
          metadata: {
            path: ['success'],
            equals: false,
          },
        } as any,
      });

      return count;
    } catch (error) {
      this.enhancedLogger.error('Failed to get recent failed attempts', error);
      return 0;
    }
  }

  /**
   * Check for unusual login patterns
   */
  private async checkUnusualLoginPatterns(
    event: EnhancedAuditEvent,
  ): Promise<void> {
    // Implementation would check for:
    // - Logins from new geographic locations
    // - Logins at unusual times
    // - Logins from new devices
    // - Multiple concurrent sessions

    this.enhancedLogger.debug('Checking unusual login patterns', {
      userId: event.userId,
      ipAddress: event.ipAddress,
      geolocation: event.geolocation,
    });
  }

  /**
   * Check for rapid account changes
   */
  private async checkRapidAccountChanges(
    event: EnhancedAuditEvent,
  ): Promise<void> {
    const recentChanges = await this.prisma.notificationAuditLog.count({
      where: {
        userId: event.userId,
        tenantId: event.tenantId,
        action: {
          in: ['google_link', 'google_unlink'],
        },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      } as any,
    });

    if (recentChanges > 3) {
      await this.alertSuspiciousActivity('rapid_account_changes', {
        userId: event.userId,
        tenantId: event.tenantId,
        changeCount: recentChanges,
        timeWindow: '1 hour',
      });
    }
  }

  /**
   * Alert high-risk events
   */
  private async alertHighRiskEvent(event: EnhancedAuditEvent): Promise<void> {
    this.enhancedLogger.warn('High-risk authentication event detected', {
      userId: event.userId,
      tenantId: event.tenantId,
      action: event.action,
      riskScore: event.riskScore,
      ipAddress: event.ipAddress,
      errorCode: event.errorCode,
    });

    // Could integrate with external alerting systems here
    // e.g., send to Slack, PagerDuty, email, etc.
  }

  /**
   * Alert suspicious activity
   */
  private async alertSuspiciousActivity(
    activityType: string,
    details: Record<string, any>,
  ): Promise<void> {
    this.enhancedLogger.warn(
      `Suspicious activity detected: ${activityType}`,
      details,
    );

    // Could integrate with external alerting systems here
  }

  /**
   * Get comprehensive audit statistics
   */
  async getAuditStatistics(
    query: AuditQuery,
    timeRange: { from: Date; to: Date },
  ): Promise<AuditStatistics> {
    try {
      const whereClause = this.buildWhereClause(query, timeRange);

      const [
        totalEvents,
        successfulEvents,
        failedEvents,
        uniqueUsers,
        uniqueIpAddresses,
        topActions,
        topErrorCodes,
        hourlyDistribution,
      ] = await Promise.all([
        this.prisma.notificationAuditLog.count({ where: whereClause } as any),
        this.prisma.notificationAuditLog.count({
          where: {
            ...whereClause,
            metadata: { path: ['success'], equals: true },
          },
        } as any),
        this.prisma.notificationAuditLog.count({
          where: {
            ...whereClause,
            metadata: { path: ['success'], equals: false },
          },
        } as any),
        this.getUniqueUserCount(whereClause),
        this.getUniqueIpCount(whereClause),
        this.getTopActions(whereClause),
        this.getTopErrorCodes(whereClause),
        this.getHourlyDistribution(whereClause),
      ]);

      return {
        totalEvents,
        successfulEvents,
        failedEvents,
        uniqueUsers,
        uniqueIpAddresses,
        topActions,
        topErrorCodes,
        hourlyDistribution,
        geographicDistribution: [], // Would implement with geolocation data
      };
    } catch (error) {
      this.enhancedLogger.error('Failed to get audit statistics', error);
      throw error;
    }
  }

  /**
   * Helper methods for risk calculation
   */
  private isKnownBadIp(ipAddress: string): boolean {
    // Implementation would check against threat intelligence feeds
    // For now, just check for obvious bad patterns
    const badPatterns = ['127.0.0.1', '0.0.0.0', 'unknown'];
    return badPatterns.includes(ipAddress);
  }

  private isUnusualGeolocation(geolocation?: { country?: string }): boolean {
    // Implementation would check against user's typical locations
    return false; // Placeholder
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      'bot',
      'crawler',
      'spider',
      'scraper',
      'curl',
      'wget',
      'python',
    ];
    return suspiciousPatterns.some((pattern) =>
      userAgent.toLowerCase().includes(pattern),
    );
  }

  private isHighRiskErrorCode(errorCode: string): boolean {
    const highRiskCodes = [
      'INVALID_TOKEN',
      'OAUTH_FAILED',
      'RATE_LIMIT_EXCEEDED',
      'CROSS_TENANT_ACCESS',
    ];
    return highRiskCodes.includes(errorCode);
  }

  /**
   * Helper methods for statistics
   */
  private buildWhereClause(
    query: AuditQuery,
    timeRange: { from: Date; to: Date },
  ): any {
    const where: any = {
      createdAt: {
        gte: timeRange.from,
        lte: timeRange.to,
      },
    };

    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.authMethod) where.authMethod = query.authMethod;
    if (query.ipAddress) where.ipAddress = query.ipAddress;
    if (query.success !== undefined) {
      where.metadata = { path: ['success'], equals: query.success };
    }

    return where;
  }

  private async getUniqueUserCount(whereClause: any): Promise<number> {
    const result = await this.prisma.notificationAuditLog.findMany({
      where: whereClause,
      select: { userId: true },
      distinct: ['userId'],
    } as any);
    return result.length;
  }

  private async getUniqueIpCount(whereClause: any): Promise<number> {
    const result = await this.prisma.notificationAuditLog.findMany({
      where: whereClause,
      select: { ipAddress: true },
      distinct: ['ipAddress'],
    } as any);
    return result.length;
  }

  private async getTopActions(
    whereClause: any,
  ): Promise<Array<{ action: string; count: number }>> {
    const result = await this.prisma.notificationAuditLog.groupBy({
      by: ['action'],
      where: whereClause,
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    } as any);

    return result.map((item: any) => ({
      action: item.action,
      count: item._count.action,
    }));
  }

  private async getTopErrorCodes(
    whereClause: any,
  ): Promise<Array<{ errorCode: string; count: number }>> {
    // This would require a more complex query to extract error codes from metadata
    // For now, return empty array
    return [];
  }

  private async getHourlyDistribution(
    whereClause: any,
  ): Promise<Array<{ hour: number; count: number }>> {
    // This would require a more complex query to group by hour
    // For now, return empty array
    return [];
  }
}
