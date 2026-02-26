# Option Exercises Specification

**Topic of Concern**: Employee option exercise requests and payment confirmation

**One-Sentence Description**: The system processes employee option exercise requests where employees pay the strike price via bank transfer, admins confirm payment, and shares are issued on-chain.

---

## Overview

When employees want to exercise vested options, they submit an exercise request specifying quantity. The system calculates the amount due (quantity x strike price), provides bank transfer instructions, and creates a pending request. After the employee transfers money to the company bank account, an admin confirms payment receipt. Upon confirmation, the backend submits a blockchain transaction to issue shares, converting options to actual equity.

**Flow**: Employee requests -> System calculates cost -> Employee pays via bank -> Admin confirms -> Shares issued on-chain

---

## User Stories

### US-1: Request Option Exercise
**As an** employee
**I want to** request to exercise 5,000 vested options
**So that** I can convert my options to actual shares

### US-2: Receive Payment Instructions
**As an** employee who requested exercise
**I want to** see bank transfer instructions and amount due
**So that** I know where to send payment

### US-3: Confirm Payment Received
**As an** admin user
**I want to** confirm when employee payment is received
**So that** shares can be issued automatically

### US-4: Track Exercise Status
**As an** employee
**I want to** see the status of my exercise request
**So that** I know when shares will be issued

---

## Functional Requirements

### FR-1: Exercise Request Creation
- Employee submits request for specific quantity
- System validates: quantity <= vested options
- System calculates amount due: quantity x strike price
- System creates pending request with payment instructions

### FR-2: Payment Method
- Employee pays via bank transfer (PIX, TED, DOC)
- System provides company bank details
- System generates unique payment reference code
- Employee includes reference in transfer

### FR-3: Admin Payment Confirmation
- Admin reviews pending exercise requests
- Admin verifies payment received in bank account
- Admin matches payment reference to request
- Admin clicks "Confirm Payment"
- System triggers share issuance automatically

### FR-4: Automatic Share Issuance
- Upon payment confirmation, backend calls blockchain service
- Issues shares via admin wallet (OCP smart contract)
- Updates cap table automatically
- Marks exercise request as "completed"
- Sends confirmation email to employee

### FR-5: Exercise Request Lifecycle
- Status: PENDING_PAYMENT -> PAYMENT_CONFIRMED -> SHARES_ISSUED -> COMPLETED

---

## Data Models

```typescript
interface OptionExerciseRequest {
  id: string;
  option_grant_id: string;
  user_id: string;                   // Employee exercising

  // Request Details
  quantity_requested: number;
  strike_price: number;              // From grant
  amount_due: number;                // Quantity x strike price

  // Payment
  payment_status: 'PENDING' | 'CONFIRMED';
  payment_reference: string;         // Unique code for bank transfer
  payment_date: Date | null;
  payment_confirmed_at: Date | null;
  payment_confirmed_by: string | null;  // Admin user ID
  payment_notes: string | null;

  // Share Issuance
  blockchain_tx_hash: string | null;
  shares_issued_at: Date | null;

  // Status
  status: 'PENDING_PAYMENT' | 'PAYMENT_CONFIRMED' | 'SHARES_ISSUED' | 'COMPLETED' | 'CANCELLED';

  // Dates
  requested_at: Date;
  completed_at: Date | null;

  created_at: Date;
}
```

---

## API Endpoints

### POST /api/v1/companies/:companyId/option-grants/:grantId/exercise

Employee creates an exercise request.

**Request**:
```json
{
  "quantity": 5000,
  "paymentMethod": "PIX"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "optionGrantId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "quantity": 5000,
    "strikePrice": "5.00",
    "amountDue": "25000.00",
    "paymentReference": "EX-2026-001-ABC123",
    "paymentMethod": "PIX",
    "bankDetails": {
      "bankName": "Banco do Brasil",
      "accountHolder": "Startup XYZ Ltda.",
      "accountNumber": "12345-6",
      "pixKey": "12.345.678/0001-90"
    },
    "instructions": "Transfira R$ 25.000,00 e inclua o código de referência EX-2026-001-ABC123",
    "status": "PENDING_PAYMENT",
    "requestedAt": "2026-02-23T10:00:00.000Z",
    "createdAt": "2026-02-23T10:00:00.000Z"
  }
}
```

