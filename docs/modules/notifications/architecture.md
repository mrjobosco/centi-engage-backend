# Notification System Architecture

## System Overview

The notification system is designed as a distributed, event-driven architecture that provides reliable, scalable notification delivery across multiple channels. The system emphasizes fault tolerance, observability, and multi-tenant isolation.

## Architectural Principles

### 1. Separation of Concerns
- **API Layer**: Request handling and validation
- **Service Layer**: Business logic and orchestration
- **Channel Layer**: Delivery mechanism abstraction
- **Provider Layer**: External service integration
- **Infrastructure Layer**: Data persistence and messaging

### 2. Asynchronous Processing
- Non-blocking notification creation
- Queue-based delivery for reliability
- Background processing for external API calls
- Real-time updates via WebSocket

### 3. Multi-Tenant Isolation
- Complete data separation between tenants
- Tenant-specific configuration and preferences
- Isolated rate limiting and monitoring
- Secure context propagation

### 4. Fault Tolerance
- Graceful degradation on provider failures
- Retry mechanisms with exponential backoff
- Circuit breaker patterns for external services
- Partial failure handling

## Core Architecture Components

### Notification Service (Orchestrator)

The `NotificationService` acts as the central orchestrator for all notification operations.

```mermaid
graph TD
    A[Notification Request] --> B[NotificationService]
    B --> C[Validate Payload]
    C --> D[Load User Preferences]
    D --> E[Determine Enabled Channels]
    E --> F[Create Notification Record]
    F --> G[Send Through Channels]
    G --> H[Update Delivery Status]
    H --> I[Record Metrics]
```

**Key Responsibilities:**
- Request validation and sanitization
- User preference resolution
- Channel coordination and orchestration
- Failure handling and partial success management
- Metrics collection and audit logging

**Flow Details:**
1. **Validation**: Ensures payload completeness and tenant context
2. **Preference Loading**: Retrieves user's channel preferences for the category
3. **Channel Selection**: Filters available channels based on preferences
4. **Record Creation**: Creates notification record in database
5. **Channel Delivery**: Sends through each enabled channel independently
6. **Status Updates**: Updates notification with successful channels
7. **Metrics Recording**: Records success/failure metrics per channel

### Channel Architecture

The channel system implements a pluggable architecture where each channel type implements the `INotificationChannel` interface.

```mermaid
classDiagram
    class INotificationChannel {
        <<interface>>
        +send(payload) Promise~NotificationResult~
        +validate(payload) boolean
        +getChannelType() NotificationChannelType
        +isAvailable() Promise~boolean~
    }
    
    class BaseChannel {
        <<abstract>>
        #logger Logger
        +validate(payload) boolean
        +isAvailable() Promise~boolean~
        #createSuccessResult() NotificationResult
        #createFailureResult() NotificationResult
        #logNotificationAttempt()
        #logNotificationSuccess()
        #logNotificationFailure()
    }
    
    class InAppChannelService {
        +send(payload) Promise~NotificationResult~
        +getChannelType() NotificationChannelType
        +isAvailable() Promise~boolean~
    }
    
    class EmailChannelService {
        +send(payload) Promise~NotificationResult~
        +getChannelType() NotificationChannelType
        +isAvailable() Promise~boolean~
    }
    
    class SmsChannelService {
        +send(payload) Promise~NotificationResult~
        +getChannelType() NotificationChannelType
        +isAvailable() Promise~boolean~
    }
    
    INotificationChannel <|-- BaseChannel
    BaseChannel <|-- InAppChannelService
    BaseChannel <|-- EmailChannelService
    BaseChannel <|-- SmsChannelService
```

#### In-App Channel
- **Synchronous delivery** to database
- **Real-time WebSocket** emission
- **Immediate feedback** on success/failure
- **No external dependencies**

#### Email Channel
- **Asynchronous delivery** via queue
- **Template rendering** support
- **Provider abstraction** for multiple email services
- **Retry mechanisms** for failed deliveries

#### SMS Channel
- **Asynchronous delivery** via queue
- **Message formatting** and length validation
- **Phone number normalization**
- **Provider abstraction** for multiple SMS services

### Queue Processing Architecture

The system uses BullMQ for reliable, asynchronous processing of email and SMS notifications.

