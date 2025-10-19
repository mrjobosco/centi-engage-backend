import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import {
  EnhancedAuditService,
  EnhancedAuditEvent,
} from './enhanced-audit.service';

export interface OTPAuditEvent {
  userId: string;
  tenantId: string;
  action:
  | 'otp_generated'
  | 'otp_verified'
  | 'otp_verification_failed'
  | 'otp_resent'
  | 'otp_expired'
  | 'otp_rate_limit_hit'
  | 'otp_cleared'
  | 'email_verification_completed'
  | 'email_verification_required';
  email: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  errorCode?: string;
  errorMessage?: string;
  metadata?: {
    otpAttempts?: number;
    remainingAttempts?: number;
    otpTTL?: number;
    rateLimitRetryAfter?: number;
    emailDeliveryStatus?: 'sent' | 'failed' | 'pending';
    verificationMethod?: 'email_password' | 'oauth_bypass';
    previousVerificationStatus?: boolean;
    [key: string]: any;
  };
}

export interface OTPAuditQuery {
  tenantId?: string;
  userId?: string;
  email?: string;
  action?: string;
  success?: boolean;
  ipAddress?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface OTPAuditStatistics {
  totalOTPEvents: number;
  otpGenerationCount: number;
  otpVerificationCount: number;
  successfulVerifications: number;
  failedVerifications: number;
  rateLimitViolations: number;
  averageVerificationTime: number;
  topFailureReasons: Array<{ reason: string; count: number }>;
  emailDeliveryStats: {
    sent: number;
    failed: number;
    pending: number;
  };
  verificationMethodStats: {
    emailPassword: number;
    oauthBypass: number;
  };
}

/**
 * OTP-specific audit service for comprehensive logging and monitoring of email verification operations
 */
@Injectable()
export class OTPAuditService extends EnhancedAuditService {
  private readonly otpLogger = new Logger(OTPAuditService.name);

  constructor(prisma: PrismaService, configService: ConfigService) {
    super(prisma, configService);
  }

  /**
   * Log OTP-specific audit event
   */
  async logOTPEvent(event: OTPAuditEvent): Promise<void> {
    try {
      // Convert OTP event to enhanced audit event format
      const enhancedEvent: EnhancedAuditEvent = {
        userId: event.userId,
        tenantId: event.tenantId,
        action: event.action as any,
        authMethod: 'password', // OTP is part of email/password flow
        success: event.success,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        errorCode: event.errorCode,
        errorMessage: event.errorMessage,
        metadata: {
          email: event.email,
          otpEvent: true,
          ...event.metadata,
        },
      };

      // Log through enhanced audit service
      await this.logEnhancedAuthEvent(enhancedEvent);

      // Additional OTP-specific logging
      this.logOTPMetrics(event);
      await this.checkOTPSecurityPatterns(event);

      // Log structured OTP event
      this.logStructuredOTPEvent(event);
    } catch (error) {
      this.otpLogger.error('Failed to log OTP audit event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        event: event.action,
        userId: event.userId,
        tenantId: event.tenantId,
        email: event.email,
      });
    }
  }

