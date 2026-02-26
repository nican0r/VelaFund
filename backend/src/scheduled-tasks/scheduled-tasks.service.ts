import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AuditLogService } from '../audit-log/audit-log.service';

/** Bull queue names to monitor for failed jobs. */
const MONITORED_QUEUES = [
  'audit-log',
  'notification',
  'company-setup',
  'report-export',
  'kyc-aml',
  'profile-litigation',
] as const;

/** Threshold at which a WARNING alert is logged. */
const DLQ_WARNING_THRESHOLD = 10;

/** Threshold at which a CRITICAL alert is logged. */
const DLQ_CRITICAL_THRESHOLD = 50;

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  private readonly queueMap: Map<string, Queue>;

  constructor(
    private readonly auditLogService: AuditLogService,
    @InjectQueue('audit-log') private readonly auditLogQueue: Queue,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
    @InjectQueue('company-setup') private readonly companySetupQueue: Queue,
    @InjectQueue('report-export') private readonly reportExportQueue: Queue,
    @InjectQueue('kyc-aml') private readonly kycAmlQueue: Queue,
    @InjectQueue('profile-litigation') private readonly profileLitigationQueue: Queue,
  ) {
    this.queueMap = new Map<string, Queue>([
      ['audit-log', this.auditLogQueue],
      ['notification', this.notificationQueue],
      ['company-setup', this.companySetupQueue],
      ['report-export', this.reportExportQueue],
      ['kyc-aml', this.kycAmlQueue],
      ['profile-litigation', this.profileLitigationQueue],
    ]);
  }

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
   * Dead Letter Queue monitoring for all Bull queues.
   * Runs every 5 minutes per audit-logging.md spec § "Dead Letter Queue Monitoring".
   *
   * Checks failed job counts across all monitored queues.
   * - If total failed > 10: logs WARNING alert (would send to Slack when integrated)
   * - If total failed > 50: logs CRITICAL alert (would send to PagerDuty when integrated)
   *
   * Failed jobs are retained (removeOnFail: false in BullModule config) for inspection.
   * Admin can inspect and retry via the admin dashboard (future).
   */
  @Cron('0 */5 * * * *', { name: 'dlq-monitoring', timeZone: 'UTC' })
  async monitorDeadLetterQueues(): Promise<void> {
    try {
      const queueFailures: Array<{ queue: string; failedCount: number }> = [];
      let totalFailed = 0;

      for (const [name, queue] of this.queueMap) {
        try {
          const failedCount = await queue.getFailedCount();
          if (failedCount > 0) {
            queueFailures.push({ queue: name, failedCount });
            totalFailed += failedCount;
          }
        } catch {
          // Skip queues that are unreachable (Redis down)
          this.logger.debug(`Could not check failed count for queue '${name}'`);
        }
      }

      if (totalFailed === 0) return;

      const details = queueFailures
        .map((q) => `${q.queue}=${q.failedCount}`)
        .join(', ');

      if (totalFailed >= DLQ_CRITICAL_THRESHOLD) {
        this.logger.error(
          `CRITICAL: ${totalFailed} failed jobs across Bull queues (threshold: ${DLQ_CRITICAL_THRESHOLD}). Breakdown: ${details}`,
        );

        // Fire audit event for critical DLQ alert
        this.auditLogService
          .log({
            actorType: 'SYSTEM',
            action: 'DLQ_CRITICAL_ALERT',
            resourceType: 'BullQueue',
            metadata: {
              totalFailed,
              threshold: DLQ_CRITICAL_THRESHOLD,
              queues: Object.fromEntries(queueFailures.map((q) => [q.queue, q.failedCount])),
            },
          })
          .catch(() => {});
      } else if (totalFailed >= DLQ_WARNING_THRESHOLD) {
        this.logger.warn(
          `WARNING: ${totalFailed} failed jobs across Bull queues (threshold: ${DLQ_WARNING_THRESHOLD}). Breakdown: ${details}`,
        );

        // Fire audit event for warning DLQ alert
        this.auditLogService
          .log({
            actorType: 'SYSTEM',
            action: 'DLQ_WARNING_ALERT',
            resourceType: 'BullQueue',
            metadata: {
              totalFailed,
              threshold: DLQ_WARNING_THRESHOLD,
              queues: Object.fromEntries(queueFailures.map((q) => [q.queue, q.failedCount])),
            },
          })
          .catch(() => {});
      } else {
        this.logger.debug(`DLQ check: ${totalFailed} failed jobs. ${details}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to monitor dead letter queues: ${error instanceof Error ? error.message : String(error)}`,
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
