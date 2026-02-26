import { Test, TestingModule } from '@nestjs/testing';
import { CapTableController } from './cap-table.controller';
import { CapTableService } from './cap-table.service';
import { NotFoundException, BusinessRuleException } from '../common/filters/app-exception';

// ─── MOCK SERVICE ───────────────────────────────────────────────

const mockService = {
  getCurrentCapTable: jest.fn(),
  getFullyDilutedCapTable: jest.fn(),
  getSnapshot: jest.fn(),
  getSnapshotHistory: jest.fn(),
  createSnapshot: jest.fn(),
  exportOct: jest.fn(),
  recalculateOwnership: jest.fn(),
};

// ─── MOCK DATA ──────────────────────────────────────────────────

const mockCapTableResponse = {
  company: { id: 'comp-1', name: 'Test Company', entityType: 'LTDA' as const },
  summary: {
    totalShares: '80000',
    totalShareholders: 3,
    totalShareClasses: 2,
    lastUpdated: '2025-03-01T00:00:00.000Z',
  },
  entries: [
    {
      shareholderId: 'sh-1',
      shareholderName: 'João Silva',
      shareholderType: 'FOUNDER' as const,
      shareClassId: 'sc-1',
      shareClassName: 'Quotas',
      shareClassType: 'QUOTA' as const,
      shares: '40000',
      ownershipPercentage: '50.000000',
      votingPower: '40000',
      votingPercentage: '40.000000',
    },
  ],
};

const mockFullyDilutedResponse = {
  company: { id: 'comp-1', name: 'Test Company', entityType: 'LTDA' as const },
  summary: {
    totalSharesOutstanding: '80000',
    totalOptionsOutstanding: '4000',
    fullyDilutedShares: '84000',
  },
  entries: [
    {
      shareholderId: 'sh-1',
      shareholderName: 'João Silva',
      shareholderType: 'FOUNDER' as const,
      currentShares: '40000',
      currentPercentage: '50.000000',
      optionsVested: '0',
      optionsUnvested: '0',
      fullyDilutedShares: '40000',
      fullyDilutedPercentage: '47.619048',
    },
  ],
};

const mockSnapshotResponse = {
  id: 'snap-1',
  snapshotDate: '2025-12-31T00:00:00.000Z',
  data: { summary: { totalShares: '80000' } },
  notes: 'End of year',
  stateHash: 'abc123',
  createdAt: '2025-12-31T23:59:59.000Z',
};

const mockSnapshotHistoryResponse = {
  items: [
    {
      id: 'snap-1',
      snapshotDate: '2025-12-31T00:00:00.000Z',
      totalShares: '80000',
      totalShareholders: 3,
      trigger: 'manual',
      notes: 'End of year',
      stateHash: 'abc123',
      createdAt: '2025-12-31T23:59:59.000Z',
    },
  ],
  total: 1,
};

const mockCreatedSnapshot = {
  id: 'new-snap-1',
  snapshotDate: '2025-06-30T00:00:00.000Z',
  totalShares: '80000',
  totalShareholders: 3,
  stateHash: 'newhash',
  notes: 'Mid-year',
  createdAt: '2026-02-24T12:00:00.000Z',
};

const mockOctExport = {
  ocfVersion: '1.0.0',
  generatedAt: '2026-02-24T12:00:00.000Z',
  issuer: {
    id: 'comp-1',
    legalName: 'Test Company',
    entityType: 'LTDA' as const,
    jurisdiction: 'BR',
    taxId: '12.345.678/0001-95',
    foundedDate: null,
  },
  stockClasses: [],
  stockholders: [],
  stockIssuances: [],
};

// ─── TESTS ──────────────────────────────────────────────────────

