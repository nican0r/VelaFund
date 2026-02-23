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

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [cap-table-management.md](./cap-table-management.md) | Cap table views, calculations, snapshots, and exports that this reconciliation validates |
| [blockchain-integration.md](./blockchain-integration.md) | On-chain infrastructure: event listeners, RPC connections, smart contract ABIs |
| [transactions.md](./transactions.md) | Transactions create the on-chain state that reconciliation verifies |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: `CAP_RECONCILIATION_FAILED`, `CHAIN_RPC_UNAVAILABLE`, `CHAIN_SYNC_BEHIND`, `CHAIN_REORG_DETECTED` |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: `CAP_TABLE_RECONCILIATION_RUN`, `CAP_TABLE_DISCREPANCY_FOUND` |
