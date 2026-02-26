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
- For Ltda: MUST check direito de preferencia (right of first refusal)
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
- Status: DRAFT, PENDING_APPROVAL, SUBMITTED, CONFIRMED, FAILED, CANCELLED
- Real-time status updates
- Notification on status changes

---

## Data Models

```typescript
interface Transaction {
  id: string;
  companyId: string;

  // Transaction Details
  transactionType: 'ISSUANCE' | 'TRANSFER' | 'CONVERSION' | 'CANCELLATION' | 'SPLIT';
  fromShareholderId: string | null;  // Null for issuances
  toShareholderId: string;
  shareClassId: string;
  quantity: number;
  pricePerShare: string | null;      // Decimal as string for precision
  totalValue: string | null;         // Decimal as string for precision

  // Metadata
  notes: string | null;
  status: TransactionStatus;
  occurredAt: Date;

  // Approvals
  requiresBoardApproval: boolean;
  boardApprovedAt: Date | null;
  boardApprovedBy: string | null;

  // Blockchain
  blockchainTxId: string | null;

  createdAt: Date;
  createdBy: string;
}

enum TransactionStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}
```

---

## API Endpoints

### Create Transaction

```
POST /api/v1/companies/:companyId/transactions
```

Creates a new equity transaction. The transaction is validated against business rules before submission.

**Request Body** (Share Issuance):

```json
{
  "transactionType": "ISSUANCE",
  "toShareholderId": "uuid",
  "shareClassId": "uuid",
  "quantity": 150000,
  "pricePerShare": "10.00",
  "notes": "Series A investment"
}
```

**Request Body** (Share Transfer):

```json
{
  "transactionType": "TRANSFER",
  "fromShareholderId": "uuid",
  "toShareholderId": "uuid",
  "shareClassId": "uuid",
  "quantity": 50000,
  "pricePerShare": "15.00",
  "notes": "Secondary sale"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transactionType` | string | Yes | ISSUANCE, TRANSFER, CONVERSION, CANCELLATION, SPLIT |
