# Cap Table Management — User Flows

**Feature**: View current and fully-diluted cap table, manage point-in-time snapshots, export in multiple formats
**Actors**: ADMIN (full access + write), FINANCE (full access + write/export), LEGAL (read-only), INVESTOR (no access)
**Preconditions**: User is authenticated, user is an ACTIVE member of the company
**Related Flows**: [Shareholder Management](./shareholder-management.md) (shareholders populate cap table entries), [Share Class Management](./share-class-management.md) (share classes determine voting power and types), [Company Management](./company-management.md) (company must exist and be ACTIVE for snapshots)

---

## Flow Map

```
User navigates to Cap Table page
  │
  ├─ [role = ADMIN/FINANCE/LEGAL] ─→ GET /cap-table?view=current
  │     │
  │     ├─ [has shareholdings] ─→ Display cap table with ownership %, voting power
  │     │     │
  │     │     ├─ [user selects share class filter] ─→ GET /cap-table?shareClassId=sc-1
  │     │     │
  │     │     ├─ [user switches to fully-diluted view] ─→ GET /cap-table?view=fully-diluted
  │     │     │     │
  │     │     │     └─ [has option grants] ─→ Shows options vested/unvested per shareholder
  │     │     │
  │     │     ├─ [ADMIN/FINANCE clicks "Export OCT"] ─→ Export flow (see below)
  │     │     │
  │     │     ├─ [ADMIN/FINANCE clicks "Create Snapshot"] ─→ Snapshot creation flow (see below)
  │     │     │
  │     │     └─ [user clicks "Snapshot History"] ─→ History flow (see below)
  │     │
  │     └─ [empty cap table] ─→ Display empty state: "No shareholdings yet"
  │
  ├─ [role = INVESTOR/EMPLOYEE] ─→ 404 Not Found (enumeration prevention)
  │
  └─ [unauthenticated] ─→ 401 Unauthorized → redirect to login


ADMIN/FINANCE clicks "Create Snapshot"
  │
  ├─ [valid form: date + optional notes] ─→ POST /cap-table/snapshot
  │     │
  │     ├─ [company ACTIVE + date not future] ─→ 201 Created (snapshot with SHA-256 state hash)
  │     │
  │     ├─ [company not ACTIVE] ─→ 422 CAP_COMPANY_NOT_ACTIVE
  │     │
  │     ├─ [snapshot date in future] ─→ 422 CAP_FUTURE_SNAPSHOT_DATE
  │     │
  │     ├─ [company not found] ─→ 404 Not Found
  │     │
  │     └─ [validation error] ─→ 400 Bad Request
  │
  └─ [invalid form] ─→ Client-side validation prevents submission


User views Snapshot History
  │
  ├─ [role = ADMIN/FINANCE/LEGAL] ─→ GET /cap-table/history?page=1&limit=20
  │     │
  │     ├─ [has snapshots] ─→ Display paginated list (date, totalShares, trigger, notes)
  │     │     │
  │     │     └─ [user selects a snapshot date] ─→ GET /cap-table/snapshot?date=2025-12-31
  │     │           │
  │     │           ├─ [snapshot found] ─→ Display point-in-time cap table data
  │     │           │
  │     │           ├─ [no snapshot for date] ─→ 404 Not Found
  │     │           │
  │     │           └─ [date before company creation] ─→ 422 CAP_NO_DATA_FOR_DATE
  │     │
  │     └─ [no snapshots] ─→ Empty state: "No snapshots yet"
  │
  └─ [company not found] ─→ 404 Not Found


ADMIN/FINANCE clicks "Export OCT"
  │
  ├─ [company exists] ─→ GET /cap-table/export/oct
  │     │
  │     ├─ [success] ─→ JSON download (OCF 1.0.0 format, masked tax IDs)
  │     │
  │     └─ [company not found] ─→ 404 Not Found
  │
  └─ [LEGAL role] ─→ 404 Not Found (no export permission)


Cap-table-mutating event completes (SYSTEM, automatic)
  │
  ├─ [transaction confirmed] ─→ recalculateOwnership → auto-snapshot (fire-and-forget)
  │
  ├─ [funding round closed] ─→ recalculateOwnership → auto-snapshot (fire-and-forget)
  │
  ├─ [option exercise confirmed] ─→ recalculateOwnership → auto-snapshot (fire-and-forget)
  │
  ├─ [convertible converted] ─→ recalculateOwnership → auto-snapshot (fire-and-forget)
  │
  ├─ [ownership recalculation succeeds] ─→ All ownershipPct + votingPowerPct updated atomically
  │
  ├─ [snapshot creation succeeds] ─→ CapTableSnapshot created with trigger type + SHA-256 hash
  │
  └─ [snapshot creation fails] ─→ Error logged, original operation NOT affected
```

