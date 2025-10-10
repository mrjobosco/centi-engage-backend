# Authentication Architecture

## Overview

The authentication module implements a comprehensive security architecture that supports multiple authentication methods, role-based access control, and multi-tenant isolation. The architecture is designed for scalability, security, and maintainability.

## Core Architecture Components

### 1. Authentication Layer

```mermaid
graph TB
    subgraph "Authentication Layer"
        AC[AuthController]
        AS[AuthService]
        GAS[GoogleAuthService]
        GOS[GoogleOAuthService]
        OSS[OAuthStateService]
    end
    
    subgraph "Security Layer"
        JAG[JwtAuthGuard]
        PG[PermissionsGuard]
        RLG[RateLimitGuard]
        ALI[AuditLoggingInterceptor]
    end
    
    subgraph "Data Layer"
        PS[PrismaService]
        RS[RedisService]
        TCS[TenantContextService]
    end
    
    AC --> AS
    AC --> GAS
    AC --> GOS
    AC --> OSS
    
    AS --> PS
    GAS --> PS
    OSS --> RS
    
    JAG --> PS
    JAG --> TCS
    PG --> PS
    RLG --> RS
    
    ALI --> AS
```

### 2. Service Architecture

#### AuthService
- **Purpose**: Core authentication logic for password-based authentication
- **Responsibilities**:
  - User credential validation
  - Password verification using bcrypt
  - JWT token generation
  - Tenant-scoped user lookup

#### GoogleAuthService
- **Purpose**: Google OAuth integration and user management
- **Responsibilities**:
  - Google account authentication
  - Account linking/unlinking
  - User creation from Google profiles
  - Authentication method management

#### GoogleOAuthService
- **Purpose**: Google OAuth client operations
- **Responsibilities**:
  - OAuth URL generation
  - Authorization code exchange
  - ID token verification
  - Google API communication

#### OAuthStateService
- **Purpose**: CSRF protection for OAuth flows
- **Responsibilities**:
  - State parameter generation
  - State validation
  - User context association
  - Redis-based state storage

## Authentication Flows

### 1. Password Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant AS as AuthService
    participant PS as PrismaService
    participant JWT as JwtService
    participant TCS as TenantContext

    C->>AC: POST /auth/login
    Note over C,AC: Headers: x-tenant-id
    
    AC->>TCS: Extract tenant from header
    AC->>AS: login(credentials, tenantId)
    
    AS->>PS: findUnique(email, tenantId)
    PS-->>AS: User data with roles
    
    AS->>AS: bcrypt.compare(password, hash)
    
    alt Password Valid
        AS->>JWT: sign(payload)
        JWT-->>AS: accessToken
        AS-->>AC: { accessToken }
        AC-->>C: 200 { accessToken }
    else Password Invalid
        AS-->>AC: UnauthorizedException
        AC-->>C: 401 Invalid credentials
    end
```

### 2. Google OAuth Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant GOS as GoogleOAuthService
    participant OSS as OAuthStateService
    participant Google as Google OAuth
    participant GAS as GoogleAuthService
    participant PS as PrismaService

    Note over C,PS: Phase 1: OAuth Initiation
    C->>AC: GET /auth/google
    AC->>GAS: validateTenantGoogleSSO(tenantId)
    AC->>OSS: generateState()
    OSS-->>AC: state
    AC->>GOS: generateAuthUrl(state)
    GOS-->>AC: authUrl
    AC-->>C: { authUrl, state }

    Note over C,PS: Phase 2: User Authorization
    C->>Google: OAuth Authorization
    Google-->>C: Redirect with code

    Note over C,PS: Phase 3: Token Exchange
    C->>AC: POST /auth/google/callback
    AC->>OSS: validateState(state)
    AC->>GOS: exchangeCodeForTokens(code)
    GOS->>Google: Exchange authorization code
    Google-->>GOS: { idToken, accessToken }
    GOS->>GOS: verifyIdToken(idToken)
    GOS-->>AC: googleProfile

    Note over C,PS: Phase 4: User Authentication
    AC->>GAS: authenticateWithGoogle(profile, tenantId)
    GAS->>PS: findUser(googleId, tenantId)
    
    alt User Exists
        GAS->>PS: Update last login
        GAS->>GAS: generateJWT(user)
        GAS-->>AC: { accessToken }
    else User Not Exists
        GAS->>PS: createUser(profile, tenantId)
        GAS->>GAS: generateJWT(newUser)
        GAS-->>AC: { accessToken }
    end
    
    AC-->>C: { accessToken }
```