### GET /api/v1/companies/:companyId/option-grants/:grantId/exercise

Get the exercise request status for a specific grant.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "optionGrantId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "quantity": 5000,
    "strikePrice": "5.00",
    "amountDue": "25000.00",
    "paymentReference": "EX-2026-001-ABC123",
    "paymentStatus": "PENDING",
    "status": "PENDING_PAYMENT",
    "blockchainTxHash": null,
    "requestedAt": "2026-02-23T10:00:00.000Z",
    "createdAt": "2026-02-23T10:00:00.000Z"
  }
}
```

### GET /api/v1/companies/:companyId/option-exercises

Admin views all exercise requests for the company with pagination.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `status` | string | — | Filter: `PENDING_PAYMENT`, `PAYMENT_CONFIRMED`, `SHARES_ISSUED`, `COMPLETED`, `CANCELLED` |
| `sort` | string | `-requestedAt` | Sort field |

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
      "optionGrantId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "shareholderName": "Maria Silva",
      "quantity": 5000,
      "amountDue": "25000.00",
      "paymentReference": "EX-2026-001-ABC123",
      "requestedAt": "2026-02-23T10:00:00.000Z",
      "status": "PENDING_PAYMENT"
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### POST /api/v1/companies/:companyId/option-grants/:grantId/exercise/:exerciseId/confirm

Admin confirms payment received and triggers share issuance.

**Request**:
```json
{
  "paymentDate": "2026-02-25",
  "paymentNotes": "PIX received, reference matched"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "status": "PAYMENT_CONFIRMED",
    "paymentConfirmedAt": "2026-02-25T14:30:00.000Z",
    "blockchainTxHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "message": "Share issuance initiated"
  }
}
```

### POST /api/v1/companies/:companyId/option-grants/:grantId/exercise/:exerciseId/cancel

Employee or admin cancels an exercise request. Only allowed while status is `PENDING_PAYMENT`.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "status": "CANCELLED",
    "cancelledAt": "2026-02-24T09:00:00.000Z"
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description | messageKey |
|------|-------------|-------------|------------|
| `OPT_EXERCISE_PENDING` | 422 | An exercise request is already pending for this grant | `errors.opt.exercisePending` |
| `OPT_EXERCISE_NOT_FOUND` | 404 | Exercise request does not exist | `errors.opt.exerciseNotFound` |
| `OPT_EXERCISE_WINDOW_CLOSED` | 422 | Post-termination exercise window has expired | `errors.opt.exerciseWindowClosed` |
| `OPT_INSUFFICIENT_VESTED` | 422 | Not enough vested options to exercise the requested quantity | `errors.opt.insufficientVested` |
| `OPT_GRANT_NOT_FOUND` | 404 | Option grant does not exist or is not accessible | `errors.opt.grantNotFound` |
| `OPT_GRANT_TERMINATED` | 422 | Option grant has been terminated | `errors.opt.grantTerminated` |
| `CHAIN_TX_FAILED` | 422 | On-chain share issuance transaction failed | `errors.chain.txFailed` |
| `CHAIN_CONTRACT_NOT_DEPLOYED` | 422 | Company smart contract not yet deployed | `errors.chain.contractNotDeployed` |
| `VAL_INVALID_INPUT` | 400 | One or more request fields failed validation | `errors.val.invalidInput` |

**Error Response Example**:
```json
{
  "success": false,
  "error": {
    "code": "OPT_INSUFFICIENT_VESTED",
    "message": "Opções vested insuficientes para exercício",
    "messageKey": "errors.opt.insufficientVested",
    "details": {
      "vestedOptions": 5000,
      "requestedQuantity": 10000
    }
  }
}
```

---

## Business Rules

### BR-1: Vesting Validation
- Employee can only exercise vested options
- quantity_requested <= (vested_options - already_exercised)

### BR-2: Payment Reference Uniqueness
- Each exercise request gets unique payment reference
- Reference format: EX-YYYY-NNN-XXXXXX

### BR-3: Admin-Only Payment Confirmation
- Only admin users can confirm payments
- Confirmation triggers automatic share issuance
- Confirmation is irreversible

### BR-4: Exercise Window
- Active employees: Can exercise anytime
- Terminated employees: 90-day post-termination window
- After expiration, unvested options cancelled

### BR-5: Automatic Processing
- Upon payment confirmation:
  1. Update exercise request status
  2. Call blockchain service to issue shares
  3. Update option grant (reduce outstanding options)
  4. Update cap table
  5. Send confirmation email

---

## User Flows

### Flow 1: Employee Requests Exercise

```
1. Employee navigates to "My Options" page
2. System shows: 10,000 options granted, 5,000 vested, 5,000 unvested
3. Employee clicks "Exercise Options"
4. System displays form: "How many options to exercise?"
5. Employee enters: 5,000
6. System validates: 5,000 <= 5,000 vested
7. System calculates: 5,000 x R$ 5.00 = R$ 25,000.00
8. System shows payment summary:
   - Quantity: 5,000 options
   - Strike Price: R$ 5.00
   - Total Amount Due: R$ 25,000.00
