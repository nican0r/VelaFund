# Funding Rounds Specification

**Topic of Concern**: Investment round management and tracking

**One-Sentence Description**: The system manages funding rounds including round details, investor commitments, pro-forma modeling, and closing mechanics.

---

## Overview

Funding rounds represent organized investment events (Seed, Series A, B, etc.) where companies raise capital from multiple investors. The system tracks round parameters (target amount, valuation, price per share), manages investor commitments, models pro-forma cap tables before closing, and processes the closing by issuing shares to all investors.

---

## User Stories

### US-1: Create Funding Round
**As an** admin user
**I want to** create a new funding round with target amount and valuation
**So that** I can organize and track investment commitments

### US-2: Model Pro-Forma Cap Table
**As an** admin user
**I want to** see the pro-forma cap table before closing
**So that** I can understand dilution impact before finalizing

### US-3: Close Funding Round
**As an** admin user
**I want to** close the round and issue shares to all investors
**So that** investments are officially recorded

---

## Functional Requirements

### FR-1: Round Management
- Create rounds: Seed, Series A, B, C, Bridge, etc.
- Set target amount, pre-money valuation, post-money valuation
- Calculate price per share automatically
- Track multiple closes (first close, second close, final close)

### FR-2: Investor Commitments
- Track investor commitments (soft circle, signed term sheet, wired funds)
- Support side letters for special terms
- Track payment status per investor

### FR-3: Pro-Forma Modeling
- Show cap table before and after round closes
- Calculate dilution for each existing shareholder
- Model different scenarios (minimum close, target close, maximum close)

### FR-4: Round Closing
- Batch issue shares to all investors
- Validate all payments received
- Create single transaction per investor
- Update cap table atomically

---

## Data Models

```typescript
interface FundingRound {
  id: string;
  company_id: string;
  name: string;                      // "Seed Round", "Series A"
  round_type: 'SEED' | 'SERIES_A' | 'SERIES_B' | 'SERIES_C' | 'BRIDGE';

  // Financial Terms
  target_amount: number;
  current_amount: number;            // Sum of commitments
  minimum_close_amount: number;      // Minimum to close round
  pre_money_valuation: number;
  post_money_valuation: number;      // Pre-money + target
  price_per_share: number;           // Calculated

  // Dates
  start_date: Date;
  target_close_date: Date;
  closed_at: Date | null;

  // Status
  status: 'OPEN' | 'FIRST_CLOSE' | 'FINAL_CLOSE' | 'CANCELLED';

  // Share Class
  share_class_id: string;            // Which class being issued

  created_at: Date;
}

interface RoundCommitment {
  id: string;
  funding_round_id: string;
  shareholder_id: string;

  // Commitment
  committed_amount: number;
  shares_allocated: number;          // Amount / price_per_share

  // Payment
  payment_status: 'PENDING' | 'RECEIVED' | 'CONFIRMED';
  payment_date: Date | null;
  payment_reference: string | null;

  // Side Letter
  has_side_letter: boolean;
  side_letter_url: string | null;

  created_at: Date;
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/funding-rounds

Create a new funding round.

**Request**:
```json
{
  "name": "Seed Round",
  "roundType": "SEED",
  "targetAmount": "5000000.00",
  "minimumCloseAmount": "2000000.00",
  "preMoneyValuation": "20000000.00",
  "pricePerShare": "10.00",
  "shareClassId": "550e8400-e29b-41d4-a716-446655440000",
  "startDate": "2026-03-01",
  "targetCloseDate": "2026-06-30"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "companyId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Seed Round",
    "roundType": "SEED",
    "targetAmount": "5000000.00",
    "currentAmount": "0.00",
    "minimumCloseAmount": "2000000.00",
    "preMoneyValuation": "20000000.00",
    "postMoneyValuation": "25000000.00",
    "pricePerShare": "10.00",
    "shareClassId": "550e8400-e29b-41d4-a716-446655440000",
    "startDate": "2026-03-01",
    "targetCloseDate": "2026-06-30",
    "closedAt": null,
    "status": "OPEN",
    "createdAt": "2026-02-23T10:00:00.000Z",
    "updatedAt": "2026-02-23T10:00:00.000Z"
  }
}
```

### GET /api/v1/companies/:companyId/funding-rounds

List all funding rounds for a company with pagination.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `status` | string | — | Filter by status: `OPEN`, `FIRST_CLOSE`, `FINAL_CLOSE`, `CANCELLED` |
| `sort` | string | `-createdAt` | Sort field (prefix `-` for descending) |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Seed Round",
      "roundType": "SEED",
      "targetAmount": "5000000.00",
      "currentAmount": "3200000.00",
      "status": "OPEN",
      "startDate": "2026-03-01",
      "targetCloseDate": "2026-06-30",
      "createdAt": "2026-02-23T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### GET /api/v1/companies/:companyId/funding-rounds/:roundId

Get funding round detail.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "companyId": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Seed Round",
    "roundType": "SEED",
    "targetAmount": "5000000.00",
    "currentAmount": "3200000.00",
    "minimumCloseAmount": "2000000.00",
    "preMoneyValuation": "20000000.00",
    "postMoneyValuation": "25000000.00",
    "pricePerShare": "10.00",
    "shareClassId": "550e8400-e29b-41d4-a716-446655440000",
    "startDate": "2026-03-01",
    "targetCloseDate": "2026-06-30",
    "closedAt": null,
    "status": "OPEN",
    "commitmentCount": 5,
    "createdAt": "2026-02-23T10:00:00.000Z",
    "updatedAt": "2026-02-23T10:00:00.000Z"
  }
}
```