  /**
   * Log OTP generation event
   */
  async logOTPGeneration(
    userId: string,
    tenantId: string,
    email: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    metadata?: OTPAuditEvent['metadata'],
  ): Promise<void> {
    await this.logOTPEvent({
      userId,
      tenantId,
      email,
      action: 'otp_generated',
      success,
      ipAddress,
      userAgent,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log OTP verification attempt
   */
  async logOTPVerification(
    userId: string,
    tenantId: string,
    email: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    errorCode?: string,
    errorMessage?: string,
    metadata?: OTPAuditEvent['metadata'],
  ): Promise<void> {
    const action = success ? 'otp_verified' : 'otp_verification_failed';

    await this.logOTPEvent({
      userId,
      tenantId,
      email,
      action,
      success,
      ipAddress,
      userAgent,
      errorCode,
      errorMessage,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log OTP resend event
   */
  async logOTPResend(
    userId: string,
    tenantId: string,
    email: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    metadata?: OTPAuditEvent['metadata'],
  ): Promise<void> {
    await this.logOTPEvent({
      userId,
      tenantId,
      email,
      action: 'otp_resent',
      success,
      ipAddress,
      userAgent,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log rate limiting event
   */
  async logOTPRateLimit(
    userId: string,
    tenantId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string,
    retryAfter?: number,
  ): Promise<void> {
    await this.logOTPEvent({
      userId,
      tenantId,
      email,
      action: 'otp_rate_limit_hit',
      success: false,
      ipAddress,
      userAgent,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      errorMessage: 'OTP rate limit exceeded',
      metadata: {
        rateLimitRetryAfter: retryAfter,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log email verification completion
   */
  async logEmailVerificationCompleted(
    userId: string,
    tenantId: string,
    email: string,
    verificationMethod: 'email_password' | 'oauth_bypass',
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logOTPEvent({
      userId,
      tenantId,
      email,
      action: 'email_verification_completed',
      success: true,
      ipAddress,
      userAgent,
      metadata: {
        verificationMethod,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log email verification requirement
   */
  async logEmailVerificationRequired(
    userId: string,
    tenantId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string,
    blockedAction?: string,
  ): Promise<void> {
    await this.logOTPEvent({
      userId,
      tenantId,
      email,
      action: 'email_verification_required',
      success: false,
      ipAddress,
      userAgent,
      errorCode: 'EMAIL_VERIFICATION_REQUIRED',
      errorMessage: 'Email verification required to access this resource',
      metadata: {
        blockedAction,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log OTP-specific metrics for monitoring
   */
  private logOTPMetrics(event: OTPAuditEvent): void {
    try {
      const metrics = {
        event_type: 'otp_metric',
        tenant_id: event.tenantId,
        user_id: event.userId,
        email: event.email,
        action: event.action,
        success: event.success,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        timestamp: new Date().toISOString(),
        otp_attempts: event.metadata?.otpAttempts,
        remaining_attempts: event.metadata?.remainingAttempts,
        otp_ttl: event.metadata?.otpTTL,
        rate_limit_retry_after: event.metadata?.rateLimitRetryAfter,
        email_delivery_status: event.metadata?.emailDeliveryStatus,
        verification_method: event.metadata?.verificationMethod,
      };

      this.otpLogger.log(metrics, 'OTPMetrics');

      // Alert on critical OTP events
      if (this.isCriticalOTPEvent(event)) {
        this.alertCriticalOTPEvent(event);
      }
    } catch (error) {
      this.otpLogger.error('Failed to log OTP metrics', error);
    }
  }

  /**
   * Check for OTP-specific security patterns
   */
  private async checkOTPSecurityPatterns(event: OTPAuditEvent): Promise<void> {
    try {
      // Check for excessive failed verification attempts
      if (event.action === 'otp_verification_failed') {
        await this.checkExcessiveFailedVerifications(event);
      }

      // Check for rapid OTP generation requests
      if (event.action === 'otp_generated' || event.action === 'otp_resent') {
        await this.checkRapidOTPGeneration(event);
      }

      // Check for suspicious verification patterns
      if (event.action === 'otp_verified') {
        await this.checkSuspiciousVerificationPatterns(event);
      }

      // Check for rate limit abuse patterns
      if (event.action === 'otp_rate_limit_hit') {
        await this.checkRateLimitAbusePatterns(event);
      }
    } catch (error) {
      this.otpLogger.error('Failed to check OTP security patterns', error);
    }
  }

  /**
   * Log structured OTP event for analytics
   */
  private logStructuredOTPEvent(event: OTPAuditEvent): void {
    const structuredEvent = {
      '@timestamp': new Date().toISOString(),
      event: {
        category: 'email_verification',
        type: event.action,
        outcome: event.success ? 'success' : 'failure',
      },
      user: {
        id: event.userId,
        tenant_id: event.tenantId,
        email: event.email,
      },
      source: {
        ip: event.ipAddress,
      },
      user_agent: {
        original: event.userAgent,
      },
      otp: {
        action: event.action,
        success: event.success,
        attempts: event.metadata?.otpAttempts,
        remaining_attempts: event.metadata?.remainingAttempts,
        ttl: event.metadata?.otpTTL,
        email_delivery_status: event.metadata?.emailDeliveryStatus,
        verification_method: event.metadata?.verificationMethod,
      },
      error: event.errorCode
        ? {
          code: event.errorCode,
          message: event.errorMessage,
        }
        : undefined,
      metadata: event.metadata,
    };

    this.otpLogger.log(structuredEvent, 'StructuredOTPEvent');
  }

  /**
   * Check for excessive failed verification attempts
   */
  private async checkExcessiveFailedVerifications(
    event: OTPAuditEvent,
  ): Promise<void> {
    const recentFailures = await this.getRecentOTPFailures(
      event.userId,
      event.tenantId,
      30, // Last 30 minutes
    );

    if (recentFailures >= 10) {
      this.alertSuspiciousOTPActivity('excessive_failed_verifications', {
        userId: event.userId,
        tenantId: event.tenantId,
        email: event.email,
        failureCount: recentFailures,
        timeWindow: '30 minutes',
        ipAddress: event.ipAddress,
      });
    }
  }

  /**
   * Check for rapid OTP generation requests
   */
  private async checkRapidOTPGeneration(event: OTPAuditEvent): Promise<void> {
    const recentGenerations = await this.getRecentOTPGenerations(
      event.userId,
      event.tenantId,
      60, // Last 60 minutes
    );

    if (recentGenerations >= 5) {
      this.alertSuspiciousOTPActivity('rapid_otp_generation', {
        userId: event.userId,
        tenantId: event.tenantId,
        email: event.email,
        generationCount: recentGenerations,
        timeWindow: '60 minutes',
        ipAddress: event.ipAddress,
      });
    }
  }

  /**
   * Check for suspicious verification patterns
   */
  private async checkSuspiciousVerificationPatterns(
    event: OTPAuditEvent,
  ): Promise<void> {
    // Check for verification from different IP than generation
    const generationEvent = await this.getLastOTPGeneration(
      event.userId,
      event.tenantId,
    );

    if (
      generationEvent &&
      generationEvent.ipAddress &&
      event.ipAddress &&
      generationEvent.ipAddress !== event.ipAddress
    ) {
      this.alertSuspiciousOTPActivity('ip_mismatch_verification', {
        userId: event.userId,
        tenantId: event.tenantId,
        email: event.email,
        generationIp: generationEvent.ipAddress,
        verificationIp: event.ipAddress,
      });
    }
  }

  /**
   * Check for rate limit abuse patterns
   */
  private async checkRateLimitAbusePatterns(
    event: OTPAuditEvent,
  ): Promise<void> {
    const recentRateLimits = await this.getRecentRateLimitHits(
      event.ipAddress || 'unknown',
      event.tenantId,
      120, // Last 2 hours
    );

    if (recentRateLimits >= 3) {
      this.alertSuspiciousOTPActivity('rate_limit_abuse', {
        userId: event.userId,
        tenantId: event.tenantId,
        email: event.email,
        ipAddress: event.ipAddress,
        rateLimitHits: recentRateLimits,
        timeWindow: '2 hours',
      });
    }
  }

  /**
   * Get recent OTP failures for a user
   */
  private async getRecentOTPFailures(
    userId: string,
    tenantId: string,
    minutesBack: number,
  ): Promise<number> {
    const since = new Date(Date.now() - minutesBack * 60 * 1000);

    try {
      const count = await this.prisma.notificationAuditLog.count({
        where: {
          userId,
          tenantId,
          action: 'otp_verification_failed',
          createdAt: {
            gte: since,
          },
        } as any,
      });

      return count;
    } catch (error) {
      this.otpLogger.error('Failed to get recent OTP failures', error);
      return 0;
    }
  }

  /**
   * Get recent OTP generations for a user
   */
  private async getRecentOTPGenerations(
    userId: string,
    tenantId: string,
    minutesBack: number,
  ): Promise<number> {
    const since = new Date(Date.now() - minutesBack * 60 * 1000);

    try {
      const count = await this.prisma.notificationAuditLog.count({
        where: {
          userId,
          tenantId,
          action: {
            in: ['otp_generated', 'otp_resent'],
          },
          createdAt: {
            gte: since,
          },
        } as any,
      });

      return count;
    } catch (error) {
      this.otpLogger.error('Failed to get recent OTP generations', error);
      return 0;
    }
  }

  /**
   * Get last OTP generation event for a user
   */
  private async getLastOTPGeneration(
    userId: string,
    tenantId: string,
  ): Promise<{ ipAddress?: string } | null> {
    try {
      const event = await this.prisma.notificationAuditLog.findFirst({
        where: {
          userId,
          tenantId,
          action: {
            in: ['otp_generated', 'otp_resent'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          ipAddress: true,
        },
      } as any);

      return event ? { ipAddress: event.ipAddress || undefined } : null;
    } catch (error) {
      this.otpLogger.error('Failed to get last OTP generation', error);
      return null;
    }
  }

  /**
   * Get recent rate limit hits from an IP
   */
  private async getRecentRateLimitHits(
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
          action: 'otp_rate_limit_hit',
          createdAt: {
            gte: since,
          },
        } as any,
      });

      return count;
    } catch (error) {
      this.otpLogger.error('Failed to get recent rate limit hits', error);
      return 0;
    }
  }

  /**
   * Check if event is critical and requires immediate attention
   */
  private isCriticalOTPEvent(event: OTPAuditEvent): boolean {
    const criticalActions = [
      'otp_rate_limit_hit',
      'email_verification_required',
    ];

    const criticalErrorCodes = [
      'RATE_LIMIT_EXCEEDED',
      'EMAIL_VERIFICATION_REQUIRED',
    ];

    return (
      criticalActions.includes(event.action) ||
      (event.errorCode && criticalErrorCodes.includes(event.errorCode)) ||
      (typeof event.metadata?.otpAttempts === 'number' &&
        event.metadata.otpAttempts >= 4)
    );
  }

  /**
   * Alert critical OTP events
   */
  private alertCriticalOTPEvent(event: OTPAuditEvent): void {
    this.otpLogger.warn('Critical OTP event detected', {
      userId: event.userId,
      tenantId: event.tenantId,
      email: event.email,
      action: event.action,
      errorCode: event.errorCode,
      ipAddress: event.ipAddress,
      metadata: event.metadata,
    });
  }

  /**
   * Alert suspicious OTP activity
   */
  private alertSuspiciousOTPActivity(
    activityType: string,
    details: Record<string, any>,
  ): void {
    this.otpLogger.warn(
      `Suspicious OTP activity detected: ${activityType}`,
      details,
    );
  }

  /**
   * Get OTP audit statistics
   */
  async getOTPAuditStatistics(
    query: OTPAuditQuery,
    timeRange: { from: Date; to: Date },
  ): Promise<OTPAuditStatistics> {
    try {
      const whereClause = this.buildOTPWhereClause(query, timeRange);

      const [
        totalOTPEvents,
        otpGenerationCount,
        otpVerificationCount,
        successfulVerifications,
        failedVerifications,
        rateLimitViolations,
      ] = await Promise.all([
        this.prisma.notificationAuditLog.count({ where: whereClause } as any),
        this.prisma.notificationAuditLog.count({
          where: {
            ...whereClause,
            action: { in: ['otp_generated', 'otp_resent'] },
          },
        } as any),
        this.prisma.notificationAuditLog.count({
          where: {
            ...whereClause,
            action: { in: ['otp_verified', 'otp_verification_failed'] },
          },
        } as any),
        this.prisma.notificationAuditLog.count({
          where: {
            ...whereClause,
            action: 'otp_verified',
          },
        } as any),
        this.prisma.notificationAuditLog.count({
          where: {
            ...whereClause,
            action: 'otp_verification_failed',
          },
        } as any),
        this.prisma.notificationAuditLog.count({
          where: {
            ...whereClause,
            action: 'otp_rate_limit_hit',
          },
        } as any),
      ]);

      return {
        totalOTPEvents,
        otpGenerationCount,
        otpVerificationCount,
        successfulVerifications,
        failedVerifications,
        rateLimitViolations,
        averageVerificationTime: 0, // Would calculate from timing data
        topFailureReasons: [], // Would extract from error codes
        emailDeliveryStats: {
          sent: 0,
          failed: 0,
          pending: 0,
        },
        verificationMethodStats: {
          emailPassword: 0,
          oauthBypass: 0,
        },
      };
    } catch (error) {
      this.otpLogger.error('Failed to get OTP audit statistics', error);
      throw error;
    }
  }

  /**
   * Build where clause for OTP audit queries
   */
  private buildOTPWhereClause(
    query: OTPAuditQuery,
    timeRange: { from: Date; to: Date },
  ): any {
    const where: any = {
      createdAt: {
        gte: timeRange.from,
        lte: timeRange.to,
      },
      action: {
        in: [
          'otp_generated',
          'otp_verified',
          'otp_verification_failed',
          'otp_resent',
          'otp_expired',
          'otp_rate_limit_hit',
          'otp_cleared',
          'email_verification_completed',
          'email_verification_required',
        ],
      },
    };

    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = query.action;
    if (query.ipAddress) where.ipAddress = query.ipAddress;
    if (query.success !== undefined) {
      where.metadata = { path: ['success'], equals: query.success };
    }

    return where;
  }

  /**
   * Get OTP audit logs for a user
   */
  async getUserOTPAuditLogs(
    userId: string,
    tenantId: string,
    limit: number = 50,
  ) {
    return this.prisma.notificationAuditLog.findMany({
      where: {
        userId,
        tenantId,
        action: {
          in: [
            'otp_generated',
            'otp_verified',
            'otp_verification_failed',
            'otp_resent',
            'otp_rate_limit_hit',
            'email_verification_completed',
            'email_verification_required',
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        action: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      } as any,
    });
  }

  /**
   * Get OTP audit logs for a tenant
   */
  async getTenantOTPAuditLogs(
    tenantId: string,
    limit: number = 100,
    offset: number = 0,
  ) {
    return this.prisma.notificationAuditLog.findMany({
      where: {
        tenantId,
        action: {
          in: [
            'otp_generated',
            'otp_verified',
            'otp_verification_failed',
            'otp_resent',
            'otp_rate_limit_hit',
            'email_verification_completed',
            'email_verification_required',
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        userId: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      } as any,
    });
  }
}
