# Authentication — User Flows

**Feature**: User authentication via Privy SDK with JWT verification and cookie-based sessions
**Actors**: Unauthenticated user, Authenticated user
**Preconditions**: Privy app configured (PRIVY_APP_ID, PRIVY_APP_SECRET)
**Related Flows**: [Company Management](./company-management.md) (requires auth), [KYC Verification](./kyc-verification.md) (requires auth)

---

## Flow Map

```
User opens Navia
  │
  ├─ [has valid session cookie] ─→ AuthGuard verifies token
  │     │
  │     ├─ [token valid + user exists] ─→ Access granted, user attached to request
  │     ├─ [token valid + user deleted] ─→ 401 Unauthorized, redirect to login
  │     └─ [token invalid/expired] ─→ 401 Unauthorized, redirect to login
  │
  └─ [no session] ─→ Redirect to login page
        │
        └─ User clicks "Login"
              │
              ├─ [Privy auth succeeds] ─→ Frontend sends POST /api/v1/auth/login
              │     │
              │     ├─ [IP locked out] ─→ 429 Too Many Requests
              │     │
              │     ├─ [token verification fails] ─→ 401, failed attempt recorded
              │     │     │
              │     │     └─ [5th failure from same IP] ─→ IP locked for 15 min
              │     │
              │     ├─ [Privy user fetch fails] ─→ 502 Bad Gateway
              │     │
              │     ├─ [no email on Privy user] ─→ 401 Unauthorized
              │     │
              │     ├─ [email exists with different Privy ID] ─→ 409 Conflict
              │     │
              │     └─ [all checks pass] ─→ User found/created
              │           │
              │           ├─ [existing user] ─→ lastLoginAt updated, wallet synced
              │           └─ [new user] ─→ User created in DB
              │
              │     ─→ Auth cookie set (HTTP-only, 7d), user data returned
              │
              └─ [Privy auth fails] ─→ Privy SDK shows error in modal

User clicks "Logout"
  │
  └─ POST /api/v1/auth/logout (@Public) ─→ Cookie cleared ─→ Redirect to login

User visits GET /api/v1/auth/me
  │
  ├─ [authenticated] ─→ Full profile returned
  └─ [not authenticated] ─→ 401 Unauthorized
```

---

## Flows

### Happy Path: Login (Existing User)

```
PRECONDITION: User has a Privy account with email
ACTOR: Unauthenticated user
TRIGGER: User navigates to login page and clicks login button

1. [UI] User navigates to /login
2. [UI] User clicks "Login" button
3. [Frontend] Opens Privy authentication modal
4. [Frontend] User authenticates via Privy (email, Google, etc.)
5. [Frontend] Privy SDK returns access token
6. [Frontend] Sends POST /api/v1/auth/login with { privyAccessToken }
7. [Backend] Validates request body (class-validator)
8. [Backend] Checks IP lockout status
   → IF locked: return 429 AUTH_ACCOUNT_LOCKED
9. [Backend] Verifies Privy access token via privyClient.utils().auth().verifyAccessToken()
   → IF invalid: record failed attempt, return 401 AUTH_INVALID_TOKEN
10. [Backend] Fetches Privy user profile via privyClient.users()._get(userId)
    → IF Privy unavailable: return 502 AUTH_PRIVY_UNAVAILABLE
11. [Backend] Extracts email from linked_accounts (email type, then google_oauth, then apple_oauth fallback)
    → IF no email: return 401 AUTH_INVALID_TOKEN
12. [Backend] Begins database transaction
13. [Backend] Finds user by privyUserId in database
14. [Backend] Updates lastLoginAt, syncs wallet if changed; checks email conflict before syncing email
15. [Backend] Commits transaction
16. [Backend] Clears any failed login attempts for this IP
17. [Backend] Sets HTTP-only cookie: navia-auth-token (7d, SameSite=Strict)
18. [Backend] Returns 200 with { user, isNewUser: false }
19. [UI] Stores user data in state
20. [UI] Redirects to /dashboard

POSTCONDITION: User is authenticated, session cookie is set
SIDE EFFECTS: User.lastLoginAt updated, failed attempts cleared for IP
```

### Happy Path: Login (New User — First Time)

