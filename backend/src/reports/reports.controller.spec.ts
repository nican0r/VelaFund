import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { PortfolioController } from './portfolio.controller';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { ThrottlerModule } from '@nestjs/throttler';

const mockUser = {
  id: 'user-1',
  privyUserId: 'privy-1',
  email: 'admin@navia.com.br',
  walletAddress: null,
  firstName: 'Nelson',
  lastName: 'Pereira',
  kycStatus: 'APPROVED',
  locale: 'pt-BR',
};

const mockOwnershipReport = {
  companyId: 'comp-1',
  companyName: 'Acme Ltda.',
  generatedAt: '2026-02-25T10:00:00.000Z',
  totalShares: '100000',
  totalFullyDiluted: '104000',
  shareholders: [
    {
      shareholderId: 'sh-1',
      name: 'Joao Silva',
      shareClassId: 'sc-1',
      shareClassName: 'ON',
      shares: '60000',
      percentage: '60.00',
      fullyDilutedPercentage: '57.69',
    },
    {
      shareholderId: 'sh-2',
      name: 'Maria Santos',
      shareClassId: 'sc-1',
      shareClassName: 'ON',
      shares: '40000',
      percentage: '40.00',
      fullyDilutedPercentage: '38.46',
    },
  ],
  optionPoolSummary: {
    totalPool: '10000',
    granted: '5000',
    exercised: '1000',
    vestedUnexercised: '2000',
    unvested: '2000',
    available: '5000',
  },
};

const mockDilutionReport = {
  companyId: 'comp-1',
  generatedAt: '2026-02-25T10:00:00.000Z',
  dateRange: {
    from: '2025-02-25',
    to: '2026-02-25',
  },
  granularity: 'month',
  dataPoints: [
    {
      date: '2025-03-01',
      totalShares: '80000',
      shareholders: [
        { name: 'Joao Silva', shares: '60000', ownershipPct: '75.00' },
        { name: 'Maria Santos', shares: '20000', ownershipPct: '25.00' },
      ],
    },
    {
      date: '2025-06-01',
      totalShares: '100000',
      shareholders: [
        { name: 'Joao Silva', shares: '60000', ownershipPct: '60.00' },
        { name: 'Maria Santos', shares: '40000', ownershipPct: '40.00' },
      ],
    },
  ],
};

const mockExportJobResponse = {
  jobId: 'job-1',
  status: 'QUEUED',
  format: 'pdf',
  downloadUrl: null,
  expiresAt: null,
  createdAt: '2026-02-25T10:00:00.000Z',
  completedAt: null,
  errorCode: null,
};

const mockCompletedExportJob = {
  jobId: 'job-2',
  status: 'COMPLETED',
  format: 'pdf',
  downloadUrl: 'https://s3.amazonaws.com/navia-exports/comp-1/job-2.pdf',
  expiresAt: '2026-02-26T10:00:00.000Z',
  createdAt: '2026-02-25T10:00:00.000Z',
  completedAt: '2026-02-25T10:05:00.000Z',
  errorCode: null,
};

