# Option Plans & Grants — User Flows

**Feature**: Employee equity option plan management with grant lifecycle and vesting calculation
**Actors**: ADMIN (full CRUD + close/cancel), FINANCE/LEGAL (read-only)
**Preconditions**: User is authenticated, user is an ACTIVE member of the company, company is ACTIVE, relevant share classes exist
**Related Flows**: [Company Management](./company-management.md) (company must be ACTIVE), [Share Class Management](./share-class-management.md) (share classes referenced by option plans), [Shareholder Management](./shareholder-management.md) (shareholders optionally linked to grants), [Cap Table Management](./cap-table-management.md) (fully-diluted view includes option grants)

---

## Flow Map

```
User navigates to Option Plans page
  │
  ├─ [role = ADMIN/FINANCE/LEGAL] ─→ GET /option-plans?page=1&limit=20
  │     │
  │     ├─ [has plans] ─→ Display paginated list with status filter
  │     │     │
  │     │     ├─ [user clicks a plan row] ─→ GET /option-plans/:planId ─→ Detail view with grant stats
  │     │     │
  │     │     ├─ [ADMIN clicks "New Option Plan"] ─→ Create plan flow (see below)
  │     │     │
  │     │     ├─ [ADMIN clicks "Edit" on ACTIVE plan] ─→ Update plan flow (see below)
  │     │     │
  │     │     └─ [ADMIN clicks "Close Plan" on ACTIVE plan] ─→ Close plan flow (see below)
  │     │
  │     └─ [empty] ─→ Display empty state with "New Option Plan" CTA (ADMIN only)
  │
  ├─ [role = INVESTOR/EMPLOYEE] ─→ 404 Not Found (enumeration prevention)
  │
  └─ [unauthenticated] ─→ 401 Unauthorized ─→ redirect to login


ADMIN clicks "New Option Plan"
  │
  ├─ [valid form: name + shareClassId + totalPoolSize] ─→ POST /option-plans
  │     │
  │     ├─ [company ACTIVE + share class exists + poolSize > 0]
  │     │     ─→ 201 Created (status: ACTIVE)
  │     │
  │     ├─ [company not ACTIVE] ─→ 422 OPT_COMPANY_NOT_ACTIVE
  │     ├─ [share class not found] ─→ 404 SHARECLASS_NOT_FOUND
  │     └─ [poolSize <= 0] ─→ 422 OPT_INVALID_POOL_SIZE
  │
  └─ [invalid form] ─→ Client-side validation prevents submission


ADMIN clicks "Edit" on ACTIVE plan
  │
  ├─ [plan ACTIVE + valid changes] ─→ PUT /option-plans/:planId
  │     │
  │     ├─ [poolSize increase or unchanged] ─→ 200 Updated
  │     │
  │     ├─ [plan CLOSED] ─→ 422 OPT_PLAN_CLOSED
  │     └─ [poolSize < totalGranted] ─→ 422 OPT_POOL_CANNOT_SHRINK
  │
  └─ [invalid form] ─→ Client-side validation prevents submission


ADMIN clicks "Close Plan"
  │
  ├─ [plan ACTIVE] ─→ POST /option-plans/:planId/close
  │     └─ 200 Plan closed (status: CLOSED, closedAt set)
  │
  └─ [plan already CLOSED] ─→ 422 OPT_PLAN_ALREADY_CLOSED


User navigates to Option Grants page
  │
  ├─ [role = ADMIN/FINANCE/LEGAL] ─→ GET /option-grants?page=1&limit=20
  │     │
  │     ├─ [has grants] ─→ Display paginated list with status/plan/shareholder filters
  │     │     │
  │     │     ├─ [user clicks a grant row] ─→ GET /option-grants/:grantId ─→ Detail with vesting
  │     │     │
  │     │     ├─ [user clicks "Vesting Schedule"] ─→ GET /option-grants/:grantId/vesting
  │     │     │     └─ Full schedule with cliff + period entries
  │     │     │
  │     │     ├─ [ADMIN clicks "New Grant"] ─→ Create grant flow (see below)
  │     │     │
  │     │     └─ [ADMIN clicks "Cancel Grant" on ACTIVE grant] ─→ Cancel grant flow (see below)
  │     │
  │     └─ [empty] ─→ Display empty state with "New Grant" CTA (ADMIN only)
  │
  ├─ [role = INVESTOR/EMPLOYEE] ─→ 404 Not Found
  │
  └─ [unauthenticated] ─→ 401 Unauthorized ─→ redirect to login


ADMIN clicks "New Grant"
  │
  ├─ [valid form] ─→ POST /option-grants
  │     │
  │     ├─ [plan ACTIVE + pool available + valid params]
  │     │     ─→ 201 Created (grant + plan.totalGranted updated atomically)
  │     │
  │     ├─ [plan not found] ─→ 404 OPTIONPLAN_NOT_FOUND
  │     ├─ [plan CLOSED] ─→ 422 OPT_PLAN_CLOSED
  │     ├─ [quantity <= 0] ─→ 422 OPT_INVALID_QUANTITY
  │     ├─ [strikePrice <= 0] ─→ 422 OPT_INVALID_STRIKE_PRICE
  │     ├─ [quantity > available pool] ─→ 422 OPT_PLAN_EXHAUSTED
  │     ├─ [shareholder not found] ─→ 404 SHAREHOLDER_NOT_FOUND
  │     ├─ [cliff > vesting duration] ─→ 422 OPT_CLIFF_EXCEEDS_VESTING
  │     └─ [expiration <= grantDate] ─→ 422 OPT_INVALID_EXPIRATION
  │
  └─ [invalid form] ─→ Client-side validation prevents submission


ADMIN clicks "Cancel Grant"
  │
  ├─ [grant ACTIVE] ─→ POST /option-grants/:grantId/cancel
  │     └─ 200 Grant cancelled (unexercised options returned to pool atomically)
  │
  ├─ [grant CANCELLED] ─→ 422 OPT_GRANT_ALREADY_CANCELLED
  │
  └─ [grant EXERCISED] ─→ 422 OPT_GRANT_TERMINATED
```

