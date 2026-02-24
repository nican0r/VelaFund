# Convertible Instruments — User Flows

**Feature**: Manage convertible instruments (Mútuo Conversível, Investimento-Anjo, MISTO, MAIS) with interest accrual, conversion scenario modeling, and equity conversion execution
**Actors**: ADMIN (full CRUD + conversion), FINANCE (read + scenarios), LEGAL (read-only)
**Preconditions**: Company must be ACTIVE. Shareholder (investor) must exist. Share classes must exist for conversion.
**Related Flows**: [Cap Table Management](./cap-table-management.md), [Transactions](./transactions.md), [Shareholder Management](./shareholder-management.md), [Funding Rounds](./funding-rounds.md)

---

## Flow Map

```
ADMIN creates Convertible Instrument (OUTSTANDING)
  │
  ├─ [valid data] ─→ Instrument created (OUTSTANDING)
  │     │
  │     ├─ ANY reads interest breakdown ─→ Principal + accrued interest details
  │     │
  │     ├─ ADMIN/FINANCE models conversion scenarios ─→ Discount/cap/round-price comparisons
  │     │     └─ [zero pre-money shares] ─→ 422 CONV_ZERO_PREMONEY_SHARES
  │     │
  │     ├─ ADMIN updates instrument (OUTSTANDING/MATURED only)
  │     │     │
  │     │     ├─ [extends maturity past current MATURED] ─→ Status → OUTSTANDING
  │     │     └─ [terminal status] ─→ 422 CONV_CANNOT_UPDATE
  │     │
  │     ├─ ADMIN converts to equity
  │     │     │
  │     │     ├─ [valid: OUTSTANDING/MATURED, share class OK, authorized OK]
  │     │     │     └─ Atomic: ISSUANCE Transaction + Shareholding upsert + ShareClass.totalIssued increment
  │     │     │           └─ Instrument → CONVERTED with conversionData
  │     │     │
  │     │     ├─ [already CONVERTED/REDEEMED/CANCELLED] ─→ 409 CONV_ALREADY_CONVERTED
  │     │     ├─ [share class not found] ─→ 404
  │     │     ├─ [exceeds authorized shares] ─→ 422 CONV_EXCEEDS_AUTHORIZED
  │     │     ├─ [invalid valuation] ─→ 422 CONV_INVALID_VALUATION
  │     │     └─ [zero pre-money shares] ─→ 422 CONV_ZERO_PREMONEY_SHARES
  │     │
  │     ├─ ADMIN redeems (investor buyback)
  │     │     │
  │     │     ├─ [OUTSTANDING/MATURED] ─→ Instrument → REDEEMED with redemption data
  │     │     └─ [terminal status] ─→ 422 CONV_INVALID_STATUS_TRANSITION
  │     │
  │     └─ ADMIN cancels (mutual agreement)
  │           │
  │           ├─ [OUTSTANDING/MATURED] ─→ Instrument → CANCELLED with reason
  │           └─ [terminal status] ─→ 422 CONV_INVALID_STATUS_TRANSITION
  │
  ├─ [company not ACTIVE] ─→ 422 CONV_COMPANY_NOT_ACTIVE
  ├─ [shareholder not found] ─→ 404
  ├─ [maturity ≤ issue date] ─→ 422 CONV_MATURITY_BEFORE_ISSUE
  ├─ [principal ≤ 0] ─→ 422 CONV_INVALID_PRINCIPAL
  └─ [interest rate > 30%] ─→ 422 CONV_HIGH_INTEREST_RATE
```

---

## Flows

### Happy Path: Create a Convertible Instrument

PRECONDITION: Company is ACTIVE. Shareholder (investor) exists.
ACTOR: ADMIN
TRIGGER: ADMIN navigates to Convertibles and clicks "Create Instrument"

1. [UI] ADMIN fills in: shareholder (investor), instrument type (Mútuo Conversível/Investimento-Anjo/MISTO/MAIS), principal amount, interest rate, interest type (simple/compound), discount rate, valuation cap, qualified financing threshold, conversion trigger, issue date, maturity date, optional target share class, auto-convert flag, MFN clause flag, notes
2. [Frontend] Validates input client-side
   → IF invalid: show field-level errors, STOP
