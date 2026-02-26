# Reports & Analytics — User Flows

**Feature**: Generate ownership reports, dilution analysis, investor portfolios, cap table exports (PDF/XLSX/CSV/OCT), and due diligence packages (ZIP)
**Actors**: ADMIN, FINANCE, LEGAL (company reports); Any authenticated user (portfolio); System (Bull queue export processing)
**Preconditions**: User is authenticated. For company reports, user must be an ACTIVE member with ADMIN, FINANCE, or LEGAL role. Company must exist.
**Related Flows**: [Cap Table Management](./cap-table-management.md), [Exit Waterfall](./exit-waterfall.md), [Funding Rounds](./funding-rounds.md), [Option Plans](./option-plans.md), [Convertible Instruments](./convertible-instruments.md), [Document Generation](./document-generation.md)

---

## Flow Map

```
User requests report
  │
  ├─ [GET ownership] ─→ Synchronous ownership breakdown
  │     │
  │     ├─ [company exists] ─→ Return shareholders, percentages, option pool
  │     └─ [company not found] ─→ 404 Not Found
  │
  ├─ [GET dilution] ─→ Synchronous dilution analysis
  │     │
  │     ├─ [company exists + snapshots found] ─→ Return time-series data + Gini + foreign %
  │     └─ [company not found] ─→ 404 Not Found
  │
  ├─ [GET portfolio] ─→ Synchronous investor portfolio
  │     │
  │     ├─ [user has shareholdings] ─→ Return holdings, invested, estimated value, ROI
  │     └─ [no shareholdings] ─→ Empty holdings array
  │
  ├─ [GET cap-table/export] ─→ Async cap table export
  │     │
  │     ├─ [format valid] ─→ Create ExportJob → Queue Bull job → Return 202
  │     │     │
  │     │     ├─ [duplicate in 5min window] ─→ Return existing job (no new queue)
  │     │     │
  │     │     └─ [processing completes] ─→ Upload to S3 → Email user → COMPLETED
  │     │           │
  │     │           └─ [processing fails] ─→ Mark FAILED → Retry up to 3x
  │     │
  │     ├─ [format unsupported] ─→ 400 Bad Request
  │     └─ [company not found] ─→ 404 Not Found
  │
  ├─ [GET cap-table/export/:jobId] ─→ Poll export status
  │     │
  │     ├─ [job found + not expired] ─→ Return status + downloadUrl
  │     ├─ [job found + expired] ─→ 410 Gone
  │     └─ [job not found] ─→ 404 Not Found
  │
  └─ [GET due-diligence] ─→ Async due diligence package
        │
        ├─ [company exists] ─→ Create ExportJob → Queue Bull job → Return 202
        │     │
        │     └─ [processing completes] ─→ ZIP (CSVs + PDF + metadata) → S3 → Email → COMPLETED
        │           │
        │           └─ [processing fails] ─→ Mark FAILED → Retry up to 2x
        │
        └─ [company not found] ─→ 404 Not Found
```

---

## Flows

### Happy Path: View Ownership Report

```
PRECONDITION: User is ADMIN, FINANCE, or LEGAL for the company
ACTOR: Company member
TRIGGER: User opens ownership report page

1. [UI] User navigates to company reports → Ownership
2. [Frontend] Sends GET /api/v1/companies/:companyId/reports/ownership
3. [Backend] Validates authentication (AuthGuard)
   → IF unauthenticated: return 401
4. [Backend] Validates role (ADMIN, FINANCE, LEGAL)
   → IF unauthorized: return 404
5. [Backend] Looks up company
   → IF not found: return 404
6. [Backend] Queries all shareholdings with shareholder + share class data
7. [Backend] Queries active option plans and grants (if includeOptions ≠ false)
8. [Backend] Computes ownership percentages, fully diluted percentages, option pool summary
9. [Backend] Returns 200 with ownership report data
10. [UI] Displays ownership table with pie chart

POSTCONDITION: User sees current ownership breakdown
SIDE EFFECTS: None (read-only)
```

### Happy Path: View Dilution Analysis

