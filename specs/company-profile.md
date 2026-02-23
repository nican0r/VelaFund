# Company Profile & Dataroom Specification

**Topic of Concern**: Public-facing company profile and document dataroom for fundraising and investor relations

**One-Sentence Description**: The system provides a shareable company profile page where founders curate key startup information — description, metrics, founding team, and uploaded documents — that can be shared with investors and stakeholders via a unique link with optional access controls.

---

## Overview

The Company Profile is a curated, outward-facing view of a company on the Navia platform. It differs from the internal company settings (managed in `company-management.md`) in that it is designed to be shared externally — primarily with prospective investors during fundraising or due diligence.

The profile page includes:
- **Company overview**: name, sector, founding year, and a rich-text description
- **Key metrics**: employee count, ARR, MRR, or other financial metrics the founder chooses to display
- **Founding team**: team member cards with name, role/title, and photo
- **Dataroom documents**: uploaded files organized by category (pitch deck, financials, legal, etc.)
- **Share functionality**: unique shareable link with optional password protection and access tracking

The profile is **opt-in** — companies start with no profile. An ADMIN explicitly creates and publishes it. Data entered on the profile is separate from internal company data (e.g., the `description` on the profile may differ from `Company.description`).

### Relationship to Existing Features

- **company-management.md**: The profile reads the company's `name`, `logoUrl`, `foundedDate`, and `entityType` from the Company entity as defaults, but all profile fields are independently editable.
- **document-generation.md / document-signatures.md**: Dataroom documents are uploaded files (PDFs, images), not generated legal documents. They are stored in a separate S3 prefix.
- **reports-analytics.md**: The due diligence package export is an auto-generated ZIP of cap table data. The dataroom is a manually curated set of documents chosen by the founder.
- **user-permissions.md**: Only ADMIN and FINANCE roles can edit the profile. The shared link provides read-only access to external viewers without a Navia account.

---

## User Stories

### US-1: Create Company Profile
**As an** admin user
**I want to** create a public profile for my company with a description, metrics, and team information
**So that** I can showcase my startup to prospective investors in a professional format

### US-2: Upload Dataroom Documents
**As an** admin user
**I want to** upload documents (pitch deck, financials, term sheet, etc.) to the company profile
**So that** investors can review key materials without needing separate file-sharing tools

### US-3: Manage Founding Team
**As an** admin user
**I want to** add, edit, and reorder founding team members on the profile
**So that** investors can see who leads the company

### US-4: Share Profile with Investors
**As an** admin user
**I want to** share a link to my company profile with prospective investors
**So that** they can view the profile and dataroom without needing a Navia account

### US-5: Protect Shared Profile
**As an** admin user
**I want to** optionally protect the shared profile link with a password or email-gated access
**So that** only intended recipients can view sensitive company information

### US-6: Track Profile Views
**As an** admin user
**I want to** see who viewed my company profile and when
**So that** I can gauge investor interest and follow up accordingly

### US-7: Preview and Publish Profile
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

### FR-4: Dataroom Document Upload
- System MUST allow uploading documents organized by category
- Document categories:
  - `PITCH_DECK` — Pitch deck presentations
  - `FINANCIALS` — Financial statements, projections, unit economics
  - `LEGAL` — Articles of incorporation, shareholder agreements, term sheets
  - `PRODUCT` — Product documentation, demos, technical architecture
  - `TEAM` — Team bios, org charts, advisory board
  - `OTHER` — Miscellaneous documents
- Each document has:
  - `name`: display name (auto-populated from filename, editable)
  - `category`: one of the predefined categories
  - `fileKey`: S3 object key
  - `fileSize`: file size in bytes
  - `mimeType`: file MIME type
  - `pageCount`: page count for PDFs (extracted server-side, null for non-PDFs)
  - `order`: display order within category (0-indexed)
  - `uploadedAt`: timestamp
  - `uploadedById`: user who uploaded the file
- Allowed file types: PDF, PNG, JPG, JPEG, XLSX, PPTX, DOCX
- Maximum file size: 25 MB per file
- Maximum total storage per company profile: 500 MB
- System MUST generate a thumbnail preview for PDF first pages
- System MUST extract page count from uploaded PDFs
- Documents are served via pre-signed S3 URLs (15-minute expiry) — never directly public

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

