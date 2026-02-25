import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BusinessRuleException,
} from '../common/filters/app-exception';
import { RunWaterfallDto } from './dto/run-waterfall.dto';
import { SaveScenarioDto } from './dto/save-scenario.dto';

// ─── Interfaces ────────────────────────────────────────────────────────────

interface ShareClassInput {
  id: string;
  className: string;
  type: string;
  totalShares: Prisma.Decimal;
  liquidationPreferenceMultiple: Prisma.Decimal;
  participatingRights: boolean;
  participationCap: Prisma.Decimal | null;
  seniority: number;
  originalInvestment: Prisma.Decimal;
}

export interface ShareClassAllocation {
  shareClassId: string;
  shareClassName: string;
  totalShares: string;
  liquidationPreference: string;
  participationProceeds: string;
  totalProceeds: string;
  perShareValue: string;
  roiMultiple: string | null;
  isParticipating: boolean;
  participationCapped: boolean;
}

export interface WaterfallAnalysis {
  exitAmount: string;
  generatedAt: string;
  shareClassResults: ShareClassAllocation[];
  breakeven: {
    exitValue: string;
    description: string;
  };
  unallocatedProceeds: string;
  metadata?: {
    excludedConvertibles?: Array<{
      convertibleId: string;
      reason: string;
    }>;
  };
}

// Internal working structure for the algorithm
interface ClassWorkingData {
  input: ShareClassInput;
  preferenceProceeds: Prisma.Decimal;
  participationProceeds: Prisma.Decimal;
  totalProceeds: Prisma.Decimal;
  capped: boolean;
}

const ZERO = new Prisma.Decimal(0);
const TWO_DP = { rounding: Prisma.Decimal.ROUND_HALF_UP };

@Injectable()
export class ExitWaterfallService {
  private readonly logger = new Logger(ExitWaterfallService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Run Waterfall ─────────────────────────────────────────────────────

  async runWaterfall(
    companyId: string,
    dto: RunWaterfallDto,
  ): Promise<WaterfallAnalysis> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    const exitAmount = new Prisma.Decimal(dto.exitAmount);
    const includeOptions = dto.includeOptions ?? true;
    const includeConvertibles = dto.includeConvertibles ?? true;

    // 1. Load share classes with their data
    const shareClasses = await this.loadShareClassData(companyId);

    if (shareClasses.length === 0) {
      throw new BusinessRuleException(
        'CAP_SHARE_CLASS_NOT_FOUND',
        'errors.cap.shareClassNotFound',
        { companyId },
      );
    }

    // 2. Validate custom share class order if provided
    if (dto.shareClassOrder?.length) {
      this.validateShareClassOrder(dto.shareClassOrder, shareClasses);
    }

    // 3. Add vested unexercised options as-if exercised
    let optionShares = ZERO;
    if (includeOptions) {
      optionShares = await this.getVestedUnexercisedOptions(companyId, shareClasses);
    }

    // 4. Add convertible instruments as-if converted
    let excludedConvertibles: Array<{ convertibleId: string; reason: string }> = [];
    if (includeConvertibles) {
      excludedConvertibles = await this.addConvertibleShares(companyId, shareClasses);
    }

    // 5. Determine stacking order
    const orderedClasses = this.determineStackingOrder(
      shareClasses,
      dto.shareClassOrder,
    );

    // 6. Run the waterfall algorithm
    const results = this.executeWaterfall(orderedClasses, exitAmount);

    // 7. Compute breakeven
    const breakeven = this.computeBreakeven(orderedClasses, companyId);

    // 8. Calculate unallocated proceeds
    const totalAllocated = results.reduce(
      (sum, r) => sum.plus(r.totalProceeds),
      ZERO,
    );
    const unallocated = exitAmount.minus(totalAllocated);

    const analysis: WaterfallAnalysis = {
      exitAmount: exitAmount.toDecimalPlaces(2, TWO_DP.rounding).toString(),
      generatedAt: new Date().toISOString(),
      shareClassResults: results,
      breakeven,
      unallocatedProceeds: unallocated.greaterThan(0)
        ? unallocated.toDecimalPlaces(2, TWO_DP.rounding).toString()
        : '0.00',
    };

    if (excludedConvertibles.length > 0) {
      analysis.metadata = { excludedConvertibles };
    }

    this.logger.log(
      `Waterfall analysis run for company ${companyId}: exit=${dto.exitAmount}, classes=${shareClasses.length}`,
    );

    return analysis;
  }

