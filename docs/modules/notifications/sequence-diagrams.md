# Notification System Sequence Diagrams

This document provides detailed sequence diagrams showing the flow of notifications through the system for different scenarios.

## 1. Complete Notification Flow

This diagram shows the end-to-end flow of a notification from creation to delivery across all channels.

```mermaid
sequenceDiagram
    participant Client as Client Application
    participant Controller as NotificationsController
    participant Service as NotificationService
    participant Prefs as PreferenceService
    participant Factory as ChannelFactory
    participant InApp as InAppChannel
    participant Email as EmailChannel
    participant SMS as SmsChannel
    participant Queue as QueueService
    participant DB as Database
    participant WS as WebSocket Gateway
    
    Client->>Controller: POST /notifications
    Controller->>Service: create(payload)
    
    Note over Service: Validate tenant context
    Service->>Prefs: getEnabledChannels(userId, category)
    Prefs->>DB: Query user preferences
    DB-->>Prefs: User preferences
    Prefs-->>Service: [IN_APP, EMAIL, SMS]
    
    Service->>DB: Create notification record
    DB-->>Service: Notification created
    
    Note over Service: Send through each enabled channel
    
    par In-App Channel
        Service->>Factory: getChannel(IN_APP)
        Factory-->>Service: InAppChannel
        Service->>InApp: send(payload)
        InApp->>DB: Create delivery log
        InApp->>WS: emitNotification(userId, data)
        WS-->>Client: Real-time notification
        InApp->>DB: Update delivery status
        InApp-->>Service: Success result
    and Email Channel
        Service->>Factory: getChannel(EMAIL)
        Factory-->>Service: EmailChannel
        Service->>Email: send(payload)
        Email->>DB: Create notification record
        Email->>Queue: addEmailJob(jobData)
        Queue-->>Email: Job queued
        Email-->>Service: Success result
    and SMS Channel
        Service->>Factory: getChannel(SMS)
        Factory-->>Service: SmsChannel
        Service->>SMS: send(payload)
        SMS->>DB: Create notification record
        SMS->>Queue: addSmsJob(jobData)
        Queue-->>SMS: Job queued
        SMS-->>Service: Success result
    end
    
    Service->>DB: Update notification with successful channels
    Service-->>Controller: Notification created
    Controller-->>Client: 201 Created
```

## 2. Email Queue Processing Flow

This diagram shows the detailed flow of email processing through the queue system.

```mermaid
sequenceDiagram
    participant Queue as Email Queue
    participant Processor as EmailQueueProcessor
    participant Factory as EmailProviderFactory
    participant Template as TemplateService
    participant Provider as Email Provider
    participant DB as Database
    participant Metrics as MetricsService
    participant Logger as NotificationLogger
    
    Note over Queue: Background job processing
    Queue->>Processor: process(emailJob)
    
    Processor->>Logger: logQueueProcessing(started)
    Processor->>DB: Create delivery log (PENDING)
    
    Note over Processor: Load tenant configuration
    Processor->>DB: Load tenant email config
    DB-->>Processor: Tenant config
    
    Processor->>Factory: createProvider(tenantConfig)
    Factory-->>Processor: Provider instance
    
    Note over Processor: Prepare email content
    alt Template ID provided
        Processor->>Template: renderEmailTemplate(templateId, variables)
        Template-->>Processor: Rendered content
    else Category template exists
        Processor->>Template: getTemplate(category, EMAIL, tenantId)
        Template-->>Processor: Template found
        Processor->>Template: renderEmailTemplate(templateId, variables)
        Template-->>Processor: Rendered content
    else Plain message
        Processor->>Processor: convertMessageToHtml(message)
    end
    
    Processor->>Logger: logDeliveryAttempt()
    Processor->>Metrics: startProviderTimer()
    
    Processor->>Provider: send(emailData)
    Provider-->>Processor: Delivery result
    
    Processor->>Metrics: endProviderTimer(success)
    Processor->>Logger: logProviderResponse()
    
    alt Delivery successful
        Processor->>DB: Update delivery log (SENT)
        Processor->>Metrics: recordDelivery()
        Processor->>Logger: logDeliverySuccess()
    else Delivery failed
        Processor->>DB: Update delivery log (FAILED)
        Processor->>Metrics: recordFailure()
        Processor->>Logger: logDeliveryFailure()
        Processor->>Queue: Throw error (triggers retry)
    end
    
    Processor->>Logger: logQueueProcessing(completed)
```

## 3. SMS Queue Processing Flow

This diagram shows the SMS processing flow with provider-specific handling.

