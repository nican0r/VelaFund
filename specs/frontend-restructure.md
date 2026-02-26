# Frontend Restructure Specification

**Topic of Concern**: Restructure the frontend from a cap-table management dashboard to a company-page-builder (founder) + investor-portal (investor) dual-experience application

**One-Sentence Description**: The frontend is restructured into two distinct experiences -- a founder dashboard for building investor-ready company pages with AI-powered tools, and an investor portal for viewing portfolio companies -- sharing a common design system, auth layer, and component library.

---

## Overview

The Navia frontend pivots from a cap-table-focused single dashboard to a dual-experience platform:

1. **Founder Experience** (`(dashboard)/`): A sidebar-navigated dashboard where founders build their company page, manage a dataroom, generate AI reports, handle investor Q&A, publish updates, connect bank accounts, and track analytics.
2. **Investor Experience** (`(investor)/`): A clean, read-focused portal where investors browse their portfolio of companies, view updates, access datarooms, review financials, and ask questions via Q&A chat.
3. **Public Profile** (`p/[slug]/`): A publicly accessible (or gated) company profile page viewable without authentication.

All three experiences share the existing design system (`design-system.md`), authentication layer (`authentication.md`), and i18n infrastructure (`i18n.md`).

### Relationship to Existing Specs

- **[company-profile.md](./company-profile.md)**: Defines the data model and API for the Company Page builder. The frontend spec here defines the UI components and page structure.
- **[company-dataroom.md](./company-dataroom.md)**: Defines document upload, storage, AI processing APIs. This spec defines the frontend dataroom page, upload UX, and AI status badges.
- **[kyc-verification.md](./kyc-verification.md)**: Defines the backend KYC verification flow. This spec defines the multi-step KYC frontend pages (currently 0% implemented).
- **[authentication.md](./authentication.md)**: Auth via Privy is unchanged. This spec defines how auth routes founders vs investors post-login.
- **[company-membership.md](./company-membership.md)**: Member roles determine sidebar visibility and investor access levels.
- **[notifications.md](./notifications.md)**: Notification pages are kept with minimal changes.

### Planned Specs (Backend Not Yet Written)

The following frontend pages depend on backend specs that are planned but not yet written:

- **AI Reports** -- depends on `ai-document-intelligence.md` (planned)
- **Q&A Conversations** -- depends on `investor-qa.md` (planned)
- **Bank Connections** -- depends on `open-finance.md` (planned)
- **Investor Portal** -- depends on `investor-portal.md` (planned)

Frontend pages for these features can be scaffolded with mock data, but full integration requires the corresponding backend specs and implementations.

---

## Current State (Post-Cleanup)

### Framework and Libraries
- **Framework**: Next.js 14 App Router, TypeScript
- **State/Data**: TanStack Query v5
- **UI**: shadcn/ui + Tailwind CSS 3
- **Auth**: Privy SDK (`@privy-io/react-auth`)
- **i18n**: next-intl
- **Icons**: Lucide React

### Existing Pages
| Path | Status |
|------|--------|
| `(auth)/login/page.tsx` | Keep |
| `(auth)/invitations/[token]/page.tsx` | Keep |
| `(dashboard)/dashboard/page.tsx` | Modify |
| `(dashboard)/dashboard/notifications/page.tsx` | Keep |
| `(dashboard)/dashboard/settings/page.tsx` | Keep |
| `(dashboard)/dashboard/reports/page.tsx` | Repurpose for AI Reports |
| `onboarding/page.tsx` | Modify (add founder/investor choice, KYC step) |

### Existing Hooks
| Hook | Status |
|------|--------|
| `use-invitations.ts` | Keep |
| `use-members.ts` | Keep |
| `use-notifications.ts` | Keep |
| `use-onboarding.ts` | Keep |
| `use-reports.ts` | Repurpose |

### Existing Layout Components
| Component | Status |
|-----------|--------|
| `layout/dashboard-layout.tsx` | Modify (founder layout) |
| `layout/sidebar.tsx` | Modify (new nav items) |
| `layout/mobile-sidebar.tsx` | Modify (new nav items) |
| `layout/topbar.tsx` | Keep |
| `layout/company-switcher.tsx` | Keep |

### Existing i18n Namespaces
Current top-level keys in `messages/pt-BR.json` and `messages/en.json`:
`common`, `companySwitcher`, `dashboard`, `errors`, `invitations`, `litigation`, `notifications`, `onboarding`, `portfolio`, `reports`, `settings`

### Existing Type Files
| File | Status |
|------|--------|
| `types/api.ts` | Keep (ApiResponse, PaginatedApiResponse, etc.) |
| `types/company.ts` | Keep + extend (add new notification types, remove legacy report types) |

---

## Routing Structure

```
frontend/src/app/
├── (auth)/
│   ├── login/page.tsx                              # Privy login (existing, keep)
│   └── invitations/[token]/page.tsx                # Member invitation acceptance (existing, keep)
│
├── (dashboard)/                                     # Founder experience (existing layout group)
│   └── dashboard/
│       ├── page.tsx                                 # Dashboard home (MODIFY)
│       ├── company-page/
│       │   ├── page.tsx                             # Company page builder / profile editor (NEW)
│       │   └── preview/page.tsx                     # Preview published page (NEW)
│       ├── dataroom/
│       │   └── page.tsx                             # Document management + AI processing (NEW)
│       ├── ai-reports/
│       │   └── page.tsx                             # AI report generation + list (NEW)
│       ├── qa-conversations/
│       │   └── page.tsx                             # Founder view of investor Q&A (NEW)
│       ├── updates/
│       │   └── page.tsx                             # Company updates management (NEW)
│       ├── bank-connections/
│       │   └── page.tsx                             # Open Finance connections + financial dashboard (NEW)
│       ├── analytics/
│       │   └── page.tsx                             # Profile view analytics (NEW)
│       ├── investors/
│       │   └── page.tsx                             # Investor access management (NEW)
│       ├── notifications/page.tsx                   # Notification center (existing, keep)
│       ├── settings/page.tsx                        # Company settings (existing, keep)
│       └── reports/page.tsx                         # (existing, repurpose as AI reports redirect)
│
├── (investor)/                                      # Investor experience (NEW layout group)
│   └── portfolio/
│       ├── page.tsx                                 # Portfolio - list of companies (NEW)
│       └── [profileId]/
│           ├── page.tsx                             # Company overview (NEW)
│           ├── updates/page.tsx                     # Updates feed (NEW)
│           ├── financials/page.tsx                  # Financial data (NEW, access-gated)
│           ├── documents/page.tsx                   # Dataroom viewer (NEW, access-gated)
│           └── qa/page.tsx                          # Q&A chat (NEW, FULL access only)
│
├── p/[slug]/                                        # Public company profile (NEW)
│   └── page.tsx                                     # Public/email-gated page
│
├── onboarding/
│   ├── page.tsx                                     # Onboarding flow (MODIFY)
│   └── kyc/page.tsx                                 # KYC verification steps (NEW)
│
└── api/                                             # Next.js API routes (if any, existing)
```

### Route Group Layouts

Each route group has its own `layout.tsx`:

| Route Group | Layout File | Description |
|-------------|-------------|-------------|
| `(auth)` | `(auth)/layout.tsx` | Centered card layout, gray-50 background, no sidebar |
| `(dashboard)` | `(dashboard)/layout.tsx` | Sidebar + topbar + content area (existing `DashboardLayout`) |
| `(investor)` | `(investor)/layout.tsx` | Top navigation bar + content area (NEW) |
| `p/[slug]` | `p/layout.tsx` | Minimal layout, no nav (public-facing) |
| `onboarding` | `onboarding/layout.tsx` | Centered card layout (existing) |

---

## Sidebar Navigation (Founder Dashboard)

