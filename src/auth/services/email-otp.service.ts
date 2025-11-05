import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { OTPStorageService } from './otp-storage.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { NotificationType } from '../../notifications/enums/notification-type.enum';
import { NotificationPriority } from '../../notifications/enums/notification-priority.enum';
import { OTPAuditService } from './otp-audit.service';
import { OTPMetricsService } from './otp-metrics.service';
import { EmailProviderFactory } from '../../notifications/factories/email-provider.factory';
import { randomBytes } from 'crypto';

export interface OTPGenerationResult {
  success: boolean;
  message: string;
  retryAfter?: number;
}

export interface OTPVerificationResult {
  success: boolean;
  message: string;
  remainingAttempts?: number;
}

@Injectable()
export class EmailOTPService {
  private readonly logger = new Logger(EmailOTPService.name);
  private readonly otpLength: number;
  private readonly maxVerificationAttempts = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpStorage: OTPStorageService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly otpAudit: OTPAuditService,
    private readonly otpMetrics: OTPMetricsService,
    private readonly emailProviderFactory: EmailProviderFactory,
  ) {
    this.otpLength = this.configService.get<number>('config.otp.length') ?? 6;
  }

  /**
   * Generate a cryptographically secure OTP
   */
  private generateSecureOTP(): string {
    const digits = '0123456789';
    let otp = '';

    // Generate random bytes and convert to digits
    const randomBytesArray = randomBytes(this.otpLength);

    for (let i = 0; i < this.otpLength; i++) {
      otp += digits[randomBytesArray[i] % digits.length];
    }

    return otp;
  }

  /**
   * Generate and store OTP for a user
   */
  async generateOTP(
    userId: string,
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<OTPGenerationResult> {
    const performanceTimer = this.otpMetrics.startPerformanceTimer(
      'generation',
      'unknown',
      userId,
    );

    try {
      // Get user's tenant ID for audit logging
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true },
      });

      if (!user) {
        performanceTimer(false);
        throw new BadRequestException('User not found');
      }

      const tenantId = user.tenantId;

      // Check rate limiting
      const rateLimitCheck = await this.otpStorage.checkRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        this.logger.warn(`Rate limit exceeded for user ${userId}`);

        // Log rate limit event
        await this.otpAudit.logOTPRateLimit(
          userId,
          tenantId || 'system-audit',
          email,
          ipAddress,
          userAgent,
          rateLimitCheck.retryAfter,
        );

        performanceTimer(false);
        return {
          success: false,
          message: 'Too many OTP requests. Please try again later.',
          retryAfter: rateLimitCheck.retryAfter,
        };
      }

      // Generate new OTP
      const otp = this.generateSecureOTP();

      // Store OTP in Redis
      await this.otpStorage.storeOTP(userId, otp, email);

      // Send OTP via email through notification service
      const emailDeliveryStatus = await this.sendOTPEmail(userId, email, otp);

      // Update user's verification token sent timestamp
      await this.prisma.$executeRaw`
        UPDATE users 
        SET verification_token_sent_at = NOW() 
        WHERE id = ${userId}
      `;

      // Log successful OTP generation
      await this.otpAudit.logOTPGeneration(
        userId,
        tenantId || 'system-audit',
        email,
        true,
        ipAddress,
        userAgent,
        {
          otpLength: this.otpLength,
          emailDeliveryStatus,
          otpTTL:
            this.configService.get<number>('config.otp.expirationMinutes') ??
            30,
        },
      );

      this.logger.log(`OTP generated and sent successfully for user ${userId}`);
      performanceTimer(true);

      return {
        success: true,
        message: 'OTP generated and sent successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to generate OTP for user ${userId}:`, error);

      // Log failed OTP generation
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { tenantId: true },
        });

        if (user) {
          await this.otpAudit.logOTPGeneration(
            userId,
            user.tenantId || 'system-audit',
            email,
            false,
            ipAddress,
            userAgent,
            {
              errorMessage:
                error instanceof Error ? error.message : 'Unknown error',
            },
          );
        }
      } catch (auditError) {
        this.logger.error('Failed to log OTP generation failure', auditError);
      }

      performanceTimer(false);
      throw new BadRequestException('Failed to generate OTP');
    }
  }

  /**
   * Send OTP email through notification service
   */
  private async sendOTPEmail(
    userId: string,
    email: string,
    otp: string,
  ): Promise<'sent' | 'failed' | 'pending'> {
    const emailTimer = this.otpMetrics.startPerformanceTimer(
      'email_delivery',
      'unknown',
      userId,
    );

    try {
      // Get user details for personalization
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          tenantId: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const firstName = user.firstName || 'User';
      const expirationMinutes =
        this.configService.get<number>('config.otp.expirationMinutes') ?? 30;

      // Check if user has tenant context
      if (user.tenantId) {
        // Send notification through the notification service for tenant users
        await this.notificationService.sendToUser(userId, {
          type: NotificationType.INFO,
          category: 'email_verification',
          title: 'Email Verification Required',
          message: `Your verification code is ${otp}. This code will expire in ${expirationMinutes} minutes.`,
          priority: NotificationPriority.HIGH,
          templateVariables: {
            firstName,
            otp,
            expirationTime: `${expirationMinutes} minutes`,
            companyName:
              this.configService.get<string>('config.app.name') ??
              'Your Company',
            supportEmail:
              this.configService.get<string>('config.support.email') ??
              'support@company.com',
          },
        });
      } else {
        // For tenant-less users, send email directly
        await this.sendDirectOTPEmail(email, firstName, otp, expirationMinutes);
      }

      this.logger.log(
        `OTP email sent successfully to ${email} for user ${userId}`,
      );

      emailTimer(true);
      return 'sent';
    } catch (error) {
      this.logger.error(
        `Failed to send OTP email to ${email} for user ${userId}:`,
        error,
      );

      emailTimer(false);
      // Don't throw error here - OTP generation should succeed even if email fails
      // User can request resend if needed
      return 'failed';
    }
  }

  /**
   * Verify OTP and mark user as verified if successful
   */
  async verifyOTP(
    userId: string,
    providedOTP: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<OTPVerificationResult> {
    const performanceTimer = this.otpMetrics.startPerformanceTimer(
      'verification',
      'unknown',
      userId,
    );

    try {
      // Get user details for audit logging
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { tenantId: true, email: true },
      });

      if (!user) {
        performanceTimer(false);
        throw new BadRequestException('User not found');
      }

      const { tenantId, email } = user;

      // Get stored OTP record
      const otpRecord = await this.otpStorage.getOTP(userId);

      if (!otpRecord) {
        this.logger.warn(`No OTP found for user ${userId}`);

        // Log verification failure
        await this.otpAudit.logOTPVerification(
          userId,
          tenantId || 'system-audit',
          email,
          false,
          ipAddress,
          userAgent,
          'OTP_NOT_FOUND',
          'No OTP found for user',
          { otpAttempts: 0 },
        );

        performanceTimer(false);
        return {
          success: false,
          message: 'No OTP found. Please request a new one.',
        };
      }

      // Check if max attempts exceeded
      if (otpRecord.attempts >= this.maxVerificationAttempts) {
        this.logger.warn(
          `Max verification attempts exceeded for user ${userId}`,
        );

        // Log verification failure
        await this.otpAudit.logOTPVerification(
          userId,
          tenantId || 'system-audit',
          email,
          false,
          ipAddress,
          userAgent,
          'MAX_ATTEMPTS_EXCEEDED',
          'Maximum verification attempts exceeded',
          {
            otpAttempts: otpRecord.attempts,
            maxAttempts: this.maxVerificationAttempts,
          },
        );

        await this.otpStorage.deleteOTP(userId);
        performanceTimer(false);
        return {
          success: false,
          message:
            'Maximum verification attempts exceeded. Please request a new OTP.',
        };
      }

      // Verify OTP
      if (otpRecord.otp !== providedOTP) {
        // Increment attempts
        const newAttempts = await this.otpStorage.incrementAttempts(userId);
        const remainingAttempts = this.maxVerificationAttempts - newAttempts;

        this.logger.warn(
          `Invalid OTP provided for user ${userId}. Attempts: ${newAttempts}`,
        );

        // Log verification failure
        await this.otpAudit.logOTPVerification(
          userId,
          tenantId || 'system-audit',
          email,
          false,
          ipAddress,
          userAgent,
          'INVALID_OTP',
          'Invalid OTP provided',
          {
            otpAttempts: newAttempts,
            remainingAttempts,
            maxAttempts: this.maxVerificationAttempts,
          },
        );

        if (remainingAttempts <= 0) {
          await this.otpStorage.deleteOTP(userId);
          performanceTimer(false);
          return {
            success: false,
            message:
              'Invalid OTP. Maximum attempts exceeded. Please request a new OTP.',
          };
        }

        performanceTimer(false);
        return {
          success: false,
          message: 'Invalid OTP. Please try again.',
          remainingAttempts,
        };
      }

      // OTP is valid - mark user as verified
      await this.markUserAsVerified(userId);

      // Clean up OTP from storage
      await this.otpStorage.deleteOTP(userId);

      // Log successful verification
      await this.otpAudit.logOTPVerification(
        userId,
        tenantId || 'system-audit',
        email,
        true,
        ipAddress,
        userAgent,
        undefined,
        undefined,
        {
          otpAttempts: otpRecord.attempts + 1,
          verificationMethod: 'email_password',
        },
      );

      // Log email verification completion
      await this.otpAudit.logEmailVerificationCompleted(
        userId,
        tenantId || 'system-audit',
        email,
        'email_password',
        ipAddress,
        userAgent,
      );

      this.logger.log(`Email verification successful for user ${userId}`);
      performanceTimer(true);

      return {
        success: true,
        message: 'Email verified successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to verify OTP for user ${userId}:`, error);

      // Log verification error
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { tenantId: true, email: true },
        });

        if (user) {
          await this.otpAudit.logOTPVerification(
            userId,
            user.tenantId || 'system-audit',
            user.email,
            false,
            ipAddress,
            userAgent,
            'VERIFICATION_ERROR',
            error instanceof Error ? error.message : 'Unknown error',
          );
        }
      } catch (auditError) {
        this.logger.error('Failed to log OTP verification error', auditError);
      }

      performanceTimer(false);
      throw new BadRequestException('Failed to verify OTP');
    }
  }

  /**
   * Resend OTP to user (invalidates previous OTP)
   */
  async resendOTP(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<OTPGenerationResult> {
    try {
      // Get user details using raw query to avoid type issues
      const user = await this.prisma.$queryRaw<
        Array<{
          email: string;
          email_verified: boolean | null;
          tenant_id: string;
        }>
      >`
        SELECT email, email_verified, tenant_id 
        FROM users 
        WHERE id = ${userId}
      `;

      if (!user || user.length === 0) {
        throw new BadRequestException('User not found');
      }

      const { email, email_verified, tenant_id: tenantId } = user[0];

      if (email_verified) {
        // Log resend attempt for already verified user
        await this.otpAudit.logOTPResend(
          userId,
          tenantId,
          email,
          false,
          ipAddress,
          userAgent,
          {
            errorMessage: 'Email is already verified',
            previousVerificationStatus: true,
          },
        );

        return {
          success: false,
          message: 'Email is already verified',
        };
      }

      // Delete existing OTP if any
      await this.otpStorage.deleteOTP(userId);

      // Log resend event
      await this.otpAudit.logOTPResend(
        userId,
        tenantId,
        email,
        true,
        ipAddress,
        userAgent,
        {
          previousVerificationStatus: false,
        },
      );

      // Generate new OTP
      return await this.generateOTP(userId, email, ipAddress, userAgent);
    } catch (error) {
      this.logger.error(`Failed to resend OTP for user ${userId}:`, error);

      // Log resend error
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { tenantId: true, email: true },
        });

        if (user) {
          await this.otpAudit.logOTPResend(
            userId,
            user.tenantId || 'system-audit',
            user.email,
            false,
            ipAddress,
            userAgent,
            {
              errorMessage:
                error instanceof Error ? error.message : 'Unknown error',
            },
          );
        }
      } catch (auditError) {
        this.logger.error('Failed to log OTP resend error', auditError);
      }

      throw new BadRequestException('Failed to resend OTP');
    }
  }

  /**
   * Check if user's email is verified
   */
  async isUserVerified(userId: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<
        Array<{
          email_verified: boolean | null;
        }>
      >`
        SELECT email_verified 
        FROM users 
        WHERE id = ${userId}
      `;

      return result[0]?.email_verified ?? false;
    } catch (error) {
      this.logger.error(
        `Failed to check verification status for user ${userId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Get OTP status for a user (for debugging/admin purposes)
   */
  async getOTPStatus(userId: string): Promise<{
    hasActiveOTP: boolean;
    remainingTTL?: number;
    attempts?: number;
    canResend: boolean;
  }> {
    try {
      const otpRecord = await this.otpStorage.getOTP(userId);
      const rateLimitCheck = await this.otpStorage.checkRateLimit(userId);

      if (!otpRecord) {
        return {
          hasActiveOTP: false,
          canResend: rateLimitCheck.allowed,
        };
      }

      const remainingTTL = await this.otpStorage.getRemainingTTL(userId);

      return {
        hasActiveOTP: true,
        remainingTTL,
        attempts: otpRecord.attempts,
        canResend: rateLimitCheck.allowed,
      };
    } catch (error) {
      this.logger.error(`Failed to get OTP status for user ${userId}:`, error);
      return {
        hasActiveOTP: false,
        canResend: false,
      };
    }
  }

  /**
   * Mark user as verified in database
   */
  private async markUserAsVerified(userId: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE users 
      SET email_verified = true, email_verified_at = NOW() 
      WHERE id = ${userId}
    `;
  }

  /**
   * Clear all OTP data for a user (admin function)
   */
  async clearUserOTPData(userId: string): Promise<void> {
    try {
      await this.otpStorage.deleteOTP(userId);
      await this.otpStorage.clearRateLimit(userId);

      this.logger.log(`OTP data cleared for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to clear OTP data for user ${userId}:`, error);
      throw new BadRequestException('Failed to clear OTP data');
    }
  }

  /**
   * Get the actual OTP for a user (admin/testing function - use with caution)
   */
  async getOTPForUser(userId: string): Promise<string | null> {
    try {
      const otpRecord = await this.otpStorage.getOTP(userId);
      return otpRecord?.otp ?? null;
    } catch (error) {
      this.logger.error(`Failed to get OTP for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Validate that user needs email verification
   */
  async requiresVerification(userId: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<
        Array<{
          email_verified: boolean | null;
          auth_methods: string[];
        }>
      >`
        SELECT email_verified, auth_methods 
        FROM users 
        WHERE id = ${userId}
      `;

      if (!result || result.length === 0) {
        return false;
      }

      const user = result[0];

      // OAuth users don't need email verification
      if (user.auth_methods.includes('google')) {
        return false;
      }

      // Email/password users need verification if not already verified
      return !user.email_verified;
    } catch (error) {
      this.logger.error(
        `Failed to check verification requirement for user ${userId}:`,
        error,
      );
      return true; // Err on the side of caution
    }
  }

  /**
   * Bulk verify users (admin function for data migration)
   */
  async bulkVerifyUsers(
    userIds: string[],
  ): Promise<{ verified: number; failed: string[] }> {
    const failed: string[] = [];
    let verified = 0;

    for (const userId of userIds) {
      try {
        await this.markUserAsVerified(userId);
        await this.clearUserOTPData(userId);
        verified++;
      } catch (error) {
        this.logger.error(`Failed to bulk verify user ${userId}:`, error);
        failed.push(userId);
      }
    }

    this.logger.log(
      `Bulk verification completed: ${verified} verified, ${failed.length} failed`,
    );

    return { verified, failed };
  }

  /**
   * Send OTP email directly for tenant-less users
   */
  private async sendDirectOTPEmail(
    email: string,
    firstName: string,
    otp: string,
    expirationMinutes: number,
  ): Promise<void> {
    try {
      const emailProvider = this.emailProviderFactory.createProvider();

      const companyName =
        this.configService.get<string>('config.app.name') ?? 'Your Company';
      const supportEmail =
        this.configService.get<string>('config.support.email') ??
        'support@company.com';

      const subject = 'Email Verification Required';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Email Verification Required</h2>
          <p>Hello ${firstName},</p>
          <p>Your verification code is: <strong style="font-size: 24px; color: #007bff;">${otp}</strong></p>
          <p>This code will expire in ${expirationMinutes} minutes.</p>
          <p>If you didn't request this verification, please ignore this email.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            This email was sent by ${companyName}. 
            If you need help, contact us at ${supportEmail}.
          </p>
        </div>
      `;

      const text = `
        Email Verification Required
        
        Hello ${firstName},
        
        Your verification code is: ${otp}
        
        This code will expire in ${expirationMinutes} minutes.
        
        If you didn't request this verification, please ignore this email.
        
        This email was sent by ${companyName}.
        If you need help, contact us at ${supportEmail}.
      `;

      const result = await emailProvider.send({
        to: email,
        from: 'no-reply@centihq.com',
        subject,
        html,
        text,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      this.logger.log(`Direct OTP email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send direct OTP email to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Verify OTP by email for public endpoints (tenant-less users)
   */
  async verifyOTPByEmail(
    providedOTP: string,
    tenantId?: string | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<OTPVerificationResult> {
    const performanceTimer = this.otpMetrics.startPerformanceTimer(
      'verification',
      tenantId || 'unknown',
      'unknown',
    );

    try {
      // Find the most recent OTP record that matches the provided OTP
      // We'll search through active OTP records to find a match
      const activeOTPs = await this.otpStorage.getAllActiveOTPs();

      let matchingUserId: string | null = null;
      let matchingOTPRecord: any = null;

      for (const [userId, otpRecord] of activeOTPs) {
        if (otpRecord.otp === providedOTP) {
          // Get user details to check tenant match
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { tenantId: true, email: true },
          });

          if (user) {
            // For tenant-less users, tenantId should be null
            // For tenant users, tenantId should match
            if (
              (tenantId === null && user.tenantId === null) ||
              (tenantId && user.tenantId === tenantId)
            ) {
              matchingUserId = userId;
              matchingOTPRecord = otpRecord;
              break;
            }
          }
        }
      }

      if (!matchingUserId || !matchingOTPRecord) {
        this.logger.warn(`No matching OTP found for provided code`);

        performanceTimer(false);
        return {
          success: false,
          message: 'Invalid OTP code. Please check and try again.',
        };
      }

      // Now verify using the existing verifyOTP method
      return await this.verifyOTP(
        matchingUserId,
        providedOTP,
        ipAddress,
        userAgent,
      );
    } catch (error) {
      this.logger.error('Error in verifyOTPByEmail:', error);
      performanceTimer(false);
      return {
        success: false,
        message: 'Verification failed. Please try again.',
      };
    }
  }
}
