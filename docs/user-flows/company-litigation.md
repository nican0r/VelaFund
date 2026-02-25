# Company Litigation Verification — User Flows

**Feature**: Automated litigation/judicial verification for company profiles via BigDataCorp API integration
**Actors**: System (Bull queue, BigDataCorp API), ADMIN/FINANCE (view results on profile), public visitors (view on public profile)
**Preconditions**: Company must have an ACTIVE status, Company Profile must be created (P3.6 complete)
**Related Flows**: [Company Profile](./company-profile.md), [Company Management](./company-management.md), [Audit Logging](./audit-logging.md)

---

## Flow Map

```
ADMIN creates Company Profile (POST /api/v1/companies/:companyId/profiles)
  │
  ├─ [profile created successfully] ─→ Profile returned to client (status: DRAFT)
  │     │
  │     └─ [async, fire-and-forget] ─→ Dispatch litigation check to Bull queue
  │           │
  │           ├─ [BigDataCorp API responds 200] ─→ Fetch litigation data
  │           │     │
  │           │     ├─ [lawsuits found] ─→ Mask PII, compute risk level
  │           │     │     │
  │           │     │     ├─ [0 active, any value] ─→ riskLevel = LOW
  │           │     │     ├─ [1-2 active, <R$100K] ─→ riskLevel = LOW
  │           │     │     ├─ [1-5 active, <R$500K] ─→ riskLevel = MEDIUM
  │           │     │     └─ [>5 active or >=R$500K] ─→ riskLevel = HIGH
  │           │     │
  │           │     └─ [no lawsuits found] ─→ COMPLETED, zero counts, LOW risk
  │           │
  │           │     Store litigationData JSONB → litigationStatus = COMPLETED
  │           │     Audit log: PROFILE_LITIGATION_FETCHED
  │           │
  │           ├─ [BigDataCorp returns 400/404] ─→ CNPJ not found (definitive)
  │           │     │
  │           │     └─ COMPLETED with zero counts, LOW risk
  │           │         Audit log: PROFILE_LITIGATION_FETCHED (note: CNPJ not found)
  │           │
  │           ├─ [BigDataCorp returns 401/403/5xx] ─→ Transient error
  │           │     │
  │           │     ├─ [attempt < max (3)] ─→ Re-throw for Bull retry
  │           │     │     └─ Exponential backoff: 30s, 60s, 120s
  │           │     │
  │           │     └─ [final attempt] ─→ litigationStatus = FAILED
  │           │           litigationError = "Verification service temporarily unavailable"
  │           │           Audit log: PROFILE_LITIGATION_FAILED
  │           │
  │           ├─ [network timeout (30s)] ─→ Same as transient error above
  │           │
  │           └─ [circuit breaker open] ─→ Immediate BigDataCorpUnavailableError
  │                 (5 consecutive failures → open, 60s half-open reset)
  │
  └─ [queue dispatch fails] ─→ Warning logged, profile creation NOT affected
```

---

## Flows

### Happy Path: Litigation Data Found

```
PRECONDITION: Company is ACTIVE, Company Profile does not exist yet
ACTOR: System (triggered by profile creation)
TRIGGER: CompanyProfileService.create() completes

1. [Backend] Profile created with litigationStatus = PENDING
2. [Backend] Fire-and-forget: dispatch 'fetch-litigation' job to 'profile-litigation' Bull queue
3. [System] Bull queue picks up job (LitigationCheckProcessor)
4. [System] BigDataCorpService.fetchLitigationData(cnpj) called
   → Sends POST to BigDataCorp API with cleaned CNPJ
   → AbortController timeout at 30 seconds
5. [System] BigDataCorp returns 200 with litigation data
6. [System] Normalize response fields (Portuguese/English)
7. [System] Mask individual plaintiff names (PII): "João Silva" → "J*** S***"
   → Company names (LTDA, S.A., EIRELI, etc.) NOT masked
8. [System] Compute summary statistics:
   → activeLawsuits: filter by status = 'ATIVO'
   → historicalLawsuits: all others
   → totalValueInDispute: sum of active lawsuit values
   → activeAdministrative: administrative proceedings with status = 'ATIVO'
   → protests: protests with status = 'ATIVO'
9. [System] Compute risk level based on active count + value
10. [System] Persist to CompanyProfile:
    → litigationStatus = COMPLETED
    → litigationData = full JSONB (summary, lawsuits, protestData, queryDate)
    → litigationFetchedAt = now
    → litigationError = null
11. [System] Audit log: PROFILE_LITIGATION_FETCHED (actorType: SYSTEM)

POSTCONDITION: Profile has litigation data available in COMPLETED state
SIDE EFFECTS: Audit log entry created
```

### Alternative Path: CNPJ Not Found in BigDataCorp

```
PRECONDITION: BigDataCorp does not have data for this CNPJ
TRIGGER: BigDataCorp returns 400 or 404

1. [System] BigDataCorpNotFoundError thrown
2. [System] Processor catches error — NOT a service failure, it's a valid result
3. [System] Persist empty litigation data:
   → litigationStatus = COMPLETED
   → litigationData = { summary: zero counts, riskLevel: LOW, lawsuits: [], protestData: empty }
   → litigationFetchedAt = now
   → litigationError = null
4. [System] Audit log: PROFILE_LITIGATION_FETCHED with note "CNPJ not found"

POSTCONDITION: Profile shows COMPLETED with no litigation history
SIDE EFFECTS: Audit log entry
```

