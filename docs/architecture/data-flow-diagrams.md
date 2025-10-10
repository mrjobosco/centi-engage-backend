# Data Flow Diagrams and Process Flows

This document provides detailed data flow diagrams for key processes in the multi-tenant NestJS application, helping developers understand how data moves through the system and how different components interact.

## 🔄 Core Data Flow Patterns

### Request Processing Pipeline

```mermaid
flowchart TD
    START([HTTP Request]) --> MIDDLEWARE{Middleware Chain}
    
    MIDDLEWARE --> CORS[CORS Check]
    CORS --> HELMET[Security Headers]
    HELMET --> RATELIMIT[Rate Limiting]
    RATELIMIT --> TENANT[Tenant Identification]
    TENANT --> AUTH[Authentication]
    AUTH --> VALIDATION[Request Validation]
    
    VALIDATION --> CONTROLLER[Controller Handler]
    CONTROLLER --> GUARD[Authorization Guard]
    GUARD --> SERVICE[Business Service]
    SERVICE --> PRISMA[Prisma ORM]
    PRISMA --> MIDDLEWARE_DB[Tenant Middleware]
    MIDDLEWARE_DB --> DATABASE[(Database)]
    
    DATABASE --> RESPONSE_CHAIN[Response Chain]
    RESPONSE_CHAIN --> INTERCEPTOR[Response Interceptor]
    INTERCEPTOR --> SANITIZE[Data Sanitization]
    SANITIZE --> END([HTTP Response])
    
    %% Error handling
    MIDDLEWARE --> ERROR[Error Handler]
    GUARD --> ERROR
    SERVICE --> ERROR
    PRISMA --> ERROR
    ERROR --> ERROR_RESPONSE[Error Response]
    ERROR_RESPONSE --> END
    
    classDef middleware fill:#e8f5e8
    classDef business fill:#e1f5fe
    classDef data fill:#fff3e0
    classDef error fill:#ffebee
    
    class CORS,HELMET,RATELIMIT,TENANT,AUTH,VALIDATION middleware
    class CONTROLLER,GUARD,SERVICE business
    class PRISMA,MIDDLEWARE_DB,DATABASE data
    class ERROR,ERROR_RESPONSE error
```

### Tenant Isolation Data Flow

```mermaid
sequenceDiagram
    participant Client
    participant TenantMiddleware
    participant TenantContext
    participant Controller
    participant Service
    participant PrismaMiddleware
    participant Database

    Client->>TenantMiddleware: Request with x-tenant-id
    TenantMiddleware->>TenantContext: Store tenant ID
    TenantContext->>TenantMiddleware: Context created
    TenantMiddleware->>Controller: Forward request
    
    Controller->>Service: Business logic call
    Service->>PrismaMiddleware: Database query
    
    Note over PrismaMiddleware: Automatically inject tenantId filter
    PrismaMiddleware->>Database: SELECT * FROM table WHERE tenantId = ?
    Database-->>PrismaMiddleware: Tenant-scoped results
    PrismaMiddleware-->>Service: Filtered data
    Service-->>Controller: Business result
    Controller-->>Client: Response (tenant-isolated)
    
    Note over Client,Database: All data automatically scoped to tenant
```

## 🔐 Authentication and Authorization Flows

### JWT Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant UserService
    participant Database
    participant JWTService

    Client->>AuthController: POST /auth/login
    AuthController->>AuthService: login(credentials)
    AuthService->>UserService: validateUser(email, password)
    UserService->>Database: findUser(email)
    Database-->>UserService: User data
    UserService->>UserService: Compare password hash
    UserService-->>AuthService: User validation result
    
    alt Valid credentials
        AuthService->>JWTService: generateToken(user)
        JWTService-->>AuthService: JWT token
        AuthService-->>AuthController: { access_token, user }
        AuthController-->>Client: 200 OK with token
    else Invalid credentials
        AuthService-->>AuthController: Unauthorized error
        AuthController-->>Client: 401 Unauthorized
    end
