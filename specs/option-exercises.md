# Option Exercises Specification

**Topic of Concern**: Employee option exercise requests and payment confirmation

**One-Sentence Description**: The system processes employee option exercise requests where employees pay the strike price via bank transfer, admins confirm payment, and shares are issued on-chain.

---

## Overview

When employees want to exercise vested options, they submit an exercise request specifying quantity. The system calculates the amount due (quantity × strike price), provides bank transfer instructions, and creates a pending request. After the employee transfers money to the company bank account, an admin confirms payment receipt. Upon confirmation, the backend submits a blockchain transaction to issue shares, converting options to actual equity.

**Flow**: Employee requests → System calculates cost → Employee pays via bank → Admin confirms → Shares issued on-chain

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
- System validates: quantity ≤ vested options
- System calculates amount due: quantity × strike price
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
- Status: PENDING_PAYMENT → PAYMENT_CONFIRMED → SHARES_ISSUED → COMPLETED

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
  amount_due: number;                // Quantity × strike price

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

### POST /api/v1/option-grants/:grantId/request-exercise
Employee creates exercise request

**Request**:
```json
{
  "quantity": 5000
}
```

**Response** (201 Created):
```json
{
  "request_id": "uuid",
  "quantity": 5000,
  "strike_price": 5.00,
  "amount_due": 25000.00,
  "payment_reference": "EX-2024-001-ABC123",
  "bank_details": {
    "bank_name": "Banco do Brasil",
    "account_holder": "Startup XYZ Ltda.",
    "account_number": "12345-6",
    "pix_key": "12.345.678/0001-90"
  },
  "instructions": "Transfer R$ 25,000.00 and include reference code EX-2024-001-ABC123"
}
```

### GET /api/v1/companies/:companyId/option-exercises
Admin views all pending exercise requests

**Response**:
```json
{
  "pending_requests": [
    {
      "id": "uuid",
      "employee_name": "Maria Silva",
      "quantity": 5000,
      "amount_due": 25000.00,
      "payment_reference": "EX-2024-001-ABC123",
      "requested_at": "2024-01-20T10:00:00Z",
      "status": "PENDING_PAYMENT"
    }
  ]
}
```

### POST /api/v1/option-exercises/:requestId/confirm-payment
Admin confirms payment received

**Request**:
```json
{
  "payment_date": "2024-01-22",
  "payment_notes": "PIX received, reference matched"
}
```

**Response** (200 OK):
```json
{
  "status": "PAYMENT_CONFIRMED",
  "message": "Share issuance initiated",
  "blockchain_tx_hash": "0x..."
}
```

### POST /api/v1/option-exercises/:requestId/cancel
Employee or admin cancels request

---

## Business Rules

### BR-1: Vesting Validation
- Employee can only exercise vested options
- quantity_requested ≤ (vested_options - already_exercised)

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
6. System validates: 5,000 ≤ 5,000 vested ✓
7. System calculates: 5,000 × R$ 5.00 = R$ 25,000.00
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
    - Reference: EX-2024-001-ABC123
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
3. Admin sees: Maria Silva - 5,000 options - R$ 25,000 - Ref: EX-2024-001-ABC123
4. Admin checks company bank account
5. Admin finds PIX transfer: R$ 25,000.00, Description: "EX-2024-001-ABC123"
6. Admin clicks "Confirm Payment" on Maria's request
7. System displays confirmation modal:
   - Employee: Maria Silva
   - Amount: R$ 25,000.00
   - Reference: EX-2024-001-ABC123
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
19. Admin sees: Request status "Completed ✓"

POSTCONDITION: Shares issued on-chain, cap table updated, employee notified
```

---

## Edge Cases

### EC-1: Insufficient Vested Options
**Scenario**: Employee requests 10,000 but only 5,000 vested
**Handling**: Return error: "You only have 5,000 vested options available to exercise"

### EC-2: Payment Amount Mismatch
**Scenario**: Employee transfers R$ 20,000 instead of R$ 25,000
**Handling**: Admin sees warning in confirmation, can add notes, may reject and ask employee to complete payment

### EC-3: Blockchain Transaction Fails
**Scenario**: Share issuance transaction fails on blockchain
**Handling**: 
- Retry automatically up to 3 times
- If all fail, alert admin
- Do NOT mark as completed until on-chain confirmation
- Employee payment already received, so must resolve

### EC-4: Employee Cancels After Payment
**Scenario**: Employee wants to cancel after transferring money
**Handling**: Admin must refund payment manually, then cancel request in system

---

## Dependencies

- **Option Plans**: Exercise requests reference option grants
- **Blockchain**: Share issuance happens on-chain
- **Cap Table**: Exercises update cap table automatically
- **Notifications**: Emails sent at key status changes

---

## Success Criteria

- Exercise request creation: < 2 seconds
- Payment confirmation → share issuance: < 30 seconds
- 99% successful share issuance rate
- Zero lost payments (all payments tracked)
- 100% cap table accuracy after exercises