### 3. Account Linking Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant JAG as JwtAuthGuard
    participant GOS as GoogleOAuthService
    participant OSS as OAuthStateService
    participant Google as Google OAuth
    participant GAS as GoogleAuthService

    Note over C,GAS: Phase 1: Link Initiation (Authenticated)
    C->>AC: GET /auth/google/link
    AC->>JAG: Validate JWT
    JAG-->>AC: User context
    AC->>OSS: generateState(userId)
    OSS-->>AC: state
    AC->>GOS: generateAuthUrl(state)
    GOS-->>AC: authUrl
    AC-->>C: { authUrl, state }

    Note over C,GAS: Phase 2: OAuth Authorization
    C->>Google: OAuth Authorization
    Google-->>C: Redirect with code

    Note over C,GAS: Phase 3: Link Completion
    C->>AC: POST /auth/google/link/callback
    AC->>JAG: Validate JWT
    JAG-->>AC: User context
    AC->>OSS: validateState(state, userId)
    AC->>GOS: exchangeCodeForTokens(code)
    GOS->>Google: Exchange code
    Google-->>GOS: tokens
    GOS->>GOS: verifyIdToken()
    GOS-->>AC: googleProfile
    AC->>GAS: linkGoogleAccount(userId, profile)
    
    alt Link Successful
        GAS-->>AC: Success
        AC-->>C: { message: "Linked successfully" }
    else Email Mismatch
        GAS-->>AC: BadRequestException
        AC-->>C: 400 Email mismatch
    else Already Linked
        GAS-->>AC: ConflictException
        AC-->>C: 409 Already linked
    end
```

## Security Architecture

### 1. Multi-Tenant Security

```mermaid
graph TB
    subgraph "Request Flow"
        R[Request]
        TIM[TenantIdentificationMiddleware]
        JAG[JwtAuthGuard]
        PG[PermissionsGuard]
        C[Controller]
    end
    
    subgraph "Tenant Context"
        TCS[TenantContextService]
        TC[Tenant Context]
    end
    
    subgraph "Database Layer"
        PTM[PrismaTenantMiddleware]
        DB[(Database)]
    end
    
    R --> TIM
    TIM --> TCS
    TCS --> TC
    TIM --> JAG
    JAG --> PG
    PG --> C
    C --> PTM
    PTM --> DB
    
    TC -.-> JAG
    TC -.-> PG
    TC -.-> PTM
```

### 2. JWT Token Validation

```mermaid
sequenceDiagram
    participant C as Client
    participant JAG as JwtAuthGuard
    participant JWT as JwtService
    participant PS as PrismaService
    participant TCS as TenantContext

    C->>JAG: Request with Bearer token
    JAG->>JAG: extractTokenFromHeader()
    
    alt Token Present
        JAG->>JWT: verifyAsync(token)
        JWT-->>JAG: payload
        
        JAG->>TCS: getTenantId()
        TCS-->>JAG: requestTenantId
        
        alt Tenant ID Matches
            JAG->>PS: findUser(userId, tenantId)
            PS-->>JAG: user with roles
            JAG->>JAG: Attach user to request
            JAG-->>C: Allow request
        else Tenant ID Mismatch
            JAG-->>C: 401 Unauthorized
        end
    else No Token
        JAG-->>C: 401 Unauthorized
    end
```

### 3. Permission-Based Authorization

```mermaid
sequenceDiagram
    participant R as Request
    participant PG as PermissionsGuard
    participant Ref as Reflector
    participant PS as PrismaService

    R->>PG: Request with user context
    PG->>Ref: getAllAndOverride(PERMISSIONS_KEY)
    Ref-->>PG: requiredPermissions[]
    
    alt No Permissions Required
        PG-->>R: Allow
    else Permissions Required
        PG->>PS: getEffectivePermissions(userId)
        
        Note over PS: Query role-based permissions
        PS->>PS: Find permissions via user roles
        
        Note over PS: Query user-specific permissions
        PS->>PS: Find direct user permissions
        
        PS-->>PG: effectivePermissions[]
        
        PG->>PG: Check required vs effective
        
        alt All Permissions Present
            PG-->>R: Allow
        else Missing Permissions
            PG-->>R: 403 Forbidden
        end
    end
