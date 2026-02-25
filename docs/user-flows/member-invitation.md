# Member Invitation — User Flows

**Feature**: Invite users to join a company, accept invitations, manage company members (roles, permissions, removal)
**Actors**: ADMIN member (invite, update, remove, resend), any company member (list), authenticated user (accept invitation), unauthenticated user (view invitation details)
**Preconditions**: Company exists and is not DISSOLVED; inviting user is an ADMIN member of the company
**Related Flows**: [Authentication](./authentication.md) (requires auth for most endpoints), [Company Management](./company-management.md) (company must exist first)

---

## Flow Map

```
ADMIN member
  |
  +-- "Invite Member" POST /api/v1/companies/:companyId/members
  |     |
  |     +-- [company not found] --> 404 COMPANY_NOT_FOUND
  |     +-- [company DISSOLVED] --> 422 COMPANY_DISSOLVED
  |     +-- [50+ invitations in last 24h] --> 422 COMPANY_INVITATION_RATE_LIMIT
  |     +-- [email is ACTIVE member] --> 409 COMPANY_MEMBER_EXISTS
  |     +-- [email has PENDING invitation] --> 409 COMPANY_INVITATION_PENDING
  |     +-- [email was REMOVED member] --> Re-invite: reset record to PENDING, new token
  |     +-- [validation fails (email/role)] --> 400 VAL_INVALID_INPUT
  |     +-- [all valid, new email] --> CompanyMember created (PENDING) + InvitationToken created
  |                                    --> 201 Created
  |                                    --> [async] EmailService sends invitation email via SES (fire-and-forget)
  |                                         |
  |                                         +-- [SES available] --> Email delivered to invitee
  |                                         +-- [SES unavailable] --> Gracefully degrades, no email sent (logged)
  |
  +-- "Resend Invitation" POST /api/v1/companies/:companyId/members/:memberId/resend-invitation
  |     |
  |     +-- [member not found] --> 404 MEMBER_NOT_FOUND
  |     +-- [member not PENDING] --> 422 MEMBER_NOT_PENDING
  |     +-- [member is PENDING] --> New token generated (7-day expiry), old token replaced
  |                                 --> 200 OK
  |                                 --> [async] EmailService sends invitation email via SES (fire-and-forget)
  |                                      |
  |                                      +-- [SES available] --> Email delivered to invitee
  |                                      +-- [SES unavailable] --> Gracefully degrades, no email sent (logged)
  |
  +-- "Update Member" PUT /api/v1/companies/:companyId/members/:memberId
  |     |
  |     +-- [member not found] --> 404 MEMBER_NOT_FOUND
  |     +-- [member not ACTIVE] --> 422 MEMBER_NOT_ACTIVE
  |     +-- [demoting last ADMIN] --> 422 COMPANY_LAST_ADMIN
  |     +-- [granting usersManage to non-ADMIN] --> 422 MEMBER_PERMISSION_PROTECTED
  |     +-- [valid update] --> Member role/permissions updated --> 200 OK
  |
  +-- "Remove Member" DELETE /api/v1/companies/:companyId/members/:memberId
  |     |
  |     +-- [member not found] --> 404 MEMBER_NOT_FOUND
  |     +-- [member already REMOVED] --> 422 MEMBER_ALREADY_REMOVED
  |     +-- [removing last ADMIN (ACTIVE)] --> 422 COMPANY_LAST_ADMIN
  |     +-- [member ACTIVE or PENDING] --> Status --> REMOVED, removedAt/removedBy set --> 204

Any company member
  |
  +-- "List Members" GET /api/v1/companies/:companyId/members
        |
        +-- Paginated list with optional filters: status, role, search, sort
        +-- Includes user details (name, avatar) for linked members --> 200 OK

Unauthenticated user (or any user)
  |
  +-- "View Invitation Details" GET /api/v1/invitations/:token (@Public)
  |     |
  |     +-- [token not found or already used] --> 404 INVITATION_NOT_FOUND
  |     +-- [token expired] --> 410 INVITATION_EXPIRED
  |     +-- [token valid] --> Company name, logo, role, inviter name, expiry, hasExistingAccount
  |                           --> 200 OK
  |
  +-- "Accept Invitation" POST /api/v1/invitations/:token/accept (authenticated)
        |
        +-- [token not found or already used] --> 404 INVITATION_NOT_FOUND
        +-- [token expired] --> 410 INVITATION_EXPIRED
        +-- [member not PENDING (already accepted)] --> 422 INVITATION_ALREADY_ACCEPTED
        +-- [user already ACTIVE member of this company] --> 409 COMPANY_MEMBER_EXISTS
        +-- [user at 20-company membership limit] --> 422 COMPANY_MEMBER_LIMIT_REACHED
        +-- [all valid] --> CompanyMember status --> ACTIVE, userId linked, token marked used
                            --> 200 OK with member/company info
```

---

## Flows

### Happy Path: Invite New Member