```mermaid
sequenceDiagram
    participant C as Channel Service
    participant Q as Queue Service
    participant R as Redis
    participant P as Queue Processor
    participant EP as External Provider
    participant DB as Database
    
    C->>Q: Add Job to Queue
    Q->>R: Store Job Data
    R-->>Q: Job Stored
    Q-->>C: Job Queued
    
    Note over P: Background Processing
    P->>R: Poll for Jobs
    R->>P: Return Job
    P->>DB: Create Delivery Log
    P->>EP: Send Notification
    EP-->>P: Delivery Result
    P->>DB: Update Delivery Status
    P->>R: Mark Job Complete
```

**Queue Features:**
- **Priority-based processing** based on notification priority
- **Automatic retry** with exponential backoff
- **Dead letter queues** for failed jobs
- **Job deduplication** to prevent duplicates
- **Monitoring and metrics** for queue health

#### Email Queue Processor

```typescript
@Processor(QUEUE_NAMES.EMAIL_NOTIFICATIONS)
export class EmailQueueProcessor extends WorkerHost {
  async process(job: Job<EmailJobData>): Promise<void> {
    // 1. Set tenant context
    // 2. Load tenant email configuration
    // 3. Get email provider instance
    // 4. Prepare email content (template rendering)
    // 5. Send via provider
    // 6. Update delivery log
    // 7. Record metrics
  }
}
```

**Processing Steps:**
1. **Context Setup**: Establish tenant context for the job
2. **Configuration Loading**: Load tenant-specific email settings
3. **Provider Selection**: Get appropriate email provider
4. **Content Preparation**: Render templates or format plain text
5. **Delivery Attempt**: Send via external provider
6. **Status Recording**: Update delivery log with results
7. **Metrics Collection**: Record timing and success/failure metrics

#### SMS Queue Processor

Similar to email processing but with SMS-specific handling:
- **Message length validation** and truncation
- **Phone number formatting** and validation
- **Provider-specific configuration** loading
- **Delivery status tracking**

### Provider System Architecture

The provider system abstracts external service integration through factory patterns.

```mermaid
graph TD
    A[Channel Service] --> B[Provider Factory]
    B --> C{Tenant Config?}
    C -->|Yes| D[Load Tenant Config]
    C -->|No| E[Use Global Config]
    D --> F[Create Provider Instance]
    E --> F
    F --> G[Provider Interface]
    
    subgraph "Email Providers"
        H[AWS SES Provider]
        I[Resend Provider]
        J[SMTP Provider]
        K[OneSignal Provider]
    end
    
    subgraph "SMS Providers"
        L[Twilio Provider]
        M[Termii Provider]
    end
    
    G --> H
    G --> I
    G --> J
    G --> K
    G --> L
    G --> M
```

**Provider Features:**
- **Unified interface** across different services
- **Configuration abstraction** for different provider requirements
- **Error handling standardization**
- **Metrics collection** per provider
- **Health checking** and availability monitoring

### Real-Time Communication Architecture

WebSocket-based real-time notifications use Socket.IO for reliable bi-directional communication.

```mermaid
sequenceDiagram
    participant U as User Browser
    participant G as WebSocket Gateway
    participant A as Auth Service
    participant N as Notification Service
    participant DB as Database
    
    U->>G: Connect with JWT
    G->>A: Validate JWT
    A-->>G: User Info
    G->>G: Join User Room
    
    Note over N: Notification Created
    N->>G: Emit to User Room
    G->>U: Real-time Notification
    
    U->>G: Mark as Read
    G->>DB: Update Read Status
    G->>U: Updated Unread Count
```

**WebSocket Features:**
- **JWT-based authentication** for secure connections
- **Room-based messaging** for user isolation
- **Automatic reconnection** handling
- **Unread count updates** in real-time
- **Connection state management**

## Data Flow Architecture

### Notification Creation Flow

```mermaid
flowchart TD
    A[API Request] --> B[Controller]
    B --> C[Validation Guards]
    C --> D[NotificationService]
    D --> E[Tenant Context Check]
    E --> F[Load User Preferences]
    F --> G[Filter Enabled Channels]
    G --> H[Create Notification Record]
    H --> I{For Each Channel}
    
    I --> J[In-App Channel]
    I --> K[Email Channel]
    I --> L[SMS Channel]
    
    J --> M[Direct DB Insert]
    J --> N[WebSocket Emit]
    
    K --> O[Queue Email Job]
    L --> P[Queue SMS Job]
    
    O --> Q[Email Processor]
    P --> R[SMS Processor]
    
    Q --> S[Email Provider]
    R --> T[SMS Provider]
    
    M --> U[Update Notification]
    N --> U
    S --> V[Update Delivery Log]
    T --> V
    
    U --> W[Record Metrics]
    V --> W
    W --> X[Response]
```

