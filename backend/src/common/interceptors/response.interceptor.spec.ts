import { ExecutionContext, CallHandler, HttpStatus } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  function createMockContext(statusCode: number): ExecutionContext {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode }),
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  function createMockCallHandler(data: unknown): CallHandler {
    return { handle: () => of(data) };
  }

  it('should wrap plain data in success envelope', (done) => {
    const context = createMockContext(HttpStatus.OK);
    const handler = createMockCallHandler({ id: '123', name: 'Test' });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: { id: '123', name: 'Test' },
      });
      done();
    });
  });

  it('should pass through data already in envelope format', (done) => {
    const context = createMockContext(HttpStatus.OK);
    const envelopedData = { success: true, data: [{ id: '1' }], meta: { total: 1 } };
    const handler = createMockCallHandler(envelopedData);

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual(envelopedData);
      done();
    });
  });

  it('should return undefined for 204 No Content', (done) => {
    const context = createMockContext(HttpStatus.NO_CONTENT);
    const handler = createMockCallHandler(null);

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toBeUndefined();
      done();
    });
  });
});
