# Exit Waterfall Specification

**Topic of Concern**: Exit waterfall scenario modeling and proceeds distribution analysis

**One-Sentence Description**: The system models exit waterfall scenarios at various exit valuations, calculating how proceeds would be distributed among shareholders based on liquidation preferences, participation rights, and caps.

**Note**: This specification was extracted from `reports-analytics.md` to give the exit waterfall feature its own dedicated spec. The general reporting features (ownership breakdown, investor portfolio, dilution tracking, due diligence packages, cap table exports) remain in `reports-analytics.md`.

**Complements**:
- `reports-analytics.md` — general reporting, export infrastructure, and role-based access patterns
- `api-standards.md` — response envelope, HTTP status codes, error format
- `error-handling.md` — error codes for validation and business rule violations
- `user-permissions.md` — role-based access to waterfall analysis
- `share-classes.md` — liquidation preference terms, participation rights, seniority
- `convertible-conversion.md` — conversion modeling for as-if converted scenarios
- `funding-rounds.md` — original investment amounts and round pricing

---

## Table of Contents

1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Functional Requirements](#functional-requirements)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
6. [Waterfall Calculation Algorithm](#waterfall-calculation-algorithm)
7. [Business Rules](#business-rules)
8. [Edge Cases & Error Handling](#edge-cases--error-handling)
9. [Technical Implementation](#technical-implementation)
10. [Security Considerations](#security-considerations)
11. [Success Criteria](#success-criteria)
12. [Related Specifications](#related-specifications)
13. [Dependencies](#dependencies)

---

## Overview

The exit waterfall is a financial modeling tool that calculates how exit proceeds (e.g., from an M&A transaction or liquidation event) would be distributed among shareholders based on their share class terms. The waterfall respects liquidation preference hierarchies, participation rights, participation caps, and the conversion option available to non-participating preferred holders.

Key capabilities:
- Model exit scenarios at arbitrary exit valuations
- Support standard seniority, pari passu, and custom liquidation preference stacking orders
- Handle both participating and non-participating preferred share classes
- Apply participation caps and redistribute excess proceeds
- Compute breakeven analysis (the exit value at which common surpasses preferred on a per-share basis)
- Optionally include vested unexercised options and as-if converted convertible instruments

All calculations use `Decimal` precision to avoid floating-point errors. Results are returned in BRL with Brazilian number formatting on the frontend.

---

## User Stories

### US-1: Exit Waterfall Scenarios

**As an** admin, **I want to** run exit waterfall scenarios at various exit valuations, **so that** I can model how proceeds would be distributed among shareholders based on liquidation preferences.

**Acceptance Criteria**:
- Accept an exit amount and optional share class preference order.
- Calculate per-class and per-shareholder proceeds considering liquidation preferences, participation rights, and caps.
- Show breakeven analysis: the exit value at which common shareholders surpass preferred shareholders on a per-share basis.
- Support both participating and non-participating preferred scenarios.

---

## Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| FR-1 | Waterfall calculations use `Decimal` precision | No floating-point errors |
| FR-2 | Breakeven analysis converges efficiently | Within 100 binary search iterations |
| FR-3 | All numeric values use Brazilian number format for display | `1.234,56` via `Intl.NumberFormat('pt-BR')` on frontend |
| FR-4 | Waterfall supports participating and non-participating preferred classes | Both scenarios calculated correctly |
| FR-5 | Waterfall supports participation caps with excess redistribution | Capped proceeds redistributed pro-rata to uncapped classes |
| FR-6 | Non-participating preferred conversion analysis selects the better outcome | Max of (liquidation preference, as-if-converted pro-rata) |

---

## Data Models

### TypeScript Interfaces

```typescript
interface WaterfallShareClassResult {
  shareClassId: string;
  shareClassName: string;
  totalShares: string;
  liquidationPreference: string;
  participationProceeds: string;
  totalProceeds: string;
  perShareValue: string;
  roiMultiple: string | null; // null for common (no original investment basis)
  isParticipating: boolean;
  participationCapped: boolean;
}

interface WaterfallAnalysis {
  exitAmount: string;
  generatedAt: string;
  shareClassResults: WaterfallShareClassResult[];
  breakeven: {
    exitValue: string;
    description: string;
  };
  unallocatedProceeds: string;
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/reports/waterfall

Runs an exit waterfall scenario. Uses POST because the request includes a complex calculation body.

**Request Body**:

```json
{
  "exitAmount": "10000000.00",
  "shareClassOrder": ["uuid-class-preferred-a", "uuid-class-preferred-b", "uuid-class-common"],
  "includeOptions": true,
  "includeConvertibles": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `exitAmount` | string (decimal) | Yes | Total exit proceeds in BRL |
| `shareClassOrder` | UUID[] | No | Liquidation preference stacking order. Defaults to class seniority. |
| `includeOptions` | boolean | No | Include vested unexercised options (default: `true`) |
| `includeConvertibles` | boolean | No | Include converted convertible instruments (default: `true`) |

**Response** (`200 OK`):

```json
{
  "success": true,
  "data": {
    "exitAmount": "10000000.00",
    "generatedAt": "2026-02-23T14:35:00.000Z",
    "shareClassResults": [
      {
        "shareClassId": "uuid-class-preferred-a",
        "shareClassName": "PN-A",
        "totalShares": "30000",
        "liquidationPreference": "3000000.00",
        "participationProceeds": "700000.00",
        "totalProceeds": "3700000.00",
        "perShareValue": "123.33",
        "roiMultiple": "2.47",
        "isParticipating": true,
        "participationCapped": false
      },
      {
        "shareClassId": "uuid-class-common",
        "shareClassName": "ON",
        "totalShares": "40000",
        "liquidationPreference": "0.00",
        "participationProceeds": "0.00",
        "totalProceeds": "4200000.00",
        "perShareValue": "105.00",
        "roiMultiple": null,
        "isParticipating": false,
        "participationCapped": false
      }
    ],
    "breakeven": {
      "exitValue": "15000000.00",
      "description": "Exit value at which common per-share proceeds exceed preferred per-share proceeds"
    },
    "unallocatedProceeds": "0.00"
  }
}
```

**Error Responses**:

| Status | Code | When |
|--------|------|------|
| `400` | `VAL_INVALID_INPUT` | `exitAmount` is missing or not a valid decimal |
| `404` | `COMPANY_NOT_FOUND` | Company does not exist or user has no access |
| `422` | `CAP_SHARE_CLASS_NOT_FOUND` | A share class ID in `shareClassOrder` does not exist |

### Per-Role Access

| Role | Access |
|------|--------|
| ADMIN | Full (view and export) |
| FINANCE | No |
| LEGAL | No |
| INVESTOR | No |
| EMPLOYEE | No |

Only ADMIN role can run waterfall analysis. Accessing the endpoint without the ADMIN role returns `404 Not Found` (not `403`, to prevent enumeration per `api-standards.md`).

---

## Waterfall Calculation Algorithm

The exit waterfall calculates how exit proceeds are distributed among share classes based on their liquidation preferences and participation rights. The algorithm follows these steps:

### Step 1: Apply Liquidation Preferences

For each share class in seniority order (most senior first), allocate the liquidation preference amount:

```
For each shareClass in preferenceOrder:
  preferenceAmount = shareClass.liquidationPreferenceMultiple * shareClass.originalInvestment
  allocation = min(preferenceAmount, remainingProceeds)
  shareClass.preferenceProceeds = allocation
  remainingProceeds -= allocation
```

If remaining proceeds reach zero before all preferences are satisfied, junior classes receive nothing.

### Step 2: Preference Stacking Order

Liquidation preferences stack in the order defined by the share class seniority (configurable per company):

1. **Standard seniority**: Later rounds are senior to earlier rounds (Series B > Series A > Seed).
2. **Pari passu**: All preferred classes share pro-rata from the same pool.
3. **Custom order**: Admin can define a custom stacking order via the `shareClassOrder` request parameter.

### Step 3: Remaining Proceeds Distribution to Common

After all liquidation preferences are satisfied, remaining proceeds are distributed to common shareholders on a pro-rata basis:

```
commonProRataShare = shareholderShares / totalCommonShares
commonProceeds = remainingProceeds * commonProRataShare
```

### Step 4: Participating Preferred Additional Share

For share classes with participation rights, after their liquidation preference is paid, they also participate in the remaining proceeds alongside common shareholders:

```
For each participatingClass:
  participationShare = participatingClass.shares / totalParticipatingAndCommonShares
  participatingClass.participationProceeds = remainingProceeds * participationShare
```

### Step 5: Cap on Participation

If a participating preferred class has a participation cap (e.g., 3x), total proceeds (preference + participation) are capped:

```
For each participatingClass with cap:
  maxTotal = participatingClass.cap * participatingClass.originalInvestment
  if (preferenceProceeds + participationProceeds) > maxTotal:
    participatingClass.totalProceeds = maxTotal
    excessReturned = (preferenceProceeds + participationProceeds) - maxTotal
    redistribute excessReturned to uncapped classes pro-rata
```

### Step 6: Non-Participating Preferred Conversion Analysis

Non-participating preferred holders choose the better of:
- (a) Taking their liquidation preference, OR
- (b) Converting to common and receiving a pro-rata share of total proceeds.

The algorithm computes both scenarios and selects the higher value for each non-participating class.

### Step 7: Breakeven Analysis

Calculate the exit value at which common shareholders' per-share proceeds equal or exceed preferred shareholders' per-share proceeds:

```
Iterate exit values from 0 to 10x last valuation:
  For each exitValue:
    Run waterfall
    If commonPerShare >= preferredPerShare for all preferred classes:
      breakeven = exitValue
      break
```

The breakeven is computed via binary search for efficiency.

---

## Business Rules

1. **Decimal precision**: All waterfall calculations must use `Decimal` types, never floating-point. Monetary values are represented as strings in API responses to preserve precision.
2. **Stacking order**: If no custom `shareClassOrder` is provided, the default seniority is determined by the share class `seniority` field (later rounds senior to earlier rounds).
3. **Pari passu handling**: When multiple classes have the same seniority level, they share their combined liquidation preferences pro-rata.
4. **Common shares have no liquidation preference**: Common share classes (e.g., ON) have `liquidationPreferenceMultiple = 0` and participate only in remaining proceeds.
5. **Options as-if exercised**: When `includeOptions` is `true`, vested unexercised options are modeled as-if exercised into their target share class, increasing the total share count used for pro-rata calculations.
6. **Convertibles as-if converted**: When `includeConvertibles` is `true`, convertible instruments are modeled as-if converted at their most favorable conversion terms (conversion cap or discount, whichever yields more shares). See EC-2 below for ambiguous terms.
7. **Non-negative proceeds**: No share class can receive negative proceeds. If a class's allocation is zero, `totalProceeds` is `"0.00"`.
8. **Unallocated proceeds**: After all distributions, any remaining proceeds (due to rounding) are reported in `unallocatedProceeds`. This should be negligible (< $0.01).
9. **ROI multiple**: Calculated as `totalProceeds / originalInvestment`. Null for common shares that have no tracked original investment basis.

---

## Edge Cases & Error Handling

### EC-1: Zero Exit Amount

If `exitAmount` is `"0.00"`, the waterfall returns all share classes with `totalProceeds: "0.00"` and `perShareValue: "0.00"`. The breakeven is `"0.00"`. This is a valid scenario (e.g., distressed liquidation).

### EC-2: Convertible Instruments Not Yet Converted

When `includeConvertibles` is `true` in the waterfall request, convertible instruments are modeled as-if converted at their most favorable conversion terms (conversion cap or discount, whichever yields more shares). If conversion terms are ambiguous (e.g., no cap and no discount), the convertible is excluded and noted in the response metadata.

### EC-3: Empty Cap Table

When a company has no shareholders or share classes, the waterfall analysis returns `422` with code `CAP_SHARE_CLASS_NOT_FOUND` since there are no classes to distribute proceeds to.

### EC-4: Single Share Class (Common Only)

If the company has only common shares and no preferred classes, the entire exit amount is distributed pro-rata among common shareholders. The breakeven is `"0.00"` (common always equals or exceeds preferred since there are no preferred holders).

### EC-5: Proceeds Insufficient for All Preferences

When the exit amount is less than the total of all liquidation preferences, senior classes are paid first in stacking order. Junior classes receive partial or zero allocation. The waterfall still completes successfully with accurate per-class results.

### EC-6: Invalid Share Class in Custom Order

If a UUID in `shareClassOrder` does not correspond to a share class in the company, the endpoint returns `422` with code `CAP_SHARE_CLASS_NOT_FOUND` and includes the invalid UUID in the error `details`.

---

## Technical Implementation

### ReportService — Waterfall Method

```typescript
async runWaterfall(companyId: string, input: {
  exitAmount: string;
  shareClassOrder?: string[];
  includeOptions?: boolean;
  includeConvertibles?: boolean;
}): Promise<WaterfallAnalysis> {
  // 1. Load share classes with liquidation preference terms
  // 2. Determine stacking order (custom or default seniority)
  // 3. Execute waterfall algorithm (Steps 1-7 from spec)
  // 4. Compute breakeven via binary search
  // 5. Return WaterfallAnalysis
}
```

The `runWaterfall` method lives in the `ReportService` class alongside the other report generation methods. The waterfall algorithm steps (1-7) are implemented as private helper methods for testability:

- `applyLiquidationPreferences(shareClasses, remainingProceeds)` — Steps 1-2
- `distributeToCommon(commonClasses, remainingProceeds)` — Step 3
- `applyParticipation(participatingClasses, commonClasses, remainingProceeds)` — Step 4
- `applyParticipationCaps(participatingClasses)` — Step 5
- `evaluateConversionOption(nonParticipatingClasses, totalProceeds)` — Step 6
- `computeBreakeven(shareClasses, lastValuation)` — Step 7

All arithmetic uses a `Decimal` library (e.g., `decimal.js` or Prisma's `Decimal`) to avoid floating-point errors.

---

## Security Considerations

- **Access control**: Only ADMIN role can run waterfall analysis. This is enforced at the controller level via the `@Roles('ADMIN')` decorator. Non-ADMIN users receive `404 Not Found`.
- **Company scoping**: The endpoint validates that the authenticated user is an ACTIVE member of the specified company. Non-members receive `404`.
- **Audit logging**: Waterfall analysis runs are not audit-logged by default (they are read-only, non-destructive calculations). However, if the results are exported, the export action is logged as `CAP_TABLE_EXPORTED`.
- **No PII exposure**: Waterfall results contain share class names and aggregate financial data. Individual shareholder PII (names, emails, CPF) is not included in waterfall responses.
- **Rate limiting**: The waterfall endpoint uses the `write` rate limit tier (30 requests per minute) because it triggers a complex calculation.

---

## Success Criteria

- [ ] Waterfall calculation produces results matching manual calculations to the cent (verified with test fixtures)
- [ ] Breakeven analysis converges within 100 binary search iterations
- [ ] Participating preferred classes receive both liquidation preference and participation proceeds
- [ ] Non-participating preferred conversion analysis correctly selects the better outcome
- [ ] Participation caps are enforced and excess is redistributed to uncapped classes
- [ ] Standard seniority, pari passu, and custom stacking orders all produce correct results
- [ ] Zero exit amount returns all-zero results without errors
- [ ] Convertible as-if conversion uses the most favorable terms (cap vs discount)
- [ ] Ambiguous convertible terms result in exclusion with metadata note
- [ ] Invalid share class IDs in custom order return `422` with `CAP_SHARE_CLASS_NOT_FOUND`
- [ ] Only ADMIN role can access the waterfall endpoint; other roles receive `404`
- [ ] Decimal precision is maintained throughout calculations (no floating-point rounding)
- [ ] Brazilian number formatting is used for all financial values in display contexts

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [reports-analytics.md](./reports-analytics.md) | Parent spec — general reporting infrastructure, export system, role-based access patterns |
| [share-classes.md](./share-classes.md) | Source of liquidation preference terms, participation rights, seniority, and caps |
| [convertible-conversion.md](./convertible-conversion.md) | Conversion modeling for as-if converted scenarios in waterfall |
| [funding-rounds.md](./funding-rounds.md) | Original investment amounts and round pricing used for ROI multiple calculations |
| [cap-table-management.md](./cap-table-management.md) | Current shareholding data used as input for waterfall calculations |
| [option-plans.md](./option-plans.md) | Vested unexercised options for as-if exercised modeling |
| [convertible-instruments.md](./convertible-instruments.md) | Convertible instrument terms (cap, discount) for as-if conversion |
| [user-permissions.md](./user-permissions.md) | Role-based access: only ADMIN can run waterfall analysis |
| [api-standards.md](../.claude/rules/api-standards.md) | Response envelope format, HTTP status codes, error format |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: `VAL_INVALID_INPUT`, `CAP_SHARE_CLASS_NOT_FOUND`, `COMPANY_NOT_FOUND` |

---

## Dependencies

| Dependency | Purpose | Notes |
|------------|---------|-------|
| `decimal.js` or Prisma `Decimal` | Arbitrary-precision decimal arithmetic | Required for all financial calculations |
| Share class data (Prisma) | Liquidation preference terms, participation rights, seniority | Via `share-classes` module |
| Shareholding data (Prisma) | Current share counts per class and shareholder | Via `cap-table-management` module |
| Option grant data (Prisma) | Vested unexercised options for as-if exercised modeling | Via `option-plans` module |
| Convertible instrument data (Prisma) | Conversion terms for as-if converted modeling | Via `convertible-instruments` module |
| Funding round data (Prisma) | Original investment amounts and last valuation for breakeven range | Via `funding-rounds` module |
