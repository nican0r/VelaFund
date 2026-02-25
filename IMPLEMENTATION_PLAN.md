# Navia MVP — Implementation Plan v57.0

> **Generated**: 2026-02-25 | **Tests**: 2655 passing (1704 backend + 951 frontend) | **Backend modules**: 22 of 23 built
>
> **Purpose**: Prioritized bullet-point list of all remaining work, ordered by dependency and criticality.
> Items marked with checkboxes. `[x]` = complete, `[ ]` = remaining.

---

## Current State

**Built backend modules** (22): auth (with Redis sessions + Redis-backed failed-attempt lockout), company, member, share-class, shareholder, cap-table, transaction, funding-round, option-plan (with exercises), convertible, notification, audit-log, email, kyc, document, company-profile, company-dataroom, company-litigation, exit-waterfall, reports-analytics

**Entirely missing backend modules** (4): document-signatures, blockchain-integration, company-blockchain-admin, cap-table-reconciliation

**Frontend**: P4.1 Foundation complete (Privy auth, next-intl v4, shadcn/ui, typed API client with CSRF/i18n/401 handling). P4.3 Dashboard Page complete. P4.4 Cap Table Page complete (3-tab view, data tables, export, 5 TanStack Query hooks). P4.5 Shareholders Page (list + create form) complete (list table, search/filters, CPF masking, delete dialog, create form with 5 type cards, CPF/CNPJ Modulo 11 validation, foreign shareholder detection, collapsible address, 50 create form tests). P4.6 Share Classes Page (list + create form + detail) complete (4 stat cards, type filter, data table with 8 columns, delete confirmation, pagination, 22 list tests; create form with type cards, liquidation preferences for preferred, 35 create form tests; detail page with 2-tab Holders/Details layout, cap table holders filtered by share class, info cards for voting/preferences/restrictions, 34 detail tests). P4.7 Transactions Page (list + create form) complete (4 stat cards, type+status filters, 9-column data table with type/status badges, cancel dialog, pagination, BRL currency formatting, 25 list tests; create form with 2-step wizard Details→Review, 5 transaction type cards with icons, dynamic field visibility per type, smart dropdown filtering, client-side validation, total value calculation, board approval checkbox, useCreateTransaction+useSubmitTransaction hooks, transactions.form.* i18n namespace ~50 keys PT-BR+EN, 38 create form tests). P4.8 Funding Rounds Page (list + create form) complete (4 stat cards Total/Open/Closed/Draft with ocean-600 highlight, type+status filter dropdowns, 8-column data table with type/status badges, cancel dialog for DRAFT/OPEN rounds, BRL currency formatting, pt-BR date formatting, client-side type filtering, 24 list tests; create form with 2-step wizard Details→Review, 7 round type cards with icons/colors, share class dropdown, financial terms section with auto post-money valuation, cross-field validation min≤target/hardCap≥target, useCreateFundingRound mutation hook, fundingRounds.form.* i18n namespace ~50 keys PT-BR+EN, 37 create form tests). P4.9 Option Plans Page (list + create plan form) complete (three-tab layout Plans/Grants/Exercises, pool utilization bar, stat cards, status filters, close/cancel actions, pagination per tab, 53 list tests; create plan form with 2-step wizard Details→Review, 3 termination policy cards Forfeiture/Acceleration/Pro-rata, share class dropdown, exercise window configuration, useCreateOptionPlan hook, optionPlans.form.* i18n namespace ~30 keys PT-BR+EN, 42 create form tests). P4.10 Convertible Instruments Page (list + create form) complete (4 stat cards Total/Outstanding/Principal/Accrued Interest with ocean-600 highlight, type+status filter dropdowns, 9-column data table with type/status badges, cancel dialog for cancellable statuses, BRL currency formatting, pt-BR date formatting, pagination, 25 list tests; create form with 2-step wizard Details→Review, 4 instrument type cards (Mútuo Conversível, Investimento Anjo, Misto, MAIS) with icons/colors, investor dropdown, financial details with interest rate %→decimal conversion, conversion terms section with discount/cap/trigger/share class/auto-convert/MFN, client-side validation, useCreateConvertible mutation hook, convertibles.form.* i18n namespace ~55 keys PT-BR+EN, 42 create form tests). P4.12 Member Invitation Flow complete (public invitation acceptance page at /invitations/[token], three-state UI loading/error/details, role badges, pt-BR date formatting, Privy login trigger for unauthenticated users, accept mutation with toast+redirect for authenticated users, useInvitationDetails+useAcceptInvitation hooks, invitations.* i18n namespace 25 keys PT-BR+EN, 22 component tests). P4.13 Notifications UI complete (notification bell with real unread count + dropdown panel + full notifications page with All/Preferences tabs + 53 tests). CompanyProvider context for selected company state with localStorage persistence. Company switcher in topbar + sidebar + mobile sidebar with dropdown company selection (27 tests). TypeScript types for API responses (`types/company.ts`). 951 tests across 31 test suites.

**Infrastructure**: Redis/Bull configured (`@nestjs/bull`, `bull`, `ioredis` installed; BullModule.forRootAsync in AppModule). SessionService for Redis-backed auth sessions (7-day absolute, 2-hour inactivity timeouts). AWS SDK configured (`@aws-sdk/client-s3`, `@aws-sdk/client-ses`, `@aws-sdk/client-kms`, `@aws-sdk/s3-request-presigner` installed; AwsModule @Global with S3Service, SesService, KmsService). CSRF middleware implemented (double-submit cookie pattern, `navia-csrf` cookie, `X-CSRF-Token` header validation). Helmet fully configured (including `permittedCrossDomainPolicies: false`). `redactPii()` utility implemented (`common/utils/redact-pii.ts`: maskCpf, maskCnpj, maskEmail, maskWallet, maskIp + redactPiiFromString; integrated with GlobalExceptionFilter for PII-safe logging; AuthService refactored to use centralized utility). Body size limits configured (1MB JSON, 1MB URL-encoded in main.ts). EncryptionModule implemented (@Global) with EncryptionService wrapping KmsService: encrypt/decrypt via KMS and HMAC-SHA256 blind indexes via BLIND_INDEX_KEY env var; graceful degradation with SHA-256 fallback when BLIND_INDEX_KEY is not set and plaintext fallback when KMS is unavailable. AuditLogModule implemented (@Global export via AuditLogService) with Bull queue async processing, @Auditable() decorator, AuditInterceptor (registered as APP_INTERCEPTOR globally), hash chain verification, PII masking at write time. @Auditable() wired into 53 state-changing endpoints across 12 controllers (company, member, invitation, share-class, shareholder, cap-table, transaction, funding-round, convertible, option-plan, kyc, document). EmailModule implemented (@Global export via EmailService) with MJML template compilation, variable interpolation with HTML escaping, locale fallback (pt-BR default), plain-text auto-generation from HTML; 4 base email templates (invitation, exercise-notification, export-ready, password-reset) in PT-BR and EN; MemberService wired to send invitation emails via SES (fire-and-forget with graceful degradation). KycModule implemented with KycController (5 endpoints), KycService (6 methods), VerifikService (4 API methods with native fetch + AbortController timeout), KycProcessor (Bull queue for async AML screening), CPF Modulo 11 validation, Levenshtein fuzzy name matching, image magic bytes validation, S3 KYC bucket with KMS encryption, EncryptionService for CPF encryption + blind index, @Auditable() on all state-changing endpoints, 18 i18n error messages, 192 tests. No `@sentry/nestjs`. **0 TODOs remaining in the backend** (previously 2 in member.service.ts, now replaced with EmailService calls).

**Prisma schema**: 34 models, 38 enums. Models already present: AuditHashChain, ConsentRecord, WaterfallScenario, ExportJob. Models missing: ProfileDocumentDownload. User.locale field exists.

---

## P0 — Bug Fixes (immediate)

- [x] **BUG-1 (CRITICAL)**: FIXED in v0.0.17. Raw Privy token replaced with Redis-backed session store. SessionService creates 64-char hex session ID stored in cookie, backed by Redis with 7-day absolute timeout (Redis TTL) and 2-hour inactivity timeout. AuthGuard uses session→Redis→DB lookup for cookie auth, with Privy token fallback for Bearer header and Redis-unavailable mode. Graceful degradation: if Redis is down, falls back to Privy token verification.
- [x] **BUG-2 through BUG-6**: All FIXED in v0.0.15. BUG-2: exercise roles `@Roles('ADMIN', 'EMPLOYEE')` + `validateGranteeOrAdmin()`. BUG-3: typo `zeroPremoneeyShares` → `zeroPremoneyShares`. BUG-4: on-the-fly `calculateAccruedInterest()` instead of stale DB field. BUG-5: removed local `AuthenticatedUser` interface. BUG-6: added `PRE_SEED`/`OTHER` to `RoundType` enum.

---

## P1 — Critical Infrastructure

These are prerequisites for many downstream features.

- [x] **Redis + Bull queue setup** — DONE (v0.0.16): Added `@nestjs/bull`, `bull`, `ioredis` dependencies. BullModule.forRootAsync configured in AppModule with ConfigService, defaultJobOptions (3 attempts, exponential backoff). RedisModule created as a @Global module providing a shared ioredis client (`REDIS_CLIENT` injection token) with lazyConnect, retry strategy, and clean shutdown via OnModuleDestroy. Redis health check added to HealthController (reports `up`/`down`/`unconfigured`). 12 new tests (640 total passing).
  - [x] Add `@nestjs/bull`, `bull`, `ioredis` dependencies — DONE (v0.0.16)
  - [x] Configure BullModule.forRoot with Redis connection (Railway Redis URL) — DONE: BullModule.forRootAsync in AppModule with ConfigService, defaultJobOptions (3 attempts, exponential backoff)
  - [x] REDIS_URL already in `.env.example` — add to backend ConfigModule validation — DONE: RedisModule reads REDIS_URL via ConfigService, defaults gracefully to null when unconfigured
  - [x] Create Bull health check in HealthController — DONE: Health endpoint now reports database + Redis status (up/down/unconfigured)
  - _Unlocks_: audit logging, notifications, email sending, daily interest accrual, async CNPJ validation, export jobs, session store
  - _Session store_: SessionService (v0.0.17) uses REDIS_CLIENT for auth sessions (7-day absolute, 2-hour inactivity)

