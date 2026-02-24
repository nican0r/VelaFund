# KYC Verification -- User Flows

**Feature**: Multi-step identity verification (CPF, document upload, facial recognition) for Brazilian regulatory compliance via Verifik integration
**Actors**: Authenticated user (any role), System (Verifik webhook, AML screening)
**Preconditions**: User is authenticated via Privy. User has not yet completed KYC or KYC was rejected.
**Related Flows**:
- **Depends on**: [Authentication](./authentication.md) -- user must be logged in
- **Feeds into**: [Cap Table Management](./cap-table-management.md) -- KYC approval unlocks cap table features
- **Feeds into**: [Shareholder Management](./shareholder-management.md) -- KYC approval unlocks shareholder management
- **Feeds into**: [Transactions](./transactions.md) -- KYC approval unlocks transaction creation
- **Feeds into**: [Funding Rounds](./funding-rounds.md) -- KYC approval unlocks funding round features
- **Feeds into**: [Option Plans, Grants & Exercises](./option-plans.md) -- KYC approval unlocks option plan features
- **Triggers**: Email notification on KYC status change (approved/rejected)

---

## Flow Map

```
User triggers KYC flow (banner CTA, blocked overlay, or direct /kyc navigation)
  |
  +-- [GET /api/v1/kyc/status] -- determine starting point
  |     |
  |     +-- [status = APPROVED] --> redirect to /dashboard (nothing to do)
  |     +-- [status = IN_REVIEW] --> redirect to /kyc/status (waiting)
  |     +-- [status = REJECTED, attemptCount >= 3] --> error: max attempts, contact support
  |     +-- [status = REJECTED, attemptCount < 3] --> restart from Step 1
  |     +-- [status = IN_PROGRESS] --> resume at first incomplete step
  |     +-- [status = NOT_STARTED] --> start at Step 1
  |
  +-- Step 1: CPF Verification
  |     |
  |     +-- [client-side CPF invalid (Modulo 11)] --> inline error, stay on step
  |     +-- [age < 18] --> inline error, stay on step
  |     +-- POST /api/v1/kyc/verify-cpf
  |           |
  |           +-- [success] --> advance to Step 2
  |           +-- [KYC_CPF_INVALID (400)] --> inline error on CPF field
  |           +-- [KYC_CPF_NOT_FOUND (404)] --> inline error
  |           +-- [KYC_CPF_MISMATCH / KYC_CPF_DOB_MISMATCH (422)] --> inline error
  |           +-- [KYC_CPF_DUPLICATE (409)] --> inline error, suggest contact support
  |           +-- [KYC_VERIFIK_UNAVAILABLE (502)] --> error toast, retry
  |
  +-- Step 2: Document Upload
  |     |
  |     +-- [client-side: file too large / wrong format] --> inline error, stay on step
  |     +-- [selects doc type] --> upload front (+ back for RG/CNH)
  |     +-- POST /api/v1/kyc/upload-document
  |           |
  |           +-- [success] --> advance to Step 3
  |           +-- [KYC_DOCUMENT_INVALID (422)] --> inline error, retry
  |           +-- [KYC_DOCUMENT_UNREADABLE (422)] --> inline error with tips, retry
  |           +-- [KYC_DOCUMENT_EXPIRED (422)] --> inline error
  |           +-- [network error] --> error toast, retry
  |
  +-- Step 3: Facial Recognition
  |     |
  |     +-- [camera denied] --> error card with browser instructions
  |     +-- [camera granted] --> live feed + liveness instructions
  |     +-- [photo captured] --> review screen: "Ficou bom?"
  |     |     +-- [Refazer] --> return to camera
  |     |     +-- [Enviar] --> POST /api/v1/kyc/verify-face
  |     |           |
  |     |           +-- [success] --> advance to Step 4
  |     |           +-- [KYC_LIVENESS_CHECK_FAILED (422)] --> error, retry
  |     |           +-- [KYC_FACE_MATCH_FAILED (422)] --> error, retry
  |     |           +-- [network error] --> error toast, retry
  |     |
  |     +-- [face not detected] --> guidance overlay, retry
  |
  +-- Step 4: Completion
  |     |
  |     +-- [KYC status = IN_REVIEW] --> success screen
  |     +-- [user clicks "Ir para Dashboard"] --> redirect to /dashboard
  |           +-- KYCStatusBanner shows "Em analise"
  |
  +-- Post-submission (async)
        |
        +-- [Backend: AML screening runs]
        |     +-- [LOW/MEDIUM risk] --> auto-approve
        |     +-- [HIGH risk, PEP] --> manual review queue
        |     +-- [sanctions match] --> auto-reject
        |
        +-- [Backend: KYC approved] --> email notification --> features unlocked
        +-- [Backend: KYC rejected] --> email with reason --> banner shows rejection
              +-- [user retries, attemptCount < 3] --> restart from Step 1
              +-- [attemptCount >= 3] --> blocked, contact support
```

