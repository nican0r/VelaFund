# Settings — User Flows

**Feature**: Manage company information and team members from a tabbed settings page
**Actors**: ADMIN (full access), FINANCE/LEGAL (read-only company info), all members (view own membership)
**Preconditions**: User is authenticated, user has a selected company, user is an ACTIVE member of the company
**Related Flows**: [Member Invitation](./member-invitation.md), [Company Management](./company-management.md), [Authentication](./authentication.md)

---

## Flow Map

```
User navigates to /dashboard/settings
  │
  ├─ [no company selected] ─→ Empty state with message
  │
  ├─ [Company tab (default)]
  │     │
  │     ├─ [company detail loading] ─→ Skeleton placeholders
  │     ├─ [company detail loaded] ─→ Form with editable name + description, read-only CNPJ/entityType/status
  │     │     │
  │     │     ├─ User edits name or description
  │     │     │     ├─ [name empty] ─→ Save button disabled
  │     │     │     └─ [name valid + changed] ─→ Save button enabled
  │     │     │           │
  │     │     │           └─ User clicks Save
  │     │     │                 ├─ [API success] ─→ Success toast, form resets dirty state
  │     │     │                 └─ [API error] ─→ Error toast
  │     │     │
  │     │     └─ User views read-only fields (no action possible)
  │     │
  │     └─ [company detail error] ─→ Error message displayed
  │
  └─ [Members tab]
        │
        ├─ [members loading] ─→ Skeleton placeholders
        ├─ [members loaded, empty list] ─→ "No members found." message
        ├─ [members loaded, has data] ─→ Stat cards + filter controls + member table
        │     │
        │     ├─ User searches by name/email ─→ Filter passed to API via useMembers params
        │     ├─ User filters by role ─→ Filter passed to API via useMembers params
        │     ├─ User filters by status ─→ Filter passed to API via useMembers params
        │     │
        │     ├─ User clicks "Invite member"
        │     │     │
        │     │     └─ Invite dialog opens
        │     │           ├─ User fills email + selects role + optional message
        │     │           │     ├─ [clicks "Send invitation"] ─→ POST /api/v1/companies/:id/members
        │     │           │     │     ├─ [success] ─→ Success toast, dialog closes, list refreshes
        │     │           │     │     └─ [error] ─→ Error toast
        │     │           │     └─ [clicks "Cancel"] ─→ Dialog closes
        │     │           └─ [no email entered] ─→ Submit sends empty, backend validates
        │     │
        │     ├─ User clicks action menu on ACTIVE member
        │     │     ├─ "Change role" ─→ Opens Change Role dialog
        │     │     │     ├─ User selects new role + clicks Save
        │     │     │     │     ├─ [success] ─→ PUT /api/v1/companies/:id/members/:memberId → toast + refresh
        │     │     │     │     └─ [error] ─→ Error toast
        │     │     │     └─ [clicks Cancel] ─→ Dialog closes
        │     │     │
        │     │     └─ "Remove" ─→ Opens Remove dialog with confirmation
        │     │           ├─ [clicks "Remove"] ─→ DELETE /api/v1/companies/:id/members/:memberId
        │     │           │     ├─ [success] ─→ Success toast, dialog closes, list refreshes
        │     │           │     └─ [error (last admin)] ─→ Error toast (backend blocks)
        │     │           └─ [clicks Cancel] ─→ Dialog closes
        │     │
        │     ├─ User clicks action menu on PENDING member
        │     │     ├─ "Change role" ─→ Same as ACTIVE member
        │     │     ├─ "Remove" ─→ Same as ACTIVE member
        │     │     └─ "Resend invitation" ─→ POST /api/v1/companies/:id/members/:memberId/resend-invitation
        │     │           ├─ [success] ─→ Success toast
        │     │           └─ [error] ─→ Error toast
        │     │
        │     └─ REMOVED members ─→ No action menu displayed
        │
        └─ [members error] ─→ Error message with error.message
```

---

## Flows

### Happy Path: View and Edit Company Information

```
PRECONDITION: User is ADMIN of an ACTIVE company
ACTOR: ADMIN
TRIGGER: User navigates to /dashboard/settings

1. [UI] User sees Settings page with Company tab active by default
2. [Frontend] useCompanyDetail hook fetches GET /api/v1/companies/:companyId
3. [UI] Form displays with editable name + description, read-only fields below
4. [UI] User edits company name to "New Company Name"
5. [UI] Save button becomes enabled (dirty state detected)
6. [UI] User clicks "Save"
7. [Frontend] useUpdateCompany mutation sends PUT /api/v1/companies/:companyId with { name, description }
8. [Backend] Validates request, updates company
9. [Backend] Returns 200 with updated company
10. [UI] Success toast: "Company information updated successfully"
11. [UI] Form resets dirty state, Save button disables

POSTCONDITION: Company name is updated in database
SIDE EFFECTS: Audit log COMPANY_UPDATED
```

