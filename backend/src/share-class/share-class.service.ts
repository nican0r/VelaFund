import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShareClassDto } from './dto/create-share-class.dto';
import { UpdateShareClassDto } from './dto/update-share-class.dto';
import { ListShareClassesQueryDto } from './dto/list-share-classes-query.dto';
import { parseSort } from '../common/helpers/sort-parser';
import {
  NotFoundException,
  ConflictException,
  BusinessRuleException,
} from '../common/filters/app-exception';

/** Preferred shares cannot exceed 2/3 of total authorized capital (Brazilian Corp Law Art. 15 §2). */
const PREFERRED_SHARE_MAX_RATIO = 2 / 3;

@Injectable()
export class ShareClassService {
  private readonly logger = new Logger(ShareClassService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new share class for a company.
   *
   * Business rules:
   * - Company must exist and be ACTIVE
   * - Ltda. companies can only have QUOTA type
   * - S.A. companies must have at least one COMMON_SHARES class with votesPerShare >= 1
   * - BR-3: Preferred shares cannot exceed 2/3 of total authorized capital
   * - className must be unique per company
   */
  async create(companyId: string, dto: CreateShareClassDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('company', companyId);
    }

    if (company.status !== 'ACTIVE') {
      throw new BusinessRuleException('CAP_COMPANY_NOT_ACTIVE', 'errors.cap.companyNotActive', {
        companyId,
        status: company.status,
      });
    }

    // Ltda. companies can only have QUOTA type
    if (company.entityType === 'LTDA' && dto.type !== 'QUOTA') {
      throw new BusinessRuleException(
        'CAP_INVALID_SHARE_CLASS_TYPE',
        'errors.cap.invalidShareClassType',
        { entityType: company.entityType, requestedType: dto.type },
      );
    }

    // S.A. companies cannot have QUOTA type
    if (
      (company.entityType === 'SA_CAPITAL_FECHADO' || company.entityType === 'SA_CAPITAL_ABERTO') &&
      dto.type === 'QUOTA'
    ) {
      throw new BusinessRuleException(
        'CAP_INVALID_SHARE_CLASS_TYPE',
        'errors.cap.invalidShareClassType',
        { entityType: company.entityType, requestedType: dto.type },
      );
    }

    // BR-3: Preferred share limit check for S.A. companies
    if (dto.type === 'PREFERRED_SHARES') {
      await this.validatePreferredShareLimit(companyId, new Prisma.Decimal(dto.totalAuthorized));
    }

    // Validate totalAuthorized is non-negative
    const totalAuthorized = new Prisma.Decimal(dto.totalAuthorized);
    if (totalAuthorized.lt(0)) {
      throw new BusinessRuleException(
        'CAP_INVALID_TOTAL_AUTHORIZED',
        'errors.cap.invalidTotalAuthorized',
        { totalAuthorized: dto.totalAuthorized },
      );
    }

    try {
      const shareClass = await this.prisma.shareClass.create({
        data: {
          companyId,
          className: dto.className,
          type: dto.type,
          totalAuthorized,
          votesPerShare: dto.votesPerShare,
          liquidationPreferenceMultiple:
            dto.liquidationPreferenceMultiple != null
              ? new Prisma.Decimal(dto.liquidationPreferenceMultiple)
              : null,
          participatingRights: dto.participatingRights ?? false,
          rightOfFirstRefusal: dto.rightOfFirstRefusal ?? true,
          lockUpPeriodMonths: dto.lockUpPeriodMonths ?? null,
          tagAlongPercentage:
            dto.tagAlongPercentage != null ? new Prisma.Decimal(dto.tagAlongPercentage) : null,
        },
      });

      this.logger.log(
        `Share class ${shareClass.id} (${dto.className}) created for company ${companyId}`,
      );

      return shareClass;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('CAP_SHARE_CLASS_DUPLICATE', 'errors.cap.shareClassDuplicate', {
          companyId,
          className: dto.className,
        });
      }
      throw error;
    }
  }

  /**
   * List all share classes for a company with pagination and filtering.
   */
  async findAll(companyId: string, query: ListShareClassesQueryDto) {
    const sortFields = parseSort(query.sort, [
      'className',
      'type',
      'createdAt',
      'totalAuthorized',
      'totalIssued',
    ]);

    const where: Prisma.ShareClassWhereInput = {
      companyId,
      ...(query.type ? { type: query.type } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.shareClass.findMany({
        where,
        orderBy: sortFields.map((sf) => ({ [sf.field]: sf.direction })),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.shareClass.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Get a single share class by ID within a company scope.
   */
  async findById(companyId: string, id: string) {
    const shareClass = await this.prisma.shareClass.findFirst({
      where: { id, companyId },
    });

    if (!shareClass) {
      throw new NotFoundException('shareClass', id);
    }

    return shareClass;
  }

  /** Fields that become immutable once shares have been issued (totalIssued > 0). */
  private static readonly IMMUTABLE_AFTER_ISSUANCE: readonly string[] = [
    'className',
    'type',
    'votesPerShare',
    'liquidationPreferenceMultiple',
    'participatingRights',
  ] as const;

  /**
   * Update a share class.
   *
   * Business rules:
   * - Company must be ACTIVE
   * - EC-3: Once totalIssued > 0, immutable fields cannot be changed
   *   (className, type, votesPerShare, liquidationPreferenceMultiple, participatingRights)
   * - Always-mutable fields: totalAuthorized (increase only), lockUpPeriodMonths,
   *   tagAlongPercentage, rightOfFirstRefusal
   * - totalAuthorized can only increase and must be >= totalIssued
   */
  async update(companyId: string, id: string, dto: UpdateShareClassDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException('company', companyId);
    }

    if (company.status !== 'ACTIVE') {
      throw new BusinessRuleException('CAP_COMPANY_NOT_ACTIVE', 'errors.cap.companyNotActive', {
        companyId,
        status: company.status,
      });
    }

    const existing = await this.findById(companyId, id);
    const totalIssued = new Prisma.Decimal(existing.totalIssued.toString());

    // EC-3: Enforce immutability of certain fields after shares have been issued
    if (totalIssued.gt(0)) {
      for (const field of ShareClassService.IMMUTABLE_AFTER_ISSUANCE) {
        if ((dto as Record<string, unknown>)[field] !== undefined) {
          throw new BusinessRuleException(
            'CAP_IMMUTABLE_AFTER_ISSUANCE',
            'errors.cap.immutableAfterIssuance',
            { field, totalIssued: totalIssued.toString() },
          );
        }
      }
    }

    // Validate entity type compatibility if type is being changed (only before issuance)
    if (dto.type !== undefined && dto.type !== existing.type) {
      if (company.entityType === 'LTDA' && dto.type !== 'QUOTA') {
        throw new BusinessRuleException(
          'CAP_INVALID_SHARE_CLASS_TYPE',
          'errors.cap.invalidShareClassType',
          { entityType: company.entityType, requestedType: dto.type },
        );
      }
      if (
        (company.entityType === 'SA_CAPITAL_FECHADO' ||
          company.entityType === 'SA_CAPITAL_ABERTO') &&
        dto.type === 'QUOTA'
      ) {
        throw new BusinessRuleException(
          'CAP_INVALID_SHARE_CLASS_TYPE',
          'errors.cap.invalidShareClassType',
          { entityType: company.entityType, requestedType: dto.type },
        );
      }
    }

    // Validate totalAuthorized update
    if (dto.totalAuthorized !== undefined) {
      const newTotal = new Prisma.Decimal(dto.totalAuthorized);
      const currentTotal = new Prisma.Decimal(existing.totalAuthorized.toString());
      const currentIssued = new Prisma.Decimal(existing.totalIssued.toString());

      // Can only increase
      if (newTotal.lt(currentTotal)) {
        throw new BusinessRuleException(
          'CAP_TOTAL_AUTHORIZED_CANNOT_DECREASE',
          'errors.cap.totalAuthorizedCannotDecrease',
          {
            currentTotal: currentTotal.toString(),
            requestedTotal: newTotal.toString(),
          },
        );
      }

      // Must be >= totalIssued
      if (newTotal.lt(currentIssued)) {
        throw new BusinessRuleException(
          'CAP_INSUFFICIENT_SHARES',
          'errors.cap.insufficientShares',
          {
            totalIssued: currentIssued.toString(),
            requestedTotal: newTotal.toString(),
          },
        );
      }

      // If increasing preferred shares, check the 2/3 limit
      const effectiveType = dto.type ?? existing.type;
      if (effectiveType === 'PREFERRED_SHARES' && newTotal.gt(currentTotal)) {
        const increase = newTotal.minus(currentTotal);
        await this.validatePreferredShareLimit(companyId, increase);
      }
    }

    // BR-3: If changing type to PREFERRED_SHARES, check limit
    if (
      dto.type === 'PREFERRED_SHARES' &&
      existing.type !== 'PREFERRED_SHARES' &&
      dto.totalAuthorized === undefined
    ) {
      const existingAuthorized = new Prisma.Decimal(existing.totalAuthorized.toString());
      await this.validatePreferredShareLimit(companyId, existingAuthorized);
    }

    // Build update data — always-mutable fields
    const data: Prisma.ShareClassUpdateInput = {};
    if (dto.totalAuthorized !== undefined)
      data.totalAuthorized = new Prisma.Decimal(dto.totalAuthorized);
    if (dto.lockUpPeriodMonths !== undefined) data.lockUpPeriodMonths = dto.lockUpPeriodMonths;
    if (dto.tagAlongPercentage !== undefined)
      data.tagAlongPercentage =
        dto.tagAlongPercentage != null ? new Prisma.Decimal(dto.tagAlongPercentage) : null;
    if (dto.rightOfFirstRefusal !== undefined) data.rightOfFirstRefusal = dto.rightOfFirstRefusal;

    // Pre-issuance mutable fields (only allowed when totalIssued = 0)
    if (dto.className !== undefined) data.className = dto.className;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.votesPerShare !== undefined) data.votesPerShare = dto.votesPerShare;
    if (dto.liquidationPreferenceMultiple !== undefined)
      data.liquidationPreferenceMultiple =
        dto.liquidationPreferenceMultiple != null
          ? new Prisma.Decimal(dto.liquidationPreferenceMultiple)
          : null;
    if (dto.participatingRights !== undefined) data.participatingRights = dto.participatingRights;

    try {
      const updated = await this.prisma.shareClass.update({
        where: { id },
        data,
      });

      this.logger.log(`Share class ${id} updated for company ${companyId}`);

      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('CAP_SHARE_CLASS_DUPLICATE', 'errors.cap.shareClassDuplicate', {
          companyId,
          className: dto.className,
        });
      }
      throw error;
    }
  }

  /**
   * Delete a share class.
   *
   * Only allowed if totalIssued = 0 and no active shareholdings exist.
   */
  async delete(companyId: string, id: string) {
    const existing = await this.findById(companyId, id);

    // Cannot delete if shares have been issued
    const totalIssued = new Prisma.Decimal(existing.totalIssued.toString());
    if (totalIssued.gt(0)) {
      throw new BusinessRuleException('CAP_SHARE_CLASS_IN_USE', 'errors.cap.shareClassInUse', {
        shareClassId: id,
        totalIssued: totalIssued.toString(),
      });
    }

    // Check for any active shareholdings
    const activeShareholdings = await this.prisma.shareholding.count({
      where: { shareClassId: id },
    });

    if (activeShareholdings > 0) {
      throw new BusinessRuleException('CAP_SHARE_CLASS_IN_USE', 'errors.cap.shareClassInUse', {
        shareClassId: id,
        activeShareholdings,
      });
    }

    await this.prisma.shareClass.delete({
      where: { id },
    });

    this.logger.log(`Share class ${id} deleted from company ${companyId}`);
  }

  /**
   * Validate that adding preferred shares won't exceed the 2/3 limit.
   * Brazilian Corp Law Art. 15 §2: preferred shares cannot exceed 2/3 of total authorized capital.
   */
  private async validatePreferredShareLimit(
    companyId: string,
    additionalPreferred: Prisma.Decimal,
  ) {
    const shareClasses = await this.prisma.shareClass.findMany({
      where: { companyId },
      select: { type: true, totalAuthorized: true },
    });

    let totalAll = new Prisma.Decimal(0);
    let totalPreferred = new Prisma.Decimal(0);

    for (const sc of shareClasses) {
      const authorized = new Prisma.Decimal(sc.totalAuthorized.toString());
      totalAll = totalAll.plus(authorized);
      if (sc.type === 'PREFERRED_SHARES') {
        totalPreferred = totalPreferred.plus(authorized);
      }
    }

    // Add the new preferred shares
    totalPreferred = totalPreferred.plus(additionalPreferred);
    totalAll = totalAll.plus(additionalPreferred);

    if (totalAll.gt(0) && totalPreferred.div(totalAll).gt(PREFERRED_SHARE_MAX_RATIO)) {
      throw new BusinessRuleException(
        'CAP_PREFERRED_SHARE_LIMIT_EXCEEDED',
        'errors.cap.preferredShareLimitExceeded',
        {
          totalPreferred: totalPreferred.toString(),
          totalAll: totalAll.toString(),
          maxRatio: `${Math.round(PREFERRED_SHARE_MAX_RATIO * 100)}%`,
        },
      );
    }
  }
}
