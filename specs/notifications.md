# Notifications Specification

**Topic of Concern**: In-app notification system for key events (MVP); email delivery deferred to post-MVP

**One-Sentence Description**: The system creates in-app notifications for important events like signature requests, transaction confirmations, and vesting milestones, displayed via a bell icon dropdown and a dedicated notifications page.

---

## Overview

Navia uses an in-app notification system to alert users of important events. Notifications are triggered automatically by system events and persisted via background jobs (Bull queue) to avoid blocking API requests. Users access notifications through a bell icon in the top bar (showing the last 5 unread) and a full `/notifications` page with filtering and pagination. Notifications refresh on page navigation (no real-time push for MVP).

**MVP Delivery**: In-app notifications only. Email delivery via AWS SES (templates, SES integration, bounce handling) is planned for post-MVP. The backend data model and API are designed to support email delivery when added later.

---

## Notification Events

### Document Events
- Document signature request sent
- Document fully signed
- Document declined by signer

### Transaction Events
- Share issuance completed
- Share transfer completed
- Transaction failed (alert admin)

### Cap Table Events
- Major dilution event (> 10% for any shareholder)
- New shareholder added
- Shareholder removed

### Option Events
- Option grant created
- Vesting milestone reached (cliff, 25%, 50%, 75%, 100%)
- Option exercise request submitted
- Option exercise completed (shares issued)
- Options expiring soon (30-day warning)

### KYC Events
- KYC verification completed
- KYC verification rejected (with reason)
- KYC resubmission required

### Funding Round Events
- Invited to participate in funding round
- Round closing soon
- Round closed

---

## Functional Requirements

### FR-1: Notification Triggers
- System events automatically trigger notifications
- No manual email sending required
- Events logged in database for audit

### FR-2: Email Templates
- HTML email templates stored in codebase
- Templates stored per locale: `templates/email/{templateName}/pt-BR.mjml` and `templates/email/{templateName}/en.mjml`
- Template language selected based on `User.locale` (defaults to `pt-BR`)
- Support for template variables (user name, company name, etc.)
- Responsive design for mobile devices
- Include Navia branding

### FR-3: User Preferences
- Users can configure notification preferences
- Categories: transactions, documents, options, security
- Cannot disable critical security notifications

### FR-4: Background Processing
- Emails sent via Bull queue (async)
- Retry failed sends up to 3 times
- Log delivery status

---

## Data Models

```typescript
interface Notification {
  id: string;
  user_id: string;
  notification_type: string;         // "SIGNATURE_REQUEST", "TRANSACTION_CONFIRMED", etc.

  // Content
  subject: string;
  body_html: string;
  body_text: string;                 // Plain text fallback

  // Delivery
  status: 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED';
  sent_at: Date | null;
  failed_reason: string | null;

  // Read Status
  read: boolean;
  read_at: Date | null;

  // Metadata
  related_entity_type: string | null;  // "Document", "Transaction", etc.
  related_entity_id: string | null;

  created_at: Date;
}

interface UserNotificationPreferences {
  user_id: string;
  email_notifications: boolean;     // MVP: ignored (no email delivery). Retained for post-MVP.
  categories: {
    transactions: boolean;
    documents: boolean;
    options: boolean;
    funding_rounds: boolean;
    security: boolean;              // Always true (cannot disable)
  };
  updated_at: Date;
}
```

---

## API Endpoints

### GET /api/v1/users/me/notifications

List the authenticated user's notifications with pagination.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `read` | boolean | — | Filter by read status |
| `notificationType` | string | — | Filter by type (e.g., `SIGNATURE_REQUEST`) |
| `sort` | string | `-createdAt` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "notificationType": "SIGNATURE_REQUEST",
      "subject": "[Navia] Contrato de Acionistas requer sua assinatura",
      "status": "SENT",
      "read": false,
      "relatedEntityType": "Document",
      "relatedEntityId": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
      "createdAt": "2026-02-23T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### GET /api/v1/users/me/notifications/:id

Get a single notification detail.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "notificationType": "SIGNATURE_REQUEST",
    "subject": "[Navia] Contrato de Acionistas requer sua assinatura",
    "bodyText": "Acme Ltda. solicitou sua assinatura no documento: Contrato de Acionistas...",
    "status": "SENT",
    "sentAt": "2026-02-23T10:00:05.000Z",
    "read": false,
    "readAt": null,
    "relatedEntityType": "Document",
    "relatedEntityId": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "createdAt": "2026-02-23T10:00:00.000Z"
  }
}
```

### PUT /api/v1/users/me/notifications/:id/read

Mark a notification as read.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "read": true,
    "readAt": "2026-02-23T12:30:00.000Z"
  }
}
```

### GET /api/v1/users/me/notifications/preferences

