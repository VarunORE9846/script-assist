import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

/**
 * Enhanced Logging Interceptor
 * 
 * Provides comprehensive request/response logging with:
 * - Request correlation IDs
 * - Performance timing
 * - User context (when authenticated)
 * - Request/response payload sizes
 * - Error tracking
 * - Structured logging format
 * 
 * Security considerations:
 * - Excludes sensitive headers (Authorization, Cookie)
 * - Sanitizes passwords from request bodies
 * - Limits payload logging size
 */
@Injectable()
export class EnhancedLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly MAX_BODY_LOG_SIZE = 1000; // characters

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();
    
    const {
      method,
      url,
      headers,
      body,
      query,
      params,
    } = request;

    // Extract metadata
    const correlationId = (request as any).id || 'unknown';
    const userId = (request as any).user?.id || 'anonymous';
    const userAgent = headers['user-agent'] || 'unknown';
    const ip = this.getIpAddress(request);
    
    const startTime = Date.now();

    // Log incoming request
    this.logRequest({
      correlationId,
      method,
      url,
      userId,
      ip,
      userAgent,
      query: this.sanitize(query),
      params: this.sanitize(params),
      bodySize: body ? JSON.stringify(body).length : 0,
    });

    return next.handle().pipe(
      tap((data) => {
        // Log successful response
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        
        this.logResponse({
          correlationId,
          method,
          url,
          statusCode,
          duration,
          userId,
          responseSize: data ? JSON.stringify(data).length : 0,
        });
      }),
      catchError((error) => {
        // Log error response
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;
        
        this.logError({
          correlationId,
          method,
          url,
          statusCode,
          duration,
          userId,
          error: error.message,
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Log incoming request
   */
  private logRequest(data: any): void {
    this.logger.log(
      `→ ${data.method} ${data.url} | ` +
      `User: ${data.userId} | ` +
      `IP: ${data.ip} | ` +
      `Correlation: ${data.correlationId}`,
    );

    // Debug level for detailed information
    this.logger.debug(
      JSON.stringify({
        type: 'request',
        ...data,
      }),
    );
  }

  /**
   * Log successful response
   */
  private logResponse(data: any): void {
    const logLevel = data.statusCode >= 400 ? 'warn' : 'log';
    
    this.logger[logLevel](
      `← ${data.method} ${data.url} | ` +
      `Status: ${data.statusCode} | ` +
      `Duration: ${data.duration}ms | ` +
      `User: ${data.userId} | ` +
      `Correlation: ${data.correlationId}`,
    );

    // Debug level for detailed information
    this.logger.debug(
      JSON.stringify({
        type: 'response',
        ...data,
      }),
    );
  }

  /**
   * Log error response
   */
  private logError(data: any): void {
    this.logger.error(
      `✗ ${data.method} ${data.url} | ` +
      `Status: ${data.statusCode} | ` +
      `Duration: ${data.duration}ms | ` +
      `Error: ${data.error} | ` +
      `User: ${data.userId} | ` +
      `Correlation: ${data.correlationId}`,
    );
  }

  /**
   * Extract IP address from request
   */
  private getIpAddress(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.ip ||
      request.connection?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Sanitize object for logging
   * Removes sensitive fields and limits size
   */
  private sanitize(obj: any): any {
    if (!obj) return obj;
    
    const sanitized = { ...obj };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    const str = JSON.stringify(sanitized);
    if (str.length > this.MAX_BODY_LOG_SIZE) {
      return `[TRUNCATED: ${str.length} chars]`;
    }

    return sanitized;
  }
}

