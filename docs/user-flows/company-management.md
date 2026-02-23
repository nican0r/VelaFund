# Company Management — User Flows

**Feature**: Create, view, update, deactivate, and dissolve companies
**Actors**: Authenticated user (any role), ADMIN member
**Preconditions**: User is authenticated (valid session)
**Related Flows**: [Authentication](./authentication.md) (requires auth), [Member Invitation](./member-invitation.md) (after company created)

---

## Flow Map

```
Authenticated user
  │
  ├─ "Create Company"
  │     │
  │     ├─ [invalid form data] ─→ Client-side validation prevents submission
  │     │
  │     └─ [valid form data] ─→ POST /api/v1/companies
  │           │
  │           ├─ [CNPJ format invalid (regex)] ─→ 400 VAL_INVALID_INPUT
  │           ├─ [CNPJ checksum invalid (Módulo 11)] ─→ 422 COMPANY_INVALID_CNPJ
  │           ├─ [CNPJ already registered] ─→ 409 COMPANY_CNPJ_DUPLICATE
  │           ├─ [user at 20 company limit] ─→ 422 COMPANY_MEMBERSHIP_LIMIT
  │           ├─ [foundedDate in future] ─→ 422 COMPANY_FUTURE_DATE
  │           ├─ [foundedDate not parseable] ─→ 422 COMPANY_INVALID_DATE
  │           │
  │           └─ [all valid] ─→ Company created (DRAFT) + user assigned as ADMIN
  │                 │
  │                 └─ [future: CNPJ validated via Verifik] ─→ Company → ACTIVE
  │
  ├─ "List My Companies"
  │     │
  │     └─ GET /api/v1/companies ─→ Paginated list with role + member count
  │           │
  │           ├─ [has companies] ─→ Display company cards with status badges
  │           └─ [no companies] ─→ Empty state with "Create Company" CTA
  │
  ├─ "View Company" (any member)
  │     │
  │     └─ GET /api/v1/companies/:companyId
  │           │
  │           ├─ [user is active member] ─→ RolesGuard passes ─→ Company details shown
  │           └─ [user is not member] ─→ 404 Not Found (prevents enumeration)
  │
  ├─ "Update Company" (ADMIN only)
  │     │
  │     └─ PUT /api/v1/companies/:companyId
  │           │
  │           ├─ [user is not ADMIN] ─→ 404 Not Found
  │           ├─ [company is DISSOLVED] ─→ 422 COMPANY_CANNOT_UPDATE_DISSOLVED
  │           └─ [valid update] ─→ Company updated
  │
  ├─ "Change Status" (ADMIN only)
  │     │
  │     └─ PATCH /api/v1/companies/:companyId/status
  │           │
  │           ├─ [ACTIVE → INACTIVE] ─→ Company deactivated
  │           ├─ [INACTIVE → ACTIVE] ─→ Company reactivated
  │           ├─ [DRAFT → any] ─→ 422 COMPANY_INVALID_STATUS_TRANSITION
  │           ├─ [DISSOLVED → any] ─→ 422 COMPANY_CANNOT_UPDATE_DISSOLVED
  │           └─ [same → same] ─→ 422 COMPANY_INVALID_STATUS_TRANSITION
  │
  └─ "Dissolve Company" (ADMIN only)
        │
        └─ DELETE /api/v1/companies/:companyId
              │
              ├─ [has active shareholders] ─→ 422 COMPANY_HAS_ACTIVE_SHAREHOLDERS
              ├─ [has active funding rounds] ─→ 422 COMPANY_HAS_ACTIVE_ROUNDS
              ├─ [already dissolved] ─→ 422 COMPANY_ALREADY_DISSOLVED
              └─ [no blockers] ─→ Company status → DISSOLVED (permanent, 204 No Content)
```

---

## Flows

### Happy Path: Create Company