### FR-8: Automatic Litigation Check (BigDataCorp)
- System MUST dispatch a background Bull job to fetch litigation data from BigDataCorp when a company profile is created (`POST /api/v1/companies/:companyId/profile`)
- The job uses the company's already-validated CNPJ (from `company-cnpj-validation.md`)
- System MUST store the litigation data as immutable fields on the CompanyProfile entity
- No user (including ADMIN) can edit, hide, or delete the litigation data
- If the BigDataCorp API fails after retries, the profile is still usable — the litigation section shows a "Verification pending" status
- Litigation data is displayed on both the internal authenticated view and the public shareable profile
- Litigation data includes: active/historical lawsuits, administrative proceedings, notary protest records, and a computed risk level

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

enum VerificationStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

interface LitigationData {
  summary: {
    activeLawsuits: number;           // Count of active judicial processes
    historicalLawsuits: number;       // Count of resolved/archived processes
    activeAdministrative: number;     // Active administrative proceedings
    protests: number;                 // Notary protest records
    totalValueInDispute: string;      // Sum of all active dispute amounts (Decimal as string)
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';  // Computed from lawsuit count + amounts
  };
  lawsuits: Array<{
    processId: string;                // Court case number (e.g., "0000123-45.2024.8.26.0100")
    court: string;                    // Court name
    caseType: 'CIVIL' | 'LABOR' | 'CRIMINAL' | 'TAX' | 'ADMINISTRATIVE';
    status: string;                   // ATIVO, ARQUIVADO, EXTINTO, etc.
    filingDate: string;               // ISO 8601 date
    lastUpdate: string;               // ISO 8601 date
    valueInDispute: string | null;    // Decimal as string, BRL
    plaintiffName: string;            // Masked if individual (PII)
    defendantRole: string;            // REU, AUTOR, etc.
    subject: string;                  // Brief description of lawsuit type
  }>;
  protestData: {
    totalProtests: number;
    protests: Array<{
      date: string;
      amount: string;
      notaryOffice: string;
      status: string;                 // ATIVO, PAGO, CANCELADO
    }>;
  };
  queryDate: string;                  // ISO 8601 — when BigDataCorp was queried
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

### ProfileDocument Entity

```typescript
interface ProfileDocument {
  id: string;                          // UUID, primary key
  profileId: string;                   // Foreign key to CompanyProfile
  name: string;                        // Display name
  category: DocumentCategory;          // PITCH_DECK | FINANCIALS | LEGAL | PRODUCT | TEAM | OTHER
  fileKey: string;                     // S3 object key
  fileSize: number;                    // File size in bytes
  mimeType: string;                    // MIME type
  pageCount: number | null;            // Page count (PDFs only)
  thumbnailKey: string | null;         // S3 key for PDF first-page thumbnail
  order: number;                       // Display order within category
  uploadedById: string;                // Foreign key to User
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

enum DocumentCategory {
  PITCH_DECK = 'PITCH_DECK',
  FINANCIALS = 'FINANCIALS',
  LEGAL = 'LEGAL',
  PRODUCT = 'PRODUCT',
  TEAM = 'TEAM',
  OTHER = 'OTHER',
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

### ProfileDocumentDownload Entity

```typescript
interface ProfileDocumentDownload {
  id: string;                          // UUID, primary key
  documentId: string;                  // Foreign key to ProfileDocument
  profileId: string;                   // Foreign key to CompanyProfile
  viewerEmail: string | null;          // Email (if available)
  viewerIp: string;                    // Redacted to /24 subnet
  downloadedAt: Date;
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

model ProfileDocument {
  id           String           @id @default(uuid())
  profileId    String           @map("profile_id")
  name         String
  category     DocumentCategory
  fileKey      String           @map("file_key")
  fileSize     Int              @map("file_size")
  mimeType     String           @map("mime_type")
  pageCount    Int?             @map("page_count")
  thumbnailKey String?          @map("thumbnail_key")
  order        Int              @default(0)
  uploadedById String           @map("uploaded_by_id")
  uploadedAt   DateTime         @map("uploaded_at")
  createdAt    DateTime         @default(now()) @map("created_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")

  profile      CompanyProfile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  uploadedBy   User             @relation(fields: [uploadedById], references: [id])
  downloads    ProfileDocumentDownload[]

  @@index([profileId, category, order])
  @@map("profile_documents")
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

model ProfileDocumentDownload {
  id           String   @id @default(uuid())
  documentId   String   @map("document_id")
  profileId    String   @map("profile_id")
  viewerEmail  String?  @map("viewer_email")
  viewerIp     String   @map("viewer_ip")
  downloadedAt DateTime @default(now()) @map("downloaded_at")

  document     ProfileDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([profileId, downloadedAt])
  @@map("profile_document_downloads")
}

enum VerificationStatus {
  PENDING
  COMPLETED
  FAILED
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

enum DocumentCategory {
  PITCH_DECK
  FINANCIALS
  LEGAL
  PRODUCT
  TEAM
  OTHER
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

**Note**: Any litigation-related fields (`litigationStatus`, `litigationData`, `litigationFetchedAt`, `litigationError`) in the request body are silently ignored. These fields are system-managed and immutable (see BR-11).

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

### Dataroom Documents

#### POST /api/v1/companies/:companyId/profile/documents
**Description**: Upload a document to the dataroom.

**Auth**: Required. User must be ADMIN or FINANCE.

**Request**: `multipart/form-data`
- `file`: the document file
- `category`: document category enum value
- `name`: optional display name (defaults to filename)

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
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
}
```

**Error Responses**:
- `400 Bad Request` — Invalid file type or missing category
- `413 Payload Too Large` — File exceeds 25 MB
- `422 Unprocessable Entity` — Total storage for profile exceeds 500 MB

---

#### DELETE /api/v1/companies/:companyId/profile/documents/:documentId
**Description**: Remove a document from the dataroom. Deletes the file from S3.

**Auth**: Required. User must be ADMIN or FINANCE.

**Response**: `204 No Content`

---

#### PUT /api/v1/companies/:companyId/profile/documents/order
**Description**: Reorder documents within their categories.

**Auth**: Required. User must be ADMIN or FINANCE.

**Request**:
```json
{
  "documents": [
    { "id": "doc_001", "order": 0 },
    { "id": "doc_002", "order": 1 }
  ]
}
```

**Response** (200 OK): Returns updated documents with new order.

---

#### GET /api/v1/companies/:companyId/profile/documents/:documentId/download
**Description**: Generate a pre-signed S3 URL for downloading a document. For authenticated company members.

**Auth**: Required. User must be a member of the company.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://s3.amazonaws.com/navia/documents/...?X-Amz-Signature=...",
    "expiresIn": 900
  }
}
```

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
- Documents only include metadata — actual file download requires a separate call
- The `formattedValue` field provides the display-ready string using Brazilian formatting
- The `litigation` section is read-only and system-populated — no additional access control beyond existing profile access controls (public/password/email-gated)

---

#### GET /api/v1/profiles/:slug/documents/:documentId/download
**Description**: Generate a pre-signed download URL for a public profile document. Records a download event.

**Auth**: None required (but respects profile access controls — password/email).

**Headers**:
- `X-Profile-Password`: password (if password-protected)

**Query Parameters**:
- `email`: viewer email (if email-gated)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://s3.amazonaws.com/navia/documents/...?X-Amz-Signature=...",
    "expiresIn": 900
  }
}
```

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

### BR-5: Document Storage Limit
- Total storage for all documents in a profile is capped at 500 MB
- Individual files are capped at 25 MB
- Exceeding either limit returns `413 Payload Too Large` or `422 Unprocessable Entity`

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

### BR-9: Document File Validation
- Files are validated by both MIME type and magic bytes (not just file extension)
- PDF page count is extracted server-side using a PDF parsing library
- Thumbnails are generated asynchronously via Bull job after upload

### BR-10: Profile Publishing Prerequisites
- Publishing requires at least one of: description, metrics, team members, or documents
- A completely empty profile cannot be published

### BR-11: Litigation Data Immutability
- Litigation verification fields (`litigationStatus`, `litigationData`, `litigationFetchedAt`, `litigationError`) are system-managed
- No API endpoint allows direct modification of these fields
- The `PUT /api/v1/companies/:companyId/profile` endpoint MUST silently ignore any litigation fields in the request body
- Only the background Bull job processor (`profile-litigation` queue) can write to these fields
- Litigation data cannot be hidden, deleted, or overridden by any user role (including ADMIN)

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

### EC-2: Document Upload During Publish
**Scenario**: User uploads a document while the profile is published.
**Handling**: Document is added immediately and visible to external viewers. No republish needed.

### EC-3: Slug Collision
**Scenario**: Two companies with similar names generate the same slug.
**Handling**: Auto-generated slugs include a 4-character random suffix. Custom slug changes return `409 Conflict` if taken.

### EC-4: Large File Upload Timeout
**Scenario**: User uploads a 25 MB file on a slow connection.
**Handling**: Frontend shows upload progress bar. Backend accepts with a 60-second timeout for the upload endpoint. If timeout occurs, partial S3 upload is cleaned up via S3 lifecycle rule.

### EC-5: PDF Thumbnail Generation Fails
**Scenario**: Uploaded PDF is corrupt or password-protected, thumbnail generation fails.
**Handling**: Document is stored successfully. Thumbnail is null. Frontend shows a generic PDF icon instead.

### EC-6: Profile Viewed After Archival
**Scenario**: Investor bookmarked the link and visits after profile is archived.
**Handling**: Returns 404. Frontend shows "This profile is no longer available."

### EC-7: Concurrent Profile Edits
**Scenario**: Two ADMINs edit the profile simultaneously.
**Handling**: Last write wins (standard optimistic concurrency). No locking in MVP. The PUT endpoints replace full sections (metrics, team) to avoid partial merge conflicts.

### EC-8: BigDataCorp API Failure During Profile Creation
**Scenario**: The BigDataCorp API is unreachable or returns errors when the litigation check Bull job runs.
**Handling**: Bull job retries 3 times with exponential backoff (30s, 60s, 120s). If all retries fail, `litigationStatus` is set to `FAILED` and `litigationError` stores a user-friendly message. The profile remains fully usable — the litigation section displays "Verification pending" or "Verification unavailable." An admin alert is sent via Slack. The job can be manually re-triggered by an admin.

### EC-9: CNPJ Not Found in BigDataCorp
**Scenario**: The company's CNPJ returns no results from BigDataCorp (e.g., very new company).
**Handling**: `litigationStatus` is set to `COMPLETED` with `litigationData.summary` showing all zero counts and `riskLevel: 'LOW'`. This is a valid result — no litigation history is a positive signal.

### EC-10: BigDataCorp Returns Stale Data
**Scenario**: Litigation data changes after the initial fetch.
**Handling**: Litigation data is fetched once at profile creation and stored as a point-in-time snapshot. The `litigationFetchedAt` timestamp is displayed to viewers so they can judge data freshness. Future enhancement: periodic re-fetch job (out of scope for MVP).

---

## Dependencies

### Internal Dependencies
- **company-management.md**: Company entity (name, logoUrl, foundedDate, status)
- **user-permissions.md**: ADMIN and FINANCE role checks for profile editing
- **authentication.md**: Public profile endpoints skip auth; admin endpoints require Privy JWT
- **audit-logging.md**: Profile create, update, publish, archive, and document upload events
- **security.md**: File upload validation (MIME + magic bytes), EXIF stripping, S3 pre-signed URLs

### External Dependencies
- **AWS S3**: Document storage (`navia-profile-documents` bucket), photo storage (`navia-profile-photos` bucket), thumbnail storage
  - SSE-S3 encryption (not KMS — profile documents are not high-sensitivity PII)
  - Pre-signed URLs with 15-minute expiry for downloads
  - Lifecycle rule: delete incomplete multipart uploads after 24 hours
- **BigDataCorp**: Litigation and legal proceedings data via CNPJ lookup
  - Endpoint: POST with CNPJ to `/empresas/owners_lawsuits` and related datasets
  - Authentication: API Key in Authorization header
  - Returns: Active/historical lawsuits, administrative proceedings, protest records
  - Rate limit: Per API key (check contract)
  - Environment variable: `BIGDATACORP_API_KEY` (rotated annually)
- **Bull (Redis-backed)**: PDF thumbnail generation queue and litigation check queue
  - Queue: `profile-thumbnails` — Retry: 2 attempts, 5-second backoff
  - Queue: `profile-litigation` — Retry: 3 attempts, exponential backoff (30s, 60s, 120s)
- **sharp**: Image processing for team member photo resizing and EXIF stripping
- **pdf-lib or pdf-parse**: PDF page count extraction and thumbnail generation

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
    @InjectQueue('profile-thumbnails') private thumbnailQueue: Queue,
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

### Document Upload Handler

```typescript
// /backend/src/profile/profile-document.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import * as pdfParse from 'pdf-parse';

@Injectable()
export class ProfileDocumentService {
  private s3: S3Client;
  private bucket = 'navia-profile-documents';

