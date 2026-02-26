# Navia MVP - Implementation Plan

## Project Overview

Navia has pivoted from a **cap table management platform** to an **investor-readiness and fundraising tool** for Brazilian startups. The new mission is:

> "Help Brazilian startups raise investment by providing investor-ready company profiles, data rooms, and due diligence tools."

Founders create a branded company page with a secure dataroom, connect bank accounts for automated financial snapshots, and use AI to process documents into standardized reports. Investors browse company pages, access tiered information, and ask AI-powered questions grounded in the company's actual documents and financials.

### Development Phases (from requirements.md)

| Phase | Focus | Description |
|-------|-------|-------------|
| **Phase 1** | Company Page (MVP) | Profile editor, dataroom, access control, analytics, auth, KYC, bilingual UI |
| **Phase 2** | AI Intelligence | Document processing via Claude, embedding/RAG with pgvector, AI reports, Q&A chat with SSE |
| **Phase 3** | Open Finance | Brazilian Open Finance API, bank connections, automated financial snapshots |
| **Phase 4** | Investor Portal | Tiered access (VIEW/VIEW_FINANCIALS/FULL), company updates, portfolio view, data enrichment |

---

## Current State Summary

### Product Pivot Impact

- **15 cap-table-era specs** archived to `specs/archived/`
- **16 active specs** describe the new product direction (11 listed as "active" + 5 listed as "planned" in specs/README.md but all already written)
- **Cap-table NestJS modules deleted** from working tree (share-class, shareholder, cap-table, transaction, funding-round, option-plan, convertible, document, exit-waterfall controllers/services all show `D` in git status)
- **Cap-table frontend pages deleted** (all dashboard sub-pages for cap-table features removed)
- **Prisma models preserved** in schema with `// ARCHIVED` comments (not deleted, for migration safety)
- **AppModule updated** to import only active modules (13 modules, no cap-table modules)

### Active Backend Modules (13)

| Module | Status | Test Files | Description |
|--------|--------|------------|-------------|
| Auth | Complete with gaps | 5 spec files | Privy JWT, Redis sessions, lockout, guards, decorators |
| Company | Complete with gaps | 3 spec files | CRUD, CNPJ validation, status machine, Bull job |
| Member | Complete | 3 spec files | Invitations, roles, email sending |
| KYC | Complete with gaps | 4 spec files | CPF verification, document upload, face match, AML via Verifik |
| Company Profile | Complete | 6 spec files | Profile CRUD, dataroom, litigation check via BigDataCorp |
| Notification | Complete | 3 spec files | In-app notifications, Bull queue, preferences |
| Audit Log | Complete with gaps | 5 spec files | Immutability trigger, hash chain, interceptor |
| Reports | Needs rewrite | 3 spec files | Cap-table-era ownership/dilution/export (stale) |
| Email | Complete | 1 spec file | MJML templates, SES integration |
| AWS | Complete | 3 spec files | S3/SES/KMS services |
| Encryption | Complete | 1 spec file | KMS encrypt/decrypt, blind index |
| Scheduled Tasks | Complete | 1 spec file | Hash chain cron, DLQ monitor (2 active cron jobs, spec tests cleaned of deleted module references) |
| Redis | Complete | 1 spec file | ioredis client, Bull root config |

**Total backend test files**: 48 spec files

### Active Frontend Structure

| Area | Status | Test Files | Description |
|------|--------|------------|-------------|
| Auth (login + onboarding) | Complete with gaps | 2 test files | Privy + backend session, 2-step onboarding wizard |
| Dashboard page | Placeholder stub | 1 test file | 3 generic stat cards, no real data |
| Settings page | Complete | 1 test file | Company Info + Members tabs |
| Notifications page | Complete | 2 test files | Full page + dropdown + preferences |
| Dataroom page | Complete | 1 test file | Full page with upload, category filter, document list, storage bar |
| Reports page | Needs rewrite | 1 test file | Cap-table-era reports (stale) |
| Invitation acceptance | Complete | 1 test file | Token-based invitation flow |
| Layout (sidebar + topbar) | Complete | 2 test files | 12 nav items via shared sidebar-nav.ts, i18n, 56 tests. Desktop + mobile sidebars synced: 9 menu items (Dashboard, Company Page, Dataroom, AI Reports, Q&A, Updates, Bank Connections, Analytics, Investors) + 3 general (Settings, Notifications, Help) |
| Shared (API client, error boundary, button) | Complete | 2 test files | CSRF, locale, error handling |

**Total frontend test files**: 14 test files

### Infrastructure (Complete)

- [x] Monorepo: pnpm workspaces + Turborepo
- [x] Backend: NestJS 10, Prisma, PostgreSQL, Redis, Bull
- [x] Frontend: Next.js 14, Tailwind, shadcn/ui, TanStack Query, next-intl, Privy
- [x] Security: Helmet, CSRF middleware, rate limiting, Sentry (both ends)
- [x] AWS: S3, SES, KMS services
- [x] CI tooling: Husky, Prettier, TypeScript strict mode

### Code Quality (from audit)

- Zero TODO/FIXME/HACK comments in active code
- Zero skipped tests (no it.skip, describe.skip, xit, xdescribe)
- Zero placeholder/stub implementations in production code
- Zero broken imports in remaining active files
- Prisma schema has `// ARCHIVED` comments on cap-table models (18 models preserved for migration safety)

---

## Phase 0: Pivot Cleanup

Clean up the codebase from the cap-table era. Remove dead references, fix broken imports, and stabilize the base for new development.

### P0.1 — Backend Cleanup

- [x] **Fix ScheduledTasksService spec tests** — Removed imports of deleted `ConvertibleService` and `OptionPlanService`, removed 10 tests for deleted `accrueConvertibleInterest()` and `expireOptionGrants()` methods, updated @Cron decorator tests from 4 to 2 methods. Result: 19 tests remain (3 getYesterdayDateString + 4 computeDailyAuditHashChain + 12 monitorDeadLetterQueues). | `backend/src/scheduled-tasks/scheduled-tasks.service.spec.ts` | **S**
- [x] **Clean up Notification cross-module references** — Verified: zero imports of deleted modules in `backend/src/notification/`. The `NOTIFICATION_TYPE_CATEGORY` map in `create-notification.dto.ts` still has string constants for old notification types (SHARES_ISSUED, OPTION_GRANTED, etc.) but these are string values, not imports — they compile fine and will be cleaned when notification types are updated for the new product direction. | `backend/src/notification/` | **S**
- [x] **Clean up AuditInterceptor @Auditable references** — Verified: zero coupling to deleted modules. The interceptor is resource-agnostic (action/resourceType are plain strings). Currently wired to 6 active controllers with 22 @Auditable endpoints: company (5), company-profile (8), profile-document (2), member (4), invitation (1), kyc (4), reports (2). | `backend/src/audit-log/interceptors/audit.interceptor.ts` | **S**
- [ ] **Update Reports module for new direction** — Current ReportsService (1,327 lines) queries 10 archived Prisma models (Shareholding, ShareClass, OptionGrant, CapTableSnapshot, Shareholder, FundingRound, Transaction, ConvertibleInstrument, Document). The module compiles and tests pass because the Prisma models are still in the schema (with `// ARCHIVED` comments), but the endpoints return data from empty tables. Methods to rewrite: `getOwnershipReport`, `getDilutionReport`, `getPortfolio`, `generateCapTableCsv/Xlsx/Pdf/Oct`, `generateDueDiligenceCsvs`, `computeForeignOwnership`. Clean methods to keep: `exportCapTable` (Bull job dispatch), `getExportJobStatus`, `completeExportJob`, `failExportJob`. Full rewrite deferred to Phase 2 (P2.5). The `reports.module.ts`, DTOs, controller, and processor have no direct cap-table imports and are clean. | `backend/src/reports/` | **L**
- [x] **Verify Prisma schema ARCHIVED comments** — Verified: all 18 cap-table models have `// ARCHIVED` comments. No active module imports these models (only ReportsService queries them via Prisma client, which is acceptable since the models remain in the schema). Note: the `NOTIFICATION_TYPE_CATEGORY` in `create-notification.dto.ts` still maps old cap-table notification types to categories — these are string constants, not model imports. The `Prisma.ShareholdingWhereInput` type reference in `reports.service.ts` line 41 depends on the archived model staying in the schema. | `backend/prisma/schema.prisma` | **S**
- [x] **Run full backend test suite and fix failures** — 47/47 test suites pass, 1,219/1,219 tests pass. All active module tests green. No test files for deleted modules remain (they were already removed from working tree). | All backend spec files | **M**

