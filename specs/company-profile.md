# Company Profile Specification

**Topic of Concern**: Public-facing company profile for fundraising and investor relations — profile CRUD, key metrics, founding team, sharing/access controls, publishing lifecycle, and view analytics

**One-Sentence Description**: The system provides a shareable company profile page where founders curate key startup information — description, metrics, and founding team — that can be shared with investors and stakeholders via a unique link with optional access controls and view analytics.

---

## Overview

The Company Profile is a curated, outward-facing view of a company on the Navia platform. It differs from the internal company settings (managed in `company-management.md`) in that it is designed to be shared externally — primarily with prospective investors during fundraising or due diligence.

The profile page includes:
- **Company overview**: name, sector, founding year, and a rich-text description
- **Key metrics**: employee count, ARR, MRR, or other financial metrics the founder chooses to display
- **Founding team**: team member cards with name, role/title, and photo
- **Share functionality**: unique shareable link with optional password protection and access tracking
- **Dataroom documents**: uploaded files organized by category — see [company-dataroom.md](./company-dataroom.md)
- **Litigation verification**: automatic BigDataCorp litigation check — see [company-litigation-verification.md](./company-litigation-verification.md)

The profile is **opt-in** — companies start with no profile. An ADMIN explicitly creates and publishes it. Data entered on the profile is separate from internal company data (e.g., the `description` on the profile may differ from `Company.description`).

### Relationship to Existing Features

- **company-management.md**: The profile reads the company's `name`, `logoUrl`, `foundedDate`, and `entityType` from the Company entity as defaults, but all profile fields are independently editable.
- **company-dataroom.md**: Dataroom document management is specified separately. Documents are uploaded files (PDFs, images) stored in a separate S3 prefix.
- **company-litigation-verification.md**: Automatic litigation check via BigDataCorp is specified separately. Litigation fields on CompanyProfile are system-managed and immutable.
- **reports-analytics.md**: The due diligence package export is an auto-generated ZIP of company data. The dataroom is a manually curated set of documents chosen by the founder.
- **user-permissions.md**: Only ADMIN and FINANCE roles can edit the profile. The shared link provides read-only access to external viewers without a Navia account.

---

## MVP Scope

### In Scope (MVP)

| Feature | Notes |
|---------|-------|
| **Public access** | Profiles shared via unique URL, accessible without authentication |
| **Email-gated access** | Viewer enters email before viewing; email recorded for analytics |
| **Profile editor** | Tabbed editor for info, metrics, team, documents, share settings, analytics |
| **Key metrics** | Up to 6 custom metrics with format options and icon selector |
| **Founding team** | Up to 10 team members with photo upload, drag-and-drop reordering |
| **Dataroom documents (linked)** | Documents displayed on the profile are managed in the Dataroom feature and linked here — no separate upload on the profile |
| **Litigation display** | Summary view on public profile with expandable full details on click; one-time fetch at profile creation |
| **View analytics** | Total/unique views, timeline chart, top document downloads, recent viewers |
| **Share modal** | Copy link, access type selector, custom slug editor |
| **Preview mode** | Inline preview of public profile layout without publishing |
| **Publishing lifecycle** | DRAFT -> PUBLISHED -> ARCHIVED status transitions with appropriate access control |
| **Name/logo sync** | Company name and logo are pre-populated from the Company entity at profile creation, then independently editable on the profile |

### Out of Scope (Post-MVP)

| Feature | Reason |
|---------|--------|
| **Password protection** | `accessType: PASSWORD` is defined in the data model but not implemented in the frontend for MVP. Only `PUBLIC` and `EMAIL_GATED` are available in the UI. |
| **Litigation re-fetch** | Litigation data is fetched once at profile creation via BigDataCorp. Manual or scheduled re-fetch is not available in MVP. |
| **Concurrent edit conflict detection** | Last-write-wins strategy is used. No optimistic locking, conflict detection UI, or real-time collaboration indicators in MVP. |
| **Auto-save** | Profile edits require an explicit save action. Auto-save with debounce may be added post-MVP. |
| **QR code generation** | QR code for the share URL is optional and may be deferred to post-MVP. |

---

## User Stories

### US-1: Create Company Profile
**As an** admin user
**I want to** create a public profile for my company with a description, metrics, and team information
**So that** I can showcase my startup to prospective investors in a professional format

### US-2: Manage Founding Team
**As an** admin user
**I want to** add, edit, and reorder founding team members on the profile
**So that** investors can see who leads the company

### US-3: Share Profile with Investors
**As an** admin user
**I want to** share a link to my company profile with prospective investors
**So that** they can view the profile and dataroom without needing a Navia account

### US-4: Protect Shared Profile
**As an** admin user
**I want to** optionally protect the shared profile link with a password or email-gated access
**So that** only intended recipients can view sensitive company information

### US-5: Track Profile Views
**As an** admin user
**I want to** see who viewed my company profile and when
**So that** I can gauge investor interest and follow up accordingly

### US-6: Preview and Publish Profile
**As an** admin user
**I want to** preview the profile before publishing and toggle its visibility
**So that** I control when the profile becomes accessible via the shared link

---

## Functional Requirements

### FR-1: Company Profile CRUD
- System MUST allow ADMIN users to create a company profile
- System MUST allow ADMIN and FINANCE users to edit the profile
- Each company has at most one profile (1:1 relationship)
- Profile starts in `DRAFT` status — not accessible via shared link until published
- System MUST support the following profile fields:
  - `headline`: short tagline (max 200 characters)
  - `description`: rich-text company description (max 5000 characters, stored as plain text with line breaks)
  - `sector`: industry/sector category (selected from predefined list)
  - `foundedYear`: year the company was founded (integer, 1900–current year)
  - `website`: company website URL (optional)
  - `location`: city and state (optional, free text, max 100 characters)
- System MUST pre-populate `foundedYear` from `Company.foundedDate` if available
- System MUST pre-populate company name and logo from the Company entity

### FR-2: Key Metrics
- System MUST allow up to **6 key metrics** on the profile
- Each metric has:
  - `label`: display name (e.g., "Funcionários", "ARR", "MRR", "Receita Mensal")
  - `value`: numeric or text value (e.g., "22", "22680000", "SaaS B2B")
  - `format`: display format — `NUMBER`, `CURRENCY_BRL`, `CURRENCY_USD`, `PERCENTAGE`, `TEXT`
  - `icon`: optional icon identifier from Lucide icon set (e.g., `users`, `trending-up`, `building`)
  - `order`: display order (0-indexed)
- System MUST format values according to Brazilian number formatting rules (see i18n.md)
- ADMIN can add, edit, reorder, and remove metrics
- Predefined metric templates available: Funcionários, ARR, MRR, Receita Mensal, Clientes, Setor

### FR-3: Founding Team
- System MUST allow adding team members to the profile
- Each team member has:
  - `name`: full name (required, max 100 characters)
  - `title`: role/position (required, max 100 characters, e.g., "CEO & Founder", "CTO & Co-founder")
  - `photoUrl`: profile photo (optional, uploaded to S3, max 2 MB, PNG/JPG)
  - `linkedinUrl`: LinkedIn profile URL (optional)
  - `order`: display order (0-indexed)
