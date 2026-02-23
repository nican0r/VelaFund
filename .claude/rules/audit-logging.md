# Audit Logging Specification

## Overview

This specification defines the audit logging system for the Navia platform. Audit logs provide an immutable, tamper-evident trail of all significant actions for LGPD compliance (Art. 37), due diligence, and security investigation.

**Key design decisions**:
- **Non-blocking**: Audit events are queued asynchronously via Bull. The original request is never blocked by audit log writes.
- **Immutable**: A PostgreSQL trigger prevents UPDATE and DELETE on the audit log table. A daily hash chain provides tamper detection.
- **Full snapshots**: Change tracking stores complete before/after field snapshots for entity reconstruction.

**Complements**:
- `security.md` — LGPD data processing record, PII redaction, retention policies
- `error-handling.md` — PII redaction utility used in audit log payloads
- `api-standards.md` — response envelope, pagination, filtering for audit log API

---

## Table of Contents

1. [Data Model](#data-model)
2. [Event Catalog](#event-catalog)
3. [Change Tracking](#change-tracking)
4. [Async Processing Pipeline](#async-processing-pipeline)
5. [Immutability and Tamper Detection](#immutability-and-tamper-detection)
6. [Retention and Archival](#retention-and-archival)
7. [API Endpoints](#api-endpoints)
8. [Admin UI Requirements](#admin-ui-requirements)
9. [Audit Reports and Export](#audit-reports-and-export)
10. [Performance and Scaling](#performance-and-scaling)
11. [Security and Access Control](#security-and-access-control)
12. [NestJS Implementation](#nestjs-implementation)
13. [Success Criteria](#success-criteria)

---

## Data Model

### Prisma Schema

```prisma
model AuditLog {
  id           String   @id @default(uuid())
  timestamp    DateTime @default(now()) @map("timestamp")
  actorId      String?  @map("actor_id")
  actorType    ActorType @map("actor_type")
  action       String   // e.g., "SHAREHOLDER_CREATED"
  resourceType String   @map("resource_type") // e.g., "Shareholder"
  resourceId   String?  @map("resource_id")
  companyId    String?  @map("company_id")
  changes      Json?    // { before: {}, after: {} }
  metadata     Json?    // { ipAddress, userAgent, requestId }

  // Relationships
  actor   User?    @relation(fields: [actorId], references: [id])
  company Company? @relation(fields: [companyId], references: [id])

  // Indexes
  @@index([timestamp])
  @@index([actorId])
  @@index([companyId, timestamp])
  @@index([resourceType, resourceId])
  @@index([action])
  @@index([companyId, action, timestamp])

  @@map("audit_logs")
}

enum ActorType {
  USER
  SYSTEM
  ADMIN
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Yes | Primary key |
| `timestamp` | DateTime | Yes | When the event occurred (server time, UTC) |
| `actorId` | UUID | No | User who performed the action. Null for SYSTEM events. |
| `actorType` | Enum | Yes | `USER` (human), `SYSTEM` (background job/scheduler), `ADMIN` (platform admin) |
| `action` | String | Yes | Event type code (e.g., `SHAREHOLDER_CREATED`) |
| `resourceType` | String | Yes | Entity type affected (e.g., `Shareholder`, `Transaction`, `Company`) |
| `resourceId` | UUID | No | ID of the affected entity. Null for actions without a specific resource. |
| `companyId` | UUID | No | Company scope. Null for global events (auth, KYC). |
| `changes` | JSONB | No | Before/after snapshots. See [Change Tracking](#change-tracking). |
| `metadata` | JSONB | No | Request context: IP (redacted), user agent, request ID. |

### Metadata Structure

```typescript
interface AuditMetadata {
  ipAddress: string;    // Redacted to /24 subnet (e.g., "192.168.1.0/24")
  userAgent: string;
  requestId: string;    // X-Request-Id header value
  source?: string;      // "api" | "webhook" | "scheduler" | "migration"
}
```

---

## Event Catalog

### Authentication Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `AUTH_LOGIN_SUCCESS` | User | USER | Successful login via Privy |
| `AUTH_LOGIN_FAILED` | User | SYSTEM | Failed login attempt |
| `AUTH_LOGOUT` | User | USER | User logs out |
| `AUTH_TOKEN_REFRESHED` | User | SYSTEM | Session token refreshed |
| `AUTH_ACCOUNT_LOCKED` | User | SYSTEM | Account locked after failed attempts |

**Payload for `AUTH_LOGIN_SUCCESS`**:
```json
{
  "changes": null,
  "metadata": {
    "ipAddress": "192.168.1.0/24",
    "userAgent": "Mozilla/5.0...",
    "requestId": "uuid",
    "source": "api",
    "loginMethod": "email"
  }
}
```

### KYC Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `KYC_STARTED` | KYCVerification | USER | User initiates KYC flow |
| `KYC_CPF_VERIFIED` | KYCVerification | SYSTEM | CPF validation succeeds via Verifik |
| `KYC_CPF_FAILED` | KYCVerification | SYSTEM | CPF validation fails |
| `KYC_DOCUMENT_UPLOADED` | KYCVerification | USER | Identity document uploaded |
| `KYC_FACE_VERIFIED` | KYCVerification | SYSTEM | Facial recognition passes |
| `KYC_FACE_FAILED` | KYCVerification | SYSTEM | Facial recognition fails |
| `KYC_AML_SCREENED` | KYCVerification | SYSTEM | AML screening completed |
| `KYC_APPROVED` | KYCVerification | SYSTEM | KYC verification approved |
| `KYC_REJECTED` | KYCVerification | SYSTEM | KYC verification rejected |

**Note**: KYC events never store PII in the `changes` field. Log only status transitions and verification result codes.

### Company Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `COMPANY_CREATED` | Company | USER | Company record created |
| `COMPANY_UPDATED` | Company | USER | Company details updated |
| `COMPANY_STATUS_CHANGED` | Company | USER/SYSTEM | Status transition (DRAFT → ACTIVE, etc.) |
| `COMPANY_CNPJ_VALIDATED` | Company | SYSTEM | CNPJ validated via Verifik |
| `COMPANY_CNPJ_VALIDATION_FAILED` | Company | SYSTEM | CNPJ validation failed |
| `COMPANY_CONTRACT_DEPLOYED` | Company | SYSTEM | Smart contract deployed |
| `COMPANY_MEMBER_INVITED` | CompanyMember | USER | Member invitation sent |
| `COMPANY_MEMBER_ACCEPTED` | CompanyMember | USER | Member accepts invitation |
| `COMPANY_MEMBER_REMOVED` | CompanyMember | USER | Member removed from company |
| `COMPANY_ROLE_CHANGED` | CompanyMember | USER | Member role updated |

**Payload for `COMPANY_ROLE_CHANGED`**:
```json
{
  "changes": {
    "before": { "role": "INVESTOR" },
    "after": { "role": "FINANCE" }
  },
  "metadata": {
    "ipAddress": "192.168.1.0/24",
    "userAgent": "Mozilla/5.0...",
    "requestId": "uuid",
    "source": "api",
    "targetUserId": "uuid-of-member",
    "targetEmail": "m***@example.com"
  }
}
```

### Shareholder Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `SHAREHOLDER_CREATED` | Shareholder | USER | New shareholder added |
| `SHAREHOLDER_UPDATED` | Shareholder | USER | Shareholder details updated |
| `SHAREHOLDER_DELETED` | Shareholder | USER | Shareholder removed |
| `SHAREHOLDER_INVITED` | Shareholder | USER | Shareholder invited to platform |

### Cap Table Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `CAP_TABLE_SNAPSHOT_CREATED` | CapTableSnapshot | SYSTEM | Snapshot auto-created after transaction |
| `CAP_TABLE_RECONCILIATION_RUN` | CapTableSnapshot | SYSTEM | Reconciliation job completed |
| `CAP_TABLE_DISCREPANCY_FOUND` | CapTableSnapshot | SYSTEM | On-chain/off-chain mismatch detected |
| `CAP_TABLE_EXPORTED` | CapTableSnapshot | USER | Cap table exported |

### Transaction Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `SHARES_ISSUED` | Transaction | USER | New shares issued |
| `SHARES_TRANSFERRED` | Transaction | USER | Share transfer executed |
| `SHARES_CANCELLED` | Transaction | USER | Shares cancelled/repurchased |
| `SHARES_CONVERTED` | Transaction | USER/SYSTEM | Share class conversion |
| `TRANSACTION_SUBMITTED` | Transaction | USER | Transaction created, pending approval |
| `TRANSACTION_APPROVED` | Transaction | USER | Transaction approved by admin |
| `TRANSACTION_REJECTED` | Transaction | USER | Transaction rejected |
| `TRANSACTION_CANCELLED` | Transaction | USER | Transaction cancelled |

**Payload for `SHARES_ISSUED`**:
```json
{
  "changes": {
    "before": null,
    "after": {
      "shareholderId": "uuid",
      "shareClassId": "uuid",
      "quantity": "10000",
      "pricePerShare": "1.00",
      "totalAmount": "10000.00"
    }
  }
}
```

### Funding Round Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `ROUND_CREATED` | FundingRound | USER | Funding round created |
| `ROUND_UPDATED` | FundingRound | USER | Round terms updated |
| `ROUND_OPENED` | FundingRound | USER | Round opened for commitments |
| `ROUND_CLOSED` | FundingRound | USER | Round close executed |
| `ROUND_CANCELLED` | FundingRound | USER | Round cancelled |
| `COMMITMENT_CREATED` | RoundCommitment | USER | Investor commitment added |
| `COMMITMENT_CONFIRMED` | RoundCommitment | USER | Payment confirmed |
| `COMMITMENT_CANCELLED` | RoundCommitment | USER | Commitment cancelled |

### Option Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `OPTION_PLAN_CREATED` | OptionPlan | USER | Option plan created |
| `OPTION_PLAN_UPDATED` | OptionPlan | USER | Option plan terms updated |
| `OPTION_GRANTED` | OptionGrant | USER | Options granted to employee |
| `OPTION_GRANT_UPDATED` | OptionGrant | USER | Grant terms amended |
| `OPTION_EXERCISE_REQUESTED` | OptionExerciseRequest | USER | Employee requests exercise |
| `OPTION_EXERCISE_CONFIRMED` | OptionExerciseRequest | USER | Admin confirms payment, shares issued |
| `OPTION_EXERCISE_REJECTED` | OptionExerciseRequest | USER | Exercise request rejected |
| `OPTION_FORFEITED` | OptionGrant | USER/SYSTEM | Unvested options forfeited (termination) |
| `OPTION_VESTING_MILESTONE` | OptionGrant | SYSTEM | Vesting milestone reached |

### Document Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `DOCUMENT_GENERATED` | Document | USER/SYSTEM | Document generated from template |
| `DOCUMENT_UPLOADED` | Document | USER | Document uploaded manually |
| `DOCUMENT_SIGNATURE_REQUESTED` | DocumentSigner | USER | Signature request sent |
| `DOCUMENT_SIGNED` | DocumentSigner | USER | Individual signature applied |
| `DOCUMENT_FULLY_SIGNED` | Document | SYSTEM | All required signatures collected |
| `DOCUMENT_ANCHORED` | Document | SYSTEM | Document hash anchored on-chain |

### Blockchain Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `BLOCKCHAIN_TX_SUBMITTED` | BlockchainTransaction | SYSTEM | Transaction sent to network |
| `BLOCKCHAIN_TX_CONFIRMED` | BlockchainTransaction | SYSTEM | Transaction confirmed (12 blocks) |
| `BLOCKCHAIN_TX_FAILED` | BlockchainTransaction | SYSTEM | Transaction reverted on-chain |
| `BLOCKCHAIN_SYNC_STARTED` | — | SYSTEM | Sync job started |
| `BLOCKCHAIN_SYNC_COMPLETED` | — | SYSTEM | Sync job completed |
| `BLOCKCHAIN_REORG_DETECTED` | — | SYSTEM | Block reorganization detected |

### System / LGPD Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `DATA_EXPORTED` | User | USER | User exports their personal data (LGPD portability) |
| `DATA_DELETION_REQUESTED` | User | USER | User requests account deletion |
| `DATA_DELETION_COMPLETED` | User | SYSTEM | Anonymization completed after grace period |
| `DATA_DELETION_CANCELLED` | User | USER | User cancels deletion during grace period |
| `CONSENT_GRANTED` | ConsentRecord | USER | User grants a consent |
| `CONSENT_REVOKED` | ConsentRecord | USER | User revokes a consent |
| `PERMISSION_CHANGED` | CompanyMember | USER | Fine-grained permission override changed |

---

## Change Tracking

### Before/After Snapshots

For UPDATE and DELETE operations, the `changes` field stores full before/after snapshots of all fields on the affected entity:

```typescript
interface AuditChanges {
  before: Record<string, unknown> | null; // null for CREATE
  after: Record<string, unknown> | null;  // null for DELETE
}
```

### What to Include

- All scalar fields of the entity.
- Foreign key IDs (not related entity data).
- Enum values as strings.
- Decimal values as strings (e.g., `"10000.00"` not `10000`).
- Dates as ISO 8601 strings.

### What to Exclude

- Auto-generated fields that always change (`updatedAt`).
- Encrypted field ciphertexts. Store the **field name** and `"[ENCRYPTED]"` placeholder.
- Binary data (document content, images). Store only the document ID or S3 key.
- Passwords, tokens, secrets — never logged.

### PII in Change Snapshots

PII stored in audit log `changes` follows these rules:
- CPF: Stored masked (`***.***.***-42`) — the audit log records **that** a CPF changed, not the full value.
- Email: Stored masked (`m***@example.com`).
- Name: Stored in full (needed for audit trail reconstruction — names are not high-sensitivity).
- Bank details: Stored as `"[ENCRYPTED]"`.

### Example: Shareholder Update

```json
{
  "action": "SHAREHOLDER_UPDATED",
  "resourceType": "Shareholder",
  "resourceId": "uuid",
  "changes": {
    "before": {
      "name": "João Silva",
      "email": "j***@example.com",
      "type": "INDIVIDUAL",
      "status": "ACTIVE",
      "cpf": "***.***.***-42"
    },
    "after": {
      "name": "João Oliveira Silva",
      "email": "j***@newdomain.com",
      "type": "INDIVIDUAL",
      "status": "ACTIVE",
      "cpf": "***.***.***-42"
    }
  }
}
```

---

## Async Processing Pipeline

Audit log writes are **non-blocking**. Events are queued via Bull and persisted by a background worker.

### Flow

```
API Request
    │
    ├─ Business logic executes
    ├─ Response sent to client
    └─ AuditInterceptor pushes event to Bull queue ── async ──┐
                                                               │
                                                               v
                                                    Bull Worker
                                                       │
                                                       ├─ Persist to audit_logs table
                                                       ├─ On success: job complete
                                                       └─ On failure: retry (3x, exponential backoff)
                                                              │
                                                              v (after max retries)
                                                    Dead Letter Queue
                                                       │
                                                       └─ Admin alert if DLQ > 10 entries
```

### Bull Queue Configuration

```typescript
const AUDIT_QUEUE_CONFIG = {
  name: 'audit-log',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s, 2s, 4s
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for inspection
  },
};
```

### Dead Letter Queue Monitoring

Failed jobs remain in the Bull queue with `failed` status. A scheduled job runs every 5 minutes:
- Counts jobs in `failed` state.
- If count > 10: sends a WARNING alert to Slack.
- If count > 50: sends a CRITICAL alert (PagerDuty).

Admin can inspect and retry failed jobs via the admin dashboard.

---

## Immutability and Tamper Detection

### Database-Level Immutability

A PostgreSQL trigger prevents any UPDATE or DELETE on the `audit_logs` table:

```sql
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable. UPDATE and DELETE operations are prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_modification();
```

This trigger is created via a Prisma migration and must not be removed.

### Application-Level Enforcement

The `AuditLog` Prisma model exposes only `create` and `findMany`/`findFirst`. No `update` or `delete` methods are used in application code. Code review must reject any `prisma.auditLog.update` or `prisma.auditLog.delete` calls.

### Daily Hash Chain (Tamper Detection)

A scheduled job runs at 00:05 UTC daily and computes a SHA-256 hash of the previous day's audit logs:

```typescript
interface AuditHashChain {
  id: string;
  date: string;           // YYYY-MM-DD
  logCount: number;        // Number of audit entries that day
  hash: string;            // SHA-256 of concatenated log IDs + timestamps + actions
  previousHash: string;    // Hash from the previous day (chain link)
  computedAt: Date;
}
```

**Hash computation**:
```typescript
function computeDailyHash(logs: AuditLog[], previousHash: string): string {
  const content = logs
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .map((l) => `${l.id}|${l.timestamp.toISOString()}|${l.action}|${l.actorId || 'SYSTEM'}`)
    .join('\n');

  return createHash('sha256')
    .update(previousHash + '\n' + content)
    .digest('hex');
}
```

**Verification**: An admin endpoint allows re-computing any day's hash and comparing it to the stored value. A mismatch indicates tampering.

---

## Retention and Archival

### Retention Periods

| Data Category | Active Retention | Archive | Total Retention |
|--------------|-----------------|---------|----------------|
| Financial transactions | 2 years (hot) | 8 years (cold) | 10 years |
| All other audit events | 2 years (hot) | 3 years (cold) | 5 years |
| LGPD deletion proof | 2 years (hot) | 3 years (cold) | 5 years |
| Hash chain records | Indefinite | — | Indefinite |

### Archival Process

A monthly scheduled job archives audit logs older than 2 years:

1. **Export**: Serialize the month's logs to compressed JSON (gzip).
2. **Upload**: Upload to S3 (`navia-audit-archive` bucket, SSE-S3 encryption).
3. **Verify**: Re-compute hash chain for the archived month and confirm match.
4. **Delete**: Remove archived rows from the `audit_logs` table.
5. **Log**: Create an audit event `AUDIT_LOGS_ARCHIVED` with the month, count, and S3 key.

### Archived Log Access

Archived logs can be queried via the export API. If the requested date range includes archived data, the system:
1. Checks the `audit_logs` table for recent data.
2. Fetches the relevant archive files from S3.
3. Merges and returns results.

This is handled transparently by the export endpoint (slower response for archived data).

---

## API Endpoints

### List Audit Logs

```
GET /api/v1/companies/:companyId/audit-logs
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20, max: 100) |
| `action` | string | Filter by action (e.g., `SHARES_ISSUED`) |
| `actorId` | UUID | Filter by actor |
| `resourceType` | string | Filter by resource type (e.g., `Shareholder`) |
| `resourceId` | UUID | Filter by specific resource |
| `dateFrom` | ISO 8601 | Logs after this date |
| `dateTo` | ISO 8601 | Logs before this date |
| `sort` | string | Sort field (default: `-timestamp`) |

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "timestamp": "2026-02-20T14:30:00.000Z",
      "actorId": "uuid",
      "actorType": "USER",
      "actorName": "Nelson Pereira",
      "actorEmail": "n***@example.com",
      "action": "SHAREHOLDER_CREATED",
      "resourceType": "Shareholder",
      "resourceId": "uuid",
      "changes": {
        "before": null,
        "after": {
          "name": "João Silva",
          "type": "INDIVIDUAL",
          "status": "ACTIVE"
        }
      },
      "metadata": {
        "ipAddress": "192.168.1.0/24",
        "requestId": "uuid"
      }
    }
  ],
  "meta": {
    "total": 1250,
    "page": 1,
    "limit": 20,
    "totalPages": 63
  }
}
```

### Get Audit Log Detail

```
GET /api/v1/companies/:companyId/audit-logs/:id
```

Returns a single audit log entry with full `changes` and `metadata`.

### Export Audit Logs

```
GET /api/v1/companies/:companyId/audit-logs/export
```

**Query Parameters**: Same filters as list endpoint, plus:

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `csv`, `pdf`, `xlsx` (default: `csv`) |

**Behavior**:
- For small exports (<1000 rows): synchronous download.
- For large exports (>=1000 rows): queued via Bull. Returns `202 Accepted` with a job ID. User receives an email when the export is ready for download.

**Response Headers (synchronous)**:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="audit-logs-2026-02-20.csv"
```

### Verify Hash Chain Integrity

```
GET /api/v1/companies/:companyId/audit-logs/verify
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `dateFrom` | ISO 8601 | Start date |
| `dateTo` | ISO 8601 | End date |

**Response**:

```json
{
  "success": true,
  "data": {
    "dateRange": { "from": "2026-01-01", "to": "2026-02-20" },
    "daysVerified": 51,
    "daysValid": 51,
    "daysInvalid": 0,
    "status": "VALID"
  }
}
```

---

## Admin UI Requirements

### Audit Log Viewer

A searchable, filterable table in the admin dashboard:

- **Columns**: Timestamp, Actor (name + email), Action, Resource Type, Resource ID, IP Address
- **Expandable rows**: Click to view full `changes` (before/after diff) and `metadata`
- **Filters**: Action type dropdown, date range picker, actor search, resource type dropdown
- **Search**: Free-text search on actor name/email, resource ID
- **Sorting**: By timestamp (default descending), action, actor
- **Pagination**: Standard pagination with page size selector (20, 50, 100)

### Constraints

- **Read-only**: No edit or delete buttons. No bulk actions that modify logs.
- **No inline editing**: Changes data is displayed but not editable.
- **Access control**: Only ADMIN and LEGAL roles can view audit logs (see [Security](#security-and-access-control)).

### Export Controls

- Export button with format selection (CSV, PDF, Excel).
- Date range required for exports (max 1 year per export).
- Export action itself is audit-logged (`DATA_EXPORTED`).

---

## Audit Reports and Export

### Standard Audit Report

A pre-formatted PDF report containing:

1. **Header**: Company name, report period, generation date
2. **Summary**: Total events by category (pie chart), events per day (bar chart)
3. **Activity timeline**: Chronological list of all events in the period
4. **Actor summary**: Events grouped by user with totals
5. **Footer**: Hash chain verification status for the period

### Due Diligence Audit Report

A specialized report for investor due diligence:

1. **Cap table history**: All issuance, transfer, and cancellation events
2. **Shareholder changes**: All shareholder additions, updates, removals
3. **Funding round activity**: Round creation, commitments, closes
4. **Document trail**: All documents generated and signed
5. **Blockchain verification**: On-chain transaction hashes for all recorded events

This report is included in the due diligence ZIP package (see `reports-analytics.md`).

### Export Formats

| Format | Contents | Use Case |
|--------|---------|----------|
| CSV | Raw event data, one row per event | Data analysis, spreadsheet import |
| PDF | Formatted report with charts and tables | Stakeholder review, legal compliance |
| XLSX | Structured spreadsheet with multiple tabs | Financial audit, accountant review |

---

## Performance and Scaling

### Database Partitioning

The `audit_logs` table is partitioned by month using PostgreSQL native partitioning:

```sql
CREATE TABLE audit_logs (
  id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  actor_id UUID,
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  company_id UUID,
  changes JSONB,
  metadata JSONB
) PARTITION BY RANGE (timestamp);

-- Partitions created automatically by a monthly scheduled job
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

A scheduled job creates next month's partition on the 25th of each month.

### Indexes

Applied to each partition:

```sql
CREATE INDEX idx_audit_company_ts ON audit_logs (company_id, timestamp DESC);
CREATE INDEX idx_audit_actor ON audit_logs (actor_id, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_logs (action, timestamp DESC);
```

### Query Performance Guidelines

- **Always filter by `companyId`** — partition pruning + index usage.
- **Always include a date range** — limits scanned partitions.
- **Avoid `LIKE` on JSONB `changes` field** — not indexed. Use `action` and `resourceType` filters.
- **Large exports**: Use `COPY` for CSV exports instead of row-by-row fetching.

### Expected Volume

| Scale | Events/Day | Monthly Rows | Storage/Month |
|-------|-----------|-------------|--------------|
| Small (1-5 companies) | ~200 | ~6,000 | ~5 MB |
| Medium (10-50 companies) | ~2,000 | ~60,000 | ~50 MB |
| Large (100+ companies) | ~20,000 | ~600,000 | ~500 MB |

At large scale, the 2-year hot retention keeps ~14.4M rows in the active table. Partitioning ensures queries remain fast.

---

## Security and Access Control

### Who Can View Audit Logs

| Role | Access Level |
|------|-------------|
| ADMIN | Full access to all company audit logs |
| LEGAL | Full access to all company audit logs |
| FINANCE | Read-only access (no export) |
| INVESTOR | No access |
| EMPLOYEE | No access |

### PII Handling

Audit logs contain masked PII (see [Change Tracking](#change-tracking)). The masking is applied **at write time** — the audit log never contains unmasked PII. This means:
- No additional PII redaction needed at read time.
- LGPD deletion requests do not need to modify audit logs (PII is already masked).
- Audit logs are safe to export without PII concerns.

### Audit Log Access Is Itself Logged

Viewing audit logs creates an audit event:

| Action | When |
|--------|------|
| `AUDIT_LOG_VIEWED` | User opens the audit log viewer (logged once per session, not per page) |
| `AUDIT_LOG_EXPORTED` | User exports audit logs |
| `AUDIT_LOG_INTEGRITY_VERIFIED` | Admin runs hash chain verification |

### Elevated Activity Monitoring

The following audit events trigger a real-time Slack WARNING alert:

- `DATA_EXPORTED` — user exporting personal data
- `DATA_DELETION_REQUESTED` — user requesting account deletion
- `PERMISSION_CHANGED` — permission override changed
- `COMPANY_ROLE_CHANGED` where new role is `ADMIN` — admin privilege escalation
- More than 50 audit events from a single actor in 5 minutes — unusual activity

---

## NestJS Implementation

### Audit Interceptor

Automatically captures audit events for controller actions decorated with `@Auditable()`:

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AUDITABLE_KEY, AuditableOptions } from './auditable.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    @InjectQueue('audit-log') private auditQueue: Queue,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<AuditableOptions>(
      AUDITABLE_KEY,
      context.getHandler(),
    );

    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.params.companyId;

    // Capture "before" state if this is an update/delete
    let beforeState: Record<string, unknown> | null = null;
    if (options.captureBeforeState) {
      beforeState = request['auditBeforeState']; // Set by service layer
    }

    return next.handle().pipe(
      tap(async (responseData) => {
        const event = {
          actorId: user?.id || null,
          actorType: user ? 'USER' : 'SYSTEM',
          action: options.action,
          resourceType: options.resourceType,
          resourceId: this.extractResourceId(responseData, request, options),
          companyId: companyId || null,
          changes: {
            before: beforeState,
            after: options.captureAfterState ? this.maskPii(responseData) : null,
          },
          metadata: {
            ipAddress: this.redactIp(request.ip),
            userAgent: request.headers['user-agent'] || '',
            requestId: request.headers['x-request-id'] || '',
            source: 'api',
          },
        };

        await this.auditQueue.add('persist', event, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        });
      }),
    );
  }

  private extractResourceId(
    responseData: any,
    request: any,
    options: AuditableOptions,
  ): string | null {
    if (options.resourceIdParam) {
      return request.params[options.resourceIdParam];
    }
    return responseData?.id || null;
  }

  private redactIp(ip: string): string {
    if (!ip) return 'unknown';
    const parts = ip.replace('::ffff:', '').split('.');
    if (parts.length === 4) {
      parts[3] = '0/24';
      return parts.join('.');
    }
    return ip;
  }

  private maskPii(data: any): Record<string, unknown> | null {
    if (!data || typeof data !== 'object') return null;
    // Delegate to shared PII redaction utility (see error-handling.md)
    return redactPii(data);
  }
}
```

### @Auditable() Decorator

```typescript
import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';

export interface AuditableOptions {
  action: string;                      // e.g., "SHAREHOLDER_CREATED"
  resourceType: string;                // e.g., "Shareholder"
  resourceIdParam?: string;            // URL param name for resource ID
  captureBeforeState?: boolean;        // Fetch entity before update/delete
  captureAfterState?: boolean;         // Include response data in "after"
}

export const Auditable = (options: AuditableOptions) =>
  SetMetadata(AUDITABLE_KEY, options);
```

### Controller Usage

```typescript
@Controller('api/v1/companies/:companyId/shareholders')
@RequireAuth()
export class ShareholderController {
  @Post()
  @Roles('ADMIN')
  @Auditable({
    action: 'SHAREHOLDER_CREATED',
    resourceType: 'Shareholder',
    captureAfterState: true,
  })
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateShareholderDto,
  ) {
    return this.shareholderService.create(companyId, dto);
  }

  @Put(':id')
  @Roles('ADMIN')
  @Auditable({
    action: 'SHAREHOLDER_UPDATED',
    resourceType: 'Shareholder',
    resourceIdParam: 'id',
    captureBeforeState: true,
    captureAfterState: true,
  })
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShareholderDto,
  ) {
    return this.shareholderService.update(companyId, id, dto);
  }
}
```

### Before-State Capture in Service Layer

For update/delete operations, the service fetches the current state and attaches it to the request:

```typescript
@Injectable()
export class ShareholderService {
  async update(companyId: string, id: string, dto: UpdateShareholderDto) {
    const existing = await this.prisma.shareholder.findUniqueOrThrow({
      where: { id, companyId },
    });

    // Attach before-state for audit interceptor
    const request = this.cls.get('request'); // via ClsModule (AsyncLocalStorage)
    request['auditBeforeState'] = redactPii(existing);

    return this.prisma.shareholder.update({
      where: { id },
      data: dto,
    });
  }
}
```

### Bull Queue Processor

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

@Processor('audit-log')
export class AuditLogProcessor {
  constructor(private prisma: PrismaService) {}

  @Process('persist')
  async handlePersist(job: Job) {
    const event = job.data;

    await this.prisma.auditLog.create({
      data: {
        actorId: event.actorId,
        actorType: event.actorType,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        companyId: event.companyId,
        changes: event.changes,
        metadata: event.metadata,
      },
    });
  }
}
```

### Programmatic Audit Logging (Non-Decorator)

For events not tied to a controller action (e.g., SYSTEM events from background jobs):

```typescript
@Injectable()
export class AuditService {
  constructor(@InjectQueue('audit-log') private auditQueue: Queue) {}

  async log(event: {
    actorId?: string;
    actorType: 'USER' | 'SYSTEM' | 'ADMIN';
    action: string;
    resourceType: string;
    resourceId?: string;
    companyId?: string;
    changes?: { before: any; after: any };
    metadata?: Record<string, unknown>;
  }) {
    await this.auditQueue.add('persist', {
      ...event,
      metadata: {
        source: 'system',
        ...event.metadata,
      },
    });
  }
}

// Usage in a background job
await this.auditService.log({
  actorType: 'SYSTEM',
  action: 'OPTION_VESTING_MILESTONE',
  resourceType: 'OptionGrant',
  resourceId: grant.id,
  companyId: grant.companyId,
  changes: {
    before: { vestedQuantity: '2500' },
    after: { vestedQuantity: '5000' },
  },
});
```

---

## Success Criteria

- [ ] All 50+ event types in the catalog are implemented and firing
- [ ] Audit events are non-blocking — original requests succeed regardless of audit log status
- [ ] Bull queue processes audit events with <5 second average latency
- [ ] PostgreSQL trigger prevents UPDATE/DELETE on `audit_logs` table
- [ ] Daily hash chain job runs and stores integrity hashes
- [ ] Hash chain verification endpoint confirms no tampering
- [ ] Audit log viewer shows all events with search, filter, and pagination
- [ ] CSV, PDF, and Excel exports work for date ranges up to 1 year
- [ ] Change tracking captures full before/after snapshots with PII masked
- [ ] Partitioning by month is active and new partitions are auto-created
- [ ] Archived logs (>2 years) are exported to S3 and removed from active table
- [ ] Only ADMIN and LEGAL roles can access audit logs
- [ ] Dead letter queue is monitored with alerts at 10 and 50 failed jobs
- [ ] Audit log access is itself logged (`AUDIT_LOG_VIEWED`, `AUDIT_LOG_EXPORTED`)
- [ ] Elevated activity triggers real-time Slack alerts
