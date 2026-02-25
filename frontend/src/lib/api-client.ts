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

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/navia-csrf=([^;]+)/);
  return match ? match[1] : null;
}

function getLocale(): string {
  if (typeof document === 'undefined') return 'pt-BR';
  const match = document.cookie.match(/navia-locale=([^;]+)/);
  return match ? match[1] : 'pt-BR';
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Callback to handle 401 responses — set by AuthProvider */
let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(callback: (() => void) | null) {
  onUnauthorized = callback;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  private buildHeaders(method: string, extra?: HeadersInit): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept-Language': getLocale(),
      'X-Request-Id': generateRequestId(),
    };

    // Add CSRF token for state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const csrf = getCsrfToken();
      if (csrf) {
        headers['X-CSRF-Token'] = csrf;
      }
    }

    // Merge any extra headers
    if (extra) {
      const extraEntries =
        extra instanceof Headers
          ? Array.from(extra.entries())
          : Array.isArray(extra)
            ? extra
            : Object.entries(extra);
      for (const [key, value] of extraEntries) {
        headers[key] = value;
      }
    }

    return headers;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const method = options?.method || 'GET';
    const headers = this.buildHeaders(method, options?.headers);

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    // Handle 401 — trigger logout redirect
    if (res.status === 401) {
      onUnauthorized?.();
      throw new ApiError(
        'AUTH_UNAUTHORIZED',
        'errors.auth.unauthorized',
        401,
      );
    }

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
    const method = 'GET';
    const headers = this.buildHeaders(method);

    const res = await fetch(`${this.baseUrl}${path}`, {
      credentials: 'include',
      headers,
    });

    if (res.status === 401) {
      onUnauthorized?.();
      throw new ApiError('AUTH_UNAUTHORIZED', 'errors.auth.unauthorized', 401);
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

  async patch<T>(path: string, data: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete(path: string): Promise<void> {
    return this.request<void>(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
export { ApiError };
