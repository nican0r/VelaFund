# Transactions — User Flows

**Feature**: Equity transactions for cap table management (ISSUANCE, TRANSFER, CONVERSION, CANCELLATION, SPLIT)
**Actors**: ADMIN (full lifecycle including approve/confirm), FINANCE (create/submit/cancel), LEGAL (read-only)
**Preconditions**: User is authenticated, user is an ACTIVE member of the company, company is ACTIVE, relevant shareholders and share classes exist
**Related Flows**: [Company Management](./company-management.md) (company must be ACTIVE), [Share Class Management](./share-class-management.md) (share classes referenced by transactions), [Shareholder Management](./shareholder-management.md) (shareholders referenced as from/to), [Cap Table Management](./cap-table-management.md) (cap table mutated on confirm)

---

## Flow Map

```
User navigates to Transactions page
  |
  |- [role = ADMIN/FINANCE/LEGAL] -> GET /transactions?page=1&limit=20
  |     |
  |     |- [has transactions] -> Display paginated list with type/status filters
  |     |     |
  |     |     |- [user clicks a transaction row] -> GET /transactions/:id -> Detail view
  |     |     |
  |     |     |- [ADMIN/FINANCE clicks "New Transaction"] -> Create flow (see below)
  |     |     |
  |     |     |- [ADMIN/FINANCE clicks "Submit" on a DRAFT] -> Submit flow (see below)
  |     |     |
  |     |     |- [ADMIN clicks "Approve" on PENDING_APPROVAL] -> Approve flow (see below)
  |     |     |
  |     |     |- [ADMIN clicks "Confirm" on SUBMITTED] -> Confirm flow (see below)
  |     |     |
  |     |     └- [ADMIN/FINANCE clicks "Cancel"] -> Cancel flow (see below)
  |     |
  |     └- [empty] -> Display empty state with "New Transaction" CTA (ADMIN/FINANCE only)
  |
  |- [role = INVESTOR/EMPLOYEE] -> 404 Not Found (enumeration prevention)
  |
  └- [unauthenticated] -> 401 Unauthorized -> redirect to login


ADMIN/FINANCE clicks "New Transaction"
  |
  |- [type = ISSUANCE]
  |     |
  |     |- [valid form: toShareholderId + shareClassId + quantity + pricePerShare] -> POST /transactions
  |     |     |
  |     |     |- [company ACTIVE + quantity > 0 + toShareholder exists + totalIssued + qty <= totalAuthorized]
  |     |     |     -> 201 Created (status: DRAFT)
  |     |     |
  |     |     |- [company not ACTIVE] -> 422 TXN_COMPANY_NOT_ACTIVE
  |     |     |- [quantity <= 0] -> 422 TXN_INVALID_QUANTITY
  |     |     |- [no toShareholderId] -> 422 TXN_TO_SHAREHOLDER_REQUIRED
  |     |     └- [totalIssued + qty > totalAuthorized] -> 422 TXN_EXCEEDS_AUTHORIZED
  |     |
  |     └- [invalid form] -> Client-side validation prevents submission
  |
  |- [type = TRANSFER]
  |     |
  |     |- [valid form: fromShareholderId + toShareholderId + shareClassId + quantity]
  |     |     |
  |     |     |- [from != to + sufficient balance] -> 201 Created (DRAFT)
  |     |     |
  |     |     |- [fromShareholderId missing] -> 422 TXN_FROM_SHAREHOLDER_REQUIRED
  |     |     |- [toShareholderId missing] -> 422 TXN_TO_SHAREHOLDER_REQUIRED
  |     |     |- [from == to] -> 422 TXN_SAME_SHAREHOLDER
  |     |     └- [insufficient balance] -> 422 TXN_INSUFFICIENT_SHARES
  |     |
  |     └- [invalid form] -> Client-side validation prevents submission
  |
  |- [type = CANCELLATION]
  |     |
  |     |- [valid form: fromShareholderId + shareClassId + quantity]
  |     |     |
  |     |     |- [sufficient balance] -> 201 Created (DRAFT)
  |     |     |
  |     |     |- [fromShareholderId missing] -> 422 TXN_FROM_SHAREHOLDER_REQUIRED
  |     |     └- [insufficient balance] -> 422 TXN_INSUFFICIENT_SHARES
  |     |
  |     └- [invalid form] -> Client-side validation prevents submission
  |
  |- [type = CONVERSION]
  |     |
  |     |- [valid form: fromShareholderId + shareClassId + toShareClassId + quantity]
  |     |     |
  |     |     |- [sufficient balance + toShareClassId valid] -> 201 Created (DRAFT)
  |     |     |
  |     |     |- [fromShareholderId missing] -> 422 TXN_FROM_SHAREHOLDER_REQUIRED
  |     |     |- [toShareClassId missing] -> 422 TXN_TO_SHARE_CLASS_REQUIRED
  |     |     └- [insufficient balance] -> 422 TXN_INSUFFICIENT_SHARES
  |     |
  |     └- [invalid form] -> Client-side validation prevents submission
  |
  └- [type = SPLIT]
        |
        |- [valid form: shareClassId + splitRatio]
        |     |
        |     |- [splitRatio valid] -> 201 Created (DRAFT)
        |     |
        |     └- [splitRatio missing/invalid] -> 422 TXN_SPLIT_RATIO_REQUIRED
        |
        └- [invalid form] -> Client-side validation prevents submission


ADMIN/FINANCE clicks "Submit" on DRAFT transaction
  |
  |- [status = DRAFT] -> POST /transactions/:id/submit
  |     |
  |     |- [requiresBoardApproval = true] -> Status: DRAFT -> PENDING_APPROVAL
  |     |
  |     └- [requiresBoardApproval = false] -> Status: DRAFT -> SUBMITTED
  |
  └- [status != DRAFT] -> 422 TXN_INVALID_STATUS_TRANSITION


ADMIN clicks "Approve" on PENDING_APPROVAL transaction
  |
  |- [status = PENDING_APPROVAL] -> POST /transactions/:id/approve
  |     |
  |     └- [success] -> Status: PENDING_APPROVAL -> SUBMITTED
  |
  |- [status != PENDING_APPROVAL] -> 422 TXN_INVALID_STATUS_TRANSITION
  |
  └- [role != ADMIN] -> 404 Not Found


ADMIN clicks "Confirm" on SUBMITTED transaction
  |
  |- [status = SUBMITTED] -> POST /transactions/:id/confirm
  |     |
  |     |- [cap table mutation succeeds] -> Status: SUBMITTED -> CONFIRMED
  |     |     |
  |     |     |- [ISSUANCE] -> Upsert Shareholding, increment ShareClass.totalIssued
  |     |     |- [TRANSFER] -> Deduct from source, add to dest (delete if zero)
  |     |     |- [CANCELLATION] -> Deduct from source, decrement ShareClass.totalIssued
  |     |     |- [CONVERSION] -> Cancel from source class, issue to target class
  |     |     └- [SPLIT] -> Multiply all Shareholding quantities and ShareClass totals by ratio
  |     |
  |     └- [cap table mutation fails] -> Status: SUBMITTED -> FAILED
  |
  |- [status != SUBMITTED] -> 422 TXN_INVALID_STATUS_TRANSITION
  |
  └- [role != ADMIN] -> 404 Not Found


ADMIN/FINANCE clicks "Cancel"
  |
  |- [status = DRAFT/PENDING_APPROVAL/SUBMITTED/FAILED] -> POST /transactions/:id/cancel
  |     |
  |     └- [success] -> Status: current -> CANCELLED
  |
  |- [status = CONFIRMED] -> 422 TXN_CANNOT_CANCEL_CONFIRMED
  |
  └- [status = CANCELLED] -> 422 TXN_ALREADY_CANCELLED
```

