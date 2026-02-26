# Exit Waterfall — User Flows

**Feature**: Simulate exit scenarios to visualize how liquidation proceeds are distributed among share classes using a waterfall analysis
**Actors**: ADMIN
**Preconditions**: User is authenticated, is an ADMIN member of the company, company has at least one share class with issued shares
**Related Flows**: [Cap Table Management](./cap-table-management.md), [Share Class Management](./share-class-management.md), [Option Plans](./option-plans.md), [Convertible Instruments](./convertible-instruments.md)

---

## Flow Map

```
User clicks "Run Waterfall"
  │
  ├─ [valid exit amount] ─→ POST /api/v1/companies/:companyId/reports/waterfall
  │     │
  │     ├─ [company has share classes with issued shares] ─→ Waterfall calculated
  │     │     │
  │     │     ├─ [includeOptions=true] ─→ Vested unexercised options added as-if-exercised
  │     │     ├─ [includeConvertibles=true] ─→ Active convertibles added as-if-converted
  │     │     ├─ [custom shareClassOrder provided] ─→ Custom stacking order validated + used
  │     │     │     └─ [invalid UUID in order] ─→ 404 Share class not found
  │     │     └─ [no custom order] ─→ Default seniority-based stacking order
  │     │
  │     ├─ [company not found] ─→ 404 Company not found
  │     └─ [no share classes] ─→ Empty result returned (no allocations)
  │
  └─ [invalid exit amount format] ─→ 400 Validation error

User clicks "Save Scenario"
  │
  ├─ [valid data + under 50 limit] ─→ POST .../waterfall/scenarios
  │     │
  │     ├─ [success] ─→ 201 Scenario created with resultData
  │     └─ [50 scenarios already exist] ─→ 422 Scenario limit reached
  │
  └─ [invalid data] ─→ 400 Validation error

User views "Saved Scenarios"
  │
  └─ GET .../waterfall/scenarios ─→ Paginated list (no resultData)
        │
        ├─ GET .../waterfall/scenarios/:id ─→ Full scenario with resultData
        │     └─ [scenario not found] ─→ 404 Not found
        │
        └─ DELETE .../waterfall/scenarios/:id ─→ 204 Deleted
              └─ [scenario not found] ─→ 404 Not found
```

---

## Flows

### Happy Path: Run Waterfall Analysis

```
PRECONDITION: Company has share classes with issued shares (shareholdings exist)
ACTOR: ADMIN
TRIGGER: User navigates to waterfall analysis page and enters exit amount

1. [UI] User navigates to Reports > Exit Waterfall
2. [UI] User enters exit amount (e.g., "10000000.00")
3. [UI] User optionally toggles "Include Options" and "Include Convertibles"
4. [UI] User optionally reorders share class stacking priority
5. [UI] User clicks "Run Waterfall"
6. [Frontend] Validates exit amount format (decimal string with up to 2 decimal places)
   → IF invalid: show field-level error, STOP
7. [Frontend] Sends POST /api/v1/companies/:companyId/reports/waterfall
8. [Backend] Validates authentication
   → IF unauthenticated: return 401, frontend redirects to login
9. [Backend] Validates authorization (role: ADMIN)
   → IF unauthorized: return 404 (prevent enumeration)
10. [Backend] Validates request body (RunWaterfallDto)
    → IF invalid: return 400 with validationErrors
11. [Backend] Loads company's share classes with issued shares, shareholdings, and funding rounds
    → IF company not found: return 404
12. [Backend] If includeOptions=true: loads vested unexercised option grants and adds as-if-exercised shares
13. [Backend] If includeConvertibles=true: loads active convertibles, calculates accrued interest, adds as-if-converted shares
14. [Backend] Determines stacking order (custom or seniority-based, highest seniority = most senior)
15. [Backend] Executes 7-step waterfall algorithm:
    - Step 1: Group classes by seniority tier for pari passu handling
    - Step 2: For each seniority tier (most senior first): allocate liquidation preference
    - Step 3: For participating preferred in the tier: allocate pro-rata participation
    - Step 4: Apply participation caps; redistribute excess to remaining classes
    - Step 5: For non-participating preferred: take max(preference, pro-rata conversion)
    - Step 6: Distribute remaining proceeds pro-rata to common and participating preferred
16. [Backend] Computes breakeven exit value via binary search (R$0.01 tolerance, ≤100 iterations)
17. [Backend] Calculates ROI multiples for preferred classes
18. [Backend] Returns 200 with WaterfallAnalysis result
19. [UI] Displays waterfall chart with per-class allocations
20. [UI] Shows breakeven analysis and summary statistics

POSTCONDITION: User sees waterfall analysis results (not persisted unless saved)
SIDE EFFECTS: None (read-only calculation)
```

