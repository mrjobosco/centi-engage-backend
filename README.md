# Multi-Tenant NestJS Starter

A production-ready, scalable NestJS backend application designed as a foundational starter for large, multi-tenant SaaS platforms. This project implements a shared database, shared schema multi-tenancy architecture with robust tenant isolation, JWT-based authentication, and a hybrid RBAC (Role-Based Access Control) system.

## 📖 Documentation

For comprehensive documentation, visit our [Documentation Hub](./docs/README.md) which includes:

- **[Architecture Overview](./docs/architecture/overview.md)** - System design and multi-tenant patterns
- **[Module Documentation](./docs/modules/)** - Detailed guides for each system module
- **[API Reference](./docs/api/)** - Complete API documentation and patterns
- **[Development Guide](./docs/development/setup.md)** - Setup, testing, and deployment guides
- **[Operations Guide](./docs/operations/)** - Monitoring, troubleshooting, and security

### OpenAPI Contract Workflow

- Canonical API contract: [`docs/api/openapi.yml`](./docs/api/openapi.yml)
- Validate + bundle contract artifacts: `npm run openapi:validate`
- Generated artifacts are written to `docs/api/generated/`.
- Any API behavior change should include a matching OpenAPI update.

## 🎯 Project Purpose

This starter provides a robust foundation for building multi-tenant SaaS applications with:

- **Enterprise-grade multi-tenancy** with automatic data isolation
- **Flexible permission system** supporting both role-based and user-specific permissions
- **Production-ready notification system** with multiple delivery channels
- **Comprehensive security** with JWT authentication and tenant isolation
- **Scalable architecture** designed for high-performance applications
- **Developer experience** with comprehensive testing and documentation

## ✨ Key Features

### 🏢 Multi-Tenancy Architecture
- **Shared database, shared schema** approach for optimal resource utilization
- **Automatic tenant isolation** at the database layer via Prisma middleware
- **Request-scoped tenant context** with header-based identification
- **Cross-tenant access prevention** with 404 responses for security

### 🔐 Authentication & Authorization
- **JWT-based authentication** with Passport.js integration
- **Hybrid RBAC system** supporting role-based and user-specific permissions
- **Google OAuth integration** with account linking capabilities
- **Rate limiting** with Redis-based sliding window algorithm

### 📧 Enterprise Notification System
- **Multi-channel delivery**: Email, SMS, in-app, and WebSocket notifications
- **Provider flexibility**: Support for Resend, AWS SES, Twilio, Termii, and more
- **Queue-based processing** with BullMQ for reliable delivery
- **Real-time notifications** via WebSocket connections
- **User preferences** with granular per-category settings
- **Template system** using React components for email templates

### 🛡️ Security & Monitoring
- **Tenant isolation** at multiple layers (middleware, database, API)
- **Rate limiting** at tenant, user, and category levels
- **Prometheus metrics** with Grafana-ready dashboards
- **Automated alerting** via email and Slack integration
- **Audit logging** for compliance and debugging

### 🧪 Developer Experience
- **TypeScript** with strict mode for type safety
- **Comprehensive testing** with unit, integration, and E2E tests
- **Auto-generated API docs** with Swagger/OpenAPI
- **Development tools** with hot reload and debugging support
- **Extensive documentation** with examples and troubleshooting guides

## Architecture Overview

### Multi-Tenancy Model

This application uses a **shared database, shared schema** approach where:

- All tenants share the same database and tables
- Each tenant-specific table includes a `tenantId` discriminator column
- Prisma middleware automatically scopes all queries to the current tenant
- Tenant identification happens via `x-tenant-id` header or subdomain parsing

**Benefits:**
- Efficient resource utilization
- Simplified database management
- Easy to scale horizontally
- Lower operational costs

**Tenant Isolation Layers:**
1. **Middleware Layer**: Identifies tenant from request and stores in request-scoped context
2. **Database Layer**: Prisma middleware automatically adds `tenantId` filters to all queries
3. **Service Layer**: Business logic validates tenant ownership
4. **API Layer**: Returns 404 for cross-tenant access attempts (prevents information leakage)