  constructor(
    private prisma: PrismaService,
    @InjectQueue('profile-thumbnails') private thumbnailQueue: Queue,
  ) {
    this.s3 = new S3Client({ region: 'sa-east-1' });
  }

  async upload(
    profileId: string,
    userId: string,
    file: Express.Multer.File,
    category: string,
    name?: string,
  ) {
    // Validate total storage
    const currentStorage = await this.prisma.profileDocument.aggregate({
      where: { profileId },
      _sum: { fileSize: true },
    });
    const totalAfterUpload = (currentStorage._sum.fileSize || 0) + file.size;
    if (totalAfterUpload > 500 * 1024 * 1024) {
      throw new BusinessRuleException(
        'PROFILE_STORAGE_LIMIT',
        'errors.profile.storageLimit',
      );
    }

    // Upload to S3
    const fileKey = `profiles/${profileId}/${randomUUID()}-${sanitizeFilename(file.originalname)}`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    // Extract PDF page count
    let pageCount: number | null = null;
    if (file.mimetype === 'application/pdf') {
      try {
        const pdfData = await pdfParse(file.buffer);
        pageCount = pdfData.numpages;
      } catch {
        pageCount = null;
      }
    }

    // Get next order value
    const maxOrder = await this.prisma.profileDocument.aggregate({
      where: { profileId, category: category as any },
      _max: { order: true },
    });

    const document = await this.prisma.profileDocument.create({
      data: {
        profileId,
        name: name || file.originalname,
        category: category as any,
        fileKey,
        fileSize: file.size,
        mimeType: file.mimetype,
        pageCount,
        order: (maxOrder._max.order ?? -1) + 1,
        uploadedById: userId,
        uploadedAt: new Date(),
      },
    });

    // Queue thumbnail generation for PDFs
    if (file.mimetype === 'application/pdf') {
      await this.thumbnailQueue.add('generate', {
        documentId: document.id,
        fileKey,
      });
    }

    return document;
  }