---

## Flows

### Happy Path: View Current Cap Table

```
PRECONDITION: Company exists, user is ACTIVE member with ADMIN/FINANCE/LEGAL role
ACTOR: ADMIN, FINANCE, or LEGAL member
TRIGGER: User navigates to Cap Table page

1. [UI] User navigates to /companies/:companyId/cap-table
2. [Frontend] Sends GET /api/v1/companies/:companyId/cap-table?view=current
3. [Backend] AuthGuard validates token
   → IF unauthenticated: return 401, frontend redirects to login
4. [Backend] RolesGuard checks ADMIN/FINANCE/LEGAL role
   → IF not a member: return 404 (prevent enumeration)
   → IF wrong role: return 404 (prevent enumeration)
5. [Backend] Validates company exists
   → IF not found: return 404
6. [Backend] Queries all Shareholding records with shareholder + shareClass includes
7. [Backend] Calculates:
   - Total shares (sum of all shareholding quantities)
   - Per-entry ownership percentage (quantity / totalShares * 100, 6 decimal places)
   - Voting power per entry (quantity * shareClass.votesPerShare)
   - Voting percentage (votingPower / totalVotingPower * 100, 6 decimal places)
   - Unique shareholder count and share class count
   - lastUpdated from most recent shareholding updatedAt
8. [Backend] Returns 200 with cap table data
9. [UI] Displays cap table with entries sorted by share class name

POSTCONDITION: Cap table displayed with ownership and voting data
SIDE EFFECTS: None
```

### Happy Path: View Fully-Diluted Cap Table

```
PRECONDITION: Company exists, user is ACTIVE member with ADMIN/FINANCE/LEGAL role
ACTOR: ADMIN, FINANCE, or LEGAL member
TRIGGER: User switches view to "fully-diluted"

1. [UI] User selects "Fully Diluted" view toggle
2. [Frontend] Sends GET /api/v1/companies/:companyId/cap-table?view=fully-diluted
3. [Backend] Controller detects view=fully-diluted, delegates to getFullyDilutedCapTable
4. [Backend] Queries all Shareholding records
5. [Backend] Queries all ACTIVE OptionGrant records with non-null shareholderId
6. [Backend] For each option grant, calculates vested options using:
   - Months elapsed since grant date
   - Cliff period check (if months < cliffMonths, vested = 0)
   - Cliff percentage (immediate vest at cliff)
   - Linear vesting for remainder over vestingDurationMonths
7. [Backend] Aggregates by shareholder:
   - currentShares (from Shareholding)
   - optionsVested (vested minus exercised)
   - optionsUnvested (total minus vested)
   - fullyDilutedShares (shares + all options)
   - fullyDilutedPercentage (fdShares / totalFD * 100)
8. [Backend] Returns 200 with fully-diluted data sorted by fdPercentage desc

POSTCONDITION: Fully-diluted cap table displayed including option pools
SIDE EFFECTS: None
```

### Happy Path: Create Manual Snapshot

