# Company Management Specification

**Topic of Concern**: Company creation, lifecycle management, and settings

**One-Sentence Description**: The system manages Brazilian company entities (Ltda. and S.A.) with CNPJ validation, lifecycle state machine (DRAFT -> ACTIVE -> INACTIVE -> DISSOLVED), and company settings scoped through the creating user's embedded wallet as the on-chain admin.

---

## Overview

The Company entity is the root entity in Navia — every feature (shareholders, cap table, transactions, documents, option plans) is company-scoped. A company represents a Brazilian legal entity, either a Sociedade Limitada (Ltda.) or a Sociedade Anônima (S.A.), that uses the platform to manage its cap table with on-chain record-keeping.

### Brazilian Entity Types

**Sociedade Limitada (Ltda.)** is the most common business entity in Brazil, equivalent to an LLC. Members hold quotas (quotas sociais) with equal rights per quota. Governed by Articles 1.052-1.087 of the Brazilian Civil Code (Lei 10.406/2002).

**Sociedade Anônima (S.A.)** is a corporation governed by Lei 6.404/1976 (Lei das S.A.). S.A. companies can be capital aberto (publicly traded) or capital fechado (privately held). They issue shares (acoes) that can be common (ordinarias - ON) or preferred (preferenciais - PN) with distinct rights.

### Multi-Company Support

> **Future Enhancement — not implemented for MVP (one company per user).** The MVP enforces one company per user. Company creation occurs during onboarding (Step 2 of the wizard). There is no company switcher in the navigation. The API architecture uses `:companyId` URL path parameters for forward compatibility, but the frontend always uses the single company associated with the authenticated user.

A single user can belong to multiple companies with different roles in each. The platform supports company context switching — the active company is identified by the `:companyId` URL path parameter on all company-scoped API requests (e.g., `/api/v1/companies/:companyId/shareholders`). All data queries are scoped to the active company via Prisma middleware, ensuring strict data isolation.

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
> **Future Enhancement — not implemented for MVP (one company per user).** The MVP supports only one company per user. No company switcher is rendered.

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

### FR-3: Multi-Company Support with URL Path Scoping
> **Future Enhancement — the MVP enforces one company per user.** The URL path scoping is retained for API architecture forward-compatibility. The frontend reads the user's single company ID from the auth context and uses it in all API calls.

- All company-scoped API endpoints MUST use the `:companyId` URL path parameter (e.g., `/api/v1/companies/:companyId/shareholders`)
- System MUST validate that the authenticated user is an active member of the specified company
- System MUST return `404 Not Found` if the user is not a member of the specified company (prevents enumeration — see `security.md`)
- System MUST scope all database queries to the company specified in the URL path via Prisma middleware
- System MUST support the `/api/v1/companies` endpoint without a company path parameter (user-scoped, lists all companies)
- System MUST enforce a maximum of **20 companies** per user (PENDING + ACTIVE memberships)

### FR-4: Company Context Switching in Frontend
> **Future Enhancement — not implemented for MVP (one company per user).** The MVP does not render a company selector. The user's single company ID is stored in `AuthContext` after onboarding and used for all API calls. The requirements below describe the future multi-company behavior.

- Frontend MUST display a company selector in the navigation bar
- Selecting a company MUST update the active company ID used in API URL paths for all subsequent API calls
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

**Auth**: Required. No company path parameter needed (user-scoped).

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
    "totalPages": 1
  }
}
```

---

### GET /api/v1/companies/:companyId
**Description**: Get full company details. If the company is in DRAFT status, includes setup progress.

**Auth**: Required. User must be a member of the company (`:companyId` in URL path).

**Response** (200 OK — ACTIVE company): Returns full Company entity with cnpjData and contractAddress.

**Response** (200 OK — DRAFT company): Includes additional `setupStatus` object (see `company-cnpj-validation.md` for details).

**Error Responses**:
- `401 Unauthorized` — Missing or invalid auth token
- `404 Not Found` — Company does not exist or user is not a member (prevents enumeration)

---

### PUT /api/v1/companies/:companyId
**Description**: Update company details. Only ADMIN members can update.

**Auth**: Required. User must be an active member of the company (`:companyId` in URL path). User must be ADMIN.

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
- `404 Not Found` — Company not found or user is not a member
- `403 Forbidden` — User is a member but not ADMIN
- `422 Unprocessable Entity` — Cannot update DISSOLVED company

**Note**: `entityType` and `cnpj` cannot be changed after company has shareholders (see BR-5).

---

### DELETE /api/v1/companies/:companyId
**Description**: Archive (dissolve) a company. Sets status to DISSOLVED. This is a soft delete — data is preserved but read-only.

**Auth**: Required. User must be an active member of the company (`:companyId` in URL path). User must be ADMIN.

**Error Responses**:
- `404 Not Found` — Company not found or user is not a member
- `403 Forbidden` — User is a member but not ADMIN
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

> **Future Enhancement — not implemented for MVP (one company per user).** The MVP does not render a company selector. The user's single company ID is stored in `AuthContext`.

```
PRECONDITION: User belongs to multiple companies

1. User is viewing Company A's dashboard
2. User clicks company selector in the navigation bar
3. Dropdown shows all user's companies with logos and roles
4. User selects Company B
5. Frontend updates:
   a. Stores Company B's ID in localStorage
   b. Updates the active companyId used in API URL paths (e.g., `/api/v1/companies/{companyBId}/...`)
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
5. Frontend sends DELETE /api/v1/companies/:companyId
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
> **Future Enhancement — not enforced in MVP (one company per user).** The backend validation remains in place for forward compatibility, but the MVP frontend only creates one company during onboarding.

- A user can be a member of at most **20 companies** (PENDING + ACTIVE memberships)
- Company creation and invitation acceptance MUST check this limit
- REMOVED memberships do not count toward the limit

---

## Edge Cases & Error Handling

### EC-1: Company with Active Funding Round Cannot Be Dissolved
**Scenario**: Admin tries to dissolve company while a funding round is OPEN.
**Handling**:
- Backend checks for active funding rounds before dissolution.
- Returns `422 Unprocessable Entity` with error code `COMPANY_HAS_ACTIVE_ROUNDS` and messageKey `errors.company.hasActiveRounds`.
- `details` field includes the active round IDs.
- Admin must close or cancel all rounds first.

**Note**: CNPJ validation edge cases are documented in `company-cnpj-validation.md`. Membership edge cases (invitation expiry, last admin, duplicate invitations) are documented in `company-membership.md`. Blockchain edge cases (contract deployment failure, admin transfer) are documented in `company-blockchain-admin.md`.

---

## Security Considerations

### SEC-1: Company Data Isolation
- The `:companyId` URL path parameter MUST be validated against the user's active memberships on every request
- Non-members MUST receive `404 Not Found` (not `403 Forbidden`) to prevent company ID enumeration
- Prisma middleware MUST enforce company scoping on all company-scoped models
- Cross-company data leakage MUST be prevented at the database query level
- No API endpoint should return data from a company the user does not belong to

**Note**: Invitation token security, admin role security, and blockchain admin security are documented in their respective extracted specifications.

---

## Technical Implementation

### CompanyService — Company Creation

```typescript
// /backend/src/company/company.service.ts
import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { AppException, ConflictException } from '../common/exceptions/app.exception';

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
      throw new AppException(
        'AUTH_NO_WALLET',
        'errors.auth.noWallet',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Check CNPJ uniqueness
    const existingCompany = await this.prisma.company.findUnique({
      where: { cnpj: dto.cnpj },
    });
    if (existingCompany) {
      throw new ConflictException(
        'COMPANY_CNPJ_DUPLICATE',
        'errors.company.cnpjDuplicate',
        { cnpj: dto.cnpj },
      );
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

### CompanyGuard — Middleware for `:companyId` URL Path Validation

```typescript
// /backend/src/company/guards/company.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClsService } from 'nestjs-cls';
import { NotFoundException } from '../../common/exceptions/app.exception';

@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private cls: ClsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const companyId = request.params.companyId;

    if (!companyId) {
      // Endpoint does not have :companyId in the URL — skip company scoping
      return true;
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
      // Return 404 instead of 403 to prevent company ID enumeration (see security.md)
      throw new NotFoundException('company', companyId);
    }

    // Attach company and membership to request for downstream use
    request.company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    request.companyMember = membership;

    // Store companyId in AsyncLocalStorage for Prisma middleware scoping
    this.cls.set('companyId', companyId);

    return true;
  }
}
```

### Company Scoping via Prisma Client Extension

The `companyId` is extracted from the URL path parameter by the `CompanyGuard` and stored in `AsyncLocalStorage` via `@nestjs-cls/core` (`ClsService`). The Prisma extension reads it from the CLS context to enforce company scoping on all queries.

> **Note**: Prisma's `$use` middleware is deprecated in favor of [Prisma Client extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions). The actual implementation uses `$extends` with a `query` component. The middleware-style pseudocode below illustrates the scoping logic for clarity; the production code uses the extension API.

```typescript
// /backend/src/prisma/company-scope.extension.ts
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

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

