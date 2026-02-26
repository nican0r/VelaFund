# Sidebar Navigation -- User Flows

**Feature**: Sidebar navigation for the founder dashboard, providing access to all product areas via a persistent side panel on desktop and a slide-out drawer on mobile.

**Actors**: Founders (any authenticated user with at least one company)

**Preconditions**:
- User is authenticated via Privy
- User has completed onboarding and has at least one company
- User is on a `/dashboard/*` route (the `(dashboard)` route group renders `DashboardLayout`)

**Related Flows**:
- [Authentication](./authentication.md) -- user must be logged in
- [Onboarding](./onboarding.md) -- user must have completed onboarding before reaching the dashboard
- [Settings](./settings.md) -- Settings nav item leads to Settings page
- [Notifications](./notifications.md) -- Notifications nav item leads to Notifications page

---

## Flow Map

```
User lands on /dashboard
  |
  +-- [desktop >= 1024px] --> Desktop Sidebar renders (expanded, 240px)
  |     |
  |     +-- User clicks nav item
  |     |     |
  |     |     +-- [page implemented] --> Next.js navigates, active state updates
  |     |     +-- [page is stub] --> Next.js navigates to stub, ComingSoon component renders
  |     |
  |     +-- User clicks collapse toggle (sidebar footer)
  |     |     |
  |     |     +-- Sidebar collapses to 64px (icon-only mode)
  |     |     +-- Content area reclaims space via padding transition
  |     |     +-- Section labels (MENU, GENERAL) hidden
  |     |     +-- Nav items show icon-only with title tooltip
  |     |     +-- User section shows avatar only (no name, email, or logout button)
  |     |
  |     +-- User clicks expand toggle (collapsed state)
  |     |     +-- Sidebar expands to 240px
  |     |     +-- Labels, text, and user section fully visible
  |     |
  |     +-- User clicks Logout
  |           +-- Calls logout() from AuthContext
  |           +-- Redirects to /login
  |
  +-- [mobile/tablet < 1024px] --> Desktop Sidebar hidden, Topbar shows hamburger icon
        |
        +-- User clicks hamburger icon in Topbar
        |     |
        |     +-- MobileSidebar opens (overlay + slide-in panel, 240px)
        |     +-- Body scroll locked
        |     +-- Three ways to close:
        |           |
        |           +-- [close button (X)] --> MobileSidebar closes
        |           +-- [overlay click] --> MobileSidebar closes
        |           +-- [route change] --> MobileSidebar auto-closes via useEffect on pathname
        |
        +-- User clicks nav item (mobile)
        |     |
        |     +-- Next.js navigates to route
        |     +-- pathname changes --> useEffect fires onClose()
        |     +-- MobileSidebar closes, body scroll restored
        |     +-- Active state updates on next open
        |
        +-- User clicks Logout (mobile)
              +-- Calls logout() from AuthContext
              +-- Redirects to /login
```

---

## Flows

### Happy Path: Navigate to a Page (Desktop)

```
PRECONDITION: User is on any /dashboard/* route, desktop viewport (>= 1024px)
ACTOR: Founder
TRIGGER: User clicks a nav item in the sidebar

1. [UI] Sidebar renders with MENU (9 items) and GENERAL (3 items) sections
2. [UI] User clicks a nav item (e.g., "Dataroom")
3. [Frontend] Next.js `<Link>` triggers client-side navigation to the item's href
4. [Frontend] usePathname() returns the new path
5. [UI] isActive() evaluates for each nav item:
   - /dashboard uses exact match (pathname === '/dashboard')
   - All others use startsWith match (pathname.startsWith(href))
6. [UI] Active item gets navy-800 background, white text, and 3px ocean-600 left accent bar
7. [UI] Previous active item reverts to default styling (white/70% text, transparent bg)
8. [UI] Page content renders in the main content area

POSTCONDITION: New page is displayed; sidebar reflects the active route
SIDE EFFECTS: None
```

### Happy Path: Navigate to a Page (Mobile)

```
PRECONDITION: User is on any /dashboard/* route, mobile/tablet viewport (< 1024px)
ACTOR: Founder
TRIGGER: User taps hamburger icon, then taps a nav item

1. [UI] Desktop sidebar is hidden (lg:block); Topbar shows hamburger Menu icon
2. [UI] User taps the hamburger icon in the Topbar
3. [Frontend] Topbar calls onMenuClick(), which sets mobileSidebarOpen = true in DashboardLayout
4. [UI] MobileSidebar renders: overlay (navy-900/50%) + slide-in panel (240px, left-anchored)
5. [UI] Body scroll is locked (document.body.style.overflow = 'hidden')
6. [UI] User taps a nav item (e.g., "Analytics")
7. [Frontend] Next.js <Link> triggers client-side navigation
8. [Frontend] pathname changes, useEffect in MobileSidebar fires onClose()
9. [Frontend] DashboardLayout sets mobileSidebarOpen = false
10. [UI] MobileSidebar unmounts (returns null when open = false)
11. [UI] Body scroll is restored (overflow = '')
12. [UI] Page content renders in the main content area

POSTCONDITION: New page is displayed; mobile sidebar is closed
SIDE EFFECTS: None
```

