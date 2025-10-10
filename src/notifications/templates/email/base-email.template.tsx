import React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Tailwind,
} from '@react-email/components';

export interface BaseEmailTemplateProps {
  children: React.ReactNode;
  previewText?: string;
  title?: string;
  companyName?: string;
  companyLogo?: string;
  footerText?: string;
  unsubscribeUrl?: string;
}

export const BaseEmailTemplate: React.FC<BaseEmailTemplateProps> = ({
  children,
  previewText,
  title = 'Notification',
  companyName,
  companyLogo,
  footerText,
  unsubscribeUrl,
}) => {
  return (
    <Html>
      <Head />
      {previewText && (
        <Text
          style={{
            display: 'none',
            overflow: 'hidden',
            lineHeight: '1px',
            opacity: 0,
            maxHeight: 0,
            maxWidth: 0,
          }}
        >
          {previewText}
        </Text>
      )}
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-2xl">
            <Section className="bg-white rounded-lg shadow-lg p-8">
              <Text className="text-2xl font-bold text-gray-800 mb-6">
                {title}
              </Text>
              {children}
              <Section className="mt-8 pt-6 border-t border-gray-200">
                {footerText && (
                  <Text className="text-sm text-gray-600 text-center">
                    {footerText}
                  </Text>
                )}
                <Text className="text-sm text-gray-600 text-center mt-2">
                  If you have any questions, please{' '}
                  <Link
                    href="mailto:support@example.com"
                    className="text-blue-600 underline"
                  >
                    contact support
                  </Link>
                  .
                </Text>
                {unsubscribeUrl && (
                  <Text className="text-sm text-gray-600 text-center mt-2">
                    <Link
                      href={unsubscribeUrl}
                      className="text-gray-500 underline"
                    >
                      Unsubscribe
                    </Link>
                  </Text>
                )}
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default BaseEmailTemplate;
