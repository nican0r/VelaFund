# Onboarding Wizard — User Flows

**Feature**: 2-step onboarding wizard for new users (personal info → company creation)
**Actors**: Authenticated user (new or returning with incomplete onboarding)
**Preconditions**: User is authenticated via Privy, backend session established
**Related Flows**: [Authentication](./authentication.md) — login triggers onboarding detection; [Company Management](./company-management.md) — company creation at Step 2

---

## Flow Map

```
User logs in / page refreshes
  │
  ├─ [isNewUser OR user.firstName is null] ─→ Redirect to /onboarding
  │     │
  │     ├─ [user.firstName is null] ─→ Step 1: Personal Info
  │     │     │
  │     │     ├─ [valid form] ─→ PUT /api/v1/auth/me
  │     │     │     │
  │     │     │     ├─ [200 OK] ─→ refreshUser() → advance to Step 2
  │     │     │     ├─ [409 Conflict: duplicate email] ─→ inline error on email field
  │     │     │     └─ [5xx error] ─→ toast error, stay on Step 1
  │     │     │
  │     │     └─ [invalid form] ─→ client-side field errors, no API call
  │     │
  │     └─ [user.firstName exists, no company] ─→ Step 2: Company Creation
  │           │
  │           ├─ [valid form + CNPJ checksum OK] ─→ POST /api/v1/companies
  │           │     │
  │           │     ├─ [201 Created] ─→ completeOnboarding() → redirect to /dashboard
  │           │     ├─ [409 Conflict: duplicate CNPJ] ─→ inline error on CNPJ field
  │           │     └─ [5xx error] ─→ toast error, stay on Step 2
  │           │
  │           ├─ [invalid CNPJ checksum] ─→ client-side CNPJ error
  │           └─ [missing required fields] ─→ client-side field errors
  │
  ├─ [user has company + firstName exists] ─→ /dashboard (no onboarding needed)
  │
  └─ [not authenticated] ─→ Redirect to /login
```

---

## Flows

### Happy Path: New User Completes Full Onboarding

```
PRECONDITION: User just authenticated via Privy for the first time
ACTOR: New user (firstName is null, no company)
TRIGGER: Login API returns isNewUser: true

1.  [Frontend] AuthProvider receives login response with isNewUser=true
2.  [Frontend] AuthContext sets needsOnboarding=true
3.  [Frontend] Route guard detects needsOnboarding, redirects to /onboarding
4.  [UI] OnboardingPage renders: Navia logo, "Welcome to Navia" heading, stepper (Step 1 active), PersonalInfoStep form
5.  [UI] Email field pre-filled from user.email (from Privy registration)
6.  [UI] User fills in first name, last name, confirms/edits email
7.  [UI] User clicks "Continue"
8.  [Frontend] Client-side validation:
    → IF firstName empty: show "First name is required"
    → IF lastName empty: show "Last name is required"
    → IF email empty: show "Email is required"
    → IF email format invalid: show "Enter a valid email address"
9.  [Frontend] Sends PUT /api/v1/auth/me with { firstName, lastName, email }
10. [Backend] AuthGuard verifies session
11. [Backend] Validates UpdateProfileDto (optional fields, email format, maxLength)
12. [Backend] Checks for duplicate email (excluding current user)
    → IF duplicate: return 409 with messageKey "errors.auth.duplicateEmail"
13. [Backend] Updates User record in database
14. [Backend] Returns 200 with updated user profile
15. [Frontend] Calls refreshUser() to update AuthContext with new user data
16. [Frontend] OnboardingPage advances to Step 2 (setCurrentStep(2))
17. [UI] Stepper shows Step 1 complete (check mark), Step 2 active
18. [UI] CompanyCreationStep form renders: company name, entity type dropdown, CNPJ field
19. [UI] User fills in company name (min 2 chars), selects entity type, types CNPJ
20. [UI] CNPJ auto-formats as user types: XX.XXX.XXX/XXXX-XX
21. [UI] User clicks "Create Company"
22. [Frontend] Client-side validation:
    → IF name empty: show "Company name is required"
    → IF name < 2 chars: show "Company name must be at least 2 characters"
    → IF entityType not selected: show "Entity type is required"
    → IF CNPJ empty: show "CNPJ is required"
    → IF CNPJ invalid checksum (Módulo 11) or all same digit: show "Invalid CNPJ"
23. [Frontend] Strips CNPJ formatting, sends POST /api/v1/companies with { name, entityType, cnpj }
24. [Backend] AuthGuard verifies session
25. [Backend] Validates CreateCompanyDto
26. [Backend] Checks for duplicate CNPJ
    → IF duplicate: return 409 with messageKey "errors.company.cnpjDuplicate"
27. [Backend] Creates Company (status: DRAFT) + CompanyMember (role: ADMIN) in $transaction
28. [Backend] Dispatches async CNPJ validation via Bull queue
29. [Backend] Returns 201 with created company
30. [Frontend] Calls completeOnboarding() in AuthContext
31. [Frontend] AuthContext sets needsOnboarding=false, isNewUser=false
32. [Frontend] Route guard detects no onboarding needed, redirects to /dashboard
33. [UI] User lands on dashboard

POSTCONDITION: User profile complete, company created (DRAFT status), user is ADMIN member
SIDE EFFECTS: User.firstName/lastName/email updated, Company + CompanyMember created, CNPJ validation queued, audit logs queued
```