9. Employee confirms
10. System creates OptionExerciseRequest
11. System displays payment instructions:
    - Bank: Banco do Brasil
    - Account: 12345-6
    - PIX: 12.345.678/0001-90
    - Reference: EX-2026-001-ABC123
    - Amount: R$ 25,000.00
12. Employee copies bank details
13. Employee makes bank transfer via PIX
14. System shows: "Waiting for payment confirmation by admin"

POSTCONDITION: Exercise request created (status: PENDING_PAYMENT)
```

### Flow 2: Admin Confirms Payment

```
PRECONDITION: Employee transferred R$ 25,000 via PIX

1. Admin navigates to "Option Exercises" admin panel
2. System displays list of pending exercise requests
3. Admin sees: Maria Silva - 5,000 options - R$ 25,000 - Ref: EX-2026-001-ABC123
4. Admin checks company bank account
5. Admin finds PIX transfer: R$ 25,000.00, Description: "EX-2026-001-ABC123"
6. Admin clicks "Confirm Payment" on Maria's request
7. System displays confirmation modal:
   - Employee: Maria Silva
   - Amount: R$ 25,000.00
   - Reference: EX-2026-001-ABC123
   - "Once confirmed, 5,000 shares will be issued. Continue?"
8. Admin enters payment date and optional notes
9. Admin clicks "Confirm"
10. System updates request status: PAYMENT_CONFIRMED
11. System calls BlockchainService.issueShares():
    - to_address: Maria's wallet
    - share_class: Common Shares
    - quantity: 5,000
12. Blockchain transaction submitted (tx hash: 0x...)
13. System updates request: blockchain_tx_hash
14. After ~24 seconds, transaction confirmed
15. System updates request status: SHARES_ISSUED
16. System updates OptionGrant: exercised += 5,000
17. System updates CapTable: Maria now has 5,000 shares
18. System sends email to Maria: "Your shares have been issued! View on Basescan"
19. Admin sees: Request status "Completed"

