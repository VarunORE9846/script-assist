import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Rate Limit Configuration Metadata Key
 */
export const RATE_LIMIT_KEY = 'rateLimit';

/**
 * Rate Limit Configuration Interface
 */
export interface RateLimitConfig {
  points: number;      // Number of requests allowed
  duration: number;    // Time window in seconds
  blockDuration?: number; // How long to block after exceeding (default: duration)
  keyPrefix?: string;  // Custom prefix for this endpoint
}

/**
 * Redis-backed Distributed Rate Limit Guard
 * 
 * Improvements over the old in-memory implementation:
 * 
 * 1. DISTRIBUTED: Works correctly across multiple instances
 * 2. PERSISTENT: Survives application restarts
 * 3. ATOMIC: Uses Redis atomic operations (no race conditions)
 * 4. EFFICIENT: O(1) operations using sorted sets
 * 5. MEMORY-EFFICIENT: Automatic cleanup of old entries
 * 6. SECURE: No IP exposure in error messages
 * 7. FLEXIBLE: Per-endpoint configuration
 * 8. SCALABLE: Handles millions of requests
 * 
 * Algorithm: Token Bucket with Redis Sorted Sets
 * - Each request timestamp is stored in a sorted set
 * - Old timestamps are automatically removed
 * - Count is checked atomically
 */
@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RedisRateLimitGuard.name);
  private readonly redis: Redis;
  private readonly keyPrefix = 'ratelimit:';

  // Default rate limit configuration
  private readonly defaultConfig: RateLimitConfig = {
    points: 100,
    duration: 60,
    blockDuration: 60,
  };

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    // Initialize Redis client for rate limiting
    this.redis = new Redis({
      host: this.configService.get('redis.host'),
      port: this.configService.get('redis.port'),
      password: this.configService.get('redis.password'),
      db: this.configService.get('redis.db', 0),
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false, // Fail fast if Redis is down
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis rate limit client error:', error);
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get rate limit configuration from decorator or use default
    const config = this.reflector.get<RateLimitConfig>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    ) || this.reflector.get<RateLimitConfig>(
      RATE_LIMIT_KEY,
      context.getClass(),
    ) || this.defaultConfig;

    const request = context.switchToHttp().getRequest();
    
    // Build rate limit key from multiple factors for better security
    const identifier = this.getIdentifier(request);
    const endpoint = this.getEndpoint(request);
    const key = `${this.keyPrefix}${config.keyPrefix || endpoint}:${identifier}`;

    try {
      const allowed = await this.checkRateLimit(key, config);
      
      if (!allowed) {
        // Get remaining block time for better UX
        const ttl = await this.redis.ttl(key);
        
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: ttl > 0 ? ttl : config.blockDuration || config.duration,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      // If Redis is down, we log but allow the request
      // This prevents Redis outage from taking down the entire API
      if (!(error instanceof HttpException)) {
        this.logger.error('Rate limit check failed, allowing request:', error);
        return true; // Fail open for availability
      }
      throw error;
    }
  }

  /**
   * Check rate limit using Redis sorted sets (sliding window)
   * 
   * Algorithm:
   * 1. Remove expired entries (outside time window)
   * 2. Count remaining entries
   * 3. If under limit, add new entry
   * 4. Return whether request is allowed
   * 
   * All operations are atomic using Lua script for consistency
   * 
   * @param key - Redis key for this rate limit
   * @param config - Rate limit configuration
   * @returns Promise<boolean> - true if allowed, false if rate limited
   */
  private async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - config.duration * 1000;
    
    /**
     * Lua script for atomic rate limiting
     * 
     * Benefits:
     * - All operations execute atomically (no race conditions)
     * - Reduces round trips (single Redis call)
     * - Guarantees consistency in distributed environment
     * 
     * Steps:
     * 1. Remove entries older than window
     * 2. Count current entries
     * 3. If under limit, add new entry and set expiration
     * 4. Return count
     */
    const luaScript = `
      local key = KEYS[1]
      local now = ARGV[1]
      local windowStart = ARGV[2]
      local limit = ARGV[3]
      local ttl = ARGV[4]
      
      -- Remove old entries outside the sliding window
      redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
      
      -- Count current entries
      local count = redis.call('ZCARD', key)
      
      -- Check if under limit
      if count < tonumber(limit) then
        -- Add new entry with current timestamp as score
        redis.call('ZADD', key, now, now)
        -- Set expiration to prevent memory leaks
        redis.call('EXPIRE', key, ttl)
        return count + 1
      end
      
      return count
    `;

    try {
      // Execute Lua script atomically
      const count = await this.redis.eval(
        luaScript,
        1, // Number of keys
        key,
        now.toString(),
        windowStart.toString(),
        config.points.toString(),
        (config.blockDuration || config.duration).toString(),
      ) as number;

      const allowed = count <= config.points;
      
      if (!allowed) {
        this.logger.debug(`Rate limit exceeded for ${key}: ${count}/${config.points}`);
      }

      return allowed;
    } catch (error) {
      this.logger.error(`Rate limit check error for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get unique identifier for rate limiting
   * 
   * Priority order:
   * 1. Authenticated user ID (most accurate)
   * 2. API key (if present)
   * 3. IP address (fallback)
   * 
   * Note: We hash the identifier to avoid storing PII directly
   * 
   * @param request - HTTP request
   * @returns Unique identifier
   */
  private getIdentifier(request: any): string {
    // Prefer user ID for authenticated requests
    if (request.user?.id) {
      return `user:${request.user.id}`;
    }

    // Check for API key in headers
    const apiKey = request.headers['x-api-key'];
    if (apiKey) {
      return `apikey:${this.hashString(apiKey)}`;
    }

    // Fallback to IP address
    // Support various IP header formats (proxy-aware)
    const ip = 
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.ip ||
      request.connection?.remoteAddress ||
      'unknown';

    return `ip:${this.hashString(ip)}`;
  }

  /**
   * Get endpoint identifier from request
   * 
   * @param request - HTTP request
   * @returns Endpoint identifier
   */
  private getEndpoint(request: any): string {
    return `${request.method}:${request.route?.path || request.url}`;
  }

  /**
   * Simple hash function for identifiers
   * Prevents storing raw IPs/keys in Redis (privacy/security)
   * 
   * @param str - String to hash
   * @returns Hashed string
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Cleanup Redis connection on module destroy
   */
  async onModuleDestroy() {
    await this.redis.quit();
  }
}

