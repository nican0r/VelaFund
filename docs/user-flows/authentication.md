# Authentication — User Flows

**Feature**: User authentication via Privy SDK with JWT verification, Redis-backed session management, and cookie-based sessions
**Actors**: Unauthenticated user, Authenticated user
**Preconditions**: Privy app configured (PRIVY_APP_ID, PRIVY_APP_SECRET), Redis available (optional, graceful degradation)
**Related Flows**: [Company Management](./company-management.md) (requires auth), [KYC Verification](./kyc-verification.md) (requires auth)

---

## Flow Map

```
User opens Navia
  |
  +-- [has valid session cookie] --> AuthGuard resolves session
  |     |
  |     +-- [Redis available] --> Look up session by ID in Redis
  |     |     |
  |     |     +-- [session found + active (< 2h idle)] --> Touch session, load user from DB --> Access granted
  |     |     +-- [session found + inactive (>= 2h idle)] --> Destroy session, throw 401 SESSION_EXPIRED
  |     |     +-- [session not found (expired/invalid)] --> Fall through to Privy token verification
  |     |
  |     +-- [Redis unavailable] --> Fall through to Privy token verification
  |     |
  |     +-- [Privy token in cookie (legacy/fallback)] --> Verify via Privy SDK
  |           |
  |           +-- [token valid + user exists + not deleted] --> Access granted, user attached to request
  |           +-- [token valid + user deleted] --> 401 Unauthorized
  |           +-- [token invalid/expired] --> 401 Unauthorized
  |
  +-- [Authorization: Bearer header (API clients)] --> Verify via Privy SDK
  |     |
  |     +-- [token valid + user exists] --> Access granted
  |     +-- [any failure] --> 401 Unauthorized
  |
  +-- [no session/token] --> 401 Unauthorized, redirect to login
        |
        +-- User clicks "Login"
              |
              +-- [Privy auth succeeds] --> Frontend sends POST /api/v1/auth/login
              |     |
              |     +-- [IP locked out] --> 429 Too Many Requests
              |     |
              |     +-- [token verification fails] --> 401, failed attempt recorded
              |     |     |
              |     |     +-- [5th failure from same IP] --> IP locked for 15 min
              |     |
              |     +-- [Privy user fetch fails] --> 502 Bad Gateway
              |     |
              |     +-- [no email on Privy user] --> 401 Unauthorized
              |     |
              |     +-- [email exists with different Privy ID] --> 409 Conflict
              |     |
              |     +-- [all checks pass] --> User found/created
              |           |
              |           +-- [existing user] --> lastLoginAt updated, wallet synced
              |           +-- [new user] --> User created in DB
              |
              |     --> Redis session created (64-char hex ID)
              |     --> Session ID stored in HTTP-only cookie (7d maxAge)
              |     --> [Redis unavailable: Privy token stored in cookie as fallback]
              |     --> User data returned
              |
              +-- [Privy auth fails] --> Privy SDK shows error in modal

User clicks "Logout"
  |
  +-- POST /api/v1/auth/logout (@Public)
        |
        +-- Read session ID from cookie
        +-- Destroy Redis session (if exists)
        +-- Clear cookie
        +-- Redirect to login

User session becomes inactive (>= 2h without requests)
  |
  +-- Next request arrives
        |
        +-- AuthGuard finds session in Redis
        +-- Checks lastActivityAt: inactive >= 2h
        +-- Destroys session in Redis
        +-- Returns 401 with errors.auth.sessionExpired
        +-- Frontend shows expiry toast, redirects to /login?expired=true

User visits GET /api/v1/auth/me
  |
  +-- [authenticated (session or token)] --> Full profile returned
  +-- [not authenticated] --> 401 Unauthorized
```

---

## Session Management

### Redis-Backed Sessions (v0.0.17 — BUG-1 Fix)

Before v0.0.17, the raw Privy access token was stored directly in the session cookie. Privy tokens expire in 1-6 hours, but the session cookie had a 7-day maxAge, causing 401 errors after the Privy token expired within the cookie lifetime. This was BUG-1 (CRITICAL).

The fix introduces a Redis-backed session store:

| Aspect | Detail |
|--------|--------|
| Session ID format | 64-character hex string (`crypto.randomBytes(32).toString('hex')`) |
| Cookie name | `navia-auth-token` (unchanged) |
| Cookie value | Session ID (no longer the raw Privy token) |
| Cookie flags | `httpOnly: true`, `secure: true` (production), `sameSite: strict`, `path: /` |
| Cookie maxAge | 7 days (absolute session limit) |
| Redis key pattern | `session:{sessionId}` |
| Redis TTL | 7 days (absolute timeout enforced by Redis expiry) |
| User sessions set | `user-sessions:{userId}` (Redis SET of session IDs for bulk invalidation) |

