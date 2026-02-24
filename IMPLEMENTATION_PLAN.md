# Navia MVP - Implementation Plan

**Job to be Done**: Help Brazilian companies manage their cap table with on-chain record-keeping and regulatory compliance.

**Status**: Phase 1 (Foundation and Infrastructure) in progress. Monorepo scaffolded, backend and frontend foundations built. Phase 0 spec issues are applied in implementation code but **all 69 P0 issues remain unfixed in the spec files themselves**.

**Last Updated**: 2026-02-24 (v12.4 - Share Class CRUD backend module: 5 endpoints, entity type compatibility, preferred share 2/3 limit, immutability after issuance. 34 new tests, 210 tests passing total.)

---

## Executive Summary

This implementation plan provides the validated roadmap for the Navia MVP. Phase 1 (Foundation and Infrastructure) is in progress — monorepo, backend scaffold (NestJS + Prisma), and frontend scaffold (Next.js + Tailwind) are complete. Phase 0 spec issues are being resolved inline during implementation.

A comprehensive spec audit (v8.0) uncovered systemic issues that affect nearly all 26 spec files. A deep audit (v11.0) with 12 parallel subagents uncovered 8 additional auth bugs, Prisma schema gaps, frontend security gaps, and spec compliance issues. The most impactful findings are:

1. **snake_case in TypeScript interfaces** — 13 specs define entity interfaces using `snake_case` field names, violating the `api-standards.md` mandate for camelCase.
2. **Response envelope non-compliance** — Multiple specs show API responses outside the standard `{ "success": true, "data": ... }` envelope.
3. **Permission matrix conflicts** — `reports-analytics.md` and `user-permissions.md` disagree on LEGAL and FINANCE role access.
4. **KYCStatus enum mismatch** — `authentication.md` (4 values, lowercase) vs `kyc-verification.md` (6 values, UPPER_SNAKE_CASE).
5. **Missing API endpoints** — At least 10 endpoints referenced in specs or required by the UI but never defined.
6. **Company scoping conflict** — `company-management.md` uses `X-Company-Id` header; `api-standards.md` uses `:companyId` path parameter.
7. **Auth race condition + double guard execution** — (v11.0) Non-atomic user creation allows duplicate 500s; `@RequireAuth()` causes double Privy API calls.
8. **Frontend completely unprotected** — (v11.0) No route protection, no middleware.ts, no CSP header, missing Brazilian formatting helpers.

### Current Project State (v11.0 Audit)

| Aspect | Status | Notes |
|--------|--------|-------|
| `/frontend` directory | **SCAFFOLDED** | 14 source files, 0 tests. Layouts built. Privy SDK NOT installed. next-intl NOT installed. shadcn/ui CLI never run (no `components/ui/`, no `components.json`). **No auth protection on any route** — no `middleware.ts`, no protected route wrapper. Login page is static stub. Dashboard is visual prototype with hardcoded data. Missing CSP and HSTS security headers. Missing Brazilian formatting helpers. |
| `/backend` directory | **SCAFFOLDED** | 62 source files, 210 tests. Auth module complete (14 of 15 bugs fixed — BUG-1 remains, requires Redis). Common infrastructure solid. **Company Management module complete** (CRUD endpoints, CNPJ Módulo 11 validation, company status state machine, 42 tests). **Company Membership module complete** (invite, accept, remove, role change, resend invitation, permission overrides, invitation acceptance, 52 tests). **Share Class module complete** (5 CRUD endpoints, entity type compatibility Ltda→QUOTA / S.A.→COMMON/PREFERRED, preferred share 2/3 limit per Art. 15 §2, immutability after issuance, 34 tests). |
| `/contracts` directory | EXISTS (empty) | No Solidity files |
| `package.json` | **CREATED** | pnpm workspaces + Turborepo configured |
| Prisma schema | **NEAR-COMPLETE** | 32 models, 35 enums. All relations, unique constraints, and indexes complete. Missing entities: DataroomFolder, DataroomDocument, ExitScenario, WaterfallResult, ExportJob, LitigationVerification (inlined into CompanyProfile). Migration pending. |
| Specification files | **26 files** in `/specs/` | **ALL 69 P0 issues still unfixed in specs** (code has correct patterns, specs are stale). 5 spec compliance gaps identified in v11.0. |
| Cross-cutting specs | **9 files** in `.claude/rules/` | +user-flow-documentation.md |
| Design system | `.claude/rules/design-system.md` | Complete (891 lines), tokens in tailwind.config.ts + globals.css. **Border radius scale systematically wrong** — entire scale shifted (lg=8px should be 12px, md=6px should be 8px, sm=4px should be 6px, xl=16px undefined). |
| CI/CD | **MISSING** | No `.github/workflows/` directory |
| `.env.example` files | **MISSING** | Neither backend nor frontend has one |
| README.md | **STALE** | Contains only "# VelaFund" |
| ARCHITECTURE.md | **STALE** | "VelaFund" branding, references removed entities (AdminWallet, CapTableEntry) |
| User flow docs | **4 of ~15** | `docs/user-flows/authentication.md`, `docs/user-flows/company-management.md`, `docs/user-flows/member-invitation.md`, `docs/user-flows/share-class-management.md` |
| Git tag | `v0.0.7` | Share Class CRUD backend module |

### Critical Bugs Found (v10.0 + v11.0 Audit)

| # | Bug | Severity | Status | Description |
|---|-----|----------|--------|-------------|
| BUG-1 | **Privy token stored as 7-day cookie** | **CRITICAL** | **OPEN** | Raw Privy access token (expires in 1-6 hours) is stored in a 7-day HTTP-only cookie. After Privy token expiry, `verifyAccessToken()` throws on every request → all authenticated requests return 401. Need either: (a) token refresh endpoint + shorter cookie, or (b) server-side session store (Redis). **Deferred until Redis infrastructure is set up.** |
| BUG-2 | **RolesGuard not implemented** | **CRITICAL** | **FIXED v0.0.3** | Implemented `RolesGuard` that reads `ROLES_KEY` metadata, looks up `CompanyMember` with ACTIVE status, returns 404 for non-members (prevents enumeration). Registered as `APP_GUARD` in `auth.module.ts`. 12 tests. |
| BUG-3 | **ThrottlerGuard not global** | **HIGH** | **FIXED v0.0.3** | Registered `ThrottlerGuard` as `APP_GUARD` in `app.module.ts`. All routes now rate-limited by default. |
| BUG-4 | **ValidationPipe errors not structured** | **HIGH** | **FIXED v0.0.3** | `GlobalExceptionFilter` now detects `BadRequestException` from `ValidationPipe` and translates to `VAL_INVALID_INPUT` with `validationErrors` array per api-standards.md. |
| BUG-5 | **Accept-Language not normalized** | **LOW** | **FIXED v0.0.3** | Added `normalizeLanguage()` in `GlobalExceptionFilter` that handles `en-US` → `en`, `pt` → `pt-BR`. |
| BUG-6 | **Apple OAuth not handled** | **MEDIUM** | **FIXED v0.0.3** | Added `apple_oauth` account type to `extractEmail()` and `extractName()`. |
| BUG-7 | **Prisma broken relations (5 total)** | **MEDIUM** | **FIXED v0.0.4** | Fixed all 5 broken relations: UserNotificationPreferences→User, FundingRound→ShareClass, OptionGrant→Shareholder, OptionPlan→ShareClass, ConvertibleInstrument.targetShareClassId→ShareClass. Also added missing unique constraints (RoundCommitment[roundId,shareholderId], DocumentSigner[documentId,email]) and 8 missing indexes. |
| BUG-8 | **Race condition in user creation** | **MEDIUM** | **FIXED v0.0.3** | Wrapped user find-or-create in `prisma.$transaction()` to prevent concurrent first-login race conditions. |
| BUG-9 | **`@RequireAuth()` causes double guard execution** | **MEDIUM** | **FIXED v0.0.3** | Changed `@RequireAuth()` from `UseGuards(AuthGuard)` to `SetMetadata(REQUIRE_AUTH_KEY, true)` — now a no-op marker since AuthGuard is global. |
| BUG-10 | **Email sync conflict on existing user** | **LOW** | **FIXED v0.0.3** | Added email conflict check before updating existing user's email on login. |
| BUG-11 | **`extractName()` returns null for email-only users** | **LOW** | **FIXED v0.0.3** | Added Apple OAuth name extraction and email local part fallback. |
| BUG-12 | **`redactEmail()` crashes on malformed emails** | **LOW** | **FIXED v0.0.3** | Added guard against missing `@` character. |
| BUG-13 | **Unbounded in-memory lockout Map** | **LOW** | **FIXED v0.0.3** | Added `MAX_TRACKED_IPS = 10000` cap with eviction of expired entries. |
| BUG-14 | **Logout unreachable when cookie expired** | **LOW** | **FIXED v0.0.3** | Changed logout endpoint from `@RequireAuth()` to `@Public()`. |
| BUG-15 | **Logout message hardcoded English** | **LOW** | **FIXED v0.0.3** | Returns `{ messageKey: 'errors.auth.loggedOut' }` instead of hardcoded English string. |

### Phase 0 Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| P0.CRITICAL: Implementation-blocking conflicts | 20 | 0 | **20** |
| P0.HIGH: Missing endpoints, permission/status conflicts | 24 | 0 | **24** |
| P0.MEDIUM: Missing schemas, frontend code fixes, open questions | 17 | 0 | **17** |
| P0.LOW: Cross-references, numbering, documentation | 8 | 0 | **8** |
| Previously completed (v7.x) | 18 | **18** | 0 |
| **Total Phase 0 Tasks** | **87** | **18** | **69** |