---

## Flows

### Happy Path: Create Issuance Transaction

```
PRECONDITION: Company is ACTIVE, share class exists, to-shareholder exists, user has ADMIN or FINANCE role
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "New Transaction" and selects type ISSUANCE

1. [UI] User navigates to /dashboard/transactions
2. [UI] User clicks "New Transaction" -> navigates to /dashboard/transactions/new
3. [UI] Page shows Step 1: Details with 5 transaction type cards (Issuance, Transfer, Conversion, Cancellation, Split)
4. [UI] User clicks the "Issuance" type card (selected by default)
5. [UI] Form shows fields: shareClassId (dropdown), toShareholderId (dropdown), quantity, pricePerShare, notes, boardApproval checkbox
6. [UI] User fills in required fields and clicks "Next"
7. [Frontend] Validates input client-side (quantity > 0, required fields present)
   -> IF invalid: show field-level errors under each field, STOP
8. [UI] Step 2: Review — shows formatted transaction summary (type, share class, shareholder, quantity, price, total value, board approval status, notes)
9. [UI] User clicks "Create Transaction"
10. [Frontend] Sends POST /api/v1/companies/:companyId/transactions
   Body: { type: "ISSUANCE", toShareholderId, shareClassId, quantity, pricePerShare, boardResolutionDate, notes }
9. [Backend] Validates authentication (AuthGuard)
   -> IF unauthenticated: return 401, frontend redirects to login
10. [Backend] Validates authorization (RolesGuard: ADMIN, FINANCE)
    -> IF not member or wrong role: return 404
11. [Backend] Validates request body (ValidationPipe)
    -> IF invalid: return 400 with validationErrors
12. [Backend] Validates company is ACTIVE
    -> IF not ACTIVE: return 422 TXN_COMPANY_NOT_ACTIVE
13. [Backend] Validates quantity > 0
    -> IF invalid: return 422 TXN_INVALID_QUANTITY
14. [Backend] Validates toShareholderId is present
    -> IF missing: return 422 TXN_TO_SHAREHOLDER_REQUIRED
15. [Backend] Validates toShareholder exists in the company
    -> IF not found: return 404
16. [Backend] Validates share class exists in the company
    -> IF not found: return 404
17. [Backend] Validates totalIssued + quantity <= totalAuthorized for the share class
    -> IF exceeds: return 422 TXN_EXCEEDS_AUTHORIZED
18. [Backend] Creates Transaction record with status = DRAFT
19. [Backend] Returns 201 with created transaction
20. [UI] Shows success toast: "Transaction created as draft"
21. [UI] Navigates to transaction detail page

POSTCONDITION: Transaction exists with status DRAFT
SIDE EFFECTS: Audit log (future: TRANSACTION_SUBMITTED via audit interceptor)
```

### Happy Path: Create Transfer Transaction

