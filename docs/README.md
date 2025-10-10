# Multi-Tenant NestJS Application Documentation

Welcome to the comprehensive documentation for the multi-tenant NestJS application. This documentation provides detailed information about the system architecture, modules, APIs, and operational procedures.

## 📚 Documentation Structure

### Architecture
- [System Overview](./architecture/overview.md) - High-level system architecture
- [Module Relationships](./architecture/module-relationships.md) - Inter-module dependencies
- [Data Flow Diagrams](./architecture/data-flow-diagrams.md) - Process flows and data movement

### Modules
- [Authentication](./modules/auth/README.md) - JWT and OAuth authentication system
- [Notifications](./modules/notifications/README.md) - Multi-channel notification system
- [Tenant Management](./modules/tenant/README.md) - Multi-tenant isolation and context
- [User Management](./modules/user/README.md) - User CRUD and relationship management
- [Role Management](./modules/role/README.md) - Role-based access control
- [Permission System](./modules/permission/README.md) - Permission management
- [Project Management](./modules/project/README.md) - Project lifecycle management
- [Database](./modules/database/README.md) - Prisma configuration and tenant isolation

### API Reference
- [Authentication Patterns](./api/authentication.md) - Auth flows and security
- [Error Handling](./api/error-handling.md) - Standardized error responses
- [Rate Limiting](./api/rate-limiting.md) - Rate limiting strategies
- [Tenant Isolation](./api/tenant-isolation.md) - Multi-tenancy implementation

### Development
- [Setup Guide](./development/setup.md) - Development environment setup
- [Testing Guide](./development/testing.md) - Testing strategies and examples
- [Deployment Guide](./development/deployment.md) - Deployment procedures
- [Contributing Guidelines](./development/contributing.md) - Development standards

### Operations
- [Monitoring](./operations/monitoring.md) - System monitoring and alerting
- [Troubleshooting](./operations/troubleshooting.md) - Common issues and solutions
- [Security](./operations/security.md) - Security considerations and best practices

## 🚀 Quick Start

1. **New Developers**: Start with the [System Overview](./architecture/overview.md)
2. **API Integration**: Check the [API Reference](./api/) section
3. **Development Setup**: Follow the [Setup Guide](./development/setup.md)
4. **Module Deep Dive**: Explore individual [Module Documentation](./modules/)

## 🔍 Search and Navigation

- Use your IDE's search functionality to find specific topics
- Each module follows a consistent structure for easy navigation
- Cross-references are provided between related sections

## 📝 Contributing to Documentation

See our [Contributing Guidelines](./development/contributing.md) for information on how to update and maintain this documentation.

---

*Last updated: Generated automatically with each release*