### Session Data Structure

```typescript
interface SessionData {
  userId: string;          // Navia user ID (database PK)
  createdAt: number;       // Unix timestamp ms — when session was created
  lastActivityAt: number;  // Unix timestamp ms — last request timestamp
  ipAddress: string;       // IP at session creation time
  userAgent: string;       // User-Agent at session creation time
}
```

### Timeout Rules

| Timeout | Duration | Enforcement |
|---------|----------|-------------|
| Absolute timeout | 7 days | Redis TTL on the session key. Session auto-deleted by Redis after 7 days regardless of activity. |
| Inactivity timeout | 2 hours | Checked by AuthGuard on each request. If `Date.now() - lastActivityAt > 2h`, session is destroyed and 401 returned. |
| Activity touch throttle | 60 seconds | `lastActivityAt` is only written to Redis if >60s since the last update, reducing Redis write load on rapid sequential requests. |

### Graceful Degradation

If Redis is unavailable (not configured or connection failed):

1. **Login**: `SessionService.createSession()` returns `null`. The controller falls back to storing the raw Privy access token in the cookie (legacy behavior, subject to BUG-1 token expiry).
2. **AuthGuard**: When `sessionService.isAvailable()` returns `false`, the guard skips the Redis session lookup and falls through directly to Privy token verification from the cookie value.
3. **Logout**: `SessionService.destroySession()` is a no-op when Redis is unavailable. The cookie is still cleared.

This ensures the application remains functional without Redis, with degraded session reliability.

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
   -> IF locked: return 429 AUTH_ACCOUNT_LOCKED
9. [Backend] Verifies Privy access token via privyClient.utils().auth().verifyAccessToken()
   -> IF invalid: record failed attempt, return 401 AUTH_INVALID_TOKEN
10. [Backend] Fetches Privy user profile via privyClient.users()._get(userId)
    -> IF Privy unavailable: return 502 AUTH_PRIVY_UNAVAILABLE
11. [Backend] Extracts email from linked_accounts (email type, then google_oauth, then apple_oauth fallback)
    -> IF no email: return 401 AUTH_INVALID_TOKEN
12. [Backend] Begins database transaction
13. [Backend] Finds user by privyUserId in database
14. [Backend] Updates lastLoginAt, syncs wallet if changed; checks email conflict before syncing email
15. [Backend] Commits transaction
16. [Backend] Clears any failed login attempts for this IP
17. [Backend] Creates Redis session via SessionService.createSession(userId, { ipAddress, userAgent })
    -> Session data: { userId, createdAt: now, lastActivityAt: now, ipAddress, userAgent }
    -> Redis key: session:{64-char-hex-id}, TTL: 7 days
    -> Session ID added to user-sessions:{userId} Redis set
    -> IF Redis unavailable: sessionId is null, fall back to Privy token as cookie value
18. [Backend] Sets HTTP-only cookie: navia-auth-token = sessionId (7d maxAge, SameSite=Strict)
19. [Backend] Returns 200 with { user, isNewUser: false }
20. [UI] Stores user data in state
21. [UI] Redirects to /dashboard

POSTCONDITION: User is authenticated, Redis session created, session ID stored in cookie
SIDE EFFECTS: User.lastLoginAt updated, failed attempts cleared for IP, Redis session created
```

### Happy Path: Login (New User — First Time)

```
PRECONDITION: User authenticated via Privy but no Navia account exists
ACTOR: New user
TRIGGER: First login after Privy authentication

Steps 1-12: Same as existing user login (through transaction begin)
13. [Backend] No user found by privyUserId
14. [Backend] Checks if email exists with different Privy ID
    -> IF exists: return 409 AUTH_DUPLICATE_EMAIL
15. [Backend] Creates new user in database with Privy data (email, wallet, name from Google/Apple OAuth or email local part)
16-21: Same as existing user login, with isNewUser: true

POSTCONDITION: New user created in database, Redis session created, session ID stored in cookie
SIDE EFFECTS: New User record created with kycStatus=NOT_STARTED, locale=pt-BR, Redis session created
```

### Happy Path: Logout

```
PRECONDITION: User has a session cookie (valid or expired)
ACTOR: User (authenticated or with expired cookie)
TRIGGER: User clicks logout button