```
PRECONDITION: Company is ACTIVE, share class exists, both shareholders exist, source has sufficient balance
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "New Transaction" and selects type TRANSFER

1. [UI] User navigates to /companies/:companyId/transactions
2. [UI] User clicks "New Transaction"
3. [UI] User selects type = TRANSFER
4. [UI] Form shows fields: fromShareholderId, toShareholderId, shareClassId, quantity, pricePerShare, notes
5. [UI] User fills in required fields and clicks "Save as Draft"
6. [Frontend] Validates input client-side (quantity > 0, from != to, required fields)
   -> IF invalid: show field-level errors, STOP
7. [Frontend] Sends POST /api/v1/companies/:companyId/transactions
   Body: { type: "TRANSFER", fromShareholderId, toShareholderId, shareClassId, quantity, pricePerShare, notes }
8. [Backend] Validates authentication and authorization
   -> IF unauthenticated: return 401
   -> IF not member or wrong role: return 404
9. [Backend] Validates request body
   -> IF invalid: return 400 with validationErrors
10. [Backend] Validates company is ACTIVE
    -> IF not ACTIVE: return 422 TXN_COMPANY_NOT_ACTIVE
11. [Backend] Validates quantity > 0
    -> IF invalid: return 422 TXN_INVALID_QUANTITY
12. [Backend] Validates fromShareholderId is present
    -> IF missing: return 422 TXN_FROM_SHAREHOLDER_REQUIRED
13. [Backend] Validates toShareholderId is present
    -> IF missing: return 422 TXN_TO_SHAREHOLDER_REQUIRED
14. [Backend] Validates fromShareholderId != toShareholderId
    -> IF same: return 422 TXN_SAME_SHAREHOLDER
15. [Backend] Validates both shareholders exist in the company
    -> IF not found: return 404
16. [Backend] Validates fromShareholder has sufficient balance in the share class
    -> IF insufficient: return 422 TXN_INSUFFICIENT_SHARES
17. [Backend] Creates Transaction record with status = DRAFT
18. [Backend] Returns 201 with created transaction
19. [UI] Shows success toast: "Transfer transaction created as draft"

POSTCONDITION: Transaction exists with status DRAFT
SIDE EFFECTS: Audit log (future: TRANSACTION_SUBMITTED)
```

### Happy Path: Create Cancellation Transaction

```
PRECONDITION: Company is ACTIVE, share class exists, source shareholder has sufficient balance
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "New Transaction" and selects type CANCELLATION

1. [UI] User selects type = CANCELLATION
2. [UI] Form shows fields: fromShareholderId, shareClassId, quantity, notes
3. [UI] User fills in required fields and clicks "Save as Draft"
4. [Frontend] Validates input client-side
   -> IF invalid: show field-level errors, STOP
5. [Frontend] Sends POST /api/v1/companies/:companyId/transactions
   Body: { type: "CANCELLATION", fromShareholderId, shareClassId, quantity, notes }
6. [Backend] Validates auth, role, body, company ACTIVE, quantity > 0
7. [Backend] Validates fromShareholderId is present
   -> IF missing: return 422 TXN_FROM_SHAREHOLDER_REQUIRED
8. [Backend] Validates fromShareholder exists and has sufficient balance
   -> IF insufficient: return 422 TXN_INSUFFICIENT_SHARES
9. [Backend] Creates Transaction record with status = DRAFT
10. [Backend] Returns 201

POSTCONDITION: Transaction exists with status DRAFT
SIDE EFFECTS: Audit log (future: TRANSACTION_SUBMITTED)
```

### Happy Path: Create Conversion Transaction

```
PRECONDITION: Company is ACTIVE, both share classes exist, source shareholder has sufficient balance in source class
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "New Transaction" and selects type CONVERSION

1. [UI] User selects type = CONVERSION
2. [UI] Form shows fields: fromShareholderId, shareClassId (source), toShareClassId (target), quantity, notes
3. [UI] User fills in required fields and clicks "Save as Draft"
4. [Frontend] Validates input client-side
   -> IF invalid: show field-level errors, STOP
5. [Frontend] Sends POST /api/v1/companies/:companyId/transactions
   Body: { type: "CONVERSION", fromShareholderId, shareClassId, toShareClassId, quantity, notes }
6. [Backend] Validates auth, role, body, company ACTIVE, quantity > 0
7. [Backend] Validates fromShareholderId is present
   -> IF missing: return 422 TXN_FROM_SHAREHOLDER_REQUIRED
8. [Backend] Validates toShareClassId is present
   -> IF missing: return 422 TXN_TO_SHARE_CLASS_REQUIRED
9. [Backend] Validates both share classes exist in the company
   -> IF not found: return 404
10. [Backend] Validates fromShareholder has sufficient balance in source share class
    -> IF insufficient: return 422 TXN_INSUFFICIENT_SHARES
11. [Backend] Creates Transaction record with status = DRAFT
12. [Backend] Returns 201

POSTCONDITION: Transaction exists with status DRAFT
SIDE EFFECTS: Audit log (future: TRANSACTION_SUBMITTED)
```

### Happy Path: Create Split Transaction

```
PRECONDITION: Company is ACTIVE, share class exists
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "New Transaction" and selects type SPLIT

1. [UI] User selects type = SPLIT
2. [UI] Form shows fields: shareClassId, splitRatio (e.g., 2 for 2:1 split), notes
3. [UI] User fills in required fields and clicks "Save as Draft"
4. [Frontend] Validates input client-side (splitRatio > 0)
   -> IF invalid: show field-level errors, STOP
5. [Frontend] Sends POST /api/v1/companies/:companyId/transactions
   Body: { type: "SPLIT", shareClassId, splitRatio, notes }
6. [Backend] Validates auth, role, body, company ACTIVE
7. [Backend] Validates splitRatio is present and valid
   -> IF missing/invalid: return 422 TXN_SPLIT_RATIO_REQUIRED
8. [Backend] Validates share class exists in the company
   -> IF not found: return 404
9. [Backend] Creates Transaction record with status = DRAFT
10. [Backend] Returns 201

POSTCONDITION: Transaction exists with status DRAFT
SIDE EFFECTS: Audit log (future: TRANSACTION_SUBMITTED)
```

### Happy Path: Submit Draft Transaction

