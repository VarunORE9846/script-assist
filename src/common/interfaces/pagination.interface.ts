/**
 * Pagination Query Parameters
 * 
 * Supports both offset-based and cursor-based pagination
 */
export interface PaginationParams {
  // Offset-based pagination
  page?: number;
  limit?: number;
  
  // Cursor-based pagination (more efficient for large datasets)
  cursor?: string;
  
  // Sorting
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Paginated Response Interface
 * 
 * Consistent pagination response format across all endpoints
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string | null;
    previousCursor?: string | null;
  };
}

/**
 * Cursor Pagination Response
 * 
 * More efficient for large datasets and real-time data
 */
export interface CursorPaginatedResponse<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    previousCursor: string | null;
    hasMore: boolean;
    count: number;
  };
}