const mockPortfolio = {
  userId: 'user-1',
  generatedAt: '2026-02-25T10:00:00.000Z',
  holdings: [
    {
      companyId: 'comp-1',
      companyName: 'Acme Ltda.',
      shareClassName: 'ON',
      shares: '60000',
      ownershipPercentage: '60.00',
      totalInvested: '60000.00',
      estimatedValue: '600000.00',
      lastRoundPricePerShare: '10.00',
      roiMultiple: '10.00',
    },
  ],
  totals: {
    totalInvested: '60000.00',
    totalEstimatedValue: '600000.00',
    weightedRoiMultiple: '10.00',
  },
};

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot()],
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            getOwnershipReport: jest.fn(),
            getDilutionReport: jest.fn(),
            exportCapTable: jest.fn(),
            getExportJobStatus: jest.fn(),
            generateDueDiligence: jest.fn(),
            getPortfolio: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    service = module.get<ReportsService>(ReportsService);
  });

  // ─── getOwnershipReport ──────────────────────────────────────────────

  describe('getOwnershipReport', () => {
    it('should call service.getOwnershipReport and return result', async () => {
      (service.getOwnershipReport as jest.Mock).mockResolvedValue(mockOwnershipReport);

      const result = await controller.getOwnershipReport('comp-1', {});

      expect(service.getOwnershipReport).toHaveBeenCalledWith('comp-1', {});
      expect(result.companyId).toBe('comp-1');
      expect(result.shareholders).toHaveLength(2);
      expect(result.totalShares).toBe('100000');
    });

    it('should pass shareClassId filter to service', async () => {
      (service.getOwnershipReport as jest.Mock).mockResolvedValue(mockOwnershipReport);

      await controller.getOwnershipReport('comp-1', {
        shareClassId: 'sc-1',
      });

      expect(service.getOwnershipReport).toHaveBeenCalledWith('comp-1', {
        shareClassId: 'sc-1',
      });
    });

    it('should pass includeOptions flag to service', async () => {
      (service.getOwnershipReport as jest.Mock).mockResolvedValue({
        ...mockOwnershipReport,
        optionPoolSummary: null,
      });

      const result = await controller.getOwnershipReport('comp-1', {
        includeOptions: false,
      });

      expect(service.getOwnershipReport).toHaveBeenCalledWith('comp-1', {
        includeOptions: false,
      });
      expect(result.optionPoolSummary).toBeNull();
    });
  });

  // ─── getDilutionReport ───────────────────────────────────────────────

  describe('getDilutionReport', () => {
    it('should call service.getDilutionReport and return result', async () => {
      (service.getDilutionReport as jest.Mock).mockResolvedValue(mockDilutionReport);

      const result = await controller.getDilutionReport('comp-1', {});

      expect(service.getDilutionReport).toHaveBeenCalledWith('comp-1', {});
      expect(result.companyId).toBe('comp-1');
      expect(result.dataPoints).toHaveLength(2);
    });

    it('should pass date range and granularity to service', async () => {
      (service.getDilutionReport as jest.Mock).mockResolvedValue(mockDilutionReport);

      await controller.getDilutionReport('comp-1', {
        dateFrom: '2025-01-01',
        dateTo: '2026-01-01',
        granularity: 'week',
      });

      expect(service.getDilutionReport).toHaveBeenCalledWith('comp-1', {
        dateFrom: '2025-01-01',
        dateTo: '2026-01-01',
        granularity: 'week',
      });
    });
  });

  // ─── exportCapTable ──────────────────────────────────────────────────

  describe('exportCapTable', () => {
    it('should call service.exportCapTable with default format and return job status', async () => {
      (service.exportCapTable as jest.Mock).mockResolvedValue(mockExportJobResponse);

      const result = await controller.exportCapTable('comp-1', mockUser as any, {});

      expect(service.exportCapTable).toHaveBeenCalledWith('comp-1', 'user-1', 'pdf', undefined);
      expect(result.jobId).toBe('job-1');
      expect(result.status).toBe('QUEUED');
    });

    it('should pass specified format and snapshotDate to service', async () => {
      (service.exportCapTable as jest.Mock).mockResolvedValue(mockExportJobResponse);

      await controller.exportCapTable('comp-1', mockUser as any, {
        format: 'xlsx',
        snapshotDate: '2026-01-15',
      });

      expect(service.exportCapTable).toHaveBeenCalledWith('comp-1', 'user-1', 'xlsx', '2026-01-15');
    });
  });

  // ─── getExportStatus ─────────────────────────────────────────────────

  describe('getExportStatus', () => {
    it('should call service.getExportJobStatus and return job status', async () => {
      (service.getExportJobStatus as jest.Mock).mockResolvedValue(mockCompletedExportJob);

      const result = await controller.getExportStatus('comp-1', 'job-2');

      expect(service.getExportJobStatus).toHaveBeenCalledWith('comp-1', 'job-2');
      expect(result.jobId).toBe('job-2');
      expect(result.status).toBe('COMPLETED');
      expect(result.downloadUrl).toBeDefined();
    });
  });

  // ─── generateDueDiligence ────────────────────────────────────────────

  describe('generateDueDiligence', () => {
    it('should call service.generateDueDiligence and return job status', async () => {
      (service.generateDueDiligence as jest.Mock).mockResolvedValue(mockExportJobResponse);

      const result = await controller.generateDueDiligence('comp-1', mockUser as any, {});

      expect(service.generateDueDiligence).toHaveBeenCalledWith(
        'comp-1',
        'user-1',
        undefined,
        undefined,
      );
      expect(result.jobId).toBe('job-1');
      expect(result.status).toBe('QUEUED');
    });

    it('should pass date range to service', async () => {
      (service.generateDueDiligence as jest.Mock).mockResolvedValue(mockExportJobResponse);

      await controller.generateDueDiligence('comp-1', mockUser as any, {
        dateFrom: '2025-06-01',
        dateTo: '2026-02-25',
      });

      expect(service.generateDueDiligence).toHaveBeenCalledWith(
        'comp-1',
        'user-1',
        '2025-06-01',
        '2026-02-25',
      );
    });
  });

  // ─── getDueDiligenceStatus ───────────────────────────────────────────

  describe('getDueDiligenceStatus', () => {
    it('should call service.getExportJobStatus and return result', async () => {
      (service.getExportJobStatus as jest.Mock).mockResolvedValue(mockCompletedExportJob);

      const result = await controller.getDueDiligenceStatus('comp-1', 'job-2');

      expect(service.getExportJobStatus).toHaveBeenCalledWith('comp-1', 'job-2');
      expect(result.status).toBe('COMPLETED');
    });
  });

  // ─── Error propagation ───────────────────────────────────────────────

  describe('error propagation', () => {
    it('should propagate service errors to the caller', async () => {
      const error = new Error('Company not found');
      (service.getOwnershipReport as jest.Mock).mockRejectedValue(error);

      await expect(controller.getOwnershipReport('invalid-comp', {})).rejects.toThrow(
        'Company not found',
      );
    });

    it('should propagate export job not found errors', async () => {
      const error = new Error('Export job not found');
      (service.getExportJobStatus as jest.Mock).mockRejectedValue(error);

      await expect(controller.getExportStatus('comp-1', 'bad-job')).rejects.toThrow(
        'Export job not found',
      );
    });
  });
});

