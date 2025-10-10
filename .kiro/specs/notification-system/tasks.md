# Implementation Plan

- [x] 1. Set up database schema and core infrastructure
  - Add Prisma models for notifications, preferences, delivery logs, templates, and tenant config
  - Create and run database migration
  - Update Prisma client
  - _Requirements: 3.1, 3.2, 11.1, 11.5, 11.6_

- [x] 2. Create core interfaces and enums
  - [x] 2.1 Create notification enums
    - Create NotificationType enum (INFO, WARNING, SUCCESS, ERROR)
    - Create NotificationChannelType enum (IN_APP, EMAIL, SMS)
    - Create DeliveryStatus enum (PENDING, SENT, FAILED, BOUNCED)
    - Create NotificationPriority enum (LOW, MEDIUM, HIGH, URGENT)
    - _Requirements: 12.1, 12.2_
  
  - [x] 2.2 Create notification interfaces
    - Create INotificationChannel interface with send, validate, getChannelType, isAvailable methods
    - Create NotificationPayload interface
    - Create NotificationResult interface
    - Create IEmailProvider and ISmsProvider interfaces
    - _Requirements: 1.1, 1.2, 9.1, 9.2, 10.1, 10.2_

- [x] 3. Create DTOs for API endpoints
  - [x] 3.1 Create notification DTOs
    - Create CreateNotificationDto with validation
    - Create NotificationFilterDto for query parameters
    - Write unit tests for DTO validation
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 3.2 Create preference DTOs
    - Create UpdatePreferenceDto with channel enable/disable flags
    - Write unit tests for DTO validation
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 4. Implement notification preference service
  - [x] 4.1 Create NotificationPreferenceService
    - Implement getUserPreferences method
    - Implement getEnabledChannels method with preference hierarchy
    - Implement updatePreference method
    - Implement createDefaultPreferences method
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7_
  
  - [x] 4.2 Write unit tests for preference service
    - Test preference hierarchy (tenant defaults → user preferences)
    - Test channel enablement logic
    - Test default preference creation
    - _Requirements: 2.1, 2.6, 2.7_

- [x] 5. Set up Redis and BullMQ infrastructure
  - [x] 5.1 Install and configure BullMQ dependencies
    - Install @nestjs/bullmq, bullmq, ioredis packages
    - Create BullMQ module configuration
    - Set up Redis connection with environment variables
    - _Requirements: 5.1, 5.2, 5.6, 15.3_
  
  - [x] 5.2 Create notification queues
    - Create email-notifications queue
    - Create sms-notifications queue
    - Configure queue options (retry, backoff, priority)
    - _Requirements: 5.1, 5.2, 5.4, 5.7, 13.1_


- [x] 6. Implement email provider adapters
  - [x] 6.1 Create Resend email provider
    - Install resend package
    - Implement ResendProvider class with IEmailProvider interface
    - Implement send method using Resend SDK
    - Write unit tests with mocked Resend API
    - _Requirements: 9.1, 9.2, 9.3, 9.7_
  
  - [x] 6.2 Create AWS SES email provider
    - Install @aws-sdk/client-ses package
    - Implement AwsSesProvider class with IEmailProvider interface
    - Implement send method using AWS SDK
    - Write unit tests with mocked AWS SDK
    - _Requirements: 9.1, 9.2, 9.3, 9.8_
  
  - [x] 6.3 Create OneSignal email provider
    - Install onesignal-node package
    - Implement OneSignalProvider class with IEmailProvider interface
    - Implement send method using OneSignal API
    - Write unit tests with mocked OneSignal API
    - _Requirements: 9.1, 9.2, 9.3, 9.9_
  
  - [x] 6.4 Create SMTP fallback provider
    - Install nodemailer package
    - Implement SmtpProvider class with IEmailProvider interface
    - Implement send method using nodemailer
    - Write unit tests with mocked SMTP transport
    - _Requirements: 9.1, 9.2, 9.3, 9.5_
  
  - [x] 6.5 Create EmailProviderFactory
    - Implement factory to create provider instances based on configuration
    - Support tenant-specific and global provider selection
    - Implement fallback logic to SMTP on provider failure
    - Write unit tests for factory logic
    - _Requirements: 9.1, 9.2, 9.5, 11.5, 11.6_