### Preference Resolution Flow

```mermaid
flowchart TD
    A[User ID + Category] --> B[Load User Preferences]
    B --> C{Preferences Exist?}
    C -->|Yes| D[Get Category Preferences]
    C -->|No| E[Use Default Preferences]
    D --> F{Category Specific?}
    F -->|Yes| G[Return Category Channels]
    F -->|No| H[Return Global Channels]
    E --> I[Return Default Channels]
    G --> J[Filter Available Channels]
    H --> J
    I --> J
    J --> K[Return Enabled Channels]
```

## Security Architecture

### Multi-Tenant Isolation

```mermaid
graph TD
    A[Request] --> B[Tenant Identification]
    B --> C[Tenant Context Service]
    C --> D[Prisma Middleware]
    D --> E[Query Filtering]
    E --> F[Tenant-Scoped Data]
    
    subgraph "Tenant A Data"
        G[Notifications A]
        H[Preferences A]
        I[Templates A]
    end
    
    subgraph "Tenant B Data"
        J[Notifications B]
        K[Preferences B]
        L[Templates B]
    end
    
    F --> G
    F --> H
    F --> I
```

**Isolation Mechanisms:**
- **Middleware-level filtering** in Prisma queries
- **Context propagation** through request lifecycle
- **Queue job isolation** with tenant ID
- **WebSocket room separation** by tenant

### Rate Limiting Architecture

```mermaid
graph TD
    A[Request] --> B[Rate Limit Guard]
    B --> C{Check Tenant Limit}
    C -->|Exceeded| D[Reject Request]
    C -->|OK| E{Check User Limit}
    E -->|Exceeded| F[Reject Request]
    E -->|OK| G{Check Category Limit}
    G -->|Exceeded| H[Reject Request]
    G -->|OK| I[Process Request]
    
    B --> J[Redis Rate Store]
    J --> K[Sliding Window Counter]
```

**Rate Limiting Levels:**
- **Global limits** across all tenants
- **Tenant-specific limits** per tenant
- **User-specific limits** per user
- **Category-specific limits** per notification type

## Monitoring and Observability Architecture

### Metrics Collection

```mermaid
graph TD
    A[Notification Events] --> B[Metrics Service]
    B --> C[Prometheus Metrics]
    B --> D[Custom Metrics Store]
    
    C --> E[Grafana Dashboard]
    D --> F[Admin Dashboard]
    
    subgraph "Metrics Types"
        G[Delivery Rates]
        H[Processing Times]
        I[Error Rates]
        J[Queue Depths]
        K[Provider Performance]
    end
    
    B --> G
    B --> H
    B --> I
    B --> J
    B --> K
```

### Logging Architecture

```mermaid
graph TD
    A[Application Events] --> B[Structured Logger]
    B --> C[Log Aggregation]
    C --> D[Search & Analysis]
    
    subgraph "Log Types"
        E[Audit Logs]
        F[Error Logs]
        G[Performance Logs]
        H[Security Logs]
    end
    
    B --> E
    B --> F
    B --> G
    B --> H
```

## Scalability Considerations

### Horizontal Scaling

- **Stateless services** for easy horizontal scaling
- **Queue-based processing** for load distribution
- **Database connection pooling** for efficient resource usage
- **Redis clustering** for cache scalability

### Performance Optimization

- **Connection pooling** for database and external services
- **Caching strategies** for frequently accessed data
- **Batch processing** for bulk operations
- **Lazy loading** for optional data

### Resource Management

- **Memory-efficient processing** with streaming where possible
- **Connection limits** to prevent resource exhaustion
- **Graceful degradation** under high load
- **Circuit breakers** for external service protection

## Deployment Architecture

The notification system is designed to be deployed as part of a larger NestJS application with the following considerations:

- **Module isolation** for independent deployment
- **Configuration externalization** via environment variables
- **Health check endpoints** for load balancer integration
- **Graceful shutdown** handling for queue processing
- **Database migration** support for schema updates

This architecture provides a robust, scalable foundation for notification delivery while maintaining security, observability, and multi-tenant isolation requirements.