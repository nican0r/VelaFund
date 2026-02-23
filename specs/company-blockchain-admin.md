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
5. [Business Rules](#business-rules)
6. [Edge Cases & Error Handling](#edge-cases--error-handling)
7. [Security Considerations](#security-considerations)
8. [Technical Implementation](#technical-implementation)
9. [Success Criteria](#success-criteria)

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

## Related Specifications

*Cross-references to be completed in Phase 5 of the spec alignment project.*