```
PRECONDITION: Company is ACTIVE, user has ADMIN/FINANCE role
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "Create Snapshot" button

1. [UI] User clicks "Create Snapshot"
2. [UI] Modal opens with date picker and optional notes field
3. [UI] User selects a snapshot date (must be today or past)
4. [UI] User optionally enters notes (max 500 chars)
5. [UI] User clicks "Save Snapshot"
6. [Frontend] Validates date is not in the future
   → IF future: show client-side validation error, STOP
7. [Frontend] Sends POST /api/v1/companies/:companyId/cap-table/snapshot
   Body: { snapshotDate: "2025-06-30", notes: "Mid-year snapshot" }
8. [Backend] Validates authentication and ADMIN/FINANCE role
9. [Backend] Validates company exists and is ACTIVE
   → IF not found: return 404
   → IF not ACTIVE: return 422 CAP_COMPANY_NOT_ACTIVE
10. [Backend] Validates snapshotDate is not in the future
    → IF future: return 422 CAP_FUTURE_SNAPSHOT_DATE
11. [Backend] Captures current cap table state via getCurrentCapTable
12. [Backend] Computes SHA-256 state hash from sorted entries
13. [Backend] Creates CapTableSnapshot record with data, trigger='manual', stateHash
14. [Backend] Returns 201 with snapshot summary
15. [UI] Shows success toast: "Snapshot created"
16. [UI] Refreshes snapshot history list

POSTCONDITION: New CapTableSnapshot record created with current state
SIDE EFFECTS: None (audit logging will be added in Phase 3)
```

### Happy Path: View Snapshot History

```
PRECONDITION: Company exists, user has ADMIN/FINANCE/LEGAL role
ACTOR: ADMIN, FINANCE, or LEGAL member
TRIGGER: User navigates to snapshot history section

1. [UI] User clicks "Snapshot History" tab
2. [Frontend] Sends GET /api/v1/companies/:companyId/cap-table/history?page=1&limit=20
3. [Backend] Validates company exists
4. [Backend] Queries paginated CapTableSnapshot records sorted by snapshotDate desc
5. [Backend] Extracts summary data from JSON data field (totalShares, totalShareholders, trigger)
6. [Backend] Returns paginated response with snapshot summaries
7. [UI] Displays paginated list of snapshots

POSTCONDITION: Snapshot history displayed with pagination
SIDE EFFECTS: None
```

### Happy Path: View Point-in-Time Snapshot

```
PRECONDITION: Snapshots exist for the company
ACTOR: ADMIN, FINANCE, or LEGAL member
TRIGGER: User selects a date from snapshot history

1. [UI] User clicks on a snapshot date or enters a date
2. [Frontend] Sends GET /api/v1/companies/:companyId/cap-table/snapshot?date=2025-12-31
3. [Backend] Validates company exists
4. [Backend] Checks date is not before company creation
   → IF before: return 422 CAP_NO_DATA_FOR_DATE
5. [Backend] Finds closest snapshot on or before the requested date
   → IF none found: return 404
6. [Backend] Returns snapshot data with id, snapshotDate, data, notes, stateHash
7. [UI] Displays the historical cap table state

POSTCONDITION: Point-in-time cap table data displayed
SIDE EFFECTS: None
```

### Happy Path: Export OCT Format

```
PRECONDITION: Company exists, user has ADMIN/FINANCE role
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "Export OCT" button

1. [UI] User clicks "Export OCT"
2. [Frontend] Sends GET /api/v1/companies/:companyId/cap-table/export/oct
3. [Backend] Validates company exists
4. [Backend] Queries share classes and maps to OCT format:
   - QUOTA → COMMON
   - COMMON_SHARES → COMMON
   - PREFERRED_SHARES → PREFERRED
5. [Backend] Queries active shareholders with shareholdings
6. [Backend] Masks tax IDs (CPF: ***.***.*X*-XX, CNPJ: **.***.***/ XXXX-XX)
7. [Backend] Builds OCF 1.0.0 JSON structure with issuer, stockClasses, stockholders, stockIssuances
8. [Backend] Returns 200 with OCT JSON
9. [UI] Downloads JSON file

POSTCONDITION: OCT export file downloaded
SIDE EFFECTS: None (audit logging CAP_TABLE_EXPORTED will be added later)
```

### System Path: Automatic Snapshot After Cap Table Mutation