---

### Alternative Path: Returning User Resumes at Step 2

```
PRECONDITION: User previously completed Step 1 (firstName exists) but did not create a company
ACTOR: Returning user
TRIGGER: Login or page refresh

1.  [Frontend] AuthProvider detects user.firstName exists but needsOnboarding=true (no company)
2.  [Frontend] OnboardingPage determines initial step: user.firstName exists → Step 2
3.  [UI] Stepper shows Step 1 complete, Step 2 active
4.  [UI] CompanyCreationStep form renders immediately
5-33. Same as Happy Path steps 19-33

POSTCONDITION: Company created, onboarding complete
```

---

### Error Path: Duplicate Email (Step 1)

```
PRECONDITION: User is on Step 1
ACTOR: User
TRIGGER: User submits email that belongs to another user

1.  [UI] User fills in first name, last name, and an email already in use
2.  [UI] User clicks "Continue"
3.  [Frontend] Client-side validation passes (email format is valid)
4.  [Frontend] Sends PUT /api/v1/auth/me
5.  [Backend] Finds existing user with same email (different user ID)
6.  [Backend] Returns 409 with messageKey "errors.auth.duplicateEmail"
7.  [Frontend] Catches error, checks messageKey
8.  [UI] Email field shows inline error: "This email is already in use"
9.  [UI] User stays on Step 1, can correct email and retry

POSTCONDITION: User stays on Step 1, no profile changes saved
```

---

### Error Path: Duplicate CNPJ (Step 2)

```
PRECONDITION: User is on Step 2
ACTOR: User
TRIGGER: User submits CNPJ that is already registered

1.  [UI] User fills in company name, selects entity type, types existing CNPJ
2.  [UI] User clicks "Create Company"
3.  [Frontend] Client-side CNPJ checksum passes
4.  [Frontend] Sends POST /api/v1/companies
5.  [Backend] Finds existing company with same CNPJ
6.  [Backend] Returns 409 with messageKey "errors.company.cnpjDuplicate"
7.  [Frontend] Catches error, checks messageKey
8.  [UI] CNPJ field shows inline error: "This CNPJ is already registered"
9.  [UI] User stays on Step 2, can correct CNPJ and retry

POSTCONDITION: User stays on Step 2, no company created
```

---

### Error Path: Invalid CNPJ Checksum (Step 2)