  // ─── Scenario Persistence ──────────────────────────────────────────────

  async saveScenario(companyId: string, userId: string, dto: SaveScenarioDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    // Check scenario limit (50 per company)
    const count = await this.prisma.waterfallScenario.count({
      where: { companyId },
    });
    if (count >= 50) {
      throw new BusinessRuleException(
        'WATERFALL_SCENARIO_LIMIT',
        'errors.waterfall.scenarioLimit',
        { limit: 50, current: count },
      );
    }

    const scenario = await this.prisma.waterfallScenario.create({
      data: {
        companyId,
        createdById: userId,
        name: dto.name,
        exitAmount: new Prisma.Decimal(dto.exitAmount),
        includeOptions: dto.includeOptions ?? true,
        includeConvertibles: dto.includeConvertibles ?? true,
        shareClassOrder: dto.shareClassOrder ?? [],
        resultData: dto.resultData as Prisma.InputJsonValue,
      },
    });

    return {
      id: scenario.id,
      name: scenario.name,
      exitAmount: scenario.exitAmount.toString(),
      includeOptions: scenario.includeOptions,
      includeConvertibles: scenario.includeConvertibles,
      shareClassOrder: scenario.shareClassOrder,
      createdAt: scenario.createdAt.toISOString(),
    };
  }

