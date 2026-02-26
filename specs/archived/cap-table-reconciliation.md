# Cap Table Reconciliation Specification

**Topic of Concern**: Cap table reconciliation with on-chain blockchain data

**One-Sentence Description**: The system provides automated and on-demand reconciliation between off-chain cap table records and on-chain smart contract state on Base Network, ensuring data integrity and detecting discrepancies.

---

## Overview

Cap table reconciliation ensures that the off-chain database (the primary source for fast reads and UI rendering) accurately mirrors the on-chain state stored in OCP smart contracts on Base Network. The on-chain data is the authoritative source of truth for share ownership. Reconciliation can be triggered automatically (daily scheduled job, discrepancy detection during reads) or manually (admin-initiated). When discrepancies are found, the system automatically syncs from blockchain and alerts the admin.

This specification covers:
- On-chain synchronization mechanisms (event-driven + scheduled + on-demand)
- Discrepancy detection and resolution
- Blockchain reorg handling
- Admin reconciliation workflows

For cap table views, calculations, snapshots, and exports, see [cap-table-management.md](./cap-table-management.md).

---

## User Stories

### US-5: Cap Table Reconciliation
**As an** admin user
**I want to** reconcile on-chain and off-chain cap table data
**So that** I can verify data integrity and detect any discrepancies

---

## Functional Requirements

### FR-6: On-Chain Synchronization
- System MUST sync cap table state from Base Network smart contracts via event-driven listeners
- System MUST detect on-chain state changes via event monitoring (primary sync mechanism)
- System MUST handle blockchain reorgs gracefully
- System MUST run a daily scheduled reconciliation job to cross-check on-chain vs off-chain state
- System MUST support on-demand reconciliation triggered by admin
- System MUST auto-trigger reconciliation if a discrepancy is detected during normal reads

---

## API Endpoints

### POST /api/v1/companies/:companyId/cap-table/reconcile
**Description**: Manually trigger cap table reconciliation with blockchain

**Response** (200 OK — no discrepancies):
```json
{
  "status": "success",
  "discrepancies": [],
  "last_sync_at": "2024-01-20T10:10:00Z",
  "blockchain_state_hash": "0x..."
}
```

**Response** (200 OK — discrepancies found and resolved):
```json
{
  "status": "discrepancies_found",
  "discrepancies": [
    {
      "shareholder_name": "João Founder",
      "share_class": "Quotas",
      "on_chain_shares": 600000,
      "off_chain_shares": 600000,
      "difference": 0
    }
  ],
  "resolution": "automatic_sync_completed"
}
```

---

## Business Rules

### BR-3: Blockchain as Source of Truth
- On-chain data is authoritative for share ownership
- Off-chain database mirrors on-chain state for performance
- Primary sync is event-driven: blockchain event listeners update off-chain state in real-time after each confirmed transaction
- A daily scheduled reconciliation job runs a full cross-check of on-chain vs off-chain state for all active companies
- Admin can trigger on-demand reconciliation via the reconcile endpoint
- If a discrepancy is detected during any read operation, the system MUST auto-trigger reconciliation for that company
- Discrepancies trigger automatic sync from blockchain (source of truth) and alert admin via email

---

## User Flows

### Flow 5: Reconcile Cap Table with Blockchain

```
PRECONDITION: Admin suspects discrepancy between off-chain and on-chain data

1. Admin clicks "Reconcile" button on cap table page
2. System displays confirmation: "This will sync cap table with blockchain. Continue?"
3. Admin clicks "Yes, Reconcile"
4. System calls POST /api/v1/companies/:id/cap-table/reconcile
5. Backend fetches on-chain state from Base Network smart contract
6. Backend compares on-chain vs off-chain for each shareholder:
   - João: On-chain 600K = Off-chain 600K (match)
   - Maria: On-chain 250K = Off-chain 250K (match)
   - Investor: On-chain 150K = Off-chain 150K (match)
7. Backend validates blockchain_state_hash matches
8. Backend updates last_sync_at timestamp
9. System displays success message: "Cap table in sync with blockchain"
10. If discrepancies found:
    - System logs discrepancies
    - System automatically syncs from blockchain (source of truth)
    - System alerts admin via email

POSTCONDITION: Cap table verified against blockchain, discrepancies resolved
```

