# Notifications — User Flows

**Feature**: In-app notification system with user preference management, read/unread tracking, and async delivery via Bull queue
**Actors**: All authenticated users (any role)
**Preconditions**: User must be logged in with a valid session
**Related Flows**: [Authentication](./authentication.md) (user must be logged in), [Transactions](./transactions.md) (triggers SHARES_ISSUED, SHARES_TRANSFERRED, TRANSACTION_FAILED, SHAREHOLDER_ADDED, SHAREHOLDER_REMOVED, DILUTION_EVENT), [Option Plans](./option-plans.md) (triggers OPTION_GRANTED, VESTING_MILESTONE, OPTION_EXERCISE_REQUESTED, OPTION_EXERCISE_COMPLETED, OPTIONS_EXPIRING), [Funding Rounds](./funding-rounds.md) (triggers ROUND_INVITATION, ROUND_CLOSING_SOON, ROUND_CLOSED), [KYC Verification](./kyc-verification.md) (triggers KYC_COMPLETED, KYC_REJECTED, KYC_RESUBMISSION)

---

## Flow Map

```
User navigates to Notifications page
  |
  +-- [authenticated] --> GET /api/v1/users/me/notifications?page=1&limit=20
  |     |
  |     +-- [has notifications] --> Display paginated list (subject, type, read status, timestamp)
  |     |     |
  |     |     +-- [user clicks a notification row] --> GET /api/v1/users/me/notifications/:id
  |     |     |     |
  |     |     |     +-- [notification belongs to user] --> Detail view (subject, body, metadata)
  |     |     |     |
  |     |     |     +-- [notification not found or belongs to another user] --> 404 Not Found
  |     |     |
  |     |     +-- [user clicks "Mark as Read" on a notification] --> PUT /api/v1/users/me/notifications/:id/read
  |     |     |     |
  |     |     |     +-- [notification exists + unread] --> readAt set, read=true
  |     |     |     +-- [notification exists + already read] --> No change, return current state
  |     |     |     +-- [notification not found] --> 404 Not Found
  |     |     |
  |     |     +-- [user clicks "Mark All as Read"] --> PUT /api/v1/users/me/notifications/read-all
  |     |     |     +-- [has unread] --> All unread notifications get readAt set, returns updatedCount
  |     |     |     +-- [none unread] --> updatedCount: 0
  |     |     |
  |     |     +-- [user clicks "Delete" on a notification] --> DELETE /api/v1/users/me/notifications/:id
  |     |     |     |
  |     |     |     +-- [notification exists] --> 204 No Content
  |     |     |     +-- [notification not found] --> 404 Not Found
  |     |     |
  |     |     +-- [user filters by read status] --> GET ...?read=true or read=false --> Filtered list
  |     |     |
  |     |     +-- [user filters by notification type] --> GET ...?notificationType=SHARES_ISSUED --> Filtered list
  |     |     |
  |     |     +-- [user changes sort] --> GET ...?sort=-createdAt or sort=notificationType
  |     |
  |     +-- [no notifications] --> Display empty state
  |
  +-- [unauthenticated] --> 401 Unauthorized --> redirect to login


User checks unread count (e.g., bell icon badge)
  |
  +-- [authenticated] --> GET /api/v1/users/me/notifications/unread-count
  |     +-- Returns { count: N }
  |
  +-- [unauthenticated] --> 401 Unauthorized


User opens Notification Preferences
  |
  +-- GET /api/v1/users/me/notifications/preferences
  |     |
  |     +-- [preferences exist] --> Return category toggles (transactions, documents, options, fundingRounds, security)
  |     |
  |     +-- [no preferences exist] --> Create defaults (all categories enabled) --> Return defaults
  |
  +-- User toggles a category
  |     |
  |     +-- [category != security] --> PUT /api/v1/users/me/notifications/preferences
  |     |     |
  |     |     +-- [valid booleans] --> Category updated. Security forced to true regardless.
  |     |     |
  |     |     +-- [invalid input] --> 400 Bad Request
  |     |
  |     +-- [category = security] --> UI disables toggle. Security cannot be turned off.


System creates a notification (async, triggered by other modules)
  |
  +-- NotificationService.create(payload) called by another module
  |     |
  |     +-- [critical type: KYC_COMPLETED, KYC_REJECTED, KYC_RESUBMISSION]
  |     |     +-- Skip preference check --> Queue to Bull
  |     |
  |     +-- [non-critical type]
  |           |
  |           +-- [user has preferences + category disabled] --> Skip silently, do not queue
  |           |
  |           +-- [user has preferences + category enabled] --> Queue to Bull
  |           |
  |           +-- [user has no preferences (defaults = all enabled)] --> Queue to Bull
  |
  +-- Bull processor picks up job
  |     |
  |     +-- [success] --> Notification persisted to DB (status: PENDING, channel: IN_APP)
  |     |
  |     +-- [failure] --> Retry up to 3 times with exponential backoff (1s, 2s, 4s)
  |           |
  |           +-- [all retries exhausted] --> Job stays in failed state for inspection
```