### Updated Menu Items

Replace the current sidebar `menuItems` and `generalItems` arrays in `sidebar.tsx`:

```typescript
import {
  LayoutDashboard,
  Globe,
  FolderOpen,
  Sparkles,
  MessageSquare,
  Megaphone,
  Landmark,
  BarChart3,
  Users,
  Bell,
  Settings,
  HelpCircle,
} from 'lucide-react';

const menuItems: NavItem[] = [
  { label: 'Dashboard',        href: '/dashboard',                   icon: LayoutDashboard },
  { label: 'Company Page',     href: '/dashboard/company-page',      icon: Globe },
  { label: 'Dataroom',         href: '/dashboard/dataroom',          icon: FolderOpen },
  { label: 'AI Reports',       href: '/dashboard/ai-reports',        icon: Sparkles },
  { label: 'Investor Q&A',     href: '/dashboard/qa-conversations',  icon: MessageSquare },
  { label: 'Updates',          href: '/dashboard/updates',           icon: Megaphone },
  { label: 'Bank Connections',  href: '/dashboard/bank-connections',  icon: Landmark },
  { label: 'Analytics',        href: '/dashboard/analytics',         icon: BarChart3 },
  { label: 'Investors',        href: '/dashboard/investors',         icon: Users },
];

const generalItems: NavItem[] = [
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell },
  { label: 'Settings',      href: '/dashboard/settings',      icon: Settings },
  { label: 'Help',          href: '/dashboard/help',          icon: HelpCircle },
];
```

### Sidebar Labels (i18n)

All sidebar labels must use translation keys, not hardcoded strings. Add to `sidebar` namespace:

| Key | PT-BR | EN |
|-----|-------|----|
| `sidebar.menu.dashboard` | Painel | Dashboard |
| `sidebar.menu.companyPage` | Pagina da Empresa | Company Page |
| `sidebar.menu.dataroom` | Dataroom | Dataroom |
| `sidebar.menu.aiReports` | Relatorios IA | AI Reports |
| `sidebar.menu.investorQA` | Q&A Investidores | Investor Q&A |
| `sidebar.menu.updates` | Atualizacoes | Updates |
| `sidebar.menu.bankConnections` | Conexoes Bancarias | Bank Connections |
| `sidebar.menu.analytics` | Analytics | Analytics |
| `sidebar.menu.investors` | Investidores | Investors |
| `sidebar.general.notifications` | Notificacoes | Notifications |
| `sidebar.general.settings` | Configuracoes | Settings |
| `sidebar.general.help` | Ajuda | Help |

### Mobile Sidebar

The `MobileSidebar` component (`mobile-sidebar.tsx`) must be updated in sync with the desktop sidebar to use the same `menuItems` and `generalItems` arrays. Extract the nav item arrays to a shared file (`lib/sidebar-nav.ts`) to avoid duplication.

---

## Investor Layout (`(investor)/`)

### Design

The investor experience uses a different layout than the founder dashboard:

- **No sidebar** -- top navigation bar only
- **Simpler, read-focused** design optimized for consuming information
- Uses the same design system tokens (colors, typography, spacing, shadows)

### Top Navigation Bar

```
+------------------------------------------------------------------------+
|  Navia (logo)  |  Portfolio  |  Notifications  |  Settings  |  Avatar  |
+------------------------------------------------------------------------+
```

| Element | Specification |
|---------|---------------|
| Height | `64px` (same as topbar) |
| Background | `white` with `shadow-sm` |
| Logo | `Navia` text, navy-900, links to `/portfolio` |
| Nav items | Horizontal links, `body` (14px), gray-600, active: ocean-600 with 2px bottom border |
| Avatar | 32px circle, dropdown with Settings and Log out |

### Layout Component

```
(investor)/layout.tsx
```

```typescript
// New file: frontend/src/components/layout/investor-layout.tsx
// - InvestorTopNav component with horizontal nav
// - Content area: gray-50 background, max-w-[1280px] centered
// - No sidebar, no CompanyProvider (investor doesn't own companies)
// - Wraps children in InvestorProvider (portfolio context)
```

### Investor Nav Items

| Label | Path | Icon |
|-------|------|------|
| Portfolio | `/portfolio` | Briefcase |
| Notifications | `/portfolio/notifications` | Bell |
| Settings | `/portfolio/settings` | Settings |

### Access Level Enforcement

Investor portal pages enforce access levels client-side. Each company in the portfolio has an `accessLevel`:

| Access Level | Visible Tabs |
|-------------|--------------|
| `OVERVIEW` | Overview only |
| `STANDARD` | Overview, Updates, Financials |
| `FULL` | Overview, Updates, Financials, Documents, Q&A |

Tab visibility is determined by the `accessLevel` field on the investor-company relationship. Tabs the investor cannot access are not rendered (not shown as disabled).

---

## New Pages -- Detailed Specifications

### Dashboard Home (MODIFY)

**Path**: `(dashboard)/dashboard/page.tsx`

**Current state**: Basic dashboard with placeholder content.

**New design**:
```
+------------------------------------------------------------------+
|  Welcome back, {firstName}!                                       |
|  {companyName} profile completeness                              |
+------------------------------------------------------------------+
|                                                                    |
|  [==========70%==========]  Completeness Score                    |
|  Missing: Pitch deck, Financial metrics, Team photos              |
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  | Profile Views    |  | Documents        |  | AI Reports       |  |
|  | 142 this week    |  | 8 uploaded       |  | 3 generated      |  |
|  | +12% vs last wk  |  | 2 AI processed   |  | 1 pending        |  |
|  +------------------+  +------------------+  +------------------+  |
|                                                                    |
|  +-------------------------------+  +---------------------------+  |
|  | Recent Activity               |  | Quick Actions             |  |
|  | - Investor viewed profile     |  | [+ Upload Document]       |  |
|  | - AI report generated         |  | [+ Generate Report]       |  |
|  | - New Q&A question            |  | [+ Post Update]           |  |
|  +-------------------------------+  +---------------------------+  |
+------------------------------------------------------------------+
```

**Components**:
- `CompletenessScore` -- progress bar + list of missing items
- `StatCard` (reuse existing pattern) -- 3 cards: Profile Views, Documents, AI Reports
- `RecentActivity` -- chronological list of last 10 events
- `QuickActions` -- button grid linking to key actions

**Data sources**:
- `GET /api/v1/companies/:companyId/profile` -- for completeness score
- `GET /api/v1/companies/:companyId/profile/analytics/summary` -- for view count
- `GET /api/v1/companies/:companyId/dataroom/documents` -- for document count
- `GET /api/v1/companies/:companyId/ai-reports` -- for report count
- `GET /api/v1/companies/:companyId/activity` -- for recent activity (planned)

---

### Company Page Builder (NEW)

**Path**: `(dashboard)/dashboard/company-page/page.tsx`

**Spec reference**: [company-profile.md](./company-profile.md)

**Design**: Tabbed editor with live preview toggle.

```
+------------------------------------------------------------------+
|  Company Page                                      [Preview] [Publish] |
|  Build your investor-ready company profile                         |
+------------------------------------------------------------------+
|  [Info] [Metrics] [Team] [Documents] [Share] [Analytics]          |
+------------------------------------------------------------------+
|                                                                    |
|  Tab content area (varies by tab)                                 |
|                                                                    |
+------------------------------------------------------------------+
```

**Tabs**:

| Tab | Content | Components |
|-----|---------|------------|
| Info | Company name, logo upload, sector dropdown, founding year, rich-text description | `ProfileInfoForm` |
| Metrics | Up to 6 key metric cards (label, value, format, icon) | `MetricsEditor`, `MetricCard` |
| Team | Founding team member cards (name, title, photo, bio, LinkedIn) | `TeamEditor`, `TeamMemberCard` |
| Documents | Linked dataroom documents (read-only, links to Dataroom page) | `LinkedDocumentsList` |
| Share | Unique URL, slug editor, access type (PUBLIC/EMAIL_GATED), copy button | `ShareSettings` |
| Analytics | View count, unique viewers, timeline chart, top documents, recent viewers | `ProfileAnalytics` |

