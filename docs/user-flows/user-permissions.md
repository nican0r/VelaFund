# User Permissions — User Flows

**Feature**: Role-based permission enforcement across the frontend UI, including navigation filtering, page-level guards, element-level gating, and permission refresh on role changes
**Actors**: All authenticated users (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE)
**Preconditions**: User is authenticated via Privy; user is an ACTIVE member of a company; PermissionContext is mounted within the dashboard layout
**Related Flows**: [Authentication](./authentication.md) (must be logged in), [Member Invitation](./member-invitation.md) (role assigned on invitation), [Company Management](./company-management.md) (company must exist)

---

## Flow Map

```
Authenticated user navigates to /dashboard/*
  |
  +-- [PermissionContext loading] --> show full-page skeleton
  |     |
  |     +-- [fetch GET /members/me succeeds] --> permissions loaded
  |     |     |
  |     |     +-- [ProtectedRoute checks route permission]
  |     |     |     |
  |     |     |     +-- [has permission] --> render page
  |     |     |     |     |
  |     |     |     |     +-- [PermissionGate per element] --> show/hide buttons, columns, sections
  |     |     |     |
  |     |     |     +-- [no permission] --> redirect to /dashboard + error toast
  |     |     |
  |     |     +-- [sidebar filters nav items] --> only permitted items rendered
  |     |
  |     +-- [fetch GET /members/me fails] --> error state
  |           |
  |           +-- [401 Unauthorized] --> logout + redirect to /login?expired=true
  |           +-- [404 Not Found] --> redirect to /dashboard + toast
  |           +-- [500/502/503] --> fallback to deny-all + error toast
  |                                  sidebar shows only Dashboard
  |
  +-- [PermissionContext already loaded] --> use cached permissions
        |
        +-- [user refocuses window] --> refetch permissions (stale check)
        +-- [role change notification] --> refetch permissions
        +-- [permissions updated] --> sidebar + page content re-evaluate
              |
              +-- [user now lacks permission for current page]
                    --> next navigation triggers redirect
```

```
Admin changes user X's role
  |
  +-- PUT /api/v1/companies/:companyId/members/:memberId
  |     |
  |     +-- [success] --> Admin sees success toast
  |     |
  |     +-- [last ADMIN demotion] --> 422 COMPANY_LAST_ADMIN
  |     |     --> Admin sees error toast
  |     |
  |     +-- [protected permission override] --> 422 MEMBER_PERMISSION_PROTECTED
  |           --> Admin sees validation error
  |
  +-- [User X's frontend]
        |
        +-- [window refocus / navigation] --> PermissionContext refetches
        |     |
        |     +-- [new role loaded] --> sidebar re-filters, page guards re-evaluate
        |
        +-- [API call before refetch] --> backend enforces new role
              |
              +-- [now unauthorized] --> 403/404 --> error toast + redirect
```

```
User types unauthorized URL directly
  |
  +-- [e.g., EMPLOYEE goes to /dashboard/members]
        |
        +-- [PermissionContext loaded]
        |     |
        |     +-- [ProtectedRoute checks 'members:manage']
        |     |     |
        |     |     +-- [EMPLOYEE lacks 'members:manage']
        |     |           --> redirect to /dashboard
        |     |           --> toast: "Voce nao tem acesso a esta pagina"
        |     |
        |     +-- [ADMIN has 'members:manage']
        |           --> render members page normally
        |
        +-- [PermissionContext loading] --> spinner until loaded, then check
```

---

## Flows

### Happy Path: Page Load with Permissions

```
PRECONDITION: User is authenticated, is ACTIVE member of a company
ACTOR: Any authenticated user
TRIGGER: Navigation to a /dashboard/* page

1. [Frontend] App renders DashboardLayout which wraps children in PermissionProvider
2. [Frontend] PermissionProvider fires TanStack Query: GET /api/v1/companies/:companyId/members/me
3. [Backend] Verifies Privy JWT, looks up CompanyMember, resolves permissions (role defaults + overrides)
4. [Backend] Returns { role, permissions: [...resolved keys...], status: 'ACTIVE' }
5. [Frontend] PermissionContext stores role and permissions array
6. [Frontend] Sidebar component calls usePermissions().hasPermission() for each nav item
7. [UI] Sidebar renders only nav items the user has permission for
8. [Frontend] ProtectedRoute on the current page evaluates hasPermission(routePermission)
   -> IF true: render page children
9. [UI] Page content renders
10. [Frontend] PermissionGate components within the page evaluate their permissions
11. [UI] Authorized buttons, columns, and sections render; unauthorized ones are absent from DOM
12. [UI] User interacts with the page seeing only permitted actions

POSTCONDITION: User sees a page with only their authorized content
SIDE EFFECTS: None
```