```

### Google OAuth Flow

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant GoogleAuthService
    participant GoogleAPI
    participant UserService
    participant Database
    participant JWTService

    Client->>AuthController: POST /auth/google/callback
    AuthController->>GoogleAuthService: handleCallback(code)
    GoogleAuthService->>GoogleAPI: Exchange code for tokens
    GoogleAPI-->>GoogleAuthService: Access token + user info
    
    GoogleAuthService->>UserService: findOrCreateUser(googleProfile)
    UserService->>Database: Find user by Google ID
    
    alt User exists
        Database-->>UserService: Existing user
    else New user
        UserService->>Database: Create new user
        Database-->>UserService: New user created
    end
    
    UserService-->>GoogleAuthService: User data
    GoogleAuthService->>JWTService: generateToken(user)
    JWTService-->>GoogleAuthService: JWT token
    GoogleAuthService-->>AuthController: { access_token, user }
    AuthController-->>Client: 200 OK with token
```

### Permission Resolution Flow

```mermaid
flowchart TD
    START([Permission Check Request]) --> GET_USER[Get User Data]
    GET_USER --> GET_ROLES[Get User Roles]
    GET_ROLES --> GET_ROLE_PERMS[Get Role Permissions]
    GET_ROLE_PERMS --> GET_DIRECT_PERMS[Get Direct User Permissions]
    
    GET_DIRECT_PERMS --> MERGE[Merge Permissions]
    MERGE --> CACHE_CHECK{Cache Available?}
    
    CACHE_CHECK -->|Yes| CACHE_HIT[Return Cached Permissions]
    CACHE_CHECK -->|No| CACHE_MISS[Cache Permissions]
    CACHE_MISS --> RETURN_PERMS[Return Effective Permissions]
    CACHE_HIT --> RETURN_PERMS
    
    RETURN_PERMS --> PERMISSION_CHECK{Required Permission?}
    PERMISSION_CHECK -->|Has Permission| ALLOW[Allow Access]
    PERMISSION_CHECK -->|No Permission| DENY[Deny Access]
    
    ALLOW --> SUCCESS([Access Granted])
    DENY --> FORBIDDEN([403 Forbidden])
    
    classDef process fill:#e8f5e8
    classDef decision fill:#e1f5fe
    classDef result fill:#fff3e0
    classDef error fill:#ffebee
    
    class GET_USER,GET_ROLES,GET_ROLE_PERMS,GET_DIRECT_PERMS,MERGE,CACHE_MISS process
    class CACHE_CHECK,PERMISSION_CHECK decision
    class CACHE_HIT,RETURN_PERMS,ALLOW result
    class DENY,FORBIDDEN error
```

## 📧 Notification System Data Flows

### Notification Creation and Processing

