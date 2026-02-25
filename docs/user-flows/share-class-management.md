# Share Class Management — User Flows

**Feature**: Create, view, update, and delete share classes for a company's cap table
**Actors**: ADMIN (full CRUD), FINANCE/LEGAL/INVESTOR (read-only)
**Preconditions**: User is authenticated, user is an ACTIVE member of the company
**Related Flows**: [Company Management](./company-management.md) (company must be ACTIVE), [Authentication](./authentication.md) (user must be logged in)
**Implementation Status**: Backend complete, Frontend list page + create form complete (P4.6)

---

## Flow Map

```
User navigates to Share Classes page
  │
  ├─ [role = ADMIN/FINANCE/LEGAL/INVESTOR] ─→ GET /share-classes
  │     │
  │     ├─ [has share classes] ─→ Display paginated list with type filter and sort
  │     └─ [empty] ─→ Display empty state with "Create" CTA (ADMIN only)
  │
  ├─ [ADMIN clicks "Create Share Class"] ─→ Create flow (see below)
  │
  ├─ [ADMIN clicks "Edit" on a share class] ─→ Update flow (see below)
  │
  ├─ [ADMIN clicks "Delete" on a share class] ─→ Delete flow (see below)
  │
  └─ [any role clicks a share class row] ─→ GET /share-classes/:id → Detail view


ADMIN clicks "Create Share Class"
  │
  ├─ [valid form] ─→ POST /share-classes
  │     │
  │     ├─ [company ACTIVE + type compatible + name unique + within limits] ─→ 201 Created
  │     │
  │     ├─ [company not ACTIVE] ─→ 422 CAP_COMPANY_NOT_ACTIVE
  │     │
  │     ├─ [type incompatible with entity type] ─→ 422 CAP_INVALID_SHARE_CLASS_TYPE
  │     │     (Ltda can only have QUOTA; S.A. can only have COMMON_SHARES/PREFERRED_SHARES)
  │     │
  │     ├─ [duplicate className] ─→ 409 CAP_SHARE_CLASS_DUPLICATE
  │     │
  │     └─ [preferred shares exceed 2/3 of total] ─→ 422 CAP_PREFERRED_SHARE_LIMIT_EXCEEDED
  │
  └─ [invalid form] ─→ Client-side validation prevents submission


ADMIN clicks "Edit Share Class"
  │
  ├─ [valid form] ─→ PUT /share-classes/:id
  │     │
  │     ├─ [all rules pass] ─→ 200 OK
  │     │
  │     ├─ [totalAuthorized decreased] ─→ 422 CAP_TOTAL_AUTHORIZED_CANNOT_DECREASE
  │     │
  │     ├─ [totalAuthorized < totalIssued] ─→ 422 CAP_INVALID_TOTAL_AUTHORIZED
  │     │
  │     └─ [preferred limit exceeded after increase] ─→ 422 CAP_PREFERRED_SHARE_LIMIT_EXCEEDED
  │
  └─ [no changes] ─→ Submit disabled


ADMIN clicks "Delete Share Class"
  │
  ├─ [confirm dialog] ─→ DELETE /share-classes/:id
  │     │
  │     ├─ [totalIssued = 0, no active shareholdings] ─→ 204 No Content
  │     │
  │     ├─ [shares issued or active shareholdings exist] ─→ 422 CAP_SHARE_CLASS_IN_USE
  │     │
  │     └─ [not found] ─→ 404 Not Found
  │
  └─ [cancel] ─→ Dialog closed, no action
```

---

## Flows

### Happy Path: Create Share Class (Frontend implemented)