---

## Flows

### Happy Path: Full KYC Completion

```
PRECONDITION: User is authenticated, KYC status is NOT_STARTED
ACTOR: Authenticated user
TRIGGER: User clicks "Iniciar Verificacao" on KYCStatusBanner or navigates to /kyc

1.  [UI] User clicks "Iniciar Verificacao" on KYCStatusBanner (or navigates to /kyc directly)
2.  [Frontend] Navigates to /kyc route
3.  [Frontend] KYCWizard mounts, sends GET /api/v1/kyc/status
4.  [Backend] Returns { status: "not_started", completedSteps: [], remainingSteps: ["cpf", "document", "facial", "aml"] }
5.  [UI] KYCWizard renders at Step 1 (CPF Verification)
6.  [UI] KYCProgressStepper shows: CPF [active] --> Documento --> Reconhecimento Facial --> Concluido
7.  [UI] CPFVerificationStep renders with fullName, CPF, dateOfBirth fields
8.  [UI] User enters full name
9.  [UI] User enters CPF (auto-masked to XXX.XXX.XXX-XX)
10. [Frontend] On CPF blur: validates Modulo 11 checksum
    --> IF invalid: "CPF invalido" inline error, STOP
11. [UI] User enters date of birth (DD/MM/YYYY)
12. [Frontend] Validates date is in the past and age >= 18
    --> IF under 18: "Voce deve ter 18 anos ou mais" inline error, STOP
13. [UI] User clicks "Verificar CPF"
14. [Frontend] Sends POST /api/v1/kyc/verify-cpf with { cpf, dateOfBirth, fullName }
15. [UI] Button shows loading spinner, fields disabled
16. [Backend] Validates CPF format
    --> IF invalid: return 400 KYC_CPF_INVALID
17. [Backend] Calls Verifik to validate CPF against Receita Federal
    --> IF Verifik unavailable: return 502 KYC_VERIFIK_UNAVAILABLE
    --> IF CPF not found: return 404 KYC_CPF_NOT_FOUND
18. [Backend] Checks dateOfBirth matches CPF registry
    --> IF mismatch: return 422 KYC_CPF_DOB_MISMATCH
19. [Backend] Checks CPF blind index for duplicates
    --> IF duplicate: return 409 KYC_CPF_DUPLICATE
20. [Backend] Stores encrypted CPF, updates KYC record, status = IN_PROGRESS
21. [Backend] Returns 200 with verified CPF data
22. [System] Queues audit event: KYC_CPF_VERIFIED
23. [UI] Step 1 shows green check, stepper updates: CPF [complete] --> Documento [active]
24. [UI] Auto-advances to Step 2 (DocumentUploadStep)
25. [UI] User selects document type via radio cards (RG, CNH, or Passport)
26. [UI] Upload area for front side appears: dashed border, drag-and-drop zone
27. [UI] User drags file or clicks "Selecionar arquivo"
28. [Frontend] Validates file type (PDF/PNG/JPG/JPEG) and size (< 10 MB)
    --> IF invalid type: "Formato nao suportado" inline error, STOP
    --> IF too large: "Arquivo excede 10 MB" inline error, STOP
29. [UI] File preview shows (thumbnail for images, PDF icon for PDF) + file name + size + "Remover" link
30. [UI] If RG/CNH: second upload area for "Verso do documento" appears
31. [UI] User uploads back side (same validation as step 28-29)
32. [UI] User clicks "Enviar Documentos"
33. [Frontend] Sends POST /api/v1/kyc/upload-document (multipart/form-data)
34. [UI] Upload progress bar appears (blue-600 fill)
35. [Backend] Receives files, validates MIME type + magic bytes
36. [Backend] Strips EXIF metadata from images
37. [Backend] Encrypts and stores in S3 KYC bucket (SSE-KMS)
38. [Backend] Calls Verifik for OCR and document validation
    --> IF document unreadable: return 422 KYC_DOCUMENT_INVALID
    --> IF document expired: return 422 KYC_DOCUMENT_EXPIRED
39. [Backend] Returns 200 with extracted document data
40. [System] Queues audit event: KYC_DOCUMENT_UPLOADED
41. [UI] Step 2 shows green check, stepper updates: Documento [complete] --> Reconhecimento Facial [active]
42. [UI] Auto-advances to Step 3 (FacialRecognitionStep)
43. [UI] Browser camera permission dialog appears
    --> IF denied: error card "Acesso a camera necessario" + browser instructions, STOP
44. [UI] Live camera feed in 280px circular frame
45. [UI] Instruction text: "Posicione seu rosto no centro do circulo"
46. [UI] Liveness instructions cycle: "Vire a cabeca para a esquerda", "Vire a cabeca para a direita", "Sorria"
47. [UI] Auto-capture when liveness conditions met, or user clicks "Capturar"
48. [UI] Review screen: captured photo in circular frame + "Ficou bom?"
49. [UI] "Refazer" (ghost button) and "Enviar" (primary button)
    --> IF "Refazer": return to camera feed (step 44)
50. [UI] User clicks "Enviar"
51. [Frontend] Sends POST /api/v1/kyc/verify-face with captured image as Blob
52. [UI] Spinner overlay on captured photo
53. [Backend] Processes facial recognition + liveness check via Verifik
    --> IF liveness fail: return 422 KYC_LIVENESS_CHECK_FAILED
    --> IF face doesn't match document (< 85%): return 422 KYC_FACE_MATCH_FAILED
54. [Backend] Updates KYC status to PENDING_REVIEW
55. [Backend] Triggers AML screening asynchronously via Bull queue
56. [Backend] Returns 200 with face match and liveness scores
57. [System] Queues audit events: KYC_FACE_VERIFIED, KYC_AML_SCREENED (async)
58. [UI] Step 3 shows green check, stepper updates: all complete
59. [UI] KYCCompletionStep renders with success illustration
60. [UI] "Verificacao Enviada!" title + "Estamos analisando seus dados..." subtitle
61. [UI] User clicks "Ir para o Dashboard"
62. [UI] Redirects to /dashboard
63. [UI] KYCStatusBanner shows "Sua verificacao esta sendo analisada" (IN_REVIEW)

POSTCONDITION: KYC status = PENDING_REVIEW (IN_REVIEW)
SIDE EFFECTS:
  - Audit logs: KYC_STARTED, KYC_CPF_VERIFIED, KYC_DOCUMENT_UPLOADED, KYC_FACE_VERIFIED
  - Async: KYC_AML_SCREENED (background job)
  - S3 uploads: document images (encrypted, SSE-KMS), selfie (encrypted, SSE-KMS)
  - Email: user notified when review completes
  - Verifik API calls: CPF validation, document OCR, facial recognition, AML screening
```