1. [UI] User clicks "Logout" in navigation
2. [Frontend] Sends POST /api/v1/auth/logout
3. [Backend] Endpoint is @Public() — no auth check needed (allows expired-cookie users to clear cookies)
4. [Backend] Reads session ID from req.cookies['navia-auth-token']
5. [Backend] Destroys Redis session via SessionService.destroySession(sessionId)
   -> Looks up session data to find userId
   -> Removes sessionId from user-sessions:{userId} Redis set
   -> Deletes session:{sessionId} Redis key
   -> IF Redis unavailable or session not found: no-op (best-effort cleanup)
6. [Backend] Clears navia-auth-token cookie
7. [Backend] Returns 200 with { messageKey: "errors.auth.loggedOut" }
8. [Frontend] Clears local user state
9. [UI] Redirects to /login

POSTCONDITION: Redis session destroyed, cookie cleared, user redirected to login
```

### Happy Path: Get Profile

```
PRECONDITION: User is authenticated
ACTOR: Authenticated user
TRIGGER: Frontend requests user profile (page load, navigation)

1. [Frontend] Sends GET /api/v1/auth/me (cookie-based auth)
2. [Backend] AuthGuard extracts session ID from cookie
3. [Backend] Looks up session in Redis, checks inactivity, touches session
4. [Backend] Loads user from database by session's userId
5. [Backend] AuthService.getProfile fetches full user data
6. [Backend] Returns 200 with user profile data

POSTCONDITION: None (read-only). Session lastActivityAt may be updated (if >60s since last touch).
```

### Error Path: Session Expired (Inactivity)

```
PRECONDITION: User has a session cookie, but has been inactive >= 2 hours
ACTOR: Authenticated user returning after idle period
TRIGGER: Any authenticated request after inactivity timeout

1. [Frontend] User action triggers API call with session cookie
2. [Backend] AuthGuard reads session ID from cookie
3. [Backend] Looks up session in Redis: session found
4. [Backend] Checks inactivity: Date.now() - session.lastActivityAt >= 2 hours
5. [Backend] Destroys expired session in Redis (deletes session key + removes from user set)
6. [Backend] Throws 401 with errors.auth.sessionExpired
7. [Frontend] API client 401 interceptor fires
8. [Frontend] authContext.logout() — clears local state
9. [Frontend] POST /api/v1/auth/logout (best-effort, failure ignored)
10. [Frontend] privy.logout()
11. [UI] Toast (warning): "Sua sessao expirou. Faca login novamente."
12. [Frontend] Redirects to /login?expired=true
13. [UI] LoginPage renders with info banner

POSTCONDITION: Redis session destroyed, user on /login
```

### Error Path: Session Expired (Absolute Timeout)

```
PRECONDITION: Session has been active for 7+ days
ACTOR: Authenticated user
TRIGGER: Any authenticated request after absolute timeout

1. [Frontend] User action triggers API call with session cookie
2. [Backend] AuthGuard reads session ID from cookie
3. [Backend] Looks up session in Redis: session NOT found (Redis TTL expired and auto-deleted the key)
4. [Backend] Falls through to Privy token verification (Path 2)
5. [Backend] Cookie contains a session ID (not a Privy token) — Privy verification fails
6. [Backend] Returns 401 with errors.auth.invalidToken
7-13. Same as inactivity expiry flow (frontend 401 handler)

POSTCONDITION: Session already gone from Redis (TTL), user on /login
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

### Error Path: Redis Unavailable at Login