Get the authenticated user's notification preferences.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "emailNotifications": true,
    "categories": {
      "transactions": true,
      "documents": true,
      "options": true,
      "security": true
    },
    "updatedAt": "2026-01-15T08:00:00.000Z"
  }
}
```

### PUT /api/v1/users/me/notifications/preferences

Update notification preferences.

**Request**:
```json
{
  "emailNotifications": true,
  "categories": {
    "transactions": true,
    "documents": false,
    "options": true
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "emailNotifications": true,
    "categories": {
      "transactions": true,
      "documents": false,
      "options": true,
      "security": true
    },
    "updatedAt": "2026-02-23T14:00:00.000Z"
  }
}
```

**Note**: The `security` category is always `true` and cannot be set to `false`. If the client sends `"security": false`, the server ignores it and keeps `security: true`.

---

## Email Templates

### i18n Template Structure

Email templates are stored per locale following the project i18n conventions:

```
templates/
  email/
    signature-request/
      pt-BR.mjml
      en.mjml
    transaction-confirmed/
      pt-BR.mjml
      en.mjml
    vesting-milestone/
      pt-BR.mjml
      en.mjml
    ...
```

The system selects the template language based on `User.locale`. If the user's locale is not set or the template is missing for that locale, the system falls back to `pt-BR`.

### Template: Signature Request
```
Subject (PT-BR): [Navia] Contrato de Acionistas requer sua assinatura
Subject (EN): [Navia] Shareholder Agreement requires your signature

Hi {{user_name}},

{{company_name}} has requested your signature on:
  Document: {{document_title}}
  Your role: {{signer_role}}

Click here to review and sign: {{signature_url}}

This request expires in 30 days.
```

### Template: Transaction Confirmed
```
Subject (PT-BR): [Navia] Transação confirmada na blockchain
Subject (EN): [Navia] Transaction confirmed on blockchain

Hi {{user_name}},

Your transaction has been confirmed on Base Network:
  Type: {{transaction_type}}
  Shares: {{quantity}}
  Share Class: {{share_class}}

View on Basescan: {{blockchain_url}}
```

### Template: Vesting Milestone
```
Subject (PT-BR): [Navia] Marco de vesting alcançado
Subject (EN): [Navia] Vesting milestone reached

Hi {{user_name}},

A vesting milestone has been reached for your option grant at {{company_name}}:
  Options vested: {{vested_quantity}}
  Total vested: {{total_vested}} of {{total_granted}}
  Vesting percentage: {{vesting_percentage}}%

View your options: {{options_url}}
```

---

## Error Codes

| Code | HTTP Status | Description | messageKey |
|------|-------------|-------------|------------|
| `NOTIFICATION_NOT_FOUND` | 404 | Notification does not exist or does not belong to the user | `errors.notification.notFound` |
| `NOTIFICATION_PREFERENCES_INVALID` | 422 | Cannot disable security notifications | `errors.notification.preferencesInvalid` |
| `VAL_INVALID_INPUT` | 400 | One or more request fields failed validation | `errors.val.invalidInput` |

**Error Response Example**:
```json
{
  "success": false,
  "error": {
    "code": "NOTIFICATION_NOT_FOUND",
    "message": "Notificação não encontrada",
    "messageKey": "errors.notification.notFound"
  }
}
```

---

## Business Rules

### BR-1: Critical Notifications
- Security notifications cannot be disabled
- KYC status changes always sent
- Payment confirmations always sent

### BR-2: Rate Limiting
- Max 50 emails per user per day
- Batch similar notifications (e.g., daily digest option)

### BR-3: Unsubscribe
- All non-critical emails include unsubscribe link
- Honors opt-out preferences

### BR-4: Template Language Selection
- Email template language is determined by `User.locale`
- Default locale is `pt-BR` if `User.locale` is not set
- Subject lines are also locale-specific

---

## Edge Cases

### EC-1: User Has No Locale Set
**Scenario**: A user who was created before the locale field was added has `locale = null`.
**Handling**: Fall back to `pt-BR` for all email templates and subject lines.

### EC-2: Bulk Notification Trigger
**Scenario**: A round close triggers notifications to 50+ investors simultaneously.
**Handling**: All notifications are queued individually in Bull. The queue processes them with rate limiting to avoid SES throttling. Delivery may be staggered over several minutes.

### EC-3: Email Bounce
**Scenario**: An email bounces because the address is invalid.
**Handling**: Mark the notification as `BOUNCED`. After 3 bounces for the same email address, disable email notifications for that user and notify the admin. The user can re-enable notifications after updating their email.

### EC-4: Notification for Deleted User
**Scenario**: A system event triggers a notification for a user who has requested account deletion (in grace period).
**Handling**: Skip sending the notification. Users in the deletion grace period do not receive new notifications.

---

## MVP Scope

### In Scope (MVP)

- **In-app notifications**: Persisted in database, displayed in UI
- **Bell icon dropdown**: Top bar bell with unread count badge, dropdown showing last 5 unread notifications
- **Notifications page**: `/notifications` with full list, filters (read/unread, type), and pagination
- **Mark as read**: Individual and bulk "mark all as read"
- **Notification preferences**: Users can toggle categories (transactions, documents, options) on/off via settings
- **Critical notifications**: Security and KYC notifications cannot be disabled
- **Background processing**: Notification creation via Bull queue (non-blocking)
- **Retry on failure**: 3 retries with exponential backoff for failed notification creation
- **Navigation links**: Click a notification to navigate to the related entity
- **Relative timestamps**: "2m ago", "1h ago", "3 days ago"

### Out of Scope (Post-MVP)

- **Email delivery**: AWS SES integration, MJML templates, email sending
- **Real-time updates**: WebSocket/SSE push notifications (MVP refreshes on navigation)
- **Push notifications**: Browser push or mobile push
- **Daily digest**: Batch email summary of notifications
- **Bounce handling**: Email bounce detection and management
- **Unsubscribe links**: Email unsubscribe flow
- **Email rate limiting**: 50 emails/user/day cap
- **SMS notifications**: Not planned

### Data Model Adjustments for MVP

The `Notification` model retains email-related fields (`subject`, `bodyHtml`, `bodyText`, `status`, `sentAt`, `failedReason`) for forward compatibility. For MVP:
- `status` is always `PENDING` (no email delivery means no `SENT`/`FAILED`/`BOUNCED`)
- `sentAt` is always `null`
- `failedReason` is always `null`
- `bodyHtml` and `bodyText` are not rendered in the UI — the frontend uses `notificationType` + `relatedEntityType` to determine the display message via i18n keys

---

## Frontend Specification

### Page Routing

| Route | Page | Description |
|-------|------|-------------|
| `/notifications` | Notification List | Full list of all notifications with filters and pagination |
| `/settings` | User Settings | Includes notification preferences section (tab or accordion) |

The bell icon dropdown in the top bar is a global component (rendered in the dashboard shell), not a separate route.

### Bell Dropdown Component

The bell icon lives in the top bar (dashboard shell) and provides quick access to recent unread notifications.

#### Layout

```
┌───────────────────────────────────────────────┐
│  🔔(3)                                        │  ← Bell icon with unread count badge
└───────────────────────────────────────────────┘
        │
        ▼ (click to open popover)
