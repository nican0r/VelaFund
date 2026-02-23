# KYC & Identity Verification Specification

**Topic of Concern**: Identity verification using Verifik for Brazilian regulatory compliance

**One-Sentence Description**: The system verifies user identities through Verifik using CPF validation, document verification, facial recognition, and AML screening.

---

## Overview

Navia integrates with Verifik, an AI-powered identity verification platform specialized for Latin American markets, to comply with Brazilian KYC/AML regulations (BCB Circular 3.978/2020 and Resolução BCB 119/2021). The system performs multi-level verification including CPF/CNPJ validation against government databases, document authentication, facial biometric matching, liveness detection, and AML screening against PEP and sanctions lists.

**Regulatory Context**: Brazilian fintech platforms handling financial instruments must verify customer identities using CPF cross-checks with Receita Federal, facial recognition, and AML screening. Brazil has 5x higher deepfake fraud rates than the US, making liveness detection critical.

---

## User Stories

### US-1: Admin User KYC (Limited Access)
**As an** admin user who just signed up
**I want to** access the dashboard and view settings before completing KYC
**So that** I can explore the platform while preparing my identity documents

**But** I cannot create a cap table until KYC is approved

### US-2: Admin KYC Before Cap Table Creation
**As an** admin user ready to create my first cap table
**I want to** complete CPF verification, document upload, facial recognition, and CNPJ verification
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

### US-7: Company Verification
**As an** admin user creating a cap table
**I want to** verify my company's CNPJ
**So that** the system can confirm my company's legitimacy and legal status

### US-8: KYC Status Visibility
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

### FR-4: CNPJ Verification (Company)
- Admin users MUST verify company CNPJ before creating cap table
- System MUST validate CNPJ format (XX.XXX.XXX/XXXX-XX)
- System MUST verify CNPJ against Receita Federal via Verifik API
- System MUST confirm company is active and in good standing
- System MUST store company legal data (name, address, activities)