---

## Flows

### Happy Path: List Notifications

```
PRECONDITION: User is authenticated
ACTOR: Any authenticated user
TRIGGER: User navigates to the notifications page or the notification panel

1. [UI] User opens the notifications page or clicks the bell icon
2. [Frontend] Sends GET /api/v1/users/me/notifications?page=1&limit=20
3. [Backend] Validates authentication via AuthGuard
   -> IF unauthenticated: return 401, frontend redirects to login
4. [Backend] Queries notifications for the authenticated user, ordered by -createdAt
5. [Backend] Returns 200 with paginated list in standard envelope
6. [UI] Displays notification list with subject, type, read/unread indicator, and timestamp

POSTCONDITION: User sees their paginated notification list
SIDE EFFECTS: None
```

### Happy Path: Check Unread Count

```
PRECONDITION: User is authenticated
ACTOR: Any authenticated user
TRIGGER: Page load (polling or on-demand for bell icon badge)

1. [Frontend] Sends GET /api/v1/users/me/notifications/unread-count
2. [Backend] Validates authentication via AuthGuard
   -> IF unauthenticated: return 401, frontend redirects to login
3. [Backend] Counts notifications where userId matches and readAt is null
4. [Backend] Returns 200 with { count: N }
5. [UI] Updates the bell icon badge with the unread count (hides badge if 0)

POSTCONDITION: Bell icon shows current unread count
SIDE EFFECTS: None
```

### Happy Path: View Notification Detail

```
PRECONDITION: User is authenticated, notification exists and belongs to the user
ACTOR: Any authenticated user
TRIGGER: User clicks on a notification in the list

1. [UI] User clicks a notification row
2. [Frontend] Sends GET /api/v1/users/me/notifications/:id
3. [Backend] Validates authentication via AuthGuard
   -> IF unauthenticated: return 401, frontend redirects to login
4. [Backend] Looks up notification by id WHERE userId = authenticated user
   -> IF not found: return 404 NOTIFICATION_NOT_FOUND
5. [Backend] Returns 200 with full detail (subject, body, metadata, readAt, companyId, relatedEntity)
6. [UI] Displays notification detail view

POSTCONDITION: User sees the full notification content including body and metadata
SIDE EFFECTS: None
```

### Happy Path: Mark Single Notification as Read

```
PRECONDITION: User is authenticated, notification exists and is unread
ACTOR: Any authenticated user
TRIGGER: User clicks "Mark as Read" on a notification or opens it

1. [UI] User clicks "Mark as Read" button on a notification
2. [Frontend] Sends PUT /api/v1/users/me/notifications/:id/read
3. [Backend] Validates authentication via AuthGuard
   -> IF unauthenticated: return 401, frontend redirects to login
4. [Backend] Looks up notification by id WHERE userId = authenticated user
   -> IF not found: return 404 NOTIFICATION_NOT_FOUND
5. [Backend] Checks if notification is already read
   -> IF already read: return 200 with current state (idempotent, no update)
6. [Backend] Sets readAt = now()
7. [Backend] Returns 200 with { id, read: true, readAt }
8. [UI] Updates notification to show read state, decrements unread badge count

POSTCONDITION: Notification readAt is set, read=true
SIDE EFFECTS: None
```