| `fromShareholderId` | UUID | Conditional | Required for TRANSFER, CONVERSION, CANCELLATION |
| `toShareholderId` | UUID | Yes | Target shareholder |
| `shareClassId` | UUID | Yes | Share class for the transaction |
| `quantity` | integer | Yes | Number of shares |
| `pricePerShare` | string | No | Price per share as decimal string |
| `notes` | string | No | Optional notes |

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "companyId": "company-uuid",
    "transactionType": "ISSUANCE",
    "toShareholderId": "shareholder-uuid",
    "shareClassId": "share-class-uuid",
    "quantity": 150000,
    "pricePerShare": "10.00",
    "totalValue": "1500000.00",
    "status": "SUBMITTED",
    "dilutionImpact": {
      "shareholders": [
        {
          "shareholderId": "founder-uuid",
          "name": "Joao Founder",
          "before": "70.59",
          "after": "60.00",
          "change": "-10.59"
        }
      ]
    },
    "blockchainTxId": null,
    "createdAt": "2026-01-20T14:30:00.000Z",
    "createdBy": "user-uuid"
  }
}
```

**Error Response** (422 — insufficient shares):

```json
{
  "success": false,
  "error": {
    "code": "CAP_INSUFFICIENT_SHARES",
    "message": "Acoes insuficientes para completar a operacao",
    "messageKey": "errors.cap.insufficientShares",
    "details": {
      "available": 10000,
      "requested": 15000,
      "shareholderId": "uuid"
    }
  }
}
```

**Error Response** (422 — lock-up active):

```json
{
  "success": false,
  "error": {
    "code": "TXN_LOCKUP_ACTIVE",
    "message": "Acoes estao em periodo de lock-up",
    "messageKey": "errors.txn.lockupActive",
    "details": {
      "lockupExpiresAt": "2026-06-15T00:00:00.000Z"
    }
  }
}
```

### List Transactions

```
GET /api/v1/companies/:companyId/transactions
```

Returns paginated list of transactions for the company.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `type` | string | — | Filter by transactionType (ISSUANCE, TRANSFER, etc.) |
| `status` | string | — | Filter by status (CONFIRMED, PENDING_APPROVAL, etc.) |
| `shareholderId` | UUID | — | Filter by from or to shareholder |
| `shareClassId` | UUID | — | Filter by share class |
| `dateFrom` | ISO 8601 | — | Transactions after this date |
| `dateTo` | ISO 8601 | — | Transactions before this date |
| `sort` | string | `-createdAt` | Sort field (prefix `-` for descending) |

**Response** (200 OK):

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "transactionType": "ISSUANCE",
      "fromShareholderId": null,
      "toShareholderId": "shareholder-uuid",
      "toShareholderName": "Investor ABC",
      "shareClassId": "share-class-uuid",
      "shareClassName": "Acoes Preferenciais Classe A",
      "quantity": 150000,
      "pricePerShare": "10.00",
      "totalValue": "1500000.00",
      "status": "CONFIRMED",
      "blockchainTxId": "0xabc123...",
      "occurredAt": "2026-01-20T14:30:00.000Z",
      "createdAt": "2026-01-20T14:30:00.000Z"
    },
    {
      "id": "uuid-2",
      "transactionType": "TRANSFER",
      "fromShareholderId": "from-uuid",
      "fromShareholderName": "Joao Founder",
      "toShareholderId": "to-uuid",
      "toShareholderName": "Maria Co-founder",
      "shareClassId": "share-class-uuid",
      "shareClassName": "Acoes Ordinarias",
      "quantity": 50000,
      "pricePerShare": "15.00",
      "totalValue": "750000.00",
      "status": "CONFIRMED",
      "blockchainTxId": "0xdef456...",
      "occurredAt": "2026-01-18T10:00:00.000Z",
      "createdAt": "2026-01-18T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### Get Transaction Detail

```
GET /api/v1/companies/:companyId/transactions/:transactionId
```

Returns full details of a single transaction including approval info and blockchain status.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "companyId": "company-uuid",
    "transactionType": "TRANSFER",
    "fromShareholderId": "from-uuid",
    "fromShareholderName": "Joao Founder",
    "toShareholderId": "to-uuid",
    "toShareholderName": "Maria Co-founder",
    "shareClassId": "share-class-uuid",
    "shareClassName": "Acoes Ordinarias",
    "quantity": 50000,
    "pricePerShare": "15.00",
    "totalValue": "750000.00",
    "notes": "Secondary sale",
    "status": "CONFIRMED",
    "occurredAt": "2026-01-18T10:00:00.000Z",
    "requiresBoardApproval": false,
    "boardApprovedAt": null,
    "boardApprovedBy": null,
    "blockchainTxId": "0xdef456...",
    "dilutionImpact": null,
    "createdAt": "2026-01-18T10:00:00.000Z",
    "createdBy": "user-uuid"
  }
}
```

**Error Response** (404 Not Found):

```json
{
  "success": false,
  "error": {
    "code": "TXN_NOT_FOUND",
    "message": "Transacao nao encontrada",
    "messageKey": "errors.txn.notFound"
  }
}
```

### Approve Transaction

```
POST /api/v1/companies/:companyId/transactions/:transactionId/approve
```

Approves a transaction that requires board approval. Moves status from PENDING_APPROVAL to SUBMITTED.

**Request Body**:

```json
{
  "notes": "Approved by board resolution #42"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "SUBMITTED",
    "boardApprovedAt": "2026-01-20T16:00:00.000Z",
    "boardApprovedBy": "admin-uuid"
  }
}
```

**Error Response** (404 Not Found):

```json
{
  "success": false,
  "error": {
    "code": "TXN_NOT_FOUND",
    "message": "Transacao nao encontrada",
    "messageKey": "errors.txn.notFound"
  }
}
```

**Error Response** (422 — already approved):

```json
{
  "success": false,
  "error": {
    "code": "TXN_ALREADY_APPROVED",
    "message": "Transacao ja foi aprovada",
    "messageKey": "errors.txn.alreadyApproved"
  }
}
```

### Cancel Transaction

```
POST /api/v1/companies/:companyId/transactions/:transactionId/cancel
```

Cancels a transaction. Only allowed for transactions in DRAFT, PENDING_APPROVAL, or SUBMITTED status (not yet confirmed on-chain).

**Request Body**:

```json
{
  "reason": "Incorrect share class selected"
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CANCELLED",
    "cancelledAt": "2026-01-20T16:30:00.000Z",
    "cancelledBy": "admin-uuid"
  }
}
```

**Error Response** (422 — already cancelled):

```json
{
  "success": false,
  "error": {
    "code": "TXN_ALREADY_CANCELLED",
    "message": "Transacao ja foi cancelada",
    "messageKey": "errors.txn.alreadyCancelled"
  }
}
```

