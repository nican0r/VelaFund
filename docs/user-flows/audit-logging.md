# Audit Logging -- User Flows

**Feature**: Immutable, LGPD-compliant audit trail with SHA-256 hash chain tamper detection, non-blocking async persistence via Bull queue, dead letter queue monitoring, and read-only API for ADMIN/LEGAL roles
**Actors**: ADMIN member, LEGAL member, System (AuditInterceptor, AuditLogService, ScheduledTasksService, AuditLogProcessor)
**Preconditions**: User must be authenticated with a valid session and be an ACTIVE member of the company with ADMIN or LEGAL role (for API access). System actors require no authentication (background jobs, interceptors).
**Related Flows**: [Authentication](./authentication.md) (user must be logged in; AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILED, AUTH_LOGOUT events), [Transactions](./transactions.md) (triggers SHARES_ISSUED, SHARES_TRANSFERRED, etc.), [Shareholder Management](./shareholder-management.md) (triggers SHAREHOLDER_CREATED, SHAREHOLDER_UPDATED, SHAREHOLDER_DELETED), [Company Management](./company-management.md) (triggers COMPANY_CREATED, COMPANY_UPDATED, etc.), [Option Plans](./option-plans.md) (triggers OPTION_GRANTED, OPTION_EXERCISE_CONFIRMED, OPTION_GRANT_EXPIRED, etc.), [Funding Rounds](./funding-rounds.md) (triggers ROUND_CREATED, ROUND_CLOSED, etc.), [Convertible Instruments](./convertible-instruments.md) (triggers CONVERTIBLE_CREATED, CONVERTIBLE_CONVERTED, etc.), [KYC Verification](./kyc-verification.md) (triggers KYC_STARTED, KYC_CPF_VERIFIED, etc.), [Document Generation](./document-generation.md) (triggers DOCUMENT_GENERATED, DOCUMENT_UPLOADED, etc.), [Company Profile](./company-profile.md) (triggers PROFILE_CREATED, PROFILE_PUBLISHED, PROFILE_LITIGATION_FETCHED, etc.), [Company Dataroom](./company-dataroom.md) (triggers PROFILE_DOCUMENT_UPLOADED, PROFILE_DOCUMENT_DELETED), [Reports & Analytics](./reports-analytics.md) (triggers CAP_TABLE_EXPORTED, DATA_EXPORTED)

---

## Flow Map