### Happy Path: ADMIN Sees Full Navigation

```
PRECONDITION: User is authenticated with ADMIN role
ACTOR: ADMIN user
TRIGGER: Dashboard load

1. [Frontend] PermissionContext loads permissions: all permission keys present in array
2. [Frontend] Sidebar filters navConfig: all 9 items pass hasPermission() check
3. [UI] Sidebar shows: Dashboard, Cap Table, Shareholders, Transactions, Investments, Options, Documents, Members, Settings
4. [UI] All pages render with full action buttons (create, edit, delete, export)

POSTCONDITION: ADMIN sees the complete sidebar and all action buttons on every page
```

### Happy Path: INVESTOR Sees Limited Navigation

```
PRECONDITION: User is authenticated with INVESTOR role
ACTOR: INVESTOR user
TRIGGER: Dashboard load

1. [Frontend] PermissionContext loads permissions: limited set (dashboard:read, capTable:read, fundingRounds:read, documents:read, documents:sign, members:read)
2. [Frontend] Sidebar filters navConfig:
   - Dashboard: dashboard:read -> VISIBLE
   - Cap Table: capTable:read -> VISIBLE
   - Shareholders: shareholders:read -> NOT in permissions -> HIDDEN
   - Transactions: transactions:read -> NOT in permissions -> HIDDEN
   - Investments: fundingRounds:read -> VISIBLE
   - Options: optionPlans:read -> NOT in permissions -> HIDDEN
   - Documents: documents:read -> VISIBLE
   - Members: members:manage -> NOT in permissions -> HIDDEN
   - Settings: settings:manage -> NOT in permissions -> HIDDEN
3. [UI] Sidebar shows: Dashboard, Cap Table, Investments, Documents (4 items)
4. [UI] On Cap Table page: data is filtered server-side to INVESTOR's own holdings only
5. [UI] No create/edit/delete buttons visible on any page (PermissionGates hide them)

POSTCONDITION: INVESTOR sees 4 sidebar items and read-only content scoped to their own data
```

### Happy Path: EMPLOYEE Sees Minimal Navigation

```
PRECONDITION: User is authenticated with EMPLOYEE role
ACTOR: EMPLOYEE user
TRIGGER: Dashboard load

1. [Frontend] PermissionContext loads permissions: minimal set (dashboard:read, optionGrants:read, documents:read, documents:sign, members:read)
2. [Frontend] Sidebar filters navConfig:
   - Dashboard: dashboard:read -> VISIBLE
   - Cap Table: capTable:read -> NOT in permissions -> HIDDEN
   - Options: optionPlans:read -> NOT in permissions BUT optionGrants:read IS -> check nav config permission
   Note: Nav config uses 'optionPlans:read' for Options. Backend grants 'optionGrants:read' (own) to EMPLOYEE.
   The nav permission for Options must use a permission that EMPLOYEE has.
   Resolution: Options nav item uses 'optionGrants:read' as its permission key.
   - Documents: documents:read -> VISIBLE
3. [UI] Sidebar shows: Dashboard, Options, Documents (3 items)
4. [UI] On Options page: data is filtered server-side to EMPLOYEE's own grants only
5. [UI] Only "Request Exercise" button visible (PermissionGate for optionGrants:create or exercise flow)

POSTCONDITION: EMPLOYEE sees 3 sidebar items with data scoped to their own records
```

### Alternative Path: Unauthorized Direct URL Access

```
PRECONDITION: User is authenticated with EMPLOYEE role
ACTOR: EMPLOYEE user
TRIGGER: Direct navigation to /dashboard/members (via bookmark, typed URL, or shared link)

1. [Frontend] Next.js App Router loads the members page component
2. [Frontend] ProtectedRoute wraps MembersContent with permission='members:manage'
3. [Frontend] usePermissions().hasPermission('members:manage') evaluates to false for EMPLOYEE
4. [Frontend] ProtectedRoute's useEffect fires:
   a. toast.error("Voce nao tem acesso a esta pagina")
   b. router.replace('/dashboard')
5. [UI] User briefly sees nothing (ProtectedRoute renders null during redirect)
6. [UI] User lands on /dashboard with an error toast visible

POSTCONDITION: User is on /dashboard; members page content was never rendered
SIDE EFFECTS: None on frontend. No backend API call was made for members data.
```

### Alternative Path: Permission Override Grants New Capability