### P0.2 — Frontend Cleanup

- [x] **Remove stale TypeScript types** — Removed orphaned `Portfolio` and `PortfolioHolding` types (zero imports anywhere). Added NOTE comment marking `OwnershipReport`, `DilutionReport`, and related types as cap-table era — these are kept because they're still imported by `use-reports.ts` and the reports page (which needs a full rewrite in Phase 1 P2.5). The `NotificationType` union and notification preference categories also kept as-is since the backend Prisma enum still includes the old notification types. Total: 204→155 lines. | `frontend/src/types/company.ts` | **S**
- [x] **Clean up i18n messages** — Removed `portfolio` namespace, `errors.cap`, `errors.opt`, `errors.txn`, `errors.waterfall` sub-namespaces, `reports.waterfall` sub-namespace, and dead dashboard sub-keys (quickActions, recentTransactions, ownership, types, old stats). Updated dashboard description and onboarding description from cap-table to investor-readiness language. Added missing `dashboard.stats` keys (company, notifications, settings). Notifications namespace kept as-is (cap-table types still referenced by active code, will be updated in P1.5). Reports namespace kept as-is (actively used by reports page, will be rewritten in P2.5). Both `en.json` and `pt-BR.json` updated identically. 13/13 test suites pass, 347/347 tests pass. | `frontend/messages/en.json`, `frontend/messages/pt-BR.json` | **M**
- [x] **Fix mobile sidebar dead links** — Removed 9 dead nav items (Cap Table, Shareholders, Share Classes, Transactions, Funding Rounds, Convertibles, Options, Documents, Audit Logs) and 8 unused Lucide icon imports. Mobile sidebar now matches desktop sidebar: 2 menu items (Dashboard, Notifications) + 2 general items (Settings, Help). | `frontend/src/components/layout/mobile-sidebar.tsx` | **S**
- [x] **Run full frontend test suite and fix failures** — 13/13 test suites pass, 347/347 tests pass. All active page tests green. No test files for deleted pages remain (they were already removed from working tree). | All frontend test files | **M**

### P0.3 — Documentation Cleanup

- [ ] **Archive cap-table user flow docs** — Move remaining cap-table user flow docs to `docs/user-flows/archived/` (some already moved). Update `docs/user-flows/README.md` index to reflect only active flows. | `docs/user-flows/` | **S**
- [x] **Update specs/README.md** — Already up to date: heading shows "Active Specs (17)", all 17 specs listed including `company-data-enrichment.md`. No changes needed. | `specs/README.md` | **S**
- [ ] **Update ARCHITECTURE.md** — Reflect the pivot: new mission, active modules, removed features. | `ARCHITECTURE.md` | **S**

---

## Phase 1: Company Page (MVP)

The core MVP: a founder can sign up, verify identity, create a company, build an investor-ready profile page, upload documents to a dataroom, share the page, and track analytics.

### P1.1 — Auth & KYC Gaps

- [x] **Privy login + backend session** — Email/social login, HTTP-only cookie sessions, Redis session store | `backend/src/auth/`, `frontend/src/lib/auth.tsx` | **Complete**
- [x] **Auth guards + role decorators** — Global AuthGuard, RolesGuard, @Public/@CurrentUser/@Roles | `backend/src/auth/guards/`, `backend/src/auth/decorators/` | **Complete**
- [x] **Failed login lockout** — 5 failures in 15 min per IP, Redis-backed | `backend/src/auth/auth.service.ts` | **Complete**
- [x] **Auth refresh endpoint** — `POST /api/v1/auth/refresh` accepts a fresh Privy access token, verifies it, destroys the old session, creates a new Redis session with 7-day TTL, sets a fresh cookie, and fires `AUTH_TOKEN_REFRESHED` audit event. Returns `{ user, expiresAt }`. Uses `errors.auth.tokenExpired` messageKey on failure (401). Added RefreshDto, AuthService.refreshSession(), 19 new tests (7 service + 12 controller). 47/47 backend suites pass (1,219 tests), 13/13 frontend suites pass (347 tests). | `backend/src/auth/auth.controller.ts`, `auth.service.ts`, `dto/refresh.dto.ts` | **M**
- [x] **KYC gating guard** — `KycGatingGuard` blocks actions unless the founder has `kycStatus === 'APPROVED'`. Reads from `request.user.kycStatus` (loaded fresh from DB by AuthGuard on every request — no additional DB query needed). Throws 403 with code `KYC_REQUIRED` and messageKey `errors.kyc.required`. Applied via `@UseGuards(KycGatingGuard)` on the profile publish endpoint. Guard has zero DI dependencies (instantiable via `new KycGatingGuard()`). i18n messages added to both backend MESSAGES map and frontend `en.json`/`pt-BR.json`. 10 guard tests + 1 decorator verification test on controller spec. 48/48 backend suites (1,230 tests), 13/13 frontend suites (347 tests) pass. | `backend/src/kyc/guards/kyc-gating.guard.ts`, `backend/src/company-profile/company-profile.controller.ts` | **M**
- [ ] **KYC frontend flow** — 4-step KYC process: CPF entry + validation, document upload (RG/CNH), selfie capture with liveness check, status polling. Can be accessed from onboarding or settings. Per `frontend-restructure.md` § "KYC Verification Frontend" and `kyc-verification.md` spec. Backend endpoints already exist (5 endpoints in KycController). Frontend needs: KYC step wizard component, file upload with camera capture, progress indicator, status display. | `frontend/src/app/(dashboard)/dashboard/settings/kyc/` (new) | **L**
- [ ] **Profile picture upload** — `PUT /api/v1/auth/me/avatar` endpoint. Accept multipart/form-data with image file, validate magic bytes (JPEG/PNG), strip EXIF metadata, upload to S3 (`navia-avatars` key prefix), update User.profilePictureUrl. Frontend: avatar upload UI in settings page with preview. | `backend/src/auth/auth.controller.ts`, `frontend/src/app/(dashboard)/dashboard/settings/` | **M**
- [ ] **User locale and phone in profile** — Extend `PUT /api/v1/auth/me` to accept `locale` ('pt-BR' | 'en') and `phone` (Brazilian format) fields. Add validation. Frontend: locale selector and phone input in settings page. | `backend/src/auth/dto/`, `frontend/src/app/(dashboard)/dashboard/settings/` | **S**
- [ ] **LGPD data access endpoint** — `GET /api/v1/users/me/data` returns all personal data per `security.md` LGPD Art. 18 requirements: profile data, KYC status + dates, company memberships, consent records, login history (last 90 days). Excludes: company-owned data, other users' audit logs, raw KYC documents. | `backend/src/auth/auth.controller.ts` | **M**
- [ ] **LGPD data export endpoint** — `GET /api/v1/users/me/export` generates JSON file via Bull job, available for download for 24 hours. User receives email when ready. Rate limit: 1 export per 24 hours. Uses same scope as data access endpoint. | `backend/src/auth/auth.controller.ts`, new Bull processor | **M**
- [ ] **LGPD deletion endpoint** — `DELETE /api/v1/users/me` with 30-day grace period. User can cancel during grace period. After 30 days, background job anonymizes: name → `[Deleted User]`, email → `deleted-{uuid}@navia.placeholder`, CPF → encrypted value deleted (blind index retained), phone → null, KYC documents → deleted from S3, profile photo → deleted from S3. Blocks if user is last ADMIN of any active company. Creates audit event `DATA_DELETION_REQUESTED`. | `backend/src/auth/auth.controller.ts`, new scheduled task | **L**
- [ ] **Consent management endpoints** — `GET /api/v1/users/me/consents` returns all consent records. `PUT /api/v1/users/me/consents/:consentType` to grant/revoke consent. ConsentRecord model already exists in Prisma. Consent types: TERMS_OF_SERVICE, PRIVACY_POLICY, KYC_DATA_COLLECTION, EMAIL_NOTIFICATIONS, MARKETING. Per `security.md` § "Consent Management". | `backend/src/auth/auth.controller.ts` | **M**
- [ ] **EXIF metadata stripping** — Use `sharp` to strip EXIF data from uploaded images before S3 storage. Apply to: KYC document uploads (KycService), profile pictures (AuthController), team photos (CompanyProfileService). Per `security.md` § "File Upload Security". Install `sharp` as dependency. | `backend/src/common/utils/image-utils.ts` (new) | **S**

