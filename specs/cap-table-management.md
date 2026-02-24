# Cap Table Management Specification

**Topic of Concern**: Cap table operations and ownership tracking

**One-Sentence Description**: The system maintains an accurate, real-time cap table that automatically recalculates ownership percentages after every on-chain transaction.

---

## Overview

The cap table is the central record of equity ownership in a company, showing who owns what percentage of the company across different share classes. Navia's cap table mirrors on-chain state from OCP smart contracts deployed on Base Network, with automatic real-time synchronization. The system calculates ownership percentages, voting power, and fully-diluted positions (including unvested options) automatically after each transaction. The cap table supports both Brazilian corporate structures (Ltda. quotas and S.A. shares) and maintains OCT (Open Cap Table) standard compliance for interoperability.

For blockchain reconciliation (verifying off-chain cap table matches on-chain records), see [cap-table-reconciliation.md](./cap-table-reconciliation.md).

---

## User Stories

### US-1: View Current Cap Table
**As an** admin user
**I want to** view the current cap table with all shareholders and their ownership percentages
**So that** I understand the current equity distribution of my company

### US-2: View Fully-Diluted Cap Table
**As an** admin or investor
**I want to** see the fully-diluted cap table including unvested options
**So that** I understand potential future dilution

### US-3: Historical Cap Table Snapshot
**As an** admin user
**I want to** view the cap table as it existed on a specific past date
**So that** I can generate historical reports or verify past ownership

### US-4: Real-Time Ownership Updates
**As an** admin user
**I want** ownership percentages to update automatically after transactions
**So that** I always have accurate, current cap table data

### US-6: Export Cap Table
**As an** admin user
**I want to** export the cap table in OCT JSON format or PDF
**So that** I can share it with investors, auditors, or other stakeholders

### US-7: Cap Table Visualization
**As an** investor
**I want to** see a pie chart or visual representation of ownership
**So that** I can quickly understand the cap table structure

---

## Functional Requirements

### FR-1: Real-Time Calculation
- System MUST automatically recalculate ownership percentages after every transaction
- Calculations MUST complete within 5 seconds of transaction confirmation
- System MUST update voting power based on share class voting rights
- System MUST recalculate fully-diluted positions when option grants change

### FR-2: Cap Table Views
- System MUST provide "Current Cap Table" view (as of today)
- System MUST provide "Fully-Diluted Cap Table" view (including all options)
- System MUST provide "Point-in-Time" view (historical snapshot)
- System MUST support filtering by share class
- System MUST support sorting by ownership percentage, name, or date

### FR-3: Ownership Calculations
- Ownership % = (Shareholder Total Shares / Company Total Shares) x 100
- Voting % = (Shareholder Voting Power / Company Total Voting Power) x 100
- Voting Power = Sum of (Shares x Share Class Votes Per Share)
- Fully-Diluted % includes all outstanding options (vested + unvested)

### FR-4: Brazilian Structure Support
- System MUST support Sociedade Limitada (Ltda.) with quotas
- System MUST support Sociedade Anônima (S.A.) with shares
- System MUST track share/quota classes with different rights
- System MUST enforce structure-specific rules (e.g., S.A. preferred share restrictions)

### FR-5: OCT Standard Compliance
- System MUST store cap table data in OCT-compatible JSON format
- System MUST map Brazilian structures to OCT schema
- System MUST support OCT export for interoperability
- System MUST maintain OCT versioning and schema validation

### FR-7: Historical Snapshots
- System MUST create automatic snapshots after each transaction
- System MUST allow manual snapshot creation for specific dates
- System MUST retain snapshots indefinitely for audit trail
- Snapshots MUST include: date, shareholders, ownership %, blockchain state hash

### FR-8: Access Control
- Admin/Finance: Full cap table read/write access
- Legal: Read-only access to full cap table
- Investors: Read-only access to full cap table (may be restricted based on investor rights)
- Employees: Read-only access to own position only

---

## Data Models

### CapTable Entity

```typescript
interface CapTable {
  id: string;                          // UUID
  companyId: string;                   // Foreign key to Company (unique)

  // Current State
  totalShares: number;                 // Total authorized and issued shares
  totalShareholders: number;           // Count of active shareholders
  lastUpdated: Date;                   // Last transaction date

  // Blockchain Integration
  blockchainStateHash: string;         // Hash of on-chain state for verification
  lastSyncAt: Date;                    // Last sync with blockchain

  // OCT Compliance
  octData: OCTCapTable;                // Full OCT-format cap table

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

### CapTableEntry Entity

```typescript
interface CapTableEntry {
  id: string;                          // UUID
  capTableId: string;                  // Foreign key to CapTable
  shareholderId: string;               // Foreign key to Shareholder
  shareClassId: string;                // Foreign key to ShareClass

  // Ownership
  shares: number;                      // Number of shares owned
  percentage: number;                  // Ownership percentage of company
  votingPower: number;                 // Total votes (shares x votesPerShare)

  // Acquisition
  acquiredAt: Date;                    // Date of acquisition
  costBasis: number | null;            // Price per share paid

  // Metadata
  updatedAt: Date;
}
```

### HistoricalSnapshot Entity

```typescript
interface HistoricalSnapshot {
  id: string;                          // UUID
  capTableId: string;                  // Foreign key to CapTable
  snapshotDate: Date;                  // Date of this snapshot

  // Snapshot Data
  octData: OCTCapTable;                // Full OCT-format cap table at this date
  entries: CapTableEntry[];            // All cap table entries at this date

  // Blockchain
  blockchainStateHash: string;         // On-chain state hash at snapshot time
  blockNumber: number;                 // Blockchain block number

  // Metadata
  createdAt: Date;
  createdBy: string;                   // User ID who created snapshot
  notes: string | null;                // Optional notes (e.g., "Series A closing")
}
```

### OCT Cap Table Schema

```typescript
interface OCTCapTable {
  ocf_version: string;                 // "1.0.0"
  issuer: {
    id: string;
    legal_name: string;
    entity_type: 'LTDA' | 'SA';
    jurisdiction: string;              // "BR" for Brazil
  };
  stock_classes: OCTStockClass[];
  stockholders: OCTStockholder[];
  stock_issuances: OCTStockIssuance[];
  vesting_schedules?: OCTVestingSchedule[];
}

interface OCTStockClass {
  id: string;
  class_type: 'COMMON' | 'PREFERRED' | 'QUOTA';
  name: string;
  votes_per_share: number;
  liquidation_preference: number;
  participation_rights: boolean;
}

interface OCTStockholder {
  id: string;
  name: string;
  taxpayer_id: string;                 // CPF or CNPJ
  country_code: string;
}

interface OCTStockIssuance {
  id: string;
  stock_class_id: string;
  stockholder_id: string;
  quantity: number;
  price_per_share: number;
  date: string;                        // ISO 8601 date
}
```

---

## API Endpoints

### GET /api/v1/companies/:companyId/cap-table
**Description**: Get current cap table

**Query Parameters**:
- `view` (optional): `"current"` (default), `"fully-diluted"`, or `"authorized"`
- `shareClassId` (optional): Filter by specific share class

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "company": {
      "id": "uuid",
      "name": "Startup XYZ Ltda.",
      "entityType": "LTDA"
    },
    "summary": {
      "totalShares": 1000000,
      "totalShareholders": 8,
      "totalShareClasses": 2,
      "lastUpdated": "2024-01-20T10:00:00Z"
    },
    "entries": [
      {
        "shareholderId": "uuid",
        "shareholderName": "João Founder",
        "shareClass": "Quotas Ordinárias",
        "shareClassId": "uuid",
        "shares": 600000,
        "ownershipPercentage": 60.0,
        "votingPower": 600000,
        "votingPercentage": 60.0
      },
      {
        "shareholderId": "uuid",
        "shareholderName": "Investor ABC",
        "shareClass": "Quotas Preferenciais",
        "shareClassId": "uuid",
        "shares": 250000,
        "ownershipPercentage": 25.0,
        "votingPower": 0,
        "votingPercentage": 0.0
      }
    ],
    "blockchainSync": {
      "lastSyncAt": "2024-01-20T10:05:00Z",
      "stateHash": "0x...",
      "status": "SYNCED"
    }
  }
}
```

---

### GET /api/v1/companies/:companyId/cap-table/fully-diluted
**Description**: Get fully-diluted cap table (including all options)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSharesOutstanding": 1000000,
      "totalOptionsOutstanding": 150000,
      "fullyDilutedShares": 1150000
    },
    "entries": [
      {
        "shareholderId": "uuid",
        "shareholderName": "João Founder",
        "currentShares": 600000,
        "currentPercentage": 60.0,
        "optionsVested": 0,
        "optionsUnvested": 0,
        "fullyDilutedShares": 600000,
        "fullyDilutedPercentage": 52.17
      },
      {
        "shareholderId": "uuid",
        "shareholderName": "Employee Pool",
        "currentShares": 0,
        "currentPercentage": 0,
        "optionsVested": 75000,
        "optionsUnvested": 75000,
        "fullyDilutedShares": 150000,
        "fullyDilutedPercentage": 13.04
      }
    ]
  }
}
```

---

### GET /api/v1/companies/:companyId/cap-table/snapshot
**Description**: Get point-in-time cap table snapshot

**Query Parameters**:
- `date` (required): ISO 8601 date (e.g., `"2023-12-31"`)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "snapshotDate": "2023-12-31",
    "summary": {
      "totalShares": 850000,
      "totalShareholders": 6
    },
    "entries": [
      {
        "shareholderId": "uuid",
        "shareholderName": "João Founder",
        "shares": 600000,
        "ownershipPercentage": 70.59
      }
    ],
    "blockchainStateHash": "0x...",
    "blockNumber": 1234567
  }
}
```

---

### GET /api/v1/companies/:companyId/cap-table/history
**Description**: Get cap table history (all snapshots)

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "snapshotDate": "2024-01-20T10:00:00Z",
      "totalShares": 1000000,
      "totalShareholders": 8,
      "trigger": "SHARE_ISSUANCE",
      "notes": "Series A closing"
    },
    {
      "id": "uuid",
      "snapshotDate": "2023-12-31T23:59:59Z",
      "totalShares": 850000,
      "totalShareholders": 6,
      "trigger": "MANUAL_SNAPSHOT",
      "notes": "Year-end snapshot"
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

### GET /api/v1/companies/:companyId/cap-table/export/oct
**Description**: Export cap table in OCT JSON format

**Response** (200 OK):

Returns the raw OCT JSON file download with `Content-Type: application/json` and `Content-Disposition: attachment; filename="..."`. The OCT schema uses its own naming conventions (snake_case per OCT/OCF standard):

```json
{
  "ocf_version": "1.0.0",
  "issuer": {
    "id": "uuid",
    "legal_name": "Startup XYZ Ltda.",
    "entity_type": "LTDA",
    "jurisdiction": "BR"
  },
  "stock_classes": [],
  "stockholders": [],
  "stock_issuances": []
}
```

---

### POST /api/v1/companies/:companyId/cap-table/export
**Description**: Export cap table in PDF, XLSX, or CSV format

**Query Parameters**:
- `format` (required): `"pdf"`, `"xlsx"`, or `"csv"`
- `view` (optional): `"current"` (default), `"fully-diluted"`

**Response** (200 OK): File download with appropriate `Content-Type` and `Content-Disposition` headers.

---

### POST /api/v1/companies/:companyId/cap-table/snapshot
**Description**: Create manual cap table snapshot

**Request**:
```json
{
  "snapshotDate": "2024-01-20T23:59:59Z",
  "notes": "End of Q1 snapshot"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "snapshotDate": "2024-01-20T23:59:59Z",
    "totalShares": 1000000,
    "totalShareholders": 8,
    "createdAt": "2024-01-20T10:15:00Z"
  }
}
```

---

## Business Rules

### BR-1: Automatic Recalculation
- Ownership percentages MUST recalculate automatically after every transaction
- Voting percentages MUST recalculate when share class voting rights change
- Fully-diluted positions MUST recalculate when options are granted/exercised/cancelled

### BR-2: Total Ownership Validation
- Sum of all ownership percentages MUST equal 100% (within 0.01% rounding tolerance)
- If discrepancy detected, system MUST trigger recalculation
- Persistent discrepancies MUST alert admin

### BR-4: Snapshot Creation Triggers
- Automatic snapshot after every transaction
- Manual snapshot on user request
- Automatic snapshot at end of each month (scheduled)
- Automatic snapshot before major events (round closing, option grant batch)

### BR-5: OCT Compliance
- Cap table data MUST be exportable in valid OCT JSON format
- Brazilian share classes MUST map to OCT stock_class types
- Ltda. quotas map to OCT "COMMON" with custom fields
- S.A. preferred shares map to OCT "PREFERRED"

### BR-6: Historical Immutability
- Historical snapshots CANNOT be edited after creation
- Snapshots are immutable audit records
- Only metadata (notes) can be updated

### BR-7: Access Control by Role
- Investors can view full cap table if specified in shareholder agreement
- Otherwise, investors only see their own position
- Employees only see own position (never full cap table)
- Board members (if role exists) have full read access

---

## User Flows

### Flow 1: Admin Views Current Cap Table

```
PRECONDITION: Admin user logged in, company has shareholders

1. Admin navigates to "Cap Table" tab
2. System calls GET /api/v1/companies/:id/cap-table
3. Backend fetches cap table entries from database
4. Backend calculates current ownership percentages
5. System displays cap table with columns:
   - Shareholder Name
   - Share Class
   - Shares Owned
   - Ownership %
   - Voting Power
   - Voting %
6. System displays summary at top:
   - Total Shares: 1,000,000
   - Total Shareholders: 8
   - Last Updated: Jan 20, 2024 10:00 AM
7. System shows sync status badge: "Synced with blockchain"
8. Admin can toggle view: Current | Fully-Diluted | Authorized
9. Admin can filter by share class dropdown
10. Admin can export to PDF or OCT JSON

POSTCONDITION: Admin has current cap table view
```

### Flow 2: View Fully-Diluted Cap Table

```
PRECONDITION: Admin viewing cap table, option grants exist

1. Admin clicks "Fully-Diluted" toggle
2. System calls GET /api/v1/companies/:id/cap-table/fully-diluted
3. Backend calculates fully-diluted positions:
   - Add all vested options
   - Add all unvested options
   - Recalculate percentages with new denominator
4. System displays updated table showing:
   - Current Shares column
   - Vested Options column
   - Unvested Options column
   - Fully-Diluted Total column
   - Fully-Diluted % column
5. System highlights dilution in red:
   - João Founder: 60.0% -> 52.17% (-7.83%)
6. System shows summary:
   - Outstanding Shares: 1,000,000
   - Outstanding Options: 150,000
   - Fully-Diluted Total: 1,150,000

POSTCONDITION: Admin sees impact of option pool on ownership
```

### Flow 3: View Historical Cap Table

```
PRECONDITION: Admin viewing cap table

1. Admin clicks "History" button
2. System displays modal with snapshot list
3. System shows snapshots:
   - Jan 20, 2024 - Series A Closing (1M shares, 8 shareholders)
   - Dec 31, 2023 - Year-end snapshot (850K shares, 6 shareholders)
   - Jun 15, 2023 - Company founding (600K shares, 2 shareholders)
4. Admin selects "Dec 31, 2023"
5. System calls GET /api/v1/companies/:id/cap-table/snapshot?date=2023-12-31
6. System displays cap table as it existed on Dec 31:
   - João Founder: 600,000 shares (70.59%)
   - Maria Co-founder: 250,000 shares (29.41%)
   - Total: 850,000 shares
7. System shows banner: "Viewing cap table as of Dec 31, 2023"
8. Admin can export this historical snapshot
9. Admin clicks "Back to Current" to return

POSTCONDITION: Admin viewed historical cap table state
```

### Flow 4: Automatic Recalculation After Transaction

```
PRECONDITION: Admin just completed share issuance of 150K shares to new investor

1. Backend completes transaction on blockchain
2. Transaction confirmed on Base Network (block #1234567)
3. Backend event listener detects SharesIssued event
4. Backend updates CapTableEntry:
   - Creates new entry for investor (150K shares)
   - Updates company total_shares: 850K -> 1,000K
5. Backend triggers recalculation job:
   - João Founder: 600K / 1M = 60.0% (was 70.59%)
   - Maria Co-founder: 250K / 1M = 25.0% (was 29.41%)
   - New Investor: 150K / 1M = 15.0%
6. Backend creates automatic snapshot:
   - Date: transaction timestamp
   - Trigger: "share_issuance"
   - Blockchain hash: 0x...
7. Backend updates CapTable.last_updated timestamp
8. Frontend receives real-time update (via polling or webhook)
9. Frontend displays updated cap table
10. Frontend shows notification: "Cap table updated (Series A closing)"

POSTCONDITION: Cap table automatically reflects new ownership, snapshot created
```

### Flow 6: Export Cap Table in OCT Format

```
PRECONDITION: Admin viewing cap table

1. Admin clicks "Export" dropdown
2. Admin selects "OCT JSON Format"
3. System calls GET /api/v1/companies/:id/cap-table/export/oct
4. Backend generates OCT-compliant JSON:
   - Maps Brazilian share classes to OCT schema
   - Includes all stockholders with CPF/CNPJ
   - Includes all stock issuances
   - Adds OCT version and metadata
5. Backend validates JSON against OCT schema
6. System triggers file download: "StartupXYZ_CapTable_OCT_2024-01-20.json"
7. Admin saves file locally
8. Admin can import this into other OCT-compliant systems

POSTCONDITION: Cap table exported in OCT standard format
```

---

## Edge Cases & Error Handling

### EC-1: Ownership Percentages Don't Sum to 100%
**Scenario**: After recalculation, ownership sums to 99.98% due to rounding
**Handling**:
- Allow tolerance of +/-0.02%
- If outside tolerance, trigger recalculation with higher precision
- Log warning for admin review

### EC-4: Historical Snapshot Request for Future Date
**Scenario**: User requests snapshot for date="2025-12-31" (future)
**Handling**:
- Return 400 Bad Request
- Error message: "Cannot create snapshot for future date"

### EC-6: User Requests Very Old Snapshot (>5 years)
**Scenario**: User requests cap table from 2015, but company only created account in 2023
**Handling**:
- Return 404 Not Found
- Message: "No cap table data available for requested date"
- Show earliest available snapshot date

### EC-7: Zero Shareholders (Edge Case)
**Scenario**: Cap table query when no shareholders exist yet
**Handling**:
- Return empty cap table with summary:
  - Total Shares: 0
  - Total Shareholders: 0
- Display message: "No shareholders added yet. Add your first shareholder to get started."

---

## Frontend Implementation

### Routes

| Route | Page | Access |
|-------|------|--------|
| `/companies/[companyId]/cap-table` | Cap table dashboard (default: current view) | ADMIN, FINANCE, LEGAL, INVESTOR (restricted) |

The cap table is a single-page dashboard with view toggles, not separate pages. The URL query parameter `?view=current|fully-diluted|authorized` controls the active view. Historical snapshots open in a drawer overlay.

### Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  h1: Cap Table                            [Snapshot ▾] [Export ▾]  │
│  body-sm: Real-time equity ownership overview                       │
├─────────────────────────────────────────────────────────────────────┤
│  [Current]  [Fully-Diluted]  [Authorized]     🔍 Search  [Filter]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐│
│  │ Total Shares │ │ Shareholders │ │Share Classes  │ │ Last Sync  ││
│  │ 1.000.000    │ │ 8            │ │ 2            │ │ Synced ✓   ││
│  │              │ │              │ │              │ │ 5 min ago  ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘│
│                                                                     │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐   │
│  │  Ownership by Shareholder   │ │  Distribution by Class      │   │
│  │       (Donut Chart)         │ │       (Bar Chart)           │   │
│  │                             │ │                             │   │
│  │    ┌───┐                    │ │  ██████████  ON  60%        │   │
│  │   /  60% \  João            │ │  ████████    PN-A 25%       │   │
│  │  |  25%  |  Investor        │ │  ██████      PN-B 15%       │   │
│  │   \  15% /  Pool            │ │                             │   │
│  │    └───┘                    │ │                             │   │
│  │  Legend: • João • Inv • Pool│ │                             │   │
│  └─────────────────────────────┘ └─────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Shareholder  │ Share Class │   Shares  │  %     │ Voting  │   │
│  ├───────────────┼────────────┼───────────┼────────┼─────────┤   │
│  │  João Founder │ ON         │   600.000 │ 60,00% │ 600.000 │   │
│  │  Investor ABC │ PN-A       │   250.000 │ 25,00% │       0 │   │
│  │  ESOP Pool    │ ON         │   150.000 │ 15,00% │ 150.000 │   │
│  ├───────────────┼────────────┼───────────┼────────┼─────────┤   │
│  │  TOTAL        │            │ 1.000.000 │100,00% │ 750.000 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⛓ Blockchain: Synced  │  Last sync: 20/01/2024 10:05     │   │
│  │  State hash: 0x1a2b...  │  Block: #1.234.567              │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### View Toggle Behavior

| View | Data Source | Extra Columns | Description |
|------|-----------|---------------|-------------|
| **Current** (default) | `GET /cap-table?view=current` | Shares, %, Voting Power, Voting % | Actual issued shares |
| **Fully-Diluted** | `GET /cap-table?view=fully-diluted` | Current Shares, Options Vested, Options Unvested, FD Shares, FD % | Includes all options |
| **Authorized** | `GET /cap-table?view=authorized` | Authorized, Issued, Available, % Issued | Per share class authorized vs issued |

### Fully-Diluted View (Extra Columns)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Shareholder  │ Current  │ Curr % │ Vested │ Unvested │ FD Total │  FD %  │
├───────────────┼──────────┼────────┼────────┼──────────┼──────────┼────────┤
│  João Founder │  600.000 │ 60,00% │      0 │        0 │  600.000 │ 52,17% │
│  Investor ABC │  250.000 │ 25,00% │      0 │        0 │  250.000 │ 21,74% │
│  ESOP Pool    │        0 │  0,00% │ 75.000 │   75.000 │  150.000 │ 13,04% │
│  ─── dilution indicator: João 60,00% → 52,17% (▼ 7,83%)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

Dilution indicators show `▼ X,XX%` in destructive red next to shareholders whose percentage decreased.

### Stat Cards

| Card | Value | Subtitle | Active (highlighted) |
|------|-------|----------|---------------------|
| Total Shares | `summary.totalShares` formatted Brazilian | — | Yes (blue bg) |
| Shareholders | `summary.totalShareholders` | — | No |
| Share Classes | `summary.totalShareClasses` | — | No |
| Blockchain Sync | Status badge (SYNCED/SYNCING/ERROR) | Time since last sync | No |

Stat card for blockchain sync shows:
- `SYNCED` → green badge, "X min ago"
- `SYNCING` → cream/warning badge with spinner
- `ERROR` → red badge, "Sync failed — Retry" link

### Charts (Recharts)

**Ownership Donut Chart** (left card):
- Donut style, inner radius 60%
- Center label: "100%" or total share count
- Color palette: `chart-1` through `chart-8` (see design-system.md §8.2)
- Legend: right side, color dot + shareholder name + percentage
- Click segment → navigate to shareholder detail
- Group shareholders with < 3% into "Others" segment

**Distribution Bar Chart** (right card):
- Horizontal bars, one per share class
- Bar fill: sequential chart colors
- Label on bar: share class name + percentage
- Y-axis: share class names
- X-axis: percentage (0–100%)

### Data Table

**Columns (Current View)**:

| Column | Type | Sortable | Alignment |
|--------|------|----------|-----------|
| Shareholder | Text (name + type badge) | Yes | Left |
| Share Class | Text (class name + type badge) | Yes | Left |
| Shares | Number (Brazilian format) | Yes | Right |
| Ownership % | Percentage (Brazilian format, 2 decimals) | Yes (default desc) | Right |
| Voting Power | Number (Brazilian format) | Yes | Right |
| Voting % | Percentage (Brazilian format, 2 decimals) | Yes | Right |

**Summary Row**: Pinned at table bottom with `gray-100` background, bold text. Shows "TOTAL" label, sum of shares, "100,00%", sum of voting power, "100,00%".

**Table Features**:
- Sort by clicking column headers (default: ownership % descending)
- Filter by share class via dropdown above table
- Search by shareholder name
- Click row → navigate to shareholder detail page
- Empty state: illustration + "No shareholders added yet. Add your first shareholder to get started." + CTA button

### Snapshot History Drawer

Triggered by "Snapshot" dropdown → "View History". Opens as a right-side drawer:

```
┌──────────────────────────────────┐
│  Snapshot History           [X]  │
│                                  │
│  ┌────────────────────────────┐  │
│  │ 📸 20/01/2024 10:00       │  │
│  │ Series A closing           │  │
│  │ 1.000.000 shares • 8 sh.  │  │
│  │ Trigger: SHARE_ISSUANCE   │  │
│  │                   [View]  │  │
│  └────────────────────────────┘  │
│  ┌────────────────────────────┐  │
│  │ 📸 31/12/2023 23:59       │  │
│  │ Year-end snapshot          │  │
│  │ 850.000 shares • 6 sh.    │  │
│  │ Trigger: MANUAL_SNAPSHOT  │  │
│  │                   [View]  │  │
│  └────────────────────────────┘  │
│                                  │
│  [+ Create Manual Snapshot]      │
└──────────────────────────────────┘
```

Clicking "View" on a snapshot replaces the main cap table content with the historical data and shows a **historical banner**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠ Viewing cap table as of 31/12/2023  │  [← Back to Current]     │
│  Blockchain hash: 0x1a2b... • Block: #1.234.567                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Create Snapshot Dialog

Triggered by "Snapshot" dropdown → "Create Snapshot" or the button in the history drawer:

```
┌──────────────────────────────────────┐
│  Create Manual Snapshot              │
│                                      │
│  Snapshot Date *                     │
│  ┌──────────────────────────────┐    │
│  │ 20/01/2024                   │    │
│  └──────────────────────────────┘    │
│                                      │
│  Notes (optional)                    │
│  ┌──────────────────────────────┐    │
│  │ End of Q1 snapshot           │    │
│  └──────────────────────────────┘    │
│                                      │
│  ℹ Snapshots are immutable and       │
│    cannot be edited after creation.  │
│                                      │
│           [Cancel]  [Create Snapshot]│
└──────────────────────────────────────┘
```

### Export Dialog

Triggered by "Export" dropdown. Shows format options:

```
┌──────────────────────────────────────┐
│  Export Cap Table                     │
│                                      │
│  Format                              │
│  ○ PDF  — Formatted report           │
│  ○ Excel (.xlsx) — Spreadsheet       │
│  ○ CSV  — Raw data                   │
│  ○ OCT JSON — Open Cap Table format  │
│                                      │
│  View                                │
│  ○ Current  ○ Fully-Diluted          │
│                                      │
│             [Cancel]  [Export]        │
└──────────────────────────────────────┘
```

- PDF: calls `POST /cap-table/export?format=pdf`
- XLSX: calls `POST /cap-table/export?format=xlsx`
- CSV: calls `POST /cap-table/export?format=csv`
- OCT JSON: calls `GET /cap-table/export/oct`

All downloads trigger browser file save dialog.

### Access Control by Role

| Element | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|---------|-------|---------|-------|----------|----------|
| View current cap table | Full | Full | Full | Full or own only* | Own only |
| View fully-diluted | Yes | Yes | Yes | Yes* | No |
| View historical snapshots | Yes | Yes | Yes | No | No |
| Create manual snapshot | Yes | No | No | No | No |
| Export (all formats) | Yes | Yes | Yes | PDF only* | No |
| View blockchain sync | Yes | Yes | Yes | No | No |

*Investor access depends on shareholder agreement settings per BR-7.

Employees see a simplified view showing only their own holdings (shares, percentage, vesting if applicable). No charts, no other shareholders.

### Zod Schemas

```typescript
import { z } from 'zod';

// Create manual snapshot
export const createSnapshotSchema = z.object({
  snapshotDate: z.string().datetime({ message: 'errors.val.invalidDate' }),
  notes: z.string().max(500).optional(),
});

// Cap table query params
export const capTableQuerySchema = z.object({
  view: z.enum(['current', 'fully-diluted', 'authorized']).default('current'),
  shareClassId: z.string().uuid().optional(),
});

// Snapshot history query params
export const snapshotHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Export params
export const capTableExportSchema = z.object({
  format: z.enum(['pdf', 'xlsx', 'csv']),
  view: z.enum(['current', 'fully-diluted']).default('current'),
});
```

### TanStack Query Hooks

```typescript
// GET /companies/:companyId/cap-table?view=current|fully-diluted|authorized
export function useCapTable(companyId: string, params?: {
  view?: 'current' | 'fully-diluted' | 'authorized';
  shareClassId?: string;
}) {
  const query = new URLSearchParams();
  if (params?.view) query.set('view', params.view);
  if (params?.shareClassId) query.set('shareClassId', params.shareClassId);

  return useQuery({
    queryKey: ['cap-table', companyId, params],
    queryFn: () => api.get(`/api/v1/companies/${companyId}/cap-table?${query}`),
    refetchInterval: 30_000, // Poll every 30s for real-time updates
  });
}

// GET /companies/:companyId/cap-table/snapshot?date=YYYY-MM-DD
export function useCapTableSnapshot(companyId: string, date: string | null) {
  return useQuery({
    queryKey: ['cap-table-snapshot', companyId, date],
    queryFn: () => api.get(`/api/v1/companies/${companyId}/cap-table/snapshot?date=${date}`),
    enabled: !!date,
  });
}

// GET /companies/:companyId/cap-table/history
export function useCapTableHistory(companyId: string, params?: {
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  return useQuery({
    queryKey: ['cap-table-history', companyId, params],
    queryFn: () => api.getList(`/api/v1/companies/${companyId}/cap-table/history?${query}`),
  });
}

// POST /companies/:companyId/cap-table/snapshot
export function useCreateSnapshot(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { snapshotDate: string; notes?: string }) =>
      api.post(`/api/v1/companies/${companyId}/cap-table/snapshot`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cap-table-history', companyId] });
    },
  });
}

// GET /companies/:companyId/cap-table/export/oct (file download)
export function useExportOCT(companyId: string) {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/companies/${companyId}/cap-table/export/oct`);
      const blob = await res.blob();
      return blob;
    },
  });
}

// POST /companies/:companyId/cap-table/export (PDF/XLSX/CSV file download)
export function useExportCapTable(companyId: string) {
  return useMutation({
    mutationFn: async (params: { format: 'pdf' | 'xlsx' | 'csv'; view?: string }) => {
      const query = new URLSearchParams({ format: params.format });
      if (params.view) query.set('view', params.view);
      const res = await fetch(`/api/v1/companies/${companyId}/cap-table/export?${query}`);
      const blob = await res.blob();
      return blob;
    },
  });
}
```

### Component Hierarchy

```
app/(dashboard)/companies/[companyId]/cap-table/
  page.tsx                          ← CapTablePage (main page, manages view state)
  _components/
    CapTableHeader.tsx              ← Page title + Snapshot dropdown + Export dropdown
    ViewToggle.tsx                  ← Current | Fully-Diluted | Authorized tabs
    CapTableStats.tsx               ← 4 stat cards row
    CapTableCharts.tsx              ← Charts container (2-column grid)
      OwnershipDonutChart.tsx       ← Recharts donut by shareholder
      ClassDistributionBarChart.tsx ← Recharts horizontal bar by share class
    CapTableDataTable.tsx           ← Main data table with sort/filter
      CapTableSummaryRow.tsx        ← Pinned totals row
    FullyDilutedTable.tsx           ← Extended table for FD view
      DilutionIndicator.tsx         ← ▼ X,XX% red indicator
    AuthorizedTable.tsx             ← Authorized vs issued per class
    BlockchainSyncFooter.tsx        ← Sync status bar at bottom
    HistoricalBanner.tsx            ← Yellow banner when viewing snapshot
    SnapshotHistoryDrawer.tsx       ← Right-side drawer with snapshot list
      SnapshotCard.tsx              ← Individual snapshot in list
    CreateSnapshotDialog.tsx        ← Modal form for manual snapshot
    ExportDialog.tsx                ← Modal with format/view selection
    CapTableEmptyState.tsx          ← Shown when no shareholders exist
    EmployeeOwnPositionView.tsx     ← Simplified view for EMPLOYEE role
```

### i18n Keys

**PT-BR** (`messages/pt-BR.json`):
```json
{
  "capTable": {
    "title": "Cap Table",
    "description": "Visão geral em tempo real da distribuição acionária",
    "views": {
      "current": "Atual",
      "fullyDiluted": "Totalmente Diluído",
      "authorized": "Autorizado"
    },
    "stats": {
      "totalShares": "Total de Ações",
      "shareholders": "Acionistas",
      "shareClasses": "Classes de Ações",
      "blockchainSync": "Blockchain"
    },
    "sync": {
      "synced": "Sincronizado",
      "syncing": "Sincronizando...",
      "error": "Erro de sincronização",
      "lastSync": "Última sincronização",
      "retry": "Tentar novamente",
      "minutesAgo": "há {minutes} min",
      "stateHash": "Hash de estado",
      "block": "Bloco"
    },
    "charts": {
      "ownershipTitle": "Participação por Acionista",
      "distributionTitle": "Distribuição por Classe",
      "others": "Outros"
    },
    "table": {
      "shareholder": "Acionista",
      "shareClass": "Classe de Ações",
      "shares": "Ações",
      "ownership": "Participação %",
      "votingPower": "Poder de Voto",
      "votingPercentage": "Voto %",
      "total": "TOTAL",
      "empty": "Nenhum acionista cadastrado ainda.",
      "emptyAction": "Adicione seu primeiro acionista para começar.",
      "search": "Buscar acionista...",
      "filterByClass": "Filtrar por classe"
    },
    "fullyDiluted": {
      "currentShares": "Ações Atuais",
      "currentPercentage": "% Atual",
      "optionsVested": "Opções Adquiridas",
      "optionsUnvested": "Opções Não Adquiridas",
      "fdShares": "Total Diluído",
      "fdPercentage": "% Diluído",
      "dilution": "Diluição",
      "summary": {
        "outstanding": "Ações Emitidas",
        "options": "Opções em Aberto",
        "total": "Total Diluído"
      }
    },
    "authorized": {
      "authorized": "Autorizado",
      "issued": "Emitido",
      "available": "Disponível",
      "percentIssued": "% Emitido"
    },
    "snapshot": {
      "title": "Histórico de Snapshots",
      "create": "Criar Snapshot",
      "viewHistory": "Ver Histórico",
      "date": "Data do Snapshot",
      "notes": "Notas (opcional)",
      "notesPlaceholder": "Ex: Fechamento do trimestre",
      "immutableWarning": "Snapshots são imutáveis e não podem ser editados após a criação.",
      "trigger": {
        "SHARE_ISSUANCE": "Emissão de Ações",
        "SHARE_TRANSFER": "Transferência",
        "SHARE_CANCELLATION": "Cancelamento",
        "MANUAL_SNAPSHOT": "Snapshot Manual",
        "MONTHLY_AUTO": "Automático Mensal",
        "ROUND_CLOSE": "Fechamento de Rodada"
      },
      "shares": "ações",
      "shareholders": "acionistas"
    },
    "historical": {
      "banner": "Visualizando cap table em {date}",
      "backToCurrent": "← Voltar ao Atual",
      "blockchainHash": "Hash blockchain",
      "blockNumber": "Bloco"
    },
    "export": {
      "title": "Exportar Cap Table",
      "format": "Formato",
      "pdf": "PDF — Relatório formatado",
      "xlsx": "Excel (.xlsx) — Planilha",
      "csv": "CSV — Dados brutos",
      "oct": "OCT JSON — Open Cap Table",
      "view": "Visualização",
      "button": "Exportar",
      "downloading": "Baixando..."
    },
    "employee": {
      "title": "Minha Participação",
      "description": "Suas ações e participação na empresa",
      "shares": "Suas Ações",
      "ownership": "Sua Participação",
      "shareClass": "Classe",
      "noHoldings": "Você ainda não possui ações nesta empresa."
    }
  }
}
```

**EN** (`messages/en.json`):
```json
{
  "capTable": {
    "title": "Cap Table",
    "description": "Real-time equity ownership overview",
    "views": {
      "current": "Current",
      "fullyDiluted": "Fully Diluted",
      "authorized": "Authorized"
    },
    "stats": {
      "totalShares": "Total Shares",
      "shareholders": "Shareholders",
      "shareClasses": "Share Classes",
      "blockchainSync": "Blockchain"
    },
    "sync": {
      "synced": "Synced",
      "syncing": "Syncing...",
      "error": "Sync error",
      "lastSync": "Last sync",
      "retry": "Retry",
      "minutesAgo": "{minutes} min ago",
      "stateHash": "State hash",
      "block": "Block"
    },
    "charts": {
      "ownershipTitle": "Ownership by Shareholder",
      "distributionTitle": "Distribution by Class",
      "others": "Others"
    },
    "table": {
      "shareholder": "Shareholder",
      "shareClass": "Share Class",
      "shares": "Shares",
      "ownership": "Ownership %",
      "votingPower": "Voting Power",
      "votingPercentage": "Voting %",
      "total": "TOTAL",
      "empty": "No shareholders added yet.",
      "emptyAction": "Add your first shareholder to get started.",
      "search": "Search shareholder...",
      "filterByClass": "Filter by class"
    },
    "fullyDiluted": {
      "currentShares": "Current Shares",
      "currentPercentage": "Current %",
      "optionsVested": "Options Vested",
      "optionsUnvested": "Options Unvested",
      "fdShares": "FD Total",
      "fdPercentage": "FD %",
      "dilution": "Dilution",
      "summary": {
        "outstanding": "Outstanding Shares",
        "options": "Outstanding Options",
        "total": "Fully Diluted Total"
      }
    },
    "authorized": {
      "authorized": "Authorized",
      "issued": "Issued",
      "available": "Available",
      "percentIssued": "% Issued"
    },
    "snapshot": {
      "title": "Snapshot History",
      "create": "Create Snapshot",
      "viewHistory": "View History",
      "date": "Snapshot Date",
      "notes": "Notes (optional)",
      "notesPlaceholder": "E.g., End of quarter",
      "immutableWarning": "Snapshots are immutable and cannot be edited after creation.",
      "trigger": {
        "SHARE_ISSUANCE": "Share Issuance",
        "SHARE_TRANSFER": "Transfer",
        "SHARE_CANCELLATION": "Cancellation",
        "MANUAL_SNAPSHOT": "Manual Snapshot",
        "MONTHLY_AUTO": "Monthly Auto",
        "ROUND_CLOSE": "Round Close"
      },
      "shares": "shares",
      "shareholders": "shareholders"
    },
    "historical": {
      "banner": "Viewing cap table as of {date}",
      "backToCurrent": "← Back to Current",
      "blockchainHash": "Blockchain hash",
      "blockNumber": "Block"
    },
    "export": {
      "title": "Export Cap Table",
      "format": "Format",
      "pdf": "PDF — Formatted report",
      "xlsx": "Excel (.xlsx) — Spreadsheet",
      "csv": "CSV — Raw data",
      "oct": "OCT JSON — Open Cap Table",
      "view": "View",
      "button": "Export",
      "downloading": "Downloading..."
    },
    "employee": {
      "title": "My Holdings",
      "description": "Your shares and ownership in the company",
      "shares": "Your Shares",
      "ownership": "Your Ownership",
      "shareClass": "Class",
      "noHoldings": "You don't own any shares in this company yet."
    }
  }
}
```

---

## Dependencies

### Internal Dependencies
- **Shareholders**: Cap table displays shareholder names and details
- **Share Classes**: Cap table calculates voting power from share class rights
- **Transactions**: Every transaction triggers cap table recalculation
- **Blockchain Integration**: Cap table syncs from on-chain OCP contracts
- **Option Plans**: Fully-diluted view includes option pool data

### External Dependencies
- **Base Network**: L2 blockchain for on-chain cap table state
- **OCP Smart Contracts**: On-chain equity records
- **Privy**: Admin wallet for submitting transactions
- **RPC Provider**: Base Network node access (Alchemy/Infura/native)

---

## Technical Implementation

### Cap Table Service

```typescript
// /backend/src/cap-table/cap-table.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class CapTableService {
  constructor(private prisma: PrismaService) {}

  async getCurrentCapTable(companyId: string) {
    // Fetch all cap table entries
    const entries = await this.prisma.capTableEntry.findMany({
      where: { cap_table: { company_id: companyId } },
      include: {
        shareholder: true,
        share_class: true,
      },
    });

    // Get company total shares
    const capTable = await this.prisma.capTable.findUnique({
      where: { company_id: companyId },
    });

    // Calculate ownership percentages
    const enrichedEntries = entries.map((entry) => {
      const ownershipPct = new Decimal(entry.shares)
        .div(capTable.total_shares)
        .mul(100)
        .toDecimalPlaces(2)
        .toNumber();

      const votingPower = new Decimal(entry.shares)
        .mul(entry.share_class.votes_per_share)
        .toNumber();

      return {
        shareholder_id: entry.shareholder_id,
        shareholder_name: entry.shareholder.legal_name,
        share_class: entry.share_class.name,
        shares: entry.shares,
        ownership_percentage: ownershipPct,
        voting_power: votingPower,
      };
    });

    return {
      summary: {
        total_shares: capTable.total_shares,
        total_shareholders: entries.length,
        last_updated: capTable.last_updated,
      },
      entries: enrichedEntries,
    };
  }

  async recalculateOwnership(capTableId: string) {
    // Get all entries
    const entries = await this.prisma.capTableEntry.findMany({
      where: { cap_table_id: capTableId },
      include: { cap_table: true, share_class: true },
    });

    const totalShares = entries.reduce((sum, e) => sum + e.shares, 0);

    // Update each entry with new percentage
    for (const entry of entries) {
      const newPercentage = new Decimal(entry.shares)
        .div(totalShares)
        .mul(100)
        .toDecimalPlaces(4)
        .toNumber();

      const votingPower = new Decimal(entry.shares)
        .mul(entry.share_class.votes_per_share)
        .toNumber();

      await this.prisma.capTableEntry.update({
        where: { id: entry.id },
        data: {
          percentage: newPercentage,
          voting_power: votingPower,
        },
      });
    }

    // Update cap table total
    await this.prisma.capTable.update({
      where: { id: capTableId },
      data: {
        total_shares: totalShares,
        last_updated: new Date(),
      },
    });
  }

  async createSnapshot(capTableId: string, notes?: string) {
    const capTable = await this.prisma.capTable.findUnique({
      where: { id: capTableId },
      include: {
        entries: {
          include: {
            shareholder: true,
            share_class: true,
          },
        },
      },
    });

    // Create OCT-format snapshot
    const octData = this.convertToOCTFormat(capTable);

    const snapshot = await this.prisma.historicalSnapshot.create({
      data: {
        cap_table_id: capTableId,
        snapshot_date: new Date(),
        oct_data: octData,
        blockchain_state_hash: capTable.blockchain_state_hash,
        notes: notes,
      },
    });

    return snapshot;
  }

  private convertToOCTFormat(capTable: any): any {
    // Convert to OCT JSON schema
    return {
      ocf_version: '1.0.0',
      issuer: {
        id: capTable.company_id,
        legal_name: capTable.company.name,
        entity_type: capTable.company.entity_type,
        jurisdiction: 'BR',
      },
      stock_classes: capTable.entries.map((e) => ({
        id: e.share_class.id,
        class_type: e.share_class.type,
        name: e.share_class.name,
        votes_per_share: e.share_class.votes_per_share,
      })),
      stockholders: capTable.entries.map((e) => ({
        id: e.shareholder.id,
        name: e.shareholder.legal_name,
        taxpayer_id: e.shareholder.cpf_cnpj,
        country_code: e.shareholder.nationality,
      })),
      stock_issuances: capTable.entries.map((e) => ({
        id: e.id,
        stock_class_id: e.share_class_id,
        stockholder_id: e.shareholder_id,
        quantity: e.shares,
        date: e.acquired_at.toISOString(),
      })),
    };
  }
}
```

### Real-Time Recalculation Job

```typescript
// /backend/src/cap-table/jobs/recalculation.processor.ts

