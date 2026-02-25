# Shareholder Management — User Flows

**Feature**: Create, view, update, delete shareholders and manage beneficial owners for corporate shareholders
**Actors**: ADMIN (full CRUD + beneficial owners), FINANCE/LEGAL (read-only), LEGAL (foreign shareholder view)
**Preconditions**: User is authenticated, user is an ACTIVE member of the company
**Related Flows**: [Company Management](./company-management.md) (company must be ACTIVE for create), [Share Class Management](./share-class-management.md) (shareholdings reference share classes), [Authentication](./authentication.md) (user must be logged in)

---

## Flow Map

```
User navigates to Shareholders page
  │
  ├─ [role = ADMIN/FINANCE/LEGAL] ─→ GET /shareholders
  │     │
  │     ├─ [has shareholders] ─→ Display paginated list with status/type/search filters
  │     └─ [empty] ─→ Display empty state with "Add Shareholder" CTA (ADMIN only)
  │
  ├─ [ADMIN clicks "Add Shareholder"] ─→ Create flow (see below)
  │
  ├─ [any permitted role clicks a shareholder row] ─→ GET /shareholders/:id → Detail view
  │
  ├─ [ADMIN clicks "Edit" on a shareholder] ─→ Update flow (see below)
  │
  ├─ [ADMIN clicks "Delete" on a shareholder] ─→ Delete flow (see below)
  │
  ├─ [ADMIN/LEGAL clicks "Foreign Shareholders"] ─→ GET /shareholders/foreign → Summary view
  │
  └─ [ADMIN clicks "Manage Beneficial Owners" on CORPORATE shareholder] ─→ UBO flow (see below)


ADMIN clicks "Add Shareholder"
  │
  ├─ [valid form] ─→ POST /shareholders
  │     │
  │     ├─ [company ACTIVE + CPF/CNPJ valid + unique + type compatible] ─→ 201 Created (CPF encrypted via KMS)
  │     │
  │     ├─ [company not ACTIVE] ─→ 422 SHAREHOLDER_COMPANY_NOT_ACTIVE
  │     │
  │     ├─ [CPF/CNPJ format unrecognized] ─→ 422 SHAREHOLDER_INVALID_DOCUMENT
  │     │
  │     ├─ [CORPORATE type without CNPJ] ─→ 422 SHAREHOLDER_CORPORATE_NEEDS_CNPJ
  │     │
  │     ├─ [non-CORPORATE type without CPF] ─→ 422 SHAREHOLDER_INDIVIDUAL_NEEDS_CPF
  │     │
  │     ├─ [CPF check digits invalid] ─→ 422 SHAREHOLDER_INVALID_CPF
  │     │
  │     ├─ [CNPJ check digits invalid] ─→ 422 SHAREHOLDER_INVALID_CNPJ
  │     │
  │     ├─ [CPF/CNPJ already registered in company] ─→ 409 SHAREHOLDER_CPF_CNPJ_DUPLICATE
  │     │
  │     └─ [invalid RDE-IED date] ─→ 422 SHAREHOLDER_INVALID_RDE_DATE
  │
  └─ [invalid form] ─→ Client-side validation prevents submission


ADMIN clicks "Edit Shareholder"
  │
  ├─ [valid form] ─→ PUT /shareholders/:id
  │     │
  │     ├─ [all rules pass] ─→ 200 OK (isForeign auto-recalculated if taxResidency changed)
  │     │
  │     ├─ [shareholder not found] ─→ 404 Not Found
  │     │
  │     └─ [invalid RDE-IED date] ─→ 422 SHAREHOLDER_INVALID_RDE_DATE
  │
  └─ [no changes] ─→ Submit disabled


ADMIN clicks "Delete Shareholder"
  │
  ├─ [confirm dialog] ─→ DELETE /shareholders/:id
  │     │
  │     ├─ [no holdings or transactions] ─→ 200 { action: "DELETED" } (hard delete)
  │     │
  │     ├─ [has holdings or transactions] ─→ 200 { action: "INACTIVATED" } (soft delete)
  │     │
  │     ├─ [already inactive] ─→ 422 SHAREHOLDER_ALREADY_INACTIVE
  │     │
  │     └─ [not found] ─→ 404 Not Found
  │
  └─ [cancel] ─→ Dialog closed, no action


ADMIN clicks "Manage Beneficial Owners" (CORPORATE shareholder)
  │
  ├─ [valid form] ─→ POST /shareholders/:id/beneficial-owners
  │     │
  │     ├─ [CORPORATE + percentages ≤ 100% + at least one ≥ 25%] ─→ 200 OK
  │     │
  │     ├─ [shareholder not CORPORATE type] ─→ 422 SHAREHOLDER_NOT_CORPORATE
  │     │
  │     ├─ [percentages sum > 100%] ─→ 422 SHAREHOLDER_UBO_PERCENTAGES_EXCEED
  │     │
  │     └─ [no owner has ≥ 25%] ─→ 422 SHAREHOLDER_UBO_NO_QUALIFIED_OWNER
  │
  └─ [invalid form] ─→ Client-side validation prevents submission
```

