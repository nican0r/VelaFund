jest.mock('puppeteer', () => ({
  default: {
    launch: jest.fn(),
  },
}));

jest.mock('exceljs');

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { HttpStatus } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../aws/s3.service';
import {
  NotFoundException,
  AppException,
} from '../common/filters/app-exception';

// ── helpers ──────────────────────────────────────────────────────────────

const mockCompany = {
  id: 'comp-1',
  name: 'Test Company',
  createdAt: new Date('2025-01-01'),
  entityType: 'LTDA',
  cnpj: '12.345.678/0001-90',
  foundedDate: new Date('2020-06-15'),
};

const mockShareholding = (overrides: Record<string, unknown> = {}) => ({
  id: 'sh-1',
  companyId: 'comp-1',
  shareholderId: 'holder-1',
  shareClassId: 'class-1',
  quantity: new Prisma.Decimal(10000),
  ownershipPct: new Prisma.Decimal(50),
  votingPowerPct: new Prisma.Decimal(50),
  shareholder: { id: 'holder-1', name: 'Holder A' },
  shareClass: { id: 'class-1', className: 'ON', votesPerShare: 1 },
  ...overrides,
});

const mockOptionPlan = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  companyId: 'comp-1',
  status: 'ACTIVE',
  totalPoolSize: new Prisma.Decimal(5000),
  totalGranted: new Prisma.Decimal(2000),
  totalExercised: new Prisma.Decimal(500),
  ...overrides,
});

const mockGrant = (overrides: Record<string, unknown> = {}) => ({
  id: 'grant-1',
  companyId: 'comp-1',
  status: 'ACTIVE',
  quantity: new Prisma.Decimal(1000),
  exercised: new Prisma.Decimal(200),
  grantDate: new Date('2024-01-01'),
  cliffMonths: 12,
  vestingDurationMonths: 48,
  cliffPercentage: new Prisma.Decimal(25),
  ...overrides,
});

const mockExportJob = (overrides: Record<string, unknown> = {}) => ({
  id: 'job-1',
  companyId: 'comp-1',
  userId: 'user-1',
  type: 'CAP_TABLE_EXPORT',
  format: 'csv',
  status: 'QUEUED',
  s3Key: null,
  downloadUrl: null,
  expiresAt: null,
  errorCode: null,
  parameters: null,
  createdAt: new Date(),
  completedAt: null,
  ...overrides,
});