```
PRECONDITION: A cap-table-mutating event has just completed successfully
ACTOR: SYSTEM (triggered automatically, not by user action)
TRIGGER: One of the following events completes:
  - Transaction confirmed (ISSUANCE, TRANSFER, CONVERSION, CANCELLATION, SPLIT)
  - Funding round closed (atomic share issuance for all confirmed commitments)
  - Option exercise confirmed (shares issued to grantee)
  - Convertible instrument converted (shares issued to holder)

1. [Backend] Cap table mutation completes within the primary $transaction
2. [Backend] Calls recalculateOwnership(companyId) to update all Shareholding records:
   - Recalculates ownershipPct for every Shareholding (quantity / totalShares * 100, 6 decimal places)
   - Recalculates votingPowerPct for every Shareholding (votingPower / totalVotingPower * 100)
   - Updates are performed within the same $transaction to ensure atomicity
3. [Backend] After the $transaction commits, fires auto-snapshot creation (fire-and-forget):
   - Captures the current cap table state via getCurrentCapTable
   - Computes SHA-256 state hash from sorted entries
   - Creates a CapTableSnapshot record with trigger = event type (e.g., 'transaction_confirmed', 'round_closed', 'exercise_confirmed', 'convertible_converted')
   - If snapshot creation fails, the error is logged but does NOT affect the original operation
4. [Backend] Returns the response for the original operation (confirm, close, etc.)
   - The caller is never blocked or impacted by snapshot failures

POSTCONDITION: Ownership percentages are up to date across all Shareholdings; a new CapTableSnapshot record exists (unless snapshot creation failed, in which case the mutation itself still succeeded)
SIDE EFFECTS: CapTableSnapshot created asynchronously, audit log event for the original operation
```

**Key design decisions**:
- **Ownership recalculation is synchronous**: It runs inside the same `$transaction` as the cap table mutation to guarantee consistency. After any mutation, all `ownershipPct` and `votingPowerPct` values reflect the new state.
- **Snapshot creation is fire-and-forget**: It runs after the transaction commits. If it fails (e.g., database timeout), the original operation still succeeds and the user sees a success response. The failure is logged for investigation.
- **Triggering events**: The four mutation categories that trigger auto-snapshots are:
  1. **Transaction confirmed** -- via `TransactionService.confirm()` for all 5 transaction types
  2. **Funding round closed** -- via `FundingRoundService.closeRound()` which atomically issues shares for all confirmed commitments
  3. **Option exercise confirmed** -- via `OptionPlanService.confirmExercise()` which issues shares to the grantee
  4. **Convertible converted** -- via `ConvertibleService.convert()` which issues shares to the instrument holder

### Error Path: Create Snapshot for Non-Active Company

```
PRECONDITION: Company exists but is in DRAFT or DISSOLVED status
ACTOR: ADMIN or FINANCE member
TRIGGER: User attempts to create a snapshot

1. [UI] User fills in snapshot form and submits
2. [Frontend] Sends POST /api/v1/companies/:companyId/cap-table/snapshot
3. [Backend] Finds company with status != ACTIVE
4. [Backend] Returns 422 with error code CAP_COMPANY_NOT_ACTIVE
5. [UI] Shows error toast using messageKey "errors.cap.companyNotActive"

POSTCONDITION: No snapshot created
SIDE EFFECTS: None
```

### Error Path: Snapshot Date in Future