POSTCONDITION: Shares issued on-chain, cap table updated, employee notified
```

---

## Edge Cases

### EC-1: Insufficient Vested Options
**Scenario**: Employee requests 10,000 but only 5,000 vested
**Handling**: Return `OPT_INSUFFICIENT_VESTED` (422) with `vestedOptions` and `requestedQuantity` in error details.

### EC-2: Payment Amount Mismatch
**Scenario**: Employee transfers R$ 20,000 instead of R$ 25,000
**Handling**: Admin sees warning in confirmation, can add notes, may reject and ask employee to complete payment.

### EC-3: Blockchain Transaction Fails
**Scenario**: Share issuance transaction fails on blockchain
**Handling**:
- Retry automatically up to 3 times
- If all fail, alert admin
- Do NOT mark as completed until on-chain confirmation
- Employee payment already received, so must resolve

### EC-4: Employee Cancels After Payment
**Scenario**: Employee wants to cancel after transferring money
**Handling**: Admin must refund payment manually, then cancel request in system.

### EC-5: Duplicate Exercise Request
**Scenario**: Employee submits a second exercise request while one is already pending.
**Handling**: Return `OPT_EXERCISE_PENDING` (422). Only one pending exercise request is allowed per grant at a time.

### EC-6: Exercise After Termination Window
**Scenario**: A terminated employee attempts to exercise options after the 90-day post-termination window has closed.
**Handling**: Return `OPT_EXERCISE_WINDOW_CLOSED` (422). The employee can no longer exercise. Unvested options are already forfeited; vested but unexercised options are also forfeited.

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [option-plans.md](./option-plans.md) | Exercise requests reference option grants defined in option plans |
| [transactions.md](./transactions.md) | Each exercise creates a share issuance transaction |
| [cap-table-management.md](./cap-table-management.md) | Exercised options create new shareholdings that affect the cap table |
| [blockchain-integration.md](./blockchain-integration.md) | On-chain share issuance via the OCP smart contract |
| [shareholder-registry.md](./shareholder-registry.md) | Employee becomes a shareholder upon exercise completion |
| [notifications.md](./notifications.md) | Email notifications for exercise request submitted, payment confirmed, shares issued |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, pagination, and URL conventions for exercise endpoints |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: OPT_INSUFFICIENT_VESTED, OPT_EXERCISE_PENDING, OPT_EXERCISE_NOT_FOUND, OPT_EXERCISE_WINDOW_CLOSED |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: OPTION_EXERCISE_REQUESTED, OPTION_EXERCISE_CONFIRMED, OPTION_EXERCISE_REJECTED |

---

## Dependencies

- **Option Plans**: Exercise requests reference option grants
- **Blockchain**: Share issuance happens on-chain
- **Cap Table**: Exercises update cap table automatically
- **Notifications**: Emails sent at key status changes

---

## Frontend Implementation

### FE-1: Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard/options` (Exercises tab) | ExercisesTab | Admin list of all exercise requests |
| `/dashboard/options/exercises/[exerciseId]` | ExerciseDetailPage | Exercise detail with payment confirmation |

**Entry points**:
- Admin/Finance: "Exercises" tab within the Options page (`/dashboard/options`)
- Employee: "Exercise Options" button on My Options page (`/dashboard/options/my-options`) triggers `ExerciseOptionsModal`
- Employee: Exercise status visible on My Options page via `ExerciseStatusTracker`

### FE-2: Page Layouts

#### Exercises Tab (Admin View, within OptionsPage)

```
┌─────────────────────────────────────────────────────────┐
│  [Plans] [Grants] [Exercises ←active]                   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │Pending       │ │Payment       │ │Completed     │   │
│  │Payment       │ │Confirmed     │ │              │   │
│  │  3           │ │  2           │ │  12          │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Filters: [Status ▼]  🔍 Search                        │
├─────────────────────────────────────────────────────────┤
│  Exercises Table (paginated)                            │
│  ...                                                    │
├─────────────────────────────────────────────────────────┤
│  Showing 1-10 of 17                    < 1 2 >         │
└─────────────────────────────────────────────────────────┘
```

