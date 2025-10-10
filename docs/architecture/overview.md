# System Architecture Overview

This document provides a comprehensive overview of the multi-tenant NestJS application architecture, explaining the design decisions, patterns, and implementation details that make this system scalable, secure, and maintainable.

## 🏗️ High-Level Architecture

The application follows a layered architecture with clear separation of concerns:

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Applications]
        API[API Clients]
        MOBILE[Mobile Apps]
        WEBSOCKET[WebSocket Clients]
    end

    subgraph "API Gateway Layer"
        GATEWAY[NestJS Application]
        AUTH[Authentication Middleware]
        TENANT[Tenant Identification]
        RATELIMIT[Rate Limiting]
        VALIDATION[Request Validation]
    end

    subgraph "Business Logic Layer"
        subgraph "Core Modules"
            USER[User Management]
            ROLE[Role Management]
            PERM[Permission System]
            PROJ[Project Management]
        end
        
        subgraph "Advanced Features"
            NOTIF[Notification System]
            AUDIT[Audit Logging]
            METRICS[Metrics Collection]
        end
    end

    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        MIDDLEWARE[Tenant Middleware]
        DB[(PostgreSQL)]
    end

    subgraph "Infrastructure Layer"
        REDIS[(Redis Cache)]
        QUEUE[BullMQ Queues]
        PROMETHEUS[Prometheus Metrics]
    end

    subgraph "External Services"
        GOOGLE[Google OAuth]
        EMAIL[Email Providers]
        SMS[SMS Providers]
        SLACK[Slack Webhooks]
    end

    WEB --> GATEWAY
    API --> GATEWAY
    MOBILE --> GATEWAY
    WEBSOCKET --> GATEWAY

    GATEWAY --> AUTH
    AUTH --> TENANT
    TENANT --> RATELIMIT
    RATELIMIT --> VALIDATION

    VALIDATION --> USER
    VALIDATION --> ROLE
    VALIDATION --> PERM
    VALIDATION --> PROJ
    VALIDATION --> NOTIF
    VALIDATION --> AUDIT

    USER --> PRISMA
    ROLE --> PRISMA
    PERM --> PRISMA
    PROJ --> PRISMA
    NOTIF --> PRISMA
    AUDIT --> PRISMA

    PRISMA --> MIDDLEWARE
    MIDDLEWARE --> DB

    NOTIF --> REDIS
    NOTIF --> QUEUE
    QUEUE --> EMAIL
    QUEUE --> SMS
    
    METRICS --> PROMETHEUS
    NOTIF --> SLACK
    
    AUTH --> GOOGLE

    classDef client fill:#e1f5fe
    classDef gateway fill:#f3e5f5
    classDef business fill:#e8f5e8
    classDef data fill:#fff3e0
    classDef infra fill:#fce4ec
    classDef external fill:#ffebee

    class WEB,API,MOBILE,WEBSOCKET client
    class GATEWAY,AUTH,TENANT,RATELIMIT,VALIDATION gateway
    class USER,ROLE,PERM,PROJ,NOTIF,AUDIT,METRICS business
    class PRISMA,MIDDLEWARE,DB data
    class REDIS,QUEUE,PROMETHEUS infra
    class GOOGLE,EMAIL,SMS,SLACK external
```

## 🏢 Multi-Tenant Architecture

### Design Pattern: Shared Database, Shared Schema

The application implements a **shared database, shared schema** multi-tenancy pattern, which provides:

- **Resource Efficiency**: All tenants share the same database instance and schema
- **Cost Effectiveness**: Lower operational costs compared to database-per-tenant
- **Simplified Management**: Single database to maintain, backup, and scale
- **Easy Scaling**: Horizontal scaling through read replicas and connection pooling

### Tenant Isolation Layers

```mermaid
sequenceDiagram
    participant Client
    participant Middleware
    participant TenantContext
    participant PrismaMiddleware
    participant Database

    Client->>Middleware: Request with x-tenant-id header
    Middleware->>TenantContext: Store tenant ID in request scope
    TenantContext->>PrismaMiddleware: Provide tenant context
    PrismaMiddleware->>Database: Add WHERE tenantId = ? to all queries
    Database-->>PrismaMiddleware: Return tenant-scoped results
    PrismaMiddleware-->>TenantContext: Filtered data
    TenantContext-->>Middleware: Response
    Middleware-->>Client: Tenant-isolated response