---

## Flows

### Happy Path: Create Option Plan

```
PRECONDITION: Company is ACTIVE, share class exists, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "New Option Plan"

1. [UI] User navigates to /companies/:companyId/option-plans
2. [UI] User clicks "New Option Plan"
3. [UI] Form opens with fields: name, shareClassId (dropdown), totalPoolSize, boardApprovalDate (optional), terminationPolicy (default: FORFEITURE), exerciseWindowDays (default: 90), notes (optional)
4. [UI] User fills in required fields and clicks "Create"
5. [Frontend] Validates input client-side (name required, poolSize > 0, shareClassId required)
   → IF invalid: show field-level errors, STOP
6. [Frontend] Sends POST /api/v1/companies/:companyId/option-plans
   Body: { name, shareClassId, totalPoolSize, boardApprovalDate?, terminationPolicy?, exerciseWindowDays?, notes? }
7. [Backend] Validates authentication (AuthGuard)
   → IF unauthenticated: return 401, frontend redirects to login
8. [Backend] Validates authorization (RolesGuard: ADMIN)
   → IF not member or wrong role: return 404
9. [Backend] Validates request body (ValidationPipe)
   → IF invalid: return 400 with validationErrors
10. [Backend] Validates company exists and is ACTIVE
    → IF not found: return 404
    → IF not ACTIVE: return 422 OPT_COMPANY_NOT_ACTIVE
11. [Backend] Validates share class belongs to company
    → IF not found: return 404
12. [Backend] Validates totalPoolSize > 0
    → IF invalid: return 422 OPT_INVALID_POOL_SIZE
13. [Backend] Creates OptionPlan record with status = ACTIVE, totalGranted = 0
14. [Backend] Returns 201 with created plan
15. [UI] Shows success toast: "Option plan created"
16. [UI] Navigates to plan detail page

POSTCONDITION: OptionPlan exists with status ACTIVE, totalPoolSize set, totalGranted = 0
SIDE EFFECTS: Audit log (future: OPTION_PLAN_CREATED)
```

### Happy Path: List Option Plans

