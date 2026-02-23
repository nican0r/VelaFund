export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface PaginatedApiResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    messageKey: string;
    details?: Record<string, unknown>;
    validationErrors?: ValidationError[];
  };
}

export interface ValidationError {
  field: string;
  message: string;
  messageKey: string;
}