- [x] 7. Implement SMS provider adapters
  - [x] 7.1 Create Twilio SMS provider
    - Install twilio package
    - Implement TwilioProvider class with ISmsProvider interface
    - Implement send method using Twilio SDK
    - Write unit tests with mocked Twilio API
    - _Requirements: 10.1, 10.2, 10.3, 10.6_
  
  - [x] 7.2 Create Termii SMS provider
    - Install axios for HTTP requests
    - Implement TermiiProvider class with ISmsProvider interface
    - Implement send method using Termii API
    - Write unit tests with mocked HTTP client
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7_
  
  - [x] 7.3 Create SmsProviderFactory
    - Implement factory to create provider instances based on configuration
    - Support tenant-specific and global provider selection
    - Write unit tests for factory logic
    - _Requirements: 10.1, 10.2, 11.5, 11.6_

- [-] 8. Implement React-email template system
  - [x] 8.1 Set up React-email infrastructure
    - Install @react-email/components, @react-email/render, @react-email/tailwind, react packages
    - Configure Tailwind for email templates
    - Create base email template component
    - _Requirements: 6.2, 6.3_
  
  - [x] 8.2 Create sample email templates
    - Create welcome email template with React-email
    - Create notification digest template
    - Create password reset template
    - Style templates with Tailwind CSS
    - _Requirements: 6.2, 6.3, 6.10_
  
  - [x] 8.3 Implement NotificationTemplateService
    - Implement getTemplate method with tenant override logic
    - Implement renderEmailTemplate method using @react-email/render
    - Implement createTemplate and updateTemplate methods
    - Write unit tests for template service
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.10_


- [x] 9. Implement channel handlers
  - [x] 9.1 Create base channel abstract class
    - Create BaseChannel abstract class with common functionality
    - Define abstract methods for send, validate, getChannelType
    - _Requirements: 1.1, 1.2_
  
  - [x] 9.2 Implement InAppChannelService
    - Extend BaseChannel abstract class
    - Implement send method to create notification in database
    - Implement validate method
    - Integrate with TenantContextService for tenant scoping
    - Write unit tests with mocked PrismaService
    - _Requirements: 1.1, 3.1, 4.1, 4.3, 4.7_
  
  - [x] 9.3 Implement EmailChannelService
    - Extend BaseChannel abstract class
    - Implement send method to queue email jobs
    - Implement validate method
    - Support priority-based queuing
    - Write unit tests with mocked queue
    - _Requirements: 1.1, 5.1, 5.2, 5.7, 9.4_
  
  - [x] 9.4 Implement SmsChannelService
    - Extend BaseChannel abstract class
    - Implement send method to queue SMS jobs
    - Implement validate method
    - Support priority-based queuing
    - Write unit tests with mocked queue
    - _Requirements: 1.1, 5.1, 5.2, 5.7, 10.5_

- [x] 10. Implement NotificationChannelFactory
  - Create NotificationChannelFactory class
  - Implement registerChannel method
  - Implement getChannel method
  - Implement getAvailableChannels method
  - Register all channel handlers in module
  - Write unit tests for factory pattern
  - _Requirements: 1.2, 1.3_

- [x] 11. Implement queue processors
  - [x] 11.1 Create EmailQueueProcessor
    - Create processor class with @Processor decorator
    - Implement processEmail method
    - Load tenant-specific or global email configuration
    - Use EmailProviderFactory to get provider
    - Render email template using NotificationTemplateService
    - Send email via provider
    - Create NotificationDeliveryLog entry
    - Handle errors and retries
    - Write unit tests with mocked dependencies
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 7.1, 9.4, 9.5, 11.5, 11.6_
  
  - [x] 11.2 Create SmsQueueProcessor
    - Create processor class with @Processor decorator
    - Implement processSms method
    - Load tenant-specific or global SMS configuration
    - Use SmsProviderFactory to get provider
    - Send SMS via provider
    - Create NotificationDeliveryLog entry
    - Handle errors and retries
    - Write unit tests with mocked dependencies
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 7.1, 10.5, 11.5, 11.6_

