# Company Management Specification

**Topic of Concern**: Company creation, membership, and lifecycle management

**One-Sentence Description**: The system manages Brazilian company entities (Ltda. and S.A.) with CNPJ validation, role-based membership, invitation workflows, and multi-company support scoped through the creating user's embedded wallet as the on-chain admin.

---

## Overview

The Company entity is the root entity in Navia — every feature (shareholders, cap table, transactions, documents, option plans) is company-scoped. A company represents a Brazilian legal entity, either a Sociedade Limitada (Ltda.) or a Sociedade Anônima (S.A.), that uses the platform to manage its cap table with on-chain record-keeping.

### Brazilian Entity Types

**Sociedade Limitada (Ltda.)** is the most common business entity in Brazil, equivalent to an LLC. Members hold quotas (quotas sociais) with equal rights per quota. Governed by Articles 1.052–1.087 of the Brazilian Civil Code (Lei 10.406/2002).

**Sociedade Anônima (S.A.)** is a corporation governed by Lei 6.404/1976 (Lei das S.A.). S.A. companies can be capital aberto (publicly traded) or capital fechado (privately held). They issue shares (ações) that can be common (ordinárias - ON) or preferred (preferenciais - PN) with distinct rights.

### Multi-Company Support

A single user can belong to multiple companies with different roles in each. The platform supports company context switching — the active company is identified by the `X-Company-Id` HTTP header on all API requests. All data queries are scoped to the active company via Prisma middleware, ensuring strict data isolation.

### Admin Wallet Architecture

When a user creates a company, their existing Privy embedded wallet (stored as `User.walletAddress`) becomes the smart contract admin for that company's on-chain cap table. There is no separate AdminWallet entity — the link is:

```
Company → CompanyMember (role: ADMIN, creator) → User → walletAddress
```

This wallet is the sole authority for minting/issuing shares on the OCP smart contract. The smart contract is deployed during company setup with this wallet address as the owner.

### Company Creation Flow

Company creation is asynchronous. When an admin submits the company creation form:

1. Company is created in `DRAFT` status with the provided CNPJ
2. A Bull background job validates the CNPJ via Verifik against Receita Federal
3. On success, company moves to `ACTIVE` and the OCP smart contract is deployed
4. On failure, admin is notified and can update the CNPJ and retry

---

## User Stories

### US-1: Create a New Company
**As an** admin user with approved KYC
**I want to** create a new company by providing its CNPJ and details
**So that** I can start managing the company's cap table on the platform

### US-2: Invite a Team Member
**As an** admin user
**I want to** invite team members by email with a specific role
**So that** they can access and collaborate on the company's cap table

### US-3: Accept Invitation (Existing Account)
**As a** user with an existing Navia account
**I want to** accept a company invitation via the link in my email
**So that** I can access the company's data with my assigned role

### US-4: Accept Invitation (New User)
**As a** person without a Navia account
**I want to** sign up through the invitation link and automatically join the company
**So that** I can access the company without a separate invitation step after registration

### US-5: Change a Member's Role
**As an** admin user
**I want to** change a team member's role within the company
**So that** their permissions match their current responsibilities

### US-6: Remove a Member
**As an** admin user
**I want to** remove a team member from the company
**So that** they can no longer access company data

### US-7: Switch Between Companies
**As a** user who belongs to multiple companies
**I want to** switch between companies from the navigation bar
**So that** I can manage different companies without logging out

### US-8: Update Company Details
**As an** admin user
**I want to** update the company's name, description, logo, and settings
**So that** the company profile stays current

### US-9: Deactivate or Dissolve a Company
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
- System MUST trigger asynchronous CNPJ validation via Verifik
- System MUST support updating company name, description, logo, and settings
- System MUST support listing all companies the authenticated user belongs to
- System MUST support retrieving full company details including setup status

### FR-2: Async Company Setup via Bull Job
- System MUST dispatch a Bull job for CNPJ validation upon company creation
- Bull job MUST call Verifik CNPJ validation API
- On Verifik success (CNPJ is ATIVA in Receita Federal), job MUST:
  - Store the validated company data (razão social, endereço, CNAE, etc.)
  - Set `cnpjValidatedAt` timestamp
  - Deploy the OCP smart contract with the creator's wallet address as owner
  - Transition company status from `DRAFT` to `ACTIVE`
- On Verifik failure, job MUST:
  - Record the failure reason
  - Notify the admin via email
  - Company remains in `DRAFT` (admin can update CNPJ and retry)
- Bull job MUST retry on transient errors (network timeout, Verifik unavailable) up to 3 times with exponential backoff

### FR-3: Company Lifecycle State Machine
- System MUST enforce the following state transitions:
  - `DRAFT` → `ACTIVE` (on successful CNPJ validation + contract deployment)
  - `ACTIVE` → `INACTIVE` (admin action — temporarily suspends operations)
  - `INACTIVE` → `ACTIVE` (admin re-activation)
  - `ACTIVE` → `DISSOLVED` (admin action — permanent, requires 0 active shareholders)
  - `INACTIVE` → `DISSOLVED` (admin action — permanent)
- `DRAFT` companies MUST NOT allow shareholder creation, transactions, or document generation
- `INACTIVE` companies MUST block new transactions but allow read access
- `DISSOLVED` companies MUST be fully read-only (no writes except audit logs)

### FR-4: Admin Wallet Linkage
- System MUST use the creating user's `User.walletAddress` as the smart contract admin
- System MUST NOT create a separate AdminWallet entity or Privy server wallet
- System MUST record the creator's user ID on the Company entity (`createdById`)
- System MUST deploy the OCP smart contract with the creator's wallet as the owner/minter
- System MUST validate that the creator has a non-null `walletAddress` before company creation
- Only the creator's wallet has on-chain control — other ADMINs are platform-level only
- When the sole ADMIN role is transferred to another user, the system MUST initiate an on-chain `transferOwnership()` transaction signed by the current owner's wallet
- The system MUST prompt the outgoing admin to sign the on-chain transfer before the role change completes

