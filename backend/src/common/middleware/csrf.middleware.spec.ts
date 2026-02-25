import { CsrfMiddleware } from './csrf.middleware';
import { Request, Response, NextFunction } from 'express';

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new CsrfMiddleware();
    mockNext = jest.fn();
    mockReq = {
      method: 'GET',
      headers: {},
      cookies: {},
    };
    mockRes = {
      cookie: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  // ───── Safe HTTP Methods (GET, HEAD, OPTIONS) ─────

  describe('GET requests', () => {
    it('should set navia-csrf cookie with random token', () => {
      mockReq.method = 'GET';

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'navia-csrf',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          sameSite: 'strict',
          path: '/',
        }),
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should set a 64-character hex token (32 bytes)', () => {
      mockReq.method = 'GET';

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      const token = (mockRes.cookie as jest.Mock).mock.calls[0][1];
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should set secure=false when NODE_ENV is not production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      mockReq.method = 'GET';

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'navia-csrf',
        expect.any(String),
        expect.objectContaining({ secure: false }),
      );
      process.env.NODE_ENV = originalEnv;
    });

    it('should set secure=true when NODE_ENV is production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      mockReq.method = 'GET';

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'navia-csrf',
        expect.any(String),
        expect.objectContaining({ secure: true }),
      );
      process.env.NODE_ENV = originalEnv;
    });

    it('should generate different tokens on each GET request', () => {
      mockReq.method = 'GET';

      middleware.use(mockReq as Request, mockRes as Response, mockNext);
      const token1 = (mockRes.cookie as jest.Mock).mock.calls[0][1];

      middleware.use(mockReq as Request, mockRes as Response, mockNext);
      const token2 = (mockRes.cookie as jest.Mock).mock.calls[1][1];

      expect(token1).not.toEqual(token2);
    });
  });

  describe('HEAD requests', () => {
    it('should set navia-csrf cookie and call next', () => {
      mockReq.method = 'HEAD';

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'navia-csrf',
        expect.any(String),
        expect.any(Object),
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('OPTIONS requests', () => {
    it('should set navia-csrf cookie and call next', () => {
      mockReq.method = 'OPTIONS';

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'navia-csrf',
        expect.any(String),
        expect.any(Object),
      );
      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ───── Bearer Token Bypass ─────

  describe('Bearer token bypass', () => {
    it('should skip CSRF validation for POST with Bearer token', () => {
      mockReq.method = 'POST';
      mockReq.headers = { authorization: 'Bearer some-jwt-token' };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF validation for PUT with Bearer token', () => {
      mockReq.method = 'PUT';
      mockReq.headers = { authorization: 'Bearer some-jwt-token' };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should skip CSRF validation for PATCH with Bearer token', () => {
      mockReq.method = 'PATCH';
      mockReq.headers = { authorization: 'Bearer some-jwt-token' };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip CSRF validation for DELETE with Bearer token', () => {
      mockReq.method = 'DELETE';
      mockReq.headers = { authorization: 'Bearer some-jwt-token' };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should NOT skip CSRF for non-Bearer authorization headers', () => {
      mockReq.method = 'POST';
      mockReq.headers = { authorization: 'Basic dXNlcjpwYXNz' };
      mockReq.cookies = {};

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // ───── CSRF Validation (Cookie-based auth) ─────

  describe('CSRF validation for state-changing requests', () => {
    const csrfToken = 'a'.repeat(64);

    it('should allow POST when CSRF tokens match', () => {
      mockReq.method = 'POST';
      mockReq.cookies = { 'navia-csrf': csrfToken };
      mockReq.headers = { 'x-csrf-token': csrfToken };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow PUT when CSRF tokens match', () => {
      mockReq.method = 'PUT';
      mockReq.cookies = { 'navia-csrf': csrfToken };
      mockReq.headers = { 'x-csrf-token': csrfToken };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow PATCH when CSRF tokens match', () => {
      mockReq.method = 'PATCH';
      mockReq.cookies = { 'navia-csrf': csrfToken };
      mockReq.headers = { 'x-csrf-token': csrfToken };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow DELETE when CSRF tokens match', () => {
      mockReq.method = 'DELETE';
      mockReq.cookies = { 'navia-csrf': csrfToken };
      mockReq.headers = { 'x-csrf-token': csrfToken };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject POST when CSRF cookie is missing', () => {
      mockReq.method = 'POST';
      mockReq.cookies = {};
      mockReq.headers = { 'x-csrf-token': csrfToken };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_CSRF_INVALID',
          message: 'Token CSRF inválido',
          messageKey: 'errors.auth.csrfInvalid',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject POST when CSRF header is missing', () => {
      mockReq.method = 'POST';
      mockReq.cookies = { 'navia-csrf': csrfToken };
      mockReq.headers = {};

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject POST when CSRF tokens do not match', () => {
      mockReq.method = 'POST';
      mockReq.cookies = { 'navia-csrf': csrfToken };
      mockReq.headers = { 'x-csrf-token': 'b'.repeat(64) };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when both CSRF cookie and header are missing', () => {
      mockReq.method = 'POST';
      mockReq.cookies = {};
      mockReq.headers = {};

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when cookies object is undefined', () => {
      mockReq.method = 'POST';
      mockReq.cookies = undefined;
      mockReq.headers = { 'x-csrf-token': csrfToken };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  // ───── i18n Error Messages ─────

  describe('i18n error messages', () => {
    it('should return PT-BR error message by default', () => {
      mockReq.method = 'POST';
      mockReq.cookies = {};
      mockReq.headers = {};

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Token CSRF inválido',
          }),
        }),
      );
    });

    it('should return PT-BR error message for pt-BR Accept-Language', () => {
      mockReq.method = 'POST';
      mockReq.cookies = {};
      mockReq.headers = { 'accept-language': 'pt-BR' };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Token CSRF inválido',
          }),
        }),
      );
    });

    it('should return EN error message for en Accept-Language', () => {
      mockReq.method = 'POST';
      mockReq.cookies = {};
      mockReq.headers = { 'accept-language': 'en' };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Invalid CSRF token',
          }),
        }),
      );
    });

    it('should return EN for en-US Accept-Language', () => {
      mockReq.method = 'POST';
      mockReq.cookies = {};
      mockReq.headers = { 'accept-language': 'en-US,en;q=0.9' };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Invalid CSRF token',
          }),
        }),
      );
    });

    it('should default to PT-BR for unsupported languages', () => {
      mockReq.method = 'POST';
      mockReq.cookies = {};
      mockReq.headers = { 'accept-language': 'fr-FR' };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Token CSRF inválido',
          }),
        }),
      );
    });

    it('should always include error code and messageKey', () => {
      mockReq.method = 'POST';
      mockReq.cookies = {};
      mockReq.headers = {};

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_CSRF_INVALID',
          message: expect.any(String),
          messageKey: 'errors.auth.csrfInvalid',
        },
      });
    });
  });

  // ───── Edge Cases ─────

  describe('edge cases', () => {
    it('should handle empty authorization header without crashing', () => {
      mockReq.method = 'POST';
      mockReq.headers = { authorization: '' };
      mockReq.cookies = {};

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      // Empty auth header is not Bearer, so CSRF should be validated
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle "Bearer " with no token (just prefix)', () => {
      mockReq.method = 'POST';
      mockReq.headers = { authorization: 'Bearer ' };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      // "Bearer " starts with "Bearer " so it bypasses CSRF
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not set cookie on POST even when tokens match', () => {
      const csrfToken = 'a'.repeat(64);
      mockReq.method = 'POST';
      mockReq.cookies = { 'navia-csrf': csrfToken };
      mockReq.headers = { 'x-csrf-token': csrfToken };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.cookie).not.toHaveBeenCalled();
    });

    it('should handle case-sensitive header names', () => {
      const csrfToken = 'a'.repeat(64);
      mockReq.method = 'POST';
      mockReq.cookies = { 'navia-csrf': csrfToken };
      // Express normalizes header names to lowercase
      mockReq.headers = { 'x-csrf-token': csrfToken };

      middleware.use(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
