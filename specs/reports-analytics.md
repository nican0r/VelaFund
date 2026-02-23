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