### P1.2 — Company Module Gaps

- [x] **Company CRUD + CNPJ validation** — Create, update, status transitions, async CNPJ validation via Verifik | `backend/src/company/` | **Complete**
- [x] **Member invitation flow** — Invite, accept, remove, role management, email sending | `backend/src/member/` | **Complete**
- [ ] **SAS entity type support** — Add `SAS` (Sociedade por Ações Simplificada) to `CompanyEntityType` enum in Prisma. Update company creation DTO to accept SAS. SAS has no special share class rules (unlike Ltda QUOTA auto-create or S.A. COMMON_SHARES validation). Per `company-management.md` spec. | `backend/prisma/schema.prisma`, `backend/src/company/dto/` | **S**
- [ ] **Company dissolution notification** — When `CompanyService.dissolve()` executes, notify all active members via NotificationService with event type `COMPANY_DISSOLVED`. Currently dissolution exists but does not trigger notifications. Fire-and-forget pattern. | `backend/src/company/company.service.ts` | **S**
- [ ] **Open Finance settings field** — Add `openFinanceEnabled` boolean to Company model (default false). Admin can toggle via company update. Prerequisite for Phase 3. Per `company-management.md` spec. | `backend/prisma/schema.prisma`, `backend/src/company/dto/` | **S**

### P1.3 — Company Data Enrichment (New Module)

Per `company-data-enrichment.md` spec, extend the existing BigDataCorp integration from litigation-only to full company data enrichment.

- [x] **Litigation check via BigDataCorp** — Background Bull job on profile creation, risk level computation, PII masking | `backend/src/company-profile/bigdatacorp.service.ts`, `litigation-check.processor.ts` | **Complete**
- [ ] **CompanyEnrichment Prisma model** — New model to store enriched data: registeredAddress, cnaeCode (primary), cnaeCodes (all), foundingDate, legalRepresentatives (JSON), capitalSocial (Decimal), employeeCount, rfStatus (Receita Federal status), branchOffices (JSON), partnersData (JSON), lastEnrichedAt. Relation to Company. @@map("company_enrichments"). | `backend/prisma/schema.prisma` | **S**
- [ ] **Enrichment BigDataCorp endpoint** — Add `enrichCompany(cnpj: string)` method to BigDataCorpService. Calls BigDataCorp CNPJ enrichment API (separate from litigation endpoint). Returns corporate registry data: legal name, registered address, CNAE codes, founding date, partners, capital social, employee count, RF status. Error handling: circuit breaker (reuse existing), 30s timeout. | `backend/src/company-profile/bigdatacorp.service.ts` | **M**
- [ ] **Enrichment Bull processor** — `EnrichmentCheckProcessor` for async enrichment fetch, dispatched alongside litigation on profile creation via `ProfileService.dispatchEnrichmentCheck()`. Bull queue: `company-enrichment`. 3 attempts, exponential backoff 30s/60s/120s. On success: create/update CompanyEnrichment record, fire audit event `ENRICHMENT_COMPLETED`. On failure: fire audit event `ENRICHMENT_FAILED`. | `backend/src/company-profile/enrichment-check.processor.ts` (new) | **M**
- [ ] **Manual re-enrichment endpoint** — `POST /api/v1/companies/:companyId/profile/enrich` — ADMIN only. Rate limited: once per 24 hours per company (check lastEnrichedAt). Re-dispatches the enrichment Bull job. Returns 202 Accepted. | `backend/src/company-profile/company-profile.controller.ts` | **S**
- [ ] **Enrichment read endpoint** — `GET /api/v1/companies/:companyId/enrichment` — Returns CompanyEnrichment data with 4 states: PENDING (job dispatched, not yet complete), COMPLETED (data available), FAILED (error), STALE (lastEnrichedAt > 90 days ago). | `backend/src/company-profile/company-profile.controller.ts` | **S**
- [ ] **Enrichment frontend section** — Read-only enrichment card on Company Page builder showing: registered address, CNAE, founding date, partners, capital social, employee count, RF status. "Fonte: BigDataCorp" badge. Stale data warning (>90 days) with refresh button. 4 states: PENDING (spinner), FAILED (error + retry), COMPLETED (data grid), STALE (data grid + warning). | `frontend/src/app/(dashboard)/dashboard/company-page/` | **M**
- [ ] **Enrichment on public profile** — Display enriched corporate data on the public `/p/[slug]` page when profile is PUBLISHED and access level permits. Show: founding date, CNAE description, registered city/state, employee count, RF status badge. | `frontend/src/app/p/[slug]/` | **S**

### P1.4 — Frontend Restructure (Founder Dashboard)

Per `frontend-restructure.md`, the dashboard layout and navigation must be rebuilt for the new product direction.