```
PRECONDITION: Company is ACTIVE
ACTOR: ADMIN or FINANCE member
TRIGGER: User enters a future date for snapshot

1. [UI] User enters future date (e.g., 2099-12-31)
2. [Frontend] May catch client-side, otherwise sends POST
3. [Backend] Detects snapshotDate > current date
4. [Backend] Returns 422 with error code CAP_FUTURE_SNAPSHOT_DATE
5. [UI] Shows error toast: "Snapshot date cannot be in the future"

POSTCONDITION: No snapshot created
SIDE EFFECTS: None
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 3 | Auth check | No valid token | Error | 401, redirect to login |
| 4 | Role check | Not ADMIN/FINANCE/LEGAL | Error | 404 Not Found |
| 5 | Company exists | Company not found | Error | 404 Not Found |
| C1 | View toggle | view=fully-diluted | Alt | Delegates to getFullyDilutedCapTable |
| C2 | Share class filter | shareClassId provided | Filter | Filters shareholdings by share class |
| S1 | Company status | status != ACTIVE | Error | 422 CAP_COMPANY_NOT_ACTIVE |
| S2 | Future date | snapshotDate > now | Error | 422 CAP_FUTURE_SNAPSHOT_DATE |
| S3 | Date before creation | date < company.createdAt | Error | 422 CAP_NO_DATA_FOR_DATE |
| S4 | No snapshot found | No snapshot on/before date | Error | 404 Not Found |
| E1 | Export role | Role is LEGAL (no export) | Error | 404 Not Found |
| A1 | Auto-snapshot trigger | Cap-table-mutating event completes | System | recalculateOwnership + auto-snapshot |
| A2 | Snapshot creation | Snapshot write fails | System | Error logged, original operation unaffected |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| CapTableSnapshot | — | — | Created (id, data, stateHash, trigger='manual') | Manual snapshot creation |
| CapTableSnapshot | — | — | Created (id, data, stateHash, trigger=event type) | Auto-snapshot after transaction confirmed, round closed, exercise confirmed, or convertible converted |
| Shareholding | ownershipPct | Old value | Recalculated value | recalculateOwnership called (synchronous, inside $transaction) |
| Shareholding | votingPowerPct | Old value | Recalculated value | recalculateOwnership called (synchronous, inside $transaction) |

---

## By Role

| Action | ADMIN | FINANCE | LEGAL | INVESTOR |
|--------|-------|---------|-------|----------|
| View current cap table | Yes | Yes | Yes | No (404) |
| View fully-diluted | Yes | Yes | Yes | No (404) |
| Filter by share class | Yes | Yes | Yes | No (404) |
| View snapshot history | Yes | Yes | Yes | No (404) |
| View point-in-time snapshot | Yes | Yes | Yes | No (404) |
| Create snapshot | Yes | Yes | No (404) | No (404) |
| Export OCT | Yes | Yes | No (404) | No (404) |

---

## API Endpoints Summary

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | /api/v1/companies/:companyId/cap-table | ADMIN, FINANCE, LEGAL | Current cap table (supports ?view= and ?shareClassId=) |
| GET | /api/v1/companies/:companyId/cap-table/fully-diluted | ADMIN, FINANCE, LEGAL | Fully-diluted cap table with options |
| GET | /api/v1/companies/:companyId/cap-table/snapshot | ADMIN, FINANCE, LEGAL | Point-in-time snapshot (requires ?date=) |
| GET | /api/v1/companies/:companyId/cap-table/history | ADMIN, FINANCE, LEGAL | Paginated snapshot history |
| GET | /api/v1/companies/:companyId/cap-table/export/oct | ADMIN, FINANCE | OCT/OCF JSON export |
| POST | /api/v1/companies/:companyId/cap-table/snapshot | ADMIN, FINANCE | Create manual snapshot |
| GET | /api/v1/companies/:companyId/reports/cap-table/export | ADMIN, FINANCE, LEGAL | Async export (PDF, XLSX, CSV) |
| GET | /api/v1/companies/:companyId/reports/cap-table/export/:jobId | ADMIN, FINANCE, LEGAL | Poll export job status |

---

## Frontend Implementation

### Page: `/dashboard/cap-table`

**File**: `frontend/src/app/(dashboard)/dashboard/cap-table/page.tsx`

**Components**:
- Stat cards: Total Shares (active/highlighted), Shareholders, Share Classes, Option Pool
- Three-tab view: Current | Fully Diluted | History
- Current view: data table with shareholder name, type badge, share class (with type label), shares, ownership %, voting power, voting %, plus summary row
- Fully Diluted view: table with current shares, current %, vested options, unvested options, diluted shares, diluted %
- History view: paginated snapshot list (date, total shares, shareholders, trigger, notes, created at)
- Export dropdown: PDF, Excel, CSV, OCT JSON (triggers async export via Reports API)
- Share class filter dropdown (visible when 2+ classes)
- Ownership donut chart (reuses OwnershipChart component)
- Loading skeletons, empty states, no-company state

**Hooks** (`frontend/src/hooks/use-cap-table-page.ts`):
- `useCapTableCurrent(companyId, shareClassId?)` — 30s staleTime + refetchInterval
- `useCapTableFullyDiluted(companyId, enabled)` — lazy loading, only fetches when FD tab active
- `useCapTableHistory(companyId, { page, limit })` — paginated snapshot history
- `useExportCapTable(companyId)` — useMutation for async export trigger
- `useExportJobStatus(companyId, jobId)` — polls every 2s until COMPLETED/FAILED

**i18n**: `capTable.*` namespace (50+ keys in PT-BR and EN)