- System MUST support up to **10 team members** per profile
- System MUST display initials avatar when no photo is uploaded (using the member's first and last name initials)
- ADMIN can add, edit, reorder, and remove team members
- Team members on the profile are independent from CompanyMember records — they may include people who are not Navia users

### FR-5: Profile Sharing
- System MUST generate a unique shareable URL for each published profile
- URL format: `https://app.navia.com.br/p/{slug}` where `slug` is a URL-safe identifier
- `slug` is auto-generated from the company name (slugified, lowercase, hyphenated) with a random suffix for uniqueness (e.g., `luminatech-a3f2`)
- ADMIN can customize the slug (subject to uniqueness and format validation)
- System MUST support the following access control options:
  - **Public**: anyone with the link can view (default)
  - **Password-protected**: viewer must enter a password to access
  - **Email-gated**: viewer must enter their email before accessing (email is recorded for analytics)
- Shared profile is read-only — no editing capabilities for external viewers
- Shared profile does NOT require a Navia account to view
- System MUST display a "Powered by Navia" footer on the shared profile

### FR-6: Profile View Analytics
- System MUST track views on the shared profile
- Each view records:
  - `viewedAt`: timestamp
  - `viewerEmail`: email address (if email-gated access or voluntarily provided)
  - `viewerIp`: IP address (redacted to /24 for storage)
  - `userAgent`: browser user agent
  - `referrer`: HTTP referrer
  - `duration`: approximate time spent on profile (tracked via heartbeat, optional)
- System MUST display view analytics to ADMIN users:
  - Total views (all time, last 7 days, last 30 days)
  - Unique viewers (by email or IP)
  - View timeline chart
  - Document download counts per document
- View analytics are accessible from the company dashboard

### FR-7: Profile Publishing Lifecycle
- Profile has three statuses:
  - `DRAFT`: being edited, not accessible via shared link
  - `PUBLISHED`: accessible via shared link
  - `ARCHIVED`: no longer accessible, but data preserved
- ADMIN can toggle between DRAFT and PUBLISHED at any time
- ADMIN can archive a profile (removes public access, preserves data)
- Visiting a shared link for a DRAFT or ARCHIVED profile returns a "Profile not available" page
- System MUST provide a preview mode that renders the profile as external viewers would see it, without publishing

### FR-8: AI Summary
- System MUST provide an AI-generated summary of the company based on profile data, dataroom documents, and financial data
- The `aiSummary` field stores the generated text (plain text, max 5000 characters)
- The AI summary can be manually edited by the founder after generation
- **Generation trigger endpoint**: `POST /api/v1/companies/:companyId/profile/generate-summary`
  - Queues an async job that analyzes profile content, dataroom documents, and financial highlights
  - Returns `202 Accepted` with a job ID; the frontend polls or receives a WebSocket notification when complete
- **Auto-regeneration**: When documents are uploaded/deleted in the dataroom or financial highlights change, the system marks the summary as stale (a `summaryStale` flag tracked in application state, not persisted)
  - The UI displays a "Summary may be outdated — Regenerate" indicator when stale
  - Auto-regeneration does NOT happen automatically; the founder must click "Regenerate"
- See [ai-document-intelligence.md](./ai-document-intelligence.md) for AI processing pipeline implementation details

### FR-9: Financial Highlights
- System MUST display financial metrics populated from Open Finance snapshots
- The `financialHighlights` JSON field stores the following structure:
  ```json
  {
    "totalBalance": "150000.00",
    "monthlyRevenue": "45000.00",
    "monthlyExpenses": "38000.00",
    "burnRate": "38000.00",
    "runway": 4,
    "mrrEstimate": "42000.00",
    "lastUpdated": "2026-02-15T10:30:00.000Z"
  }
  ```
- Financial highlights are **read-only** on the profile — populated automatically from Open Finance snapshots
- All monetary values are stored as strings (decimal precision) and formatted using Brazilian number formatting (see i18n.md)
- Financial highlights are visible to investors with `VIEW_FINANCIALS` or `FULL` access level on the investor portal
- The profile editor displays a read-only view of financial metrics with a link to Open Finance settings
- If no Open Finance connection exists, the Financial Highlights tab shows an empty state prompting the user to connect
- See [open-finance.md](./open-finance.md) for data source details and connection flow

### FR-10: Profile Settings
- System MUST allow ADMIN users to configure:
  - **Investor update frequency**: how often investor updates are sent — `WEEKLY`, `BIWEEKLY`, `MONTHLY` (default), or `QUARTERLY`
  - **Auto-process with AI**: toggle for automatic AI processing of newly uploaded dataroom documents (default: `true`)
- Settings are persisted on the CompanyProfile entity
- Changes to settings are audit-logged

---

## Data Models

### CompanyProfile Entity

```typescript
interface CompanyProfile {
  id: string;                          // UUID, primary key
  companyId: string;                   // Foreign key to Company (unique — 1:1)
  slug: string;                        // URL-safe identifier (unique)
  status: ProfileStatus;               // DRAFT | PUBLISHED | ARCHIVED

  // Content
  headline: string | null;             // Short tagline (max 200 chars)
  description: string | null;          // Rich-text description (max 5000 chars)
  sector: CompanySector | null;        // Industry sector
  foundedYear: number | null;          // Founding year
  website: string | null;              // Company website URL
  location: string | null;             // City, State (free text)

  // Sharing
  accessType: ProfileAccessType;       // PUBLIC | PASSWORD | EMAIL_GATED
  accessPassword: string | null;       // bcrypt hash (only for PASSWORD type)

  // Litigation verification (BigDataCorp) — immutable, system-populated
  // See company-litigation-verification.md for full details
  litigationStatus: VerificationStatus; // PENDING | COMPLETED | FAILED
  litigationData: LitigationData | null; // Full BigDataCorp response (JSONB)
  litigationFetchedAt: Date | null;     // When data was last fetched
  litigationError: string | null;       // Error message if FAILED

  // AI & Financial
  aiSummary: string | null;            // AI-generated company summary
  financialHighlights: FinancialHighlights | null; // From Open Finance snapshots
  investorUpdateFrequency: InvestorUpdateFrequency; // WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY
  autoProcessWithAI: boolean;          // Whether to auto-process uploaded documents with AI

  // Timestamps
  publishedAt: Date | null;            // When first published
  archivedAt: Date | null;             // When archived
  createdAt: Date;
  updatedAt: Date;
}

interface FinancialHighlights {
  totalBalance: string;                // Decimal as string, e.g., "150000.00"
  monthlyRevenue: string;              // Decimal as string
  monthlyExpenses: string;             // Decimal as string
  burnRate: string;                    // Decimal as string
  runway: number;                      // Months of runway remaining
  mrrEstimate: string;                 // Decimal as string
  lastUpdated: string;                 // ISO 8601 datetime
}

enum InvestorUpdateFrequency {
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
}

enum ProfileStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

enum ProfileAccessType {
  PUBLIC = 'PUBLIC',
  PASSWORD = 'PASSWORD',
  EMAIL_GATED = 'EMAIL_GATED',
}

enum CompanySector {
  FINTECH = 'FINTECH',
  HEALTHTECH = 'HEALTHTECH',
  EDTECH = 'EDTECH',
  AGRITECH = 'AGRITECH',
  LEGALTECH = 'LEGALTECH',
  INSURTECH = 'INSURTECH',
  PROPTECH = 'PROPTECH',
  RETAILTECH = 'RETAILTECH',
  LOGTECH = 'LOGTECH',
  HRTECH = 'HRTECH',
  MARTECH = 'MARTECH',
  CLEANTECH = 'CLEANTECH',
  BIOTECH = 'BIOTECH',
  DEEPTECH = 'DEEPTECH',
  SAAS = 'SAAS',
  MARKETPLACE = 'MARKETPLACE',
  ECOMMERCE = 'ECOMMERCE',
  AI_ML = 'AI_ML',
  BLOCKCHAIN_WEB3 = 'BLOCKCHAIN_WEB3',
  CYBERSECURITY = 'CYBERSECURITY',
  IOT = 'IOT',
  ENTERTAINMENT = 'ENTERTAINMENT',
  FOODTECH = 'FOODTECH',
  MOBILITY = 'MOBILITY',
  SOCIAL_IMPACT = 'SOCIAL_IMPACT',
  OTHER = 'OTHER',
}
```

### ProfileMetric Entity

```typescript
interface ProfileMetric {
  id: string;                          // UUID, primary key
  profileId: string;                   // Foreign key to CompanyProfile
  label: string;                       // Display name (e.g., "ARR", "Funcionários")
  value: string;                       // Stored as string, formatted on display
  format: MetricFormat;                // NUMBER | CURRENCY_BRL | CURRENCY_USD | PERCENTAGE | TEXT
  icon: string | null;                 // Lucide icon identifier
  order: number;                       // Display order (0-indexed)
  createdAt: Date;
  updatedAt: Date;
}

enum MetricFormat {
  NUMBER = 'NUMBER',
  CURRENCY_BRL = 'CURRENCY_BRL',
  CURRENCY_USD = 'CURRENCY_USD',
  PERCENTAGE = 'PERCENTAGE',
  TEXT = 'TEXT',
}
```

### ProfileTeamMember Entity

```typescript
interface ProfileTeamMember {
  id: string;                          // UUID, primary key
  profileId: string;                   // Foreign key to CompanyProfile
  name: string;                        // Full name
  title: string;                       // Role/position
  photoUrl: string | null;             // S3 URL for profile photo
  linkedinUrl: string | null;          // LinkedIn profile URL
  order: number;                       // Display order (0-indexed)
  createdAt: Date;
  updatedAt: Date;
}
```

### ProfileView Entity

```typescript
interface ProfileView {
  id: string;                          // UUID, primary key
  profileId: string;                   // Foreign key to CompanyProfile
  viewerEmail: string | null;          // Email (if email-gated or voluntarily provided)
  viewerIp: string;                    // Redacted to /24 subnet
  userAgent: string;                   // Browser user agent
  referrer: string | null;             // HTTP referrer
  viewedAt: Date;
}
```

### Prisma Schema

```prisma
model CompanyProfile {
  id             String              @id @default(uuid())
  companyId      String              @unique @map("company_id")
  slug           String              @unique
  status         ProfileStatus       @default(DRAFT)

  headline       String?
  description    String?             @db.Text
  sector         CompanySector?
  foundedYear    Int?                @map("founded_year")
  website        String?
  location       String?

  accessType     ProfileAccessType   @default(PUBLIC) @map("access_type")
  accessPassword String?             @map("access_password")

  // Litigation verification (BigDataCorp) — immutable
  // See company-litigation-verification.md for full details
  litigationStatus    VerificationStatus @default(PENDING) @map("litigation_status")
  litigationData      Json?              @map("litigation_data")
  litigationFetchedAt DateTime?          @map("litigation_fetched_at")
  litigationError     String?            @map("litigation_error")

  // AI & Financial
  aiSummary          String?  @map("ai_summary") @db.Text // AI-generated company summary
  financialHighlights Json?   @map("financial_highlights") // From Open Finance snapshots
  investorUpdateFrequency InvestorUpdateFrequency @default(MONTHLY) @map("investor_update_frequency")
  autoProcessWithAI  Boolean  @default(true) @map("auto_process_with_ai")

  publishedAt    DateTime?           @map("published_at")
  archivedAt     DateTime?           @map("archived_at")
  createdAt      DateTime            @default(now()) @map("created_at")
  updatedAt      DateTime            @updatedAt @map("updated_at")

  // Relations
  company        Company             @relation(fields: [companyId], references: [id])
  metrics        ProfileMetric[]
  teamMembers    ProfileTeamMember[]
  documents      ProfileDocument[]
  views          ProfileView[]

  @@index([slug])
  @@index([companyId])
  @@map("company_profiles")
}

model ProfileMetric {
  id        String       @id @default(uuid())
  profileId String       @map("profile_id")
  label     String
  value     String
  format    MetricFormat @default(TEXT)
  icon      String?
  order     Int          @default(0)
  createdAt DateTime     @default(now()) @map("created_at")
  updatedAt DateTime     @updatedAt @map("updated_at")

  profile   CompanyProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId, order])
  @@map("profile_metrics")
}

model ProfileTeamMember {
  id          String   @id @default(uuid())
  profileId   String   @map("profile_id")
  name        String
  title       String
  photoUrl    String?  @map("photo_url")
  linkedinUrl String?  @map("linkedin_url")
  order       Int      @default(0)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  profile     CompanyProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId, order])
  @@map("profile_team_members")
}

model ProfileView {
  id          String   @id @default(uuid())
  profileId   String   @map("profile_id")
  viewerEmail String?  @map("viewer_email")
  viewerIp    String   @map("viewer_ip")
  userAgent   String   @map("user_agent")
  referrer    String?
  viewedAt    DateTime @default(now()) @map("viewed_at")

  profile     CompanyProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([profileId, viewedAt])
  @@index([profileId, viewerEmail])
  @@map("profile_views")
}

enum ProfileStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum ProfileAccessType {
  PUBLIC
  PASSWORD
  EMAIL_GATED
}

enum CompanySector {
  FINTECH
  HEALTHTECH
  EDTECH
  AGRITECH
  LEGALTECH
  INSURTECH
  PROPTECH
  RETAILTECH
  LOGTECH
  HRTECH
  MARTECH
  CLEANTECH
  BIOTECH
  DEEPTECH
  SAAS
  MARKETPLACE
  ECOMMERCE
  AI_ML
  BLOCKCHAIN_WEB3
  CYBERSECURITY
  IOT
  ENTERTAINMENT
  FOODTECH
  MOBILITY
  SOCIAL_IMPACT
  OTHER
}

enum MetricFormat {
  NUMBER
  CURRENCY_BRL
  CURRENCY_USD
  PERCENTAGE
  TEXT
}

enum InvestorUpdateFrequency {
  WEEKLY
  BIWEEKLY
  MONTHLY
  QUARTERLY
}
```

---

## API Endpoints

### Profile CRUD

#### POST /api/v1/companies/:companyId/profile
**Description**: Create a company profile. One profile per company. Returns the profile in DRAFT status.

**Auth**: Required. User must be ADMIN.

**Request**:
```json
{
  "headline": "Plataforma de IA para otimização de energia renovável",
  "description": "A LuminaTech é uma plataforma alimentada por IA...",
  "sector": "FINTECH",
  "foundedYear": 2022,
  "website": "https://luminatech.com.br",
  "location": "São Paulo, SP",
  "accessType": "PUBLIC"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "prof_abc123",
    "companyId": "comp_abc123",
    "slug": "luminatech-a3f2",
    "status": "DRAFT",
    "headline": "Plataforma de IA para otimização de energia renovável",
    "description": "A LuminaTech é uma plataforma alimentada por IA...",
    "sector": "FINTECH",
    "foundedYear": 2022,
    "website": "https://luminatech.com.br",
    "location": "São Paulo, SP",
    "accessType": "PUBLIC",
    "accessPassword": null,
    "publishedAt": null,
    "createdAt": "2026-02-23T10:00:00Z",
    "updatedAt": "2026-02-23T10:00:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid field values
- `403 Forbidden` — User is not ADMIN
- `409 Conflict` — Company already has a profile

**Validation Rules**:
- `headline`: optional, max 200 characters
- `description`: optional, max 5000 characters
- `sector`: optional, must be a valid `CompanySector` enum value
- `foundedYear`: optional, integer between 1900 and current year
- `website`: optional, valid URL format
- `location`: optional, max 100 characters
- `accessType`: optional, default `PUBLIC`

---

#### GET /api/v1/companies/:companyId/profile
**Description**: Get the company profile with all nested data (metrics, team, documents). For authenticated company members.

**Auth**: Required. User must be a member of the company.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "prof_abc123",
    "companyId": "comp_abc123",
    "slug": "luminatech-a3f2",
    "status": "PUBLISHED",
    "headline": "Plataforma de IA para otimização de energia renovável",
    "description": "A LuminaTech é uma plataforma alimentada por IA...",
    "sector": "FINTECH",
    "foundedYear": 2022,
    "website": "https://luminatech.com.br",
    "location": "São Paulo, SP",
    "accessType": "PUBLIC",
    "publishedAt": "2026-02-23T12:00:00Z",
    "companyName": "LuminaTech",
    "companyLogoUrl": "https://s3.amazonaws.com/navia/logos/luminatech.png",
    "metrics": [
      {
        "id": "met_001",
        "label": "Funcionários",
        "value": "22",
        "format": "NUMBER",
        "icon": "users",
        "order": 0
      },
      {
        "id": "met_002",
        "label": "ARR",
        "value": "22680000",
        "format": "CURRENCY_BRL",
        "icon": "trending-up",
        "order": 1
      },
      {
        "id": "met_003",
        "label": "Setor",
        "value": "Fintech",
        "format": "TEXT",
        "icon": "building",
        "order": 2
      }
    ],
    "teamMembers": [
      {
        "id": "tm_001",
        "name": "Rafael Costa",
        "title": "CEO & Founder",
        "photoUrl": "https://s3.amazonaws.com/navia/profiles/rafael.jpg",
        "linkedinUrl": "https://linkedin.com/in/rafaelcosta",
        "order": 0
      },
      {
        "id": "tm_002",
        "name": "Maria Silva",
        "title": "CTO & Co-founder",
        "photoUrl": null,
        "linkedinUrl": null,
        "order": 1
      },
      {
        "id": "tm_003",
        "name": "João Santos",
        "title": "COO & Co-founder",
        "photoUrl": null,
        "linkedinUrl": null,
        "order": 2
      }
    ],
    "documents": [
      {
        "id": "doc_001",
        "name": "LuminaTech_PitchDeck_2024.pdf",
        "category": "PITCH_DECK",
        "fileSize": 2456789,
        "mimeType": "application/pdf",
        "pageCount": 12,
        "thumbnailUrl": "https://s3.amazonaws.com/navia/thumbnails/doc_001.png",
        "order": 0,
        "uploadedAt": "2026-02-20T15:00:00Z"
      }
    ],
    "litigation": {
      "status": "COMPLETED",
      "fetchedAt": "2026-02-23T10:05:00Z",
      "summary": {
        "activeLawsuits": 2,
        "historicalLawsuits": 5,
        "activeAdministrative": 0,
        "protests": 0,
        "totalValueInDispute": "225000.00",
        "riskLevel": "MEDIUM"
      },
      "lawsuits": [
        {
          "processId": "0000123-45.2024.8.26.0100",
          "court": "TJSP - 1ª Vara Cível",
          "caseType": "CIVIL",
          "status": "ATIVO",
          "filingDate": "2024-03-15",
          "lastUpdate": "2026-01-20",
          "valueInDispute": "150000.00",
          "plaintiffName": "J*** S***",
          "defendantRole": "REU",
          "subject": "Cobrança"
        }
      ],
      "protestData": {
        "totalProtests": 0,
        "protests": []
      }
    },
    "analytics": {
      "totalViews": 47,
      "uniqueViewers": 23,
      "last7DaysViews": 12,
      "last30DaysViews": 35
    },
    "createdAt": "2026-02-23T10:00:00Z",
    "updatedAt": "2026-02-23T14:00:00Z"
  }
}
```

**Error Responses**:
- `403 Forbidden` — User is not a member of the company
- `404 Not Found` — Company has no profile

---

#### PUT /api/v1/companies/:companyId/profile
**Description**: Update the company profile fields.

**Auth**: Required. User must be ADMIN or FINANCE.

**Request**:
```json
{
  "headline": "Updated tagline",
  "description": "Updated description...",
  "sector": "SAAS",
  "foundedYear": 2021,
  "website": "https://luminatech.io",
  "location": "Rio de Janeiro, RJ",
  "accessType": "EMAIL_GATED"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "prof_abc123",
    "headline": "Updated tagline",
    "description": "Updated description...",
    "sector": "SAAS",
    "accessType": "EMAIL_GATED",
    "updatedAt": "2026-02-23T15:00:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid field values
- `403 Forbidden` — User is not ADMIN or FINANCE
- `404 Not Found` — Profile not found

**Note**: Any litigation-related fields (`litigationStatus`, `litigationData`, `litigationFetchedAt`, `litigationError`) in the request body are silently ignored. These fields are system-managed and immutable (see [company-litigation-verification.md](./company-litigation-verification.md) BR-11).

---

#### PUT /api/v1/companies/:companyId/profile/slug
**Description**: Update the profile slug (shareable URL path).

**Auth**: Required. User must be ADMIN.

**Request**:
```json
{
  "slug": "luminatech"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "slug": "luminatech",
    "shareUrl": "https://app.navia.com.br/p/luminatech"
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid slug format (must be lowercase, alphanumeric, hyphens only, 3–50 chars)
- `409 Conflict` — Slug is already taken

---

#### POST /api/v1/companies/:companyId/profile/publish
**Description**: Publish the profile, making it accessible via the shared link.

**Auth**: Required. User must be ADMIN.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "status": "PUBLISHED",
    "publishedAt": "2026-02-23T12:00:00Z",
    "shareUrl": "https://app.navia.com.br/p/luminatech-a3f2"
  }
}
```

---

#### POST /api/v1/companies/:companyId/profile/unpublish
**Description**: Unpublish the profile, returning it to DRAFT status.

**Auth**: Required. User must be ADMIN.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "status": "DRAFT"
  }
}
```

