import { api, ApiError, setOnUnauthorized } from './api-client';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: () => 'test-request-id' },
});

beforeEach(() => {
  jest.clearAllMocks();
  setOnUnauthorized(null);
  // Reset cookies
  Object.defineProperty(document, 'cookie', {
    writable: true,
    value: '',
  });
});

describe('ApiClient', () => {
  describe('get()', () => {
    it('should make GET request and return data', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ success: true, data: { id: '1', name: 'Test' } }),
      });

      const result = await api.get<{ id: string; name: string }>('/api/v1/test');

      expect(result).toEqual({ id: '1', name: 'Test' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/test',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept-Language': 'pt-BR',
            'X-Request-Id': 'test-request-id',
          }),
        }),
      );
    });

    it('should throw ApiError on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 404,
        json: async () => ({
          success: false,
          error: {
            code: 'NOT_FOUND',
            messageKey: 'errors.notFound',
            details: { id: '1' },
          },
        }),
      });

      let thrownError: unknown;
      try {
        await api.get('/api/v1/missing');
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(ApiError);
      expect(thrownError).toMatchObject({
        code: 'NOT_FOUND',
        messageKey: 'errors.notFound',
        statusCode: 404,
      });
    });

    it('should handle 204 No Content', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 204,
      });

      const result = await api.get('/api/v1/empty');
      expect(result).toBeUndefined();
    });
  });

  describe('post()', () => {
    it('should make POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 201,
        json: async () => ({ success: true, data: { id: '1' } }),
      });

      const result = await api.post<{ id: string }>('/api/v1/create', {
        name: 'Test',
      });

      expect(result).toEqual({ id: '1' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' }),
          credentials: 'include',
        }),
      );
    });
  });

  describe('CSRF token', () => {
    it('should include X-CSRF-Token header on POST requests when cookie exists', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'navia-csrf=test-csrf-token-123',
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ success: true, data: {} }),
      });

      await api.post('/api/v1/action');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-csrf-token-123',
          }),
        }),
      );
    });

    it('should NOT include X-CSRF-Token header on GET requests', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'navia-csrf=test-csrf-token-123',
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ success: true, data: {} }),
      });

      await api.get('/api/v1/read');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-CSRF-Token']).toBeUndefined();
    });
  });

  describe('locale', () => {
    it('should use locale from cookie', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'navia-locale=en',
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ success: true, data: {} }),
      });

      await api.get('/api/v1/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept-Language': 'en',
          }),
        }),
      );
    });

    it('should default to pt-BR when no locale cookie', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ success: true, data: {} }),
      });

      await api.get('/api/v1/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept-Language': 'pt-BR',
          }),
        }),
      );
    });
  });

  describe('401 handling', () => {
    it('should call onUnauthorized callback on 401', async () => {
      const onUnauthorized = jest.fn();
      setOnUnauthorized(onUnauthorized);

      mockFetch.mockResolvedValueOnce({
        status: 401,
      });

      await expect(api.get('/api/v1/protected')).rejects.toThrow(ApiError);
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('should throw ApiError with AUTH_UNAUTHORIZED on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
      });

      await expect(api.get('/api/v1/protected')).rejects.toMatchObject({
        code: 'AUTH_UNAUTHORIZED',
        statusCode: 401,
      });
    });
  });

  describe('getList()', () => {
    it('should return data and meta for paginated responses', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          success: true,
          data: [{ id: '1' }, { id: '2' }],
          meta: { total: 10, page: 1, limit: 20, totalPages: 1 },
        }),
      });

      const result = await api.getList<{ id: string }>('/api/v1/items');

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 10,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });
  });

  describe('put()', () => {
    it('should include CSRF token on PUT requests', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'navia-csrf=csrf-put-token',
      });

      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ success: true, data: {} }),
      });

      await api.put('/api/v1/update/1', { name: 'Updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'csrf-put-token',
          }),
        }),
      );
    });
  });

  describe('delete()', () => {
    it('should make DELETE request with CSRF token', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'navia-csrf=csrf-delete-token',
      });

      mockFetch.mockResolvedValueOnce({
        status: 204,
      });

      await api.delete('/api/v1/items/1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'csrf-delete-token',
          }),
        }),
      );
    });
  });
});
