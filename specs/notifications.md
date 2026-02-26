# Notifications Specification

**Topic of Concern**: In-app notification system for key events (MVP); email delivery deferred to post-MVP

**One-Sentence Description**: The system creates in-app notifications for important events like AI report completions, Open Finance sync results, investor Q&A activity, and KYC status changes, displayed via a bell icon dropdown and a dedicated notifications page.

---

## Overview

Navia uses an in-app notification system to alert users of important events. Notifications are triggered automatically by system events and persisted via background jobs (Bull queue) to avoid blocking API requests. Users access notifications through a bell icon in the top bar (showing the last 5 unread) and a full `/notifications` page with filtering and pagination. Notifications refresh on page navigation (no real-time push for MVP).

**MVP Delivery**: In-app notifications only. Email delivery via AWS SES (templates, SES integration, bounce handling) is planned for post-MVP. The backend data model and API are designed to support email delivery when added later.

---

## Notification Events

### AI & Processing Events
- AI report generation completed
- Document AI processing completed
- Document AI processing failed

### Open Finance Events
- Bank data sync completed
- Bank data sync failed
- Bank consent expiring (7-day warning)

### Investor Relations Events
- Investor Q&A question received (notify founder)
- Company update posted (notify investors)
- Investor access granted to a company

### Financial Events
- Monthly financial snapshot computed

### KYC Events
- KYC verification approved
- KYC verification rejected (with reason)
- KYC resubmission required

### Company & Data Events
- Company data enrichment completed (BigDataCorp)
- Company created
- Company profile published

### Member Events
- Member invited to company
- Member accepted invitation
- Member removed from company
- Member role changed

### Document Events
- Document uploaded

### Security Events
- Login from new device
- Account locked

---

## Notification Event Catalog

### AI & Processing Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `AI_REPORT_READY` | Report | SYSTEM | AI report generation completes successfully |
| `AI_PROCESSING_COMPLETE` | Document | SYSTEM | Document AI processing finishes (OCR, extraction, classification) |
| `AI_PROCESSING_FAILED` | Document | SYSTEM | Document AI processing fails after retries |

**Payload for `AI_REPORT_READY`**:
```json
{
  "notificationType": "AI_REPORT_READY",
  "relatedEntityType": "Report",
  "relatedEntityId": "uuid-of-report",
  "companyId": "uuid-of-company",
  "metadata": {
    "reportType": "financial_analysis",
    "reportTitle": "Analise Financeira - Fev 2026",
    "generatedAt": "2026-02-26T14:30:00.000Z"
  }
}
```

**Payload for `AI_PROCESSING_COMPLETE`**:
```json
{
  "notificationType": "AI_PROCESSING_COMPLETE",
  "relatedEntityType": "Document",
  "relatedEntityId": "uuid-of-document",
  "companyId": "uuid-of-company",
  "metadata": {
    "documentName": "Balanco_2025.pdf",
    "processingType": "ocr_extraction",
    "extractedFields": 42
  }
}
```

**Payload for `AI_PROCESSING_FAILED`**:
```json
{
  "notificationType": "AI_PROCESSING_FAILED",
  "relatedEntityType": "Document",
  "relatedEntityId": "uuid-of-document",
  "companyId": "uuid-of-company",
  "metadata": {
    "documentName": "Contrato_Social.pdf",
    "processingType": "ocr_extraction",
    "failureReason": "unreadable_document",
    "retriesExhausted": true
  }
}
```

### Open Finance Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `OPEN_FINANCE_SYNC_COMPLETE` | OpenFinanceConnection | SYSTEM | Bank data sync completes successfully |
| `OPEN_FINANCE_SYNC_FAILED` | OpenFinanceConnection | SYSTEM | Bank data sync fails after retries |
| `OPEN_FINANCE_CONSENT_EXPIRING` | OpenFinanceConnection | SYSTEM | 7 days before bank consent expires |

**Payload for `OPEN_FINANCE_SYNC_COMPLETE`**:
```json
{
  "notificationType": "OPEN_FINANCE_SYNC_COMPLETE",
  "relatedEntityType": "OpenFinanceConnection",
  "relatedEntityId": "uuid-of-connection",
  "companyId": "uuid-of-company",
  "metadata": {
    "bankName": "Banco do Brasil",
    "accountsSync": 3,
    "transactionsSync": 147,
    "syncPeriod": "2026-01-01/2026-02-26"
  }
}
```

**Payload for `OPEN_FINANCE_SYNC_FAILED`**:
```json
{
  "notificationType": "OPEN_FINANCE_SYNC_FAILED",
  "relatedEntityType": "OpenFinanceConnection",
  "relatedEntityId": "uuid-of-connection",
  "companyId": "uuid-of-company",
  "metadata": {
    "bankName": "Itau",
    "failureReason": "bank_unavailable",
    "lastSuccessfulSync": "2026-02-20T08:00:00.000Z"
  }
}
```

