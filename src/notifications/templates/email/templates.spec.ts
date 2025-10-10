import { WelcomeEmailTemplate } from './welcome.template';
import { NotificationDigestTemplate } from './notification-digest.template';
import { PasswordResetTemplate } from './password-reset.template';
import { EMAIL_TEMPLATES, EmailTemplateType } from './index';

describe('Email Templates', () => {
  describe('WelcomeEmailTemplate', () => {
    it('should be a function that returns JSX', () => {
      const props = {
        firstName: 'John',
        lastName: 'Doe',
        companyName: 'Test Company',
        tenantName: 'Test Tenant',
        loginUrl: 'https://example.com/login',
        supportEmail: 'support@example.com',
      };

      const result = WelcomeEmailTemplate(props);

      expect(typeof WelcomeEmailTemplate).toBe('function');
      expect(result).toBeDefined();
      expect(result.type).toBeDefined(); // JSX element should have a type property
    });

    it('should accept required props', () => {
      const props = {
        firstName: 'John',
        lastName: 'Doe',
        tenantName: 'Test Tenant',
        loginUrl: 'https://example.com/login',
      };

      expect(() => WelcomeEmailTemplate(props)).not.toThrow();
    });
  });

  describe('NotificationDigestTemplate', () => {
    it('should be a function that returns JSX', () => {
      const props = {
        firstName: 'Jane',
        notifications: [
          {
            id: '1',
            title: 'Test Notification',
            message: 'This is a test notification',
            type: 'info' as const,
            category: 'system',
            createdAt: new Date().toISOString(),
            url: 'https://example.com/notification/1',
          },
        ],
        digestPeriod: 'daily',
        dashboardUrl: 'https://example.com/dashboard',
        unsubscribeUrl: 'https://example.com/unsubscribe',
      };

      const result = NotificationDigestTemplate(props);

      expect(typeof NotificationDigestTemplate).toBe('function');
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });

    it('should handle empty notifications array', () => {
      const props = {
        firstName: 'Jane',
        notifications: [],
        digestPeriod: 'weekly',
        dashboardUrl: 'https://example.com/dashboard',
        unsubscribeUrl: 'https://example.com/unsubscribe',
      };

      expect(() => NotificationDigestTemplate(props)).not.toThrow();
    });
  });

  describe('PasswordResetTemplate', () => {
    it('should be a function that returns JSX', () => {
      const props = {
        firstName: 'Bob',
        resetUrl: 'https://example.com/reset-password?token=abc123',
        expirationTime: '24 hours',
        supportEmail: 'help@example.com',
        companyName: 'Test Corp',
      };

      const result = PasswordResetTemplate(props);

      expect(typeof PasswordResetTemplate).toBe('function');
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
    });

    it('should accept required props', () => {
      const props = {
        firstName: 'Bob',
        resetUrl: 'https://example.com/reset-password?token=abc123',
        expirationTime: '24 hours',
      };

      expect(() => PasswordResetTemplate(props)).not.toThrow();
    });
  });

  describe('Template Registry', () => {
    it('should export EMAIL_TEMPLATES with correct template functions', () => {
      expect(EMAIL_TEMPLATES).toBeDefined();
      expect(EMAIL_TEMPLATES.welcome).toBe(WelcomeEmailTemplate);
      expect(EMAIL_TEMPLATES['notification-digest']).toBe(
        NotificationDigestTemplate,
      );
      expect(EMAIL_TEMPLATES['password-reset']).toBe(PasswordResetTemplate);
    });

    it('should have correct template types', () => {
      const templateTypes: EmailTemplateType[] = [
        'welcome',
        'notification-digest',
        'password-reset',
      ];

      templateTypes.forEach((type) => {
        expect(EMAIL_TEMPLATES[type]).toBeDefined();
        expect(typeof EMAIL_TEMPLATES[type]).toBe('function');
      });
    });
  });
});