```
PRECONDITION: User is authenticated
ACTOR: Any authenticated user
TRIGGER: User clicks "Create Company" button

1.  [UI] User navigates to company creation form
2.  [UI] User fills in: name (required), entity type (required), CNPJ (required)
    Optional: description, founded date, default currency, fiscal year end, timezone, locale
3.  [UI] User clicks "Create"
4.  [Frontend] Validates input client-side (CNPJ format regex, required fields)
    → IF invalid: show field-level errors, STOP
5.  [Frontend] Sends POST /api/v1/companies
6.  [Backend] AuthGuard verifies session cookie / Bearer token
    → IF unauthenticated: return 401
7.  [Backend] ValidationPipe validates request body (class-validator)
    → IF invalid: return 400 VAL_INVALID_INPUT with validationErrors array
8.  [Backend] CompanyService.create() validates CNPJ checksum (Módulo 11)
    → IF invalid checksum: return 422 COMPANY_INVALID_CNPJ
9.  [Backend] Validates foundedDate if provided
    → IF unparseable: return 422 COMPANY_INVALID_DATE
    → IF future date: return 422 COMPANY_FUTURE_DATE
10. [Backend] Checks user's membership count (max 20)
    → IF at limit: return 422 COMPANY_MEMBERSHIP_LIMIT
11. [Backend] Opens $transaction: creates Company + CompanyMember atomically
    → IF CNPJ already exists (P2002): return 409 COMPANY_CNPJ_DUPLICATE
12. [Backend] Returns 201 with company data
13. [UI] Shows success toast
14. [UI] Navigates to company detail page

POSTCONDITION: Company exists with status DRAFT. User is ADMIN member.
SIDE EFFECTS: None yet (audit logging planned)
```

### Happy Path: List My Companies

```
PRECONDITION: User is authenticated
ACTOR: Any authenticated user
TRIGGER: User navigates to companies page

1. [UI] User navigates to /companies
2. [Frontend] Sends GET /api/v1/companies?page=1&limit=20
3. [Backend] AuthGuard verifies session
4. [Backend] CompanyService.findAllForUser() queries CompanyMember with company join
5. [Backend] Enriches with member counts via groupBy
6. [Backend] Returns 200 with paginated response { success, data, meta }
7. [UI] Renders company cards with: name, CNPJ, status badge, user role, member count

POSTCONDITION: None (read-only)
```

### Happy Path: Update Company

```
PRECONDITION: User is ADMIN member of the company, company is not DISSOLVED
ACTOR: ADMIN member
TRIGGER: User clicks "Save" on company settings

1.  [UI] User navigates to company settings page
2.  [UI] User modifies fields (name, description, logo, currency, etc.)
3.  [UI] User clicks "Save"
4.  [Frontend] Sends PUT /api/v1/companies/:companyId
5.  [Backend] AuthGuard verifies session
6.  [Backend] RolesGuard checks user is ADMIN for this company
    → IF not ADMIN: return 404 Not Found
7.  [Backend] CompanyService.update() checks company is not DISSOLVED
    → IF DISSOLVED: return 422 COMPANY_CANNOT_UPDATE_DISSOLVED
8.  [Backend] Applies partial update (only provided fields)
9.  [Backend] Returns 200 with updated company
10. [UI] Shows success toast

POSTCONDITION: Company details updated
SIDE EFFECTS: None yet (audit logging planned)
```

### Happy Path: Dissolve Company

```
PRECONDITION: User is ADMIN, company has no active shareholders or funding rounds
ACTOR: ADMIN member
TRIGGER: User clicks "Dissolve Company" and confirms

1.  [UI] User navigates to company settings → danger zone
2.  [UI] User clicks "Dissolve Company"
3.  [UI] Confirmation dialog shown (irreversible action warning)
4.  [UI] User confirms
5.  [Frontend] Sends DELETE /api/v1/companies/:companyId
6.  [Backend] AuthGuard verifies session
7.  [Backend] RolesGuard checks user is ADMIN
8.  [Backend] CompanyService.dissolve() checks prerequisites:
    → IF already DISSOLVED: return 422 COMPANY_ALREADY_DISSOLVED
    → IF active shareholders > 0: return 422 COMPANY_HAS_ACTIVE_SHAREHOLDERS
    → IF active funding rounds > 0: return 422 COMPANY_HAS_ACTIVE_ROUNDS
9.  [Backend] Updates company status to DISSOLVED
10. [Backend] Returns 204 No Content
11. [UI] Shows success toast
12. [UI] Navigates to companies list

POSTCONDITION: Company status is DISSOLVED (permanent, read-only)
SIDE EFFECTS: None yet (audit logging planned)
```