- [x] **New sidebar navigation** — Replaced 2-item sidebar with full 12-item founder dashboard nav (9 menu + 3 general). Extracted nav items to shared `sidebar-nav.ts` (single source of truth for both desktop and mobile sidebars). Added full i18n support with `sidebar.*` translation keys in both locales. Created stub pages with ComingSoon component for 9 new routes (company-page, dataroom, ai-reports, qa-conversations, updates, bank-connections, analytics, investors, help). 56 tests across 2 test suites (sidebar + mobile-sidebar). | `frontend/src/lib/sidebar-nav.ts`, `frontend/src/components/layout/sidebar.tsx`, `mobile-sidebar.tsx` | **M**
- [x] **Dashboard page redesign** — Replaced 3 generic stat cards with full founder dashboard. Added: Welcome header with user's first name (personalized/generic fallback), 4 stat cards (Company Status with active highlight, Team Members count, Unread Notifications via polling hook, Profile Views from profile API), Profile Completeness progress bar (8-item checklist: profile exists, description, logo, metrics, team, documents, KYC approved, published — shows % and up to 4 incomplete items), Company Health card (Company Status badge, CNPJ validation status, KYC verification status with color-coded badges), Quick Actions panel (4 links: Edit Company Page, Upload Document, Invite Member, View Settings), Recent Activity feed (last 5 notifications with read/unread dots and relative time formatting). Created `useCompanyProfile` hook (TanStack Query, handles 404 gracefully as null). Added `CompanyProfile` and related types to `types/company.ts`. Added ~50 i18n keys per locale for dashboard namespace. 39 tests covering all states (no-company, loading, welcome header, stat cards, completeness, health, quick actions, recent activity, hook integration). | `frontend/src/app/(dashboard)/dashboard/page.tsx`, `frontend/src/hooks/use-company-profile.ts`, `frontend/src/types/company.ts` | **L**
- [x] **Company Page builder** — Full profile editor replacing ComingSoon stub. 4 tabs: **Info** (headline max 200, description textarea max 5000 with char counter, sector dropdown with 26 options, foundedYear, location, website), **Metrics** (up to 6 custom metrics: label + value + format selector — NUMBER/CURRENCY_BRL/CURRENCY_USD/PERCENTAGE/TEXT, add/remove), **Team** (up to 10 members: name, title, photo upload via multipart, LinkedIn URL, initials avatar fallback), **Share** (share URL with copy button, custom slug editor, access type radio PUBLIC/EMAIL_GATED). Create profile CTA when no profile exists. Status badges (DRAFT/PUBLISHED/ARCHIVED). Publish/Unpublish/Archive actions. Created `use-profile-mutations.ts` with 10 mutation hooks (create, update, publish, unpublish, archive, updateSlug, updateMetrics, updateTeam, uploadTeamPhoto, profileAnalytics). Added shadcn Textarea component. Added ~90 i18n keys per locale under `companyPage.*` namespace. 32 tests covering all states, tabs, mutations, and interactions. 15/15 frontend suites (400 tests) pass. | `frontend/src/app/(dashboard)/dashboard/company-page/page.tsx`, `frontend/src/hooks/use-profile-mutations.ts`, `frontend/src/components/ui/textarea.tsx` | **XL**
- [x] **Dataroom page** — Full dataroom implementation replacing ComingSoon stub. Category-based organization with pill-tab filtering (All + 6 categories). Document list with file icon by type, name, size, page count (PDFs), upload date, category badge. Download via pre-signed URLs (opens in new tab). Delete with confirmation dialog. Upload dialog with drag-and-drop zone, category selector, optional display name. Storage usage progress bar with near-limit warning. Created `useDocuments`, `useUploadDocument`, `useDeleteDocument`, `useReorderDocuments`, `useDocumentDownload` hooks in `use-documents.ts`. Extended `ProfileDocument` type with all backend fields. Added `uploadFile` method to API client for multipart/form-data. Added ~40 i18n keys per locale under `dataroom.*` namespace. 21 tests (rendering, empty/loading states, category filtering, upload dialog, delete confirmation, download, storage bar). 14/14 frontend suites (368 tests), 48/48 backend suites (1,230 tests) pass. | `frontend/src/app/(dashboard)/dashboard/dataroom/page.tsx`, `frontend/src/hooks/use-documents.ts` | **L**
- [ ] **Public profile page** — `/p/[slug]` route per `frontend-restructure.md` § 8 and `company-profile.md` spec: Public company page with: Header (logo, name, headline, sector badge, KYC verified badge), Description section (rich text), Metrics grid (custom metrics cards), Team section (member cards with photo/name/role/bio), Dataroom section (documents filtered by access tier — public docs only for PUBLIC, all for authenticated), Enrichment section (founding date, CNAE, registered address), Litigation section (risk level, case count). Access gate for PASSWORD (password form) and EMAIL_GATED (email submission form). Backend endpoint: PublicProfileController.getPublicProfile(slug). SEO: Open Graph meta tags. | `frontend/src/app/p/[slug]/page.tsx` (new) | **XL**
- [ ] **Public profile access gate** — Access control UI for the public profile page. PASSWORD type: show password entry form, validate against stored bcrypt hash via backend. EMAIL_GATED type: show email submission form, backend creates access request, founder approves. Profile data hidden until access granted. Components: PasswordGate, EmailGate, AccessPending state. | `frontend/src/app/p/[slug]/` | **M**
- [ ] **Profile analytics page** — Tab in Company Page builder or separate page showing per `frontend-restructure.md` § 5.5: Daily page view chart (Recharts line chart), Unique visitors count, Document download counts per file, Visitor log table (for email-gated pages: email, access date, documents viewed). Backend endpoints already exist: CompanyProfileController analytics endpoint + ProfileDocumentDownload tracking. | `frontend/src/app/(dashboard)/dashboard/company-page/analytics/` | **M**
- [ ] **Settings page update** — Add to existing settings page: KYC verification status section with "Start Verification" button (links to KYC flow), Profile picture upload with avatar preview, Locale selector dropdown (pt-BR / en), LGPD section with: "Download My Data" button (triggers export), "Delete My Account" button (confirmation dialog with 30-day warning), Consent management toggles. | `frontend/src/app/(dashboard)/dashboard/settings/` | **M**
- [ ] **i18n keys for remaining new pages** — Company Page builder (~90 keys) and Dataroom (~40 keys) i18n done. Still needed: Public Profile, KYC flow, Settings updates, enrichment section, access gate. Estimate ~100 remaining keys per locale. Follow existing naming convention: `{feature}.{element}.{descriptor}`. | `frontend/messages/en.json`, `frontend/messages/pt-BR.json` | **M**

### P1.5 — Notification Updates

- [x] **Notification module** — In-app notifications with Bull queue, preferences, mark read/unread | `backend/src/notification/` | **Complete**
- [ ] **New notification types for pivot** — Add notification events: `ACCESS_REQUESTED` (investor requests page access via email gate), `ACCESS_GRANTED` (investor receives access approval), `DOCUMENT_UPLOADED` (new dataroom document added), `PROFILE_PUBLISHED` (company page goes live), `ENRICHMENT_COMPLETED` (BigDataCorp enrichment finished), `ENRICHMENT_FAILED` (enrichment failed). Wire into CompanyProfileService and ProfileDocumentService using fire-and-forget pattern. Update `NotificationType` enum. | `backend/src/notification/`, `backend/src/company-profile/` | **M**
- [ ] **Email templates for new events** — MJML templates for: access-request (to founder), access-granted (to investor), document-uploaded (to FULL-tier investors), profile-published (to founder confirmation). Each template in PT-BR and EN at `backend/templates/email/`. Follow existing template pattern (<!-- subject: ... --> HTML comment). | `backend/templates/email/` | **M**

### P1.6 — Audit Log Updates

- [x] **Audit log module** — Immutability trigger, hash chain, interceptor, DLQ monitoring | `backend/src/audit-log/` | **Complete**
- [ ] **Audit log export endpoints** — `GET /api/v1/companies/:companyId/audit-logs/export` per `audit-logging.md` spec. Query params: same filters as list + `format` (csv, pdf, xlsx). Small exports (<1000 rows): synchronous download with Content-Disposition header. Large exports (>=1000 rows): queue via Bull `report-export`, return 202 Accepted with job ID. User receives email when export ready. Export action itself creates audit event `AUDIT_LOG_EXPORTED`. | `backend/src/audit-log/audit-log.controller.ts`, new processor | **L**
- [ ] **New audit events for pivot** — Ensure @Auditable() decorator is applied to all new endpoints. Events: PROFILE_CREATED, PROFILE_PUBLISHED, PROFILE_UNPUBLISHED, PROFILE_ARCHIVED, DATAROOM_DOCUMENT_UPLOADED, DATAROOM_DOCUMENT_DELETED, ACCESS_REQUESTED, ACCESS_GRANTED, ACCESS_REVOKED, ENRICHMENT_FETCHED, ENRICHMENT_FAILED. Most profile events are already captured (CompanyProfileController already has @Auditable on 8 endpoints, ProfileDocumentController on upload/delete). Verify coverage and add any missing. | `backend/src/company-profile/` | **M**

### P1.7 — Testing

- [ ] **Backend test suite green** — After Phase 0 cleanup, run full test suite and verify 100% pass rate on all active modules. Fix any failures. Target: >85% statement coverage on active modules. | All backend spec files | **M**
- [ ] **Frontend test suite green** — Currently 15/15 suites passing (400 tests). Company Page builder (32 tests) and Dataroom (21 tests) covered. Still needed: Public Profile, KYC flow, Settings updates tests. Target: >80% statement coverage. Follow `testing-frontend.md` rules (mock APIs, test rendering/interactions/accessibility). | All frontend test files | **L**
- [ ] **Cold-start auth testing** — Per `testing-frontend.md` § "Auth Flow Cold-Start Testing", verify login flow from zero cookies/sessions after any auth changes. Checklist: clear cookies → login page renders → Privy auth → backend session → redirect → refresh preserves session → logout + re-login → backend down shows error toast. | Manual verification | **S**

---

## Phase 2: AI Intelligence

Document processing, embedding generation, RAG-based Q&A, and AI report generation. Per `ai-document-intelligence.md` and `investor-qa.md` specs.

### P2.1 — Prisma Schema Extensions

