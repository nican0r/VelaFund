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
  |     +-- [status = PENDING_REVIEW] --> redirect to /kyc/status (waiting)
  |     +-- [status = REJECTED, attemptCount >= 3] --> error: max attempts, contact support
  |     +-- [status = REJECTED or RESUBMISSION_REQUIRED, attemptCount < 3] --> POST /api/v1/kyc/start (restart)
  |     +-- [status = IN_PROGRESS] --> resume at first incomplete step
  |     +-- [status = NOT_STARTED] --> POST /api/v1/kyc/start (new session)
  |
  +-- POST /api/v1/kyc/start -- create or resume KYC session
  |     |
  |     +-- [KYC_ALREADY_APPROVED (409)] --> already verified, redirect to /dashboard
  |     +-- [KYC_UNDER_REVIEW (409)] --> already submitted, redirect to /kyc/status
  |     +-- [KYC_MAX_ATTEMPTS_EXCEEDED (422)] --> max attempts error, contact support
  |     +-- [success] --> returns { sessionId, status, requiredSteps }
  |
  +-- Step 1: CPF Verification
  |     |
  |     +-- [client-side CPF invalid (Modulo 11)] --> inline error, stay on step
  |     +-- [age < 18] --> inline error, stay on step
  |     +-- POST /api/v1/kyc/verify-cpf { cpf, dateOfBirth, fullName }
  |           |
  |           +-- [success] --> advance to Step 2
  |           +-- [KYC_CPF_INVALID (422)] --> inline error on CPF field
  |           +-- [KYC_CPF_NOT_FOUND (404)] --> inline error
  |           +-- [KYC_CPF_DOB_MISMATCH (422)] --> inline error
  |           +-- [KYC_CPF_DUPLICATE (422)] --> inline error, suggest contact support
  |           +-- [KYC_VERIFIK_UNAVAILABLE (502)] --> error toast, retry
  |
  +-- Step 2: Document Upload
  |     |
  |     +-- [client-side: file too large / wrong format] --> inline error, stay on step
  |     +-- [selects doc type: RG, CNH, RNE, or PASSPORT] --> upload front (+ back for RG/CNH)
  |     +-- POST /api/v1/kyc/upload-document (multipart: file, fileBack?, documentType, documentNumber)
  |           |
  |           +-- [success] --> advance to Step 3
  |           +-- [KYC_STEP_ORDER_VIOLATION (422)] --> CPF not yet verified, redirect to Step 1
  |           +-- [KYC_FILE_TOO_LARGE (422)] --> inline error (max 10 MB)
  |           +-- [KYC_FILE_INVALID_FORMAT (422)] --> inline error (must be PNG or JPEG)
  |           +-- [KYC_DOCUMENT_UNREADABLE (422)] --> inline error with tips, retry
  |           +-- [KYC_DOCUMENT_EXPIRED (422)] --> inline error
  |           +-- [KYC_S3_UNAVAILABLE (422)] --> error toast, retry later
  |           +-- [KYC_VERIFIK_UNAVAILABLE (502)] --> error toast, retry
  |
  +-- Step 3: Facial Recognition
  |     |
  |     +-- [camera denied] --> error card with browser instructions
  |     +-- [camera granted] --> live feed + liveness instructions
  |     +-- [photo captured] --> review screen: "Ficou bom?"
  |     |     +-- [Refazer] --> return to camera
  |     |     +-- [Enviar] --> POST /api/v1/kyc/verify-face (multipart: selfie)
  |     |           |
  |     |           +-- [success] --> advance to Step 4
  |     |           +-- [KYC_STEP_ORDER_VIOLATION (422)] --> prerequisite steps incomplete
  |     |           +-- [KYC_LIVENESS_CHECK_FAILED (422)] --> error, retry
  |     |           +-- [KYC_FACE_MATCH_FAILED (422)] --> error, retry
  |     |           +-- [KYC_S3_UNAVAILABLE (422)] --> error toast, retry later
  |     |           +-- [KYC_VERIFIK_UNAVAILABLE (502)] --> error toast, retry
  |     |
  |     +-- [face not detected] --> guidance overlay, retry
  |
  +-- Step 4: Completion
  |     |
  |     +-- [KYC status = PENDING_REVIEW] --> success screen
  |     +-- [user clicks "Ir para Dashboard"] --> redirect to /dashboard
  |           +-- KYCStatusBanner shows "Em analise"
  |
  +-- Post-submission (async, via Bull queue 'kyc-aml')
        |
        +-- [Backend: AML screening runs via Verifik]
        |     +-- [LOW/MEDIUM risk] --> auto-approve
        |     +-- [HIGH risk, PEP] --> stays PENDING_REVIEW (manual review queue)
        |     +-- [sanctions match] --> auto-reject
        |
        +-- [Backend: KYC approved] --> email notification --> features unlocked
        +-- [Backend: KYC rejected] --> email with reason --> banner shows rejection
              +-- [user retries, attemptCount < 3] --> POST /api/v1/kyc/start (restart)
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
4.  [Backend] Returns { status: "NOT_STARTED", completedSteps: [], remainingSteps: ["cpf", "document", "facial", "aml"], attemptCount: 0, canResubmit: true, rejectionReason: null }
5.  [Frontend] Sends POST /api/v1/kyc/start to create a new KYC session
6.  [Backend] Creates KycVerification record (attemptCount=1, status=IN_PROGRESS), updates User.kycStatus
7.  [Backend] Returns { sessionId: "uuid", status: "IN_PROGRESS", requiredSteps: ["cpf", "document", "facial", "aml"] }
8.  [UI] KYCWizard renders at Step 1 (CPF Verification)
9.  [UI] KYCProgressStepper shows: CPF [active] --> Documento --> Reconhecimento Facial --> Concluido
10. [UI] CPFVerificationStep renders with fullName, CPF, dateOfBirth fields
11. [UI] User enters full name
12. [UI] User enters CPF (auto-masked to XXX.XXX.XXX-XX)
13. [Frontend] On CPF blur: validates Modulo 11 checksum
    --> IF invalid: "CPF invalido" inline error, STOP
