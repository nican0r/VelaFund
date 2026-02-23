# Company CNPJ Validation Specification

**Topic of Concern**: Asynchronous CNPJ validation via Verifik and Bull job processing during company setup

**One-Sentence Description**: The system validates a company's CNPJ against Receita Federal via the Verifik API as an asynchronous Bull job during company creation, caching the returned corporate data and transitioning the company from DRAFT to ACTIVE on success.

---

## Overview

When a company is created on Navia, the provided CNPJ (Cadastro Nacional da Pessoa Juridica) must be validated against Brazil's Receita Federal to confirm the entity is active (`ATIVA`). This validation runs asynchronously via a Bull background job so the user receives an immediate response (company created in `DRAFT` status) while the verification proceeds in the background.

CNPJ validation during company creation is the **canonical company-level verification** path. The `kyc-verification.md` spec references this spec for CNPJ validation rather than defining its own duplicate flow. A validated CNPJ satisfies both the company setup requirement and the admin's company-level KYC requirement.

**Related specifications**:
- `company-management.md` — Company entity, lifecycle state machine (DRAFT -> ACTIVE)
- `company-blockchain-admin.md` — OCP smart contract deployment that follows successful CNPJ validation
- `kyc-verification.md` — References this spec for company-level CNPJ verification (no duplicate flow)
- `error-handling.md` — Retry strategies for Verifik API

---

## Table of Contents