```
PRECONDITION: User is ADMIN, FINANCE, or LEGAL. Company has cap table snapshots.
ACTOR: Company member
TRIGGER: User opens dilution analysis

1. [UI] User navigates to reports → Dilution
2. [Frontend] Sends GET /api/v1/companies/:companyId/reports/dilution?dateFrom=...&dateTo=...&granularity=month
3. [Backend] Validates auth + role
4. [Backend] Looks up company
   → IF not found: return 404
5. [Backend] Generates date points based on granularity (day/week/month)
6. [Backend] Queries cap table snapshots in date range
7. [Backend] For each date point, finds nearest snapshot and computes share class breakdown
8. [Backend] Computes Gini coefficient from current shareholdings
9. [Backend] Computes foreign ownership percentage
10. [Backend] Returns 200 with time-series data + metrics
11. [UI] Displays dilution timeline chart

POSTCONDITION: User sees dilution trends over time
SIDE EFFECTS: None (read-only)
```

### Happy Path: View Investor Portfolio

```
PRECONDITION: User is authenticated (any role)
ACTOR: Investor / any authenticated user
TRIGGER: User opens portfolio page

1. [UI] User navigates to My Portfolio
2. [Frontend] Sends GET /api/v1/users/me/reports/portfolio
3. [Backend] Validates authentication
   → IF unauthenticated: return 401
4. [Backend] Queries all ACTIVE shareholders linked to user's userId
5. [Backend] Queries latest CLOSED funding round per company for price reference
6. [Backend] Queries CONFIRMED ISSUANCE transactions for invested amounts
7. [Backend] Computes estimated values and ROI multiples per holding
8. [Backend] Returns 200 with holdings array + portfolio totals
9. [UI] Displays portfolio table with total invested, estimated value, weighted ROI

POSTCONDITION: User sees consolidated portfolio across all companies
SIDE EFFECTS: None (read-only)
```

### Happy Path: Export Cap Table (Async)

```
PRECONDITION: User is ADMIN, FINANCE, or LEGAL
ACTOR: Company member
TRIGGER: User clicks export button with format selection

1. [UI] User selects export format (PDF, XLSX, CSV, or OCT)
2. [UI] User clicks "Export Cap Table"
3. [Frontend] Sends GET /api/v1/companies/:companyId/reports/cap-table/export?format=pdf
4. [Backend] Validates auth + role
5. [Backend] Validates format is one of: pdf, xlsx, csv, oct
   → IF unsupported: return 400 REPORT_FORMAT_UNSUPPORTED
6. [Backend] Checks for duplicate export in 5-minute window (same company + format)
   → IF duplicate found: return 202 with existing job (no new queue)
7. [Backend] Creates ExportJob record (status: QUEUED)
8. [Backend] Adds job to 'report-export' Bull queue ('cap-table-export' processor)
9. [Backend] Returns 202 Accepted with job ID and status
10. [UI] Shows "Export queued" message with job ID
11. [Frontend] Polls GET /api/v1/companies/:companyId/reports/cap-table/export/:jobId
12. [System] Bull worker picks up job:
    a. Marks job as PROCESSING
    b. Generates file in requested format (CSV/XLSX/PDF/OCT)
    c. Uploads to S3 (navia-exports bucket)
    d. Creates presigned URL (1-hour expiry)
    e. Marks job as COMPLETED with downloadUrl
    f. Sends export-ready email to user
13. [Frontend] Detects COMPLETED status via polling
14. [UI] Shows download link

POSTCONDITION: Cap table file is available for download via presigned S3 URL
SIDE EFFECTS: Audit log (CAP_TABLE_EXPORTED), Email (export-ready notification)
```

### Happy Path: Generate Due Diligence Package (Async)

