import { Test, TestingModule } from '@nestjs/testing';
import { FundingRoundController } from './funding-round.controller';
import { FundingRoundService } from './funding-round.service';
import {
  NotFoundException,
  BusinessRuleException,
  ConflictException,
} from '../common/filters/app-exception';
import { RoundTypeDto } from './dto/create-funding-round.dto';
import { PaymentStatusUpdateDto } from './dto/update-commitment-payment.dto';
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

const mockRound = {
  id: 'round-1',
  companyId: 'comp-1',
  name: 'Seed Round',
  roundType: 'SEED' as const,
  shareClassId: 'sc-1',
  targetAmount: '1000000',
  minimumCloseAmount: '500000',
  hardCap: '1500000',
  preMoneyValuation: '5000000',
  pricePerShare: '10.00',
  status: 'DRAFT' as const,
  targetCloseDate: null,
  notes: null,
  openedAt: null,
  closedAt: null,
  cancelledAt: null,
  createdBy: 'user-1',
  createdAt: '2026-02-24T10:00:00.000Z',
  updatedAt: '2026-02-24T10:00:00.000Z',
};

const mockCommitment = {
  id: 'commit-1',
  roundId: 'round-1',
  shareholderId: 'sh-1',
  committedAmount: '100000',
  sharesAllocated: '10000',
  paymentStatus: 'PENDING' as const,
  hasSideLetter: false,
  notes: null,
  paymentConfirmedAt: null,
  cancelledAt: null,
  createdAt: '2026-02-24T10:00:00.000Z',
  updatedAt: '2026-02-24T10:00:00.000Z',
};

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  open: jest.fn(),
  close: jest.fn(),
  cancel: jest.fn(),
  getProforma: jest.fn(),
  addCommitment: jest.fn(),
  findCommitments: jest.fn(),
  updateCommitmentPayment: jest.fn(),
  cancelCommitment: jest.fn(),
};