```
PRECONDITION: User is ADMIN member of an active company
ACTOR: ADMIN member
TRIGGER: User clicks "Invite Member" and submits email + role

1.  [UI] User navigates to company members page
2.  [UI] User clicks "Invite Member" button
3.  [UI] User fills in: email (required), role (required), message (optional, max 500 chars)
4.  [UI] User clicks "Send Invitation"
5.  [Frontend] Validates input client-side (email format, role enum)
    -> IF invalid: show field-level errors, STOP
6.  [Frontend] Sends POST /api/v1/companies/:companyId/members with { email, role, message? }
7.  [Backend] AuthGuard verifies session cookie / Bearer token
    -> IF unauthenticated: return 401
8.  [Backend] RolesGuard checks user is ADMIN for this company
    -> IF not ADMIN: return 404 Not Found
9.  [Backend] ValidationPipe validates request body (class-validator: @IsEmail, @IsEnum)
    -> IF invalid: return 400 VAL_INVALID_INPUT with validationErrors array
10. [Backend] MemberService.invite() loads company
    -> IF company not found: return 404 COMPANY_NOT_FOUND
    -> IF company DISSOLVED: return 422 COMPANY_DISSOLVED
11. [Backend] Checks invitation rate limit: count PENDING members invited in last 24h
    -> IF >= 50: return 422 COMPANY_INVITATION_RATE_LIMIT
12. [Backend] Looks up existing CompanyMember by (companyId, email) unique index
    -> IF ACTIVE: return 409 COMPANY_MEMBER_EXISTS
    -> IF PENDING: return 409 COMPANY_INVITATION_PENDING
    -> IF REMOVED: re-invite path (see Alternative Path: Re-invite Removed Member)
13. [Backend] Generates 32-byte random invitation token (hex-encoded)
14. [Backend] Opens $transaction: creates CompanyMember (PENDING) + InvitationToken atomically
15. [Backend] Returns 201 with created member data
16. [Backend] Sends invitation email asynchronously via EmailService (MJML template → SES). Gracefully degrades if SES unavailable.
17. [UI] Shows success toast: "Invitation sent to {email}"
18. [UI] New PENDING member appears in the members list

POSTCONDITION: CompanyMember exists with status PENDING. InvitationToken created with 7-day expiry.
SIDE EFFECTS: Invitation email sent to invitee (async, non-blocking). Email includes: company name, inviter name, role name (translated to invitee's locale), invitation acceptance URL, 7-day expiry notice. Audit logging planned.
```

### Alternative Path: Re-invite Removed Member

```
PRECONDITION: Email was previously a member but has status REMOVED
ACTOR: ADMIN member
TRIGGER: Invite flow (step 12) detects email has a REMOVED CompanyMember record

12a. [Backend] Existing member has status REMOVED — unique constraint prevents new record
13a. [Backend] Generates new 32-byte random invitation token
14a. [Backend] Opens $transaction:
     - Updates existing CompanyMember: role -> new role, status -> PENDING, invitedBy/invitedAt -> current,
       clears acceptedAt, removedAt, removedBy, userId
     - Upserts InvitationToken for this member: new token, new 7-day expiry, clears usedAt
15a. [Backend] Returns 201 with updated member data
16a-18a. Same as happy path steps 16-18

POSTCONDITION: Previously REMOVED member reset to PENDING with new role and fresh invitation token.
SIDE EFFECTS: Invitation email sent to invitee (async, non-blocking). Email includes: company name, inviter name, role name (translated to invitee's locale), invitation acceptance URL, 7-day expiry notice. Audit logging planned.
```

### Happy Path: View Invitation Details (Public)

```
PRECONDITION: User received an invitation email with a link containing a token
ACTOR: Unauthenticated user (or any user)
TRIGGER: User clicks invitation link in email

1. [UI] User clicks link: https://app.navia.com/invitations/{token}
2. [Frontend] Sends GET /api/v1/invitations/:token
3. [Backend] Endpoint is @Public() — no auth check needed
4. [Backend] MemberService.getInvitationDetails() looks up InvitationToken by token
   -> IF not found or usedAt is set: return 404 INVITATION_NOT_FOUND
5. [Backend] Checks token expiry
   -> IF expired: return 410 INVITATION_EXPIRED
6. [Backend] Fetches company info (name, logo) from the linked CompanyMember
7. [Backend] Checks if invitee email has an existing Navia user account
8. [Backend] Fetches inviter name (firstName + lastName) from User table
9. [Backend] Returns 200 with { companyName, companyLogoUrl, role, invitedByName, invitedAt, expiresAt, email, hasExistingAccount }
10. [UI] Renders invitation page showing company name, logo, assigned role, who invited them, and expiry
    -> IF hasExistingAccount: show "Login to Accept" button
    -> IF not hasExistingAccount: show "Create Account to Accept" button

POSTCONDITION: None (read-only)
```

### Happy Path: Accept Invitation (Existing User)

```
PRECONDITION: User is authenticated and has a valid invitation token
ACTOR: Authenticated user
TRIGGER: User clicks "Accept Invitation" on the invitation page

1.  [UI] User is on the invitation page (already viewed details)
2.  [UI] User clicks "Accept Invitation"
3.  [Frontend] Sends POST /api/v1/invitations/:token/accept
4.  [Backend] AuthGuard verifies session cookie / Bearer token
    -> IF unauthenticated: return 401
5.  [Backend] MemberService.acceptInvitation() looks up InvitationToken by token
    -> IF not found or usedAt is set: return 404 INVITATION_NOT_FOUND
6.  [Backend] Checks token expiry
    -> IF expired: return 410 INVITATION_EXPIRED
7.  [Backend] Checks CompanyMember status
    -> IF not PENDING: return 422 INVITATION_ALREADY_ACCEPTED
8.  [Backend] Checks if user is already an ACTIVE member of this company (by userId)
    -> IF already active: return 409 COMPANY_MEMBER_EXISTS
9.  [Backend] Checks user's total membership count (PENDING + ACTIVE)
    -> IF >= 20: return 422 COMPANY_MEMBER_LIMIT_REACHED
10. [Backend] Opens $transaction:
    - Updates CompanyMember: userId -> accepting user's id, email -> accepting user's email,
      status -> ACTIVE, acceptedAt -> now()
    - Updates InvitationToken: usedAt -> now()
11. [Backend] Returns 200 with { memberId, companyId, companyName, role, status, acceptedAt }
12. [UI] Shows success toast: "You have joined {companyName} as {role}"
13. [UI] Redirects to the company dashboard

POSTCONDITION: CompanyMember status is ACTIVE with userId linked. InvitationToken marked as used.
SIDE EFFECTS: None yet (audit logging planned). Note: email match is NOT enforced (BR-6) — any authenticated user can accept any invitation.
```