┌───────────────────────────────────────────────┐
│  Notifications                     Mark all ← │  ← Header: h4, "Mark all" ghost button
│───────────────────────────────────────────────│
│  🔵 📄 Contrato requer assinatura       2m   │  ← Unread: blue-50 bg, ocean-600 dot
│        Acme Ltda.                             │     body-sm gray-500 company name
│───────────────────────────────────────────────│
│  🔵 💰 Ações emitidas com sucesso       15m  │  ← Unread
│        TechCorp                               │
│───────────────────────────────────────────────│
│     ✅ Vesting milestone alcançado       1h   │  ← Read: white bg, no dot
│        Acme Ltda.                             │
│───────────────────────────────────────────────│
│     🔔 Rodada fechada com sucesso        3h   │  ← Read
│        TechCorp                               │
│───────────────────────────────────────────────│
│     📋 KYC verificação aprovada          1d   │  ← Read
│        —                                      │
│───────────────────────────────────────────────│
│          View All Notifications →              │  ← Ghost link to /notifications
└───────────────────────────────────────────────┘
```

#### Behavior

- **Trigger**: Click the bell icon to open/close the popover
- **Badge**: Red circle with unread count (hidden when 0). Max display `9+`.
- **Content**: Shows up to 5 most recent notifications (mix of read/unread, sorted by `createdAt` desc)
- **Unread indicator**: Small `ocean-600` dot on the left side of unread items
- **Mark all as read**: Ghost button in the header. Calls `PUT /api/v1/users/me/notifications/read-all`. Refreshes the list.
- **Click item**: Marks as read (if unread) and navigates to the related entity
- **View All**: Link at the bottom navigates to `/notifications`
- **Data fetching**: Fetches on mount and on popover open. No polling.
- **Empty state**: "No notifications" text centered in the dropdown

#### Navigation Mapping

When a notification is clicked, navigate to the related entity based on `relatedEntityType` and `relatedEntityId`:

| relatedEntityType | Navigation Target |
|-------------------|-------------------|
| `Document` | `/companies/:companyId/documents/:id` |
| `Transaction` | `/companies/:companyId/transactions/:id` |
| `OptionGrant` | `/companies/:companyId/option-grants/:id` |
| `OptionExerciseRequest` | `/companies/:companyId/option-grants` (list view) |
| `FundingRound` | `/companies/:companyId/funding-rounds/:id` |
| `Shareholder` | `/companies/:companyId/shareholders/:id` |
| `KYCVerification` | `/settings` (KYC section) |
| `User` | `/settings` (profile section) |
| `null` | No navigation (notification only) |

**Note**: `companyId` is included in the notification metadata for company-scoped entities. For global entities (KYC, User), navigate to user-scoped pages.

### Notification List Page (`/notifications`)

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  h1: Notifications                              [Mark All Read]  │
│  body-sm: View and manage your notifications                     │
├──────────────────────────────────────────────────────────────────┤
│  Filters: [All ▾] [All Types ▾]                     🔍 Search   │
│           read/unread   notification type                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 🔵 📄 Contrato de Acionistas requer sua assinatura   2m  │  │  ← Unread item
│  │      Acme Ltda.                                           │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 🔵 💰 10.000 ações ON emitidas com sucesso          15m  │  │
│  │      TechCorp                                             │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │    ✅ Vesting milestone: 50% alcançado                1h  │  │  ← Read item
│  │      Acme Ltda.                                           │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │    🔔 Rodada Series A fechada                         3h  │  │
│  │      TechCorp                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Showing 1-20 of 42                         < 1 2 3 >            │
└──────────────────────────────────────────────────────────────────┘
```

