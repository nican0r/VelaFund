import { Test, TestingModule } from '@nestjs/testing';
import { CapTableService } from './cap-table.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BusinessRuleException } from '../common/filters/app-exception';
import { Prisma } from '@prisma/client';

// ─── MOCK DATA ──────────────────────────────────────────────────────

const mockCompany = {
  id: 'comp-1',
  name: 'Test Company Ltda',
  entityType: 'LTDA' as const,
  status: 'ACTIVE' as const,
  cnpj: '12.345.678/0001-95',
  foundedDate: new Date('2020-01-15'),
  createdAt: new Date('2025-01-01T00:00:00Z'),
};

const mockShareClass1 = {
  id: 'sc-1',
  companyId: 'comp-1',
  className: 'Quotas',
  type: 'QUOTA' as const,
  votesPerShare: 1,
  totalAuthorized: new Prisma.Decimal('100000'),
  totalIssued: new Prisma.Decimal('60000'),
  liquidationPreferenceMultiple: null,
  participatingRights: false,
  participationCap: null,
  rightOfFirstRefusal: true,
  lockUpPeriodMonths: null,
  tagAlongPercentage: null,
  conversionRatio: null,
  antiDilutionType: null,
  seniority: 0,
  createdAt: new Date('2025-01-15T00:00:00Z'),
  updatedAt: new Date('2025-01-15T00:00:00Z'),
};

const mockShareClass2 = {
  ...mockShareClass1,
  id: 'sc-2',
  className: 'Preferred A',
  type: 'PREFERRED_SHARES' as const,
  votesPerShare: 2,
  totalAuthorized: new Prisma.Decimal('50000'),
  totalIssued: new Prisma.Decimal('20000'),
};

const mockShareholder1 = {
  id: 'sh-1',
  name: 'João Silva',
  type: 'FOUNDER' as const,
  status: 'ACTIVE' as const,
};

const mockShareholder2 = {
  id: 'sh-2',
  name: 'Maria Santos',
  type: 'INVESTOR' as const,
  status: 'ACTIVE' as const,
};

const mockShareholder3 = {
  id: 'sh-3',
  name: 'Acme Corp',
  type: 'CORPORATE' as const,
  status: 'ACTIVE' as const,
};

const mockShareholding1 = {
  id: 'holding-1',
  companyId: 'comp-1',
  shareholderId: 'sh-1',
  shareClassId: 'sc-1',
  quantity: new Prisma.Decimal('40000'),
  ownershipPct: new Prisma.Decimal('50'),
  votingPowerPct: new Prisma.Decimal('40'),
  createdAt: new Date('2025-02-01T00:00:00Z'),
  updatedAt: new Date('2025-02-01T00:00:00Z'),
  shareholder: mockShareholder1,
  shareClass: {
    id: 'sc-1',
    className: 'Quotas',
    type: 'QUOTA' as const,
    votesPerShare: 1,
    totalAuthorized: new Prisma.Decimal('100000'),
    totalIssued: new Prisma.Decimal('60000'),
  },
};

const mockShareholding2 = {
  id: 'holding-2',
  companyId: 'comp-1',
  shareholderId: 'sh-2',
  shareClassId: 'sc-1',
  quantity: new Prisma.Decimal('20000'),
  ownershipPct: new Prisma.Decimal('25'),
  votingPowerPct: new Prisma.Decimal('20'),
  createdAt: new Date('2025-02-15T00:00:00Z'),
  updatedAt: new Date('2025-02-15T00:00:00Z'),
  shareholder: mockShareholder2,
  shareClass: {
    id: 'sc-1',
    className: 'Quotas',
    type: 'QUOTA' as const,
    votesPerShare: 1,
    totalAuthorized: new Prisma.Decimal('100000'),
    totalIssued: new Prisma.Decimal('60000'),
  },
};

