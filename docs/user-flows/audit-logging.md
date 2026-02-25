# Audit Logging -- User Flows

**Feature**: Immutable audit trail with hash chain tamper detection, non-blocking async persistence via Bull queue, and read-only API for ADMIN/LEGAL roles
**Actors**: ADMIN member, LEGAL member, System (AuditInterceptor, AuditService, scheduled jobs)
**Preconditions**: User must be authenticated with a valid session and be an ACTIVE member of the company with ADMIN or LEGAL role
**Related Flows**: [Authentication](./authentication.md) (user must be logged in), [Transactions](./transactions.md) (triggers SHARES_ISSUED, SHARES_TRANSFERRED, etc.), [Shareholder Management](./shareholder-management.md) (triggers SHAREHOLDER_CREATED, SHAREHOLDER_UPDATED, SHAREHOLDER_DELETED), [Company Management](./company-management.md) (triggers COMPANY_CREATED, COMPANY_UPDATED, etc.), [Option Plans](./option-plans.md) (triggers OPTION_GRANTED, OPTION_EXERCISE_CONFIRMED, etc.), [Funding Rounds](./funding-rounds.md) (triggers ROUND_CREATED, ROUND_CLOSED, etc.)

---

## Flow Map

```
User navigates to Audit Log Viewer
  |
  +-- [authenticated + ADMIN or LEGAL role] --> GET /api/v1/companies/:companyId/audit-logs
  |     |
  |     +-- [valid filters + data exists] --> Paginated list returned (with masked actor emails)
  |     |     |
  |     |     +-- AUDIT_LOG_VIEWED event queued to Bull (non-blocking)
  |     |     |
  |     |     +-- [user clicks a row] --> GET /api/v1/companies/:companyId/audit-logs/:id
  |     |     |     |
  |     |     |     +-- [log exists in this company] --> Full detail with changes + metadata
  |     |     |     |
  |     |     |     +-- [log not found or wrong company] --> 404 AUDITLOG_NOT_FOUND
  |     |     |
  |     |     +-- [user applies filters] --> Re-fetch with action, actorId, resourceType, resourceId, dateFrom, dateTo
  |     |     |
  |     |     +-- [user changes sort] --> Re-fetch with sort param (e.g., -timestamp, action)
  |     |     |
  |     |     +-- [user changes page/limit] --> Re-fetch with pagination params
  |     |
  |     +-- [no logs match filters] --> Empty data array with meta.total=0
  |           |
  |           +-- AUDIT_LOG_VIEWED event still queued (viewing the empty result is itself audited)
  |
  +-- [authenticated + ADMIN or LEGAL role] --> Verify Hash Chain Integrity
  |     |
  |     +-- GET /api/v1/companies/:companyId/audit-logs/verify?dateFrom=...&dateTo=...
  |     |     |
  |     |     +-- [hash chain records exist for range] --> Re-compute SHA-256 hashes, compare
  |     |     |     |
  |     |     |     +-- [all match] --> status: VALID, daysInvalid: 0
  |     |     |     |
  |     |     |     +-- [some mismatch] --> status: INVALID, daysInvalid > 0
  |     |     |
  |     |     +-- [no hash chain records in range] --> status: NO_DATA, daysVerified: 0
  |     |
  |     +-- AUDIT_LOG_INTEGRITY_VERIFIED event queued to Bull (non-blocking)
  |
  +-- [authenticated + not ADMIN/LEGAL (FINANCE, INVESTOR, EMPLOYEE)] --> 403 Forbidden
  |
  +-- [authenticated + not a member of the company] --> 404 Not Found (prevents enumeration)
  |
  +-- [unauthenticated] --> 401 Unauthorized --> redirect to login


System writes audit events (async, non-blocking)
  |
  +-- [controller method has @Auditable() decorator]
  |     |
  |     +-- AuditInterceptor fires AFTER response is sent
  |     |     |
  |     |     +-- Extracts: actor (from request.user), companyId, before/after state
  |     |     +-- PII redacted via redactPii() at write time
  |     |     +-- IP redacted to /24 subnet
  |     |     +-- Event pushed to Bull 'audit-log' queue
  |     |           |
  |     |           +-- [success] --> AuditLogProcessor persists to audit_logs table
  |     |           |
  |     |           +-- [failure] --> Retry 3 times (exponential backoff: 1s, 2s, 4s)
  |     |                 |
  |     |                 +-- [retry succeeds] --> Persisted
  |     |                 +-- [all retries fail] --> Job stays in failed state for inspection
  |
  +-- [programmatic: AuditService.log() called from background job or service]
        |
        +-- Same Bull queue pipeline as above
        +-- metadata.source = 'system' (vs 'api' for interceptor-captured events)


Daily hash chain computation (scheduled job, 00:05 UTC)
  |
  +-- Queries all audit_logs from previous day, sorted by timestamp ASC
  +-- Fetches previous day's hash (or 'genesis' for first day)
  +-- Computes SHA-256: previousHash + log entries (id|timestamp|action|actorId)
  +-- Upserts AuditHashChain record: date, logCount, hash, previousHash, computedAt
```