---

#### POST /api/v1/companies/:companyId/profile/archive
**Description**: Archive the profile. Removes public access and preserves data.

**Auth**: Required. User must be ADMIN.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "status": "ARCHIVED",
    "archivedAt": "2026-02-23T16:00:00Z"
  }
}
```

---

### Metrics

#### PUT /api/v1/companies/:companyId/profile/metrics
**Description**: Replace all metrics for the profile (full replacement, not partial update). Send the complete list of metrics.

**Auth**: Required. User must be ADMIN or FINANCE.

**Request**:
```json
{
  "metrics": [
    {
      "label": "Funcionários",
      "value": "22",
      "format": "NUMBER",
      "icon": "users",
      "order": 0
    },
    {
      "label": "ARR",
      "value": "22680000",
      "format": "CURRENCY_BRL",
      "icon": "trending-up",
      "order": 1
    },
    {
      "label": "Setor",
      "value": "Fintech",
      "format": "TEXT",
      "icon": "building",
      "order": 2
    }
  ]
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "met_001",
      "label": "Funcionários",
      "value": "22",
      "format": "NUMBER",
      "icon": "users",
      "order": 0
    },
    {
      "id": "met_002",
      "label": "ARR",
      "value": "22680000",
      "format": "CURRENCY_BRL",
      "icon": "trending-up",
      "order": 1
    },
    {
      "id": "met_003",
      "label": "Setor",
      "value": "Fintech",
      "format": "TEXT",
      "icon": "building",
      "order": 2
    }
  ]
}
```

**Validation Rules**:
- Maximum 6 metrics
- `label`: required, max 50 characters
- `value`: required, max 100 characters
- `format`: required, valid MetricFormat enum
- `icon`: optional, valid Lucide icon name
- `order`: required, unique within the list, 0-indexed

---

### Team Members

#### PUT /api/v1/companies/:companyId/profile/team
**Description**: Replace all team members (full replacement). Send the complete list.

**Auth**: Required. User must be ADMIN or FINANCE.

**Request**:
```json
{
  "teamMembers": [
    {
      "name": "Rafael Costa",
      "title": "CEO & Founder",
      "photoUrl": "https://s3.amazonaws.com/navia/profiles/rafael.jpg",
      "linkedinUrl": "https://linkedin.com/in/rafaelcosta",
      "order": 0
    },
    {
      "name": "Maria Silva",
      "title": "CTO & Co-founder",
      "photoUrl": null,
      "linkedinUrl": null,
      "order": 1
    }
  ]
}
```

**Response** (200 OK): Returns the created team members with IDs.

**Validation Rules**:
- Maximum 10 team members
- `name`: required, max 100 characters
- `title`: required, max 100 characters
- `linkedinUrl`: optional, valid URL format starting with `https://linkedin.com/` or `https://www.linkedin.com/`

---

#### POST /api/v1/companies/:companyId/profile/team/photo
**Description**: Upload a team member profile photo. Returns the S3 URL to be used in the team member data.

**Auth**: Required. User must be ADMIN or FINANCE.

**Request**: `multipart/form-data` with a single `photo` field.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "photoUrl": "https://s3.amazonaws.com/navia/profiles/uuid-photo.jpg"
  }
}
```

**Validation Rules**:
- Allowed types: PNG, JPG, JPEG
- Maximum size: 2 MB
- EXIF metadata stripped before storage

---

### Public Profile (No Auth Required)

#### GET /api/v1/profiles/:slug
**Description**: Get the public profile by slug. No authentication required. This is the endpoint used by the shareable link.

**Auth**: None required.

**Headers**:
- `X-Profile-Password`: password (required if profile is password-protected)

**Query Parameters**:
- `email`: viewer email (required if profile is email-gated, optional otherwise)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "companyName": "LuminaTech",
    "companyLogoUrl": "https://s3.amazonaws.com/navia/logos/luminatech.png",
    "headline": "Plataforma de IA para otimização de energia renovável",
    "description": "A LuminaTech é uma plataforma alimentada por IA...",
    "sector": "FINTECH",
    "sectorLabel": "Fintech",
    "foundedYear": 2022,
    "website": "https://luminatech.com.br",
    "location": "São Paulo, SP",
    "metrics": [
      {
        "label": "Funcionários",
        "value": "22",
        "format": "NUMBER",
        "formattedValue": "22",
        "icon": "users"
      },
      {
        "label": "ARR",
        "value": "22680000",
        "format": "CURRENCY_BRL",
        "formattedValue": "R$ 22.680.000",
        "icon": "trending-up"
      },
      {
        "label": "Setor",
        "value": "Fintech",
        "format": "TEXT",
        "formattedValue": "Fintech",
        "icon": "building"
      }
    ],
    "teamMembers": [
      {
        "name": "Rafael Costa",
        "title": "CEO & Founder",
        "photoUrl": "https://s3.amazonaws.com/navia/profiles/rafael.jpg",
        "linkedinUrl": "https://linkedin.com/in/rafaelcosta"
      }
    ],
    "documents": [
      {
        "id": "doc_001",
        "name": "LuminaTech_PitchDeck_2024.pdf",
        "category": "PITCH_DECK",
        "categoryLabel": "Pitch Deck",
        "fileSize": 2456789,
        "pageCount": 12,
        "thumbnailUrl": "https://s3.amazonaws.com/navia/thumbnails/doc_001.png"
      }
    ],
    "litigation": {
      "status": "COMPLETED",
      "fetchedAt": "2026-02-23T10:05:00Z",
      "summary": {
        "activeLawsuits": 2,
        "historicalLawsuits": 5,
        "activeAdministrative": 0,
        "protests": 0,
        "totalValueInDispute": "225000.00",
        "riskLevel": "MEDIUM"
      },
      "lawsuits": [
        {
          "processId": "0000123-45.2024.8.26.0100",
          "court": "TJSP - 1ª Vara Cível",
          "caseType": "CIVIL",
          "status": "ATIVO",
          "filingDate": "2024-03-15",
          "lastUpdate": "2026-01-20",
          "valueInDispute": "150000.00",
          "plaintiffName": "J*** S***",
          "defendantRole": "REU",
          "subject": "Cobrança"
        }
      ],
      "protestData": {
        "totalProtests": 0,
        "protests": []
      }
    }
  }
}
```

**Litigation field states by `litigationStatus`**:

When `PENDING` (job dispatched, not yet completed):
```json
"litigation": {
  "status": "PENDING",
  "fetchedAt": null,
  "summary": null
}
```

When `FAILED` (BigDataCorp fetch failed after all retries):
```json
"litigation": {
  "status": "FAILED",
  "fetchedAt": null,
  "summary": null,
  "error": "Verification service temporarily unavailable"
}
```

**Error Responses**:
- `401 Unauthorized` — Password required but not provided or incorrect
- `404 Not Found` — Profile not found or not published
- `422 Unprocessable Entity` — Email required but not provided (email-gated profile)

**Notes**:
- This endpoint records a ProfileView entry on each access
- Documents only include metadata — actual file download requires a separate call (see [company-dataroom.md](./company-dataroom.md))
- The `formattedValue` field provides the display-ready string using Brazilian formatting
- The `litigation` section is read-only and system-populated — no additional access control beyond existing profile access controls (public/password/email-gated). See [company-litigation-verification.md](./company-litigation-verification.md) for full details.

---

### Analytics

#### GET /api/v1/companies/:companyId/profile/analytics
**Description**: Get profile view analytics.

**Auth**: Required. User must be ADMIN or FINANCE.

**Query Parameters**:
- `period`: `7d`, `30d`, `90d`, `all` (default: `30d`)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalViews": 47,
    "uniqueViewers": 23,
    "periodViews": 35,
    "viewsByDay": [
      { "date": "2026-02-20", "views": 5 },
      { "date": "2026-02-21", "views": 8 },
      { "date": "2026-02-22", "views": 3 }
    ],
    "topDocumentDownloads": [
      { "documentId": "doc_001", "name": "LuminaTech_PitchDeck_2024.pdf", "downloads": 18 }
    ],
    "recentViewers": [
      {
        "email": "investor@vc.com",
        "viewedAt": "2026-02-22T14:30:00Z",
        "viewCount": 3
      }
    ]
  }
}
```

---

## Business Rules

### BR-1: One Profile Per Company
- Each company has at most one CompanyProfile (1:1 relationship via unique `companyId`)
- Creating a second profile returns `409 Conflict`

### BR-2: Profile Requires ACTIVE Company
- A profile can only be created for a company in `ACTIVE` status
- If a company transitions to `INACTIVE` or `DISSOLVED`, the profile is automatically unpublished (set to `DRAFT`)

### BR-3: Maximum Metric Count
- A profile can have at most 6 metrics
- Attempting to save more than 6 returns `422 Unprocessable Entity`

### BR-4: Maximum Team Members
- A profile can have at most 10 team members
- Attempting to save more than 10 returns `422 Unprocessable Entity`

### BR-6: Slug Uniqueness and Format
- Slug must be unique across all profiles on the platform
- Slug format: lowercase letters, numbers, and hyphens only, 3–50 characters
- Slug cannot start or end with a hyphen
- Slug cannot be a reserved word: `admin`, `api`, `auth`, `login`, `signup`, `settings`, `help`, `support`, `about`, `profile`, `dashboard`

### BR-7: Password Protection
- When `accessType` is `PASSWORD`, the `accessPassword` field must be set
- Passwords are stored as bcrypt hashes (never plaintext)
- Changing `accessType` from `PASSWORD` to another type clears the stored password hash

### BR-8: Email-Gated Access Logging
- When `accessType` is `EMAIL_GATED`, the viewer's email is recorded in the ProfileView
- Email format is validated before granting access
- The same email can view the profile multiple times (each view is recorded)

### BR-10: Profile Publishing Prerequisites
- Publishing requires at least one of: description, metrics, team members, or documents
- A completely empty profile cannot be published

---

## User Flows

### Flow 1: Create and Publish Company Profile

```
PRECONDITION: Company is ACTIVE, user is ADMIN

1. Admin navigates to "Company Profile" in sidebar
2. System shows "Create Profile" prompt (if no profile exists)
3. Admin clicks "Create Profile"
4. Frontend sends POST /api/v1/companies/:companyId/profile
5. Backend creates profile in DRAFT status with auto-generated slug
6. Admin is redirected to the profile editor

7. Admin fills in:
   a. Headline (optional tagline)
   b. Description (company overview text)
   c. Sector (dropdown selection)
   d. Founded year
   e. Website URL
   f. Location
8. Admin adds key metrics:
   a. Clicks "Add Metric"
   b. Selects from template (e.g., "Funcionários") or custom label
   c. Enters value and selects format
   d. Repeats for up to 6 metrics
9. Admin adds founding team:
   a. Clicks "Add Team Member"
   b. Enters name and title
   c. Optionally uploads photo
   d. Optionally adds LinkedIn URL
   e. Drags to reorder
10. Admin uploads documents:
    a. Clicks "Upload Document"
    b. Selects file and category
    c. System uploads to S3, extracts metadata
    d. Document appears in list with page count

11. Admin clicks "Preview"
12. System shows read-only preview as external viewers would see it
13. Admin clicks "Publish"
14. Frontend sends POST /api/v1/companies/:companyId/profile/publish
15. Backend sets status to PUBLISHED
16. Admin sees the shareable URL

17. Admin clicks "Share" (Compartilhar)
18. Modal shows shareable URL with copy button
19. Admin optionally configures access controls (public, password, email-gated)
20. Admin copies and shares the link with investors

POSTCONDITION: Profile is PUBLISHED and accessible via the shareable URL
```

### Flow 2: Investor Views Shared Profile

```
PRECONDITION: Profile is PUBLISHED

--- Public access ---
1. Investor receives shared link: https://app.navia.com.br/p/luminatech-a3f2
2. Investor clicks the link
3. Frontend loads the public profile page (no auth required)
4. Frontend calls GET /api/v1/profiles/luminatech-a3f2
5. Backend records a ProfileView entry
6. Page renders: company header, metrics cards, team section, documents