### Happy Path: AML Approval (Backend Async)

```
PRECONDITION: KYC status = PENDING_REVIEW, all verification steps complete
ACTOR: System (background job)
TRIGGER: AML screening Bull job processes

1. [System] AML screening job runs via Verifik
2. [System] Verifik returns risk assessment
   --> IF sanctionsMatch = true: GOTO Error Path: Sanctions Match
   --> IF isPEP = true AND riskScore = HIGH: GOTO Alternative Path: High-Risk Manual Review
3. [System] riskScore = LOW or MEDIUM, no sanctions, no PEP
4. [Backend] Updates KYC status to APPROVED
5. [Backend] Updates User.kycStatus to APPROVED
6. [System] Queues audit event: KYC_APPROVED
7. [System] Sends email notification: "Sua verificacao foi aprovada"
8. [UI] On next page load/navigation: KYCStatusBanner disappears
9. [UI] KYC-gated features (cap table, shareholders, transactions, etc.) are unlocked

POSTCONDITION: KYC status = APPROVED, all features unlocked
SIDE EFFECTS: Audit log: KYC_APPROVED, email notification sent
```

### Alternative Path: Resume Incomplete KYC

```
PRECONDITION: User started KYC (status = IN_PROGRESS), left mid-flow
ACTOR: Authenticated user
TRIGGER: User clicks "Continuar" on KYCStatusBanner or navigates to /kyc

1. [UI] User clicks "Continuar" on KYCStatusBanner (or navigates to /kyc)
2. [Frontend] Navigates to /kyc
3. [Frontend] KYCWizard mounts, sends GET /api/v1/kyc/status
4. [Backend] Returns { status: "in_progress", completedSteps: ["cpf"], remainingSteps: ["document", "facial", "aml"] }
5. [UI] KYCWizard resumes at Step 2 (first incomplete step)
6. [UI] Stepper shows: CPF [complete] --> Documento [active] --> ...
7. [Continue from step 25 of Happy Path]

POSTCONDITION: User continues KYC from where they left off
```