### Alternative Path: Mark Single Notification as Read (Already Read)

```
PRECONDITION: User is authenticated, notification exists and is already read
ACTOR: Any authenticated user
TRIGGER: User clicks "Mark as Read" on an already-read notification

1. [UI] User clicks "Mark as Read" button
2. [Frontend] Sends PUT /api/v1/users/me/notifications/:id/read
3. [Backend] Validates authentication
4. [Backend] Finds notification, sees readAt is already set
5. [Backend] Returns 200 with existing { id, read: true, readAt } (no database update)
6. [UI] No visual change (already displayed as read)

POSTCONDITION: No change; notification remains read
SIDE EFFECTS: None
```

### Happy Path: Mark All Notifications as Read

```
PRECONDITION: User is authenticated, has at least one unread notification
ACTOR: Any authenticated user
TRIGGER: User clicks "Mark All as Read" button

1. [UI] User clicks "Mark All as Read"
2. [Frontend] Sends PUT /api/v1/users/me/notifications/read-all
3. [Backend] Validates authentication via AuthGuard
   -> IF unauthenticated: return 401, frontend redirects to login
4. [Backend] Batch-updates all notifications WHERE userId = user AND readAt IS NULL, setting readAt = now()
5. [Backend] Returns 200 with { updatedCount: N }
6. [UI] All notifications visually switch to read state, bell badge resets to 0

POSTCONDITION: All user notifications have readAt set
SIDE EFFECTS: None
```

### Alternative Path: Mark All as Read (None Unread)

```
PRECONDITION: User is authenticated, all notifications are already read
ACTOR: Any authenticated user
TRIGGER: User clicks "Mark All as Read"

1. [UI] User clicks "Mark All as Read"
2. [Frontend] Sends PUT /api/v1/users/me/notifications/read-all
3. [Backend] Validates authentication
4. [Backend] Finds no matching unread notifications
5. [Backend] Returns 200 with { updatedCount: 0 }
6. [UI] No visual change

POSTCONDITION: No change
SIDE EFFECTS: None
```

### Happy Path: Delete a Notification

```
PRECONDITION: User is authenticated, notification exists and belongs to user
ACTOR: Any authenticated user
TRIGGER: User clicks "Delete" on a notification

1. [UI] User clicks "Delete" on a notification
2. [UI] Confirmation dialog shown (optional, depends on frontend implementation)
3. [Frontend] Sends DELETE /api/v1/users/me/notifications/:id
4. [Backend] Validates authentication via AuthGuard
   -> IF unauthenticated: return 401, frontend redirects to login
5. [Backend] Looks up notification by id WHERE userId = authenticated user
   -> IF not found: return 404 NOTIFICATION_NOT_FOUND
6. [Backend] Deletes the notification from the database
7. [Backend] Returns 204 No Content
8. [UI] Removes notification from the list, updates unread count if it was unread

POSTCONDITION: Notification is permanently deleted
SIDE EFFECTS: None
```

### Happy Path: View Notification Preferences

```
PRECONDITION: User is authenticated
ACTOR: Any authenticated user
TRIGGER: User navigates to notification settings

1. [UI] User opens notification preferences page/section
2. [Frontend] Sends GET /api/v1/users/me/notifications/preferences
3. [Backend] Validates authentication via AuthGuard
   -> IF unauthenticated: return 401, frontend redirects to login
4. [Backend] Looks up UserNotificationPreferences for the user
   -> IF none exist: creates a default record (all categories enabled, including security) and returns it
5. [Backend] Returns 200 with { categories: { transactions, documents, options, fundingRounds, security }, updatedAt }
6. [UI] Displays preference toggles for each category. Security toggle is disabled/greyed out (always on).

POSTCONDITION: User sees their current notification preferences
SIDE EFFECTS: If no preferences existed, a default record is created in the database
```

### Happy Path: Update Notification Preferences