### PUT /api/v1/companies/:companyId/funding-rounds/:roundId

Update funding round details. Only allowed while status is `OPEN`.

**Request**:
```json
{
  "name": "Seed Round - Extended",
  "targetCloseDate": "2026-09-30",
  "targetAmount": "6000000.00"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Seed Round - Extended",
    "targetAmount": "6000000.00",
    "targetCloseDate": "2026-09-30",
    "status": "OPEN",
    "updatedAt": "2026-02-24T14:00:00.000Z"
  }
}
```

### POST /api/v1/companies/:companyId/funding-rounds/:roundId/commitments

Add an investor commitment to a funding round.

**Request**:
```json
{
  "shareholderId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "committedAmount": "500000.00",
  "hasSideLetter": false
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "fundingRoundId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "shareholderId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "committedAmount": "500000.00",
    "sharesAllocated": "50000",
    "paymentStatus": "PENDING",
    "paymentDate": null,
    "paymentReference": null,
    "hasSideLetter": false,
    "sideletterUrl": null,
    "createdAt": "2026-02-23T11:00:00.000Z"
  }
}
```

### GET /api/v1/companies/:companyId/funding-rounds/:roundId/commitments

List all commitments for a funding round.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `paymentStatus` | string | — | Filter: `PENDING`, `RECEIVED`, `CONFIRMED` |
| `sort` | string | `-createdAt` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "shareholderId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "shareholderName": "Investor A",
      "committedAmount": "500000.00",
      "sharesAllocated": "50000",
      "paymentStatus": "CONFIRMED",
      "createdAt": "2026-02-23T11:00:00.000Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### GET /api/v1/companies/:companyId/funding-rounds/:roundId/proforma

