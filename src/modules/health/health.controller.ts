import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RedisCacheService } from '../../common/services/redis-cache.service';

/**
 * Health Check Controller
 * 
 * Provides endpoints for monitoring system health:
 * - /health - Overall system health
 * - /health/db - Database health
 * - /health/redis - Redis cache health
 * - /health/metrics - System metrics
 * 
 * Returns appropriate HTTP status codes:
 * - 200: All systems healthy
 * - 503: One or more systems unhealthy
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly cache: RedisCacheService,
  ) {}

  /**
   * Overall health check
   * 
   * Checks all critical systems:
   * - Database connectivity
   * - Redis connectivity
   * - Memory usage
   * - Disk space
   */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Check overall system health' })
  @ApiResponse({ status: 200, description: 'System is healthy' })
  @ApiResponse({ status: 503, description: 'System is unhealthy' })
  async check() {
    return this.health.check([
      // Database health
      () => this.db.pingCheck('database'),
      
      // Redis health
      async () => {
        const isHealthy = await this.cache.isHealthy();
        return {
          redis: {
            status: isHealthy ? 'up' : 'down',
          },
        };
      },
      
      // Memory health (alert if >150MB heap used)
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      
      // Memory health (alert if >300MB RSS used)
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      
      // Disk health (alert if >90% full)
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }

  /**
   * Database-only health check
   */
  @Get('db')
  @HealthCheck()
  @ApiOperation({ summary: 'Check database health' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  @ApiResponse({ status: 503, description: 'Database is unhealthy' })
  async checkDatabase() {
    return this.health.check([
      () => this.db.pingCheck('database'),
    ]);
  }

  /**
   * Redis-only health check
   */
  @Get('redis')
  @HealthCheck()
  @ApiOperation({ summary: 'Check Redis cache health' })
  @ApiResponse({ status: 200, description: 'Redis is healthy' })
  @ApiResponse({ status: 503, description: 'Redis is unhealthy' })
  async checkRedis() {
    return this.health.check([
      async () => {
        const isHealthy = await this.cache.isHealthy();
        const stats = await this.cache.getStats();
        
        return {
          redis: {
            status: isHealthy ? 'up' : 'down',
            ...stats,
          },
        };
      },
    ]);
  }

  /**
   * System metrics
   * 
   * Returns detailed system information:
   * - Memory usage
   * - Uptime
   * - Node version
   * - Cache statistics
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Get system metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async getMetrics() {
    const cacheStats = await this.cache.getStats();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        heap: process.memoryUsage().heapUsed,
        rss: process.memoryUsage().rss,
        external: process.memoryUsage().external,
      },
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      cache: cacheStats,
    };
  }
}

