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

### DocumentSigner Entity

Matches the Prisma schema `DocumentSigner` model:

```typescript
interface DocumentSigner {
  id: string;
  documentId: string;                  // FK to Document
  userId: string | null;               // FK to User (null for external signers — not in MVP)
  name: string;                        // Signer display name
  email: string;                       // Signer email (used for notifications + unique per document)
  walletAddress: string | null;        // Privy embedded wallet address (null until user has wallet)
  signerRole: 'SHAREHOLDER' | 'DIRECTOR' | 'EMPLOYEE' | 'WITNESS';
  status: 'PENDING' | 'SIGNED' | 'DECLINED';
  signature: string | null;            // Hex-encoded EIP-712 signature (0x...)
  signatureType: string | null;        // 'EIP712' when signed
  signedAt: Date | null;
  declinedAt: Date | null;
  declineReason: string | null;
  expiresAt: Date;                     // Signature request expiration (30 days from creation)
  createdAt: Date;
  updatedAt: Date;
}
```

**Key differences from previous version**:
- `name` and `email` are stored directly (not only via `userId` lookup) for display and notification purposes.
- `walletAddress` is nullable (populated from `User.walletAddress` at creation time).
- `signedMessage` is not stored as a separate field — the EIP-712 typed data is reconstructed from the document hash and signer details for verification.
- `verified` and `verifiedAt` are not stored — verification is computed on-demand by the verify endpoint using `ecrecover`.
- `expiresAt` is required — set to 30 days from creation.
- Unique constraint: `@@unique([documentId, email])` — a signer can only be added once per document.

---

## EIP-712 Typed Data Definition

The EIP-712 typed data standard is used for document signing. The frontend constructs this object and passes it to Privy's `signTypedData()` method.

### Domain

```typescript
const NAVIA_SIGNING_DOMAIN = {
  name: 'NaviaDocumentSigning',
  version: '1',
  chainId: 8453,                       // Base mainnet
  verifyingContract: '0x0000000000000000000000000000000000000000', // No contract (off-chain signatures)
};
```

### Types

```typescript
const DOCUMENT_SIGNATURE_TYPES = {
  DocumentSignature: [
    { name: 'documentId', type: 'string' },
    { name: 'documentHash', type: 'bytes32' },
    { name: 'signerRole', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
};
```

### Value (constructed per signing request)

```typescript
const signatureValue = {
  documentId: 'uuid-of-document',
  documentHash: '0xabcdef...', // SHA-256 hash of document content (contentHash)
  signerRole: 'SHAREHOLDER',
  timestamp: Math.floor(Date.now() / 1000), // Unix timestamp
};
```

### Frontend Signing Flow

```typescript
// Using Privy SDK
const { signTypedData } = useSignTypedData();

const signature = await signTypedData({
  domain: NAVIA_SIGNING_DOMAIN,
  types: DOCUMENT_SIGNATURE_TYPES,
  primaryType: 'DocumentSignature',
  message: signatureValue,
});

// Submit to backend
await api.post(`/api/v1/companies/${companyId}/documents/${documentId}/signers/${signerId}/sign`, {
  signature,
  timestamp: signatureValue.timestamp,
});
```

### Backend Verification

The backend verifies signatures using `ecrecover`:
1. Reconstruct the EIP-712 typed data hash from the stored document hash, signer role, and submitted timestamp.
2. Run `ecrecover(hash, signature)` to recover the signer's wallet address.
3. Compare recovered address against `DocumentSigner.walletAddress`.
4. If match: signature is valid. If mismatch: return `DOC_SIGNATURE_INVALID`.

---

## API Endpoints

### Request Signatures

```
POST /api/v1/companies/:companyId/documents/:documentId/signers
```

Request signatures from company members. The backend resolves each user's `name`, `email`, and `walletAddress` from the User record. Signers must be platform users (company members with Privy accounts).

**Request Body**:

```json
{
  "signers": [
    {
      "userId": "uuid",
      "role": "SHAREHOLDER"
    },
    {
      "userId": "uuid",
      "role": "DIRECTOR"
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signers` | array | Yes | List of signers to request (1-20 signers) |
| `signers[].userId` | UUID | Yes | User ID of the signer (must be a company member) |
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
        "name": "Joao Founder",
        "email": "joao@example.com",
        "walletAddress": "0x1234...5678",
        "role": "SHAREHOLDER",
        "status": "PENDING",
        "expiresAt": "2026-02-19T14:30:00.000Z",
        "createdAt": "2026-01-20T14:30:00.000Z"
      },
      {
        "id": "signer-uuid-2",
        "userId": "uuid",
        "name": "Maria Co-founder",
        "email": "maria@example.com",
        "walletAddress": "0xabcd...ef12",
        "role": "DIRECTOR",
        "status": "PENDING",
        "expiresAt": "2026-02-19T14:30:00.000Z",
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

**Error Response** (422 — document not in signable status):

```json
{
  "success": false,
  "error": {
    "code": "DOC_NOT_SIGNABLE",
    "message": "Documento nao esta em status que permite assinaturas",
    "messageKey": "errors.doc.notSignable"
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

**Error Response** (422 — signer not a company member):

```json
{
  "success": false,
  "error": {
    "code": "DOC_SIGNER_NOT_MEMBER",
    "message": "Signatario nao e membro da empresa",
    "messageKey": "errors.doc.signerNotMember"
  }
}
```

**Error Response** (422 — signer has no wallet):

```json
{
  "success": false,
  "error": {
    "code": "DOC_SIGNER_NO_WALLET",
    "message": "Signatario nao possui carteira digital",
    "messageKey": "errors.doc.signerNoWallet"
  }
}
```

**Error Response** (409 — signer already added):

```json
{
  "success": false,
  "error": {
    "code": "DOC_SIGNER_DUPLICATE",
    "message": "Signatario ja foi adicionado a este documento",
    "messageKey": "errors.doc.signerDuplicate"
  }
}
```

### Sign Document

```
POST /api/v1/companies/:companyId/documents/:documentId/signers/:signerId/sign
```

Submit an EIP-712 signature for a document. Called by the frontend after the user signs via Privy's `signTypedData()`.

**Request Body**:

```json
{
  "signature": "0x1234567890abcdef...",
  "timestamp": 1705756800
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signature` | string | Yes | Hex-encoded EIP-712 signature (0x...) from Privy `signTypedData()` |
| `timestamp` | number | Yes | Unix timestamp used in the signed message (for replay verification) |

The backend reconstructs the full EIP-712 typed data from the document's `contentHash`, the signer's `signerRole`, and the submitted `timestamp`, then verifies the signature using `ecrecover`.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "signer-uuid",
    "documentId": "uuid",
    "userId": "user-uuid",
    "name": "Joao Founder",
    "walletAddress": "0x1234...5678",
    "role": "SHAREHOLDER",
    "status": "SIGNED",
    "signedAt": "2026-01-20T15:00:00.000Z"
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

### Decline Signature

```
POST /api/v1/companies/:companyId/documents/:documentId/signers/:signerId/decline
```

Allows a signer to decline to sign a document.

**Request Body**:

```json
{
  "reason": "Nao concordo com os termos da clausula 5"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | Optional reason for declining (max 500 chars) |

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "signer-uuid",
    "status": "DECLINED",
    "declinedAt": "2026-01-20T15:00:00.000Z",
    "declineReason": "Nao concordo com os termos da clausula 5"
  }
}
```

---

### Resend Signature Request

```
POST /api/v1/companies/:companyId/documents/:documentId/signers/:signerId/resend
```

Resends the signature request email to a PENDING signer and resets the expiration to 30 days from now.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "signer-uuid",
    "status": "PENDING",
    "expiresAt": "2026-02-19T15:00:00.000Z",
    "message": "Email de assinatura reenviado"
  }
}
```

**Error Response** (422 — signer not pending):

```json
{
  "success": false,
  "error": {
    "code": "DOC_SIGNER_NOT_PENDING",
    "message": "Signatario nao esta com assinatura pendente",
    "messageKey": "errors.doc.signerNotPending"
  }
}
```

---

### Remove Signer

```
DELETE /api/v1/companies/:companyId/documents/:documentId/signers/:signerId
```

Removes a PENDING signer from the document. Cannot remove signers who have already signed.

**Response** (204 No Content)

**Error Response** (422 — signer already signed):

```json
{
  "success": false,
  "error": {
    "code": "DOC_SIGNER_ALREADY_SIGNED",
    "message": "Nao e possivel remover signatario que ja assinou",
    "messageKey": "errors.doc.signerAlreadySigned"
  }
}
```

---

## Permission Matrix

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| Request signatures | Yes | No | Yes | No | No |
| View signature status | Yes | Yes | Yes | Own docs only | Own docs only |
| Sign document | Yes (if signer) | Yes (if signer) | Yes (if signer) | Yes (if signer) | Yes (if signer) |
| Decline signature | Yes (if signer) | Yes (if signer) | Yes (if signer) | Yes (if signer) | Yes (if signer) |
| Resend signature request | Yes | No | Yes | No | No |
| Remove signer | Yes | No | No | No | No |
| Verify signatures | Yes | Yes | Yes | No | No |

---

## Error Codes

| Code | HTTP Status | messageKey | Description |
|------|-------------|-----------|-------------|
| `DOC_NOT_FOUND` | 404 | `errors.doc.notFound` | Document does not exist or user has no access |
| `DOC_SIGNER_NOT_FOUND` | 404 | `errors.doc.signerNotFound` | Signer record not found |
| `DOC_NOT_SIGNABLE` | 422 | `errors.doc.notSignable` | Document not in a status that allows signatures (must be GENERATED or PENDING_SIGNATURES or PARTIALLY_SIGNED) |
| `DOC_SIGNATURE_INVALID` | 422 | `errors.doc.signatureInvalid` | EIP-712 signature verification failed (ecrecover mismatch) |
| `DOC_ALREADY_SIGNED` | 422 | `errors.doc.alreadySigned` | Signer has already signed this document |
| `DOC_ALL_SIGNATURES_COMPLETE` | 422 | `errors.doc.allSignaturesComplete` | Document already has all required signatures |
| `DOC_SIGNER_NOT_MEMBER` | 422 | `errors.doc.signerNotMember` | Specified user is not a member of the company |
| `DOC_SIGNER_NO_WALLET` | 422 | `errors.doc.signerNoWallet` | Specified user does not have a Privy embedded wallet |
| `DOC_SIGNER_DUPLICATE` | 409 | `errors.doc.signerDuplicate` | Signer already added to this document (unique email per document) |
| `DOC_SIGNER_NOT_PENDING` | 422 | `errors.doc.signerNotPending` | Signer is not in PENDING status (cannot resend/modify) |
| `DOC_SIGNER_ALREADY_SIGNED` | 422 | `errors.doc.signerAlreadySigned` | Cannot remove a signer who has already signed |
| `DOC_SIGNATURE_EXPIRED` | 422 | `errors.doc.signatureExpired` | Signature request has expired (past expiresAt) |
| `DOC_NOT_YOUR_SIGNATURE` | 403 | `errors.doc.notYourSignature` | Authenticated user is not the assigned signer |

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

## Success Criteria

- Signature collection: < 5 minutes per signer
- Signature verification: 100% accuracy via ecrecover
- Zero invalid signatures stored
- On-chain anchoring: < 30 seconds after last signature
- All API responses use standard envelope format
- Error responses include proper error codes and messageKeys
- Signature requests expire after 30 days
- Email notifications sent for: request, reminder (at 7 days remaining), completion

---

# Frontend Specification

---

## Table of Contents (Frontend)

1. [Frontend Architecture (Signatures)](#frontend-architecture-signatures)
2. [Component Hierarchy (Signatures)](#component-hierarchy-signatures)
3. [Component Specifications (Signatures)](#component-specifications-signatures)
4. [Frontend User Flows (Signatures)](#frontend-user-flows-signatures)
5. [UI States and Error Handling (Signatures)](#ui-states-and-error-handling-signatures)
6. [TanStack Query Integration (Signatures)](#tanstack-query-integration-signatures)
7. [i18n Keys (Signatures)](#i18n-keys-signatures)
8. [Frontend Success Criteria (Signatures)](#frontend-success-criteria-signatures)

---

## Frontend Architecture (Signatures)

### MVP Scope

The document signatures frontend is embedded within the Document Detail page (`/dashboard/documents/:id`). It consists of:

1. **SignatureRequestSection** — Admin adds signers from company members, sends signature requests.
2. **SignatureProgressTracker** — Displays per-signer status (pending/signed/declined) with a progress bar.
3. **SignDocumentButton** — For the current user when they are a designated signer.
4. **SigningConfirmationModal** — Abstracted Privy signing UX ("Assinar Documento" not "Sign EIP-712 typed data").
5. **SignatureVerificationBadge** — Shows verification status with Basescan link after on-chain anchoring.

### State Management

- Signature status: TanStack Query, polled every 10 seconds while document is in `PENDING_SIGNATURES` or `PARTIALLY_SIGNED` status.
- Signing flow: Local modal state + Privy `signTypedData()` hook.
- The signing UX is fully abstracted — users see "Assinar Documento" and a lock icon, never EIP-712 or blockchain terminology.

---

## Component Hierarchy (Signatures)

```
app/(dashboard)/documents/[id]/page.tsx ─→ DocumentDetailPage
  ├─ DocumentHeader
  ├─ DocumentPreviewEmbed
  ├─ DocumentMetadata
  └─ DocumentSignaturesSection                          ← NEW
       ├─ SignatureRequestSection (ADMIN/LEGAL only)
       │    ├─ MemberSignerSelect (multi-select dropdown)
       │    └─ RoleSelector (per signer)
       ├─ SignatureProgressTracker
       │    ├─ SignatureProgressBar
       │    └─ SignerRow (per signer)
       │         ├─ SignerStatusBadge
       │         └─ SignerActionsMenu (resend, remove — ADMIN only)
       ├─ SignDocumentButton (visible only if current user is a PENDING signer)
       │    └─ (click) → SigningConfirmationModal
       │         ├─ DocumentPreview (read-only)
       │         └─ SignButton ("Assinar Documento")
       └─ SignatureVerificationBadge (after FULLY_SIGNED + anchored)
```

### Component Registry

| Component | File | Description |
|-----------|------|-------------|
| `DocumentSignaturesSection` | `components/documents/signatures/document-signatures-section.tsx` | Main signatures container |
| `SignatureRequestSection` | `components/documents/signatures/signature-request-section.tsx` | Add signers form |
| `MemberSignerSelect` | `components/documents/signatures/member-signer-select.tsx` | Multi-select for company members |
| `SignatureProgressTracker` | `components/documents/signatures/signature-progress-tracker.tsx` | Signer list with status |
| `SignerRow` | `components/documents/signatures/signer-row.tsx` | Individual signer display |
| `SignerStatusBadge` | `components/documents/signatures/signer-status-badge.tsx` | PENDING/SIGNED/DECLINED badge |
| `SignDocumentButton` | `components/documents/signatures/sign-document-button.tsx` | CTA for the current user to sign |
| `SigningConfirmationModal` | `components/documents/signatures/signing-confirmation-modal.tsx` | Abstracted signing UX |
| `SignatureVerificationBadge` | `components/documents/signatures/signature-verification-badge.tsx` | On-chain verification display |

---

## Component Specifications (Signatures)

### 1. SignatureRequestSection

**File**: `components/documents/signatures/signature-request-section.tsx`

**Props**:
```typescript
interface SignatureRequestSectionProps {
  companyId: string;
  documentId: string;
  documentStatus: string;
  existingSigners: DocumentSigner[];
  onSignersAdded: () => void;
}
```

**Visual Structure**:
```
+--------------------------------------------------+
|  Solicitar Assinaturas                           |
|                                                  |
|  Selecione os membros que devem assinar          |
|  este documento.                                 |
|                                                  |
|  Signatarios *                                   |
|  +--------------------------------------------+ |
|  | Selecionar membros...                   [v] | |  ← Multi-select dropdown
|  +--------------------------------------------+ |
|                                                  |
|  Signatarios selecionados:                       |
|  +--------------------------------------------+ |
|  | Joao Founder      Papel: [Acionista   v] [X]| |
|  | Maria Co-founder  Papel: [Diretora    v] [X]| |
|  | Investor ABC      Papel: [Acionista   v] [X]| |
|  +--------------------------------------------+ |
|                                                  |
|  [Enviar Solicitacoes de Assinatura]             |  ← Primary button
+--------------------------------------------------+
```

**MemberSignerSelect**: Dropdown listing company members. Each option shows: `{name} ({email})`. Members already added as signers are disabled. Members without `walletAddress` show a warning icon + tooltip "Sem carteira digital".

**Role per signer**: Dropdown with options: Acionista, Diretor(a), Funcionario(a), Testemunha.

**Visibility**: Only shown to ADMIN and LEGAL roles. Hidden when document is FULLY_SIGNED.

---

### 2. SignatureProgressTracker

**File**: `components/documents/signatures/signature-progress-tracker.tsx`

**Props**:
```typescript
interface SignatureProgressTrackerProps {
  documentId: string;
  companyId: string;
}
```

**Visual Structure**:
```
+--------------------------------------------------+
|  Assinaturas (2 de 3)                            |
|  [=========----------] 66%                       |  ← Progress bar
|                                                  |
|  +--------------------------------------------+ |
|  | ✓ Joao Founder     Acionista    20/01/2026  | |  ← Signed (green check)
|  +--------------------------------------------+ |
|  | ✓ Maria Co-founder Acionista    20/01/2026  | |  ← Signed (green check)
|  +--------------------------------------------+ |
|  | ● Investor ABC     Acionista    Pendente    | |  ← Pending (yellow dot)
|  |                             [Reenviar] [...]| |  ← Actions (ADMIN only)
|  +--------------------------------------------+ |
|                                                  |
+--------------------------------------------------+
```

**Progress bar**: `blue-600` fill on `gray-200` track, `radius-full`, `4px` height. Shows `{signed}/{total}` count.

**SignerRow**: Shows name, role, status badge, and action date.

**SignerStatusBadge variants**:

| Status | Icon | Color | Label |
|--------|------|-------|-------|
| `PENDING` | Circle dot | `cream-100` / `cream-700` | "Pendente" |
| `SIGNED` | Check circle | `green-100` / `green-700` | "Assinado" + date |
| `DECLINED` | X circle | `#FEE2E2` / `#991B1B` | "Recusado" + date |

**SignerActionsMenu** (dropdown, ADMIN only):
- "Reenviar email" → calls `POST .../resend`
- "Remover" → confirmation dialog → calls `DELETE .../signers/:id`

---

### 3. SignDocumentButton & SigningConfirmationModal

**SignDocumentButton** — shown only if the current authenticated user is a PENDING signer for this document.

**File**: `components/documents/signatures/sign-document-button.tsx`

**Visual Structure**:
```
+--------------------------------------------------+
|  🔒 Sua assinatura e necessaria                  |  ← Info callout, blue-50 bg
|                                                  |
|  Voce foi solicitado a assinar este documento    |
|  como Acionista.                                 |
|                                                  |
|  [Assinar Documento]  [Recusar]                  |
+--------------------------------------------------+
```

- "Assinar Documento": Primary button with lock icon. Opens `SigningConfirmationModal`.
- "Recusar": Ghost/destructive button. Opens decline confirmation dialog with optional reason textarea.

**SigningConfirmationModal**:

```
+--------------------------------------------------+
|  Assinar Documento                       [X]     |
+--------------------------------------------------+
|                                                  |
|  Voce esta assinando:                            |
|  "Acordo de Acionistas - Series A"               |  ← Document title, bold
|                                                  |
|  Papel: Acionista                                |
|                                                  |
|  Ao assinar, voce confirma que revisou o         |
|  documento e concorda com seus termos.           |
|                                                  |
|  +--------------------------------------------+ |
|  |        [🔒 Confirmar Assinatura]            | |  ← Primary button, lock icon
|  +--------------------------------------------+ |
|                                                  |
|  (Signing state: spinner + "Processando          |
|   assinatura...")                                |
|                                                  |
|  (Success state: ✓ "Documento assinado com       |
|   sucesso!")                                     |
|                                                  |
+--------------------------------------------------+
```

**Behavior**:
1. On "Confirmar Assinatura":
   - Generate `timestamp` = current Unix time.
   - Construct EIP-712 typed data using document's `contentHash`, signer's `role`, and `timestamp`.
   - Call Privy `signTypedData()` — user sees the Privy modal (abstracted, no blockchain jargon).
   - On signature received: call `POST .../signers/:signerId/sign` with `{ signature, timestamp }`.
2. On success (200): show green check + "Documento assinado com sucesso!" — auto-close after 2s.
3. On Privy rejection (user cancels): show "Assinatura cancelada" inline.
4. On 422 invalid signature: show "Assinatura invalida. Tente novamente." with retry button.
5. On 422 expired: show "Solicitacao de assinatura expirada. Solicite uma nova." — disable retry.

---

### 4. SignatureVerificationBadge

**File**: `components/documents/signatures/signature-verification-badge.tsx`

**Props**:
```typescript
interface SignatureVerificationBadgeProps {
  companyId: string;
  documentId: string;
}
```

**Visual Structure** (shown only when document is FULLY_SIGNED):
```
+--------------------------------------------------+
|  ✓ Documento Verificado                          |  ← green badge
|                                                  |
|  Todas as assinaturas foram verificadas          |
|  criptograficamente.                             |
|                                                  |
|  Hash: 0xabc123...def456  [Copiar]               |
|  Blockchain: 0xdef789...  [Ver no Basescan ↗]    |  ← Only if anchored
|  Verificado em: 22/01/2026 10:00                 |
|                                                  |
|  [Verificar Novamente]                           |  ← Secondary button
+--------------------------------------------------+
```

**Behavior**:
1. Fetches `GET .../verify` to get on-demand verification status.
2. If `allSignaturesValid` and `blockchainAnchored`: shows green verified badge.
3. If `allSignaturesValid` but not anchored: shows yellow "Aguardando ancoragem".
4. "Verificar Novamente" re-fetches the verify endpoint.

---

## Frontend User Flows (Signatures)

### Flow: Request Signatures (Admin)

```
Admin views Document Detail page (document status: GENERATED)
  │
  ├─ SignatureRequestSection visible
  │     │
  │     ├─ Admin selects members from dropdown
  │     │     │
  │     │     ├─ [member has wallet] ─→ Selectable, assign role
  │     │     └─ [member has no wallet] ─→ Shown with warning, disabled
  │     │
  │     └─ Admin clicks "Enviar Solicitacoes de Assinatura"
  │           │
  │           ├─ [201 success] ─→ Toast "Solicitacoes enviadas"
  │           │     Document status → PENDING_SIGNATURES
  │           │     SignatureProgressTracker appears
  │           │
  │           ├─ [422 signer not member] ─→ Inline error
  │           ├─ [422 signer no wallet] ─→ Inline error
  │           └─ [409 duplicate signer] ─→ Inline error
  │
  └─ SignatureProgressTracker polls every 10s for updates
```

### Flow: Sign Document (Signer)

```
Signer opens Document Detail page (they are a PENDING signer)
  │
  ├─ SignDocumentButton visible with callout
  │     │
  │     ├─ [clicks "Assinar Documento"] ─→ SigningConfirmationModal opens
  │     │     │
  │     │     ├─ [clicks "Confirmar Assinatura"] ─→ Privy signTypedData()
  │     │     │     │
  │     │     │     ├─ [signs successfully] ─→ POST /sign
  │     │     │     │     │
  │     │     │     │     ├─ [200 success] ─→ "Documento assinado!" ─→ Modal auto-closes
  │     │     │     │     ├─ [422 invalid sig] ─→ "Assinatura invalida" ─→ retry
  │     │     │     │     └─ [422 expired] ─→ "Solicitacao expirada"
  │     │     │     │
  │     │     │     └─ [user cancels in Privy] ─→ "Assinatura cancelada"
  │     │     │
  │     │     └─ [closes modal] ─→ No action taken
  │     │
  │     └─ [clicks "Recusar"] ─→ Decline dialog with optional reason
  │           │
  │           ├─ [confirms decline] ─→ POST /decline
  │           │     │
  │           │     └─ [200 success] ─→ Toast "Assinatura recusada"
  │           │           SignDocumentButton replaced with "Voce recusou este documento"
  │           │
  │           └─ [cancels] ─→ Dialog closes
  │
  └─ After all signers sign → document status: FULLY_SIGNED
        │
        └─ SignatureVerificationBadge appears with on-chain anchoring info
```

---

## UI States and Error Handling (Signatures)

### SignatureProgressTracker States

| State | Visual |
|-------|--------|
| Loading | Skeleton progress bar + 3 skeleton rows |
| No signers yet | "Nenhum signatario adicionado" with info text |
| All pending | Progress bar 0%, all rows show yellow dots |
| Partially signed | Progress bar reflects %, mixed green/yellow rows |
| All signed | Progress bar 100% green, all rows green checks |
| Has declined | Progress bar excludes declined from total, red X rows |

### SigningConfirmationModal States

| State | Visual |
|-------|--------|
| Ready to sign | Document info + "Confirmar Assinatura" button |
| Waiting for Privy | Spinner + "Processando assinatura..." |
| Signature success | Green check + "Documento assinado com sucesso!" |
| Privy cancelled | Yellow warning + "Assinatura cancelada" + retry |
| Invalid signature | Red error + "Assinatura invalida" + retry |
| Expired request | Red error + "Solicitacao expirada" (no retry) |
| Network error | Red error + "Erro de conexao" + retry |

---

## TanStack Query Integration (Signatures)

### Query Key Factory

```typescript
export const signatureKeys = {
  all: ['signatures'] as const,
  status: (companyId: string, documentId: string) =>
    [...signatureKeys.all, 'status', companyId, documentId] as const,
  verify: (companyId: string, documentId: string) =>
    [...signatureKeys.all, 'verify', companyId, documentId] as const,
};
```

### Hooks

```typescript
export function useSignatureStatus(companyId: string, documentId: string) {
  return useQuery({
    queryKey: signatureKeys.status(companyId, documentId),
    queryFn: () =>
      api.get(
        `/api/v1/companies/${companyId}/documents/${documentId}/signers`,
      ),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll while signatures are being collected
      if (data?.pending > 0 && data?.signed < data?.totalSigners) return 10_000;
      return false;
    },
  });
}

export function useRequestSignatures(companyId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (signers: { userId: string; role: string }[]) =>
      api.post(
        `/api/v1/companies/${companyId}/documents/${documentId}/signers`,
        { signers },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: signatureKeys.status(companyId, documentId),
      });
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail(companyId, documentId),
      });
    },
  });
}

export function useSignDocument(
  companyId: string,
  documentId: string,
  signerId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { signature: string; timestamp: number }) =>
      api.post(
        `/api/v1/companies/${companyId}/documents/${documentId}/signers/${signerId}/sign`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: signatureKeys.status(companyId, documentId),
      });
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail(companyId, documentId),
      });
    },
  });
}

export function useDeclineSignature(
  companyId: string,
  documentId: string,
  signerId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) =>
      api.post(
        `/api/v1/companies/${companyId}/documents/${documentId}/signers/${signerId}/decline`,
        { reason },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: signatureKeys.status(companyId, documentId),
      });
    },
  });
}

export function useResendSignatureRequest(
  companyId: string,
  documentId: string,
  signerId: string,
) {
  return useMutation({
    mutationFn: () =>
      api.post(
        `/api/v1/companies/${companyId}/documents/${documentId}/signers/${signerId}/resend`,
        {},
      ),
  });
}

export function useRemoveSigner(companyId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (signerId: string) =>
      api.delete(
        `/api/v1/companies/${companyId}/documents/${documentId}/signers/${signerId}`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: signatureKeys.status(companyId, documentId),
      });
    },
  });
}

export function useVerifySignatures(companyId: string, documentId: string) {
  return useQuery({
    queryKey: signatureKeys.verify(companyId, documentId),
    queryFn: () =>
      api.get(
        `/api/v1/companies/${companyId}/documents/${documentId}/verify`,
      ),
    enabled: false, // Only fetched on-demand
  });
}
```

---

## i18n Keys (Signatures)

| Key | PT-BR | EN |
|-----|-------|----|
| `signatures.title` | `Assinaturas` | `Signatures` |
| `signatures.request.title` | `Solicitar Assinaturas` | `Request Signatures` |
| `signatures.request.description` | `Selecione os membros que devem assinar este documento.` | `Select the members who need to sign this document.` |
| `signatures.request.selectMembers` | `Selecionar membros...` | `Select members...` |
| `signatures.request.role` | `Papel` | `Role` |
| `signatures.request.send` | `Enviar Solicitacoes de Assinatura` | `Send Signature Requests` |
| `signatures.request.sent` | `Solicitacoes enviadas` | `Requests sent` |
| `signatures.request.noWallet` | `Sem carteira digital` | `No digital wallet` |
| `signatures.progress.title` | `Assinaturas ({signed} de {total})` | `Signatures ({signed} of {total})` |
| `signatures.progress.noSigners` | `Nenhum signatario adicionado` | `No signers added` |
| `signatures.status.pending` | `Pendente` | `Pending` |
| `signatures.status.signed` | `Assinado` | `Signed` |
| `signatures.status.declined` | `Recusado` | `Declined` |
| `signatures.status.expired` | `Expirado` | `Expired` |
| `signatures.actions.resend` | `Reenviar email` | `Resend email` |
| `signatures.actions.remove` | `Remover` | `Remove` |
| `signatures.actions.removeConfirm` | `Tem certeza que deseja remover este signatario?` | `Are you sure you want to remove this signer?` |
| `signatures.sign.callout` | `Sua assinatura e necessaria` | `Your signature is required` |
| `signatures.sign.calloutDescription` | `Voce foi solicitado a assinar este documento como {role}.` | `You have been asked to sign this document as {role}.` |
| `signatures.sign.button` | `Assinar Documento` | `Sign Document` |
| `signatures.sign.decline` | `Recusar` | `Decline` |
| `signatures.sign.declineReason` | `Motivo da recusa (opcional)` | `Reason for declining (optional)` |
| `signatures.sign.declineConfirm` | `Confirmar Recusa` | `Confirm Decline` |
| `signatures.sign.declined` | `Assinatura recusada` | `Signature declined` |
| `signatures.modal.title` | `Assinar Documento` | `Sign Document` |
| `signatures.modal.signing` | `Voce esta assinando:` | `You are signing:` |
| `signatures.modal.role` | `Papel` | `Role` |
| `signatures.modal.agreement` | `Ao assinar, voce confirma que revisou o documento e concorda com seus termos.` | `By signing, you confirm that you have reviewed the document and agree to its terms.` |
| `signatures.modal.confirm` | `Confirmar Assinatura` | `Confirm Signature` |
| `signatures.modal.processing` | `Processando assinatura...` | `Processing signature...` |
| `signatures.modal.success` | `Documento assinado com sucesso!` | `Document signed successfully!` |
| `signatures.modal.cancelled` | `Assinatura cancelada` | `Signature cancelled` |
| `signatures.modal.invalid` | `Assinatura invalida. Tente novamente.` | `Invalid signature. Please try again.` |
| `signatures.modal.expired` | `Solicitacao de assinatura expirada. Solicite uma nova.` | `Signature request expired. Request a new one.` |
| `signatures.verify.title` | `Documento Verificado` | `Document Verified` |
| `signatures.verify.description` | `Todas as assinaturas foram verificadas criptograficamente.` | `All signatures have been cryptographically verified.` |
| `signatures.verify.hash` | `Hash do Documento` | `Document Hash` |
| `signatures.verify.blockchain` | `Blockchain` | `Blockchain` |
| `signatures.verify.verifiedAt` | `Verificado em` | `Verified at` |
| `signatures.verify.pending` | `Aguardando ancoragem na blockchain` | `Waiting for blockchain anchoring` |
| `signatures.verify.button` | `Verificar Novamente` | `Verify Again` |
| `signatures.role.shareholder` | `Acionista` | `Shareholder` |
| `signatures.role.director` | `Diretor(a)` | `Director` |
| `signatures.role.employee` | `Funcionario(a)` | `Employee` |
| `signatures.role.witness` | `Testemunha` | `Witness` |

---

## Frontend Success Criteria (Signatures)

- [ ] SignatureRequestSection allows admin to select company members and assign roles
- [ ] Members without wallets are shown with warning and cannot be selected
- [ ] Duplicate signer prevention (already-added members disabled in dropdown)
- [ ] SignatureProgressTracker displays correct counts and progress bar
- [ ] Progress bar polls every 10s while signatures are being collected
- [ ] SignerStatusBadge shows correct variant for PENDING/SIGNED/DECLINED
- [ ] Resend and remove actions work from signer dropdown menu (ADMIN only)
- [ ] SignDocumentButton appears only when current user is a PENDING signer
- [ ] SigningConfirmationModal abstracts Privy signing UX (no blockchain jargon)
- [ ] Privy `signTypedData()` is called with correct EIP-712 typed data
- [ ] All signing error states handled inline (invalid, expired, cancelled, network error)
- [ ] Decline flow includes optional reason textarea
- [ ] SignatureVerificationBadge shows green badge after FULLY_SIGNED + anchored
- [ ] Basescan link opens correct transaction URL
- [ ] Copy-to-clipboard works for document hash
- [ ] All user-facing strings use i18n keys (no hardcoded text)
- [ ] Date formatting uses Brazilian format (dd/MM/yyyy)
- [ ] Components follow design-system.md conventions

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [document-generation.md](./document-generation.md) | Document creation and PDF generation (prerequisite for signing) |
| [blockchain-integration.md](./blockchain-integration.md) | Document hash anchoring on-chain after all signatures collected |
| [authentication.md](./authentication.md) | Privy embedded wallets used for EIP-712 digital signatures |
| [company-management.md](./company-management.md) | Documents are scoped to a company |
| [company-membership.md](./company-membership.md) | Signers must be company members |
| [notifications.md](./notifications.md) | Email notifications for signature requests, reminders, and completion |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, error format, and URL conventions for signature endpoints |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: DOC_SIGNATURE_INVALID, DOC_ALREADY_SIGNED, DOC_ALL_SIGNATURES_COMPLETE, etc. |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: DOCUMENT_SIGNATURE_REQUESTED, DOCUMENT_SIGNED, DOCUMENT_FULLY_SIGNED, DOCUMENT_ANCHORED |
| [design-system.md](../.claude/rules/design-system.md) | Component styling, colors, typography, spacing |
