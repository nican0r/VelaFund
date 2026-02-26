import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ConvertibleService } from './convertible.service';
import { PrismaService } from '../prisma/prisma.service';
import { CapTableService } from '../cap-table/cap-table.service';
import {
  NotFoundException,
  BusinessRuleException,
  ConflictException,
} from '../common/filters/app-exception';
import { InstrumentTypeDto } from './dto/create-convertible.dto';

const mockCapTableService = {
  recalculateOwnership: jest.fn(),
  createAutoSnapshot: jest.fn(),
};

const mockPrisma = {
  company: { findFirst: jest.fn() },
  shareholder: { findFirst: jest.fn() },
  shareClass: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  convertibleInstrument: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    update: jest.fn(),
  },
  fundingRound: { findFirst: jest.fn() },
  shareholding: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  transaction: { create: jest.fn() },
  $transaction: jest.fn(),
};

const userId = 'user-uuid-1';
const companyId = 'company-uuid-1';
const shareholderId = 'shareholder-uuid-1';
const convertibleId = 'convertible-uuid-1';

const mockConvertible = {
  id: convertibleId,
  companyId,
  shareholderId,
  instrumentType: 'MUTUO_CONVERSIVEL' as const,
  status: 'OUTSTANDING' as const,
  principalAmount: new Prisma.Decimal('100000.00'),
  interestRate: new Prisma.Decimal('0.08'),
  interestType: 'SIMPLE' as const,
  accruedInterest: new Prisma.Decimal('4000.00'),
  valuationCap: new Prisma.Decimal('5000000.00'),
  discountRate: new Prisma.Decimal('0.20'),
  qualifiedFinancingThreshold: new Prisma.Decimal('500000.00'),
  conversionTrigger: 'QUALIFIED_FINANCING' as const,
  targetShareClassId: null,
  autoConvert: false,
  mfnClause: true,
  issueDate: new Date('2024-01-15'),
  maturityDate: new Date('2026-01-15'),
  convertedAt: null,
  redeemedAt: null,
  cancelledAt: null,
  conversionData: null,
  notes: null,
  createdBy: userId,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ConvertibleService', () => {
  let service: ConvertibleService;
  let prisma: typeof mockPrisma;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConvertibleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CapTableService, useValue: mockCapTableService },
      ],
    }).compile();

    service = module.get<ConvertibleService>(ConvertibleService);
    prisma = module.get(PrismaService) as unknown as typeof mockPrisma;

    jest.clearAllMocks();
  });

  // ─── CREATE ──────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      shareholderId,
      instrumentType: InstrumentTypeDto.MUTUO_CONVERSIVEL,
      principalAmount: '100000.00',
      interestRate: '0.08',
      issueDate: '2024-01-15',
      maturityDate: '2026-01-15',
      discountRate: '0.20',
      valuationCap: '5000000.00',
    };

    it('should create a convertible instrument', async () => {
      prisma.company.findFirst.mockResolvedValue({
        id: companyId,
        status: 'ACTIVE',
      });
      prisma.shareholder.findFirst.mockResolvedValue({ id: shareholderId });
      prisma.convertibleInstrument.create.mockResolvedValue(mockConvertible);

      const result = await service.create(companyId, createDto, userId);

      expect(result).toBeDefined();
      expect(prisma.convertibleInstrument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instrumentType: 'MUTUO_CONVERSIVEL',
          }),
        }),
      );
    });

    it('should throw if company not found', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      await expect(service.create(companyId, createDto, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw if company not active', async () => {
      prisma.company.findFirst.mockResolvedValue({
        id: companyId,
        status: 'DRAFT',
      });

      await expect(service.create(companyId, createDto, userId)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw if shareholder not found', async () => {
      prisma.company.findFirst.mockResolvedValue({
        id: companyId,
        status: 'ACTIVE',
      });
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await expect(service.create(companyId, createDto, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw if maturity date before issue date', async () => {
      prisma.company.findFirst.mockResolvedValue({
        id: companyId,
        status: 'ACTIVE',
      });
      prisma.shareholder.findFirst.mockResolvedValue({ id: shareholderId });

      await expect(
        service.create(companyId, { ...createDto, maturityDate: '2023-01-01' }, userId),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if interest rate exceeds 30%', async () => {
      prisma.company.findFirst.mockResolvedValue({
        id: companyId,
        status: 'ACTIVE',
      });
      prisma.shareholder.findFirst.mockResolvedValue({ id: shareholderId });

      await expect(
        service.create(companyId, { ...createDto, interestRate: '0.35' }, userId),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if principal is zero', async () => {
      prisma.company.findFirst.mockResolvedValue({
        id: companyId,
        status: 'ACTIVE',
      });
      prisma.shareholder.findFirst.mockResolvedValue({ id: shareholderId });

      await expect(
        service.create(companyId, { ...createDto, principalAmount: '0' }, userId),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should validate target share class if provided', async () => {
      prisma.company.findFirst.mockResolvedValue({
        id: companyId,
        status: 'ACTIVE',
      });
      prisma.shareholder.findFirst.mockResolvedValue({ id: shareholderId });
      prisma.shareClass.findFirst.mockResolvedValue(null);

      await expect(
        service.create(companyId, { ...createDto, targetShareClassId: 'bad-uuid' }, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── FIND ALL ────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated list with summary', async () => {
      prisma.convertibleInstrument.findMany.mockResolvedValue([mockConvertible]);
      prisma.convertibleInstrument.count.mockResolvedValue(1);
      prisma.convertibleInstrument.aggregate.mockResolvedValue({
        _sum: {
          principalAmount: new Prisma.Decimal('100000.00'),
          accruedInterest: new Prisma.Decimal('4000.00'),
        },
        _count: 1,
      });

      const result = await service.findAll(companyId, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.summary.totalOutstanding).toBe(1);
      expect(result.summary.totalPrincipal).toBe('100000');
      // Summary uses DB aggregate values (updated by daily cron job)
      expect(result.summary.totalValue).toBe('104000');
      // Individual items use on-the-fly interest for OUTSTANDING
      expect(parseFloat(result.items[0].accruedInterest)).toBeGreaterThan(0);
    });

    it('should use stored interest for non-OUTSTANDING items', async () => {
      const convertedInstrument = {
        ...mockConvertible,
        status: 'CONVERTED' as const,
        accruedInterest: new Prisma.Decimal('3000.00'),
      };

      prisma.convertibleInstrument.findMany.mockResolvedValue([convertedInstrument]);
      prisma.convertibleInstrument.count.mockResolvedValue(1);
      prisma.convertibleInstrument.aggregate.mockResolvedValue({
        _sum: { principalAmount: null, accruedInterest: null },
        _count: 0,
      });

      const result = await service.findAll(companyId, { page: 1, limit: 20 });

      expect(result.items[0].accruedInterest).toBe('3000');
      expect(result.items[0].totalValue).toBe('103000');
    });

    it('should filter by status', async () => {
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.count.mockResolvedValue(0);
      prisma.convertibleInstrument.aggregate.mockResolvedValue({
        _sum: { principalAmount: null, accruedInterest: null },
        _count: 0,
      });

      await service.findAll(companyId, {
        page: 1,
        limit: 20,
        status: 'OUTSTANDING' as any,
      });

      expect(prisma.convertibleInstrument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'OUTSTANDING' }),
        }),
      );
    });

    it('should filter by shareholderId', async () => {
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.count.mockResolvedValue(0);
      prisma.convertibleInstrument.aggregate.mockResolvedValue({
        _sum: { principalAmount: null, accruedInterest: null },
        _count: 0,
      });

      await service.findAll(companyId, {
        page: 1,
        limit: 20,
        shareholderId,
      });

      expect(prisma.convertibleInstrument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ shareholderId }),
        }),
      );
    });
  });

  // ─── FIND BY ID ──────────────────────────────────────────────────

  describe('findById', () => {
    it('should return on-the-fly interest for OUTSTANDING instruments', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        status: 'OUTSTANDING',
        shareholder: { id: shareholderId, name: 'Test Investor', type: 'INDIVIDUAL' },
        targetShareClass: null,
      });

      const result = await service.findById(companyId, convertibleId);

      expect(result.principalAmount).toBe('100000');
      // On-the-fly interest for OUTSTANDING should be greater than 0
      // (issue date 2024-01-15 is in the past, so interest has accrued)
      expect(parseFloat(result.accruedInterest)).toBeGreaterThan(0);
      expect(parseFloat(result.totalConversionAmount)).toBeGreaterThan(100000);
      expect(result.daysToMaturity).toBeDefined();
    });

    it('should return stored DB interest for CONVERTED instruments', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        status: 'CONVERTED',
        accruedInterest: new Prisma.Decimal('4000.00'),
        shareholder: { id: shareholderId, name: 'Test Investor', type: 'INDIVIDUAL' },
        targetShareClass: null,
      });

      const result = await service.findById(companyId, convertibleId);

      expect(result.principalAmount).toBe('100000');
      expect(result.accruedInterest).toBe('4000');
      expect(result.totalConversionAmount).toBe('104000');
    });

    it('should return stored DB interest for CANCELLED instruments', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        status: 'CANCELLED',
        accruedInterest: new Prisma.Decimal('2500.00'),
        shareholder: { id: shareholderId, name: 'Test Investor', type: 'INDIVIDUAL' },
        targetShareClass: null,
      });

      const result = await service.findById(companyId, convertibleId);

      expect(result.accruedInterest).toBe('2500');
      expect(result.totalConversionAmount).toBe('102500');
    });

    it('should throw if not found', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(null);

      await expect(service.findById(companyId, 'bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── INTEREST BREAKDOWN ──────────────────────────────────────────

  describe('getInterestBreakdown', () => {
    it('should return interest calculation for SIMPLE interest', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(mockConvertible);

      const result = await service.getInterestBreakdown(companyId, convertibleId);

      expect(result.convertibleId).toBe(convertibleId);
      expect(result.principalAmount).toBe('100000');
      expect(result.interestType).toBe('SIMPLE');
      expect(result.daysElapsed).toBeGreaterThan(0);
      expect(result.interestBreakdown).toBeDefined();
      expect(result.interestBreakdown.length).toBeGreaterThan(0);
    });

    it('should return interest for COMPOUND interest', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        interestType: 'COMPOUND',
      });

      const result = await service.getInterestBreakdown(companyId, convertibleId);

      expect(result.interestType).toBe('COMPOUND');
      expect(parseFloat(result.accruedInterest)).toBeGreaterThan(0);
    });

    it('should throw if not found', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(null);

      await expect(service.getInterestBreakdown(companyId, 'bad-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── UPDATE ──────────────────────────────────────────────────────

  describe('update', () => {
    it('should update an OUTSTANDING convertible', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(mockConvertible);
      prisma.convertibleInstrument.update.mockResolvedValue({
        ...mockConvertible,
        discountRate: new Prisma.Decimal('0.25'),
      });

      await service.update(companyId, convertibleId, {
        discountRate: '0.25',
      });

      expect(prisma.convertibleInstrument.update).toHaveBeenCalled();
    });

    it('should allow updating MATURED convertible', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        status: 'MATURED',
      });
      prisma.convertibleInstrument.update.mockResolvedValue({
        ...mockConvertible,
        status: 'MATURED',
      });

      await service.update(companyId, convertibleId, { notes: 'Updated' });

      expect(prisma.convertibleInstrument.update).toHaveBeenCalled();
    });

    it('should throw if convertible is CONVERTED', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        status: 'CONVERTED',
      });

      await expect(
        service.update(companyId, convertibleId, { discountRate: '0.25' }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if not found', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(null);

      await expect(service.update(companyId, 'bad-uuid', { discountRate: '0.25' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reset MATURED to OUTSTANDING on maturity extension', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        status: 'MATURED',
      });
      prisma.convertibleInstrument.update.mockResolvedValue({
        ...mockConvertible,
        status: 'OUTSTANDING',
      });

      await service.update(companyId, convertibleId, {
        maturityDate: futureDate.toISOString(),
      });

      expect(prisma.convertibleInstrument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'OUTSTANDING' }),
        }),
      );
    });

    it('should throw if new maturity date before issue date', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(mockConvertible);

      await expect(
        service.update(companyId, convertibleId, {
          maturityDate: '2023-01-01',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should validate target share class on update', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(mockConvertible);
      prisma.shareClass.findFirst.mockResolvedValue(null);

      await expect(
        service.update(companyId, convertibleId, {
          targetShareClassId: 'bad-uuid',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── REDEEM ──────────────────────────────────────────────────────

  describe('redeem', () => {
    it('should redeem an OUTSTANDING convertible', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(mockConvertible);
      prisma.convertibleInstrument.update.mockResolvedValue({
        ...mockConvertible,
        status: 'REDEEMED',
        redeemedAt: new Date(),
      });

      await service.redeem(companyId, convertibleId, {
        redemptionAmount: '108000.00',
      });

      expect(prisma.convertibleInstrument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REDEEMED' }),
        }),
      );
    });

    it('should redeem a MATURED convertible', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        status: 'MATURED',
      });
      prisma.convertibleInstrument.update.mockResolvedValue({
        ...mockConvertible,
        status: 'REDEEMED',
      });

      await service.redeem(companyId, convertibleId, {
        redemptionAmount: '108000.00',
      });

      expect(prisma.convertibleInstrument.update).toHaveBeenCalled();
    });

    it('should throw on invalid status transition', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        status: 'CANCELLED',
      });

      await expect(
        service.redeem(companyId, convertibleId, {
          redemptionAmount: '108000.00',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if not found', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(null);

      await expect(
        service.redeem(companyId, 'bad-uuid', {
          redemptionAmount: '108000.00',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── CANCEL ──────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should cancel an OUTSTANDING convertible', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(mockConvertible);
      prisma.convertibleInstrument.update.mockResolvedValue({
        ...mockConvertible,
        status: 'CANCELLED',
        cancelledAt: new Date(),
      });

      await service.cancel(companyId, convertibleId, {
        cancellationReason: 'Investor withdrew',
      });

      expect(prisma.convertibleInstrument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('should throw on terminal status', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        status: 'CONVERTED',
      });

      await expect(
        service.cancel(companyId, convertibleId, {
          cancellationReason: 'Test',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if not found', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(null);

      await expect(
        service.cancel(companyId, 'bad-uuid', {
          cancellationReason: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── CONVERSION SCENARIOS ────────────────────────────────────────

  describe('getConversionScenarios', () => {
    beforeEach(() => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(mockConvertible);
      prisma.shareClass.findMany.mockResolvedValue([
        { totalIssued: new Prisma.Decimal('1000000') },
      ]);
    });

    it('should return default 5 scenarios', async () => {
      const result = await service.getConversionScenarios(companyId, convertibleId);

      expect(result.scenarios).toHaveLength(5);
      expect(result.convertibleId).toBe(convertibleId);
      // On-the-fly interest calculation: amount must be >= principal (100000)
      const convAmount = parseFloat(result.currentConversionAmount);
      expect(convAmount).toBeGreaterThanOrEqual(100000);
      expect(result.summary.valuationCap).toBe('5000000');
      expect(result.summary.discountRate).toBe('0.2');
      expect(result.summary.capTriggersAbove).toBeDefined();
    });

    it('should accept custom valuations', async () => {
      const result = await service.getConversionScenarios(
        companyId,
        convertibleId,
        '3000000,7000000',
      );

      expect(result.scenarios).toHaveLength(2);
    });

    it('should throw if valuation <= 0', async () => {
      await expect(
        service.getConversionScenarios(companyId, convertibleId, '-1000'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if no pre-money shares', async () => {
      prisma.shareClass.findMany.mockResolvedValue([{ totalIssued: new Prisma.Decimal('0') }]);

      await expect(service.getConversionScenarios(companyId, convertibleId)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw if convertible not found', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(null);

      await expect(service.getConversionScenarios(companyId, 'bad-uuid')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle no discount rate', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        discountRate: null,
      });

      const result = await service.getConversionScenarios(companyId, convertibleId, '5000000');

      expect(result.scenarios[0].discountMethod).toBeNull();
    });

    it('should handle no valuation cap', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        valuationCap: null,
      });

      const result = await service.getConversionScenarios(companyId, convertibleId, '5000000');

      expect(result.scenarios[0].capMethod).toBeNull();
    });

    it('should pick CAP as best method when cap gives more shares', async () => {
      // High valuation (10M) → cap (5M) gives much more shares than discount (20%)
      const result = await service.getConversionScenarios(companyId, convertibleId, '10000000');

      expect(result.scenarios[0].bestMethod).toBe('CAP');
    });

    it('should pick DISCOUNT as best method at lower valuations', async () => {
      // Low valuation (3M) → discount (20%) gives more than cap (5M)
      const result = await service.getConversionScenarios(companyId, convertibleId, '3000000');

      expect(result.scenarios[0].bestMethod).toBe('DISCOUNT');
    });
  });

  // ─── CONVERT ─────────────────────────────────────────────────────

  describe('convert', () => {
    const convertDto = {
      fundingRoundId: 'round-uuid-1',
      roundValuation: '10000000.00',
      shareClassId: 'sc-uuid-1',
      notes: 'Series A',
    };

    beforeEach(() => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        shareholder: { id: shareholderId, name: 'Test Investor' },
      });
      prisma.fundingRound.findFirst.mockResolvedValue({
        id: 'round-uuid-1',
        targetAmount: new Prisma.Decimal('1000000.00'),
        status: 'OPEN',
      });
      prisma.shareClass.findFirst.mockResolvedValue({
        id: 'sc-uuid-1',
        className: 'Series A Preferred',
        totalIssued: new Prisma.Decimal('100000'),
        totalAuthorized: new Prisma.Decimal('10000000'),
      });
      prisma.shareClass.findMany.mockResolvedValue([
        { totalIssued: new Prisma.Decimal('1000000') },
      ]);

      // Mock $transaction to execute the callback
      prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
      prisma.transaction.create.mockResolvedValue({
        id: 'txn-uuid-1',
      });
      prisma.shareholding.findFirst.mockResolvedValue(null);
      prisma.shareholding.create.mockResolvedValue({});
      prisma.shareClass.findFirst.mockResolvedValue({
        id: 'sc-uuid-1',
        className: 'Series A Preferred',
        totalIssued: new Prisma.Decimal('100000'),
        totalAuthorized: new Prisma.Decimal('10000000'),
      });
      prisma.convertibleInstrument.update.mockResolvedValue({
        ...mockConvertible,
        status: 'CONVERTED',
        convertedAt: new Date(),
        shareholder: { id: shareholderId, name: 'Test Investor' },
        targetShareClass: { id: 'sc-uuid-1', className: 'Series A Preferred' },
      });
    });

    it('should execute conversion atomically', async () => {
      const result = await service.convert(companyId, convertibleId, convertDto, userId);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.transaction.create).toHaveBeenCalled();
      expect(prisma.convertibleInstrument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONVERTED' }),
        }),
      );
      expect(result.transactionId).toBe('txn-uuid-1');
      expect(mockCapTableService.recalculateOwnership).toHaveBeenCalledWith(companyId);
      expect(mockCapTableService.createAutoSnapshot).toHaveBeenCalledWith(
        companyId,
        'convertible_converted',
        expect.stringContaining('converted'),
      );
    });

    it('should throw if convertible not found', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue(null);

      await expect(service.convert(companyId, 'bad-uuid', convertDto, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if already converted', async () => {
      prisma.convertibleInstrument.findFirst.mockResolvedValue({
        ...mockConvertible,
        status: 'CONVERTED',
        shareholder: { id: shareholderId, name: 'Test Investor' },
      });

      await expect(service.convert(companyId, convertibleId, convertDto, userId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw if funding round not found', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(null);

      await expect(service.convert(companyId, convertibleId, convertDto, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if qualified financing threshold not met', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({
        id: 'round-uuid-1',
        targetAmount: new Prisma.Decimal('100000.00'), // Below 500k threshold
        status: 'OPEN',
      });

      await expect(service.convert(companyId, convertibleId, convertDto, userId)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw if share class not found', async () => {
      prisma.shareClass.findFirst.mockResolvedValueOnce(null); // First call for shareClass check

      await expect(service.convert(companyId, convertibleId, convertDto, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if no pre-money shares', async () => {
      prisma.shareClass.findFirst.mockResolvedValue({
        id: 'sc-uuid-1',
        className: 'Series A',
        totalIssued: new Prisma.Decimal('100000'),
        totalAuthorized: new Prisma.Decimal('10000000'),
      });
      prisma.shareClass.findMany.mockResolvedValue([{ totalIssued: new Prisma.Decimal('0') }]);

      await expect(service.convert(companyId, convertibleId, convertDto, userId)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should update existing shareholding on conversion', async () => {
      prisma.shareholding.findFirst.mockResolvedValue({
        id: 'holding-uuid-1',
        quantity: new Prisma.Decimal('5000'),
      });

      await service.convert(companyId, convertibleId, convertDto, userId);

      expect(prisma.shareholding.update).toHaveBeenCalled();
    });

    it('should create new shareholding if none exists', async () => {
      prisma.shareholding.findFirst.mockResolvedValue(null);

      await service.convert(companyId, convertibleId, convertDto, userId);

      expect(prisma.shareholding.create).toHaveBeenCalled();
    });

    it('should throw if conversion exceeds authorized shares', async () => {
      prisma.shareClass.findFirst.mockResolvedValue({
        id: 'sc-uuid-1',
        className: 'Series A',
        totalIssued: new Prisma.Decimal('9999990'),
        totalAuthorized: new Prisma.Decimal('10000000'),
      });

      await expect(service.convert(companyId, convertibleId, convertDto, userId)).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  // ─── CALCULATE ACCRUED INTEREST ─────────────────────────────────

  describe('calculateAccruedInterest', () => {
    it('should calculate SIMPLE interest correctly', () => {
      const instrument = {
        principalAmount: new Prisma.Decimal('100000.00'),
        interestRate: new Prisma.Decimal('0.10'), // 10%
        interestType: 'SIMPLE',
        issueDate: new Date('2024-01-15'),
      };

      const result = service.calculateAccruedInterest(instrument);

      // Interest should be positive (issue date is in the past)
      expect(result.toNumber()).toBeGreaterThan(0);

      // Simple interest: I = P × r × (days / 365)
      // After ~2 years: 100000 * 0.10 * 730/365 ≈ 20000
      expect(result.toNumber()).toBeGreaterThan(10000);
    });

    it('should calculate COMPOUND interest correctly', () => {
      const instrument = {
        principalAmount: new Prisma.Decimal('100000.00'),
        interestRate: new Prisma.Decimal('0.10'), // 10%
        interestType: 'COMPOUND',
        issueDate: new Date('2024-01-15'),
      };

      const result = service.calculateAccruedInterest(instrument);

      // Compound interest should be greater than simple interest
      const simpleResult = service.calculateAccruedInterest({
        ...instrument,
        interestType: 'SIMPLE',
      });

      expect(result.toNumber()).toBeGreaterThan(simpleResult.toNumber());
    });

    it('should return zero for future issue date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const instrument = {
        principalAmount: new Prisma.Decimal('100000.00'),
        interestRate: new Prisma.Decimal('0.10'),
        interestType: 'SIMPLE',
        issueDate: futureDate,
      };

      const result = service.calculateAccruedInterest(instrument);

      // Future issue date should produce zero or near-zero interest
      expect(result.toNumber()).toBeLessThanOrEqual(0);
    });

    it('should return zero for zero interest rate', () => {
      const instrument = {
        principalAmount: new Prisma.Decimal('100000.00'),
        interestRate: new Prisma.Decimal('0'),
        interestType: 'SIMPLE',
        issueDate: new Date('2024-01-15'),
      };

      const result = service.calculateAccruedInterest(instrument);

      expect(result.toNumber()).toBe(0);
    });
  });

  // ─── UPDATE ACCRUED INTEREST FOR ALL ────────────────────────────

  describe('updateAccruedInterestForAll', () => {
    it('should update accrued interest for all OUTSTANDING instruments', async () => {
      const instruments = [
        {
          id: 'conv-1',
          principalAmount: new Prisma.Decimal('100000.00'),
          interestRate: new Prisma.Decimal('0.08'),
          interestType: 'SIMPLE',
          issueDate: new Date('2024-01-15'),
        },
        {
          id: 'conv-2',
          principalAmount: new Prisma.Decimal('200000.00'),
          interestRate: new Prisma.Decimal('0.10'),
          interestType: 'COMPOUND',
          issueDate: new Date('2025-06-01'),
        },
      ];

      prisma.convertibleInstrument.findMany.mockResolvedValue(instruments);
      prisma.convertibleInstrument.update.mockResolvedValue({ id: 'conv-1' });

      const result = await service.updateAccruedInterestForAll();

      expect(result).toBe(2);
      expect(prisma.convertibleInstrument.findMany).toHaveBeenCalledWith({
        where: { status: 'OUTSTANDING' },
        select: {
          id: true,
          principalAmount: true,
          interestRate: true,
          interestType: true,
          issueDate: true,
        },
      });
      expect(prisma.convertibleInstrument.update).toHaveBeenCalledTimes(2);

      // Verify each update was called with a positive interest value
      const firstUpdateCall = prisma.convertibleInstrument.update.mock.calls[0][0];
      expect(firstUpdateCall.where.id).toBe('conv-1');
      expect(firstUpdateCall.data.accruedInterest.toNumber()).toBeGreaterThan(0);

      const secondUpdateCall = prisma.convertibleInstrument.update.mock.calls[1][0];
      expect(secondUpdateCall.where.id).toBe('conv-2');
      expect(secondUpdateCall.data.accruedInterest.toNumber()).toBeGreaterThan(0);
    });

    it('should return 0 when no OUTSTANDING instruments exist', async () => {
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      const result = await service.updateAccruedInterestForAll();

      expect(result).toBe(0);
      expect(prisma.convertibleInstrument.update).not.toHaveBeenCalled();
    });

    it('should only query OUTSTANDING instruments', async () => {
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      await service.updateAccruedInterestForAll();

      expect(prisma.convertibleInstrument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'OUTSTANDING' },
        }),
      );
    });

    it('should handle large batches with chunking', async () => {
      // Create 75 mock instruments to test chunking (chunk size is 50)
      const instruments = Array.from({ length: 75 }, (_, i) => ({
        id: `conv-${i}`,
        principalAmount: new Prisma.Decimal('100000.00'),
        interestRate: new Prisma.Decimal('0.08'),
        interestType: 'SIMPLE',
        issueDate: new Date('2024-01-15'),
      }));

      prisma.convertibleInstrument.findMany.mockResolvedValue(instruments);
      prisma.convertibleInstrument.update.mockResolvedValue({ id: 'conv-0' });

      const result = await service.updateAccruedInterestForAll();

      expect(result).toBe(75);
      expect(prisma.convertibleInstrument.update).toHaveBeenCalledTimes(75);
    });
  });
});