```
PRECONDITION: Transaction exists with status DRAFT, user has ADMIN or FINANCE role
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "Submit" on a DRAFT transaction

1. [UI] User views transaction detail page
2. [UI] User clicks "Submit for Processing" button
3. [Frontend] Sends POST /api/v1/companies/:companyId/transactions/:transactionId/submit
4. [Backend] Validates authentication and authorization (ADMIN, FINANCE)
5. [Backend] Validates transaction exists in the company
   -> IF not found: return 404
6. [Backend] Validates transaction status = DRAFT
   -> IF not DRAFT: return 422 TXN_INVALID_STATUS_TRANSITION
7. [Backend] Checks if requiresBoardApproval flag is set (from boardResolutionDate or company settings)
   -> IF requires approval: set status = PENDING_APPROVAL
   -> IF no approval needed: set status = SUBMITTED
8. [Backend] Returns 200 with updated transaction
9. [UI] Shows success toast: "Transaction submitted"
10. [UI] Transaction detail refreshes with new status badge

POSTCONDITION: Transaction status is PENDING_APPROVAL or SUBMITTED
SIDE EFFECTS: Audit log (future: TRANSACTION_SUBMITTED)
```

### Happy Path: Approve Pending Transaction

```
PRECONDITION: Transaction exists with status PENDING_APPROVAL, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Approve" on a PENDING_APPROVAL transaction

1. [UI] User views transaction detail page with PENDING_APPROVAL status
2. [UI] User clicks "Approve" button
3. [UI] Confirmation dialog: "Approve this transaction?"
4. [UI] User clicks "Confirm"
5. [Frontend] Sends POST /api/v1/companies/:companyId/transactions/:transactionId/approve
6. [Backend] Validates authentication and authorization (ADMIN only)
   -> IF not ADMIN: return 404
7. [Backend] Validates transaction exists in the company
   -> IF not found: return 404
8. [Backend] Validates transaction status = PENDING_APPROVAL
   -> IF not PENDING_APPROVAL: return 422 TXN_INVALID_STATUS_TRANSITION
9. [Backend] Sets status = SUBMITTED
10. [Backend] Returns 200 with updated transaction
11. [UI] Shows success toast: "Transaction approved"
12. [UI] Transaction detail refreshes with SUBMITTED status badge

POSTCONDITION: Transaction status = SUBMITTED
SIDE EFFECTS: Audit log (future: TRANSACTION_APPROVED)
```

### Happy Path: Confirm and Execute Issuance

```
PRECONDITION: Transaction exists with status SUBMITTED, type = ISSUANCE, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Confirm & Execute" on a SUBMITTED issuance transaction

1. [UI] User views transaction detail page with SUBMITTED status
2. [UI] User clicks "Confirm & Execute" button
3. [UI] Confirmation dialog showing transaction summary: type, shareholder, share class, quantity, price
4. [UI] User clicks "Confirm"
5. [Frontend] Sends POST /api/v1/companies/:companyId/transactions/:transactionId/confirm
6. [Backend] Validates authentication and authorization (ADMIN only)
   -> IF not ADMIN: return 404
7. [Backend] Validates transaction exists in the company
   -> IF not found: return 404
8. [Backend] Validates transaction status = SUBMITTED
   -> IF not SUBMITTED: return 422 TXN_INVALID_STATUS_TRANSITION
9. [Backend] Begins database transaction ($transaction)
10. [Backend] Upserts Shareholding for toShareholder in the share class:
    - If Shareholding exists: increment quantity
    - If not: create new Shareholding record
11. [Backend] Increments ShareClass.totalIssued by quantity
12. [Backend] Sets Transaction status = CONFIRMED
13. [Backend] Commits database transaction
    -> IF mutation fails: set status = FAILED, return error
14. [Backend] Returns 200 with confirmed transaction
15. [UI] Shows success toast: "Transaction confirmed. Cap table updated."
16. [UI] Transaction detail refreshes with CONFIRMED status badge

POSTCONDITION: Transaction status = CONFIRMED, Shareholding upserted, ShareClass.totalIssued incremented
SIDE EFFECTS: Audit log (future: SHARES_ISSUED), cap table snapshot triggered asynchronously
```

### Happy Path: Confirm and Execute Transfer

```
PRECONDITION: Transaction exists with status SUBMITTED, type = TRANSFER, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Confirm & Execute" on a SUBMITTED transfer transaction

1. [UI] User clicks "Confirm & Execute"
2. [UI] Confirmation dialog showing: from-shareholder, to-shareholder, share class, quantity
3. [UI] User clicks "Confirm"
4. [Frontend] Sends POST /api/v1/companies/:companyId/transactions/:transactionId/confirm
5. [Backend] Validates auth (ADMIN), transaction exists, status = SUBMITTED
6. [Backend] Begins database transaction ($transaction)
7. [Backend] Deducts quantity from source Shareholding
   - If remaining quantity = 0: deletes the Shareholding record
   - If remaining quantity > 0: updates the Shareholding record
8. [Backend] Upserts Shareholding for toShareholder in the share class:
   - If Shareholding exists: increment quantity
   - If not: create new Shareholding record
9. [Backend] Sets Transaction status = CONFIRMED
10. [Backend] Commits database transaction
    -> IF mutation fails: set status = FAILED, return error
11. [Backend] Returns 200 with confirmed transaction
12. [UI] Shows success toast: "Transfer confirmed. Cap table updated."

POSTCONDITION: Transaction status = CONFIRMED, source Shareholding deducted, destination Shareholding upserted
SIDE EFFECTS: Audit log (future: SHARES_TRANSFERRED), cap table snapshot triggered asynchronously
```

### Happy Path: Confirm and Execute Cancellation