- [ ] **Enable pgvector extension** — Add `CREATE EXTENSION IF NOT EXISTS vector` to a Prisma migration. Configure Prisma to support vector column type. This is a prerequisite for DocumentChunk embeddings. | `backend/prisma/migrations/` | **S**
- [ ] **DocumentChunk model** — Stores chunked document text with pgvector embeddings. Fields: id (uuid), profileDocumentId (FK to ProfileDocument), chunkIndex (Int), content (String), embedding (Unsupported("vector(1536)") — pgvector column), tokenCount (Int), metadata (Json — section title, page number, position), createdAt. @@map("document_chunks"). Per `ai-document-intelligence.md` § "Data Model". | `backend/prisma/schema.prisma` | **S**
- [ ] **AIProcessingJob model** — Tracks async document processing. Fields: id (uuid), companyId (FK), profileDocumentId (FK), jobType (enum: TEXT_EXTRACTION, CHUNKING, EMBEDDING, SUMMARIZATION), status (enum: QUEUED, PROCESSING, COMPLETED, FAILED), error (String?), startedAt, completedAt, tokenCount (Int?), cost (Decimal?), createdAt. @@map("ai_processing_jobs"). | `backend/prisma/schema.prisma` | **S**
- [ ] **AICompanySummary model** — AI-generated company reports. Fields: id (uuid), companyId (FK), reportType (enum: COMPANY_SUMMARY, FINANCIAL_OVERVIEW, RISK_ASSESSMENT), content (Json), modelVersion (String), tokenCount (Int), cost (Decimal), generatedAt, createdAt. @@map("ai_company_summaries"). | `backend/prisma/schema.prisma` | **S**
- [ ] **QAConversation model** — Investor Q&A container. Fields: id (uuid), companyId (FK), investorUserId (FK to User), title (String?), messageCount (Int @default(0)), lastMessageAt (DateTime?), createdAt. @@map("qa_conversations"). Per `investor-qa.md` § "Data Model". | `backend/prisma/schema.prisma` | **S**
- [ ] **QAMessage model** — Individual Q&A message. Fields: id (uuid), conversationId (FK), role (enum: USER, ASSISTANT, SYSTEM), content (String), citations (Json? — array of {documentId, chunkIndex, text}), tokenCount (Int?), cost (Decimal?), createdAt. @@map("qa_messages"). | `backend/prisma/schema.prisma` | **S**
- [ ] **Run Prisma migration** — Generate and apply migration for all new Phase 2 models + pgvector extension. | `backend/prisma/` | **S**

### P2.2 — Document Processing Pipeline

- [ ] **AI module scaffold** — New `AiModule` with `AiService`, `AiController`, Bull queue `ai-processing`. Install `@anthropic-ai/sdk` (Claude API client). Register in AppModule. Per `ai-document-intelligence.md` spec. | `backend/src/ai/` (new) | **M**
- [ ] **Text extraction service** — Extract text from uploaded documents. PDF: use `pdf-parse` library. DOCX: use `mammoth` library. XLSX: use existing `exceljs` (already installed for report export). Images: use Claude vision API (send image as base64, ask for text extraction). Output: raw text string per document. Per `ai-document-intelligence.md` § "Text Extraction". | `backend/src/ai/services/text-extraction.service.ts` | **L**
- [ ] **Document chunking service** — Split extracted text into semantic chunks. Strategy per `ai-document-intelligence.md` § "Chunking": section-boundary-aware splitting, max 500 tokens per chunk, 50-token overlap. Metadata per chunk: section title (if detected), page number, position (start/end character offsets). Handles Portuguese text correctly. | `backend/src/ai/services/chunking.service.ts` | **M**
- [ ] **Embedding generation service** — Generate embeddings via Claude API (or Voyage AI per spec). Store as pgvector vectors (1536 dimensions). Batch processing: process up to 20 chunks per API call for efficiency. Per `ai-document-intelligence.md` § "Embedding Generation". | `backend/src/ai/services/embedding.service.ts` | **M**
- [ ] **AI processing Bull processor** — Orchestrates the full pipeline: text extraction → chunking → embedding → summarization. Handles retries and error states. Updates AIProcessingJob status at each stage. Bull queue: `ai-processing`. 3 attempts, exponential backoff. On completion: update ProfileDocument with processing status. On failure: set job status to FAILED with error message. | `backend/src/ai/processors/ai-processing.processor.ts` | **L**
- [ ] **Auto-trigger on document upload** — When a ProfileDocument is uploaded to the dataroom, automatically dispatch an AI processing job via `AiService.dispatchProcessing(documentId)`. Fire-and-forget from ProfileDocumentService.upload(). Check: company has AI budget remaining. | `backend/src/company-profile/profile-document.service.ts` | **S**
- [ ] **Cost tracking and budget enforcement** — Track token usage and cost per company per month. Per `ai-document-intelligence.md` § "Cost Management": configurable monthly budget per company (default: R$50/month in token cost), reject processing when budget exceeded with error `AI_BUDGET_EXCEEDED`. Store monthly usage in a CompanyAIUsage record or compute from AIProcessingJob + QAMessage tables. | `backend/src/ai/services/cost-tracking.service.ts` | **M**

### P2.3 — RAG-Based Q&A

- [ ] **Vector search service** — Cosine similarity search over DocumentChunk embeddings via pgvector. Query: `SELECT * FROM document_chunks ORDER BY embedding <=> $1 LIMIT $2`. Hybrid search: combine vector similarity with keyword matching (ts_rank on content column). Company-scoped: always filter by companyId. Return top-K chunks with similarity scores. Per `investor-qa.md` § "RAG Pipeline". | `backend/src/ai/services/vector-search.service.ts` | **M**
- [ ] **RAG service** — Compose context window from: vector search results (top 10 chunks), company profile metadata (name, sector, description, metrics), enrichment data (if available), financial highlights (Phase 3, optional). Format system prompt with retrieved context + user question. Call Claude API with streaming. Parse response for citations. Per `investor-qa.md` § "RAG Service". | `backend/src/ai/services/rag.service.ts` | **L**
- [ ] **SSE streaming endpoint** — `POST /api/v1/companies/:companyId/qa/conversations/:id/messages` with `Accept: text/event-stream` header. Stream Claude response tokens via Server-Sent Events. Format: `data: {"token": "..."}\n\n` for each token, `data: {"done": true, "citations": [...]}\n\n` on completion. Per `investor-qa.md` § "SSE Streaming". Requires NestJS SSE support (@Sse decorator or manual Response streaming). | `backend/src/ai/ai.controller.ts` | **L**
- [ ] **Conversation management endpoints** — CRUD for QAConversation per `investor-qa.md` § "API Endpoints": `POST /api/v1/companies/:companyId/qa/conversations` (create), `GET /api/v1/companies/:companyId/qa/conversations` (list for company, paginated), `GET /api/v1/companies/:companyId/qa/conversations/:id` (get with messages), `DELETE /api/v1/companies/:companyId/qa/conversations/:id` (delete). Founder sees all conversations. Investor sees only their own. | `backend/src/ai/ai.controller.ts` | **M**
- [ ] **Citation extraction** — Parse Claude response for document references. When Claude references a chunk, include in QAMessage.citations: source document ID, chunk index, relevant text snippet, similarity score. Citations allow the frontend to link back to source documents. Per `investor-qa.md` § "Citations". | `backend/src/ai/services/rag.service.ts` | **M**
- [ ] **Q&A rate limiting** — Per `investor-qa.md` § "Rate Limiting": 10 messages per conversation per hour, 50 messages per user per day. Use @Throttle decorator with custom rate limit tier. | `backend/src/ai/ai.controller.ts` | **S**

### P2.4 — AI Report Generation

- [ ] **Report generation service** — Generate AI reports: COMPANY_SUMMARY (overview from all documents), FINANCIAL_OVERVIEW (extracted from financial statements), RISK_ASSESSMENT (litigation data + document analysis). Uses RAG over all company documents + profile data + enrichment data. Stores result in AICompanySummary. Per `reports-analytics.md` spec (rewritten for new direction). | `backend/src/ai/services/report-generation.service.ts` | **L**
- [ ] **Auto-regeneration trigger** — When new documents finish AI processing, automatically regenerate COMPANY_SUMMARY report. Debounced: wait 5 minutes after last document processing before regenerating (use Bull delayed job). Prevents excessive regeneration during bulk uploads. | `backend/src/ai/services/report-generation.service.ts` | **M**
- [ ] **Report endpoints** — `GET /api/v1/companies/:companyId/ai-reports` (list all reports for company), `POST /api/v1/companies/:companyId/ai-reports/generate` (trigger manual regeneration, ADMIN only), `GET /api/v1/companies/:companyId/ai-reports/:id` (get report detail with full content). | `backend/src/ai/ai.controller.ts` | **M**

