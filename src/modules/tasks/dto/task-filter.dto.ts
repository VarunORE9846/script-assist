import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../enums/task-status.enum';
import { TaskPriority } from '../enums/task-priority.enum';

/**
 * Task Filter DTO
 * 
 * Provides filtering options for task queries:
 * - Status and priority filters
 * - Search by title/description
 * - Date range filters
 * 
 * All filters are optional and can be combined
 */
export class TaskFilterDto {
  @ApiProperty({ 
    enum: TaskStatus, 
    required: false,
    description: 'Filter by task status'
  })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiProperty({ 
    enum: TaskPriority, 
    required: false,
    description: 'Filter by task priority'
  })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiProperty({ 
    required: false,
    description: 'Search in task title and description'
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ 
    required: false,
    description: 'Filter tasks due before this date'
  })
  @IsDateString()
  @IsOptional()
  dueBefore?: Date;

  @ApiProperty({ 
    required: false,
    description: 'Filter tasks due after this date'
  })
  @IsDateString()
  @IsOptional()
  dueAfter?: Date;
}
