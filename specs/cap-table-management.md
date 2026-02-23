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
  company_id: string;                  // Foreign key to Company (unique)

  // Current State
  total_shares: number;                // Total authorized and issued shares
  total_shareholders: number;          // Count of active shareholders
  last_updated: Date;                  // Last transaction date

  // Blockchain Integration
  blockchain_state_hash: string;       // Hash of on-chain state for verification
  last_sync_at: Date;                  // Last sync with blockchain

  // OCT Compliance
  oct_data: OCTCapTable;               // Full OCT-format cap table

  // Metadata
  created_at: Date;
  updated_at: Date;
}
```

### CapTableEntry Entity

```typescript
interface CapTableEntry {
  id: string;                          // UUID
  cap_table_id: string;                // Foreign key to CapTable
  shareholder_id: string;              // Foreign key to Shareholder
  share_class_id: string;              // Foreign key to ShareClass

  // Ownership
  shares: number;                      // Number of shares owned
  percentage: number;                  // Ownership percentage of company
  voting_power: number;                // Total votes (shares x votes_per_share)

  // Acquisition
  acquired_at: Date;                   // Date of acquisition
  cost_basis: number | null;           // Price per share paid

  // Metadata
  updated_at: Date;
}
```

### HistoricalSnapshot Entity

```typescript
interface HistoricalSnapshot {
  id: string;                          // UUID
  cap_table_id: string;                // Foreign key to CapTable
  snapshot_date: Date;                 // Date of this snapshot

  // Snapshot Data
  oct_data: OCTCapTable;               // Full OCT-format cap table at this date
  entries: CapTableEntry[];            // All cap table entries at this date

  // Blockchain
  blockchain_state_hash: string;       // On-chain state hash at snapshot time
  block_number: number;                // Blockchain block number

  // Metadata
  created_at: Date;
  created_by: string;                  // User ID who created snapshot
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
- `view` (optional): "current" (default), "fully-diluted", or "authorized"
- `share_class_id` (optional): Filter by specific share class

**Response** (200 OK):
```json
{
  "company": {
    "id": "uuid",
    "name": "Startup XYZ Ltda.",
    "entity_type": "LTDA"
  },
  "summary": {
    "total_shares": 1000000,
    "total_shareholders": 8,
    "total_share_classes": 2,
    "last_updated": "2024-01-20T10:00:00Z"
  },
  "entries": [
    {
      "shareholder_id": "uuid",
      "shareholder_name": "João Founder",
      "share_class": "Quotas Ordinárias",
      "shares": 600000,
      "ownership_percentage": 60.0,
      "voting_power": 600000,
      "voting_percentage": 60.0
    },
    {
      "shareholder_id": "uuid",
      "shareholder_name": "Investor ABC",
      "share_class": "Quotas Preferenciais",
      "shares": 250000,
      "ownership_percentage": 25.0,
      "voting_power": 0,
      "voting_percentage": 0.0
    }
  ],
  "blockchain_sync": {
    "last_sync_at": "2024-01-20T10:05:00Z",
    "state_hash": "0x...",
    "status": "synced"
  }
}
```

---

### GET /api/v1/companies/:companyId/cap-table/fully-diluted
**Description**: Get fully-diluted cap table (including all options)

**Response** (200 OK):
```json
{
  "summary": {
    "total_shares_outstanding": 1000000,
    "total_options_outstanding": 150000,
    "fully_diluted_shares": 1150000
  },
  "entries": [
    {
      "shareholder_name": "João Founder",
      "current_shares": 600000,
      "current_percentage": 60.0,
      "options_vested": 0,
      "options_unvested": 0,
      "fully_diluted_shares": 600000,
      "fully_diluted_percentage": 52.17
    },
    {
      "shareholder_name": "Employee Pool",
      "current_shares": 0,
      "current_percentage": 0,
      "options_vested": 75000,
      "options_unvested": 75000,
      "fully_diluted_shares": 150000,
      "fully_diluted_percentage": 13.04
    }
  ]
}
```

---

### GET /api/v1/companies/:companyId/cap-table/snapshot
**Description**: Get point-in-time cap table snapshot

**Query Parameters**:
- `date` (required): ISO 8601 date (e.g., "2023-12-31")

**Response** (200 OK):
```json
{
  "snapshot_date": "2023-12-31",
  "summary": {
    "total_shares": 850000,
    "total_shareholders": 6
  },
  "entries": [
    {
      "shareholder_name": "João Founder",
      "shares": 600000,
      "ownership_percentage": 70.59
    }
  ],
  "blockchain_state_hash": "0x...",
  "block_number": 1234567
}
```

---

### GET /api/v1/companies/:companyId/cap-table/history
**Description**: Get cap table history (all snapshots)

**Response** (200 OK):
```json
{
  "snapshots": [
    {
      "id": "uuid",
      "snapshot_date": "2024-01-20T10:00:00Z",
      "total_shares": 1000000,
      "total_shareholders": 8,
      "trigger": "share_issuance",
      "notes": "Series A closing"
    },
    {
      "id": "uuid",
      "snapshot_date": "2023-12-31T23:59:59Z",
      "total_shares": 850000,
      "total_shareholders": 6,
      "trigger": "manual_snapshot",
      "notes": "Year-end snapshot"
    }
  ]
}
```

---

### GET /api/v1/companies/:companyId/cap-table/export/oct
**Description**: Export cap table in OCT JSON format

**Response** (200 OK):
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

### POST /api/v1/companies/:companyId/cap-table/snapshot
**Description**: Create manual cap table snapshot

**Request**:
```json
{
  "snapshot_date": "2024-01-20T23:59:59Z",
  "notes": "End of Q1 snapshot"
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "snapshot_date": "2024-01-20T23:59:59Z",
  "total_shares": 1000000,
  "total_shareholders": 8,
  "created_at": "2024-01-20T10:15:00Z"
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
