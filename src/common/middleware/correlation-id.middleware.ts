import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID Middleware
 * 
 * Generates or extracts correlation IDs for request tracking:
 * - Accepts existing correlation ID from header (X-Correlation-ID)
 * - Generates new UUID if not provided
 * - Attaches to request object for use in logging
 * - Includes in response headers for client tracking
 * 
 * Benefits:
 * - End-to-end request tracing across services
 * - Easier debugging of distributed systems
 * - Log aggregation and correlation
 * - Client-side error tracking
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Check for existing correlation ID in headers
    const correlationId = 
      req.headers['x-correlation-id'] as string ||
      req.headers['x-request-id'] as string ||
      uuidv4();

    // Attach to request object for use in controllers/services
    (req as any).id = correlationId;
    (req as any).correlationId = correlationId;

    // Add to response headers
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }
}

