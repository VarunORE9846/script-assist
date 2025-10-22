import { registerAs } from '@nestjs/config';

/**
 * Redis Configuration
 * 
 * Provides centralized Redis connection settings for:
 * - Distributed caching (replacing in-memory cache)
 * - Rate limiting (distributed across instances)
 * - Session management
 * - Queue processing (BullMQ)
 */
export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  
  // Connection pool settings for optimal performance
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  
  // Timeouts to prevent hanging connections
  connectTimeout: 10000,
  commandTimeout: 5000,
  
  // Retry strategy with exponential backoff
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
}));

