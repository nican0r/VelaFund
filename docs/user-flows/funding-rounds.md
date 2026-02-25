# Funding Rounds — User Flows

**Feature**: Manage equity funding rounds with investor commitments, payment tracking, and automated share issuance on close
**Actors**: ADMIN (full lifecycle), FINANCE (read + payment updates), LEGAL (read-only)
**Preconditions**: Company must be ACTIVE. Share class must exist. Shareholders must be ACTIVE.
**Related Flows**: [Cap Table Management](./cap-table-management.md), [Transactions](./transactions.md), [Shareholder Management](./shareholder-management.md)

---

## Flow Map

```
ADMIN creates Funding Round (DRAFT)
  │
  ├─ [valid data] ─→ Round created (DRAFT)
  │     │
  │     ├─ ADMIN opens round ─→ Round → OPEN
  │     │     │
  │     │     ├─ ADMIN adds commitments
  │     │     │     │
  │     │     │     ├─ [shareholder ACTIVE, no duplicate, under cap] ─→ Commitment created (PENDING)
  │     │     │     │     │
  │     │     │     │     ├─ ADMIN/FINANCE updates payment → RECEIVED
  │     │     │     │     │     └─ ADMIN/FINANCE confirms payment → CONFIRMED
  │     │     │     │     │
  │     │     │     │     └─ ADMIN cancels commitment → CANCELLED
  │     │     │     │
  │     │     │     ├─ [hard cap exceeded] ─→ 422 ROUND_HARD_CAP_REACHED
  │     │     │     ├─ [duplicate commitment] ─→ 409 ROUND_COMMITMENT_EXISTS
  │     │     │     └─ [shareholder not found/inactive] ─→ 404
  │     │     │
  │     │     ├─ ADMIN/FINANCE views pro-forma ─→ Before/after dilution table
  │     │     │
  │     │     ├─ ADMIN closes round
  │     │     │     │
  │     │     │     ├─ [all CONFIRMED, minimum met, authorized OK] ─→ Round → CLOSED
  │     │     │     │     └─ Shares issued atomically (Transactions + Shareholdings)
  │     │     │     │
  │     │     │     ├─ [unconfirmed payments] ─→ 422 ROUND_UNCONFIRMED_PAYMENTS
  │     │     │     ├─ [minimum not met] ─→ 422 ROUND_MINIMUM_NOT_MET
  │     │     │     └─ [exceeds authorized] ─→ 422 ROUND_EXCEEDS_AUTHORIZED
  │     │     │
  │     │     └─ ADMIN cancels round ─→ Round → CANCELLED, all commitments → CANCELLED
  │     │
  │     ├─ ADMIN updates round (DRAFT only) ─→ Updated fields
  │     └─ ADMIN cancels round (DRAFT) ─→ Round → CANCELLED
  │
  ├─ [company not ACTIVE] ─→ 422 ROUND_COMPANY_NOT_ACTIVE
  ├─ [share class not found] ─→ 404
  └─ [invalid amounts] ─→ 422 ROUND_INVALID_AMOUNT
```

---

## Flows

### Happy Path: Create a Funding Round (Frontend Form)

PRECONDITION: Company is ACTIVE. At least one share class exists.
ACTOR: ADMIN
TRIGGER: ADMIN clicks "+ New Round" on the Funding Rounds list page

1. [UI] User navigates to `/dashboard/funding-rounds/new`
2. [UI] Page displays 2-step wizard: **Step 1: Details** → **Step 2: Review**
3. [UI] Step 1 shows:
   - 7 round type selection cards (Pre-Seed, Seed, Series A/B/C, Bridge, Other) — SEED selected by default
   - Round name text field
   - Share class dropdown (populated from useShareClasses hook)
   - Financial terms: target amount, minimum close amount (optional), hard cap (optional), pre-money valuation, price per share
   - Auto-calculated post-money valuation (pre-money + target) displayed as read-only
   - Target close date (optional)
   - Notes textarea (optional)