### Alternative Path: High-Risk Manual Review (PEP Detected)

```
PRECONDITION: KYC verification steps complete, AML screening detects PEP
ACTOR: System, Compliance team
TRIGGER: Verifik AML webhook returns isPEP = true, riskScore = HIGH

1. [System] Verifik AML screening detects PEP match
2. [Backend] Receives AML result: { isPEP: true, riskScore: "HIGH", sanctionsMatch: false }
3. [Backend] KYC status remains PENDING_REVIEW (not auto-approved or rejected)
4. [System] Queues audit event: KYC_AML_SCREENED with HIGH risk
5. [System] Sends Slack WARNING alert to compliance channel
6. [System] Sends email to compliance team with PEP details
7. [UI] User sees KYCStatusBanner: "Sua verificacao esta sendo analisada" (IN_REVIEW)
8. [Manual] Compliance team reviews PEP details in admin dashboard
9. [Manual] Compliance team approves or rejects KYC
   --> IF approved: Backend sets status = APPROVED, email sent to user
   --> IF rejected: Backend sets status = REJECTED with reason, email sent to user

POSTCONDITION: KYC manually reviewed by compliance team
SIDE EFFECTS: Slack alert, compliance email, audit logs
```

### Error Path: CPF Verification Failure

```
PRECONDITION: User is on Step 1 of KYC wizard
ACTOR: Authenticated user
TRIGGER: User submits CPF data that fails validation

1. [UI] User enters CPF and clicks "Verificar CPF"
2. [Frontend] Sends POST /api/v1/kyc/verify-cpf
3. [Backend] Returns error:
   --> KYC_CPF_INVALID (400): CPF format invalid
   --> KYC_CPF_NOT_FOUND (404): CPF not in Receita Federal
   --> KYC_CPF_DOB_MISMATCH (422): Date of birth doesn't match
   --> KYC_CPF_DUPLICATE (409): CPF already linked to another user
   --> KYC_VERIFIK_UNAVAILABLE (502): Verifik service down
4. [UI] Loading spinner stops, fields re-enabled
5. [UI] Error displayed:
   --> 400/404/422: inline error text below the relevant field
   --> 409: inline error "Este CPF ja esta associado a outra conta" (suggests contacting support)
   --> 502: error toast "Servico de verificacao indisponivel. Tente novamente."
6. [UI] User corrects data and retries (no limit on CPF step retries within a session)

POSTCONDITION: User remains on Step 1, can retry
```

### Error Path: Document Upload Failure

```
PRECONDITION: User is on Step 2 of KYC wizard
ACTOR: Authenticated user
TRIGGER: Document upload or validation fails

1. [UI] User attempts to upload document
2. [Frontend] Client-side validation:
   --> File too large (> 10 MB): inline error "Arquivo excede o tamanho maximo de 10 MB"
   --> Wrong format: inline error "Formato nao suportado. Use PDF, PNG, JPG ou JPEG."
   --> STOP (file not sent to server)
3. [Frontend] If client-side valid, sends POST /api/v1/kyc/upload-document
4. [Backend] Returns error:
   --> KYC_DOCUMENT_INVALID (422): document cannot be verified / tampered
   --> KYC_DOCUMENT_UNREADABLE (422): OCR cannot read the document
   --> KYC_DOCUMENT_EXPIRED (422): document is expired
5. [UI] Error displayed inline below upload area
6. [UI] Tips displayed for better photo (flat surface, no glare, all corners visible)
7. [UI] User removes file via "Remover" link and uploads a new one

POSTCONDITION: User remains on Step 2, can retry with better document
```