**Preview page** (`company-page/preview/page.tsx`):
- Renders the public profile layout with current draft data
- Banner at top: "This is a preview. [Back to Editor]"
- Uses the same components as the public profile page (`p/[slug]/`)

**Component directory**: `frontend/src/components/company-page/`

---

### Dataroom (NEW)

**Path**: `(dashboard)/dashboard/dataroom/page.tsx`

**Spec reference**: [company-dataroom.md](./company-dataroom.md)

**Design**:
```
+------------------------------------------------------------------+
|  Dataroom                                          [+ Upload Document] |
|  Manage your investor-facing documents                             |
+------------------------------------------------------------------+
|  [All] [Pitch Deck] [Financials] [Legal] [Product] [Team] [Other]|
+------------------------------------------------------------------+
|  Storage: [========= 156 MB / 500 MB =========]                  |
+------------------------------------------------------------------+
|                                                                    |
|  +---+------------------+----------+--------+------+-----------+  |
|  | # | Document         | Category | Size   | AI   | Actions   |  |
|  +---+------------------+----------+--------+------+-----------+  |
|  |   | Pitch Deck Q1.pdf| Pitch    | 4.2 MB | Done | Download  |  |
|  |   | Financials.xlsx  | Financial| 1.1 MB | Proc | Delete    |  |
|  +---+------------------+----------+--------+------+-----------+  |
|                                                                    |
+------------------------------------------------------------------+
```

**Components**:
- `DocumentUploadZone` -- drag-and-drop zone with progress indicator
- `DocumentCard` -- thumbnail (PDF first page), name, category, size, AI status badge
- `CategoryTabs` -- filter tabs: All, Pitch Deck, Financials, Legal, Product, Team, Other
- `StorageUsageBar` -- visual bar showing used vs total (500 MB)
- `AIStatusBadge` -- pill badge: Pending (cream), Processing (blue), Completed (green), Failed (red)

**AI Processing Badge States**:

| Status | Badge Color | Label |
|--------|-------------|-------|
| `NONE` | gray-100 / gray-600 | Not processed |
| `PENDING` | cream-100 / cream-700 | Pending |
| `PROCESSING` | blue-50 / blue-600 | Processing |
| `COMPLETED` | green-100 / green-700 | AI Ready |
| `FAILED` | red-50 / red-700 | Failed |

**Component directory**: `frontend/src/components/dataroom/`

---

### AI Reports (NEW)

**Path**: `(dashboard)/dashboard/ai-reports/page.tsx`

**Backend spec**: `ai-document-intelligence.md` (planned)

**Design**:
```
+------------------------------------------------------------------+
|  AI Reports                                    [+ Generate Report] |
|  AI-powered analysis of your company documents                    |
+------------------------------------------------------------------+
|  AI Budget: 45/100 reports remaining this month                   |
|  [==========45%==========]                                        |
+------------------------------------------------------------------+
|                                                                    |
|  +---------------------+  +---------------------+                 |
|  | Financial Summary   |  | Market Analysis     |                 |
|  | Generated 2h ago    |  | Generated yesterday |                 |
|  | 12 pages | PDF      |  | 8 pages | PDF       |                 |
|  | [View] [Download]   |  | [View] [Download]   |                 |
|  +---------------------+  +---------------------+                 |
|                                                                    |
+------------------------------------------------------------------+
```

**Components**:
- `GenerateReportDialog` -- dialog to select report type, source documents, and trigger generation
- `ReportCard` -- card with report type, generation date, page count, status, actions
- `AIBudgetBar` -- monthly budget usage indicator
- `ReportTypeSelector` -- radio group or cards for report types

**Report Types** (defined by backend, rendered as selection cards):
- Financial Summary
- Market Analysis
- Due Diligence Package
- Investor Memo
- Custom (free-form prompt)

**Component directory**: `frontend/src/components/ai-reports/`

---

### Q&A Conversations -- Founder View (NEW)

**Path**: `(dashboard)/dashboard/qa-conversations/page.tsx`

**Backend spec**: `investor-qa.md` (planned)

**Design**: Split view -- conversation list on the left, chat on the right.

```
+------------------------------------------------------------------+
|  Investor Q&A                                                      |
|  Answer questions from investors about your company               |
+------------------------------------------------------------------+
|  +-------------------+  +--------------------------------------+  |
|  | Conversations     |  | Chat with Fund ABC                  |  |
|  |                   |  |                                      |  |
|  | Fund ABC (2 new)  |  | [Investor]: What's your MRR?       |  |
|  | Angel Maria       |  | [AI Draft]: Based on your data...  |  |
|  | VC Partners       |  | [You]: (edit and send)              |  |
|  |                   |  |                                      |  |
|  |                   |  | +----------------------------------+ |  |
|  |                   |  | | Type your response...    [Send]  | |  |
|  |                   |  | +----------------------------------+ |  |
|  +-------------------+  +--------------------------------------+  |
+------------------------------------------------------------------+
```

**Key UX Feature**: AI-generated draft responses. When an investor asks a question, the system generates a draft answer from the dataroom documents. The founder reviews, edits, and sends.

**Components**:
- `ConversationList` -- sidebar list of conversations with unread badges
- `ChatWindow` -- message history with bubbles
- `MessageBubble` -- investor message (left-aligned, gray bg) vs founder message (right-aligned, ocean bg)
- `AIDraftBubble` -- AI-suggested response (dashed border, sparkle icon, editable)
- `ChatInput` -- text input with send button
- `SourceCitations` -- collapsible list of dataroom documents the AI used

**Component directory**: `frontend/src/components/qa-chat/`

---

### Company Updates (NEW)

**Path**: `(dashboard)/dashboard/updates/page.tsx`

**Design**:
```
+------------------------------------------------------------------+
|  Company Updates                                  [+ Post Update] |
|  Share news and milestones with your investors                    |
+------------------------------------------------------------------+
|                                                                    |
|  +--------------------------------------------------------------+ |
|  | Q4 Revenue Milestone Reached                                  | |
|  | Published 3 days ago | Milestone                              | |
|  | We're excited to announce that we hit R$1M ARR this quarter...| |
|  | Visible to: All investors                                     | |
|  | [Edit] [Delete]                                               | |
|  +--------------------------------------------------------------+ |
|                                                                    |
+------------------------------------------------------------------+
```

**Components**:
- `UpdateEditor` -- rich-text editor (title, body, type selector, visibility selector)
- `UpdateCard` -- card with title, date, type badge, preview text, visibility, actions
- `UpdateTypeSelector` -- type options: General, Milestone, Financial, Product, Team, Fundraising

**Update Types and Badge Colors**:

| Type | Badge Color |
|------|-------------|
| General | gray-100 / gray-600 |
| Milestone | green-100 / green-700 |
| Financial | blue-50 / blue-600 |
| Product | cream-100 / cream-700 |
| Team | navy-50 / navy-700 |
| Fundraising | ocean-50 / ocean-600 |

**Component directory**: `frontend/src/components/updates/`

---

### Bank Connections (NEW)

**Path**: `(dashboard)/dashboard/bank-connections/page.tsx`

**Backend spec**: `open-finance.md` (planned)