```

#### Layer 1: Request Identification
- **Header-based**: `x-tenant-id` header in requests
- **Subdomain-based**: Extract tenant from subdomain (optional)
- **JWT-based**: Tenant ID embedded in JWT token

#### Layer 2: Context Management
- **Request-scoped storage**: Tenant context stored per request
- **Dependency injection**: Tenant context available throughout request lifecycle
- **Validation**: Ensures tenant exists and is active

#### Layer 3: Database Middleware
- **Automatic scoping**: Prisma middleware adds `tenantId` filters to all queries
- **Query interception**: Intercepts and modifies queries before execution
- **Transparent operation**: Business logic doesn't need tenant-aware code

#### Layer 4: API Response Filtering
- **404 for cross-tenant access**: Returns 404 instead of 403 to prevent information leakage
- **Data sanitization**: Removes sensitive tenant information from responses
- **Audit logging**: Logs all cross-tenant access attempts

### Tenant Data Model

```typescript
// Core tenant isolation pattern
interface TenantScoped {
  tenantId: string;
  // ... other fields
}

// All tenant-scoped entities extend this
interface User extends TenantScoped {
  id: string;
  email: string;
  // ... user fields
}
```

## 🔧 Module Structure

### Core Module Architecture

Each module follows a consistent structure:

```
src/[module]/
├── [module].module.ts          # Module definition and dependencies
├── [module].controller.ts      # HTTP endpoints and request handling
├── [module].service.ts         # Business logic and data operations
├── dto/                        # Data Transfer Objects
│   ├── create-[entity].dto.ts
│   ├── update-[entity].dto.ts
│   └── [entity]-filter.dto.ts
├── guards/                     # Module-specific guards
├── decorators/                 # Custom decorators
└── interfaces/                 # TypeScript interfaces
```

### Module Dependencies

```mermaid
graph TD
    APP[App Module] --> AUTH[Auth Module]
    APP --> TENANT[Tenant Module]
    APP --> DATABASE[Database Module]
    APP --> COMMON[Common Module]
    
    AUTH --> DATABASE
    AUTH --> TENANT
    
    USER[User Module] --> AUTH
    USER --> DATABASE
    USER --> TENANT
    
    ROLE[Role Module] --> AUTH
    ROLE --> DATABASE
    ROLE --> TENANT
    
    PERM[Permission Module] --> AUTH
    PERM --> DATABASE
    PERM --> TENANT
    
    PROJ[Project Module] --> AUTH
    PROJ --> DATABASE
    PROJ --> TENANT
    PROJ --> USER
    
    NOTIF[Notification Module] --> AUTH
    NOTIF --> DATABASE
    NOTIF --> TENANT
    NOTIF --> USER
    NOTIF --> QUEUE[Queue Module]
    
    QUEUE --> REDIS[Redis Module]
    
    classDef core fill:#e8f5e8
    classDef business fill:#e1f5fe
    classDef infra fill:#fff3e0
    
    class APP,AUTH,TENANT,DATABASE,COMMON core
    class USER,ROLE,PERM,PROJ,NOTIF business
    class QUEUE,REDIS infra
```

### Dependency Injection Pattern

The application uses NestJS's powerful dependency injection system:

```typescript
@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly notificationService: NotificationService,
  ) {}
  
  async createUser(data: CreateUserDto): Promise<User> {
    const tenantId = this.tenantContext.getTenantId();
    // Business logic here - tenantId automatically applied by Prisma middleware
    return this.prisma.user.create({ data: { ...data, tenantId } });
  }
}
```

## 🔄 Data Flow Patterns

### Request Processing Flow

```mermaid
sequenceDiagram
    participant Client
    participant Controller
    participant Guard
    participant Service
    participant Prisma
    participant Database

    Client->>Controller: HTTP Request
    Controller->>Guard: Authorization Check
    Guard->>Guard: Validate JWT & Permissions
    Guard-->>Controller: Authorization Result
    
    alt Authorized
        Controller->>Service: Business Logic Call
        Service->>Prisma: Database Operation
        Prisma->>Database: SQL Query (with tenant filter)
        Database-->>Prisma: Results
        Prisma-->>Service: Mapped Data
        Service-->>Controller: Business Result
        Controller-->>Client: HTTP Response
    else Unauthorized
        Controller-->>Client: 401/403 Response
    end