--- Password-protected access ---
1. Investor clicks the link
2. Frontend shows a password prompt
3. Investor enters the password
4. Frontend calls GET /api/v1/profiles/:slug with X-Profile-Password header
5. Backend verifies password against bcrypt hash
6. On success: profile data returned, view recorded
7. On failure: 401 Unauthorized

--- Email-gated access ---
1. Investor clicks the link
2. Frontend shows an email prompt: "Enter your email to view this profile"
3. Investor enters their email
4. Frontend calls GET /api/v1/profiles/:slug?email=investor@vc.com
5. Backend validates email format, records view with email
6. Profile data returned

--- Document download ---
7. Investor clicks "Visualizar" (View) on a document
8. Frontend opens the document in a new tab (inline PDF viewer)
9. Investor clicks "Baixar" (Download)
10. Frontend calls GET /api/v1/profiles/:slug/documents/:id/download
11. Backend generates pre-signed S3 URL, records download event
12. Browser downloads the file

POSTCONDITION: Profile viewed, analytics recorded
```

---

## Frontend Specification

### Page Routing

| Route | Purpose | Auth | Layout |
|-------|---------|------|--------|
| `/companies/:companyId/profile` | Profile editor (or "Create Profile" prompt if none exists) | Required (ADMIN, FINANCE) | Dashboard shell with sidebar |
| `/companies/:companyId/profile/analytics` | Analytics dashboard (also accessible as a tab within the editor) | Required (ADMIN, FINANCE) | Dashboard shell with sidebar |
| `/p/:slug` | Public shared profile page | None required | Standalone page — no sidebar, no top bar, no dashboard shell |

### Sidebar Navigation

Add a "Profile" (`Perfil`) item in the sidebar under company navigation, positioned between "Documents" and "Settings":

```
□ Documents
■ Profile          ← NEW
□ Settings
```

- Icon: `building-2` (Lucide)
- Route: `/companies/:companyId/profile`
- Visible to: ADMIN, FINANCE roles
- Active state follows standard sidebar active styling (navy-800 bg, white text, 3px blue-600 left bar)

### Profile Editor Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  h1: Perfil da Empresa        [Preview] [Publish/Draft] │
│  Status badge: DRAFT / PUBLISHED / ARCHIVED              │
├─────────────────────────────────────────────────────────┤
│  Tabs: [Info] [Metricas] [Equipe] [AI Summary] [Financeiro] [Documentos] [Compartilhar] [Analytics] [Config] │
├─────────────────────────────────────────────────────────┤
│  Tab Content Area                                        │
│  (renders the active tab component)                      │
└─────────────────────────────────────────────────────────┘
```

**Page Header**:
- Title: `h1` "Perfil da Empresa" — color `navy-900`
- Status badge: positioned to the right of the title, using the `StatusBadge` component:
  - DRAFT: `gray-100` bg, `gray-600` text
  - PUBLISHED: `green-100` bg, `green-700` text
  - ARCHIVED: `cream-100` bg, `cream-700` text
- Action buttons (right-aligned):
  - "Preview" button: Secondary variant (`white` bg, `gray-200` border, `gray-700` text)
  - "Publish" button: Primary variant (`blue-600` bg, `white` text) — shown when status is DRAFT
  - "Unpublish" button: Secondary variant — shown when status is PUBLISHED
  - "Archive" button: Destructive variant — shown in a "more actions" dropdown (three-dot menu)

**Completeness Score**:
- Display a circular progress indicator showing profile completeness as a percentage
- Completeness is calculated based on how many profile sections have content:
  - Info fields filled (headline, description, sector, etc.)
  - At least 1 key metric added
  - At least 1 team member added
  - AI summary generated
  - Financial highlights connected
  - At least 1 dataroom document uploaded
- Formula: `(filledSections / totalSections) * 100`, rounded to nearest integer
- Displayed as a small circular progress badge next to the page title

**Tab Bar**:
- Uses shadcn/ui `Tabs` component
- Nine tabs: Info, Metricas, Equipe, AI Summary, Financeiro, Documentos, Compartilhar, Analytics, Config
- Default active tab: Info
- Tab state is persisted in the URL query parameter `?tab=info|metrics|team|ai-summary|financials|documents|share|analytics|settings`

**Empty State (No Profile Exists)**:
- When `GET /api/v1/companies/:companyId/profile` returns 404, display an empty state instead of the editor:
  - Centered illustration: `building-2` icon at 64px, `gray-300` tint
  - Title: `h3` "Crie o perfil da sua empresa" (`gray-700`)
  - Description: `body` "Compartilhe informacoes da sua empresa com investidores e stakeholders" (`gray-500`, max-width 400px)
  - CTA button: Primary variant "Criar Perfil"
  - Clicking the CTA sends `POST /api/v1/companies/:companyId/profile` with empty body, then redirects to the editor

### Tab: Informacoes (Info)

**Component**: `ProfileInfoTab`

**Layout**: Form card with standard card styling (white bg, `gray-200` border, `radius-lg`, `24px` padding).

**Form Fields**:

| Field | Type | Placeholder | Validation | Max Length |
|-------|------|-------------|------------|------------|
| Headline | Text input | "Uma frase sobre sua empresa..." | Optional | 200 chars |
| Description | Textarea (4 rows min, auto-expand) | "Descreva sua empresa, produto e mercado..." | Optional | 5000 chars |
| Sector | Select dropdown | "Selecione o setor" | Optional, must be valid `CompanySector` enum | — |
| Founded Year | Number input | "2020" | Optional, integer 1900–current year | 4 digits |
| Website | Text input | "https://suaempresa.com.br" | Optional, valid URL format | 200 chars |
| Location | Text input | "Sao Paulo, SP" | Optional | 100 chars |

**Sector Dropdown Options** (display labels in PT-BR):

| Enum Value | Display Label |
|------------|---------------|
| FINTECH | Fintech |
| HEALTHTECH | Healthtech |
| EDTECH | Edtech |
| AGRITECH | Agritech |
| LEGALTECH | Legaltech |
| INSURTECH | Insurtech |
| PROPTECH | Proptech |
| RETAILTECH | Retailtech |
| LOGTECH | Logtech |
| HRTECH | HRtech |
| MARTECH | Martech |
| CLEANTECH | Cleantech |
| BIOTECH | Biotech |
| DEEPTECH | Deeptech |
| SAAS | SaaS |
| MARKETPLACE | Marketplace |
| ECOMMERCE | E-commerce |
| AI_ML | IA / Machine Learning |
| BLOCKCHAIN_WEB3 | Blockchain / Web3 |
| CYBERSECURITY | Ciberseguranca |
| IOT | IoT |
| ENTERTAINMENT | Entretenimento |
| FOODTECH | Foodtech |
| MOBILITY | Mobilidade |
| SOCIAL_IMPACT | Impacto Social |
| OTHER | Outro |

**Save Behavior**:
- "Salvar" button at the bottom of the form, Primary variant
- On click: sends `PUT /api/v1/companies/:companyId/profile` with the form data
- On success: show success toast "Perfil atualizado com sucesso"
- On error: show error toast with translated `messageKey`
- Button shows loading spinner while saving (maintain button width)
- Character counter shown below Description field (`{current}/{max}`)

### Tab: Metricas (Metrics)

**Component**: `ProfileMetricsTab`

**Layout**: List of metric cards in a vertical stack, with "Add Metric" button at the top.

**Metric Card** (`MetricCard`):
```
┌─────────────────────────────────────────────────────────┐
│  ☰ (drag handle)   [Icon Selector]                [✕]  │
│                                                          │
│  Label: [________________]   Value: [________________]   │
│  Format: [▼ NUMBER      ]                                │
└─────────────────────────────────────────────────────────┘
```

- Each card is a white card with `gray-200` border, `radius-md`, `16px` padding
- Drag handle: 6-dot grip icon (left side), `gray-400`, cursor `grab`
- Remove button: Ghost variant, `gray-400` icon, top-right corner
- Icon selector: Popover with a grid of common Lucide icons (users, trending-up, building, dollar-sign, bar-chart, target, globe, heart, zap, shield, briefcase, code). Clicking opens the popover; selecting an icon closes it.
- Label input: Text, max 50 chars
- Value input: Text, max 100 chars
- Format dropdown: `NUMBER`, `CURRENCY_BRL`, `CURRENCY_USD`, `PERCENTAGE`, `TEXT`

**Template Quick-Add Buttons**:
Below the "Add Metric" button, show a row of template chips:

| Template | Label | Format | Icon |
|----------|-------|--------|------|
| Funcionarios | Funcionarios | NUMBER | users |
| ARR | ARR | CURRENCY_BRL | trending-up |
| MRR | MRR | CURRENCY_BRL | trending-up |
| Receita Mensal | Receita Mensal | CURRENCY_BRL | dollar-sign |
| Clientes | Clientes | NUMBER | building |
| Setor | Setor | TEXT | briefcase |

- Template chips: `gray-100` bg, `gray-600` text, `radius-full` (pill), `caption` size
- Clicking a template adds a new metric with pre-filled label, format, and icon (value left empty for user to fill)
- A template chip is disabled if a metric with that label already exists

**Limits**:
- "Add Metric" button disabled when 6 metrics exist, with helper text "Maximo de 6 metricas atingido" (`gray-500`, `caption`)

**Save Behavior**:
- "Salvar Metricas" button at the bottom
- Sends `PUT /api/v1/companies/:companyId/profile/metrics` with the full list of metrics
- Metrics are sent in their current display order (order field = array index)

**Drag-and-Drop**: Uses `@dnd-kit/core` and `@dnd-kit/sortable` for reordering.

### Tab: Equipe (Team)

**Component**: `ProfileTeamTab`

**Layout**: Grid of team member cards (2 columns on desktop, 1 on mobile) with "Add Member" button at the top.

**Team Member Card** (`TeamMemberCard`):
```
┌─────────────────────────────────────────┐
│  ☰ (drag handle)                   [✕]  │
│                                          │
│       ┌──────────┐                       │
│       │  Photo   │  ← Click to upload    │
│       │  Upload  │     or show initials   │
│       └──────────┘                       │
│                                          │
│  Name:     [________________________]    │
│  Title:    [________________________]    │
│  LinkedIn: [________________________]    │
└──────────────────────────────────────────┘
```

- Card: white bg, `gray-200` border, `radius-lg`, `24px` padding
- Photo upload circle: 80px diameter, `radius-full`, `gray-100` bg with `camera` icon placeholder. On hover, shows "Upload" overlay. Clicking triggers file input (accepts PNG, JPG, JPEG, max 2 MB). After upload, shows the photo with a small "edit" overlay on hover.
- Photo upload flow: File selected -> `POST /api/v1/companies/:companyId/profile/team/photo` -> returns `photoUrl` -> stored in the team member card state
- Initials avatar: When no photo, show initials from first and last name on `blue-600` bg, white text
- Name input: Text, required, max 100 chars
- Title input: Text, required, max 100 chars
- LinkedIn URL input: Text, optional, placeholder "https://linkedin.com/in/..."
- Drag handle and remove button: Same as metric cards

**Limits**:
- "Add Member" button disabled when 10 members exist, with helper text "Maximo de 10 membros atingido"

**Save Behavior**:
- "Salvar Equipe" button at the bottom
- Sends `PUT /api/v1/companies/:companyId/profile/team` with the full list of team members
- Members are sent in their current display order

**Drag-and-Drop**: Uses `@dnd-kit/core` and `@dnd-kit/sortable` for reordering.

### Tab: Documentos (Documents)

**Component**: `ProfileDocumentsTab`

**Layout**: Read-only display of documents linked from the Company Dataroom.

```
┌─────────────────────────────────────────────────────────┐
│  Documentos do Dataroom                                  │
│  body-sm: "Gerencie seus documentos no Dataroom"         │
│  [Gerenciar no Dataroom →]    ← Link to dataroom page   │
├─────────────────────────────────────────────────────────┤
│  Category Tabs: [Pitch Deck] [Financeiro] [Juridico] [Outros] │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │ [Thumbnail] Document Name.pdf   12 pgs   2.4 MB │    │
│  ├─────────────────────────────────────────────────┤    │
│  │ [Thumbnail] Another Doc.pdf      8 pgs   1.1 MB │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Empty state: "Nenhum documento nesta categoria.         │
│  Adicione documentos no Dataroom."                       │
└─────────────────────────────────────────────────────────┘
```

- This tab does NOT allow uploading or removing documents — it is read-only
- Documents are fetched from the Company Dataroom (same data source as the dataroom management page)
- "Gerenciar no Dataroom" link navigates to `/companies/:companyId/dataroom`
- Document list shows: thumbnail (if available), file name, page count, file size
- Category tabs filter documents by their dataroom category
- No save button on this tab

### Tab: Compartilhar (Share)

**Component**: `ProfileShareTab`

**Layout**: Share settings card.

```
┌─────────────────────────────────────────────────────────┐
│  Link de compartilhamento                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ https://app.navia.com.br/p/luminatech-a3f2 [📋] │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Slug personalizado                                      │
│  ┌────────────────────────────┐                          │
│  │ app.navia.com.br/p/ [____] │  [Salvar]               │
│  └────────────────────────────┘                          │
│  Helper: "Letras minusculas, numeros e hifens. 3-50 caracteres." │
│                                                          │
│  Tipo de acesso                                          │
│  ○ Publico — Qualquer pessoa com o link pode visualizar  │
│  ● Email — Visitante informa email antes de visualizar   │
│                                                          │
│  (Password option hidden for MVP)                        │
└─────────────────────────────────────────────────────────┘
```