4. [UI] User selects round type by clicking a type card
5. [UI] User fills in required fields (name, share class, target, pre-money, price per share)
6. [UI] User clicks "Next"
7. [Frontend] Validates form client-side:
   → IF name empty: show "Name is required" error
   → IF share class not selected: show "Share class is required" error
   → IF target/pre-money/price empty: show "Required" error
   → IF any amount ≤ 0: show "Must be positive" error
   → IF minimumCloseAmount > targetAmount: show "Must be ≤ target" error
   → IF hardCap < targetAmount: show "Must be ≥ target" error
   → IF any errors: highlight fields, STOP on Step 1
8. [UI] Step 2 (Review) displays all entered values in read-only summary format with type name, formatted amounts, and optional fields (only shown if filled)
9. [UI] User reviews data and clicks "Confirm"
   → User can click "Back" to return to Step 1 for edits
10. [Frontend] Sends POST /api/v1/companies/:companyId/funding-rounds via useCreateFundingRound mutation
11. [Backend] Validates authentication and authorization (role: ADMIN)
    → IF unauthenticated: return 401
    → IF unauthorized: return 404
12. [Backend] Validates company exists and is ACTIVE
    → IF not found: return 404
    → IF not ACTIVE: return 422 ROUND_COMPANY_NOT_ACTIVE
13. [Backend] Validates share class belongs to company
    → IF not found: return 404
14. [Backend] Validates amounts (all positive, minimumCloseAmount ≤ targetAmount, hardCap ≥ targetAmount)
    → IF invalid: return 422 ROUND_INVALID_AMOUNT / ROUND_MINIMUM_EXCEEDS_TARGET / ROUND_HARD_CAP_BELOW_TARGET
15. [Backend] Creates FundingRound in DRAFT status
16. [Backend] Returns 201 with round data
17. [UI] Shows success toast: "Funding round created successfully"
18. [UI] Navigates back to `/dashboard/funding-rounds`

POSTCONDITION: FundingRound exists in DRAFT status
SIDE EFFECTS: Audit log ROUND_CREATED queued via Bull

### Happy Path: Open Round and Add Commitments

PRECONDITION: FundingRound in DRAFT status
ACTOR: ADMIN
TRIGGER: ADMIN clicks "Open Round" button

1. [Frontend] Sends POST /api/v1/companies/:companyId/funding-rounds/:roundId/open
2. [Backend] Validates round exists and is DRAFT
   → IF not DRAFT: return 422 ROUND_INVALID_STATUS_TRANSITION
3. [Backend] Updates status to OPEN, sets openedAt timestamp
4. [Backend] Returns 200 with updated round
5. [UI] Shows success toast, round status badge updates to OPEN

--- Adding a commitment: ---

6. [UI] ADMIN clicks "Add Commitment", selects shareholder, enters amount
7. [Frontend] Sends POST /api/v1/companies/:companyId/funding-rounds/:roundId/commitments
8. [Backend] Validates round is OPEN
   → IF not OPEN: return 422 ROUND_NOT_OPEN
9. [Backend] Validates shareholder exists in company and is ACTIVE
   → IF not found: return 404
10. [Backend] Checks for existing non-cancelled commitment for this shareholder
    → IF exists: return 409 ROUND_COMMITMENT_EXISTS
11. [Backend] Checks committed amount against hard cap (or target amount)
    → IF would exceed: return 422 ROUND_HARD_CAP_REACHED
12. [Backend] Calculates sharesAllocated = committedAmount / pricePerShare
13. [Backend] Creates RoundCommitment with paymentStatus = PENDING
14. [Backend] Returns 201 with commitment data
15. [UI] Shows commitment in commitments list

POSTCONDITION: Round is OPEN. Commitment(s) created with PENDING payment status.
SIDE EFFECTS: None

### Happy Path: Payment Confirmation and Round Close