### Hybrid RBAC System

The permission system supports two types of permissions:

1. **Role-Based Permissions**: Users inherit permissions from assigned roles
2. **User-Specific Permissions**: Direct permissions granted to individual users

**Effective Permissions** = Role Permissions ∪ User-Specific Permissions

This hybrid approach provides flexibility to:
- Define standard roles for common access patterns
- Grant exceptions to individual users without creating single-use roles
- Easily manage permissions at scale

**Permission Format**: `action:subject` (e.g., `create:project`, `read:user`, `delete:role`)

### Enterprise Notification System

The application includes a comprehensive, production-ready notification system with:

**Multi-Channel Delivery:**
- **Email**: Support for Resend, AWS SES, SMTP, and OneSignal providers
- **SMS**: Integration with Twilio and Termii providers
- **In-App**: Real-time WebSocket notifications with persistence
- **Push**: Extensible architecture for mobile push notifications

**Advanced Features:**
- **Queue-Based Processing**: Redis-backed BullMQ for reliable delivery
- **Template System**: React-based email templates with internationalization
- **Tenant Isolation**: Complete notification isolation between tenants
- **User Preferences**: Granular per-user, per-category notification settings
- **Rate Limiting**: Multi-level rate limiting (tenant, user, notification category)
- **Real-time Monitoring**: Prometheus metrics with Grafana-ready dashboards
- **Alerting**: Automated system health alerts via email/Slack
- **Privacy Controls**: GDPR-compliant data handling and user consent management

**Rate Limiting Architecture:**
- **Tenant Level**: 100 requests/minute (configurable)
- **User Level**: 50 requests/minute (configurable)  
- **Category Level**: 10 notifications/hour per category (configurable)
- **Admin Bypass**: Automatic rate limit bypass for admin users
- **Redis-Based**: Sliding window algorithm with automatic cleanup

**Monitoring & Observability:**
- **Metrics**: Delivery rates, failure rates, queue depth, processing times
- **Alerting**: Configurable thresholds for system health monitoring
- **Logging**: Structured logging with correlation IDs
- **Queue Monitoring**: Real-time queue statistics and lag monitoring

## 🚀 Quick Start for New Developers

### Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL 15+** 
- **Redis** (for notifications and rate limiting)
- **Git**

### Technology Stack

| Category | Technologies |
|----------|-------------|
| **Framework** | NestJS, TypeScript, Node.js |
| **Database** | PostgreSQL, Prisma ORM |
| **Authentication** | JWT, Passport.js, Google OAuth |
| **Caching/Queues** | Redis, BullMQ |
| **Notifications** | React Email, Socket.io |
| **Monitoring** | Prometheus, Grafana |
| **Testing** | Jest, Supertest |
| **Documentation** | Swagger/OpenAPI, Compodoc |

### 5-Minute Setup

1. **Clone and install**:
```bash
git clone <repository-url>
cd nestjs-multi-tenant-starter
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your database and Redis URLs
```

3. **Setup database**:
```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed  # Optional: adds sample data
```

4. **Start Redis** (required):
```bash
# Using Docker (recommended)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or install locally
brew install redis && brew services start redis  # macOS
```

5. **Start the application**:
```bash
npm run start:dev
```

🎉 **You're ready!** Visit http://localhost:3000/api/docs for the API documentation.

### First Steps

1. **Explore the API**: Visit http://localhost:3000/api/docs
2. **Create a tenant**: Use the `/api/tenants` endpoint
3. **Login**: Use the `/api/auth/login` endpoint
4. **Send a notification**: Try the notification system
5. **Read the docs**: Check out [our comprehensive documentation](./docs/README.md)

## 📋 Detailed Installation Guide

### Step-by-Step Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd nestjs-multi-tenant-starter
```

2. **Install dependencies**:
```bash
npm install
```

3. **Environment configuration**:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/multitenant_db"

# Authentication
JWT_SECRET="your-secure-secret-key-change-in-production"
JWT_EXPIRATION="15m"

# Application
PORT=3000
NODE_ENV="development"

# Redis (required)
REDIS_URL="redis://localhost:6379"

# Email (optional - choose one provider)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM_ADDRESS=noreply@yourapp.com
```

