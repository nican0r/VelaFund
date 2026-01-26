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

### POST /api/v1/companies/:companyId/rounds
Create funding round

### GET /api/v1/companies/:companyId/rounds/:roundId/proforma
Get pro-forma cap table

**Response**:
```json
{
  "before_round": {
    "total_shares": 1000000,
    "shareholders": [
      {"name": "Founder", "shares": 700000, "percentage": 70.0}
    ]
  },
  "after_round": {
    "total_shares": 1200000,
    "shareholders": [
      {"name": "Founder", "shares": 700000, "percentage": 58.33},
      {"name": "Investor A", "shares": 150000, "percentage": 12.5}
    ]
  },
  "dilution": {
    "Founder": {"before": 70.0, "after": 58.33, "change": -11.67}
  }
}
```

### POST /api/v1/companies/:companyId/rounds/:roundId/close
Close the funding round (issue shares to all investors)

---

## Business Rules

### BR-1: Price Per Share Calculation
- Price = Pre-money Valuation / Existing Shares
- OR Price = Target Amount / New Shares to Issue

### BR-2: Minimum Close Amount
- Round can only close if committed amount ≥ minimum_close_amount

### BR-3: Closing Validation
- All investors must have payment_status = "CONFIRMED"
- Cannot close round twice

### BR-4: Pro-Forma Accuracy
- Pro-forma MUST match actual cap table after close
- Dilution calculations MUST be precise

---

## Success Criteria

- Accurate pro-forma modeling (100% accuracy)
- Dilution calculations match actual post-close
- Round closing completes in < 2 minutes for 20 investors
