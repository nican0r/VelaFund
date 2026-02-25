import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditEvent } from './audit-log.processor';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { NotFoundException } from '../common/filters/app-exception';

interface SortField {
  field: string;
  direction: 'asc' | 'desc';
}

const ALLOWED_SORT_FIELDS = ['timestamp', 'action', 'actorId', 'resourceType'];

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('audit-log') private readonly auditQueue: Queue,
  ) {}

  /**
   * Programmatic audit logging for events not tied to a controller action.
   * Used by background jobs, system events, and service-level audit logging.
   */
  async log(event: {
    actorId?: string;
    actorType: 'USER' | 'SYSTEM' | 'ADMIN';
    action: string;
    resourceType: string;
    resourceId?: string;
    companyId?: string;
    changes?: { before: Record<string, unknown> | null; after: Record<string, unknown> | null };
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const auditEvent: AuditEvent = {
      actorId: event.actorId || null,
      actorType: event.actorType,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId || null,
      companyId: event.companyId || null,
      changes: event.changes || null,
      metadata: {
        source: 'system',
        ...event.metadata,
      },
    };

    await this.auditQueue.add('persist', auditEvent, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  /**
   * List audit logs with pagination, filtering, and sorting.
   * Scoped to a company for security.
   */
  async findAll(companyId: string, dto: ListAuditLogsDto) {
    const where: Record<string, unknown> = { companyId };

    if (dto.action) where.action = dto.action;
    if (dto.actorId) where.actorId = dto.actorId;
    if (dto.resourceType) where.resourceType = dto.resourceType;
    if (dto.resourceId) where.resourceId = dto.resourceId;

    if (dto.dateFrom || dto.dateTo) {
      const timestamp: Record<string, Date> = {};
      if (dto.dateFrom) timestamp.gte = new Date(dto.dateFrom);
      if (dto.dateTo) timestamp.lte = new Date(dto.dateTo);
      where.timestamp = timestamp;
    }

    const orderBy = this.parseSort(dto.sort);

    const skip = (dto.page - 1) * dto.limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take: dto.limit,
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const data = items.map((item) => ({
      id: item.id,
      timestamp: item.timestamp.toISOString(),
      actorId: item.actorId,
      actorType: item.actorType,
      actorName: item.actor
        ? `${item.actor.firstName || ''} ${item.actor.lastName || ''}`.trim() || null
        : null,
      actorEmail: item.actor?.email
        ? this.maskEmail(item.actor.email)
        : null,
      action: item.action,
      resourceType: item.resourceType,
      resourceId: item.resourceId,
      changes: item.changes as Record<string, unknown> | null,
      metadata: item.metadata as Record<string, unknown> | null,
    }));

    return { items: data, total };
  }

  /**
   * Get a single audit log entry by ID, scoped to company.
   */
  async findById(companyId: string, id: string) {
    const log = await this.prisma.auditLog.findFirst({
      where: { id, companyId },
      include: {
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!log) {
      throw new NotFoundException('auditLog', id);
    }

    return {
      id: log.id,
      timestamp: log.timestamp.toISOString(),
      actorId: log.actorId,
      actorType: log.actorType,
      actorName: log.actor
        ? `${log.actor.firstName || ''} ${log.actor.lastName || ''}`.trim() || null
        : null,
      actorEmail: log.actor?.email
        ? this.maskEmail(log.actor.email)
        : null,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      changes: log.changes as Record<string, unknown> | null,
      metadata: log.metadata as Record<string, unknown> | null,
    };
  }

  /**
   * Verify hash chain integrity for a date range.
   */
  async verifyHashChain(dateFrom?: string, dateTo?: string) {
    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      const dateFilter: Record<string, string> = {};
      if (dateFrom) dateFilter.gte = dateFrom;
      if (dateTo) dateFilter.lte = dateTo;
      where.date = dateFilter;
    }

    const chains = await this.prisma.auditHashChain.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    if (chains.length === 0) {
      return {
        dateRange: { from: dateFrom || null, to: dateTo || null },
        daysVerified: 0,
        daysValid: 0,
        daysInvalid: 0,
        status: 'NO_DATA',
      };
    }

    let daysValid = 0;
    let daysInvalid = 0;

    for (let i = 0; i < chains.length; i++) {
      const chain = chains[i];

      // Recompute hash for this day's logs
      const dayStart = new Date(chain.date + 'T00:00:00.000Z');
      const dayEnd = new Date(chain.date + 'T23:59:59.999Z');

      const logs = await this.prisma.auditLog.findMany({
        where: {
          timestamp: { gte: dayStart, lte: dayEnd },
        },
        orderBy: { timestamp: 'asc' },
      });

      const recomputedHash = this.computeHash(logs, chain.previousHash);

      if (recomputedHash === chain.hash && logs.length === chain.logCount) {
        daysValid++;
      } else {
        daysInvalid++;
        this.logger.warn(
          `Hash chain mismatch for date ${chain.date}: expected=${chain.hash}, computed=${recomputedHash}`,
        );
      }
    }

    return {
      dateRange: {
        from: chains[0].date,
        to: chains[chains.length - 1].date,
      },
      daysVerified: chains.length,
      daysValid,
      daysInvalid,
      status: daysInvalid === 0 ? 'VALID' : 'INVALID',
    };
  }

  /**
   * Compute daily hash chain for a specific date.
   * Called by the scheduled job.
   */
  async computeDailyHash(date: string): Promise<void> {
    const dayStart = new Date(date + 'T00:00:00.000Z');
    const dayEnd = new Date(date + 'T23:59:59.999Z');

    const logs = await this.prisma.auditLog.findMany({
      where: {
        timestamp: { gte: dayStart, lte: dayEnd },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Get previous day's hash
    const previousChain = await this.prisma.auditHashChain.findFirst({
      where: { date: { lt: date } },
      orderBy: { date: 'desc' },
    });

    const previousHash = previousChain?.hash || 'genesis';
    const hash = this.computeHash(logs, previousHash);

    await this.prisma.auditHashChain.upsert({
      where: { date },
      update: {
        logCount: logs.length,
        hash,
        previousHash,
        computedAt: new Date(),
      },
      create: {
        date,
        logCount: logs.length,
        hash,
        previousHash,
        computedAt: new Date(),
      },
    });

    this.logger.log(
      `Daily hash chain computed for ${date}: ${logs.length} logs, hash=${hash.slice(0, 16)}...`,
    );
  }

  /**
   * SHA-256 hash computation for tamper detection.
   */
  private computeHash(
    logs: Array<{ id: string; timestamp: Date; action: string; actorId: string | null }>,
    previousHash: string,
  ): string {
    const content = logs
      .map(
        (l) =>
          `${l.id}|${l.timestamp.toISOString()}|${l.action}|${l.actorId || 'SYSTEM'}`,
      )
      .join('\n');

    return createHash('sha256')
      .update(previousHash + '\n' + content)
      .digest('hex');
  }

  private parseSort(sort?: string): Record<string, 'asc' | 'desc'>[] {
    if (!sort) return [{ timestamp: 'desc' }];

    const fields = sort.split(',').slice(0, 3);
    const parsed: Record<string, 'asc' | 'desc'>[] = [];

    for (const f of fields) {
      const descending = f.startsWith('-');
      const fieldName = descending ? f.slice(1) : f;

      if (ALLOWED_SORT_FIELDS.includes(fieldName)) {
        parsed.push({ [fieldName]: descending ? 'desc' : 'asc' });
      }
    }

    return parsed.length > 0 ? parsed : [{ timestamp: 'desc' }];
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain || !local) return '***@***';
    return `${local[0]}***@${domain}`;
  }
}
