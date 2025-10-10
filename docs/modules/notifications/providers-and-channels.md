# Notification Providers and Channels

## Overview

The notification system supports multiple delivery channels (in-app, email, SMS) with pluggable provider architecture. Each channel can be configured with different external service providers, allowing for flexibility, redundancy, and tenant-specific customization.

## Channel Architecture

### Channel Types

The system supports three primary notification channels:

1. **In-App Notifications**: Real-time notifications delivered via WebSocket
2. **Email Notifications**: Email delivery via various email service providers
3. **SMS Notifications**: SMS delivery via various SMS service providers

### Channel Interface

All channels implement the `INotificationChannel` interface:

```typescript
interface INotificationChannel {
  send(payload: NotificationPayload): Promise<NotificationResult>;
  validate(payload: NotificationPayload): boolean;
  getChannelType(): NotificationChannelType;
  isAvailable(): Promise<boolean>;
}
```

## In-App Channel

### Overview
The in-app channel provides real-time notifications directly within the application interface using WebSocket connections.

### Features
- **Immediate delivery** to connected users
- **Real-time updates** via Socket.IO
- **Unread count tracking** with live updates
- **No external dependencies** (fully self-contained)
- **Automatic persistence** in database

### Configuration
No external configuration required. The channel uses:
- Database for notification persistence
- WebSocket gateway for real-time delivery
- Tenant context for isolation

### Usage Example
```typescript
// In-app notifications are automatically enabled
// No additional setup required
await notificationService.sendToUser(userId, {
  type: NotificationType.INFO,
  category: 'system',
  title: 'Welcome!',
  message: 'Welcome to our platform'
});
```

### WebSocket Events
- `notification`: New notification received
- `unread_count`: Updated unread count
- `mark_as_read`: Mark notification as read

## Email Channel

### Overview
The email channel supports multiple email service providers through a factory pattern, allowing for tenant-specific configuration and provider fallbacks.

### Supported Providers

#### 1. AWS SES (Amazon Simple Email Service)

**Features:**
- High deliverability rates
- Detailed bounce and complaint handling
- Cost-effective for high volumes
- Built-in reputation management

**Configuration:**
```typescript
// Environment variables
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
EMAIL_PROVIDER=aws-ses

// Tenant-specific configuration
{
  provider: 'aws-ses',
  region: 'us-east-1',
  accessKeyId: 'tenant_access_key',
  secretAccessKey: 'tenant_secret_key',
  fromAddress: 'noreply@tenant.com',
  fromName: 'Tenant Name'
}
```

**Setup Guide:**
1. Create AWS account and configure SES
2. Verify sender email addresses/domains
3. Request production access (if needed)
4. Configure IAM user with SES permissions
5. Set environment variables or tenant config

#### 2. Resend

**Features:**
- Developer-friendly API
- Built-in analytics and tracking
- Template management
- Webhook support for delivery events

**Configuration:**
```typescript
// Environment variables
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_your_api_key

// Tenant-specific configuration
{
  provider: 'resend',
  apiKey: 're_tenant_api_key',
  fromAddress: 'noreply@tenant.com',
  fromName: 'Tenant Name'
}
```

**Setup Guide:**
1. Sign up for Resend account
2. Generate API key
3. Verify sender domain
4. Configure environment variables

#### 3. SMTP (Generic)

**Features:**
- Works with any SMTP server
- Fallback option for other providers
- Supports authentication and TLS
- Compatible with Gmail, Outlook, etc.

**Configuration:**
```typescript
// Environment variables
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

// Tenant-specific configuration
{
  provider: 'smtp',
  host: 'smtp.tenant.com',
  port: 587,
  secure: false,
  user: 'noreply@tenant.com',
  password: 'tenant_password'
}
```

**Setup Guide:**
1. Configure SMTP server settings
2. Enable app passwords (for Gmail/Outlook)
3. Test connection with credentials
4. Set environment variables

#### 4. OneSignal

**Features:**
- Multi-channel platform (email, push, SMS)
- Advanced segmentation
- A/B testing capabilities
- Rich analytics dashboard

**Configuration:**
```typescript
// Environment variables
EMAIL_PROVIDER=onesignal
EMAIL_API_KEY=your_api_key
ONESIGNAL_APP_ID=your_app_id

// Tenant-specific configuration
{
  provider: 'onesignal',
  apiKey: 'tenant_api_key',
  appId: 'tenant_app_id',
  fromAddress: 'noreply@tenant.com',
  fromName: 'Tenant Name'
}
```

**Setup Guide:**
1. Create OneSignal account
2. Create new app for email
3. Get API key and App ID
4. Configure sender settings

