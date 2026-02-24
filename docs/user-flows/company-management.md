# Company Management — User Flows

**Feature**: Create, view, update, deactivate, and dissolve companies
**Actors**: Authenticated user (any role), ADMIN member
**Preconditions**: User is authenticated (valid session)
**Related Flows**: [Authentication](./authentication.md) (requires auth), [Member Invitation](./member-invitation.md) (after company created)

**MVP Constraint**: One company per user. Company creation happens during onboarding (Step 2 of the wizard). There is no company list page, no company switcher, and no multi-company navigation.

---

## Flow Map

```
Authenticated user (onboarding)
  |
  +-- Step 2: "Create Company" (onboarding wizard)
  |     |
  |     +-- [invalid form data] --> Client-side validation prevents submission
  |     |     +-- [CNPJ checksum fail] --> inline error on CNPJ field
  |     |     +-- [required fields missing] --> field-level errors
  |     |     +-- [foundedDate in future] --> field error on date
  |     |
  |     +-- [valid form data] --> POST /api/v1/companies
  |           |
  |           +-- [CNPJ format invalid (regex)] --> 400 VAL_INVALID_INPUT
  |           +-- [CNPJ checksum invalid (Modulo 11)] --> 422 COMPANY_INVALID_CNPJ
  |           +-- [CNPJ already registered] --> 409 COMPANY_CNPJ_DUPLICATE --> inline error on CNPJ
  |           +-- [user at 20 company limit] --> 422 COMPANY_MEMBERSHIP_LIMIT
  |           +-- [foundedDate in future] --> 422 COMPANY_FUTURE_DATE
  |           +-- [foundedDate not parseable] --> 422 COMPANY_INVALID_DATE
  |           |
  |           +-- [all valid] --> Company created (DRAFT) + user assigned as ADMIN
  |                 |
  |                 +-- redirect to /dashboard
  |                 +-- CompanySetupProgress card shows on dashboard
  |                       |
  |                       +-- [CNPJ validated + contract deployed] --> Company --> ACTIVE
  |                       +-- [CNPJ or contract fails] --> retry buttons shown
  |
  +-- (after onboarding) "View/Edit Company Settings"
  |     |
  |     +-- /dashboard/settings
  |           |
  |           +-- [ADMIN] --> editable form + danger zone
  |           +-- [non-ADMIN] --> read-only view
  |
  +-- (ADMIN only) "Update Company"
  |     |
  |     +-- PUT /api/v1/companies/:companyId
  |           |
  |           +-- [user is not ADMIN] --> 404 Not Found
  |           +-- [company is DISSOLVED] --> 422 COMPANY_CANNOT_UPDATE_DISSOLVED
  |           +-- [valid update] --> Company updated, success toast
  |
  +-- (ADMIN only) "Change Status"
  |     |
  |     +-- PATCH /api/v1/companies/:companyId/status
  |           |
  |           +-- [ACTIVE --> INACTIVE] --> Company deactivated
  |           +-- [INACTIVE --> ACTIVE] --> Company reactivated
  |           +-- [DRAFT --> any] --> 422 COMPANY_INVALID_STATUS_TRANSITION
  |           +-- [DISSOLVED --> any] --> 422 COMPANY_CANNOT_UPDATE_DISSOLVED
  |           +-- [same --> same] --> 422 COMPANY_INVALID_STATUS_TRANSITION
  |
  +-- (ADMIN only) "Dissolve Company"
        |
        +-- Settings danger zone --> CompanyDissolutionDialog
              |
              +-- [prerequisites not met] --> shows blocker list, cannot proceed
              +-- [prerequisites met] --> name confirmation
                    |
                    +-- POST /api/v1/companies/:companyId/dissolve
                          |
                          +-- [has active shareholders] --> 422 COMPANY_HAS_ACTIVE_SHAREHOLDERS
                          +-- [has active funding rounds] --> 422 COMPANY_HAS_ACTIVE_ROUNDS
                          +-- [already dissolved] --> 422 COMPANY_ALREADY_DISSOLVED
                          +-- [no blockers] --> Company status --> DISSOLVED (permanent, read-only)
```

---

## Flows

### Happy Path: Create Company (Onboarding Step 2)