### Error Path: Facial Recognition Failure

```
PRECONDITION: User is on Step 3 of KYC wizard
ACTOR: Authenticated user
TRIGGER: Facial recognition or liveness check fails

1. Camera permission scenarios:
   --> [Camera denied by browser]: error card with instructions to enable camera
       User must grant permission via browser settings, then refresh
   --> [Camera not available (no hardware)]: error message, cannot proceed on this device

2. Face detection scenarios:
   --> [Face not detected in frame]: guidance overlay "Rosto nao detectado. Posicione-se no centro."
       User adjusts position and retries (no server call)

3. Server-side failure:
   --> [KYC_LIVENESS_CHECK_FAILED (422)]: "Verificacao de vivacidade falhou. Tente novamente."
       User clicks "Refazer" to retake photo
   --> [KYC_FACE_MATCH_FAILED (422)]: "O rosto nao corresponde ao documento enviado."
       User clicks "Refazer" to retake photo (ensure same person as document)
   --> [Network error]: error toast + retry button

4. [UI] User retries capture (unlimited retries within the step)

POSTCONDITION: User remains on Step 3, can retry
```

### Error Path: KYC Rejection and Resubmission

```
PRECONDITION: KYC submitted, status = REJECTED, attemptCount < 3
ACTOR: Authenticated user
TRIGGER: User sees rejection on KYCStatusBanner, clicks "Refazer Verificacao"

1. [System] Backend sets KYC status = REJECTED with rejectionReason
2. [System] Sends email notification with rejection reason
3. [System] Queues audit event: KYC_REJECTED
4. [UI] User logs in or navigates to dashboard
5. [UI] KYCStatusBanner shows: "Verificacao recusada: [reason]. Tente novamente." (red styling)
6. [UI] "Refazer Verificacao" button visible
7. [UI] User clicks "Refazer Verificacao"
8. [Frontend] Navigates to /kyc
9. [Frontend] GET /api/v1/kyc/status
10. [Backend] Returns { status: "rejected", attemptCount: 1, canResubmit: true }
11. [UI] KYCWizard starts from Step 1 (all steps must be redone)
12. [Backend] Increments attemptCount on new submission
13. [Continue from step 7 of Happy Path]

POSTCONDITION: KYC resubmitted, status = PENDING_REVIEW, attemptCount incremented
```

### Error Path: Maximum Attempts Exceeded

```
PRECONDITION: KYC status = REJECTED, attemptCount >= 3
ACTOR: Authenticated user
TRIGGER: User tries to restart KYC after 3 failed attempts

1. [UI] User clicks "Refazer Verificacao" on KYCStatusBanner
2. [Frontend] Navigates to /kyc
3. [Frontend] GET /api/v1/kyc/status
4. [Backend] Returns { status: "rejected", attemptCount: 3, canResubmit: false }
5. [UI] Error screen: "Numero maximo de tentativas excedido"
6. [UI] Message: "Entre em contato com o suporte para assistencia"
7. [UI] Support email link provided

POSTCONDITION: User cannot resubmit KYC, must contact support
```

### Error Path: Sanctions Match (Auto-Reject)

```
PRECONDITION: KYC verification steps complete, AML screening running
ACTOR: System
TRIGGER: Verifik AML screening detects sanctions match

1. [System] Verifik AML returns { sanctionsMatch: true }
2. [Backend] Immediately rejects KYC: status = REJECTED
3. [Backend] Sets generic rejectionReason (does NOT disclose sanctions match to user)
4. [System] Queues audit event: KYC_REJECTED with internal note about sanctions
5. [System] Sends CRITICAL Slack alert to compliance team
6. [System] Sends email to user: generic "Verificacao nao aprovada" (no details per regulatory requirement)
7. [UI] User sees KYCStatusBanner: "Verificacao recusada" with generic message

POSTCONDITION: KYC rejected, compliance team notified
SIDE EFFECTS: Slack CRITICAL alert, compliance team email, audit log with sanctions flag (internal only)
```