  async getDownloadUrl(documentId: string): Promise<string> {
    const document = await this.prisma.profileDocument.findUniqueOrThrow({
      where: { id: documentId },
    });

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: document.fileKey,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 900 }); // 15 minutes
  }
}
```

### BigDataCorpService — Litigation Data Fetching

```typescript
// /backend/src/profile/bigdatacorp.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../common/circuit-breaker.service';

interface BigDataCorpLitigationResponse {
  lawsuits: Array<{
    processId: string;
    court: string;
    caseType: string;
    status: string;
    filingDate: string;
    lastUpdate: string;
    valueInDispute: string | null;
    plaintiffName: string;
    defendantRole: string;
    subject: string;
  }>;
  administrativeProceedings: Array<{
    processId: string;
    agency: string;
    status: string;
    filingDate: string;
  }>;
  protests: Array<{
    date: string;
    amount: string;
    notaryOffice: string;
    status: string;
  }>;
}

@Injectable()
export class BigDataCorpService {
  private readonly logger = new Logger(BigDataCorpService.name);
  private readonly apiUrl = 'https://api.bigdatacorp.com.br';
  private readonly timeout = 30000; // 30 seconds

  constructor(private circuitBreaker: CircuitBreakerService) {
    this.circuitBreaker.register('bigdatacorp', {
      failureThreshold: 5,
      resetTimeout: 60000, // 60s half-open
    });
  }

