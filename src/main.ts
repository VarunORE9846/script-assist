import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';

/**
 * Bootstrap the NestJS application
 * 
 * Enhanced with:
 * - Graceful shutdown handling
 * - Global validation pipe
 * - CORS configuration
 * - Swagger documentation
 * - Request size limits
 * - Security headers
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Create application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Global validation pipe with enhanced settings
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      transform: true, // Auto-transform payloads
      forbidNonWhitelisted: true, // Throw error on unknown properties
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production', // Hide validation details in prod
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Correlation-ID'],
  });

  // Request body size limit (prevent DOS attacks)
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.on('data', (chunk: Buffer) => {
      // Limit: 10MB
      if (chunk.length > 10 * 1024 * 1024) {
        res.status(413).json({
          statusCode: 413,
          message: 'Request entity too large',
        });
        return;
      }
    });
    next();
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('TaskFlow API')
    .setDescription(
      'Production-grade Task Management System API with Redis caching, ' +
      'distributed rate limiting, and comprehensive security features'
    )
    .setVersion('2.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your access token (expires in 15 minutes)',
      },
      'access-token',
    )
    .addTag('auth', 'Authentication and authorization endpoints')
    .addTag('tasks', 'Task management endpoints')
    .addTag('health', 'Health check and monitoring endpoints')
    .addServer('http://localhost:3000', 'Local development')
    .addServer('https://api.taskflow.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // Graceful shutdown handling
  app.enableShutdownHooks();

  // Handle termination signals
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.log(`Received ${signal}, closing application gracefully...`);
      
      try {
        await app.close();
        logger.log('Application closed successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 Application running on: http://localhost:${port}`);
  logger.log(`📚 Swagger documentation: http://localhost:${port}/api`);
  logger.log(`💚 Health check: http://localhost:${port}/health`);
  logger.log(`📊 Metrics: http://localhost:${port}/health/metrics`);
  logger.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
}); 