14. [UI] User enters date of birth (DD/MM/YYYY)
15. [Frontend] Validates date is in the past and age >= 18
    --> IF under 18: "Voce deve ter 18 anos ou mais" inline error, STOP
16. [UI] User clicks "Verificar CPF"
17. [Frontend] Sends POST /api/v1/kyc/verify-cpf with { cpf, dateOfBirth, fullName }
18. [UI] Button shows loading spinner, fields disabled
19. [Backend] Validates CPF Modulo 11 checksum (strips formatting, rejects all-same-digit CPFs)
    --> IF invalid: return 422 KYC_CPF_INVALID
20. [Backend] Checks CPF blind index (HMAC-SHA256) for duplicates against other users
    --> IF duplicate: return 422 KYC_CPF_DUPLICATE
21. [Backend] Calls Verifik to validate CPF against Receita Federal (30s timeout)
    --> IF Verifik unavailable/timeout: return 502 KYC_VERIFIK_UNAVAILABLE
    --> IF CPF not found in registry: return 404 KYC_CPF_NOT_FOUND
22. [Backend] Checks dateOfBirth from Verifik matches user-provided value
    --> IF mismatch: return 422 KYC_CPF_DOB_MISMATCH
23. [Backend] Encrypts CPF via KMS (or skips if KMS unavailable with warning), stores blind index on User
24. [Backend] Updates KycVerification.cpfVerified = true within $transaction
25. [Backend] Returns 200 with { verified: true, cpfData: { fullName, dateOfBirth, cpfStatus }, verifikSignature }
26. [System] Audit interceptor queues event: KYC_CPF_VERIFIED (via @Auditable decorator)
27. [UI] Step 1 shows green check, stepper updates: CPF [complete] --> Documento [active]
28. [UI] Auto-advances to Step 2 (DocumentUploadStep)
29. [UI] User selects document type via radio cards (RG, CNH, RNE, or Passport)
30. [UI] Upload area for front side appears: dashed border, drag-and-drop zone
31. [UI] User drags file or clicks "Selecionar arquivo"
32. [Frontend] Validates file type (PNG/JPEG only) and size (< 10 MB)
    --> IF invalid type: "Formato nao suportado. Use PNG ou JPEG." inline error, STOP
    --> IF too large: "Arquivo excede 10 MB" inline error, STOP
33. [UI] File preview shows (thumbnail for images) + file name + size + "Remover" link
34. [UI] If RG/CNH: second upload area for "Verso do documento" appears
35. [UI] User uploads back side (same validation as step 32-33)
36. [UI] User enters document number
37. [UI] User clicks "Enviar Documentos"
38. [Frontend] Sends POST /api/v1/kyc/upload-document (multipart/form-data: file, fileBack?, documentType, documentNumber)
39. [UI] Upload progress bar appears (blue-600 fill)
40. [Backend] Validates file size and magic bytes (JPEG: FF D8 FF, PNG: 89 50 4E 47)
    --> IF file too large: return 422 KYC_FILE_TOO_LARGE
    --> IF invalid format: return 422 KYC_FILE_INVALID_FORMAT
41. [Backend] Enforces step order: cpfVerified must be true
    --> IF not verified: return 422 KYC_STEP_ORDER_VIOLATION
42. [Backend] Uploads front image to S3 KYC bucket (SSE-KMS encryption)
    --> IF S3 unavailable: return 422 KYC_S3_UNAVAILABLE
43. [Backend] If back image provided, uploads to S3 with same encryption
44. [Backend] Calls Verifik for OCR and document validation
    --> IF document unreadable/authenticity < 50%: return 422 KYC_DOCUMENT_UNREADABLE
45. [Backend] Compares document-extracted name with CPF-registered name (Levenshtein, threshold 0.9)
    --> IF low similarity: logs warning (soft check, does not reject)
46. [Backend] Checks document expiry date
    --> IF document expired: return 422 KYC_DOCUMENT_EXPIRED
47. [Backend] Updates KycVerification with documentType and documentS3Key (front|back composite key)
48. [Backend] Returns 200 with { verified: true, extractedData: { fullName, documentNumber, issueDate, expiryDate } }
49. [System] Audit interceptor queues event: KYC_DOCUMENT_UPLOADED (via @Auditable decorator)
50. [UI] Step 2 shows green check, stepper updates: Documento [complete] --> Reconhecimento Facial [active]
51. [UI] Auto-advances to Step 3 (FacialRecognitionStep)
52. [UI] Browser camera permission dialog appears
    --> IF denied: error card "Acesso a camera necessario" + browser instructions, STOP
