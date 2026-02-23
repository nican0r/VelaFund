# Navia MVP - Implementation Plan

**Job to be Done**: Help Brazilian companies manage their cap table with on-chain record-keeping and regulatory compliance.

**Status**: Phase 0 in progress - Most critical specs complete, remaining consistency fixes and spec expansions needed before implementation.

**Last Updated**: 2026-02-23 (v6.0 - Consistency audit and status reconciliation)

---

## Executive Summary

This implementation plan provides the validated roadmap for the Navia MVP. The project is **100% greenfield** - no source code exists. Phase 0 (Specification Completion) must be fully completed before implementation begins.

### Current Project State

| Aspect | Status | Notes |
|--------|--------|-------|
| `/frontend` directory | DOES NOT EXIST | Greenfield |
| `/backend` directory | DOES NOT EXIST | Greenfield |
| `/contracts` directory | DOES NOT EXIST | Greenfield |
| `package.json` | DOES NOT EXIST | No code scaffolding |
| Prisma schema | DOES NOT EXIST | No database schema |
| Specification files | 18 files in `/specs/` | Core specs complete, 6 need expansion |
| Cross-cutting specs | 4 files in `.claude/rules/` | api-standards, error-handling, security, audit-logging |
| Design system | `.claude/rules/design-system.md` | Complete (891 lines) |

### Phase 0 Progress Summary

| Category | Total | Done | Remaining |
|----------|-------|------|-----------|
| Critical Specifications (P0.1) | 5 | **5** | 0 |
| Architecture Inconsistencies (P0.2) | 13 | **7** | 6 |
| Specifications Needing Expansion (P0.3) | 6 | **0** | 6 |
| Files Requiring Updates (P0.4) | 3 | **3** | 0 |
| **Total Phase 0 Tasks** | **27** | **15** | **12** |

### Specification Completeness Analysis

| Spec File | Lines | Status | Notes |
|-----------|-------|--------|-------|
| company-management.md | 1,737 | COMPLETE | Reference quality |
| convertible-instruments.md | 1,664 | COMPLETE | Reference quality |
| shareholder-registry.md | 1,095 | COMPLETE | Good |
| kyc-verification.md | 1,009 | COMPLETE | Good |
| cap-table-management.md | 960 | COMPLETE | Uses `CapTableEntry` - needs rename to `Shareholding` |
| authentication.md | 506 | COMPLETE | Good |
| blockchain-integration.md | 504 | COMPLETE | AdminWallet section exists but could be expanded |
| option-exercises.md | 324 | ADEQUATE | Needs review |
| document-generation.md | 272 | ADEQUATE | Uses `document_hash` - needs rename to `contentHash` |
| document-signatures.md | 263 | ADEQUATE | Uses `Signature` and `document_hash` - needs renames |
| transactions.md | 236 | PARTIAL | Missing schemas |
| option-plans.md | 204 | PARTIAL | Needs expansion to 500+ lines |
| notifications.md | 184 | PARTIAL | Needs expansion to 600+ lines, missing `channel` enum |
| funding-rounds.md | 173 | PARTIAL | Needs expansion to 500+ lines, wrong status enum |
| user-permissions.md | 161 | PARTIAL | Needs expansion to 400+ lines |
| share-classes.md | 130 | PARTIAL | Needs expansion to 500+ lines |
| reports-analytics.md | 117 | PARTIAL | Needs expansion to 500+ lines |

### Cross-Cutting Specifications (in `.claude/rules/`)

| Spec File | Lines | Status |
|-----------|-------|--------|
| api-standards.md | 1,141 | COMPLETE |
| audit-logging.md | 1,057 | COMPLETE |
| security.md | 962 | COMPLETE |
| error-handling.md | 957 | COMPLETE |
| design-system.md | 891 | COMPLETE |
| testing-backend.md | 71 | COMPLETE (concise rules format) |
| testing-frontend.md | 24 | COMPLETE (concise rules format) |

---

## Table of Contents