```
PRECONDITION: Transaction exists with status SUBMITTED, type = CANCELLATION, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Confirm & Execute" on a SUBMITTED cancellation transaction

1. [UI] User clicks "Confirm & Execute"
2. [UI] Confirmation dialog: "Cancel {quantity} shares from {shareholder}?"
3. [UI] User clicks "Confirm"
4. [Frontend] Sends POST /api/v1/companies/:companyId/transactions/:transactionId/confirm
5. [Backend] Validates auth (ADMIN), transaction exists, status = SUBMITTED
6. [Backend] Begins database transaction ($transaction)
7. [Backend] Deducts quantity from source Shareholding
   - If remaining quantity = 0: deletes the Shareholding record
   - If remaining quantity > 0: updates the Shareholding record
8. [Backend] Decrements ShareClass.totalIssued by quantity
9. [Backend] Sets Transaction status = CONFIRMED
10. [Backend] Commits database transaction
    -> IF mutation fails: set status = FAILED, return error
11. [Backend] Returns 200 with confirmed transaction
12. [UI] Shows success toast: "Shares cancelled. Cap table updated."

POSTCONDITION: Transaction status = CONFIRMED, source Shareholding deducted, ShareClass.totalIssued decremented
SIDE EFFECTS: Audit log (future: SHARES_CANCELLED), cap table snapshot triggered asynchronously
```

### Happy Path: Confirm and Execute Conversion

```
PRECONDITION: Transaction exists with status SUBMITTED, type = CONVERSION, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Confirm & Execute" on a SUBMITTED conversion transaction

1. [UI] User clicks "Confirm & Execute"
2. [UI] Confirmation dialog: "Convert {quantity} shares from {sourceClass} to {targetClass}?"
3. [UI] User clicks "Confirm"
4. [Frontend] Sends POST /api/v1/companies/:companyId/transactions/:transactionId/confirm
5. [Backend] Validates auth (ADMIN), transaction exists, status = SUBMITTED
6. [Backend] Begins database transaction ($transaction)
7. [Backend] Cancels from source class:
   - Deducts quantity from source Shareholding
   - If remaining quantity = 0: deletes the source Shareholding record
   - Decrements source ShareClass.totalIssued by quantity
8. [Backend] Issues to target class:
   - Upserts Shareholding for shareholder in target share class
   - Increments target ShareClass.totalIssued by quantity
9. [Backend] Sets Transaction status = CONFIRMED
10. [Backend] Commits database transaction
    -> IF mutation fails: set status = FAILED, return error
11. [Backend] Returns 200 with confirmed transaction
12. [UI] Shows success toast: "Conversion confirmed. Cap table updated."

POSTCONDITION: Transaction status = CONFIRMED, source class Shareholding deducted and totalIssued decremented, target class Shareholding upserted and totalIssued incremented
SIDE EFFECTS: Audit log (future: SHARES_CONVERTED), cap table snapshot triggered asynchronously
```

### Happy Path: Confirm and Execute Split

```
PRECONDITION: Transaction exists with status SUBMITTED, type = SPLIT, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Confirm & Execute" on a SUBMITTED split transaction

1. [UI] User clicks "Confirm & Execute"
2. [UI] Confirmation dialog: "Apply {splitRatio}:1 split to {shareClassName}? All shareholdings will be multiplied."
3. [UI] User clicks "Confirm"
4. [Frontend] Sends POST /api/v1/companies/:companyId/transactions/:transactionId/confirm
5. [Backend] Validates auth (ADMIN), transaction exists, status = SUBMITTED
6. [Backend] Begins database transaction ($transaction)
7. [Backend] Finds all Shareholding records for the share class
8. [Backend] Multiplies each Shareholding.quantity by splitRatio
9. [Backend] Multiplies ShareClass.totalIssued by splitRatio
10. [Backend] Multiplies ShareClass.totalAuthorized by splitRatio
11. [Backend] Sets Transaction status = CONFIRMED
12. [Backend] Commits database transaction
    -> IF mutation fails: set status = FAILED, return error
13. [Backend] Returns 200 with confirmed transaction
14. [UI] Shows success toast: "Split applied. Cap table updated."

POSTCONDITION: Transaction status = CONFIRMED, all Shareholding quantities and ShareClass totals multiplied by splitRatio
SIDE EFFECTS: Audit log (future: SHARES_ISSUED for split), cap table snapshot triggered asynchronously
```

### Happy Path: Cancel Transaction

```
PRECONDITION: Transaction exists with status DRAFT, PENDING_APPROVAL, SUBMITTED, or FAILED
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "Cancel" on a cancellable transaction

1. [UI] User views transaction detail page
2. [UI] User clicks "Cancel Transaction" button
3. [UI] Confirmation dialog: "Are you sure you want to cancel this transaction?"
4. [UI] User clicks "Confirm"
5. [Frontend] Sends POST /api/v1/companies/:companyId/transactions/:transactionId/cancel
6. [Backend] Validates authentication and authorization (ADMIN, FINANCE)
7. [Backend] Validates transaction exists in the company
   -> IF not found: return 404
8. [Backend] Validates transaction is not in CONFIRMED status
   -> IF CONFIRMED: return 422 TXN_CANNOT_CANCEL_CONFIRMED
9. [Backend] Validates transaction is not already CANCELLED
   -> IF already CANCELLED: return 422 TXN_ALREADY_CANCELLED
10. [Backend] Sets status = CANCELLED
11. [Backend] Returns 200 with updated transaction
12. [UI] Shows success toast: "Transaction cancelled"
13. [UI] Transaction detail refreshes with CANCELLED status badge

POSTCONDITION: Transaction status = CANCELLED (terminal)
SIDE EFFECTS: Audit log (future: TRANSACTION_CANCELLED)
```

### Happy Path: List Transactions