```
PRECONDITION: User is authenticated
ACTOR: Any authenticated user
TRIGGER: User toggles a category on/off in notification preferences

1. [UI] User toggles a non-security category (e.g., disables "Funding Rounds")
2. [Frontend] Sends PUT /api/v1/users/me/notifications/preferences with { fundingRounds: false }
3. [Backend] Validates authentication via AuthGuard
   -> IF unauthenticated: return 401, frontend redirects to login
4. [Backend] Validates request body via ValidationPipe
   -> IF invalid (non-boolean values): return 400 Bad Request
5. [Backend] Upserts UserNotificationPreferences: applies the changes but forces security = true
6. [Backend] Returns 200 with updated { categories: { ..., fundingRounds: false, security: true }, updatedAt }
7. [UI] Updates toggle states to reflect saved preferences
8. [UI] Shows success toast: "Preferences updated"

POSTCONDITION: User preferences are saved. Security remains always enabled.
SIDE EFFECTS: None
```

### Alternative Path: Attempt to Disable Security Notifications

```
PRECONDITION: User is authenticated
ACTOR: Any authenticated user
TRIGGER: User attempts to disable security notifications (if UI allows the request)

1. [UI] Security toggle is disabled in the UI, but if a request is crafted manually:
2. [Frontend] Sends PUT /api/v1/users/me/notifications/preferences with { security: false }
3. [Backend] Validates authentication
4. [Backend] Ignores the security field entirely. Forces security = true at write time.
5. [Backend] Returns 200 with { categories: { ..., security: true }, updatedAt }

POSTCONDITION: Security preference remains true. The request silently succeeds but security is not disabled.
SIDE EFFECTS: None
```

### Happy Path: Filter Notifications by Read Status

```
PRECONDITION: User is authenticated
ACTOR: Any authenticated user
TRIGGER: User selects "Unread" or "Read" filter

1. [UI] User selects a read status filter (e.g., "Unread only")
2. [Frontend] Sends GET /api/v1/users/me/notifications?read=false&page=1&limit=20
3. [Backend] Validates authentication
4. [Backend] Queries notifications WHERE userId = user AND readAt IS NULL
5. [Backend] Returns 200 with filtered paginated list
6. [UI] Displays only unread notifications

POSTCONDITION: List is filtered to show only unread (or read) notifications
SIDE EFFECTS: None
```

### Happy Path: Filter Notifications by Type

```
PRECONDITION: User is authenticated
ACTOR: Any authenticated user
TRIGGER: User selects a notification type filter

1. [UI] User selects a type filter (e.g., "SHARES_ISSUED")
2. [Frontend] Sends GET /api/v1/users/me/notifications?notificationType=SHARES_ISSUED&page=1&limit=20
3. [Backend] Validates authentication
4. [Backend] Queries notifications WHERE userId = user AND notificationType = 'SHARES_ISSUED'
5. [Backend] Returns 200 with filtered paginated list
6. [UI] Displays only notifications of the selected type

POSTCONDITION: List is filtered to show only the selected notification type
SIDE EFFECTS: None
```

### System Flow: Async Notification Creation

```
PRECONDITION: A triggering event occurs in another module (e.g., share issuance, KYC completion)
ACTOR: System (backend module calling NotificationService.create)
TRIGGER: Business event in another service

1. [Backend] Source module calls NotificationService.create(payload) with userId, notificationType, subject, body, and optional metadata
2. [Backend] Checks if the notification type is critical (KYC_COMPLETED, KYC_REJECTED, KYC_RESUBMISSION)
   -> IF critical: skip preference check, proceed to step 4
3. [Backend] Looks up user's notification preferences for the corresponding category
   -> IF preferences exist AND category disabled: skip notification silently, STOP
   -> IF preferences exist AND category enabled: proceed
   -> IF no preferences exist (defaults = all enabled): proceed
4. [Backend] Adds job to Bull 'notification' queue with 3 retry attempts and exponential backoff
5. [System] Bull processor picks up the 'create-notification' job
6. [Backend] NotificationProcessor calls NotificationService.persistNotification(payload)
7. [Backend] Notification record created in DB: channel=IN_APP, status=PENDING, metadata includes relatedEntityType/Id/companyId/companyName
8. [System] Job marked as complete

POSTCONDITION: Notification exists in the database for the target user
SIDE EFFECTS: Notification visible in user's notification list, unread count incremented
```

