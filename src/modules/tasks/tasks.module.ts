import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { Task } from './entities/task.entity';
import { RedisCacheService } from '../../common/services/redis-cache.service';
import { OwnershipGuard } from '../../common/guards/ownership.guard';

/**
 * Tasks Module
 * 
 * Enhanced with:
 * - Redis caching for performance
 * - Ownership guards for security
 * - Transaction support
 * - Queue processing
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    BullModule.registerQueue({
      name: 'task-processing',
    }),
  ],
  controllers: [TasksController],
  providers: [TasksService, RedisCacheService, OwnershipGuard],
  exports: [TasksService],
})
export class TasksModule {} 