3. [Frontend] Sends POST /api/v1/companies/:companyId/convertibles
4. [Backend] Validates authentication and authorization (role: ADMIN)
   → IF unauthenticated: return 401
   → IF unauthorized: return 404
5. [Backend] Validates company exists and is ACTIVE
   → IF not found: return 404
   → IF not ACTIVE: return 422 CONV_COMPANY_NOT_ACTIVE
6. [Backend] Validates shareholder belongs to company
   → IF not found: return 404
7. [Backend] Validates maturity date > issue date
   → IF invalid: return 422 CONV_MATURITY_BEFORE_ISSUE
8. [Backend] Validates principal > 0
   → IF zero or negative: return 422 CONV_INVALID_PRINCIPAL
9. [Backend] Validates interest rate ≤ 30% (0.30)
   → IF too high: return 422 CONV_HIGH_INTEREST_RATE
10. [Backend] Optionally validates target share class belongs to company
    → IF not found: return 404
11. [Backend] Creates ConvertibleInstrument in OUTSTANDING status
12. [Backend] Returns 201 with instrument data
13. [UI] Shows success toast, navigates to instrument detail

POSTCONDITION: Convertible instrument exists in OUTSTANDING status
SIDE EFFECTS: Audit log event (future: CONVERTIBLE_CREATED)

### Happy Path: View Interest Breakdown

PRECONDITION: Convertible instrument exists
ACTOR: ADMIN, FINANCE, or LEGAL
TRIGGER: User clicks "Interest Details" on an instrument

1. [UI] User navigates to instrument detail and clicks interest breakdown tab/button
2. [Frontend] Sends GET /api/v1/companies/:companyId/convertibles/:convertibleId/interest
3. [Backend] Validates authentication and authorization (role: ADMIN, FINANCE, or LEGAL)
4. [Backend] Finds convertible by ID and companyId
   → IF not found: return 404
5. [Backend] Calculates accrued interest:
   - SIMPLE: P × r × (days / 365)
   - COMPOUND: P × (1 + r/365)^days - P
6. [Backend] Generates monthly breakdown (interest per month, cumulative)
7. [Backend] Returns 200 with breakdown data
8. [UI] Displays principal, rate, type, days elapsed, accrued interest, total value, and monthly table

POSTCONDITION: No state changes

### Happy Path: Model Conversion Scenarios

PRECONDITION: Convertible instrument exists. Company has issued shares (pre-money shares > 0).
ACTOR: ADMIN or FINANCE
TRIGGER: User clicks "Conversion Scenarios" on an instrument

1. [UI] User optionally enters custom valuation amounts (comma-separated) or uses defaults
2. [Frontend] Sends GET /api/v1/companies/:companyId/convertibles/:convertibleId/scenarios?valuations=3000000,5000000,10000000
3. [Backend] Validates authentication and authorization (role: ADMIN or FINANCE)
4. [Backend] Finds convertible by ID and companyId
   → IF not found: return 404
5. [Backend] Calculates pre-money shares from all ShareClass.totalIssued
   → IF zero: return 422 CONV_ZERO_PREMONEY_SHARES
6. [Backend] For each hypothetical valuation, calculates:
   - Discount method: roundPrice × (1 - discountRate) → shares = conversionAmount / discountPrice
   - Cap method: min(capPrice, roundPrice) → shares = conversionAmount / effectiveCapPrice
   - Round price method: shares = conversionAmount / roundPricePerShare
   - MFN selection: picks method giving most shares (lowest effective price)
7. [Backend] Calculates capTriggersAbove = valuationCap / (1 - discountRate)
8. [Backend] Returns 200 with scenarios array and summary
9. [UI] Displays scenario comparison table with method details, effective price, shares, ownership %, dilution

POSTCONDITION: No state changes

### Happy Path: Convert to Equity