**Error Response** (422 — already confirmed, cannot cancel):

```json
{
  "success": false,
  "error": {
    "code": "TXN_ALREADY_APPROVED",
    "message": "Transacao ja foi aprovada",
    "messageKey": "errors.txn.alreadyApproved",
    "details": {
      "status": "CONFIRMED",
      "blockchainTxId": "0xabc123..."
    }
  }
}
```

---

## Frontend Implementation

### Routes

| Route | Page | Access |
|-------|------|--------|
| `/companies/[companyId]/transactions` | Transaction List | ADMIN, FINANCE, LEGAL, INVESTOR (own only) |
| `/companies/[companyId]/transactions/new` | Create Transaction (Wizard) | ADMIN |
| `/companies/[companyId]/transactions/[id]` | Transaction Detail | ADMIN, FINANCE, LEGAL |

### Pages

#### Transaction List Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  h1: Transactions                             [+ New Transaction]   │
│  body-sm: Equity movements and transaction history                  │
├─────────────────────────────────────────────────────────────────────┤
│  Filters: [Type ▾] [Status ▾] [Share Class ▾] [From ▾] [To ▾]     │
│  Date: [dd/mm/yyyy] to [dd/mm/yyyy]                    🔍 Search    │
├─────────────────────────────────────────────────────────────────────┤
│  Date       │ Type      │ From         │ To          │ Class │ Qty  │
│─────────────│───────────│──────────────│─────────────│───────│──────│
│  20/01/2026 │ ISSUANCE  │ —            │ Investor ABC│ PN-A  │150K  │
│  18/01/2026 │ TRANSFER  │ João Founder │ Maria       │ ON    │ 50K  │
│  15/01/2026 │ CANCEL    │ Ex-Employee  │ —           │ ON    │ 10K  │
├─────────────────────────────────────────────────────────────────────┤
│  │ Value       │ Status      │ Actions                              │
│  │ R$ 1.500.000│ ● CONFIRMED │ View                                 │
│  │ R$ 750.000  │ ● CONFIRMED │ View                                 │
│  │ R$ 100.000  │ ● PENDING   │ View | Approve | Cancel              │
├─────────────────────────────────────────────────────────────────────┤
│  Showing 1-20 of 42                                    < 1 2 3 >   │
└─────────────────────────────────────────────────────────────────────┘
```

**Table Columns:**

| Column | Field | Align | Format |
|--------|-------|-------|--------|
| Date | `occurredAt` | Left | Brazilian date: `dd/MM/yyyy` |
| Type | `transactionType` | Left | Badge (see Status Badge Mapping) |
| From | `fromShareholderName` | Left | Text or "—" for issuances |
| To | `toShareholderName` | Left | Text |
| Share Class | `shareClassName` | Left | Text |
| Quantity | `quantity` | Right | Brazilian number: `150.000` |
| Value | `totalValue` | Right | Currency: `R$ 1.500.000,00` |
| Status | `status` | Center | Badge (see Status Badge Mapping) |
| Actions | — | Right | View (always), Approve (PENDING_APPROVAL), Cancel (DRAFT/PENDING/SUBMITTED) |

**Status Badge Mapping:**

| Status | Badge Color | Label (PT-BR) | Label (EN) |
|--------|-------------|---------------|------------|
| `DRAFT` | gray (gray-100 bg, gray-600 text) | Rascunho | Draft |
| `PENDING_APPROVAL` | cream (cream-100 bg, cream-700 text) | Pendente | Pending |
| `SUBMITTED` | blue (blue-50 bg, blue-600 text) | Enviado | Submitted |
| `CONFIRMED` | green (green-100 bg, green-700 text) | Confirmado | Confirmed |
| `FAILED` | red (#FEE2E2 bg, #991B1B text) | Falhou | Failed |
| `CANCELLED` | gray (gray-100 bg, gray-500 text) | Cancelado | Cancelled |

**Transaction Type Badge Mapping:**

| Type | Badge Color | Label (PT-BR) | Label (EN) |
|------|-------------|---------------|------------|
| `ISSUANCE` | blue | Emissão | Issuance |
| `TRANSFER` | navy | Transferência | Transfer |
| `CONVERSION` | cream | Conversão | Conversion |
| `CANCELLATION` | red | Cancelamento | Cancellation |
| `SPLIT` | gray | Desdobramento | Split |

**Empty State:**
- Icon: `ArrowLeftRight` (lucide-react), 48px, gray-300
- Title: "Nenhuma transação registrada" / "No transactions recorded"
- Description: "Crie a primeira transação para movimentar participações." / "Create your first transaction to move equity."
- CTA: "Nova Transação" / "New Transaction" button (primary)

#### Create Transaction Page (3-Step Wizard)

**Step Indicator:** 3 steps at the top of the form:
1. Detalhes / Details
2. Revisão / Review
3. Confirmação / Confirmation

**Step 1 — Details:**

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Transactions                                    │
│  h1: New Transaction                                        │
│  body-sm: Create a new equity transaction                   │
├─────────────────────────────────────────────────────────────┤
│  Step: ●───○───○  Details                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Transaction Type *                                  │    │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │    │
│  │  │Issue │ │Trans.│ │Conv. │ │Cancel│ │Split │      │    │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │    │
│  │                                                      │    │
│  │  [Fields vary by type — see below]                   │    │
│  │                                                      │    │
│  │                              [Cancel]  [Next →]      │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Type-Specific Fields (Step 1):**

| Field | ISSUANCE | TRANSFER | CONVERSION | CANCELLATION | SPLIT |
|-------|----------|----------|------------|--------------|-------|
| From Shareholder | — | Required | Required | Required | — |
| To Shareholder | Required | Required | Same (auto) | — | — |
| Share Class | Required | Required | From Class (required) | Required | Required |
| To Share Class | — | — | To Class (required) | — | — |
| Quantity | Required | Required | Required | Required | — |
| Price per Share | Optional | Optional | — | Optional | — |
| Split Ratio | — | — | — | — | Required (e.g., "2:1") |
| Notes | Optional | Optional | Optional | Optional | Optional |

**Transaction Type Selector:** 5 selectable cards in a horizontal row:
- Each card: icon + label + short description
- ISSUANCE: `Plus` icon, "Emissão" / "Issuance", "Criar novas ações" / "Create new shares"
- TRANSFER: `ArrowLeftRight` icon, "Transferência" / "Transfer", "Mover ações entre acionistas" / "Move shares between shareholders"
- CONVERSION: `RefreshCw` icon, "Conversão" / "Conversion", "Converter entre classes" / "Convert between classes"
- CANCELLATION: `XCircle` icon, "Cancelamento" / "Cancellation", "Recomprar ou cancelar ações" / "Buyback or cancel shares"
- SPLIT: `GitBranch` icon, "Desdobramento" / "Split", "Dividir ou agrupar ações" / "Split or reverse-split shares"

**Shareholder Selectors:** Searchable dropdown (combobox) showing shareholder name + CPF/CNPJ (masked) + current shares in the selected class.

**Step 2 — Review:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step: ○───●───○  Review                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Transaction Summary                                 │    │
│  │  ┌───────────────────────────────────────────┐       │    │
│  │  │  Type:         Issuance                   │       │    │
│  │  │  To:           Investor ABC               │       │    │
│  │  │  Share Class:  Ações Preferenciais Classe A│       │    │
│  │  │  Quantity:     150.000 shares              │       │    │
│  │  │  Price:        R$ 10,00 per share          │       │    │
│  │  │  Total Value:  R$ 1.500.000,00             │       │    │
│  │  └───────────────────────────────────────────┘       │    │
│  │                                                      │    │
│  │  Dilution Impact                                     │    │
│  │  ┌───────────────────────────────────────────┐       │    │
│  │  │  ┌─────────┐      ┌─────────┐            │       │    │
│  │  │  │ Before  │  →   │ After   │            │       │    │
│  │  │  │ [donut] │      │ [donut] │            │       │    │
│  │  │  └─────────┘      └─────────┘            │       │    │
│  │  │                                           │       │    │
│  │  │  Shareholder    │ Before  │ After  │ Chg  │       │    │
│  │  │  João Founder   │ 70,59%  │ 60,00% │-10,6%│       │    │
│  │  │  Maria          │ 29,41%  │ 25,00% │ -4,4%│       │    │
│  │  │  Investor ABC   │  0,00%  │ 15,00% │+15,0%│       │    │
│  │  └───────────────────────────────────────────┘       │    │
│  │                                                      │    │
│  │  [⚠️ Warning: Dilution exceeds 10% for João Founder] │    │
│  │                                                      │    │
│  │  Board Approval: Not required                        │    │
│  │                                                      │    │
│  │                     [← Back]  [Confirm →]            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Dilution Preview Component:**
- Two side-by-side donut charts: "Before" and "After"
- Before chart shows current ownership
- After chart shows projected ownership post-transaction
- Below charts: table showing each affected shareholder with before/after percentages and change
- Change column: green for increases, red for decreases
- Warning banner if any shareholder is diluted by more than 10%
- Only shown for ISSUANCE and SPLIT types (types that change total shares)

**Step 3 — Confirmation:**

```
┌─────────────────────────────────────────────────────────────┐
│  Step: ○───○───●  Confirmation                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  [If requiresBoardApproval = false]                  │    │
│  │  ✓ Ready to submit                                   │    │
│  │  This transaction will be submitted to the           │    │
│  │  blockchain for processing.                          │    │
│  │                                                      │    │
│  │  [If requiresBoardApproval = true]                   │    │
│  │  ⏳ Pending board approval                           │    │
│  │  This transaction requires board approval before     │    │
│  │  it can be submitted to the blockchain.              │    │
│  │                                                      │    │
│  │                 [← Back]  [Submit Transaction]       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  [After submission — shows inline result]                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ✓ Transaction submitted successfully                │    │
│  │  Status: Submitted — waiting for blockchain          │    │
│  │  confirmation (~24 seconds)                          │    │
│  │                                                      │    │
│  │  [View Transaction]  [Create Another]                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  [On error]                                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ✕ Transaction failed                                │    │
│  │  Error: Insufficient shares available                │    │
│  │  Available: 10.000 | Requested: 15.000               │    │
│  │                                                      │    │
│  │  [← Back to Edit]  [Cancel]                          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

