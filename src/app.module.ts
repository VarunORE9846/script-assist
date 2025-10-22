import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { UsersModule } from './modules/users/users.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { TaskProcessorModule } from './queues/task-processor/task-processor.module';
import { ScheduledTasksModule } from './queues/scheduled-tasks/scheduled-tasks.module';
import { RedisCacheService } from './common/services/redis-cache.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { EnhancedLoggingInterceptor } from './common/interceptors/logging.interceptor.enhanced';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import jwtConfig from './config/jwt.config';
import databaseConfig from './config/database.config';
import bullConfig from './config/bull.config';
import redisConfig from './config/redis.config';

/**
 * Enhanced Application Module
 * 
 * Key improvements:
 * 1. Redis-backed distributed caching
 * 2. Global exception filter for consistent error handling
 * 3. Correlation ID middleware for request tracking
 * 4. Enhanced logging interceptor
 * 5. Health checks module
 * 6. Proper configuration management
 * 
 * Security enhancements:
 * - Sanitized error responses
 * - Rate limiting configured
 * - Authentication guards applied
 * 
 * Performance optimizations:
 * - Redis for distributed operations
 * - Database connection pooling
 * - Queue processing for async operations
 */
@Module({
  imports: [
    // Configuration - now includes Redis config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, databaseConfig, bullConfig, redisConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    
    // Database with optimized settings
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
        // Connection pool for better performance
        extra: {
          max: 20, // Maximum pool size
          min: 5,  // Minimum pool size
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        },
      }),
    }),
    
    // Scheduling for cron jobs
    ScheduleModule.forRoot(),
    
    // Queue processing with Redis
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get('redis.host'),
          port: configService.get('redis.port'),
          password: configService.get('redis.password'),
        },
      }),
    }),
    
    // Throttler (backup for non-Redis environments)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ([
        {
          ttl: 60,
          limit: 100,
        },
      ]),
    }),
    
    // Feature modules
    UsersModule,
    TasksModule,
    AuthModule,
    HealthModule,
    
    // Queue processing modules
    TaskProcessorModule,
    ScheduledTasksModule,
  ],
  providers: [
    // Global Redis cache service (replaces inefficient in-memory cache)
    RedisCacheService,
    
    // Global exception filter for consistent error handling
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    
    // Global logging interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: EnhancedLoggingInterceptor,
    },
  ],
  exports: [RedisCacheService],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware
   * 
   * Applies correlation ID middleware to all routes for request tracking
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes('*');
  }
} 