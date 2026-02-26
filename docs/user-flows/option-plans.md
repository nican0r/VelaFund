# Option Plans, Grants & Exercises — User Flows

**Feature**: Employee equity option plan management with grant lifecycle, vesting calculation, and exercise request flow
**Actors**: ADMIN (full CRUD + close/cancel + exercise confirm/cancel), FINANCE/LEGAL (read-only)
**Preconditions**: User is authenticated, user is an ACTIVE member of the company, company is ACTIVE, relevant share classes exist
**Related Flows**: [Company Management](./company-management.md) (company must be ACTIVE), [Share Class Management](./share-class-management.md) (share classes referenced by option plans), [Shareholder Management](./shareholder-management.md) (shareholders linked to grants for share issuance on exercise), [Cap Table Management](./cap-table-management.md) (fully-diluted view includes option grants, exercise confirmation mutates cap table), [Transactions](./transactions.md) (exercise confirmation creates new shares similar to issuance)

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


ADMIN clicks "Exercise Options" on a grant
  │
  ├─ [grant ACTIVE + quantity valid + vested sufficient + no pending exercise]
  │     ─→ POST /option-grants/:grantId/exercise
  │     │
  │     ├─ [all validations pass]
  │     │     ─→ 201 Created (status: PENDING_PAYMENT, payment reference generated)
  │     │
  │     ├─ [grant not ACTIVE] ─→ 422 OPT_GRANT_NOT_ACTIVE
  │     ├─ [exercise window expired] ─→ 422 OPT_EXERCISE_WINDOW_CLOSED
  │     ├─ [quantity <= 0] ─→ 422 OPT_INVALID_QUANTITY
  │     ├─ [quantity > exercisable] ─→ 422 OPT_INSUFFICIENT_VESTED
  │     └─ [pending exercise exists] ─→ 422 OPT_EXERCISE_PENDING
  │
  └─ [invalid form] ─→ Client-side validation prevents submission


User navigates to Exercise Requests
  │
  ├─ [role = ADMIN/FINANCE/LEGAL] ─→ GET /option-exercises?page=1&limit=20
  │     │
  │     ├─ [has exercises] ─→ Display paginated list with status/grantId filters
  │     │     │
  │     │     └─ [user clicks exercise row] ─→ GET /option-exercises/:exerciseId ─→ Detail view
  │     │
  │     └─ [empty] ─→ Display empty state
  │
  └─ [role = INVESTOR/EMPLOYEE] ─→ 404 Not Found


ADMIN clicks "Confirm Payment" on PENDING_PAYMENT exercise
  │
  ├─ [exercise PENDING_PAYMENT + grant has shareholder linked]
  │     ─→ POST /option-exercises/:exerciseId/confirm
  │     │
  │     ├─ [all validations pass] ─→ 200 Confirmed ($transaction:
  │     │     exercise→COMPLETED, grant.exercised++, plan.totalExercised++,
  │     │     shareholding upserted, shareClass.totalIssued++)
  │     │
  │     ├─ [already COMPLETED/CONFIRMED/ISSUED] ─→ 422 OPT_EXERCISE_ALREADY_CONFIRMED
  │     ├─ [already CANCELLED] ─→ 422 OPT_EXERCISE_ALREADY_CANCELLED
  │     ├─ [not PENDING_PAYMENT] ─→ 422 OPT_EXERCISE_NOT_PENDING
  │     └─ [no shareholder linked to grant] ─→ 422 OPT_NO_SHAREHOLDER_LINKED
  │
  └─ [exercise not found] ─→ 404


ADMIN clicks "Cancel Exercise" on PENDING_PAYMENT exercise
  │
  ├─ [exercise PENDING_PAYMENT] ─→ POST /option-exercises/:exerciseId/cancel
  │     └─ 200 Exercise cancelled (status: CANCELLED, cancelledAt set)
  │
  ├─ [already CANCELLED] ─→ 422 OPT_EXERCISE_ALREADY_CANCELLED
  │
  └─ [not PENDING_PAYMENT] ─→ 422 OPT_EXERCISE_NOT_PENDING
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

