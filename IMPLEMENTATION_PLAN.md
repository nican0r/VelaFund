# Navia MVP — Implementation Plan v21.0

> **Generated**: 2026-02-24 | **Tests**: 628 passing | **Backend modules**: 12 of 23 built
>
> **Purpose**: Prioritized bullet-point list of all remaining work, ordered by dependency and criticality.
> Items marked with checkboxes. `[x]` = complete, `[ ]` = remaining.

---

## Current State

**Built backend modules** (12): auth, company, member, share-class, shareholder, cap-table, transaction, funding-round, option-plan (with exercises), convertible

**Entirely missing backend modules** (13): kyc, notification, document-generation, document-signatures, audit-logging, blockchain-integration, company-profile, company-dataroom, company-litigation, company-blockchain-admin, cap-table-reconciliation, reports-analytics, exit-waterfall

**Frontend**: Scaffolding only (layout shell, static mock pages, typed API client with hardcoded `Accept-Language: 'pt-BR'`). No Privy SDK, no next-intl, no shadcn/ui components, no functional pages, no tests (0 `.test.tsx` files).

**Infrastructure**: No Redis/Bull (`@nestjs/bull`, `bull`, `ioredis` not in package.json), no AWS SDK (`@aws-sdk/*` not in package.json), no `@sentry/nestjs`, no EncryptionService, no CSRF middleware, no `redactPii()` utility, no body size limits, no email sending.

**Prisma schema**: 32 models, 36 enums. Models already present: AuditHashChain, ConsentRecord. Models missing: WaterfallScenario, ExportJob, ProfileDocumentDownload. User.locale field exists.

---

## P0 — Bug Fixes (immediate)

- [ ] **BUG-1 (CRITICAL)**: Raw Privy token (1-6h expiry) stored in 7-day cookie → 401 after token expiry. Need `/auth/refresh` endpoint or Redis-backed session store. **Blocked on Redis infra (see P1).**
- [x] **BUG-2**: ~~Option exercise creation requires `@Roles('ADMIN')`~~ FIXED (v0.0.15): Changed to `@Roles('ADMIN', 'EMPLOYEE')` on createExercise and cancelExercise endpoints. Added `validateGranteeOrAdmin()` service-layer check that verifies the user is either the grant beneficiary (via Shareholder.userId linkage) or an ADMIN member. cancelExercise now accepts userId parameter. 1 new test added.
- [x] **BUG-3**: ~~Typo `zeroPremoneeyShares`~~ FIXED (v0.0.15): Renamed to `zeroPremoneyShares` in convertible.service.ts (2 locations) and app-exception.ts (1 location).
- [x] **BUG-4**: ~~accruedInterest from DB always 0~~ FIXED (v0.0.15): Extracted `calculateAccruedInterest()` private helper and used it in `getConversionScenarios()` and `convert()` instead of reading stale DB field. Same calculation logic as `getInterestBreakdown()`. Daily accrual job still deferred until Redis.
- [x] **BUG-5**: ~~ConvertibleController local AuthenticatedUser~~ FIXED (v0.0.15): Removed local interface, importing from `auth/decorators/current-user.decorator.ts`.
- [x] **BUG-6**: ~~RoundType enum missing values~~ FIXED (v0.0.15): Added `PRE_SEED` and `OTHER` to both Prisma `RoundType` enum and `RoundTypeDto`. Prisma client regenerated. Migration pending (no database connection in dev env).

---

## P1 — Critical Infrastructure

These are prerequisites for many downstream features.

- [ ] **Redis + Bull queue setup**
  - [ ] Add `@nestjs/bull`, `bull`, `ioredis` dependencies (none currently in package.json)
  - [ ] Configure BullModule.forRoot with Redis connection (Railway Redis URL)
  - [ ] REDIS_URL already in `.env.example` — add to backend ConfigModule validation
  - [ ] Create Bull health check in HealthController
  - _Unlocks_: audit logging, notifications, email sending, daily interest accrual, async CNPJ validation, export jobs, session store

