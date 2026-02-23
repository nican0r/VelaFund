# Company Litigation Verification Specification

**Topic of Concern**: Automatic litigation and legal proceedings verification via BigDataCorp CNPJ lookup for the company profile

**One-Sentence Description**: The system automatically fetches and displays litigation data (active/historical lawsuits, administrative proceedings, notary protests, and computed risk level) from BigDataCorp when a company profile is created, storing the results as immutable, system-managed fields that no user can edit or hide.

---

## Overview

When a company profile is created (see [company-profile.md](./company-profile.md)), the system dispatches a background Bull job to fetch litigation data from BigDataCorp using the company's already-validated CNPJ. This provides transparency for investors reviewing the company profile — they can see the company's legal standing without relying on the founder's self-disclosure.

Key design decisions:
- **Immutable**: Litigation data is system-populated and cannot be edited, hidden, or deleted by any user role (including ADMIN). This ensures data integrity for investor due diligence.
- **Non-blocking**: The litigation fetch runs asynchronously. Profile creation succeeds immediately; litigation data appears once the background job completes.
- **Point-in-time snapshot**: Data is fetched once at profile creation and stored as a snapshot. The `litigationFetchedAt` timestamp lets viewers judge data freshness.
- **PII-safe**: Individual plaintiff names are masked before storage. Company names in lawsuits are stored in full (public information).

### Relationship to Existing Features

- **company-profile.md**: Litigation fields live on the CompanyProfile entity. The litigation section is displayed on both the internal authenticated view and the public shareable profile.
- **company-cnpj-validation.md**: The litigation check uses the CNPJ that was already validated during company setup. No additional CNPJ validation is performed.
- **error-handling.md**: BigDataCorp retry/circuit breaker follows the existing patterns defined for external services.

---

## User Stories

### US-1: Automatic Litigation Transparency
**As an** investor viewing a shared company profile
**I want to** see the company's litigation history (lawsuits, protests, risk level) automatically fetched from public records
**So that** I can assess legal risk without relying solely on the founder's self-disclosure

### US-2: Litigation Data Integrity
**As a** platform operator
**I want** litigation data to be immutable and system-managed
**So that** founders cannot hide or manipulate their legal standing on the profile

---

## Functional Requirements

### FR-8: Automatic Litigation Check (BigDataCorp)
- System MUST dispatch a background Bull job to fetch litigation data from BigDataCorp when a company profile is created (`POST /api/v1/companies/:companyId/profile`)
- The job uses the company's already-validated CNPJ (from `company-cnpj-validation.md`)
- System MUST store the litigation data as immutable fields on the CompanyProfile entity
- No user (including ADMIN) can edit, hide, or delete the litigation data
- If the BigDataCorp API fails after retries, the profile is still usable — the litigation section shows a "Verification pending" status
- Litigation data is displayed on both the internal authenticated view and the public shareable profile
- Litigation data includes: active/historical lawsuits, administrative proceedings, notary protest records, and a computed risk level

---

## Data Models

### Litigation Fields on CompanyProfile

The following fields are stored on the `CompanyProfile` entity (defined in [company-profile.md](./company-profile.md)). They are system-managed and immutable — no API endpoint allows direct modification.

```typescript
// These fields are part of the CompanyProfile entity
interface CompanyProfileLitigationFields {
  litigationStatus: VerificationStatus; // PENDING | COMPLETED | FAILED
  litigationData: LitigationData | null; // Full BigDataCorp response (JSONB)
  litigationFetchedAt: Date | null;     // When data was last fetched
  litigationError: string | null;       // Error message if FAILED
}

enum VerificationStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}
```

### LitigationData Interface