### Frontend Flow: Create Option Grant Form (2-Step Wizard)

```
PRECONDITION: Company is ACTIVE, at least one ACTIVE option plan exists, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "New Grant" button on Grants tab of Option Plans page

STEP 1 — DETAILS:

1. [UI] User navigates to /dashboard/options/grants/new
2. [UI] Page renders 3-section form:
   - Employee Information: employeeName (required), employeeEmail (required, email format),
     shareholderId (optional dropdown populated from useShareholders hook)
   - Grant Terms: optionPlanId (required dropdown from useOptionPlans with ACTIVE filter),
     quantity (required, must be > 0 and <= available pool), strikePrice (required, > 0),
     grantDate (required), expirationDate (required, must be after grantDate)
   - Vesting Configuration: cliffMonths (required, default 12, 0-60, must be <= vestingDurationMonths),
     vestingDurationMonths (required, default 48, > 0), vestingFrequency (MONTHLY/QUARTERLY/ANNUALLY, default MONTHLY),
     accelerationOnCoc (checkbox, default false), notes (optional textarea)
3. [UI] When plan is selected, shows available options count (totalPoolSize - totalGranted)
4. [UI] When quantity and strikePrice are filled, shows calculated total value
5. [UI] User fills fields and clicks "Next"
6. [Frontend] Validates all fields client-side:
   → IF employeeName empty: show "Employee name is required"
   → IF employeeEmail empty: show "Email is required"
   → IF employeeEmail invalid: show "Invalid email format"
   → IF optionPlanId not selected: show "Option plan is required"
   → IF quantity empty or <= 0: show "Must be greater than 0"
   → IF quantity > available pool: show "Exceeds available options in this plan"
   → IF strikePrice empty or <= 0: show "Must be greater than 0"
   → IF grantDate empty: show "Grant date is required"
   → IF expirationDate empty: show "Expiration date is required"
   → IF expirationDate <= grantDate: show "Must be after grant date"
   → IF cliffMonths > vestingDurationMonths: show "Cliff cannot exceed vesting duration"
   → IF vestingDurationMonths <= 0: show "Must be greater than 0"
   → IF any error: STOP, show field-level errors

STEP 2 — REVIEW:

7. [UI] Displays read-only summary of all fields:
   - Employee: name, email, linked shareholder (if selected)
   - Grant: plan name, quantity (formatted), strike price (BRL formatted), total value, dates (dd/MM/yyyy)
   - Vesting: cliff months, duration months, frequency label, acceleration flag, notes (if provided)
8. [UI] User clicks "Create Grant"
9. [Frontend] Calls useCreateOptionGrant mutate() with payload:
   { optionPlanId, employeeName, employeeEmail, quantity, strikePrice, grantDate, expirationDate,
     cliffMonths (as number), vestingDurationMonths (as number), vestingFrequency,
     accelerationOnCoc? (only if true), shareholderId? (only if selected), notes? (only if non-empty) }
10. [Backend] Validates and creates grant (see "Happy Path: Create Option Grant" above)
11. [UI] On success: shows toast "Option grant created successfully", navigates to /dashboard/options
12. [UI] On error: shows error toast with backend messageKey
13. [UI] User can click "Back" to return to Step 1 and edit fields
14. [UI] User can click "Cancel" to return to /dashboard/options

POSTCONDITION: Same as "Happy Path: Create Option Grant"
SIDE EFFECTS: Same as "Happy Path: Create Option Grant"
```

### Frontend Flow: Create Option Grant Form — No Company State

```
PRECONDITION: No company selected in CompanyProvider
ACTOR: Any user

1. [UI] User navigates to /dashboard/options/grants/new
2. [UI] Page renders "No company selected" message (from optionPlans.noCompany i18n key)
3. [UI] No form is displayed

POSTCONDITION: User must select a company before creating grants
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

### Happy Path: Create Exercise Request

```
PRECONDITION: Grant is ACTIVE with vested options available, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Exercise Options" on an ACTIVE grant