PRECONDITION: Convertible is OUTSTANDING or MATURED. Target share class exists with sufficient authorized shares.
ACTOR: ADMIN
TRIGGER: ADMIN clicks "Convert" and provides funding round details

1. [UI] ADMIN fills in: funding round ID, round valuation (pre-money), target share class, optional notes
2. [Frontend] Sends POST /api/v1/companies/:companyId/convertibles/:convertibleId/convert
3. [Backend] Validates authentication and authorization (role: ADMIN)
4. [Backend] Finds convertible by ID and companyId
   → IF not found: return 404
5. [Backend] Validates status is OUTSTANDING or MATURED
   → IF CONVERTED/REDEEMED/CANCELLED: return 409 CONV_ALREADY_CONVERTED
6. [Backend] Validates share class belongs to company
   → IF not found: return 404
7. [Backend] Calculates conversion: discount/cap/round-price methods, MFN selection
   → IF pre-money shares = 0: return 422 CONV_ZERO_PREMONEY_SHARES
8. [Backend] Validates shares to issue ≤ authorized remaining
   → IF exceeds: return 422 CONV_EXCEEDS_AUTHORIZED
9. [Backend] Executes atomic $transaction:
   a. Creates ISSUANCE Transaction (CONFIRMED status)
   b. Upserts Shareholding (increments quantity if exists, creates with ownership 0% if new)
   c. Increments ShareClass.totalIssued
   d. Updates convertible: status → CONVERTED, convertedAt, conversionData JSON
10. [Backend] Returns 200 with updated convertible (includes conversionData with method, shares, price)
11. [UI] Shows success toast with conversion summary, navigates to cap table

POSTCONDITION: Convertible status = CONVERTED. Shareholding updated. ShareClass.totalIssued incremented. ISSUANCE Transaction created.
SIDE EFFECTS: Audit log events (future: CONVERTIBLE_CONVERTED, SHARES_ISSUED)

### Happy Path: Redeem Convertible (Investor Buyback)

PRECONDITION: Convertible is OUTSTANDING or MATURED
ACTOR: ADMIN
TRIGGER: ADMIN clicks "Redeem" on an instrument

1. [UI] ADMIN fills in: redemption amount, optional payment reference, optional notes
2. [Frontend] Sends POST /api/v1/companies/:companyId/convertibles/:convertibleId/redeem
3. [Backend] Validates status transition OUTSTANDING/MATURED → REDEEMED
   → IF terminal status: return 422 CONV_INVALID_STATUS_TRANSITION
4. [Backend] Updates convertible: status → REDEEMED, redeemedAt, conversionData JSON with redemption details
5. [Backend] Returns 200 with updated convertible
6. [UI] Shows success toast

POSTCONDITION: Convertible status = REDEEMED
SIDE EFFECTS: Audit log event (future: CONVERTIBLE_REDEEMED)

### Happy Path: Cancel Convertible

PRECONDITION: Convertible is OUTSTANDING or MATURED
ACTOR: ADMIN
TRIGGER: ADMIN clicks "Cancel" on an instrument

1. [UI] ADMIN fills in: cancellation reason
2. [Frontend] Sends POST /api/v1/companies/:companyId/convertibles/:convertibleId/cancel
3. [Backend] Validates status transition OUTSTANDING/MATURED → CANCELLED
   → IF terminal status: return 422 CONV_INVALID_STATUS_TRANSITION
4. [Backend] Updates convertible: status → CANCELLED, cancelledAt, appends reason to notes
5. [Backend] Returns 200 with updated convertible
6. [UI] Shows success toast

POSTCONDITION: Convertible status = CANCELLED
SIDE EFFECTS: Audit log event (future: CONVERTIBLE_CANCELLED)

### Alternative Path: Update Convertible Terms

PRECONDITION: Convertible is OUTSTANDING or MATURED
ACTOR: ADMIN
TRIGGER: ADMIN clicks "Edit" on an instrument