### FR-5: Document Verification
- System MUST accept: RG (Registro Geral), CNH (Driver's License), RNE (Foreign ID)
- System MUST perform OCR extraction of document data
- System MUST validate document authenticity (detect tampering)
- System MUST compare extracted data with CPF validation results
- System MUST store encrypted document images in S3

### FR-6: Facial Recognition & Liveness
- System MUST capture single-image selfie from user
- System MUST perform 3D liveness detection (passive)
- System MUST detect spoofing attempts (photos of photos, masks, deepfakes)
- System MUST compare selfie with document photo (face matching)
- System MUST require minimum match score of 85%
- System MUST store encrypted selfie in S3

### FR-7: AML Screening
- System MUST screen users against PEP (Politically Exposed Persons) databases
- System MUST check OFAC, Interpol, DEA sanctions lists
- System MUST check Brazilian SIMIT (fines and sanctions system)
- System MUST calculate risk score (LOW, MEDIUM, HIGH)
- System MUST flag high-risk users for manual review

### FR-8: KYC Status Management
- System MUST track KYC status: not_started, in_progress, pending_review, approved, rejected, resubmission_required
- System MUST allow maximum 3 resubmission attempts
- System MUST provide rejection reasons for failed verifications
- System MUST notify users via email of status changes

### FR-9: Webhook Integration
- System MUST accept webhook callbacks from Verifik
- System MUST verify webhook signatures
- System MUST update KYC status based on async verification results

---

## Data Models

### KYCVerification Entity

```typescript
interface KYCVerification {
  id: string;                       // UUID
  user_id: string;                  // Foreign key to User

  // CPF Verification
  cpf_number: string;               // Masked: XXX.XXX.XXX-XX
  cpf_verified: boolean;
  cpf_verified_at: Date | null;
  cpf_data: {                       // Certified data from Receita Federal
    full_name: string;
    date_of_birth: string;
    cpf_status: 'active' | 'inactive';
  };

  // Document Verification
  document_type: 'RG' | 'CNH' | 'RNE';
  document_number: string;
  document_verified: boolean;
  document_verified_at: Date | null;
  document_s3_url: string;          // Encrypted storage URL
  document_data: {                  // OCR extracted data
    full_name: string;
    document_number: string;
    issue_date: string;
    expiry_date: string;
  };

  // Facial Verification
  face_verified: boolean;
  face_verified_at: Date | null;
  face_match_score: number;         // 0-100
  liveness_score: number;           // 0-100
  selfie_s3_url: string;            // Encrypted storage URL

  // AML Screening
  aml_screening_done: boolean;
  aml_screening_at: Date | null;
  aml_risk_score: 'LOW' | 'MEDIUM' | 'HIGH';
  is_pep: boolean;
  sanctions_match: boolean;
  aml_screening_data: {
    watchlist_matches: string[];
    pep_details: object | null;
  };

  // Verifik Integration
  verifik_session_id: string;
  verifik_signature: string;        // Certified signature

  // Status
  status: KYCStatus;
  submitted_at: Date | null;
  approved_at: Date | null;
  rejected_at: Date | null;
  rejection_reason: string | null;
  attempt_count: number;            // Max 3 attempts

  // Metadata
  created_at: Date;
  updated_at: Date;
}
```

### CompanyKYC Entity

```typescript
interface CompanyKYC {
  id: string;
  company_id: string;               // Foreign key to Company

  // CNPJ Verification
  cnpj: string;                     // XX.XXX.XXX/XXXX-XX
  cnpj_verified: boolean;
  cnpj_verified_at: Date | null;
  legal_name: string;
  trade_name: string;
  company_status: 'ATIVA' | 'INATIVA' | 'SUSPENSA';
  legal_nature: string;
  opening_date: Date;
  main_activity_code: string;
  main_activity_desc: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip_code: string;
  };
  cnpj_data: object;                // Full certified data

  // UBO (Ultimate Beneficial Owner)
  ubo_identified: boolean;
  ubo_data: {
    name: string;
    cpf: string;
    ownership_percentage: number;
  }[];

  // Verifik Integration
  verifik_signature: string;

  // Status
  status: KYCStatus;
  approved_at: Date | null;
  rejected_at: Date | null;

  created_at: Date;
  updated_at: Date;
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
  "session_id": "uuid",
  "status": "in_progress",
  "required_steps": ["cpf", "document", "facial", "aml"]
}
```

---

### POST /api/v1/kyc/verify-cpf
**Description**: Verify CPF with Verifik

**Request**:
```json
{
  "cpf": "012.345.678-01",
  "date_of_birth": "17/02/2002"
}
```

**Response** (200 OK):
```json
{
  "verified": true,
  "data": {
    "full_name": "MATEO VERIFIK",
    "date_of_birth": "2002-02-17",
    "cpf_status": "active"
  },
  "verifik_signature": "certified_hash"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid CPF format
- `404 Not Found` - CPF not found in Receita Federal database
- `422 Unprocessable Entity` - Date of birth mismatch

---

### POST /api/v1/kyc/upload-document
**Description**: Upload identity document for OCR and validation

**Request**: `multipart/form-data`
```
document_type: "RG" | "CNH" | "RNE"
document_number: "string"
file: <image file>
```

**Response** (200 OK):
```json
{
  "verified": true,
  "extracted_data": {
    "full_name": "MATEO VERIFIK",
    "document_number": "12.345.678-9",
    "issue_date": "2020-01-15",
    "expiry_date": "2030-01-15"
  },
  "document_url": "s3://encrypted/path"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid file type (only JPG, PNG, PDF accepted)
- `413 Payload Too Large` - File exceeds 10MB
- `422 Unprocessable Entity` - Document unreadable or tampered

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
  "verified": true,
  "face_match_score": 92,
  "liveness_score": 98,
  "selfie_url": "s3://encrypted/path"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid image format
- `422 Unprocessable Entity` - Liveness check failed (deepfake detected)
- `422 Unprocessable Entity` - Face match score below threshold (< 85%)

---

### GET /api/v1/kyc/status
**Description**: Get current KYC verification status

**Request**: No body (authenticated user)

**Response** (200 OK):
```json
{
  "status": "in_progress",
  "verification_level": "none",
  "completed_steps": ["cpf", "document"],
  "remaining_steps": ["facial", "aml"],
  "attempt_count": 1,
  "can_resubmit": true
}
```

---

### POST /api/v1/kyc/verify-cnpj
**Description**: Verify company CNPJ (admin only)

**Request**:
```json
{
  "cnpj": "09.159.197/0001-80"
}
```

**Response** (200 OK):
```json
{
  "verified": true,
  "company_data": {
    "legal_name": "VERIFIK LTDA",
    "trade_name": "Verifik",
    "cnpj": "09.159.197/0001-80",
    "company_status": "ATIVA",
    "legal_nature": "Sociedade Limitada",
    "opening_date": "2019-05-10",
    "main_activity": "Desenvolvimento de software",
    "address": {
      "street": "Rua Exemplo, 123",
      "city": "São Paulo",
      "state": "SP",
      "zip_code": "01000-000"
    }
  }
}
```

**Error Responses**:
- `400 Bad Request` - Invalid CNPJ format
- `404 Not Found` - CNPJ not found in Receita Federal
- `422 Unprocessable Entity` - Company is inactive or suspended

---

### POST /api/v1/kyc/webhook/verifik
**Description**: Webhook endpoint for Verifik async verification results

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

### BR-5: Company-Admin Linkage
- Admin user's personal CPF must be verified before CNPJ verification
- CNPJ verification is only required when admin creates first cap table
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
27. System displays CNPJ verification prompt
28. Admin enters company CNPJ
29. System calls POST /api/v1/kyc/verify-cnpj
30. Verifik validates CNPJ (< 3 seconds)
31. System displays company verified ✓
32. System redirects to cap table creation form
33. Admin can now create cap table

POSTCONDITION: Admin KYC approved, company CNPJ verified, cap table creation enabled
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
- Show user: "Verification is taking longer than usual. Please wait..."
- Retry API call up to 3 times with exponential backoff
- If all retries fail, show error and allow user to retry

### EC-2: Blurry Document Photo
**Scenario**: User uploads document photo that OCR cannot read
**Handling**:
- Return 422 error with message: "Document image is unclear. Please retake photo with good lighting and focus."
- Provide tips for better photo (flat surface, no glare, all corners visible)

### EC-3: Selfie with Mask/Sunglasses
**Scenario**: User submits selfie wearing mask or sunglasses
**Handling**:
- Liveness detection fails
- Return error: "Please remove any face coverings (masks, sunglasses) and retake photo."

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
- Immediately reject KYC
- Set status = "rejected"
- Set rejection_reason = "Unable to verify identity. Please contact support."
- Do NOT disclose sanctions match to user (regulatory requirement)
- Notify compliance team immediately

### EC-7: Duplicate CPF Across Users
**Scenario**: New user tries to verify CPF already linked to another user
**Handling**:
- Check database for existing CPF
- If found, reject with error: "This CPF is already registered. Please log in to existing account."

### EC-8: Expired Identity Document
**Scenario**: OCR detects document expiry date is in the past
**Handling**:
- Reject document verification
- Return error: "Document has expired. Please upload a valid, non-expired document."

---

## Dependencies

### Internal Dependencies
- **Authentication**: KYC flow requires authenticated user session
- **Cap Table Management**: Cap table creation is gated by KYC approval
- **Shareholder Registry**: Shareholder records inherit verified CPF/CNPJ data
- **Notifications**: KYC status changes trigger email notifications

### External Dependencies
- **Verifik API**: Identity verification service
  - Base URL: https://api.verifik.co/v2/
  - Sandbox: https://api-sandbox.verifik.co/v2/
  - SLA: 99.5% uptime
  - Performance: < 5 seconds per verification step
- **Receita Federal Database**: CPF/CNPJ validation (via Verifik)
- **AWS S3**: Encrypted storage for KYC documents
- **AWS KMS**: Encryption key management

---

## Technical Implementation

### Verifik Service (Backend)

```typescript
// /backend/src/kyc/verifik/verifik.service.ts

import { Injectable, HttpService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VerifIkService {
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
      const response = await this.httpService
        .get(`${this.apiUrl}/br/cedula`, {
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
        })
        .toPromise();

      return {
        verified: true,
        data: response.data.data,
        signature: response.data.signature,
      };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new NotFoundException('CPF not found in Receita Federal database');
      }
      throw new BadRequestException('CPF verification failed');
    }
  }

  async verifyCNPJ(cnpj: string) {
    const response = await this.httpService
      .get(`${this.apiUrl}/br/company`, {
        params: {
          documentType: 'CNPJ',
          documentNumber: cnpj.replace(/\D/g, ''),
        },
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          Accept: 'application/json',
        },
      })
      .toPromise();

    return {
      verified: true,
      companyData: response.data,
      signature: response.data.signature,
    };
  }

  async verifyDocument(file: Buffer, documentType: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);

    const response = await this.httpService
      .post(`${this.apiUrl}/documents/verify`, formData, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      })
      .toPromise();

    return response.data;
  }

  async verifyFace(selfieBuffer: Buffer, documentImageUrl: string) {
    const formData = new FormData();
    formData.append('selfie', selfieBuffer);
    formData.append('documentImageUrl', documentImageUrl);

    const response = await this.httpService
      .post(`${this.apiUrl}/face/match`, formData, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      })
      .toPromise();

    return {
      verified: response.data.matchScore >= 85,
      faceMatchScore: response.data.matchScore,
      livenessScore: response.data.livenessScore,
    };
  }

  async performAMLScreening(fullName: string, cpf: string, nationality: string) {
    const response = await this.httpService
      .post(
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
      )
      .toPromise();

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

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
      throw new ForbiddenException('KYC verification required. Please complete identity verification.');
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

type KYCStep = 'cpf' | 'document' | 'facial' | 'complete';

export default function KYCVerificationPage() {
  const [step, setStep] = useState<KYCStep>('cpf');
  const [cpfData, setCpfData] = useState(null);
  const router = useRouter();

  const handleCPFVerification = async (cpf: string, dob: string) => {
    try {
      const response = await fetch('/api/v1/kyc/verify-cpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, date_of_birth: dob }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const data = await response.json();
      setCpfData(data);
      setStep('document');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDocumentUpload = async (file: File, docType: string, docNumber: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', docType);
    formData.append('document_number', docNumber);

    try {
      const response = await fetch('/api/v1/kyc/upload-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Document verification failed');

      setStep('facial');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleFacialVerification = async (selfieBlob: Blob) => {
    const formData = new FormData();
    formData.append('selfie', selfieBlob);

    try {
      const response = await fetch('/api/v1/kyc/verify-face', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.verified && result.face_match_score >= 85) {
        setStep('complete');
        // Redirect to dashboard after 3 seconds
        setTimeout(() => router.push('/dashboard'), 3000);
      } else {
        alert(`Facial verification failed. Match score: ${result.face_match_score}%. Please retry.`);
      }
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="kyc-container">
      <h1>Identity Verification</h1>
      {step === 'cpf' && <CPFVerificationStep onSubmit={handleCPFVerification} />}
      {step === 'document' && <DocumentUploadStep onSubmit={handleDocumentUpload} cpfData={cpfData} />}
      {step === 'facial' && <FacialRecognitionStep onSubmit={handleFacialVerification} />}
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
| [company-cnpj-validation.md](./company-cnpj-validation.md) | CNPJ validation uses the same Verifik service for Receita Federal lookups |
| [option-exercises.md](./option-exercises.md) | Employees may need KYC before exercising options |
| [funding-rounds.md](./funding-rounds.md) | Investors need KYC before committing to rounds |
| [api-standards.md](../.claude/rules/api-standards.md) | KYC endpoints follow `/api/v1/kyc/*` global path pattern |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: `KYC_REQUIRED`, `KYC_CPF_INVALID`, `KYC_CPF_NOT_FOUND`, `KYC_CPF_DOB_MISMATCH`, `KYC_DOCUMENT_INVALID`, `KYC_DOCUMENT_EXPIRED`, `KYC_FACE_MATCH_FAILED`, `KYC_LIVENESS_CHECK_FAILED`, `KYC_AML_HIGH_RISK`, `KYC_PEP_DETECTED`, `KYC_SANCTIONS_MATCH`, `KYC_MAX_ATTEMPTS_EXCEEDED`, `KYC_VERIFIK_UNAVAILABLE` |
| [security.md](../.claude/rules/security.md) | PII handling for CPF, biometric data; KYC document encryption via AWS KMS; LGPD consent for KYC data collection |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: `KYC_STARTED`, `KYC_CPF_VERIFIED`, `KYC_CPF_FAILED`, `KYC_DOCUMENT_UPLOADED`, `KYC_FACE_VERIFIED`, `KYC_FACE_FAILED`, `KYC_AML_SCREENED`, `KYC_APPROVED`, `KYC_REJECTED` |
