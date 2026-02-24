import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import {
  NotFoundException,
  BusinessRuleException,
} from '../common/filters/app-exception';
import { TransactionTypeDto } from './dto/create-transaction.dto';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const mockUser: AuthenticatedUser = {
  id: 'user-1',
  privyUserId: 'privy-1',
  email: 'admin@test.com',
  walletAddress: null,
  firstName: 'Admin',
  lastName: 'User',
  kycStatus: 'NOT_STARTED',
  locale: 'pt-BR',
};

const mockTransactionResponse = {
  id: 'txn-1',
  companyId: 'comp-1',
  type: 'ISSUANCE' as const,
  status: 'DRAFT' as const,
  fromShareholder: null,
  toShareholder: { id: 'sh-1', name: 'João Silva', type: 'FOUNDER' as const },
  shareClass: { id: 'sc-1', className: 'Quotas', type: 'QUOTA' as const },
  quantity: '10000',
  pricePerShare: '1.50',
  totalValue: '15000',
  notes: null,
  requiresBoardApproval: false,
  approvedBy: null,
  approvedAt: null,
  cancelledBy: null,
  cancelledAt: null,
  confirmedAt: null,
  createdBy: 'user-1',
  createdAt: '2026-02-01T10:00:00.000Z',
  updatedAt: '2026-02-01T10:00:00.000Z',
};

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  submit: jest.fn(),
  approve: jest.fn(),
  confirm: jest.fn(),
  cancel: jest.fn(),
};

describe('TransactionController', () => {
  let controller: TransactionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [{ provide: TransactionService, useValue: mockService }],
    }).compile();

    controller = module.get<TransactionController>(TransactionController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // POST /transactions
  // =========================================================================

  describe('create', () => {
    it('should create a transaction', async () => {
      mockService.create.mockResolvedValue(mockTransactionResponse);

      const dto = {
        type: TransactionTypeDto.ISSUANCE,
        toShareholderId: 'sh-1',
        shareClassId: 'sc-1',
        quantity: '10000',
        pricePerShare: '1.50',
      };

      const result = await controller.create('comp-1', dto, mockUser);

      expect(result).toEqual(mockTransactionResponse);
      expect(mockService.create).toHaveBeenCalledWith(
        'comp-1',
        dto,
        'user-1',
      );
    });

    it('should propagate NotFoundException', async () => {
      mockService.create.mockRejectedValue(
        new NotFoundException('company', 'comp-1'),
      );

      await expect(
        controller.create(
          'comp-1',
          {
            type: TransactionTypeDto.ISSUANCE,
            toShareholderId: 'sh-1',
            shareClassId: 'sc-1',
            quantity: '10000',
          },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BusinessRuleException', async () => {
      mockService.create.mockRejectedValue(
        new BusinessRuleException(
          'TXN_COMPANY_NOT_ACTIVE',
          'errors.txn.companyNotActive',
        ),
      );

      await expect(
        controller.create(
          'comp-1',
          {
            type: TransactionTypeDto.ISSUANCE,
            toShareholderId: 'sh-1',
            shareClassId: 'sc-1',
            quantity: '10000',
          },
          mockUser,
        ),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // =========================================================================
  // GET /transactions
  // =========================================================================

  describe('list', () => {
    it('should return paginated transactions', async () => {
      mockService.findAll.mockResolvedValue({
        items: [mockTransactionResponse],
        total: 1,
      });

      const result = await controller.list('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [mockTransactionResponse],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should return empty list when no transactions', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0 });

      const result = await controller.list('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });
    });

    it('should propagate NotFoundException for invalid company', async () => {
      mockService.findAll.mockRejectedValue(
        new NotFoundException('company', 'comp-999'),
      );

      await expect(
        controller.list('comp-999', { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // GET /transactions/:transactionId
  // =========================================================================

  describe('getOne', () => {
    it('should return a single transaction', async () => {
      const detailResponse = {
        ...mockTransactionResponse,
        blockchainTransactions: [],
      };
      mockService.findById.mockResolvedValue(detailResponse);

      const result = await controller.getOne('comp-1', 'txn-1');

      expect(result).toEqual(detailResponse);
      expect(mockService.findById).toHaveBeenCalledWith('comp-1', 'txn-1');
    });

    it('should throw NotFoundException', async () => {
      mockService.findById.mockRejectedValue(
        new NotFoundException('transaction', 'txn-999'),
      );

      await expect(
        controller.getOne('comp-1', 'txn-999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // POST /transactions/:transactionId/submit
  // =========================================================================

  describe('submit', () => {
    it('should submit a DRAFT transaction', async () => {
      mockService.submit.mockResolvedValue({
        ...mockTransactionResponse,
        status: 'SUBMITTED',
      });

      const result = await controller.submit('comp-1', 'txn-1');

      expect(result.status).toBe('SUBMITTED');
      expect(mockService.submit).toHaveBeenCalledWith('comp-1', 'txn-1');
    });

    it('should propagate BusinessRuleException for invalid status', async () => {
      mockService.submit.mockRejectedValue(
        new BusinessRuleException(
          'TXN_INVALID_STATUS_TRANSITION',
          'errors.txn.invalidStatusTransition',
        ),
      );

      await expect(
        controller.submit('comp-1', 'txn-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // =========================================================================
  // POST /transactions/:transactionId/approve
  // =========================================================================

  describe('approve', () => {
    it('should approve a transaction', async () => {
      mockService.approve.mockResolvedValue({
        ...mockTransactionResponse,
        status: 'SUBMITTED',
        approvedBy: 'user-1',
      });

      const result = await controller.approve('comp-1', 'txn-1', mockUser);

      expect(result.status).toBe('SUBMITTED');
      expect(mockService.approve).toHaveBeenCalledWith(
        'comp-1',
        'txn-1',
        'user-1',
      );
    });
  });

  // =========================================================================
  // POST /transactions/:transactionId/confirm
  // =========================================================================

  describe('confirm', () => {
    it('should confirm a transaction', async () => {
      mockService.confirm.mockResolvedValue({
        ...mockTransactionResponse,
        status: 'CONFIRMED',
        confirmedAt: '2026-02-01T12:00:00.000Z',
        blockchainTransactions: [],
      });

      const result = await controller.confirm('comp-1', 'txn-1');

      expect(result.status).toBe('CONFIRMED');
      expect(mockService.confirm).toHaveBeenCalledWith('comp-1', 'txn-1');
    });
  });

  // =========================================================================
  // POST /transactions/:transactionId/cancel
  // =========================================================================

  describe('cancel', () => {
    it('should cancel a transaction', async () => {
      mockService.cancel.mockResolvedValue({
        ...mockTransactionResponse,
        status: 'CANCELLED',
        cancelledBy: 'user-1',
      });

      const result = await controller.cancel('comp-1', 'txn-1', mockUser);

      expect(result.status).toBe('CANCELLED');
      expect(mockService.cancel).toHaveBeenCalledWith(
        'comp-1',
        'txn-1',
        'user-1',
      );
    });

    it('should throw when cancelling confirmed transaction', async () => {
      mockService.cancel.mockRejectedValue(
        new BusinessRuleException(
          'TXN_CANNOT_CANCEL_CONFIRMED',
          'errors.txn.cannotCancelConfirmed',
        ),
      );

      await expect(
        controller.cancel('comp-1', 'txn-1', mockUser),
      ).rejects.toThrow(BusinessRuleException);
    });
  });
});