4. **Database setup**:
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed with sample data (optional)
npx prisma db seed
```

5. **Redis setup** (required for notifications):
```bash
# Using Docker (recommended)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Or install locally
# macOS: brew install redis && brew services start redis
# Ubuntu: sudo apt install redis-server && sudo systemctl start redis-server
```

6. **Start the application**:
```bash
# Development with hot reload
npm run start:dev

# Production build
npm run build && npm run start:prod
```

🌐 **Access Points**:
- **API**: http://localhost:3000/api
- **API Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/health

## 🗺️ Navigation & Module Documentation

### Core System Modules

| Module | Purpose | Documentation |
|--------|---------|---------------|
| **[Authentication](./docs/modules/auth/README.md)** | JWT auth, Google OAuth, security | [API](./docs/api/authentication.md) |
| **[Tenant Management](./docs/modules/tenant/README.md)** | Multi-tenant isolation & context | [Patterns](./docs/api/tenant-isolation.md) |
| **[User Management](./docs/modules/user/README.md)** | User CRUD, relationships | [Examples](./docs/modules/user/README.md#examples) |
| **[Role System](./docs/modules/role/README.md)** | Role-based access control | [RBAC Guide](./docs/modules/role/README.md#rbac) |
| **[Permissions](./docs/modules/permission/README.md)** | Permission management | [Hybrid System](./docs/modules/permission/README.md#hybrid) |
| **[Projects](./docs/modules/project/README.md)** | Example tenant-scoped resource | [Patterns](./docs/modules/project/README.md#patterns) |
| **[Database](./docs/modules/database/README.md)** | Prisma, migrations, tenant isolation | [Schema](./docs/modules/database/README.md#schema) |

### Advanced Features

| Feature | Description | Documentation |
|---------|-------------|---------------|
| **[Notifications](./docs/modules/notifications/README.md)** | Multi-channel notification system | [Developer Guide](./NOTIFICATION_DEVELOPER_GUIDE.md) |
| **[Rate Limiting](./docs/api/rate-limiting.md)** | Redis-based rate limiting | [Configuration](./docs/api/rate-limiting.md#config) |
| **[Monitoring](./docs/operations/monitoring.md)** | Prometheus metrics & alerting | [Setup Guide](./docs/operations/monitoring.md#setup) |
| **[WebSockets](./docs/modules/notifications/README.md#websockets)** | Real-time notifications | [Client Integration](./docs/modules/notifications/README.md#client) |

### Development Resources

| Resource | Description | Link |
|----------|-------------|------|
| **[Architecture Overview](./docs/architecture/overview.md)** | System design & patterns | [View](./docs/architecture/overview.md) |
| **[API Reference](./docs/api/)** | Complete API documentation | [Browse](./docs/api/) |
| **[Development Setup](./docs/development/setup.md)** | Local development guide | [Setup](./docs/development/setup.md) |
| **[Testing Guide](./docs/development/testing.md)** | Testing strategies | [Testing](./docs/development/testing.md) |
| **[Deployment Guide](./docs/development/deployment.md)** | Production deployment | [Deploy](./docs/development/deployment.md) |
| **[Troubleshooting](./docs/operations/troubleshooting.md)** | Common issues & solutions | [Help](./docs/operations/troubleshooting.md) |

### Notification System Setup

The notification system requires additional configuration for full functionality:

1. **Email Provider Setup** (choose one):
```bash
# For Resend
EMAIL_PROVIDER=resend
EMAIL_API_KEY=your_resend_api_key

# For AWS SES
EMAIL_PROVIDER=ses
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# For SMTP
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

2. **SMS Provider Setup** (optional):
```bash
# For Twilio
SMS_PROVIDER=twilio
SMS_API_KEY=your_twilio_account_sid
SMS_API_SECRET=your_twilio_auth_token
SMS_FROM_NUMBER=+1234567890

# For Termii
SMS_PROVIDER=termii
SMS_API_KEY=your_termii_api_key
TERMII_SENDER_ID=YourBrand
```