### Happy Path: Save Scenario

```
PRECONDITION: User has run a waterfall analysis and wants to save the results
ACTOR: ADMIN
TRIGGER: User clicks "Save Scenario" after running a waterfall

1. [UI] User clicks "Save Scenario"
2. [UI] User enters scenario name (e.g., "Optimistic - R$10M")
3. [UI] User clicks "Save"
4. [Frontend] Validates name (required, max 100 chars) and exit amount
   → IF invalid: show field-level errors, STOP
5. [Frontend] Sends POST /api/v1/companies/:companyId/reports/waterfall/scenarios
6. [Backend] Validates authentication and authorization (ADMIN)
7. [Backend] Validates request body (SaveScenarioDto)
   → IF invalid: return 400
8. [Backend] Checks scenario count for company
   → IF ≥ 50: return 422 with WATERFALL_SCENARIO_LIMIT error
9. [Backend] Creates WaterfallScenario record with resultData JSON
10. [Backend] Returns 201 with created scenario (id, name, exitAmount, timestamps)
11. [UI] Shows success toast: "Cenário salvo com sucesso"
12. [UI] Adds scenario to saved scenarios list

POSTCONDITION: Scenario persisted in waterfall_scenarios table
SIDE EFFECTS: None
```

### Happy Path: List and View Saved Scenarios

```
PRECONDITION: Company has saved waterfall scenarios
ACTOR: ADMIN
TRIGGER: User navigates to saved scenarios section

1. [UI] User clicks "Saved Scenarios" tab
2. [Frontend] Sends GET /api/v1/companies/:companyId/reports/waterfall/scenarios?page=1&limit=20
3. [Backend] Returns paginated list of scenarios (without resultData for performance)
4. [UI] Displays scenario list with name, exit amount, created by, and date
5. [UI] User clicks on a specific scenario
6. [Frontend] Sends GET .../waterfall/scenarios/:scenarioId
7. [Backend] Returns full scenario including resultData
   → IF not found: return 404
8. [UI] Displays full waterfall analysis from saved data

POSTCONDITION: User views saved scenario details
SIDE EFFECTS: None
```

### Happy Path: Delete Scenario

```
PRECONDITION: Scenario exists and belongs to the company
ACTOR: ADMIN
TRIGGER: User clicks delete on a saved scenario

1. [UI] User clicks delete icon on a scenario
2. [UI] Confirmation dialog: "Tem certeza que deseja excluir este cenário?"
3. [UI] User confirms deletion
4. [Frontend] Sends DELETE /api/v1/companies/:companyId/reports/waterfall/scenarios/:scenarioId
5. [Backend] Validates authentication and authorization (ADMIN)
6. [Backend] Verifies scenario exists in company scope
   → IF not found: return 404
7. [Backend] Deletes scenario
8. [Backend] Returns 204 No Content
9. [UI] Removes scenario from list
10. [UI] Shows success toast: "Cenário excluído"

POSTCONDITION: Scenario deleted from database
SIDE EFFECTS: None
```

### Error Path: Invalid Share Class in Custom Order