/**
 * Creates a Prisma Client extension that automatically injects companyId
 * from AsyncLocalStorage (via ClsService) into all queries on
 * company-scoped models.
 *
 * Usage in PrismaService:
 *   const extendedClient = prismaClient.$extends(companyScopeExtension(cls));
 */
export function companyScopeExtension(cls: ClsService) {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      query: {
        $allOperations({ model, operation, args, query }) {
          const companyId = cls.get('companyId');

          if (!companyId || !COMPANY_SCOPED_MODELS.includes(model)) {
            return query(args);
          }

          // Inject companyId into where clauses for reads
          if (['findMany', 'findFirst', 'count', 'aggregate'].includes(operation)) {
            args.where = {
              ...args.where,
              companyId,
            };
          }

          // Inject companyId into create data
          if (operation === 'create') {
            args.data = {
              ...args.data,
              companyId,
            };
          }

          return query(args);
        },
      },
    });
  });
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
- Company switching: 1 click from navigation bar *(Future Enhancement — not implemented for MVP)*
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

---
---

# Frontend Specification

This section defines the frontend architecture, components, user flows, UI states, integration patterns, and i18n keys for company management. The backend specification above remains the source of truth for API contracts, business rules, and security requirements.

**MVP Constraint**: One company per user. Company creation happens during onboarding (Step 2 of the wizard, defined in `authentication.md`). There is no company switcher, no company list page, and no multi-company navigation in the MVP.

---

## Table of Contents (Frontend)

