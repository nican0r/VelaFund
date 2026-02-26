import { Test, TestingModule } from '@nestjs/testing';
import { ConvertibleController } from './convertible.controller';
import { ConvertibleService } from './convertible.service';
import {
  NotFoundException,
  BusinessRuleException,
  ConflictException,
} from '../common/filters/app-exception';

const mockUser = {
  id: 'user-1',
  privyUserId: 'privy-1',
  email: 'admin@test.com',
  walletAddress: null,
  firstName: 'Admin',
  lastName: 'User',
  kycStatus: 'NOT_STARTED',
  locale: 'pt-BR',
};

const mockConvertible = {
  id: 'conv-1',
  companyId: 'comp-1',
  shareholderId: 'sh-1',
  instrumentType: 'MUTUO_CONVERSIVEL' as const,
  status: 'OUTSTANDING' as const,
  principalAmount: '100000.00',
  interestRate: '0.08',
  interestType: 'SIMPLE' as const,
  accruedInterest: '4000.00',
  valuationCap: '5000000.00',
  discountRate: '0.20',
  qualifiedFinancingThreshold: '500000.00',
  conversionTrigger: 'QUALIFIED_FINANCING' as const,
  targetShareClassId: null,
  autoConvert: false,
  mfnClause: true,
  issueDate: '2024-01-15',
  maturityDate: '2026-01-15',
  convertedAt: null,
  redeemedAt: null,
  cancelledAt: null,
  conversionData: null,
  notes: null,
  createdBy: 'user-1',
  createdAt: '2024-01-15T00:00:00.000Z',
  updatedAt: '2024-01-15T00:00:00.000Z',
};

const mockService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  getInterestBreakdown: jest.fn(),
  getConversionScenarios: jest.fn(),
  update: jest.fn(),
  redeem: jest.fn(),
  cancel: jest.fn(),
  convert: jest.fn(),
};

