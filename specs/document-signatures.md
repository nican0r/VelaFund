# Document Signatures Specification

**Topic of Concern**: Ethereum wallet signatures for document verification

**One-Sentence Description**: The system collects Ethereum signatures (EIP-712) from document signers using Privy embedded wallets, verifies signatures, and anchors document hashes on-chain.

---

## Overview

Documents require signatures from relevant parties (shareholders, directors, employees). Navia uses Ethereum signatures (EIP-712 typed data) via Privy embedded wallets as the primary signature method. Users sign cryptographically without needing crypto knowledge. After all signatures are collected, the document hash is anchored on the blockchain for tamper-proof verification.

**Signature Flow**: Document generated -> Signature requests sent -> Users sign via Privy -> All signatures collected -> Hash anchored on-chain

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
interface DocumentSigner {
  id: string;
  documentId: string;
  userId: string;

  // Signer Information
  walletAddress: string;
  signerRole: 'SHAREHOLDER' | 'DIRECTOR' | 'EMPLOYEE' | 'WITNESS';

  // EIP-712 Signature
  signature: string | null;           // Hex-encoded signature (0x...)
  signatureType: 'EIP712';
  signedMessage: {
    documentHash: string;
    documentId: string;
    timestamp: number;
    signerRole: string;
  } | null;

  // Status
  status: 'PENDING' | 'SIGNED' | 'DECLINED';
  signedAt: Date | null;
  declinedAt: Date | null;
  declineReason: string | null;

  // Verification
  verified: boolean;
  verifiedAt: Date | null;