```typescript
interface LitigationData {
  summary: {
    activeLawsuits: number;           // Count of active judicial processes
    historicalLawsuits: number;       // Count of resolved/archived processes
    activeAdministrative: number;     // Active administrative proceedings
    protests: number;                 // Notary protest records
    totalValueInDispute: string;      // Sum of all active dispute amounts (Decimal as string)
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';  // Computed from lawsuit count + amounts
  };
  lawsuits: Array<{
    processId: string;                // Court case number (e.g., "0000123-45.2024.8.26.0100")
    court: string;                    // Court name
    caseType: 'CIVIL' | 'LABOR' | 'CRIMINAL' | 'TAX' | 'ADMINISTRATIVE';
    status: string;                   // ATIVO, ARQUIVADO, EXTINTO, etc.
    filingDate: string;               // ISO 8601 date
    lastUpdate: string;               // ISO 8601 date
    valueInDispute: string | null;    // Decimal as string, BRL
    plaintiffName: string;            // Masked if individual (PII)
    defendantRole: string;            // REU, AUTOR, etc.
    subject: string;                  // Brief description of lawsuit type
  }>;
  protestData: {
    totalProtests: number;
    protests: Array<{
      date: string;
      amount: string;
      notaryOffice: string;
      status: string;                 // ATIVO, PAGO, CANCELADO
    }>;
  };
  queryDate: string;                  // ISO 8601 — when BigDataCorp was queried
}
```

### VerificationStatus Enum (Prisma)

```prisma
enum VerificationStatus {
  PENDING
  COMPLETED
  FAILED
}
```

### Litigation Fields in CompanyProfile Prisma Model

These fields are part of the `CompanyProfile` model defined in [company-profile.md](./company-profile.md):

```prisma
// Part of the CompanyProfile model
litigationStatus    VerificationStatus @default(PENDING) @map("litigation_status")
litigationData      Json?              @map("litigation_data")
litigationFetchedAt DateTime?          @map("litigation_fetched_at")
litigationError     String?            @map("litigation_error")
```

---

## API Endpoints

Litigation data is not managed through dedicated API endpoints. Instead:

1. **Triggering**: The litigation check is automatically dispatched when a profile is created via `POST /api/v1/companies/:companyId/profile` (see [company-profile.md](./company-profile.md)).

2. **Reading**: Litigation data is included in the profile response for both authenticated and public endpoints:
   - `GET /api/v1/companies/:companyId/profile` — internal view with litigation section
   - `GET /api/v1/profiles/:slug` — public view with litigation section

3. **Immutability enforcement**: The `PUT /api/v1/companies/:companyId/profile` endpoint MUST silently ignore any litigation fields (`litigationStatus`, `litigationData`, `litigationFetchedAt`, `litigationError`) in the request body.

### Litigation Response Format

**When `COMPLETED`** (data successfully fetched):
```json
"litigation": {
  "status": "COMPLETED",
  "fetchedAt": "2026-02-23T10:05:00Z",
  "summary": {
    "activeLawsuits": 2,
    "historicalLawsuits": 5,
    "activeAdministrative": 0,
    "protests": 0,
    "totalValueInDispute": "225000.00",
    "riskLevel": "MEDIUM"
  },
  "lawsuits": [
    {
      "processId": "0000123-45.2024.8.26.0100",
      "court": "TJSP - 1ª Vara Cível",
      "caseType": "CIVIL",
      "status": "ATIVO",
      "filingDate": "2024-03-15",
      "lastUpdate": "2026-01-20",
      "valueInDispute": "150000.00",
      "plaintiffName": "J*** S***",
      "defendantRole": "REU",
      "subject": "Cobrança"
    }
  ],
  "protestData": {
    "totalProtests": 0,
    "protests": []
  }
}
```

**When `PENDING`** (job dispatched, not yet completed):
```json
"litigation": {
  "status": "PENDING",
  "fetchedAt": null,
  "summary": null
}
```

**When `FAILED`** (BigDataCorp fetch failed after all retries):
```json
"litigation": {
  "status": "FAILED",
  "fetchedAt": null,
  "summary": null,
  "error": "Verification service temporarily unavailable"
}
```

---

## Business Rules

### BR-11: Litigation Data Immutability
- Litigation verification fields (`litigationStatus`, `litigationData`, `litigationFetchedAt`, `litigationError`) are system-managed
- No API endpoint allows direct modification of these fields
- The `PUT /api/v1/companies/:companyId/profile` endpoint MUST silently ignore any litigation fields in the request body
- Only the background Bull job processor (`profile-litigation` queue) can write to these fields
- Litigation data cannot be hidden, deleted, or overridden by any user role (including ADMIN)

### Risk Level Computation

The risk level is computed from active lawsuit count and total value in dispute:

| Active Lawsuits | Total Value in Dispute | Risk Level |
|----------------|----------------------|------------|
| 0 | Any | LOW |
| 1-2 | < R$ 100.000 | LOW |
| 1-5 | < R$ 500.000 | MEDIUM |
| >5 or high value | >= R$ 500.000 | HIGH |

---

## Edge Cases & Error Handling

### EC-8: BigDataCorp API Failure During Profile Creation
**Scenario**: The BigDataCorp API is unreachable or returns errors when the litigation check Bull job runs.
**Handling**: Bull job retries 3 times with exponential backoff (30s, 60s, 120s). If all retries fail, `litigationStatus` is set to `FAILED` and `litigationError` stores a user-friendly message. The profile remains fully usable — the litigation section displays "Verification pending" or "Verification unavailable." An admin alert is sent via Slack. The job can be manually re-triggered by an admin.

### EC-9: CNPJ Not Found in BigDataCorp
**Scenario**: The company's CNPJ returns no results from BigDataCorp (e.g., very new company).
**Handling**: `litigationStatus` is set to `COMPLETED` with `litigationData.summary` showing all zero counts and `riskLevel: 'LOW'`. This is a valid result — no litigation history is a positive signal.

### EC-10: BigDataCorp Returns Stale Data
**Scenario**: Litigation data changes after the initial fetch.
**Handling**: Litigation data is fetched once at profile creation and stored as a point-in-time snapshot. The `litigationFetchedAt` timestamp is displayed to viewers so they can judge data freshness. Future enhancement: periodic re-fetch job (out of scope for MVP).

---

## Dependencies

### Internal Dependencies
- **company-profile.md**: Litigation fields are stored on the CompanyProfile entity. The litigation check is triggered by profile creation.
- **company-cnpj-validation.md**: Uses the already-validated CNPJ for the BigDataCorp lookup.
- **error-handling.md**: Retry strategies and circuit breaker patterns for external services.
- **audit-logging.md**: Litigation fetch success and failure events are audit-logged.
- **security.md**: PII masking rules for individual plaintiff names.

### External Dependencies
- **BigDataCorp**: Litigation and legal proceedings data via CNPJ lookup
  - Endpoint: POST with CNPJ to `/empresas/owners_lawsuits` and related datasets
  - Authentication: API Key in Authorization header
  - Returns: Active/historical lawsuits, administrative proceedings, protest records
  - Rate limit: Per API key (check contract)
  - Environment variable: `BIGDATACORP_API_KEY` (rotated annually)
- **Bull (Redis-backed)**: Litigation check queue
  - Queue: `profile-litigation` — Retry: 3 attempts, exponential backoff (30s, 60s, 120s)

---

## Technical Implementation

### BigDataCorpService — Litigation Data Fetching

```typescript
// /backend/src/profile/bigdatacorp.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../common/circuit-breaker.service';

interface BigDataCorpLitigationResponse {
  lawsuits: Array<{
    processId: string;
    court: string;
    caseType: string;
    status: string;
    filingDate: string;
    lastUpdate: string;
    valueInDispute: string | null;
    plaintiffName: string;
    defendantRole: string;
    subject: string;
  }>;
  administrativeProceedings: Array<{
    processId: string;
    agency: string;
    status: string;
    filingDate: string;
  }>;
  protests: Array<{
    date: string;
    amount: string;
    notaryOffice: string;
    status: string;
  }>;
}

@Injectable()
export class BigDataCorpService {
  private readonly logger = new Logger(BigDataCorpService.name);
  private readonly apiUrl = 'https://api.bigdatacorp.com.br';
  private readonly timeout = 30000; // 30 seconds

  constructor(private circuitBreaker: CircuitBreakerService) {
    this.circuitBreaker.register('bigdatacorp', {
      failureThreshold: 5,
      resetTimeout: 60000, // 60s half-open
    });
  }

  async fetchLitigationData(cnpj: string): Promise<BigDataCorpLitigationResponse> {
    return this.circuitBreaker.execute('bigdatacorp', async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      try {
        const response = await fetch(`${this.apiUrl}/empresas/owners_lawsuits`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.BIGDATACORP_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cnpj: cnpj.replace(/\D/g, '') }),
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 400 || response.status === 404) {
            // Definitive result — CNPJ not found, do not retry
            throw new BigDataCorpNotFoundError(`CNPJ ${cnpj} not found in BigDataCorp`);
          }
          throw new Error(`BigDataCorp API error: ${response.status}`);
        }

        return await response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }
}

class BigDataCorpNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BigDataCorpNotFoundError';
  }
}
```

