import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters';
import { SanitizeResponseInterceptor } from './common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get configuration service
  const configService = app.get(ConfigService);

  // Apply security headers with helmet
  const isProduction =
    configService.get<string>('config.nodeEnv') === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false, // Disable CSP in development for Swagger UI
      crossOriginEmbedderPolicy: false, // Allow embedding for Swagger UI
    }),
  );

  // Enable CORS with appropriate restrictions
  const corsOrigin = configService.get<string>('config.cors.origin');
  app.enableCors({
    origin: isProduction
      ? corsOrigin?.split(',').map((origin) => origin.trim()) || []
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With',
      'X-Request-Time',
      configService.get<string>('config.tenant.headerName') || 'x-tenant-id',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 3600, // Cache preflight requests for 1 hour
  });

  // Set global prefix
  app.setGlobalPrefix('api');

  // Apply global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Apply global response sanitization interceptor
  app.useGlobalInterceptors(new SanitizeResponseInterceptor());

  // Configure global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Set up Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Multi-Tenant NestJS API')
    .setDescription(
      'A comprehensive, scalable, and secure multi-tenant SaaS backend with hybrid RBAC system, notification management, and OAuth integration. This API provides complete tenant isolation, role-based access control, and extensive notification capabilities.',
    )
    .setVersion('1.0.0')
    .setContact(
      'API Support',
      'https://github.com/your-org/multi-tenant-nestjs',
      'support@yourcompany.com',
    )
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('http://localhost:3000', 'Development server')
    .addServer('https://api.yourcompany.com', 'Production server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description:
          'Enter JWT token obtained from /auth/login or /auth/google/callback',
        in: 'header',
      },
      'JWT-auth',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: configService.get<string>('tenant.headerName') || 'x-tenant-id',
        in: 'header',
        description:
          'Tenant identifier - required for all tenant-scoped operations',
      },
      'tenant-id',
    )
    .addTag('Authentication', 'User authentication and OAuth flows')
    .addTag('Users', 'User management and permissions')
    .addTag('Roles', 'Role-based access control')
    .addTag('Permissions', 'Permission management')
    .addTag('Projects', 'Project management')
    .addTag('Notifications', 'Notification system')
    .addTag('Notification Preferences', 'User notification preferences')
    .addTag('Tenants', 'Tenant management and configuration')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Configure graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('port') ?? 3000;

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `API documentation available at: http://localhost:${port}/api/docs`,
  );
}

bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
