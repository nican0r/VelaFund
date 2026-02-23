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
- **reports-analytics.md**: The due diligence package export is an auto-generated ZIP of cap table data. The dataroom is a manually curated set of documents chosen by the founder.
- **user-permissions.md**: Only ADMIN and FINANCE roles can edit the profile. The shared link provides read-only access to external viewers without a Navia account.

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

  // Timestamps
  publishedAt: Date | null;            // When first published
  archivedAt: Date | null;             // When archived
  createdAt: Date;
  updatedAt: Date;
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
- Public profiles expose only curated data — never internal company data (cap table, transactions, shareholder details)
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
| [document-generation.md](./document-generation.md) | Dataroom documents are separate from generated legal documents; different storage prefix |
| [reports-analytics.md](./reports-analytics.md) | Due diligence package (auto-generated ZIP) is distinct from dataroom (manually curated) |
| [user-permissions.md](./user-permissions.md) | Only ADMIN and FINANCE roles can edit profile; shared link provides read-only external access |
| [shareholder-registry.md](./shareholder-registry.md) | Profile can display founding team members who may also be shareholders |
| [funding-rounds.md](./funding-rounds.md) | Profile shared with prospective investors during fundraising process |
| [api-standards.md](../.claude/rules/api-standards.md) | API endpoints follow `/api/v1/companies/:companyId/profile` pattern with envelope responses |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes for profile not found, invalid share link, access denied |
| [security.md](../.claude/rules/security.md) | Access controls on shared links; S3 storage for dataroom documents |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Profile publish/unpublish events logged |
| [i18n.md](../.claude/rules/i18n.md) | Profile content is user-authored and not translated; UI chrome follows i18n rules |
| [design-system.md](../.claude/rules/design-system.md) | Profile page follows Navia design system for public-facing pages |