### Happy Path: Accept Invitation (New User)

```
PRECONDITION: User does not have a Navia account and has a valid invitation token
ACTOR: Unauthenticated new user
TRIGGER: User clicks "Create Account to Accept" on the invitation page

1.  [UI] User is on the invitation page, sees "Create Account to Accept"
2.  [UI] User clicks "Create Account to Accept"
3.  [Frontend] Redirects to login/signup page with returnUrl=/invitations/{token}/accept
4.  [UI] User completes Privy authentication (see Authentication flow)
5.  [Frontend] After login, user is redirected back to the invitation acceptance page
6.  Steps 3-13 from "Happy Path: Accept Invitation (Existing User)" apply

POSTCONDITION: New user created, then CompanyMember activated. Two-step flow: register then accept.
```

### Happy Path: List Members

```
PRECONDITION: User is an active member of the company (any role)
ACTOR: Any company member (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE)
TRIGGER: User navigates to the members page

1. [UI] User navigates to company members page
2. [Frontend] Sends GET /api/v1/companies/:companyId/members?page=1&limit=20
3. [Backend] AuthGuard verifies session
4. [Backend] RolesGuard checks user is any active member of this company
   -> IF not a member: return 404 Not Found
5. [Backend] MemberService.listMembers() queries CompanyMember with optional filters:
   - status: filter by PENDING, ACTIVE, or REMOVED
   - role: filter by ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE
   - search: case-insensitive search on email, firstName, lastName
   - sort: sortable fields are createdAt, email, role, invitedAt, acceptedAt (default: -createdAt)
6. [Backend] Includes linked user details: id, firstName, lastName, profilePictureUrl, walletAddress
7. [Backend] Returns 200 with paginated response { success, data, meta }
8. [UI] Renders members table with: email, name, role badge, status badge, invited/accepted dates
   -> PENDING members show email only (no linked user yet)
   -> ACTIVE members show user name + avatar

POSTCONDITION: None (read-only)
```

### Happy Path: Update Member Role

```
PRECONDITION: User is ADMIN. Target member is ACTIVE.
ACTOR: ADMIN member
TRIGGER: User changes a member's role in the members table or member detail view

1.  [UI] User clicks "Edit" on a member row or opens member settings
2.  [UI] User selects a new role from dropdown
3.  [UI] User clicks "Save"
4.  [Frontend] Sends PUT /api/v1/companies/:companyId/members/:memberId with { role }
5.  [Backend] AuthGuard verifies session
6.  [Backend] RolesGuard checks user is ADMIN
    -> IF not ADMIN: return 404 Not Found
7.  [Backend] ValidationPipe validates body (@IsEnum for role, @ValidateNested for permissions)
    -> IF invalid: return 400 VAL_INVALID_INPUT
8.  [Backend] MemberService.updateMember() loads the target member
    -> IF member not found in this company: return 404 MEMBER_NOT_FOUND
9.  [Backend] Checks member status
    -> IF not ACTIVE: return 422 MEMBER_NOT_ACTIVE
10. [Backend] If demoting from ADMIN to another role: checks last-admin guard
    -> IF only ADMIN remaining: return 422 COMPANY_LAST_ADMIN
11. [Backend] Updates CompanyMember.role
12. [Backend] Returns 200 with updated member data
13. [UI] Shows success toast: "Member role updated"

POSTCONDITION: Member role changed.
SIDE EFFECTS: None yet (audit logging planned)
```

### Happy Path: Update Member Permissions

```
PRECONDITION: User is ADMIN. Target member is ACTIVE.
ACTOR: ADMIN member
TRIGGER: User modifies fine-grained permission overrides for a member

1.  [UI] User opens member detail / permissions view
2.  [UI] User toggles permission switches (capTableRead, transactionsCreate, etc.)
3.  [UI] User clicks "Save"
4.  [Frontend] Sends PUT /api/v1/companies/:companyId/members/:memberId with { permissions: {...} }
5.  [Backend] Steps 5-9 same as "Update Member Role"
10. [Backend] Validates permission overrides:
    -> IF granting usersManage to non-ADMIN role: return 422 MEMBER_PERMISSION_PROTECTED
11. [Backend] Updates CompanyMember.permissions (JSONB field)
    - Set to null to clear all overrides (reverts to role defaults)
12. [Backend] Returns 200 with updated member data
13. [UI] Shows success toast: "Permissions updated"

POSTCONDITION: Member permissions overrides saved (or cleared if null).
SIDE EFFECTS: None yet (audit logging planned)
```

### Happy Path: Remove Member