```
PRECONDITION: Company is ACTIVE, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "New Class" link button on share classes list page

1. [UI] User navigates to /dashboard/share-classes
2. [UI] User clicks "New Class" link in page header
3. [UI] Browser navigates to /dashboard/share-classes/new
4. [UI] Create form renders with three sections:
   a. Type Selection: clickable type cards filtered by company entityType
      - LTDA companies: QUOTA card only
      - S.A. companies: COMMON_SHARES and PREFERRED_SHARES cards
   b. Basic Info: className (text, required, max 100 chars), totalAuthorized (number, required, positive)
   c. Voting Rights: votesPerShare (number, required)
      → IF PREFERRED_SHARES selected: votesPerShare forced to 0 and input disabled
   d. Liquidation Preferences (PREFERRED_SHARES only): liquidationPreferenceMultiple, participatingRights checkbox
   e. Transfer Restrictions: rightOfFirstRefusal checkbox, lockUpPeriodMonths, tagAlongPercentage
5. [UI] User selects share class type by clicking a type card
6. [UI] User fills in required fields
7. [UI] User clicks "Create Share Class" submit button
8. [Frontend] Validates input client-side:
   → IF className empty: show "This field is required" error, STOP
   → IF totalAuthorized empty: show "This field is required" error, STOP
   → IF className > 100 chars: show max length error, STOP
   → IF totalAuthorized ≤ 0: show "Must be greater than zero" error, STOP
9. [Frontend] Sends POST /api/v1/companies/:companyId/share-classes via useCreateShareClass mutation
10. [Backend] Validates authentication (AuthGuard)
    → IF unauthenticated: return 401, frontend redirects to login
11. [Backend] Validates authorization (RolesGuard: ADMIN)
    → IF not member or wrong role: return 404
12. [Backend] Validates request body (ValidationPipe)
    → IF invalid: return 400 with validationErrors
13. [Backend] Validates company is ACTIVE
    → IF not ACTIVE: return 422 CAP_COMPANY_NOT_ACTIVE
14. [Backend] Validates share class type compatible with company entity type
    → IF incompatible: return 422 CAP_INVALID_SHARE_CLASS_TYPE
15. [Backend] For PREFERRED_SHARES: validates 2/3 limit (Art. 15 §2)
    → IF exceeds: return 422 CAP_PREFERRED_SHARE_LIMIT_EXCEEDED
16. [Backend] Creates share class record
    → IF duplicate className: return 409 CAP_SHARE_CLASS_DUPLICATE
17. [Backend] Returns 201 with created share class
18. [Frontend] useCreateShareClass onSuccess invalidates shareClasses query cache
19. [UI] Shows success toast via sonner
20. [UI] Router navigates back to /dashboard/share-classes (list refreshes with new entry)

POSTCONDITION: New share class exists with totalIssued = 0
SIDE EFFECTS: Audit log (SHARE_CLASS_CREATED), TanStack Query cache invalidation
```

### Happy Path: List Share Classes (Frontend implemented)

```
PRECONDITION: User is ACTIVE member with ADMIN, FINANCE, LEGAL, or INVESTOR role
ACTOR: Any permitted member
TRIGGER: User clicks "Share Classes" in sidebar navigation

1. [UI] User clicks "Share Classes" nav item (Layers icon) in sidebar
2. [UI] Page renders at /dashboard/share-classes
3. [Frontend] CompanyProvider supplies selectedCompany context
   → IF no company selected: show empty state "No share classes found"
4. [Frontend] useShareClasses(companyId, { page, limit, type }) fires TanStack Query
   → While loading: render skeleton placeholders (pulse animation)
   → IF error: show error message from API
5. [UI] Page header: "Share Classes" title + description + "New Class" link button
6. [UI] 4 stat cards displayed:
   - Total Classes (highlighted with ocean-600 bg): count of all share classes
   - Issued: sum of all totalIssued (pt-BR formatted)
   - Available: sum of (totalAuthorized - totalIssued) (pt-BR formatted)
   - Preferred: count of PREFERRED_SHARES type classes
7. [UI] Type filter dropdown: All types / Quotas / Common Shares / Preferred Shares
   → Filter change updates useShareClasses params, triggers re-fetch
8. [UI] Data table with 8 columns:
   - Name (link text to /dashboard/share-classes/:id)
   - Type (color-coded badge: QUOTA=blue, COMMON=green, PREFERRED=cream)
   - Votes/Share (numeric)
   - Authorized (pt-BR formatted number)
   - Issued (pt-BR formatted number)
   - % Issued (percentage with comma decimal: e.g., "60,0%")
   - Lock-up (months or "None")
   - Actions (Edit link icon + Delete button)
9. [UI] Delete button disabled for classes with totalIssued > 0 (tooltip explains)
10. [UI] Pagination shown when totalPages > 1 (Previous/Next + page indicator)

POSTCONDITION: User sees paginated share classes with stats and type filter
```

### Happy Path: Update Share Class

```
PRECONDITION: Share class exists, company is ACTIVE, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks edit on a share class

1. [UI] User clicks edit icon/button on a share class row
2. [UI] Edit form opens with current values pre-filled
3. [UI] Only mutable fields are editable: totalAuthorized, lockUpPeriodMonths, tagAlongPercentage, rightOfFirstRefusal
4. [UI] User modifies fields and clicks "Save"
5. [Frontend] Validates input client-side
6. [Frontend] Sends PUT /api/v1/companies/:companyId/share-classes/:id
7. [Backend] Validates auth, role, request body
8. [Backend] Validates company is ACTIVE
9. [Backend] If totalAuthorized changed:
   → IF decreased: return 422 CAP_TOTAL_AUTHORIZED_CANNOT_DECREASE
   → IF new value < totalIssued: return 422 CAP_INVALID_TOTAL_AUTHORIZED
   → IF PREFERRED and new total exceeds 2/3: return 422 CAP_PREFERRED_SHARE_LIMIT_EXCEEDED
10. [Backend] Updates share class record
11. [Backend] Returns 200 with updated share class
12. [UI] Shows success toast, list refreshes

POSTCONDITION: Share class updated with new values
SIDE EFFECTS: Audit log (future: SHARE_CLASS_UPDATED)
```

### Happy Path: Delete Share Class