3. **Monitoring Setup** (optional):
```bash
# Enable alerting
ALERTING_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@example.com,ops@example.com
ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Configure thresholds
ALERT_FAILURE_RATE_THRESHOLD=5
ALERT_QUEUE_DEPTH_THRESHOLD=1000
```

## Environment Variables

### Core Application
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `JWT_SECRET` | Secret key for JWT signing | - | Yes |
| `JWT_EXPIRATION` | JWT token expiration time | `15m` | No |
| `PORT` | Application port | `3000` | No |
| `NODE_ENV` | Environment (development/production/test) | `development` | No |

### Notification System
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection string for rate limiting | `redis://localhost:6379` | Yes |
| `EMAIL_PROVIDER` | Email provider (resend/ses/smtp/onesignal) | `smtp` | No |
| `EMAIL_API_KEY` | API key for email provider | - | No |
| `EMAIL_FROM_ADDRESS` | Default sender email address | `noreply@example.com` | No |
| `SMS_PROVIDER` | SMS provider (twilio/termii) | `twilio` | No |
| `SMS_API_KEY` | API key for SMS provider | - | No |
| `DEFAULT_COUNTRY_CODE` | Default country code for phone numbers | `+1` | No |

### Rate Limiting
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `TENANT_RATE_LIMIT_MAX_REQUESTS` | Max requests per tenant per window | `100` | No |
| `USER_RATE_LIMIT_MAX_REQUESTS` | Max requests per user per window | `50` | No |
| `NOTIFICATION_RATE_LIMIT_MAX_REQUESTS` | Max notifications per category per hour | `10` | No |

### Monitoring & Alerting
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ALERTING_ENABLED` | Enable system alerting | `false` | No |
| `ALERT_EMAIL_RECIPIENTS` | Comma-separated list of alert recipients | - | No |
| `ALERT_SLACK_WEBHOOK_URL` | Slack webhook URL for alerts | - | No |
| `ALERT_FAILURE_RATE_THRESHOLD` | Failure rate threshold (%) | `5` | No |

## API Documentation

Once the application is running, you can access:
- **Swagger UI**: http://localhost:3000/api/docs
- **OpenAPI JSON**: http://localhost:3000/api/docs-json

## API Usage Examples

### 1. Register a New Tenant

```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "subdomain": "acme",
    "adminEmail": "admin@acme.com",
    "adminPassword": "SecurePass123!"
  }'
```

Response:
```json
{
  "tenant": {
    "id": "clx1234567890",
    "name": "Acme Corp",
    "subdomain": "acme"
  },
  "user": {
    "id": "clx0987654321",
    "email": "admin@acme.com",
    "firstName": null,
    "lastName": null
  }
}
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -d '{
    "email": "admin@acme.com",
    "password": "SecurePass123!"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Create a Project (Protected Route)

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "My First Project",
    "description": "A sample project"
  }'
```

### 4. List Users in Tenant

```bash
curl -X GET http://localhost:3000/api/users \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 5. Create a Custom Permission

```bash
curl -X POST http://localhost:3000/api/permissions \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "action": "export",
    "subject": "report"
  }'
```

### 6. Create a Role and Assign Permissions

```bash
# Create role
curl -X POST http://localhost:3000/api/roles \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "Project Manager"
  }'

# Assign permissions to role
curl -X PUT http://localhost:3000/api/roles/{roleId}/permissions \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "permissionIds": ["clx111", "clx222", "clx333"]
  }'
```

### 7. Assign Role to User

```bash
curl -X PUT http://localhost:3000/api/users/{userId}/roles \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "roleIds": ["clx444"]
  }'
```

### 8. Grant User-Specific Permission

```bash
curl -X PUT http://localhost:3000/api/users/{userId}/permissions \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "permissionIds": ["clx555"]
  }'
```

## Notification System API Examples

### 1. Send a Notification