```
PRECONDITION: User is ADMIN. Target member is ACTIVE or PENDING (not already REMOVED).
ACTOR: ADMIN member
TRIGGER: User clicks "Remove" on a member and confirms

1.  [UI] User clicks "Remove" action on a member row
2.  [UI] Confirmation dialog shown: "Are you sure you want to remove {name/email}?"
3.  [UI] User confirms
4.  [Frontend] Sends DELETE /api/v1/companies/:companyId/members/:memberId
5.  [Backend] AuthGuard verifies session
6.  [Backend] RolesGuard checks user is ADMIN
    -> IF not ADMIN: return 404 Not Found
7.  [Backend] MemberService.removeMember() loads the target member
    -> IF member not found: return 404 MEMBER_NOT_FOUND
8.  [Backend] Checks member status
    -> IF already REMOVED: return 422 MEMBER_ALREADY_REMOVED
9.  [Backend] If removing an ACTIVE ADMIN: checks last-admin guard
    -> IF only ADMIN remaining: return 422 COMPANY_LAST_ADMIN
10. [Backend] Updates CompanyMember: status -> REMOVED, removedAt -> now(), removedBy -> current user ID
11. [Backend] Returns 204 No Content
12. [UI] Shows success toast: "Member removed"
13. [UI] Member status badge changes to REMOVED in the list (or row removed from default view)

POSTCONDITION: CompanyMember status is REMOVED. Member can no longer access the company.
SIDE EFFECTS: None yet (audit logging planned). Note: both ACTIVE and PENDING members can be removed.
```

### Happy Path: Resend Invitation

```
PRECONDITION: User is ADMIN. Target member has status PENDING.
ACTOR: ADMIN member
TRIGGER: User clicks "Resend Invitation" on a pending member

1. [UI] User clicks "Resend" action on a PENDING member row
2. [Frontend] Sends POST /api/v1/companies/:companyId/members/:memberId/resend-invitation
3. [Backend] AuthGuard verifies session
4. [Backend] RolesGuard checks user is ADMIN
   -> IF not ADMIN: return 404 Not Found
5. [Backend] MemberService.resendInvitation() loads the target member (with invitation token)
   -> IF member not found: return 404 MEMBER_NOT_FOUND
6. [Backend] Checks member status
   -> IF not PENDING: return 422 MEMBER_NOT_PENDING
7. [Backend] Generates new 32-byte random token
8. [Backend] Upserts InvitationToken: new token, new 7-day expiry, clears usedAt
9. [Backend] Returns 200 with { id, email, status, newExpiresAt }
10. [Backend] Sends invitation email asynchronously via EmailService (MJML template → SES). Gracefully degrades if SES unavailable.
11. [UI] Shows success toast: "Invitation resent to {email}"

POSTCONDITION: Old invitation token replaced with new token. New 7-day expiry window.
SIDE EFFECTS: Invitation email sent to invitee (async, non-blocking). Email includes: company name, inviter name, role name (translated to invitee's locale), invitation acceptance URL, 7-day expiry notice. Audit logging planned.
```

### Error Path: Invitation Token Expired

```
PRECONDITION: User has an invitation token that has passed its 7-day expiry
ACTOR: Any user (authenticated or not)
TRIGGER: User clicks expired invitation link

1. [UI] User clicks invitation link from email
2. [Frontend] Sends GET /api/v1/invitations/:token
3. [Backend] Finds InvitationToken, checks expiry
4. [Backend] Returns 410 INVITATION_EXPIRED with { expiresAt }
5. [UI] Shows expired invitation page: "This invitation has expired. Contact the company admin for a new invitation."

If user attempts to accept the expired invitation:
6. [Frontend] Sends POST /api/v1/invitations/:token/accept
7. [Backend] Same expiry check, returns 410 INVITATION_EXPIRED
8. [UI] Shows error toast: "Invitation expired"

POSTCONDITION: No state change. Admin must resend invitation to generate a new token.
```

### Error Path: Demote Last Admin