```
PRECONDITION: User is ACTIVE member with ADMIN, FINANCE, or LEGAL role
ACTOR: Any permitted member
TRIGGER: User navigates to option plans page

1. [UI] User navigates to /companies/:companyId/option-plans
2. [Frontend] Sends GET /api/v1/companies/:companyId/option-plans?page=1&limit=20
3. [Backend] Validates auth and role (ADMIN, FINANCE, LEGAL)
4. [Backend] Returns paginated list with meta (includes share class info)
5. [UI] Displays table with columns: name, share class, pool size, total granted, status, created date
6. [UI] User can filter by status (ACTIVE, CLOSED)
7. [UI] User can sort by name, totalPoolSize, status, createdAt
8. [UI] User can paginate through results

POSTCONDITION: User sees option plans for this company
SIDE EFFECTS: None
```

### Happy Path: View Option Plan Detail

```
PRECONDITION: Option plan exists, user has ADMIN, FINANCE, or LEGAL role
ACTOR: Any permitted member
TRIGGER: User clicks on a plan row

1. [UI] User clicks on a plan row in list
2. [Frontend] Sends GET /api/v1/companies/:companyId/option-plans/:planId
3. [Backend] Returns plan detail with computed stats:
   - Plan fields (name, status, totalPoolSize, terminationPolicy, exerciseWindowDays, boardApprovalDate)
   - Share class info (className, type)
   - totalGranted (sum of non-cancelled grant quantities)
   - totalExercised (sum of exercised amounts)
   - optionsAvailable (totalPoolSize - totalGranted)
   - activeGrantCount (count of non-cancelled grants)
4. [UI] Displays plan detail with:
   - Status badge (ACTIVE green, CLOSED gray)
   - Pool utilization progress bar
   - Summary stats: total pool, granted, exercised, available
   - Grant list for this plan

POSTCONDITION: User sees full plan detail with stats
SIDE EFFECTS: None
```

### Happy Path: Update Option Plan

```
PRECONDITION: Plan exists with status ACTIVE, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Edit" on an ACTIVE plan

1. [UI] User views plan detail page with ACTIVE status
2. [UI] User clicks "Edit"
3. [UI] Form opens pre-filled with current values (name, totalPoolSize, terminationPolicy, exerciseWindowDays, boardApprovalDate, notes)
4. [UI] User modifies fields and clicks "Save"
5. [Frontend] Validates input client-side
   → IF invalid: show field-level errors, STOP
6. [Frontend] Sends PUT /api/v1/companies/:companyId/option-plans/:planId
   Body: { name?, totalPoolSize?, terminationPolicy?, exerciseWindowDays?, boardApprovalDate?, notes? }
7. [Backend] Validates auth (ADMIN), plan exists
8. [Backend] Validates plan status = ACTIVE
   → IF CLOSED: return 422 OPT_PLAN_CLOSED
9. [Backend] If totalPoolSize changed, validates new size > 0
   → IF invalid: return 422 OPT_INVALID_POOL_SIZE
10. [Backend] If totalPoolSize changed, validates new size >= totalGranted
    → IF shrinking below granted: return 422 OPT_POOL_CANNOT_SHRINK
11. [Backend] Updates plan
12. [Backend] Returns 200 with updated plan
13. [UI] Shows success toast: "Option plan updated"

POSTCONDITION: Plan updated with new values, pool size only increased or unchanged
SIDE EFFECTS: Audit log (future: OPTION_PLAN_UPDATED)
```

### Happy Path: Close Option Plan

```
PRECONDITION: Plan exists with status ACTIVE, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Close Plan" on an ACTIVE plan

1. [UI] User views plan detail page with ACTIVE status
2. [UI] User clicks "Close Plan"
3. [UI] Confirmation dialog: "Close this option plan? No new grants will be allowed."
4. [UI] User clicks "Confirm"
5. [Frontend] Sends POST /api/v1/companies/:companyId/option-plans/:planId/close
6. [Backend] Validates auth (ADMIN), plan exists
7. [Backend] Validates plan status = ACTIVE
   → IF already CLOSED: return 422 OPT_PLAN_ALREADY_CLOSED
8. [Backend] Sets status = CLOSED, closedAt = now
9. [Backend] Returns 200 with updated plan
10. [UI] Shows success toast: "Option plan closed"
11. [UI] Plan detail refreshes with CLOSED status badge

POSTCONDITION: Plan status = CLOSED, closedAt set. Existing grants remain active.
SIDE EFFECTS: Audit log (future: OPTION_PLAN_UPDATED)
```

