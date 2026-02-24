# KYC & Identity Verification Specification

**Topic of Concern**: Identity verification using Verifik for Brazilian regulatory compliance

**One-Sentence Description**: The system verifies user identities through Verifik using CPF validation, document verification, facial recognition, and AML screening.

---

## Overview

Navia integrates with Verifik, an AI-powered identity verification platform specialized for Latin American markets, to comply with Brazilian KYC/AML regulations (BCB Circular 3.978/2020 and Resolução BCB 119/2021). The system performs multi-level verification including CPF validation against government databases, document authentication, facial biometric matching, liveness detection, and AML screening against PEP and sanctions lists.

**Regulatory Context**: Brazilian fintech platforms handling financial instruments must verify customer identities using CPF cross-checks with Receita Federal, facial recognition, and AML screening. Brazil has 5x higher deepfake fraud rates than the US, making liveness detection critical.

> **Note**: Company-level CNPJ validation is covered in [company-cnpj-validation.md](./company-cnpj-validation.md). This spec focuses on personal identity verification (CPF, documents, facial recognition, AML).

---

## User Stories

### US-1: Admin User KYC (Limited Access)
**As an** admin user who just signed up
**I want to** access the dashboard and view settings before completing KYC
**So that** I can explore the platform while preparing my identity documents

**But** I cannot create a cap table until KYC is approved

### US-2: Admin KYC Before Cap Table Creation
**As an** admin user ready to create my first cap table
**I want to** complete CPF verification, document upload, and facial recognition
**So that** I can create a compliant cap table for my company

### US-3: Investor/Employee Immediate KYC
**As an** investor or employee user who just signed up
**I want to** be immediately redirected to KYC verification
**So that** I can complete compliance requirements before accessing the platform

### US-4: CPF Validation
**As a** user completing KYC
**I want to** enter my CPF and date of birth for instant validation
**So that** the system can verify my identity against government records

### US-5: Document Upload
**As a** user completing KYC
**I want to** upload my identity document (RG, CNH, or RNE)
**So that** the system can extract and verify my identity information via OCR

### US-6: Facial Recognition
**As a** user completing KYC
**I want to** take a selfie for facial recognition
**So that** the system can verify I am the person in the identity document

### US-7: KYC Status Visibility
**As a** user who submitted KYC
**I want to** see the verification status and any rejection reasons
**So that** I can take corrective action if needed

---

## Functional Requirements

### FR-1: KYC Timing by User Type
- Admin users MUST be able to access dashboard after signup without KYC
- Admin users MUST complete KYC before creating a cap table
- Investor users MUST complete KYC immediately after signup before platform access
- Employee users MUST complete KYC immediately after signup before platform access

### FR-2: Verification Levels
- All users MUST complete Standard verification level:
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
- System MUST accept: RG (Registro Geral), CNH (Driver's License), RNE (Foreign ID)
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
  documentType: 'RG' | 'CNH' | 'RNE';
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
- `400 Bad Request` — Invalid CPF format (`KYC_CPF_INVALID`, messageKey: `errors.kyc.cpfInvalid`)
- `404 Not Found` — CPF not found in Receita Federal database (`KYC_CPF_NOT_FOUND`, messageKey: `errors.kyc.cpfNotFound`)
- `422 Unprocessable Entity` — Date of birth mismatch (`KYC_CPF_DOB_MISMATCH`, messageKey: `errors.kyc.cpfDobMismatch`)

---

### POST /api/v1/kyc/upload-document
**Description**: Upload identity document for OCR and validation

**Request**: `multipart/form-data`
```
documentType: "RG" | "CNH" | "RNE"
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
- `400 Bad Request` — Invalid file type, only JPG, PNG, PDF accepted (`KYC_DOCUMENT_INVALID`, messageKey: `errors.kyc.documentInvalid`)
- `413 Payload Too Large` — File exceeds 10MB
- `422 Unprocessable Entity` — Document unreadable or tampered (`KYC_DOCUMENT_INVALID`, messageKey: `errors.kyc.documentInvalid`)

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
- `400 Bad Request` — Invalid image format (`KYC_DOCUMENT_INVALID`, messageKey: `errors.kyc.documentInvalid`)
- `422 Unprocessable Entity` — Liveness check failed, deepfake detected (`KYC_LIVENESS_CHECK_FAILED`, messageKey: `errors.kyc.livenessCheckFailed`)
- `422 Unprocessable Entity` — Face match score below threshold, < 85% (`KYC_FACE_MATCH_FAILED`, messageKey: `errors.kyc.faceMatchFailed`)

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
    "verificationLevel": "none",
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

### BR-1: KYC Gating by User Type
- Admin users can access dashboard immediately after signup
- Admin users CANNOT create cap table until KYC status = "approved"
- Investor/Employee users CANNOT access any dashboard feature until KYC status = "approved"

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
- Face match score MUST be ≥ 85%
- Liveness score MUST be ≥ 80%

### BR-5: Admin CPF Prerequisite
- Admin user's personal CPF must be verified before company creation
- One company can have multiple verified admins

### BR-6: High-Risk Handling
- Users with aml_risk_score = "HIGH" are flagged for manual review
- Users identified as PEP are not automatically rejected, but flagged
- Sanctions matches result in automatic rejection

### BR-7: Data Retention
- KYC documents stored for 5 years minimum (Brazilian compliance)
- Users can request data deletion after 5-year retention period
- Encrypted documents stored in AWS S3 São Paulo region (LGPD compliance)

---

## User Flows

### Flow 1: Admin User KYC (Before Cap Table Creation)

```
PRECONDITION: Admin user is logged in, has not completed KYC

1. Admin navigates to "Create Cap Table" page
2. System checks KYC status = "not_started"
3. System displays KYC requirement modal
4. Admin clicks "Start KYC Verification"
5. System redirects to /kyc/verification
6. System shows Step 1: CPF Verification
7. Admin enters CPF and date of birth
8. System calls POST /api/v1/kyc/verify-cpf
9. Verifik validates CPF against Receita Federal (< 3 seconds)
10. System displays CPF validated ✓
11. System shows Step 2: Document Upload
12. Admin selects document type (RG/CNH/RNE)
13. Admin uploads document photo
14. System calls POST /api/v1/kyc/upload-document
15. Verifik performs OCR and validation (< 5 seconds)
16. System displays document validated ✓
17. System shows Step 3: Facial Recognition
18. Admin clicks "Take Selfie"
19. Browser requests camera permission
20. Admin captures selfie
21. System calls POST /api/v1/kyc/verify-face
22. Verifik performs liveness detection and face matching (< 5 seconds)
23. System displays facial verification complete ✓
24. System automatically triggers AML screening (background)
25. System shows "Verification Complete" message
26. System updates KYC status = "approved"
27. System redirects to cap table creation form
28. Admin can now create cap table

For CNPJ validation flow, see [company-cnpj-validation.md](./company-cnpj-validation.md)

POSTCONDITION: Admin KYC approved, cap table creation enabled
```

### Flow 2: Investor User KYC (Immediate After Signup)

```
PRECONDITION: Investor just completed Privy authentication

1. System creates user account
2. System detects user role = "investor"
3. System immediately redirects to /kyc/verification (cannot skip)
4. System shows KYC requirement explanation
5. User clicks "Start Verification"
6. [Steps 6-25 same as Admin Flow above]
26. System updates KYC status = "approved"
27. System displays "Verification Complete! Welcome to Navia"
28. System redirects to investor dashboard
29. User can now access platform features

POSTCONDITION: Investor KYC approved, full platform access granted
```

### Flow 3: KYC Rejection and Resubmission

```
PRECONDITION: User submitted KYC, face match score = 72% (below 85% threshold)

1. System sets KYC status = "rejected"
2. System sets rejection_reason = "Facial recognition: Match score below threshold (72%). Please ensure good lighting and clear photo."
3. System sends email notification to user
4. User logs in and sees KYC status banner
5. User clicks "Retry Verification"
6. System checks attempt_count < 3 (currently 1)
7. System increments attempt_count = 2
8. System resets to facial recognition step
9. User retakes selfie with better lighting
10. System reprocesses facial recognition
11. Face match score = 91% ✓
12. System updates status = "approved"
13. User gains platform access

POSTCONDITION: KYC approved on second attempt
```

### Flow 4: High-Risk AML Screening

```
PRECONDITION: User completed all KYC steps, AML screening running

1. Verifik AML screening detects PEP match
2. System receives webhook: { is_pep: true, risk_score: "HIGH" }
3. System sets KYC status = "pending_review"
4. System notifies compliance team via email
5. Compliance team reviews PEP details
6. Compliance team marks verification as approved (PEP not automatically rejected in Brazil)
7. System updates status = "approved"
8. User receives email notification
9. User can now access platform

POSTCONDITION: High-risk user manually approved by compliance team
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
**Scenario**: CPF name = "João da Silva", Document name = "João Silva"
**Handling**:
- Use fuzzy matching with 90% similarity threshold
- If match ≥ 90%, approve
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
- **Cap Table Management**: Cap table creation is gated by KYC approval
- **Shareholder Registry**: Shareholder records inherit verified CPF data
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

### Frontend KYC Flow Component

```typescript
// /frontend/src/app/(dashboard)/kyc/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api-client';
import { useErrorToast } from '@/hooks/use-error-toast';

// Types for each KYC step
interface VerifyCpfDto {
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

interface DocumentUploadResult {
  verified: boolean;
  extractedData: {
    fullName: string;
    documentNumber: string;
    issueDate: string;
    expiryDate: string;
  };
  documentUrl: string;
}

interface FaceVerificationResult {
  verified: boolean;
  faceMatchScore: number;
  livenessScore: number;
  selfieUrl: string;
}

type KYCStep = 'cpf' | 'document' | 'facial' | 'complete';

export default function KYCVerificationPage() {
  const [step, setStep] = useState<KYCStep>('cpf');
  const [cpfData, setCpfData] = useState<CpfVerificationResult | null>(null);
  const router = useRouter();
  const t = useTranslations('kyc');
  const { showError } = useErrorToast();

  const verifyCpf = useMutation({
    mutationFn: (data: VerifyCpfDto) =>
      api.post<CpfVerificationResult>('/api/v1/kyc/verify-cpf', data),
    onSuccess: (data) => {
      setCpfData(data);
      setStep('document');
    },
    onError: (error) => {
      showError(error);
    },
  });

  const uploadDocument = useMutation({
    mutationFn: ({ file, docType, docNumber }: { file: File; docType: string; docNumber: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', docType);
      formData.append('documentNumber', docNumber);
      return api.postFormData<DocumentUploadResult>('/api/v1/kyc/upload-document', formData);
    },
    onSuccess: () => {
      setStep('facial');
    },
    onError: (error) => {
      showError(error);
    },
  });

  const verifyFace = useMutation({
    mutationFn: (selfieBlob: Blob) => {
      const formData = new FormData();
      formData.append('selfie', selfieBlob);
      return api.postFormData<FaceVerificationResult>('/api/v1/kyc/verify-face', formData);
    },
    onSuccess: (result) => {
      if (result.verified && result.faceMatchScore >= 85) {
        setStep('complete');
        setTimeout(() => router.push('/dashboard'), 3000);
      } else {
        showError({
          messageKey: 'errors.kyc.faceMatchFailed',
          details: { score: result.faceMatchScore },
        });
      }
    },
    onError: (error) => {
      showError(error);
    },
  });

  return (
    <div className="kyc-container">
      <h1>{t('title')}</h1>
      {step === 'cpf' && (
        <CPFVerificationStep
          onSubmit={(cpf, dob) => verifyCpf.mutate({ cpf, dateOfBirth: dob })}
          isLoading={verifyCpf.isPending}
        />
      )}
      {step === 'document' && (
        <DocumentUploadStep
          onSubmit={(file, docType, docNumber) =>
            uploadDocument.mutate({ file, docType, docNumber })
          }
          cpfData={cpfData}
          isLoading={uploadDocument.isPending}
        />
      )}
      {step === 'facial' && (
        <FacialRecognitionStep
          onSubmit={(selfieBlob) => verifyFace.mutate(selfieBlob)}
          isLoading={verifyFace.isPending}
        />
      )}
      {step === 'complete' && <VerificationCompleteMessage />}
    </div>
  );
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
- Limit KYC submission attempts: 3 per user lifetime
- Limit API calls: 10 per minute per user
- Implement CAPTCHA after 2 failed verification attempts

### SEC-5: LGPD Compliance
- Obtain explicit consent before collecting KYC data
- Provide data deletion mechanism (after 5-year retention)
- Store data in AWS São Paulo region
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
- 100% of users complete KYC before critical operations
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

1. Should we implement progressive KYC levels (Basic → Standard → Enhanced)?
2. What is the manual review SLA for high-risk users?
3. Should we support KYC for minors (under 18) with guardian consent?
4. How do we handle users with foreign documents (non-Brazilian)?
5. Should we implement KYC expiration (re-verification after X years)?

---

## Future Enhancements

- **Video KYC**: Live video call verification for high-value transactions
- **Batch KYC**: Bulk shareholder verification for companies migrating cap tables
- **Enhanced Due Diligence (EDD)**: Additional checks for high-risk users
- **International KYC**: Support for non-Brazilian identity documents
- **KYC API for Partners**: Allow partner platforms to leverage Navia KYC
- **AI Fraud Detection**: Machine learning models to detect sophisticated fraud attempts

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [authentication.md](./authentication.md) | KYC requires authenticated user; user entity links to KYC verification records |
| [shareholder-registry.md](./shareholder-registry.md) | Shareholders require KYC verification based on type (admin, investor, employee) |
| [company-management.md](./company-management.md) | Company admins must complete KYC to activate company features |
| [company-cnpj-validation.md](./company-cnpj-validation.md) | Covers all CNPJ validation (company-level verification via Verifik); this spec defers to it for CNPJ flows |
| [option-exercises.md](./option-exercises.md) | Employees may need KYC before exercising options |
| [funding-rounds.md](./funding-rounds.md) | Investors need KYC before committing to rounds |
| [api-standards.md](../.claude/rules/api-standards.md) | KYC endpoints follow `/api/v1/kyc/*` global path pattern |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: `KYC_REQUIRED`, `KYC_CPF_INVALID`, `KYC_CPF_NOT_FOUND`, `KYC_CPF_DOB_MISMATCH`, `KYC_DOCUMENT_INVALID`, `KYC_DOCUMENT_EXPIRED`, `KYC_FACE_MATCH_FAILED`, `KYC_LIVENESS_CHECK_FAILED`, `KYC_AML_HIGH_RISK`, `KYC_PEP_DETECTED`, `KYC_SANCTIONS_MATCH`, `KYC_MAX_ATTEMPTS_EXCEEDED`, `KYC_VERIFIK_UNAVAILABLE` |
| [security.md](../.claude/rules/security.md) | PII handling for CPF, biometric data; KYC document encryption via AWS KMS; LGPD consent for KYC data collection |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: `KYC_STARTED`, `KYC_CPF_VERIFIED`, `KYC_CPF_FAILED`, `KYC_DOCUMENT_UPLOADED`, `KYC_FACE_VERIFIED`, `KYC_FACE_FAILED`, `KYC_AML_SCREENED`, `KYC_APPROVED`, `KYC_REJECTED` |

---

# Frontend Specification

> The sections below define the frontend architecture, component specifications, feature gating, user flows, UI states, and i18n keys for the KYC verification feature. The backend specification above remains the source of truth for API contracts, data models, and business rules.

---

## Frontend Architecture

### Page Routes

| Route | Description | Layout | Auth Required |
|-------|-------------|--------|---------------|
| `/kyc` | KYC wizard (full-page, progress stepper) | Outside dashboard shell, centered layout | Yes |
| `/kyc/status` | KYC status page (post-submission) | Outside dashboard shell, centered layout | Yes |

Both routes use a dedicated KYC layout: full-page, `gray-50` background, centered content card. They are outside the dashboard shell (no sidebar) but require authentication.

### Component Tree

```
app/(kyc)/
  layout.tsx                          ← KYC layout (centered, no sidebar)
  kyc/
    page.tsx                          ← KYCWizard container
  kyc/status/
    page.tsx                          ← KYCStatusPage

components/kyc/
  kyc-progress-stepper.tsx            ← Visual step indicator
  cpf-verification-step.tsx           ← Step 1: CPF input + validation
  document-upload-step.tsx            ← Step 2: Document type + file upload
  facial-recognition-step.tsx         ← Step 3: Camera + liveness + selfie
  kyc-completion-step.tsx             ← Step 4: Success message
  kyc-status-banner.tsx               ← Persistent banner on dashboard pages
  kyc-status-badge.tsx                ← Small badge for profile/settings
  kyc-blocked-overlay.tsx             ← Overlay on KYC-gated pages
  kyc-gate.tsx                        ← Wrapper component for KYC-gated content

components/ui/
  cpf-input.tsx                       ← Reusable masked CPF input
```

### Component Specifications

#### 1. `KYCWizard` — Container managing entire KYC flow

- **File**: `app/(kyc)/kyc/page.tsx`
- **Layout**: Centered content, max-w `640px`, white bg card, `shadow-md`, `radius-lg`, padding `32px`
- **Manages step state**: CPF -> Document Upload -> Facial Recognition -> Complete
- **Progress stepper at top** (KYCProgressStepper)
- **Auto-advances** on step completion
- **Can resume** at last incomplete step if user returns (calls `GET /api/v1/kyc/status` on mount)
- **State**:
  ```typescript
  type KYCStep = 'cpf' | 'document' | 'facial' | 'complete';

  interface KYCWizardState {
    currentStep: KYCStep;
    cpfVerified: boolean;
    documentUploaded: boolean;
    faceVerified: boolean;
  }
  ```
- **On mount**: calls `GET /api/v1/kyc/status` to determine `completedSteps` and resumes at the first incomplete step. If status is `APPROVED`, redirects to `/dashboard`. If status is `IN_REVIEW`, redirects to `/kyc/status`.

#### 2. `KYCProgressStepper` — Visual step indicator

- **File**: `components/kyc/kyc-progress-stepper.tsx`
- **Props**: `currentStep: KYCStep`, `completedSteps: KYCStep[]`
- **4 steps**: "CPF" -> "Documento" -> "Reconhecimento Facial" -> "Concluido"
- **Visual pattern** (same as OnboardingStepper from auth spec):
  - **Active**: `blue-600` circle with step number, `navy-900` label text
  - **Complete**: `green-600` circle with check icon (Lucide `Check`), `gray-500` label text
  - **Future**: `gray-300` circle with step number, `gray-400` label text
- **Connector lines** between steps: `gray-200` default, `green-600` when preceding step is complete
- **Responsive**: horizontal on desktop (>= `md`), vertical on mobile

#### 3. `CPFVerificationStep` — Step 1: CPF input

- **File**: `components/kyc/cpf-verification-step.tsx`
- **Props**: `onSuccess: () => void`, `isLoading: boolean`
- **Fields**:
  - `fullName`: text input, required, placeholder "Nome completo como no documento"
  - `cpf`: CPFInput component (masked XXX.XXX.XXX-XX), required, client-side Modulo 11 validation
  - `dateOfBirth`: date input (DD/MM/YYYY format), required, must be in the past, user must be 18+
- **Submit**: `POST /api/v1/kyc/verify-cpf` with `{ cpf, dateOfBirth, fullName }`
- **On success**: calls `onSuccess()` to advance to Step 2
- **Error handling**:
  - `KYC_CPF_MISMATCH` (422): inline error "Os dados informados nao correspondem ao CPF"
  - `KYC_CPF_DUPLICATE` / `KYC_CPF_ALREADY_USED` (409): inline error "Este CPF ja esta associado a outra conta"
  - `KYC_CPF_INVALID` (422): inline error "CPF invalido"
  - `KYC_CPF_NOT_FOUND` (404): inline error "CPF nao encontrado na base da Receita Federal"
  - `KYC_VERIFIK_UNAVAILABLE` (502): error toast "Servico de verificacao indisponivel. Tente novamente."
- **Client-side validation**: CPF Modulo 11 checksum runs on blur, date of birth validates age >= 18

#### 4. `CPFInput` — Reusable masked CPF input

- **File**: `components/ui/cpf-input.tsx`
- **Props**: extends standard input props, adds `onValidChange: (isValid: boolean) => void`
- **Mask**: XXX.XXX.XXX-XX (auto-formats as user types, strips non-digits)
- **Client-side validation**: Modulo 11 algorithm for both CPF verification digits
- **Styling**: same as standard input (design-system.md section 6.4)
- **Helper text**: "Digite o CPF -- sera formatado automaticamente"

#### 5. `DocumentUploadStep` — Step 2: Document upload

- **File**: `components/kyc/document-upload-step.tsx`
- **Props**: `onSuccess: () => void`, `isLoading: boolean`
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
- **Submit**: `POST /api/v1/kyc/upload-document` (multipart/form-data)
- **Progress bar** during upload: 4px height, `blue-600` fill, `radius-full`
- **On success**: green check animation + calls `onSuccess()` to advance to Step 3
- **Error handling**:
  - Client-side: file type validation, file size validation (< 10 MB)
  - `KYC_DOCUMENT_INVALID` (422): inline error "Documento nao pode ser verificado"
  - `KYC_DOCUMENT_UNREADABLE` (422): inline error "Documento ilegivel. Tente uma foto mais nitida."
  - `KYC_DOCUMENT_EXPIRED` (422): inline error "Documento expirado. Utilize um documento valido."
  - `KYC_FILE_TOO_LARGE` (400): inline error "Arquivo excede o tamanho maximo de 10 MB"
  - `KYC_FILE_INVALID_FORMAT` (400): inline error "Formato nao suportado. Use PDF, PNG, JPG ou JPEG."

#### 6. `FacialRecognitionStep` — Step 3: Selfie / liveness check

- **File**: `components/kyc/facial-recognition-step.tsx`
- **Props**: `onSuccess: () => void`, `isLoading: boolean`
- **Flow**:
  1. Request camera permission (browser prompt via `navigator.mediaDevices.getUserMedia`)
  2. Show live camera feed in a circular frame (280px diameter)
  3. Instructions: "Posicione seu rosto no centro do circulo"
  4. Liveness instructions cycle: "Vire a cabeca para a esquerda", "Vire a cabeca para a direita", "Sorria"
  5. Auto-capture when conditions are met, or manual "Capturar" button
  6. Show captured image for review: "Ficou bom?"
  7. "Refazer" (ghost button) or "Enviar" (primary button)
- **Submit**: `POST /api/v1/kyc/verify-face` with captured image as Blob
- **On success**: calls `onSuccess()` to advance to Step 4 (completion)
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

#### 7. `KYCCompletionStep` — Step 4: Success / Submission complete

- **File**: `components/kyc/kyc-completion-step.tsx`
- **Shows**: success illustration (green check icon, 64px), celebration visual
- **Title**: "Verificacao Enviada!" (h2, `navy-900`)
- **Subtitle**: "Estamos analisando seus dados. Voce recebera uma notificacao quando a verificacao for concluida." (body, `gray-500`)
- **Button**: "Ir para o Dashboard" (primary, size lg, full width) -> navigates to `/dashboard`
- **Status**: KYC is now `IN_REVIEW` (not yet `APPROVED`)

#### 8. `KYCStatusBanner` — Persistent banner on dashboard pages

- **File**: `components/kyc/kyc-status-banner.tsx`
- **Props**: `kycStatus: KYCStatus`, `rejectionReason?: string`, `onDismiss: () => void`
- **Shown at**: top of dashboard content area (below page header) when KYC is not `APPROVED`
- **States**:

  | KYC Status | Background | Text Color | Left Border | Message | Action |
  |------------|-----------|------------|-------------|---------|--------|
  | `NOT_STARTED` | `cream-100` | `cream-700` | 3px `cream-700` | "Complete a verificacao de identidade para acessar todos os recursos" | "Iniciar Verificacao" (primary sm) |
  | `IN_PROGRESS` | `blue-50` | `blue-600` | 3px `blue-600` | "Verificacao em andamento. Complete as etapas restantes." | "Continuar" (primary sm) |
  | `IN_REVIEW` | `blue-50` | `blue-600` | 3px `blue-600` | "Sua verificacao esta sendo analisada. Voce sera notificado em breve." | None |
  | `REJECTED` | `#FEE2E2` | `#991B1B` | 3px `#991B1B` | "Verificacao recusada: {reason}. Tente novamente." | "Refazer Verificacao" (destructive sm) |
  | `APPROVED` | (hidden) | -- | -- | -- | -- |

- **Dismissible**: user can close the banner for the session via ghost X button, reappears on next login
- **Banner hidden** when KYC status is `APPROVED`

#### 9. `KYCStatusBadge` — Small badge showing KYC status

- **File**: `components/kyc/kyc-status-badge.tsx`
- **Props**: `status: KYCStatus`
- **Used in**: profile/settings areas, user dropdown
- **States** (using badge styles from design-system.md section 6.5):

  | Status | Background | Text | Label (PT-BR) | Label (EN) |
  |--------|-----------|------|---------------|------------|
  | `NOT_STARTED` | `gray-100` | `gray-600` | "Nao iniciado" | "Not started" |
  | `IN_PROGRESS` | `cream-100` | `cream-700` | "Em andamento" | "In progress" |
  | `IN_REVIEW` | `blue-50` | `blue-600` | "Em analise" | "Under review" |
  | `APPROVED` | `green-100` | `green-700` | "Verificado" | "Verified" |
  | `REJECTED` | `#FEE2E2` | `#991B1B` | "Recusado" | "Rejected" |

- **Size**: caption (12px), weight 500, padding `2px 8px`, `radius-full`

#### 10. `KYCBlockedOverlay` — Overlay on blocked features

- **File**: `components/kyc/kyc-blocked-overlay.tsx`
- **Props**: `kycStatus: KYCStatus`
- **Used on**: pages that require KYC (cap table, transactions, shareholders, funding rounds, option plans)
- **Visual**:
  - Position: absolute, covers entire page content area
  - Background: white at 80% opacity
  - `backdrop-filter: blur(4px)` on the page content behind
  - Center card: max-w `400px`, white bg, `shadow-lg`, `radius-lg`, padding `32px`
  - Lock icon: Lucide `Lock`, 48px, `gray-400`
  - Title: h3, `navy-900`, "Verificacao de identidade necessaria"
  - Subtitle: body, `gray-500`, "Complete a verificacao KYC para acessar este recurso"
  - Button: Primary, "Iniciar Verificacao" (if `NOT_STARTED` or `REJECTED`) or "Continuar Verificacao" (if `IN_PROGRESS`) -> navigates to `/kyc`
  - If `IN_REVIEW`: no button, show "Sua verificacao esta em analise" instead

---

## KYC Feature Gating

### Features BLOCKED Without KYC (require `APPROVED` status)

| Route | Feature | Behavior |
|-------|---------|----------|
| `/dashboard/cap-table` | Cap table management | Full page blocked with `KYCBlockedOverlay` |
| `/dashboard/shareholders` | Shareholder management | Full page blocked with `KYCBlockedOverlay` |
| `/dashboard/transactions` | Transactions | Full page blocked with `KYCBlockedOverlay` |
| `/dashboard/investments` | Funding rounds | Full page blocked with `KYCBlockedOverlay` |
| `/dashboard/options` | Option plans | Full page blocked with `KYCBlockedOverlay` |

### Features ALLOWED Without KYC

| Route | Feature | Notes |
|-------|---------|-------|
| `/dashboard` | Dashboard | View only; action buttons for KYC-gated features are hidden or disabled |
| `/dashboard/settings` | Company settings | Full access |
| `/dashboard/members` | Member management | Full access |
| `/dashboard/documents` | Documents | View only |
| `/profile` | Profile settings | Full access |

### Implementation Pattern

**Option A: Inline check in page component**

```tsx
import { useAuth } from '@/hooks/use-auth';
import { KYCBlockedOverlay } from '@/components/kyc/kyc-blocked-overlay';

function ShareholdersPage() {
  const { kycStatus } = useAuth();

  if (kycStatus !== 'APPROVED') {
    return <KYCBlockedOverlay kycStatus={kycStatus} />;
  }

  return <ShareholdersContent />;
}
```

**Option B: `KYCGate` wrapper component**

```tsx
// components/kyc/kyc-gate.tsx
import { useAuth } from '@/hooks/use-auth';
import { KYCBlockedOverlay } from './kyc-blocked-overlay';

interface KYCGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function KYCGate({ children, fallback }: KYCGateProps) {
  const { kycStatus } = useAuth();

  if (kycStatus !== 'APPROVED') {
    return fallback ?? <KYCBlockedOverlay kycStatus={kycStatus} />;
  }

  return <>{children}</>;
}

// Usage in page:
export default function ShareholdersPage() {
  return (
    <KYCGate>
      <ShareholdersContent />
    </KYCGate>
  );
}
```

**Option B is preferred** for consistency. Use `KYCGate` in all KYC-gated page components.

### Dashboard Action Button Gating

On the dashboard page, action buttons that lead to KYC-gated features should be visually disabled when KYC is not approved:

```tsx
// In dashboard quick actions card
<Button
  variant="primary"
  disabled={kycStatus !== 'APPROVED'}
  onClick={() => router.push('/dashboard/transactions')}
>
  {t('dashboard.quickActions.newTransaction')}
</Button>
```

When disabled, show a tooltip: "Complete a verificacao KYC para usar este recurso".

---

## Frontend User Flows

### Flow 1: Happy Path -- Full KYC Completion

```
User clicks "Iniciar Verificacao" from KYCStatusBanner
  |
  +-- [navigates to /kyc] --> KYCWizard renders
  |     |
  |     +-- [GET /api/v1/kyc/status] --> determines starting step
  |     |     |
  |     |     +-- [no completed steps] --> Step 1 (CPF)
  |     |     +-- [CPF done] --> Step 2 (Document)
  |     |     +-- [CPF + Document done] --> Step 3 (Facial)
  |     |     +-- [status = APPROVED] --> redirect to /dashboard
  |     |     +-- [status = IN_REVIEW] --> redirect to /kyc/status
  |     |
  |     +-- Step 1: CPF Verification
  |     |     +-- [fills CPF + DOB + name] --> POST /api/v1/kyc/verify-cpf
  |     |     |     +-- [success] --> advance to Step 2
  |     |     |     +-- [KYC_CPF_MISMATCH] --> inline error, retry
  |     |     |     +-- [KYC_CPF_DUPLICATE] --> inline error, contact support
  |     |     |     +-- [KYC_CPF_NOT_FOUND] --> inline error, retry
  |     |     |     +-- [KYC_VERIFIK_UNAVAILABLE] --> error toast, retry
  |     |     +-- [client-side CPF invalid] --> inline error on blur
  |     |
  |     +-- Step 2: Document Upload
  |     |     +-- [selects doc type] --> shows upload area(s)
  |     |     +-- [uploads front] --> progress bar --> preview
  |     |     +-- [uploads back (if RG/CNH)] --> progress bar --> preview
  |     |     +-- [clicks "Enviar Documentos"] --> POST /api/v1/kyc/upload-document
  |     |           +-- [success] --> advance to Step 3
  |     |           +-- [KYC_DOCUMENT_INVALID] --> inline error, retry
  |     |           +-- [KYC_DOCUMENT_UNREADABLE] --> inline error, tips, retry
  |     |           +-- [KYC_DOCUMENT_EXPIRED] --> inline error
  |     |           +-- [file too large / wrong format] --> client-side inline error
  |     |
  |     +-- Step 3: Facial Recognition
  |     |     +-- [camera granted] --> live feed shows
  |     |     +-- [follows liveness instructions] --> auto-capture
  |     |     +-- [reviews photo] --> "Enviar" or "Refazer"
  |     |     +-- [submits] --> POST /api/v1/kyc/verify-face
  |     |           +-- [success] --> advance to Step 4
  |     |           +-- [KYC_LIVENESS_FAILED] --> guidance, retry
  |     |           +-- [KYC_FACE_MISMATCH] --> error, retry
  |     |
  |     +-- Step 4: Completion
  |           +-- [shows success message] --> KYC status = IN_REVIEW
  |           +-- [clicks "Ir para Dashboard"] --> redirect to /dashboard
  |                 +-- KYCStatusBanner shows "Em analise"
```

**Step-by-step (detailed):**

```
PRECONDITION: User is authenticated, KYC status is NOT_STARTED or REJECTED
ACTOR: Authenticated user
TRIGGER: User clicks "Iniciar Verificacao" on KYCStatusBanner or navigates to /kyc

1.  [UI] Navigates to /kyc route
2.  [Frontend] KYCWizard mounts, sends GET /api/v1/kyc/status
3.  [Backend] Returns completedSteps and current status
4.  [UI] KYCWizard renders at first incomplete step
    --> IF all steps complete and status = APPROVED: redirect to /dashboard
    --> IF status = IN_REVIEW: redirect to /kyc/status
5.  [UI] KYCProgressStepper renders: CPF [active] --> Documento --> Reconhecimento Facial --> Concluido
6.  [UI] CPFVerificationStep renders with fullName, CPF, and dateOfBirth fields
7.  [UI] User enters full name
8.  [UI] User enters CPF (auto-masked to XXX.XXX.XXX-XX)
9.  [Frontend] On CPF blur: validates Modulo 11 checksum
    --> IF invalid: shows "CPF invalido" inline error, STOP
10. [UI] User enters date of birth (DD/MM/YYYY)
11. [Frontend] Validates date is in the past and age >= 18
    --> IF under 18: shows "Voce deve ter 18 anos ou mais" inline error, STOP
12. [UI] User clicks "Verificar CPF"
13. [Frontend] Sends POST /api/v1/kyc/verify-cpf with { cpf, dateOfBirth, fullName }
14. [UI] Button shows loading spinner, fields disabled
15. [Backend] Validates CPF format
    --> IF invalid format: return 400 KYC_CPF_INVALID
16. [Backend] Calls Verifik to validate CPF against Receita Federal
    --> IF Verifik unavailable: return 502 KYC_VERIFIK_UNAVAILABLE
    --> IF CPF not found: return 404 KYC_CPF_NOT_FOUND
17. [Backend] Checks dateOfBirth matches CPF registry
    --> IF mismatch: return 422 KYC_CPF_DOB_MISMATCH / KYC_CPF_MISMATCH
18. [Backend] Checks CPF blind index for duplicates
    --> IF duplicate: return 409 KYC_CPF_DUPLICATE
19. [Backend] Stores encrypted CPF, updates KYC status to IN_PROGRESS
20. [Backend] Returns 200 with verified CPF data
21. [Backend] Queues audit event: KYC_CPF_VERIFIED
22. [UI] Step 1 shows green check, stepper updates
23. [UI] Auto-advances to Step 2 (DocumentUploadStep)
24. [UI] Stepper: CPF [complete check] --> Documento [active] --> ...
25. [UI] DocumentUploadStep renders with document type radio cards
26. [UI] User selects document type (RG, CNH, or Passport)
27. [UI] Upload area for front side appears: dashed border, drag-and-drop zone
28. [UI] User drags file or clicks "Selecionar arquivo"
29. [Frontend] Validates file type (PDF/PNG/JPG/JPEG) and size (< 10 MB)
    --> IF invalid type: shows "Formato nao suportado. Use PDF, PNG, JPG ou JPEG." inline error
    --> IF too large: shows "Arquivo excede o tamanho maximo de 10 MB" inline error
30. [UI] File preview shows (thumbnail for images, file icon for PDF) + file name + size + "Remover" link
31. [UI] If RG/CNH: second upload area for back side appears with "Verso do documento" label
32. [UI] User uploads back side (same validation as step 29-30)
33. [UI] User clicks "Enviar Documentos"
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
42. [UI] Step 2 shows green check, stepper updates
43. [UI] Auto-advances to Step 3 (FacialRecognitionStep)
44. [UI] Stepper: CPF [check] --> Documento [check] --> Reconhecimento Facial [active] --> ...
45. [UI] FacialRecognitionStep renders, requests camera permission
46. [UI] Browser camera permission dialog appears
    --> IF denied: shows error card "Acesso a camera necessario" + browser instructions, STOP
47. [UI] Live camera feed in 280px circular frame
48. [UI] Instruction text: "Posicione seu rosto no centro do circulo"
49. [UI] Liveness instructions cycle: "Vire a cabeca para a esquerda", "Vire a cabeca para a direita", "Sorria"
50. [UI] Auto-capture when conditions met, or user clicks "Capturar"
51. [UI] Review screen: captured photo in circle frame
52. [UI] "Ficou bom?" with "Refazer" (ghost) and "Enviar" (primary) buttons
    --> IF "Refazer": return to camera feed (step 47)
53. [UI] User clicks "Enviar"
54. [Frontend] Sends POST /api/v1/kyc/verify-face with captured image as Blob
55. [UI] Spinner overlay on captured photo
56. [Backend] Processes facial recognition + liveness check via Verifik
    --> IF liveness fail: return 422 KYC_LIVENESS_CHECK_FAILED
    --> IF face doesn't match document (< 85%): return 422 KYC_FACE_MATCH_FAILED
57. [Backend] Updates KYC status to PENDING_REVIEW (IN_REVIEW)
58. [Backend] Triggers AML screening asynchronously
59. [Backend] Returns 200 with face match and liveness scores
60. [Backend] Queues audit events: KYC_FACE_VERIFIED, KYC_AML_SCREENED (async)
61. [UI] Step 3 shows green check, stepper updates
62. [UI] Auto-advances to Step 4 (KYCCompletionStep)
63. [UI] Success illustration (green check, 64px) + "Verificacao Enviada!" title
64. [UI] Subtitle: "Estamos analisando seus dados. Voce recebera uma notificacao quando a verificacao for concluida."
65. [UI] "Ir para o Dashboard" primary button
66. [UI] User clicks "Ir para o Dashboard"
67. [UI] Redirect to /dashboard
68. [UI] KYCStatusBanner shows "Sua verificacao esta sendo analisada" (IN_REVIEW state)

POSTCONDITION: KYC status = IN_REVIEW (PENDING_REVIEW)
SIDE EFFECTS:
  - Audit logs: KYC_STARTED, KYC_CPF_VERIFIED, KYC_DOCUMENT_UPLOADED, KYC_FACE_VERIFIED, KYC_AML_SCREENED
  - Verifik API calls: CPF validation, document OCR, facial recognition, AML screening
  - S3 uploads: document images (encrypted), selfie (encrypted)
  - Email: user receives notification when review is complete
```

### Flow 2: CPF Verification Failure

```
User enters CPF data that fails validation
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
  +-- User corrects data and retries
        --> OR contacts support (for duplicate CPF)
```

### Flow 3: Document Upload Failure

```
User attempts to upload document
  |
  +-- [client-side] file too large --> "Arquivo excede o tamanho maximo de 10 MB"
  +-- [client-side] wrong format --> "Formato nao suportado. Use PDF, PNG, JPG ou JPEG"
  +-- [server] upload fails (network) --> error toast + retry button
  +-- [server] KYC_DOCUMENT_INVALID --> inline error "Documento nao pode ser verificado"
  +-- [server] KYC_DOCUMENT_UNREADABLE --> inline error "Documento ilegivel. Tente uma foto mais nitida."
  +-- [server] KYC_DOCUMENT_EXPIRED --> inline error "Documento expirado"
  |
  +-- User corrects issue and retries
```

### Flow 4: Facial Recognition Failure

```
Facial recognition step
  |
  +-- [camera denied] --> error card: "Acesso a camera necessario" + browser instructions
  +-- [face not detected] --> "Rosto nao detectado. Posicione-se no centro do circulo."
  +-- [KYC_LIVENESS_FAILED (422)] --> "Verificacao de vivacidade falhou. Tente novamente."
  +-- [KYC_FACE_MISMATCH (422)] --> "O rosto nao corresponde ao documento enviado."
  +-- [network error] --> error toast + retry
  |
  +-- User retries (can retake photo unlimited times within the step)
```

### Flow 5: KYC Rejection and Resubmission

```
KYC submitted, status = IN_REVIEW
  |
  +-- [Backend: KYC approved] --> notification email sent
  |     +-- [user refreshes/navigates] --> KYCStatusBanner disappears, features unlocked
  |
  +-- [Backend: KYC rejected] --> notification email with reason
  |     +-- [user sees KYCStatusBanner] --> "Recusado: [reason]" + "Refazer Verificacao"
  |           +-- [clicks "Refazer"] --> navigates to /kyc
  |                 +-- [Backend checks attemptCount < 3] --> allowed to restart
  |                 +-- [Backend checks attemptCount >= 3] --> blocked, contact support
  |
  +-- [Backend: still reviewing] --> "Em analise" banner, no action required
```

**Step-by-step (rejection path):**

```
PRECONDITION: KYC status = REJECTED, attemptCount < 3
ACTOR: Authenticated user
TRIGGER: User clicks "Refazer Verificacao" on KYCStatusBanner

1. [UI] Navigates to /kyc
2. [Frontend] GET /api/v1/kyc/status
3. [Backend] Returns status = REJECTED, canResubmit = true
4. [UI] KYCWizard starts from Step 1 (all steps must be redone)
5. [Steps 6-67 same as Happy Path Flow 1]
6. [Backend] Increments attemptCount

POSTCONDITION: KYC resubmitted, status = IN_REVIEW, attemptCount incremented
```

### Flow 6: Resume Incomplete KYC

```
User started KYC but left mid-flow
  |
  +-- [returns to /kyc or clicks "Continuar" on banner]
  |     +-- GET /api/v1/kyc/status
  |           |
  |           +-- [completedSteps: []] --> resume at Step 1 (CPF)
  |           +-- [completedSteps: ["cpf"]] --> resume at Step 2 (Document)
  |           +-- [completedSteps: ["cpf", "document"]] --> resume at Step 3 (Facial)
  |           +-- [completedSteps: ["cpf", "document", "facial"]] --> Step 4 (Complete)
  |           +-- [status = APPROVED] --> redirect to /dashboard
  |           +-- [status = IN_REVIEW] --> redirect to /kyc/status
```

### Flow 7: KYC-Blocked Feature Access

```
User navigates to a KYC-gated page (e.g., /dashboard/shareholders)
  |
  +-- [KYCGate checks kycStatus]
  |     |
  |     +-- [status != APPROVED] --> KYCBlockedOverlay renders
  |     |     |
  |     |     +-- [page content visible but blurred behind overlay]
  |     |     +-- [centered message: "Verificacao de identidade necessaria"]
  |     |     +-- [status = NOT_STARTED or REJECTED] --> "Iniciar Verificacao" button --> /kyc
  |     |     +-- [status = IN_PROGRESS] --> "Continuar Verificacao" button --> /kyc
  |     |     +-- [status = IN_REVIEW] --> "Sua verificacao esta em analise" (no button)
  |     |
  |     +-- [status == APPROVED] --> page renders normally
```

---

## UI States & Error Handling

### KYCWizard States per Step

| Step | Idle | Loading | Success | Error |
|------|------|---------|---------|-------|
| CPF | Form ready, fields enabled | Spinner on button, fields disabled | Green check on step, auto-advance | Red error text inline below field |
| Document | Upload area ready, radio cards enabled | Upload progress bar, submit disabled | Thumbnails with green check overlay | Error message below upload area + retry |
| Facial | Camera request pending | Camera active, instructions cycling | Photo captured, review screen | Error message + guidance tips + retry |
| Complete | -- | -- | Success illustration + message | -- |

### Camera Step States

| State | Visual | Trigger |
|-------|--------|---------|
| Permission Request | Browser permission dialog | Step 3 mount |
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
| `IN_REVIEW` | `blue-50` bg, `blue-600` text, 3px `blue-600` left border | "Sua verificacao esta sendo analisada. Voce sera notificado em breve." | None |
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
| `KYC_UNDER_REVIEW` | 409 | Redirect to /kyc/status |
| `KYC_FILE_TOO_LARGE` | 400 | Inline error: "Arquivo excede o tamanho maximo de 10 MB" |
| `KYC_FILE_INVALID_FORMAT` | 400 | Inline error: "Formato nao suportado. Use PDF, PNG, JPG ou JPEG." |
| `KYC_MAX_ATTEMPTS_EXCEEDED` | 422 | Error card: "Numero maximo de tentativas excedido. Entre em contato com o suporte." |
| `KYC_VERIFIK_UNAVAILABLE` | 502 | Error toast: "Servico de verificacao indisponivel. Tente novamente." + retry |

---

## Component Visual Specifications

### KYCWizard Visual Spec

| Property | Value |
|----------|-------|
| Layout | Full page, `gray-50` background, centered content |
| Card | max-w `640px`, white bg, `shadow-md`, `radius-lg` (12px), padding `32px` |
| Header | Navia logo (small, 32px height) + "Verificacao de Identidade" title (`h2`, `navy-900`) |
| Stepper | At top of card, 4 steps, horizontal layout (see KYCProgressStepper) |
| Content area | Below stepper, step-specific content |
| Navigation | Linear flow only -- no back button. Steps can only go forward. |

### CPFVerificationStep Visual Spec

| Property | Value |
|----------|-------|
| Title | `h3`, "Verificacao de CPF" |
| Subtitle | `body-sm`, `gray-500`, "Informe seus dados para verificacao" |
| Field: fullName | Standard text input, label "Nome Completo", helper text "Como aparece nos seus documentos" |
| Field: CPF | CPFInput component, label "CPF", helper text "Digite o CPF -- sera formatado automaticamente" |
| Field: dateOfBirth | Date input, label "Data de Nascimento", format DD/MM/YYYY |
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
| Format text | "PDF, PNG, JPG ou JPEG -- max 10 MB" (`caption`, `gray-400`) |
| File preview | Image thumbnail (160px width) or PDF file icon + file name + size + "Remover" link (`blue-600`, `body-sm`) |
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
| Icon | Lucide `CheckCircle2`, 64px, `green-600` |
| Title | `h2`, `navy-900`, "Verificacao Enviada!" |
| Subtitle | `body`, `gray-500`, max-w 400px, "Estamos analisando seus dados..." |
| Button | Primary variant, size `lg`, full width, "Ir para o Dashboard" |
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

### KYCBlockedOverlay Visual Spec

| Property | Value |
|----------|-------|
| Position | `position: absolute`, covers entire page content area (`inset: 0`) |
| Background | `rgba(255, 255, 255, 0.8)` (white at 80% opacity) |
| Backdrop filter | `blur(4px)` on content behind |
| Center card | max-w `400px`, white bg, `shadow-lg`, `radius-lg` (12px), padding `32px` |
| Lock icon | Lucide `Lock`, 48px, `gray-400`, centered |
| Title | `h3`, `navy-900`, centered, "Verificacao de identidade necessaria" |
| Subtitle | `body`, `gray-500`, centered, max-w 320px |
| Button | Primary variant, full width, centered below subtitle |
| Spacing | 16px between icon and title, 8px between title and subtitle, 24px between subtitle and button |

---

## TanStack Query Integration

### Hooks

```typescript
// hooks/use-kyc-status.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface KYCStatusResponse {
  status: KYCStatus;
  verificationLevel: string;
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
// hooks/use-verify-cpf.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useVerifyCPF() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { cpf: string; dateOfBirth: string; fullName: string }) =>
      api.post('/api/v1/kyc/verify-cpf', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc', 'status'] });
    },
  });
}
```

```typescript
// hooks/use-upload-document.ts
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
export function useVerifyFace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) =>
      api.postFormData('/api/v1/kyc/verify-face', formData),
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

### KYC Wizard Keys

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
| `kyc.cpf.fullNameHelper` | Como aparece nos seus documentos | As it appears on your documents |
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
| `kyc.document.formats` | PDF, PNG, JPG ou JPEG -- max 10 MB | PDF, PNG, JPG or JPEG -- max 10 MB |
| `kyc.document.remove` | Remover | Remove |
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

### Completion Step Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `kyc.complete.title` | Verificacao Enviada! | Verification Submitted! |
| `kyc.complete.subtitle` | Estamos analisando seus dados. Voce recebera uma notificacao quando a verificacao for concluida. | We're analyzing your data. You'll receive a notification when verification is complete. |
| `kyc.complete.goToDashboard` | Ir para o Dashboard | Go to Dashboard |

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

### Blocked Overlay Keys

| Key | PT-BR | EN |
|-----|-------|-----|
| `kyc.blocked.title` | Verificacao de identidade necessaria | Identity verification required |
| `kyc.blocked.subtitle` | Complete a verificacao KYC para acessar este recurso | Complete KYC verification to access this feature |
| `kyc.blocked.startAction` | Iniciar Verificacao | Start Verification |
| `kyc.blocked.continueAction` | Continuar Verificacao | Continue Verification |
| `kyc.blocked.inReview` | Sua verificacao esta em analise | Your verification is under review |

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