```
PRECONDITION: User authenticated via Privy but no Navia account exists
ACTOR: New user
TRIGGER: First login after Privy authentication

Steps 1-12: Same as existing user login (through transaction begin)
13. [Backend] No user found by privyUserId
14. [Backend] Checks if email exists with different Privy ID
    → IF exists: return 409 AUTH_DUPLICATE_EMAIL
15. [Backend] Creates new user in database with Privy data (email, wallet, name from Google/Apple OAuth or email local part)
16-20: Same as existing user login, with isNewUser: true

POSTCONDITION: New user created in database, session cookie set
SIDE EFFECTS: New User record created with kycStatus=NOT_STARTED, locale=pt-BR
```

### Happy Path: Logout

```
PRECONDITION: User has a session cookie (valid or expired)
ACTOR: User (authenticated or with expired cookie)
TRIGGER: User clicks logout button

1. [UI] User clicks "Logout" in navigation
2. [Frontend] Sends POST /api/v1/auth/logout
3. [Backend] Endpoint is @Public() — no auth check needed (allows expired-cookie users to clear cookies)
4. [Backend] Clears navia-auth-token cookie
5. [Backend] Returns 200 with { messageKey: "errors.auth.loggedOut" }
6. [Frontend] Clears local user state
7. [UI] Redirects to /login

POSTCONDITION: Session cookie cleared, user redirected to login
```

### Happy Path: Get Profile

```
PRECONDITION: User is authenticated
ACTOR: Authenticated user
TRIGGER: Frontend requests user profile (page load, navigation)

1. [Frontend] Sends GET /api/v1/auth/me (cookie-based auth)
2. [Backend] AuthGuard extracts token from cookie
3. [Backend] Verifies token, attaches user to request
4. [Backend] AuthService.getProfile fetches user from database
5. [Backend] Returns 200 with user profile data

POSTCONDITION: None (read-only)
```

### Error Path: Account Locked

```
PRECONDITION: IP has 5+ failed login attempts in the last 15 minutes
ACTOR: User (potentially attacker)
TRIGGER: Login attempt from locked IP

1. [Frontend] Sends POST /api/v1/auth/login
2. [Backend] Checks lockout: IP has active lockout
3. [Backend] Returns 429 AUTH_ACCOUNT_LOCKED
4. [UI] Shows error: "Account temporarily locked. Try again in 15 minutes."

POSTCONDITION: No login possible from this IP until lockout expires
```

### Error Path: Privy Service Down

```
PRECONDITION: Privy API is unavailable
ACTOR: User
TRIGGER: Login attempt when Privy is down

1-9: Same as happy path (token verification may succeed if cached)
10. [Backend] privyClient.users()._get() fails with network error
11. [Backend] Returns 502 AUTH_PRIVY_UNAVAILABLE
12. [UI] Shows error: "Authentication service unavailable"

POSTCONDITION: Login not completed, no state changed
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 8 | IP lockout check | IP has >= 5 failures and lock not expired | Error | 429 AUTH_ACCOUNT_LOCKED |
| 9 | Token verification | Invalid or expired Privy token | Error | 401 AUTH_INVALID_TOKEN, failed attempt recorded |
| 10 | Privy user fetch | Privy API unavailable | Error | 502 AUTH_PRIVY_UNAVAILABLE |
| 11 | Email extraction | No email in linked_accounts (email, google_oauth, apple_oauth) | Error | 401 AUTH_INVALID_TOKEN |
| 13 | User lookup | No user with this privyUserId | Happy | Create new user (step 14-15) |
| 13 | User lookup | User exists with this privyUserId | Happy | Update existing user |
| 14 | Email uniqueness | Email exists with different privyUserId | Error | 409 AUTH_DUPLICATE_EMAIL |
| 14 | Email sync (existing user) | New email conflicts with another user | Skip | Email not synced, warning logged |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| User | — | — (not exists) | Created | First login (new user) |
| User | lastLoginAt | previous timestamp | now() | Every successful login |
| User | walletAddress | old address | new address | Wallet changed in Privy |
| User | email | old email | new email | Email changed in Privy |

---

## Auth Token Flow (Request Lifecycle)

Every request goes through three global guards in order: ThrottlerGuard → AuthGuard → RolesGuard.

```
HTTP Request arrives
  │
  ├─ ThrottlerGuard checks rate limit
  │     │
  │     ├─ [within limit] ─→ Continue
  │     └─ [exceeded] ─→ 429 Too Many Requests
  │
  ├─ [route has @Public()] ─→ Skip auth, proceed to RolesGuard
  │
  └─ [no @Public()] ─→ AuthGuard activates
        │
        ├─ [Authorization: Bearer <token>] ─→ Use header token
        ├─ [navia-auth-token cookie] ─→ Use cookie token
        └─ [neither] ─→ 401 Unauthorized
              │
              └─ Token extracted
                    │
                    └─ AuthService.verifyTokenAndGetUser(token)
                          │
                          ├─ [valid + user exists + not deleted] ─→ Attach user to request
                          └─ [any failure] ─→ 401 Unauthorized
                                │
                                └─ RolesGuard activates
                                      │
                                      ├─ [no @Roles() decorator] ─→ Proceed to handler
                                      │
                                      └─ [@Roles() present] ─→ Check company membership
                                            │
                                            ├─ [no :companyId param] ─→ 403 Forbidden
                                            │
                                            ├─ [not ACTIVE member] ─→ 404 Not Found (prevents enumeration)
                                            │
                                            ├─ [role not in required list] ─→ 403 Forbidden
                                            │
                                            └─ [role matches] ─→ Attach companyMember to request, proceed
