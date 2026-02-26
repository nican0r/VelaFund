# KYC & Identity Verification Specification

**Topic of Concern**: Identity verification using Verifik for Brazilian regulatory compliance

**One-Sentence Description**: The system verifies startup founder identities during onboarding through Verifik using CPF validation, document verification, facial recognition, and AML screening.

---

## Overview

Navia integrates with Verifik, an AI-powered identity verification platform specialized for Latin American markets, to comply with Brazilian KYC/AML regulations (BCB Circular 3.978/2020 and Resolucao BCB 119/2021). The system performs multi-level verification including CPF validation against government databases, document authentication, facial biometric matching, liveness detection, and AML screening against PEP and sanctions lists.

**Regulatory Context**: Brazilian fintech platforms handling financial instruments must verify customer identities using CPF cross-checks with Receita Federal, facial recognition, and AML screening. Brazil has 5x higher deepfake fraud rates than the US, making liveness detection critical.

**Who must complete KYC**: Startup founders during onboarding. KYC is a mandatory step between personal info collection and company creation. Founders cannot create a company or access platform features without approved KYC.

> **Note**: Company-level CNPJ validation is covered in [company-cnpj-validation.md](./company-cnpj-validation.md). This spec focuses on personal identity verification (CPF, documents, facial recognition, AML).

---

## User Stories

### US-1: Founder KYC During Onboarding
**As a** startup founder who just signed up
**I want to** complete identity verification as part of the onboarding flow
**So that** I can create my company and manage my cap table

### US-2: CPF Validation
**As a** founder completing KYC
**I want to** enter my CPF and date of birth for instant validation
**So that** the system can verify my identity against government records

### US-3: Document Upload
**As a** founder completing KYC
**I want to** upload my identity document (RG, CNH, or Passport)
**So that** the system can extract and verify my identity information via OCR

### US-4: Facial Recognition
**As a** founder completing KYC
**I want to** take a selfie for facial recognition
**So that** the system can verify I am the person in the identity document

### US-5: KYC Status Visibility
**As a** founder who submitted KYC
**I want to** see the verification status and any rejection reasons
**So that** I can take corrective action if needed

### US-6: KYC Retry After Rejection
**As a** founder whose KYC was rejected
**I want to** retry the verification with corrected documents
**So that** I can complete onboarding and start using the platform

---

## Functional Requirements

### FR-1: KYC Timing
- Founders MUST complete KYC during onboarding, after personal info and before company creation
- The onboarding flow is: Personal Info -> KYC Verification -> Company Setup -> Done
- KYC cannot be skipped -- it is mandatory for all founders
- Founders cannot proceed to company creation until KYC status = "approved"

### FR-2: Verification Steps
- All founders MUST complete Standard verification level:
  - CPF validation against Receita Federal database
  - Identity document upload and OCR extraction
  - Facial recognition with liveness detection
  - AML screening (PEP, sanctions lists)

### FR-3: CPF Verification
- System MUST validate CPF format (XXX.XXX.XXX-XX)
- System MUST verify CPF against Receita Federal via Verifik API
- System MUST validate date of birth matches CPF registry
- System MUST store certified CPF data returned by Verifik

### FR-4: Document Verification
- System MUST accept: RG (Registro Geral), CNH (Driver's License), Passport
- System MUST perform OCR extraction of document data
- System MUST validate document authenticity (detect tampering)
- System MUST compare extracted data with CPF validation results
- System MUST store encrypted document images in S3

### FR-5: Facial Recognition & Liveness
- System MUST capture single-image selfie from user
- System MUST perform 3D liveness detection (passive)
- System MUST detect spoofing attempts (photos of photos, masks, deepfakes)
- System MUST compare selfie with document photo (face matching)
- System MUST require minimum match score of 85%
- System MUST store encrypted selfie in S3

### FR-6: AML Screening
- System MUST screen users against PEP (Politically Exposed Persons) databases
- System MUST check OFAC, Interpol, DEA sanctions lists
- System MUST check Brazilian SIMIT (fines and sanctions system)
- System MUST calculate risk score (LOW, MEDIUM, HIGH)
- System MUST flag high-risk users for manual review

### FR-7: KYC Status Management
- System MUST track KYC status: not_started, in_progress, pending_review, approved, rejected, resubmission_required
- System MUST allow maximum 3 resubmission attempts
- System MUST provide rejection reasons for failed verifications
- System MUST notify users via email of status changes

### FR-8: Webhook Integration
- System MUST accept webhook callbacks from Verifik
- System MUST verify webhook signatures
- System MUST update KYC status based on async verification results

---

## Data Models

### KYCVerification Entity

```typescript
interface KYCVerification {
  id: string;                       // UUID
  userId: string;                   // Foreign key to User

  // CPF Verification
  cpfNumber: string;                // Masked: XXX.XXX.XXX-XX
  cpfVerified: boolean;
  cpfVerifiedAt: Date | null;
  cpfData: {                        // Certified data from Receita Federal
    fullName: string;
    dateOfBirth: string;
    cpfStatus: 'active' | 'inactive';
  };

  // Document Verification
  documentType: 'RG' | 'CNH' | 'PASSPORT';
  documentNumber: string;
  documentVerified: boolean;
  documentVerifiedAt: Date | null;
  documentS3Url: string;            // Encrypted storage URL
  documentData: {                   // OCR extracted data
    fullName: string;
    documentNumber: string;
    issueDate: string;
    expiryDate: string;
  };

  // Facial Verification
  faceVerified: boolean;
  faceVerifiedAt: Date | null;
  faceMatchScore: number;           // 0-100
  livenessScore: number;            // 0-100
  selfieS3Url: string;              // Encrypted storage URL

  // AML Screening
  amlScreeningDone: boolean;
  amlScreeningAt: Date | null;
  amlRiskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  isPep: boolean;
  sanctionsMatch: boolean;
  amlScreeningData: {
    watchlistMatches: string[];
    pepDetails: object | null;
  };

  // Verifik Integration
  verifikSessionId: string;
  verifikSignature: string;         // Certified signature

  // Status
  status: KYCStatus;
  submittedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  attemptCount: number;             // Max 3 attempts

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

### KYCStatus Enum

```typescript
enum KYCStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RESUBMISSION_REQUIRED = 'resubmission_required'
}
```

---

## API Endpoints

### POST /api/v1/kyc/start
**Description**: Start KYC verification session

**Request**: No body (authenticated user)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "status": "in_progress",
    "requiredSteps": ["cpf", "document", "facial", "aml"]
  }
}
```

---

### POST /api/v1/kyc/verify-cpf
**Description**: Verify CPF with Verifik

**Request**:
```json
{
  "cpf": "012.345.678-01",
  "dateOfBirth": "17/02/2002"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "verified": true,
    "cpfData": {
      "fullName": "MATEO VERIFIK",
      "dateOfBirth": "2002-02-17",
      "cpfStatus": "active"
    },
    "verifikSignature": "certified_hash"
  }
}
```

**Error Responses**:
- `400 Bad Request` -- Invalid CPF format (`KYC_CPF_INVALID`, messageKey: `errors.kyc.cpfInvalid`)
- `404 Not Found` -- CPF not found in Receita Federal database (`KYC_CPF_NOT_FOUND`, messageKey: `errors.kyc.cpfNotFound`)
- `422 Unprocessable Entity` -- Date of birth mismatch (`KYC_CPF_DOB_MISMATCH`, messageKey: `errors.kyc.cpfDobMismatch`)

---

### POST /api/v1/kyc/upload-document
**Description**: Upload identity document for OCR and validation

**Request**: `multipart/form-data`
```
documentType: "RG" | "CNH" | "PASSPORT"
documentNumber: "string"
file: <image file>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "verified": true,
    "extractedData": {
      "fullName": "MATEO VERIFIK",
      "documentNumber": "12.345.678-9",
      "issueDate": "2020-01-15",
      "expiryDate": "2030-01-15"
    },
    "documentUrl": "s3://encrypted/path"
  }
}
```

**Error Responses**:
- `400 Bad Request` -- Invalid file type, only JPG, PNG, PDF accepted (`KYC_DOCUMENT_INVALID`, messageKey: `errors.kyc.documentInvalid`)
- `413 Payload Too Large` -- File exceeds 10MB
- `422 Unprocessable Entity` -- Document unreadable or tampered (`KYC_DOCUMENT_INVALID`, messageKey: `errors.kyc.documentInvalid`)

---

### POST /api/v1/kyc/verify-face
**Description**: Submit selfie for facial recognition and liveness detection

**Request**: `multipart/form-data`
```
selfie: <image file>
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "verified": true,
    "faceMatchScore": 92,
    "livenessScore": 98,
    "selfieUrl": "s3://encrypted/path"
  }
}
```

**Error Responses**:
- `400 Bad Request` -- Invalid image format (`KYC_DOCUMENT_INVALID`, messageKey: `errors.kyc.documentInvalid`)
- `422 Unprocessable Entity` -- Liveness check failed, deepfake detected (`KYC_LIVENESS_CHECK_FAILED`, messageKey: `errors.kyc.livenessCheckFailed`)
- `422 Unprocessable Entity` -- Face match score below threshold, < 85% (`KYC_FACE_MATCH_FAILED`, messageKey: `errors.kyc.faceMatchFailed`)

---

### GET /api/v1/kyc/status
**Description**: Get current KYC verification status