describe('CapTableController', () => {
  let controller: CapTableController;
  let service: jest.Mocked<CapTableService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CapTableController],
      providers: [{ provide: CapTableService, useValue: mockService }],
    }).compile();

    controller = module.get<CapTableController>(CapTableController);
    service = module.get(CapTableService) as jest.Mocked<CapTableService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getCurrentCapTable ─────────────────────────────────────────

  describe('getCurrentCapTable', () => {
    it('should return current cap table data', async () => {
      service.getCurrentCapTable.mockResolvedValue(mockCapTableResponse);

      const result = await controller.getCurrentCapTable('comp-1', {
        view: 'current',
      });

      expect(result).toEqual(mockCapTableResponse);
      expect(service.getCurrentCapTable).toHaveBeenCalledWith('comp-1', {
        view: 'current',
      });
    });

    it('should delegate to fully-diluted service when view is fully-diluted', async () => {
      service.getFullyDilutedCapTable.mockResolvedValue(mockFullyDilutedResponse);

      const result = await controller.getCurrentCapTable('comp-1', {
        view: 'fully-diluted',
      });

      expect(result).toEqual(mockFullyDilutedResponse);
      expect(service.getFullyDilutedCapTable).toHaveBeenCalledWith('comp-1');
      expect(service.getCurrentCapTable).not.toHaveBeenCalled();
    });

    it('should pass shareClassId filter to service', async () => {
      service.getCurrentCapTable.mockResolvedValue(mockCapTableResponse);

      await controller.getCurrentCapTable('comp-1', {
        view: 'current',
        shareClassId: 'sc-1',
      });

      expect(service.getCurrentCapTable).toHaveBeenCalledWith('comp-1', {
        view: 'current',
        shareClassId: 'sc-1',
      });
    });

    it('should propagate NotFoundException', async () => {
      service.getCurrentCapTable.mockRejectedValue(new NotFoundException('company', 'comp-1'));

      await expect(controller.getCurrentCapTable('comp-1', { view: 'current' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getFullyDilutedCapTable ────────────────────────────────────

  describe('getFullyDilutedCapTable', () => {
    it('should return fully-diluted cap table data', async () => {
      service.getFullyDilutedCapTable.mockResolvedValue(mockFullyDilutedResponse);

      const result = await controller.getFullyDilutedCapTable('comp-1');

      expect(result).toEqual(mockFullyDilutedResponse);
      expect(service.getFullyDilutedCapTable).toHaveBeenCalledWith('comp-1');
    });

    it('should propagate NotFoundException', async () => {
      service.getFullyDilutedCapTable.mockRejectedValue(new NotFoundException('company', 'comp-1'));

      await expect(controller.getFullyDilutedCapTable('comp-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getSnapshot ───────────────────────────────────────────────

  describe('getSnapshot', () => {
    it('should return snapshot for a given date', async () => {
      service.getSnapshot.mockResolvedValue(mockSnapshotResponse);

      const result = await controller.getSnapshot('comp-1', '2025-12-31');

      expect(result).toEqual(mockSnapshotResponse);
      expect(service.getSnapshot).toHaveBeenCalledWith('comp-1', '2025-12-31');
    });

    it('should propagate NotFoundException when no snapshot found', async () => {
      service.getSnapshot.mockRejectedValue(new NotFoundException('capTableSnapshot'));

      await expect(controller.getSnapshot('comp-1', '2025-12-31')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate BusinessRuleException for date before company creation', async () => {
      service.getSnapshot.mockRejectedValue(
        new BusinessRuleException('CAP_NO_DATA_FOR_DATE', 'errors.cap.noDataForDate'),
      );

      await expect(controller.getSnapshot('comp-1', '2024-01-01')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  // ─── getHistory ────────────────────────────────────────────────

  describe('getHistory', () => {
    it('should return paginated snapshot history', async () => {
      service.getSnapshotHistory.mockResolvedValue(mockSnapshotHistoryResponse);

      const result = await controller.getHistory('comp-1', {
        page: 1,
        limit: 20,
      });

      // paginate() wraps the response with success: true and meta
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSnapshotHistoryResponse.items);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should pass pagination params to service', async () => {
      service.getSnapshotHistory.mockResolvedValue({ items: [], total: 0 });

      await controller.getHistory('comp-1', { page: 3, limit: 10 });

      expect(service.getSnapshotHistory).toHaveBeenCalledWith('comp-1', {
        page: 3,
        limit: 10,
      });
    });

    it('should propagate NotFoundException', async () => {
      service.getSnapshotHistory.mockRejectedValue(new NotFoundException('company', 'comp-1'));

      await expect(controller.getHistory('comp-1', { page: 1, limit: 20 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── exportOct ─────────────────────────────────────────────────

  describe('exportOct', () => {
    it('should return OCT-formatted cap table data', async () => {
      service.exportOct.mockResolvedValue(mockOctExport);

      const result = await controller.exportOct('comp-1');

      expect(result).toEqual(mockOctExport);
      expect(result.ocfVersion).toBe('1.0.0');
      expect(service.exportOct).toHaveBeenCalledWith('comp-1');
    });

    it('should propagate NotFoundException', async () => {
      service.exportOct.mockRejectedValue(new NotFoundException('company', 'comp-1'));

      await expect(controller.exportOct('comp-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── createSnapshot ────────────────────────────────────────────

  describe('createSnapshot', () => {
    it('should create a manual snapshot', async () => {
      service.createSnapshot.mockResolvedValue(mockCreatedSnapshot);

      const result = await controller.createSnapshot('comp-1', {
        snapshotDate: '2025-06-30',
        notes: 'Mid-year',
      });

      expect(result).toEqual(mockCreatedSnapshot);
      expect(service.createSnapshot).toHaveBeenCalledWith('comp-1', {
        snapshotDate: '2025-06-30',
        notes: 'Mid-year',
      });
    });

    it('should propagate BusinessRuleException for future date', async () => {
      service.createSnapshot.mockRejectedValue(
        new BusinessRuleException('CAP_FUTURE_SNAPSHOT_DATE', 'errors.cap.futureSnapshotDate'),
      );

      await expect(
        controller.createSnapshot('comp-1', {
          snapshotDate: '2099-12-31',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should propagate BusinessRuleException when company not active', async () => {
      service.createSnapshot.mockRejectedValue(
        new BusinessRuleException('CAP_COMPANY_NOT_ACTIVE', 'errors.cap.companyNotActive'),
      );

      await expect(
        controller.createSnapshot('comp-1', {
          snapshotDate: '2025-06-30',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should propagate NotFoundException', async () => {
      service.createSnapshot.mockRejectedValue(new NotFoundException('company', 'comp-1'));

      await expect(
        controller.createSnapshot('comp-1', {
          snapshotDate: '2025-06-30',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