1. [UI] User views grant detail page with ACTIVE status and exercisable options > 0
2. [UI] User clicks "Exercise Options" button in header
3. [UI] Navigates to /dashboard/options/grants/:grantId/exercise
   → Guard checks: no pending exercise, grant ACTIVE, exercisableQty > 0
   → IF pending exercise exists: show warning banner, STOP
   → IF grant not active: show "not active" message, STOP
   → IF no exercisable: show "no exercisable options" message, STOP
4. [UI] Step 1 (Details): Grant info card (employee, plan, exercisable qty, strike price)
   Quantity input with live total cost calculation (quantity × strikePrice)
   Helper text shows max exercisable
5. [UI] User enters quantity and clicks "Review"
6. [Frontend] Validates input client-side (quantity > 0, quantity <= exercisable)
   → IF invalid: show field-level errors, STOP
7. [UI] Step 2 (Review): Summary card with employee, plan, quantity, strike price, total cost
8. [UI] User clicks "Submit Exercise"
9. [Frontend] Sends POST /api/v1/companies/:companyId/option-grants/:grantId/exercise
   Body: { quantity }
10. [Backend] Validates authentication and authorization (ADMIN or grantee EMPLOYEE)
11. [Backend] Validates grant exists and belongs to company
    → IF not found: return 404
12. [Backend] Validates grant status = ACTIVE
    → IF not ACTIVE: return 422 OPT_GRANT_NOT_ACTIVE
13. [Backend] If grant has terminatedAt, checks exercise window
    → IF exerciseWindowDays elapsed since terminatedAt: return 422 OPT_EXERCISE_WINDOW_CLOSED
14. [Backend] Validates quantity > 0
    → IF invalid: return 422 OPT_INVALID_QUANTITY
15. [Backend] Calculates vesting: exercisable = vestedQuantity - exercised
    → IF quantity > exercisable: return 422 OPT_INSUFFICIENT_VESTED
16. [Backend] Checks for existing PENDING_PAYMENT exercise on this grant
    → IF pending exists: return 422 OPT_EXERCISE_PENDING
17. [Backend] Calculates totalCost = quantity × strikePrice
18. [Backend] Generates unique payment reference (EX-YYYY-XXXXXX)
19. [Backend] Creates OptionExerciseRequest with status = PENDING_PAYMENT
20. [Backend] Returns 201 with created exercise request
21. [UI] Shows success toast: "Exercise request created successfully"
22. [UI] Navigates back to grant detail page

POSTCONDITION: OptionExerciseRequest exists with status PENDING_PAYMENT, payment reference generated
SIDE EFFECTS: Audit log (future: OPTION_EXERCISE_REQUESTED)
```

### Happy Path: List Exercise Requests

```
PRECONDITION: User has ADMIN, FINANCE, or LEGAL role
ACTOR: Any permitted member
TRIGGER: User navigates to exercise requests page

1. [UI] User navigates to /companies/:companyId/option-exercises
2. [Frontend] Sends GET /api/v1/companies/:companyId/option-exercises?page=1&limit=20
3. [Backend] Validates auth and role (ADMIN, FINANCE, LEGAL)
4. [Backend] Returns paginated list scoped to company through grant relation
5. [UI] Displays table with columns: employee name, plan name, quantity, total cost, payment reference, status, created date
6. [UI] User can filter by status (PENDING_PAYMENT, COMPLETED, CANCELLED)
7. [UI] User can filter by grantId
8. [UI] User can sort by createdAt, status, quantity

POSTCONDITION: User sees exercise requests for this company
SIDE EFFECTS: None
```

### Happy Path: View Exercise Request Detail

```
PRECONDITION: Exercise request exists, user has ADMIN, FINANCE, or LEGAL role
ACTOR: Any permitted member
TRIGGER: User clicks on an exercise request row

