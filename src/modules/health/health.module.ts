import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { RedisCacheService } from '../../common/services/redis-cache.service';

/**
 * Health Module
 * 
 * Provides health check endpoints for monitoring:
 * - Database connectivity
 * - Redis connectivity
 * - Memory usage
 * - Disk space
 * - Overall system health
 */
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisCacheService],
})
export class HealthModule {}