```

### Notification Processing Flow

```mermaid
sequenceDiagram
    participant API
    participant NotificationService
    participant Queue
    participant Processor
    participant Provider
    participant External

    API->>NotificationService: Send Notification Request
    NotificationService->>NotificationService: Validate & Apply Preferences
    NotificationService->>Queue: Add to Processing Queue
    Queue-->>API: Queued Response
    
    Queue->>Processor: Process Job
    Processor->>Provider: Format & Send
    Provider->>External: API Call
    External-->>Provider: Delivery Status
    Provider-->>Processor: Result
    Processor->>NotificationService: Update Status
    NotificationService->>Database: Log Delivery
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant AuthController
    participant AuthService
    participant Google
    participant Database
    participant JWT

    Client->>AuthController: Login Request
    AuthController->>AuthService: Validate Credentials
    
    alt Standard Login
        AuthService->>Database: Verify User
        Database-->>AuthService: User Data
    else Google OAuth
        AuthService->>Google: Verify OAuth Token
        Google-->>AuthService: User Profile
        AuthService->>Database: Find/Create User
        Database-->>AuthService: User Data
    end
    
    AuthService->>JWT: Generate Token
    JWT-->>AuthService: JWT Token
    AuthService-->>AuthController: Auth Result
    AuthController-->>Client: Token Response
```

## 🛡️ Security Architecture

### Multi-Layer Security Model

```mermaid
graph TB
    subgraph "Security Layers"
        L1[Layer 1: Network Security]
        L2[Layer 2: Application Security]
        L3[Layer 3: Authentication]
        L4[Layer 4: Authorization]
        L5[Layer 5: Data Security]
        L6[Layer 6: Audit & Monitoring]
    end

    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
    L5 --> L6

    subgraph "Implementation"
        HTTPS[HTTPS/TLS]
        HELMET[Helmet.js]
        CORS[CORS Policy]
        RATELIMIT[Rate Limiting]
        JWT[JWT Tokens]
        OAUTH[OAuth 2.0]
        RBAC[RBAC System]
        PERMISSIONS[Permission Checks]
        ENCRYPTION[Data Encryption]
        ISOLATION[Tenant Isolation]
        LOGGING[Audit Logging]
        MONITORING[Security Monitoring]
    end

    L1 -.-> HTTPS
    L2 -.-> HELMET
    L2 -.-> CORS
    L2 -.-> RATELIMIT
    L3 -.-> JWT
    L3 -.-> OAUTH
    L4 -.-> RBAC
    L4 -.-> PERMISSIONS
    L5 -.-> ENCRYPTION
    L5 -.-> ISOLATION
    L6 -.-> LOGGING
    L6 -.-> MONITORING
```

### Permission System Architecture

```mermaid
graph LR
    subgraph "Permission Sources"
        ROLES[User Roles]
        DIRECT[Direct Permissions]
    end

    subgraph "Permission Resolution"
        RESOLVER[Permission Resolver]
        CACHE[Permission Cache]
    end

    subgraph "Authorization"
        GUARD[Permission Guard]
        DECORATOR[Permission Decorator]
    end

    ROLES --> RESOLVER
    DIRECT --> RESOLVER
    RESOLVER --> CACHE
    CACHE --> GUARD
    DECORATOR --> GUARD

    classDef source fill:#e8f5e8
    classDef resolution fill:#e1f5fe
    classDef auth fill:#fff3e0

    class ROLES,DIRECT source
    class RESOLVER,CACHE resolution
    class GUARD,DECORATOR auth