```
PRECONDITION: User is ADMIN or LEGAL
ACTOR: Company admin or legal counsel
TRIGGER: User requests due diligence package

1. [UI] User navigates to reports → Due Diligence
2. [UI] Optionally selects date range
3. [Frontend] Sends GET /api/v1/companies/:companyId/reports/due-diligence?dateFrom=...&dateTo=...
4. [Backend] Validates auth + role (ADMIN or LEGAL only)
5. [Backend] Looks up company
   → IF not found: return 404
6. [Backend] Creates ExportJob record (type: DUE_DILIGENCE, format: zip, status: QUEUED)
7. [Backend] Adds job to 'report-export' Bull queue ('due-diligence' processor)
8. [Backend] Returns 202 Accepted
9. [System] Bull worker processes job:
    a. Marks job as PROCESSING
    b. Generates 6 CSV files (transactions, shareholders, option grants, convertibles, documents inventory, cap table history)
    c. Generates cap table PDF
    d. Generates metadata.json
    e. Packages all files into ZIP archive
    f. Uploads ZIP to S3
    g. Creates presigned URL (1-hour expiry)
    h. Marks job as COMPLETED
    i. Sends export-ready email
10. [Frontend] Polls status endpoint until COMPLETED
11. [UI] Shows download link for ZIP file

POSTCONDITION: Due diligence ZIP package available for download
SIDE EFFECTS: Audit log (DUE_DILIGENCE_GENERATED), Email (export-ready notification)
```

### Error Path: Export Job Expired

```
PRECONDITION: User previously generated an export; presigned URL has expired (>1 hour)
ACTOR: Company member
TRIGGER: User revisits old export or polls late

1. [Frontend] Sends GET /api/v1/companies/:companyId/reports/cap-table/export/:jobId
2. [Backend] Finds ExportJob with status COMPLETED
3. [Backend] Checks expiresAt < now
   → expiresAt is in the past
4. [Backend] Returns 410 Gone with REPORT_EXPORT_EXPIRED
5. [UI] Shows "Link expired — generate again" message

POSTCONDITION: User must re-initiate the export
```

### Error Path: Export Processing Failure