### FR-5: Member Invitation with Token-Based Acceptance
- System MUST allow ADMIN users to invite members by email address
- System MUST generate a cryptographically random invitation token (32 bytes, hex-encoded)
- System MUST create a `CompanyMember` record with status `PENDING` and the invited email
- System MUST send an invitation email via AWS SES with a signup/accept link containing the token
- If the invited email belongs to an existing user, the email links to login + auto-accept
- If the invited email does not belong to an existing user, the email links to signup + auto-accept
- Invitation tokens MUST expire after 7 days
- System MUST support re-sending an invitation (generates a new token, invalidates the old one)

### FR-6: Role-Based Membership
- System MUST support the following roles: `ADMIN`, `FINANCE`, `LEGAL`, `INVESTOR`, `EMPLOYEE`
- Role definitions and permission matrices are defined in `user-permissions.md`
- System MUST allow ADMIN users to change any member's role
- System MUST enforce that at least one ADMIN exists per company at all times
- System MUST allow a member to hold exactly one role per company (not multiple roles)
- System MUST support optional fine-grained permission overrides per member (JSON field)

### FR-7: Multi-Company Support with X-Company-Id Header
- All company-scoped API endpoints MUST require the `X-Company-Id` header
- System MUST validate that the authenticated user is an active member of the specified company
- System MUST return `403 Forbidden` if the user is not a member of the specified company
- System MUST scope all database queries to the company specified in the header via Prisma middleware
- System MUST support the `/api/v1/companies` endpoint without the `X-Company-Id` header (user-scoped, lists all companies)
- System MUST enforce a maximum of **20 companies** per user (PENDING + ACTIVE memberships)

### FR-8: Company Context Switching in Frontend
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
  name: string;                        // Display name (may differ from razão social)
  entityType: CompanyEntityType;       // LTDA | SA_CAPITAL_FECHADO | SA_CAPITAL_ABERTO
  cnpj: string;                        // XX.XXX.XXX/XXXX-XX (unique)
  description: string | null;          // Optional company description
  logoUrl: string | null;              // S3 URL for company logo
  foundedDate: Date | null;            // Company founding date

  // Lifecycle
  status: CompanyStatus;               // DRAFT | ACTIVE | INACTIVE | DISSOLVED

  // CNPJ Validation (populated by Verifik)
  cnpjValidatedAt: Date | null;        // Set when Verifik confirms CNPJ
  cnpjData: {                          // Cached Receita Federal data (JSONB)
    razaoSocial: string;               // Legal name
    nomeFantasia: string | null;       // Trade name
    situacaoCadastral: string;         // e.g., "ATIVA"
    dataAbertura: string;              // Opening date
    naturezaJuridica: string;          // Legal nature code
    atividadePrincipal: {              // Primary CNAE activity
      codigo: string;
      descricao: string;
    };
    endereco: {                        // Registered address
      logradouro: string;
      numero: string;
      complemento: string | null;
      bairro: string;
      municipio: string;
      uf: string;
      cep: string;
    };
    capitalSocial: number;             // Registered capital (from Receita)
  } | null;

  // OCT Metadata (JSONB — Open Cap Table standard metadata)
  octMetadata: Record<string, any> | null;

  // Settings (embedded — no separate CompanySettings table)
  defaultCurrency: string;             // Default: "BRL"
  fiscalYearEnd: string;               // MM-DD format, default: "12-31"
  timezone: string;                    // Default: "America/Sao_Paulo"
  locale: string;                      // Default: "pt-BR"

  // Smart Contract
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

### CompanyMember Entity (Merged — Combines Role, Permissions, and Invitation)

```typescript
interface CompanyMember {
  id: string;                          // UUID, primary key
  companyId: string;                   // Foreign key to Company
  userId: string | null;               // Foreign key to User (null for pending invitations)
  email: string;                       // Invitation email (used for matching on acceptance)
  role: CompanyMemberRole;             // ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE

  // Optional fine-grained permission overrides
  permissions: {
    capTableRead?: boolean;
    capTableWrite?: boolean;
    transactionsCreate?: boolean;
    transactionsApprove?: boolean;
    documentsCreate?: boolean;
    documentsSign?: boolean;
    usersManage?: boolean;
    reportsView?: boolean;
    reportsExport?: boolean;
    auditView?: boolean;
  } | null;

  // Membership lifecycle
  status: CompanyMemberStatus;         // PENDING | ACTIVE | REMOVED

  // Invitation tracking
  invitedBy: string;                   // User ID of the inviter
  invitedAt: Date;                     // When invitation was sent
  acceptedAt: Date | null;             // When invitation was accepted
  removedAt: Date | null;              // When member was removed
  removedBy: string | null;            // User ID who removed the member

  // Audit
  createdAt: Date;
  updatedAt: Date;
}

enum CompanyMemberRole {
  ADMIN = 'ADMIN',
  FINANCE = 'FINANCE',
  LEGAL = 'LEGAL',
  INVESTOR = 'INVESTOR',
  EMPLOYEE = 'EMPLOYEE',
}

enum CompanyMemberStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REMOVED = 'REMOVED',
}

// Unique constraints:
// - (companyId, userId) WHERE status = 'ACTIVE' — one active membership per user per company
// - (companyId, email) WHERE status = 'PENDING' — one pending invitation per email per company
```

### InvitationToken Entity

```typescript
interface InvitationToken {
  id: string;                          // UUID, primary key
  companyMemberId: string;             // Foreign key to CompanyMember
  token: string;                       // Cryptographic random token (32 bytes hex, unique)
  expiresAt: Date;                     // Token expiration (7 days from creation)
  usedAt: Date | null;                 // Set when token is used to accept invitation
  createdAt: Date;
}
```