  async fetchLitigationData(cnpj: string): Promise<BigDataCorpLitigationResponse> {
    return this.circuitBreaker.execute('bigdatacorp', async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(`${this.apiUrl}/empresas/owners_lawsuits`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.BIGDATACORP_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cnpj: cnpj.replace(/\D/g, '') }),
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 400 || response.status === 404) {
            // Definitive result — CNPJ not found, do not retry
            throw new BigDataCorpNotFoundError(`CNPJ ${cnpj} not found in BigDataCorp`);
          }
          throw new Error(`BigDataCorp API error: ${response.status}`);
        }

        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }
}

class BigDataCorpNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BigDataCorpNotFoundError';
  }
}
```

### LitigationCheckProcessor — Bull Job

```typescript
// /backend/src/profile/profile-litigation.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BigDataCorpService } from './bigdatacorp.service';
import { AuditService } from '../audit/audit.service';
import { redactPii } from '../common/redact-pii';
import { LitigationData } from './types';

@Processor('profile-litigation')
export class LitigationCheckProcessor {
  private readonly logger = new Logger(LitigationCheckProcessor.name);

  constructor(
    private prisma: PrismaService,
    private bigDataCorp: BigDataCorpService,
    private auditService: AuditService,
  ) {}

  @Process('fetch-litigation')
  async handleFetchLitigation(job: Job<{
    profileId: string;
    companyId: string;
    cnpj: string;
  }>) {
    const { profileId, companyId, cnpj } = job.data;

    try {
      const response = await this.bigDataCorp.fetchLitigationData(cnpj);

      // Mask individual plaintiff names (PII)
      const maskedLawsuits = response.lawsuits.map((lawsuit) => ({
        ...lawsuit,
        plaintiffName: this.maskIndividualName(lawsuit.plaintiffName),
      }));

      // Compute summary
      const activeLawsuits = maskedLawsuits.filter((l) => l.status === 'ATIVO');
      const historicalLawsuits = maskedLawsuits.filter((l) => l.status !== 'ATIVO');
      const totalValueInDispute = activeLawsuits
        .reduce((sum, l) => sum + (parseFloat(l.valueInDispute || '0') || 0), 0)
        .toFixed(2);

      const litigationData: LitigationData = {
        summary: {
          activeLawsuits: activeLawsuits.length,
          historicalLawsuits: historicalLawsuits.length,
          activeAdministrative: response.administrativeProceedings.filter(
            (a) => a.status === 'ATIVO',
          ).length,
          protests: response.protests.filter((p) => p.status === 'ATIVO').length,
          totalValueInDispute,
          riskLevel: this.computeRiskLevel(
            activeLawsuits.length,
            parseFloat(totalValueInDispute),
          ),
        },
        lawsuits: maskedLawsuits,
        protestData: {
          totalProtests: response.protests.length,
          protests: response.protests,
        },
        queryDate: new Date().toISOString(),
      };

      await this.prisma.companyProfile.update({
        where: { id: profileId },
        data: {
          litigationStatus: 'COMPLETED',
          litigationData: litigationData as any,
          litigationFetchedAt: new Date(),
          litigationError: null,
        },
      });

      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'PROFILE_LITIGATION_FETCHED',
        resourceType: 'CompanyProfile',
        resourceId: profileId,
        companyId,
        changes: {
          before: { litigationStatus: 'PENDING' },
          after: {
            litigationStatus: 'COMPLETED',
            activeLawsuits: litigationData.summary.activeLawsuits,
            riskLevel: litigationData.summary.riskLevel,
          },
        },
      });