### P2.5 — Reports Module Rewrite

- [ ] **Company analytics report** — Replace cap-table ownership/dilution reports with company page analytics: total views, unique visitors, document downloads by file, geographic breakdown (from IP geolocation), referral sources. Data source: ProfileView model + ProfileDocumentDownload model. | `backend/src/reports/reports.service.ts` | **L**
- [ ] **Profile export** — Export company profile as formatted PDF for offline sharing. Include: company info, description, metrics, team, enrichment data, litigation summary, AI company summary. Replace cap-table PDF export. Use existing Puppeteer infrastructure. | `backend/src/reports/` | **M**
- [ ] **Due diligence package rewrite** — Rewrite for new product direction: ZIP containing profile PDF + all dataroom documents + enrichment data JSON + litigation summary JSON + AI company summary JSON + metadata.json. Replace cap-table due diligence package. Reuse existing archiver + S3 infrastructure. | `backend/src/reports/` | **L**

### P2.6 — AI Frontend

- [ ] **AI Reports page** — List of AI-generated reports (COMPANY_SUMMARY, FINANCIAL_OVERVIEW, RISK_ASSESSMENT) with status badges, last generated date, regenerate button. Report detail view with formatted markdown content, citation links to source documents, generation metadata (model version, token count, cost). Per `frontend-restructure.md` § 7 "AI Reports & Insights". | `frontend/src/app/(dashboard)/dashboard/reports/` | **L**
- [ ] **Q&A conversations page (founder view)** — List all investor Q&A conversations for the company. Click to view conversation with message history (user questions + AI responses). Founder cannot respond (AI-only answers). Shows: investor name/email, conversation date, message count. Read-only view with citation links. Per `frontend-restructure.md` § "Founder Q&A View". | `frontend/src/app/(dashboard)/dashboard/qa/` (new) | **M**
- [ ] **Dataroom AI processing badges** — On the dataroom page, show processing status badges on each document: "Processing..." (spinner, QUEUED/PROCESSING), "Indexed" (green check, COMPLETED), "Failed" (red X, FAILED with retry button). Per `frontend-restructure.md` § 6 "AI Processing Status". | `frontend/src/app/(dashboard)/dashboard/dataroom/` | **S**
- [ ] **AI feature i18n keys** — Translation keys for: AI reports page, Q&A conversations page, processing status badges, report types, generation status. ~80 new keys per locale. | `frontend/messages/en.json`, `frontend/messages/pt-BR.json` | **M**

### P2.7 — Testing

- [ ] **AI module unit tests** — Test text extraction (mock file parsing), chunking (test boundary detection, overlap), embedding (mock Claude API), RAG (mock vector search + Claude), cost tracking (budget enforcement). Mock all external APIs. Target: 85% coverage. | `backend/src/ai/**/*.spec.ts` | **L**
- [ ] **AI frontend tests** — Test reports page (list, detail, regenerate), Q&A page (conversation list, message display), AI badges (3 states). Mock API responses. Target: 80% coverage. | Frontend test files | **M**

---

## Phase 3: Open Finance

Brazilian Open Finance API integration for bank connections, transaction ingestion, and automated financial snapshots. Per `open-finance.md` spec.

### P3.1 — Prisma Schema Extensions