### LitigationCheckProcessor — Bull Job

```typescript
// /backend/src/profile/profile-litigation.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BigDataCorpService } from './bigdatacorp.service';
import { AuditService } from '../audit/audit.service';
import { redactPii } from '../common/redact-pii';
import { LitigationData } from './types';

@Processor('profile-litigation')
export class LitigationCheckProcessor {
  private readonly logger = new Logger(LitigationCheckProcessor.name);

  constructor(
    private prisma: PrismaService,
    private bigDataCorp: BigDataCorpService,
    private auditService: AuditService,
  ) {}

  @Process('fetch-litigation')
  async handleFetchLitigation(job: Job<{
    profileId: string;
    companyId: string;
    cnpj: string;
  }>) {
    const { profileId, companyId, cnpj } = job.data;

    try {
      const response = await this.bigDataCorp.fetchLitigationData(cnpj);

      // Mask individual plaintiff names (PII)
      const maskedLawsuits = response.lawsuits.map((lawsuit) => ({
        ...lawsuit,
        plaintiffName: this.maskIndividualName(lawsuit.plaintiffName),
      }));

      // Compute summary
      const activeLawsuits = maskedLawsuits.filter((l) => l.status === 'ATIVO');
      const historicalLawsuits = maskedLawsuits.filter((l) => l.status !== 'ATIVO');
      const totalValueInDispute = activeLawsuits
        .reduce((sum, l) => sum + (parseFloat(l.valueInDispute || '0') || 0), 0)
        .toFixed(2);

      const litigationData: LitigationData = {
        summary: {
          activeLawsuits: activeLawsuits.length,
          historicalLawsuits: historicalLawsuits.length,
          activeAdministrative: response.administrativeProceedings.filter(
            (a) => a.status === 'ATIVO',
          ).length,
          protests: response.protests.filter((p) => p.status === 'ATIVO').length,
          totalValueInDispute,
          riskLevel: this.computeRiskLevel(
            activeLawsuits.length,
            parseFloat(totalValueInDispute),
          ),
        },
        lawsuits: maskedLawsuits,
        protestData: {
          totalProtests: response.protests.length,
          protests: response.protests,
        },
        queryDate: new Date().toISOString(),
      };

      await this.prisma.companyProfile.update({
        where: { id: profileId },
        data: {
          litigationStatus: 'COMPLETED',
          litigationData: litigationData as any,
          litigationFetchedAt: new Date(),
          litigationError: null,
        },
      });

      await this.auditService.log({
        actorType: 'SYSTEM',
        action: 'PROFILE_LITIGATION_FETCHED',
        resourceType: 'CompanyProfile',
        resourceId: profileId,
        companyId,
        changes: {
          before: { litigationStatus: 'PENDING' },
          after: {
            litigationStatus: 'COMPLETED',
            activeLawsuits: litigationData.summary.activeLawsuits,
            riskLevel: litigationData.summary.riskLevel,
          },
        },
      });

      this.logger.log(`Litigation data fetched for profile ${profileId}`);
    } catch (error) {
      // If this is the last attempt, mark as FAILED
      if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
        await this.prisma.companyProfile.update({
          where: { id: profileId },
          data: {
            litigationStatus: 'FAILED',
            litigationError: 'Verification service temporarily unavailable',
          },
        });

        await this.auditService.log({
          actorType: 'SYSTEM',
          action: 'PROFILE_LITIGATION_FAILED',
          resourceType: 'CompanyProfile',
          resourceId: profileId,
          companyId,
          metadata: { error: error.message },
        });

        this.logger.error(`Litigation fetch failed for profile ${profileId}`, error.stack);
      }

      throw error; // Let Bull handle retry
    }
  }

  private computeRiskLevel(
    activeLawsuits: number,
    totalValue: number,
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (activeLawsuits === 0) return 'LOW';
    if (activeLawsuits <= 2 && totalValue < 100000) return 'LOW';
    if (activeLawsuits <= 5 && totalValue < 500000) return 'MEDIUM';
    return 'HIGH';
  }

  private maskIndividualName(name: string): string {
    // Company names (containing LTDA, S.A., EIRELI, MEI, etc.) are not masked
    if (/\b(LTDA|S\.?A\.?|EIRELI|MEI|CNPJ|EMPRESA|CIA|COMPANHIA)\b/i.test(name)) {
      return name;
    }
    // Individual names: mask with first initial + *** for each part
    return name
      .split(' ')
      .map((part) => (part.length > 0 ? `${part[0]}***` : part))
      .join(' ');
  }
}
```

