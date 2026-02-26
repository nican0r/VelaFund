# Dashboard — User Flows

**Feature**: Founder dashboard displaying company overview, profile completeness, health status, quick actions, and recent activity
**Actors**: Authenticated user (any role with a company)
**Preconditions**: User is logged in, session is valid
**Related Flows**: [Authentication](./authentication.md) (depends on), [Navigation](./navigation.md) (embedded in sidebar), [Notifications](./notifications.md) (recent activity feed), [Company Profile](./company-profile.md) (profile completeness), [Settings](./settings.md) (quick action links)

---

## Flow Map

```
User navigates to /dashboard
  │
  ├─ [no company selected + not loading] ─→ Show "No company" empty state
  │     └─ (user must create a company via onboarding first)
  │
  ├─ [company loading OR profile loading] ─→ Show skeleton loading UI
  │     └─ All stat cards, completeness card, and health card show pulse animations
  │
  └─ [company loaded + profile loaded/null] ─→ Show full dashboard
        │
        ├─ Welcome Header
        │     ├─ [user.firstName exists] ─→ "Welcome, {firstName}!"
        │     └─ [no firstName] ─→ "Welcome!"
        │
        ├─ Stat Cards (4)
        │     ├─ Company Status (active highlight card)
        │     ├─ Team Members (from company.memberCount)
        │     ├─ Unread Notifications (from polling hook)
        │     └─ Profile Views (from profile.viewCount, 0 if no profile)
        │
        ├─ Profile Completeness Card
        │     ├─ [percentage = 100%] ─→ Show "Profile is complete!" with checkmark
        │     └─ [percentage < 100%] ─→ Show progress bar + checklist of incomplete items (max 4)
        │           └─ [more than 4 incomplete] ─→ Show "+X more" count
        │
        ├─ Company Health Card
        │     ├─ Company Status badge (Active=green, Draft/Inactive=warning)
        │     ├─ CNPJ Validation (Validated=green, Pending=warning)
        │     └─ KYC Verification (Approved=green, Pending=warning, Rejected=error)
        │
        ├─ Quick Actions (4 links)
        │     ├─ Edit Company Page → /dashboard/company-page
        │     ├─ Upload Document → /dashboard/dataroom
        │     ├─ Invite Team Member → /dashboard/settings
        │     └─ View Settings → /dashboard/settings
        │
        └─ Recent Activity
              ├─ [no notifications] ─→ Empty state with bell icon + message
              └─ [has notifications] ─→ List of last 5 with:
                    ├─ Unread dot indicator (blue=unread, gray=read)
                    ├─ Subject text (truncated)
                    ├─ Relative time (now, Xm, Xh, Xd)
                    └─ "View all" link → /dashboard/notifications
```

---

## Flows

### Happy Path: View Dashboard with Company

```
PRECONDITION: User is authenticated, has at least one company
ACTOR: Authenticated user
TRIGGER: User navigates to /dashboard (or it loads as default after login)

1. [Frontend] Extracts selectedCompany from CompanyProvider context
2. [Frontend] Calls useAuth() to get user profile (firstName, kycStatus)
3. [Frontend] Calls useCompanyProfile(companyId) — GET /api/v1/companies/:companyId/profile
   → IF 404: profile = null (normal state — no profile created yet)
   → IF error: throws, TanStack Query handles retry
4. [Frontend] Calls useUnreadCount() — GET /api/v1/users/me/notifications/unread-count
5. [Frontend] Calls useNotifications({ limit: 5, sort: '-createdAt' }) — GET /api/v1/users/me/notifications
6. [UI] Renders welcome header with user's first name
7. [UI] Renders 4 stat cards with values from company + profile + notifications
8. [UI] Computes profile completeness (8 criteria) and renders progress bar + checklist
9. [UI] Renders health card with company status, CNPJ, and KYC badges
10. [UI] Renders quick actions as navigation links
11. [UI] Renders recent activity list (or empty state)

POSTCONDITION: User sees complete dashboard overview
SIDE EFFECTS: None (read-only page)
```

### Alternative Path: No Company

```
PRECONDITION: User is authenticated but has no companies
ACTOR: Authenticated user (new user who skipped company creation)
TRIGGER: User navigates to /dashboard

1. [Frontend] CompanyProvider returns selectedCompany = null, isLoading = false
2. [UI] Renders centered empty state with Building2 icon
3. [UI] Shows "No company found" title and description

POSTCONDITION: User sees empty state, must create a company via onboarding
```

### Alternative Path: Loading State

```
PRECONDITION: User navigated to dashboard, data is being fetched
TRIGGER: Initial page load

1. [Frontend] CompanyProvider returns isLoading = true OR useCompanyProfile returns isLoading = true
2. [UI] Stat cards show pulsing skeleton placeholders
3. [UI] Completeness card shows skeleton bars
4. [UI] Health card shows skeleton rows
5. [Frontend] When data resolves, components re-render with actual values

POSTCONDITION: Skeletons replaced with real data
```

### Alternative Path: No Profile Yet

```
PRECONDITION: Company exists but profile has not been created
TRIGGER: Dashboard loads with a company that has no profile

1. [Frontend] useCompanyProfile returns data = null (404 handled gracefully)
2. [UI] Profile Views stat card shows "0"
3. [UI] Completeness progress bar shows 0% (if no KYC either) or 13% (if KYC approved)
4. [UI] All 8 checklist items shown as incomplete (first 4 visible + "+4 more")
5. [UI] Quick actions still render (user can create profile via "Edit Company Page")

POSTCONDITION: User sees dashboard with empty profile data, encouraged to complete profile
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 1 | Company loaded? | isLoading = true | Loading | Skeleton UI |
| 1 | Company loaded? | selectedCompany = null + not loading | Empty | No-company empty state |
| 1 | Company loaded? | selectedCompany exists + not loading | Happy | Full dashboard |
| 6 | User has firstName? | user.firstName truthy | Happy | Personalized welcome |
| 6 | User has firstName? | user.firstName null/empty | Alternative | Generic welcome |
| 8 | All 8 items complete? | percentage = 100 | Complete | Green checkmark message |
| 8 | All 8 items complete? | percentage < 100 | Incomplete | Progress bar + checklist |
| 8 | Incomplete items > 4? | incompleteItems.length > 4 | Overflow | "+X more" shown |
| 11 | Has notifications? | notifications.length = 0 | Empty | Empty state with icon |
| 11 | Has notifications? | notifications.length > 0 | Active | Notification list + "View all" |

---

## Profile Completeness Criteria

| Item | Condition for "Done" |
|------|---------------------|
| Profile | Profile exists (not null) |
| Description | profile.description is truthy |
| Logo | profile.company.logoUrl is truthy |
| Metrics | profile.metrics has at least 1 item |
| Team | profile.team has at least 1 member |
| Documents | profile.documents has at least 1 document |
| KYC | user.kycStatus === 'APPROVED' |
| Published | profile.status === 'PUBLISHED' |
