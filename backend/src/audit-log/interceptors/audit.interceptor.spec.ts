import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bull';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AUDITABLE_KEY } from '../decorators/auditable.decorator';

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

function createMockExecutionContext(
  overrides: {
    user?: Record<string, unknown>;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    ip?: string;
    auditBeforeState?: Record<string, unknown>;
  } = {},
): ExecutionContext {
  const request = {
    user: 'user' in overrides ? overrides.user : { id: 'user-uuid-1' },
    params: overrides.params || { companyId: 'company-uuid-1' },
    headers: overrides.headers || {
      'user-agent': 'Mozilla/5.0',
      'x-request-id': 'req-uuid-1',
    },
    ip: overrides.ip || '192.168.1.100',
    ...(overrides.auditBeforeState && {
      auditBeforeState: overrides.auditBeforeState,
    }),
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let reflector: Reflector;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        Reflector,
        { provide: getQueueToken('audit-log'), useValue: mockQueue },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should pass through when no @Auditable decorator', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const context = createMockExecutionContext();
    const next: CallHandler = { handle: () => of({ id: 'resource-1' }) };

    interceptor.intercept(context, next).subscribe({
      next: (value) => {
        expect(value).toEqual({ id: 'resource-1' });
        expect(mockQueue.add).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should queue audit event for decorated handler', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: 'SHAREHOLDER_CREATED',
      resourceType: 'Shareholder',
      captureAfterState: true,
    });

    const context = createMockExecutionContext();
    const responseData = { id: 'shareholder-uuid-1', name: 'João Silva' };
    const next: CallHandler = { handle: () => of(responseData) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        // Allow async tap to complete
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'persist',
            expect.objectContaining({
              actorId: 'user-uuid-1',
              actorType: 'USER',
              action: 'SHAREHOLDER_CREATED',
              resourceType: 'Shareholder',
              resourceId: 'shareholder-uuid-1',
              companyId: 'company-uuid-1',
            }),
            expect.objectContaining({ attempts: 3 }),
          );
          done();
        }, 50);
      },
    });
  });

  it('should capture before state from request', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: 'SHAREHOLDER_UPDATED',
      resourceType: 'Shareholder',
      resourceIdParam: 'id',
      captureBeforeState: true,
      captureAfterState: true,
    });

    const context = createMockExecutionContext({
      params: { companyId: 'company-uuid-1', id: 'shareholder-uuid-1' },
      auditBeforeState: { name: 'Old Name', cpf: '123.456.789-00' },
    });

    const responseData = { id: 'shareholder-uuid-1', name: 'New Name' };
    const next: CallHandler = { handle: () => of(responseData) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'persist',
            expect.objectContaining({
              resourceId: 'shareholder-uuid-1',
              changes: expect.objectContaining({
                before: expect.any(Object),
                after: expect.any(Object),
              }),
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });

  it('should extract resource ID from URL param', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: 'SHAREHOLDER_UPDATED',
      resourceType: 'Shareholder',
      resourceIdParam: 'shareholderId',
    });

    const context = createMockExecutionContext({
      params: { companyId: 'company-uuid-1', shareholderId: 'sh-uuid-1' },
    });

    const next: CallHandler = { handle: () => of({ result: 'ok' }) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'persist',
            expect.objectContaining({
              resourceId: 'sh-uuid-1',
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });

  it('should extract resource ID from response data envelope', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: 'COMPANY_CREATED',
      resourceType: 'Company',
    });

    const context = createMockExecutionContext();
    const responseData = { data: { id: 'company-uuid-new' }, success: true };
    const next: CallHandler = { handle: () => of(responseData) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'persist',
            expect.objectContaining({
              resourceId: 'company-uuid-new',
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });

  it('should redact IP address to /24 subnet', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'User',
    });

    const context = createMockExecutionContext({ ip: '10.0.5.123' });
    const next: CallHandler = { handle: () => of({ id: 'user-1' }) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'persist',
            expect.objectContaining({
              metadata: expect.objectContaining({
                ipAddress: '10.0.5.0/24',
              }),
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });

  it('should handle IPv6-mapped IPv4 addresses', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'User',
    });

    const context = createMockExecutionContext({ ip: '::ffff:192.168.1.50' });
    const next: CallHandler = { handle: () => of({ id: 'user-1' }) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'persist',
            expect.objectContaining({
              metadata: expect.objectContaining({
                ipAddress: '192.168.1.0/24',
              }),
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });

  it('should handle unauthenticated requests as SYSTEM actor', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: 'SYSTEM_EVENT',
      resourceType: 'System',
    });

    const context = createMockExecutionContext({ user: null as any });
    const next: CallHandler = { handle: () => of({ status: 'ok' }) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'persist',
            expect.objectContaining({
              actorId: null,
              actorType: 'SYSTEM',
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });

  it('should not block response on queue failure', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: 'SHAREHOLDER_CREATED',
      resourceType: 'Shareholder',
    });

    mockQueue.add.mockRejectedValueOnce(new Error('Queue unavailable'));

    const context = createMockExecutionContext();
    const next: CallHandler = { handle: () => of({ id: 'resource-1' }) };

    interceptor.intercept(context, next).subscribe({
      next: (value) => {
        // Response still comes through despite queue error
        expect(value).toEqual({ id: 'resource-1' });
        done();
      },
    });
  });

  it('should handle missing companyId', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: 'AUTH_LOGIN_SUCCESS',
      resourceType: 'User',
    });

    const context = createMockExecutionContext({ params: {} });
    const next: CallHandler = { handle: () => of({ id: 'user-1' }) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'persist',
            expect.objectContaining({
              companyId: null,
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });

  it('should include user-agent and request-id in metadata', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue({
      action: 'COMPANY_CREATED',
      resourceType: 'Company',
    });

    const context = createMockExecutionContext({
      headers: {
        'user-agent': 'TestAgent/1.0',
        'x-request-id': 'custom-req-id',
      },
    });
    const next: CallHandler = { handle: () => of({ id: 'company-1' }) };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        setTimeout(() => {
          expect(mockQueue.add).toHaveBeenCalledWith(
            'persist',
            expect.objectContaining({
              metadata: expect.objectContaining({
                userAgent: 'TestAgent/1.0',
                requestId: 'custom-req-id',
                source: 'api',
              }),
            }),
            expect.any(Object),
          );
          done();
        }, 50);
      },
    });
  });
});
