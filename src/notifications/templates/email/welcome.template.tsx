import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmailTemplate } from './base-email.template';

export interface WelcomeEmailTemplateProps {
  firstName: string;
  lastName: string;
  companyName?: string;
  tenantName: string;
  loginUrl: string;
  supportEmail?: string;
  companyLogo?: string;
}

export const WelcomeEmailTemplate = ({
  firstName,
  lastName,
  companyName = 'Your Company',
  tenantName,
  loginUrl,
  supportEmail = 'support@company.com',
  companyLogo,
}: WelcomeEmailTemplateProps) => (
  <BaseEmailTemplate
    previewText={`Welcome to ${tenantName}, ${firstName}!`}
    title={`Welcome to ${tenantName}!`}
    companyName={companyName}
    companyLogo={companyLogo}
    footerText={`© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}
  >
    <Text className="text-black text-[14px] leading-[24px]">
      Hello {firstName} {lastName},
    </Text>
    <Text className="text-black text-[14px] leading-[24px]">
      Welcome to <strong>{tenantName}</strong>! We're excited to have you on
      board. Your account has been successfully created and you can now access
      all the features available to your organization.
    </Text>
    <Section className="text-center mt-[32px] mb-[32px]">
      <Button
        className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
        href={loginUrl}
      >
        Get Started
      </Button>
    </Section>
    <Text className="text-black text-[14px] leading-[24px]">
      Here are some things you can do to get started:
    </Text>
    <Section className="ml-4">
      <Text className="text-black text-[14px] leading-[24px] m-0">
        • Complete your profile setup
      </Text>
      <Text className="text-black text-[14px] leading-[24px] m-0">
        • Explore the dashboard and available features
      </Text>
      <Text className="text-black text-[14px] leading-[24px] m-0">
        • Connect with your team members
      </Text>
      <Text className="text-black text-[14px] leading-[24px] m-0">
        • Set up your notification preferences
      </Text>
    </Section>
    <Text className="text-black text-[14px] leading-[24px] mt-[24px]">
      If you have any questions or need assistance, don't hesitate to reach out
      to our support team at{' '}
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

export default WelcomeEmailTemplate;