```

---

## By Role

All authentication endpoints are role-agnostic — they operate on the authenticated user identity.

| Endpoint | Unauthenticated | Any Authenticated User |
|----------|----------------|----------------------|
| POST /api/v1/auth/login | Allowed (@Public) | Allowed (re-login) |
| POST /api/v1/auth/logout | Allowed (@Public) | Allowed |
| GET /api/v1/auth/me | 401 | Allowed |
| GET /api/v1/health | Allowed (@Public) | Allowed |

Company-scoped endpoints use `@Roles()` to enforce role-based access:

| Endpoint Pattern | Required Roles | Non-member |
|-----------------|---------------|------------|
| GET /api/v1/companies/:companyId/* | Per @Roles() on endpoint | 404 Not Found |
| POST /api/v1/companies/:companyId/* | Per @Roles() on endpoint | 404 Not Found |
| Endpoints without @Roles() | Any authenticated user | N/A |

---
---

## Frontend Flows

This section extends the backend-focused flows above with detailed frontend routing, onboarding, session management, and UI state documentation.

---

### Frontend Flow Map

```
User navigates to any Navia URL
  │
  ├─ /login ─→ LoginPage renders
  │     │
  │     ├─ [already authenticated + has company] ─→ Redirect to /dashboard
  │     ├─ [already authenticated + needsOnboarding] ─→ Redirect to /onboarding
  │     └─ [not authenticated] ─→ Show login card
  │           │
  │           └─ User clicks "Entrar"
  │                 │
  │                 ├─ [Privy modal opens] ─→ User authenticates
  │                 │     │
  │                 │     ├─ [Privy success] ─→ POST /api/v1/auth/login
  │                 │     │     │
  │                 │     │     ├─ [new user, no profile] ─→ /onboarding Step 1
  │                 │     │     ├─ [existing user, no company] ─→ /onboarding Step 2
  │                 │     │     ├─ [existing user, has company] ─→ /dashboard
  │                 │     │     ├─ [429 locked] ─→ Error toast, stay on /login
  │                 │     │     ├─ [502 Privy down] ─→ Error toast, stay on /login
  │                 │     │     └─ [5xx error] ─→ Error toast, stay on /login
  │                 │     │
  │                 │     └─ [Privy cancel/fail] ─→ Modal closes, no state change
  │                 │
  │                 └─ [?expired=true in URL] ─→ Info banner above button
  │
  ├─ /onboarding ─→ AuthGuard checks auth
  │     │
  │     ├─ [not authenticated] ─→ Redirect to /login
  │     ├─ [has company already] ─→ Redirect to /dashboard
  │     └─ [authenticated, needs onboarding] ─→ OnboardingWizard renders
  │           │
  │           ├─ [user.firstName is null] ─→ Step 1: PersonalInfoStep
  │           │     │
  │           │     ├─ [fills form + submits] ─→ PUT /api/v1/users/me
  │           │     │     ├─ [success] ─→ Advance to Step 2
  │           │     │     ├─ [400 validation] ─→ Field-level errors
  │           │     │     └─ [5xx] ─→ Error toast
  │           │     │
  │           │     └─ [closes browser] ─→ Next login resumes at Step 1
  │           │
  │           └─ [user.firstName exists, no company] ─→ Step 2: CompanyCreationStep
  │                 │
  │                 ├─ [fills form + submits] ─→ POST /api/v1/companies
  │                 │     ├─ [201 success] ─→ Redirect to /dashboard
  │                 │     ├─ [409 CNPJ duplicate] ─→ Inline error on CNPJ field
  │                 │     ├─ [400 validation] ─→ Field-level errors
  │                 │     └─ [5xx] ─→ Error toast
  │                 │
  │                 └─ [closes browser] ─→ Next login resumes at Step 2
  │
  └─ /(dashboard)/* ─→ AuthGuard checks auth
        │
        ├─ [isLoading] ─→ Full-page spinner
        ├─ [not authenticated] ─→ Redirect to /login
        ├─ [needsOnboarding] ─→ Redirect to /onboarding
        └─ [authenticated + has company] ─→ Render dashboard page
              │
              ├─ [any API call returns 401] ─→ Session expired flow
              │     ├─ authContext.logout()
              │     ├─ Toast: "Sua sessao expirou"
              │     └─ Redirect to /login?expired=true
              │
              └─ [user clicks "Sair"] ─→ Logout flow
                    ├─ POST /api/v1/auth/logout
                    ├─ privy.logout()
                    └─ Redirect to /login
```

---

### Frontend Happy Path: Founder Signup (New User, No Invitation)

```
PRECONDITION: User has no existing Navia account
ACTOR: New user (founder)
TRIGGER: User navigates to /login

1.  [UI] User sees LoginPage: Navia logo, "Bem-vindo ao Navia" heading, "Entrar" button
2.  [UI] User clicks "Entrar" button
3.  [Frontend] Calls privy.login() — Privy authentication modal opens
4.  [UI] Privy modal displays: email, Google, and Apple login options
5.  [UI] User selects a method and completes authentication
6.  [Frontend] Privy onSuccess callback fires with auth token
7.  [UI] "Entrar" button shows spinner, becomes disabled
8.  [Frontend] Sends POST /api/v1/auth/login with Privy access token
9.  [Backend] Verifies token, creates new User record, sets HTTP-only session cookie
10. [Backend] Returns 200: { user: { id, email, firstName: null, ... }, isNewUser: true, hasCompany: false }
11. [Frontend] AuthContext updates: isAuthenticated=true, needsOnboarding=true
12. [Frontend] AuthGuard detects needsOnboarding, redirects to /onboarding
13. [UI] OnboardingWizard renders Step 1 (PersonalInfoStep)
    - Stepper: (1) Suas Informacoes [active, blue-600] ── (2) Sua Empresa [pending, gray-300]
14. [UI] User fills firstName, lastName; email is pre-filled from Privy
15. [UI] User clicks "Continuar"
16. [Frontend] Client-side validation (React Hook Form + Zod)
    → IF invalid: red borders + error text on fields, STOP
17. [Frontend] Sends PUT /api/v1/users/me with { firstName, lastName, email }
18. [Backend] Validates, updates user, returns updated profile
19. [Frontend] AuthContext user data updated (firstName, lastName populated)
20. [UI] OnboardingWizard advances to Step 2
    - Stepper: (1) Suas Informacoes [complete, green check] ── (2) Sua Empresa [active, blue-600]
21. [UI] User fills company name, entityType, CNPJ, optional fields
22. [UI] User clicks "Criar Empresa"
23. [Frontend] Client-side validation (including CNPJ checksum)
    → IF invalid: red borders + error text on fields, STOP
24. [Frontend] Sends POST /api/v1/companies with company data
25. [Backend] Validates, creates company (DRAFT), queues CNPJ validation job
26. [Backend] Returns 201: { id, name, status: 'DRAFT', ... }
27. [Frontend] AuthContext: hasCompany=true, needsOnboarding=false
28. [Frontend] Redirects to /dashboard
29. [UI] Dashboard renders

POSTCONDITION: User has profile + company in DRAFT status
SIDE EFFECTS:
  - Audit: AUTH_LOGIN_SUCCESS, COMPANY_CREATED
  - CNPJ validation Bull job queued
  - Blockchain contract deployment queued (after CNPJ validation)
```

---

### Frontend Happy Path: Returning User Login (Has Company)

```
PRECONDITION: User has existing Navia account with at least one company
ACTOR: Returning user
TRIGGER: User navigates to /login

1.  [UI] User sees LoginPage
2.  [UI] User clicks "Entrar"
3.  [Frontend] privy.login() — modal or auto-login (saved session)
4.  [UI] User completes Privy auth
5.  [Frontend] POST /api/v1/auth/login
6.  [Backend] Verifies token, finds user, updates lastLoginAt, sets session cookie
7.  [Backend] Returns 200: { user, isNewUser: false, hasCompany: true }
8.  [Frontend] AuthContext: isAuthenticated=true, hasCompany=true, needsOnboarding=false
9.  [Frontend] AuthGuard allows access
10. [UI] User lands on /dashboard

POSTCONDITION: User authenticated, on dashboard
SIDE EFFECTS: Audit (AUTH_LOGIN_SUCCESS), User.lastLoginAt updated
```

---

### Frontend Happy Path: Returning User with Incomplete Onboarding

```
PRECONDITION: User created account but did not finish onboarding
ACTOR: Returning user
TRIGGER: User logs in

1-5. Same as Returning User Login
6.   [Backend] Returns: { user: { firstName: "Joao" | null, ... }, isNewUser: false, hasCompany: false }
7.   [Frontend] AuthContext: isAuthenticated=true, needsOnboarding=true
8.   [Frontend] AuthGuard redirects to /onboarding
9.   [Frontend] OnboardingWizard determines initial step:
     → IF user.firstName is null: render Step 1
     → IF user.firstName exists but no company: render Step 2
10.  [UI] User completes remaining step(s)
11.  [Frontend] On company creation success: redirect to /dashboard

POSTCONDITION: User completes onboarding, reaches dashboard
```

---

### Frontend Happy Path: Page Refresh with Valid Session

```
PRECONDITION: User had active session before refresh
ACTOR: Authenticated user
TRIGGER: Browser page refresh

1.  [Frontend] App mounts, PrivyAuthProvider initializes
2.  [Frontend] AuthContext: isLoading=true
3.  [UI] AuthGuard renders full-page spinner (blue-600, centered on gray-50 bg)
4.  [Frontend] usePrivy() checks for existing Privy session
5.  [Frontend] If session exists: sends GET /api/v1/auth/me with session cookie
6.  [Backend] Verifies token, returns user profile + company data
    → IF valid: 200 with full profile
    → IF invalid: 401
7a. [Frontend] On 200: AuthContext populated, isLoading=false, page renders normally
7b. [Frontend] On 401: triggers session expired flow → redirect to /login
8.  [Frontend] If no Privy session: isAuthenticated=false → redirect to /login

POSTCONDITION: User sees page (valid) or is on /login (expired)
```

---

### Frontend Happy Path: Logout

```
PRECONDITION: User is authenticated
ACTOR: Authenticated user
TRIGGER: User clicks "Sair" in sidebar

1. [UI] User clicks "Sair" in sidebar bottom section
2. [Frontend] authContext.logout() called
3. [Frontend] POST /api/v1/auth/logout
4. [Backend] Clears navia-auth-token cookie, returns 200
5. [Frontend] privy.logout() clears Privy session
6. [Frontend] AuthContext: user=null, isAuthenticated=false
7. [Frontend] Redirects to /login
8. [UI] LoginPage renders (no expired banner)

POSTCONDITION: Fully logged out (backend + Privy + frontend state)
SIDE EFFECTS: Audit (AUTH_LOGOUT)
```

---

### Frontend Error Path: Session Expiry

```
PRECONDITION: User has expired session (2h inactivity or 7d absolute)
ACTOR: Authenticated user
TRIGGER: Any API call returns 401

1.  [Frontend] User action triggers API call
2.  [Backend] AuthGuard detects expired token, returns 401
3.  [Frontend] API client 401 interceptor fires
4.  [Frontend] authContext.logout()
5.  [Frontend] POST /api/v1/auth/logout (best-effort, failure ignored)
6.  [Frontend] privy.logout()
7.  [Frontend] AuthContext cleared
8.  [UI] Toast (warning): "Sua sessao expirou. Faca login novamente."
9.  [Frontend] Redirects to /login?expired=true
10. [UI] LoginPage renders with info banner: blue-50 bg, blue-600 text

POSTCONDITION: User on /login, session cleared
```

---

### Frontend Error Path: Backend Sync Failure After Privy Auth

```
PRECONDITION: Privy auth succeeded, backend sync fails
ACTOR: User
TRIGGER: POST /api/v1/auth/login returns 5xx

1.  [Frontend] Privy auth completes successfully
2.  [Frontend] POST /api/v1/auth/login returns 500/502/503
3.  [UI] Error toast shown (Sonner, destructive variant)
    → 502: "Servico de autenticacao indisponivel. Tente novamente."
    → 500: "Erro interno do servidor. Tente novamente."
4.  [UI] "Entrar" button re-enabled
5.  [Frontend] Privy remains authenticated (token valid) but AuthContext has no user
6.  [UI] User can retry by clicking "Entrar" again

POSTCONDITION: User on /login, Privy session active but no backend session
```

---

### Frontend Error Path: Account Locked

```
PRECONDITION: IP has >= 5 failed attempts in 15 minutes
ACTOR: User
TRIGGER: Login attempt from locked IP

1.  [Frontend] POST /api/v1/auth/login returns 429 AUTH_ACCOUNT_LOCKED
2.  [UI] Error toast (destructive): "Conta bloqueada por excesso de tentativas. Tente novamente em 15 minutos."
3.  [UI] "Entrar" button re-enabled
4.  [Frontend] No redirect — user stays on /login

POSTCONDITION: Login blocked until lockout expires
```

---

### Frontend Error Path: Onboarding Validation Errors

```
PRECONDITION: User is on onboarding wizard
ACTOR: User filling out form
TRIGGER: Form submission with invalid data

A) Client-side validation failure:
1.  [UI] User clicks "Continuar" or "Criar Empresa"
2.  [Frontend] React Hook Form + Zod validates
3.  [UI] Invalid fields get red border (2px #DC2626) + error text below (12px, #DC2626)
4.  [Frontend] No API call made

B) Server-side validation failure (400):
1.  [Frontend] Sends PUT /api/v1/users/me or POST /api/v1/companies
2.  [Backend] Returns 400 with validationErrors array
3.  [Frontend] applyServerErrors() maps errors to form fields
4.  [UI] Fields show red borders + server error messages (translated via messageKey)

C) CNPJ duplicate (409):
1.  [Frontend] POST /api/v1/companies
2.  [Backend] Returns 409 COMPANY_CNPJ_DUPLICATE
3.  [Frontend] Sets inline error on CNPJ field
4.  [UI] CNPJ field shows red border + "CNPJ ja cadastrado" message

POSTCONDITION: User stays on current step, can fix errors and retry
```

---

## Frontend Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| — | Route guard (/login) | Already authenticated + has company | Redirect | /dashboard |
| — | Route guard (/login) | Already authenticated + needsOnboarding | Redirect | /onboarding |
| — | Route guard (dashboard) | Not authenticated | Redirect | /login |
| — | Route guard (dashboard) | Needs onboarding | Redirect | /onboarding |
| 7 | Post-login routing | New user (firstName=null) | Onboarding | /onboarding Step 1 |
| 7 | Post-login routing | Existing user, no company | Onboarding | /onboarding Step 2 |
| 7 | Post-login routing | Existing user, has company | Dashboard | /dashboard |
| 7 | Post-login routing | Has invitation token in URL | Invitation | /invitations/:token |
| 9 | Onboarding step selection | user.firstName is null | Step 1 | PersonalInfoStep |
| 9 | Onboarding step selection | user.firstName exists, no company | Step 2 | CompanyCreationStep |
| 16 | Client validation (Step 1) | Form invalid | Error | Field-level errors shown |
| 17 | Server response (Step 1) | 400 validation error | Error | Map to form fields |
| 17 | Server response (Step 1) | 5xx server error | Error | Error toast |
| 23 | Client validation (Step 2) | CNPJ checksum invalid | Error | Field error on CNPJ |
| 24 | Server response (Step 2) | 409 CNPJ duplicate | Error | Inline error on CNPJ field |
| 24 | Server response (Step 2) | 400 validation error | Error | Map to form fields |
| — | API 401 interceptor | Any 401 response | Session expired | Toast + redirect /login?expired=true |

---

## Frontend State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| AuthContext | isAuthenticated | false | true | Privy auth + backend sync success |
| AuthContext | user | null | User object | POST /api/v1/auth/login success |
| AuthContext | needsOnboarding | — | true | Login response: firstName=null OR hasCompany=false |
| AuthContext | needsOnboarding | true | false | Company created (POST /api/v1/companies success) |
| AuthContext | hasCompany | false | true | Company created |
| AuthContext | isAuthenticated | true | false | Logout or 401 interceptor |
| AuthContext | user | User object | null | Logout or 401 interceptor |
| OnboardingWizard | currentStep | 1 | 2 | PersonalInfoStep submit success |
| User (backend) | firstName | null | "Joao" | PUT /api/v1/users/me |
| User (backend) | lastName | null | "Silva" | PUT /api/v1/users/me |