### Error Path: CNPJ Already Registered

```
PRECONDITION: User submits company creation with a CNPJ that exists in the system
ACTOR: Any authenticated user

1-5. (Same as Happy Path: Create Company steps 1-5)
6-10. (Validation passes)
11. [Backend] $transaction: company.create throws P2002 (unique constraint)
12. [Backend] Catches P2002, throws 409 COMPANY_CNPJ_DUPLICATE
13. [UI] Shows error on CNPJ field: "CNPJ já cadastrado" / "CNPJ already registered"
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 4 | Client validation | Form invalid | Error | Field-level errors shown |
| 7 | Server validation | Body invalid (types, format) | Error | 400 VAL_INVALID_INPUT |
| 8 | CNPJ checksum | Módulo 11 fails | Error | 422 COMPANY_INVALID_CNPJ |
| 9 | Founded date | Unparseable or future | Error | 422 COMPANY_INVALID_DATE / FUTURE_DATE |
| 10 | Membership limit | Count >= 20 | Error | 422 COMPANY_MEMBERSHIP_LIMIT |
| 11 | CNPJ uniqueness | P2002 constraint | Error | 409 COMPANY_CNPJ_DUPLICATE |
| 6 (view) | RolesGuard | Not a member | Error | 404 Not Found |
| 7 (update) | Company status | DISSOLVED | Error | 422 COMPANY_CANNOT_UPDATE_DISSOLVED |
| 8 (dissolve) | Prerequisites | Active shareholders/rounds | Error | 422 COMPANY_HAS_ACTIVE_* |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| Company | status | — | DRAFT | Company created |
| Company | status | DRAFT | ACTIVE | CNPJ validated via Verifik (future) |
| Company | status | ACTIVE | INACTIVE | Admin deactivates |
| Company | status | INACTIVE | ACTIVE | Admin reactivates |
| Company | status | ACTIVE/INACTIVE/DRAFT | DISSOLVED | Admin dissolves (permanent) |
| CompanyMember | — | — | (created, role=ADMIN, status=ACTIVE) | Creator auto-assigned on company creation |

### Status State Machine

```
  ┌─────────┐   CNPJ validated   ┌──────────┐
  │  DRAFT  │ ─────────────────→ │  ACTIVE  │
  └─────────┘                    └──────────┘
       │                           ↑      │
       │                  reactivate│      │deactivate
       │                           │      ↓
       │                         ┌──────────┐
       │                         │ INACTIVE  │
       │                         └──────────┘
       │                              │
       │         dissolve             │ dissolve
       └──────────────────→ ┌──────────┐ ←────┘
                            │ DISSOLVED │ (permanent, read-only)
                            └──────────┘
```

---

## By Role

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE | Unauthenticated |
|--------|-------|---------|-------|----------|----------|-----------------|
| Create company | Yes | Yes | Yes | Yes | Yes | No (401) |
| List own companies | Yes | Yes | Yes | Yes | Yes | No (401) |
| View company detail | Yes | Yes | Yes | Yes | Yes | No (401) |
| Update company | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |
| Change status | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |
| Dissolve company | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |

Note: Non-members receive 404 (not 403) to prevent company enumeration per security.md.

---

## API Endpoints Summary

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/api/v1/companies` | Required | Any authenticated | Create company |
| GET | `/api/v1/companies` | Required | Any authenticated | List user's companies |
| GET | `/api/v1/companies/:companyId` | Required | Any member | Company details |
| PUT | `/api/v1/companies/:companyId` | Required | ADMIN | Update company |
| PATCH | `/api/v1/companies/:companyId/status` | Required | ADMIN | Change status |
| DELETE | `/api/v1/companies/:companyId` | Required | ADMIN | Dissolve company |

---

**Depends on**: [Authentication](./authentication.md) — user must be logged in
**Feeds into**: [Member Invitation](./member-invitation.md) — after company exists, admin can invite members
**Triggers**: [CNPJ Validation](./cnpj-validation.md) — async, after company created (future)