### Happy Path: Create Option Grant

```
PRECONDITION: Plan is ACTIVE with available pool, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "New Grant"

1. [UI] User navigates to /companies/:companyId/option-grants
2. [UI] User clicks "New Grant"
3. [UI] Form opens with fields: optionPlanId (dropdown), shareholderId (optional dropdown), employeeName, employeeEmail, quantity, strikePrice, grantDate, expirationDate, cliffMonths, vestingDurationMonths, vestingFrequency (default: MONTHLY), accelerationOnCoc (default: false), notes (optional)
4. [UI] User fills in fields and clicks "Create Grant"
5. [Frontend] Validates input client-side (required fields, quantity > 0, strikePrice > 0, cliff <= vesting, expiration > grantDate)
   → IF invalid: show field-level errors, STOP
6. [Frontend] Sends POST /api/v1/companies/:companyId/option-grants
   Body: { optionPlanId, shareholderId?, employeeName, employeeEmail, quantity, strikePrice, grantDate, expirationDate, cliffMonths, vestingDurationMonths, vestingFrequency?, accelerationOnCoc?, notes? }
7. [Backend] Validates authentication and authorization (ADMIN)
8. [Backend] Validates request body (ValidationPipe)
   → IF invalid: return 400 with validationErrors
9. [Backend] Validates plan exists, belongs to company, is ACTIVE
   → IF not found: return 404
   → IF CLOSED: return 422 OPT_PLAN_CLOSED
10. [Backend] Validates quantity > 0
    → IF invalid: return 422 OPT_INVALID_QUANTITY
11. [Backend] Validates strikePrice > 0
    → IF invalid: return 422 OPT_INVALID_STRIKE_PRICE
12. [Backend] Calculates pool availability (totalPoolSize - sum of non-cancelled grants)
    → IF quantity > available: return 422 OPT_PLAN_EXHAUSTED with { optionsAvailable, quantityRequested }
13. [Backend] If shareholderId provided, validates shareholder exists in company
    → IF not found: return 404
14. [Backend] Validates cliffMonths <= vestingDurationMonths
    → IF cliff exceeds: return 422 OPT_CLIFF_EXCEEDS_VESTING
15. [Backend] Validates expirationDate > grantDate
    → IF invalid: return 422 OPT_INVALID_EXPIRATION
16. [Backend] Calculates cliffPercentage = (cliffMonths / vestingDurationMonths) * 100
17. [Backend] Begins $transaction:
    a. Creates OptionGrant record with status = ACTIVE, exercised = 0
    b. Updates OptionPlan.totalGranted += quantity
18. [Backend] Returns 201 with created grant
19. [UI] Shows success toast: "Option grant created"
20. [UI] Navigates to grant detail page

POSTCONDITION: OptionGrant exists with status ACTIVE. Plan.totalGranted incremented by grant quantity.
SIDE EFFECTS: Audit log (future: OPTION_GRANTED)
```

### Happy Path: View Grant Detail with Vesting

```
PRECONDITION: Grant exists, user has ADMIN, FINANCE, or LEGAL role
ACTOR: Any permitted member
TRIGGER: User clicks on a grant row

1. [UI] User clicks on a grant row in list
2. [Frontend] Sends GET /api/v1/companies/:companyId/option-grants/:grantId
3. [Backend] Returns grant detail with computed vesting:
   - Grant fields (employeeName, quantity, strikePrice, grantDate, expirationDate, status, vesting params)
   - Plan info (name, terminationPolicy, exerciseWindowDays)
   - Shareholder info (if linked)
   - Vesting calculation: vestedQuantity, unvestedQuantity, exercisableQuantity, vestingPercentage, cliffDate, cliffMet, nextVestingDate, nextVestingAmount
4. [UI] Displays grant detail with:
   - Status badge (ACTIVE green, CANCELLED gray, EXERCISED blue)
   - Vesting progress bar (vestedQuantity / quantity)
   - Summary stats: total options, vested, unvested, exercisable, exercised
   - Cliff status indicator

POSTCONDITION: User sees full grant detail with live vesting calculation
SIDE EFFECTS: None
```

