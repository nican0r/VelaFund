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
  |                                    --> 201 Created (email TODO)
  |
  +-- "Resend Invitation" POST /api/v1/companies/:companyId/members/:memberId/resend-invitation
  |     |
  |     +-- [member not found] --> 404 MEMBER_NOT_FOUND
  |     +-- [member not PENDING] --> 422 MEMBER_NOT_PENDING
  |     +-- [member is PENDING] --> New token generated (7-day expiry), old token replaced
  |                                 --> 200 OK (email TODO)
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
16. [System] (TODO) Send invitation email via AWS SES with link: https://app.navia.com/invitations/{token}
17. [UI] Shows success toast: "Invitation sent to {email}"
18. [UI] New PENDING member appears in the members list

POSTCONDITION: CompanyMember exists with status PENDING. InvitationToken created with 7-day expiry.
SIDE EFFECTS: None yet (audit logging and email planned)
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
SIDE EFFECTS: None yet (audit logging and email planned)
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
10. [System] (TODO) Send invitation email via AWS SES with new token link
11. [UI] Shows success toast: "Invitation resent to {email}"

POSTCONDITION: Old invitation token replaced with new token. New 7-day expiry window.
SIDE EFFECTS: None yet (audit logging and email planned)
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
- **Pending items**: Email sending via AWS SES, audit logging for all member events.

---

**Depends on**: [Authentication](./authentication.md) -- user must be logged in to accept invitations and manage members
**Depends on**: [Company Management](./company-management.md) -- company must exist and not be DISSOLVED
**Feeds into**: Shareholder Management -- members with appropriate roles can manage shareholders
**Triggers**: (TODO) Email notification via AWS SES when invitation is created or resent
