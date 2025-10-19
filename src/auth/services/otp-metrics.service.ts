import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export interface OTPMetrics {
  // Generation metrics
  otpGenerationRate: number; // OTPs generated per hour
  otpGenerationSuccess: number; // Percentage of successful generations

  // Verification metrics
  otpVerificationRate: number; // Verifications attempted per hour
  otpVerificationSuccess: number; // Percentage of successful verifications
  averageVerificationAttempts: number; // Average attempts before success

  // Email delivery metrics
  emailDeliverySuccess: number; // Percentage of successful email deliveries
  emailDeliveryFailure: number; // Percentage of failed email deliveries
  averageEmailDeliveryTime: number; // Average time to deliver email (ms)

  // Performance metrics
  averageOTPGenerationTime: number; // Average time to generate OTP (ms)
  averageOTPVerificationTime: number; // Average time to verify OTP (ms)
  redisOperationSuccess: number; // Percentage of successful Redis operations
  redisOperationLatency: number; // Average Redis operation latency (ms)

  // Security metrics
  rateLimitHitRate: number; // Rate limit violations per hour
  suspiciousActivityCount: number; // Suspicious activities detected
  crossTenantAttempts: number; // Cross-tenant access attempts

  // User behavior metrics
  averageTimeToVerify: number; // Average time from generation to verification
  abandonmentRate: number; // Percentage of OTPs that expire unused
  resendRate: number; // Percentage of OTPs that are resent
}

export interface OTPPerformanceMetrics {
  timestamp: Date;
  operation:
    | 'generation'
    | 'verification'
    | 'email_delivery'
    | 'redis_operation';
  duration: number; // milliseconds
  success: boolean;
  tenantId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface OTPHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    redisConnectivity: boolean;
    emailService: boolean;
    databaseConnectivity: boolean;
    otpGeneration: boolean;
    otpVerification: boolean;
  };
  metrics: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
  lastUpdated: Date;
}

/**
 * OTP metrics and monitoring service for performance tracking and health monitoring
 */