```mermaid
flowchart TD
    START([Notification Request]) --> VALIDATE[Validate Request]
    VALIDATE --> CHECK_PREFS[Check User Preferences]
    CHECK_PREFS --> FILTER_CHANNELS[Filter Enabled Channels]
    
    FILTER_CHANNELS --> CREATE_RECORD[Create Notification Record]
    CREATE_RECORD --> QUEUE_JOBS[Queue Processing Jobs]
    
    QUEUE_JOBS --> EMAIL_QUEUE[Email Queue]
    QUEUE_JOBS --> SMS_QUEUE[SMS Queue]
    QUEUE_JOBS --> INAPP_QUEUE[In-App Queue]
    QUEUE_JOBS --> WEBSOCKET[WebSocket Broadcast]
    
    EMAIL_QUEUE --> EMAIL_PROCESSOR[Email Processor]
    SMS_QUEUE --> SMS_PROCESSOR[SMS Processor]
    INAPP_QUEUE --> INAPP_PROCESSOR[In-App Processor]
    
    EMAIL_PROCESSOR --> EMAIL_PROVIDER[Email Provider]
    SMS_PROCESSOR --> SMS_PROVIDER[SMS Provider]
    INAPP_PROCESSOR --> DATABASE_UPDATE[Update Database]
    
    EMAIL_PROVIDER --> EMAIL_RESULT[Email Result]
    SMS_PROVIDER --> SMS_RESULT[SMS Result]
    DATABASE_UPDATE --> INAPP_RESULT[In-App Result]
    
    EMAIL_RESULT --> LOG_DELIVERY[Log Delivery Status]
    SMS_RESULT --> LOG_DELIVERY
    INAPP_RESULT --> LOG_DELIVERY
    
    LOG_DELIVERY --> UPDATE_METRICS[Update Metrics]
    UPDATE_METRICS --> END([Process Complete])
    
    classDef validation fill:#e8f5e8
    classDef processing fill:#e1f5fe
    classDef delivery fill:#fff3e0
    classDef logging fill:#f3e5f5
    
    class VALIDATE,CHECK_PREFS,FILTER_CHANNELS validation
    class CREATE_RECORD,QUEUE_JOBS,EMAIL_QUEUE,SMS_QUEUE,INAPP_QUEUE processing
    class EMAIL_PROCESSOR,SMS_PROCESSOR,INAPP_PROCESSOR,EMAIL_PROVIDER,SMS_PROVIDER delivery
    class LOG_DELIVERY,UPDATE_METRICS logging
```

### Real-time Notification Flow

```mermaid
sequenceDiagram
    participant API
    participant NotificationService
    participant WebSocketGateway
    participant Client
    participant Database
    participant Queue

    API->>NotificationService: Send notification
    NotificationService->>Database: Create notification record
    Database-->>NotificationService: Notification created
    
    par Async Processing
        NotificationService->>Queue: Queue for email/SMS
        Queue-->>NotificationService: Queued
    and Real-time Delivery
        NotificationService->>WebSocketGateway: Broadcast notification
        WebSocketGateway->>Client: Real-time notification
        Client-->>WebSocketGateway: Acknowledgment
    end
    
    NotificationService-->>API: Notification sent
    
    Note over Queue: Background processing continues
    Queue->>Queue: Process email/SMS jobs
```

### Notification Preference Flow

```mermaid
flowchart TD
    START([Notification Trigger]) --> GET_USER[Get Target User]
    GET_USER --> GET_PREFS[Get User Preferences]
    
    GET_PREFS --> CHECK_GLOBAL{Global Notifications Enabled?}
    CHECK_GLOBAL -->|No| SKIP[Skip All Notifications]
    CHECK_GLOBAL -->|Yes| CHECK_CATEGORY{Category Enabled?}
    
    CHECK_CATEGORY -->|No| SKIP
    CHECK_CATEGORY -->|Yes| CHECK_CHANNELS[Check Channel Preferences]
    
    CHECK_CHANNELS --> EMAIL_CHECK{Email Enabled?}
    CHECK_CHANNELS --> SMS_CHECK{SMS Enabled?}
    CHECK_CHANNELS --> INAPP_CHECK{In-App Enabled?}
    
    EMAIL_CHECK -->|Yes| EMAIL_QUEUE[Queue Email]
    SMS_CHECK -->|Yes| SMS_QUEUE[Queue SMS]
    INAPP_CHECK -->|Yes| INAPP_QUEUE[Queue In-App]
    
    EMAIL_CHECK -->|No| EMAIL_SKIP[Skip Email]
    SMS_CHECK -->|No| SMS_SKIP[Skip SMS]
    INAPP_CHECK -->|No| INAPP_SKIP[Skip In-App]
    
    EMAIL_QUEUE --> PROCESS[Process Notifications]
    SMS_QUEUE --> PROCESS
    INAPP_QUEUE --> PROCESS
    EMAIL_SKIP --> PROCESS
    SMS_SKIP --> PROCESS
    INAPP_SKIP --> PROCESS
    SKIP --> END([No Notifications Sent])
    
    PROCESS --> END([Notifications Processed])
    
    classDef decision fill:#e1f5fe
    classDef process fill:#e8f5e8
    classDef skip fill:#ffebee
    classDef queue fill:#fff3e0
    
    class CHECK_GLOBAL,CHECK_CATEGORY,EMAIL_CHECK,SMS_CHECK,INAPP_CHECK decision
    class GET_USER,GET_PREFS,CHECK_CHANNELS,PROCESS process
    class SKIP,EMAIL_SKIP,SMS_SKIP,INAPP_SKIP skip
    class EMAIL_QUEUE,SMS_QUEUE,INAPP_QUEUE queue
```

