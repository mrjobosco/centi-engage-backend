import { Button, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmailTemplate } from './base-email.template';

export interface InvitationEmailTemplateProps {
  inviteeEmail: string;
  inviterName: string;
  tenantName: string;
  roles: string[];
  invitationUrl: string;
  expiresAt: Date;
  customMessage?: string;
  companyName?: string;
  companyLogo?: string;
  supportEmail?: string;
}

export const InvitationEmailTemplate = ({
  inviteeEmail,
  inviterName,
  tenantName,
  roles,
  invitationUrl,
  expiresAt,
  customMessage,
  companyName = 'Your Company',
  companyLogo,
  supportEmail = 'support@company.com',
}: InvitationEmailTemplateProps) => {
  const formatExpirationDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const formatRoles = (roleList: string[]) => {
    if (roleList.length === 0) return 'Member';
    if (roleList.length === 1) return roleList[0];
    if (roleList.length === 2) return `${roleList[0]} and ${roleList[1]}`;
    return `${roleList.slice(0, -1).join(', ')}, and ${roleList[roleList.length - 1]}`;
  };

  return (
    <BaseEmailTemplate
      previewText={`You've been invited to join ${tenantName}`}
      title={`You're invited to join ${tenantName}!`}
      companyName={companyName}
      companyLogo={companyLogo}
      footerText={`© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}
    >
      <Text className="text-black text-[14px] leading-[24px]">Hello,</Text>
      <Text className="text-black text-[14px] leading-[24px]">
        <strong>{inviterName}</strong> has invited you to join{' '}
        <strong>{tenantName}</strong> on {companyName}. You'll be joining as{' '}
        <strong>{formatRoles(roles)}</strong>.
      </Text>

      {customMessage && (
        <Section className="bg-gray-50 rounded-lg p-4 my-6">
          <Text className="text-black text-[14px] leading-[24px] m-0 italic">
            "{customMessage}"
          </Text>
          <Text className="text-gray-600 text-[12px] leading-[20px] mt-2 m-0">
            — {inviterName}
          </Text>
        </Section>
      )}

      <Section className="text-center mt-[32px] mb-[32px]">
        <Button
          className="bg-[#007ee6] rounded text-white text-[14px] font-semibold no-underline text-center px-8 py-4"
          href={invitationUrl}
        >
          Accept Invitation
        </Button>
      </Section>

      <Text className="text-black text-[14px] leading-[24px]">
        Once you accept this invitation, you'll be able to:
      </Text>
      <Section className="ml-4">
        <Text className="text-black text-[14px] leading-[24px] m-0">
          • Access {tenantName}'s workspace and resources
        </Text>
        <Text className="text-black text-[14px] leading-[24px] m-0">
          • Collaborate with team members
        </Text>
        <Text className="text-black text-[14px] leading-[24px] m-0">
          • Use features based on your assigned role
          {roles.length > 1 ? 's' : ''}
        </Text>
        <Text className="text-black text-[14px] leading-[24px] m-0">
          • Receive notifications and updates
        </Text>
      </Section>

      <Section className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
        <Text className="text-yellow-800 text-[14px] leading-[24px] m-0 font-semibold">
          ⏰ Important: This invitation expires on{' '}
          {formatExpirationDate(expiresAt)}
        </Text>
        <Text className="text-yellow-700 text-[12px] leading-[20px] mt-1 m-0">
          Make sure to accept it before it expires to join the team.
        </Text>
      </Section>

      <Text className="text-black text-[14px] leading-[24px]">
        If you don't recognize {inviterName} or weren't expecting this
        invitation, you can safely ignore this email. The invitation will expire
        automatically.
      </Text>

      <Text className="text-black text-[14px] leading-[24px]">
        Need help? Contact our support team at{' '}
        <a
          href={`mailto:${supportEmail}`}
          className="text-blue-600 no-underline"
        >
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
};

export default InvitationEmailTemplate;
