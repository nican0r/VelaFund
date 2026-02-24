import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { OptionPlanService } from './option-plan.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BusinessRuleException,
} from '../common/filters/app-exception';

// ── Mock Factories ──

function mockCompany(overrides: Record<string, unknown> = {}) {
  return { id: 'company-1', status: 'ACTIVE', ...overrides } as any;
}

function mockShareClass(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sc-1',
    companyId: 'company-1',
    className: 'Ordinary',
    type: 'COMMON',
    ...overrides,
  } as any;
}

function mockPlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    companyId: 'company-1',
    name: '2026 Employee Option Plan',
    shareClassId: 'sc-1',
    totalPoolSize: new Prisma.Decimal('100000'),
    totalGranted: new Prisma.Decimal('0'),
    totalExercised: new Prisma.Decimal('0'),
    status: 'ACTIVE',
    boardApprovalDate: null,
    terminationPolicy: 'FORFEITURE',
    exerciseWindowDays: 90,
    notes: null,
    closedAt: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as any;
}

function mockGrant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'grant-1',
    companyId: 'company-1',
    planId: 'plan-1',
    shareholderId: 'sh-1',
    employeeName: 'Maria Silva',
    employeeEmail: 'maria@company.com',
    quantity: new Prisma.Decimal('10000'),
    strikePrice: new Prisma.Decimal('5.00'),
    exercised: new Prisma.Decimal('0'),
    status: 'ACTIVE',
    grantDate: new Date('2025-01-15'),
    expirationDate: new Date('2035-01-15'),
    cliffMonths: 12,
    vestingDurationMonths: 48,
    vestingFrequency: 'MONTHLY',
    cliffPercentage: new Prisma.Decimal('25.00'),
    accelerationOnCoc: false,
    terminatedAt: null,
    notes: null,
    createdBy: 'user-1',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
    ...overrides,
  } as any;
}

// ── Test Setup ──