```
PRECONDITION: User is ACTIVE member with ADMIN, FINANCE, or LEGAL role
ACTOR: Any permitted member
TRIGGER: User navigates to transactions page

1. [UI] User navigates to /companies/:companyId/transactions
2. [Frontend] Sends GET /api/v1/companies/:companyId/transactions?page=1&limit=20
3. [Backend] Validates auth and role (ADMIN, FINANCE, LEGAL)
4. [Backend] Returns paginated list with meta
5. [UI] Displays table with columns: date, type, status, from-shareholder, to-shareholder, share class, quantity, price
6. [UI] User can filter by type (ISSUANCE/TRANSFER/CONVERSION/CANCELLATION/SPLIT) and status (DRAFT/PENDING_APPROVAL/SUBMITTED/CONFIRMED/FAILED/CANCELLED)
7. [UI] User can sort by createdAt, type, status
8. [UI] User can paginate through results

POSTCONDITION: User sees transactions for this company
SIDE EFFECTS: None
```

### Happy Path: View Transaction Detail

```
PRECONDITION: Transaction exists, user has ADMIN, FINANCE, or LEGAL role
ACTOR: Any permitted member
TRIGGER: User clicks on a transaction row

1. [UI] User clicks on a transaction row in list
2. [Frontend] Sends GET /api/v1/companies/:companyId/transactions/:transactionId
3. [Backend] Returns full transaction detail with:
   - Transaction fields (type, status, quantity, pricePerShare, splitRatio, notes, boardResolutionDate)
   - fromShareholder (name, type, id) if present
   - toShareholder (name, type, id) if present
   - shareClass (className, type, id)
   - toShareClass (className, type, id) if conversion
   - Status history timeline
4. [UI] Displays transaction detail with:
   - Status badge with state color
   - Summary card showing from/to shareholders, share class, quantity, total value
   - Action buttons based on current status and user role

POSTCONDITION: User sees full transaction detail
SIDE EFFECTS: None
```

### Happy Path: Retry Failed Transaction

```
PRECONDITION: Transaction exists with status FAILED, user has ADMIN role
ACTOR: ADMIN member
TRIGGER: User clicks "Retry" on a FAILED transaction

1. [UI] User views transaction detail with FAILED status
2. [UI] User clicks "Retry" button
3. [Frontend] Sends POST /api/v1/companies/:companyId/transactions/:transactionId/confirm
4. [Backend] Validates auth (ADMIN), transaction exists
5. [Backend] Validates transaction status = FAILED (treated same as SUBMITTED for retry)
   -> Status FAILED transitions to SUBMITTED, then confirm logic runs
6. [Backend] Re-attempts cap table mutation in $transaction
   -> IF succeeds: status = CONFIRMED
   -> IF fails again: status = FAILED
7. [Backend] Returns 200 with updated transaction

POSTCONDITION: Transaction either CONFIRMED (success) or FAILED (retry failed)
SIDE EFFECTS: Audit log, cap table mutation if successful
```

### Error Path: Insufficient Shares for Transfer

```
ACTOR: ADMIN or FINANCE member
TRIGGER: Attempts to create a transfer where source shareholder lacks sufficient balance

1. [UI] User fills in transfer form: from-shareholder, to-shareholder, share class, quantity
2. [UI] User clicks "Save as Draft"
3. [Frontend] Sends POST /api/v1/companies/:companyId/transactions
4. [Backend] Validates company ACTIVE, quantity > 0, shareholders exist, from != to
5. [Backend] Queries fromShareholder's Shareholding in the specified share class
6. [Backend] Shareholding.quantity < requested quantity
7. [Backend] Returns 422 with error code TXN_INSUFFICIENT_SHARES
   Body: { error: { code: "TXN_INSUFFICIENT_SHARES", messageKey: "errors.txn.insufficientShares", details: { available: 1000, requested: 1500 } } }
8. [UI] Shows error toast using messageKey

POSTCONDITION: No transaction created
SIDE EFFECTS: None
```

### Error Path: Exceeds Authorized Shares for Issuance

```
ACTOR: ADMIN or FINANCE member
TRIGGER: Attempts to create an issuance that would exceed authorized shares

1. [UI] User fills in issuance form with quantity that exceeds available authorization
2. [UI] User clicks "Save as Draft"
3. [Frontend] Sends POST /api/v1/companies/:companyId/transactions
4. [Backend] Validates company ACTIVE, quantity > 0, shareholder and share class exist
5. [Backend] Calculates: ShareClass.totalIssued + requested quantity > ShareClass.totalAuthorized
6. [Backend] Returns 422 with error code TXN_EXCEEDS_AUTHORIZED
   Body: { error: { code: "TXN_EXCEEDS_AUTHORIZED", messageKey: "errors.txn.exceedsAuthorized", details: { totalAuthorized: 100000, totalIssued: 95000, requested: 10000 } } }
7. [UI] Shows error toast

POSTCONDITION: No transaction created
SIDE EFFECTS: None
```

### Error Path: Invalid Status Transition

```
ACTOR: ADMIN or FINANCE member
TRIGGER: Attempts a status action on a transaction in an incompatible state

1. [UI] User clicks an action button (Submit/Approve/Confirm) on a transaction
2. [Frontend] Sends POST to the corresponding action endpoint
3. [Backend] Validates transaction exists
4. [Backend] Detects current status does not allow the requested transition:
   - Submit on non-DRAFT -> 422 TXN_INVALID_STATUS_TRANSITION
   - Approve on non-PENDING_APPROVAL -> 422 TXN_INVALID_STATUS_TRANSITION
   - Confirm on non-SUBMITTED (and non-FAILED for retry) -> 422 TXN_INVALID_STATUS_TRANSITION
5. [Backend] Returns 422 with error code TXN_INVALID_STATUS_TRANSITION
6. [UI] Shows error toast: "This action is not available for the current transaction status"

POSTCONDITION: Transaction status unchanged
SIDE EFFECTS: None
```

### Error Path: Cancel Confirmed Transaction