#### Exercise Detail Page

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Exercises    StatusBadge    [Actions ▼]      │
│  h1: Exercício — João Silva                             │
│  body-sm: Solicitado em 15/02/2026                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Quantity  │ │Strike    │ │Amount    │ │Grant     │  │
│  │  5.000   │ │Price     │ │Due       │ │          │  │
│  │          │ │R$ 1,50   │ │R$ 7.500  │ │ESOP 2026 │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
├─────────────────────────────────────────────────────────┤
│  ExerciseStatusTracker (5-step horizontal indicator)    │
│  ● Solicitado → ● Pgto Pendente → ○ Confirmado →      │
│  ○ Ações Emitidas → ○ Concluído                        │
├─────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐ │
│  │ PaymentReferenceDisplay                            │ │
│  │ Referência: EX-2026-0042          [📋 Copiar]     │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────┐ │
│  │ BankDetailsCard                                    │ │
│  │ Banco: Banco do Brasil                             │ │
│  │ Titular: Empresa XYZ Ltda.        [📋]            │ │
│  │ Conta: 12345-6                    [📋]            │ │
│  │ Agência: 1234                     [📋]            │ │
│  │ PIX: empresa@pix.com             [📋]            │ │
│  └────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  [Confirmar Pagamento]  [Cancelar Exercício]            │
└─────────────────────────────────────────────────────────┘
```

### FE-3: Components

| Component | Description | Props |
|-----------|-------------|-------|
| `ExerciseRequestForm` | Form with quantity slider+input, live cost calculation, payment method | `grantId: string`, `exercisableQuantity: number`, `strikePrice: number`, `onSuccess: () => void` |
| `ExerciseStatusTracker` | Horizontal 5-step status indicator | `status: ExerciseStatus` |
| `BankDetailsCard` | Card with bank name, account holder, account number, PIX key — all fields copyable | `bankDetails: BankDetails` |
| `PaymentReferenceDisplay` | Large monospace reference code with copy button | `referenceCode: string` |
| `ExerciseOptionsModal` | Multi-step modal for employee exercise request | `grantId: string`, `exercisableQuantity: number`, `strikePrice: number`, `onSuccess: () => void` |
| `ConfirmExercisePaymentModal` | Admin modal to confirm payment receipt | `exerciseId: string`, `amountDue: number`, `onSuccess: () => void` |
| `CancelExerciseModal` | Destructive confirmation modal | `exerciseId: string`, `onSuccess: () => void` |
| `ExerciseStatCards` | 3 stat cards for exercise metrics (Pending, Confirmed, Completed) | `companyId: string` |
| `ExerciseStatusBadge` | Status pill badge for exercise status | `status: ExerciseStatus` |

### FE-4: Tables

#### Exercises Table (Admin View)

| Column | Field | Type | Sortable | Alignment |
|--------|-------|------|----------|-----------|
| Employee | `grant.shareholder.name` | text with avatar | Yes | Left |
| Quantity | `quantity` | number | Yes | Right |
| Amount Due | `amountDue` | currency (BRL) | Yes | Right |
| Reference | `referenceCode` | monospace text (copyable) | No | Left |
| Status | `status` | ExerciseStatusBadge | Yes | Center |
| Requested | `createdAt` | date (dd/MM/yyyy) | Yes | Left |
| Actions | — | icon buttons (confirm, cancel) | No | Right |

- Default sort: `-createdAt`
- Empty state: "Nenhuma solicitação de exercício" / "No exercise requests"
- **Row highlight**: Rows with `PENDING_PAYMENT` status get a subtle `cream-50` background to draw attention
- **Actions column**: "Confirm" button visible for ADMIN/FINANCE when status is `PENDING_PAYMENT`. "Cancel" visible for ADMIN when not completed.

### FE-5: Forms

#### Exercise Request (Employee, inside ExerciseOptionsModal)

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `quantity` | Quantidade de Opções | slider + number input (dual control) | > 0, <= exercisable quantity, integer | Yes |
| `paymentMethod` | Método de Pagamento | select (BANK_TRANSFER, PIX) | must select | Yes |

- **Live calculation**: Below the quantity field, display: `{quantity} × R$ {strikePrice} = R$ {amountDue}`
- **Slider**: Range from 1 to exercisable quantity. Steps of 100 (or 1 if exercisable < 100).
- **Max exercisable display**: "Máximo exercível: {exercisableQuantity} opções" above the slider

#### Confirm Payment (Admin, inside ConfirmExercisePaymentModal)

| Field | Label | Type | Validation | Required |
|-------|-------|------|------------|----------|
| `paymentDate` | Data do Pagamento | date picker | <= today | Yes |
| `paymentNotes` | Observações | textarea | max 500 chars | No |

- **Warning**: Yellow banner "Ao confirmar o pagamento, as ações serão emitidas automaticamente na blockchain. Esta ação é irreversível."
- **Summary display**: Shows exercise quantity, amount due, employee name, reference code
- **Submit**: "Confirmar Pagamento e Emitir Ações"

### FE-6: Visualizations

#### Exercise Status Tracker

- **Type**: Horizontal step indicator (not a chart)
- **Steps** (5):
  1. Solicitado / Requested — icon: clipboard
  2. Pagamento Pendente / Pending Payment — icon: clock
  3. Pagamento Confirmado / Payment Confirmed — icon: check-circle
  4. Ações Emitidas / Shares Issued — icon: trending-up
  5. Concluído / Completed — icon: check-double

- **Active step**: `ocean-600` fill, white icon
- **Completed steps**: `celadon-600` fill, white checkmark icon
- **Pending steps**: `gray-200` fill, `gray-400` icon
- **Connector lines**: `celadon-600` between completed steps, `gray-200` between pending
- **Height**: 64px total (icon 32px + label 16px + gap)

### FE-7: Modals & Dialogs

| Modal | Size | Type | Steps | Key Elements |
|-------|------|------|-------|--------------|
| ExerciseOptionsModal | Medium (560px) | Wizard | 3 | Step 1: Quantity (slider + input + live calculation), Step 2: Review (summary + bank details preview), Step 3: Confirm (irreversible warning + submit) |
| ConfirmExercisePaymentModal | Small (400px) | Form | 1 | Exercise summary, payment date, notes, warning about automatic share issuance, confirm button |
| CancelExerciseModal | Small (400px) | Destructive | 1 | Warning text, cancellation reason textarea, red "Cancelar Exercício" button |

**ExerciseOptionsModal wizard steps**:
1. **Quantidade**: Slider + number input for quantity. Live cost calculation display. Payment method select.
2. **Revisar**: Summary card (quantity, strike price, amount due, payment method). Bank details card with copy buttons. Payment reference code prominently displayed.
3. **Confirmar**: "Após confirmar, realize a transferência bancária com a referência indicada." Checkbox: "Eu entendo que devo realizar o pagamento para concluir o exercício." Submit: "Solicitar Exercício"

### FE-8: Status Badges

| Status | Background | Text Color | Label (PT-BR) | Label (EN) |
|--------|-----------|------------|----------------|------------|
| `PENDING_PAYMENT` | `cream-100` | `cream-700` | Pagamento Pendente | Pending Payment |
| `PAYMENT_CONFIRMED` | `blue-50` | `blue-600` | Pagamento Confirmado | Payment Confirmed |
| `SHARES_ISSUED` | `green-100` | `green-700` | Ações Emitidas | Shares Issued |
| `COMPLETED` | `green-100` | `green-700` | Concluído | Completed |
| `CANCELLED` | `gray-100` | `gray-600` | Cancelado | Cancelled |

### FE-9: Role-Based UI

| Action | ADMIN | FINANCE | LEGAL | EMPLOYEE |
|--------|-------|---------|-------|----------|
| View Exercises tab | Yes | Yes | No | No |
| View exercise detail | Yes | Yes | No | Own exercises only |
| Confirm payment | Yes | Yes | No | No |
| Cancel exercise | Yes | No | No | No |
| Request exercise | No | No | No | Yes (from My Options) |
| View bank details | Yes | Yes | No | Yes (own exercise only) |
| View payment reference | Yes | Yes | No | Yes (own exercise only) |

- **EMPLOYEE**: Initiates exercise from "My Options" page. Sees exercise status tracker and bank details on their grant card. Cannot access Exercises admin tab.
- **FINANCE**: Can view all exercises and confirm payments. Cannot cancel exercises.
- **ADMIN**: Full access to all exercise actions.

### FE-10: API Integration (TanStack Query)

```typescript
// Query key factory
const exerciseKeys = {
  all: (companyId: string) => ['option-exercises', companyId] as const,
  list: (companyId: string, filters?: ExerciseFilters) => [...exerciseKeys.all(companyId), 'list', filters] as const,
  detail: (companyId: string, exerciseId: string) => [...exerciseKeys.all(companyId), exerciseId] as const,
  myExercises: (companyId: string) => [...exerciseKeys.all(companyId), 'my'] as const,
};