```
PRECONDITION: User provides custom stacking order with invalid UUID
ACTOR: ADMIN

1. [UI] User reorders share classes and includes a non-existent ID
2. [Frontend] Sends POST .../reports/waterfall with shareClassOrder containing invalid UUID
3. [Backend] Validates share class UUIDs against company's share classes
4. [Backend] Returns 404 with SHARE_CLASS_NOT_FOUND error
5. [UI] Shows error toast

POSTCONDITION: No waterfall calculated
```

### Error Path: Scenario Limit Reached

```
PRECONDITION: Company already has 50 saved scenarios
ACTOR: ADMIN

1. [UI] User runs waterfall and clicks "Save Scenario"
2. [Frontend] Sends POST .../waterfall/scenarios
3. [Backend] Counts existing scenarios for company = 50
4. [Backend] Returns 422 with WATERFALL_SCENARIO_LIMIT error
5. [UI] Shows error toast: "Limite máximo de cenários salvos atingido (máximo: 50)"

POSTCONDITION: Scenario not saved
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 6 | Client validation | Exit amount format invalid | Error | Field-level error shown |
| 8 | Auth check | No valid token | Error | Redirect to login |
| 9 | Role check | Not ADMIN | Error | 404 Not Found |
| 10 | Input validation | DTO validation fails | Error | 400 + validation errors |
| 11 | Company check | Company not found | Error | 404 Not Found |
| 12 | Include options | includeOptions=true | Alternative | Add as-if-exercised shares |
| 13 | Include convertibles | includeConvertibles=true | Alternative | Add as-if-converted shares |
| 14 | Custom order | shareClassOrder provided | Alternative | Validate and use custom stacking |
| 14 | Custom order | Invalid UUID in order | Error | 404 Share class not found |
| 8 (save) | Scenario limit | ≥ 50 scenarios | Error | 422 Scenario limit reached |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| WaterfallScenario | — | — | Created | Save scenario |
| WaterfallScenario | — | Exists | Deleted | Delete scenario |

---

## Waterfall Algorithm Detail

The 7-step algorithm processes share classes from most senior to least senior:

1. **Load data**: Share classes with totalIssued, shareholdings, funding round investment data
2. **Validate order**: If custom shareClassOrder provided, verify all UUIDs exist
3. **Add options**: If includeOptions, add vested unexercised grants as additional shares
4. **Add convertibles**: If includeConvertibles, calculate principal + accrued interest, convert using min(cap, discount) pricing
5. **Determine stacking**: Order by seniority (descending) or use custom order; group same-seniority for pari passu
6. **Execute waterfall**: Process each seniority tier — liquidation preference first, then participation, then cap enforcement with redistribution, then non-participating conversion analysis, then remaining to common
7. **Compute breakeven**: Binary search for exit value where preferred classes receive exactly their liquidation preference

### Edge Cases

| Code | Scenario | Behavior |
|------|----------|----------|
| EC-1 | Exit amount = 0 | All classes receive 0, breakeven calculated normally |
| EC-2 | No convertibles or options | Flags excluded in response, proceeds distributed among equity only |
| EC-3 | All preferred non-participating | Each preferred class receives max(preference, pro-rata) |
| EC-4 | Only common shares | 100% of proceeds distributed pro-rata to common, breakeven = 0 |
| EC-5 | Insufficient proceeds | Distribute pro-rata among most senior tier, lower tiers get 0 |
| EC-6 | Invalid share class in custom order | 404 error |

---

## By Role

| Step | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|------|-------|---------|-------|----------|----------|
| Run waterfall | Yes | No (404) | No (404) | No (404) | No (404) |
| Save scenario | Yes | No (404) | No (404) | No (404) | No (404) |
| List scenarios | Yes | No (404) | No (404) | No (404) | No (404) |
| View scenario | Yes | No (404) | No (404) | No (404) | No (404) |
| Delete scenario | Yes | No (404) | No (404) | No (404) | No (404) |
