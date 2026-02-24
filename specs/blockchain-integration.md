# Blockchain Integration Specification

**Topic of Concern**: On-chain cap table recording using OCP smart contracts on Base Network

**One-Sentence Description**: The system records all equity transactions immutably on Base Network using OCP smart contracts controlled by company-specific admin wallets with Privy gas sponsorship.

---

## Overview

Navia uses the Open Cap Table Protocol (OCP) smart contracts deployed on Base Network (Ethereum L2) to create an immutable, cryptographically verifiable record of all equity transactions. Each company has a dedicated admin wallet (Privy embedded wallet) that is the sole authority for minting/issuing shares on-chain. All blockchain operations are handled by the backend—users never interact directly with the blockchain. Privy gas sponsorship covers all transaction fees, eliminating gas cost concerns for users.

**Key Principles**:
- Backend-only blockchain interaction (users never sign blockchain transactions directly)
- One admin wallet per company (Privy embedded wallet)
- Privy gas sponsorship for all transactions (zero gas fees for users)
- OCP standard compliance with Brazilian extensions
- Base Network for low fees and fast finality (~2 seconds)

---

## User Stories

### US-1: Automatic On-Chain Recording
**As an** admin user issuing shares
**I want** the transaction to be automatically recorded on-chain
**So that** I have an immutable proof of ownership without blockchain complexity

### US-2: Transaction Verification
**As an** admin or auditor
**I want to** verify any transaction on the blockchain
**So that** I can prove the authenticity and immutability of equity records

### US-3: Blockchain Sync Status
**As an** admin user
**I want to** see the blockchain sync status on the cap table
**So that** I know when transactions are fully confirmed

### US-4: Gas-Free Experience
**As an** admin user
**I want** all blockchain transactions to be gasless
**So that** I don't need to hold cryptocurrency or worry about gas fees

---

## Functional Requirements

### FR-1: OCP Smart Contract Deployment
- System MUST deploy OCP-compliant smart contracts for each company
- Contracts MUST extend OCP with Brazilian corporate law requirements
- Contracts MUST support Ltda. quotas and S.A. share classes
- Deployment MUST be automated during company onboarding

### FR-2: Admin Wallet Management
- System MUST create one Privy embedded wallet per company
- Admin wallet MUST be the sole minter/issuer on the smart contract
- Admin wallet private keys MUST never be exposed to frontend or users
- Admin wallet MUST be securely stored and managed by Privy on backend

### FR-3: Gas Sponsorship
- ALL admin wallet transactions MUST use Privy gas sponsorship
- Zero gas costs for users and platform
- Transactions MUST NOT fail due to insufficient gas
- Gas sponsorship MUST cover: minting, transfers, metadata updates

### FR-4: Transaction Submission
- Backend MUST submit all transactions via admin wallet
- Transactions MUST include metadata (shareholder name, date, price)
- Backend MUST handle transaction queueing to prevent nonce conflicts
- Backend MUST retry failed transactions up to 3 times

### FR-5: Event Monitoring
- System MUST monitor smart contract events in real-time
- Events to monitor: SharesIssued, SharesTransferred, SharesCancelled
- Events MUST trigger cap table synchronization
- System MUST handle blockchain reorgs gracefully

### FR-6: State Synchronization
- System MUST sync on-chain state to off-chain database every 10 minutes
- System MUST reconcile discrepancies (on-chain is source of truth)
- Sync status MUST be displayed to users
- System MUST alert admin if sync fails for > 30 minutes

### FR-7: Transaction Confirmation Tracking
- System MUST track transaction status: pending, submitted, confirmed, failed
- Confirmation requires 12 blocks on Base Network (~24 seconds)
- Users MUST see real-time status updates
- Failed transactions MUST be retried automatically

---

## Data Models

### Admin Wallet

There is no separate `AdminWallet` entity. The company creator's `User.walletAddress` (Privy embedded wallet) serves as the smart contract admin. See [company-blockchain-admin.md](./company-blockchain-admin.md) for full architecture details.

The link is: `Company.createdById` → `User.walletAddress` → OCP smart contract owner.

### BlockchainTransaction Entity

Matches the Prisma schema `BlockchainTransaction` model:

```typescript
interface BlockchainTransaction {
  id: string;                          // UUID primary key
  transactionId: string;               // FK to Transaction (equity transaction that triggered this)
  txHash: string | null;               // Ethereum tx hash (0x...)
  blockNumber: number | null;          // Block where tx was included
  blockHash: string | null;            // Hash of the block
  gasUsed: string | null;              // Gas consumed (string for precision)
  status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
  errorMessage: string | null;         // Error details if FAILED
  attempts: number;                    // Retry attempt count (default 0)
  submittedAt: Date | null;            // When tx was sent to network
  confirmedAt: Date | null;            // When tx reached 12 confirmations
  createdAt: Date;
  updatedAt: Date;
}
```

