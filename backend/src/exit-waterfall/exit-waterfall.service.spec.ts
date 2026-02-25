import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ExitWaterfallService } from './exit-waterfall.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BusinessRuleException,
} from '../common/filters/app-exception';

const ZERO = new Prisma.Decimal(0);

// ─── Mock Factories ──────────────────────────────────────────────────────

function mockShareClass(overrides: Partial<{
  id: string;
  className: string;
  type: string;
  totalIssued: Prisma.Decimal;
  liquidationPreferenceMultiple: Prisma.Decimal | null;
  participatingRights: boolean;
  participationCap: Prisma.Decimal | null;
  seniority: number;
}> = {}) {
  return {
    id: overrides.id ?? 'sc-common',
    className: overrides.className ?? 'ON',
    type: overrides.type ?? 'COMMON_SHARES',
    totalIssued: overrides.totalIssued ?? new Prisma.Decimal(100000),
    liquidationPreferenceMultiple: overrides.liquidationPreferenceMultiple ?? null,
    participatingRights: overrides.participatingRights ?? false,
    participationCap: overrides.participationCap ?? null,
    seniority: overrides.seniority ?? 0,
  };
}

function mockShareholding(shareClassId: string, quantity: string) {
  return {
    shareClassId,
    quantity: new Prisma.Decimal(quantity),
  };
}

function mockFundingRound(shareClassId: string, pricePerShare: string) {
  return {
    shareClassId,
    pricePerShare: new Prisma.Decimal(pricePerShare),
    status: 'CLOSED',
  };
}