// ─── PortfolioController ─────────────────────────────────────────────────

describe('PortfolioController', () => {
  let controller: PortfolioController;
  let service: ReportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot()],
      controllers: [PortfolioController],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            getPortfolio: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<PortfolioController>(PortfolioController);
    service = module.get<ReportsService>(ReportsService);
  });

  describe('getPortfolio', () => {
    it('should call service.getPortfolio with user ID and return result', async () => {
      (service.getPortfolio as jest.Mock).mockResolvedValue(mockPortfolio);

      const result = await controller.getPortfolio(mockUser as any);

      expect(service.getPortfolio).toHaveBeenCalledWith('user-1');
      expect(result.userId).toBe('user-1');
      expect(result.holdings).toHaveLength(1);
      expect(result.totals.totalEstimatedValue).toBe('600000.00');
    });

    it('should return empty portfolio for user with no holdings', async () => {
      const emptyPortfolio = {
        userId: 'user-2',
        generatedAt: '2026-02-25T10:00:00.000Z',
        holdings: [],
        totals: {
          totalInvested: '0',
          totalEstimatedValue: '0',
          weightedRoiMultiple: '0.00',
        },
      };
      (service.getPortfolio as jest.Mock).mockResolvedValue(emptyPortfolio);

      const otherUser = { ...mockUser, id: 'user-2' };
      const result = await controller.getPortfolio(otherUser as any);

      expect(service.getPortfolio).toHaveBeenCalledWith('user-2');
      expect(result.holdings).toHaveLength(0);
      expect(result.totals.totalEstimatedValue).toBe('0');
    });
  });
});