---

## API Endpoints

### Get Blockchain Sync Status

```
GET /api/v1/companies/:companyId/blockchain/status
```

Returns the blockchain sync status for a company's OCP smart contract.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "contractAddress": "0xabc123...",
    "adminWalletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "network": "base",
    "chainId": 8453,
    "syncStatus": "SYNCED",
    "lastSyncAt": "2026-01-20T10:05:00.000Z",
    "lastBlockSynced": 1234567,
    "pendingTransactions": 0,
    "explorerBaseUrl": "https://basescan.org"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `contractAddress` | string | OCP smart contract address on Base |
| `adminWalletAddress` | string | Creator's wallet address (contract owner) |
| `network` | string | Network name (`base`) |
| `chainId` | number | Chain ID (`8453` for Base mainnet) |
| `syncStatus` | string | `SYNCED`, `SYNCING`, `BEHIND`, `ERROR` |
| `lastSyncAt` | ISO 8601 | Last successful sync timestamp |
| `lastBlockSynced` | number | Most recent block number synced |
| `pendingTransactions` | number | Count of unconfirmed transactions |
| `explorerBaseUrl` | string | Block explorer base URL for links |

**Error Response** (404 — no contract deployed):

```json
{
  "success": false,
  "error": {
    "code": "CHAIN_CONTRACT_NOT_DEPLOYED",
    "message": "Contrato ainda nao foi implantado para esta empresa",
    "messageKey": "errors.chain.contractNotDeployed"
  }
}
```

---

### Get Transaction Blockchain Details

```
GET /api/v1/companies/:companyId/transactions/:transactionId/blockchain
```

Returns blockchain details for a specific equity transaction.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "transactionId": "uuid",
    "txHash": "0xabc123...",
    "status": "CONFIRMED",
    "blockNumber": 1234567,
    "blockHash": "0xdef456...",
    "gasUsed": "150000",
    "attempts": 1,
    "submittedAt": "2026-01-20T10:02:00.000Z",
    "confirmedAt": "2026-01-20T10:02:30.000Z",
    "explorerUrl": "https://basescan.org/tx/0xabc123..."
  }
}
```

**Error Response** (404 — no blockchain record):

```json
{
  "success": false,
  "error": {
    "code": "CHAIN_TX_NOT_FOUND",
    "message": "Registro blockchain nao encontrado para esta transacao",
    "messageKey": "errors.chain.txNotFound"
  }
}
```

---

### Force Blockchain Reconciliation

```
POST /api/v1/companies/:companyId/blockchain/reconcile
```

Triggers an on-demand reconciliation between on-chain and off-chain cap table state. Returns immediately with job status.

**Response** (202 Accepted):

```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "QUEUED",
    "message": "Reconciliacao iniciada"
  }
}
```

**Error Response** (429 — reconciliation already in progress):

```json
{
  "success": false,
  "error": {
    "code": "CHAIN_RECONCILIATION_IN_PROGRESS",
    "message": "Reconciliacao ja esta em andamento",
    "messageKey": "errors.chain.reconciliationInProgress"
  }
}
```

---

## Permission Matrix

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| View blockchain status | Yes | Yes | Yes | No | No |
| View transaction blockchain details | Yes | Yes | Yes | No | No |
| Force reconciliation | Yes | No | No | No | No |

---

## Error Codes

| Code | HTTP Status | messageKey | Description |
|------|-------------|-----------|-------------|
| `CHAIN_CONTRACT_NOT_DEPLOYED` | 404 | `errors.chain.contractNotDeployed` | Company has no deployed OCP smart contract |
| `CHAIN_TX_NOT_FOUND` | 404 | `errors.chain.txNotFound` | No blockchain record for the given transaction |
| `CHAIN_TX_FAILED` | 422 | `errors.chain.txFailed` | On-chain transaction reverted |
| `CHAIN_TX_TIMEOUT` | 422 | `errors.chain.txTimeout` | Transaction not confirmed within expected time |
| `CHAIN_GAS_ESTIMATION_FAILED` | 422 | `errors.chain.gasEstimationFailed` | Gas estimation failed (possible contract error) |
| `CHAIN_RPC_UNAVAILABLE` | 502 | `errors.chain.rpcUnavailable` | Base Network RPC endpoint unreachable |
| `CHAIN_NONCE_CONFLICT` | 422 | `errors.chain.nonceConflict` | Nonce conflict during transaction submission |
| `CHAIN_REORG_DETECTED` | 422 | `errors.chain.reorgDetected` | Block reorganization affected a transaction |
| `CHAIN_RECONCILIATION_IN_PROGRESS` | 429 | `errors.chain.reconciliationInProgress` | Reconciliation job already running |
| `CHAIN_SYNC_FAILED` | 502 | `errors.chain.syncFailed` | Blockchain sync job failed |

---

## Business Rules

### BR-1: Admin Wallet Uniqueness
- One admin wallet per company (1:1 relationship)
- Admin wallet cannot be reassigned to different company
- Admin wallet creation is automatic during company setup

### BR-2: Transaction Ordering
- Transactions MUST be submitted in order to avoid nonce conflicts
- Use transaction queue with sequential processing
- Failed transactions MUST NOT block subsequent transactions permanently

### BR-3: Confirmation Requirements
- Transactions require 12 block confirmations on Base (~24 seconds)
- Cap table MUST NOT update until transaction confirmed
- Users see "pending" status until confirmation

### BR-4: Gas Sponsorship Coverage
- All admin wallet transactions covered by Privy gas sponsorship
- If gas sponsorship fails, alert platform admin (not user)
- Do not charge users for gas under any circumstances

### BR-5: Blockchain Reorg Handling
- Detect reorgs by monitoring block number changes
- Roll back affected transactions if < 12 confirmations
- Re-submit transactions after reorg stabilizes
- Alert admin if reorg affects confirmed transactions

### BR-6: On-Chain as Source of Truth
- On-chain data is authoritative for all equity records
- Off-chain database mirrors on-chain state for performance
- Discrepancies resolved by syncing from blockchain

---

## User Flows

### Flow 1: Automatic On-Chain Transaction Recording

```
PRECONDITION: Admin initiates share issuance via UI