```
User navigates to Audit Log Viewer
  |
  +-- [authenticated + ADMIN or LEGAL role] --> GET /api/v1/companies/:companyId/audit-logs
  |     |
  |     +-- [valid filters + data exists] --> Paginated list returned (with masked actor emails)
  |     |     |
  |     |     +-- AUDIT_LOG_VIEWED event queued to Bull (non-blocking, fire-and-forget)
  |     |     |
  |     |     +-- [user clicks a row] --> GET /api/v1/companies/:companyId/audit-logs/:id
  |     |     |     |
  |     |     |     +-- [log exists in this company] --> Full detail with changes + metadata
  |     |     |     |
  |     |     |     +-- [log not found or wrong company] --> 404 AUDITLOG_NOT_FOUND
  |     |     |
  |     |     +-- [user applies filters] --> Re-fetch with action, actorId, resourceType, resourceId, dateFrom, dateTo
  |     |     |
  |     |     +-- [user changes sort] --> Re-fetch with sort param (e.g., -timestamp, action, actorId, resourceType)
  |     |     |
  |     |     +-- [user changes page/limit] --> Re-fetch with pagination params (page 1-indexed, limit 1-100)
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
  |     |     |     +-- [all hashes + log counts match] --> status: VALID, daysInvalid: 0
  |     |     |     |
  |     |     |     +-- [some hash or count mismatch] --> status: INVALID, daysInvalid > 0
  |     |     |
  |     |     +-- [no hash chain records in range] --> status: NO_DATA, daysVerified: 0
  |     |     |
  |     |     +-- [no dateFrom/dateTo provided] --> Verify ALL stored hash chain records
  |     |
  |     +-- AUDIT_LOG_INTEGRITY_VERIFIED event queued with dateFrom/dateTo in metadata
  |
  +-- [authenticated + not ADMIN/LEGAL (FINANCE, INVESTOR, EMPLOYEE)] --> 404 Not Found (enumeration prevention via RolesGuard)
  |
  +-- [authenticated + not a member of the company] --> 404 Not Found (enumeration prevention via RolesGuard)
  |
  +-- [unauthenticated] --> 401 Unauthorized --> redirect to login


System writes audit events (async, non-blocking)
  |
  +-- [controller method has @Auditable() decorator] --> AuditInterceptor (67 decorated endpoints across 13 controllers)
  |     |
  |     +-- AuditInterceptor fires in tap() AFTER response is sent to client
  |     |     |
  |     |     +-- Extracts: actor (from request.user), companyId (from URL), resourceId (from URL param or response.id)
  |     |     +-- Captures before-state from request['auditBeforeState'] (set by service for updates/deletes)
  |     |     +-- Captures after-state from response data (if captureAfterState=true)
  |     |     +-- PII redacted via redactPii() at write time (both before + after snapshots)
  |     |     +-- IP redacted to /24 subnet (::ffff: prefix stripped for IPv4-mapped IPv6)
  |     |     +-- Event pushed to Bull 'audit-log' queue with metadata.source = 'api'
  |     |           |
  |     |           +-- [queue push succeeds] --> AuditLogProcessor.handlePersist() creates row in audit_logs
  |     |           |
  |     |           +-- [queue push fails] --> Warning logged, original request unaffected
  |     |           |
  |     |           +-- [persistence fails] --> Retry 3 times (exponential backoff: 1s, 2s, 4s)
  |     |                 |
  |     |                 +-- [retry succeeds] --> Persisted, job complete
  |     |                 +-- [all retries fail] --> Job stays in failed state (removeOnFail: false)
  |
  +-- [programmatic: AuditLogService.log() called directly]
  |     |
  |     +-- Used by: AuthController (AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILED, AUTH_LOGOUT)
  |     +-- Used by: TransactionService (type-specific actions: SHARES_ISSUED, SHARES_TRANSFERRED, etc.)
  |     +-- Used by: OptionPlanService (OPTION_GRANT_EXPIRED during auto-expiration)
  |     +-- Used by: CnpjValidationProcessor (COMPANY_CNPJ_VALIDATED, COMPANY_CNPJ_VALIDATION_FAILED)
  |     +-- Used by: LitigationCheckProcessor (PROFILE_LITIGATION_FETCHED, PROFILE_LITIGATION_FAILED)
  |     +-- Used by: ScheduledTasksService (DLQ_WARNING_ALERT, DLQ_CRITICAL_ALERT)
  |     +-- Used by: AuditLogController (AUDIT_LOG_VIEWED, AUDIT_LOG_INTEGRITY_VERIFIED)
  |     +-- Same Bull queue pipeline, metadata.source = 'system'
  |
  +-- [no @Auditable() decorator + no programmatic log() call] --> No audit event captured


Daily hash chain computation (ScheduledTasksService, cron: 00:05 UTC)
  |
  +-- Queries all audit_logs WHERE timestamp in yesterday (00:00:00.000Z to 23:59:59.999Z), sorted by timestamp ASC
  +-- Fetches previous day's AuditHashChain record (or 'genesis' for first day ever)
  +-- Computes SHA-256: previousHash + '\n' + concatenated log entries (id|timestamp|action|actorId)
  +-- Upserts AuditHashChain record: { date, logCount, hash, previousHash, computedAt }
  |     |
  |     +-- [success] --> Log confirmation message
  |     +-- [failure] --> Error logged, does not crash application, missing day can be backfilled


Dead Letter Queue monitoring (ScheduledTasksService, cron: every 5 minutes)
  |
  +-- Checks failed job counts across 6 Bull queues:
  |     audit-log, notification, company-setup, report-export, kyc-aml, profile-litigation
  |
  +-- [totalFailed = 0] --> No action, return silently
  |
  +-- [totalFailed >= 50] --> CRITICAL: error-level log + DLQ_CRITICAL_ALERT audit event (fire-and-forget)
  |
  +-- [totalFailed >= 10 and < 50] --> WARNING: warn-level log + DLQ_WARNING_ALERT audit event (fire-and-forget)
  |
  +-- [totalFailed > 0 and < 10] --> Debug-level log only
  |
  +-- [queue unreachable (Redis down)] --> Skip that queue, continue checking others
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
4. [Backend] AuthGuard validates session (Redis lookup via cookie, or Privy token fallback via Bearer header)
   -> IF unauthenticated: return 401, frontend redirects to login
5. [Backend] RolesGuard checks company membership and role
   -> IF not a member of the company: return 404 Not Found (prevents enumeration)
   -> IF member but role is not ADMIN or LEGAL: return 404 Not Found (prevents enumeration)
6. [Backend] ValidationPipe validates query parameters (ListAuditLogsDto extends PaginationQueryDto)
   -> IF invalid (bad UUID for actorId/resourceId, invalid ISO 8601 for dateFrom/dateTo, bad sort format): return 400 VAL_INVALID_INPUT
7. [Backend] AuditLogService.findAll builds WHERE clause: { companyId } + optional filters
8. [Backend] Applies optional filters: action (exact), actorId (exact UUID), resourceType (exact), resourceId (exact UUID), dateFrom (>=), dateTo (<=)
9. [Backend] Parses sort param (default: -timestamp; allowed: timestamp, action, actorId, resourceType; max 3 fields)
10. [Backend] Applies pagination: skip = (page-1) * limit, take = limit
11. [Backend] Executes two parallel queries: findMany (with actor join) + count (for total)
12. [Backend] Maps results: joins actor firstName/lastName into actorName, masks actor email (first char + *** + @domain)
13. [Backend] Returns 200 with standard paginated envelope { success, data, meta: { total, page, limit, totalPages } }
14. [Backend] Calls AuditLogService.log() to queue AUDIT_LOG_VIEWED event (non-blocking, fire-and-forget)
15. [UI] Displays audit log table with columns: Timestamp, Actor (name + masked email), Action, Resource Type, Resource ID, IP Address
16. [UI] Provides filter controls: action type dropdown, date range picker, actor search, resource type dropdown
17. [UI] Provides sort controls: clickable column headers
18. [UI] Provides pagination controls (page size: 20, 50, 100)

POSTCONDITION: User sees paginated, filtered audit log list scoped to their company
SIDE EFFECTS: AUDIT_LOG_VIEWED event pushed to Bull 'audit-log' queue for async persistence
```

### Happy Path: View Audit Log Detail

```
PRECONDITION: User is authenticated with ADMIN or LEGAL role, audit log entry exists in this company
ACTOR: ADMIN or LEGAL member
TRIGGER: User clicks on a row in the audit log list

1. [UI] User clicks on an audit log entry row (or navigates directly via URL)
2. [Frontend] Sends GET /api/v1/companies/:companyId/audit-logs/:id
3. [Backend] ThrottlerGuard checks rate limit (read: 100 req/min)
   -> IF exceeded: return 429 SYS_RATE_LIMITED
4. [Backend] AuthGuard validates session
   -> IF unauthenticated: return 401, frontend redirects to login
5. [Backend] RolesGuard checks company membership and role
   -> IF not a member or wrong role: return 404 Not Found
6. [Backend] AuditLogService.findById queries audit_logs WHERE id = :id AND companyId = :companyId (with actor join)
   -> IF not found: throw NotFoundException('auditLog', id) -> return 404 { code: "AUDITLOG_NOT_FOUND", messageKey: "errors.auditlog.notFound" }
7. [Backend] Maps result: actorName from firstName/lastName, masks email
8. [Backend] Returns 200 with full detail including:
   - changes: { before, after } -- PII already masked at write time
   - metadata: { ipAddress (redacted /24), userAgent, requestId, source }
9. [UI] Displays expandable detail view with:
   - Full event metadata (timestamp, actor, action, resource type/id)
   - Before/after diff of changes (side-by-side or inline)
   - Request metadata (redacted IP, user agent, request ID, source)

POSTCONDITION: User sees the full audit log entry with change snapshots
SIDE EFFECTS: None (detail view does not generate a separate audit event)
```