### Happy Path: Collapse and Expand Sidebar (Desktop)

```
PRECONDITION: User is on any /dashboard/* route, desktop viewport
ACTOR: Founder
TRIGGER: User clicks the collapse/expand toggle in the sidebar footer

1. [UI] Sidebar footer shows a toggle button with ChevronLeft icon and "Collapse" label
2. [UI] User clicks the toggle
3. [Frontend] Sidebar calls onToggle(), DashboardLayout toggles sidebarCollapsed state
4. [UI] Sidebar transitions width from 240px to 64px (CSS transition-[width] duration-200)
5. [UI] Main content area adjusts left padding from pl-sidebar to pl-sidebar-collapsed
6. [UI] In collapsed state:
   - Logo area shows "N" instead of "Navia"
   - Section labels (MENU, GENERAL) are hidden
   - Nav items show icon only, centered, with title attribute for tooltip
   - User section shows avatar only (no name, email, or logout button)
   - Toggle button shows ChevronRight icon only
7. [UI] User clicks toggle again
8. [UI] Sidebar expands back to 240px with all labels restored

POSTCONDITION: Sidebar is in the toggled state (collapsed or expanded)
SIDE EFFECTS: None (state is local, not persisted across sessions)
```

### Happy Path: Close Mobile Sidebar via Overlay

```
PRECONDITION: Mobile sidebar is open
ACTOR: Founder
TRIGGER: User taps the overlay area outside the sidebar panel

1. [UI] User taps the semi-transparent overlay (navy-900/50%)
2. [Frontend] Overlay div's onClick fires onClose()
3. [Frontend] DashboardLayout sets mobileSidebarOpen = false
4. [UI] MobileSidebar unmounts, body scroll restored

POSTCONDITION: Mobile sidebar is closed
SIDE EFFECTS: None
```

### Happy Path: Close Mobile Sidebar via Close Button

```
PRECONDITION: Mobile sidebar is open
ACTOR: Founder
TRIGGER: User taps the X close button in the sidebar header

1. [UI] User taps the X button (top-right of sidebar panel header)
2. [Frontend] Button onClick fires onClose()
3. [Frontend] DashboardLayout sets mobileSidebarOpen = false
4. [UI] MobileSidebar unmounts, body scroll restored

POSTCONDITION: Mobile sidebar is closed
SIDE EFFECTS: None
```

### Happy Path: Navigate to Stub Page (Coming Soon)

```
PRECONDITION: User clicks a nav item whose page is not yet implemented
ACTOR: Founder
TRIGGER: User clicks a stub nav item (e.g., "AI Reports", "Investors", "Bank Connections")

1. [UI] User clicks the nav item
2. [Frontend] Next.js navigates to the route (e.g., /dashboard/ai-reports)
3. [UI] The stub page renders the ComingSoon component:
   - Page title (from sidebar i18n key, e.g., "AI Reports")
   - Feature-specific Lucide icon (64px, gray-300)
   - "Coming Soon" heading (from comingSoon.title i18n key)
   - Description paragraph (from comingSoon.description i18n key)
4. [UI] Sidebar highlights the active nav item normally

POSTCONDITION: Stub page is displayed; user understands the feature is planned but not yet available
SIDE EFFECTS: None
```

### Happy Path: Logout via Sidebar