1. User submits share issuance form (150K shares to Investor ABC)
2. Backend validates business rules
3. Backend calls BlockchainService.issueShares()
4. BlockchainService gets company admin wallet from Privy
5. BlockchainService prepares smart contract call:
   - Function: issueShares(to, classId, amount, metadata)
   - Parameters: (0x..., 1, 150000, "Series A")
6. BlockchainService submits transaction via Privy SDK
7. Privy sponsors gas fees automatically
8. Base Network accepts transaction (tx hash: 0x...)
9. Backend creates BlockchainTransaction record (status: submitted)
10. Backend returns to user: "Transaction submitted, waiting for confirmation..."
11. Frontend polls transaction status every 5 seconds
12. After ~24 seconds, transaction confirmed (12 blocks)
13. Backend event listener detects SharesIssued event
14. Backend updates BlockchainTransaction status: confirmed
15. Backend updates cap table with new shareholding
16. Frontend shows: "✓ Shares issued successfully"
17. User can click "View on Base scan" link

POSTCONDITION: Shares recorded on-chain, cap table updated, user sees confirmation
```

### Flow 2: Blockchain Sync Status Check

```
PRECONDITION: Admin viewing cap table

1. Cap table page displays sync status badge at top
2. Badge shows: "✓ Synced with blockchain (2 mins ago)"
3. Admin clicks on sync badge
4. System displays blockchain status modal:
   - Contract Address: 0x... [Copy] [View on Basescan]
   - Admin Wallet: 0x742... [Copy]
   - Network: Base (Chain ID: 8453)
   - Last Sync: Jan 20, 2024 10:05 AM
   - Last Block: 1,234,567
   - Status: Synced ✓
   - Pending Transactions: 0
5. Admin can click "Reconcile Now" to force sync
6. Admin can view transaction history on blockchain explorer

POSTCONDITION: Admin understands blockchain sync status
```

### Flow 3: Transaction Failure and Retry

```
PRECONDITION: Admin submits transaction, blockchain RPC temporarily unavailable

1. Backend attempts to submit transaction to Base Network
2. RPC call times out after 30 seconds
3. Backend catches error, sets transaction status: failed
4. Backend logs error: "RPC timeout"
5. Backend queues retry job (attempt 1 of 3)
6. After 60 seconds, backend retries transaction
7. RPC call succeeds this time
8. Transaction submitted with new tx hash
9. Backend updates transaction status: submitted
10. Transaction confirms normally
11. User sees: "✓ Transaction completed" (unaware of retry)