### Architectural Note: No AdminWallet Entity

The existing `blockchain-integration.md` defines an `AdminWallet` entity (1:1 with Company, Privy server wallet). **This is replaced** by the following architecture:

- The user who creates the company has their existing embedded wallet designated as the smart contract admin
- The wallet address is accessed via: `Company.createdById` → `User.walletAddress`
- On the smart contract, this wallet address is the owner/minter
- No AdminWallet table exists in the schema
- No Privy server wallet is created during company setup

When the ADMIN role is transferred to another user, the smart contract admin address MUST also transfer via an on-chain ownership transfer transaction (see RD-1).

---

## API Endpoints

### Company CRUD

#### POST /api/v1/companies
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
- `name`: required, 2–200 characters
- `entityType`: required, one of `LTDA`, `SA_CAPITAL_FECHADO`, `SA_CAPITAL_ABERTO`
- `cnpj`: required, valid CNPJ format (XX.XXX.XXX/XXXX-XX), passes checksum validation
- `description`: optional, max 2000 characters
- `foundedDate`: optional, ISO 8601 date, must not be in the future

---

#### GET /api/v1/companies
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
    },
    {
      "id": "comp_def456",
      "name": "Beta Ventures S.A.",
      "entityType": "SA_CAPITAL_FECHADO",
      "cnpj": "98.765.432/0001-10",
      "status": "ACTIVE",
      "logoUrl": null,
      "role": "INVESTOR",
      "memberCount": 12
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

#### GET /api/v1/companies/:id
**Description**: Get full company details. If the company is in DRAFT status, includes setup progress.

**Auth**: Required. User must be a member of the company.

**Response** (200 OK — ACTIVE company):
```json
{
  "success": true,
  "data": {
    "id": "comp_abc123",
    "name": "Acme Tecnologia",
    "entityType": "LTDA",
    "cnpj": "12.345.678/0001-90",
    "description": "Startup de tecnologia focada em SaaS B2B",
    "logoUrl": "https://s3.amazonaws.com/navia/logos/acme.png",
    "foundedDate": "2022-03-15",
    "status": "ACTIVE",
    "cnpjValidatedAt": "2026-02-23T10:00:30Z",
    "cnpjData": {
      "razaoSocial": "ACME TECNOLOGIA LTDA",
      "nomeFantasia": "Acme Tech",
      "situacaoCadastral": "ATIVA",
      "dataAbertura": "2022-03-15",
      "naturezaJuridica": "206-2",
      "atividadePrincipal": {
        "codigo": "62.01-5-01",
        "descricao": "Desenvolvimento de programas de computador sob encomenda"
      },
      "endereco": {
        "logradouro": "Rua Augusta",
        "numero": "1200",
        "complemento": "Sala 501",
        "bairro": "Consolação",
        "municipio": "São Paulo",
        "uf": "SP",
        "cep": "01304-001"
      },
      "capitalSocial": 100000
    },
    "contractAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "defaultCurrency": "BRL",
    "fiscalYearEnd": "12-31",
    "timezone": "America/Sao_Paulo",
    "locale": "pt-BR",
    "createdById": "user_xyz789",
    "createdAt": "2026-02-23T10:00:00Z",
    "updatedAt": "2026-02-23T10:00:30Z"
  }
}
```

**Response** (200 OK — DRAFT company, includes setup status):
```json
{
  "success": true,
  "data": {
    "id": "comp_abc123",
    "name": "Acme Tecnologia",
    "entityType": "LTDA",
    "cnpj": "12.345.678/0001-90",
    "status": "DRAFT",
    "cnpjValidatedAt": null,
    "contractAddress": null,
    "setupStatus": {
      "cnpjValidation": "IN_PROGRESS",
      "contractDeployment": "PENDING",
      "estimatedCompletionSeconds": 25
    },
    "createdAt": "2026-02-23T10:00:00Z",
    "updatedAt": "2026-02-23T10:00:00Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized` — Missing or invalid auth token
- `403 Forbidden` — User is not a member of this company
- `404 Not Found` — Company does not exist

---

#### PUT /api/v1/companies/:id
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

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "comp_abc123",
    "name": "Acme Tecnologia Ltda.",
    "description": "Updated description",
    "updatedAt": "2026-02-23T11:00:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid field values
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Company not found
- `422 Unprocessable Entity` — Cannot update DISSOLVED company

**Note**: `entityType` and `cnpj` cannot be changed after company has shareholders (see BR-10).

---

#### DELETE /api/v1/companies/:id
**Description**: Archive (dissolve) a company. Sets status to DISSOLVED. This is a soft delete — data is preserved but read-only.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "comp_abc123",
    "status": "DISSOLVED",
    "updatedAt": "2026-02-23T12:00:00Z"
  }
}
```

**Error Responses**:
- `403 Forbidden` — User is not ADMIN
- `422 Unprocessable Entity` — Company has active shareholders (must remove all shareholders first)
- `422 Unprocessable Entity` — Company has active funding rounds

---

### Setup Status

#### GET /api/v1/companies/:id/setup-status
**Description**: Poll the async CNPJ validation and contract deployment progress. Used by the frontend to show real-time setup progress for DRAFT companies.

**Auth**: Required. User must be a member of the company.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "companyId": "comp_abc123",
    "status": "DRAFT",
    "steps": [
      {
        "step": "CNPJ_VALIDATION",
        "status": "COMPLETED",
        "completedAt": "2026-02-23T10:00:15Z",
        "details": {
          "razaoSocial": "ACME TECNOLOGIA LTDA",
          "situacaoCadastral": "ATIVA"
        }
      },
      {
        "step": "CONTRACT_DEPLOYMENT",
        "status": "IN_PROGRESS",
        "details": {
          "transactionHash": "0xabc...",
          "walletAddress": "0x742d35..."
        }
      }
    ],
    "overallProgress": 50,
    "estimatedCompletionSeconds": 15
  }
}
```