  async listScenarios(companyId: string, page: number, limit: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundException('company', companyId);

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.waterfallScenario.findMany({
        where: { companyId },
        select: {
          id: true,
          name: true,
          exitAmount: true,
          includeOptions: true,
          includeConvertibles: true,
          shareClassOrder: true,
          createdAt: true,
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.waterfallScenario.count({ where: { companyId } }),
    ]);

    const shapedItems = items.map((item) => ({
      id: item.id,
      name: item.name,
      exitAmount: item.exitAmount.toString(),
      includeOptions: item.includeOptions,
      includeConvertibles: item.includeConvertibles,
      shareClassOrder: item.shareClassOrder,
      createdBy: {
        id: item.createdBy.id,
        name: [item.createdBy.firstName, item.createdBy.lastName]
          .filter(Boolean)
          .join(' ') || 'Unknown',
      },
      createdAt: item.createdAt.toISOString(),
    }));

    return { items: shapedItems, total };
  }

  async getScenario(companyId: string, scenarioId: string) {
    const scenario = await this.prisma.waterfallScenario.findFirst({
      where: { id: scenarioId, companyId },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!scenario) {
      throw new NotFoundException('waterfallScenario', scenarioId);
    }

    return {
      id: scenario.id,
      name: scenario.name,
      exitAmount: scenario.exitAmount.toString(),
      includeOptions: scenario.includeOptions,
      includeConvertibles: scenario.includeConvertibles,
      shareClassOrder: scenario.shareClassOrder,
      resultData: scenario.resultData,
      createdBy: {
        id: scenario.createdBy.id,
        name: [scenario.createdBy.firstName, scenario.createdBy.lastName]
          .filter(Boolean)
          .join(' ') || 'Unknown',
      },
      createdAt: scenario.createdAt.toISOString(),
    };
  }

  async deleteScenario(companyId: string, scenarioId: string): Promise<void> {
    const scenario = await this.prisma.waterfallScenario.findFirst({
      where: { id: scenarioId, companyId },
      select: { id: true },
    });

    if (!scenario) {
      throw new NotFoundException('waterfallScenario', scenarioId);
    }

    await this.prisma.waterfallScenario.delete({
      where: { id: scenarioId },
    });
  }

  // ─── Data Loading ──────────────────────────────────────────────────────

  private async loadShareClassData(
    companyId: string,
  ): Promise<ShareClassInput[]> {
    const shareClasses = await this.prisma.shareClass.findMany({
      where: { companyId },
      select: {
        id: true,
        className: true,
        type: true,
        totalIssued: true,
        liquidationPreferenceMultiple: true,
        participatingRights: true,
        participationCap: true,
        seniority: true,
      },
    });

    // Load the original investment for each share class from funding rounds
    const fundingRounds = await this.prisma.fundingRound.findMany({
      where: { companyId, status: 'CLOSED' },
      select: {
        shareClassId: true,
        pricePerShare: true,
      },
    });

    // Build a map of shareClassId -> total invested
    // Original investment = totalIssued * pricePerShare (from the funding round)
    const investmentMap = new Map<string, Prisma.Decimal>();
    for (const round of fundingRounds) {
      const existing = investmentMap.get(round.shareClassId) ?? ZERO;
      // We accumulate investments from multiple rounds into the same share class
      investmentMap.set(round.shareClassId, existing);
    }

    // Also load shareholdings to get actual shares held per class
    const shareholdings = await this.prisma.shareholding.findMany({
      where: { companyId },
      select: {
        shareClassId: true,
        quantity: true,
      },
    });

    // Aggregate shares per class
    const sharesPerClass = new Map<string, Prisma.Decimal>();
    for (const sh of shareholdings) {
      const existing = sharesPerClass.get(sh.shareClassId) ?? ZERO;
      sharesPerClass.set(sh.shareClassId, existing.plus(sh.quantity));
    }

    // Calculate original investment: for preferred classes, use funding round data
    // For common shares, originalInvestment is 0 (no liquidation preference)
    for (const round of fundingRounds) {
      const classShares = sharesPerClass.get(round.shareClassId) ?? ZERO;
      const existing = investmentMap.get(round.shareClassId) ?? ZERO;
      // Total invested = shares * pricePerShare
      investmentMap.set(
        round.shareClassId,
        existing.plus(classShares.mul(round.pricePerShare)),
      );
    }

    return shareClasses.map((sc) => ({
      id: sc.id,
      className: sc.className,
      type: sc.type,
      totalShares: sharesPerClass.get(sc.id) ?? ZERO,
      liquidationPreferenceMultiple:
        sc.liquidationPreferenceMultiple ?? ZERO,
      participatingRights: sc.participatingRights,
      participationCap: sc.participationCap ?? null,
      seniority: sc.seniority,
      originalInvestment: investmentMap.get(sc.id) ?? ZERO,
    }));
  }

  private validateShareClassOrder(
    order: string[],
    shareClasses: ShareClassInput[],
  ): void {
    const classIds = new Set(shareClasses.map((sc) => sc.id));
    for (const id of order) {
      if (!classIds.has(id)) {
        throw new BusinessRuleException(
          'CAP_SHARE_CLASS_NOT_FOUND',
          'errors.cap.shareClassNotFound',
          { shareClassId: id },
        );
      }
    }
  }

  private async getVestedUnexercisedOptions(
    companyId: string,
    shareClasses: ShareClassInput[],
  ): Promise<Prisma.Decimal> {
    const grants = await this.prisma.optionGrant.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: {
        plan: {
          select: { shareClassId: true },
        },
      },
    });

    let totalOptionShares = ZERO;

    for (const grant of grants) {
      const vested = this.calculateVestedOptions(grant);
      const exercised = new Prisma.Decimal(grant.exercised);
      const exercisable = vested.minus(exercised);

      if (exercisable.greaterThan(0)) {
        // Add these as-if-exercised shares to the target share class
        const targetClass = shareClasses.find(
          (sc) => sc.id === grant.plan.shareClassId,
        );
        if (targetClass) {
          targetClass.totalShares = targetClass.totalShares.plus(exercisable);
          totalOptionShares = totalOptionShares.plus(exercisable);
        }
      }
    }

    return totalOptionShares;
  }