```
PRECONDITION: User completed Step 1 (Personal Info), AuthContext.needsOnboarding = true
ACTOR: Founder / new user
TRIGGER: Step 1 completion advances wizard to Step 2

1.  [UI] OnboardingWizard renders Step 2 (CompanyCreationStep)
    - Stepper: "Suas Informacoes" [complete, green check] -> "Sua Empresa" [active, blue dot]
2.  [UI] User fills company name (text input, required, 2-200 chars)
3.  [UI] User selects entity type from EntityTypeSelector (3 radio cards: LTDA, SA Fechado, SA Aberto)
4.  [UI] User types CNPJ digits into CNPJInput (auto-masks as XX.XXX.XXX/XXXX-XX)
5.  [Frontend] On CNPJ blur: validates Modulo 11 checksum (both verification digits)
    -> IF invalid: show inline error "CNPJ invalido" below CNPJ field, STOP
6.  [UI] User optionally fills description textarea (max 2000 chars)
7.  [UI] User optionally selects founded date from date picker (DD/MM/YYYY format)
8.  [UI] User clicks "Criar Empresa" (primary button, full width)
9.  [Frontend] Zod schema validates all fields client-side
    -> IF name too short/long: field error on name
    -> IF entityType not selected: field error on entity type
    -> IF CNPJ empty or invalid: field error on CNPJ
    -> IF foundedDate in future: field error on date
    -> IF any errors: show field-level errors, STOP
10. [Frontend] Sets submitting state: button shows spinner + "Criando...", all fields disabled
11. [Frontend] Sends POST /api/v1/companies with { name, entityType, cnpj, description, foundedDate }
12. [Backend] AuthGuard verifies Privy JWT
    -> IF unauthenticated: return 401, frontend redirects to /login
13. [Backend] ValidationPipe validates request body (class-validator)
    -> IF invalid: return 400 VAL_INVALID_INPUT with validationErrors array
14. [Backend] CompanyService.create() validates CNPJ checksum (Modulo 11)
    -> IF invalid checksum: return 422 COMPANY_INVALID_CNPJ
15. [Backend] Validates foundedDate if provided
    -> IF unparseable: return 422 COMPANY_INVALID_DATE
    -> IF future date: return 422 COMPANY_FUTURE_DATE
16. [Backend] Checks CNPJ uniqueness
    -> IF duplicate (P2002): return 409 COMPANY_CNPJ_DUPLICATE
17. [Backend] Opens $transaction: creates Company (DRAFT) + CompanyMember (ADMIN, ACTIVE) atomically
18. [Backend] Queues async CNPJ validation via Verifik (Bull job)
19. [Backend] Returns 201 with company data including setupStatus
20. [Frontend] On 201:
    - AuthContext updates: hasCompany = true, companyId = response.data.id
    - Calls onComplete()
    - OnboardingWizard redirects to /dashboard
21. [UI] Dashboard renders with CompanySetupProgress card at the top

POSTCONDITION: Company exists in DRAFT, user is ADMIN, async validation in progress
SIDE EFFECTS: Audit log (COMPANY_CREATED), CNPJ validation job queued, contract deployment job queued
```

### Happy Path: CNPJ Async Validation (Post-Creation)

```
PRECONDITION: Company in DRAFT, user on /dashboard, CompanySetupProgress visible
ACTOR: System (automatic) + User (retry only)
TRIGGER: Dashboard mount with DRAFT company

1.  [UI] CompanySetupProgress renders with items in "Pendente" state
2.  [Frontend] TanStack Query starts polling GET /api/v1/companies/:companyId (refetchInterval: 5000ms)
3.  [Backend] Returns company with setupStatus:
    { cnpjValidation: PENDING|IN_PROGRESS|SUCCESS|FAILED,
      contractDeployment: PENDING|IN_PROGRESS|SUCCESS|FAILED }
4.  [Frontend] Maps each status to UI state (icon + text)
5.  [System] Verifik CNPJ validation completes in background
    -> IF success: cnpjValidation = SUCCESS
    -> IF failure: cnpjValidation = FAILED
6.  [Frontend] Next poll picks up status change, updates item UI
7.  [System] Smart contract deployment completes in background
    -> IF success: contractDeployment = SUCCESS
    -> IF failure: contractDeployment = FAILED
8.  [Frontend] Next poll picks up status change, updates item UI
9.  [Frontend] When all items in terminal state: stop polling

IF all items SUCCESS:
10. [UI] Brief success animation (green check pulse)
11. [UI] Card auto-dismisses after 3 seconds
12. [Frontend] Invalidates company query cache, triggers refetch
13. [UI] Dashboard renders with full ACTIVE company data

IF any item FAILED:
10. [UI] Failed item shows red X + "Tentar novamente" ghost button
11. [UI] User clicks retry
12. [Frontend] POST /validate-cnpj or /deploy-contract
13. [UI] Item transitions to IN_PROGRESS, polling resumes

POSTCONDITION: Company is ACTIVE (happy path) or has setup failures displayed
SIDE EFFECTS: Audit logs for each setup step
```