```
PRECONDITION: Share class exists, no shares issued, no active shareholdings, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks delete on a share class

1. [UI] User clicks delete icon on a share class row
2. [UI] Confirmation dialog: "Are you sure you want to delete {className}?"
3. [UI] User clicks "Confirm"
4. [Frontend] Sends DELETE /api/v1/companies/:companyId/share-classes/:id
5. [Backend] Validates auth and role (ADMIN)
6. [Backend] Validates share class exists
   → IF not found: return 404
7. [Backend] Validates totalIssued = 0
   → IF shares issued: return 422 CAP_SHARE_CLASS_IN_USE
8. [Backend] Validates no active shareholdings exist
   → IF active shareholdings: return 422 CAP_SHARE_CLASS_IN_USE
9. [Backend] Deletes share class record
10. [Backend] Returns 204 No Content
11. [UI] Shows success toast, list refreshes

POSTCONDITION: Share class deleted from database
SIDE EFFECTS: Audit log (future: SHARE_CLASS_DELETED)
```

### Error Path: Type Incompatible with Company Entity Type

```
ACTOR: ADMIN member
TRIGGER: Attempts to create COMMON_SHARES for a Ltda company (or QUOTA for an S.A.)

1-7. [Same as Create Happy Path steps 1-7]
8-10. [Same auth/validation steps]
11. [Backend] Checks company.entityType:
    - Ltda company + type COMMON_SHARES → 422 CAP_INVALID_SHARE_CLASS_TYPE
    - S.A. company + type QUOTA → 422 CAP_INVALID_SHARE_CLASS_TYPE
12. [UI] Shows error toast with localized message
13. [UI] Form remains open for correction

POSTCONDITION: No share class created
```

### Error Path: Preferred Share 2/3 Limit Exceeded

```
ACTOR: ADMIN member
TRIGGER: Attempts to create/increase preferred shares beyond 2/3 of total capital

1-7. [Same as Create/Update Happy Path steps]
8-12. [Backend validates]
13. [Backend] Sums all share classes:
    - totalPreferred = sum of PREFERRED_SHARES totalAuthorized (including new/updated)
    - totalAll = sum of ALL share class totalAuthorized (including new/updated)
    - If totalPreferred > (2/3 * totalAll): return 422 CAP_PREFERRED_SHARE_LIMIT_EXCEEDED
14. [UI] Shows error toast: "Preferred shares cannot exceed 2/3 of total authorized capital (Brazilian Corp Law Art. 15 §2)"

POSTCONDITION: No share class created/updated
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 8 | Auth check | No valid token | Error | 401, redirect to login |
| 9 | Role check | Not ADMIN (for write ops) | Error | 404 Not Found |
| 9 | Role check | Not ADMIN/FINANCE/LEGAL/INVESTOR (read) | Error | 404 Not Found |
| 10 | Input validation | Invalid fields | Error | 400 + validationErrors |
| 11 | Company status | Company not ACTIVE | Error | 422 CAP_COMPANY_NOT_ACTIVE |
| 12 | Type compatibility | Ltda + non-QUOTA | Error | 422 CAP_INVALID_SHARE_CLASS_TYPE |
| 12 | Type compatibility | S.A. + QUOTA | Error | 422 CAP_INVALID_SHARE_CLASS_TYPE |
| 13 | Preferred limit | Preferred > 2/3 total | Error | 422 CAP_PREFERRED_SHARE_LIMIT_EXCEEDED |
| 14 | Unique constraint | Duplicate className | Error | 409 CAP_SHARE_CLASS_DUPLICATE |
| 9 (update) | Authorized decrease | totalAuthorized lowered | Error | 422 CAP_TOTAL_AUTHORIZED_CANNOT_DECREASE |
| 9 (update) | Below issued | totalAuthorized < totalIssued | Error | 422 CAP_INVALID_TOTAL_AUTHORIZED |
| 7 (delete) | Shares in use | totalIssued > 0 or active shareholdings | Error | 422 CAP_SHARE_CLASS_IN_USE |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| ShareClass | — | — | Created (totalIssued=0) | ADMIN creates share class |
| ShareClass | totalAuthorized | X | Y (Y > X) | ADMIN increases authorized |
| ShareClass | lockUpPeriodMonths | X | Y | ADMIN updates lock-up |
| ShareClass | tagAlongPercentage | X | Y | ADMIN updates tag-along |
| ShareClass | rightOfFirstRefusal | X | Y | ADMIN updates ROFR |
| ShareClass | — | Exists | Deleted | ADMIN deletes (if unused) |

---

## By Role

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| List share classes | Yes | Yes | Yes | Yes | No (404) |
| View share class detail | Yes | Yes | Yes | Yes | No (404) |
| Create share class | Yes | No (404) | No (404) | No (404) | No (404) |
| Update share class | Yes | No (404) | No (404) | No (404) | No (404) |
| Delete share class | Yes | No (404) | No (404) | No (404) | No (404) |