**Payload for `OPEN_FINANCE_CONSENT_EXPIRING`**:
```json
{
  "notificationType": "OPEN_FINANCE_CONSENT_EXPIRING",
  "relatedEntityType": "OpenFinanceConnection",
  "relatedEntityId": "uuid-of-connection",
  "companyId": "uuid-of-company",
  "metadata": {
    "bankName": "Nubank",
    "expiresAt": "2026-03-05T00:00:00.000Z",
    "daysUntilExpiry": 7
  }
}
```

### Investor Relations Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `INVESTOR_QA_RECEIVED` | InvestorQuestion | USER | An investor submits a question (notifies founder/admin) |
| `COMPANY_UPDATE_POSTED` | CompanyUpdate | USER | Founder posts a company update (notifies investors) |
| `INVESTOR_ACCESS_GRANTED` | CompanyMember | USER | Investor is granted access to view a company |

**Payload for `INVESTOR_QA_RECEIVED`**:
```json
{
  "notificationType": "INVESTOR_QA_RECEIVED",
  "relatedEntityType": "InvestorQuestion",
  "relatedEntityId": "uuid-of-question",
  "companyId": "uuid-of-company",
  "metadata": {
    "investorName": "Maria Santos",
    "questionPreview": "Qual a projecao de receita para o Q2?",
    "askedAt": "2026-02-26T10:15:00.000Z"
  }
}
```

**Payload for `COMPANY_UPDATE_POSTED`**:
```json
{
  "notificationType": "COMPANY_UPDATE_POSTED",
  "relatedEntityType": "CompanyUpdate",
  "relatedEntityId": "uuid-of-update",
  "companyId": "uuid-of-company",
  "metadata": {
    "companyName": "Acme Ltda.",
    "updateTitle": "Resultado Mensal - Janeiro 2026",
    "postedBy": "Nelson Pereira"
  }
}
```

**Payload for `INVESTOR_ACCESS_GRANTED`**:
```json
{
  "notificationType": "INVESTOR_ACCESS_GRANTED",
  "relatedEntityType": "CompanyMember",
  "relatedEntityId": "uuid-of-membership",
  "companyId": "uuid-of-company",
  "metadata": {
    "companyName": "Acme Ltda.",
    "accessLevel": "INVESTOR",
    "grantedBy": "Nelson Pereira"
  }
}
```

### Financial Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `FINANCIAL_SNAPSHOT_READY` | FinancialSnapshot | SYSTEM | Monthly financial snapshot computation completes |

**Payload for `FINANCIAL_SNAPSHOT_READY`**:
```json
{
  "notificationType": "FINANCIAL_SNAPSHOT_READY",
  "relatedEntityType": "FinancialSnapshot",
  "relatedEntityId": "uuid-of-snapshot",
  "companyId": "uuid-of-company",
  "metadata": {
    "period": "2026-01",
    "revenue": "125000.00",
    "netIncome": "32000.00",
    "currency": "BRL"
  }
}
```

### KYC Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `KYC_APPROVED` | KYCVerification | SYSTEM | KYC verification is approved |
| `KYC_REJECTED` | KYCVerification | SYSTEM | KYC verification is rejected |
| `KYC_RESUBMISSION_REQUIRED` | KYCVerification | SYSTEM | KYC needs resubmission (document quality, mismatch, etc.) |

**Payload for `KYC_APPROVED`**:
```json
{
  "notificationType": "KYC_APPROVED",
  "relatedEntityType": "KYCVerification",
  "relatedEntityId": "uuid-of-verification",
  "companyId": null,
  "metadata": {
    "verificationType": "individual",
    "approvedAt": "2026-02-26T14:00:00.000Z"
  }
}
```

**Payload for `KYC_REJECTED`**:
```json
{
  "notificationType": "KYC_REJECTED",
  "relatedEntityType": "KYCVerification",
  "relatedEntityId": "uuid-of-verification",
  "companyId": null,
  "metadata": {
    "verificationType": "individual",
    "rejectionReason": "document_expired",
    "rejectedAt": "2026-02-26T14:00:00.000Z"
  }
}
```

**Payload for `KYC_RESUBMISSION_REQUIRED`**:
```json
{
  "notificationType": "KYC_RESUBMISSION_REQUIRED",
  "relatedEntityType": "KYCVerification",
  "relatedEntityId": "uuid-of-verification",
  "companyId": null,
  "metadata": {
    "verificationType": "individual",
    "reason": "document_unreadable",
    "requiredDocuments": ["identity_front", "identity_back"]
  }
}
```