### Happy Path: View Vesting Schedule

```
PRECONDITION: Grant exists, user has ADMIN, FINANCE, or LEGAL role
ACTOR: Any permitted member
TRIGGER: User clicks "Vesting Schedule" on a grant

1. [UI] User views grant detail page
2. [UI] User clicks "Vesting Schedule"
3. [Frontend] Sends GET /api/v1/companies/:companyId/option-grants/:grantId/vesting
4. [Backend] Returns full vesting schedule:
   - Summary: grantId, shareholderName, totalOptions, vestedOptions, unvestedOptions, exercisedOptions, exercisableOptions, vestingPercentage, cliffDate, cliffMet
   - Schedule array: [{ date, quantity, cumulative, type }]
     - type = CLIFF for cliff entry
     - type = MONTHLY/QUARTERLY/ANNUAL for period entries
5. [UI] Displays schedule as a table/timeline:
   - Each vesting event with date, quantity vesting, cumulative total
   - Cliff event highlighted
   - Past events marked as completed, future events shown as upcoming

POSTCONDITION: User sees full vesting schedule with all dates and amounts
SIDE EFFECTS: None
```

### Happy Path: Cancel Option Grant

```
PRECONDITION: Grant exists with status ACTIVE, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Cancel Grant" on an ACTIVE grant

1. [UI] User views grant detail page with ACTIVE status
2. [UI] User clicks "Cancel Grant"
3. [UI] Confirmation dialog: "Cancel this option grant? Unexercised options will be returned to the pool."
4. [UI] User clicks "Confirm"
5. [Frontend] Sends POST /api/v1/companies/:companyId/option-grants/:grantId/cancel
6. [Backend] Validates auth (ADMIN), grant exists
7. [Backend] Validates grant status = ACTIVE
   → IF CANCELLED: return 422 OPT_GRANT_ALREADY_CANCELLED
   → IF EXERCISED: return 422 OPT_GRANT_TERMINATED
8. [Backend] Calculates unexercised = quantity - exercised
9. [Backend] Begins $transaction:
    a. Updates grant: status = CANCELLED, terminatedAt = now
    b. Decrements OptionPlan.totalGranted by unexercised amount
10. [Backend] Returns 200 with cancelled grant
11. [UI] Shows success toast: "Option grant cancelled"
12. [UI] Grant detail refreshes with CANCELLED status badge

POSTCONDITION: Grant status = CANCELLED, terminatedAt set. Plan.totalGranted reduced by unexercised options (returned to pool).
SIDE EFFECTS: Audit log (future: OPTION_FORFEITED)
```

### Error Path: Plan Pool Exhausted

```
ACTOR: ADMIN member
TRIGGER: Attempts to create a grant exceeding available pool

1. [UI] User fills in grant form with quantity larger than available pool
2. [UI] User clicks "Create Grant"
3. [Frontend] Sends POST /api/v1/companies/:companyId/option-grants
4. [Backend] Validates plan, company, quantity, strikePrice
5. [Backend] Calculates pool availability: totalPoolSize - sum(non-cancelled grants)
6. [Backend] Requested quantity > available options
7. [Backend] Returns 422 with error code OPT_PLAN_EXHAUSTED
   Body: { error: { code: "OPT_PLAN_EXHAUSTED", messageKey: "errors.opt.planExhausted", details: { optionsAvailable: "5000", quantityRequested: "10000" } } }
8. [UI] Shows error toast using messageKey

POSTCONDITION: No grant created
SIDE EFFECTS: None
```

### Error Path: Update Closed Plan

```
ACTOR: ADMIN member
TRIGGER: Attempts to update a CLOSED plan

1. [UI] User tries to edit a CLOSED plan (Edit button should be hidden but may be attempted via API)
2. [Frontend] Sends PUT /api/v1/companies/:companyId/option-plans/:planId
3. [Backend] Validates plan exists
4. [Backend] Detects plan status = CLOSED
5. [Backend] Returns 422 with error code OPT_PLAN_CLOSED
6. [UI] Shows error toast: "Option plan is closed"

POSTCONDITION: Plan unchanged
SIDE EFFECTS: None
```