---

## Flows

### Happy Path: Create Shareholder

```
PRECONDITION: Company is ACTIVE, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Add Shareholder" button

1. [UI] User navigates to /companies/:companyId/shareholders
2. [UI] User clicks "Add Shareholder" button
3. [UI] Form opens with fields: name, type (FOUNDER/INVESTOR/EMPLOYEE/ADVISOR/CORPORATE), cpfCnpj, email, phone, address, nationality, taxResidency, rdeIedNumber, rdeIedDate
4. [UI] Type dropdown determines CPF vs CNPJ expectation:
   - CORPORATE: CNPJ required (XX.XXX.XXX/XXXX-XX)
   - Others: CPF required (XXX.XXX.XXX-XX)
5. [UI] User fills in required fields and clicks "Save"
6. [Frontend] Validates input client-side
   → IF invalid: show field-level errors, STOP
7. [Frontend] Sends POST /api/v1/companies/:companyId/shareholders
8. [Backend] Validates authentication (AuthGuard)
   → IF unauthenticated: return 401, frontend redirects to login
9. [Backend] Validates authorization (RolesGuard: ADMIN)
   → IF not member or wrong role: return 404
10. [Backend] Validates request body (ValidationPipe)
    → IF invalid: return 400 with validationErrors
11. [Backend] Validates company is ACTIVE
    → IF not ACTIVE: return 422 SHAREHOLDER_COMPANY_NOT_ACTIVE
12. [Backend] Validates CPF/CNPJ format, checksum, and type compatibility
    → IF format invalid: return 422 SHAREHOLDER_INVALID_DOCUMENT
    → IF CORPORATE without CNPJ: return 422 SHAREHOLDER_CORPORATE_NEEDS_CNPJ
    → IF non-CORPORATE without CPF: return 422 SHAREHOLDER_INDIVIDUAL_NEEDS_CPF
    → IF CPF checksum fails: return 422 SHAREHOLDER_INVALID_CPF
    → IF CNPJ checksum fails: return 422 SHAREHOLDER_INVALID_CNPJ
13. [Backend] Computes blind index (HMAC-SHA256 with BLIND_INDEX_KEY) and checks uniqueness within the company
    → IF duplicate: return 409 SHAREHOLDER_CPF_CNPJ_DUPLICATE
14. [Backend] Auto-computes isForeign based on taxResidency (non-BR = true)
15. [Backend] Creates shareholder record
    - If document is a CPF: encrypts the value via AWS KMS, stores ciphertext in cpfCnpjEncrypted,
      and clears the plaintext cpfCnpj field. If KMS is unavailable, falls back to plaintext storage.
    - If document is a CNPJ: stores in plaintext cpfCnpj (public registry data per security.md, not encrypted)
16. [Backend] Returns 201 with created shareholder
17. [UI] Shows success toast
18. [UI] Shareholder list refreshes showing new entry

POSTCONDITION: New shareholder exists with ACTIVE status, isForeign auto-computed,
  CPF encrypted at rest (cpfCnpjEncrypted) with plaintext cleared, or CNPJ stored in plaintext
SIDE EFFECTS: Audit log (future: SHAREHOLDER_CREATED)
```