```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "userId": "clx0987654321",
    "title": "Welcome to the Platform",
    "message": "Your account has been successfully created.",
    "category": "account",
    "priority": "high",
    "channels": ["EMAIL", "IN_APP"],
    "data": {
      "actionUrl": "https://app.example.com/welcome",
      "expiresAt": "2024-12-31T23:59:59Z"
    }
  }'
```

### 2. Get User Notifications

```bash
curl -X GET "http://localhost:3000/api/notifications?page=1&limit=20&unreadOnly=true" \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. Update Notification Preferences

```bash
curl -X PUT http://localhost:3000/api/notifications/preferences \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "category": "marketing",
    "inAppEnabled": true,
    "emailEnabled": false,
    "smsEnabled": false
  }'
```

### 4. Mark Notifications as Read

```bash
curl -X PATCH http://localhost:3000/api/notifications/mark-read \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "notificationIds": ["clx111", "clx222", "clx333"]
  }'
```

### 5. Get Notification Statistics (Admin)

```bash
curl -X GET http://localhost:3000/api/notifications/monitoring/stats \
  -H "x-tenant-id: clx1234567890" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 6. WebSocket Connection for Real-time Notifications

```javascript
// Connect to WebSocket for real-time notifications
const socket = io('ws://localhost:3000/notifications', {
  auth: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  },
  extraHeaders: {
    'x-tenant-id': 'clx1234567890'
  }
});

socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});

socket.on('notification:read', (data) => {
  console.log('Notification marked as read:', data);
});
```

## Testing

### Run All Tests

```bash
# Unit tests
npm run test

# Unit tests with coverage
npm run test:cov

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode for development
npm run test:watch
```

### Test Database Setup

Integration and E2E tests use a separate test database. Set up the test database:

```bash
# Create test database and run migrations
npm run test:integration:setup
```

Configure test database in `.env.test`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/multitenant_test_db"
```

### Test Coverage

The project includes comprehensive test coverage:

- **Unit Tests**: Test individual services and controllers in isolation
- **Integration Tests**: Test module interactions and database operations
- **E2E Tests**: Test complete API workflows and tenant isolation

Key test scenarios:
- Tenant provisioning with atomic transactions
- Authentication and JWT validation
- Permission system with role-based and user-specific permissions
- Tenant isolation (cross-tenant access prevention)
- Prisma middleware automatic scoping

## Project Structure

```
src/
├── main.ts                          # Application entry point
├── app.module.ts                    # Root module
├── auth/                            # Authentication module
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── guards/jwt-auth.guard.ts
│   └── dto/
├── tenant/                          # Tenant management
│   ├── tenant.service.ts
│   ├── tenant-context.service.ts   # Request-scoped tenant storage
│   └── tenant-identification.middleware.ts
├── user/                            # User management
├── role/                            # Role management
├── permission/                      # Permission management
├── project/                         # Example resource module
├── notifications/                   # Enterprise notification system
│   ├── controllers/                 # REST API endpoints
│   │   ├── notifications.controller.ts
│   │   ├── notification-preferences.controller.ts
│   │   └── monitoring.controller.ts
│   ├── services/                    # Business logic
│   │   ├── notification.service.ts
│   │   ├── rate-limiting.service.ts
│   │   ├── phone-number.service.ts
│   │   ├── metrics.service.ts
│   │   └── alerting.service.ts
│   ├── channels/                    # Delivery channels
│   │   ├── email-channel.service.ts
│   │   ├── sms-channel.service.ts
│   │   └── in-app-channel.service.ts
│   ├── providers/                   # External service integrations
│   │   ├── email/
│   │   │   ├── resend.provider.ts
│   │   │   ├── aws-ses.provider.ts
│   │   │   └── smtp.provider.ts
│   │   └── sms/
│   │       ├── twilio.provider.ts
│   │       └── termii.provider.ts
│   ├── templates/                   # Email templates
│   │   └── email/
│   │       ├── welcome.template.tsx
│   │       ├── password-reset.template.tsx
│   │       └── notification-digest.template.tsx
│   ├── guards/                      # Security guards
│   │   ├── tenant-rate-limit.guard.ts
│   │   ├── notification-rate-limit.guard.ts
│   │   └── notification-ownership.guard.ts
│   ├── processors/                  # Queue processors
│   │   ├── email-queue.processor.ts
│   │   └── sms-queue.processor.ts
│   ├── gateways/                    # WebSocket gateways
│   │   └── notification.gateway.ts
│   ├── listeners/                   # Event listeners
│   │   └── notification-event.listener.ts
│   └── decorators/                  # Custom decorators
│       └── rate-limit.decorators.ts
├── database/                        # Database configuration
│   ├── prisma.service.ts
│   └── prisma-tenant.middleware.ts # Automatic tenant scoping
├── common/                          # Shared utilities
│   ├── decorators/
│   ├── guards/
│   └── filters/
└── config/                          # Configuration management