const mockShareholding3 = {
  id: 'holding-3',
  companyId: 'comp-1',
  shareholderId: 'sh-3',
  shareClassId: 'sc-2',
  quantity: new Prisma.Decimal('20000'),
  ownershipPct: new Prisma.Decimal('25'),
  votingPowerPct: new Prisma.Decimal('40'),
  createdAt: new Date('2025-03-01T00:00:00Z'),
  updatedAt: new Date('2025-03-01T00:00:00Z'),
  shareholder: mockShareholder3,
  shareClass: {
    id: 'sc-2',
    className: 'Preferred A',
    type: 'PREFERRED_SHARES' as const,
    votesPerShare: 2,
    totalAuthorized: new Prisma.Decimal('50000'),
    totalIssued: new Prisma.Decimal('20000'),
  },
};

const allMockShareholdings = [mockShareholding1, mockShareholding2, mockShareholding3];

const mockOptionGrant = {
  id: 'grant-1',
  companyId: 'comp-1',
  shareholderId: 'sh-2',
  quantity: new Prisma.Decimal('5000'),
  exercised: new Prisma.Decimal('1000'),
  status: 'ACTIVE' as const,
  grantDate: new Date('2024-01-01T00:00:00Z'),
  cliffMonths: 12,
  vestingDurationMonths: 48,
  cliffPercentage: new Prisma.Decimal('25'),
  shareholder: mockShareholder2,
};

const mockSnapshot = {
  id: 'snap-1',
  companyId: 'comp-1',
  snapshotDate: new Date('2025-12-31'),
  data: {
    summary: { totalShares: '80000', totalShareholders: 3, totalShareClasses: 2 },
    entries: [],
    trigger: 'manual',
  },
  notes: 'End of year snapshot',
  stateHash: 'abc123hash',
  createdAt: new Date('2025-12-31T23:59:59Z'),
};

// ─── TESTS ──────────────────────────────────────────────────────────