**Step statuses**: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`

**Failure response** (200 OK — CNPJ validation failed):
```json
{
  "success": true,
  "data": {
    "companyId": "comp_abc123",
    "status": "DRAFT",
    "steps": [
      {
        "step": "CNPJ_VALIDATION",
        "status": "FAILED",
        "failedAt": "2026-02-23T10:00:20Z",
        "error": {
          "code": "COMPANY_CNPJ_INACTIVE",
          "message": "CNPJ 12.345.678/0001-90 has status BAIXADA in Receita Federal"
        }
      },
      {
        "step": "CONTRACT_DEPLOYMENT",
        "status": "PENDING"
      }
    ],
    "overallProgress": 0,
    "canRetry": true,
    "retryAction": "Update CNPJ via PUT /api/v1/companies/:id and retry"
  }
}
```

---

### Member Management

#### POST /api/v1/companies/:id/members/invite
**Description**: Invite a new member by email. Creates a pending CompanyMember and sends an invitation email.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

**Request**:
```json
{
  "email": "maria@example.com",
  "role": "FINANCE",
  "message": "Olá Maria, junte-se à nossa empresa para gerenciar o cap table."
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "member_abc123",
    "companyId": "comp_abc123",
    "email": "maria@example.com",
    "role": "FINANCE",
    "status": "PENDING",
    "invitedBy": "user_xyz789",
    "invitedAt": "2026-02-23T10:00:00Z",
    "expiresAt": "2026-03-02T10:00:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid email format or role
- `403 Forbidden` — User is not ADMIN
- `409 Conflict` — Email already has an active membership in this company
- `409 Conflict` — Email already has a pending invitation (use re-send instead)

---

#### POST /api/v1/companies/:id/members/:memberId/resend-invitation
**Description**: Re-send an invitation email. Generates a new token and invalidates the old one.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "member_abc123",
    "email": "maria@example.com",
    "status": "PENDING",
    "newExpiresAt": "2026-03-02T11:00:00Z"
  }
}
```

**Error Responses**:
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Member not found
- `422 Unprocessable Entity` — Member is not in PENDING status

---

#### GET /api/v1/companies/:id/members
**Description**: List all members of a company, including pending invitations.

**Auth**: Required. `X-Company-Id` header required.

**Query Parameters**:
- `status` (optional): Filter by member status (`PENDING`, `ACTIVE`, `REMOVED`)
- `role` (optional): Filter by role
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "member_001",
      "userId": "user_xyz789",
      "email": "admin@acme.com",
      "role": "ADMIN",
      "status": "ACTIVE",
      "user": {
        "id": "user_xyz789",
        "firstName": "João",
        "lastName": "Silva",
        "profilePictureUrl": "https://...",
        "walletAddress": "0x742d35..."
      },
      "invitedAt": "2026-02-23T10:00:00Z",
      "acceptedAt": "2026-02-23T10:00:00Z"
    },
    {
      "id": "member_002",
      "userId": null,
      "email": "maria@example.com",
      "role": "FINANCE",
      "status": "PENDING",
      "user": null,
      "invitedAt": "2026-02-23T10:30:00Z",
      "acceptedAt": null
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

#### PUT /api/v1/companies/:id/members/:memberId
**Description**: Update a member's role or permissions.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

**Request**:
```json
{
  "role": "LEGAL",
  "permissions": {
    "documentsCreate": true,
    "reportsView": true
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "member_002",
    "role": "LEGAL",
    "permissions": {
      "documentsCreate": true,
      "reportsView": true
    },
    "updatedAt": "2026-02-23T12:00:00Z"
  }
}
```

**Error Responses**:
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Member not found
- `422 Unprocessable Entity` — Cannot change role of the last ADMIN (see BR-3)

---

#### DELETE /api/v1/companies/:id/members/:memberId
**Description**: Remove a member from the company. Sets member status to REMOVED.

**Auth**: Required. `X-Company-Id` header required. User must be ADMIN.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "member_002",
    "status": "REMOVED",
    "removedAt": "2026-02-23T13:00:00Z",
    "removedBy": "user_xyz789"
  }
}
```

**Error Responses**:
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Member not found
- `422 Unprocessable Entity` — Cannot remove the last ADMIN (see BR-3)
- `422 Unprocessable Entity` — Cannot remove self if last ADMIN

---

### Invitation Acceptance

#### GET /api/v1/invitations/:token
**Description**: Get invitation details. Public endpoint — no authentication required. Used by the invitation link to show company name and role before the user decides to accept.

**Auth**: None required.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "companyName": "Acme Tecnologia",
    "companyLogoUrl": "https://s3.amazonaws.com/navia/logos/acme.png",
    "role": "FINANCE",
    "invitedByName": "João Silva",
    "invitedAt": "2026-02-23T10:00:00Z",
    "expiresAt": "2026-03-02T10:00:00Z",
    "email": "maria@example.com",
    "hasExistingAccount": true
  }
}
```

**Error Responses**:
- `404 Not Found` — Token does not exist or has been used
- `410 Gone` — Token has expired

---

#### POST /api/v1/invitations/:token/accept
**Description**: Accept an invitation. Associates the authenticated user with the pending CompanyMember record.

**Auth**: Required (user must be logged in). Any authenticated user with the token can accept (email match not required — see RD-6).

**Request**: No body required.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "memberId": "member_002",
    "companyId": "comp_abc123",
    "companyName": "Acme Tecnologia",
    "role": "FINANCE",
    "status": "ACTIVE",
    "acceptedAt": "2026-02-23T14:00:00Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized` — User not authenticated
- `404 Not Found` — Token does not exist or has been used
- `409 Conflict` — User is already an active member of this company
- `410 Gone` — Token has expired
- `422 Unprocessable Entity` — User has reached the 20-company membership limit

