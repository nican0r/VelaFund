import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface AuditEvent {
  actorId: string | null;
  actorType: 'USER' | 'SYSTEM' | 'ADMIN';
  action: string;
  resourceType: string;
  resourceId: string | null;
  companyId: string | null;
  changes: { before: Record<string, unknown> | null; after: Record<string, unknown> | null } | null;
  metadata: Record<string, unknown> | null;
}

@Processor('audit-log')
export class AuditLogProcessor {
  private readonly logger = new Logger(AuditLogProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('persist')
  async handlePersist(job: Job<AuditEvent>): Promise<void> {
    const event = job.data;
    this.logger.debug(
      `Processing audit job ${job.id}: action=${event.action} resource=${event.resourceType}`,
    );

    await this.prisma.auditLog.create({
      data: {
        actorId: event.actorId,
        actorType: event.actorType,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        companyId: event.companyId,
        changes: event.changes as Prisma.InputJsonValue ?? Prisma.JsonNull,
        metadata: event.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });

    this.logger.debug(`Audit job ${job.id} completed`);
  }
}