### Happy Path: List Shareholders

```
PRECONDITION: User is ACTIVE member with ADMIN, FINANCE, or LEGAL role
ACTOR: Any permitted member
TRIGGER: User navigates to shareholders page

1. [UI] User navigates to /companies/:companyId/shareholders
2. [Frontend] Sends GET /api/v1/companies/:companyId/shareholders?page=1&limit=20
3. [Backend] Validates auth and role (ADMIN, FINANCE, LEGAL)
4. [Backend] Returns paginated list with meta
5. [UI] Displays table with columns: name, type, status, email, cpfCnpj (masked), nationality
6. [UI] User can filter by status (ACTIVE/INACTIVE), type, isForeign, and search by name/email
7. [UI] User can sort by name, createdAt, type
8. [UI] User can paginate through results

POSTCONDITION: User sees shareholders for this company
```

### Happy Path: View Shareholder Detail

```
PRECONDITION: Shareholder exists, user has ADMIN, FINANCE, or LEGAL role
ACTOR: Any permitted member
TRIGGER: User clicks on a shareholder row

1. [UI] User clicks on shareholder row in list
2. [Frontend] Sends GET /api/v1/companies/:companyId/shareholders/:shareholderId
3. [Backend] Returns shareholder with shareholdings (including shareClass) and beneficialOwners
   - If the shareholder has an encrypted CPF (cpfCnpjEncrypted), it is transparently decrypted
     via AWS KMS and returned in the cpfCnpj response field
4. [UI] Displays shareholder profile: name, type badge, status badge, contact info
5. [UI] Displays holdings table: share class, quantity, percentage
6. [UI] For CORPORATE shareholders: displays beneficial owners section

POSTCONDITION: User sees full shareholder details
```

### Happy Path: Update Shareholder

```
PRECONDITION: Shareholder exists, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks edit on a shareholder

1. [UI] User clicks edit icon/button on a shareholder
2. [UI] Edit form opens with current values pre-filled
3. [UI] Only mutable fields are editable: email, phone, address, taxResidency, rdeIedNumber, rdeIedDate
4. [UI] Immutable fields shown as read-only: name, cpfCnpj, type
5. [UI] User modifies fields and clicks "Save"
6. [Frontend] Validates input client-side
7. [Frontend] Sends PUT /api/v1/companies/:companyId/shareholders/:shareholderId
8. [Backend] Validates auth, role, request body
9. [Backend] If taxResidency changed: recalculates isForeign
10. [Backend] If rdeIedDate provided: validates date format
    → IF invalid: return 422 SHAREHOLDER_INVALID_RDE_DATE
11. [Backend] Updates shareholder record
12. [Backend] Returns 200 with updated shareholder
13. [UI] Shows success toast, detail refreshes

POSTCONDITION: Shareholder updated, isForeign recalculated if taxResidency changed
SIDE EFFECTS: Audit log (future: SHAREHOLDER_UPDATED)
```

### Happy Path: Delete Shareholder (No Holdings)

```
PRECONDITION: Shareholder exists with no shareholdings or transactions, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks delete on a shareholder

1. [UI] User clicks delete icon on a shareholder
2. [UI] Confirmation dialog: "Are you sure you want to remove {name}?"
3. [UI] User clicks "Confirm"
4. [Frontend] Sends DELETE /api/v1/companies/:companyId/shareholders/:shareholderId
5. [Backend] Validates auth and role (ADMIN)
6. [Backend] Validates shareholder exists
   → IF not found: return 404
7. [Backend] Validates shareholder is not already INACTIVE
   → IF already inactive: return 422 SHAREHOLDER_ALREADY_INACTIVE
8. [Backend] Checks for existing shareholdings or transactions
9. [Backend] No references found → hard deletes shareholder record
10. [Backend] Returns 200 { action: "DELETED" }
11. [UI] Shows success toast: "Shareholder removed"
12. [UI] List refreshes

POSTCONDITION: Shareholder permanently deleted from database
SIDE EFFECTS: Audit log (future: SHAREHOLDER_DELETED)
```