1. [Phase 0: Specification Completion (BLOCKING)](#phase-0-specification-completion-blocking)
   - [P0.1: Critical Specifications (COMPLETE)](#p01-critical-specifications-complete)
   - [P0.2: Architecture Inconsistencies (PARTIAL)](#p02-architecture-inconsistencies-partial)
   - [P0.3: Specifications Requiring Expansion](#p03-specifications-requiring-expansion)
   - [P0.4: Files Requiring Updates (COMPLETE)](#p04-files-requiring-updates-complete)
   - [P0.5: Phase 0 Completion Gate](#p05-phase-0-completion-gate)
2. [Phase 1: Foundation and Infrastructure](#phase-1-foundation-and-infrastructure)
3. [Phase 2: Core Cap Table](#phase-2-core-cap-table)
4. [Phase 3: Blockchain Integration](#phase-3-blockchain-integration)
5. [Phase 4: Transactions](#phase-4-transactions)
6. [Phase 5: Investment Features](#phase-5-investment-features)
7. [Phase 6: Employee Equity](#phase-6-employee-equity)
8. [Phase 7: Documents and Signatures](#phase-7-documents-and-signatures)
9. [Phase 8: Notifications and Reports](#phase-8-notifications-and-reports)
10. [Phase 9: Production Readiness](#phase-9-production-readiness)
11. [Dependency Graph](#dependency-graph)
12. [Technology Stack Reference](#technology-stack-reference)
13. [Quick Reference Checklists](#quick-reference-checklists)

---

## Phase 0: Specification Completion (BLOCKING)

**CRITICAL: No implementation code should be written until Phase 0 is 100% complete.**

### P0.1 Critical Specifications (COMPLETE)

All 5 critical specifications have been authored and exceed their target line counts.

| # | Specification | Location | Lines | Target | Status |
|---|--------------|----------|-------|--------|--------|
| 1 | Company Management | `specs/company-management.md` | 1,737 | 800+ | COMPLETE |
| 2 | API Standards | `.claude/rules/api-standards.md` | 1,141 | 400+ | COMPLETE |
| 3 | Error Handling | `.claude/rules/error-handling.md` | 957 | 400+ | COMPLETE |
| 4 | Security | `.claude/rules/security.md` | 962 | 500+ | COMPLETE |
| 5 | Audit Logging | `.claude/rules/audit-logging.md` | 1,057 | 400+ | COMPLETE |

**Note**: Specs #2-5 are stored in `.claude/rules/` (as project-wide rules that load automatically) rather than in `specs/`. This is intentional — they define cross-cutting standards that apply to all implementation work.

---

### P0.2 Architecture Inconsistencies (PARTIAL)

7 of 13 original inconsistencies have been resolved. 6 remain, plus 1 newly identified issue.

#### Resolved

| # | Issue | Resolution | Status |
|---|-------|------------|--------|
| 1 | `.claude/commands/architecture.md` referenced Django | Updated to reference NestJS 10+ with TypeScript | DONE |
| 2 | `.claude/rules/testing-backend.md` referenced Django | Rewritten for NestJS + Jest | DONE |
| 3 | API paths missing `/api/v1/` prefix | All spec files now use `/api/v1/` prefix | DONE |
| 4 | KYC status: `User.kyc_status` vs `KYCVerification` | Hybrid approach documented in kyc-verification.md | DONE |
| 5 | `Transaction` vs `ShareTransaction` | `Transaction` with `transactionType` discriminator used | DONE |
| 8 | `Notification` vs `EmailNotification` entity name | `Notification` used in notifications.md | DONE (but missing `channel` enum — see #8b below) |
| 9 | `OptionGrant` vs `Option` | `OptionGrant` used in option-plans.md | DONE |

#### Remaining — Entity Naming

| # | Issue | File(s) to Update | Impact |
|---|-------|-------------------|--------|
| 6 | `CapTableEntry` should be `Shareholding` | `specs/cap-table-management.md` (lines 136, 139, 169, 742, 789, 808) | Medium |
| 7 | `Signature` entity should be `DocumentSigner` | `specs/document-signatures.md` (lines 70-100) | Medium |
| 8b | `Notification` missing `channel` enum field | `specs/notifications.md` (add `channel: 'EMAIL' | 'IN_APP'` to entity) | Medium |

#### Remaining — Field Naming

| # | Issue | File(s) to Update | Impact |
|---|-------|-------------------|--------|
| 10 | `document_hash` should be `contentHash` | `specs/document-generation.md` (lines 119, 194), `specs/document-signatures.md` (lines 46, 83, 136, 162) | Low |

#### Remaining — Enum Values

| # | Issue | File(s) to Update | Impact |
|---|-------|-------------------|--------|
| 12 | Round status uses `OPEN | FIRST_CLOSE | FINAL_CLOSE | CANCELLED` | `specs/funding-rounds.md` (line 83) — change to `DRAFT | OPEN | CLOSING | CLOSED | CANCELLED` | Medium |

#### Remaining — API Path Scoping (NEW)

| # | Issue | File(s) to Update | Impact |
|---|-------|-------------------|--------|
| 14 | Several specs define non-company-scoped paths for company-owned resources, conflicting with `api-standards.md` | See table below | High |

**API path scoping violations** (paths should be company-scoped per `api-standards.md`):

| File | Current Path | Should Be |
|------|-------------|-----------|
| document-generation.md | `GET /api/v1/documents/templates` | `/api/v1/companies/:companyId/documents/templates` |
| document-generation.md | `POST /api/v1/documents/generate` | `/api/v1/companies/:companyId/documents/generate` |
| document-generation.md | `GET /api/v1/documents/:id/preview` | `/api/v1/companies/:companyId/documents/:id/preview` |
| document-generation.md | `GET /api/v1/documents/:id/download` | `/api/v1/companies/:companyId/documents/:id/download` |
| document-signatures.md | `POST /api/v1/documents/:id/request-signatures` | `/api/v1/companies/:companyId/documents/:id/request-signatures` |
| document-signatures.md | `POST /api/v1/documents/:id/signatures` | `/api/v1/companies/:companyId/documents/:id/signatures` |
| document-signatures.md | `GET /api/v1/documents/:id/signatures` | `/api/v1/companies/:companyId/documents/:id/signatures` |
| option-plans.md | `GET /api/v1/option-grants/:id/vesting` | `/api/v1/companies/:companyId/option-grants/:id/vesting` |
| blockchain-integration.md | `POST /api/v1/blockchain/admin-wallet` | `/api/v1/companies/:companyId/blockchain/admin-wallet` |
| blockchain-integration.md | `GET /api/v1/transactions/:id/blockchain` | `/api/v1/companies/:companyId/transactions/:id/blockchain` |
| notifications.md | `GET /api/v1/notifications/*` | `/api/v1/users/me/notifications/*` (user-scoped per api-standards.md) |
| shareholder-registry.md | `GET /api/v1/shareholders/me` | `/api/v1/users/me/shareholders` (user-scoped) |

#### Resolution Tasks Checklist

```
ENTITY NAMING (3 files):
[ ] cap-table-management.md: Rename CapTableEntry → Shareholding throughout
[ ] document-signatures.md: Rename Signature entity → DocumentSigner
[ ] notifications.md: Add channel: 'EMAIL' | 'IN_APP' field to Notification entity

FIELD NAMING (2 files):
[ ] document-generation.md: Rename document_hash → contentHash
[ ] document-signatures.md: Rename document_hash → contentHash

ENUM VALUES (1 file):
[ ] funding-rounds.md: Change status enum to DRAFT | OPEN | CLOSING | CLOSED | CANCELLED

API PATH SCOPING (5 files):
[ ] document-generation.md: Add company scope to all document paths
[ ] document-signatures.md: Add company scope to all signature paths
[ ] option-plans.md: Add company scope to vesting endpoint
[ ] blockchain-integration.md: Add company scope to blockchain endpoints
[ ] notifications.md: Change to /api/v1/users/me/notifications/* pattern
[ ] shareholder-registry.md: Change /api/v1/shareholders/me to /api/v1/users/me/shareholders
```

---

### P0.3 Specifications Requiring Expansion

These 6 specifications exist but lack critical implementation details needed for development.

#### P0.3.1 share-classes.md (130 -> 500+ lines)

- **Current state**: Basic share class types defined
- **Priority**: P1

**Missing sections**:
- Anti-dilution protection formulas (full ratchet, weighted average)
- Conversion rights mechanics
- Redemption rights
- Pre-emptive rights (Direito de Subscricao, Lei 6.404/76 Art. 171)
- Dividend rights (cumulative, non-cumulative)
- Treasury shares handling
- User flow diagrams
- API request/response examples for all endpoints

#### P0.3.2 reports-analytics.md (117 -> 500+ lines)

- **Current state**: Report types listed, no implementation details
- **Priority**: P1

**Missing sections**:
- Export endpoint specifications (PDF, XLSX, CSV, OCT JSON)
- Waterfall calculation algorithm with code
- Caching strategy (Redis TTL, invalidation)
- Dilution report structure
- Due diligence package (ZIP manifest)
- Brazilian regulatory reports (RDE-IED, IRPJ)
- Chart specifications (Recharts)

#### P0.3.3 user-permissions.md (161 -> 400+ lines)

- **Current state**: Roles listed, no permission matrix
- **Priority**: P1

**Missing sections**:
- Complete permission matrix (30+ permissions x 5 roles)
- Permission matrix API endpoints
- NestJS guard implementation (@Roles, @Permissions decorators)
- Permission aggregation rules and hierarchy
- Row-level security patterns (Prisma middleware)
- Permission check audit logging

#### P0.3.4 funding-rounds.md (173 -> 500+ lines)

- **Current state**: Round entity defined, missing workflows
- **Priority**: P1

**Missing sections**:
- Commitment CRUD API endpoints
- RoundCommitment entity (full definition with all fields)
- Multi-close mechanics (first close, rolling closes, final close)
- RoundClose entity
- Oversubscription handling (hard cap, pro-rata)
- Payment validation process
- Side letter storage (S3)
- Integration with convertible conversion
- User flow diagrams

#### P0.3.5 notifications.md (184 -> 600+ lines)

- **Current state**: 2 of 23 email templates specified
- **Priority**: P1

**Missing sections**:
- 21 additional email templates (with variables, subject lines, i18n)
- i18n support (PT-BR default, EN)
- Bounce handling (AWS SES webhooks)
- Unsubscribe mechanism
- In-app notification system (channel enum, WebSocket/polling)
- Email template structure (MJML)
- Webhook handling for delivery status

#### P0.3.6 option-plans.md (204 -> 500+ lines)

- **Current state**: Basic option plan defined
- **Priority**: P1

**Missing sections**:
- FMV (Fair Market Value) determination
- Early exercise support
- Tax considerations (Brazilian capital gains)
- Good leaver/bad leaver policy
- Acceleration trigger events (single/double trigger)
- Grant amendment rules
- Termination workflow (detailed)
- List endpoint specifications
- API request/response examples

---

### P0.4 Files Requiring Updates (COMPLETE)

All 3 file update tasks have been completed.

| # | File | Change | Status |
|---|------|--------|--------|
| 1 | `.claude/commands/architecture.md` | Updated to reference NestJS 10+ with TypeScript | DONE |
| 2 | `.claude/rules/testing-backend.md` | Rewritten for NestJS + Jest patterns | DONE |
| 3 | `specs/README.md` | Entity glossary added (26 entities) | DONE |

---

### P0.5 Phase 0 Completion Gate

**Gate criteria - ALL must be checked before proceeding to Phase 1**:

```
CRITICAL SPECIFICATIONS (5):
[x] specs/company-management.md — 1,737 lines
[x] .claude/rules/api-standards.md — 1,141 lines
[x] .claude/rules/error-handling.md — 957 lines
[x] .claude/rules/security.md — 962 lines
[x] .claude/rules/audit-logging.md — 1,057 lines

FILE UPDATES (3):
[x] .claude/commands/architecture.md — updated to NestJS
[x] .claude/rules/testing-backend.md — rewritten for NestJS + Jest
[x] specs/README.md — entity glossary added (26 entities)

ENTITY NAMING FIXES:
[ ] cap-table-management.md — rename CapTableEntry → Shareholding
[ ] document-signatures.md — rename Signature → DocumentSigner
[ ] document-generation.md — rename document_hash → contentHash
[ ] document-signatures.md — rename document_hash → contentHash
[ ] notifications.md — add channel enum to Notification entity

ENUM STANDARDIZATION:
[ ] funding-rounds.md — status enum: DRAFT, OPEN, CLOSING, CLOSED, CANCELLED

API PATH SCOPING:
[ ] document-generation.md — add company scope to paths
[ ] document-signatures.md — add company scope to paths
[ ] option-plans.md — add company scope to vesting endpoint
[ ] blockchain-integration.md — add company scope to blockchain endpoints
[ ] notifications.md — use /api/v1/users/me/notifications/* pattern
[ ] shareholder-registry.md — use /api/v1/users/me/shareholders

SPECIFICATION EXPANSIONS:
[ ] share-classes.md — expand from 130 to 500+ lines
[ ] reports-analytics.md — expand from 117 to 500+ lines
[ ] user-permissions.md — expand from 161 to 400+ lines
[ ] funding-rounds.md — expand from 173 to 500+ lines
[ ] notifications.md — expand from 184 to 600+ lines
[ ] option-plans.md — expand from 204 to 500+ lines

FINAL REVIEW:
[ ] All specifications reviewed for consistency
[ ] No conflicting entity names across specs
[ ] API paths consistent with api-standards.md scoping rules
[ ] Error codes defined for all error scenarios
[ ] Stakeholder sign-off obtained
```

---

## Phase 1: Foundation and Infrastructure

**Timeline**: Weeks 2-3 (after Phase 0 completion)
**Dependencies**: Phase 0 complete
**Estimated Duration**: 2 weeks

### 1.1 Project Setup

- [ ] Initialize monorepo structure
  - Create `/frontend`, `/backend`, `/contracts` directories
  - Configure pnpm workspaces + Turborepo
  - Create root `package.json` with workspace config

- [ ] Configure development tooling
  - Set up Git hooks (Husky) for linting and commit validation
  - Create shared TypeScript configurations
  - Set up ESLint + Prettier with consistent rules
  - Create `.env.example` files for each package

- [ ] Set up CI/CD pipeline
  - Configure GitHub Actions (lint, test, build)
  - Configure branch protection (require PR, CI pass)
  - Set up automatic deployments for staging

### 1.2 Frontend Foundation (Next.js)

- [ ] Initialize Next.js 14+ with App Router
  - Configure TypeScript strict mode
  - Set up shadcn/ui component library
  - Configure TanStack Query for data fetching
  - Set up next-intl (PT-BR default, EN)

- [ ] Create base layouts
  - Dashboard layout with sidebar navigation
  - Auth layout (minimal, centered)
  - Public layout (marketing pages)

- [ ] Set up form handling and validation
  - React Hook Form + Zod validation
  - Create typed API client with error interceptor
  - Implement loading skeletons and error boundaries

### 1.3 Backend Foundation (NestJS)

- [ ] Initialize NestJS 10+ with TypeScript
  - Configure PostgreSQL connection (SSL, pooling)
  - Set up Prisma ORM with initial schema
  - Configure environment validation

- [ ] Create base database schema (Prisma)
  - User, Company, CompanyMember entities
  - AuditLog entity
  - Run initial migration

- [ ] Configure infrastructure services
  - Redis connection + Bull queues
  - AWS SDK configuration (S3, SES)
  - Health check module

- [ ] Set up API infrastructure
  - Global exception filter (per error-handling spec)
  - Response interceptor (per api-standards spec)
  - Rate limiting (per api-standards spec)
  - Swagger/OpenAPI documentation
  - CORS configuration (per security spec)

### 1.4 Authentication (Privy Integration)

- [ ] Backend Privy integration
  - JWT verification middleware
  - AuthService (verify token, get/create user)
  - Auth guards (`@Public`, `@RequireAuth`)
  - `@CurrentUser` decorator

- [ ] Frontend Privy integration
  - Privy React SDK configuration
  - AuthContext provider
  - Protected route wrapper
  - Login page with Privy modal
  - User menu with logout

### 1.5 KYC Verification (Verifik Integration)

- [ ] Backend Verifik integration
  - Verifik service (API client)
  - CPF validation endpoint
  - CNPJ validation endpoint
  - Document upload service (S3)
  - Facial recognition service
  - AML screening service
  - KYC webhook handler

- [ ] Frontend KYC flow
  - KYC status dashboard
  - Document upload UI with drag-drop
  - Camera capture for selfie
  - Progress stepper component

---

## Phase 2: Core Cap Table

**Timeline**: Weeks 4-5
**Dependencies**: Phase 1 complete

### 2.1 Company Management

- [ ] Company backend
  - Company entity + Prisma model
  - Company CRUD API endpoints
  - CNPJ validation via Verifik
  - Creator's embedded wallet as smart contract admin
  - Company membership system
  - Company settings API

- [ ] Company frontend
  - Company creation wizard (CNPJ -> verify -> create)
  - Company settings page
  - Company switcher in navbar
  - Member management page

### 2.2 Share Classes

- [ ] Share class backend
  - ShareClass entity + Prisma model
  - Share class CRUD API endpoints
  - Ltda quota logic (single class, equal rights)
  - S.A. ON/PN logic (voting, preferences)
  - Share class validation rules

- [ ] Share class frontend
  - Share class creation form
  - Share class list with summary cards
  - Share class edit modal

### 2.3 Shareholder Registry

- [ ] Shareholder backend
  - Shareholder entity + Prisma model
  - BeneficialOwner entity (UBO tracking)
  - Shareholder CRUD API endpoints
  - CPF/CNPJ validation on creation
  - Foreign shareholder support (RDE-IED fields)
  - Shareholder invite service
  - KYC status integration

- [ ] Shareholder frontend
  - Shareholder list with filters and search
  - Add shareholder wizard
  - Shareholder detail view

### 2.4 Cap Table Management

- [ ] Cap table backend
  - Shareholding entity + Prisma model
  - CapTableSnapshot entity + Prisma model
  - Cap table calculation service
  - Fully-diluted calculation
  - Cap table API endpoints
  - Snapshot service
  - OCT format export service

- [ ] Cap table frontend
  - Cap table visualization (table view)
  - Ownership pie chart
  - Snapshot history with comparison

---

## Phase 3: Blockchain Integration

**Timeline**: Weeks 6-7
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

- [ ] Creator's embedded wallet as contract admin (via Privy)
- [ ] Gas sponsorship configuration (Privy)
- [ ] Transaction signing service
- [ ] Transaction queue (Bull) for sequencing
- [ ] Nonce management

### 3.3 Blockchain Sync Service

- [ ] Event listener service (viem)
- [ ] Event processors
- [ ] Database reconciliation service
- [ ] Confirmation tracking (12 blocks)
- [ ] Retry logic for failed syncs
- [ ] Sync status API endpoint
- [ ] Frontend blockchain status indicator

---

## Phase 4: Transactions

**Timeline**: Week 8
**Dependencies**: Phase 3 complete

### 4.1 Transaction Core

- [ ] Transaction entity + Prisma model
- [ ] BlockchainTransaction entity + Prisma model
- [ ] Transaction validation service
- [ ] Transaction history API

### 4.2 Share Issuance

- [ ] Share issuance service
- [ ] Dilution calculation + warning
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

- [ ] Conversion service (preferred -> common)
- [ ] Cancellation service (repurchase, forfeiture)

### 4.5 Transaction UI

- [ ] Transaction history ledger API
- [ ] Frontend: Transaction history list
- [ ] Frontend: Transaction detail view

---

## Phase 5: Investment Features

**Timeline**: Weeks 9-10
**Dependencies**: Phase 4 complete

### 5.1 Funding Rounds

- [ ] FundingRound entity + Prisma model
- [ ] RoundCommitment entity + Prisma model
- [ ] RoundClose entity + Prisma model
- [ ] Round CRUD API endpoints
- [ ] Commitment CRUD API endpoints
- [ ] Pro-forma cap table calculation
- [ ] Multi-close mechanics
- [ ] Payment confirmation workflow
- [ ] Frontend: Round creation wizard
- [ ] Frontend: Commitment tracking
- [ ] Frontend: Pro-forma preview
- [ ] Frontend: Round closing flow

### 5.2 Convertible Instruments

- [ ] ConvertibleInstrument entity
- [ ] Daily interest calculation job
- [ ] Conversion calculation engine
- [ ] Conversion scenario modeling API
- [ ] Conversion trigger detection
- [ ] Automatic conversion execution
- [ ] Frontend: Instrument creation wizard
- [ ] Frontend: Scenario modeling UI
- [ ] Frontend: Instrument portfolio view

---

## Phase 6: Employee Equity

**Timeline**: Week 11
**Dependencies**: Phase 4 complete

### 6.1 Option Plans

- [ ] OptionPlan entity + Prisma model
- [ ] OptionGrant entity + Prisma model
- [ ] VestingSchedule entity + Prisma model
- [ ] Option plan CRUD API
- [ ] Option grant CRUD API
- [ ] Vesting calculation service
- [ ] Frontend: Option plan management
- [ ] Frontend: Grant creation form
- [ ] Frontend: Employee grant dashboard

### 6.2 Option Exercises

- [ ] OptionExerciseRequest entity + Prisma model
- [ ] Exercise request flow (employee)
- [ ] Payment confirmation flow (admin)
- [ ] Share issuance on confirmation
- [ ] Termination handling service
- [ ] Frontend: Exercise request flow

---

## Phase 7: Documents and Signatures

**Timeline**: Week 12
**Dependencies**: Phase 2 complete

### 7.1 Document Generation

- [ ] DocumentTemplate entity + Prisma model
- [ ] Document entity + Prisma model
- [ ] Brazilian document templates (5 types)
- [ ] Template storage in database
- [ ] PDF generation service (Puppeteer)
- [ ] Frontend: Document generation trigger
- [ ] Frontend: Document preview

### 7.2 Digital Signatures

- [ ] DocumentSigner entity + Prisma model
- [ ] EIP-712 signature implementation
- [ ] Signature request service
- [ ] Signature verification service
- [ ] On-chain hash anchoring
- [ ] Frontend: Signature request flow
- [ ] Frontend: Signing UI with Privy

---

## Phase 8: Notifications and Reports

**Timeline**: Week 13
**Dependencies**: All previous phases

### 8.1 Notifications

- [ ] Notification entity + Prisma model (with `channel` enum)
- [ ] UserNotificationPreferences entity
- [ ] AWS SES integration service
- [ ] Email template engine (MJML + Handlebars)
- [ ] 23 email templates (PT-BR and EN)
- [ ] Background job processing (Bull)
- [ ] Notification preferences API
- [ ] Bounce handling webhook
- [ ] Frontend: Notification preferences page

### 8.2 Reports

- [ ] Cap table report service
- [ ] Dilution analysis report
- [ ] Exit waterfall calculation engine
- [ ] Due diligence package generator
- [ ] Export services (PDF, Excel, CSV, OCT JSON)
- [ ] Report caching (Redis)
- [ ] Frontend: Report dashboard
- [ ] Frontend: Scenario modeling UI
- [ ] Frontend: Export interface

---

## Phase 9: Production Readiness

**Timeline**: Week 14
**Dependencies**: All previous phases

### 9.1 Security and RBAC

- [ ] Full RBAC implementation
- [ ] Permission guards on all endpoints
- [ ] Row-level security
- [ ] Security header configuration
- [ ] CORS final configuration
- [ ] Rate limiting tuning
- [ ] LGPD compliance verification

### 9.2 Testing

- [ ] Backend unit tests (85%+ coverage)
- [ ] Frontend unit tests (80%+ coverage)
- [ ] Smart contract tests (100% coverage)
- [ ] Integration tests for critical paths
- [ ] E2E tests (Playwright)

### 9.3 Deployment

- [ ] Frontend deployment (Vercel)
- [ ] Backend deployment (Railway)
- [ ] PostgreSQL provisioning
- [ ] Redis provisioning
- [ ] Smart contract deployment (Base Mainnet)
- [ ] DNS configuration
- [ ] SSL verification
- [ ] Monitoring setup (Sentry)
- [ ] Database backup configuration
- [ ] Runbook documentation

---

## Dependency Graph

```
PHASE 0: SPECIFICATION COMPLETION (BLOCKING)
    |
    |-- P0.1: 5 critical specs (COMPLETE)
    |-- P0.2: Entity naming fixes, enum standardization, API path scoping (6 remaining)
    |-- P0.3: Expand 6 specifications
    |-- P0.4: File updates (COMPLETE)
    |
    v
PHASE 1: FOUNDATION & INFRASTRUCTURE
    |
    |-- 1.1: Monorepo setup
    |-- 1.2: Next.js frontend scaffold
    |-- 1.3: NestJS backend scaffold + Prisma schema
    |-- 1.4: Privy authentication
    |-- 1.5: Verifik KYC
    |
    v
PHASE 2: CORE CAP TABLE
    |
    |-- 2.1: Company CRUD
    |-- 2.2: ShareClass CRUD
    |-- 2.3: Shareholder Registry
    |-- 2.4: Cap Table calculation engine
    |
    +------------------------------------------+
    |                                          |
    v                                          v
PHASE 3: BLOCKCHAIN INTEGRATION         PHASE 7: DOCUMENTS
    |                                          |
    |-- 3.1: OCP Smart Contracts              |-- 7.1: Document Generation
    |-- 3.2: Wallet infra                     |-- 7.2: Digital Signatures
    |-- 3.3: Blockchain sync                  |
    |                                          |
    v                                          |
PHASE 4: TRANSACTIONS                          |
    |                                          |
    |-- 4.1: Transaction core                  |
    |-- 4.2: Share Issuance                   |
    |-- 4.3: Share Transfer                   |
    |-- 4.4: Conversion/Cancellation          |
    |                                          |
    +------------------+-----------------------+
                       |
    +------------------+------------------+
    |                                     |
    v                                     v
PHASE 5: INVESTMENTS              PHASE 6: EMPLOYEE EQUITY
    |                                     |
    |-- 5.1: Funding Rounds              |-- 6.1: Option Plans
    |-- 5.2: Convertibles                |-- 6.2: Option Exercises
    |                                     |
    +------------------+------------------+
                       |
                       v
           PHASE 8: NOTIFICATIONS & REPORTS
                       |
                       |-- 8.1: Email notifications
                       |-- 8.2: Reports & exports
                       |
                       v
           PHASE 9: PRODUCTION READINESS
                       |
                       |-- 9.1: Security & RBAC
                       |-- 9.2: Testing (85%+ coverage)
                       |-- 9.3: Deployment
```

---

## Technology Stack Reference

### Frontend (Vercel)

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14+ | App Router framework |
| TypeScript | 5.0+ | Type safety |
| Tailwind CSS | 3.x | Styling |
| shadcn/ui | Latest | Component library |
| TanStack Query | v5 | Data fetching |
| React Hook Form | 7.x | Form handling |
| Zod | 3.x | Validation |
| Privy React SDK | Latest | Authentication |
| viem | Latest | Blockchain interaction |
| next-intl | Latest | i18n (PT-BR, EN) |
| Recharts | Latest | Charts |

### Backend (Railway)

| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 10+ | Framework |
| TypeScript | 5.0+ | Type safety |
| PostgreSQL | 15+ | Database |
| Prisma | Latest | ORM |
| Redis | Latest | Cache/queues |
| Bull | Latest | Background jobs |
| AWS SDK v3 | Latest | S3, SES |
| viem | Latest | Blockchain |
| decimal.js | Latest | Financial math |
| Puppeteer | Latest | PDF generation |
| Jest | Latest | Testing |

### Blockchain

| Technology | Details |
|------------|---------|
| Network | Base Network (Chain ID: 8453) |
| Development | Foundry |
| Contracts | OCP + Brazilian extensions |
| Wallets | Privy Embedded Wallets (creator's wallet as admin) |
| Gas | Privy Gas Sponsorship |

### External Services

| Service | Purpose |
|---------|---------|
| Privy | Auth (Email, Google, Apple) + Embedded Wallets |
| Verifik | KYC (CPF/CNPJ, facial, AML) |
| AWS S3 | File storage (sa-east-1) |
| AWS SES | Email notifications |
| Sentry | Error monitoring |

---

## Quick Reference Checklists

### Phase 0 Remaining Work

```
ENTITY + FIELD RENAMES (5 files, ~30 min):
[ ] cap-table-management.md: CapTableEntry → Shareholding
[ ] document-signatures.md: Signature → DocumentSigner, document_hash → contentHash
[ ] document-generation.md: document_hash → contentHash
[ ] notifications.md: Add channel enum to Notification entity

ENUM FIX (1 file, ~5 min):
[ ] funding-rounds.md: Status → DRAFT | OPEN | CLOSING | CLOSED | CANCELLED

API PATH SCOPING (5 files, ~1 hour):
[ ] document-generation.md: Company-scope all paths
[ ] document-signatures.md: Company-scope all paths
[ ] option-plans.md: Company-scope vesting endpoint
[ ] blockchain-integration.md: Company-scope blockchain endpoints
[ ] notifications.md + shareholder-registry.md: User-scope paths

SPEC EXPANSIONS (6 files, ~3 days):
[ ] share-classes.md: 130 → 500+ lines
[ ] reports-analytics.md: 117 → 500+ lines
[ ] user-permissions.md: 161 → 400+ lines
[ ] funding-rounds.md: 173 → 500+ lines
[ ] notifications.md: 184 → 600+ lines
[ ] option-plans.md: 204 → 500+ lines
```

### Phase Gate Checklist

Before moving to next phase:

```
[ ] All tasks in current phase completed
[ ] Unit tests written and passing
[ ] Code review completed
[ ] Documentation updated
[ ] No critical bugs outstanding
[ ] Specification compliance verified
```

### Production Deployment Checklist

```
[ ] All E2E tests passing
[ ] Security audit completed
[ ] LGPD compliance verified
[ ] Performance benchmarks met
[ ] Monitoring configured and alerting
[ ] Backup strategy tested
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
| 2026-02-23 | 6.0 | Claude | Consistency audit: marked completed P0 items, identified API path scoping issues, updated line counts, reconciled with actual file state |
| 2026-01-27 | 5.0 | Claude | Final comprehensive analysis with validated gaps, prioritized inconsistencies, detailed checklists |
| 2026-01-27 | 4.0 | Claude | Complete restructure with bullet-point format |
| 2026-01-27 | 3.0 | Claude | Comprehensive rewrite with P0/P1/P2 specifications |
| 2026-01-27 | 2.3 | Claude | Validated specifications, confirmed gaps |
| 2026-01-27 | 2.0 | Claude | Initial structured plan after spec review |