### Bull Queue Configuration

```typescript
// Queue: profile-litigation
const LITIGATION_QUEUE_CONFIG = {
  name: 'profile-litigation',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000, // 30s, 60s, 120s
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for inspection
  },
};
```

### Dispatching from ProfileService

The litigation check is dispatched in the `ProfileService.create()` method (see [company-profile.md](./company-profile.md)):

```typescript
// In ProfileService.create() — after profile is created
await this.litigationCheckQueue.add('fetch-litigation', {
  profileId: profile.id,
  companyId: companyId,
  cnpj: company.cnpj,
}, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 30000 },
});
```

---

## Error Codes

### PROFILE — Litigation-Related Error Codes

| Code | messageKey | HTTP | PT-BR | EN |
|------|-----------|------|-------|-----|
| `PROFILE_LITIGATION_UNAVAILABLE` | `errors.profile.litigationUnavailable` | 502 | Serviço de verificação judicial temporariamente indisponível | Litigation verification service temporarily unavailable |
| `PROFILE_LITIGATION_CNPJ_NOT_FOUND` | `errors.profile.litigationCnpjNotFound` | 422 | CNPJ não encontrado na base de dados judicial | CNPJ not found in litigation database |

### Audit Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `PROFILE_LITIGATION_FETCHED` | CompanyProfile | SYSTEM | BigDataCorp litigation data successfully retrieved |
| `PROFILE_LITIGATION_FAILED` | CompanyProfile | SYSTEM | BigDataCorp litigation fetch failed after all retries |

---

## Security Considerations

### SEC-7: Litigation Data PII Handling
- Individual plaintiff names (CPFs) from BigDataCorp are stored masked (`J*** S***`) — follows existing PII rules from `security.md`
- Company names (CNPJs) in lawsuit data are stored in full (public information)
- Litigation data is NOT encrypted at application level (not high-sensitivity PII, follows same pattern as `cnpjData` on Company entity — DB-at-rest encryption only)
- Lawsuit amounts and court case numbers are public information and stored in full
- The `litigationData` JSONB field never contains raw CPF numbers or personal addresses

---

## Success Criteria

### Litigation Verification
- BigDataCorp litigation fetch completes within 60 seconds of profile creation (average)
- Litigation data displayed on both internal and public profile views
- `PUT /api/v1/companies/:companyId/profile` silently ignores litigation fields in request body
- Bull job retries 3 times with exponential backoff on BigDataCorp failure
- Circuit breaker opens after 5 consecutive BigDataCorp failures, half-open after 60s
- Failed litigation fetch does not block profile creation, editing, or publishing
- Individual plaintiff names are masked in stored litigation data
- `PROFILE_LITIGATION_FETCHED` and `PROFILE_LITIGATION_FAILED` audit events are recorded

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-profile.md](./company-profile.md) | Litigation fields are stored on CompanyProfile; litigation section displayed in profile views |
| [company-cnpj-validation.md](./company-cnpj-validation.md) | Uses the already-validated CNPJ for BigDataCorp lookup |
| [error-handling.md](../.claude/rules/error-handling.md) | BigDataCorp retry/circuit breaker follows existing external service patterns |
| [security.md](../.claude/rules/security.md) | PII masking for individual plaintiff names follows existing rules |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Litigation fetch success and failure events are audit-logged as SYSTEM events |
| [api-standards.md](../.claude/rules/api-standards.md) | Litigation data included in standard profile API responses |