53. [UI] Live camera feed in 280px circular frame
54. [UI] Instruction text: "Posicione seu rosto no centro do circulo"
55. [UI] Liveness instructions cycle: "Vire a cabeca para a esquerda", "Vire a cabeca para a direita", "Sorria"
56. [UI] Auto-capture when liveness conditions met, or user clicks "Capturar"
57. [UI] Review screen: captured photo in circular frame + "Ficou bom?"
58. [UI] "Refazer" (ghost button) and "Enviar" (primary button)
    --> IF "Refazer": return to camera feed (step 53)
59. [UI] User clicks "Enviar"
60. [Frontend] Sends POST /api/v1/kyc/verify-face with selfie image as multipart file
61. [UI] Spinner overlay on captured photo
62. [Backend] Validates selfie image (magic bytes: PNG/JPEG only, max 5 MB via Multer)
63. [Backend] Enforces step order: cpfVerified and documentS3Key must exist
    --> IF prerequisite missing: return 422 KYC_STEP_ORDER_VIOLATION
64. [Backend] Uploads selfie to S3 KYC bucket (SSE-KMS encryption)
    --> IF S3 unavailable: return 422 KYC_S3_UNAVAILABLE
65. [Backend] Generates presigned URL for document front image (15-minute expiry)
66. [Backend] Calls Verifik face match (selfie buffer + document presigned URL)
    --> Verifik-level thresholds: liveness >= 70, matchScore >= 80
    --> KYC service-level thresholds (stricter): liveness >= 80, matchScore >= 85
    --> IF liveness < 80 (service-level): return 422 KYC_LIVENESS_CHECK_FAILED
    --> IF matchScore < 85 (service-level): return 422 KYC_FACE_MATCH_FAILED
67. [Backend] Updates KycVerification within $transaction:
    - faceVerified = true, faceMatchScore, livenessScore, selfieS3Key
    - status = PENDING_REVIEW
68. [Backend] Updates User.kycStatus = PENDING_REVIEW
69. [Backend] Queues AML screening job on Bull queue 'kyc-aml' (job: 'screen-aml', 3 retries, exponential backoff)
70. [Backend] Returns 200 with { verified: true, faceMatchScore, livenessScore }
71. [System] Audit interceptor queues event: KYC_FACE_VERIFIED (via @Auditable decorator)
72. [UI] Step 3 shows green check, stepper updates: all complete
73. [UI] KYCCompletionStep renders with success illustration
74. [UI] "Verificacao Enviada!" title + "Estamos analisando seus dados..." subtitle
75. [UI] User clicks "Ir para o Dashboard"
76. [UI] Redirects to /dashboard
77. [UI] KYCStatusBanner shows "Sua verificacao esta sendo analisada" (PENDING_REVIEW)

POSTCONDITION: KYC status = PENDING_REVIEW, AML screening queued
SIDE EFFECTS:
  - Audit logs: KYC_STARTED, KYC_CPF_VERIFIED, KYC_DOCUMENT_UPLOADED, KYC_FACE_VERIFIED
  - Async: AML screening via Bull queue 'kyc-aml' (screen-aml job)
  - S3 uploads: document front/back images (SSE-KMS), selfie (SSE-KMS)
  - User record: cpfEncrypted (KMS), cpfBlindIndex (HMAC-SHA256)
  - Email: user notified when review completes
  - Verifik API calls: CPF validation, document OCR, facial recognition
```

### Happy Path: AML Approval (Backend Async)

```
PRECONDITION: KYC status = PENDING_REVIEW, all verification steps complete
ACTOR: System (Bull queue processor 'kyc-aml')
TRIGGER: AML screening job 'screen-aml' dequeued by KycProcessor

1. [System] KycProcessor.handleAmlScreening() invoked with kycVerificationId
2. [Backend] Loads KycVerification with user relation
3. [Backend] Decrypts user's CPF via KMS for AML screening
   --> IF decryption fails: logs warning, proceeds with empty CPF
4. [Backend] Calls VerifikService.screenAml(fullName, cpf, nationality="BR")
5. [System] Verifik returns risk assessment: { riskScore, isPEP, sanctionsMatch, details }
   --> IF sanctionsMatch = true: GOTO Error Path: Sanctions Match
   --> IF isPEP = true OR riskScore = HIGH: GOTO Alternative Path: High-Risk Manual Review
6. [System] riskScore = LOW or MEDIUM, no sanctions, no PEP
7. [Backend] Updates KycVerification within $transaction:
   - amlScreeningDone = true, amlRiskScore (numeric: LOW=10, MEDIUM=50, HIGH=90)
   - isPep, sanctionsMatch stored
   - status = APPROVED, verifiedAt = now()
8. [Backend] Updates User.kycStatus = APPROVED
9. [System] Sends email notification: "Sua verificacao foi aprovada"
10. [UI] On next page load/navigation: KYCStatusBanner disappears
11. [UI] KYC-gated features (cap table, shareholders, transactions, etc.) are unlocked

POSTCONDITION: KYC status = APPROVED, User.kycStatus = APPROVED, all features unlocked
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
4. [Backend] Returns { status: "IN_PROGRESS", completedSteps: ["cpf"], remainingSteps: ["document", "facial", "aml"], attemptCount: 1, canResubmit: false, rejectionReason: null }
5. [Frontend] Sends POST /api/v1/kyc/start
6. [Backend] Detects existing IN_PROGRESS KYC, returns current session (no new record created)
7. [UI] KYCWizard resumes at Step 2 (first incomplete step based on completedSteps)
8. [UI] Stepper shows: CPF [complete] --> Documento [active] --> ...
9. [Continue from step 29 of Happy Path]