**Design**:
```
+------------------------------------------------------------------+
|  Bank Connections                               [+ Connect Bank]  |
|  Connect your bank accounts via Open Finance                      |
+------------------------------------------------------------------+
|                                                                    |
|  Connected Accounts                                               |
|  +---------------------+  +---------------------+                 |
|  | Banco do Brasil     |  | Nubank              |                 |
|  | CC: ****1234        |  | CC: ****5678        |                 |
|  | Last sync: 2h ago   |  | Last sync: 1d ago   |                 |
|  | [Sync] [Disconnect] |  | [Sync] [Disconnect] |                 |
|  +---------------------+  +---------------------+                 |
|                                                                    |
|  Financial Overview (last 12 months)                              |
|  +--------------------------------------------------------------+ |
|  | [Bar chart: monthly revenue vs expenses]                      | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  +--------------------+  +--------------------+                   |
|  | Monthly Revenue    |  | Monthly Burn Rate  |                   |
|  | R$ 125.432,00      |  | R$ 87.654,00       |                   |
|  | +8,3% vs last mo   |  | -2,1% vs last mo   |                   |
|  +--------------------+  +--------------------+                   |
+------------------------------------------------------------------+
```

**Components**:
- `ConnectBankDialog` -- bank selection (list of Open Finance-enabled banks), OAuth redirect flow
- `BankAccountCard` -- connected account card with bank name, masked number, sync status
- `FinancialOverviewChart` -- Recharts bar chart (revenue vs expenses, 12 months)
- `FinancialMetricCard` -- stat card for key metrics (monthly revenue, burn rate, runway, MRR)

**Number formatting**: All financial values use Brazilian format per `i18n.md`: `R$ 125.432,00`

**Component directory**: `frontend/src/components/open-finance/`

---

### Analytics (NEW)

**Path**: `(dashboard)/dashboard/analytics/page.tsx`

**Spec reference**: Analytics section of [company-profile.md](./company-profile.md)

**Design**:
```
+------------------------------------------------------------------+
|  Analytics                                                         |
|  Track who's viewing your company profile                         |
+------------------------------------------------------------------+
|  +------------------+  +------------------+  +------------------+  |
|  | Total Views      |  | Unique Viewers   |  | Avg. Time on Page|  |
|  | 1.247            |  | 342              |  | 4m 32s           |  |
|  | +23% this month  |  | +15% this month  |  | +8% this month   |  |
|  +------------------+  +------------------+  +------------------+  |
|                                                                    |
|  Views Over Time (last 30 days)                                   |
|  +--------------------------------------------------------------+ |
|  | [Line chart: daily views]                                     | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  Top Documents Downloaded                                         |
|  +--------------------------------------------------------------+ |
|  | 1. Pitch Deck Q4.pdf        | 89 downloads                   | |
|  | 2. Financial Model.xlsx     | 45 downloads                   | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  Recent Viewers                                                   |
|  +--------------------------------------------------------------+ |
|  | investor@fund.com | 2 hours ago  | Viewed 3 documents         | |
|  | maria@vc.com      | yesterday    | Viewed overview only       | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Components**:
- `AnalyticsStatCards` -- 3 stat cards (views, unique, avg time)
- `ViewsTimelineChart` -- Recharts line chart (daily views, 30 days)
- `TopDocumentsTable` -- ranked list of most-downloaded documents
- `RecentViewersTable` -- table of recent profile visitors (email, time, activity)

---

### Investor Access Management (NEW)

**Path**: `(dashboard)/dashboard/investors/page.tsx`

**Design**:
```
+------------------------------------------------------------------+
|  Investor Access                              [+ Invite Investor] |
|  Manage who can access your company information                   |
+------------------------------------------------------------------+
|                                                                    |
|  +------+--------------------+--------+----------+-------+------+ |
|  |      | Investor           | Access | Status   | Added | ...  | |
|  +------+--------------------+--------+----------+-------+------+ |
|  |      | Fund ABC           | FULL   | Active   | Jan 5 | Edit | |
|  |      | maria@investor.com | STD    | Pending  | Feb 1 | Edit | |
|  |      | Angel Group XYZ    | VIEW   | Active   | Feb 10| Edit | |
|  +------+--------------------+--------+----------+-------+------+ |
|                                                                    |
+------------------------------------------------------------------+
```

**Access Levels** (granted by founder to each investor):

| Level | Label | Description |
|-------|-------|-------------|
| `OVERVIEW` | Overview | Company profile and basic info only |
| `STANDARD` | Standard | + Updates and financial metrics |
| `FULL` | Full Access | + Dataroom documents and Q&A chat |

**Components**:
- `InviteInvestorDialog` -- email input, access level selector, optional message
- `InvestorTable` -- table with investor name/email, access level badge, status, date, actions
- `AccessLevelSelector` -- radio group or dropdown for OVERVIEW/STANDARD/FULL
- `InvestorDetailDrawer` -- slide-out panel showing investor activity, viewed documents, Q&A history

**Component directory**: `frontend/src/components/investor-portal/`

---

### KYC Verification Pages (NEW -- Critical)

**Path**: `onboarding/kyc/page.tsx`

**Spec reference**: [kyc-verification.md](./kyc-verification.md)

**Status**: Backend is 100% complete. Frontend is 0% implemented.

**Design**: Multi-step wizard integrated into the onboarding flow.

**Updated Onboarding Stepper** (4 steps instead of current 2):

```
  (1)              (2)           (3)               (4)
Personal Info --> KYC --> Company Setup --> Done
```

The `OnboardingStepper` component must be updated from 2 steps to 4 steps (or 3 for investors who skip Company Setup).

**KYC Step Sub-Steps** (within step 2):

```
Step 2a: CPF Verification
+------------------------------------------------------------------+
|  Identity Verification                                            |
|  Step 1 of 3: CPF Verification                                   |
+------------------------------------------------------------------+
|                                                                    |
|  CPF *                                                            |
|  [___.___.___-__]  (masked input: XXX.XXX.XXX-XX)                |
|                                                                    |
|  Full Name *                                                      |
|  [________________________]                                       |
|                                                                    |
|  Date of Birth *                                                  |
|  [__/__/____]  (DD/MM/YYYY, Brazilian format)                    |
|                                                                    |
|  [Verify CPF]                                                     |
+------------------------------------------------------------------+

Step 2b: Document Upload
+------------------------------------------------------------------+
|  Identity Verification                                            |
|  Step 2 of 3: Document Upload                                    |
+------------------------------------------------------------------+
|                                                                    |
|  Document Type *                                                  |
|  ( ) RG   ( ) CNH   ( ) Passport                                |
|                                                                    |
|  Front of Document *                                              |
|  +--------------------+                                           |
|  | [Camera] or [File] |  Drag and drop or click to upload        |
|  | Accepted: JPG, PNG |  Max 10 MB                               |
|  +--------------------+                                           |
|                                                                    |
|  Back of Document * (not required for Passport)                   |
|  +--------------------+                                           |
|  | [Camera] or [File] |                                           |
|  +--------------------+                                           |
|                                                                    |
|  [Continue]                                                       |
+------------------------------------------------------------------+

Step 2c: Selfie / Facial Recognition
+------------------------------------------------------------------+
|  Identity Verification                                            |
|  Step 3 of 3: Selfie Verification                                |
+------------------------------------------------------------------+
|                                                                    |
|  +----------------------------------+                             |
|  |                                  |                             |
|  |    Camera viewfinder             |                             |
|  |    (oval face guide overlay)     |                             |
|  |                                  |                             |
|  +----------------------------------+                             |
|                                                                    |
|  Instructions:                                                    |
|  - Position your face within the oval                             |
|  - Ensure good lighting                                           |
|  - Remove glasses and hats                                        |
|  - Keep a neutral expression                                      |
|                                                                    |
|  [Capture Selfie]                                                 |
+------------------------------------------------------------------+

