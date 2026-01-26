# Transactions Specification

**Topic of Concern**: Share issuances, transfers, conversions, and cancellations

**One-Sentence Description**: The system processes equity transactions initiated by admins, records them on-chain, and automatically updates the cap table.

---

## Overview

Transactions represent all equity movements in the cap table: new share issuances, transfers between shareholders, convertible instrument conversions, stock splits, and share cancellations/buybacks. All transactions are initiated by admin users through the UI, validated against business rules, submitted to the blockchain via the admin wallet, and confirmed on-chain before updating the cap table.

**Transaction Types**:
- **Issuance**: Creating new shares for a shareholder
- **Transfer**: Moving shares from one shareholder to another
- **Conversion**: Converting preferred shares to common (or other class)
- **Cancellation**: Cancelling/buying back shares
- **Split**: Stock split or reverse split

---

## User Stories

### US-1: Issue New Shares
**As an** admin user
**I want to** issue new shares to a shareholder
**So that** I can record new investments or founder equity

### US-2: Transfer Shares
**As an** admin user
**I want to** transfer shares from one shareholder to another
**So that** I can record secondary transactions or transfers

### US-3: View Transaction History
**As an** admin or investor
**I want to** view all historical transactions
**So that** I can audit equity movements

### US-4: Cancel/Reverse Transaction
**As an** admin user
**I want to** cancel a pending transaction before blockchain confirmation
**So that** I can correct mistakes

---

## Functional Requirements

### FR-1: Transaction Types Support
- MUST support: issuance, transfer, conversion, cancellation, split
- Each type has specific validation rules
- All types recorded on-chain via OCP smart contract

### FR-2: Brazilian Transfer Rules
- Transfers MUST be admin-initiated (company records transfer)
- For Ltda: MUST check direito de preferência (right of first refusal)
- For S.A.: MUST check board approval requirements
- MUST document transfer in corporate records

### FR-3: Validation Requirements
- Validate sufficient shares for transfers
- Validate share class compatibility
- Validate against lock-up periods
- Validate board/shareholder approvals if required

### FR-4: Dilution Calculation
- MUST calculate dilution impact before issuance
- Show dilution effect on all existing shareholders
- Require admin confirmation if dilution > 10% for any shareholder

### FR-5: Transaction Status Tracking
- Status: draft, pending_approval, submitted, confirmed, failed, cancelled
- Real-time status updates
- Notification on status changes

---

## Data Models

```typescript
interface Transaction {
  id: string;
  company_id: string;

  // Transaction Details
  transaction_type: 'issuance' | 'transfer' | 'conversion' | 'cancellation' | 'split';
  from_shareholder_id: string | null;  // Null for issuances
  to_shareholder_id: string;
  share_class_id: string;
  quantity: number;
  price_per_share: number | null;
  total_value: number | null;

  // Metadata
  notes: string | null;
  status: TransactionStatus;
  occurred_at: Date;

  // Approvals
  requires_board_approval: boolean;
  board_approved_at: Date | null;
  board_approved_by: string | null;

  // Blockchain
  blockchain_tx_id: string | null;

  created_at: Date;
  created_by: string;
}

enum TransactionStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/transactions
Create new transaction

**Request** (Share Issuance):
```json
{
  "transaction_type": "issuance",
  "to_shareholder_id": "uuid",
  "share_class_id": "uuid",
  "quantity": 150000,
  "price_per_share": 10.00,
  "notes": "Series A investment"
}
```

**Response** (201 Created):
```json
{
  "id": "uuid",
  "status": "submitted",
  "dilution_impact": {
    "founder_1": {"before": 70.59, "after": 60.0, "change": -10.59}
  }
}
```

### GET /api/v1/companies/:companyId/transactions
List all transactions

### GET /api/v1/companies/:companyId/transactions/:transactionId
Get transaction details

### DELETE /api/v1/companies/:companyId/transactions/:transactionId
Cancel pending transaction (only if not yet confirmed)

---

## Business Rules

### BR-1: Admin-Only Initiation
- Only admin/finance users can create transactions
- All transactions initiated through admin wallet on blockchain

### BR-2: Transfer Validation
- Sender must have sufficient shares
- Check lock-up period expiry
- Validate right of first refusal if applicable

### BR-3: Issuance Limits
- Cannot exceed authorized shares in company bylaws
- Warn if dilution > 10% for existing shareholders

### BR-4: Automatic Cap Table Update
- Cap table recalculates automatically after confirmation
- Historical snapshot created automatically

---

## User Flows

### Flow 1: Issue New Shares

```
1. Admin navigates to "Transactions" → "New Issuance"
2. Admin selects shareholder: "Investor ABC"
3. Admin selects share class: "Ações Preferenciais Classe A"
4. Admin enters quantity: 150,000
5. Admin enters price per share: R$ 10.00
6. System calculates dilution impact for all shareholders
7. System shows warning: "Founders will be diluted from 70.59% to 60.0%"
8. Admin confirms transaction
9. System submits transaction to blockchain (admin wallet)
10. System shows "Transaction submitted, waiting for confirmation..."
11. After ~24 seconds, transaction confirmed
12. System updates cap table automatically
13. System creates historical snapshot
14. System sends email notifications to affected shareholders
15. Transaction shows as "Confirmed" in transaction list
```

---

## Edge Cases

### EC-1: Insufficient Shares for Transfer
- Return error: "Shareholder only has 10,000 shares, cannot transfer 15,000"

### EC-2: Transaction Fails on Blockchain
- Retry automatically up to 3 times
- If all retries fail, mark as "failed" and alert admin

### EC-3: Duplicate Transaction Detection
- Prevent duplicate submissions within 5 minutes
- Check: same shareholders, same quantity, same share class

---

## Dependencies

- **Shareholders**: Transactions reference from/to shareholders
- **Share Classes**: Transactions specify which share class
- **Blockchain**: All transactions recorded on-chain
- **Cap Table**: Transactions trigger cap table recalculation

---

## Success Criteria

- Transaction submission: < 5 seconds
- Transaction confirmation: < 30 seconds
- 99% success rate for valid transactions
- Zero unauthorized transactions
- 100% cap table accuracy after transactions