```

## Rate Limiting Architecture

### 1. Multi-Level Rate Limiting

```mermaid
graph TB
    subgraph "Rate Limiting Layers"
        IPL[IP-Based Limiting]
        TL[Tenant-Based Limiting]
        UL[User-Based Limiting]
    end
    
    subgraph "Rate Limit Service"
        RLS[GoogleOAuthRateLimitService]
        Redis[(Redis)]
    end
    
    subgraph "Guards"
        RLG[GoogleOAuthRateLimitGuard]
    end
    
    Request --> RLG
    RLG --> IPL
    RLG --> TL
    RLG --> UL
    
    IPL --> RLS
    TL --> RLS
    UL --> RLS
    
    RLS --> Redis
```

### 2. Rate Limiting Flow

```mermaid
sequenceDiagram
    participant R as Request
    participant RLG as RateLimitGuard
    participant RLS as RateLimitService
    participant Redis as Redis

    R->>RLG: Request
    RLG->>RLG: Extract IP, tenant, operation
    
    RLG->>RLS: checkIpRateLimit(ip, operation)
    RLS->>Redis: Sliding window check
    Redis-->>RLS: ipResult
    
    RLG->>RLS: checkTenantRateLimit(tenant, operation)
    RLS->>Redis: Sliding window check
    Redis-->>RLS: tenantResult
    
    RLG->>RLG: getMostRestrictiveResult()
    
    alt Rate Limit OK
        RLG->>RLG: addRateLimitHeaders()
        RLG-->>R: Allow request
    else Rate Limit Exceeded
        RLG->>RLG: addRetryAfterHeader()
        RLG-->>R: 429 Too Many Requests
    end
```

## Audit Logging Architecture

### 1. Audit Flow

```mermaid
sequenceDiagram
    participant R as Request
    participant ALI as AuditLoggingInterceptor
    participant AAS as AuthAuditService
    participant PS as PrismaService

    R->>ALI: Authentication request
    ALI->>ALI: extractRequestMetadata()
    ALI->>ALI: determineAuditContext()
    
    ALI->>R: Process request
    
    alt Request Successful
        R-->>ALI: Success response
        ALI->>AAS: logAuthEvent(success=true)
        AAS->>PS: Create audit record
    else Request Failed
        R-->>ALI: Error response
        ALI->>AAS: logAuthEvent(success=false)
        AAS->>PS: Create audit record with error
    end
