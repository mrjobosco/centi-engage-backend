export { BaseEmailTemplate } from './base-email.template';
export {
  WelcomeEmailTemplate,
  type WelcomeEmailTemplateProps,
} from './welcome.template';
export {
  NotificationDigestTemplate,
  type NotificationDigestTemplateProps,
} from './notification-digest.template';
export {
  PasswordResetTemplate,
  type PasswordResetTemplateProps,
} from './password-reset.template';
export {
  InvitationEmailTemplate,
  type InvitationEmailTemplateProps,
} from './invitation.template';

import { WelcomeEmailTemplate } from './welcome.template';
import { NotificationDigestTemplate } from './notification-digest.template';
import { PasswordResetTemplate } from './password-reset.template';
import { InvitationEmailTemplate } from './invitation.template';

// Template registry for easy lookup
export const EMAIL_TEMPLATES = {
  welcome: WelcomeEmailTemplate,
  'notification-digest': NotificationDigestTemplate,
  'password-reset': PasswordResetTemplate,
  'tenant-invitation': InvitationEmailTemplate,
} as const;

export type EmailTemplateType = keyof typeof EMAIL_TEMPLATES;
