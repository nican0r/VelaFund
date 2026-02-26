import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { FundingRoundService } from './funding-round.service';
import { PrismaService } from '../prisma/prisma.service';
import { CapTableService } from '../cap-table/cap-table.service';
import {
  NotFoundException,
  BusinessRuleException,
  ConflictException,
} from '../common/filters/app-exception';
import { RoundTypeDto } from './dto/create-funding-round.dto';

// ── Mock Factory ──

function mockRound(overrides: Record<string, unknown> = {}) {
  return {
    id: 'round-1',
    companyId: 'company-1',
    name: 'Seed Round',
    roundType: 'SEED',
    shareClassId: 'sc-1',
    targetAmount: new Prisma.Decimal('5000000'),
    minimumCloseAmount: new Prisma.Decimal('2000000'),
    hardCap: null,
    preMoneyValuation: new Prisma.Decimal('20000000'),
    pricePerShare: new Prisma.Decimal('10'),
    status: 'DRAFT',
    notes: null,
    targetCloseDate: null,
    openedAt: null,
    closedAt: null,
    cancelledAt: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as any;
}

function mockCommitment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'commit-1',
    roundId: 'round-1',
    shareholderId: 'sh-1',
    amount: new Prisma.Decimal('500000'),
    sharesAllocated: new Prisma.Decimal('50000'),
    paymentStatus: 'PENDING',
    paymentConfirmedAt: null,
    hasSideLetter: false,
    notes: null,
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
    ...overrides,
  } as any;
}

function mockCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: 'company-1',
    status: 'ACTIVE',
    ...overrides,
  } as any;
}

function mockShareClass(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sc-1',
    companyId: 'company-1',
    className: 'Ordinary',
    classType: 'COMMON_SHARES',
    totalAuthorized: new Prisma.Decimal('1000000'),
    totalIssued: new Prisma.Decimal('200000'),
    ...overrides,
  } as any;
}

function mockShareholder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sh-1',
    companyId: 'company-1',
    name: 'Investor A',
    type: 'INDIVIDUAL',
    status: 'ACTIVE',
    ...overrides,
  } as any;
}

// ── Test Suite ──