```
PRECONDITION: Redis is not configured or connection failed
ACTOR: User
TRIGGER: Login attempt when Redis is down

1-16: Same as happy path (login succeeds through Privy verification and DB operations)
17. [Backend] SessionService.createSession() returns null (Redis unavailable)
18. [Backend] Falls back to storing the raw Privy access token in the cookie (legacy behavior)
19. [Backend] Sets HTTP-only cookie with Privy token instead of session ID
20. [Backend] Returns 200 with user data (login succeeds)

NOTE: With this fallback, the session is subject to BUG-1 behavior — the Privy token
in the cookie will expire in 1-6 hours even though the cookie has a 7-day maxAge.
Subsequent requests will use Privy token verification (Path 2 in AuthGuard) until the
token expires, at which point the user must re-login.

POSTCONDITION: User authenticated, but without Redis session resilience
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
| 17 | Redis session creation | Redis available | Happy | Session ID stored in cookie |
| 17 | Redis session creation | Redis unavailable | Fallback | Privy token stored in cookie (legacy) |
| Guard | Session lookup | Session found + active (<2h idle) | Happy | Touch session, load user |
| Guard | Session lookup | Session found + inactive (>=2h idle) | Error | Destroy session, 401 SESSION_EXPIRED |
| Guard | Session lookup | Session not found | Fallback | Fall through to Privy token verification |
| Guard | Redis availability | Redis unavailable | Fallback | Skip session lookup, use Privy token verification |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| User | -- | -- (not exists) | Created | First login (new user) |
| User | lastLoginAt | previous timestamp | now() | Every successful login |
| User | walletAddress | old address | new address | Wallet changed in Privy |
| User | email | old email | new email | Email changed in Privy |
| Redis session | -- | -- (not exists) | Created with userId, timestamps, metadata | Successful login (Redis available) |
| Redis session | lastActivityAt | previous timestamp | now() | Any authenticated request (throttled: >60s gap) |
| Redis session | -- | Exists | Deleted | Logout, inactivity timeout, or Redis TTL expiry |
| Redis user-sessions set | -- | -- | sessionId added | Session created |
| Redis user-sessions set | -- | sessionId present | sessionId removed | Session destroyed |

---

## Auth Token Flow (Request Lifecycle)

Every request goes through three global guards in order: ThrottlerGuard -> AuthGuard -> RolesGuard.

```
HTTP Request arrives
  |
  +-- ThrottlerGuard checks rate limit
  |     |
  |     +-- [within limit] --> Continue
  |     +-- [exceeded] --> 429 Too Many Requests
  |
  +-- [route has @Public()] --> Skip auth, proceed to RolesGuard
  |
  +-- [no @Public()] --> AuthGuard activates
        |
        +-- PATH 1: Session-based auth (primary when Redis available)
        |     |
        |     +-- [navia-auth-token cookie present + Redis available]
        |           |
        |           +-- SessionService.getSession(cookieValue)
        |                 |
        |                 +-- [session found in Redis]
        |                 |     |
        |                 |     +-- [inactive: now - lastActivityAt >= 2h]
        |                 |     |     |
        |                 |     |     +-- SessionService.destroySession(sessionId)
        |                 |     |     +-- 401 errors.auth.sessionExpired
        |                 |     |
        |                 |     +-- [active: within 2h window]
        |                 |           |
        |                 |           +-- SessionService.touchSession(sessionId, session)
        |                 |           |   (writes lastActivityAt only if >60s since last touch)
        |                 |           |
        |                 |           +-- AuthService.getUserById(session.userId)
        |                 |                 |
        |                 |                 +-- [user exists + not deleted] --> Attach user, DONE
        |                 |                 +-- [user not found / deleted] --> 401
        |                 |
        |                 +-- [session NOT found] --> Fall through to Path 2
        |
        +-- PATH 2: Privy token verification (fallback / API clients)
        |     |
        |     +-- [Authorization: Bearer <token>] --> Use header token
        |     +-- [navia-auth-token cookie (no Redis / session not found)] --> Use cookie value
        |     +-- [neither] --> 401 Unauthorized
        |           |
        |           +-- Token extracted
        |                 |
        |                 +-- AuthService.verifyTokenAndGetUser(token)
        |                       |
        |                       +-- [valid + user exists + not deleted] --> Attach user to request
        |                       +-- [any failure] --> 401 Unauthorized
        |
        +-- RolesGuard activates
              |
              +-- [no @Roles() decorator] --> Proceed to handler
              |
              +-- [@Roles() present] --> Check company membership
                    |
                    +-- [no :companyId param] --> 403 Forbidden
                    |
                    +-- [not ACTIVE member] --> 404 Not Found (prevents enumeration)
                    |
                    +-- [role not in required list] --> 403 Forbidden
                    |
                    +-- [role matches] --> Attach companyMember to request, proceed