### Company & Data Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `COMPANY_DATA_ENRICHED` | Company | SYSTEM | BigDataCorp data enrichment completes for a company |
| `COMPANY_CREATED` | Company | USER | A new company is created |
| `PROFILE_PUBLISHED` | Company | USER | Company profile is published to investors |

**Payload for `COMPANY_DATA_ENRICHED`**:
```json
{
  "notificationType": "COMPANY_DATA_ENRICHED",
  "relatedEntityType": "Company",
  "relatedEntityId": "uuid-of-company",
  "companyId": "uuid-of-company",
  "metadata": {
    "enrichmentSource": "bigdatacorp",
    "fieldsUpdated": ["revenue", "employeeCount", "industry", "foundedDate"],
    "enrichedAt": "2026-02-26T08:00:00.000Z"
  }
}
```

**Payload for `COMPANY_CREATED`**:
```json
{
  "notificationType": "COMPANY_CREATED",
  "relatedEntityType": "Company",
  "relatedEntityId": "uuid-of-company",
  "companyId": "uuid-of-company",
  "metadata": {
    "companyName": "Acme Ltda.",
    "cnpj": "12.345.678/0001-90"
  }
}
```

### Member Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `MEMBER_INVITED` | CompanyMember | USER | A member is invited to join a company |
| `MEMBER_ACCEPTED` | CompanyMember | USER | An invited member accepts the invitation |
| `MEMBER_REMOVED` | CompanyMember | USER | A member is removed from a company |
| `ROLE_CHANGED` | CompanyMember | USER | A member's role is changed |

**Payload for `MEMBER_INVITED`**:
```json
{
  "notificationType": "MEMBER_INVITED",
  "relatedEntityType": "CompanyMember",
  "relatedEntityId": "uuid-of-membership",
  "companyId": "uuid-of-company",
  "metadata": {
    "companyName": "Acme Ltda.",
    "invitedBy": "Nelson Pereira",
    "role": "INVESTOR"
  }
}
```

**Payload for `ROLE_CHANGED`**:
```json
{
  "notificationType": "ROLE_CHANGED",
  "relatedEntityType": "CompanyMember",
  "relatedEntityId": "uuid-of-membership",
  "companyId": "uuid-of-company",
  "metadata": {
    "companyName": "Acme Ltda.",
    "previousRole": "INVESTOR",
    "newRole": "ADMIN",
    "changedBy": "Nelson Pereira"
  }
}
```

### Document Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `DOCUMENT_UPLOADED` | Document | USER | A document is uploaded to a company |

**Payload for `DOCUMENT_UPLOADED`**:
```json
{
  "notificationType": "DOCUMENT_UPLOADED",
  "relatedEntityType": "Document",
  "relatedEntityId": "uuid-of-document",
  "companyId": "uuid-of-company",
  "metadata": {
    "documentName": "Balanco_2025.pdf",
    "uploadedBy": "Nelson Pereira",
    "documentType": "financial_statement"
  }
}
```

### Security Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `LOGIN_NEW_DEVICE` | User | SYSTEM | Login detected from a new device or location |
| `ACCOUNT_LOCKED` | User | SYSTEM | Account locked after failed login attempts |

**Payload for `LOGIN_NEW_DEVICE`**:
```json
{
  "notificationType": "LOGIN_NEW_DEVICE",
  "relatedEntityType": "User",
  "relatedEntityId": "uuid-of-user",
  "companyId": null,
  "metadata": {
    "ipAddress": "192.168.1.0/24",
    "userAgent": "Mozilla/5.0...",
    "location": "Sao Paulo, BR"
  }
}
```

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
- Categories: ai_processing, open_finance, investor_relations, financial, documents, security
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
  notification_type: string;         // "AI_REPORT_READY", "KYC_APPROVED", etc.

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
  related_entity_type: string | null;  // "Report", "Document", "Company", etc.
  related_entity_id: string | null;

  created_at: Date;
}