Get pro-forma cap table showing before/after round impact.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "beforeRound": {
      "totalShares": 1000000,
      "shareholders": [
        { "name": "Founder", "shares": 700000, "percentage": 70.0 }
      ]
    },
    "afterRound": {
      "totalShares": 1200000,
      "shareholders": [
        { "name": "Founder", "shares": 700000, "percentage": 58.33 },
        { "name": "Investor A", "shares": 150000, "percentage": 12.5 }
      ]
    },
    "dilution": {
      "Founder": { "before": 70.0, "after": 58.33, "change": -11.67 }
    }
  }
}
```

### POST /api/v1/companies/:companyId/funding-rounds/:roundId/close

Close the funding round (issue shares to all investors).

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "roundId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status": "FINAL_CLOSE",
    "closedAt": "2026-06-15T16:00:00.000Z",
    "totalRaised": "4800000.00",
    "totalSharesIssued": "480000",
    "investorCount": 5
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description | messageKey |
|------|-------------|-------------|------------|
| `ROUND_NOT_FOUND` | 404 | Funding round does not exist or is not accessible | `errors.round.notFound` |
| `ROUND_NOT_OPEN` | 422 | Round is not in OPEN status; cannot add commitments or modify | `errors.round.notOpen` |
| `ROUND_HARD_CAP_REACHED` | 422 | Commitment would exceed the round's target amount | `errors.round.hardCapReached` |
| `ROUND_COMMITMENT_NOT_FOUND` | 404 | Commitment does not exist in this round | `errors.round.commitmentNotFound` |
| `ROUND_ALREADY_CLOSED` | 422 | Round has already been closed; cannot close again | `errors.round.alreadyClosed` |
| `ROUND_MINIMUM_NOT_MET` | 422 | Cannot close round because committed amount is below minimum close amount | `errors.round.minimumNotMet` |
| `CAP_SHARE_CLASS_NOT_FOUND` | 404 | The specified share class does not exist | `errors.cap.shareClassNotFound` |
| `VAL_INVALID_INPUT` | 400 | One or more request fields failed validation | `errors.val.invalidInput` |

**Error Response Example**:
```json
{
  "success": false,
  "error": {
    "code": "ROUND_MINIMUM_NOT_MET",
    "message": "Valor mínimo da rodada não foi atingido",
    "messageKey": "errors.round.minimumNotMet",
    "details": {
      "minimumCloseAmount": "2000000.00",
      "currentAmount": "1500000.00"
    }
  }
}
```

---

## Business Rules

### BR-1: Price Per Share Calculation
- Price = Pre-money Valuation / Existing Shares
- OR Price = Target Amount / New Shares to Issue

### BR-2: Minimum Close Amount
- Round can only close if committed amount >= minimum_close_amount

### BR-3: Closing Validation
- All investors must have payment_status = "CONFIRMED"
- Cannot close round twice

### BR-4: Pro-Forma Accuracy
- Pro-forma MUST match actual cap table after close
- Dilution calculations MUST be precise

---

## Edge Cases

### EC-1: Commitment Exceeds Hard Cap
**Scenario**: An investor attempts to commit an amount that would push the round's total above the target amount.
**Handling**: Return `ROUND_HARD_CAP_REACHED` (422). The system does not accept partial commitments automatically. The admin must adjust the commitment amount to fit within the remaining capacity.

### EC-2: Close Attempted with Unconfirmed Payments
**Scenario**: Admin attempts to close the round, but one or more commitments have `paymentStatus` of `PENDING` or `RECEIVED` (not `CONFIRMED`).
**Handling**: Return 422 with a message indicating which commitments have unconfirmed payments. All commitments must have `paymentStatus = CONFIRMED` before closing.

### EC-3: Round Cancelled with Existing Commitments
**Scenario**: Admin cancels a round that already has investor commitments.
**Handling**: All commitments are marked as `CANCELLED`. If any payments were received, the admin is responsible for coordinating refunds outside the system. An audit event `ROUND_CANCELLED` is created.

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [cap-table-management.md](./cap-table-management.md) | Round closing updates the cap table with new shareholdings and triggers snapshots |
| [transactions.md](./transactions.md) | Each commitment results in a share issuance transaction at round close |
| [share-classes.md](./share-classes.md) | Each round targets a specific share class for issued shares |
| [shareholder-registry.md](./shareholder-registry.md) | Investors must exist as shareholders before committing; new investors become shareholders |
| [convertible-instruments.md](./convertible-instruments.md) | Convertible instruments may be linked to a funding round as qualified financing trigger |
| [company-management.md](./company-management.md) | Funding rounds are scoped to a company; company must be ACTIVE |
| [notifications.md](./notifications.md) | Email notifications for round invitations, commitment confirmations, and round closure |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, pagination, URL conventions for funding round endpoints |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: ROUND_NOT_FOUND, ROUND_NOT_OPEN, ROUND_HARD_CAP_REACHED, ROUND_COMMITMENT_NOT_FOUND, ROUND_ALREADY_CLOSED, ROUND_MINIMUM_NOT_MET |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: ROUND_CREATED, ROUND_UPDATED, ROUND_OPENED, ROUND_CLOSED, ROUND_CANCELLED, COMMITMENT_CREATED, COMMITMENT_CONFIRMED, COMMITMENT_CANCELLED |

---

## Frontend Implementation

### FE-1: Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard/investments` | InvestmentsPage | Shared tab container with Rounds and Convertibles tabs |
| `/dashboard/investments/rounds/new` | CreateRoundPage | Multi-field form to create a new funding round |
| `/dashboard/investments/rounds/[roundId]` | RoundDetailPage | Round summary, commitments, pro-forma, actions |
| `/dashboard/investments/rounds/[roundId]/edit` | EditRoundPage | Edit round details (DRAFT/OPEN status only) |

