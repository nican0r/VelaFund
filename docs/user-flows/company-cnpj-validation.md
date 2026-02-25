# Company CNPJ Validation — User Flows

**Feature**: Async CNPJ validation via Verifik API after company creation; transitions company from DRAFT to ACTIVE.
**Actors**: ADMIN (company creator), SYSTEM (Bull queue processor)
**Preconditions**: User is authenticated, has created a company (DRAFT status)
**Related Flows**: [Company Management](./company-management.md), [KYC Verification](./kyc-verification.md)

---

## Flow Map

```
User creates company (POST /api/v1/companies)
  │
  ├─ Company created in DRAFT status with cnpjData.validationStatus = PENDING
  │
  └─ Bull job dispatched: company-setup / validate-cnpj
        │
        ├─ [Verifik API call succeeds]
        │     │
        │     ├─ [CNPJ situacaoCadastral = ATIVA]
        │     │     │
        │     │     ├─ Company → ACTIVE, cnpjData.validationStatus = COMPLETED
        │     │     ├─ Audit log: COMPANY_CNPJ_VALIDATED + COMPANY_STATUS_CHANGED
        │     │     ├─ Notification: COMPANY_ACTIVATED sent to creator
        │     │     └─ Email: cnpj-validation-success sent to creator
        │     │
        │     └─ [CNPJ not ATIVA (BAIXADA, SUSPENSA, INAPTA, etc.)]
        │           │
        │           ├─ Company stays DRAFT, cnpjData.validationStatus = FAILED
        │           ├─ Audit log: COMPANY_CNPJ_VALIDATION_FAILED
        │           ├─ Notification: COMPANY_CNPJ_FAILED sent to creator
        │           └─ Email: cnpj-validation-failed sent to creator
        │
        └─ [Verifik API call fails (timeout, network error)]
              │
              ├─ [Attempts remaining] ─→ Bull retries (exponential backoff: 5s, 10s, 20s)
              │
              └─ [All 3 attempts exhausted]
                    │
                    ├─ Company stays DRAFT, cnpjData.validationStatus = FAILED
                    ├─ Audit log: COMPANY_CNPJ_VALIDATION_FAILED
                    ├─ Notification: COMPANY_CNPJ_FAILED sent to creator
                    └─ Email: cnpj-validation-failed sent to creator

User polls setup status (GET /api/v1/companies/:id/setup-status)
  │
  ├─ [PENDING] ─→ Show "Validating CNPJ..." spinner
  ├─ [COMPLETED] ─→ Show success, redirect to company dashboard
  └─ [FAILED] ─→ Show error with retry button

User retries validation (POST /api/v1/companies/:companyId/retry-validation)
  │
  ├─ [Company is DRAFT + validation FAILED] ─→ Reset to PENDING, dispatch new job
  ├─ [Company is not DRAFT] ─→ 422 COMPANY_NOT_DRAFT
  └─ [Validation is not FAILED] ─→ 422 COMPANY_CNPJ_NOT_FAILED

User updates CNPJ (PUT /api/v1/companies/:companyId with cnpj field)
  │
  ├─ [Company is DRAFT] ─→ Update CNPJ, reset cnpjData to PENDING
  └─ [Company is not DRAFT] ─→ 422 COMPANY_CNPJ_IMMUTABLE
```

---

## Flows

### Happy Path: Company Created and Activated via CNPJ Validation

PRECONDITION: User is authenticated
ACTOR: ADMIN (creator)
TRIGGER: User submits company creation form

1. [UI] User fills in company name, entity type, CNPJ
2. [UI] User clicks "Create Company"
3. [Frontend] Validates input client-side (CNPJ format)
   → IF invalid: show field-level errors, STOP
4. [Frontend] Sends POST /api/v1/companies
5. [Backend] Validates authentication
   → IF unauthenticated: return 401
6. [Backend] Validates request body (CNPJ format, Modulo 11 checksum)
   → IF invalid: return 400 / 422
7. [Backend] Creates company in DRAFT status with cnpjData = { validationStatus: "PENDING" }
8. [Backend] Auto-assigns creator as ADMIN member
9. [Backend] Dispatches Bull job: validate-cnpj on company-setup queue
10. [Backend] Returns 201 with company data
11. [UI] Redirects to setup status page, begins polling
12. [Frontend] Polls GET /api/v1/companies/:id/setup-status every 3-5 seconds
13. [System] Bull processor calls Verifik API to validate CNPJ
14. [System] Verifik confirms CNPJ is ATIVA
15. [System] Processor updates company: status → ACTIVE, cnpjData.validationStatus → COMPLETED
16. [System] Creates audit logs, sends notification and email
17. [UI] Poll response shows companyStatus = ACTIVE, cnpjValidation.status = COMPLETED
18. [UI] Shows success message, redirects to company dashboard

POSTCONDITION: Company is ACTIVE with validated CNPJ data stored
SIDE EFFECTS: 2 audit logs (CNPJ_VALIDATED + STATUS_CHANGED), 1 notification (COMPANY_ACTIVATED), 1 email (cnpj-validation-success)

### Error Path: CNPJ Not Active in Receita Federal

PRECONDITION: Company created in DRAFT status, validation job dispatched
ACTOR: SYSTEM
TRIGGER: Verifik API returns non-ATIVA status