describe('FundingRoundController', () => {
  let controller: FundingRoundController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FundingRoundController],
      providers: [{ provide: FundingRoundService, useValue: mockService }],
    }).compile();

    controller = module.get<FundingRoundController>(FundingRoundController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // POST /funding-rounds
  // =========================================================================

  describe('create', () => {
    it('should create a funding round', async () => {
      mockService.create.mockResolvedValue(mockRound);

      const dto = {
        name: 'Seed Round',
        roundType: RoundTypeDto.SEED,
        shareClassId: 'sc-1',
        targetAmount: '1000000',
        preMoneyValuation: '5000000',
        pricePerShare: '10.00',
      };

      const result = await controller.create('comp-1', dto, mockUser);

      expect(result).toEqual(mockRound);
      expect(mockService.create).toHaveBeenCalledWith('comp-1', dto, 'user-1');
    });

    it('should propagate NotFoundException', async () => {
      mockService.create.mockRejectedValue(new NotFoundException('company', 'comp-1'));

      await expect(
        controller.create(
          'comp-1',
          {
            name: 'Seed',
            roundType: RoundTypeDto.SEED,
            shareClassId: 'sc-1',
            targetAmount: '1000000',
            preMoneyValuation: '5000000',
            pricePerShare: '10.00',
          },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BusinessRuleException', async () => {
      mockService.create.mockRejectedValue(
        new BusinessRuleException('ROUND_COMPANY_NOT_ACTIVE', 'errors.round.companyNotActive'),
      );

      await expect(
        controller.create(
          'comp-1',
          {
            name: 'Seed',
            roundType: RoundTypeDto.SEED,
            shareClassId: 'sc-1',
            targetAmount: '1000000',
            preMoneyValuation: '5000000',
            pricePerShare: '10.00',
          },
          mockUser,
        ),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // =========================================================================
  // GET /funding-rounds
  // =========================================================================

  describe('list', () => {
    it('should return paginated funding rounds', async () => {
      mockService.findAll.mockResolvedValue({
        items: [mockRound],
        total: 1,
      });

      const result = await controller.list('comp-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [mockRound],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should return empty list when no rounds', async () => {
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
  });

  // =========================================================================
  // GET /funding-rounds/:roundId
  // =========================================================================

  describe('getOne', () => {
    it('should return a single funding round with computed fields', async () => {
      const detailResponse = {
        ...mockRound,
        currentAmount: '100000',
        postMoneyValuation: '6000000',
        commitmentCount: 1,
      };
      mockService.findById.mockResolvedValue(detailResponse);

      const result = await controller.getOne('comp-1', 'round-1');

      expect(result).toEqual(detailResponse);
      expect(mockService.findById).toHaveBeenCalledWith('comp-1', 'round-1');
    });

    it('should throw NotFoundException', async () => {
      mockService.findById.mockRejectedValue(new NotFoundException('fundingRound', 'round-999'));

      await expect(controller.getOne('comp-1', 'round-999')).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // PUT /funding-rounds/:roundId
  // =========================================================================

  describe('update', () => {
    it('should update a funding round', async () => {
      const updatedRound = { ...mockRound, name: 'Updated Seed Round' };
      mockService.update.mockResolvedValue(updatedRound);

      const result = await controller.update('comp-1', 'round-1', {
        name: 'Updated Seed Round',
      });

      expect(result.name).toBe('Updated Seed Round');
      expect(mockService.update).toHaveBeenCalledWith('comp-1', 'round-1', {
        name: 'Updated Seed Round',
      });
    });

    it('should propagate BusinessRuleException for closed round', async () => {
      mockService.update.mockRejectedValue(
        new BusinessRuleException('ROUND_ALREADY_CLOSED', 'errors.round.alreadyClosed'),
      );

      await expect(controller.update('comp-1', 'round-1', { name: 'Fail' })).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  // =========================================================================
  // POST /funding-rounds/:roundId/open
  // =========================================================================

  describe('open', () => {
    it('should open a DRAFT round', async () => {
      const openedRound = {
        ...mockRound,
        status: 'OPEN' as const,
        openedAt: '2026-02-24T11:00:00.000Z',
      };
      mockService.open.mockResolvedValue(openedRound);

      const result = await controller.open('comp-1', 'round-1');

      expect(result.status).toBe('OPEN');
      expect(mockService.open).toHaveBeenCalledWith('comp-1', 'round-1');
    });

    it('should propagate BusinessRuleException for invalid transition', async () => {
      mockService.open.mockRejectedValue(
        new BusinessRuleException(
          'ROUND_INVALID_STATUS_TRANSITION',
          'errors.round.invalidStatusTransition',
        ),
      );

      await expect(controller.open('comp-1', 'round-1')).rejects.toThrow(BusinessRuleException);
    });
  });

  // =========================================================================
  // POST /funding-rounds/:roundId/close
  // =========================================================================

  describe('close', () => {
    it('should close a round and issue shares', async () => {
      const closedRound = {
        ...mockRound,
        status: 'CLOSED' as const,
        closedAt: '2026-02-24T12:00:00.000Z',
      };
      mockService.close.mockResolvedValue(closedRound);

      const result = await controller.close('comp-1', 'round-1');

      expect(result.status).toBe('CLOSED');
      expect(mockService.close).toHaveBeenCalledWith('comp-1', 'round-1');
    });

    it('should propagate BusinessRuleException for unconfirmed payments', async () => {
      mockService.close.mockRejectedValue(
        new BusinessRuleException('ROUND_UNCONFIRMED_PAYMENTS', 'errors.round.unconfirmedPayments'),
      );

      await expect(controller.close('comp-1', 'round-1')).rejects.toThrow(BusinessRuleException);
    });
  });

  // =========================================================================
  // POST /funding-rounds/:roundId/cancel
  // =========================================================================

  describe('cancel', () => {
    it('should cancel a round', async () => {
      const cancelledRound = {
        ...mockRound,
        status: 'CANCELLED' as const,
        cancelledAt: '2026-02-24T12:00:00.000Z',
      };
      mockService.cancel.mockResolvedValue(cancelledRound);

      const result = await controller.cancel('comp-1', 'round-1');

      expect(result.status).toBe('CANCELLED');
      expect(mockService.cancel).toHaveBeenCalledWith('comp-1', 'round-1');
    });

    it('should propagate BusinessRuleException for closed round', async () => {
      mockService.cancel.mockRejectedValue(
        new BusinessRuleException('ROUND_ALREADY_CLOSED', 'errors.round.alreadyClosed'),
      );

      await expect(controller.cancel('comp-1', 'round-1')).rejects.toThrow(BusinessRuleException);
    });
  });

  // =========================================================================
  // GET /funding-rounds/:roundId/proforma
  // =========================================================================

  describe('getProforma', () => {
    it('should return pro-forma cap table', async () => {
      const proforma = {
        before: [
          { shareholderId: 'sh-1', name: 'Founder', shares: '100000', percentage: '100.00' },
        ],
        after: [
          { shareholderId: 'sh-1', name: 'Founder', shares: '100000', percentage: '90.91' },
          { shareholderId: 'sh-2', name: 'Investor', shares: '10000', percentage: '9.09' },
        ],
        newShares: '10000',
        dilution: '9.09',
      };
      mockService.getProforma.mockResolvedValue(proforma);

      const result = await controller.getProforma('comp-1', 'round-1');

      expect(result).toEqual(proforma);
      expect(mockService.getProforma).toHaveBeenCalledWith('comp-1', 'round-1');
    });

    it('should throw NotFoundException', async () => {
      mockService.getProforma.mockRejectedValue(new NotFoundException('fundingRound', 'round-999'));

      await expect(controller.getProforma('comp-1', 'round-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // =========================================================================
  // POST /funding-rounds/:roundId/commitments
  // =========================================================================

  describe('addCommitment', () => {
    it('should add a commitment', async () => {
      mockService.addCommitment.mockResolvedValue(mockCommitment);

      const dto = {
        shareholderId: 'sh-1',
        committedAmount: '100000',
      };

      const result = await controller.addCommitment('comp-1', 'round-1', dto);

      expect(result).toEqual(mockCommitment);
      expect(mockService.addCommitment).toHaveBeenCalledWith('comp-1', 'round-1', dto);
    });

    it('should propagate ConflictException for duplicate', async () => {
      mockService.addCommitment.mockRejectedValue(
        new ConflictException('ROUND_COMMITMENT_EXISTS', 'errors.round.commitmentExists'),
      );

      await expect(
        controller.addCommitment('comp-1', 'round-1', {
          shareholderId: 'sh-1',
          committedAmount: '100000',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // GET /funding-rounds/:roundId/commitments
  // =========================================================================

  describe('listCommitments', () => {
    it('should return paginated commitments', async () => {
      mockService.findCommitments.mockResolvedValue({
        items: [mockCommitment],
        total: 1,
      });

      const result = await controller.listCommitments('comp-1', 'round-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [mockCommitment],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    it('should return empty list', async () => {
      mockService.findCommitments.mockResolvedValue({
        items: [],
        total: 0,
      });

      const result = await controller.listCommitments('comp-1', 'round-1', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual({
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });
    });
  });

  // =========================================================================
  // PUT /funding-rounds/:roundId/commitments/:commitmentId/payment
  // =========================================================================

  describe('updatePayment', () => {
    it('should update payment status to RECEIVED', async () => {
      const updated = { ...mockCommitment, paymentStatus: 'RECEIVED' as const };
      mockService.updateCommitmentPayment.mockResolvedValue(updated);

      const result = await controller.updatePayment('comp-1', 'round-1', 'commit-1', {
        paymentStatus: PaymentStatusUpdateDto.RECEIVED,
      });

      expect(result.paymentStatus).toBe('RECEIVED');
      expect(mockService.updateCommitmentPayment).toHaveBeenCalledWith(
        'comp-1',
        'round-1',
        'commit-1',
        { paymentStatus: PaymentStatusUpdateDto.RECEIVED },
      );
    });

    it('should propagate BusinessRuleException for invalid transition', async () => {
      mockService.updateCommitmentPayment.mockRejectedValue(
        new BusinessRuleException(
          'ROUND_INVALID_PAYMENT_TRANSITION',
          'errors.round.invalidPaymentTransition',
        ),
      );

      await expect(
        controller.updatePayment('comp-1', 'round-1', 'commit-1', {
          paymentStatus: PaymentStatusUpdateDto.CONFIRMED,
        }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // =========================================================================
  // DELETE /funding-rounds/:roundId/commitments/:commitmentId
  // =========================================================================

  describe('cancelCommitment', () => {
    it('should cancel a commitment', async () => {
      const cancelled = {
        ...mockCommitment,
        paymentStatus: 'CANCELLED' as const,
        cancelledAt: '2026-02-24T12:00:00.000Z',
      };
      mockService.cancelCommitment.mockResolvedValue(cancelled);

      const result = await controller.cancelCommitment('comp-1', 'round-1', 'commit-1');

      expect(result.paymentStatus).toBe('CANCELLED');
      expect(mockService.cancelCommitment).toHaveBeenCalledWith('comp-1', 'round-1', 'commit-1');
    });

    it('should propagate BusinessRuleException for closed round', async () => {
      mockService.cancelCommitment.mockRejectedValue(
        new BusinessRuleException('ROUND_ALREADY_CLOSED', 'errors.round.alreadyClosed'),
      );

      await expect(controller.cancelCommitment('comp-1', 'round-1', 'commit-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });
});
