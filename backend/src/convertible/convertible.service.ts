import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BusinessRuleException,
  ConflictException,
} from '../common/filters/app-exception';
import { parseSort } from '../common/helpers/sort-parser';
import { CreateConvertibleDto } from './dto/create-convertible.dto';
import { UpdateConvertibleDto } from './dto/update-convertible.dto';
import { ListConvertiblesQueryDto } from './dto/list-convertibles-query.dto';
import { RedeemConvertibleDto } from './dto/redeem-convertible.dto';
import { CancelConvertibleDto } from './dto/cancel-convertible.dto';
import { ConvertConvertibleDto } from './dto/convert-convertible.dto';

// Valid status transitions per the state machine
const STATUS_TRANSITIONS: Record<string, string[]> = {
  OUTSTANDING: ['CONVERTED', 'REDEEMED', 'MATURED', 'CANCELLED'],
  MATURED: ['OUTSTANDING', 'CONVERTED', 'REDEEMED'],
  // CONVERTED, REDEEMED, CANCELLED are terminal
};

const SORTABLE_FIELDS = [
  'createdAt',
  'principalAmount',
  'maturityDate',
  'issueDate',
  'status',
  'accruedInterest',
];

@Injectable()
export class ConvertibleService {
  private readonly logger = new Logger(ConvertibleService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CREATE ──────────────────────────────────────────────────────────

  async create(companyId: string, dto: CreateConvertibleDto, userId: string) {
    // Verify company is ACTIVE
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: { id: true, status: true },
    });
    if (!company) throw new NotFoundException('company', companyId);
    if (company.status !== 'ACTIVE') {
      throw new BusinessRuleException(
        'CONV_COMPANY_NOT_ACTIVE',
        'errors.conv.companyNotActive',
      );
    }

    // Verify shareholder exists in this company
    const shareholder = await this.prisma.shareholder.findFirst({
      where: { id: dto.shareholderId, companyId },
      select: { id: true },
    });
    if (!shareholder) {
      throw new NotFoundException('shareholder', dto.shareholderId);
    }

    // Validate maturity date > issue date
    const issueDate = new Date(dto.issueDate);
    const maturityDate = new Date(dto.maturityDate);
    if (maturityDate <= issueDate) {
      throw new BusinessRuleException(
        'CONV_MATURITY_BEFORE_ISSUE',
        'errors.conv.maturityBeforeIssue',
        { issueDate: dto.issueDate, maturityDate: dto.maturityDate },
      );
    }

    // Validate principal > 0
    const principal = new Prisma.Decimal(dto.principalAmount);
    if (principal.lte(0)) {
      throw new BusinessRuleException(
        'CONV_INVALID_PRINCIPAL',
        'errors.conv.invalidPrincipal',
      );
    }

    // Validate interest rate (warn at > 30%)
    const rate = new Prisma.Decimal(dto.interestRate);
    if (rate.gt(new Prisma.Decimal('0.30'))) {
      throw new BusinessRuleException(
        'CONV_HIGH_INTEREST_RATE',
        'errors.conv.highInterestRate',
        { interestRate: dto.interestRate },
      );
    }

    // Validate target share class if provided
    if (dto.targetShareClassId) {
      const shareClass = await this.prisma.shareClass.findFirst({
        where: { id: dto.targetShareClassId, companyId },
        select: { id: true },
      });
      if (!shareClass) {
        throw new NotFoundException('shareClass', dto.targetShareClassId);
      }
    }