POSTCONDITION: Transaction eventually succeeds, user unaware of backend retry logic
```

---

## Edge Cases & Error Handling

### EC-1: Nonce Conflict
**Scenario**: Two transactions submitted simultaneously with same nonce
**Handling**:
- Use transaction queue to serialize transactions
- Lock admin wallet during transaction submission
- Retry second transaction with incremented nonce

### EC-2: Gas Price Spike
**Scenario**: Base Network gas prices surge unexpectedly
**Handling**:
- Privy gas sponsorship handles gas price fluctuations
- No action required from platform or user
- Monitor Privy gas credit balance (platform responsibility)

### EC-3: Blockchain Reorg
**Scenario**: Base Network experiences 5-block reorg
**Handling**:
- Detect reorg via block number monitoring
- If affected transaction had < 12 confirmations, mark as pending
- Re-confirm transaction after reorg stabilizes
- Alert user if reorg affects their transaction

### EC-4: Smart Contract Upgrade
**Scenario**: OCP protocol releases new contract version
**Handling**:
- Deploy new contract version
- Migrate historical data references
- Update admin wallet to use new contract
- Maintain backward compatibility for old transactions

### EC-5: Privy Service Downtime
**Scenario**: Privy API unavailable, cannot access admin wallet
**Handling**:
- Queue transactions for later submission
- Display message: "Blockchain operations temporarily unavailable"
- Retry every 5 minutes
- Alert platform admin if downtime > 1 hour

---

## Dependencies

### Internal Dependencies
- **Transactions**: Every transaction triggers blockchain recording
- **Cap Table**: Blockchain events update cap table
- **Admin Wallet**: Created during company onboarding
- **Companies**: Each company has one OCP contract

### External Dependencies
- **Base Network**: Ethereum L2 blockchain
  - RPC: https://mainnet.base.org
  - Chain ID: 8453
  - Block time: ~2 seconds
  - Confirmation time: 12 blocks (~24 seconds)
- **Privy**: Embedded wallet management and gas sponsorship
- **OCP Smart Contracts**: Open Cap Table Protocol contracts
- **Ethers.js/Viem**: Blockchain interaction library

---

## Technical Implementation

### Blockchain Service

```typescript
// /backend/src/blockchain/blockchain.service.ts

import { Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

@Injectable()
export class BlockchainService {
  private privyClient: PrivyClient;
  private publicClient: any;

  constructor() {
    this.privyClient = new PrivyClient(
      process.env.PRIVY_APP_ID,
      process.env.PRIVY_APP_SECRET,
    );

    this.publicClient = createPublicClient({
      chain: base,
      transport: http(process.env.BASE_RPC_URL),
    });
  }

  async issueShares(
    companyId: string,
    toAddress: string,
    classId: number,
    amount: number,
    metadata: any,
  ) {
    // Get company admin wallet
    const adminWallet = await this.getAdminWallet(companyId);

    // Prepare transaction
    const contract = {
      address: adminWallet.contract_address,
      abi: OCP_ABI,
    };

    // Sign and send via Privy (with gas sponsorship)
    const txHash = await this.privyClient.sendTransaction({
      walletId: adminWallet.privy_wallet_id,
      to: contract.address,
      data: this.encodeIssueShares(toAddress, classId, amount, metadata),
      gasSponsored: true,
    });

    return { transactionHash: txHash };
  }

  async monitorTransaction(txHash: string) {
    // Wait for transaction confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 12,
    });

    return receipt;
  }

  async syncCapTableFromChain(companyId: string) {
    const adminWallet = await this.getAdminWallet(companyId);

    // Read on-chain state
    const shareholdings = await this.publicClient.readContract({
      address: adminWallet.contract_address,
      abi: OCP_ABI,
      functionName: 'getAllShareholdings',
    });

    return shareholdings;
  }
}
```

---

## Security Considerations

### SEC-1: Admin Wallet Security
- Private keys never leave Privy infrastructure
- Backend uses Privy SDK for all wallet operations
- No private key exposure in logs or error messages

### SEC-2: Transaction Validation
- Validate all transaction parameters before submission
- Prevent unauthorized contract calls
- Only allow whitelisted contract functions

### SEC-3: Event Verification
- Verify event signatures match expected OCP events
- Validate event emitter is correct contract address
- Prevent spoofed events from malicious contracts

### SEC-4: Gas Sponsorship Monitoring
- Monitor Privy gas credit balance
- Alert platform admin if balance low
- Set up automatic top-up

---

## Success Criteria

### Performance
- Transaction submission: < 3 seconds
- Transaction confirmation: < 30 seconds (12 blocks)
- Blockchain sync: < 10 seconds
- Event detection latency: < 5 seconds

### Reliability
- 99.9% transaction success rate
- Zero nonce conflicts
- < 1% transaction retry rate
- Zero data loss during reorgs

### User Experience
- Users unaware of blockchain complexity
- Zero gas fee charges to users
- Real-time transaction status updates
- Clear error messages for failures

---

# Frontend Specification

---

## Table of Contents (Frontend)

1. [Frontend Architecture](#frontend-architecture)
2. [Component Hierarchy](#component-hierarchy)
3. [Component Specifications](#component-specifications)
4. [Frontend User Flows](#frontend-user-flows)
5. [UI States and Error Handling](#ui-states-and-error-handling)
6. [TanStack Query Integration](#tanstack-query-integration)
7. [i18n Keys](#i18n-keys)
8. [Frontend Success Criteria](#frontend-success-criteria)

---

## Frontend Architecture

### MVP Scope

The blockchain integration frontend is **read-only** — users view blockchain status and transaction confirmations but never initiate blockchain operations directly. All blockchain operations are triggered automatically by backend business logic (share issuance, transfer, etc.).

The frontend surfaces blockchain information in three places:

1. **BlockchainStatusBadge** — Compact sync status indicator shown on the Cap Table page header.
2. **BlockchainStatusModal** — Expanded status details shown when clicking the badge.
3. **BlockchainTransactionBadge** — Per-transaction confirmation status shown inline in transaction tables/detail pages.
4. **BlockchainTransactionDetail** — Full blockchain details shown in a slide-over panel from transaction detail page.

### State Management

Blockchain status is fetched via TanStack Query with polling:

- **Sync status**: Polled every 30 seconds while cap table page is active.
- **Transaction status**: Polled every 5 seconds while a transaction is in `PENDING` or `SUBMITTED` state.
- Polling stops automatically when the component unmounts or the status reaches a terminal state (`CONFIRMED` or `FAILED`).

---

## Component Hierarchy

```
components/blockchain/
  blockchain-status-badge.tsx       → BlockchainStatusBadge
  blockchain-status-modal.tsx       → BlockchainStatusModal
  blockchain-transaction-badge.tsx  → BlockchainTransactionBadge
  blockchain-transaction-detail.tsx → BlockchainTransactionDetail