```
PRECONDITION: User is on Step 2
ACTOR: User
TRIGGER: User types CNPJ with invalid Módulo 11 check digits

1.  [UI] User types CNPJ (auto-formatted to XX.XXX.XXX/XXXX-XX)
2.  [UI] User clicks "Create Company"
3.  [Frontend] Client-side CNPJ validation:
    - Strips formatting, extracts 14 digits
    - Rejects all-same-digit CNPJs (e.g., 11111111111111)
    - Computes Módulo 11 check digits and compares
    → Checksum invalid: sets error "Invalid CNPJ"
4.  [UI] CNPJ field shows inline error
5.  [Frontend] No API call made

POSTCONDITION: User stays on Step 2, can correct CNPJ
```

---

### Error Path: Server Error (Either Step)

```
PRECONDITION: User is on Step 1 or Step 2
ACTOR: User
TRIGGER: Backend returns 5xx error

1.  [UI] User fills form and submits
2.  [Frontend] Sends API request
3.  [Backend] Returns 500/502/503
4.  [Frontend] Catches error, messageKey does not match known codes
5.  [UI] Toast error appears: "An unexpected error occurred. Please try again."
6.  [UI] User stays on current step, can retry

POSTCONDITION: No data changed, user can retry
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 1 | Post-login routing | isNewUser OR !user.firstName | Onboarding | Redirect to /onboarding |
| 1 | Post-login routing | user has company + firstName | Dashboard | Redirect to /dashboard |
| 4 | Step determination | user.firstName is null | Step 1 | PersonalInfoStep renders |
| 4 | Step determination | user.firstName exists | Step 2 | CompanyCreationStep renders |
| 8 | Client validation (Step 1) | Empty or invalid fields | Error | Field-level errors shown |
| 12 | Duplicate email check | Email belongs to another user | Error | 409, inline error on email |
| 22 | Client validation (Step 2) | Empty fields or short name | Error | Field-level errors shown |
| 22 | CNPJ checksum (Step 2) | Invalid Módulo 11 | Error | Client-side CNPJ error |
| 26 | Duplicate CNPJ check | CNPJ already registered | Error | 409, inline error on CNPJ |
| 30 | Onboarding completion | Company created successfully | Happy | completeOnboarding → /dashboard |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| AuthContext | needsOnboarding | false | true | Login returns isNewUser or !firstName |
| AuthContext | isNewUser | false | true | Login returns isNewUser: true |
| User | firstName | null | "John" | Step 1 submission (PUT /auth/me) |
| User | lastName | null | "Smith" | Step 1 submission (PUT /auth/me) |
| User | email | "privy@email.com" | "user@email.com" | Step 1 submission (if changed) |
| Company | — | (not exists) | DRAFT | Step 2 submission (POST /companies) |
| CompanyMember | — | (not exists) | ACTIVE, role=ADMIN | Step 2 (auto-created in $transaction) |
| AuthContext | needsOnboarding | true | false | completeOnboarding() called |
| AuthContext | isNewUser | true | false | completeOnboarding() called |

---

## UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| OnboardingPage | `/app/onboarding/page.tsx` | Main wizard container with step routing |
| OnboardingStepper | `/components/onboarding/onboarding-stepper.tsx` | Visual step indicator (1 of 2 / 2 of 2) |
| PersonalInfoStep | `/components/onboarding/personal-info-step.tsx` | Step 1 form (firstName, lastName, email) |
| CompanyCreationStep | `/components/onboarding/company-creation-step.tsx` | Step 2 form (name, entityType, CNPJ) |

---

## i18n Namespaces

| Namespace | Keys | Usage |
|-----------|------|-------|
| `onboarding` | welcome | Page-level strings |
| `onboarding.stepper` | step1, step2 | Stepper labels |
| `onboarding.personalInfo` | title, description, firstName, lastName, email, validation errors | Step 1 form |
| `onboarding.companyCreation` | title, description, name, entityType, cnpj, entity type options, validation errors | Step 2 form |
| `common` | continue, error | Shared button/error text |

---

## By Role

All roles experience the same onboarding flow. The creator is always assigned ADMIN role for the new company.

| Step | Any Authenticated User |
|------|----------------------|
| Step 1 (Personal Info) | Required if firstName is null |
| Step 2 (Company Creation) | Required if no company exists |
| Result | User becomes ADMIN of created company |