PRECONDITION: Round is OPEN with one or more commitments
ACTOR: ADMIN or FINANCE (for payment updates), ADMIN only (for close)
TRIGGER: Investor payments are received

1. [UI] ADMIN/FINANCE clicks "Mark Received" on a commitment
2. [Frontend] Sends PUT .../commitments/:commitmentId/payment with { paymentStatus: "RECEIVED" }
3. [Backend] Validates transition PENDING → RECEIVED
4. [Backend] Updates commitment, returns 200

5. [UI] ADMIN/FINANCE clicks "Confirm Payment" after bank verification
6. [Frontend] Sends PUT .../commitments/:commitmentId/payment with { paymentStatus: "CONFIRMED" }
7. [Backend] Validates transition RECEIVED → CONFIRMED (or PENDING → CONFIRMED for direct)
8. [Backend] Sets paymentConfirmedAt timestamp
9. [Backend] Returns 200

--- All payments confirmed, ADMIN initiates close: ---

10. [UI] ADMIN clicks "Close Round"
11. [Frontend] Sends POST /api/v1/companies/:companyId/funding-rounds/:roundId/close
12. [Backend] Validates round is OPEN or CLOSING
    → IF DRAFT/CLOSED/CANCELLED: return 422 ROUND_ALREADY_CLOSED
13. [Backend] Checks all non-cancelled commitments have paymentStatus = CONFIRMED
    → IF any unconfirmed: return 422 ROUND_UNCONFIRMED_PAYMENTS
14. [Backend] Checks total committed ≥ minimumCloseAmount (if set)
    → IF below minimum: return 422 ROUND_MINIMUM_NOT_MET
15. [Backend] Checks authorized shares capacity (totalIssued + newShares ≤ totalAuthorized)
    → IF exceeds: return 422 ROUND_EXCEEDS_AUTHORIZED
16. [Backend] Executes atomic $transaction:
    - For each confirmed commitment: creates Transaction(ISSUANCE, CONFIRMED), upserts Shareholding
    - Updates ShareClass.totalIssued
    - Creates RoundClose record
    - Updates round status to CLOSED, sets closedAt
17. [Backend] Returns 200 with { totalRaised, totalSharesIssued, investorCount }
18. [UI] Shows success toast with summary, round status updates to CLOSED

POSTCONDITION: Round is CLOSED. ISSUANCE transactions created. Shareholdings updated. ShareClass totalIssued incremented.
SIDE EFFECTS: Cap table updated with new shareholdings.

### Alternative Path: Cancel a Round

PRECONDITION: FundingRound in DRAFT or OPEN status
ACTOR: ADMIN
TRIGGER: ADMIN clicks "Cancel Round"

1. [Frontend] Sends POST /api/v1/companies/:companyId/funding-rounds/:roundId/cancel
2. [Backend] Validates round is DRAFT or OPEN
   → IF CLOSED: return 422 ROUND_ALREADY_CLOSED
3. [Backend] Atomically: cancels all non-cancelled commitments (set paymentStatus = CANCELLED), updates round status to CANCELLED
4. [Backend] Returns 200 with cancelled round data
5. [UI] Shows confirmation, status badge updates to CANCELLED

POSTCONDITION: Round and all commitments are CANCELLED
SIDE EFFECTS: None

### Alternative Path: View Pro-Forma Cap Table

PRECONDITION: FundingRound exists with commitments
ACTOR: ADMIN or FINANCE
TRIGGER: User clicks "Pro-Forma" tab on round detail

1. [Frontend] Sends GET /api/v1/companies/:companyId/funding-rounds/:roundId/proforma
2. [Backend] Fetches current shareholdings and round commitments
3. [Backend] Calculates before-round ownership percentages
4. [Backend] Simulates new shares from commitments (amount / pricePerShare)
5. [Backend] Calculates after-round ownership percentages
6. [Backend] Computes dilution per existing shareholder
7. [Backend] Returns { beforeRound, afterRound, dilution }
8. [UI] Displays before/after comparison table with dilution column