    const data: Prisma.ConvertibleInstrumentCreateInput = {
      company: { connect: { id: companyId } },
      shareholder: { connect: { id: dto.shareholderId } },
      instrumentType: dto.instrumentType,
      principalAmount: principal,
      interestRate: rate,
      interestType: dto.interestType || 'SIMPLE',
      discountRate: dto.discountRate
        ? new Prisma.Decimal(dto.discountRate)
        : null,
      valuationCap: dto.valuationCap
        ? new Prisma.Decimal(dto.valuationCap)
        : null,
      qualifiedFinancingThreshold: dto.qualifiedFinancingThreshold
        ? new Prisma.Decimal(dto.qualifiedFinancingThreshold)
        : null,
      conversionTrigger: dto.conversionTrigger || null,
      autoConvert: dto.autoConvert ?? false,
      mfnClause: dto.mfnClause ?? false,
      issueDate: issueDate,
      maturityDate: maturityDate,
      notes: dto.notes || null,
      createdBy: userId,
    };

    if (dto.targetShareClassId) {
      data.targetShareClass = { connect: { id: dto.targetShareClassId } };
    }

    return this.prisma.convertibleInstrument.create({
      data,
      include: {
        shareholder: { select: { id: true, name: true, type: true } },
        targetShareClass: { select: { id: true, className: true } },
      },
    });
  }

  // ─── LIST ────────────────────────────────────────────────────────────

  async findAll(companyId: string, query: ListConvertiblesQueryDto) {
    const where: Prisma.ConvertibleInstrumentWhereInput = { companyId };
    if (query.status) where.status = query.status;
    if (query.shareholderId) where.shareholderId = query.shareholderId;

    const sortFields = parseSort(query.sort, SORTABLE_FIELDS);
    const orderBy = sortFields.map((sf) => ({ [sf.field]: sf.direction }));

    const skip = (query.page - 1) * query.limit;

    const [items, total, aggregate] = await Promise.all([
      this.prisma.convertibleInstrument.findMany({
        where,
        orderBy,
        skip,
        take: query.limit,
        include: {
          shareholder: { select: { id: true, name: true, type: true } },
          targetShareClass: { select: { id: true, className: true } },
        },
      }),
      this.prisma.convertibleInstrument.count({ where }),
      this.prisma.convertibleInstrument.aggregate({
        where: { companyId, status: 'OUTSTANDING' },
        _sum: { principalAmount: true, accruedInterest: true },
        _count: true,
      }),
    ]);

    const totalPrincipal =
      aggregate._sum.principalAmount ?? new Prisma.Decimal(0);
    const totalAccruedInterest =
      aggregate._sum.accruedInterest ?? new Prisma.Decimal(0);
    const totalValue = totalPrincipal.add(totalAccruedInterest);

    const enrichedItems = items.map((item) => ({
      ...item,
      principalAmount: item.principalAmount.toString(),
      accruedInterest: item.accruedInterest.toString(),
      interestRate: item.interestRate.toString(),
      discountRate: item.discountRate?.toString() ?? null,
      valuationCap: item.valuationCap?.toString() ?? null,
      qualifiedFinancingThreshold:
        item.qualifiedFinancingThreshold?.toString() ?? null,
      totalValue: item.principalAmount.add(item.accruedInterest).toString(),
      daysToMaturity: this.calculateDaysToMaturity(item.maturityDate),
    }));

    return {
      items: enrichedItems,
      total,
      summary: {
        totalOutstanding: aggregate._count,
        totalPrincipal: totalPrincipal.toString(),
        totalAccruedInterest: totalAccruedInterest.toString(),
        totalValue: totalValue.toString(),
      },
    };
  }

  // ─── FIND BY ID ──────────────────────────────────────────────────────

  async findById(companyId: string, convertibleId: string) {
    const convertible = await this.prisma.convertibleInstrument.findFirst({
      where: { id: convertibleId, companyId },
      include: {
        shareholder: { select: { id: true, name: true, type: true } },
        targetShareClass: { select: { id: true, className: true } },
      },
    });

    if (!convertible) {
      throw new NotFoundException('convertible', convertibleId);
    }

    return {
      ...convertible,
      principalAmount: convertible.principalAmount.toString(),
      accruedInterest: convertible.accruedInterest.toString(),
      interestRate: convertible.interestRate.toString(),
      discountRate: convertible.discountRate?.toString() ?? null,
      valuationCap: convertible.valuationCap?.toString() ?? null,
      qualifiedFinancingThreshold:
        convertible.qualifiedFinancingThreshold?.toString() ?? null,
      totalConversionAmount: convertible.principalAmount
        .add(convertible.accruedInterest)
        .toString(),
      daysToMaturity: this.calculateDaysToMaturity(convertible.maturityDate),
    };
  }

  // ─── INTEREST CALCULATION ────────────────────────────────────────────

  /**
   * Calculate accrued interest on-the-fly from issue date to now.
   * Used by interest breakdown, conversion scenarios, and actual conversion
   * to ensure interest is always current (not stale DB value).
   */
  private calculateAccruedInterest(convertible: {
    principalAmount: Prisma.Decimal;
    interestRate: Prisma.Decimal;
    interestType: string;
    issueDate: Date;
  }): Prisma.Decimal {
    const now = new Date();
    const issueDate = new Date(convertible.issueDate);
    const daysElapsed = Math.max(
      0,
      Math.floor(
        (now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    const principal = convertible.principalAmount;
    const rate = convertible.interestRate;

    if (convertible.interestType === 'SIMPLE') {
      // I = P × r × (days / 365)
      return principal
        .mul(rate)
        .mul(new Prisma.Decimal(daysElapsed))
        .div(new Prisma.Decimal(365));
    } else {
      // A = P × (1 + r/365)^days, interest = A - P
      const dailyRate = rate.div(new Prisma.Decimal(365));
      const onePlusDailyRate = new Prisma.Decimal(1).add(dailyRate);
      const compoundFactor = Math.pow(
        onePlusDailyRate.toNumber(),
        daysElapsed,
      );
      return principal
        .mul(new Prisma.Decimal(compoundFactor))
        .sub(principal);
    }
  }

  async getInterestBreakdown(companyId: string, convertibleId: string) {
    const convertible = await this.prisma.convertibleInstrument.findFirst({
      where: { id: convertibleId, companyId },
    });

    if (!convertible) {
      throw new NotFoundException('convertible', convertibleId);
    }

    const now = new Date();
    const issueDate = new Date(convertible.issueDate);
    const daysElapsed = Math.max(
      0,
      Math.floor(
        (now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

    const calculatedInterest = this.calculateAccruedInterest(convertible);

    // Generate monthly breakdown
    const breakdown = this.generateInterestBreakdown(
      convertible.principalAmount,
      convertible.interestRate,
      convertible.interestType,
      issueDate,
      now,
    );

    return {
      convertibleId: convertible.id,
      principalAmount: convertible.principalAmount.toString(),
      interestRate: convertible.interestRate.toString(),
      interestType: convertible.interestType,
      issueDate: convertible.issueDate.toISOString(),
      calculationDate: now.toISOString(),
      daysElapsed,
      accruedInterest: calculatedInterest.toString(),
      totalValue: convertible.principalAmount.add(calculatedInterest).toString(),
      interestBreakdown: breakdown,
    };
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────

  async update(
    companyId: string,
    convertibleId: string,
    dto: UpdateConvertibleDto,
  ) {
    const convertible = await this.prisma.convertibleInstrument.findFirst({
      where: { id: convertibleId, companyId },
    });

    if (!convertible) {
      throw new NotFoundException('convertible', convertibleId);
    }

    // Only OUTSTANDING or MATURED can be updated
    if (
      convertible.status !== 'OUTSTANDING' &&
      convertible.status !== 'MATURED'
    ) {
      throw new BusinessRuleException(
        'CONV_CANNOT_UPDATE',
        'errors.conv.cannotUpdate',
        { currentStatus: convertible.status },
      );
    }

    const data: Prisma.ConvertibleInstrumentUpdateInput = {};

    if (dto.discountRate !== undefined) {
      data.discountRate = new Prisma.Decimal(dto.discountRate);
    }
    if (dto.valuationCap !== undefined) {
      data.valuationCap = new Prisma.Decimal(dto.valuationCap);
    }
    if (dto.qualifiedFinancingThreshold !== undefined) {
      data.qualifiedFinancingThreshold = new Prisma.Decimal(
        dto.qualifiedFinancingThreshold,
      );
    }
    if (dto.maturityDate !== undefined) {
      const newMaturityDate = new Date(dto.maturityDate);
      if (newMaturityDate <= convertible.issueDate) {
        throw new BusinessRuleException(
          'CONV_MATURITY_BEFORE_ISSUE',
          'errors.conv.maturityBeforeIssue',
          {
            issueDate: convertible.issueDate.toISOString(),
            maturityDate: dto.maturityDate,
          },
        );
      }
      data.maturityDate = newMaturityDate;

      // Maturity extension: MATURED → OUTSTANDING when maturity date is extended
      if (
        convertible.status === 'MATURED' &&
        newMaturityDate > new Date()
      ) {
        data.status = 'OUTSTANDING';
      }
    }
    if (dto.conversionTrigger !== undefined) {
      data.conversionTrigger = dto.conversionTrigger;
    }
    if (dto.targetShareClassId !== undefined) {
      const shareClass = await this.prisma.shareClass.findFirst({
        where: { id: dto.targetShareClassId, companyId },
        select: { id: true },
      });
      if (!shareClass) {
        throw new NotFoundException('shareClass', dto.targetShareClassId);
      }
      data.targetShareClass = { connect: { id: dto.targetShareClassId } };
    }
    if (dto.autoConvert !== undefined) data.autoConvert = dto.autoConvert;
    if (dto.mfnClause !== undefined) data.mfnClause = dto.mfnClause;
    if (dto.interestType !== undefined) data.interestType = dto.interestType;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.convertibleInstrument.update({
      where: { id: convertibleId },
      data,
      include: {
        shareholder: { select: { id: true, name: true, type: true } },
        targetShareClass: { select: { id: true, className: true } },
      },
    });
  }

  // ─── REDEEM ──────────────────────────────────────────────────────────

  async redeem(
    companyId: string,
    convertibleId: string,
    dto: RedeemConvertibleDto,
  ) {
    const convertible = await this.prisma.convertibleInstrument.findFirst({
      where: { id: convertibleId, companyId },
    });

    if (!convertible) {
      throw new NotFoundException('convertible', convertibleId);
    }

    this.validateStatusTransition(convertible.status, 'REDEEMED');

    return this.prisma.convertibleInstrument.update({
      where: { id: convertibleId },
      data: {
        status: 'REDEEMED',
        redeemedAt: new Date(),
        notes: dto.notes
          ? `${convertible.notes || ''}\n[Redemption] ${dto.notes}`.trim()
          : convertible.notes,
        conversionData: {
          redemptionAmount: dto.redemptionAmount,
          paymentReference: dto.paymentReference || null,
          redeemedAt: new Date().toISOString(),
        },
      },
    });
  }

  // ─── CANCEL ──────────────────────────────────────────────────────────

  async cancel(
    companyId: string,
    convertibleId: string,
    dto: CancelConvertibleDto,
  ) {
    const convertible = await this.prisma.convertibleInstrument.findFirst({
      where: { id: convertibleId, companyId },
    });

    if (!convertible) {
      throw new NotFoundException('convertible', convertibleId);
    }

    this.validateStatusTransition(convertible.status, 'CANCELLED');

    return this.prisma.convertibleInstrument.update({
      where: { id: convertibleId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        notes: `${convertible.notes || ''}\n[Cancelled] ${dto.cancellationReason}`.trim(),
      },
    });
  }

  // ─── CONVERSION SCENARIOS ────────────────────────────────────────────

  async getConversionScenarios(
    companyId: string,
    convertibleId: string,
    valuations?: string,
  ) {
    const convertible = await this.prisma.convertibleInstrument.findFirst({
      where: { id: convertibleId, companyId },
    });

    if (!convertible) {
      throw new NotFoundException('convertible', convertibleId);
    }

    // Parse valuations from comma-separated string or use defaults
    let valuationList: Prisma.Decimal[];
    if (valuations) {
      valuationList = valuations.split(',').map((v) => {
        const d = new Prisma.Decimal(v.trim());
        if (d.lte(0)) {
          throw new BusinessRuleException(
            'CONV_INVALID_VALUATION',
            'errors.conv.invalidValuation',
            { valuation: v.trim() },
          );
        }
        return d;
      });
    } else {
      valuationList = [2_000_000, 4_000_000, 6_000_000, 8_000_000, 10_000_000].map(
        (v) => new Prisma.Decimal(v),
      );
    }

    // Get pre-money shares (total issued shares across all classes)
    const shareClasses = await this.prisma.shareClass.findMany({
      where: { companyId },
      select: { totalIssued: true },
    });

    const preMoneyShares = shareClasses.reduce(
      (sum, sc) => sum.add(sc.totalIssued),
      new Prisma.Decimal(0),
    );

    if (preMoneyShares.eq(0)) {
      throw new BusinessRuleException(
        'CONV_ZERO_PREMONEY_SHARES',
        'errors.conv.zeroPremoneyShares',
      );
    }

    // Calculate interest on-the-fly instead of reading stale DB value (BUG-4 fix)
    const calculatedInterest = this.calculateAccruedInterest(convertible);
    const conversionAmount = convertible.principalAmount.add(calculatedInterest);
    const discountRate = convertible.discountRate;
    const valuationCap = convertible.valuationCap;

    // Calculate cap triggers above (the valuation at which cap becomes more favorable)
    let capTriggersAbove: string | null = null;
    if (valuationCap && discountRate && discountRate.gt(0)) {
      const oneMinusDiscount = new Prisma.Decimal(1).sub(discountRate);
      capTriggersAbove = valuationCap.div(oneMinusDiscount).toString();
    }

    const scenarios = valuationList.map((hypotheticalValuation) => {
      const roundPricePerShare = hypotheticalValuation.div(preMoneyShares);

      // Discount method
      let discountMethod: {
        conversionPrice: string;
        sharesIssued: string;
        ownershipPercentage: string;
      } | null = null;
      if (discountRate && discountRate.gt(0)) {
        const discountPrice = roundPricePerShare.mul(
          new Prisma.Decimal(1).sub(discountRate),
        );
        const discountShares = conversionAmount.div(discountPrice);
        const discountOwnership = discountShares
          .div(preMoneyShares.add(discountShares))
          .mul(100);
        discountMethod = {
          conversionPrice: discountPrice.toString(),
          sharesIssued: discountShares.toFixed(0),
          ownershipPercentage: discountOwnership.toFixed(2),
        };
      }

      // Cap method
      let capMethod: {
        conversionPrice: string;
        sharesIssued: string;
        ownershipPercentage: string;
      } | null = null;
      if (valuationCap) {
        const capPrice = valuationCap.div(preMoneyShares);
        const effectiveCapPrice = capPrice.lt(roundPricePerShare)
          ? capPrice
          : roundPricePerShare;
        const capShares = conversionAmount.div(effectiveCapPrice);
        const capOwnership = capShares
          .div(preMoneyShares.add(capShares))
          .mul(100);
        capMethod = {
          conversionPrice: effectiveCapPrice.toString(),
          sharesIssued: capShares.toFixed(0),
          ownershipPercentage: capOwnership.toFixed(2),
        };
      }

      // Round price method (no discount, no cap)
      const roundPriceShares = conversionAmount.div(roundPricePerShare);
      const roundPriceOwnership = roundPriceShares
        .div(preMoneyShares.add(roundPriceShares))
        .mul(100);

      // MFN: pick the method giving the most shares (lowest price)
      let bestMethod: 'DISCOUNT' | 'CAP' | 'ROUND_PRICE' = 'ROUND_PRICE';
      let finalPrice = roundPricePerShare;
      let finalShares = roundPriceShares;
      let finalOwnership = roundPriceOwnership;

      if (discountMethod) {
        const discountShares = new Prisma.Decimal(discountMethod.sharesIssued);
        if (discountShares.gt(finalShares)) {
          bestMethod = 'DISCOUNT';
          finalPrice = new Prisma.Decimal(discountMethod.conversionPrice);
          finalShares = discountShares;
          finalOwnership = new Prisma.Decimal(
            discountMethod.ownershipPercentage,
          );
        }
      }

      if (capMethod) {
        const capShares = new Prisma.Decimal(capMethod.sharesIssued);
        if (capShares.gt(finalShares)) {
          bestMethod = 'CAP';
          finalPrice = new Prisma.Decimal(capMethod.conversionPrice);
          finalShares = capShares;
          finalOwnership = new Prisma.Decimal(capMethod.ownershipPercentage);
        }
      }

      const dilution = finalShares
        .div(preMoneyShares.add(finalShares))
        .mul(100);

      return {
        hypotheticalValuation: hypotheticalValuation.toString(),
        preMoneyShares: preMoneyShares.toNumber(),
        roundPricePerShare: roundPricePerShare.toString(),
        discountMethod,
        capMethod,
        bestMethod,
        finalConversionPrice: finalPrice.toString(),
        finalSharesIssued: finalShares.toFixed(0),
        finalOwnershipPercentage: finalOwnership.toFixed(2),
        dilutionToExisting: dilution.toFixed(2),
      };
    });

    return {
      convertibleId: convertible.id,
      currentConversionAmount: conversionAmount.toString(),
      summary: {
        valuationCap: valuationCap?.toString() ?? null,
        discountRate: discountRate?.toString() ?? null,
        capTriggersAbove,
      },
      scenarios,
    };
  }

  // ─── CONVERT TO EQUITY ───────────────────────────────────────────────

  async convert(
    companyId: string,
    convertibleId: string,
    dto: ConvertConvertibleDto,
    userId: string,
  ) {
    const convertible = await this.prisma.convertibleInstrument.findFirst({
      where: { id: convertibleId, companyId },
      include: {
        shareholder: { select: { id: true, name: true } },
      },
    });

    if (!convertible) {
      throw new NotFoundException('convertible', convertibleId);
    }

    // Must be OUTSTANDING or MATURED
    if (
      convertible.status !== 'OUTSTANDING' &&
      convertible.status !== 'MATURED'
    ) {
      throw new ConflictException(
        'CONV_ALREADY_CONVERTED',
        'errors.conv.alreadyConverted',
        { currentStatus: convertible.status },
      );
    }

    // Investimento-Anjo holding period check
    // The Prisma schema doesn't have minimumHoldingPeriodEnd, so we skip this for now
    // Future: check convertible.investimentoAnjoData?.minimumHoldingPeriodEnd

    // Verify funding round exists and is in the same company
    const fundingRound = await this.prisma.fundingRound.findFirst({
      where: { id: dto.fundingRoundId, companyId },
      select: { id: true, targetAmount: true, status: true },
    });
    if (!fundingRound) {
      throw new NotFoundException('round', dto.fundingRoundId);
    }

    // Check qualified financing threshold
    if (convertible.qualifiedFinancingThreshold) {
      if (
        fundingRound.targetAmount.lt(
          convertible.qualifiedFinancingThreshold,
        )
      ) {
        throw new BusinessRuleException(
          'CONV_TRIGGER_NOT_MET',
          'errors.conv.triggerNotMet',
          {
            threshold:
              convertible.qualifiedFinancingThreshold.toString(),
            roundAmount: fundingRound.targetAmount.toString(),
          },
        );
      }
    }

    // Verify share class exists
    const shareClass = await this.prisma.shareClass.findFirst({
      where: { id: dto.shareClassId, companyId },
      select: { id: true, className: true, totalIssued: true, totalAuthorized: true },
    });
    if (!shareClass) {
      throw new NotFoundException('shareClass', dto.shareClassId);
    }

    // Get pre-money shares for conversion calculation
    const allShareClasses = await this.prisma.shareClass.findMany({
      where: { companyId },
      select: { totalIssued: true },
    });
    const preMoneyShares = allShareClasses.reduce(
      (sum, sc) => sum.add(sc.totalIssued),
      new Prisma.Decimal(0),
    );

    if (preMoneyShares.eq(0)) {
      throw new BusinessRuleException(
        'CONV_ZERO_PREMONEY_SHARES',
        'errors.conv.zeroPremoneyShares',
      );
    }

    // Calculate conversion — use on-the-fly interest instead of stale DB value (BUG-4 fix)
    const roundValuation = new Prisma.Decimal(dto.roundValuation);
    const roundPricePerShare = roundValuation.div(preMoneyShares);
    const calculatedInterest = this.calculateAccruedInterest(convertible);
    const conversionAmount = convertible.principalAmount.add(calculatedInterest);

    // Calculate all methods and pick best (MFN)
    let bestPrice = roundPricePerShare;
    let methodUsed: 'DISCOUNT' | 'CAP' | 'ROUND_PRICE' = 'ROUND_PRICE';

    if (convertible.discountRate && convertible.discountRate.gt(0)) {
      const discountPrice = roundPricePerShare.mul(
        new Prisma.Decimal(1).sub(convertible.discountRate),
      );
      if (discountPrice.lt(bestPrice)) {
        bestPrice = discountPrice;
        methodUsed = 'DISCOUNT';
      }
    }

    if (convertible.valuationCap) {
      const capPrice = convertible.valuationCap.div(preMoneyShares);
      if (capPrice.lt(bestPrice)) {
        bestPrice = capPrice;
        methodUsed = 'CAP';
      }
    }

    const sharesIssued = conversionAmount.div(bestPrice);
    const sharesIssuedInt = parseInt(sharesIssued.toFixed(0), 10);

    // Check authorized limit
    const newTotalIssued = shareClass.totalIssued.add(
      new Prisma.Decimal(sharesIssuedInt),
    );
    if (newTotalIssued.gt(shareClass.totalAuthorized)) {
      throw new BusinessRuleException(
        'CONV_EXCEEDS_AUTHORIZED',
        'errors.conv.exceedsAuthorized',
        {
          authorized: shareClass.totalAuthorized.toString(),
          currentIssued: shareClass.totalIssued.toString(),
          newShares: sharesIssuedInt.toString(),
        },
      );
    }

    const conversionData = {
      conversionAmount: conversionAmount.toString(),
      conversionPricePerShare: bestPrice.toString(),
      sharesIssued: sharesIssuedInt,
      roundValuation: dto.roundValuation,
      methodUsed,
      executedBy: userId,
      executedAt: new Date().toISOString(),
      fundingRoundId: dto.fundingRoundId,
      notes: dto.notes || null,
    };

    // Execute atomically
    return this.prisma.$transaction(async (tx) => {
      // 1. Create ISSUANCE transaction
      const transaction = await tx.transaction.create({
        data: {
          companyId,
          type: 'ISSUANCE',
          status: 'CONFIRMED',
          shareClassId: dto.shareClassId,
          toShareholderId: convertible.shareholderId,
          quantity: new Prisma.Decimal(sharesIssuedInt),
          pricePerShare: bestPrice,
          totalValue: conversionAmount,
          notes: `Convertible conversion: ${convertible.instrumentType} → ${shareClass.className}. Method: ${methodUsed}.${dto.notes ? ' ' + dto.notes : ''}`,
          confirmedAt: new Date(),
          createdBy: userId,
        },
      });

      // 2. Upsert shareholding
      const existingHolding = await tx.shareholding.findFirst({
        where: {
          companyId,
          shareholderId: convertible.shareholderId,
          shareClassId: dto.shareClassId,
        },
      });

      if (existingHolding) {
        await tx.shareholding.update({
          where: { id: existingHolding.id },
          data: {
            quantity: existingHolding.quantity.add(
              new Prisma.Decimal(sharesIssuedInt),
            ),
          },
        });
      } else {
        await tx.shareholding.create({
          data: {
            companyId,
            shareholderId: convertible.shareholderId,
            shareClassId: dto.shareClassId,
            quantity: new Prisma.Decimal(sharesIssuedInt),
            ownershipPct: new Prisma.Decimal(0),
            votingPowerPct: new Prisma.Decimal(0),
          },
        });
      }

      // 3. Increment ShareClass.totalIssued
      await tx.shareClass.update({
        where: { id: dto.shareClassId },
        data: {
          totalIssued: {
            increment: new Prisma.Decimal(sharesIssuedInt),
          },
        },
      });

      // 4. Update convertible status to CONVERTED
      const updated = await tx.convertibleInstrument.update({
        where: { id: convertibleId },
        data: {
          status: 'CONVERTED',
          convertedAt: new Date(),
          conversionData,
          targetShareClass: { connect: { id: dto.shareClassId } },
        },
        include: {
          shareholder: { select: { id: true, name: true } },
          targetShareClass: { select: { id: true, className: true } },
        },
      });

      return {
        ...updated,
        principalAmount: updated.principalAmount.toString(),
        accruedInterest: updated.accruedInterest.toString(),
        interestRate: updated.interestRate.toString(),
        transactionId: transaction.id,
        conversionData,
      };
    });
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────

  private validateStatusTransition(
    currentStatus: string,
    targetStatus: string,
  ): void {
    const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
      throw new BusinessRuleException(
        'CONV_INVALID_STATUS_TRANSITION',
        'errors.conv.invalidStatusTransition',
        { currentStatus, targetStatus },
      );
    }
  }

  private calculateDaysToMaturity(maturityDate: Date): number {
    const now = new Date();
    const diff = maturityDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  private generateInterestBreakdown(
    principal: Prisma.Decimal,
    rate: Prisma.Decimal,
    interestType: string,
    startDate: Date,
    endDate: Date,
  ): Array<{ period: string; days: number; interestAccrued: string }> {
    const breakdown: Array<{
      period: string;
      days: number;
      interestAccrued: string;
    }> = [];

    let currentDate = new Date(startDate);
    let cumulativeInterest = new Prisma.Decimal(0);

    while (currentDate < endDate) {
      const periodStart = new Date(currentDate);
      const periodEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        currentDate.getDate(),
      );
      const actualEnd = periodEnd > endDate ? endDate : periodEnd;

      const days = Math.floor(
        (actualEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (days <= 0) break;

      let periodInterest: Prisma.Decimal;
      if (interestType === 'SIMPLE') {
        periodInterest = principal
          .mul(rate)
          .mul(new Prisma.Decimal(days))
          .div(new Prisma.Decimal(365));
      } else {
        const totalDaysFromStart = Math.floor(
          (actualEnd.getTime() - startDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const dailyRate = rate.div(new Prisma.Decimal(365));
        const factor = Math.pow(
          new Prisma.Decimal(1).add(dailyRate).toNumber(),
          totalDaysFromStart,
        );
        const totalInterest = principal
          .mul(new Prisma.Decimal(factor))
          .sub(principal);
        periodInterest = totalInterest.sub(cumulativeInterest);
        cumulativeInterest = totalInterest;
      }

      breakdown.push({
        period: `${periodStart.toISOString().split('T')[0]} to ${actualEnd.toISOString().split('T')[0]}`,
        days,
        interestAccrued: periodInterest.toFixed(2),
      });

      currentDate = periodEnd;
    }

    return breakdown;
  }
}