#### Filters

| Filter | Type | Options |
|--------|------|---------|
| Read status | Select dropdown | All, Unread only, Read only |
| Notification type | Select dropdown | All Types, Documents, Transactions, Options, Funding Rounds, KYC, Security |
| Search | Text input | Free-text search on notification subject/description |

#### Behavior

- **Default sort**: `-createdAt` (newest first)
- **Pagination**: 20 items per page, standard pagination controls
- **Click item**: Marks as read (if unread) and navigates to the related entity
- **Mark All Read**: Secondary button in page header, marks all unread notifications as read
- **Filters update URL query params**: Enabling back/forward navigation and shareable filter states

### Notification Preferences (in User Settings)

Located within the `/settings` page, under a "Notifications" tab or section.

#### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  h3: Notification Preferences                                │
│  body-sm: Choose which notifications you want to receive     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  📄 Documents                                   [ON]  │  │  ← Toggle switch
│  │  body-sm: Signature requests, document completions     │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  💰 Transactions                                [ON]  │  │
│  │  body-sm: Share issuances, transfers, confirmations    │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  📈 Options                                     [ON]  │  │
│  │  body-sm: Grants, vesting milestones, exercises        │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  🏦 Funding Rounds                              [ON]  │  │
│  │  body-sm: Round invitations, commitments, closings     │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │  🔒 Security                              [ON] 🔒     │  │  ← Always on, disabled toggle
│  │  body-sm: Login alerts, KYC updates                    │  │
│  │  caption: Security notifications cannot be disabled    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  [Save Preferences]                                          │
└──────────────────────────────────────────────────────────────┘
```

#### Behavior

- **Load**: Fetch preferences on mount via `GET /api/v1/users/me/notifications/preferences`
- **Toggle**: Each category has an on/off switch (shadcn `Switch` component)
- **Security lock**: The security toggle is always on and disabled. A lock icon and helper text explain it cannot be disabled.
- **Save**: Primary button calls `PUT /api/v1/users/me/notifications/preferences`. Shows success toast.
- **Optimistic update**: Toggle switches update immediately; revert on API failure.

### Component Hierarchy

```
DashboardShell
  └─ TopBar
       └─ NotificationBell
            ├─ BellIconButton (with badge)
            └─ NotificationDropdown (Popover)
                 ├─ NotificationDropdownHeader ("Notifications" + "Mark all")
                 ├─ NotificationDropdownList
                 │    └─ NotificationDropdownItem (x5 max)
                 ├─ NotificationDropdownEmpty
                 └─ NotificationDropdownFooter ("View All" link)

NotificationsPage (/notifications)
  ├─ PageHeader ("Notifications" + "Mark All Read" button)
  ├─ NotificationFilters
  │    ├─ ReadStatusSelect
  │    ├─ NotificationTypeSelect
  │    └─ SearchInput
  ├─ NotificationList
  │    └─ NotificationListItem (repeated)
  ├─ NotificationListEmpty
  ├─ NotificationListSkeleton
  └─ Pagination

SettingsPage (/settings) → Notifications Tab
  └─ NotificationPreferences
       ├─ PreferenceCategoryRow (repeated per category)
       │    ├─ CategoryIcon
       │    ├─ CategoryLabel + Description
       │    └─ Switch (toggle)
       └─ SaveButton
```

### State Management (TanStack Query)

#### Query Keys

```typescript
const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (filters: NotificationFilters) => [...notificationKeys.lists(), filters] as const,
  detail: (id: string) => [...notificationKeys.all, 'detail', id] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  dropdown: () => [...notificationKeys.all, 'dropdown'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};
```

#### Hooks

```typescript
// Bell dropdown: fetch 5 most recent notifications
function useNotificationDropdown() {
  return useQuery({
    queryKey: notificationKeys.dropdown(),
    queryFn: () => api.getList<Notification>(
      '/api/v1/users/me/notifications?limit=5&sort=-createdAt'
    ),
  });
}