```
PRECONDITION: Export job is queued
TRIGGER: Bull worker encounters error during generation

1. [System] Bull worker picks up job
2. [System] Worker marks job as PROCESSING
3. [System] Generation fails (Puppeteer crash, S3 unavailable, etc.)
4. [System] Worker calls failExportJob(jobId, 'REPORT_EXPORT_FAILED')
5. [System] Worker re-throws error → Bull retries (3 attempts for cap-table, 2 for due-diligence)
6. [System] After max retries, job stays in failed state in Bull queue
7. [Frontend] Polling returns job with status FAILED and errorCode
8. [UI] Shows error message

POSTCONDITION: Job is marked FAILED. User can retry by requesting a new export.
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 3 | Auth check | No valid token | Error | 401 Unauthorized |
| 4 | Role check | Not ADMIN/FINANCE/LEGAL | Error | 404 Not Found |
| 5 | Company lookup | Company not found | Error | 404 Not Found |
| 5 | Format validation | Invalid format | Error | 400 Bad Request |
| 6 | Deduplication | Same export in 5-min window | Skip | Return existing job |
| 12 | Generation | Processing fails | Error | Mark FAILED, retry via Bull |
| 12 | S3 upload | S3 unavailable | Degrade | Complete without downloadUrl |
| - | URL expiry | expiresAt in the past | Error | 410 Gone |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| ExportJob | status | — | QUEUED | Job created |
| ExportJob | status | QUEUED | PROCESSING | Bull worker starts |
| ExportJob | status | PROCESSING | COMPLETED | Generation + upload succeeds |
| ExportJob | status | PROCESSING | FAILED | Generation throws after max retries |
| ExportJob | s3Key | null | `exports/{companyId}/{timestamp}.{ext}` | S3 upload |
| ExportJob | downloadUrl | null | presigned URL | S3 presigned URL generated |
| ExportJob | expiresAt | null | now + 1 hour | presigned URL generated |

---

## By Role

| Step | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|------|-------|---------|-------|----------|----------|
| Ownership report | Yes | Yes | Yes | No (404) | No (404) |
| Dilution analysis | Yes | Yes | Yes | No (404) | No (404) |
| Cap table export | Yes (all formats) | Yes (all formats) | Yes (all formats) | No (404) | No (404) |
| Due diligence | Yes | No (404) | Yes | No (404) | No (404) |
| Portfolio | Yes | Yes | Yes | Yes | Yes |

---

## Export Formats

| Format | Content Type | Extension | Use Case |
|--------|-------------|-----------|----------|
| PDF | application/pdf | .pdf | Stakeholder review, printed reports |
| XLSX | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | .xlsx | Financial analysis, 4-tab workbook |
| CSV | text/csv; charset=utf-8 | .csv | Data import, semicolon-delimited (Brazilian format) |
| OCT | application/json | .json | Open Cap Table Coalition v1.0.0 interop |
| ZIP | application/zip | .zip | Due diligence packages |

---

## Cross-Feature References

**Depends on**: [Authentication](./authentication.md) — user must be logged in
**Depends on**: [Cap Table Management](./cap-table-management.md) — ownership data and snapshots
**Depends on**: [Option Plans](./option-plans.md) — option pool summary and vested calculations
**Depends on**: [Funding Rounds](./funding-rounds.md) — latest round price for portfolio valuation
**Depends on**: [Convertible Instruments](./convertible-instruments.md) — convertible data in due diligence CSV
**Depends on**: [Document Generation](./document-generation.md) — document inventory in due diligence CSV
**Complements**: [Exit Waterfall](./exit-waterfall.md) — waterfall at `/reports/waterfall`, analytics at `/reports/*`

---

## Frontend UI Flow

### Reports Page Navigation

```
User navigates to /dashboard/reports
  │
  ├─ [no company selected] ─→ Empty state: "Select a company to view reports" with BarChart3 icon
  │
  └─ [company selected] ─→ Page renders with 4 stat cards + 4-tab layout
        │
        ├─ Stat Cards (always visible):
        │     ├─ Total Shares (active/highlighted ocean-600)
        │     ├─ Shareholders count
        │     ├─ Gini Coefficient (from dilution report)
        │     └─ Foreign Ownership % (from dilution report)
        │
        ├─ [Ownership tab — default] ─→ Share class filter + include options checkbox
        │     │
        │     ├─ [data loaded] ─→ Summary stats (total shares/fully diluted) + shareholders table + option pool summary
        │     ├─ [no shareholders] ─→ Empty state with Users icon
        │     ├─ [loading] ─→ Animated skeleton lines
        │     └─ [error] ─→ AlertCircle icon + title text
        │
        ├─ [Dilution tab] ─→ Granularity selector (day/week/month) + date range inputs
        │     │
        │     ├─ [data loaded] ─→ Gini + foreign % + period count metrics + data points table with share class columns
        │     ├─ [no data points] ─→ "No data points for the selected period" with TrendingUp icon
        │     ├─ [loading] ─→ Animated skeleton bars
        │     └─ [error] ─→ AlertCircle icon + title text
        │
        ├─ [Export tab] ─→ Format selector (PDF/XLSX/CSV/OCT) + snapshot date + Export button
        │     │
        │     ├─ [click Export] ─→ Mutation fires → button shows "Exporting..." spinner
        │     │     │
        │     │     ├─ [job QUEUED] ─→ Blue status card with spinner: "Export queued..."
        │     │     ├─ [job PROCESSING] ─→ Blue status card with spinner: "Processing export..."
        │     │     ├─ [job COMPLETED] ─→ Green status card: "Export ready!" + Download link
        │     │     └─ [job FAILED] ─→ Red status card with error code
        │     │
        │     └─ [polling] ─→ useExportJobStatus polls every 2s until COMPLETED/FAILED
        │
        └─ [Due Diligence tab] ─→ Date range inputs + Generate button
              │
              ├─ [click Generate] ─→ Mutation fires → button shows "Generating..." spinner
              │     │
              │     ├─ [job QUEUED] ─→ Blue status card: "Queued..."
              │     ├─ [job PROCESSING] ─→ Blue status card: "Generating..."
              │     ├─ [job COMPLETED] ─→ Green status card: "Package ready!" + Download link
              │     └─ [job FAILED] ─→ Red status card with error code
              │
              └─ [polling] ─→ useDueDiligenceJobStatus polls every 2s until COMPLETED/FAILED
```