**Request**: No body (authenticated user)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "status": "in_progress",
    "completedSteps": ["cpf", "document"],
    "remainingSteps": ["facial", "aml"],
    "attemptCount": 1,
    "canResubmit": true
  }
}
```

---

### POST /api/v1/kyc/webhook/verifik
**Description**: Webhook endpoint for Verifik async verification results. This endpoint follows the Verifik webhook contract, not the Navia API envelope format.

**Request**:
```json
{
  "session_id": "uuid",
  "event_type": "verification_completed",
  "status": "approved",
  "data": { ... },
  "signature": "webhook_signature"
}
```

**Response** (200 OK):
```json
{
  "received": true
}
```

---

## Business Rules

### BR-1: KYC Timing
- KYC is required during onboarding for all startup founders
- Onboarding flow: Personal Info -> KYC -> Company Setup -> Done
- KYC cannot be skipped -- founders must complete it to proceed
- Founders cannot create a company until KYC status = "approved"

### BR-2: Verification Order
- CPF verification MUST be completed first
- Document verification MUST be completed after CPF
- Facial recognition MUST be completed after document upload
- AML screening runs automatically after facial recognition

### BR-3: Attempt Limits
- Users have maximum 3 attempts to complete KYC
- After 3 failed attempts, manual review is required
- Attempt counter resets to 0 after successful verification

### BR-4: Data Matching Requirements
- Name on CPF MUST match name on identity document (fuzzy matching allowed)
- Date of birth on CPF MUST match document
- Face match score MUST be >= 85%
- Liveness score MUST be >= 80%

### BR-5: Founder CPF Prerequisite
- Founder's personal CPF must be verified before company creation
- One company can have multiple verified founders/admins

### BR-6: High-Risk Handling
- Users with aml_risk_score = "HIGH" are flagged for manual review
- Users identified as PEP are not automatically rejected, but flagged
- Sanctions matches result in automatic rejection

### BR-7: Data Retention
- KYC documents stored for 5 years minimum (Brazilian compliance)
- Users can request data deletion after 5-year retention period
- Encrypted documents stored in AWS S3 Sao Paulo region (LGPD compliance)

---

## User Flows

### Flow 1: Founder KYC During Onboarding (Happy Path)

```
PRECONDITION: Founder completed Personal Info step, KYC not started
ACTOR: Startup founder

1. Founder completes Personal Info step in onboarding wizard
2. Onboarding wizard advances to KYC step
3. System calls POST /api/v1/kyc/start
4. System shows Step 1: CPF Verification
5. Founder enters CPF and date of birth
6. System calls POST /api/v1/kyc/verify-cpf
7. Verifik validates CPF against Receita Federal (< 3 seconds)
8. System displays CPF validated, auto-fills full name from Verifik response
9. System shows Step 2: Document Upload
10. Founder selects document type (RG/CNH/Passport)
11. Founder uploads document photo(s)
12. System calls POST /api/v1/kyc/upload-document
13. Verifik performs OCR and validation (< 5 seconds)
14. System displays document validated
15. System shows Step 3: Facial Recognition
16. Founder clicks "Take Selfie"
17. Browser requests camera permission
18. Founder captures selfie
19. System calls POST /api/v1/kyc/verify-face
20. Verifik performs liveness detection and face matching (< 5 seconds)
21. System displays facial verification complete
22. System automatically triggers AML screening (background)
23. System shows "Verification Complete" message
24. System updates KYC status = "approved" (or "pending_review" if AML flags)
25. Onboarding wizard auto-advances to Company Setup step
26. Founder can now create their company

POSTCONDITION: Founder KYC approved, company creation step enabled
```

### Flow 2: KYC Rejection and Resubmission

```
PRECONDITION: Founder submitted KYC, face match score = 72% (below 85% threshold)

1. System sets KYC status = "rejected"
2. System sets rejection_reason = "Facial recognition: Match score below threshold (72%). Please ensure good lighting and clear photo."
3. System sends email notification to founder
4. Founder returns to onboarding and sees KYC rejection status
5. Founder clicks "Retry Verification"
6. System checks attempt_count < 3 (currently 1)
7. System increments attempt_count = 2
8. System resets to the failed step (facial recognition)
9. Founder retakes selfie with better lighting
10. System reprocesses facial recognition
11. Face match score = 91%
12. System updates status = "approved"
13. Onboarding advances to Company Setup

POSTCONDITION: KYC approved on second attempt
```

### Flow 3: High-Risk AML Screening

```
PRECONDITION: Founder completed all KYC steps, AML screening running

1. Verifik AML screening detects PEP match
2. System receives webhook: { is_pep: true, risk_score: "HIGH" }
3. System sets KYC status = "pending_review"
4. System notifies compliance team via email
5. Founder sees "Under Review" status in onboarding
6. Compliance team reviews PEP details
7. Compliance team marks verification as approved (PEP not automatically rejected in Brazil)
8. System updates status = "approved"
9. Founder receives email notification
10. Founder can resume onboarding and create company

POSTCONDITION: High-risk founder manually approved by compliance team
```

---

## Edge Cases & Error Handling

### EC-1: Verifik API Timeout
**Scenario**: Verifik API takes > 30 seconds to respond during CPF verification
**Handling**:
- Frontend shows a loading state. The messageKey `errors.kyc.verificationDelayed` is used for the waiting message.
- Backend retries API call up to 3 times with exponential backoff.
- If all retries fail, return `502 Bad Gateway` with error code `KYC_VERIFIK_UNAVAILABLE` and messageKey `errors.kyc.verifikUnavailable`. Frontend resolves the messageKey and allows user to retry.

### EC-2: Blurry Document Photo
**Scenario**: User uploads document photo that OCR cannot read
**Handling**:
- Return `422 Unprocessable Entity` with error code `KYC_DOCUMENT_INVALID` and messageKey `errors.kyc.documentInvalid`.
- Frontend resolves the messageKey and provides tips for better photo (flat surface, no glare, all corners visible).

### EC-3: Selfie with Mask/Sunglasses
**Scenario**: User submits selfie wearing mask or sunglasses
**Handling**:
- Liveness detection fails.
- Return `422 Unprocessable Entity` with error code `KYC_LIVENESS_CHECK_FAILED` and messageKey `errors.kyc.livenessCheckFailed`. Frontend resolves the messageKey to prompt removing face coverings.

### EC-4: CPF/Document Name Mismatch
**Scenario**: CPF name = "Joao da Silva", Document name = "Joao Silva"
**Handling**:
- Use fuzzy matching with 90% similarity threshold
- If match >= 90%, approve
- If match < 90%, flag for manual review

### EC-5: Minor User (Under 18)
**Scenario**: Date of birth indicates user is under 18 years old
**Handling**:
- Brazilian law requires legal guardian consent for minors
- Set KYC status = "pending_review"
- Request guardian documentation (future enhancement)

### EC-6: Sanctions List Match
**Scenario**: AML screening finds user on OFAC sanctions list
**Handling**:
- Immediately reject KYC.
- Set status = "rejected".
- Return generic messageKey `errors.kyc.verificationFailed` (do NOT disclose sanctions match to user per regulatory requirement).
- Notify compliance team immediately.

### EC-7: Duplicate CPF Across Users
**Scenario**: New user tries to verify CPF already linked to another user
**Handling**:
- Check database for existing CPF blind index.
- If found, return `409 Conflict` with error code `KYC_CPF_DUPLICATE` and messageKey `errors.kyc.cpfDuplicate`.

### EC-8: Expired Identity Document
**Scenario**: OCR detects document expiry date is in the past
**Handling**:
- Reject document verification.
- Return `422 Unprocessable Entity` with error code `KYC_DOCUMENT_EXPIRED` and messageKey `errors.kyc.documentExpired`.

---

## Dependencies

### Internal Dependencies
- **Authentication**: KYC flow requires authenticated user session
- **Onboarding**: KYC is step 2 of the onboarding wizard (after Personal Info, before Company Setup)
- **Company Management**: Company creation is gated by KYC approval
- **Notifications**: KYC status changes trigger email notifications

### External Dependencies
- **Verifik API**: Identity verification service
  - Base URL: https://api.verifik.co/v2/
  - Sandbox: https://api-sandbox.verifik.co/v2/
  - SLA: 99.5% uptime
  - Performance: < 5 seconds per verification step
- **Receita Federal Database**: CPF validation (via Verifik)
- **AWS S3**: Encrypted storage for KYC documents
- **AWS KMS**: Encryption key management

---

## Technical Implementation

### Verifik Service (Backend)

```typescript
// /backend/src/kyc/verifik/verifik.service.ts

import { Injectable, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AppException } from '../../common/exceptions/app.exception';

@Injectable()
export class VerifikService {
  private readonly apiUrl: string;
  private readonly apiToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = this.configService.get('VERIFIK_API_URL');
    this.apiToken = this.configService.get('VERIFIK_API_TOKEN');
  }

  async verifyCPF(cpf: string, dateOfBirth: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/br/cedula`, {
          params: {
            documentType: 'CPF',
            documentNumber: cpf.replace(/\D/g, ''), // Remove formatting
            dateOfBirth: dateOfBirth,
          },
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            Accept: 'application/json',
          },
          timeout: 30000, // 30 seconds
        }),
      );

      return {
        verified: true,
        data: response.data.data,
        signature: response.data.signature,
      };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new AppException(
          'KYC_CPF_NOT_FOUND',
          'errors.kyc.cpfNotFound',
          HttpStatus.NOT_FOUND,
        );
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new AppException(
          'KYC_VERIFIK_UNAVAILABLE',
          'errors.kyc.verifikUnavailable',
          HttpStatus.BAD_GATEWAY,
        );
      }
      throw new AppException(
        'KYC_CPF_INVALID',
        'errors.kyc.cpfInvalid',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  async verifyDocument(file: Buffer, documentType: string) {
    const formData = new FormData();
    formData.append('file', new Blob([file]));
    formData.append('documentType', documentType);

    const response = await firstValueFrom(
      this.httpService.post(`${this.apiUrl}/documents/verify`, formData, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      }),
    );

    return response.data;
  }

  async verifyFace(selfieBuffer: Buffer, documentImageUrl: string) {
    const formData = new FormData();
    formData.append('selfie', new Blob([selfieBuffer]));
    formData.append('documentImageUrl', documentImageUrl);

    const response = await firstValueFrom(
      this.httpService.post(`${this.apiUrl}/face/match`, formData, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      }),
    );

    return {
      verified: response.data.matchScore >= 85,
      faceMatchScore: response.data.matchScore,
      livenessScore: response.data.livenessScore,
    };
  }

  async performAMLScreening(fullName: string, cpf: string, nationality: string) {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.apiUrl}/screening`,
        {
          fullName,
          documentNumber: cpf,
          nationality,
          checkPEP: true,
          checkSanctions: true,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    return {
      riskScore: response.data.riskScore,
      isPEP: response.data.isPEP,
      sanctionsMatch: response.data.sanctionsMatch,
      screeningData: response.data,
    };
  }
}
```

### KYC Guard (Backend)

```typescript
// /backend/src/kyc/guards/kyc-approved.guard.ts

import { Injectable, CanActivate, ExecutionContext, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';

@Injectable()
export class KYCApprovedGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { kycStatus: true },
    });

    if (userRecord.kycStatus !== 'APPROVED') {
      throw new AppException(
        'KYC_REQUIRED',
        'errors.kyc.required',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
```

---

## Security Considerations

### SEC-1: Document Encryption
- All KYC documents MUST be encrypted at rest using AWS KMS
- S3 bucket MUST have private access only (no public URLs)
- Pre-signed URLs MUST expire after 5 minutes
- Access logs MUST be maintained for all document retrievals

### SEC-2: PII Protection
- CPF MUST be masked in frontend displays (XXX.XXX.XXX-XX)
- Full CPF only visible to admin users with specific permission
- KYC data MUST NOT be included in error messages or logs
- Verifik API tokens MUST be stored in environment variables only

### SEC-3: Webhook Security
- Webhook signatures MUST be verified before processing
- Use HMAC SHA-256 for signature validation
- Reject webhooks older than 5 minutes (replay attack prevention)

### SEC-4: Rate Limiting
- Limit KYC submission attempts: 3 per step per 24 hours
- Limit API calls: 10 per minute per user
- Implement CAPTCHA after 2 failed verification attempts

### SEC-5: LGPD Compliance
- Obtain explicit consent before collecting KYC data
- Provide data deletion mechanism (after 5-year retention)
- Store data in AWS Sao Paulo region
- Implement data access logs for audit trail

---

## Success Criteria

### Performance
- CPF verification completes in < 3 seconds (p95)
- Document OCR completes in < 5 seconds (p95)
- Facial recognition completes in < 5 seconds (p95)
- Total KYC flow completes in < 2 minutes (p95)

### Accuracy
- CPF validation success rate > 99%
- Document OCR accuracy > 95%
- Face match false positive rate < 1%
- Liveness detection spoofing prevention > 99%

### Compliance
- 100% of founders complete KYC before company creation
- Zero unauthorized access to KYC-gated features
- Zero data breaches or PII leaks
- 100% LGPD compliance

### User Experience
- KYC completion rate > 90%
- User abandonment rate < 10%
- Average time to complete KYC < 5 minutes
- Resubmission rate < 5%

---

## Open Questions

1. What is the manual review SLA for high-risk users?
2. Should we support KYC for minors (under 18) with guardian consent?
3. How do we handle users with foreign documents (non-Brazilian)?
4. Should we implement KYC expiration (re-verification after X years)?

---

## Future Enhancements

- **Video KYC**: Live video call verification for high-value transactions
- **Enhanced Due Diligence (EDD)**: Additional checks for high-risk users
- **International KYC**: Support for non-Brazilian identity documents
- **AI Fraud Detection**: Machine learning models to detect sophisticated fraud attempts

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [authentication.md](./authentication.md) | KYC requires authenticated user; KYC status stored on User entity; onboarding flow integrates KYC step |
| [company-management.md](./company-management.md) | Company creation is gated by KYC approval |
| [company-cnpj-validation.md](./company-cnpj-validation.md) | Covers all CNPJ validation (company-level verification via Verifik); this spec defers to it for CNPJ flows |
| [api-standards.md](../.claude/rules/api-standards.md) | KYC endpoints follow `/api/v1/kyc/*` global path pattern |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: `KYC_REQUIRED`, `KYC_CPF_INVALID`, `KYC_CPF_NOT_FOUND`, `KYC_CPF_DOB_MISMATCH`, `KYC_DOCUMENT_INVALID`, `KYC_DOCUMENT_EXPIRED`, `KYC_FACE_MATCH_FAILED`, `KYC_LIVENESS_CHECK_FAILED`, `KYC_AML_HIGH_RISK`, `KYC_PEP_DETECTED`, `KYC_SANCTIONS_MATCH`, `KYC_MAX_ATTEMPTS_EXCEEDED`, `KYC_VERIFIK_UNAVAILABLE` |
| [security.md](../.claude/rules/security.md) | PII handling for CPF, biometric data; KYC document encryption via AWS KMS; LGPD consent for KYC data collection |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: `KYC_STARTED`, `KYC_CPF_VERIFIED`, `KYC_CPF_FAILED`, `KYC_DOCUMENT_UPLOADED`, `KYC_FACE_VERIFIED`, `KYC_FACE_FAILED`, `KYC_AML_SCREENED`, `KYC_APPROVED`, `KYC_REJECTED` |

---

# Frontend Specification

> The sections below define the frontend architecture, component specifications, user flows, UI states, and i18n keys for the KYC verification feature. The backend specification above remains the source of truth for API contracts, data models, and business rules.
>
> **Build status**: Backend is 100% done. Frontend is 0% built. This section is the blueprint for frontend implementation.

---

## Frontend Architecture

### Integration with Onboarding Flow

KYC is embedded in the onboarding wizard as step 2 of 3:

```
Onboarding Wizard
  Step 1: Personal Info       (existing -- built)
  Step 2: KYC Verification    (THIS SPEC -- not built)
  Step 3: Company Setup       (existing -- built)
```

The onboarding wizard (`OnboardingWizard` in `app/(onboarding)/onboarding/page.tsx`) manages the overall step state. When step 1 (Personal Info) completes, the wizard advances to step 2 (KYC), which renders the KYC sub-wizard internally. When KYC is approved, the onboarding wizard advances to step 3 (Company Setup).

Additionally, a standalone KYC status page exists for users who return after submitting KYC (e.g., while AML review is pending).

### Page Routes

| Route | Description | Layout | Auth Required |
|-------|-------------|--------|---------------|
| `/onboarding` | Onboarding wizard (KYC is step 2 within this wizard) | Auth layout (centered card, gray-50 bg) | Yes |
| `/kyc/status` | KYC status page (post-submission, for returning users) | Auth layout (centered card, gray-50 bg) | Yes |

### Component Tree

```
app/(onboarding)/
  onboarding/
    page.tsx                          -- OnboardingWizard (existing, add KYC step)

app/(kyc)/
  layout.tsx                          -- KYC layout (centered, no sidebar)
  kyc/status/
    page.tsx                          -- KYCStatusPage

components/kyc/
  kyc-verification-step.tsx           -- KYC sub-wizard container (step 2 of onboarding)
  kyc-progress-stepper.tsx            -- Visual step indicator for KYC sub-steps
  cpf-verification-step.tsx           -- Sub-step 1: CPF input + validation
  document-upload-step.tsx            -- Sub-step 2: Document type + file upload
  facial-recognition-step.tsx         -- Sub-step 3: Camera + liveness + selfie
  kyc-completion-step.tsx             -- Sub-step 4: Processing/success state
  kyc-status-banner.tsx               -- Persistent banner on dashboard pages (for pending/rejected)
  kyc-status-badge.tsx                -- Small badge for profile/settings
  kyc-status-card.tsx                 -- Card for /kyc/status page

components/ui/
  cpf-input.tsx                       -- Reusable masked CPF input
```

---

## Component Specifications

### 1. `KYCVerificationStep` -- KYC Sub-Wizard (Onboarding Step 2)

- **File**: `components/kyc/kyc-verification-step.tsx`
- **Role**: Container for the entire KYC flow, rendered as step 2 within the `OnboardingWizard`
- **Props**: `onSuccess: () => void` (called when KYC is approved, advances onboarding to step 3)
- **Layout**: Rendered within the onboarding card, no separate card wrapping needed
- **Manages sub-step state**: CPF -> Document Upload -> Facial Recognition -> Processing/Complete
- **Progress stepper** (KYCProgressStepper) shows KYC-specific sub-steps
- **Auto-advances** on sub-step completion
- **Can resume** at last incomplete sub-step if user returns (calls `GET /api/v1/kyc/status` on mount)
- **State**:
  ```typescript
  type KYCSubStep = 'cpf' | 'document' | 'facial' | 'processing';

  interface KYCVerificationStepState {
    currentSubStep: KYCSubStep;
    cpfVerified: boolean;
    cpfData: CpfVerificationResult | null;
    documentUploaded: boolean;
    faceVerified: boolean;
  }
  ```
- **On mount**: calls `GET /api/v1/kyc/status` to determine `completedSteps` and resumes at the first incomplete sub-step. If status is `APPROVED`, calls `onSuccess()` immediately. If status is `PENDING_REVIEW`, shows processing/waiting state.

### 2. `KYCProgressStepper` -- Visual step indicator for KYC sub-steps

- **File**: `components/kyc/kyc-progress-stepper.tsx`
- **Props**: `currentStep: KYCSubStep`, `completedSteps: KYCSubStep[]`
- **4 sub-steps**: "CPF" -> "Documento" -> "Reconhecimento Facial" -> "Concluido"
- **Visual pattern** (same as OnboardingStepper):
  - **Active**: `blue-600` circle with step number, `navy-900` label text
  - **Complete**: `green-600` circle with check icon (Lucide `Check`), `gray-500` label text
  - **Future**: `gray-300` circle with step number, `gray-400` label text
- **Connector lines** between steps: `gray-200` default, `green-600` when preceding step is complete
- **Responsive**: horizontal on desktop (>= `md`), vertical on mobile

### 3. `CPFVerificationStep` -- Sub-step 1: CPF input

- **File**: `components/kyc/cpf-verification-step.tsx`
- **Props**: `onSuccess: (cpfData: CpfVerificationResult) => void`
- **Fields**:
  - `cpf`: CPFInput component (masked XXX.XXX.XXX-XX), required, client-side Modulo 11 validation
  - `dateOfBirth`: date input (DD/MM/YYYY format), required, must be in the past, user must be 18+
  - `fullName`: text input, auto-filled from Verifik response on success (read-only after CPF verification), placeholder "Preenchido automaticamente apos verificacao do CPF"
- **Submit**: `POST /api/v1/kyc/verify-cpf` with `{ cpf, dateOfBirth }`
- **On success**: auto-fills `fullName` from `cpfData.fullName`, calls `onSuccess(cpfData)` to advance to sub-step 2
- **Error handling**:
  - `KYC_CPF_MISMATCH` (422): inline error "Os dados informados nao correspondem ao CPF"
  - `KYC_CPF_DUPLICATE` / `KYC_CPF_ALREADY_USED` (409): inline error "Este CPF ja esta associado a outra conta"
  - `KYC_CPF_INVALID` (422): inline error "CPF invalido"
  - `KYC_CPF_NOT_FOUND` (404): inline error "CPF nao encontrado na base da Receita Federal"
  - `KYC_VERIFIK_UNAVAILABLE` (502): error toast "Servico de verificacao indisponivel. Tente novamente."
- **Client-side validation**: CPF Modulo 11 checksum runs on blur, date of birth validates age >= 18

### 4. `CPFInput` -- Reusable masked CPF input

- **File**: `components/ui/cpf-input.tsx`
- **Props**: extends standard input props, adds `onValidChange: (isValid: boolean) => void`
- **Mask**: XXX.XXX.XXX-XX (auto-formats as user types, strips non-digits)
- **Client-side validation**: Modulo 11 algorithm for both CPF verification digits
- **Styling**: same as standard input (design-system.md section 6.4)
- **Helper text**: "Digite o CPF -- sera formatado automaticamente"

### 5. `DocumentUploadStep` -- Sub-step 2: Document upload

- **File**: `components/kyc/document-upload-step.tsx`
- **Props**: `onSuccess: () => void`
- **Document type selector**: radio group (card style)
  - RG (Registro Geral) -- requires front + back
  - CNH (Carteira Nacional de Habilitacao) -- requires front + back
  - Passport -- requires front only
- **File upload area**: drag-and-drop zone + "Selecionar arquivo" button
  - Accepts: PDF, PNG, JPG, JPEG
  - Max size: 10 MB per file
  - Shows file preview after selection (image thumbnail for images, file icon for PDF)
  - Separate upload areas for front and back (when applicable)
  - Labels: "Frente do documento" / "Verso do documento"
- **Camera capture option**: button "Usar camera" to capture document photo directly (mobile-friendly)
  - Opens device camera via `navigator.mediaDevices.getUserMedia`
  - Shows live viewfinder with document outline overlay
  - Capture button takes photo
  - Preview with "Refazer" or "Usar esta foto" buttons
- **Image preview with retake**: after capture/upload, shows thumbnail with option to retake or remove
- **Submit**: `POST /api/v1/kyc/upload-document` (multipart/form-data)
- **Progress bar** during upload: 4px height, `blue-600` fill, `radius-full`
- **On success**: green check animation + calls `onSuccess()` to advance to sub-step 3
- **Error handling**:
  - Client-side: file type validation, file size validation (< 10 MB)
  - `KYC_DOCUMENT_INVALID` (422): inline error "Documento nao pode ser verificado"
  - `KYC_DOCUMENT_UNREADABLE` (422): inline error "Documento ilegivel. Tente uma foto mais nitida."
  - `KYC_DOCUMENT_EXPIRED` (422): inline error "Documento expirado. Utilize um documento valido."
  - `KYC_FILE_TOO_LARGE` (400): inline error "Arquivo excede o tamanho maximo de 10 MB"
  - `KYC_FILE_INVALID_FORMAT` (400): inline error "Formato nao suportado. Use PDF, PNG, JPG ou JPEG."

### 6. `FacialRecognitionStep` -- Sub-step 3: Selfie / liveness check

- **File**: `components/kyc/facial-recognition-step.tsx`
- **Props**: `onSuccess: () => void`
- **Flow**:
  1. Request camera permission (browser prompt via `navigator.mediaDevices.getUserMedia`)
  2. Show live camera feed in a circular frame (280px diameter)
  3. Instructions: "Posicione seu rosto no centro do circulo"
  4. Liveness instructions cycle: "Vire a cabeca para a esquerda", "Vire a cabeca para a direita", "Sorria"
  5. Auto-capture when conditions are met, or manual "Capturar" button
  6. Show captured image for review: "Ficou bom?"
  7. "Refazer" (ghost button) or "Enviar" (primary button)
- **Submit**: `POST /api/v1/kyc/verify-face` with captured image as Blob
- **On success**: calls `onSuccess()` to advance to sub-step 4 (processing/completion)
- **Camera states**:
  - Permission Request: browser permission dialog pending
  - Permission Denied: error card with instructions to enable camera in browser settings
  - Camera Active: live video feed in circular frame + instruction text
  - Capturing: instruction overlay ("Vire a cabeca...")
  - Review: captured photo + "Ficou bom?" + Refazer/Enviar buttons
  - Submitting: spinner overlay on captured photo
  - Error: error message + retry button
- **Error handling**:
  - Camera denied: "Acesso a camera necessario" + browser-specific instructions
  - Face not detected: "Rosto nao detectado. Posicione-se no centro do circulo."
  - `KYC_LIVENESS_FAILED` (422): "Verificacao de vivacidade falhou. Tente novamente."
  - `KYC_FACE_MISMATCH` (422): "O rosto nao corresponde ao documento enviado."
  - Network error: error toast + retry

### 7. `KYCCompletionStep` -- Sub-step 4: Processing / Success state

- **File**: `components/kyc/kyc-completion-step.tsx`
- **Props**: `onSuccess: () => void` (called when KYC is approved)
- **Two modes**:

  **Processing mode** (AML screening running):
  - Animated spinner/processing indicator (Lucide `Loader2`, spinning, 48px, `blue-600`)
  - Title: "Analisando seus dados..." (h2, `navy-900`)
  - Subtitle: "A verificacao AML esta em andamento. Isso pode levar alguns segundos." (body, `gray-500`)
  - Polls `GET /api/v1/kyc/status` every 3 seconds
  - When status changes to `APPROVED`: switches to success mode
  - When status changes to `REJECTED`: shows failure state with reason and retry option
  - When status stays `PENDING_REVIEW` for > 30 seconds: shows "longer than expected" message

  **Success mode** (KYC approved):
  - Success illustration: Lucide `CheckCircle2`, 64px, `green-600`
  - Title: "Identidade Verificada!" (h2, `navy-900`)
  - Subtitle: "Sua verificacao foi aprovada. Vamos configurar sua empresa." (body, `gray-500`)
  - Button: "Continuar" (primary, size lg, full width) -> calls `onSuccess()` to advance onboarding to Company Setup
  - Auto-advances after 3 seconds if user doesn't click

  **Failure mode** (KYC rejected):
  - Error illustration: Lucide `XCircle`, 64px, `#DC2626`
  - Title: "Verificacao Nao Aprovada" (h2, `navy-900`)
  - Subtitle: rejection reason from API (body, `gray-500`)
  - Button: "Tentar Novamente" (primary, size lg, full width) -> resets KYC sub-wizard to first failed step
  - "Entrar em contato com o suporte" link (ghost, body-sm)

  **Pending review mode** (manual review needed, e.g., PEP flagged):
  - Info illustration: Lucide `Clock`, 48px, `blue-600`
  - Title: "Em Analise" (h2, `navy-900`)
  - Subtitle: "Sua verificacao requer analise adicional. Voce recebera um e-mail quando for concluida." (body, `gray-500`)
  - Button: "Ir para o Dashboard" (primary, size lg, full width) -> navigates to `/dashboard` (limited access)

### 8. `KYCStatusPage` -- Standalone status page for returning users

- **File**: `app/(kyc)/kyc/status/page.tsx`
- **Purpose**: For users who return to the platform while KYC is pending review or after rejection
- **On mount**: calls `GET /api/v1/kyc/status`
- **Renders**: `KYCStatusCard` within centered layout
- **Redirect logic**:
  - If `APPROVED`: redirect to `/dashboard`
  - If `NOT_STARTED` or `IN_PROGRESS`: redirect to `/onboarding`
  - If `REJECTED` with `canResubmit`: show retry option that navigates to `/onboarding`
  - If `PENDING_REVIEW`: show waiting state

### 9. `KYCStatusCard` -- Status display card

- **File**: `components/kyc/kyc-status-card.tsx`
- **Props**: `status: KYCStatus`, `rejectionReason?: string`, `canResubmit?: boolean`, `attemptCount?: number`
- **Used in**: `/kyc/status` page
- **Visual states**:

  | Status | Icon | Title | Subtitle | Action |
  |--------|------|-------|----------|--------|
  | `PENDING_REVIEW` | `Clock` (blue-600, 48px) | "Verificacao em Analise" | "Estamos analisando seus dados..." | None (auto-polls) |
  | `APPROVED` | `CheckCircle2` (green-600, 48px) | "Identidade Verificada" | "Sua verificacao foi aprovada." | "Ir para o Dashboard" |
  | `REJECTED` (can retry) | `XCircle` (#DC2626, 48px) | "Verificacao Recusada" | rejection reason | "Tentar Novamente" |
  | `REJECTED` (max attempts) | `XCircle` (#DC2626, 48px) | "Verificacao Recusada" | "Tentativas esgotadas." | "Contatar Suporte" |

### 10. `KYCStatusBanner` -- Persistent banner on dashboard pages

- **File**: `components/kyc/kyc-status-banner.tsx`
- **Props**: `kycStatus: KYCStatus`, `rejectionReason?: string`, `onDismiss: () => void`
- **Shown at**: top of dashboard content area (below page header) when KYC is not `APPROVED`
- **Purpose**: For users who reached the dashboard with pending KYC (e.g., after PEP review redirected them to dashboard)
- **States**:

  | KYC Status | Background | Text Color | Left Border | Message | Action |
  |------------|-----------|------------|-------------|---------|--------|
  | `NOT_STARTED` | `cream-100` | `cream-700` | 3px `cream-700` | "Complete a verificacao de identidade para acessar todos os recursos" | "Iniciar Verificacao" (primary sm) |
  | `IN_PROGRESS` | `blue-50` | `blue-600` | 3px `blue-600` | "Verificacao em andamento. Complete as etapas restantes." | "Continuar" (primary sm) |
  | `PENDING_REVIEW` | `blue-50` | `blue-600` | 3px `blue-600` | "Sua verificacao esta sendo analisada. Voce sera notificado em breve." | None |
  | `REJECTED` | `#FEE2E2` | `#991B1B` | 3px `#991B1B` | "Verificacao recusada: {reason}. Tente novamente." | "Refazer Verificacao" (destructive sm) |
  | `APPROVED` | (hidden) | -- | -- | -- | -- |

- **Dismissible**: user can close the banner for the session via ghost X button, reappears on next login
- **Banner hidden** when KYC status is `APPROVED`

### 11. `KYCStatusBadge` -- Small badge showing KYC status

- **File**: `components/kyc/kyc-status-badge.tsx`
- **Props**: `status: KYCStatus`
- **Used in**: profile/settings areas, user dropdown
- **States** (using badge styles from design-system.md section 6.5):

  | Status | Background | Text | Label (PT-BR) | Label (EN) |
  |--------|-----------|------|---------------|------------|
  | `NOT_STARTED` | `gray-100` | `gray-600` | "Nao iniciado" | "Not started" |
  | `IN_PROGRESS` | `cream-100` | `cream-700` | "Em andamento" | "In progress" |
  | `PENDING_REVIEW` | `blue-50` | `blue-600` | "Em analise" | "Under review" |
  | `APPROVED` | `green-100` | `green-700` | "Verificado" | "Verified" |
  | `REJECTED` | `#FEE2E2` | `#991B1B` | "Recusado" | "Rejected" |

- **Size**: caption (12px), weight 500, padding `2px 8px`, `radius-full`

---

## Onboarding Integration

### Modified Onboarding Wizard

The existing `OnboardingWizard` must be updated to include KYC as step 2:

```
Onboarding Stepper:
  Step 1: "Suas Informacoes" (Personal Info)     -- existing
  Step 2: "Verificacao KYC" (KYC Verification)   -- NEW
  Step 3: "Sua Empresa" (Company Setup)           -- existing
```

**OnboardingStepper** updates:
- Add third step label: `onboarding.stepper.step2` = "Verificacao KYC" / "KYC Verification"
- Rename old step 2 to step 3: `onboarding.stepper.step3` = "Sua Empresa" / "Your Company"

**OnboardingWizard** state changes:
```typescript
type OnboardingStep = 'personalInfo' | 'kyc' | 'companySetup';
```

**Flow**:
1. Step 1 (Personal Info) completes -> wizard advances to Step 2 (KYC)
2. Step 2 renders `KYCVerificationStep` component
3. `KYCVerificationStep` manages its own 4 sub-steps internally (CPF, Document, Facial, Processing)
4. When KYC is approved, `KYCVerificationStep` calls `onSuccess()`
5. Wizard advances to Step 3 (Company Setup)

**Resume logic** on wizard mount:
- If user has personal info but KYC is `NOT_STARTED` or `IN_PROGRESS` -> resume at Step 2 (KYC)
- If user has personal info and KYC is `APPROVED` but no company -> resume at Step 3 (Company Setup)
- If user has personal info and KYC is `PENDING_REVIEW` -> show Step 2 with processing/waiting state
- If user has personal info and KYC is `REJECTED` -> show Step 2 with retry option

---

## Frontend User Flows

### Flow 1: Happy Path -- Full KYC Completion During Onboarding

```
Founder completes Personal Info step
  |
  +-- Onboarding wizard advances to Step 2 (KYC)
  |     |
  |     +-- KYCVerificationStep mounts
  |     |     +-- [GET /api/v1/kyc/status] --> determines starting sub-step
  |     |     |
  |     |     +-- [no completed steps] --> Sub-step 1 (CPF)
  |     |     +-- [CPF done] --> Sub-step 2 (Document)
  |     |     +-- [CPF + Document done] --> Sub-step 3 (Facial)
  |     |     +-- [status = APPROVED] --> call onSuccess() immediately
  |     |     +-- [status = PENDING_REVIEW] --> show processing state
  |     |
  |     +-- Sub-step 1: CPF Verification
  |     |     +-- [fills CPF + DOB] --> POST /api/v1/kyc/verify-cpf
  |     |     |     +-- [success] --> auto-fill name, advance to Sub-step 2
  |     |     |     +-- [KYC_CPF_MISMATCH] --> inline error, retry
  |     |     |     +-- [KYC_CPF_DUPLICATE] --> inline error, contact support
  |     |     |     +-- [KYC_CPF_NOT_FOUND] --> inline error, retry
  |     |     |     +-- [KYC_VERIFIK_UNAVAILABLE] --> error toast, retry
  |     |     +-- [client-side CPF invalid] --> inline error on blur
  |     |
  |     +-- Sub-step 2: Document Upload
  |     |     +-- [selects doc type] --> shows upload area(s)
  |     |     +-- [uploads/captures front image] --> preview with retake
  |     |     +-- [uploads/captures back image (if RG/CNH)] --> preview with retake
  |     |     +-- [clicks "Enviar Documentos"] --> POST /api/v1/kyc/upload-document
  |     |           +-- [success] --> advance to Sub-step 3
  |     |           +-- [KYC_DOCUMENT_INVALID] --> inline error, retry
  |     |           +-- [KYC_DOCUMENT_UNREADABLE] --> inline error, tips, retry
  |     |           +-- [KYC_DOCUMENT_EXPIRED] --> inline error
  |     |           +-- [file too large / wrong format] --> client-side inline error
  |     |
  |     +-- Sub-step 3: Facial Recognition
  |     |     +-- [camera granted] --> live feed shows
  |     |     +-- [follows liveness instructions] --> auto-capture
  |     |     +-- [reviews photo] --> "Enviar" or "Refazer"
  |     |     +-- [submits] --> POST /api/v1/kyc/verify-face
  |     |           +-- [success] --> advance to Sub-step 4
  |     |           +-- [KYC_LIVENESS_FAILED] --> guidance, retry
  |     |           +-- [KYC_FACE_MISMATCH] --> error, retry
  |     |
  |     +-- Sub-step 4: Processing / Completion
  |           +-- [shows processing spinner while AML runs]
  |           +-- [polls GET /api/v1/kyc/status every 3s]
  |           +-- [status = APPROVED] --> success state --> auto-advance
  |           +-- [status = REJECTED] --> failure state --> retry option
  |           +-- [status = PENDING_REVIEW > 30s] --> "taking longer" message
  |
  +-- KYCVerificationStep calls onSuccess()
  +-- Onboarding wizard advances to Step 3 (Company Setup)
```

**Step-by-step (detailed):**

```
PRECONDITION: Founder is authenticated, completed Personal Info, KYC not started
ACTOR: Startup founder
TRIGGER: Onboarding wizard advances to Step 2 after Personal Info completion

1.  [UI] OnboardingWizard renders Step 2: KYCVerificationStep
2.  [Frontend] KYCVerificationStep mounts, sends GET /api/v1/kyc/status
3.  [Backend] Returns completedSteps and current status
4.  [UI] KYCVerificationStep renders at first incomplete sub-step
    --> IF all steps complete and status = APPROVED: call onSuccess() immediately
    --> IF status = PENDING_REVIEW: show processing/waiting state
5.  [UI] KYCProgressStepper renders: CPF [active] --> Documento --> Reconhecimento Facial --> Concluido
6.  [UI] CPFVerificationStep renders with CPF and dateOfBirth fields
7.  [UI] Founder enters CPF (auto-masked to XXX.XXX.XXX-XX)
8.  [Frontend] On CPF blur: validates Modulo 11 checksum
    --> IF invalid: shows "CPF invalido" inline error, STOP
9.  [UI] Founder enters date of birth (DD/MM/YYYY)
10. [Frontend] Validates date is in the past and age >= 18
    --> IF under 18: shows "Voce deve ter 18 anos ou mais" inline error, STOP
11. [UI] Founder clicks "Verificar CPF"
12. [Frontend] Sends POST /api/v1/kyc/verify-cpf with { cpf, dateOfBirth }
13. [UI] Button shows loading spinner, fields disabled
14. [Backend] Validates CPF format
    --> IF invalid format: return 400 KYC_CPF_INVALID
15. [Backend] Calls Verifik to validate CPF against Receita Federal
    --> IF Verifik unavailable: return 502 KYC_VERIFIK_UNAVAILABLE
    --> IF CPF not found: return 404 KYC_CPF_NOT_FOUND
16. [Backend] Checks dateOfBirth matches CPF registry
    --> IF mismatch: return 422 KYC_CPF_DOB_MISMATCH / KYC_CPF_MISMATCH
17. [Backend] Checks CPF blind index for duplicates
    --> IF duplicate: return 409 KYC_CPF_DUPLICATE
18. [Backend] Stores encrypted CPF, updates KYC status to IN_PROGRESS
19. [Backend] Returns 200 with verified CPF data (including fullName)
20. [Backend] Queues audit event: KYC_CPF_VERIFIED
21. [UI] Auto-fills fullName field from Verifik response (read-only)
22. [UI] Sub-step 1 shows green check, stepper updates
23. [UI] Auto-advances to Sub-step 2 (DocumentUploadStep)
24. [UI] Stepper: CPF [complete check] --> Documento [active] --> ...
25. [UI] DocumentUploadStep renders with document type radio cards
26. [UI] Founder selects document type (RG, CNH, or Passport)
27. [UI] Upload area for front side appears: dashed border, drag-and-drop zone + camera option
28. [UI] Founder uploads file or captures with camera
29. [Frontend] Validates file type (PDF/PNG/JPG/JPEG) and size (< 10 MB)
    --> IF invalid type: shows "Formato nao suportado" inline error
    --> IF too large: shows "Arquivo excede o tamanho maximo de 10 MB" inline error
30. [UI] Image preview shows with retake/remove option
31. [UI] If RG/CNH: second upload area for back side with "Verso do documento" label
32. [UI] Founder uploads/captures back side (same validation)
33. [UI] Founder clicks "Enviar Documentos"
34. [Frontend] Sends POST /api/v1/kyc/upload-document (multipart/form-data)
35. [UI] Upload progress bar appears (blue-600 fill)
36. [Backend] Receives files, validates MIME type + magic bytes
37. [Backend] Strips EXIF metadata from images (sharp)
38. [Backend] Encrypts and stores in S3 KYC bucket (SSE-KMS)
39. [Backend] Calls Verifik for OCR and document validation
    --> IF document unreadable: return 422 KYC_DOCUMENT_INVALID
    --> IF document expired: return 422 KYC_DOCUMENT_EXPIRED
40. [Backend] Returns 200 with extracted document data
41. [Backend] Queues audit event: KYC_DOCUMENT_UPLOADED
42. [UI] Sub-step 2 shows green check, stepper updates
43. [UI] Auto-advances to Sub-step 3 (FacialRecognitionStep)
44. [UI] Stepper: CPF [check] --> Documento [check] --> Reconhecimento Facial [active] --> ...
45. [UI] FacialRecognitionStep renders, requests camera permission
46. [UI] Browser camera permission dialog appears
    --> IF denied: shows error card "Acesso a camera necessario" + browser instructions, STOP
47. [UI] Live camera feed in 280px circular frame
48. [UI] Instruction text: "Posicione seu rosto no centro do circulo"
49. [UI] Liveness instructions cycle: "Vire a cabeca para a esquerda", "Vire a cabeca para a direita", "Sorria"
50. [UI] Auto-capture when conditions met, or founder clicks "Capturar"
51. [UI] Review screen: captured photo in circle frame
52. [UI] "Ficou bom?" with "Refazer" (ghost) and "Enviar" (primary) buttons
    --> IF "Refazer": return to camera feed (step 47)
53. [UI] Founder clicks "Enviar"
54. [Frontend] Sends POST /api/v1/kyc/verify-face with captured image as Blob
55. [UI] Spinner overlay on captured photo
56. [Backend] Processes facial recognition + liveness check via Verifik
    --> IF liveness fail: return 422 KYC_LIVENESS_CHECK_FAILED
    --> IF face doesn't match document (< 85%): return 422 KYC_FACE_MATCH_FAILED
57. [Backend] Updates KYC status to PENDING_REVIEW
58. [Backend] Triggers AML screening asynchronously
59. [Backend] Returns 200 with face match and liveness scores
60. [Backend] Queues audit events: KYC_FACE_VERIFIED, KYC_AML_SCREENED (async)
61. [UI] Sub-step 3 shows green check, stepper updates
62. [UI] Auto-advances to Sub-step 4 (KYCCompletionStep -- processing mode)
63. [UI] Processing spinner + "Analisando seus dados..."
64. [Frontend] Polls GET /api/v1/kyc/status every 3 seconds
65. [Backend] AML screening completes, status updates to APPROVED
66. [UI] Switches to success mode: "Identidade Verificada!" + green check
67. [UI] "Continuar" button (or auto-advance after 3 seconds)
68. [Frontend] KYCVerificationStep calls onSuccess()
69. [UI] OnboardingWizard advances to Step 3 (Company Setup)

POSTCONDITION: KYC status = APPROVED, onboarding proceeds to Company Setup
SIDE EFFECTS:
  - Audit logs: KYC_STARTED, KYC_CPF_VERIFIED, KYC_DOCUMENT_UPLOADED, KYC_FACE_VERIFIED, KYC_AML_SCREENED, KYC_APPROVED
  - Verifik API calls: CPF validation, document OCR, facial recognition, AML screening
  - S3 uploads: document images (encrypted), selfie (encrypted)
  - Email: founder receives notification on approval
```

### Flow 2: CPF Verification Failure

```
Founder enters CPF data that fails validation
  |
  +-- [client-side] CPF Modulo 11 invalid --> "CPF invalido" inline error
  |
  +-- [POST /api/v1/kyc/verify-cpf returns error]
  |     +-- KYC_CPF_INVALID (400) --> inline error on CPF field
  |     +-- KYC_CPF_NOT_FOUND (404) --> inline error: "CPF nao encontrado"
  |     +-- KYC_CPF_MISMATCH (422) --> inline error: "Dados nao correspondem ao CPF"
  |     +-- KYC_CPF_DUPLICATE (409) --> inline error: "CPF ja associado a outra conta"
  |     +-- KYC_VERIFIK_UNAVAILABLE (502) --> error toast + retry
  |
  +-- Founder corrects data and retries
        --> OR contacts support (for duplicate CPF)
```

### Flow 3: Document Upload Failure

```
Founder attempts to upload document
  |
  +-- [client-side] file too large --> "Arquivo excede o tamanho maximo de 10 MB"
  +-- [client-side] wrong format --> "Formato nao suportado. Use PDF, PNG, JPG ou JPEG"
  +-- [server] upload fails (network) --> error toast + retry button
  +-- [server] KYC_DOCUMENT_INVALID --> inline error "Documento nao pode ser verificado"
  +-- [server] KYC_DOCUMENT_UNREADABLE --> inline error "Documento ilegivel. Tente uma foto mais nitida."
  +-- [server] KYC_DOCUMENT_EXPIRED --> inline error "Documento expirado"
  |
  +-- Founder uploads clearer photo or different document and retries
```

### Flow 4: Facial Recognition Failure

```
Facial recognition sub-step
  |
  +-- [camera denied] --> error card: "Acesso a camera necessario" + browser instructions
  +-- [face not detected] --> "Rosto nao detectado. Posicione-se no centro do circulo."
  +-- [KYC_LIVENESS_FAILED (422)] --> "Verificacao de vivacidade falhou. Tente novamente."
  +-- [KYC_FACE_MISMATCH (422)] --> "O rosto nao corresponde ao documento enviado."
  +-- [network error] --> error toast + retry
  |
  +-- Founder retries (can retake photo unlimited times within the sub-step)
```

### Flow 5: KYC Rejection and Resubmission

```
KYC submitted, processing complete, status = REJECTED
  |
  +-- [KYCCompletionStep shows failure mode]
  |     +-- Shows rejection reason
  |     +-- "Tentar Novamente" button
  |           +-- [Backend checks attemptCount < 3] --> resets to first failed sub-step
  |           +-- [Backend checks attemptCount >= 3] --> blocked, contact support message
  |
  +-- [Alternatively, founder returns later]
  |     +-- Navigates to /onboarding
  |     +-- OnboardingWizard resumes at KYC step
  |     +-- KYCVerificationStep detects REJECTED status
  |     +-- Shows retry option
```

### Flow 6: KYC Pending Review (Manual Review Required)

```
KYC submitted, AML flags PEP match, status = PENDING_REVIEW
  |
  +-- [KYCCompletionStep shows pending review mode]
  |     +-- "Em Analise" title
  |     +-- "Sua verificacao requer analise adicional..."
  |     +-- "Ir para o Dashboard" button --> limited dashboard access
  |
  +-- [Founder on dashboard]
  |     +-- KYCStatusBanner shows "Sua verificacao esta sendo analisada"
  |     +-- Company creation is blocked
  |
  +-- [Later: compliance team approves]
  |     +-- Email notification sent to founder
  |     +-- Founder returns, KYCStatusBanner disappears
  |     +-- Founder can resume onboarding to create company
```

### Flow 7: Resume Incomplete KYC

```
Founder started KYC but left mid-flow
  |
  +-- [returns to /onboarding or /kyc/status]
  |     +-- OnboardingWizard detects KYC step is current
  |     +-- KYCVerificationStep mounts, calls GET /api/v1/kyc/status
  |           |
  |           +-- [completedSteps: []] --> resume at Sub-step 1 (CPF)
  |           +-- [completedSteps: ["cpf"]] --> resume at Sub-step 2 (Document)
  |           +-- [completedSteps: ["cpf", "document"]] --> resume at Sub-step 3 (Facial)
  |           +-- [completedSteps: ["cpf", "document", "facial"]] --> Sub-step 4 (Processing)
  |           +-- [status = APPROVED] --> call onSuccess(), advance to Company Setup
  |           +-- [status = PENDING_REVIEW] --> show processing/waiting state
```

---

## UI States & Error Handling

### KYCVerificationStep States per Sub-Step

| Sub-Step | Idle | Loading | Success | Error |
|----------|------|---------|---------|-------|
| CPF | Form ready, fields enabled | Spinner on button, fields disabled | Green check on step, name auto-filled, auto-advance | Red error text inline below field |
| Document | Upload area ready, radio cards enabled | Upload progress bar, submit disabled | Thumbnails with green check overlay | Error message below upload area + retry |
| Facial | Camera request pending | Camera active, instructions cycling | Photo captured, review screen | Error message + guidance tips + retry |
| Processing | Spinner + "Analisando..." | Polling for status | Success illustration + "Verificada!" | Failure with retry option |

### Camera Step States

| State | Visual | Trigger |
|-------|--------|---------|
| Permission Request | Browser permission dialog | Sub-step 3 mount |
| Permission Denied | Error card: "Acesso a camera necessario" + instructions | User denies camera |
| Camera Active | Live video feed in circular frame + instruction text | Permission granted |
| Capturing | Instruction overlay: "Vire a cabeca..." | Liveness check sequence |
| Review | Captured photo + "Ficou bom?" + Refazer/Enviar buttons | Photo captured |
| Submitting | Spinner overlay on captured photo | "Enviar" clicked |
| Face Error | Error message + retry button | Server returns face/liveness error |

### KYCStatusBanner States

| KYC Status | Banner Style | Message | Action |
|------------|-------------|---------|--------|
| `NOT_STARTED` | `cream-100` bg, `cream-700` text, 3px `cream-700` left border | "Complete a verificacao de identidade para acessar todos os recursos" | "Iniciar Verificacao" (primary sm) |
| `IN_PROGRESS` | `blue-50` bg, `blue-600` text, 3px `blue-600` left border | "Verificacao em andamento. Complete as etapas restantes." | "Continuar" (primary sm) |
| `PENDING_REVIEW` | `blue-50` bg, `blue-600` text, 3px `blue-600` left border | "Sua verificacao esta sendo analisada. Voce sera notificado em breve." | None |
| `REJECTED` | `#FEE2E2` bg, `#991B1B` text, 3px `#991B1B` left border | "Verificacao recusada: {reason}. Tente novamente." | "Refazer Verificacao" (destructive sm) |
| `APPROVED` | (hidden -- banner not rendered) | -- | -- |

### Error Code to UI Mapping

| Error Code | HTTP Status | UI Behavior |
|------------|-------------|-------------|
| `KYC_CPF_INVALID` | 400 | Inline error on CPF field |
| `KYC_CPF_NOT_FOUND` | 404 | Inline error: "CPF nao encontrado na base da Receita Federal" |
| `KYC_CPF_MISMATCH` / `KYC_CPF_DOB_MISMATCH` | 422 | Inline error: "Os dados informados nao correspondem ao CPF" |
| `KYC_CPF_DUPLICATE` / `KYC_CPF_ALREADY_USED` | 409 | Inline error: "Este CPF ja esta associado a outra conta" |
| `KYC_DOCUMENT_INVALID` | 422 | Inline error: "Documento nao pode ser verificado" |
| `KYC_DOCUMENT_UNREADABLE` | 422 | Inline error: "Documento ilegivel. Tente uma foto mais nitida." |
| `KYC_DOCUMENT_EXPIRED` | 422 | Inline error: "Documento expirado. Utilize um documento valido." |
| `KYC_LIVENESS_CHECK_FAILED` | 422 | Inline error + retry: "Verificacao de vivacidade falhou. Tente novamente." |
| `KYC_FACE_MATCH_FAILED` / `KYC_FACE_MISMATCH` | 422 | Inline error: "O rosto nao corresponde ao documento enviado" |
| `KYC_ALREADY_APPROVED` | 409 | Redirect to /dashboard + success toast: "KYC ja aprovado" |
| `KYC_UNDER_REVIEW` | 409 | Show processing/waiting state |
| `KYC_FILE_TOO_LARGE` | 400 | Inline error: "Arquivo excede o tamanho maximo de 10 MB" |
| `KYC_FILE_INVALID_FORMAT` | 400 | Inline error: "Formato nao suportado. Use PDF, PNG, JPG ou JPEG." |
| `KYC_MAX_ATTEMPTS_EXCEEDED` | 422 | Error card: "Numero maximo de tentativas excedido. Entre em contato com o suporte." |
| `KYC_VERIFIK_UNAVAILABLE` | 502 | Error toast: "Servico de verificacao indisponivel. Tente novamente." + retry |

---

## Component Visual Specifications

### KYCVerificationStep Visual Spec (within onboarding card)

| Property | Value |
|----------|-------|
| Layout | Rendered inside the OnboardingWizard card (inherits card styling) |
| KYC sub-stepper | At top of KYC content area, 4 sub-steps, horizontal layout |
| Content area | Below sub-stepper, sub-step-specific content |
| Navigation | Linear flow only -- no back button. Sub-steps can only go forward. |

### CPFVerificationStep Visual Spec

| Property | Value |
|----------|-------|
| Title | `h3`, "Verificacao de CPF" |
| Subtitle | `body-sm`, `gray-500`, "Informe seus dados para verificacao" |
| Field: CPF | CPFInput component, label "CPF", helper text "Digite o CPF -- sera formatado automaticamente" |
| Field: dateOfBirth | Date input, label "Data de Nascimento", format DD/MM/YYYY |
| Field: fullName | Text input, label "Nome Completo", read-only, placeholder "Preenchido automaticamente apos verificacao do CPF", helper text "Nome retornado pela Receita Federal" |
| Submit button | Primary variant, full width, "Verificar CPF" |
| Field spacing | `20px` (5) between fields |
| Error display | `caption` (12px), `#DC2626`, `4px` margin-top below the errored field |

### DocumentUploadStep Visual Spec

| Property | Value |
|----------|-------|
| Title | `h3`, "Upload de Documento" |
| Subtitle | `body-sm`, `gray-500`, "Envie uma foto nitida do seu documento de identificacao" |
| Document type | 3 radio cards (stacked), `radius-md`, `1px gray-200` border, `16px` padding, active: `blue-50` bg + `2px blue-600` border |
| Upload area | Dashed `gray-300` border, `200px` height, `gray-50` bg, `radius-md` |
| Upload icon | Lucide `CloudUpload`, 48px, `gray-400` |
| Upload text | "Arraste o arquivo ou clique para selecionar" (`body-sm`, `gray-500`) |
| Camera button | "Usar camera" secondary button below upload area (Lucide `Camera`, 16px) |
| Format text | "PDF, PNG, JPG ou JPEG -- max 10 MB" (`caption`, `gray-400`) |
| File preview | Image thumbnail (160px width) or PDF file icon + file name + size + "Remover" / "Refazer" links (`blue-600`, `body-sm`) |
| Progress bar | 4px height, `blue-600` fill, `gray-200` track, `radius-full` |
| Front/back labels | `body-sm`, weight 500, `gray-700` |
| Submit button | Primary variant, full width, "Enviar Documentos" |

### FacialRecognitionStep Visual Spec

| Property | Value |
|----------|-------|
| Title | `h3`, "Reconhecimento Facial" |
| Subtitle | `body-sm`, `gray-500`, "Precisamos verificar que voce e a pessoa nos documentos" |
| Camera frame | 280px diameter circle, `3px blue-600` border, overflow hidden |
| Instruction text | `body`, `gray-600`, below camera frame, changes per liveness instruction |
| Capture button | Primary variant, centered below instructions, "Capturar" |
| Review mode | Captured photo in same circle frame + 2 buttons below |
| Retake button | Ghost variant, "Refazer" |
| Submit button | Primary variant, "Enviar" |
| Error state | Circle frame border changes to `3px #DC2626` + error text below |
| Camera denied | Error card: `#FEE2E2` bg, `#991B1B` text, lock icon, instructions |

### KYCCompletionStep Visual Spec

| Property | Value |
|----------|-------|
| Layout | Centered content within card |
| Processing icon | Lucide `Loader2` (spinning), 48px, `blue-600` |
| Processing title | `h2`, `navy-900`, "Analisando seus dados..." |
| Processing subtitle | `body`, `gray-500`, "A verificacao AML esta em andamento..." |
| Success icon | Lucide `CheckCircle2`, 64px, `green-600` |
| Success title | `h2`, `navy-900`, "Identidade Verificada!" |
| Success subtitle | `body`, `gray-500`, max-w 400px, "Sua verificacao foi aprovada. Vamos configurar sua empresa." |
| Success button | Primary variant, size `lg`, full width, "Continuar" |
| Failure icon | Lucide `XCircle`, 64px, `#DC2626` |
| Failure title | `h2`, `navy-900`, "Verificacao Nao Aprovada" |
| Failure button | Primary variant, size `lg`, full width, "Tentar Novamente" |
| Pending icon | Lucide `Clock`, 48px, `blue-600` |
| Pending title | `h2`, `navy-900`, "Em Analise" |
| Pending button | Primary variant, size `lg`, full width, "Ir para o Dashboard" |
| Spacing | 24px between icon and title, 12px between title and subtitle, 32px between subtitle and button |

### KYCStatusBanner Visual Spec

| Property | Value |
|----------|-------|
| Width | Full content area width (not sticky) |
| Position | Top of dashboard content area, below page header |
| Left accent | 3px left border in semantic color |
| Padding | `12px 16px` |
| Border radius | `radius-md` (8px) |
| Layout | Flex row: icon + text on left, action button on right, close button on far right |
| Icon | Lucide icon matching state: `AlertTriangle` (warning), `Info` (info), `XCircle` (error) |
| Text | `body-sm` (13px), semantic color |
| Action button | Size `sm`, variant per state (see states table) |
| Close button | Ghost variant, Lucide `X`, 16px, `gray-400` |

---

## TanStack Query Integration

### Hooks

```typescript
// hooks/use-kyc-status.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface KYCStatusResponse {
  status: KYCStatus;
  completedSteps: string[];
  remainingSteps: string[];
  attemptCount: number;
  canResubmit: boolean;
  rejectionReason?: string;
}

export function useKYCStatus() {
  return useQuery({
    queryKey: ['kyc', 'status'],
    queryFn: () => api.get<KYCStatusResponse>('/api/v1/kyc/status'),
    staleTime: 30_000, // 30 seconds
  });
}
```

```typescript
// hooks/use-kyc-status-polling.ts
// Variant with polling for the processing/completion step
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useKYCStatusPolling(enabled: boolean) {
  return useQuery({
    queryKey: ['kyc', 'status'],
    queryFn: () => api.get<KYCStatusResponse>('/api/v1/kyc/status'),
    refetchInterval: enabled ? 3_000 : false, // Poll every 3 seconds when enabled
    staleTime: 0, // Always refetch when polling
  });
}
```

```typescript
// hooks/use-verify-cpf.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface VerifyCPFInput {
  cpf: string;
  dateOfBirth: string;
}

interface CpfVerificationResult {
  verified: boolean;
  cpfData: {
    fullName: string;
    dateOfBirth: string;
    cpfStatus: 'active' | 'inactive';
  };
  verifikSignature: string;
}

export function useVerifyCPF() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VerifyCPFInput) =>
      api.post<CpfVerificationResult>('/api/v1/kyc/verify-cpf', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc', 'status'] });
    },
  });
}
```

```typescript
// hooks/use-upload-document.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) =>
      api.postFormData('/api/v1/kyc/upload-document', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc', 'status'] });
    },
  });
}
```

```typescript
// hooks/use-verify-face.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface FaceVerificationResult {
  verified: boolean;
  faceMatchScore: number;
  livenessScore: number;
  selfieUrl: string;
}

export function useVerifyFace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) =>
      api.postFormData<FaceVerificationResult>('/api/v1/kyc/verify-face', formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc', 'status'] });
    },
  });
}
```

```typescript
// hooks/use-start-kyc.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useStartKYC() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post('/api/v1/kyc/start', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc', 'status'] });
    },
  });
}
```

### Retry Configuration

```typescript
// KYC mutations should NOT retry on client/business errors
const kycMutationOptions = {
  retry: (failureCount: number, error: ApiError) => {
    // Don't retry auth, validation, or business rule errors
    if ([400, 401, 403, 404, 409, 422].includes(error.statusCode)) {
      return false;
    }
    // Retry server errors up to 2 times
    return failureCount < 2;
  },
};
```

---

## i18n Keys

All user-facing strings use translation keys resolved via `next-intl`. Keys follow the `kyc.*` namespace.

### Onboarding Stepper Keys (updated)

| Key | PT-BR | EN |
|-----|-------|-----|
| `onboarding.stepper.step1` | Suas Informacoes | Your Info |
| `onboarding.stepper.step2` | Verificacao KYC | KYC Verification |
| `onboarding.stepper.step3` | Sua Empresa | Your Company |

### KYC Sub-Wizard Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `kyc.wizard.title` | Verificacao de Identidade | Identity Verification |
| `kyc.stepper.cpf` | CPF | CPF |
| `kyc.stepper.document` | Documento | Document |
| `kyc.stepper.facial` | Reconhecimento Facial | Facial Recognition |
| `kyc.stepper.complete` | Concluido | Complete |

### CPF Step Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `kyc.cpf.title` | Verificacao de CPF | CPF Verification |
| `kyc.cpf.subtitle` | Informe seus dados para verificacao | Enter your details for verification |
| `kyc.cpf.field` | CPF | CPF |
| `kyc.cpf.fieldHelper` | Digite o CPF -- sera formatado automaticamente | Enter CPF -- it will be formatted automatically |
| `kyc.cpf.dateOfBirth` | Data de Nascimento | Date of Birth |
| `kyc.cpf.fullName` | Nome Completo | Full Name |
| `kyc.cpf.fullNamePlaceholder` | Preenchido automaticamente apos verificacao do CPF | Auto-filled after CPF verification |
| `kyc.cpf.fullNameHelper` | Nome retornado pela Receita Federal | Name returned by Receita Federal |
| `kyc.cpf.submit` | Verificar CPF | Verify CPF |

### Document Step Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `kyc.document.title` | Upload de Documento | Document Upload |
| `kyc.document.subtitle` | Envie uma foto nitida do seu documento de identificacao | Upload a clear photo of your ID document |
| `kyc.document.type` | Tipo de Documento | Document Type |
| `kyc.document.typeRg` | RG (Registro Geral) | RG (General Registry) |
| `kyc.document.typeCnh` | CNH (Carteira Nacional de Habilitacao) | CNH (National Driver's License) |
| `kyc.document.typePassport` | Passaporte | Passport |
| `kyc.document.front` | Frente do documento | Front of document |
| `kyc.document.back` | Verso do documento | Back of document |
| `kyc.document.dragDrop` | Arraste o arquivo ou clique para selecionar | Drag file or click to select |
| `kyc.document.useCamera` | Usar camera | Use camera |
| `kyc.document.formats` | PDF, PNG, JPG ou JPEG -- max 10 MB | PDF, PNG, JPG or JPEG -- max 10 MB |
| `kyc.document.remove` | Remover | Remove |
| `kyc.document.retake` | Refazer | Retake |
| `kyc.document.usePhoto` | Usar esta foto | Use this photo |
| `kyc.document.submit` | Enviar Documentos | Submit Documents |

### Facial Recognition Step Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `kyc.facial.title` | Reconhecimento Facial | Facial Recognition |
| `kyc.facial.subtitle` | Precisamos verificar que voce e a pessoa nos documentos | We need to verify you are the person in the documents |
| `kyc.facial.position` | Posicione seu rosto no centro do circulo | Position your face in the center of the circle |
| `kyc.facial.turnLeft` | Vire a cabeca para a esquerda | Turn your head to the left |
| `kyc.facial.turnRight` | Vire a cabeca para a direita | Turn your head to the right |
| `kyc.facial.smile` | Sorria | Smile |
| `kyc.facial.capture` | Capturar | Capture |
| `kyc.facial.review` | Ficou bom? | Does this look good? |
| `kyc.facial.retake` | Refazer | Retake |
| `kyc.facial.submit` | Enviar | Submit |
| `kyc.facial.cameraRequired` | Acesso a camera necessario | Camera access required |
| `kyc.facial.cameraInstructions` | Habilite o acesso a camera nas configuracoes do navegador | Enable camera access in your browser settings |
| `kyc.facial.faceNotDetected` | Rosto nao detectado. Posicione-se no centro do circulo. | Face not detected. Position yourself in the center of the circle. |

### Completion Step Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `kyc.processing.title` | Analisando seus dados... | Analyzing your data... |
| `kyc.processing.subtitle` | A verificacao AML esta em andamento. Isso pode levar alguns segundos. | AML verification is in progress. This may take a few seconds. |
| `kyc.processing.delayed` | A verificacao esta demorando mais que o esperado. Aguarde... | Verification is taking longer than expected. Please wait... |
| `kyc.complete.title` | Identidade Verificada! | Identity Verified! |
| `kyc.complete.subtitle` | Sua verificacao foi aprovada. Vamos configurar sua empresa. | Your verification has been approved. Let's set up your company. |
| `kyc.complete.continue` | Continuar | Continue |
| `kyc.failure.title` | Verificacao Nao Aprovada | Verification Not Approved |
| `kyc.failure.retry` | Tentar Novamente | Try Again |
| `kyc.failure.contactSupport` | Entrar em contato com o suporte | Contact support |
| `kyc.pending.title` | Em Analise | Under Review |
| `kyc.pending.subtitle` | Sua verificacao requer analise adicional. Voce recebera um e-mail quando for concluida. | Your verification requires additional review. You'll receive an email when it's complete. |
| `kyc.pending.goToDashboard` | Ir para o Dashboard | Go to Dashboard |

### Status Banner Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `kyc.banner.notStarted` | Complete a verificacao de identidade para acessar todos os recursos | Complete identity verification to access all features |
| `kyc.banner.notStartedAction` | Iniciar Verificacao | Start Verification |
| `kyc.banner.inProgress` | Verificacao em andamento. Complete as etapas restantes. | Verification in progress. Complete the remaining steps. |
| `kyc.banner.inProgressAction` | Continuar | Continue |
| `kyc.banner.inReview` | Sua verificacao esta sendo analisada. Voce sera notificado em breve. | Your verification is under review. You'll be notified soon. |
| `kyc.banner.rejected` | Verificacao recusada: {reason}. Tente novamente. | Verification rejected: {reason}. Please try again. |
| `kyc.banner.rejectedAction` | Refazer Verificacao | Redo Verification |

### Status Page Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `kyc.statusPage.pendingTitle` | Verificacao em Analise | Verification Under Review |
| `kyc.statusPage.pendingSubtitle` | Estamos analisando seus dados. Voce recebera uma notificacao quando a verificacao for concluida. | We're analyzing your data. You'll receive a notification when verification is complete. |
| `kyc.statusPage.approvedTitle` | Identidade Verificada | Identity Verified |
| `kyc.statusPage.approvedSubtitle` | Sua verificacao foi aprovada. | Your verification has been approved. |
| `kyc.statusPage.approvedAction` | Ir para o Dashboard | Go to Dashboard |
| `kyc.statusPage.rejectedTitle` | Verificacao Recusada | Verification Rejected |
| `kyc.statusPage.rejectedRetry` | Tentar Novamente | Try Again |
| `kyc.statusPage.maxAttempts` | Tentativas esgotadas. Entre em contato com o suporte. | Attempts exhausted. Please contact support. |
| `kyc.statusPage.contactSupport` | Contatar Suporte | Contact Support |

### Status Badge Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `kyc.status.notStarted` | Nao iniciado | Not started |
| `kyc.status.inProgress` | Em andamento | In progress |
| `kyc.status.inReview` | Em analise | Under review |
| `kyc.status.approved` | Verificado | Verified |
| `kyc.status.rejected` | Recusado | Rejected |

### Error Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `errors.kyc.cpfInvalid` | CPF invalido | Invalid CPF |
| `errors.kyc.cpfNotFound` | CPF nao encontrado na base da Receita Federal | CPF not found in Receita Federal database |
| `errors.kyc.cpfMismatch` | Os dados informados nao correspondem ao CPF | The provided data does not match the CPF |
| `errors.kyc.cpfDobMismatch` | Data de nascimento nao corresponde ao CPF | Date of birth does not match CPF |
| `errors.kyc.cpfAlreadyUsed` | Este CPF ja esta associado a outra conta | This CPF is already associated with another account |
| `errors.kyc.cpfDuplicate` | Este CPF ja esta associado a outra conta | This CPF is already associated with another account |
| `errors.kyc.documentInvalid` | Documento nao pode ser verificado | Document could not be verified |
| `errors.kyc.documentUnreadable` | Documento ilegivel. Tente uma foto mais nitida. | Document unreadable. Try a clearer photo. |
| `errors.kyc.documentExpired` | Documento expirado. Utilize um documento valido. | Document expired. Use a valid document. |
| `errors.kyc.livenessCheckFailed` | Verificacao de vivacidade falhou. Tente novamente. | Liveness check failed. Please try again. |
| `errors.kyc.faceMatchFailed` | O rosto nao corresponde ao documento enviado | The face does not match the uploaded document |
| `errors.kyc.faceMismatch` | O rosto nao corresponde ao documento enviado | The face does not match the uploaded document |
| `errors.kyc.fileTooLarge` | Arquivo excede o tamanho maximo de 10 MB | File exceeds the maximum size of 10 MB |
| `errors.kyc.fileInvalidFormat` | Formato nao suportado. Use PDF, PNG, JPG ou JPEG. | Unsupported format. Use PDF, PNG, JPG or JPEG. |
| `errors.kyc.verifikUnavailable` | Servico de verificacao indisponivel. Tente novamente. | Verification service unavailable. Please try again. |
| `errors.kyc.alreadyApproved` | Verificacao KYC ja aprovada | KYC verification already approved |
| `errors.kyc.underReview` | Verificacao KYC em analise | KYC verification under review |
| `errors.kyc.maxAttemptsExceeded` | Numero maximo de tentativas excedido. Entre em contato com o suporte. | Maximum number of attempts exceeded. Please contact support. |
| `errors.kyc.required` | Verificacao de identidade necessaria para acessar este recurso | Identity verification required to access this feature |
| `errors.kyc.verificationFailed` | Verificacao falhou. Tente novamente. | Verification failed. Please try again. |
| `errors.kyc.verificationDelayed` | A verificacao esta demorando mais que o esperado. Aguarde... | Verification is taking longer than expected. Please wait... |
| `errors.kyc.ageMinimum` | Voce deve ter 18 anos ou mais | You must be 18 years or older |