  createdAt: Date;
}
```

---

## API Endpoints

### Request Signatures

```
POST /api/v1/companies/:companyId/documents/:documentId/signers
```

Request signatures from multiple signers for a document.

**Request Body**:

```json
{
  "signers": [
    {
      "userId": "uuid",
      "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
      "role": "SHAREHOLDER"
    },
    {
      "userId": "uuid",
      "walletAddress": "0xabcdef1234567890abcdef1234567890abcdef12",
      "role": "DIRECTOR"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signers` | array | Yes | List of signers to request |
| `signers[].userId` | UUID | Yes | User ID of the signer |
| `signers[].walletAddress` | string | Yes | Ethereum wallet address |
| `signers[].role` | string | Yes | Signer role: SHAREHOLDER, DIRECTOR, EMPLOYEE, WITNESS |

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "signers": [
      {
        "id": "signer-uuid-1",
        "userId": "uuid",
        "walletAddress": "0x1234...5678",
        "role": "SHAREHOLDER",
        "status": "PENDING",
        "createdAt": "2026-01-20T14:30:00.000Z"
      },
      {
        "id": "signer-uuid-2",
        "userId": "uuid",
        "walletAddress": "0xabcd...ef12",
        "role": "DIRECTOR",
        "status": "PENDING",
        "createdAt": "2026-01-20T14:30:00.000Z"
      }
    ],
    "totalSigners": 2,
    "signed": 0,
    "pending": 2
  }
}
```

**Error Response** (404 — document not found):

```json
{
  "success": false,
  "error": {
    "code": "DOC_NOT_FOUND",
    "message": "Documento nao encontrado",
    "messageKey": "errors.doc.notFound"
  }
}
```

**Error Response** (422 — document already fully signed):

```json
{
  "success": false,
  "error": {
    "code": "DOC_ALL_SIGNATURES_COMPLETE",
    "message": "Documento ja possui todas as assinaturas",
    "messageKey": "errors.doc.allSignaturesComplete"
  }
}
```

### Sign Document

```
POST /api/v1/companies/:companyId/documents/:documentId/signers/:signerId/sign
```

Submit an EIP-712 signature for a document. Called by the frontend after the user signs via Privy.

**Request Body**:

```json
{
  "signature": "0x1234567890abcdef...",
  "signedMessage": {
    "documentHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "documentId": "uuid",
    "timestamp": 1705756800,
    "signerRole": "SHAREHOLDER"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signature` | string | Yes | Hex-encoded EIP-712 signature (0x...) |
| `signedMessage` | object | Yes | The EIP-712 typed data that was signed |
| `signedMessage.documentHash` | string | Yes | SHA-256 hash of the document |
| `signedMessage.documentId` | UUID | Yes | Document ID |
| `signedMessage.timestamp` | number | Yes | Unix timestamp when signed |
| `signedMessage.signerRole` | string | Yes | Role of the signer |

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "signer-uuid",
    "documentId": "uuid",
    "userId": "user-uuid",
    "walletAddress": "0x1234...5678",
    "role": "SHAREHOLDER",
    "status": "SIGNED",
    "verified": true,
    "signedAt": "2026-01-20T15:00:00.000Z",
    "verifiedAt": "2026-01-20T15:00:00.000Z"
  }
}
```

**Error Response** (422 — invalid signature):

```json
{
  "success": false,
  "error": {
    "code": "DOC_SIGNATURE_INVALID",
    "message": "Assinatura digital invalida",
    "messageKey": "errors.doc.signatureInvalid"
  }
}
```

**Error Response** (422 — already signed):

```json
{
  "success": false,
  "error": {
    "code": "DOC_ALREADY_SIGNED",
    "message": "Documento ja foi assinado por este signatario",
    "messageKey": "errors.doc.alreadySigned"
  }
}
```

**Error Response** (422 — all signatures already complete):

```json
{
  "success": false,
  "error": {
    "code": "DOC_ALL_SIGNATURES_COMPLETE",
    "message": "Documento ja possui todas as assinaturas",
    "messageKey": "errors.doc.allSignaturesComplete"
  }
}
```

### Get Signature Status

```
GET /api/v1/companies/:companyId/documents/:documentId/signers
```

Returns the signature status for all signers of a document.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "totalSigners": 3,
    "signed": 2,
    "pending": 1,
    "declined": 0,
    "signers": [
      {
        "id": "signer-uuid-1",
        "userId": "user-uuid-1",
        "signerName": "Joao Founder",
        "role": "SHAREHOLDER",
        "status": "SIGNED",
        "signedAt": "2026-01-20T10:00:00.000Z",
        "verified": true
      },
      {
        "id": "signer-uuid-2",
        "userId": "user-uuid-2",
        "signerName": "Maria Co-founder",
        "role": "SHAREHOLDER",
        "status": "SIGNED",
        "signedAt": "2026-01-20T12:00:00.000Z",
        "verified": true
      },
      {
        "id": "signer-uuid-3",
        "userId": "user-uuid-3",
        "signerName": "Investor ABC",
        "role": "SHAREHOLDER",
        "status": "PENDING",
        "signedAt": null,
        "verified": false
      }
    ],
    "blockchainTxHash": null
  }
}
```

**Error Response** (404 — document not found):

```json
{
  "success": false,
  "error": {
    "code": "DOC_NOT_FOUND",
    "message": "Documento nao encontrado",
    "messageKey": "errors.doc.notFound"
  }
}
```

### Verify Document Signatures

```
GET /api/v1/companies/:companyId/documents/:documentId/verify
```

Cryptographically verifies all signatures on a document and checks blockchain anchoring.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "documentHash": "sha256-hash",
    "allSignaturesValid": true,
    "blockchainAnchored": true,
    "blockchainTxHash": "0xabc123...",
    "verifiedAt": "2026-01-22T10:00:00.000Z",
    "signers": [
      {
        "signerName": "Joao Founder",
        "walletAddress": "0x1234...5678",
        "signatureValid": true,
        "signedAt": "2026-01-20T10:00:00.000Z"
      }
    ]
  }
}
```

---

## Error Codes

| Code | HTTP Status | messageKey | Description |
|------|-------------|-----------|-------------|
| `DOC_NOT_FOUND` | 404 | `errors.doc.notFound` | Document does not exist or user has no access |
| `DOC_SIGNATURE_INVALID` | 422 | `errors.doc.signatureInvalid` | EIP-712 signature verification failed (ecrecover mismatch) |
| `DOC_ALREADY_SIGNED` | 422 | `errors.doc.alreadySigned` | Signer has already signed this document |
| `DOC_ALL_SIGNATURES_COMPLETE` | 422 | `errors.doc.allSignaturesComplete` | Document already has all required signatures |

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
   - Joao Founder (Shareholder)
   - Maria Co-founder (Shareholder)
   - Investor ABC (Shareholder)
5. Admin clicks "Send Signature Requests"
6. System creates DocumentSigner records (status: PENDING)
7. System sends emails to all signers with links
8. Each signer receives email:
   - "Shareholder Agreement requires your signature"
   - "Click here to review and sign"
9. Joao clicks link, taken to document signing page
10. System displays document preview
11. Joao clicks "Sign Document"
12. Privy prompts for wallet signature
13. Joao confirms signature in Privy modal
14. Frontend calls POST /api/v1/companies/:companyId/documents/:id/signers/:signerId/sign
15. Backend verifies signature using ecrecover
16. Backend stores signature, updates status: SIGNED
17. System sends email to admin: "Joao signed"
18. [Repeat steps 9-17 for Maria and Investor ABC]
19. After all 3 signatures collected:
20. System anchors document_hash on Base Network
21. System updates document.blockchainTxHash
22. System updates document.status = FULLY_SIGNED
23. System sends completion email to all parties

POSTCONDITION: Document fully signed, hash on-chain, immutable record
```