- [x] 12. Implement WebSocket gateway for real-time notifications
  - [x] 12.1 Set up WebSocket infrastructure
    - Install @nestjs/websockets, @nestjs/platform-socket.io, socket.io packages
    - Create NotificationGateway with @WebSocketGateway decorator
    - Configure CORS for WebSocket connections
    - _Requirements: 8.1, 15.4_
  
  - [x] 12.2 Implement WebSocket connection handling
    - Implement handleConnection to authenticate users
    - Subscribe users to tenant-specific rooms
    - Implement handleDisconnect for cleanup
    - _Requirements: 8.1, 8.3_
  
  - [x] 12.3 Implement notification emission methods
    - Implement emitNotification method to push notifications
    - Implement emitUnreadCount method for count updates
    - Integrate with InAppChannelService
    - Write unit tests with mocked Socket.IO server
    - _Requirements: 8.2, 8.4_


- [x] 13. Implement core NotificationService
  - [x] 13.1 Create NotificationService class
    - Implement create method to orchestrate notification creation
    - Load user preferences using NotificationPreferenceService
    - Determine enabled channels based on preferences
    - Use NotificationChannelFactory to get channel handlers
    - Send notifications through enabled channels
    - Handle partial failures (one channel fails, others succeed)
    - _Requirements: 1.1, 1.3, 1.4, 2.3, 3.1_
  
  - [x] 13.2 Implement additional notification methods
    - Implement sendToUser method for single user notifications
    - Implement sendToTenant method for bulk tenant notifications
    - Implement markAsRead method
    - Implement markAllAsRead method
    - Implement getUserNotifications with pagination and filtering
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 13.3 Write unit tests for NotificationService
    - Test notification creation flow
    - Test preference application
    - Test channel selection logic
    - Test partial failure handling
    - Test tenant isolation
    - _Requirements: 1.3, 1.4, 2.3, 3.1, 3.2_

- [x] 14. Create notification controllers
  - [x] 14.1 Create NotificationsController
    - Implement GET /api/notifications endpoint with pagination
    - Implement GET /api/notifications/:id endpoint
    - Implement PATCH /api/notifications/:id/read endpoint
    - Implement PATCH /api/notifications/read-all endpoint
    - Implement DELETE /api/notifications/:id endpoint
    - Add JWT authentication guard
    - Add tenant context middleware
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 11.1, 11.2_
  
  - [x] 14.2 Create NotificationPreferencesController
    - Implement GET /api/notification-preferences endpoint
    - Implement PUT /api/notification-preferences/:category endpoint
    - Implement GET /api/notification-preferences/categories endpoint
    - Add JWT authentication guard
    - Add tenant context middleware
    - _Requirements: 2.2, 2.3_
  
  - [x] 14.3 Write unit tests for controllers
    - Test all endpoints with mocked services
    - Test authentication and authorization
    - Test tenant isolation
    - Test error handling
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 15. Implement event-driven notification triggers
  - [x] 15.1 Set up event emitter infrastructure
    - Configure NestJS EventEmitter module
    - Create notification event types
    - _Requirements: 14.1, 14.2_
  
  - [x] 15.2 Create event listeners
    - Create NotificationEventListener class
    - Implement listeners for common events (UserCreated, InvoiceGenerated, etc.)
    - Map events to notification payloads
    - Write unit tests for event listeners
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [x] 16. Add configuration and environment validation
  - [x] 16.1 Create notification configuration
    - Create notification.config.ts with typed configuration
    - Load configuration from environment variables
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  
  - [x] 16.2 Update environment validation
    - Add notification-related environment variables to env.validation.ts
    - Validate required configuration on startup
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  
  - [x] 16.3 Update .env.example
    - Add all notification configuration variables
    - Add comments explaining each variable
    - _Requirements: 15.1, 15.2, 15.3, 15.4_


