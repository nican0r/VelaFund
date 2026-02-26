import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import * as Sentry from '@sentry/nestjs';
import { AppException } from './app-exception';
import { ValidationErrorDetail } from '../types/api-response.types';
import { redactPiiFromString } from '../utils/redact-pii';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const lang = this.normalizeLanguage(request.headers['accept-language'] as string);

    if (exception instanceof AppException) {
      // 4xx errors are breadcrumbs only — do not report to Sentry as errors
      if (exception.statusCode >= 400 && exception.statusCode < 500) {
        Sentry.addBreadcrumb({
          category: 'http',
          message: `${exception.code}: ${exception.messageKey}`,
          level: 'warning',
          data: {
            statusCode: exception.statusCode,
            code: exception.code,
            url: request.url,
            method: request.method,
          },
        });
      } else {
        // 5xx AppExceptions — capture at error level with errorCode tag
        Sentry.captureException(exception, {
          level: 'error',
          tags: { errorCode: exception.code },
          extra: {
            statusCode: exception.statusCode,
            messageKey: exception.messageKey,
            url: request.url,
            method: request.method,
          },
        });
      }

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

    // BUG-4 fix: Detect class-validator BadRequestException from ValidationPipe
    // and translate to structured VAL_INVALID_INPUT with validationErrors array.
    if (exception instanceof BadRequestException) {
      const body = exception.getResponse() as Record<string, unknown>;
      const messageArray = body.message;

      if (Array.isArray(messageArray)) {
        const validationErrors: ValidationErrorDetail[] = messageArray.map((msg: string) => {
          // class-validator messages follow the pattern: "fieldName constraint description"
          // Extract the field name from the beginning if possible
          const field = this.extractFieldFromMessage(msg);
          return {
            field,
            message: msg,
            messageKey: 'errors.val.fieldInvalid',
          };
        });

        // Validation errors are 4xx — breadcrumb only
        Sentry.addBreadcrumb({
          category: 'validation',
          message: `Validation failed: ${messageArray.length} error(s)`,
          level: 'info',
          data: {
            url: request.url,
            method: request.method,
            fieldCount: messageArray.length,
          },
        });

        return response.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'VAL_INVALID_INPUT',
            message: lang === 'en' ? 'Invalid input data' : 'Dados de entrada inválidos',
            messageKey: 'errors.val.invalidInput',
            validationErrors,
          },
        });
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as Record<string, unknown>).message;

      // 4xx → breadcrumb, 5xx → capture as error
      if (status >= 500) {
        Sentry.captureException(exception, {
          level: 'error',
          tags: { errorCode: 'SYS_HTTP_ERROR' },
          extra: {
            statusCode: status,
            url: request.url,
            method: request.method,
          },
        });
      } else {
        Sentry.addBreadcrumb({
          category: 'http',
          message: `HTTP ${status}: ${typeof message === 'string' ? message : 'Error'}`,
          level: 'warning',
          data: {
            statusCode: status,
            url: request.url,
            method: request.method,
          },
        });
      }

      return response.status(status).json({
        success: false,
        error: {
          code: 'SYS_HTTP_ERROR',
          message: typeof message === 'string' ? message : 'HTTP Error',
          messageKey: 'errors.sys.httpError',
        },
      });
    }

    // Unhandled exception — capture at fatal level + redact PII from logs
    const rawMessage = exception instanceof Error ? exception.message : 'Unknown error';
    this.logger.error(
      `Unhandled exception: ${redactPiiFromString(rawMessage)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Per error-handling.md: unhandled exceptions → fatal level
    Sentry.captureException(exception, {
      level: 'fatal',
      tags: { errorCode: 'SYS_INTERNAL_ERROR' },
      extra: {
        url: request.url,
        method: request.method,
        requestId: request.headers['x-request-id'],
      },
    });

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: 'SYS_INTERNAL_ERROR',
        message: lang === 'en' ? 'Internal server error' : 'Erro interno do servidor',
        messageKey: 'errors.sys.internalError',
      },
    });
  }

  /**
   * BUG-5 fix: Normalize Accept-Language header to supported locale.
   * Handles 'en-US', 'en-GB', 'en' → 'en' and everything else → 'pt-BR'.
   */
  private normalizeLanguage(acceptLanguage: string | undefined): string {
    if (!acceptLanguage) return 'pt-BR';
    const lang = acceptLanguage.split(',')[0].trim().toLowerCase();
    if (lang.startsWith('en')) return 'en';
    if (lang.startsWith('pt')) return 'pt-BR';
    return 'pt-BR';
  }

  /**
   * Extracts the field name from a class-validator error message.
   * class-validator messages typically start with the property name.
   */
  private extractFieldFromMessage(message: string): string {
    // Match patterns like "property fieldName ..." or "fieldName must be ..." or "fieldName should not ..."
    const match = message.match(/^(?:property\s+)?(\w+)\s+(?:must|should|is|has|each)/i);
    if (match) return match[1];
    // If it includes "should not be empty" or similar, try extracting first word
    const firstWord = message.split(' ')[0];
    if (firstWord && /^[a-zA-Z]\w*$/.test(firstWord)) return firstWord;
    return 'unknown';
  }
}
