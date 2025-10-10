export interface SmsOptions {
  to: string;
  message: string;
  from?: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ISmsProvider {
  send(options: SmsOptions): Promise<SmsResult>;
  getProviderName(): string;
}