**Share URL Display**:
- Full URL shown in a read-only input with a "Copy" icon button (clipboard icon)
- On copy: icon changes to checkmark for 2 seconds, tooltip shows "Copiado!"
- Uses `navigator.clipboard.writeText()` for copy functionality

**Custom Slug Editor**:
- Prefix "app.navia.com.br/p/" shown as static text (styled as `gray-500`)
- Editable slug input after the prefix
- "Salvar" button to confirm slug change
- Validation: lowercase, alphanumeric, hyphens only, 3-50 chars, cannot start/end with hyphen
- On save: sends `PUT /api/v1/companies/:companyId/profile/slug`
- On conflict (409): show inline error "Este slug ja esta em uso"

**Access Type Selector**:
- Radio button group with two options:
  - `PUBLIC`: "Publico" — description: "Qualquer pessoa com o link pode visualizar"
  - `EMAIL_GATED`: "Email" — description: "Visitante informa email antes de visualizar"
- Password option (`PASSWORD`) is NOT shown in the MVP UI
- Changing access type sends `PUT /api/v1/companies/:companyId/profile` with `{ accessType: "..." }`

### Tab: Analytics

**Component**: `ProfileAnalyticsTab`

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│  Period: [7d] [30d] [90d] [Todos]                        │
├─────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ Total Views│ │ Unique     │ │ Period     │           │
│  │     47     │ │ Viewers    │ │ Views      │           │
│  │            │ │     23     │ │     35     │           │
│  └────────────┘ └────────────┘ └────────────┘           │
├─────────────────────────────────────────────────────────┤
│  Views by Day (Recharts Line Chart)                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │         ╱╲                                       │    │
│  │   ╱╲  ╱  ╲   ╱╲                                 │    │
│  │  ╱  ╲╱    ╲ ╱  ╲                                │    │
│  │ ╱         ╲╱    ╲                               │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│  Top Document Downloads                                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Document Name                        Downloads  │    │
│  │ LuminaTech_PitchDeck_2024.pdf            18     │    │
│  │ Financeiro_Q4_2025.xlsx                  12     │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│  Recent Viewers                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Email              │ Date        │ View Count   │    │
│  │ investor@vc.com    │ 22/02/2026  │ 3            │    │
│  │ partner@fund.com   │ 21/02/2026  │ 1            │    │
│  └─────────────────────────────────────────────────┘    │
│  (Only shown when accessType is EMAIL_GATED)             │
└─────────────────────────────────────────────────────────┘
```

**Period Selector**:
- Segmented control (button group) with options: 7d, 30d, 90d, Todos
- Default: 30d
- Changing period refetches analytics data

**Stat Cards**:
- 3 stat cards in a row (following design-system.md stat card pattern)
- Total Views: all-time total
- Unique Viewers: unique by email (for email-gated) or by IP (for public)
- Period Views: views in the selected period

**Views by Day Chart**:
- Recharts `LineChart` with `ResponsiveContainer`
- X-axis: dates (formatted as dd/MM per i18n.md)
- Y-axis: view count
- Line color: `blue-600` (#1B6B93)
- Area fill: `blue-50` (#EAF5FA) at 30% opacity
- Grid lines: `gray-200`, dashed
- Tooltip: white bg, `shadow-lg`, shows date and view count

**Top Document Downloads Table**:
- Simple table showing document name and download count
- Sorted by download count descending
- Max 10 rows
- If no downloads: show "Nenhum download registrado" empty state

**Recent Viewers Table**:
- Columns: Email, Date (formatted dd/MM/yyyy), View Count
- Sorted by most recent first
- Max 20 rows with "Ver mais" link if more exist
- Only shown when `accessType` is `EMAIL_GATED` (for `PUBLIC` profiles, viewer emails are not collected)
- If no viewers: show "Nenhum visualizador registrado" empty state

**Data Source**: `GET /api/v1/companies/:companyId/profile/analytics?period={period}`

### Tab: AI Summary

**Component**: `ProfileAISummaryTab`

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│  Resumo por IA                                           │
│  body-sm: "Resumo gerado automaticamente com base no     │
│  perfil, documentos e dados financeiros da empresa"       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐    │
│  │ AI-generated summary text displayed here.        │    │
│  │ Editable textarea when in edit mode.             │    │
│  │                                                   │    │
│  │ [Edit] [Regenerate]                               │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  Stale indicator (when applicable):                      │
│  ⚠ "Resumo pode estar desatualizado — Regenerar"         │
└─────────────────────────────────────────────────────────┘
```

**Summary Display**:
- Shows the `aiSummary` text in a read-only card when not editing
- "Edit" button (ghost variant) switches to textarea mode for manual editing
- "Regenerate" button (secondary variant) triggers `POST /api/v1/companies/:companyId/profile/generate-summary`
- Regenerate button shows a loading spinner while the async job is in progress
- On successful regeneration, the new summary replaces the current one

**Stale Indicator**:
- Displayed as a `cream-100` bg banner with `cream-700` text and a warning icon
- Shown when documents have been added/removed or financial highlights have changed since the last generation
- Clicking "Regenerar" in the banner triggers the same regeneration endpoint

**Empty State**:
- When no summary exists yet:
  - Icon: `sparkles` (Lucide), 48px, `gray-300`
  - Title: "Gere um resumo da sua empresa"
  - Description: "Use IA para criar um resumo profissional baseado nos dados do seu perfil"
  - CTA: "Gerar Resumo" (primary button)

**Edit Mode**:
- Textarea with same styling as the description field (4 rows min, auto-expand, max 5000 chars)
- "Salvar" and "Cancelar" buttons below the textarea
- Save sends `PUT /api/v1/companies/:companyId/profile` with `{ aiSummary: "..." }`

### Tab: Financeiro (Financial Highlights)

**Component**: `ProfileFinancialsTab`

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│  Destaques Financeiros                                   │
│  body-sm: "Metricas financeiras do Open Finance"         │
│  Last updated: 15/02/2026 10:30                          │
├─────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ Saldo Total│ │ Receita    │ │ Despesas   │           │
│  │ R$ 150.000 │ │ R$ 45.000  │ │ R$ 38.000  │           │
│  └────────────┘ └────────────┘ └────────────┘           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐           │
│  │ Burn Rate  │ │ Runway     │ │ MRR Est.   │           │
│  │ R$ 38.000  │ │ 4 meses   │ │ R$ 42.000  │           │
│  └────────────┘ └────────────┘ └────────────┘           │
├─────────────────────────────────────────────────────────┤
│  ℹ "Dados atualizados automaticamente via Open Finance"  │
│  [Configurar Open Finance →]                              │
└─────────────────────────────────────────────────────────┘
```

**Financial Metric Cards**:
- 6 stat cards in a 3x2 grid (following design-system.md stat card pattern)
- All monetary values formatted as BRL using Brazilian number formatting (R$ X.XXX,XX)
- Runway displayed as "{N} meses" (months)
- Cards are read-only — no edit capability
- "Last updated" timestamp formatted as dd/MM/yyyy HH:mm per i18n.md

**Empty State (No Open Finance Connection)**:
- Icon: `landmark` (Lucide), 48px, `gray-300`
- Title: "Conecte seus dados financeiros"
- Description: "Integre via Open Finance para exibir metricas financeiras automaticamente"
- CTA: "Configurar Open Finance" (primary button) — navigates to Open Finance settings

**Info Banner**:
- `blue-50` bg, `blue-600` text, info icon
- Text: "Dados atualizados automaticamente via Open Finance"
- Link: "Configurar Open Finance" navigates to the Open Finance settings page

### Tab: Config (Settings)

**Component**: `ProfileSettingsTab`

**Layout**:

```
┌─────────────────────────────────────────────────────────┐
│  Configuracoes do Perfil                                 │
├─────────────────────────────────────────────────────────┤
│  Frequencia de atualizacao para investidores             │
│  body-sm: "Define com que frequencia investidores        │
│  recebem atualizacoes sobre a empresa"                   │
│  ┌───────────────────────────────┐                       │
│  │ ○ Semanal                      │                       │
│  │ ○ Quinzenal                    │                       │
│  │ ● Mensal (padrao)              │                       │
│  │ ○ Trimestral                   │                       │
│  └───────────────────────────────┘                       │
├─────────────────────────────────────────────────────────┤
│  Processamento automatico com IA                         │
│  body-sm: "Processar automaticamente novos documentos    │
│  enviados ao dataroom com inteligencia artificial"        │
│  [Toggle: ON]                                             │
├─────────────────────────────────────────────────────────┤
│  [Salvar Configuracoes]                                   │
└─────────────────────────────────────────────────────────┘
```

**Investor Update Frequency**:
- Radio button group with 4 options: Semanal, Quinzenal, Mensal, Trimestral
- Default: Mensal (MONTHLY)
- Maps to `investorUpdateFrequency` enum

**Auto-Process with AI Toggle**:
- shadcn/ui `Switch` component
- Default: ON (true)
- Maps to `autoProcessWithAI` boolean
- When enabled, newly uploaded dataroom documents are automatically queued for AI processing

**Save Behavior**:
- "Salvar Configuracoes" button at the bottom
- Sends `PUT /api/v1/companies/:companyId/profile` with `{ investorUpdateFrequency: "...", autoProcessWithAI: true/false }`

### Public Profile Page (`/p/:slug`)

**Component**: `PublicProfilePage`

This is a standalone page with NO dashboard shell — no sidebar, no top bar, no authentication required. It uses its own minimal layout.

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│                   max-width: 960px                       │
│                   centered, padding 32px                 │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  [Company Logo 64px]                             │    │
│  │  Company Name (h1, navy-900)                     │    │
│  │  Headline (body-lg, gray-600)                    │    │
│  │  📍 Location • 📅 Founded 2022 • 🏷 Fintech     │    │
│  │  🔗 website.com.br                               │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Description (body, gray-600, white-space pre-   │    │
│  │  wrap for line breaks)                            │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐                             │
│  │[icon]│ │[icon]│ │[icon]│   ← Metrics grid            │
│  │value │ │value │ │value │     3 cols desktop           │
│  │label │ │label │ │label │     2 cols tablet            │
│  └──────┘ └──────┘ └──────┘     1 col mobile             │
│                                                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │ [Photo] │ │[Initials]│ │ [Photo] │  ← Team grid      │
│  │  Name   │ │  Name    │ │  Name   │    3 cols desktop  │
│  │  Title  │ │  Title   │ │  Title  │    2 cols tablet   │
│  │ [in]    │ │ [in]     │ │ [in]    │    1 col mobile    │
│  └─────────┘ └─────────┘ └─────────┘                    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Documents by Category                            │    │
│  │  Tabs: [Pitch Deck] [Financeiro] [Juridico]      │    │
│  │  ┌─────────────────────────────────────────┐     │    │
│  │  │ [📄] Document Name    12 pgs   [View] [↓] │     │    │
│  │  └─────────────────────────────────────────┘     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Verificacao Litigiosa                            │    │
│  │  Nivel de Risco: MEDIO (badge)                    │    │
│  │  Consultado em: 23/02/2026                        │    │
│  │                                                    │    │
│  │  ▸ 2 processos ativos • R$ 225.000 em disputa     │    │
│  │                                                    │    │
│  │  [Click to expand / collapse]                      │    │
│  │  ┌───────────────────────────────────────────┐    │    │
│  │  │ Processo    │ Vara   │ Tipo  │ Valor │ Data│    │    │
│  │  │ 000123...   │ TJSP   │ CIVIL │ 150k  │ 2024│    │    │
│  │  │ 000456...   │ TJSP   │ TRAB  │  75k  │ 2023│    │    │
│  │  └───────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ─────────────────────────────────────────────────────  │
│  Powered by Navia                      ← Footer          │
└─────────────────────────────────────────────────────────┘
```

**Sections** (rendered in this order, each section only shown if data exists):

1. **Header** (`PublicProfileHeader`):
   - Company logo: 64px, `radius-lg`, fallback to first letter on `navy-900` bg
   - Company name: `h1`, `navy-900`
   - Headline: `body-lg`, `gray-600`, below company name
   - Metadata row: location (with `map-pin` icon), founded year (with `calendar` icon), sector badge (`blue-50` bg, `blue-600` text, pill shape). Items separated by bullet character. Only shown if data exists.
   - Website: `blue-600` link with `external-link` icon, opens in new tab

2. **Description**: Full text with `white-space: pre-wrap` to preserve line breaks. `body` size, `gray-600`. In a card with `24px` padding.

3. **Metrics** (`PublicMetricsGrid`):
   - Grid layout: 3 columns on desktop (>= 1024px), 2 columns on tablet (>= 768px), 1 column on mobile
   - Each metric card: white bg, `gray-200` border, `radius-lg`, `24px` padding, centered content
   - Icon: 24px, `blue-600` color, centered above value
   - Value: `h2` size (24px), `navy-900`, bold. Formatted using `formattedValue` from API.
   - Label: `caption` size (12px), `gray-500`, below value
   - Section only rendered if at least one metric exists

4. **Team** (`PublicTeamGrid`):
   - Section title: `h2` "Equipe Fundadora"
   - Grid layout: 3 columns desktop, 2 tablet, 1 mobile
   - Each card: white bg, `gray-200` border, `radius-lg`, `24px` padding, centered content
   - Photo: 80px circle, `radius-full`. Fallback to initials on `blue-600` bg.
   - Name: `body` weight 600, `gray-800`
   - Title: `body-sm`, `gray-500`
   - LinkedIn: Small `linkedin` icon button, `gray-400`, hover `blue-600`, opens in new tab
   - Section only rendered if at least one team member exists