// Hooks
function useExerciseRequests(companyId: string, filters?: ExerciseFilters);
function useExerciseRequest(companyId: string, exerciseId: string);
function useMyExerciseRequests(companyId: string);
function useRequestExercise(companyId: string);                         // POST mutation
function useConfirmExercisePayment(companyId: string, exerciseId: string);  // POST mutation
```

**Cache invalidation on confirm payment**:
- Invalidate `exerciseKeys.all` (exercise status changes)
- Invalidate `optionKeys.grants.all` (grant exercised quantity updates)
- Invalidate `optionKeys.plans.all` (plan exercised count updates)
- Invalidate `['cap-table', companyId]` (new shares issued)
- Invalidate `['transactions', companyId]` (exercise transaction created)

### FE-11: i18n Keys

Namespace: `options.exercises`

```
options.exercises.title = "Exercícios" / "Exercises"
options.exercises.subtitle = "Solicitações de exercício de opções" / "Option exercise requests"

options.exercises.stats.pendingPayment = "Pagamento Pendente" / "Pending Payment"
options.exercises.stats.paymentConfirmed = "Pagamento Confirmado" / "Payment Confirmed"
options.exercises.stats.completed = "Concluídos" / "Completed"

options.exercises.table.employee = "Funcionário" / "Employee"
options.exercises.table.quantity = "Quantidade" / "Quantity"
options.exercises.table.amountDue = "Valor Devido" / "Amount Due"
options.exercises.table.reference = "Referência" / "Reference"
options.exercises.table.status = "Status" / "Status"
options.exercises.table.requestedDate = "Data da Solicitação" / "Requested Date"
options.exercises.table.actions = "Ações" / "Actions"
options.exercises.table.empty = "Nenhuma solicitação de exercício" / "No exercise requests"