---

## Edge Cases & Error Handling

### EC-2: Blockchain Sync Failure
**Scenario**: Unable to connect to Base Network RPC to fetch on-chain state
**Handling**:
- Display warning banner: "Blockchain sync temporarily unavailable"
- Continue using last synced state (show timestamp)
- Retry sync every 5 minutes
- Alert admin if sync fails for > 30 minutes

### EC-3: Blockchain Reorg Detected
**Scenario**: Blockchain reorganization invalidates recent transaction
**Handling**:
- Detect reorg via block number decrease
- Roll back affected transactions in database
- Re-sync from earlier confirmed block
- Alert admin: "Blockchain reorganization detected. Cap table resynchronized."

### EC-5: Discrepancy Between On-Chain and Off-Chain
**Scenario**: On-chain shows João has 600K shares, off-chain shows 650K
**Handling**:
- Prioritize on-chain data (source of truth)
- Automatically update off-chain to match: 650K -> 600K
- Create audit log entry with discrepancy details
- Email admin: "Cap table discrepancy detected and auto-resolved"

---

## Security Considerations

### SEC-4: Blockchain State Verification
- Verify blockchain_state_hash on every reconciliation
- Detect tampering if hash doesn't match
- Alert admin if verification fails

---

## Success Criteria

### Performance
- Blockchain reconciliation completes in < 10 seconds

### Accuracy
- Zero discrepancies between on-chain and off-chain data after reconciliation

### Reliability
- Automatic recovery from blockchain sync failures
- Zero data loss during blockchain reorgs

---

## Dependencies

### Internal Dependencies
- **Cap Table Management** ([cap-table-management.md](./cap-table-management.md)): Reconciliation updates the off-chain cap table entries and triggers recalculation
- **Blockchain Integration** ([blockchain-integration.md](./blockchain-integration.md)): Provides event listeners, RPC access, and smart contract interaction for on-chain state reads
- **Transactions** ([transactions.md](./transactions.md)): Transactions may need to be rolled back during reorg handling
- **Audit Logging** ([../rules/audit-logging.md](../.claude/rules/audit-logging.md)): Audit events `CAP_TABLE_RECONCILIATION_RUN`, `CAP_TABLE_DISCREPANCY_FOUND`

### External Dependencies
- **Base Network**: L2 blockchain where OCP smart contracts are deployed
- **RPC Provider**: Base Network node access (Alchemy/Infura/native) for reading on-chain state
- **OCP Smart Contracts**: On-chain equity records that serve as the source of truth

---

## Frontend Specification

### Page Location

The reconciliation UI is embedded in the existing Cap Table page (`/dashboard/cap-table`), not a separate route. It adds:
1. A "Reconcile" button in the Cap Table page header toolbar (right-aligned, next to "Export")
2. A sync status indicator showing last sync time
3. A slide-out panel for discrepancy details

### Cap Table Page Header — Reconciliation Controls

```
┌─────────────────────────────────────────────────────────┐
│  h1: Cap Table              [Reconcile 🔄] [+ Export ▾] │
│  body-sm: Company equity overview                       │
│  🟢 Last synced: 23/02/2026 14:30    (or ⚠️ Sync issue)│
├─────────────────────────────────────────────────────────┤
│  Tab bar: Current | Fully Diluted | History             │
└─────────────────────────────────────────────────────────┘
```

#### Sync Status Indicator

A small inline indicator below the page description:

| State | Icon | Text | Color |
|-------|------|------|-------|
| In sync | `CheckCircle` (Lucide) | "Last synced: {dd/MM/yyyy HH:mm}" | `green-700` text, `green-100` bg badge |
| Syncing | `Loader2` (Lucide, spinning) | "Syncing with blockchain..." | `blue-600` text |
| Sync stale (>1 hour) | `AlertTriangle` (Lucide) | "Last synced: {time} — may be outdated" | `cream-700` text, `cream-100` bg badge |
| Sync failed | `XCircle` (Lucide) | "Blockchain sync unavailable" | `destructive-text` text, `red-50` bg badge |
| Never synced | `Info` (Lucide) | "Not yet synced with blockchain" | `gray-500` text |

#### Reconcile Button

- Variant: `secondary` (white bg, gray-200 border)
- Icon: `RefreshCw` (Lucide), 16px, left of label
- Label: "Reconcile"
- Size: `sm` (32px height)
- Position: right side of page header, left of Export button
- Disabled state: while reconciliation is in progress (shows spinner icon replacing RefreshCw)

### Confirmation Dialog

When user clicks "Reconcile":

| Element | Specification |
|---------|---------------|
| Type | Modal dialog (medium: 560px) |
| Title | "Reconcile Cap Table" (h3) |
| Body | "This will compare your cap table with blockchain data on Base Network and automatically resolve any discrepancies. The on-chain state is the source of truth." |
| Warning | Info alert (blue-50 bg): "This operation typically takes less than 10 seconds." |
| Cancel button | Secondary variant, "Cancel" |
| Confirm button | Primary variant, "Yes, Reconcile" |
| Close | X button top-right, also closes on Escape key |

### Loading State (During Reconciliation)

After user confirms:
1. Modal closes
2. Reconcile button becomes disabled with `Loader2` spinning icon
3. Sync status indicator changes to "Syncing with blockchain..."
4. Cap table content remains visible and usable (non-blocking UI)

### Success State — No Discrepancies

When API returns `status: "success"` with empty `discrepancies[]`:

1. Success toast (top-right): "Cap table is in sync with blockchain" (auto-dismiss 5s)
2. Sync status indicator updates to "Last synced: {now}" with green CheckCircle
3. Reconcile button re-enables

### Success State — Discrepancies Found & Resolved

When API returns `status: "discrepancies_found"`:

1. Warning toast: "Discrepancies found and auto-resolved. Tap to view details." (persistent, dismissable)
2. Clicking the toast (or a "View Details" link) opens the Discrepancy Slide-Out Panel
3. Sync status indicator updates to "Last synced: {now}" with green CheckCircle (since discrepancies were resolved)
4. Cap table data refreshes automatically (invalidate TanStack Query cache for cap table)

### Discrepancy Slide-Out Panel

A right-side slide-out panel (480px width) showing reconciliation details:

```
┌──────────────────────────────┐
│  ← Back   Reconciliation Results │
│                              │
│  ┌──────────────────────────┐│
│  │ Summary                  ││
│  │ Reconciled: 23/02/2026   ││
│  │ Discrepancies: 2 found   ││
│  │ Resolution: Auto-synced  ││
│  └──────────────────────────┘│
│                              │
│  Discrepancy Details         │
│  ┌──────────────────────────┐│
│  │ Shareholder │ Class │ On-chain │ Off-chain │ Diff  ││
│  │ João Silva  │ ON    │ 600.000  │ 650.000   │-50.000││
│  │ Maria S.    │ PN-A  │ 250.000  │ 245.000   │+5.000 ││
│  └──────────────────────────┘│
│                              │
│  ℹ️ All discrepancies were   │
│  automatically resolved      │
│  using on-chain data as the  │
│  source of truth.            │
│                              │
│  Admin has been notified via │
│  email.                      │
└──────────────────────────────┘
```

#### Discrepancy Table Columns

| Column | Type | Alignment | Description |
|--------|------|-----------|-------------|
| Shareholder | text | left | Shareholder name |
| Share Class | text | left | Share class name |
| On-Chain | number | right | Shares recorded on blockchain (formatted Brazilian: `600.000`) |
| Off-Chain | number | right | Shares recorded in database before sync |
| Difference | number | right | Delta, prefixed with +/- sign. Green for positive, red for negative. |