### Happy Path: Verify Hash Chain Integrity

```
PRECONDITION: User is authenticated with ADMIN or LEGAL role, daily hash chain records exist for the requested range
ACTOR: ADMIN or LEGAL member
TRIGGER: User initiates hash chain verification from the audit log page

1. [UI] User navigates to the hash chain verification section
2. [UI] User optionally selects a date range (dateFrom, dateTo in ISO 8601)
3. [Frontend] Sends GET /api/v1/companies/:companyId/audit-logs/verify?dateFrom=...&dateTo=...
4. [Backend] ThrottlerGuard checks rate limit (read: 100 req/min)
   -> IF exceeded: return 429 SYS_RATE_LIMITED
5. [Backend] AuthGuard validates session
   -> IF unauthenticated: return 401, frontend redirects to login
6. [Backend] RolesGuard checks company membership and role
   -> IF not a member or wrong role: return 404 Not Found
7. [Backend] ValidationPipe validates query parameters (VerifyHashChainDto)
   -> IF dateFrom or dateTo is invalid ISO 8601: return 400 VAL_INVALID_INPUT
8. [Backend] AuditLogService.verifyHashChain queries AuditHashChain records for the date range (ordered by date ASC)
   -> IF no dateFrom/dateTo provided: queries ALL hash chain records
9. [Backend] For each day in the chain:
   a. Fetches all audit_logs for that day (timestamp 00:00:00.000Z to 23:59:59.999Z, ordered by timestamp ASC)
   b. Reads the stored previousHash from the AuditHashChain record
   c. Re-computes SHA-256: previousHash + '\n' + concatenated entries (id|isoTimestamp|action|actorId or 'SYSTEM')
   d. Compares recomputed hash against stored hash AND log count against stored logCount
   e. If both match: daysValid++
   f. If either mismatches: daysInvalid++, warning logged with expected vs computed hash
10. [Backend] Returns 200 with verification result:
    - dateRange: { from: first chain date, to: last chain date }
    - daysVerified: total days checked
    - daysValid: days where hash and count match
    - daysInvalid: days where hash or count does not match
    - status: "VALID" (if daysInvalid === 0) or "INVALID" (if daysInvalid > 0)
11. [Backend] Calls AuditLogService.log() to queue AUDIT_LOG_INTEGRITY_VERIFIED event with { dateFrom, dateTo } in metadata
12. [UI] Displays verification result:
    - VALID: green success indicator showing all days verified with count
    - INVALID: red warning indicator showing number of invalid days (potential tampering)

POSTCONDITION: User sees the integrity status of the audit trail for the requested period
SIDE EFFECTS: AUDIT_LOG_INTEGRITY_VERIFIED event pushed to Bull 'audit-log' queue for async persistence
```

### Alternative Path: Verify Hash Chain with No Data

```
PRECONDITION: No hash chain records exist for the requested date range (e.g., hash chain cron not yet run, or date range predates system deployment)
ACTOR: ADMIN or LEGAL member
TRIGGER: User requests verification for a date range with no hash chain records

1-8. Same as Happy Path: Verify Hash Chain Integrity
9. [Backend] AuditHashChain query returns zero records
10. [Backend] Returns 200 with:
    - dateRange: { from: dateFrom or null, to: dateTo or null }
    - daysVerified: 0
    - daysValid: 0
    - daysInvalid: 0
    - status: "NO_DATA"
11. [Backend] Queues AUDIT_LOG_INTEGRITY_VERIFIED event
12. [UI] Displays informational message: no hash chain data available for the selected range

POSTCONDITION: User informed that no hash chain records exist. This is not an error -- it means the cron job has not yet run for those dates.
SIDE EFFECTS: AUDIT_LOG_INTEGRITY_VERIFIED event queued
```

### System Flow: Automatic Event Capture via @Auditable() Decorator

```
PRECONDITION: A controller method is decorated with @Auditable(), a valid HTTP request is processing
ACTOR: System (AuditInterceptor, registered as APP_INTERCEPTOR globally)
TRIGGER: Controller handler completes and returns a response

1. [Backend] AuditInterceptor.intercept() reads @Auditable() metadata from the handler via Reflector
   -> IF no @Auditable() decorator: call next.handle() without interception, STOP
2. [Backend] Extracts request context: user (from request.user), companyId (from request.params.companyId)
3. [Backend] next.handle() executes -- the actual controller handler runs and response is returned to client
4. [Backend] tap() operator fires AFTER the response Observable emits (client already received the response)
5. [Backend] Inside tap(), within a try/catch:
   a. Captures before-state: if captureBeforeState=true, reads request['auditBeforeState'] and passes through redactPii()
   b. Captures after-state: if captureAfterState=true, extracts data from response (unwraps envelope if needed) and passes through redactPii()
   c. Extracts resourceId: from URL param (if resourceIdParam set) OR from response.id OR from response.data.id
   d. Builds event object:
      - actorId: user.id or null
      - actorType: 'USER' if user present, 'SYSTEM' otherwise
      - action: from decorator (e.g., 'SHAREHOLDER_CREATED')
      - resourceType: from decorator (e.g., 'Shareholder')
      - resourceId: extracted above
      - companyId: from URL params
      - changes: { before: redacted before-state, after: redacted after-state } or null
      - metadata: { ipAddress (redacted /24), userAgent, requestId (X-Request-Id header), source: 'api' }
6. [Backend] Pushes event to Bull 'audit-log' queue (attempts: 3, exponential backoff: 1s base)
   -> IF queue push fails: logger.warn(), original response is NOT affected
7. [System] Bull worker AuditLogProcessor.handlePersist() picks up the job
8. [Backend] Processor calls prisma.auditLog.create() with the event data
   -> IF create succeeds: job marked complete (removeOnComplete: true, job removed from queue)
   -> IF create fails: Bull retries (attempt 2 after 1s, attempt 3 after 2s, attempt 4 after 4s)
9. [System] After max retries exhausted: job stays in 'failed' state (removeOnFail: false) for admin inspection

POSTCONDITION: Audit log entry persisted in audit_logs table with PII-masked change snapshots
SIDE EFFECTS: One row created in audit_logs table. Original HTTP request/response is completely unaffected by audit success or failure.
```

