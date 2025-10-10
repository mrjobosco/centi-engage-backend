/**
 * Example usage of email templates
 * This file demonstrates how to use the React-email templates
 */

import {
  renderEmailTemplate,
  renderEmailTemplateText,
} from './template-renderer';

// Example: Welcome email
export async function createWelcomeEmail() {
  const welcomeProps = {
    firstName: 'John',
    lastName: 'Doe',
    companyName: 'Acme Corp',
    tenantName: 'Acme Organization',
    loginUrl: 'https://app.acme.com/login',
    supportEmail: 'support@acme.com',
    companyLogo: 'https://app.acme.com/logo.png',
  };

  const html = await renderEmailTemplate('welcome', welcomeProps);
  const text = await renderEmailTemplateText('welcome', welcomeProps);

  return { html, text };
}

// Example: Password reset email
export async function createPasswordResetEmail() {
  const resetProps = {
    firstName: 'Jane',
    resetUrl: 'https://app.acme.com/reset-password?token=abc123xyz',
    expirationTime: '24 hours',
    supportEmail: 'help@acme.com',
    companyName: 'Acme Corp',
    companyLogo: 'https://app.acme.com/logo.png',
  };

  const html = await renderEmailTemplate('password-reset', resetProps);
  const text = await renderEmailTemplateText('password-reset', resetProps);

  return { html, text };
}

// Example: Notification digest email
export async function createNotificationDigestEmail() {
  const digestProps = {
    firstName: 'Alice',
    notifications: [
      {
        id: '1',
        title: 'New project created',
        message:
          'A new project "Website Redesign" has been created in your organization.',
        type: 'info' as const,
        category: 'project',
        createdAt: new Date('2024-01-15T10:30:00Z').toISOString(),
        url: 'https://app.acme.com/projects/1',
      },
      {
        id: '2',
        title: 'Payment failed',
        message:
          'Your payment method was declined. Please update your billing information.',
        type: 'error' as const,
        category: 'billing',
        createdAt: new Date('2024-01-15T14:45:00Z').toISOString(),
        url: 'https://app.acme.com/billing',
      },
      {
        id: '3',
        title: 'User invitation accepted',
        message: 'John Smith has accepted your invitation and joined the team.',
        type: 'success' as const,
        category: 'user_activity',
        createdAt: new Date('2024-01-15T16:20:00Z').toISOString(),
      },
    ],
    digestPeriod: 'daily',
    dashboardUrl: 'https://app.acme.com/dashboard',
    unsubscribeUrl: 'https://app.acme.com/unsubscribe?token=xyz789',
    companyName: 'Acme Corp',
    companyLogo: 'https://app.acme.com/logo.png',
  };

  const html = await renderEmailTemplate('notification-digest', digestProps);
  const text = await renderEmailTemplateText(
    'notification-digest',
    digestProps,
  );

  return { html, text };
}

// Example: Empty notification digest
export async function createEmptyNotificationDigestEmail() {
  const emptyDigestProps = {
    firstName: 'Bob',
    notifications: [],
    digestPeriod: 'weekly',
    dashboardUrl: 'https://app.acme.com/dashboard',
    unsubscribeUrl: 'https://app.acme.com/unsubscribe?token=abc456',
    companyName: 'Acme Corp',
    companyLogo: 'https://app.acme.com/logo.png',
  };

  const html = await renderEmailTemplate(
    'notification-digest',
    emptyDigestProps,
  );
  const text = await renderEmailTemplateText(
    'notification-digest',
    emptyDigestProps,
  );

  return { html, text };
}