  private async addConvertibleShares(
    companyId: string,
    shareClasses: ShareClassInput[],
  ): Promise<Array<{ convertibleId: string; reason: string }>> {
    const convertibles = await this.prisma.convertibleInstrument.findMany({
      where: { companyId, status: 'OUTSTANDING' },
      select: {
        id: true,
        principalAmount: true,
        interestRate: true,
        interestType: true,
        issueDate: true,
        valuationCap: true,
        discountRate: true,
        targetShareClassId: true,
      },
    });

    const excluded: Array<{ convertibleId: string; reason: string }> = [];

    // Get the most recent round's price per share for conversion calculation
    const latestRound = await this.prisma.fundingRound.findFirst({
      where: { companyId, status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      select: { pricePerShare: true, preMoneyValuation: true },
    });

    for (const conv of convertibles) {
      // Need either a valuation cap or discount rate to convert
      if (!conv.valuationCap && !conv.discountRate) {
        excluded.push({
          convertibleId: conv.id,
          reason: 'No cap or discount defined',
        });
        continue;
      }

      if (!conv.targetShareClassId) {
        excluded.push({
          convertibleId: conv.id,
          reason: 'No target share class defined',
        });
        continue;
      }

      const targetClass = shareClasses.find(
        (sc) => sc.id === conv.targetShareClassId,
      );
      if (!targetClass) {
        excluded.push({
          convertibleId: conv.id,
          reason: 'Target share class not found',
        });
        continue;
      }

      // Calculate accrued interest
      const totalAmount = this.calculateConvertibleTotal(conv);

      // Determine conversion price (most favorable)
      let conversionShares = ZERO;

      if (latestRound) {
        const roundPrice = latestRound.pricePerShare;

        // Calculate total pre-money shares for cap price calculation
        const totalPreMoneyShares = shareClasses.reduce(
          (sum, sc) => sum.plus(sc.totalShares),
          ZERO,
        );

        let bestPrice = roundPrice;

        if (conv.discountRate) {
          const discountPrice = roundPrice.mul(
            new Prisma.Decimal(1).minus(conv.discountRate),
          );
          if (discountPrice.lessThan(bestPrice)) {
            bestPrice = discountPrice;
          }
        }

        if (conv.valuationCap && totalPreMoneyShares.greaterThan(0)) {
          const capPrice = conv.valuationCap.div(totalPreMoneyShares);
          if (capPrice.lessThan(bestPrice)) {
            bestPrice = capPrice;
          }
        }

        if (bestPrice.greaterThan(0)) {
          conversionShares = totalAmount.div(bestPrice);
        }
      } else {
        // No rounds closed — use valuation cap directly
        if (conv.valuationCap) {
          const totalPreMoneyShares = shareClasses.reduce(
            (sum, sc) => sum.plus(sc.totalShares),
            ZERO,
          );
          if (totalPreMoneyShares.greaterThan(0)) {
            const capPrice = conv.valuationCap.div(totalPreMoneyShares);
            if (capPrice.greaterThan(0)) {
              conversionShares = totalAmount.div(capPrice);
            }
          }
        }
      }

      if (conversionShares.greaterThan(0)) {
        targetClass.totalShares = targetClass.totalShares.plus(conversionShares);
      }
    }

    return excluded;
  }

  private calculateConvertibleTotal(conv: {
    principalAmount: Prisma.Decimal;
    interestRate: Prisma.Decimal;
    interestType: string;
    issueDate: Date;
  }): Prisma.Decimal {
    const principal = new Prisma.Decimal(conv.principalAmount);
    const rate = new Prisma.Decimal(conv.interestRate);
    const issueDate = new Date(conv.issueDate);
    const now = new Date();

    const daysDiff = Math.max(
      0,
      Math.floor(
        (now.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    const yearFraction = new Prisma.Decimal(daysDiff).div(365);

    let interest: Prisma.Decimal;

    if (conv.interestType === 'COMPOUND') {
      // Compound: P * ((1 + r) ^ t - 1)
      const base = new Prisma.Decimal(1).plus(rate);
      const exponent = yearFraction.toNumber();
      const compounded = new Prisma.Decimal(Math.pow(base.toNumber(), exponent));
      interest = principal.mul(compounded.minus(1));
    } else {
      // Simple: P * r * t
      interest = principal.mul(rate).mul(yearFraction);
    }

    return principal.plus(interest);
  }

  // ─── Stacking Order ────────────────────────────────────────────────────

  private determineStackingOrder(
    shareClasses: ShareClassInput[],
    customOrder?: string[],
  ): ShareClassInput[] {
    if (customOrder?.length) {
      // Use custom order for classes in the list, append remaining by seniority
      const orderedById = new Map(shareClasses.map((sc) => [sc.id, sc]));
      const ordered: ShareClassInput[] = [];

      for (const id of customOrder) {
        const sc = orderedById.get(id);
        if (sc) {
          ordered.push(sc);
          orderedById.delete(id);
        }
      }

      // Append remaining classes (not in custom order) sorted by seniority desc
      const remaining = Array.from(orderedById.values()).sort(
        (a, b) => b.seniority - a.seniority,
      );
      ordered.push(...remaining);

      return ordered;
    }

    // Default: sort by seniority descending (most senior first)
    return [...shareClasses].sort((a, b) => b.seniority - a.seniority);
  }

  // ─── Waterfall Algorithm ───────────────────────────────────────────────

  executeWaterfall(
    orderedClasses: ShareClassInput[],
    exitAmount: Prisma.Decimal,
  ): ShareClassAllocation[] {
    // Initialize working data
    const workingData: ClassWorkingData[] = orderedClasses.map((input) => ({
      input,
      preferenceProceeds: ZERO,
      participationProceeds: ZERO,
      totalProceeds: ZERO,
      capped: false,
    }));

    let remainingProceeds = exitAmount;

    // ── Step 1 & 2: Apply liquidation preferences in stacking order ──

    // Group classes by seniority for pari passu handling
    const seniorityGroups = this.groupBySeniority(workingData);

    for (const group of seniorityGroups) {
      if (remainingProceeds.lessThanOrEqualTo(0)) break;

      // Calculate total preference for this seniority level
      const totalGroupPreference = group.reduce((sum, wd) => {
        const pref = wd.input.liquidationPreferenceMultiple.mul(
          wd.input.originalInvestment,
        );
        return sum.plus(pref);
      }, ZERO);

      if (totalGroupPreference.isZero()) continue;

      // Allocate preferences pro-rata within the group (pari passu)
      const availableForGroup = Prisma.Decimal.min(
        totalGroupPreference,
        remainingProceeds,
      );

      for (const wd of group) {
        const classPreference = wd.input.liquidationPreferenceMultiple.mul(
          wd.input.originalInvestment,
        );
        if (classPreference.isZero()) continue;

        const proRataShare = classPreference.div(totalGroupPreference);
        wd.preferenceProceeds = availableForGroup.mul(proRataShare);
      }

      remainingProceeds = remainingProceeds.minus(availableForGroup);
    }

    // ── Steps 3 & 4: Distribute remaining to common + participating preferred ──

    if (remainingProceeds.greaterThan(0)) {
      // Identify participating preferred and common classes
      const commonClasses = workingData.filter(
        (wd) => wd.input.liquidationPreferenceMultiple.isZero(),
      );
      const participatingClasses = workingData.filter(
        (wd) =>
          wd.input.participatingRights &&
          !wd.input.liquidationPreferenceMultiple.isZero(),
      );
      const nonParticipatingPreferred = workingData.filter(
        (wd) =>
          !wd.input.participatingRights &&
          !wd.input.liquidationPreferenceMultiple.isZero(),
      );

      // Total shares eligible for participation = common + participating preferred
      const participationPool = [
        ...commonClasses,
        ...participatingClasses,
      ];

      const totalParticipationShares = participationPool.reduce(
        (sum, wd) => sum.plus(wd.input.totalShares),
        ZERO,
      );

      if (totalParticipationShares.greaterThan(0)) {
        for (const wd of participationPool) {
          const share = wd.input.totalShares.div(totalParticipationShares);
          wd.participationProceeds = remainingProceeds.mul(share);
        }
      }

      // ── Step 5: Apply participation caps ──

      let excessToRedistribute = ZERO;
      const uncappedClasses: ClassWorkingData[] = [];

      for (const wd of participatingClasses) {
        if (wd.input.participationCap) {
          const maxTotal = wd.input.participationCap.mul(
            wd.input.originalInvestment,
          );
          const currentTotal = wd.preferenceProceeds.plus(
            wd.participationProceeds,
          );

          if (currentTotal.greaterThan(maxTotal)) {
            const excess = currentTotal.minus(maxTotal);
            wd.participationProceeds = wd.participationProceeds.minus(excess);
            wd.capped = true;
            excessToRedistribute = excessToRedistribute.plus(excess);
          } else {
            uncappedClasses.push(wd);
          }
        } else {
          uncappedClasses.push(wd);
        }
      }

      // Redistribute excess from capped classes to uncapped + common
      if (excessToRedistribute.greaterThan(0)) {
        const redistributionPool = [...commonClasses, ...uncappedClasses];
        const totalRedistShares = redistributionPool.reduce(
          (sum, wd) => sum.plus(wd.input.totalShares),
          ZERO,
        );

        if (totalRedistShares.greaterThan(0)) {
          for (const wd of redistributionPool) {
            const share = wd.input.totalShares.div(totalRedistShares);
            wd.participationProceeds = wd.participationProceeds.plus(
              excessToRedistribute.mul(share),
            );
          }
        }
      }

      // ── Step 6: Non-participating preferred conversion analysis ──

      for (const wd of nonParticipatingPreferred) {
        // Option A: Take liquidation preference (already calculated)
        const optionA = wd.preferenceProceeds;

        // Option B: Convert to common and get pro-rata share
        const totalSharesIncludingConverted = workingData.reduce(
          (sum, w) => sum.plus(w.input.totalShares),
          ZERO,
        );

        let optionB = ZERO;
        if (totalSharesIncludingConverted.greaterThan(0)) {
          optionB = exitAmount
            .mul(wd.input.totalShares)
            .div(totalSharesIncludingConverted);
        }

        // Choose the better outcome
        if (optionB.greaterThan(optionA)) {
          // Convert: replace preference with pro-rata share
          wd.preferenceProceeds = ZERO;
          wd.participationProceeds = optionB;
        }
        // Otherwise keep the preference (option A) — no participation proceeds
      }
    }

    // ── Build results ──

    return workingData.map((wd) => {
      const total = wd.preferenceProceeds.plus(wd.participationProceeds);
      const perShare = wd.input.totalShares.greaterThan(0)
        ? total.div(wd.input.totalShares)
        : ZERO;

      const isCommon = wd.input.liquidationPreferenceMultiple.isZero();
      let roiMultiple: string | null = null;
      if (!isCommon && wd.input.originalInvestment.greaterThan(0)) {
        roiMultiple = total
          .div(wd.input.originalInvestment)
          .toDecimalPlaces(2, TWO_DP.rounding)
          .toString();
      }

      return {
        shareClassId: wd.input.id,
        shareClassName: wd.input.className,
        totalShares: wd.input.totalShares
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN)
          .toString(),
        liquidationPreference: wd.preferenceProceeds
          .toDecimalPlaces(2, TWO_DP.rounding)
          .toString(),
        participationProceeds: wd.participationProceeds
          .toDecimalPlaces(2, TWO_DP.rounding)
          .toString(),
        totalProceeds: total
          .toDecimalPlaces(2, TWO_DP.rounding)
          .toString(),
        perShareValue: perShare
          .toDecimalPlaces(2, TWO_DP.rounding)
          .toString(),
        roiMultiple,
        isParticipating: wd.input.participatingRights,
        participationCapped: wd.capped,
      };
    });
  }

  // ─── Breakeven Analysis ────────────────────────────────────────────────

  private computeBreakeven(
    orderedClasses: ShareClassInput[],
    companyId: string,
  ): { exitValue: string; description: string } {
    // Check if there are any preferred classes
    const hasPreferred = orderedClasses.some(
      (sc) => !sc.liquidationPreferenceMultiple.isZero(),
    );

    if (!hasPreferred) {
      return {
        exitValue: '0.00',
        description:
          'No preferred classes — common always equals or exceeds preferred',
      };
    }

    // Calculate total shares for scaling the search range
    const totalShares = orderedClasses.reduce(
      (sum, sc) => sum.plus(sc.totalShares),
      ZERO,
    );

    if (totalShares.isZero()) {
      return {
        exitValue: '0.00',
        description: 'No shares outstanding',
      };
    }

    // Total liquidation preferences as baseline
    const totalPreferences = orderedClasses.reduce(
      (sum, sc) =>
        sum.plus(sc.liquidationPreferenceMultiple.mul(sc.originalInvestment)),
      ZERO,
    );

    // Search range: 0 to 10x total preferences (generous upper bound)
    const maxExit = totalPreferences.mul(10).greaterThan(0)
      ? totalPreferences.mul(10)
      : new Prisma.Decimal(1000000);

    let low = ZERO;
    let high = maxExit;
    const tolerance = new Prisma.Decimal('0.01');

    for (let i = 0; i < 100; i++) {
      const mid = low.plus(high).div(2);

      if (high.minus(low).lessThanOrEqualTo(tolerance)) {
        return {
          exitValue: mid.toDecimalPlaces(2, TWO_DP.rounding).toString(),
          description:
            'Exit value at which common per-share proceeds exceed preferred per-share proceeds',
        };
      }

      // Run waterfall at this exit value
      const results = this.executeWaterfall(orderedClasses, mid);

      // Find common and preferred per-share values
      const commonResults = results.filter(
        (r) => {
          const sc = orderedClasses.find((c) => c.id === r.shareClassId);
          return sc?.liquidationPreferenceMultiple.isZero();
        },
      );
      const preferredResults = results.filter(
        (r) => {
          const sc = orderedClasses.find((c) => c.id === r.shareClassId);
          return !sc?.liquidationPreferenceMultiple.isZero();
        },
      );

      // Best common per-share
      const bestCommonPerShare = commonResults.reduce(
        (best, r) => {
          const val = new Prisma.Decimal(r.perShareValue);
          return val.greaterThan(best) ? val : best;
        },
        ZERO,
      );

      // Best preferred per-share
      const bestPreferredPerShare = preferredResults.reduce(
        (best, r) => {
          const val = new Prisma.Decimal(r.perShareValue);
          return val.greaterThan(best) ? val : best;
        },
        ZERO,
      );

      if (bestCommonPerShare.greaterThanOrEqualTo(bestPreferredPerShare)) {
        high = mid;
      } else {
        low = mid;
      }
    }

    // If we don't converge, return the best estimate
    return {
      exitValue: high.toDecimalPlaces(2, TWO_DP.rounding).toString(),
      description:
        'Exit value at which common per-share proceeds exceed preferred per-share proceeds',
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private groupBySeniority(
    workingData: ClassWorkingData[],
  ): ClassWorkingData[][] {
    // Group by seniority value, sort groups by seniority descending (most senior first)
    const groups = new Map<number, ClassWorkingData[]>();

    for (const wd of workingData) {
      // Only group preferred classes — common has seniority 0 but no preference
      if (wd.input.liquidationPreferenceMultiple.isZero()) continue;

      const seniority = wd.input.seniority;
      const group = groups.get(seniority) ?? [];
      group.push(wd);
      groups.set(seniority, group);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => b - a)
      .map(([, group]) => group);
  }

  private calculateVestedOptions(grant: {
    quantity: Prisma.Decimal;
    exercised: Prisma.Decimal;
    grantDate: Date;
    cliffMonths: number;
    vestingDurationMonths: number;
    cliffPercentage: Prisma.Decimal;
  }): Prisma.Decimal {
    const now = new Date();
    const grantDate = new Date(grant.grantDate);
    const totalQuantity = new Prisma.Decimal(grant.quantity);

    if (!grant.vestingDurationMonths) {
      return totalQuantity;
    }

    const monthsElapsed =
      (now.getFullYear() - grantDate.getFullYear()) * 12 +
      (now.getMonth() - grantDate.getMonth());

    if (grant.cliffMonths && monthsElapsed < grant.cliffMonths) {
      return ZERO;
    }

    if (monthsElapsed >= grant.vestingDurationMonths) {
      return totalQuantity;
    }

    let vested = ZERO;

    if (grant.cliffMonths && grant.cliffPercentage) {
      vested = totalQuantity.mul(grant.cliffPercentage).div(100);
    }

    const remainingQuantity = totalQuantity.minus(vested);
    const remainingMonths =
      grant.vestingDurationMonths - (grant.cliffMonths ?? 0);

    if (remainingMonths > 0) {
      const monthsPastCliff = monthsElapsed - (grant.cliffMonths ?? 0);
      const linearVested = remainingQuantity
        .mul(monthsPastCliff)
        .div(remainingMonths);
      vested = vested.plus(linearVested);
    }

    return vested.greaterThan(totalQuantity) ? totalQuantity : vested;
  }
}