### System Flow: Programmatic Audit Logging

```
PRECONDITION: A background job, scheduled task, or service needs to log an event not captured by @Auditable()
ACTOR: System (any service calling AuditLogService.log())
TRIGGER: Business event in a background job, auth event in controller, or DLQ alert in scheduled task

1. [Backend] Service calls AuditLogService.log() with event data:
   - actorId: optional (null for SYSTEM events)
   - actorType: 'SYSTEM' | 'USER' | 'ADMIN'
   - action: event type code (e.g., 'AUTH_LOGIN_SUCCESS', 'OPTION_GRANT_EXPIRED', 'DLQ_WARNING_ALERT')
   - resourceType: entity type (e.g., 'User', 'OptionGrant', 'BullQueue')
   - resourceId: optional entity ID
   - companyId: optional company scope
   - changes: optional { before, after } snapshots
   - metadata: optional additional context (e.g., { loginMethod, ipAddress, threshold, queues })
2. [Backend] AuditLogService.log() wraps event, adds metadata.source = 'system' as default
3. [Backend] Pushes to Bull 'audit-log' queue (attempts: 3, exponential backoff: 1s base)
4. [System] Bull processor persists to audit_logs table
5. [System] Job marked as complete

Current programmatic log() callers:
- AuthController: AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILED, AUTH_LOGOUT (with masked IP + email)
- TransactionService.confirm(): type-specific actions (SHARES_ISSUED, SHARES_TRANSFERRED, SHARES_CANCELLED, SHARES_CONVERTED, SHARES_SPLIT)
- OptionPlanService.expireStaleGrants(): OPTION_GRANT_EXPIRED
- CnpjValidationProcessor: COMPANY_CNPJ_VALIDATED, COMPANY_CNPJ_VALIDATION_FAILED
- LitigationCheckProcessor: PROFILE_LITIGATION_FETCHED, PROFILE_LITIGATION_FAILED
- ScheduledTasksService.monitorDeadLetterQueues(): DLQ_WARNING_ALERT, DLQ_CRITICAL_ALERT
- AuditLogController: AUDIT_LOG_VIEWED, AUDIT_LOG_INTEGRITY_VERIFIED

POSTCONDITION: Audit log entry persisted
SIDE EFFECTS: One row created in audit_logs table
```

### System Flow: Daily Hash Chain Computation

```
PRECONDITION: ScheduleModule is registered, ScheduledTasksService is instantiated
ACTOR: System (ScheduledTasksService via @nestjs/schedule)
TRIGGER: Cron schedule: 00:05 UTC daily (cron expression: '0 5 0 * * *', name: 'audit-hash-chain', timeZone: 'UTC')

1. [System] @Cron fires ScheduledTasksService.computeDailyAuditHashChain()
2. [Backend] Computes yesterday's date as YYYY-MM-DD string in UTC
3. [Backend] Logs: "Starting daily audit hash chain computation for {date}"
4. [Backend] Calls AuditLogService.computeDailyHash(date)
5. [Backend] Queries all audit_logs WHERE timestamp >= '{date}T00:00:00.000Z' AND timestamp <= '{date}T23:59:59.999Z', ordered by timestamp ASC
6. [Backend] Fetches the most recent AuditHashChain record WHERE date < {date} (ordered date DESC, limit 1)
   -> IF found: previousHash = that record's hash
   -> IF not found (very first day): previousHash = 'genesis'
7. [Backend] Computes SHA-256 hash:
   - Concatenates each log as: "id|isoTimestamp|action|actorId" (actorId replaced with 'SYSTEM' if null)
   - Joins all log lines with '\n'
   - Input to SHA-256: previousHash + '\n' + concatenated log content
   - Output: hex-encoded SHA-256 digest
8. [Backend] Upserts AuditHashChain record:
   - date: yesterday (YYYY-MM-DD), unique key
   - logCount: number of audit logs for that day
   - hash: computed SHA-256 hex string
   - previousHash: the previous day's hash (or 'genesis')
   - computedAt: current timestamp
9. [Backend] Logs: "Daily hash chain computed for {date}: {count} logs, hash={first 16 chars}..."
   -> IF any step fails: error logged with stack trace, application continues running

POSTCONDITION: AuditHashChain record exists for yesterday with cryptographic hash
SIDE EFFECTS: One AuditHashChain row created or updated (upsert)
```

### System Flow: Dead Letter Queue Monitoring