      this.logger.log(`Litigation data fetched for profile ${profileId}`);
    } catch (error) {
      // If this is the last attempt, mark as FAILED
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await this.prisma.companyProfile.update({
          where: { id: profileId },
          data: {
            litigationStatus: 'FAILED',
            litigationError: 'Verification service temporarily unavailable',
          },
        });

        await this.auditService.log({
          actorType: 'SYSTEM',
          action: 'PROFILE_LITIGATION_FAILED',
          resourceType: 'CompanyProfile',
          resourceId: profileId,
          companyId,
          metadata: { error: error.message },
        });

        this.logger.error(`Litigation fetch failed for profile ${profileId}`, error.stack);
      }

      throw error; // Let Bull handle retry
    }
  }

  private computeRiskLevel(
    activeLawsuits: number,
    totalValue: number,
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (activeLawsuits === 0) return 'LOW';
    if (activeLawsuits <= 2 && totalValue < 100000) return 'LOW';
    if (activeLawsuits <= 5 && totalValue < 500000) return 'MEDIUM';
    return 'HIGH';
  }

  private maskIndividualName(name: string): string {
    // Company names (containing LTDA, S.A., EIRELI, MEI, etc.) are not masked
    if (/\b(LTDA|S\.?A\.?|EIRELI|MEI|CNPJ|EMPRESA|CIA|COMPANHIA)\b/i.test(name)) {
      return name;
    }
    // Individual names: mask with first initial + *** for each part
    return name
      .split(' ')
      .map((part) => (part.length > 0 ? `${part[0]}***` : part))
      .join(' ');
  }
}
```

### Profile Controller

```typescript
// /backend/src/profile/profile.controller.ts
import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  Headers, UseInterceptors, UploadedFile, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequireAuth } from '../auth/decorators/require-auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auditable } from '../audit/auditable.decorator';