### Error Path: Shrink Pool Below Granted

```
ACTOR: ADMIN member
TRIGGER: Attempts to reduce pool size below total granted amount

1. [UI] User edits plan and reduces totalPoolSize
2. [Frontend] Sends PUT /api/v1/companies/:companyId/option-plans/:planId
3. [Backend] Validates plan is ACTIVE
4. [Backend] Detects new totalPoolSize < current totalGranted
5. [Backend] Returns 422 with error code OPT_POOL_CANNOT_SHRINK
   Body: { error: { code: "OPT_POOL_CANNOT_SHRINK", messageKey: "errors.opt.poolCannotShrink", details: { currentGranted: "30000", requested: "20000" } } }
6. [UI] Shows error toast

POSTCONDITION: Plan unchanged
SIDE EFFECTS: None
```

### Error Path: Cliff Exceeds Vesting Duration

```
ACTOR: ADMIN member
TRIGGER: Attempts to create a grant with cliff period longer than total vesting

1. [UI] User fills in grant form with cliffMonths > vestingDurationMonths
2. [Frontend] Should catch this client-side, but if not:
3. [Frontend] Sends POST /api/v1/companies/:companyId/option-grants
4. [Backend] Validates plan, quantity, strikePrice, shareholder
5. [Backend] Detects cliffMonths > vestingDurationMonths
6. [Backend] Returns 422 with error code OPT_CLIFF_EXCEEDS_VESTING
7. [UI] Shows error toast

POSTCONDITION: No grant created
SIDE EFFECTS: None
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 7/8 | Auth check | No valid token | Error | 401, redirect to login |
| 8 | Role check (create/edit/close/cancel) | Not ADMIN | Error | 404 Not Found |
| 8 | Role check (list/detail/vesting) | Not ADMIN/FINANCE/LEGAL | Error | 404 Not Found |
| 9 | Input validation | Invalid fields | Error | 400 + validationErrors |
| 10 | Company status (create plan) | Company not ACTIVE | Error | 422 OPT_COMPANY_NOT_ACTIVE |
| 11 | Share class existence (create plan) | Share class not found | Error | 404 |
| 12 | Pool size validation | poolSize <= 0 | Error | 422 OPT_INVALID_POOL_SIZE |
| 8 | Plan status (update) | Plan CLOSED | Error | 422 OPT_PLAN_CLOSED |
| 10 | Pool shrink guard (update) | newPoolSize < totalGranted | Error | 422 OPT_POOL_CANNOT_SHRINK |
| 7 | Close plan status | Already CLOSED | Error | 422 OPT_PLAN_ALREADY_CLOSED |
| 9 | Plan status (create grant) | Plan CLOSED | Error | 422 OPT_PLAN_CLOSED |
| 10 | Quantity validation (grant) | quantity <= 0 | Error | 422 OPT_INVALID_QUANTITY |
| 11 | Strike price validation | strikePrice <= 0 | Error | 422 OPT_INVALID_STRIKE_PRICE |
| 12 | Pool availability (grant) | quantity > available pool | Error | 422 OPT_PLAN_EXHAUSTED |
| 13 | Shareholder existence | shareholderId provided but not found | Error | 404 |
| 14 | Cliff vs vesting | cliffMonths > vestingDurationMonths | Error | 422 OPT_CLIFF_EXCEEDS_VESTING |
| 15 | Date validation (grant) | expirationDate <= grantDate | Error | 422 OPT_INVALID_EXPIRATION |
| 7 | Cancel grant status | Grant CANCELLED | Error | 422 OPT_GRANT_ALREADY_CANCELLED |
| 7 | Cancel grant status | Grant EXERCISED | Error | 422 OPT_GRANT_TERMINATED |

---

## State Transitions

### Option Plan Lifecycle

```
  +--------+
  | ACTIVE |
  +--------+
      │
   [close]
      │
      v
  +--------+
  | CLOSED |
  +--------+
```

### Option Grant Lifecycle

```
  +--------+
  | ACTIVE |
  +--------+
      │
  ┌───┼───────┐
  │   │       │
  v   v       v
