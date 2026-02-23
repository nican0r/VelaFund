import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AppException } from './app-exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const lang = (request.headers['accept-language'] as string) || 'pt-BR';

    if (exception instanceof AppException) {
      return response.status(exception.statusCode).json({
        success: false,
        error: {
          code: exception.code,
          message: exception.getLocalizedMessage(lang),
          messageKey: exception.messageKey,
          details: exception.details,
          validationErrors: exception.validationErrors,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as Record<string, unknown>).message;

      return response.status(status).json({
        success: false,
        error: {
          code: 'SYS_HTTP_ERROR',
          message: typeof message === 'string' ? message : 'HTTP Error',
          messageKey: 'errors.sys.httpError',
        },
      });
    }

    // Unhandled exception
    this.logger.error(
      `Unhandled exception: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'SYS_INTERNAL_ERROR',
        message: lang === 'en' ? 'Internal server error' : 'Erro interno do servidor',
        messageKey: 'errors.sys.internalError',
      },
    });
  }
}
