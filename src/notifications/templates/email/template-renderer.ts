import { render } from '@react-email/render';
import { EMAIL_TEMPLATES, EmailTemplateType } from './index';

/**
 * Renders an email template to HTML string
 * @param templateType The type of template to render
 * @param props The props to pass to the template component
 * @returns Promise<string> The rendered HTML
 */
export async function renderEmailTemplate<T extends EmailTemplateType>(
  templateType: T,
  props: React.ComponentProps<(typeof EMAIL_TEMPLATES)[T]>,
): Promise<string> {
  const TemplateComponent = EMAIL_TEMPLATES[templateType];

  if (!TemplateComponent) {
    throw new Error(`Template "${templateType}" not found`);
  }

  // @ts-expect-error - TypeScript has trouble with the dynamic component props
  return render(TemplateComponent(props));
}

/**
 * Renders an email template to plain text
 * @param templateType The type of template to render
 * @param props The props to pass to the template component
 * @returns Promise<string> The rendered plain text
 */
export async function renderEmailTemplateText<T extends EmailTemplateType>(
  templateType: T,
  props: React.ComponentProps<(typeof EMAIL_TEMPLATES)[T]>,
): Promise<string> {
  const TemplateComponent = EMAIL_TEMPLATES[templateType];

  if (!TemplateComponent) {
    throw new Error(`Template "${templateType}" not found`);
  }

  // @ts-expect-error - TypeScript has trouble with the dynamic component props
  return render(TemplateComponent(props), { plainText: true });
}