interface UserNotificationPreferences {
  user_id: string;
  email_notifications: boolean;     // MVP: ignored (no email delivery). Retained for post-MVP.
  categories: {
    ai_processing: boolean;
    open_finance: boolean;
    investor_relations: boolean;
    financial: boolean;
    documents: boolean;
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
| `read` | boolean | --- | Filter by read status |
| `notificationType` | string | --- | Filter by type (e.g., `AI_REPORT_READY`) |
| `sort` | string | `-createdAt` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "notificationType": "AI_REPORT_READY",
      "subject": "[Navia] Relatorio de IA pronto",
      "status": "PENDING",
      "read": false,
      "relatedEntityType": "Report",
      "relatedEntityId": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
      "createdAt": "2026-02-26T10:00:00.000Z"
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
    "notificationType": "INVESTOR_QA_RECEIVED",
    "subject": "[Navia] Nova pergunta de investidor",
    "bodyText": "Maria Santos enviou uma pergunta sobre Acme Ltda...",
    "status": "PENDING",
    "sentAt": null,
    "read": false,
    "readAt": null,
    "relatedEntityType": "InvestorQuestion",
    "relatedEntityId": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "createdAt": "2026-02-26T10:00:00.000Z"
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
    "readAt": "2026-02-26T12:30:00.000Z"
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
      "aiProcessing": true,
      "openFinance": true,
      "investorRelations": true,
      "financial": true,
      "documents": true,
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
    "aiProcessing": true,
    "openFinance": false,
    "investorRelations": true,
    "financial": true,
    "documents": false
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
      "aiProcessing": true,
      "openFinance": false,
      "investorRelations": true,
      "financial": true,
      "documents": false,
      "security": true
    },
    "updatedAt": "2026-02-26T14:00:00.000Z"
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
    ai-report-ready/
      pt-BR.mjml
      en.mjml
    open-finance-sync-complete/
      pt-BR.mjml
      en.mjml
    investor-qa-received/
      pt-BR.mjml
      en.mjml
    kyc-approved/
      pt-BR.mjml
      en.mjml
    ...
```

The system selects the template language based on `User.locale`. If the user's locale is not set or the template is missing for that locale, the system falls back to `pt-BR`.

### Template: AI Report Ready
```
Subject (PT-BR): [Navia] Seu relatorio de IA esta pronto
Subject (EN): [Navia] Your AI report is ready

Hi {{user_name}},

Your AI report for {{company_name}} is ready:
  Report: {{report_title}}
  Type: {{report_type}}

Click here to view: {{report_url}}
```

### Template: Open Finance Sync Complete
```
Subject (PT-BR): [Navia] Sincronizacao bancaria concluida
Subject (EN): [Navia] Bank sync completed

Hi {{user_name}},

Your bank data sync for {{company_name}} has completed:
  Bank: {{bank_name}}
  Accounts synced: {{accounts_count}}
  Transactions synced: {{transactions_count}}

View your financial data: {{dashboard_url}}
```

### Template: KYC Approved
```
Subject (PT-BR): [Navia] Verificacao KYC aprovada
Subject (EN): [Navia] KYC verification approved

Hi {{user_name}},

Your identity verification has been approved. You now have full access to all Navia features.

View your account: {{settings_url}}
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
    "message": "Notificacao nao encontrada",
    "messageKey": "errors.notification.notFound"
  }
}
```

---

## Business Rules

### BR-1: Critical Notifications
- Security notifications cannot be disabled
- KYC status changes always sent
- AI processing failure notifications always sent

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
**Scenario**: A company update is posted and triggers notifications to 50+ investors simultaneously.
**Handling**: All notifications are queued individually in Bull. The queue processes them with rate limiting to avoid SES throttling. Delivery may be staggered over several minutes.

### EC-3: Email Bounce
**Scenario**: An email bounces because the address is invalid.
**Handling**: Mark the notification as `BOUNCED`. After 3 bounces for the same email address, disable email notifications for that user and notify the admin. The user can re-enable notifications after updating their email.

### EC-4: Notification for Deleted User
**Scenario**: A system event triggers a notification for a user who has requested account deletion (in grace period).
**Handling**: Skip sending the notification. Users in the deletion grace period do not receive new notifications.

### EC-5: AI Processing Fails Repeatedly
**Scenario**: Document AI processing fails, triggering `AI_PROCESSING_FAILED`. User re-uploads and it fails again.
**Handling**: Each failure creates a separate notification. After 3 failures for the same document, include metadata suggesting the user contact support.

### EC-6: Open Finance Consent Expires Without Renewal
**Scenario**: The `OPEN_FINANCE_CONSENT_EXPIRING` notification was sent 7 days before expiry, but the user did not renew.
**Handling**: When consent actually expires, the next sync attempt will fail and trigger `OPEN_FINANCE_SYNC_FAILED` with `failureReason: "consent_expired"`.

---

## MVP Scope

### In Scope (MVP)

- **In-app notifications**: Persisted in database, displayed in UI
- **Bell icon dropdown**: Top bar bell with unread count badge, dropdown showing last 5 unread notifications
- **Notifications page**: `/notifications` with full list, filters (read/unread, type), and pagination
- **Mark as read**: Individual and bulk "mark all as read"
- **Notification preferences**: Users can toggle categories (AI processing, Open Finance, investor relations, financial, documents) on/off via settings
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
- `bodyHtml` and `bodyText` are not rendered in the UI --- the frontend uses `notificationType` + `relatedEntityType` to determine the display message via i18n keys

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
+-----------------------------------------------+
|  bell(3)                                       |  <- Bell icon with unread count badge
+-----------------------------------------------+
        |
        v (click to open popover)
+-----------------------------------------------+
|  Notifications                     Mark all <- |  <- Header: h4, "Mark all" ghost button
|-----------------------------------------------|
|  * brain Relatorio de IA pronto          2m   |  <- Unread: blue-50 bg, ocean-600 dot
|        Acme Ltda.                              |     body-sm gray-500 company name
|-----------------------------------------------|
|  * bank Sincronizacao bancaria OK        15m  |  <- Unread
|        TechCorp                                |
|-----------------------------------------------|
|    check KYC verificacao aprovada         1h   |  <- Read: white bg, no dot
|        ---                                     |
|-----------------------------------------------|
|    msg  Pergunta de investidor            3h   |  <- Read
|        Acme Ltda.                              |
|-----------------------------------------------|
|    bell Atualizacao da empresa            1d   |  <- Read
|        TechCorp                                |
|-----------------------------------------------|
|          View All Notifications ->             |  <- Ghost link to /notifications
+-----------------------------------------------+
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
| `Report` | `/companies/:companyId/reports/:id` |
| `Document` | `/companies/:companyId/documents/:id` |
| `OpenFinanceConnection` | `/companies/:companyId/settings/open-finance` |
| `InvestorQuestion` | `/companies/:companyId/investor-relations/qa/:id` |
| `CompanyUpdate` | `/companies/:companyId/updates/:id` |
| `CompanyMember` | `/companies/:companyId/settings/members` |
| `FinancialSnapshot` | `/companies/:companyId/financials/:period` |
| `Company` | `/companies/:companyId` |
| `KYCVerification` | `/settings` (KYC section) |
| `User` | `/settings` (profile section) |
| `null` | No navigation (notification only) |

**Note**: `companyId` is included in the notification metadata for company-scoped entities. For global entities (KYC, User), navigate to user-scoped pages.

### Notification List Page (`/notifications`)

#### Layout

```
+------------------------------------------------------------------+
|  h1: Notifications                              [Mark All Read]  |
|  body-sm: View and manage your notifications                     |
|------------------------------------------------------------------|
|  Filters: [All v] [All Types v]                     search       |
|           read/unread   notification type                        |
|------------------------------------------------------------------|
|                                                                  |
|  +------------------------------------------------------------+ |
|  | * brain Relatorio de IA pronto para analise             2m  | |  <- Unread item
|  |      Acme Ltda.                                             | |
|  |------------------------------------------------------------| |
|  | * bank Sincronizacao bancaria concluida                15m  | |
|  |      TechCorp                                               | |
|  |------------------------------------------------------------| |
|  |   check KYC verificacao aprovada                        1h  | |  <- Read item
|  |      ---                                                    | |
|  |------------------------------------------------------------| |
|  |   msg  Nova pergunta de investidor                      3h  | |
|  |      Acme Ltda.                                             | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  Showing 1-20 of 42                         < 1 2 3 >           |
+------------------------------------------------------------------+
```

#### Filters

| Filter | Type | Options |
|--------|------|---------|
| Read status | Select dropdown | All, Unread only, Read only |
| Notification type | Select dropdown | All Types, AI & Processing, Open Finance, Investor Relations, Financial, Documents, KYC, Security |
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
+--------------------------------------------------------------+
|  h3: Notification Preferences                                |
|  body-sm: Choose which notifications you want to receive     |
|                                                              |
|  +--------------------------------------------------------+ |
|  |  brain AI & Processing                            [ON]  | |  <- Toggle switch
|  |  body-sm: AI reports, document processing results        | |
|  |--------------------------------------------------------| |
|  |  bank Open Finance                                [ON]  | |
|  |  body-sm: Bank syncs, consent expiration warnings        | |
|  |--------------------------------------------------------| |
|  |  users Investor Relations                         [ON]  | |
|  |  body-sm: Q&A questions, company updates, access grants  | |
|  |--------------------------------------------------------| |
|  |  chart Financial                                  [ON]  | |
|  |  body-sm: Monthly snapshots, financial summaries          | |
|  |--------------------------------------------------------| |
|  |  file Documents                                   [ON]  | |
|  |  body-sm: Document uploads, processing completions        | |
|  |--------------------------------------------------------| |
|  |  lock Security                              [ON] lock   | |  <- Always on, disabled toggle
|  |  body-sm: Login alerts, KYC updates                       | |
|  |  caption: Security notifications cannot be disabled       | |
|  +--------------------------------------------------------+ |
|                                                              |
|  [Save Preferences]                                          |
+--------------------------------------------------------------+
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
  +- TopBar
       +- NotificationBell
            +- BellIconButton (with badge)
            +- NotificationDropdown (Popover)
                 +- NotificationDropdownHeader ("Notifications" + "Mark all")
                 +- NotificationDropdownList
                 |    +- NotificationDropdownItem (x5 max)
                 +- NotificationDropdownEmpty
                 +- NotificationDropdownFooter ("View All" link)

NotificationsPage (/notifications)
  +- PageHeader ("Notifications" + "Mark All Read" button)
  +- NotificationFilters
  |    +- ReadStatusSelect
  |    +- NotificationTypeSelect
  |    +- SearchInput
  +- NotificationList
  |    +- NotificationListItem (repeated)
  +- NotificationListEmpty
  +- NotificationListSkeleton
  +- Pagination

SettingsPage (/settings) -> Notifications Tab
  +- NotificationPreferences
       +- PreferenceCategoryRow (repeated per category)
       |    +- CategoryIcon
       |    +- CategoryLabel + Description
       |    +- Switch (toggle)
       +- SaveButton
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
| `AI_REPORT_READY` | `Brain` | `ocean-600` |
| `AI_PROCESSING_COMPLETE` | `FileCheck` | `green-700` |
| `AI_PROCESSING_FAILED` | `FileX` | `destructive` |
| `OPEN_FINANCE_SYNC_COMPLETE` | `Landmark` | `green-700` |
| `OPEN_FINANCE_SYNC_FAILED` | `AlertTriangle` | `destructive` |
| `OPEN_FINANCE_CONSENT_EXPIRING` | `Clock` | `cream-700` |
| `INVESTOR_QA_RECEIVED` | `MessageCircleQuestion` | `ocean-600` |
| `COMPANY_UPDATE_POSTED` | `Megaphone` | `ocean-600` |
| `INVESTOR_ACCESS_GRANTED` | `UserCheck` | `green-700` |
| `FINANCIAL_SNAPSHOT_READY` | `BarChart3` | `ocean-600` |
| `KYC_APPROVED` | `ShieldCheck` | `green-700` |
| `KYC_REJECTED` | `ShieldX` | `destructive` |
| `KYC_RESUBMISSION_REQUIRED` | `ShieldAlert` | `cream-700` |
| `COMPANY_DATA_ENRICHED` | `DatabaseZap` | `ocean-600` |
| `COMPANY_CREATED` | `Building2` | `ocean-600` |
| `PROFILE_PUBLISHED` | `Globe` | `green-700` |
| `MEMBER_INVITED` | `Mail` | `ocean-600` |
| `MEMBER_ACCEPTED` | `UserCheck` | `green-700` |
| `MEMBER_REMOVED` | `UserMinus` | `destructive` |
| `ROLE_CHANGED` | `UserCog` | `cream-700` |
| `DOCUMENT_UPLOADED` | `FileUp` | `ocean-600` |
| `LOGIN_NEW_DEVICE` | `MonitorSmartphone` | `cream-700` |
| `ACCOUNT_LOCKED` | `Lock` | `destructive` |
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
+-[dot]-[icon]--[title text]-----------------[timestamp]-+
|              [company name / context]                   |
+---------------------------------------------------------+
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
    "title": "Notificacoes / Notifications",
    "description": "Veja e gerencie suas notificacoes / View and manage your notifications",
    "markAllRead": "Marcar todas como lidas / Mark all as read",
    "markAllReadSuccess": "Todas as notificacoes foram marcadas como lidas / All notifications marked as read",
    "viewAll": "Ver todas as notificacoes / View all notifications",
    "empty": "Nenhuma notificacao / No notifications",
    "emptyDescription": "Quando eventos importantes acontecerem, voce vera aqui. / When important events happen, you'll see them here.",
    "emptyFiltered": "Nenhuma notificacao encontrada com esses filtros / No notifications match your filters",
    "clearFilters": "Limpar filtros / Clear filters",
    "loadError": "Falha ao carregar notificacoes / Failed to load notifications",
    "retry": "Tentar novamente / Retry",

    "filters": {
      "all": "Todas / All",
      "unreadOnly": "Apenas nao lidas / Unread only",
      "readOnly": "Apenas lidas / Read only",
      "allTypes": "Todos os tipos / All types",
      "aiProcessing": "IA & Processamento / AI & Processing",
      "openFinance": "Open Finance",
      "investorRelations": "Relacoes com Investidores / Investor Relations",
      "financial": "Financeiro / Financial",
      "documents": "Documentos / Documents",
      "kyc": "KYC",
      "security": "Seguranca / Security",
      "search": "Buscar notificacoes... / Search notifications..."
    },

    "types": {
      "AI_REPORT_READY": "Relatorio de IA pronto / AI report ready",
      "AI_PROCESSING_COMPLETE": "Processamento de documento concluido / Document processing complete",
      "AI_PROCESSING_FAILED": "Processamento de documento falhou / Document processing failed",
      "OPEN_FINANCE_SYNC_COMPLETE": "Sincronizacao bancaria concluida / Bank sync completed",
      "OPEN_FINANCE_SYNC_FAILED": "Sincronizacao bancaria falhou / Bank sync failed",
      "OPEN_FINANCE_CONSENT_EXPIRING": "Consentimento bancario expira em {days} dias / Bank consent expires in {days} days",
      "INVESTOR_QA_RECEIVED": "Nova pergunta de {investorName} / New question from {investorName}",
      "COMPANY_UPDATE_POSTED": "{companyName} publicou uma atualizacao / {companyName} posted an update",
      "INVESTOR_ACCESS_GRANTED": "Acesso concedido a {companyName} / Access granted to {companyName}",
      "FINANCIAL_SNAPSHOT_READY": "Snapshot financeiro de {period} pronto / Financial snapshot for {period} ready",
      "KYC_APPROVED": "Verificacao KYC aprovada / KYC verification approved",
      "KYC_REJECTED": "Verificacao KYC rejeitada / KYC verification rejected",
      "KYC_RESUBMISSION_REQUIRED": "Reenvio de KYC necessario / KYC resubmission required",
      "COMPANY_DATA_ENRICHED": "Dados da empresa enriquecidos / Company data enriched",
      "COMPANY_CREATED": "Empresa criada com sucesso / Company created successfully",
      "PROFILE_PUBLISHED": "Perfil da empresa publicado / Company profile published",
      "MEMBER_INVITED": "Voce foi convidado para {companyName} / You were invited to {companyName}",
      "MEMBER_ACCEPTED": "{memberName} aceitou o convite / {memberName} accepted the invitation",
      "MEMBER_REMOVED": "Membro removido de {companyName} / Member removed from {companyName}",
      "ROLE_CHANGED": "Sua funcao foi alterada para {newRole} / Your role was changed to {newRole}",
      "DOCUMENT_UPLOADED": "Documento enviado: {documentName} / Document uploaded: {documentName}",
      "LOGIN_NEW_DEVICE": "Login detectado de novo dispositivo / Login detected from new device",
      "ACCOUNT_LOCKED": "Conta bloqueada por tentativas de login / Account locked due to login attempts"
    },

    "time": {
      "now": "agora / now",
      "minutesAgo": "{count}m",
      "hoursAgo": "{count}h",
      "daysAgo": "{count}d"
    },

    "preferences": {
      "title": "Preferencias de Notificacao / Notification Preferences",
      "description": "Escolha quais notificacoes voce deseja receber / Choose which notifications you want to receive",
      "aiProcessing": "IA & Processamento / AI & Processing",
      "aiProcessingDescription": "Relatorios de IA, resultados de processamento de documentos / AI reports, document processing results",
      "openFinance": "Open Finance",
      "openFinanceDescription": "Sincronizacoes bancarias, avisos de expiracao de consentimento / Bank syncs, consent expiration warnings",
      "investorRelations": "Relacoes com Investidores / Investor Relations",
      "investorRelationsDescription": "Perguntas de Q&A, atualizacoes da empresa, concessoes de acesso / Q&A questions, company updates, access grants",
      "financial": "Financeiro / Financial",
      "financialDescription": "Snapshots mensais, resumos financeiros / Monthly snapshots, financial summaries",
      "documents": "Documentos / Documents",
      "documentsDescription": "Uploads de documentos, conclusoes de processamento / Document uploads, processing completions",
      "security": "Seguranca / Security",
      "securityDescription": "Alertas de login, atualizacoes de KYC / Login alerts, KYC updates",
      "securityLocked": "Notificacoes de seguranca nao podem ser desativadas / Security notifications cannot be disabled",
      "save": "Salvar Preferencias / Save Preferences",
      "saveSuccess": "Preferencias atualizadas com sucesso / Preferences updated successfully"
    }
  }
}
```