1. [UI] User clicks on an exercise row in list
2. [Frontend] Sends GET /api/v1/companies/:companyId/option-exercises/:exerciseId
3. [Backend] Returns exercise detail with grant, plan, and shareholder info
4. [UI] Displays exercise detail with:
   - Status badge (PENDING_PAYMENT yellow, COMPLETED green, CANCELLED gray)
   - Payment reference
   - Exercise quantity and total cost (quantity × strike price)
   - Grant details: employee name/email, total grant quantity, exercised to date
   - Plan info: name, share class
   - Shareholder info (if linked)
   - Confirmation details (if confirmed): confirmedBy, confirmedAt

POSTCONDITION: User sees full exercise request detail
SIDE EFFECTS: None
```

### Happy Path: Confirm Exercise Payment

```
PRECONDITION: Exercise request is PENDING_PAYMENT, grant has linked shareholder, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Confirm Payment" on a PENDING_PAYMENT exercise

1. [UI] User views the Exercises tab on the Options page, or the Exercises tab on a grant detail page
   - PENDING_PAYMENT exercises show a green checkmark (✓) confirm button in the actions column
2. [UI] User clicks the confirm button (CheckCircle2 icon) on a PENDING_PAYMENT exercise row
3. [UI] ConfirmExerciseDialog modal opens, showing:
   - Exercise summary card: quantity, price per share, total cost (BRL), payment reference, grant name
   - Optional textarea: "Payment Notes" for admin to add payment confirmation details
   - Two buttons: "Confirm Payment" (primary, blue) and "Cancel" (secondary)
   - Backdrop overlay (click to close)
4. [UI] User optionally fills in payment notes (e.g., bank transfer confirmation number)
5. [UI] User clicks "Confirm Payment"
6. [Frontend] Sends POST /api/v1/companies/:companyId/option-exercises/:exerciseId/confirm
   Body: { paymentNotes? }
7. [Backend] Validates auth (ADMIN), exercise exists (scoped through grant.companyId)
   → IF not found: return 404
8. [Backend] Validates status = PENDING_PAYMENT
   → IF COMPLETED/PAYMENT_CONFIRMED/SHARES_ISSUED: return 422 OPT_EXERCISE_ALREADY_CONFIRMED
   → IF CANCELLED: return 422 OPT_EXERCISE_ALREADY_CANCELLED
   → IF other non-pending status: return 422 OPT_EXERCISE_NOT_PENDING
9. [Backend] Validates grant has linked shareholder
   → IF shareholderId is null: return 422 OPT_NO_SHAREHOLDER_LINKED
10. [Backend] Begins $transaction (atomic, all-or-nothing):
    a. Updates OptionExerciseRequest: status → COMPLETED, confirmedBy, confirmedAt
    b. Updates OptionGrant: exercised += quantity
       - If exercised >= total quantity: status → EXERCISED
    c. Updates OptionPlan: totalExercised += quantity
    d. Upserts Shareholding for the shareholder + share class:
       - If holding exists: quantity += exercise quantity
       - If no holding: creates new Shareholding with exercise quantity
    e. Updates ShareClass: totalIssued += quantity
11. [Backend] Returns 200 with confirmed exercise
12. [UI] Shows success toast: "Payment confirmed. Shares issued."
13. [UI] Exercises list refreshes, exercise now shows COMPLETED status badge
    - Confirm button no longer appears for this exercise

POSTCONDITION: Exercise status = COMPLETED. Grant.exercised incremented (may transition to EXERCISED if fully exercised). Plan.totalExercised incremented. Shareholder holdings increased by exercise quantity. ShareClass.totalIssued increased.
SIDE EFFECTS: Audit log (future: OPTION_EXERCISE_CONFIRMED). Cap table mutated.
```

### Happy Path: Cancel Exercise Request

```
PRECONDITION: Exercise request is PENDING_PAYMENT, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Cancel Exercise" on a PENDING_PAYMENT exercise

