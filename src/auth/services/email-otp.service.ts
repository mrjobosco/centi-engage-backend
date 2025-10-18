import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { OTPStorageService } from './otp-storage.service';
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
  ): Promise<OTPGenerationResult> {
    try {
      // Check rate limiting
      const rateLimitCheck = await this.otpStorage.checkRateLimit(userId);
      if (!rateLimitCheck.allowed) {
        this.logger.warn(`Rate limit exceeded for user ${userId}`);
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

      // Update user's verification token sent timestamp
      await this.prisma.$executeRaw`
        UPDATE users 
        SET verification_token_sent_at = NOW() 
        WHERE id = ${userId}
      `;

      this.logger.log(`OTP generated successfully for user ${userId}`);

      return {
        success: true,
        message: 'OTP generated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to generate OTP for user ${userId}:`, error);
      throw new BadRequestException('Failed to generate OTP');
    }
  }

  /**
   * Verify OTP and mark user as verified if successful
   */
  async verifyOTP(
    userId: string,
    providedOTP: string,
  ): Promise<OTPVerificationResult> {
    try {
      // Get stored OTP record
      const otpRecord = await this.otpStorage.getOTP(userId);

      if (!otpRecord) {
        this.logger.warn(`No OTP found for user ${userId}`);
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
        await this.otpStorage.deleteOTP(userId);
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

        if (remainingAttempts <= 0) {
          await this.otpStorage.deleteOTP(userId);
          return {
            success: false,
            message:
              'Invalid OTP. Maximum attempts exceeded. Please request a new OTP.',
          };
        }

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

      this.logger.log(`Email verification successful for user ${userId}`);

      return {
        success: true,
        message: 'Email verified successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to verify OTP for user ${userId}:`, error);
      throw new BadRequestException('Failed to verify OTP');
    }
  }

  /**
   * Resend OTP to user (invalidates previous OTP)
   */
  async resendOTP(userId: string): Promise<OTPGenerationResult> {
    try {
      // Get user details using raw query to avoid type issues
      const user = await this.prisma.$queryRaw<
        Array<{
          email: string;
          email_verified: boolean | null;
        }>
      >`
        SELECT email, email_verified 
        FROM users 
        WHERE id = ${userId}
      `;

      if (!user || user.length === 0) {
        throw new BadRequestException('User not found');
      }

      if (user[0].email_verified) {
        return {
          success: false,
          message: 'Email is already verified',
        };
      }

      // Delete existing OTP if any
      await this.otpStorage.deleteOTP(userId);

      // Generate new OTP
      return await this.generateOTP(userId, user[0].email);
    } catch (error) {
      this.logger.error(`Failed to resend OTP for user ${userId}:`, error);
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
}