---

## Flows

### Happy Path: View Audit Logs List

```
PRECONDITION: User is authenticated, is an ACTIVE member with ADMIN or LEGAL role
ACTOR: ADMIN or LEGAL member
TRIGGER: User navigates to the audit log viewer page

1. [UI] User navigates to the audit log page within a company
2. [Frontend] Sends GET /api/v1/companies/:companyId/audit-logs?page=1&limit=20
3. [Backend] ThrottlerGuard checks rate limit (read: 100 req/min)
   -> IF exceeded: return 429 SYS_RATE_LIMITED
4. [Backend] AuthGuard validates session (Redis lookup or Privy token fallback)
   -> IF unauthenticated: return 401, frontend redirects to login
5. [Backend] RolesGuard checks company membership and role
   -> IF not a member of the company: return 404 Not Found (prevents enumeration)
   -> IF member but role is FINANCE, INVESTOR, or EMPLOYEE: return 403 Forbidden
6. [Backend] ValidationPipe validates query parameters (ListAuditLogsDto)
   -> IF invalid (e.g., bad UUID for actorId, invalid date format): return 400 VAL_INVALID_INPUT
7. [Backend] AuditLogService.findAll queries audit_logs WHERE companyId matches
8. [Backend] Applies optional filters: action, actorId, resourceType, resourceId, dateFrom, dateTo
9. [Backend] Applies sorting (default: -timestamp, allowed: timestamp, action, actorId, resourceType)
10. [Backend] Applies pagination (skip/take based on page/limit)
11. [Backend] Joins actor relation (firstName, lastName, email) for display
12. [Backend] Masks actor email in response (e.g., "n***@domain.com")
13. [Backend] Returns 200 with paginated list in standard envelope
14. [Backend] Queues AUDIT_LOG_VIEWED event via AuditService.log() (non-blocking, does not delay response)
15. [UI] Displays audit log table with columns: Timestamp, Actor (name + masked email), Action, Resource Type, Resource ID, IP Address
16. [UI] Provides filter controls: action type dropdown, date range picker, actor search, resource type dropdown
17. [UI] Provides pagination controls (page size: 20, 50, 100)

POSTCONDITION: User sees paginated, filtered audit log list for the company
SIDE EFFECTS: AUDIT_LOG_VIEWED event queued to Bull for async persistence
```

### Happy Path: View Audit Log Detail

```
PRECONDITION: User is authenticated with ADMIN or LEGAL role, audit log entry exists in this company
ACTOR: ADMIN or LEGAL member
TRIGGER: User clicks on a row in the audit log list

1. [UI] User clicks on an audit log entry row
2. [Frontend] Sends GET /api/v1/companies/:companyId/audit-logs/:id
3. [Backend] ThrottlerGuard checks rate limit
   -> IF exceeded: return 429 SYS_RATE_LIMITED
4. [Backend] AuthGuard validates session
   -> IF unauthenticated: return 401, frontend redirects to login
5. [Backend] RolesGuard checks company membership and role
   -> IF not a member: return 404 Not Found
   -> IF wrong role: return 403 Forbidden
6. [Backend] AuditLogService.findById queries audit_logs WHERE id AND companyId match
   -> IF not found: return 404 AUDITLOG_NOT_FOUND
7. [Backend] Joins actor relation, masks email
8. [Backend] Returns 200 with full detail including changes (before/after) and metadata (IP, userAgent, requestId, source)
9. [UI] Displays expandable detail view with:
   - Full event metadata (timestamp, actor, action, resource)
   - Before/after diff of changes (PII already masked at write time)
   - Request metadata (redacted IP, user agent, request ID)

POSTCONDITION: User sees the full audit log entry with change snapshots
SIDE EFFECTS: None (detail view does not itself generate an audit event)
```