```mermaid
sequenceDiagram
    participant Queue as SMS Queue
    participant Processor as SmsQueueProcessor
    participant Factory as SmsProviderFactory
    participant Provider as SMS Provider
    participant DB as Database
    participant Metrics as MetricsService
    participant Logger as NotificationLogger
    
    Queue->>Processor: process(smsJob)
    
    Processor->>Logger: logQueueProcessing(started)
    Processor->>DB: Create delivery log (PENDING)
    
    Note over Processor: Get SMS provider
    Processor->>Factory: createProvider(tenantId)
    Factory->>DB: Load tenant SMS config
    DB-->>Factory: Tenant config or null
    Factory-->>Processor: Provider instance
    
    Note over Processor: Prepare SMS content
    Processor->>Processor: prepareSmsContent(message)
    Note right of Processor: - Remove HTML tags<br/>- Normalize whitespace<br/>- Truncate if too long
    
    Processor->>DB: getSenderInfo(tenantId)
    DB-->>Processor: Sender info
    
    Processor->>Processor: formatPhoneNumber(to)
    
    Processor->>Logger: logDeliveryAttempt()
    Processor->>Metrics: startProviderTimer()
    
    Processor->>Provider: send(smsData)
    Provider-->>Processor: Delivery result
    
    Processor->>Metrics: endProviderTimer(success)
    Processor->>Logger: logProviderResponse()
    
    alt Delivery successful
        Processor->>DB: Update delivery log (SENT)
        Processor->>Metrics: recordDelivery()
        Processor->>Logger: logDeliverySuccess()
    else Delivery failed
        Processor->>DB: Update delivery log (FAILED)
        Processor->>Metrics: recordFailure()
        Processor->>Logger: logDeliveryFailure()
        Processor->>Queue: Throw error (triggers retry)
    end
    
    Processor->>Logger: logQueueProcessing(completed)
```

## 4. Real-Time WebSocket Flow

This diagram shows how real-time notifications are delivered via WebSocket.

```mermaid
sequenceDiagram
    participant Client as Client Browser
    participant Gateway as NotificationGateway
    participant Auth as AuthService
    participant Channel as InAppChannel
    participant Service as NotificationService
    participant DB as Database
    
    Note over Client: User connects to WebSocket
    Client->>Gateway: connect(jwt_token)
    Gateway->>Auth: validateToken(jwt)
    Auth-->>Gateway: User info
    Gateway->>Gateway: Join user room
    Gateway-->>Client: Connection established
    
    Note over Service: Notification created elsewhere
    Service->>Channel: send(payload)
    Channel->>DB: Create notification
    DB-->>Channel: Notification created
    
    Channel->>Gateway: emitNotification(userId, notificationData)
    Gateway->>Client: notification event
    
    Channel->>DB: Count unread notifications
    DB-->>Channel: Unread count
    Channel->>Gateway: emitUnreadCount(userId, count)
    Gateway->>Client: unread_count event
    
    Note over Client: User marks notification as read
    Client->>Gateway: mark_as_read event
    Gateway->>Service: markAsRead(notificationId, userId)
    Service->>DB: Update notification
    DB-->>Service: Updated
    Service-->>Gateway: Success
    
    Gateway->>DB: Count unread notifications
    DB-->>Gateway: New unread count
    Gateway->>Client: unread_count event
```

## 5. User Preference Resolution Flow

This diagram shows how user preferences are resolved for notification delivery.

```mermaid
sequenceDiagram
    participant Service as NotificationService
    participant Prefs as PreferenceService
    participant Privacy as PrivacyService
    participant DB as Database
    
    Service->>Prefs: getEnabledChannels(userId, category)
    
    Note over Prefs: Load user preferences
    Prefs->>DB: Find user preferences
    DB-->>Prefs: User preferences or null
    
    alt User has preferences
        Prefs->>Prefs: Extract category preferences
        alt Category-specific preferences exist
            Prefs->>Prefs: Use category channels
        else Global preferences only
            Prefs->>Prefs: Use global channels
        end
    else No user preferences
        Prefs->>Prefs: Use system defaults
        Note right of Prefs: Default: [IN_APP, EMAIL]
    end
    
    Note over Prefs: Apply privacy controls
    Prefs->>Privacy: filterChannelsByConsent(userId, channels)
    Privacy->>DB: Check user consent settings
    DB-->>Privacy: Consent data
    Privacy->>Privacy: Filter channels by consent
    Privacy-->>Prefs: Filtered channels
    
    Note over Prefs: Check channel availability
    loop For each channel
        Prefs->>Prefs: Check if channel is available
        Note right of Prefs: - Service health<br/>- Configuration<br/>- Rate limits
    end
    
    Prefs-->>Service: Final enabled channels
```

## 6. Rate Limiting Flow

