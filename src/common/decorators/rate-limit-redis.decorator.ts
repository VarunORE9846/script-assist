import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY, RateLimitConfig } from '../guards/redis-rate-limit.guard';

/**
 * Rate Limit Decorator for Redis-backed rate limiting
 * 
 * Usage Examples:
 * 
 * 1. Controller-level (applies to all routes in controller):
 *    @RedisRateLimit({ points: 100, duration: 60 })
 *    @Controller('tasks')
 *    export class TasksController {}
 * 
 * 2. Route-level (overrides controller-level):
 *    @RedisRateLimit({ points: 10, duration: 60 })
 *    @Post('batch')
 *    batchProcess() {}
 * 
 * 3. With custom block duration:
 *    @RedisRateLimit({ points: 5, duration: 60, blockDuration: 300 })
 *    @Post('login')
 *    login() {}
 * 
 * 4. With custom key prefix (separate rate limit pools):
 *    @RedisRateLimit({ points: 1000, duration: 3600, keyPrefix: 'admin' })
 *    @Get('analytics')
 *    getAnalytics() {}
 * 
 * @param config - Rate limit configuration
 * @returns Method/Class decorator
 */
export const RedisRateLimit = (config: RateLimitConfig) => 
  SetMetadata(RATE_LIMIT_KEY, config);

/**
 * Predefined rate limit configurations for common use cases
 */
export const RateLimitPresets = {
  // Very strict - for sensitive operations
  STRICT: { points: 5, duration: 60, blockDuration: 300 },
  
  // Moderate - for general authenticated endpoints
  MODERATE: { points: 100, duration: 60 },
  
  // Lenient - for read-heavy endpoints
  LENIENT: { points: 1000, duration: 60 },
  
  // Login attempts - progressive delay
  AUTH: { points: 5, duration: 300, blockDuration: 600 },
  
  // Batch operations - lower limit
  BATCH: { points: 10, duration: 60, blockDuration: 120 },
};