POSTCONDITION: User continues KYC from where they left off
```

### Alternative Path: High-Risk Manual Review (PEP Detected)

```
PRECONDITION: KYC verification steps complete, AML screening detects PEP or HIGH risk
ACTOR: System (Bull queue processor), Compliance team
TRIGGER: AML screening job processes, Verifik returns isPEP = true or riskScore = HIGH

1. [System] AML screening job runs via KycProcessor
2. [Backend] Verifik returns AML result: { isPEP: true, riskScore: "HIGH", sanctionsMatch: false }
3. [Backend] Updates KycVerification within $transaction:
   - amlScreeningDone = true, isPep = true, amlRiskScore = 90 (HIGH)
   - status stays PENDING_REVIEW (not auto-approved or rejected)
4. [Backend] User.kycStatus remains PENDING_REVIEW
5. [System] Sends Slack WARNING alert to compliance channel
6. [System] Sends email to compliance team with PEP details
7. [UI] User sees KYCStatusBanner: "Sua verificacao esta sendo analisada" (PENDING_REVIEW)
8. [Manual] Compliance team reviews PEP details in admin dashboard
9. [Manual] Compliance team approves or rejects KYC
   --> IF approved: Backend sets status = APPROVED, verifiedAt = now(), email sent to user
   --> IF rejected: Backend sets status = REJECTED, rejectedAt = now(), rejectionReason set, email sent to user

POSTCONDITION: KYC manually reviewed by compliance team
SIDE EFFECTS: Slack alert, compliance email, audit logs
```

### Error Path: CPF Verification Failure

```
PRECONDITION: User is on Step 1 of KYC wizard, status = IN_PROGRESS
ACTOR: Authenticated user
TRIGGER: User submits CPF data that fails validation

1. [UI] User enters CPF and clicks "Verificar CPF"
2. [Frontend] Sends POST /api/v1/kyc/verify-cpf with { cpf, dateOfBirth, fullName }
3. [Backend] Returns error:
   --> KYC_CPF_INVALID (422): CPF Modulo 11 checksum fails or all-same-digit CPF
   --> KYC_CPF_DUPLICATE (422): CPF blind index already linked to another user
   --> KYC_CPF_NOT_FOUND (404): CPF not in Receita Federal (Verifik returns 404)
   --> KYC_CPF_DOB_MISMATCH (422): Date of birth from Verifik doesn't match provided value
   --> KYC_VERIFIK_UNAVAILABLE (502): Verifik service down, timeout, or auth error
   --> KYC_INVALID_STATUS (422): KYC not in IN_PROGRESS status
4. [UI] Loading spinner stops, fields re-enabled
5. [UI] Error displayed:
   --> 422 (CPF_INVALID/DOB_MISMATCH): inline error text below the relevant field
   --> 404 (CPF_NOT_FOUND): inline error "CPF nao encontrado na Receita Federal"
   --> 422 (CPF_DUPLICATE): inline error "Este CPF ja esta associado a outra conta" (suggests contacting support)
   --> 502 (VERIFIK_UNAVAILABLE): error toast "Servico de verificacao indisponivel. Tente novamente."
6. [UI] User corrects data and retries (no limit on CPF step retries within a session)

POSTCONDITION: User remains on Step 1, can retry
```

### Error Path: Document Upload Failure

```
PRECONDITION: User is on Step 2 of KYC wizard, status = IN_PROGRESS, cpfVerified = true
ACTOR: Authenticated user
TRIGGER: Document upload or validation fails

1. [UI] User attempts to upload document
2. [Frontend] Client-side validation:
   --> File too large (> 10 MB): inline error "Arquivo excede o tamanho maximo de 10 MB"
   --> Wrong format: inline error "Formato nao suportado. Use PNG ou JPEG."
   --> STOP (file not sent to server)
3. [Frontend] If client-side valid, sends POST /api/v1/kyc/upload-document (multipart)
4. [Backend] Returns error:
   --> KYC_STEP_ORDER_VIOLATION (422): CPF step not completed
   --> KYC_FILE_TOO_LARGE (422): file exceeds 10 MB (server-side check)
   --> KYC_FILE_INVALID_FORMAT (422): magic bytes do not match PNG or JPEG
   --> KYC_S3_UNAVAILABLE (422): KYC S3 bucket not configured
   --> KYC_DOCUMENT_UNREADABLE (422): Verifik OCR failed or authenticity < 50%
   --> KYC_DOCUMENT_EXPIRED (422): document expiry date is in the past
   --> KYC_VERIFIK_UNAVAILABLE (502): Verifik service down or timeout
5. [UI] Error displayed inline below upload area
6. [UI] Tips displayed for better photo (flat surface, no glare, all corners visible)
7. [UI] User removes file via "Remover" link and uploads a new one

POSTCONDITION: User remains on Step 2, can retry with better document
```

### Error Path: Facial Recognition Failure

```
PRECONDITION: User is on Step 3 of KYC wizard, status = IN_PROGRESS, cpfVerified = true, documentS3Key exists
ACTOR: Authenticated user
TRIGGER: Facial recognition or liveness check fails

1. Camera permission scenarios:
   --> [Camera denied by browser]: error card with instructions to enable camera
       User must grant permission via browser settings, then refresh
   --> [Camera not available (no hardware)]: error message, cannot proceed on this device