### Alternative Path: Delete Shareholder (Has Holdings)

```
PRECONDITION: Shareholder exists with active shareholdings or transaction history
ACTOR: ADMIN member
TRIGGER: User clicks delete on a shareholder

1-8. [Same as delete happy path]
9. [Backend] References found → sets status to INACTIVE (soft delete)
10. [Backend] Returns 200 { action: "INACTIVATED" }
11. [UI] Shows info toast: "Shareholder inactivated (has existing holdings)"
12. [UI] List refreshes, shareholder now shows INACTIVE badge

POSTCONDITION: Shareholder status = INACTIVE, data preserved for historical records
SIDE EFFECTS: Audit log (future: SHAREHOLDER_DELETED with action: INACTIVATED)
```

### Happy Path: Set Beneficial Owners (CORPORATE Shareholder)

```
PRECONDITION: CORPORATE shareholder exists, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Manage Beneficial Owners" on a CORPORATE shareholder

1. [UI] User navigates to shareholder detail for a CORPORATE shareholder
2. [UI] User clicks "Manage Beneficial Owners"
3. [UI] Form displays list of beneficial owners (or empty if none set)
4. [UI] User adds owners with: name, cpf (optional), ownershipPercentage
5. [UI] At least one owner must have ≥ 25% ownership (AML requirement)
6. [UI] Total percentages must not exceed 100%
7. [UI] User clicks "Save"
8. [Frontend] Sends POST /api/v1/companies/:companyId/shareholders/:shareholderId/beneficial-owners
9. [Backend] Validates shareholder is CORPORATE type
   → IF not CORPORATE: return 422 SHAREHOLDER_NOT_CORPORATE
10. [Backend] Validates percentage sum ≤ 100%
    → IF exceeds: return 422 SHAREHOLDER_UBO_PERCENTAGES_EXCEED
11. [Backend] Validates at least one owner has ≥ 25%
    → IF none qualifies: return 422 SHAREHOLDER_UBO_NO_QUALIFIED_OWNER
12. [Backend] Atomically replaces all beneficial owners via $transaction
    (deletes existing, creates new — full replacement strategy)
13. [Backend] Returns 200 with new beneficial owners list
14. [UI] Shows success toast, beneficial owners section refreshes

POSTCONDITION: Beneficial owners replaced with new set, AML rules enforced
SIDE EFFECTS: Audit log (future: SHAREHOLDER_UPDATED with beneficial owners change)
```

### Happy Path: View Foreign Shareholders

```
PRECONDITION: User has ADMIN or LEGAL role
ACTOR: ADMIN or LEGAL member
TRIGGER: User clicks "Foreign Shareholders" tab/link

1. [UI] User clicks "Foreign Shareholders" link
2. [Frontend] Sends GET /api/v1/companies/:companyId/shareholders/foreign
3. [Backend] Returns foreign shareholders list with summary:
   - totalForeignShareholders count
   - totalForeignOwnershipPercentage
4. [UI] Displays foreign shareholders table
5. [UI] Displays summary card with totals

POSTCONDITION: User sees foreign shareholders and ownership summary
```

### Error Path: CPF/CNPJ Validation Failure