> **v10.0 finding**: All 69 remaining items are **spec file documentation debt**, not implementation blockers. The actual code (Prisma schema, backend modules, API responses) already uses the correct patterns (camelCase fields, response envelope, Shareholding entity name, UPPER_SNAKE_CASE enums, :companyId path params). The spec `.md` files have not been updated to reflect what was built. See [Priority 3](#priority-3-phase-0-spec-fixes-69-items--specs-are-stale-code-has-correct-patterns) for the full list.

### Specification Completeness Analysis

| Spec File | Lines | Status | Issues Found |
|-----------|-------|--------|--------------|
| company-profile.md | 1,629 | HAS ISSUES | snake_case interfaces, envelope non-compliance, numbering gaps (BR-5, EC-2 missing) |
| shareholder-registry.md | 1,115 | HAS ISSUES | snake_case interfaces, uses `{ "shareholders": [] }` instead of envelope, enum casing inconsistency |
| convertible-conversion.md | 1,046 | HAS ISSUES | snake_case interfaces, raw `fetch()` in frontend code |
| convertible-instruments.md | 904 | HAS ISSUES | snake_case interfaces, lowercase enum values (`mutuo_conversivel`, `outstanding`), 5 open questions |
| kyc-verification.md | 905 | HAS ISSUES | snake_case interfaces, envelope non-compliance, `alert()` in frontend code, 5-min pre-signed URL (security.md says 15-min), 5 open questions, CAPTCHA requirement after 2 failed attempts mentioned but not reflected in any endpoint |
| cap-table-management.md | 870 | HAS ISSUES | `CapTableEntry` (should be `Shareholding`), snake_case interfaces |
| company-management.md | 761 | HAS ISSUES | Uses `X-Company-Id` header (api-standards uses `:companyId` path), returns 403 (should be 404 per security.md) |
| company-membership.md | 747 | HAS ISSUES | Returns 200 for DELETE (should be 204), uses `X-Company-Id` header |
| user-permissions.md | 739 | HAS ISSUES | Uses `AUTH_FORBIDDEN` error code (not in error-handling.md), conflicts with reports-analytics.md and audit-logging.md, CompanyScopeGuard referenced with no implementation spec, ROLE_DEFAULTS incomplete, investor conditional access footnotes have no enforcement mechanism |
| company-dataroom.md | 661 | COMPLETE | Minor snake_case in some areas |
| document-generation.md | 652 | HAS ISSUES | `document_hash` (should be `contentHash`), snake_case in Document interface, missing `PARTIALLY_SIGNED` status |
| reports-analytics.md | 602 | HAS ISSUES | Grants LEGAL "Full" export access (denied in user-permissions.md), missing ExportJob Prisma model, no formal error code catalog for reports |
| transactions.md | 591 | HAS ISSUES | References stale `cap-table.md` and `blockchain.md`, DRAFT status defined but no creation API, missing CONVERSION request body |
| company-litigation-verification.md | 589 | HAS ISSUES | `PROFILE_LITIGATION_CNPJ_NOT_FOUND` contradicts EC-9 behavior, risk level computation has overlapping rules (ambiguous for 2 active lawsuits at R$80k) |
| option-plans.md | 552 | HAS ISSUES | snake_case interfaces, no plan close endpoint, no grant termination endpoint |
| authentication.md | 524 | HAS ISSUES | snake_case interfaces, login response not in envelope, KYCStatus 4-value lowercase mismatch, 4 open questions |
| blockchain-integration.md | 521 | HAS ISSUES | 2 API paths not company-scoped, `AdminWallet` entity contradicts company-blockchain-admin.md, `BlockchainTransaction` 1:1 prevents re-submission |
| document-signatures.md | 506 | HAS ISSUES | `document_hash` in FR text (entity already uses camelCase), `PARTIALLY_SIGNED` referenced but not in document-generation.md status enum |
| funding-rounds.md | 467 | NEEDS EXPANSION | Wrong status enum, snake_case interfaces, no cancellation endpoint, no payment status endpoint, needs +33 lines |
| option-exercises.md | 451 | HAS ISSUES | snake_case interfaces |
| notifications.md | 420 | NEEDS EXPANSION | Missing `channel` enum, snake_case interfaces, needs +180 lines, no unread count endpoint, no bulk mark-as-read, missing WebSocket/SSE for real-time, notification type enum not formally cataloged |
| exit-waterfall.md | 413 | HAS ISSUES | `runWaterfall` method is a comment-only stub |
| share-classes.md | 403 | NEEDS EXPANSION | Needs +97 lines |
| company-cnpj-validation.md | 402 | MINOR ISSUES | No explicit CNPJ retry endpoint for EC-3 |
| company-blockchain-admin.md | 362 | MINOR ISSUES | No admin signing UX/API for ownership transfer |
| cap-table-reconciliation.md | 194 | COMPLETE | Shortest spec but self-contained |

### Cross-Cutting Specifications (in `.claude/rules/`)

| Spec File | Lines | Status |
|-----------|-------|--------|
| api-standards.md | 1,141 | COMPLETE — Source of truth for conventions |
| audit-logging.md | 1,057 | COMPLETE — Has FINANCE audit access conflict |
| security.md | 962 | COMPLETE — Pre-signed URL 15-min expiry |
| error-handling.md | 957 | COMPLETE — Missing some error codes |
| design-system.md | 891 | COMPLETE |
| i18n.md | 98 | COMPLETE (concise rules format) |
| testing-backend.md | 71 | COMPLETE (concise rules format) |
| testing-frontend.md | 24 | COMPLETE (concise rules format) |

---

## Table of Contents

1. [Phase 0: Specification Completion (BLOCKING)](#phase-0-specification-completion-blocking)
   - [P0.CRITICAL: Implementation-Blocking Conflicts](#p0critical-implementation-blocking-conflicts)
   - [P0.HIGH: Missing Endpoints, Permission/Status Conflicts](#p0high-missing-endpoints-permissionstatus-conflicts)
   - [P0.MEDIUM: Missing Schemas, Frontend Code, Open Questions](#p0medium-missing-schemas-frontend-code-open-questions)
   - [P0.LOW: Cross-References, Numbering, Documentation](#p0low-cross-references-numbering-documentation)
   - [P0.DONE: Previously Completed Items](#p0done-previously-completed-items)
   - [P0.GATE: Phase 0 Completion Gate](#p0gate-phase-0-completion-gate)
2. [Phase 1: Foundation and Infrastructure](#phase-1-foundation-and-infrastructure)
3. [Phase 2: Core Cap Table](#phase-2-core-cap-table)
4. [Phase 3: Blockchain Integration](#phase-3-blockchain-integration)
5. [Phase 4: Transactions](#phase-4-transactions)
6. [Phase 5: Investment Features](#phase-5-investment-features)
7. [Phase 6: Employee Equity](#phase-6-employee-equity)
8. [Phase 7: Documents and Signatures](#phase-7-documents-and-signatures)
9. [Phase 8: Notifications, Reports, and Compliance](#phase-8-notifications-reports-and-compliance)
10. [Phase 9: Production Readiness](#phase-9-production-readiness)
11. [Dependency Graph](#dependency-graph)
12. [Technology Stack Reference](#technology-stack-reference)
13. [Quick Reference: Prioritized Work Remaining](#quick-reference-prioritized-work-remaining)

---

## Phase 0: Specification Completion (BLOCKING)

**CRITICAL: No implementation code should be written until Phase 0 is 100% complete.**

Phase 0 is organized into priority tiers. Items in higher tiers MUST be resolved before lower tiers, because lower-tier fixes may be affected by decisions made in higher tiers.

---

### P0.CRITICAL: Implementation-Blocking Conflicts

These items cause direct contradictions that would force rework if implementation started. Resolve ALL before any code is written.

#### C1. snake_case vs camelCase in TypeScript Interfaces (SYSTEMIC — 13 files)

**Problem**: Nearly all specs define TypeScript entity interfaces using `snake_case` field names (`company_id`, `created_at`, `wallet_address`). The project's `api-standards.md` mandates:
- **camelCase** for TypeScript interfaces and JSON request/response fields
- **snake_case** for database columns only (Prisma `@map()` bridges the two)

**Affected specs** (all TypeScript `interface` blocks need conversion):

| # | File | Interfaces Using snake_case |
|---|------|-----------------------------|
| C1.1 | `specs/authentication.md` | `User`, `AuthSession` |
| C1.2 | `specs/kyc-verification.md` | `KYCVerification` |
| C1.3 | `specs/cap-table-management.md` | `CapTable`, `CapTableEntry`, `HistoricalSnapshot` |
| C1.4 | `specs/shareholder-registry.md` | `Shareholder`, `BeneficialOwner` |
| C1.5 | `specs/blockchain-integration.md` | `AdminWallet`, `BlockchainTransaction`, `SyncStatus` |
| C1.6 | `specs/transactions.md` | Already camelCase (SKIP) |
| C1.7 | `specs/funding-rounds.md` | `FundingRound`, `RoundCommitment` |
| C1.8 | `specs/convertible-instruments.md` | `ConvertibleInstrument` |
| C1.9 | `specs/convertible-conversion.md` | Various conversion interfaces |
| C1.10 | `specs/option-plans.md` | `OptionPlan`, `OptionGrant`, `VestingSchedule` |
| C1.11 | `specs/option-exercises.md` | `OptionExerciseRequest` |
| C1.12 | `specs/document-generation.md` | `Document`, `DocumentTemplate` |
| C1.13 | `specs/notifications.md` | `Notification`, `NotificationPreferences` |

**Resolution**: For each file, convert all `snake_case` field names in TypeScript interfaces to `camelCase`. Do NOT change Prisma schema examples or database column references (those stay `snake_case`). Update corresponding API request/response JSON examples to match.

**Estimated effort**: ~2-3 hours (mechanical find-and-replace with manual review).

---

#### C2. Response Envelope Non-Compliance (SYSTEMIC — 6+ files)

**Problem**: Multiple specs show API responses that don't use the standard `{ "success": true, "data": ... }` envelope defined in `api-standards.md`.

| # | File | Issue | Example |
|---|------|-------|---------|
| C2.1 | `specs/authentication.md` | Login returns `{ "user": ..., "session": ... }` | Should be `{ "success": true, "data": { "user": ..., "session": ... } }` |
| C2.2 | `specs/kyc-verification.md` | All endpoints return raw objects | Should be wrapped in envelope |
| C2.3 | `specs/shareholder-registry.md` | List returns `{ "shareholders": [], "pagination": {} }` | Should use `{ "success": true, "data": [], "meta": { ... } }` |
| C2.4 | `specs/convertible-instruments.md` | List returns `{ "convertibles": [], "summary": {} }` | Should use standard paginated envelope |
| C2.5 | `specs/blockchain-integration.md` | All endpoints return raw objects | Should be wrapped in envelope |
| C2.6 | `specs/company-profile.md` | Some endpoints return raw objects | Should be wrapped in envelope |

**Resolution**: Update all API response examples to use the standard envelope. For lists, use `{ "success": true, "data": [...], "meta": { "total", "page", "limit", "totalPages" } }`. For single resources, use `{ "success": true, "data": { ... } }`.

**Estimated effort**: ~2 hours.

---

#### C3. Company Scoping: `X-Company-Id` Header vs `:companyId` Path Parameter

**Problem**: `company-management.md` FR-3 uses an `X-Company-Id` HTTP header for company scoping. `api-standards.md` uses `:companyId` as a URL path parameter (e.g., `/api/v1/companies/:companyId/shareholders`). These are incompatible approaches.

**Note**: `api-standards.md` (the cross-cutting standard) does NOT mention `X-Company-Id` at all. The path parameter approach is used in all 14 resource paths defined in the api-standards resource path table.

**Affected files**:
- `specs/company-management.md` (FR-3, FR-4, lines 102-114, 251, 305, 335, 422, 514, 605-626)
- `specs/company-membership.md` (lines 179, 218, 243, 298, 337)

**Resolution**: Remove all `X-Company-Id` header references. Company scoping is via `:companyId` in URL path, as defined in `api-standards.md`. Update the `CompanyGuard` middleware code example to extract `companyId` from `request.params` instead of headers.

**Estimated effort**: ~1 hour.

---

#### C4. Entity Rename: `CapTableEntry` to `Shareholding`

**Problem**: `cap-table-management.md` uses `CapTableEntry` but the entity glossary in `specs/README.md` defines the canonical name as `Shareholding`.

**Files**:
- `specs/cap-table-management.md` (lines 125, 128, 158, 533 and throughout)
- `specs/shareholder-registry.md` (5 references to `cap_table_entries` at lines 891, 914, 920, 926, 937)
- `ARCHITECTURE.md` (references `CapTableEntry` in entity descriptions)

**Resolution**: Rename all occurrences of `CapTableEntry` to `Shareholding` and `cap_table_entries` to `shareholdings` across all 3 files.

**Estimated effort**: ~15 minutes.

---

#### C5. Field Rename: `document_hash` to `contentHash`

**Problem**: Two specs use `document_hash` where the canonical name should be `contentHash`.

| # | File | Occurrences |
|---|------|-------------|
| C5.1 | `specs/document-generation.md` | Lines 119, 555, 591 (in interface and JSON examples) |
| C5.2 | `specs/document-signatures.md` | Lines 46, 53, 57, 449 (in FR text references) |
| C5.3 | `ARCHITECTURE.md` | References `document_hash` in entity descriptions |

**Note**: The `DocumentSigner` entity interface in document-signatures.md already uses camelCase `documentHash` — but the FR text still says `document_hash`.

**Resolution**: Replace `document_hash` with `contentHash` in both files (interface fields, JSON examples, and FR text).

**Estimated effort**: ~15 minutes.

---

#### C6. KYCStatus Enum Mismatch Between Specs

**Problem**: Two specs define KYCStatus with different values and different casing:

| Spec | Enum Values | Casing |
|------|-------------|--------|
| `authentication.md` (User.kyc_status) | `not_started`, `in_progress`, `approved`, `rejected` | lowercase |
| `kyc-verification.md` (FR-7) | `not_started`, `in_progress`, `pending_review`, `approved`, `rejected`, `resubmission_required` | lowercase in text |
| Every other spec | N/A | UPPER_SNAKE_CASE convention |

**Resolution**: Standardize on the `kyc-verification.md` 6-value enum with UPPER_SNAKE_CASE:
```
NOT_STARTED | IN_PROGRESS | PENDING_REVIEW | APPROVED | REJECTED | RESUBMISSION_REQUIRED
```
Update `authentication.md` User entity to use all 6 values in UPPER_SNAKE_CASE.

**Estimated effort**: ~30 minutes.

---

#### C7. Funding Round Status Enum

**Problem**: `funding-rounds.md` uses `OPEN | FIRST_CLOSE | FINAL_CLOSE | CANCELLED`. The corrected enum should be `DRAFT | OPEN | CLOSING | CLOSED | CANCELLED`.

**File**: `specs/funding-rounds.md` (lines 83, 172, 369)

**Resolution**: Replace the status enum values throughout the file.

**Estimated effort**: ~15 minutes.

---

#### C8. Convertible Instrument Enum Casing

**Problem**: `convertible-instruments.md` defines enums with lowercase `snake_case` values:
- `InstrumentType`: `mutuo_conversivel`, `investimento_anjo`, `misto`, `mais`
- `ConvertibleStatus`: `outstanding`, `converted`, `redeemed`, `matured`, `cancelled`

Every other spec in the project uses `UPPER_SNAKE_CASE` for enum values.

**File**: `specs/convertible-instruments.md` (lines 204, 218-222, and all JSON examples using lowercase)

**Resolution**: Convert to UPPER_SNAKE_CASE:
- `MUTUO_CONVERSIVEL | INVESTIMENTO_ANJO | MISTO | MAIS`
- `OUTSTANDING | CONVERTED | REDEEMED | MATURED | CANCELLED`

Update all JSON request/response examples to match.

**Estimated effort**: ~30 minutes.

---

#### C9. Blockchain API Paths Not Company-Scoped

**Problem**: Two blockchain endpoints are not company-scoped, violating `api-standards.md`:

| # | Current Path | Should Be |
|---|-------------|-----------|
| C9.1 | `POST /api/v1/blockchain/admin-wallet` | `POST /api/v1/companies/:companyId/blockchain/admin-wallet` |
| C9.2 | `GET /api/v1/transactions/:transactionId/blockchain` | `GET /api/v1/companies/:companyId/transactions/:transactionId/blockchain` |

**File**: `specs/blockchain-integration.md` (lines 150, 190)

**Resolution**: Update both paths to include `:companyId`. Update request body for admin-wallet (remove `company_id` from body since it's in the path).

**Estimated effort**: ~15 minutes.

---

#### C10. 403 vs 404 for Non-Members

**Problem**: `company-management.md` FR-3 says return `403 Forbidden` if user is not a member. Both `api-standards.md` and `security.md` mandate returning `404 Not Found` to prevent resource enumeration.

**File**: `specs/company-management.md` (line 105)

**Resolution**: Change FR-3 to return `404 Not Found` for non-members. Update the `CompanyGuard` code example accordingly.

**Estimated effort**: ~15 minutes.

---

#### C11. DELETE Response Status Codes

**Problem**: `company-membership.md` and `shareholder-registry.md` return `200 OK` with a response body for DELETE operations. `api-standards.md` mandates `204 No Content` with an empty body.

**Files**: `specs/company-membership.md`, `specs/shareholder-registry.md`

**Resolution**: Change DELETE responses to `204 No Content` with no body.

**Estimated effort**: ~15 minutes.

---

#### C12. Notification Channel Enum Missing

**Problem**: `notifications.md` describes email-only notifications but the entity glossary says `Notification` should have a `channel: 'EMAIL' | 'IN_APP'` enum. The spec needs this field added to the entity.

**File**: `specs/notifications.md`

**Resolution**: Add `channel: 'EMAIL' | 'IN_APP'` to the Notification entity definition.

**Estimated effort**: ~15 minutes (part of the larger notifications.md expansion, P0.3.5).

---

#### C13. Document Status Enum Missing `PARTIALLY_SIGNED`

> **v8.1 NOTE**: The following two CRITICAL items (C14, C15) were discovered by deep subagent research and added in v8.1.

**Problem**: `document-signatures.md` FR-5 references `PARTIALLY_SIGNED` as an overall document status. But `document-generation.md` defines the Document status enum as only: `DRAFT | GENERATED | PENDING_SIGNATURES | FULLY_SIGNED`.

**Files**: `specs/document-generation.md` (line 122), `specs/document-signatures.md` (line 63)

**Resolution**: Add `PARTIALLY_SIGNED` to the Document status enum in `document-generation.md`:
```
DRAFT | GENERATED | PENDING_SIGNATURES | PARTIALLY_SIGNED | FULLY_SIGNED
```

**Estimated effort**: ~10 minutes.

---

#### C14. Security: `accessPassword` Exposed in API Response (v8.1)

**Problem**: `company-profile.md` includes `accessPassword` in API response examples. Password fields must NEVER be returned in API responses — this would allow anyone who can view the profile to see the access password.

**File**: `specs/company-profile.md`

**Resolution**: Remove `accessPassword` from all API response examples. The password should only be accepted in request bodies and stored hashed on the backend. API responses should only include a boolean `hasAccessPassword: true/false`.

**Estimated effort**: ~15 minutes.

---

#### C15. `number` Type for Financial Values (SYSTEMIC — 16 files) (v8.1)

**Problem**: 114 occurrences across 16 specs use TypeScript `number` type for financial values (share quantities, prices, amounts, percentages). The `api-standards.md` mandate is that financial data uses `Decimal` (stored as `Decimal` in Prisma, serialized as `string` in JSON). Using `number` (IEEE 754 floating point) for financial calculations causes rounding errors.

**Most affected specs** (sorted by occurrence count):
- `convertible-conversion.md` (24), `convertible-instruments.md` (14), `option-plans.md` (13), `shareholder-registry.md` (12), `cap-table-management.md` (11), `funding-rounds.md` (8), `company-litigation-verification.md` (7), `company-dataroom.md` (5), `share-classes.md` (4)

**Resolution**: For each spec, change `number` to `string` for all financial fields in TypeScript interfaces and API examples. Add a note that these represent `Decimal` values serialized as strings. The Prisma schema will use `Decimal @db.Decimal(30, 10)` for these fields.

**Note**: Non-financial uses of `number` (e.g., `blockNumber`, `confirmations`, pagination counts) remain as `number`.

**Estimated effort**: ~3-4 hours (mechanical but requires judgment on which fields are financial).

---

#### P0.CRITICAL Resolution Checklist

```
SYSTEMIC FIXES (affects nearly all specs):
[ ] C1: Convert snake_case → camelCase in TypeScript interfaces across 13 spec files
[ ] C2: Wrap all API responses in standard envelope across 6+ spec files
[ ] C3: Remove X-Company-Id header approach; use :companyId path parameter (2 files)

ENTITY/FIELD RENAMES (4 files):
[ ] C4: cap-table-management.md — CapTableEntry → Shareholding
[ ] C5.1: document-generation.md — document_hash → contentHash (3 occurrences)
[ ] C5.2: document-signatures.md — document_hash → contentHash in FR text (4 occurrences)

ENUM STANDARDIZATION (4 files):
[ ] C6: authentication.md + kyc-verification.md — KYCStatus to 6-value UPPER_SNAKE_CASE
[ ] C7: funding-rounds.md — DRAFT | OPEN | CLOSING | CLOSED | CANCELLED (3 occurrences)
[ ] C8: convertible-instruments.md — All enums to UPPER_SNAKE_CASE

API PATH FIXES (1 file):
[ ] C9.1: blockchain-integration.md — admin-wallet endpoint to company scope
[ ] C9.2: blockchain-integration.md — transaction blockchain endpoint to company scope

BEHAVIOR FIXES (3 files):
[ ] C10: company-management.md — 403 → 404 for non-members
[ ] C11: company-membership.md + shareholder-registry.md — DELETE responses to 204
[ ] C12: notifications.md — Add channel enum to Notification entity
[ ] C13: document-generation.md — Add PARTIALLY_SIGNED to Document status enum

SECURITY + FINANCIAL TYPES (v8.1 additions):
[ ] C14: company-profile.md — Remove accessPassword from API responses (security)
[ ] C15: 16 spec files — Change financial `number` types to `string` (Decimal)
```

---

### P0.HIGH: Missing Endpoints, Permission/Status Conflicts

These items represent functional gaps or conflicts that would cause incorrect behavior if implemented as-is.

#### H1. Permission Matrix Conflicts

**Problem**: Three specs disagree on role permissions:

| Conflict | Spec A | Spec B | Resolution Needed |
|----------|--------|--------|-------------------|
| H1.1 | `reports-analytics.md` grants LEGAL "Full" access to cap table export and due diligence | `user-permissions.md` denies LEGAL `capTable:export` and `reports:export` | Decide: does LEGAL get export access? |
| H1.2 | `audit-logging.md` grants FINANCE "Read-only" access to audit logs | `user-permissions.md` denies FINANCE all audit log access | Decide: does FINANCE see audit logs? |

**Resolution**: `user-permissions.md` is the canonical source for the permission matrix. Update `reports-analytics.md` and `audit-logging.md` to match `user-permissions.md`, OR update `user-permissions.md` to grant these permissions if the business intent is for LEGAL and FINANCE to have access.

**Estimated effort**: ~30 minutes (requires a decision, then update 2-3 files).

---

#### H2. Missing API Endpoints

The following endpoints are referenced in specs, required by the UI, or logically necessary but never fully defined:

| # | Missing Endpoint | Referenced By | Purpose |
|---|-----------------|---------------|---------|
| H2.1 | CNPJ retry endpoint | `company-cnpj-validation.md` EC-3 | User retries failed CNPJ validation |
| H2.2 | Funding round cancellation | `funding-rounds.md` (status enum includes CANCELLED) | Admin cancels a round |
| H2.3 | Commitment payment status update | `funding-rounds.md` (payment_status field exists) | Admin confirms/updates payment |
| H2.4 | Document signature decline | `document-signatures.md` (DECLINED status exists) | Signer declines to sign |
| H2.5 | Notification unread count | `design-system.md` (notification bell with badge) | UI badge showing unread count |
| H2.6 | Notification bulk mark-as-read | Standard notification UX pattern | Mark multiple notifications as read |
| H2.7 | Option plan close | `option-plans.md` (CLOSED status exists) | Admin closes an option plan |
| H2.8 | Option grant termination/forfeiture | `option-exercises.md` (references termination) | Terminate unvested grants on employee departure |
| H2.9 | Admin signing UX for blockchain ownership transfer | `company-blockchain-admin.md` | Admin transfers contract ownership to new admin |
| H2.10 | Shareholder enum casing fix | `shareholder-registry.md` | ShareholderType/ShareholderStatus lowercase in interface, UPPER_SNAKE_CASE in service code |

**Resolution**: Define each missing endpoint with path, method, request body, response, permissions, and error codes. Add to the respective spec file.

**Estimated effort**: ~3-4 hours total.

---

#### H3. Missing Error Codes in Error Handling Spec

**Problem**: Several error codes are used in specs but not defined in `error-handling.md`:

| # | Error Code | Used In | Status |
|---|-----------|---------|--------|
| H3.1 | `AUTH_FORBIDDEN` | `user-permissions.md` (line 622) | Not in error-handling.md catalog |
| H3.2 | `NOTIFICATION_NOT_FOUND` | `notifications.md` | Not in error-handling.md catalog |
| H3.3 | `NOTIFICATION_PREFERENCES_INVALID` | `notifications.md` | Not in error-handling.md catalog |
| H3.4 | `PROFILE_LITIGATION_CNPJ_NOT_FOUND` | `company-litigation-verification.md` | Appears orphaned (never triggered) |

**Resolution**: Add H3.1-H3.3 to `error-handling.md` with PT-BR and EN translations. Verify H3.4 is actually needed or remove it.

**Estimated effort**: ~30 minutes.

---

#### H4. Missing Audit Events

**Problem**: `audit-logging.md` does not define events for share class changes:
- No `SHARE_CLASS_CREATED` event
- No `SHARE_CLASS_UPDATED` event
- No `SHARE_CLASS_DELETED` event

These are significant data mutations that should be audited.

**File**: `.claude/rules/audit-logging.md`

**Resolution**: Add share class events to the Company Events section of the audit event catalog.

**Estimated effort**: ~15 minutes.

---

#### H5. `AdminWallet` Entity Contradiction

**Problem**: `blockchain-integration.md` defines an `AdminWallet` entity. `company-blockchain-admin.md` explicitly states "No AdminWallet entity" and stores the wallet address directly on the `Company` entity.

**Resolution**: Remove `AdminWallet` entity from `blockchain-integration.md`. The wallet address is stored on the `Company` entity per `company-blockchain-admin.md`.

**Estimated effort**: ~30 minutes.

---

#### H6. `BlockchainTransaction` 1:1 Constraint

**Problem**: `blockchain-integration.md` has a 1:1 relationship between `Transaction` and `BlockchainTransaction`. If a blockchain transaction fails and needs re-submission, a new `BlockchainTransaction` record cannot be created.

**Resolution**: Change to 1:many relationship (`Transaction` has many `BlockchainTransaction` records). Only the latest one represents the current state. Add a `status` field (`SUBMITTED | CONFIRMED | FAILED`) to `BlockchainTransaction`.

**Estimated effort**: ~30 minutes.

---

#### H7. Pre-signed URL Expiry Conflict

**Problem**: `security.md` says pre-signed URLs expire after 15 minutes. `kyc-verification.md` SEC-1 says 5 minutes for KYC documents.

**Resolution**: Both are valid. KYC documents are more sensitive and should have shorter expiry. Clarify in `security.md` that the 15-minute default can be overridden per-bucket, and that KYC documents specifically use 5-minute expiry.

**Estimated effort**: ~10 minutes.

---

#### H8. Transaction Spec Gaps

**Problem**: Several gaps in `transactions.md`:

| # | Gap | Issue |
|---|-----|-------|
| H8.1 | DRAFT status exists but no API to create transactions in DRAFT | How does a draft transaction get created? |
| H8.2 | No request body examples for CONVERSION, CANCELLATION, SPLIT types | Only ISSUANCE and TRANSFER have examples |
| H8.3 | `cancelledAt`/`cancelledBy` in responses but not in interface | Fields missing from entity definition |
| H8.4 | `toShareholderId` required but meaningless for CANCELLATION | Should be optional or null for cancellations |
| H8.5 | No CONVERSION transaction details (`toShareClassId`, conversion rate) | Conversion-specific fields missing |

**Resolution**: Address each gap in `transactions.md`. Add request body examples for all transaction types. Fix the entity definition.

**Estimated effort**: ~1 hour.

---

#### H9. Stale File References in transactions.md

**Problem**: `transactions.md` references:
- `cap-table.md` (should be `cap-table-management.md`)
- `blockchain.md` (should be `blockchain-integration.md`)

**Resolution**: Fix the cross-references.

**Estimated effort**: ~5 minutes.

---

#### P0.HIGH Resolution Checklist

```
PERMISSION CONFLICTS (2-3 files):
[ ] H1.1: Resolve LEGAL export access: reports-analytics.md vs user-permissions.md
[ ] H1.2: Resolve FINANCE audit access: audit-logging.md vs user-permissions.md

MISSING ENDPOINTS (10 endpoints across 6 files):
[ ] H2.1: company-cnpj-validation.md — CNPJ retry endpoint
[ ] H2.2: funding-rounds.md — Round cancellation endpoint
[ ] H2.3: funding-rounds.md — Commitment payment status update endpoint
[ ] H2.4: document-signatures.md — Signature decline endpoint
[ ] H2.5: notifications.md — Unread count endpoint
[ ] H2.6: notifications.md — Bulk mark-as-read endpoint
[ ] H2.7: option-plans.md — Plan close endpoint
[ ] H2.8: option-plans.md OR option-exercises.md — Grant termination/forfeiture endpoint
[ ] H2.9: company-blockchain-admin.md — Admin ownership transfer signing API
[ ] H2.10: shareholder-registry.md — Fix enum casing inconsistency

MISSING ERROR CODES (1 file):
[ ] H3: Add AUTH_FORBIDDEN, NOTIFICATION_NOT_FOUND, NOTIFICATION_PREFERENCES_INVALID to error-handling.md
[ ] H3.4: Verify or remove PROFILE_LITIGATION_CNPJ_NOT_FOUND

MISSING AUDIT EVENTS (1 file):
[ ] H4: Add SHARE_CLASS_CREATED/UPDATED/DELETED to audit-logging.md

ENTITY/RELATIONSHIP FIXES (1 file):
[ ] H5: Remove AdminWallet entity from blockchain-integration.md
[ ] H6: Change BlockchainTransaction to 1:many with Transaction

CLARIFICATIONS (2 files):
[ ] H7: Clarify pre-signed URL expiry policy in security.md
[ ] H8: Fill transaction spec gaps (DRAFT creation, CONVERSION body, etc.)
[ ] H9: Fix stale cross-references in transactions.md
```

---

### P0.MEDIUM: Missing Schemas, Frontend Code, Open Questions

These items affect implementation quality but would not cause contradictions. They can be resolved in parallel with P0.CRITICAL work.

#### M1. Missing Prisma Schema Definitions

**Problem**: Most specs define TypeScript interfaces but not Prisma schema models. Only `share-classes.md` includes a Prisma schema example. Without Prisma schemas, developers must derive the database schema from TypeScript interfaces, which is error-prone (especially for relationships, indexes, and @map decorators).

**Resolution options** (choose one):
- **Option A**: Add Prisma schema blocks to each spec (comprehensive but adds ~100 lines per spec).
- **Option B**: Create a single `prisma-schema.md` spec that consolidates all entity schemas in one file (easier to maintain, single source of truth for the database).
- **Option C**: Defer to Phase 1 and derive schemas from TypeScript interfaces during implementation.

**Recommendation**: Option B — create a consolidated `specs/prisma-schema.md` with all entity Prisma models, relationships, indexes, and migration notes.

**Estimated effort**: ~4-6 hours for a complete Prisma schema spec.

---

#### M2. Frontend Code Issues in Specs

**Problem**: Several specs include frontend code examples that don't follow project conventions:

| # | File | Issue |
|---|------|-------|
| M2.1 | `kyc-verification.md` | Uses `alert()` instead of toast notifications (sonner) |
| M2.2 | `convertible-conversion.md` | Uses raw `fetch()` instead of typed API client |
| M2.3 | `shareholder-registry.md` | Uses raw `fetch()` instead of typed API client |
| M2.4 | Multiple specs | Frontend code doesn't reference design-system.md components |

**Resolution**: Update frontend code examples to use the typed API client (`api.get()`, `api.post()`), TanStack Query hooks, sonner toast notifications, and shadcn/ui components per design-system.md.

**Estimated effort**: ~2 hours.

---

#### M3. Open Questions in Specs

**Problem**: Three specs contain unresolved open questions that could affect implementation:

**authentication.md** (4 questions):
1. Should we implement "Remember Me" functionality for extended sessions?
2. What is the maximum session duration for admin users?
3. Should we support hardware wallet connection for advanced users in future phases?
4. How do we handle users who lose access to their email and Privy recovery method?

**kyc-verification.md** (5 questions):
1. Should we implement progressive KYC levels (Basic -> Standard -> Enhanced)?
2. What is the manual review SLA for high-risk users?
3. Should we support KYC for minors (under 18) with guardian consent?
4. How do we handle users with foreign documents (non-Brazilian)?
5. Should we implement KYC expiration (re-verification after X years)?

**convertible-instruments.md** (5 questions):
1. Should we support partial conversions (converting portion of principal)?
2. What happens if investor has multiple convertibles in same company?
3. Should we allow convertible-to-convertible refinancing?
4. How do we handle foreign currency convertibles (USD)?
5. Should we support automated valuation cap adjustments based on milestones?

**Resolution**: Answer each question with a definitive MVP decision. For questions about future phases, document the decision as "Deferred to post-MVP" and move to the Future Enhancements section.

**Recommended answers for MVP**:
- authentication.md Q1: No "Remember Me" in MVP. Standard 7-day session.
- authentication.md Q2: Same as all users: 2hr inactivity, 7d absolute.
- authentication.md Q3: Deferred to post-MVP.
- authentication.md Q4: Privy handles recovery. If both lost, contact support for manual verification.
- kyc-verification.md Q1-5: All deferred to post-MVP. Standard-only verification, no minors, no foreign docs, no expiration.
- convertible-instruments.md Q1: Yes, support partial conversions (common in practice).
- convertible-instruments.md Q2: Each convertible is independent. Multiple allowed.
- convertible-instruments.md Q3-5: Deferred to post-MVP.

**Estimated effort**: ~1 hour (document decisions, update specs).

---

#### M4. Missing Entities/Models

**Problem**: Several entities are referenced in specs but not fully defined:

| # | Entity | Referenced In | Issue |
|---|--------|---------------|-------|
| M4.1 | `RoundClose` | `funding-rounds.md` | Mentioned but not fully defined as an entity |
| M4.2 | `ExportJob` | `reports-analytics.md` | No persistence model for async export jobs. Needs: id, companyId, format, status (QUEUED/PROCESSING/COMPLETED/FAILED), s3Key, downloadUrl, expiresAt, errorCode. Also missing from Prisma schema. |
| M4.3 | `CompanyScopeGuard` | `user-permissions.md` | Referenced but implementation spec not defined. Both `RolesGuard` and `PermissionGuard` depend on it. |
| M4.4 | Company bank account | `option-exercises.md` (bank transfer payment) | No entity for storing company bank details for payment |

**Resolution**: Define each missing entity with all required fields. `RoundClose` and `ExportJob` should be full entity definitions. `CompanyScopeGuard` is an implementation detail that can be deferred to Phase 1 code. Company bank account needs a decision: is it part of Company settings or a separate entity?

**Estimated effort**: ~2 hours.

---

#### M5. Specification Expansions (3 remaining)

These specs need additional content to reach their target line counts. Expansion topics are defined below.

#### M5.1 share-classes.md (403 -> 500+ lines, need +97)

- **Priority**: Medium (close to target)
- **Still needed**:
  - Anti-dilution protection formulas (full ratchet, weighted average)
  - Conversion rights mechanics (preferred -> common)
  - Pre-emptive rights detail (Direito de Subscricao, Lei 6.404/76 Art. 171)
  - Treasury shares handling
  - Additional API request/response examples

#### M5.2 funding-rounds.md (467 -> 500+ lines, need +33)

- **Priority**: Medium (very close to target)
- **Still needed**:
  - Fix status enum (handled in C7, but also add DRAFT round creation flow)
  - Multi-close entity (`RoundClose`) with full definition
  - Oversubscription handling detail (hard cap, pro-rata allocation)
  - Missing endpoints from H2.2 and H2.3

#### M5.3 notifications.md (420 -> 600+ lines, need +180)

- **Priority**: Medium
- **Still needed**:
  - Additional email template specifications (variables, subject lines per template)
  - In-app notification system (add `channel: 'EMAIL' | 'IN_APP'` enum — from C12)
  - Bounce handling (AWS SES webhooks)
  - Email template MJML structure examples
  - Webhook handling for delivery status
  - Missing endpoints from H2.5 and H2.6

---

#### M6. exit-waterfall.md Stub Implementation

**Problem**: The `runWaterfall` method in exit-waterfall.md is a comment-only stub:
```typescript
async runWaterfall(...): Promise<WaterfallAnalysis> {
  // 1. Load share classes with liquidation preference terms
  // 2. Determine stacking order
  // ...
}
```

While the algorithm steps are described elsewhere in the spec, the code example should show actual logic, not just comments.

**Resolution**: Either expand the stub with pseudocode/real implementation OR remove the stub entirely and rely on the algorithm description in the spec text (Steps 1-7).

**Estimated effort**: ~1 hour.

---

#### P0.MEDIUM Resolution Checklist

```
MISSING PRISMA SCHEMA:
[ ] M1: Decide on approach (Option A/B/C) and implement

FRONTEND CODE FIXES (3 files):
[ ] M2.1: kyc-verification.md — Replace alert() with toast
[ ] M2.2: convertible-conversion.md — Replace fetch() with API client
[ ] M2.3: shareholder-registry.md — Replace fetch() with API client

OPEN QUESTIONS (3 files):
[ ] M3.1: authentication.md — Resolve 4 open questions
[ ] M3.2: kyc-verification.md — Resolve 5 open questions
[ ] M3.3: convertible-instruments.md — Resolve 5 open questions

MISSING ENTITIES (4 items):
[ ] M4.1: funding-rounds.md — Full RoundClose entity definition
[ ] M4.2: reports-analytics.md — ExportJob entity definition
[ ] M4.3: user-permissions.md — CompanyScopeGuard (can defer to Phase 1)
[ ] M4.4: Decide on company bank account entity

SPEC EXPANSIONS (3 files):
[ ] M5.1: share-classes.md — 403 → 500+ lines
[ ] M5.2: funding-rounds.md — 467 → 500+ lines
[ ] M5.3: notifications.md — 420 → 600+ lines

CODE STUB:
[ ] M6: exit-waterfall.md — Expand or remove runWaterfall stub
```

---

### P0.LOW: Cross-References, Numbering, Documentation

These items are cosmetic or documentation-only. They don't affect implementation correctness.

#### L1. Incomplete Cross-References in Company Specs

**Problem**: Four company specs end with: "Cross-references to be completed in Phase 5 of the spec alignment project."

| # | File |
|---|------|
| L1.1 | `specs/company-management.md` (line 761) |
| L1.2 | `specs/company-membership.md` (line 747) |
| L1.3 | `specs/company-cnpj-validation.md` (line 402) |
| L1.4 | `specs/company-blockchain-admin.md` (line 361) |

**Resolution**: Complete the cross-reference tables, following the pattern used in `authentication.md` (which has a complete cross-reference table).

**Estimated effort**: ~30 minutes.

---

#### L2. company-profile.md Numbering Gaps

**Problem**: `company-profile.md` has numbering gaps — BR-5 and EC-2 are missing (the sequence jumps).

**Resolution**: Renumber or add the missing items.

**Estimated effort**: ~10 minutes.

---

#### L3. VelaFund to Navia Rename

**Problem**: Several files still reference the old project name "VelaFund":

| # | File | Issue |
|---|------|-------|
| L3.1 | `README.md` (line 1) | Contains `# VelaFund` |
| L3.2 | `ARCHITECTURE.md` (line 1) | Contains `# VelaFund MVP - Architecture Documentation` |
| L3.3 | `ARCHITECTURE.md` (line 155) | Contains `VelaFund uses **Verifik**...` |
| L3.4 | `.claude/settings.local.json` (lines 5-8) | References `VelaFund_MVP` path |

**Resolution**: Global rename VelaFund -> Navia in all files.

**Estimated effort**: ~15 minutes.

---

#### L4. ARCHITECTURE.md ERD Gaps

**Problem**: The Entity Relationship Diagram in ARCHITECTURE.md is missing entities defined in specifications:

| Missing Entity | Defined In |
|---------------|-----------|
| `KYCVerification` | `specs/kyc-verification.md` |
| `AuditLog` | `.claude/rules/audit-logging.md` |
| `ConsentRecord` | `.claude/rules/security.md` |
| `DocumentTemplate` | `specs/document-generation.md` |
| `ConvertibleInstrument` | `specs/convertible-instruments.md` |
| `ExitScenario` / `WaterfallResult` | `specs/exit-waterfall.md` |
| `LitigationVerification` | `specs/company-litigation-verification.md` |
| `DataroomDocument` / `DataroomFolder` | `specs/company-dataroom.md` |

**Resolution**: Update ARCHITECTURE.md ERD to include all entities from the 26 spec files.

**Estimated effort**: ~1 hour.

---

#### P0.LOW Resolution Checklist

```
CROSS-REFERENCES (4 files):
[ ] L1.1: company-management.md — Complete cross-reference table
[ ] L1.2: company-membership.md — Complete cross-reference table
[ ] L1.3: company-cnpj-validation.md — Complete cross-reference table
[ ] L1.4: company-blockchain-admin.md — Complete cross-reference table

NUMBERING:
[ ] L2: company-profile.md — Fix BR-5 and EC-2 numbering gaps

RENAME (3 files):
[ ] L3.1: README.md — VelaFund → Navia MVP
[ ] L3.2-3: ARCHITECTURE.md — VelaFund → Navia (2 occurrences)
[ ] L3.4: .claude/settings.local.json — Update stale VelaFund_MVP paths

ARCHITECTURE ERD:
[ ] L4: ARCHITECTURE.md — Add 8+ missing entities to ERD
```

---

### P0.DONE: Previously Completed Items

These items from previous plan versions have been verified as complete.

| # | Item | Resolution | Version |
|---|------|------------|---------|
| 1 | `.claude/commands/architecture.md` referenced Django | Updated to NestJS 10+ | v6.0 |
| 2 | `.claude/rules/testing-backend.md` referenced Django | Rewritten for NestJS + Jest | v6.0 |
| 3 | API paths missing `/api/v1/` prefix | All spec files updated | v6.0 |
| 4 | `Transaction` vs `ShareTransaction` naming | `Transaction` with `transactionType` discriminator | v6.0 |
| 5 | `Signature` entity should be `DocumentSigner` | Fixed in document-signatures.md | v7.0 |
| 6 | `OptionGrant` vs `Option` naming | `OptionGrant` used consistently | v6.0 |
| 7 | specs/README.md entity glossary | Added with 26 entities | v6.0 |
| 8 | Document generation paths not company-scoped | Fixed | v7.0 |
| 9 | Document signature paths not company-scoped | Fixed | v7.0 |
| 10 | Option plan vesting path not company-scoped | Fixed | v7.0 |
| 11 | Notification paths not user-scoped | Fixed | v7.0 |
| 12 | Shareholder /me path not user-scoped | Fixed | v7.0 |
| 13 | reports-analytics.md expansion (117 -> 602 lines) | Complete | v7.0 |
| 14 | user-permissions.md expansion (161 -> 739 lines) | Complete | v7.0 |
| 15 | option-plans.md expansion (204 -> 552 lines) | Complete | v7.0 |
| 16 | 9 new specs authored (company-membership, company-cnpj-validation, company-blockchain-admin, company-profile, company-dataroom, company-litigation-verification, convertible-conversion, exit-waterfall, cap-table-reconciliation) | Complete | v7.1 |
| 17 | Blockchain `/status` endpoint company-scoped | Fixed | v7.1 |
| 18 | KYC status hybrid approach documented | Documented in kyc-verification.md | v6.0 |

---

### P0.GATE: Phase 0 Completion Gate

**Gate criteria — ALL must be checked before proceeding to Phase 1**:

```
P0.CRITICAL (18 items — ALL must be done):
[ ] C1: snake_case → camelCase in 13 spec files
[ ] C2: Response envelope compliance in 6+ spec files
[ ] C3: X-Company-Id → :companyId path parameter (2 files)
[ ] C4: CapTableEntry → Shareholding
[ ] C5: document_hash → contentHash (2 files)
[ ] C6: KYCStatus enum standardized (6 values, UPPER_SNAKE_CASE)
[ ] C7: FundingRound status enum corrected
[ ] C8: ConvertibleInstrument enum casing fixed
[ ] C9: Blockchain API paths company-scoped (2 paths)
[ ] C10: 403 → 404 for non-members
[ ] C11: DELETE responses to 204 No Content
[ ] C12: Notification channel enum added
[ ] C13: PARTIALLY_SIGNED added to Document status enum

P0.HIGH (18 items — ALL must be done):
[ ] H1: Permission matrix conflicts resolved
[ ] H2: All 10 missing endpoints defined
[ ] H3: Missing error codes added to error-handling.md
[ ] H4: Share class audit events added
[ ] H5: AdminWallet entity removed from blockchain-integration.md
[ ] H6: BlockchainTransaction changed to 1:many
[ ] H7: Pre-signed URL expiry clarified
[ ] H8: Transaction spec gaps filled
[ ] H9: Stale cross-references fixed

P0.MEDIUM (13 items — recommended before Phase 1):
[ ] M1: Prisma schema approach decided and implemented
[ ] M2: Frontend code examples fixed (3 files)
[ ] M3: Open questions resolved (3 files, 14 questions)
[ ] M4: Missing entities defined (4 items)
[ ] M5: Spec expansions complete (3 files)
[ ] M6: exit-waterfall.md stub resolved

P0.LOW (8 items — can be done during Phase 1):
[ ] L1: Cross-references completed (4 files)
[ ] L2: company-profile.md numbering fixed
[ ] L3: VelaFund → Navia rename (3 files)
[ ] L4: ARCHITECTURE.md ERD updated

FINAL REVIEW:
[ ] All specifications reviewed for consistency
[ ] No conflicting entity names across specs
[ ] API paths consistent with api-standards.md scoping rules
[ ] All enum values use UPPER_SNAKE_CASE
[ ] All TypeScript interfaces use camelCase
[ ] All API responses use standard envelope
[ ] Error codes defined for all error scenarios
[ ] Permission matrix is single-source-of-truth in user-permissions.md
```

---

## Phase 1: Foundation and Infrastructure

**Timeline**: Weeks 2-3 (after Phase 0 completion)
**Dependencies**: Phase 0 complete (at minimum P0.CRITICAL and P0.HIGH)
**Estimated Duration**: 2 weeks

### 1.1 Project Setup

- [x] Initialize monorepo structure (**DONE** - v0.0.1)
  - Created `/frontend`, `/backend`, `/contracts` directories
  - Configured pnpm workspaces + Turborepo
  - Created root `package.json` with workspace config

- [x] Configure development tooling (**PARTIAL** - v0.0.1)
  - Set up Git hooks (Husky) — installed, pre-commit hooks pending
  - Created shared TypeScript configurations (tsconfig.base.json)
  - Set up ESLint + Prettier with consistent rules
  - **MISSING**: `.env.example` files for backend and frontend (neither exists)

- [ ] Set up CI/CD pipeline
  - Configure GitHub Actions (lint, test, build, secret scan)
  - Configure branch protection (require PR, CI pass)
  - Enable GitHub Dependabot for vulnerability scanning
  - Set up automatic deployments for staging

### 1.2 Frontend Foundation (Next.js)

- [x] Initialize Next.js 14+ with App Router (**DONE** - v0.0.1)
  - Configured TypeScript strict mode
  - shadcn/ui CSS variables configured in globals.css
  - TanStack Query provider configured in providers.tsx (staleTime: 60s, smart retry)
  - i18n message files created (pt-BR.json, en.json) — minimal skeleton, ~9 error keys
  - Sentry integration pending

- [x] Create base layouts per design-system.md (**DONE** - visual structure complete)
  - Dashboard layout with sidebar navigation (**DONE** — high-fidelity to spec: navy-900 bg, 240px/64px, active states, overline labels, dividers, user section)
  - Auth layout (**DONE** — centered card, gray-50 background)
  - Top bar (**DONE** — search bar, notification bell with badge, user avatar; missing: company switcher, notification dropdown, real user data)
  - Responsive sidebar (**DONE** — collapsible at md, mobile drawer at sm via mobile-sidebar.tsx)
  - **GAPS**: User data hardcoded ("Nelson Pereira"), no company switcher in topbar, notification bell is placeholder, nav items duplicated between sidebar.tsx and mobile-sidebar.tsx (should be shared constant), keyboard shortcut shows "Ctrl K" not "⌘ K", missing `aria-current="page"` on active nav links (accessibility)

- [x] Set up form handling and validation (**PARTIAL** - v0.0.1)
  - React Hook Form + Zod dependencies installed
  - Created typed API client with error interceptor (per api-standards.md envelope)
  - **MISSING**: CSRF token injection in API client (`X-CSRF-Token` header)
  - **MISSING**: 401 auto-redirect to `/login?expired=true`
  - **MISSING**: Dynamic `Accept-Language` from user locale (hardcoded to `pt-BR`)
  - **MISSING**: `useErrorToast()` hook for consuming ApiError objects
  - Loading skeletons and error boundaries pending
  - Toast notifications via sonner (**DONE** — Toaster configured with correct colors/positions)

- [ ] Install and configure shadcn/ui component library
  - Run `npx shadcn-ui@latest init` (Radix UI primitives are installed, but CLI never run — no `components/ui/` directory, no `components.json`)
  - Generate core components: Button, Input, Card, Table, Dialog, Select, Badge, Tabs, Tooltip, Avatar, DropdownMenu, Label

- [ ] Integrate next-intl for i18n
  - Install `next-intl` package (NOT currently installed)
  - Create root middleware.ts for locale routing
  - Replace all hardcoded English strings with `useTranslations()` calls
  - Expand message files: add auth.*, shareholders.*, capTable.*, transactions.*, settings.* namespaces

- [ ] Fix tailwind.config.ts / globals.css border radius systematic error
  - `globals.css` sets `--radius: 0.5rem` (8px) but design-system.md requires `radius-lg = 12px`
  - Entire scale is shifted: lg=8px (should be 12px), md=6px (should be 8px), sm=4px (should be 6px)
  - `borderRadius.xl` (16px) is undefined entirely
  - Fix: set `--radius: 0.75rem` (12px) and add explicit xl=16px

- [ ] Add security headers to next.config.js
  - **MISSING**: `Content-Security-Policy` header (required by security.md) — must allow Privy iframe, S3 images, Base RPC
  - **MISSING**: `Strict-Transport-Security` header
  - Add via `next.config.js` `headers()` function

- [ ] Create Brazilian formatting helpers in `lib/`
  - `formatNumber()` — `Intl.NumberFormat('pt-BR')` for all numbers regardless of locale
  - `formatCurrency()` — `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` for R$ values
  - `formatDate()` — `Intl.DateTimeFormat('pt-BR')` for dd/MM/yyyy dates
  - `formatPercentage()` — Brazilian format with comma decimal separator
  - Required by i18n.md "Formatting — Always Brazilian" section

- [ ] Add route protection
  - Create `middleware.ts` to redirect unauthenticated users from protected routes
  - Currently: unauthenticated users can visit `/dashboard` and see full UI with hardcoded data

### 1.3 Backend Foundation (NestJS)

- [x] Initialize NestJS 10+ with TypeScript (**DONE** - v0.0.1)
  - PostgreSQL connection via PrismaService (SSL, pooling via env config)
  - Set up Prisma ORM with complete schema (ALL entities from 26 specs)
  - Environment validation via @nestjs/config

- [x] Create base database schema (Prisma) (**COMPLETE** - v0.0.1 initial, v0.0.4 relations/indexes fixed. 32 models, 35 enums)
  - ALL main entities defined: User, Company, CompanyMember, Shareholder, ShareClass, Shareholding, Transaction, BlockchainTransaction, FundingRound, RoundCommitment, RoundClose, ConvertibleInstrument, OptionPlan, OptionGrant, OptionExerciseRequest, Document, DocumentSigner, DocumentTemplate, Notification, UserNotificationPreferences, AuditLog, AuditHashChain, ConsentRecord, KycVerification, CompanyProfile + 5 profile sub-entities, InvitationToken, BeneficialOwner
  - Correct patterns applied: @map for snake_case DB columns, Decimal for all financial fields, cpfEncrypted/cpfBlindIndex, Shareholding (not CapTableEntry), 1:many BlockchainTransaction→Transaction, PARTIALLY_SIGNED in DocumentStatus, channel on Notification
  - **MISSING ENTITIES**: DataroomFolder, DataroomDocument (company-dataroom.md), ExitScenario, WaterfallResult (exit-waterfall.md), ExportJob (reports-analytics.md — async export tracking), LitigationVerification (inlined into CompanyProfile — may need separate entity for multiple checks over time)
  - All relations complete (BUG-7 fixed in v0.0.4): UserNotificationPreferences→User, FundingRound→ShareClass, OptionGrant→Shareholder, OptionPlan→ShareClass, ConvertibleInstrument.targetShareClassId→ShareClass
  - Unique constraints added: RoundCommitment `@@unique([roundId, shareholderId])`, DocumentSigner `@@unique([documentId, email])`
  - All indexes added: ProfileMetric/ProfileTeamMember/ProfileDocument (profileId), BeneficialOwner (shareholderId), RoundClose (roundId), DocumentSigner ([userId, status]), Shareholding (shareClassId), plus CompanyProfile (companyId)
  - AuditLog entity defined (immutability trigger to be added in migration)
  - ConsentRecord entity (LGPD compliance)
  - Migration pending (needs running database)

- [ ] Configure infrastructure services
  - Redis connection + Bull queues (audit-log queue)
  - AWS SDK configuration (S3, SES, KMS)
  - Health check module (**DONE** - GET /api/v1/health with DB check)

- [x] Set up API infrastructure (per api-standards.md) (**DONE with gaps** - v0.0.1)
  - Global exception filter with i18n (PT-BR/EN) — 5 tests passing
    - **GAP** (BUG-4): ValidationPipe 400 errors emitted as `SYS_HTTP_ERROR`, not structured `VAL_INVALID_INPUT` with `validationErrors` array
    - **GAP**: Only 14 of ~50+ error codes have translations in backend `MESSAGES` map
    - **GAP** (BUG-5): `Accept-Language: en-US` not normalized to `en` (falls back to `pt-BR`)
    - **GAP**: `NotFoundException` resource name is case-sensitive with no guard (`shareClass` → wrong key lookup)
  - Response interceptor (standard envelope) — 3 tests passing
  - Request ID middleware (X-Request-Id) — working but instantiated outside DI container
  - Rate limiting via @nestjs/throttler (5 tiers configured)
    - **GAP** (BUG-3): `ThrottlerGuard` NOT registered as `APP_GUARD` — only works on endpoints with explicit `@Throttle()` decorator
    - No `X-RateLimit-*` response headers on unthrottled endpoints
  - Swagger/OpenAPI documentation (non-production only) — working at `/api/docs`
  - CORS configuration (per security.md) — correct, missing `X-CSRF-Token` in `allowedHeaders`

- [x] Set up security infrastructure (**PARTIAL** - v0.0.1)
  - Helmet integration (security headers) — configured in main.ts (missing `permittedCrossDomainPolicies: false`)
  - **MISSING**: Request body size limits (`json({ limit: '1mb' })`) per security.md
  - CSRF double-submit cookie middleware — **NOT IMPLEMENTED** (SameSite=Strict provides partial protection)
  - Encryption service (AWS KMS) — pending (aws-sdk not installed)
  - Blind index service (HMAC-SHA256) — pending
  - PII redaction utility — **NOT IMPLEMENTED** (auth module has private `redactIp`/`redactEmail` but no shared `redactPii()` utility)
  - Sentry integration — **NOT INSTALLED** (`@sentry/nestjs` not in package.json)

- [ ] Set up audit logging infrastructure (per audit-logging.md)
  - AuditInterceptor with @Auditable() decorator
  - AuditService for programmatic logging
  - Bull queue processor for async persistence
  - Dead letter queue monitoring

### 1.4 Authentication (Privy Integration)

- [x] Backend Privy integration (**DONE** - v0.0.2, bugs fixed in v0.0.3)
  - @privy-io/node SDK (v0.9.0) — verifyAccessToken + users()._get()
  - AuthService: verify token, get/create user, login flow, profile retrieval
  - Global AuthGuard (via APP_GUARD) — all routes protected by default
  - Global RolesGuard (via APP_GUARD) — reads `@Roles()` metadata, checks CompanyMember role (**fixed v0.0.3**)
  - Global ThrottlerGuard (via APP_GUARD) — rate limits all routes by default (**fixed v0.0.3**)
  - `@Public()` decorator to opt out of auth
  - `@RequireAuth()` decorator — metadata marker (no-op since AuthGuard is global) (**fixed v0.0.3**)
  - `@CurrentUser()` param decorator (extracts AuthenticatedUser from request)
  - `@Roles()` decorator for role-based access with company-scoped CompanyMember lookup
  - AuthController: POST /api/v1/auth/login, POST /logout (@Public), GET /me
  - HTTP-only cookie sessions (**BUG-1 OPEN**: stores raw Privy token in 7-day cookie; token expires in hours)
  - Failed login attempt tracking (5 failures -> 15min lock per IP, in-memory Map with 10K cap — not shared across instances)
  - Atomic user find-or-create via `$transaction` (**fixed v0.0.3**)
  - Apple OAuth + Google OAuth + email account support (**fixed v0.0.3**)
  - ValidationPipe errors translated to structured VAL_INVALID_INPUT (**fixed v0.0.3**)
  - Accept-Language normalization (en-US → en, pt → pt-BR) (**fixed v0.0.3**)
  - cookie-parser middleware added to main.ts
  - 67 tests total (auth.service: 16, auth.guard: 10, auth.controller: 6, roles.guard: 13, + common module tests)
  - **MISSING**: `/api/v1/auth/refresh` endpoint (spec FR-3)
  - **MISSING**: 2-hour inactivity timeout (spec FR-5, BR-3)
  - **MISSING**: Audit logging events (AUTH_LOGIN_SUCCESS, AUTH_LOGOUT, AUTH_ACCOUNT_LOCKED)
  - **MISSING**: `profile_picture_url` sync from Privy (spec FR-4)
  - **MISSING**: Privy API retry/exponential backoff (single try/catch, no retry on transient failures)
  - **MISSING**: Email notification on lockout (spec BR-4)

- [x] Fix critical auth bugs (**DONE v0.0.3** — 13 of 15 bugs fixed, BUG-1 remains open. BUG-7 fixed separately in v0.0.4.)
  - ~~BUG-1: Implement server-side session management~~ — **DEFERRED** (requires Redis infrastructure)
  - BUG-2: ✅ Implemented `RolesGuard` (reads ROLES_KEY, looks up CompanyMember, returns 404 for non-members)
  - BUG-3: ✅ Registered ThrottlerGuard as APP_GUARD in app.module.ts
  - BUG-4: ✅ GlobalExceptionFilter detects BadRequestException → structured VAL_INVALID_INPUT
  - BUG-5: ✅ normalizeLanguage() handles en-US → en, pt → pt-BR
  - BUG-6: ✅ Added apple_oauth to extractEmail() and extractName()
  - BUG-7: ✅ Fixed all 5 broken Prisma relations + 2 unique constraints + 8 indexes (v0.0.4)
  - BUG-8: ✅ Wrapped user find-or-create in `$transaction`
  - BUG-9: ✅ Changed @RequireAuth() to SetMetadata (no-op marker)
  - BUG-10: ✅ Email conflict check before updating existing user's email
  - BUG-11: ✅ Email local part fallback + Apple OAuth name extraction
  - BUG-12: ✅ Guard against missing `@` in redactEmail()
  - BUG-13: ✅ MAX_TRACKED_IPS = 10000 cap with eviction
  - BUG-14: ✅ Logout endpoint changed to @Public()
  - BUG-15: ✅ Returns messageKey instead of hardcoded English string

- [ ] Frontend Privy integration
  - Install `@privy-io/react-auth` package (NOT currently installed)
  - Add `PrivyProvider` to providers.tsx
  - Create `AuthContext` provider with `useAuth()` hook
  - Create protected route wrapper component
  - Wire login page to Privy modal (replace static HTML stub)
  - Wire sidebar/topbar user data from auth context (replace hardcoded "Nelson Pereira")
  - Add user menu with logout
  - Add CSRF token handling in API client (`X-CSRF-Token` header from `navia-csrf` cookie)

### 1.5 Company Management

- [x] Backend Company module (**DONE** - v0.0.5)
  - CompanyController: 6 endpoints (POST, GET list, GET :companyId, PUT, PATCH status, DELETE)
  - CompanyService: full business logic
    - CNPJ Módulo 11 checksum validation (format + mathematical verification)
    - Atomic company + ADMIN member creation via `$transaction` (BR-4)
    - Membership limit check (max 20 companies per user, BR-6)
    - Duplicate CNPJ detection (P2002 → 409 Conflict)
    - Company status state machine: DRAFT → ACTIVE ↔ INACTIVE → DISSOLVED
    - Dissolve prerequisites: no active shareholders, no active funding rounds
    - Immutable fields: entityType and CNPJ not updateable (BR-5)
    - DISSOLVED companies fully read-only (BR-2)
  - CreateCompanyDto: name, entityType (LTDA/SA_CAPITAL_FECHADO/SA_CAPITAL_ABERTO), cnpj, optional description/foundedDate/defaultCurrency/fiscalYearEnd/timezone/locale
  - UpdateCompanyDto: partial update of mutable fields only
  - Pagination, sorting, status filtering for company list
  - 10 new error message translations (PT-BR + EN) in GlobalExceptionFilter
  - 42 tests (24 service + 18 controller) — all passing
  - Routes: `POST /api/v1/companies`, `GET /api/v1/companies`, `GET /api/v1/companies/:companyId`, `PUT /api/v1/companies/:companyId`, `PATCH /api/v1/companies/:companyId/status`, `DELETE /api/v1/companies/:companyId`
  - **NOT YET**: Company CNPJ async validation via Verifik (DRAFT → ACTIVE transition)

### 1.5b Company Membership Management

- [x] Backend Member module (**DONE** - v0.0.6)
  - MemberController: 5 endpoints
    - `POST /api/v1/companies/:companyId/members` — invite member (email + role + optional message)
    - `GET /api/v1/companies/:companyId/members` — list members (pagination, status/role/search filtering, sorting)
    - `PUT /api/v1/companies/:companyId/members/:memberId` — update role and/or permission overrides
    - `DELETE /api/v1/companies/:companyId/members/:memberId` — remove member
    - `POST /api/v1/companies/:companyId/members/:memberId/resend-invitation` — resend invitation email
  - InvitationController: 2 endpoints (public)
    - `GET /api/v1/invitations/:token` — get invitation details (public, no auth required)
    - `POST /api/v1/invitations/:token/accept` — accept invitation (requires auth)
  - MemberService: full business logic
    - Invite flow: creates CompanyMember with PENDING status + InvitationToken (7-day expiry)
    - Accept flow: validates token, checks expiry, transitions PENDING → ACTIVE
    - Re-invite REMOVED members (updates existing record due to @@unique constraint)
    - Last-admin protection: cannot remove or demote the only ADMIN
    - Protected permissions: `usersManage` only allowed for ADMIN role
    - 20-company limit per user (MAX_COMPANIES_PER_USER)
    - 50 invitation limit per day per company (MAX_INVITATIONS_PER_DAY)
    - Permission overrides: 10 boolean flags (viewCapTable, manageCapTable, viewTransactions, manageTransactions, viewDocuments, manageDocuments, viewReports, manageReports, viewAuditLogs, usersManage)
    - Token upsert on resend (1:1 schema constraint)
  - DTOs: InviteMemberDto (MemberRoleDto enum + email/role/message), UpdateMemberDto (PermissionOverridesDto with 10 boolean flags), ListMembersQueryDto (extends PaginationQueryDto)
  - GoneException class added to AppException hierarchy (HTTP 410 for expired invitations)
  - 13 new i18n error messages (PT-BR + EN) for membership operations
  - 52 tests (30 service + 11 controller) — all passing
  - **NOT YET**: Email sending on invite/accept (requires SES integration), frontend member management page

### 1.6 KYC Verification (Verifik Integration)

- [ ] Backend Verifik integration

  - Verifik service (API client with circuit breaker)
  - CPF validation endpoint
  - CNPJ validation endpoint
  - Document upload service (S3 with SSE-KMS encryption)
  - Facial recognition service
  - AML screening service
  - KYC webhook handler
  - Retry strategy: 3 attempts, exponential backoff 30s/60s/120s

- [ ] Frontend KYC flow
  - KYC status dashboard
  - Document upload UI with drag-drop (EXIF stripping, magic bytes validation)
  - Camera capture for selfie
  - Progress stepper component

---

## Phase 2: Core Cap Table

**Timeline**: Weeks 4-6
**Dependencies**: Phase 1 complete

### 2.1 Company Management

- [x] Company backend (per company-management.md + company-membership.md) — **DONE v0.0.5 + v0.0.6**
  - ~~Company entity + Prisma model~~ (done in schema)
  - ~~CompanyMember entity + Prisma model~~ (done in schema)
  - ~~Company CRUD API endpoints~~ (done v0.0.5)
  - ~~Company membership system (invitation flow, 7-day token expiry)~~ (done v0.0.6)
  - ~~Role management (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE)~~ (done v0.0.6)
  - [ ] Company settings API (not yet implemented)
  - [ ] Permission guards per user-permissions.md matrix (RolesGuard exists, fine-grained permission checks pending)
  - [ ] Company row-level security via Prisma middleware (using `:companyId` path param, NOT `X-Company-Id` header)

- [ ] Company CNPJ validation (per company-cnpj-validation.md)
  - Async CNPJ validation via Verifik (Bull job)
  - Company status: DRAFT -> ACTIVE on validation success
  - Retry on Verifik failure, admin notification
  - CNPJ retry endpoint for users

- [ ] Company blockchain admin setup (per company-blockchain-admin.md)
  - Creator's embedded wallet as smart contract admin
  - Wallet address storage on Company entity (no AdminWallet entity)
  - Async contract deployment trigger

- [ ] Company frontend
  - Company creation wizard (CNPJ -> verify -> create)
  - Company settings page
  - Company switcher in navbar
  - Member management page (invite, role change, remove)
  - Member invitation acceptance flow

### 2.2 Share Classes

- [x] Share class backend (per share-classes.md) — **v0.0.7**
  - ShareClass entity (Prisma model already existed)
  - Share class CRUD API endpoints (5 endpoints: create, list, get, update, delete)
  - Ltda quota logic (type compatibility: Ltda → QUOTA only)
  - S.A. ON/PN logic (type compatibility: S.A. → COMMON_SHARES/PREFERRED_SHARES only)
  - Share class validation rules (preferred 2/3 limit per Art. 15 §2, totalAuthorized can only increase, delete only if totalIssued=0, unique className per company)
  - 34 unit tests (21 service + 13 controller)

- [ ] Share class frontend
  - Share class creation form
  - Share class list with summary cards
  - Share class edit modal

### 2.3 Shareholder Registry

- [ ] Shareholder backend (per shareholder-registry.md)
  - Shareholder entity + Prisma model
  - BeneficialOwner entity (UBO tracking)
  - Shareholder CRUD API endpoints
  - CPF/CNPJ validation on creation (encrypted storage, blind index)
  - Foreign shareholder support (RDE-IED fields)
  - Shareholder invite service
  - KYC status integration

- [ ] Shareholder frontend
  - Shareholder list with filters and search
  - Add shareholder wizard
  - Shareholder detail view

### 2.4 Cap Table Management

- [ ] Cap table backend (per cap-table-management.md)
  - Shareholding entity + Prisma model (canonical name `Shareholding`, NOT `CapTableEntry`)
  - CapTableSnapshot entity + Prisma model
  - Cap table calculation service
  - Fully-diluted calculation
  - Cap table API endpoints
  - Snapshot service
  - OCT format export service

- [ ] Cap table frontend
  - Cap table visualization (table view per design-system.md)
  - Ownership pie chart (donut, Recharts, per design-system.md chart spec)
  - Snapshot history with comparison

### 2.5 Company Profile

- [ ] Company profile backend (per company-profile.md)
  - CompanyProfile entity + Prisma model
  - Profile metrics calculation (team size, funding totals)
  - Shareable public profile API endpoints
  - Profile customization (logo, description, social links)
  - Privacy controls (what's visible on public profile)

- [ ] Company profile frontend
  - Profile editor page
  - Public profile view (shareable URL)
  - Profile preview

### 2.6 Company Dataroom

- [ ] Dataroom backend (per company-dataroom.md)
  - DataroomFolder / DataroomDocument entities + Prisma models
  - Document upload API (S3, pre-signed URLs)
  - Folder management (create, rename, delete)
  - Storage limit enforcement
  - Access control per role

- [ ] Dataroom frontend
  - File browser UI (folder tree, file list)
  - Document upload with drag-drop
  - File preview / download
  - Storage usage indicator

---

## Phase 3: Blockchain Integration

**Timeline**: Weeks 7-8
**Dependencies**: Phase 2 complete

### 3.1 Smart Contracts

- [ ] Set up Foundry project in `/contracts`
- [ ] Implement OCPCapTable base contract
- [ ] Implement BrazilianCapTable extension
- [ ] Implement shareholding record functions
- [ ] Implement transaction recording functions
- [ ] Implement document hash anchoring
- [ ] Write comprehensive tests (100% coverage target)
- [ ] Configure UUPS upgrade pattern
- [ ] Deploy to Base Sepolia testnet
- [ ] Verify contracts on Basescan
- [ ] Document ABIs and addresses

### 3.2 Wallet Infrastructure

- [ ] Creator's embedded wallet as contract admin (via Privy, per company-blockchain-admin.md)
- [ ] Gas sponsorship configuration (Privy)
- [ ] Transaction signing service
- [ ] Transaction queue (Bull) for sequencing
- [ ] Nonce management (sequential queue, re-fetch on conflict)

### 3.3 Blockchain Sync Service

- [ ] Event listener service (viem)
- [ ] Event processors
- [ ] Database reconciliation service
- [ ] Confirmation tracking (12 blocks)
- [ ] Retry logic for failed syncs (5 attempts, exponential backoff)
- [ ] Sync status API endpoint
- [ ] Frontend blockchain status indicator

### 3.4 Cap Table Reconciliation

- [ ] Reconciliation service (per cap-table-reconciliation.md)
  - Scheduled job comparing on-chain vs off-chain data
  - Discrepancy detection and alerting
  - Reconciliation report generation
  - Admin notification on mismatch

---

## Phase 4: Transactions

**Timeline**: Week 9
**Dependencies**: Phase 3 complete

### 4.1 Transaction Core

- [ ] Transaction entity + Prisma model (per transactions.md)
- [ ] BlockchainTransaction entity + Prisma model (1:many with Transaction — see H6)
- [ ] Transaction validation service
- [ ] Transaction approval workflow
- [ ] Transaction history API (including DRAFT creation flow — see H8)

### 4.2 Share Issuance

- [ ] Share issuance service
- [ ] Dilution calculation + warning (configurable threshold)
- [ ] Cap table update (off-chain)
- [ ] Blockchain recording
- [ ] Snapshot creation
- [ ] Frontend: New issuance form

### 4.3 Share Transfer

- [ ] Share transfer service
- [ ] ROFR validation
- [ ] Lock-up period check
- [ ] Transfer approval workflow
- [ ] Frontend: Transfer form

### 4.4 Other Transaction Types

- [ ] Conversion service (preferred -> common, with conversion-specific fields per H8.5)
- [ ] Cancellation service (repurchase, forfeiture, toShareholderId optional per H8.4)
- [ ] Split service

### 4.5 Transaction UI

- [ ] Transaction history ledger API
- [ ] Frontend: Transaction history list
- [ ] Frontend: Transaction detail view
- [ ] Frontend: Step indicator for multi-step transactions (per design-system.md)

---

## Phase 5: Investment Features

**Timeline**: Weeks 10-11
**Dependencies**: Phase 4 complete

### 5.1 Funding Rounds

- [ ] FundingRound entity + Prisma model (per funding-rounds.md)
- [ ] RoundCommitment entity + Prisma model
- [ ] RoundClose entity + Prisma model (fully defined per M4.1)
- [ ] Round CRUD API endpoints (including cancellation endpoint per H2.2)
- [ ] Commitment CRUD API endpoints (including payment status update per H2.3)
- [ ] Pro-forma cap table calculation
- [ ] Multi-close mechanics
- [ ] Payment confirmation workflow
- [ ] Frontend: Round creation wizard
- [ ] Frontend: Commitment tracking
- [ ] Frontend: Pro-forma preview
- [ ] Frontend: Round closing flow

### 5.2 Convertible Instruments

- [ ] ConvertibleInstrument entity (per convertible-instruments.md, with UPPER_SNAKE_CASE enums)
- [ ] Daily interest calculation job
- [ ] Conversion calculation engine (per convertible-conversion.md)
- [ ] Conversion scenario modeling API
- [ ] Conversion trigger detection
- [ ] Automatic conversion execution
- [ ] Frontend: Instrument creation wizard
- [ ] Frontend: Scenario modeling UI
- [ ] Frontend: Instrument portfolio view

### 5.3 Exit Waterfall

- [ ] Exit waterfall calculation engine (per exit-waterfall.md, with real implementation not stub)
  - Liquidation preference calculations
  - Participation rights modeling
  - Multiple exit scenario comparisons
- [ ] ExitScenario / WaterfallResult entities + Prisma models
- [ ] Waterfall API endpoints
- [ ] Frontend: Exit scenario builder UI
- [ ] Frontend: Waterfall visualization (stacked bar chart per design-system.md)

---

## Phase 6: Employee Equity

**Timeline**: Week 12
**Dependencies**: Phase 4 complete

### 6.1 Option Plans

- [ ] OptionPlan entity + Prisma model (per option-plans.md)
- [ ] OptionGrant entity + Prisma model
- [ ] VestingSchedule entity + Prisma model
- [ ] Option plan CRUD API (including plan close endpoint per H2.7)
- [ ] Option grant CRUD API (including termination/forfeiture endpoint per H2.8)
- [ ] Vesting calculation service
- [ ] Frontend: Option plan management
- [ ] Frontend: Grant creation form
- [ ] Frontend: Employee grant dashboard

### 6.2 Option Exercises

- [ ] OptionExerciseRequest entity + Prisma model (per option-exercises.md)
- [ ] Exercise request flow (employee)
- [ ] Payment confirmation flow (admin)
- [ ] Share issuance on confirmation
- [ ] Termination handling service
- [ ] Frontend: Exercise request flow

---

## Phase 7: Documents and Signatures

**Timeline**: Week 13
**Dependencies**: Phase 2 complete

### 7.1 Document Generation

- [ ] DocumentTemplate entity + Prisma model (per document-generation.md)
- [ ] Document entity + Prisma model (with status enum including `PARTIALLY_SIGNED` per C13)
- [ ] Brazilian document templates (5 types)
- [ ] Template storage in database
- [ ] PDF generation service (Puppeteer)
- [ ] Frontend: Document generation trigger
- [ ] Frontend: Document preview

### 7.2 Digital Signatures

- [ ] DocumentSigner entity + Prisma model (per document-signatures.md)
- [ ] EIP-712 signature implementation
- [ ] Signature request service
- [ ] Signature decline endpoint (per H2.4)
- [ ] Signature verification service
- [ ] On-chain hash anchoring (contentHash, NOT document_hash)
- [ ] Frontend: Signature request flow
- [ ] Frontend: Signing UI with Privy
- [ ] Frontend: Decline flow

---

## Phase 8: Notifications, Reports, and Compliance

**Timeline**: Week 14
**Dependencies**: All previous phases

### 8.1 Notifications

- [ ] Notification entity + Prisma model with `channel` enum (`EMAIL` | `IN_APP`) (per notifications.md)
- [ ] UserNotificationPreferences entity
- [ ] AWS SES integration service
- [ ] Email template engine (MJML + Handlebars)
- [ ] 23 email templates (PT-BR and EN)
- [ ] Background job processing (Bull)
- [ ] Notification preferences API
- [ ] Bounce handling webhook (AWS SES)
- [ ] Unread count endpoint (per H2.5)
- [ ] Bulk mark-as-read endpoint (per H2.6)
- [ ] Frontend: Notification preferences page
- [ ] Frontend: In-app notification bell with unread count

### 8.2 Reports

- [ ] Cap table report service (per reports-analytics.md)
- [ ] Dilution analysis report
- [ ] Exit waterfall report (leveraging Phase 5.3 engine)
- [ ] Due diligence package generator (ZIP with cap table, audit trail, documents)
- [ ] Export services (PDF, Excel, CSV, OCT JSON)
- [ ] ExportJob entity for async exports (per M4.2)
- [ ] Report caching (Redis)
- [ ] Frontend: Report dashboard
- [ ] Frontend: Scenario modeling UI
- [ ] Frontend: Export interface

### 8.3 Company Litigation Verification

- [ ] Litigation verification service (per company-litigation-verification.md)
  - BigDataCorp API integration
  - Scheduled litigation checks
  - Litigation status tracking
  - Alert generation on new findings
- [ ] LitigationVerification entity + Prisma model
- [ ] Litigation check API endpoints
- [ ] Frontend: Litigation status dashboard
- [ ] Frontend: Litigation alert notifications

---

## Phase 9: Production Readiness

**Timeline**: Week 15
**Dependencies**: All previous phases

### 9.1 Security and RBAC

- [ ] Full RBAC implementation (per user-permissions.md matrix — single source of truth)
- [ ] Permission guards on all endpoints
- [ ] Row-level security verification
- [ ] Security header audit (target: securityheaders.com A+)
- [ ] CORS final configuration (Vercel frontend URL only)
- [ ] Rate limiting tuning
- [ ] LGPD compliance verification
  - Data subject rights endpoints (access, rectification, deletion, portability)
  - Consent management system
  - Data retention policy enforcement
  - Anonymization after 30-day grace period

### 9.2 Testing

- [ ] Backend unit tests (85%+ coverage, 95%+ for auth/blockchain/financial)
- [ ] Frontend unit tests (80%+ coverage, 100% for auth/KYC/financial)
- [ ] Smart contract tests (100% coverage)
- [ ] Integration tests for critical paths
- [ ] E2E tests (Playwright)

### 9.3 Deployment

- [ ] Frontend deployment (Vercel)
- [ ] Backend deployment (Railway)
- [ ] PostgreSQL provisioning (Railway, private network)
- [ ] Redis provisioning (Railway, private network)
- [ ] Smart contract deployment (Base Mainnet)
- [ ] DNS configuration
- [ ] SSL verification
- [ ] Monitoring setup (Sentry, with PII redaction in beforeSend)
- [ ] Database backup configuration
- [ ] Audit log archival setup (S3, monthly job)
- [ ] Runbook documentation

---

## Dependency Graph

```
PHASE 0: SPECIFICATION COMPLETION (BLOCKING — 57 items remaining)
    |
    |-- P0.CRITICAL: 18 items (naming, envelopes, enums, paths)
    |-- P0.HIGH: 18 items (endpoints, permissions, entities)
    |-- P0.MEDIUM: 13 items (schemas, frontend, expansions)
    |-- P0.LOW: 8 items (cross-refs, docs, rename)
    |
    v
PHASE 1: FOUNDATION & INFRASTRUCTURE
    |
    |-- 1.1: Monorepo setup
    |-- 1.2: Next.js frontend scaffold + design system
    |-- 1.3: NestJS backend scaffold + Prisma + security + audit infra
    |-- 1.4: Privy authentication
    |-- 1.5: Company Management (DONE v0.0.5)
    |-- 1.5b: Company Membership CRUD (DONE v0.0.6)
    |-- 1.6: Verifik KYC
    |
    v
PHASE 2: CORE CAP TABLE
    |
    |-- 2.1: Company CRUD + membership + CNPJ validation + blockchain admin
    |-- 2.2: ShareClass CRUD
    |-- 2.3: Shareholder Registry
    |-- 2.4: Cap Table calculation engine (uses Shareholding entity)
    |-- 2.5: Company Profile (shareable)
    |-- 2.6: Company Dataroom (document storage)
    |
    +------------------------------------------+
    |                                          |
    v                                          v
PHASE 3: BLOCKCHAIN INTEGRATION         PHASE 7: DOCUMENTS
    |                                          |
    |-- 3.1: OCP Smart Contracts              |-- 7.1: Document Generation
    |-- 3.2: Wallet infra (no AdminWallet)    |-- 7.2: Digital Signatures
    |-- 3.3: Blockchain sync                  |
    |-- 3.4: Cap Table Reconciliation         |
    |                                          |
    v                                          |
PHASE 4: TRANSACTIONS                          |
    |                                          |
    |-- 4.1: Transaction core + 1:many BcTx   |
    |-- 4.2: Share Issuance                   |
    |-- 4.3: Share Transfer + ROFR            |
    |-- 4.4: Conversion/Cancellation/Split    |
    |-- 4.5: Transaction UI                   |
    |                                          |
    +------------------+-----------------------+
                       |
    +------------------+------------------+
    |                                     |
    v                                     v
PHASE 5: INVESTMENTS              PHASE 6: EMPLOYEE EQUITY
    |                                     |
    |-- 5.1: Funding Rounds              |-- 6.1: Option Plans + close/terminate
    |-- 5.2: Convertibles (UPPER enums)  |-- 6.2: Option Exercises
    |-- 5.3: Exit Waterfall (real impl)  |
    |                                     |
    +------------------+------------------+
                       |
                       v
         PHASE 8: NOTIFICATIONS, REPORTS & COMPLIANCE
                       |
                       |-- 8.1: Email + in-app notifications (with unread count)
                       |-- 8.2: Reports & exports (with ExportJob entity)
                       |-- 8.3: Litigation verification (BigDataCorp)
                       |
                       v
              PHASE 9: PRODUCTION READINESS
                       |
                       |-- 9.1: Security, RBAC & LGPD (user-permissions.md = single source)
                       |-- 9.2: Testing (85%+ coverage)
                       |-- 9.3: Deployment & monitoring
```

---

## Technology Stack Reference

### Frontend (Vercel)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14+ | App Router framework |
| TypeScript | 5.0+ | Type safety |
| Tailwind CSS | 3.x | Styling (design-system.md tokens) |
| shadcn/ui | Latest | Component library |
| TanStack Query | v5 | Data fetching |
| React Hook Form | 7.x | Form handling |
| Zod | 3.x | Validation |
| Privy React SDK | Latest | Authentication |
| viem | Latest | Blockchain interaction |
| next-intl | Latest | i18n (PT-BR, EN) |
| Recharts | Latest | Charts (design-system.md palette) |
| sonner | Latest | Toast notifications |
| Sentry (Next.js) | Latest | Error monitoring |

### Backend (Railway)

| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 10+ | Framework |
| TypeScript | 5.0+ | Type safety |
| PostgreSQL | 15+ | Database (partitioned audit logs) |
| Prisma | Latest | ORM |
| Redis | Latest | Cache/queues |
| Bull / @nestjs/bull | Latest | Background jobs (audit, email, blockchain) |
| AWS SDK v3 | Latest | S3, SES, KMS |
| viem | Latest | Blockchain |
| decimal.js | Latest | Financial math |
| Puppeteer | Latest | PDF generation |
| helmet | Latest | Security headers |
| class-validator | Latest | Request validation |
| class-transformer | Latest | DTO transformation |
| MJML | Latest | Email templates |
| sharp | Latest | Image metadata stripping |
| Jest | Latest | Testing |
| Sentry (NestJS) | Latest | Error monitoring |

### Blockchain

| Technology | Details |
|------------|---------|
| Network | Base Network (Chain ID: 8453) |
| Testnet | Base Sepolia (Chain ID: 84532) |
| Development | Foundry |
| Contracts | OCP + Brazilian extensions (UUPS upgradeable) |
| Wallets | Privy Embedded Wallets (creator's wallet as admin) |
| Gas | Privy Gas Sponsorship |

### External Services

| Service | Purpose |
|---------|---------|
| Privy | Auth (Email, Google, Apple) + Embedded Wallets + Gas Sponsorship |
| Verifik | KYC (CPF/CNPJ, facial recognition, AML) |
| BigDataCorp | Litigation verification (company lawsuits) |
| AWS S3 | File storage (sa-east-1, SSE-S3 default, SSE-KMS for KYC) |
| AWS SES | Email notifications (sa-east-1) |
| AWS KMS | Application-level encryption (CPF, bank details, KYC URLs) |
| Sentry | Error monitoring + performance tracing |
| Base Network RPC | Blockchain interaction (Alchemy/Infura) |

---

## Quick Reference: Prioritized Work Remaining

### PRIORITY 1: Critical & High Bugs (must fix before any new feature work)

```
CRITICAL:
[ ] BUG-1: Fix Privy token / session management
    - Raw Privy access token (expires in hours) stored in 7-day cookie → all requests fail after expiry
    - Options: (a) Redis-backed server session, (b) implement /auth/refresh endpoint, (c) shorter cookie + silent refresh
    - Files: backend/src/auth/auth.controller.ts (line 50), auth.service.ts

[x] BUG-2: Implement RolesGuard — **FIXED v0.0.3**

HIGH:
[x] BUG-3: Register ThrottlerGuard globally — **FIXED v0.0.3**

[x] BUG-4: Fix ValidationPipe error translation — **FIXED v0.0.3**

MEDIUM:
[x] BUG-7: Fix Prisma broken relations (5 total) — **FIXED v0.0.4**
    - ✅ UserNotificationPreferences: added @relation to User + reverse relation
    - ✅ FundingRound: added @relation to ShareClass
    - ✅ OptionGrant: added nullable @relation to Shareholder
    - ✅ OptionPlan.shareClassId: added @relation to ShareClass
    - ✅ ConvertibleInstrument.targetShareClassId: added @relation to ShareClass
    - Also added 2 unique constraints and 8 missing indexes
    - File: backend/prisma/schema.prisma

[x] BUG-8: Fix race condition in user creation — **FIXED v0.0.3**

[x] BUG-9: Fix @RequireAuth() double guard execution — **FIXED v0.0.3**

[x] BUG-6: Handle Apple OAuth email extraction — **FIXED v0.0.3**
```

### PRIORITY 1b: Non-Critical Bugs (fix during Phase 1, before Phase 2)

```
[x] BUG-5: Normalize Accept-Language header — **FIXED v0.0.3**

[x] BUG-10: Guard against email sync conflict — **FIXED v0.0.3**

[x] BUG-11: Fix extractName() for email-only users — **FIXED v0.0.3**

[x] BUG-12: Fix redactEmail() crash on malformed emails — **FIXED v0.0.3**

[x] BUG-13: Bound the in-memory lockout Map — **FIXED v0.0.3**

[x] BUG-14: Make logout endpoint @Public() — **FIXED v0.0.3**

[x] BUG-15: Remove hardcoded English logout message — **FIXED v0.0.3**
```

### PRIORITY 2: Phase 1 Remaining Implementation (foundation work)

```
BACKEND — Security & Infrastructure:
[ ] Implement CSRF double-submit cookie middleware (security.md)
[ ] Add request body size limits (json({ limit: '1mb' })) to main.ts
[ ] Add X-CSRF-Token to CORS allowedHeaders
[ ] Implement shared redactPii() utility (common/utils/redact-pii.ts)
    - CPF: ***.***.***-XX, Email: m***@domain.com, Wallet: 0x1234...abcd, IP: /24, tokens: [REDACTED]
[ ] Install and configure Redis + Bull (@nestjs/bull, ioredis)
[ ] Install AWS SDK v3 (@aws-sdk/client-s3, client-ses, client-kms)
[ ] Implement EncryptionService (AWS KMS)
[ ] Implement BlindIndexService (HMAC-SHA256)
[ ] Install and configure Sentry (@sentry/nestjs)
[ ] Set up audit logging infrastructure (@Auditable decorator, AuditService, Bull processor)
[ ] Create .env.example files for backend and frontend
[ ] Set up CI/CD pipeline (GitHub Actions: lint, test, build, secret scan)
[ ] Add jest.config.ts coverage thresholds (85% general, 95% critical)

BACKEND — Auth Fixes:
[x] Handle Apple OAuth email extraction — **FIXED v0.0.3**
[ ] Implement /api/v1/auth/refresh endpoint (spec FR-3)
[ ] Add 2-hour inactivity timeout tracking
[ ] Move failed attempt lockout from in-memory Map to Redis
[ ] Add Privy API retry with exponential backoff (3 attempts)
[ ] Add audit logging events to auth flows (AUTH_LOGIN_SUCCESS, etc.)
[ ] Write tests for untested paths: @CurrentUser, @Roles, lockout expiry, Apple OAuth

BACKEND — Company Management (next steps):
[x] Company membership CRUD module (invite, accept, remove, role change) — **DONE v0.0.6**
    - MemberController (5 endpoints) + InvitationController (2 endpoints)
    - MemberService: invite, accept, update role/perms, remove, resend invitation
    - 52 tests (30 service + 11 controller), 161 total tests passing
[ ] Async CNPJ validation via Verifik (triggers DRAFT → ACTIVE transition)

FRONTEND — Security (v11.0 findings):
[ ] Add route protection via middleware.ts — currently any unauthenticated user can visit /dashboard
[ ] Add Content-Security-Policy header in next.config.js (allow Privy iframe, S3 images, Base RPC)
[ ] Add Strict-Transport-Security header in next.config.js

FRONTEND — Core Integration:
[ ] Install @privy-io/react-auth and add PrivyProvider
[ ] Create AuthContext / useAuth hook
[ ] Wire login page to Privy modal (replace static HTML stub)
[ ] Create protected route wrapper
[ ] Wire sidebar/topbar user data from auth context
[ ] Install next-intl and set up locale routing middleware
[ ] Replace all hardcoded English strings with useTranslations()
[ ] Run npx shadcn-ui@latest init and generate core components (Button, Input, Card, Table, Dialog, etc.)
[ ] Add CSRF token injection to API client
[ ] Add 401 auto-redirect to /login?expired=true in API client
[ ] Dynamic Accept-Language from user locale in API client
[ ] Create useErrorToast() hook for consuming ApiError objects
[ ] Fix border radius systematic error in globals.css + tailwind.config.ts
    - Set --radius: 0.75rem (12px), add xl=16px, fix entire scale (lg=12px, md=8px, sm=6px)
[ ] Create Brazilian formatting helpers (lib/format.ts)
    - formatNumber(), formatCurrency(), formatDate(), formatPercentage()
    - Always use pt-BR Intl formatters regardless of locale (per i18n.md)
[ ] Extract shared nav items constant (currently duplicated in sidebar.tsx and mobile-sidebar.tsx)
[ ] Add aria-current="page" to active nav links (accessibility)
[ ] Wire dashboard ownership chart with Recharts (replace placeholder)
[ ] Write component tests (0 frontend tests currently exist)
[ ] Add company switcher to topbar
```

### PRIORITY 3: Phase 0 Spec Fixes (69 items — specs are stale, code has correct patterns)

**NOTE**: The implementation code (Prisma schema, backend modules) already uses the correct patterns. These 69 items are **spec file documentation updates** to align the spec text with what was actually built. They should be done to prevent confusion but are not blocking implementation.

```
P0.CRITICAL — Spec file updates (18 items, ~8 hours):

  Systemic fixes (2 items, ~4 hours):
  [ ] C1: snake_case → camelCase in TypeScript interfaces (13 spec files)
  [ ] C2: Response envelope compliance (6+ spec files)

  Scoping/behavior (3 items, ~1.5 hours):
  [ ] C3: X-Company-Id → :companyId path parameter (2 files)
  [ ] C10: 403 → 404 for non-members (1 file)
  [ ] C11: DELETE responses to 204 (2 files)

  Entity/field renames (3 items, ~30 min):
  [ ] C4: CapTableEntry → Shareholding (1 file)
  [ ] C5.1: document_hash → contentHash in document-generation.md
  [ ] C5.2: document_hash → contentHash in document-signatures.md

  Enum standardization (4 items, ~1.5 hours):
  [ ] C6: KYCStatus → 6 values, UPPER_SNAKE_CASE (2 files)
  [ ] C7: FundingRound status enum DRAFT|OPEN|CLOSING|CLOSED|CANCELLED (1 file)
  [ ] C8: ConvertibleInstrument enum casing (1 file)
  [ ] C12: Add channel enum to Notification entity (1 file)

  API paths (2 items, ~15 min):
  [ ] C9.1: blockchain admin-wallet → company-scoped
  [ ] C9.2: blockchain transaction → company-scoped

  Status enum + security (3 items):
  [ ] C13: Add PARTIALLY_SIGNED to Document status
  [ ] C14: Remove accessPassword from company-profile.md API responses
  [ ] C15: Change financial `number` types to `string` (Decimal) in 16 files

P0.HIGH — Spec file updates (18 items, ~8 hours):
  [ ] H1.1: Resolve LEGAL export access (reports-analytics.md vs user-permissions.md)
  [ ] H1.2: Resolve FINANCE audit access (audit-logging.md vs user-permissions.md)
  [ ] H2.1-H2.10: Define 10 missing API endpoints in respective spec files
  [ ] H3: Add AUTH_FORBIDDEN, NOTIFICATION_NOT_FOUND, NOTIFICATION_PREFERENCES_INVALID to error-handling.md
  [ ] H4: Add SHARE_CLASS_CREATED/UPDATED/DELETED audit events
  [ ] H5: Remove AdminWallet entity from blockchain-integration.md
  [ ] H6: Change BlockchainTransaction to 1:many in blockchain-integration.md
  [ ] H7: Clarify pre-signed URL expiry policy in security.md
  [ ] H8+H9: Fill transaction spec gaps + fix stale cross-references

P0.MEDIUM — Spec file updates (13 items, ~12 hours):
  [ ] M1: Prisma schema approach (decision — already have schema, need docs)
  [ ] M2: Frontend code fixes in 3 spec files (alert→toast, fetch→API client)
  [ ] M3: Resolve 14 open questions across 3 spec files
  [ ] M4: Define missing entities (RoundClose, ExportJob, CompanyScopeGuard, bank account)
  [ ] M5.1-M5.3: Spec expansions (share-classes, funding-rounds, notifications)
  [ ] M6: exit-waterfall.md stub resolution

P0.LOW — Documentation updates (8 items, ~2 hours):
  [ ] L1: Complete cross-references (4 company specs)
  [ ] L2: company-profile.md numbering gaps
  [ ] L3: VelaFund → Navia rename (README.md, ARCHITECTURE.md)
  [ ] L4: ARCHITECTURE.md ERD update (8+ missing entities)

Spec Compliance Gaps (v11.0 findings — address during spec updates):
  [ ] user-permissions.md: CompanyScopeGuard referenced but has no implementation spec and no code
  [ ] user-permissions.md: ROLE_DEFAULTS map is incomplete (uses /* ... */ comments)
  [ ] user-permissions.md: Investor conditional access footnotes (*, **, ****) have no enforcement mechanism
  [ ] notifications.md: Missing WebSocket/SSE for real-time in-app notifications
  [ ] notifications.md: Notification type enum not formally defined as a catalog
  [ ] reports-analytics.md: Missing ExportJob Prisma model, no formal error code catalog for reports
  [ ] kyc-verification.md: CAPTCHA requirement after 2 failed attempts mentioned but not in any endpoint
  [ ] company-litigation-verification.md: Risk level computation has overlapping rules (ambiguous for 2 active lawsuits, R$80k)
  [ ] company-litigation-verification.md: PROFILE_LITIGATION_CNPJ_NOT_FOUND error code contradicts EC-9 (treats not-found as COMPLETED)
```

### PRIORITY 4: Prisma Schema Gaps

```
Missing Models:
[ ] Add DataroomFolder model (company-dataroom.md)
[ ] Add DataroomDocument model (company-dataroom.md)
[ ] Add ExitScenario model (exit-waterfall.md)
[ ] Add WaterfallResult model (exit-waterfall.md)
[ ] Add ExportJob model (reports-analytics.md) — fields: id, companyId, format, status (QUEUED|PROCESSING|COMPLETED|FAILED), s3Key, downloadUrl, expiresAt, errorCode
[ ] Consider extracting LitigationVerification from CompanyProfile to separate model

Broken Relations (BUG-7, 5 total) — **ALL FIXED v0.0.4**:
[x] Add @relation to UserNotificationPreferences.userId → User
[x] Add @relation to FundingRound.shareClassId → ShareClass
[x] Add nullable @relation to OptionGrant.shareholderId → Shareholder
[x] Add @relation to OptionPlan.shareClassId → ShareClass (v11.0)
[x] Add @relation to ConvertibleInstrument.targetShareClassId → ShareClass (v11.0)

Missing Constraints — **ALL FIXED v0.0.4**:
[x] Add @@unique([roundId, shareholderId]) to RoundCommitment
[x] Add @@unique([documentId, email]) to DocumentSigner

Missing Indexes (v11.0) — **ALL FIXED v0.0.4**:
[x] ProfileMetric, ProfileTeamMember, ProfileDocument — added @@index([profileId])
[x] BeneficialOwner — added @@index([shareholderId])
[x] RoundClose — added @@index([roundId])
[x] DocumentSigner — added @@index([userId, status])
[x] Shareholding — added @@index([shareClassId])
[x] CompanyProfile — added @@index([companyId])
```

### PREVIOUSLY COMPLETED (no action needed)

```
[x] Monorepo: pnpm workspaces + Turborepo configured
[x] Backend NestJS scaffold: AppModule, ConfigModule, PrismaModule, HealthModule
[x] Backend auth module: AuthService, AuthController, AuthGuard, 4 decorators
[x] Backend common: GlobalExceptionFilter, ResponseInterceptor, RequestIdMiddleware, PaginationQueryDto, paginate, sort-parser, AppException hierarchy
[x] Backend health: HealthController with DB check
[x] Backend Prisma schema: 32 models, 35 enums, 1183 lines
[x] Backend Company module: CompanyController (6 endpoints), CompanyService (CNPJ Módulo 11, $transaction, status state machine), DTOs, 42 tests
[x] Frontend Next.js scaffold: App Router, TypeScript strict
[x] Frontend layouts: sidebar (high-fidelity), topbar, auth layout, dashboard layout, mobile sidebar
[x] Frontend providers: QueryClientProvider (TanStack Query), Toaster (sonner)
[x] Frontend API client: typed with error parsing, credentials: include
[x] Frontend tailwind.config.ts: design system color tokens, fonts, spacing
[x] Frontend globals.css: shadcn/ui CSS variables
[x] Frontend dashboard: visual prototype with stat cards (hardcoded data)
[x] User flow docs: authentication.md
[x] Helmet, CORS, cookie-parser in main.ts
[x] ThrottlerModule configured (5 tiers)
[x] Swagger/OpenAPI at /api/docs
[x] 54 backend tests passing
[x] ESLint + Prettier configured
[x] Husky installed
[x] Django → NestJS references updated in specs
[x] API paths have /api/v1/ prefix in specs
[x] Transaction vs ShareTransaction resolved
[x] Signature → DocumentSigner renamed
[x] OptionGrant vs Option resolved
[x] specs/README.md entity glossary added
[x] 5 API path scoping issues fixed
[x] Blockchain /status endpoint scoped
[x] reports-analytics.md expanded (602 lines)
[x] user-permissions.md expanded (739 lines)
[x] option-plans.md expanded (552 lines)
[x] 9 new specs authored
```

### Phase Gate Checklist

Before moving to next phase:

```
[ ] All tasks in current phase completed
[ ] Unit tests written and passing
[ ] Code review completed
[ ] User flow documentation updated (docs/user-flows/)
[ ] No critical bugs outstanding
[ ] Specification compliance verified
```

### Production Deployment Checklist

```
[ ] All E2E tests passing
[ ] Security audit completed (security headers A+)
[ ] LGPD compliance verified (data subject rights, consent, retention)
[ ] Performance benchmarks met (p95 < 500ms)
[ ] Monitoring configured and alerting (Sentry, Slack, PagerDuty)
[ ] Backup strategy tested
[ ] Audit log archival configured (S3 monthly)
[ ] Runbook documented
[ ] Smart contracts verified on Basescan
```

### Success Metrics

| Metric | Target |
|--------|--------|
| Cap table calculation accuracy | 100% |
| On-chain/off-chain data consistency | Zero discrepancies |
| Uptime | 99.9% |
| API response time (p95) | < 500ms |
| Financial calculation errors | Zero |
| Smart contract test coverage | 100% |
| Backend test coverage | 85%+ |
| Frontend test coverage | 80%+ |

---

## Document Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-02-23 | 11.0 | Claude | **Deep audit with 12 parallel subagents**. Found 8 new auth bugs: BUG-8 (race condition in user creation), BUG-9 (@RequireAuth double guard), BUG-10 (email sync conflict), BUG-11 (extractName null for email users), BUG-12 (redactEmail crash), BUG-13 (unbounded lockout Map), BUG-14 (logout unreachable when expired), BUG-15 (hardcoded English logout). Expanded BUG-7 from 3 to 5 broken Prisma relations (+OptionPlan.shareClassId, +ConvertibleInstrument.targetShareClassId). Found missing ExportJob model, missing indexes on 5+ models, missing DocumentSigner unique constraint. Frontend: no auth protection on any route (no middleware.ts), border radius scale systematically wrong, missing CSP/HSTS headers, missing Brazilian formatting helpers, shadcn/ui CLI never run, nav items duplicated, missing aria-current on active links. Added 9 spec compliance gaps (user-permissions CompanyScopeGuard undefined, notifications missing real-time mechanism, reports missing ExportJob/error codes, kyc CAPTCHA not in endpoints, litigation risk rules ambiguous). Added Priority 1b section for non-critical bugs. |
| 2026-02-23 | 10.0 | Claude | **Comprehensive code-vs-spec audit** with 8 parallel subagents. Audited all 34 backend source files, 14 frontend source files, 1183-line Prisma schema, and all 26 spec files. Key findings: 7 critical/high bugs in existing code (BUG-1: Privy token in 7-day cookie, BUG-2: no RolesGuard, BUG-3: ThrottlerGuard not global, BUG-4: ValidationPipe errors unstructured, BUG-5: Accept-Language not normalized, BUG-6: Apple OAuth not handled, BUG-7: Prisma broken relations). All 69 P0 spec issues confirmed still pending in spec files but code has correct patterns. Frontend: Privy SDK not installed, next-intl not installed, shadcn/ui not initialized, 0 tests, login is static stub. Restructured Quick Reference into 4 priority tiers. Updated all phase sections with accurate status annotations. |
| 2026-02-23 | 8.0 | Claude | **Comprehensive spec audit**. Found 55+ new issues beyond the original 8. Restructured Phase 0 into priority tiers (CRITICAL/HIGH/MEDIUM/LOW). Key systemic findings: snake_case in 13 TypeScript interfaces, response envelope non-compliance in 6+ files, X-Company-Id vs :companyId conflict, KYCStatus 4-vs-6-value mismatch, convertible-instruments lowercase enums, 10 missing API endpoints, 3 permission matrix conflicts, AdminWallet entity contradiction, BlockchainTransaction 1:1 constraint, PARTIALLY_SIGNED missing from Document enum, 3 missing error codes, 3 missing audit events, 14 unresolved open questions. Total P0 remaining: 57 items (was 14). Updated all phase descriptions to reference spec fixes. |
| 2026-02-23 | 7.1 | Claude | Integrated 9 new specs into implementation phases (2.5 Company Profile, 2.6 Dataroom, 3.4 Reconciliation, 5.3 Exit Waterfall, 8.3 Litigation). Found 2 blockchain API paths still unscoped (lines 150, 190). Added P0.5 Documentation Fixes (VelaFund to Navia rename in 3 files, ARCHITECTURE.md ERD missing 8+ entities). Added security/audit infrastructure to Phase 1.3. Updated technology stack with 8 missing tools. Updated dependency graph. Total P0 remaining: 14 items. |
| 2026-02-23 | 7.0 | Claude | Full re-audit: verified all 26 specs against actual files. Found API paths ALL fixed (6/6), DocumentSigner rename done, 3 of 6 expansions met targets. Updated spec count from 18 to 26. Updated line counts. Reduced remaining P0 work from 12 to 8 items. |
| 2026-02-23 | 6.0 | Claude | Consistency audit: marked completed P0 items, identified API path scoping issues, updated line counts, reconciled with actual file state |
| 2026-01-27 | 5.0 | Claude | Final comprehensive analysis with validated gaps, prioritized inconsistencies, detailed checklists |
| 2026-01-27 | 4.0 | Claude | Complete restructure with bullet-point format |
| 2026-01-27 | 3.0 | Claude | Comprehensive rewrite with P0/P1/P2 specifications |
| 2026-01-27 | 2.3 | Claude | Validated specifications, confirmed gaps |
| 2026-01-27 | 2.0 | Claude | Initial structured plan after spec review |