prisma/
├── schema.prisma                    # Database schema
├── migrations/                      # Database migrations
└── seed.ts                          # Seed script

test/
├── *.spec.ts                        # Unit tests
├── *.integration-spec.ts            # Integration tests
├── *.e2e-spec.ts                    # E2E tests
└── notification-*.spec.ts           # Notification system tests

docs/
├── NOTIFICATION_DEVELOPER_GUIDE.md  # Notification system guide
├── NOTIFICATION_API_DOCUMENTATION.md # API documentation
└── NOTIFICATION_DEPLOYMENT_GUIDE.md # Deployment guide
```

## Database Schema

### Core Models

- **Tenant**: Represents a customer organization
- **User**: Users belonging to a tenant
- **Role**: Named collections of permissions (tenant-scoped)
- **Permission**: Action-subject pairs (e.g., `create:project`)
- **UserRole**: Many-to-many relationship between users and roles
- **RolePermission**: Many-to-many relationship between roles and permissions
- **UserPermission**: Direct permissions granted to users
- **Project**: Example tenant-scoped resource

### Notification System Models

- **Notification**: Individual notification records with delivery status
- **NotificationPreference**: User preferences for notification categories and channels
- **NotificationTemplate**: Reusable templates for different notification types
- **NotificationDeliveryLog**: Audit trail of all notification delivery attempts
- **NotificationAuditLog**: Privacy and compliance audit trail

### Key Relationships

```
Tenant (1) ──── (N) User
Tenant (1) ──── (N) Role
Tenant (1) ──── (N) Permission
Tenant (1) ──── (N) Project
Tenant (1) ──── (N) Notification
Tenant (1) ──── (N) NotificationPreference
Tenant (1) ──── (N) NotificationTemplate

User (N) ──── (N) Role (via UserRole)
User (N) ──── (N) Permission (via UserPermission)
Role (N) ──── (N) Permission (via RolePermission)

Project (N) ──── (1) User (owner)
Notification (N) ──── (1) User (recipient)
NotificationPreference (N) ──── (1) User
NotificationDeliveryLog (N) ──── (1) Notification
```

## Security Considerations

### Authentication
- Passwords hashed with bcrypt (10 rounds)
- JWT tokens with configurable expiration
- Secure secret key from environment variables

### Authorization
- Multi-layered tenant isolation
- Permission checks before all operations
- 404 responses for cross-tenant access (prevents information leakage)

### Data Protection
- SQL injection prevention via Prisma's parameterized queries
- Input validation with class-validator
- Sensitive data removed from API responses
- Environment-based configuration

### Production Checklist
- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Configure CORS for production domains
- [ ] Enable HTTPS only
- [ ] Set up database backups
- [ ] Configure rate limiting on auth endpoints
- [ ] Set up monitoring and logging
- [ ] Review and harden security headers
- [ ] Use connection pooling
- [ ] Set up health check endpoints

## Quick Start: Notification System

### Send Your First Notification

1. **Get authenticated** (see API examples above)

2. **Send a simple notification**:
```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: your_tenant_id" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "userId": "target_user_id",
    "title": "Hello World",
    "message": "This is your first notification!",
    "category": "general",
    "channels": ["IN_APP"]
  }'