### Happy Path: Edit Company Settings

```
PRECONDITION: User is ADMIN of an ACTIVE company
ACTOR: ADMIN member
TRIGGER: User navigates to /dashboard/settings

1.  [UI] CompanySettingsPage renders with "Informacoes da Empresa" tab active
2.  [Frontend] GET /api/v1/companies/:companyId to load company data
    -> While loading: skeleton form (pulsing gray rectangles)
3.  [UI] CompanyInfoForm renders with current data:
    - Name: editable text input
    - Entity Type: EntityTypeSelector (read-only if company has shareholders)
    - CNPJ: CNPJInput (always read-only after creation)
    - Description: editable textarea
    - Founded Date: editable date picker
    - Status: CompanyStatusBadge (informational)
4.  [UI] User modifies one or more fields
5.  [UI] Save button becomes enabled (form is dirty)
6.  [UI] User clicks "Salvar"
7.  [Frontend] Zod schema validates modified fields
    -> IF invalid: show field-level errors, STOP
8.  [Frontend] Sets saving state: button shows spinner, fields disabled
9.  [Frontend] Sends PUT /api/v1/companies/:companyId with changed fields
10. [Backend] AuthGuard + CompanyGuard + RolesGuard validate request
    -> IF not member: return 404
    -> IF not ADMIN: return 404
11. [Backend] Validates: not DISSOLVED, entityType immutability if has shareholders
    -> IF DISSOLVED: return 422 COMPANY_CANNOT_UPDATE_DISSOLVED
    -> IF entityType change with shareholders: return 422 COMPANY_ENTITY_TYPE_LOCKED
12. [Backend] Updates company, returns 200
13. [Frontend] On 200:
    - Success toast: "Empresa atualizada com sucesso"
    - Invalidates query cache, resets dirty state
14. [UI] Form re-enabled with updated data

POSTCONDITION: Company data updated
SIDE EFFECTS: Audit log (COMPANY_UPDATED)
```

### Happy Path: View Company Settings (Non-ADMIN)

```
PRECONDITION: User is a member (non-ADMIN role) of a company
ACTOR: FINANCE, LEGAL, INVESTOR, or EMPLOYEE member
TRIGGER: User navigates to /dashboard/settings

1.  [UI] CompanySettingsPage renders with "Informacoes da Empresa" tab active
2.  [Frontend] GET /api/v1/companies/:companyId to load company data
3.  [Frontend] Detects user role is not ADMIN
4.  [UI] All form fields rendered as read-only
5.  [UI] Save button hidden
6.  [UI] Danger zone section hidden
7.  [UI] Info text at top: "Somente administradores podem editar"

POSTCONDITION: None (read-only view)
```

### Happy Path: Dissolve Company

```
PRECONDITION: User is ADMIN, company is ACTIVE or INACTIVE
ACTOR: ADMIN member
TRIGGER: User clicks "Dissolver Empresa" in settings danger zone

1.  [UI] User scrolls to Danger Zone section in settings page
2.  [UI] User clicks "Dissolver Empresa" button (destructive variant)
3.  [UI] CompanyDissolutionDialog opens with loading spinner
4.  [Frontend] GET /api/v1/companies/:companyId/dissolution-prerequisites
5.  [Backend] Checks: active shareholders, active rounds, pending exercises, pending transactions
6.  [Backend] Returns { canDissolve: boolean, blockers: [...] }

IF blockers exist (canDissolve = false):
7a. [UI] Dialog shows blocker list with red X icons:
    - "Existem X acionistas ativos"
    - "Existem X rodadas ativas"
    - etc.
8a. [UI] Warning text: "Resolva estes itens antes de dissolver a empresa"
9a. [UI] Only "Fechar" button in footer. "Dissolver" button hidden.
10a. [UI] User clicks "Fechar" to close dialog

IF no blockers (canDissolve = true):
7b. [UI] Dialog shows warning text + confirmation input
    - Warning icon + "Esta acao e irreversivel..." text
    - "Digite '{company.name}' para confirmar" label
    - Text input for confirmation
    - "Cancelar" (secondary) + "Dissolver" (destructive, disabled) buttons
8b. [UI] User types company name in confirmation input
9b. [Frontend] Compares input with company.name (case-sensitive)
    -> IF match: enable "Dissolver" button
    -> IF no match: keep "Dissolver" disabled
10. [UI] User clicks "Dissolver"
11. [Frontend] Sets dissolving state: button shows spinner
12. [Frontend] POST /api/v1/companies/:companyId/dissolve
13. [Backend] Re-validates prerequisites
    -> IF blockers now exist: return 422 COMPANY_DISSOLUTION_BLOCKED
14. [Backend] Updates company status to DISSOLVED
15. [Backend] Returns success
16. [Frontend] On success:
    - Close dialog
    - Success toast: "Empresa dissolvida com sucesso"
    - Invalidates company query cache

POSTCONDITION: Company status = DISSOLVED, all data read-only
SIDE EFFECTS: Audit log (COMPANY_STATUS_CHANGED), notification emails to all members, blockchain status update
```