2. Face detection scenarios:
   --> [Face not detected in frame]: guidance overlay "Rosto nao detectado. Posicione-se no centro."
       User adjusts position and retries (no server call)

3. Server-side failure (POST /api/v1/kyc/verify-face):
   --> [KYC_STEP_ORDER_VIOLATION (422)]: prerequisite steps (CPF or document) not completed
   --> [KYC_FILE_INVALID_FORMAT (422)]: selfie is not a valid PNG or JPEG
   --> [KYC_S3_UNAVAILABLE (422)]: KYC S3 bucket not configured
   --> [KYC_LIVENESS_CHECK_FAILED (422)]: liveness score < 80 (service-level threshold)
       "Verificacao de vivacidade falhou. Tente novamente."
       User clicks "Refazer" to retake photo
   --> [KYC_FACE_MATCH_FAILED (422)]: face match score < 85 (service-level threshold)
       "O rosto nao corresponde ao documento enviado."
       User clicks "Refazer" to retake photo (ensure same person as document)
   --> [KYC_VERIFIK_UNAVAILABLE (502)]: Verifik service down or timeout
   --> [Network error]: error toast + retry button

4. [UI] User retries capture (unlimited retries within the step)

POSTCONDITION: User remains on Step 3, can retry
NOTE: Two layers of face verification thresholds exist:
  - Verifik-level (internal): liveness >= 70, matchScore >= 80
  - KYC service-level (stricter): liveness >= 80, matchScore >= 85
  Verifik may pass but the KYC service may still reject if scores are between the thresholds.
```

### Error Path: KYC Rejection and Resubmission

```
PRECONDITION: KYC submitted, status = REJECTED or RESUBMISSION_REQUIRED, attemptCount < 3
ACTOR: Authenticated user
TRIGGER: User sees rejection on KYCStatusBanner, clicks "Refazer Verificacao"

1. [System] Backend sets KYC status = REJECTED with rejectionReason and rejectedAt
2. [System] Sends email notification with rejection reason
3. [System] Queues audit event: KYC_REJECTED
4. [UI] User logs in or navigates to dashboard
5. [UI] KYCStatusBanner shows: "Verificacao recusada: [reason]. Tente novamente." (red styling)
6. [UI] "Refazer Verificacao" button visible
7. [UI] User clicks "Refazer Verificacao"
8. [Frontend] Navigates to /kyc
9. [Frontend] GET /api/v1/kyc/status
10. [Backend] Returns { status: "REJECTED", completedSteps: [...], remainingSteps: [...], attemptCount: 1, canResubmit: true, rejectionReason: "..." }
11. [Frontend] Sends POST /api/v1/kyc/start
12. [Backend] Detects REJECTED/RESUBMISSION_REQUIRED status:
    - Resets all verification flags (cpfVerified, documentType, faceVerified, amlScreeningDone, etc.)
    - Increments attemptCount, generates new sessionId
    - Sets status = IN_PROGRESS, User.kycStatus = IN_PROGRESS
    - Performed within $transaction
13. [UI] KYCWizard starts from Step 1 (all steps must be redone)
14. [Continue from step 10 of Happy Path]

POSTCONDITION: KYC resubmitted, status = IN_PROGRESS, attemptCount incremented
```

### Error Path: Maximum Attempts Exceeded

```
PRECONDITION: KYC status = REJECTED, attemptCount >= 3
ACTOR: Authenticated user
TRIGGER: User tries to restart KYC after 3 failed attempts

1. [UI] User clicks "Refazer Verificacao" on KYCStatusBanner
2. [Frontend] Navigates to /kyc
3. [Frontend] GET /api/v1/kyc/status
4. [Backend] Returns { status: "REJECTED", completedSteps: [...], remainingSteps: [...], attemptCount: 3, canResubmit: false, rejectionReason: "..." }
5. [Frontend] canResubmit = false, renders error screen
   OR
   [Frontend] Sends POST /api/v1/kyc/start
6. [Backend] Returns 422 KYC_MAX_ATTEMPTS_EXCEEDED with { maxAttempts: 3, currentAttempts: 3 }
7. [UI] Error screen: "Numero maximo de tentativas excedido"
8. [UI] Message: "Entre em contato com o suporte para assistencia"
9. [UI] Support email link provided

POSTCONDITION: User cannot resubmit KYC, must contact support
```

### Error Path: Sanctions Match (Auto-Reject)

```
PRECONDITION: KYC verification steps complete, AML screening running via Bull queue
ACTOR: System (KycProcessor)
TRIGGER: Verifik AML screening detects sanctions match

1. [System] AML screening job runs via KycProcessor.handleAmlScreening()
2. [Backend] Verifik returns { sanctionsMatch: true, riskScore: "HIGH", isPEP: ... }
3. [Backend] Updates KycVerification within $transaction:
   - amlScreeningDone = true, sanctionsMatch = true, amlRiskScore = 90
   - status = REJECTED, rejectedAt = now()
   - rejectionReason = "Sanctions list match detected" (internal, generic message to user)
4. [Backend] Updates User.kycStatus = REJECTED
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
       PENDING_REVIEW: "Sua verificacao esta em analise" (no button, just text)
7. [UI] User clicks action button (if available)
8. [Frontend] Navigates to /kyc

