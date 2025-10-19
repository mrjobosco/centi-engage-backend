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
export {
  OTPVerificationTemplate,
  type OTPVerificationTemplateProps,
} from './otp-verification.template';

import { WelcomeEmailTemplate } from './welcome.template';
import { NotificationDigestTemplate } from './notification-digest.template';
import { PasswordResetTemplate } from './password-reset.template';
import { InvitationEmailTemplate } from './invitation.template';
import { OTPVerificationTemplate } from './otp-verification.template';

// Template registry for easy lookup
export const EMAIL_TEMPLATES = {
  welcome: WelcomeEmailTemplate,
  'notification-digest': NotificationDigestTemplate,
  'password-reset': PasswordResetTemplate,
  'tenant-invitation': InvitationEmailTemplate,
  'otp-verification': OTPVerificationTemplate,
} as const;

export type EmailTemplateType = keyof typeof EMAIL_TEMPLATES;
