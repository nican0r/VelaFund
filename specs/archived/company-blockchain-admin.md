# Company Blockchain Administration Specification

**Topic of Concern**: Creator wallet as smart contract admin, OCP contract deployment, and on-chain ownership transfer

**One-Sentence Description**: The company creator's Privy embedded wallet serves as the sole OCP smart contract admin, with on-chain ownership transferring automatically when the platform ADMIN role changes to a new sole admin.

---

## Overview

When a user creates a company on Navia, their existing Privy embedded wallet (`User.walletAddress`) becomes the smart contract admin for that company's on-chain cap table (OCP contract). There is no separate AdminWallet entity or Privy server wallet. The link is:

```
Company -> CompanyMember (role: ADMIN, creator) -> User -> walletAddress
```

This wallet is the sole authority for minting/issuing shares on the OCP smart contract. The smart contract is deployed during the async company setup process (after successful CNPJ validation) with this wallet address as the owner.

**Key design decisions**:
- **No AdminWallet entity**: The existing `blockchain-integration.md` previously defined an `AdminWallet` entity (1:1 with Company, Privy server wallet). This is replaced by the architecture described here.
- **Creator-only control**: Only the company creator's wallet controls the smart contract. Other users with ADMIN role have full platform-level permissions but do NOT have on-chain control.
- **No multi-sig in MVP**: The on-chain owner is always a single wallet address.

**Related specifications**:
- `company-management.md` — Company entity, `createdById` field, lifecycle state machine
- `company-cnpj-validation.md` — CNPJ validation Bull job that triggers contract deployment
- `company-membership.md` — ADMIN role management that can trigger on-chain ownership transfer
- `blockchain-integration.md` — OCP smart contract interface, deployment, and transaction processing
- `authentication.md` — User entity with `walletAddress` field (Privy embedded wallet)

---

## Table of Contents