1. [UI] User views the Exercises tab on the Options page, or the Exercises tab on a grant detail page
   - PENDING_PAYMENT exercises show a cancel button (X icon) in the actions column
2. [UI] User clicks the cancel button on a PENDING_PAYMENT exercise row
3. [UI] ConfirmDialog modal opens: "Cancel this exercise request?" with exercise details
   - Two buttons: "Yes, cancel" (destructive, red) and "No" (secondary)
4. [UI] User clicks "Yes, cancel"
5. [Frontend] Sends POST /api/v1/companies/:companyId/option-exercises/:exerciseId/cancel
6. [Backend] Validates auth (ADMIN), exercise exists
   → IF not found: return 404
7. [Backend] Validates status
   → IF already CANCELLED: return 422 OPT_EXERCISE_ALREADY_CANCELLED
   → IF not PENDING_PAYMENT: return 422 OPT_EXERCISE_NOT_PENDING
8. [Backend] Updates exercise: status → CANCELLED, cancelledAt = now
9. [Backend] Returns 200 with cancelled exercise
10. [UI] Shows success toast: "Exercise request cancelled"
11. [UI] Exercises list refreshes, exercise now shows CANCELLED status badge
    - Cancel and confirm buttons no longer appear for this exercise

POSTCONDITION: Exercise status = CANCELLED, cancelledAt set. No changes to grant, plan, or cap table.
SIDE EFFECTS: Audit log (future: OPTION_EXERCISE_REJECTED)
```

### Error Path: Insufficient Vested Options

```
ACTOR: ADMIN member
TRIGGER: Attempts to exercise more options than are vested and exercisable

1. [UI] User enters quantity exceeding exercisable options
2. [Frontend] Sends POST /api/v1/companies/:companyId/option-grants/:grantId/exercise
3. [Backend] Validates grant, calculates vesting
4. [Backend] Detects quantity > (vestedQuantity - exercised)
5. [Backend] Returns 422 with error code OPT_INSUFFICIENT_VESTED
   Body: { error: { code: "OPT_INSUFFICIENT_VESTED", messageKey: "errors.opt.insufficientVested", details: { exercisableOptions: "500", requestedQuantity: "2000" } } }
6. [UI] Shows error toast

POSTCONDITION: No exercise request created
SIDE EFFECTS: None
```

### Error Path: No Shareholder Linked on Confirmation

```
ACTOR: ADMIN member
TRIGGER: Attempts to confirm exercise payment but grant has no linked shareholder

1. [UI] User clicks "Confirm Payment" on exercise
2. [Frontend] Sends POST /api/v1/companies/:companyId/option-exercises/:exerciseId/confirm
3. [Backend] Validates exercise is PENDING_PAYMENT
4. [Backend] Detects grant.shareholderId is null
5. [Backend] Returns 422 with error code OPT_NO_SHAREHOLDER_LINKED
6. [UI] Shows error toast: "Grant must be linked to a shareholder to issue shares"

RESOLUTION: Link a shareholder to the grant before confirming the exercise
POSTCONDITION: Exercise remains PENDING_PAYMENT
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
| 9 | Grant status (exercise) | Grant not ACTIVE | Error | 422 OPT_GRANT_NOT_ACTIVE |
| 10 | Exercise window | Window expired for terminated grant | Error | 422 OPT_EXERCISE_WINDOW_CLOSED |
| 11 | Quantity validation (exercise) | quantity <= 0 | Error | 422 OPT_INVALID_QUANTITY |
| 12 | Vesting validation (exercise) | quantity > exercisable | Error | 422 OPT_INSUFFICIENT_VESTED |
| 13 | Pending exercise check | Pending exercise exists for grant | Error | 422 OPT_EXERCISE_PENDING |
| 7 | Confirm exercise status | Already COMPLETED/CONFIRMED/ISSUED | Error | 422 OPT_EXERCISE_ALREADY_CONFIRMED |
| 7 | Confirm exercise status | Already CANCELLED | Error | 422 OPT_EXERCISE_ALREADY_CANCELLED |
| 7 | Confirm exercise status | Not PENDING_PAYMENT | Error | 422 OPT_EXERCISE_NOT_PENDING |
| 8 | Shareholder linkage | No shareholder linked to grant | Error | 422 OPT_NO_SHAREHOLDER_LINKED |
| 7 | Cancel exercise status | Already CANCELLED | Error | 422 OPT_EXERCISE_ALREADY_CANCELLED |
| 7 | Cancel exercise status | Not PENDING_PAYMENT | Error | 422 OPT_EXERCISE_NOT_PENDING |

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

