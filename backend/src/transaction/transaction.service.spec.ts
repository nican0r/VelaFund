import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { CapTableService } from '../cap-table/cap-table.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BusinessRuleException,
} from '../common/filters/app-exception';
import {
  CreateTransactionDto,
  TransactionTypeDto,
} from './dto/create-transaction.dto';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockCompany = {
  id: 'comp-1',
  name: 'Test Company Ltda',
  status: 'ACTIVE' as const,
};

const mockShareClass = {
  id: 'sc-1',
  companyId: 'comp-1',
  className: 'Quotas Ordinárias',
  type: 'QUOTA' as const,
  totalAuthorized: new Prisma.Decimal('100000'),
  totalIssued: new Prisma.Decimal('50000'),
  votesPerShare: new Prisma.Decimal('1'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockShareholder1 = {
  id: 'sh-1',
  companyId: 'comp-1',
  name: 'João Silva',
  type: 'FOUNDER' as const,
  status: 'ACTIVE' as const,
};

const mockShareholder2 = {
  id: 'sh-2',
  companyId: 'comp-1',
  name: 'Maria Santos',
  type: 'INVESTOR' as const,
  status: 'ACTIVE' as const,
};

const mockShareholding = {
  id: 'shd-1',
  companyId: 'comp-1',
  shareholderId: 'sh-1',
  shareClassId: 'sc-1',
  quantity: new Prisma.Decimal('30000'),
  ownershipPct: new Prisma.Decimal('60'),
  votingPowerPct: new Prisma.Decimal('60'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const createdAt = new Date('2026-02-01T10:00:00Z');
const updatedAt = new Date('2026-02-01T10:00:00Z');

function mockTransaction(overrides: Record<string, any> = {}) {
  return {
    id: 'txn-1',
    companyId: 'comp-1',
    type: 'ISSUANCE' as const,
    status: 'DRAFT' as const,
    fromShareholderId: null,
    toShareholderId: 'sh-1',
    shareClassId: 'sc-1',
    quantity: new Prisma.Decimal('10000'),
    pricePerShare: new Prisma.Decimal('1.50'),
    totalValue: new Prisma.Decimal('15000'),
    notes: null,
    requiresBoardApproval: false,
    approvedBy: null,
    approvedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    confirmedAt: null,
    createdBy: 'user-1',
    createdAt,
    updatedAt,
    fromShareholder: null,
    toShareholder: { id: 'sh-1', name: 'João Silva', type: 'FOUNDER' },
    shareClass: { id: 'sc-1', className: 'Quotas Ordinárias', type: 'QUOTA' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransactionService', () => {
  let service: TransactionService;
  let prisma: any;
  let capTableService: any;

  beforeEach(async () => {
    prisma = {
      company: { findUnique: jest.fn() },
      shareClass: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      shareholder: { findFirst: jest.fn() },
      shareholding: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      transaction: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), count: jest.fn() },
      blockchainTransaction: {},
      $transaction: jest.fn(),
    };

    capTableService = {
      recalculateOwnership: jest.fn(),
      createAutoSnapshot: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: PrismaService, useValue: prisma },
        { provide: CapTableService, useValue: capTableService },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // create()
  // =========================================================================

  describe('create', () => {
    const issuanceDto: CreateTransactionDto = {
      type: TransactionTypeDto.ISSUANCE,
      toShareholderId: 'sh-1',
      shareClassId: 'sc-1',
      quantity: '10000',
      pricePerShare: '1.50',
      notes: 'Series A issuance',
    };

    it('should create an ISSUANCE transaction', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder1);
      prisma.transaction.create.mockResolvedValue(mockTransaction());

      const result = await service.create('comp-1', issuanceDto, 'user-1');

      expect(result.id).toBe('txn-1');
      expect(result.type).toBe('ISSUANCE');
      expect(result.status).toBe('DRAFT');
      expect(result.quantity).toBe('10000');
      expect(result.pricePerShare).toBe('1.5');
      expect(result.totalValue).toBe('15000');
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'comp-1',
            type: 'ISSUANCE',
            status: 'DRAFT',
            toShareholderId: 'sh-1',
          }),
        }),
      );
    });

    it('should create with PENDING_APPROVAL when board approval required', async () => {
      const dto: CreateTransactionDto = {
        ...issuanceDto,
        requiresBoardApproval: true,
      };
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder1);
      prisma.transaction.create.mockResolvedValue(
        mockTransaction({ status: 'PENDING_APPROVAL' }),
      );

      const result = await service.create('comp-1', dto, 'user-1');

      expect(result.status).toBe('PENDING_APPROVAL');
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PENDING_APPROVAL' }),
        }),
      );
    });

    it('should throw NotFoundException if company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.create('comp-999', issuanceDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if company not active', async () => {
      prisma.company.findUnique.mockResolvedValue({
        ...mockCompany,
        status: 'DRAFT',
      });

      await expect(
        service.create('comp-1', issuanceDto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw NotFoundException if share class not found', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(null);

      await expect(
        service.create('comp-1', issuanceDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if quantity is zero', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);

      const dto = { ...issuanceDto, quantity: '0' };

      await expect(
        service.create('comp-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    // ISSUANCE-specific validation
    it('should throw if ISSUANCE without toShareholderId', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);

      const dto: CreateTransactionDto = {
        type: TransactionTypeDto.ISSUANCE,
        shareClassId: 'sc-1',
        quantity: '10000',
      };

      await expect(
        service.create('comp-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if ISSUANCE exceeds authorized shares', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue({
        ...mockShareClass,
        totalIssued: new Prisma.Decimal('95000'),
      });
      prisma.shareholder.findFirst.mockResolvedValue(mockShareholder1);

      await expect(
        service.create('comp-1', issuanceDto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if ISSUANCE destination shareholder not found', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await expect(
        service.create('comp-1', issuanceDto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    // TRANSFER validation
    it('should create a TRANSFER transaction', async () => {
      const dto: CreateTransactionDto = {
        type: TransactionTypeDto.TRANSFER,
        fromShareholderId: 'sh-1',
        toShareholderId: 'sh-2',
        shareClassId: 'sc-1',
        quantity: '5000',
      };

      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareholder.findFirst
        .mockResolvedValueOnce(mockShareholder1) // from
        .mockResolvedValueOnce(mockShareholder2); // to
      prisma.shareholding.findFirst.mockResolvedValue(mockShareholding);
      prisma.transaction.create.mockResolvedValue(
        mockTransaction({
          type: 'TRANSFER',
          fromShareholderId: 'sh-1',
          toShareholderId: 'sh-2',
          fromShareholder: { id: 'sh-1', name: 'João Silva', type: 'FOUNDER' },
          toShareholder: { id: 'sh-2', name: 'Maria Santos', type: 'INVESTOR' },
        }),
      );

      const result = await service.create('comp-1', dto, 'user-1');

      expect(result.type).toBe('TRANSFER');
      expect(result.fromShareholder).not.toBeNull();
      expect(result.toShareholder).not.toBeNull();
    });

    it('should throw if TRANSFER without fromShareholderId', async () => {
      const dto: CreateTransactionDto = {
        type: TransactionTypeDto.TRANSFER,
        toShareholderId: 'sh-2',
        shareClassId: 'sc-1',
        quantity: '5000',
      };

      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);

      await expect(
        service.create('comp-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if TRANSFER without toShareholderId', async () => {
      const dto: CreateTransactionDto = {
        type: TransactionTypeDto.TRANSFER,
        fromShareholderId: 'sh-1',
        shareClassId: 'sc-1',
        quantity: '5000',
      };

      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);

      await expect(
        service.create('comp-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if TRANSFER from and to same shareholder', async () => {
      const dto: CreateTransactionDto = {
        type: TransactionTypeDto.TRANSFER,
        fromShareholderId: 'sh-1',
        toShareholderId: 'sh-1',
        shareClassId: 'sc-1',
        quantity: '5000',
      };

      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);

      await expect(
        service.create('comp-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if TRANSFER with insufficient shares', async () => {
      const dto: CreateTransactionDto = {
        type: TransactionTypeDto.TRANSFER,
        fromShareholderId: 'sh-1',
        toShareholderId: 'sh-2',
        shareClassId: 'sc-1',
        quantity: '50000',
      };

      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);
      prisma.shareholder.findFirst
        .mockResolvedValueOnce(mockShareholder1)
        .mockResolvedValueOnce(mockShareholder2);
      prisma.shareholding.findFirst.mockResolvedValue(mockShareholding);

      await expect(
        service.create('comp-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    // CANCELLATION validation
    it('should throw if CANCELLATION without fromShareholderId', async () => {
      const dto: CreateTransactionDto = {
        type: TransactionTypeDto.CANCELLATION,
        shareClassId: 'sc-1',
        quantity: '5000',
      };

      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);

      await expect(
        service.create('comp-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    // CONVERSION validation
    it('should throw if CONVERSION without toShareClassId', async () => {
      const dto: CreateTransactionDto = {
        type: TransactionTypeDto.CONVERSION,
        fromShareholderId: 'sh-1',
        shareClassId: 'sc-1',
        quantity: '5000',
      };

      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);

      await expect(
        service.create('comp-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    // SPLIT validation
    it('should throw if SPLIT without splitRatio', async () => {
      const dto: CreateTransactionDto = {
        type: TransactionTypeDto.SPLIT,
        shareClassId: 'sc-1',
        quantity: '1',
      };

      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass);

      await expect(
        service.create('comp-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // =========================================================================
  // findAll()
  // =========================================================================

  describe('findAll', () => {
    it('should return paginated transactions', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.transaction.findMany.mockResolvedValue([mockTransaction()]);
      prisma.transaction.count.mockResolvedValue(1);

      const result = await service.findAll('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe('txn-1');
    });

    it('should throw NotFoundException if company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.findAll('comp-999', { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should apply type filter', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 20,
        type: 'ISSUANCE' as any,
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp-1',
            type: 'ISSUANCE',
          }),
        }),
      );
    });

    it('should apply shareholderId filter with OR condition', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 20,
        shareholderId: 'sh-1',
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { fromShareholderId: 'sh-1' },
              { toShareholderId: 'sh-1' },
            ],
          }),
        }),
      );
    });

    it('should apply date range filter', async () => {
      prisma.company.findUnique.mockResolvedValue(mockCompany);
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.findAll('comp-1', {
        page: 1,
        limit: 20,
        createdAfter: '2026-01-01',
        createdBefore: '2026-12-31',
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-12-31'),
            },
          }),
        }),
      );
    });
  });

  // =========================================================================
  // findById()
  // =========================================================================

  describe('findById', () => {
    it('should return a transaction with blockchain transactions', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        ...mockTransaction(),
        blockchainTransactions: [
          {
            id: 'bt-1',
            txHash: '0xabc',
            status: 'CONFIRMED',
            confirmedAt: new Date('2026-02-01T12:00:00Z'),
          },
        ],
      });

      const result = await service.findById('comp-1', 'txn-1');

      expect(result.id).toBe('txn-1');
      expect(result.blockchainTransactions).toHaveLength(1);
      expect(result.blockchainTransactions[0].txHash).toBe('0xabc');
    });

    it('should throw NotFoundException if transaction not found', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('comp-1', 'txn-999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // approve()
  // =========================================================================

  describe('approve', () => {
    it('should approve a PENDING_APPROVAL transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'PENDING_APPROVAL' }),
      );
      prisma.transaction.update.mockResolvedValue(
        mockTransaction({
          status: 'SUBMITTED',
          approvedBy: 'admin-1',
          approvedAt: new Date(),
        }),
      );

      const result = await service.approve('comp-1', 'txn-1', 'admin-1');

      expect(result.status).toBe('SUBMITTED');
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SUBMITTED',
            approvedBy: 'admin-1',
          }),
        }),
      );
    });

    it('should approve a DRAFT transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'DRAFT' }),
      );
      prisma.transaction.update.mockResolvedValue(
        mockTransaction({ status: 'SUBMITTED' }),
      );

      const result = await service.approve('comp-1', 'txn-1', 'admin-1');

      expect(result.status).toBe('SUBMITTED');
    });

    it('should throw if transaction not found', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.approve('comp-1', 'txn-999', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if transaction is already CONFIRMED', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'CONFIRMED' }),
      );

      await expect(
        service.approve('comp-1', 'txn-1', 'admin-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if transaction is CANCELLED', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'CANCELLED' }),
      );

      await expect(
        service.approve('comp-1', 'txn-1', 'admin-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // =========================================================================
  // confirm()
  // =========================================================================

  describe('confirm', () => {
    it('should confirm a SUBMITTED ISSUANCE and execute cap table mutation', async () => {
      const txn = mockTransaction({
        status: 'SUBMITTED',
        shareClass: {
          id: 'sc-1',
          totalIssued: new Prisma.Decimal('50000'),
          totalAuthorized: new Prisma.Decimal('100000'),
        },
      });
      prisma.transaction.findFirst
        .mockResolvedValueOnce(txn) // first call: confirm lookup
        .mockResolvedValueOnce({ // second call: findById after confirm
          ...txn,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          blockchainTransactions: [],
          fromShareholder: null,
          toShareholder: { id: 'sh-1', name: 'João Silva', type: 'FOUNDER' },
          shareClass: { id: 'sc-1', className: 'Quotas Ordinárias', type: 'QUOTA' },
        });

      // Mock $transaction to execute the callback
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.shareholding.findFirst.mockResolvedValue(null); // no existing holding
      prisma.shareholding.create.mockResolvedValue({});
      prisma.shareClass.update.mockResolvedValue({});
      prisma.transaction.update.mockResolvedValue({});
      capTableService.recalculateOwnership.mockResolvedValue(undefined);

      const result = await service.confirm('comp-1', 'txn-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(capTableService.recalculateOwnership).toHaveBeenCalledWith('comp-1');
      expect(capTableService.createAutoSnapshot).toHaveBeenCalledWith(
        'comp-1',
        'transaction_confirmed',
        expect.stringContaining('ISSUANCE'),
      );
      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw if transaction not found', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.confirm('comp-1', 'txn-999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if transaction is not SUBMITTED', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'DRAFT' }),
      );

      await expect(
        service.confirm('comp-1', 'txn-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // =========================================================================
  // cancel()
  // =========================================================================

  describe('cancel', () => {
    it('should cancel a DRAFT transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'DRAFT' }),
      );
      prisma.transaction.update.mockResolvedValue(
        mockTransaction({
          status: 'CANCELLED',
          cancelledBy: 'user-1',
          cancelledAt: new Date(),
        }),
      );

      const result = await service.cancel('comp-1', 'txn-1', 'user-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should cancel a PENDING_APPROVAL transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'PENDING_APPROVAL' }),
      );
      prisma.transaction.update.mockResolvedValue(
        mockTransaction({ status: 'CANCELLED' }),
      );

      const result = await service.cancel('comp-1', 'txn-1', 'user-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should cancel a SUBMITTED transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'SUBMITTED' }),
      );
      prisma.transaction.update.mockResolvedValue(
        mockTransaction({ status: 'CANCELLED' }),
      );

      const result = await service.cancel('comp-1', 'txn-1', 'user-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should cancel a FAILED transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'FAILED' }),
      );
      prisma.transaction.update.mockResolvedValue(
        mockTransaction({ status: 'CANCELLED' }),
      );

      const result = await service.cancel('comp-1', 'txn-1', 'user-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw if cancelling a CONFIRMED transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'CONFIRMED' }),
      );

      await expect(
        service.cancel('comp-1', 'txn-1', 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if already CANCELLED', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'CANCELLED' }),
      );

      await expect(
        service.cancel('comp-1', 'txn-1', 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if transaction not found', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.cancel('comp-1', 'txn-999', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // submit()
  // =========================================================================

  describe('submit', () => {
    it('should submit a DRAFT transaction to SUBMITTED', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'DRAFT', requiresBoardApproval: false }),
      );
      prisma.transaction.update.mockResolvedValue(
        mockTransaction({ status: 'SUBMITTED' }),
      );

      const result = await service.submit('comp-1', 'txn-1');

      expect(result.status).toBe('SUBMITTED');
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'SUBMITTED' },
        }),
      );
    });

    it('should submit a DRAFT with board approval to PENDING_APPROVAL', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'DRAFT', requiresBoardApproval: true }),
      );
      prisma.transaction.update.mockResolvedValue(
        mockTransaction({ status: 'PENDING_APPROVAL' }),
      );

      const result = await service.submit('comp-1', 'txn-1');

      expect(result.status).toBe('PENDING_APPROVAL');
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'PENDING_APPROVAL' },
        }),
      );
    });

    it('should throw if not in DRAFT status', async () => {
      prisma.transaction.findFirst.mockResolvedValue(
        mockTransaction({ status: 'SUBMITTED' }),
      );

      await expect(
        service.submit('comp-1', 'txn-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw if transaction not found', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(
        service.submit('comp-1', 'txn-999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