1. [Functional Requirements](#functional-requirements)
2. [CNPJ Validation Flow](#cnpj-validation-flow)
3. [API Endpoints](#api-endpoints)
4. [Technical Implementation](#technical-implementation)
5. [Business Rules](#business-rules)
6. [Edge Cases & Error Handling](#edge-cases--error-handling)
7. [Security Considerations](#security-considerations)
8. [Success Criteria](#success-criteria)

---

## Functional Requirements

### FR-1: Async Company Setup via Bull Job
- System MUST dispatch a Bull job for CNPJ validation upon company creation
- Bull job MUST call Verifik CNPJ validation API
- On Verifik success (CNPJ is ATIVA in Receita Federal), job MUST:
  - Store the validated company data (razao social, endereco, CNAE, etc.)
  - Set `cnpjValidatedAt` timestamp
  - Deploy the OCP smart contract with the creator's wallet address as owner (see `company-blockchain-admin.md`)
  - Transition company status from `DRAFT` to `ACTIVE`
- On Verifik failure, job MUST:
  - Record the failure reason
  - Notify the admin via email
  - Company remains in `DRAFT` (admin can update CNPJ and retry)
- Bull job MUST retry on transient errors (network timeout, Verifik unavailable) up to 3 times with exponential backoff

### FR-2: CNPJ Format and Uniqueness Validation
- System MUST require a valid CNPJ on creation (format: XX.XXX.XXX/XXXX-XX)
- System MUST validate CNPJ format client-side before submission
- CNPJ MUST be unique across all companies on the platform (including DISSOLVED companies)

---

## CNPJ Validation Flow

```
PRECONDITION: User submits company creation form with CNPJ

1. Frontend validates CNPJ format (client-side check digits)
2. Frontend sends POST /api/v1/companies
3. Backend validates:
   - CNPJ format is valid
   - CNPJ is not already registered
4. Backend creates Company (status: DRAFT)
5. Backend dispatches Bull job: CnpjValidationJob
6. Backend returns company with status DRAFT
7. Frontend redirects to company dashboard with setup progress indicator
8. Frontend polls GET /api/v1/companies/:id/setup-status every 3 seconds

--- Bull Job: CnpjValidationJob ---
9. Job calls Verifik CNPJ API
10. Verifik returns company data from Receita Federal
11. If CNPJ is ATIVA:
    a. Job stores cnpjData on Company
    b. Job sets cnpjValidatedAt
    c. Job deploys OCP smart contract with creator's wallet as owner
    d. Job stores contractAddress on Company
    e. Job transitions Company status: DRAFT -> ACTIVE
    f. Job sends "Company Active" notification email to creator
12. If CNPJ is NOT ATIVA:
    a. Job records failure reason
    b. Job sends "CNPJ Validation Failed" notification email
    c. Company remains in DRAFT
--- End Bull Job ---

13. Frontend detects status change via polling
14. Frontend shows "Company created successfully!" with contract address

POSTCONDITION: Company is ACTIVE, smart contract deployed, creator is ADMIN
```

---

## API Endpoints

### GET /api/v1/companies/:id/setup-status
**Description**: Poll the async CNPJ validation and contract deployment progress. Used by the frontend to show real-time setup progress for DRAFT companies.

**Auth**: Required. User must be a member of the company.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "companyId": "comp_abc123",
    "status": "DRAFT",
    "steps": [
      {
        "step": "CNPJ_VALIDATION",
        "status": "COMPLETED",
        "completedAt": "2026-02-23T10:00:15Z",
        "details": {
          "razaoSocial": "ACME TECNOLOGIA LTDA",
          "situacaoCadastral": "ATIVA"
        }
      },
      {
        "step": "CONTRACT_DEPLOYMENT",
        "status": "IN_PROGRESS",
        "details": {
          "transactionHash": "0xabc...",
          "walletAddress": "0x742d35..."
        }
      }
    ],
    "overallProgress": 50,
    "estimatedCompletionSeconds": 15
  }
}
```

**Step statuses**: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`

**Failure response** (200 OK — CNPJ validation failed):
```json
{
  "success": true,
  "data": {
    "companyId": "comp_abc123",
    "status": "DRAFT",
    "steps": [
      {
        "step": "CNPJ_VALIDATION",
        "status": "FAILED",
        "failedAt": "2026-02-23T10:00:20Z",
        "error": {
          "code": "COMPANY_CNPJ_INACTIVE",
          "message": "CNPJ 12.345.678/0001-90 has status BAIXADA in Receita Federal"
        }
      },
      {
        "step": "CONTRACT_DEPLOYMENT",
        "status": "PENDING"
      }
    ],
    "overallProgress": 0,
    "canRetry": true,
    "retryAction": "Update CNPJ via PUT /api/v1/companies/:id and retry"
  }
}
```

---

## Technical Implementation

### CnpjValidationProcessor — Bull Job

```typescript
// /backend/src/company/processors/cnpj-validation.processor.ts
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { VerifikService } from '../../verifik/verifik.service';
import { BlockchainService } from '../../blockchain/blockchain.service';

@Processor('company-setup')
export class CnpjValidationProcessor {
  constructor(
    private prisma: PrismaService,
    private verifik: VerifikService,
    private blockchain: BlockchainService,
  ) {}

  @Process('validate-cnpj')
  async handleCnpjValidation(job: Job<{
    companyId: string;
    cnpj: string;
    creatorWalletAddress: string;
  }>) {
    const { companyId, cnpj, creatorWalletAddress } = job.data;

    // Step 1: Validate CNPJ via Verifik
    const cnpjResult = await this.verifik.validateCnpj(cnpj);

    if (cnpjResult.situacaoCadastral !== 'ATIVA') {
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          cnpjData: cnpjResult,
        },
      });
      throw new Error(
        `CNPJ ${cnpj} has status ${cnpjResult.situacaoCadastral} — expected ATIVA`,
      );
    }

    // Step 2: Store validated CNPJ data
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        cnpjData: cnpjResult,
        cnpjValidatedAt: new Date(),
      },
    });

    // Step 3: Deploy OCP smart contract with creator's wallet as owner
    const contractAddress = await this.blockchain.deployOcpContract({
      ownerAddress: creatorWalletAddress,
      companyId: companyId,
    });

    // Step 4: Activate company
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        contractAddress,
        status: 'ACTIVE',
      },
    });

    return { companyId, status: 'ACTIVE', contractAddress };
  }
}
```

### Bull Queue Configuration

```typescript
const COMPANY_SETUP_QUEUE_CONFIG = {
  name: 'company-setup',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000, // 30s, 60s, 120s
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
};
```

### CNPJ Data Structure (from Verifik)

The validated CNPJ data is stored as JSONB on the Company entity:

```typescript
interface CnpjData {
  razaoSocial: string;               // Legal name
  nomeFantasia: string | null;       // Trade name
  situacaoCadastral: string;         // e.g., "ATIVA"
  dataAbertura: string;              // Opening date
  naturezaJuridica: string;          // Legal nature code
  atividadePrincipal: {              // Primary CNAE activity
    codigo: string;
    descricao: string;
  };
  endereco: {                        // Registered address
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    municipio: string;
    uf: string;
    cep: string;
  };
  capitalSocial: number;             // Registered capital (from Receita)
}
```

---

## Business Rules

### BR-1: CNPJ Uniqueness
- CNPJ MUST be unique across all companies on the platform
- Attempting to create a company with an existing CNPJ returns `409 Conflict`
- CNPJ uniqueness check includes DISSOLVED companies (CNPJs are never recycled)

### BR-2: CNPJ Validity
- CNPJ MUST pass format validation (XX.XXX.XXX/XXXX-XX) with check digits
- CNPJ MUST be verified as `ATIVA` (active) in Receita Federal via Verifik
- CNPJs with status `BAIXADA`, `SUSPENSA`, `INAPTA`, or `NULA` are rejected
- If Verifik returns a non-ATIVA status, the company remains in `DRAFT` and the admin is notified

### BR-3: CNPJ Immutability After Activation
- `cnpj` cannot be changed after company status moves to ACTIVE
- CNPJ can be updated while the company is in DRAFT status (e.g., to correct a failed validation)
- After updating, admin can trigger re-validation from the setup-status page

### BR-4: CNPJ Validation Is the Company KYC
- CNPJ validation during company creation is the canonical company-level verification
- `kyc-verification.md` references this spec for CNPJ validation — no duplicate flow
- A validated CNPJ satisfies both the company setup requirement and the admin's company KYC

### BR-5: Re-Activation Does Not Re-Validate
- Re-activating an INACTIVE company does NOT require re-validation of the CNPJ with Verifik
- The original CNPJ validation is sufficient
- Re-activation is instant — the admin clicks "Re-activate" and the company status transitions from INACTIVE to ACTIVE immediately

---

## Edge Cases & Error Handling

### EC-1: Verifik API Timeout During CNPJ Validation
**Scenario**: Verifik API does not respond within 30 seconds during company setup.
**Handling**:
- Bull job retries up to 3 times with exponential backoff (30s, 60s, 120s)
- After 3 failures, job marks the setup step as FAILED
- Admin is notified via email: "CNPJ validation timed out. Please try again later."
- Admin can trigger a manual retry from the setup-status page

### EC-2: CNPJ Belongs to Dissolved/Inactive Entity in Receita Federal
**Scenario**: The CNPJ is valid in format but has status BAIXADA, SUSPENSA, INAPTA, or NULA.
**Handling**:
- Verifik returns the status; Bull job detects non-ATIVA status
- Company remains in DRAFT with a clear error message
- Admin can update the CNPJ (via PUT /api/v1/companies/:id) and retry
- Error message includes the Receita Federal status for context

### EC-3: CNPJ Validation Fails After Company Created in DRAFT
**Scenario**: Admin creates company, CNPJ validation fails, admin wants to correct the CNPJ.
**Handling**:
- Admin can update the CNPJ via PUT /api/v1/companies/:id (only while in DRAFT)
- After updating, admin can trigger re-validation from the setup-status page
- A new Bull job is dispatched for the updated CNPJ
- Old CNPJ is released for potential use by another company

### EC-4: Smart Contract Deployment Fails After CNPJ Validation Succeeds
**Scenario**: OCP contract deployment fails after CNPJ validation succeeds.
**Handling**:
- Bull job retries contract deployment up to 3 times
- After 3 failures, company remains in DRAFT with CNPJ validated but contract pending
- Admin is notified: "Company verification succeeded but contract deployment failed. Our team is investigating."
- Platform admin is also alerted for manual intervention

---

## Security Considerations

### SEC-1: CNPJ Data Protection (LGPD)
- CNPJ data from Verifik (razao social, endereco, etc.) is public information from Receita Federal
- However, the association between a CNPJ and a platform user should be protected
- CNPJ data MUST be stored encrypted at rest (database-level encryption)
- Access to CNPJ data MUST be scoped to company members only

---

## Success Criteria

### Performance
- CNPJ validation (end-to-end, including Verifik): < 30 seconds
- Full company setup (DRAFT -> ACTIVE): < 60 seconds

### Accuracy
- CNPJ validation: 100% accuracy against Receita Federal data

### Reliability
- Bull job retries handle transient Verifik failures without admin intervention
- Clear error messaging when validation fails permanently

---

## Dependencies

### Internal Dependencies
- **company-management.md**: Company entity with `cnpjData`, `cnpjValidatedAt` fields and status lifecycle
- **company-blockchain-admin.md**: OCP smart contract deployment triggered after successful CNPJ validation
- **error-handling.md**: Verifik retry strategy (30s timeout, 3 retries, exponential backoff)

### External Dependencies
- **Verifik**: CNPJ validation against Receita Federal
  - Endpoint: POST /v1/br/cnpj
  - Returns: razao social, situacao cadastral, endereco, CNAE, capital social
  - Rate limit: 100 requests/minute
  - SLA: 99.5% uptime
- **Bull (Redis-backed)**: Background job processing
  - Queues: company-setup, cnpj-validation
  - Retry: 3 attempts, exponential backoff

---

## Related Specifications

*Cross-references to be completed in Phase 5 of the spec alignment project.*
