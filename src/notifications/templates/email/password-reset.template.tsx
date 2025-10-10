import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmailTemplate } from './base-email.template';

export interface PasswordResetTemplateProps {
  firstName: string;
  resetUrl: string;
  expirationTime: string; // e.g., "24 hours"
  supportEmail?: string;
  companyName?: string;
  companyLogo?: string;
}

export const PasswordResetTemplate = ({
  firstName,
  resetUrl,
  expirationTime,
  supportEmail = 'support@company.com',
  companyName = 'Your Company',
  companyLogo,
}: PasswordResetTemplateProps) => (
  <BaseEmailTemplate
    previewText="Reset your password"
    title="Reset your password"
    companyName={companyName}
    companyLogo={companyLogo}
    footerText={`© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}
  >
    <Text className="text-black text-[14px] leading-[24px]">
      Hello {firstName},
    </Text>
    <Text className="text-black text-[14px] leading-[24px]">
      We received a request to reset the password for your account. If you made
      this request, click the button below to reset your password.
    </Text>
    <Section className="text-center mt-[32px] mb-[32px]">
      <Button
        className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
        href={resetUrl}
      >
        Reset Password
      </Button>
    </Section>
    <Text className="text-black text-[14px] leading-[24px]">
      This password reset link will expire in <strong>{expirationTime}</strong>.
      If you need a new link, you can request another password reset.
    </Text>
    <Section className="bg-[#f4f4f4] border-l-4 border-solid border-[#fbbf24] p-[16px] mt-[24px] mb-[24px]">
      <Text className="text-black text-[14px] leading-[24px] m-0">
        <strong>⚠️ Security Notice:</strong> If you didn't request this password
        reset, please ignore this email. Your password will remain unchanged.
        For security reasons, we recommend that you don't share this email with
        anyone.
      </Text>
    </Section>
    <Text className="text-black text-[14px] leading-[24px]">
      If the button above doesn't work, you can copy and paste the following
      link into your browser:
    </Text>
    <Text className="text-blue-600 text-[14px] leading-[24px] break-all">
      {resetUrl}
    </Text>
    <Text className="text-black text-[14px] leading-[24px] mt-[24px]">
      If you're having trouble or didn't request this password reset, please
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

export default PasswordResetTemplate;
