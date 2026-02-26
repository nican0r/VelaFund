# Public Profile Page — User Flows

**Feature**: Public-facing company profile viewable by anyone with the link
**Actors**: Public visitor (unauthenticated), Founder (authenticated, via share link)
**Preconditions**: Company profile must be PUBLISHED and have a slug
**Related Flows**: [Company Profile](./company-profile.md) (profile creation/publish), [Company Dataroom](./company-dataroom.md) (document uploads), [Company Litigation](./company-litigation.md) (litigation data)

---

## Flow Map

```
Visitor opens /p/[slug]
  │
  ├─ [profile exists + PUBLIC access] ─→ GET /api/v1/profiles/:slug
  │     │
  │     ├─ [200 OK] ─→ Render full profile (header, metrics, team, docs, litigation)
  │     └─ [500/network error] ─→ Show "not found" fallback
  │
  ├─ [profile exists + EMAIL_GATED] ─→ 403 PROFILE_EMAIL_REQUIRED
  │     │
  │     └─ Show email gate form
  │           │
  │           ├─ [submit email] ─→ GET /api/v1/profiles/:slug?email=...
  │           │     │
  │           │     ├─ [200 OK] ─→ Render full profile
  │           │     └─ [error] ─→ Show error message on form
  │           │
  │           └─ [empty email] ─→ Button disabled
  │
  ├─ [profile exists + PASSWORD] ─→ 401 PROFILE_PASSWORD_REQUIRED
  │     │
  │     └─ Show password gate form
  │           │
  │           ├─ [submit correct password] ─→ GET /api/v1/profiles/:slug?password=...
  │           │     │
  │           │     ├─ [200 OK] ─→ Render full profile
  │           │     └─ [401 invalid password] ─→ Show "Incorrect password" error
  │           │
  │           └─ [empty password] ─→ Button disabled
  │
  └─ [profile not found / unpublished / invalid slug] ─→ 404
        │
        └─ Show "Profile not found" view
```

---

## Flows

### Happy Path: View Public Profile (PUBLIC Access)

```
PRECONDITION: Profile is PUBLISHED with accessType PUBLIC
ACTOR: Public visitor (unauthenticated)
TRIGGER: Visitor navigates to /p/[slug]

1. [UI] Page mounts, shows loading skeleton
2. [Frontend] Sends GET /api/v1/profiles/:slug (no auth required)
3. [Backend] Looks up profile by slug
4. [Backend] Verifies profile is PUBLISHED
5. [Backend] Records page view (increments viewCount)
6. [Backend] Returns 200 with full profile data
7. [UI] Renders profile:
   - Header: logo (or initial), company name, headline, sector badge, founded year, location, website link
   - About: description text
   - Key Metrics: cards with formatted values (BRL currency, percentages, numbers)
   - Team: member cards with photo/initials, name, title, LinkedIn link
   - Documents: file list with category badge, size, page count, download button
   - Litigation: risk level badge, active lawsuit count, last checked date
   - Footer: "Powered by Navia" branding

POSTCONDITION: Profile view count incremented
SIDE EFFECTS: View count recorded in database
```

### Alternative Path: Email-Gated Access

```
PRECONDITION: Profile is PUBLISHED with accessType EMAIL_GATED
ACTOR: Public visitor
TRIGGER: Visitor navigates to /p/[slug]

1. [UI] Page mounts, shows loading skeleton
2. [Frontend] Sends GET /api/v1/profiles/:slug
3. [Backend] Returns 403 with code PROFILE_EMAIL_REQUIRED
4. [Frontend] Detects email gate error, transitions to email_gate state
5. [UI] Renders email gate form:
   - Icon, title ("Enter your email to continue")
   - Description ("The company requires your email to access this profile")
   - Email input with placeholder
   - Submit button ("View profile") — disabled when empty
   - Disclaimer about email sharing
6. [UI] Visitor types email and clicks "View profile"
7. [Frontend] Sends GET /api/v1/profiles/:slug?email=investor@fund.com
8. [Backend] Validates email, records access, returns 200 with profile data
9. [UI] Transitions to profile state, renders full profile

POSTCONDITION: Email recorded for founder to see in analytics
SIDE EFFECTS: Access request logged, view count incremented
```