```

3. **Connect to WebSocket for real-time updates**:
```javascript
const socket = io('ws://localhost:3000/notifications', {
  auth: { token: 'your_jwt_token' },
  extraHeaders: { 'x-tenant-id': 'your_tenant_id' }
});

socket.on('notification', (data) => {
  console.log('New notification:', data);
});
```

4. **Check notification delivery**:
```bash
curl -X GET http://localhost:3000/api/notifications \
  -H "x-tenant-id: your_tenant_id" \
  -H "Authorization: Bearer your_token"
```

### Enable Email Notifications

1. **Configure email provider** (add to `.env`):
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
EMAIL_FROM_ADDRESS=noreply@yourapp.com
```

2. **Send email notification**:
```bash
curl -X POST http://localhost:3000/api/notifications \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: your_tenant_id" \
  -H "Authorization: Bearer your_token" \
  -d '{
    "userId": "target_user_id",
    "title": "Welcome Email",
    "message": "Welcome to our platform!",
    "category": "welcome",
    "channels": ["EMAIL", "IN_APP"],
    "data": {
      "actionUrl": "https://yourapp.com/welcome"
    }
  }'
```

## Common Workflows

### Adding a New Tenant-Scoped Resource

1. Add model to `prisma/schema.prisma` with `tenantId` field
2. Run migration: `npx prisma migrate dev`
3. Create module with service and controller
4. Service methods automatically scoped via Prisma middleware
5. Protect routes with `@UseGuards(JwtAuthGuard, PermissionsGuard)`
6. Add permission decorators: `@Permissions('create:resource')`

### Creating Custom Permissions

1. Define permission as `action:subject` pair
2. Create via API or seed script
3. Assign to roles or users
4. Protect routes with `@Permissions('action:subject')`

### Managing User Access

1. **Via Roles** (recommended for common patterns):
   - Create role with descriptive name
   - Assign permissions to role
   - Assign role to users

2. **Via Direct Permissions** (for exceptions):
   - Grant specific permission directly to user
   - User gets permission without role assignment

## Troubleshooting

### Database Connection Issues
```bash
# Test database connection
npx prisma db pull

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Tenant Identification Errors
- Ensure `x-tenant-id` header is included in requests
- Verify tenant ID exists in database
- Check middleware is registered in AppModule

### Permission Denied (403)
- Verify user has required permission (role-based or direct)
- Check JWT token is valid and not expired
- Ensure permission exists in tenant

### Cross-Tenant Access (404)
- This is expected behavior for security
- Verify you're using correct tenant ID
- Check JWT token matches tenant ID in header

### Notification System Issues

#### Notifications Not Sending
```bash
# Check Redis connection
redis-cli ping

# Check queue status
curl -X GET http://localhost:3000/api/notifications/monitoring/queue-stats \
  -H "Authorization: Bearer your_token"

# Check notification preferences
curl -X GET http://localhost:3000/api/notifications/preferences \
  -H "Authorization: Bearer your_token"
```

#### Rate Limiting Issues (429 errors)
- Check rate limit headers in response
- Verify rate limit configuration
- Use admin account to bypass limits for testing
- Reset rate limits: `redis-cli FLUSHDB`

#### Email Delivery Issues
- Verify email provider configuration
- Check email provider API keys and credentials
- Test with a simple SMTP provider first
- Check spam folders for test emails

#### WebSocket Connection Issues
- Ensure JWT token is valid
- Check CORS configuration for WebSocket
- Verify tenant ID in connection headers
- Check firewall/proxy WebSocket support

## Development

### Code Style
```bash
# Format code
npm run format

# Lint code
npm run lint
```

### Database Management
```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database
npx prisma migrate reset
```

### Debugging
```bash
# Start in debug mode
npm run start:debug

# Debug tests
npm run test:debug
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions and support:
- Open an issue on GitHub
- Check existing documentation
- Review test files for usage examples

## Acknowledgments

Built with:
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [Passport](http://www.passportjs.org/) - Authentication middleware
- [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript
