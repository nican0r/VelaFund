# Reports & Analytics Specification

**Topic of Concern**: Cap table reports, investor reporting, and due diligence packages

**One-Sentence Description**: The system generates comprehensive reports including ownership breakdowns, dilution analysis, exit waterfalls, and OCT-format exports.

---

## Overview

VelaFund provides reporting and analytics for various stakeholders: admin dashboards for equity tracking, investor reports for portfolio updates, board reports for governance, and due diligence packages for fundraising. Reports are exportable in PDF, Excel, CSV, and OCT JSON formats.

---

## Report Types

### Admin/Board Reports
- Current cap table with ownership percentages
- Fully-diluted cap table (including options)
- Historical cap table snapshots
- Ownership by share class
- Voting power distribution
- Option pool utilization
- Transaction history ledger

### Investor Reports
- Ownership certificates
- Investment summary (amount invested, current value, ROI)
- Transaction history for specific investor
- Exit proceeds projections at various valuations

### Due Diligence Packages
- Complete cap table history
- All transactions with blockchain verification links
- Option grant summary
- Convertible instrument summary
- Shareholder contact list
- Corporate documents

### Analytics
- Dilution tracking over time (chart)
- Ownership concentration (Gini coefficient)
- Foreign ownership percentage
- Upcoming vesting events calendar
- Exit waterfall analysis (M&A scenarios only)

---

## Functional Requirements

### FR-1: Real-Time Reports
- Reports generate from current database state
- No stale cached data
- < 5 second generation time

### FR-2: Export Formats
- PDF: Formatted, print-ready reports
- Excel: Structured data with formulas
- CSV: Raw data for analysis
- OCT JSON: Standardized cap table format

### FR-3: Waterfall Analysis (M&A Exits)
- Model exits at various valuations
- Calculate per-share proceeds by class
- Show liquidation preference stacking
- Account for participating preferred
- Calculate breakeven analysis

### FR-4: Access Control
- Admin/Finance: Full access to all reports
- Legal: Read access to all reports
- Investors: Limited to own investment reports
- Employees: Limited to own option reports

---

## API Endpoints

### GET /api/v1/companies/:companyId/reports/ownership
Current ownership report

### GET /api/v1/companies/:companyId/reports/dilution
Dilution analysis over time

### GET /api/v1/companies/:companyId/reports/waterfall
Exit waterfall analysis

**Query**: `?exit_value=10000000`

**Response**:
```json
{
  "exit_value": 10000000,
  "distribution": [
    {
      "shareholder": "Investor ABC",
      "share_class": "Preferred A",
      "liquidation_preference": 1500000,
      "participation_proceeds": 500000,
      "total_proceeds": 2000000,
      "roi_multiple": 2.0
    }
  ]
}
```

### GET /api/v1/companies/:companyId/reports/due-diligence
Generate complete due diligence package (ZIP file)

---

## Success Criteria

- Report generation: < 5 seconds
- 100% accuracy in calculations
- Support all standard export formats
- Waterfall analysis matches manual calculations