```

Usage locations:

```
app/(dashboard)/cap-table/page.tsx
  └─ Page header area
       └─ BlockchainStatusBadge
            └─ (click) → BlockchainStatusModal

app/(dashboard)/transactions/page.tsx
  └─ Transaction table rows
       └─ BlockchainTransactionBadge (per row)

app/(dashboard)/transactions/[id]/page.tsx
  └─ Transaction detail page
       ├─ BlockchainTransactionBadge
       └─ (click "Ver detalhes blockchain") → BlockchainTransactionDetail (slide-over)
```

### Component Registry

| Component | File | Description |
|-----------|------|-------------|
| `BlockchainStatusBadge` | `components/blockchain/blockchain-status-badge.tsx` | Compact sync status indicator |
| `BlockchainStatusModal` | `components/blockchain/blockchain-status-modal.tsx` | Full blockchain status details |
| `BlockchainTransactionBadge` | `components/blockchain/blockchain-transaction-badge.tsx` | Per-transaction confirmation badge |
| `BlockchainTransactionDetail` | `components/blockchain/blockchain-transaction-detail.tsx` | Full blockchain tx details panel |

---

## Component Specifications

### 1. BlockchainStatusBadge

**File**: `components/blockchain/blockchain-status-badge.tsx`

**Props**:
```typescript
interface BlockchainStatusBadgeProps {
  companyId: string;
}
```

**Visual Structure**:
```
+------------------------------------------+
|  ● Sincronizado com blockchain (2 min)   |  ← Clickable badge, green dot
+------------------------------------------+

+------------------------------------------+
|  ● Sincronizando...                      |  ← Yellow dot, pulse animation
+------------------------------------------+

+------------------------------------------+
|  ● Blockchain indisponivel               |  ← Red dot
+------------------------------------------+
```

**Badge States**:

| syncStatus | Dot Color | Label | Additional |
|------------|-----------|-------|------------|
| `SYNCED` | `green-600` | "Sincronizado com blockchain ({time ago})" | — |
| `SYNCING` | `cream-700` | "Sincronizando..." | Pulse animation on dot |
| `BEHIND` | `cream-700` | "Sincronizacao atrasada ({time ago})" | — |
| `ERROR` | `#DC2626` | "Blockchain indisponivel" | — |
| Loading | `gray-400` | Skeleton text (120px) | — |
| No contract | `gray-400` | "Contrato nao implantado" | — |

**Styling**:
- Container: `inline-flex items-center gap-1.5`, cursor pointer, `radius-full`, `px-3 py-1`, `gray-100` bg, hover `gray-200` bg.
- Dot: `8px` circle with the status color.
- Text: `caption` (12px), `gray-600`.
- Click opens `BlockchainStatusModal`.

**Behavior**:
1. On mount: fetches `GET /api/v1/companies/:companyId/blockchain/status`.
2. Polls every 30 seconds via `refetchInterval`.
3. On click: opens `BlockchainStatusModal` dialog.
4. On 404 (no contract): shows "Contrato nao implantado" in gray.
5. On network error: shows "Blockchain indisponivel" in red.

---

### 2. BlockchainStatusModal

**File**: `components/blockchain/blockchain-status-modal.tsx`

