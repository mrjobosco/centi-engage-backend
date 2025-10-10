# Email Templates

This directory contains React-email templates for the notification system. The templates are built using React components and styled with Tailwind CSS for consistent, responsive email design.

## Available Templates

### 1. Welcome Email Template (`welcome.template.tsx`)

Sent to new users when they join a tenant organization.

**Props:**
- `firstName` (string): User's first name
- `lastName` (string): User's last name
- `tenantName` (string): Name of the tenant organization
- `loginUrl` (string): URL to login page
- `companyName?` (string): Company name (optional, defaults to "Your Company")
- `supportEmail?` (string): Support email address (optional, defaults to "support@company.com")
- `companyLogo?` (string): URL to company logo (optional)

**Usage:**
```typescript
import { renderEmailTemplate } from './template-renderer';

const html = await renderEmailTemplate('welcome', {
  firstName: 'John',
  lastName: 'Doe',
  tenantName: 'Acme Corp',
  loginUrl: 'https://app.example.com/login',
});
```

### 2. Password Reset Template (`password-reset.template.tsx`)

Sent when users request a password reset.

**Props:**
- `firstName` (string): User's first name
- `resetUrl` (string): Password reset URL with token
- `expirationTime` (string): How long the reset link is valid (e.g., "24 hours")
- `supportEmail?` (string): Support email address (optional)
- `companyName?` (string): Company name (optional)
- `companyLogo?` (string): URL to company logo (optional)

**Usage:**
```typescript
const html = await renderEmailTemplate('password-reset', {
  firstName: 'Jane',
  resetUrl: 'https://app.example.com/reset?token=abc123',
  expirationTime: '24 hours',
});
```

### 3. Notification Digest Template (`notification-digest.template.tsx`)

Sent as daily/weekly digest of notifications.

**Props:**
- `firstName` (string): User's first name
- `notifications` (NotificationItem[]): Array of notification objects
- `digestPeriod` (string): Digest frequency (e.g., "daily", "weekly")
- `dashboardUrl` (string): URL to user dashboard
- `unsubscribeUrl` (string): URL to unsubscribe from digests
- `companyName?` (string): Company name (optional)
- `companyLogo?` (string): URL to company logo (optional)

**NotificationItem Interface:**
```typescript
interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  category: string;
  createdAt: string; // ISO date string
  url?: string; // Optional link to notification details
}
```

**Usage:**
```typescript
const html = await renderEmailTemplate('notification-digest', {
  firstName: 'Alice',
  notifications: [
    {
      id: '1',
      title: 'New project created',
      message: 'A new project has been created.',
      type: 'info',
      category: 'project',
      createdAt: new Date().toISOString(),
      url: 'https://app.example.com/projects/1',
    },
  ],
  digestPeriod: 'daily',
  dashboardUrl: 'https://app.example.com/dashboard',
  unsubscribeUrl: 'https://app.example.com/unsubscribe',
});
```

## Base Template

All templates extend the `BaseEmailTemplate` component which provides:
- Consistent layout and styling
- Company branding (logo and name)
- Footer with copyright and unsubscribe link
- Responsive design optimized for email clients

## Template Renderer

The `template-renderer.ts` file provides utility functions:

### `renderEmailTemplate(templateType, props)`
Renders a template to HTML string for email delivery.

### `renderEmailTemplateText(templateType, props)`
Renders a template to plain text for email clients that don't support HTML.

## Styling

Templates use Tailwind CSS classes through the `@react-email/tailwind` component. The styling is optimized for email clients and includes:

- Responsive design
- Email-safe CSS properties
- Consistent color scheme
- Proper spacing and typography
- Cross-client compatibility

## Adding New Templates

To add a new email template:

1. Create a new `.tsx` file in this directory
2. Import React-email components and the `BaseEmailTemplate`
3. Define the props interface
4. Create the template component using JSX
5. Export the component
6. Add it to the `EMAIL_TEMPLATES` registry in `index.ts`
7. Update the `EmailTemplateType` union type
8. Add tests in `templates.spec.ts`

Example:
```typescript
// new-template.template.tsx
import { Text } from '@react-email/components';
import { BaseEmailTemplate } from './base-email.template';

interface NewTemplateProps {
  name: string;
  message: string;
}

export const NewTemplate = ({ name, message }: NewTemplateProps) => (
  <BaseEmailTemplate
    title="New Template"
    preview={`Hello ${name}`}
  >
    <Text>Hello {name}!</Text>
    <Text>{message}</Text>
  </BaseEmailTemplate>
);
```

## Testing

Templates are tested in `templates.spec.ts`. Tests verify:
- Template functions return valid JSX
- Required props are accepted
- Template registry exports work correctly

Run tests with:
```bash
npm test -- --testPathPatterns="templates.spec.ts"
```

## Examples

See `examples.ts` for complete usage examples of all templates with sample data.