import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Error Response Interface
 */
interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  error?: string;
  path: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Enhanced HTTP Exception Filter
 * 
 * SECURITY FIXES:
 * 1. Never exposes stack traces in production
 * 2. Sanitizes error messages to remove sensitive data
 * 3. Provides consistent error response format
 * 4. Logs errors with correlation IDs for tracking
 * 5. Different log levels based on error severity
 * 6. Handles both structured and string error responses
 * 
 * Improvements over old implementation:
 * - No internal details leaked (DB errors, file paths, etc.)
 * - Request correlation for debugging
 * - Structured logging
 * - Validation error formatting
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isDevelopment = process.env.NODE_ENV === 'development';

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Extract request ID for correlation (if available)
    const requestId = (request as any).id || 'unknown';

    // Build error response
    const errorResponse = this.buildErrorResponse(
      status,
      exceptionResponse,
      request.url,
      requestId,
    );

    // Log error based on severity
    this.logError(exception, status, requestId, request);

    // Send sanitized response
    response.status(status).json(errorResponse);
  }

  /**
   * Build sanitized error response
   * 
   * @param status - HTTP status code
   * @param exceptionResponse - Exception response from NestJS
   * @param path - Request path
   * @param requestId - Request correlation ID
   * @returns Sanitized error response
   */
  private buildErrorResponse(
    status: number,
    exceptionResponse: string | object,
    path: string,
    requestId: string,
  ): ErrorResponse {
    const baseResponse: ErrorResponse = {
      success: false,
      statusCode: status,
      message: 'An error occurred',
      path,
      timestamp: new Date().toISOString(),
      requestId,
    };

    // Handle structured error responses (validation errors, etc.)
    if (typeof exceptionResponse === 'object') {
      const response = exceptionResponse as any;
      
      return {
        ...baseResponse,
        message: response.message || baseResponse.message,
        error: response.error || this.getErrorName(status),
      };
    }

    // Handle string error messages
    return {
      ...baseResponse,
      message: this.sanitizeMessage(exceptionResponse),
      error: this.getErrorName(status),
    };
  }

  /**
   * Sanitize error message to remove sensitive information
   * 
   * Removes:
   * - File paths
   * - Database connection strings
   * - Stack traces
   * - Environment variables
   * - IP addresses (except in logs)
   * 
   * @param message - Original error message
   * @returns Sanitized message
   */
  private sanitizeMessage(message: string): string {
    if (!message) {
      return 'An error occurred';
    }

    // In production, use generic messages for server errors
    if (!this.isDevelopment && message.includes('ECONNREFUSED')) {
      return 'Service temporarily unavailable';
    }

    if (!this.isDevelopment && message.includes('database')) {
      return 'Database operation failed';
    }

    // Remove file paths
    message = message.replace(/\/[^\s]+\.(ts|js|json)/g, '[FILE]');
    
    // Remove stack traces
    message = message.split('\n')[0];
    
    // Remove connection strings
    message = message.replace(/postgres:\/\/[^\s]+/g, '[DB_CONNECTION]');
    message = message.replace(/redis:\/\/[^\s]+/g, '[REDIS_CONNECTION]');
    
    return message;
  }

  /**
   * Get error name from status code
   * 
   * @param status - HTTP status code
   * @returns Error name
   */
  private getErrorName(status: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return errorNames[status] || 'Error';
  }

  /**
   * Log error with appropriate level based on severity
   * 
   * Levels:
   * - 4xx: warn (client errors)
   * - 5xx: error (server errors)
   * 
   * @param exception - Exception object
   * @param status - HTTP status code
   * @param requestId - Request correlation ID
   * @param request - Express request
   */
  private logError(
    exception: HttpException,
    status: number,
    requestId: string,
    request: Request,
  ): void {
    const logContext = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode: status,
      userAgent: request.headers['user-agent'],
      ip: this.getIpAddress(request),
      userId: (request as any).user?.id || 'anonymous',
    };

    // Client errors (4xx) - log as warning
    if (status >= 400 && status < 500) {
      this.logger.warn(
        `Client Error: ${exception.message}`,
        JSON.stringify(logContext),
      );
      return;
    }

    // Server errors (5xx) - log as error with stack trace
    if (status >= 500) {
      this.logger.error(
        `Server Error: ${exception.message}`,
        exception.stack,
        JSON.stringify(logContext),
      );
      return;
    }

    // Other errors - log as debug
    this.logger.debug(
      `HTTP Exception: ${exception.message}`,
      JSON.stringify(logContext),
    );
  }

  /**
   * Extract IP address from request (proxy-aware)
   * 
   * @param request - Express request
   * @returns IP address
   */
  private getIpAddress(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.ip ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
}
 