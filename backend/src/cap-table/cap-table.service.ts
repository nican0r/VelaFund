import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseSort } from '../common/helpers/sort-parser';
import {
  NotFoundException,
  BusinessRuleException,
} from '../common/filters/app-exception';
import { CapTableQueryDto } from './dto/cap-table-query.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { SnapshotHistoryQueryDto } from './dto/snapshot-history-query.dto';
import { createHash } from 'crypto';

@Injectable()
export class CapTableService {
  private readonly logger = new Logger(CapTableService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the current cap table for a company.
   *
   * Calculates ownership percentages and voting power from Shareholding records.
   * Supports filtering by share class.
   */
  async getCurrentCapTable(companyId: string, query: CapTableQueryDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, entityType: true, status: true, createdAt: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    const shareholdingWhere: Prisma.ShareholdingWhereInput = {
      companyId,
      ...(query.shareClassId ? { shareClassId: query.shareClassId } : {}),
    };

    const shareholdings = await this.prisma.shareholding.findMany({
      where: shareholdingWhere,
      include: {
        shareholder: {
          select: { id: true, name: true, type: true, status: true },
        },
        shareClass: {
          select: {
            id: true,
            className: true,
            type: true,
            votesPerShare: true,
            totalAuthorized: true,
            totalIssued: true,
          },
        },
      },
      orderBy: [{ shareClass: { className: 'asc' } }],
    });

    // Calculate totals
    const totalShares = shareholdings.reduce(
      (sum, sh) => sum.plus(sh.quantity),
      new Prisma.Decimal(0),
    );

    const totalVotingPower = shareholdings.reduce(
      (sum, sh) => sum.plus(sh.quantity.mul(sh.shareClass.votesPerShare)),
      new Prisma.Decimal(0),
    );

    // Get unique shareholders and share classes
    const shareholderIds = new Set(shareholdings.map((s) => s.shareholderId));
    const shareClassIds = new Set(shareholdings.map((s) => s.shareClassId));

    // Build entries with calculated percentages
    const entries = shareholdings.map((sh) => {
      const ownershipPercentage = totalShares.isZero()
        ? new Prisma.Decimal(0)
        : sh.quantity.div(totalShares).mul(100);

      const votingPower = sh.quantity.mul(sh.shareClass.votesPerShare);
      const votingPercentage = totalVotingPower.isZero()
        ? new Prisma.Decimal(0)
        : votingPower.div(totalVotingPower).mul(100);

      return {
        shareholderId: sh.shareholder.id,
        shareholderName: sh.shareholder.name,
        shareholderType: sh.shareholder.type,
        shareClassId: sh.shareClass.id,
        shareClassName: sh.shareClass.className,
        shareClassType: sh.shareClass.type,
        shares: sh.quantity.toString(),
        ownershipPercentage: ownershipPercentage.toDecimalPlaces(6).toString(),
        votingPower: votingPower.toString(),
        votingPercentage: votingPercentage.toDecimalPlaces(6).toString(),
      };
    });

    // Find the most recent update
    const lastUpdated = shareholdings.length > 0
      ? shareholdings.reduce((latest, sh) =>
          sh.updatedAt > latest ? sh.updatedAt : latest,
        shareholdings[0].updatedAt)
      : company.createdAt;

    return {
      company: {
        id: company.id,
        name: company.name,
        entityType: company.entityType,
      },
      summary: {
        totalShares: totalShares.toString(),
        totalShareholders: shareholderIds.size,
        totalShareClasses: shareClassIds.size,
        lastUpdated: lastUpdated.toISOString(),
      },
      entries,
    };
  }

  /**
   * Get fully-diluted cap table including outstanding options.
   *
   * Includes both current shareholdings and option grants (vested + unvested).
   */
  async getFullyDilutedCapTable(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, entityType: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    // Get all shareholdings
    const shareholdings = await this.prisma.shareholding.findMany({
      where: { companyId },
      include: {
        shareholder: {
          select: { id: true, name: true, type: true },
        },
        shareClass: {
          select: { id: true, className: true, votesPerShare: true },
        },
      },
    });

    // Get all active option grants (for fully-diluted calculation)
    const optionGrants = await this.prisma.optionGrant.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        shareholderId: { not: null },
      },
      include: {
        shareholder: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    // Calculate current totals
    const totalSharesOutstanding = shareholdings.reduce(
      (sum, sh) => sum.plus(sh.quantity),
      new Prisma.Decimal(0),
    );

    // Calculate total options outstanding
    const totalOptionsOutstanding = optionGrants.reduce(
      (sum, grant) => {
        const remaining = new Prisma.Decimal(grant.quantity).minus(
          new Prisma.Decimal(grant.exercised),
        );
        return sum.plus(remaining.greaterThan(0) ? remaining : new Prisma.Decimal(0));
      },
      new Prisma.Decimal(0),
    );

    const fullyDilutedShares = totalSharesOutstanding.plus(totalOptionsOutstanding);

    // Aggregate by shareholder
    const shareholderMap = new Map<
      string,
      {
        id: string;
        name: string;
        type: string;
        currentShares: Prisma.Decimal;
        optionsVested: Prisma.Decimal;
        optionsUnvested: Prisma.Decimal;
      }
    >();

    // Add shareholding data
    for (const sh of shareholdings) {
      const existing = shareholderMap.get(sh.shareholderId);
      if (existing) {
        existing.currentShares = existing.currentShares.plus(sh.quantity);
      } else {
        shareholderMap.set(sh.shareholderId, {
          id: sh.shareholder.id,
          name: sh.shareholder.name,
          type: sh.shareholder.type,
          currentShares: new Prisma.Decimal(sh.quantity),
          optionsVested: new Prisma.Decimal(0),
          optionsUnvested: new Prisma.Decimal(0),
        });
      }
    }

    // Add option grant data
    for (const grant of optionGrants) {
      // Skip grants without a linked shareholder
      if (!grant.shareholderId || !grant.shareholder) continue;

      const vested = this.calculateVestedOptions(grant);
      const exercised = new Prisma.Decimal(grant.exercised);
      const optionsVested = vested.minus(exercised).greaterThan(0)
        ? vested.minus(exercised)
        : new Prisma.Decimal(0);
      const optionsUnvested = new Prisma.Decimal(grant.quantity)
        .minus(vested)
        .greaterThan(0)
        ? new Prisma.Decimal(grant.quantity).minus(vested)
        : new Prisma.Decimal(0);

      const existing = shareholderMap.get(grant.shareholderId);
      if (existing) {
        existing.optionsVested = existing.optionsVested.plus(optionsVested);
        existing.optionsUnvested = existing.optionsUnvested.plus(optionsUnvested);
      } else {
        shareholderMap.set(grant.shareholderId, {
          id: grant.shareholder.id,
          name: grant.shareholder.name,
          type: grant.shareholder.type,
          currentShares: new Prisma.Decimal(0),
          optionsVested,
          optionsUnvested,
        });
      }
    }

    // Build entries
    const entries = Array.from(shareholderMap.values()).map((sh) => {
      const currentPercentage = totalSharesOutstanding.isZero()
        ? new Prisma.Decimal(0)
        : sh.currentShares.div(totalSharesOutstanding).mul(100);

      const fdShares = sh.currentShares
        .plus(sh.optionsVested)
        .plus(sh.optionsUnvested);
      const fdPercentage = fullyDilutedShares.isZero()
        ? new Prisma.Decimal(0)
        : fdShares.div(fullyDilutedShares).mul(100);

      return {
        shareholderId: sh.id,
        shareholderName: sh.name,
        shareholderType: sh.type,
        currentShares: sh.currentShares.toString(),
        currentPercentage: currentPercentage.toDecimalPlaces(6).toString(),
        optionsVested: sh.optionsVested.toString(),
        optionsUnvested: sh.optionsUnvested.toString(),
        fullyDilutedShares: fdShares.toString(),
        fullyDilutedPercentage: fdPercentage.toDecimalPlaces(6).toString(),
      };
    });

    // Sort by fully-diluted percentage descending
    entries.sort((a, b) => {
      const aVal = parseFloat(a.fullyDilutedPercentage);
      const bVal = parseFloat(b.fullyDilutedPercentage);
      return bVal - aVal;
    });

    return {
      company: {
        id: company.id,
        name: company.name,
        entityType: company.entityType,
      },
      summary: {
        totalSharesOutstanding: totalSharesOutstanding.toString(),
        totalOptionsOutstanding: totalOptionsOutstanding.toString(),
        fullyDilutedShares: fullyDilutedShares.toString(),
      },
      entries,
    };
  }

  /**
   * Get a point-in-time cap table snapshot.
   *
   * Finds the closest snapshot on or before the requested date.
   */
  async getSnapshot(companyId: string, date: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, createdAt: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    const snapshotDate = new Date(date);

    // Check if date is before company creation
    if (snapshotDate < company.createdAt) {
      throw new BusinessRuleException(
        'CAP_NO_DATA_FOR_DATE',
        'errors.cap.noDataForDate',
        { date, companyCreatedAt: company.createdAt.toISOString() },
      );
    }

    // Find closest snapshot on or before the requested date
    const snapshot = await this.prisma.capTableSnapshot.findFirst({
      where: {
        companyId,
        snapshotDate: { lte: snapshotDate },
      },
      orderBy: { snapshotDate: 'desc' },
    });

    if (!snapshot) {
      throw new NotFoundException('capTableSnapshot');
    }

    return {
      id: snapshot.id,
      snapshotDate: snapshot.snapshotDate.toISOString(),
      data: snapshot.data,
      notes: snapshot.notes,
      stateHash: snapshot.stateHash,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  /**
   * Get cap table snapshot history for a company.
   *
   * Returns a paginated list of snapshots sorted by date descending.
   */
  async getSnapshotHistory(companyId: string, query: SnapshotHistoryQueryDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    const sortFields = parseSort(query.sort, ['snapshotDate', 'createdAt'], {
      field: 'snapshotDate',
      direction: 'desc',
    });

    const skip = (query.page - 1) * query.limit;
    const take = query.limit;

    const [items, total] = await Promise.all([
      this.prisma.capTableSnapshot.findMany({
        where: { companyId },
        select: {
          id: true,
          snapshotDate: true,
          notes: true,
          stateHash: true,
          createdAt: true,
          // Extract summary from the JSON data field
          data: true,
        },
        orderBy: sortFields.map((sf) => ({ [sf.field]: sf.direction })),
        skip,
        take,
      }),
      this.prisma.capTableSnapshot.count({ where: { companyId } }),
    ]);

    // Shape the response to include summary info from the data field
    const shapedItems = items.map((item) => {
      const data = item.data as Record<string, unknown> | null;
      const summary = data?.summary as Record<string, unknown> | undefined;

      return {
        id: item.id,
        snapshotDate: item.snapshotDate.toISOString(),
        totalShares: summary?.totalShares ?? '0',
        totalShareholders: summary?.totalShareholders ?? 0,
        trigger: (data?.trigger as string) ?? 'manual',
        notes: item.notes,
        stateHash: item.stateHash,
        createdAt: item.createdAt.toISOString(),
      };
    });

    return { items: shapedItems, total };
  }

  /**
   * Create a manual cap table snapshot.
   *
   * Captures the current state of the cap table as a point-in-time record.
   * Snapshot date must not be in the future.
   */
  async createSnapshot(companyId: string, dto: CreateSnapshotDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, status: true, entityType: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    if (company.status !== 'ACTIVE') {
      throw new BusinessRuleException(
        'CAP_COMPANY_NOT_ACTIVE',
        'errors.cap.companyNotActive',
      );
    }

    const snapshotDate = new Date(dto.snapshotDate);
    const now = new Date();

    if (snapshotDate > now) {
      throw new BusinessRuleException(
        'CAP_FUTURE_SNAPSHOT_DATE',
        'errors.cap.futureSnapshotDate',
        { snapshotDate: dto.snapshotDate },
      );
    }

    // Get current cap table state
    const capTableData = await this.getCurrentCapTable(companyId, {
      view: 'current',
    });

    // Compute a state hash for integrity
    const stateHash = this.computeStateHash(capTableData);

    // Store snapshot
    const snapshot = await this.prisma.capTableSnapshot.create({
      data: {
        companyId,
        snapshotDate,
        data: {
          ...capTableData,
          trigger: 'manual',
        },
        notes: dto.notes ?? null,
        stateHash,
      },
    });

    this.logger.log(
      `Cap table snapshot ${snapshot.id} created for company ${companyId} (date: ${dto.snapshotDate})`,
    );

    return {
      id: snapshot.id,
      snapshotDate: snapshot.snapshotDate.toISOString(),
      totalShares: capTableData.summary.totalShares,
      totalShareholders: capTableData.summary.totalShareholders,
      stateHash: snapshot.stateHash,
      notes: snapshot.notes,
      createdAt: snapshot.createdAt.toISOString(),
    };
  }

  /**
   * Create an automatic cap table snapshot after a cap-table-mutating event.
   *
   * Called internally after transaction confirmation, funding round close,
   * option exercise confirmation, or convertible conversion.
   * Unlike manual snapshots, this does not validate company status (the
   * calling service already validated it) and sets trigger to the event type.
   *
   * Fire-and-forget: errors are logged but never propagated to the caller.
   */
  async createAutoSnapshot(
    companyId: string,
    trigger: string,
    notes?: string,
  ): Promise<void> {
    try {
      const capTableData = await this.getCurrentCapTable(companyId, {
        view: 'current',
      });

      const stateHash = this.computeStateHash(capTableData);

      const snapshot = await this.prisma.capTableSnapshot.create({
        data: {
          companyId,
          snapshotDate: new Date(),
          data: {
            ...capTableData,
            trigger,
          },
          notes: notes ?? null,
          stateHash,
        },
      });

      this.logger.log(
        `Auto-snapshot ${snapshot.id} created for company ${companyId} (trigger: ${trigger})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create auto-snapshot for company ${companyId} (trigger: ${trigger}): ${error.message}`,
      );
    }
  }

  /**
   * Export cap table in OCT (Open Cap Table) JSON format.
   *
   * Maps Brazilian share class types to OCT standard stock class types.
   */
  async exportOct(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        entityType: true,
        cnpj: true,
        foundedDate: true,
      },
    });
    if (!company) throw new NotFoundException('company', companyId);

    // Get share classes
    const shareClasses = await this.prisma.shareClass.findMany({
      where: { companyId },
      orderBy: { className: 'asc' },
    });

    // Get shareholders with shareholdings
    const shareholders = await this.prisma.shareholder.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: {
        shareholdings: {
          include: {
            shareClass: {
              select: { id: true, className: true },
            },
          },
        },
      },
    });

    // Map to OCT format
    const octStockClasses = shareClasses.map((sc) => ({
      id: sc.id,
      name: sc.className,
      classType: this.mapShareClassToOct(sc.type),
      authorizedShares: sc.totalAuthorized.toString(),
      issuedShares: sc.totalIssued.toString(),
      votesPerShare: sc.votesPerShare,
      liquidationPreferenceMultiple: sc.liquidationPreferenceMultiple?.toString() ?? null,
      participatingPreferred: sc.participatingRights,
      seniority: sc.seniority,
    }));

    const octStockholders = shareholders.map((sh) => ({
      id: sh.id,
      name: sh.name,
      stakeholderType: sh.type,
      taxId: sh.cpfCnpj ? this.maskTaxId(sh.cpfCnpj) : null,
      nationality: sh.nationality,
      isForeign: sh.isForeign,
    }));

    const octStockIssuances = shareholders.flatMap((sh) =>
      sh.shareholdings.map((holding) => ({
        id: holding.id,
        stockholderId: sh.id,
        stockClassId: holding.shareClassId,
        stockClassName: holding.shareClass.className,
        quantity: holding.quantity.toString(),
        issuedAt: holding.createdAt.toISOString(),
      })),
    );

    this.logger.log(
      `OCT export generated for company ${companyId}: ${octStockholders.length} stockholders, ${octStockIssuances.length} issuances`,
    );

    return {
      ocfVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      issuer: {
        id: company.id,
        legalName: company.name,
        entityType: company.entityType,
        jurisdiction: 'BR',
        taxId: company.cnpj,
        foundedDate: company.foundedDate?.toISOString() ?? null,
      },
      stockClasses: octStockClasses,
      stockholders: octStockholders,
      stockIssuances: octStockIssuances,
    };
  }

  /**
   * Recalculate ownership and voting percentages for all shareholdings in a company.
   *
   * Called after transactions that change the cap table.
   * Updates all Shareholding records with correct percentages.
   */
  async recalculateOwnership(companyId: string) {
    const shareholdings = await this.prisma.shareholding.findMany({
      where: { companyId },
      include: {
        shareClass: {
          select: { votesPerShare: true },
        },
      },
    });

    if (shareholdings.length === 0) return;

    const totalShares = shareholdings.reduce(
      (sum, sh) => sum.plus(sh.quantity),
      new Prisma.Decimal(0),
    );

    const totalVotingPower = shareholdings.reduce(
      (sum, sh) => sum.plus(sh.quantity.mul(sh.shareClass.votesPerShare)),
      new Prisma.Decimal(0),
    );

    // Batch update all shareholdings
    await this.prisma.$transaction(
      shareholdings.map((sh) => {
        const ownershipPct = totalShares.isZero()
          ? new Prisma.Decimal(0)
          : sh.quantity.div(totalShares).mul(100);

        const votingPower = sh.quantity.mul(sh.shareClass.votesPerShare);
        const votingPowerPct = totalVotingPower.isZero()
          ? new Prisma.Decimal(0)
          : votingPower.div(totalVotingPower).mul(100);

        return this.prisma.shareholding.update({
          where: { id: sh.id },
          data: {
            ownershipPct: ownershipPct.toDecimalPlaces(6),
            votingPowerPct: votingPowerPct.toDecimalPlaces(6),
          },
        });
      }),
    );

    // Validate total ownership sums to ~100%
    const recalculated = await this.prisma.shareholding.findMany({
      where: { companyId },
      select: { ownershipPct: true },
    });

    const totalOwnership = recalculated.reduce(
      (sum, sh) => sum.plus(sh.ownershipPct),
      new Prisma.Decimal(0),
    );

    const tolerance = new Prisma.Decimal('0.02');
    const diff = totalOwnership.minus(100).abs();

    if (diff.greaterThan(tolerance) && !totalShares.isZero()) {
      this.logger.warn(
        `Ownership discrepancy for company ${companyId}: total=${totalOwnership.toString()}% (diff=${diff.toString()}%)`,
      );
    }

    this.logger.log(
      `Ownership recalculated for company ${companyId}: ${shareholdings.length} shareholdings updated`,
    );
  }

  /**
   * Calculate vested options for a grant based on its vesting schedule.
   */
  private calculateVestedOptions(grant: {
    quantity: Prisma.Decimal;
    grantDate: Date;
    cliffMonths: number | null;
    vestingDurationMonths: number | null;
    cliffPercentage: Prisma.Decimal | null;
  }): Prisma.Decimal {
    const now = new Date();
    const grantDate = new Date(grant.grantDate);
    const totalQuantity = new Prisma.Decimal(grant.quantity);

    // If no vesting schedule, all are vested immediately
    if (!grant.vestingDurationMonths) {
      return totalQuantity;
    }

    // Calculate months elapsed since grant
    const monthsElapsed =
      (now.getFullYear() - grantDate.getFullYear()) * 12 +
      (now.getMonth() - grantDate.getMonth());

    // Check cliff
    if (grant.cliffMonths && monthsElapsed < grant.cliffMonths) {
      return new Prisma.Decimal(0);
    }

    // If past the full vesting period, all are vested
    if (monthsElapsed >= grant.vestingDurationMonths) {
      return totalQuantity;
    }

    // Calculate proportional vesting
    let vested = new Prisma.Decimal(0);

    // Add cliff portion if applicable
    if (grant.cliffMonths && grant.cliffPercentage) {
      vested = totalQuantity.mul(grant.cliffPercentage).div(100);
    }

    // Linear vesting for the remainder
    const remainingQuantity = totalQuantity.minus(vested);
    const remainingMonths = grant.vestingDurationMonths - (grant.cliffMonths ?? 0);

    if (remainingMonths > 0) {
      const monthsPastCliff = monthsElapsed - (grant.cliffMonths ?? 0);
      const linearVested = remainingQuantity.mul(monthsPastCliff).div(remainingMonths);
      vested = vested.plus(linearVested);
    }

    // Never exceed total quantity
    return vested.greaterThan(totalQuantity) ? totalQuantity : vested;
  }

  /**
   * Compute a SHA-256 hash of cap table state for integrity verification.
   */
  private computeStateHash(capTableData: {
    entries: Array<{
      shareholderId: string;
      shares: string;
      ownershipPercentage: string;
    }>;
    summary: { totalShares: string };
  }): string {
    const content = capTableData.entries
      .sort((a, b) => a.shareholderId.localeCompare(b.shareholderId))
      .map(
        (e) =>
          `${e.shareholderId}|${e.shares}|${e.ownershipPercentage}`,
      )
      .join('\n');

    return createHash('sha256')
      .update(content + '\n' + capTableData.summary.totalShares)
      .digest('hex');
  }

  /**
   * Map Brazilian share class type to OCT standard class type.
   */
  private mapShareClassToOct(type: string): string {
    switch (type) {
      case 'QUOTA':
        return 'COMMON'; // Ltda quotas map to OCT COMMON with custom fields
      case 'COMMON_SHARES':
        return 'COMMON';
      case 'PREFERRED_SHARES':
        return 'PREFERRED';
      default:
        return 'COMMON';
    }
  }

  /**
   * Mask a tax ID for export (CPF: ***.XXX.XXX-XX, CNPJ: XX.XXX.XXX/XXXX-**).
   */
  private maskTaxId(taxId: string): string {
    const digits = taxId.replace(/\D/g, '');
    if (digits.length === 11) {
      // CPF: show last 2 digits only
      return `***.***.*${digits.slice(8, 9)}*-${digits.slice(9)}`;
    }
    if (digits.length === 14) {
      // CNPJ: show last 2 digits only
      return `**.***.***/${digits.slice(8, 12)}-${digits.slice(12)}`;
    }
    return taxId;
  }
}