```
PRECONDITION: User is on any /dashboard/* route
ACTOR: Founder
TRIGGER: User clicks the "Log out" button in the sidebar user section

1. [UI] User clicks "Log out" button (visible only when sidebar is expanded, or always on mobile)
2. [Frontend] Button onClick calls logout() from useAuth()
3. [Frontend] AuthContext clears session (calls Privy logout, clears cookies)
4. [Frontend] User is redirected to /login

POSTCONDITION: User is logged out and on the login page
SIDE EFFECTS: Backend session invalidated
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 1 | Viewport size | >= 1024px (lg breakpoint) | Desktop | Desktop sidebar visible, hamburger hidden |
| 1 | Viewport size | < 1024px | Mobile/Tablet | Desktop sidebar hidden, hamburger visible in Topbar |
| 2 | Active route matching | href === '/dashboard' | Exact match | Only /dashboard exact path activates Dashboard item |
| 2 | Active route matching | pathname.startsWith(href) | Prefix match | All non-dashboard items use startsWith for nested routes |
| 3 | Page implementation | Route has full page component | Implemented | Full page renders |
| 3 | Page implementation | Route uses ComingSoon component | Stub | ComingSoon placeholder renders |
| 4 | Sidebar collapsed state | collapsed = true | Collapsed | Icon-only mode (64px), tooltips via title attr |
| 4 | Sidebar collapsed state | collapsed = false | Expanded | Full labels + icons (240px) |
| 5 | Mobile sidebar close trigger | Route change / overlay click / X button | Close | MobileSidebar unmounts, scroll restored |

---

## Nav Item Reference

### MENU Section (9 items)

| Label (i18n key) | Route | Icon | Page Status |
|-------------------|-------|------|-------------|
| Dashboard (`sidebar.menu.dashboard`) | `/dashboard` | LayoutDashboard | Implemented (stat cards + quick actions) |
| Company Page (`sidebar.menu.companyPage`) | `/dashboard/company-page` | Globe | Stub (ComingSoon) |
| Dataroom (`sidebar.menu.dataroom`) | `/dashboard/dataroom` | FolderOpen | Stub (ComingSoon) |
| AI Reports (`sidebar.menu.aiReports`) | `/dashboard/ai-reports` | Sparkles | Stub (ComingSoon) |
| Investor Q&A (`sidebar.menu.investorQA`) | `/dashboard/qa-conversations` | MessageSquare | Stub (ComingSoon) |
| Updates (`sidebar.menu.updates`) | `/dashboard/updates` | Megaphone | Stub (ComingSoon) |
| Bank Connections (`sidebar.menu.bankConnections`) | `/dashboard/bank-connections` | Landmark | Stub (ComingSoon) |
| Analytics (`sidebar.menu.analytics`) | `/dashboard/analytics` | BarChart3 | Stub (ComingSoon) |
| Investors (`sidebar.menu.investors`) | `/dashboard/investors` | Users | Stub (ComingSoon) |

### GENERAL Section (3 items)

| Label (i18n key) | Route | Icon | Page Status |
|-------------------|-------|------|-------------|
| Notifications (`sidebar.general.notifications`) | `/dashboard/notifications` | Bell | Implemented (full notification center) |
| Settings (`sidebar.general.settings`) | `/dashboard/settings` | Settings | Implemented (Company Info + Members tabs) |
| Help (`sidebar.general.help`) | `/dashboard/help` | HelpCircle | Stub (ComingSoon) |

---

## Architecture Notes

### Single Source of Truth for Nav Items

Both `Sidebar` (desktop) and `MobileSidebar` (mobile) import `menuItems` and `generalItems` from `/src/lib/sidebar-nav.ts`. This prevents drift between desktop and mobile navigation. Adding, removing, or reordering a nav item requires changing only the `sidebar-nav.ts` file and the corresponding i18n keys.

### i18n Integration

All user-facing labels are resolved via `next-intl` using the `sidebar` namespace:

- Section labels: `sidebar.menuLabel`, `sidebar.generalLabel`
- Menu items: `sidebar.menu.dashboard`, `sidebar.menu.companyPage`, etc.
- General items: `sidebar.general.notifications`, `sidebar.general.settings`, `sidebar.general.help`
- Actions: `sidebar.collapse`, `sidebar.expand`, `sidebar.logout`

Translations exist in both `messages/pt-BR.json` and `messages/en.json`.

### Component Hierarchy

```
(dashboard)/layout.tsx
  +-- DashboardLayout
        +-- CompanyProvider (wraps all dashboard children)
        +-- Sidebar (desktop, hidden below lg)
        |     +-- SidebarCompanySwitcher
        |     +-- NavLink (per item from sidebar-nav.ts)
        +-- MobileSidebar (mobile, hidden at lg and above)
        |     +-- SidebarCompanySwitcher
        |     +-- MobileNavLink (per item from sidebar-nav.ts)
        +-- Topbar
        |     +-- Hamburger button (visible below lg, calls onMenuClick)
        |     +-- NotificationDropdown
        |     +-- CompanySwitcher
        +-- <main> children (page content)
```

### Collapse State Persistence

The sidebar collapsed/expanded state is stored in React local state (`useState` in `DashboardLayout`). It resets to expanded on page refresh. There is no persistence to localStorage or cookies.

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| DashboardLayout | sidebarCollapsed | false | true | User clicks collapse toggle |
| DashboardLayout | sidebarCollapsed | true | false | User clicks expand toggle |
| DashboardLayout | mobileSidebarOpen | false | true | User clicks hamburger in Topbar |
| DashboardLayout | mobileSidebarOpen | true | false | User clicks close/overlay or route changes |
