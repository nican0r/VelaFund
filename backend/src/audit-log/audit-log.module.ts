import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogProcessor } from './audit-log.processor';
import { AuditInterceptor } from './interceptors/audit.interceptor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'audit-log',
    }),
  ],
  controllers: [AuditLogController],
  providers: [AuditLogService, AuditLogProcessor, AuditInterceptor],
  exports: [AuditLogService, AuditInterceptor],
})
export class AuditLogModule {}
