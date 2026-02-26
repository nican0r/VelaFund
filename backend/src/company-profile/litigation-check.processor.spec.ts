import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bull';
import { VerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  BigDataCorpService,
  BigDataCorpNotFoundError,
  BigDataCorpUnavailableError,
} from './bigdatacorp.service';
import { LitigationCheckProcessor, LitigationCheckPayload } from './litigation-check.processor';

// ═══════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════

const PROFILE_ID = 'profile-001';
const COMPANY_ID = 'company-001';
const CNPJ = '12345678000190';

function createMockJob(
  data?: Partial<LitigationCheckPayload>,
  overrides?: Partial<Job<LitigationCheckPayload>>,
): Job<LitigationCheckPayload> {
  return {
    id: 'job-1',
    data: {
      profileId: PROFILE_ID,
      companyId: COMPANY_ID,
      cnpj: CNPJ,
      ...data,
    },
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  } as unknown as Job<LitigationCheckPayload>;
}

function buildMockBigDataCorpResponse() {
  return {
    lawsuits: [
      {
        processId: 'PROC-001',
        court: 'TJSP',
        caseType: 'CIVIL',
        status: 'ATIVO',
        filingDate: '2025-01-15',
        lastUpdate: '2025-06-01',
        valueInDispute: '50000.00',
        plaintiffName: 'João Silva',
        defendantRole: 'Réu',
        subject: 'Cobrança',
      },
      {
        processId: 'PROC-002',
        court: 'TRT',
        caseType: 'TRABALHISTA',
        status: 'ENCERRADO',
        filingDate: '2024-03-10',
        lastUpdate: '2025-02-20',
        valueInDispute: '25000.00',
        plaintiffName: 'Empresa LTDA',
        defendantRole: 'Réu',
        subject: 'Reclamação',
      },
    ],
    administrativeProceedings: [
      {
        processId: 'ADM-001',
        agency: 'CADE',
        status: 'ATIVO',
        filingDate: '2024-06-01',
      },
    ],
    protests: [
      {
        date: '2024-12-01',
        amount: '5000.00',
        notaryOffice: '1º Cartório de Protestos',
        status: 'ATIVO',
      },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════

describe('LitigationCheckProcessor', () => {
  let processor: LitigationCheckProcessor;
  let prisma: any;
  let bigDataCorpService: any;
  let auditLogService: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      companyProfile: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    bigDataCorpService = {
      fetchLitigationData: jest.fn(),
    };

    auditLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LitigationCheckProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: BigDataCorpService, useValue: bigDataCorpService },
        { provide: AuditLogService, useValue: auditLogService },
      ],
    }).compile();

    processor = module.get<LitigationCheckProcessor>(LitigationCheckProcessor);
  });

  // ─── Happy Path ───────────────────────────────────────────────────

  describe('handleFetchLitigation — success', () => {
    it('should fetch litigation data and persist COMPLETED status', async () => {
      const mockResponse = buildMockBigDataCorpResponse();
      bigDataCorpService.fetchLitigationData.mockResolvedValue(mockResponse);

      const job = createMockJob();
      await processor.handleFetchLitigation(job);

      expect(bigDataCorpService.fetchLitigationData).toHaveBeenCalledWith(CNPJ);

      // Verify Prisma update call
      expect(prisma.companyProfile.update).toHaveBeenCalledTimes(1);
      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe(PROFILE_ID);
      expect(updateCall.data.litigationStatus).toBe(VerificationStatus.COMPLETED);
      expect(updateCall.data.litigationFetchedAt).toBeInstanceOf(Date);
      expect(updateCall.data.litigationError).toBeNull();
    });

    it('should compute summary statistics correctly', async () => {
      const mockResponse = buildMockBigDataCorpResponse();
      bigDataCorpService.fetchLitigationData.mockResolvedValue(mockResponse);

      await processor.handleFetchLitigation(createMockJob());

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      const litigationData = updateCall.data.litigationData;

      expect(litigationData.summary.activeLawsuits).toBe(1);
      expect(litigationData.summary.historicalLawsuits).toBe(1);
      expect(litigationData.summary.activeAdministrative).toBe(1);
      expect(litigationData.summary.protests).toBe(1);
      expect(litigationData.summary.totalValueInDispute).toBe('50000.00');
    });

    it('should mask individual plaintiff names but keep company names', async () => {
      const mockResponse = buildMockBigDataCorpResponse();
      bigDataCorpService.fetchLitigationData.mockResolvedValue(mockResponse);

      await processor.handleFetchLitigation(createMockJob());

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      const lawsuits = updateCall.data.litigationData.lawsuits;

      // Individual name should be masked
      expect(lawsuits[0].plaintiffName).toBe('J*** S***');

      // Company name (contains LTDA) should NOT be masked
      expect(lawsuits[1].plaintiffName).toBe('Empresa LTDA');
    });

    it('should include protest data in the persisted record', async () => {
      const mockResponse = buildMockBigDataCorpResponse();
      bigDataCorpService.fetchLitigationData.mockResolvedValue(mockResponse);

      await processor.handleFetchLitigation(createMockJob());

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      const protestData = updateCall.data.litigationData.protestData;

      expect(protestData.totalProtests).toBe(1);
      expect(protestData.protests).toHaveLength(1);
      expect(protestData.protests[0].date).toBe('2024-12-01');
      expect(protestData.protests[0].amount).toBe('5000.00');
    });

    it('should include queryDate in the persisted record', async () => {
      const mockResponse = buildMockBigDataCorpResponse();
      bigDataCorpService.fetchLitigationData.mockResolvedValue(mockResponse);

      const before = new Date().toISOString();
      await processor.handleFetchLitigation(createMockJob());
      const after = new Date().toISOString();

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      const queryDate = updateCall.data.litigationData.queryDate;

      expect(queryDate).toBeDefined();
      expect(queryDate >= before).toBe(true);
      expect(queryDate <= after).toBe(true);
    });

    it('should create an audit log on success', async () => {
      const mockResponse = buildMockBigDataCorpResponse();
      bigDataCorpService.fetchLitigationData.mockResolvedValue(mockResponse);

      await processor.handleFetchLitigation(createMockJob());

      expect(auditLogService.log).toHaveBeenCalledTimes(1);
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'SYSTEM',
          action: 'PROFILE_LITIGATION_FETCHED',
          resourceType: 'CompanyProfile',
          resourceId: PROFILE_ID,
          companyId: COMPANY_ID,
        }),
      );
    });

    it('should handle response with no lawsuits', async () => {
      bigDataCorpService.fetchLitigationData.mockResolvedValue({
        lawsuits: [],
        administrativeProceedings: [],
        protests: [],
      });

      await processor.handleFetchLitigation(createMockJob());

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      const summary = updateCall.data.litigationData.summary;

      expect(summary.activeLawsuits).toBe(0);
      expect(summary.historicalLawsuits).toBe(0);
      expect(summary.activeAdministrative).toBe(0);
      expect(summary.protests).toBe(0);
      expect(summary.totalValueInDispute).toBe('0.00');
      expect(summary.riskLevel).toBe('LOW');
    });

    it('should handle response with null administrativeProceedings and protests', async () => {
      bigDataCorpService.fetchLitigationData.mockResolvedValue({
        lawsuits: [],
        administrativeProceedings: undefined,
        protests: undefined,
      });

      await processor.handleFetchLitigation(createMockJob());

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data.litigationStatus).toBe(VerificationStatus.COMPLETED);
    });
  });

  // ─── CNPJ Not Found ───────────────────────────────────────────────

  describe('handleFetchLitigation — CNPJ not found', () => {
    it('should set COMPLETED with zero counts when CNPJ not found', async () => {
      bigDataCorpService.fetchLitigationData.mockRejectedValue(
        new BigDataCorpNotFoundError('CNPJ not found'),
      );

      await processor.handleFetchLitigation(createMockJob());

      expect(prisma.companyProfile.update).toHaveBeenCalledTimes(1);
      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data.litigationStatus).toBe(VerificationStatus.COMPLETED);
      expect(updateCall.data.litigationError).toBeNull();

      const litigationData = updateCall.data.litigationData;
      expect(litigationData.summary.activeLawsuits).toBe(0);
      expect(litigationData.summary.historicalLawsuits).toBe(0);
      expect(litigationData.summary.riskLevel).toBe('LOW');
      expect(litigationData.lawsuits).toEqual([]);
      expect(litigationData.protestData.totalProtests).toBe(0);
    });

    it('should create an audit log with "CNPJ not found" note', async () => {
      bigDataCorpService.fetchLitigationData.mockRejectedValue(
        new BigDataCorpNotFoundError('CNPJ not found'),
      );

      await processor.handleFetchLitigation(createMockJob());

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PROFILE_LITIGATION_FETCHED',
          changes: expect.objectContaining({
            after: expect.objectContaining({
              note: expect.stringContaining('CNPJ not found'),
            }),
          }),
        }),
      );
    });

    it('should NOT re-throw BigDataCorpNotFoundError', async () => {
      bigDataCorpService.fetchLitigationData.mockRejectedValue(
        new BigDataCorpNotFoundError('CNPJ not found'),
      );

      // Should resolve without throwing
      await expect(processor.handleFetchLitigation(createMockJob())).resolves.toBeUndefined();
    });
  });

  // ─── Transient Failures ───────────────────────────────────────────

  describe('handleFetchLitigation — transient failures', () => {
    it('should re-throw error for Bull retry when not the last attempt', async () => {
      bigDataCorpService.fetchLitigationData.mockRejectedValue(
        new BigDataCorpUnavailableError('Service unavailable'),
      );

      const job = createMockJob(undefined, {
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as any);

      await expect(processor.handleFetchLitigation(job)).rejects.toThrow('Service unavailable');

      // Should NOT update Prisma (let Bull retry)
      expect(prisma.companyProfile.update).not.toHaveBeenCalled();
    });

    it('should re-throw on second attempt', async () => {
      bigDataCorpService.fetchLitigationData.mockRejectedValue(
        new BigDataCorpUnavailableError('Timeout'),
      );

      const job = createMockJob(undefined, {
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as any);

      await expect(processor.handleFetchLitigation(job)).rejects.toThrow('Timeout');
      expect(prisma.companyProfile.update).not.toHaveBeenCalled();
    });

    it('should set FAILED on final attempt', async () => {
      bigDataCorpService.fetchLitigationData.mockRejectedValue(
        new BigDataCorpUnavailableError('Service unavailable'),
      );

      const job = createMockJob(undefined, {
        attemptsMade: 2, // 3rd attempt (0-indexed) = last when max is 3
        opts: { attempts: 3 },
      } as any);

      // Should NOT re-throw — handled internally
      await expect(processor.handleFetchLitigation(job)).resolves.toBeUndefined();

      // Should set FAILED status
      expect(prisma.companyProfile.update).toHaveBeenCalledTimes(1);
      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data.litigationStatus).toBe(VerificationStatus.FAILED);
      expect(updateCall.data.litigationError).toBe('Verification service temporarily unavailable');
    });

    it('should create an audit log on final failure', async () => {
      bigDataCorpService.fetchLitigationData.mockRejectedValue(new Error('Connection refused'));

      const job = createMockJob(undefined, {
        attemptsMade: 2,
        opts: { attempts: 3 },
      } as any);

      await processor.handleFetchLitigation(job);

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'SYSTEM',
          action: 'PROFILE_LITIGATION_FAILED',
          resourceType: 'CompanyProfile',
          resourceId: PROFILE_ID,
          companyId: COMPANY_ID,
          metadata: expect.objectContaining({
            error: 'Connection refused',
          }),
        }),
      );
    });

    it('should handle unknown error type on final attempt', async () => {
      bigDataCorpService.fetchLitigationData.mockRejectedValue('string error');

      const job = createMockJob(undefined, {
        attemptsMade: 2,
        opts: { attempts: 3 },
      } as any);

      await processor.handleFetchLitigation(job);

      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data.litigationStatus).toBe(VerificationStatus.FAILED);
    });

    it('should default to 3 max attempts when job.opts.attempts is undefined', async () => {
      bigDataCorpService.fetchLitigationData.mockRejectedValue(
        new BigDataCorpUnavailableError('Timeout'),
      );

      const job = createMockJob(undefined, {
        attemptsMade: 2,
        opts: {},
      } as any);

      // attemptsMade=2, maxAttempts defaults to 3, so 2+1 >= 3 → last attempt
      await processor.handleFetchLitigation(job);

      expect(prisma.companyProfile.update).toHaveBeenCalledTimes(1);
      const updateCall = prisma.companyProfile.update.mock.calls[0][0];
      expect(updateCall.data.litigationStatus).toBe(VerificationStatus.FAILED);
    });
  });

  // ─── Risk Level Computation ────────────────────────────────────────

  describe('computeRiskLevel', () => {
    it('should return LOW when no active lawsuits', () => {
      expect(processor.computeRiskLevel(0, 0)).toBe('LOW');
      expect(processor.computeRiskLevel(0, 999_999)).toBe('LOW');
    });

    it('should return LOW for 1-2 active lawsuits with value < 100K', () => {
      expect(processor.computeRiskLevel(1, 50_000)).toBe('LOW');
      expect(processor.computeRiskLevel(2, 99_999)).toBe('LOW');
    });

    it('should return MEDIUM for 1-5 active lawsuits with value < 500K', () => {
      expect(processor.computeRiskLevel(1, 100_000)).toBe('MEDIUM');
      expect(processor.computeRiskLevel(3, 200_000)).toBe('MEDIUM');
      expect(processor.computeRiskLevel(5, 499_999)).toBe('MEDIUM');
    });

    it('should return HIGH for >5 active lawsuits', () => {
      expect(processor.computeRiskLevel(6, 0)).toBe('HIGH');
      expect(processor.computeRiskLevel(10, 100_000)).toBe('HIGH');
    });

    it('should return HIGH for value >= 500K', () => {
      expect(processor.computeRiskLevel(1, 500_000)).toBe('HIGH');
      expect(processor.computeRiskLevel(3, 1_000_000)).toBe('HIGH');
    });

    it('should return MEDIUM at boundary (2 lawsuits, value=100K)', () => {
      expect(processor.computeRiskLevel(2, 100_000)).toBe('MEDIUM');
    });

    it('should return HIGH at boundary (5 lawsuits, value=500K)', () => {
      expect(processor.computeRiskLevel(5, 500_000)).toBe('HIGH');
    });
  });

  // ─── PII Masking ──────────────────────────────────────────────────

  describe('maskIndividualName', () => {
    it('should mask individual names', () => {
      expect(processor.maskIndividualName('João Silva')).toBe('J*** S***');
    });

    it('should mask single-word names', () => {
      expect(processor.maskIndividualName('Pedro')).toBe('P***');
    });

    it('should mask multi-part names', () => {
      expect(processor.maskIndividualName('Ana Maria Santos')).toBe('A*** M*** S***');
    });

    it('should NOT mask company names containing LTDA', () => {
      expect(processor.maskIndividualName('Acme Empresa LTDA')).toBe('Acme Empresa LTDA');
    });

    it('should NOT mask company names containing S.A.', () => {
      expect(processor.maskIndividualName('Petrobras S.A.')).toBe('Petrobras S.A.');
    });

    it('should NOT mask company names containing SA (without dots)', () => {
      expect(processor.maskIndividualName('Petrobras SA')).toBe('Petrobras SA');
    });

    it('should NOT mask company names containing EIRELI', () => {
      expect(processor.maskIndividualName('Serviços EIRELI')).toBe('Serviços EIRELI');
    });

    it('should NOT mask company names containing MEI', () => {
      expect(processor.maskIndividualName('Vendas MEI')).toBe('Vendas MEI');
    });

    it('should NOT mask company names containing CNPJ', () => {
      expect(processor.maskIndividualName('CNPJ 12345')).toBe('CNPJ 12345');
    });

    it('should NOT mask company names containing EMPRESA', () => {
      expect(processor.maskIndividualName('EMPRESA de Serviços')).toBe('EMPRESA de Serviços');
    });

    it('should NOT mask company names containing INC', () => {
      expect(processor.maskIndividualName('Tech Solutions INC')).toBe('Tech Solutions INC');
    });

    it('should NOT mask company names containing LLC', () => {
      expect(processor.maskIndividualName('Global Services LLC')).toBe('Global Services LLC');
    });

    it('should NOT mask company names containing CORP', () => {
      expect(processor.maskIndividualName('Innovation CORP')).toBe('Innovation CORP');
    });

    it('should NOT mask company names containing CIA', () => {
      expect(processor.maskIndividualName('CIA de Alimentos')).toBe('CIA de Alimentos');
    });

    it('should NOT mask company names containing COMPANHIA', () => {
      expect(processor.maskIndividualName('COMPANHIA Brasileira')).toBe('COMPANHIA Brasileira');
    });

    it('should handle company keyword detection case-insensitively', () => {
      expect(processor.maskIndividualName('empresa ltda')).toBe('empresa ltda');
    });

    it('should return empty string for empty input', () => {
      expect(processor.maskIndividualName('')).toBe('');
    });

    it('should return null-like value unchanged', () => {
      expect(processor.maskIndividualName(null as any)).toBe(null);
      expect(processor.maskIndividualName(undefined as any)).toBe(undefined);
    });
  });
});