describe('ConvertibleController', () => {
  let controller: ConvertibleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConvertibleController],
      providers: [{ provide: ConvertibleService, useValue: mockService }],
    }).compile();

    controller = module.get<ConvertibleController>(ConvertibleController);
    jest.clearAllMocks();
  });

  // ========================
  // Create
  // ========================

  describe('create', () => {
    it('should create and return a convertible instrument', async () => {
      mockService.create.mockResolvedValue(mockConvertible);

      const result = await controller.create(
        'comp-1',
        {
          shareholderId: 'sh-1',
          instrumentType: 'MUTUO_CONVERSIVEL' as any,
          principalAmount: '100000.00',
          interestRate: '0.08',
          interestType: 'SIMPLE' as any,
          issueDate: '2024-01-15',
          maturityDate: '2026-01-15',
        },
        mockUser,
      );

      expect(result).toEqual(mockConvertible);
      expect(mockService.create).toHaveBeenCalledWith(
        'comp-1',
        expect.objectContaining({ shareholderId: 'sh-1' }),
        'user-1',
      );
    });

    it('should propagate NotFoundException for missing company', async () => {
      mockService.create.mockRejectedValue(new NotFoundException('company', 'comp-1'));

      await expect(
        controller.create(
          'comp-1',
          {
            shareholderId: 'sh-1',
            instrumentType: 'MUTUO_CONVERSIVEL' as any,
            principalAmount: '100000.00',
            interestRate: '0.08',
            interestType: 'SIMPLE' as any,
            issueDate: '2024-01-15',
            maturityDate: '2026-01-15',
          },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BusinessRuleException for inactive company', async () => {
      mockService.create.mockRejectedValue(
        new BusinessRuleException('CONV_COMPANY_NOT_ACTIVE', 'errors.conv.companyNotActive'),
      );

      await expect(
        controller.create(
          'comp-1',
          {
            shareholderId: 'sh-1',
            instrumentType: 'MUTUO_CONVERSIVEL' as any,
            principalAmount: '100000.00',
            interestRate: '0.08',
            interestType: 'SIMPLE' as any,
            issueDate: '2024-01-15',
            maturityDate: '2026-01-15',
          },
          mockUser,
        ),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // List
  // ========================

  describe('list', () => {
    it('should return paginated list with summary in meta', async () => {
      const summary = {
        totalOutstanding: 2,
        totalPrincipal: '200000.00',
        totalAccruedInterest: '8000.00',
        totalValue: '208000.00',
      };
      mockService.findAll.mockResolvedValue({
        items: [mockConvertible],
        total: 1,
        summary,
      });

      const result = await controller.list('comp-1', { page: 1, limit: 20 });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: [mockConvertible],
          meta: expect.objectContaining({
            total: 1,
            page: 1,
            summary,
          }),
        }),
      );
    });

    it('should pass filters to service', async () => {
      mockService.findAll.mockResolvedValue({
        items: [],
        total: 0,
        summary: {
          totalOutstanding: 0,
          totalPrincipal: '0',
          totalAccruedInterest: '0',
          totalValue: '0',
        },
      });

      await controller.list('comp-1', {
        page: 1,
        limit: 10,
        status: 'OUTSTANDING' as any,
        shareholderId: 'sh-1',
        sort: '-principalAmount',
      });

      expect(mockService.findAll).toHaveBeenCalledWith(
        'comp-1',
        expect.objectContaining({
          status: 'OUTSTANDING',
          shareholderId: 'sh-1',
          sort: '-principalAmount',
        }),
      );
    });
  });

  // ========================
  // Get by ID
  // ========================

  describe('findById', () => {
    it('should return convertible detail', async () => {
      mockService.findById.mockResolvedValue({
        ...mockConvertible,
        totalConversionAmount: '104000.00',
        daysToMaturity: 365,
      });

      const result = await controller.findById('comp-1', 'conv-1');

      expect(result.id).toBe('conv-1');
      expect(result.totalConversionAmount).toBe('104000.00');
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(new NotFoundException('convertible', 'conv-1'));

      await expect(controller.findById('comp-1', 'conv-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ========================
  // Interest Breakdown
  // ========================

  describe('getInterest', () => {
    it('should return interest breakdown', async () => {
      const breakdown = {
        convertibleId: 'conv-1',
        principalAmount: '100000.00',
        interestRate: '0.08',
        interestType: 'SIMPLE',
        issueDate: '2024-01-15T00:00:00.000Z',
        calculationDate: '2026-01-15T00:00:00.000Z',
        daysElapsed: 730,
        accruedInterest: '16000.00',
        totalValue: '116000.00',
        interestBreakdown: [{ month: '2024-01', interest: '657.53', cumulative: '657.53' }],
      };
      mockService.getInterestBreakdown.mockResolvedValue(breakdown);

      const result = await controller.getInterest('comp-1', 'conv-1');

      expect(result.principalAmount).toBe('100000.00');
      expect(result.interestBreakdown).toHaveLength(1);
    });

    it('should propagate NotFoundException', async () => {
      mockService.getInterestBreakdown.mockRejectedValue(
        new NotFoundException('convertible', 'conv-1'),
      );

      await expect(controller.getInterest('comp-1', 'conv-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ========================
  // Conversion Scenarios
  // ========================

  describe('getScenarios', () => {
    it('should return conversion scenarios', async () => {
      const scenarios = {
        convertibleId: 'conv-1',
        currentConversionAmount: '104000.00',
        summary: {
          valuationCap: '5000000.00',
          discountRate: '0.20',
          capTriggersAbove: '6250000.00',
        },
        scenarios: [
          {
            hypotheticalValuation: '3000000.00',
            preMoneyShares: 1000000,
            roundPricePerShare: '3.00',
            discountMethod: {
              conversionPrice: '2.40',
              sharesIssued: '43333',
              ownershipPercentage: '4.15',
            },
            capMethod: {
              conversionPrice: '5.00',
              sharesIssued: '20800',
              ownershipPercentage: '2.04',
            },
            bestMethod: 'DISCOUNT',
            finalConversionPrice: '2.40',
            finalSharesIssued: '43333',
            finalOwnershipPercentage: '4.15',
            dilutionToExisting: '4.15',
          },
        ],
      };
      mockService.getConversionScenarios.mockResolvedValue(scenarios);

      const result = await controller.getScenarios('comp-1', 'conv-1', '3000000,5000000,10000000');

      expect(result.scenarios).toHaveLength(1);
      expect(result.summary.capTriggersAbove).toBe('6250000.00');
    });

    it('should call service without valuations when not provided', async () => {
      mockService.getConversionScenarios.mockResolvedValue({
        convertibleId: 'conv-1',
        scenarios: [],
      });

      await controller.getScenarios('comp-1', 'conv-1', undefined);

      expect(mockService.getConversionScenarios).toHaveBeenCalledWith(
        'comp-1',
        'conv-1',
        undefined,
      );
    });
  });

  // ========================
  // Update
  // ========================

  describe('update', () => {
    it('should update and return convertible', async () => {
      mockService.update.mockResolvedValue({
        ...mockConvertible,
        discountRate: '0.25',
      });

      const result = await controller.update('comp-1', 'conv-1', {
        discountRate: '0.25',
      });

      expect(result.discountRate).toBe('0.25');
    });

    it('should propagate BusinessRuleException for non-outstanding status', async () => {
      mockService.update.mockRejectedValue(
        new BusinessRuleException('CONV_CANNOT_UPDATE', 'errors.conv.cannotUpdate'),
      );

      await expect(controller.update('comp-1', 'conv-1', { discountRate: '0.25' })).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should propagate NotFoundException', async () => {
      mockService.update.mockRejectedValue(new NotFoundException('convertible', 'conv-1'));

      await expect(controller.update('comp-1', 'conv-1', { notes: 'test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ========================
  // Redeem
  // ========================

  describe('redeem', () => {
    it('should redeem and return convertible', async () => {
      mockService.redeem.mockResolvedValue({
        ...mockConvertible,
        status: 'REDEEMED',
        redeemedAt: '2026-02-01T00:00:00.000Z',
      });

      const result = await controller.redeem('comp-1', 'conv-1', {
        redemptionAmount: '104000.00',
        notes: 'Investor buyback',
      });

      expect(result.status).toBe('REDEEMED');
    });

    it('should propagate BusinessRuleException for invalid status transition', async () => {
      mockService.redeem.mockRejectedValue(
        new BusinessRuleException(
          'CONV_INVALID_STATUS_TRANSITION',
          'errors.conv.invalidStatusTransition',
        ),
      );

      await expect(
        controller.redeem('comp-1', 'conv-1', { redemptionAmount: '104000.00' }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Cancel
  // ========================

  describe('cancel', () => {
    it('should cancel and return convertible', async () => {
      mockService.cancel.mockResolvedValue({
        ...mockConvertible,
        status: 'CANCELLED',
        cancelledAt: '2026-02-01T00:00:00.000Z',
      });

      const result = await controller.cancel('comp-1', 'conv-1', {
        cancellationReason: 'Mutual agreement',
      });

      expect(result.status).toBe('CANCELLED');
    });

    it('should propagate BusinessRuleException for already converted', async () => {
      mockService.cancel.mockRejectedValue(
        new BusinessRuleException('CONV_ALREADY_CONVERTED', 'errors.conv.alreadyConverted'),
      );

      await expect(
        controller.cancel('comp-1', 'conv-1', { cancellationReason: 'Test' }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Convert
  // ========================

  describe('convert', () => {
    it('should convert and return result', async () => {
      mockService.convert.mockResolvedValue({
        ...mockConvertible,
        status: 'CONVERTED',
        convertedAt: '2026-02-01T00:00:00.000Z',
        conversionData: {
          fundingRoundId: 'round-1',
          shareClassId: 'sc-1',
          sharesIssued: '20000',
          pricePerShare: '5.20',
          method: 'cap',
        },
      });

      const result = await controller.convert(
        'comp-1',
        'conv-1',
        {
          fundingRoundId: 'round-1',
          roundValuation: '10000000.00',
          shareClassId: 'sc-1',
        },
        mockUser,
      );

      expect(result.status).toBe('CONVERTED');
      expect(result.conversionData.sharesIssued).toBe('20000');
      expect(mockService.convert).toHaveBeenCalledWith(
        'comp-1',
        'conv-1',
        expect.objectContaining({ fundingRoundId: 'round-1' }),
        'user-1',
      );
    });

    it('should propagate ConflictException for already converted', async () => {
      mockService.convert.mockRejectedValue(
        new ConflictException('CONV_ALREADY_CONVERTED', 'errors.conv.alreadyConverted'),
      );

      await expect(
        controller.convert(
          'comp-1',
          'conv-1',
          {
            fundingRoundId: 'round-1',
            roundValuation: '10000000.00',
            shareClassId: 'sc-1',
          },
          mockUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should propagate BusinessRuleException for exceeding authorized shares', async () => {
      mockService.convert.mockRejectedValue(
        new BusinessRuleException('CONV_EXCEEDS_AUTHORIZED', 'errors.conv.exceedsAuthorized'),
      );

      await expect(
        controller.convert(
          'comp-1',
          'conv-1',
          {
            fundingRoundId: 'round-1',
            roundValuation: '10000000.00',
            shareClassId: 'sc-1',
          },
          mockUser,
        ),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should propagate NotFoundException for missing share class', async () => {
      mockService.convert.mockRejectedValue(new NotFoundException('shareClass', 'sc-1'));

      await expect(
        controller.convert(
          'comp-1',
          'conv-1',
          {
            fundingRoundId: 'round-1',
            roundValuation: '10000000.00',
            shareClassId: 'sc-missing',
          },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