### Email Provider Factory

The `EmailProviderFactory` handles provider selection and instantiation:

```typescript
@Injectable()
export class EmailProviderFactory {
  createProvider(tenantConfig?: TenantEmailConfig): IEmailProvider {
    // 1. Try tenant-specific configuration
    if (tenantConfig) {
      const provider = this.createProviderFromConfig(tenantConfig);
      if (provider) return provider;
    }
    
    // 2. Fall back to global configuration
    const globalProvider = this.createGlobalProvider();
    if (globalProvider) return globalProvider;
    
    // 3. Final fallback to SMTP
    return this.globalSmtpProvider;
  }
}
```

### Email Template Support

Email providers support template rendering:

```typescript
// Using template ID
await emailChannel.send({
  templateId: 'welcome-email',
  templateVariables: {
    userName: 'John Doe',
    companyName: 'Acme Corp'
  }
});

// Using category-based templates
await emailChannel.send({
  category: 'password-reset',
  templateVariables: {
    resetLink: 'https://app.com/reset?token=...'
  }
});
```

## SMS Channel

### Overview
The SMS channel supports multiple SMS service providers with automatic provider selection based on tenant configuration.

### Supported Providers

#### 1. Twilio

**Features:**
- Global SMS delivery
- High delivery rates
- Detailed delivery tracking
- Two-way messaging support
- Short code and long code support

**Configuration:**
```typescript
// Environment variables
SMS_PROVIDER=twilio
SMS_API_KEY=your_account_sid
SMS_API_SECRET=your_auth_token
SMS_FROM_NUMBER=+1234567890

// Tenant-specific configuration
{
  provider: 'twilio',
  apiKey: 'tenant_account_sid',
  apiSecret: 'tenant_auth_token',
  fromNumber: '+1987654321'
}
```

**Setup Guide:**
1. Create Twilio account
2. Get Account SID and Auth Token
3. Purchase phone number or short code
4. Configure webhook URLs (optional)
5. Set environment variables

#### 2. Termii

**Features:**
- African market focus
- Competitive pricing
- Multiple messaging channels
- Bulk SMS support
- Sender ID customization

**Configuration:**
```typescript
// Environment variables
SMS_PROVIDER=termii
SMS_API_KEY=your_api_key
TERMII_SENDER_ID=YourBrand

// Tenant-specific configuration
{
  provider: 'termii',
  apiKey: 'tenant_api_key',
  senderId: 'TenantBrand'
}
```

**Setup Guide:**
1. Create Termii account
2. Get API key from dashboard
3. Register sender ID
4. Fund account for SMS credits
5. Configure environment variables

### SMS Provider Factory

The `SmsProviderFactory` handles provider selection:

```typescript
@Injectable()
export class SmsProviderFactory {
  async createProvider(tenantId?: string): Promise<ISmsProvider> {
    // 1. Try tenant-specific configuration
    let config = null;
    if (tenantId) {
      config = await this.getTenantSmsConfig(tenantId);
    }
    
    // 2. Fall back to global configuration
    if (!config) {
      config = this.getGlobalSmsConfig();
    }
    
    if (!config) {
      throw new Error('No SMS provider configuration found');
    }
    
    return this.createProviderInstance(config);
  }
}
```

### SMS Message Processing

SMS messages undergo automatic processing:

1. **HTML Removal**: Strip HTML tags from content
2. **Entity Decoding**: Convert HTML entities to text
3. **Whitespace Normalization**: Clean up spacing
4. **Length Validation**: Truncate if exceeding SMS limits
5. **Phone Number Formatting**: Normalize phone numbers

```typescript
private prepareSmsContent(message: string): string {
  // Remove HTML tags
  let cleanMessage = message.replace(/<[^>]*>/g, '');
  
  // Replace HTML entities
  cleanMessage = cleanMessage
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Normalize whitespace
  cleanMessage = cleanMessage.replace(/\s+/g, ' ').trim();
  
  // Truncate if too long (150 characters for safety)
  const maxLength = 150;
  if (cleanMessage.length > maxLength) {
    cleanMessage = cleanMessage.substring(0, maxLength - 3) + '...';
  }
  
  return cleanMessage;
}
```

## Provider Configuration Management

### Tenant-Specific Configuration

Tenants can configure their own providers via the database:

