# Blockchain Integration Specification

**Topic of Concern**: On-chain cap table recording using OCP smart contracts on Base Network

**One-Sentence Description**: The system records all equity transactions immutably on Base Network using OCP smart contracts controlled by company-specific admin wallets with Privy gas sponsorship.

---

## Overview

VelaFund uses the Open Cap Table Protocol (OCP) smart contracts deployed on Base Network (Ethereum L2) to create an immutable, cryptographically verifiable record of all equity transactions. Each company has a dedicated admin wallet (Privy embedded wallet) that is the sole authority for minting/issuing shares on-chain. All blockchain operations are handled by the backend—users never interact directly with the blockchain. Privy gas sponsorship covers all transaction fees, eliminating gas cost concerns for users.

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

### AdminWallet Entity

```typescript
interface AdminWallet {
  id: string;
  company_id: string;                  // Foreign key (unique)
  wallet_address: string;              // Ethereum address (unique)
  privy_wallet_id: string;             // Privy embedded wallet ID (unique)
  is_active: boolean;
  created_at: Date;
}
```

### BlockchainTransaction Entity

```typescript
interface BlockchainTransaction {
  id: string;
  transaction_id: string;              // Foreign key to Transaction (unique)

  // Blockchain Data
  transaction_hash: string;            // Ethereum tx hash (unique)
  from_address: string;                // Admin wallet address
  to_address: string | null;           // Recipient (for transfers)
  contract_address: string;            // OCP contract address

  // Transaction Details
  transaction_data: {                  // ABI-encoded function call
    function_name: string;
    parameters: any;
  };

  // Status Tracking
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  submitted_at: Date | null;
  confirmed_at: Date | null;
  failed_at: Date | null;
  failure_reason: string | null;

  // Block Information
  block_number: number | null;
  block_hash: string | null;

  // Gas Information
  gas_used: number | null;
  gas_sponsored: boolean;              // Always true (Privy sponsorship)

  created_at: Date;
  updated_at: Date;
}
```

---

## API Endpoints

### POST /api/v1/blockchain/admin-wallet
**Description**: Create admin wallet for company (internal/automated)

**Request**:
```json
{
  "company_id": "uuid"
}
```

**Response** (201 Created):
```json
{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "privy_wallet_id": "priv_wallet_xyz",
  "contract_address": "0x..."
}
```

---

### GET /api/v1/companies/:companyId/blockchain/status
**Description**: Get blockchain sync status

**Response** (200 OK):
```json
{
  "contract_address": "0x...",
  "admin_wallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "network": "base",
  "chain_id": 8453,
  "sync_status": "synced",
  "last_sync_at": "2024-01-20T10:05:00Z",
  "last_block_synced": 1234567,
  "pending_transactions": 0
}
```

---

### GET /api/v1/transactions/:transactionId/blockchain
**Description**: Get blockchain details for a transaction

**Response** (200 OK):
```json
{
  "transaction_hash": "0x...",
  "status": "confirmed",
  "block_number": 1234567,
  "confirmed_at": "2024-01-20T10:02:30Z",
  "explorer_url": "https://basescan.org/tx/0x...",
  "gas_used": 150000,
  "gas_sponsored": true
}
```

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
