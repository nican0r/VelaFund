import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BusinessRuleException,
} from '../common/filters/app-exception';
import { parseSort } from '../common/helpers/sort-parser';
import { CreateOptionPlanDto } from './dto/create-option-plan.dto';
import { UpdateOptionPlanDto } from './dto/update-option-plan.dto';
import { CreateOptionGrantDto } from './dto/create-option-grant.dto';
import {
  CreateExerciseRequestDto,
  ConfirmExercisePaymentDto,
} from './dto/create-exercise-request.dto';
import {
  ListOptionPlansQueryDto,
  ListOptionGrantsQueryDto,
} from './dto/list-option-plans-query.dto';
import { ListExerciseRequestsQueryDto } from './dto/list-exercise-requests-query.dto';
import { randomBytes } from 'crypto';
import { CapTableService } from '../cap-table/cap-table.service';

const PLAN_SORTABLE_FIELDS = ['createdAt', 'name', 'totalPoolSize', 'status'];
const GRANT_SORTABLE_FIELDS = ['grantDate', 'createdAt', 'quantity', 'status', 'employeeName'];
const EXERCISE_SORTABLE_FIELDS = ['createdAt', 'status', 'quantity'];

@Injectable()
export class OptionPlanService {
  private readonly logger = new Logger(OptionPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly capTableService: CapTableService,
  ) {}

  // ========================
  // Option Plan CRUD
  // ========================