// Unread count for badge
function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => api.get<{ count: number }>(
      '/api/v1/users/me/notifications/unread-count'
    ),
  });
}

// Full notification list with filters and pagination
function useNotifications(filters: NotificationFilters) {
  const query = buildQueryString(filters);
  return useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: () => api.getList<Notification>(
      `/api/v1/users/me/notifications?${query}`
    ),
  });
}

// Mark single notification as read
function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.put(`/api/v1/users/me/notifications/${id}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// Mark all notifications as read
function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.put('/api/v1/users/me/notifications/read-all', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

// Notification preferences
function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => api.get<NotificationPreferences>(
      '/api/v1/users/me/notifications/preferences'
    ),
  });
}

// Update notification preferences
function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (prefs: UpdatePreferencesDto) =>
      api.put('/api/v1/users/me/notifications/preferences', prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.preferences() });
    },
  });
}
```

#### Additional API Endpoint (MVP)

The bell badge requires a lightweight unread count endpoint:

```
GET /api/v1/users/me/notifications/unread-count
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "count": 3
  }
}
```

And a bulk mark-all-as-read endpoint:

```
PUT /api/v1/users/me/notifications/read-all
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "updatedCount": 7
  }
}
```

### Loading, Error, and Empty States

#### Loading States

| Component | Loading Behavior |
|-----------|-----------------|
| Bell badge | No badge shown until count loads |
| Bell dropdown | 3 skeleton items (pulse animation): icon placeholder + 2 text lines |
| Notification list page | 5 skeleton rows matching `NotificationListItem` layout |
| Preferences | Skeleton switches (3 rows) |

All loading skeletons use `gray-200` pulsing rectangles per the design system.

#### Error States

| Component | Error Behavior |
|-----------|---------------|
| Bell dropdown | "Failed to load notifications" text + "Retry" ghost button |
| Notification list page | Error card with retry button centered in content area |
| Preferences | Error toast via `useErrorToast()` with `messageKey` |
| Mark as read failure | Error toast, notification reverts to unread state |

#### Empty States

| Component | Empty State |
|-----------|-------------|
| Bell dropdown | Icon (BellOff, 32px, `gray-300`) + "No notifications" (`body-sm`, `gray-500`) |
| Notification list (no notifications at all) | Illustration (Bell, 64px, `gray-300`) + "No notifications yet" (`h3`, `gray-700`) + "When important events happen, you'll see them here." (`body`, `gray-500`, max-width 400px) |
| Notification list (filters return empty) | "No notifications match your filters" (`body`, `gray-500`) + "Clear filters" ghost button |

### Notification Item Design

#### Icon Mapping by Notification Type

| notificationType | Icon (Lucide) | Icon Color |
|------------------|---------------|------------|
| `SIGNATURE_REQUEST` | `FileSignature` | `ocean-600` |
| `DOCUMENT_SIGNED` | `FileCheck` | `green-700` |
| `DOCUMENT_FULLY_SIGNED` | `FileCheck2` | `green-700` |
| `DOCUMENT_DECLINED` | `FileX` | `destructive` |
| `SHARES_ISSUED` | `TrendingUp` | `green-700` |
| `SHARES_TRANSFERRED` | `ArrowLeftRight` | `ocean-600` |
| `TRANSACTION_FAILED` | `AlertTriangle` | `destructive` |
| `OPTION_GRANTED` | `Gift` | `ocean-600` |
| `VESTING_MILESTONE` | `Target` | `green-700` |
| `OPTION_EXERCISE_REQUESTED` | `Hand` | `cream-700` |
| `OPTION_EXERCISE_COMPLETED` | `CheckCircle` | `green-700` |
| `OPTIONS_EXPIRING` | `Clock` | `cream-700` |
| `KYC_COMPLETED` | `ShieldCheck` | `green-700` |
| `KYC_REJECTED` | `ShieldX` | `destructive` |
| `KYC_RESUBMISSION` | `ShieldAlert` | `cream-700` |
| `ROUND_INVITATION` | `Mail` | `ocean-600` |
| `ROUND_CLOSING_SOON` | `Timer` | `cream-700` |
| `ROUND_CLOSED` | `CheckCircle2` | `green-700` |
| `SHAREHOLDER_ADDED` | `UserPlus` | `ocean-600` |
| `SHAREHOLDER_REMOVED` | `UserMinus` | `destructive` |
| `DILUTION_EVENT` | `AlertCircle` | `cream-700` |
| (fallback) | `Bell` | `gray-500` |

#### Read/Unread Styling

| Property | Unread | Read |
|----------|--------|------|
| Background | `blue-50` | `white` |
| Left indicator | 4px `ocean-600` left border or dot | None |
| Title font weight | `600` (semibold) | `400` (normal) |
| Title color | `gray-900` | `gray-600` |
| Timestamp color | `ocean-600` | `gray-400` |
| Hover background | `blue-100` | `gray-50` |

#### Notification Item Structure

```
┌─[dot]─[icon]──[title text]─────────────────[timestamp]─┐
│              [company name / context]                    │
└─────────────────────────────────────────────────────────┘
```

- **Dot**: 8px circle, `ocean-600`, only for unread items. Hidden for read items.
- **Icon**: 20px Lucide icon, colored per type mapping above
- **Title**: `body` (14px), weight varies by read state. Derived from `notificationType` via i18n key.
- **Timestamp**: `caption` (12px), relative time ("2m", "1h", "3d", "23/01/2026" for >7 days). Always Brazilian date format for absolute dates.
- **Context line**: `body-sm` (13px), `gray-500`. Shows company name when available, or additional context.
- **Padding**: `12px 16px`
- **Border bottom**: `1px solid gray-100`
- **Cursor**: `pointer`

#### Relative Timestamp Format

| Time Difference | Display (PT-BR) | Display (EN) |
|-----------------|------------------|--------------|
| < 1 minute | `agora` | `now` |
| 1-59 minutes | `Xm` | `Xm` |
| 1-23 hours | `Xh` | `Xh` |
| 1-6 days | `Xd` | `Xd` |
| 7+ days | `dd/MM/yyyy` | `dd/MM/yyyy` |

**Note**: Absolute dates always use Brazilian format (`dd/MM/yyyy`) regardless of locale, per i18n rules.

---

## Frontend i18n Keys

All notification UI strings must be added to both `messages/pt-BR.json` and `messages/en.json`.

### Namespace: `notifications`

```json
{
  "notifications": {
    "title": "Notificações / Notifications",
    "description": "Veja e gerencie suas notificações / View and manage your notifications",
    "markAllRead": "Marcar todas como lidas / Mark all as read",
    "markAllReadSuccess": "Todas as notificações foram marcadas como lidas / All notifications marked as read",
    "viewAll": "Ver todas as notificações / View all notifications",
    "empty": "Nenhuma notificação / No notifications",
    "emptyDescription": "Quando eventos importantes acontecerem, você verá aqui. / When important events happen, you'll see them here.",
    "emptyFiltered": "Nenhuma notificação encontrada com esses filtros / No notifications match your filters",
    "clearFilters": "Limpar filtros / Clear filters",
    "loadError": "Falha ao carregar notificações / Failed to load notifications",
    "retry": "Tentar novamente / Retry",

    "filters": {
      "all": "Todas / All",
      "unreadOnly": "Apenas não lidas / Unread only",
      "readOnly": "Apenas lidas / Read only",
      "allTypes": "Todos os tipos / All types",
      "documents": "Documentos / Documents",
      "transactions": "Transações / Transactions",
      "options": "Opções / Options",
      "fundingRounds": "Rodadas / Funding Rounds",
      "kyc": "KYC",
      "security": "Segurança / Security",
      "search": "Buscar notificações... / Search notifications..."
    },

    "types": {
      "SIGNATURE_REQUEST": "Contrato requer sua assinatura / Document requires your signature",
      "DOCUMENT_SIGNED": "Documento assinado / Document signed",
      "DOCUMENT_FULLY_SIGNED": "Documento totalmente assinado / Document fully signed",
      "DOCUMENT_DECLINED": "Assinatura recusada / Signature declined",
      "SHARES_ISSUED": "{quantity} ações {shareClass} emitidas / {quantity} {shareClass} shares issued",
      "SHARES_TRANSFERRED": "Ações transferidas / Shares transferred",
      "TRANSACTION_FAILED": "Transação falhou / Transaction failed",
      "OPTION_GRANTED": "Opções concedidas / Options granted",
      "VESTING_MILESTONE": "Marco de vesting: {percentage}% alcançado / Vesting milestone: {percentage}% reached",
      "OPTION_EXERCISE_REQUESTED": "Exercício de opções solicitado / Option exercise requested",
      "OPTION_EXERCISE_COMPLETED": "Exercício de opções concluído / Option exercise completed",
      "OPTIONS_EXPIRING": "Opções expiram em {days} dias / Options expiring in {days} days",
      "KYC_COMPLETED": "Verificação KYC aprovada / KYC verification approved",
      "KYC_REJECTED": "Verificação KYC rejeitada / KYC verification rejected",
      "KYC_RESUBMISSION": "Reenvio de KYC necessário / KYC resubmission required",
      "ROUND_INVITATION": "Convite para rodada de investimento / Funding round invitation",
      "ROUND_CLOSING_SOON": "Rodada fecha em breve / Round closing soon",
      "ROUND_CLOSED": "Rodada encerrada / Round closed",
      "SHAREHOLDER_ADDED": "Novo acionista adicionado / New shareholder added",
      "SHAREHOLDER_REMOVED": "Acionista removido / Shareholder removed",
      "DILUTION_EVENT": "Evento de diluição significativo / Significant dilution event"
    },

    "time": {
      "now": "agora / now",
      "minutesAgo": "{count}m",
      "hoursAgo": "{count}h",
      "daysAgo": "{count}d"
    },

    "preferences": {
      "title": "Preferências de Notificação / Notification Preferences",
      "description": "Escolha quais notificações você deseja receber / Choose which notifications you want to receive",
      "documents": "Documentos / Documents",
      "documentsDescription": "Solicitações de assinatura, documentos finalizados / Signature requests, document completions",
      "transactions": "Transações / Transactions",
      "transactionsDescription": "Emissões de ações, transferências, confirmações / Share issuances, transfers, confirmations",
      "options": "Opções / Options",
      "optionsDescription": "Concessões, marcos de vesting, exercícios / Grants, vesting milestones, exercises",
      "fundingRounds": "Rodadas de Investimento / Funding Rounds",
      "fundingRoundsDescription": "Convites, compromissos, encerramentos / Invitations, commitments, closings",
      "security": "Segurança / Security",
      "securityDescription": "Alertas de login, atualizações de KYC / Login alerts, KYC updates",
      "securityLocked": "Notificações de segurança não podem ser desativadas / Security notifications cannot be disabled",
      "save": "Salvar Preferências / Save Preferences",
      "saveSuccess": "Preferências atualizadas com sucesso / Preferences updated successfully"
    }
  }
}
```

**Note**: The above shows `PT-BR / EN` side by side for reference. In the actual JSON files, each locale file contains only its own language values. Interpolation variables (e.g., `{quantity}`, `{percentage}`) use `next-intl` ICU message syntax.

---

## Frontend Components

### NotificationBell

**Location**: `frontend/src/components/notifications/NotificationBell.tsx`

**Description**: Bell icon button in the top bar with unread count badge. Opens the notification dropdown popover on click.

**Props**: None (uses hooks internally for data fetching).

**shadcn/ui**: `Popover`, `PopoverTrigger`, `PopoverContent`, `Button` (ghost variant)

**Lucide icon**: `Bell`

**Hooks**: `useUnreadCount()`, `useNotificationDropdown()`

---

### NotificationDropdown

**Location**: `frontend/src/components/notifications/NotificationDropdown.tsx`

**Description**: Popover content showing the last 5 notifications with header and footer.

**Props**:
```typescript
interface NotificationDropdownProps {
  notifications: Notification[];
  isLoading: boolean;
  isError: boolean;
  onMarkAllRead: () => void;
  onClose: () => void;
}
```

**shadcn/ui**: `ScrollArea`

**Sub-components**: `NotificationDropdownHeader`, `NotificationDropdownItem`, `NotificationDropdownEmpty`, `NotificationDropdownFooter`

---

### NotificationDropdownItem

**Location**: `frontend/src/components/notifications/NotificationDropdownItem.tsx`

**Description**: Single notification row in the dropdown. Shows icon, title, context line, and relative timestamp.

**Props**:
```typescript
interface NotificationDropdownItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}
```

---

### NotificationsPage

**Location**: `frontend/src/app/(dashboard)/notifications/page.tsx`

**Description**: Full notifications list page with filters and pagination.

**Props**: None (page component, uses URL search params for filters).

**shadcn/ui**: `Card`, `Select`, `Input`, `Button`

**Hooks**: `useNotifications(filters)`, `useMarkAllAsRead()`, `useMarkAsRead()`

---

### NotificationFilters

**Location**: `frontend/src/components/notifications/NotificationFilters.tsx`

**Description**: Filter bar with read status dropdown, type dropdown, and search input.

**Props**:
```typescript
interface NotificationFiltersProps {
  filters: {
    readStatus: 'all' | 'read' | 'unread';
    notificationType: string | null;
    search: string;
  };
  onFiltersChange: (filters: NotificationFiltersProps['filters']) => void;
}
```

**shadcn/ui**: `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `Input`

---

### NotificationListItem

**Location**: `frontend/src/components/notifications/NotificationListItem.tsx`

**Description**: Single notification row in the full list page. Wider than dropdown item, same core structure.

**Props**:
```typescript
interface NotificationListItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}
```

---

### NotificationListEmpty

**Location**: `frontend/src/components/notifications/NotificationListEmpty.tsx`

**Description**: Empty state for the notification list. Shows different messages for "no notifications at all" vs "no results for current filters".

**Props**:
```typescript
interface NotificationListEmptyProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
}
```

**shadcn/ui**: `Button` (ghost variant for "Clear filters")

**Lucide icon**: `Bell` (64px, `gray-300`)

---

### NotificationListSkeleton

**Location**: `frontend/src/components/notifications/NotificationListSkeleton.tsx`

**Description**: Loading skeleton for the notification list. Shows 5 pulsing rows.

**Props**:
```typescript
interface NotificationListSkeletonProps {
  count?: number; // default: 5
}
```

**shadcn/ui**: `Skeleton`

---

### NotificationPreferences

**Location**: `frontend/src/components/notifications/NotificationPreferences.tsx`

**Description**: Notification preferences panel for the settings page. Shows toggles per category.

**Props**: None (uses hooks internally for data fetching and mutation).

**shadcn/ui**: `Card`, `Switch`, `Button`, `Label`

**Lucide icons**: `FileText`, `TrendingUp`, `Target`, `Landmark`, `Shield`, `Lock`

**Hooks**: `useNotificationPreferences()`, `useUpdatePreferences()`

---

### NotificationIcon

**Location**: `frontend/src/components/notifications/NotificationIcon.tsx`

**Description**: Renders the appropriate Lucide icon for a given `notificationType`, with the correct color.

**Props**:
```typescript
interface NotificationIconProps {
  notificationType: string;
  size?: number;    // default: 20
  className?: string;
}
```

---

### useRelativeTime

**Location**: `frontend/src/hooks/useRelativeTime.ts`

**Description**: Custom hook that formats a date into a relative time string ("2m", "1h", "3d") or absolute Brazilian date format for dates older than 7 days.

**Signature**:
```typescript
function useRelativeTime(date: string | Date): string;
```

Uses `next-intl` for locale-aware labels (`agora`/`now`). Absolute dates always use `Intl.DateTimeFormat('pt-BR')` per i18n rules.

---

### TypeScript Types

```typescript
interface Notification {
  id: string;
  notificationType: string;
  subject: string;
  read: boolean;
  readAt: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  companyId: string | null;
  companyName: string | null;
  createdAt: string;
}