### KYC-Blocked Feature Access

```
PRECONDITION: User is authenticated, KYC status != APPROVED
ACTOR: Authenticated user
TRIGGER: User navigates to a KYC-gated page

1. [UI] User navigates to KYC-gated page (e.g., /dashboard/shareholders)
2. [Frontend] KYCGate wrapper checks kycStatus from useAuth()
3. [Frontend] kycStatus != APPROVED
4. [UI] KYCBlockedOverlay renders over the page content
5. [UI] Page content visible but blurred (backdrop-filter: blur(4px))
6. [UI] Overlay shows:
   --> Lock icon + "Verificacao de identidade necessaria"
   --> "Complete a verificacao KYC para acessar este recurso"
   --> Button based on status:
       NOT_STARTED/REJECTED: "Iniciar Verificacao" --> navigates to /kyc
       IN_PROGRESS: "Continuar Verificacao" --> navigates to /kyc
       IN_REVIEW: "Sua verificacao esta em analise" (no button, just text)
7. [UI] User clicks action button (if available)
8. [Frontend] Navigates to /kyc

POSTCONDITION: User redirected to KYC flow; page remains blocked until KYC approved
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 3 | Resume or start fresh | GET /api/v1/kyc/status | Happy | Resume at first incomplete step |
| 3 | Already approved | status = APPROVED | Redirect | Redirect to /dashboard |
| 3 | Under review | status = IN_REVIEW | Redirect | Redirect to /kyc/status |
| 3 | Max attempts exceeded | attemptCount >= 3 | Error | Show max attempts error |
| 10 | CPF Modulo 11 check | Client-side validation | Error | Inline error "CPF invalido" |
| 12 | Age check | dateOfBirth indicates < 18 | Error | Inline error "Deve ter 18 anos" |
| 16 | CPF format | Backend validation | Error | 400 KYC_CPF_INVALID |
| 17 | Verifik available | Verifik API responds | Error/Happy | 502 or continue |
| 17 | CPF exists in Receita Federal | Verifik lookup | Error | 404 KYC_CPF_NOT_FOUND |
| 18 | DOB matches CPF | Verifik cross-check | Error | 422 KYC_CPF_DOB_MISMATCH |
| 19 | CPF unique | Blind index lookup | Error | 409 KYC_CPF_DUPLICATE |
| 28 | File type valid | Client-side check | Error | Inline error if invalid |
| 28 | File size valid | Client-side check (< 10 MB) | Error | Inline error if too large |
| 38 | Document readable | Verifik OCR | Error | 422 KYC_DOCUMENT_INVALID |
| 38 | Document not expired | Verifik check | Error | 422 KYC_DOCUMENT_EXPIRED |
| 43 | Camera permission | Browser prompt | Error | Error card if denied |
| 53 | Liveness check | Verifik liveness | Error | 422 KYC_LIVENESS_CHECK_FAILED |
| 53 | Face match >= 85% | Verifik face match | Error | 422 KYC_FACE_MATCH_FAILED |
| AML | Sanctions match | Verifik AML | Error | Auto-reject, generic reason |
| AML | PEP detected | Verifik AML | Alternative | Manual review by compliance |
| AML | Low/medium risk | Verifik AML | Happy | Auto-approve |

---

## State Transitions

### KYCVerification Entity

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| KYCVerification | status | -- (not exists) | `NOT_STARTED` | User account created |
| KYCVerification | status | `NOT_STARTED` | `IN_PROGRESS` | POST /api/v1/kyc/start or first step submitted |
| KYCVerification | cpfVerified | false | true | CPF verification succeeds |
| KYCVerification | documentVerified | false | true | Document upload + OCR succeeds |
| KYCVerification | faceVerified | false | true | Facial recognition succeeds |
| KYCVerification | status | `IN_PROGRESS` | `PENDING_REVIEW` | All steps complete, AML running |
| KYCVerification | amlScreeningDone | false | true | AML screening completes |
| KYCVerification | status | `PENDING_REVIEW` | `APPROVED` | AML low/medium risk or manual approval |
| KYCVerification | status | `PENDING_REVIEW` | `REJECTED` | AML sanctions match or manual rejection |
| KYCVerification | attemptCount | N | N+1 | User resubmits after rejection |

### User Entity

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| User | kycStatus | `NOT_STARTED` | `IN_PROGRESS` | KYC flow started |
| User | kycStatus | `IN_PROGRESS` | `PENDING_REVIEW` | All KYC steps complete |
| User | kycStatus | `PENDING_REVIEW` | `APPROVED` | KYC approved |
| User | kycStatus | `PENDING_REVIEW` | `REJECTED` | KYC rejected |
| User | kycStatus | `REJECTED` | `IN_PROGRESS` | User resubmits KYC |

---

## By Role

KYC is required for all roles, but the timing and behavior differ:

| Aspect | ADMIN | INVESTOR | EMPLOYEE | FINANCE | LEGAL |
|--------|-------|----------|----------|---------|-------|
| KYC timing | Before using KYC-gated features | Immediately after signup | Immediately after signup | Before using KYC-gated features | Before using KYC-gated features |
| Dashboard access without KYC | Yes (view only) | No (redirected to /kyc) | No (redirected to /kyc) | Yes (view only) | Yes (view only) |
| Company creation without KYC | Yes | N/A | N/A | N/A | N/A |
| Settings access without KYC | Yes | No | No | Yes | Yes |
| Member management without KYC | Yes | No | No | Yes | Yes |
| KYC-gated features (cap table, shareholders, transactions, funding rounds, options) | Blocked until APPROVED | Blocked until APPROVED | Blocked until APPROVED | Blocked until APPROVED | Blocked until APPROVED |

> **Note**: The spec states investor/employee users MUST complete KYC immediately after signup (cannot access any dashboard feature). Admin/Finance/Legal users can access dashboard, settings, and member management without KYC, but KYC-gated features are blocked with `KYCBlockedOverlay`.

---

## Audit Events

| Action | Resource Type | Actor Type | Trigger |
|--------|-------------|------------|---------|
| `KYC_STARTED` | KYCVerification | USER | User initiates KYC flow |
| `KYC_CPF_VERIFIED` | KYCVerification | SYSTEM | CPF validation succeeds via Verifik |
| `KYC_CPF_FAILED` | KYCVerification | SYSTEM | CPF validation fails |
| `KYC_DOCUMENT_UPLOADED` | KYCVerification | USER | Identity document uploaded and validated |
| `KYC_FACE_VERIFIED` | KYCVerification | SYSTEM | Facial recognition passes |
| `KYC_FACE_FAILED` | KYCVerification | SYSTEM | Facial recognition fails |
| `KYC_AML_SCREENED` | KYCVerification | SYSTEM | AML screening completed |
| `KYC_APPROVED` | KYCVerification | SYSTEM | KYC verification approved |
| `KYC_REJECTED` | KYCVerification | SYSTEM | KYC verification rejected |

---

## Email Notifications

| Event | Recipient | Subject (PT-BR) | Subject (EN) |
|-------|-----------|-----------------|-------------|
| KYC Approved | User | Verificacao de identidade aprovada | Identity verification approved |
| KYC Rejected | User | Verificacao de identidade recusada | Identity verification rejected |
| PEP Detected | Compliance team | [ALERTA] PEP detectado - Revisao necessaria | [ALERT] PEP detected - Review required |
| Sanctions Match | Compliance team | [CRITICO] Correspondencia em lista de sancoes | [CRITICAL] Sanctions list match |

---

## Cross-Feature References

**Depends on**:
- [Authentication](./authentication.md) -- user must be logged in with a valid Privy session

**Feeds into**:
- [Cap Table Management](./cap-table-management.md) -- KYC APPROVED status unlocks cap table creation and management
- [Shareholder Management](./shareholder-management.md) -- KYC APPROVED status unlocks shareholder CRUD
- [Transactions](./transactions.md) -- KYC APPROVED status unlocks transaction creation
- [Funding Rounds](./funding-rounds.md) -- KYC APPROVED status unlocks funding round features
- [Option Plans, Grants & Exercises](./option-plans.md) -- KYC APPROVED status unlocks option plan features
- [Company Management](./company-management.md) -- Admin KYC is checked before certain company operations

**Triggers**:
- Email notifications on KYC status changes
- Slack alerts for PEP detection and sanctions matches
- Audit log events for all KYC actions