**Navigation**: Sidebar item "Investments" under main navigation. Active state highlights when on any `/dashboard/investments/*` route.

### FE-2: Page Layouts

#### Rounds List (within InvestmentsPage, "Rounds" tab)

```
┌─────────────────────────────────────────────────────────┐
│  h1: Investments                   [+ New Round]        │
│  body-sm: Manage funding rounds and convertibles        │
├─────────────────────────────────────────────────────────┤
│  [Rounds] [Convertibles]  ← Tab bar                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Open Rounds│ │Total     │ │Total     │ │Avg       │  │
│  │  2       │ │Raised    │ │Committed │ │Investment│  │
│  │          │ │R$ 5.2M   │ │R$ 4.8M   │ │R$ 240K   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  Filters: [Status ▼] [Type ▼] [Date Range]  🔍 Search  │
├─────────────────────────────────────────────────────────┤
│  Rounds Table (paginated)                               │
│  ...                                                    │
├─────────────────────────────────────────────────────────┤
│  Showing 1-10 of 24                    < 1 2 3 >       │
└─────────────────────────────────────────────────────────┘
```

#### Round Detail Page

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Rounds    Status Badge    [Edit] [Actions ▼] │
│  h1: Series A Round                                     │
│  body-sm: Created 15/01/2026                            │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Target    │ │Raised    │ │Investors │ │Price/    │  │
│  │R$ 5M     │ │R$ 3.2M   │ │  8       │ │Share     │  │
│  │          │ │64%       │ │          │ │R$ 1,50   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  ████████████████░░░░░░░░░  64% of target              │
│  ▲ min close (R$2M)                                     │
│  RoundProgressBar with min/target/hardcap markers       │
├─────────────────────────────────────────────────────────┤
│  [Commitments] [Pro-Forma] [Details]  ← Tab bar        │
│  ...tab content...                                      │
└─────────────────────────────────────────────────────────┘
```

### FE-3: Components

| Component | Description | Props |
|-----------|-------------|-------|
| `RoundProgressBar` | Segmented progress bar showing current raised vs min close, target, and hard cap | `raised: number`, `minClose: number`, `target: number`, `hardCap?: number` |
| `CommitmentTable` | Paginated table of investor commitments with payment status | `roundId: string`, `companyId: string` |
| `ProFormaComparison` | Before/after cap table comparison showing dilution impact | `roundId: string`, `companyId: string` |
| `DilutionChart` | Horizontal grouped bar chart (Recharts) comparing pre/post ownership | `proFormaData: ProFormaEntry[]` |
| `AddCommitmentModal` | Modal form for adding a new investor commitment | `roundId: string`, `onSuccess: () => void` |
| `ConfirmPaymentModal` | Small modal to confirm payment receipt for a commitment | `commitmentId: string`, `onSuccess: () => void` |
| `CloseRoundModal` | Large 3-step wizard modal for round closing | `roundId: string`, `onSuccess: () => void` |
| `CancelRoundModal` | Destructive confirmation modal for cancelling a round | `roundId: string`, `onSuccess: () => void` |
| `RoundStatCard` | Stat card for round metrics (reuses design system stat card pattern) | `label: string`, `value: string`, `change?: string` |
| `RoundStatusBadge` | Status pill badge for round status | `status: RoundStatus` |
| `RoundFilters` | Filter bar with status dropdown, type dropdown, date range, search | `onFilterChange: (filters) => void` |

### FE-4: Tables

#### Rounds Table

| Column | Field | Type | Sortable | Alignment |
|--------|-------|------|----------|-----------|
| Name | `name` | text link (navigates to detail) | Yes | Left |
| Type | `roundType` | badge | Yes | Left |
| Target | `targetAmount` | currency (BRL) | Yes | Right |
| Raised | `totalRaised` | currency (BRL) | Yes | Right |
| % Raised | computed | percentage with mini progress bar | Yes | Right |
| Status | `status` | status badge | Yes | Center |
| Target Close | `targetCloseDate` | date (dd/MM/yyyy) | Yes | Left |
| Created | `createdAt` | date (dd/MM/yyyy) | Yes | Left |

- Default sort: `-createdAt` (newest first)
- Empty state: illustration + "Nenhuma rodada de investimento" + "Crie sua primeira rodada" CTA

#### Commitments Table

| Column | Field | Type | Sortable | Alignment |
|--------|-------|------|----------|-----------|
| Investor | `shareholder.name` | text with avatar | Yes | Left |
| Amount | `committedAmount` | currency (BRL) | Yes | Right |
| Shares | `sharesAllocated` | number | No | Right |
| Payment Status | `paymentStatus` | status badge | Yes | Center |
| Side Letter | `hasSideLetter` | boolean icon (check/dash) | No | Center |
| Date | `createdAt` | date (dd/MM/yyyy) | Yes | Left |
| Actions | — | icon buttons (confirm, cancel) | No | Right |

- Default sort: `-createdAt`
- Empty state: "Nenhum compromisso registrado" + "Adicionar compromisso" CTA
- Summary footer row: Total committed amount, total shares

### FE-5: Forms

#### Create/Edit Round Form

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `name` | Nome da Rodada | text input | min 3, max 100 chars | Yes |
| `roundType` | Tipo de Rodada | select (SEED, SERIES_A, SERIES_B, SERIES_C, BRIDGE, OTHER) | must select one | Yes |
| `shareClassId` | Classe de Ações | searchable select (from company share classes) | must exist | Yes |
| `targetAmount` | Valor Alvo | currency input (BRL) | > 0, decimal(18,2) | Yes |
| `minimumCloseAmount` | Valor Mínimo para Fechamento | currency input (BRL) | > 0, <= targetAmount | No |
| `preMoneyValuation` | Valuation Pré-Money | currency input (BRL) | > 0, decimal(18,2) | Yes |
| `pricePerShare` | Preço por Ação | currency input (BRL) | > 0, decimal(18,6) | Yes |
| `startDate` | Data de Início | date picker | >= today (create only) | No |
| `targetCloseDate` | Data Alvo de Fechamento | date picker | > startDate | No |

- **Auto-calculated field**: Post-Money Valuation = Pre-Money + Target Amount (displayed as read-only)
- **Layout**: Single column, grouped in sections: "Informações da Rodada", "Termos Financeiros", "Datas"
- **Submit button**: "Criar Rodada" (create) / "Salvar Alterações" (edit)

#### Add Commitment Form (inside modal)

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `shareholderId` | Investidor | searchable select (shareholders with INVESTOR type) | must exist | Yes |
| `committedAmount` | Valor do Compromisso | currency input (BRL) | > 0, <= remaining capacity | Yes |
| `hasSideLetter` | Possui Side Letter | checkbox | — | No |

- Shows remaining round capacity below the amount field
- Submit button: "Adicionar Compromisso"

### FE-6: Visualizations

#### Pro-Forma Dilution Chart

- **Type**: Horizontal grouped bar chart (Recharts `BarChart` with `layout="vertical"`)
- **X-axis**: Ownership percentage (0–100%)
- **Y-axis**: Shareholder names (top N shareholders + "Others")
- **Bars**: Two bars per shareholder — "Before" (`navy-900`) and "After" (`ocean-600`)
- **Labels**: Percentage on each bar
- **Legend**: Bottom, "Antes da Rodada" / "Depois da Rodada"
- **Container**: White card with `radius-lg`, title "Impacto de Diluição"

#### Round Progress Gauge

- **Type**: Linear progress bar with markers
- **Track**: `gray-200` background, `ocean-600` fill
- **Markers**: Vertical tick marks at min close (dashed `cream-700`), target (`ocean-600`), hard cap (`navy-900`) positions
- **Labels**: Amount and percentage at current position, marker labels below
- **Overflow**: If raised > target, bar extends to hard cap zone with different fill color (`celadon-600`)

### FE-7: Modals & Dialogs

| Modal | Size | Type | Steps | Key Elements |
|-------|------|------|-------|--------------|
| AddCommitmentModal | Medium (560px) | Form | 1 | Investor select, amount, side letter checkbox |
| ConfirmPaymentModal | Small (400px) | Confirmation | 1 | Payment details display, confirm button |
| CloseRoundModal | Large (720px) | Wizard | 3 | Step 1: Review (summary + commitment list), Step 2: Confirm (dilution preview + warnings), Step 3: Execute (progress indicator + blockchain status) |
| CancelRoundModal | Small (400px) | Destructive | 1 | Warning text, cancel reason textarea, red "Cancelar Rodada" button |

**CloseRoundModal wizard steps**:
1. **Revisar**: Summary cards (total raised, investors, shares to issue), commitment list table, minimum close validation (blocks if not met)
2. **Confirmar**: Pro-forma dilution chart, before/after ownership table, checkbox "Eu entendo que esta ação é irreversível"
3. **Executar**: Progress indicator showing: Creating transactions → Issuing shares → Recording on blockchain → Updating cap table → Done. Each step shows spinner → checkmark.

### FE-8: Status Badges

#### Round Status

| Status | Background | Text Color | Label (PT-BR) | Label (EN) |
|--------|-----------|------------|----------------|------------|
| `DRAFT` | `gray-100` | `gray-600` | Rascunho | Draft |
| `OPEN` | `blue-50` | `blue-600` | Aberta | Open |
| `FIRST_CLOSE` | `cream-100` | `cream-700` | Primeiro Fechamento | First Close |
| `CLOSED` | `green-100` | `green-700` | Fechada | Closed |
| `CANCELLED` | `#FEE2E2` | `#991B1B` | Cancelada | Cancelled |