interface NotificationFilters {
  page?: number;
  limit?: number;
  read?: boolean;
  notificationType?: string;
  search?: string;
  sort?: string;
}

interface NotificationPreferences {
  categories: {
    transactions: boolean;
    documents: boolean;
    options: boolean;
    fundingRounds: boolean;
    security: boolean; // always true
  };
  updatedAt: string;
}

interface UpdatePreferencesDto {
  categories: {
    transactions?: boolean;
    documents?: boolean;
    options?: boolean;
    fundingRounds?: boolean;
    // security is omitted — backend ignores it
  };
}
```

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [document-signatures.md](./document-signatures.md) | Signature request and document completion notification triggers |
| [transactions.md](./transactions.md) | Transaction confirmation, approval, and failure notification triggers |
| [option-plans.md](./option-plans.md) | Vesting milestone and option grant notification triggers |
| [option-exercises.md](./option-exercises.md) | Exercise request, payment confirmation, and share issuance notifications |
| [company-membership.md](./company-membership.md) | Member invitation and role change notification triggers |
| [funding-rounds.md](./funding-rounds.md) | Round invitation, commitment confirmation, and closing notifications |
| [authentication.md](./authentication.md) | Login from new device and security-related notifications |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, pagination, and URL conventions for notification endpoints |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes for notification delivery failures and preference updates |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events for notification preference changes |
| [i18n.md](../.claude/rules/i18n.md) | Notification UI translations in PT-BR and EN; email template language selection (post-MVP) |
| [design-system.md](../.claude/rules/design-system.md) | Color system, typography, component patterns, and icon conventions for notification UI |
| [security.md](../.claude/rules/security.md) | Critical security notifications cannot be disabled by user preferences |

---

## Success Criteria

### MVP (In-App Notifications)

- [ ] All notification events from the event catalog are triggered and persisted
- [ ] Notification creation latency < 5 seconds from trigger event (via Bull queue)
- [ ] Zero lost notifications for critical events (security, KYC)
- [ ] Bell icon shows correct unread count badge
- [ ] Bell dropdown shows last 5 notifications with correct read/unread styling
- [ ] Mark as read works for individual notifications and bulk "mark all"
- [ ] `/notifications` page renders full list with pagination (20 per page)
- [ ] Filters (read status, notification type, search) work correctly
- [ ] Clicking a notification navigates to the correct related entity
- [ ] Notification preferences page renders all categories with toggles
- [ ] Security category toggle is locked and always enabled
- [ ] Preferences save successfully and affect which notifications are created
- [ ] Loading skeletons, error states, and empty states render correctly
- [ ] All UI strings use i18n keys from `notifications` namespace
- [ ] Both PT-BR and EN translations are complete
- [ ] Relative timestamps display correctly (agora/now, Xm, Xh, Xd, dd/MM/yyyy)
- [ ] Unread count badge hides when count is 0
- [ ] Notification list refreshes on page navigation

### Post-MVP (Email Delivery)

- [ ] Email delivery rate > 98% via AWS SES
- [ ] Email delivery latency < 60 seconds from trigger event
- [ ] < 1% bounce rate
- [ ] Bounce handling disables email after 3 bounces
- [ ] Unsubscribe links work in all non-critical emails
- [ ] Daily digest option available for batched notifications