```

---

## By Role

All authentication endpoints are role-agnostic -- they operate on the authenticated user identity.

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
  |
  +-- /login --> LoginPage renders
  |     |
  |     +-- [already authenticated + has company] --> Redirect to /dashboard
  |     +-- [already authenticated + needsOnboarding] --> Redirect to /onboarding
  |     +-- [not authenticated] --> Show login card
  |           |
  |           +-- User clicks "Entrar"
  |                 |
  |                 +-- [Privy modal opens] --> User authenticates
  |                 |     |
  |                 |     +-- [Privy success] --> POST /api/v1/auth/login
  |                 |     |     |
  |                 |     |     +-- [new user, no profile] --> /onboarding Step 1
  |                 |     |     +-- [existing user, no company] --> /onboarding Step 2
  |                 |     |     +-- [existing user, has company] --> /dashboard
  |                 |     |     +-- [429 locked] --> Error toast, stay on /login
  |                 |     |     +-- [502 Privy down] --> Error toast, stay on /login
  |                 |     |     +-- [5xx error] --> Error toast, stay on /login
  |                 |     |
  |                 |     +-- [Privy cancel/fail] --> Modal closes, no state change
  |                 |
  |                 +-- [?expired=true in URL] --> Info banner above button
  |
  +-- /onboarding --> AuthGuard checks auth
  |     |
  |     +-- [not authenticated] --> Redirect to /login
  |     +-- [has company already] --> Redirect to /dashboard
  |     +-- [authenticated, needs onboarding] --> OnboardingWizard renders
  |           |
  |           +-- [user.firstName is null] --> Step 1: PersonalInfoStep
  |           |     |
  |           |     +-- [fills form + submits] --> PUT /api/v1/users/me
  |           |     |     +-- [success] --> Advance to Step 2
  |           |     |     +-- [400 validation] --> Field-level errors
  |           |     |     +-- [5xx] --> Error toast
  |           |     |
  |           |     +-- [closes browser] --> Next login resumes at Step 1
  |           |
  |           +-- [user.firstName exists, no company] --> Step 2: CompanyCreationStep
  |                 |
  |                 +-- [fills form + submits] --> POST /api/v1/companies
  |                 |     +-- [201 success] --> Redirect to /dashboard
  |                 |     +-- [409 CNPJ duplicate] --> Inline error on CNPJ field
  |                 |     +-- [400 validation] --> Field-level errors
  |                 |     +-- [5xx] --> Error toast
  |                 |
  |                 +-- [closes browser] --> Next login resumes at Step 2
  |
  +-- /(dashboard)/* --> AuthGuard checks auth
        |
        +-- [isLoading] --> Full-page spinner
        +-- [not authenticated] --> Redirect to /login
        +-- [needsOnboarding] --> Redirect to /onboarding
        +-- [authenticated + has company] --> Render dashboard page
              |
              +-- [any API call returns 401] --> Session expired flow
              |     +-- authContext.logout()
              |     +-- Toast: "Sua sessao expirou"
              |     +-- Redirect to /login?expired=true
              |
              +-- [user clicks "Sair"] --> Logout flow
                    +-- POST /api/v1/auth/logout (destroys Redis session + clears cookie)
                    +-- privy.logout()
                    +-- Redirect to /login
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
9.  [Backend] Verifies token, creates new User record, creates Redis session (64-char hex ID), sets HTTP-only cookie with session ID
10. [Backend] Returns 200: { user: { id, email, firstName: null, ... }, isNewUser: true, hasCompany: false }
11. [Frontend] AuthContext updates: isAuthenticated=true, needsOnboarding=true
12. [Frontend] AuthGuard detects needsOnboarding, redirects to /onboarding
13. [UI] OnboardingWizard renders Step 1 (PersonalInfoStep)
    - Stepper: (1) Suas Informacoes [active, blue-600] -- (2) Sua Empresa [pending, gray-300]
14. [UI] User fills firstName, lastName; email is pre-filled from Privy
15. [UI] User clicks "Continuar"
16. [Frontend] Client-side validation (React Hook Form + Zod)
    -> IF invalid: red borders + error text on fields, STOP
17. [Frontend] Sends PUT /api/v1/users/me with { firstName, lastName, email }
18. [Backend] Validates, updates user, returns updated profile
19. [Frontend] AuthContext user data updated (firstName, lastName populated)
20. [UI] OnboardingWizard advances to Step 2
    - Stepper: (1) Suas Informacoes [complete, green check] -- (2) Sua Empresa [active, blue-600]
21. [UI] User fills company name, entityType, CNPJ, optional fields
22. [UI] User clicks "Criar Empresa"
23. [Frontend] Client-side validation (including CNPJ checksum)
    -> IF invalid: red borders + error text on fields, STOP
24. [Frontend] Sends POST /api/v1/companies with company data
25. [Backend] Validates, creates company (DRAFT), queues CNPJ validation job
26. [Backend] Returns 201: { id, name, status: 'DRAFT', ... }
27. [Frontend] AuthContext: hasCompany=true, needsOnboarding=false
28. [Frontend] Redirects to /dashboard
29. [UI] Dashboard renders

POSTCONDITION: User has profile + company in DRAFT status, Redis session active
SIDE EFFECTS:
  - Audit: AUTH_LOGIN_SUCCESS, COMPANY_CREATED
  - CNPJ validation Bull job queued
  - Blockchain contract deployment queued (after CNPJ validation)
  - Redis session created with 7-day TTL
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
6.  [Backend] Verifies token, finds user, updates lastLoginAt, creates Redis session, sets session cookie
7.  [Backend] Returns 200: { user, isNewUser: false, hasCompany: true }
8.  [Frontend] AuthContext: isAuthenticated=true, hasCompany=true, needsOnboarding=false
9.  [Frontend] AuthGuard allows access
10. [UI] User lands on /dashboard

POSTCONDITION: User authenticated, Redis session active, on dashboard
SIDE EFFECTS: Audit (AUTH_LOGIN_SUCCESS), User.lastLoginAt updated, Redis session created
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
     -> IF user.firstName is null: render Step 1
     -> IF user.firstName exists but no company: render Step 2
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
6.  [Backend] AuthGuard reads session ID from cookie, looks up session in Redis
    -> IF session found + active: touches lastActivityAt, loads user from DB, returns 200
    -> IF session found + inactive (>= 2h): destroys session, returns 401
    -> IF session not found: falls through to Privy token verification (likely fails since cookie has session ID), returns 401
7a. [Frontend] On 200: AuthContext populated, isLoading=false, page renders normally
7b. [Frontend] On 401: triggers session expired flow -> redirect to /login
8.  [Frontend] If no Privy session: isAuthenticated=false -> redirect to /login

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
4. [Backend] Reads session ID from req.cookies['navia-auth-token']
5. [Backend] Destroys Redis session: deletes session:{sessionId} key, removes from user-sessions:{userId} set
6. [Backend] Clears navia-auth-token cookie, returns 200
7. [Frontend] privy.logout() clears Privy session
8. [Frontend] AuthContext: user=null, isAuthenticated=false
9. [Frontend] Redirects to /login
10. [UI] LoginPage renders (no expired banner)

POSTCONDITION: Fully logged out (Redis session destroyed + Privy cleared + cookie cleared + frontend state cleared)
SIDE EFFECTS: Audit (AUTH_LOGOUT), Redis session destroyed
```