Note: EXERCISED transition is implemented via exercise confirmation ($transaction). EXPIRED transition is not yet automated (requires scheduled job).

### Option Exercise Request Lifecycle

```
  +-----------------+
  | PENDING_PAYMENT |
  +-----------------+
        │
    ┌───┴───┐
    │       │
    v       v
+---------+ +-----------+
|COMPLETED| | CANCELLED |
+---------+ +-----------+
```

Note: The spec defines intermediate states PAYMENT_CONFIRMED and SHARES_ISSUED. Since blockchain integration (Phase 3) is not yet built, confirmation goes directly to COMPLETED (payment confirmed + shares issued in one atomic step).

### Entity State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| OptionPlan | status | -- | ACTIVE | ADMIN creates plan |
| OptionPlan | status | ACTIVE | CLOSED | ADMIN closes plan |
| OptionPlan | closedAt | null | timestamp | ADMIN closes plan |
| OptionPlan | totalGranted | X | X + qty | Grant created ($transaction) |
| OptionPlan | totalGranted | X | X - unexercised | Grant cancelled ($transaction) |
| OptionPlan | totalExercised | X | X + qty | Exercise confirmed ($transaction) |
| OptionGrant | status | -- | ACTIVE | ADMIN creates grant |
| OptionGrant | status | ACTIVE | CANCELLED | ADMIN cancels grant |
| OptionGrant | status | ACTIVE | EXERCISED | Exercise confirmed, fully exercised ($transaction) |
| OptionGrant | exercised | X | X + qty | Exercise confirmed ($transaction) |
| OptionGrant | terminatedAt | null | timestamp | ADMIN cancels grant |
| OptionExerciseRequest | status | -- | PENDING_PAYMENT | ADMIN creates exercise request |
| OptionExerciseRequest | status | PENDING_PAYMENT | COMPLETED | ADMIN confirms payment ($transaction) |
| OptionExerciseRequest | status | PENDING_PAYMENT | CANCELLED | ADMIN cancels exercise |
| Shareholding | quantity | X | X + qty | Exercise confirmed, existing holding ($transaction) |
| Shareholding | -- | (new) | created | Exercise confirmed, no existing holding ($transaction) |
| ShareClass | totalIssued | X | X + qty | Exercise confirmed ($transaction) |

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
| Create exercise request | Yes | No (404) | No (404) | No (404) | No (404) |
| List exercise requests | Yes | Yes | Yes | No (404) | No (404) |
| View exercise detail | Yes | Yes | Yes | No (404) | No (404) |
| Confirm exercise payment | Yes | No (404) | No (404) | No (404) | No (404) |
| Cancel exercise | Yes | No (404) | No (404) | No (404) | No (404) |

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
| POST | /api/v1/companies/:companyId/option-grants/:grantId/exercise | ADMIN | Create exercise request |
| GET | /api/v1/companies/:companyId/option-exercises | ADMIN, FINANCE, LEGAL | List exercise requests |
| GET | /api/v1/companies/:companyId/option-exercises/:exerciseId | ADMIN, FINANCE, LEGAL | Get exercise detail |
| POST | /api/v1/companies/:companyId/option-exercises/:exerciseId/confirm | ADMIN | Confirm payment, issue shares |
| POST | /api/v1/companies/:companyId/option-exercises/:exerciseId/cancel | ADMIN | Cancel pending exercise |
