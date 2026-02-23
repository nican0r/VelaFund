# Company Management Specification

**Topic of Concern**: Company creation, lifecycle management, and multi-company support

**One-Sentence Description**: The system manages Brazilian company entities (Ltda. and S.A.) with CNPJ validation, lifecycle state machine (DRAFT -> ACTIVE -> INACTIVE -> DISSOLVED), multi-company support, and company context switching scoped through the creating user's embedded wallet as the on-chain admin.

---

## Overview

The Company entity is the root entity in Navia — every feature (shareholders, cap table, transactions, documents, option plans) is company-scoped. A company represents a Brazilian legal entity, either a Sociedade Limitada (Ltda.) or a Sociedade Anônima (S.A.), that uses the platform to manage its cap table with on-chain record-keeping.

### Brazilian Entity Types

**Sociedade Limitada (Ltda.)** is the most common business entity in Brazil, equivalent to an LLC. Members hold quotas (quotas sociais) with equal rights per quota. Governed by Articles 1.052-1.087 of the Brazilian Civil Code (Lei 10.406/2002).

**Sociedade Anônima (S.A.)** is a corporation governed by Lei 6.404/1976 (Lei das S.A.). S.A. companies can be capital aberto (publicly traded) or capital fechado (privately held). They issue shares (acoes) that can be common (ordinarias - ON) or preferred (preferenciais - PN) with distinct rights.

### Multi-Company Support

A single user can belong to multiple companies with different roles in each. The platform supports company context switching — the active company is identified by the `X-Company-Id` HTTP header on all API requests. All data queries are scoped to the active company via Prisma middleware, ensuring strict data isolation.

### Company Creation Flow (Summary)

Company creation is asynchronous. When an admin submits the company creation form:

1. Company is created in `DRAFT` status with the provided CNPJ
2. A Bull background job validates the CNPJ via Verifik against Receita Federal (see `company-cnpj-validation.md`)
3. On success, company moves to `ACTIVE` and the OCP smart contract is deployed (see `company-blockchain-admin.md`)
4. On failure, admin is notified and can update the CNPJ and retry

**Extracted specifications**:
- **Membership, invitations, and role management** -> `company-membership.md`
- **CNPJ validation via Verifik and Bull job** -> `company-cnpj-validation.md`
- **Blockchain admin wallet and contract deployment** -> `company-blockchain-admin.md`

---

## Table of Contents

