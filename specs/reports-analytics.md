# Reports & Analytics Specification

**Topic of Concern**: Cap table reports, investor reporting, dilution analysis, and due diligence packages

**One-Sentence Description**: The system generates comprehensive reports including ownership breakdowns, dilution analysis, investor portfolio views, and exports in PDF, Excel, CSV, and OCT JSON formats.

**Note**: Exit waterfall modeling has been moved to [exit-waterfall.md](./exit-waterfall.md).

**Complements**:
- `api-standards.md` — response envelope, pagination, export content types
- `audit-logging.md` — audit report generation, due diligence audit trail
- `error-handling.md` — error codes for report generation failures
- `security.md` — PII handling in exported reports
- `user-permissions.md` — role-based access to reports

---

## Table of Contents

1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Report Types](#report-types)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [Per-Role Access Matrix](#per-role-access-matrix)
7. [Edge Cases](#edge-cases)
8. [Dependencies](#dependencies)
9. [Technical Implementation](#technical-implementation)
10. [Security Considerations](#security-considerations)
11. [Success Criteria](#success-criteria)
12. [Related Specifications](#related-specifications)

---

## Overview

Navia provides reporting and analytics for various stakeholders: admin dashboards for equity tracking, investor reports for portfolio updates, board reports for governance, and due diligence packages for fundraising. Reports are exportable in PDF, Excel, CSV, and OCT JSON formats.

Reports are generated from current database state (no stale caches). For large exports (>1000 rows or PDF/ZIP generation), the system queues the job via Bull and returns a `202 Accepted` with a job ID. The user receives an email when the export is ready for download.

---

## User Stories

### US-1: Ownership Breakdown

**As an** admin, **I want to** view the current ownership breakdown by shareholder and share class, **so that** I can understand the equity distribution at a glance.

**Acceptance Criteria**:
- Display each shareholder's name, share class, number of shares, basic percentage, and fully-diluted percentage.
- Include an option pool summary showing allocated, exercised, and remaining shares.
- Support filtering by share class.
- Data reflects the current cap table state (no caching delay).

### US-2: Investor Portfolio View

**As an** investor, **I want to** see my portfolio summary across all companies I hold shares in, **so that** I can track my total investment value and ownership percentages.

**Acceptance Criteria**:
- Show each company with the investor's shares, percentage ownership, and estimated value (based on last round price).
- Accessible via the user-scoped endpoint (not company-scoped).
- Only display the investor's own holdings; never expose other shareholders' data.

### US-3: Due Diligence Package

**As a** legal user, **I want to** generate a due diligence package for the company, **so that** potential investors and auditors can review the company's equity history.

**Acceptance Criteria**:
- Generate a ZIP file containing: cap table history PDF, transaction ledger CSV, shareholder list, option grant summary, convertible instrument summary, document inventory, and audit trail for the requested period.
- Include blockchain verification hashes for all on-chain transactions.
- Large packages are generated asynchronously; the user receives an email with a download link.

### US-4: Cap Table Export

**As a** finance user, **I want to** export the current cap table in standard formats (PDF, Excel, CSV, OCT JSON), **so that** I can share it with accountants, lawyers, and other stakeholders.

**Acceptance Criteria**:
- PDF: formatted, print-ready report with company header and generation date.
- Excel (XLSX): structured spreadsheet with multiple tabs (summary, by share class, by shareholder).
- CSV: flat data export, one row per shareholding.
- OCT JSON: Open Cap Table Coalition standard format for interoperability.
- All exports include the generation timestamp and company name.

---

## Report Types

### Admin/Board Reports
- Current cap table with ownership percentages
- Fully-diluted cap table (including unexercised options and convertibles)
- Historical cap table snapshots (point-in-time reconstruction)
- Ownership by share class
- Voting power distribution
- Option pool utilization
- Transaction history ledger

### Investor Reports
- Ownership certificates
- Investment summary (amount invested, current value, ROI multiple)
- Transaction history for the specific investor
- Exit proceeds projections at various valuations (see [exit-waterfall.md](./exit-waterfall.md))

### Due Diligence Packages
- Complete cap table history
- All transactions with blockchain verification links
- Option grant summary
- Convertible instrument summary
- Shareholder contact list (masked PII per LGPD)
- Corporate documents inventory
- Audit trail for the requested period (see `audit-logging.md` Due Diligence Audit Report)

### Analytics
- Dilution tracking over time (chart data)
- Ownership concentration (Gini coefficient)
- Foreign ownership percentage
- Upcoming vesting events calendar
- Exit waterfall analysis (see [exit-waterfall.md](./exit-waterfall.md))

---

## API Endpoints

### GET /api/v1/companies/:companyId/reports/ownership

Returns the current ownership breakdown for the company.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `shareClassId` | UUID | — | Filter by specific share class |
| `includeOptions` | boolean | `true` | Include unexercised options in fully-diluted calculation |

**Response** (`200 OK`):

```json
{
  "success": true,
  "data": {
    "companyId": "550e8400-e29b-41d4-a716-446655440000",
    "companyName": "Acme Ltda.",
    "generatedAt": "2026-02-23T14:30:00.000Z",
    "totalShares": "100000",
    "totalFullyDiluted": "120000",
    "shareholders": [
      {
        "shareholderId": "uuid-1",
        "name": "Joao Silva",
        "shareClassName": "ON",
        "shareClassId": "uuid-class-1",
        "shares": "40000",
        "percentage": "40.00",
        "fullyDilutedPercentage": "33.33"
      },
      {
        "shareholderId": "uuid-2",
        "name": "Fund ABC",
        "shareClassName": "PN-A",
        "shareClassId": "uuid-class-2",
        "shares": "30000",
        "percentage": "30.00",
        "fullyDilutedPercentage": "25.00"
      }
    ],
    "optionPoolSummary": {
      "totalPool": "20000",
      "granted": "15000",
      "exercised": "5000",
      "vestedUnexercised": "4000",
      "unvested": "6000",
      "available": "5000"
    }
  }
}
```

### GET /api/v1/companies/:companyId/reports/cap-table/export

Exports the current cap table in the requested format.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | string | `pdf` | Export format: `pdf`, `xlsx`, `csv`, `oct` |
| `snapshotDate` | ISO 8601 | — | Point-in-time export. Omit for current state. |

**Response (synchronous, small exports)** (`200 OK`):

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="cap-table-2026-02-23.pdf"
```

Binary file content.

**Response (asynchronous, large exports)** (`202 Accepted`):

```json
{
  "success": true,
  "data": {
    "jobId": "export-uuid-123",
    "status": "QUEUED",
    "format": "xlsx",
    "estimatedCompletionSeconds": 30,
    "pollUrl": "/api/v1/companies/:companyId/reports/cap-table/export/export-uuid-123"
  }
}
```

**Polling endpoint**: `GET /api/v1/companies/:companyId/reports/cap-table/export/:jobId`

```json
{
  "success": true,
  "data": {
    "jobId": "export-uuid-123",
    "status": "COMPLETED",
    "format": "xlsx",
    "downloadUrl": "https://s3.amazonaws.com/navia-exports/...",
    "expiresAt": "2026-02-23T15:30:00.000Z"
  }
}
```

Export download URLs are pre-signed S3 URLs with 1-hour expiry.

**OCT JSON Format**: Follows the Open Cap Table Coalition schema for cap table interoperability. The response `Content-Type` is `application/json` with `Content-Disposition: attachment`.

### GET /api/v1/companies/:companyId/reports/due-diligence

Generates a complete due diligence package as a ZIP file.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dateFrom` | ISO 8601 | Company creation date | Start of audit trail period |
| `dateTo` | ISO 8601 | Current date | End of audit trail period |

**Response** (`202 Accepted`):

Due diligence packages are always generated asynchronously due to their size.

```json
{
  "success": true,
  "data": {
    "jobId": "dd-uuid-456",
    "status": "QUEUED",
    "estimatedCompletionSeconds": 120,
    "pollUrl": "/api/v1/companies/:companyId/reports/due-diligence/dd-uuid-456"
  }
}
```

**ZIP Contents**:

| File | Description |
|------|-------------|
| `cap-table-current.pdf` | Current ownership breakdown |
| `cap-table-history.csv` | All cap table snapshots |
| `transactions.csv` | Full transaction ledger |
| `shareholders.csv` | Shareholder list (PII masked per LGPD) |
| `option-grants.csv` | All option grants with vesting status |
| `convertibles.csv` | Convertible instruments summary |
| `documents-inventory.csv` | List of all corporate documents |
| `audit-trail.pdf` | Audit log report for the period (see `audit-logging.md`) |
| `blockchain-proofs.json` | On-chain transaction hashes and verification data |
| `metadata.json` | Package generation timestamp, company info, period covered |

### GET /api/v1/companies/:companyId/reports/dilution

Returns dilution analysis data over time.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dateFrom` | ISO 8601 | 12 months ago | Start date |
| `dateTo` | ISO 8601 | Current date | End date |
| `granularity` | string | `month` | Data point granularity: `day`, `week`, `month` |

**Response** (`200 OK`):

```json
{
  "success": true,
  "data": {
    "companyId": "uuid",
    "generatedAt": "2026-02-23T14:30:00.000Z",
    "dataPoints": [
      {
        "date": "2025-03-01",
        "totalShares": "50000",
        "fullyDilutedShares": "60000",
        "shareClasses": [
          { "shareClassId": "uuid-1", "name": "ON", "shares": "40000", "percentage": "80.00" },
          { "shareClassId": "uuid-2", "name": "PN-A", "shares": "10000", "percentage": "20.00" }
        ]
      }
    ],
    "giniCoefficient": "0.42",
    "foreignOwnershipPercentage": "15.00"
  }
}
```

### GET /api/v1/users/me/reports/portfolio

Returns the authenticated investor's portfolio across all companies.

**Response** (`200 OK`):

```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "generatedAt": "2026-02-23T14:30:00.000Z",
    "holdings": [
      {
        "companyId": "uuid-1",
        "companyName": "Acme Ltda.",
        "shareClassName": "PN-A",
        "shares": "10000",
        "ownershipPercentage": "10.00",
        "totalInvested": "500000.00",
        "estimatedValue": "1200000.00",
        "lastRoundPricePerShare": "120.00",
        "roiMultiple": "2.40"
      }
    ],
    "totals": {
      "totalInvested": "500000.00",
      "totalEstimatedValue": "1200000.00",
      "weightedRoiMultiple": "2.40"
    }
  }
}
```

---

## Data Models

### TypeScript Interfaces

```typescript
interface OwnershipReportEntry {
  shareholderId: string;
  name: string;
  shareClassId: string;
  shareClassName: string;
  shares: string;            // Decimal as string
  percentage: string;        // e.g., "25.00"
  fullyDilutedPercentage: string;
}

interface OptionPoolSummary {
  totalPool: string;
  granted: string;
  exercised: string;
  vestedUnexercised: string;
  unvested: string;
  available: string;
}

interface OwnershipReport {
  companyId: string;
  companyName: string;
  generatedAt: string;       // ISO 8601
  totalShares: string;
  totalFullyDiluted: string;
  shareholders: OwnershipReportEntry[];
  optionPoolSummary: OptionPoolSummary;
}

interface ExportJob {
  id: string;
  companyId: string;
  format: 'pdf' | 'xlsx' | 'csv' | 'oct';
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  s3Key: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;  // ISO 8601, pre-signed URL expiry
  createdAt: string;
  errorCode: string | null;
}

interface PortfolioHolding {
  companyId: string;
  companyName: string;
  shareClassName: string;
  shares: string;
  ownershipPercentage: string;
  totalInvested: string;
  estimatedValue: string;
  lastRoundPricePerShare: string;
  roiMultiple: string;
}
```

For waterfall-related data models (`WaterfallShareClassResult`, `WaterfallAnalysis`), see [exit-waterfall.md](./exit-waterfall.md).

---

## Per-Role Access Matrix

| Report / Endpoint | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------------------|-------|---------|-------|----------|----------|
| Ownership breakdown (`GET .../reports/ownership`) | Full | Full | Full | No | No |
| Dilution analysis (`GET .../reports/dilution`) | Full | Full | Read | No | No |
| Cap table export (`GET .../reports/cap-table/export`) | Full | Full | Full | No | No |
| Due diligence package (`GET .../reports/due-diligence`) | Full | No | Full | No | No |
| Portfolio view (`GET /users/me/reports/portfolio`) | No | No | No | Own only | No |
| Option grant report | Full | Full | Read | No | Own only |

For waterfall analysis access, see [exit-waterfall.md](./exit-waterfall.md) (ADMIN only).

**Notes**:
- "Full" = can view and export.
- "Read" = can view but not export.
- "Own only" = can only see data pertaining to the authenticated user.
- INVESTOR role sees only their own holdings via the user-scoped portfolio endpoint, never via company-scoped report endpoints.
- Accessing a report endpoint without the required role returns `404 Not Found` (not `403`, to prevent enumeration per `api-standards.md`).

---

## Edge Cases

### EC-1: Empty Cap Table

When a company has no shareholders or share classes, the ownership report returns empty arrays with zero totals.

### EC-2: Concurrent Export Requests

If a user requests an export while a previous export of the same format for the same company is still processing, the system returns the existing job ID rather than queuing a duplicate. The deduplication window is 5 minutes.

---

## Dependencies

| Dependency | Purpose | Notes |
|------------|---------|-------|
| Puppeteer / Chromium | PDF report generation | Runs in a headless browser for HTML-to-PDF rendering |
| ExcelJS | XLSX spreadsheet generation | Generates multi-tab spreadsheets |
| Bull queue (`report-export`) | Async export job processing | Separate queue from audit-log queue |
| AWS S3 (`navia-exports` bucket) | Temporary storage for generated exports | Pre-signed URLs with 1-hour expiry |
| AWS SES | Email notification when async export completes | Links to the download URL |
| Recharts (frontend) | Chart rendering for dilution and ownership visuals | Frontend-only dependency |
| Shareholding / Transaction data | Source data for all calculations | Via Prisma queries |
| Audit log data | Due diligence audit trail | See `audit-logging.md` |

---

## Technical Implementation

### ReportService Skeleton

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue('report-export') private exportQueue: Queue,
  ) {}

  async getOwnershipReport(companyId: string, options: {
    shareClassId?: string;
    includeOptions?: boolean;
  }): Promise<OwnershipReport> {
    // 1. Fetch all shareholdings for company (filtered by shareClassId if provided)
    // 2. Compute basic percentage: shares / totalShares * 100
    // 3. If includeOptions, fetch vested unexercised options and add to fully-diluted denominator
    // 4. Compute fully-diluted percentage: shares / totalFullyDiluted * 100
    // 5. Build option pool summary from OptionGrant and OptionPlan data
    // 6. Return structured OwnershipReport
  }

  async exportCapTable(companyId: string, format: string, snapshotDate?: string): Promise<ExportJob> {
    // 1. Check for duplicate in-progress export (EC-2 deduplication)
    // 2. Create ExportJob record with status QUEUED
    // 3. Add job to Bull queue
    // 4. Return job metadata
  }

  async generateDueDiligence(companyId: string, dateFrom: string, dateTo: string): Promise<ExportJob> {
    // 1. Create ExportJob record with status QUEUED
    // 2. Add job to Bull queue with all sub-report parameters
    // 3. Return job metadata
  }

  async getPortfolio(userId: string): Promise<PortfolioHolding[]> {
    // 1. Find all companies where user is a shareholder
    // 2. For each company, fetch shareholdings belonging to user
    // 3. Look up latest funding round price for estimated value
    // 4. Compute ROI multiple: estimatedValue / totalInvested
    // 5. Return holdings array
  }

  // Waterfall analysis method — see exit-waterfall.md for specification
  // async runWaterfall(companyId, input): Promise<WaterfallAnalysis>
}
```

### Bull Queue Processor

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';

@Processor('report-export')
export class ReportExportProcessor {
  @Process('cap-table-export')
  async handleCapTableExport(job: Job) {
    // 1. Fetch data based on job.data (companyId, format, snapshotDate)
    // 2. Generate file (PDF via Puppeteer, XLSX via ExcelJS, CSV via stream, OCT via JSON serialization)
    // 3. Upload to S3 navia-exports bucket
    // 4. Update ExportJob record with s3Key, status COMPLETED
    // 5. Send email notification with pre-signed download URL
  }

  @Process('due-diligence')
  async handleDueDiligence(job: Job) {
    // 1. Generate each sub-report (cap table, transactions, shareholders, etc.)
    // 2. Fetch audit trail from audit log service
    // 3. Package all files into a ZIP
    // 4. Upload ZIP to S3
    // 5. Update ExportJob record
    // 6. Send email notification
  }
}
```

### Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| FR-1 | Synchronous reports generate from current database state | < 3 seconds |
| FR-2 | Async export jobs complete within reasonable time | < 60 seconds (cap table), < 5 minutes (due diligence) |
| FR-3 | Export files are stored temporarily in S3 | 1-hour pre-signed URL expiry, auto-deleted after 24 hours |
| FR-4 | All numeric values in reports use Brazilian number format for display | `1.234,56` via `Intl.NumberFormat('pt-BR')` on frontend |

---

## Security Considerations

- **PII in exports**: Shareholder names are included in reports. Email addresses are masked (`j***@example.com`) in all exports except for ADMIN role, who sees full emails. CPF is never included in any export.
- **Pre-signed URLs**: All export download links use S3 pre-signed URLs with 1-hour expiry. URLs are single-use (S3 access logging tracks downloads).
- **Audit logging**: Report generation and export actions are audit-logged as `CAP_TABLE_EXPORTED` (see `audit-logging.md`). The audit event includes the format, date range, and requesting user.
- **Rate limiting**: Export endpoints use the `write` rate limit tier (30 requests per minute) to prevent abuse. Portfolio endpoint uses the `read` tier (100 requests per minute).
- **Company scoping**: All company-scoped report endpoints enforce that the authenticated user is an ACTIVE member of the company. Non-members receive `404`.
- **S3 bucket policy**: The `navia-exports` bucket has `BlockPublicAccess` enabled. Objects are encrypted with SSE-S3. No public read access.
- **Data export audit**: Every export triggers a `DATA_EXPORTED` audit event for LGPD compliance (Art. 18).

---

## Success Criteria

- [ ] Ownership report generates in < 3 seconds for companies with up to 500 shareholders
- [ ] PDF exports render with correct formatting, company header, and generation date
- [ ] Excel exports include multiple tabs (summary, by share class, by shareholder) with correct formulas
- [ ] CSV exports produce valid RFC 4180 CSV with UTF-8 BOM for Brazilian character support
- [ ] OCT JSON exports conform to the Open Cap Table Coalition schema
- [ ] Due diligence ZIP includes all specified sub-reports with correct data
- [ ] Async exports complete within timeout (60s cap table, 5min DD package)
- [ ] Pre-signed download URLs expire after 1 hour
- [ ] Duplicate export requests within 5 minutes return existing job (no duplicate work)
- [ ] Role-based access matrix is enforced: unauthorized roles receive `404`
- [ ] All export actions are audit-logged
- [ ] Decimal precision is maintained throughout calculations (no floating-point rounding)
- [ ] Brazilian number formatting is used for all financial values in display contexts

For waterfall-specific success criteria, see [exit-waterfall.md](./exit-waterfall.md).

---

## Frontend Specification

### Navigation Structure

Reports is a **top-level sidebar navigation item** with the following sub-pages:

| Sidebar Label | URL | Component |
|---------------|-----|-----------|
| **Reports** (parent) | — | Expandable nav group |
| └ Ownership | `/dashboard/reports/ownership` | `OwnershipReportPage` |
| └ Dilution | `/dashboard/reports/dilution` | `DilutionAnalysisPage` |
| └ Cap Table Export | `/dashboard/reports/export` | `CapTableExportPage` |
| └ Exit Waterfall | `/dashboard/reports/waterfall` | `WaterfallPage` (see exit-waterfall.md) |
| └ Due Diligence | `/dashboard/reports/due-diligence` | `DueDiligencePage` |

The Investor Portfolio is a separate route under the user scope:

| Sidebar Label | URL | Component |
|---------------|-----|-----------|
| Portfolio | `/dashboard/portfolio` | `PortfolioDashboardPage` |

Portfolio is visible only to users with INVESTOR role. It appears as a top-level sidebar item (not under Reports) because it is user-scoped, not company-scoped.

### Sidebar Icon

- Reports group icon: `BarChart3` (Lucide)
- Portfolio icon: `Briefcase` (Lucide)

---

### Page 1: Ownership Report

**URL**: `/dashboard/reports/ownership`

```
┌─────────────────────────────────────────────────────────┐
│  h1: Ownership Report                      [Export ▾]   │
│  body-sm: Current equity distribution by shareholder     │
├─────────────────────────────────────────────────────────┤
│  Filters: [Share Class ▾ All]  [☐ Include Options]      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌── Summary Cards (3) ────────────────────────────────┐│
│  │ Total Shares    │ Fully Diluted   │ Shareholders    ││
│  │ 100.000         │ 120.000         │ 12              ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Ownership Table ──────────────────────────────────┐│
│  │ Shareholder  │ Class │ Shares │ %    │ FD %  │      ││
│  │ João Silva   │ ON    │ 40.000 │ 40,00│ 33,33 │      ││
│  │ Fund ABC     │ PN-A  │ 30.000 │ 30,00│ 25,00 │      ││
│  │ Maria Santos │ ON    │ 20.000 │ 20,00│ 16,67 │      ││
│  │ ...          │       │        │      │       │      ││
│  │ TOTAL        │       │100.000 │100,00│       │      ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Option Pool Summary (Card) ───────────────────────┐│
│  │ Total Pool: 20.000  │ Granted: 15.000 │ Available: 5K││
│  │ Exercised: 5.000    │ Vested: 4.000   │ Unvested: 6K ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

#### Ownership Table Columns

| Column | Field | Alignment | Format | Sortable |
|--------|-------|-----------|--------|----------|
| Shareholder | `name` | left | Text | Yes (alpha) |
| Share Class | `shareClassName` | left | Text + badge | Yes (alpha) |
| Shares | `shares` | right | Brazilian number (e.g., `40.000`) | Yes (numeric) |
| Ownership % | `percentage` | right | `{value}%` (e.g., `40,00%`) | Yes (numeric) |
| Fully Diluted % | `fullyDilutedPercentage` | right | `{value}%` | Yes (numeric) |

- Default sort: `-percentage` (highest ownership first)
- Summary row at bottom: totals for Shares, Ownership % (should be 100,00%)
- Pagination: standard (20 per page default)

#### Filter Bar

| Filter | Type | Default | Behavior |
|--------|------|---------|----------|
| Share Class | Dropdown (single select) | "All Classes" | Filters table to show only selected class |
| Include Options | Checkbox/switch | checked (true) | Toggles fully-diluted calculation |

#### Export Button

- Dropdown with options: PDF, Excel, CSV
- Triggers `GET /reports/cap-table/export?format={format}`
- For sync exports: browser downloads file directly
- For async exports (202): shows toast "Export is being generated. You'll receive an email when ready."

#### Loading State
- Skeleton: 3 stat card skeletons + table skeleton (8 rows)

#### Empty State
- When company has no shareholders: centered empty state illustration + "No shareholders yet" + "Add your first shareholder to see ownership data." + CTA button "Add Shareholder" (links to shareholders page)

---

### Page 2: Dilution Analysis

**URL**: `/dashboard/reports/dilution`

```
┌─────────────────────────────────────────────────────────┐
│  h1: Dilution Analysis                                   │
│  body-sm: Ownership changes over time                    │
├─────────────────────────────────────────────────────────┤
│  Filters: [Date From] [Date To] [Granularity: Month ▾]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌── Stacked Area Chart (Recharts) ────────────────────┐│
│  │                                                      ││
│  │  100% ┤▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ││
│  │       │▓▓▓ ON ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ││
│  │   75% ┤▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓         ││
│  │       │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░         ││
│  │   50% ┤░░░ PN-A ░░░░░░░░░░░░░░░░░░░░░░░░         ││
│  │       │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░         ││
│  │   25% ┤▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒         ││
│  │       │▒▒▒ PN-B ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒         ││
│  │    0% ┤──────────────────────────────────          ││
│  │       Jan  Feb  Mar  Apr  May  Jun  Jul            ││
│  │                                                      ││
│  │  Legend: ▓ ON  ░ PN-A  ▒ PN-B                       ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌── Metrics Cards (2) ───────────────────────────────┐ │
│  │ Gini Coefficient     │ Foreign Ownership %         │ │
│  │ 0,42                 │ 15,00%                      │ │
│  │ (Ownership concentr.)│ (Non-domestic holders)      │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Stacked Area Chart (Recharts)

| Setting | Value |
|---------|-------|
| Chart type | `AreaChart` with stacked `Area` components |
| X-axis | Date (formatted: `MMM yyyy` for month, `dd/MM` for day/week) |
| Y-axis | Percentage (0% to 100%) |
| Colors | Chart palette from design system: chart-1 through chart-8 |
| Tooltip | Custom tooltip showing: date, share class name, shares, percentage |
| Legend | Bottom, horizontal, using chart color dots + class names |
| Grid | Dashed horizontal lines, `gray-200` |
| Responsive | Container width 100%, fixed height 400px (320px on mobile) |
| Animation | Fade in on load, 500ms duration |

Each `Area` component represents one share class. The areas stack to 100%.

#### Data Points

Each data point from the API `dataPoints[]` array maps to one X-axis tick. The `shareClasses` array within each data point provides the stacked values.

#### Filter Bar

| Filter | Type | Default | Description |
|--------|------|---------|-------------|
| Date From | Date picker | 12 months ago | `dateFrom` query param |
| Date To | Date picker | Today | `dateTo` query param |
| Granularity | Dropdown | `month` | Options: "Daily", "Weekly", "Monthly" |

Date pickers use Brazilian format (dd/MM/yyyy).

#### Metrics Cards

| Card | Value | Description |
|------|-------|-------------|
| Gini Coefficient | `giniCoefficient` | Format: `0,42`. Subtitle: "Concentração de propriedade" / "Ownership concentration" |
| Foreign Ownership | `foreignOwnershipPercentage` | Format: `15,00%`. Subtitle: "Participação estrangeira" / "Non-domestic holders" |

#### Loading State
- Chart area: gray-200 rectangle placeholder with pulse animation
- Metrics cards: 2 skeleton cards

#### Empty State
- When no data points returned: chart area shows "No dilution data available for this period" + suggestion to adjust date range

---

### Page 3: Cap Table Export

**URL**: `/dashboard/reports/export`

```
┌─────────────────────────────────────────────────────────┐
│  h1: Cap Table Export                                    │
│  body-sm: Download cap table in various formats          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌── Export Card ──────────────────────────────────────┐ │
│  │                                                      │ │
│  │  Format                                              │ │
│  │  ○ PDF  — Formatted print-ready report               │ │
│  │  ● Excel — Structured spreadsheet with tabs          │ │
│  │  ○ CSV  — Flat data export                           │ │
│  │  ○ OCT JSON — Open Cap Table standard                │ │
│  │                                                      │ │
│  │  Point-in-Time (optional)                            │ │
│  │  [Date picker: dd/MM/yyyy]                           │ │
│  │  body-sm: Leave empty for current cap table state    │ │
│  │                                                      │ │
│  │  [Download Export]                                    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── Recent Exports (Table) ───────────────────────────┐ │
│  │ Format │ Date      │ Status    │ Download           │ │
│  │ XLSX   │ 23/02/2026│ Completed │ [Download] (link)  │ │
│  │ PDF    │ 22/02/2026│ Completed │ [Download] (link)  │ │
│  │ CSV    │ 20/02/2026│ Failed    │ [Retry]            │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Export Format Selection

- Radio button group (single select)
- Each option shows: format name + brief description
- Default: PDF

#### Point-in-Time Date Picker

- Standard date picker (dd/MM/yyyy format)
- Optional — leave blank for current state
- Max date: today
- Min date: company creation date

#### Download Button

- Variant: primary
- Label: "Download Export" / "Baixar Exportação"
- States:
  - Default: enabled
  - Loading (sync export): spinner + "Generating..."
  - Loading (async): spinner + "Queuing..."
  - After async: button returns to default, toast notification shown

#### Async Export Flow

1. User selects format and clicks Download
2. If response is `200`: browser triggers file download directly
3. If response is `202 Accepted`:
   - Toast: "Your export is being generated. You'll receive an email when it's ready."
   - Export appears in "Recent Exports" table with status "Processing"
   - Frontend polls `GET /reports/cap-table/export/:jobId` every 5 seconds
   - When `status === 'COMPLETED'`: toast "Export ready!" with download link
   - Download link uses pre-signed S3 URL (1-hour expiry)

#### Recent Exports Table

| Column | Description |
|--------|-------------|
| Format | Badge: PDF (blue-100), XLSX (green-100), CSV (gray-100), OCT (cream-100) |
| Date | `createdAt` in dd/MM/yyyy format |
| Status | Badge: Queued (gray), Processing (blue, animated), Completed (green), Failed (red) |
| Action | "Download" link (for completed) or "Retry" button (for failed) |

---

### Page 4: Due Diligence Package

**URL**: `/dashboard/reports/due-diligence`

```
┌─────────────────────────────────────────────────────────┐
│  h1: Due Diligence Package                               │
│  body-sm: Generate comprehensive equity documentation    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌── Generation Card ─────────────────────────────────┐ │
│  │                                                      │ │
│  │  Audit Trail Period                                  │ │
│  │  From: [Date picker]    To: [Date picker]            │ │
│  │  body-sm: Defaults to full company history           │ │
│  │                                                      │ │
│  │  Package Contents (info, read-only)                  │ │
│  │  ✓ Current cap table (PDF)                           │ │
│  │  ✓ Cap table history (CSV)                           │ │
│  │  ✓ Transaction ledger (CSV)                          │ │
│  │  ✓ Shareholder list (CSV, PII masked)                │ │
│  │  ✓ Option grants summary (CSV)                       │ │
│  │  ✓ Convertible instruments (CSV)                     │ │
│  │  ✓ Documents inventory (CSV)                         │ │
│  │  ✓ Audit trail (PDF)                                 │ │
│  │  ✓ Blockchain proofs (JSON)                          │ │
│  │  ✓ Package metadata (JSON)                           │ │
│  │                                                      │ │
│  │  [Generate Package]                                   │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── Recent Packages (Table) ──────────────────────────┐ │
│  │ Date Range  │ Generated │ Status    │ Download      │ │
│  │ Full history│ 23/02/2026│ Completed │ [Download ZIP]│ │
│  │ 2025-2026   │ 20/02/2026│ Completed │ [Download ZIP]│ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Generation Flow

1. User selects date range (optional, defaults to full company history)
2. User clicks "Generate Package"
3. Response is always `202 Accepted` (async)
4. Toast: "Due diligence package is being generated. This may take a few minutes. You'll receive an email when ready."
5. Package appears in "Recent Packages" table with "Processing" status
6. Poll every 10 seconds for status update
7. On completion: toast "Package ready!" + email notification
8. Download link: pre-signed S3 URL for ZIP file

#### Package Contents List

- Read-only checklist (all items always included — no user customization per user decision)
- Shows what will be in the ZIP for transparency
- Each item: green checkmark icon + filename + brief description

---

### Page 5: Investor Portfolio Dashboard

**URL**: `/dashboard/portfolio`

This is a **full dashboard** for investors, visible only to INVESTOR role users.

```
┌─────────────────────────────────────────────────────────┐
│  h1: My Portfolio                                        │
│  body-sm: Your investments across all companies          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌── Summary Cards (4) ───────────────────────────────┐ │
│  │ Total Invested│ Current Value│ ROI Multiple│Companies││
│  │ R$ 500.000    │ R$ 1.200.000│ 2,40x       │ 3       ││
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── Charts Row (2 charts) ───────────────────────────┐ │
│  │                                                      │ │
│  │  ┌── Allocation Pie ──┐  ┌── ROI Bar Chart ──────┐ │ │
│  │  │                    │  │                        │ │ │
│  │  │  [Donut chart]     │  │  [Horizontal bars]     │ │ │
│  │  │  showing % of      │  │  showing ROI multiple  │ │ │
│  │  │  value per company │  │  per company            │ │ │
│  │  │                    │  │                        │ │ │
│  │  └────────────────────┘  └────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌── Holdings Table ───────────────────────────────────┐ │
│  │ Company   │ Class│ Shares │ Own. %│ Invested│ Value │ │
│  │ Acme Ltda.│ PN-A │ 10.000 │ 10,00%│ R$ 500K │R$ 1,2M│ │
│  │ Beta Inc. │ ON   │  5.000 │  5,00%│ R$ 200K │R$ 400K│ │
│  │ ...       │      │        │       │         │       │ │
│  │ TOTAL     │      │        │       │ R$ 700K │R$ 1,6M│ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  Click any row to view detailed company holdings ↗       │
└─────────────────────────────────────────────────────────┘
```

#### Summary Cards (4)

| Card | Value | Format | Icon |
|------|-------|--------|------|
| Total Invested | `totals.totalInvested` | `R$ {formatted}` | `DollarSign` |
| Current Value | `totals.totalEstimatedValue` | `R$ {formatted}` | `TrendingUp` |
| ROI Multiple | `totals.weightedRoiMultiple` | `{value}x` | `ArrowUpRight` |
| Companies | Count of `holdings` | Integer | `Building2` |

Active card (highlighted): Current Value card uses `blue-600` bg with white text (per design system stat card active variant).

#### Allocation Pie Chart (Recharts)

| Setting | Value |
|---------|-------|
| Chart type | `PieChart` with donut (`innerRadius={60}`) |
| Data | One slice per company, value = `estimatedValue` |
| Colors | Chart palette from design system |
| Center label | "Total Value" + formatted total |
| Legend | Right side: color dot + company name + percentage |
| Tooltip | Company name + value + percentage |
| Responsive | max-width 400px, auto height |

#### ROI Bar Chart (Recharts)

| Setting | Value |
|---------|-------|
| Chart type | `BarChart` with horizontal bars |
| Data | One bar per company, value = `roiMultiple` |
| Colors | chart-1 for positive ROI (>1x), destructive for negative (<1x) |
| X-axis | ROI multiple (0x, 1x, 2x, 3x...) |
| Y-axis | Company names |
| Reference line | Dashed line at 1.0x (break-even) |
| Tooltip | Company name + ROI multiple + invested + current value |

#### Holdings Table Columns

| Column | Field | Alignment | Format | Sortable |
|--------|-------|-----------|--------|----------|
| Company | `companyName` | left | Text | Yes (alpha) |
| Share Class | `shareClassName` | left | Text + badge | Yes |
| Shares | `shares` | right | Brazilian number | Yes (numeric) |
| Ownership % | `ownershipPercentage` | right | `{value}%` | Yes (numeric) |
| Invested | `totalInvested` | right | `R$ {formatted}` | Yes (numeric) |
| Est. Value | `estimatedValue` | right | `R$ {formatted}` | Yes (numeric) |
| ROI | `roiMultiple` | right | `{value}x` with color (green > 1, red < 1) | Yes (numeric) |

- Default sort: `-estimatedValue` (highest value first)
- Summary row: totals for Invested, Est. Value, weighted ROI
- Click row: navigates to `/dashboard/reports/ownership?companyId={id}` (drill-down to company)

#### Loading State
- 4 skeleton stat cards + 2 skeleton chart areas + skeleton table

#### Empty State
- When investor has no holdings: "No investments yet" + "You'll see your portfolio here once you hold shares in a company." + illustration (Briefcase icon, 64px)

---

### Common Components (Shared Across Report Pages)

#### DateRangePicker

Reusable date range picker component used by Dilution, Due Diligence, and Export pages:

- Two date inputs: From and To
- Brazilian format: dd/MM/yyyy
- Calendar popover (using shadcn/ui `Calendar` + `Popover`)
- Preset ranges: "Last 3 months", "Last 6 months", "Last 12 months", "Full history"
- Validation: From must be before To, To must not be in the future

#### ExportFormatSelector

Reusable radio group for export format selection:

- Variants: PDF, XLSX, CSV, OCT JSON
- Each option: radio + format name + description
- Used by Cap Table Export page and Ownership Report export dropdown

#### AsyncJobStatusBadge

Reusable badge component for export job status:

| Status | Badge Color | Icon |
|--------|-------------|------|
| QUEUED | gray-100, gray-600 text | `Clock` |
| PROCESSING | blue-100, blue-600 text | `Loader2` (spinning) |
| COMPLETED | green-100, green-700 text | `CheckCircle` |
| FAILED | red-50, destructive text | `XCircle` |

#### AsyncJobPoller

Hook that polls for async job completion:

```typescript
function useAsyncJobPoller(companyId: string, jobId: string | null, endpoint: string) {
  return useQuery({
    queryKey: ['export-job', jobId],
    queryFn: () => api.get(`${endpoint}/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (data) => {
      if (!data || data.status === 'QUEUED' || data.status === 'PROCESSING') return 5000;
      return false; // Stop polling when completed or failed
    },
  });
}
```

---

## Backend Specification Additions

### Dilution Analysis — Calculation Details

#### Gini Coefficient Calculation

The Gini coefficient measures ownership concentration. It is calculated over all current shareholders' ownership percentages:

```typescript
function computeGiniCoefficient(shareholdings: { percentage: Decimal }[]): Decimal {
  const n = shareholdings.length;
  if (n === 0) return new Decimal(0);

  const sorted = shareholdings
    .map(s => s.percentage)
    .sort((a, b) => a.comparedTo(b));

  let numerator = new Decimal(0);
  for (let i = 0; i < n; i++) {
    numerator = numerator.add(sorted[i].mul(2 * (i + 1) - n - 1));
  }

  const denominator = new Decimal(n).mul(sorted.reduce((sum, p) => sum.add(p), new Decimal(0)));

  return denominator.isZero() ? new Decimal(0) : numerator.div(denominator).abs();
}
```

- Value range: 0 (perfect equality) to 1 (maximum concentration)
- Computed over: all individual shareholders with > 0 shares
- Updated on each dilution analysis request (not cached)

#### Foreign Ownership Percentage

"Foreign ownership" is determined by the shareholder's `nationality` field:

- Shareholders with `nationality !== 'BR'` (or null nationality for legal entities registered outside Brazil) are considered foreign
- Percentage = (shares held by foreign shareholders / total shares) * 100
- If no shareholders have nationality data, return `"0.00"` with a note

**Note**: The `nationality` field must exist on the Shareholder model. If it doesn't exist yet, it should be added as an optional field:

```prisma
model Shareholder {
  // ... existing fields
  nationality  String?  @map("nationality")  // ISO 3166-1 alpha-2 code, e.g., "BR", "US"
}
```

#### Dilution Data Point Generation

For each date in the requested range (at the specified granularity), the system reconstructs the cap table state:

1. Find the nearest `CapTableSnapshot` at or before the date
2. If no snapshot exists, compute the state from transactions up to that date
3. Extract share class breakdown and total shares
4. Return as a data point

This means the Dilution endpoint may be slower for fine granularity (daily) over long periods. The `< 3 seconds` performance target applies to the default (monthly over 12 months, ~12 data points).

### Export Job Persistence

Add an `ExportJob` model for tracking async exports:

```prisma
model ExportJob {
  id          String         @id @default(uuid())
  companyId   String?        @map("company_id")
  userId      String         @map("user_id")
  type        ExportJobType  @map("type")
  format      String?        // pdf, xlsx, csv, oct, zip
  status      ExportJobStatus @default(QUEUED)
  s3Key       String?        @map("s3_key")
  downloadUrl String?        @map("download_url")
  expiresAt   DateTime?      @map("expires_at")
  errorCode   String?        @map("error_code")
  parameters  Json?          // Filters, date ranges, etc.
  createdAt   DateTime       @default(now()) @map("created_at")
  completedAt DateTime?      @map("completed_at")

  company Company? @relation(fields: [companyId], references: [id])
  user    User     @relation(fields: [userId], references: [id])

  @@index([companyId, createdAt])
  @@index([userId, createdAt])
  @@index([status])
  @@map("export_jobs")
}

enum ExportJobType {
  CAP_TABLE_EXPORT
  DUE_DILIGENCE
}

enum ExportJobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
}
```

### Export Deduplication Logic

```typescript
async findExistingJob(companyId: string, format: string): Promise<ExportJob | null> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.prisma.exportJob.findFirst({
    where: {
      companyId,
      format,
      status: { in: ['QUEUED', 'PROCESSING'] },
      createdAt: { gte: fiveMinutesAgo },
    },
    orderBy: { createdAt: 'desc' },
  });
}
```

Deduplication key: `(companyId, format, status in [QUEUED, PROCESSING], createdAt within 5 minutes)`.
Note: `snapshotDate` is NOT part of the deduplication key (different snapshots create different jobs).

### S3 Cleanup Job

Scheduled job to delete expired exports:

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

### Email Notification for Async Exports

- Template: `export-completed` (PT-BR and EN per user locale)
- Subject: "[Navia] Sua exportação está pronta — {formatName}" / "[Navia] Your export is ready — {formatName}"
- Content: Export type, format, company name, download link (pre-signed URL, 1-hour expiry)
- Sent when job status transitions to `COMPLETED`
- For failed jobs: separate email template `export-failed` with error description and retry suggestion

### PDF Generation Details

Using Puppeteer for HTML-to-PDF rendering:

```typescript
async generateCapTablePdf(data: OwnershipReport): Promise<Buffer> {
  const html = this.renderTemplate('cap-table-pdf', {
    companyName: data.companyName,
    generatedAt: formatDate(data.generatedAt, 'pt-BR'),
    shareholders: data.shareholders,
    optionPool: data.optionPoolSummary,
    totalShares: data.totalShares,
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
- Generation date and time
- Page numbers in footer
- Table formatting matching the design system
- All numbers in Brazilian format

### Excel Generation Details

Using ExcelJS:

```typescript
async generateCapTableXlsx(data: OwnershipReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Tab 1: Summary
  const summarySheet = workbook.addWorksheet('Summary');
  // Company name, date, total shares, fully-diluted total

  // Tab 2: By Share Class
  const classSheet = workbook.addWorksheet('By Share Class');
  // Columns: Share Class, Total Shares, Percentage, Shareholders Count

  // Tab 3: By Shareholder
  const holderSheet = workbook.addWorksheet('By Shareholder');
  // Columns: Name, Share Class, Shares, %, Fully Diluted %

  // Tab 4: Option Pool
  const optionSheet = workbook.addWorksheet('Option Pool');
  // Pool summary data

  return workbook.xlsx.writeBuffer();
}
```

### CSV Generation Details

- UTF-8 encoding with BOM (`\uFEFF` prefix) for Brazilian character support
- Delimiter: semicolon (`;`) — Brazilian Excel uses semicolons by default
- Line ending: CRLF
- RFC 4180 compliant (fields with commas/semicolons/newlines are quoted)

### OCT JSON Format

Follows Open Cap Table Coalition v1.1 schema. Key mappings:

| OCT Field | Navia Source |
|-----------|-------------|
| `issuer.legal_name` | `Company.legalName` |
| `issuer.country_of_formation` | `"BR"` (always) |
| `stakeholders[].name` | `Shareholder.name` |
| `stock_classes[].name` | `ShareClass.className` |
| `transactions[].type` | `Transaction.type` mapped to OCT transaction types |

### Error Codes (Report-Specific)

| Error Code | HTTP Status | messageKey | When |
|------------|-------------|------------|------|
| `REPORT_GENERATION_FAILED` | 500 | `errors.report.generationFailed` | Unexpected error during report generation |
| `REPORT_EXPORT_FAILED` | 500 | `errors.report.exportFailed` | Export file generation failed |
| `REPORT_EXPORT_NOT_FOUND` | 404 | `errors.report.exportNotFound` | Export job ID doesn't exist |
| `REPORT_EXPORT_EXPIRED` | 410 | `errors.report.exportExpired` | Pre-signed URL has expired |
| `REPORT_FORMAT_UNSUPPORTED` | 400 | `errors.report.formatUnsupported` | Invalid export format requested |

---

## i18n Keys

Add to both `messages/pt-BR.json` and `messages/en.json`:

```
reports.nav.title = "Relatórios" / "Reports"
reports.ownership.title = "Relatório de Propriedade" / "Ownership Report"
reports.ownership.description = "Distribuição atual de equity por acionista" / "Current equity distribution by shareholder"
reports.ownership.totalShares = "Total de Ações" / "Total Shares"
reports.ownership.fullyDiluted = "Totalmente Diluído" / "Fully Diluted"
reports.ownership.shareholders = "Acionistas" / "Shareholders"
reports.ownership.table.shareholder = "Acionista" / "Shareholder"
reports.ownership.table.shareClass = "Classe de Ação" / "Share Class"
reports.ownership.table.shares = "Ações" / "Shares"
reports.ownership.table.percentage = "%" / "%"
reports.ownership.table.fullyDilutedPercentage = "% Diluído" / "FD %"
reports.ownership.filterShareClass = "Classe de Ação" / "Share Class"
reports.ownership.filterAllClasses = "Todas as Classes" / "All Classes"
reports.ownership.includeOptions = "Incluir Opções" / "Include Options"
reports.ownership.optionPool = "Pool de Opções" / "Option Pool"
reports.ownership.optionPool.total = "Pool Total" / "Total Pool"
reports.ownership.optionPool.granted = "Concedidas" / "Granted"
reports.ownership.optionPool.exercised = "Exercidas" / "Exercised"
reports.ownership.optionPool.vestedUnexercised = "Adquiridas" / "Vested"
reports.ownership.optionPool.unvested = "Não Adquiridas" / "Unvested"
reports.ownership.optionPool.available = "Disponíveis" / "Available"
reports.ownership.empty.title = "Nenhum acionista ainda" / "No shareholders yet"
reports.ownership.empty.description = "Adicione seu primeiro acionista para ver os dados de propriedade." / "Add your first shareholder to see ownership data."

reports.dilution.title = "Análise de Diluição" / "Dilution Analysis"
reports.dilution.description = "Mudanças de propriedade ao longo do tempo" / "Ownership changes over time"
reports.dilution.dateFrom = "De" / "From"
reports.dilution.dateTo = "Até" / "To"
reports.dilution.granularity = "Granularidade" / "Granularity"
reports.dilution.granularity.day = "Diário" / "Daily"
reports.dilution.granularity.week = "Semanal" / "Weekly"
reports.dilution.granularity.month = "Mensal" / "Monthly"
reports.dilution.giniCoefficient = "Coeficiente de Gini" / "Gini Coefficient"
reports.dilution.giniDescription = "Concentração de propriedade" / "Ownership concentration"
reports.dilution.foreignOwnership = "Participação Estrangeira" / "Foreign Ownership"
reports.dilution.foreignDescription = "Acionistas não-domésticos" / "Non-domestic holders"
reports.dilution.empty = "Sem dados de diluição disponíveis para este período" / "No dilution data available for this period"

reports.export.title = "Exportar Cap Table" / "Cap Table Export"
reports.export.description = "Baixe o cap table em diversos formatos" / "Download cap table in various formats"
reports.export.format = "Formato" / "Format"
reports.export.format.pdf = "PDF — Relatório formatado para impressão" / "PDF — Formatted print-ready report"
reports.export.format.xlsx = "Excel — Planilha estruturada com abas" / "Excel — Structured spreadsheet with tabs"
reports.export.format.csv = "CSV — Exportação de dados plana" / "CSV — Flat data export"
reports.export.format.oct = "OCT JSON — Padrão Open Cap Table" / "OCT JSON — Open Cap Table standard"
reports.export.snapshotDate = "Data do Snapshot" / "Point-in-Time"
reports.export.snapshotHint = "Deixe vazio para o estado atual do cap table" / "Leave empty for current cap table state"
reports.export.downloadButton = "Baixar Exportação" / "Download Export"
reports.export.generating = "Gerando..." / "Generating..."
reports.export.queuing = "Enfileirando..." / "Queuing..."
reports.export.asyncToast = "Sua exportação está sendo gerada. Você receberá um e-mail quando estiver pronta." / "Your export is being generated. You'll receive an email when ready."
reports.export.readyToast = "Exportação pronta!" / "Export ready!"
reports.export.recentExports = "Exportações Recentes" / "Recent Exports"

reports.dueDiligence.title = "Pacote de Due Diligence" / "Due Diligence Package"
reports.dueDiligence.description = "Gere documentação completa de equity" / "Generate comprehensive equity documentation"
reports.dueDiligence.auditPeriod = "Período da Trilha de Auditoria" / "Audit Trail Period"
reports.dueDiligence.from = "De" / "From"
reports.dueDiligence.to = "Até" / "To"
reports.dueDiligence.defaultPeriod = "Padrão: histórico completo da empresa" / "Defaults to full company history"
reports.dueDiligence.contents = "Conteúdo do Pacote" / "Package Contents"
reports.dueDiligence.generateButton = "Gerar Pacote" / "Generate Package"
reports.dueDiligence.generating = "Gerando pacote. Isso pode levar alguns minutos. Você receberá um e-mail quando estiver pronto." / "Generating package. This may take a few minutes. You'll receive an email when ready."
reports.dueDiligence.readyToast = "Pacote pronto!" / "Package ready!"
reports.dueDiligence.recentPackages = "Pacotes Recentes" / "Recent Packages"

portfolio.title = "Meu Portfólio" / "My Portfolio"
portfolio.description = "Seus investimentos em todas as empresas" / "Your investments across all companies"
portfolio.totalInvested = "Total Investido" / "Total Invested"
portfolio.currentValue = "Valor Atual" / "Current Value"
portfolio.roiMultiple = "Múltiplo ROI" / "ROI Multiple"
portfolio.companies = "Empresas" / "Companies"
portfolio.allocation = "Alocação" / "Allocation"
portfolio.roiByCompany = "ROI por Empresa" / "ROI by Company"
portfolio.table.company = "Empresa" / "Company"
portfolio.table.shareClass = "Classe" / "Class"
portfolio.table.shares = "Ações" / "Shares"
portfolio.table.ownership = "Propriedade %" / "Ownership %"
portfolio.table.invested = "Investido" / "Invested"
portfolio.table.value = "Valor Est." / "Est. Value"
portfolio.table.roi = "ROI" / "ROI"
portfolio.drillDown = "Clique em uma linha para ver detalhes" / "Click a row to view details"
portfolio.empty.title = "Nenhum investimento ainda" / "No investments yet"
portfolio.empty.description = "Você verá seu portfólio aqui quando possuir ações em uma empresa." / "You'll see your portfolio here once you hold shares in a company."

common.export = "Exportar" / "Export"
common.download = "Baixar" / "Download"
common.retry = "Tentar novamente" / "Retry"
common.dateRange.last3Months = "Últimos 3 meses" / "Last 3 months"
common.dateRange.last6Months = "Últimos 6 meses" / "Last 6 months"
common.dateRange.last12Months = "Últimos 12 meses" / "Last 12 months"
common.dateRange.fullHistory = "Histórico completo" / "Full history"

errors.report.generationFailed = "Falha na geração do relatório" / "Report generation failed"
errors.report.exportFailed = "Falha na geração da exportação" / "Export generation failed"
errors.report.exportNotFound = "Exportação não encontrada" / "Export not found"
errors.report.exportExpired = "Link de download expirado. Gere uma nova exportação." / "Download link expired. Generate a new export."
errors.report.formatUnsupported = "Formato de exportação não suportado" / "Unsupported export format"
```

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [exit-waterfall.md](./exit-waterfall.md) | Exit waterfall scenario modeling — extracted from this spec |
| [cap-table-management.md](./cap-table-management.md) | Source data for ownership reports, shareholding breakdowns, and snapshots |
| [shareholder-registry.md](./shareholder-registry.md) | Shareholder data for ownership reports and due diligence packages |
| [share-classes.md](./share-classes.md) | Per-class breakdowns in cap table reports |
| [transactions.md](./transactions.md) | Transaction history reports and activity timelines |
| [funding-rounds.md](./funding-rounds.md) | Funding round summary reports and round history |
| [convertible-instruments.md](./convertible-instruments.md) | Convertible tracking data for due diligence packages |
| [option-plans.md](./option-plans.md) | Option pool reports and fully-diluted calculations |
| [user-permissions.md](./user-permissions.md) | Role-based report access: ADMIN, FINANCE, LEGAL, INVESTOR, EMPLOYEE |
| [api-standards.md](../.claude/rules/api-standards.md) | Response envelope format, pagination, export content types, HTTP status codes |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: CAP_*, VAL_*, SYS_* used in report endpoint responses |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: CAP_TABLE_EXPORTED, due diligence audit trail section |
| [security.md](../.claude/rules/security.md) | S3 bucket policies, PII handling in exports, pre-signed URL configuration |
| [i18n.md](../.claude/rules/i18n.md) | Brazilian number formatting rules for all financial values in report display |