### Alternative Path: Password-Protected Access

```
PRECONDITION: Profile is PUBLISHED with accessType PASSWORD
ACTOR: Public visitor (has password shared by founder)
TRIGGER: Visitor navigates to /p/[slug]

1. [UI] Page mounts, shows loading skeleton
2. [Frontend] Sends GET /api/v1/profiles/:slug
3. [Backend] Returns 401 with code PROFILE_PASSWORD_REQUIRED
4. [Frontend] Detects password gate error, transitions to password_gate state
5. [UI] Renders password gate form:
   - Lock icon, title ("This profile is protected")
   - Description ("Enter the password shared with you")
   - Password input
   - Submit button ("Unlock profile") — disabled when empty
6. [UI] Visitor types password and clicks "Unlock profile"
7. [Frontend] Sends GET /api/v1/profiles/:slug?password=secret123
8. [Backend] Compares bcrypt hash, returns 200 with profile data
9. [UI] Transitions to profile state, renders full profile

POSTCONDITION: View count incremented
SIDE EFFECTS: View count recorded
```

### Error Path: Incorrect Password

```
PRECONDITION: Visitor is on password gate form
TRIGGER: Visitor submits wrong password

1. [Frontend] Sends GET /api/v1/profiles/:slug?password=wrong
2. [Backend] Returns 401 with code PROFILE_INVALID_PASSWORD
3. [Frontend] Catches error, throws localized message
4. [UI] Shows "Incorrect password. Please try again." inline error
5. [UI] Form remains visible, visitor can retry

POSTCONDITION: No state change
```

### Error Path: Profile Not Found

```
PRECONDITION: Slug does not match any published profile
TRIGGER: Visitor navigates to /p/[invalid-slug]

1. [Frontend] Sends GET /api/v1/profiles/:slug
2. [Backend] Returns 404 PROFILE_NOT_FOUND
3. [Frontend] Transitions to not_found state
4. [UI] Renders "Profile not found" view with icon and description

POSTCONDITION: No view recorded
```

### Error Path: Network Error

```
PRECONDITION: Network/server unavailable
TRIGGER: Visitor navigates to /p/[slug]

1. [Frontend] Sends GET /api/v1/profiles/:slug
2. [Frontend] Fetch throws network error (not ApiError)
3. [Frontend] Falls through to default handler, transitions to not_found state
4. [UI] Renders "Profile not found" view (graceful degradation)

POSTCONDITION: No view recorded
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 3 | Initial fetch | 200 OK | Happy | Render profile |
| 3 | Initial fetch | 403 PROFILE_EMAIL_REQUIRED | Gate | Show email form |
| 3 | Initial fetch | 401 PROFILE_PASSWORD_REQUIRED | Gate | Show password form |
| 3 | Initial fetch | 404 | Error | Show not found |
| 3 | Initial fetch | Network error | Error | Show not found |
| 7 | Email submission | 200 OK | Happy | Render profile |
| 7 | Email submission | Any error | Error | Show error on form |
| 7 | Password submission | 200 OK | Happy | Render profile |
| 7 | Password submission | 401 invalid | Error | Show incorrect password |

---

## State Transitions

The page uses a discriminated union state machine:

| State | Trigger | Next State |
|-------|---------|------------|
| `loading` | 200 OK | `profile` |
| `loading` | 403 email required | `email_gate` |
| `loading` | 401 password required | `password_gate` |
| `loading` | 404 | `not_found` |
| `loading` | Network error | `not_found` |
| `email_gate` | Submit email → 200 OK | `profile` |
| `password_gate` | Submit password → 200 OK | `profile` |

---

## By Role

This page is fully public — no authenticated roles required.

| Capability | Public Visitor | Authenticated User |
|-----------|---------------|-------------------|
| View PUBLIC profile | Yes | Yes |
| Pass email gate | Yes (provides email) | Yes (provides email) |
| Pass password gate | Yes (needs password) | Yes (needs password) |
| Download documents | Yes (via pre-signed URL) | Yes |
