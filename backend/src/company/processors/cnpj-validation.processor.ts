import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VerifikService } from '../../kyc/verifik/verifik.service';
import { NotificationService } from '../../notification/notification.service';
import { EmailService } from '../../email/email.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

export interface CnpjValidationPayload {
  companyId: string;
  cnpj: string;
  creatorUserId: string;
  companyName: string;
}

@Processor('company-setup')
export class CnpjValidationProcessor {
  private readonly logger = new Logger(CnpjValidationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verifik: VerifikService,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Process('validate-cnpj')
  async handleCnpjValidation(
    job: Job<CnpjValidationPayload>,
  ): Promise<void> {
    const { companyId, cnpj, creatorUserId, companyName } = job.data;

    this.logger.debug(
      `Processing CNPJ validation job ${job.id}: companyId=${companyId} cnpj=***${cnpj.replace(/\D/g, '').slice(-4)}`,
    );

    try {
      const result = await this.verifik.validateCnpj(cnpj);

      if (result.situacaoCadastral !== 'ATIVA') {
        // Definitive business failure — CNPJ is not active in Receita Federal.
        // Don't retry: complete the job but mark the company validation as failed.
        await this.handleInactiveCnpj(
          companyId,
          cnpj,
          result.situacaoCadastral,
          { ...result } as Record<string, unknown>,
          creatorUserId,
          companyName,
        );

        this.logger.debug(
          `CNPJ validation job ${job.id} completed — CNPJ is ${result.situacaoCadastral} (not ATIVA)`,
        );
        return;
      }

      // CNPJ is active — activate the company
      await this.activateCompany(companyId, { ...result } as Record<string, unknown>, creatorUserId, companyName);

      this.logger.debug(
        `CNPJ validation job ${job.id} completed — company ${companyId} activated`,
      );
    } catch (error) {
      // Transient errors (Verifik unavailable, network issues) — Bull will retry.
      // On final attempt, mark validation as failed so the user sees the error.
      const maxAttempts = job.opts?.attempts ?? 3;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isLastAttempt) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        await this.markValidationFailed(
          companyId,
          'COMPANY_CNPJ_VERIFIK_UNAVAILABLE',
          errorMessage,
          creatorUserId,
          companyName,
        );

        this.logger.error(
          `CNPJ validation job ${job.id} exhausted all retries for company ${companyId}: ${errorMessage}`,
        );
      }

      throw error; // Re-throw for Bull retry
    }
  }

  /**
   * Handles the case where the CNPJ exists in Receita Federal but is not ATIVA.
   * This is a definitive failure — no retry needed.
   */
  private async handleInactiveCnpj(
    companyId: string,
    cnpj: string,
    situacaoCadastral: string,
    cnpjData: Record<string, unknown>,
    creatorUserId: string,
    companyName: string,
  ): Promise<void> {
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        cnpjData: {
          validationStatus: 'FAILED',
          failedAt: new Date().toISOString(),
          error: {
            code: 'COMPANY_CNPJ_INACTIVE',
            message: `CNPJ has status ${situacaoCadastral} in Receita Federal — expected ATIVA`,
          },
          ...cnpjData,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Audit log
    await this.auditLogService.log({
      actorType: 'SYSTEM',
      action: 'COMPANY_CNPJ_VALIDATION_FAILED',
      resourceType: 'Company',
      resourceId: companyId,
      companyId,
      changes: {
        before: null,
        after: { situacaoCadastral },
      },
      metadata: { source: 'scheduler', cnpjLastFour: cnpj.replace(/\D/g, '').slice(-4) },
    });

    // Notify the creator
    await this.notificationService.create({
      userId: creatorUserId,
      notificationType: 'COMPANY_CNPJ_FAILED',
      subject: `Validação CNPJ falhou — ${companyName}`,
      body: `O CNPJ informado possui situação cadastral "${situacaoCadastral}" na Receita Federal. A empresa permanece em rascunho. Corrija o CNPJ e tente novamente.`,
      relatedEntityType: 'Company',
      relatedEntityId: companyId,
      companyId,
      companyName,
    });

    // Send email notification
    await this.sendFailureEmail(creatorUserId, companyName, cnpj, situacaoCadastral);
  }

  /**
   * Activates the company after successful CNPJ validation.
   * Stores the full Verifik response data, sets cnpjValidatedAt, and transitions
   * the company from DRAFT to ACTIVE.
   */
  private async activateCompany(
    companyId: string,
    cnpjData: Record<string, unknown>,
    creatorUserId: string,
    companyName: string,
  ): Promise<void> {
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        cnpjData: {
          validationStatus: 'COMPLETED',
          ...cnpjData,
        } as unknown as Prisma.InputJsonValue,
        cnpjValidatedAt: new Date(),
        status: 'ACTIVE',
      },
    });

    // Audit log — CNPJ validated
    await this.auditLogService.log({
      actorType: 'SYSTEM',
      action: 'COMPANY_CNPJ_VALIDATED',
      resourceType: 'Company',
      resourceId: companyId,
      companyId,
      changes: {
        before: { status: 'DRAFT' },
        after: { status: 'ACTIVE', cnpjValidated: true },
      },
      metadata: { source: 'scheduler' },
    });

    // Audit log — status changed
    await this.auditLogService.log({
      actorType: 'SYSTEM',
      action: 'COMPANY_STATUS_CHANGED',
      resourceType: 'Company',
      resourceId: companyId,
      companyId,
      changes: {
        before: { status: 'DRAFT' },
        after: { status: 'ACTIVE' },
      },
      metadata: { source: 'scheduler', trigger: 'cnpj_validation' },
    });

    // Notify the creator
    await this.notificationService.create({
      userId: creatorUserId,
      notificationType: 'COMPANY_ACTIVATED',
      subject: `${companyName} — Empresa ativada!`,
      body: `A validação do CNPJ foi concluída com sucesso. A empresa "${companyName}" está agora ativa na plataforma.`,
      relatedEntityType: 'Company',
      relatedEntityId: companyId,
      companyId,
      companyName,
    });

    // Send success email
    await this.sendSuccessEmail(creatorUserId, companyName, cnpjData);
  }

  /**
   * Marks the CNPJ validation as failed after all retries are exhausted.
   */
  private async markValidationFailed(
    companyId: string,
    errorCode: string,
    errorMessage: string,
    creatorUserId: string,
    companyName: string,
  ): Promise<void> {
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        cnpjData: {
          validationStatus: 'FAILED',
          failedAt: new Date().toISOString(),
          error: { code: errorCode, message: errorMessage },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // Audit log
    await this.auditLogService.log({
      actorType: 'SYSTEM',
      action: 'COMPANY_CNPJ_VALIDATION_FAILED',
      resourceType: 'Company',
      resourceId: companyId,
      companyId,
      changes: {
        before: null,
        after: { errorCode, errorMessage },
      },
      metadata: { source: 'scheduler' },
    });

    // Notify the creator
    await this.notificationService.create({
      userId: creatorUserId,
      notificationType: 'COMPANY_CNPJ_FAILED',
      subject: `Validação CNPJ falhou — ${companyName}`,
      body: `Não foi possível validar o CNPJ da empresa "${companyName}". Tente novamente mais tarde.`,
      relatedEntityType: 'Company',
      relatedEntityId: companyId,
      companyId,
      companyName,
    });

    // Send failure email
    await this.sendFailureEmail(creatorUserId, companyName, '', 'INDISPONÍVEL');
  }

  /**
   * Sends a success email to the company creator.
   * Fire-and-forget — failures are logged but don't block the job.
   */
  private async sendSuccessEmail(
    userId: string,
    companyName: string,
    cnpjData: Record<string, unknown>,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, locale: true },
      });

      if (!user?.email) return;

      await this.emailService.sendEmail({
        to: user.email,
        templateName: 'cnpj-validation-success',
        locale: user.locale ?? 'pt-BR',
        variables: {
          companyName,
          razaoSocial: String(cnpjData.razaoSocial ?? companyName),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to send CNPJ validation success email for company ${companyName}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Sends a failure email to the company creator.
   * Fire-and-forget — failures are logged but don't block the job.
   */
  private async sendFailureEmail(
    userId: string,
    companyName: string,
    cnpj: string,
    situacaoCadastral: string,
  ): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, locale: true },
      });

      if (!user?.email) return;

      await this.emailService.sendEmail({
        to: user.email,
        templateName: 'cnpj-validation-failed',
        locale: user.locale ?? 'pt-BR',
        variables: {
          companyName,
          cnpj: cnpj || '—',
          situacaoCadastral,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to send CNPJ validation failure email for company ${companyName}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
