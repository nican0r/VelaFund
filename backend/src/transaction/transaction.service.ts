import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CapTableService } from '../cap-table/cap-table.service';
import { NotificationService } from '../notification/notification.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { parseSort } from '../common/helpers/sort-parser';
import { NotFoundException, BusinessRuleException } from '../common/filters/app-exception';
import { CreateTransactionDto, TransactionTypeDto } from './dto/create-transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';

/** Valid status transitions for transactions. */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'SUBMITTED', 'CANCELLED'],
  PENDING_APPROVAL: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['CONFIRMED', 'FAILED', 'CANCELLED'],
  FAILED: ['SUBMITTED', 'CANCELLED'],
  CONFIRMED: [],
  CANCELLED: [],
};

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly capTableService: CapTableService,
    private readonly notificationService: NotificationService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Create a new transaction.
   *
   * Business rules:
   * - Company must exist and be ACTIVE
   * - Share class must belong to the company
   * - Quantity must be positive
   * - ISSUANCE: toShareholderId required, cannot exceed authorized shares
   * - TRANSFER: fromShareholderId + toShareholderId required, sufficient balance
   * - CANCELLATION: fromShareholderId required, sufficient balance
   * - CONVERSION: fromShareholderId + toShareClassId required, sufficient balance
   * - If requiresBoardApproval, starts as PENDING_APPROVAL; otherwise DRAFT
   */
  async create(companyId: string, dto: CreateTransactionDto, createdBy: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, status: true, entityType: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    if (company.status !== 'ACTIVE') {
      throw new BusinessRuleException('TXN_COMPANY_NOT_ACTIVE', 'errors.txn.companyNotActive', {
        companyId,
        status: company.status,
      });
    }

    // BR-2: S.A. companies must have at least one COMMON_SHARES class before any issuance
    if (
      dto.type === TransactionTypeDto.ISSUANCE &&
      (company.entityType === 'SA_CAPITAL_FECHADO' || company.entityType === 'SA_CAPITAL_ABERTO')
    ) {
      const commonSharesCount = await this.prisma.shareClass.count({
        where: { companyId, type: 'COMMON_SHARES' },
      });
      if (commonSharesCount === 0) {
        throw new BusinessRuleException(
          'CAP_MISSING_COMMON_SHARES',
          'errors.cap.missingCommonShares',
          { companyId, entityType: company.entityType },
        );
      }
    }

    // Validate share class belongs to company
    const shareClass = await this.prisma.shareClass.findFirst({
      where: { id: dto.shareClassId, companyId },
    });
    if (!shareClass) {
      throw new NotFoundException('shareClass', dto.shareClassId);
    }

    // Parse and validate quantity
    const quantity = new Prisma.Decimal(dto.quantity);
    if (quantity.lte(0)) {
      throw new BusinessRuleException('TXN_INVALID_QUANTITY', 'errors.txn.invalidQuantity', {
        quantity: dto.quantity,
      });
    }

    // Type-specific validations
    await this.validateByType(companyId, dto, quantity, shareClass);

    // Calculate total value
    const pricePerShare = dto.pricePerShare ? new Prisma.Decimal(dto.pricePerShare) : null;
    const totalValue = pricePerShare ? quantity.mul(pricePerShare) : null;

    // Build notes: merge user-provided notes with metadata for CONVERSION/SPLIT
    const notesData = this.buildNotes(dto);

    const transaction = await this.prisma.transaction.create({
      data: {
        companyId,
        type: dto.type,
        status: dto.requiresBoardApproval ? 'PENDING_APPROVAL' : 'DRAFT',
        fromShareholderId: dto.fromShareholderId ?? null,
        toShareholderId: dto.toShareholderId ?? null,
        shareClassId: dto.shareClassId,
        quantity,
        pricePerShare,
        totalValue,
        notes: notesData,
        requiresBoardApproval: dto.requiresBoardApproval ?? false,
        createdBy,
      },
      include: {
        fromShareholder: {
          select: { id: true, name: true, type: true },
        },
        toShareholder: {
          select: { id: true, name: true, type: true },
        },
        shareClass: {
          select: { id: true, className: true, type: true },
        },
      },
    });

    this.logger.log(
      `Transaction ${transaction.id} created: ${dto.type} ${dto.quantity} shares ` +
        `(class ${shareClass.className}) in company ${companyId}`,
    );

    return this.formatTransactionResponse(transaction);
  }

  /**
   * List transactions for a company with filtering, sorting, and pagination.
   */
  async findAll(companyId: string, query: ListTransactionsQueryDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    const where: Prisma.TransactionWhereInput = { companyId };

    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.shareClassId) where.shareClassId = query.shareClassId;
    if (query.shareholderId) {
      where.OR = [
        { fromShareholderId: query.shareholderId },
        { toShareholderId: query.shareholderId },
      ];
    }
    if (query.createdAfter || query.createdBefore) {
      where.createdAt = {};
      if (query.createdAfter) {
        where.createdAt.gte = new Date(query.createdAfter);
      }
      if (query.createdBefore) {
        where.createdAt.lte = new Date(query.createdBefore);
      }
    }

    const sortFields = parseSort(query.sort, ['createdAt', 'type', 'status', 'quantity'], {
      field: 'createdAt',
      direction: 'desc',
    });

    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          fromShareholder: {
            select: { id: true, name: true, type: true },
          },
          toShareholder: {
            select: { id: true, name: true, type: true },
          },
          shareClass: {
            select: { id: true, className: true, type: true },
          },
        },
        orderBy: sortFields.map((sf) => ({ [sf.field]: sf.direction })),
        skip,
        take,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((t) => this.formatTransactionResponse(t)),
      total,
    };
  }

  /**
   * Get a single transaction by ID.
   */
  async findById(companyId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, companyId },
      include: {
        fromShareholder: {
          select: { id: true, name: true, type: true },
        },
        toShareholder: {
          select: { id: true, name: true, type: true },
        },
        shareClass: {
          select: { id: true, className: true, type: true },
        },
        blockchainTransactions: {
          select: {
            id: true,
            txHash: true,
            status: true,
            confirmedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('transaction', transactionId);
    }

    return this.formatTransactionDetailResponse(transaction);
  }

  /**
   * Approve a transaction (PENDING_APPROVAL -> SUBMITTED).
   *
   * Only transactions in PENDING_APPROVAL status can be approved.
   * If the transaction is in DRAFT and does not require board approval,
   * this will also work (DRAFT -> SUBMITTED).
   */
  async approve(companyId: string, transactionId: string, approvedBy: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, companyId },
    });

    if (!transaction) {
      throw new NotFoundException('transaction', transactionId);
    }

    if (transaction.status !== 'PENDING_APPROVAL' && transaction.status !== 'DRAFT') {
      throw new BusinessRuleException(
        'TXN_INVALID_STATUS_TRANSITION',
        'errors.txn.invalidStatusTransition',
        {
          currentStatus: transaction.status,
          targetStatus: 'SUBMITTED',
        },
      );
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'SUBMITTED',
        approvedBy,
        approvedAt: new Date(),
      },
      include: {
        fromShareholder: {
          select: { id: true, name: true, type: true },
        },
        toShareholder: {
          select: { id: true, name: true, type: true },
        },
        shareClass: {
          select: { id: true, className: true, type: true },
        },
      },
    });

    this.logger.log(
      `Transaction ${transactionId} approved by ${approvedBy} in company ${companyId}`,
    );

    return this.formatTransactionResponse(updated);
  }

  /**
   * Confirm a transaction (SUBMITTED -> CONFIRMED).
   *
   * This executes the transaction: updates Shareholding records and
   * recalculates ownership percentages. Uses $transaction for atomicity.
   */
  async confirm(companyId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, companyId },
      include: {
        shareClass: { select: { id: true, totalIssued: true, totalAuthorized: true } },
      },
    });

    if (!transaction) {
      throw new NotFoundException('transaction', transactionId);
    }

    if (transaction.status !== 'SUBMITTED') {
      throw new BusinessRuleException(
        'TXN_INVALID_STATUS_TRANSITION',
        'errors.txn.invalidStatusTransition',
        { currentStatus: transaction.status, targetStatus: 'CONFIRMED' },
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Execute the cap table mutation based on type
      await this.executeTransaction(tx, transaction);

      // Mark as confirmed
      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });
    });

    // Recalculate ownership percentages after cap table mutation
    await this.capTableService.recalculateOwnership(companyId);

    // Create automatic cap table snapshot (fire-and-forget)
    await this.capTableService.createAutoSnapshot(
      companyId,
      'transaction_confirmed',
      `Transaction ${transaction.type} confirmed`,
    );

    this.logger.log(`Transaction ${transactionId} confirmed in company ${companyId}`);

    // Fire-and-forget: programmatic audit logging with type-specific action
    const auditActionMap: Record<string, string> = {
      ISSUANCE: 'SHARES_ISSUED',
      TRANSFER: 'SHARES_TRANSFERRED',
      CANCELLATION: 'SHARES_CANCELLED',
      CONVERSION: 'SHARES_CONVERTED',
      SPLIT: 'SHARES_SPLIT',
    };
    const auditAction = auditActionMap[transaction.type];
    if (auditAction) {
      this.auditLogService
        .log({
          actorType: 'USER',
          action: auditAction,
          resourceType: 'Transaction',
          resourceId: transaction.id,
          companyId,
          changes: {
            before: { status: 'SUBMITTED', type: transaction.type },
            after: { status: 'CONFIRMED', type: transaction.type },
          },
        })
        .catch((err) =>
          this.logger.warn(`Failed to log audit event: ${err.message}`),
        );
    }

    // Fire-and-forget: notify company admins about confirmed transaction
    this.notifyTransactionConfirmed(companyId, transaction).catch((err) =>
      this.logger.warn(`Failed to send transaction notification: ${err.message}`),
    );

    return this.findById(companyId, transactionId);
  }

  /**
   * Cancel a transaction (DRAFT/PENDING_APPROVAL/SUBMITTED/FAILED -> CANCELLED).
   *
   * CONFIRMED transactions cannot be cancelled.
   */
  async cancel(companyId: string, transactionId: string, cancelledBy: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, companyId },
    });

    if (!transaction) {
      throw new NotFoundException('transaction', transactionId);
    }

    if (transaction.status === 'CONFIRMED') {
      throw new BusinessRuleException(
        'TXN_CANNOT_CANCEL_CONFIRMED',
        'errors.txn.cannotCancelConfirmed',
        { transactionId },
      );
    }

    if (transaction.status === 'CANCELLED') {
      throw new BusinessRuleException('TXN_ALREADY_CANCELLED', 'errors.txn.alreadyCancelled', {
        transactionId,
      });
    }

    const allowed = STATUS_TRANSITIONS[transaction.status] ?? [];
    if (!allowed.includes('CANCELLED')) {
      throw new BusinessRuleException(
        'TXN_INVALID_STATUS_TRANSITION',
        'errors.txn.invalidStatusTransition',
        { currentStatus: transaction.status, targetStatus: 'CANCELLED' },
      );
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'CANCELLED',
        cancelledBy,
        cancelledAt: new Date(),
      },
      include: {
        fromShareholder: {
          select: { id: true, name: true, type: true },
        },
        toShareholder: {
          select: { id: true, name: true, type: true },
        },
        shareClass: {
          select: { id: true, className: true, type: true },
        },
      },
    });

    this.logger.log(
      `Transaction ${transactionId} cancelled by ${cancelledBy} in company ${companyId}`,
    );

    return this.formatTransactionResponse(updated);
  }

  /**
   * Submit a DRAFT transaction (DRAFT -> SUBMITTED or PENDING_APPROVAL).
   *
   * If the transaction requires board approval, it moves to PENDING_APPROVAL.
   * Otherwise, it moves directly to SUBMITTED.
   */
  async submit(companyId: string, transactionId: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, companyId },
    });

    if (!transaction) {
      throw new NotFoundException('transaction', transactionId);
    }

    if (transaction.status !== 'DRAFT') {
      throw new BusinessRuleException(
        'TXN_INVALID_STATUS_TRANSITION',
        'errors.txn.invalidStatusTransition',
        {
          currentStatus: transaction.status,
          targetStatus: transaction.requiresBoardApproval ? 'PENDING_APPROVAL' : 'SUBMITTED',
        },
      );
    }

    const targetStatus = transaction.requiresBoardApproval ? 'PENDING_APPROVAL' : 'SUBMITTED';

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: targetStatus },
      include: {
        fromShareholder: {
          select: { id: true, name: true, type: true },
        },
        toShareholder: {
          select: { id: true, name: true, type: true },
        },
        shareClass: {
          select: { id: true, className: true, type: true },
        },
      },
    });

    this.logger.log(
      `Transaction ${transactionId} submitted -> ${targetStatus} in company ${companyId}`,
    );

    return this.formatTransactionResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // Private: Type-specific validation
  // ---------------------------------------------------------------------------

  private async validateByType(
    companyId: string,
    dto: CreateTransactionDto,
    quantity: Prisma.Decimal,
    shareClass: {
      id: string;
      totalAuthorized: Prisma.Decimal;
      totalIssued: Prisma.Decimal;
      className: string;
    },
  ) {
    switch (dto.type) {
      case TransactionTypeDto.ISSUANCE:
        await this.validateIssuance(companyId, dto, quantity, shareClass);
        break;
      case TransactionTypeDto.TRANSFER:
        await this.validateTransfer(companyId, dto, quantity);
        break;
      case TransactionTypeDto.CANCELLATION:
        await this.validateCancellation(companyId, dto, quantity);
        break;
      case TransactionTypeDto.CONVERSION:
        await this.validateConversion(companyId, dto, quantity);
        break;
      case TransactionTypeDto.SPLIT:
        // Split requires special handling; validate splitRatio is provided
        if (!dto.splitRatio) {
          throw new BusinessRuleException(
            'TXN_SPLIT_RATIO_REQUIRED',
            'errors.txn.splitRatioRequired',
          );
        }
        break;
    }
  }

  private async validateIssuance(
    companyId: string,
    dto: CreateTransactionDto,
    quantity: Prisma.Decimal,
    shareClass: { totalAuthorized: Prisma.Decimal; totalIssued: Prisma.Decimal; className: string },
  ) {
    // toShareholderId is required for issuance
    if (!dto.toShareholderId) {
      throw new BusinessRuleException(
        'TXN_TO_SHAREHOLDER_REQUIRED',
        'errors.txn.toShareholderRequired',
      );
    }

    // Validate destination shareholder exists and belongs to company
    await this.validateShareholder(companyId, dto.toShareholderId, 'to');

    // Check authorized shares limit (totalIssued + quantity <= totalAuthorized)
    const newTotal = shareClass.totalIssued.plus(quantity);
    if (newTotal.gt(shareClass.totalAuthorized)) {
      throw new BusinessRuleException('TXN_EXCEEDS_AUTHORIZED', 'errors.txn.exceedsAuthorized', {
        shareClassName: shareClass.className,
        authorized: shareClass.totalAuthorized.toString(),
        currentIssued: shareClass.totalIssued.toString(),
        requested: quantity.toString(),
        wouldBe: newTotal.toString(),
      });
    }
  }

  private async validateTransfer(
    companyId: string,
    dto: CreateTransactionDto,
    quantity: Prisma.Decimal,
  ) {
    if (!dto.fromShareholderId) {
      throw new BusinessRuleException(
        'TXN_FROM_SHAREHOLDER_REQUIRED',
        'errors.txn.fromShareholderRequired',
      );
    }
    if (!dto.toShareholderId) {
      throw new BusinessRuleException(
        'TXN_TO_SHAREHOLDER_REQUIRED',
        'errors.txn.toShareholderRequired',
      );
    }
    if (dto.fromShareholderId === dto.toShareholderId) {
      throw new BusinessRuleException('TXN_SAME_SHAREHOLDER', 'errors.txn.sameShareholder');
    }

    await this.validateShareholder(companyId, dto.fromShareholderId, 'from');
    await this.validateShareholder(companyId, dto.toShareholderId, 'to');

    // Check lock-up period before allowing transfer
    await this.validateLockUpPeriod(companyId, dto.fromShareholderId, dto.shareClassId);

    // Verify sufficient balance
    await this.validateSufficientShares(
      companyId,
      dto.fromShareholderId,
      dto.shareClassId,
      quantity,
    );
  }

  private async validateCancellation(
    companyId: string,
    dto: CreateTransactionDto,
    quantity: Prisma.Decimal,
  ) {
    if (!dto.fromShareholderId) {
      throw new BusinessRuleException(
        'TXN_FROM_SHAREHOLDER_REQUIRED',
        'errors.txn.fromShareholderRequired',
      );
    }

    await this.validateShareholder(companyId, dto.fromShareholderId, 'from');

    await this.validateSufficientShares(
      companyId,
      dto.fromShareholderId,
      dto.shareClassId,
      quantity,
    );
  }

  private async validateConversion(
    companyId: string,
    dto: CreateTransactionDto,
    quantity: Prisma.Decimal,
  ) {
    if (!dto.fromShareholderId) {
      throw new BusinessRuleException(
        'TXN_FROM_SHAREHOLDER_REQUIRED',
        'errors.txn.fromShareholderRequired',
      );
    }
    if (!dto.toShareClassId) {
      throw new BusinessRuleException(
        'TXN_TO_SHARE_CLASS_REQUIRED',
        'errors.txn.toShareClassRequired',
      );
    }

    // Validate target share class exists
    const toShareClass = await this.prisma.shareClass.findFirst({
      where: { id: dto.toShareClassId, companyId },
    });
    if (!toShareClass) {
      throw new NotFoundException('shareClass', dto.toShareClassId);
    }

    await this.validateShareholder(companyId, dto.fromShareholderId, 'from');

    await this.validateSufficientShares(
      companyId,
      dto.fromShareholderId,
      dto.shareClassId,
      quantity,
    );
  }

  private async validateShareholder(companyId: string, shareholderId: string, _role: 'from' | 'to') {
    const shareholder = await this.prisma.shareholder.findFirst({
      where: { id: shareholderId, companyId, status: 'ACTIVE' },
    });
    if (!shareholder) {
      throw new NotFoundException('shareholder', shareholderId);
    }
  }

  private async validateSufficientShares(
    companyId: string,
    shareholderId: string,
    shareClassId: string,
    quantity: Prisma.Decimal,
  ) {
    const shareholding = await this.prisma.shareholding.findFirst({
      where: { companyId, shareholderId, shareClassId },
    });

    const available = shareholding?.quantity ?? new Prisma.Decimal(0);
    if (available.lt(quantity)) {
      throw new BusinessRuleException('TXN_INSUFFICIENT_SHARES', 'errors.txn.insufficientShares', {
        available: available.toString(),
        requested: quantity.toString(),
        shareholderId,
        shareClassId,
      });
    }
  }

  /**
   * Validate that shares are not in a lock-up period.
   *
   * Lock-up period is defined on the ShareClass as `lockUpPeriodMonths`.
   * The period starts from when the shareholding was created (createdAt)
   * and expires after the specified number of months.
   *
   * Only applies to TRANSFER transactions — shares cannot be transferred
   * while the lock-up period is active.
   */
  private async validateLockUpPeriod(
    companyId: string,
    shareholderId: string,
    shareClassId: string,
  ) {
    const shareholding = await this.prisma.shareholding.findFirst({
      where: { companyId, shareholderId, shareClassId },
      include: {
        shareClass: {
          select: { lockUpPeriodMonths: true, className: true },
        },
      },
    });

    if (!shareholding) return; // No shares to transfer — will be caught by validateSufficientShares

    const lockUpMonths = shareholding.shareClass.lockUpPeriodMonths;
    if (!lockUpMonths || lockUpMonths <= 0) return; // No lock-up period configured

    const lockupExpiresAt = new Date(shareholding.createdAt);
    lockupExpiresAt.setMonth(lockupExpiresAt.getMonth() + lockUpMonths);

    if (new Date() < lockupExpiresAt) {
      throw new BusinessRuleException('TXN_LOCKUP_ACTIVE', 'errors.txn.lockupActive', {
        lockupExpiresAt: lockupExpiresAt.toISOString(),
        shareClassName: shareholding.shareClass.className,
        lockUpPeriodMonths: lockUpMonths,
        shareholderId,
        shareClassId,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Execute transaction (cap table mutations)
  // ---------------------------------------------------------------------------

  private async executeTransaction(tx: Prisma.TransactionClient, transaction: any) {
    switch (transaction.type) {
      case 'ISSUANCE':
        await this.executeIssuance(tx, transaction);
        break;
      case 'TRANSFER':
        await this.executeTransfer(tx, transaction);
        break;
      case 'CANCELLATION':
        await this.executeCancellation(tx, transaction);
        break;
      case 'CONVERSION':
        await this.executeConversion(tx, transaction);
        break;
      case 'SPLIT':
        await this.executeSplit(tx, transaction);
        break;
    }
  }

  private async executeIssuance(tx: Prisma.TransactionClient, transaction: any) {
    // Upsert shareholding for the destination shareholder
    const existing = await tx.shareholding.findFirst({
      where: {
        companyId: transaction.companyId,
        shareholderId: transaction.toShareholderId,
        shareClassId: transaction.shareClassId,
      },
    });

    if (existing) {
      await tx.shareholding.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity.plus(transaction.quantity),
        },
      });
    } else {
      await tx.shareholding.create({
        data: {
          companyId: transaction.companyId,
          shareholderId: transaction.toShareholderId,
          shareClassId: transaction.shareClassId,
          quantity: transaction.quantity,
          ownershipPct: new Prisma.Decimal(0), // Will be recalculated
          votingPowerPct: new Prisma.Decimal(0), // Will be recalculated
        },
      });
    }

    // Update share class totalIssued
    await tx.shareClass.update({
      where: { id: transaction.shareClassId },
      data: {
        totalIssued: {
          increment: transaction.quantity,
        },
      },
    });
  }

  private async executeTransfer(tx: Prisma.TransactionClient, transaction: any) {
    // Deduct from source
    const fromHolding = await tx.shareholding.findFirst({
      where: {
        companyId: transaction.companyId,
        shareholderId: transaction.fromShareholderId,
        shareClassId: transaction.shareClassId,
      },
    });

    if (!fromHolding || fromHolding.quantity.lt(transaction.quantity)) {
      throw new BusinessRuleException('TXN_INSUFFICIENT_SHARES', 'errors.txn.insufficientShares', {
        available: fromHolding?.quantity.toString() ?? '0',
        requested: transaction.quantity.toString(),
      });
    }

    const newFromQty = fromHolding.quantity.minus(transaction.quantity);
    if (newFromQty.isZero()) {
      await tx.shareholding.delete({ where: { id: fromHolding.id } });
    } else {
      await tx.shareholding.update({
        where: { id: fromHolding.id },
        data: { quantity: newFromQty },
      });
    }

    // Add to destination
    const toHolding = await tx.shareholding.findFirst({
      where: {
        companyId: transaction.companyId,
        shareholderId: transaction.toShareholderId,
        shareClassId: transaction.shareClassId,
      },
    });

    if (toHolding) {
      await tx.shareholding.update({
        where: { id: toHolding.id },
        data: {
          quantity: toHolding.quantity.plus(transaction.quantity),
        },
      });
    } else {
      await tx.shareholding.create({
        data: {
          companyId: transaction.companyId,
          shareholderId: transaction.toShareholderId,
          shareClassId: transaction.shareClassId,
          quantity: transaction.quantity,
          ownershipPct: new Prisma.Decimal(0),
          votingPowerPct: new Prisma.Decimal(0),
        },
      });
    }
    // totalIssued unchanged for transfers
  }

  private async executeCancellation(tx: Prisma.TransactionClient, transaction: any) {
    const holding = await tx.shareholding.findFirst({
      where: {
        companyId: transaction.companyId,
        shareholderId: transaction.fromShareholderId,
        shareClassId: transaction.shareClassId,
      },
    });

    if (!holding || holding.quantity.lt(transaction.quantity)) {
      throw new BusinessRuleException('TXN_INSUFFICIENT_SHARES', 'errors.txn.insufficientShares', {
        available: holding?.quantity.toString() ?? '0',
        requested: transaction.quantity.toString(),
      });
    }

    const newQty = holding.quantity.minus(transaction.quantity);
    if (newQty.isZero()) {
      await tx.shareholding.delete({ where: { id: holding.id } });
    } else {
      await tx.shareholding.update({
        where: { id: holding.id },
        data: { quantity: newQty },
      });
    }

    // Decrease share class totalIssued
    await tx.shareClass.update({
      where: { id: transaction.shareClassId },
      data: {
        totalIssued: {
          decrement: transaction.quantity,
        },
      },
    });
  }

  private async executeConversion(tx: Prisma.TransactionClient, transaction: any) {
    // Remove from source share class
    await this.executeCancellation(tx, transaction);

    // Add to target share class (using notes to store toShareClassId for now)
    // The toShareClassId is stored in the transaction notes as JSON metadata
    // In a full implementation, this would be a dedicated field
    const toShareClassId = this.extractToShareClassId(transaction);
    if (!toShareClassId) {
      throw new BusinessRuleException(
        'TXN_TO_SHARE_CLASS_REQUIRED',
        'errors.txn.toShareClassRequired',
      );
    }

    const toHolding = await tx.shareholding.findFirst({
      where: {
        companyId: transaction.companyId,
        shareholderId: transaction.fromShareholderId,
        shareClassId: toShareClassId,
      },
    });

    if (toHolding) {
      await tx.shareholding.update({
        where: { id: toHolding.id },
        data: {
          quantity: toHolding.quantity.plus(transaction.quantity),
        },
      });
    } else {
      await tx.shareholding.create({
        data: {
          companyId: transaction.companyId,
          shareholderId: transaction.fromShareholderId,
          shareClassId: toShareClassId,
          quantity: transaction.quantity,
          ownershipPct: new Prisma.Decimal(0),
          votingPowerPct: new Prisma.Decimal(0),
        },
      });
    }

    // Update target share class totalIssued
    await tx.shareClass.update({
      where: { id: toShareClassId },
      data: {
        totalIssued: {
          increment: transaction.quantity,
        },
      },
    });
  }

  private async executeSplit(tx: Prisma.TransactionClient, transaction: any) {
    // Split multiplies all shareholdings in this share class by the ratio
    const ratio = this.extractSplitRatio(transaction);
    if (!ratio || ratio.lte(0)) {
      throw new BusinessRuleException('TXN_SPLIT_RATIO_REQUIRED', 'errors.txn.splitRatioRequired');
    }

    const holdings = await tx.shareholding.findMany({
      where: {
        companyId: transaction.companyId,
        shareClassId: transaction.shareClassId,
      },
    });

    // Validate no fractional shares result from the split
    for (const holding of holdings) {
      const newQuantity = holding.quantity.mul(ratio);
      if (!newQuantity.eq(newQuantity.floor())) {
        throw new BusinessRuleException(
          'TXN_INVALID_SPLIT_RATIO',
          'errors.txn.invalidSplitRatio',
          {
            shareholdingId: holding.id,
            currentQuantity: holding.quantity.toString(),
            resultingQuantity: newQuantity.toString(),
          },
        );
      }
    }

    for (const holding of holdings) {
      await tx.shareholding.update({
        where: { id: holding.id },
        data: {
          quantity: holding.quantity.mul(ratio),
        },
      });
    }

    // Update share class totals (compute new values explicitly)
    const shareClass = await tx.shareClass.findUnique({
      where: { id: transaction.shareClassId },
    });
    if (shareClass) {
      await tx.shareClass.update({
        where: { id: transaction.shareClassId },
        data: {
          totalIssued: shareClass.totalIssued.mul(ratio),
          totalAuthorized: shareClass.totalAuthorized.mul(ratio),
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Helpers
  // ---------------------------------------------------------------------------

  /**
   * Build notes JSON string containing user notes and type-specific metadata.
   * CONVERSION stores toShareClassId; SPLIT stores splitRatio.
   */
  private buildNotes(dto: CreateTransactionDto): string | null {
    const meta: Record<string, string> = {};
    if (dto.notes) meta.userNotes = dto.notes;
    if (dto.toShareClassId) meta.toShareClassId = dto.toShareClassId;
    if (dto.splitRatio) meta.splitRatio = dto.splitRatio;

    if (Object.keys(meta).length === 0) return null;
    return JSON.stringify(meta);
  }

  /**
   * Extract toShareClassId from transaction notes (stored as JSON metadata).
   * Format in notes: {"toShareClassId": "uuid"}
   */
  private extractToShareClassId(transaction: any): string | null {
    if (!transaction.notes) return null;
    try {
      const meta = JSON.parse(transaction.notes);
      return meta.toShareClassId ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Extract split ratio from transaction notes (stored as JSON metadata).
   * Format in notes: {"splitRatio": "2"}
   */
  private extractSplitRatio(transaction: any): Prisma.Decimal | null {
    if (!transaction.notes) return null;
    try {
      const meta = JSON.parse(transaction.notes);
      return meta.splitRatio ? new Prisma.Decimal(meta.splitRatio) : null;
    } catch {
      return null;
    }
  }

  /**
   * Sends notifications to company admins when a transaction is confirmed.
   * Maps transaction type to notification type: ISSUANCE→SHARES_ISSUED, TRANSFER→SHARES_TRANSFERRED.
   */
  private async notifyTransactionConfirmed(companyId: string, transaction: any): Promise<void> {
    const typeMap: Record<string, string> = {
      ISSUANCE: 'SHARES_ISSUED',
      TRANSFER: 'SHARES_TRANSFERRED',
      CANCELLATION: 'SHARES_CANCELLED',
      CONVERSION: 'SHARES_CONVERTED',
      SPLIT: 'SHARES_SPLIT',
    };

    const notificationType = typeMap[transaction.type];
    if (!notificationType) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    const adminMembers = await this.prisma.companyMember.findMany({
      where: { companyId, role: 'ADMIN', status: 'ACTIVE' },
      select: { userId: true },
    });

    const companyName = company?.name ?? 'Company';
    const quantity = transaction.quantity.toString();
    const subjectMap: Record<string, string> = {
      SHARES_ISSUED: `${quantity} shares issued — ${companyName}`,
      SHARES_TRANSFERRED: `${quantity} shares transferred — ${companyName}`,
      SHARES_CANCELLED: `${quantity} shares cancelled — ${companyName}`,
      SHARES_CONVERTED: `${quantity} shares converted — ${companyName}`,
      SHARES_SPLIT: `Stock split executed — ${companyName}`,
    };
    const bodyMap: Record<string, string> = {
      SHARES_ISSUED: `${quantity} shares have been issued and confirmed.`,
      SHARES_TRANSFERRED: `${quantity} shares have been transferred and confirmed.`,
      SHARES_CANCELLED: `${quantity} shares have been cancelled and confirmed.`,
      SHARES_CONVERTED: `${quantity} shares have been converted to a new share class.`,
      SHARES_SPLIT: `A stock split has been executed and all holdings have been adjusted.`,
    };

    const subject = subjectMap[notificationType];
    const body = bodyMap[notificationType];

    for (const member of adminMembers) {
      if (!member.userId) continue;
      await this.notificationService.create({
        userId: member.userId,
        notificationType,
        subject,
        body,
        relatedEntityType: 'Transaction',
        relatedEntityId: transaction.id,
        companyId,
        companyName: company?.name ?? undefined,
      });
    }
  }

  private formatTransactionResponse(transaction: any) {
    return {
      id: transaction.id,
      companyId: transaction.companyId,
      type: transaction.type,
      status: transaction.status,
      fromShareholder: transaction.fromShareholder
        ? {
            id: transaction.fromShareholder.id,
            name: transaction.fromShareholder.name,
            type: transaction.fromShareholder.type,
          }
        : null,
      toShareholder: transaction.toShareholder
        ? {
            id: transaction.toShareholder.id,
            name: transaction.toShareholder.name,
            type: transaction.toShareholder.type,
          }
        : null,
      shareClass: {
        id: transaction.shareClass.id,
        className: transaction.shareClass.className,
        type: transaction.shareClass.type,
      },
      quantity: transaction.quantity.toString(),
      pricePerShare: transaction.pricePerShare?.toString() ?? null,
      totalValue: transaction.totalValue?.toString() ?? null,
      notes: transaction.notes,
      requiresBoardApproval: transaction.requiresBoardApproval,
      approvedBy: transaction.approvedBy,
      approvedAt: transaction.approvedAt?.toISOString() ?? null,
      cancelledBy: transaction.cancelledBy,
      cancelledAt: transaction.cancelledAt?.toISOString() ?? null,
      confirmedAt: transaction.confirmedAt?.toISOString() ?? null,
      createdBy: transaction.createdBy,
      createdAt: transaction.createdAt.toISOString(),
      updatedAt: transaction.updatedAt.toISOString(),
    };
  }

  private formatTransactionDetailResponse(transaction: any) {
    const base = this.formatTransactionResponse(transaction);
    return {
      ...base,
      blockchainTransactions: (transaction.blockchainTransactions ?? []).map((bt: any) => ({
        id: bt.id,
        txHash: bt.txHash,
        status: bt.status,
        confirmedAt: bt.confirmedAt?.toISOString() ?? null,
      })),
    };
  }
}
