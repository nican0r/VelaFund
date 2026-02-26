import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseSort } from '../common/helpers/sort-parser';
import {
  NotFoundException,
  BusinessRuleException,
  ConflictException,
} from '../common/filters/app-exception';
import { CreateFundingRoundDto } from './dto/create-funding-round.dto';
import { UpdateFundingRoundDto } from './dto/update-funding-round.dto';
import { CreateCommitmentDto } from './dto/create-commitment.dto';
import {
  ListFundingRoundsQueryDto,
  ListCommitmentsQueryDto,
} from './dto/list-funding-rounds-query.dto';
import { UpdateCommitmentPaymentDto } from './dto/update-commitment-payment.dto';
import { CapTableService } from '../cap-table/cap-table.service';
import { NotificationService } from '../notification/notification.service';

/** Valid status transitions for funding rounds. */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSING', 'CANCELLED'],
  CLOSING: ['CLOSED', 'OPEN'],
  CLOSED: [],
  CANCELLED: [],
};

const ROUND_SORTABLE_FIELDS = ['createdAt', 'name', 'targetAmount', 'status'];

const COMMITMENT_SORTABLE_FIELDS = ['createdAt', 'amount', 'paymentStatus'];

@Injectable()
export class FundingRoundService {
  private readonly logger = new Logger(FundingRoundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly capTableService: CapTableService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new funding round in DRAFT status.
   *
   * Business rules:
   * - Company must exist and be ACTIVE
   * - Share class must belong to the company
   * - targetAmount must be positive
   * - pricePerShare must be positive
   * - preMoneyValuation must be positive
   * - minimumCloseAmount (if set) must be <= targetAmount
   * - hardCap (if set) must be >= targetAmount
   */
  async create(companyId: string, dto: CreateFundingRoundDto, createdBy: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, status: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    if (company.status !== 'ACTIVE') {
      throw new BusinessRuleException('ROUND_COMPANY_NOT_ACTIVE', 'errors.round.companyNotActive', {
        companyId,
        status: company.status,
      });
    }

    // Validate share class belongs to company
    const shareClass = await this.prisma.shareClass.findFirst({
      where: { id: dto.shareClassId, companyId },
    });
    if (!shareClass) {
      throw new NotFoundException('shareClass', dto.shareClassId);
    }

    const targetAmount = new Prisma.Decimal(dto.targetAmount);
    const pricePerShare = new Prisma.Decimal(dto.pricePerShare);
    const preMoneyValuation = new Prisma.Decimal(dto.preMoneyValuation);

    if (targetAmount.lte(0)) {
      throw new BusinessRuleException('ROUND_INVALID_AMOUNT', 'errors.round.invalidAmount', {
        field: 'targetAmount',
      });
    }

    if (pricePerShare.lte(0)) {
      throw new BusinessRuleException('ROUND_INVALID_AMOUNT', 'errors.round.invalidAmount', {
        field: 'pricePerShare',
      });
    }

    if (preMoneyValuation.lte(0)) {
      throw new BusinessRuleException('ROUND_INVALID_AMOUNT', 'errors.round.invalidAmount', {
        field: 'preMoneyValuation',
      });
    }

    const minimumCloseAmount = dto.minimumCloseAmount
      ? new Prisma.Decimal(dto.minimumCloseAmount)
      : null;

    if (minimumCloseAmount && minimumCloseAmount.gt(targetAmount)) {
      throw new BusinessRuleException(
        'ROUND_MINIMUM_EXCEEDS_TARGET',
        'errors.round.minimumExceedsTarget',
        {
          minimumCloseAmount: dto.minimumCloseAmount,
          targetAmount: dto.targetAmount,
        },
      );
    }

    const hardCap = dto.hardCap ? new Prisma.Decimal(dto.hardCap) : null;

    if (hardCap && hardCap.lt(targetAmount)) {
      throw new BusinessRuleException(
        'ROUND_HARD_CAP_BELOW_TARGET',
        'errors.round.hardCapBelowTarget',
        {
          hardCap: dto.hardCap,
          targetAmount: dto.targetAmount,
        },
      );
    }

    return this.prisma.fundingRound.create({
      data: {
        companyId,
        name: dto.name,
        roundType: dto.roundType,
        shareClassId: dto.shareClassId,
        targetAmount,
        minimumCloseAmount,
        hardCap,
        preMoneyValuation,
        pricePerShare,
        targetCloseDate: dto.targetCloseDate ? new Date(dto.targetCloseDate) : null,
        notes: dto.notes,
        createdBy,
      },
    });
  }

  /**
   * List funding rounds for a company with pagination, filtering, and sorting.
   */
  async findAll(companyId: string, query: ListFundingRoundsQueryDto) {
    const where: Prisma.FundingRoundWhereInput = { companyId };

    if (query.status) {
      where.status = query.status;
    }

    const sortFields = parseSort(query.sort, ROUND_SORTABLE_FIELDS);
    const orderBy = sortFields.map((sf) => ({
      [sf.field]: sf.direction,
    }));

    const [items, total] = await Promise.all([
      this.prisma.fundingRound.findMany({
        where,
        orderBy,
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
      }),
      this.prisma.fundingRound.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get a single funding round by ID.
   */
  async findById(companyId: string, roundId: string) {
    const round = await this.prisma.fundingRound.findFirst({
      where: { id: roundId, companyId },
      include: {
        shareClass: { select: { id: true, className: true, type: true } },
      },
    });

    if (!round) throw new NotFoundException('round', roundId);

    // Compute currentAmount and commitment count from non-CANCELLED commitments
    const [aggregate, commitmentCount] = await Promise.all([
      this.prisma.roundCommitment.aggregate({
        where: {
          roundId,
          paymentStatus: { not: 'CANCELLED' },
        },
        _sum: { amount: true },
      }),
      this.prisma.roundCommitment.count({
        where: { roundId, paymentStatus: { not: 'CANCELLED' } },
      }),
    ]);
    const currentAmount = aggregate._sum.amount ?? new Prisma.Decimal(0);

    // Compute post-money valuation
    const postMoneyValuation = round.preMoneyValuation.add(round.targetAmount);

    return {
      ...round,
      currentAmount: currentAmount.toString(),
      postMoneyValuation: postMoneyValuation.toString(),
      commitmentCount,
    };
  }

  /**
   * Update a funding round. Only allowed while status is DRAFT or OPEN.
   */
  async update(companyId: string, roundId: string, dto: UpdateFundingRoundDto) {
    const round = await this.prisma.fundingRound.findFirst({
      where: { id: roundId, companyId },
    });
    if (!round) throw new NotFoundException('round', roundId);

    if (round.status !== 'DRAFT' && round.status !== 'OPEN') {
      throw new BusinessRuleException('ROUND_NOT_OPEN', 'errors.round.notOpen', {
        status: round.status,
      });
    }

    const data: Prisma.FundingRoundUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.targetCloseDate !== undefined) {
      data.targetCloseDate = dto.targetCloseDate ? new Date(dto.targetCloseDate) : null;
    }

    if (dto.targetAmount !== undefined) {
      const val = new Prisma.Decimal(dto.targetAmount);
      if (val.lte(0)) {
        throw new BusinessRuleException('ROUND_INVALID_AMOUNT', 'errors.round.invalidAmount', {
          field: 'targetAmount',
        });
      }
      data.targetAmount = val;
    }

    if (dto.minimumCloseAmount !== undefined) {
      data.minimumCloseAmount = dto.minimumCloseAmount
        ? new Prisma.Decimal(dto.minimumCloseAmount)
        : null;
    }

    if (dto.hardCap !== undefined) {
      data.hardCap = dto.hardCap ? new Prisma.Decimal(dto.hardCap) : null;
    }

    if (dto.preMoneyValuation !== undefined) {
      const val = new Prisma.Decimal(dto.preMoneyValuation);
      if (val.lte(0)) {
        throw new BusinessRuleException('ROUND_INVALID_AMOUNT', 'errors.round.invalidAmount', {
          field: 'preMoneyValuation',
        });
      }
      data.preMoneyValuation = val;
    }

    if (dto.pricePerShare !== undefined) {
      const val = new Prisma.Decimal(dto.pricePerShare);
      if (val.lte(0)) {
        throw new BusinessRuleException('ROUND_INVALID_AMOUNT', 'errors.round.invalidAmount', {
          field: 'pricePerShare',
        });
      }
      data.pricePerShare = val;
    }

    return this.prisma.fundingRound.update({
      where: { id: roundId },
      data,
    });
  }

  /**
   * Open a DRAFT funding round for commitments.
   */
  async open(companyId: string, roundId: string) {
    const round = await this.prisma.fundingRound.findFirst({
      where: { id: roundId, companyId },
    });
    if (!round) throw new NotFoundException('round', roundId);

    if (!STATUS_TRANSITIONS[round.status]?.includes('OPEN')) {
      throw new BusinessRuleException(
        'ROUND_INVALID_STATUS_TRANSITION',
        'errors.round.invalidStatusTransition',
        { currentStatus: round.status, targetStatus: 'OPEN' },
      );
    }

    return this.prisma.fundingRound.update({
      where: { id: roundId },
      data: {
        status: 'OPEN',
        openedAt: new Date(),
      },
    });
  }

  /**
   * Cancel a funding round. All non-CANCELLED commitments are marked CANCELLED.
   * Cannot cancel CLOSED rounds.
   */
  async cancel(companyId: string, roundId: string) {
    const round = await this.prisma.fundingRound.findFirst({
      where: { id: roundId, companyId },
    });
    if (!round) throw new NotFoundException('round', roundId);

    if (!STATUS_TRANSITIONS[round.status]?.includes('CANCELLED')) {
      throw new BusinessRuleException('ROUND_ALREADY_CLOSED', 'errors.round.alreadyClosed', {
        status: round.status,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Cancel all non-cancelled commitments
      await tx.roundCommitment.updateMany({
        where: {
          roundId,
          paymentStatus: { not: 'CANCELLED' },
        },
        data: { paymentStatus: 'CANCELLED' },
      });

      return tx.fundingRound.update({
        where: { id: roundId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });
    });
  }

  /**
   * Close a funding round. Issues shares to all confirmed investors.
   *
   * Business rules:
   * - Round must be OPEN or CLOSING
   * - All commitments must have paymentStatus = CONFIRMED
   * - Total committed must meet minimumCloseAmount (if set)
   * - Creates Shareholding records and ISSUANCE transactions atomically
   */
  async close(companyId: string, roundId: string) {
    const round = await this.prisma.fundingRound.findFirst({
      where: { id: roundId, companyId },
      include: {
        commitments: {
          include: {
            shareholder: { select: { id: true, name: true } },
          },
        },
        shareClass: { select: { id: true, totalAuthorized: true, totalIssued: true } },
      },
    });
    if (!round) throw new NotFoundException('round', roundId);

    if (round.status !== 'OPEN' && round.status !== 'CLOSING') {
      throw new BusinessRuleException('ROUND_ALREADY_CLOSED', 'errors.round.alreadyClosed', {
        status: round.status,
      });
    }

    // Check for unconfirmed payments
    const nonCancelledCommitments = round.commitments.filter(
      (c) => c.paymentStatus !== 'CANCELLED',
    );

    if (nonCancelledCommitments.length === 0) {
      throw new BusinessRuleException('ROUND_NO_COMMITMENTS', 'errors.round.noCommitments');
    }

    const unconfirmed = nonCancelledCommitments.filter((c) => c.paymentStatus !== 'CONFIRMED');
    if (unconfirmed.length > 0) {
      throw new BusinessRuleException(
        'ROUND_UNCONFIRMED_PAYMENTS',
        'errors.round.unconfirmedPayments',
        {
          unconfirmedCount: unconfirmed.length,
          unconfirmedIds: unconfirmed.map((c) => c.id),
        },
      );
    }

    // Calculate total committed from CONFIRMED commitments
    const totalCommitted = nonCancelledCommitments.reduce(
      (sum, c) => sum.add(c.amount),
      new Prisma.Decimal(0),
    );

    // Check minimum close amount
    if (round.minimumCloseAmount && totalCommitted.lt(round.minimumCloseAmount)) {
      throw new BusinessRuleException('ROUND_MINIMUM_NOT_MET', 'errors.round.minimumNotMet', {
        minimumCloseAmount: round.minimumCloseAmount.toString(),
        currentAmount: totalCommitted.toString(),
      });
    }

    // Calculate total shares to issue
    const totalShares = totalCommitted.div(round.pricePerShare);

    // Check authorized shares capacity
    if (round.shareClass.totalAuthorized) {
      const newTotalIssued = (round.shareClass.totalIssued ?? new Prisma.Decimal(0)).add(
        totalShares,
      );
      if (newTotalIssued.gt(round.shareClass.totalAuthorized)) {
        throw new BusinessRuleException(
          'ROUND_EXCEEDS_AUTHORIZED',
          'errors.round.exceedsAuthorized',
          {
            totalAuthorized: round.shareClass.totalAuthorized.toString(),
            currentIssued: (round.shareClass.totalIssued ?? new Prisma.Decimal(0)).toString(),
            newShares: totalShares.toString(),
          },
        );
      }
    }

    // Execute close atomically
    const result = await this.prisma.$transaction(async (tx) => {
      // Create issuance transactions and update shareholdings for each investor
      for (const commitment of nonCancelledCommitments) {
        const sharesToIssue = commitment.amount.div(round.pricePerShare);

        // Update shares allocated on the commitment
        await tx.roundCommitment.update({
          where: { id: commitment.id },
          data: { sharesAllocated: sharesToIssue },
        });

        // Create a share issuance transaction
        await tx.transaction.create({
          data: {
            companyId,
            type: 'ISSUANCE',
            shareClassId: round.shareClassId,
            toShareholderId: commitment.shareholderId,
            quantity: sharesToIssue,
            pricePerShare: round.pricePerShare,
            status: 'CONFIRMED',
            notes: `Round close: ${round.name}`,
            createdBy: round.createdBy,
            confirmedAt: new Date(),
          },
        });

        // Upsert shareholding
        const existing = await tx.shareholding.findFirst({
          where: {
            shareholderId: commitment.shareholderId,
            shareClassId: round.shareClassId,
          },
        });

        if (existing) {
          await tx.shareholding.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity.add(sharesToIssue),
            },
          });
        } else {
          await tx.shareholding.create({
            data: {
              companyId,
              shareholderId: commitment.shareholderId,
              shareClassId: round.shareClassId,
              quantity: sharesToIssue,
              ownershipPct: new Prisma.Decimal(0),
              votingPowerPct: new Prisma.Decimal(0),
            },
          });
        }
      }

      // Update share class totalIssued
      await tx.shareClass.update({
        where: { id: round.shareClassId },
        data: {
          totalIssued: (round.shareClass.totalIssued ?? new Prisma.Decimal(0)).add(totalShares),
        },
      });

      // Record the close
      await tx.roundClose.create({
        data: {
          roundId,
          closeDate: new Date(),
          amount: totalCommitted,
          shares: totalShares,
          notes: `Final close — ${nonCancelledCommitments.length} investor(s)`,
        },
      });

      // Update round status
      const updatedRound = await tx.fundingRound.update({
        where: { id: roundId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
        },
      });

      return {
        ...updatedRound,
        totalRaised: totalCommitted.toString(),
        totalSharesIssued: totalShares.toString(),
        investorCount: nonCancelledCommitments.length,
      };
    });

    // Recalculate ownership percentages after cap table mutation
    await this.capTableService.recalculateOwnership(companyId);

    // Create automatic cap table snapshot (fire-and-forget)
    await this.capTableService.createAutoSnapshot(
      companyId,
      'funding_round_closed',
      `Funding round ${round.name} closed`,
    );

    // Fire-and-forget: notify admins about round closure
    this.notifyRoundClosed(companyId, round, nonCancelledCommitments).catch((err) =>
      this.logger.warn(`Failed to send round closed notification: ${err.message}`),
    );

    return result;
  }

  // =====================
  // Commitment Operations
  // =====================

  /**
   * Add an investor commitment to a funding round.
   *
   * Business rules:
   * - Round must be OPEN
   * - Shareholder must exist in the company
   * - Shareholder cannot have an existing non-cancelled commitment
   * - Amount must be positive
   * - Total commitments cannot exceed hard cap (if set)
   */
  async addCommitment(companyId: string, roundId: string, dto: CreateCommitmentDto) {
    const round = await this.prisma.fundingRound.findFirst({
      where: { id: roundId, companyId },
    });
    if (!round) throw new NotFoundException('round', roundId);

    if (round.status !== 'OPEN') {
      throw new BusinessRuleException('ROUND_NOT_OPEN', 'errors.round.notOpen', {
        status: round.status,
      });
    }

    // Validate shareholder exists in company
    const shareholder = await this.prisma.shareholder.findFirst({
      where: { id: dto.shareholderId, companyId, status: 'ACTIVE' },
    });
    if (!shareholder) {
      throw new NotFoundException('shareholder', dto.shareholderId);
    }

    const amount = new Prisma.Decimal(dto.committedAmount);
    if (amount.lte(0)) {
      throw new BusinessRuleException('ROUND_INVALID_AMOUNT', 'errors.round.invalidAmount', {
        field: 'committedAmount',
      });
    }

    // Check for existing non-cancelled commitment
    const existing = await this.prisma.roundCommitment.findFirst({
      where: {
        roundId,
        shareholderId: dto.shareholderId,
        paymentStatus: { not: 'CANCELLED' },
      },
    });
    if (existing) {
      throw new ConflictException('ROUND_COMMITMENT_EXISTS', 'errors.round.commitmentExists', {
        shareholderId: dto.shareholderId,
      });
    }

    // Check hard cap
    const capToCheck = round.hardCap ?? round.targetAmount;
    const aggregate = await this.prisma.roundCommitment.aggregate({
      where: {
        roundId,
        paymentStatus: { not: 'CANCELLED' },
      },
      _sum: { amount: true },
    });
    const currentTotal = aggregate._sum.amount ?? new Prisma.Decimal(0);

    if (currentTotal.add(amount).gt(capToCheck)) {
      throw new BusinessRuleException('ROUND_HARD_CAP_REACHED', 'errors.round.hardCapReached', {
        hardCap: capToCheck.toString(),
        currentAmount: currentTotal.toString(),
        requestedAmount: amount.toString(),
      });
    }

    // Calculate shares allocated
    const sharesAllocated = amount.div(round.pricePerShare);

    return this.prisma.roundCommitment.create({
      data: {
        roundId,
        shareholderId: dto.shareholderId,
        amount,
        sharesAllocated,
        hasSideLetter: dto.hasSideLetter ?? false,
        notes: dto.notes,
      },
    });
  }

  /**
   * List commitments for a funding round.
   */
  async findCommitments(companyId: string, roundId: string, query: ListCommitmentsQueryDto) {
    // Verify round belongs to company
    const round = await this.prisma.fundingRound.findFirst({
      where: { id: roundId, companyId },
      select: { id: true },
    });
    if (!round) throw new NotFoundException('round', roundId);

    const where: Prisma.RoundCommitmentWhereInput = { roundId };

    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus;
    }

    const sortFields = parseSort(query.sort, COMMITMENT_SORTABLE_FIELDS);
    const orderBy = sortFields.map((sf) => ({
      [sf.field]: sf.direction,
    }));

    const [items, total] = await Promise.all([
      this.prisma.roundCommitment.findMany({
        where,
        orderBy,
        skip: ((query.page ?? 1) - 1) * (query.limit ?? 20),
        take: query.limit ?? 20,
        include: {
          shareholder: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      this.prisma.roundCommitment.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Update commitment payment status.
   * Valid transitions: PENDING → RECEIVED → CONFIRMED
   */
  async updateCommitmentPayment(
    companyId: string,
    roundId: string,
    commitmentId: string,
    dto: UpdateCommitmentPaymentDto,
  ) {
    const round = await this.prisma.fundingRound.findFirst({
      where: { id: roundId, companyId },
      select: { id: true, status: true },
    });
    if (!round) throw new NotFoundException('round', roundId);

    const commitment = await this.prisma.roundCommitment.findFirst({
      where: { id: commitmentId, roundId },
    });
    if (!commitment) {
      throw new NotFoundException('commitment', commitmentId);
    }

    if (commitment.paymentStatus === 'CANCELLED') {
      throw new BusinessRuleException(
        'ROUND_COMMITMENT_CANCELLED',
        'errors.round.commitmentCancelled',
        { commitmentId },
      );
    }

    if (commitment.paymentStatus === 'CONFIRMED') {
      throw new BusinessRuleException(
        'ROUND_COMMITMENT_ALREADY_CONFIRMED',
        'errors.round.commitmentAlreadyConfirmed',
        { commitmentId },
      );
    }

    // Validate transition: PENDING → RECEIVED → CONFIRMED
    const validTransitions: Record<string, string[]> = {
      PENDING: ['RECEIVED', 'CONFIRMED'],
      RECEIVED: ['CONFIRMED'],
    };

    if (!validTransitions[commitment.paymentStatus]?.includes(dto.paymentStatus)) {
      throw new BusinessRuleException(
        'ROUND_INVALID_PAYMENT_TRANSITION',
        'errors.round.invalidPaymentTransition',
        {
          currentStatus: commitment.paymentStatus,
          targetStatus: dto.paymentStatus,
        },
      );
    }

    const data: Prisma.RoundCommitmentUpdateInput = {
      paymentStatus: dto.paymentStatus,
    };

    if (dto.paymentStatus === 'CONFIRMED') {
      data.paymentConfirmedAt = new Date();
    }

    if (dto.notes) {
      data.notes = dto.notes;
    }

    return this.prisma.roundCommitment.update({
      where: { id: commitmentId },
      data,
    });
  }

  /**
   * Cancel a specific commitment.
   */
  async cancelCommitment(companyId: string, roundId: string, commitmentId: string) {
    const round = await this.prisma.fundingRound.findFirst({
      where: { id: roundId, companyId },
      select: { id: true, status: true },
    });
    if (!round) throw new NotFoundException('round', roundId);

    if (round.status === 'CLOSED') {
      throw new BusinessRuleException('ROUND_ALREADY_CLOSED', 'errors.round.alreadyClosed', {
        status: round.status,
      });
    }

    const commitment = await this.prisma.roundCommitment.findFirst({
      where: { id: commitmentId, roundId },
    });
    if (!commitment) {
      throw new NotFoundException('commitment', commitmentId);
    }

    if (commitment.paymentStatus === 'CANCELLED') {
      throw new BusinessRuleException(
        'ROUND_COMMITMENT_CANCELLED',
        'errors.round.commitmentCancelled',
        { commitmentId },
      );
    }

    return this.prisma.roundCommitment.update({
      where: { id: commitmentId },
      data: { paymentStatus: 'CANCELLED' },
    });
  }

  /**
   * Get pro-forma cap table showing before/after round impact.
   */
  async getProforma(companyId: string, roundId: string) {
    const round = await this.prisma.fundingRound.findFirst({
      where: { id: roundId, companyId },
      include: {
        commitments: {
          where: { paymentStatus: { not: 'CANCELLED' } },
          include: {
            shareholder: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!round) throw new NotFoundException('round', roundId);

    // Get current shareholdings
    const currentShareholdings = await this.prisma.shareholding.findMany({
      where: { companyId },
      include: {
        shareholder: { select: { id: true, name: true } },
        shareClass: { select: { id: true, className: true } },
      },
    });

    // Calculate current totals
    const currentTotalShares = currentShareholdings.reduce(
      (sum, s) => sum.add(s.quantity),
      new Prisma.Decimal(0),
    );

    // Build before-round snapshot
    const beforeShareholders = currentShareholdings.map((s) => ({
      shareholderId: s.shareholderId,
      name: s.shareholder.name,
      shares: s.quantity.toString(),
      percentage: currentTotalShares.gt(0)
        ? s.quantity.mul(100).div(currentTotalShares).toDecimalPlaces(4).toString()
        : '0',
    }));

    // Calculate new shares from commitments
    const newSharesByInvestor: Record<string, { name: string; shares: Prisma.Decimal }> = {};

    for (const commitment of round.commitments) {
      const shares = commitment.amount.div(round.pricePerShare);
      newSharesByInvestor[commitment.shareholderId] = {
        name: commitment.shareholder.name,
        shares,
      };
    }

    const totalNewShares = Object.values(newSharesByInvestor).reduce(
      (sum, v) => sum.add(v.shares),
      new Prisma.Decimal(0),
    );

    const afterTotalShares = currentTotalShares.add(totalNewShares);

    // Build after-round snapshot (merge existing + new)
    const afterMap = new Map<string, { name: string; shares: Prisma.Decimal }>();

    for (const s of currentShareholdings) {
      const key = s.shareholderId;
      if (afterMap.has(key)) {
        afterMap.get(key)!.shares = afterMap.get(key)!.shares.add(s.quantity);
      } else {
        afterMap.set(key, {
          name: s.shareholder.name,
          shares: new Prisma.Decimal(s.quantity.toString()),
        });
      }
    }

    for (const [shId, data] of Object.entries(newSharesByInvestor)) {
      if (afterMap.has(shId)) {
        afterMap.get(shId)!.shares = afterMap.get(shId)!.shares.add(data.shares);
      } else {
        afterMap.set(shId, {
          name: data.name,
          shares: new Prisma.Decimal(data.shares.toString()),
        });
      }
    }

    const afterShareholders = Array.from(afterMap.entries()).map(([shId, data]) => ({
      shareholderId: shId,
      name: data.name,
      shares: data.shares.toString(),
      percentage: afterTotalShares.gt(0)
        ? data.shares.mul(100).div(afterTotalShares).toDecimalPlaces(4).toString()
        : '0',
    }));

    // Compute dilution per existing shareholder
    const dilution: Record<string, { before: string; after: string; change: string }> = {};

    for (const before of beforeShareholders) {
      const after = afterShareholders.find((a) => a.shareholderId === before.shareholderId);
      if (after) {
        const beforePct = new Prisma.Decimal(before.percentage);
        const afterPct = new Prisma.Decimal(after.percentage);
        dilution[before.name] = {
          before: before.percentage,
          after: after.percentage,
          change: afterPct.sub(beforePct).toDecimalPlaces(4).toString(),
        };
      }
    }

    return {
      beforeRound: {
        totalShares: currentTotalShares.toString(),
        shareholders: beforeShareholders,
      },
      afterRound: {
        totalShares: afterTotalShares.toString(),
        shareholders: afterShareholders,
      },
      dilution,
    };
  }

  /**
   * Sends ROUND_CLOSED notifications to company admins after a round is closed.
   */
  private async notifyRoundClosed(
    companyId: string,
    round: { id: string; name: string },
    commitments: Array<{ shareholderId: string }>,
  ): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    const adminMembers = await this.prisma.companyMember.findMany({
      where: { companyId, role: 'ADMIN', status: 'ACTIVE' },
      select: { userId: true },
    });

    const investorCount = commitments.length;
    const subject = `Funding round closed — ${round.name}`;
    const body = `Funding round "${round.name}" has been closed with ${investorCount} investor(s). Shares have been issued.`;

    for (const member of adminMembers) {
      if (!member.userId) continue;
      await this.notificationService.create({
        userId: member.userId,
        notificationType: 'ROUND_CLOSED',
        subject,
        body,
        relatedEntityType: 'FundingRound',
        relatedEntityId: round.id,
        companyId,
        companyName: company?.name ?? undefined,
      });
    }
  }
}