5. **Documents** (`PublicDocumentList`):
   - Section title: `h2` "Documentos"
   - Category tabs for filtering
   - Each document row: thumbnail (48px height, `radius-sm`), document name (`body`, `gray-700`), page count (`caption`, `gray-500`), view and download buttons
   - "View" button opens document in new tab (inline PDF viewer via pre-signed URL)
   - "Download" button triggers file download via pre-signed URL
   - Section only rendered if at least one document exists

6. **Litigation** (`PublicLitigationSection`):
   - Section title: `h2` "Verificacao Litigiosa"
   - Risk level badge:
     - LOW: `green-100` bg, `green-700` text, "Baixo"
     - MEDIUM: `cream-100` bg, `cream-700` text, "Medio"
     - HIGH: `#FEE2E2` bg, `#991B1B` text, "Alto"
   - Fetched date: "Consultado em: dd/MM/yyyy" (`caption`, `gray-500`)
   - **Summary view** (always visible): "{N} processos ativos * R$ {value} em disputa" as a single line summary
   - **Expandable details** (collapsed by default): Click "Ver detalhes" to expand a table with lawsuit details:
     - Columns: Processo (process ID), Vara (court), Tipo (case type), Valor (value, formatted as R$), Data (filing date)
     - Collapse button: "Ocultar detalhes"
     - Uses shadcn/ui `Collapsible` component
   - **Pending state**: When `litigationStatus === 'PENDING'`, show: "Verificacao em andamento..." with a subtle loading indicator (pulsing dot)
   - **Failed state**: When `litigationStatus === 'FAILED'`, show: "Verificacao indisponivel no momento" in `gray-500`
   - Section only rendered if litigation data has been fetched (status is not null)

7. **Footer**:
   - Divider: `1px solid gray-200`
   - "Powered by Navia" text: `caption`, `gray-400`, centered
   - Optional: Navia logo (small, grayscale)

**Profile Not Available States**:
- When profile is DRAFT or ARCHIVED: show a centered page with "Este perfil nao esta disponivel" (`h2`, `gray-700`) and "Entre em contato com a empresa para mais informacoes" (`body`, `gray-500`). No login prompt.
- When slug does not exist: same "not available" page (no distinction to prevent enumeration, per SEC-5).

### Email Gate Modal

**Component**: `EmailGateModal`

Shown as a full-page overlay when `accessType === 'EMAIL_GATED'` before the profile content loads.

```
┌────────────────────────────────────────┐
│                                        │
│          ┌──────────────────┐          │
│          │  [Company Logo]  │          │
│          │                  │          │
│          │  Company Name    │          │
│          │                  │          │
│          │  Insira seu      │          │
│          │  email para      │          │
│          │  visualizar      │          │
│          │                  │          │
│          │  [email input ]  │          │
│          │  [View Profile]  │          │
│          │                  │          │
│          │  Seu email e     │          │
│          │  utilizado apenas│          │
│          │  para analytics. │          │
│          └──────────────────┘          │
│                                        │
│          Background: gray-50           │
└────────────────────────────────────────┘
```

- Overlay: full viewport, `gray-50` bg
- Card: white bg, `shadow-lg`, `radius-xl`, max-width 420px, centered vertically and horizontally
- Company logo: 48px, centered, `radius-lg`
- Company name: `h3`, `navy-900`, centered
- Prompt text: `body`, `gray-600`, centered
- Email input: Standard input field, type `email`, placeholder "seu@email.com"
- Submit button: Primary variant, full-width, "Visualizar Perfil"
- Disclaimer: `caption`, `gray-400`, centered, below the button
- Validation: Email format validation client-side. On invalid email, show inline error below input.
- On submit: Calls `GET /api/v1/profiles/:slug?email={email}` — on success, stores email in session state and renders the profile. The email is passed as a query parameter on the initial fetch only; subsequent page interactions do not require re-entering.

### Preview Mode

**Component**: `ProfilePreviewBanner`

When ADMIN clicks "Preview" in the editor, the page transitions to preview mode:

1. A sticky banner appears at the top of the page:
   - Background: `cream-100` (warning-tinted)
   - Text: "Voce esta visualizando o preview do perfil" (`body-sm`, `cream-700`)
   - "Sair do Preview" button: Secondary variant, right-aligned
   - Height: 48px

2. Below the banner, the `PublicProfilePage` component renders with the current profile data (same component used for `/p/:slug`), but:
   - Fetches data from the authenticated endpoint `GET /api/v1/companies/:companyId/profile` (not the public endpoint)
   - No view is recorded
   - Email gate is NOT shown (even if access type is EMAIL_GATED)

3. Clicking "Sair do Preview" returns to the editor view on the same tab the user was on before.

### Component List

| Component | Location | Purpose |
|-----------|----------|---------|
| `ProfileEditorPage` | `app/(dashboard)/companies/[companyId]/profile/page.tsx` | Main profile editor page with tabs |
| `ProfileInfoTab` | `components/profile/ProfileInfoTab.tsx` | Info form (headline, description, sector, etc.) |
| `ProfileMetricsTab` | `components/profile/ProfileMetricsTab.tsx` | Metrics list with add/edit/reorder |
| `MetricCard` | `components/profile/MetricCard.tsx` | Individual metric card in the editor |
| `MetricForm` | `components/profile/MetricForm.tsx` | Metric editing form fields |
| `ProfileTeamTab` | `components/profile/ProfileTeamTab.tsx` | Team member list with add/edit/reorder |
| `TeamMemberCard` | `components/profile/TeamMemberCard.tsx` | Individual team member card in the editor |
| `TeamMemberForm` | `components/profile/TeamMemberForm.tsx` | Team member editing form fields |
| `ProfileDocumentsTab` | `components/profile/ProfileDocumentsTab.tsx` | Read-only document list linked from dataroom |
| `ProfileShareTab` | `components/profile/ProfileShareTab.tsx` | Share URL, slug editor, access type selector |
| `ProfileAnalyticsTab` | `components/profile/ProfileAnalyticsTab.tsx` | Analytics dashboard with charts and tables |
| `AnalyticsChart` | `components/profile/AnalyticsChart.tsx` | Recharts line chart for views by day |
| `ViewersTable` | `components/profile/ViewersTable.tsx` | Recent viewers table |
| `PublicProfilePage` | `app/p/[slug]/page.tsx` | Public profile page (standalone layout) |
| `PublicProfileHeader` | `components/profile/public/PublicProfileHeader.tsx` | Company name, logo, headline, metadata |
| `PublicMetricsGrid` | `components/profile/public/PublicMetricsGrid.tsx` | Metrics cards grid |
| `PublicTeamGrid` | `components/profile/public/PublicTeamGrid.tsx` | Team member cards grid |
| `PublicDocumentList` | `components/profile/public/PublicDocumentList.tsx` | Document list with category tabs |
| `PublicLitigationSection` | `components/profile/public/PublicLitigationSection.tsx` | Litigation summary and expandable details |
| `EmailGateModal` | `components/profile/public/EmailGateModal.tsx` | Email entry modal for email-gated profiles |
| `ProfilePreviewBanner` | `components/profile/ProfilePreviewBanner.tsx` | Sticky banner shown during preview mode |
| `ShareUrlCopyButton` | `components/profile/ShareUrlCopyButton.tsx` | Copy-to-clipboard button with feedback |
| `StatusBadge` | `components/profile/StatusBadge.tsx` | DRAFT/PUBLISHED/ARCHIVED status badge |

### TanStack Query Hooks

All hooks live in `hooks/profile/`.

```typescript
// hooks/profile/useProfile.ts
// Fetches the company profile for the editor
// GET /api/v1/companies/:companyId/profile
export function useProfile(companyId: string) {
  return useQuery({
    queryKey: ['profile', companyId],
    queryFn: () => api.get(`/api/v1/companies/${companyId}/profile`),
  });
}

// hooks/profile/useUpdateProfile.ts
// Updates profile info fields
// PUT /api/v1/companies/:companyId/profile
export function useUpdateProfile(companyId: string) {
  return useMutation({
    mutationFn: (data: UpdateProfileDto) =>
      api.put(`/api/v1/companies/${companyId}/profile`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', companyId] });
    },
  });
}

// hooks/profile/useUpdateMetrics.ts
// Replaces all metrics
// PUT /api/v1/companies/:companyId/profile/metrics
export function useUpdateMetrics(companyId: string) {
  return useMutation({
    mutationFn: (data: UpdateMetricsDto) =>
      api.put(`/api/v1/companies/${companyId}/profile/metrics`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', companyId] });
    },
  });
}

// hooks/profile/useUpdateTeam.ts
// Replaces all team members
// PUT /api/v1/companies/:companyId/profile/team
export function useUpdateTeam(companyId: string) {
  return useMutation({
    mutationFn: (data: UpdateTeamDto) =>
      api.put(`/api/v1/companies/${companyId}/profile/team`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', companyId] });
    },
  });
}

// hooks/profile/usePublishProfile.ts
// POST /api/v1/companies/:companyId/profile/publish
export function usePublishProfile(companyId: string) {
  return useMutation({
    mutationFn: () =>
      api.post(`/api/v1/companies/${companyId}/profile/publish`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', companyId] });
    },
  });
}

// hooks/profile/useUnpublishProfile.ts
// POST /api/v1/companies/:companyId/profile/unpublish
export function useUnpublishProfile(companyId: string) {
  return useMutation({
    mutationFn: () =>
      api.post(`/api/v1/companies/${companyId}/profile/unpublish`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', companyId] });
    },
  });
}

// hooks/profile/useArchiveProfile.ts
// POST /api/v1/companies/:companyId/profile/archive
export function useArchiveProfile(companyId: string) {
  return useMutation({
    mutationFn: () =>
      api.post(`/api/v1/companies/${companyId}/profile/archive`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', companyId] });
    },
  });
}

// hooks/profile/useUpdateSlug.ts
// PUT /api/v1/companies/:companyId/profile/slug
export function useUpdateSlug(companyId: string) {
  return useMutation({
    mutationFn: (data: { slug: string }) =>
      api.put(`/api/v1/companies/${companyId}/profile/slug`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', companyId] });
    },
  });
}

// hooks/profile/useProfileAnalytics.ts
// GET /api/v1/companies/:companyId/profile/analytics?period=:period
export function useProfileAnalytics(companyId: string, period: string = '30d') {
  return useQuery({
    queryKey: ['profile-analytics', companyId, period],
    queryFn: () =>
      api.get(`/api/v1/companies/${companyId}/profile/analytics?period=${period}`),
  });
}

// hooks/profile/usePublicProfile.ts
// GET /api/v1/profiles/:slug?email=:email
export function usePublicProfile(slug: string, email?: string) {
  const params = email ? `?email=${encodeURIComponent(email)}` : '';
  return useQuery({
    queryKey: ['public-profile', slug, email],
    queryFn: () => api.get(`/api/v1/profiles/${slug}${params}`),
    enabled: !!slug && (/* accessType is PUBLIC */ true || !!email),
  });
}

// hooks/profile/useUploadTeamPhoto.ts
// POST /api/v1/companies/:companyId/profile/team/photo
export function useUploadTeamPhoto(companyId: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      return api.upload(`/api/v1/companies/${companyId}/profile/team/photo`, formData);
    },
  });
}
```

### Loading States

| Context | Loading Pattern |
|---------|-----------------|
| Profile editor initial load | Skeleton screen: rectangular blocks matching the tab bar and form layout |
| Public profile page | Skeleton screen: company header skeleton, 3 metric card skeletons, 3 team card skeletons |
| Analytics tab | Skeleton screen: 3 stat card skeletons, chart area skeleton (rectangular block), table skeleton (5 rows) |
| Save actions | Button loading spinner (replaces label, maintains width) |
| Photo upload | Circular skeleton pulse in the photo area |
| Tab switching | No loading state (data is already fetched with the profile) |

### Empty States

| Context | Empty State |
|---------|-------------|
| No profile exists | Centered: `building-2` icon (64px, gray-300), "Crie o perfil da sua empresa" (h3), description text, "Criar Perfil" CTA button |
| No metrics | "Adicione metricas para destacar numeros importantes da sua empresa" with "Adicionar Metrica" button |
| No team members | "Adicione membros da equipe fundadora" with "Adicionar Membro" button |
| No documents in dataroom | "Nenhum documento no Dataroom. Adicione documentos para exibi-los no perfil." with "Ir para Dataroom" link |
| No analytics data | "Nenhuma visualizacao registrada ainda. Compartilhe o link do perfil para comecar a rastrear visualizacoes." |
| No downloads in analytics | "Nenhum download registrado" (caption, gray-500) |
| No viewers in analytics | "Nenhum visualizador registrado" (caption, gray-500) |

### Error States

| Context | Error Handling |
|---------|----------------|
| Profile save failure | Toast: error message from `messageKey` translation |
| Metric save failure | Toast: error message. Form retains unsaved state for user to retry. |
| Team save failure | Toast: error message. Form retains unsaved state for user to retry. |
| Slug conflict (409) | Inline error below slug input: "Este slug ja esta em uso" |
| Photo upload failure | Toast: "Falha ao enviar foto. Tente novamente." |
| Publish failure (empty profile) | Toast: "Perfil nao pode ser publicado sem conteudo. Adicione descricao, metricas, equipe ou documentos." |
| Public profile not found | Full-page: "Este perfil nao esta disponivel" |
| Email validation (email gate) | Inline error below input: "Formato de email invalido" |
| Analytics fetch failure | Toast: error message. Show "Erro ao carregar analytics. Tente novamente." in the tab area with a retry button. |

