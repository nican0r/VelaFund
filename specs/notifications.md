# Notifications Specification

**Topic of Concern**: Email notification system for key events

**One-Sentence Description**: The system sends automated email notifications to users for important events like signature requests, transaction confirmations, and vesting milestones.

---

## Overview

VelaFund uses AWS SES to send transactional emails notifying users of important events. Notifications are triggered automatically by system events and sent via background jobs (Bull queue) to avoid blocking API requests.

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
- Support for template variables (user name, company name, etc.)
- Responsive design for mobile devices
- Include company branding

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

### GET /api/v1/notifications/preferences
Get user notification preferences

### PUT /api/v1/notifications/preferences
Update notification preferences

### GET /api/v1/notifications
List user's notification history

---

## Email Templates

### Template: Signature Request
```
Subject: [VelaFund] Shareholder Agreement requires your signature

Hi {{user_name}},

{{company_name}} has requested your signature on:
  Document: {{document_title}}
  Your role: {{signer_role}}

Click here to review and sign: {{signature_url}}

This request expires in 30 days.
```

### Template: Transaction Confirmed
```
Subject: [VelaFund] Transaction confirmed on blockchain

Hi {{user_name}},

Your transaction has been confirmed on Base Network:
  Type: {{transaction_type}}
  Shares: {{quantity}}
  Share Class: {{share_class}}

View on Basescan: {{blockchain_url}}
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

---

## Success Criteria

- Email delivery rate > 98%
- Delivery latency < 60 seconds from trigger event
- Zero lost notifications for critical events
- < 1% bounce rate