1. [Frontend Architecture](#frontend-architecture)
2. [Page Routes](#page-routes)
3. [Component Hierarchy](#component-hierarchy)
4. [Component Specifications](#component-specifications)
5. [Frontend User Flows](#frontend-user-flows)
6. [UI States and Error Handling](#ui-states-and-error-handling)
7. [TanStack Query Integration](#tanstack-query-integration)
8. [i18n Keys](#i18n-keys)
9. [Frontend Success Criteria](#frontend-success-criteria)

---

## Frontend Architecture

### MVP Scope

The company management frontend consists of two primary surfaces:

1. **Onboarding Step 2** (`/onboarding`) -- Company creation as part of the onboarding wizard. This is the only place where a company is created in the MVP.
2. **Company Settings** (`/dashboard/settings`) -- View and edit company information, access danger zone for dissolution.

There is no standalone "Create Company" page, no company list page, and no company switcher in the MVP. The `GET /api/v1/companies` endpoint is used only by the `AuthContext` to resolve the user's single company on login.

### State Management

The company ID is managed by `AuthContext` (defined in `authentication.md`):

```typescript
interface AuthContextValue {
  user: User | null;
  companyId: string | null;     // The user's single company ID
  hasCompany: boolean;           // true after onboarding Step 2 completes
  isLoading: boolean;
  needsOnboarding: boolean;
  // ... other auth fields
}
```

All company-scoped API calls use `companyId` from `AuthContext`:

```typescript
const { companyId } = useAuth();
// GET /api/v1/companies/{companyId}/shareholders
```

---

## Page Routes

| Route | Layout | Auth | Description |
|-------|--------|------|-------------|
| `/onboarding` | Auth layout (centered card, gray-50 bg) | Yes (Privy) | Multi-step wizard. Step 2 is company creation. Defined in `authentication.md`. |
| `/dashboard/settings` | Dashboard shell (sidebar + top bar) | Yes + completed onboarding | Company settings page with tabbed navigation. |

### Route Protection

```
/dashboard/settings
  │
  ├─ [not authenticated] ─→ redirect to /login
  ├─ [authenticated, no company] ─→ redirect to /onboarding
  └─ [authenticated, has company] ─→ render CompanySettingsPage
```

---

## Component Hierarchy

```
app/(onboarding)/onboarding/page.tsx ─→ OnboardingWizard
  ├─ OnboardingStepper
  ├─ PersonalInfoStep (Step 1) ─→ defined in authentication.md
  └─ CompanyCreationStep (Step 2)
       ├─ EntityTypeSelector
       └─ CNPJInput

app/(dashboard)/settings/page.tsx ─→ CompanySettingsPage
  ├─ SettingsTabs (vertical tab navigation)
  ├─ CompanyInfoForm (tab: "Informacoes da Empresa")
  │    ├─ EntityTypeSelector (read-only after shareholders exist)
  │    └─ CNPJInput (always read-only)
  ├─ MembersTabLink (tab: "Membros" — links to /dashboard/members)
  ├─ NotificationsTab (tab: "Notificacoes")
  └─ DangerZone
       └─ CompanyDissolutionDialog

components/company/company-setup-progress.tsx ─→ CompanySetupProgress
  └─ (rendered on /dashboard when company is in DRAFT status)

components/company/company-status-badge.tsx ─→ CompanyStatusBadge
```

### Component Registry

| Component | File | Description |
|-----------|------|-------------|
| `CompanyCreationStep` | `components/onboarding/company-creation-step.tsx` | Step 2 of onboarding wizard |
| `CNPJInput` | `components/ui/cnpj-input.tsx` | Reusable masked CNPJ input |
| `EntityTypeSelector` | `components/company/entity-type-selector.tsx` | Radio group for entity type |
| `CompanySetupProgress` | `components/company/company-setup-progress.tsx` | Post-creation async status card |
| `CompanySettingsPage` | `app/(dashboard)/settings/page.tsx` | Full settings page |
| `CompanyInfoForm` | `components/company/company-info-form.tsx` | Editable company info form |
| `CompanyStatusBadge` | `components/company/company-status-badge.tsx` | Status badge component |
| `CompanyDissolutionDialog` | `components/company/company-dissolution-dialog.tsx` | Dissolution confirmation modal |

---

## Component Specifications

### 1. CompanyCreationStep (Step 2 of Onboarding)

**File**: `components/onboarding/company-creation-step.tsx`

**Props**:
```typescript
interface CompanyCreationStepProps {
  onComplete: () => void;  // Called after successful company creation
}
```

**Visual Structure**:
```
+----------------------------------------------+
|                                              |
|   Sua Empresa                                |  <- h3 (20px, weight 600), navy-900
|   Configure sua empresa para gerenciar       |  <- body (14px), gray-500, mb-24px
|   o cap table                                |
|                                              |
|   Nome da Empresa *                          |  <- label: body-sm (13px), weight 500, gray-700
|   +--------------------------------------+   |
|   | Ex: Acme Tecnologia Ltda.            |   |  <- text input, placeholder gray-400
|   +--------------------------------------+   |
|                                              |
|   Tipo de Entidade *                         |  <- label
|   +--------------------------------------+   |
|   | (*) Limitada (Ltda.)                 |   |  <- radio card, selected state
|   |     Sociedade limitada com quotas    |   |  <- description, body-sm, gray-500
|   +--------------------------------------+   |
|   +--------------------------------------+   |
|   | ( ) S.A. Capital Fechado             |   |  <- radio card
|   |     Sociedade anonima de capital     |   |
|   |     fechado                          |   |
|   +--------------------------------------+   |
|   +--------------------------------------+   |
|   | ( ) S.A. Capital Aberto              |   |  <- radio card
|   |     Sociedade anonima de capital     |   |
|   |     aberto                           |   |
|   +--------------------------------------+   |
|                                              |
|   CNPJ *                                     |  <- label
|   +--------------------------------------+   |
|   | XX.XXX.XXX/XXXX-XX                   |   |  <- CNPJInput (masked)
|   +--------------------------------------+   |
|   Sera validado automaticamente              |  <- helper text, caption (12px), gray-500
|                                              |
|   Descricao                                  |  <- label (no asterisk — optional)
|   +--------------------------------------+   |
|   | Descreva brevemente sua empresa      |   |  <- textarea, 4 rows
|   |                                      |   |
|   +--------------------------------------+   |
|                                              |
|   Data de Fundacao                           |  <- label (optional)
|   +--------------------------------------+   |
|   | DD/MM/AAAA                           |   |  <- date picker, Brazilian format
|   +--------------------------------------+   |
|                                              |
|   +--------------------------------------+   |
|   |          Criar Empresa               |   |  <- Primary button, full width, size lg
|   +--------------------------------------+   |
|                                              |
+----------------------------------------------+
```

**Container**: Follows OnboardingWizard card (max-width 640px, white bg, radius-xl, shadow-lg, padding 32px).

**Form Fields**:

| Field | Component | Required | Validation | Max Length |
|-------|-----------|----------|------------|-----------|
| `name` | Text input | Yes | Non-empty, 2-200 chars | 200 |
| `entityType` | EntityTypeSelector | Yes | One of LTDA, SA_CLOSED, SA_OPEN | -- |
| `cnpj` | CNPJInput | Yes | Format mask + Modulo 11 checksum (client), uniqueness (server) | 18 (formatted) |
| `description` | Textarea | No | Max 2000 chars | 2000 |
| `foundedDate` | Date picker | No | DD/MM/YYYY, must not be future | -- |

**Form Library**: React Hook Form with Zod resolver.

```typescript
const companyCreationSchema = z.object({
  name: z.string().min(2).max(200),
  entityType: z.enum(['LTDA', 'SA_CAPITAL_FECHADO', 'SA_CAPITAL_ABERTO']),
  cnpj: z.string().refine(isValidCNPJ, { message: 'errors.company.cnpjInvalid' }),
  description: z.string().max(2000).optional().or(z.literal('')),
  foundedDate: z.string().optional().refine(
    (val) => !val || !isFutureDate(val),
    { message: 'errors.company.futureDate' }
  ),
});
```

**Behavior**:

1. On mount: all fields empty, submit button disabled until required fields filled.
2. CNPJ field auto-masks as user types (see CNPJInput spec).
3. On CNPJ blur: validates Modulo 11 checksum. If invalid, shows inline error immediately.
4. On submit:
   - Client-side validation via Zod schema.
   - If invalid: show field-level errors, do not submit.
   - If valid: set submitting state, disable all fields, show spinner on button.
   - `POST /api/v1/companies` with `{ name, entityType, cnpj, description, foundedDate }`.
5. On success (201):
   - Updates `AuthContext`: `hasCompany = true`, `companyId = response.data.id`.
   - Calls `onComplete()` which triggers redirect to `/dashboard`.
6. On CNPJ duplicate (409):
   - Maps server error to CNPJ field: shows inline error `errors.company.cnpjDuplicate`.
   - Re-enables form, clears submitting state.
7. On validation error (400):
   - Maps `validationErrors` array to React Hook Form field errors via `applyServerErrors()`.
8. On server error (5xx):
   - Shows error toast via Sonner.
   - Re-enables form, clears submitting state.

**Spacing**:
- Gap between fields: `20px` (spacing-5).
- Title to subtitle: `4px`.
- Subtitle to first field: `24px` (spacing-6).
- Last field to submit button: `24px` (spacing-6).

---

### 2. CNPJInput (Reusable Masked Input)

**File**: `components/ui/cnpj-input.tsx`

**Props**:
```typescript
interface CNPJInputProps {
  value: string;                          // Raw digits or formatted string
  onChange: (value: string) => void;      // Returns formatted string XX.XXX.XXX/XXXX-XX
  onBlur?: () => void;                    // Triggers Modulo 11 validation
  error?: string;                         // Error message to display
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  name?: string;
}
```

**Visual**: Same as standard text input (design-system.md section 6.4):
- Height: `40px`
- Padding: `12px` horizontal, `8px` vertical
- Radius: `radius-md` (8px)
- Border: `1px solid gray-300` (default), `2px solid blue-600` (focus), `2px solid #DC2626` (error)
- Focus shadow: `0 0 0 3px blue-600/10%`
- Error shadow: `0 0 0 3px #DC2626/10%`

**Mask Behavior**:
- As the user types digits, automatically inserts `.`, `/`, and `-` at the correct positions.
- Pattern: `XX.XXX.XXX/XXXX-XX` (14 digits, 18 characters with separators).
- Non-digit characters are stripped on input.
- Backspace removes the last digit (not the separator).
- Paste: accepts raw digits (`12345678000190`) or formatted (`12.345.678/0001-90`) and normalizes.
- Display always shows the formatted version.

**Modulo 11 Validation** (client-side, on blur):

```typescript
function isValidCNPJ(cnpj: string): boolean {
  // Strip non-digits
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;

  // Reject all-same-digit CNPJs
  if (/^(\d)\1{13}$/.test(digits)) return false;

  // First check digit (position 13)
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const check1 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[12]) !== check1) return false;

  // Second check digit (position 14)
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weights2[i];
  }
  remainder = sum % 11;
  const check2 = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(digits[13]) !== check2) return false;

  return true;
}
```

**Error Display**:
- When `error` prop is set: red border (`2px solid #DC2626`), error text below the input.
- Error text: `caption` (12px), `#DC2626`, `4px` margin-top.
- Error text uses i18n key from the `error` prop value.

**Read-Only Mode** (used in CompanySettingsPage):
- Background: `gray-100`
- Border: `1px solid gray-200`
- Cursor: `default`
- No focus ring
- Text color: `gray-600`

---

### 3. EntityTypeSelector (Radio Group)

**File**: `components/company/entity-type-selector.tsx`

**Props**:
```typescript
interface EntityTypeSelectorProps {
  value: string | undefined;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
}
```

**Visual Structure** (3 stacked radio cards):
```
+----------------------------------------------+
| (*) Limitada (Ltda.)                          |  <- label: body (14px), weight 500
|     Sociedade limitada com quotas             |  <- description: body-sm (13px), gray-500
+----------------------------------------------+
     gap: 8px
+----------------------------------------------+
| ( ) S.A. Capital Fechado                      |
|     Sociedade anonima de capital fechado      |
+----------------------------------------------+
     gap: 8px
+----------------------------------------------+
| ( ) S.A. Capital Aberto                       |
|     Sociedade anonima de capital aberto       |
+----------------------------------------------+
```

**Options**:

| Value | Label (i18n key) | Description (i18n key) |
|-------|-------------------|------------------------|
| `LTDA` | `company.fields.entityType.ltda` | `company.fields.entityType.ltdaDescription` |
| `SA_CAPITAL_FECHADO` | `company.fields.entityType.saClosed` | `company.fields.entityType.saClosedDescription` |
| `SA_CAPITAL_ABERTO` | `company.fields.entityType.saOpen` | `company.fields.entityType.saOpenDescription` |

**Radio Card Styling**:

| State | Background | Border | Text |
|-------|-----------|--------|------|
| Default | `white` | `1px solid gray-200` | Label: `gray-700`, Description: `gray-500` |
| Hover | `gray-50` | `1px solid gray-300` | Same |
| Selected | `blue-50` | `2px solid blue-600` | Label: `blue-600`, Description: `gray-500` |
| Disabled | `gray-50` | `1px solid gray-200` | Label: `gray-400`, Description: `gray-400` |
| Error | Same as default | `2px solid #DC2626` | Same as default |

- Each card: `radius-md` (8px), padding `16px`, cursor pointer.
- Radio circle: `16px` diameter, standard radio appearance.
- Gap between label and description: `2px`.
- Gap between cards: `8px`.
- Error text below the entire group: `caption` (12px), `#DC2626`.

**Read-Only Mode** (used in CompanySettingsPage when company has shareholders):
- Selected card shows with `blue-50` bg but no hover effect.
- Cursor: `default`.
- Radio circle: filled but not interactive.
- Other cards: hidden (only show the selected value).

---

### 4. CompanySetupProgress (Post-Creation Status Card)

**File**: `components/company/company-setup-progress.tsx`

**Props**:
```typescript
interface CompanySetupProgressProps {
  companyId: string;
  onComplete?: () => void;  // Called when all items succeed
}
```

**When Rendered**: On the dashboard page (`/dashboard`) when the company's status is `DRAFT`. Placed at the top of the content area, above stat cards.

**Visual Structure**:
```
+----------------------------------------------+
|  Configurando sua empresa...                 |  <- h4 (16px, weight 600), gray-800
|                                              |
|  [spinner] Validacao do CNPJ       Pendente  |  <- item row
|  [spinner] Implantacao do Contrato Pendente  |  <- item row
|                                              |
+----------------------------------------------+
```

**Item States**:

| State | Icon | Text Color | Status Text |
|-------|------|------------|-------------|
| Pending | Gray spinner (16px, `gray-400` stroke) | `gray-500` | `company.setup.pending` |
| In Progress | Blue spinner (16px, `blue-600` stroke, animated) | `gray-700` | `company.setup.inProgress` |
| Success | Green check circle (16px, `green-700`) | `gray-700` | `company.setup.success` |
| Failed | Red X circle (16px, `#DC2626`) | `gray-700` | `company.setup.failed` + retry button |

**Retry Button**: Ghost variant, `blue-600` text, `body-sm` (13px). i18n: `company.setup.retry`.

**Card Styling**:
- Background: `white`
- Border: `1px solid gray-200`
- Radius: `radius-lg` (12px)
- Padding: `24px`
- Shadow: `shadow-sm`
- Width: 100% of content area

**Item Row Styling**:
- Height: `40px`
- Layout: flex, items-center, justify-between
- Left: icon (16px) + `8px` gap + item label (`body`, 14px)
- Right: status text (`body-sm`, 13px) or retry button
- Gap between rows: `8px`

**Polling Behavior**:
- Polls `GET /api/v1/companies/:companyId` every 5 seconds.
- Extracts `setupStatus.cnpjValidation` and `setupStatus.contractDeployment` from response.
- Maps status values: `PENDING` -> Pending, `IN_PROGRESS` -> In Progress, `SUCCESS` -> Success, `FAILED` -> Failed.
- Stops polling when all items are in terminal state (SUCCESS or FAILED).
- Uses TanStack Query with `refetchInterval: 5000` and `enabled: hasNonTerminalItem`.

**Auto-Dismiss**:
- When all items reach `SUCCESS`: show brief success animation (green check pulse), then auto-dismiss card after 3 seconds.
- Calls `onComplete()` callback (parent can trigger a refetch of company data).
- After dismissal, the dashboard renders normally (company is now ACTIVE).

**Failure Handling**:
- When an item reaches `FAILED`: stop polling for that item, show retry button.
- Retry button triggers:
  - For CNPJ validation: `POST /api/v1/companies/:companyId/validate-cnpj` (defined in `company-cnpj-validation.md`)
  - For contract deployment: `POST /api/v1/companies/:companyId/deploy-contract` (defined in `company-blockchain-admin.md`)
- After retry: item transitions back to `IN_PROGRESS`, polling resumes.

---

### 5. CompanySettingsPage

**File**: `app/(dashboard)/settings/page.tsx`

**Auth**: Requires authenticated user with a company. ADMIN role required for editing.

**Layout**: Dashboard shell layout (sidebar + top bar + content area).

**Visual Structure**:
```
+-----------------------------------------------------+
|  Configuracoes da Empresa              |             |  <- page header
|  Gerencie as informacoes da sua empresa|             |  <- body-sm, gray-500
+-----------------------------------------------------+

+-------------+------------------------------------+
|             |                                    |
| Informacoes |  [CompanyInfoForm]                 |  <- active tab content
| da Empresa  |                                    |
|             |                                    |
| Membros  -> |  (white card, radius-lg,           |
|             |   padding 24px, shadow-sm)          |
| Notificacoes|                                    |
|             |                                    |
+-------------+                                    |
              |                                    |
              |  --- Danger Zone ---               |  <- 32px margin-top
              |  [CompanyDissolutionDialog trigger] |
              |                                    |
              +------------------------------------+
```

**Page Header**:
- Title: `h1` (30px, weight 700), `navy-900`. i18n: `company.settings.title`.
- Description: `body-sm` (13px), `gray-500`. i18n: `company.settings.subtitle`.

**Tab Navigation**:
- **Desktop** (lg+): Vertical tabs on the left, `240px` wide.
- **Mobile/Tablet** (< lg): Horizontal tabs at the top, full width, scrollable.

**Tab Items**:

| Tab | i18n Key | Behavior |
|-----|----------|----------|
| Informacoes da Empresa | `company.settings.tabs.info` | Renders CompanyInfoForm |
| Membros | `company.settings.tabs.members` | Links to `/dashboard/members` (navigate, not a tab panel) |
| Notificacoes | `company.settings.tabs.notifications` | Renders notification preferences (future — placeholder in MVP) |

**Tab Item Styling**:

| State | Background | Text | Weight | Border |
|-------|-----------|------|--------|--------|
| Active | `blue-50` | `blue-600` | 600 | `2px left border blue-600` (desktop) or `2px bottom border blue-600` (mobile) |
| Inactive | Transparent | `gray-600` | 400 | None |
| Hover | `gray-50` | `gray-700` | 400 | None |

- Height: `44px`
- Padding: `12px 16px`
- Radius: `radius-md` (8px)
- Font: `body` (14px)

**Content Area**:
- Background: `white`
- Border: `1px solid gray-200`
- Radius: `radius-lg` (12px)
- Padding: `24px`
- Shadow: `shadow-sm`

**Danger Zone Section**:
- Separated from main content by `32px` margin-top.
- Background: `#FEF2F2` (red-50 tint)
- Border: `1px solid #FECACA` (red-200)
- Radius: `radius-lg` (12px)
- Padding: `24px`
- Title: `h4` (16px, weight 600), `#991B1B` (destructive text). i18n: `company.settings.dangerZone.title`.
- Warning text: `body-sm` (13px), `gray-500`. i18n: `company.settings.dangerZone.warning`.
- Dissolve button: Destructive variant, size `md`. i18n: `company.settings.dangerZone.dissolveButton`.
- Only visible to ADMIN role users. Hidden for other roles.

**Data Fetching**:
- On mount: `GET /api/v1/companies/:companyId` to load current company data.
- Uses TanStack Query: `useQuery({ queryKey: ['company', companyId], queryFn: ... })`.
- While loading: skeleton form (design-system.md section 6.9).

**Permission Handling**:
- Non-ADMIN users: form fields are read-only, danger zone is hidden, save button is hidden.
- ADMIN users: form fields are editable, danger zone is visible, save button is visible.
- Permission check uses `companyMember.role` from the auth context or from the company detail response.

---

### 6. CompanyInfoForm (Editable Form)

**File**: `components/company/company-info-form.tsx`

**Props**:
```typescript
interface CompanyInfoFormProps {
  company: Company;                    // Current company data
  isAdmin: boolean;                    // Whether user can edit
  onSave?: (data: UpdateCompanyDto) => Promise<void>;
}
```

**Form Fields**:

| Field | Component | Editable | Notes |
|-------|-----------|----------|-------|
| `name` | Text input | Yes (ADMIN) | Same validation as creation: 2-200 chars |
| `entityType` | EntityTypeSelector | Conditional | Read-only if company has shareholders (BR-5) |
| `cnpj` | CNPJInput | Never | Always read-only after creation. Display only. |
| `description` | Textarea | Yes (ADMIN) | Max 2000 chars |
| `foundedDate` | Date picker | Yes (ADMIN) | DD/MM/YYYY, must not be future |

**Additional Display Fields** (read-only, informational):

| Field | Display | Location |
|-------|---------|----------|
| Status | CompanyStatusBadge | Top of form, next to company name |
| CNPJ Validated At | Date string or "Pendente" | Below CNPJ field as helper text |
| Contract Address | Truncated address with copy button, or "Pendente" | Below form, informational card |

**Form Library**: React Hook Form with Zod resolver.

```typescript
const companyUpdateSchema = z.object({
  name: z.string().min(2).max(200),
  entityType: z.enum(['LTDA', 'SA_CAPITAL_FECHADO', 'SA_CAPITAL_ABERTO']).optional(),
  description: z.string().max(2000).optional().or(z.literal('')),
  foundedDate: z.string().optional().refine(
    (val) => !val || !isFutureDate(val),
    { message: 'errors.company.futureDate' }
  ),
});
```

**Behavior**:

1. On mount: pre-fills form with current company data.
2. CNPJ field rendered with `readOnly` prop. Always shows the stored CNPJ.
3. EntityType field: if company has shareholders (`hasShareholders` flag from API), render as read-only.
4. Save button: disabled until form is dirty (values differ from original).
5. On save:
   - Client-side validation via Zod.
   - `PUT /api/v1/companies/:companyId` with changed fields only.
   - On success (200): success toast `company.settings.saved`, update query cache.
   - On validation error (400): map to form fields.
   - On 422 (business rule): show error toast with message from `messageKey`.
   - On 404: redirect to `/dashboard` with error toast.

**Non-ADMIN View**:
- All fields rendered as read-only.
- Save button hidden.
- Danger zone section hidden.
- Helper text: "Somente administradores podem editar" / "Only administrators can edit" displayed at the top of the form (i18n: `company.settings.readOnlyHint`).

---

### 7. CompanyStatusBadge

**File**: `components/company/company-status-badge.tsx`

**Props**:
```typescript
interface CompanyStatusBadgeProps {
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'DISSOLVED';
}
```

**Badge Styles** (per design-system.md section 6.5):

| Status | Background | Text | i18n Key |
|--------|-----------|------|----------|
| `DRAFT` | `gray-100` (#F3F4F6) | `gray-600` (#4B5563) | `company.status.draft` |
| `ACTIVE` | `green-100` (#E8F5E4) | `green-700` (#6BAF5E) | `company.status.active` |
| `INACTIVE` | `cream-100` (#FAF4E3) | `cream-700` (#C4A44E) | `company.status.inactive` |
| `DISSOLVED` | `#FEE2E2` | `#991B1B` | `company.status.dissolved` |

**Styling**:
- Size: `caption` (12px), weight 500
- Padding: `2px 8px`
- Radius: `radius-full` (9999px, pill shape)
- No border

---

### 8. CompanyDissolutionDialog

**File**: `components/company/company-dissolution-dialog.tsx`

**Props**:
```typescript
interface CompanyDissolutionDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Visual Structure**:
```
+--------------------------------------------------+
|  Overlay: navy-900 at 50% opacity                 |
|                                                    |
|  +--------------------------------------------+   |
|  |  Dissolver Empresa               [X]       |   |  <- h3, close button
|  +--------------------------------------------+   |
|  |                                            |   |
|  |  [!] Esta acao e irreversivel.             |   |  <- warning icon + text
|  |  A empresa sera desativada permanente-     |   |
|  |  mente e todos os dados serao somente      |   |
|  |  leitura.                                  |   |
|  |                                            |   |
|  |  (blockers list, if any)                   |   |  <- conditional
|  |                                            |   |
|  |  Digite "Acme Tecnologia" para confirmar   |   |  <- confirmation label
|  |  +--------------------------------------+  |   |
|  |  |                                      |  |   |  <- text input
|  |  +--------------------------------------+  |   |
|  |                                            |   |
|  +--------------------------------------------+   |
|  |              [Cancelar]  [Dissolver]        |   |  <- footer with buttons
|  +--------------------------------------------+   |
|                                                    |
+--------------------------------------------------+
```

**Behavior**:

1. When dialog opens: fetch dissolution prerequisites.
   - `GET /api/v1/companies/:companyId/dissolution-prerequisites`
   - Response: `{ canDissolve: boolean, blockers: DissolutionBlocker[] }`
2. **If blockers exist** (`canDissolve: false`):
   - Show blockers list instead of confirmation input.
   - Each blocker: icon + description text.
   - Blocker types:
     - `ACTIVE_SHAREHOLDERS`: "Existem X acionistas ativos" (with count)
     - `ACTIVE_FUNDING_ROUNDS`: "Existem X rodadas de investimento ativas" (with count)
     - `PENDING_OPTION_EXERCISES`: "Existem X exercicios de opcoes pendentes" (with count)
     - `PENDING_TRANSACTIONS`: "Existem X transacoes pendentes" (with count)
   - "Dissolver" button is hidden. Only "Fechar" / "Close" button shown.
3. **If no blockers** (`canDissolve: true`):
   - Show confirmation input.
   - Label: "Digite '{company.name}' para confirmar" (i18n: `company.settings.dangerZone.confirmLabel` with `{name}` interpolation).
   - Input: standard text input, must exactly match company name (case-sensitive).
   - "Dissolver" button: Destructive variant, disabled until input matches company name.
4. On confirm:
   - `POST /api/v1/companies/:companyId/dissolve`
   - On success: close dialog, success toast, redirect to a "company dissolved" confirmation page.
   - On 422 (prerequisites changed): close dialog, show error toast, suggest refreshing.
   - On error: show error toast.

**Dialog Styling** (per design-system.md section 6.6):
- Overlay: `navy-900` at 50% opacity
- Container: white bg, `radius-lg` (12px), `shadow-xl`, max-width `560px`
- Header: `h3` (20px, weight 600), with close (X) button
- Body: `24px` padding, `body` (14px) text
- Footer: right-aligned buttons, `gray-100` bg strip, `16px` padding
- Warning icon: Lucide `AlertTriangle`, 24px, `#DC2626`
- Warning text: `body` (14px), `gray-700`
- Blocker list items: `body-sm` (13px), `gray-600`, Lucide `XCircle` icon in `#DC2626`
- Animation: fade in overlay (200ms) + slide up content (250ms)

---

## Frontend User Flows

### Flow 1: Company Creation (Onboarding Step 2)

**Flow Map**:
```
User completes Personal Info (Step 1)
  |
  +-- [advances to Step 2] --> CompanyCreationStep renders
  |     |
  |     +-- [fills form + submits] --> client-side validation
  |     |     |
  |     |     +-- [CNPJ checksum invalid] --> inline error: "CNPJ invalido"
  |     |     +-- [required fields missing] --> field-level errors
  |     |     +-- [foundedDate in future] --> field error on date field
  |     |     +-- [valid] --> POST /api/v1/companies
  |     |           |
  |     |           +-- [201 Created] --> AuthContext updated, redirect to /dashboard
  |     |           |     +-- CompanySetupProgress shows on dashboard
  |     |           +-- [409 CNPJ duplicate] --> inline error on CNPJ field
  |     |           +-- [400 validation] --> map errors to form fields
  |     |           +-- [500 server error] --> error toast
  |     |
  |     +-- [user closes browser] --> next login resumes at Step 2
```

**Step-by-step**:

```
PRECONDITION: User completed Step 1 (Personal Info), AuthContext.needsOnboarding = true
ACTOR: Founder / new user
TRIGGER: Step 1 completion

1.  [UI] OnboardingWizard renders Step 2 (CompanyCreationStep)
    - Stepper shows: "Suas Informacoes" [complete, green check] -> "Sua Empresa" [active, blue dot]
2.  [UI] User fills company name in text input
3.  [UI] User selects entity type from EntityTypeSelector radio group
4.  [UI] User types CNPJ digits into CNPJInput (auto-masks as XX.XXX.XXX/XXXX-XX)
5.  [Frontend] On CNPJ blur: validates Modulo 11 checksum
    -> IF invalid: show inline error "CNPJ invalido" below CNPJ field, STOP
6.  [UI] User optionally fills description textarea
7.  [UI] User optionally selects founded date from date picker (DD/MM/YYYY)
8.  [UI] User clicks "Criar Empresa" button
9.  [Frontend] Zod schema validates all fields client-side
    -> IF name too short/long: field error on name
    -> IF entityType not selected: field error on entity type
    -> IF CNPJ empty or invalid: field error on CNPJ
    -> IF foundedDate in future: field error on date
    -> IF any errors: show field-level errors, STOP
10. [Frontend] Sets submitting state: button shows spinner, all fields disabled
11. [Frontend] POST /api/v1/companies with { name, entityType, cnpj, description, foundedDate }
12. [Backend] AuthGuard verifies Privy JWT
    -> IF unauthenticated: return 401, frontend redirects to /login
13. [Backend] ValidationPipe validates request body
    -> IF invalid: return 400 VAL_INVALID_INPUT with validationErrors
14. [Backend] CompanyService.create() validates CNPJ checksum (Modulo 11)
    -> IF invalid: return 422 COMPANY_INVALID_CNPJ
15. [Backend] Checks CNPJ uniqueness
    -> IF duplicate: return 409 COMPANY_CNPJ_DUPLICATE
16. [Backend] Creates Company (DRAFT) + CompanyMember (ADMIN) in transaction
17. [Backend] Queues async CNPJ validation + contract deployment via Bull
18. [Backend] Returns 201 with company data including setupStatus
19. [Frontend] On 201:
    - AuthContext updates: hasCompany = true, companyId = response.data.id
    - Calls onComplete()
    - OnboardingWizard redirects to /dashboard
20. [UI] Dashboard renders with CompanySetupProgress card at the top

POSTCONDITION: Company exists in DRAFT, user is ADMIN, async validation in progress
SIDE EFFECTS: Audit log (COMPANY_CREATED), CNPJ validation job queued, contract deployment job queued
```

**Error Recovery**:
- On 409 CNPJ duplicate: CNPJ field shows inline error `errors.company.cnpjDuplicate`. User can edit CNPJ and resubmit. Form re-enabled.
- On 400 validation: each `validationError` mapped to its `field` in the form. Form re-enabled.
- On 5xx: error toast displayed. Form re-enabled. User can retry submission.
- On network error: error toast with "Erro de conexao" message. Form re-enabled.

---

### Flow 2: CNPJ Async Validation (Post-Creation)

**Flow Map**:
```
Company created in DRAFT status, user on /dashboard
  |
  +-- CompanySetupProgress renders, starts polling
  |     |
  |     +-- GET /api/v1/companies/:id every 5 seconds
  |     |     |
  |     |     +-- [setupStatus.cnpjValidation = SUCCESS]
  |     |     |     +-- CNPJ item shows green check
  |     |     |
  |     |     +-- [setupStatus.cnpjValidation = FAILED]
  |     |     |     +-- CNPJ item shows red X + "Tentar novamente" button
  |     |     |     +-- [user clicks retry] --> POST /validate-cnpj --> item back to IN_PROGRESS
  |     |     |
  |     |     +-- [setupStatus.contractDeployment = SUCCESS]
  |     |     |     +-- Contract item shows green check
  |     |     |
  |     |     +-- [setupStatus.contractDeployment = FAILED]
  |     |           +-- Contract item shows red X + "Tentar novamente" button
  |     |           +-- [user clicks retry] --> POST /deploy-contract --> item back to IN_PROGRESS
  |     |
  |     +-- [all items SUCCESS] --> success animation --> card auto-dismisses after 3s
  |           +-- Company status now ACTIVE
  |           +-- Dashboard refreshes with full company data
```

**Step-by-step**:

```
PRECONDITION: Company in DRAFT, CompanySetupProgress visible on dashboard
ACTOR: System (automatic) + User (retry only)
TRIGGER: Dashboard mount with DRAFT company

1.  [UI] CompanySetupProgress renders with items in "Pendente" state
2.  [Frontend] TanStack Query starts polling GET /api/v1/companies/:companyId (refetchInterval: 5000ms)
3.  [Backend] Returns company with setupStatus object:
    { cnpjValidation: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED',
      contractDeployment: 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'FAILED' }
4.  [Frontend] Maps each status value to the corresponding UI state (icon + text)
5.  [System] Verifik CNPJ validation completes in background (see company-cnpj-validation.md)
    -> IF success: setupStatus.cnpjValidation = SUCCESS, company moves toward ACTIVE
    -> IF failure: setupStatus.cnpjValidation = FAILED
6.  [Frontend] Next poll picks up status change, updates UI
7.  [System] Smart contract deployment completes in background (see company-blockchain-admin.md)
    -> IF success: setupStatus.contractDeployment = SUCCESS
    -> IF failure: setupStatus.contractDeployment = FAILED
8.  [Frontend] Next poll picks up status change, updates UI
9.  [Frontend] When all items are in terminal state (SUCCESS or FAILED): stop polling

IF all items SUCCESS:
10. [UI] Brief success animation (green check pulse on card)
11. [UI] Card auto-dismisses after 3 seconds
12. [Frontend] Invalidates company query cache, triggers refetch
13. [UI] Dashboard renders with full ACTIVE company data

IF any item FAILED:
10. [UI] Failed item shows red X icon + "Tentar novamente" ghost button
11. [UI] User clicks retry button
12. [Frontend] POST /api/v1/companies/:companyId/validate-cnpj (or /deploy-contract)
13. [UI] Item transitions to "Em andamento" (IN_PROGRESS), polling resumes

POSTCONDITION: Company is ACTIVE (happy path) or has setup failures displayed
SIDE EFFECTS: Audit logs for each setup step
```

---

### Flow 3: Edit Company Settings

**Flow Map**:
```
User navigates to /dashboard/settings
  |
  +-- [not ADMIN] --> read-only view, no save button, no danger zone
  |
  +-- [ADMIN] --> editable form
        |
        +-- [modifies fields]
        |     |
        |     +-- [clicks "Salvar"] --> client validation
        |           |
        |           +-- [invalid] --> field-level errors
        |           +-- [valid] --> PUT /api/v1/companies/:companyId
        |                 |
        |                 +-- [200 OK] --> success toast, cache updated
        |                 +-- [400 validation] --> field errors
        |                 +-- [422 business rule] --> error toast
        |                 +-- [404 not found] --> redirect to /dashboard
        |
        +-- [clicks "Dissolver Empresa"] --> Flow 4
```

**Step-by-step**:

```
PRECONDITION: User is authenticated, has a company, navigated to /dashboard/settings
ACTOR: ADMIN (editable), any member (read-only)
TRIGGER: User navigates to /dashboard/settings

1.  [UI] CompanySettingsPage renders with "Informacoes da Empresa" tab active
2.  [Frontend] GET /api/v1/companies/:companyId to load company data
    -> While loading: skeleton form (pulsing gray rectangles matching field layout)
3.  [Frontend] Determines user role from auth context or company detail response
4.  [UI] IF not ADMIN: render all fields as read-only, hide save button and danger zone
5.  [UI] IF ADMIN: render editable form with CompanyInfoForm
6.  [UI] CompanyInfoForm renders:
    - Name: pre-filled text input
    - Entity Type: EntityTypeSelector (read-only if hasShareholders)
    - CNPJ: CNPJInput (always read-only)
    - Description: pre-filled textarea
    - Founded Date: pre-filled date picker
    - Status: CompanyStatusBadge (informational, not editable)
7.  [UI] User modifies one or more fields
8.  [UI] Save button becomes enabled (form is dirty)
9.  [UI] User clicks "Salvar" / "Save"
10. [Frontend] Zod schema validates modified fields
    -> IF invalid: show field-level errors, STOP
11. [Frontend] Sets saving state: button shows spinner, fields disabled
12. [Frontend] PUT /api/v1/companies/:companyId with changed fields only
13. [Backend] AuthGuard + CompanyGuard + RolesGuard validate request
    -> IF not member: return 404
    -> IF not ADMIN: return 404 (anti-enumeration)
14. [Backend] Validates update (not DISSOLVED, entityType immutability if has shareholders)
    -> IF DISSOLVED: return 422 COMPANY_CANNOT_UPDATE_DISSOLVED
    -> IF entityType change with shareholders: return 422 COMPANY_ENTITY_TYPE_LOCKED
15. [Backend] Updates company, returns 200 with updated data
16. [Frontend] On 200:
    - Success toast: "Empresa atualizada com sucesso" (i18n: company.settings.saved)
    - Invalidates TanStack Query cache for company
    - Resets form dirty state
17. [UI] Form re-enabled with updated data

POSTCONDITION: Company data updated
SIDE EFFECTS: Audit log (COMPANY_UPDATED)
```

---

### Flow 4: Company Dissolution

**Flow Map**:
```
ADMIN navigates to /dashboard/settings, scrolls to Danger Zone
  |
  +-- [clicks "Dissolver Empresa"]
        |
        +-- CompanyDissolutionDialog opens
        |     |
        |     +-- GET /dissolution-prerequisites
        |           |
        |           +-- [canDissolve = false, blockers exist]
        |           |     +-- Shows blocker list
        |           |     +-- Only "Fechar" button available
        |           |     +-- User resolves blockers separately, retries later
        |           |
        |           +-- [canDissolve = true]
        |                 +-- Shows name confirmation input
        |                 |
        |                 +-- [user types company name correctly]
        |                 |     +-- "Dissolver" button enables
        |                 |     +-- [user clicks "Dissolver"]
        |                 |           +-- POST /api/v1/companies/:companyId/dissolve
        |                 |                 |
        |                 |                 +-- [200/204 success] --> toast + redirect
        |                 |                 +-- [422 prerequisites changed] --> error toast
        |                 |                 +-- [500 error] --> error toast
        |                 |
        |                 +-- [user types wrong name] --> "Dissolver" stays disabled
        |                 +-- [user clicks "Cancelar"] --> dialog closes
```

**Step-by-step**:

```
PRECONDITION: User is ADMIN, company is ACTIVE or INACTIVE
ACTOR: ADMIN
TRIGGER: User clicks "Dissolver Empresa" button in settings danger zone

1.  [UI] User scrolls to Danger Zone section in settings page
2.  [UI] User clicks "Dissolver Empresa" button
3.  [UI] CompanyDissolutionDialog opens with loading state
4.  [Frontend] GET /api/v1/companies/:companyId/dissolution-prerequisites
5.  [Backend] Checks:
    - Active shareholders count
    - Active funding rounds count
    - Pending option exercises count
    - Pending transactions count
6.  [Backend] Returns { canDissolve: boolean, blockers: DissolutionBlocker[] }

IF blockers exist:
7a. [UI] Dialog shows blocker list:
    - Each blocker with red XCircle icon + description text
    - "Resolve estes itens antes de dissolver a empresa" message
    - Only "Fechar" button in footer
8a. [UI] User clicks "Fechar" to close dialog
9a. User must resolve each blocker (close rounds, cancel exercises, etc.) before retrying

IF no blockers:
7b. [UI] Dialog shows confirmation section:
    - Warning icon + irreversibility warning text
    - "Digite '{company.name}' para confirmar" label with input
    - "Cancelar" (secondary) + "Dissolver" (destructive, disabled) buttons
8b. [UI] User types company name in confirmation input
9b. [Frontend] Compares input value with company.name (case-sensitive)
    -> IF match: enable "Dissolver" button
    -> IF no match: keep "Dissolver" button disabled
10. [UI] User clicks "Dissolver"
11. [Frontend] Sets dissolving state: button shows spinner
12. [Frontend] POST /api/v1/companies/:companyId/dissolve
13. [Backend] Re-validates prerequisites (may have changed since dialog opened)
    -> IF blockers now exist: return 422 COMPANY_DISSOLUTION_BLOCKED
14. [Backend] Updates company status to DISSOLVED
15. [Backend] Sends notification to all active members
16. [Backend] Returns 200/204 success
17. [Frontend] On success:
    - Close dialog
    - Success toast: "Empresa dissolvida" (i18n: company.dissolution.success)
    - Invalidates company query cache
    - Note: Since MVP is one company per user, the user will see a dissolved state on their dashboard

POSTCONDITION: Company status = DISSOLVED, all data read-only
SIDE EFFECTS: Audit log (COMPANY_STATUS_CHANGED), notification emails to all members, blockchain status update
```

---

## UI States and Error Handling

### CompanyCreationStep States

| State | Visual | Trigger |
|-------|--------|---------|
| Idle | Form with empty fields, submit button disabled (gray) | Initial render |
| Filling | Form with user input, CNPJ auto-masking, submit button enabled when required fields filled | User types |
| CNPJ Invalid (client) | Red border on CNPJ, error text "CNPJ invalido" below CNPJ field | CNPJ blur + Modulo 11 checksum fail |
| Submitting | Button shows spinner + "Criando..." text, all fields disabled, gray overlay | Form submit |
| CNPJ Duplicate (server) | CNPJ field: red border + inline error "CNPJ ja cadastrado". Other fields re-enabled. | 409 response |
| Validation Error (server) | Red borders on invalid fields, error text below each. All fields re-enabled. | 400 response |
| Server Error | Error toast (Sonner, top-right). All fields re-enabled. | 5xx response |
| Success | Brief transition before redirect (no intermediate UI shown) | 201 response |

### CompanySetupProgress States

| Component State | CNPJ Validation Item | Contract Deployment Item | Card Behavior |
|----------------|---------------------|-------------------------|---------------|
| Initial | Pending (gray spinner) | Pending (gray spinner) | Polling active |
| Validating | In Progress (blue spinner) | Pending (gray spinner) | Polling active |
| CNPJ Done | Success (green check) | In Progress (blue spinner) | Polling active |
| All Done | Success (green check) | Success (green check) | Stop polling, success animation, auto-dismiss 3s |
| CNPJ Failed | Failed (red X + retry) | Pending (gray spinner) | Polling stopped for CNPJ, continues for contract |
| Both Failed | Failed (red X + retry) | Failed (red X + retry) | Polling stopped entirely |

**Auto-dismiss animation**: Card border briefly flashes `green-600`, then fades out with `opacity: 0` + `height: 0` transition over 300ms.

### CompanySettingsPage States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Skeleton form: pulsing gray rectangles matching field layout | Page mount |
| View (non-ADMIN) | Form fields read-only, no save button, no danger zone, info text at top | Data loaded, user is not ADMIN |
| View (ADMIN, clean) | Form pre-filled, fields editable, save button disabled (not dirty) | Data loaded, user is ADMIN |
| Dirty | Save button enabled (blue), shows changed field count or just becomes clickable | User modifies a field |
| Saving | Save button shows spinner, fields disabled | Save click |
| Saved | Success toast (Sonner, top-right, green left border), form reset to clean state | 200 response |
| Save Error (validation) | Red borders on invalid fields, error text | 400 response |
| Save Error (business rule) | Error toast with business rule message | 422 response |
| Save Error (server) | Error toast with generic message | 5xx response |

### CompanyDissolutionDialog States

| State | Visual | Trigger |
|-------|--------|---------|
| Loading | Dialog open, body shows centered spinner | Dialog opened, fetching prerequisites |
| Blocked | Blocker list with red icons, only "Fechar" button | canDissolve = false |
| Ready | Warning text + name confirmation input + disabled "Dissolver" button | canDissolve = true |
| Name Match | "Dissolver" button enabled (red) | Input matches company name |
| Dissolving | "Dissolver" button shows spinner, input disabled | User confirms dissolution |
| Success | Dialog closes, success toast, page state updates | 200/204 response |
| Error | Error toast, dialog remains open, form re-enabled | 422 or 5xx response |

### Error Code to UI Mapping

| Error Code | HTTP | UI Behavior |
|------------|------|-------------|
| `COMPANY_CNPJ_DUPLICATE` | 409 | Inline error on CNPJ field: i18n `errors.company.cnpjDuplicate` |
| `COMPANY_CNPJ_INVALID` | 422 | Inline error on CNPJ field: i18n `errors.company.cnpjInvalid` |
| `COMPANY_NOT_FOUND` | 404 | Redirect to `/dashboard` + error toast: i18n `errors.company.notFound` |
| `COMPANY_NAME_REQUIRED` | 400 | Field error on name: i18n `errors.val.required` |
| `COMPANY_CANNOT_UPDATE_DISSOLVED` | 422 | Error toast: i18n `errors.company.cannotUpdateDissolved` |
| `COMPANY_ENTITY_TYPE_LOCKED` | 422 | Error toast: i18n `errors.company.entityTypeLocked` |
| `COMPANY_DISSOLUTION_BLOCKED` | 422 | Show blockers list in dialog: i18n `errors.company.dissolutionBlocked` |
| `COMPANY_HAS_ACTIVE_SHAREHOLDERS` | 422 | Blocker item in dialog: i18n `errors.company.hasActiveShareholders` |
| `COMPANY_HAS_ACTIVE_ROUNDS` | 422 | Blocker item in dialog: i18n `errors.company.hasActiveRounds` |
| `COMPANY_FUTURE_DATE` | 422 | Field error on foundedDate: i18n `errors.company.futureDate` |
| `COMPANY_MEMBERSHIP_LIMIT` | 422 | Error toast: i18n `errors.company.membershipLimit` |
| `VAL_INVALID_INPUT` | 400 | Map validationErrors array to form fields via `applyServerErrors()` |
| `SYS_INTERNAL_ERROR` | 500 | Error toast: i18n `errors.sys.internalError` |

### Server Error to Form Field Mapping

The `applyServerErrors()` utility maps server `validationErrors` to React Hook Form:

```typescript
function applyServerErrors(
  errors: ValidationError[],
  setError: UseFormSetError<any>,
) {
  for (const err of errors) {
    setError(err.field, {
      type: 'server',
      message: err.messageKey,  // Resolved by i18n in the field error component
    });
  }
}
```

---

## TanStack Query Integration

### Query Keys

```typescript
const companyKeys = {
  all: ['company'] as const,
  detail: (companyId: string) => ['company', companyId] as const,
  prerequisites: (companyId: string) => ['company', companyId, 'dissolution-prerequisites'] as const,
};
```

### Hooks

#### useCompany

Fetches the user's company detail. Used by CompanySettingsPage, CompanySetupProgress, and other dashboard components.

```typescript
function useCompany(companyId: string) {
  return useQuery({
    queryKey: companyKeys.detail(companyId),
    queryFn: () => api.get<Company>(`/api/v1/companies/${companyId}`),
    staleTime: 30_000,  // 30 seconds
  });
}
```

#### useCompanyPolling

Used by CompanySetupProgress to poll company status during setup.

```typescript
function useCompanyPolling(companyId: string, enabled: boolean) {
  return useQuery({
    queryKey: companyKeys.detail(companyId),
    queryFn: () => api.get<Company>(`/api/v1/companies/${companyId}`),
    refetchInterval: enabled ? 5000 : false,  // Poll every 5s when enabled
    refetchIntervalInBackground: false,         // Don't poll when tab is hidden
  });
}
```

#### useCreateCompany

Used by CompanyCreationStep.

```typescript
function useCreateCompany() {
  const queryClient = useQueryClient();
  const { updateCompanyId } = useAuth();

  return useMutation({
    mutationFn: (data: CreateCompanyDto) =>
      api.post<Company>('/api/v1/companies', data),
    onSuccess: (company) => {
      queryClient.setQueryData(companyKeys.detail(company.id), company);
      updateCompanyId(company.id);
    },
    // Error handling in the component via onError callback
  });
}
```

#### useUpdateCompany

Used by CompanyInfoForm.

```typescript
function useUpdateCompany(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCompanyDto) =>
      api.put<Company>(`/api/v1/companies/${companyId}`, data),
    onSuccess: (company) => {
      queryClient.setQueryData(companyKeys.detail(companyId), company);
    },
  });
}
```

#### useDissolveCompany

Used by CompanyDissolutionDialog.

```typescript
function useDissolveCompany(companyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<void>(`/api/v1/companies/${companyId}/dissolve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyKeys.detail(companyId) });
    },
  });
}
```

#### useDissolutionPrerequisites

Used by CompanyDissolutionDialog to check blockers.

```typescript
function useDissolutionPrerequisites(companyId: string, enabled: boolean) {
  return useQuery({
    queryKey: companyKeys.prerequisites(companyId),
    queryFn: () =>
      api.get<DissolutionPrerequisites>(
        `/api/v1/companies/${companyId}/dissolution-prerequisites`
      ),
    enabled,  // Only fetch when dialog is opened
    staleTime: 0,  // Always refetch when dialog opens
  });
}
```

### Error Handling in Mutations

All mutations follow the pattern from `error-handling.md`:

```typescript
const createCompany = useCreateCompany();

const onSubmit = async (data: CreateCompanyDto) => {
  try {
    await createCompany.mutateAsync(data);
    // Success: handled in onSuccess above
  } catch (error) {
    if (error instanceof ApiError) {
      switch (error.statusCode) {
        case 400:
          // Map validation errors to form fields
          if (error.validationErrors) {
            applyServerErrors(error.validationErrors, form.setError);
          }
          break;
        case 409:
          // CNPJ duplicate: set error on CNPJ field
          form.setError('cnpj', {
            type: 'server',
            message: error.messageKey,
          });
          break;
        case 422:
          // Business rule violation: show toast
          showErrorToast(t(error.messageKey));
          break;
        default:
          // Unexpected error: show generic toast
          showErrorToast(t('errors.sys.internalError'));
      }
    } else {
      // Network error
      showErrorToast(t('errors.sys.networkError'));
    }
  }
};
```

### Retry Configuration

Per `error-handling.md`, TanStack Query does not retry certain error types:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          // Don't retry auth, validation, or business rule errors
          if ([400, 401, 403, 404, 409, 422].includes(error.statusCode)) {
            return false;
          }
        }
        return failureCount < 2;
      },
    },
  },
});
```

---

## i18n Keys

All user-facing strings for company management. These keys must be added to both `messages/pt-BR.json` and `messages/en.json` per the i18n rules in `.claude/rules/i18n.md`.

### onboarding namespace (Step 2 keys)

These keys are also listed in `authentication.md` since CompanyCreationStep is part of the onboarding wizard. They are repeated here for completeness.

| Key | PT-BR | EN |
|-----|-------|-----|
| `onboarding.companyCreation.title` | Sua Empresa | Your Company |
| `onboarding.companyCreation.subtitle` | Configure sua empresa para gerenciar o cap table | Set up your company to manage the cap table |
| `onboarding.companyCreation.submit` | Criar Empresa | Create Company |

### company namespace

| Key | PT-BR | EN |
|-----|-------|-----|
| `company.fields.name` | Nome da Empresa | Company Name |
| `company.fields.namePlaceholder` | Ex: Acme Tecnologia Ltda. | e.g., Acme Technology Inc. |
| `company.fields.entityType` | Tipo de Entidade | Entity Type |
| `company.fields.entityType.ltda` | Limitada (Ltda.) | Limited Liability (Ltda.) |
| `company.fields.entityType.ltdaDescription` | Sociedade limitada com quotas | Limited liability company with quotas |
| `company.fields.entityType.saClosed` | S.A. Capital Fechado | Closely Held Corporation |
| `company.fields.entityType.saClosedDescription` | Sociedade anonima de capital fechado | Privately held corporation |
| `company.fields.entityType.saOpen` | S.A. Capital Aberto | Publicly Traded Corporation |
| `company.fields.entityType.saOpenDescription` | Sociedade anonima de capital aberto | Publicly traded corporation |
| `company.fields.cnpj` | CNPJ | CNPJ |
| `company.fields.cnpjHelper` | Sera validado automaticamente | Will be validated automatically |
| `company.fields.cnpjReadOnly` | CNPJ nao pode ser alterado apos a criacao | CNPJ cannot be changed after creation |
| `company.fields.description` | Descricao | Description |
| `company.fields.descriptionPlaceholder` | Descreva brevemente sua empresa | Briefly describe your company |
| `company.fields.foundedDate` | Data de Fundacao | Founded Date |
| `company.fields.foundedDatePlaceholder` | DD/MM/AAAA | DD/MM/YYYY |
| `company.settings.title` | Configuracoes da Empresa | Company Settings |
| `company.settings.subtitle` | Gerencie as informacoes da sua empresa | Manage your company information |
| `company.settings.tabs.info` | Informacoes da Empresa | Company Info |
| `company.settings.tabs.members` | Membros | Members |
| `company.settings.tabs.notifications` | Notificacoes | Notifications |
| `company.settings.save` | Salvar | Save |
| `company.settings.saved` | Empresa atualizada com sucesso | Company updated successfully |
| `company.settings.readOnlyHint` | Somente administradores podem editar | Only administrators can edit |
| `company.settings.dangerZone.title` | Zona de Perigo | Danger Zone |
| `company.settings.dangerZone.dissolveButton` | Dissolver Empresa | Dissolve Company |
| `company.settings.dangerZone.warning` | Esta acao e irreversivel. A empresa sera desativada permanentemente e todos os dados serao somente leitura. | This action is irreversible. The company will be permanently deactivated and all data will become read-only. |
| `company.settings.dangerZone.confirmLabel` | Digite "{name}" para confirmar | Type "{name}" to confirm |
| `company.settings.dangerZone.resolveFirst` | Resolva estes itens antes de dissolver a empresa | Resolve these items before dissolving the company |
| `company.setup.title` | Configurando sua empresa... | Setting up your company... |
| `company.setup.cnpjValidation` | Validacao do CNPJ | CNPJ Validation |
| `company.setup.contractDeployment` | Implantacao do Contrato | Contract Deployment |
| `company.setup.pending` | Pendente | Pending |
| `company.setup.inProgress` | Em andamento | In progress |
| `company.setup.success` | Concluido | Complete |
| `company.setup.failed` | Falhou | Failed |
| `company.setup.retry` | Tentar novamente | Retry |
| `company.setup.allComplete` | Empresa configurada com sucesso! | Company setup complete! |
| `company.status.draft` | Rascunho | Draft |
| `company.status.active` | Ativa | Active |
| `company.status.inactive` | Inativa | Inactive |
| `company.status.dissolved` | Dissolvida | Dissolved |
| `company.dissolution.title` | Dissolver Empresa | Dissolve Company |
| `company.dissolution.success` | Empresa dissolvida com sucesso | Company dissolved successfully |
| `company.dissolution.cancelButton` | Cancelar | Cancel |
| `company.dissolution.confirmButton` | Dissolver | Dissolve |
| `company.dissolution.closeButton` | Fechar | Close |
| `company.dissolution.blockers.activeShareholders` | Existem {count} acionistas ativos | There are {count} active shareholders |
| `company.dissolution.blockers.activeRounds` | Existem {count} rodadas de investimento ativas | There are {count} active funding rounds |
| `company.dissolution.blockers.pendingExercises` | Existem {count} exercicios de opcoes pendentes | There are {count} pending option exercises |
| `company.dissolution.blockers.pendingTransactions` | Existem {count} transacoes pendentes | There are {count} pending transactions |

### errors namespace (company-related)

| Key | PT-BR | EN |
|-----|-------|-----|
| `errors.company.cnpjDuplicate` | CNPJ ja cadastrado no sistema | CNPJ already registered in the system |
| `errors.company.cnpjInvalid` | CNPJ invalido | Invalid CNPJ |
| `errors.company.notFound` | Empresa nao encontrada | Company not found |
| `errors.company.cannotUpdateDissolved` | Nao e possivel atualizar uma empresa dissolvida | Cannot update a dissolved company |
| `errors.company.entityTypeLocked` | Tipo de entidade nao pode ser alterado apos adicionar acionistas | Entity type cannot be changed after adding shareholders |
| `errors.company.dissolutionBlocked` | Existem pendencias que impedem a dissolucao | There are pending items blocking dissolution |
| `errors.company.hasActiveShareholders` | A empresa possui acionistas ativos | The company has active shareholders |
| `errors.company.hasActiveRounds` | A empresa possui rodadas de investimento ativas | The company has active funding rounds |
| `errors.company.futureDate` | Data de fundacao nao pode ser no futuro | Founded date cannot be in the future |
| `errors.company.membershipLimit` | Limite de empresas atingido | Company membership limit reached |

---

## Frontend Success Criteria

### Functional

- [ ] CompanyCreationStep validates all fields (name length, entityType selection, CNPJ Modulo 11 checksum, optional date not in future)
- [ ] CompanyCreationStep submits to POST /api/v1/companies and handles 201, 400, 409, 422, and 5xx responses
- [ ] CNPJ duplicate (409) maps to inline error on CNPJ field
- [ ] Validation errors (400) map to correct form fields via applyServerErrors()
- [ ] CNPJInput auto-masks as XX.XXX.XXX/XXXX-XX while typing
- [ ] CNPJInput validates Modulo 11 checksum on blur
- [ ] CNPJInput accepts pasted raw digits or formatted strings
- [ ] EntityTypeSelector renders 3 radio cards with correct labels and descriptions
- [ ] CompanySetupProgress renders on dashboard when company is DRAFT
- [ ] CompanySetupProgress polls every 5 seconds and stops when all items are terminal
- [ ] CompanySetupProgress auto-dismisses after all items succeed
- [ ] CompanySetupProgress shows retry buttons on failure
- [ ] CompanySettingsPage renders with tabbed navigation (Company Info, Members link, Notifications)
- [ ] CompanyInfoForm pre-fills with current company data
- [ ] CompanyInfoForm CNPJ field is always read-only
- [ ] CompanyInfoForm EntityType is read-only when company has shareholders
- [ ] CompanyInfoForm save button disabled until form is dirty
- [ ] CompanyInfoForm submits PUT /api/v1/companies/:companyId and handles all error responses
- [ ] CompanyDissolutionDialog fetches prerequisites before showing confirmation
- [ ] CompanyDissolutionDialog shows blocker list when dissolution is blocked
- [ ] CompanyDissolutionDialog requires exact company name match to enable confirm button
- [ ] CompanyStatusBadge renders correct colors for DRAFT, ACTIVE, INACTIVE, DISSOLVED
- [ ] Non-ADMIN users see read-only settings with no save button and no danger zone

### i18n

- [ ] All user-facing strings use i18n keys (no hardcoded text)
- [ ] All keys exist in both `messages/pt-BR.json` and `messages/en.json`
- [ ] Keys follow flat namespace convention: `{feature}.{element}.{descriptor}`
- [ ] Number formatting uses `Intl.NumberFormat('pt-BR')` regardless of locale
- [ ] Date formatting uses `Intl.DateTimeFormat('pt-BR')` for DD/MM/YYYY regardless of locale

### Accessibility

- [ ] All form inputs have associated labels
- [ ] EntityTypeSelector radio cards are keyboard-navigable (arrow keys)
- [ ] CNPJInput has aria-label and aria-describedby for helper/error text
- [ ] CompanyDissolutionDialog traps focus when open
- [ ] CompanyDissolutionDialog closes on Escape key
- [ ] All buttons have minimum tap target 44x44px on mobile
- [ ] Color is not used alone to convey information (icons accompany status colors)
- [ ] Focus indicators: `2px solid blue-600` with `2px` offset, using `focus-visible`

### Performance

- [ ] CompanyCreationStep form submit to redirect: < 1 second (excluding network)
- [ ] CompanySettingsPage initial load (including API call): < 2 seconds
- [ ] CompanySetupProgress polling does not cause unnecessary re-renders (stable query keys)
- [ ] CompanyDissolutionDialog prerequisites fetch: < 500ms
