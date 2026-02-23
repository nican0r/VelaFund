import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';
import { AppException, NotFoundException, ValidationException } from './app-exception';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { headers: Record<string, string> };
  let mockHost: { switchToHttp: jest.Mock };

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = { headers: { 'accept-language': 'pt-BR' } };
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
});
