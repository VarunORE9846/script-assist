import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RedisRateLimitGuard } from '../../common/guards/redis-rate-limit.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RedisRateLimit, RateLimitPresets } from '../../common/decorators/rate-limit-redis.decorator';
import { CheckOwnership } from '../../common/decorators/ownership.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationParams } from '../../common/interfaces/pagination.interface';
import { PaginationUtil } from '../../common/utils/pagination.util';

/**
 * Refactored Tasks Controller
 * 
 * IMPROVEMENTS:
 * 1. NO DIRECT REPOSITORY ACCESS - All operations through service layer
 * 2. PROPER GUARDS - Authentication, authorization, ownership checks
 * 3. RATE LIMITING - Distributed Redis-backed rate limiting
 * 4. DB-LEVEL OPERATIONS - No in-memory filtering/pagination
 * 5. PROPER ERROR HANDLING - Consistent error responses
 * 6. USER CONTEXT - All operations scoped to current user
 * 
 * Security features:
 * - JWT authentication required
 * - Ownership checks on modifications
 * - Role-based access for admin operations
 * - Rate limiting per endpoint
 */
@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RedisRateLimitGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    // NO REPOSITORY INJECTION - Service layer handles all data access
  ) {}

  /**
   * Create a new task
   * 
   * Automatically assigns task to current user
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RedisRateLimit(RateLimitPresets.MODERATE)
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.create(createTaskDto, userId);
  }

  /**
   * Get all tasks with filtering, sorting, and pagination
   * 
   * All operations done at database level for efficiency
   */
  @Get()
  @RedisRateLimit(RateLimitPresets.LENIENT)
  @ApiOperation({ summary: 'Find all tasks with filtering and pagination' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiQuery({ name: 'priority', required: false, description: 'Filter by priority' })
  @ApiQuery({ name: 'search', required: false, description: 'Search in title/description' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', type: Number })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Tasks retrieved successfully' })
  async findAll(
    @Query() filters: TaskFilterDto,
    @Query() paginationParams: PaginationParams,
    @CurrentUser('id') userId: string,
  ) {
    // Validate and sanitize pagination params
    const pagination = PaginationUtil.validateParams(paginationParams);
    
    // Get tasks (all filtering/pagination done in DB)
    return this.tasksService.findAll(filters, pagination, userId);
  }

  /**
   * Get task statistics
   * 
   * Uses DB aggregation for efficiency (no in-memory filtering)
   */
  @Get('stats')
  @RedisRateLimit(RateLimitPresets.LENIENT)
  @ApiOperation({ summary: 'Get task statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(@CurrentUser('id') userId: string) {
    return this.tasksService.getStatistics(userId);
  }

  /**
   * Get a single task by ID
   * 
   * Ownership check ensures users can only access their own tasks
   */
  @Get(':id')
  @UseGuards(OwnershipGuard)
  @CheckOwnership({ entity: 'task', paramKey: 'id', userIdField: 'userId' })
  @RedisRateLimit(RateLimitPresets.LENIENT)
  @ApiOperation({ summary: 'Find a task by ID' })
  @ApiResponse({ status: 200, description: 'Task found' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your task' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.findOne(id, userId);
  }

  /**
   * Update a task
   * 
   * Ownership guard ensures users can only update their own tasks
   */
  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @CheckOwnership({ entity: 'task', paramKey: 'id', userIdField: 'userId' })
  @RedisRateLimit(RateLimitPresets.MODERATE)
  @ApiOperation({ summary: 'Update a task' })
  @ApiResponse({ status: 200, description: 'Task updated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your task' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.tasksService.update(id, updateTaskDto, userId);
  }

  /**
   * Delete a task
   * 
   * Ownership guard ensures users can only delete their own tasks
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OwnershipGuard)
  @CheckOwnership({ entity: 'task', paramKey: 'id', userIdField: 'userId' })
  @RedisRateLimit(RateLimitPresets.MODERATE)
  @ApiOperation({ summary: 'Delete a task' })
  @ApiResponse({ status: 204, description: 'Task deleted successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - not your task' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.tasksService.remove(id, userId);
  }

  /**
   * Batch update tasks
   * 
   * Uses single bulk UPDATE query for efficiency
   * Strict rate limiting to prevent abuse
   */
  @Post('batch/update')
  @UseGuards(RolesGuard)
  @Roles('admin', 'user')
  @RedisRateLimit(RateLimitPresets.BATCH)
  @ApiOperation({ summary: 'Batch update multiple tasks' })
  @ApiResponse({ status: 200, description: 'Tasks updated successfully' })
  async batchUpdate(
    @Body() operations: { taskIds: string[]; updates: Partial<UpdateTaskDto> },
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const { taskIds, updates } = operations;
    
    // Admin can update any tasks, users can only update their own
    const targetUserId = userRole === 'admin' ? undefined : userId;
    
    const affected = await this.tasksService.batchUpdate(
      taskIds,
      updates,
      targetUserId,
    );

    return {
      success: true,
      affected,
      message: `Updated ${affected} task(s)`,
    };
  }

  /**
   * Batch delete tasks
   * 
   * Uses single bulk DELETE query for efficiency
   * Strict rate limiting to prevent abuse
   */
  @Post('batch/delete')
  @UseGuards(RolesGuard)
  @Roles('admin', 'user')
  @RedisRateLimit(RateLimitPresets.BATCH)
  @ApiOperation({ summary: 'Batch delete multiple tasks' })
  @ApiResponse({ status: 200, description: 'Tasks deleted successfully' })
  async batchDelete(
    @Body() operations: { taskIds: string[] },
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
  ) {
    const { taskIds } = operations;
    
    // Admin can delete any tasks, users can only delete their own
    const targetUserId = userRole === 'admin' ? undefined : userId;
    
    const affected = await this.tasksService.batchDelete(taskIds, targetUserId);

    return {
      success: true,
      affected,
      message: `Deleted ${affected} task(s)`,
    };
  }
} 