```
PRECONDITION: ScheduleModule is registered, all 6 Bull queues are injected into ScheduledTasksService
ACTOR: System (ScheduledTasksService)
TRIGGER: Cron schedule: every 5 minutes (cron expression: '0 */5 * * * *', name: 'dlq-monitoring', timeZone: 'UTC')

1. [System] @Cron fires ScheduledTasksService.monitorDeadLetterQueues()
2. [Backend] Iterates over 6 monitored queues: audit-log, notification, company-setup, report-export, kyc-aml, profile-litigation
3. [Backend] For each queue: calls queue.getFailedCount()
   -> IF queue unreachable (Redis down): skip this queue, log debug message, continue
4. [Backend] Sums totalFailed across all reachable queues
5. [Backend] Decision based on totalFailed:
   -> IF totalFailed = 0: return silently (no log, no action)
   -> IF totalFailed >= 50 (CRITICAL threshold):
      a. logger.error() with total + per-queue breakdown (e.g., "audit-log=3, notification=48")
      b. Queues DLQ_CRITICAL_ALERT audit event via AuditLogService.log() (fire-and-forget .catch(() => {}))
         - metadata: { totalFailed, threshold: 50, queues: { audit-log: 3, notification: 48, ... } }
   -> IF totalFailed >= 10 and < 50 (WARNING threshold):
      a. logger.warn() with total + per-queue breakdown
      b. Queues DLQ_WARNING_ALERT audit event via AuditLogService.log() (fire-and-forget .catch(() => {}))
         - metadata: { totalFailed, threshold: 10, queues: { ... } }
   -> IF totalFailed > 0 and < 10:
      a. logger.debug() with total + per-queue breakdown
6. [Backend] If monitorDeadLetterQueues() itself throws: error logged, application continues

POSTCONDITION: Admin is alerted via logs (and future Slack/PagerDuty integration) if failed job count exceeds thresholds
SIDE EFFECTS: DLQ_WARNING_ALERT or DLQ_CRITICAL_ALERT audit event may be created. Failed jobs remain in Bull queues for manual inspection and retry.
```

### Error Path: Audit Log Not Found

```
PRECONDITION: User is authenticated with ADMIN or LEGAL role
ACTOR: ADMIN or LEGAL member
TRIGGER: User requests a specific audit log that does not exist or belongs to a different company

1. [UI] User requests detail for an audit log ID (via direct URL or stale link)
2. [Frontend] Sends GET /api/v1/companies/:companyId/audit-logs/:id
3. [Backend] AuthGuard and RolesGuard pass (user has correct role in correct company)
4. [Backend] AuditLogService.findById queries WHERE id = :id AND companyId = :companyId
5. [Backend] No matching record found (log does not exist, or exists in a different company)
6. [Backend] Throws NotFoundException('auditLog', id)
7. [Backend] GlobalExceptionFilter returns 404 with:
   { success: false, error: { code: "AUDITLOG_NOT_FOUND", messageKey: "errors.auditlog.notFound", details: { id } } }
8. [UI] Shows error toast: "Registro de auditoria nao encontrado" (PT-BR) or "Audit log not found" (EN)

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
5. [Backend] RolesGuard returns 404 Not Found (not 403, to prevent company and feature enumeration per security.md)
6. [UI] Shows error: "Not found"

POSTCONDITION: No state change. User cannot view audit logs.
SIDE EFFECTS: Permission denial may be logged at warn level by RolesGuard
```

### Error Path: Not a Company Member

```
PRECONDITION: User is authenticated but is not a member of the company identified by :companyId
ACTOR: Authenticated user who is not a member of the target company
TRIGGER: User attempts to access audit logs for a company they do not belong to

1. [Frontend] Sends GET /api/v1/companies/:companyId/audit-logs
2. [Backend] AuthGuard validates session successfully
3. [Backend] RolesGuard checks company membership: user is NOT a member
4. [Backend] RolesGuard returns 404 Not Found (not 403, to prevent company enumeration)
5. [UI] Shows error: "Not found"

POSTCONDITION: No state change. User cannot determine if the company exists.
SIDE EFFECTS: None
```

### Error Path: Bull Queue Processing Failure

```
PRECONDITION: An audit event has been pushed to the Bull 'audit-log' queue
ACTOR: System
TRIGGER: Database error or unexpected failure during audit log persistence

1. [System] Bull processor picks up the 'persist' job
2. [Backend] AuditLogProcessor.handlePersist() attempts prisma.auditLog.create()
3. [Backend] Create fails (e.g., database connection error, constraint violation, Prisma error)
4. [System] Bull retries the job:
   - Attempt 2: after 1 second
   - Attempt 3: after 2 seconds (exponential)
   - Attempt 4: after 4 seconds (exponential)
   -> IF a retry succeeds: audit log persisted, job marked complete, job removed from queue
5. [System] After 3 failed retries (4 total including initial): job moves to 'failed' state
6. [System] Job remains in Bull failed queue (removeOnFail: false) for admin inspection
7. [System] Dead letter queue monitor (every 5 minutes) checks failed count:
   -> IF failed count across all queues > 10: WARNING alert logged + DLQ_WARNING_ALERT audit event
   -> IF failed count across all queues > 50: CRITICAL alert logged + DLQ_CRITICAL_ALERT audit event

POSTCONDITION: If all retries fail, the audit event is lost (not persisted). The original business operation that triggered the event was NOT affected -- the user received their response before audit persistence was attempted.
SIDE EFFECTS: Failed job visible in Bull queue monitoring. DLQ alerts triggered if thresholds exceeded. Admin can manually inspect and retry failed jobs.
```

### Error Path: Hash Chain Cron Job Failure