Step 2d: Status Tracking
+------------------------------------------------------------------+
|  Identity Verification                                            |
|  Verification in progress...                                      |
+------------------------------------------------------------------+
|                                                                    |
|  CPF Verification        [Done]                                   |
|  Document Verification   [Processing...]                          |
|  Facial Recognition      [Pending]                                |
|  AML Screening           [Pending]                                |
|                                                                    |
|  This usually takes 1-3 minutes.                                  |
|  You'll be notified when verification is complete.                |
|                                                                    |
|  [Waiting...] or [Continue] (if approved) or [Retry] (if failed) |
+------------------------------------------------------------------+
```

**Components**:
- `KYCWizard` -- multi-step container managing sub-step state
- `CPFVerificationForm` -- masked CPF input, name, DOB, submit
- `DocumentUpload` -- document type selector, front/back file upload with camera option
- `SelfieCapture` -- camera viewfinder with face guide overlay, capture button
- `KYCStatusTracker` -- progress list showing each verification step status
- `CameraViewfinder` -- reusable camera component with permissions handling

**Technical Notes**:
- Camera access requires `getUserMedia` API with fallback to file upload
- CPF input uses a masked input component (XXX.XXX.XXX-XX format)
- Date input uses Brazilian format (DD/MM/YYYY)
- Image files are uploaded to the backend, which forwards to Verifik
- Status polling: use TanStack Query with `refetchInterval: 3000` while status is `PROCESSING`

**Component directory**: `frontend/src/components/kyc/`

---

### Investor Portal Pages (NEW)

#### Portfolio Page

**Path**: `(investor)/portfolio/page.tsx`

**Design**:
```
+------------------------------------------------------------------+
|  My Portfolio                                                      |
|  Companies you're tracking                                        |
+------------------------------------------------------------------+
|                                                                    |
|  +---------------------+  +---------------------+                 |
|  | Acme Tech           |  | Beta Startups       |                 |
|  | SaaS | Series A     |  | Fintech | Seed      |                 |
|  | Access: Full        |  | Access: Standard    |                 |
|  | Last update: 2d ago |  | Last update: 1w ago |                 |
|  | [View Company]      |  | [View Company]      |                 |
|  +---------------------+  +---------------------+                 |
|                                                                    |
+------------------------------------------------------------------+
```

**Components**:
- `PortfolioGrid` -- responsive grid of company cards
- `PortfolioCompanyCard` -- company logo, name, sector, stage, access level badge, last update

#### Company Detail Page

**Path**: `(investor)/portfolio/[profileId]/page.tsx`

**Design**: Tab-based layout showing company information based on access level.

```
+------------------------------------------------------------------+
|  < Back to Portfolio                                               |
|  Acme Tech                              Access: Full              |
|  SaaS | Series A | Founded 2022                                  |
+------------------------------------------------------------------+
|  [Overview] [Updates] [Financials] [Documents] [Q&A]              |
+------------------------------------------------------------------+
|                                                                    |
|  Tab content (varies by tab and access level)                     |
|                                                                    |
+------------------------------------------------------------------+
```

**Tab Content**:

| Tab | Access Level | Content |
|-----|-------------|---------|
| Overview | OVERVIEW+ | Company description, metrics, team |
| Updates | STANDARD+ | Chronological feed of company updates |
| Financials | STANDARD+ | Financial metrics, charts (from Open Finance if connected) |
| Documents | FULL | Dataroom document list with download links |
| Q&A | FULL | Chat interface for asking questions |

#### Q&A Chat (Investor Side)

**Path**: `(investor)/portfolio/[profileId]/qa/page.tsx`

**Design**: Chat interface where the investor asks questions and receives founder responses.

```
+------------------------------------------------------------------+
|  Q&A with Acme Tech                                               |
+------------------------------------------------------------------+
|                                                                    |
|  [Founder]: Welcome! Feel free to ask any questions.              |
|                                                                    |
|  [You]: What's your current MRR?                                  |
|                                                                    |
|  [Founder]: Our MRR is R$ 125.000,00 as of January 2026.        |
|  Source: Financial Report Q4 2025                                 |
|                                                                    |
|  +--------------------------------------------------------------+ |
|  | Type your question...                              [Send]     | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

**Components** (shared with founder Q&A): Reuse `ChatWindow`, `MessageBubble`, `ChatInput` from `components/qa-chat/`.

**Component directory**: `frontend/src/components/investor-portal/`

---

### Public Company Profile (NEW)

**Path**: `p/[slug]/page.tsx`

**Spec reference**: [company-profile.md](./company-profile.md) -- public profile rendering

**Design**: Clean, marketing-style single-page layout.

```
+------------------------------------------------------------------+
|  [Company Logo]                                    Powered by Navia|
+------------------------------------------------------------------+
|                                                                    |
|  Acme Tech                                                        |
|  SaaS | Founded 2022 | Sao Paulo, Brazil                        |
|                                                                    |
|  We're building the future of...                                  |
|  (rich-text description)                                          |
|                                                                    |
+------------------------------------------------------------------+
|  Key Metrics                                                      |
|  +----------+  +----------+  +----------+  +----------+           |
|  | ARR      |  | MRR      |  | Employees|  | Customers|           |
|  | R$ 1,2M  |  | R$ 125K  |  | 42       |  | 350      |           |
|  +----------+  +----------+  +----------+  +----------+           |
+------------------------------------------------------------------+
|  Our Team                                                         |
|  +--------+  +--------+  +--------+                               |
|  | Photo  |  | Photo  |  | Photo  |                               |
|  | CEO    |  | CTO    |  | CFO    |                               |
|  +--------+  +--------+  +--------+                               |
+------------------------------------------------------------------+
|  Documents                                                        |
|  +--------------------+  +--------------------+                   |
|  | Pitch Deck Q4.pdf  |  | Financial Model    |                   |
|  | [Download]         |  | [Download]         |                   |
|  +--------------------+  +--------------------+                   |
+------------------------------------------------------------------+
|  Litigation Check: No active litigation found  [Verified]         |
+------------------------------------------------------------------+
```

**Access Gating**:
- `PUBLIC`: No gate, renders immediately
- `EMAIL_GATED`: Shows email capture form before rendering content
- `PASSWORD` (post-MVP): Shows password form

**Email Gate Component**:
```
+------------------------------------------------------------------+
|  Acme Tech                                                        |
|                                                                    |
|  This company profile requires your email to view.               |
|                                                                    |
|  Email *                                                          |
|  [________________________]                                       |
|                                                                    |
|  [View Profile]                                                   |
|                                                                    |
|  Your email will be shared with the company.                      |
+------------------------------------------------------------------+
```

---

### Onboarding Flow (MODIFY)

**Path**: `onboarding/page.tsx`

**Current state**: 2 steps (Personal Info, Company Creation).

**New flow**: 4 steps with role branching.

```
Step 1: Personal Info (existing, keep)
  - First name, last name
  - NEW: Role selection: "I'm a Founder" / "I'm an Investor"

Step 2: KYC Verification (NEW, for founders)
  - Multi-step KYC wizard (CPF, document, selfie, status)
  - Investors skip this step in MVP (KYC required later for specific actions)

Step 3: Company Setup (founders only) / Portfolio Setup (investors only)
  - Founders: Company creation form (existing CompanyCreationStep)
  - Investors: Skip or "Join companies you're tracking" (simple list or skip)

Step 4: Done
  - Founders: Redirect to /dashboard
  - Investors: Redirect to /portfolio
```

**Stepper update**: Change `OnboardingStepper` from 2-step to dynamic steps based on role:
- Founder: Personal Info --> KYC --> Company Setup --> Done (4 steps)
- Investor: Personal Info --> Portfolio Setup --> Done (3 steps, KYC skipped)

**Role Selection Component** (added to Personal Info step):

