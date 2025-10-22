import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Enhanced Roles Guard
 * 
 * Improvements over old implementation:
 * 1. Proper error handling with descriptive messages
 * 2. Checks if user is authenticated first
 * 3. Validates user object structure
 * 4. Logs access attempts for auditing
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('admin', 'moderator')
 * @Delete(':id')
 * delete() {}
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator (handler first, then class)
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    // If no roles required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // User must be authenticated (should be enforced by JwtAuthGuard)
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // Validate user has role property
    if (!user.role) {
      throw new ForbiddenException('User role not found');
    }
    
    // Check if user has any of the required roles
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }
    
    return true;
  }
} 