```
PRECONDITION: FINANCE user Y has override { "shareholders:create": true }
ACTOR: FINANCE user Y
TRIGGER: Navigation to /dashboard/shareholders

1. [Frontend] PermissionContext fetches resolved permissions
2. [Backend] Resolves: override['shareholders:create'] = true, merged with FINANCE defaults
3. [Backend] Returns permissions array including 'shareholders:create'
4. [Frontend] On shareholders page:
   - ProtectedRoute checks 'shareholders:read': FINANCE has this -> passes
   - PermissionGate checks 'shareholders:create': now in permissions -> passes
5. [UI] "Adicionar Acionista" button renders in the toolbar (normally hidden for FINANCE)
6. [UI] User clicks button, create modal opens, form submits to backend
7. [Backend] PermissionGuard checks 'shareholders:create': override grants it -> allowed

POSTCONDITION: FINANCE user with override can create shareholders
SIDE EFFECTS: PERMISSION_CHANGED audit log was created when the override was set
```

### Alternative Path: Permission Override Restricts Capability

```
PRECONDITION: ADMIN user Z has override { "transactions:approve": false }
ACTOR: ADMIN user Z
TRIGGER: Navigation to /dashboard/transactions

1. [Frontend] PermissionContext fetches resolved permissions
2. [Backend] Resolves: override['transactions:approve'] = false, overrides ADMIN default
3. [Backend] Returns permissions array WITHOUT 'transactions:approve'
4. [Frontend] On transactions page:
   - ProtectedRoute checks 'transactions:read': ADMIN has this -> passes
   - PermissionGate checks 'transactions:approve': NOT in permissions -> fails
5. [UI] "Approve" button on pending transactions is HIDDEN
6. [UI] User can view and create transactions but cannot approve them

POSTCONDITION: ADMIN user with restriction cannot see or use the approve button
```

### Error Path: Permission Fetch Fails (Network Error)

```
PRECONDITION: User is authenticated, network is unreliable
ACTOR: Any user
TRIGGER: Dashboard load with network failure

1. [Frontend] PermissionProvider fires GET /api/v1/companies/:companyId/members/me
2. [Frontend] TanStack Query retries 2 times (500/502/503 or network error)
3. [Frontend] All retries fail
4. [Frontend] PermissionContext enters error state:
   - role = null, permissions = []
   - isLoading = false, error = Error
5. [UI] Error toast: "Erro ao carregar permissoes. Tente recarregar a pagina."
6. [Frontend] All hasPermission() calls return false (deny-all fallback)
7. [UI] Sidebar shows only Dashboard (dashboard:read is the only item that passes — actually it also fails in deny-all)
   Note: In deny-all mode, even Dashboard may be hidden. The PermissionProvider should ensure at minimum the dashboard:read is always granted to prevent a completely blank sidebar.
   Resolution: ProtectedRoute for /dashboard does not require any permission (it is the fallback route).
8. [UI] User sees dashboard page content but no gated elements

POSTCONDITION: User sees minimal UI with no gated features until permissions load successfully
SIDE EFFECTS: None. User can retry by refreshing the page.
```

### Error Path: Session Expired During Use

```
PRECONDITION: User is on a dashboard page, session expires
ACTOR: Any user
TRIGGER: PermissionContext refetch returns 401

1. [Frontend] PermissionContext refetch (on window focus) fires GET /members/me
2. [Backend] JWT verification fails (expired token) -> returns 401 AUTH_TOKEN_EXPIRED
3. [Frontend] TanStack Query does not retry 401 errors
4. [Frontend] API error handler detects 401:
   a. Calls logout() (clears cookies, resets auth state)
   b. Redirects to /login?expired=true
5. [UI] User lands on login page with "Sessao expirada" message

POSTCONDITION: User is logged out and on the login page
SIDE EFFECTS: AUTH_TOKEN_EXPIRED logged on backend
```

### Error Path: Role Changed Mid-Session (API Call Fails)