POSTCONDITION: User redirected to KYC flow; page remains blocked until KYC approved
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 3-4 | Resume or start fresh | GET /api/v1/kyc/status | Happy | Determine starting point based on status |
| 3 | Already approved | status = APPROVED | Redirect | Redirect to /dashboard |
| 3 | Under review | status = PENDING_REVIEW | Redirect | Redirect to /kyc/status |
| 3 | Max attempts exceeded | attemptCount >= 3 | Error | Show max attempts error |
| 5-6 | Start/resume session | POST /api/v1/kyc/start | Happy | Create or resume KYC session |
| 5 | Already approved (start) | POST start when APPROVED | Error | 409 KYC_ALREADY_APPROVED |
| 5 | Under review (start) | POST start when PENDING_REVIEW | Error | 409 KYC_UNDER_REVIEW |
| 5 | Max attempts (start) | POST start when attemptCount >= 3 | Error | 422 KYC_MAX_ATTEMPTS_EXCEEDED |
| 13 | CPF Modulo 11 check | Client-side validation | Error | Inline error "CPF invalido" |
| 15 | Age check | dateOfBirth indicates < 18 | Error | Inline error "Deve ter 18 anos" |
| 19 | CPF format + checksum | Backend Modulo 11 validation | Error | 422 KYC_CPF_INVALID |
| 20 | CPF unique | Blind index (HMAC-SHA256) lookup | Error | 422 KYC_CPF_DUPLICATE |
| 21 | Verifik available | Verifik API responds | Error/Happy | 502 KYC_VERIFIK_UNAVAILABLE or continue |
| 21 | CPF exists in Receita Federal | Verifik lookup returns 404 | Error | 404 KYC_CPF_NOT_FOUND |
| 22 | DOB matches CPF | Verifik DOB cross-check | Error | 422 KYC_CPF_DOB_MISMATCH |
| 32 | File type valid | Client-side check | Error | Inline error if not PNG/JPEG |
| 32 | File size valid | Client-side check (< 10 MB) | Error | Inline error if too large |
| 40 | File format (server) | Magic bytes check (JPEG/PNG) | Error | 422 KYC_FILE_INVALID_FORMAT |
| 40 | File size (server) | Buffer length > 10 MB | Error | 422 KYC_FILE_TOO_LARGE |
| 41 | Step order | cpfVerified must be true | Error | 422 KYC_STEP_ORDER_VIOLATION |
| 42 | S3 bucket available | KYC bucket configured | Error | 422 KYC_S3_UNAVAILABLE |
| 44 | Document readable | Verifik OCR, authenticity >= 50% | Error | 422 KYC_DOCUMENT_UNREADABLE |
| 46 | Document not expired | Parsed expiry date < now | Error | 422 KYC_DOCUMENT_EXPIRED |
| 52 | Camera permission | Browser prompt | Error | Error card if denied |
| 63 | Step order (face) | cpfVerified + documentS3Key exist | Error | 422 KYC_STEP_ORDER_VIOLATION |
| 66 | Liveness check | Score < 80 (service-level) | Error | 422 KYC_LIVENESS_CHECK_FAILED |
| 66 | Face match | Score < 85 (service-level) | Error | 422 KYC_FACE_MATCH_FAILED |
| AML | Sanctions match | Verifik AML sanctionsMatch=true | Error | Auto-reject, generic reason |
| AML | PEP or HIGH risk | Verifik AML isPEP=true or riskScore=HIGH | Alternative | Stays PENDING_REVIEW, manual review |
| AML | Low/medium risk | No sanctions, no PEP, riskScore LOW/MEDIUM | Happy | Auto-approve |

---

## State Transitions

### KYCVerification Entity

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| KYCVerification | -- | (not exists) | record created | POST /api/v1/kyc/start (first time) |
| KYCVerification | status | -- (new record) | `IN_PROGRESS` | POST /api/v1/kyc/start (new KYC session, attemptCount=1) |
| KYCVerification | cpfVerified | false | true | POST /api/v1/kyc/verify-cpf succeeds |
| KYCVerification | documentS3Key | null | `kyc/{userId}/{type}-front-{uuid}` | POST /api/v1/kyc/upload-document succeeds |
| KYCVerification | documentType | null | RG/CNH/RNE | POST /api/v1/kyc/upload-document succeeds |
| KYCVerification | faceVerified | false | true | POST /api/v1/kyc/verify-face succeeds |
| KYCVerification | faceMatchScore | null | Decimal (0-100) | POST /api/v1/kyc/verify-face succeeds |
| KYCVerification | livenessScore | null | Decimal (0-100) | POST /api/v1/kyc/verify-face succeeds |
| KYCVerification | selfieS3Key | null | `kyc/{userId}/selfie-{uuid}` | POST /api/v1/kyc/verify-face succeeds |
| KYCVerification | status | `IN_PROGRESS` | `PENDING_REVIEW` | Face verification succeeds, AML queued |
| KYCVerification | amlScreeningDone | false | true | AML screening job completes |
| KYCVerification | amlRiskScore | null | Decimal (10/50/90) | AML screening job completes |
| KYCVerification | isPep | false | true/false | AML screening job completes |
| KYCVerification | sanctionsMatch | false | true/false | AML screening job completes |
| KYCVerification | status | `PENDING_REVIEW` | `APPROVED` | AML low/medium risk, no PEP, no sanctions |
| KYCVerification | verifiedAt | null | now() | AML auto-approve |
| KYCVerification | status | `PENDING_REVIEW` | `REJECTED` | AML sanctions match or manual rejection |
| KYCVerification | rejectedAt | null | now() | KYC rejected |
| KYCVerification | rejectionReason | null | string | KYC rejected |
| KYCVerification | status | `REJECTED`/`RESUBMISSION_REQUIRED` | `IN_PROGRESS` | POST /api/v1/kyc/start (resubmission) |
| KYCVerification | attemptCount | N | N+1 | POST /api/v1/kyc/start (resubmission, all verification flags reset) |