---

## Business Rules

### BR-1: CNPJ Uniqueness
- CNPJ MUST be unique across all companies on the platform
- Attempting to create a company with an existing CNPJ returns `409 Conflict`
- CNPJ uniqueness check includes DISSOLVED companies (CNPJs are never recycled)

### BR-2: CNPJ Validity
- CNPJ MUST pass format validation (XX.XXX.XXX/XXXX-XX) with check digits
- CNPJ MUST be verified as `ATIVA` (active) in Receita Federal via Verifik
- CNPJs with status `BAIXADA`, `SUSPENSA`, `INAPTA`, or `NULA` are rejected
- If Verifik returns a non-ATIVA status, the company remains in `DRAFT` and the admin is notified

### BR-3: Minimum One ADMIN Per Company
- Every company MUST have at least one member with ADMIN role at all times
- An ADMIN cannot remove their own ADMIN role if they are the last ADMIN
- An ADMIN cannot be removed from the company if they are the last ADMIN
- An ADMIN cannot change their own role to non-ADMIN if they are the last ADMIN

### BR-4: Admin Self-Protection
- An ADMIN can remove other ADMINs only if at least one ADMIN remains
- System MUST check the admin count before processing any role change or removal

### BR-5: Company Dissolution Prerequisites
- Company MUST have zero active shareholders before dissolution
- All active funding rounds must be closed or cancelled
- All pending option exercises must be resolved
- DISSOLVED status is permanent — no transition back to ACTIVE

### BR-6: DISSOLVED Company Read-Only
- DISSOLVED companies are fully read-only
- No new transactions, shareholders, funding rounds, or documents can be created
- Existing data remains accessible for audit and compliance purposes
- Audit logs can still be written

### BR-7: INACTIVE Company Restrictions
- INACTIVE companies block new transactions (issuances, transfers, conversions)
- Read access is preserved for all members
- Existing pending transactions are paused (not cancelled)
- Admin can re-activate to resume operations

### BR-8: Invitation Token Expiry
- Invitation tokens expire after 7 days from creation
- Expired tokens return `410 Gone` when accessed
- Expired invitations can be re-sent by an ADMIN (generates a new token)

### BR-9: Duplicate Invitation Prevention
- If an email already has a PENDING invitation for the same company, a new invite is rejected
- The ADMIN must re-send the existing invitation or cancel it first
- If an email already has an ACTIVE membership, the invitation is rejected with `409 Conflict`

### BR-10: Entity Type Immutability After Shareholders
- `entityType` cannot be changed after the company has any shareholders
- `cnpj` cannot be changed after company status moves to ACTIVE
- These fields can be updated while the company is in DRAFT status

### BR-11: Company Creator Auto-Assignment
- The user who creates a company is automatically assigned the ADMIN role
- A CompanyMember record with status `ACTIVE` is created during company creation
- The creator's `invitedBy` field references their own user ID

### BR-12: Creator Wallet as Smart Contract Admin
- The creator's `User.walletAddress` is used as the OCP smart contract owner
- System MUST verify the creator has a non-null wallet address before company creation
- The smart contract owner is set during contract deployment (part of async setup)
- Only the creator's wallet controls the contract — other ADMINs have platform-level admin only (see RD-5)
- When ADMIN role is transferred, on-chain ownership MUST also transfer (see RD-1)

### BR-13: Maximum Companies Per User
- A user can be a member of at most **20 companies** (PENDING + ACTIVE memberships)
- Company creation and invitation acceptance MUST check this limit
- REMOVED memberships do not count toward the limit
- Exceeding the limit returns `422 Unprocessable Entity` with error code `COMPANY_MEMBER_LIMIT_REACHED`

### BR-14: CNPJ Validation Is the Company KYC
- CNPJ validation during company creation (via Verifik) is the canonical company-level verification
- `kyc-verification.md` MUST reference this spec for CNPJ validation — no duplicate flow
- A validated CNPJ satisfies both the company setup requirement and the admin's company KYC

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
9. Backend dispatches Bull job: CnpjValidationJob
10. Backend returns company with status DRAFT
11. Frontend redirects to company dashboard with setup progress indicator
12. Frontend polls GET /api/v1/companies/:id/setup-status every 3 seconds

--- Bull Job: CnpjValidationJob ---
13. Job calls Verifik CNPJ API
14. Verifik returns company data from Receita Federal
15. If CNPJ is ATIVA:
    a. Job stores cnpjData on Company
    b. Job sets cnpjValidatedAt
    c. Job deploys OCP smart contract with creator's wallet as owner
    d. Job stores contractAddress on Company
    e. Job transitions Company status: DRAFT → ACTIVE
    f. Job sends "Company Active" notification email to creator
16. If CNPJ is NOT ATIVA:
    a. Job records failure reason
    b. Job sends "CNPJ Validation Failed" notification email
    c. Company remains in DRAFT
--- End Bull Job ---

17. Frontend detects status change via polling
18. Frontend shows "Company created successfully!" with contract address

POSTCONDITION: Company is ACTIVE, smart contract deployed, creator is ADMIN
```

### Flow 2: Member Invitation

```
PRECONDITION: Company is ACTIVE, user is ADMIN

1. Admin navigates to "Team" → "Invite Member"
2. Admin enters:
   - Invitee email
   - Role (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE)
   - Optional: personal message
3. Admin clicks "Send Invitation"
4. Frontend sends POST /api/v1/companies/:id/members/invite
5. Backend validates:
   - Email is not already an active member
   - Email does not have a pending invitation
   - Role is valid
6. Backend creates CompanyMember (status: PENDING, userId: null)
7. Backend generates InvitationToken (32 bytes hex, 7-day expiry)
8. Backend sends invitation email via AWS SES:
   - Subject: "Você foi convidado para [Company Name] no Navia"
   - Body: Company name, role, personal message, accept link
   - Accept link: https://app.navia.com/invitations/{token}