```
PRECONDITION: Admin changed user X from FINANCE to INVESTOR. User X has not refetched permissions yet.
ACTOR: User X (FINANCE -> INVESTOR)
TRIGGER: User X clicks "Create Transaction" before permissions refresh

1. [UI] User X is on /dashboard/transactions (still visible from old permissions)
2. [UI] User X clicks "Nova Transacao" (button still visible from old permissions)
3. [Frontend] Sends POST /api/v1/companies/:companyId/transactions
4. [Backend] CompanyScopeGuard loads X's membership: role is now INVESTOR
5. [Backend] PermissionGuard checks 'transactions:create': INVESTOR does not have this -> denied
6. [Backend] Returns 403 AUTH_FORBIDDEN
7. [Frontend] Error handler receives 403:
   a. Toast: "Voce nao tem permissao para realizar esta acao"
   b. Redirect to /dashboard
8. [Frontend] PermissionContext refetches (triggered by navigation)
9. [Frontend] New role loaded: INVESTOR. Sidebar re-filters.
10. [UI] Transactions nav item is now HIDDEN

POSTCONDITION: User X is on /dashboard with INVESTOR navigation
SIDE EFFECTS: Permission denial logged on backend (warn level)
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 1 | PermissionContext load | Fetch succeeds | Happy | Permissions cached, UI renders with filtering |
| 1 | PermissionContext load | Fetch returns 401 | Error | Logout + redirect to /login |
| 1 | PermissionContext load | Fetch returns 404 | Error | Redirect to /dashboard + toast |
| 1 | PermissionContext load | Fetch fails (network/5xx) | Error | Deny-all fallback + error toast |
| 2 | ProtectedRoute check | User has route permission | Happy | Page content renders |
| 2 | ProtectedRoute check | User lacks route permission | Redirect | Redirect to /dashboard + toast |
| 3 | PermissionGate check | User has element permission | Happy | Element renders in DOM |
| 3 | PermissionGate check | User lacks element permission | Hidden | Element absent from DOM |
| 4 | Sidebar nav filter | User has nav item permission | Happy | Nav item visible |
| 4 | Sidebar nav filter | User lacks nav item permission | Hidden | Nav item absent |
| 5 | API call after role change | Backend allows | Happy | Normal response |
| 5 | API call after role change | Backend denies (403/404) | Error | Toast + redirect + refetch |
| 6 | Window refocus | Permissions unchanged | No-op | Cached data still valid (staleTime) |
| 6 | Window refocus | Permissions changed | Update | New permissions loaded, UI re-renders |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| PermissionContext | isLoading | true | false | GET /members/me completes (success or error) |
| PermissionContext | role | null | 'FINANCE' | Successful fetch |
| PermissionContext | permissions | [] | ['capTable:read', ...] | Successful fetch |
| PermissionContext | role | 'FINANCE' | 'INVESTOR' | Refetch after role change |
| PermissionContext | permissions | [FINANCE set] | [INVESTOR set] | Refetch after role change |
| PermissionContext | error | null | Error | Fetch failure after retries |
| Sidebar | visible items | 9 items (ADMIN) | 4 items (INVESTOR) | Role change refetch |
| ProtectedRoute | state | checking | authorized | Permission check passes |
| ProtectedRoute | state | checking | redirect | Permission check fails |

---

## Cross-Feature References

**Depends on**: [Authentication](./authentication.md) — user must be authenticated; AuthContext provides user identity for the permission fetch
**Depends on**: [Company Management](./company-management.md) — company must exist; companyId is required for the permission endpoint
**Depends on**: [Member Invitation](./member-invitation.md) — role is assigned during the invitation flow; the member must be ACTIVE
**Feeds into**: All dashboard features — every page and interactive element uses PermissionGate or ProtectedRoute
**Triggered by**: Role change (PUT /members/:memberId) — triggers permission refetch on the affected user's frontend

---

## Permission Branches by Role

### Sidebar Visibility

| Nav Item | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|----------|-------|---------|-------|----------|----------|
| Dashboard | Visible | Visible | Visible | Visible | Visible |
| Cap Table | Visible | Visible | Visible | Visible (own) | Hidden |
| Shareholders | Visible | Visible | Visible | Hidden | Hidden |
| Transactions | Visible | Visible | Visible | Hidden | Hidden |
| Investments | Visible | Visible | Visible | Visible (own) | Hidden |
| Options | Visible | Visible | Hidden | Hidden | Visible (own) |
| Documents | Visible | Visible | Visible | Visible (own) | Visible (own) |
| Members | Visible | Hidden | Hidden | Hidden | Hidden |
| Settings | Visible | Hidden | Hidden | Hidden | Hidden |

### Page-Level Actions

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| Create shareholder | Button visible | Hidden | Hidden | Page hidden | Page hidden |
| Edit shareholder | Button visible | Hidden | Hidden | Page hidden | Page hidden |
| Delete shareholder | Button visible | Hidden | Hidden | Page hidden | Page hidden |
| Create transaction | Button visible | Button visible | Hidden | Page hidden | Page hidden |
| Approve transaction | Button visible | Button visible | Hidden | Page hidden | Page hidden |
| Create funding round | Button visible | Button visible | Hidden | Hidden | Page hidden |
| Export cap table | Button visible | Button visible | Hidden | Hidden | Page hidden |
| Create document | Button visible | Hidden | Button visible | Hidden | Hidden |
| Sign document | Button visible | Button visible | Button visible | Button visible | Button visible |
| Manage members | Full page | Page hidden | Page hidden | Page hidden | Page hidden |
| Edit settings | Editable form | Page hidden | Page hidden | Page hidden | Page hidden |
| View audit logs | Visible | Page hidden | Visible | Page hidden | Page hidden |