### Error Path: Notification Queue Processing Failure

```
PRECONDITION: A notification job is in the Bull queue
ACTOR: System
TRIGGER: Database error or unexpected failure during notification persistence

1. [System] Bull processor picks up the job
2. [Backend] NotificationService.persistNotification throws an error (e.g., database connection failure)
3. [System] Bull retries the job: attempt 2 after 1s, attempt 3 after 2s
   -> IF a retry succeeds: notification is persisted, job complete
4. [System] After 3 failed attempts, job moves to failed state
5. [System] Job remains in Bull failed queue for admin inspection

POSTCONDITION: If all retries fail, the notification is lost (not persisted). The triggering business operation is NOT affected.
SIDE EFFECTS: Failed job visible in Bull queue monitoring
```

### Error Path: Notification Not Found

```
PRECONDITION: User is authenticated
ACTOR: Any authenticated user
TRIGGER: User attempts to view, mark as read, or delete a notification that does not exist or belongs to another user

1. [UI] User tries to interact with a notification (view, mark read, or delete)
2. [Frontend] Sends the corresponding request with the notification ID
3. [Backend] Validates authentication
4. [Backend] Queries notification WHERE id = :id AND userId = authenticated user
5. [Backend] Finds no matching record
6. [Backend] Returns 404 with { code: "NOTIFICATION_NOT_FOUND", messageKey: "errors.notification.notFound" }
7. [UI] Shows error toast: "Notification not found"

POSTCONDITION: No state change
SIDE EFFECTS: None
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 3 (all flows) | Auth check | No valid session/token | Error | 401 Unauthorized, redirect to login |
| 4 (detail/read/delete) | Notification ownership | Notification not found or belongs to different user | Error | 404 Not Found |
| 5 (mark read) | Already read check | readAt is already set | Alternative | Return current state, no DB update (idempotent) |
| 2 (system create) | Critical type check | Type in CRITICAL_NOTIFICATION_TYPES set | Happy | Skip preference check, always queue |
| 3 (system create) | Preference check | Category disabled in user preferences | Skip | Notification not created, no error |
| 3 (system create) | Preference check | No preferences record exists (defaults) | Happy | All categories enabled by default, queue notification |
| 3 (system create) | Preference check | Category enabled in user preferences | Happy | Queue notification to Bull |
| 5 (update prefs) | Security enforcement | Request includes security=false | Override | Backend forces security=true regardless of input |
| 4 (update prefs) | Input validation | Non-boolean values in DTO | Error | 400 Bad Request with validation errors |
| 3 (system create retry) | Bull retry | Persistence fails | Retry | Retry up to 3 times (1s, 2s, 4s exponential backoff) |
| 3 (system create retry) | Bull max retries | All 3 retries exhausted | Error | Job stays in failed state, notification lost |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| Notification | -- | -- | Created (status: PENDING, channel: IN_APP, readAt: null) | Bull processor persists notification |
| Notification | readAt | null | now() | User marks notification as read |
| Notification | readAt | null | now() | User marks all notifications as read |
| Notification | -- | Exists | Deleted | User deletes notification |
| UserNotificationPreferences | -- | -- | Created (all true) | First GET preferences call (auto-create defaults) |
| UserNotificationPreferences | {category} | true | false | User disables a non-security category |
| UserNotificationPreferences | {category} | false | true | User enables a category |
| UserNotificationPreferences | security | true | true (forced) | Any preference update (security cannot be disabled) |

---

## Notification Types by Category

| Category | Notification Type | Trigger Event |
|----------|------------------|---------------|
| documents | SIGNATURE_REQUEST | Document signature requested |
| documents | DOCUMENT_SIGNED | Individual signature applied |
| documents | DOCUMENT_FULLY_SIGNED | All signatures collected |
| documents | DOCUMENT_DECLINED | Signature declined |
| transactions | SHARES_ISSUED | New shares issued |
| transactions | SHARES_TRANSFERRED | Share transfer executed |
| transactions | TRANSACTION_FAILED | Transaction failed |
| transactions | SHAREHOLDER_ADDED | New shareholder added |
| transactions | SHAREHOLDER_REMOVED | Shareholder removed |
| transactions | DILUTION_EVENT | Dilution event occurred |
| options | OPTION_GRANTED | Options granted to employee |
| options | VESTING_MILESTONE | Vesting milestone reached |
| options | OPTION_EXERCISE_REQUESTED | Employee requests exercise |
| options | OPTION_EXERCISE_COMPLETED | Exercise confirmed, shares issued |
| options | OPTIONS_EXPIRING | Options nearing expiration |
| fundingRounds | ROUND_INVITATION | Investor invited to round |
| fundingRounds | ROUND_CLOSING_SOON | Round approaching close date |
| fundingRounds | ROUND_CLOSED | Funding round closed |
| security | KYC_COMPLETED | KYC verification approved |
| security | KYC_REJECTED | KYC verification rejected |
| security | KYC_RESUBMISSION | KYC resubmission requested |

**Note**: Security notifications (KYC_COMPLETED, KYC_REJECTED, KYC_RESUBMISSION) are critical and cannot be disabled by user preferences.

---

## Preference Categories

| Category | Default | Can Disable | Notification Types |
|----------|---------|-------------|-------------------|
| transactions | true | Yes | SHARES_ISSUED, SHARES_TRANSFERRED, TRANSACTION_FAILED, SHAREHOLDER_ADDED, SHAREHOLDER_REMOVED, DILUTION_EVENT |
| documents | true | Yes | SIGNATURE_REQUEST, DOCUMENT_SIGNED, DOCUMENT_FULLY_SIGNED, DOCUMENT_DECLINED |
| options | true | Yes | OPTION_GRANTED, VESTING_MILESTONE, OPTION_EXERCISE_REQUESTED, OPTION_EXERCISE_COMPLETED, OPTIONS_EXPIRING |
| fundingRounds | true | Yes | ROUND_INVITATION, ROUND_CLOSING_SOON, ROUND_CLOSED |
| security | true | No | KYC_COMPLETED, KYC_REJECTED, KYC_RESUBMISSION |

---

## By Role

All authenticated users have identical access to the notification system. There are no role-based restrictions.

| Action | All Roles (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE) |
|--------|------------------------------------------------------|
| List notifications | Yes (own only) |
| View detail | Yes (own only) |
| Get unread count | Yes (own only) |
| Mark as read | Yes (own only) |
| Mark all as read | Yes (own only) |
| Delete | Yes (own only) |
| Get preferences | Yes |
| Update preferences | Yes (security forced true) |

All notification endpoints are user-scoped (`/api/v1/users/me/notifications/*`). Users can only see and manage their own notifications. There is no cross-user notification access.

---

## Cross-Feature References

**Depends on**: [Authentication](./authentication.md) -- user must be logged in to access any notification endpoint

**Feeds into**: No downstream flows. Notifications are a terminal consumer of events from other modules.

**Triggered by**:
- [Transactions](./transactions.md) -- SHARES_ISSUED, SHARES_TRANSFERRED, TRANSACTION_FAILED, SHAREHOLDER_ADDED, SHAREHOLDER_REMOVED, DILUTION_EVENT
- [Option Plans](./option-plans.md) -- OPTION_GRANTED, VESTING_MILESTONE, OPTION_EXERCISE_REQUESTED, OPTION_EXERCISE_COMPLETED, OPTIONS_EXPIRING
- [Funding Rounds](./funding-rounds.md) -- ROUND_INVITATION, ROUND_CLOSING_SOON, ROUND_CLOSED
- [KYC Verification](./kyc-verification.md) -- KYC_COMPLETED, KYC_REJECTED, KYC_RESUBMISSION
- Document module (future) -- SIGNATURE_REQUEST, DOCUMENT_SIGNED, DOCUMENT_FULLY_SIGNED, DOCUMENT_DECLINED

---

## MVP Scope

The notification module is **IN_APP only** for the MVP. Email delivery is not implemented. The channel field is always set to `IN_APP`. Future iterations may add email delivery based on user locale and SES integration.