**Note**: The above shows `PT-BR / EN` side by side for reference. In the actual JSON files, each locale file contains only its own language values. Interpolation variables (e.g., `{investorName}`, `{companyName}`, `{days}`) use `next-intl` ICU message syntax.

### Backend messageKeys for New Notification Types

All new notification types have corresponding i18n messageKeys for backend error responses and notification content:

| Notification Type | messageKey (title) | messageKey (description) |
|---|---|---|
| `AI_REPORT_READY` | `notifications.types.AI_REPORT_READY` | `notifications.descriptions.aiReportReady` |
| `AI_PROCESSING_COMPLETE` | `notifications.types.AI_PROCESSING_COMPLETE` | `notifications.descriptions.aiProcessingComplete` |
| `AI_PROCESSING_FAILED` | `notifications.types.AI_PROCESSING_FAILED` | `notifications.descriptions.aiProcessingFailed` |
| `OPEN_FINANCE_SYNC_COMPLETE` | `notifications.types.OPEN_FINANCE_SYNC_COMPLETE` | `notifications.descriptions.openFinanceSyncComplete` |
| `OPEN_FINANCE_SYNC_FAILED` | `notifications.types.OPEN_FINANCE_SYNC_FAILED` | `notifications.descriptions.openFinanceSyncFailed` |
| `OPEN_FINANCE_CONSENT_EXPIRING` | `notifications.types.OPEN_FINANCE_CONSENT_EXPIRING` | `notifications.descriptions.openFinanceConsentExpiring` |
| `INVESTOR_QA_RECEIVED` | `notifications.types.INVESTOR_QA_RECEIVED` | `notifications.descriptions.investorQaReceived` |
| `COMPANY_UPDATE_POSTED` | `notifications.types.COMPANY_UPDATE_POSTED` | `notifications.descriptions.companyUpdatePosted` |
| `INVESTOR_ACCESS_GRANTED` | `notifications.types.INVESTOR_ACCESS_GRANTED` | `notifications.descriptions.investorAccessGranted` |
| `FINANCIAL_SNAPSHOT_READY` | `notifications.types.FINANCIAL_SNAPSHOT_READY` | `notifications.descriptions.financialSnapshotReady` |
| `KYC_APPROVED` | `notifications.types.KYC_APPROVED` | `notifications.descriptions.kycApproved` |
| `KYC_REJECTED` | `notifications.types.KYC_REJECTED` | `notifications.descriptions.kycRejected` |
| `KYC_RESUBMISSION_REQUIRED` | `notifications.types.KYC_RESUBMISSION_REQUIRED` | `notifications.descriptions.kycResubmissionRequired` |
| `COMPANY_DATA_ENRICHED` | `notifications.types.COMPANY_DATA_ENRICHED` | `notifications.descriptions.companyDataEnriched` |

