import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AUDITABLE_KEY, AuditableOptions } from '../decorators/auditable.decorator';
import { redactPii } from '../../common/utils/redact-pii';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectQueue('audit-log') private readonly auditQueue: Queue,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditableOptions>(AUDITABLE_KEY, context.getHandler());

    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.params?.companyId || null;

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const beforeState: Record<string, unknown> | null =
            options.captureBeforeState && request['auditBeforeState']
              ? redactPii(request['auditBeforeState'])
              : null;

          const afterState: Record<string, unknown> | null =
            options.captureAfterState && responseData
              ? redactPii(this.extractData(responseData))
              : null;

          const event = {
            actorId: user?.id || null,
            actorType: user ? 'USER' : 'SYSTEM',
            action: options.action,
            resourceType: options.resourceType,
            resourceId: this.extractResourceId(responseData, request, options),
            companyId,
            changes: beforeState || afterState ? { before: beforeState, after: afterState } : null,
            metadata: {
              ipAddress: this.redactIp(request.ip),
              userAgent: request.headers?.['user-agent'] || '',
              requestId: request.headers?.['x-request-id'] || '',
              source: 'api',
            },
          };

          await this.auditQueue.add('persist', event, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
          });
        } catch (error) {
          this.logger.warn(
            `Failed to queue audit event for ${options.action}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }),
    );
  }

  private extractResourceId(
    responseData: unknown,
    request: { params?: Record<string, string> },
    options: AuditableOptions,
  ): string | null {
    if (options.resourceIdParam && request.params?.[options.resourceIdParam]) {
      return request.params[options.resourceIdParam];
    }
    if (responseData && typeof responseData === 'object' && 'id' in responseData) {
      return (responseData as Record<string, unknown>).id as string;
    }
    if (responseData && typeof responseData === 'object' && 'data' in responseData) {
      const data = (responseData as Record<string, unknown>).data;
      if (data && typeof data === 'object' && 'id' in data) {
        return (data as Record<string, unknown>).id as string;
      }
    }
    return null;
  }

  private extractData(responseData: unknown): Record<string, unknown> | null {
    if (!responseData || typeof responseData !== 'object') return null;
    if ('data' in responseData) {
      const data = (responseData as Record<string, unknown>).data;
      if (data && typeof data === 'object') {
        return data as Record<string, unknown>;
      }
    }
    return responseData as Record<string, unknown>;
  }

  private redactIp(ip: string | undefined): string {
    if (!ip) return 'unknown';
    const cleaned = ip.replace('::ffff:', '');
    const parts = cleaned.split('.');
    if (parts.length === 4) {
      parts[3] = '0/24';
      return parts.join('.');
    }
    return ip;
  }
}