- [x] **AWS SDK integration** — DONE: Added `@aws-sdk/client-s3`, `@aws-sdk/client-ses`, `@aws-sdk/client-kms`, `@aws-sdk/s3-request-presigner`. Created `AwsModule` (@Global) with S3Service (upload, download, delete, generatePresignedUrl with 15-min default expiry, checkBucketHealth), SesService (sendEmail, sendTemplatedEmail with variable interpolation), KmsService (encrypt, decrypt via AES-256-GCM). All services gracefully degrade when AWS credentials are not configured. HealthController updated to report S3 status. 57 new tests (734 total passing).
  - [x] Add `@aws-sdk/client-s3`, `@aws-sdk/client-ses`, `@aws-sdk/client-kms`, `@aws-sdk/s3-request-presigner` — DONE
  - [x] Create `AwsModule` with S3Service, SesService, KmsService as injectable providers — DONE: @Global module in backend/src/aws/
  - [x] AWS credentials already in `.env.example` — add to backend ConfigModule validation — DONE: services read AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY via ConfigService
  - [x] S3Service: upload, download, delete, generatePresignedUrl (15-min expiry) — DONE: plus checkBucketHealth, KMS SSE support, metadata support
  - [x] SesService: sendTemplatedEmail with locale-aware template selection — DONE: sendEmail + sendTemplatedEmail with {{variable}} interpolation
  - [x] KmsService: encrypt, decrypt (AES-256-GCM via KMS) — DONE: with custom key ARN override support
  - _Unlocks_: document storage, email sending, PII encryption, KYC document storage

- [x] **EncryptionService + Blind Index** — DONE: Created `EncryptionModule` (@Global) with `EncryptionService` wrapping KmsService. Provides encrypt/decrypt via KMS and HMAC-SHA256 blind indexes via BLIND_INDEX_KEY env var. Graceful degradation: SHA-256 fallback when BLIND_INDEX_KEY is not set; plaintext fallback when KMS is unavailable. ShareholderService updated to use EncryptionService for blind indexes and optional CPF encryption (CNPJ stays plaintext per security.md — public registry data). findById decrypts CPF transparently. 26 EncryptionService tests + 6 new ShareholderService tests (854 total passing).
  - [x] Create `EncryptionModule` with encrypt/decrypt via KMS — DONE: @Global module in backend/src/encryption/
  - [x] Implement `createBlindIndex(value, key)` using HMAC-SHA256 — DONE: Uses BLIND_INDEX_KEY from env, falls back to SHA-256
  - [x] BLIND_INDEX_KEY already in `.env.example` — DONE: EncryptionService reads via ConfigService
  - [x] Migrate Shareholder CPF/CNPJ to encrypted storage with blind index — DONE: ShareholderService.create encrypts CPF via KMS when available, stores in cpfCnpjEncrypted, clears plaintext cpfCnpj; CNPJ stays plaintext; findById decrypts CPF transparently
  - _Unlocks_: LGPD compliance for PII fields

- [x] **CSRF Middleware** — DONE: Created `common/middleware/csrf.middleware.ts` with double-submit cookie pattern. Sets `navia-csrf` cookie (non-HTTP-only, SameSite=Strict) on GET/HEAD/OPTIONS. Validates `X-CSRF-Token` header matches cookie on POST/PUT/PATCH/DELETE. Bearer token requests are exempt (not vulnerable to CSRF). i18n error responses (PT-BR/EN) with `AUTH_CSRF_INVALID` error code. Registered in `main.ts` after RequestIdMiddleware. `X-CSRF-Token` added to CORS allowedHeaders. 31 tests.
  - [x] Create `common/middleware/csrf.middleware.ts` with double-submit cookie pattern per `security.md` — DONE
  - [x] Set `navia-csrf` cookie on GET requests — DONE (also HEAD/OPTIONS)
  - [x] Validate `X-CSRF-Token` header on POST/PUT/PATCH/DELETE — DONE (Bearer token exempt)
  - [x] Register in `main.ts` (currently only `RequestIdMiddleware` is registered) — DONE
  - [ ] Update frontend API client to read and send CSRF token (currently missing)

- [x] **redactPii() utility** — DONE: Created `common/utils/redact-pii.ts` with maskCpf (`***.***.***-XX`), maskCnpj (`**.***.****/****-XX`), maskEmail (`n***@domain.com`), maskWallet (`0x1234...abcd`), maskIp (/24 subnet), redactPii() deep object traversal, redactPiiFromString() for log messages. Field name detection for cpf/cnpj/email/wallet/ip/password/token/secret/bankAccount fields. Integrated with GlobalExceptionFilter (PII-safe unhandled exception logging). AuthService refactored from private methods to centralized utility. 57 new tests (822 total passing).
  - [x] Create `common/utils/redact-pii.ts` per `error-handling.md` — DONE
  - [x] Mask CPF: `***.***.***-XX`, Email: `n***@domain.com`, CNPJ: `**.***.****/****-XX`, Wallet: `0x1234...abcd`, IP: truncate to /24 — DONE
  - [x] Integrate with GlobalExceptionFilter for PII-safe unhandled exception logging — DONE
  - [ ] Integrate with Sentry `beforeSend` (depends on Sentry integration)

- [ ] **Sentry integration** (`@sentry/nestjs` not in package.json)
  - [ ] Add `@sentry/nestjs` dependency
  - [ ] SENTRY_DSN already in `.env.example`
  - [ ] Add Sentry to GlobalExceptionFilter: 5xx → error level, unhandled → fatal, 4xx → breadcrumb only
  - [ ] Add `beforeSend` hook for PII redaction (requires redactPii)
  - [ ] Add Sentry to frontend (`@sentry/nextjs` — not currently in frontend package.json)

- [x] **Email sending (AWS SES)** — DONE
  - [x] Create email template system: `templates/email/{templateName}/{locale}.mjml` — DONE: Created EmailModule (@Global) with EmailService. Templates in `backend/templates/email/` with MJML compilation, variable interpolation, locale fallback (pt-BR default), HTML escaping for XSS prevention, auto plain-text generation.
  - [x] Implement MJML → HTML compilation — DONE: Added `mjml` dependency. EmailService.compileTemplate() loads MJML, interpolates variables, compiles to HTML, extracts subject from HTML comment, generates plain text.
  - [x] Create base email templates: invitation, exercise-notification, export-ready, password-reset — DONE: 8 template files (4 types × 2 locales: pt-BR, en) in `backend/templates/email/`. Each template has responsive Navia-branded design, subject line in HTML comment, and {{variable}} placeholders.
  - [x] Wire SES into MemberService invite — DONE: Replaced 2 TODO comments at member.service.ts. Email sent asynchronously (fire-and-forget) after member creation and resend. Graceful degradation: if SES unavailable, logs warning. Invitee locale detected from User.locale when account exists, defaults to pt-BR. Invitation URL uses FRONTEND_URL env var. Email also sent for re-invited (previously REMOVED) members.

- [x] **Body size limits** — DONE: Added `json({ limit: '1mb' })` and `urlencoded({ extended: true, limit: '1mb' })` to `main.ts`. Per-route Multer limits and sharp for EXIF stripping still TODO (will be added when KYC/document modules are built).
  - [x] Add `app.use(json({ limit: '1mb' }))` to `main.ts` — DONE
  - [x] Add `app.use(urlencoded({ extended: true, limit: '1mb' }))` to `main.ts` — DONE
  - [ ] Configure Multer per-route limits (10MB for file uploads, 5MB bulk ops)
  - [ ] Add `sharp` dependency for EXIF metadata stripping (not currently in package.json)

- [x] **Helmet gap** — DONE: Added `permittedCrossDomainPolicies: false` to helmet config in `main.ts`.
  - [x] Add `permittedCrossDomainPolicies: false` to helmet config in `main.ts` (present in `security.md` spec, missing from implementation) — DONE

- [x] **.env.example update** — already contains all critical vars: DATABASE_URL, REDIS_URL, PORT, NODE_ENV, FRONTEND_URL, PRIVY_APP_ID, PRIVY_APP_SECRET, VERIFIK_API_TOKEN, VERIFIK_BASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_KMS_KEY_ARN, AWS_S3_DOCUMENTS_BUCKET, AWS_S3_KYC_BUCKET, BLIND_INDEX_KEY, SENTRY_DSN, BIGDATACORP_API_TOKEN, BIGDATACORP_BASE_URL