```
ACTOR: ADMIN or FINANCE member
TRIGGER: Attempts to cancel a CONFIRMED transaction

1. [UI] User views a CONFIRMED transaction (Cancel button should be hidden but may be attempted via API)
2. [Frontend] Sends POST /api/v1/companies/:companyId/transactions/:transactionId/cancel
3. [Backend] Validates transaction exists
4. [Backend] Detects status = CONFIRMED
5. [Backend] Returns 422 with error code TXN_CANNOT_CANCEL_CONFIRMED
6. [UI] Shows error toast: "Confirmed transactions cannot be cancelled"

POSTCONDITION: Transaction remains CONFIRMED
SIDE EFFECTS: None
```

### Error Path: Company Not Active

```
ACTOR: ADMIN or FINANCE member
TRIGGER: Attempts to create a transaction for a non-ACTIVE company

1. [UI] User fills in transaction form and clicks "Save as Draft"
2. [Frontend] Sends POST /api/v1/companies/:companyId/transactions
3. [Backend] Validates company exists
4. [Backend] Detects company status is not ACTIVE (e.g., DRAFT or DISSOLVED)
5. [Backend] Returns 422 with error code TXN_COMPANY_NOT_ACTIVE
6. [UI] Shows error toast

POSTCONDITION: No transaction created
SIDE EFFECTS: None
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 9 | Auth check | No valid token | Error | 401, redirect to login |
| 10 | Role check (create) | Not ADMIN/FINANCE | Error | 404 Not Found |
| 10 | Role check (approve/confirm) | Not ADMIN | Error | 404 Not Found |
| 10 | Role check (list/detail) | Not ADMIN/FINANCE/LEGAL | Error | 404 Not Found |
| 11 | Input validation | Invalid fields | Error | 400 + validationErrors |
| 12 | Company status | Company not ACTIVE | Error | 422 TXN_COMPANY_NOT_ACTIVE |
| 13 | Quantity validation | quantity <= 0 | Error | 422 TXN_INVALID_QUANTITY |
| 14 | To-shareholder required | ISSUANCE/TRANSFER without toShareholderId | Error | 422 TXN_TO_SHAREHOLDER_REQUIRED |
| 12 | From-shareholder required | TRANSFER/CANCELLATION/CONVERSION without fromShareholderId | Error | 422 TXN_FROM_SHAREHOLDER_REQUIRED |
| 14 | Same shareholder | TRANSFER from == to | Error | 422 TXN_SAME_SHAREHOLDER |
| 17 | Authorized shares | ISSUANCE totalIssued + qty > totalAuthorized | Error | 422 TXN_EXCEEDS_AUTHORIZED |
| 16 | Sufficient balance | TRANSFER/CANCELLATION/CONVERSION insufficient holdings | Error | 422 TXN_INSUFFICIENT_SHARES |
| 8 | To-share-class required | CONVERSION without toShareClassId | Error | 422 TXN_TO_SHARE_CLASS_REQUIRED |
| 7 | Split ratio required | SPLIT without valid splitRatio | Error | 422 TXN_SPLIT_RATIO_REQUIRED |
| 6 | Submit status | Transaction not DRAFT | Error | 422 TXN_INVALID_STATUS_TRANSITION |
| 7 | Board approval | requiresBoardApproval = true | Alt | Status -> PENDING_APPROVAL |
| 7 | Board approval | requiresBoardApproval = false | Happy | Status -> SUBMITTED |
| 8 | Approve status | Transaction not PENDING_APPROVAL | Error | 422 TXN_INVALID_STATUS_TRANSITION |
| 8 | Confirm status | Transaction not SUBMITTED/FAILED | Error | 422 TXN_INVALID_STATUS_TRANSITION |
| 13 | Cap table mutation | Mutation fails | Error | Status -> FAILED |
| 8 | Cancel confirmed | Status = CONFIRMED | Error | 422 TXN_CANNOT_CANCEL_CONFIRMED |
| 9 | Cancel already cancelled | Status = CANCELLED | Error | 422 TXN_ALREADY_CANCELLED |

---

## State Transitions

### Transaction Status State Machine

```
         +-------+
         | DRAFT |
         +-------+
             |
        [submit]
             |
    +--------+---------+
    |                   |
    v                   v
+-------------------+  +----------+
| PENDING_APPROVAL  |  | SUBMITTED|<---------+
+-------------------+  +----------+          |
    |                   |       |             |
 [approve]         [confirm] [cancel]    [retry]
    |                   |       |             |
    v                   v       v             |
+----------+     +----------+  +----------+  |
| SUBMITTED|---->| CONFIRMED|  | CANCELLED|  |
+----------+     +----------+  +----------+  |
    |                              ^          |
 [fail]                            |          |
    |                           [cancel]      |
    v                              |          |
