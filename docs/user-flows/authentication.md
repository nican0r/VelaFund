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
