# Notifications Specification

**Topic of Concern**: Email notification system for key events

**One-Sentence Description**: The system sends automated email notifications to users for important events like signature requests, transaction confirmations, and vesting milestones.

---

## Overview

Navia uses AWS SES to send transactional emails notifying users of important events. Notifications are triggered automatically by system events and sent via background jobs (Bull queue) to avoid blocking API requests. Email templates are stored in both PT-BR and EN, and the system selects the appropriate language based on `User.locale`.

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
  email_notifications: boolean;
  categories: {
    transactions: boolean;
    documents: boolean;
    options: boolean;
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
| [i18n.md](../.claude/rules/i18n.md) | Email template language selection based on User.locale; templates in PT-BR and EN |
| [security.md](../.claude/rules/security.md) | Critical security notifications cannot be disabled by user preferences |

---

## Success Criteria

- Email delivery rate > 98%
- Delivery latency < 60 seconds from trigger event
- Zero lost notifications for critical events
- < 1% bounce rate
