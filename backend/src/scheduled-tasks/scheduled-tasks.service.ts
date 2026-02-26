import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Daily hash chain computation for audit log tamper detection.
   * Runs at 00:05 UTC daily per audit-logging.md spec.
   *
   * Computes a SHA-256 hash of the previous day's audit logs and chains it
   * with the prior day's hash. This creates an immutable, verifiable chain
   * that detects any post-hoc modification of audit records.
   *
   * If computation fails, the error is logged but does not crash the application.
   * Missing days can be backfilled via the verify endpoint.
   */
  @Cron('0 5 0 * * *', { name: 'audit-hash-chain', timeZone: 'UTC' })
  async computeDailyAuditHashChain(): Promise<void> {
    const yesterday = this.getYesterdayDateString();
    this.logger.log(`Starting daily audit hash chain computation for ${yesterday}`);

    try {
      await this.auditLogService.computeDailyHash(yesterday);
      this.logger.log(`Daily audit hash chain computation completed for ${yesterday}`);
    } catch (error) {
      this.logger.error(
        `Failed to compute daily audit hash chain for ${yesterday}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Returns yesterday's date as YYYY-MM-DD string in UTC.
   */
  getYesterdayDateString(): string {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }
}