```sql
-- Tenant notification configuration table
CREATE TABLE tenant_notification_config (
  tenant_id VARCHAR(255) PRIMARY KEY,
  
  -- Email configuration
  email_provider VARCHAR(50),
  email_api_key TEXT,
  email_api_secret TEXT,
  email_from_address VARCHAR(255),
  email_from_name VARCHAR(255),
  
  -- SMS configuration
  sms_provider VARCHAR(50),
  sms_api_key TEXT,
  sms_api_secret TEXT,
  sms_from_number VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Configuration Priority

The system follows this configuration priority:

1. **Tenant-specific configuration** (highest priority)
2. **Global environment configuration**
3. **Default fallback providers** (SMTP for email)

### Configuration Validation

All provider configurations are validated before use:

```typescript
// Email provider validation
validateEmailConfig(config: TenantEmailConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!config.provider) {
    errors.push('Provider type is required');
  }
  
  switch (config.provider) {
    case 'aws-ses':
      if (!config.region) errors.push('Region required for AWS SES');
      if (!config.accessKeyId) errors.push('Access Key ID required');
      if (!config.secretAccessKey) errors.push('Secret Access Key required');
      break;
      
    case 'resend':
      if (!config.apiKey) errors.push('API key required for Resend');
      break;
      
    // ... other providers
  }
  
  return { valid: errors.length === 0, errors };
}
```

## Custom Provider Implementation

### Creating a Custom Email Provider

To add a new email provider:

1. **Implement the interface:**
```typescript
export class CustomEmailProvider implements IEmailProvider {
  async send(options: EmailOptions): Promise<EmailResult> {
    // Implementation here
  }
  
  getProviderName(): string {
    return 'custom-email';
  }
}
```

2. **Add to factory:**
```typescript
// In EmailProviderFactory
case 'custom-email':
  return new CustomEmailProvider(config.apiKey);
```

3. **Update configuration types:**
```typescript
export interface TenantEmailConfig {
  provider: 'resend' | 'aws-ses' | 'onesignal' | 'smtp' | 'custom-email';
  // ... other fields
}
```

### Creating a Custom SMS Provider

Similar process for SMS providers:

```typescript
export class CustomSmsProvider implements ISmsProvider {
  async send(options: SmsOptions): Promise<SmsResult> {
    // Implementation here
  }
  
  getProviderName(): string {
    return 'custom-sms';
  }
}
```

## Error Handling and Fallbacks

### Provider Error Handling

Each provider implements comprehensive error handling:

```typescript
async send(options: EmailOptions): Promise<EmailResult> {
  try {
    // Attempt to send
    const result = await this.externalService.send(options);
    return { success: true, messageId: result.id };
  } catch (error) {
    // Log error details
    this.logger.error(`Provider error: ${error.message}`);
    
    // Return structured error
    return {
      success: false,
      error: this.extractErrorMessage(error)
    };
  }
}
```

### Fallback Strategies

The system implements several fallback strategies:

1. **Provider Fallback**: If tenant provider fails, fall back to global
2. **Channel Fallback**: If email fails, notification still succeeds via other channels
3. **Queue Retry**: Failed jobs are automatically retried with exponential backoff
4. **Dead Letter Queue**: Permanently failed jobs are moved for manual review

## Monitoring and Health Checks

### Provider Health Monitoring

Each provider can implement health checks:

```typescript
// SMTP provider health check
async verifyConnection(): Promise<boolean> {
  try {
    await this.transporter.verify();
    return true;
  } catch (error) {
    this.logger.error('SMTP connection failed', error);
    return false;
  }
}
```

### Provider Metrics

The system collects metrics for each provider:

- **Delivery success rate**
- **Average response time**
- **Error rate by error type**
- **Volume by time period**

### Provider Switching

Providers can be switched without downtime:

1. **Update configuration** in database or environment
2. **New notifications** use the new provider
3. **Existing queue jobs** complete with old provider
4. **Monitor metrics** to ensure successful transition

## Best Practices

### Provider Selection
- **Use AWS SES** for high-volume, cost-effective email
- **Use Resend** for developer-friendly email with analytics
- **Use SMTP** as a reliable fallback option
- **Use Twilio** for global SMS with high reliability
- **Use Termii** for African markets with competitive pricing

### Configuration Management
- **Store sensitive credentials** securely (encrypted at rest)
- **Use environment variables** for global configuration
- **Implement configuration validation** before deployment
- **Monitor provider health** continuously
- **Have fallback providers** configured

### Performance Optimization
- **Use connection pooling** for SMTP providers
- **Implement caching** for provider instances
- **Monitor rate limits** and implement backoff
- **Use async processing** for all external calls

### Security Considerations
- **Encrypt API keys** in database storage
- **Use IAM roles** instead of access keys where possible
- **Implement proper error handling** to avoid credential leakage
- **Monitor for suspicious activity** across providers
- **Rotate credentials** regularly

This provider and channel system provides a flexible, scalable foundation for multi-channel notification delivery while maintaining security, reliability, and observability.