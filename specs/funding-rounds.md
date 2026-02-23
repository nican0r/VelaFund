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

## Success Criteria

- Accurate pro-forma modeling (100% accuracy)
- Dilution calculations match actual post-close
- Round closing completes in < 2 minutes for 20 investors
