# Investor Portal Specification

**Topic of Concern**: Post-investment tracking dashboard for investors — investor access grants, company updates, portfolio view, and tiered access levels

**One-Sentence Description**: The system allows founders to grant tiered access to company data for investors, who track their portfolio companies via a dedicated portal with company updates, financial highlights, dataroom documents, and (at the highest tier) Q&A chat.

**Complements**:
- `company-profile.md` — public company profile that investors may discover before receiving portal access
- `company-dataroom.md` — document management displayed in the investor portal's Documents tab
- `notifications.md` — notification events triggered by access grants and company updates
- `company-membership.md` — internal team membership (distinct from investor access)
- `authentication.md` — Privy auth, session management, onboarding flow
- `user-permissions.md` — RBAC roles for founder-side endpoints
- `api-standards.md` — response envelope, pagination, error format
- `error-handling.md` — error codes, PII redaction
- `audit-logging.md` — audit events for access grants and updates

---

## Table of Contents

1. [Overview](#overview)
2. [MVP Scope](#mvp-scope)
3. [User Stories](#user-stories)
4. [Functional Requirements](#functional-requirements)
5. [Data Models](#data-models)
6. [API Endpoints](#api-endpoints)
7. [Onboarding Modification](#onboarding-modification)
8. [Business Rules](#business-rules)
9. [Error Codes](#error-codes)
10. [Frontend Specification](#frontend-specification)
11. [Notification Events](#notification-events)
12. [Audit Events](#audit-events)
13. [Security Considerations](#security-considerations)
14. [Backend Module Structure](#backend-module-structure)
15. [Success Criteria](#success-criteria)
16. [Related Specifications](#related-specifications)

---

## Overview

The Investor Portal bridges founders and their investors after an investment is made. Founders grant investors access to their company data at one of three tiers (VIEW, VIEW_FINANCIALS, FULL), and investors consume that data through a dedicated portal experience separate from the founder dashboard.

The key workflows are:

1. **Founder grants access**: A founder adds an investor by email. If the investor already has a Navia account, the company appears in their portfolio immediately. If not, the system sends an invitation email with a registration link.
2. **Investor views portfolio**: Investors see all companies they have access to in a portfolio grid. Each company card shows the company name, sector, logo, and last update date.
3. **Investor drills into a company**: The company detail view has tabs — Overview, Updates, Financials, Documents, Q&A — with tab visibility controlled by the investor's access level.
4. **Founder publishes updates**: Founders create markdown-formatted updates (general, financial, product, team, milestone) that are pushed to all investors with access.

The investor portal is a **separate layout** from the founder dashboard. Investors and founders share the same `User` entity and authentication system but have different navigation experiences based on their user type.

### Relationship to Existing Features

- **CompanyProfile**: The investor portal's Overview tab displays a read-only view of the company profile data (headline, description, sector, metrics, team). It reuses the `CompanyProfile` entity — no duplication.
- **Company Dataroom**: The Documents tab in the investor portal displays dataroom documents from `company-dataroom.md`. Investors can browse and download but not upload or delete.
- **CompanyMember**: Investor portal access (`InvestorAccess`) is separate from company membership (`CompanyMember`). An investor with portal access is NOT a company member and does not appear in the Members section of the founder dashboard. This avoids conflating external investors with internal team roles.
- **Notifications**: Granting access and publishing updates trigger in-app notifications delivered to the investor.

---

## MVP Scope

### In Scope (MVP)

| Feature | Notes |
|---------|-------|
| **Investor access grants** | Founder grants access by email with tiered levels (VIEW, VIEW_FINANCIALS, FULL) |
| **Portfolio view** | Investor sees a grid of all companies they have access to |
| **Company detail tabs** | Overview, Updates, Documents tabs available at VIEW level |
| **Financial highlights** | Available at VIEW_FINANCIALS and FULL levels |
| **Company updates** | Founders create, edit, and publish markdown updates; investors read them |
| **Update type badges** | GENERAL, FINANCIAL, PRODUCT, TEAM, MILESTONE |
| **Onboarding split** | Onboarding asks "Are you a founder or investor?" and routes accordingly |
| **Email-based linking** | When an investor registers, pending access grants are linked by email |
| **Access revocation** | Founder can revoke investor access |
| **Investor portal layout** | Separate layout with top nav (no sidebar) for investor experience |

### Out of Scope (Post-MVP)

| Feature | Reason |
|---------|--------|
| **Q&A chat** | FULL tier feature. Data model includes `FULL` access level, but Q&A UI and backend are deferred to `investor-qa.md` |
| **Open Finance financials** | Financial highlights will initially be manually entered metrics from the profile. Open Finance integration is deferred to `open-finance.md` |
| **Bulk investor import** | No CSV/Excel import for investor lists in MVP. One-by-one via the modal. |
| **Investor-to-founder messaging** | Beyond Q&A, no general messaging system. Use email. |
| **Update attachments** | Updates are markdown text only. No file attachments in MVP. |
| **Update scheduling** | No scheduled publishing. Updates are published immediately. |
| **Update access restrictions** | All published updates are visible to all investors with access. Per-update ACLs deferred. |
| **Portfolio analytics** | No aggregated portfolio value, ROI, or IRR calculations for investors |

---

## User Stories

### US-1: Grant Investor Access

**As a** founder (ADMIN)
**I want to** grant an investor access to my company data by entering their email
**So that** they can track their investment through the Navia platform

### US-2: Manage Investor Access Levels

**As a** founder (ADMIN)
**I want to** set and update the access level for each investor (VIEW, VIEW_FINANCIALS, FULL)
**So that** I can control what data each investor sees based on our relationship

### US-3: Revoke Investor Access

**As a** founder (ADMIN)
**I want to** revoke an investor's access to my company data
**So that** former investors or unauthorized people can no longer view sensitive information

### US-4: View Portfolio

**As an** investor
**I want to** see all companies I have access to in a single portfolio view
**So that** I can track my investments across multiple startups

### US-5: View Company Detail

**As an** investor
**I want to** drill into a specific company to see its profile, updates, financials, and documents
**So that** I can stay informed about the company's progress

### US-6: Read Company Updates

**As an** investor
**I want to** read updates published by the company founder
**So that** I can stay informed about milestones, financial results, and product developments

### US-7: Publish Company Update

**As a** founder (ADMIN or FINANCE)
**I want to** publish an update that is delivered to all my investors
**So that** I can keep investors informed without individual emails

### US-8: Choose User Type at Onboarding

**As a** new user
**I want to** indicate whether I am a founder or an investor during onboarding
**So that** the platform routes me to the correct experience

---

## Functional Requirements

### FR-1: Investor Access Management

- System MUST allow ADMIN users to grant investor access by email address
- System MUST support three access levels: `VIEW`, `VIEW_FINANCIALS`, `FULL`
- System MUST enforce a maximum of **100 investors per company**
- System MUST prevent founders from granting access to their own email (self-grant)
- System MUST prevent duplicate access grants (same email + same company profile)
- System MUST allow ADMIN users to update an investor's access level after grant
- System MUST allow ADMIN users to revoke access (soft delete via `revokedAt` timestamp)
- Revoked access is permanent — to re-grant, the founder creates a new access record
- System MUST track when each investor last viewed the company (`lastViewedAt`)

### FR-2: Investor Account Linking

- When access is granted to an email that matches an existing Navia user, `investorUserId` is populated immediately
- When access is granted to an email without an existing Navia account, `investorUserId` remains null
- System MUST send an `INVESTOR_ACCESS_GRANTED` email to the investor with:
  - Company name and sector
  - Access level description
  - Link to register (if no account) or link to portfolio (if existing account)
- When a new user registers, the system MUST query `InvestorAccess` by email and populate `investorUserId` for all matching non-revoked records
- This linking happens during the registration/onboarding flow, after the `User` record is created

### FR-3: Tiered Access Enforcement

Access level determines which company data an investor can see:

| Data | VIEW | VIEW_FINANCIALS | FULL |
|------|------|-----------------|------|
| Company profile (overview, team, metrics) | Yes | Yes | Yes |
| Company updates (all types) | Yes | Yes | Yes |
| Dataroom documents | Yes | Yes | Yes |
| Financial highlights and snapshots | No | Yes | Yes |
| Q&A chat (post-MVP) | No | No | Yes |

- The backend MUST enforce access level checks on every investor-facing endpoint
- The frontend MUST hide tabs and UI elements that the investor's access level does not permit
- Attempting to access a restricted resource returns `403 Forbidden` with `INVESTOR_ACCESS_REVOKED` or `INVESTOR_INSUFFICIENT_ACCESS`

### FR-4: Company Updates

- System MUST allow ADMIN and FINANCE users to create company updates
- Each update has a title, markdown content, type badge, and public/private flag
- Update types: `GENERAL`, `FINANCIAL`, `PRODUCT`, `TEAM`, `MILESTONE`
- Updates are created in draft state (`publishedAt` = null) and published explicitly
- Publishing sets `publishedAt` and triggers notifications to all investors with active access
- System MUST allow editing updates (title, content, type) after creation
- System MUST allow deleting unpublished updates (hard delete)
- System MUST allow deleting published updates (soft delete — set a `deletedAt` field, or hard delete with audit log)
- Updates are displayed in reverse chronological order (newest first) in the investor portal

### FR-5: Portfolio View

- System MUST provide an aggregated portfolio view for investors
- Portfolio lists all companies where the investor has active (non-revoked) access
- Each portfolio entry shows:
  - Company name and logo (from `CompanyProfile` or `Company`)
  - Sector
  - Access level badge
  - Last update date (most recent `CompanyUpdate.publishedAt`)
  - Last viewed date (from `InvestorAccess.lastViewedAt`)
- Portfolio is sorted by last update date (most recently updated first)
- Viewing a company detail updates `InvestorAccess.lastViewedAt`

### FR-6: Onboarding User Type Selection

- During onboarding, the system MUST ask: "Are you a founder or an investor?"
- User type is stored in the `User` model (new field: `userType` enum: `FOUNDER`, `INVESTOR`)
- **Founder path**: Personal info -> KYC -> Company creation -> Dashboard
- **Investor path**: Personal info -> Portfolio (system checks for pending access by email)
- User type determines the default layout after login:
  - `FOUNDER` -> `/dashboard` (founder dashboard with sidebar)
  - `INVESTOR` -> `/investor/portfolio` (investor portal with top nav)
- A user CAN be both a founder and an investor — the `userType` sets the default experience, but users can switch between them via a toggle in the top nav

---

## Data Models

### InvestorAccess Entity

```typescript
interface InvestorAccess {
  id: string;                              // UUID, primary key
  profileId: string;                       // Foreign key to CompanyProfile
  companyId: string;                       // Foreign key to Company (denormalized for query convenience)
  investorEmail: string;                   // Email of the investor
  investorUserId: string | null;           // Foreign key to User (linked after registration)
  investorName: string | null;             // Display name (provided by founder at grant time)
  accessLevel: InvestorAccessLevel;        // VIEW | VIEW_FINANCIALS | FULL
  grantedBy: string;                       // Foreign key to User (founder who granted)
  grantedAt: Date;                         // When access was granted
  revokedAt: Date | null;                  // When access was revoked (null = active)
  lastViewedAt: Date | null;               // When investor last viewed the company
  createdAt: Date;
  updatedAt: Date;
}

enum InvestorAccessLevel {
  VIEW = 'VIEW',                           // Profile + documents only
  VIEW_FINANCIALS = 'VIEW_FINANCIALS',     // + financial data
  FULL = 'FULL',                           // + Q&A chat (post-MVP)
}
```

### CompanyUpdate Entity

```typescript
interface CompanyUpdate {
  id: string;                              // UUID, primary key
  companyId: string;                       // Foreign key to Company
  profileId: string;                       // Foreign key to CompanyProfile
  authorId: string;                        // Foreign key to User (founder who created)
  title: string;                           // Update title (max 200 chars)
  content: string;                         // Markdown content (max 10000 chars)
  type: CompanyUpdateType;                 // GENERAL | FINANCIAL | PRODUCT | TEAM | MILESTONE
  isPublic: boolean;                       // true = visible to all investors with access
  publishedAt: Date | null;                // null = draft, set = published
  createdAt: Date;
  updatedAt: Date;
}

enum CompanyUpdateType {
  GENERAL = 'GENERAL',
  FINANCIAL = 'FINANCIAL',
  PRODUCT = 'PRODUCT',
  TEAM = 'TEAM',
  MILESTONE = 'MILESTONE',
}
```

### Prisma Schema

```prisma
model InvestorAccess {
  id             String              @id @default(uuid())
  profileId      String              @map("profile_id")
  companyId      String              @map("company_id")
  investorEmail  String              @map("investor_email")
  investorUserId String?             @map("investor_user_id")
  investorName   String?             @map("investor_name")
  accessLevel    InvestorAccessLevel @default(VIEW) @map("access_level")
  grantedBy      String              @map("granted_by")
  grantedAt      DateTime            @default(now()) @map("granted_at")
  revokedAt      DateTime?           @map("revoked_at")
  lastViewedAt   DateTime?           @map("last_viewed_at")
  createdAt      DateTime            @default(now()) @map("created_at")
  updatedAt      DateTime            @updatedAt @map("updated_at")

  // Relations
  profile        CompanyProfile      @relation(fields: [profileId], references: [id])
  company        Company             @relation(fields: [companyId], references: [id])
  grantedByUser  User                @relation("InvestorAccessGrantedBy", fields: [grantedBy], references: [id])
  investorUser   User?               @relation("InvestorAccessInvestor", fields: [investorUserId], references: [id])

  @@unique([profileId, investorEmail])
  @@index([investorEmail])
  @@index([investorUserId])
  @@index([companyId])
  @@index([companyId, revokedAt])
  @@map("investor_access")
}

enum InvestorAccessLevel {
  VIEW
  VIEW_FINANCIALS
  FULL
}

model CompanyUpdate {
  id          String            @id @default(uuid())
  companyId   String            @map("company_id")
  profileId   String            @map("profile_id")
  authorId    String            @map("author_id")
  title       String            @db.VarChar(200)
  content     String            @db.Text
  type        CompanyUpdateType @default(GENERAL)
  isPublic    Boolean           @default(false) @map("is_public")
  publishedAt DateTime?         @map("published_at")
  createdAt   DateTime          @default(now()) @map("created_at")
  updatedAt   DateTime          @updatedAt @map("updated_at")

  // Relations
  company     Company           @relation(fields: [companyId], references: [id])
  profile     CompanyProfile    @relation(fields: [profileId], references: [id])
  author      User              @relation(fields: [authorId], references: [id])

  @@index([companyId, publishedAt])
  @@index([profileId])
  @@index([companyId, type])
  @@map("company_updates")
}

enum CompanyUpdateType {
  GENERAL
  FINANCIAL
  PRODUCT
  TEAM
  MILESTONE
}
```

### User Model Extension

Add the `userType` field to the existing User model:

```prisma
// Add to existing User model
model User {
  // ... existing fields ...
  userType   UserType @default(FOUNDER) @map("user_type")

  // ... existing relations ...
  grantedInvestorAccess InvestorAccess[] @relation("InvestorAccessGrantedBy")
  investorAccess        InvestorAccess[] @relation("InvestorAccessInvestor")
  companyUpdates        CompanyUpdate[]
}

enum UserType {
  FOUNDER
  INVESTOR
}
```

---

## API Endpoints

### Founder-Facing Endpoints

#### POST /api/v1/companies/:companyId/investors

**Description**: Grant investor access to the company by email. Creates an `InvestorAccess` record and sends a notification email.

**Auth**: Required. User must be ADMIN of the company.

**Request**:
```json
{
  "email": "investor@fund.com",
  "name": "Carlos Investidor",
  "accessLevel": "VIEW_FINANCIALS"
}
```

**Validation Rules**:
- `email`: required, valid email format
- `name`: optional, max 100 characters
- `accessLevel`: optional, default `VIEW`, must be `VIEW`, `VIEW_FINANCIALS`, or `FULL`

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "ia_abc123",
    "profileId": "prof_abc123",
    "companyId": "comp_abc123",
    "investorEmail": "investor@fund.com",
    "investorUserId": "user_xyz789",
    "investorName": "Carlos Investidor",
    "accessLevel": "VIEW_FINANCIALS",
    "grantedBy": "user_founder123",
    "grantedAt": "2026-02-26T10:00:00Z",
    "revokedAt": null,
    "lastViewedAt": null
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid email format or access level
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Company not found or user not a member
- `409 Conflict` — Investor already has active access to this company (`INVESTOR_ALREADY_GRANTED`)
- `422 Unprocessable Entity` — Self-grant attempt (`INVESTOR_SELF_GRANT`)
- `422 Unprocessable Entity` — Maximum 100 investors reached (`INVESTOR_LIMIT_REACHED`)

**Side Effects**:
- If email matches an existing user: `investorUserId` is populated
- Sends `INVESTOR_ACCESS_GRANTED` email to the investor
- Creates audit log event: `INVESTOR_ACCESS_GRANTED`
- Creates in-app notification for the investor (if they have an account)

---

#### GET /api/v1/companies/:companyId/investors

**Description**: List all investor access grants for the company, including revoked ones.

**Auth**: Required. User must be ADMIN of the company.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `accessLevel` | string | -- | Filter by access level |
| `search` | string | -- | Search by investor name or email |
| `status` | string | `active` | Filter: `active` (revokedAt is null), `revoked`, `all` |
| `sort` | string | `-grantedAt` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "ia_abc123",
      "investorEmail": "investor@fund.com",
      "investorUserId": "user_xyz789",
      "investorName": "Carlos Investidor",
      "accessLevel": "VIEW_FINANCIALS",
      "grantedBy": "user_founder123",
      "grantedByName": "Nelson Pereira",
      "grantedAt": "2026-02-26T10:00:00Z",
      "revokedAt": null,
      "lastViewedAt": "2026-02-25T14:30:00Z"
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

#### PUT /api/v1/companies/:companyId/investors/:id

**Description**: Update an investor's access level.

**Auth**: Required. User must be ADMIN of the company.

**Request**:
```json
{
  "accessLevel": "FULL"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "ia_abc123",
    "investorEmail": "investor@fund.com",
    "investorName": "Carlos Investidor",
    "accessLevel": "FULL",
    "grantedAt": "2026-02-26T10:00:00Z",
    "revokedAt": null,
    "lastViewedAt": "2026-02-25T14:30:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid access level
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Investor access record not found (`INVESTOR_NOT_FOUND`)
- `422 Unprocessable Entity` — Access already revoked

**Side Effects**:
- Creates audit log event: `INVESTOR_ACCESS_UPDATED`
- Creates in-app notification for the investor (if they have an account)

---

#### DELETE /api/v1/companies/:companyId/investors/:id

**Description**: Revoke investor access. Sets `revokedAt` timestamp (soft delete).

**Auth**: Required. User must be ADMIN of the company.

**Response** (204 No Content): Empty body.

**Error Responses**:
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Investor access record not found (`INVESTOR_NOT_FOUND`)
- `422 Unprocessable Entity` — Access already revoked

**Side Effects**:
- Sets `revokedAt` to current timestamp
- Creates audit log event: `INVESTOR_ACCESS_REVOKED`
- Creates in-app notification for the investor (if they have an account)

---

#### POST /api/v1/companies/:companyId/updates

**Description**: Create a company update (draft or published).

**Auth**: Required. User must be ADMIN or FINANCE of the company.

**Request**:
```json
{
  "title": "Q4 2025 Results",
  "content": "## Financial Highlights\n\nWe closed Q4 with **R$ 2.3M ARR**, up 45% quarter over quarter...",
  "type": "FINANCIAL",
  "isPublic": true,
  "publish": true
}
```

**Validation Rules**:
- `title`: required, max 200 characters
- `content`: required, max 10000 characters
- `type`: optional, default `GENERAL`, must be a valid `CompanyUpdateType`
- `isPublic`: optional, default `false`
- `publish`: optional, default `false`. If `true`, sets `publishedAt` immediately.

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "upd_abc123",
    "companyId": "comp_abc123",
    "profileId": "prof_abc123",
    "authorId": "user_founder123",
    "authorName": "Nelson Pereira",
    "title": "Q4 2025 Results",
    "content": "## Financial Highlights\n\nWe closed Q4 with **R$ 2.3M ARR**...",
    "type": "FINANCIAL",
    "isPublic": true,
    "publishedAt": "2026-02-26T10:00:00Z",
    "createdAt": "2026-02-26T10:00:00Z",
    "updatedAt": "2026-02-26T10:00:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` — Missing required fields, invalid type
- `403 Forbidden` — User is not ADMIN or FINANCE

**Side Effects (when published)**:
- Creates audit log event: `COMPANY_UPDATE_PUBLISHED`
- Sends in-app notification to all investors with active access: `COMPANY_UPDATE_POSTED`

---

#### GET /api/v1/companies/:companyId/updates

**Description**: List company updates. Returns both drafts and published for founders.

**Auth**: Required. User must be ADMIN or FINANCE of the company.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `type` | string | -- | Filter by update type |
| `status` | string | `all` | `draft`, `published`, `all` |
| `sort` | string | `-createdAt` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "upd_abc123",
      "authorId": "user_founder123",
      "authorName": "Nelson Pereira",
      "title": "Q4 2025 Results",
      "content": "## Financial Highlights\n\n...",
      "type": "FINANCIAL",
      "isPublic": true,
      "publishedAt": "2026-02-26T10:00:00Z",
      "createdAt": "2026-02-26T10:00:00Z",
      "updatedAt": "2026-02-26T10:00:00Z"
    }
  ],
  "meta": {
    "total": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

#### PUT /api/v1/companies/:companyId/updates/:id

**Description**: Edit a company update. Can also publish a draft.

**Auth**: Required. User must be ADMIN or FINANCE of the company.

**Request**:
```json
{
  "title": "Q4 2025 Results — Updated",
  "content": "## Financial Highlights\n\nUpdated numbers...",
  "type": "FINANCIAL",
  "publish": true
}
```

**Response** (200 OK): Updated `CompanyUpdate` object in envelope.

**Error Responses**:
- `400 Bad Request` — Invalid fields
- `403 Forbidden` — User is not ADMIN or FINANCE
- `404 Not Found` — Update not found (`UPDATE_NOT_FOUND`)

**Side Effects (when publishing for the first time)**:
- Creates audit log event: `COMPANY_UPDATE_PUBLISHED`
- Sends in-app notification to all investors with active access

---

#### DELETE /api/v1/companies/:companyId/updates/:id

**Description**: Delete a company update.

**Auth**: Required. User must be ADMIN of the company.

**Response** (204 No Content): Empty body.

**Error Responses**:
- `403 Forbidden` — User is not ADMIN
- `404 Not Found` — Update not found (`UPDATE_NOT_FOUND`)

**Side Effects**:
- Creates audit log event: `COMPANY_UPDATE_DELETED`

---

### Investor-Facing Endpoints

#### GET /api/v1/investor/portfolio

**Description**: List all companies the authenticated investor has active access to.

**Auth**: Required. Authenticated user. Returns only records where `investorUserId` matches the current user and `revokedAt` is null.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `search` | string | -- | Search by company name |
| `sort` | string | `-lastUpdateDate` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "ia_abc123",
      "companyId": "comp_abc123",
      "profileId": "prof_abc123",
      "accessLevel": "VIEW_FINANCIALS",
      "grantedAt": "2026-02-26T10:00:00Z",
      "lastViewedAt": "2026-02-25T14:30:00Z",
      "company": {
        "name": "LuminaTech",
        "logoUrl": "https://s3.amazonaws.com/navia/logos/luminatech.png"
      },
      "profile": {
        "slug": "luminatech-a3f2",
        "sector": "FINTECH",
        "headline": "Plataforma de IA para otimização de energia renovável"
      },
      "lastUpdateDate": "2026-02-24T16:00:00Z",
      "unreadUpdatesCount": 2
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

#### GET /api/v1/investor/portfolio/:profileId

**Description**: Get company detail for the investor portal. Returns profile data, access level, and latest update summary.

**Auth**: Required. User must have active `InvestorAccess` to this profile.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "access": {
      "id": "ia_abc123",
      "accessLevel": "VIEW_FINANCIALS",
      "grantedAt": "2026-02-26T10:00:00Z"
    },
    "profile": {
      "id": "prof_abc123",
      "companyId": "comp_abc123",
      "slug": "luminatech-a3f2",
      "headline": "Plataforma de IA para otimização de energia renovável",
      "description": "A LuminaTech é uma plataforma alimentada por IA...",
      "sector": "FINTECH",
      "foundedYear": 2022,
      "website": "https://luminatech.com.br",
      "location": "São Paulo, SP",
      "companyName": "LuminaTech",
      "companyLogoUrl": "https://s3.amazonaws.com/navia/logos/luminatech.png",
      "metrics": [
        {
          "label": "Funcionários",
          "value": "22",
          "format": "NUMBER",
          "icon": "users",
          "order": 0
        }
      ],
      "teamMembers": [
        {
          "name": "Nelson Pereira",
          "title": "CEO & Founder",
          "photoUrl": "https://s3.amazonaws.com/navia/...",
          "linkedinUrl": "https://linkedin.com/in/..."
        }
      ]
    },
    "latestUpdate": {
      "id": "upd_abc123",
      "title": "Q4 2025 Results",
      "type": "FINANCIAL",
      "publishedAt": "2026-02-24T16:00:00Z"
    }
  }
}
```

**Error Responses**:
- `403 Forbidden` — Access revoked (`INVESTOR_ACCESS_REVOKED`)
- `404 Not Found` — No access record found for this user and profile (`INVESTOR_NOT_FOUND`)

**Side Effects**:
- Updates `InvestorAccess.lastViewedAt` to current timestamp

---

#### GET /api/v1/investor/portfolio/:profileId/updates

**Description**: List published company updates for the investor.

**Auth**: Required. User must have active `InvestorAccess` to this profile.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `type` | string | -- | Filter by update type |
| `sort` | string | `-publishedAt` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "upd_abc123",
      "authorName": "Nelson Pereira",
      "title": "Q4 2025 Results",
      "content": "## Financial Highlights\n\n...",
      "type": "FINANCIAL",
      "publishedAt": "2026-02-24T16:00:00Z"
    }
  ],
  "meta": {
    "total": 8,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Note**: Only returns updates where `publishedAt` is not null and `isPublic` is true (or all published updates if no per-update ACL is enforced — MVP behavior).

---

#### GET /api/v1/investor/portfolio/:profileId/financials

**Description**: Get financial highlights for a company. Requires `VIEW_FINANCIALS` or `FULL` access level.

**Auth**: Required. User must have active `InvestorAccess` with `VIEW_FINANCIALS` or `FULL` level.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "metrics": [
      {
        "label": "ARR",
        "value": "2300000",
        "format": "CURRENCY_BRL",
        "icon": "trending-up"
      },
      {
        "label": "MRR",
        "value": "191667",
        "format": "CURRENCY_BRL",
        "icon": "bar-chart"
      }
    ],
    "lastUpdated": "2026-02-20T10:00:00Z"
  }
}
```

**Error Responses**:
- `403 Forbidden` — Access level is `VIEW` (insufficient access level: `INVESTOR_INSUFFICIENT_ACCESS`)
- `403 Forbidden` — Access revoked (`INVESTOR_ACCESS_REVOKED`)
- `404 Not Found` — No access record (`INVESTOR_NOT_FOUND`)

**Note**: In MVP, financial highlights are the profile metrics with `format` of `CURRENCY_BRL`, `CURRENCY_USD`, or `PERCENTAGE`. Post-MVP, this endpoint will integrate with Open Finance data.

---

#### GET /api/v1/investor/portfolio/:profileId/documents

**Description**: List dataroom documents for the company. Available at all access levels.

**Auth**: Required. User must have active `InvestorAccess` to this profile.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `category` | string | -- | Filter by document category |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "doc_abc123",
      "name": "Pitch Deck Q4 2025",
      "category": "PITCH_DECK",
      "fileType": "application/pdf",
      "fileSize": 2456789,
      "pageCount": 15,
      "thumbnailUrl": "https://s3.amazonaws.com/...",
      "downloadUrl": "https://s3.amazonaws.com/...",
      "uploadedAt": "2026-02-20T10:00:00Z"
    }
  ],
  "meta": {
    "total": 6,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Note**: `downloadUrl` is a pre-signed S3 URL with 15-minute expiry, generated at response time. The documents endpoint reuses the dataroom data from `company-dataroom.md`.

---

## Onboarding Modification

### Current Onboarding Flow

```
Privy auth → Personal info → KYC → Company creation → Dashboard
```

### Modified Onboarding Flow

```
Privy auth → User type selection → (branch)
  │
  ├─ [FOUNDER] → Personal info → KYC → Company creation → Dashboard
  │
  └─ [INVESTOR] → Personal info → Portfolio
                       │
                       ├─ [has pending access grants] → Portfolio with companies listed
                       └─ [no pending grants] → Empty portfolio with "You'll see companies here when founders grant you access"
```

### User Type Selection Screen

After Privy authentication and before the personal info form, the user sees a selection screen:

```
┌─────────────────────────────────────────────┐
│                                             │
│  Welcome to Navia                           │
│  How do you plan to use the platform?       │
│                                             │
│  ┌───────────────┐  ┌───────────────┐      │
│  │  🏢            │  │  📊            │      │
│  │  I'm a Founder│  │  I'm an       │      │
│  │               │  │  Investor     │      │
│  │  Create and   │  │  Track your   │      │
│  │  manage your  │  │  portfolio    │      │
│  │  company      │  │  companies    │      │
│  └───────────────┘  └───────────────┘      │
│                                             │
│  You can always access both experiences     │
│  from your settings.                        │
│                                             │
└─────────────────────────────────────────────┘
```

### Investor Account Linking on Registration

When a user completes registration (after the personal info step), the system runs:

```typescript
// Link pending investor access grants by email
async function linkInvestorAccess(userId: string, email: string): Promise<void> {
  await prisma.investorAccess.updateMany({
    where: {
      investorEmail: email,
      investorUserId: null,
      revokedAt: null,
    },
    data: {
      investorUserId: userId,
    },
  });
}
```

This ensures that any access grants issued before the investor registered are immediately available in their portfolio.

---

## Business Rules

### BR-1: Investor Limit

Each company can have a maximum of **100 active (non-revoked) investor access grants**. This limit applies per company, not per profile.

### BR-2: Self-Grant Prevention

A founder cannot grant investor access to their own email address. The system checks if the `email` in the request matches the authenticated user's email and returns `INVESTOR_SELF_GRANT` if so.

### BR-3: Duplicate Prevention

A company profile can have at most one active (non-revoked) access grant per email address. The `@@unique([profileId, investorEmail])` constraint prevents duplicates at the database level. Note: if access was previously revoked, a new grant can be created for the same email.

**Implementation detail**: The unique constraint covers all records including revoked ones. When re-granting access to a previously revoked email, the system must either:
- Create a new record (requires removing the old one from the unique constraint scope), or
- Update the revoked record (set `revokedAt` back to null and update `accessLevel`).

For simplicity in MVP, use the **update approach**: if a grant request comes in for an email that has a revoked record, un-revoke it and update the access level. This avoids unique constraint conflicts.

### BR-4: Profile Required

Investor access grants require a `CompanyProfile` to exist. The `profileId` is derived from the company's profile. If the company has no profile, the grant request returns `404 Not Found`.

### BR-5: Published Profile for Investor View

Investors can only view company details if the company profile is `PUBLISHED`. If the profile status is `DRAFT` or `ARCHIVED`, the investor portal shows a "Company profile is not currently available" message instead of the detail view.

### BR-6: Update Publishing

Only published updates (`publishedAt` is not null) are visible to investors. Draft updates are visible only to founders in the founder dashboard.

### BR-7: User Type Flexibility

The `userType` field sets the default experience but does not restrict access. A `FOUNDER` user who also has investor access grants can access the investor portal. A user can change their default `userType` in settings at any time.

---

## Error Codes

| Error Code | HTTP Status | messageKey | Description |
|------------|-------------|------------|-------------|
| `INVESTOR_ALREADY_GRANTED` | 409 | `errors.investor.alreadyGranted` | Investor already has active access to this company |
| `INVESTOR_NOT_FOUND` | 404 | `errors.investor.notFound` | Investor access record not found |
| `INVESTOR_ACCESS_REVOKED` | 403 | `errors.investor.accessRevoked` | Investor access has been revoked |
| `INVESTOR_INSUFFICIENT_ACCESS` | 403 | `errors.investor.insufficientAccess` | Investor access level does not permit this action |
| `INVESTOR_SELF_GRANT` | 422 | `errors.investor.selfGrant` | Cannot grant investor access to yourself |
| `INVESTOR_LIMIT_REACHED` | 422 | `errors.investor.limitReached` | Maximum of 100 investors per company reached |
| `UPDATE_NOT_FOUND` | 404 | `errors.update.notFound` | Company update not found |
| `UPDATE_ALREADY_PUBLISHED` | 422 | `errors.update.alreadyPublished` | Update is already published |
| `PROFILE_NOT_PUBLISHED` | 422 | `errors.profile.notPublished` | Company profile must be published for this action |

### i18n Translations

**PT-BR** (`messages/pt-BR.json`):
```json
{
  "errors": {
    "investor": {
      "alreadyGranted": "Este investidor já possui acesso a esta empresa",
      "notFound": "Acesso de investidor não encontrado",
      "accessRevoked": "O acesso do investidor foi revogado",
      "insufficientAccess": "Nível de acesso insuficiente para esta ação",
      "selfGrant": "Você não pode conceder acesso de investidor a si mesmo",
      "limitReached": "Limite máximo de 100 investidores por empresa atingido"
    },
    "update": {
      "notFound": "Atualização não encontrada",
      "alreadyPublished": "Esta atualização já foi publicada"
    },
    "profile": {
      "notPublished": "O perfil da empresa deve estar publicado para esta ação"
    }
  }
}
```

**EN** (`messages/en.json`):
```json
{
  "errors": {
    "investor": {
      "alreadyGranted": "This investor already has access to this company",
      "notFound": "Investor access not found",
      "accessRevoked": "Investor access has been revoked",
      "insufficientAccess": "Insufficient access level for this action",
      "selfGrant": "You cannot grant investor access to yourself",
      "limitReached": "Maximum of 100 investors per company reached"
    },
    "update": {
      "notFound": "Update not found",
      "alreadyPublished": "This update has already been published"
    },
    "profile": {
      "notPublished": "Company profile must be published for this action"
    }
  }
}
```

---

## Frontend Specification

### Page Routing

#### Founder Dashboard Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/companies/:companyId/investors` | `InvestorListPage` | List all investor access grants |
| `/companies/:companyId/updates` | `UpdatesListPage` | List all company updates |
| `/companies/:companyId/updates/new` | `UpdateEditorPage` | Create a new update |
| `/companies/:companyId/updates/:id/edit` | `UpdateEditorPage` | Edit an existing update |

#### Investor Portal Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/investor/portfolio` | `PortfolioPage` | Grid of all companies the investor has access to |
| `/investor/portfolio/:profileId` | `CompanyDetailPage` | Company detail with tabs |

### Founder Dashboard — Investor Management Page

```
┌─────────────────────────────────────────────────────────┐
│  h1: Investidores                   [+ Convidar Investidor] │
│  body-sm: Gerencie o acesso dos investidores à sua empresa │
├─────────────────────────────────────────────────────────┤
│  Search: [🔍 Buscar por nome ou email...]               │
│  Filter: [Nível de Acesso ▾]  [Status ▾]               │
├─────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐ │
│  │ Nome             │ Email        │ Nível    │ Data  │ │
│  │                  │              │ Acesso   │ Grant │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Carlos Investidor│ inv@fund.com │ [VIEW ▾] │ 26/02 │ │
│  │                  │              │          │ ●14h  │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Maria Santos     │ m@vc.com     │ [FULL ▾] │ 20/02 │ │
│  │                  │              │          │ ●Nunca│ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  Mostrando 1-2 de 2                                     │
└─────────────────────────────────────────────────────────┘
```

**Layout details**:
- Page header follows standard pattern (see design-system.md Section 5.5)
- Table columns: Name, Email, Access Level (inline dropdown for editing), Granted Date, Last Viewed, Actions (revoke button)
- Inline access level dropdown allows changing the level without opening a modal
- "Last Viewed" shows the relative time since the investor last accessed the company (e.g., "14h ago") or "Nunca" if never viewed
- Revoke action: ghost destructive button with confirmation dialog
- Empty state: "Nenhum investidor com acesso. Convide investidores para acompanhar sua empresa."

### Invite Investor Modal

Triggered by the "+ Convidar Investidor" button. Uses shadcn/ui `Dialog`.

```
┌────────────────────────────────────────┐
│  Convidar Investidor               [X] │
├────────────────────────────────────────┤
│                                         │
│  Email *                                │
│  [investor@fund.com                   ] │
│                                         │
│  Nome                                   │
│  [Carlos Investidor                   ] │
│                                         │
│  Nível de Acesso *                      │
│  [VIEW_FINANCIALS            ▾]         │
│                                         │
│  ○ Visualização — Perfil e documentos   │
│  ● Financeiro — + dados financeiros     │
│  ○ Completo — + chat Q&A               │
│                                         │
│  [Cancelar]               [Convidar]    │
└────────────────────────────────────────┘
```

**Modal behavior**:
1. Email field is required, validated for format
2. Name is optional (displayed in the investor list for identification)
3. Access level is a radio group with descriptions for each tier
4. On submit: calls `POST /api/v1/companies/:companyId/investors`
5. On success: close modal, refresh investor list, show success toast
6. On error: show inline error (duplicate, self-grant, limit reached)

### Founder Dashboard — Updates List Page

```
┌─────────────────────────────────────────────────────────┐
│  h1: Atualizações                      [+ Nova Atualização] │
│  body-sm: Mantenha seus investidores informados             │
├─────────────────────────────────────────────────────────┤
│  Filter: [Tipo ▾]  [Status ▾]                           │
├─────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐ │
│  │ ■ Q4 2025 Results                                  │ │
│  │   [FINANCEIRO] • Publicado em 24/02/2026           │ │
│  │   Por Nelson Pereira                               │ │
│  │                                    [Editar] [🗑]    │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ■ New CTO Announcement                             │ │
│  │   [EQUIPE] • Rascunho                              │ │
│  │   Por Nelson Pereira                               │ │
│  │                          [Publicar] [Editar] [🗑]   │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Layout details**:
- Updates displayed as cards (not a table), ordered by `createdAt` descending
- Each card shows: title, type badge (colored per type), status (Publicado/Rascunho), author name, date
- Draft updates show a "Publicar" button
- Published updates show date of publication
- Delete requires confirmation dialog

### Update Editor Page

```
┌─────────────────────────────────────────────────────────┐
│  h1: Nova Atualização          [Salvar Rascunho] [Publicar] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Título *                                               │
│  [Q4 2025 Results                                     ] │
│                                                         │
│  Tipo                                                   │
│  [FINANCEIRO ▾]                                         │
│                                                         │
│  Conteúdo *                                             │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ## Financial Highlights                             │ │
│  │                                                     │ │
│  │ We closed Q4 with **R$ 2.3M ARR**, up 45%         │ │
│  │ quarter over quarter...                             │ │
│  │                                                     │ │
│  │ ### Key Metrics                                     │ │
│  │ - ARR: R$ 2.300.000                                │ │
│  │ - MRR: R$ 191.667                                  │ │
│  │ - Clients: 45                                       │ │
│  │                                                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ☐ Visível para todos os investidores com acesso        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Editor behavior**:
- Title input: max 200 characters
- Type selector: dropdown with update types
- Content: textarea with markdown support (plain textarea in MVP, no rich editor)
- "Visível para todos" checkbox sets `isPublic`
- "Salvar Rascunho" saves without publishing (`publish: false`)
- "Publicar" saves and publishes (`publish: true`) with confirmation dialog: "Publicar enviará notificações para X investidores. Continuar?"
- On edit: pre-populate all fields from existing update

### Type Badge Colors

| Type | Badge Background | Badge Text |
|------|-----------------|------------|
| GENERAL | `gray-100` | `gray-600` |
| FINANCIAL | `blue-50` | `blue-600` |
| PRODUCT | `green-100` | `green-700` |
| TEAM | `cream-100` | `cream-700` |
| MILESTONE | `navy-50` | `navy-700` |

### Investor Portal — Layout

The investor portal uses a **separate layout** from the founder dashboard. No sidebar — just a top navigation bar.

```
┌─────────────────────────────────────────────────────────┐
│  [Navia Logo]  Portfolio  │  🔔  │  Avatar + Name  ▾   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Content Area                                           │
│  padding: 32px                                          │
│  background: gray-50                                    │
│  max-width: 1280px (centered)                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Top nav elements**:
- Navia logo (links to `/investor/portfolio`)
- "Portfolio" nav link
- Notification bell (same as founder dashboard)
- User avatar + name with dropdown (Settings, Switch to Founder Dashboard, Logout)
- "Switch to Founder Dashboard" appears only if user has `userType: FOUNDER` or has any active company memberships

### Investor Portal — Portfolio Page

```
┌─────────────────────────────────────────────────────────┐
│  h1: Meu Portfólio                                      │
│  body-sm: Acompanhe as empresas do seu portfólio        │
├─────────────────────────────────────────────────────────┤
│  Search: [🔍 Buscar empresa...]                         │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ [Logo]           │  │ [Logo]           │            │
│  │ LuminaTech       │  │ GreenEnergy      │            │
│  │ FINTECH          │  │ CLEANTECH        │            │
│  │                  │  │                  │            │
│  │ VIEW_FINANCIALS  │  │ VIEW             │            │
│  │ Última atualiz.: │  │ Última atualiz.: │            │
│  │ 24/02/2026       │  │ 15/02/2026       │            │
│  │ 2 novas          │  │                  │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
│  Empty State (when no companies):                       │
│  "Você verá as empresas aqui quando os fundadores       │
│   concederem acesso."                                   │
└─────────────────────────────────────────────────────────┘
```

**Layout details**:
- Company cards in a responsive grid: 3 columns (lg), 2 columns (md), 1 column (sm)
- Each card shows: company logo (or initials fallback), name, sector badge, access level badge, last update date, unread updates count
- Cards are clickable — navigates to `/investor/portfolio/:profileId`
- "X novas" badge in green if there are updates since `lastViewedAt`
- Empty state includes description text and no CTA button (investors cannot self-add companies)

### Investor Portal — Company Detail Page

```
┌─────────────────────────────────────────────────────────┐
│  ← Voltar ao Portfólio                                  │
│                                                         │
│  [Logo] LuminaTech                                      │
│  FINTECH • São Paulo, SP • luminatech.com.br            │
│  Acesso: VIEW_FINANCIALS                                │
├─────────────────────────────────────────────────────────┤
│  [Visão Geral] [Atualizações] [Financeiro] [Documentos]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Tab Content                                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Tab visibility by access level**:

| Tab | VIEW | VIEW_FINANCIALS | FULL |
|-----|------|-----------------|------|
| Visão Geral | Yes | Yes | Yes |
| Atualizações | Yes | Yes | Yes |
| Financeiro | No | Yes | Yes |
| Documentos | Yes | Yes | Yes |
| Q&A | No | No | Yes (post-MVP) |

**Tab content**:
- **Visão Geral**: Read-only company profile — headline, description, metrics cards, founding team cards
- **Atualizações**: Chronological feed of published updates with type badges and markdown rendering
- **Financeiro**: Financial metric cards (reuses profile metrics with financial formats). Placeholder for Open Finance data post-MVP.
- **Documentos**: Dataroom document list with category tabs, same as public profile view. Download via pre-signed URLs.
- **Q&A**: Post-MVP — deferred to `investor-qa.md`

### i18n Keys

**`investor.*` namespace**:

| Key | PT-BR | EN |
|-----|-------|----|
| `investor.title` | `Investidores` | `Investors` |
| `investor.portfolio` | `Meu Portfólio` | `My Portfolio` |
| `investor.portfolio.description` | `Acompanhe as empresas do seu portfólio` | `Track your portfolio companies` |
| `investor.portfolio.empty` | `Você verá as empresas aqui quando os fundadores concederem acesso.` | `You'll see companies here when founders grant you access.` |
| `investor.accessLevel` | `Nível de Acesso` | `Access Level` |
| `investor.accessLevel.view` | `Visualização` | `View` |
| `investor.accessLevel.viewDescription` | `Perfil e documentos` | `Profile and documents` |
| `investor.accessLevel.viewFinancials` | `Financeiro` | `Financial` |
| `investor.accessLevel.viewFinancialsDescription` | `+ dados financeiros` | `+ financial data` |
| `investor.accessLevel.full` | `Completo` | `Full` |
| `investor.accessLevel.fullDescription` | `+ chat Q&A` | `+ Q&A chat` |
| `investor.grantAccess` | `Convidar Investidor` | `Invite Investor` |
| `investor.revoke` | `Revogar Acesso` | `Revoke Access` |
| `investor.revoke.confirm` | `Tem certeza que deseja revogar o acesso deste investidor?` | `Are you sure you want to revoke this investor's access?` |
| `investor.lastViewed` | `Última visualização` | `Last viewed` |
| `investor.lastViewed.never` | `Nunca` | `Never` |
| `investor.grantedAt` | `Acesso concedido em` | `Access granted on` |
| `investor.search` | `Buscar por nome ou email...` | `Search by name or email...` |
| `investor.empty` | `Nenhum investidor com acesso. Convide investidores para acompanhar sua empresa.` | `No investors with access. Invite investors to track your company.` |
| `investor.backToPortfolio` | `Voltar ao Portfólio` | `Back to Portfolio` |
| `investor.access` | `Acesso` | `Access` |
| `investor.profileUnavailable` | `O perfil da empresa não está disponível no momento.` | `The company profile is not currently available.` |

**`updates.*` namespace**:

| Key | PT-BR | EN |
|-----|-------|----|
| `updates.title` | `Atualizações` | `Updates` |
| `updates.description` | `Mantenha seus investidores informados` | `Keep your investors informed` |
| `updates.newUpdate` | `Nova Atualização` | `New Update` |
| `updates.editUpdate` | `Editar Atualização` | `Edit Update` |
| `updates.type` | `Tipo` | `Type` |
| `updates.type.general` | `Geral` | `General` |
| `updates.type.financial` | `Financeiro` | `Financial` |
| `updates.type.product` | `Produto` | `Product` |
| `updates.type.team` | `Equipe` | `Team` |
| `updates.type.milestone` | `Marco` | `Milestone` |
| `updates.publish` | `Publicar` | `Publish` |
| `updates.publish.confirm` | `Publicar enviará notificações para {count} investidores. Continuar?` | `Publishing will send notifications to {count} investors. Continue?` |
| `updates.saveDraft` | `Salvar Rascunho` | `Save Draft` |
| `updates.status.draft` | `Rascunho` | `Draft` |
| `updates.status.published` | `Publicado` | `Published` |
| `updates.editor` | `Editor` | `Editor` |
| `updates.editor.title` | `Título` | `Title` |
| `updates.editor.content` | `Conteúdo` | `Content` |
| `updates.editor.contentPlaceholder` | `Escreva sua atualização em Markdown...` | `Write your update in Markdown...` |
| `updates.editor.isPublic` | `Visível para todos os investidores com acesso` | `Visible to all investors with access` |
| `updates.empty` | `Nenhuma atualização publicada ainda.` | `No updates published yet.` |
| `updates.delete.confirm` | `Tem certeza que deseja excluir esta atualização?` | `Are you sure you want to delete this update?` |

**`onboarding.*` namespace (additions)**:

| Key | PT-BR | EN |
|-----|-------|----|
| `onboarding.userType.title` | `Bem-vindo ao Navia` | `Welcome to Navia` |
| `onboarding.userType.subtitle` | `Como você planeja usar a plataforma?` | `How do you plan to use the platform?` |
| `onboarding.userType.founder` | `Sou Fundador` | `I'm a Founder` |
| `onboarding.userType.founderDescription` | `Crie e gerencie sua empresa` | `Create and manage your company` |
| `onboarding.userType.investor` | `Sou Investidor` | `I'm an Investor` |
| `onboarding.userType.investorDescription` | `Acompanhe as empresas do seu portfólio` | `Track your portfolio companies` |
| `onboarding.userType.note` | `Você pode acessar ambas as experiências nas configurações.` | `You can always access both experiences from your settings.` |

---

## Notification Events

### Investor Portal Notifications

| Event | Recipient | Notification Type | When Triggered |
|-------|-----------|-------------------|----------------|
| Investor access granted | Investor | `INVESTOR_ACCESS_GRANTED` | Founder grants access |
| Access level changed | Investor | `INVESTOR_ACCESS_UPDATED` | Founder updates access level |
| Access revoked | Investor | `INVESTOR_ACCESS_REVOKED` | Founder revokes access |
| Company update published | All investors with access | `COMPANY_UPDATE_POSTED` | Founder publishes an update |

### Notification Content

**INVESTOR_ACCESS_GRANTED**:
- Subject (PT-BR): `[Navia] {companyName} concedeu acesso ao portal de investidores`
- Subject (EN): `[Navia] {companyName} granted investor portal access`
- Body: Company name, access level description, link to portfolio

**COMPANY_UPDATE_POSTED**:
- Subject (PT-BR): `[Navia] Nova atualização de {companyName}: {updateTitle}`
- Subject (EN): `[Navia] New update from {companyName}: {updateTitle}`
- Body: Update title, type, preview of content (first 200 chars), link to full update

---

## Audit Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|----------------|
| `INVESTOR_ACCESS_GRANTED` | InvestorAccess | USER | Founder grants investor access |
| `INVESTOR_ACCESS_UPDATED` | InvestorAccess | USER | Founder updates access level |
| `INVESTOR_ACCESS_REVOKED` | InvestorAccess | USER | Founder revokes access |
| `INVESTOR_ACCESS_LINKED` | InvestorAccess | SYSTEM | Investor account linked by email on registration |
| `COMPANY_UPDATE_CREATED` | CompanyUpdate | USER | Founder creates an update (draft) |
| `COMPANY_UPDATE_PUBLISHED` | CompanyUpdate | USER | Founder publishes an update |
| `COMPANY_UPDATE_UPDATED` | CompanyUpdate | USER | Founder edits an update |
| `COMPANY_UPDATE_DELETED` | CompanyUpdate | USER | Founder deletes an update |
| `INVESTOR_PORTFOLIO_VIEWED` | InvestorAccess | USER | Investor views a company in portfolio |

### Audit Payload Examples

**INVESTOR_ACCESS_GRANTED**:
```json
{
  "action": "INVESTOR_ACCESS_GRANTED",
  "resourceType": "InvestorAccess",
  "resourceId": "ia_abc123",
  "changes": {
    "before": null,
    "after": {
      "investorEmail": "i***@fund.com",
      "investorName": "Carlos Investidor",
      "accessLevel": "VIEW_FINANCIALS"
    }
  }
}
```

**INVESTOR_ACCESS_UPDATED**:
```json
{
  "action": "INVESTOR_ACCESS_UPDATED",
  "resourceType": "InvestorAccess",
  "resourceId": "ia_abc123",
  "changes": {
    "before": { "accessLevel": "VIEW_FINANCIALS" },
    "after": { "accessLevel": "FULL" }
  }
}
```

---

## Security Considerations

### Access Control

- **Founder endpoints** (`/api/v1/companies/:companyId/investors`, `/api/v1/companies/:companyId/updates`): Protected by standard company membership + role check. Only ADMIN can manage investors. ADMIN and FINANCE can manage updates.
- **Investor endpoints** (`/api/v1/investor/*`): Protected by authentication + `InvestorAccess` record check. Every request verifies that the authenticated user has an active (non-revoked) access grant for the requested profile.
- Investor endpoints do NOT use the company membership RBAC system — they use the `InvestorAccess` table for authorization.

### Data Isolation

- Investors can ONLY see data from companies they have been explicitly granted access to
- The portfolio endpoint filters by `investorUserId = currentUser.id AND revokedAt IS NULL`
- Company detail endpoints verify access for the specific `profileId` before returning any data
- Financial data is additionally gated by access level (`VIEW_FINANCIALS` or `FULL`)

### PII in Investor Access

- Investor email is stored in `InvestorAccess.investorEmail` for linking purposes
- In audit logs, email is masked: `i***@fund.com`
- Investor name is stored in cleartext (same treatment as shareholder names — see audit-logging.md)

### Rate Limiting

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| Investor grant (POST) | 30/min | Write tier |
| Investor list (GET) | 100/min | Read tier |
| Portfolio (GET) | 100/min | Read tier |
| Company detail (GET) | 100/min | Read tier |
| Update create (POST) | 30/min | Write tier |

### Enumeration Prevention

- If an authenticated user requests `/api/v1/investor/portfolio/:profileId` for a profile they do not have access to, return `404 Not Found` (not `403 Forbidden`) to prevent enumeration of company profiles.

---

## Backend Module Structure

```
backend/src/investor-portal/
├── investor-portal.module.ts          # Module registration
├── investor-portal.controller.ts      # Founder-facing endpoints (company-scoped)
├── investor-view.controller.ts        # Investor-facing endpoints (user-scoped)
├── services/
│   ├── investor-access.service.ts     # Grant, revoke, update, link, list access
│   └── company-updates.service.ts     # Create, edit, publish, delete, list updates
├── dto/
│   ├── grant-investor-access.dto.ts   # Validation for POST /investors
│   ├── update-investor-access.dto.ts  # Validation for PUT /investors/:id
│   ├── create-company-update.dto.ts   # Validation for POST /updates
│   ├── update-company-update.dto.ts   # Validation for PUT /updates/:id
│   └── investor-query.dto.ts          # Pagination/filter DTOs
├── guards/
│   └── investor-access.guard.ts       # Verifies InvestorAccess for investor-facing endpoints
├── decorators/
│   └── investor-access-level.decorator.ts # @RequireAccessLevel(VIEW_FINANCIALS)
└── investor-portal.constants.ts       # Max investors limit, etc.
```

### Guard Implementation

The `InvestorAccessGuard` is applied to all investor-facing endpoints:

```typescript
@Injectable()
export class InvestorAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    const profileId = request.params.profileId;

    if (!userId || !profileId) return false;

    const access = await this.prisma.investorAccess.findFirst({
      where: {
        investorUserId: userId,
        profileId,
        revokedAt: null,
      },
    });

    if (!access) {
      throw new NotFoundException('investor', profileId);
    }

    // Attach access record to request for downstream use
    request['investorAccess'] = access;
    return true;
  }
}
```

### Access Level Decorator

```typescript
export const REQUIRED_ACCESS_LEVEL_KEY = 'requiredAccessLevel';

export const RequireAccessLevel = (level: InvestorAccessLevel) =>
  SetMetadata(REQUIRED_ACCESS_LEVEL_KEY, level);

// Used in controller:
@Get('financials')
@RequireAccessLevel(InvestorAccessLevel.VIEW_FINANCIALS)
async getFinancials(@Param('profileId') profileId: string) { ... }
```

---

## Success Criteria

- [ ] Founder can grant investor access by email with access level selection
- [ ] Founder can list, update, and revoke investor access grants
- [ ] System enforces maximum 100 investors per company
- [ ] System prevents self-grant and duplicate grants
- [ ] Investor access is linked by email when investor registers on the platform
- [ ] Investor portal displays a portfolio grid of all companies with active access
- [ ] Company detail page shows tabs with content gated by access level
- [ ] Financial data is hidden from investors with VIEW access level
- [ ] Company updates can be created, edited, published, and deleted by founders
- [ ] Published updates trigger notifications to all investors with active access
- [ ] Updates feed displays in reverse chronological order for investors
- [ ] Onboarding asks user type and routes founders vs investors correctly
- [ ] User type can be changed in settings without losing access to either experience
- [ ] Investor portal uses a separate layout with top nav (no sidebar)
- [ ] All error codes have PT-BR and EN translations
- [ ] Audit events fire for all access grant, revoke, update, and view actions
- [ ] Access revocation immediately prevents further access to company data
- [ ] Investor endpoints return 404 (not 403) for profiles the user cannot access
- [ ] All API responses use the standard envelope format with pagination

---

## Related Specifications

- **[company-profile.md](./company-profile.md)** — Company profile data displayed in the investor portal's Overview tab
- **[company-dataroom.md](./company-dataroom.md)** — Document management for the Documents tab
- **[notifications.md](./notifications.md)** — Notification delivery for access grants and company updates
- **[authentication.md](./authentication.md)** — User authentication and onboarding flow modifications
- **[company-membership.md](./company-membership.md)** — Internal team membership (distinct from investor access)
- **[user-permissions.md](./user-permissions.md)** — RBAC roles for founder-side endpoint authorization
- **[reports-analytics.md](./reports-analytics.md)** — Investor portfolio view in reports
- **investor-qa.md** (planned) — Q&A chat feature for FULL access level
- **open-finance.md** (planned) — Open Finance integration for financial highlights