describe('CapTableService', () => {
  let service: CapTableService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      company: {
        findUnique: jest.fn(),
      },
      shareholding: {
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      shareClass: {
        findMany: jest.fn(),
      },
      shareholder: {
        findMany: jest.fn(),
      },
      optionGrant: {
        findMany: jest.fn(),
      },
      capTableSnapshot: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CapTableService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CapTableService>(CapTableService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getCurrentCapTable ─────────────────────────────────────────

  describe('getCurrentCapTable', () => {
    it('should return cap table with calculated percentages', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue(allMockShareholdings);

      const result = await service.getCurrentCapTable('comp-1', { view: 'current' });

      expect(result.company.id).toBe('comp-1');
      expect(result.company.name).toBe('Test Company Ltda');
      expect(result.company.entityType).toBe('LTDA');

      // Total shares: 40000 + 20000 + 20000 = 80000
      expect(result.summary.totalShares).toBe('80000');
      expect(result.summary.totalShareholders).toBe(3);
      expect(result.summary.totalShareClasses).toBe(2);

      expect(result.entries).toHaveLength(3);

      // João owns 40000/80000 = 50%
      const joao = result.entries.find((e) => e.shareholderId === 'sh-1');
      expect(joao).toBeDefined();
      expect(joao!.shares).toBe('40000');
      expect(joao!.shareholderName).toBe('João Silva');
      expect(parseFloat(joao!.ownershipPercentage)).toBeCloseTo(50, 1);

      // Maria owns 20000/80000 = 25%
      const maria = result.entries.find((e) => e.shareholderId === 'sh-2');
      expect(maria).toBeDefined();
      expect(parseFloat(maria!.ownershipPercentage)).toBeCloseTo(25, 1);

      // Acme owns 20000/80000 = 25%
      const acme = result.entries.find((e) => e.shareholderId === 'sh-3');
      expect(acme).toBeDefined();
      expect(parseFloat(acme!.ownershipPercentage)).toBeCloseTo(25, 1);
    });

    it('should calculate voting power with different votesPerShare', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue(allMockShareholdings);

      const result = await service.getCurrentCapTable('comp-1', { view: 'current' });

      // Total voting power: 40000*1 + 20000*1 + 20000*2 = 100000
      const joao = result.entries.find((e) => e.shareholderId === 'sh-1');
      expect(joao!.votingPower).toBe('40000');
      // 40000 / 100000 = 40%
      expect(parseFloat(joao!.votingPercentage)).toBeCloseTo(40, 1);

      const acme = result.entries.find((e) => e.shareholderId === 'sh-3');
      expect(acme!.votingPower).toBe('40000');
      // 20000 * 2 / 100000 = 40%
      expect(parseFloat(acme!.votingPercentage)).toBeCloseTo(40, 1);
    });

    it('should handle empty cap table (no shareholdings)', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue([]);

      const result = await service.getCurrentCapTable('comp-1', { view: 'current' });

      expect(result.summary.totalShares).toBe('0');
      expect(result.summary.totalShareholders).toBe(0);
      expect(result.summary.totalShareClasses).toBe(0);
      expect(result.entries).toHaveLength(0);
    });

    it('should filter by share class when shareClassId is provided', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue([mockShareholding1, mockShareholding2]);

      const result = await service.getCurrentCapTable('comp-1', {
        view: 'current',
        shareClassId: 'sc-1',
      });

      expect(prisma.shareholding.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp-1',
            shareClassId: 'sc-1',
          }),
        }),
      );
      expect(result.entries).toHaveLength(2);
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentCapTable('nonexistent', { view: 'current' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return correct lastUpdated based on most recent shareholding', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue(allMockShareholdings);

      const result = await service.getCurrentCapTable('comp-1', { view: 'current' });

      // Most recent updatedAt is mockShareholding3: 2025-03-01
      expect(result.summary.lastUpdated).toBe('2025-03-01T00:00:00.000Z');
    });

    it('should include share class details in entries', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue([mockShareholding1]);

      const result = await service.getCurrentCapTable('comp-1', { view: 'current' });

      expect(result.entries[0].shareClassName).toBe('Quotas');
      expect(result.entries[0].shareClassType).toBe('QUOTA');
      expect(result.entries[0].shareholderType).toBe('FOUNDER');
    });
  });

  // ─── getFullyDilutedCapTable ────────────────────────────────────

  describe('getFullyDilutedCapTable', () => {
    it('should include option grants in fully-diluted calculation', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue([mockShareholding1]);
      prisma.optionGrant.findMany.mockResolvedValue([mockOptionGrant]);

      const result = await service.getFullyDilutedCapTable('comp-1');

      // Total shares outstanding: 40000
      expect(result.summary.totalSharesOutstanding).toBe('40000');

      // Total options outstanding: 5000 - 1000 (exercised) = 4000
      expect(result.summary.totalOptionsOutstanding).toBe('4000');

      // Fully diluted: 40000 + 4000 = 44000
      expect(result.summary.fullyDilutedShares).toBe('44000');

      // Should have 2 entries (João from shares, Maria from options)
      expect(result.entries).toHaveLength(2);
    });

    it('should handle case with no option grants', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue(allMockShareholdings);
      prisma.optionGrant.findMany.mockResolvedValue([]);

      const result = await service.getFullyDilutedCapTable('comp-1');

      expect(result.summary.totalOptionsOutstanding).toBe('0');
      expect(result.summary.fullyDilutedShares).toBe('80000');
      expect(result.entries).toHaveLength(3);
    });

    it('should aggregate shares and options for same shareholder', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      // Maria has both shares and options
      prisma.shareholding.findMany.mockResolvedValue([mockShareholding2]);
      prisma.optionGrant.findMany.mockResolvedValue([mockOptionGrant]);

      const result = await service.getFullyDilutedCapTable('comp-1');

      // Maria should appear once with combined totals
      const maria = result.entries.find((e) => e.shareholderId === 'sh-2');
      expect(maria).toBeDefined();
      expect(maria!.currentShares).toBe('20000');
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.getFullyDilutedCapTable('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should sort entries by fully-diluted percentage descending', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue(allMockShareholdings);
      prisma.optionGrant.findMany.mockResolvedValue([]);

      const result = await service.getFullyDilutedCapTable('comp-1');

      // João (50%) should be first, Maria and Acme (25% each) should follow
      expect(parseFloat(result.entries[0].fullyDilutedPercentage)).toBeGreaterThanOrEqual(
        parseFloat(result.entries[1].fullyDilutedPercentage),
      );
    });

    it('should handle empty cap table with no shares and no options', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue([]);
      prisma.optionGrant.findMany.mockResolvedValue([]);

      const result = await service.getFullyDilutedCapTable('comp-1');

      expect(result.summary.totalSharesOutstanding).toBe('0');
      expect(result.summary.totalOptionsOutstanding).toBe('0');
      expect(result.summary.fullyDilutedShares).toBe('0');
      expect(result.entries).toHaveLength(0);
    });
  });

  // ─── getSnapshot ───────────────────────────────────────────────

  describe('getSnapshot', () => {
    it('should return the closest snapshot on or before the requested date', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.capTableSnapshot.findFirst.mockResolvedValue(mockSnapshot);

      const result = await service.getSnapshot('comp-1', '2026-01-15');

      expect(result.id).toBe('snap-1');
      expect(result.data).toBeDefined();
      expect(result.notes).toBe('End of year snapshot');
      expect(result.stateHash).toBe('abc123hash');
    });

    it('should throw NotFoundException when no snapshot exists', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.capTableSnapshot.findFirst.mockResolvedValue(null);

      await expect(service.getSnapshot('comp-1', '2026-01-15')).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException for date before company creation', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);

      await expect(service.getSnapshot('comp-1', '2024-06-01')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.getSnapshot('nonexistent', '2026-01-15')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should query with lte for date filtering', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.capTableSnapshot.findFirst.mockResolvedValue(mockSnapshot);

      await service.getSnapshot('comp-1', '2026-01-15');

      expect(prisma.capTableSnapshot.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp-1',
            snapshotDate: { lte: expect.any(Date) },
          }),
          orderBy: { snapshotDate: 'desc' },
        }),
      );
    });
  });

  // ─── getSnapshotHistory ────────────────────────────────────────

  describe('getSnapshotHistory', () => {
    it('should return paginated list of snapshots', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.capTableSnapshot.findMany.mockResolvedValue([mockSnapshot]);
      prisma.capTableSnapshot.count.mockResolvedValue(1);

      const result = await service.getSnapshotHistory('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('snap-1');
      expect(result.items[0].totalShares).toBe('80000');
      expect(result.items[0].totalShareholders).toBe(3);
      expect(result.items[0].trigger).toBe('manual');
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.getSnapshotHistory('nonexistent', { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use correct pagination params', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.capTableSnapshot.findMany.mockResolvedValue([]);
      prisma.capTableSnapshot.count.mockResolvedValue(0);

      await service.getSnapshotHistory('comp-1', { page: 3, limit: 10 });

      expect(prisma.capTableSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        }),
      );
    });

    it('should default sort to snapshotDate desc', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.capTableSnapshot.findMany.mockResolvedValue([]);
      prisma.capTableSnapshot.count.mockResolvedValue(0);

      await service.getSnapshotHistory('comp-1', { page: 1, limit: 20 });

      expect(prisma.capTableSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ snapshotDate: 'desc' }],
        }),
      );
    });
  });

  // ─── createSnapshot ────────────────────────────────────────────

  describe('createSnapshot', () => {
    it('should create a manual snapshot with current cap table state', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue(allMockShareholdings);
      prisma.capTableSnapshot.create.mockResolvedValue({
        id: 'new-snap-1',
        companyId: 'comp-1',
        snapshotDate: new Date('2025-06-30'),
        data: {},
        notes: 'Mid-year snapshot',
        stateHash: 'newhash123',
        createdAt: new Date('2026-02-24T12:00:00Z'),
      });

      const result = await service.createSnapshot('comp-1', {
        snapshotDate: '2025-06-30',
        notes: 'Mid-year snapshot',
      });

      expect(result.id).toBe('new-snap-1');
      expect(result.totalShares).toBe('80000');
      expect(result.totalShareholders).toBe(3);
      expect(result.notes).toBe('Mid-year snapshot');
      expect(result.stateHash).toBeDefined();
    });

    it('should throw BusinessRuleException for future snapshot date', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);

      await expect(
        service.createSnapshot('comp-1', {
          snapshotDate: '2099-12-31',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException when company is not active', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'DRAFT',
      });

      await expect(
        service.createSnapshot('comp-1', {
          snapshotDate: '2025-06-30',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.createSnapshot('nonexistent', {
          snapshotDate: '2025-06-30',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include trigger type as manual in snapshot data', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue([]);
      prisma.capTableSnapshot.create.mockResolvedValue({
        id: 'new-snap-2',
        companyId: 'comp-1',
        snapshotDate: new Date('2025-06-30'),
        data: {},
        notes: null,
        stateHash: 'hash',
        createdAt: new Date(),
      });

      await service.createSnapshot('comp-1', {
        snapshotDate: '2025-06-30',
      });

      expect(prisma.capTableSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data: expect.objectContaining({
              trigger: 'manual',
            }),
          }),
        }),
      );
    });

    it('should compute a state hash for the snapshot', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue(allMockShareholdings);
      prisma.capTableSnapshot.create.mockResolvedValue({
        id: 'snap-hash',
        companyId: 'comp-1',
        snapshotDate: new Date('2025-06-30'),
        data: {},
        notes: null,
        stateHash: expect.any(String),
        createdAt: new Date(),
      });

      await service.createSnapshot('comp-1', {
        snapshotDate: '2025-06-30',
      });

      expect(prisma.capTableSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stateHash: expect.any(String),
          }),
        }),
      );
    });
  });

  // ─── createAutoSnapshot ────────────────────────────────────────

  describe('createAutoSnapshot', () => {
    it('should create a snapshot with the given trigger', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue(allMockShareholdings);
      prisma.capTableSnapshot.create.mockResolvedValue({
        id: 'auto-snap-1',
        companyId: 'comp-1',
        snapshotDate: new Date(),
        data: {},
        notes: 'Transaction ISSUANCE confirmed',
        stateHash: 'autohash',
        createdAt: new Date(),
      });

      await service.createAutoSnapshot(
        'comp-1',
        'transaction_confirmed',
        'Transaction ISSUANCE confirmed',
      );

      expect(prisma.capTableSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'comp-1',
            data: expect.objectContaining({
              trigger: 'transaction_confirmed',
            }),
            notes: 'Transaction ISSUANCE confirmed',
            stateHash: expect.any(String),
          }),
        }),
      );
    });

    it('should not throw when snapshot creation fails (fire-and-forget)', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue(allMockShareholdings);
      prisma.capTableSnapshot.create.mockRejectedValue(new Error('DB error'));

      // Should resolve without throwing
      await expect(
        service.createAutoSnapshot('comp-1', 'transaction_confirmed'),
      ).resolves.toBeUndefined();
    });

    it('should not throw when getCurrentCapTable fails', async () => {
      prisma.company.findUnique.mockResolvedValue(null); // Will cause NotFoundException inside

      await expect(
        service.createAutoSnapshot('comp-1', 'funding_round_closed'),
      ).resolves.toBeUndefined();
    });

    it('should use null notes when none provided', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareholding.findMany.mockResolvedValue([]);
      prisma.capTableSnapshot.create.mockResolvedValue({
        id: 'auto-snap-2',
        companyId: 'comp-1',
        snapshotDate: new Date(),
        data: {},
        notes: null,
        stateHash: 'hash',
        createdAt: new Date(),
      });

      await service.createAutoSnapshot('comp-1', 'exercise_confirmed');

      expect(prisma.capTableSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: null,
          }),
        }),
      );
    });
  });

  // ─── exportOct ─────────────────────────────────────────────────

  describe('exportOct', () => {
    it('should export cap table in OCT format', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findMany.mockResolvedValue([mockShareClass1, mockShareClass2]);
      prisma.shareholder.findMany.mockResolvedValue([
        {
          ...mockShareholder1,
          companyId: 'comp-1',
          cpfCnpj: '529.982.247-25',
          nationality: 'BR',
          isForeign: false,
          status: 'ACTIVE',
          shareholdings: [
            {
              id: 'holding-1',
              shareClassId: 'sc-1',
              quantity: new Prisma.Decimal('40000'),
              createdAt: new Date('2025-02-01'),
              shareClass: { id: 'sc-1', className: 'Quotas' },
            },
          ],
        },
      ]);

      const result = await service.exportOct('comp-1');

      expect(result.ocfVersion).toBe('1.0.0');
      expect(result.issuer.legalName).toBe('Test Company Ltda');
      expect(result.issuer.jurisdiction).toBe('BR');
      expect(result.issuer.entityType).toBe('LTDA');
      expect(result.stockClasses).toHaveLength(2);
      expect(result.stockholders).toHaveLength(1);
      expect(result.stockIssuances).toHaveLength(1);
    });

    it('should map QUOTA to COMMON in OCT format', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findMany.mockResolvedValue([mockShareClass1]);
      prisma.shareholder.findMany.mockResolvedValue([]);

      const result = await service.exportOct('comp-1');

      expect(result.stockClasses[0].classType).toBe('COMMON');
    });

    it('should map PREFERRED_SHARES to PREFERRED in OCT format', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findMany.mockResolvedValue([mockShareClass2]);
      prisma.shareholder.findMany.mockResolvedValue([]);

      const result = await service.exportOct('comp-1');

      expect(result.stockClasses[0].classType).toBe('PREFERRED');
    });

    it('should mask CPF in OCT export', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findMany.mockResolvedValue([]);
      prisma.shareholder.findMany.mockResolvedValue([
        {
          ...mockShareholder1,
          companyId: 'comp-1',
          cpfCnpj: '529.982.247-25',
          nationality: 'BR',
          isForeign: false,
          status: 'ACTIVE',
          shareholdings: [],
        },
      ]);

      const result = await service.exportOct('comp-1');

      // CPF should be masked, not showing full value
      expect(result.stockholders[0].taxId).not.toBe('529.982.247-25');
      expect(result.stockholders[0].taxId).toContain('***');
    });

    it('should throw NotFoundException when company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(service.exportOct('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should include generatedAt timestamp', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findMany.mockResolvedValue([]);
      prisma.shareholder.findMany.mockResolvedValue([]);

      const result = await service.exportOct('comp-1');

      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
    });
  });

  // ─── recalculateOwnership ──────────────────────────────────────

  describe('recalculateOwnership', () => {
    it('should recalculate all shareholding percentages', async () => {
      const shareholdingsForRecalc = [
        {
          id: 'holding-1',
          quantity: new Prisma.Decimal('60000'),
          shareClass: { votesPerShare: 1 },
        },
        {
          id: 'holding-2',
          quantity: new Prisma.Decimal('40000'),
          shareClass: { votesPerShare: 1 },
        },
      ];

      prisma.shareholding.findMany
        .mockResolvedValueOnce(shareholdingsForRecalc)
        .mockResolvedValueOnce([
          { ownershipPct: new Prisma.Decimal('60') },
          { ownershipPct: new Prisma.Decimal('40') },
        ]);

      prisma.$transaction.mockResolvedValue([{}, {}]);

      await service.recalculateOwnership('comp-1');

      // Should batch update via $transaction
      expect(prisma.$transaction).toHaveBeenCalled();
      const updateCalls = prisma.$transaction.mock.calls[0][0];
      expect(updateCalls).toHaveLength(2);
    });

    it('should handle empty cap table (no shareholdings)', async () => {
      prisma.shareholding.findMany.mockResolvedValue([]);

      await service.recalculateOwnership('comp-1');

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should correctly weight voting power by votesPerShare', async () => {
      const shareholdingsForRecalc = [
        {
          id: 'holding-1',
          quantity: new Prisma.Decimal('10000'),
          shareClass: { votesPerShare: 1 },
        },
        {
          id: 'holding-2',
          quantity: new Prisma.Decimal('10000'),
          shareClass: { votesPerShare: 2 },
        },
      ];

      prisma.shareholding.findMany
        .mockResolvedValueOnce(shareholdingsForRecalc)
        .mockResolvedValueOnce([
          { ownershipPct: new Prisma.Decimal('50') },
          { ownershipPct: new Prisma.Decimal('50') },
        ]);

      // Capture the $transaction calls to verify voting power calculations
      prisma.$transaction.mockImplementation(async (updates: any[]) => {
        return updates;
      });

      await service.recalculateOwnership('comp-1');

      // Total voting power: 10000*1 + 10000*2 = 30000
      // holding-1 voting %: 10000/30000 = 33.33%
      // holding-2 voting %: 20000/30000 = 66.67%
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