- [x] 17. Create NotificationsModule and wire everything together
  - Import all required modules (BullMQ, WebSocket, etc.)
  - Register all services as providers
  - Register all controllers
  - Register channel handlers with factory
  - Export NotificationService for use in other modules
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 18. Implement security and access control
  - [x] 18.1 Add rate limiting for notification endpoints
    - Configure rate limits per user for notification creation
    - Configure rate limits per tenant for bulk notifications
    - Add rate limiting guards to controllers
    - _Requirements: 11.5, 11.7_
  
  - [x] 18.2 Implement notification ownership verification
    - Add guards to verify user owns notification before access
    - Ensure tenant isolation in all queries
    - Add admin role check for tenant-wide notifications
    - Write unit tests for access control
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [x] 18.3 Implement data privacy features
    - Add notification retention policy enforcement
    - Implement soft delete for notifications
    - Add audit logging for sensitive notifications
    - _Requirements: 11.8, 11.9_

- [x] 19. Add monitoring and observability
  - [x] 19.1 Implement metrics collection
    - Add metrics for notification delivery rate by channel
    - Add metrics for failed notification count
    - Add metrics for average processing time
    - Add metrics for queue depth and lag
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  
  - [x] 19.2 Implement structured logging
    - Add structured logging for all notification events
    - Include tenant_id, user_id, category, channel in logs
    - Log provider responses
    - Track delivery status changes
    - _Requirements: 16.6, 16.7, 16.8_
  
  - [x] 19.3 Set up alerting (optional)
    - Configure alerts for high failure rates
    - Configure alerts for queue backup
    - Configure alerts for provider API errors
    - _Requirements: 16.9_

- [x] 20. Write integration tests
  - [x] 20.1 Create notification flow integration tests
    - Test end-to-end in-app notification creation and delivery
    - Test end-to-end email notification queuing and processing
    - Test end-to-end SMS notification queuing and processing
    - Test multi-channel notification delivery
    - _Requirements: 1.1, 1.3, 5.1, 5.2_
  
  - [x] 20.2 Create tenant isolation integration tests
    - Test that users can only see their tenant's notifications
    - Test that tenant-specific configurations are used
    - Test that Prisma middleware enforces tenant scoping
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  
  - [x] 20.3 Create preference system integration tests
    - Test preference hierarchy (tenant defaults → user preferences)
    - Test channel enablement based on preferences
    - Test default preference creation for new users
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7_
  
  - [x] 20.4 Create WebSocket integration tests
    - Test WebSocket connection and authentication
    - Test real-time notification push
    - Test unread count updates
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 21. Write E2E tests
  - [x] 21.1 Create notification API E2E tests
    - Test GET /api/notifications with pagination and filters
    - Test GET /api/notifications/:id
    - Test PATCH /api/notifications/:id/read
    - Test PATCH /api/notifications/read-all
    - Test DELETE /api/notifications/:id
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 21.2 Create preference API E2E tests
    - Test GET /api/notification-preferences
    - Test PUT /api/notification-preferences/:category
    - Test GET /api/notification-preferences/categories
    - _Requirements: 2.2, 2.3_
  
  - [x] 21.3 Create authentication and authorization E2E tests
    - Test that unauthenticated requests are rejected
    - Test that users can only access their own notifications
    - Test tenant isolation
    - _Requirements: 11.1, 11.2, 11.3_

- [x] 22. Create documentation
  - [x] 22.1 Update API documentation
    - Document all notification endpoints with Swagger
    - Add request/response examples
    - Document query parameters and filters
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [x] 22.2 Create developer guide
    - Document how to trigger notifications from application code
    - Document how to create custom notification templates
    - Document how to add new notification channels
    - Document how to configure providers
    - _Requirements: 1.1, 6.1, 9.1, 10.1, 15.1, 15.2, 15.3_
  
  - [x] 22.3 Create deployment guide
    - Document Redis setup requirements
    - Document environment variable configuration
    - Document provider API key setup
    - Document monitoring and alerting setup
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 16.1, 16.2, 16.3_

- [x] 23. Update main application module
  - Import NotificationsModule in AppModule
  - Ensure proper module ordering for dependencies
  - Test that application starts successfully
  - _Requirements: 1.1_