This diagram shows how rate limiting is applied at different levels.

```mermaid
sequenceDiagram
    participant Client as Client
    participant Guard as RateLimitGuard
    participant Service as RateLimitingService
    participant Redis as Redis Cache
    participant Controller as Controller
    
    Client->>Guard: Request with tenant/user context
    
    Note over Guard: Check tenant rate limit
    Guard->>Service: checkTenantLimit(tenantId, category)
    Service->>Redis: Get tenant counter
    Redis-->>Service: Current count
    Service->>Service: Check against tenant limit
    
    alt Tenant limit exceeded
        Service-->>Guard: Rate limit exceeded
        Guard-->>Client: 429 Too Many Requests
    else Tenant limit OK
        Service-->>Guard: Tenant limit OK
        
        Note over Guard: Check user rate limit
        Guard->>Service: checkUserLimit(userId, category)
        Service->>Redis: Get user counter
        Redis-->>Service: Current count
        Service->>Service: Check against user limit
        
        alt User limit exceeded
            Service-->>Guard: Rate limit exceeded
            Guard-->>Client: 429 Too Many Requests
        else User limit OK
            Service-->>Guard: User limit OK
            
            Note over Guard: Check category rate limit
            Guard->>Service: checkCategoryLimit(tenantId, category)
            Service->>Redis: Get category counter
            Redis-->>Service: Current count
            Service->>Service: Check against category limit
            
            alt Category limit exceeded
                Service-->>Guard: Rate limit exceeded
                Guard-->>Client: 429 Too Many Requests
            else All limits OK
                Service-->>Guard: All limits OK
                Guard->>Controller: Process request
                Controller-->>Client: Success response
                
                Note over Service: Increment counters
                Service->>Redis: Increment tenant counter
                Service->>Redis: Increment user counter
                Service->>Redis: Increment category counter
            end
        end
    end
```

## 7. Error Handling and Retry Flow

This diagram shows how errors are handled and retries are managed in the queue system.

```mermaid
sequenceDiagram
    participant Queue as BullMQ Queue
    participant Processor as Queue Processor
    participant Provider as External Provider
    participant DB as Database
    participant DLQ as Dead Letter Queue
    participant Alert as Alerting Service
    
    Queue->>Processor: process(job) - Attempt 1
    Processor->>Provider: send(notification)
    Provider-->>Processor: Error (temporary failure)
    
    Processor->>DB: Update delivery log (FAILED)
    Processor->>Queue: Throw error
    
    Note over Queue: Automatic retry with backoff
    Queue->>Queue: Wait (exponential backoff)
    Queue->>Processor: process(job) - Attempt 2
    Processor->>Provider: send(notification)
    Provider-->>Processor: Error (still failing)
    
    Processor->>DB: Update delivery log (FAILED)
    Processor->>Queue: Throw error
    
    Note over Queue: Continue retries...
    Queue->>Queue: Wait (longer backoff)
    Queue->>Processor: process(job) - Final Attempt
    Processor->>Provider: send(notification)
    Provider-->>Processor: Error (permanent failure)
    
    Processor->>DB: Update delivery log (PERMANENTLY_FAILED)
    Processor->>Queue: Throw error
    
    Note over Queue: Max retries exceeded
    Queue->>DLQ: Move job to dead letter queue
    Queue->>Alert: Trigger failure alert
    Alert->>Alert: Send alert to administrators
    
    Note over DLQ: Manual intervention required
```

## 8. Template Rendering Flow

This diagram shows how email templates are processed and rendered.

```mermaid
sequenceDiagram
    participant Processor as EmailQueueProcessor
    participant Template as TemplateService
    participant DB as Database
    participant Renderer as Template Renderer
    participant Cache as Template Cache
    
    Processor->>Template: renderEmailTemplate(templateId, variables)
    
    Template->>Cache: Get cached template
    Cache-->>Template: Template or null
    
    alt Template not in cache
        Template->>DB: Load template by ID
        DB-->>Template: Template data
        Template->>Cache: Cache template
    end
    
    Template->>Template: Validate template variables
    
    alt Required variables missing
        Template-->>Processor: Validation error
    else Variables valid
        Template->>Renderer: render(template, variables)
        
        Note over Renderer: Process template
        Renderer->>Renderer: Replace variables
        Renderer->>Renderer: Apply formatting
        Renderer->>Renderer: Generate HTML/text
        
        Renderer-->>Template: Rendered content
        Template-->>Processor: {html, text, subject}
    end
```

These sequence diagrams provide a comprehensive view of how notifications flow through the system, from initial creation through final delivery, including error handling and retry mechanisms. Each diagram focuses on a specific aspect of the system to show the detailed interactions between components.