@Controller('api/v1')
export class ProfileController {
  constructor(
    private profileService: ProfileService,
    private documentService: ProfileDocumentService,
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

  @Post('companies/:companyId/profile/documents')
  @RequireAuth()
  @Roles('ADMIN', 'FINANCE')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @HttpCode(HttpStatus.CREATED)
  @Auditable({ action: 'PROFILE_DOCUMENT_UPLOADED', resourceType: 'ProfileDocument', captureAfterState: true })
  async uploadDocument(
    @Param('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category: string,
    @Body('name') name?: string,
  ) {
    const profile = await this.profileService.getByCompanyId(companyId);
    return this.documentService.upload(profile.id, /* userId */, file, category, name);
  }

  @Delete('companies/:companyId/profile/documents/:documentId')
  @RequireAuth()
  @Roles('ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Auditable({ action: 'PROFILE_DOCUMENT_DELETED', resourceType: 'ProfileDocument', captureBeforeState: true })
  async deleteDocument(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentService.delete(documentId);
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

  @Get('profiles/:slug/documents/:documentId/download')
  @Public()
  async downloadPublicDocument(
    @Param('slug') slug: string,
    @Param('documentId') documentId: string,
    @Headers('x-profile-password') password?: string,
    @Query('email') email?: string,
  ) {
    await this.profileService.validatePublicAccess(slug, password, email);
    return this.documentService.getPublicDownloadUrl(documentId, slug, email);
  }
}
```

---

## Error Codes

Error codes specific to the profile and litigation features. These follow the patterns defined in `error-handling.md`.

### PROFILE — Profile Management

| Code | messageKey | HTTP | PT-BR | EN |
|------|-----------|------|-------|-----|
| `PROFILE_NOT_FOUND` | `errors.profile.notFound` | 404 | Perfil da empresa não encontrado | Company profile not found |
| `PROFILE_ALREADY_EXISTS` | `errors.profile.alreadyExists` | 409 | Empresa já possui um perfil | Company already has a profile |
| `PROFILE_COMPANY_NOT_ACTIVE` | `errors.profile.companyNotActive` | 422 | Empresa não está ativa para criação de perfil | Company is not active for profile creation |
| `PROFILE_EMPTY` | `errors.profile.empty` | 422 | Perfil não pode ser publicado sem conteúdo | Profile cannot be published without content |
| `PROFILE_EMAIL_REQUIRED` | `errors.profile.emailRequired` | 422 | Email é obrigatório para acessar este perfil | Email is required to access this profile |
| `PROFILE_STORAGE_LIMIT` | `errors.profile.storageLimit` | 422 | Limite de armazenamento de 500 MB excedido | 500 MB storage limit exceeded |
| `PROFILE_LITIGATION_UNAVAILABLE` | `errors.profile.litigationUnavailable` | 502 | Serviço de verificação judicial temporariamente indisponível | Litigation verification service temporarily unavailable |
| `PROFILE_LITIGATION_CNPJ_NOT_FOUND` | `errors.profile.litigationCnpjNotFound` | 422 | CNPJ não encontrado na base de dados judicial | CNPJ not found in litigation database |

### Audit Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `PROFILE_CREATED` | CompanyProfile | USER | Profile created via POST endpoint |
| `PROFILE_UPDATED` | CompanyProfile | USER | Profile fields updated via PUT endpoint |
| `PROFILE_PUBLISHED` | CompanyProfile | USER | Profile published |
| `PROFILE_UNPUBLISHED` | CompanyProfile | USER | Profile unpublished |
| `PROFILE_ARCHIVED` | CompanyProfile | USER | Profile archived |
| `PROFILE_DOCUMENT_UPLOADED` | ProfileDocument | USER | Document uploaded to dataroom |
| `PROFILE_DOCUMENT_DELETED` | ProfileDocument | USER | Document removed from dataroom |
| `PROFILE_LITIGATION_FETCHED` | CompanyProfile | SYSTEM | BigDataCorp litigation data successfully retrieved |
| `PROFILE_LITIGATION_FAILED` | CompanyProfile | SYSTEM | BigDataCorp litigation fetch failed after all retries |

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

### SEC-3: Document Security
- Documents are stored in a separate S3 bucket from internal company documents (`navia-profile-documents`)
- S3 bucket has BlockPublicAccess enabled
- All downloads go through pre-signed URLs generated by the backend
- File uploads validated by MIME type + magic bytes (not just extension)
- EXIF metadata stripped from image uploads

### SEC-4: View Analytics Privacy
- Viewer IP addresses are stored redacted to /24 subnet
- User agent strings are stored for analytics but not displayed in the admin UI (only used for bot filtering)
- Email addresses from email-gated profiles are stored in cleartext (they are voluntarily provided, not PII under LGPD in this context)

### SEC-5: Slug Enumeration Prevention
- Slugs include a random suffix to prevent enumeration
- Non-existent or unpublished slugs return the same `404` response (no information leakage about profile existence)

### SEC-6: Audit Logging
- Profile CRUD operations are audit-logged (see audit-logging.md)
- Document uploads and deletions are audit-logged
- Profile publish/unpublish state changes are audit-logged
- Public view analytics are NOT audit-logged (they are tracked in ProfileView, not AuditLog)
- Litigation fetch success (`PROFILE_LITIGATION_FETCHED`) and failure (`PROFILE_LITIGATION_FAILED`) are audit-logged as SYSTEM events

### SEC-7: Litigation Data PII Handling
- Individual plaintiff names (CPFs) from BigDataCorp are stored masked (`J*** S***`) — follows existing PII rules from `security.md`
- Company names (CNPJs) in lawsuit data are stored in full (public information)
- Litigation data is NOT encrypted at application level (not high-sensitivity PII, follows same pattern as `cnpjData` on Company entity — DB-at-rest encryption only)
- Lawsuit amounts and court case numbers are public information and stored in full
- The `litigationData` JSONB field never contains raw CPF numbers or personal addresses

---

## Success Criteria

### Performance
- Profile page load (public): < 1 second (including all metrics, team, and document metadata)
- Document upload (25 MB): < 30 seconds
- Pre-signed URL generation: < 200ms
- Analytics dashboard load: < 2 seconds
- Thumbnail generation: < 10 seconds after upload

### Accuracy
- PDF page count extraction: 99%+ accuracy for valid PDFs
- Brazilian number formatting: matches i18n.md rules exactly
- View tracking: 100% of views recorded (including bots — filtered in analytics display)

### Litigation Verification
- BigDataCorp litigation fetch completes within 60 seconds of profile creation (average)
- Litigation data displayed on both internal and public profile views
- `PUT /api/v1/companies/:companyId/profile` silently ignores litigation fields in request body
- Bull job retries 3 times with exponential backoff on BigDataCorp failure
- Circuit breaker opens after 5 consecutive BigDataCorp failures, half-open after 60s
- Failed litigation fetch does not block profile creation, editing, or publishing
- Individual plaintiff names are masked in stored litigation data
- `PROFILE_LITIGATION_FETCHED` and `PROFILE_LITIGATION_FAILED` audit events are recorded

### User Experience
- Profile creation to first publish: < 10 minutes
- Document upload: drag-and-drop with progress indicator
- Share modal: 1 click to copy link
- Preview mode: instant, no publish required
- Team member reordering: drag-and-drop

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-management.md](./company-management.md) | Profile reads company name, logo, founding date, entity type as defaults |
| [company-cnpj-validation.md](./company-cnpj-validation.md) | Profile uses the already-validated CNPJ for BigDataCorp litigation lookup |
| [document-generation.md](./document-generation.md) | Dataroom documents are separate from generated legal documents; different storage prefix |
| [reports-analytics.md](./reports-analytics.md) | Due diligence package (auto-generated ZIP) is distinct from dataroom (manually curated) |
| [user-permissions.md](./user-permissions.md) | Only ADMIN and FINANCE roles can edit profile; shared link provides read-only external access |
| [shareholder-registry.md](./shareholder-registry.md) | Profile can display founding team members who may also be shareholders |
| [funding-rounds.md](./funding-rounds.md) | Profile shared with prospective investors during fundraising process |
| [api-standards.md](../.claude/rules/api-standards.md) | API endpoints follow `/api/v1/companies/:companyId/profile` pattern with envelope responses |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes for profile not found, invalid share link, access denied; BigDataCorp retry/circuit breaker follows existing patterns |
| [security.md](../.claude/rules/security.md) | Access controls on shared links; S3 storage for dataroom documents; PII masking for litigation data |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Profile publish/unpublish, document upload, and litigation fetch events logged |
| [i18n.md](../.claude/rules/i18n.md) | Profile content is user-authored and not translated; UI chrome follows i18n rules |
| [design-system.md](../.claude/rules/design-system.md) | Profile page follows Navia design system for public-facing pages |
