import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters';
import {
  ApiResponseInterceptor,
  SanitizeResponseInterceptor,
} from './common/interceptors';

function loadOpenApiDocument(): Record<string, unknown> {
  const specPath = path.resolve(process.cwd(), 'docs/api/openapi.yml');
  const specFile = fs.readFileSync(specPath, 'utf8');
  const document = yaml.load(specFile);

  if (!document || typeof document !== 'object') {
    throw new Error(`Invalid OpenAPI spec at ${specPath}`);
  }

  return document as Record<string, unknown>;
}

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

  // Apply global response sanitization and envelope interceptors
  app.useGlobalInterceptors(
    new SanitizeResponseInterceptor(),
    new ApiResponseInterceptor(),
  );

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

  // Serve canonical OpenAPI spec from file
  const openApiDocument = loadOpenApiDocument();
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/docs-json', (_req: unknown, res: { json: (value: unknown) => void }) => {
    res.json(openApiDocument);
  });

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