## 👥 User Management Data Flows

### User Registration Flow

```mermaid
sequenceDiagram
    participant Client
    participant TenantController
    participant TenantService
    participant UserService
    participant AuthService
    participant Database
    participant NotificationService

    Client->>TenantController: POST /tenants (register)
    TenantController->>TenantService: createTenant(data)
    
    TenantService->>Database: Begin transaction
    TenantService->>Database: Create tenant
    Database-->>TenantService: Tenant created
    
    TenantService->>UserService: createAdminUser(tenantId, userData)
    UserService->>AuthService: hashPassword(password)
    AuthService-->>UserService: Hashed password
    UserService->>Database: Create admin user
    Database-->>UserService: User created
    
    TenantService->>Database: Commit transaction
    Database-->>TenantService: Transaction committed
    
    TenantService->>NotificationService: Send welcome notification
    NotificationService-->>TenantService: Notification queued
    
    TenantService-->>TenantController: { tenant, user }
    TenantController-->>Client: 201 Created
    
    Note over Database: All operations are atomic
```

### Role Assignment Flow

```mermaid
flowchart TD
    START([Assign Role Request]) --> VALIDATE_USER[Validate User Exists]
    VALIDATE_USER --> VALIDATE_ROLE[Validate Role Exists]
    VALIDATE_ROLE --> CHECK_TENANT[Check Same Tenant]
    
    CHECK_TENANT --> CHECK_PERMS{Has Permission?}
    CHECK_PERMS -->|No| FORBIDDEN[403 Forbidden]
    CHECK_PERMS -->|Yes| CHECK_EXISTING[Check Existing Assignment]
    
    CHECK_EXISTING --> EXISTING{Already Assigned?}
    EXISTING -->|Yes| CONFLICT[409 Conflict]
    EXISTING -->|No| CREATE_ASSIGNMENT[Create Role Assignment]
    
    CREATE_ASSIGNMENT --> UPDATE_CACHE[Update Permission Cache]
    UPDATE_CACHE --> LOG_AUDIT[Log Audit Event]
    LOG_AUDIT --> NOTIFY_USER[Notify User (Optional)]
    NOTIFY_USER --> SUCCESS[200 Success]
    
    FORBIDDEN --> END([Request Failed])
    CONFLICT --> END
    SUCCESS --> END([Request Complete])
    
    classDef validation fill:#e8f5e8
    classDef decision fill:#e1f5fe
    classDef success fill:#e8f5e8
    classDef error fill:#ffebee
    
    class VALIDATE_USER,VALIDATE_ROLE,CHECK_TENANT,CHECK_EXISTING validation
    class CHECK_PERMS,EXISTING decision
    class CREATE_ASSIGNMENT,UPDATE_CACHE,LOG_AUDIT,NOTIFY_USER,SUCCESS success
    class FORBIDDEN,CONFLICT error
```

## 🔄 Queue Processing Data Flows

### Background Job Processing

