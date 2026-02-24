import { Test, TestingModule } from '@nestjs/testing';
import { OptionPlanController } from './option-plan.controller';
import { OptionPlanService } from './option-plan.service';
import {
  NotFoundException,
  BusinessRuleException,
} from '../common/filters/app-exception';
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

const mockPlan = {
  id: 'plan-1',
  companyId: 'comp-1',
  name: '2026 Employee Option Plan',
  shareClassId: 'sc-1',
  totalPoolSize: '100000',
  totalGranted: '30000',
  totalExercised: '5000',
  status: 'ACTIVE' as const,
  terminationPolicy: 'FORFEITURE' as const,
  exerciseWindowDays: 90,
  boardApprovalDate: null,
  notes: null,
  closedAt: null,
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const mockGrant = {
  id: 'grant-1',
  companyId: 'comp-1',
  planId: 'plan-1',
  shareholderId: 'sh-1',
  employeeName: 'Maria Silva',
  employeeEmail: 'maria@company.com',
  quantity: '10000',
  strikePrice: '5.00',
  exercised: '0',
  status: 'ACTIVE' as const,
  grantDate: '2026-01-15',
  expirationDate: '2036-01-15',
  cliffMonths: 12,
  vestingDurationMonths: 48,
  vestingFrequency: 'MONTHLY' as const,
  cliffPercentage: '25.00',
  accelerationOnCoc: false,
  terminatedAt: null,
  notes: null,
  createdBy: 'user-1',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  vesting: {
    vestedQuantity: '2500',
    unvestedQuantity: '7500',
    exercisableQuantity: '2500',
    vestingPercentage: '25.00',
    cliffDate: '2027-01-15T00:00:00.000Z',
    cliffMet: true,
    nextVestingDate: '2027-02-15T00:00:00.000Z',
    nextVestingAmount: '208',
  },
};

const mockExercise = {
  id: 'exercise-1',
  grantId: 'grant-1',
  quantity: '2000',
  totalCost: '10000',
  paymentReference: 'EX-2026-A1B2C3',
  status: 'PENDING_PAYMENT' as const,
  confirmedBy: null,
  confirmedAt: null,
  cancelledAt: null,
  blockchainTxHash: null,
  createdBy: 'user-1',
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  grant: {
    id: 'grant-1',
    employeeName: 'Maria Silva',
    employeeEmail: 'maria@company.com',
    strikePrice: '5.00',
    plan: { id: 'plan-1', name: '2026 Employee Option Plan' },
  },
};

const mockService = {
  createPlan: jest.fn(),
  findAllPlans: jest.fn(),
  findPlanById: jest.fn(),
  updatePlan: jest.fn(),
  closePlan: jest.fn(),
  createGrant: jest.fn(),
  findAllGrants: jest.fn(),
  findGrantById: jest.fn(),
  getGrantVestingSchedule: jest.fn(),
  cancelGrant: jest.fn(),
  createExerciseRequest: jest.fn(),
  findAllExercises: jest.fn(),
  findExerciseById: jest.fn(),
  confirmExercisePayment: jest.fn(),
  cancelExercise: jest.fn(),
};

describe('OptionPlanController', () => {
  let controller: OptionPlanController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OptionPlanController],
      providers: [
        { provide: OptionPlanService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<OptionPlanController>(OptionPlanController);
    jest.clearAllMocks();
  });

  // ========================
  // Option Plan Endpoints
  // ========================

  describe('createPlan', () => {
    it('should create and return an option plan', async () => {
      mockService.createPlan.mockResolvedValue(mockPlan);

      const result = await controller.createPlan('comp-1', {
        name: '2026 Employee Option Plan',
        shareClassId: 'sc-1',
        totalPoolSize: '100000',
      }, mockUser);

      expect(result).toEqual(mockPlan);
      expect(mockService.createPlan).toHaveBeenCalledWith(
        'comp-1',
        expect.objectContaining({ name: '2026 Employee Option Plan' }),
        'user-1',
      );
    });

    it('should propagate NotFoundException', async () => {
      mockService.createPlan.mockRejectedValue(
        new NotFoundException('company', 'comp-1'),
      );

      await expect(
        controller.createPlan('comp-1', {
          name: 'Plan',
          shareClassId: 'sc-1',
          totalPoolSize: '100000',
        }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listPlans', () => {
    it('should return paginated plans', async () => {
      mockService.findAllPlans.mockResolvedValue({
        items: [mockPlan],
        total: 1,
      });

      const result = await controller.listPlans('comp-1', { page: 1, limit: 20 });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: [mockPlan],
          meta: expect.objectContaining({ total: 1, page: 1 }),
        }),
      );
    });
  });

  describe('getPlan', () => {
    it('should return plan detail', async () => {
      mockService.findPlanById.mockResolvedValue({
        ...mockPlan,
        optionsAvailable: '70000',
        activeGrantCount: 3,
      });

      const result = await controller.getPlan('comp-1', 'plan-1');

      expect(result.optionsAvailable).toBe('70000');
    });

    it('should propagate NotFoundException', async () => {
      mockService.findPlanById.mockRejectedValue(
        new NotFoundException('optionPlan', 'plan-1'),
      );

      await expect(
        controller.getPlan('comp-1', 'plan-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePlan', () => {
    it('should update and return plan', async () => {
      mockService.updatePlan.mockResolvedValue({
        ...mockPlan,
        name: 'Updated Plan',
      });

      const result = await controller.updatePlan('comp-1', 'plan-1', {
        name: 'Updated Plan',
      });

      expect(result.name).toBe('Updated Plan');
    });

    it('should propagate BusinessRuleException for closed plan', async () => {
      mockService.updatePlan.mockRejectedValue(
        new BusinessRuleException('OPT_PLAN_CLOSED', 'errors.opt.planClosed'),
      );

      await expect(
        controller.updatePlan('comp-1', 'plan-1', { name: 'Updated' }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('closePlan', () => {
    it('should close plan', async () => {
      mockService.closePlan.mockResolvedValue({
        ...mockPlan,
        status: 'CLOSED',
      });

      const result = await controller.closePlan('comp-1', 'plan-1');

      expect(result.status).toBe('CLOSED');
    });

    it('should propagate BusinessRuleException if already closed', async () => {
      mockService.closePlan.mockRejectedValue(
        new BusinessRuleException('OPT_PLAN_ALREADY_CLOSED', 'errors.opt.planAlreadyClosed'),
      );

      await expect(
        controller.closePlan('comp-1', 'plan-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Option Grant Endpoints
  // ========================

  describe('createGrant', () => {
    it('should create and return a grant', async () => {
      mockService.createGrant.mockResolvedValue(mockGrant);

      const result = await controller.createGrant('comp-1', {
        optionPlanId: 'plan-1',
        employeeName: 'Maria Silva',
        employeeEmail: 'maria@company.com',
        quantity: '10000',
        strikePrice: '5.00',
        grantDate: '2026-01-15',
        expirationDate: '2036-01-15',
        cliffMonths: 12,
        vestingDurationMonths: 48,
      }, mockUser);

      expect(result).toEqual(mockGrant);
      expect(mockService.createGrant).toHaveBeenCalledWith(
        'comp-1',
        expect.objectContaining({ employeeName: 'Maria Silva' }),
        'user-1',
      );
    });

    it('should propagate BusinessRuleException for exhausted plan', async () => {
      mockService.createGrant.mockRejectedValue(
        new BusinessRuleException('OPT_PLAN_EXHAUSTED', 'errors.opt.planExhausted', {
          optionsAvailable: '5000',
          quantityRequested: '10000',
        }),
      );

      await expect(
        controller.createGrant('comp-1', {
          optionPlanId: 'plan-1',
          employeeName: 'Maria',
          employeeEmail: 'maria@company.com',
          quantity: '10000',
          strikePrice: '5.00',
          grantDate: '2026-01-15',
          expirationDate: '2036-01-15',
          cliffMonths: 12,
          vestingDurationMonths: 48,
        }, mockUser),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('listGrants', () => {
    it('should return paginated grants', async () => {
      mockService.findAllGrants.mockResolvedValue({
        items: [mockGrant],
        total: 1,
      });

      const result = await controller.listGrants('comp-1', { page: 1, limit: 20 });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: [mockGrant],
          meta: expect.objectContaining({ total: 1, page: 1 }),
        }),
      );
    });
  });

  describe('getGrant', () => {
    it('should return grant detail with vesting', async () => {
      mockService.findGrantById.mockResolvedValue(mockGrant);

      const result = await controller.getGrant('comp-1', 'grant-1');

      expect(result.vesting).toBeDefined();
      expect(result.vesting.vestedQuantity).toBe('2500');
    });

    it('should propagate NotFoundException', async () => {
      mockService.findGrantById.mockRejectedValue(
        new NotFoundException('optionGrant', 'grant-1'),
      );

      await expect(
        controller.getGrant('comp-1', 'grant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVestingSchedule', () => {
    it('should return full vesting schedule', async () => {
      mockService.getGrantVestingSchedule.mockResolvedValue({
        grantId: 'grant-1',
        shareholderName: 'Maria Silva',
        totalOptions: '10000',
        vestedOptions: '2500',
        unvestedOptions: '7500',
        exercisedOptions: '0',
        exercisableOptions: '2500',
        vestingPercentage: '25.00',
        cliffDate: '2027-01-15T00:00:00.000Z',
        cliffMet: true,
        schedule: [
          { date: '2027-01-15T00:00:00.000Z', quantity: '2500', cumulative: '2500', type: 'CLIFF' },
        ],
      });

      const result = await controller.getVestingSchedule('comp-1', 'grant-1');

      expect(result.schedule).toHaveLength(1);
      expect(result.schedule[0].type).toBe('CLIFF');
    });
  });

  describe('cancelGrant', () => {
    it('should cancel grant', async () => {
      mockService.cancelGrant.mockResolvedValue({
        ...mockGrant,
        status: 'CANCELLED',
      });

      const result = await controller.cancelGrant('comp-1', 'grant-1');

      expect(result.status).toBe('CANCELLED');
    });

    it('should propagate BusinessRuleException for already cancelled', async () => {
      mockService.cancelGrant.mockRejectedValue(
        new BusinessRuleException('OPT_GRANT_ALREADY_CANCELLED', 'errors.opt.grantAlreadyCancelled'),
      );

      await expect(
        controller.cancelGrant('comp-1', 'grant-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Option Exercise Endpoints
  // ========================

  describe('createExercise', () => {
    it('should create and return an exercise request', async () => {
      mockService.createExerciseRequest.mockResolvedValue(mockExercise);

      const result = await controller.createExercise(
        'comp-1',
        'grant-1',
        { quantity: '2000' },
        mockUser,
      );

      expect(result).toEqual(mockExercise);
      expect(mockService.createExerciseRequest).toHaveBeenCalledWith(
        'comp-1',
        'grant-1',
        { quantity: '2000' },
        'user-1',
      );
    });

    it('should propagate NotFoundException for missing grant', async () => {
      mockService.createExerciseRequest.mockRejectedValue(
        new NotFoundException('optionGrant', 'grant-1'),
      );

      await expect(
        controller.createExercise('comp-1', 'grant-1', { quantity: '2000' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate BusinessRuleException for insufficient vested', async () => {
      mockService.createExerciseRequest.mockRejectedValue(
        new BusinessRuleException('OPT_INSUFFICIENT_VESTED', 'errors.opt.insufficientVested', {
          exercisableOptions: '500',
          requestedQuantity: '2000',
        }),
      );

      await expect(
        controller.createExercise('comp-1', 'grant-1', { quantity: '2000' }, mockUser),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('listExercises', () => {
    it('should return paginated exercise requests', async () => {
      mockService.findAllExercises.mockResolvedValue({
        items: [mockExercise],
        total: 1,
      });

      const result = await controller.listExercises('comp-1', { page: 1, limit: 20 });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          data: [mockExercise],
          meta: expect.objectContaining({ total: 1, page: 1 }),
        }),
      );
    });

    it('should pass filters to service', async () => {
      mockService.findAllExercises.mockResolvedValue({
        items: [],
        total: 0,
      });

      await controller.listExercises('comp-1', {
        page: 1,
        limit: 20,
        status: 'COMPLETED',
        grantId: 'grant-1',
      });

      expect(mockService.findAllExercises).toHaveBeenCalledWith(
        'comp-1',
        expect.objectContaining({ status: 'COMPLETED', grantId: 'grant-1' }),
      );
    });
  });

  describe('getExercise', () => {
    it('should return exercise detail', async () => {
      mockService.findExerciseById.mockResolvedValue(mockExercise);

      const result = await controller.getExercise('comp-1', 'exercise-1');

      expect(result.id).toBe('exercise-1');
      expect(result.grant.employeeName).toBe('Maria Silva');
    });

    it('should propagate NotFoundException', async () => {
      mockService.findExerciseById.mockRejectedValue(
        new NotFoundException('optionExercise', 'exercise-1'),
      );

      await expect(
        controller.getExercise('comp-1', 'exercise-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmExercise', () => {
    it('should confirm payment and return updated exercise', async () => {
      mockService.confirmExercisePayment.mockResolvedValue({
        ...mockExercise,
        status: 'COMPLETED',
        confirmedBy: 'user-1',
      });

      const result = await controller.confirmExercise(
        'comp-1',
        'exercise-1',
        {},
        mockUser,
      );

      expect(result.status).toBe('COMPLETED');
      expect(mockService.confirmExercisePayment).toHaveBeenCalledWith(
        'comp-1',
        'exercise-1',
        {},
        'user-1',
      );
    });

    it('should propagate BusinessRuleException for already confirmed', async () => {
      mockService.confirmExercisePayment.mockRejectedValue(
        new BusinessRuleException('OPT_EXERCISE_ALREADY_CONFIRMED', 'errors.opt.exerciseAlreadyConfirmed'),
      );

      await expect(
        controller.confirmExercise('comp-1', 'exercise-1', {}, mockUser),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should propagate BusinessRuleException for no shareholder linked', async () => {
      mockService.confirmExercisePayment.mockRejectedValue(
        new BusinessRuleException('OPT_NO_SHAREHOLDER_LINKED', 'errors.opt.noShareholderLinked'),
      );

      await expect(
        controller.confirmExercise('comp-1', 'exercise-1', {}, mockUser),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('cancelExercise', () => {
    it('should cancel and return exercise', async () => {
      mockService.cancelExercise.mockResolvedValue({
        ...mockExercise,
        status: 'CANCELLED',
      });

      const result = await controller.cancelExercise('comp-1', 'exercise-1', mockUser);

      expect(result.status).toBe('CANCELLED');
    });

    it('should propagate BusinessRuleException for already cancelled', async () => {
      mockService.cancelExercise.mockRejectedValue(
        new BusinessRuleException('OPT_EXERCISE_ALREADY_CANCELLED', 'errors.opt.exerciseAlreadyCancelled'),
      );

      await expect(
        controller.cancelExercise('comp-1', 'exercise-1', mockUser),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should propagate BusinessRuleException for non-pending status', async () => {
      mockService.cancelExercise.mockRejectedValue(
        new BusinessRuleException('OPT_EXERCISE_NOT_PENDING', 'errors.opt.exerciseNotPending'),
      );

      await expect(
        controller.cancelExercise('comp-1', 'exercise-1', mockUser),
      ).rejects.toThrow(BusinessRuleException);
    });
  });
});