options.exercises.status.pendingPayment = "Pagamento Pendente" / "Pending Payment"
options.exercises.status.paymentConfirmed = "Pagamento Confirmado" / "Payment Confirmed"
options.exercises.status.sharesIssued = "Ações Emitidas" / "Shares Issued"
options.exercises.status.completed = "Concluído" / "Completed"
options.exercises.status.cancelled = "Cancelado" / "Cancelled"

options.exercises.request.title = "Exercer Opções" / "Exercise Options"
options.exercises.request.step1 = "Quantidade" / "Quantity"
options.exercises.request.step2 = "Revisar" / "Review"
options.exercises.request.step3 = "Confirmar" / "Confirm"
options.exercises.request.quantity = "Quantidade de Opções" / "Option Quantity"
options.exercises.request.maxExercisable = "Máximo exercível: {count} opções" / "Max exercisable: {count} options"
options.exercises.request.paymentMethod = "Método de Pagamento" / "Payment Method"
options.exercises.request.bankTransfer = "Transferência Bancária" / "Bank Transfer"
options.exercises.request.pix = "PIX" / "PIX"
options.exercises.request.calculation = "{quantity} × R$ {price} = R$ {total}" / "{quantity} × R$ {price} = R$ {total}"
options.exercises.request.paymentInstructions = "Após confirmar, realize a transferência bancária com a referência indicada" / "After confirming, make the bank transfer with the indicated reference"
options.exercises.request.confirmCheckbox = "Eu entendo que devo realizar o pagamento para concluir o exercício" / "I understand that I must make the payment to complete the exercise"
options.exercises.request.submit = "Solicitar Exercício" / "Request Exercise"