```mermaid
sequenceDiagram
    participant API
    participant Service
    participant Queue
    participant Worker
    participant ExternalAPI
    participant Database

    API->>Service: Trigger background job
    Service->>Queue: Add job to queue
    Queue-->>Service: Job queued
    Service-->>API: Immediate response
    
    Note over Queue,Worker: Asynchronous processing
    
    Queue->>Worker: Process job
    Worker->>ExternalAPI: External API call
    ExternalAPI-->>Worker: API response
    
    alt Success
        Worker->>Database: Update job status (completed)
        Worker->>Queue: Job completed
    else Failure
        Worker->>Database: Update job status (failed)
        Worker->>Queue: Job failed (retry or dead letter)
    end
    
    Queue-->>Worker: Acknowledgment
```

### Queue Monitoring Flow

```mermaid
flowchart TD
    START([Queue Monitoring]) --> COLLECT_METRICS[Collect Queue Metrics]
    COLLECT_METRICS --> CHECK_DEPTH{Queue Depth > Threshold?}
    CHECK_DEPTH -->|No| CHECK_FAILURES{Failure Rate > Threshold?}
    CHECK_DEPTH -->|Yes| DEPTH_ALERT[Send Depth Alert]
    
    CHECK_FAILURES -->|No| CHECK_PROCESSING{Processing Time > Threshold?}
    CHECK_FAILURES -->|Yes| FAILURE_ALERT[Send Failure Alert]
    
    CHECK_PROCESSING -->|No| UPDATE_DASHBOARD[Update Monitoring Dashboard]
    CHECK_PROCESSING -->|Yes| PERFORMANCE_ALERT[Send Performance Alert]
    
    DEPTH_ALERT --> SEND_NOTIFICATIONS[Send Alert Notifications]
    FAILURE_ALERT --> SEND_NOTIFICATIONS
    PERFORMANCE_ALERT --> SEND_NOTIFICATIONS
    
    SEND_NOTIFICATIONS --> EMAIL_ALERT[Email Alert]
    SEND_NOTIFICATIONS --> SLACK_ALERT[Slack Alert]
    
    EMAIL_ALERT --> UPDATE_DASHBOARD
    SLACK_ALERT --> UPDATE_DASHBOARD
    UPDATE_DASHBOARD --> WAIT[Wait for Next Check]
    WAIT --> START
    
    classDef monitoring fill:#e8f5e8
    classDef decision fill:#e1f5fe
    classDef alert fill:#ffebee
    classDef notification fill:#fff3e0
    
    class COLLECT_METRICS,UPDATE_DASHBOARD monitoring
    class CHECK_DEPTH,CHECK_FAILURES,CHECK_PROCESSING decision
    class DEPTH_ALERT,FAILURE_ALERT,PERFORMANCE_ALERT alert
    class SEND_NOTIFICATIONS,EMAIL_ALERT,SLACK_ALERT notification
```

## 📊 Rate Limiting Data Flow

### Multi-Level Rate Limiting

```mermaid
flowchart TD
    START([Incoming Request]) --> EXTRACT_INFO[Extract Request Info]
    EXTRACT_INFO --> GLOBAL_CHECK[Check Global Rate Limit]
    
    GLOBAL_CHECK --> GLOBAL_OK{Within Global Limit?}
    GLOBAL_OK -->|No| GLOBAL_REJECT[429 - Global Limit Exceeded]
    GLOBAL_OK -->|Yes| TENANT_CHECK[Check Tenant Rate Limit]
    
    TENANT_CHECK --> TENANT_OK{Within Tenant Limit?}
    TENANT_OK -->|No| TENANT_REJECT[429 - Tenant Limit Exceeded]
    TENANT_OK -->|Yes| USER_CHECK[Check User Rate Limit]
    
    USER_CHECK --> USER_OK{Within User Limit?}
    USER_OK -->|No| USER_REJECT[429 - User Limit Exceeded]
    USER_OK -->|Yes| ENDPOINT_CHECK[Check Endpoint Rate Limit]
    
    ENDPOINT_CHECK --> ENDPOINT_OK{Within Endpoint Limit?}
    ENDPOINT_OK -->|No| ENDPOINT_REJECT[429 - Endpoint Limit Exceeded]
    ENDPOINT_OK -->|Yes| ADMIN_CHECK{Is Admin User?}
    
    ADMIN_CHECK -->|Yes| BYPASS[Bypass All Limits]
    ADMIN_CHECK -->|No| UPDATE_COUNTERS[Update Rate Limit Counters]
    
    UPDATE_COUNTERS --> ALLOW[Allow Request]
    BYPASS --> ALLOW
    
    GLOBAL_REJECT --> END([Request Blocked])
    TENANT_REJECT --> END
    USER_REJECT --> END
    ENDPOINT_REJECT --> END
    ALLOW --> CONTINUE([Process Request])
    
    classDef check fill:#e8f5e8
    classDef decision fill:#e1f5fe
    classDef reject fill:#ffebee
    classDef allow fill:#e8f5e8
    
    class EXTRACT_INFO,GLOBAL_CHECK,TENANT_CHECK,USER_CHECK,ENDPOINT_CHECK,UPDATE_COUNTERS check
    class GLOBAL_OK,TENANT_OK,USER_OK,ENDPOINT_OK,ADMIN_CHECK decision
    class GLOBAL_REJECT,TENANT_REJECT,USER_REJECT,ENDPOINT_REJECT reject
    class BYPASS,ALLOW allow
```

