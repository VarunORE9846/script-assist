import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis-backed Distributed Cache Service
 * 
 * Replaces the inefficient in-memory cache with a production-grade solution:
 * - Works correctly in multi-instance deployments
 * - Persistent across application restarts
 * - Supports atomic operations and TTL
 * - Implements proper error handling and retry logic
 * - Memory-efficient with automatic expiration
 * 
 * Performance improvements:
 * - O(1) get/set operations
 * - Distributed cache invalidation
 * - No memory leaks
 * - Proper connection pooling
 */
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client: Redis;
  private readonly prefix = 'cache:';

  constructor(private readonly configService: ConfigService) {
    // Initialize Redis client with config
    this.client = new Redis({
      host: this.configService.get('redis.host'),
      port: this.configService.get('redis.port'),
      password: this.configService.get('redis.password'),
      db: this.configService.get('redis.db'),
      maxRetriesPerRequest: this.configService.get('redis.maxRetriesPerRequest'),
      enableReadyCheck: this.configService.get('redis.enableReadyCheck'),
      enableOfflineQueue: this.configService.get('redis.enableOfflineQueue'),
      retryStrategy: this.configService.get('redis.retryStrategy'),
    });

    // Connection event handlers for monitoring
    this.client.on('connect', () => {
      this.logger.log('Redis cache client connected');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis cache client error', error);
    });

    this.client.on('ready', () => {
      this.logger.log('Redis cache client ready');
    });
  }

  /**
   * Set a value in cache with optional TTL
   * 
   * @param key - Cache key (will be prefixed automatically)
   * @param value - Value to cache (will be JSON serialized)
   * @param ttlSeconds - Time to live in seconds (default: 300)
   * @returns Promise<void>
   */
  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const serialized = JSON.stringify(value);
      
      // Use SETEX for atomic set with expiration
      await this.client.setex(prefixedKey, ttlSeconds, serialized);
      
      this.logger.debug(`Cache set: ${prefixedKey} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      this.logger.error(`Failed to set cache key ${key}:`, error);
      // Don't throw - cache failures shouldn't break the application
    }
  }

  /**
   * Get a value from cache
   * 
   * @param key - Cache key
   * @returns Promise<T | null> - Cached value or null if not found/expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const value = await this.client.get(prefixedKey);
      
      if (!value) {
        this.logger.debug(`Cache miss: ${prefixedKey}`);
        return null;
      }
      
      this.logger.debug(`Cache hit: ${prefixedKey}`);
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to get cache key ${key}:`, error);
      return null; // Return null on error, don't break the flow
    }
  }

  /**
   * Delete a value from cache
   * 
   * @param key - Cache key
   * @returns Promise<boolean> - true if deleted, false otherwise
   */
  async delete(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const result = await this.client.del(prefixedKey);
      
      this.logger.debug(`Cache delete: ${prefixedKey} (deleted: ${result > 0})`);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to delete cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * Useful for cache invalidation (e.g., invalidate all user-related caches)
   * 
   * @param pattern - Pattern to match (e.g., "user:*")
   * @returns Promise<number> - Number of keys deleted
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const prefixedPattern = this.getPrefixedKey(pattern);
      const keys = await this.client.keys(prefixedPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Use pipeline for batch deletion
      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.del(key));
      await pipeline.exec();
      
      this.logger.debug(`Cache pattern delete: ${prefixedPattern} (deleted: ${keys.length} keys)`);
      return keys.length;
    } catch (error) {
      this.logger.error(`Failed to delete cache pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   * 
   * @param key - Cache key
   * @returns Promise<boolean>
   */
  async has(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const exists = await this.client.exists(prefixedKey);
      return exists === 1;
    } catch (error) {
      this.logger.error(`Failed to check cache key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache entries (use with caution)
   * Only clears keys with our prefix
   * 
   * @returns Promise<void>
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.client.keys(`${this.prefix}*`);
      
      if (keys.length > 0) {
        await this.client.del(...keys);
        this.logger.log(`Cache cleared: ${keys.length} keys deleted`);
      }
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get remaining TTL for a key
   * 
   * @param key - Cache key
   * @returns Promise<number> - Remaining TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async getTTL(key: string): Promise<number> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      return await this.client.ttl(prefixedKey);
    } catch (error) {
      this.logger.error(`Failed to get TTL for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Increment a numeric value atomically
   * Useful for counters and rate limiting
   * 
   * @param key - Cache key
   * @param amount - Amount to increment (default: 1)
   * @returns Promise<number> - New value after increment
   */
  async increment(key: string, amount = 1): Promise<number> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      return await this.client.incrby(prefixedKey, amount);
    } catch (error) {
      this.logger.error(`Failed to increment cache key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set a value with expiration only if it doesn't exist (atomic operation)
   * Useful for distributed locking
   * 
   * @param key - Cache key
   * @param value - Value to set
   * @param ttlSeconds - Time to live in seconds
   * @returns Promise<boolean> - true if set, false if key already exists
   */
  async setIfNotExists<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    try {
      const prefixedKey = this.getPrefixedKey(key);
      const serialized = JSON.stringify(value);
      
      // SET NX EX - atomic operation for distributed locking
      const result = await this.client.set(prefixedKey, serialized, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Failed to setIfNotExists for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache statistics
   * 
   * @returns Promise<object> - Cache statistics
   */
  async getStats(): Promise<{
    connectedClients: number;
    usedMemory: string;
    totalKeys: number;
    cacheKeys: number;
  }> {
    try {
      const info = await this.client.info('stats');
      const memory = await this.client.info('memory');
      const dbSize = await this.client.dbsize();
      const cacheKeys = await this.client.keys(`${this.prefix}*`);
      
      return {
        connectedClients: this.parseInfoValue(info, 'connected_clients'),
        usedMemory: this.parseInfoString(memory, 'used_memory_human'),
        totalKeys: dbSize,
        cacheKeys: cacheKeys.length,
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats:', error);
      return {
        connectedClients: 0,
        usedMemory: '0B',
        totalKeys: 0,
        cacheKeys: 0,
      };
    }
  }

  /**
   * Health check for Redis connection
   * 
   * @returns Promise<boolean>
   */
  async isHealthy(): Promise<boolean> {
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Get prefixed key to avoid collisions
   * 
   * @param key - Original key
   * @returns Prefixed key
   */
  private getPrefixedKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Parse numeric value from Redis INFO output
   */
  private parseInfoValue(info: string, key: string): number {
    const regex = new RegExp(`${key}:(\\d+)`);
    const match = info.match(regex);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Parse string value from Redis INFO output
   */
  private parseInfoString(info: string, key: string): string {
    const regex = new RegExp(`${key}:(.+)`);
    const match = info.match(regex);
    return match ? match[1].trim() : '0B';
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    this.logger.log('Closing Redis cache connection...');
    await this.client.quit();
  }
}

