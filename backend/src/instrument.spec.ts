/**
 * Tests for Sentry instrument.ts initialization and PII redaction.
 *
 * These tests verify that:
 * - Sentry.init() is called with correct configuration
 * - The beforeSend hook redacts PII from events
 * - The beforeBreadcrumb hook redacts PII from breadcrumb data
 */

import * as Sentry from '@sentry/nestjs';

// Mock Sentry.init to capture the config
let capturedConfig: Parameters<typeof Sentry.init>[0];

jest.mock('@sentry/nestjs', () => ({
  init: jest.fn((config) => {
    capturedConfig = config;
  }),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

describe('Sentry Instrument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedConfig = undefined as unknown as Parameters<typeof Sentry.init>[0];
  });

  describe('initialization', () => {
    it('should call Sentry.init with environment config', () => {
      // Re-import to trigger init
      jest.isolateModules(() => {
        process.env.SENTRY_DSN = 'https://test@sentry.io/123';
        process.env.NODE_ENV = 'production';
        require('./instrument');
      });

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://test@sentry.io/123',
          environment: 'production',
          enabled: true,
        }),
      );
    });

    it('should disable Sentry when DSN is not set', () => {
      jest.isolateModules(() => {
        delete process.env.SENTRY_DSN;
        process.env.NODE_ENV = 'development';
        require('./instrument');
      });

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        }),
      );
    });

    it('should use 0.1 tracesSampleRate in production', () => {
      jest.isolateModules(() => {
        process.env.SENTRY_DSN = 'https://test@sentry.io/123';
        process.env.NODE_ENV = 'production';
        require('./instrument');
      });

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 0.1,
        }),
      );
    });

    it('should use 1.0 tracesSampleRate in development', () => {
      jest.isolateModules(() => {
        process.env.SENTRY_DSN = 'https://test@sentry.io/123';
        process.env.NODE_ENV = 'development';
        require('./instrument');
      });

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 1.0,
        }),
      );
    });
  });

  describe('beforeSend PII redaction', () => {
    let beforeSend: NonNullable<Parameters<typeof Sentry.init>[0]>['beforeSend'];

    beforeEach(() => {
      jest.isolateModules(() => {
        process.env.SENTRY_DSN = 'https://test@sentry.io/123';
        process.env.NODE_ENV = 'test';
        require('./instrument');
      });
      beforeSend = capturedConfig?.beforeSend as typeof beforeSend;
    });

    it('should have a beforeSend hook', () => {
      expect(beforeSend).toBeDefined();
      expect(typeof beforeSend).toBe('function');
    });

    it('should redact authorization header', () => {
      const event = {
        request: {
          headers: {
            authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.secret',
            'content-type': 'application/json',
          },
        },
      };

      const result = beforeSend!(event as any, {} as any);

      expect((result as any).request.headers.authorization).toBe('[REDACTED]');
      expect((result as any).request.headers['content-type']).toBe('application/json');
    });

    it('should redact cookie header', () => {
      const event = {
        request: {
          headers: {
            cookie: 'session=abc123; navia-csrf=xyz789',
          },
        },
      };

      const result = beforeSend!(event as any, {} as any);

      expect((result as any).request.headers.cookie).toBe('[REDACTED]');
    });

    it('should redact X-CSRF-Token header', () => {
      const event = {
        request: {
          headers: {
            'x-csrf-token': 'abc123def456',
          },
        },
      };

      const result = beforeSend!(event as any, {} as any);

      expect((result as any).request.headers['x-csrf-token']).toBe('[REDACTED]');
    });

    it('should redact PII from request body JSON', () => {
      const event = {
        request: {
          data: JSON.stringify({
            cpf: '123.456.789-00',
            name: 'Test User',
            email: 'user@example.com',
            password: 'secret123',
          }),
        },
      };

      const result = beforeSend!(event as any, {} as any);
      const parsed = JSON.parse((result as any).request.data);

      expect(parsed.cpf).toBe('[REDACTED]');
      expect(parsed.name).toBe('Test User');
      expect(parsed.email).toBe('u***@example.com');
      expect(parsed.password).toBe('[REDACTED]');
    });

    it('should redact PII from extra context', () => {
      const event = {
        extra: {
          userEmail: 'admin@navia.com.br',
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          companyId: 'uuid-123',
          apiToken: 'secret-token-value',
        },
      };

      const result = beforeSend!(event as any, {} as any);

      expect((result as any).extra.userEmail).toBe('a***@navia.com.br');
      expect((result as any).extra.walletAddress).toBe('0x1234...5678');
      expect((result as any).extra.companyId).toBe('uuid-123');
      expect((result as any).extra.apiToken).toBe('[REDACTED]');
    });

    it('should redact user email keeping first char + domain', () => {
      const event = {
        user: {
          id: 'user-uuid',
          email: 'nelson@navia.com.br',
          ip_address: '192.168.1.42',
        },
      };

      const result = beforeSend!(event as any, {} as any);

      expect((result as any).user.id).toBe('user-uuid');
      expect((result as any).user.email).toBe('n***@navia.com.br');
      expect((result as any).user.ip_address).toBe('192.168.1.0/24');
    });

    it('should remove username from user data', () => {
      const event = {
        user: {
          id: 'user-uuid',
          username: 'Nelson Pereira',
        },
      };

      const result = beforeSend!(event as any, {} as any);

      expect((result as any).user.username).toBeUndefined();
    });

    it('should mask IP address to /24 subnet', () => {
      const event = {
        user: {
          ip_address: '10.0.5.123',
        },
      };

      const result = beforeSend!(event as any, {} as any);

      expect((result as any).user.ip_address).toBe('10.0.5.0/24');
    });

    it('should handle event with no request/user/extra gracefully', () => {
      const event = {
        event_id: 'abc123',
        message: 'Test error',
      };

      const result = beforeSend!(event as any, {} as any);

      expect(result).toBeDefined();
      expect((result as any).event_id).toBe('abc123');
    });

    it('should handle non-JSON request data gracefully', () => {
      const event = {
        request: {
          data: 'plain text body',
        },
      };

      const result = beforeSend!(event as any, {} as any);

      expect((result as any).request.data).toBe('plain text body');
    });

    it('should redact nested PII fields in extra', () => {
      const event = {
        extra: {
          context: {
            ipAddress: '192.168.1.100',
            secretKey: 'my-secret',
          },
        },
      };

      const result = beforeSend!(event as any, {} as any);

      expect((result as any).extra.context.ipAddress).toBe('192.168.1.0/24');
      // secretKey doesn't match exact patterns, should be preserved
      expect((result as any).extra.context.secretKey).toBe('my-secret');
    });

    it('should redact bank account fields', () => {
      const event = {
        extra: {
          bankAccountNumber: '12345-6',
          routingNumber: '001',
        },
      };

      const result = beforeSend!(event as any, {} as any);

      expect((result as any).extra.bankAccountNumber).toBe('[REDACTED]');
      expect((result as any).extra.routingNumber).toBe('[REDACTED]');
    });
  });

  describe('beforeBreadcrumb PII redaction', () => {
    let beforeBreadcrumb: NonNullable<Parameters<typeof Sentry.init>[0]>['beforeBreadcrumb'];

    beforeEach(() => {
      jest.isolateModules(() => {
        process.env.SENTRY_DSN = 'https://test@sentry.io/123';
        process.env.NODE_ENV = 'test';
        require('./instrument');
      });
      beforeBreadcrumb = capturedConfig?.beforeBreadcrumb as typeof beforeBreadcrumb;
    });

    it('should have a beforeBreadcrumb hook', () => {
      expect(beforeBreadcrumb).toBeDefined();
    });

    it('should redact PII from breadcrumb data', () => {
      const breadcrumb = {
        category: 'http',
        data: {
          email: 'user@test.com',
          token: 'bearer-abc',
          url: '/api/v1/test',
        },
      };

      const result = beforeBreadcrumb!(breadcrumb as any, {} as any);

      expect((result as any).data.email).toBe('u***@test.com');
      expect((result as any).data.token).toBe('[REDACTED]');
      expect((result as any).data.url).toBe('/api/v1/test');
    });

    it('should handle breadcrumb with no data', () => {
      const breadcrumb = {
        category: 'navigation',
        message: 'page change',
      };

      const result = beforeBreadcrumb!(breadcrumb as any, {} as any);

      expect(result).toBeDefined();
      expect((result as any).category).toBe('navigation');
    });
  });
});