### Happy Path: Verify Hash Chain Integrity

```
PRECONDITION: User is authenticated with ADMIN or LEGAL role, daily hash chain records exist
ACTOR: ADMIN or LEGAL member
TRIGGER: User initiates hash chain verification from the admin dashboard

1. [UI] User navigates to the hash chain verification section
2. [UI] User optionally selects a date range (dateFrom, dateTo)
3. [Frontend] Sends GET /api/v1/companies/:companyId/audit-logs/verify?dateFrom=...&dateTo=...
4. [Backend] ThrottlerGuard checks rate limit
   -> IF exceeded: return 429 SYS_RATE_LIMITED
5. [Backend] AuthGuard validates session
   -> IF unauthenticated: return 401, frontend redirects to login
6. [Backend] RolesGuard checks company membership and role
   -> IF not a member: return 404 Not Found
   -> IF wrong role: return 403 Forbidden
7. [Backend] ValidationPipe validates query parameters (VerifyHashChainDto)
   -> IF dateFrom or dateTo is invalid ISO 8601: return 400 VAL_INVALID_INPUT
8. [Backend] AuditLogService.verifyHashChain queries AuditHashChain records for the date range
9. [Backend] For each day in the chain:
   a. Fetches all audit_logs for that day (ordered by timestamp ASC)
   b. Fetches the stored previousHash
   c. Re-computes SHA-256: previousHash + concatenated log entries (id|timestamp|action|actorId)
   d. Compares recomputed hash against stored hash AND log count against stored logCount
   e. If match: daysValid++; If mismatch: daysInvalid++, warning logged
10. [Backend] Returns 200 with verification result:
    - dateRange: { from, to }
    - daysVerified: total days checked
    - daysValid: days where hash matches
    - daysInvalid: days where hash does not match
    - status: "VALID" (if daysInvalid === 0) or "INVALID" (if daysInvalid > 0)
11. [Backend] Queues AUDIT_LOG_INTEGRITY_VERIFIED event via AuditService.log() with dateFrom/dateTo in metadata
12. [UI] Displays verification result:
    - VALID: green success indicator showing all days verified
    - INVALID: red warning indicator showing which days have discrepancies

POSTCONDITION: User sees the integrity status of the audit trail for the requested period
SIDE EFFECTS: AUDIT_LOG_INTEGRITY_VERIFIED event queued to Bull for async persistence
```

### Alternative Path: Verify Hash Chain with No Data

```
PRECONDITION: No hash chain records exist for the requested date range (e.g., hash chain job not yet run)
ACTOR: ADMIN or LEGAL member
TRIGGER: User requests verification for a date range with no hash chain records

1-8. Same as Happy Path: Verify Hash Chain Integrity
9. [Backend] AuditHashChain query returns zero records
10. [Backend] Returns 200 with:
    - daysVerified: 0
    - daysValid: 0
    - daysInvalid: 0
    - status: "NO_DATA"
11. [Backend] Queues AUDIT_LOG_INTEGRITY_VERIFIED event
12. [UI] Displays informational message: no hash chain data for the selected range

POSTCONDITION: User informed that no hash chain exists for the date range
SIDE EFFECTS: AUDIT_LOG_INTEGRITY_VERIFIED event queued
```

### System Flow: Automatic Event Capture via @Auditable() Decorator

```
PRECONDITION: A controller method is decorated with @Auditable(), request is processing
ACTOR: System (AuditInterceptor)
TRIGGER: Controller handler returns a response

1. [Backend] AuditInterceptor checks the handler for @Auditable() metadata
   -> IF no @Auditable() decorator: pass through without interception
2. [Backend] Request handler executes and returns response to client
3. [Backend] AuditInterceptor fires in the tap() operator (post-response, non-blocking)
4. [Backend] Extracts event data:
   - actorId: from request.user.id (null if no user)
   - actorType: USER (if user present) or SYSTEM
   - action: from decorator options (e.g., "SHAREHOLDER_CREATED")
   - resourceType: from decorator options (e.g., "Shareholder")
   - resourceId: from URL param (if resourceIdParam set) or response data.id
   - companyId: from request.params.companyId
5. [Backend] Captures change snapshots:
   - before: from request['auditBeforeState'] (set by service layer for updates/deletes), passed through redactPii()
   - after: from response data (if captureAfterState=true), passed through redactPii()
6. [Backend] Builds metadata: { ipAddress (redacted to /24), userAgent, requestId, source: "api" }
7. [Backend] Pushes event to Bull 'audit-log' queue (3 attempts, exponential backoff 1s/2s/4s)
   -> IF queue push fails: warning logged, original request is NOT affected
8. [System] Bull processor picks up the 'persist' job
9. [Backend] AuditLogProcessor creates record in audit_logs table via Prisma
10. [System] Job marked as complete

POSTCONDITION: Audit log entry persisted with PII-masked change snapshots
SIDE EFFECTS: Audit log row created in database. Original request response is unaffected by audit success or failure.
```