**Props**:
```typescript
interface BlockchainStatusModalProps {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Visual Structure**:
```
+--------------------------------------------------+
|  Status do Blockchain                    [X]     |
+--------------------------------------------------+
|                                                  |
|  Status       ● Sincronizado                     |  ← Badge with green dot
|                                                  |
|  Contrato     0xabc123...def456  [Copiar] [↗]   |  ← Truncated, copy + explorer link
|                                                  |
|  Admin        0x742d35...f0bEb   [Copiar] [↗]   |
|                                                  |
|  Rede         Base (Chain ID: 8453)              |
|                                                  |
|  Ultimo Sync  20/01/2026 10:05                   |  ← Brazilian date format
|                                                  |
|  Ultimo Bloco 1.234.567                          |  ← Brazilian number format
|                                                  |
|  Pendentes    0 transacoes                       |
|                                                  |
+--------------------------------------------------+
|                        [Reconciliar Agora]        |  ← Secondary button, ADMIN only
+--------------------------------------------------+
```

**Component**: Uses shadcn/ui `Dialog`.

**Fields**:

| Label | Value Source | Format |
|-------|-------------|--------|
| Status | `syncStatus` | Status badge with colored dot |
| Contrato | `contractAddress` | Truncated (`0xabc1...ef45`) + copy button + Basescan link |
| Admin | `adminWalletAddress` | Truncated + copy button + Basescan link |
| Rede | `network` + `chainId` | "Base (Chain ID: 8453)" |
| Ultimo Sync | `lastSyncAt` | `dd/MM/yyyy HH:mm` Brazilian format |
| Ultimo Bloco | `lastBlockSynced` | Brazilian number format (`1.234.567`) |
| Pendentes | `pendingTransactions` | "{n} transacoes" |

**Behavior**:
1. "Copiar" button copies full address to clipboard, shows check icon for 2 seconds.
2. "[↗]" link opens Basescan address page in new tab: `{explorerBaseUrl}/address/{address}`.
3. "Reconciliar Agora" button: visible only to ADMIN role. Calls `POST /api/v1/companies/:companyId/blockchain/reconcile`. Shows spinner during request, success toast on 202, error toast on 429.

---

### 3. BlockchainTransactionBadge

**File**: `components/blockchain/blockchain-transaction-badge.tsx`

**Props**:
```typescript
interface BlockchainTransactionBadgeProps {
  status: 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED';
  txHash?: string | null;
  explorerBaseUrl?: string;
}
```

**Visual Structure**:
```
[● Confirmado]        ← green badge, clickable if txHash exists
[● Enviado]           ← yellow badge with pulse
[● Pendente]          ← gray badge
[● Falhou]            ← red badge
```

**Badge Variants**:

| Status | Background | Text | Dot | Behavior |
|--------|-----------|------|-----|----------|
| `CONFIRMED` | `green-100` | `green-700` | Solid green | Click opens explorer tx page |
| `SUBMITTED` | `cream-100` | `cream-700` | Pulsing yellow | — |
| `PENDING` | `gray-100` | `gray-600` | Solid gray | — |
| `FAILED` | `#FEE2E2` | `#991B1B` | Solid red | — |

**Styling**: Same as design-system badges — `caption` (12px), weight 500, `radius-full`, `px-2 py-0.5`.

**Behavior**:
- If `txHash` exists and status is `CONFIRMED`: badge is clickable, opens `{explorerBaseUrl}/tx/{txHash}` in new tab.
- Shows tooltip on hover with full tx hash (if available).

---

### 4. BlockchainTransactionDetail

**File**: `components/blockchain/blockchain-transaction-detail.tsx`

**Props**:
```typescript
interface BlockchainTransactionDetailProps {
  companyId: string;
  transactionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Visual Structure** (shadcn/ui Sheet, slide-over from right):
```
+--------------------------------------------------+
|  Detalhes Blockchain                     [X]     |
+--------------------------------------------------+
|                                                  |
|  Status         ● Confirmado                     |
|                                                  |
|  Hash           0xabc123...def456                |
|                 [Copiar] [Ver no Basescan ↗]     |
|                                                  |
|  Bloco          1.234.567                        |
|                 [Ver bloco no Basescan ↗]        |
|                                                  |
|  Gas Usado      150.000                          |
|                                                  |
|  Tentativas     1                                |
|                                                  |
|  Enviado em     20/01/2026 10:02                 |
|                                                  |
|  Confirmado em  20/01/2026 10:02                 |
|                                                  |
+--------------------------------------------------+
```

**Loading State**: Skeleton lines matching the layout above.

**Error State**: If blockchain details not found (404), show: "Registro blockchain nao encontrado para esta transacao" with gray icon.

**Behavior**:
1. On open: fetches `GET /api/v1/companies/:companyId/transactions/:transactionId/blockchain`.
2. If status is `PENDING` or `SUBMITTED`: polls every 5 seconds.
3. Copy and explorer link buttons behave same as BlockchainStatusModal.

---

## Frontend User Flows

### Flow: View Blockchain Sync Status

```
User views Cap Table page
  │
  ├─ [contract deployed] ─→ BlockchainStatusBadge shows sync status
  │     │
  │     ├─ [user clicks badge] ─→ BlockchainStatusModal opens
  │     │     │
  │     │     ├─ [ADMIN clicks "Reconciliar Agora"] ─→ POST /reconcile
  │     │     │     │
  │     │     │     ├─ [202 success] ─→ Toast: "Reconciliacao iniciada"
  │     │     │     └─ [429 in progress] ─→ Toast: "Reconciliacao ja em andamento"
  │     │     │
  │     │     └─ [user copies address] ─→ Address copied, check icon shown
  │     │
  │     └─ [user does nothing] ─→ Badge auto-updates every 30s
  │
  └─ [no contract] ─→ Badge shows "Contrato nao implantado"