### Error Path: CNPJ Already Registered

```
PRECONDITION: User submits company creation with a CNPJ that exists in the system
ACTOR: New user during onboarding

1-11. (Same as Happy Path: Create Company steps 1-11)
12. [Backend] $transaction: company.create throws P2002 (unique constraint)
13. [Backend] Catches P2002, returns 409 COMPANY_CNPJ_DUPLICATE
14. [Frontend] Maps error to CNPJ field via form.setError('cnpj', ...)
15. [UI] CNPJ field shows red border + inline error: "CNPJ ja cadastrado no sistema"
16. [UI] All other fields re-enabled, user can correct CNPJ and resubmit
```

### Error Path: CNPJ Checksum Invalid (Client-Side)

```
PRECONDITION: User types an invalid CNPJ in the creation form
ACTOR: New user during onboarding

1-4. User fills form, types CNPJ
5.   [Frontend] On CNPJ blur: Modulo 11 validation fails
6.   [UI] CNPJ field shows red border + inline error: "CNPJ invalido"
7.   [UI] Submit button remains enabled (other fields may be valid)
8.   [UI] If user clicks submit: Zod schema catches CNPJ error, prevents submission
```

### Error Path: Server Error During Creation

```
PRECONDITION: User submits valid form but server encounters an error
ACTOR: New user during onboarding

1-10. (Same as Happy Path: Create Company steps 1-10)
11.  [Backend] Internal error occurs (database down, etc.)
12.  [Backend] Returns 500 SYS_INTERNAL_ERROR
13.  [Frontend] Catches error in mutation onError
14.  [UI] Error toast (Sonner, top-right): "Erro interno do servidor"
15.  [UI] All form fields re-enabled, user can retry
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 5 (create) | CNPJ blur validation | Modulo 11 fails | Error | Inline error on CNPJ field |
| 9 (create) | Client validation | Zod schema fails | Error | Field-level errors shown |
| 13 (create) | Server validation | Body invalid (types, format) | Error | 400 VAL_INVALID_INPUT, mapped to fields |
| 14 (create) | CNPJ checksum (server) | Modulo 11 fails | Error | 422 COMPANY_INVALID_CNPJ |
| 15 (create) | Founded date | Unparseable or future | Error | 422 COMPANY_INVALID_DATE / FUTURE_DATE |
| 16 (create) | CNPJ uniqueness | P2002 constraint | Error | 409 COMPANY_CNPJ_DUPLICATE, inline error |
| 3 (settings) | User role | Not ADMIN | Alt | Read-only view, no save, no danger zone |
| 11 (update) | Company status | DISSOLVED | Error | 422 COMPANY_CANNOT_UPDATE_DISSOLVED |
| 11 (update) | Entity type lock | Has shareholders | Error | 422 COMPANY_ENTITY_TYPE_LOCKED |
| 6 (dissolve) | Prerequisites | Blockers exist | Alt | Blocker list shown, cannot proceed |
| 9b (dissolve) | Name confirmation | Input != company name | Block | Dissolve button stays disabled |
| 13 (dissolve) | Prerequisites (recheck) | Blockers appeared since dialog opened | Error | 422, error toast |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| Company | status | -- | DRAFT | Company created during onboarding |
| Company | status | DRAFT | ACTIVE | CNPJ validated + contract deployed (async) |
| Company | status | ACTIVE | INACTIVE | Admin deactivates |
| Company | status | INACTIVE | ACTIVE | Admin reactivates |
| Company | status | ACTIVE/INACTIVE | DISSOLVED | Admin dissolves (permanent) |
| CompanyMember | -- | -- | (created, role=ADMIN, status=ACTIVE) | Creator auto-assigned on company creation |

### Status State Machine

```
  +----------+   CNPJ validated +   +----------+
  |  DRAFT   | ---- contract ----> |  ACTIVE  |
  +----------+   deployed          +----------+
       |                            ^      |
       |                  reactivate|      |deactivate
       |                            |      v
       |                          +-----------+
       |                          | INACTIVE   |
       |                          +-----------+
       |                               |
       |         dissolve              | dissolve
       +-------------------> +----------+ <----+
                             | DISSOLVED | (permanent, read-only)
                             +----------+
