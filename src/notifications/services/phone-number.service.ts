import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

export interface PhoneNumberInfo {
  phoneNumber: string;
  countryCode: string;
  isValid: boolean;
  formatted: string;
}

@Injectable()
export class PhoneNumberService {
  private readonly logger = new Logger(PhoneNumberService.name);
  private readonly defaultCountryCode: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.defaultCountryCode = this.configService.get<string>(
      'DEFAULT_COUNTRY_CODE',
      '+1', // Default to US
    );
  }

  /**
   * Get user's phone number from database or payload
   */
  async getUserPhoneNumber(
    userId: string,
    tenantId: string,
    payloadData?: any,
  ): Promise<string | null> {
    try {
      // First, try to get phone number from payload data
      const phoneFromPayload = payloadData?.phoneNumber || payloadData?.phone;
      if (phoneFromPayload && this.isValidPhoneNumber(phoneFromPayload)) {
        return this.formatPhoneNumber(phoneFromPayload);
      }

      // Try to get phone number from user profile
      // Note: This assumes you have a phone field in your user table
      // You might need to add this field to your Prisma schema
      const user = await this.prisma.user.findUnique({
        where: {
          id: userId,
          tenantId: tenantId,
        },
        select: {
          id: true,
          // Uncomment when you add phone field to user schema
          // phone: true,
        },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found for phone number lookup`);
        return null;
      }

      // For now, return null since phone field doesn't exist in schema
      // When you add the phone field, uncomment this:
      // if (user.phone && this.isValidPhoneNumber(user.phone)) {
      //   return this.formatPhoneNumber(user.phone);
      // }

      // For now, we don't have a place to store phone numbers in the current schema
      // In a real implementation, you would add a phone field to the User model
      // or create a separate UserProfile model

      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get phone number for user ${userId}:`,
        error instanceof Error ? error.stack : error,
      );
      return null;
    }
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return false;
    }

    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Basic validation rules:
    // - Must start with + or be 10+ digits
    // - Must be between 10 and 15 digits (international standard)
    if (cleaned.startsWith('+')) {
      const digits = cleaned.substring(1);
      return /^\d{10,14}$/.test(digits);
    } else {
      return /^\d{10,15}$/.test(cleaned);
    }
  }

  /**
   * Format phone number to international format
   */
  formatPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) {
      return '';
    }

    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // If it already starts with +, return as-is (assuming it's already formatted)
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    // If it's a 10-digit US number, add +1
    if (cleaned.length === 10 && this.defaultCountryCode === '+1') {
      return `+1${cleaned}`;
    }

    // If it's 11 digits and starts with 1, assume it's US format
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }

    // For other cases, add the default country code
    return `${this.defaultCountryCode}${cleaned}`;
  }

  /**
   * Parse phone number and extract information
   */
  parsePhoneNumber(phoneNumber: string): PhoneNumberInfo {
    const formatted = this.formatPhoneNumber(phoneNumber);
    const isValid = this.isValidPhoneNumber(phoneNumber);

    let countryCode = this.defaultCountryCode;
    if (formatted.startsWith('+')) {
      // Extract country code (this is simplified - in production you'd use a proper library)
      if (formatted.startsWith('+1')) {
        countryCode = '+1';
      } else if (formatted.startsWith('+44')) {
        countryCode = '+44';
      } else if (formatted.startsWith('+33')) {
        countryCode = '+33';
      } else if (formatted.startsWith('+49')) {
        countryCode = '+49';
      } else {
        // Extract first 1-4 digits as country code
        const match = formatted.match(/^\+(\d{1,4})/);
        countryCode = match ? `+${match[1]}` : this.defaultCountryCode;
      }
    }

    return {
      phoneNumber: phoneNumber,
      countryCode,
      isValid,
      formatted,
    };
  }

  /**
   * Store phone number in user preferences
   */
  async storeUserPhoneNumber(
    userId: string,
    tenantId: string,
    phoneNumber: string,
  ): Promise<void> {
    try {
      if (!this.isValidPhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      const formatted = this.formatPhoneNumber(phoneNumber);

      // For now, we can't store phone numbers in the current schema
      // In a real implementation, you would:
      // 1. Add a phone field to the User model, or
      // 2. Create a separate UserProfile model, or
      // 3. Add a JSON metadata field to store additional user data

      // Just log that we would store the phone number
      this.logger.log(
        `Would store phone number for user ${userId}: ${formatted}`,
      );

      this.logger.debug(`Phone number stored for user ${userId}: ${formatted}`);
    } catch (error) {
      this.logger.error(
        `Failed to store phone number for user ${userId}:`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  /**
   * Get supported country codes
   */
  getSupportedCountryCodes(): Array<{ code: string; name: string }> {
    return [
      { code: '+1', name: 'United States/Canada' },
      { code: '+44', name: 'United Kingdom' },
      { code: '+33', name: 'France' },
      { code: '+49', name: 'Germany' },
      { code: '+81', name: 'Japan' },
      { code: '+86', name: 'China' },
      { code: '+91', name: 'India' },
      { code: '+61', name: 'Australia' },
      { code: '+55', name: 'Brazil' },
      { code: '+234', name: 'Nigeria' },
    ];
  }
}