1. [System] Bull processor calls Verifik API
2. [System] Verifik returns CNPJ with situacaoCadastral = "BAIXADA" (or SUSPENSA, INAPTA, etc.)
3. [System] Processor marks validation as FAILED in cnpjData
4. [System] Company stays in DRAFT status
5. [System] Creates audit log (COMPANY_CNPJ_VALIDATION_FAILED)
6. [System] Sends notification (COMPANY_CNPJ_FAILED) and failure email
7. [UI] Poll response shows cnpjValidation.status = FAILED with error details
8. [UI] Shows error: "CNPJ has status BAIXADA — expected ATIVA"
9. [UI] Shows "Update CNPJ and retry" button

POSTCONDITION: Company remains DRAFT, user informed of failure
SIDE EFFECTS: 1 audit log, 1 notification, 1 email

### Error Path: Verifik Service Unavailable

PRECONDITION: Company created in DRAFT status, validation job dispatched
ACTOR: SYSTEM
TRIGGER: Verifik API times out or returns error

1. [System] Bull processor calls Verifik API
2. [System] Verifik returns network error / timeout
3. [System] Bull retries with exponential backoff (5s → 10s → 20s)
4. [System] After 3 failed attempts, processor marks validation as FAILED
5. [System] Company stays in DRAFT status
6. [System] Creates audit log, sends notification and failure email
7. [UI] Poll response shows FAILED with error code COMPANY_CNPJ_VERIFIK_UNAVAILABLE
8. [UI] Shows "Validation service temporarily unavailable. Try again later."

POSTCONDITION: Company remains DRAFT, user can retry later
SIDE EFFECTS: 1 audit log, 1 notification, 1 email

### Alternative Path: User Retries CNPJ Validation

PRECONDITION: Company is DRAFT with cnpjData.validationStatus = FAILED
ACTOR: ADMIN
TRIGGER: User clicks "Retry Validation" button

1. [UI] User clicks "Retry Validation"
2. [Frontend] Sends POST /api/v1/companies/:companyId/retry-validation
3. [Backend] Validates user is ADMIN of this company
   → IF not ADMIN: return 404
4. [Backend] Validates company is in DRAFT status
   → IF not DRAFT: return 422 COMPANY_NOT_DRAFT
5. [Backend] Validates cnpjData.validationStatus is FAILED
   → IF not FAILED: return 422 COMPANY_CNPJ_NOT_FAILED
6. [Backend] Resets cnpjData to { validationStatus: "PENDING" }
7. [Backend] Dispatches new validate-cnpj job
8. [Backend] Returns 200 with success message
9. [UI] Resumes polling setup-status

POSTCONDITION: New validation job dispatched, cnpjData reset to PENDING
SIDE EFFECTS: Audit log (via @Auditable on endpoint)

### Alternative Path: User Updates CNPJ Before Retry

PRECONDITION: Company is DRAFT with failed or pending validation
ACTOR: ADMIN
TRIGGER: User corrects the CNPJ

1. [UI] User edits company CNPJ field
2. [Frontend] Sends PUT /api/v1/companies/:companyId with { cnpj: "new-cnpj" }
3. [Backend] Validates company is in DRAFT status
   → IF not DRAFT: return 422 COMPANY_CNPJ_IMMUTABLE
4. [Backend] Validates new CNPJ format and Modulo 11 checksum
   → IF invalid: return 422
5. [Backend] Updates company CNPJ, resets cnpjData to { validationStatus: "PENDING" }
6. [Backend] Returns 200 with updated company

POSTCONDITION: Company CNPJ updated, validation status reset. User should trigger retry.
SIDE EFFECTS: Audit log (COMPANY_UPDATED via @Auditable)

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 6 | CNPJ checksum | Invalid Modulo 11 | Error | 422 COMPANY_INVALID_CNPJ |
| 7 | CNPJ uniqueness | Duplicate in DB | Error | 409 COMPANY_CNPJ_DUPLICATE |
| 13 | Verifik API | Success + ATIVA | Happy | Company → ACTIVE |
| 13 | Verifik API | Success + not ATIVA | Error | Company stays DRAFT, FAILED |
| 13 | Verifik API | Network error | Error | Bull retries, then FAILED |
| 4 | Retry — company status | Not DRAFT | Error | 422 COMPANY_NOT_DRAFT |
| 5 | Retry — validation status | Not FAILED | Error | 422 COMPANY_CNPJ_NOT_FAILED |
| 3 | CNPJ update — status | Not DRAFT | Error | 422 COMPANY_CNPJ_IMMUTABLE |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| Company | cnpjData.validationStatus | — | PENDING | Company created |
| Company | cnpjData.validationStatus | PENDING | COMPLETED | Verifik confirms ATIVA |
| Company | cnpjData.validationStatus | PENDING | FAILED | Verifik confirms non-ATIVA or all retries exhausted |
| Company | status | DRAFT | ACTIVE | CNPJ validation succeeds |
| Company | cnpjValidatedAt | null | (timestamp) | CNPJ validation succeeds |
| Company | cnpjData.validationStatus | FAILED | PENDING | User triggers retry |
| Company | cnpjData.validationStatus | any | PENDING | User updates CNPJ in DRAFT |

---

## API Endpoints

| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| GET | /api/v1/companies/:companyId/setup-status | Poll CNPJ validation progress | 100/min (read) |
| POST | /api/v1/companies/:companyId/retry-validation | Retry failed CNPJ validation | 3/min |