#### Payment Status

| Status | Background | Text Color | Label (PT-BR) | Label (EN) |
|--------|-----------|------------|----------------|------------|
| `PENDING` | `cream-100` | `cream-700` | Pendente | Pending |
| `RECEIVED` | `blue-50` | `blue-600` | Recebido | Received |
| `CONFIRMED` | `green-100` | `green-700` | Confirmado | Confirmed |

### FE-9: Role-Based UI

| Action | ADMIN | FINANCE | LEGAL | INVESTOR |
|--------|-------|---------|-------|----------|
| View rounds list | All rounds | All rounds | All rounds | Rounds with own commitments |
| View round detail | Full detail | Full detail | Full detail | Own commitment only |
| Create round | Yes | No | No | No |
| Edit round | Yes (DRAFT/OPEN) | No | No | No |
| Add commitment | Yes | No | No | No |
| Confirm payment | Yes | Yes | No | No |
| Close round | Yes | Yes | No | No |
| Cancel round | Yes | No | No | No |
| Export data | CSV, PDF, XLSX | CSV, PDF, XLSX | CSV, PDF, XLSX | PDF only |

- **UI behavior for restricted actions**: Buttons/menu items are hidden (not disabled) for roles without permission.
- **INVESTOR view**: Filtered round list showing only rounds where they have commitments. Detail page shows only their own commitment info, not other investors.

