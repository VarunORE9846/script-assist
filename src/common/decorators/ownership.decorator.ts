import { SetMetadata } from '@nestjs/common';
import { OWNERSHIP_CHECK_KEY, OwnershipConfig } from '../guards/ownership.guard';

/**
 * Ownership Check Decorator
 * 
 * Enforces that users can only access/modify their own resources
 * 
 * Usage Examples:
 * 
 * 1. Basic task ownership check:
 *    @CheckOwnership({ entity: 'task', paramKey: 'id', userIdField: 'userId' })
 *    @Patch('tasks/:id')
 *    update() {}
 * 
 * 2. With admin bypass:
 *    @CheckOwnership({ entity: 'task', paramKey: 'id', userIdField: 'userId', allowAdmin: true })
 *    @Delete('tasks/:id')
 *    delete() {}
 * 
 * 3. Custom param key:
 *    @CheckOwnership({ entity: 'task', paramKey: 'taskId', userIdField: 'userId' })
 *    @Get('projects/:projectId/tasks/:taskId')
 *    getTask() {}
 * 
 * @param config - Ownership configuration
 * @returns Method decorator
 */
export const CheckOwnership = (config: OwnershipConfig) =>
  SetMetadata(OWNERSHIP_CHECK_KEY, config);