- [ ] **OpenFinanceConnection model** — Bank connection record. Fields: id (uuid), companyId (FK), bankName (String), bankCode (String), consentId (String), accessToken (Bytes — encrypted via KMS), refreshToken (Bytes — encrypted via KMS), status (enum: PENDING_CONSENT, ACTIVE, EXPIRED, REVOKED, ERROR), consentExpiresAt (DateTime?), lastSyncAt (DateTime?), syncFrequency (String @default("DAILY")), createdAt, updatedAt. @@map("open_finance_connections"). Per `open-finance.md` § "Data Model". | `backend/prisma/schema.prisma` | **S**
- [ ] **BankAccount model** — Linked bank account. Fields: id (uuid), connectionId (FK), companyId (FK), accountType (enum: CHECKING, SAVINGS, PAYMENT), bankBranch (String), accountNumber (Bytes — encrypted via KMS), balance (Decimal), balanceDate (DateTime), currency (String @default("BRL")), createdAt, updatedAt. @@map("bank_accounts"). | `backend/prisma/schema.prisma` | **S**
- [ ] **BankTransaction model** — Ingested bank transaction. Fields: id (uuid), bankAccountId (FK), companyId (FK), transactionDate (DateTime), amount (Decimal), description (String), category (enum: REVENUE, EXPENSES, PAYROLL, TAXES, TRANSFERS, OTHER), categoryConfidence (Decimal?), manualCategoryOverride (Boolean @default(false)), externalId (String — bank's transaction ID), type (enum: CREDIT, DEBIT), createdAt. @@map("bank_transactions"). Per `open-finance.md` § "Data Model". | `backend/prisma/schema.prisma` | **S**
- [ ] **FinancialSnapshot model** — Computed financial metrics. Fields: id (uuid), companyId (FK), snapshotDate (DateTime), burnRate (Decimal?), runway (Decimal? — months), mrr (Decimal?), totalRevenue (Decimal), totalExpenses (Decimal), cashBalance (Decimal), metrics (Json — additional computed metrics), computedAt (DateTime), createdAt. @@map("financial_snapshots"). | `backend/prisma/schema.prisma` | **S**

### P3.2 — Open Finance Backend

- [ ] **OpenFinance module scaffold** — New `OpenFinanceModule` with OpenFinanceService, OpenFinanceController, Bull queue `open-finance-sync`. Register in AppModule. | `backend/src/open-finance/` (new) | **M**
- [ ] **OAuth consent flow** — Implement Brazilian Open Finance OAuth 2.0 consent flow per BCB regulations and `open-finance.md` spec: initiate consent (redirect to bank), receive callback with authorization code, exchange for access/refresh tokens (encrypted via KMS before storage), update connection status. PKCE required. Handle consent expiry (12 months max per BCB). | `backend/src/open-finance/open-finance.service.ts` | **XL**
- [ ] **Transaction ingestion service** — Fetch transaction history from connected banks via Open Finance API. Paginate through bank API responses. Deduplicate by externalId. Store in BankTransaction. Handle: pagination, rate limits, partial failures, connection expiry. Per `open-finance.md` § "Transaction Ingestion". | `backend/src/open-finance/services/transaction-ingestion.service.ts` | **L**
- [ ] **AI transaction categorization** — Use Claude API to categorize transactions into: REVENUE, EXPENSES, PAYROLL, TAXES, TRANSFERS, OTHER. Input: transaction description + amount + date. Store category + confidence score. Allow manual override (manualCategoryOverride flag). Batch process: send up to 50 transactions per Claude call for efficiency. Per `open-finance.md` § "Categorization". | `backend/src/open-finance/services/categorization.service.ts` | **L**
- [ ] **Financial snapshot computation** — Calculate metrics from categorized transactions per `open-finance.md` § "Snapshot Computation": burn rate (avg monthly outflow over last 6 months), runway (cashBalance / burnRate in months), MRR (recurring revenue detection — look for similar-amount REVENUE credits repeating monthly), total revenue/expenses (sum by category), cash balance (latest from bank API). Create FinancialSnapshot record. | `backend/src/open-finance/services/snapshot.service.ts` | **L**
- [ ] **Daily sync cron job** — Scheduled task in ScheduledTasksModule: `@Cron('0 0 3 * * *')` (03:00 UTC daily). For all ACTIVE OpenFinanceConnections: refresh token if needed, fetch new transactions, re-categorize, recompute snapshot. Handle expired consents (set status to EXPIRED, notify founder). Per `open-finance.md` § "Sync Schedule". | `backend/src/scheduled-tasks/scheduled-tasks.service.ts` | **M**
- [ ] **Connection management endpoints** — `POST /api/v1/companies/:companyId/bank-connections/initiate` (start OAuth flow), `GET /api/v1/companies/:companyId/bank-connections/callback` (OAuth callback), `GET /api/v1/companies/:companyId/bank-connections` (list connections with status), `DELETE /api/v1/companies/:companyId/bank-connections/:id` (disconnect — revoke consent), `POST /api/v1/companies/:companyId/bank-connections/:id/sync` (manual sync trigger). | `backend/src/open-finance/open-finance.controller.ts` | **M**
- [ ] **Financial data read endpoints** — `GET /api/v1/companies/:companyId/bank-transactions` (paginated, filterable by category/date/account), `GET /api/v1/companies/:companyId/financial-snapshots` (list historical snapshots), `GET /api/v1/companies/:companyId/financial-snapshots/current` (latest snapshot with computed metrics). | `backend/src/open-finance/open-finance.controller.ts` | **M**

### P3.3 — Open Finance Frontend

- [ ] **Bank connections page** — Per `frontend-restructure.md` § 10: List connected banks with status badge, last sync time, disconnect button. "Connect Bank" button triggers OAuth redirect. Connection status states: PENDING_CONSENT (spinner), ACTIVE (green), EXPIRED (yellow with "Reconnect"), ERROR (red with "Retry"). Sync progress indicator. | `frontend/src/app/(dashboard)/dashboard/bank-connections/` (new) | **L**
- [ ] **Financial dashboard** — Charts and data per `frontend-restructure.md`: Burn rate trend chart (Recharts line, last 12 months), Runway indicator (months remaining, color-coded green/yellow/red), MRR trend chart, Transaction list with category filter, search, date range. Manual category override UI (dropdown to change category). Snapshot history timeline. | `frontend/src/app/(dashboard)/dashboard/bank-connections/` | **L**
- [ ] **Financial highlights on company page** — Display burn rate, runway, MRR on company profile (visible only to VIEW_FINANCIALS and FULL tier investors). Cards with trend indicators. On public profile `/p/[slug]`: show only if access tier permits. | `frontend/src/app/p/[slug]/` | **M**

### P3.4 — Testing

- [ ] **Open Finance module tests** — Mock bank APIs and OAuth flow. Test: consent initiation, callback handling, token encryption/storage, transaction ingestion, deduplication, categorization (mock Claude), snapshot computation (burn rate, runway, MRR calculations). Target: 85% coverage. | `backend/src/open-finance/**/*.spec.ts` | **L**
- [ ] **Open Finance frontend tests** — Test connection page (all status states), financial dashboard (charts with mock data, category override), highlights display. Target: 80% coverage. | Frontend test files | **M**

---

## Phase 4: Investor Portal

Tiered access management, company updates, portfolio view, and investor-facing Q&A. Per `investor-portal.md` spec.

### P4.1 — Prisma Schema Extensions

- [ ] **InvestorAccess model** — Tracks investor access to companies. Fields: id (uuid), companyId (FK), investorUserId (FK to User), accessLevel (enum: VIEW, VIEW_FINANCIALS, FULL), grantedBy (FK to User), grantedAt (DateTime), revokedAt (DateTime?), notes (String?), createdAt, updatedAt. @@map("investor_access"). @@unique([companyId, investorUserId]). Per `investor-portal.md` § "Data Model". | `backend/prisma/schema.prisma` | **S**
- [ ] **CompanyUpdate model** — Founder posts for investors. Fields: id (uuid), companyId (FK), authorId (FK to User), title (String), body (String — rich text markdown), attachmentKeys (Json? — array of S3 keys), minimumTier (enum: VIEW, VIEW_FINANCIALS, FULL), publishedAt (DateTime?), createdAt, updatedAt. @@map("company_updates"). Per `investor-portal.md` § "Company Updates". | `backend/prisma/schema.prisma` | **S**
- [ ] **User.userType field** — Add `userType` enum (FOUNDER, INVESTOR) to User model with @default(FOUNDER). Determines which dashboard layout to show after login. Per `investor-portal.md` § "User Types". | `backend/prisma/schema.prisma` | **S**

### P4.2 — Investor Portal Backend

- [ ] **Investor Portal module scaffold** — New `InvestorPortalModule` with InvestorPortalService, InvestorPortalController, CompanyUpdateService. Register in AppModule. | `backend/src/investor-portal/` (new) | **M**
- [ ] **Investor access management** — Endpoints per `investor-portal.md` § "Access Management": `POST /api/v1/companies/:companyId/investors` (grant access — ADMIN only), `GET /api/v1/companies/:companyId/investors` (list investors with tiers — ADMIN only), `PUT /api/v1/companies/:companyId/investors/:userId` (update tier — ADMIN only), `DELETE /api/v1/companies/:companyId/investors/:userId` (revoke access — ADMIN only). Send email notification on grant/upgrade. Audit log: ACCESS_GRANTED, ACCESS_REVOKED, ACCESS_TIER_CHANGED. | `backend/src/investor-portal/investor-portal.controller.ts` | **L**
- [ ] **Company updates CRUD** — Founder creates/edits/deletes updates per `investor-portal.md` § "Company Updates": `POST /api/v1/companies/:companyId/updates` (create, ADMIN/FINANCE only), `GET /api/v1/companies/:companyId/updates` (list — filtered by investor's tier), `GET /api/v1/companies/:companyId/updates/:id` (detail), `PUT /api/v1/companies/:companyId/updates/:id` (edit, author only), `DELETE /api/v1/companies/:companyId/updates/:id` (delete, ADMIN only). Email notification to eligible investors on publish. Attachments: S3 upload keys in JSON array. | `backend/src/investor-portal/services/company-update.service.ts` | **L**
- [ ] **Portfolio endpoint** — `GET /api/v1/users/me/portfolio` returns all companies the authenticated investor has access to. Per `investor-portal.md` § "Portfolio": summary cards with company name, logo URL, sector, access tier, last update date, key metrics (from CompanyProfile), latest FinancialSnapshot summary (if VIEW_FINANCIALS+). Paginated, filterable by sector/stage, sortable by last activity. | `backend/src/investor-portal/investor-portal.controller.ts` | **M**
- [ ] **Tiered data filtering middleware** — Service/guard that filters API responses based on investor's access tier. Applied to public profile, dataroom, financial data, Q&A endpoints. VIEW: public profile data only. VIEW_FINANCIALS: + financial snapshots + select dataroom categories. FULL: + complete dataroom + Q&A chat access. Per `investor-portal.md` § "Tier Filtering". | `backend/src/investor-portal/guards/tier-access.guard.ts` | **L**
- [ ] **Investor Q&A integration** — Extend Phase 2 Q&A endpoints for investor access. Investor can only ask questions within their tier's document scope (FULL tier only). Founder receives notification for new questions. SSE streaming reused from Phase 2. Add @UseGuards(TierAccessGuard) requiring FULL tier. | `backend/src/ai/ai.controller.ts` (extend) | **M**
- [ ] **Onboarding user type selection** — Per `investor-portal.md` § "Onboarding": add `userType` selection step to onboarding flow. FOUNDER continues to current company creation flow. INVESTOR skips company creation, goes to portfolio page. Backend: `PUT /api/v1/auth/me` already accepts profile updates — add userType field. Frontend: add role selection step before PersonalInfoStep. | `backend/src/auth/dto/`, `frontend/src/app/onboarding/` | **M**

### P4.3 — Investor Portal Frontend

- [ ] **Investor layout** — Separate `(investor)/` route group with distinct layout per `frontend-restructure.md` § 9: Top navigation bar (not sidebar) with: Navia logo, search bar, notifications bell, profile dropdown. Clean, read-focused design. White background with minimal chrome. Company detail pages nest under this layout. | `frontend/src/app/(investor)/layout.tsx` (new) | **L**
- [ ] **Portfolio page** — Grid of company cards per `frontend-restructure.md` § 9: Company logo, name, sector, access tier badge (VIEW/VIEW_FINANCIALS/FULL with color), last update date, 2-3 key metrics. Filter by sector dropdown, sort by last activity / alphabetical. Search bar. Empty state: "No companies yet" with explanation. | `frontend/src/app/(investor)/portfolio/page.tsx` (new) | **L**
- [ ] **Company detail page (investor view)** — Tabbed layout per `frontend-restructure.md` § 9: Overview tab (profile data), Financials tab (if VIEW_FINANCIALS+ — charts from FinancialSnapshot), Documents tab (if FULL — filtered dataroom), Q&A tab (if FULL — chat interface), Updates tab (filtered by tier). Content dynamically filtered based on InvestorAccess.accessLevel. | `frontend/src/app/(investor)/companies/[id]/page.tsx` (new) | **XL**
- [ ] **Q&A chat interface (investor)** — Chat UI per `investor-qa.md` § "Frontend": message bubbles (user right-aligned, AI left-aligned), citation links (clickable, open source document), SSE streaming indicator (typing animation), input textarea with send button, conversation history sidebar. Rate limit warning when approaching daily limit. | `frontend/src/app/(investor)/companies/[id]/qa/page.tsx` (new) | **L**
- [ ] **Updates feed** — Chronological list of company updates visible to the investor based on tier. Per `investor-portal.md` § "Updates Feed": update cards with title, body preview, date, attachment list. Click to expand full content. Attachment download buttons. | `frontend/src/app/(investor)/companies/[id]/updates/page.tsx` (new) | **M**
- [ ] **Founder investor management page** — Table of investors per `investor-portal.md` § "Investor Management": investor name/email, access tier (dropdown to change), granted date, last access date. Actions: invite investor by email, upgrade/downgrade tier, revoke access. Invite modal: email input + tier selection. | `frontend/src/app/(dashboard)/dashboard/investors/page.tsx` (new) | **L**
- [ ] **Founder updates management** — Create/edit/delete company updates per `investor-portal.md` § "Updates Management": rich text editor (markdown), attachment upload (S3), minimum tier selector (VIEW/VIEW_FINANCIALS/FULL), publish/save draft toggle. Updates list with edit/delete actions. | `frontend/src/app/(dashboard)/dashboard/updates/page.tsx` (new) | **L**

### P4.4 — Testing

- [ ] **Investor Portal module tests** — Test access management (grant/revoke/upgrade), tier filtering (verify data is hidden per tier), updates CRUD (create, list filtered by tier, delete), portfolio (list companies with correct metadata). Mock all external services. Target: 85% coverage. | `backend/src/investor-portal/**/*.spec.ts` | **L**
- [ ] **Investor Portal frontend tests** — Test portfolio page (company cards, filters, empty state), company detail page (tab visibility per tier), Q&A chat (message display, SSE streaming mock), updates feed (filter by tier, attachment download). Target: 80% coverage. | Frontend test files | **L**

---

## Cross-Cutting Concerns (Ongoing)

These items apply across all phases and should be addressed as development progresses.

### Security

- [x] **Helmet security headers** | `backend/src/main.ts` | **Complete**
- [x] **CSRF double-submit cookie** | `backend/src/common/middleware/csrf.middleware.ts` | **Complete**
- [x] **Rate limiting** | `backend/src/app.module.ts` (ThrottlerModule) | **Complete**
- [x] **PII redaction utility** | `backend/src/common/utils/redact-pii.ts` | **Complete**
- [x] **Sentry integration** (both ends) | `backend/src/instrument.ts`, `frontend/sentry.*.config.ts` | **Complete**
- [ ] **Data breach response plan** — Document incident response procedure per `security.md` § "Data Breach Incident Response": P1-P4 severity classification, 4-phase response (Detection → Assessment → Notification → Remediation), ANPD notification template (LGPD Art. 48, within 72 hours for P1). Not code, but critical LGPD compliance documentation. | `docs/incident-response.md` (new) | **S**

### Audit Log Enhancements

- [x] **PostgreSQL immutability trigger** | `backend/src/audit-log/audit-log.module.ts` | **Complete**
- [x] **Daily hash chain cron** | `backend/src/scheduled-tasks/scheduled-tasks.service.ts` | **Complete**
- [x] **DLQ monitoring cron** | `backend/src/scheduled-tasks/scheduled-tasks.service.ts` | **Complete**
- [ ] **Table partitioning by month** — PostgreSQL native partitioning on audit_logs table per `audit-logging.md` § "Database Partitioning". Create migration with `PARTITION BY RANGE (timestamp)`. Monthly scheduled job (25th of each month) to create next month's partition. Per spec: `CREATE TABLE audit_logs_YYYY_MM PARTITION OF audit_logs FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM+1-01')`. | Prisma migration + scheduled task | **L**
- [ ] **S3 archival for old logs** — Monthly job to archive audit logs older than 2 years to S3 per `audit-logging.md` § "Retention and Archival". Steps: serialize month's logs to gzip JSON, upload to S3 (`navia-audit-archive` bucket, SSE-S3), verify hash chain match, delete archived rows, create `AUDIT_LOGS_ARCHIVED` audit event. | New scheduled task + S3 integration | **L**
- [ ] **CLS for before-state capture** — Use AsyncLocalStorage (ClsModule from `nestjs-cls`) to attach before-state to request context for UPDATE/DELETE audit events per `audit-logging.md` § "Before-State Capture in Service Layer". Currently, before-state capture requires manual service-layer code (`request['auditBeforeState']`). CLS eliminates the need for manual request context access. | `backend/src/audit-log/` | **M**

### Performance

- [ ] **Database indexes audit** — Review and optimize indexes for new query patterns: ProfileView (companyId + viewedAt for analytics), ProfileDocument (companyId + category for dataroom listing), DocumentChunk (profileDocumentId for chunk retrieval, embedding for vector search), QAConversation (companyId + investorUserId), BankTransaction (companyId + transactionDate + category). Remove orphaned indexes on archived tables if they impact write performance. | `backend/prisma/schema.prisma` | **M**
- [ ] **Redis caching for profile views** — Cache public profile data in Redis with 5-minute TTL to reduce database load on high-traffic public profiles. Key: `profile:slug:{slug}`. Invalidate on profile update. Use existing RedisModule REDIS_CLIENT. | `backend/src/company-profile/` | **M**
- [ ] **pgvector index optimization** — After DocumentChunk table has data, create IVFFlat or HNSW index on embedding column for fast similarity search. HNSW preferred for accuracy. `CREATE INDEX ON document_chunks USING hnsw (embedding vector_cosine_ops)`. Per `ai-document-intelligence.md` § "Performance". | Prisma migration | **S**

---

## Dependency Graph

```
Phase 0 (Cleanup)
  │
  └──> Phase 1 (Company Page MVP)
         │
         ├──> Phase 2 (AI Intelligence)
         │       │
         │       ├──> Phase 3 (Open Finance) [independent of P2, but AI categorization uses Claude]
         │       │       │
         │       │       └──> Phase 4 (Investor Portal) [needs: P2 Q&A + P3 financials for full feature set]
         │       │
         │       └──> Phase 4 (Investor Portal) [can start without P3, but financial features depend on it]
         │
         └──> Phase 4 (Investor Portal) [core access management can start after P1]
```

**Key dependencies:**
- Phase 0 (Cleanup) must be complete before any other phase — broken tests and dead references block development
- Phase 1 must be complete before Phases 2-4 (foundation: auth, profile, dataroom)
- Phase 2 (AI) requires Phase 1 dataroom (documents to process) and pgvector (new Prisma models)
- Phase 3 (Open Finance) is independent of Phase 2 but AI categorization reuses Claude API infrastructure from Phase 2
- Phase 4 (Investor Portal) depends on Phase 1 (profile exists to grant access to) and Phase 2 (Q&A chat), optionally Phase 3 (financial data display)
- Phase 4 access management can start after Phase 1, but Q&A feature requires Phase 2

---

## Complexity Legend

| Size | Estimated Effort | Description |
|------|-----------------|-------------|
| **S** | < 1 day | Simple change, single file, well-defined scope |
| **M** | 1-3 days | Multiple files, moderate logic, needs tests |
| **L** | 3-7 days | Significant feature, multiple components, full test coverage |
| **XL** | 1-2 weeks | Large feature with multiple sub-components, complex UI, extensive testing |