1. [UI] ADMIN modifies fields: discount rate, valuation cap, maturity date, financing threshold, conversion trigger, target share class, auto-convert, MFN clause, interest type, notes
2. [Frontend] Sends PUT /api/v1/companies/:companyId/convertibles/:convertibleId
3. [Backend] Validates status is OUTSTANDING or MATURED
   → IF terminal status: return 422 CONV_CANNOT_UPDATE
4. [Backend] If maturity date is extended and status was MATURED → resets status to OUTSTANDING
5. [Backend] Updates convertible fields
6. [Backend] Returns 200 with updated convertible
7. [UI] Shows success toast

POSTCONDITION: Convertible updated. Status may change from MATURED → OUTSTANDING if maturity extended.

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 5 | Company status | Not ACTIVE | Error | 422 CONV_COMPANY_NOT_ACTIVE |
| 6 | Shareholder lookup | Not found in company | Error | 404 Not Found |
| 7 | Date validation | maturity ≤ issue | Error | 422 CONV_MATURITY_BEFORE_ISSUE |
| 8 | Principal validation | ≤ 0 | Error | 422 CONV_INVALID_PRINCIPAL |
| 9 | Interest rate | > 0.30 | Error | 422 CONV_HIGH_INTEREST_RATE |
| 5 (convert) | Status check | CONVERTED/REDEEMED/CANCELLED | Error | 409 CONV_ALREADY_CONVERTED |
| 7 (convert) | Pre-money shares | = 0 | Error | 422 CONV_ZERO_PREMONEY_SHARES |
| 8 (convert) | Authorized shares | Insufficient | Error | 422 CONV_EXCEEDS_AUTHORIZED |
| 3 (redeem/cancel) | Status transition | Not in OUTSTANDING/MATURED | Error | 422 CONV_INVALID_STATUS_TRANSITION |
| 3 (update) | Status check | Terminal status | Error | 422 CONV_CANNOT_UPDATE |
| 4 (update) | Maturity extension | MATURED + new maturity > now | Alternative | Status → OUTSTANDING |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| ConvertibleInstrument | status | — | OUTSTANDING | Created |
| ConvertibleInstrument | status | OUTSTANDING | CONVERTED | Convert endpoint |
| ConvertibleInstrument | status | OUTSTANDING | REDEEMED | Redeem endpoint |
| ConvertibleInstrument | status | OUTSTANDING | MATURED | (Future: background job on maturity date) |
| ConvertibleInstrument | status | OUTSTANDING | CANCELLED | Cancel endpoint |
| ConvertibleInstrument | status | MATURED | OUTSTANDING | Update with extended maturity |
| ConvertibleInstrument | status | MATURED | CONVERTED | Convert endpoint |
| ConvertibleInstrument | status | MATURED | REDEEMED | Redeem endpoint |
| Shareholding | quantity | N | N + sharesIssued | Convert endpoint (upsert) |
| ShareClass | totalIssued | N | N + sharesIssued | Convert endpoint |
| Transaction | — | — | ISSUANCE (CONFIRMED) | Convert endpoint |

---

## By Role

| Action | ADMIN | FINANCE | LEGAL |
|--------|-------|---------|-------|
| Create instrument | Yes | No (404) | No (404) |
| List instruments | Yes | Yes | Yes |
| Get instrument detail | Yes | Yes | Yes |
| View interest breakdown | Yes | Yes | Yes |
| Model conversion scenarios | Yes | Yes | No (404) |
| Update instrument | Yes | No (404) | No (404) |
| Redeem instrument | Yes | No (404) | No (404) |
| Cancel instrument | Yes | No (404) | No (404) |
| Convert to equity | Yes | No (404) | No (404) |

---

## Cross-References

**Depends on**: [Authentication](./authentication.md) — user must be logged in
**Depends on**: [Shareholder Management](./shareholder-management.md) — investor must be an existing shareholder
**Feeds into**: [Cap Table Management](./cap-table-management.md) — conversion creates shareholdings and updates share class totals
**Feeds into**: [Transactions](./transactions.md) — conversion creates ISSUANCE transaction
**Related**: [Funding Rounds](./funding-rounds.md) — conversion may reference a funding round that triggered it