```

### 2. Audit Data Structure

```typescript
interface AuthAuditEvent {
  userId: string;
  tenantId: string;
  action: 'password_login' | 'google_login' | 'google_link' | 'google_settings_update';
  authMethod: 'password' | 'google' | 'admin';
  success: boolean;
  ipAddress: string;
  userAgent: string;
  errorCode?: string;
  errorMessage?: string;
  metadata: {
    requestId: string;
    path: string;
    method: string;
    duration: number;
    timestamp: string;
    [key: string]: any;
  };
}
```

## Data Models and Relationships

### 1. Authentication Data Model

```mermaid
erDiagram
    User ||--o{ UserRole : has
    User ||--o{ UserPermission : has
    User ||--o{ AuthAuditLog : generates
    
    Role ||--o{ UserRole : assigned_to
    Role ||--o{ RolePermission : has
    
    Permission ||--o{ UserPermission : granted_to
    Permission ||--o{ RolePermission : granted_to
    
    Tenant ||--o{ User : contains
    Tenant ||--o{ Role : contains
    Tenant ||--o{ Permission : contains
    
    User {
        string id PK
        string email
        string password
        string googleId
        string tenantId FK
        datetime createdAt
        datetime updatedAt
    }
    
    Role {
        string id PK
        string name
        string tenantId FK
        datetime createdAt
        datetime updatedAt
    }
    
    Permission {
        string id PK
        string action
        string subject
        string tenantId FK
        datetime createdAt
        datetime updatedAt
    }
    
    AuthAuditLog {
        string id PK
        string userId FK
        string tenantId FK
        string action
        string authMethod
        boolean success
        string ipAddress
        string userAgent
        json metadata
        datetime createdAt
    }
```

## Configuration Architecture

### 1. Configuration Layers

```mermaid
graph TB
    subgraph "Configuration Sources"
        ENV[Environment Variables]
        CONFIG[Configuration Service]
        TENANT[Tenant Settings]
    end
    
    subgraph "Configuration Consumers"
        JWT[JWT Module]
        GOOGLE[Google OAuth Service]
        RATE[Rate Limiting Service]
        AUDIT[Audit Service]
    end
    
    ENV --> CONFIG
    CONFIG --> JWT
    CONFIG --> GOOGLE
    CONFIG --> RATE
    CONFIG --> AUDIT
    
    TENANT --> GOOGLE
    TENANT --> RATE
```

### 2. Configuration Schema

```typescript
interface AuthConfiguration {
  jwt: {
    secret: string;
    expiresIn: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
  rateLimiting: {
    oauth: {
      ip: {
        initiate: { windowMs: number; maxRequests: number };
        callback: { windowMs: number; maxRequests: number };
        linking: { windowMs: number; maxRequests: number };
      };
      tenant: {
        auth: { windowMs: number; maxRequests: number };
        linking: { windowMs: number; maxRequests: number };
      };
    };
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
}
```

## Error Handling Architecture

### 1. Error Flow

```mermaid
graph TB
    subgraph "Error Sources"
        AS[Auth Service Errors]
        GOS[Google OAuth Errors]
        VE[Validation Errors]
        RE[Rate Limit Errors]
    end
    
    subgraph "Error Processing"
        ERF[ErrorResponseFormatter]
        GEF[GlobalExceptionFilter]
    end
    
    subgraph "Error Response"
        CR[Consistent Response]
        AL[Audit Logging]
    end
    
    AS --> ERF
    GOS --> ERF
    VE --> GEF
    RE --> GEF
    
    ERF --> CR
    GEF --> CR
    
    CR --> AL
```

### 2. Error Types and Handling

```typescript
// Custom Error Types
class GoogleOAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

class AccountLinkingError extends Error {
  constructor(message: string, public reason: string) {
    super(message);
  }
}

// Error Response Format
interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  correlationId?: string;
}
```

## Performance Considerations

### 1. Caching Strategy

```mermaid
graph TB
    subgraph "Caching Layers"
        JC[JWT Validation Cache]
        UC[User Context Cache]
        PC[Permission Cache]
        SC[State Cache]
    end
    
    subgraph "Cache Stores"
        Redis[(Redis)]
        Memory[In-Memory Cache]
    end
    
    JC --> Memory
    UC --> Memory
    PC --> Redis
    SC --> Redis
```

### 2. Database Optimization

- **Indexes**: Composite indexes on (email, tenantId), (googleId, tenantId)
- **Connection Pooling**: Prisma connection pooling for scalability
- **Query Optimization**: Efficient joins for role/permission queries
- **Tenant Isolation**: Automatic tenant filtering at middleware level

## Monitoring and Observability

### 1. Metrics Collection

```typescript
interface AuthMetrics {
  authentication: {
    loginAttempts: Counter;
    loginSuccesses: Counter;
    loginFailures: Counter;
    oauthAttempts: Counter;
    oauthSuccesses: Counter;
    oauthFailures: Counter;
  };
  performance: {
    authenticationDuration: Histogram;
    tokenValidationDuration: Histogram;
    permissionCheckDuration: Histogram;
  };
  security: {
    rateLimitHits: Counter;
    suspiciousActivity: Counter;
    crossTenantAttempts: Counter;
  };
}
```

### 2. Health Checks

```typescript
interface AuthHealthChecks {
  database: boolean;
  redis: boolean;
  googleOAuth: boolean;
  jwtValidation: boolean;
}
```

This architecture provides a comprehensive, secure, and scalable authentication system that supports multiple authentication methods while maintaining strict multi-tenant isolation and comprehensive audit trails.