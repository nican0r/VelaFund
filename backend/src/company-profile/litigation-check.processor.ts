import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { Prisma, VerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { BigDataCorpService, BigDataCorpNotFoundError } from './bigdatacorp.service';

/** Payload for the litigation check Bull job. */
export interface LitigationCheckPayload {
  profileId: string;
  companyId: string;
  cnpj: string;
}

/** Shape of the litigation data stored in the JSONB field. */
export interface LitigationData {
  summary: {
    activeLawsuits: number;
    historicalLawsuits: number;
    activeAdministrative: number;
    protests: number;
    totalValueInDispute: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  lawsuits: Array<{
    processId: string;
    court: string;
    caseType: string;
    status: string;
    filingDate: string;
    lastUpdate: string;
    valueInDispute: string | null;
    plaintiffName: string;
    defendantRole: string;
    subject: string;
  }>;
  protestData: {
    totalProtests: number;
    protests: Array<{
      date: string;
      amount: string;
      notaryOffice: string;
      status: string;
    }>;
  };
  queryDate: string;
}

/**
 * LitigationCheckProcessor — Bull job handler for async BigDataCorp litigation fetching.
 *
 * Dispatched from CompanyProfileService.create(). Runs asynchronously after profile creation.
 * On success: stores litigation data as JSONB on CompanyProfile, sets status to COMPLETED.
 * On final failure: sets status to FAILED with error message.
 * On CNPJ not found: sets COMPLETED with zero counts (valid result — no litigation history).
 */
@Processor('profile-litigation')
export class LitigationCheckProcessor {
  private readonly logger = new Logger(LitigationCheckProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bigDataCorpService: BigDataCorpService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Process('fetch-litigation')
  async handleFetchLitigation(job: Job<LitigationCheckPayload>): Promise<void> {
    const { profileId, companyId, cnpj } = job.data;

    this.logger.debug(`Processing litigation check job ${job.id}: profileId=${profileId}`);

    try {
      const response = await this.bigDataCorpService.fetchLitigationData(cnpj);

      // Normalize and mask individual plaintiff names (PII)
      const maskedLawsuits = response.lawsuits.map((lawsuit) => ({
        processId: lawsuit.processId ?? '',
        court: lawsuit.court ?? '',
        caseType: lawsuit.caseType ?? 'CIVIL',
        status: lawsuit.status ?? '',
        filingDate: lawsuit.filingDate ?? '',
        lastUpdate: lawsuit.lastUpdate ?? '',
        valueInDispute: lawsuit.valueInDispute ?? null,
        plaintiffName: this.maskIndividualName(lawsuit.plaintiffName ?? ''),
        defendantRole: lawsuit.defendantRole ?? '',
        subject: lawsuit.subject ?? '',
      }));

      // Compute summary statistics
      const activeLawsuits = maskedLawsuits.filter((l) => l.status?.toUpperCase() === 'ATIVO');
      const historicalLawsuits = maskedLawsuits.filter((l) => l.status?.toUpperCase() !== 'ATIVO');
      const totalValueInDispute = activeLawsuits
        .reduce((sum, l) => sum + (parseFloat(l.valueInDispute || '0') || 0), 0)
        .toFixed(2);

      const activeAdmin = (response.administrativeProceedings ?? []).filter(
        (a) => a.status?.toUpperCase() === 'ATIVO',
      ).length;

      const activeProtests = (response.protests ?? []).filter(
        (p) => p.status?.toUpperCase() === 'ATIVO',
      ).length;

      const litigationData: LitigationData = {
        summary: {
          activeLawsuits: activeLawsuits.length,
          historicalLawsuits: historicalLawsuits.length,
          activeAdministrative: activeAdmin,
          protests: activeProtests,
          totalValueInDispute,
          riskLevel: this.computeRiskLevel(activeLawsuits.length, parseFloat(totalValueInDispute)),
        },
        lawsuits: maskedLawsuits,
        protestData: {
          totalProtests: (response.protests ?? []).length,
          protests: (response.protests ?? []).map((p) => ({
            date: p.date ?? '',
            amount: p.amount ?? '0',
            notaryOffice: p.notaryOffice ?? '',
            status: p.status ?? '',
          })),
        },
        queryDate: new Date().toISOString(),
      };

      await this.prisma.companyProfile.update({
        where: { id: profileId },
        data: {
          litigationStatus: VerificationStatus.COMPLETED,
          litigationData: litigationData as unknown as Prisma.InputJsonValue,
          litigationFetchedAt: new Date(),
          litigationError: null,
        },
      });

      // Audit log: success
      await this.auditLogService.log({
        actorType: 'SYSTEM',
        action: 'PROFILE_LITIGATION_FETCHED',
        resourceType: 'CompanyProfile',
        resourceId: profileId,
        companyId,
        changes: {
          before: { litigationStatus: 'PENDING' },
          after: {
            litigationStatus: 'COMPLETED',
            activeLawsuits: litigationData.summary.activeLawsuits,
            riskLevel: litigationData.summary.riskLevel,
          },
        },
      });

      this.logger.log(
        `Litigation data fetched for profile ${profileId}: ` +
          `${litigationData.summary.activeLawsuits} active lawsuits, ` +
          `risk=${litigationData.summary.riskLevel}`,
      );
    } catch (error) {
      // CNPJ not found — definitive result, not an error
      if (error instanceof BigDataCorpNotFoundError) {
        await this.handleCnpjNotFound(profileId, companyId);
        return;
      }

      // Transient error — check if this is the last attempt
      const maxAttempts = job.opts?.attempts ?? 3;
      const isLastAttempt = job.attemptsMade + 1 >= maxAttempts;

      if (isLastAttempt) {
        await this.handleFinalFailure(profileId, companyId, error);
        return; // Don't re-throw — we handled it
      }

      // Re-throw for Bull to retry
      this.logger.warn(
        `Litigation fetch attempt ${job.attemptsMade + 1}/${maxAttempts} failed for profile ${profileId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle CNPJ not found in BigDataCorp — a valid result meaning no litigation history.
   * Sets COMPLETED with zero counts and LOW risk.
   */
  private async handleCnpjNotFound(profileId: string, companyId: string): Promise<void> {
    const emptyData: LitigationData = {
      summary: {
        activeLawsuits: 0,
        historicalLawsuits: 0,
        activeAdministrative: 0,
        protests: 0,
        totalValueInDispute: '0.00',
        riskLevel: 'LOW',
      },
      lawsuits: [],
      protestData: {
        totalProtests: 0,
        protests: [],
      },
      queryDate: new Date().toISOString(),
    };

    await this.prisma.companyProfile.update({
      where: { id: profileId },
      data: {
        litigationStatus: VerificationStatus.COMPLETED,
        litigationData: emptyData as unknown as Prisma.InputJsonValue,
        litigationFetchedAt: new Date(),
        litigationError: null,
      },
    });

    await this.auditLogService.log({
      actorType: 'SYSTEM',
      action: 'PROFILE_LITIGATION_FETCHED',
      resourceType: 'CompanyProfile',
      resourceId: profileId,
      companyId,
      changes: {
        before: { litigationStatus: 'PENDING' },
        after: {
          litigationStatus: 'COMPLETED',
          activeLawsuits: 0,
          riskLevel: 'LOW',
          note: 'CNPJ not found in BigDataCorp — no litigation history',
        },
      },
    });

    this.logger.log(
      `CNPJ not found in BigDataCorp for profile ${profileId} — setting COMPLETED with zero counts`,
    );
  }

  /**
   * Handle final failure after all retries exhausted.
   * Sets FAILED status with user-friendly error message.
   */
  private async handleFinalFailure(
    profileId: string,
    companyId: string,
    error: unknown,
  ): Promise<void> {
    await this.prisma.companyProfile.update({
      where: { id: profileId },
      data: {
        litigationStatus: VerificationStatus.FAILED,
        litigationError: 'Verification service temporarily unavailable',
      },
    });

    await this.auditLogService.log({
      actorType: 'SYSTEM',
      action: 'PROFILE_LITIGATION_FAILED',
      resourceType: 'CompanyProfile',
      resourceId: profileId,
      companyId,
      metadata: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    this.logger.error(
      `Litigation fetch failed after all retries for profile ${profileId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // ─── RISK LEVEL COMPUTATION ───────────────────────────────────────────

  /**
   * Compute risk level based on active lawsuit count and total value in dispute.
   *
   * | Active Lawsuits | Total Value in Dispute | Risk Level |
   * |----------------|----------------------|------------|
   * | 0              | Any                  | LOW        |
   * | 1-2            | < R$ 100.000         | LOW        |
   * | 1-5            | < R$ 500.000         | MEDIUM     |
   * | >5 or high val | >= R$ 500.000        | HIGH       |
   */
  computeRiskLevel(activeLawsuits: number, totalValue: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (activeLawsuits === 0) return 'LOW';
    if (activeLawsuits <= 2 && totalValue < 100_000) return 'LOW';
    if (activeLawsuits <= 5 && totalValue < 500_000) return 'MEDIUM';
    return 'HIGH';
  }

  // ─── PII MASKING ──────────────────────────────────────────────────────

  /**
   * Mask individual plaintiff names for PII protection.
   * Company names (containing LTDA, S.A., EIRELI, MEI, etc.) are NOT masked
   * since they are public information.
   *
   * "João Silva" → "J*** S***"
   * "Empresa LTDA" → "Empresa LTDA" (unchanged)
   */
  maskIndividualName(name: string): string {
    if (!name) return name;

    // Company names are public — do not mask
    if (/\b(LTDA|S\.?A\.?|EIRELI|MEI|CNPJ|EMPRESA|CIA|COMPANHIA|INC|LLC|CORP)\b/i.test(name)) {
      return name;
    }

    // Mask individual names: first char + *** for each name part
    return name
      .split(' ')
      .map((part) => (part.length > 0 ? `${part[0]}***` : part))
      .join(' ');
  }
}