9. Backend returns pending member record
10. Frontend shows "Invitation sent to maria@example.com"

--- Invitee with existing account ---
11. Invitee clicks link in email
12. Browser opens https://app.navia.com/invitations/{token}
13. Frontend calls GET /api/v1/invitations/{token}
14. Frontend displays: company name, role, invited by, "Accept Invitation" button
15. Invitee clicks "Accept Invitation"
16. If not logged in: Privy login modal appears → invitee logs in
17. Frontend sends POST /api/v1/invitations/{token}/accept
18. Backend validates token validity (email match NOT required — see RD-6)
19. Backend updates CompanyMember: userId = invitee's ID, email = invitee's email, status = ACTIVE
20. Backend marks InvitationToken as used
21. Frontend redirects to company dashboard

--- Invitee without account ---
11. Invitee clicks link in email
12. Browser opens https://app.navia.com/invitations/{token}
13. Frontend calls GET /api/v1/invitations/{token} (hasExistingAccount: false)
14. Frontend displays: company info, "Sign up to join" button
15. Invitee clicks "Sign up to join"
16. Privy signup modal appears → invitee creates account (email/Google/Apple)
17. Backend creates User record (via auth login flow)
18. Frontend automatically calls POST /api/v1/invitations/{token}/accept
19. Backend associates new user with CompanyMember
20. Frontend redirects to KYC flow (if required) or company dashboard

POSTCONDITION: New member has ACTIVE status, can access company data per role
```

### Flow 3: Company Context Switching

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

### Flow 4: Company Dissolution

```
PRECONDITION: Company is ACTIVE or INACTIVE, user is ADMIN

1. Admin navigates to "Settings" → "Company" → "Dissolve Company"
2. Frontend shows dissolution requirements:
   - Zero active shareholders ✓/✗
   - No active funding rounds ✓/✗
   - No pending option exercises ✓/✗
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

## Edge Cases & Error Handling

### EC-1: Verifik API Timeout During CNPJ Validation
**Scenario**: Verifik API does not respond within 30 seconds during company setup.
**Handling**:
- Bull job retries up to 3 times with exponential backoff (30s, 60s, 120s)
- After 3 failures, job marks the setup step as FAILED
- Admin is notified via email: "CNPJ validation timed out. Please try again later."
- Admin can trigger a manual retry from the setup-status page

### EC-2: CNPJ Belongs to Dissolved/Inactive Entity in Receita Federal
**Scenario**: The CNPJ is valid in format but has status BAIXADA, SUSPENSA, INAPTA, or NULA.
**Handling**:
- Verifik returns the status; Bull job detects non-ATIVA status
- Company remains in DRAFT with a clear error message
- Admin can update the CNPJ (via PUT /api/v1/companies/:id) and retry
- Error message includes the Receita Federal status for context

### EC-3: Invitation Sent to Email Already a Member
**Scenario**: Admin tries to invite maria@example.com, but she is already an ACTIVE member.
**Handling**:
- Backend returns `409 Conflict` with error code `COMPANY_MEMBER_EXISTS`
- Error message: "This email is already an active member of this company"
- Admin can update the existing member's role instead

### EC-4: User Tries to Accept Expired Invitation
**Scenario**: User clicks invitation link after 7-day expiry.
**Handling**:
- GET /api/v1/invitations/:token returns `410 Gone`
- Frontend shows: "This invitation has expired. Please ask the admin to re-send it."
- Provides company name and admin email for convenience

### EC-5: Last ADMIN Tries to Leave Company
**Scenario**: The only ADMIN tries to change their role or remove themselves.
**Handling**:
- Backend returns `422 Unprocessable Entity` with error code `COMPANY_LAST_ADMIN`
- Error message: "Cannot remove the last admin. Assign another admin first."
- Frontend disables the role change / remove button for the last admin

### EC-6: Concurrent Invitations to Same Email
**Scenario**: Two admins simultaneously try to invite the same email.
**Handling**:
- Database unique constraint on (companyId, email) WHERE status = 'PENDING' prevents duplicate
- Second request fails with `409 Conflict`
- Error message: "An invitation for this email is already pending"

### EC-7: Company with Active Funding Round Cannot Be Dissolved
**Scenario**: Admin tries to dissolve company while a funding round is OPEN.
**Handling**:
- Backend checks for active funding rounds before dissolution
- Returns `422 Unprocessable Entity` with error code `COMPANY_HAS_ACTIVE_ROUNDS`
- Error message includes the active round IDs
- Admin must close or cancel all rounds first

### EC-8: CNPJ Validation Fails After Company Created in DRAFT
**Scenario**: Admin creates company, CNPJ validation fails, admin wants to correct the CNPJ.
**Handling**:
- Admin can update the CNPJ via PUT /api/v1/companies/:id (only while in DRAFT)
- After updating, admin can trigger re-validation from the setup-status page
- A new Bull job is dispatched for the updated CNPJ
- Old CNPJ is released for potential use by another company

### EC-9: User Accepts Invitation With Different Email
**Scenario**: User logs in with a different email than the invitation was sent to (e.g., invitation sent to work email, user signs up with personal email).
**Handling**:
- Acceptance is allowed — email match is NOT required (see RD-6)
- Backend updates CompanyMember with the accepting user's ID and actual email
- Audit log records both the original invitation email and the accepting user's email
- If the accepting user is already an active member, returns `409 Conflict`

### EC-10: Smart Contract Deployment Fails
**Scenario**: OCP contract deployment fails after CNPJ validation succeeds.
**Handling**:
- Bull job retries contract deployment up to 3 times
- After 3 failures, company remains in DRAFT with CNPJ validated but contract pending
- Admin is notified: "Company verification succeeded but contract deployment failed. Our team is investigating."
- Platform admin is also alerted for manual intervention