#### Transaction Detail Page

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Transactions                                    │
│  h1: Transaction #TXN-2026-0042          Badge: CONFIRMED   │
│  body-sm: Share Issuance — 20/01/2026 14:30                │
├─────────────────────────────────────────────────────────────┤
│  Status Timeline                                            │
│  ●─────────●─────────●─────────●                            │
│  DRAFT    SUBMITTED  CONFIRMED                              │
│  14:28    14:30      14:31                                  │
├─────────────────────────────────────────────────────────────┤
│  Transaction Details                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Type:          Issuance                            │    │
│  │  From:          — (new shares)                      │    │
│  │  To:            Investor ABC                        │    │
│  │  Share Class:   Ações Preferenciais Classe A        │    │
│  │  Quantity:      150.000 shares                      │    │
│  │  Price/Share:   R$ 10,00                            │    │
│  │  Total Value:   R$ 1.500.000,00                     │    │
│  │  Notes:         Series A investment                  │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Blockchain                                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Transaction Hash: 0xabc123...def456                │    │
│  │  Block Number:     12345678                         │    │
│  │  Confirmations:    24 / 12 required                 │    │
│  │  [View on BaseScan →]                               │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  [If PENDING_APPROVAL status — show approval section]       │
│  Approval Required                                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  This transaction requires board approval.           │    │
│  │  Approval Notes: [________________________]          │    │
│  │                                                      │    │
│  │            [Reject]  [Approve Transaction]           │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  [If cancellable — show cancel section]                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Cancel Reason: [________________________]           │    │
│  │                           [Cancel Transaction]       │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  Created by: Nelson Pereira — 20/01/2026 14:28             │
└─────────────────────────────────────────────────────────────┘
```

**Status Timeline Component:** Horizontal step indicator showing transaction lifecycle:
- Steps: DRAFT → PENDING_APPROVAL (if applicable) → SUBMITTED → CONFIRMED
- Completed steps: filled circle, green
- Current step: filled circle, blue, pulsing
- Failed: red circle with X
- Cancelled: gray circle with line-through
- Each step shows timestamp below

### Validation (Zod Schemas)

```typescript
import { z } from 'zod';