```

### Flow: View Transaction Blockchain Details

```
User views Transaction detail page
  │
  ├─ [blockchain record exists] ─→ BlockchainTransactionBadge shows status
  │     │
  │     ├─ [CONFIRMED + has txHash] ─→ Badge is clickable → opens Basescan
  │     │
  │     ├─ [PENDING/SUBMITTED] ─→ Badge polls every 5s for updates
  │     │
  │     └─ [user clicks "Ver detalhes blockchain"] ─→ BlockchainTransactionDetail opens
  │           │
  │           ├─ [data loaded] ─→ Shows full tx details with copy/explorer links
  │           └─ [404 not found] ─→ Shows "Registro nao encontrado" message
  │
  └─ [no blockchain record] ─→ No badge shown (transaction not yet synced)
```

---

## UI States and Error Handling

### BlockchainStatusBadge States

| State | Visual | Behavior |
|-------|--------|----------|
| Loading | Gray dot + skeleton text | Polling not started yet |
| Synced | Green dot + "Sincronizado..." | Normal state |
| Syncing | Yellow pulsing dot | Active sync in progress |
| Behind | Yellow dot + time since last sync | Sync is delayed |
| Error | Red dot + "Blockchain indisponivel" | RPC or service error |
| No contract | Gray dot + "Contrato nao implantado" | Company has no deployed contract |
| Network error | Red dot | TanStack Query retry (3x) then show error |

### BlockchainTransactionBadge States

| State | Visual |
|-------|--------|
| PENDING | Gray badge "Pendente" |
| SUBMITTED | Yellow pulsing badge "Enviado" |
| CONFIRMED | Green badge "Confirmado" (clickable) |
| FAILED | Red badge "Falhou" |

---

## TanStack Query Integration

### Query Key Factory

```typescript
export const blockchainKeys = {
  all: ['blockchain'] as const,
  status: (companyId: string) =>
    [...blockchainKeys.all, 'status', companyId] as const,
  transaction: (companyId: string, transactionId: string) =>
    [...blockchainKeys.all, 'transaction', companyId, transactionId] as const,
};
```

### Hooks

```typescript
export function useBlockchainStatus(companyId: string) {
  return useQuery({
    queryKey: blockchainKeys.status(companyId),
    queryFn: () => api.get(`/api/v1/companies/${companyId}/blockchain/status`),
    refetchInterval: 30_000, // Poll every 30 seconds
    retry: 3,
  });
}

export function useBlockchainTransaction(
  companyId: string,
  transactionId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: blockchainKeys.transaction(companyId, transactionId),
    queryFn: () =>
      api.get(
        `/api/v1/companies/${companyId}/transactions/${transactionId}/blockchain`,
      ),
    enabled: options?.enabled ?? true,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll every 5s while pending/submitted, stop when terminal
      if (status === 'PENDING' || status === 'SUBMITTED') return 5_000;
      return false;
    },
    retry: 3,
  });
}

