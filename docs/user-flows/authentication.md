# Authentication — User Flows

**Feature**: User authentication via Privy SDK with JWT verification and cookie-based sessions
**Actors**: Unauthenticated user, Authenticated user
**Preconditions**: Privy app configured (PRIVY_APP_ID, PRIVY_APP_SECRET)
**Related Flows**: [Company Creation](./company-creation.md) (requires auth), [KYC Verification](./kyc-verification.md) (requires auth)

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
  └─ POST /api/v1/auth/logout ─→ Cookie cleared ─→ Redirect to login

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
11. [Backend] Extracts email from linked_accounts (email type, then google_oauth fallback)
    → IF no email: return 401 AUTH_INVALID_TOKEN
12. [Backend] Finds user by privyUserId in database
13. [Backend] Updates lastLoginAt, syncs wallet/email if changed in Privy
14. [Backend] Clears any failed login attempts for this IP
15. [Backend] Sets HTTP-only cookie: navia-auth-token (7d, SameSite=Strict)
16. [Backend] Returns 200 with { user, isNewUser: false }
17. [UI] Stores user data in state
18. [UI] Redirects to /dashboard

POSTCONDITION: User is authenticated, session cookie is set
SIDE EFFECTS: User.lastLoginAt updated, failed attempts cleared for IP
```

### Happy Path: Login (New User — First Time)

```
PRECONDITION: User authenticated via Privy but no Navia account exists
ACTOR: New user
TRIGGER: First login after Privy authentication

Steps 1-11: Same as existing user login
12. [Backend] No user found by privyUserId
13. [Backend] Checks if email exists with different Privy ID
    → IF exists: return 409 AUTH_DUPLICATE_EMAIL
14. [Backend] Creates new user in database with Privy data (email, wallet, name from Google OAuth if available)
15-18: Same as existing user login, with isNewUser: true

POSTCONDITION: New user created in database, session cookie set
SIDE EFFECTS: New User record created with kycStatus=NOT_STARTED, locale=pt-BR
```

### Happy Path: Logout

```
PRECONDITION: User is authenticated
ACTOR: Authenticated user
TRIGGER: User clicks logout button

1. [UI] User clicks "Logout" in navigation
2. [Frontend] Sends POST /api/v1/auth/logout
3. [Backend] Clears navia-auth-token cookie
4. [Backend] Returns 200 with { message: "Logged out successfully" }
5. [Frontend] Clears local user state
6. [UI] Redirects to /login

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
| 11 | Email extraction | No email in linked_accounts | Error | 401 AUTH_INVALID_TOKEN |
| 12 | User lookup | No user with this privyUserId | Happy | Create new user (step 13-14) |
| 12 | User lookup | User exists with this privyUserId | Happy | Update existing user |
| 13 | Email uniqueness | Email exists with different privyUserId | Error | 409 AUTH_DUPLICATE_EMAIL |

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

Every authenticated request goes through this flow:

```
HTTP Request arrives
  │
  ├─ [route has @Public()] ─→ Skip auth, proceed to handler
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
                          ├─ [valid + user exists + not deleted] ─→ Attach user to request, proceed
                          └─ [any failure] ─→ 401 Unauthorized
```

---

## By Role

All authentication endpoints are role-agnostic — they operate on the authenticated user identity.

| Endpoint | Unauthenticated | Any Authenticated User |
|----------|----------------|----------------------|
| POST /api/v1/auth/login | Allowed (@Public) | Allowed (re-login) |
| POST /api/v1/auth/logout | 401 | Allowed |
| GET /api/v1/auth/me | 401 | Allowed |
| GET /api/v1/health | Allowed (@Public) | Allowed |
