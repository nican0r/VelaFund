# Document Signatures Specification

**Topic of Concern**: Ethereum wallet signatures for document verification

**One-Sentence Description**: The system collects Ethereum signatures (EIP-712) from document signers using Privy embedded wallets, verifies signatures, and anchors document hashes on-chain.

---

## Overview

Documents require signatures from relevant parties (shareholders, directors, employees). VelaFund uses Ethereum signatures (EIP-712 typed data) via Privy embedded wallets as the primary signature method. Users sign cryptographically without needing crypto knowledge. After all signatures are collected, the document hash is anchored on the blockchain for tamper-proof verification.

**Signature Flow**: Document generated → Signature requests sent → Users sign via Privy → All signatures collected → Hash anchored on-chain

---

## User Stories

### US-1: Request Signatures
**As an** admin user
**I want to** request signatures from specific shareholders
**So that** the document becomes legally binding

### US-2: Sign Document
**As a** shareholder
**I want to** sign a document using my wallet
**So that** I can approve agreements electronically

### US-3: Verify Signatures
**As an** admin or auditor
**I want to** verify document signatures cryptographically
**So that** I can prove authenticity

---

## Functional Requirements

### FR-1: Signature Requests
- Admin selects signers (by wallet address)
- System sends email notifications with signature links
- Each signer gets unique signature URL
- Signature request includes: document preview, signer role

### FR-2: EIP-712 Signature
- Use Ethereum EIP-712 typed data standard
- Signature data includes: document_hash, document_id, timestamp, signer_role
- Sign via Privy embedded wallet (no MetaMask required)
- Signature stored in database

### FR-3: Signature Verification
- Verify signature using ecrecover
- Verify signer wallet matches expected address
- Verify document_hash hasn't changed
- Display verification badge on document

### FR-4: On-Chain Anchoring
- After all signatures collected, anchor document_hash on Base Network
- Store transaction hash in document record
- Provides immutable proof of document existence

### FR-5: Signature Status Tracking
- Track per-signer status: PENDING, SIGNED, DECLINED
- Track overall document status: PENDING_SIGNATURES, PARTIALLY_SIGNED, FULLY_SIGNED

---

## Data Models

```typescript
interface Signature {
  id: string;
  document_id: string;
  user_id: string;

  // Signer Information
  wallet_address: string;
  signer_role: 'SHAREHOLDER' | 'DIRECTOR' | 'EMPLOYEE' | 'WITNESS';

  // EIP-712 Signature
  signature: string;                 // Hex-encoded signature (0x...)
  signature_type: 'EIP712';
  signed_message: {
    document_hash: string;
    document_id: string;
    timestamp: number;
    signer_role: string;
  };

  // Status
  status: 'PENDING' | 'SIGNED' | 'DECLINED';
  signed_at: Date | null;
  declined_at: Date | null;
  decline_reason: string | null;

  // Verification
  verified: boolean;
  verified_at: Date | null;

  created_at: Date;
}
```

---

## API Endpoints

### POST /api/v1/documents/:documentId/request-signatures
Request signatures from multiple signers

**Request**:
```json
{
  "signers": [
    {
      "user_id": "uuid",
      "wallet_address": "0x...",
      "role": "SHAREHOLDER"
    },
    {
      "user_id": "uuid",
      "wallet_address": "0x...",
      "role": "DIRECTOR"
    }
  ]
}
```

### POST /api/v1/documents/:documentId/signatures
Submit signature (called by frontend after user signs)

**Request**:
```json
{
  "signature": "0x...",
  "signed_message": {
    "document_hash": "0x...",
    "document_id": "uuid",
    "timestamp": 1705756800,
    "signer_role": "SHAREHOLDER"
  }
}
```

### GET /api/v1/documents/:documentId/signatures
Get signature status

**Response**:
```json
{
  "document_id": "uuid",
  "total_signers": 3,
  "signed": 2,
  "pending": 1,
  "signatures": [
    {
      "signer_name": "João Founder",
      "role": "SHAREHOLDER",
      "status": "SIGNED",
      "signed_at": "2024-01-20T10:00:00Z"
    },
    {
      "signer_name": "Investor ABC",
      "role": "SHAREHOLDER",
      "status": "PENDING"
    }
  ],
  "blockchain_tx_hash": null
}
```

---

## Business Rules

### BR-1: Signature Order
- Signatures collected in any order (parallel signing)
- No required sequence

### BR-2: Document Immutability
- Document content CANNOT change after first signature
- Any change invalidates all existing signatures

### BR-3: Signature Expiration
- Signature requests expire after 30 days
- Expired requests must be re-sent

### BR-4: On-Chain Anchoring
- Only anchor hash after ALL signatures collected
- Single blockchain transaction per document
- Document status = FULLY_SIGNED after anchoring

---

## User Flows

### Flow 1: Request and Collect Signatures

```
1. Admin generates document (Shareholder Agreement)
2. Admin clicks "Send for Signatures"
3. System displays signer selection form
4. Admin selects signers:
   - João Founder (Shareholder)
   - Maria Co-founder (Shareholder)
   - Investor ABC (Shareholder)
5. Admin clicks "Send Signature Requests"
6. System creates Signature records (status: PENDING)
7. System sends emails to all signers with links
8. Each signer receives email:
   - "Shareholder Agreement requires your signature"
   - "Click here to review and sign"
9. João clicks link, taken to document signing page
10. System displays document preview
11. João clicks "Sign Document"
12. Privy prompts for wallet signature
13. João confirms signature in Privy modal
14. Frontend calls POST /documents/:id/signatures with signature
15. Backend verifies signature using ecrecover
16. Backend stores signature, updates status: SIGNED
17. System sends email to admin: "João signed"
18. [Repeat steps 9-17 for Maria and Investor ABC]
19. After all 3 signatures collected:
20. System anchors document_hash on Base Network
21. System updates document.blockchain_tx_hash
22. System updates document.status = FULLY_SIGNED
23. System sends completion email to all parties

POSTCONDITION: Document fully signed, hash on-chain, immutable record
```

---

## Edge Cases

### EC-1: User Declines to Sign
**Scenario**: Signer clicks "Decline"
**Handling**: Update signature status to DECLINED, notify admin, admin can cancel document or resend

### EC-2: Invalid Signature
**Scenario**: Frontend sends invalid signature (wrong wallet)
**Handling**: ecrecover fails, return 400 error, prompt user to retry

### EC-3: Document Modified After Signature
**Scenario**: Admin tries to edit document with existing signatures
**Handling**: Block edit, show error: "Cannot edit document with signatures. Create new version."

---

## Dependencies

- **Documents**: Signatures reference documents
- **Users**: Signers are users with Privy wallets
- **Blockchain**: Document hash anchoring on Base Network
- **Notifications**: Email notifications for signature requests

---

## Success Criteria

- Signature collection: < 5 minutes per signer
- Signature verification: 100% accuracy
- Zero invalid signatures stored
- On-chain anchoring: < 30 seconds after last signature