- [ ] **AWS SDK integration**
  - [ ] Add `@aws-sdk/client-s3`, `@aws-sdk/client-ses`, `@aws-sdk/client-kms`, `@aws-sdk/s3-request-presigner` (none currently in package.json)
  - [ ] Create `AwsModule` with S3Service, SesService, KmsService as injectable providers
  - [ ] AWS credentials already in `.env.example` — add to backend ConfigModule validation
  - [ ] S3Service: upload, download, delete, generatePresignedUrl (15-min expiry)
  - [ ] SesService: sendTemplatedEmail with locale-aware template selection
  - [ ] KmsService: encrypt, decrypt (AES-256-GCM via KMS)
  - _Unlocks_: document storage, email sending, PII encryption, KYC document storage

- [ ] **EncryptionService + Blind Index**
  - [ ] Create `EncryptionModule` with encrypt/decrypt via KMS
  - [ ] Implement `createBlindIndex(value, key)` using HMAC-SHA256
  - [ ] BLIND_INDEX_KEY already in `.env.example`
  - [ ] Migrate Shareholder CPF/CNPJ to encrypted storage with blind index (currently stored as SHA-256 hash only for uniqueness, but not actually encrypted via KMS)
  - _Unlocks_: LGPD compliance for PII fields

- [ ] **CSRF Middleware** (currently does not exist anywhere in codebase)
  - [ ] Create `common/middleware/csrf.middleware.ts` with double-submit cookie pattern per `security.md`
  - [ ] Set `navia-csrf` cookie on GET requests
  - [ ] Validate `X-CSRF-Token` header on POST/PUT/PATCH/DELETE
  - [ ] Register in `main.ts` (currently only `RequestIdMiddleware` is registered)
  - [ ] Update frontend API client to read and send CSRF token (currently missing)

- [ ] **redactPii() utility** (currently does not exist anywhere in codebase)
  - [ ] Create `common/utils/redact-pii.ts` per `error-handling.md`
  - [ ] Mask CPF: `***.***.***-XX`, Email: `n***@domain.com`, CNPJ: `**.***.****/****-XX`, Wallet: `0x1234...abcd`, IP: truncate to /24
  - [ ] Integrate with Sentry `beforeSend` and audit logging
  - [ ] Note: `GlobalExceptionFilter` currently logs raw exception messages without PII redaction

- [ ] **Sentry integration** (`@sentry/nestjs` not in package.json)
  - [ ] Add `@sentry/nestjs` dependency
  - [ ] SENTRY_DSN already in `.env.example`
  - [ ] Add Sentry to GlobalExceptionFilter: 5xx → error level, unhandled → fatal, 4xx → breadcrumb only
  - [ ] Add `beforeSend` hook for PII redaction (requires redactPii)
  - [ ] Add Sentry to frontend (`@sentry/nextjs` — not currently in frontend package.json)

- [ ] **Email sending (AWS SES)**
  - [ ] Create email template system: `templates/email/{templateName}/{locale}.mjml`
  - [ ] Implement MJML → HTML compilation
  - [ ] Create base email templates: invitation, exercise-notification, export-ready, password-reset
  - [ ] Wire SES into MemberService invite (replace the 2 TODO comments at `member.service.ts:137,354` — the only 2 TODOs in the entire backend)

- [ ] **Body size limits** (not configured in `main.ts`)
  - [ ] Add `app.use(json({ limit: '1mb' }))` to `main.ts`
  - [ ] Add `app.use(urlencoded({ extended: true, limit: '1mb' }))` to `main.ts`
  - [ ] Configure Multer per-route limits (10MB for file uploads, 5MB bulk ops)
  - [ ] Add `sharp` dependency for EXIF metadata stripping (not currently in package.json)

- [ ] **Helmet gap**
  - [ ] Add `permittedCrossDomainPolicies: false` to helmet config in `main.ts` (present in `security.md` spec, missing from implementation)