### FE-10: API Integration (TanStack Query)

```typescript
// Query key factory
const roundKeys = {
  all: (companyId: string) => ['rounds', companyId] as const,
  list: (companyId: string, filters?: RoundFilters) => [...roundKeys.all(companyId), 'list', filters] as const,
  detail: (companyId: string, roundId: string) => [...roundKeys.all(companyId), roundId] as const,
  proForma: (companyId: string, roundId: string) => [...roundKeys.detail(companyId, roundId), 'pro-forma'] as const,
  commitments: (companyId: string, roundId: string, filters?: CommitmentFilters) =>
    [...roundKeys.detail(companyId, roundId), 'commitments', filters] as const,
};

// Hooks
function useRounds(companyId: string, filters?: RoundFilters);
function useRound(companyId: string, roundId: string);
function useRoundProForma(companyId: string, roundId: string);
function useRoundCommitments(companyId: string, roundId: string, filters?: CommitmentFilters);
function useCreateRound(companyId: string);        // POST mutation
function useUpdateRound(companyId: string);        // PUT mutation
function useOpenRound(companyId: string);           // POST mutation (status change)
function useAddCommitment(companyId: string, roundId: string);      // POST mutation
function useConfirmPayment(companyId: string, roundId: string);     // POST mutation
function useCloseRound(companyId: string, roundId: string);         // POST mutation
function useCancelRound(companyId: string, roundId: string);        // POST mutation
function useCancelCommitment(companyId: string, roundId: string);   // POST mutation
```