POSTCONDITION: No state changes (read-only)
SIDE EFFECTS: None

### Error Path: Cancel a Commitment

PRECONDITION: Commitment exists and is not CANCELLED
ACTOR: ADMIN
TRIGGER: ADMIN clicks "Cancel" on a commitment row

1. [Frontend] Sends DELETE .../commitments/:commitmentId
2. [Backend] Validates round is not CLOSED
   → IF CLOSED: return 422 ROUND_ALREADY_CLOSED
3. [Backend] Validates commitment is not already CANCELLED
   → IF cancelled: return 422 ROUND_COMMITMENT_CANCELLED
4. [Backend] Updates commitment paymentStatus to CANCELLED
5. [Backend] Returns 200

POSTCONDITION: Commitment is CANCELLED, no longer counts toward round totals

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 5 | Company status | Not ACTIVE | Error | 422 ROUND_COMPANY_NOT_ACTIVE |
| 6 | Share class | Not in company | Error | 404 |
| 7 | Amount validation | Zero/negative, min > target, hardCap < target | Error | 422 with specific code |
| 8 | Round open | Not DRAFT | Error | 422 ROUND_INVALID_STATUS_TRANSITION |
| 9 | Commitment - round status | Not OPEN | Error | 422 ROUND_NOT_OPEN |
| 10 | Commitment - duplicate | Already exists for shareholder | Error | 409 ROUND_COMMITMENT_EXISTS |
| 11 | Commitment - hard cap | Would exceed cap | Error | 422 ROUND_HARD_CAP_REACHED |
| 12 | Close - status | Not OPEN/CLOSING | Error | 422 ROUND_ALREADY_CLOSED |
| 13 | Close - payments | Unconfirmed payments exist | Error | 422 ROUND_UNCONFIRMED_PAYMENTS |
| 14 | Close - minimum | Below minimumCloseAmount | Error | 422 ROUND_MINIMUM_NOT_MET |
| 15 | Close - authorized | Exceeds authorized shares | Error | 422 ROUND_EXCEEDS_AUTHORIZED |

---

## State Transitions

### FundingRound.status

| Before | After | Trigger | Actor |
|--------|-------|---------|-------|
| — | DRAFT | Round created | ADMIN |
| DRAFT | OPEN | POST .../open | ADMIN |
| DRAFT | CANCELLED | POST .../cancel | ADMIN |
| OPEN | CLOSING | (multi-close, future) | ADMIN |
| OPEN | CLOSED | POST .../close | ADMIN |
| OPEN | CANCELLED | POST .../cancel | ADMIN |
| CLOSING | CLOSED | POST .../close | ADMIN |

### RoundCommitment.paymentStatus

| Before | After | Trigger | Actor |
|--------|-------|---------|-------|
| — | PENDING | Commitment created | ADMIN |
| PENDING | RECEIVED | PUT .../payment | ADMIN/FINANCE |
| PENDING | CONFIRMED | PUT .../payment (direct) | ADMIN/FINANCE |
| RECEIVED | CONFIRMED | PUT .../payment | ADMIN/FINANCE |
| PENDING/RECEIVED | CANCELLED | DELETE commitment or round cancel | ADMIN |

---

## By Role

| Capability | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|-----------|-------|---------|-------|----------|----------|
| Create round | Yes | No | No | No | No |
| List rounds | Yes | Yes | Yes | No | No |
| View round detail | Yes | Yes | Yes | No | No |
| Update round | Yes | No | No | No | No |
| Open/Close/Cancel round | Yes | No | No | No | No |
| Add commitment | Yes | No | No | No | No |
| List commitments | Yes | Yes | Yes | No | No |
| Update payment status | Yes | Yes | No | No | No |
| Cancel commitment | Yes | No | No | No | No |
| View pro-forma | Yes | Yes | No | No | No |