```
PRECONDITION: Company has exactly one ACTIVE ADMIN member
ACTOR: ADMIN member (attempting to demote self or other)
TRIGGER: Update member role from ADMIN to another role, or remove the last ADMIN

1. [Frontend] Sends PUT .../members/:memberId with { role: "FINANCE" }
   — or — DELETE .../members/:memberId
2. [Backend] MemberService.ensureNotLastAdmin() counts ACTIVE ADMINs excluding target
3. [Backend] Count is 0 — throws 422 COMPANY_LAST_ADMIN
4. [UI] Shows error: "Cannot demote or remove the last admin. Assign another admin first."

POSTCONDITION: No state change. At least one ADMIN must remain.
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 9 (invite) | Server validation | Body invalid (email format, role enum) | Error | 400 VAL_INVALID_INPUT |
| 10 (invite) | Company lookup | Company not found | Error | 404 COMPANY_NOT_FOUND |
| 10 (invite) | Company status | Company is DISSOLVED | Error | 422 COMPANY_DISSOLVED |
| 11 (invite) | Rate limit | >= 50 PENDING invitations in last 24h | Error | 422 COMPANY_INVITATION_RATE_LIMIT |
| 12 (invite) | Email check | Email is ACTIVE member | Error | 409 COMPANY_MEMBER_EXISTS |
| 12 (invite) | Email check | Email has PENDING invitation | Error | 409 COMPANY_INVITATION_PENDING |
| 12 (invite) | Email check | Email was REMOVED member | Alt. | Re-invite: reset to PENDING |
| 12 (invite) | Email check | Email not in company | Happy | Create new member + token |
| 5 (accept) | Token lookup | Token not found or used | Error | 404 INVITATION_NOT_FOUND |
| 6 (accept) | Token expiry | expiresAt < now | Error | 410 INVITATION_EXPIRED |
| 7 (accept) | Member status | Not PENDING | Error | 422 INVITATION_ALREADY_ACCEPTED |
| 8 (accept) | Existing member | User already ACTIVE in company | Error | 409 COMPANY_MEMBER_EXISTS |
| 9 (accept) | Membership limit | User in >= 20 companies (PENDING+ACTIVE) | Error | 422 COMPANY_MEMBER_LIMIT_REACHED |
| 8 (update) | Member status | Not ACTIVE | Error | 422 MEMBER_NOT_ACTIVE |
| 10 (update) | Last admin guard | Demoting only remaining ADMIN | Error | 422 COMPANY_LAST_ADMIN |
| 10 (update permissions) | Protected perm | usersManage granted to non-ADMIN | Error | 422 MEMBER_PERMISSION_PROTECTED |
| 8 (remove) | Member status | Already REMOVED | Error | 422 MEMBER_ALREADY_REMOVED |
| 9 (remove) | Last admin guard | Removing last ACTIVE ADMIN | Error | 422 COMPANY_LAST_ADMIN |
| 6 (resend) | Member status | Not PENDING | Error | 422 MEMBER_NOT_PENDING |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| CompanyMember | -- | -- (not exists) | Created (status=PENDING, role=dto.role) | Invite new member |
| CompanyMember | status | REMOVED | PENDING | Re-invite removed member |
| CompanyMember | role | previous role | dto.role | Re-invite removed member (role updated) |
| CompanyMember | invitedBy/invitedAt | previous values | current admin / now() | Re-invite removed member |
| CompanyMember | acceptedAt, removedAt, removedBy, userId | previous values | null | Re-invite removed member (fields cleared) |
| CompanyMember | status | PENDING | ACTIVE | Accept invitation |
| CompanyMember | userId | null | accepting user's ID | Accept invitation |
| CompanyMember | email | invited email | accepting user's email | Accept invitation (BR-6: email may differ) |
| CompanyMember | acceptedAt | null | now() | Accept invitation |
| CompanyMember | role | current role | new role | Update member role |
| CompanyMember | permissions | current overrides | new overrides or null | Update member permissions |
| CompanyMember | status | ACTIVE or PENDING | REMOVED | Remove member |
| CompanyMember | removedAt | null | now() | Remove member |
| CompanyMember | removedBy | null | removing admin's user ID | Remove member |
| InvitationToken | -- | -- (not exists) | Created (token, expiresAt) | Invite new member |
| InvitationToken | token, expiresAt | old values | new token, new 7-day expiry | Resend invitation |
| InvitationToken | usedAt | null | now() | Accept invitation |

### Member Status State Machine

```
                        invite
  (not exists) ─────────────────────> PENDING
                                        |  |
                          accept -------+  |
                          |                | remove
                          v                v
                        ACTIVE ---------> REMOVED
                          |                  |
                          | remove           | re-invite
                          |                  |
                          v                  v
                        REMOVED           PENDING (cycle back)
```

---

## By Role

### Member Management (Company-Scoped Endpoints)

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE | Non-member |
|--------|-------|---------|-------|----------|----------|------------|
| Invite member | Yes | No (404) | No (404) | No (404) | No (404) | No (404) |
| List members | Yes | Yes | Yes | Yes | Yes | No (404) |
| Update member | Yes | No (404) | No (404) | No (404) | No (404) | No (404) |
| Remove member | Yes | No (404) | No (404) | No (404) | No (404) | No (404) |
| Resend invitation | Yes | No (404) | No (404) | No (404) | No (404) | No (404) |

Note: Non-members receive 404 (not 403) to prevent company enumeration per security.md.

### Invitation Endpoints (Global)

| Action | Unauthenticated | Any Authenticated User |
|--------|----------------|----------------------|
| View invitation details | Allowed (@Public) | Allowed (@Public) |
| Accept invitation | No (401) | Allowed |

---

## API Endpoints Summary

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| POST | `/api/v1/companies/:companyId/members` | Required | ADMIN | Invite a member |
| GET | `/api/v1/companies/:companyId/members` | Required | Any member | List company members |
| PUT | `/api/v1/companies/:companyId/members/:memberId` | Required | ADMIN | Update member role/permissions |
| DELETE | `/api/v1/companies/:companyId/members/:memberId` | Required | ADMIN | Remove a member |
| POST | `/api/v1/companies/:companyId/members/:memberId/resend-invitation` | Required | ADMIN | Resend invitation email |
| GET | `/api/v1/invitations/:token` | None (@Public) | -- | View invitation details |
| POST | `/api/v1/invitations/:token/accept` | Required | -- | Accept invitation |

---

## Implementation Notes

- **Email match not enforced (BR-6)**: Any authenticated user can accept any invitation regardless of whether their email matches the invited email. The CompanyMember email is updated to the accepting user's email upon acceptance.
- **Unique constraint handling**: The `@@unique([companyId, email])` constraint on CompanyMember means previously REMOVED members must be re-invited by updating the existing record rather than creating a new one.
- **Invitation token**: 32-byte cryptographically random value, hex-encoded (64 characters). Stored in a separate `InvitationToken` table with 1:1 relationship to CompanyMember.
- **Token expiry**: 7 days from creation. Resending generates a new token with a fresh 7-day window.
- **Rate limiting**: Throttle decorators applied — write endpoints: 30/min, read endpoints: 100/min.
- **Email sending**: Invitation emails are sent asynchronously via EmailService (MJML template rendered to HTML, delivered via AWS SES). Email sending is fire-and-forget and gracefully degrades if SES is unavailable -- the invitation is still created and the token is valid even if the email fails to send.
- **Pending items**: Audit logging for all member events.
- **Frontend implementation** (v0.0.61): Public invitation acceptance page at `/invitations/[token]` with three-state UI (loading/error/invitation details), role badges, pt-BR date formatting, Privy login trigger for unauthenticated users, accept mutation with toast+redirect for authenticated users. TanStack Query hooks: `useInvitationDetails` (staleTime: 60s, retry: false) and `useAcceptInvitation` (invalidates companies query). Note: The current implementation covers the "Accept Invitation (Logged In)" and basic "Not Logged In → Login → Accept" flows. The "Personal Info Form" for new users (steps 11–16 in the new user flow) is deferred to P4.2 Onboarding Wizard.

---

**Depends on**: [Authentication](./authentication.md) -- user must be logged in to accept invitations and manage members
**Depends on**: [Company Management](./company-management.md) -- company must exist and not be DISSOLVED
**Feeds into**: Shareholder Management -- members with appropriate roles can manage shareholders
**Triggers**: Email notification via AWS SES when invitation is created or resent

---

## Frontend-Specific Flows

The following flows document the frontend component behavior, UI state transitions, and user interactions for the member invitation and management features. These complement the backend flows above with UI-level detail.

### Frontend Flow: Invite Member (Complete UI Flow)

```
PRECONDITION: User is ADMIN of company, on /dashboard/members page
ACTOR: ADMIN
TRIGGER: Clicks "Convidar Membro" primary button in page header