**Cache invalidation on close round**:
- Invalidate `roundKeys.all` (round list and detail)
- Invalidate `['cap-table', companyId]` (cap table updated)
- Invalidate `['transactions', companyId]` (new transactions created)
- Invalidate `['shareholders', companyId]` (new shareholders may be created)

### FE-11: i18n Keys

Namespace: `fundingRounds`

```
fundingRounds.title = "Rodadas de Investimento" / "Funding Rounds"
fundingRounds.subtitle = "Gerencie rodadas de investimento e compromissos" / "Manage funding rounds and commitments"
fundingRounds.newRound = "Nova Rodada" / "New Round"
fundingRounds.editRound = "Editar Rodada" / "Edit Round"

fundingRounds.form.name = "Nome da Rodada" / "Round Name"
fundingRounds.form.roundType = "Tipo de Rodada" / "Round Type"
fundingRounds.form.shareClass = "Classe de Ações" / "Share Class"
fundingRounds.form.targetAmount = "Valor Alvo" / "Target Amount"
fundingRounds.form.minimumClose = "Valor Mínimo para Fechamento" / "Minimum Close Amount"
fundingRounds.form.preMoneyValuation = "Valuation Pré-Money" / "Pre-Money Valuation"
fundingRounds.form.postMoneyValuation = "Valuation Pós-Money" / "Post-Money Valuation"
fundingRounds.form.pricePerShare = "Preço por Ação" / "Price per Share"
fundingRounds.form.startDate = "Data de Início" / "Start Date"
fundingRounds.form.targetCloseDate = "Data Alvo de Fechamento" / "Target Close Date"
fundingRounds.form.create = "Criar Rodada" / "Create Round"
fundingRounds.form.save = "Salvar Alterações" / "Save Changes"

fundingRounds.stats.openRounds = "Rodadas Abertas" / "Open Rounds"
fundingRounds.stats.totalRaised = "Total Captado" / "Total Raised"
fundingRounds.stats.totalCommitted = "Total Comprometido" / "Total Committed"
fundingRounds.stats.avgInvestment = "Investimento Médio" / "Avg Investment"

fundingRounds.table.name = "Nome" / "Name"
fundingRounds.table.type = "Tipo" / "Type"
fundingRounds.table.target = "Valor Alvo" / "Target"
fundingRounds.table.raised = "Captado" / "Raised"
fundingRounds.table.percentRaised = "% Captado" / "% Raised"
fundingRounds.table.status = "Status" / "Status"
fundingRounds.table.targetClose = "Fechamento Alvo" / "Target Close"
fundingRounds.table.created = "Criado em" / "Created"
fundingRounds.table.empty = "Nenhuma rodada de investimento" / "No funding rounds"
fundingRounds.table.emptyCta = "Crie sua primeira rodada" / "Create your first round"

fundingRounds.status.draft = "Rascunho" / "Draft"
fundingRounds.status.open = "Aberta" / "Open"
fundingRounds.status.firstClose = "Primeiro Fechamento" / "First Close"
fundingRounds.status.closed = "Fechada" / "Closed"
fundingRounds.status.cancelled = "Cancelada" / "Cancelled"

fundingRounds.commitments.title = "Compromissos" / "Commitments"
fundingRounds.commitments.add = "Adicionar Compromisso" / "Add Commitment"
fundingRounds.commitments.investor = "Investidor" / "Investor"
fundingRounds.commitments.amount = "Valor" / "Amount"
fundingRounds.commitments.shares = "Ações" / "Shares"
fundingRounds.commitments.paymentStatus = "Status do Pagamento" / "Payment Status"
fundingRounds.commitments.sideLetter = "Side Letter" / "Side Letter"
fundingRounds.commitments.date = "Data" / "Date"
fundingRounds.commitments.empty = "Nenhum compromisso registrado" / "No commitments recorded"
fundingRounds.commitments.remaining = "Capacidade restante" / "Remaining capacity"

fundingRounds.proForma.title = "Cap Table Pro-Forma" / "Pro-Forma Cap Table"
fundingRounds.proForma.before = "Antes da Rodada" / "Before Round"
fundingRounds.proForma.after = "Depois da Rodada" / "After Round"
fundingRounds.proForma.dilutionImpact = "Impacto de Diluição" / "Dilution Impact"

fundingRounds.close.title = "Fechar Rodada" / "Close Round"
fundingRounds.close.step1 = "Revisar" / "Review"
fundingRounds.close.step2 = "Confirmar" / "Confirm"
fundingRounds.close.step3 = "Executar" / "Execute"
fundingRounds.close.irreversibleWarning = "Eu entendo que esta ação é irreversível" / "I understand this action is irreversible"
fundingRounds.close.minimumNotMet = "O valor mínimo de fechamento não foi atingido" / "Minimum close amount has not been met"
fundingRounds.close.executing = "Fechando rodada..." / "Closing round..."
fundingRounds.close.creatingTransactions = "Criando transações..." / "Creating transactions..."
fundingRounds.close.issuingShares = "Emitindo ações..." / "Issuing shares..."
fundingRounds.close.recordingBlockchain = "Registrando na blockchain..." / "Recording on blockchain..."
fundingRounds.close.updatingCapTable = "Atualizando cap table..." / "Updating cap table..."
fundingRounds.close.success = "Rodada fechada com sucesso" / "Round closed successfully"

fundingRounds.cancel.title = "Cancelar Rodada" / "Cancel Round"
fundingRounds.cancel.warning = "Esta ação cancelará a rodada e todos os compromissos pendentes" / "This will cancel the round and all pending commitments"
fundingRounds.cancel.confirm = "Cancelar Rodada" / "Cancel Round"

fundingRounds.payment.pending = "Pendente" / "Pending"
fundingRounds.payment.received = "Recebido" / "Received"
fundingRounds.payment.confirmed = "Confirmado" / "Confirmed"
```