export function useReconcileBlockchain(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post(`/api/v1/companies/${companyId}/blockchain/reconcile`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: blockchainKeys.status(companyId),
      });
    },
  });
}
```

---

## i18n Keys

| Key | PT-BR | EN |
|-----|-------|----|
| `blockchain.status.synced` | `Sincronizado com blockchain` | `Synced with blockchain` |
| `blockchain.status.syncing` | `Sincronizando...` | `Syncing...` |
| `blockchain.status.behind` | `Sincronizacao atrasada` | `Sync behind` |
| `blockchain.status.error` | `Blockchain indisponivel` | `Blockchain unavailable` |
| `blockchain.status.noContract` | `Contrato nao implantado` | `Contract not deployed` |
| `blockchain.modal.title` | `Status do Blockchain` | `Blockchain Status` |
| `blockchain.modal.contract` | `Contrato` | `Contract` |
| `blockchain.modal.admin` | `Admin` | `Admin` |
| `blockchain.modal.network` | `Rede` | `Network` |
| `blockchain.modal.lastSync` | `Ultimo Sync` | `Last Sync` |
| `blockchain.modal.lastBlock` | `Ultimo Bloco` | `Last Block` |
| `blockchain.modal.pending` | `Pendentes` | `Pending` |
| `blockchain.modal.pendingCount` | `{count} transacoes` | `{count} transactions` |
| `blockchain.modal.reconcile` | `Reconciliar Agora` | `Reconcile Now` |
| `blockchain.modal.copy` | `Copiar` | `Copy` |
| `blockchain.modal.copied` | `Copiado!` | `Copied!` |
| `blockchain.modal.viewExplorer` | `Ver no Basescan` | `View on Basescan` |
| `blockchain.tx.confirmed` | `Confirmado` | `Confirmed` |
| `blockchain.tx.submitted` | `Enviado` | `Submitted` |
| `blockchain.tx.pending` | `Pendente` | `Pending` |
| `blockchain.tx.failed` | `Falhou` | `Failed` |
| `blockchain.tx.detailTitle` | `Detalhes Blockchain` | `Blockchain Details` |
| `blockchain.tx.hash` | `Hash` | `Hash` |
| `blockchain.tx.block` | `Bloco` | `Block` |
| `blockchain.tx.gasUsed` | `Gas Usado` | `Gas Used` |
| `blockchain.tx.attempts` | `Tentativas` | `Attempts` |
| `blockchain.tx.submittedAt` | `Enviado em` | `Submitted at` |
| `blockchain.tx.confirmedAt` | `Confirmado em` | `Confirmed at` |
| `blockchain.tx.notFound` | `Registro blockchain nao encontrado para esta transacao` | `No blockchain record found for this transaction` |
| `blockchain.reconcile.success` | `Reconciliacao iniciada` | `Reconciliation started` |
| `blockchain.reconcile.inProgress` | `Reconciliacao ja esta em andamento` | `Reconciliation already in progress` |

---

## Frontend Success Criteria

- [ ] BlockchainStatusBadge renders correct state for all syncStatus values
- [ ] BlockchainStatusBadge polls every 30 seconds and updates automatically
- [ ] BlockchainStatusModal displays all fields with correct formatting (Brazilian dates/numbers)
- [ ] Copy-to-clipboard works for contract address and admin wallet address
- [ ] Basescan links open correct URLs in new tabs
- [ ] "Reconciliar Agora" button visible only to ADMIN role
- [ ] BlockchainTransactionBadge renders correct badge variant for all 4 statuses
- [ ] BlockchainTransactionBadge is clickable for CONFIRMED transactions with txHash
- [ ] BlockchainTransactionDetail polls every 5s for PENDING/SUBMITTED, stops for CONFIRMED/FAILED
- [ ] All components handle loading, error, and empty states gracefully
- [ ] All user-facing strings use i18n keys (no hardcoded text)
- [ ] Number formatting uses Brazilian format (dots for thousands)
- [ ] Date formatting uses Brazilian format (dd/MM/yyyy HH:mm)
- [ ] Components follow design-system.md spacing, colors, and typography
- [ ] Keyboard accessibility: all interactive elements focusable and operable

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-blockchain-admin.md](./company-blockchain-admin.md) | Smart contract deployment and admin wallet management per company |
| [transactions.md](./transactions.md) | On-chain recording of share issuance, transfer, and cancellation transactions |
| [cap-table-management.md](./cap-table-management.md) | On-chain/off-chain reconciliation and cap table snapshot verification |
| [document-signatures.md](./document-signatures.md) | Document hash anchoring on-chain after all signatures collected |
| [company-management.md](./company-management.md) | Each company has an associated smart contract deployed on Base |
| [option-exercises.md](./option-exercises.md) | Option exercise triggers on-chain share issuance |
| [convertible-conversion.md](./convertible-conversion.md) | Convertible conversion triggers on-chain share issuance |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, pagination, and URL conventions for blockchain endpoints |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: CHAIN_TX_FAILED, CHAIN_TX_TIMEOUT, CHAIN_GAS_ESTIMATION_FAILED, CHAIN_RPC_UNAVAILABLE, CHAIN_NONCE_CONFLICT, CHAIN_REORG_DETECTED |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: BLOCKCHAIN_TX_SUBMITTED, BLOCKCHAIN_TX_CONFIRMED, BLOCKCHAIN_TX_FAILED, BLOCKCHAIN_SYNC_STARTED, BLOCKCHAIN_SYNC_COMPLETED, BLOCKCHAIN_REORG_DETECTED |
