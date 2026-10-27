export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  errorCode?: string;
  details?: Record<string, unknown>;
}

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';
