import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmailTemplate } from './base-email.template';

export interface OTPVerificationTemplateProps {
  firstName: string;
  otp: string;
  expirationTime: string; // e.g., "30 minutes"
  supportEmail?: string;
  companyName?: string;
  companyLogo?: string;
}

export const OTPVerificationTemplate = ({
  firstName,
  otp,
  expirationTime,
  supportEmail = 'support@company.com',
  companyName = 'Your Company',
  companyLogo,
}: OTPVerificationTemplateProps) => (
  <BaseEmailTemplate
    previewText="Verify your email address"
    title="Verify your email address"
    companyName={companyName}
    companyLogo={companyLogo}
    footerText={`© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}
  >
    <Text className="text-black text-[14px] leading-[24px]">
      Hello {firstName},
    </Text>
    <Text className="text-black text-[14px] leading-[24px]">
      Thank you for registering with {companyName}! To complete your account
      setup, please verify your email address using the verification code below.
    </Text>

    <Section className="text-center mt-[32px] mb-[32px] bg-[#f8f9fa] border border-[#e9ecef] rounded-lg p-[24px]">
      <Text className="text-black text-[12px] leading-[16px] uppercase tracking-wide font-semibold mb-[8px]">
        Your Verification Code
      </Text>
      <Text className="text-[#000000] text-[32px] leading-[40px] font-bold tracking-[8px] font-mono">
        {otp}
      </Text>
    </Section>

    <Text className="text-black text-[14px] leading-[24px]">
      This verification code will expire in <strong>{expirationTime}</strong>.
      If you need a new code, you can request another one from the verification
      page.
    </Text>

    <Section className="bg-[#f4f4f4] border-l-4 border-solid border-[#fbbf24] p-[16px] mt-[24px] mb-[24px]">
      <Text className="text-black text-[14px] leading-[24px] m-0">
        <strong>⚠️ Security Notice:</strong> If you didn't create an account
        with us, please ignore this email. For security reasons, we recommend
        that you don't share this verification code with anyone.
      </Text>
    </Section>

    <Text className="text-black text-[14px] leading-[24px]">
      Enter this code on the verification page to activate your account and
      start using all of our features.
    </Text>

    <Text className="text-black text-[14px] leading-[24px] mt-[24px]">
      If you're having trouble or didn't request this verification code, please
      contact our support team at{' '}
      <a href={`mailto:${supportEmail}`} className="text-blue-600 no-underline">
        {supportEmail}
      </a>
      .
    </Text>

    <Text className="text-black text-[14px] leading-[24px]">
      Best regards,
      <br />
      The {companyName} Team
    </Text>
  </BaseEmailTemplate>
);

export default OTPVerificationTemplate;
