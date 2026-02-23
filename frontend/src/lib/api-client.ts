import type { PaginationMeta } from '@/types/api';

class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly messageKey: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
    public readonly validationErrors?: Array<{
      field: string;
      message: string;
      messageKey: string;
    }>,
  ) {
    super(messageKey);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'pt-BR',
        ...options?.headers,
      },
    });

    if (res.status === 204) {
      return undefined as T;
    }

    const body = await res.json();

    if (!body.success) {
      throw new ApiError(
        body.error.code,
        body.error.messageKey,
        res.status,
        body.error.details,
        body.error.validationErrors,
      );
    }

    return body.data;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async getList<T>(path: string): Promise<{ data: T[]; meta: PaginationMeta }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'pt-BR',
      },
    });

    const body = await res.json();
    if (!body.success) {
      throw new ApiError(
        body.error.code,
        body.error.messageKey,
        res.status,
        body.error.details,
        body.error.validationErrors,
      );
    }

    return { data: body.data, meta: body.meta };
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(path: string): Promise<void> {
    return this.request<void>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
export { ApiError };