### User Entity

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| User | kycStatus | `NOT_STARTED` | `IN_PROGRESS` | POST /api/v1/kyc/start (first time) |
| User | cpfEncrypted | null | KMS-encrypted bytes | POST /api/v1/kyc/verify-cpf succeeds |
| User | cpfBlindIndex | null | HMAC-SHA256 hex (32 chars) | POST /api/v1/kyc/verify-cpf succeeds |
| User | kycStatus | `IN_PROGRESS` | `PENDING_REVIEW` | Face verification succeeds |
| User | kycStatus | `PENDING_REVIEW` | `APPROVED` | AML auto-approve or manual approval |
| User | kycStatus | `PENDING_REVIEW` | `REJECTED` | AML sanctions match or manual rejection |
| User | kycStatus | `REJECTED` | `IN_PROGRESS` | POST /api/v1/kyc/start (resubmission) |

### Valid Status Transitions

```
NOT_STARTED --> IN_PROGRESS (via POST /api/v1/kyc/start)
IN_PROGRESS --> PENDING_REVIEW (via POST /api/v1/kyc/verify-face success)
PENDING_REVIEW --> APPROVED (via AML auto-approve or manual approval)
PENDING_REVIEW --> REJECTED (via AML sanctions match or manual rejection)
REJECTED --> IN_PROGRESS (via POST /api/v1/kyc/start, if attemptCount < 3)
RESUBMISSION_REQUIRED --> IN_PROGRESS (via POST /api/v1/kyc/start, if attemptCount < 3)
```

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

## Error Codes

Complete list of error codes thrown by the KYC module, as implemented in the backend:

| Error Code | HTTP Status | messageKey | Thrown By | Description |
|------------|-------------|------------|-----------|-------------|
| `KYC_ALREADY_APPROVED` | 409 | `errors.kyc.alreadyApproved` | `startVerification` | User tries to start KYC when already APPROVED |
| `KYC_UNDER_REVIEW` | 409 | `errors.kyc.underReview` | `startVerification` | User tries to start KYC when PENDING_REVIEW |
| `KYC_MAX_ATTEMPTS_EXCEEDED` | 422 | `errors.kyc.maxAttemptsExceeded` | `startVerification` | attemptCount >= 3, cannot restart |
| `KYC_CPF_INVALID` | 422 | `errors.kyc.cpfInvalid` | `verifyCpf` | CPF Modulo 11 checksum fails |
| `KYC_CPF_DUPLICATE` | 422 | `errors.kyc.cpfDuplicate` | `verifyCpf` | CPF blind index already linked to another user |
| `KYC_CPF_NOT_FOUND` | 404 | `errors.kyc.cpfNotFound` | `VerifikService.verifyCpf` | CPF not found in Receita Federal (Verifik 404) |
| `KYC_CPF_DOB_MISMATCH` | 422 | `errors.kyc.cpfDobMismatch` | `VerifikService.verifyCpf` | Date of birth does not match registry |
| `KYC_STEP_ORDER_VIOLATION` | 422 | `errors.kyc.stepOrderViolation` | `uploadDocument`, `verifyFace` | Prerequisite step(s) not completed |
| `KYC_FILE_TOO_LARGE` | 422 | `errors.kyc.fileTooLarge` | `validateImageBuffer` | File exceeds 10 MB |
| `KYC_FILE_INVALID_FORMAT` | 422 | `errors.kyc.fileInvalidFormat` | `validateImageBuffer` | Magic bytes do not match PNG or JPEG |
| `KYC_S3_UNAVAILABLE` | 422 | `errors.kyc.s3Unavailable` | `uploadDocument`, `verifyFace` | KYC S3 bucket not configured |
| `KYC_DOCUMENT_UNREADABLE` | 422 | `errors.kyc.documentUnreadable` | `VerifikService.verifyDocument` | OCR failed or authenticity < 50% |
| `KYC_DOCUMENT_EXPIRED` | 422 | `errors.kyc.documentExpired` | `uploadDocument` | Document expiry date is in the past |
| `KYC_LIVENESS_CHECK_FAILED` | 422 | `errors.kyc.livenessCheckFailed` | `verifyFace` (service-level) or `VerifikService.matchFace` | Liveness score below threshold |
| `KYC_FACE_MATCH_FAILED` | 422 | `errors.kyc.faceMatchFailed` | `verifyFace` (service-level) or `VerifikService.matchFace` | Face match score below threshold |
| `KYC_VERIFIK_UNAVAILABLE` | 502 | `errors.kyc.verifikUnavailable` | `VerifikService.*` | Verifik API not configured, timeout, network error, or server error |
| `KYC_INVALID_STATUS` | 422 | `errors.kyc.invalidStatus` | `ensureStatus` | KYC not in expected status for this operation |

### Verification Thresholds

Two layers of thresholds are applied for face verification:

| Layer | Face Match | Liveness | Note |
|-------|-----------|----------|------|
| Verifik (internal) | >= 80 | >= 70 | Checked inside VerifikService |
| KYC Service (stricter) | >= 85 | >= 80 | Checked in KycService.verifyFace() |

