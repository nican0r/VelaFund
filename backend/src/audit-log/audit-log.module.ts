import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditLogProcessor } from './audit-log.processor';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { PrismaService } from '../prisma/prisma.service';

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
export class AuditLogModule implements OnModuleInit {
  private readonly logger = new Logger(AuditLogModule.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensures the PostgreSQL immutability trigger exists on the audit_logs table.
   * Per audit-logging.md spec § "Database-Level Immutability":
   * A PostgreSQL trigger prevents any UPDATE or DELETE on the audit_logs table.
   * This is critical for LGPD compliance (Art. 37) — audit logs must be tamper-proof.
   *
   * Uses CREATE OR REPLACE FUNCTION and DROP/CREATE TRIGGER for idempotency.
   * Safe to run on every application startup.
   */
  async onModuleInit() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION prevent_audit_modification()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are prohibited.';
        END;
        $$ LANGUAGE plpgsql;
      `);

      await this.prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS audit_logs_immutable_update ON audit_logs;
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE TRIGGER audit_logs_immutable_update
          BEFORE UPDATE ON audit_logs
          FOR EACH ROW
          EXECUTE FUNCTION prevent_audit_modification();
      `);

      await this.prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS audit_logs_immutable_delete ON audit_logs;
      `);
      await this.prisma.$executeRawUnsafe(`
        CREATE TRIGGER audit_logs_immutable_delete
          BEFORE DELETE ON audit_logs
          FOR EACH ROW
          EXECUTE FUNCTION prevent_audit_modification();
      `);

      this.logger.log('Audit log immutability triggers installed on audit_logs table');
    } catch (error) {
      this.logger.error(
        `Failed to install audit log immutability triggers: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