---

## Dependencies

### Internal Dependencies
- **authentication.md**: User entity with `walletAddress` field — used as smart contract admin
- **user-permissions.md**: Role definitions (ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE) and permission matrix
- **blockchain-integration.md**: OCP smart contract deployment during company setup — **NOTE**: AdminWallet entity is replaced by User.walletAddress via CompanyMember
- **kyc-verification.md**: CNPJ validation is merged — this spec is the canonical CNPJ validation path (see RD-2). kyc-verification.md should reference this spec for company-level CNPJ verification.
- **notifications.md**: Email templates for invitations, status changes, and member notifications

### External Dependencies
- **Verifik**: CNPJ validation against Receita Federal
  - Endpoint: POST /v1/br/cnpj
  - Returns: razão social, situação cadastral, endereço, CNAE, capital social
  - Rate limit: 100 requests/minute
  - SLA: 99.5% uptime
- **AWS SES**: Invitation emails and status notification emails
  - Region: sa-east-1 (São Paulo)
  - Templates: company_invitation, company_active, cnpj_validation_failed
- **Bull (Redis-backed)**: Background job processing
  - Queues: company-setup, cnpj-validation
  - Retry: 3 attempts, exponential backoff
- **Base Network**: OCP smart contract deployment
  - Deployed via Privy-signed transactions
  - Gas sponsored by Privy

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

      // Auto-assign creator as ADMIN
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

    // Dispatch async CNPJ validation job
    await this.companySetupQueue.add('validate-cnpj', {
      companyId: company.id,
      cnpj: dto.cnpj,
      creatorWalletAddress: user.walletAddress,
    });

    return company;
  }
}
```

### CnpjValidationProcessor — Bull Job

```typescript
// /backend/src/company/processors/cnpj-validation.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { VerifikService } from '../../verifik/verifik.service';
import { BlockchainService } from '../../blockchain/blockchain.service';

@Processor('company-setup')
export class CnpjValidationProcessor {
  constructor(
    private prisma: PrismaService,
    private verifik: VerifikService,
    private blockchain: BlockchainService,
  ) {}

  @Process('validate-cnpj')
  async handleCnpjValidation(job: Job<{
    companyId: string;
    cnpj: string;
    creatorWalletAddress: string;
  }>) {
    const { companyId, cnpj, creatorWalletAddress } = job.data;

    // Step 1: Validate CNPJ via Verifik
    const cnpjResult = await this.verifik.validateCnpj(cnpj);

    if (cnpjResult.situacaoCadastral !== 'ATIVA') {
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          cnpjData: cnpjResult,
        },
      });
      throw new Error(
        `CNPJ ${cnpj} has status ${cnpjResult.situacaoCadastral} — expected ATIVA`,
      );
    }

    // Step 2: Store validated CNPJ data
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        cnpjData: cnpjResult,
        cnpjValidatedAt: new Date(),
      },
    });

    // Step 3: Deploy OCP smart contract with creator's wallet as owner
    const contractAddress = await this.blockchain.deployOcpContract({
      ownerAddress: creatorWalletAddress,
      companyId: companyId,
    });

    // Step 4: Activate company
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        contractAddress,
        status: 'ACTIVE',
      },
    });

    return { companyId, status: 'ACTIVE', contractAddress };
  }
}
```

### CompanyMemberService — Invitation Flow

```typescript
// /backend/src/company/company-member.service.ts
import { Injectable, ConflictException, GoneException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { randomBytes } from 'crypto';

@Injectable()
export class CompanyMemberService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async invite(companyId: string, inviterId: string, dto: InviteMemberDto) {
    // Check for existing active member
    const existingActive = await this.prisma.companyMember.findFirst({
      where: { companyId, email: dto.email, status: 'ACTIVE' },
    });
    if (existingActive) {
      throw new ConflictException('This email is already an active member of this company');
    }

    // Check for existing pending invitation
    const existingPending = await this.prisma.companyMember.findFirst({
      where: { companyId, email: dto.email, status: 'PENDING' },
    });
    if (existingPending) {
      throw new ConflictException('An invitation for this email is already pending');
    }

    // Create member + invitation token in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const member = await tx.companyMember.create({
        data: {
          companyId,
          email: dto.email,
          role: dto.role,
          status: 'PENDING',
          invitedBy: inviterId,
          invitedAt: new Date(),
        },
      });

      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await tx.invitationToken.create({
        data: {
          companyMemberId: member.id,
          token,
          expiresAt,
        },
      });

      return { member, token, expiresAt };
    });

    // Send invitation email
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });

    await this.emailService.sendInvitation({
      to: dto.email,
      companyName: company.name,
      role: dto.role,
      inviterName: await this.getInviterName(inviterId),
      token: result.token,
      message: dto.message,
    });

    return result.member;
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.prisma.invitationToken.findUnique({
      where: { token },
      include: { companyMember: true },
    });

    if (!invitation || invitation.usedAt) {
      throw new NotFoundException('Invitation not found or already used');
    }

    if (invitation.expiresAt < new Date()) {
      throw new GoneException('Invitation has expired');
    }

    // Check user is not already an active member
    const existingMember = await this.prisma.companyMember.findFirst({
      where: {
        companyId: invitation.companyMember.companyId,
        userId,
        status: 'ACTIVE',
      },
    });
    if (existingMember) {
      throw new ConflictException('You are already an active member of this company');
    }

    // Check 20-company membership limit
    const membershipCount = await this.prisma.companyMember.count({
      where: { userId, status: { in: ['PENDING', 'ACTIVE'] } },
    });
    if (membershipCount >= 20) {
      throw new UnprocessableEntityException('Maximum of 20 company memberships reached');
    }

    // Accept invitation (email match NOT required — see RD-6)
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.companyMember.update({
        where: { id: invitation.companyMemberId },
        data: {
          userId,
          email: user.email, // Update to accepting user's actual email
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      });

      await tx.invitationToken.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
    });
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