If Verifik passes but the service-level threshold fails, the user still gets a rejection.

---

## Audit Events

Events wired via `@Auditable()` decorator on KycController endpoints (captured by AuditInterceptor on success):

| Action | Resource Type | Actor Type | Endpoint | Trigger |
|--------|-------------|------------|----------|---------|
| `KYC_STARTED` | KycVerification | USER | `POST /api/v1/kyc/start` | User initiates or restarts KYC flow |
| `KYC_CPF_VERIFIED` | KycVerification | USER | `POST /api/v1/kyc/verify-cpf` | CPF validation succeeds |
| `KYC_DOCUMENT_UPLOADED` | KycVerification | USER | `POST /api/v1/kyc/upload-document` | Document uploaded and OCR passed |
| `KYC_FACE_VERIFIED` | KycVerification | USER | `POST /api/v1/kyc/verify-face` | Facial recognition passes |

Events from the audit-logging spec catalog (not yet wired via programmatic `AuditService.log()`):

| Action | Resource Type | Actor Type | Trigger |
|--------|-------------|------------|---------|
| `KYC_CPF_FAILED` | KycVerification | SYSTEM | CPF validation fails |
| `KYC_FACE_FAILED` | KycVerification | SYSTEM | Facial recognition fails |
| `KYC_AML_SCREENED` | KycVerification | SYSTEM | AML screening completed |
| `KYC_APPROVED` | KycVerification | SYSTEM | KYC verification approved |
| `KYC_REJECTED` | KycVerification | SYSTEM | KYC verification rejected |

> **Note**: The four controller-endpoint audit events (`KYC_STARTED`, `KYC_CPF_VERIFIED`, `KYC_DOCUMENT_UPLOADED`, `KYC_FACE_VERIFIED`) are wired and fire automatically. The remaining SYSTEM events (`KYC_CPF_FAILED`, `KYC_FACE_FAILED`, `KYC_AML_SCREENED`, `KYC_APPROVED`, `KYC_REJECTED`) need to be wired via programmatic `AuditService.log()` calls in the KycService and KycProcessor.

---

## Email Notifications

| Event | Recipient | Subject (PT-BR) | Subject (EN) |
|-------|-----------|-----------------|-------------|
| KYC Approved | User | Verificacao de identidade aprovada | Identity verification approved |
| KYC Rejected | User | Verificacao de identidade recusada | Identity verification rejected |
| PEP Detected | Compliance team | [ALERTA] PEP detectado - Revisao necessaria | [ALERT] PEP detected - Review required |
| Sanctions Match | Compliance team | [CRITICO] Correspondencia em lista de sancoes | [CRITICAL] Sanctions list match |

---

## Implementation Notes

### Endpoints (as implemented)

| Endpoint | Method | Auth | Rate Limit | Description |
|----------|--------|------|-----------|-------------|
| `/api/v1/kyc/start` | POST | Required | write (30/min) | Create or resume KYC session |
| `/api/v1/kyc/verify-cpf` | POST | Required | write (30/min) | Verify CPF via Verifik + encrypt |
| `/api/v1/kyc/upload-document` | POST | Required | upload (10/min) | Upload identity document (multipart) |
| `/api/v1/kyc/verify-face` | POST | Required | upload (10/min) | Facial recognition + liveness (multipart) |
| `/api/v1/kyc/status` | GET | Required | read (100/min) | Get current KYC status |

### Async Processing

- **Bull Queue**: `kyc-aml` with job name `screen-aml`
- **Processor**: `KycProcessor.handleAmlScreening()` delegates to `KycService.processAmlScreening()`
- **Retries**: 3 attempts with exponential backoff (1s, 2s, 4s)
- **AML data**: CPF decrypted from KMS at processing time; user's full name from profile

### File Validation

- **Accepted formats**: PNG (magic: `89 50 4E 47`) and JPEG (magic: `FF D8 FF`) only. No PDF support for document uploads.
- **Document max size**: 10 MB (enforced by Multer limits + service-level buffer check)
- **Selfie max size**: 5 MB (enforced by Multer limits)
- **EXIF stripping**: Not yet implemented (deferred to future iteration -- sharp not imported)

### Document Type Mapping

| DTO Value | Prisma Enum | Notes |
|-----------|-------------|-------|
| `RG` | `DocumentType.RG` | Brazilian national ID |
| `CNH` | `DocumentType.CNH` | Brazilian driver's license |
| `RNE` | `DocumentType.RNE` | Foreign resident card |
| `PASSPORT` | `DocumentType.RNE` | Mapped to RNE in database (closest foreign doc type) |

### Name Similarity Check

The document upload step performs a soft name comparison using Levenshtein distance:
- Compares the CPF-registered name against the OCR-extracted document name
- Threshold: 0.9 (90% similarity)
- Names are normalized: lowercase, accents removed, whitespace collapsed
- Below threshold: logs a WARNING but does NOT reject (deferred to manual review during PENDING_REVIEW)

### Encryption Details

- **CPF encryption**: AES-256-GCM via AWS KMS (`EncryptionService.encrypt()`). If KMS unavailable, CPF stored without application-level encryption (warning logged).
- **CPF blind index**: HMAC-SHA256 with `BLIND_INDEX_KEY` env var, truncated to 32 hex chars. Enables duplicate detection without decryption.
- **S3 documents**: SSE-KMS encryption on the KYC bucket. Presigned URLs generated with 15-minute expiry for face match step.

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
