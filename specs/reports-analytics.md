# Reports & Analytics Specification

**Topic of Concern**: AI-generated standardized reports for company health, financial analysis, investor readiness, and custom insights

**One-Sentence Description**: The system generates AI-powered reports including company health scores, financial summaries, investor-ready packages, and custom analysis reports using data from Open Finance snapshots, dataroom documents, and company profile information, with export in PDF, Excel, and CSV formats.

**Complements**:
- `api-standards.md` — response envelope, pagination, export content types
- `audit-logging.md` — audit events for report generation and export
- `error-handling.md` — error codes for report generation failures
- `security.md` — PII handling in exported reports, S3 bucket policies
- `user-permissions.md` — role-based access to reports
- `company-profile.md` — company data used as AI report input
- `company-dataroom.md` — dataroom documents used as AI report input

---

## Table of Contents

1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Report Types](#report-types)
4. [Data Model](#data-model)
5. [API Endpoints](#api-endpoints)
6. [AI Report Generation Pipeline](#ai-report-generation-pipeline)
7. [Per-Role Access Matrix](#per-role-access-matrix)
8. [Edge Cases](#edge-cases)
9. [Error Codes](#error-codes)
10. [Dependencies](#dependencies)
11. [Technical Implementation](#technical-implementation)
12. [Security Considerations](#security-considerations)
13. [Frontend Specification](#frontend-specification)
14. [i18n Keys](#i18n-keys)
15. [Success Criteria](#success-criteria)
16. [Related Specifications](#related-specifications)

---

## Overview

Navia provides AI-generated reports that help founders understand their company's health, track financial performance, prepare for investor conversations, and analyze custom topics. Reports are generated asynchronously using data from multiple sources: Open Finance snapshots (bank/financial data), dataroom documents (uploaded files), and company profile information.

All reports are generated via a Bull queue worker. The user requests a report, receives a `202 Accepted` with a job reference, and is notified (via in-app notification and email) when the report is ready. Completed reports are stored as structured JSON in the database and as rendered PDFs in S3 for download.

**Data Sources for AI Reports**:
- **Open Finance snapshots**: Bank account balances, transaction history, revenue/expense categorization (connected via Open Finance integration — see `open-finance.md`)
- **Dataroom documents**: Uploaded pitch decks, financial statements, legal documents, product materials (see `company-dataroom.md`)
- **Company profile**: Company description, sector, team members, metrics, founded year (see `company-profile.md`)
- **Company record**: Name, CNPJ, entity type, status, founded date

---

## User Stories

### US-1: Company Health Score

**As a** founder, **I want to** generate an AI health score report for my company, **so that** I can understand my financial position and identify areas that need attention.

**Acceptance Criteria**:
- AI analyzes Open Finance data (burn rate, runway, growth) and dataroom documents
- Produces a score from 0 to 100 with breakdown by category
- Report includes sections: Financial Health, Growth Indicators, Risk Factors, Recommendations
- Score methodology is transparent (weights and contributing factors shown)

### US-2: Financial Summary

**As a** founder, **I want to** generate a financial summary report, **so that** I can review revenue, expenses, and trends in a structured format with AI-generated narrative.

**Acceptance Criteria**:
- Pulls data from Open Finance snapshots for the requested period
- Monthly/quarterly breakdowns of revenue, expenses, and balance
- AI generates a narrative paragraph explaining the numbers and trends
- Includes chart-ready data for revenue trend, expense breakdown, cash flow

### US-3: Investor-Ready Report

**As a** founder, **I want to** generate a polished investor report, **so that** I can share it with potential investors during fundraising.

**Acceptance Criteria**:
- Combines company profile (overview, team, sector) with financial highlights
- Includes a dataroom document summary (what is available, key metrics extracted from documents)
- AI generates an executive summary suitable for investor audiences
- PDF output is professionally formatted with company branding

### US-4: Custom AI Report

**As a** founder, **I want to** request a custom AI analysis on a specific topic, **so that** I can get insights tailored to my current needs.

**Acceptance Criteria**:
- Founder provides a free-text prompt describing the focus area
- AI uses all available data (Open Finance, documents, profile) to generate the report
- Report structure adapts to the request (not a fixed template)
- Prompt and response are stored for reference

---

## Report Types

### Company Health Score Report (`HEALTH_SCORE`)

AI-generated company health assessment.

**Sections**:
1. **Overall Score**: 0-100 with color-coded rating (0-30: Critical, 31-50: Needs Attention, 51-70: Moderate, 71-85: Healthy, 86-100: Excellent)
2. **Financial Health** (weight: 40%):
   - Burn rate (monthly cash consumption)
   - Runway (months of cash remaining at current burn)
   - Debt-to-cash ratio
   - Revenue-to-expense ratio
3. **Growth Indicators** (weight: 30%):
   - Monthly revenue growth rate (MoM)
   - Revenue trend direction (accelerating, stable, decelerating)
   - Customer/revenue consistency
4. **Risk Factors** (weight: 20%):
   - Cash concentration risk (single account dependency)
   - Expense volatility
   - Revenue dependency patterns
5. **Recommendations** (weight: 10% — qualitative):
   - Top 3 actionable recommendations based on identified weaknesses
   - Priority ranking (high, medium, low)

**Data Requirements**:
- Minimum 3 months of Open Finance data to generate a meaningful score
- Falls back to available data with a "Limited Data" disclaimer if < 3 months

### Financial Summary Report (`FINANCIAL_SUMMARY`)

Structured financial overview with AI narrative.

**Sections**:
1. **Period Overview**: Start date, end date, total revenue, total expenses, net result
2. **Revenue Analysis**: Monthly/quarterly revenue breakdown, growth rates, top revenue categories
3. **Expense Analysis**: Monthly/quarterly expense breakdown, largest expense categories, trend analysis
4. **Cash Flow**: Opening balance, closing balance, net cash flow per period, burn rate
5. **AI Narrative**: 2-3 paragraph summary explaining key trends, anomalies, and outlook
6. **Chart Data**: Structured arrays for frontend chart rendering (revenue trend, expense breakdown pie, cash flow waterfall)

**Parameters**:
- `periodStart`: ISO 8601 date (required)
- `periodEnd`: ISO 8601 date (required)
- `granularity`: `monthly` (default) or `quarterly`

### Investor-Ready Report (`INVESTOR_READY`)

Polished report designed for sharing with potential investors.

**Sections**:
1. **Executive Summary**: AI-generated 1-page overview of the company, market position, and investment opportunity
2. **Company Overview**: Name, sector, founded year, description, team members (from profile)
3. **Team**: Key team members with roles and backgrounds (from profile team members)
4. **Market & Product**: Extracted from pitch deck/product documents in dataroom (AI summarizes)
5. **Financial Highlights**: Key metrics from Open Finance (revenue, growth, runway) — presented positively for investor audience
6. **Dataroom Summary**: List of available documents by category with brief descriptions
7. **Key Metrics**: Curated metrics from company profile (ARR, MRR, team size, etc.)

**Note**: This report intentionally presents data in a positive framing suitable for investor audiences. It highlights strengths and growth while acknowledging risks constructively.

### Custom AI Report (`CUSTOM`)

Free-form AI-generated report based on founder prompt.

**Input**: `customPrompt` — free-text string describing what the founder wants analyzed (max 2000 characters)

**Behavior**:
- AI receives the prompt along with all available company data
- Generates a report with a structure adapted to the request
- Report includes: Title (AI-generated), sections (AI-determined), and a data sources disclaimer

**Examples of custom prompts**:
- "Analyze our expense efficiency and suggest areas to cut costs"
- "Compare our Q3 and Q4 performance and explain the differences"
- "Assess our readiness for a Series A fundraise"
- "Summarize our financial position for a board meeting"

---

## Data Model

### Prisma Schema — AIReport

```prisma
model AIReport {
  id            String         @id @default(uuid())
  companyId     String         @map("company_id")
  type          AIReportType   @map("type")
  title         String
  content       Json?          // Structured report data (sections, scores, charts)
  status        AIReportStatus @default(GENERATING)
  tokensUsed    Int?           @map("tokens_used")
  s3Key         String?        @map("s3_key")       // Rendered PDF location
  parameters    Json?          // Input parameters (periodStart, periodEnd, customPrompt, etc.)
  errorCode     String?        @map("error_code")
  errorMessage  String?        @map("error_message")
  requestedById String         @map("requested_by_id")
  generatedAt   DateTime?      @map("generated_at")
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  // Relations
  company     Company @relation(fields: [companyId], references: [id])
  requestedBy User    @relation("AIReportRequester", fields: [requestedById], references: [id])

  @@index([companyId, createdAt])
  @@index([companyId, type])
  @@index([requestedById])
  @@index([status])
  @@map("ai_reports")
}

enum AIReportType {
  HEALTH_SCORE
  FINANCIAL_SUMMARY
  INVESTOR_READY
  CUSTOM

  @@map("ai_report_type")
}

enum AIReportStatus {
  GENERATING
  COMPLETED
  FAILED

  @@map("ai_report_status")
}
```

### ExportJob Model (Existing — Keep As-Is)

The existing `ExportJob` model is reused for PDF/XLSX/CSV export of completed AI reports:

```prisma
model ExportJob {
  id          String          @id @default(uuid())
  companyId   String?         @map("company_id")
  userId      String          @map("user_id")
  type        ExportJobType   @map("type")
  format      String?         // pdf, xlsx, csv
  status      ExportJobStatus @default(QUEUED)
  s3Key       String?         @map("s3_key")
  downloadUrl String?         @map("download_url")
  expiresAt   DateTime?       @map("expires_at")
  errorCode   String?         @map("error_code")
  parameters  Json?           // { reportId, format }
  createdAt   DateTime        @default(now()) @map("created_at")
  completedAt DateTime?       @map("completed_at")

  company Company? @relation(fields: [companyId], references: [id])
  user    User     @relation(fields: [userId], references: [id])

  @@index([companyId, createdAt])
  @@index([userId, createdAt])
  @@index([status])
  @@map("export_jobs")
}

enum ExportJobType {
  REPORT_EXPORT  // Changed: was CAP_TABLE_EXPORT and DUE_DILIGENCE

  @@map("export_job_type")
}

enum ExportJobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED

  @@map("export_job_status")
}
```

### TypeScript Interfaces

```typescript
// --- AI Report Content Structures ---

interface HealthScoreContent {
  overallScore: number;               // 0-100
  rating: 'CRITICAL' | 'NEEDS_ATTENTION' | 'MODERATE' | 'HEALTHY' | 'EXCELLENT';
  dataQuality: 'FULL' | 'LIMITED';   // LIMITED if < 3 months Open Finance data
  sections: {
    financialHealth: {
      score: number;                  // 0-100
      weight: number;                 // 0.40
      burnRate: string;               // Monthly burn as decimal string e.g. "45000.00"
      runwayMonths: number;           // Estimated months of cash remaining
      debtToCashRatio: string;        // Decimal string e.g. "0.15"
      revenueToExpenseRatio: string;  // Decimal string e.g. "1.25"
      narrative: string;              // AI-generated explanation
    };
    growthIndicators: {
      score: number;
      weight: number;                 // 0.30
      monthlyGrowthRate: string;      // Decimal string e.g. "0.08" (8%)
      trendDirection: 'ACCELERATING' | 'STABLE' | 'DECELERATING';
      revenueConsistency: string;     // Decimal string 0-1 (coefficient of variation inverse)
      narrative: string;
    };
    riskFactors: {
      score: number;
      weight: number;                 // 0.20
      factors: Array<{
        name: string;
        severity: 'HIGH' | 'MEDIUM' | 'LOW';
        description: string;
      }>;
      narrative: string;
    };
    recommendations: {
      items: Array<{
        title: string;
        description: string;
        priority: 'HIGH' | 'MEDIUM' | 'LOW';
        category: string;             // e.g. "Cost Optimization", "Revenue Growth"
      }>;
    };
  };
  generatedAt: string;                // ISO 8601
  periodAnalyzed: {
    from: string;                     // ISO 8601
    to: string;                       // ISO 8601
  };
}

interface FinancialSummaryContent {
  periodOverview: {
    periodStart: string;              // ISO 8601
    periodEnd: string;
    totalRevenue: string;             // Decimal string
    totalExpenses: string;
    netResult: string;
    granularity: 'monthly' | 'quarterly';
  };
  revenueAnalysis: {
    periods: Array<{
      label: string;                  // e.g. "Jan/2026", "Q1/2026"
      revenue: string;
      growthRate: string | null;      // vs previous period, null for first
    }>;
    topCategories: Array<{
      name: string;
      total: string;
      percentage: string;
    }>;
  };
  expenseAnalysis: {
    periods: Array<{
      label: string;
      expenses: string;
      growthRate: string | null;
    }>;
    topCategories: Array<{
      name: string;
      total: string;
      percentage: string;
    }>;
  };
  cashFlow: {
    openingBalance: string;
    closingBalance: string;
    periods: Array<{
      label: string;
      inflow: string;
      outflow: string;
      netFlow: string;
      endingBalance: string;
    }>;
    burnRate: string;                 // Average monthly burn
  };
  narrative: string;                  // AI-generated 2-3 paragraph summary
  chartData: {
    revenueTrend: Array<{ label: string; value: string }>;
    expenseBreakdown: Array<{ category: string; value: string; percentage: string }>;
    cashFlowWaterfall: Array<{ label: string; value: string; type: 'inflow' | 'outflow' | 'balance' }>;
  };
  generatedAt: string;
}

interface InvestorReadyContent {
  executiveSummary: string;           // AI-generated 1-page narrative
  companyOverview: {
    name: string;
    sector: string | null;
    foundedYear: number | null;
    description: string | null;
    location: string | null;
    website: string | null;
  };
  team: Array<{
    name: string;
    title: string | null;
    linkedinUrl: string | null;
  }>;
  financialHighlights: {
    revenue: string | null;           // Latest period revenue
    revenueGrowth: string | null;     // MoM or QoQ growth
    burnRate: string | null;
    runway: number | null;            // Months
    keyMetrics: Array<{
      label: string;
      value: string;
      format: string;                 // NUMBER, CURRENCY_BRL, PERCENTAGE, etc.
    }>;
  };
  dataroomSummary: {
    totalDocuments: number;
    categories: Array<{
      name: string;
      count: number;
      description: string;            // AI-generated summary of category contents
    }>;
  };
  generatedAt: string;
}

interface CustomReportContent {
  title: string;                      // AI-generated title
  prompt: string;                     // Original user prompt
  sections: Array<{
    heading: string;
    content: string;                  // Markdown-formatted text
    chartData?: Array<{ label: string; value: string }>; // Optional chart data
  }>;
  dataSources: string[];              // List of data sources used
  disclaimer: string;                 // Standard AI disclaimer
  generatedAt: string;
}

// --- API Types ---

interface AIReport {
  id: string;
  companyId: string;
  type: AIReportType;
  title: string;
  content: HealthScoreContent | FinancialSummaryContent | InvestorReadyContent | CustomReportContent | null;
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
  tokensUsed: number | null;
  s3Key: string | null;
  parameters: Record<string, unknown> | null;
  errorCode: string | null;
  errorMessage: string | null;
  requestedBy: {
    id: string;
    name: string;
  };
  generatedAt: string | null;
  createdAt: string;
}

type AIReportType = 'HEALTH_SCORE' | 'FINANCIAL_SUMMARY' | 'INVESTOR_READY' | 'CUSTOM';

interface ExportJob {
  id: string;
  companyId: string;
  format: 'pdf' | 'xlsx' | 'csv';
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  s3Key: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;          // ISO 8601, pre-signed URL expiry
  createdAt: string;
  errorCode: string | null;
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/reports/generate

Requests generation of a new AI report.

**Request Body**:

```json
{
  "type": "HEALTH_SCORE",
  "customPrompt": null,
  "parameters": {
    "periodStart": "2025-09-01",
    "periodEnd": "2026-02-26"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | enum | Yes | `HEALTH_SCORE`, `FINANCIAL_SUMMARY`, `INVESTOR_READY`, `CUSTOM` |
| `customPrompt` | string | Only for `CUSTOM` | Free-text prompt (max 2000 chars) |
| `parameters.periodStart` | ISO 8601 | For `FINANCIAL_SUMMARY` | Start of analysis period |
| `parameters.periodEnd` | ISO 8601 | For `FINANCIAL_SUMMARY` | End of analysis period |
| `parameters.granularity` | string | For `FINANCIAL_SUMMARY` | `monthly` (default) or `quarterly` |

**Response** (`202 Accepted`):

```json
{
  "success": true,
  "data": {
    "id": "report-uuid-123",
    "companyId": "company-uuid",
    "type": "HEALTH_SCORE",
    "title": "Company Health Score — Feb 2026",
    "status": "GENERATING",
    "parameters": {
      "periodStart": "2025-09-01",
      "periodEnd": "2026-02-26"
    },
    "createdAt": "2026-02-26T14:30:00.000Z"
  }
}
```

**Validation Rules**:
- `type` must be a valid `AIReportType` enum value
- `customPrompt` is required when `type === 'CUSTOM'`, ignored otherwise
- `customPrompt` max length: 2000 characters
- `parameters.periodStart` must be before `parameters.periodEnd`
- `parameters.periodEnd` must not be in the future
- Company must have at least one data source connected (Open Finance snapshots or dataroom documents)

### GET /api/v1/companies/:companyId/reports

Lists all reports for the company (paginated).

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Items per page (max: 100) |
| `type` | string | — | Filter by report type: `HEALTH_SCORE`, `FINANCIAL_SUMMARY`, `INVESTOR_READY`, `CUSTOM` |
| `status` | string | — | Filter by status: `GENERATING`, `COMPLETED`, `FAILED` |
| `sort` | string | `-createdAt` | Sort field |

**Response** (`200 OK`):

```json
{
  "success": true,
  "data": [
    {
      "id": "report-uuid-123",
      "companyId": "company-uuid",
      "type": "HEALTH_SCORE",
      "title": "Company Health Score — Feb 2026",
      "status": "COMPLETED",
      "tokensUsed": 4250,
      "requestedBy": {
        "id": "user-uuid",
        "name": "Nelson Pereira"
      },
      "generatedAt": "2026-02-26T14:31:15.000Z",
      "createdAt": "2026-02-26T14:30:00.000Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Note**: The list endpoint returns reports **without** the `content` field to keep payload sizes small. Use the detail endpoint to fetch full report content.

### GET /api/v1/companies/:companyId/reports/:id

Returns full report detail including structured content.

**Response** (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": "report-uuid-123",
    "companyId": "company-uuid",
    "type": "HEALTH_SCORE",
    "title": "Company Health Score — Feb 2026",
    "content": {
      "overallScore": 72,
      "rating": "HEALTHY",
      "dataQuality": "FULL",
      "sections": {
        "financialHealth": {
          "score": 68,
          "weight": 0.40,
          "burnRate": "45000.00",
          "runwayMonths": 14,
          "debtToCashRatio": "0.05",
          "revenueToExpenseRatio": "1.25",
          "narrative": "A empresa apresenta uma saúde financeira moderada..."
        },
        "growthIndicators": {
          "score": 78,
          "weight": 0.30,
          "monthlyGrowthRate": "0.08",
          "trendDirection": "ACCELERATING",
          "revenueConsistency": "0.85",
          "narrative": "O crescimento mensal de 8% indica uma trajetória positiva..."
        },
        "riskFactors": {
          "score": 70,
          "weight": 0.20,
          "factors": [
            {
              "name": "Concentração de receita",
              "severity": "MEDIUM",
              "description": "65% da receita vem de um único cliente"
            }
          ],
          "narrative": "Os principais riscos identificados são..."
        },
        "recommendations": {
          "items": [
            {
              "title": "Diversificar base de clientes",
              "description": "Reduzir dependência do cliente principal...",
              "priority": "HIGH",
              "category": "Revenue Growth"
            }
          ]
        }
      },
      "generatedAt": "2026-02-26T14:31:15.000Z",
      "periodAnalyzed": {
        "from": "2025-09-01",
        "to": "2026-02-26"
      }
    },
    "status": "COMPLETED",
    "tokensUsed": 4250,
    "s3Key": "reports/company-uuid/report-uuid-123.pdf",
    "parameters": {},
    "requestedBy": {
      "id": "user-uuid",
      "name": "Nelson Pereira"
    },
    "generatedAt": "2026-02-26T14:31:15.000Z",
    "createdAt": "2026-02-26T14:30:00.000Z"
  }
}
```

### GET /api/v1/companies/:companyId/reports/:id/download

Downloads the rendered report file. Redirects to a pre-signed S3 URL.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `pdf` | Export format: `pdf`, `xlsx`, `csv` |

**Response (report already rendered in requested format)** (`302 Found`):

Redirects to pre-signed S3 URL (1-hour expiry).

**Response (format not yet rendered — triggers async export)** (`202 Accepted`):

```json
{
  "success": true,
  "data": {
    "jobId": "export-uuid-456",
    "status": "QUEUED",
    "format": "xlsx",
    "estimatedCompletionSeconds": 15,
    "pollUrl": "/api/v1/companies/:companyId/reports/:id/download/export-uuid-456"
  }
}
```

**Polling endpoint**: `GET /api/v1/companies/:companyId/reports/:id/download/:jobId`

```json
{
  "success": true,
  "data": {
    "jobId": "export-uuid-456",
    "status": "COMPLETED",
    "format": "xlsx",
    "downloadUrl": "https://s3.amazonaws.com/navia-exports/...",
    "expiresAt": "2026-02-26T15:30:00.000Z"
  }
}
```

**Behavior by format**:
- **PDF**: Generated during AI report creation (always available immediately for completed reports). Redirect to S3.
- **XLSX**: Generated on demand via Bull queue. Returns `202` on first request, then `302` once ready.
- **CSV**: Generated on demand via Bull queue. Returns `202` on first request, then `302` once ready.

### DELETE /api/v1/companies/:companyId/reports/:id

Deletes a report and its associated S3 files.

**Response** (`204 No Content`): Empty body.

**Rules**:
- Only the user who requested the report or an ADMIN can delete it
- Deletes the `AIReport` record, associated S3 PDF, and any `ExportJob` records
- Reports in `GENERATING` status cannot be deleted (return `422`)
- Deletion is audit-logged

---

## AI Report Generation Pipeline

### Flow

```
POST /reports/generate
    │
    ├─ Validate request (type, parameters)
    ├─ Create AIReport record (status: GENERATING)
    ├─ Return 202 Accepted with report metadata
    └─ Push job to Bull queue ('report-generation') ── async ──┐
                                                                │
                                                                v
                                                     Bull Worker
                                                        │
                                                        ├─ 1. Gather data sources
                                                        │     ├─ Fetch Open Finance snapshots
                                                        │     ├─ Fetch dataroom document metadata
                                                        │     ├─ Fetch company profile data
                                                        │     └─ Extract text from key documents (if needed)
                                                        │
                                                        ├─ 2. Build AI prompt
                                                        │     ├─ System prompt (report type template)
                                                        │     ├─ Company context
                                                        │     └─ Financial data + document summaries
                                                        │
                                                        ├─ 3. Call AI model (Claude API)
                                                        │     ├─ Structured output (JSON)
                                                        │     └─ Track token usage
                                                        │
                                                        ├─ 4. Validate AI response structure
                                                        │
                                                        ├─ 5. Render PDF via Puppeteer
                                                        │     └─ Upload to S3
                                                        │
                                                        ├─ 6. Update AIReport record
                                                        │     ├─ status: COMPLETED
                                                        │     ├─ content: structured JSON
                                                        │     ├─ s3Key: PDF location
                                                        │     ├─ tokensUsed
                                                        │     └─ generatedAt
                                                        │
                                                        ├─ 7. Send notification (in-app + email)
                                                        │
                                                        └─ On failure (after 2 retries):
                                                              ├─ Update status: FAILED
                                                              ├─ Set errorCode + errorMessage
                                                              └─ Send failure notification
```

### Bull Queue Configuration

```typescript
const REPORT_GENERATION_QUEUE_CONFIG = {
  name: 'report-generation',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s
    },
    removeOnComplete: true,
    removeOnFail: false,
    timeout: 120000, // 2 minute timeout per attempt
  },
};
```

### AI Model Configuration

| Setting | Value |
|---------|-------|
| Model | Claude (via Anthropic API) |
| Max output tokens | 8192 |
| Temperature | 0.3 (factual, low creativity) |
| Response format | Structured JSON (using tool_use or JSON mode) |
| Language | Report generated in the company's `locale` (PT-BR or EN) |
| Rate limit | Max 10 concurrent report generations per company |

### Data Gathering Strategy

For each report type, the worker gathers different data:

| Report Type | Open Finance | Dataroom Docs | Company Profile | Document Text Extraction |
|-------------|-------------|---------------|-----------------|--------------------------|
| `HEALTH_SCORE` | Required (3+ months) | Optional (enhances score) | Yes | No |
| `FINANCIAL_SUMMARY` | Required | No | Minimal (name, sector) | No |
| `INVESTOR_READY` | Optional (enhances) | Yes (summary) | Yes (full) | Yes (pitch deck) |
| `CUSTOM` | If available | If available | Yes | Depends on prompt |

**Document text extraction**: For reports that benefit from document content (e.g., `INVESTOR_READY` extracting from pitch decks), the worker downloads the PDF from S3 and extracts text. Only the first 10 pages of each document are processed. Maximum 5 documents are processed per report to control costs and latency.

---

## Per-Role Access Matrix

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| Generate report (`POST .../reports/generate`) | Yes | Yes | No | No | No |
| List reports (`GET .../reports`) | Yes | Yes | Read-only | No | No |
| View report detail (`GET .../reports/:id`) | Yes | Yes | Read-only | No | No |
| Download report (`GET .../reports/:id/download`) | Yes | Yes | PDF only | No | No |
| Delete report (`DELETE .../reports/:id`) | Yes | Own only | No | No | No |

**Notes**:
- "Read-only" means can view but cannot generate new reports or delete.
- "Own only" means FINANCE users can only delete reports they personally requested.
- "PDF only" means LEGAL can download PDF but not XLSX/CSV exports.
- ADMIN can perform all actions including deleting any report.
- Accessing a report endpoint without the required role returns `404 Not Found` (not `403`, to prevent enumeration per `api-standards.md`).

---

## Edge Cases

### EC-1: No Open Finance Data Connected

When a company has no Open Finance snapshots:
- `HEALTH_SCORE`: Returns `422` with `REPORT_INSUFFICIENT_DATA` — requires at least Open Finance connection
- `FINANCIAL_SUMMARY`: Returns `422` with `REPORT_INSUFFICIENT_DATA`
- `INVESTOR_READY`: Generates with financial section marked as "Financial data not yet connected" — still produces other sections
- `CUSTOM`: Generates with available data, notes missing financial data in disclaimer

### EC-2: Concurrent Report Generation

If a user requests a report while the same type is already generating for the same company:
- Allow it — each report is a separate record. No deduplication of AI reports (unlike file exports).
- Rate limit: Maximum 3 concurrent `GENERATING` reports per company. If exceeded, return `429` with `REPORT_GENERATION_LIMIT`.

### EC-3: AI Generation Timeout

If the AI model call exceeds 120 seconds:
- Bull retries up to 3 times
- After all retries fail: status set to `FAILED`, errorCode: `REPORT_AI_TIMEOUT`
- User receives failure notification with suggestion to retry

### EC-4: Empty Dataroom

When company has no documents in the dataroom:
- `INVESTOR_READY`: Generates with dataroom section showing "No documents uploaded yet" + recommendation to upload pitch deck and financials
- Other types: Not affected (dataroom is supplementary)

### EC-5: Report Deletion While Export In Progress

If a report is deleted while an export job is processing:
- The export job completes but the S3 file is orphaned
- Hourly S3 cleanup job handles orphaned files (checks if parent AIReport still exists)

---

## Error Codes

| Error Code | HTTP Status | messageKey | When |
|------------|-------------|------------|------|
| `REPORT_GENERATION_FAILED` | 500 | `errors.report.generationFailed` | Unexpected error during AI report generation |
| `REPORT_AI_TIMEOUT` | 500 | `errors.report.aiTimeout` | AI model call timed out after retries |
| `REPORT_INSUFFICIENT_DATA` | 422 | `errors.report.insufficientData` | Company lacks required data sources for the report type |
| `REPORT_NOT_FOUND` | 404 | `errors.report.notFound` | Report ID does not exist or user lacks access |
| `REPORT_EXPORT_FAILED` | 500 | `errors.report.exportFailed` | Export file generation failed |
| `REPORT_EXPORT_NOT_FOUND` | 404 | `errors.report.exportNotFound` | Export job ID does not exist |
| `REPORT_EXPORT_EXPIRED` | 410 | `errors.report.exportExpired` | Pre-signed URL has expired |
| `REPORT_FORMAT_UNSUPPORTED` | 400 | `errors.report.formatUnsupported` | Invalid export format requested |
| `REPORT_GENERATION_LIMIT` | 429 | `errors.report.generationLimit` | Too many concurrent report generations |
| `REPORT_CUSTOM_PROMPT_REQUIRED` | 400 | `errors.report.customPromptRequired` | `CUSTOM` type requires `customPrompt` |
| `REPORT_CUSTOM_PROMPT_TOO_LONG` | 400 | `errors.report.customPromptTooLong` | `customPrompt` exceeds 2000 characters |
| `REPORT_CANNOT_DELETE_GENERATING` | 422 | `errors.report.cannotDeleteGenerating` | Cannot delete a report that is still generating |
| `REPORT_INVALID_PERIOD` | 400 | `errors.report.invalidPeriod` | periodStart must be before periodEnd, periodEnd must not be in the future |

---

## Dependencies

| Dependency | Purpose | Notes |
|------------|---------|-------|
| Anthropic Claude API | AI report generation | Via `@anthropic-ai/sdk` |
| Puppeteer / Chromium | PDF report rendering | Headless browser for HTML-to-PDF |
| ExcelJS | XLSX spreadsheet generation | Multi-tab workbooks for financial data |
| Bull queue (`report-generation`) | Async AI report generation | Separate queue from `report-export` |
| Bull queue (`report-export`) | Async file export (XLSX, CSV) | Existing queue, shared with other exports |
| AWS S3 (`navia-exports` bucket) | Storage for rendered PDFs and exports | Pre-signed URLs with 1-hour expiry |
| AWS SES | Email notification on report completion/failure | Per user locale |
| Recharts (frontend) | Chart rendering for financial data visualization | Frontend-only dependency |
| Open Finance data | Financial snapshots for AI analysis | Via internal database queries |
| Dataroom documents | Document metadata and text extraction | Via S3 + pdf-parse for text extraction |
| Company profile data | Company context for AI prompts | Via Prisma queries |

---

## Technical Implementation

### ReportService

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('report-generation') private generationQueue: Queue,
    @InjectQueue('report-export') private exportQueue: Queue,
  ) {}

  async generateReport(
    companyId: string,
    userId: string,
    input: {
      type: AIReportType;
      customPrompt?: string;
      parameters?: Record<string, unknown>;
    },
  ): Promise<AIReport> {
    // 1. Validate data source availability
    // 2. Check concurrent generation limit (max 3 per company)
    // 3. Create AIReport record with status GENERATING
    // 4. Push job to Bull queue
    // 5. Return report metadata
  }

  async listReports(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      type?: AIReportType;
      status?: AIReportStatus;
      sort?: string;
    },
  ): Promise<{ items: AIReport[]; total: number }> {
    // 1. Query AIReport with filters
    // 2. Exclude content field from list results (performance)
    // 3. Include requestedBy user name
    // 4. Return paginated results
  }

  async getReport(companyId: string, reportId: string): Promise<AIReport> {
    // 1. Fetch report with full content
    // 2. Include requestedBy user name
    // 3. Return full report (including content JSON)
  }

  async downloadReport(
    companyId: string,
    reportId: string,
    format: string,
  ): Promise<{ redirectUrl: string } | ExportJob> {
    // 1. Validate report exists and is COMPLETED
    // 2. If format is PDF and s3Key exists: generate pre-signed URL, return redirect
    // 3. If format is XLSX/CSV: check for existing export job
    //    a. If recent completed export exists: return pre-signed URL
    //    b. Otherwise: create ExportJob, push to queue, return 202
  }

  async deleteReport(
    companyId: string,
    reportId: string,
    userId: string,
  ): Promise<void> {
    // 1. Validate report exists
    // 2. Validate status !== GENERATING
    // 3. Validate user is ADMIN or report requester
    // 4. Delete S3 files (PDF + any exports)
    // 5. Delete ExportJob records
    // 6. Delete AIReport record
  }
}
```

### ReportGenerationProcessor (Bull Worker)

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('report-generation')
export class ReportGenerationProcessor {
  @Process('generate')
  async handleGenerate(job: Job<{
    reportId: string;
    companyId: string;
    type: AIReportType;
    parameters: Record<string, unknown>;
  }>) {
    const { reportId, companyId, type, parameters } = job.data;

    // 1. Gather data sources based on report type
    const data = await this.gatherData(companyId, type, parameters);

    // 2. Build AI prompt
    const prompt = this.buildPrompt(type, data, parameters);

    // 3. Call Claude API
    const aiResponse = await this.callAI(prompt);

    // 4. Validate and parse structured response
    const content = this.parseResponse(type, aiResponse);

    // 5. Generate PDF
    const pdfBuffer = await this.renderPdf(type, content, data.companyInfo);
    const s3Key = await this.uploadToS3(pdfBuffer, companyId, reportId);

    // 6. Update AIReport record
    await this.prisma.aIReport.update({
      where: { id: reportId },
      data: {
        content,
        status: 'COMPLETED',
        tokensUsed: aiResponse.usage.total_tokens,
        s3Key,
        generatedAt: new Date(),
      },
    });

    // 7. Send notifications
    await this.notifyUser(reportId);
  }

  private async gatherData(
    companyId: string,
    type: AIReportType,
    parameters: Record<string, unknown>,
  ) {
    // Fetch company profile
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      include: {
        profile: {
          include: { metrics: true, team: true, documents: true },
        },
      },
    });

    // Fetch Open Finance snapshots (if available)
    // const financialData = await this.openFinanceService.getSnapshots(companyId, ...);

    // Fetch dataroom document metadata
    // const documents = await this.dataroomService.listDocuments(companyId);

    return { companyInfo: company /*, financialData, documents */ };
  }
}
```

### ReportExportProcessor (Bull Worker)

```typescript
@Processor('report-export')
export class ReportExportProcessor {
  @Process('report-export')
  async handleExport(job: Job<{
    exportJobId: string;
    reportId: string;
    format: string;
  }>) {
    const { exportJobId, reportId, format } = job.data;

    // 1. Fetch report content
    const report = await this.prisma.aIReport.findUniqueOrThrow({
      where: { id: reportId },
    });

    // 2. Generate file based on format
    let buffer: Buffer;
    if (format === 'xlsx') {
      buffer = await this.generateXlsx(report);
    } else if (format === 'csv') {
      buffer = await this.generateCsv(report);
    }

    // 3. Upload to S3
    const s3Key = `exports/${report.companyId}/${exportJobId}.${format}`;
    await this.s3.upload(buffer, s3Key);

    // 4. Generate pre-signed URL
    const downloadUrl = await this.s3.getPresignedUrl(s3Key, 3600);
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    // 5. Update ExportJob
    await this.prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'COMPLETED',
        s3Key,
        downloadUrl,
        expiresAt,
        completedAt: new Date(),
      },
    });

    // 6. Send email notification
    await this.notifyUser(exportJobId);
  }
}
```

### PDF Generation

Using Puppeteer for HTML-to-PDF rendering:

```typescript
async renderPdf(
  type: AIReportType,
  content: unknown,
  companyInfo: { name: string; logoUrl?: string },
): Promise<Buffer> {
  const html = this.renderTemplate(`report-${type.toLowerCase()}`, {
    companyName: companyInfo.name,
    companyLogo: companyInfo.logoUrl,
    generatedAt: formatDate(new Date(), 'pt-BR'),
    content,
  });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({
    format: 'A4',
    margin: { top: '2cm', bottom: '2cm', left: '1.5cm', right: '1.5cm' },
    printBackground: true,
  });
  await browser.close();
  return Buffer.from(pdf);
}
```

PDF template includes:
- Company logo (if uploaded) and name in header
- Report title and type badge
- Generation date and time
- Page numbers in footer
- Sections with headings, narrative text, and data tables
- Chart placeholders rendered as static images (using chart-to-image service)
- All numbers in Brazilian format

### Excel Generation

Using ExcelJS:

```typescript
async generateXlsx(report: AIReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  if (report.type === 'HEALTH_SCORE') {
    // Tab 1: Summary — overall score, rating, period
    // Tab 2: Financial Health — metrics breakdown
    // Tab 3: Growth Indicators — growth data
    // Tab 4: Risk Factors — risk table
    // Tab 5: Recommendations — action items
  } else if (report.type === 'FINANCIAL_SUMMARY') {
    // Tab 1: Period Overview — totals
    // Tab 2: Revenue — monthly/quarterly breakdown
    // Tab 3: Expenses — monthly/quarterly breakdown
    // Tab 4: Cash Flow — period-by-period flow
  } else if (report.type === 'INVESTOR_READY') {
    // Tab 1: Executive Summary — narrative text
    // Tab 2: Company Overview — profile data
    // Tab 3: Financial Highlights — key metrics
    // Tab 4: Dataroom — document inventory
  } else if (report.type === 'CUSTOM') {
    // Tab 1: Report — all sections
    // Tab 2: Data Sources — sources used
  }

  return workbook.xlsx.writeBuffer();
}
```

### CSV Generation

- UTF-8 encoding with BOM (`\uFEFF` prefix) for Brazilian character support
- Delimiter: semicolon (`;`) — Brazilian Excel uses semicolons by default
- Line ending: CRLF
- RFC 4180 compliant
- Flat structure: one row per data point with section/category columns

### Export Deduplication Logic

```typescript
async findExistingExport(reportId: string, format: string): Promise<ExportJob | null> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.prisma.exportJob.findFirst({
    where: {
      parameters: { path: ['reportId'], equals: reportId },
      format,
      status: { in: ['QUEUED', 'PROCESSING'] },
      createdAt: { gte: fiveMinutesAgo },
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

### S3 Cleanup Job

```typescript
@Cron('0 * * * *') // Every hour
async cleanupExpiredExports() {
  const expiredJobs = await this.prisma.exportJob.findMany({
    where: {
      status: 'COMPLETED',
      expiresAt: { lt: new Date() },
      s3Key: { not: null },
    },
  });

  for (const job of expiredJobs) {
    await this.s3.deleteObject({ Bucket: 'navia-exports', Key: job.s3Key });
    await this.prisma.exportJob.update({
      where: { id: job.id },
      data: { s3Key: null, downloadUrl: null },
    });
  }
}
```

### Email Notification for Report Completion

- Template: `report-completed` (PT-BR and EN per user locale)
- Subject: "[Navia] Seu relatório está pronto — {reportTitle}" / "[Navia] Your report is ready — {reportTitle}"
- Content: Report type, title, company name, "View Report" link (to frontend report detail page)
- Sent when report status transitions to `COMPLETED`
- For failed reports: separate template `report-failed` with error description and retry suggestion

### Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| FR-1 | AI report generation completes within timeout | < 2 minutes |
| FR-2 | PDF rendering after AI response | < 15 seconds |
| FR-3 | XLSX/CSV export generation | < 30 seconds |
| FR-4 | Export files are stored temporarily in S3 | 1-hour pre-signed URL expiry, auto-deleted after 24 hours |
| FR-5 | AI-generated PDF stored permanently in S3 | Deleted only when report is deleted |
| FR-6 | All numeric values in reports use Brazilian number format | `1.234,56` via `Intl.NumberFormat('pt-BR')` on frontend |
| FR-7 | Reports generated in company locale | PT-BR or EN based on `Company.locale` |

---

## Security Considerations

- **AI prompt injection**: User-provided `customPrompt` is sanitized and length-limited (2000 chars). The system prompt instructs the AI to only analyze company data and ignore any instructions embedded in the prompt.
- **Data isolation**: AI prompts only include data from the requesting company. Cross-company data leakage is prevented by always filtering by `companyId`.
- **PII in reports**: Reports may contain company financial data but no personal PII. Company names, team member names (from public profile) are included. No CPF, email, or personal financial data.
- **Pre-signed URLs**: All download links use S3 pre-signed URLs with 1-hour expiry. Report PDFs use separate pre-signed URLs generated on demand.
- **Audit logging**: Report generation and download actions are audit-logged:
  - `REPORT_GENERATED` — when AI report creation is requested
  - `REPORT_COMPLETED` — when report generation succeeds
  - `REPORT_EXPORTED` — when report is downloaded/exported
  - `REPORT_DELETED` — when report is deleted
- **Rate limiting**: Generation endpoint uses the `write` rate limit tier (30 requests per minute). Download uses `read` tier (100 requests per minute).
- **Company scoping**: All report endpoints enforce that the authenticated user is an ACTIVE member of the company with appropriate role. Non-members receive `404`.
- **S3 bucket policy**: The `navia-exports` bucket has `BlockPublicAccess` enabled. Objects are encrypted with SSE-S3.
- **Token usage tracking**: `tokensUsed` is stored per report for cost monitoring and billing.

---

## Frontend Specification

### Navigation Structure

Reports is a **top-level sidebar navigation item**:

| Sidebar Label | URL | Component |
|---------------|-----|-----------|
| **Reports** | `/dashboard/reports` | `ReportsPage` |

### Sidebar Icon

- Reports icon: `BarChart3` (Lucide)

---

### Page: Reports Hub

**URL**: `/dashboard/reports`

The reports page has two sections: a generation card for creating new reports and a list of existing reports.

```
┌─────────────────────────────────────────────────────────┐
│  h1: Reports                              [+ New Report] │
│  body-sm: AI-generated reports and analytics             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌── Report Type Cards (4) ─────────────────────────────┐│
│  │                                                       ││
│  │ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐    ││
│  │ │ 🏥 Health   │ │ 📊 Financial│ │ 🤝 Investor  │    ││
│  │ │ Score       │ │ Summary     │ │ Ready        │    ││
│  │ │             │ │             │ │              │    ││
│  │ │ AI health   │ │ Revenue,    │ │ Polished     │    ││
│  │ │ assessment  │ │ expenses &  │ │ report for   │    ││
│  │ │ 0-100 score │ │ trends      │ │ investors    │    ││
│  │ │             │ │             │ │              │    ││
│  │ │ [Generate]  │ │ [Generate]  │ │ [Generate]   │    ││
│  │ └─────────────┘ └─────────────┘ └──────────────┘    ││
│  │                                                       ││
│  │ ┌─────────────────────────────────────────────────┐  ││
│  │ │ 🤖 Custom AI Report                             │  ││
│  │ │ Ask AI to analyze any aspect of your company    │  ││
│  │ │ [Text area: Describe what you want analyzed...] │  ││
│  │ │ [Generate Custom Report]                         │  ││
│  │ └─────────────────────────────────────────────────┘  ││
│  └───────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Report History ─────────────────────────────────────┐│
│  │ Filters: [Type ▾ All]  [Status ▾ All]                ││
│  │                                                       ││
│  │ Title              │ Type     │ Status   │ Date    │ ⋯││
│  │ Health Score — Feb  │ Health   │ ✓ Done   │ 26/02  │ ⋯││
│  │ Q4 Financials       │ Financial│ ✓ Done   │ 25/02  │ ⋯││
│  │ Investor Pkg        │ Investor │ ⏳ Gen.  │ 26/02  │ ⋯││
│  │ Cost Analysis       │ Custom   │ ✓ Done   │ 24/02  │ ⋯││
│  │                                                       ││
│  │ Showing 1-10 of 15             < 1 2 >               ││
│  └───────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

#### Report Type Cards

Four cards in a grid layout (3 columns on desktop, 1 on mobile):

| Card | Icon | Title | Description | Action |
|------|------|-------|-------------|--------|
| Health Score | `HeartPulse` | Health Score | AI health assessment with 0-100 score | "Generate" button |
| Financial Summary | `BarChart3` | Financial Summary | Revenue, expenses & trends | "Generate" button (opens period picker) |
| Investor Ready | `Handshake` | Investor Ready | Polished report for investors | "Generate" button |
| Custom | `Sparkles` | Custom AI Report | Full-width card with text area | "Generate Custom Report" button |

**Financial Summary card**: Clicking "Generate" opens a modal/popover with date range picker (period start, period end, granularity dropdown).

**Custom Report card**: Full-width card at the bottom with a text area (placeholder: "Describe what you want analyzed...") and a character counter (max 2000). The generate button is disabled until text is entered.

#### Report History Table

| Column | Field | Alignment | Format | Sortable |
|--------|-------|-----------|--------|----------|
| Title | `title` | left | Text (link to detail) | Yes (alpha) |
| Type | `type` | left | Badge (color-coded) | Yes |
| Status | `status` | left | Badge with icon | Yes |
| Requested By | `requestedBy.name` | left | Text | Yes |
| Date | `createdAt` | right | dd/MM/yyyy HH:mm | Yes |
| Actions | — | right | Icon buttons | No |

**Type Badges**:

| Type | Badge Color | Label |
|------|-------------|-------|
| HEALTH_SCORE | blue-100, blue-600 text | "Health Score" |
| FINANCIAL_SUMMARY | green-100, green-700 text | "Financial" |
| INVESTOR_READY | cream-100, cream-700 text | "Investor" |
| CUSTOM | gray-100, gray-600 text | "Custom" |

**Status Badges**:

| Status | Badge Color | Icon | Label |
|--------|-------------|------|-------|
| GENERATING | blue-100, blue-600 text | `Loader2` (spinning) | "Generating" |
| COMPLETED | green-100, green-700 text | `CheckCircle` | "Completed" |
| FAILED | red-50, destructive text | `XCircle` | "Failed" |

**Action Buttons** (icon buttons, ghost variant):

| Action | Icon | Condition | Behavior |
|--------|------|-----------|----------|
| View | `Eye` | status === COMPLETED | Navigate to report detail |
| Download PDF | `Download` | status === COMPLETED | Trigger PDF download |
| Delete | `Trash2` | ADMIN or own report | Confirmation dialog, then DELETE |
| Retry | `RotateCcw` | status === FAILED | Re-trigger generation with same parameters |

**Filters**:

| Filter | Type | Default | Options |
|--------|------|---------|---------|
| Type | Dropdown | "All Types" | All, Health Score, Financial, Investor, Custom |
| Status | Dropdown | "All Statuses" | All, Generating, Completed, Failed |

- Default sort: `-createdAt` (newest first)
- Pagination: standard (20 per page)

#### Loading State
- 4 skeleton type cards + skeleton table (6 rows)

#### Empty State (No Reports)
- Report type cards still shown (primary UI)
- Report history section: "No reports generated yet. Choose a report type above to get started."

---

### Page: Report Detail

**URL**: `/dashboard/reports/:reportId`

Displays the full AI-generated report content.

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Reports                                       │
│  h1: Company Health Score — Feb 2026                     │
│  body-sm: Generated on 26/02/2026 14:31 by Nelson P.    │
│  [Download PDF ▾]  [Delete]                              │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  (Content varies by report type — see below)             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

#### Header

- Back link: "← Back to Reports" (navigates to `/dashboard/reports`)
- Title: `report.title`
- Subtitle: "Generated on {date} by {requestedBy.name}"
- Download button: Dropdown with PDF, Excel, CSV options
- Delete button: Ghost destructive variant, with confirmation dialog

#### Health Score Report Content

```
┌─────────────────────────────────────────────────────────┐
│  ┌── Score Card (large, centered) ─────────────────────┐│
│  │            72 / 100                                  ││
│  │            HEALTHY                                   ││
│  │   [═══════════════════░░░░░░░░] (progress bar)       ││
│  │   Period: 01/09/2025 — 26/02/2026                   ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Section Cards (2x2 grid) ─────────────────────────┐│
│  │ ┌── Financial Health ──┐ ┌── Growth Indicators ──┐  ││
│  │ │ Score: 68/100        │ │ Score: 78/100         │  ││
│  │ │ Burn: R$ 45.000/mo   │ │ Growth: 8% MoM       │  ││
│  │ │ Runway: 14 months    │ │ Trend: Accelerating   │  ││
│  │ │ Rev/Exp: 1,25x       │ │ Consistency: 85%      │  ││
│  │ │                      │ │                       │  ││
│  │ │ [AI narrative...]    │ │ [AI narrative...]     │  ││
│  │ └──────────────────────┘ └───────────────────────┘  ││
│  │ ┌── Risk Factors ──────┐ ┌── Recommendations ───┐  ││
│  │ │ Score: 70/100        │ │ 1. Diversify clients │  ││
│  │ │                      │ │    Priority: HIGH    │  ││
│  │ │ ⚠ Revenue conc.     │ │ 2. Build reserves    │  ││
│  │ │   (MEDIUM)           │ │    Priority: MEDIUM  │  ││
│  │ │                      │ │ 3. Review contracts  │  ││
│  │ │ [AI narrative...]    │ │    Priority: LOW     │  ││
│  │ └──────────────────────┘ └───────────────────────┘  ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Score color mapping**:
| Range | Color | Rating Label |
|-------|-------|-------------|
| 0-30 | destructive (#DC2626) | Critical |
| 31-50 | cream-700 (#C4A44E) | Needs Attention |
| 51-70 | blue-600 (#1B6B93) | Moderate |
| 71-85 | green-700 (#6BAF5E) | Healthy |
| 86-100 | green-600 (#9DCE94) | Excellent |

#### Financial Summary Report Content

```
┌─────────────────────────────────────────────────────────┐
│  ┌── Period Overview Cards (4) ────────────────────────┐│
│  │ Revenue      │ Expenses    │ Net Result │ Burn Rate ││
│  │ R$ 320.000   │ R$ 245.000  │ R$ 75.000  │ R$ 45K/mo││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Revenue Trend Chart (Recharts) ───────────────────┐│
│  │ [Line chart: monthly revenue over the period]       ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Expense Breakdown (Recharts) ─────────────────────┐│
│  │ [Donut chart: expense categories]                   ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Cash Flow Table ──────────────────────────────────┐│
│  │ Period │ Inflow    │ Outflow   │ Net      │ Balance ││
│  │ Oct    │ R$ 50.000 │ R$ 42.000 │ R$ 8.000 │ R$ 180K││
│  │ Nov    │ R$ 55.000 │ R$ 43.000 │ R$ 12.000│ R$ 192K││
│  │ ...    │           │           │          │        ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── AI Narrative (Card) ──────────────────────────────┐│
│  │ [2-3 paragraphs of AI-generated analysis...]        ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Revenue Trend Chart (Recharts)**:

| Setting | Value |
|---------|-------|
| Chart type | `LineChart` with `Line` component |
| X-axis | Period labels (e.g., "Oct/2025", "Nov/2025") |
| Y-axis | Revenue in BRL (formatted: `R$ {value}`) |
| Colors | chart-1 (`#1B6B93`) |
| Tooltip | Period + formatted revenue value |
| Grid | Dashed horizontal lines, `gray-200` |
| Responsive | Container width 100%, height 300px |

**Expense Breakdown Chart (Recharts)**:

| Setting | Value |
|---------|-------|
| Chart type | `PieChart` with donut (`innerRadius={60}`) |
| Data | One slice per expense category |
| Colors | Chart palette from design system |
| Center label | "Total" + formatted total expenses |
| Legend | Bottom, horizontal |
| Tooltip | Category + amount + percentage |

#### Investor-Ready Report Content

```
┌─────────────────────────────────────────────────────────┐
│  ┌── Executive Summary (Card, full-width) ─────────────┐│
│  │ [AI-generated executive summary text...]            ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Company Overview ──┐ ┌── Team ─────────────────┐  │
│  │ Name: Acme Ltda.     │ │ ┌─ Avatar + Name ─────┐ │  │
│  │ Sector: SaaS         │ │ │ Nelson P. — CEO      │ │  │
│  │ Founded: 2023        │ │ │ Maria S. — CTO       │ │  │
│  │ Location: São Paulo  │ │ │ João L. — CFO        │ │  │
│  │ Website: acme.com    │ │ └──────────────────────┘ │  │
│  └──────────────────────┘ └──────────────────────────┘  │
│                                                          │
│  ┌── Financial Highlights (Card) ──────────────────────┐│
│  │ Revenue: R$ 55.000/mo │ Growth: 8% MoM            ││
│  │ Burn: R$ 45.000/mo    │ Runway: 14 months         ││
│  │ Key Metrics:                                        ││
│  │   ARR: R$ 660.000  │  MRR: R$ 55.000              ││
│  │   Team Size: 12     │  Customers: 45               ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Dataroom Summary (Card) ──────────────────────────┐│
│  │ 8 documents available                               ││
│  │ Pitch Deck (2) — [AI summary of pitch deck]        ││
│  │ Financials (3)  — [AI summary of financials]       ││
│  │ Legal (1)       — [AI summary of legal docs]       ││
│  │ Product (2)     — [AI summary of product docs]     ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

#### Custom Report Content

```
┌─────────────────────────────────────────────────────────┐
│  ┌── Original Prompt (Card, muted bg) ─────────────────┐│
│  │ "Analyze our expense efficiency and suggest areas   ││
│  │  to cut costs"                                      ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Section 1: [AI heading] ──────────────────────────┐│
│  │ [Markdown-rendered AI content...]                   ││
│  │ [Optional: embedded chart from chartData]           ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Section 2: [AI heading] ──────────────────────────┐│
│  │ [Markdown-rendered AI content...]                   ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Data Sources (Card, caption text) ────────────────┐│
│  │ This report was generated using:                    ││
│  │ • Open Finance snapshots (Oct 2025 — Feb 2026)     ││
│  │ • 5 dataroom documents                              ││
│  │ • Company profile data                              ││
│  │                                                      ││
│  │ ℹ AI-generated reports are based on available data  ││
│  │   and should be reviewed for accuracy.              ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

#### Download Dropdown

- Appears on report detail page header
- Options: PDF (always available for completed reports), Excel (.xlsx), CSV
- PDF: immediate download via pre-signed URL
- Excel/CSV: if not yet generated, triggers async export. Shows toast "Export is being generated. You'll receive an email when ready." Poll for completion.

#### Loading State (Report Detail)
- Skeleton: header area + 4 section card skeletons

#### Error State (Report Failed)
- Show error card with errorCode and errorMessage
- "Retry" button to re-generate with same parameters
- "Back to Reports" link

---

### Common Components (Shared Across Report Pages)

#### DateRangePicker

Reusable date range picker component used by Financial Summary generation:

- Two date inputs: From and To
- Brazilian format: dd/MM/yyyy
- Calendar popover (using shadcn/ui `Calendar` + `Popover`)
- Preset ranges: "Last 3 months", "Last 6 months", "Last 12 months", "YTD"
- Validation: From must be before To, To must not be in the future

#### AsyncJobStatusBadge

Reusable badge component for report/export status:

| Status | Badge Color | Icon |
|--------|-------------|------|
| GENERATING | blue-100, blue-600 text | `Loader2` (spinning) |
| COMPLETED | green-100, green-700 text | `CheckCircle` |
| FAILED | red-50, destructive text | `XCircle` |

#### AsyncJobPoller

Hook that polls for report generation completion:

```typescript
function useReportPoller(companyId: string, reportId: string | null) {
  return useQuery({
    queryKey: ['report', companyId, reportId],
    queryFn: () => api.get(`/api/v1/companies/${companyId}/reports/${reportId}`),
    enabled: !!reportId,
    refetchInterval: (data) => {
      if (!data || data.status === 'GENERATING') return 5000;
      return false; // Stop polling when completed or failed
    },
  });
}
```

---

## i18n Keys

Add to both `messages/pt-BR.json` and `messages/en.json`:

```
reports.nav.title = "Relatórios" / "Reports"
reports.title = "Relatórios" / "Reports"
reports.description = "Relatórios e análises gerados por IA" / "AI-generated reports and analytics"

reports.types.healthScore.title = "Health Score" / "Health Score"
reports.types.healthScore.description = "Avaliação de saúde da empresa com pontuação de 0 a 100" / "AI health assessment with 0-100 score"
reports.types.financialSummary.title = "Resumo Financeiro" / "Financial Summary"
reports.types.financialSummary.description = "Receitas, despesas e tendências" / "Revenue, expenses & trends"
reports.types.investorReady.title = "Investor Ready" / "Investor Ready"
reports.types.investorReady.description = "Relatório polido para investidores" / "Polished report for investors"
reports.types.custom.title = "Relatório Personalizado" / "Custom AI Report"
reports.types.custom.description = "Peça à IA para analisar qualquer aspecto da sua empresa" / "Ask AI to analyze any aspect of your company"
reports.types.custom.placeholder = "Descreva o que você quer analisar..." / "Describe what you want analyzed..."
reports.types.custom.charCount = "{count}/2000 caracteres" / "{count}/2000 characters"

reports.generate = "Gerar" / "Generate"
reports.generateCustom = "Gerar Relatório Personalizado" / "Generate Custom Report"
reports.generating = "Gerando relatório..." / "Generating report..."
reports.generatingToast = "Seu relatório está sendo gerado. Você será notificado quando estiver pronto." / "Your report is being generated. You'll be notified when it's ready."
reports.completedToast = "Relatório pronto!" / "Report ready!"
reports.failedToast = "Falha na geração do relatório. Tente novamente." / "Report generation failed. Please try again."

reports.history.title = "Histórico de Relatórios" / "Report History"
reports.history.table.title = "Título" / "Title"
reports.history.table.type = "Tipo" / "Type"
reports.history.table.status = "Status" / "Status"
reports.history.table.requestedBy = "Solicitado por" / "Requested by"
reports.history.table.date = "Data" / "Date"
reports.history.table.actions = "Ações" / "Actions"
reports.history.filterType = "Tipo" / "Type"
reports.history.filterAllTypes = "Todos os Tipos" / "All Types"
reports.history.filterStatus = "Status" / "Status"
reports.history.filterAllStatuses = "Todos os Status" / "All Statuses"
reports.history.empty = "Nenhum relatório gerado ainda. Escolha um tipo de relatório acima para começar." / "No reports generated yet. Choose a report type above to get started."

reports.status.generating = "Gerando" / "Generating"
reports.status.completed = "Concluído" / "Completed"
reports.status.failed = "Falhou" / "Failed"

reports.detail.backToReports = "← Voltar para Relatórios" / "← Back to Reports"
reports.detail.generatedOn = "Gerado em {date} por {name}" / "Generated on {date} by {name}"
reports.detail.download = "Baixar" / "Download"
reports.detail.downloadPdf = "Baixar PDF" / "Download PDF"
reports.detail.downloadXlsx = "Baixar Excel" / "Download Excel"
reports.detail.downloadCsv = "Baixar CSV" / "Download CSV"
reports.detail.delete = "Excluir" / "Delete"
reports.detail.deleteConfirm = "Tem certeza que deseja excluir este relatório?" / "Are you sure you want to delete this report?"
reports.detail.retry = "Tentar Novamente" / "Retry"

reports.healthScore.overallScore = "Pontuação Geral" / "Overall Score"
reports.healthScore.financialHealth = "Saúde Financeira" / "Financial Health"
reports.healthScore.growthIndicators = "Indicadores de Crescimento" / "Growth Indicators"
reports.healthScore.riskFactors = "Fatores de Risco" / "Risk Factors"
reports.healthScore.recommendations = "Recomendações" / "Recommendations"
reports.healthScore.burnRate = "Burn Rate" / "Burn Rate"
reports.healthScore.runway = "Runway" / "Runway"
reports.healthScore.runwayMonths = "{months} meses" / "{months} months"
reports.healthScore.revenueToExpense = "Receita/Despesa" / "Revenue/Expense"
reports.healthScore.monthlyGrowth = "Crescimento Mensal" / "Monthly Growth"
reports.healthScore.trend = "Tendência" / "Trend"
reports.healthScore.trend.accelerating = "Acelerando" / "Accelerating"
reports.healthScore.trend.stable = "Estável" / "Stable"
reports.healthScore.trend.decelerating = "Desacelerando" / "Decelerating"
reports.healthScore.consistency = "Consistência" / "Consistency"
reports.healthScore.rating.critical = "Crítico" / "Critical"
reports.healthScore.rating.needsAttention = "Atenção Necessária" / "Needs Attention"
reports.healthScore.rating.moderate = "Moderado" / "Moderate"
reports.healthScore.rating.healthy = "Saudável" / "Healthy"
reports.healthScore.rating.excellent = "Excelente" / "Excellent"
reports.healthScore.priority.high = "Alta" / "High"
reports.healthScore.priority.medium = "Média" / "Medium"
reports.healthScore.priority.low = "Baixa" / "Low"
reports.healthScore.limitedData = "Dados limitados — menos de 3 meses de dados financeiros disponíveis" / "Limited data — less than 3 months of financial data available"

reports.financialSummary.periodOverview = "Visão do Período" / "Period Overview"
reports.financialSummary.totalRevenue = "Receita Total" / "Total Revenue"
reports.financialSummary.totalExpenses = "Despesas Totais" / "Total Expenses"
reports.financialSummary.netResult = "Resultado Líquido" / "Net Result"
reports.financialSummary.burnRate = "Burn Rate" / "Burn Rate"
reports.financialSummary.revenueTrend = "Tendência de Receita" / "Revenue Trend"
reports.financialSummary.expenseBreakdown = "Composição de Despesas" / "Expense Breakdown"
reports.financialSummary.cashFlow = "Fluxo de Caixa" / "Cash Flow"
reports.financialSummary.openingBalance = "Saldo Inicial" / "Opening Balance"
reports.financialSummary.closingBalance = "Saldo Final" / "Closing Balance"
reports.financialSummary.inflow = "Entrada" / "Inflow"
reports.financialSummary.outflow = "Saída" / "Outflow"
reports.financialSummary.netFlow = "Fluxo Líquido" / "Net Flow"
reports.financialSummary.narrative = "Análise" / "Analysis"
reports.financialSummary.periodStart = "Início do Período" / "Period Start"
reports.financialSummary.periodEnd = "Fim do Período" / "Period End"
reports.financialSummary.granularity = "Granularidade" / "Granularity"
reports.financialSummary.granularity.monthly = "Mensal" / "Monthly"
reports.financialSummary.granularity.quarterly = "Trimestral" / "Quarterly"

reports.investorReady.executiveSummary = "Resumo Executivo" / "Executive Summary"
reports.investorReady.companyOverview = "Visão da Empresa" / "Company Overview"
reports.investorReady.team = "Equipe" / "Team"
reports.investorReady.financialHighlights = "Destaques Financeiros" / "Financial Highlights"
reports.investorReady.dataroomSummary = "Resumo do Dataroom" / "Dataroom Summary"
reports.investorReady.documentsAvailable = "{count} documentos disponíveis" / "{count} documents available"

reports.custom.originalPrompt = "Prompt Original" / "Original Prompt"
reports.custom.dataSources = "Fontes de Dados" / "Data Sources"
reports.custom.disclaimer = "Relatórios gerados por IA são baseados nos dados disponíveis e devem ser revisados para precisão." / "AI-generated reports are based on available data and should be reviewed for accuracy."

reports.export.asyncToast = "Sua exportação está sendo gerada. Você receberá um e-mail quando estiver pronta." / "Your export is being generated. You'll receive an email when ready."
reports.export.readyToast = "Exportação pronta!" / "Export ready!"

common.export = "Exportar" / "Export"
common.download = "Baixar" / "Download"
common.retry = "Tentar novamente" / "Retry"
common.dateRange.last3Months = "Últimos 3 meses" / "Last 3 months"
common.dateRange.last6Months = "Últimos 6 meses" / "Last 6 months"
common.dateRange.last12Months = "Últimos 12 meses" / "Last 12 months"
common.dateRange.ytd = "Ano atual" / "Year to date"

errors.report.generationFailed = "Falha na geração do relatório" / "Report generation failed"
errors.report.aiTimeout = "O tempo de geração do relatório expirou. Tente novamente." / "Report generation timed out. Please try again."
errors.report.insufficientData = "Dados insuficientes para gerar este tipo de relatório. Conecte uma fonte de dados financeiros." / "Insufficient data to generate this report type. Connect a financial data source."
errors.report.notFound = "Relatório não encontrado" / "Report not found"
errors.report.exportFailed = "Falha na geração da exportação" / "Export generation failed"
errors.report.exportNotFound = "Exportação não encontrada" / "Export not found"
errors.report.exportExpired = "Link de download expirado. Baixe novamente." / "Download link expired. Download again."
errors.report.formatUnsupported = "Formato de exportação não suportado" / "Unsupported export format"
errors.report.generationLimit = "Limite de relatórios simultâneos atingido. Aguarde a conclusão dos relatórios em andamento." / "Concurrent report limit reached. Wait for ongoing reports to complete."
errors.report.customPromptRequired = "Prompt é obrigatório para relatórios personalizados" / "Prompt is required for custom reports"
errors.report.customPromptTooLong = "Prompt excede o limite de 2.000 caracteres" / "Prompt exceeds 2,000 character limit"
errors.report.cannotDeleteGenerating = "Não é possível excluir um relatório em geração" / "Cannot delete a report that is still generating"
errors.report.invalidPeriod = "Período inválido. A data inicial deve ser anterior à data final." / "Invalid period. Start date must be before end date."
```

---

## Success Criteria

- [ ] AI Health Score report generates with 0-100 score and four breakdown sections
- [ ] Financial Summary report includes revenue, expenses, cash flow, and AI narrative
- [ ] Investor-Ready report combines profile, team, financials, and dataroom summary
- [ ] Custom AI report accepts free-text prompt and generates adaptive report structure
- [ ] Report generation completes within 2 minutes (including AI call and PDF rendering)
- [ ] PDF exports render with correct formatting, company header, and Brazilian number formatting
- [ ] Excel exports include structured tabs appropriate to each report type
- [ ] CSV exports produce valid RFC 4180 CSV with UTF-8 BOM and semicolon delimiter
- [ ] Async generation returns 202 with job reference and notifies user on completion
- [ ] Failed reports show error state with retry option
- [ ] Concurrent generation limited to 3 per company, returns 429 when exceeded
- [ ] Role-based access enforced: only ADMIN/FINANCE can generate, LEGAL can view
- [ ] Report deletion removes S3 files and associated export records
- [ ] Pre-signed download URLs expire after 1 hour
- [ ] All report actions are audit-logged (REPORT_GENERATED, REPORT_COMPLETED, REPORT_EXPORTED, REPORT_DELETED)
- [ ] Token usage tracked per report for cost monitoring
- [ ] Reports generated in company locale (PT-BR or EN)
- [ ] AI reports use data from Open Finance, dataroom, and company profile only (no cross-company data)
- [ ] Custom prompt sanitized and length-limited to prevent injection
- [ ] Duplicate export requests within 5 minutes return existing job
- [ ] Hourly S3 cleanup removes expired export files
- [ ] Brazilian number formatting used for all financial values in display contexts

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-profile.md](./company-profile.md) | Company profile data used as AI report input (overview, team, metrics) |
| [company-dataroom.md](./company-dataroom.md) | Dataroom documents used as AI report input (document metadata and text extraction) |
| [company-management.md](./company-management.md) | Company record data (name, CNPJ, sector) used in report context |
| [user-permissions.md](./user-permissions.md) | Role-based report access: ADMIN, FINANCE (generate), LEGAL (view) |
| [notifications.md](./notifications.md) | In-app notifications for report completion/failure |
| [api-standards.md](../.claude/rules/api-standards.md) | Response envelope format, pagination, export content types, HTTP status codes |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: REPORT_*, VAL_*, SYS_* used in report endpoint responses |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: REPORT_GENERATED, REPORT_COMPLETED, REPORT_EXPORTED, REPORT_DELETED |
| [security.md](../.claude/rules/security.md) | S3 bucket policies, pre-signed URL configuration, AI prompt injection prevention |
| [i18n.md](../.claude/rules/i18n.md) | Brazilian number formatting rules, report language selection based on company locale |
