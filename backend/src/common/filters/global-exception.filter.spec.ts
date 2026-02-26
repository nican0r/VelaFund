import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { GlobalExceptionFilter } from './global-exception.filter';
import {
  NotFoundException,
  ValidationException,
  BusinessRuleException,
} from './app-exception';

// Mock Sentry before any imports that might use it
jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { headers: Record<string, string>; url: string; method: string };
  let mockHost: { switchToHttp: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      headers: { 'accept-language': 'pt-BR' },
      url: '/api/v1/companies/uuid/shareholders',
      method: 'GET',
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    };
  });

  it('should handle AppException with correct status and envelope', () => {
    const exception = new NotFoundException('company', 'uuid-123');

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'COMPANY_NOT_FOUND',
        message: 'Empresa não encontrada',
        messageKey: 'errors.company.notFound',
        details: { id: 'uuid-123' },
        validationErrors: undefined,
      },
    });
  });

  it('should handle AppException with English locale', () => {
    mockRequest.headers['accept-language'] = 'en';
    const exception = new NotFoundException('company', 'uuid-123');

    filter.catch(exception, mockHost as never);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Company not found',
        }),
      }),
    );
  });

  it('should handle ValidationException', () => {
    const exception = new ValidationException([
      { field: 'cnpj', message: 'Invalid CNPJ', messageKey: 'errors.val.invalidFormat' },
    ]);

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'VAL_INVALID_INPUT',
        message: 'Dados de entrada inválidos',
        messageKey: 'errors.val.invalidInput',
        details: undefined,
        validationErrors: [
          { field: 'cnpj', message: 'Invalid CNPJ', messageKey: 'errors.val.invalidFormat' },
        ],
      },
    });
  });

  it('should handle NestJS HttpException', () => {
    const exception = new HttpException('Bad Gateway', HttpStatus.BAD_GATEWAY);

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'SYS_HTTP_ERROR',
        message: 'Bad Gateway',
        messageKey: 'errors.sys.httpError',
      },
    });
  });

  it('should handle unknown exceptions as 500', () => {
    const exception = new Error('Something unexpected');

    filter.catch(exception, mockHost as never);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'SYS_INTERNAL_ERROR',
        message: 'Erro interno do servidor',
        messageKey: 'errors.sys.internalError',
      },
    });
  });

  // --- Sentry Integration Tests ---

  describe('Sentry reporting', () => {
    it('should add breadcrumb for 4xx AppException (not capture)', () => {
      const exception = new NotFoundException('company', 'uuid-123');

      filter.catch(exception, mockHost as never);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        category: 'http',
        message: 'COMPANY_NOT_FOUND: errors.company.notFound',
        level: 'warning',
        data: {
          statusCode: 404,
          code: 'COMPANY_NOT_FOUND',
          url: '/api/v1/companies/uuid/shareholders',
          method: 'GET',
        },
      });
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('should add breadcrumb for 422 business rule exception', () => {
      const exception = new BusinessRuleException(
        'CAP_INSUFFICIENT_SHARES',
        'errors.cap.insufficientShares',
        { available: 1000, requested: 1500 },
      );

      filter.catch(exception, mockHost as never);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'http',
          level: 'warning',
          data: expect.objectContaining({
            statusCode: 422,
            code: 'CAP_INSUFFICIENT_SHARES',
          }),
        }),
      );
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('should add breadcrumb for BadRequestException validation errors', () => {
      const exception = new BadRequestException({
        message: ['name must be a string', 'email should not be empty'],
        statusCode: 400,
      });

      filter.catch(exception, mockHost as never);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'validation',
          level: 'info',
          data: expect.objectContaining({
            fieldCount: 2,
          }),
        }),
      );
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('should capture 5xx HttpException at error level', () => {
      const exception = new HttpException('Bad Gateway', HttpStatus.BAD_GATEWAY);

      filter.catch(exception, mockHost as never);

      expect(Sentry.captureException).toHaveBeenCalledWith(exception, {
        level: 'error',
        tags: { errorCode: 'SYS_HTTP_ERROR' },
        extra: {
          statusCode: 502,
          url: '/api/v1/companies/uuid/shareholders',
          method: 'GET',
        },
      });
      expect(Sentry.addBreadcrumb).not.toHaveBeenCalled();
    });

    it('should add breadcrumb for 4xx HttpException', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost as never);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'http',
          level: 'warning',
          data: expect.objectContaining({
            statusCode: 403,
          }),
        }),
      );
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('should capture unhandled exceptions at fatal level', () => {
      const exception = new Error('Something exploded');

      filter.catch(exception, mockHost as never);

      expect(Sentry.captureException).toHaveBeenCalledWith(exception, {
        level: 'fatal',
        tags: { errorCode: 'SYS_INTERNAL_ERROR' },
        extra: {
          url: '/api/v1/companies/uuid/shareholders',
          method: 'GET',
          requestId: undefined,
        },
      });
    });

    it('should include requestId in fatal exception context', () => {
      mockRequest.headers['x-request-id'] = 'req-uuid-123';
      const exception = new Error('Database connection failed');

      filter.catch(exception, mockHost as never);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        exception,
        expect.objectContaining({
          extra: expect.objectContaining({
            requestId: 'req-uuid-123',
          }),
        }),
      );
    });

    it('should capture 503 HttpException at error level (not breadcrumb)', () => {
      const exception = new HttpException('Service Unavailable', HttpStatus.SERVICE_UNAVAILABLE);

      filter.catch(exception, mockHost as never);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        exception,
        expect.objectContaining({
          level: 'error',
          extra: expect.objectContaining({
            statusCode: 503,
          }),
        }),
      );
    });
  });
});