1. [User Stories](#user-stories)
2. [Functional Requirements](#functional-requirements)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Lifecycle State Machine](#lifecycle-state-machine)
6. [User Flows](#user-flows)
7. [Business Rules](#business-rules)
8. [Edge Cases & Error Handling](#edge-cases--error-handling)
9. [Security Considerations](#security-considerations)
10. [Technical Implementation](#technical-implementation)
11. [Success Criteria](#success-criteria)

---

## User Stories

### US-1: Create a New Company
**As an** admin user with approved KYC
**I want to** create a new company by providing its CNPJ and details
**So that** I can start managing the company's cap table on the platform

### US-2: Switch Between Companies
**As a** user who belongs to multiple companies
**I want to** switch between companies from the navigation bar
**So that** I can manage different companies without logging out

### US-3: Update Company Details
**As an** admin user
**I want to** update the company's name, description, logo, and settings
**So that** the company profile stays current

### US-4: Deactivate or Dissolve a Company
**As an** admin user
**I want to** deactivate or dissolve a company
**So that** the company's data is preserved but no new transactions can occur

---

## Functional Requirements

### FR-1: Company CRUD with CNPJ Validation
- System MUST allow authenticated users with approved KYC to create a company
- System MUST require a valid CNPJ on creation (format: XX.XXX.XXX/XXXX-XX)
- System MUST validate CNPJ format client-side before submission
- System MUST create company in `DRAFT` status immediately upon form submission
- System MUST trigger asynchronous CNPJ validation via Verifik (see `company-cnpj-validation.md`)
- System MUST support updating company name, description, logo, and settings
- System MUST support listing all companies the authenticated user belongs to
- System MUST support retrieving full company details including setup status

### FR-2: Company Lifecycle State Machine
- System MUST enforce the following state transitions:
  - `DRAFT` -> `ACTIVE` (on successful CNPJ validation + contract deployment)
  - `ACTIVE` -> `INACTIVE` (admin action — temporarily suspends operations)
  - `INACTIVE` -> `ACTIVE` (admin re-activation)
  - `ACTIVE` -> `DISSOLVED` (admin action — permanent, requires 0 active shareholders)
  - `INACTIVE` -> `DISSOLVED` (admin action — permanent)
- `DRAFT` companies MUST NOT allow shareholder creation, transactions, or document generation
- `INACTIVE` companies MUST block new transactions but allow read access
- `DISSOLVED` companies MUST be fully read-only (no writes except audit logs)

### FR-3: Multi-Company Support with X-Company-Id Header
- All company-scoped API endpoints MUST require the `X-Company-Id` header
- System MUST validate that the authenticated user is an active member of the specified company
- System MUST return `403 Forbidden` if the user is not a member of the specified company
- System MUST scope all database queries to the company specified in the header via Prisma middleware
- System MUST support the `/api/v1/companies` endpoint without the `X-Company-Id` header (user-scoped, lists all companies)
- System MUST enforce a maximum of **20 companies** per user (PENDING + ACTIVE memberships)

### FR-4: Company Context Switching in Frontend
- Frontend MUST display a company selector in the navigation bar
- Selecting a company MUST update the `X-Company-Id` header for all subsequent API calls
- Company switch MUST reload the dashboard with the new company's data
- Frontend MUST persist the last selected company in local storage
- On login, frontend MUST restore the last selected company or default to the first company

---

## Data Models

### Company Entity

```typescript
interface Company {
  id: string;                          // UUID, primary key
  name: string;                        // Display name (may differ from razao social)
  entityType: CompanyEntityType;       // LTDA | SA_CAPITAL_FECHADO | SA_CAPITAL_ABERTO
  cnpj: string;                        // XX.XXX.XXX/XXXX-XX (unique)
  description: string | null;          // Optional company description
  logoUrl: string | null;              // S3 URL for company logo
  foundedDate: Date | null;            // Company founding date

  // Lifecycle
  status: CompanyStatus;               // DRAFT | ACTIVE | INACTIVE | DISSOLVED

  // CNPJ Validation (populated by Verifik — see company-cnpj-validation.md)
  cnpjValidatedAt: Date | null;
  cnpjData: CnpjData | null;          // Cached Receita Federal data (JSONB)

  // OCT Metadata (JSONB — Open Cap Table standard metadata)
  octMetadata: Record<string, any> | null;

  // Settings (embedded — no separate CompanySettings table)
  defaultCurrency: string;             // Default: "BRL"
  fiscalYearEnd: string;               // MM-DD format, default: "12-31"
  timezone: string;                    // Default: "America/Sao_Paulo"
  locale: string;                      // Default: "pt-BR"

  // Smart Contract (see company-blockchain-admin.md)
  contractAddress: string | null;      // OCP contract address (set after deployment)

  // Audit
  createdById: string;                 // User ID of the creator
  createdAt: Date;
  updatedAt: Date;
}

enum CompanyEntityType {
  LTDA = 'LTDA',
  SA_CAPITAL_FECHADO = 'SA_CAPITAL_FECHADO',
  SA_CAPITAL_ABERTO = 'SA_CAPITAL_ABERTO',
}

enum CompanyStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISSOLVED = 'DISSOLVED',
}
```

**Note**: The CompanyMember, InvitationToken, and related membership data models are defined in `company-membership.md`.

---

## API Endpoints

### POST /api/v1/companies
**Description**: Create a new company. Returns company in DRAFT status and kicks off async CNPJ validation via Bull job.

**Auth**: Required (Privy JWT). User must have approved KYC.

**Request**:
```json
{
  "name": "Acme Tecnologia",
  "entityType": "LTDA",
  "cnpj": "12.345.678/0001-90",
  "description": "Startup de tecnologia focada em SaaS B2B",
  "foundedDate": "2022-03-15",
  "settings": {
    "defaultCurrency": "BRL",
    "fiscalYearEnd": "12-31",
    "timezone": "America/Sao_Paulo",
    "locale": "pt-BR"
  }
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "comp_abc123",
    "name": "Acme Tecnologia",
    "entityType": "LTDA",
    "cnpj": "12.345.678/0001-90",
    "description": "Startup de tecnologia focada em SaaS B2B",
    "logoUrl": null,
    "foundedDate": "2022-03-15",
    "status": "DRAFT",
    "cnpjValidatedAt": null,
    "cnpjData": null,
    "contractAddress": null,
    "defaultCurrency": "BRL",
    "fiscalYearEnd": "12-31",
    "timezone": "America/Sao_Paulo",
    "locale": "pt-BR",
    "createdById": "user_xyz789",
    "createdAt": "2026-02-23T10:00:00Z",
    "updatedAt": "2026-02-23T10:00:00Z",
    "setupStatus": {
      "cnpjValidation": "PENDING",
      "contractDeployment": "PENDING"
    }
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid CNPJ format or missing required fields
- `401 Unauthorized` — Missing or invalid auth token
- `403 Forbidden` — User KYC not approved
- `409 Conflict` — CNPJ already registered to another company
- `422 Unprocessable Entity` — User has no wallet address
- `422 Unprocessable Entity` — User has reached the 20-company membership limit

**Validation Rules**:
- `name`: required, 2-200 characters
- `entityType`: required, one of `LTDA`, `SA_CAPITAL_FECHADO`, `SA_CAPITAL_ABERTO`
- `cnpj`: required, valid CNPJ format (XX.XXX.XXX/XXXX-XX), passes checksum validation
- `description`: optional, max 2000 characters
- `foundedDate`: optional, ISO 8601 date, must not be in the future

---

### GET /api/v1/companies
**Description**: List all companies the authenticated user belongs to.

**Auth**: Required. No `X-Company-Id` header needed.

**Query Parameters**:
- `status` (optional): Filter by company status (e.g., `?status=ACTIVE`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "comp_abc123",
      "name": "Acme Tecnologia",
      "entityType": "LTDA",
      "cnpj": "12.345.678/0001-90",
      "status": "ACTIVE",
      "logoUrl": "https://s3.amazonaws.com/navia/logos/acme.png",
      "role": "ADMIN",
      "memberCount": 5
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

### GET /api/v1/companies/:id
**Description**: Get full company details. If the company is in DRAFT status, includes setup progress.

**Auth**: Required. User must be a member of the company.

**Response** (200 OK — ACTIVE company): Returns full Company entity with cnpjData and contractAddress.

**Response** (200 OK — DRAFT company): Includes additional `setupStatus` object (see `company-cnpj-validation.md` for details).

**Error Responses**:
- `401 Unauthorized` — Missing or invalid auth token
- `403 Forbidden` — User is not a member of this company
- `404 Not Found` — Company does not exist

---

### PUT /api/v1/companies/:id
**Description**: Update company details. Only ADMIN members can update.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

**Request**:
```json
{
  "name": "Acme Tecnologia Ltda.",
  "description": "Updated description",
  "logoUrl": "https://s3.amazonaws.com/navia/logos/acme-v2.png",
  "settings": {
    "defaultCurrency": "BRL",
    "fiscalYearEnd": "03-31",
    "timezone": "America/Sao_Paulo",
    "locale": "pt-BR"
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid field values
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Company not found
- `422 Unprocessable Entity` — Cannot update DISSOLVED company

**Note**: `entityType` and `cnpj` cannot be changed after company has shareholders (see BR-5).

---

### DELETE /api/v1/companies/:id
**Description**: Archive (dissolve) a company. Sets status to DISSOLVED. This is a soft delete — data is preserved but read-only.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

**Error Responses**:
- `403 Forbidden` — User is not ADMIN
- `422 Unprocessable Entity` — Company has active shareholders (must remove all shareholders first)
- `422 Unprocessable Entity` — Company has active funding rounds

**Note**: Member management endpoints (invite, list, update role, remove) are defined in `company-membership.md`. Setup status polling endpoint is defined in `company-cnpj-validation.md`.

---

## Lifecycle State Machine

```
                    CNPJ validation +
                    contract deployment
  +---------+      succeeds             +---------+
  |  DRAFT  | ----------------------->  |  ACTIVE |
  +---------+                           +---------+
                                         |       ^
                                         |       |
                              deactivate |       | re-activate
                                         v       |
                                        +-----------+
                                        |  INACTIVE |
                                        +-----------+
                                         |
                        dissolve         |     dissolve
              ACTIVE -----------------> DISSOLVED <--- INACTIVE
                                        (permanent, read-only)
```

### State Descriptions

| State | Description | Allowed Operations |
|-------|-------------|-------------------|
| `DRAFT` | Company created, CNPJ validation in progress | Update company details, view setup status. No shareholders, transactions, or documents. |
| `ACTIVE` | Company fully operational | All operations: shareholders, transactions, documents, cap table, etc. |
| `INACTIVE` | Temporarily suspended | Read-only for data. No new transactions. Admin can re-activate. |
| `DISSOLVED` | Permanently closed | Fully read-only. No writes except audit logs. Cannot transition back. |

---

## User Flows

### Flow 1: Company Creation

```
PRECONDITION: User is authenticated and KYC approved

1. User navigates to "Create Company" page
2. User enters company details:
   - Company name
   - Entity type (Ltda. or S.A.)
   - CNPJ
   - Optional: description, founding date
3. Frontend validates CNPJ format (client-side check digits)
4. User clicks "Create Company"
5. Frontend sends POST /api/v1/companies
6. Backend validates:
   - User has approved KYC
   - User has a wallet address
   - CNPJ format is valid
   - CNPJ is not already registered
7. Backend creates Company (status: DRAFT)
8. Backend creates CompanyMember (role: ADMIN, status: ACTIVE) for the creator
9. Backend dispatches Bull job: CnpjValidationJob (see company-cnpj-validation.md)
10. Backend returns company with status DRAFT
11. Frontend redirects to company dashboard with setup progress indicator
12. Frontend polls GET /api/v1/companies/:id/setup-status every 3 seconds
13. Frontend detects status change via polling
14. Frontend shows "Company created successfully!" with contract address

POSTCONDITION: Company is ACTIVE, smart contract deployed, creator is ADMIN
```

### Flow 2: Company Context Switching

```
PRECONDITION: User belongs to multiple companies

1. User is viewing Company A's dashboard
2. User clicks company selector in the navigation bar
3. Dropdown shows all user's companies with logos and roles
4. User selects Company B
5. Frontend updates:
   a. Stores Company B's ID in localStorage
   b. Sets X-Company-Id header to Company B's ID on API client
   c. Invalidates all TanStack Query caches
   d. Re-fetches dashboard data for Company B
6. Navigation bar shows Company B's name and logo
7. Dashboard displays Company B's data

POSTCONDITION: All API calls now scoped to Company B
```

### Flow 3: Company Dissolution

```
PRECONDITION: Company is ACTIVE or INACTIVE, user is ADMIN

1. Admin navigates to "Settings" -> "Company" -> "Dissolve Company"
2. Frontend shows dissolution requirements:
   - Zero active shareholders
   - No active funding rounds
   - No pending option exercises
3. If prerequisites NOT met:
   - Frontend shows which requirements are not met
   - Admin must resolve each before proceeding
4. If prerequisites met:
   - Frontend shows confirmation modal:
     "This action is permanent. All company data will become read-only."
   - Admin types company name to confirm
   - Admin clicks "Dissolve Company"
5. Frontend sends DELETE /api/v1/companies/:id
6. Backend validates prerequisites
7. Backend transitions Company status to DISSOLVED
8. Backend sends notification to all active members
9. Frontend redirects to company list
10. DISSOLVED company appears grayed out in company selector

POSTCONDITION: Company is DISSOLVED, all data read-only
```

---

## Business Rules

### BR-1: Company Dissolution Prerequisites
- Company MUST have zero active shareholders before dissolution
- All active funding rounds must be closed or cancelled
- All pending option exercises must be resolved
- DISSOLVED status is permanent — no transition back to ACTIVE

### BR-2: DISSOLVED Company Read-Only
- DISSOLVED companies are fully read-only
- No new transactions, shareholders, funding rounds, or documents can be created
- Existing data remains accessible for audit and compliance purposes
- Audit logs can still be written

### BR-3: INACTIVE Company Restrictions
- INACTIVE companies block new transactions (issuances, transfers, conversions)
- Read access is preserved for all members
- Existing pending transactions are paused (not cancelled)
- Admin can re-activate to resume operations

### BR-4: Company Creator Auto-Assignment
- The user who creates a company is automatically assigned the ADMIN role (see `company-membership.md`)
- A CompanyMember record with status `ACTIVE` is created during company creation

### BR-5: Entity Type Immutability After Shareholders
- `entityType` cannot be changed after the company has any shareholders
- `cnpj` cannot be changed after company status moves to ACTIVE
- These fields can be updated while the company is in DRAFT status

### BR-6: Maximum Companies Per User
- A user can be a member of at most **20 companies** (PENDING + ACTIVE memberships)
- Company creation and invitation acceptance MUST check this limit
- REMOVED memberships do not count toward the limit

---

## Edge Cases & Error Handling

### EC-1: Company with Active Funding Round Cannot Be Dissolved
**Scenario**: Admin tries to dissolve company while a funding round is OPEN.
**Handling**:
- Backend checks for active funding rounds before dissolution
- Returns `422 Unprocessable Entity` with error code `COMPANY_HAS_ACTIVE_ROUNDS`
- Error message includes the active round IDs
- Admin must close or cancel all rounds first

**Note**: CNPJ validation edge cases are documented in `company-cnpj-validation.md`. Membership edge cases (invitation expiry, last admin, duplicate invitations) are documented in `company-membership.md`. Blockchain edge cases (contract deployment failure, admin transfer) are documented in `company-blockchain-admin.md`.

---

## Security Considerations

### SEC-1: Company Data Isolation
- `X-Company-Id` header MUST be validated against user's active memberships on every request
- Prisma middleware MUST enforce company scoping on all company-scoped models
- Cross-company data leakage MUST be prevented at the database query level
- No API endpoint should return data from a company the user does not belong to

**Note**: Invitation token security, admin role security, and blockchain admin security are documented in their respective extracted specifications.

---

## Technical Implementation

### CompanyService — Company Creation

```typescript
// /backend/src/company/company.service.ts
import { Injectable, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class CompanyService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('company-setup') private companySetupQueue: Queue,
  ) {}

  async create(userId: string, dto: CreateCompanyDto) {
    // Validate user has wallet address
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.walletAddress) {
      throw new ForbiddenException('User must have a wallet address to create a company');
    }

    // Check CNPJ uniqueness
    const existingCompany = await this.prisma.company.findUnique({
      where: { cnpj: dto.cnpj },
    });
    if (existingCompany) {
      throw new ConflictException('CNPJ already registered to another company');
    }

    // Create company + admin member in a transaction
    const company = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: dto.name,
          entityType: dto.entityType,
          cnpj: dto.cnpj,
          description: dto.description,
          foundedDate: dto.foundedDate,
          status: 'DRAFT',
          defaultCurrency: dto.settings?.defaultCurrency ?? 'BRL',
          fiscalYearEnd: dto.settings?.fiscalYearEnd ?? '12-31',
          timezone: dto.settings?.timezone ?? 'America/Sao_Paulo',
          locale: dto.settings?.locale ?? 'pt-BR',
          createdById: userId,
        },
      });

      // Auto-assign creator as ADMIN (see company-membership.md)
      await tx.companyMember.create({
        data: {
          companyId: company.id,
          userId: userId,
          email: user.email,
          role: 'ADMIN',
          status: 'ACTIVE',
          invitedBy: userId,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
      });

      return company;
    });

    // Dispatch async CNPJ validation job (see company-cnpj-validation.md)
    await this.companySetupQueue.add('validate-cnpj', {
      companyId: company.id,
      cnpj: dto.cnpj,
      creatorWalletAddress: user.walletAddress,
    });

    return company;
  }
}
```

### CompanyGuard — Middleware for X-Company-Id Validation

```typescript
// /backend/src/company/guards/company.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const companyId = request.headers['x-company-id'];

    if (!companyId) {
      throw new ForbiddenException('X-Company-Id header is required');
    }

    const userId = request.user.id;

    // Validate user is an active member of the company
    const membership = await this.prisma.companyMember.findFirst({
      where: {
        companyId,
        userId,
        status: 'ACTIVE',
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You are not an active member of this company',
      );
    }

    // Attach company and membership to request for downstream use
    request.company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    request.membership = membership;

    return true;
  }
}
```

### Company Scoping Prisma Middleware

```typescript
// /backend/src/prisma/company-scope.middleware.ts
import { Prisma } from '@prisma/client';

// Models that are company-scoped
const COMPANY_SCOPED_MODELS = [
  'Shareholder',
  'ShareClass',
  'Shareholding',
  'Transaction',
  'FundingRound',
  'OptionPlan',
  'OptionGrant',
  'Document',
  'Notification',
];

export function companyScope(companyId: string): Prisma.Middleware {
  return async (params, next) => {
    if (COMPANY_SCOPED_MODELS.includes(params.model)) {
      // Inject companyId into where clauses for reads
      if (['findMany', 'findFirst', 'count', 'aggregate'].includes(params.action)) {
        params.args.where = {
          ...params.args.where,
          companyId,
        };
      }
      // Inject companyId into create data
      if (['create', 'createMany'].includes(params.action)) {
        if (params.action === 'create') {
          params.args.data.companyId = companyId;
        }
      }
    }
    return next(params);
  };
}
```

---

## Success Criteria

### Performance
- Company creation (form submit to DRAFT response): < 500ms
- Company list API response: < 200ms
- Company context switch (full dashboard reload): < 2 seconds

### Accuracy
- Zero cross-company data leakage (verified via integration tests)
- Zero orphan companies (every company has at least one ADMIN)

### User Experience
- Company creation flow: < 5 steps
- Company switching: 1 click from navigation bar
- Setup progress visible in real-time during async creation

---

## Dependencies

### Internal Dependencies
- **company-membership.md**: Member invitation, acceptance, role management, CompanyMember and InvitationToken entities
- **company-cnpj-validation.md**: Async CNPJ validation via Verifik, Bull job, setup-status endpoint
- **company-blockchain-admin.md**: Creator wallet as smart contract admin, contract deployment, ownership transfer
- **authentication.md**: User entity with `walletAddress` field — used as smart contract admin
- **user-permissions.md**: Role definitions (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE) and permission matrix
- **blockchain-integration.md**: OCP smart contract deployment during company setup
- **notifications.md**: Email templates for status changes and member notifications

### External Dependencies
- **Verifik**: CNPJ validation against Receita Federal (see `company-cnpj-validation.md`)
- **AWS SES**: Status notification emails
- **Bull (Redis-backed)**: Background job processing for CNPJ validation and contract deployment
- **Base Network**: OCP smart contract deployment (see `company-blockchain-admin.md`)

---

## Resolved Design Decisions

### RD-1: Smart Contract Admin Transfer — YES
When the ADMIN role is transferred to another user, the on-chain smart contract owner MUST also transfer. See `company-blockchain-admin.md` for full details.

### RD-2: CompanyKYC and CNPJ Validation — MERGED
CNPJ validation during company creation and the KYC spec's CNPJ verification are merged into a single flow. See `company-cnpj-validation.md` for the canonical CNPJ validation path.

### RD-3: Maximum Companies Per User — 20
A user can create or belong to a maximum of **20 companies**. The limit applies to active memberships (PENDING + ACTIVE CompanyMember records). REMOVED memberships do not count. See `company-membership.md` for enforcement details.

### RD-4: INACTIVE to ACTIVE Re-Validation — NO
Re-activating an INACTIVE company does NOT require re-validation of the CNPJ. The original validation is sufficient. Re-activation is instant.

### RD-5: Multiple ADMINs and Smart Contract — CREATOR ONLY
Only the company creator's wallet controls the smart contract. Other ADMIN users have platform-level permissions only. See `company-blockchain-admin.md` for full details.

### RD-6: Invitation Email Mismatch — ALLOWED
Users CAN accept an invitation with a different email than it was sent to. See `company-membership.md` for full details.

---

## Related Specifications

*Cross-references to be completed in Phase 5 of the spec alignment project.*