---

## Edge Cases

### EC-1: User Declines to Sign
**Scenario**: Signer clicks "Decline"
**Handling**: Update signer status to DECLINED, notify admin via email. Admin can cancel the document or re-send a new signature request. The document remains in PENDING_SIGNATURES status.

### EC-2: Invalid Signature (Wrong Wallet)
**Scenario**: Frontend sends signature signed by a different wallet than expected
**Handling**: Backend runs ecrecover, recovered address does not match expected `walletAddress`. Return `DOC_SIGNATURE_INVALID` (422). Frontend prompts the user to retry with the correct wallet.

### EC-3: Document Modified After Signature
**Scenario**: Admin tries to edit a document that already has one or more signatures
**Handling**: Block the edit. Return error explaining that documents with existing signatures cannot be modified. Admin must create a new version of the document, which invalidates the old signature requests.

---

## Dependencies

- **Documents**: Signatures reference documents
- **Users**: Signers are users with Privy wallets
- **Blockchain**: Document hash anchoring on Base Network
- **Notifications**: Email notifications for signature requests

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [document-generation.md](./document-generation.md) | Document creation and PDF generation (prerequisite for signing) |
| [blockchain-integration.md](./blockchain-integration.md) | Document hash anchoring on-chain after all signatures collected |
| [authentication.md](./authentication.md) | Privy embedded wallets used for EIP-712 digital signatures |
| [company-management.md](./company-management.md) | Documents are scoped to a company |
| [notifications.md](./notifications.md) | Email notifications for signature requests and completion |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, error format, and URL conventions for signature endpoints |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: DOC_SIGNATURE_INVALID, DOC_ALREADY_SIGNED, DOC_ALL_SIGNATURES_COMPLETE |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: DOCUMENT_SIGNATURE_REQUESTED, DOCUMENT_SIGNED, DOCUMENT_FULLY_SIGNED, DOCUMENT_ANCHORED |

---

## Success Criteria

- Signature collection: < 5 minutes per signer
- Signature verification: 100% accuracy
- Zero invalid signatures stored
- On-chain anchoring: < 30 seconds after last signature
- All API responses use standard envelope format
- Error responses include proper error codes and messageKeys