```
PRECONDITION: Daily hash chain cron fires at 00:05 UTC
ACTOR: System
TRIGGER: Database error or unexpected failure during hash computation

1. [System] @Cron fires computeDailyAuditHashChain()
2. [Backend] Calls AuditLogService.computeDailyHash(yesterday)
3. [Backend] Query or upsert fails (e.g., database down, disk full)
4. [Backend] Error caught in try/catch: logger.error() with message + stack trace
5. [System] Application continues running. The cron job does not crash the process.
6. [System] Missing hash chain day can be detected via the verify endpoint (the gap will show in NO_DATA or reduced daysVerified)

POSTCONDITION: No AuditHashChain record for yesterday. The gap is detectable but not self-healing.
SIDE EFFECTS: Error logged. No alert beyond the log (DLQ monitor does not cover cron failures directly).
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 3 (list) | Rate limit | Exceeds 100 read requests/min | Error | 429 SYS_RATE_LIMITED with Retry-After header |
| 4 (all) | Auth check | No valid session or token | Error | 401 Unauthorized, frontend redirects to login |
| 5 (all) | Company membership | Not a member of the company | Error | 404 Not Found (enumeration prevention) |
| 5 (all) | Role check | Member but role not ADMIN or LEGAL | Error | 404 Not Found (enumeration prevention) |
| 6 (list) | Input validation | Invalid query params (bad UUID, bad date, bad sort format) | Error | 400 VAL_INVALID_INPUT with validationErrors |
| 6 (detail) | Log existence | Audit log not found for id + companyId | Error | 404 AUDITLOG_NOT_FOUND |
| 7 (verify) | Input validation | Invalid ISO 8601 dateFrom or dateTo | Error | 400 VAL_INVALID_INPUT |
| 8 (verify) | Hash chain data | No AuditHashChain records in date range | Alternative | status: NO_DATA, daysVerified: 0 |
| 9d (verify) | Hash + count | Recomputed hash matches stored hash AND logCount matches | Happy | Day counted as valid |
| 9d (verify) | Hash + count | Recomputed hash or logCount does not match | Warning | Day counted as invalid, warning logged |
| 1 (interceptor) | Decorator check | Handler has @Auditable() | Happy | Intercept and queue event after response |
| 1 (interceptor) | Decorator check | Handler has no @Auditable() | Skip | Pass through, no audit event |
| 6 (interceptor) | Queue push | Bull queue push fails | Warning | logger.warn(), original request unaffected |
| 8 (processor) | Persistence | prisma.auditLog.create() fails | Retry | Retry up to 3 more times (exponential backoff) |
| 9 (processor) | Max retries | All retries exhausted | Error | Job stays in failed state, audit event lost |
| 5 (DLQ) | Failed count | totalFailed >= 50 | Critical | Error-level log + DLQ_CRITICAL_ALERT audit event |
| 5 (DLQ) | Failed count | totalFailed >= 10 and < 50 | Warning | Warn-level log + DLQ_WARNING_ALERT audit event |
| 5 (DLQ) | Failed count | totalFailed > 0 and < 10 | Info | Debug-level log only |
| 5 (DLQ) | Failed count | totalFailed = 0 | Skip | No action, silent return |
| 3 (DLQ) | Queue reachability | Redis down for a queue | Skip | Debug log, continue checking other queues |

---

## State Transitions

Audit logs are **append-only** and **immutable**. There are no status fields or lifecycle transitions on the AuditLog entity itself. The PostgreSQL trigger `audit_logs_immutable` prevents UPDATE and DELETE at the database level.

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| AuditLog | -- | (does not exist) | Created (id, timestamp, actorId, actorType, action, resourceType, resourceId, companyId, changes, metadata) | AuditLogProcessor.handlePersist() processes Bull job |
| AuditHashChain | -- | (does not exist) | Created (date, logCount, hash, previousHash, computedAt) | Daily cron job computes hash for first time for that date |
| AuditHashChain | hash, logCount, computedAt | Previous values | Recomputed values | Daily cron job re-runs for an existing date (upsert) |
| Bull Job | status | waiting | active | Bull worker picks up job |
| Bull Job | status | active | completed | AuditLogProcessor successfully persists event |
| Bull Job | status | active | failed | Attempt fails, queued for retry |
| Bull Job | status | failed (retriable) | active | Bull retries the job |
| Bull Job | status | active | failed (terminal) | All 3 retry attempts fail, job stays in failed state |

---

## By Role

| Action | ADMIN | LEGAL | FINANCE | INVESTOR | EMPLOYEE |
|--------|-------|-------|---------|----------|----------|
| List audit logs (paginated, filtered) | Yes | Yes | 404 | 404 | 404 |
| View audit log detail | Yes | Yes | 404 | 404 | 404 |
| Verify hash chain integrity | Yes | Yes | 404 | 404 | 404 |
| Export audit logs (future) | Yes | Yes | No access | No access | No access |
| Create/update/delete audit logs | Impossible (no API endpoint, DB trigger prevents) | Impossible | Impossible | Impossible | Impossible |

All audit log API endpoints are **read-only**. There are no create, update, or delete operations exposed via the API. The `audit_logs` table is protected by a PostgreSQL trigger (`audit_logs_immutable`) that raises an exception on any UPDATE or DELETE attempt at the database level, providing defense-in-depth beyond application-level enforcement.

---

## PII Handling

PII is masked **at write time** by the AuditInterceptor (via `redactPii()` utility from `common/utils/redact-pii.ts`) and by programmatic callers (e.g., `maskIp()`, `maskEmail()` in AuthController). The audit log **never contains unmasked PII**.

| Field | Masking Applied | Example |
|-------|----------------|---------|
| CPF | `***.***.***-XX` (keep last 2 digits) | `***.***.***-42` |
| CNPJ | `**.***.****/****-XX` (keep last 2 digits) | `**.***.****/****-90` |
| Email | `X***@domain.com` (keep first char + domain) | `n***@example.com` |
| IP Address | Truncated to /24 subnet, `::ffff:` prefix stripped | `192.168.1.0/24` |
| Wallet address | First 6 + last 4 chars | `0x1234...abcd` |
| Bank details | `[ENCRYPTED]` placeholder | `[ENCRYPTED]` |
| Name | Stored in full (needed for audit trail reconstruction) | `Joao Silva` |
| Tokens/passwords | `[REDACTED]` -- never logged | `[REDACTED]` |

Because PII is masked at write time:
- No additional PII redaction is needed when reading or exporting audit logs
- LGPD deletion requests do not need to modify audit logs (PII is already masked)
- Audit log exports are safe to share without further PII scrubbing
- The `redactPii()` utility uses field-name-based detection (cpf, cnpj, email, wallet, ip, password, token, secret, bankAccount)

---

## Response Formats

### List Response (GET /audit-logs)

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2026-02-20T14:30:00.000Z",
      "actorId": "660e8400-e29b-41d4-a716-446655440000",
      "actorType": "USER",
      "actorName": "Nelson Pereira",
      "actorEmail": "n***@example.com",
      "action": "SHAREHOLDER_CREATED",
      "resourceType": "Shareholder",
      "resourceId": "770e8400-e29b-41d4-a716-446655440000",
      "changes": {
        "before": null,
        "after": {
          "name": "Joao Silva",
          "type": "INDIVIDUAL",
          "status": "ACTIVE",
          "email": "j***@example.com",
          "cpf": "***.***.***-42"
        }
      },
      "metadata": {
        "ipAddress": "192.168.1.0/24",
        "userAgent": "Mozilla/5.0...",
        "requestId": "880e8400-e29b-41d4-a716-446655440000",
        "source": "api"
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

### Detail Response (GET /audit-logs/:id)

Same structure as a single item in the list response, without the `meta` pagination wrapper.

### Verify Response (GET /audit-logs/verify)

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

### Verify Response -- Invalid (tampering detected)

```json
{
  "success": true,
  "data": {
    "dateRange": { "from": "2026-01-01", "to": "2026-02-20" },
    "daysVerified": 51,
    "daysValid": 49,
    "daysInvalid": 2,
    "status": "INVALID"
  }
}
```

### Verify Response -- No Data

```json
{
  "success": true,
  "data": {
    "dateRange": { "from": "2025-01-01", "to": "2025-06-30" },
    "daysVerified": 0,
    "daysValid": 0,
    "daysInvalid": 0,
    "status": "NO_DATA"
  }
}
```

---

## Query Parameters Reference

### List Endpoint (GET /audit-logs)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number (1-indexed, min: 1) |
| limit | integer | No | 20 | Items per page (min: 1, max: 100) |
| action | string | No | -- | Filter by exact action code (e.g., SHAREHOLDER_CREATED) |
| actorId | UUID | No | -- | Filter by exact actor UUID |
| resourceType | string | No | -- | Filter by exact resource type (e.g., Shareholder, Transaction) |
| resourceId | UUID | No | -- | Filter by exact resource UUID |
| dateFrom | ISO 8601 | No | -- | Logs with timestamp >= this date |
| dateTo | ISO 8601 | No | -- | Logs with timestamp <= this date |
| sort | string | No | -timestamp | Sort field(s), prefix - for desc. Allowed: timestamp, action, actorId, resourceType. Max 3 fields comma-separated. |

### Verify Endpoint (GET /audit-logs/verify)

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| dateFrom | ISO 8601 | No | -- | Start of verification range |
| dateTo | ISO 8601 | No | -- | End of verification range |

If neither dateFrom nor dateTo is provided, all stored hash chain records are verified.

---

## @Auditable() Decorator Coverage

The AuditInterceptor captures events from 67 decorated endpoints across 13 controllers:

| Controller | @Auditable() Count | Example Actions |
|------------|--------------------|-----------------|
| CompanyProfileController | 8 | PROFILE_CREATED, PROFILE_UPDATED, PROFILE_PUBLISHED, PROFILE_UNPUBLISHED, PROFILE_ARCHIVED, PROFILE_SLUG_UPDATED, PROFILE_METRICS_UPDATED, PROFILE_TEAM_UPDATED |
| FundingRoundController | 8 | ROUND_CREATED, ROUND_UPDATED, ROUND_OPENED, ROUND_CLOSED, ROUND_CANCELLED, COMMITMENT_CREATED, COMMITMENT_CONFIRMED, COMMITMENT_CANCELLED |
| OptionPlanController | 8 | OPTION_PLAN_CREATED, OPTION_PLAN_UPDATED, OPTION_PLAN_CLOSED, OPTION_GRANTED, OPTION_GRANT_UPDATED, OPTION_GRANT_CANCELLED, OPTION_EXERCISE_REQUESTED, OPTION_EXERCISE_CANCELLED |
| DocumentController | 6 | DOCUMENT_GENERATED, DOCUMENT_UPLOADED, DOCUMENT_UPDATED, DOCUMENT_DRAFT_CREATED, DOCUMENT_GENERATED_FROM_DRAFT, DOCUMENT_DELETED |
| CompanyController | 5 | COMPANY_CREATED, COMPANY_UPDATED, COMPANY_STATUS_CHANGED, COMPANY_DISSOLVED, COMPANY_CNPJ_RETRY |
| ConvertibleController | 5 | CONVERTIBLE_CREATED, CONVERTIBLE_UPDATED, CONVERTIBLE_REDEEMED, CONVERTIBLE_CANCELLED, CONVERTIBLE_CONVERTED |
| MemberController | 4 | COMPANY_MEMBER_INVITED, COMPANY_MEMBER_REMOVED, COMPANY_ROLE_CHANGED, COMPANY_PERMISSION_CHANGED |
| TransactionController | 4 | TRANSACTION_SUBMITTED, TRANSACTION_APPROVED, TRANSACTION_CONFIRMED, TRANSACTION_CANCELLED |
| ShareholderController | 4 | SHAREHOLDER_CREATED, SHAREHOLDER_UPDATED, SHAREHOLDER_DELETED, SHAREHOLDER_BENEFICIAL_OWNERS_UPDATED |
| KycController | 4 | KYC_STARTED, KYC_CPF_VERIFIED, KYC_DOCUMENT_UPLOADED, KYC_FACE_VERIFIED |
| ShareClassController | 3 | SHARE_CLASS_CREATED, SHARE_CLASS_UPDATED, SHARE_CLASS_DELETED |
| ProfileDocumentController | 2 | PROFILE_DOCUMENT_UPLOADED, PROFILE_DOCUMENT_DELETED |
| CapTableController | 2 | CAP_TABLE_SNAPSHOT_CREATED, CAP_TABLE_EXPORTED |
| ReportsController | 2 | CAP_TABLE_EXPORTED, DATA_EXPORTED |
| InvitationController | 1 | COMPANY_MEMBER_ACCEPTED |

Additionally, 7 services/processors use programmatic AuditLogService.log() for events that occur outside controller request context (see "System Flow: Programmatic Audit Logging" above).

---

## Cross-Feature References

**Depends on**: [Authentication](./authentication.md) -- user must be logged in to access any audit log endpoint

**Feeds into**: No downstream flows. Audit logs are a terminal consumer of events from all other modules.

**Triggered by** (event sources -- every state-changing action across the platform):
- [Authentication](./authentication.md) -- AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILED, AUTH_LOGOUT (programmatic)
- [Company Management](./company-management.md) -- COMPANY_CREATED, COMPANY_UPDATED, COMPANY_STATUS_CHANGED, COMPANY_DISSOLVED, COMPANY_CNPJ_RETRY (@Auditable), COMPANY_CNPJ_VALIDATED, COMPANY_CNPJ_VALIDATION_FAILED (programmatic from CnpjValidationProcessor)
- [Member Invitation](./member-invitation.md) -- COMPANY_MEMBER_INVITED, COMPANY_MEMBER_ACCEPTED, COMPANY_MEMBER_REMOVED, COMPANY_ROLE_CHANGED, COMPANY_PERMISSION_CHANGED (@Auditable)
- [Share Class Management](./share-class-management.md) -- SHARE_CLASS_CREATED, SHARE_CLASS_UPDATED, SHARE_CLASS_DELETED (@Auditable)
- [Shareholder Management](./shareholder-management.md) -- SHAREHOLDER_CREATED, SHAREHOLDER_UPDATED, SHAREHOLDER_DELETED, SHAREHOLDER_BENEFICIAL_OWNERS_UPDATED (@Auditable)
- [Cap Table Management](./cap-table-management.md) -- CAP_TABLE_SNAPSHOT_CREATED, CAP_TABLE_EXPORTED (@Auditable)
- [Transactions](./transactions.md) -- TRANSACTION_SUBMITTED, TRANSACTION_APPROVED, TRANSACTION_CONFIRMED, TRANSACTION_CANCELLED (@Auditable), SHARES_ISSUED, SHARES_TRANSFERRED, SHARES_CANCELLED, SHARES_CONVERTED, SHARES_SPLIT (programmatic from TransactionService.confirm())
- [Funding Rounds](./funding-rounds.md) -- ROUND_CREATED, ROUND_UPDATED, ROUND_OPENED, ROUND_CLOSED, ROUND_CANCELLED, COMMITMENT_CREATED, COMMITMENT_CONFIRMED, COMMITMENT_CANCELLED (@Auditable)
- [Option Plans](./option-plans.md) -- OPTION_PLAN_CREATED, OPTION_PLAN_UPDATED, OPTION_PLAN_CLOSED, OPTION_GRANTED, OPTION_GRANT_UPDATED, OPTION_GRANT_CANCELLED, OPTION_EXERCISE_REQUESTED, OPTION_EXERCISE_CANCELLED (@Auditable), OPTION_GRANT_EXPIRED (programmatic from OptionPlanService.expireStaleGrants())
- [Convertible Instruments](./convertible-instruments.md) -- CONVERTIBLE_CREATED, CONVERTIBLE_UPDATED, CONVERTIBLE_REDEEMED, CONVERTIBLE_CANCELLED, CONVERTIBLE_CONVERTED (@Auditable)
- [KYC Verification](./kyc-verification.md) -- KYC_STARTED, KYC_CPF_VERIFIED, KYC_DOCUMENT_UPLOADED, KYC_FACE_VERIFIED (@Auditable)
- [Document Generation](./document-generation.md) -- DOCUMENT_GENERATED, DOCUMENT_UPLOADED, DOCUMENT_UPDATED, DOCUMENT_DRAFT_CREATED, DOCUMENT_GENERATED_FROM_DRAFT, DOCUMENT_DELETED (@Auditable)
- [Company Profile](./company-profile.md) -- PROFILE_CREATED, PROFILE_UPDATED, PROFILE_PUBLISHED, PROFILE_UNPUBLISHED, PROFILE_ARCHIVED, PROFILE_SLUG_UPDATED, PROFILE_METRICS_UPDATED, PROFILE_TEAM_UPDATED (@Auditable), PROFILE_LITIGATION_FETCHED, PROFILE_LITIGATION_FAILED (programmatic from LitigationCheckProcessor)
- [Company Dataroom](./company-dataroom.md) -- PROFILE_DOCUMENT_UPLOADED, PROFILE_DOCUMENT_DELETED (@Auditable)
- [Reports & Analytics](./reports-analytics.md) -- CAP_TABLE_EXPORTED, DATA_EXPORTED (@Auditable)
- Self-referential -- AUDIT_LOG_VIEWED, AUDIT_LOG_INTEGRITY_VERIFIED (programmatic from AuditLogController)
- System monitoring -- DLQ_WARNING_ALERT, DLQ_CRITICAL_ALERT (programmatic from ScheduledTasksService.monitorDeadLetterQueues())