@Injectable()
export class OTPMetricsService {
  private readonly logger = new Logger(OTPMetricsService.name);
  private performanceBuffer: OTPPerformanceMetrics[] = [];
  private readonly maxBufferSize = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Flush performance metrics every 5 minutes
    setInterval(
      () => {
        this.flushPerformanceMetrics();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * Record performance metric for OTP operations
   */
  recordPerformanceMetric(metric: OTPPerformanceMetrics): void {
    try {
      this.performanceBuffer.push(metric);

      // Log high-latency operations
      if (metric.duration > 5000) {
        // 5 seconds
        this.logger.warn('High-latency OTP operation detected', {
          operation: metric.operation,
          duration: metric.duration,
          tenantId: metric.tenantId,
          userId: metric.userId,
          success: metric.success,
        });
      }

      // Log failed operations
      if (!metric.success) {
        this.logger.error('OTP operation failed', {
          operation: metric.operation,
          duration: metric.duration,
          tenantId: metric.tenantId,
          userId: metric.userId,
          metadata: metric.metadata,
        });
      }

      // Flush buffer if it gets too large
      if (this.performanceBuffer.length >= this.maxBufferSize) {
        void this.flushPerformanceMetrics();
      }
    } catch (error) {
      this.logger.error('Failed to record performance metric', error);
    }
  }

  /**
   * Get current OTP metrics
   */
  async getOTPMetrics(
    tenantId?: string,
    timeRange: { from: Date; to: Date } = {
      from: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      to: new Date(),
    },
  ): Promise<OTPMetrics> {
    try {
      const whereClause = this.buildMetricsWhereClause(tenantId, timeRange);

      const [
        generationStats,
        verificationStats,
        emailStats,
        securityStats,
        behaviorStats,
      ] = await Promise.all([
        this.getGenerationMetrics(whereClause, timeRange),
        this.getVerificationMetrics(whereClause, timeRange),
        this.getEmailDeliveryMetrics(whereClause),
        this.getSecurityMetrics(whereClause, timeRange),
        this.getBehaviorMetrics(whereClause),
      ]);

      const performanceStats = this.getPerformanceMetrics(tenantId, timeRange);

      return {
        otpGenerationRate: generationStats.otpGenerationRate || 0,
        otpGenerationSuccess: generationStats.otpGenerationSuccess || 100,
        otpVerificationRate: verificationStats.otpVerificationRate || 0,
        otpVerificationSuccess: verificationStats.otpVerificationSuccess || 100,
        averageVerificationAttempts:
          verificationStats.averageVerificationAttempts || 1,
        emailDeliverySuccess: emailStats.emailDeliverySuccess || 100,
        emailDeliveryFailure: emailStats.emailDeliveryFailure || 0,
        averageEmailDeliveryTime: emailStats.averageEmailDeliveryTime || 0,
        averageOTPGenerationTime:
          performanceStats.averageOTPGenerationTime || 0,
        averageOTPVerificationTime:
          performanceStats.averageOTPVerificationTime || 0,
        redisOperationSuccess: performanceStats.redisOperationSuccess || 100,
        redisOperationLatency: performanceStats.redisOperationLatency || 0,
        rateLimitHitRate: securityStats.rateLimitHitRate || 0,
        suspiciousActivityCount: securityStats.suspiciousActivityCount || 0,
        crossTenantAttempts: securityStats.crossTenantAttempts || 0,
        averageTimeToVerify: behaviorStats.averageTimeToVerify || 0,
        abandonmentRate: behaviorStats.abandonmentRate || 0,
        resendRate: behaviorStats.resendRate || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get OTP metrics', error);
      throw error;
    }
  }

  /**
   * Get OTP system health check
   */
  async getHealthCheck(): Promise<OTPHealthCheck> {
    const startTime = Date.now();

    try {
      const checks = await Promise.allSettled([
        this.checkRedisConnectivity(),
        this.checkEmailService(),
        this.checkDatabaseConnectivity(),
        this.checkOTPGeneration(),
        this.checkOTPVerification(),
      ]);

      const healthChecks = {
        redisConnectivity: checks[0].status === 'fulfilled' && checks[0].value,
        emailService: checks[1].status === 'fulfilled' && checks[1].value,
        databaseConnectivity:
          checks[2].status === 'fulfilled' && checks[2].value,
        otpGeneration: checks[3].status === 'fulfilled' && checks[3].value,
        otpVerification: checks[4].status === 'fulfilled' && checks[4].value,
      };

      const responseTime = Date.now() - startTime;
      const healthyChecks = Object.values(healthChecks).filter(Boolean).length;
      const totalChecks = Object.values(healthChecks).length;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyChecks === totalChecks) {
        status = 'healthy';
      } else if (healthyChecks >= totalChecks * 0.7) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      const metrics = this.getHealthMetrics();

      return {
        status,
        checks: healthChecks,
        metrics: {
          responseTime,
          errorRate: metrics.errorRate,
          throughput: metrics.throughput,
        },
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        checks: {
          redisConnectivity: false,
          emailService: false,
          databaseConnectivity: false,
          otpGeneration: false,
          otpVerification: false,
        },
        metrics: {
          responseTime: Date.now() - startTime,
          errorRate: 100,
          throughput: 0,
        },
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Get generation metrics
   */
  private async getGenerationMetrics(
    whereClause: any,
    timeRange: { from: Date; to: Date },
  ): Promise<Partial<OTPMetrics>> {
    const generationEvents = await this.prisma.notificationAuditLog.findMany({
      where: {
        ...whereClause,
        action: { in: ['otp_generated', 'otp_resent'] },
      },
      select: {
        metadata: true,
        createdAt: true,
      },
    } as any);

    const totalGenerations = generationEvents.length;
    const successfulGenerations = generationEvents.filter((event) => {
      const metadata = event.metadata as any;
      return metadata?.success !== false;
    }).length;

    const timeRangeHours =
      (timeRange.to.getTime() - timeRange.from.getTime()) / (1000 * 60 * 60);
    const otpGenerationRate = totalGenerations / Math.max(timeRangeHours, 1);
    const otpGenerationSuccess =
      totalGenerations > 0
        ? (successfulGenerations / totalGenerations) * 100
        : 100;

    return {
      otpGenerationRate,
      otpGenerationSuccess,
    };
  }

  /**
   * Get verification metrics
   */
  private async getVerificationMetrics(
    whereClause: any,
    timeRange: { from: Date; to: Date },
  ): Promise<Partial<OTPMetrics>> {
    const verificationEvents = await this.prisma.notificationAuditLog.findMany({
      where: {
        ...whereClause,
        action: { in: ['otp_verified', 'otp_verification_failed'] },
      },
      select: {
        action: true,
        metadata: true,
        createdAt: true,
      },
    } as any);

    const totalVerifications = verificationEvents.length;
    const successfulVerifications = verificationEvents.filter(
      (event) => event.action === 'otp_verified',
    ).length;

    const timeRangeHours =
      (timeRange.to.getTime() - timeRange.from.getTime()) / (1000 * 60 * 60);
    const otpVerificationRate =
      totalVerifications / Math.max(timeRangeHours, 1);
    const otpVerificationSuccess =
      totalVerifications > 0
        ? (successfulVerifications / totalVerifications) * 100
        : 100;

    // Calculate average verification attempts
    const attemptsData = verificationEvents
      .map((event) => {
        const metadata = event.metadata as any;
        return metadata?.otpAttempts;
      })
      .filter((attempts) => typeof attempts === 'number');
    const averageVerificationAttempts =
      attemptsData.length > 0
        ? attemptsData.reduce((sum, attempts) => sum + attempts, 0) /
          attemptsData.length
        : 1;

    return {
      otpVerificationRate,
      otpVerificationSuccess,
      averageVerificationAttempts,
    };
  }

  /**
   * Get email delivery metrics
   */
  private async getEmailDeliveryMetrics(
    whereClause: any,
  ): Promise<Partial<OTPMetrics>> {
    const emailEvents = await this.prisma.notificationAuditLog.findMany({
      where: {
        ...whereClause,
        action: { in: ['otp_generated', 'otp_resent'] },
      },
      select: {
        metadata: true,
      },
    } as any);

    const emailDeliveryStatuses = emailEvents
      .map((event) => {
        const metadata = event.metadata as any;
        return metadata?.emailDeliveryStatus;
      })
      .filter((status) => status);

    const totalEmails = emailDeliveryStatuses.length;
    const successfulDeliveries = emailDeliveryStatuses.filter(
      (status) => status === 'sent',
    ).length;
    const failedDeliveries = emailDeliveryStatuses.filter(
      (status) => status === 'failed',
    ).length;

    const emailDeliverySuccess =
      totalEmails > 0 ? (successfulDeliveries / totalEmails) * 100 : 100;
    const emailDeliveryFailure =
      totalEmails > 0 ? (failedDeliveries / totalEmails) * 100 : 0;

    return {
      emailDeliverySuccess,
      emailDeliveryFailure,
      averageEmailDeliveryTime: 0, // Would need timing data
    };
  }

  /**
   * Get performance metrics from buffer and database
   */
  private getPerformanceMetrics(
    tenantId?: string,
    timeRange?: { from: Date; to: Date },
  ): Partial<OTPMetrics> {
    // Get metrics from current buffer
    let bufferMetrics = this.performanceBuffer;

    if (tenantId) {
      bufferMetrics = bufferMetrics.filter(
        (metric) => metric.tenantId === tenantId,
      );
    }

    if (timeRange) {
      bufferMetrics = bufferMetrics.filter(
        (metric) =>
          metric.timestamp >= timeRange.from &&
          metric.timestamp <= timeRange.to,
      );
    }

    // Calculate averages from buffer
    const generationMetrics = bufferMetrics.filter(
      (m) => m.operation === 'generation',
    );
    const verificationMetrics = bufferMetrics.filter(
      (m) => m.operation === 'verification',
    );
    const redisMetrics = bufferMetrics.filter(
      (m) => m.operation === 'redis_operation',
    );

    const averageOTPGenerationTime =
      generationMetrics.length > 0
        ? generationMetrics.reduce((sum, m) => sum + m.duration, 0) /
          generationMetrics.length
        : 0;

    const averageOTPVerificationTime =
      verificationMetrics.length > 0
        ? verificationMetrics.reduce((sum, m) => sum + m.duration, 0) /
          verificationMetrics.length
        : 0;

    const redisOperationSuccess =
      redisMetrics.length > 0
        ? (redisMetrics.filter((m) => m.success).length / redisMetrics.length) *
          100
        : 100;

    const redisOperationLatency =
      redisMetrics.length > 0
        ? redisMetrics.reduce((sum, m) => sum + m.duration, 0) /
          redisMetrics.length
        : 0;

    return {
      averageOTPGenerationTime,
      averageOTPVerificationTime,
      redisOperationSuccess,
      redisOperationLatency,
    };
  }

  /**
   * Get security metrics
   */
  private async getSecurityMetrics(
    whereClause: any,
    timeRange: { from: Date; to: Date },
  ): Promise<Partial<OTPMetrics>> {
    const securityEvents = await this.prisma.notificationAuditLog.findMany({
      where: {
        ...whereClause,
        action: { in: ['otp_rate_limit_hit', 'email_verification_required'] },
      },
      select: {
        action: true,
        metadata: true,
      },
    } as any);

    const timeRangeHours =
      (timeRange.to.getTime() - timeRange.from.getTime()) / (1000 * 60 * 60);
    const rateLimitEvents = securityEvents.filter(
      (event) => event.action === 'otp_rate_limit_hit',
    );
    const rateLimitHitRate =
      rateLimitEvents.length / Math.max(timeRangeHours, 1);

    // Count suspicious activities (would be enhanced with more sophisticated detection)
    const suspiciousActivityCount = securityEvents.length;

    // Cross-tenant attempts (would need more specific tracking)
    const crossTenantAttempts = 0;

    return {
      rateLimitHitRate,
      suspiciousActivityCount,
      crossTenantAttempts,
    };
  }

  /**
   * Get user behavior metrics
   */
  private async getBehaviorMetrics(
    whereClause: any,
  ): Promise<Partial<OTPMetrics>> {
    // Get generation and verification events to calculate behavior metrics
    const events = await this.prisma.notificationAuditLog.findMany({
      where: {
        ...whereClause,
        action: {
          in: ['otp_generated', 'otp_verified', 'otp_resent', 'otp_expired'],
        },
      },
      select: {
        userId: true,
        action: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    } as any);

    // Group events by user to calculate behavior metrics
    const userEvents = events.reduce(
      (acc, event) => {
        if (!acc[event.userId]) {
          acc[event.userId] = [];
        }
        acc[event.userId].push(event);
        return acc;
      },
      {} as Record<string, any[]>,
    );

    const totalVerificationTimes: number[] = [];
    let totalGenerations = 0;
    let totalResends = 0;
    let totalExpired = 0;

    Object.values(userEvents).forEach((userEventList) => {
      let lastGeneration: any = null;

      userEventList.forEach((event) => {
        if (event.action === 'otp_generated') {
          lastGeneration = event;
          totalGenerations++;
        } else if (event.action === 'otp_verified' && lastGeneration) {
          const verificationTime =
            new Date(event.createdAt).getTime() -
            new Date(lastGeneration.createdAt).getTime();
          totalVerificationTimes.push(verificationTime);
          lastGeneration = null;
        } else if (event.action === 'otp_resent') {
          totalResends++;
        } else if (event.action === 'otp_expired') {
          totalExpired++;
        }
      });
    });

    const averageTimeToVerify =
      totalVerificationTimes.length > 0
        ? totalVerificationTimes.reduce((sum, time) => sum + time, 0) /
          totalVerificationTimes.length
        : 0;

    const abandonmentRate =
      totalGenerations > 0 ? (totalExpired / totalGenerations) * 100 : 0;

    const resendRate =
      totalGenerations > 0 ? (totalResends / totalGenerations) * 100 : 0;

    return {
      averageTimeToVerify,
      abandonmentRate,
      resendRate,
    };
  }

  /**
   * Health check methods
   */
  private async checkRedisConnectivity(): Promise<boolean> {
    try {
      // This would check Redis connectivity
      // For now, assume it's working if no errors
      return Promise.resolve(true);
    } catch (error) {
      this.logger.error('Redis connectivity check failed', error);
      return false;
    }
  }

  private async checkEmailService(): Promise<boolean> {
    try {
      // This would check email service connectivity
      // For now, assume it's working if no errors
      return Promise.resolve(true);
    } catch (error) {
      this.logger.error('Email service check failed', error);
      return false;
    }
  }

  private async checkDatabaseConnectivity(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database connectivity check failed', error);
      return false;
    }
  }

  private async checkOTPGeneration(): Promise<boolean> {
    try {
      // This would test OTP generation functionality
      // For now, assume it's working
      return Promise.resolve(true);
    } catch (error) {
      this.logger.error('OTP generation check failed', error);
      return false;
    }
  }

  private async checkOTPVerification(): Promise<boolean> {
    try {
      // This would test OTP verification functionality
      // For now, assume it's working
      return Promise.resolve(true);
    } catch (error) {
      this.logger.error('OTP verification check failed', error);
      return false;
    }
  }

  /**
   * Get health metrics
   */
  private getHealthMetrics(): {
    errorRate: number;
    throughput: number;
  } {
    const recentMetrics = this.performanceBuffer.filter(
      (metric) => metric.timestamp > new Date(Date.now() - 60 * 60 * 1000), // Last hour
    );

    const errorRate =
      recentMetrics.length > 0
        ? (recentMetrics.filter((m) => !m.success).length /
            recentMetrics.length) *
          100
        : 0;

    const throughput = recentMetrics.length; // Operations per hour

    return { errorRate, throughput };
  }

  /**
   * Build where clause for metrics queries
   */
  private buildMetricsWhereClause(
    tenantId?: string,
    timeRange?: { from: Date; to: Date },
  ): any {
    const where: any = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (timeRange) {
      where.createdAt = {
        gte: timeRange.from,
        lte: timeRange.to,
      };
    }

    return where;
  }

  /**
   * Flush performance metrics to persistent storage
   */
  private flushPerformanceMetrics(): void {
    if (this.performanceBuffer.length === 0) {
      return;
    }

    try {
      // In a real implementation, you might store these in a time-series database
      // For now, just log the aggregated metrics
      const metrics = this.performanceBuffer.splice(
        0,
        this.performanceBuffer.length,
      );

      const aggregated = {
        totalOperations: metrics.length,
        successfulOperations: metrics.filter((m) => m.success).length,
        averageDuration:
          metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
        operationTypes: metrics.reduce(
          (acc, m) => {
            acc[m.operation] = (acc[m.operation] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        timeRange: {
          from: Math.min(...metrics.map((m) => m.timestamp.getTime())),
          to: Math.max(...metrics.map((m) => m.timestamp.getTime())),
        },
      };

      this.logger.log('Performance metrics flushed', aggregated);
    } catch (error) {
      this.logger.error('Failed to flush performance metrics', error);
    }
  }

  /**
   * Start performance monitoring for an operation
   */
  startPerformanceTimer(
    operation: OTPPerformanceMetrics['operation'],
    tenantId: string,
    userId?: string,
    metadata?: Record<string, any>,
  ): (success: boolean) => void {
    const startTime = Date.now();

    return (success: boolean = true) => {
      const duration = Date.now() - startTime;
      this.recordPerformanceMetric({
        timestamp: new Date(),
        operation,
        duration,
        success,
        tenantId,
        userId,
        metadata,
      });
    };
  }
}