```

---

## UI States Summary

### CompanyCreationStep (Onboarding)

| State | Visual | Trigger |
|-------|--------|---------|
| Idle | Empty form, submit disabled | Initial render |
| Filling | User input, CNPJ auto-masking, submit enabled when required fields filled | User types |
| CNPJ Invalid (client) | Red border on CNPJ + error text | CNPJ blur + checksum fail |
| Submitting | Button spinner, all fields disabled | Form submit |
| CNPJ Duplicate (server) | CNPJ field red + inline error | 409 response |
| Validation Error (server) | Red borders on invalid fields | 400 response |
| Server Error | Error toast (Sonner) | 5xx response |
| Success | Redirect to /dashboard | 201 response |

### CompanySetupProgress (Dashboard)

| State | Visual | Trigger |
|-------|--------|---------|
| Initial | All items pending (gray spinners) | DRAFT company loaded |
| Validating | CNPJ item blue spinner, contract pending | Poll detects IN_PROGRESS |
| All Done | All items green check, auto-dismiss 3s | All items SUCCESS |
| Partial Failure | Failed items show red X + retry | Item reaches FAILED |

### CompanySettingsPage

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton form | Page mount |
| View (non-ADMIN) | Read-only fields, no save, no danger zone | Data loaded, not ADMIN |
| View (ADMIN, clean) | Editable fields, save disabled | Data loaded, ADMIN |
| Dirty | Save button enabled | User modifies field |
| Saving | Button spinner, fields disabled | Save click |
| Saved | Success toast | 200 response |
| Error | Error toast or field errors | 400/422/5xx response |

### CompanyDissolutionDialog

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Centered spinner in dialog | Dialog opened |
| Blocked | Blocker list, only "Fechar" button | canDissolve = false |
| Ready | Warning + confirmation input, "Dissolver" disabled | canDissolve = true |
| Name Match | "Dissolver" button enabled (red) | Input matches name |
| Dissolving | Button spinner, input disabled | User confirms |
| Success | Dialog closes, success toast | 200/204 response |
| Error | Error toast, dialog stays open | 422/5xx response |

---

## By Role

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE | Unauthenticated |
|--------|-------|---------|-------|----------|----------|-----------------|
| Create company (onboarding) | Yes | N/A | N/A | N/A | N/A | No (401) |
| View company settings | Yes (editable) | Yes (read-only) | Yes (read-only) | Yes (read-only) | Yes (read-only) | No (401) |
| Update company | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |
| Change status | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |
| Dissolve company | Yes | No (404) | No (404) | No (404) | No (404) | No (401) |
| View danger zone | Yes | No (hidden) | No (hidden) | No (hidden) | No (hidden) | No (401) |

Note: Non-members receive 404 (not 403) to prevent company enumeration per security.md.
Note: In MVP, company creation only happens during onboarding (Step 2), so only the creating user (who becomes ADMIN) performs it.

---

## API Endpoints Summary

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/api/v1/companies` | Required | Any authenticated | Create company |
| GET | `/api/v1/companies` | Required | Any authenticated | List user's companies |
| GET | `/api/v1/companies/:companyId` | Required | Any member | Company details (includes setupStatus if DRAFT) |
| PUT | `/api/v1/companies/:companyId` | Required | ADMIN | Update company |
| PATCH | `/api/v1/companies/:companyId/status` | Required | ADMIN | Change status |
| POST | `/api/v1/companies/:companyId/dissolve` | Required | ADMIN | Dissolve company |
| GET | `/api/v1/companies/:companyId/dissolution-prerequisites` | Required | ADMIN | Check dissolution blockers |
| POST | `/api/v1/companies/:companyId/validate-cnpj` | Required | ADMIN | Retry CNPJ validation |
| POST | `/api/v1/companies/:companyId/deploy-contract` | Required | ADMIN | Retry contract deployment |

---

## Frontend Page Routes

| Route | Layout | Component | Description |
|-------|--------|-----------|-------------|
| `/onboarding` (Step 2) | Auth layout | CompanyCreationStep | Company creation form during wizard |
| `/dashboard/settings` | Dashboard shell | CompanySettingsPage | Company info, members link, notifications |

---

**Depends on**: [Authentication](./authentication.md) -- user must be logged in, onboarding wizard hosts Step 2
**Feeds into**: [Member Invitation](./member-invitation.md) -- after company exists, admin can invite members
**Triggers**: CNPJ Validation -- async, after company created
**Triggers**: Contract Deployment -- async, after CNPJ validated