```
+------------------------------------------------------------------+
|  How will you use Navia?                                          |
|                                                                    |
|  +---------------------------+  +---------------------------+     |
|  | [Building icon]           |  | [Briefcase icon]          |     |
|  | I'm a Founder             |  | I'm an Investor           |     |
|  | Build your company page   |  | Track your portfolio      |     |
|  | and manage investors      |  | and access datarooms      |     |
|  +---------------------------+  +---------------------------+     |
+------------------------------------------------------------------+
```

---

## New TanStack Query Hooks

Create in `frontend/src/hooks/`:

### `use-company-profile.ts`

```typescript
// Queries
useCompanyProfile(companyId: string)           // GET /api/v1/companies/:companyId/profile
useCompanyProfileAnalytics(companyId: string)  // GET /api/v1/companies/:companyId/profile/analytics

// Mutations
useCreateCompanyProfile()     // POST /api/v1/companies/:companyId/profile
useUpdateCompanyProfile()     // PUT /api/v1/companies/:companyId/profile
usePublishCompanyProfile()    // POST /api/v1/companies/:companyId/profile/publish
useGenerateProfileSummary()   // POST /api/v1/companies/:companyId/profile/generate-summary

// Team members
useAddTeamMember()            // POST /api/v1/companies/:companyId/profile/team
useUpdateTeamMember()         // PUT /api/v1/companies/:companyId/profile/team/:memberId
useRemoveTeamMember()         // DELETE /api/v1/companies/:companyId/profile/team/:memberId
useReorderTeamMembers()       // PUT /api/v1/companies/:companyId/profile/team/reorder

// Metrics
useUpdateProfileMetrics()     // PUT /api/v1/companies/:companyId/profile/metrics
```

### `use-dataroom.ts`

```typescript
// Queries
useDataroomDocuments(companyId: string, category?: string)  // GET /api/v1/companies/:companyId/dataroom/documents
useDataroomStorage(companyId: string)                       // GET /api/v1/companies/:companyId/dataroom/storage

// Mutations
useUploadDocument()       // POST /api/v1/companies/:companyId/dataroom/documents (multipart)
useDeleteDocument()       // DELETE /api/v1/companies/:companyId/dataroom/documents/:docId
useTriggerAIProcessing()  // POST /api/v1/companies/:companyId/dataroom/documents/:docId/process
```

### `use-ai-reports.ts`

```typescript
// Queries
useAIReports(companyId: string)          // GET /api/v1/companies/:companyId/ai-reports
useAIReport(companyId: string, id: string) // GET /api/v1/companies/:companyId/ai-reports/:id
useAIBudget(companyId: string)           // GET /api/v1/companies/:companyId/ai-reports/budget

// Mutations
useGenerateAIReport()    // POST /api/v1/companies/:companyId/ai-reports
useDeleteAIReport()      // DELETE /api/v1/companies/:companyId/ai-reports/:id
```

### `use-qa.ts`

```typescript
// Queries
useQAConversations(companyId: string)                          // GET /api/v1/companies/:companyId/qa/conversations
useQAMessages(companyId: string, conversationId: string)       // GET /api/v1/companies/:companyId/qa/conversations/:id/messages

// Mutations
useSendQAMessage()       // POST /api/v1/companies/:companyId/qa/conversations/:id/messages
useCreateConversation()  // POST /api/v1/companies/:companyId/qa/conversations

// SSE streaming (for AI draft responses)
useQAStream(companyId: string, conversationId: string)  // SSE /api/v1/companies/:companyId/qa/conversations/:id/stream
```

### `use-company-updates.ts`

```typescript
// Queries
useCompanyUpdates(companyId: string, params?: { type?: string; page?: number })
  // GET /api/v1/companies/:companyId/updates

// Mutations
useCreateUpdate()   // POST /api/v1/companies/:companyId/updates
useUpdateUpdate()   // PUT /api/v1/companies/:companyId/updates/:id
useDeleteUpdate()   // DELETE /api/v1/companies/:companyId/updates/:id
```

### `use-open-finance.ts`

```typescript
// Queries
useOpenFinanceConnections(companyId: string)   // GET /api/v1/companies/:companyId/open-finance/connections
useFinancialSnapshots(companyId: string)       // GET /api/v1/companies/:companyId/open-finance/snapshots
useFinancialTransactions(companyId: string, params?: { accountId?: string; from?: string; to?: string })
  // GET /api/v1/companies/:companyId/open-finance/transactions

// Mutations
useConnectBank()       // POST /api/v1/companies/:companyId/open-finance/connect
useDisconnectBank()    // DELETE /api/v1/companies/:companyId/open-finance/connections/:connectionId
useSyncConnection()    // POST /api/v1/companies/:companyId/open-finance/connections/:connectionId/sync
```

### `use-investor-access.ts`

```typescript
// Queries
useInvestorAccessList(companyId: string)  // GET /api/v1/companies/:companyId/investor-access

// Mutations
useGrantInvestorAccess()   // POST /api/v1/companies/:companyId/investor-access
useUpdateInvestorAccess()  // PUT /api/v1/companies/:companyId/investor-access/:id
useRevokeInvestorAccess()  // DELETE /api/v1/companies/:companyId/investor-access/:id
```

### `use-investor-portfolio.ts`

```typescript
// Queries (investor-side, no companyId -- scoped to authenticated investor)
usePortfolio()                           // GET /api/v1/investor/portfolio
usePortfolioCompany(profileId: string)   // GET /api/v1/investor/portfolio/:profileId
usePortfolioUpdates(profileId: string)   // GET /api/v1/investor/portfolio/:profileId/updates
usePortfolioFinancials(profileId: string) // GET /api/v1/investor/portfolio/:profileId/financials
usePortfolioDocuments(profileId: string) // GET /api/v1/investor/portfolio/:profileId/documents
```

### `use-kyc.ts`

```typescript
// Queries
useKYCStatus()     // GET /api/v1/kyc/status

// Mutations
useVerifyCPF()            // POST /api/v1/kyc/verify-cpf
useUploadKYCDocument()    // POST /api/v1/kyc/upload-document (multipart)
useSubmitSelfie()         // POST /api/v1/kyc/submit-selfie (multipart)
useRetryKYC()             // POST /api/v1/kyc/retry
```

---

## New Component Directories

```
frontend/src/components/
├── company-page/          # Profile editor components
│   ├── ProfileInfoForm.tsx
│   ├── MetricsEditor.tsx
│   ├── MetricCard.tsx
│   ├── TeamEditor.tsx
│   ├── TeamMemberCard.tsx
│   ├── LinkedDocumentsList.tsx
│   ├── ShareSettings.tsx
│   ├── ProfileAnalytics.tsx
│   └── __tests__/
│
├── dataroom/              # Document management components
│   ├── DocumentUploadZone.tsx
│   ├── DocumentCard.tsx
│   ├── CategoryTabs.tsx
│   ├── StorageUsageBar.tsx
│   ├── AIStatusBadge.tsx
│   └── __tests__/
│
├── ai-reports/            # AI report components
│   ├── GenerateReportDialog.tsx
│   ├── ReportCard.tsx
│   ├── AIBudgetBar.tsx
│   ├── ReportTypeSelector.tsx
│   └── __tests__/
│
├── qa-chat/               # Chat interface (shared between founder and investor)
│   ├── ConversationList.tsx
│   ├── ChatWindow.tsx
│   ├── MessageBubble.tsx
│   ├── AIDraftBubble.tsx
│   ├── ChatInput.tsx
│   ├── SourceCitations.tsx
│   └── __tests__/
│
├── investor-portal/       # Investor experience components
│   ├── PortfolioGrid.tsx
│   ├── PortfolioCompanyCard.tsx
│   ├── InvestorTopNav.tsx
│   ├── InvestorLayout.tsx
│   ├── CompanyDetailTabs.tsx
│   ├── InviteInvestorDialog.tsx
│   ├── InvestorTable.tsx
│   ├── AccessLevelSelector.tsx
│   ├── InvestorDetailDrawer.tsx
│   └── __tests__/
│
├── open-finance/          # Bank connection components
│   ├── ConnectBankDialog.tsx
│   ├── BankAccountCard.tsx
│   ├── FinancialOverviewChart.tsx
│   ├── FinancialMetricCard.tsx
│   └── __tests__/
│
├── kyc/                   # KYC verification components
│   ├── KYCWizard.tsx
│   ├── CPFVerificationForm.tsx
│   ├── DocumentUpload.tsx
│   ├── SelfieCapture.tsx
│   ├── CameraViewfinder.tsx
│   ├── KYCStatusTracker.tsx
│   └── __tests__/
│
└── updates/               # Company updates components
    ├── UpdateEditor.tsx
    ├── UpdateCard.tsx
    ├── UpdateTypeSelector.tsx
    └── __tests__/
```