describe('FundingRoundService', () => {
  let service: FundingRoundService;
  let prisma: any;
  let capTableService: any;

  beforeEach(async () => {
    capTableService = {
      recalculateOwnership: jest.fn(),
      createAutoSnapshot: jest.fn(),
    };

    prisma = {
      company: {
        findUnique: jest.fn(),
      },
      shareClass: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      fundingRound: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      roundCommitment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
      },
      roundClose: {
        create: jest.fn(),
      },
      shareholder: {
        findFirst: jest.fn(),
      },
      shareholding: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: any) => Promise<any>) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FundingRoundService,
        { provide: PrismaService, useValue: prisma },
        { provide: CapTableService, useValue: capTableService },
      ],
    }).compile();

    service = module.get<FundingRoundService>(FundingRoundService);
  });

  // ========================
  // CREATE
  // ========================

  describe('create', () => {
    const createDto = {
      name: 'Seed Round',
      roundType: RoundTypeDto.SEED,
      shareClassId: 'sc-1',
      targetAmount: '5000000',
      minimumCloseAmount: '2000000',
      preMoneyValuation: '20000000',
      pricePerShare: '10',
    };

    it('should create a funding round in DRAFT status', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany());
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass());
      prisma.fundingRound.create.mockResolvedValue(
        mockRound({ status: 'DRAFT' }),
      );

      const result = await service.create('company-1', createDto, 'user-1');
      expect(result.status).toBe('DRAFT');
      expect(prisma.fundingRound.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'company-1',
            name: 'Seed Round',
            roundType: 'SEED',
          }),
        }),
      );
    });

    it('should throw NotFoundException if company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);
      await expect(
        service.create('no-company', createDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if company is not ACTIVE', async () => {
      prisma.company.findUnique.mockResolvedValue(
        mockCompany({ status: 'DRAFT' }),
      );
      await expect(
        service.create('company-1', createDto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw NotFoundException if share class not in company', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany());
      prisma.shareClass.findFirst.mockResolvedValue(null);
      await expect(
        service.create('company-1', createDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if targetAmount is zero or negative', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany());
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass());
      await expect(
        service.create(
          'company-1',
          { ...createDto, targetAmount: '0' },
          'user-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if pricePerShare is zero', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany());
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass());
      await expect(
        service.create(
          'company-1',
          { ...createDto, pricePerShare: '0' },
          'user-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if minimumCloseAmount exceeds targetAmount', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany());
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass());
      await expect(
        service.create(
          'company-1',
          { ...createDto, minimumCloseAmount: '9999999' },
          'user-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if hardCap is less than targetAmount', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany());
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass());
      await expect(
        service.create(
          'company-1',
          { ...createDto, hardCap: '1000' },
          'user-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // FIND ALL
  // ========================

  describe('findAll', () => {
    it('should return paginated funding rounds', async () => {
      prisma.fundingRound.findMany.mockResolvedValue([mockRound()]);
      prisma.fundingRound.count.mockResolvedValue(1);

      const result = await service.findAll('company-1', { page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.fundingRound.findMany.mockResolvedValue([]);
      prisma.fundingRound.count.mockResolvedValue(0);

      await service.findAll('company-1', { page: 1, limit: 20, status: 'OPEN' as any });
      expect(prisma.fundingRound.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-1', status: 'OPEN' },
        }),
      );
    });
  });

  // ========================
  // FIND BY ID
  // ========================

  describe('findById', () => {
    it('should return round with currentAmount and postMoneyValuation', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({
        ...mockRound(),
        shareClass: { id: 'sc-1', className: 'Ordinary', type: 'COMMON_SHARES' },
      });
      prisma.roundCommitment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('3000000') },
      });
      prisma.roundCommitment.count.mockResolvedValue(3);

      const result = await service.findById('company-1', 'round-1');
      expect(result.currentAmount).toBe('3000000');
      expect(result.postMoneyValuation).toBe('25000000');
      expect(result.commitmentCount).toBe(3);
    });

    it('should throw NotFoundException if round not found', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(null);
      await expect(
        service.findById('company-1', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ========================
  // UPDATE
  // ========================

  describe('update', () => {
    it('should update a DRAFT round', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'DRAFT' }),
      );
      prisma.fundingRound.update.mockResolvedValue(
        mockRound({ name: 'Updated' }),
      );

      const result = await service.update('company-1', 'round-1', {
        name: 'Updated',
      });
      expect(result.name).toBe('Updated');
    });

    it('should update an OPEN round', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'OPEN' }),
      );
      prisma.fundingRound.update.mockResolvedValue(
        mockRound({ status: 'OPEN', name: 'Updated' }),
      );

      const result = await service.update('company-1', 'round-1', {
        name: 'Updated',
      });
      expect(result).toBeDefined();
    });

    it('should throw if round is CLOSED', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'CLOSED' }),
      );
      await expect(
        service.update('company-1', 'round-1', { name: 'X' }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if round not found', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(null);
      await expect(
        service.update('company-1', 'bad', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if targetAmount is zero', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'DRAFT' }),
      );
      await expect(
        service.update('company-1', 'round-1', { targetAmount: '0' }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // OPEN
  // ========================

  describe('open', () => {
    it('should transition DRAFT → OPEN', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'DRAFT' }),
      );
      prisma.fundingRound.update.mockResolvedValue(
        mockRound({ status: 'OPEN', openedAt: new Date() }),
      );

      const result = await service.open('company-1', 'round-1');
      expect(result.status).toBe('OPEN');
    });

    it('should throw if round is already CLOSED', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'CLOSED' }),
      );
      await expect(
        service.open('company-1', 'round-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if round not found', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(null);
      await expect(
        service.open('company-1', 'bad'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ========================
  // CANCEL
  // ========================

  describe('cancel', () => {
    it('should cancel a DRAFT round', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'DRAFT' }),
      );
      prisma.roundCommitment.updateMany.mockResolvedValue({ count: 0 });
      prisma.fundingRound.update.mockResolvedValue(
        mockRound({ status: 'CANCELLED' }),
      );

      const result = await service.cancel('company-1', 'round-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should cancel an OPEN round and cancel all commitments', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'OPEN' }),
      );
      prisma.roundCommitment.updateMany.mockResolvedValue({ count: 3 });
      prisma.fundingRound.update.mockResolvedValue(
        mockRound({ status: 'CANCELLED' }),
      );

      const result = await service.cancel('company-1', 'round-1');
      expect(result.status).toBe('CANCELLED');
      expect(prisma.roundCommitment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { paymentStatus: 'CANCELLED' },
        }),
      );
    });

    it('should throw if round is CLOSED', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'CLOSED' }),
      );
      await expect(
        service.cancel('company-1', 'round-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // CLOSE
  // ========================

  describe('close', () => {
    const confirmedCommitment = (id: string, shId: string, amount: string) =>
      mockCommitment({
        id,
        shareholderId: shId,
        amount: new Prisma.Decimal(amount),
        paymentStatus: 'CONFIRMED',
        shareholder: { id: shId, name: `Investor ${id}` },
      });

    it('should close a round with all confirmed payments', async () => {
      const commitments = [
        confirmedCommitment('c1', 'sh-1', '1000000'),
        confirmedCommitment('c2', 'sh-2', '2000000'),
      ];
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({
          status: 'OPEN',
          commitments,
          shareClass: mockShareClass(),
        }),
      );
      prisma.roundCommitment.update.mockResolvedValue({});
      prisma.transaction.create.mockResolvedValue({});
      prisma.shareholding.findFirst.mockResolvedValue(null);
      prisma.shareholding.create.mockResolvedValue({});
      prisma.shareClass.update.mockResolvedValue({});
      prisma.roundClose.create.mockResolvedValue({});
      prisma.fundingRound.update.mockResolvedValue(
        mockRound({ status: 'CLOSED', closedAt: new Date() }),
      );

      const result = await service.close('company-1', 'round-1');
      expect(result.totalRaised).toBe('3000000');
      expect(result.totalSharesIssued).toBe('300000');
      expect(result.investorCount).toBe(2);
      expect(capTableService.recalculateOwnership).toHaveBeenCalledWith('company-1');
      expect(capTableService.createAutoSnapshot).toHaveBeenCalledWith(
        'company-1',
        'funding_round_closed',
        expect.stringContaining('Seed Round'),
      );
    });

    it('should throw if round is DRAFT', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({
          status: 'DRAFT',
          commitments: [],
          shareClass: mockShareClass(),
        }),
      );
      await expect(
        service.close('company-1', 'round-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if there are unconfirmed payments', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({
          status: 'OPEN',
          commitments: [
            confirmedCommitment('c1', 'sh-1', '1000000'),
            mockCommitment({
              id: 'c2',
              shareholderId: 'sh-2',
              paymentStatus: 'PENDING',
              shareholder: { id: 'sh-2', name: 'Investor' },
            }),
          ],
          shareClass: mockShareClass(),
        }),
      );
      await expect(
        service.close('company-1', 'round-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if minimum close amount not met', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({
          status: 'OPEN',
          minimumCloseAmount: new Prisma.Decimal('5000000'),
          commitments: [confirmedCommitment('c1', 'sh-1', '1000000')],
          shareClass: mockShareClass(),
        }),
      );
      await expect(
        service.close('company-1', 'round-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if no active commitments', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({
          status: 'OPEN',
          commitments: [
            mockCommitment({ paymentStatus: 'CANCELLED' }),
          ],
          shareClass: mockShareClass(),
        }),
      );
      await expect(
        service.close('company-1', 'round-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if issuance exceeds authorized shares', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({
          status: 'OPEN',
          commitments: [confirmedCommitment('c1', 'sh-1', '9000000')],
          shareClass: mockShareClass({
            totalAuthorized: new Prisma.Decimal('1000000'),
            totalIssued: new Prisma.Decimal('200000'),
          }),
        }),
      );
      await expect(
        service.close('company-1', 'round-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should update existing shareholding on close', async () => {
      const commitments = [confirmedCommitment('c1', 'sh-1', '2000000')];
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({
          status: 'OPEN',
          commitments,
          shareClass: mockShareClass(),
        }),
      );
      prisma.roundCommitment.update.mockResolvedValue({});
      prisma.transaction.create.mockResolvedValue({});
      prisma.shareholding.findFirst.mockResolvedValue({
        id: 'holding-1',
        quantity: new Prisma.Decimal('50000'),
      });
      prisma.shareholding.update.mockResolvedValue({});
      prisma.shareClass.update.mockResolvedValue({});
      prisma.roundClose.create.mockResolvedValue({});
      prisma.fundingRound.update.mockResolvedValue(
        mockRound({ status: 'CLOSED' }),
      );

      await service.close('company-1', 'round-1');
      expect(prisma.shareholding.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'holding-1' },
          data: expect.objectContaining({
            quantity: expect.anything(),
          }),
        }),
      );
    });
  });

  // ========================
  // ADD COMMITMENT
  // ========================

  describe('addCommitment', () => {
    const commitDto = {
      shareholderId: 'sh-1',
      committedAmount: '500000',
      hasSideLetter: false,
    };

    it('should add a commitment to an OPEN round', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'OPEN' }),
      );
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder());
      prisma.roundCommitment.findFirst.mockResolvedValue(null);
      prisma.roundCommitment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('0') },
      });
      prisma.roundCommitment.create.mockResolvedValue(
        mockCommitment({ sharesAllocated: new Prisma.Decimal('50000') }),
      );

      const result = await service.addCommitment(
        'company-1',
        'round-1',
        commitDto,
      );
      expect(result.sharesAllocated?.toString()).toBe('50000');
    });

    it('should throw if round is not OPEN', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'DRAFT' }),
      );
      await expect(
        service.addCommitment('company-1', 'round-1', commitDto),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if shareholder not found', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'OPEN' }),
      );
      prisma.shareholder.findFirst.mockResolvedValue(null);
      await expect(
        service.addCommitment('company-1', 'round-1', commitDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if commitment already exists', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'OPEN' }),
      );
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder());
      prisma.roundCommitment.findFirst.mockResolvedValue(
        mockCommitment(),
      );
      await expect(
        service.addCommitment('company-1', 'round-1', commitDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw if hard cap would be exceeded', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'OPEN', hardCap: new Prisma.Decimal('1000000') }),
      );
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder());
      prisma.roundCommitment.findFirst.mockResolvedValue(null);
      prisma.roundCommitment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal('800000') },
      });
      await expect(
        service.addCommitment('company-1', 'round-1', commitDto),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if amount is zero', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(
        mockRound({ status: 'OPEN' }),
      );
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder());
      await expect(
        service.addCommitment('company-1', 'round-1', {
          ...commitDto,
          committedAmount: '0',
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if round not found', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(null);
      await expect(
        service.addCommitment('company-1', 'bad', commitDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ========================
  // FIND COMMITMENTS
  // ========================

  describe('findCommitments', () => {
    it('should return paginated commitments', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({ id: 'round-1' });
      prisma.roundCommitment.findMany.mockResolvedValue([mockCommitment()]);
      prisma.roundCommitment.count.mockResolvedValue(1);

      const result = await service.findCommitments('company-1', 'round-1', { page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should throw if round not found', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(null);
      await expect(
        service.findCommitments('company-1', 'bad', { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter by paymentStatus', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({ id: 'round-1' });
      prisma.roundCommitment.findMany.mockResolvedValue([]);
      prisma.roundCommitment.count.mockResolvedValue(0);

      await service.findCommitments('company-1', 'round-1', {
        page: 1,
        limit: 20,
        paymentStatus: 'CONFIRMED' as any,
      });
      expect(prisma.roundCommitment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roundId: 'round-1', paymentStatus: 'CONFIRMED' },
        }),
      );
    });
  });

  // ========================
  // UPDATE COMMITMENT PAYMENT
  // ========================

  describe('updateCommitmentPayment', () => {
    it('should update PENDING → RECEIVED', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({ id: 'round-1', status: 'OPEN' });
      prisma.roundCommitment.findFirst.mockResolvedValue(
        mockCommitment({ paymentStatus: 'PENDING' }),
      );
      prisma.roundCommitment.update.mockResolvedValue(
        mockCommitment({ paymentStatus: 'RECEIVED' }),
      );

      const result = await service.updateCommitmentPayment(
        'company-1',
        'round-1',
        'commit-1',
        { paymentStatus: 'RECEIVED' as any },
      );
      expect(result.paymentStatus).toBe('RECEIVED');
    });

    it('should update PENDING → CONFIRMED and set paymentConfirmedAt', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({ id: 'round-1', status: 'OPEN' });
      prisma.roundCommitment.findFirst.mockResolvedValue(
        mockCommitment({ paymentStatus: 'PENDING' }),
      );
      prisma.roundCommitment.update.mockResolvedValue(
        mockCommitment({ paymentStatus: 'CONFIRMED' }),
      );

      await service.updateCommitmentPayment(
        'company-1',
        'round-1',
        'commit-1',
        { paymentStatus: 'CONFIRMED' as any },
      );
      expect(prisma.roundCommitment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentStatus: 'CONFIRMED',
            paymentConfirmedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw if commitment is already CANCELLED', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({ id: 'round-1', status: 'OPEN' });
      prisma.roundCommitment.findFirst.mockResolvedValue(
        mockCommitment({ paymentStatus: 'CANCELLED' }),
      );
      await expect(
        service.updateCommitmentPayment('company-1', 'round-1', 'commit-1', {
          paymentStatus: 'CONFIRMED' as any,
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if commitment is already CONFIRMED', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({ id: 'round-1', status: 'OPEN' });
      prisma.roundCommitment.findFirst.mockResolvedValue(
        mockCommitment({ paymentStatus: 'CONFIRMED' }),
      );
      await expect(
        service.updateCommitmentPayment('company-1', 'round-1', 'commit-1', {
          paymentStatus: 'CONFIRMED' as any,
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if round not found', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(null);
      await expect(
        service.updateCommitmentPayment('company-1', 'bad', 'c1', {
          paymentStatus: 'CONFIRMED' as any,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if commitment not found', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({ id: 'round-1', status: 'OPEN' });
      prisma.roundCommitment.findFirst.mockResolvedValue(null);
      await expect(
        service.updateCommitmentPayment('company-1', 'round-1', 'bad', {
          paymentStatus: 'CONFIRMED' as any,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ========================
  // CANCEL COMMITMENT
  // ========================

  describe('cancelCommitment', () => {
    it('should cancel a PENDING commitment', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({ id: 'round-1', status: 'OPEN' });
      prisma.roundCommitment.findFirst.mockResolvedValue(
        mockCommitment({ paymentStatus: 'PENDING' }),
      );
      prisma.roundCommitment.update.mockResolvedValue(
        mockCommitment({ paymentStatus: 'CANCELLED' }),
      );

      const result = await service.cancelCommitment(
        'company-1',
        'round-1',
        'commit-1',
      );
      expect(result.paymentStatus).toBe('CANCELLED');
    });

    it('should throw if round is CLOSED', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({ id: 'round-1', status: 'CLOSED' });
      await expect(
        service.cancelCommitment('company-1', 'round-1', 'commit-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if commitment already CANCELLED', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({ id: 'round-1', status: 'OPEN' });
      prisma.roundCommitment.findFirst.mockResolvedValue(
        mockCommitment({ paymentStatus: 'CANCELLED' }),
      );
      await expect(
        service.cancelCommitment('company-1', 'round-1', 'commit-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // PROFORMA
  // ========================

  describe('getProforma', () => {
    it('should return before/after cap table with dilution', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue({
        ...mockRound({ status: 'OPEN' }),
        commitments: [
          {
            ...mockCommitment(),
            amount: new Prisma.Decimal('500000'),
            paymentStatus: 'PENDING',
            shareholder: { id: 'sh-1', name: 'Investor A' },
          },
        ],
      });

      prisma.shareholding.findMany.mockResolvedValue([
        {
          shareholderId: 'sh-founder',
          quantity: new Prisma.Decimal('700000'),
          shareholder: { id: 'sh-founder', name: 'Founder' },
          shareClass: { id: 'sc-1', className: 'Ordinary' },
        },
      ]);

      const result = await service.getProforma('company-1', 'round-1');

      expect(result.beforeRound.totalShares).toBe('700000');
      expect(result.afterRound.totalShares).toBe('750000');
      expect(result.beforeRound.shareholders).toHaveLength(1);
      expect(result.afterRound.shareholders).toHaveLength(2);
      expect(result.dilution).toHaveProperty('Founder');
    });

    it('should throw if round not found', async () => {
      prisma.fundingRound.findFirst.mockResolvedValue(null);
      await expect(
        service.getProforma('company-1', 'bad'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