### Frontend i18n Keys

The following keys must be added to both `messages/pt-BR.json` and `messages/en.json`:

**PT-BR (`messages/pt-BR.json`)**:
```json
{
  "profile": {
    "title": "Perfil da Empresa",
    "createPrompt": "Crie o perfil da sua empresa",
    "createDescription": "Compartilhe informacoes da sua empresa com investidores e stakeholders",
    "createButton": "Criar Perfil",
    "tabs": {
      "info": "Informacoes",
      "metrics": "Metricas",
      "team": "Equipe",
      "documents": "Documentos",
      "share": "Compartilhar",
      "analytics": "Analytics"
    },
    "status": {
      "draft": "Rascunho",
      "published": "Publicado",
      "archived": "Arquivado"
    },
    "actions": {
      "publish": "Publicar",
      "unpublish": "Despublicar",
      "archive": "Arquivar",
      "preview": "Preview",
      "save": "Salvar",
      "exitPreview": "Sair do Preview"
    },
    "info": {
      "headline": "Headline",
      "headlinePlaceholder": "Uma frase sobre sua empresa...",
      "description": "Descricao",
      "descriptionPlaceholder": "Descreva sua empresa, produto e mercado...",
      "sector": "Setor",
      "sectorPlaceholder": "Selecione o setor",
      "foundedYear": "Ano de Fundacao",
      "foundedYearPlaceholder": "2020",
      "website": "Website",
      "websitePlaceholder": "https://suaempresa.com.br",
      "location": "Localizacao",
      "locationPlaceholder": "Sao Paulo, SP",
      "saved": "Perfil atualizado com sucesso"
    },
    "metrics": {
      "title": "Metricas",
      "add": "Adicionar Metrica",
      "maxReached": "Maximo de 6 metricas atingido",
      "save": "Salvar Metricas",
      "saved": "Metricas atualizadas com sucesso",
      "emptyState": "Adicione metricas para destacar numeros importantes da sua empresa",
      "labelPlaceholder": "Nome da metrica",
      "valuePlaceholder": "Valor",
      "templates": {
        "employees": "Funcionarios",
        "arr": "ARR",
        "mrr": "MRR",
        "monthlyRevenue": "Receita Mensal",
        "clients": "Clientes",
        "sector": "Setor"
      },
      "formats": {
        "number": "Numero",
        "currencyBrl": "Moeda (BRL)",
        "currencyUsd": "Moeda (USD)",
        "percentage": "Porcentagem",
        "text": "Texto"
      }
    },
    "team": {
      "title": "Equipe Fundadora",
      "add": "Adicionar Membro",
      "maxReached": "Maximo de 10 membros atingido",
      "save": "Salvar Equipe",
      "saved": "Equipe atualizada com sucesso",
      "emptyState": "Adicione membros da equipe fundadora",
      "uploadPhoto": "Enviar foto",
      "namePlaceholder": "Nome completo",
      "titlePlaceholder": "Cargo / Funcao",
      "linkedinPlaceholder": "https://linkedin.com/in/..."
    },
    "documents": {
      "title": "Documentos do Dataroom",
      "description": "Gerencie seus documentos no Dataroom",
      "manageInDataroom": "Gerenciar no Dataroom",
      "emptyState": "Nenhum documento no Dataroom. Adicione documentos para exibi-los no perfil.",
      "emptyCategory": "Nenhum documento nesta categoria.",
      "goToDataroom": "Ir para Dataroom"
    },
    "share": {
      "title": "Compartilhamento",
      "shareUrl": "Link de compartilhamento",
      "copyLink": "Copiar link",
      "copied": "Copiado!",
      "customSlug": "Slug personalizado",
      "slugHelper": "Letras minusculas, numeros e hifens. 3-50 caracteres.",
      "slugSaved": "Slug atualizado com sucesso",
      "slugConflict": "Este slug ja esta em uso",
      "accessType": {
        "label": "Tipo de acesso",
        "public": "Publico",
        "publicDescription": "Qualquer pessoa com o link pode visualizar",
        "emailGated": "Email",
        "emailGatedDescription": "Visitante informa email antes de visualizar"
      }
    },
    "analytics": {
      "title": "Analytics",
      "totalViews": "Visualizacoes Totais",
      "uniqueViewers": "Visitantes Unicos",
      "periodViews": "Visualizacoes no Periodo",
      "viewsByDay": "Visualizacoes por Dia",
      "topDownloads": "Top Downloads",
      "recentViewers": "Visitantes Recentes",
      "noViews": "Nenhuma visualizacao registrada ainda. Compartilhe o link do perfil para comecar a rastrear visualizacoes.",
      "noDownloads": "Nenhum download registrado",
      "noViewers": "Nenhum visualizador registrado",
      "viewMore": "Ver mais",
      "periods": {
        "7d": "7 dias",
        "30d": "30 dias",
        "90d": "90 dias",
        "all": "Todos"
      },
      "error": "Erro ao carregar analytics. Tente novamente.",
      "retry": "Tentar novamente"
    },
    "public": {
      "poweredBy": "Powered by Navia",
      "foundingTeam": "Equipe Fundadora",
      "documents": "Documentos",
      "viewDocument": "Visualizar",
      "downloadDocument": "Baixar",
      "emailGate": {
        "title": "Insira seu email para visualizar o perfil",
        "placeholder": "seu@email.com",
        "submit": "Visualizar Perfil",
        "disclaimer": "Seu email e utilizado apenas para fins de analytics.",
        "invalidEmail": "Formato de email invalido"
      },
      "litigation": {
        "title": "Verificacao Litigiosa",
        "riskLevel": {
          "low": "Baixo",
          "medium": "Medio",
          "high": "Alto"
        },
        "fetchedAt": "Consultado em",
        "activeLawsuits": "processos ativos",
        "inDispute": "em disputa",
        "expandDetails": "Ver detalhes",
        "collapseDetails": "Ocultar detalhes",
        "pending": "Verificacao em andamento...",
        "failed": "Verificacao indisponivel no momento",
        "columns": {
          "processId": "Processo",
          "court": "Vara",
          "caseType": "Tipo",
          "value": "Valor",
          "filingDate": "Data"
        }
      },
      "notAvailable": "Este perfil nao esta disponivel",
      "notAvailableDescription": "Entre em contato com a empresa para mais informacoes",
      "archived": "Este perfil foi arquivado"
    },
    "preview": {
      "banner": "Voce esta visualizando o preview do perfil",
      "exit": "Sair do Preview"
    }
  }
}
```

**EN (`messages/en.json`)**:
```json
{
  "profile": {
    "title": "Company Profile",
    "createPrompt": "Create your company profile",
    "createDescription": "Share your company information with investors and stakeholders",
    "createButton": "Create Profile",
    "tabs": {
      "info": "Information",
      "metrics": "Metrics",
      "team": "Team",
      "documents": "Documents",
      "share": "Share",
      "analytics": "Analytics"
    },
    "status": {
      "draft": "Draft",
      "published": "Published",
      "archived": "Archived"
    },
    "actions": {
      "publish": "Publish",
      "unpublish": "Unpublish",
      "archive": "Archive",
      "preview": "Preview",
      "save": "Save",
      "exitPreview": "Exit Preview"
    },
    "info": {
      "headline": "Headline",
      "headlinePlaceholder": "A short tagline about your company...",
      "description": "Description",
      "descriptionPlaceholder": "Describe your company, product, and market...",
      "sector": "Sector",
      "sectorPlaceholder": "Select sector",
      "foundedYear": "Founded Year",
      "foundedYearPlaceholder": "2020",
      "website": "Website",
      "websitePlaceholder": "https://yourcompany.com",
      "location": "Location",
      "locationPlaceholder": "Sao Paulo, SP",
      "saved": "Profile updated successfully"
    },
    "metrics": {
      "title": "Metrics",
      "add": "Add Metric",
      "maxReached": "Maximum of 6 metrics reached",
      "save": "Save Metrics",
      "saved": "Metrics updated successfully",
      "emptyState": "Add metrics to highlight important numbers about your company",
      "labelPlaceholder": "Metric name",
      "valuePlaceholder": "Value",
      "templates": {
        "employees": "Employees",
        "arr": "ARR",
        "mrr": "MRR",
        "monthlyRevenue": "Monthly Revenue",
        "clients": "Clients",
        "sector": "Sector"
      },
      "formats": {
        "number": "Number",
        "currencyBrl": "Currency (BRL)",
        "currencyUsd": "Currency (USD)",
        "percentage": "Percentage",
        "text": "Text"
      }
    },
    "team": {
      "title": "Founding Team",
      "add": "Add Member",
      "maxReached": "Maximum of 10 members reached",
      "save": "Save Team",
      "saved": "Team updated successfully",
      "emptyState": "Add founding team members",
      "uploadPhoto": "Upload photo",
      "namePlaceholder": "Full name",
      "titlePlaceholder": "Role / Position",
      "linkedinPlaceholder": "https://linkedin.com/in/..."
    },
    "documents": {
      "title": "Dataroom Documents",
      "description": "Manage your documents in the Dataroom",
      "manageInDataroom": "Manage in Dataroom",
      "emptyState": "No documents in the Dataroom. Add documents to display them on the profile.",
      "emptyCategory": "No documents in this category.",
      "goToDataroom": "Go to Dataroom"
    },
    "share": {
      "title": "Sharing",
      "shareUrl": "Share link",
      "copyLink": "Copy link",
      "copied": "Copied!",
      "customSlug": "Custom slug",
      "slugHelper": "Lowercase letters, numbers, and hyphens. 3-50 characters.",
      "slugSaved": "Slug updated successfully",
      "slugConflict": "This slug is already in use",
      "accessType": {
        "label": "Access type",
        "public": "Public",
        "publicDescription": "Anyone with the link can view",
        "emailGated": "Email",
        "emailGatedDescription": "Visitor enters email before viewing"
      }
    },
    "analytics": {
      "title": "Analytics",
      "totalViews": "Total Views",
      "uniqueViewers": "Unique Viewers",
      "periodViews": "Period Views",
      "viewsByDay": "Views by Day",
      "topDownloads": "Top Downloads",
      "recentViewers": "Recent Viewers",
      "noViews": "No views recorded yet. Share the profile link to start tracking views.",
      "noDownloads": "No downloads recorded",
      "noViewers": "No viewers recorded",
      "viewMore": "View more",
      "periods": {
        "7d": "7 days",
        "30d": "30 days",
        "90d": "90 days",
        "all": "All time"
      },
      "error": "Failed to load analytics. Try again.",
      "retry": "Try again"
    },
    "public": {
      "poweredBy": "Powered by Navia",
      "foundingTeam": "Founding Team",
      "documents": "Documents",
      "viewDocument": "View",
      "downloadDocument": "Download",
      "emailGate": {
        "title": "Enter your email to view the profile",
        "placeholder": "your@email.com",
        "submit": "View Profile",
        "disclaimer": "Your email is used for analytics purposes only.",
        "invalidEmail": "Invalid email format"
      },
      "litigation": {
        "title": "Litigation Verification",
        "riskLevel": {
          "low": "Low",
          "medium": "Medium",
          "high": "High"
        },
        "fetchedAt": "Fetched on",
        "activeLawsuits": "active lawsuits",
        "inDispute": "in dispute",
        "expandDetails": "View details",
        "collapseDetails": "Hide details",
        "pending": "Verification in progress...",
        "failed": "Verification unavailable at the moment",
        "columns": {
          "processId": "Process",
          "court": "Court",
          "caseType": "Type",
          "value": "Value",
          "filingDate": "Date"
        }
      },
      "notAvailable": "This profile is not available",
      "notAvailableDescription": "Contact the company for more information",
      "archived": "This profile has been archived"
    },
    "preview": {
      "banner": "You are viewing the profile preview",
      "exit": "Exit Preview"
    }
  }
}
```

**Error keys** (already defined in the Error Codes section of this spec — these map to the `errors.profile.*` namespace):
- `errors.profile.notFound` — PT: "Perfil da empresa nao encontrado" / EN: "Company profile not found"
- `errors.profile.alreadyExists` — PT: "Empresa ja possui um perfil" / EN: "Company already has a profile"
- `errors.profile.companyNotActive` — PT: "Empresa nao esta ativa para criacao de perfil" / EN: "Company is not active for profile creation"
- `errors.profile.empty` — PT: "Perfil nao pode ser publicado sem conteudo" / EN: "Profile cannot be published without content"
- `errors.profile.emailRequired` — PT: "Email e obrigatorio para acessar este perfil" / EN: "Email is required to access this profile"

---

## Edge Cases & Error Handling

### EC-1: Company Deactivated While Profile Published
**Scenario**: An ADMIN deactivates the company while the profile is published.
**Handling**: Profile is automatically set to DRAFT. Shared link returns "Profile not available."

### EC-3: Slug Collision
**Scenario**: Two companies with similar names generate the same slug.
**Handling**: Auto-generated slugs include a 4-character random suffix. Custom slug changes return `409 Conflict` if taken.

### EC-6: Profile Viewed After Archival
**Scenario**: Investor bookmarked the link and visits after profile is archived.
**Handling**: Returns 404. Frontend shows "This profile is no longer available."