### Error States

#### Blockchain RPC Unavailable (EC-2)

When reconciliation fails due to RPC connectivity:

1. Error toast: "Unable to connect to blockchain. Please try again later." (persistent)
2. Sync status indicator changes to "Blockchain sync unavailable" with red XCircle
3. Reconcile button re-enables (user can retry)

#### Reconciliation Already In Progress

If user triggers reconciliation while one is already running (race condition):

1. Reconcile button remains disabled
2. Info toast: "Reconciliation already in progress. Please wait." (auto-dismiss 5s)

#### Blockchain Reorg Detected (EC-3)

Not displayed to user in real-time (happens in background scheduled job). Admin receives email notification. Sync status indicator may show "Syncing with blockchain..." during reorg re-sync.

### Accessibility

- Reconcile button: `aria-label="Reconcile cap table with blockchain"`
- Sync status: `role="status"` with `aria-live="polite"` for screen reader announcements
- Confirmation modal: focus trapped, closes on Escape, focus returns to Reconcile button on close
- Slide-out panel: `role="complementary"`, `aria-label="Reconciliation results"`, closeable with Escape
- Discrepancy table: proper `<table>` semantics with `<thead>` and `<th scope="col">`

### Responsive Behavior

| Breakpoint | Reconcile Button | Sync Status | Slide-Out Panel |
|------------|-----------------|-------------|-----------------|
| `xl+` | Full: icon + "Reconcile" label | Inline below title | 480px right panel |
| `md-lg` | Icon-only (RefreshCw) with tooltip | Below title, smaller text | Full-width overlay |
| `sm` | Icon-only in toolbar | Hidden (visible on tap) | Full-screen overlay |

### State Management (Frontend)

```typescript
// TanStack Query hooks
useCapTableReconciliation(companyId: string)  // mutation hook for POST /reconcile
useCapTableSyncStatus(companyId: string)      // query hook for last sync timestamp

// Local state
isReconciling: boolean          // tracks loading state
showDiscrepancyPanel: boolean   // controls slide-out visibility
lastReconciliationResult: ReconciliationResult | null  // stores last result for panel display
```

### API Integration

```typescript
// Mutation hook
const reconcileMutation = useMutation({
  mutationFn: () => api.post(`/api/v1/companies/${companyId}/cap-table/reconcile`, {}),
  onSuccess: (data) => {
    if (data.status === 'success') {
      toast.success(t('capTable.reconciliation.inSync'));
    } else {
      toast.warning(t('capTable.reconciliation.discrepanciesFound'), {
        action: { label: t('common.viewDetails'), onClick: () => setShowDiscrepancyPanel(true) },
        duration: Infinity,
      });
      queryClient.invalidateQueries(['cap-table', companyId]);
    }
    queryClient.invalidateQueries(['sync-status', companyId]);
  },
  onError: (error) => {
    if (error.code === 'CHAIN_RPC_UNAVAILABLE') {
      toast.error(t('capTable.reconciliation.rpcUnavailable'));
    } else {
      toast.error(t('capTable.reconciliation.failed'));
    }
  },
});
```

---

## Backend Specification Additions

### Request/Response DTOs

```typescript
// No request body needed — companyId comes from URL param

// Response DTO
class ReconciliationResultDto {
  status: 'success' | 'discrepancies_found';
  discrepancies: DiscrepancyDto[];
  lastSyncAt: string;              // ISO 8601
  blockchainStateHash: string;     // hex string
  resolution?: 'automatic_sync_completed';
}

class DiscrepancyDto {
  shareholderName: string;
  shareholderId: string;
  shareClass: string;
  shareClassId: string;
  onChainShares: string;           // Decimal as string
  offChainShares: string;          // Decimal as string
  difference: string;              // Decimal as string (signed)
}
```

### Response Envelope

The response MUST follow the standard API envelope:

```json
{
  "success": true,
  "data": {
    "status": "success",
    "discrepancies": [],
    "lastSyncAt": "2026-02-23T14:30:00.000Z",
    "blockchainStateHash": "0xabc..."
  }
}
```

### Concurrency Control

Only one reconciliation can run per company at a time. Implementation:

1. Use a Redis lock: `reconciliation:lock:{companyId}` with 30-second TTL
2. If lock exists when `POST /reconcile` is called, return `409 Conflict` with error code `CAP_RECONCILIATION_IN_PROGRESS`
3. Lock is released after reconciliation completes (success or failure)

### Sync Status Storage

Add a `lastBlockchainSyncAt` field to the Company model (or a separate `BlockchainSyncState` table):

```prisma
model Company {
  // ... existing fields
  lastBlockchainSyncAt  DateTime?  @map("last_blockchain_sync_at")
  lastBlockchainHash    String?    @map("last_blockchain_hash")
}
```

This is updated after every successful reconciliation (manual or scheduled).

### Sync Status Endpoint

Add a lightweight endpoint for the frontend to poll sync status without triggering reconciliation:

```
GET /api/v1/companies/:companyId/cap-table/sync-status
```

Response:
```json
{
  "success": true,
  "data": {
    "lastSyncAt": "2026-02-23T14:30:00.000Z",
    "blockchainStateHash": "0xabc...",
    "status": "synced"
  }
}
```

Status values: `synced`, `stale` (>1 hour since last sync), `syncing`, `failed`, `never_synced`.

### Scheduled Job Configuration

```typescript
// Daily reconciliation job — runs at 02:00 UTC for all ACTIVE companies
@Cron('0 2 * * *')
async handleDailyReconciliation() {
  const activeCompanies = await this.prisma.company.findMany({
    where: { status: 'ACTIVE', lastBlockchainSyncAt: { not: null } },
  });

  for (const company of activeCompanies) {
    await this.reconciliationQueue.add('reconcile', {
      companyId: company.id,
      trigger: 'scheduled',
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
```

- Only reconciles ACTIVE companies that have been synced at least once (have deployed smart contracts)
- Jobs are queued (not run inline) to avoid blocking the scheduler
- Each company job retries 3 times with exponential backoff (5s, 10s, 20s)

### Email Notification for Discrepancies

- Recipients: All users with ADMIN role in the company
- Template: `reconciliation-discrepancy` (PT-BR and EN per user locale)
- Subject: "[Navia] Discrepancia detectada no cap table — {companyName}"
- Content: Number of discrepancies, summary table, link to cap table page
- Triggered only when `status === 'discrepancies_found'`

### Error Codes

| Error Code | HTTP Status | messageKey | When |
|------------|-------------|------------|------|
| `CAP_RECONCILIATION_FAILED` | 502 | `errors.cap.reconciliationFailed` | General reconciliation failure |
| `CAP_RECONCILIATION_IN_PROGRESS` | 409 | `errors.cap.reconciliationInProgress` | Another reconciliation already running for this company |
| `CHAIN_RPC_UNAVAILABLE` | 502 | `errors.chain.rpcUnavailable` | Cannot connect to Base Network RPC |
| `CHAIN_SYNC_BEHIND` | 422 | `errors.chain.syncBehind` | Node is behind and data may be stale |
| `CHAIN_REORG_DETECTED` | 422 | `errors.chain.reorgDetected` | Blockchain reorganization detected during reconciliation |

### Audit Events

| Event | Metadata |
|-------|----------|
| `CAP_TABLE_RECONCILIATION_RUN` | `{ trigger: 'manual' \| 'scheduled' \| 'auto', durationMs: number, discrepancyCount: number, blockchainStateHash: string }` |
| `CAP_TABLE_DISCREPANCY_FOUND` | `{ shareholderId: string, shareClassId: string, onChainShares: string, offChainShares: string, difference: string, resolution: 'auto_synced' }` |

---

## i18n Keys

Add to both `messages/pt-BR.json` and `messages/en.json`:

```
capTable.reconciliation.button = "Reconciliar" / "Reconcile"
capTable.reconciliation.confirmTitle = "Reconciliar Cap Table" / "Reconcile Cap Table"
capTable.reconciliation.confirmBody = "Isso ira comparar seu cap table com os dados da blockchain na Base Network e resolver automaticamente quaisquer discrepancias. O estado on-chain e a fonte de verdade." / "This will compare your cap table with blockchain data on Base Network and automatically resolve any discrepancies. The on-chain state is the source of truth."
capTable.reconciliation.confirmButton = "Sim, Reconciliar" / "Yes, Reconcile"
capTable.reconciliation.syncing = "Sincronizando com blockchain..." / "Syncing with blockchain..."
capTable.reconciliation.inSync = "Cap table sincronizado com blockchain" / "Cap table is in sync with blockchain"
capTable.reconciliation.discrepanciesFound = "Discrepancias encontradas e auto-resolvidas. Toque para ver detalhes." / "Discrepancies found and auto-resolved. Tap to view details."
capTable.reconciliation.rpcUnavailable = "Nao foi possivel conectar a blockchain. Tente novamente mais tarde." / "Unable to connect to blockchain. Please try again later."
capTable.reconciliation.inProgress = "Reconciliacao ja em andamento. Aguarde." / "Reconciliation already in progress. Please wait."
capTable.reconciliation.failed = "Falha na reconciliacao. Tente novamente." / "Reconciliation failed. Please try again."
capTable.reconciliation.lastSynced = "Ultima sincronizacao: {date}" / "Last synced: {date}"
capTable.reconciliation.syncStale = "Ultima sincronizacao: {date} — pode estar desatualizado" / "Last synced: {date} — may be outdated"
capTable.reconciliation.syncFailed = "Sincronizacao com blockchain indisponivel" / "Blockchain sync unavailable"
capTable.reconciliation.neverSynced = "Ainda nao sincronizado com blockchain" / "Not yet synced with blockchain"
capTable.reconciliation.panelTitle = "Resultados da Reconciliacao" / "Reconciliation Results"
capTable.reconciliation.discrepancyCount = "{count} discrepancia(s) encontrada(s)" / "{count} discrepancy(ies) found"
capTable.reconciliation.autoResolved = "Todas as discrepancias foram automaticamente resolvidas usando os dados on-chain como fonte de verdade." / "All discrepancies were automatically resolved using on-chain data as the source of truth."
capTable.reconciliation.adminNotified = "O administrador foi notificado por e-mail." / "Admin has been notified via email."
errors.cap.reconciliationFailed = "Falha na reconciliacao do cap table" / "Cap table reconciliation failed"
errors.cap.reconciliationInProgress = "Uma reconciliacao ja esta em andamento para esta empresa" / "A reconciliation is already in progress for this company"
errors.chain.rpcUnavailable = "Nao foi possivel conectar ao provedor blockchain" / "Unable to connect to blockchain provider"
errors.chain.syncBehind = "O no blockchain esta atrasado. Os dados podem estar desatualizados." / "Blockchain node is behind. Data may be stale."
errors.chain.reorgDetected = "Reorganizacao de blockchain detectada durante a reconciliacao" / "Blockchain reorganization detected during reconciliation"
```

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [cap-table-management.md](./cap-table-management.md) | Cap table views, calculations, snapshots, and exports that this reconciliation validates |
| [blockchain-integration.md](./blockchain-integration.md) | On-chain infrastructure: event listeners, RPC connections, smart contract ABIs |
| [transactions.md](./transactions.md) | Transactions create the on-chain state that reconciliation verifies |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: `CAP_RECONCILIATION_FAILED`, `CHAIN_RPC_UNAVAILABLE`, `CHAIN_SYNC_BEHIND`, `CHAIN_REORG_DETECTED` |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: `CAP_TABLE_RECONCILIATION_RUN`, `CAP_TABLE_DISCREPANCY_FOUND` |