options.exercises.payment.title = "Confirmar Pagamento" / "Confirm Payment"
options.exercises.payment.date = "Data do Pagamento" / "Payment Date"
options.exercises.payment.notes = "Observações" / "Notes"
options.exercises.payment.warning = "Ao confirmar o pagamento, as ações serão emitidas automaticamente na blockchain. Esta ação é irreversível." / "Upon confirming payment, shares will be automatically issued on the blockchain. This action is irreversible."
options.exercises.payment.confirm = "Confirmar Pagamento e Emitir Ações" / "Confirm Payment and Issue Shares"

options.exercises.bank.title = "Dados Bancários" / "Bank Details"
options.exercises.bank.bankName = "Banco" / "Bank"
options.exercises.bank.accountHolder = "Titular" / "Account Holder"
options.exercises.bank.accountNumber = "Conta" / "Account Number"
options.exercises.bank.branchCode = "Agência" / "Branch Code"
options.exercises.bank.pixKey = "Chave PIX" / "PIX Key"
options.exercises.bank.reference = "Referência de Pagamento" / "Payment Reference"
options.exercises.bank.copySuccess = "Copiado!" / "Copied!"

options.exercises.cancel.title = "Cancelar Exercício" / "Cancel Exercise"
options.exercises.cancel.warning = "Esta ação cancelará a solicitação de exercício" / "This will cancel the exercise request"
options.exercises.cancel.reason = "Motivo do Cancelamento" / "Cancellation Reason"
options.exercises.cancel.confirm = "Cancelar Exercício" / "Cancel Exercise"

options.exercises.tracker.requested = "Solicitado" / "Requested"
options.exercises.tracker.pendingPayment = "Pgto Pendente" / "Pending Payment"
options.exercises.tracker.confirmed = "Confirmado" / "Confirmed"
options.exercises.tracker.sharesIssued = "Ações Emitidas" / "Shares Issued"
options.exercises.tracker.completed = "Concluído" / "Completed"
```

### FE-12: Error Handling UI

| Error Code | HTTP Status | UI Behavior |
|------------|-------------|-------------|
| `OPT_INSUFFICIENT_VESTED` | 422 | Show on exercise form: inline error below quantity with "Opções insuficientes. Exercível: {exercisable}" from `details.exercisableQuantity` |
| `OPT_EXERCISE_PENDING` | 422 | Toast info "Já existe uma solicitação de exercício pendente para esta concessão" with link to existing exercise from `details.existingExerciseId` |
| `OPT_EXERCISE_NOT_FOUND` | 404 | Redirect to exercises list with toast "Solicitação de exercício não encontrada" |
| `OPT_EXERCISE_WINDOW_CLOSED` | 422 | Toast error "O período de exercício está encerrado para esta concessão" |
| `OPT_GRANT_TERMINATED` | 422 | Toast warning "Esta concessão foi cancelada ou expirada" |
| `CHAIN_TX_FAILED` | 502 | Warning toast "Pagamento confirmado, mas emissão de ações na blockchain falhou. As ações serão emitidas assim que a blockchain estiver disponível." Keep exercise in PAYMENT_CONFIRMED status. Show retry option for admin. |
| `CHAIN_TX_TIMEOUT` | 504 | Warning toast "Transação na blockchain em processamento. Aguarde confirmação." |
| `VAL_INVALID_INPUT` | 400 | Map `validationErrors` to form field errors |
| `SYS_RATE_LIMITED` | 429 | Toast warning with retry countdown |

**Loading states**:
- Exercises tab: skeleton stat cards (3) + skeleton table (5 rows)
- Exercise detail: skeleton stat cards + skeleton status tracker + skeleton bank details card
- Exercise modal: spinner on submit button, steps disabled during processing
- Payment confirmation: progress indicator showing "Confirmando pagamento → Emitindo ações → Registrando na blockchain → Concluído"

---

## Success Criteria

- Exercise request creation: < 2 seconds
- Payment confirmation -> share issuance: < 30 seconds
- 99% successful share issuance rate
- Zero lost payments (all payments tracked)
- 100% cap table accuracy after exercises
