import { PaginatedResponse, PaginationParams } from '../interfaces/pagination.interface';
import { SelectQueryBuilder } from 'typeorm';

/**
 * Pagination Utility
 * 
 * Provides helper functions for efficient database-level pagination:
 * - Offset-based pagination (traditional)
 * - Cursor-based pagination (for large datasets)
 * - Consistent metadata generation
 * - Query builder integration
 * 
 * Performance benefits:
 * - DB-level LIMIT/OFFSET (no in-memory slicing)
 * - Efficient COUNT queries
 * - Prevents loading all records into memory
 */
export class PaginationUtil {
  /**
   * Default pagination values
   */
  private static readonly DEFAULT_PAGE = 1;
  private static readonly DEFAULT_LIMIT = 10;
  private static readonly MAX_LIMIT = 100;

  /**
   * Apply pagination to TypeORM query builder
   * 
   * @param queryBuilder - TypeORM query builder
   * @param params - Pagination parameters
   * @returns Modified query builder
   */
  static applyPagination<T>(
    queryBuilder: SelectQueryBuilder<T>,
    params: PaginationParams,
  ): SelectQueryBuilder<T> {
    const page = Math.max(params.page || this.DEFAULT_PAGE, 1);
    const limit = Math.min(
      params.limit || this.DEFAULT_LIMIT,
      this.MAX_LIMIT,
    );

    const skip = (page - 1) * limit;

    return queryBuilder.skip(skip).take(limit);
  }

  /**
   * Apply sorting to TypeORM query builder
   * 
   * @param queryBuilder - TypeORM query builder
   * @param params - Pagination parameters
   * @param alias - Entity alias
   * @param defaultSortBy - Default sort field
   * @returns Modified query builder
   */
  static applySorting<T>(
    queryBuilder: SelectQueryBuilder<T>,
    params: PaginationParams,
    alias: string,
    defaultSortBy = 'createdAt',
  ): SelectQueryBuilder<T> {
    const sortBy = params.sortBy || defaultSortBy;
    const sortOrder = params.sortOrder || 'DESC';

    // Sanitize sort field to prevent SQL injection
    const safeSortBy = sortBy.replace(/[^a-zA-Z0-9_]/g, '');

    return queryBuilder.orderBy(`${alias}.${safeSortBy}`, sortOrder);
  }

  /**
   * Execute paginated query and build response
   * 
   * @param queryBuilder - TypeORM query builder
   * @param params - Pagination parameters
   * @returns Paginated response
   */
  static async paginate<T>(
    queryBuilder: SelectQueryBuilder<T>,
    params: PaginationParams,
  ): Promise<PaginatedResponse<T>> {
    const page = Math.max(params.page || this.DEFAULT_PAGE, 1);
    const limit = Math.min(
      params.limit || this.DEFAULT_LIMIT,
      this.MAX_LIMIT,
    );

    // Get total count and data in parallel for better performance
    const [data, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        nextCursor: hasNextPage ? this.encodeCursor(page + 1) : null,
        previousCursor: hasPreviousPage ? this.encodeCursor(page - 1) : null,
      },
    };
  }

  /**
   * Build paginated response from data and count
   * 
   * Useful when you already have the data and count
   * 
   * @param data - Array of data
   * @param total - Total count
   * @param params - Pagination parameters
   * @returns Paginated response
   */
  static buildResponse<T>(
    data: T[],
    total: number,
    params: PaginationParams,
  ): PaginatedResponse<T> {
    const page = Math.max(params.page || this.DEFAULT_PAGE, 1);
    const limit = Math.min(
      params.limit || this.DEFAULT_LIMIT,
      this.MAX_LIMIT,
    );

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        nextCursor: hasNextPage ? this.encodeCursor(page + 1) : null,
        previousCursor: hasPreviousPage ? this.encodeCursor(page - 1) : null,
      },
    };
  }

  /**
   * Encode cursor (Base64 encode page number or ID)
   * 
   * @param value - Value to encode
   * @returns Encoded cursor
   */
  private static encodeCursor(value: number | string): string {
    return Buffer.from(value.toString()).toString('base64');
  }

  /**
   * Decode cursor
   * 
   * @param cursor - Encoded cursor
   * @returns Decoded value
   */
  static decodeCursor(cursor: string): string {
    try {
      return Buffer.from(cursor, 'base64').toString('utf-8');
    } catch (error) {
      throw new Error('Invalid cursor format');
    }
  }

  /**
   * Validate and sanitize pagination parameters
   * 
   * @param params - Raw pagination parameters
   * @returns Sanitized parameters
   */
  static validateParams(params: PaginationParams): PaginationParams {
    return {
      page: Math.max(parseInt(params.page?.toString() || '1', 10), 1),
      limit: Math.min(
        Math.max(parseInt(params.limit?.toString() || '10', 10), 1),
        this.MAX_LIMIT,
      ),
      sortBy: params.sortBy,
      sortOrder: params.sortOrder === 'ASC' ? 'ASC' : 'DESC',
      cursor: params.cursor,
    };
  }
}