---

### Frontend Error Path: Session Expiry

```
PRECONDITION: User has expired session (2h inactivity or 7d absolute)
ACTOR: Authenticated user
TRIGGER: Any API call returns 401

1.  [Frontend] User action triggers API call
2.  [Backend] AuthGuard detects expired/missing session:
    -> Inactivity (>= 2h): session found but lastActivityAt too old, session destroyed, 401 errors.auth.sessionExpired
    -> Absolute (7d): session not found in Redis (TTL expired), falls through to Privy verification (fails), 401
3.  [Frontend] API client 401 interceptor fires
4.  [Frontend] authContext.logout()
5.  [Frontend] POST /api/v1/auth/logout (best-effort, failure ignored — session may already be destroyed)
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
    -> 502: "Servico de autenticacao indisponivel. Tente novamente."
    -> 500: "Erro interno do servidor. Tente novamente."
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
| -- | Route guard (/login) | Already authenticated + has company | Redirect | /dashboard |
| -- | Route guard (/login) | Already authenticated + needsOnboarding | Redirect | /onboarding |
| -- | Route guard (dashboard) | Not authenticated | Redirect | /login |
| -- | Route guard (dashboard) | Needs onboarding | Redirect | /onboarding |
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
| -- | API 401 interceptor | Any 401 response | Session expired | Toast + redirect /login?expired=true |

---

## Frontend State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| AuthContext | isAuthenticated | false | true | Privy auth + backend sync success |
| AuthContext | user | null | User object | POST /api/v1/auth/login success |
| AuthContext | needsOnboarding | -- | true | Login response: firstName=null OR hasCompany=false |
| AuthContext | needsOnboarding | true | false | Company created (POST /api/v1/companies success) |
| AuthContext | hasCompany | false | true | Company created |
| AuthContext | isAuthenticated | true | false | Logout or 401 interceptor |
| AuthContext | user | User object | null | Logout or 401 interceptor |
| OnboardingWizard | currentStep | 1 | 2 | PersonalInfoStep submit success |
| User (backend) | firstName | null | "Joao" | PUT /api/v1/users/me |
| User (backend) | lastName | null | "Silva" | PUT /api/v1/users/me |