- [x] **.env.example update** — already contains all critical vars: DATABASE_URL, REDIS_URL, PORT, NODE_ENV, FRONTEND_URL, PRIVY_APP_ID, PRIVY_APP_SECRET, VERIFIK_API_TOKEN, VERIFIK_BASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_KMS_KEY_ARN, AWS_S3_DOCUMENTS_BUCKET, AWS_S3_KYC_BUCKET, BLIND_INDEX_KEY, SENTRY_DSN, BIGDATACORP_API_TOKEN, BIGDATACORP_BASE_URL

- [ ] **Test infrastructure gaps**
  - [ ] Add `jest-mock-extended` to devDependencies (testing rules reference `mockDeep` but it's not installed — tests currently use hand-written mocks)
  - [ ] Add `@faker-js/faker` to devDependencies (testing rules reference it but not installed)

---

## P2 — Existing Module Gaps

Gaps in the 12 built modules, ordered by module.

### Auth Module

- [ ] `/auth/refresh` endpoint — refresh Privy token or create Redis-backed session (depends on P1 Redis)
- [ ] Inactivity timeout (2h) — track last activity timestamp, invalidate stale sessions
- [ ] Move failed-attempt lockout from in-memory Map to Redis (current 10K cap is fragile)
- [ ] Duplicate wallet check — prevent two users from linking the same wallet address
- [ ] Privy API retry with exponential backoff (currently no retry on verify failure)
- [ ] Audit logging events: AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILED, AUTH_LOGOUT (depends on P3 Audit module)
- [ ] Onboarding wizard status tracking per `authentication.md` spec (step tracking: profile → company → done)

### Company Module

- [ ] Async CNPJ validation via Verifik + Bull queue per `company-cnpj-validation.md` (depends on P1 Redis+Bull, P3 KYC infra)
- [ ] `GET /companies/:id/setup-status` endpoint for polling CNPJ validation progress
- [ ] KYC gate — require user KYC before creating company (depends on P3 KYC module)
- [ ] Blockchain contract deployment trigger on ACTIVE status (depends on P3 Blockchain module)
- [ ] Company dissolution — archive related data, prevent new operations

### Member Module

- [ ] Send invitation email via SES (2 TODO comments at `member.service.ts:137,354`) — depends on P1 Email
- [ ] `GET /companies/:companyId/members/:id` single-member endpoint (spec has it, confirmed missing from controller and service)
- [ ] Audit logging events: COMPANY_MEMBER_INVITED, COMPANY_MEMBER_ACCEPTED, COMPANY_MEMBER_REMOVED, COMPANY_ROLE_CHANGED (depends on P3 Audit module)
- [ ] Permission override management endpoints (spec defines fine-grained overrides, not fully exposed in API)

### Share Class Module

- [ ] S.A. company type validation: require at least one COMMON_SHARES class before first issuance
- [ ] Ltda. auto-create QUOTA class on company creation (currently no auto-creation logic)
- [ ] Immutable field error: return specific error code when trying to change fields after shares are issued (currently may silently succeed or give generic error)
- [ ] `DELETE` endpoint — only when totalIssued = 0

### Shareholder Module

- [ ] `GET /companies/:companyId/shareholders/:id/transactions` — transaction history for specific shareholder
- [ ] `GET /users/me/investments` — investor portfolio view across companies
- [ ] Application-level CPF encryption (currently only blind index hash, no actual KMS encryption) — depends on P1 EncryptionService
- [ ] Wallet address auto-link from Privy embedded wallet when shareholder accepts invite
- [ ] Invite shareholder to platform endpoint — link external shareholder to User account

### Cap Table Module

- [ ] Auto-snapshot creation after every confirmed transaction (currently manual only)
- [ ] PDF/XLSX/CSV export endpoints per `reports-analytics.md` (depends on P3 Reports module or can be standalone)
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

- [ ] Create `backend/src/notification/` module
- [ ] Prisma model: Notification (already in schema), UserNotificationPreferences (already in schema)
- [ ] Bull queue: `notification` queue for async delivery
- [ ] NotificationService: create, markRead, markAllRead, getUserNotifications
- [ ] NotificationController: 7 endpoints per spec (list, unread count, mark read, mark all read, preferences, update preferences, delete)
- [ ] 22 notification types per spec catalog
- [ ] Critical notifications: cannot be disabled (COMPANY_ROLE_CHANGED, COMPANY_MEMBER_REMOVED, etc.)
- [ ] NotificationGateway: WebSocket for real-time push (optional MVP, can defer)
- [ ] Integrate with all existing modules: trigger notifications on key events
- [ ] Tests: service + controller specs
- [ ] User flow doc: `docs/user-flows/notifications.md`

### 3.2 Audit Logging Module (spec: `.claude/rules/audit-logging.md`)

- [ ] Create `backend/src/audit-log/` module
- [ ] Prisma models: AuditLog (already in schema), AuditHashChain (already in schema)
- [ ] Bull queue: `audit-log` queue per spec
- [ ] AuditLogProcessor: Bull worker that persists events to DB
- [ ] AuditInterceptor: NestJS interceptor for `@Auditable()` decorator
- [ ] `@Auditable()` decorator with action, resourceType, captureBeforeState, captureAfterState
- [ ] AuditService: programmatic logging for SYSTEM events (background jobs)
- [ ] AuditLogController: list (paginated, filtered), detail, export (CSV/PDF/XLSX), verify hash chain
- [ ] Before-state capture via AsyncLocalStorage (ClsModule)
- [ ] PII masking at write time using redactPii() (depends on P1 redactPii)
- [ ] Daily hash chain job (SHA-256, runs at 00:05 UTC)
- [ ] Dead letter queue monitoring (alert at 10/50 failed jobs)
- [ ] PostgreSQL immutability trigger (migration to add BEFORE UPDATE OR DELETE trigger on audit_logs)
- [ ] PostgreSQL table partitioning for audit_logs by month (migration)
- [ ] Role access: ADMIN + LEGAL only
- [ ] Integrate `@Auditable()` into all 12 existing controllers
- [ ] All 50+ event types from the catalog
- [ ] Tests: processor, interceptor, service, controller specs
- [ ] User flow doc: `docs/user-flows/audit-logging.md`

### 3.3 KYC Verification Module (spec: `kyc-verification.md`)

- [ ] Create `backend/src/kyc/` module
- [ ] Prisma model: KYCVerification (already in schema)
- [ ] Verifik API integration: CPF validation, document OCR, facial recognition, AML screening
- [ ] KycService: startVerification, verifyCpf, uploadDocument, verifyFace, screenAml, getStatus
- [ ] KycController: 6+ endpoints per spec
- [ ] 4-step flow: CPF → Document → Face → AML
- [ ] Score thresholds and attempt limits (3 attempts per step)
- [ ] KYC gating: block company creation until KYC approved
- [ ] Bull queue for async Verifik API calls
- [ ] File upload to S3 (KYC bucket with SSE-KMS)
- [ ] EXIF metadata stripping (sharp — dependency needs to be added)
- [ ] Tests: service + controller specs
- [ ] User flow doc: `docs/user-flows/kyc-verification.md` (exists, needs update when backend is built)
- _Depends on_: P1 AWS SDK, P1 Redis+Bull

### 3.4 Document Generation Module (spec: `document-generation.md`)

- [ ] Create `backend/src/document/` module
- [ ] Prisma models: Document, DocumentTemplate (already in schema)
- [ ] Handlebars template engine for variable interpolation
- [ ] Puppeteer for HTML → PDF conversion
- [ ] DocumentService: generate, upload, list, getPresignedUrl, delete
- [ ] DocumentController: CRUD + generate endpoint
- [ ] 5 pre-seeded document templates: Contrato Social, Ata de Assembleia, Boletim de Subscrição, Acordo de Sócios, Termo de Cessão
- [ ] Template variable resolution from company/shareholder/transaction data
- [ ] S3 storage for generated documents
- [ ] Draft → Generated flow with preview
- [ ] Tests: service + controller specs
- [ ] User flow doc: `docs/user-flows/document-generation.md`
- _Depends on_: P1 AWS SDK (S3)

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

### 3.6 Company Profile Module (spec: `company-profile.md`)

- [ ] Create `backend/src/company-profile/` module
- [ ] Prisma models: CompanyProfile, ProfileMetric, ProfileTeamMember, ProfileView (all already in schema)
- [ ] ProfileService: create/update profile, publish/unpublish, metrics calculation, team members
- [ ] ProfileController: CRUD + publish + public view endpoints
- [ ] Email-gated access for non-public profiles
- [ ] Profile analytics (view count, document downloads)
- [ ] Auto-trigger BigDataCorp litigation check on profile creation (depends on P3.10)
- [ ] Tests: service + controller specs
- [ ] User flow doc: `docs/user-flows/company-profile.md`

### 3.7 Company Dataroom Module (spec: `company-dataroom.md`)

- [ ] Create `backend/src/dataroom/` module (or extend company-profile)
- [ ] Prisma models: ProfileDocument (already in schema), ProfileDocumentDownload (**missing from schema** — needs migration)
- [ ] DataroomService: upload, categorize, list, generatePresignedUrl, delete
- [ ] DataroomController: CRUD + download tracking
- [ ] Document categories per spec (PITCH_DECK, FINANCIALS, LEGAL, PRODUCT, TEAM, OTHER — enum already exists)
- [ ] PDF thumbnail generation and page count extraction via Bull job
- [ ] Pre-signed URL access with 15-min expiry
- [ ] Access logging for download tracking (ProfileDocumentDownload records)
- [ ] Tests: service + controller specs
- [ ] User flow doc: `docs/user-flows/company-dataroom.md`
- _Depends on_: P1 AWS SDK (S3), P1 Redis+Bull

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

### 3.10 Company Litigation Verification Module (spec: `company-litigation-verification.md`)

- [ ] Create `backend/src/litigation/` module
- [ ] No separate Prisma model needed — litigation data stored as JSONB fields on CompanyProfile (litigationStatus, litigationData, litigationFetchedAt, litigationError — all already in schema)
- [ ] BigDataCorp API integration: CNPJ-based lawsuit/protest lookup
- [ ] LitigationService: verify, getReport, refresh
- [ ] Bull queue for async BigDataCorp API calls
- [ ] Immutable risk data storage (litigation fields on CompanyProfile not editable by any role)
- [ ] PII masking for plaintiff names before storage
- [ ] Risk level classification (LOW/MEDIUM/HIGH based on active lawsuit count + total value)
- [ ] Tests: service specs
- [ ] User flow doc: `docs/user-flows/company-litigation.md`
- _Depends on_: P1 Redis+Bull, P3.6 Company Profile

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

### 3.12 Exit Waterfall Module (spec: `exit-waterfall.md`)

- [ ] Create `backend/src/exit-waterfall/` module
- [ ] Prisma model: WaterfallScenario (**missing from schema** — needs migration)
- [ ] WaterfallService: createScenario, calculateWaterfall, compareScenarios, breakeven
- [ ] WaterfallController: CRUD + calculate + compare endpoints
- [ ] 7-step liquidation preference algorithm (per spec)
- [ ] Participating vs non-participating preferred, participation cap handling
- [ ] Breakeven analysis (binary search, ≤100 iterations)
- [ ] Optional inclusion of vested unexercised options and as-if-converted convertibles
- [ ] Scenario comparison (side-by-side waterfall at different valuations)
- [ ] Tests: service + controller specs
- [ ] User flow doc: `docs/user-flows/exit-waterfall.md`

### 3.13 Reports & Analytics Module (spec: `reports-analytics.md`)

- [ ] Create `backend/src/reports/` module
- [ ] Prisma model: ExportJob (**missing from schema** — needs migration with ExportFormat + ExportStatus enums)
- [ ] ReportsService: generateCapTableReport, generateDilutionReport, generatePortfolioReport, dueDiligencePackage
- [ ] ReportsController: multiple report endpoints per spec
- [ ] Export formats: PDF (Puppeteer), XLSX (exceljs), CSV (csv-writer), ZIP (archiver) — add deps
- [ ] Async export via Bull for large datasets (>1000 rows → 202 Accepted + email notification)
- [ ] Ownership reports, dilution analysis, investor portfolio, vesting summary
- [ ] Due diligence ZIP package (cap table + shareholder registry + transaction history + documents + audit trail)
- [ ] Tests: service + controller specs
- [ ] User flow doc: `docs/user-flows/reports-analytics.md`
- _Depends on_: P1 AWS SDK (S3 + SES), P1 Redis+Bull

### 3.14 Company CNPJ Async Validation (spec: `company-cnpj-validation.md`)

- [ ] Bull job in company module: async CNPJ validation via Verifik after company creation
- [ ] `GET /companies/:id/setup-status` polling endpoint
- [ ] On success: transition company DRAFT → ACTIVE, trigger blockchain deployment
- [ ] On failure: company stays DRAFT, user notified to retry
- [ ] Rate limiting on retry attempts
- [ ] Tests: job processor + endpoint specs
- [ ] User flow doc: `docs/user-flows/company-cnpj-validation.md`
- _Depends on_: P1 Redis+Bull, P3.3 KYC (Verifik client)

---

## P4 — Frontend Implementation

### 4.1 Foundation (must do first)

- [ ] Install and configure Privy React SDK (`@privy-io/react-auth` — not in package.json)
  - [ ] PrivyProvider in `providers.tsx` with app ID (currently only QueryClient + Sonner)
  - [ ] AuthContext: usePrivy() hook wrapper, user state, loading state
  - [ ] Protected route middleware (redirect to /login if unauthenticated)
  - [ ] Persist auth token in API client (from Privy's getAccessToken)

- [ ] Install and configure next-intl (`next-intl` — not in package.json; `messages/` dir exists with partial keys)
  - [ ] Middleware for locale detection
  - [ ] NextIntlClientProvider wrapping app layout
  - [ ] Complete all i18n keys in pt-BR.json and en.json (currently partial — missing: `errors.round.*`, `errors.convertible.*`, `errors.shareholder.*`, `errors.shareClass.*`, `errors.kyc.*`, `errors.doc.*`, `errors.chain.*`, and all feature page namespaces)

- [ ] Initialize shadcn/ui (`src/components/ui/` directory is empty; Radix primitives and CVA installed)
  - [ ] Run `npx shadcn-ui@latest init` with Navia theme
  - [ ] Install core components: Button, Input, Card, Dialog, Select, Table, Badge, Tabs, DropdownMenu, Toast, Skeleton, Avatar, Tooltip, Popover, Command (search)
  - [ ] Fix borderRadius tokens (shadcn defaults vs Navia design system values in `design-system.md`)

- [ ] Wire API client (`src/lib/api-client.ts` — multiple gaps confirmed)
  - [ ] Add auth token to all requests (from Privy — currently no auth header)
  - [ ] Add CSRF token to state-changing requests (currently missing)
  - [ ] Add Accept-Language header from locale (currently hardcoded `'pt-BR'`)
  - [ ] Add X-Request-Id header
  - [ ] 401 interceptor: call logout, redirect to /login?expired=true (currently missing)
  - [ ] Error toast integration via sonner

- [ ] Replace hardcoded user data in layout components
  - [ ] `sidebar.tsx:178-188` — hardcoded "Nelson Pereira" / "nelson@navia.com.br" / "NP" avatar
  - [ ] `mobile-sidebar.tsx:159-170` — same hardcoded user data duplicated
  - [ ] `topbar.tsx:68-74` — same hardcoded user data (third copy)
  - [ ] Wire logout button onClick handler (currently dead UI in all 3 components)
  - [ ] Wire notification bell to real notification count (currently hardcoded red dot)

- [ ] Global error boundary with fallback UI

### 4.2 Auth Pages

- [ ] Login page — wire to Privy login modal (email + Google + Apple); currently static HTML with no onClick handlers
- [ ] Onboarding wizard (3 steps: profile completion → company creation OR join → done)
- [ ] Logout flow (clear cookies, Privy logout, redirect)

### 4.3 Dashboard Page

- [ ] Replace mock data with real API calls (currently all hardcoded values: "1.000.000", "12", "3", "24")
- [ ] Stat cards with real data from API (Total Shares, Shareholders, Share Classes, Last Transaction)
- [ ] Ownership pie chart (Recharts donut — currently "Chart will be rendered here" placeholder) — `GET /companies/:id/cap-table`
- [ ] Recent transactions table — `GET /companies/:id/transactions?limit=5` (currently hardcoded 5 rows)
- [ ] Quick actions card (buttons currently have no onClick handlers)
- [ ] Company switcher in topbar (user may belong to multiple companies)

### 4.4 Cap Table Page (no page exists — sidebar links to 404)

- [ ] Full-width data table with share class columns
- [ ] Summary row (totals, 100%)
- [ ] Ownership/voting power/fully-diluted toggle tabs
- [ ] Export button (PDF, Excel, CSV) — calls backend export endpoint
- [ ] Snapshot selector (point-in-time view)
- [ ] Dilution pie chart visualization

### 4.5 Shareholders Page (no page exists)

- [ ] Shareholder list table with search, filter (type, status), sort, pagination
- [ ] Create shareholder form (modal or page) with CPF/CNPJ validation
- [ ] Shareholder detail page: profile card, holdings table, transaction history, documents tab
- [ ] Beneficial owners management (for CORPORATE type)
- [ ] Foreign shareholder indicator

### 4.6 Share Classes Page (no page exists)

- [ ] Share class list with key metrics (authorized, issued, available)
- [ ] Create share class form with entity type compatibility checks
- [ ] Share class detail: stats, holders list, rights summary

### 4.7 Transactions Page (no page exists)

- [ ] Transaction list with type filter badges, status filter, date range
- [ ] Create transaction flow (multi-step: Select Type → Details → Review → Confirm)
  - [ ] Issuance form
  - [ ] Transfer form with ROFR check
  - [ ] Conversion form
  - [ ] Cancellation form
- [ ] Transaction detail page with status timeline
- [ ] Approval workflow UI (submit → approve/reject)

### 4.8 Funding Rounds Page (no page exists)

- [ ] Round list with status badges
- [ ] Create round form
- [ ] Round detail page: terms, commitments table, progress bar
- [ ] Add commitment flow
- [ ] Record payment UI
- [ ] Close round confirmation with dilution preview
- [ ] Pro-forma cap table view

### 4.9 Option Plans Page (no page exists)

- [ ] Plan list with pool utilization progress bar
- [ ] Create plan form
- [ ] Plan detail: grants table, pool stats
- [ ] Create grant form
- [ ] Grant detail: vesting schedule timeline/table, exercise history
- [ ] Exercise request form (employee view)
- [ ] Exercise confirmation form (admin view)

### 4.10 Convertible Instruments Page (no page exists)

- [ ] Instrument list with summary stats (total principal, total accrued)
- [ ] Create instrument form (4 Brazilian types)
- [ ] Instrument detail: interest breakdown, conversion scenarios
- [ ] Conversion scenario simulator (slider for valuation → shows resulting shares)
- [ ] Convert action with confirmation

### 4.11 Settings Pages (no page exists)

- [ ] Company Info tab: edit company details
- [ ] Members tab: list, invite, role management
- [ ] Share Classes tab: manage classes
- [ ] Notifications tab: preference toggles
- [ ] Security tab: sessions, MFA status (from Privy)

### 4.12 Member Invitation Flow

- [ ] Public invitation acceptance page (`/invitations/:token`)
- [ ] Login/register → accept invitation → redirect to company dashboard

### 4.13 Notifications

- [ ] Notification bell with unread count badge in topbar (currently hardcoded)
- [ ] Notification dropdown/panel (recent notifications)
- [ ] Notification list page (all notifications with pagination)
- [ ] Mark read/unread actions

### 4.14 Frontend Testing (0 test files exist)

- [ ] Configure Jest + React Testing Library (infrastructure is in place: jest.config.ts, jest.setup.ts, dependencies installed)
- [ ] Tests for all auth flows (login, logout, protected routes)
- [ ] Tests for all form components (validation, submission, error display)
- [ ] Tests for all data display components (tables, cards, charts)
- [ ] Tests for API client (error handling, auth header, CSRF)
- [ ] Target 80% coverage (100% for auth components)

---

## P5 — Prisma Schema Additions

Models/enums that exist in specs but are missing from the schema:

- [ ] `WaterfallScenario` model — for exit waterfall scenarios (exit-waterfall.md)
- [ ] `ExportJob` model + `ExportFormat` enum + `ExportStatus` enum — for async report exports (reports-analytics.md)
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

### Missing User Flow Docs (13)

- [ ] `docs/user-flows/company-cnpj-validation.md`
- [ ] `docs/user-flows/company-profile.md`
- [ ] `docs/user-flows/company-dataroom.md`
- [ ] `docs/user-flows/company-litigation.md`
- [ ] `docs/user-flows/company-blockchain-admin.md`
- [ ] `docs/user-flows/cap-table-reconciliation.md`
- [ ] `docs/user-flows/exit-waterfall.md`
- [ ] `docs/user-flows/reports-analytics.md`
- [ ] `docs/user-flows/notifications.md`
- [ ] `docs/user-flows/blockchain-integration.md`
- [ ] `docs/user-flows/document-generation.md`
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
P1 Redis+Bull ──────────────┬──→ P3.1 Notifications
                            ├──→ P3.2 Audit Logging (+ P1 redactPii)
                            ├──→ P3.3 KYC (+ P1 AWS)
                            ├──→ P3.7 Dataroom (+ P1 AWS)
                            ├──→ P3.8 Blockchain
                            ├──→ P3.10 Litigation (+ P3.6 Company Profile)
                            ├──→ P3.11 Reconciliation (+ P3.8)
                            ├──→ P3.13 Reports (+ P1 AWS)
                            ├──→ P3.14 CNPJ Validation (+ P3.3)
                            ├──→ P2 Convertible daily accrual job
                            └──→ P0 BUG-1 session fix

P1 AWS SDK ─────────────────┬──→ P1 Email (SES)
                            ├──→ P1 EncryptionService (KMS)
                            ├──→ P3.3 KYC (S3+KMS)
                            ├──→ P3.4 Document Generation (S3)
                            └──→ P3.7 Dataroom (S3)

P3.4 Document Generation ───→ P3.5 Document Signatures (+ P3.8 Blockchain)

P3.6 Company Profile ───────→ P3.10 Litigation (auto-trigger on profile creation)

P3.8 Blockchain ────────────┬──→ P3.9 Blockchain Admin
                            ├──→ P3.11 Reconciliation
                            └──→ P3.5 Document Signatures (anchoring)

P4.1 Frontend Foundation ───→ All P4.x pages
```

---

## Recommended Implementation Order

**Sprint 1**: P0 bugs (BUG-2, BUG-3, BUG-4 on-the-fly fix, BUG-5, BUG-6; BUG-1 deferred), P1 Redis+Bull, P1 AWS SDK
**Sprint 2**: P1 remaining (CSRF, redactPii, Sentry, Email, EncryptionService, body limits, helmet gap, test infra deps), P2 Auth gaps
**Sprint 3**: P3.1 Notifications, P3.2 Audit Logging
**Sprint 4**: P3.3 KYC, P3.14 CNPJ Validation, P2 Company gaps
**Sprint 5**: P3.4 Document Generation, P3.7 Dataroom
**Sprint 6**: P3.6 Company Profile, P3.10 Litigation
**Sprint 7**: P3.8 Blockchain, P3.9 Blockchain Admin
**Sprint 8**: P3.5 Document Signatures, P3.11 Reconciliation
**Sprint 9**: P3.12 Exit Waterfall, P3.13 Reports & Analytics
**Sprint 10**: P2 remaining module gaps (all existing modules)
**Sprint 11-13**: P4 Frontend (Foundation → Auth → Dashboard → Cap Table → Shareholders → Transactions → remaining pages)
**Sprint 14**: P5 Schema additions (as needed per module), P6 Docs, P7 CI/CD