### Happy Path: Invite a New Member

```
PRECONDITION: User is ADMIN, Members tab is active
ACTOR: ADMIN
TRIGGER: User clicks "Invite member" button

1. [UI] Invite Member dialog opens with email input, role dropdown (default: EMPLOYEE), optional message textarea
2. [UI] User enters "new@company.com" and selects "FINANCE" role
3. [UI] User clicks "Send invitation"
4. [Frontend] useInviteMember mutation sends POST /api/v1/companies/:companyId/members with { email, role, message }
5. [Backend] Validates email uniqueness within company, creates PENDING member
6. [Backend] Sends invitation email via SES
7. [Backend] Returns 201 with member data
8. [UI] Success toast: "Invitation sent successfully"
9. [UI] Dialog closes, member list refreshes via queryClient.invalidateQueries
10. [UI] New member appears in table with PENDING status badge

POSTCONDITION: New CompanyMember created with status=PENDING
SIDE EFFECTS: Audit log COMPANY_MEMBER_INVITED, invitation email sent
```

### Happy Path: Change Member Role

```
PRECONDITION: User is ADMIN, Members tab active, target member is ACTIVE or PENDING
ACTOR: ADMIN
TRIGGER: User clicks "Change role" from action menu

1. [UI] Change Role dialog opens with role dropdown pre-set to member's current role
2. [UI] User selects new role (e.g., LEGAL)
3. [UI] User clicks "Save"
4. [Frontend] useUpdateMember mutation sends PUT /api/v1/companies/:companyId/members/:memberId with { role: 'LEGAL' }
5. [Backend] Validates role change (last-admin protection), updates member
6. [Backend] Returns 200 with updated member
7. [UI] Success toast, dialog closes, list refreshes

POSTCONDITION: Member role updated
SIDE EFFECTS: Audit log COMPANY_ROLE_CHANGED
```

### Happy Path: Remove a Member

```
PRECONDITION: User is ADMIN, Members tab active
ACTOR: ADMIN
TRIGGER: User clicks "Remove" from action menu

1. [UI] Remove dialog opens: "Are you sure you want to remove {name}?"
2. [UI] User clicks "Remove" to confirm
3. [Frontend] useRemoveMember mutation sends DELETE /api/v1/companies/:companyId/members/:memberId
4. [Backend] Validates (last-admin protection), marks member as REMOVED
5. [Backend] Returns 204
6. [UI] Success toast: "Member removed successfully"
7. [UI] Dialog closes, list refreshes

POSTCONDITION: Member status changed to REMOVED
SIDE EFFECTS: Audit log COMPANY_MEMBER_REMOVED
```

### Error Path: Remove Last Admin

```
PRECONDITION: Only one ADMIN member exists
ACTOR: ADMIN
TRIGGER: User tries to remove the only ADMIN

1. [UI] User clicks "Remove" on the only ADMIN
2. [UI] Confirm dialog → user clicks "Remove"
3. [Frontend] Sends DELETE request
4. [Backend] Detects last-admin condition → returns 422
5. [UI] Error toast displayed

POSTCONDITION: No change
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 1 | Company selection | No company selected | Error | Empty state shown |
| 2 | Company detail loading | API in flight | Loading | Skeleton placeholders |
| 3 | Save button state | Name empty | Disabled | Cannot submit |
| 3 | Save button state | Name changed | Enabled | Can submit |
| 4 | Company update | API success | Happy | Toast + form reset |
| 4 | Company update | API error | Error | Error toast |
| 5 | Member action menu | Status = REMOVED | Hidden | No actions available |
| 5 | Member action menu | Status = PENDING | Full | Change role, Remove, Resend invitation |
| 5 | Member action menu | Status = ACTIVE | Partial | Change role, Remove |
| 6 | Remove member | Last ADMIN | Error | Backend returns 422 |
| 7 | Invite member | Duplicate email | Error | Backend returns 409 |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| Company | name | Old name | New name | Save company info |
| Company | description | Old description | New description | Save company info |
| CompanyMember | — | — | PENDING (created) | Invite member |
| CompanyMember | role | Old role | New role | Change role |
| CompanyMember | status | ACTIVE/PENDING | REMOVED | Remove member |

---

## By Role

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| View company info | Yes | Yes | Yes | Yes | Yes |
| Edit company info | Yes | No | No | No | No |
| View members | Yes | Yes | Yes | Yes | Yes |
| Invite member | Yes | No | No | No | No |
| Change role | Yes | No | No | No | No |
| Remove member | Yes | No | No | No | No |
| Resend invitation | Yes | No | No | No | No |