### System Flow: Programmatic Audit Logging

```
PRECONDITION: A background job or service needs to log an event not tied to a controller action
ACTOR: System (any service calling AuditService.log())
TRIGGER: Business event in a background job (e.g., vesting milestone, blockchain confirmation, hash chain computation)

1. [Backend] Service calls AuditService.log() with event data:
   - actorType: "SYSTEM" (or "USER"/"ADMIN" with actorId)
   - action: event type code
   - resourceType, resourceId, companyId
   - changes: optional before/after snapshots
   - metadata: optional additional context
2. [Backend] AuditService wraps event with metadata.source = "system"
3. [Backend] Pushes to Bull 'audit-log' queue (3 attempts, exponential backoff)
4. [System] Bull processor persists to audit_logs table
5. [System] Job marked as complete

POSTCONDITION: Audit log entry persisted
SIDE EFFECTS: Audit log row created in database
```

### System Flow: Daily Hash Chain Computation

```
PRECONDITION: Scheduled job triggers at 00:05 UTC daily
ACTOR: System (scheduler)
TRIGGER: Daily cron schedule

1. [System] Scheduler invokes AuditLogService.computeDailyHash(yesterdayDate)
2. [Backend] Queries all audit_logs WHERE timestamp is within yesterday (00:00:00 to 23:59:59 UTC), ordered by timestamp ASC
3. [Backend] Fetches the most recent AuditHashChain record with date < yesterday
   -> IF found: previousHash = that record's hash
   -> IF not found (first day ever): previousHash = "genesis"
4. [Backend] Computes SHA-256 hash:
   - Input: previousHash + newline + concatenated log entries (each as "id|timestamp|action|actorId")
   - Output: hex-encoded SHA-256 digest
5. [Backend] Upserts AuditHashChain record:
   - date: yesterday's date (YYYY-MM-DD)
   - logCount: number of audit logs for that day
   - hash: computed SHA-256
   - previousHash: the previous day's hash (or "genesis")
   - computedAt: now()
6. [Backend] Logs confirmation: "Daily hash chain computed for {date}: {count} logs"

POSTCONDITION: AuditHashChain record exists for yesterday with correct hash
SIDE EFFECTS: AuditHashChain row created/updated
```

### Error Path: Audit Log Not Found

```
PRECONDITION: User is authenticated with ADMIN or LEGAL role
ACTOR: ADMIN or LEGAL member
TRIGGER: User requests a specific audit log that does not exist or belongs to a different company

1. [UI] User requests detail for an audit log ID (via direct URL or stale link)
2. [Frontend] Sends GET /api/v1/companies/:companyId/audit-logs/:id
3. [Backend] AuthGuard and RolesGuard pass (user has correct role)
4. [Backend] AuditLogService.findById queries WHERE id = :id AND companyId = :companyId
5. [Backend] No matching record found
6. [Backend] Throws NotFoundException with code AUDITLOG_NOT_FOUND
7. [Backend] Returns 404 with { code: "AUDITLOG_NOT_FOUND", messageKey: "errors.auditlog.notFound" }
8. [UI] Shows error toast: "Audit log not found"

POSTCONDITION: No state change
SIDE EFFECTS: None
```

### Error Path: Unauthorized Role (Not ADMIN or LEGAL)

```
PRECONDITION: User is authenticated and is a member of the company, but has FINANCE, INVESTOR, or EMPLOYEE role
ACTOR: FINANCE, INVESTOR, or EMPLOYEE member
TRIGGER: User attempts to access any audit log endpoint

1. [Frontend] Sends GET /api/v1/companies/:companyId/audit-logs (or /verify, or /:id)
2. [Backend] AuthGuard validates session successfully
3. [Backend] RolesGuard checks company membership: user IS a member
4. [Backend] RolesGuard checks role: user role is not in ['ADMIN', 'LEGAL']
5. [Backend] Returns 403 Forbidden
6. [UI] Shows error: "Access denied"

POSTCONDITION: No state change. User cannot view audit logs.
SIDE EFFECTS: None (permission denial may be logged at warn level by RolesGuard)
```