1.  [UI] MembersPage renders with PageHeader + MembersTable
2.  [UI] ADMIN clicks "Convidar Membro" button (top-right, primary variant)
3.  [UI] InviteMemberModal opens (animation: fade in overlay 200ms + slide up content 250ms)
    - Overlay: navy-900 at 50% opacity
    - Modal: 560px max-width, white bg, radius-lg, shadow-xl
4.  [UI] Modal renders form:
    - Email input (empty, focused on open)
    - Role dropdown (default: EMPLOYEE, shows role descriptions in options)
    - Message textarea (optional, max 500 chars)
    - Footer: "Cancelar" secondary + "Enviar Convite" primary
5.  [UI] Admin types email address
6.  [UI] Admin selects role from dropdown (each option shows label + description)
7.  [UI] Admin optionally types personal message
8.  [UI] Admin clicks "Enviar Convite"
9.  [Frontend] Client-side validation runs:
    -> IF email empty: field error "E-mail e obrigatorio"
    -> IF email invalid format: field error "Formato de e-mail invalido"
    -> IF role empty: field error "Selecione um papel"
    -> IF message > 500 chars: field error "Mensagem muito longa"
    -> IF any invalid: STOP, show field-level errors (caption 12px, #DC2626)
10. [Frontend] Button enters loading state (spinner replaces text, fields disabled)
11. [Frontend] POST /api/v1/companies/:companyId/members/invite with { email, role, message }
12. [Backend] Validates and processes (see backend flow steps 7-15)
    -> IF 409 COMPANY_MEMBER_EXISTS:
       [UI] Inline error on email field: "Este e-mail ja e membro da empresa"
       [UI] Button returns to idle state, fields re-enabled
    -> IF 409 COMPANY_INVITATION_PENDING:
       [UI] Inline error on email field: "Ja existe um convite pendente para este e-mail"
       [UI] Button returns to idle state, fields re-enabled
    -> IF 400 VAL_INVALID_INPUT:
       [UI] Map validationErrors array to field-level errors via applyServerErrors()
       [UI] Button returns to idle state, fields re-enabled
    -> IF 500:
       [UI] Error toast appears (top-right, red left border accent, persistent)
       [UI] Button returns to idle state, fields re-enabled
13. [Backend] Returns 201 with member data
14. [UI] Modal closes (animation: reverse of open)
15. [UI] Success toast: "Convite enviado para {email}" (top-right, green left border, 5s auto-dismiss)
16. [Frontend] queryClient.invalidateQueries(['members', companyId])
17. [UI] MembersTable refetches and shows new PENDING row with email, role badge, "Pendente" status

POSTCONDITION: PENDING member visible in table, invitation email sent
SIDE EFFECTS: Audit log (COMPANY_MEMBER_INVITED), invitation email via AWS SES
```

### Frontend Flow: Accept Invitation -- New User (Complete UI Flow)

```
PRECONDITION: User has no Navia account, received invitation email
ACTOR: Invited user (new)
TRIGGER: Clicks invitation link in email

1.  [UI] Browser navigates to /invitations/:token (public route, auth layout)
2.  [UI] InvitationAcceptPage mounts, shows centered card with loading spinner
3.  [Frontend] GET /api/v1/invitations/:token
    -> IF 404 INVITATION_NOT_FOUND: go to step E1
    -> IF 410 INVITATION_EXPIRED: go to step E1
4.  [Backend] Returns { companyName, companyLogoUrl, role, invitedByName, email, hasExistingAccount: false }
5.  [UI] Card renders (max-w 480px, white bg, shadow-lg, radius-xl, 32px padding):
    - Company logo (48px centered, or initial circle on blue-600 bg if no logo)
    - Company name (h2, navy-900, centered)
    - RoleBadge (centered, pill with role-specific colors)
    - "Convidado por {invitedByName}" (body-sm, gray-500, centered)
    - Divider (1px gray-200, margin-y 24px)
    - "Criar Conta" primary button (full width, lg size, 48px height)
    - "Ja tenho conta" ghost link (centered below button)
6.  [UI] User clicks "Criar Conta"
7.  [Frontend] Opens Privy signup modal
8.  [UI] User completes Privy signup (email + verification code, or Google/Apple)
    -> IF Privy fails: Privy handles error display, user remains on page
9.  [Frontend] POST /api/v1/auth/login to sync Privy user with backend
10. [Backend] Creates new user, returns { user, isNew: true }
11. [UI] Card content transitions to PersonalInfoForm (inline, replaces buttons):
    - Company info remains at top (logo, name, badge)
    - Divider
    - firstName input (required, label "Nome")
    - lastName input (required, label "Sobrenome")
    - email input (pre-filled from Privy/invitation, label "E-mail")
    - "Continuar" primary button (full width)
12. [UI] User fills in firstName and lastName
13. [UI] User clicks "Continuar"
14. [Frontend] Client-side validation:
    -> IF firstName empty: field error
    -> IF lastName empty: field error
15. [Frontend] PUT /api/v1/users/me with { firstName, lastName, email }
    -> IF validation error: show field errors, STOP
16. [Backend] Updates user profile
17. [Frontend] Automatically calls POST /api/v1/invitations/:token/accept
18. [Backend] Updates CompanyMember to ACTIVE, links userId, marks token used
19. [Backend] Returns { companyId, companyName, role, status: 'ACTIVE' }
20. [Frontend] AuthContext updates: user profile set, hasCompany=true, companyId set
21. [UI] router.push('/dashboard')
22. [UI] Welcome toast: "Bem-vindo a {companyName}!" (green accent, 5s auto-dismiss)

ERROR STATES:
E1. [UI] InvitationExpiredPage renders in card:
    - Warning icon (48px, gray-400, centered)
    - "Convite Expirado" (h2, navy-900)
    - "Este convite expirou ou e invalido" (body, gray-500)
    - "Solicite um novo convite ao administrador da empresa" (body-sm, gray-500)

POSTCONDITION: User has account + active membership + redirected to dashboard
SIDE EFFECTS: Audit logs (AUTH_LOGIN_SUCCESS, COMPANY_MEMBER_ACCEPTED)
```

### Frontend Flow: Accept Invitation -- Existing User, Logged In

```
PRECONDITION: User has Navia account, currently logged in, clicks invitation link
ACTOR: Existing authenticated user
TRIGGER: Clicks invitation link in email

1.  [UI] Browser navigates to /invitations/:token
2.  [UI] InvitationAcceptPage mounts, loading spinner
3.  [Frontend] GET /api/v1/invitations/:token
    -> IF 404/410: InvitationExpiredPage
4.  [Backend] Returns invitation details (hasExistingAccount: true)
5.  [UI] Card renders with company info + RoleBadge + inviter name
6.  [Frontend] Detects user is already authenticated (auth context has user)
7.  [UI] Shows "Aceitar Convite" primary button (full width, lg)
8.  [UI] User clicks "Aceitar Convite"
9.  [UI] Button enters loading state (spinner)
10. [Frontend] POST /api/v1/invitations/:token/accept
    -> IF 409 COMPANY_MEMBER_EXISTS:
       [UI] Shows "Voce ja e membro desta empresa" message + "Ir para o Dashboard" link
    -> IF 422 COMPANY_MEMBER_LIMIT_REACHED:
       [UI] Error toast: "Limite de empresas atingido"
11. [Backend] Returns { companyId, companyName, role }
12. [Frontend] AuthContext updates
13. [UI] router.push('/dashboard')
14. [UI] Toast: "Voce agora e membro de {companyName}!"

POSTCONDITION: User is ACTIVE member, redirected to dashboard
SIDE EFFECTS: Audit log (COMPANY_MEMBER_ACCEPTED)
```

### Frontend Flow: Accept Invitation -- Existing User, Not Logged In

```
PRECONDITION: User has Navia account, not currently logged in
ACTOR: Existing user (not authenticated)
TRIGGER: Clicks invitation link in email

1-4. Same as new user flow (page loads, token validated)
5.  [UI] Card renders with company info
6.  [UI] Since hasExistingAccount: true and user not logged in:
    - "Entrar" primary button (full width, lg)
    - "Criar Conta" ghost link (for edge case where they want a new account)
7.  [UI] User clicks "Entrar"
8.  [Frontend] Opens Privy login modal
9.  [UI] User logs in via Privy
10. [Frontend] POST /api/v1/auth/login -> returns { user, isNew: false }
11. [UI] Card updates to show "Aceitar Convite" button (same as logged-in flow)
12-14. Same as logged-in flow steps 8-14

POSTCONDITION: User authenticated + ACTIVE member
SIDE EFFECTS: Audit logs (AUTH_LOGIN_SUCCESS, COMPANY_MEMBER_ACCEPTED)
```

### Frontend Flow: Change Member Role

```
PRECONDITION: User is ADMIN viewing /dashboard/members, table has ACTIVE members
ACTOR: ADMIN
TRIGGER: Clicks RoleBadge of another member in the table

1.  [UI] MembersTable renders with RoleBadge in each row
2.  [UI] For other members' rows (not self): RoleBadge has cursor:pointer visual cue
3.  [UI] ADMIN clicks a RoleBadge -> RoleChangeDropdown opens
    - Dropdown: white bg, shadow-lg, radius-md
    - Options: 5 roles, each with label + description
    - Current role is highlighted (blue-50 bg)
4.  [UI] Admin selects new role from dropdown
5.  [UI] Dropdown closes, confirmation dialog opens:
    - Title: "Alterar Papel" (h3)
    - Message: "Alterar o papel de {name} de {oldRole} para {newRole}?"
    - Buttons: "Cancelar" (secondary) + "Confirmar" (primary)
6.  [UI] Admin clicks "Confirmar"
7.  [UI] Dialog shows loading state
8.  [Frontend] PUT /api/v1/companies/:companyId/members/:memberId with { role }
    -> IF 422 COMPANY_LAST_ADMIN:
       [UI] Error toast: "Nao e possivel alterar o papel do ultimo administrador"
       [UI] Dialog closes
9.  [Backend] Returns 200 with updated member
10. [UI] Confirmation dialog closes
11. [UI] Success toast: "Papel alterado com sucesso" (5s auto-dismiss)
12. [Frontend] queryClient.invalidateQueries(['members', companyId])
13. [UI] Table refetches, row shows updated RoleBadge

Note: Current user's own row shows a static RoleBadge (no dropdown trigger)
SIDE EFFECTS: Audit log (COMPANY_ROLE_CHANGED)
```

### Frontend Flow: Remove Member

```
PRECONDITION: User is ADMIN, viewing /dashboard/members
ACTOR: ADMIN
TRIGGER: Clicks trash icon in actions column of another member's row

1.  [UI] Trash icon button (ghost variant) visible in actions column for other members
2.  [UI] ADMIN clicks trash icon
3.  [UI] MemberRemoveConfirmation dialog opens:
    - Small modal (400px max-width)
    - Destructive icon (red)
    - Title: "Remover Membro" (h3)
    - Message: "Remover {name} da empresa? Esta acao nao pode ser desfeita." (body, gray-600)
    - Buttons: "Cancelar" (secondary) + "Remover" (destructive red)
4.  [UI] ADMIN clicks "Remover"
5.  [UI] Button shows loading spinner
6.  [Frontend] DELETE /api/v1/companies/:companyId/members/:memberId
    -> IF 422 COMPANY_LAST_ADMIN:
       [UI] Error toast: "Nao e possivel remover o ultimo administrador"
       [UI] Dialog closes
7.  [Backend] Returns 200 (member status set to REMOVED)
8.  [UI] Dialog closes
9.  [UI] Success toast: "Membro removido" (5s auto-dismiss)
10. [Frontend] queryClient.invalidateQueries(['members', companyId])
11. [UI] Table refetches, member row either shows REMOVED badge or is filtered out

Note: Trash icon is not rendered for current user's own row
SIDE EFFECTS: Audit log (COMPANY_MEMBER_REMOVED)
```

### Frontend Flow: Resend Invitation

```
PRECONDITION: Member has PENDING status, user is ADMIN
ACTOR: ADMIN
TRIGGER: Clicks "Reenviar convite" ghost button on PENDING member row

1.  [UI] PENDING member rows show "Reenviar convite" ghost button in actions column
2.  [UI] ADMIN clicks "Reenviar convite"
3.  [UI] Button shows spinner (text replaced with loading indicator)
4.  [Frontend] POST /api/v1/companies/:companyId/members/:memberId/resend-invitation
5.  [Backend] Generates new token, sends email, returns 200
6.  [UI] Success toast: "Convite reenviado" (5s auto-dismiss)
7.  [UI] Button enters 60-second cooldown (disabled state)
8.  [UI] After 60 seconds: button re-enables

SIDE EFFECTS: Old token invalidated, new invitation email sent
```

---

## Frontend Component States Summary

### MembersPage

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Page header (h1 + button) + skeleton table rows | Initial load / refetch |
| Data | Header + populated MembersTable + pagination | Data loaded |
| Empty | Header + empty state illustration + CTA | No members returned |
| Error | Header + error message + retry button | API error |

### InviteMemberModal

| State | Visual | Trigger |
|-------|--------|---------|
| Idle | Form with defaults | Modal opens |
| Submitting | Button spinner, fields disabled | Submit |
| Success | Modal closing, toast | 201 |
| Duplicate Error | Inline error on email | 409 |
| Validation Error | Field-level errors | 400 |
| Server Error | Error toast, form re-enabled | 500 |

### InvitationAcceptPage

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Centered spinner | Token fetch in progress |
| Valid (Not Logged In) | Company card + auth buttons | Valid token, no session |
| Valid (Logged In) | Company card + accept button | Valid token, session exists |
| Personal Info | Inline form | New user post-signup |
| Accepting | Button spinner | Accept in flight |
| Expired | Warning icon + message | 404/410 |
| Email Mismatch | Info message + sign-out CTA | 403 |
| Already Member | Message + dashboard link | 409 |

---

## Frontend Decision Points

| Step | Decision Point | Condition | Path | UI Outcome |
|------|---------------|-----------|------|------------|
| Modal 9 | Client validation | Invalid email/role | Error | Field-level red error text |
| Modal 12 | Server: email exists | 409 COMPANY_MEMBER_EXISTS | Error | Inline error on email field |
| Modal 12 | Server: pending exists | 409 COMPANY_INVITATION_PENDING | Error | Inline error on email field |
| Invite 3 | Token validity | 404 or 410 | Error | InvitationExpiredPage |
| Invite 6 | Auth state | User not logged in | Alt | Show signup/login buttons |
| Invite 6 | Auth state | User logged in | Happy | Show accept button |
| Invite 10 | New user check | isNew: true | Alt | Show PersonalInfoForm |
| Invite 17 | Accept result | 409 already member | Error | "Already member" + link |
| Role 8 | Last admin check | 422 COMPANY_LAST_ADMIN | Error | Toast error message |
| Remove 6 | Last admin check | 422 COMPANY_LAST_ADMIN | Error | Toast error message |