  async createPlan(companyId: string, dto: CreateOptionPlanDto, userId: string) {
    // Validate company exists and is ACTIVE
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { id: true, status: true },
    });
    if (!company) throw new NotFoundException('company', companyId);
    if (company.status !== 'ACTIVE') {
      throw new BusinessRuleException(
        'OPT_COMPANY_NOT_ACTIVE',
        'errors.opt.companyNotActive',
      );
    }

    // Validate share class belongs to company
    const shareClass = await this.prisma.shareClass.findFirst({
      where: { id: dto.shareClassId, companyId },
      select: { id: true, className: true },
    });
    if (!shareClass) throw new NotFoundException('shareClass', dto.shareClassId);

    const totalPoolSize = new Prisma.Decimal(dto.totalPoolSize);
    if (totalPoolSize.lte(0)) {
      throw new BusinessRuleException(
        'OPT_INVALID_POOL_SIZE',
        'errors.opt.invalidPoolSize',
      );
    }

    return this.prisma.optionPlan.create({
      data: {
        companyId,
        name: dto.name,
        shareClassId: dto.shareClassId,
        totalPoolSize,
        boardApprovalDate: dto.boardApprovalDate
          ? new Date(dto.boardApprovalDate)
          : null,
        terminationPolicy: dto.terminationPolicy ?? 'FORFEITURE',
        exerciseWindowDays: dto.exerciseWindowDays ?? 90,
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  async findAllPlans(companyId: string, query: ListOptionPlansQueryDto) {
    const where: Prisma.OptionPlanWhereInput = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    const sortFields = parseSort(query.sort, PLAN_SORTABLE_FIELDS);
    const orderBy = sortFields.map((sf) => ({ [sf.field]: sf.direction }));

    const [items, total] = await Promise.all([
      this.prisma.optionPlan.findMany({
        where,
        orderBy,
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
        include: {
          shareClass: { select: { id: true, className: true, type: true } },
        },
      }),
      this.prisma.optionPlan.count({ where }),
    ]);

    return { items, total };
  }

  async findPlanById(companyId: string, planId: string) {
    const plan = await this.prisma.optionPlan.findFirst({
      where: { id: planId, companyId },
      include: {
        shareClass: { select: { id: true, className: true, type: true } },
      },
    });
    if (!plan) throw new NotFoundException('optionPlan', planId);

    // Get grant stats
    const grantStats = await this.prisma.optionGrant.aggregate({
      where: { planId, status: { not: 'CANCELLED' } },
      _sum: { quantity: true, exercised: true },
      _count: true,
    });

    const totalGranted = grantStats._sum.quantity ?? new Prisma.Decimal(0);
    const totalExercised = grantStats._sum.exercised ?? new Prisma.Decimal(0);
    const optionsAvailable = plan.totalPoolSize.sub(totalGranted);

    return {
      ...plan,
      totalGranted: totalGranted.toString(),
      totalExercised: totalExercised.toString(),
      optionsAvailable: optionsAvailable.toString(),
      activeGrantCount: grantStats._count,
    };
  }

  async updatePlan(companyId: string, planId: string, dto: UpdateOptionPlanDto) {
    const plan = await this.prisma.optionPlan.findFirst({
      where: { id: planId, companyId },
      select: { id: true, status: true, totalPoolSize: true, totalGranted: true },
    });
    if (!plan) throw new NotFoundException('optionPlan', planId);

    if (plan.status !== 'ACTIVE') {
      throw new BusinessRuleException(
        'OPT_PLAN_CLOSED',
        'errors.opt.planClosed',
      );
    }

    const data: Prisma.OptionPlanUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.terminationPolicy !== undefined) data.terminationPolicy = dto.terminationPolicy;
    if (dto.exerciseWindowDays !== undefined) data.exerciseWindowDays = dto.exerciseWindowDays;
    if (dto.boardApprovalDate !== undefined) {
      data.boardApprovalDate = new Date(dto.boardApprovalDate);
    }

    if (dto.totalPoolSize !== undefined) {
      const newPoolSize = new Prisma.Decimal(dto.totalPoolSize);
      if (newPoolSize.lte(0)) {
        throw new BusinessRuleException(
          'OPT_INVALID_POOL_SIZE',
          'errors.opt.invalidPoolSize',
        );
      }
      // Pool size can only increase (cannot shrink below granted amount)
      if (newPoolSize.lt(plan.totalGranted)) {
        throw new BusinessRuleException(
          'OPT_POOL_CANNOT_SHRINK',
          'errors.opt.poolCannotShrink',
          {
            currentGranted: plan.totalGranted.toString(),
            requested: dto.totalPoolSize,
          },
        );
      }
      data.totalPoolSize = newPoolSize;
    }

    return this.prisma.optionPlan.update({
      where: { id: planId },
      data,
    });
  }

  async closePlan(companyId: string, planId: string) {
    const plan = await this.prisma.optionPlan.findFirst({
      where: { id: planId, companyId },
      select: { id: true, status: true },
    });
    if (!plan) throw new NotFoundException('optionPlan', planId);

    if (plan.status !== 'ACTIVE') {
      throw new BusinessRuleException(
        'OPT_PLAN_ALREADY_CLOSED',
        'errors.opt.planAlreadyClosed',
      );
    }

    return this.prisma.optionPlan.update({
      where: { id: planId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
  }

  // ========================
  // Option Grant CRUD
  // ========================

  async createGrant(companyId: string, dto: CreateOptionGrantDto, userId: string) {
    // Validate plan exists, belongs to company, and is ACTIVE
    const plan = await this.prisma.optionPlan.findFirst({
      where: { id: dto.optionPlanId, companyId },
      select: {
        id: true,
        status: true,
        totalPoolSize: true,
        totalGranted: true,
        shareClassId: true,
      },
    });
    if (!plan) throw new NotFoundException('optionPlan', dto.optionPlanId);

    if (plan.status !== 'ACTIVE') {
      throw new BusinessRuleException(
        'OPT_PLAN_CLOSED',
        'errors.opt.planClosed',
      );
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    const strikePrice = new Prisma.Decimal(dto.strikePrice);

    if (quantity.lte(0)) {
      throw new BusinessRuleException(
        'OPT_INVALID_QUANTITY',
        'errors.opt.invalidQuantity',
      );
    }

    if (strikePrice.lte(0)) {
      throw new BusinessRuleException(
        'OPT_INVALID_STRIKE_PRICE',
        'errors.opt.invalidStrikePrice',
      );
    }

    // Check pool availability (sum non-cancelled grants)
    const grantedAgg = await this.prisma.optionGrant.aggregate({
      where: { planId: plan.id, status: { not: 'CANCELLED' } },
      _sum: { quantity: true },
    });
    const totalGranted = grantedAgg._sum.quantity ?? new Prisma.Decimal(0);
    const available = plan.totalPoolSize.sub(totalGranted);

    if (quantity.gt(available)) {
      throw new BusinessRuleException(
        'OPT_PLAN_EXHAUSTED',
        'errors.opt.planExhausted',
        {
          optionsAvailable: available.toString(),
          quantityRequested: dto.quantity,
        },
      );
    }

    // Validate shareholder if provided
    if (dto.shareholderId) {
      const shareholder = await this.prisma.shareholder.findFirst({
        where: { id: dto.shareholderId, companyId },
        select: { id: true },
      });
      if (!shareholder) throw new NotFoundException('shareholder', dto.shareholderId);
    }

    // Validate vesting params
    if (dto.cliffMonths > dto.vestingDurationMonths) {
      throw new BusinessRuleException(
        'OPT_CLIFF_EXCEEDS_VESTING',
        'errors.opt.cliffExceedsVesting',
        {
          cliffMonths: dto.cliffMonths,
          vestingDurationMonths: dto.vestingDurationMonths,
        },
      );
    }

    // Validate dates
    const grantDate = new Date(dto.grantDate);
    const expirationDate = new Date(dto.expirationDate);
    if (expirationDate <= grantDate) {
      throw new BusinessRuleException(
        'OPT_INVALID_EXPIRATION',
        'errors.opt.invalidExpiration',
      );
    }

    // Calculate cliff percentage based on cliff vs total vesting
    const cliffPercentage =
      dto.vestingDurationMonths > 0
        ? new Prisma.Decimal(dto.cliffMonths).div(dto.vestingDurationMonths).mul(100)
        : new Prisma.Decimal(0);

    // Create grant and update plan totalGranted atomically
    return this.prisma.$transaction(async (tx) => {
      const grant = await tx.optionGrant.create({
        data: {
          companyId,
          planId: plan.id,
          shareholderId: dto.shareholderId || null,
          employeeName: dto.employeeName,
          employeeEmail: dto.employeeEmail,
          quantity,
          strikePrice,
          grantDate,
          expirationDate,
          cliffMonths: dto.cliffMonths,
          vestingDurationMonths: dto.vestingDurationMonths,
          vestingFrequency: dto.vestingFrequency ?? 'MONTHLY',
          cliffPercentage,
          accelerationOnCoc: dto.accelerationOnCoc ?? false,
          notes: dto.notes,
          createdBy: userId,
        },
      });

      await tx.optionPlan.update({
        where: { id: plan.id },
        data: { totalGranted: totalGranted.add(quantity) },
      });

      return grant;
    });
  }

  async findAllGrants(companyId: string, query: ListOptionGrantsQueryDto) {
    const where: Prisma.OptionGrantWhereInput = { companyId };

    if (query.status) where.status = query.status;
    if (query.optionPlanId) where.planId = query.optionPlanId;
    if (query.shareholderId) where.shareholderId = query.shareholderId;

    const sortFields = parseSort(
      query.sort,
      GRANT_SORTABLE_FIELDS,
      { field: 'grantDate', direction: 'desc' },
    );
    const orderBy = sortFields.map((sf) => ({ [sf.field]: sf.direction }));

    const [items, total] = await Promise.all([
      this.prisma.optionGrant.findMany({
        where,
        orderBy,
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
        include: {
          plan: { select: { id: true, name: true } },
          shareholder: { select: { id: true, name: true } },
        },
      }),
      this.prisma.optionGrant.count({ where }),
    ]);

    // Enrich each grant with vesting info
    const enrichedItems = items.map((grant) => ({
      ...grant,
      vesting: this.calculateVesting(grant),
    }));

    return { items: enrichedItems, total };
  }

  async findGrantById(companyId: string, grantId: string) {
    const grant = await this.prisma.optionGrant.findFirst({
      where: { id: grantId, companyId },
      include: {
        plan: { select: { id: true, name: true, terminationPolicy: true, exerciseWindowDays: true } },
        shareholder: { select: { id: true, name: true } },
      },
    });
    if (!grant) throw new NotFoundException('optionGrant', grantId);

    return {
      ...grant,
      vesting: this.calculateVesting(grant),
    };
  }

  async getGrantVestingSchedule(companyId: string, grantId: string) {
    const grant = await this.prisma.optionGrant.findFirst({
      where: { id: grantId, companyId },
      include: {
        shareholder: { select: { id: true, name: true } },
      },
    });
    if (!grant) throw new NotFoundException('optionGrant', grantId);

    const vesting = this.calculateVesting(grant);
    const schedule = this.generateVestingSchedule(grant);

    return {
      grantId: grant.id,
      shareholderName: grant.shareholder?.name ?? grant.employeeName,
      totalOptions: grant.quantity.toString(),
      vestedOptions: vesting.vestedQuantity,
      unvestedOptions: vesting.unvestedQuantity,
      exercisedOptions: grant.exercised.toString(),
      exercisableOptions: vesting.exercisableQuantity,
      vestingPercentage: vesting.vestingPercentage,
      nextVestingDate: vesting.nextVestingDate,
      nextVestingAmount: vesting.nextVestingAmount,
      cliffDate: vesting.cliffDate,
      cliffMet: vesting.cliffMet,
      schedule,
    };
  }

  async cancelGrant(companyId: string, grantId: string) {
    const grant = await this.prisma.optionGrant.findFirst({
      where: { id: grantId, companyId },
      select: { id: true, status: true, quantity: true, exercised: true, planId: true },
    });
    if (!grant) throw new NotFoundException('optionGrant', grantId);

    if (grant.status === 'CANCELLED') {
      throw new BusinessRuleException(
        'OPT_GRANT_ALREADY_CANCELLED',
        'errors.opt.grantAlreadyCancelled',
      );
    }

    if (grant.status === 'EXERCISED') {
      throw new BusinessRuleException(
        'OPT_GRANT_TERMINATED',
        'errors.opt.grantTerminated',
      );
    }

    // Return unexercised options to the pool
    const unexercised = grant.quantity.sub(grant.exercised);

    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.optionGrant.update({
        where: { id: grantId },
        data: {
          status: 'CANCELLED',
          terminatedAt: new Date(),
        },
      });

      // Decrease plan totalGranted by unexercised amount
      await tx.optionPlan.update({
        where: { id: grant.planId },
        data: {
          totalGranted: { decrement: unexercised },
        },
      });

      return cancelled;
    });
  }

  // ========================
  // Option Exercise Requests
  // ========================

  async createExerciseRequest(
    companyId: string,
    grantId: string,
    dto: CreateExerciseRequestDto,
    userId: string,
  ) {
    // Validate grant exists and belongs to company
    const grant = await this.prisma.optionGrant.findFirst({
      where: { id: grantId, companyId },
      include: {
        plan: { select: { id: true, exerciseWindowDays: true, terminationPolicy: true, shareClassId: true } },
      },
    });
    if (!grant) throw new NotFoundException('optionGrant', grantId);

    // Service-level authorization: EMPLOYEE can only exercise their own grants
    // ADMINs can exercise any grant (BUG-2 fix)
    await this.validateGranteeOrAdmin(companyId, userId, grant.shareholderId);

    // Grant must be ACTIVE (CANCELLED/EXPIRED/EXERCISED cannot exercise)
    if (grant.status !== 'ACTIVE') {
      throw new BusinessRuleException(
        'OPT_GRANT_NOT_ACTIVE',
        'errors.opt.grantNotActive',
      );
    }

    // Check exercise window for terminated grants
    if (grant.terminatedAt) {
      const windowEnd = new Date(grant.terminatedAt);
      windowEnd.setDate(windowEnd.getDate() + grant.plan.exerciseWindowDays);
      if (new Date() > windowEnd) {
        throw new BusinessRuleException(
          'OPT_EXERCISE_WINDOW_CLOSED',
          'errors.opt.exerciseWindowClosed',
          { exerciseWindowDays: grant.plan.exerciseWindowDays },
        );
      }
    }

    const quantity = new Prisma.Decimal(dto.quantity);
    if (quantity.lte(0)) {
      throw new BusinessRuleException(
        'OPT_INVALID_QUANTITY',
        'errors.opt.invalidQuantity',
      );
    }

    // Validate quantity against vested options
    const vesting = this.calculateVesting(grant);
    const exercisable = new Prisma.Decimal(vesting.exercisableQuantity);
    if (quantity.gt(exercisable)) {
      throw new BusinessRuleException(
        'OPT_INSUFFICIENT_VESTED',
        'errors.opt.insufficientVested',
        {
          exercisableOptions: vesting.exercisableQuantity,
          requestedQuantity: dto.quantity,
        },
      );
    }

    // Check no pending exercise request exists for this grant
    const pendingExercise = await this.prisma.optionExerciseRequest.findFirst({
      where: { grantId, status: 'PENDING_PAYMENT' },
      select: { id: true },
    });
    if (pendingExercise) {
      throw new BusinessRuleException(
        'OPT_EXERCISE_PENDING',
        'errors.opt.exercisePending',
      );
    }

    // Calculate total cost
    const totalCost = quantity.mul(grant.strikePrice);

    // Generate unique payment reference: EX-YYYY-XXXXXX
    const year = new Date().getFullYear();
    const randomPart = randomBytes(3).toString('hex').toUpperCase();
    const paymentReference = `EX-${year}-${randomPart}`;

    return this.prisma.optionExerciseRequest.create({
      data: {
        grantId,
        quantity,
        totalCost,
        paymentReference,
        createdBy: userId,
      },
    });
  }

  async findAllExercises(companyId: string, query: ListExerciseRequestsQueryDto) {
    // Exercise requests are scoped to company through grants
    const where: Prisma.OptionExerciseRequestWhereInput = {
      grant: { companyId },
    };

    if (query.status) {
      where.status = query.status as any;
    }
    if (query.grantId) {
      where.grantId = query.grantId;
    }

    const sortFields = parseSort(query.sort, EXERCISE_SORTABLE_FIELDS);
    const orderBy = sortFields.map((sf) => ({ [sf.field]: sf.direction }));

    const [items, total] = await Promise.all([
      this.prisma.optionExerciseRequest.findMany({
        where,
        orderBy,
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
        include: {
          grant: {
            select: {
              id: true,
              employeeName: true,
              employeeEmail: true,
              strikePrice: true,
              plan: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.optionExerciseRequest.count({ where }),
    ]);

    return { items, total };
  }

  async findExerciseById(companyId: string, exerciseId: string) {
    const exercise = await this.prisma.optionExerciseRequest.findFirst({
      where: { id: exerciseId, grant: { companyId } },
      include: {
        grant: {
          select: {
            id: true,
            employeeName: true,
            employeeEmail: true,
            strikePrice: true,
            quantity: true,
            exercised: true,
            status: true,
            plan: { select: { id: true, name: true, shareClassId: true } },
            shareholder: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!exercise) throw new NotFoundException('optionExercise', exerciseId);
    return exercise;
  }

  async confirmExercisePayment(
    companyId: string,
    exerciseId: string,
    dto: ConfirmExercisePaymentDto,
    userId: string,
  ) {
    const exercise = await this.prisma.optionExerciseRequest.findFirst({
      where: { id: exerciseId, grant: { companyId } },
      include: {
        grant: {
          select: {
            id: true,
            planId: true,
            shareholderId: true,
            quantity: true,
            exercised: true,
            plan: { select: { shareClassId: true } },
          },
        },
      },
    });
    if (!exercise) throw new NotFoundException('optionExercise', exerciseId);

    if (exercise.status === 'COMPLETED' || exercise.status === 'PAYMENT_CONFIRMED' || exercise.status === 'SHARES_ISSUED') {
      throw new BusinessRuleException(
        'OPT_EXERCISE_ALREADY_CONFIRMED',
        'errors.opt.exerciseAlreadyConfirmed',
      );
    }

    if (exercise.status === 'CANCELLED') {
      throw new BusinessRuleException(
        'OPT_EXERCISE_ALREADY_CANCELLED',
        'errors.opt.exerciseAlreadyCancelled',
      );
    }

    if (exercise.status !== 'PENDING_PAYMENT') {
      throw new BusinessRuleException(
        'OPT_EXERCISE_NOT_PENDING',
        'errors.opt.exerciseNotPending',
      );
    }

    // Require shareholder to be linked for share issuance
    if (!exercise.grant.shareholderId) {
      throw new BusinessRuleException(
        'OPT_NO_SHAREHOLDER_LINKED',
        'errors.opt.noShareholderLinked',
      );
    }

    const exerciseQuantity = exercise.quantity;
    const newExercised = exercise.grant.exercised.add(exerciseQuantity);
    const fullyExercised = newExercised.gte(exercise.grant.quantity);
    const shareClassId = exercise.grant.plan.shareClassId;
    const shareholderId = exercise.grant.shareholderId;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update exercise request to COMPLETED (no blockchain, so skip SHARES_ISSUED)
      const confirmed = await tx.optionExerciseRequest.update({
        where: { id: exerciseId },
        data: {
          status: 'COMPLETED',
          confirmedBy: userId,
          confirmedAt: new Date(),
        },
      });

      // 2. Update grant exercised count
      await tx.optionGrant.update({
        where: { id: exercise.grantId },
        data: {
          exercised: newExercised,
          ...(fullyExercised ? { status: 'EXERCISED' } : {}),
        },
      });

      // 3. Update plan totalExercised
      await tx.optionPlan.update({
        where: { id: exercise.grant.planId },
        data: {
          totalExercised: { increment: exerciseQuantity },
        },
      });

      // 4. Cap table mutation: upsert Shareholding for the shareholder
      const existingHolding = await tx.shareholding.findFirst({
        where: { shareholderId, shareClassId },
      });

      if (existingHolding) {
        await tx.shareholding.update({
          where: { id: existingHolding.id },
          data: {
            quantity: existingHolding.quantity.add(exerciseQuantity),
          },
        });
      } else {
        await tx.shareholding.create({
          data: {
            companyId,
            shareholderId,
            shareClassId,
            quantity: exerciseQuantity,
            ownershipPct: new Prisma.Decimal(0),
            votingPowerPct: new Prisma.Decimal(0),
          },
        });
      }

      // 5. Increment ShareClass.totalIssued
      await tx.shareClass.update({
        where: { id: shareClassId },
        data: {
          totalIssued: { increment: exerciseQuantity },
        },
      });

      return confirmed;
    });

    // Recalculate ownership percentages after cap table mutation
    await this.capTableService.recalculateOwnership(companyId);

    // Create automatic cap table snapshot (fire-and-forget)
    await this.capTableService.createAutoSnapshot(
      companyId,
      'exercise_confirmed',
      `Option exercise confirmed`,
    );

    return result;
  }

  async cancelExercise(companyId: string, exerciseId: string, userId: string) {
    const exercise = await this.prisma.optionExerciseRequest.findFirst({
      where: { id: exerciseId, grant: { companyId } },
      select: { id: true, status: true, grant: { select: { shareholderId: true } } },
    });
    if (!exercise) throw new NotFoundException('optionExercise', exerciseId);

    // Service-level authorization: EMPLOYEE can only cancel their own exercises (BUG-2 fix)
    await this.validateGranteeOrAdmin(companyId, userId, exercise.grant.shareholderId);

    if (exercise.status === 'CANCELLED') {
      throw new BusinessRuleException(
        'OPT_EXERCISE_ALREADY_CANCELLED',
        'errors.opt.exerciseAlreadyCancelled',
      );
    }

    if (exercise.status !== 'PENDING_PAYMENT') {
      throw new BusinessRuleException(
        'OPT_EXERCISE_NOT_PENDING',
        'errors.opt.exerciseNotPending',
      );
    }

    return this.prisma.optionExerciseRequest.update({
      where: { id: exerciseId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
  }

  // ========================
  // Vesting Calculation
  // ========================

  calculateVesting(grant: {
    quantity: Prisma.Decimal;
    exercised: Prisma.Decimal;
    grantDate: Date;
    expirationDate: Date;
    cliffMonths: number;
    vestingDurationMonths: number;
    vestingFrequency: string;
    status: string;
  }) {
    const now = new Date();
    const grantDate = new Date(grant.grantDate);
    const cliffDate = this.addMonths(grantDate, grant.cliffMonths);
    const vestingEndDate = this.addMonths(grantDate, grant.vestingDurationMonths);
    const totalQuantity = grant.quantity;

    // If grant is not active, return current state
    if (grant.status !== 'ACTIVE') {
      const vestedQty = grant.status === 'EXERCISED' ? totalQuantity : new Prisma.Decimal(0);
      return {
        vestedQuantity: vestedQty.toString(),
        unvestedQuantity: totalQuantity.sub(vestedQty).toString(),
        exercisableQuantity: vestedQty.sub(grant.exercised).toString(),
        vestingPercentage: grant.status === 'EXERCISED' ? '100.00' : '0.00',
        cliffDate: cliffDate.toISOString(),
        cliffMet: grant.status === 'EXERCISED',
        nextVestingDate: null,
        nextVestingAmount: '0',
      };
    }

    // Before cliff: nothing vested
    if (now < cliffDate) {
      const cliffVestAmount = this.calculateCliffVestAmount(totalQuantity, grant.cliffMonths, grant.vestingDurationMonths);
      return {
        vestedQuantity: '0',
        unvestedQuantity: totalQuantity.toString(),
        exercisableQuantity: '0',
        vestingPercentage: '0.00',
        cliffDate: cliffDate.toISOString(),
        cliffMet: false,
        nextVestingDate: cliffDate.toISOString(),
        nextVestingAmount: cliffVestAmount.toString(),
      };
    }

    // Fully vested
    if (now >= vestingEndDate) {
      const exercisable = totalQuantity.sub(grant.exercised);
      return {
        vestedQuantity: totalQuantity.toString(),
        unvestedQuantity: '0',
        exercisableQuantity: exercisable.toString(),
        vestingPercentage: '100.00',
        cliffDate: cliffDate.toISOString(),
        cliffMet: true,
        nextVestingDate: null,
        nextVestingAmount: '0',
      };
    }

    // Cliff vesting
    const cliffVested = this.calculateCliffVestAmount(totalQuantity, grant.cliffMonths, grant.vestingDurationMonths);

    // Post-cliff linear vesting
    const monthsSinceCliff = this.monthsBetween(cliffDate, now);
    const periodMonths = this.frequencyToMonths(grant.vestingFrequency);
    const periodsElapsed = Math.floor(monthsSinceCliff / periodMonths);

    const postCliffMonths = grant.vestingDurationMonths - grant.cliffMonths;
    const totalPostCliffPeriods = Math.floor(postCliffMonths / periodMonths);
    const remainingAfterCliff = totalQuantity.sub(cliffVested);
    const vestingPerPeriod = totalPostCliffPeriods > 0
      ? remainingAfterCliff.div(totalPostCliffPeriods)
      : new Prisma.Decimal(0);

    const additionalVested = vestingPerPeriod.mul(periodsElapsed);
    let vestedQuantity = cliffVested.add(additionalVested);

    // Cap at total
    if (vestedQuantity.gt(totalQuantity)) {
      vestedQuantity = totalQuantity;
    }

    // Floor to whole numbers
    vestedQuantity = new Prisma.Decimal(vestedQuantity.toFixed(0, Prisma.Decimal.ROUND_DOWN));

    const unvestedQuantity = totalQuantity.sub(vestedQuantity);
    const exercisableQuantity = vestedQuantity.sub(grant.exercised);
    const vestingPercentage = totalQuantity.gt(0)
      ? vestedQuantity.div(totalQuantity).mul(100).toFixed(2)
      : '0.00';

    // Next vesting date
    const nextPeriodIndex = periodsElapsed + 1;
    const nextVestingDate = this.addMonths(cliffDate, nextPeriodIndex * periodMonths);
    const isNextBeforeEnd = nextVestingDate <= vestingEndDate;

    return {
      vestedQuantity: vestedQuantity.toString(),
      unvestedQuantity: unvestedQuantity.toString(),
      exercisableQuantity: exercisableQuantity.toString(),
      vestingPercentage,
      cliffDate: cliffDate.toISOString(),
      cliffMet: true,
      nextVestingDate: isNextBeforeEnd ? nextVestingDate.toISOString() : null,
      nextVestingAmount: isNextBeforeEnd ? vestingPerPeriod.toFixed(0, Prisma.Decimal.ROUND_DOWN) : '0',
    };
  }

  generateVestingSchedule(grant: {
    quantity: Prisma.Decimal;
    grantDate: Date;
    cliffMonths: number;
    vestingDurationMonths: number;
    vestingFrequency: string;
  }) {
    const grantDate = new Date(grant.grantDate);
    const totalQuantity = grant.quantity;
    const cliffDate = this.addMonths(grantDate, grant.cliffMonths);
    const vestingEndDate = this.addMonths(grantDate, grant.vestingDurationMonths);
    const periodMonths = this.frequencyToMonths(grant.vestingFrequency);

    const schedule: Array<{
      date: string;
      quantity: string;
      cumulative: string;
      type: string;
    }> = [];

    // Cliff entry
    const cliffVested = this.calculateCliffVestAmount(
      totalQuantity,
      grant.cliffMonths,
      grant.vestingDurationMonths,
    );

    if (grant.cliffMonths > 0) {
      schedule.push({
        date: cliffDate.toISOString(),
        quantity: cliffVested.toFixed(0, Prisma.Decimal.ROUND_DOWN),
        cumulative: cliffVested.toFixed(0, Prisma.Decimal.ROUND_DOWN),
        type: 'CLIFF',
      });
    }

    // Post-cliff periods
    const postCliffMonths = grant.vestingDurationMonths - grant.cliffMonths;
    const totalPeriods = Math.floor(postCliffMonths / periodMonths);
    const remainingAfterCliff = totalQuantity.sub(cliffVested);
    const vestingPerPeriod = totalPeriods > 0
      ? remainingAfterCliff.div(totalPeriods)
      : new Prisma.Decimal(0);

    let cumulative = cliffVested;

    for (let i = 1; i <= totalPeriods; i++) {
      const date = this.addMonths(cliffDate, i * periodMonths);
      if (date > vestingEndDate) break;

      // Last period gets remainder to avoid rounding issues
      const periodAmount =
        i === totalPeriods
          ? totalQuantity.sub(cumulative)
          : vestingPerPeriod;

      cumulative = cumulative.add(periodAmount);

      schedule.push({
        date: date.toISOString(),
        quantity: periodAmount.toFixed(0, Prisma.Decimal.ROUND_DOWN),
        cumulative: cumulative.toFixed(0, Prisma.Decimal.ROUND_DOWN),
        type: this.frequencyToType(grant.vestingFrequency),
      });
    }

    return schedule;
  }

  // ========================
  // Authorization Helpers
  // ========================

  /**
   * Validates that the current user is either the grantee (EMPLOYEE exercising
   * their own grant) or an ADMIN for the company (BUG-2 fix).
   * Checks Shareholder.userId link for grantee validation.
   */
  private async validateGranteeOrAdmin(
    companyId: string,
    userId: string,
    shareholderId: string | null,
  ): Promise<void> {
    // Check if the user is the grantee (shareholder linked to this user)
    if (shareholderId) {
      const shareholder = await this.prisma.shareholder.findFirst({
        where: { id: shareholderId, userId },
        select: { id: true },
      });

      if (shareholder) return; // User is the grantee — allowed
    }

    // Not the grantee — check if user is ADMIN for this company
    const member = await this.prisma.companyMember.findFirst({
      where: { companyId, userId, status: 'ACTIVE' },
      select: { role: true },
    });

    if (member?.role === 'ADMIN') return; // Admin — allowed

    // Neither grantee nor admin — deny
    throw new BusinessRuleException(
      'OPT_NOT_GRANTEE',
      'errors.opt.notGrantee',
    );
  }

  // ========================
  // Helpers
  // ========================

  private calculateCliffVestAmount(
    totalQuantity: Prisma.Decimal,
    cliffMonths: number,
    vestingDurationMonths: number,
  ): Prisma.Decimal {
    if (vestingDurationMonths === 0) return totalQuantity;
    return totalQuantity
      .mul(cliffMonths)
      .div(vestingDurationMonths);
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private monthsBetween(start: Date, end: Date): number {
    const years = end.getFullYear() - start.getFullYear();
    const months = end.getMonth() - start.getMonth();
    const days = end.getDate() - start.getDate();
    let total = years * 12 + months;
    if (days < 0) total -= 1;
    return Math.max(0, total);
  }

  private frequencyToMonths(frequency: string): number {
    switch (frequency) {
      case 'QUARTERLY':
        return 3;
      case 'ANNUALLY':
        return 12;
      case 'MONTHLY':
      default:
        return 1;
    }
  }

  private frequencyToType(frequency: string): string {
    switch (frequency) {
      case 'QUARTERLY':
        return 'QUARTERLY';
      case 'ANNUALLY':
        return 'ANNUAL';
      case 'MONTHLY':
      default:
        return 'MONTHLY';
    }
  }
}