```
ACTOR: ADMIN member
TRIGGER: Attempts to create shareholder with invalid CPF/CNPJ

1-10. [Same as Create Happy Path steps 1-10]
11-12. [Backend validates company status — passes]
12. [Backend] Validates CPF/CNPJ:
    - No CPF/CNPJ provided + type is CORPORATE → 422 SHAREHOLDER_CORPORATE_NEEDS_CNPJ
    - No CPF/CNPJ provided + type is non-CORPORATE → 422 SHAREHOLDER_INDIVIDUAL_NEEDS_CPF
    - CPF/CNPJ format unrecognized (not 11 or 14 digits) → 422 SHAREHOLDER_INVALID_DOCUMENT
    - CPF Módulo 11 check digits wrong → 422 SHAREHOLDER_INVALID_CPF
    - CNPJ Módulo 11 check digits wrong → 422 SHAREHOLDER_INVALID_CNPJ
13. [UI] Shows error toast with localized message
14. [UI] Form remains open for correction

POSTCONDITION: No shareholder created
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 8 | Auth check | No valid token | Error | 401, redirect to login |
| 9 | Role check | Not ADMIN (for write ops) | Error | 404 Not Found |
| 9 | Role check | Not ADMIN/FINANCE/LEGAL (for read ops) | Error | 404 Not Found |
| 10 | Input validation | Invalid fields | Error | 400 + validationErrors |
| 11 | Company status | Company not ACTIVE | Error | 422 SHAREHOLDER_COMPANY_NOT_ACTIVE |
| 12 | Document format | CPF/CNPJ not recognized | Error | 422 SHAREHOLDER_INVALID_DOCUMENT |
| 12 | Type compatibility | CORPORATE without CNPJ | Error | 422 SHAREHOLDER_CORPORATE_NEEDS_CNPJ |
| 12 | Type compatibility | Non-CORPORATE without CPF | Error | 422 SHAREHOLDER_INDIVIDUAL_NEEDS_CPF |
| 12 | CPF checksum | Invalid check digits | Error | 422 SHAREHOLDER_INVALID_CPF |
| 12 | CNPJ checksum | Invalid check digits | Error | 422 SHAREHOLDER_INVALID_CNPJ |
| 13 | Uniqueness | CPF/CNPJ already in company | Error | 409 SHAREHOLDER_CPF_CNPJ_DUPLICATE |
| 7 (delete) | Holdings check | No holdings/transactions | Happy | Hard delete |
| 7 (delete) | Holdings check | Has holdings/transactions | Alternative | Soft delete (INACTIVE) |
| 7 (delete) | Status check | Already INACTIVE | Error | 422 SHAREHOLDER_ALREADY_INACTIVE |
| 9 (UBO) | Type check | Not CORPORATE | Error | 422 SHAREHOLDER_NOT_CORPORATE |
| 10 (UBO) | Percentage sum | > 100% | Error | 422 SHAREHOLDER_UBO_PERCENTAGES_EXCEED |
| 11 (UBO) | Qualified owner | None ≥ 25% | Error | 422 SHAREHOLDER_UBO_NO_QUALIFIED_OWNER |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| Shareholder | — | — | Created (ACTIVE) | ADMIN creates shareholder |
| Shareholder | email | X | Y | ADMIN updates email |
| Shareholder | taxResidency | X | Y | ADMIN updates tax residency |
| Shareholder | isForeign | auto | recalculated | taxResidency changes (auto) |
| Shareholder | status | ACTIVE | INACTIVE | ADMIN deletes (has holdings) |
| Shareholder | — | Exists | Deleted | ADMIN deletes (no holdings) |
| BeneficialOwner | — | Set A | Set B | ADMIN replaces UBO list (atomic) |

---

## By Role

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| List shareholders | Yes | Yes | Yes | No (404) | No (404) |
| View shareholder detail | Yes | Yes | Yes | No (404) | No (404) |
| Create shareholder | Yes | No (404) | No (404) | No (404) | No (404) |
| Update shareholder | Yes | No (404) | No (404) | No (404) | No (404) |
| Delete shareholder | Yes | No (404) | No (404) | No (404) | No (404) |
| View foreign shareholders | Yes | No (404) | Yes | No (404) | No (404) |
| Manage beneficial owners | Yes | No (404) | No (404) | No (404) | No (404) |