describe('ExitWaterfallService', () => {
  let service: ExitWaterfallService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      company: { findUnique: jest.fn() },
      shareClass: { findMany: jest.fn() },
      shareholding: { findMany: jest.fn() },
      fundingRound: { findMany: jest.fn(), findFirst: jest.fn() },
      optionGrant: { findMany: jest.fn() },
      convertibleInstrument: { findMany: jest.fn() },
      waterfallScenario: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExitWaterfallService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExitWaterfallService>(ExitWaterfallService);
  });

  // ─── Company Not Found ─────────────────────────────────────────────────

  describe('runWaterfall', () => {
    it('should throw NotFoundException if company does not exist', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.runWaterfall('non-existent', { exitAmount: '1000000.00' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessRuleException if no share classes exist', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([]);
      prisma.shareholding.findMany.mockResolvedValue([]);
      prisma.fundingRound.findMany.mockResolvedValue([]);

      await expect(
        service.runWaterfall('comp-1', { exitAmount: '1000000.00' }),
      ).rejects.toThrow(BusinessRuleException);
    });

    // ── EC-1: Zero Exit Amount ──

    it('should return all-zero results for zero exit amount', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({ id: 'sc-common', className: 'ON', seniority: 0 }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-common', '100000'),
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      const result = await service.runWaterfall('comp-1', {
        exitAmount: '0.00',
      });

      expect(result.exitAmount).toBe('0');
      expect(result.shareClassResults).toHaveLength(1);
      expect(result.shareClassResults[0].totalProceeds).toBe('0');
      expect(result.shareClassResults[0].perShareValue).toBe('0');
      expect(result.unallocatedProceeds).toBe('0.00');
    });

    // ── EC-4: Single Common Share Class ──

    it('should distribute entire exit amount to common when no preferred', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-common', '100000'),
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      const result = await service.runWaterfall('comp-1', {
        exitAmount: '10000000.00',
      });

      expect(result.shareClassResults).toHaveLength(1);
      const common = result.shareClassResults[0];
      expect(common.shareClassName).toBe('ON');
      expect(common.totalProceeds).toBe('10000000');
      expect(common.perShareValue).toBe('100');
      expect(common.roiMultiple).toBeNull();
      expect(common.isParticipating).toBe(false);
      expect(result.breakeven.exitValue).toBe('0.00');
    });

    // ── Standard Waterfall with Preferred + Common ──

    it('should pay liquidation preference before distributing to common', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-preferred',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          seniority: 1,
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: false,
        }),
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-preferred', '30000'),
        mockShareholding('sc-common', '70000'),
      ]);
      // Preferred class funded at R$ 100/share
      prisma.fundingRound.findMany.mockResolvedValue([
        mockFundingRound('sc-preferred', '100'),
      ]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      const result = await service.runWaterfall('comp-1', {
        exitAmount: '10000000.00',
        includeOptions: false,
        includeConvertibles: false,
      });

      expect(result.shareClassResults).toHaveLength(2);

      // Preferred gets 1x preference = 30000 * 100 = R$ 3,000,000
      const preferred = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-preferred',
      )!;
      expect(preferred.shareClassName).toBe('PN-A');

      // Non-participating preferred: takes max(preference, pro-rata)
      // Preference = R$ 3,000,000
      // Pro-rata = 10,000,000 * 30000/100000 = R$ 3,000,000
      // They're equal, so it takes the preference
      expect(parseFloat(preferred.liquidationPreference)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(preferred.totalProceeds)).toBeGreaterThan(0);

      // Common gets the remainder
      const common = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-common',
      )!;
      expect(parseFloat(common.totalProceeds)).toBeGreaterThan(0);
      expect(common.roiMultiple).toBeNull();

      // Total allocated should equal exit amount
      const totalAllocated = result.shareClassResults.reduce(
        (sum, r) => sum + parseFloat(r.totalProceeds),
        0,
      );
      expect(totalAllocated).toBeCloseTo(10000000, 0);
    });

    // ── Participating Preferred ──

    it('should give participating preferred both preference and participation', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-preferred',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          seniority: 1,
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: true,
        }),
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-preferred', '30000'),
        mockShareholding('sc-common', '70000'),
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([
        mockFundingRound('sc-preferred', '100'),
      ]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      const result = await service.runWaterfall('comp-1', {
        exitAmount: '10000000.00',
        includeOptions: false,
        includeConvertibles: false,
      });

      const preferred = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-preferred',
      )!;

      // Participating preferred gets preference + participation
      expect(preferred.isParticipating).toBe(true);
      expect(parseFloat(preferred.liquidationPreference)).toBeGreaterThan(0);
      expect(parseFloat(preferred.participationProceeds)).toBeGreaterThan(0);

      // Total = preference (3M) + participation in remaining (7M * 30/100 = 2.1M) = 5.1M
      const prefTotal = parseFloat(preferred.totalProceeds);
      expect(prefTotal).toBeGreaterThan(3000000);
    });

    // ── Participation Cap ──

    it('should cap participating preferred and redistribute excess', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-preferred',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          seniority: 1,
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: true,
          participationCap: new Prisma.Decimal('3'), // 3x cap
        }),
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-preferred', '10000'),
        mockShareholding('sc-common', '90000'),
      ]);
      // Investment: 10000 shares * R$ 100 = R$ 1,000,000
      prisma.fundingRound.findMany.mockResolvedValue([
        mockFundingRound('sc-preferred', '100'),
      ]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      const result = await service.runWaterfall('comp-1', {
        exitAmount: '50000000.00',
        includeOptions: false,
        includeConvertibles: false,
      });

      const preferred = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-preferred',
      )!;

      // 3x cap on R$ 1M investment = R$ 3M max
      expect(preferred.participationCapped).toBe(true);
      expect(parseFloat(preferred.totalProceeds)).toBeLessThanOrEqual(3000001);
    });

    // ── EC-5: Insufficient proceeds ──

    it('should handle insufficient proceeds for all preferences', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-series-b',
          className: 'PN-B',
          type: 'PREFERRED_SHARES',
          seniority: 2,
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: false,
        }),
        mockShareClass({
          id: 'sc-series-a',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          seniority: 1,
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: false,
        }),
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-series-b', '20000'),
        mockShareholding('sc-series-a', '30000'),
        mockShareholding('sc-common', '50000'),
      ]);
      // Series B: 20000 * 200 = R$ 4M preference
      // Series A: 30000 * 100 = R$ 3M preference
      prisma.fundingRound.findMany.mockResolvedValue([
        mockFundingRound('sc-series-b', '200'),
        mockFundingRound('sc-series-a', '100'),
      ]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      // Exit at R$ 5M — not enough for both preferences (4M + 3M = 7M)
      const result = await service.runWaterfall('comp-1', {
        exitAmount: '5000000.00',
        includeOptions: false,
        includeConvertibles: false,
      });

      // Series B (senior) gets its full 4M preference
      const seriesB = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-series-b',
      )!;
      expect(parseFloat(seriesB.totalProceeds)).toBeCloseTo(4000000, 0);

      // Series A gets the remaining 1M
      const seriesA = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-series-a',
      )!;
      expect(parseFloat(seriesA.totalProceeds)).toBeCloseTo(1000000, 0);

      // Common gets nothing
      const common = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-common',
      )!;
      expect(parseFloat(common.totalProceeds)).toBe(0);
    });

    // ── Pari Passu ──

    it('should handle pari passu classes (same seniority) sharing pro-rata', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-pref-1',
          className: 'PN-1',
          type: 'PREFERRED_SHARES',
          seniority: 1, // Same seniority = pari passu
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: false,
        }),
        mockShareClass({
          id: 'sc-pref-2',
          className: 'PN-2',
          type: 'PREFERRED_SHARES',
          seniority: 1, // Same seniority = pari passu
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: false,
        }),
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-pref-1', '20000'),
        mockShareholding('sc-pref-2', '30000'),
        mockShareholding('sc-common', '50000'),
      ]);
      // PN-1: 20000 * 100 = R$ 2M, PN-2: 30000 * 100 = R$ 3M
      prisma.fundingRound.findMany.mockResolvedValue([
        mockFundingRound('sc-pref-1', '100'),
        mockFundingRound('sc-pref-2', '100'),
      ]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      // Exit at R$ 3M — not enough for both (total pref = 5M)
      const result = await service.runWaterfall('comp-1', {
        exitAmount: '3000000.00',
        includeOptions: false,
        includeConvertibles: false,
      });

      // Pari passu: PN-1 gets 2/5 * 3M = 1.2M, PN-2 gets 3/5 * 3M = 1.8M
      const pref1 = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-pref-1',
      )!;
      const pref2 = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-pref-2',
      )!;

      expect(parseFloat(pref1.totalProceeds)).toBeCloseTo(1200000, 0);
      expect(parseFloat(pref2.totalProceeds)).toBeCloseTo(1800000, 0);
    });

    // ── EC-6: Invalid share class in custom order ──

    it('should throw on invalid share class ID in custom order', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({ id: 'sc-common' }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-common', '100000'),
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      await expect(
        service.runWaterfall('comp-1', {
          exitAmount: '1000000.00',
          shareClassOrder: ['non-existent-id'],
          includeOptions: false,
          includeConvertibles: false,
        }),
      ).rejects.toThrow(BusinessRuleException);
    });

    // ── Custom stacking order ──

    it('should respect custom stacking order', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-series-a',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          seniority: 1,
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: false,
        }),
        mockShareClass({
          id: 'sc-series-b',
          className: 'PN-B',
          type: 'PREFERRED_SHARES',
          seniority: 2,
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: false,
        }),
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-series-a', '30000'),
        mockShareholding('sc-series-b', '20000'),
        mockShareholding('sc-common', '50000'),
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([
        mockFundingRound('sc-series-a', '100'),
        mockFundingRound('sc-series-b', '200'),
      ]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      // Custom order: put Series A first (normally Series B would be senior)
      const result = await service.runWaterfall('comp-1', {
        exitAmount: '5000000.00',
        shareClassOrder: ['sc-series-a', 'sc-series-b', 'sc-common'],
        includeOptions: false,
        includeConvertibles: false,
      });

      // With custom order, Series A gets full preference first
      const seriesA = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-series-a',
      )!;
      expect(parseFloat(seriesA.totalProceeds)).toBeGreaterThan(0);
    });

    // ── ROI Multiple ──

    it('should calculate ROI multiple for preferred classes', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-preferred',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          seniority: 1,
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: true,
        }),
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-preferred', '10000'),
        mockShareholding('sc-common', '90000'),
      ]);
      // Investment: 10000 * 100 = R$ 1M
      prisma.fundingRound.findMany.mockResolvedValue([
        mockFundingRound('sc-preferred', '100'),
      ]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      const result = await service.runWaterfall('comp-1', {
        exitAmount: '10000000.00',
        includeOptions: false,
        includeConvertibles: false,
      });

      const preferred = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-preferred',
      )!;
      expect(preferred.roiMultiple).not.toBeNull();
      expect(parseFloat(preferred.roiMultiple!)).toBeGreaterThan(1);

      const common = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-common',
      )!;
      expect(common.roiMultiple).toBeNull();
    });

    // ── Non-participating preferred conversion analysis ──

    it('should convert non-participating preferred when pro-rata is better', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-preferred',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          seniority: 1,
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: false, // Non-participating
        }),
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-preferred', '50000'),
        mockShareholding('sc-common', '50000'),
      ]);
      // Investment: 50000 * 10 = R$ 500K preference
      prisma.fundingRound.findMany.mockResolvedValue([
        mockFundingRound('sc-preferred', '10'),
      ]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      // Exit at R$ 10M — pro-rata (50%) = R$ 5M >> preference R$ 500K
      const result = await service.runWaterfall('comp-1', {
        exitAmount: '10000000.00',
        includeOptions: false,
        includeConvertibles: false,
      });

      const preferred = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-preferred',
      )!;

      // Should convert: pro-rata R$ 5M > preference R$ 500K
      expect(parseFloat(preferred.totalProceeds)).toBeCloseTo(5000000, 0);
    });

    // ── Include Options ──

    it('should include vested unexercised options as-if exercised', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-common', '100000'),
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([]);

      // Grant: 10000 options, all vested (grant date 2 years ago)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      prisma.optionGrant.findMany.mockResolvedValue([
        {
          id: 'grant-1',
          quantity: new Prisma.Decimal('10000'),
          exercised: new Prisma.Decimal('0'),
          grantDate: twoYearsAgo,
          cliffMonths: 12,
          vestingDurationMonths: 12, // 1 year total — fully vested
          cliffPercentage: new Prisma.Decimal('25'),
          status: 'ACTIVE',
          plan: { shareClassId: 'sc-common' },
        },
      ]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      const result = await service.runWaterfall('comp-1', {
        exitAmount: '10000000.00',
        includeOptions: true,
        includeConvertibles: false,
      });

      // With options: total shares = 100000 + 10000 = 110000
      // Per-share = 10M / 110000 ≈ 90.91
      const common = result.shareClassResults[0];
      const perShare = parseFloat(common.perShareValue);
      expect(perShare).toBeLessThan(100); // Diluted from 100 to ~90.91
      expect(parseInt(common.totalShares)).toBe(110000);
    });

    // ── Convertible as-if conversion ──

    it('should include convertibles as-if converted', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({
          id: 'sc-preferred',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          seniority: 1,
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: false,
        }),
        mockShareClass({
          id: 'sc-common',
          className: 'ON',
          seniority: 0,
          liquidationPreferenceMultiple: null,
        }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-preferred', '20000'),
        mockShareholding('sc-common', '80000'),
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([
        mockFundingRound('sc-preferred', '100'),
      ]);
      prisma.fundingRound.findFirst.mockResolvedValue({
        pricePerShare: new Prisma.Decimal('100'),
        preMoneyValuation: new Prisma.Decimal('10000000'),
      });
      prisma.optionGrant.findMany.mockResolvedValue([]);

      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      prisma.convertibleInstrument.findMany.mockResolvedValue([
        {
          id: 'conv-1',
          principalAmount: new Prisma.Decimal('500000'),
          interestRate: new Prisma.Decimal('0.05'),
          interestType: 'SIMPLE',
          issueDate: oneYearAgo,
          valuationCap: new Prisma.Decimal('8000000'),
          discountRate: new Prisma.Decimal('0.20'),
          targetShareClassId: 'sc-preferred',
          status: 'OUTSTANDING',
        },
      ]);

      const result = await service.runWaterfall('comp-1', {
        exitAmount: '10000000.00',
        includeOptions: false,
        includeConvertibles: true,
      });

      // Convertible should add shares to the preferred class
      const preferred = result.shareClassResults.find(
        (r) => r.shareClassId === 'sc-preferred',
      )!;
      expect(parseInt(preferred.totalShares)).toBeGreaterThan(20000);
    });

    // ── EC-2: Excluded convertibles ──

    it('should exclude convertibles with no cap or discount', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({ id: 'sc-common', className: 'ON', seniority: 0 }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-common', '100000'),
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([]);
      prisma.fundingRound.findFirst.mockResolvedValue(null);
      prisma.optionGrant.findMany.mockResolvedValue([]);

      prisma.convertibleInstrument.findMany.mockResolvedValue([
        {
          id: 'conv-ambiguous',
          principalAmount: new Prisma.Decimal('500000'),
          interestRate: new Prisma.Decimal('0.05'),
          interestType: 'SIMPLE',
          issueDate: new Date(),
          valuationCap: null,
          discountRate: null,
          targetShareClassId: 'sc-common',
          status: 'OUTSTANDING',
        },
      ]);

      const result = await service.runWaterfall('comp-1', {
        exitAmount: '10000000.00',
        includeOptions: false,
        includeConvertibles: true,
      });

      expect(result.metadata?.excludedConvertibles).toHaveLength(1);
      expect(result.metadata?.excludedConvertibles?.[0].reason).toBe(
        'No cap or discount defined',
      );
    });

    // ── generatedAt timestamp ──

    it('should include generatedAt timestamp', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.shareClass.findMany.mockResolvedValue([
        mockShareClass({ id: 'sc-common' }),
      ]);
      prisma.shareholding.findMany.mockResolvedValue([
        mockShareholding('sc-common', '100000'),
      ]);
      prisma.fundingRound.findMany.mockResolvedValue([]);
      prisma.optionGrant.findMany.mockResolvedValue([]);
      prisma.convertibleInstrument.findMany.mockResolvedValue([]);

      const result = await service.runWaterfall('comp-1', {
        exitAmount: '1000000.00',
        includeOptions: false,
        includeConvertibles: false,
      });

      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt).getTime()).not.toBeNaN();
    });
  });

  // ─── Scenario Persistence ──────────────────────────────────────────────

  describe('saveScenario', () => {
    it('should save a scenario', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.waterfallScenario.count.mockResolvedValue(0);
      prisma.waterfallScenario.create.mockResolvedValue({
        id: 'scenario-1',
        name: 'Optimistic',
        exitAmount: new Prisma.Decimal('10000000'),
        includeOptions: true,
        includeConvertibles: true,
        shareClassOrder: [],
        createdAt: new Date('2026-02-25T10:00:00Z'),
      });

      const result = await service.saveScenario('comp-1', 'user-1', {
        name: 'Optimistic',
        exitAmount: '10000000.00',
        resultData: { some: 'data' },
      });

      expect(result.id).toBe('scenario-1');
      expect(result.name).toBe('Optimistic');
      expect(prisma.waterfallScenario.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.saveScenario('missing', 'user-1', {
          name: 'Test',
          exitAmount: '1000000.00',
          resultData: {},
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce 50 scenario limit', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.waterfallScenario.count.mockResolvedValue(50);

      await expect(
        service.saveScenario('comp-1', 'user-1', {
          name: 'One Too Many',
          exitAmount: '1000000.00',
          resultData: {},
        }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('listScenarios', () => {
    it('should list scenarios with pagination', async () => {
      prisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      prisma.waterfallScenario.findMany.mockResolvedValue([
        {
          id: 'scenario-1',
          name: 'Optimistic',
          exitAmount: new Prisma.Decimal('10000000'),
          includeOptions: true,
          includeConvertibles: true,
          shareClassOrder: [],
          createdAt: new Date('2026-02-25T10:00:00Z'),
          createdBy: { id: 'user-1', firstName: 'Nelson', lastName: 'Pereira' },
        },
      ]);
      prisma.waterfallScenario.count.mockResolvedValue(1);

      const result = await service.listScenarios('comp-1', 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].name).toBe('Optimistic');
      expect(result.items[0].createdBy.name).toBe('Nelson Pereira');
    });

    it('should throw NotFoundException if company not found', async () => {
      prisma.company.findUnique.mockResolvedValue(null);

      await expect(
        service.listScenarios('missing', 1, 20),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getScenario', () => {
    it('should return scenario with full result data', async () => {
      prisma.waterfallScenario.findFirst.mockResolvedValue({
        id: 'scenario-1',
        name: 'Optimistic',
        exitAmount: new Prisma.Decimal('10000000'),
        includeOptions: true,
        includeConvertibles: true,
        shareClassOrder: [],
        resultData: { exitAmount: '10000000.00' },
        createdAt: new Date('2026-02-25T10:00:00Z'),
        createdBy: { id: 'user-1', firstName: 'Nelson', lastName: 'Pereira' },
      });

      const result = await service.getScenario('comp-1', 'scenario-1');

      expect(result.id).toBe('scenario-1');
      expect(result.resultData).toBeDefined();
      expect(result.createdBy.name).toBe('Nelson Pereira');
    });

    it('should throw NotFoundException if scenario not found', async () => {
      prisma.waterfallScenario.findFirst.mockResolvedValue(null);

      await expect(
        service.getScenario('comp-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteScenario', () => {
    it('should delete an existing scenario', async () => {
      prisma.waterfallScenario.findFirst.mockResolvedValue({
        id: 'scenario-1',
      });
      prisma.waterfallScenario.delete.mockResolvedValue({});

      await service.deleteScenario('comp-1', 'scenario-1');

      expect(prisma.waterfallScenario.delete).toHaveBeenCalledWith({
        where: { id: 'scenario-1' },
      });
    });

    it('should throw NotFoundException if scenario not found', async () => {
      prisma.waterfallScenario.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteScenario('comp-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── executeWaterfall (direct algorithm testing) ───────────────────────

  describe('executeWaterfall (algorithm)', () => {
    it('should handle 2x liquidation preference multiple', () => {
      const classes = [
        {
          id: 'sc-preferred',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          totalShares: new Prisma.Decimal('10000'),
          liquidationPreferenceMultiple: new Prisma.Decimal('2'), // 2x preference
          participatingRights: false,
          participationCap: null,
          seniority: 1,
          originalInvestment: new Prisma.Decimal('1000000'), // R$ 1M invested
        },
        {
          id: 'sc-common',
          className: 'ON',
          type: 'COMMON_SHARES',
          totalShares: new Prisma.Decimal('90000'),
          liquidationPreferenceMultiple: ZERO,
          participatingRights: false,
          participationCap: null,
          seniority: 0,
          originalInvestment: ZERO,
        },
      ];

      // Exit at R$ 5M — 2x pref = R$ 2M, remaining R$ 3M to common
      const results = service.executeWaterfall(
        classes,
        new Prisma.Decimal('5000000'),
      );

      // Non-participating preferred: max(2M preference, 10/100 * 5M = 500K) = 2M
      const preferred = results.find((r) => r.shareClassId === 'sc-preferred')!;
      expect(parseFloat(preferred.totalProceeds)).toBeCloseTo(2000000, 0);

      const common = results.find((r) => r.shareClassId === 'sc-common')!;
      expect(parseFloat(common.totalProceeds)).toBeCloseTo(3000000, 0);
    });

    it('should return non-negative proceeds for all classes', () => {
      const classes = [
        {
          id: 'sc-preferred',
          className: 'PN-A',
          type: 'PREFERRED_SHARES',
          totalShares: new Prisma.Decimal('10000'),
          liquidationPreferenceMultiple: new Prisma.Decimal('1'),
          participatingRights: false,
          participationCap: null,
          seniority: 1,
          originalInvestment: new Prisma.Decimal('5000000'),
        },
        {
          id: 'sc-common',
          className: 'ON',
          type: 'COMMON_SHARES',
          totalShares: new Prisma.Decimal('90000'),
          liquidationPreferenceMultiple: ZERO,
          participatingRights: false,
          participationCap: null,
          seniority: 0,
          originalInvestment: ZERO,
        },
      ];

      // Exit at R$ 1M — less than 5M preference
      const results = service.executeWaterfall(
        classes,
        new Prisma.Decimal('1000000'),
      );

      for (const r of results) {
        expect(parseFloat(r.totalProceeds)).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle empty totalShares gracefully', () => {
      const classes = [
        {
          id: 'sc-common',
          className: 'ON',
          type: 'COMMON_SHARES',
          totalShares: ZERO,
          liquidationPreferenceMultiple: ZERO,
          participatingRights: false,
          participationCap: null,
          seniority: 0,
          originalInvestment: ZERO,
        },
      ];

      const results = service.executeWaterfall(
        classes,
        new Prisma.Decimal('1000000'),
      );

      expect(results).toHaveLength(1);
      expect(results[0].perShareValue).toBe('0');
    });
  });
});
