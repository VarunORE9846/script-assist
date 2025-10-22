import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../modules/tasks/entities/task.entity';

/**
 * Metadata key for ownership check configuration
 */
export const OWNERSHIP_CHECK_KEY = 'ownershipCheck';

/**
 * Ownership Check Configuration
 */
export interface OwnershipConfig {
  entity: string; // 'task', 'user', etc.
  paramKey: string; // Parameter name in route (e.g., 'id')
  userIdField: string; // Field name in entity that contains owner ID (e.g., 'userId')
  allowAdmin?: boolean; // Allow admin role to bypass check
}

/**
 * Ownership Guard
 * 
 * SECURITY FIX: Prevents users from accessing/modifying resources they don't own
 * 
 * The old implementation had NO ownership checks, allowing any authenticated user
 * to read, update, or delete ANY task!
 * 
 * This guard:
 * 1. Validates resource exists
 * 2. Checks if user owns the resource
 * 3. Optionally allows admin override
 * 4. Returns proper error messages
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard, OwnershipGuard)
 * @CheckOwnership({ entity: 'task', paramKey: 'id', userIdField: 'userId', allowAdmin: true })
 * @Patch(':id')
 * update(@Param('id') id: string) {}
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    // Add more repositories as needed for other entities
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get ownership configuration from decorator
    const config = this.reflector.get<OwnershipConfig>(
      OWNERSHIP_CHECK_KEY,
      context.getHandler(),
    );

    // If no config, skip ownership check
    if (!config) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated (should be enforced by JwtAuthGuard)
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Admin bypass if configured
    if (config.allowAdmin && user.role === 'admin') {
      return true;
    }

    // Get resource ID from route parameters
    const resourceId = request.params[config.paramKey];

    if (!resourceId) {
      throw new ForbiddenException('Resource ID not found in request');
    }

    // Check ownership based on entity type
    const isOwner = await this.checkOwnership(
      config.entity,
      resourceId,
      user.id,
      config.userIdField,
    );

    if (!isOwner) {
      throw new ForbiddenException(
        'You do not have permission to access this resource',
      );
    }

    return true;
  }

  /**
   * Check if user owns the resource
   * 
   * @param entity - Entity type
   * @param resourceId - Resource ID
   * @param userId - User ID
   * @param userIdField - Field name containing owner ID
   * @returns true if user owns resource
   */
  private async checkOwnership(
    entity: string,
    resourceId: string,
    userId: string,
    userIdField: string,
  ): Promise<boolean> {
    let resource: any;

    // Fetch resource based on entity type
    switch (entity) {
      case 'task':
        resource = await this.taskRepository.findOne({
          where: { id: resourceId },
        });
        break;
      // Add more cases for other entities
      default:
        throw new Error(`Unsupported entity type: ${entity}`);
    }

    // Resource not found
    if (!resource) {
      throw new NotFoundException(`${entity} not found`);
    }

    // Check if user owns the resource
    return resource[userIdField] === userId;
  }
}