---

## Type Definitions

### `frontend/src/types/ai.ts`

```typescript
export type AIReportType =
  | 'FINANCIAL_SUMMARY'
  | 'MARKET_ANALYSIS'
  | 'DUE_DILIGENCE'
  | 'INVESTOR_MEMO'
  | 'CUSTOM';

export type AIReportStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AIReport {
  id: string;
  companyId: string;
  type: AIReportType;
  title: string;
  status: AIReportStatus;
  pageCount: number | null;
  sourceDocumentIds: string[];
  downloadUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AIBudget {
  used: number;
  total: number;
  resetDate: string;
}

export type AIProcessingStatus = 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  pageNumber: number | null;
  chunkIndex: number;
}
```

### `frontend/src/types/open-finance.ts`

```typescript
export type ConnectionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR';

export interface OpenFinanceConnection {
  id: string;
  companyId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;  // masked: ****1234
  accountType: 'CHECKING' | 'SAVINGS';
  status: ConnectionStatus;
  lastSyncAt: string | null;
  consentExpiresAt: string;
  createdAt: string;
}

export interface BankTransaction {
  id: string;
  connectionId: string;
  date: string;
  description: string;
  amount: string;        // Decimal as string
  type: 'CREDIT' | 'DEBIT';
  category: string | null;
  balance: string;
}

export interface FinancialSnapshot {
  id: string;
  companyId: string;
  month: string;         // YYYY-MM
  revenue: string;
  expenses: string;
  netIncome: string;
  cashBalance: string;
  createdAt: string;
}

export interface FinancialMetrics {
  monthlyRevenue: string;
  monthlyExpenses: string;
  burnRate: string;
  runway: string;        // months
  mrr: string;
  arr: string;
}
```

### `frontend/src/types/investor.ts`

```typescript
export type InvestorAccessLevel = 'OVERVIEW' | 'STANDARD' | 'FULL';
export type InvestorAccessStatus = 'PENDING' | 'ACTIVE' | 'REVOKED';

export interface InvestorAccess {
  id: string;
  companyId: string;
  investorEmail: string;
  investorName: string | null;
  investorUserId: string | null;
  accessLevel: InvestorAccessLevel;
  status: InvestorAccessStatus;
  grantedBy: string;
  grantedAt: string;
  revokedAt: string | null;
  lastViewedAt: string | null;
}

export type CompanyUpdateType =
  | 'GENERAL'
  | 'MILESTONE'
  | 'FINANCIAL'
  | 'PRODUCT'
  | 'TEAM'
  | 'FUNDRAISING';

export type CompanyUpdateVisibility = 'ALL_INVESTORS' | 'FULL_ACCESS_ONLY';

export interface CompanyUpdate {
  id: string;
  companyId: string;
  title: string;
  body: string;
  type: CompanyUpdateType;
  visibility: CompanyUpdateVisibility;
  authorId: string;
  authorName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioCompany {
  profileId: string;
  companyName: string;
  companyLogo: string | null;
  sector: string | null;
  stage: string | null;
  accessLevel: InvestorAccessLevel;
  lastUpdateAt: string | null;
  unreadUpdates: number;
}
```

### `frontend/src/types/qa.ts`

```typescript
export type QARole = 'INVESTOR' | 'FOUNDER' | 'AI_DRAFT';

export interface QAConversation {
  id: string;
  companyId: string;
  investorId: string;
  investorName: string;
  investorEmail: string;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface QAMessage {
  id: string;
  conversationId: string;
  role: QARole;
  content: string;
  sources: QASource[] | null;
  createdAt: string;
  editedAt: string | null;
}

export interface QASource {
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  snippet: string;
}
```

---

## i18n Updates

### New Namespaces

Add the following top-level namespaces to both `messages/pt-BR.json` and `messages/en.json`:

| Namespace | Purpose | Example Keys |
|-----------|---------|-------------|
| `sidebar` | Sidebar navigation labels | `sidebar.menu.dashboard`, `sidebar.menu.companyPage` |
| `companyPage` | Company page builder | `companyPage.title`, `companyPage.tabs.info`, `companyPage.publish` |
| `dataroom` | Dataroom management | `dataroom.title`, `dataroom.upload`, `dataroom.aiStatus.completed` |
| `ai` | AI reports and processing | `ai.title`, `ai.generate`, `ai.budget.remaining`, `ai.reportType.financial` |
| `qa` | Q&A conversations | `qa.title`, `qa.newQuestion`, `qa.aiDraft`, `qa.sources` |
| `updates` | Company updates | `updates.title`, `updates.create`, `updates.type.milestone` |
| `openFinance` | Bank connections | `openFinance.title`, `openFinance.connect`, `openFinance.syncStatus` |
| `investor` | Investor portal | `investor.portfolio`, `investor.accessLevel.full`, `investor.invite` |
| `kyc` | KYC verification | `kyc.title`, `kyc.cpf.label`, `kyc.document.front`, `kyc.selfie.instructions` |
| `analytics` | Profile analytics | `analytics.title`, `analytics.views`, `analytics.topDocuments` |
| `publicProfile` | Public profile page | `publicProfile.emailGate.title`, `publicProfile.poweredBy` |

### Existing Namespaces to Update

| Namespace | Changes |
|-----------|---------|
| `dashboard` | Add completeness score keys, quick action keys, recent activity keys |
| `onboarding` | Add role selection keys (`onboarding.role.founder`, `onboarding.role.investor`), update stepper to 4 steps |
| `errors` | Add new error keys for AI, Q&A, Open Finance, KYC frontend errors |
| `common` | Add shared action keys (`common.download`, `common.upload`, `common.process`, `common.generate`) |

### Namespaces Already Removed (from cleanup)

The following namespaces were part of the cap-table era and have already been removed:
`capTable`, `shareholders`, `shareClasses`, `transactions`, `fundingRounds`, `convertibles`, `optionPlans`, `documents`, `auditLogs`

---

## Design System

No changes to existing design tokens. All new components follow the patterns defined in `design-system.md`.

### Key References

| Element | Token | Value |
|---------|-------|-------|
| Primary color | ocean-600 | `#1B6B93` |
| Headings | navy-900 | `#0A2342` |
| Card background | white | `#FFFFFF` |
| Card border | gray-200 | `#E5E7EB` |
| Card radius | radius-lg | `12px` |
| Badge style | radius-full | Pill with semantic colors |
| Table header bg | gray-50 | `#F9FAFB` |
| Table row height | -- | `52px` |
| Page background | gray-50 | `#F9FAFB` |
| Stat card radius | radius-xl | `16px` |
| Sidebar bg | navy-900 | `#0A2342` |
| Sidebar active | navy-800 + ocean-600 accent bar | -- |
| Charts | Recharts with chart color palette | See design-system.md section 8 |

### New Component Patterns

New components introduced in this restructure follow these patterns:

**Chat bubbles** (Q&A):
- Investor message: left-aligned, gray-100 bg, radius-lg, body text
- Founder message: right-aligned, ocean-600 bg, white text, radius-lg
- AI draft: left-aligned, dashed border ocean-400, ocean-50 bg, sparkle icon

**Upload zones** (Dataroom, KYC):
- Dashed border: 2px dashed gray-300
- Hover: 2px dashed ocean-600, ocean-50 bg
- Active (dragging): 2px solid ocean-600, ocean-100 bg
- Icon: Upload (lucide), 48px, gray-400

**Status badges** (AI processing, KYC status):
- Follow existing badge pattern from design-system.md section 6.5
- New states map to existing semantic colors

**Progress bars** (completeness, AI budget, storage):
- Track: gray-200, 8px height, radius-full
- Fill: ocean-600 (default), celadon-600 (success), cream-700 (warning)
- Label: body-sm, gray-600, right-aligned percentage

---

## Pages to Keep/Modify/Create Summary

### Keep (Minimal Changes)

| Page | Path | Changes |
|------|------|---------|
| Login | `(auth)/login/page.tsx` | None |
| Invitations | `(auth)/invitations/[token]/page.tsx` | None |
| Notifications | `(dashboard)/dashboard/notifications/page.tsx` | None |
| Settings | `(dashboard)/dashboard/settings/page.tsx` | None |

### Modify

| Page | Path | Changes |
|------|------|---------|
| Dashboard | `(dashboard)/dashboard/page.tsx` | Add completeness score, new stat cards, recent activity, quick actions |
| Onboarding | `onboarding/page.tsx` | Add role selection (founder/investor), KYC step, 4-step stepper |
| Reports | `(dashboard)/dashboard/reports/page.tsx` | Repurpose as redirect to AI Reports or remove |
| Sidebar | `components/layout/sidebar.tsx` | New nav items (9 menu + 3 general) |
| Mobile Sidebar | `components/layout/mobile-sidebar.tsx` | Match desktop sidebar nav items |
| Onboarding Stepper | `components/onboarding/onboarding-stepper.tsx` | Dynamic steps based on role (4 for founder, 3 for investor) |

### Create (New)

| Page | Path | Priority |
|------|------|----------|
| Company Page Builder | `(dashboard)/dashboard/company-page/page.tsx` | High |
| Company Page Preview | `(dashboard)/dashboard/company-page/preview/page.tsx` | High |
| Dataroom | `(dashboard)/dashboard/dataroom/page.tsx` | High |
| AI Reports | `(dashboard)/dashboard/ai-reports/page.tsx` | Medium |
| Q&A Conversations | `(dashboard)/dashboard/qa-conversations/page.tsx` | Medium |
| Updates | `(dashboard)/dashboard/updates/page.tsx` | Medium |
| Bank Connections | `(dashboard)/dashboard/bank-connections/page.tsx` | Medium |
| Analytics | `(dashboard)/dashboard/analytics/page.tsx` | Medium |
| Investor Management | `(dashboard)/dashboard/investors/page.tsx` | High |
| KYC Verification | `onboarding/kyc/page.tsx` | **Critical** |
| Public Profile | `p/[slug]/page.tsx` | High |
| Investor Layout | `(investor)/layout.tsx` | High |
| Portfolio | `(investor)/portfolio/page.tsx` | High |
| Company Overview | `(investor)/portfolio/[profileId]/page.tsx` | High |
| Company Updates | `(investor)/portfolio/[profileId]/updates/page.tsx` | Medium |
| Company Financials | `(investor)/portfolio/[profileId]/financials/page.tsx` | Medium |
| Company Documents | `(investor)/portfolio/[profileId]/documents/page.tsx` | Medium |
| Company Q&A | `(investor)/portfolio/[profileId]/qa/page.tsx` | Medium |

---

## Implementation Order

Recommended build order based on dependencies and priority:

### Phase 1: Foundation (No backend dependency)
1. Update sidebar navigation (nav items, i18n keys, shared nav config)
2. Update onboarding flow (role selection, 4-step stepper)
3. Create investor layout (`InvestorLayout`, `InvestorTopNav`)
4. Add all new type definitions (`ai.ts`, `open-finance.ts`, `investor.ts`, `qa.ts`)
5. Add all new i18n namespaces (empty structure with keys)

### Phase 2: KYC Frontend (Backend exists)
6. Build KYC components (`KYCWizard`, `CPFVerificationForm`, `DocumentUpload`, `SelfieCapture`, `KYCStatusTracker`)
7. Create `use-kyc.ts` hook
8. Integrate KYC into onboarding flow
9. Test full KYC flow end-to-end

### Phase 3: Company Page + Dataroom (Backend exists)
10. Build Company Page builder components
11. Build Dataroom components
12. Create `use-company-profile.ts` and `use-dataroom.ts` hooks
13. Build public profile page (`p/[slug]/`)
14. Build Company Page preview page

### Phase 4: Investor Portal (Backend needed)
15. Build portfolio page and company detail pages
16. Build investor access management page
17. Create `use-investor-portfolio.ts` and `use-investor-access.ts` hooks

### Phase 5: AI + Q&A + Finance (Backend needed)
18. Build AI Reports page
19. Build Q&A conversation pages (founder + investor)
20. Build Bank Connections page
21. Build Analytics page
22. Build Updates page
23. Create remaining hooks

### Phase 6: Dashboard + Polish
24. Rebuild dashboard home with completeness score, activity, quick actions
25. Cross-experience testing (founder flow, investor flow, public profile)
26. Responsive testing across all breakpoints
27. Accessibility audit

---

## Success Criteria

- [ ] Founder can navigate all 9 sidebar menu items + 3 general items
- [ ] Investor portal renders portfolio, company detail, and all tabs based on access level
- [ ] KYC verification flow completes all 4 sub-steps (CPF, document, selfie, status)
- [ ] Onboarding correctly routes founders (4-step) vs investors (3-step) with role selection
- [ ] Public profile page renders with email gating when configured
- [ ] All new pages have i18n support (PT-BR + EN) with no hardcoded strings
- [ ] All new type definitions are in place with full TypeScript coverage
- [ ] All new hooks follow TanStack Query patterns with proper error handling
- [ ] Design system consistency maintained (colors, typography, spacing, shadows match tokens)
- [ ] All new components have corresponding `__tests__/` directories with test files
- [ ] Sidebar nav items are extracted to shared config (desktop + mobile in sync)
- [ ] Both experiences (founder + investor) work at all responsive breakpoints (sm, md, lg, xl)
- [ ] Chat interface (Q&A) supports SSE streaming for AI draft responses
- [ ] Financial values use Brazilian format (`R$ 1.234,56`) throughout
- [ ] Camera/file upload for KYC gracefully degrades when camera unavailable
- [ ] Error states show user-facing feedback (toasts, inline errors) per error-handling.md

---

## Related Specifications

- **[company-profile.md](./company-profile.md)** -- Company page data model, API, business rules
- **[company-dataroom.md](./company-dataroom.md)** -- Document upload, storage, AI processing API
- **[kyc-verification.md](./kyc-verification.md)** -- KYC backend flow, Verifik integration
- **[authentication.md](./authentication.md)** -- Privy auth, session management
- **[company-membership.md](./company-membership.md)** -- Roles and permissions
- **[notifications.md](./notifications.md)** -- Notification system
- **[user-permissions.md](./user-permissions.md)** -- RBAC matrix
- **[reports-analytics.md](./reports-analytics.md)** -- Reports (being repurposed for AI reports)
- **Design system**: `.claude/rules/design-system.md`
- **i18n rules**: `.claude/rules/i18n.md`
- **Error handling**: `.claude/rules/error-handling.md`
- **Testing**: `.claude/rules/testing-frontend.md`
- **API standards**: `.claude/rules/api-standards.md`