describe('OptionPlanService', () => {
  let service: OptionPlanService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      company: { findFirst: jest.fn() },
      shareClass: { findFirst: jest.fn() },
      optionPlan: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      optionGrant: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      shareholder: { findFirst: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionPlanService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OptionPlanService>(OptionPlanService);
  });

  // ========================
  // Option Plan CRUD
  // ========================

  describe('createPlan', () => {
    const dto = {
      name: '2026 Employee Option Plan',
      shareClassId: 'sc-1',
      totalPoolSize: '100000',
      terminationPolicy: 'FORFEITURE' as const,
      exerciseWindowDays: 90,
    };

    it('should create an option plan', async () => {
      prisma.company.findFirst.mockResolvedValue(mockCompany());
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass());
      prisma.optionPlan.create.mockResolvedValue(mockPlan());

      const result = await service.createPlan('company-1', dto, 'user-1');

      expect(result.id).toBe('plan-1');
      expect(prisma.optionPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'company-1',
            name: dto.name,
            shareClassId: 'sc-1',
          }),
        }),
      );
    });

    it('should throw NotFoundException if company not found', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.createPlan('company-1', dto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if company not active', async () => {
      prisma.company.findFirst.mockResolvedValue(mockCompany({ status: 'DRAFT' }));

      await expect(
        service.createPlan('company-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw NotFoundException if share class not found', async () => {
      prisma.company.findFirst.mockResolvedValue(mockCompany());
      prisma.shareClass.findFirst.mockResolvedValue(null);

      await expect(
        service.createPlan('company-1', dto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if pool size is zero', async () => {
      prisma.company.findFirst.mockResolvedValue(mockCompany());
      prisma.shareClass.findFirst.mockResolvedValue(mockShareClass());

      await expect(
        service.createPlan('company-1', { ...dto, totalPoolSize: '0' }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('findAllPlans', () => {
    it('should return paginated plans', async () => {
      prisma.optionPlan.findMany.mockResolvedValue([mockPlan()]);
      prisma.optionPlan.count.mockResolvedValue(1);

      const result = await service.findAllPlans('company-1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.optionPlan.findMany.mockResolvedValue([]);
      prisma.optionPlan.count.mockResolvedValue(0);

      await service.findAllPlans('company-1', { page: 1, limit: 20, status: 'CLOSED' as any });

      expect(prisma.optionPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'company-1', status: 'CLOSED' },
        }),
      );
    });
  });

  describe('findPlanById', () => {
    it('should return plan with grant stats', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(
        mockPlan({ shareClass: mockShareClass() }),
      );
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('30000'), exercised: new Prisma.Decimal('5000') },
        _count: 3,
      });

      const result = await service.findPlanById('company-1', 'plan-1');

      expect(result.totalGranted).toBe('30000');
      expect(result.totalExercised).toBe('5000');
      expect(result.optionsAvailable).toBe('70000');
      expect(result.activeGrantCount).toBe(3);
    });

    it('should throw NotFoundException if plan not found', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(null);

      await expect(
        service.findPlanById('company-1', 'plan-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePlan', () => {
    it('should update plan name', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionPlan.update.mockResolvedValue(
        mockPlan({ name: 'Updated Plan' }),
      );

      const result = await service.updatePlan('company-1', 'plan-1', {
        name: 'Updated Plan',
      });

      expect(result.name).toBe('Updated Plan');
    });

    it('should throw NotFoundException if plan not found', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePlan('company-1', 'plan-1', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if plan is closed', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan({ status: 'CLOSED' }));

      await expect(
        service.updatePlan('company-1', 'plan-1', { name: 'Updated' }),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should allow increasing pool size', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(
        mockPlan({ totalGranted: new Prisma.Decimal('50000') }),
      );
      prisma.optionPlan.update.mockResolvedValue(mockPlan());

      await service.updatePlan('company-1', 'plan-1', {
        totalPoolSize: '200000',
      });

      expect(prisma.optionPlan.update).toHaveBeenCalled();
    });

    it('should throw BusinessRuleException if pool size shrinks below granted', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(
        mockPlan({ totalGranted: new Prisma.Decimal('50000') }),
      );

      await expect(
        service.updatePlan('company-1', 'plan-1', { totalPoolSize: '30000' }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('closePlan', () => {
    it('should close an active plan', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionPlan.update.mockResolvedValue(mockPlan({ status: 'CLOSED' }));

      const result = await service.closePlan('company-1', 'plan-1');

      expect(result.status).toBe('CLOSED');
      expect(prisma.optionPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CLOSED' }),
        }),
      );
    });

    it('should throw NotFoundException if plan not found', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(null);

      await expect(
        service.closePlan('company-1', 'plan-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if already closed', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan({ status: 'CLOSED' }));

      await expect(
        service.closePlan('company-1', 'plan-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Option Grant CRUD
  // ========================

  describe('createGrant', () => {
    const dto = {
      optionPlanId: 'plan-1',
      shareholderId: 'sh-1',
      employeeName: 'Maria Silva',
      employeeEmail: 'maria@company.com',
      quantity: '10000',
      strikePrice: '5.00',
      grantDate: '2026-01-15',
      expirationDate: '2036-01-15',
      cliffMonths: 12,
      vestingDurationMonths: 48,
      vestingFrequency: 'MONTHLY' as const,
    };

    it('should create a grant and update plan totalGranted', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });
      prisma.shareholder.findFirst.mockResolvedValue({ id: 'sh-1' });
      prisma.optionGrant.create.mockResolvedValue(mockGrant());
      prisma.optionPlan.update.mockResolvedValue(mockPlan());

      const result = await service.createGrant('company-1', dto, 'user-1');

      expect(result.id).toBe('grant-1');
      expect(prisma.optionPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalGranted: expect.any(Prisma.Decimal),
          }),
        }),
      );
    });

    it('should throw NotFoundException if plan not found', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(null);

      await expect(
        service.createGrant('company-1', dto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if plan is closed', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan({ status: 'CLOSED' }));

      await expect(
        service.createGrant('company-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if pool exhausted', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(
        mockPlan({ totalPoolSize: new Prisma.Decimal('5000') }),
      );
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });

      await expect(
        service.createGrant('company-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if quantity is zero', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });

      await expect(
        service.createGrant('company-1', { ...dto, quantity: '0' }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if strike price is zero', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });
      prisma.shareholder.findFirst.mockResolvedValue({ id: 'sh-1' });

      await expect(
        service.createGrant('company-1', { ...dto, strikePrice: '0' }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if cliff exceeds vesting', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });
      prisma.shareholder.findFirst.mockResolvedValue({ id: 'sh-1' });

      await expect(
        service.createGrant(
          'company-1',
          { ...dto, cliffMonths: 60, vestingDurationMonths: 48 },
          'user-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if expiration before grant date', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });
      prisma.shareholder.findFirst.mockResolvedValue({ id: 'sh-1' });

      await expect(
        service.createGrant(
          'company-1',
          { ...dto, expirationDate: '2025-01-01' },
          'user-1',
        ),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw NotFoundException if shareholder not found', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await expect(
        service.createGrant('company-1', dto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow creating grant without shareholderId', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });
      prisma.optionGrant.create.mockResolvedValue(
        mockGrant({ shareholderId: null }),
      );
      prisma.optionPlan.update.mockResolvedValue(mockPlan());

      const { shareholderId: _, ...dtoNoShareholder } = dto;

      const result = await service.createGrant('company-1', dtoNoShareholder, 'user-1');
      expect(result).toBeDefined();
      // Should not call shareholder.findFirst when no shareholderId
      expect(prisma.shareholder.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('findAllGrants', () => {
    it('should return paginated grants with vesting info', async () => {
      prisma.optionGrant.findMany.mockResolvedValue([
        mockGrant({ plan: { id: 'plan-1', name: 'Plan 1' }, shareholder: { id: 'sh-1', name: 'Maria' } }),
      ]);
      prisma.optionGrant.count.mockResolvedValue(1);

      const result = await service.findAllGrants('company-1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].vesting).toBeDefined();
      expect(result.total).toBe(1);
    });

    it('should filter by optionPlanId', async () => {
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.optionGrant.count.mockResolvedValue(0);

      await service.findAllGrants('company-1', {
        page: 1,
        limit: 20,
        optionPlanId: 'plan-1',
      });

      expect(prisma.optionGrant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ planId: 'plan-1' }),
        }),
      );
    });

    it('should filter by shareholderId', async () => {
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.optionGrant.count.mockResolvedValue(0);

      await service.findAllGrants('company-1', {
        page: 1,
        limit: 20,
        shareholderId: 'sh-1',
      });

      expect(prisma.optionGrant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ shareholderId: 'sh-1' }),
        }),
      );
    });
  });

  describe('findGrantById', () => {
    it('should return grant with vesting info', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(
        mockGrant({
          plan: { id: 'plan-1', name: 'Plan 1', terminationPolicy: 'FORFEITURE', exerciseWindowDays: 90 },
          shareholder: { id: 'sh-1', name: 'Maria' },
        }),
      );

      const result = await service.findGrantById('company-1', 'grant-1');

      expect(result.id).toBe('grant-1');
      expect(result.vesting).toBeDefined();
    });

    it('should throw NotFoundException if grant not found', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(null);

      await expect(
        service.findGrantById('company-1', 'grant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getGrantVestingSchedule', () => {
    it('should return full vesting schedule', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(
        mockGrant({ shareholder: { id: 'sh-1', name: 'Maria' } }),
      );

      const result = await service.getGrantVestingSchedule('company-1', 'grant-1');

      expect(result.grantId).toBe('grant-1');
      expect(result.totalOptions).toBe('10000');
      expect(result.schedule).toBeInstanceOf(Array);
      expect(result.schedule.length).toBeGreaterThan(0);
      expect(result.schedule[0].type).toBe('CLIFF');
    });

    it('should throw NotFoundException if grant not found', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(null);

      await expect(
        service.getGrantVestingSchedule('company-1', 'grant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelGrant', () => {
    it('should cancel an active grant and return options to pool', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(
        mockGrant({ exercised: new Prisma.Decimal('2000') }),
      );
      prisma.optionGrant.update.mockResolvedValue(
        mockGrant({ status: 'CANCELLED' }),
      );
      prisma.optionPlan.update.mockResolvedValue(mockPlan());

      const result = await service.cancelGrant('company-1', 'grant-1');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.optionPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalGranted: { decrement: new Prisma.Decimal('8000') },
          }),
        }),
      );
    });

    it('should throw NotFoundException if grant not found', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelGrant('company-1', 'grant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if already cancelled', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(
        mockGrant({ status: 'CANCELLED' }),
      );

      await expect(
        service.cancelGrant('company-1', 'grant-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if grant is exercised', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(
        mockGrant({ status: 'EXERCISED' }),
      );

      await expect(
        service.cancelGrant('company-1', 'grant-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  // ========================
  // Vesting Calculation
  // ========================

  describe('calculateVesting', () => {
    it('should return 0 vested before cliff', () => {
      const grant = mockGrant({
        grantDate: new Date('2026-01-15'),
        cliffMonths: 12,
        vestingDurationMonths: 48,
      });

      const result = service.calculateVesting(grant);

      expect(result.vestedQuantity).toBe('0');
      expect(result.cliffMet).toBe(false);
      expect(result.nextVestingDate).toBeDefined();
    });

    it('should return 100% vested after vesting end date', () => {
      const grant = mockGrant({
        grantDate: new Date('2020-01-15'),
        cliffMonths: 12,
        vestingDurationMonths: 48,
      });

      const result = service.calculateVesting(grant);

      expect(result.vestedQuantity).toBe('10000');
      expect(result.vestingPercentage).toBe('100.00');
      expect(result.cliffMet).toBe(true);
      expect(result.nextVestingDate).toBeNull();
    });

    it('should return cliff amount at cliff date', () => {
      // Set cliff to be just passed
      const now = new Date();
      const grantDate = new Date(now);
      grantDate.setMonth(grantDate.getMonth() - 13); // 13 months ago

      const grant = mockGrant({
        grantDate,
        cliffMonths: 12,
        vestingDurationMonths: 48,
        quantity: new Prisma.Decimal('48000'), // 48000 for easy math
      });

      const result = service.calculateVesting(grant);

      // After cliff (12/48 = 25%) + 1 month post-cliff vesting
      expect(result.cliffMet).toBe(true);
      expect(parseInt(result.vestedQuantity)).toBeGreaterThanOrEqual(12000); // cliff amount
      expect(parseInt(result.vestedQuantity)).toBeLessThanOrEqual(14000); // cliff + 1-2 months
    });

    it('should return 0 for cancelled grants', () => {
      const grant = mockGrant({ status: 'CANCELLED' });

      const result = service.calculateVesting(grant);

      expect(result.vestedQuantity).toBe('0');
      expect(result.vestingPercentage).toBe('0.00');
    });

    it('should return 100% for exercised grants', () => {
      const grant = mockGrant({ status: 'EXERCISED' });

      const result = service.calculateVesting(grant);

      expect(result.vestedQuantity).toBe('10000');
      expect(result.vestingPercentage).toBe('100.00');
    });

    it('should handle zero cliff months', () => {
      const now = new Date();
      const grantDate = new Date(now);
      grantDate.setMonth(grantDate.getMonth() - 6); // 6 months ago

      const grant = mockGrant({
        grantDate,
        cliffMonths: 0,
        vestingDurationMonths: 48,
        quantity: new Prisma.Decimal('48000'),
      });

      const result = service.calculateVesting(grant);

      // 6/48 = 12.5%, so ~6000 options
      expect(result.cliffMet).toBe(true);
      expect(parseInt(result.vestedQuantity)).toBeGreaterThanOrEqual(5000);
      expect(parseInt(result.vestedQuantity)).toBeLessThanOrEqual(7000);
    });
  });

  describe('generateVestingSchedule', () => {
    it('should generate a complete vesting schedule', () => {
      const grant = mockGrant({
        quantity: new Prisma.Decimal('48000'),
        cliffMonths: 12,
        vestingDurationMonths: 48,
        vestingFrequency: 'MONTHLY',
      });

      const schedule = service.generateVestingSchedule(grant);

      // 1 cliff entry + 36 monthly entries = 37 total
      expect(schedule).toHaveLength(37);
      expect(schedule[0].type).toBe('CLIFF');
      expect(schedule[0].quantity).toBe('12000');
      expect(schedule[0].cumulative).toBe('12000');

      // Last entry should have cumulative = totalQuantity
      expect(schedule[schedule.length - 1].cumulative).toBe('48000');
    });

    it('should generate quarterly schedule', () => {
      const grant = mockGrant({
        quantity: new Prisma.Decimal('48000'),
        cliffMonths: 12,
        vestingDurationMonths: 48,
        vestingFrequency: 'QUARTERLY',
      });

      const schedule = service.generateVestingSchedule(grant);

      // 1 cliff + 12 quarters = 13 total
      expect(schedule).toHaveLength(13);
      expect(schedule[0].type).toBe('CLIFF');
      expect(schedule[1].type).toBe('QUARTERLY');
    });

    it('should generate annual schedule', () => {
      const grant = mockGrant({
        quantity: new Prisma.Decimal('48000'),
        cliffMonths: 12,
        vestingDurationMonths: 48,
        vestingFrequency: 'ANNUALLY',
      });

      const schedule = service.generateVestingSchedule(grant);

      // 1 cliff + 3 annual = 4 total
      expect(schedule).toHaveLength(4);
      expect(schedule[0].type).toBe('CLIFF');
      expect(schedule[1].type).toBe('ANNUAL');
    });

    it('should handle zero cliff correctly', () => {
      const grant = mockGrant({
        quantity: new Prisma.Decimal('48000'),
        cliffMonths: 0,
        vestingDurationMonths: 48,
        vestingFrequency: 'MONTHLY',
      });

      const schedule = service.generateVestingSchedule(grant);

      // No cliff entry (cliffMonths is 0), 48 monthly entries
      expect(schedule).toHaveLength(48);
      expect(schedule[0].type).toBe('MONTHLY');
      expect(schedule[schedule.length - 1].cumulative).toBe('48000');
    });
  });
});