1. [Functional Requirements](#functional-requirements)
2. [Architecture](#architecture)
3. [Contract Deployment Flow](#contract-deployment-flow)
4. [Admin Transfer Flow](#admin-transfer-flow)
5. [API Endpoints](#api-endpoints)
6. [Error Codes](#error-codes)
7. [Permission Matrix](#permission-matrix)
8. [Business Rules](#business-rules)
9. [Edge Cases & Error Handling](#edge-cases--error-handling)
10. [Security Considerations](#security-considerations)
11. [Technical Implementation](#technical-implementation)
12. [Success Criteria](#success-criteria)
13. [Frontend Specification](#frontend-specification)

---

## Functional Requirements

### FR-1: Admin Wallet Linkage
- System MUST use the creating user's `User.walletAddress` as the smart contract admin
- System MUST NOT create a separate AdminWallet entity or Privy server wallet
- System MUST record the creator's user ID on the Company entity (`createdById`)
- System MUST deploy the OCP smart contract with the creator's wallet as the owner/minter
- System MUST validate that the creator has a non-null `walletAddress` before company creation
- Only the creator's wallet has on-chain control — other ADMINs are platform-level only

### FR-2: On-Chain Ownership Transfer
- When the sole ADMIN role is transferred to another user, the system MUST initiate an on-chain `transferOwnership()` transaction signed by the current owner's wallet
- The system MUST prompt the outgoing admin to sign the on-chain transfer before the role change completes
- The new admin's `User.walletAddress` becomes the new contract owner
- Audit log records both the platform role change and the on-chain ownership transfer

---

## Architecture

### Wallet-to-Contract Relationship

```
User (creator)
  |-- walletAddress: "0x742d35..."   (Privy embedded wallet)
  |
  +-- CompanyMember
  |     |-- role: ADMIN
  |     |-- status: ACTIVE
  |     +-- companyId: "comp_abc123"
  |
  +-- Company
        |-- createdById: user.id
        |-- contractAddress: "0xabc..."  (OCP contract, deployed with creator's wallet as owner)
```

### What Replaced AdminWallet

The `blockchain-integration.md` spec previously defined:
- An `AdminWallet` entity (1:1 with Company, Privy server wallet)
- A Privy server wallet created during company setup

**This is replaced by**:
- The user who creates the company has their existing embedded wallet designated as the smart contract admin
- The wallet address is accessed via: `Company.createdById` -> `User.walletAddress`
- On the smart contract, this wallet address is the owner/minter
- No AdminWallet table exists in the schema
- No Privy server wallet is created during company setup

---

## Contract Deployment Flow

Contract deployment is part of the async company setup, triggered after successful CNPJ validation (see `company-cnpj-validation.md`).

```
CNPJ validation succeeds
  |
  v
CnpjValidationProcessor (Bull job)
  |
  |-- blockchain.deployOcpContract({
  |     ownerAddress: creatorWalletAddress,
  |     companyId: companyId,
  |   })
  |
  v
OCP Contract deployed on Base Network
  |-- owner = creator's wallet address
  |-- contractAddress stored on Company entity
  |
  v
Company status: DRAFT -> ACTIVE
```

---

## Admin Transfer Flow

When the ADMIN role is transferred to another user (making the new user the sole ADMIN), the on-chain smart contract owner must also transfer.

```
PRECONDITION: User A is sole ADMIN (and on-chain owner). User B is being promoted to sole ADMIN.

1. Platform admin (User A) initiates role transfer to User B
2. System detects this will change the sole ADMIN
3. System initiates on-chain transferOwnership(newOwner) transaction
4. User A is prompted to sign the on-chain transfer via Privy
5. User A signs the transaction
6. Transaction submitted to Base Network
7. Transaction confirmed on-chain
8. Platform role change completes:
   - User B becomes ADMIN
   - User A's role changes to new role (or removed)
9. Audit log records:
   - Platform role change (before/after)
   - On-chain ownership transfer (tx hash, old owner, new owner)

POSTCONDITION: User B's wallet is the new on-chain owner. User B has ADMIN role.
```

**If User A refuses to sign**: The platform role change is blocked. User A must sign the on-chain transfer before the role change can complete.

**If User A is being removed**: The system prompts User A to sign the on-chain transfer before removal completes. If User A is uncooperative, this requires manual platform admin intervention.

---

## API Endpoints

### Get Blockchain Admin Status

```
GET /api/v1/companies/:companyId/blockchain/admin
```

Returns the blockchain admin status for a company, including the contract owner wallet and deployment status.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "contractAddress": "0xabc123...",
    "contractDeployed": true,
    "adminWalletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "adminUserId": "user-uuid",
    "adminName": "Joao Founder",
    "deployedAt": "2026-01-15T10:30:00.000Z",
    "network": "base",
    "chainId": 8453,
    "explorerContractUrl": "https://basescan.org/address/0xabc123...",
    "explorerWalletUrl": "https://basescan.org/address/0x742d35...",
    "transferInProgress": false
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `contractAddress` | string \| null | OCP contract address (null if not yet deployed) |
| `contractDeployed` | boolean | Whether the smart contract has been deployed |
| `adminWalletAddress` | string | Creator's Privy embedded wallet address |
| `adminUserId` | string | User ID of the contract admin (company creator) |
| `adminName` | string | Display name of the contract admin |
| `deployedAt` | ISO 8601 \| null | When the contract was deployed |
| `network` | string | "base" |
| `chainId` | number | 8453 (Base mainnet) |
| `explorerContractUrl` | string \| null | Basescan URL for the contract |
| `explorerWalletUrl` | string | Basescan URL for the admin wallet |
| `transferInProgress` | boolean | Whether an admin transfer is currently pending |

**Error Response** (404 — company not found):

```json
{
  "success": false,
  "error": {
    "code": "COMPANY_NOT_FOUND",
    "message": "Empresa nao encontrada",
    "messageKey": "errors.company.notFound"
  }
}
```

---

### Initiate Admin Transfer

```
POST /api/v1/companies/:companyId/blockchain/admin/transfer
```

Initiates the on-chain ownership transfer process. The current admin must sign the `transferOwnership()` transaction on the frontend via Privy.

**Request Body**:

```json
{
  "newAdminUserId": "uuid"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `newAdminUserId` | UUID | Yes | User ID of the new admin (must be a company member with a wallet) |

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "transferId": "uuid",
    "contractAddress": "0xabc123...",
    "currentOwner": "0x742d35...",
    "newOwner": "0xdef456...",
    "status": "PENDING_SIGNATURE",
    "typedData": {
      "domain": {
        "name": "NaviaOCPAdmin",
        "version": "1",
        "chainId": 8453,
        "verifyingContract": "0xabc123..."
      },
      "types": {
        "TransferOwnership": [
          { "name": "newOwner", "type": "address" },
          { "name": "nonce", "type": "uint256" },
          { "name": "deadline", "type": "uint256" }
        ]
      },
      "value": {
        "newOwner": "0xdef456...",
        "nonce": 1,
        "deadline": 1706400000
      }
    }
  }
}
```

The frontend uses the `typedData` to prompt the current admin to sign via Privy, then submits the signature via the next endpoint.

**Error Response** (422 — new admin has no wallet):

```json
{
  "success": false,
  "error": {
    "code": "CHAIN_NEW_ADMIN_NO_WALLET",
    "message": "O novo administrador nao possui carteira vinculada",
    "messageKey": "errors.chain.newAdminNoWallet"
  }
}
```

**Error Response** (422 — transfer already in progress):

```json
{
  "success": false,
  "error": {
    "code": "CHAIN_TRANSFER_IN_PROGRESS",
    "message": "Transferencia de propriedade ja esta em andamento",
    "messageKey": "errors.chain.transferInProgress"
  }
}
```

**Error Response** (422 — no contract deployed):

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

### Submit Signed Admin Transfer

```
POST /api/v1/companies/:companyId/blockchain/admin/transfer/:transferId/sign
```

Submits the EIP-712 signature from the current admin to execute the on-chain ownership transfer.

**Request Body**:

```json
{
  "signature": "0x1234567890abcdef..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `signature` | string | Yes | Hex-encoded EIP-712 signature from the current admin |

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "transferId": "uuid",
    "status": "SUBMITTED",
    "txHash": "0xabc123...",
    "message": "Transferencia enviada para a blockchain"
  }
}
```

**Error Response** (422 — invalid signature):

```json
{
  "success": false,
  "error": {
    "code": "CHAIN_TRANSFER_SIGNATURE_INVALID",
    "message": "Assinatura de transferencia invalida",
    "messageKey": "errors.chain.transferSignatureInvalid"
  }
}
```

---

### Get Admin Transfer Status

```
GET /api/v1/companies/:companyId/blockchain/admin/transfer/:transferId
```

Returns the current status of an admin transfer.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "transferId": "uuid",
    "currentOwner": "0x742d35...",
    "newOwner": "0xdef456...",
    "newAdminName": "Maria Co-founder",
    "status": "CONFIRMED",
    "txHash": "0xabc123...",
    "submittedAt": "2026-01-20T14:30:00.000Z",
    "confirmedAt": "2026-01-20T14:30:30.000Z"
  }
}
```

| Status Value | Description |
|-------------|-------------|
| `PENDING_SIGNATURE` | Waiting for current admin to sign |
| `SUBMITTED` | Transaction sent to Base Network |
| `CONFIRMED` | Ownership transferred on-chain |
| `FAILED` | On-chain transaction failed |
| `CANCELLED` | Transfer was cancelled |

---

### Retry Failed Admin Transfer

```
POST /api/v1/companies/:companyId/blockchain/admin/transfer/:transferId/retry
```

Retries a failed admin transfer transaction.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "transferId": "uuid",
    "status": "PENDING_SIGNATURE",
    "message": "Transferencia reiniciada, aguardando assinatura"
  }
}
```

**Error Response** (422 — transfer not in failed state):

```json
{
  "success": false,
  "error": {
    "code": "CHAIN_TRANSFER_NOT_FAILED",
    "message": "Transferencia nao esta em estado de falha",
    "messageKey": "errors.chain.transferNotFailed"
  }
}
```

---

## Error Codes

| Code | HTTP Status | messageKey | Description |
|------|-------------|-----------|-------------|
| `CHAIN_CONTRACT_NOT_DEPLOYED` | 422 | `errors.chain.contractNotDeployed` | Company has no deployed OCP smart contract |
| `CHAIN_NEW_ADMIN_NO_WALLET` | 422 | `errors.chain.newAdminNoWallet` | New admin user has no Privy embedded wallet |
| `CHAIN_TRANSFER_IN_PROGRESS` | 422 | `errors.chain.transferInProgress` | An ownership transfer is already pending |
| `CHAIN_TRANSFER_SIGNATURE_INVALID` | 422 | `errors.chain.transferSignatureInvalid` | EIP-712 signature verification failed |
| `CHAIN_TRANSFER_NOT_FAILED` | 422 | `errors.chain.transferNotFailed` | Cannot retry a transfer that is not in FAILED state |
| `CHAIN_TRANSFER_FAILED` | 422 | `errors.chain.transferFailed` | On-chain ownership transfer reverted |
| `AUTH_NO_WALLET` | 422 | `errors.auth.noWallet` | User has no Privy embedded wallet (blocks company creation) |

---

## Permission Matrix

| Action | ADMIN (creator) | ADMIN (non-creator) | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|----------------|---------------------|---------|-------|----------|----------|
| View admin status | Yes | Yes | Yes | Yes | No | No |
| Initiate admin transfer | Yes (only creator can initiate) | No | No | No | No | No |
| Sign admin transfer | Yes (only current on-chain owner) | No | No | No | No | No |
| View transfer status | Yes | Yes | No | No | No | No |
| Retry failed transfer | Yes (only creator) | No | No | No | No | No |

---

## Business Rules

### BR-1: Creator Wallet as Smart Contract Admin
- The creator's `User.walletAddress` is used as the OCP smart contract owner
- System MUST verify the creator has a non-null wallet address before company creation
- The smart contract owner is set during contract deployment (part of async setup)
- Only the creator's wallet controls the contract — other ADMINs have platform-level admin only

### BR-2: On-Chain Ownership Transfer on ADMIN Change
- When ADMIN role is transferred, on-chain ownership MUST also transfer
- This is triggered automatically when the platform ADMIN role changes (if the new admin is the sole ADMIN)
- The original creator must sign the on-chain transfer — system prompts them when role changes
- Only one wallet address controls the contract at a time (no multi-sig in MVP)
- If the creator is removed without transferring on-chain ownership, the system MUST prompt them to sign the transfer before removal completes

### BR-3: Single On-Chain Owner (No Multi-Sig in MVP)
- Only the company creator's wallet controls the smart contract
- Other users with ADMIN role have full platform-level permissions but do NOT have on-chain smart contract control
- The on-chain owner is always a single wallet address
- If the creator transfers the ADMIN role, the new admin's wallet becomes the sole on-chain owner

---

## Edge Cases & Error Handling

### EC-1: Smart Contract Deployment Fails
**Scenario**: OCP contract deployment fails after CNPJ validation succeeds.
**Handling**:
- Bull job retries contract deployment up to 3 times
- After 3 failures, company remains in DRAFT with CNPJ validated but contract pending
- Admin is notified: "Company verification succeeded but contract deployment failed. Our team is investigating."
- Platform admin is also alerted for manual intervention

### EC-2: Creator Wallet Address Is Null
**Scenario**: User tries to create a company but has no embedded wallet.
**Handling**:
- Backend validates `User.walletAddress` is not null before company creation
- Returns `422 Unprocessable Entity` with error code `AUTH_NO_WALLET`
- Frontend should guide user to complete wallet setup via Privy before creating a company

### EC-3: On-Chain Transfer Fails During Admin Role Change
**Scenario**: The `transferOwnership()` transaction fails on-chain.
**Handling**:
- Platform role change is rolled back — original admin retains ADMIN role
- Error is logged and admin is notified
- Admin can retry the transfer from the settings page

### EC-4: Outgoing Admin Refuses to Sign On-Chain Transfer
**Scenario**: The current on-chain owner is uncooperative and refuses to sign the ownership transfer.
**Handling**:
- Platform role change cannot complete without the on-chain signature
- Requires manual platform admin intervention
- In extreme cases, the company may need to deploy a new contract (admin escalation path)

---

## Security Considerations

### SEC-1: Smart Contract Admin Security
- The creator's wallet address determines initial smart contract control
- When ADMIN role is transferred, the on-chain owner MUST also transfer via `transferOwnership()`
- The original creator must sign the on-chain transfer — system prompts them when role changes
- Only one wallet address controls the contract at a time (no multi-sig in MVP)
- If the creator is removed without transferring on-chain ownership, the system MUST prompt them to sign the transfer before removal completes

### SEC-2: Wallet Validation
- System MUST verify wallet address format before using it for contract deployment
- System MUST confirm wallet is accessible via Privy before initiating on-chain transactions

---

## Technical Implementation

### Company Creation — Wallet Validation

```typescript
// Excerpt from CompanyService.create()
async create(userId: string, dto: CreateCompanyDto) {
  // Validate user has wallet address
  const user = await this.prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });
  if (!user.walletAddress) {
    throw new ForbiddenException('User must have a wallet address to create a company');
  }

  // ... create company ...

  // Dispatch async setup job with creator's wallet
  await this.companySetupQueue.add('validate-cnpj', {
    companyId: company.id,
    cnpj: dto.cnpj,
    creatorWalletAddress: user.walletAddress,
  });

  return company;
}
```

### Contract Deployment (within Bull Job)

```typescript
// Excerpt from CnpjValidationProcessor
// Step 3: Deploy OCP smart contract with creator's wallet as owner
const contractAddress = await this.blockchain.deployOcpContract({
  ownerAddress: creatorWalletAddress,
  companyId: companyId,
});

// Step 4: Store contract address and activate company
await this.prisma.company.update({
  where: { id: companyId },
  data: {
    contractAddress,
    status: 'ACTIVE',
  },
});
```

### On-Chain Ownership Transfer

```typescript
// Triggered when ADMIN role is transferred to a new sole ADMIN
async transferOnChainOwnership(
  companyId: string,
  currentOwnerId: string,
  newOwnerId: string,
) {
  const company = await this.prisma.company.findUniqueOrThrow({
    where: { id: companyId },
  });
  const newOwner = await this.prisma.user.findUniqueOrThrow({
    where: { id: newOwnerId },
  });

  if (!company.contractAddress) {
    throw new Error('Company has no deployed contract');
  }
  if (!newOwner.walletAddress) {
    throw new Error('New owner has no wallet address');
  }

  // Initiate on-chain transferOwnership()
  // The current owner must sign this transaction via Privy
  const txHash = await this.blockchain.transferOwnership({
    contractAddress: company.contractAddress,
    newOwnerAddress: newOwner.walletAddress,
    signerId: currentOwnerId, // Privy will prompt this user to sign
  });

  // Audit log the on-chain transfer
  await this.auditService.log({
    actorId: currentOwnerId,
    actorType: 'USER',
    action: 'BLOCKCHAIN_TX_SUBMITTED',
    resourceType: 'Company',
    resourceId: companyId,
    companyId,
    changes: {
      before: { contractOwner: company.createdById },
      after: { contractOwner: newOwnerId },
    },
    metadata: { txHash, source: 'admin-transfer' },
  });

  return txHash;
}
```

---

## Success Criteria

### Performance
- Smart contract deployment: < 30 seconds
- On-chain ownership transfer: < 30 seconds

### Accuracy
- Contract owner always matches the platform's sole ADMIN wallet
- On-chain ownership transfer succeeds atomically with platform role change

### Security
- No company can be created without a valid wallet address
- On-chain ownership cannot be transferred without the current owner's signature

---

## Dependencies

### Internal Dependencies
- **company-management.md**: Company entity with `createdById` and `contractAddress` fields
- **company-cnpj-validation.md**: Bull job that triggers contract deployment after CNPJ validation
- **company-membership.md**: ADMIN role changes that trigger on-chain ownership transfer
- **blockchain-integration.md**: OCP smart contract interface, `deployOcpContract()`, `transferOwnership()`
- **authentication.md**: User entity with `walletAddress` field (Privy embedded wallet)
- **audit-logging.md**: Audit events for blockchain transactions

### External Dependencies
- **Base Network**: OCP smart contract deployment and ownership transfer
  - Deployed via Privy-signed transactions
  - Gas sponsored by Privy
- **Privy**: Embedded wallet management and transaction signing

---

# Frontend Specification

---

## Table of Contents (Frontend)

1. [Frontend Architecture (Blockchain Admin)](#frontend-architecture-blockchain-admin)
2. [Page Routes (Blockchain Admin)](#page-routes-blockchain-admin)
3. [Component Hierarchy (Blockchain Admin)](#component-hierarchy-blockchain-admin)
4. [Component Specifications (Blockchain Admin)](#component-specifications-blockchain-admin)
5. [Frontend User Flows (Blockchain Admin)](#frontend-user-flows-blockchain-admin)
6. [UI States and Error Handling (Blockchain Admin)](#ui-states-and-error-handling-blockchain-admin)
7. [TanStack Query Integration (Blockchain Admin)](#tanstack-query-integration-blockchain-admin)
8. [i18n Keys (Blockchain Admin)](#i18n-keys-blockchain-admin)
9. [Frontend Success Criteria (Blockchain Admin)](#frontend-success-criteria-blockchain-admin)

---

## Frontend Architecture (Blockchain Admin)

### MVP Scope

The blockchain admin frontend lives inside the Company Settings page as a dedicated tab: **"Blockchain"**. It shows:

1. **Contract deployment status** — Whether the OCP smart contract is deployed, and its address.
2. **Admin wallet display** — Which wallet controls the contract (company creator).
3. **Admin transfer flow** — A guided modal for transferring on-chain ownership when the ADMIN role changes.

The blockchain admin tab is only visible to users with ADMIN or LEGAL roles.

### State Management

Uses TanStack Query for all data fetching. The admin transfer flow uses a multi-step modal with local component state (`useState`) for the current step.

---

## Page Routes (Blockchain Admin)

| Route | Layout | Auth | Description |
|-------|--------|------|-------------|
| `/dashboard/settings` (Blockchain tab) | Dashboard shell | Yes + ADMIN or LEGAL | Blockchain admin info as a settings tab |

The blockchain admin info is rendered when the user selects the "Blockchain" tab in the settings page.

---

## Component Hierarchy (Blockchain Admin)

```
app/(dashboard)/settings/page.tsx ─→ CompanySettingsPage
  ├─ SettingsTabs (vertical tab navigation)
  │    ├─ CompanyInfoForm (tab: "Informacoes")
  │    ├─ MembersTabLink (tab: "Membros")
  │    ├─ BlockchainAdminTab (tab: "Blockchain")    ← NEW
  │    ├─ NotificationsTab (tab: "Notificacoes")
  │    └─ DangerZone (tab: "Zona de Perigo")
  │
  └─ BlockchainAdminTab
       ├─ ContractStatusCard
       ├─ AdminWalletCard
       └─ AdminTransferSection
            └─ (click "Transferir Propriedade") → AdminTransferModal
                 ├─ Step 1: SelectNewAdminStep
                 ├─ Step 2: SignTransferStep
                 └─ Step 3: TransferConfirmationStep
```

### Component Registry

| Component | File | Description |
|-----------|------|-------------|
| `BlockchainAdminTab` | `components/settings/blockchain-admin-tab.tsx` | Main blockchain admin settings tab content |
| `ContractStatusCard` | `components/settings/contract-status-card.tsx` | Contract deployment status display |
| `AdminWalletCard` | `components/settings/admin-wallet-card.tsx` | Admin wallet info display |
| `AdminTransferSection` | `components/settings/admin-transfer-section.tsx` | Transfer initiation area (ADMIN only) |
| `AdminTransferModal` | `components/settings/admin-transfer-modal.tsx` | Multi-step ownership transfer modal |

---

## Component Specifications (Blockchain Admin)

### 1. BlockchainAdminTab

**File**: `components/settings/blockchain-admin-tab.tsx`

**Props**:
```typescript
interface BlockchainAdminTabProps {
  companyId: string;
}
```

**Visual Structure**:
```
+--------------------------------------------------+
|                                                  |
|  Blockchain                                      |  ← h2, navy-900
|  Informacoes do contrato inteligente e           |  ← body-sm, gray-500
|  administrador on-chain                          |
|                                                  |
|  +--------------------------------------------+ |
|  |  Contrato Inteligente                       | |  ← ContractStatusCard
|  |                                             | |
|  |  Status     ● Implantado                    | |  ← green badge
|  |  Endereco   0xabc123...def456  [Copiar] [↗] | |
|  |  Rede       Base (Chain ID: 8453)           | |
|  |  Implantado 15/01/2026 10:30                | |
|  +--------------------------------------------+ |
|                                                  |
|  +--------------------------------------------+ |
|  |  Administrador On-Chain                     | |  ← AdminWalletCard
|  |                                             | |
|  |  Nome        Joao Founder                   | |
|  |  Carteira    0x742d35...f0bEb  [Copiar] [↗] | |
|  |                                             | |
|  |  ℹ️ O administrador on-chain e o criador   | |  ← info callout, blue-50 bg
|  |    da empresa. Somente esta carteira pode   | |
|  |    emitir acoes no contrato inteligente.    | |
|  +--------------------------------------------+ |
|                                                  |
|  +--------------------------------------------+ |
|  |  Transferir Propriedade                     | |  ← AdminTransferSection (ADMIN only)
|  |                                             | |
|  |  Transfira o controle do contrato           | |
|  |  inteligente para outro administrador.      | |
|  |                                             | |
|  |  [Transferir Propriedade]                   | |  ← Destructive button variant
|  +--------------------------------------------+ |
|                                                  |
+--------------------------------------------------+
```

**Behavior**:
1. On mount: fetches `GET /api/v1/companies/:companyId/blockchain/admin`.
2. If `contractDeployed` is false: ContractStatusCard shows "Pendente" with yellow badge and message "O contrato sera implantado automaticamente apos a validacao do CNPJ."
3. AdminTransferSection is only visible if the current user is the company creator (on-chain owner).

---

### 2. AdminTransferModal

**File**: `components/settings/admin-transfer-modal.tsx`

**Props**:
```typescript
interface AdminTransferModalProps {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferComplete: () => void;
}
```

**3-Step Flow** (uses shadcn/ui Dialog with step indicator):

**Step 1 — Select New Admin**:
```
+--------------------------------------------------+
|  Transferir Propriedade              Step 1/3 [X] |
+--------------------------------------------------+
|                                                  |
|  Selecione o novo administrador on-chain         |
|                                                  |
|  +--------------------------------------------+ |
|  | Selecionar membro...                    [v] | |  ← Select dropdown
|  +--------------------------------------------+ |
|                                                  |
|  Members list shows name + role + wallet status  |
|  Members without wallets are disabled with       |
|  tooltip "Membro nao possui carteira"            |
|                                                  |
|  ⚠ Esta acao transferira o controle do contrato | |  ← Warning callout, cream-100 bg
|    inteligente. Voce perdera a capacidade de     |
|    emitir acoes diretamente on-chain.            |
|                                                  |
+--------------------------------------------------+
|  [Cancelar]                          [Continuar]  |
+--------------------------------------------------+
```

**Step 2 — Sign Transfer** (abstracted UX):
```
+--------------------------------------------------+
|  Transferir Propriedade              Step 2/3 [X] |
+--------------------------------------------------+
|                                                  |
|  Confirme a transferencia                        |
|                                                  |
|  De:    Joao Founder (0x742d...f0bEb)            |
|  Para:  Maria Co-founder (0xdef4...5678)         |
|                                                  |
|  Para confirmar, assine a transferencia com      |
|  sua carteira digital.                           |
|                                                  |
|  +--------------------------------------------+ |
|  |       [🔒 Assinar Transferencia]            | |  ← Primary button, lock icon
|  +--------------------------------------------+ |
|                                                  |
|  (Signing state: spinner + "Aguardando          |
|   assinatura...")                                |
|                                                  |
+--------------------------------------------------+
|  [Voltar]                                        |
+--------------------------------------------------+
```

**Step 3 — Confirmation**:
```
+--------------------------------------------------+
|  Transferir Propriedade              Step 3/3     |
+--------------------------------------------------+
|                                                  |
|  ✓ Transferencia confirmada!                     |  ← green check icon
|                                                  |
|  A propriedade do contrato inteligente foi       |
|  transferida para Maria Co-founder.              |
|                                                  |
|  Hash: 0xabc123...  [Ver no Basescan ↗]         |
|                                                  |
+--------------------------------------------------+
|                                         [Fechar]  |
+--------------------------------------------------+
```

**Behavior**:
1. **Step 1**: Fetches company members. Dropdown shows members with ADMIN role and a valid `walletAddress`. Members without wallets are disabled.
2. On "Continuar": calls `POST /api/v1/companies/:companyId/blockchain/admin/transfer` with `newAdminUserId`. Receives `typedData` for signing.
3. **Step 2**: On "Assinar Transferencia": uses Privy SDK `signTypedData()` to prompt the user's wallet signature. The UX is abstracted — user sees "Assinar Transferencia" not "Sign EIP-712 typed data".
4. After signing: calls `POST .../transfer/:transferId/sign` with the signature.
5. On success (200): advances to Step 3, polls transfer status.
6. **Step 3**: Shows confirmation with tx hash and Basescan link. "Fechar" dismisses modal and refreshes admin status.
7. On any error: shows inline error message in the modal, allows retry.

---

## Frontend User Flows (Blockchain Admin)

### Flow: View Blockchain Admin Info

```
ADMIN navigates to Settings → Blockchain tab
  │
  ├─ [contract deployed] ─→ Shows ContractStatusCard (green "Implantado" badge)
  │     │
  │     └─ Shows AdminWalletCard with creator info
  │
  ├─ [contract not deployed] ─→ Shows "Pendente" with info message
  │
  └─ [user is creator] ─→ Shows AdminTransferSection with transfer button
```

### Flow: Transfer On-Chain Ownership

```
ADMIN (creator) clicks "Transferir Propriedade"
  │
  ├─ Step 1: Select new admin from dropdown
  │     │
  │     ├─ [member has wallet] ─→ Selectable
  │     └─ [member has no wallet] ─→ Disabled with tooltip
  │
  ├─ "Continuar" ─→ POST /transfer (initiate)
  │     │
  │     ├─ [422 no wallet] ─→ Inline error
  │     ├─ [422 transfer in progress] ─→ Inline error
  │     └─ [200 success] ─→ Receives typedData, advance to Step 2
  │
  ├─ Step 2: "Assinar Transferencia" ─→ Privy signTypedData()
  │     │
  │     ├─ [user signs] ─→ POST /transfer/:id/sign
  │     │     │
  │     │     ├─ [200 success] ─→ Advance to Step 3
  │     │     └─ [422 invalid sig] ─→ Inline error, allow retry
  │     │
  │     └─ [user cancels/rejects] ─→ Inline message "Assinatura cancelada"
  │
  └─ Step 3: Confirmation shown with tx hash
        │
        └─ "Fechar" ─→ Modal closes, admin status refetched
```

---

## UI States and Error Handling (Blockchain Admin)

### BlockchainAdminTab States

| State | Visual |
|-------|--------|
| Loading | Skeleton cards for contract and admin sections |
| Contract deployed | Green badge "Implantado", full details shown |
| Contract not deployed | Yellow badge "Pendente", info callout about CNPJ validation |
| No access (not ADMIN/LEGAL) | Tab not visible in settings sidebar |

### AdminTransferModal Error States

| Error | Handling |
|-------|----------|
| New admin has no wallet | Inline error below select, prevent proceeding |
| Transfer already in progress | Inline error, modal shows current transfer status |
| Privy signature rejected | Inline message "Assinatura cancelada pelo usuario" |
| Invalid signature (422) | Inline error, "Tentar novamente" button |
| On-chain tx failed | Step shows error with "Tentar novamente" button |
| Network error | Error toast, allow retry |

---

## TanStack Query Integration (Blockchain Admin)

### Query Key Factory

```typescript
export const blockchainAdminKeys = {
  all: ['blockchainAdmin'] as const,
  status: (companyId: string) =>
    [...blockchainAdminKeys.all, 'status', companyId] as const,
  transfer: (companyId: string, transferId: string) =>
    [...blockchainAdminKeys.all, 'transfer', companyId, transferId] as const,
};
```

### Hooks

```typescript
export function useBlockchainAdminStatus(companyId: string) {
  return useQuery({
    queryKey: blockchainAdminKeys.status(companyId),
    queryFn: () => api.get(`/api/v1/companies/${companyId}/blockchain/admin`),
  });
}

export function useInitiateAdminTransfer(companyId: string) {
  return useMutation({
    mutationFn: (newAdminUserId: string) =>
      api.post(`/api/v1/companies/${companyId}/blockchain/admin/transfer`, {
        newAdminUserId,
      }),
  });
}

export function useSubmitTransferSignature(
  companyId: string,
  transferId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (signature: string) =>
      api.post(
        `/api/v1/companies/${companyId}/blockchain/admin/transfer/${transferId}/sign`,
        { signature },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: blockchainAdminKeys.status(companyId),
      });
    },
  });
}

export function useAdminTransferStatus(
  companyId: string,
  transferId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: blockchainAdminKeys.transfer(companyId, transferId),
    queryFn: () =>
      api.get(
        `/api/v1/companies/${companyId}/blockchain/admin/transfer/${transferId}`,
      ),
    enabled: options?.enabled ?? true,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'SUBMITTED') return 5_000;
      return false;
    },
  });
}
```

---

## i18n Keys (Blockchain Admin)

| Key | PT-BR | EN |
|-----|-------|----|
| `settings.blockchain.title` | `Blockchain` | `Blockchain` |
| `settings.blockchain.description` | `Informacoes do contrato inteligente e administrador on-chain` | `Smart contract and on-chain admin information` |
| `settings.blockchain.contract.title` | `Contrato Inteligente` | `Smart Contract` |
| `settings.blockchain.contract.status` | `Status` | `Status` |
| `settings.blockchain.contract.deployed` | `Implantado` | `Deployed` |
| `settings.blockchain.contract.pending` | `Pendente` | `Pending` |
| `settings.blockchain.contract.pendingInfo` | `O contrato sera implantado automaticamente apos a validacao do CNPJ.` | `The contract will be deployed automatically after CNPJ validation.` |
| `settings.blockchain.contract.address` | `Endereco` | `Address` |
| `settings.blockchain.contract.network` | `Rede` | `Network` |
| `settings.blockchain.contract.deployedAt` | `Implantado em` | `Deployed at` |
| `settings.blockchain.admin.title` | `Administrador On-Chain` | `On-Chain Admin` |
| `settings.blockchain.admin.name` | `Nome` | `Name` |
| `settings.blockchain.admin.wallet` | `Carteira` | `Wallet` |
| `settings.blockchain.admin.info` | `O administrador on-chain e o criador da empresa. Somente esta carteira pode emitir acoes no contrato inteligente.` | `The on-chain admin is the company creator. Only this wallet can issue shares on the smart contract.` |
| `settings.blockchain.transfer.title` | `Transferir Propriedade` | `Transfer Ownership` |
| `settings.blockchain.transfer.description` | `Transfira o controle do contrato inteligente para outro administrador.` | `Transfer smart contract control to another admin.` |
| `settings.blockchain.transfer.button` | `Transferir Propriedade` | `Transfer Ownership` |
| `settings.blockchain.transfer.selectAdmin` | `Selecione o novo administrador on-chain` | `Select the new on-chain admin` |
| `settings.blockchain.transfer.selectPlaceholder` | `Selecionar membro...` | `Select member...` |
| `settings.blockchain.transfer.noWallet` | `Membro nao possui carteira` | `Member has no wallet` |
| `settings.blockchain.transfer.warning` | `Esta acao transferira o controle do contrato inteligente. Voce perdera a capacidade de emitir acoes diretamente on-chain.` | `This action will transfer smart contract control. You will lose the ability to issue shares directly on-chain.` |
| `settings.blockchain.transfer.confirm` | `Confirme a transferencia` | `Confirm the transfer` |
| `settings.blockchain.transfer.from` | `De` | `From` |
| `settings.blockchain.transfer.to` | `Para` | `To` |
| `settings.blockchain.transfer.signPrompt` | `Para confirmar, assine a transferencia com sua carteira digital.` | `To confirm, sign the transfer with your digital wallet.` |
| `settings.blockchain.transfer.signButton` | `Assinar Transferencia` | `Sign Transfer` |
| `settings.blockchain.transfer.signing` | `Aguardando assinatura...` | `Waiting for signature...` |
| `settings.blockchain.transfer.success` | `Transferencia confirmada!` | `Transfer confirmed!` |
| `settings.blockchain.transfer.successDetail` | `A propriedade do contrato inteligente foi transferida para {name}.` | `Smart contract ownership has been transferred to {name}.` |
| `settings.blockchain.transfer.cancelled` | `Assinatura cancelada pelo usuario` | `Signature cancelled by user` |

---

## Frontend Success Criteria (Blockchain Admin)

- [ ] BlockchainAdminTab renders as a tab in Company Settings
- [ ] Tab only visible to ADMIN and LEGAL roles
- [ ] ContractStatusCard shows correct deployed/pending state
- [ ] AdminWalletCard displays creator name and truncated wallet address
- [ ] Copy-to-clipboard works for contract and wallet addresses
- [ ] Basescan links open correct URLs in new tabs
- [ ] AdminTransferSection visible only to company creator
- [ ] AdminTransferModal implements 3-step flow (select → sign → confirm)
- [ ] Select dropdown correctly disables members without wallets
- [ ] Privy signTypedData() is called with abstracted UX ("Assinar Transferencia")
- [ ] Transfer status polls every 5s while SUBMITTED
- [ ] All error states handled with inline messages (no full-page errors)
- [ ] All user-facing strings use i18n keys
- [ ] Date/number formatting uses Brazilian format
- [ ] Components follow design-system.md conventions

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [blockchain-integration.md](./blockchain-integration.md) | OCP smart contract interface, transaction processing, sync status |
| [company-management.md](./company-management.md) | Company entity with `createdById`, `contractAddress`, `adminWalletAddress` |
| [company-membership.md](./company-membership.md) | ADMIN role changes that trigger on-chain ownership transfer |
| [authentication.md](./authentication.md) | User entity with `walletAddress` (Privy embedded wallet) |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, error format, URL conventions |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: CHAIN_*, AUTH_NO_WALLET |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: BLOCKCHAIN_TX_SUBMITTED, BLOCKCHAIN_TX_CONFIRMED |
| [design-system.md](../.claude/rules/design-system.md) | Component styling, colors, typography, spacing |
