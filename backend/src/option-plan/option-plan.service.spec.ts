import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { OptionPlanService } from './option-plan.service';
import { PrismaService } from '../prisma/prisma.service';
import { CapTableService } from '../cap-table/cap-table.service';
import { NotFoundException, BusinessRuleException } from '../common/filters/app-exception';
import { NotificationService } from '../notification/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';

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

function mockExercise(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exercise-1',
    grantId: 'grant-1',
    quantity: new Prisma.Decimal('2000'),
    totalCost: new Prisma.Decimal('10000'),
    paymentReference: 'EX-2026-A1B2C3',
    status: 'PENDING_PAYMENT',
    confirmedBy: null,
    confirmedAt: null,
    cancelledAt: null,
    blockchainTxHash: null,
    createdBy: 'user-1',
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-01'),
    ...overrides,
  } as any;
}

// ── Test Setup ──

describe('OptionPlanService', () => {
  let service: OptionPlanService;
  let prisma: any;
  let capTableService: any;

  beforeEach(async () => {
    capTableService = {
      recalculateOwnership: jest.fn(),
      createAutoSnapshot: jest.fn(),
    };

    prisma = {
      company: { findFirst: jest.fn(), findUnique: jest.fn() },
      shareClass: { findFirst: jest.fn(), update: jest.fn() },
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
      optionExerciseRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      shareholding: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      shareholder: { findFirst: jest.fn() },
      companyMember: { findFirst: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OptionPlanService,
        { provide: PrismaService, useValue: prisma },
        { provide: CapTableService, useValue: capTableService },
        { provide: NotificationService, useValue: { create: jest.fn() } },
        { provide: AuditLogService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
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

      await expect(service.createPlan('company-1', dto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException if company not active', async () => {
      prisma.company.findFirst.mockResolvedValue(mockCompany({ status: 'DRAFT' }));

      await expect(service.createPlan('company-1', dto, 'user-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw NotFoundException if share class not found', async () => {
      prisma.company.findFirst.mockResolvedValue(mockCompany());
      prisma.shareClass.findFirst.mockResolvedValue(null);

      await expect(service.createPlan('company-1', dto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
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
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan({ shareClass: mockShareClass() }));
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

      await expect(service.findPlanById('company-1', 'plan-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePlan', () => {
    it('should update plan name', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionPlan.update.mockResolvedValue(mockPlan({ name: 'Updated Plan' }));

      const result = await service.updatePlan('company-1', 'plan-1', {
        name: 'Updated Plan',
      });

      expect(result.name).toBe('Updated Plan');
    });

    it('should throw NotFoundException if plan not found', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(null);

      await expect(service.updatePlan('company-1', 'plan-1', { name: 'Updated' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException if plan is closed', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan({ status: 'CLOSED' }));

      await expect(service.updatePlan('company-1', 'plan-1', { name: 'Updated' })).rejects.toThrow(
        BusinessRuleException,
      );
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

      await expect(service.closePlan('company-1', 'plan-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if already closed', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan({ status: 'CLOSED' }));

      await expect(service.closePlan('company-1', 'plan-1')).rejects.toThrow(BusinessRuleException);
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

      await expect(service.createGrant('company-1', dto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException if plan is closed', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan({ status: 'CLOSED' }));

      await expect(service.createGrant('company-1', dto, 'user-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException if pool exhausted', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(
        mockPlan({ totalPoolSize: new Prisma.Decimal('5000') }),
      );
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });

      await expect(service.createGrant('company-1', dto, 'user-1')).rejects.toThrow(
        BusinessRuleException,
      );
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
        service.createGrant('company-1', { ...dto, expirationDate: '2025-01-01' }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw NotFoundException if shareholder not found', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await expect(service.createGrant('company-1', dto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should allow creating grant without shareholderId', async () => {
      prisma.optionPlan.findFirst.mockResolvedValue(mockPlan());
      prisma.optionGrant.aggregate.mockResolvedValue({
        _sum: { quantity: new Prisma.Decimal('0') },
      });
      prisma.optionGrant.create.mockResolvedValue(mockGrant({ shareholderId: null }));
      prisma.optionPlan.update.mockResolvedValue(mockPlan());

      const { shareholderId: _shareholderId, ...dtoNoShareholder } = dto;

      const result = await service.createGrant('company-1', dtoNoShareholder, 'user-1');
      expect(result).toBeDefined();
      // Should not call shareholder.findFirst when no shareholderId
      expect(prisma.shareholder.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('findAllGrants', () => {
    it('should return paginated grants with vesting info', async () => {
      prisma.optionGrant.findMany.mockResolvedValue([
        mockGrant({
          plan: { id: 'plan-1', name: 'Plan 1' },
          shareholder: { id: 'sh-1', name: 'Maria' },
        }),
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
          plan: {
            id: 'plan-1',
            name: 'Plan 1',
            terminationPolicy: 'FORFEITURE',
            exerciseWindowDays: 90,
          },
          shareholder: { id: 'sh-1', name: 'Maria' },
        }),
      );

      const result = await service.findGrantById('company-1', 'grant-1');

      expect(result.id).toBe('grant-1');
      expect(result.vesting).toBeDefined();
    });

    it('should throw NotFoundException if grant not found', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(null);

      await expect(service.findGrantById('company-1', 'grant-1')).rejects.toThrow(
        NotFoundException,
      );
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

      await expect(service.getGrantVestingSchedule('company-1', 'grant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelGrant', () => {
    it('should cancel an active grant and return options to pool', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(
        mockGrant({ exercised: new Prisma.Decimal('2000') }),
      );
      prisma.optionGrant.update.mockResolvedValue(mockGrant({ status: 'CANCELLED' }));
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

      await expect(service.cancelGrant('company-1', 'grant-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if already cancelled', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(mockGrant({ status: 'CANCELLED' }));

      await expect(service.cancelGrant('company-1', 'grant-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException if grant is exercised', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(mockGrant({ status: 'EXERCISED' }));

      await expect(service.cancelGrant('company-1', 'grant-1')).rejects.toThrow(
        BusinessRuleException,
      );
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

  // ========================
  // Option Exercise Requests
  // ========================

  describe('createExerciseRequest', () => {
    const dto = { quantity: '2000' };

    function fullyVestedGrant(overrides: Record<string, unknown> = {}) {
      return mockGrant({
        grantDate: new Date('2020-01-15'), // fully vested (>48 months ago)
        plan: {
          id: 'plan-1',
          exerciseWindowDays: 90,
          terminationPolicy: 'FORFEITURE',
          shareClassId: 'sc-1',
        },
        ...overrides,
      });
    }

    beforeEach(() => {
      // Mock grantee validation: user-1 is linked to shareholder sh-1 (the grantee)
      prisma.shareholder.findFirst.mockResolvedValue({ id: 'sh-1' });
    });

    it('should create an exercise request', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(fullyVestedGrant());
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(null);
      prisma.optionExerciseRequest.create.mockResolvedValue(mockExercise());

      const result = await service.createExerciseRequest('company-1', 'grant-1', dto, 'user-1');

      expect(result.id).toBe('exercise-1');
      expect(prisma.optionExerciseRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grantId: 'grant-1',
            quantity: new Prisma.Decimal('2000'),
          }),
        }),
      );
    });

    it('should generate a payment reference with EX- prefix', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(fullyVestedGrant());
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(null);
      prisma.optionExerciseRequest.create.mockResolvedValue(mockExercise());

      await service.createExerciseRequest('company-1', 'grant-1', dto, 'user-1');

      const createCall = prisma.optionExerciseRequest.create.mock.calls[0][0];
      expect(createCall.data.paymentReference).toMatch(/^EX-\d{4}-[A-F0-9]{6}$/);
    });

    it('should calculate totalCost as quantity × strikePrice', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(fullyVestedGrant());
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(null);
      prisma.optionExerciseRequest.create.mockResolvedValue(mockExercise());

      await service.createExerciseRequest('company-1', 'grant-1', dto, 'user-1');

      const createCall = prisma.optionExerciseRequest.create.mock.calls[0][0];
      // 2000 * 5.00 = 10000
      expect(createCall.data.totalCost.toString()).toBe('10000');
    });

    it('should throw NotFoundException if grant not found', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(null);

      await expect(
        service.createExerciseRequest('company-1', 'grant-1', dto, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if grant not active', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(fullyVestedGrant({ status: 'CANCELLED' }));

      await expect(
        service.createExerciseRequest('company-1', 'grant-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if exercise window expired', async () => {
      const terminatedLongAgo = new Date('2020-01-01');
      prisma.optionGrant.findFirst.mockResolvedValue(
        fullyVestedGrant({
          terminatedAt: terminatedLongAgo,
          plan: {
            id: 'plan-1',
            exerciseWindowDays: 90,
            terminationPolicy: 'FORFEITURE',
            shareClassId: 'sc-1',
          },
        }),
      );

      await expect(
        service.createExerciseRequest('company-1', 'grant-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if quantity is zero', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(fullyVestedGrant());

      await expect(
        service.createExerciseRequest('company-1', 'grant-1', { quantity: '0' }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if quantity exceeds exercisable', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(
        fullyVestedGrant({ exercised: new Prisma.Decimal('9500') }),
      );

      await expect(
        service.createExerciseRequest('company-1', 'grant-1', { quantity: '1000' }, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if pending exercise exists', async () => {
      prisma.optionGrant.findFirst.mockResolvedValue(fullyVestedGrant());
      prisma.optionExerciseRequest.findFirst.mockResolvedValue({ id: 'existing-exercise' });

      await expect(
        service.createExerciseRequest('company-1', 'grant-1', dto, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('findAllExercises', () => {
    it('should return paginated exercises', async () => {
      prisma.optionExerciseRequest.findMany.mockResolvedValue([mockExercise()]);
      prisma.optionExerciseRequest.count.mockResolvedValue(1);

      const result = await service.findAllExercises('company-1', { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.optionExerciseRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            grant: { companyId: 'company-1' },
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      prisma.optionExerciseRequest.findMany.mockResolvedValue([]);
      prisma.optionExerciseRequest.count.mockResolvedValue(0);

      await service.findAllExercises('company-1', {
        page: 1,
        limit: 20,
        status: 'COMPLETED',
      });

      expect(prisma.optionExerciseRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
          }),
        }),
      );
    });

    it('should filter by grantId', async () => {
      prisma.optionExerciseRequest.findMany.mockResolvedValue([]);
      prisma.optionExerciseRequest.count.mockResolvedValue(0);

      await service.findAllExercises('company-1', {
        page: 1,
        limit: 20,
        grantId: 'grant-1',
      });

      expect(prisma.optionExerciseRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            grantId: 'grant-1',
          }),
        }),
      );
    });
  });

  describe('findExerciseById', () => {
    it('should return exercise with grant details', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(
        mockExercise({
          grant: {
            id: 'grant-1',
            employeeName: 'Maria Silva',
            employeeEmail: 'maria@company.com',
            strikePrice: new Prisma.Decimal('5.00'),
            quantity: new Prisma.Decimal('10000'),
            exercised: new Prisma.Decimal('0'),
            status: 'ACTIVE',
            plan: { id: 'plan-1', name: 'Plan 1', shareClassId: 'sc-1' },
            shareholder: { id: 'sh-1', name: 'Maria Silva' },
          },
        }),
      );

      const result = await service.findExerciseById('company-1', 'exercise-1');

      expect(result.id).toBe('exercise-1');
      expect(result.grant.employeeName).toBe('Maria Silva');
    });

    it('should throw NotFoundException if exercise not found', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(null);

      await expect(service.findExerciseById('company-1', 'exercise-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('confirmExercisePayment', () => {
    function pendingExercise(overrides: Record<string, unknown> = {}) {
      return mockExercise({
        grant: {
          id: 'grant-1',
          planId: 'plan-1',
          shareholderId: 'sh-1',
          quantity: new Prisma.Decimal('10000'),
          exercised: new Prisma.Decimal('0'),
          plan: { shareClassId: 'sc-1' },
        },
        ...overrides,
      });
    }

    it('should confirm payment and update all related records', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(pendingExercise());
      prisma.optionExerciseRequest.update.mockResolvedValue(
        mockExercise({ status: 'COMPLETED', confirmedBy: 'user-1' }),
      );
      prisma.optionGrant.update.mockResolvedValue(mockGrant());
      prisma.optionPlan.update.mockResolvedValue(mockPlan());
      prisma.shareholding.findFirst.mockResolvedValue(null);
      prisma.shareholding.create.mockResolvedValue({ id: 'holding-1' });
      prisma.shareClass.update.mockResolvedValue(mockShareClass());

      const result = await service.confirmExercisePayment('company-1', 'exercise-1', {}, 'user-1');

      expect(result.status).toBe('COMPLETED');
      // Exercise request updated
      expect(prisma.optionExerciseRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED', confirmedBy: 'user-1' }),
        }),
      );
      // Grant exercised incremented
      expect(prisma.optionGrant.update).toHaveBeenCalled();
      // Plan totalExercised incremented
      expect(prisma.optionPlan.update).toHaveBeenCalled();
      // Shareholding created (new)
      expect(prisma.shareholding.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shareholderId: 'sh-1',
            shareClassId: 'sc-1',
            quantity: new Prisma.Decimal('2000'),
          }),
        }),
      );
      // ShareClass totalIssued incremented
      expect(prisma.shareClass.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalIssued: { increment: new Prisma.Decimal('2000') },
          }),
        }),
      );
      // Cap table recalculated and snapshot created
      expect(capTableService.recalculateOwnership).toHaveBeenCalledWith('company-1');
      expect(capTableService.createAutoSnapshot).toHaveBeenCalledWith(
        'company-1',
        'exercise_confirmed',
        expect.stringContaining('exercise confirmed'),
      );
    });

    it('should update existing shareholding instead of creating', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(pendingExercise());
      prisma.optionExerciseRequest.update.mockResolvedValue(mockExercise({ status: 'COMPLETED' }));
      prisma.optionGrant.update.mockResolvedValue(mockGrant());
      prisma.optionPlan.update.mockResolvedValue(mockPlan());
      prisma.shareholding.findFirst.mockResolvedValue({
        id: 'holding-1',
        quantity: new Prisma.Decimal('5000'),
      });
      prisma.shareholding.update.mockResolvedValue({ id: 'holding-1' });
      prisma.shareClass.update.mockResolvedValue(mockShareClass());

      await service.confirmExercisePayment('company-1', 'exercise-1', {}, 'user-1');

      expect(prisma.shareholding.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'holding-1' },
          data: expect.objectContaining({
            quantity: new Prisma.Decimal('7000'), // 5000 + 2000
          }),
        }),
      );
      expect(prisma.shareholding.create).not.toHaveBeenCalled();
    });

    it('should mark grant as EXERCISED when fully exercised', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(
        pendingExercise({
          quantity: new Prisma.Decimal('10000'),
          totalCost: new Prisma.Decimal('50000'),
          grant: {
            id: 'grant-1',
            planId: 'plan-1',
            shareholderId: 'sh-1',
            quantity: new Prisma.Decimal('10000'),
            exercised: new Prisma.Decimal('0'),
            plan: { shareClassId: 'sc-1' },
          },
        }),
      );
      prisma.optionExerciseRequest.update.mockResolvedValue(mockExercise({ status: 'COMPLETED' }));
      prisma.optionGrant.update.mockResolvedValue(mockGrant({ status: 'EXERCISED' }));
      prisma.optionPlan.update.mockResolvedValue(mockPlan());
      prisma.shareholding.findFirst.mockResolvedValue(null);
      prisma.shareholding.create.mockResolvedValue({ id: 'holding-1' });
      prisma.shareClass.update.mockResolvedValue(mockShareClass());

      await service.confirmExercisePayment('company-1', 'exercise-1', {}, 'user-1');

      expect(prisma.optionGrant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'EXERCISED',
          }),
        }),
      );
    });

    it('should throw NotFoundException if exercise not found', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(null);

      await expect(
        service.confirmExercisePayment('company-1', 'exercise-1', {}, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if already confirmed', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(
        pendingExercise({ status: 'COMPLETED' }),
      );

      await expect(
        service.confirmExercisePayment('company-1', 'exercise-1', {}, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if already cancelled', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(
        pendingExercise({ status: 'CANCELLED' }),
      );

      await expect(
        service.confirmExercisePayment('company-1', 'exercise-1', {}, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should throw BusinessRuleException if no shareholder linked', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(
        pendingExercise({
          grant: {
            id: 'grant-1',
            planId: 'plan-1',
            shareholderId: null,
            quantity: new Prisma.Decimal('10000'),
            exercised: new Prisma.Decimal('0'),
            plan: { shareClassId: 'sc-1' },
          },
        }),
      );

      await expect(
        service.confirmExercisePayment('company-1', 'exercise-1', {}, 'user-1'),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('cancelExercise', () => {
    beforeEach(() => {
      // Mock grantee validation: user-1 is linked to shareholder sh-1 (the grantee)
      prisma.shareholder.findFirst.mockResolvedValue({ id: 'sh-1' });
    });

    it('should cancel a pending exercise request', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(
        mockExercise({ grant: { shareholderId: 'sh-1' } }),
      );
      prisma.optionExerciseRequest.update.mockResolvedValue(mockExercise({ status: 'CANCELLED' }));

      const result = await service.cancelExercise('company-1', 'exercise-1', 'user-1');

      expect(result.status).toBe('CANCELLED');
      expect(prisma.optionExerciseRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('should throw NotFoundException if exercise not found', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(null);

      await expect(service.cancelExercise('company-1', 'exercise-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BusinessRuleException if already cancelled', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(
        mockExercise({ status: 'CANCELLED', grant: { shareholderId: 'sh-1' } }),
      );

      await expect(service.cancelExercise('company-1', 'exercise-1', 'user-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException if not pending', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(
        mockExercise({ status: 'COMPLETED', grant: { shareholderId: 'sh-1' } }),
      );

      await expect(service.cancelExercise('company-1', 'exercise-1', 'user-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should throw BusinessRuleException if user is not grantee or admin', async () => {
      prisma.optionExerciseRequest.findFirst.mockResolvedValue(
        mockExercise({ grant: { shareholderId: 'sh-1' } }),
      );
      // Not linked as shareholder
      prisma.shareholder.findFirst.mockResolvedValue(null);
      // Not an admin member
      prisma.companyMember.findFirst.mockResolvedValue(null);

      await expect(service.cancelExercise('company-1', 'exercise-1', 'user-1')).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  // ========================
  // Auto-Expiration
  // ========================

  describe('expireStaleGrants', () => {
    const expiredGrant = {
      id: 'grant-expired-1',
      companyId: 'company-1',
      planId: 'plan-1',
      quantity: new Prisma.Decimal('10000'),
      exercised: new Prisma.Decimal('2000'),
      employeeName: 'Maria Silva',
      shareholderId: 'sh-1',
      expirationDate: new Date('2025-12-31'),
    };

    it('should return 0 when no expired grants exist', async () => {
      prisma.optionGrant.findMany.mockResolvedValue([]);

      const result = await service.expireStaleGrants();

      expect(result).toBe(0);
      expect(prisma.optionGrant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE', expirationDate: { lt: expect.any(Date) } },
          take: 50,
        }),
      );
    });

    it('should expire a single grant and return count of 1', async () => {
      prisma.optionGrant.findMany
        .mockResolvedValueOnce([expiredGrant])
        .mockResolvedValueOnce([]); // no more in next batch
      prisma.optionGrant.update.mockResolvedValue({});
      prisma.optionPlan.update.mockResolvedValue({});
      prisma.optionExerciseRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.shareholder.findFirst.mockResolvedValue({ userId: 'user-1' });
      prisma.company.findUnique.mockResolvedValue({ name: 'Test Company' });

      const result = await service.expireStaleGrants();

      expect(result).toBe(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should update grant status to EXPIRED', async () => {
      prisma.optionGrant.findMany
        .mockResolvedValueOnce([expiredGrant])
        .mockResolvedValueOnce([]);
      prisma.optionGrant.update.mockResolvedValue({});
      prisma.optionPlan.update.mockResolvedValue({});
      prisma.optionExerciseRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await service.expireStaleGrants();

      expect(prisma.optionGrant.update).toHaveBeenCalledWith({
        where: { id: 'grant-expired-1' },
        data: { status: 'EXPIRED', terminatedAt: expect.any(Date) },
      });
    });

    it('should return unexercised options to the plan pool', async () => {
      prisma.optionGrant.findMany
        .mockResolvedValueOnce([expiredGrant])
        .mockResolvedValueOnce([]);
      prisma.optionGrant.update.mockResolvedValue({});
      prisma.optionPlan.update.mockResolvedValue({});
      prisma.optionExerciseRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await service.expireStaleGrants();

      // unexercised = 10000 - 2000 = 8000
      expect(prisma.optionPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: { totalGranted: { decrement: new Prisma.Decimal('8000') } },
      });
    });

    it('should not decrement pool when all options were exercised', async () => {
      const fullyExercised = {
        ...expiredGrant,
        exercised: new Prisma.Decimal('10000'),
      };
      prisma.optionGrant.findMany
        .mockResolvedValueOnce([fullyExercised])
        .mockResolvedValueOnce([]);
      prisma.optionGrant.update.mockResolvedValue({});
      prisma.optionExerciseRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await service.expireStaleGrants();

      // optionPlan.update should NOT be called since unexercised = 0
      expect(prisma.optionPlan.update).not.toHaveBeenCalled();
    });

    it('should cancel pending exercise requests', async () => {
      prisma.optionGrant.findMany
        .mockResolvedValueOnce([expiredGrant])
        .mockResolvedValueOnce([]);
      prisma.optionGrant.update.mockResolvedValue({});
      prisma.optionPlan.update.mockResolvedValue({});
      prisma.optionExerciseRequest.updateMany.mockResolvedValue({ count: 2 });
      prisma.shareholder.findFirst.mockResolvedValue(null);

      await service.expireStaleGrants();

      expect(prisma.optionExerciseRequest.updateMany).toHaveBeenCalledWith({
        where: { grantId: 'grant-expired-1', status: 'PENDING_PAYMENT' },
        data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
      });
    });

    it('should process multiple grants in a batch', async () => {
      const grant2 = {
        ...expiredGrant,
        id: 'grant-expired-2',
        planId: 'plan-2',
        quantity: new Prisma.Decimal('5000'),
        exercised: new Prisma.Decimal('0'),
      };
      prisma.optionGrant.findMany
        .mockResolvedValueOnce([expiredGrant, grant2])
        .mockResolvedValueOnce([]);
      prisma.optionGrant.update.mockResolvedValue({});
      prisma.optionPlan.update.mockResolvedValue({});
      prisma.optionExerciseRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.shareholder.findFirst.mockResolvedValue(null);

      const result = await service.expireStaleGrants();

      expect(result).toBe(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('should continue processing when one grant fails', async () => {
      const failingGrant = { ...expiredGrant, id: 'grant-fail' };
      const succeedingGrant = { ...expiredGrant, id: 'grant-ok' };

      prisma.optionGrant.findMany
        .mockResolvedValueOnce([failingGrant, succeedingGrant])
        .mockResolvedValueOnce([]);

      // First call to $transaction rejects, second succeeds
      prisma.$transaction
        .mockRejectedValueOnce(new Error('DB error'))
        .mockImplementationOnce((fn: any) => fn(prisma));
      prisma.optionGrant.update.mockResolvedValue({});
      prisma.optionPlan.update.mockResolvedValue({});
      prisma.optionExerciseRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.shareholder.findFirst.mockResolvedValue(null);

      const result = await service.expireStaleGrants();

      // Only the successful one counted
      expect(result).toBe(1);
    });

    it('should send notification when grantee has a linked userId', async () => {
      prisma.optionGrant.findMany
        .mockResolvedValueOnce([expiredGrant])
        .mockResolvedValueOnce([]);
      prisma.optionGrant.update.mockResolvedValue({});
      prisma.optionPlan.update.mockResolvedValue({});
      prisma.optionExerciseRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.shareholder.findFirst.mockResolvedValue({ userId: 'user-42' });
      prisma.company.findUnique.mockResolvedValue({ name: 'Acme Ltda.' });

      const notificationService = (service as any).notificationService;

      await service.expireStaleGrants();

      // Allow fire-and-forget to resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(notificationService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-42',
          notificationType: 'OPTIONS_EXPIRING',
          relatedEntityType: 'OptionGrant',
          relatedEntityId: 'grant-expired-1',
          companyId: 'company-1',
        }),
      );
    });

    it('should skip notification when grantee has no shareholderId', async () => {
      const noShareholderGrant = { ...expiredGrant, shareholderId: null };
      prisma.optionGrant.findMany
        .mockResolvedValueOnce([noShareholderGrant])
        .mockResolvedValueOnce([]);
      prisma.optionGrant.update.mockResolvedValue({});
      prisma.optionPlan.update.mockResolvedValue({});
      prisma.optionExerciseRequest.updateMany.mockResolvedValue({ count: 0 });

      const notificationService = (service as any).notificationService;

      await service.expireStaleGrants();
      await new Promise((r) => setTimeout(r, 10));

      expect(notificationService.create).not.toHaveBeenCalled();
    });

    it('should log audit event via AuditLogService', async () => {
      prisma.optionGrant.findMany
        .mockResolvedValueOnce([expiredGrant])
        .mockResolvedValueOnce([]);
      prisma.optionGrant.update.mockResolvedValue({});
      prisma.optionPlan.update.mockResolvedValue({});
      prisma.optionExerciseRequest.updateMany.mockResolvedValue({ count: 0 });
      prisma.shareholder.findFirst.mockResolvedValue(null);

      const auditLogService = (service as any).auditLogService;

      await service.expireStaleGrants();
      await new Promise((r) => setTimeout(r, 10));

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'SYSTEM',
          action: 'OPTION_GRANT_EXPIRED',
          resourceType: 'OptionGrant',
          resourceId: 'grant-expired-1',
          companyId: 'company-1',
          changes: {
            before: { status: 'ACTIVE' },
            after: { status: 'EXPIRED', unexercisedReturned: '8000' },
          },
        }),
      );
    });
  });
});