### Error Path: Not a Company Member

```
PRECONDITION: User is authenticated but is not a member of the company identified by :companyId
ACTOR: Authenticated user who is not a member of the target company
TRIGGER: User attempts to access audit logs for a company they do not belong to

1. [Frontend] Sends GET /api/v1/companies/:companyId/audit-logs
2. [Backend] AuthGuard validates session successfully
3. [Backend] RolesGuard checks company membership: user is NOT a member
4. [Backend] Returns 404 Not Found (not 403, to prevent company enumeration)
5. [UI] Shows error: "Not found"

POSTCONDITION: No state change. User cannot determine if the company exists.
SIDE EFFECTS: None
```

### Error Path: Bull Queue Processing Failure

```
PRECONDITION: An audit event has been pushed to the Bull queue
ACTOR: System
TRIGGER: Database error or unexpected failure during audit log persistence

1. [System] Bull processor picks up the 'persist' job
2. [Backend] AuditLogProcessor.handlePersist attempts prisma.auditLog.create
3. [Backend] Create fails (e.g., database connection error, constraint violation)
4. [System] Bull retries the job: attempt 2 after 1s, attempt 3 after 2s, attempt 4 after 4s
   -> IF a retry succeeds: audit log persisted, job complete
5. [System] After 3 failed attempts (4 total including initial), job moves to failed state
6. [System] Job remains in Bull failed queue for admin inspection
7. [System] Dead letter queue monitor checks every 5 minutes:
   -> IF failed count > 10: WARNING alert to Slack
   -> IF failed count > 50: CRITICAL alert

POSTCONDITION: If all retries fail, the audit event is lost (not persisted). The original business operation that triggered the event was NOT affected.
SIDE EFFECTS: Failed job visible in Bull queue monitoring. Alert triggered if threshold exceeded.
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 3 (list) | Rate limit | Exceeds 100 read requests/min | Error | 429 SYS_RATE_LIMITED |
| 4 (all) | Auth check | No valid session/token | Error | 401 Unauthorized, redirect to login |
| 5 (all) | Company membership | Not a member of the company | Error | 404 Not Found (enumeration prevention) |
| 5 (all) | Role check | Member but role not ADMIN or LEGAL | Error | 403 Forbidden |
| 6 (list) | Input validation | Invalid query params (bad UUID, bad date) | Error | 400 VAL_INVALID_INPUT |
| 6 (detail) | Log existence | Audit log not found for id + companyId | Error | 404 AUDITLOG_NOT_FOUND |
| 7 (verify) | Input validation | Invalid ISO 8601 date format | Error | 400 VAL_INVALID_INPUT |
| 8 (verify) | Hash chain data | No AuditHashChain records in date range | Alternative | status: NO_DATA, daysVerified: 0 |
| 9d (verify) | Hash comparison | Recomputed hash matches stored hash | Happy | Day counted as valid |
| 9d (verify) | Hash comparison | Recomputed hash does not match stored hash | Warning | Day counted as invalid, warning logged |
| 1 (interceptor) | Decorator check | Handler has @Auditable() | Happy | Intercept and queue event |
| 1 (interceptor) | Decorator check | Handler has no @Auditable() | Skip | Pass through, no audit event |
| 7 (interceptor) | Queue push | Bull queue push fails | Warning | Log warning, do not affect original request |
| 3 (processor) | Persistence | DB write fails | Retry | Retry up to 3 times (exponential backoff) |
| 5 (processor) | Max retries | All retries exhausted | Error | Job stays in failed state, event lost |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| AuditLog | -- | -- | Created (timestamp, actorId, actorType, action, resourceType, resourceId, companyId, changes, metadata) | Bull processor persists event from queue |
| AuditHashChain | -- | -- | Created (date, logCount, hash, previousHash, computedAt) | Daily scheduled job computes hash chain |
| AuditHashChain | hash, logCount, computedAt | Previous values | Recomputed values | Daily scheduled job re-runs for existing date (upsert) |
| Bull Job | status | active | completed | AuditLogProcessor successfully persists event |
| Bull Job | status | active | failed (after retries) | All 3 retry attempts fail |

---

## By Role

| Action | ADMIN | LEGAL | FINANCE | INVESTOR | EMPLOYEE |
|--------|-------|-------|---------|----------|----------|
| List audit logs | Yes | Yes | 403 Forbidden | 403 Forbidden | 403 Forbidden |
| View audit log detail | Yes | Yes | 403 Forbidden | 403 Forbidden | 403 Forbidden |
| Verify hash chain | Yes | Yes | 403 Forbidden | 403 Forbidden | 403 Forbidden |
| Export audit logs | Yes (future) | Yes (future) | No access | No access | No access |

All audit log endpoints are read-only. There are no create, update, or delete operations exposed via the API. The `audit_logs` table is protected by a PostgreSQL trigger that prevents UPDATE and DELETE at the database level.

---

## PII Handling

PII is masked **at write time** by the AuditInterceptor and redactPii() utility. The audit log never contains unmasked PII:

| Field | Masking Applied | Example |
|-------|----------------|---------|
| CPF | `***.***.***-XX` (keep last 2 digits) | `***.***.***-42` |
| Email | `X***@domain.com` (keep first char + domain) | `n***@example.com` |
| IP Address | Truncated to /24 subnet | `192.168.1.0/24` |
| Bank details | `[ENCRYPTED]` placeholder | `[ENCRYPTED]` |
| Name | Stored in full (needed for audit trail reconstruction) | `Joao Silva` |
| Tokens/passwords | `[REDACTED]` -- never logged | `[REDACTED]` |

Because PII is masked at write time:
- No additional PII redaction is needed when reading audit logs.
- LGPD deletion requests do not need to modify audit logs.
- Audit log exports are safe without further PII scrubbing.

---

## Response Formats

### List Response

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
      "changes": { "before": null, "after": { "name": "Joao Silva", "type": "INDIVIDUAL" } },
      "metadata": { "ipAddress": "192.168.1.0/24", "requestId": "uuid", "source": "api" }
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

### Verify Response

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

## Cross-Feature References

**Depends on**: [Authentication](./authentication.md) -- user must be logged in to access any audit log endpoint

**Feeds into**: No downstream flows. Audit logs are a terminal consumer of events from all modules.

**Triggered by** (event sources):
- [Transactions](./transactions.md) -- SHARES_ISSUED, SHARES_TRANSFERRED, SHARES_CANCELLED, SHARES_CONVERTED, TRANSACTION_SUBMITTED, TRANSACTION_APPROVED, TRANSACTION_REJECTED, TRANSACTION_CANCELLED
- [Shareholder Management](./shareholder-management.md) -- SHAREHOLDER_CREATED, SHAREHOLDER_UPDATED, SHAREHOLDER_DELETED, SHAREHOLDER_INVITED
- [Company Management](./company-management.md) -- COMPANY_CREATED, COMPANY_UPDATED, COMPANY_STATUS_CHANGED, COMPANY_MEMBER_INVITED, COMPANY_MEMBER_ACCEPTED, COMPANY_MEMBER_REMOVED, COMPANY_ROLE_CHANGED
- [Share Class Management](./share-class-management.md) -- SHARE_CLASS_CREATED, SHARE_CLASS_UPDATED, SHARE_CLASS_DELETED via @Auditable()
- [Cap Table Management](./cap-table-management.md) -- CAP_TABLE_SNAPSHOT_CREATED, CAP_TABLE_EXPORTED via @Auditable()
- [Funding Rounds](./funding-rounds.md) -- ROUND_CREATED, ROUND_UPDATED, ROUND_OPENED, ROUND_CLOSED, ROUND_CANCELLED, COMMITMENT_CREATED, COMMITMENT_CONFIRMED, COMMITMENT_CANCELLED
- [Option Plans](./option-plans.md) -- OPTION_PLAN_CREATED, OPTION_GRANTED, OPTION_EXERCISE_REQUESTED, OPTION_EXERCISE_CONFIRMED, OPTION_FORFEITED, OPTION_VESTING_MILESTONE
- [Convertible Instruments](./convertible-instruments.md) -- CONVERTIBLE_CREATED, CONVERTIBLE_UPDATED, CONVERTIBLE_REDEEMED, CONVERTIBLE_CANCELLED, CONVERTIBLE_CONVERTED via @Auditable()
- Authentication module -- AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILED, AUTH_LOGOUT
- Self-referential -- AUDIT_LOG_VIEWED, AUDIT_LOG_INTEGRITY_VERIFIED