### FE-12: Error Handling UI

| Error Code | HTTP Status | UI Behavior |
|------------|-------------|-------------|
| `ROUND_NOT_FOUND` | 404 | Redirect to rounds list with toast "Rodada não encontrada" |
| `ROUND_NOT_OPEN` | 422 | Toast warning "Rodada não está aberta para compromissos" |
| `ROUND_HARD_CAP_REACHED` | 422 | Toast warning with remaining capacity from `details.remainingCapacity` |
| `ROUND_COMMITMENT_NOT_FOUND` | 404 | Toast error "Compromisso não encontrado" |
| `ROUND_ALREADY_CLOSED` | 422 | Toast info "Esta rodada já foi fechada" + refresh page |
| `ROUND_MINIMUM_NOT_MET` | 422 | Block Close Round wizard Step 1 with inline warning showing current vs minimum |
| `ROUND_NOT_DRAFT` | 422 | Toast warning "Rodada não pode ser editada neste status" |
| `VAL_INVALID_INPUT` | 400 | Map `validationErrors` to form field errors via `applyServerErrors()` |
| `COMPANY_NOT_FOUND` | 404 | Redirect to company selector |
| `SYS_RATE_LIMITED` | 429 | Toast warning with retry countdown from `details.retryAfter` |

**Optimistic updates**: Commitment addition uses optimistic UI — the commitment appears in the table immediately and rolls back on error.

**Loading states**:
- Round list: skeleton table rows (5 rows)
- Round detail: skeleton stat cards + skeleton progress bar + skeleton table
- Close round wizard Step 3: real-time progress indicator (no skeleton)

---

## Success Criteria

- Accurate pro-forma modeling (100% accuracy)
- Dilution calculations match actual post-close
- Round closing completes in < 2 minutes for 20 investors