### Description i18n Keys (PT-BR / EN)

```json
{
  "notifications": {
    "descriptions": {
      "aiReportReady": "Seu relatorio {reportTitle} para {companyName} esta pronto para visualizacao / Your report {reportTitle} for {companyName} is ready to view",
      "aiProcessingComplete": "O documento {documentName} foi processado com sucesso / Document {documentName} was processed successfully",
      "aiProcessingFailed": "O processamento do documento {documentName} falhou. Tente novamente. / Document {documentName} processing failed. Please try again.",
      "openFinanceSyncComplete": "Sincronizacao com {bankName} concluida: {transactionsSync} transacoes importadas / Sync with {bankName} complete: {transactionsSync} transactions imported",
      "openFinanceSyncFailed": "Sincronizacao com {bankName} falhou. Verifique sua conexao bancaria. / Sync with {bankName} failed. Check your bank connection.",
      "openFinanceConsentExpiring": "Seu consentimento com {bankName} expira em {daysUntilExpiry} dias. Renove para continuar sincronizando. / Your consent with {bankName} expires in {daysUntilExpiry} days. Renew to continue syncing.",
      "investorQaReceived": "{investorName} enviou uma pergunta sobre {companyName} / {investorName} asked a question about {companyName}",
      "companyUpdatePosted": "{companyName} publicou: {updateTitle} / {companyName} posted: {updateTitle}",
      "investorAccessGranted": "Voce recebeu acesso de {accessLevel} a {companyName} / You were granted {accessLevel} access to {companyName}",
      "financialSnapshotReady": "O snapshot financeiro de {period} para {companyName} esta disponivel / The financial snapshot for {period} at {companyName} is available",
      "kycApproved": "Sua verificacao de identidade foi aprovada. Acesso completo liberado. / Your identity verification was approved. Full access granted.",
      "kycRejected": "Sua verificacao de identidade foi rejeitada. Motivo: {rejectionReason} / Your identity verification was rejected. Reason: {rejectionReason}",
      "kycResubmissionRequired": "Reenvio necessario para sua verificacao KYC. Motivo: {reason} / Resubmission needed for your KYC verification. Reason: {reason}",
      "companyDataEnriched": "Dados de {companyName} foram enriquecidos com {fieldsCount} novos campos / {companyName} data was enriched with {fieldsCount} new fields"
    }
  }
}
```

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

**Lucide icons**: `Brain`, `Landmark`, `Users`, `BarChart3`, `FileText`, `Shield`, `Lock`

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
    aiProcessing: boolean;
    openFinance: boolean;
    investorRelations: boolean;
    financial: boolean;
    documents: boolean;
    security: boolean; // always true
  };
  updatedAt: string;
}

interface UpdatePreferencesDto {
  categories: {
    aiProcessing?: boolean;
    openFinance?: boolean;
    investorRelations?: boolean;
    financial?: boolean;
    documents?: boolean;
    // security is omitted -- backend ignores it
  };
}
```

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-membership.md](./company-membership.md) | Member invitation, acceptance, removal, and role change notification triggers |
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