### EC-7: Concurrent Profile Edits
**Scenario**: Two ADMINs edit the profile simultaneously.
**Handling**: Last write wins (standard optimistic concurrency). No locking in MVP. The PUT endpoints replace full sections (metrics, team) to avoid partial merge conflicts.

---

## Dependencies

### Internal Dependencies
- **company-management.md**: Company entity (name, logoUrl, foundedDate, status)
- **company-dataroom.md**: Document management — upload, download, storage (see separate spec)
- **company-litigation-verification.md**: Litigation check via BigDataCorp (see separate spec)
- **user-permissions.md**: ADMIN and FINANCE role checks for profile editing
- **authentication.md**: Public profile endpoints skip auth; admin endpoints require Privy JWT
- **audit-logging.md**: Profile create, update, publish, archive events
- **security.md**: File upload validation (MIME + magic bytes), EXIF stripping, S3 pre-signed URLs

---

## Technical Implementation

### ProfileService — Profile CRUD

```typescript
// /backend/src/profile/profile.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import slugify from 'slugify';
import { randomBytes } from 'crypto';

@Injectable()
export class ProfileService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('profile-litigation') private litigationCheckQueue: Queue,
  ) {}

  async create(companyId: string, dto: CreateProfileDto) {
    // Check company exists and is active
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    if (company.status !== 'ACTIVE') {
      throw new BusinessRuleException(
        'PROFILE_COMPANY_NOT_ACTIVE',
        'errors.profile.companyNotActive',
      );
    }

    // Check no existing profile
    const existing = await this.prisma.companyProfile.findUnique({
      where: { companyId },
    });
    if (existing) {
      throw new ConflictException('Company already has a profile');
    }

    // Generate slug from company name
    const baseSlug = slugify(company.name, { lower: true, strict: true });
    const suffix = randomBytes(2).toString('hex'); // 4-char random suffix
    const slug = `${baseSlug}-${suffix}`;

    const profile = await this.prisma.companyProfile.create({
      data: {
        companyId,
        slug,
        status: 'DRAFT',
        headline: dto.headline,
        description: dto.description,
        sector: dto.sector,
        foundedYear: dto.foundedYear ?? company.foundedDate?.getFullYear(),
        website: dto.website,
        location: dto.location,
        accessType: dto.accessType ?? 'PUBLIC',
        litigationStatus: 'PENDING',
      },
    });

    // Dispatch BigDataCorp litigation check (non-blocking)
    // See company-litigation-verification.md for full implementation
    await this.litigationCheckQueue.add('fetch-litigation', {
      profileId: profile.id,
      companyId: companyId,
      cnpj: company.cnpj,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30000 }, // 30s, 60s, 120s
    });

    return profile;
  }

  async getPublicProfile(slug: string, password?: string, email?: string) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { slug },
      include: {
        company: { select: { name: true, logoUrl: true } },
        metrics: { orderBy: { order: 'asc' } },
        teamMembers: { orderBy: { order: 'asc' } },
        documents: { orderBy: [{ category: 'asc' }, { order: 'asc' }] },
      },
    });

    if (!profile || profile.status !== 'PUBLISHED') {
      throw new NotFoundException('Profile not found');
    }

    // Check access controls
    if (profile.accessType === 'PASSWORD') {
      if (!password) {
        throw new UnauthorizedException('Password required');
      }
      const valid = await bcrypt.compare(password, profile.accessPassword);
      if (!valid) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    if (profile.accessType === 'EMAIL_GATED') {
      if (!email) {
        throw new BusinessRuleException(
          'PROFILE_EMAIL_REQUIRED',
          'errors.profile.emailRequired',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    // Record view
    await this.prisma.profileView.create({
      data: {
        profileId: profile.id,
        viewerEmail: email || null,
        viewerIp: this.redactIp(/* from request context */),
        userAgent: /* from request context */,
        referrer: /* from request context */,
      },
    });

    return profile;
  }

  async publish(companyId: string) {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { companyId },
      include: {
        metrics: true,
        teamMembers: true,
        documents: true,
      },
    });

    if (!profile) throw new NotFoundException('Profile not found');

    // Check publishing prerequisites (BR-10)
    const hasContent =
      profile.description ||
      profile.metrics.length > 0 ||
      profile.teamMembers.length > 0 ||
      profile.documents.length > 0;

    if (!hasContent) {
      throw new BusinessRuleException(
        'PROFILE_EMPTY',
        'errors.profile.empty',
      );
    }

    return this.prisma.companyProfile.update({
      where: { companyId },
      data: {
        status: 'PUBLISHED',
        publishedAt: profile.publishedAt ?? new Date(),
      },
    });
  }

  private redactIp(ip: string): string {
    if (!ip) return 'unknown';
    const parts = ip.replace('::ffff:', '').split('.');
    if (parts.length === 4) {
      parts[3] = '0/24';
      return parts.join('.');
    }
    return ip;
  }
}
```

### Profile Controller

```typescript
// /backend/src/profile/profile.controller.ts
import {
  Controller, Get, Post, Put, Body, Param, Query,
  Headers, HttpCode, HttpStatus,
} from '@nestjs/common';
import { RequireAuth } from '../auth/decorators/require-auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auditable } from '../audit/auditable.decorator';

@Controller('api/v1')
export class ProfileController {
  constructor(
    private profileService: ProfileService,
  ) {}

  // --- Authenticated endpoints (company-scoped) ---

  @Post('companies/:companyId/profile')
  @RequireAuth()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @Auditable({ action: 'PROFILE_CREATED', resourceType: 'CompanyProfile', captureAfterState: true })
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateProfileDto,
  ) {
    return this.profileService.create(companyId, dto);
  }

  @Get('companies/:companyId/profile')
  @RequireAuth()
  async get(@Param('companyId') companyId: string) {
    return this.profileService.getByCompanyId(companyId);
  }

  @Put('companies/:companyId/profile')
  @RequireAuth()
  @Roles('ADMIN', 'FINANCE')
  @Auditable({ action: 'PROFILE_UPDATED', resourceType: 'CompanyProfile', captureBeforeState: true, captureAfterState: true })
  async update(
    @Param('companyId') companyId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.update(companyId, dto);
  }

  @Post('companies/:companyId/profile/publish')
  @RequireAuth()
  @Roles('ADMIN')
  @Auditable({ action: 'PROFILE_PUBLISHED', resourceType: 'CompanyProfile' })
  async publish(@Param('companyId') companyId: string) {
    return this.profileService.publish(companyId);
  }

  @Post('companies/:companyId/profile/unpublish')
  @RequireAuth()
  @Roles('ADMIN')
  @Auditable({ action: 'PROFILE_UNPUBLISHED', resourceType: 'CompanyProfile' })
  async unpublish(@Param('companyId') companyId: string) {
    return this.profileService.unpublish(companyId);
  }

  @Post('companies/:companyId/profile/archive')
  @RequireAuth()
  @Roles('ADMIN')
  @Auditable({ action: 'PROFILE_ARCHIVED', resourceType: 'CompanyProfile' })
  async archive(@Param('companyId') companyId: string) {
    return this.profileService.archive(companyId);
  }

  @Put('companies/:companyId/profile/metrics')
  @RequireAuth()
  @Roles('ADMIN', 'FINANCE')
  async updateMetrics(
    @Param('companyId') companyId: string,
    @Body() dto: UpdateMetricsDto,
  ) {
    return this.profileService.updateMetrics(companyId, dto);
  }

  @Put('companies/:companyId/profile/team')
  @RequireAuth()
  @Roles('ADMIN', 'FINANCE')
  async updateTeam(
    @Param('companyId') companyId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.profileService.updateTeam(companyId, dto);
  }

  @Put('companies/:companyId/profile/slug')
  @RequireAuth()
  @Roles('ADMIN')
  async updateSlug(
    @Param('companyId') companyId: string,
    @Body() dto: UpdateSlugDto,
  ) {
    return this.profileService.updateSlug(companyId, dto);
  }

  @Get('companies/:companyId/profile/analytics')
  @RequireAuth()
  @Roles('ADMIN', 'FINANCE')
  async getAnalytics(
    @Param('companyId') companyId: string,
    @Query('period') period: string = '30d',
  ) {
    return this.profileService.getAnalytics(companyId, period);
  }

  // --- Public endpoints (no auth) ---

  @Get('profiles/:slug')
  @Public()
  async getPublicProfile(
    @Param('slug') slug: string,
    @Headers('x-profile-password') password?: string,
    @Query('email') email?: string,
  ) {
    return this.profileService.getPublicProfile(slug, password, email);
  }
}
```

---

## Error Codes

### PROFILE — Profile Management

| Code | messageKey | HTTP | PT-BR | EN |
|------|-----------|------|-------|-----|
| `PROFILE_NOT_FOUND` | `errors.profile.notFound` | 404 | Perfil da empresa não encontrado | Company profile not found |
| `PROFILE_ALREADY_EXISTS` | `errors.profile.alreadyExists` | 409 | Empresa já possui um perfil | Company already has a profile |
| `PROFILE_COMPANY_NOT_ACTIVE` | `errors.profile.companyNotActive` | 422 | Empresa não está ativa para criação de perfil | Company is not active for profile creation |
| `PROFILE_EMPTY` | `errors.profile.empty` | 422 | Perfil não pode ser publicado sem conteúdo | Profile cannot be published without content |
| `PROFILE_EMAIL_REQUIRED` | `errors.profile.emailRequired` | 422 | Email é obrigatório para acessar este perfil | Email is required to access this profile |

### Audit Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `PROFILE_CREATED` | CompanyProfile | USER | Profile created via POST endpoint |
| `PROFILE_UPDATED` | CompanyProfile | USER | Profile fields updated via PUT endpoint |
| `PROFILE_PUBLISHED` | CompanyProfile | USER | Profile published |
| `PROFILE_UNPUBLISHED` | CompanyProfile | USER | Profile unpublished |
| `PROFILE_ARCHIVED` | CompanyProfile | USER | Profile archived |

---

## Security Considerations

### SEC-1: Public Profile Data Exposure
- Public profiles expose only curated data — never internal company data (financial details, member information, internal settings)
- Profile data is explicitly entered by the ADMIN; no automatic leakage of internal data
- Document downloads use pre-signed URLs with 15-minute expiry

### SEC-2: Access Control Enforcement
- Password-protected profiles use bcrypt hashing for the password
- Rate limit password attempts: 5 attempts per IP per 15 minutes to prevent brute-force
- Email-gated profiles validate email format but do not verify email ownership (not a security gate, just an analytics tool)

### SEC-4: View Analytics Privacy
- Viewer IP addresses are stored redacted to /24 subnet
- User agent strings are stored for analytics but not displayed in the admin UI (only used for bot filtering)
- Email addresses from email-gated profiles are stored in cleartext (they are voluntarily provided, not PII under LGPD in this context)

### SEC-5: Slug Enumeration Prevention
- Slugs include a random suffix to prevent enumeration
- Non-existent or unpublished slugs return the same `404` response (no information leakage about profile existence)

### SEC-6: Audit Logging
- Profile CRUD operations are audit-logged (see audit-logging.md)
- Profile publish/unpublish state changes are audit-logged
- Public view analytics are NOT audit-logged (they are tracked in ProfileView, not AuditLog)

---

## Success Criteria

### Performance
- Profile page load (public): < 1 second (including all metrics, team, and document metadata)
- Analytics dashboard load: < 2 seconds

### Accuracy
- Brazilian number formatting: matches i18n.md rules exactly
- View tracking: 100% of views recorded (including bots — filtered in analytics display)

### User Experience
- Profile creation to first publish: < 10 minutes
- Share modal: 1 click to copy link
- Preview mode: instant, no publish required
- Team member reordering: drag-and-drop

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-dataroom.md](./company-dataroom.md) | Dataroom document management — upload, download, storage, thumbnails |
| [company-litigation-verification.md](./company-litigation-verification.md) | Automatic litigation check via BigDataCorp — immutable litigation data on profile |
| [company-management.md](./company-management.md) | Profile reads company name, logo, founding date, entity type as defaults |
| [company-cnpj-validation.md](./company-cnpj-validation.md) | Profile uses the already-validated CNPJ for BigDataCorp litigation lookup |
| [company-data-enrichment.md](./company-data-enrichment.md) | Company data enrichment via CNPJ and external sources |
| [ai-document-intelligence.md](./ai-document-intelligence.md) | AI processing of documents and summary generation for company profiles |
| [investor-portal.md](./investor-portal.md) | Investor access to company profiles and investor update distribution |
| [open-finance.md](./open-finance.md) | Open Finance integration — source of financial highlights data on profile |
| [reports-analytics.md](./reports-analytics.md) | Due diligence package (auto-generated ZIP) is distinct from dataroom (manually curated) |
| [user-permissions.md](./user-permissions.md) | Only ADMIN and FINANCE roles can edit profile; shared link provides read-only external access |
| [api-standards.md](../.claude/rules/api-standards.md) | API endpoints follow `/api/v1/companies/:companyId/profile` pattern with envelope responses |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes for profile not found, invalid share link, access denied |
| [security.md](../.claude/rules/security.md) | Access controls on shared links; S3 storage for dataroom documents |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Profile publish/unpublish events logged |
| [i18n.md](../.claude/rules/i18n.md) | Profile content is user-authored and not translated; UI chrome follows i18n rules |
| [design-system.md](../.claude/rules/design-system.md) | Profile page follows Navia design system for public-facing pages |