- [ ] **Test infrastructure gaps**
  - [ ] Add `jest-mock-extended` to devDependencies (testing rules reference `mockDeep` but it's not installed — tests currently use hand-written mocks)
  - [ ] Add `@faker-js/faker` to devDependencies (testing rules reference it but not installed)

---

## P2 — Existing Module Gaps

Gaps in the 12 built modules, ordered by module.

### Auth Module

- [x] ~~`/auth/refresh` endpoint~~ — REPLACED by Redis session store (v0.0.17). Sessions are managed server-side; no token refresh needed.
- [x] ~~Inactivity timeout (2h)~~ — DONE in v0.0.17. SessionService.isInactive() checks lastActivityAt; AuthGuard destroys inactive sessions and returns 401 with `errors.auth.sessionExpired`.
- [x] Move failed-attempt lockout from in-memory Map to Redis — DONE: Redis INCR with TTL-based auto-expiry (15-min lockout period). Graceful degradation: if Redis is unavailable or errors, falls back to in-memory Map with 10K IP cap. 8 new tests (968 total passing).
- [ ] Duplicate wallet check — prevent two users from linking the same wallet address
- [ ] Privy API retry with exponential backoff (currently no retry on verify failure)
- [ ] Audit logging events: AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILED, AUTH_LOGOUT (requires programmatic AuditLogService.log() — @Public endpoints don't have request.user for interceptor)
- [ ] Onboarding wizard status tracking per `authentication.md` spec (step tracking: profile → company → done)

### Company Module

- [x] Async CNPJ validation via Verifik + Bull queue per `company-cnpj-validation.md` (DONE v0.0.28)
- [x] `GET /companies/:id/setup-status` endpoint for polling CNPJ validation progress (DONE v0.0.28)
- [ ] KYC gate — require user KYC before creating company (depends on P3 KYC module)
- [ ] Blockchain contract deployment trigger on ACTIVE status (depends on P3 Blockchain module)
- [ ] Company dissolution — archive related data, prevent new operations

### Member Module

- [x] Send invitation email via SES (2 TODO comments at `member.service.ts:137,354`) — DONE: EmailService integration with invitation template, locale detection, inviter name lookup, role name translation (PT-BR/EN), async fire-and-forget sending.
- [ ] `GET /companies/:companyId/members/:memberId/permissions` endpoint — returns fully-resolved permissions per `user-permissions.md` (role defaults + overrides). Note: no single-member GET endpoint is defined in the spec; the IMPLEMENTATION_PLAN previously stated this incorrectly.
- [x] Audit logging events: COMPANY_MEMBER_INVITED, COMPANY_MEMBER_ACCEPTED, COMPANY_MEMBER_REMOVED, COMPANY_ROLE_CHANGED — DONE (v0.0.24): @Auditable() decorators on MemberController (invite, update, remove, resend) and InvitationController (accept)
- [ ] Permission override management endpoints (spec defines fine-grained overrides, not fully exposed in API)

### Share Class Module

- [ ] S.A. company type validation: require at least one COMMON_SHARES class before first issuance
- [ ] Ltda. auto-create QUOTA class on company creation (currently no auto-creation logic)
- [ ] Immutable field error: return specific error code when trying to change fields after shares are issued (currently may silently succeed or give generic error)
- [ ] `DELETE` endpoint — only when totalIssued = 0

### Shareholder Module

- [ ] `GET /companies/:companyId/shareholders/:id/transactions` — transaction history for specific shareholder
- [ ] `GET /users/me/investments` — investor portfolio view across companies
- [x] Application-level CPF encryption — DONE via EncryptionService. CPF encrypted with KMS when available; CNPJ stays plaintext (public data). Blind index upgraded to HMAC-SHA256 with BLIND_INDEX_KEY.
- [ ] Wallet address auto-link from Privy embedded wallet when shareholder accepts invite
- [ ] Invite shareholder to platform endpoint — link external shareholder to User account

### Cap Table Module

- [ ] Auto-snapshot creation after every confirmed transaction (currently manual only)
- [x] PDF/XLSX/CSV/OCT export endpoints — DONE via Reports module (v0.0.34)
- [ ] Authorized/public view — filtered view for INVESTOR/EMPLOYEE roles (currently full data for all roles with access)
- [ ] OCT export: fix snake_case field names per OCF 1.0.0 spec (currently uses camelCase in some places)
- [ ] Point-in-time comparison: endpoint to diff two snapshots

### Transaction Module

- [ ] Lock-up period enforcement — check ShareClass.lockUpPeriod before allowing transfers
- [ ] ROFR (Direito de Preferência) — right of first refusal workflow for share transfers per `transactions.md`
- [ ] Blockchain transaction submission on confirm (depends on P3 Blockchain module)
- [ ] Dilution impact preview — show before/after ownership when creating issuance
- [ ] Transaction batch/bulk operations
- [ ] SPLIT type implementation — stock split logic that adjusts all holdings proportionally

### Funding Round Module

- [x] ~~RoundType enum: add `PRE_SEED` and `OTHER` (BUG-6)~~ — FIXED in v0.0.15
- [ ] LEGAL role access to pro-forma endpoint (currently only ADMIN, FINANCE)
- [ ] Commitment side letter upload (hasSideLetter flag exists, no file upload wired)
- [ ] Round FIRST_CLOSE → FINAL_CLOSE lifecycle (spec has this, code goes DRAFT→OPEN→CLOSING→CLOSED)
- [x] ~~i18n message keys: hardcoded PT-BR strings~~ — CONFIRMED all error messages use proper `errors.round.*` messageKeys

### Option Plan Module

- [x] ~~Fix exercise creation role: `@Roles('ADMIN', 'EMPLOYEE')` (BUG-2)~~ — FIXED in v0.0.15
- [x] ~~Fix exercise cancel role: allow EMPLOYEE who created the exercise (BUG-2)~~ — FIXED in v0.0.15
- [ ] `paymentDate` field on exercise confirmation (spec mentions it, not captured in DTO)
- [ ] Custom vesting schedules beyond cliff + linear (spec mentions milestone-based vesting)
- [ ] Terminated grant exercise window: validate 90-day window from termination date (logic exists but needs edge case review)
- [ ] Auto-expire grants past expiration date (requires scheduled Bull job)
- [ ] Vesting milestone notifications (depends on P3 Notification module)

### Convertible Module

- [x] ~~Fix typo: `zeroPremoneeyShares` → `zeroPremoneyShares` (BUG-3)~~ — FIXED in v0.0.15
- [x] ~~Fix accruedInterest conversion bug (BUG-4)~~ — FIXED in v0.0.15: on-the-fly calculation via `calculateAccruedInterest()` helper
- [x] ~~Fix AuthenticatedUser import (BUG-5)~~ — FIXED in v0.0.15
- [ ] Daily interest accrual Bull job — update `accruedInterest` field in DB (depends on P1 Redis+Bull)
- [ ] Holding period enforcement — check minimum holding period before allowing redemption
- [ ] Auto-conversion trigger on qualified financing event (depends on funding round close hook)
- [ ] Interest calculation edge cases: leap year handling, partial day proration

---

## P3 — New Backend Modules

Ordered by dependency chain. Modules listed later depend on earlier ones.

### 3.1 Notification Module (spec: `notifications.md`)

- [x] Create `backend/src/notification/` module
- [x] Prisma model: Notification (already in schema), UserNotificationPreferences (already in schema, fundingRounds field added)
- [x] Bull queue: `notification` queue for async delivery
- [x] NotificationService: create, markRead, markAllRead, getUserNotifications
- [x] NotificationController: 7 endpoints per spec (list, unread count, get detail, mark read, mark all read, preferences, update preferences, delete)
- [x] 22 notification types per spec catalog (mapped to categories in create-notification.dto.ts)
- [x] Critical notifications: cannot be disabled (KYC_COMPLETED, KYC_REJECTED, KYC_RESUBMISSION)
- [ ] NotificationGateway: WebSocket for real-time push (optional MVP, can defer)
- [ ] Integrate with all existing modules: trigger notifications on key events
- [x] Tests: service + controller + processor specs (51 tests)
- [x] User flow doc: `docs/user-flows/notifications.md` — DONE (v0.0.59)

### 3.2 Audit Logging Module (spec: `.claude/rules/audit-logging.md`)

- [x] Create `backend/src/audit-log/` module
- [x] Prisma models: AuditLog (already in schema), AuditHashChain (already in schema)
- [x] Bull queue: `audit-log` queue per spec
- [x] AuditLogProcessor: Bull worker that persists events to DB
- [x] AuditInterceptor: NestJS interceptor for `@Auditable()` decorator
- [x] `@Auditable()` decorator with action, resourceType, captureBeforeState, captureAfterState
- [x] AuditService: programmatic logging for SYSTEM events (background jobs)
- [x] AuditLogController: list (paginated, filtered), detail, verify hash chain
- [x] PII masking at write time using redactPii() (depends on P1 redactPii)
- [x] Role access: ADMIN + LEGAL only
- [x] Tests: processor, interceptor, service, controller specs (55 tests)
- [ ] Before-state capture via AsyncLocalStorage (ClsModule)
- [ ] Daily hash chain job (SHA-256, runs at 00:05 UTC)
- [ ] Dead letter queue monitoring (alert at 10/50 failed jobs)
- [ ] PostgreSQL immutability trigger (migration to add BEFORE UPDATE OR DELETE trigger on audit_logs)
- [ ] PostgreSQL table partitioning for audit_logs by month (migration)
- [x] Integrate `@Auditable()` into all 10 target controllers — DONE (v0.0.24): Registered AuditInterceptor as APP_INTERCEPTOR in AppModule (useExisting to reuse AuditLogModule instance with Bull queue). Added @Auditable() decorators to 44 state-changing endpoints across 10 controllers: CompanyController (4), MemberController (4), InvitationController (1), ShareClassController (3), ShareholderController (4), CapTableController (2), TransactionController (5), FundingRoundController (8), ConvertibleController (5), OptionPlanController (8). Covers 40+ event types from the audit catalog. Auth events (login/logout) require programmatic logging via AuditLogService.log() — deferred. NotificationController skipped (user-scoped, not company audit-relevant). captureBeforeState set on update/delete ops for forward-compatibility (requires ClsModule for actual before-state capture).
- [ ] All 50+ event types from the catalog — ~40 covered via @Auditable decorators; auth events (AUTH_LOGIN_SUCCESS/FAILED/LOGOUT), KYC events, blockchain events, and SYSTEM events (reconciliation, vesting milestones) require programmatic AuditLogService.log() calls in their respective modules
- [ ] Export (CSV/PDF/XLSX)
- [ ] User flow doc: `docs/user-flows/audit-logging.md`

### 3.3 KYC Verification Module (spec: `kyc-verification.md`) — DONE

- [x] Create `backend/src/kyc/` module — DONE: KycModule with KycController (5 endpoints: start, verify-cpf, upload-document, verify-face, status), KycService (6 methods: startVerification, verifyCpf, uploadDocument, verifyFace, getStatus, processAmlScreening), VerifikService (4 API methods: verifyCpf, verifyDocument, matchFace, screenAml with native fetch + AbortController timeout), KycProcessor (Bull queue handler for async AML screening), 4 DTOs (VerifyCpfDto, UploadDocumentDto, DocumentTypeDto, KycStatusResponse), 5 Verifik interface types
- [x] Prisma model: KYCVerification (already in schema) — DONE: Uses existing KYCVerification model
- [x] Verifik API integration: CPF validation, document OCR, facial recognition, AML screening — DONE: VerifikService with native fetch, AbortController timeouts, error handling, response typing
- [x] KycService: startVerification, verifyCpf, uploadDocument, verifyFace, screenAml, getStatus — DONE: 6 methods with CPF Modulo 11 validation, Levenshtein fuzzy name matching (threshold 0.75), image magic bytes validation (JPEG/PNG)
- [x] KycController: 5 endpoints per spec — DONE: POST start, POST verify-cpf, POST upload-document, POST verify-face, GET status
- [x] 4-step flow: CPF → Document → Face → AML — DONE: Sequential step enforcement, AML triggered automatically after face verification via Bull queue
- [x] Score thresholds and attempt limits (3 attempts per step) — DONE: Configurable thresholds, attempt tracking per step
- [ ] KYC gating: block company creation until KYC approved (depends on P2 Company module integration)
- [x] Bull queue for async Verifik API calls — DONE: KycProcessor handles async AML screening via 'kyc' Bull queue
- [x] File upload to S3 (KYC bucket with SSE-KMS) — DONE: S3 KYC bucket integration with KMS encryption for document storage
- [ ] EXIF metadata stripping (sharp — dependency needs to be added)
- [x] Tests: service + controller specs — DONE: 192 tests (69 service + 71 verifik + 44 controller + 8 processor)
- [x] EncryptionService integration for CPF encryption + blind index — DONE
- [x] @Auditable() decorators on all state-changing endpoints — DONE
- [x] 18 i18n error messages in PT-BR + EN — DONE
- [x] User flow doc: `docs/user-flows/kyc-verification.md` (exists, needs update when backend is built)
- _Depends on_: P1 AWS SDK (DONE), P1 Redis+Bull (DONE)

### 3.4 Document Generation Module (spec: `document-generation.md`) — DONE (v0.0.29)

- [x] Create `backend/src/document/` module — DONE: DocumentModule with MulterModule (10MB limit)
- [x] Prisma models: Document, DocumentTemplate, DocumentSigner (already in schema) — DONE: used as-is
- [x] Handlebars template engine for variable interpolation — DONE: with custom helpers (formatNumber, formatCurrency, formatDate, eq), one-time registration pattern
- [x] Puppeteer for HTML → PDF conversion — DONE: headless Chrome with --no-sandbox, A4 format, 2cm margins, page numbers in footer, try/finally browser cleanup
- [x] DocumentService: 12 methods (findAllTemplates, findTemplateById, createDraft, createAndGenerate, findAllDocuments, findDocumentById, updateDraft, generateFromDraft, getPreviewHtml, getDownloadUrl, uploadDocument, deleteDocument) + seedTemplatesForCompany — DONE
- [x] DocumentController: 12 endpoints (2 template + 10 document) — DONE: list/get templates, list/get/create/draft/update/generate/preview/download/upload/delete documents. @Auditable on 5 state-changing endpoints. @Roles for permission control (ADMIN/LEGAL write, ADMIN/FINANCE/LEGAL read, ADMIN-only delete)
- [x] 5 pre-seeded document templates: Acordo de Acionistas, Ata de Assembleia, Certificado de Ações, Carta de Outorga de Opções, Acordo de Investimento — DONE: full Handlebars content with formSchema validation
- [x] Template variable resolution from form data with Handlebars helpers — DONE: formatNumber (pt-BR), formatCurrency (BRL), formatDate (pt-BR), eq comparison
- [x] S3 storage for generated documents — DONE: via S3Service with graceful degradation when unavailable
- [x] Draft → Generated flow with preview — DONE: createDraft → updateDraft → generateFromDraft, getPreviewHtml returns compiled HTML
- [x] File upload with magic bytes validation (PDF/JPEG/PNG) — DONE: validateFileType + getFileExtension
- [x] SHA-256 content hashing for document integrity — DONE: stored as contentHash
- [x] Pre-signed download URLs with 15-minute expiry — DONE: via S3Service.generatePresignedUrl
- [x] Form schema validation (required fields, empty arrays) — DONE: DOC_INCOMPLETE_FORM with missingFields details
- [x] 12 i18n error messages in PT-BR + EN — DONE: doc.notFound, doc.templateNotFound, doc.generationFailed, doc.uploadTooLarge, doc.invalidFileType, doc.notDraft, doc.incompleteForm, doc.hasSignatures, doc.templateInactive, doc.notGenerated, documenttemplate.notFound
- [x] Tests: 35 service tests + 22 controller tests = 57 tests — DONE
- [x] User flow doc: `docs/user-flows/document-generation.md` — DONE
- _Depends on_: P1 AWS SDK (S3) — DONE

### 3.5 Document Signatures Module (spec: `document-signatures.md`)

- [ ] Extend `backend/src/document/` module with signature support
- [ ] Prisma models: DocumentSigner (already in schema)
- [ ] EIP-712 typed data signature generation
- [ ] Privy embedded wallet integration for signing
- [ ] ecrecover signature verification on backend
- [ ] Blockchain hash anchoring (SHA-256 of signed document → on-chain)
- [ ] SignatureService: requestSignature, sign, verify, anchor
- [ ] SignatureController: request, sign, verify endpoints
- [ ] Multi-signer workflow (all signers must sign before FULLY_SIGNED)
- [ ] Tests: service + controller specs
- [ ] User flow doc: `docs/user-flows/document-signatures.md`
- _Depends on_: P3.4 Document Generation, P3.8 Blockchain Integration

### 3.6 Company Profile Module (spec: `company-profile.md`) — DONE

- [x] Create `backend/src/company-profile/` module — DONE: CompanyProfileModule with CompanyProfileController (11 endpoints) + PublicProfileController (1 endpoint)
- [x] Prisma models: CompanyProfile, ProfileMetric, ProfileTeamMember, ProfileView (all already in schema) — DONE
- [x] ProfileService: create/update profile, publish/unpublish, metrics calculation, team members — DONE: CompanyProfileService with 12 methods (create, findByCompanyId, update, updateSlug, publish, unpublish, archive, replaceMetrics, replaceTeamMembers, uploadTeamPhoto, getPublicProfile, getAnalytics)
- [x] ProfileController: CRUD + publish + public view endpoints — DONE: 11 company-scoped endpoints + 1 public profile endpoint
- [x] Email-gated access for non-public profiles — DONE: PASSWORD and EMAIL_GATED access control on public profile endpoint
- [x] Profile analytics (view count, document downloads) — DONE: Daily series + recent viewers analytics endpoint
- [ ] Auto-trigger BigDataCorp litigation check on profile creation (depends on P3.10)
- [x] Tests: service + controller specs — DONE: 132 tests (96 service + 36 controller)
- [x] User flow doc: `docs/user-flows/company-profile.md` — DONE
- _Implementation details_: 5 DTOs (CreateProfileDto, UpdateProfileDto, UpdateMetricsDto, UpdateTeamDto, UpdateSlugDto), 12 i18n error messages (PT-BR + EN), @Auditable on 8 state-changing endpoints, @Roles permission matrix (ADMIN create/publish/unpublish/archive/slug, ADMIN+FINANCE update/metrics/team/photo/analytics, all roles read), S3 team photo upload with presigned URLs, manual slug generation (NFD normalization), bcryptjs for PASSWORD access type hashing, profile lifecycle DRAFT -> PUBLISHED -> ARCHIVED

### 3.7 Company Dataroom Module (spec: `company-dataroom.md`) ✅ DONE

- [x] Extended company-profile module (not separate dataroom module)
- [x] Prisma models: ProfileDocument (added createdAt/updatedAt/uploadedBy relation), ProfileDocumentDownload (new model)
- [x] ProfileDocumentService: upload, findAll, delete, reorder, getDownloadUrl, getPublicDownloadUrl, getStorageUsage
- [x] ProfileDocumentController (5 endpoints) + PublicDocumentController (1 public download endpoint)
- [x] Document categories per spec (PITCH_DECK, FINANCIALS, LEGAL, PRODUCT, TEAM, OTHER — enum already exists)
- [x] PDF page count extraction (regex-based, no Bull job needed)
- [x] Pre-signed URL access with 15-min expiry
- [x] Access logging for download tracking (ProfileDocumentDownload records, fire-and-forget)
- [x] File type validation via MIME type + magic bytes (PDF, JPEG, PNG, XLSX, PPTX, DOCX)
- [x] Storage limits: 25 MB per file, 500 MB per profile
- [x] @Auditable on upload and delete endpoints
- [x] Tests: 45 service + 16 controller = 61 tests (1515 total)
- [x] User flow doc: `docs/user-flows/company-dataroom.md`
- _Depends on_: P1 AWS SDK (S3) ✅, P1 Redis+Bull ✅

### 3.8 Blockchain Integration Module (spec: `blockchain-integration.md`)

- [ ] Create `backend/src/blockchain/` module
- [ ] Prisma model: BlockchainTransaction (already in schema)
- [ ] Add `viem` dependency (not currently in package.json)
- [ ] viem client setup for Base Network (Chain ID 8453)
- [ ] OCP (Open Cap Table Protocol) contract ABIs and interaction
- [ ] BlockchainService: submitTransaction, getTransactionStatus, monitorEvents, syncState
- [ ] BlockchainController: 3 endpoints per spec (submit, status, sync)
- [ ] 12-block confirmation waiting
- [ ] Nonce management for sequential transactions
- [ ] Event monitoring (NewTransfer, NewIssuance, etc.)
- [ ] Block reorganization detection and handling
- [ ] Bull queue for async transaction submission and monitoring
- [ ] Tests: service + controller specs (mock viem)
- [ ] User flow doc: `docs/user-flows/blockchain-integration.md`
- _Depends on_: P1 Redis+Bull

### 3.9 Company Blockchain Admin Module (spec: `company-blockchain-admin.md`)

- [ ] Create `backend/src/blockchain-admin/` module (or extend blockchain)
- [ ] OCP contract deployment on company ACTIVE status
- [ ] Creator wallet as OCP contract admin
- [ ] EIP-712 ownership transfer workflow
- [ ] Admin role management on-chain
- [ ] Tests: service + controller specs
- [ ] User flow doc: `docs/user-flows/company-blockchain-admin.md`
- _Depends on_: P3.8 Blockchain Integration

### 3.10 Company Litigation Verification Module (spec: `company-litigation-verification.md`) ✅

- [x] Integrated into `company-profile` module (no separate module needed — litigation data lives on CompanyProfile)
- [x] No separate Prisma model needed — litigation data stored as JSONB fields on CompanyProfile (litigationStatus, litigationData, litigationFetchedAt, litigationError — all already in schema)
- [x] BigDataCorpService: external API client with native fetch + 30s AbortController timeout + circuit breaker (5 failures → open, 60s half-open)
- [x] LitigationCheckProcessor: Bull queue processor for async litigation fetching (3 attempts, exponential backoff 30s/60s/120s)
- [x] Bull queue (`profile-litigation`) for async BigDataCorp API calls, dispatched fire-and-forget on profile creation
- [x] Immutable risk data storage (litigation fields on CompanyProfile not editable by any role; PUT endpoint silently ignores litigation fields)
- [x] PII masking for plaintiff names before storage (individual names masked, company names preserved via LTDA/S.A./EIRELI/etc. regex)
- [x] Risk level classification (LOW/MEDIUM/HIGH based on active lawsuit count + total value in dispute)
- [x] Portuguese/English response field normalization from BigDataCorp API
- [x] CNPJ not found handled as valid result (COMPLETED with zero counts, LOW risk)
- [x] formatLitigationResponse() in CompanyProfileService for API response shaping (PENDING/COMPLETED/FAILED)
- [x] Audit logging: PROFILE_LITIGATION_FETCHED and PROFILE_LITIGATION_FAILED via programmatic AuditLogService.log()
- [x] Error messages: 2 in app-exception.ts + 2 in frontend i18n (PT-BR + EN) + litigation.* namespace (31 keys)
- [x] Tests: 66 tests (24 BigDataCorpService + 42 LitigationCheckProcessor) — circuit breaker, PII masking, risk computation, retry logic, CNPJ not found
- [x] User flow doc: `docs/user-flows/company-litigation.md`
- _Depends on_: P1 Redis+Bull ✅, P3.6 Company Profile ✅

### 3.11 Cap Table Reconciliation Module (spec: `cap-table-reconciliation.md`)

- [ ] Create `backend/src/reconciliation/` module (or extend cap-table)
- [ ] Add `lastBlockchainSyncAt` and `lastBlockchainHash` fields to Company model (missing from schema — needs migration)
- [ ] Scheduled daily Bull job: compare on-chain vs off-chain holdings (02:00 UTC)
- [ ] ReconciliationService: runReconciliation, getDiscrepancies, resolveDiscrepancy
- [ ] ReconciliationController: trigger, status, discrepancy list endpoints
- [ ] Redis lock for single reconciliation per company
- [ ] Block reorganization handling
- [ ] Alert on discrepancy detection (email notification)
- [ ] Tests: service + controller specs
- [ ] User flow doc: `docs/user-flows/cap-table-reconciliation.md`
- _Depends on_: P3.8 Blockchain Integration, P1 Redis+Bull

### 3.12 Exit Waterfall Module (spec: `exit-waterfall.md`) — DONE (v0.0.33)

- [x] Create `backend/src/exit-waterfall/` module (ExitWaterfallModule, ExitWaterfallController, ExitWaterfallService, 2 DTOs)
- [x] Prisma model: WaterfallScenario (added to schema with Company + User relations)
- [x] ExitWaterfallService: runWaterfall, saveScenario, listScenarios, getScenario, deleteScenario, executeWaterfall (public for testing)
- [x] ExitWaterfallController: 5 endpoints (run waterfall, save/list/get/delete scenarios) at `/api/v1/companies/:companyId/reports/waterfall`
- [x] 7-step liquidation preference algorithm (per spec): load share classes → validate order → include options → include convertibles → determine stacking → execute waterfall → compute breakeven
- [x] Participating vs non-participating preferred, participation cap handling with excess redistribution
- [x] Breakeven analysis (binary search, ≤100 iterations, R$0.01 tolerance)
- [x] Optional inclusion of vested unexercised options and as-if-converted convertibles (with discount/cap pricing)
- [ ] Scenario comparison (side-by-side waterfall at different valuations) — deferred to reports-analytics module
- [x] Tests: 29 service + 7 controller = 36 tests
- [x] User flow doc: `docs/user-flows/exit-waterfall.md`
- [x] i18n: 2 backend error messages, ~33 frontend translation keys (errors.waterfall + reports.waterfall namespaces)
- [x] @Roles('ADMIN') on all endpoints, @Throttle decorators (write: 30/min, read: 100/min)

### 3.13 Reports & Analytics Module (spec: `reports-analytics.md`) — DONE (v0.0.34)

- [x] Create `backend/src/reports/` module (ReportsModule with ReportsService, ReportsController, PortfolioController, ReportExportProcessor, 4 DTOs)
- [x] Prisma model: ExportJob + ExportJobType + ExportJobStatus enums added to schema
- [x] ReportsService: getOwnershipReport, getDilutionReport, getPortfolio, exportCapTable, generateDueDiligence, getExportJobStatus
- [x] ReportsController (6 endpoints): ownership, dilution, cap-table/export, cap-table/export/:jobId, due-diligence, due-diligence/:jobId
- [x] PortfolioController (1 endpoint): GET /api/v1/users/me/reports/portfolio
- [x] Export formats: PDF (Puppeteer), XLSX (exceljs), CSV (BOM + semicolons), OCT JSON (OCF 1.0.0), ZIP (archiver) — deps installed
- [x] Async export via Bull queue ('report-export') with deduplication (5-min window), S3 upload, presigned URLs (1h expiry), email notification
- [x] Due diligence ZIP: 6 CSVs + cap table PDF + metadata.json
- [x] Dilution analysis: Gini coefficient, foreign ownership %, time-series from snapshots
- [x] @Auditable on export + due-diligence endpoints, @Roles ADMIN/FINANCE/LEGAL (ADMIN/LEGAL-only for due-diligence)
- [x] i18n: 6 backend error messages, ~30 frontend translation keys (errors.report, reports.ownership/dilution/export/dueDiligence, portfolio namespaces)
- [x] Tests: 87 tests (50 service + 15 controller + 22 processor)
- [x] User flow doc: `docs/user-flows/reports-analytics.md`

### 3.14 Company CNPJ Async Validation (spec: `company-cnpj-validation.md`)

- [x] Bull job in company module: async CNPJ validation via Verifik after company creation (DONE v0.0.28)
- [x] `GET /companies/:id/setup-status` polling endpoint (DONE v0.0.28)
- [x] On success: transition company DRAFT → ACTIVE (blockchain deployment deferred to P3.8)
- [x] On failure: company stays DRAFT, user notified to retry (DONE v0.0.28)
- [x] Rate limiting on retry attempts (DONE v0.0.28 — 3/min via @Throttle)
- [x] Tests: job processor + endpoint specs (39 new tests — 1244 total)
- [x] User flow doc: `docs/user-flows/company-cnpj-validation.md` (DONE v0.0.28)
- _Depends on_: P1 Redis+Bull (DONE), P3.3 KYC (DONE — Verifik client available)

---

## P4 — Frontend Implementation

### 4.1 Foundation (must do first)

- [x] Install and configure Privy React SDK (`@privy-io/react-auth` v3.14.1)
  - [x] PrivyProvider in `providers.tsx` with app ID, email/Google/Apple login, embedded wallets
  - [x] AuthContext (`src/lib/auth.tsx`): usePrivy() wrapper, user state, loading state, backend session creation
  - [x] Protected route logic in AuthProvider (redirect to /login if unauthenticated, /dashboard if authenticated on /login)
  - [x] Auth token sent to backend via POST /api/v1/auth/login; subsequent requests use HTTP-only cookie (credentials: 'include')

- [x] Install and configure next-intl (`next-intl` v4.8.3)
  - [x] Cookie-based locale detection (`src/i18n/request.ts` reads `navia-locale` cookie, falls back to pt-BR)
  - [x] NextIntlClientProvider wrapping app layout (`src/app/layout.tsx`)
  - [ ] Complete all i18n keys in pt-BR.json and en.json (currently partial — missing: `errors.round.*`, `errors.convertible.*`, `errors.shareholder.*`, `errors.shareClass.*`, `errors.kyc.*`, `errors.doc.*`, `errors.chain.*`, and all feature page namespaces)

- [x] Initialize shadcn/ui (components.json configured, Button component created)
  - [x] Created `components.json` with Navia theme configuration
  - [x] Button component (`src/components/ui/button.tsx`) with Navia ocean-500/700 hover/active states
  - [ ] Install remaining core components: Input, Card, Dialog, Select, Table, Badge, Tabs, DropdownMenu, Toast, Skeleton, Avatar, Tooltip, Popover, Command (search)
  - [ ] Fix borderRadius tokens (shadcn defaults vs Navia design system values in `design-system.md`)

- [x] Wire API client (`src/lib/api-client.ts` — fully rewritten)
  - [x] Auth via HTTP-only cookie (credentials: 'include' on all requests)
  - [x] CSRF token on state-changing requests (reads `navia-csrf` cookie, sends `X-CSRF-Token` header)
  - [x] Dynamic Accept-Language header from `navia-locale` cookie
  - [x] X-Request-Id header (crypto.randomUUID)
  - [x] 401 handler: setOnUnauthorized callback triggers logout + redirect to /login
  - [x] Error toast integration via `useErrorToast()` hook (`src/lib/use-error-toast.ts`)

- [x] Replace hardcoded user data in layout components
  - [x] `sidebar.tsx` — dynamic user data from useAuth(), functional logout button
  - [x] `mobile-sidebar.tsx` — dynamic user data from useAuth(), functional logout button
  - [x] `topbar.tsx` — dynamic user data from useAuth(), functional user dropdown with logout
  - [x] Wire logout button onClick handler (all 3 components call auth.logout())
  - [x] Wire notification bell to real notification count — DONE: useUnreadCount hook with 30s polling, numeric badge (capped at 99+), NotificationDropdown panel with 5 recent notifications, mark as read/mark all as read actions, view all link

- [x] Global error boundary with fallback UI (`src/components/error-boundary.tsx`)

**Tests**: 929 frontend tests (11 api-client + 4 error-boundary + 10 button + 27 company-switcher + 2 remaining + 875 page/component tests)

### 4.2 Auth Pages

- [x] Login page — wired to Privy login modal (email + Google + Apple) via useAuth().login()
- [ ] Onboarding wizard (3 steps: profile completion → company creation OR join → done)
- [ ] Logout flow (clear cookies, Privy logout, redirect)

### 4.3 Dashboard Page

- [x] Replace mock data with real API calls (TanStack Query hooks: useCapTable, useRecentTransactions)
- [x] Stat cards with real data from API (Total Shares, Shareholders, Share Classes, Transactions)
- [x] Ownership pie chart (Recharts donut with top-6 shareholders + "Others" aggregation) — `GET /companies/:id/cap-table`
- [x] Recent transactions table — `GET /companies/:id/transactions?limit=5` with type badges, shareholder names, formatted quantities/dates
- [x] Quick actions card (Link components to /dashboard/transactions, /dashboard/shareholders, etc.)
- [x] Company context provider (CompanyProvider with auto-selection, localStorage persistence, TanStack Query)
- [x] Loading skeleton states, empty states, no-company state
- [x] Full i18n (pt-BR + en) for all dashboard strings
- [x] 13 component tests (8 dashboard page + 5 ownership chart)
- [x] Company switcher in topbar — DONE: CompanySwitcher component in topbar (dropdown with company list, entity type, CNPJ, selection check mark), SidebarCompanySwitcher in sidebar and mobile sidebar (dark-themed variant), Building2 icon, static display for single company, dropdown hidden when ≤1 company, outside click/Escape close, localStorage persistence via CompanyProvider, companySwitcher.* i18n namespace (PT-BR + EN), 27 component tests

### 4.4 Cap Table Page ✅

- [x] Full-width data table with shareholder name, type badge, share class, shares, ownership %, voting power, voting %
- [x] Summary row with totals (shares, 100% ownership, 100% voting)
- [x] Three-tab view: Current / Fully Diluted / History
- [x] Fully Diluted tab with current shares, vested/unvested options, diluted shares/percentage
- [x] History tab with paginated snapshot list (date, shares, shareholders, trigger, notes)
- [x] Export dropdown (PDF, Excel, CSV, OCT JSON) — calls backend async export endpoint via useMutation
- [x] Share class filter dropdown (visible when multiple classes exist)
- [x] Stat cards: Total Shares (active), Shareholders, Share Classes, Option Pool
- [x] Ownership donut chart (reuses OwnershipChart component)
- [x] Loading skeletons, empty states, no-company state
- [x] TanStack Query hooks: useCapTableCurrent (30s polling), useCapTableFullyDiluted (lazy), useCapTableHistory (paginated), useExportCapTable (mutation), useExportJobStatus (2s polling)
- [x] Full i18n (capTable.* namespace, 50+ keys in PT-BR and EN)
- [x] 21 component tests
- [x] Company switcher in topbar — DONE (see P4.3)

### 4.5 Shareholders Page

- [x] Shareholder list table with search, filter (type, status), sort, pagination
- [x] Create shareholder form page with CPF/CNPJ Modulo 11 validation
  - [x] 5 type selection cards (Founder, Investor, Employee, Advisor, Corporate)
  - [x] CPF/CNPJ auto-formatting with Modulo 11 checksum validation
  - [x] Conditional fields: CNPJ label for CORPORATE, CPF for individuals
  - [x] Foreign shareholder detection (taxResidency ≠ BR) with RDE-IED fields
  - [x] Collapsible address section with all-or-nothing validation
  - [x] Corporate informational note for beneficial owners
  - [x] useCreateShareholder mutation hook with query invalidation
  - [x] Success toast + navigation, error toast via useErrorToast
  - [x] shareholders.form.* i18n namespace (50+ keys PT-BR + EN)
  - [x] 50 component tests (type selection, CPF/CNPJ validation, foreign detection, address, form submission)
- [x] Shareholder detail page (`/dashboard/shareholders/[id]`)
  - [x] Avatar with initials (skips Brazilian prepositions da/de/do/dos/das)
  - [x] Profile header: name, type badge, status badge, foreign indicator
  - [x] 3 stat cards (Total Shares, Ownership %, Voting Power) computed from holdings
  - [x] 4 tabs: Overview, Holdings, Transactions, Compliance
  - [x] Overview tab: personal info card (CPF/CNPJ masked, nationality, type) + contact info card (email, phone, address)
  - [x] Holdings tab: share class table with type, quantity, ownership %, voting %
  - [x] Transactions tab: filtered by shareholderId with type/status badges, pagination, BRL currency formatting
  - [x] Compliance tab: foreign info (RDE-IED), beneficial owners table (for CORPORATE), basic compliance info
  - [x] Loading skeleton, error, not-found, no-company states
  - [x] shareholders.detail.* i18n namespace (~35 keys PT-BR + EN)
  - [x] PointerEvent + ResizeObserver polyfills in jest.setup.ts for Radix UI tab testing
  - [x] 31 component tests (rendering, tab switching, data display, masking, states, pagination)
- [ ] Beneficial owners management (for CORPORATE type)
- [x] Foreign shareholder indicator

### 4.6 Share Classes Page

- [x] Share class list page with 4 stat cards (Total/Issued/Available/Preferred), type filter dropdown, data table (Name, Type badge, Votes/Share, Authorized, Issued, % Issued, Lock-up, Actions), delete confirmation dialog, pagination, loading/empty/error states, pt-BR number formatting
- [x] TanStack Query hooks: useShareClasses, useShareClass, useDeleteShareClass
- [x] shareClasses i18n namespace (~50 keys, PT-BR + EN)
- [x] Sidebar nav item with Layers icon
- [x] 22 component tests (all passing)
- [x] Create share class form with entity type compatibility checks
  - [x] Type selection cards filtered by company entityType (LTDA→QUOTA, S.A.→COMMON/PREFERRED)
  - [x] Form sections: basic info, voting rights, liquidation preferences (PREFERRED only), transfer restrictions
  - [x] PREFERRED_SHARES forced to 0 votesPerShare (disabled input)
  - [x] Client-side validation (required, maxLength, positive numbers)
  - [x] useCreateShareClass mutation hook with query invalidation
  - [x] Success toast + navigation, error toast via useErrorToast
  - [x] Label component (shadcn/ui pattern with @radix-ui/react-label)
  - [x] shareClasses.form.* i18n namespace (25+ keys PT-BR + EN)
  - [x] 35 component tests (rendering, type selection, validation, submission, conditional sections)
- [x] Share class detail page (`/dashboard/share-classes/[id]`)
  - [x] Back link to share classes list
  - [x] Header with class name, type badge (QUOTA/COMMON/PREFERRED color-coded), delete button (disabled when shares issued)
  - [x] 4 stat cards (Authorized highlighted ocean-600, Issued, Available, % Issued) with pt-BR number formatting
  - [x] 2-tab layout: Holders (default) and Details
  - [x] Holders tab: cap table entries filtered by shareClassId, shareholder name links, type badges, shares/ownership%/voting% columns
  - [x] Details tab: 2-column grid with Class Information, Voting Rights, Liquidation Preferences (PREFERRED only), Transfer Restrictions info cards
  - [x] Delete confirmation dialog with redirect to list on success
  - [x] Loading skeleton, error state, not found state, no company state
  - [x] useShareClass + useCapTable + useDeleteShareClass TanStack Query hooks
  - [x] shareClasses.detail.* i18n namespace (~45 keys PT-BR + EN)
  - [x] 34 component tests (rendering, stat cards, tabs, holders, details, delete, loading/error states, type badges)

### 4.7 Transactions Page

- [x] Transaction list page with type filter, status filter, pagination, and sorting
- [x] 4 stat cards (Total Transactions, Confirmed, Pending, Drafts) with ocean-600 highlighted active card
- [x] 9-column data table (Date, Type, From, To, Class, Quantity, Value, Status, Actions)
- [x] Type badges with color coding (Issuance=green, Transfer=blue, Conversion=cream, Cancellation=red, Split=gray)
- [x] Status badges with color coding (Draft=gray, Pending=cream, Submitted=blue, Confirmed=green, Failed=red, Cancelled=gray)
- [x] Cancel confirmation dialog with conditional cancel button (only DRAFT, PENDING_APPROVAL, SUBMITTED, FAILED)
- [x] BRL currency formatting and pt-BR number formatting
- [x] useTransactions, useTransaction, useCancelTransaction TanStack Query hooks
- [x] transactions i18n namespace (~50 keys, PT-BR + EN)
- [x] Sidebar nav item with ArrowLeftRight icon (already wired)
- [x] 25 component tests (all passing)
- [x] Create transaction flow (2-step: Details → Review, 5 type cards with icons/descriptions)
  - [x] Issuance form (to shareholder, share class, quantity, price per share)
  - [x] Transfer form (from/to shareholder with smart dropdown filtering, share class, quantity, price)
  - [x] Conversion form (from shareholder, source/target share class with filtering, quantity)
  - [x] Cancellation form (from shareholder, share class, quantity, price)
  - [x] Split form (share class, split ratio)
  - [x] Client-side validation per type, board approval checkbox, notes textarea
  - [x] Review step with formatted data display and total value calculation
  - [x] useCreateTransaction + useSubmitTransaction TanStack Query mutation hooks
  - [x] transactions.form.* i18n namespace (~50 keys PT-BR + EN)
  - [x] 38 component tests (all passing)
- [x] Transaction detail page with status timeline (visual StatusTimeline, buildTimelineSteps, DetailSkeleton)
- [x] Approval workflow UI (submit, approve, confirm, retry, cancel) with ConfirmDialog, 5 action buttons conditional on status
  - [x] useApproveTransaction + useConfirmTransaction TanStack Query mutation hooks
  - [x] transactions.detail.* i18n namespace (~50 keys, PT-BR + EN)
  - [x] Type-specific field rendering (ISSUANCE/TRANSFER/CONVERSION/CANCELLATION/SPLIT)
  - [x] Brazilian formatting (BRL currency, pt-BR numbers, dates)
  - [x] 37 component tests (all passing)

### 4.8 Funding Rounds Page

- [x] Round list with status badges
- [x] Create round form (2-step wizard Details→Review, 7 round type cards with icons, share class dropdown, financial terms with auto post-money calc, cross-field validation min≤target/hardCap≥target, useCreateFundingRound hook, fundingRounds.form.* i18n ~50 keys PT-BR+EN, 37 tests)
- [x] Round detail page with commitments table, progress bar, status timeline, stat cards, 3-tab layout (Commitments/Details/Pro-Forma), add commitment modal, payment management (mark received/confirm/cancel), round lifecycle actions (open/close/cancel) with confirmation dialogs, lazy pro-forma loading, 7 new TanStack Query hooks (useOpenFundingRound, useCloseFundingRound, useRoundCommitments, useAddCommitment, useConfirmPayment, useCancelCommitment, useRoundProForma), fundingRounds.detail.* i18n ~70 keys PT-BR+EN, 51 tests

### 4.9 Option Plans Page

- [x] Plan list with pool utilization progress bar, stat cards, status filter, close action, pagination
- [x] Grant list with employee info, vesting details, status badges, cancel action, pagination
- [x] Exercise list with payment reference, total cost, status badges, cancel action, pagination
- [x] Three-tab layout (Plans / Grants / Exercises) with shared page header
- [x] TanStack Query hooks (useOptionPlans, useClosePlan, useOptionGrants, useCancelGrant, useOptionExercises, useCancelExercise)
- [x] i18n keys for optionPlans namespace (~80 keys PT-BR + EN)
- [x] 53 component tests
- [x] Create plan form (2-step wizard Details→Review, 3 termination policy cards Forfeiture/Acceleration/Pro-rata, share class dropdown, exercise window configuration, useCreateOptionPlan hook, optionPlans.form.* i18n namespace ~30 keys PT-BR+EN, 42 tests)
- [x] Plan detail: grants table, pool stats — DONE: 4 stat cards (Total Pool, Granted, Available, Exercised) with ocean-600 highlight, pool utilization progress bar with percentage, 2-tab layout (Grants/Details), Grants tab: status filter dropdown, 8-column data table (Employee, Grant Date, Quantity, Strike Price, Vesting, Exercised, Status, Actions) with cancel grant dialog + view link, pagination, empty state with CTA. Details tab: Plan Information card (name, share class, status, board approval date, created at) + Plan Terms card (termination policy, exercise window, total pool, notes). Close plan confirmation dialog for ACTIVE plans. New Grant button with planId query param. Uses useOptionPlan+useOptionGrants+useClosePlan+useCancelGrant hooks. optionPlans.planDetail.* i18n namespace ~20 keys PT-BR+EN. 34 component tests
- [x] Create grant form (2-step wizard Details→Review, 3-section layout Employee/GrantTerms/Vesting, plan dropdown with available options display, shareholder linking, total value calculation, vesting frequency MONTHLY/QUARTERLY/ANNUALLY, acceleration on CoC checkbox, client-side validation quantity≤available/cliff≤vesting/expirationDate>grantDate, useCreateOptionGrant mutation hook, optionPlans.grantForm.* i18n namespace ~55 keys PT-BR+EN, 49 tests)
- [x] Grant detail: vesting schedule timeline/table, exercise history — DONE: 3-tab layout (Overview/Vesting/Exercises), Overview tab with Grant Information card (employee name+email, plan link, status badge, grant/expiration dates, shareholder link, cancelled date) + Grant Terms card (quantity, strike price, total value calculation, cliff months, vesting duration, vesting frequency, termination policy, notes), Vesting tab with progress bar+percentage, cliff date+met status, next vesting date+amount, vesting schedule table with date/type badges (Cliff/Monthly/Quarterly/Annual)/quantity/cumulative/vesting% columns + past-date check marks, Exercises tab with exercise table date/quantity/total cost/payment ref/status badges (Pending Payment/Payment Confirmed/Shares Issued/Completed/Cancelled)/cancel action, pagination, empty state. 4 stat cards (Granted active/highlighted, Vested, Exercisable, Exercised). Cancel grant button+dialog for ACTIVE grants. Back link to plan detail page. useOptionGrant+useGrantVestingSchedule+useOptionExercises+useCancelGrant+useCancelExercise hooks. optionPlans.grantDetail.* i18n namespace ~65 keys PT-BR+EN. 41 component tests
- [ ] Exercise request form (employee view)
- [ ] Exercise confirmation form (admin view)

### 4.10 Convertible Instruments Page

- [x] Instrument list with summary stats (total principal, total accrued) — DONE: 4 stat cards (Total Instruments, Outstanding, Total Principal, Total Accrued Interest) with ocean-600 highlight, type+status filter dropdowns, 9-column data table (Date, Type, Investor, Principal, Interest Rate, Accrued Interest, Maturity, Status, Actions), cancel dialog for cancellable statuses (ACTIVE, PENDING), BRL currency formatting, pt-BR date formatting, pagination, useConvertibles+useCancelConvertible TanStack Query hooks, convertibles.* i18n namespace (~50 keys PT-BR+EN), 25 component tests
- [x] Create instrument form (4 Brazilian types) — DONE: 2-step wizard Details→Review, 4 instrument type cards (Mútuo Conversível, Investimento Anjo, Misto, MAIS) with icons/colors, investor dropdown from shareholders, financial details (principal amount, interest rate % with decimal conversion, interest type simple/compound, issue/maturity dates), conversion terms section (discount rate, valuation cap, qualified financing threshold, conversion trigger dropdown, target share class, auto-convert + MFN clause checkboxes), notes textarea, client-side validation (required fields, positive numbers, rate bounds 0-100, maturityDate > issueDate), review step with conditional optional fields + formatted currency/percentage/date, interest/discount rate percentage→decimal conversion in payload, useCreateConvertible mutation hook, convertibles.form.* i18n namespace ~55 keys PT-BR+EN, 42 component tests
- [x] Instrument detail: interest breakdown, conversion scenarios — DONE: 3-tab layout (Details/Interest/Scenarios), Details tab with summary card (investor, type+status badges, principal, interest rate/type, issue/maturity dates, notes) + conversion terms card (discount rate, valuation cap, qualified financing threshold, conversion trigger, target share class, auto-convert, MFN clause) + conversion data card for CONVERTED status (conversion amount, price, shares issued, method used) + metadata sidebar (createdAt, convertedAt/redeemedAt/cancelledAt), Interest tab with 3 summary stats (days elapsed, accrued interest, total value) + interest breakdown table with period/days/accrued/cumulative columns, Scenarios tab with conversion amount + cap trigger info + scenarios table (valuation, round price, discount method, cap method, best method badge, shares, ownership, dilution), 4 stat cards (Principal active/highlighted, Accrued Interest, Total Value, Days to Maturity), maturity warning banner (cream for ≤30 days, red for expired), Cancel + Redeem action buttons with confirmation dialogs for OUTSTANDING/MATURED statuses, RedeemDialog with amount + payment reference inputs, useConvertible+useConvertibleInterest+useConvertibleScenarios+useCancelConvertible+useRedeemConvertible hooks, convertibles.detail.* i18n namespace ~80 keys PT-BR+EN, 56 component tests
- [ ] Conversion scenario simulator (slider for valuation → shows resulting shares)
- [ ] Convert action with confirmation

### 4.11 Settings Pages

- [x] Company Info tab: edit company details — DONE: Two-tab layout (Company/Members) with ocean-600 underline active tab indicator, Company Info form with editable name+description fields, read-only entityType/CNPJ/status/currency/timezone/foundedDate/locale, dirty-tracking save button, useCompanyDetail+useUpdateCompany TanStack Query hooks, loading skeletons, success/error toast notifications, settings.company.* i18n namespace (~25 keys PT-BR+EN)
- [x] Members tab: list, invite, role management — DONE: 4 stat cards (Total Members, Active, Pending, Administrators) with ocean-600 highlight, search input + role/status filter dropdowns, member table with avatar+initials/name/email/role badge/status badge/invited date/action menu, Invite Member dialog (email+role+optional message), Change Role dialog (role select), Remove Member dialog (confirmation), Resend Invitation action for PENDING members, hidden actions for REMOVED members, pagination, useMembers+useInviteMember+useUpdateMember+useRemoveMember+useResendInvitation hooks, settings.members.* i18n namespace (~60 keys PT-BR+EN), 38 component tests
- [ ] Share Classes tab: manage classes
- [x] Notifications tab: preference toggles — DONE: Implemented as part of P4.13 Notifications page (Preferences tab with 5 category toggles, security locked)
- [ ] Security tab: sessions, MFA status (from Privy)

### 4.12 Member Invitation Flow

- [x] Public invitation acceptance page (`/invitations/:token`) — DONE: Full invitation acceptance page under (auth) route group reusing centered card layout. Three-state UI: loading (Privy init + invitation fetch), error (404 not found, 410 expired with distinct icons), and invitation details. Company card with Building2 icon, role badge (color-coded per role), inviter name, dates (pt-BR dd/MM/yyyy), email. Uses useInvitationDetails + useAcceptInvitation TanStack Query hooks (retry: false, staleTime: 60s). ApiError instanceof check for 410 expired detection. invitations.* i18n namespace (25 keys PT-BR+EN), errors.member.* and errors.invitation.* error keys. 22 component tests.
- [x] Login/register → accept invitation → redirect to company dashboard — DONE: Unauthenticated users see "Sign in" (hasExistingAccount) or "Create account" button, both trigger Privy login(). Authenticated users see "Accept invitation" button. On accept: mutateAsync → toast.success → router.replace('/dashboard'). Error handling via useErrorToast. isLoggingIn state shows loading spinner. Accept button disabled during pending mutation.

### 4.13 Notifications

- [x] Notification bell with unread count badge in topbar — DONE: Replaced hardcoded red dot with useUnreadCount hook (30s polling), numeric badge showing count (capped at 99+), conditional rendering when count > 0
- [x] Notification dropdown/panel (recent notifications) — DONE: NotificationDropdown component showing 5 most recent notifications with type-colored icons, relative time, company name, mark as read per item, mark all as read, loading skeletons, empty state, "View all" link to notifications page
- [x] Notification list page (all notifications with pagination) — DONE: Two-tab layout (All/Preferences). All tab: read status filter + category filter dropdowns, notification list with type badges + formatted dates + company names, pagination with page controls. Preferences tab: 5 category toggles (security locked), save button. Delete confirmation dialog. useNotifications+useMarkAsRead+useMarkAllAsRead+useDeleteNotification+useNotificationPreferences+useUpdatePreferences hooks. notifications.* i18n namespace (PT-BR+EN). 53 component tests (15 dropdown + 38 page).
- [x] Mark read/unread actions — DONE: Mark as read per notification, mark all as read batch action, toast notifications on success
- [x] Sidebar navigation updated — DONE: Added Notifications nav item to sidebar.tsx and mobile-sidebar.tsx (with Bell icon). Mobile sidebar synced with desktop sidebar (added Share Classes, Funding Rounds, Convertibles items that were missing).

### 4.14 Frontend Testing (31 test suites, 951 tests)

- [x] Configure Jest + React Testing Library (infrastructure is in place: jest.config.ts, jest.setup.ts, dependencies installed)
- [ ] Tests for all auth flows (login, logout, protected routes)
- [ ] Tests for all form components (validation, submission, error display)
- [ ] Tests for all data display components (tables, cards, charts)
- [ ] Tests for API client (error handling, auth header, CSRF)
- [ ] Target 80% coverage (100% for auth components)

---

## P5 — Prisma Schema Additions

Models/enums that exist in specs but are missing from the schema:

- [x] `WaterfallScenario` model — for exit waterfall scenarios (exit-waterfall.md) — DONE (v0.0.33)
- [x] `ExportJob` model + `ExportJobType` + `ExportJobStatus` enums — DONE (v0.0.34)
- [ ] `ProfileDocumentDownload` model — for dataroom access tracking (company-dataroom.md)
- [ ] Add `lastBlockchainSyncAt` and `lastBlockchainHash` fields to Company model (cap-table-reconciliation.md)
- [ ] Add `PRE_SEED` and `OTHER` values to `RoundType` enum (funding-rounds.md)
- [x] ~~`AuditHashChain` model~~ — already exists in schema (lines 1211–1220)
- [x] ~~`ConsentRecord` model~~ — already exists in schema (lines 1178–1205)
- [x] ~~Add `locale` field to User model~~ — already exists (line 23, default `"pt-BR"`)
- [x] ~~`LitigationRecord` model~~ — not needed; litigation data stored as JSONB fields on CompanyProfile per spec
- [ ] Add PostgreSQL immutability trigger for `audit_logs` table (migration)
- [ ] Add table partitioning for `audit_logs` by month (migration)

---

## P6 — Documentation Debt

### Missing User Flow Docs (11)

- [ ] `docs/user-flows/company-cnpj-validation.md`
- [x] `docs/user-flows/company-profile.md` — DONE (v0.0.30)
- [ ] `docs/user-flows/company-dataroom.md`
- [ ] `docs/user-flows/company-litigation.md`
- [ ] `docs/user-flows/company-blockchain-admin.md`
- [ ] `docs/user-flows/cap-table-reconciliation.md`
- [x] `docs/user-flows/exit-waterfall.md` — DONE (v0.0.33)
- [x] `docs/user-flows/reports-analytics.md` — DONE (v0.0.34)
- [x] `docs/user-flows/notifications.md` — DONE (v0.0.59)
- [ ] `docs/user-flows/blockchain-integration.md`
- [x] `docs/user-flows/document-generation.md` — DONE (v0.0.29)
- [ ] `docs/user-flows/document-signatures.md`
- [ ] `docs/user-flows/audit-logging.md`

### Spec File Updates (69 P0 fixes)

- [ ] Update all 26 spec files to match implementation conventions (camelCase JSON, :companyId URL params, standard envelope, Shareholding model name, contentHash field name, etc.)
- [ ] These are documentation-only changes — the code already follows the correct conventions

### Missing Spec Files

- [ ] `specs/error-codes.md` — complete error code catalog (referenced by error-handling.md but doesn't exist)

---

## P7 — CI/CD & DevOps

- [ ] GitHub Actions workflow: lint + type-check + test (backend) + test (frontend) + build
- [ ] Coverage thresholds: 85% backend, 80% frontend (fail CI if below)
- [ ] `gitleaks` secret scanning in CI
- [ ] Dependabot configuration for automated dependency updates
- [ ] Husky pre-commit hooks: lint-staged, type-check, secret scan
- [ ] Docker Compose for local development (PostgreSQL, Redis)
- [ ] Railway deployment configuration (backend)
- [ ] Vercel deployment configuration (frontend)

---

## Dependency Graph (simplified)

```
P1 Redis+Bull (DONE v0.0.16) ┬──→ P3.1 Notifications
                              ├──→ P3.2 Audit Logging (core DONE, integration pending) (+ P1 redactPii)
                              ├──→ P3.3 KYC (DONE) (+ P1 AWS)
                              ├──→ P3.7 Dataroom (+ P1 AWS)
                              ├──→ P3.8 Blockchain
                              ├──→ P3.10 Litigation (+ P3.6 Company Profile)
                              ├──→ P3.11 Reconciliation (+ P3.8)
                              ├──→ P3.13 Reports (+ P1 AWS)
                              ├──→ P3.14 CNPJ Validation (+ P3.3 DONE)
                              ├──→ P2 Convertible daily accrual job
                              └──→ P0 BUG-1 session fix (DONE v0.0.17)

P1 AWS SDK (DONE v0.0.18) ──┬──→ P1 Email (SES)
                            ├──→ P1 EncryptionService (DONE)
                            ├──→ P3.3 KYC (DONE) (S3+KMS)
                            ├──→ P3.4 Document Generation (DONE v0.0.29) (S3)
                            └──→ P3.7 Dataroom (S3)

P3.4 Document Generation (DONE v0.0.29) ───→ P3.5 Document Signatures (+ P3.8 Blockchain)

P3.6 Company Profile ───────→ P3.10 Litigation (auto-trigger on profile creation)

P3.8 Blockchain ────────────┬──→ P3.9 Blockchain Admin
                            ├──→ P3.11 Reconciliation
                            └──→ P3.5 Document Signatures (anchoring)

P4.1 Frontend Foundation ───→ All P4.x pages
```

---

## Recommended Implementation Order

**Sprint 1**: P0 bugs (BUG-1 DONE v0.0.17; BUG-2–6 DONE v0.0.15), P1 Redis+Bull (DONE v0.0.16), P1 AWS SDK (DONE v0.0.18)
**Sprint 2**: P1 remaining (~~CSRF~~ DONE, ~~redactPii~~ DONE, Sentry, ~~Email~~ DONE, ~~EncryptionService~~ DONE, ~~body limits~~ DONE, ~~helmet gap~~ DONE, test infra deps), P2 Auth gaps (~~Redis lockout~~ DONE)
**Sprint 3**: P3.1 Notifications (module built, WebSocket + cross-module integration pending), P3.2 Audit Logging (core module built — @Auditable decorator, AuditInterceptor, AuditService, Bull queue processor, controller with list/detail/verify; remaining: ClsModule before-state, daily hash chain job, DLQ monitoring, DB immutability trigger, partitioning, cross-module integration of all 50+ events, export)
**Sprint 4**: ~~P3.3 KYC~~ DONE, ~~P3.14 CNPJ Validation~~ DONE, P2 Company gaps
**Sprint 5**: ~~P3.4 Document Generation~~ DONE (v0.0.29), P3.7 Dataroom
**Sprint 6**: ~~P3.6 Company Profile~~ DONE, P3.10 Litigation
**Sprint 7**: P3.8 Blockchain, P3.9 Blockchain Admin
**Sprint 8**: P3.5 Document Signatures, P3.11 Reconciliation
**Sprint 9**: P3.12 Exit Waterfall, P3.13 Reports & Analytics
**Sprint 10**: P2 remaining module gaps (all existing modules)
**Sprint 11-13**: P4 Frontend (Foundation → Auth → Dashboard → Cap Table → Shareholders → Transactions → remaining pages)
**Sprint 14**: P5 Schema additions (as needed per module), P6 Docs, P7 CI/CD