const baseTransactionSchema = z.object({
  transactionType: z.enum(['ISSUANCE', 'TRANSFER', 'CONVERSION', 'CANCELLATION', 'SPLIT']),
  notes: z.string().max(500).optional(),
});

export const issuanceSchema = baseTransactionSchema.extend({
  transactionType: z.literal('ISSUANCE'),
  toShareholderId: z.string().uuid(),
  shareClassId: z.string().uuid(),
  quantity: z.number().int().positive(),
  pricePerShare: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export const transferSchema = baseTransactionSchema.extend({
  transactionType: z.literal('TRANSFER'),
  fromShareholderId: z.string().uuid(),
  toShareholderId: z.string().uuid(),
  shareClassId: z.string().uuid(),
  quantity: z.number().int().positive(),
  pricePerShare: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export const conversionSchema = baseTransactionSchema.extend({
  transactionType: z.literal('CONVERSION'),
  fromShareholderId: z.string().uuid(),
  shareClassId: z.string().uuid(),
  toShareClassId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const cancellationSchema = baseTransactionSchema.extend({
  transactionType: z.literal('CANCELLATION'),
  fromShareholderId: z.string().uuid(),
  shareClassId: z.string().uuid(),
  quantity: z.number().int().positive(),
  pricePerShare: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export const splitSchema = baseTransactionSchema.extend({
  transactionType: z.literal('SPLIT'),
  shareClassId: z.string().uuid(),
  splitRatio: z.string().regex(/^\d+:\d+$/), // e.g., "2:1"
});

// Union schema — used by the wizard form
export const createTransactionSchema = z.discriminatedUnion('transactionType', [
  issuanceSchema,
  transferSchema,
  conversionSchema,
  cancellationSchema,
  splitSchema,
]);
```

### TanStack Query Hooks

```typescript
// frontend/src/hooks/use-transactions.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useTransactions(companyId: string, params?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  shareholderId?: string;
  shareClassId?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}) {
  return useQuery({
    queryKey: ['transactions', companyId, params],
    queryFn: () => api.getList<Transaction>(
      `/api/v1/companies/${companyId}/transactions`,
      params,
    ),
  });
}

export function useTransaction(companyId: string, id: string) {
  return useQuery({
    queryKey: ['transactions', companyId, id],
    queryFn: () => api.get<TransactionDetail>(
      `/api/v1/companies/${companyId}/transactions/${id}`,
    ),
    enabled: !!id,
  });
}

export function useCreateTransaction(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransactionDto) =>
      api.post<Transaction>(`/api/v1/companies/${companyId}/transactions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['cap-table', companyId] });
      queryClient.invalidateQueries({ queryKey: ['shareholders', companyId] });
    },
  });
}

export function useApproveTransaction(companyId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { notes?: string }) =>
      api.post(`/api/v1/companies/${companyId}/transactions/${id}/approve`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
    },
  });
}

export function useCancelTransaction(companyId: string, id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { reason: string }) =>
      api.post(`/api/v1/companies/${companyId}/transactions/${id}/cancel`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', companyId] });
    },
  });
}
```

### Component Hierarchy

```
TransactionListPage
├── PageHeader (title, description, "New Transaction" button)
├── TransactionFilters
│   ├── TypeDropdown
│   ├── StatusDropdown
│   ├── ShareClassDropdown
│   ├── ShareholderDropdown (from/to)
│   ├── DateRangePicker
│   └── SearchInput
├── TransactionTable
│   ├── TableHeader (sortable columns)
│   ├── TransactionRow (per row)
│   │   ├── TypeBadge
│   │   ├── StatusBadge
│   │   ├── CurrencyCell (Brazilian format)
│   │   └── RowActions (View, Approve, Cancel)
│   ├── TablePagination
│   └── EmptyState
└── CancelConfirmDialog

TransactionWizardPage
├── PageHeader (back link, title)
├── StepIndicator (3 steps)
└── WizardForm
    ├── Step1DetailsForm
    │   ├── TransactionTypeSelector (5 card options)
    │   └── TypeSpecificFields (dynamic based on selected type)
    │       ├── ShareholderCombobox (from/to)
    │       ├── ShareClassSelect
    │       ├── QuantityInput
    │       ├── PriceInput
    │       └── NotesTextarea
    ├── Step2ReviewForm
    │   ├── TransactionSummaryCard
    │   ├── DilutionPreview
    │   │   ├── BeforeDonutChart
    │   │   ├── AfterDonutChart
    │   │   └── DilutionTable (before/after/change per shareholder)
    │   ├── DilutionWarning (if > 10%)
    │   └── BoardApprovalIndicator
    └── Step3ConfirmForm
        ├── ReadyToSubmitMessage / PendingApprovalMessage
        ├── SubmitButton
        └── ResultDisplay (success / error)

TransactionDetailPage
├── PageHeader (back link, title, status badge)
├── StatusTimeline
├── TransactionDetailsCard
├── BlockchainStatusCard (tx hash, block, confirmations, BaseScan link)
├── ApprovalSection (if PENDING_APPROVAL)
│   ├── ApprovalNotesInput
│   └── ApproveButton / RejectButton
├── CancelSection (if cancellable)
│   ├── CancelReasonInput
│   └── CancelButton
└── MetadataFooter (created by, date)
```

### i18n Translation Keys

```json
{
  "transactions": {
    "title": "Transações",
    "description": "Movimentações de participação e histórico de transações",
    "newButton": "Nova Transação",
    "createTitle": "Nova Transação",
    "createDescription": "Crie uma nova transação de participação",
    "empty": {
      "title": "Nenhuma transação registrada",
      "description": "Crie a primeira transação para movimentar participações.",
      "cta": "Nova Transação"
    },
    "types": {
      "ISSUANCE": "Emissão",
      "TRANSFER": "Transferência",
      "CONVERSION": "Conversão",
      "CANCELLATION": "Cancelamento",
      "SPLIT": "Desdobramento"
    },
    "typeDescriptions": {
      "ISSUANCE": "Criar novas ações para um acionista",
      "TRANSFER": "Mover ações entre acionistas",
      "CONVERSION": "Converter ações entre classes",
      "CANCELLATION": "Recomprar ou cancelar ações",
      "SPLIT": "Dividir ou agrupar ações"
    },
    "statuses": {
      "DRAFT": "Rascunho",
      "PENDING_APPROVAL": "Pendente",
      "SUBMITTED": "Enviado",
      "CONFIRMED": "Confirmado",
      "FAILED": "Falhou",
      "CANCELLED": "Cancelado"
    },
    "table": {
      "date": "Data",
      "type": "Tipo",
      "from": "De",
      "to": "Para",
      "shareClass": "Classe",
      "quantity": "Quantidade",
      "value": "Valor",
      "status": "Status",
      "actions": "Ações",
      "newShares": "— (novas ações)",
      "cancelled": "— (canceladas)"
    },
    "wizard": {
      "steps": {
        "details": "Detalhes",
        "review": "Revisão",
        "confirmation": "Confirmação"
      },
      "form": {
        "transactionType": "Tipo de Transação",
        "fromShareholder": "Acionista de Origem",
        "toShareholder": "Acionista de Destino",
        "shareClass": "Classe de Ações",
        "toShareClass": "Classe de Destino",
        "quantity": "Quantidade",
        "pricePerShare": "Preço por Ação",
        "splitRatio": "Razão de Desdobramento",
        "splitRatioPlaceholder": "Ex: 2:1",
        "notes": "Observações",
        "notesPlaceholder": "Notas opcionais sobre a transação",
        "totalValue": "Valor Total",
        "selectShareholder": "Selecione um acionista",
        "selectShareClass": "Selecione uma classe",
        "availableShares": "{shares} ações disponíveis"
      },
      "review": {
        "title": "Resumo da Transação",
        "dilutionTitle": "Impacto na Diluição",
        "before": "Antes",
        "after": "Depois",
        "change": "Variação",
        "dilutionWarning": "Diluição superior a 10% para {name}",
        "boardApproval": "Aprovação do Conselho",
        "boardRequired": "Requer aprovação do conselho",
        "boardNotRequired": "Não requer aprovação"
      },
      "confirm": {
        "readyTitle": "Pronto para enviar",
        "readyDescription": "Esta transação será enviada para a blockchain para processamento.",
        "pendingTitle": "Pendente de aprovação",
        "pendingDescription": "Esta transação requer aprovação do conselho antes de ser enviada.",
        "submitButton": "Enviar Transação",
        "submitting": "Enviando...",
        "successTitle": "Transação enviada com sucesso",
        "successDescription": "Aguardando confirmação na blockchain (~24 segundos).",
        "errorTitle": "Falha na transação",
        "viewTransaction": "Ver Transação",
        "createAnother": "Criar Outra",
        "backToEdit": "Voltar para Editar"
      }
    },
    "detail": {
      "statusTimeline": "Linha do Tempo",
      "transactionDetails": "Detalhes da Transação",
      "blockchain": "Blockchain",
      "txHash": "Hash da Transação",
      "blockNumber": "Número do Bloco",
      "confirmations": "Confirmações",
      "requiredConfirmations": "necessárias",
      "viewOnBaseScan": "Ver no BaseScan",
      "approval": {
        "title": "Aprovação Necessária",
        "description": "Esta transação requer aprovação do conselho.",
        "notesLabel": "Notas de Aprovação",
        "approveButton": "Aprovar Transação",
        "rejectButton": "Rejeitar"
      },
      "cancel": {
        "reasonLabel": "Motivo do Cancelamento",
        "reasonPlaceholder": "Descreva o motivo do cancelamento",
        "cancelButton": "Cancelar Transação"
      },
      "createdBy": "Criado por {name} — {date}"
    }
  }
}
```

---

## Error Codes

| Code | HTTP Status | messageKey | Description |
|------|-------------|-----------|-------------|
| `TXN_NOT_FOUND` | 404 | `errors.txn.notFound` | Transaction does not exist or user has no access |
| `TXN_LOCKUP_ACTIVE` | 422 | `errors.txn.lockupActive` | Shares are in lock-up period |
| `TXN_ROFR_REQUIRED` | 422 | `errors.txn.rofrRequired` | Right of first refusal has not been exercised |
| `TXN_APPROVAL_REQUIRED` | 422 | `errors.txn.approvalRequired` | Transaction requires board/admin approval |
| `TXN_ALREADY_APPROVED` | 422 | `errors.txn.alreadyApproved` | Transaction has already been approved |
| `TXN_ALREADY_CANCELLED` | 422 | `errors.txn.alreadyCancelled` | Transaction has already been cancelled |
| `TXN_INVALID_TYPE` | 422 | `errors.txn.invalidType` | Transaction type is not valid for this operation |
| `TXN_DILUTION_EXCEEDS_THRESHOLD` | 422 | `errors.txn.dilutionExceedsThreshold` | Dilution exceeds configured warning threshold (warning, not blocking) |
| `CAP_INSUFFICIENT_SHARES` | 422 | `errors.cap.insufficientShares` | Not enough shares to complete the operation |
| `CAP_NEGATIVE_BALANCE` | 422 | `errors.cap.negativeBalance` | Operation would result in negative balance |

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
1. Admin navigates to "Transactions" -> "New Issuance"
2. Admin selects shareholder: "Investor ABC"
3. Admin selects share class: "Acoes Preferenciais Classe A"
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
**Scenario**: Admin tries to transfer more shares than the sender holds.
**Handling**: Return `CAP_INSUFFICIENT_SHARES` (422) with `details` showing available and requested amounts. Frontend displays the error with specific numbers.

### EC-2: Transaction Fails on Blockchain
**Scenario**: On-chain transaction reverts after submission.
**Handling**: Bull job retries automatically up to 3 times with exponential backoff. If all retries fail, mark transaction as FAILED, send admin notification, and log `CHAIN_TX_FAILED` error to Sentry.

### EC-3: Duplicate Transaction Detection
**Scenario**: Admin accidentally submits the same transaction twice within 5 minutes.
**Handling**: Backend checks for duplicate transactions (same shareholders, same quantity, same share class) within a 5-minute window. If duplicate detected, return a warning (not a hard block) and require admin confirmation to proceed.

### EC-4: Lock-Up Period Violation
**Scenario**: Admin attempts to transfer shares that are still in a lock-up period.
**Handling**: Return `TXN_LOCKUP_ACTIVE` (422) with `details.lockupExpiresAt` showing when the lock-up ends. Frontend displays the lock-up expiry date and prevents submission.

---

## Dependencies

- **Shareholders**: Transactions reference from/to shareholders
- **Share Classes**: Transactions specify which share class
- **Blockchain**: All transactions recorded on-chain
- **Cap Table**: Transactions trigger cap table recalculation

---

## Related Specifications

- `cap-table.md` — Cap table recalculation triggered by confirmed transactions
- `shareholders.md` — Shareholder balance updates after transactions
- `share-classes.md` — Share class validation and authorized share limits
- `blockchain.md` — On-chain transaction submission and confirmation
- `funding-rounds.md` — Funding round transactions (issuances from round closes)
- `api-standards.md` — Response envelope, pagination, error format
- `error-handling.md` — TXN_* and CAP_* error codes, retry strategies
- `audit-logging.md` — SHARES_ISSUED, SHARES_TRANSFERRED, SHARES_CANCELLED, TRANSACTION_* events

---

## Success Criteria

- Transaction submission: < 5 seconds
- Transaction confirmation: < 30 seconds
- 99% success rate for valid transactions
- Zero unauthorized transactions
- 100% cap table accuracy after transactions
- All API responses use standard envelope format
- Error responses include proper error codes and messageKeys
- Pagination, filtering, and sorting work on transaction list endpoint
