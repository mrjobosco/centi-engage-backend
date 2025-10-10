import { Button, Hr, Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmailTemplate } from './base-email.template';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  category: string;
  createdAt: string;
  url?: string;
}

export interface NotificationDigestTemplateProps {
  firstName: string;
  notifications: NotificationItem[];
  digestPeriod: string; // e.g., "daily", "weekly"
  dashboardUrl: string;
  unsubscribeUrl: string;
  companyName?: string;
  companyLogo?: string;
}

const getTypeColor = (type: NotificationItem['type']) => {
  switch (type) {
    case 'error':
      return 'text-red-600';
    case 'warning':
      return 'text-yellow-600';
    case 'success':
      return 'text-green-600';
    case 'info':
    default:
      return 'text-blue-600';
  }
};

const getTypeIcon = (type: NotificationItem['type']) => {
  switch (type) {
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'success':
      return '✅';
    case 'info':
    default:
      return 'ℹ️';
  }
};

export const NotificationDigestTemplate = ({
  firstName,
  notifications,
  digestPeriod,
  dashboardUrl,
  unsubscribeUrl,
  companyName = 'Your Company',
  companyLogo,
}: NotificationDigestTemplateProps) => (
  <BaseEmailTemplate
    previewText={`Your ${digestPeriod} notification digest - ${notifications.length} new notifications`}
    title={`Your ${digestPeriod} notification digest`}
    companyName={companyName}
    companyLogo={companyLogo}
    footerText={`© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}
    unsubscribeUrl={unsubscribeUrl}
  >
    <Text className="text-black text-[14px] leading-[24px]">
      Hello {firstName},
    </Text>
    <Text className="text-black text-[14px] leading-[24px]">
      Here's your {digestPeriod} summary of notifications. You have{' '}
      <strong>{notifications.length}</strong> new notification
      {notifications.length !== 1 ? 's' : ''}.
    </Text>

    {notifications.length > 0 ? (
      <>
        <Section className="mt-[24px]">
          {notifications.map((notification, index) => (
            <div key={notification.id}>
              <Section className="border border-solid border-[#eaeaea] rounded p-[16px] mb-[16px]">
                <Text className="text-black text-[16px] font-semibold leading-[24px] m-0 mb-[8px]">
                  <span className="mr-2">{getTypeIcon(notification.type)}</span>
                  {notification.title}
                </Text>
                <Text
                  className={`text-[12px] font-medium uppercase tracking-wide mb-[8px] m-0 ${getTypeColor(notification.type)}`}
                >
                  {notification.type} • {notification.category}
                </Text>
                <Text className="text-gray-600 text-[14px] leading-[20px] m-0 mb-[8px]">
                  {notification.message}
                </Text>
                <Text className="text-gray-400 text-[12px] leading-[16px] m-0">
                  {new Date(notification.createdAt).toLocaleDateString(
                    'en-US',
                    {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    },
                  )}
                </Text>
                {notification.url && (
                  <Section className="mt-[12px]">
                    <Button
                      className="bg-[#f4f4f4] border border-solid border-[#eaeaea] rounded text-black text-[12px] font-medium no-underline text-center px-3 py-2"
                      href={notification.url}
                    >
                      View Details
                    </Button>
                  </Section>
                )}
              </Section>
              {index < notifications.length - 1 && (
                <Hr className="border border-solid border-[#eaeaea] my-[16px]" />
              )}
            </div>
          ))}
        </Section>

        <Section className="text-center mt-[32px] mb-[32px]">
          <Button
            className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
            href={dashboardUrl}
          >
            View All Notifications
          </Button>
        </Section>
      </>
    ) : (
      <Section className="text-center mt-[32px] mb-[32px] p-[24px] bg-[#f9f9f9] rounded">
        <Text className="text-gray-600 text-[14px] leading-[24px] m-0">
          🎉 You're all caught up! No new notifications this {digestPeriod}.
        </Text>
      </Section>
    )}

    <Text className="text-black text-[14px] leading-[24px]">
      You can manage your notification preferences and view all notifications in
      your dashboard.
    </Text>
    <Text className="text-black text-[14px] leading-[24px]">
      Best regards,
      <br />
      The {companyName} Team
    </Text>
  </BaseEmailTemplate>
);

export default NotificationDigestTemplate;