### Error Path: Transient API Failure with Retries

```
PRECONDITION: BigDataCorp is temporarily unavailable
TRIGGER: BigDataCorp returns 5xx, 401/403, or network timeout

1. [System] BigDataCorpUnavailableError thrown
2. [System] Processor checks: is this the last attempt?
   → IF not last attempt: re-throw error for Bull to retry
   → Bull retries with exponential backoff (30s, 60s, 120s)
3. [System] On final attempt (attempt 3 of 3):
   → Persist: litigationStatus = FAILED
   → litigationError = "Verification service temporarily unavailable"
4. [System] Audit log: PROFILE_LITIGATION_FAILED

POSTCONDITION: Profile shows FAILED litigation status with user-friendly error
SIDE EFFECTS: Audit log entry
```

### Error Path: Circuit Breaker Open

```
PRECONDITION: 5 consecutive BigDataCorp failures have occurred
TRIGGER: Litigation check job tries to call BigDataCorp

1. [System] BigDataCorpService checks circuit breaker state
2. [System] Circuit is open → immediate BigDataCorpUnavailableError
   → No HTTP request sent to BigDataCorp
3. [System] Treated as transient error → same retry/failure path

POSTCONDITION: Request rejected immediately without hitting BigDataCorp
SIDE EFFECTS: After 60 seconds, circuit enters half-open state (allows one request through)
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 1 | Queue dispatch | Queue available | Happy | Job queued for async processing |
| 1 | Queue dispatch | Queue failure | Error | Warning logged, profile creation succeeds |
| 4 | Circuit breaker | Open (5+ failures, <60s) | Error | Immediate rejection, no API call |
| 4 | Circuit breaker | Closed or half-open | Happy | API call proceeds |
| 5 | BigDataCorp response | 200 OK | Happy | Litigation data fetched and processed |
| 5 | BigDataCorp response | 400/404 | Alternative | CNPJ not found — COMPLETED with zero counts |
| 5 | BigDataCorp response | 401/403 | Error | Auth error → transient failure path |
| 5 | BigDataCorp response | 5xx | Error | Server error → transient failure path |
| 5 | BigDataCorp response | Timeout (30s) | Error | Timeout → transient failure path |
| 2 | Retry decision | Not last attempt | Retry | Re-throw for Bull exponential backoff |
| 2 | Retry decision | Last attempt (3rd) | Error | Set FAILED status, stop retrying |
| 9 | Risk computation | 0 active lawsuits | — | LOW risk |
| 9 | Risk computation | 1-2 active, <R$100K | — | LOW risk |
| 9 | Risk computation | 1-5 active, <R$500K | — | MEDIUM risk |
| 9 | Risk computation | >5 active or >=R$500K | — | HIGH risk |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| CompanyProfile | litigationStatus | — | PENDING | Profile created |
| CompanyProfile | litigationStatus | PENDING | COMPLETED | Litigation data fetched successfully |
| CompanyProfile | litigationStatus | PENDING | COMPLETED | CNPJ not found (valid result) |
| CompanyProfile | litigationStatus | PENDING | FAILED | All retries exhausted |
| CompanyProfile | litigationData | null | JSONB | Litigation data fetched |
| CompanyProfile | litigationFetchedAt | null | DateTime | Litigation data fetched |
| CompanyProfile | litigationError | null | string | Final failure |

---

## API Response Shape

When litigation data is included in profile responses (`GET /api/v1/companies/:companyId/profiles` and `GET /api/v1/p/:slug`):

**PENDING**:
```json
{ "status": "PENDING", "fetchedAt": null, "summary": null }
```

**COMPLETED**:
```json
{
  "status": "COMPLETED",
  "fetchedAt": "2026-02-25T12:00:00.000Z",
  "summary": {
    "activeLawsuits": 2,
    "historicalLawsuits": 5,
    "activeAdministrative": 0,
    "protests": 1,
    "totalValueInDispute": "150000.00",
    "riskLevel": "MEDIUM"
  },
  "lawsuits": [...],
  "protestData": { "totalProtests": 1, "protests": [...] }
}
```

**FAILED**:
```json
{ "status": "FAILED", "fetchedAt": null, "summary": null, "error": "Verification service temporarily unavailable" }
```

---

## Immutability Rules

- Litigation data is **system-managed** — no user can edit, hide, or delete it
- The PUT profile endpoint silently ignores any litigation fields in the request body
- Only the LitigationCheckProcessor can write litigation fields
- Data is sourced from BigDataCorp and stored as-is (after PII masking)

---

## Cross-Feature References

**Depends on**: [Company Profile](./company-profile.md) — litigation check is triggered by profile creation
**Depends on**: [Company Management](./company-management.md) — company must be ACTIVE with a CNPJ
**Triggers**: [Audit Logging](./audit-logging.md) — creates PROFILE_LITIGATION_FETCHED and PROFILE_LITIGATION_FAILED events

---

## By Role

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| View litigation on own profile | Yes | Yes | Yes | Yes | Yes |
| View litigation on public profile | Yes | Yes | Yes | Yes | Yes |
| Edit litigation data | No | No | No | No | No |
| Retry litigation check | No (automatic on profile creation) | No | No | No | No |
