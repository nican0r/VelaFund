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
12. [Frontend Specification](#frontend-specification)
13. [Backend Specification Additions](#backend-specification-additions)
14. [i18n Keys](#i18n-keys)
15. [Related Specifications](#related-specifications)
16. [Dependencies](#dependencies)

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

## Frontend Specification

### Page Location

URL: `/dashboard/reports/waterfall`

Located under the top-level "Reports" sidebar navigation item. The Reports nav item has sub-pages:
- Ownership Report
- Dilution Analysis
- Cap Table Export
- **Exit Waterfall** ← this page
- Due Diligence Package

### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  h1: Exit Waterfall Analysis          [Saved Scenarios ▾]│
│  body-sm: Model exit proceeds distribution               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌── Scenario Input (Card) ─────────────────────────┐   │
│  │                                                    │   │
│  │  Exit Amount *        Include Options  ☑           │   │
│  │  [R$ ___________]     Include Convertibles  ☑      │   │
│  │                                                    │   │
│  │  Stacking Order (optional)                         │   │
│  │  ☐ Use custom order                                │   │
│  │  ┌────────────────────────────────────┐                │   │
│  │  │ ≡ Series B (PN-B)  ↕          │                │   │
│  │  │ ≡ Series A (PN-A)  ↕          │                │   │
│  │  │ ≡ Common (ON)      ↕          │                │   │
│  │  └────────────────────────────────────┘                │   │
│  │                                                    │   │
│  │  [Run Waterfall]  [Save Scenario]                  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌── Results (Card, visible after run) ──────────────┐   │
│  │                                                    │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │   │
│  │  │Exit Amt │ │Breakeven│ │Top Class│ │Unalloc. │ │   │
│  │  │R$ 10M   │ │R$ 15M   │ │PN-A    │ │R$ 0,00  │ │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │   │
│  │                                                    │   │
│  │  Distribution Table                                │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ Class │Shares│Pref.  │Partic.│Total  │/Share │  │   │
│  │  │ PN-A  │30K   │R$ 3M  │R$ 700K│R$ 3,7M│123,33│  │   │
│  │  │ PN-B  │20K   │R$ 2M  │R$ 0   │R$ 2,1M│105,00│  │   │
│  │  │ ON    │40K   │R$ 0   │R$ 0   │R$ 4,2M│105,00│  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  │                                                    │   │
│  │  Breakeven Analysis                                │   │
│  │  ┌──────────────────────────────────────────────┐  │   │
│  │  │ At R$ 15.000.000,00 exit value, common       │  │   │
│  │  │ shareholders surpass preferred on per-share   │  │   │
│  │  │ basis.                                        │  │   │
│  │  └──────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                          │
│  ┌── Scenario Comparison (visible when comparing) ───┐   │
│  │  [Scenario A ▾] vs [Scenario B ▾]                 │   │
│  │  Side-by-side results tables                       │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Scenario Input Form

#### Fields

| Field | Type | Required | Default | Validation | Description |
|-------|------|----------|---------|------------|-------------|
| Exit Amount | Currency input | Yes | — | Positive decimal, max 15 digits | Total exit proceeds in BRL. Input formatted as Brazilian currency (R$ 1.234.567,89) |
| Include Options | Checkbox/switch | No | `true` | — | Include vested unexercised options in fully-diluted calculation |
| Include Convertibles | Checkbox/switch | No | `true` | — | Include as-if converted convertible instruments |
| Use Custom Order | Checkbox | No | `false` | — | Toggles visibility of the drag-and-drop stacking order list |
| Stacking Order | Drag-and-drop list | No | Default seniority | All company share classes must be present | Drag-and-drop reorderable list of share classes |

#### Currency Input Behavior

- On focus: show raw number (e.g., `10000000`)
- On blur: format as Brazilian currency (e.g., `R$ 10.000.000,00`)
- Allow paste of formatted or unformatted values
- Strip non-numeric characters before sending to API

#### Drag-and-Drop Stacking Order

- Uses `@dnd-kit/core` and `@dnd-kit/sortable` (lightweight, accessible DnD library)
- Initially hidden; shown when "Use custom order" checkbox is checked
- Pre-populated with all company share classes in their default seniority order
- Each item shows: drag handle (≡ icon) + share class name + share class type badge (e.g., "Preferred", "Common")
- Keyboard accessible: select with Enter/Space, reorder with Arrow keys
- Visual feedback: item lifts with shadow when dragged

#### Action Buttons

| Button | Variant | Label | Behavior |
|--------|---------|-------|----------|
| Run Waterfall | Primary | "Run Waterfall" / "Executar Waterfall" | Submits form, calls API, displays results |
| Save Scenario | Secondary | "Save Scenario" / "Salvar Cenário" | Opens save dialog (only enabled after results are displayed) |
| Compare | Ghost | "Compare Scenarios" / "Comparar Cenários" | Toggles comparison mode (only visible when 2+ saved scenarios exist) |

### Results Display

#### Summary Stat Cards (4 cards, single row)

| Card | Value | Format | Color |
|------|-------|--------|-------|
| Exit Amount | `exitAmount` | `R$ {formatted}` | Default (white bg) |
| Breakeven Value | `breakeven.exitValue` | `R$ {formatted}` | Default |
| Highest Per-Share | Best `perShareValue` from results | `R$ {formatted} ({className})` | Default |
| Unallocated | `unallocatedProceeds` | `R$ {formatted}` | Green if 0.00, cream/warning if > 0 |

#### Distribution Table

| Column | Field | Alignment | Format |
|--------|-------|-----------|--------|
| Share Class | `shareClassName` | left | Text + type badge |
| Total Shares | `totalShares` | right | Brazilian number format (`30.000`) |
| Liq. Preference | `liquidationPreference` | right | `R$ {formatted}` |
| Participation | `participationProceeds` | right | `R$ {formatted}` |
| Total Proceeds | `totalProceeds` | right | `R$ {formatted}`, **bold** |
| Per Share | `perShareValue` | right | `R$ {formatted}` |
| ROI Multiple | `roiMultiple` | right | `{value}x` or "—" for common |
| Participating | `isParticipating` | center | Badge: "Yes" (green-100) / "No" (gray-100) |
| Capped | `participationCapped` | center | Badge: "Yes" (cream-100) / "No" (gray-100) |

- Table container: `radius-lg`, `1px solid gray-200` border
- Header: `gray-50` bg, `caption` size, uppercase
- Summary row (bottom): bold text, `gray-50` bg, shows totals for Liq. Preference, Participation, Total Proceeds
- Sortable by: Share Class (alpha), Total Proceeds (desc), Per Share (desc)

#### Breakeven Card

- Full-width card below the distribution table
- Background: `blue-50`
- Icon: `TrendingUp` (Lucide), `blue-600`
- Title: "Breakeven Analysis" (h4)
- Body: `breakeven.description` text + formatted `breakeven.exitValue`
- Example: "At an exit of **R$ 15.000.000,00**, common shareholders' per-share proceeds equal or exceed preferred shareholders' per-share proceeds."

### Save Scenario Flow

1. User clicks "Save Scenario" after running a waterfall
2. Save dialog opens (modal, small: 400px):
   - Title: "Save Scenario" (h3)
   - Field: "Scenario Name" (text input, required, max 100 chars, placeholder: "e.g., Optimistic Exit")
   - Cancel button (secondary) + Save button (primary)
3. On save: scenario is persisted (see Backend section below)
4. Success toast: "Scenario saved"
5. "Saved Scenarios" dropdown in page header updates to include the new scenario

### Saved Scenarios Dropdown

- Position: right side of page header
- Trigger: secondary button with label "Saved Scenarios ({count})" + ChevronDown icon
- Dropdown menu (max-height: 400px, scrollable):
  - Each item shows: scenario name + exit amount + date saved
  - Click to load: replaces current results with saved scenario data
  - Delete icon (Trash2, ghost) on hover — confirmation before deleting
  - "Compare" checkbox on each item — selecting 2 items enables comparison mode

### Scenario Comparison Mode

When user selects exactly 2 scenarios from the Saved Scenarios dropdown:

```
┌── Comparison View ─────────────────────────────────────┐
│                                                         │
│  ┌── Scenario A ──────────┐  ┌── Scenario B ──────────┐│
│  │ "Optimistic Exit"      │  │ "Conservative Exit"    ││
│  │ Exit: R$ 50.000.000    │  │ Exit: R$ 10.000.000    ││
│  │                        │  │                        ││
│  │ [Distribution Table]   │  │ [Distribution Table]   ││
│  │ [Breakeven Card]       │  │ [Breakeven Card]       ││
│  └────────────────────────┘  └────────────────────────┘│
│                                                         │
│  ┌── Delta Summary ──────────────────────────────────┐ │
│  │ Class │ Scenario A │ Scenario B │ Δ Total │ Δ /Share││
│  │ PN-A  │ R$ 15M     │ R$ 3,7M    │ -R$ 11,3M│-377,33││
│  │ ON    │ R$ 25M     │ R$ 4,2M    │ -R$ 20,8M│-520,00││
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

- Side-by-side layout on desktop (2 equal columns)
- Stacked on mobile (scenario A above, scenario B below)
- Delta Summary table at the bottom showing the difference between scenarios per share class
- Positive deltas in green, negative in red
- Exit comparison mode by clicking "Exit Comparison" button or deselecting scenarios

### Loading State

After clicking "Run Waterfall":
1. Button shows spinner + "Calculating..." text
2. Results card area shows skeleton loading (3 stat card skeletons + table skeleton)
3. Form inputs remain visible but disabled
4. Typical response time: < 2 seconds

### Error States

| Error | Display | User Action |
|-------|---------|-------------|
| `VAL_INVALID_INPUT` (400) | Red border on exit amount field + field error message | Fix input and retry |
| `CAP_SHARE_CLASS_NOT_FOUND` (422) | Error toast: "Share class not found. The cap table may have changed." | Refresh page |
| `COMPANY_NOT_FOUND` (404) | Redirect to company list or 404 page | — |
| Network error | Error toast: "Unable to run analysis. Please check your connection." | Retry |

### Empty State

When the page loads and no waterfall has been run yet:

- Results area shows: centered illustration (BarChart3 icon, 64px, gray-300) + "Run your first scenario" (h3) + "Enter an exit amount and click Run Waterfall to see how proceeds would be distributed." (body, gray-500) + primary button "Run Waterfall" (scrolls to form)

### Accessibility

- Form fields: all inputs have associated `<label>` elements
- Drag-and-drop: keyboard accessible via @dnd-kit (Arrow keys to reorder, Enter/Space to pick up/drop)
- Drag-and-drop: `aria-label="Reorder share class stacking priority"`, live region announces order changes
- Results table: proper `<table>` with `<thead>`, `<th scope="col">`, `tabular-nums` for numbers
- Stat cards: `role="group"`, `aria-label="Waterfall summary"`
- Currency input: `aria-label="Exit amount in Brazilian Reais"`
- Comparison mode: `aria-live="polite"` region for announcing comparison results

### Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| `xl+` | Form card (full width) → Stat cards (4 cols) → Table (full width) → Breakeven card |
| `md-lg` | Form card (full width) → Stat cards (2 cols) → Table (horizontal scroll) → Breakeven card |
| `sm` | Form card (full width, stacked fields) → Stat cards (1 col) → Table (horizontal scroll) → Breakeven card |
| Comparison `xl+` | Two columns side-by-side |
| Comparison `sm-lg` | Stacked (A on top, B below) |

### State Management (Frontend)

```typescript
// TanStack Query mutation for running waterfall
const runWaterfall = useMutation({
  mutationFn: (input: RunWaterfallInput) =>
    api.post<WaterfallAnalysis>(`/api/v1/companies/${companyId}/reports/waterfall`, input),
});

// TanStack Query for saved scenarios
const savedScenarios = useQuery({
  queryKey: ['waterfall-scenarios', companyId],
  queryFn: () => api.getList<WaterfallScenario>(`/api/v1/companies/${companyId}/reports/waterfall/scenarios`),
});

// Local state
const [showCustomOrder, setShowCustomOrder] = useState(false);
const [shareClassOrder, setShareClassOrder] = useState<string[]>([]);
const [comparisonScenarioIds, setComparisonScenarioIds] = useState<[string, string] | null>(null);
```

### Component Breakdown

| Component | Description |
|-----------|-------------|
| `WaterfallPage` | Page container with header, form, results, comparison |
| `WaterfallInputForm` | Form card with exit amount, toggles, stacking order |
| `CurrencyInput` | Brazilian currency formatted input (reusable) |
| `DraggableShareClassList` | @dnd-kit sortable list of share classes |
| `WaterfallResults` | Results card with stat cards + distribution table + breakeven |
| `WaterfallDistributionTable` | Data table for share class results |
| `WaterfallBreakevenCard` | Breakeven analysis highlight card |
| `WaterfallScenarioDropdown` | Saved scenarios management dropdown |
| `WaterfallSaveDialog` | Modal dialog for naming and saving a scenario |
| `WaterfallComparison` | Side-by-side scenario comparison view |
| `WaterfallDeltaTable` | Difference summary table for comparison mode |

---

## Backend Specification Additions

### Scenario Persistence

To support saving and comparing scenarios, add a `WaterfallScenario` model:

```prisma
model WaterfallScenario {
  id              String   @id @default(uuid())
  companyId       String   @map("company_id")
  createdById     String   @map("created_by_id")
  name            String
  exitAmount      Decimal  @map("exit_amount") @db.Decimal(20, 2)
  includeOptions  Boolean  @default(true) @map("include_options")
  includeConvertibles Boolean @default(true) @map("include_convertibles")
  shareClassOrder String[] @map("share_class_order")  // UUID array
  resultData      Json     @map("result_data")         // Full WaterfallAnalysis JSON
  createdAt       DateTime @default(now()) @map("created_at")

  company   Company @relation(fields: [companyId], references: [id])
  createdBy User    @relation(fields: [createdById], references: [id])

  @@index([companyId, createdAt])
  @@map("waterfall_scenarios")
}
```

### Additional API Endpoints for Scenarios

#### Save Scenario

```
POST /api/v1/companies/:companyId/reports/waterfall/scenarios
```

Request Body:
```json
{
  "name": "Optimistic Exit",
  "exitAmount": "50000000.00",
  "includeOptions": true,
  "includeConvertibles": true,
  "shareClassOrder": ["uuid-1", "uuid-2"],
  "resultData": { ... }
}
```

Response: `201 Created` with the saved `WaterfallScenario`.

#### List Saved Scenarios

```
GET /api/v1/companies/:companyId/reports/waterfall/scenarios
```

Query Parameters: `page`, `limit`, `sort` (default: `-createdAt`).

Response: Paginated list of `WaterfallScenario` (name, id, exitAmount, createdAt). Does NOT include full `resultData` to keep the list response lightweight.

#### Get Scenario Detail

```
GET /api/v1/companies/:companyId/reports/waterfall/scenarios/:scenarioId
```

Response: Full `WaterfallScenario` including `resultData`.

#### Delete Scenario

```
DELETE /api/v1/companies/:companyId/reports/waterfall/scenarios/:scenarioId
```

Response: `204 No Content`.

#### Per-Role Access for Scenarios

Same as waterfall endpoint: ADMIN only. Other roles receive `404`.

### Request/Response DTOs

```typescript
class RunWaterfallDto {
  @IsString()
  @IsDecimalString()
  @IsNotEmpty()
  exitAmount: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  shareClassOrder?: string[];

  @IsOptional()
  @IsBoolean()
  includeOptions?: boolean;

  @IsOptional()
  @IsBoolean()
  includeConvertibles?: boolean;
}

class SaveScenarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsDecimalString()
  exitAmount: string;

  @IsOptional()
  @IsBoolean()
  includeOptions?: boolean;

  @IsOptional()
  @IsBoolean()
  includeConvertibles?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  shareClassOrder?: string[];

  @IsObject()
  resultData: WaterfallAnalysis;
}
```

### Metadata Field for Excluded Convertibles (EC-2)

Add a `metadata` field to the `WaterfallAnalysis` interface to report excluded convertibles:

```typescript
interface WaterfallAnalysis {
  exitAmount: string;
  generatedAt: string;
  shareClassResults: WaterfallShareClassResult[];
  breakeven: {
    exitValue: string;
    description: string;
  };
  unallocatedProceeds: string;
  metadata?: {
    excludedConvertibles?: Array<{
      convertibleId: string;
      reason: string; // e.g., "No cap or discount defined"
    }>;
  };
}
```

### Pari Passu Clarification

When multiple share classes have the same seniority level, they share their combined liquidation preferences pro-rata based on their individual preference amounts:

```typescript
// Pari passu classes share from the same pool
const totalPariPassuPreference = pariPassuClasses.reduce(
  (sum, c) => sum.add(c.liquidationPreferenceMultiple.mul(c.originalInvestment)),
  new Decimal(0),
);

for (const cls of pariPassuClasses) {
  const classPreference = cls.liquidationPreferenceMultiple.mul(cls.originalInvestment);
  const proRataShare = classPreference.div(totalPariPassuPreference);
  cls.preferenceProceeds = Decimal.min(
    classPreference,
    remainingProceeds.mul(proRataShare),
  );
}
```

### Breakeven Binary Search Details

```typescript
computeBreakeven(shareClasses, lastValuation: Decimal): { exitValue: string; description: string } {
  let low = new Decimal(0);
  let high = lastValuation.mul(10); // 10x last round valuation
  const tolerance = new Decimal('0.01'); // Converge within R$ 0.01
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    const mid = low.add(high).div(2);
    const result = this.runWaterfallAtExitAmount(shareClasses, mid);

    const commonPerShare = this.getCommonPerShare(result);
    const maxPreferredPerShare = this.getMaxPreferredPerShare(result);

    if (commonPerShare.gte(maxPreferredPerShare)) {
      high = mid;
    } else {
      low = mid;
    }

    if (high.sub(low).lt(tolerance)) break;
  }

  return {
    exitValue: high.toFixed(2),
    description: 'Exit value at which common per-share proceeds exceed preferred per-share proceeds',
  };
}
```

- Start: `0`
- End: `10 * lastRoundValuation` (from most recent FundingRound's `preMoneyValuation + amountRaised`)
- Convergence: within R$ 0.01
- Max iterations: 100 (more than sufficient for binary search on this range)

### Rounding Rules

- All intermediate calculations use `Decimal` with no rounding
- Final per-share values: round to 2 decimal places using `ROUND_HALF_UP` (banker's rounding)
- Final total proceeds: round to 2 decimal places using `ROUND_HALF_UP`
- Unallocated proceeds: the remainder after rounding (should be < R$ 0.01)

### Error Codes (Additions)

| Error Code | HTTP Status | messageKey | When |
|------------|-------------|------------|------|
| `WATERFALL_SCENARIO_NOT_FOUND` | 404 | `errors.waterfall.scenarioNotFound` | Scenario ID doesn't exist |
| `WATERFALL_SCENARIO_LIMIT` | 422 | `errors.waterfall.scenarioLimit` | Max 50 saved scenarios per company |

---

## i18n Keys

Add to both `messages/pt-BR.json` and `messages/en.json`:

```
reports.waterfall.title = "Análise de Waterfall de Saída" / "Exit Waterfall Analysis"
reports.waterfall.description = "Modele a distribuição de proventos de saída" / "Model exit proceeds distribution"
reports.waterfall.exitAmount = "Valor de Saída" / "Exit Amount"
reports.waterfall.exitAmountPlaceholder = "R$ 0,00" / "R$ 0.00"
reports.waterfall.includeOptions = "Incluir Opções" / "Include Options"
reports.waterfall.includeConvertibles = "Incluir Conversíveis" / "Include Convertibles"
reports.waterfall.useCustomOrder = "Usar ordem personalizada" / "Use custom order"
reports.waterfall.stackingOrder = "Ordem de Empilhamento" / "Stacking Order"
reports.waterfall.runButton = "Executar Waterfall" / "Run Waterfall"
reports.waterfall.calculating = "Calculando..." / "Calculating..."
reports.waterfall.saveScenario = "Salvar Cenário" / "Save Scenario"
reports.waterfall.savedScenarios = "Cenários Salvos ({count})" / "Saved Scenarios ({count})"
reports.waterfall.scenarioName = "Nome do Cenário" / "Scenario Name"
reports.waterfall.scenarioNamePlaceholder = "ex: Saída Otimista" / "e.g., Optimistic Exit"
reports.waterfall.scenarioSaved = "Cenário salvo" / "Scenario saved"
reports.waterfall.scenarioDeleted = "Cenário excluído" / "Scenario deleted"
reports.waterfall.compareScenarios = "Comparar Cenários" / "Compare Scenarios"
reports.waterfall.exitComparison = "Sair da Comparação" / "Exit Comparison"
reports.waterfall.deltaSummary = "Resumo das Diferenças" / "Delta Summary"
reports.waterfall.breakeven = "Análise de Breakeven" / "Breakeven Analysis"
reports.waterfall.breakevenDescription = "No valor de saída de {value}, os proventos por ação dos acionistas ordinários igualam ou superam os dos preferenciais." / "At an exit of {value}, common shareholders' per-share proceeds equal or exceed preferred shareholders' per-share proceeds."
reports.waterfall.emptyTitle = "Execute seu primeiro cenário" / "Run your first scenario"
reports.waterfall.emptyDescription = "Insira um valor de saída e clique em Executar Waterfall para ver como os proventos seriam distribuídos." / "Enter an exit amount and click Run Waterfall to see how proceeds would be distributed."
reports.waterfall.shareClassNotFound = "Classe de ação não encontrada. O cap table pode ter mudado." / "Share class not found. The cap table may have changed."
reports.waterfall.table.shareClass = "Classe de Ação" / "Share Class"
reports.waterfall.table.totalShares = "Total de Ações" / "Total Shares"
reports.waterfall.table.liquidationPreference = "Preferência de Liquidação" / "Liquidation Preference"
reports.waterfall.table.participation = "Participação" / "Participation"
reports.waterfall.table.totalProceeds = "Proventos Totais" / "Total Proceeds"
reports.waterfall.table.perShare = "Por Ação" / "Per Share"
reports.waterfall.table.roiMultiple = "Múltiplo ROI" / "ROI Multiple"
reports.waterfall.table.participating = "Participante" / "Participating"
reports.waterfall.table.capped = "Limitado" / "Capped"
errors.waterfall.scenarioNotFound = "Cenário não encontrado" / "Scenario not found"
errors.waterfall.scenarioLimit = "Limite máximo de 50 cenários salvos por empresa" / "Maximum limit of 50 saved scenarios per company"
```

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