```

### Rate Limiting Architecture

```mermaid
graph TB
    subgraph "Rate Limiting Layers"
        GLOBAL[Global Rate Limit]
        TENANT[Tenant Rate Limit]
        USER[User Rate Limit]
        ENDPOINT[Endpoint Rate Limit]
    end

    subgraph "Implementation"
        REDIS[Redis Store]
        SLIDING[Sliding Window]
        BYPASS[Admin Bypass]
    end

    REQUEST[Incoming Request] --> GLOBAL
    GLOBAL --> TENANT
    TENANT --> USER
    USER --> ENDPOINT
    ENDPOINT --> ALLOWED[Request Allowed]

    GLOBAL -.-> REDIS
    TENANT -.-> REDIS
    USER -.-> REDIS
    ENDPOINT -.-> REDIS

    REDIS -.-> SLIDING
    SLIDING -.-> BYPASS

    classDef limit fill:#ffebee
    classDef impl fill:#e8f5e8
    classDef flow fill:#e1f5fe

    class GLOBAL,TENANT,USER,ENDPOINT limit
    class REDIS,SLIDING,BYPASS impl
    class REQUEST,ALLOWED flow
```

## 📊 Performance Considerations

### Database Optimization

- **Connection Pooling**: Prisma connection pooling for efficient database connections
- **Query Optimization**: Automatic tenant filtering reduces query complexity
- **Indexing Strategy**: Composite indexes on `(tenantId, id)` for optimal performance
- **Read Replicas**: Support for read replica routing for read-heavy workloads

### Caching Strategy

- **Redis Caching**: Permission caching and rate limiting data
- **Application Caching**: In-memory caching for frequently accessed data
- **Query Result Caching**: Prisma query result caching for repeated queries

### Scalability Patterns

- **Horizontal Scaling**: Stateless application design enables horizontal scaling
- **Queue Processing**: Background job processing for non-blocking operations
- **Microservice Ready**: Modular architecture supports microservice extraction

## 🔍 Monitoring & Observability

### Metrics Collection

```mermaid
graph LR
    subgraph "Application Metrics"
        HTTP[HTTP Metrics]
        DB[Database Metrics]
        QUEUE[Queue Metrics]
        CUSTOM[Custom Metrics]
    end

    subgraph "Collection"
        PROMETHEUS[Prometheus]
        GRAFANA[Grafana]
    end

    subgraph "Alerting"
        ALERTS[Alert Rules]
        SLACK[Slack Notifications]
        EMAIL[Email Alerts]
    end

    HTTP --> PROMETHEUS
    DB --> PROMETHEUS
    QUEUE --> PROMETHEUS
    CUSTOM --> PROMETHEUS

    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTS

    ALERTS --> SLACK
    ALERTS --> EMAIL

    classDef metrics fill:#e8f5e8
    classDef collection fill:#e1f5fe
    classDef alerting fill:#ffebee

    class HTTP,DB,QUEUE,CUSTOM metrics
    class PROMETHEUS,GRAFANA collection
    class ALERTS,SLACK,EMAIL alerting
```

### Logging Strategy

- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Tenant Context**: All logs include tenant information for debugging
- **Audit Trail**: Complete audit trail for compliance and security
- **Error Tracking**: Comprehensive error logging with stack traces

## 🚀 Deployment Architecture

### Container Strategy

```mermaid
graph TB
    subgraph "Container Orchestration"
        DOCKER[Docker Containers]
        COMPOSE[Docker Compose]
        K8S[Kubernetes Ready]
    end

    subgraph "Application Containers"
        APP[NestJS Application]
        WORKER[Queue Workers]
        CRON[Scheduled Jobs]
    end

    subgraph "Infrastructure Containers"
        POSTGRES[PostgreSQL]
        REDIS[Redis]
        PROMETHEUS[Prometheus]
    end

    DOCKER --> APP
    DOCKER --> WORKER
    DOCKER --> CRON
    DOCKER --> POSTGRES
    DOCKER --> REDIS
    DOCKER --> PROMETHEUS

    COMPOSE --> DOCKER
    K8S --> DOCKER

    classDef orchestration fill:#e8f5e8
    classDef app fill:#e1f5fe
    classDef infra fill:#fff3e0

    class DOCKER,COMPOSE,K8S orchestration
    class APP,WORKER,CRON app
    class POSTGRES,REDIS,PROMETHEUS infra
```

This architecture provides a solid foundation for building scalable, secure, and maintainable multi-tenant SaaS applications while maintaining clear separation of concerns and following industry best practices.