## Security Considerations

### SEC-1: Invitation Token Security
- Tokens MUST be generated using `crypto.randomBytes(32)` (256-bit entropy)
- Tokens MUST be single-use (marked as used after acceptance)
- Tokens MUST expire after 7 days
- Token lookup MUST use constant-time comparison to prevent timing attacks
- Expired and used tokens MUST be retained for audit trail (not deleted)

### SEC-2: Company Data Isolation
- `X-Company-Id` header MUST be validated against user's active memberships on every request
- Prisma middleware MUST enforce company scoping on all company-scoped models
- Cross-company data leakage MUST be prevented at the database query level
- No API endpoint should return data from a company the user does not belong to

### SEC-3: Admin Role Security
- Admin role changes MUST be audit-logged with before/after state
- Only existing ADMIN members can assign or change roles
- The last ADMIN constraint MUST be enforced at the database level (not just application level)
- Consider adding a database trigger or constraint for additional safety

### SEC-4: Smart Contract Admin
- The creator's wallet address determines initial smart contract control (see RD-5)
- When ADMIN role is transferred, the on-chain owner MUST also transfer via `transferOwnership()` (see RD-1)
- The original creator must sign the on-chain transfer — system prompts them when role changes
- Only one wallet address controls the contract at a time (no multi-sig in MVP)
- If the creator is removed without transferring on-chain ownership, the system MUST prompt them to sign the transfer before removal completes

### SEC-5: CNPJ Data Protection (LGPD)
- CNPJ data from Verifik (razão social, endereço, etc.) is public information from Receita Federal
- However, the association between a CNPJ and a platform user should be protected
- CNPJ data MUST be stored encrypted at rest (database-level encryption)
- Access to CNPJ data MUST be scoped to company members only

### SEC-6: Invitation Email Security
- Invitation emails MUST NOT contain sensitive company data beyond name and role
- The invitation link domain MUST match the platform domain
- Emails MUST use SPF, DKIM, and DMARC to prevent spoofing
- Rate limit invitation sending to prevent abuse (max 50 invitations per company per day)

---

## Success Criteria

### Performance
- Company creation (form submit to DRAFT response): < 500ms
- CNPJ validation (end-to-end, including Verifik): < 30 seconds
- Smart contract deployment: < 30 seconds
- Full company setup (DRAFT → ACTIVE): < 60 seconds
- Company list API response: < 200ms
- Member invitation (email sent): < 5 seconds
- Invitation acceptance: < 1 second
- Company context switch (full dashboard reload): < 2 seconds

### Accuracy
- CNPJ validation: 100% accuracy against Receita Federal data
- Zero cross-company data leakage (verified via integration tests)
- Zero orphan companies (every company has at least one ADMIN)

### User Experience
- Company creation flow: < 5 steps
- Invitation acceptance: < 3 clicks
- Company switching: 1 click from navigation bar
- Setup progress visible in real-time during async creation

---

## Resolved Design Decisions (formerly Open Questions)

### RD-1: Smart Contract Admin Transfer — YES
When the ADMIN role is transferred to another user, the on-chain smart contract owner MUST also transfer. The system must initiate an on-chain ownership transfer transaction signed by the current owner's wallet. This requires:
- The current owner (creator) signs an `transferOwnership(newOwner)` transaction via Privy
- The new admin's `User.walletAddress` becomes the new contract owner
- This is triggered automatically when the platform ADMIN role changes (if the new admin is the sole ADMIN)
- If the original creator is removed or demoted, the system prompts them to sign the on-chain transfer
- Audit log records both the platform role change and the on-chain ownership transfer

### RD-2: CompanyKYC and CNPJ Validation — MERGED
CNPJ validation during company creation (this spec) and the KYC spec's CNPJ verification are merged into a single flow. The company creation process in this spec is the canonical CNPJ validation path. `kyc-verification.md` should reference this spec for CNPJ validation rather than defining its own. The Verifik CNPJ call during company setup satisfies both the company verification and the admin's company-level KYC requirement.

### RD-3: Maximum Companies Per User — 20
A user can create or belong to a maximum of **20 companies**. This prevents abuse while accommodating legitimate multi-company users (e.g., venture fund managers, serial entrepreneurs). The limit applies to active memberships (PENDING + ACTIVE CompanyMember records). REMOVED memberships do not count toward the limit. Attempting to create or accept an invitation beyond this limit returns `422 Unprocessable Entity` with error code `COMPANY_MEMBER_LIMIT_REACHED`.

### RD-4: INACTIVE to ACTIVE Re-Validation — NO
Re-activating an INACTIVE company does NOT require re-validation of the CNPJ with Verifik. The original CNPJ validation is sufficient. Re-activation is instant — the admin clicks "Re-activate" and the company status transitions from INACTIVE to ACTIVE immediately.

### RD-5: Multiple ADMINs and Smart Contract — CREATOR ONLY
Only the company creator's wallet controls the smart contract. Other users with ADMIN role have full platform-level permissions but do NOT have on-chain smart contract control. The on-chain owner is always a single wallet address. If the creator transfers the ADMIN role (see RD-1), the new admin's wallet becomes the sole on-chain owner. There is no multi-sig pattern in the MVP.

### RD-6: Invitation Email Mismatch — ALLOWED
Users CAN accept an invitation with a different email than it was sent to. This supports the common case where an invitee signs up with their preferred email (e.g., personal vs work email) or forwards the invitation to a colleague. The acceptance endpoint does NOT check email match — any authenticated user with a valid token can accept. The CompanyMember record is updated with the accepting user's ID and email. An audit log entry records the original invitation email and the accepting user's email for traceability.