## 🔍 Error Handling Data Flow

### Global Exception Handling

```mermaid
flowchart TD
    START([Exception Thrown]) --> CATCH[Global Exception Filter]
    CATCH --> IDENTIFY[Identify Exception Type]
    
    IDENTIFY --> VALIDATION{Validation Error?}
    IDENTIFY --> AUTH{Authentication Error?}
    IDENTIFY --> PERMISSION{Permission Error?}
    IDENTIFY --> BUSINESS{Business Logic Error?}
    IDENTIFY --> SYSTEM{System Error?}
    
    VALIDATION -->|Yes| FORMAT_VALIDATION[Format Validation Response]
    AUTH -->|Yes| FORMAT_AUTH[Format Auth Response]
    PERMISSION -->|Yes| FORMAT_PERMISSION[Format Permission Response]
    BUSINESS -->|Yes| FORMAT_BUSINESS[Format Business Response]
    SYSTEM -->|Yes| FORMAT_SYSTEM[Format System Response]
    
    FORMAT_VALIDATION --> LOG_ERROR[Log Error Details]
    FORMAT_AUTH --> LOG_ERROR
    FORMAT_PERMISSION --> LOG_ERROR
    FORMAT_BUSINESS --> LOG_ERROR
    FORMAT_SYSTEM --> LOG_ERROR
    
    LOG_ERROR --> TENANT_CONTEXT[Add Tenant Context]
    TENANT_CONTEXT --> CORRELATION_ID[Add Correlation ID]
    CORRELATION_ID --> SANITIZE[Sanitize Sensitive Data]
    
    SANITIZE --> METRICS[Update Error Metrics]
    METRICS --> ALERT_CHECK{Critical Error?}
    
    ALERT_CHECK -->|Yes| SEND_ALERT[Send Alert]
    ALERT_CHECK -->|No| RESPONSE[Send Error Response]
    
    SEND_ALERT --> RESPONSE
    RESPONSE --> END([Error Response Sent])
    
    classDef process fill:#e8f5e8
    classDef decision fill:#e1f5fe
    classDef format fill:#fff3e0
    classDef alert fill:#ffebee
    
    class CATCH,IDENTIFY,LOG_ERROR,TENANT_CONTEXT,CORRELATION_ID,SANITIZE,METRICS process
    class VALIDATION,AUTH,PERMISSION,BUSINESS,SYSTEM,ALERT_CHECK decision
    class FORMAT_VALIDATION,FORMAT_AUTH,FORMAT_PERMISSION,FORMAT_BUSINESS,FORMAT_SYSTEM format
    class SEND_ALERT alert
```

These data flow diagrams provide a comprehensive view of how data moves through the multi-tenant NestJS application, helping developers understand the system's behavior and debug issues effectively.