import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { CapTableService } from '../cap-table.service';

@Processor('cap-table')
export class CapTableRecalculationProcessor {
  constructor(private capTableService: CapTableService) {}

  @Process('recalculate')
  async handleRecalculation(job: Job<{ capTableId: string }>) {
    const { capTableId } = job.data;

    // Recalculate ownership percentages
    await this.capTableService.recalculateOwnership(capTableId);

    // Create automatic snapshot
    await this.capTableService.createSnapshot(capTableId, 'Automatic snapshot after transaction');

    return { success: true };
  }
}
```

---

## Security Considerations

### SEC-1: Cap Table Access Control
- Enforce role-based access at API level
- Investors can only view cap table if granted in shareholder agreement
- Log all cap table views for audit trail

### SEC-2: Historical Snapshot Immutability
- Historical snapshots are read-only after creation
- Prevent tampering with historical records
- Store blockchain state hash for verification

### SEC-3: OCT Export Privacy
- Mask sensitive data (CPF/CNPJ) in exports if required
- Log all export events (who, when, format)
- Consider watermarking exported files

---

## Success Criteria

### Performance
- Cap table loads in < 2 seconds for 500 shareholders
- Ownership recalculation completes in < 5 seconds
- Historical snapshot creation in < 3 seconds

### Accuracy
- 100% accuracy in ownership calculations (no rounding errors)
- Ownership percentages sum to 100% (+/-0.01% tolerance)

### Reliability
- 99.9% uptime for cap table views

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [cap-table-reconciliation.md](./cap-table-reconciliation.md) | Blockchain reconciliation: verifying off-chain cap table matches on-chain records |
| [shareholder-registry.md](./shareholder-registry.md) | Shareholders are the rows in the cap table; shareholdings represent ownership positions |
| [share-classes.md](./share-classes.md) | Share classes define the columns in the cap table; authorized vs issued tracking |
| [transactions.md](./transactions.md) | Transactions trigger cap table recalculation; issuances, transfers, and cancellations change ownership |
| [blockchain-integration.md](./blockchain-integration.md) | On-chain reconciliation verifies cap table accuracy against smart contract state |
| [funding-rounds.md](./funding-rounds.md) | Round closes create issuance transactions affecting cap table; pro-forma modeling |
| [convertible-conversion.md](./convertible-conversion.md) | Conversions create new shareholdings and update cap table |
| [option-plans.md](./option-plans.md) | Option pools included in fully-diluted cap table view |
| [reports-analytics.md](./reports-analytics.md) | Reports read cap table data for ownership breakdowns, waterfall analysis, and exports |
| [company-management.md](./company-management.md) | Cap table is scoped to a company; company status affects cap table operations |
| [api-standards.md](../.claude/rules/api-standards.md) | API endpoints follow `/api/v1/companies/:companyId/cap-table` pattern with envelope responses |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: `CAP_INSUFFICIENT_SHARES`, `CAP_NEGATIVE_BALANCE`, `CAP_SNAPSHOT_NOT_FOUND`, `CAP_SHARE_CLASS_NOT_FOUND`, `CAP_SHARE_CLASS_IN_USE` |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: `CAP_TABLE_SNAPSHOT_CREATED`, `CAP_TABLE_EXPORTED` |