+-----+ +----------+ +---------+
|CANC.| |EXERCISED | |EXPIRED  |
+-----+ +----------+ +---------+
```

Note: EXERCISED and EXPIRED transitions are not yet implemented (Phase 6.2 Option Exercises).

### Entity State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| OptionPlan | status | -- | ACTIVE | ADMIN creates plan |
| OptionPlan | status | ACTIVE | CLOSED | ADMIN closes plan |
| OptionPlan | closedAt | null | timestamp | ADMIN closes plan |
| OptionPlan | totalGranted | X | X + qty | Grant created ($transaction) |
| OptionPlan | totalGranted | X | X - unexercised | Grant cancelled ($transaction) |
| OptionGrant | status | -- | ACTIVE | ADMIN creates grant |
| OptionGrant | status | ACTIVE | CANCELLED | ADMIN cancels grant |
| OptionGrant | terminatedAt | null | timestamp | ADMIN cancels grant |

---

## Vesting Calculation Logic

The vesting engine calculates real-time vesting status for each grant:

### Pre-Cliff (now < cliffDate)
- vestedQuantity = 0
- unvestedQuantity = total quantity
- nextVestingDate = cliffDate
- nextVestingAmount = cliff vest amount (cliffMonths / vestingDurationMonths * total)

### Post-Cliff, Pre-Full (cliffDate <= now < vestingEndDate)
- Cliff vesting: cliffVested = (cliffMonths / vestingDurationMonths) * totalQuantity
- Post-cliff periods: periodsElapsed = floor(monthsSinceCliff / periodMonths)
- vestingPerPeriod = (totalQuantity - cliffVested) / totalPostCliffPeriods
- vestedQuantity = cliffVested + (vestingPerPeriod * periodsElapsed)
- exercisableQuantity = vestedQuantity - exercised

### Fully Vested (now >= vestingEndDate)
- vestedQuantity = totalQuantity
- unvestedQuantity = 0
- exercisableQuantity = totalQuantity - exercised

### Non-Active Grants
- EXERCISED: vestedQuantity = totalQuantity, vestingPercentage = 100%
- CANCELLED/EXPIRED: vestedQuantity = 0, vestingPercentage = 0%

---

## By Role

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| List plans | Yes | Yes | Yes | No (404) | No (404) |
| View plan detail | Yes | Yes | Yes | No (404) | No (404) |
| Create plan | Yes | No (404) | No (404) | No (404) | No (404) |
| Update plan | Yes | No (404) | No (404) | No (404) | No (404) |
| Close plan | Yes | No (404) | No (404) | No (404) | No (404) |
| List grants | Yes | Yes | Yes | No (404) | No (404) |
| View grant detail | Yes | Yes | Yes | No (404) | No (404) |
| View vesting schedule | Yes | Yes | Yes | No (404) | No (404) |
| Create grant | Yes | No (404) | No (404) | No (404) | No (404) |
| Cancel grant | Yes | No (404) | No (404) | No (404) | No (404) |

---

## API Endpoints Summary

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /api/v1/companies/:companyId/option-plans | ADMIN | Create a new option plan |
| GET | /api/v1/companies/:companyId/option-plans | ADMIN, FINANCE, LEGAL | List plans with pagination/filtering |
| GET | /api/v1/companies/:companyId/option-plans/:planId | ADMIN, FINANCE, LEGAL | Get plan detail with grant stats |
| PUT | /api/v1/companies/:companyId/option-plans/:planId | ADMIN | Update ACTIVE plan |
| POST | /api/v1/companies/:companyId/option-plans/:planId/close | ADMIN | Close plan (no new grants) |
| POST | /api/v1/companies/:companyId/option-grants | ADMIN | Create a new option grant |
| GET | /api/v1/companies/:companyId/option-grants | ADMIN, FINANCE, LEGAL | List grants with pagination/filtering |
| GET | /api/v1/companies/:companyId/option-grants/:grantId | ADMIN, FINANCE, LEGAL | Get grant detail with vesting |
| GET | /api/v1/companies/:companyId/option-grants/:grantId/vesting | ADMIN, FINANCE, LEGAL | Get full vesting schedule |
| POST | /api/v1/companies/:companyId/option-grants/:grantId/cancel | ADMIN | Cancel/terminate a grant |