+----------+                       |          |
| FAILED   |-----------------------+----------+
+----------+
```

### Entity State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| Transaction | status | -- | DRAFT | ADMIN/FINANCE creates transaction |
| Transaction | status | DRAFT | PENDING_APPROVAL | Submit (requiresBoardApproval = true) |
| Transaction | status | DRAFT | SUBMITTED | Submit (requiresBoardApproval = false) |
| Transaction | status | PENDING_APPROVAL | SUBMITTED | ADMIN approves |
| Transaction | status | PENDING_APPROVAL | CANCELLED | ADMIN/FINANCE cancels |
| Transaction | status | SUBMITTED | CONFIRMED | ADMIN confirms (cap table mutation succeeds) |
| Transaction | status | SUBMITTED | FAILED | ADMIN confirms (cap table mutation fails) |
| Transaction | status | SUBMITTED | CANCELLED | ADMIN/FINANCE cancels |
| Transaction | status | FAILED | SUBMITTED | ADMIN retries (re-confirm) |
| Transaction | status | FAILED | CANCELLED | ADMIN/FINANCE cancels |
| Shareholding | quantity | X | X + qty | ISSUANCE confirmed (upsert) |
| Shareholding | -- | -- | Created | ISSUANCE confirmed (new shareholder in class) |
| ShareClass | totalIssued | X | X + qty | ISSUANCE confirmed |
| Shareholding | quantity | X | X - qty | TRANSFER confirmed (source deducted) |
| Shareholding | -- | Exists | Deleted | TRANSFER confirmed (source reaches zero) |
| Shareholding | quantity | Y | Y + qty | TRANSFER confirmed (destination upserted) |
| Shareholding | quantity | X | X - qty | CANCELLATION confirmed |
| ShareClass | totalIssued | X | X - qty | CANCELLATION confirmed |
| Shareholding | quantity (source) | X | X - qty | CONVERSION confirmed (cancel from source) |
| ShareClass | totalIssued (source) | X | X - qty | CONVERSION confirmed |
| Shareholding | quantity (target) | Y | Y + qty | CONVERSION confirmed (issue to target) |
| ShareClass | totalIssued (target) | Y | Y + qty | CONVERSION confirmed |
| Shareholding | quantity | X | X * ratio | SPLIT confirmed (all in class) |
| ShareClass | totalIssued | X | X * ratio | SPLIT confirmed |
| ShareClass | totalAuthorized | X | X * ratio | SPLIT confirmed |

---

## By Role

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| List transactions | Yes | Yes | Yes | No (404) | No (404) |
| View transaction detail | Yes | Yes | Yes | No (404) | No (404) |
| Create transaction | Yes | Yes | No (404) | No (404) | No (404) |
| Submit draft | Yes | Yes | No (404) | No (404) | No (404) |
| Approve pending | Yes | No (404) | No (404) | No (404) | No (404) |
| Confirm & execute | Yes | No (404) | No (404) | No (404) | No (404) |
| Cancel transaction | Yes | Yes | No (404) | No (404) | No (404) |

---

## API Endpoints Summary

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /api/v1/companies/:companyId/transactions | ADMIN, FINANCE | Create a new transaction (DRAFT) |
| GET | /api/v1/companies/:companyId/transactions | ADMIN, FINANCE, LEGAL | List transactions with pagination/filtering |
| GET | /api/v1/companies/:companyId/transactions/:transactionId | ADMIN, FINANCE, LEGAL | Get transaction detail |
| POST | /api/v1/companies/:companyId/transactions/:transactionId/submit | ADMIN, FINANCE | Submit DRAFT transaction |
| POST | /api/v1/companies/:companyId/transactions/:transactionId/approve | ADMIN | Approve PENDING_APPROVAL transaction |
| POST | /api/v1/companies/:companyId/transactions/:transactionId/confirm | ADMIN | Confirm & execute cap table mutation |
| POST | /api/v1/companies/:companyId/transactions/:transactionId/cancel | ADMIN, FINANCE | Cancel a non-confirmed transaction |

---

## Frontend UI: Create Transaction Flow

### Page: `/dashboard/transactions/new`

**Component**: `CreateTransactionPage` (`frontend/src/app/(dashboard)/dashboard/transactions/new/page.tsx`)

### 2-Step Wizard

| Step | Name | Content |
|------|------|---------|
| 1 | Details | Transaction type selection (5 cards), dynamic form fields per type, notes, board approval |
| 2 | Review | Formatted summary of all entered data, total value calculation, create button |

### Transaction Type Cards

| Type | Icon | Fields Shown |
|------|------|-------------|
| ISSUANCE | Plus (green) | shareClass, toShareholder, quantity, pricePerShare |
| TRANSFER | ArrowLeftRight (blue) | shareClass, fromShareholder, toShareholder, quantity, pricePerShare |
| CONVERSION | RefreshCw (cream) | shareClass, fromShareholder, toShareClass, quantity |
| CANCELLATION | XCircle (red) | shareClass, fromShareholder, quantity, pricePerShare |
| SPLIT | GitBranch (gray) | shareClass, splitRatio |

### Smart Dropdown Filtering

- **TRANSFER**: "To Shareholder" dropdown excludes the selected "From Shareholder" to prevent same-shareholder transfers
- **CONVERSION**: "Target Share Class" dropdown excludes the selected source share class

### Client-Side Validation

| Field | Validation | Error Key |
|-------|-----------|-----------|
| shareClassId | Required for all types | `errors.val.required` |
| toShareholderId | Required for ISSUANCE, TRANSFER | `errors.val.required` |
| fromShareholderId | Required for TRANSFER, CONVERSION, CANCELLATION | `errors.val.required` |
| quantity | Required + > 0 for all except SPLIT | `errors.val.required` / `errors.val.mustBePositive` |
| pricePerShare | If provided, must be >= 0 | `errors.val.mustBePositive` |
| toShareClassId | Required for CONVERSION | `errors.val.required` |
| splitRatio | Required + > 0 for SPLIT | `errors.val.required` / `errors.val.mustBePositive` |

### TanStack Query Hooks

- `useCreateTransaction(companyId)` — `POST /api/v1/companies/:companyId/transactions`, invalidates transactions + cap-table + shareClasses queries on success
- `useSubmitTransaction(companyId)` — `POST /api/v1/companies/:companyId/transactions/:id/submit`, invalidates transactions query on success

### i18n Namespace

- `transactions.form.*` — ~50 keys covering all form labels, placeholders, review labels, descriptions
- `transactions.success.created` — success toast message
- Error messages via root namespace: `errors.val.required`, `errors.val.mustBePositive`, `errors.txn.sameShareholder`

### Tests

38 component tests covering: rendering, type selection, field visibility per type, dropdown population, validation, step navigation, review display, API submission per type, error handling, smart filtering, form reset on type change.