// ── test suite ───────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: Record<string, Record<string, jest.Mock>>;
  let s3Service: { isAvailable: jest.Mock; upload: jest.Mock; generatePresignedUrl: jest.Mock };
  let exportQueue: { add: jest.Mock };

  beforeEach(async () => {
    prisma = {
      company: {
        findUnique: jest.fn(),
      },
      shareholding: {
        findMany: jest.fn(),
      },
      optionPlan: {
        findMany: jest.fn(),
      },
      optionGrant: {
        findMany: jest.fn(),
      },
      capTableSnapshot: {
        findMany: jest.fn(),
      },
      shareholder: {
        findMany: jest.fn(),
      },
      shareClass: {
        findMany: jest.fn(),
      },
      transaction: {
        findMany: jest.fn(),
      },
      fundingRound: {
        findMany: jest.fn(),
      },
      document: {
        findMany: jest.fn(),
      },
      convertibleInstrument: {
        findMany: jest.fn(),
      },
      exportJob: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    s3Service = {
      isAvailable: jest.fn().mockReturnValue(true),
      upload: jest.fn().mockResolvedValue(undefined),
      generatePresignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed'),
    };

    exportQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3Service, useValue: s3Service },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('navia-exports') },
        },
        { provide: getQueueToken('report-export'), useValue: exportQueue },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getOwnershipReport
  // ═══════════════════════════════════════════════════════════════════════

  describe('getOwnershipReport', () => {
    it('should return ownership report with shareholders and option pool', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Test Company' });
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding(),
        mockShareholding({
          id: 'sh-2',
          shareholderId: 'holder-2',
          shareClassId: 'class-2',
          quantity: new Prisma.Decimal(10000),
          shareholder: { id: 'holder-2', name: 'Holder B' },
          shareClass: { id: 'class-2', className: 'PN', votesPerShare: 0 },
        }),
      ]);
      prisma.optionPlan.findMany.mockResolvedValue([mockOptionPlan()]);
      prisma.optionGrant.findMany.mockResolvedValue([mockGrant()]);

      const result = await service.getOwnershipReport('comp-1', {});

      expect(result.companyId).toBe('comp-1');
      expect(result.companyName).toBe('Test Company');
      expect(result.totalShares).toBe('20000');
      expect(result.shareholders).toHaveLength(2);
      expect(result.shareholders[0].name).toBe('Holder A');
      expect(result.shareholders[0].percentage).toBe('50.00');
      expect(result.optionPoolSummary).not.toBeNull();
      expect(result.optionPoolSummary!.totalPool).toBe('5000');
      expect(result.optionPoolSummary!.granted).toBe('2000');
      expect(result.optionPoolSummary!.exercised).toBe('500');
      expect(result.optionPoolSummary!.available).toBe('3000');
      // Fully diluted = 20000 + 2000 - 500 = 21500
      expect(result.totalFullyDiluted).toBe('21500');
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.getOwnershipReport('nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter by shareClassId when provided', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Test Company' });
      prisma.shareholding.findMany.mockResolvedValue([mockShareholding()]);
      prisma.optionPlan.findMany.mockResolvedValue([]);
      prisma.optionGrant.findMany.mockResolvedValue([]);

      await service.getOwnershipReport('comp-1', { shareClassId: 'class-1' });

      expect(prisma.shareholding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1', shareClassId: 'class-1' },
        }),
      );
    });

    it('should skip option pool when includeOptions is false', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Test Company' });
      prisma.shareholding.findMany.mockResolvedValue([mockShareholding()]);

      const result = await service.getOwnershipReport('comp-1', {
        includeOptions: false,
      });

      expect(result.optionPoolSummary).toBeNull();
      expect(result.totalFullyDiluted).toBe(result.totalShares);
      expect(prisma.optionPlan.findMany).not.toHaveBeenCalled();
      expect(prisma.optionGrant.findMany).not.toHaveBeenCalled();
    });

    it('should calculate vested unexercised from active grants', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Test Company' });
      prisma.shareholding.findMany.mockResolvedValue([mockShareholding()]);
      prisma.optionPlan.findMany.mockResolvedValue([mockOptionPlan()]);
      // Grant with 12-month cliff already passed, 25% cliff percentage, 48 months total
      // Grant date: 2024-01-01, now ~2026-02, so ~25 months elapsed
      // Cliff amount = 1000 * 25 / 100 = 250
      // Remaining after cliff = 750
      // Vesting months after cliff = 36
      // Months after cliff = ~13
      // Linear vested = 750 * 13 / 36 ≈ 270.83
      // Total vested ≈ 520.83
      // Vested unexercised = 520.83 - 200 = 320.83
      prisma.optionGrant.findMany.mockResolvedValue([mockGrant()]);

      const result = await service.getOwnershipReport('comp-1', {});

      expect(result.optionPoolSummary).not.toBeNull();
      // Vested unexercised should be > 0 since grant is past cliff
      const vestedUnexercised = parseFloat(result.optionPoolSummary!.vestedUnexercised);
      expect(vestedUnexercised).toBeGreaterThan(0);
    });

    it('should handle zero shares gracefully', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Test Company' });
      prisma.shareholding.findMany.mockResolvedValue([]);
      prisma.optionPlan.findMany.mockResolvedValue([]);
      prisma.optionGrant.findMany.mockResolvedValue([]);

      const result = await service.getOwnershipReport('comp-1', {});

      expect(result.totalShares).toBe('0');
      expect(result.shareholders).toHaveLength(0);
    });

    it('should compute unvested options for grant before cliff', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Test Company' });
      prisma.shareholding.findMany.mockResolvedValue([mockShareholding()]);
      prisma.optionPlan.findMany.mockResolvedValue([
        mockOptionPlan({ totalGranted: new Prisma.Decimal(1000), totalExercised: new Prisma.Decimal(0) }),
      ]);
      // Grant date far in future — cliff not yet reached
      prisma.optionGrant.findMany.mockResolvedValue([
        mockGrant({
          grantDate: new Date('2026-01-01'),
          cliffMonths: 12,
          exercised: new Prisma.Decimal(0),
        }),
      ]);

      const result = await service.getOwnershipReport('comp-1', {});

      // Before cliff: vested = 0, unvested = full quantity
      expect(result.optionPoolSummary!.vestedUnexercised).toBe('0');
      expect(result.optionPoolSummary!.unvested).toBe('1000');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getDilutionReport
  // ═══════════════════════════════════════════════════════════════════════

  describe('getDilutionReport', () => {
    it('should return dilution report with data points from snapshots', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', createdAt: new Date('2025-01-01') });

      const snapshotDate = new Date('2025-06-15');
      prisma.capTableSnapshot.findMany.mockResolvedValue([
        {
          snapshotDate,
          data: {
            entries: [
              { shareClassId: 'c1', shareClassName: 'ON', shares: '10000' },
              { shareClassId: 'c2', shareClassName: 'PN', shares: '5000' },
            ],
          },
        },
      ]);

      // For Gini coefficient
      prisma.shareholding.findMany
        .mockResolvedValueOnce([
          { quantity: new Prisma.Decimal(10000) },
          { quantity: new Prisma.Decimal(5000) },
        ])
        // For foreign ownership
        .mockResolvedValueOnce([
          { quantity: new Prisma.Decimal(10000), shareholder: { isForeign: false } },
          { quantity: new Prisma.Decimal(5000), shareholder: { isForeign: true } },
        ]);

      const result = await service.getDilutionReport('comp-1', {
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
      });

      expect(result.companyId).toBe('comp-1');
      expect(result.dataPoints.length).toBeGreaterThan(0);
      expect(result.giniCoefficient).toBeDefined();
      expect(result.foreignOwnershipPercentage).toBeDefined();
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.getDilutionReport('nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use default date range (1 year) when no dates provided', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', createdAt: new Date('2025-01-01') });
      prisma.capTableSnapshot.findMany.mockResolvedValue([]);
      prisma.shareholding.findMany
        .mockResolvedValueOnce([]) // Gini
        .mockResolvedValueOnce([]); // foreign ownership

      const result = await service.getDilutionReport('comp-1', {});

      expect(result.dataPoints).toHaveLength(0);
      // Verify snapshot query uses a date range
      expect(prisma.capTableSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp-1',
            snapshotDate: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should return empty data points when no snapshots exist', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', createdAt: new Date('2025-01-01') });
      prisma.capTableSnapshot.findMany.mockResolvedValue([]);
      prisma.shareholding.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getDilutionReport('comp-1', {
        dateFrom: '2025-06-01',
        dateTo: '2025-06-30',
        granularity: 'day',
      });

      expect(result.dataPoints).toHaveLength(0);
      expect(result.giniCoefficient).toBe('0.00');
      expect(result.foreignOwnershipPercentage).toBe('0.00');
    });

    it('should compute 0 foreign ownership when all domestic', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', createdAt: new Date('2025-01-01') });
      prisma.capTableSnapshot.findMany.mockResolvedValue([]);
      prisma.shareholding.findMany
        .mockResolvedValueOnce([{ quantity: new Prisma.Decimal(1000) }])
        .mockResolvedValueOnce([
          { quantity: new Prisma.Decimal(1000), shareholder: { isForeign: false } },
        ]);

      const result = await service.getDilutionReport('comp-1', {
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
      });

      expect(result.foreignOwnershipPercentage).toBe('0.00');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getPortfolio
  // ═══════════════════════════════════════════════════════════════════════

  describe('getPortfolio', () => {
    it('should return portfolio with holdings across companies', async () => {
      prisma.shareholder.findMany.mockResolvedValue([
        {
          id: 'sh-1',
          userId: 'user-1',
          companyId: 'comp-1',
          status: 'ACTIVE',
          company: { id: 'comp-1', name: 'Alpha Corp' },
          shareholdings: [
            {
              id: 'hold-1',
              shareClassId: 'class-1',
              quantity: new Prisma.Decimal(5000),
              ownershipPct: new Prisma.Decimal(25),
              shareClass: { className: 'ON' },
            },
          ],
        },
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([
        { companyId: 'comp-1', pricePerShare: new Prisma.Decimal(10) },
      ]);
      prisma.transaction.findMany.mockResolvedValue([
        {
          companyId: 'comp-1',
          toShareholderId: 'sh-1',
          totalValue: new Prisma.Decimal(25000),
        },
      ]);

      const result = await service.getPortfolio('user-1');

      expect(result.userId).toBe('user-1');
      expect(result.holdings).toHaveLength(1);
      expect(result.holdings[0].companyName).toBe('Alpha Corp');
      expect(result.holdings[0].shares).toBe('5000');
      expect(result.holdings[0].estimatedValue).toBe('50000');
      expect(result.holdings[0].totalInvested).toBe('25000');
      expect(result.holdings[0].roiMultiple).toBe('2.00');
      expect(result.totals.totalInvested).toBe('25000');
      expect(result.totals.totalEstimatedValue).toBe('50000');
      expect(result.totals.weightedRoiMultiple).toBe('2.00');
    });

    it('should return empty portfolio when user has no shareholdings', async () => {
      prisma.shareholder.findMany.mockResolvedValue([]);
      prisma.fundingRound.findMany.mockResolvedValue([]);
      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.getPortfolio('user-1');

      expect(result.holdings).toHaveLength(0);
      expect(result.totals.totalInvested).toBe('0');
      expect(result.totals.totalEstimatedValue).toBe('0');
      expect(result.totals.weightedRoiMultiple).toBe('0.00');
    });

    it('should handle multiple companies in portfolio', async () => {
      prisma.shareholder.findMany.mockResolvedValue([
        {
          id: 'sh-1',
          userId: 'user-1',
          companyId: 'comp-1',
          status: 'ACTIVE',
          company: { id: 'comp-1', name: 'Alpha Corp' },
          shareholdings: [
            {
              id: 'hold-1',
              shareClassId: 'class-1',
              quantity: new Prisma.Decimal(5000),
              ownershipPct: new Prisma.Decimal(25),
              shareClass: { className: 'ON' },
            },
          ],
        },
        {
          id: 'sh-2',
          userId: 'user-1',
          companyId: 'comp-2',
          status: 'ACTIVE',
          company: { id: 'comp-2', name: 'Beta Corp' },
          shareholdings: [
            {
              id: 'hold-2',
              shareClassId: 'class-2',
              quantity: new Prisma.Decimal(3000),
              ownershipPct: new Prisma.Decimal(15),
              shareClass: { className: 'PN' },
            },
          ],
        },
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([
        { companyId: 'comp-1', pricePerShare: new Prisma.Decimal(10) },
        { companyId: 'comp-2', pricePerShare: new Prisma.Decimal(20) },
      ]);
      prisma.transaction.findMany.mockResolvedValue([
        { companyId: 'comp-1', toShareholderId: 'sh-1', totalValue: new Prisma.Decimal(10000) },
        { companyId: 'comp-2', toShareholderId: 'sh-2', totalValue: new Prisma.Decimal(30000) },
      ]);

      const result = await service.getPortfolio('user-1');

      expect(result.holdings).toHaveLength(2);
      expect(result.holdings[0].companyName).toBe('Alpha Corp');
      expect(result.holdings[1].companyName).toBe('Beta Corp');
      // Alpha: 5000*10=50000, invested 10000, ROI 5.00
      expect(result.holdings[0].roiMultiple).toBe('5.00');
      // Beta: 3000*20=60000, invested 30000, ROI 2.00
      expect(result.holdings[1].roiMultiple).toBe('2.00');
      // Totals: invested 40000, estimated 110000, weighted ROI 2.75
      expect(result.totals.totalInvested).toBe('40000');
      expect(result.totals.totalEstimatedValue).toBe('110000');
      expect(result.totals.weightedRoiMultiple).toBe('2.75');
    });

    it('should return ROI 0.00 when no investment amount recorded', async () => {
      prisma.shareholder.findMany.mockResolvedValue([
        {
          id: 'sh-1',
          userId: 'user-1',
          companyId: 'comp-1',
          status: 'ACTIVE',
          company: { id: 'comp-1', name: 'Alpha Corp' },
          shareholdings: [
            {
              id: 'hold-1',
              shareClassId: 'class-1',
              quantity: new Prisma.Decimal(5000),
              ownershipPct: new Prisma.Decimal(25),
              shareClass: { className: 'ON' },
            },
          ],
        },
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([]);
      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.getPortfolio('user-1');

      expect(result.holdings[0].roiMultiple).toBe('0.00');
      expect(result.holdings[0].estimatedValue).toBe('0');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // exportCapTable
  // ═══════════════════════════════════════════════════════════════════════

  describe('exportCapTable', () => {
    it('should create export job and queue processing', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.exportJob.findFirst.mockResolvedValue(null); // no dedup
      prisma.exportJob.create.mockResolvedValue(mockExportJob());

      const result = await service.exportCapTable('comp-1', 'user-1', 'csv');

      expect(prisma.exportJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'comp-1',
            userId: 'user-1',
            type: 'CAP_TABLE_EXPORT',
            format: 'csv',
            status: 'QUEUED',
          }),
        }),
      );
      expect(exportQueue.add).toHaveBeenCalledWith(
        'cap-table-export',
        expect.objectContaining({
          jobId: 'job-1',
          companyId: 'comp-1',
          format: 'csv',
        }),
        expect.objectContaining({ attempts: 3 }),
      );
      expect(result.jobId).toBe('job-1');
      expect(result.status).toBe('QUEUED');
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.exportCapTable('nonexistent', 'user-1', 'csv'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw AppException for unsupported format', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });

      await expect(
        service.exportCapTable('comp-1', 'user-1', 'docx'),
      ).rejects.toThrow(AppException);

      try {
        await service.exportCapTable('comp-1', 'user-1', 'docx');
      } catch (err: any) {
        expect(err.code).toBe('REPORT_FORMAT_UNSUPPORTED');
        expect(err.statusCode).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should return existing job when deduplication finds recent match', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      const recentJob = mockExportJob({
        id: 'existing-job',
        createdAt: new Date(), // within 5 minutes
        status: 'PROCESSING',
      });
      prisma.exportJob.findFirst.mockResolvedValue(recentJob);

      const result = await service.exportCapTable('comp-1', 'user-1', 'csv');

      expect(result.jobId).toBe('existing-job');
      expect(prisma.exportJob.create).not.toHaveBeenCalled();
      expect(exportQueue.add).not.toHaveBeenCalled();
    });

    it('should pass snapshotDate in parameters when provided', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.exportJob.findFirst.mockResolvedValue(null);
      prisma.exportJob.create.mockResolvedValue(mockExportJob());

      await service.exportCapTable('comp-1', 'user-1', 'pdf', '2025-06-15');

      expect(prisma.exportJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            parameters: { snapshotDate: '2025-06-15' },
          }),
        }),
      );
      expect(exportQueue.add).toHaveBeenCalledWith(
        'cap-table-export',
        expect.objectContaining({
          snapshotDate: '2025-06-15',
        }),
        expect.any(Object),
      );
    });

    it('should accept all valid formats: pdf, xlsx, csv, oct', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.exportJob.findFirst.mockResolvedValue(null);

      for (const fmt of ['pdf', 'xlsx', 'csv', 'oct']) {
        prisma.exportJob.create.mockResolvedValue(mockExportJob({ format: fmt }));
        const result = await service.exportCapTable('comp-1', 'user-1', fmt);
        expect(result.format).toBe(fmt);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // generateDueDiligence
  // ═══════════════════════════════════════════════════════════════════════

  describe('generateDueDiligence', () => {
    it('should create due diligence job and queue processing', async () => {
      prisma.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        createdAt: new Date('2025-01-01'),
      });
      prisma.exportJob.create.mockResolvedValue(
        mockExportJob({
          type: 'DUE_DILIGENCE',
          format: 'zip',
        }),
      );

      const result = await service.generateDueDiligence(
        'comp-1',
        'user-1',
        '2025-01-01',
        '2025-12-31',
      );

      expect(prisma.exportJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DUE_DILIGENCE',
            format: 'zip',
            status: 'QUEUED',
            parameters: expect.objectContaining({
              dateFrom: '2025-01-01',
              dateTo: '2025-12-31',
            }),
          }),
        }),
      );
      expect(exportQueue.add).toHaveBeenCalledWith(
        'due-diligence',
        expect.objectContaining({
          companyId: 'comp-1',
          dateFrom: '2025-01-01',
          dateTo: '2025-12-31',
        }),
        expect.objectContaining({ attempts: 2 }),
      );
      expect(result.status).toBe('QUEUED');
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.generateDueDiligence('nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use company createdAt as default dateFrom and current time as dateTo', async () => {
      const companyCreatedAt = new Date('2024-06-01');
      prisma.company.findUnique.mockResolvedValue({
        id: 'comp-1',
        createdAt: companyCreatedAt,
      });
      prisma.exportJob.create.mockResolvedValue(
        mockExportJob({ type: 'DUE_DILIGENCE', format: 'zip' }),
      );

      await service.generateDueDiligence('comp-1', 'user-1');

      const createCallData = prisma.exportJob.create.mock.calls[0][0].data;
      expect((createCallData.parameters as any).dateFrom).toBe(
        companyCreatedAt.toISOString(),
      );
      expect((createCallData.parameters as any).dateTo).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getExportJobStatus
  // ═══════════════════════════════════════════════════════════════════════

  describe('getExportJobStatus', () => {
    it('should return job status for a valid job', async () => {
      prisma.exportJob.findFirst.mockResolvedValue(mockExportJob());

      const result = await service.getExportJobStatus('comp-1', 'job-1');

      expect(result.jobId).toBe('job-1');
      expect(result.status).toBe('QUEUED');
    });

    it('should throw NotFoundException when job not found', async () => {
      prisma.exportJob.findFirst.mockResolvedValue(null);

      await expect(
        service.getExportJobStatus('comp-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw GONE when download URL has expired', async () => {
      const expiredJob = mockExportJob({
        status: 'COMPLETED',
        downloadUrl: 'https://s3.example.com/old-link',
        expiresAt: new Date('2020-01-01'), // expired
        completedAt: new Date('2020-01-01'),
      });
      prisma.exportJob.findFirst.mockResolvedValue(expiredJob);

      try {
        await service.getExportJobStatus('comp-1', 'job-1');
        fail('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AppException);
        expect(err.code).toBe('REPORT_EXPORT_EXPIRED');
        expect(err.statusCode).toBe(HttpStatus.GONE);
      }
    });

    it('should return completed job with download URL when not expired', async () => {
      const completedJob = mockExportJob({
        status: 'COMPLETED',
        downloadUrl: 'https://s3.example.com/signed-link',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        completedAt: new Date(),
      });
      prisma.exportJob.findFirst.mockResolvedValue(completedJob);

      const result = await service.getExportJobStatus('comp-1', 'job-1');

      expect(result.status).toBe('COMPLETED');
      expect(result.downloadUrl).toBe('https://s3.example.com/signed-link');
    });

    it('should return failed job with error code', async () => {
      const failedJob = mockExportJob({
        status: 'FAILED',
        errorCode: 'GENERATION_ERROR',
        completedAt: new Date(),
      });
      prisma.exportJob.findFirst.mockResolvedValue(failedJob);

      const result = await service.getExportJobStatus('comp-1', 'job-1');

      expect(result.status).toBe('FAILED');
      expect(result.errorCode).toBe('GENERATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // generateCapTableCsv
  // ═══════════════════════════════════════════════════════════════════════

  describe('generateCapTableCsv', () => {
    beforeEach(() => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Test Company' });
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding(),
        mockShareholding({
          id: 'sh-2',
          shareholderId: 'holder-2',
          quantity: new Prisma.Decimal(10000),
          shareholder: { id: 'holder-2', name: 'Holder B' },
          shareClass: { id: 'class-1', className: 'ON', votesPerShare: 1 },
        }),
      ]);
      prisma.optionPlan.findMany.mockResolvedValue([]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
    });

    it('should return a Buffer with BOM and semicolons', async () => {
      const buffer = await service.generateCapTableCsv('comp-1');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      const content = buffer.toString('utf-8');
      expect(content.startsWith('\uFEFF')).toBe(true);
      expect(content).toContain(';');
    });

    it('should include header row and data rows', async () => {
      const buffer = await service.generateCapTableCsv('comp-1');
      const content = buffer.toString('utf-8');
      const lines = content.replace('\uFEFF', '').split('\r\n');

      // Header
      expect(lines[0]).toBe(
        'Acionista;Classe de Ação;Ações;Porcentagem;Porcentagem Diluída',
      );
      // Data rows
      expect(lines[1]).toContain('Holder A');
      expect(lines[2]).toContain('Holder B');
      // Total row
      expect(lines[3]).toContain('TOTAL');
      expect(lines[3]).toContain('20000');
    });

    it('should escape fields containing semicolons', async () => {
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding({
          shareholder: { id: 'holder-1', name: 'Holder; Special' },
        }),
      ]);

      const buffer = await service.generateCapTableCsv('comp-1');
      const content = buffer.toString('utf-8');

      expect(content).toContain('"Holder; Special"');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // generateCapTableXlsx
  // ═══════════════════════════════════════════════════════════════════════

  describe('generateCapTableXlsx', () => {
    let mockWorkbook: any;
    let mockWorksheet: any;

    beforeEach(() => {
      mockWorksheet = {
        columns: [],
        addRow: jest.fn(),
      };

      mockWorkbook = {
        creator: '',
        created: null,
        addWorksheet: jest.fn().mockReturnValue(mockWorksheet),
        xlsx: {
          writeBuffer: jest.fn().mockResolvedValue(Buffer.from('xlsx-data')),
        },
      };

      // Mock exceljs module
      const ExcelJS = require('exceljs');
      ExcelJS.Workbook = jest.fn().mockReturnValue(mockWorkbook);

      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Test Company' });
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding(),
      ]);
      prisma.optionPlan.findMany.mockResolvedValue([mockOptionPlan()]);
      prisma.optionGrant.findMany.mockResolvedValue([mockGrant()]);
    });

    it('should return a Buffer from workbook', async () => {
      const buffer = await service.generateCapTableXlsx('comp-1');

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should create worksheets for summary, share classes, shareholders, and options', async () => {
      await service.generateCapTableXlsx('comp-1');

      // 4 worksheets: Resumo, Por Classe, Por Acionista, Pool de Opções
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Resumo');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Por Classe');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Por Acionista');
      expect(mockWorkbook.addWorksheet).toHaveBeenCalledWith('Pool de Opções');
    });

    it('should still create option pool worksheet when no plans but includeOptions defaults true', async () => {
      // When includeOptions is true (default), optionPoolSummary is always an
      // object (with zero values), so the worksheet is still created.
      prisma.optionPlan.findMany.mockResolvedValue([]);
      prisma.optionGrant.findMany.mockResolvedValue([]);

      await service.generateCapTableXlsx('comp-1');

      const worksheetNames = mockWorkbook.addWorksheet.mock.calls.map(
        (c: any[]) => c[0],
      );
      // Option pool summary exists (all zeros) so the sheet is created
      expect(worksheetNames).toContain('Pool de Opções');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // generateCapTableOct
  // ═══════════════════════════════════════════════════════════════════════

  describe('generateCapTableOct', () => {
    it('should return OCT JSON buffer with correct structure', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findMany.mockResolvedValue([
        {
          id: 'class-1',
          className: 'ON',
          type: 'COMMON_SHARES',
          totalAuthorized: new Prisma.Decimal(100000),
          totalIssued: new Prisma.Decimal(20000),
          votesPerShare: 1,
          liquidationPreferenceMultiple: null,
          participatingRights: false,
          seniority: 1,
        },
      ]);
      prisma.shareholder.findMany.mockResolvedValue([
        {
          id: 'holder-1',
          name: 'Holder A',
          type: 'INDIVIDUAL',
          nationality: 'BR',
          isForeign: false,
          shareholdings: [
            {
              id: 'hold-1',
              shareClassId: 'class-1',
              quantity: new Prisma.Decimal(10000),
              createdAt: new Date('2025-03-01'),
              shareClass: { id: 'class-1', className: 'ON' },
            },
          ],
        },
      ]);

      const buffer = await service.generateCapTableOct('comp-1');

      expect(Buffer.isBuffer(buffer)).toBe(true);
      const json = JSON.parse(buffer.toString('utf-8'));
      expect(json.ocfVersion).toBe('1.0.0');
      expect(json.issuer.legalName).toBe('Test Company');
      expect(json.issuer.jurisdiction).toBe('BR');
      expect(json.stockClasses).toHaveLength(1);
      expect(json.stockClasses[0].name).toBe('ON');
      expect(json.stockholders).toHaveLength(1);
      expect(json.stockIssuances).toHaveLength(1);
      expect(json.stockIssuances[0].quantity).toBe('10000');
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.generateCapTableOct('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should map PREFERRED_SHARES type to PREFERRED class type', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findMany.mockResolvedValue([
        {
          id: 'class-pn',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          totalAuthorized: new Prisma.Decimal(50000),
          totalIssued: new Prisma.Decimal(10000),
          votesPerShare: 0,
          liquidationPreferenceMultiple: new Prisma.Decimal(1),
          participatingRights: true,
          seniority: 2,
        },
      ]);
      prisma.shareholder.findMany.mockResolvedValue([]);

      const buffer = await service.generateCapTableOct('comp-1');
      const json = JSON.parse(buffer.toString('utf-8'));

      expect(json.stockClasses[0].classType).toBe('PREFERRED');
      expect(json.stockClasses[0].liquidationPreferenceMultiple).toBe('1');
      expect(json.stockClasses[0].participatingPreferred).toBe(true);
    });

    it('should handle company with no shareholders', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findMany.mockResolvedValue([]);
      prisma.shareholder.findMany.mockResolvedValue([]);

      const buffer = await service.generateCapTableOct('comp-1');
      const json = JSON.parse(buffer.toString('utf-8'));

      expect(json.stockClasses).toHaveLength(0);
      expect(json.stockholders).toHaveLength(0);
      expect(json.stockIssuances).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // completeExportJob
  // ═══════════════════════════════════════════════════════════════════════

  describe('completeExportJob', () => {
    it('should upload to S3 and update job status when S3 available', async () => {
      prisma.exportJob.findUnique.mockResolvedValue(
        mockExportJob({ companyId: 'comp-1' }),
      );

      await service.completeExportJob(
        'job-1',
        Buffer.from('test data'),
        'text/csv',
        'csv',
      );

      expect(s3Service.upload).toHaveBeenCalledWith(
        'navia-exports',
        'exports/comp-1/job-1.csv',
        expect.any(Buffer),
        { contentType: 'text/csv' },
      );
      expect(s3Service.generatePresignedUrl).toHaveBeenCalledWith(
        'navia-exports',
        'exports/comp-1/job-1.csv',
        3600,
      );
      expect(prisma.exportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job-1' },
          data: expect.objectContaining({
            status: 'COMPLETED',
            s3Key: 'exports/comp-1/job-1.csv',
            downloadUrl: 'https://s3.example.com/signed',
            expiresAt: expect.any(Date),
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should mark completed without download URL when S3 unavailable', async () => {
      s3Service.isAvailable.mockReturnValue(false);
      prisma.exportJob.findUnique.mockResolvedValue(
        mockExportJob({ companyId: 'comp-1' }),
      );

      await service.completeExportJob(
        'job-1',
        Buffer.from('test data'),
        'text/csv',
        'csv',
      );

      expect(s3Service.upload).not.toHaveBeenCalled();
      expect(prisma.exportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            completedAt: expect.any(Date),
          }),
        }),
      );
      // downloadUrl and s3Key should NOT be present
      const updateData = prisma.exportJob.update.mock.calls[0][0].data;
      expect(updateData.downloadUrl).toBeUndefined();
      expect(updateData.s3Key).toBeUndefined();
    });

    it('should silently return when export job not found', async () => {
      prisma.exportJob.findUnique.mockResolvedValue(null);

      await service.completeExportJob(
        'nonexistent',
        Buffer.from('data'),
        'text/csv',
        'csv',
      );

      expect(s3Service.upload).not.toHaveBeenCalled();
      expect(prisma.exportJob.update).not.toHaveBeenCalled();
    });

    it('should use "user" folder in S3 key when companyId is null', async () => {
      prisma.exportJob.findUnique.mockResolvedValue(
        mockExportJob({ companyId: null }),
      );

      await service.completeExportJob(
        'job-1',
        Buffer.from('data'),
        'application/json',
        'json',
      );

      expect(s3Service.upload).toHaveBeenCalledWith(
        'navia-exports',
        'exports/user/job-1.json',
        expect.any(Buffer),
        expect.any(Object),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // failExportJob
  // ═══════════════════════════════════════════════════════════════════════

  describe('failExportJob', () => {
    it('should mark job as failed with error code', async () => {
      prisma.exportJob.update.mockResolvedValue(
        mockExportJob({ status: 'FAILED', errorCode: 'GENERATION_ERROR' }),
      );

      await service.failExportJob('job-1', 'GENERATION_ERROR');

      expect(prisma.exportJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: {
          status: 'FAILED',
          errorCode: 'GENERATION_ERROR',
          completedAt: expect.any(Date),
        },
      });
    });

    it('should include completedAt timestamp', async () => {
      prisma.exportJob.update.mockResolvedValue(mockExportJob());

      await service.failExportJob('job-1', 'TIMEOUT');

      const updateData = prisma.exportJob.update.mock.calls[0][0].data;
      expect(updateData.completedAt).toBeInstanceOf(Date);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Edge cases and integration-like scenarios
  // ═══════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('ownership report: grant fully vested after vesting duration', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', name: 'Test' });
      prisma.shareholding.findMany.mockResolvedValue([]);
      prisma.optionPlan.findMany.mockResolvedValue([
        mockOptionPlan({
          totalPoolSize: new Prisma.Decimal(1000),
          totalGranted: new Prisma.Decimal(1000),
          totalExercised: new Prisma.Decimal(0),
        }),
      ]);
      prisma.optionGrant.findMany.mockResolvedValue([
        mockGrant({
          quantity: new Prisma.Decimal(1000),
          exercised: new Prisma.Decimal(0),
          grantDate: new Date('2020-01-01'), // 6+ years ago, fully vested
          cliffMonths: 12,
          vestingDurationMonths: 48,
          cliffPercentage: new Prisma.Decimal(25),
        }),
      ]);

      const result = await service.getOwnershipReport('comp-1', {});

      expect(result.optionPoolSummary!.vestedUnexercised).toBe('1000');
      expect(result.optionPoolSummary!.unvested).toBe('0');
    });

    it('dilution report: multiple share classes in same snapshot', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1', createdAt: new Date('2025-01-01') });
      prisma.capTableSnapshot.findMany.mockResolvedValue([
        {
          snapshotDate: new Date('2025-03-01'),
          data: {
            entries: [
              { shareClassId: 'c1', shareClassName: 'ON', shares: '10000' },
              { shareClassId: 'c1', shareClassName: 'ON', shares: '5000' },
              { shareClassId: 'c2', shareClassName: 'PN', shares: '3000' },
            ],
          },
        },
      ]);
      prisma.shareholding.findMany
        .mockResolvedValueOnce([
          { quantity: new Prisma.Decimal(15000) },
          { quantity: new Prisma.Decimal(3000) },
        ])
        .mockResolvedValueOnce([
          { quantity: new Prisma.Decimal(15000), shareholder: { isForeign: false } },
          { quantity: new Prisma.Decimal(3000), shareholder: { isForeign: false } },
        ]);

      const result = await service.getDilutionReport('comp-1', {
        dateFrom: '2025-01-01',
        dateTo: '2025-06-01',
      });

      // Should have at least one data point
      expect(result.dataPoints.length).toBeGreaterThan(0);
      const point = result.dataPoints[0];
      // Total shares: 10000 + 5000 + 3000 = 18000
      expect(point.totalShares).toBe('18000');
      // ON aggregated: 15000, PN: 3000
      expect(point.shareClasses).toHaveLength(2);
    });

    it('exportCapTable: deduplication query filters by status and time window', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.exportJob.findFirst.mockResolvedValue(null);
      prisma.exportJob.create.mockResolvedValue(mockExportJob());

      await service.exportCapTable('comp-1', 'user-1', 'csv');

      expect(prisma.exportJob.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp-1',
            format: 'csv',
            status: { in: ['QUEUED', 'PROCESSING'] },
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('formatExportJobResponse: serializes dates and null fields', async () => {
      const now = new Date();
      const completedJob = mockExportJob({
        status: 'COMPLETED',
        format: 'pdf',
        downloadUrl: 'https://example.com',
        expiresAt: new Date(now.getTime() + 3600000),
        completedAt: now,
        errorCode: null,
      });
      prisma.exportJob.findFirst.mockResolvedValue(completedJob);

      const result = await service.getExportJobStatus('comp-1', 'job-1');

      expect(result.completedAt).toBe(now.toISOString());
      expect(result.expiresAt).toBeDefined();
      expect(result.errorCode).toBeNull();
      expect(result.format).toBe('pdf');
    });
  });
});
