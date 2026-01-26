# VelaFund MVP - Architecture Documentation

> **Platform Purpose**: Comprehensive cap table management platform for Brazilian companies (Sociedade Limitada and Sociedade Anônima) with on-chain record-keeping, OCT standard compliance, and Brazilian corporate law support.

## System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer - Vercel"
        Web[Next.js 14+ Frontend<br/>App Router + TypeScript<br/>shadcn/ui + Tailwind]
    end

    subgraph "Authentication & Identity"
        Privy[Privy Auth Service<br/>Email, Google, Apple OAuth]
        Wallet[Privy Embedded Wallets<br/>Server-side SDK]
    end

    subgraph "API Layer - Railway"
        API[NestJS REST API<br/>TypeScript]
        Auth[JWT Token Auth]
        BL[Business Logic Layer]
        Jobs[Bull Queue Jobs]
        DocGen[Document Generation<br/>Puppeteer + React]
    end

    subgraph "Data Layer - Railway"
        DB[(PostgreSQL 15+<br/>Users, Companies, Cap Tables<br/>Shareholders, Transactions<br/>OCT Data, Documents)]
        Redis[(Redis<br/>Bull Queues<br/>Cache)]
    end

    subgraph "Blockchain Layer - Base"
        Base[Base Network<br/>L2 Ethereum]
        OCP[OCP Smart Contracts<br/>+ Brazilian Extensions]
        AdminWallets[Admin Wallets<br/>One per Company]
        GasSponsorship[Privy Gas Sponsorship]
    end

    subgraph "External Services"
        S3[AWS S3<br/>Documents, PDFs, KYC Docs]
        SES[AWS SES<br/>Email Notifications]
    end

    Web -->|HTTPS/REST API| API
    Web -->|OAuth Flow| Privy
    Privy --> Wallet

    API -->|Verify JWT| Auth
    Auth <-->|Verify Access Token| Privy
    API --> BL
    BL --> DB
    BL --> Redis
    BL --> Jobs
    BL --> DocGen

    BL -->|Privy Server SDK| AdminWallets
    AdminWallets -->|Gasless Txns| GasSponsorship
    GasSponsorship --> Base
    BL -->|Read/Write via RPC| OCP
    OCP --> Base

    BL --> S3
    Jobs --> SES
    DocGen --> S3
```

## Technology Stack

### Frontend (Vercel)
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **State Management**: React Context + Hooks + TanStack Query
- **Styling**: Tailwind CSS + shadcn/ui components
- **Auth**: Privy React SDK
- **Blockchain**: viem (type-safe Ethereum library)
- **Form Handling**: React Hook Form + Zod validation
- **Internationalization**: next-intl (PT-BR / EN)

### Backend (Railway)
- **Framework**: NestJS 10+ (Node.js + TypeScript)
- **Language**: TypeScript 5.0+
- **Database**: PostgreSQL 15+ (Railway managed)
- **ORM**: Prisma (type-safe database access)
- **API Style**: RESTful API
- **Validation**: class-validator + Zod
- **Background Jobs**: Bull (Redis-backed queue)
- **File Storage**: AWS S3 via AWS SDK
- **Blockchain**: viem / ethers.js
- **Document Generation**: puppeteer + React Server Components
- **Decimal Math**: decimal.js (precise financial calculations)
- **Payment Processing**: Phase 1 uses off-platform payment (bank transfers) with admin confirmation. Future phases may integrate on-chain crypto payments.

**Why NestJS + TypeScript?**
- **Type Safety**: Compile-time validation for financial calculations (critical for cap table accuracy)
- **Shared Types**: Single source of truth for data schemas between frontend/backend
- **Better Web3 Integration**: Superior smart contract tooling (viem, ethers) compared to Python
- **Performance**: Non-blocking async I/O for blockchain operations
- **Developer Experience**: TypeScript across the entire stack
- **OCT Standard Compliance**: Type-safe JSON schema validation

### Authentication & Blockchain
- **Auth Provider**: Privy (Email, Google OAuth, Apple OAuth)
- **Wallet**: Privy Embedded Wallets (server-side SDK for admin wallets)
- **Backend Auth**: JWT Access Tokens (Privy-issued)
- **Blockchain**: Base Network (Ethereum L2)
- **Smart Contracts**: OCP (Open Cap Table Protocol) + Brazilian extensions
- **Gas Sponsorship**: Privy Gas Sponsorship for gasless transactions
- **RPC**: Base RPC (or Alchemy/Infura for Base)

### External Services
- **KYC/Identity Verification**: Verifik (CPF/CNPJ validation, facial recognition, liveness detection, AML screening)
- **File Storage**: AWS S3 (KYC documents, PDFs, legal documents)
- **Email**: AWS SES (notifications, document signature requests)
- **Monitoring**: Sentry (error tracking)

### Infrastructure
- **Frontend Hosting**: Vercel (auto-deploy from Git)
- **Backend Hosting**: Railway (NestJS + PostgreSQL + Redis)
- **CDN**: Vercel Edge Network
- **SSL**: Automatic (Vercel + Railway)
- **Environments**: Development, Staging, Production

## Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant NextJS as Next.js Frontend
    participant Privy as Privy Auth
    participant NestJS as NestJS API
    participant DB as PostgreSQL

    User->>NextJS: Click "Sign In"
    NextJS->>Privy: Open Privy Modal
    User->>Privy: Login (Email/Google/Apple)
    Privy->>Privy: Create Embedded Wallet
    Privy-->>NextJS: Access Token + Wallet Address

    NextJS->>NestJS: POST /api/v1/auth/login<br/>(Privy Access Token)
    NestJS->>Privy: Verify Access Token
    Privy-->>NestJS: Token Valid + User Data

    NestJS->>DB: Get or Create User
    Note over NestJS,DB: Store privy_user_id,<br/>wallet_address, email
    DB-->>NestJS: User Record

    NestJS-->>NextJS: User Profile + Session Info
    NextJS->>NextJS: Store auth state in Context
    NextJS-->>User: Redirect to Dashboard
```

## KYC & Identity Verification (Verifik Integration)

### Overview

VelaFund uses **Verifik**, an AI-powered identity verification platform specialized for Latin American markets, to ensure regulatory compliance with Brazilian KYC/AML requirements (BCB Circular 3.978/2020 and Resolução BCB 119/2021).

**Why Verifik?**
- Native Brazilian compliance (CPF/CNPJ validation via government databases)
- Direct integration with Receita Federal and Serpro databases
- Advanced liveness detection (critical for Brazil's high deepfake fraud rate)
- PEP and sanctions list screening
- LGPD (Lei Geral de Proteção de Dados) compliant
- Verified over 14 million users across Latin America

### Regulatory Context

Brazilian fintech regulations require:
- **CPF Validation**: Cross-check against Receita Federal database
- **Facial Recognition**: Match biometric data against CPF registry
- **Document Verification**: Validate authenticity of identity documents
- **Liveness Detection**: Prevent deepfakes and presentation attacks (Brazil has 5x more deepfake fraud than US)
- **UBO Identification**: Ultimate Beneficial Owner verification for companies
- **AML Screening**: Check against PEP, sanctions, and watchlists

### KYC Requirements by User Type

| User Type | KYC Timing | Verification Level | Platform Access Before KYC | Cap Table Creation |
|-----------|------------|-------------------|---------------------------|-------------------|
| **Admin** | After signup (not required immediately) | Standard (CPF + CNPJ + Document + Facial + Liveness) | ✅ Limited access (view only, settings) | ❌ Blocked until KYC complete |
| **Investor** | Immediately after signup | Standard (CPF + Document + Facial + Liveness) | ❌ Must complete KYC first | N/A |
| **Employee** | Immediately after signup | Standard (CPF + Document + Facial + Liveness) | ❌ Must complete KYC first | N/A |

### Verification Components

#### Individual Verification (CPF)
1. **CPF Validation**
   - Real-time verification against Receita Federal database
   - Validates CPF format, status (active/inactive), and authenticity
   - Returns official identity data (full name, date of birth)

2. **Document Upload & OCR**
   - Accepted documents: RG (Registro Geral), CNH (Driver's License), RNE (Foreign ID)
   - Advanced OCR extracts data from document
   - Validates document authenticity and detects tampering

3. **Facial Recognition & Liveness**
   - Single-image selfie capture (passive liveness)
   - 3D liveness detection prevents spoofing, deepfakes, masks
   - Face matching: Compare document photo with live selfie
   - Minimum match score: 85%

4. **AML Screening**
   - Screen against Brazilian and international watchlists
   - PEP (Politically Exposed Persons) database
   - OFAC, Interpol, DEA sanctions lists
   - SIMIT (Brazilian fines and sanctions system)

#### Company Verification (CNPJ)
Required when admin creates first cap table:

1. **CNPJ Validation**
   - Verify against Receita Federal database
   - Confirm company is active and in good standing
   - Extract company data: legal name, address, activities, opening date

2. **Legal Status Check**
   - Verify legal nature (Ltda., S.A.)
   - Confirm operational status
   - Validate main and secondary activity codes

3. **UBO Identification**
   - Identify Ultimate Beneficial Owners
   - Link personal CPF verification to company ownership
   - Required for AML compliance

### KYC Status States

```typescript
enum KYCStatus {
  NOT_STARTED = 'not_started',       // User created account, KYC not initiated
  IN_PROGRESS = 'in_progress',       // User started verification process
  PENDING_REVIEW = 'pending_review', // Submitted, awaiting Verifik result
  APPROVED = 'approved',             // Verification successful
  REJECTED = 'rejected',             // Verification failed
  RESUBMISSION_REQUIRED = 'resubmission_required' // User needs to retry
}

enum VerificationLevel {
  NONE = 'none',
  BASIC = 'basic',         // CPF validation only
  STANDARD = 'standard',   // CPF + Document + Facial + Liveness
  ENHANCED = 'enhanced'    // Standard + AML screening
}
```

### Authentication & KYC Flow

```mermaid
sequenceDiagram
    participant User
    participant NextJS as Next.js Frontend
    participant Privy as Privy Auth
    participant NestJS as NestJS API
    participant Verifik as Verifik KYC
    participant DB as PostgreSQL

    %% Initial Signup
    User->>NextJS: Sign up (Email/Google/Apple)
    NextJS->>Privy: Create account
    Privy-->>NextJS: Access Token + Wallet
    NextJS->>NestJS: POST /api/v1/auth/register
    NestJS->>DB: Create user (kyc_status: not_started)
    NestJS-->>NextJS: User profile

    %% KYC Check based on user type
    alt User is Admin
        NextJS->>NextJS: Allow dashboard access (view only)
        Note over NextJS: Admin can view but not create cap table

        User->>NextJS: Clicks "Create Cap Table"
        NextJS-->>User: Redirect to KYC verification
    else User is Investor/Employee
        NextJS-->>User: Redirect to KYC verification immediately
        Note over NextJS: Must complete KYC before platform access
    end

    %% KYC Verification Flow
    User->>NextJS: Start KYC verification
    NextJS->>NestJS: POST /api/v1/kyc/start
    NestJS->>DB: Update kyc_status = 'in_progress'
    NestJS-->>NextJS: Verification session ID

    %% Step 1: CPF Validation
    User->>NextJS: Enter CPF + Date of Birth
    NextJS->>NestJS: POST /api/v1/kyc/verify-cpf
    NestJS->>Verifik: GET /v2/br/cedula
    Verifik->>Verifik: Check Receita Federal database
    Verifik-->>NestJS: CPF data + certified signature
    NestJS->>DB: Store CPF verification result
    NestJS-->>NextJS: CPF validated ✓

    %% Step 2: Document Upload
    User->>NextJS: Upload ID document (RG/CNH)
    NextJS->>NestJS: POST /api/v1/kyc/upload-document
    NestJS->>Verifik: Submit document for OCR
    Verifik->>Verifik: Extract data, validate authenticity
    Verifik-->>NestJS: Document data + validation result
    NestJS->>DB: Store document verification
    NestJS-->>NextJS: Document validated ✓

    %% Step 3: Facial Recognition
    User->>NextJS: Take selfie
    NextJS->>NestJS: POST /api/v1/kyc/verify-face
    NestJS->>Verifik: Submit selfie + liveness check
    Verifik->>Verifik: 3D liveness detection<br/>Face matching with document
    Verifik-->>NestJS: Liveness result + match score
    NestJS->>DB: Store facial verification
    NestJS-->>NextJS: Facial verification complete ✓

    %% Step 4: AML Screening
    NestJS->>Verifik: Screen against PEP/sanctions lists
    Verifik->>Verifik: Check watchlists, OFAC, Interpol
    Verifik-->>NestJS: Risk assessment + screening result
    NestJS->>DB: Store AML screening result

    %% Final Result
    alt All checks passed
        NestJS->>DB: Update kyc_status = 'approved'
        NestJS->>NextJS: KYC approved ✓
        NextJS-->>User: "Verification successful! Access granted"

        alt User is Admin creating cap table
            User->>NextJS: Enter company CNPJ
            NextJS->>NestJS: POST /api/v1/kyc/verify-cnpj
            NestJS->>Verifik: GET /v2/br/company
            Verifik-->>NestJS: Company data + validation
            NestJS->>DB: Store company verification
            NestJS-->>NextJS: Company verified ✓
            NextJS-->>User: Proceed to cap table creation
        end
    else Verification failed
        NestJS->>DB: Update kyc_status = 'rejected' or 'resubmission_required'
        NestJS-->>NextJS: KYC failed (reason)
        NextJS-->>User: "Verification failed. Please retry"
    end
```

### Backend Architecture

#### KYC Service Module

```
backend/src/kyc/
├── kyc.module.ts
├── kyc.controller.ts
├── kyc.service.ts
├── verifik/
│   ├── verifik.service.ts        # Verifik API integration
│   ├── verifik.client.ts         # HTTP client for Verifik
│   └── verifik.types.ts          # TypeScript types for Verifik API
├── validators/
│   ├── cpf.validator.ts          # CPF format validation
│   ├── cnpj.validator.ts         # CNPJ format validation
│   └── document.validator.ts     # Document type validation
├── processors/
│   ├── kyc-verification.processor.ts  # Background job for async verification
│   └── aml-screening.processor.ts     # AML screening background job
├── guards/
│   ├── kyc-required.guard.ts     # Guard to enforce KYC completion
│   └── kyc-approved.guard.ts     # Guard for KYC-approved routes
└── dto/
    ├── verify-cpf.dto.ts
    ├── verify-cnpj.dto.ts
    ├── upload-document.dto.ts
    └── verify-face.dto.ts
```

#### Database Schema Additions

```typescript
// Prisma Schema additions

model User {
  // ... existing fields
  kycStatus          KYCStatus          @default(NOT_STARTED)
  verificationLevel  VerificationLevel  @default(NONE)
  kycVerifications   KYCVerification[]
  kycApprovedAt      DateTime?
  kycRejectedAt      DateTime?
  kycRejectionReason String?
}

model KYCVerification {
  id                 String            @id @default(uuid())
  userId             String
  user               User              @relation(fields: [userId], references: [id])

  // CPF Verification
  cpfNumber          String?
  cpfVerified        Boolean           @default(false)
  cpfVerifiedAt      DateTime?
  cpfData            Json?             // Certified data from Receita Federal

  // Document Verification
  documentType       String?           // RG, CNH, RNE
  documentNumber     String?
  documentVerified   Boolean           @default(false)
  documentVerifiedAt DateTime?
  documentS3Url      String?           // Encrypted document storage
  documentData       Json?             // OCR extracted data

  // Facial Verification
  faceVerified       Boolean           @default(false)
  faceVerifiedAt     DateTime?
  faceMatchScore     Decimal?          // 0-100 match score
  livenessScore      Decimal?          // 0-100 liveness score
  selfieS3Url        String?           // Encrypted selfie storage

  // AML Screening
  amlScreeningDone   Boolean           @default(false)
  amlScreeningAt     DateTime?
  amlRiskScore       String?           // LOW, MEDIUM, HIGH
  isPEP              Boolean           @default(false)
  sanctionsMatch     Boolean           @default(false)
  amlScreeningData   Json?

  // Verifik Integration
  verifIkSessionId   String?
  verifIkSignature   String?           // Certified signature from Verifik

  // Metadata
  status             KYCStatus
  submittedAt        DateTime?
  approvedAt         DateTime?
  rejectedAt         DateTime?
  rejectionReason    String?

  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt

  @@index([userId])
}

model CompanyKYC {
  id                 String            @id @default(uuid())
  companyId          String            @unique
  company            Company           @relation(fields: [companyId], references: [id])

  // CNPJ Verification
  cnpj               String            @unique
  cnpjVerified       Boolean           @default(false)
  cnpjVerifiedAt     DateTime?
  legalName          String?
  tradeName          String?
  companyStatus      String?           // ATIVA, INATIVA
  legalNature        String?
  openingDate        DateTime?
  mainActivityCode   String?
  mainActivityDesc   String?
  address            Json?
  cnpjData           Json?             // Full certified data from Receita Federal

  // UBO (Ultimate Beneficial Owner)
  uboIdentified      Boolean           @default(false)
  uboData            Json?             // Array of UBOs with CPF links

  // Verifik Integration
  verifIkSignature   String?

  // Status
  status             KYCStatus
  approvedAt         DateTime?
  rejectedAt         DateTime?

  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
}
```

### API Endpoints

#### KYC Endpoints

```typescript
// Start KYC verification process
POST /api/v1/kyc/start
Response: { sessionId, status }

// Verify CPF with Verifik
POST /api/v1/kyc/verify-cpf
Body: { cpf: string, dateOfBirth: string }
Response: { verified: boolean, data: {...} }

// Upload identity document
POST /api/v1/kyc/upload-document
Body: FormData (documentType, documentNumber, file)
Response: { verified: boolean, extractedData: {...} }

// Submit selfie for facial recognition
POST /api/v1/kyc/verify-face
Body: FormData (selfie image)
Response: { verified: boolean, matchScore: number, livenessScore: number }

// Get KYC status
GET /api/v1/kyc/status
Response: { status, verificationLevel, completedSteps: [...] }

// Admin: Verify company CNPJ
POST /api/v1/kyc/verify-cnpj
Body: { cnpj: string }
Response: { verified: boolean, companyData: {...} }

// Webhook endpoint for Verifik callbacks
POST /api/v1/kyc/webhook/verifik
Body: (Verifik webhook payload)
Response: 200 OK
```

### Integration Configuration

#### Verifik SDK Setup

```typescript
// backend/src/kyc/verifik/verifik.service.ts

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
    const response = await this.httpService
      .get(`${this.apiUrl}/v2/br/cedula`, {
        params: {
          documentType: 'CPF',
          documentNumber: cpf,
          dateOfBirth: dateOfBirth,
        },
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          Accept: 'application/json',
        },
      })
      .toPromise();

    return {
      verified: true,
      data: response.data.data,
      signature: response.data.signature,
    };
  }

  async verifyCNPJ(cnpj: string) {
    const response = await this.httpService
      .get(`${this.apiUrl}/v2/br/company`, {
        params: {
          documentType: 'CNPJ',
          documentNumber: cnpj,
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

  async performAMLScreening(fullName: string, cpf: string, nationality: string) {
    // SmartEnroll AML screening endpoint
    const response = await this.httpService
      .post(
        `${this.apiUrl}/v2/screening`,
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

### Frontend KYC Flow

```typescript
// frontend/src/app/(dashboard)/kyc/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function KYCVerificationPage() {
  const [step, setStep] = useState(1);
  const router = useRouter();

  const handleCPFVerification = async (cpf: string, dob: string) => {
    const response = await fetch('/api/v1/kyc/verify-cpf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf, dateOfBirth: dob }),
    });

    if (response.ok) {
      setStep(2); // Move to document upload
    }
  };

  const handleDocumentUpload = async (file: File, docType: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', docType);

    const response = await fetch('/api/v1/kyc/upload-document', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      setStep(3); // Move to facial recognition
    }
  };

  const handleFacialVerification = async (selfieBlob: Blob) => {
    const formData = new FormData();
    formData.append('selfie', selfieBlob);

    const response = await fetch('/api/v1/kyc/verify-face', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (result.verified && result.matchScore >= 85) {
      router.push('/dashboard'); // KYC complete
    }
  };

  return (
    <div className="kyc-container">
      {step === 1 && <CPFVerificationStep onSubmit={handleCPFVerification} />}
      {step === 2 && <DocumentUploadStep onSubmit={handleDocumentUpload} />}
      {step === 3 && <FacialRecognitionStep onSubmit={handleFacialVerification} />}
    </div>
  );
}
```

### Security Considerations

1. **Data Encryption**
   - All documents and selfies encrypted at rest in S3
   - Use AWS KMS for encryption key management
   - Biometric data stored as hashes, not raw images

2. **API Security**
   - Verifik API token stored in environment variables
   - Never expose Verifik credentials to frontend
   - Rate limiting on KYC endpoints (max 5 attempts per hour)

3. **Privacy Compliance (LGPD)**
   - Explicit user consent before KYC data collection
   - Right to deletion: Users can request KYC data removal
   - Data minimization: Only collect necessary information
   - Data residency: Store KYC data in AWS São Paulo region

4. **Fraud Prevention**
   - Max 3 KYC submission attempts per user
   - Track failed attempts for suspicious patterns
   - Monitor for duplicate CPF submissions across users
   - Alert admins for high-risk AML screening results

### Error Handling

```typescript
enum KYCErrorCode {
  CPF_INVALID = 'cpf_invalid',
  CPF_NOT_FOUND = 'cpf_not_found',
  DOCUMENT_INVALID = 'document_invalid',
  FACE_MATCH_FAILED = 'face_match_failed',
  LIVENESS_CHECK_FAILED = 'liveness_check_failed',
  AML_HIGH_RISK = 'aml_high_risk',
  PEP_DETECTED = 'pep_detected',
  SANCTIONS_MATCH = 'sanctions_match',
  VERIFIK_API_ERROR = 'verifik_api_error',
  MAX_ATTEMPTS_EXCEEDED = 'max_attempts_exceeded',
}
```

### Monitoring & Analytics

- Track KYC completion rates by user type
- Monitor average verification time
- Alert on high rejection rates
- Track Verifik API performance and errors
- Dashboard for admin review of pending verifications

## Cap Table Transaction Flow (On-Chain Recording)

```mermaid
sequenceDiagram
    participant User
    participant NextJS as Next.js Frontend
    participant NestJS as NestJS API
    participant PrivySDK as Privy Server SDK
    participant GasSponsor as Privy Gas Sponsorship
    participant Base as Base Network
    participant DB as PostgreSQL
    participant Bull as Bull Queue

    User->>NextJS: Create Transaction<br/>(e.g., Share Issuance)
    NextJS->>NestJS: POST /api/v1/transactions<br/>{type, shareholder, shares, class}

    NestJS->>DB: Validate transaction rules
    Note over NestJS,DB: Check bylaws, restrictions,<br/>board approvals, dilution limits
    DB-->>NestJS: Validation passed

    NestJS->>DB: Create pending transaction record

    NestJS->>PrivySDK: Get company admin wallet
    PrivySDK-->>NestJS: Wallet instance

    NestJS->>NestJS: Prepare smart contract call<br/>(OCP issueShares function)
    NestJS->>PrivySDK: Sign & send transaction
    PrivySDK->>GasSponsor: Request gas sponsorship
    Note over GasSponsor: Privy sponsors gas fees

    GasSponsor->>Base: Execute transaction
    Base-->>GasSponsor: Transaction hash

    GasSponsor-->>NestJS: Transaction submitted
    NestJS-->>NextJS: {status: "pending", tx_hash}
    NextJS-->>User: "Transaction processing..."

    NestJS->>Bull: Queue transaction monitoring job

    loop Poll for confirmation
        Bull->>Base: Check transaction status
        Base-->>Bull: Status update
    end

    Base-->>Bull: Transaction confirmed
    Bull->>DB: Update transaction status = "confirmed"
    Bull->>DB: Update cap table state
    Bull->>DB: Create historical snapshot
    Bull->>Bull: Trigger email notification job
```

## Document Generation & Signature Flow

```mermaid
sequenceDiagram
    participant User
    participant NextJS as Next.js Frontend
    participant NestJS as NestJS API
    participant DocService as Document Service
    participant Puppeteer as Puppeteer
    participant PrivySDK as Privy SDK
    participant Base as Base Network
    participant S3 as AWS S3
    participant DB as PostgreSQL

    User->>NextJS: Fill document form<br/>(e.g., Shareholder Agreement)
    NextJS->>NextJS: Real-time preview
    User->>NextJS: Submit for generation

    NextJS->>NestJS: POST /api/v1/documents/generate<br/>{template_id, form_data}

    NestJS->>DocService: Generate document
    DocService->>DocService: Render React template<br/>with form data
    DocService->>Puppeteer: Convert to PDF
    Puppeteer-->>DocService: PDF Buffer

    DocService->>DocService: Calculate document hash
    DocService->>S3: Upload PDF
    S3-->>DocService: S3 URL

    DocService->>DB: Store document record<br/>(hash, url, metadata)
    NestJS-->>NextJS: {document_id, preview_url}

    NextJS-->>User: Show document preview
    User->>NextJS: Request signatures

    NextJS->>NestJS: POST /api/v1/documents/{id}/request-signatures<br/>{signers: [address1, address2]}

    NestJS->>DB: Create signature requests
    NestJS->>Bull: Queue email notifications

    loop For each signer
        User->>NextJS: Sign document
        NextJS->>PrivySDK: Sign EIP-712 typed data<br/>{documentHash, timestamp}
        PrivySDK-->>NextJS: Signature

        NextJS->>NestJS: POST /api/v1/documents/{id}/signatures<br/>{signer, signature}
        NestJS->>DB: Store signature
    end

    alt All signatures collected
        NestJS->>Base: Anchor document hash on-chain
        Base-->>NestJS: Transaction hash
        NestJS->>DB: Mark document as fully signed
        NestJS->>Bull: Queue completion notification
    end
```

## Architecture Decisions Summary

### ✅ Confirmed Decisions

1. **Frontend Architecture**
   - ✅ Next.js 14+ App Router
   - ✅ React Context + Hooks + TanStack Query for state management
   - ✅ Tailwind CSS + shadcn/ui
   - ✅ TypeScript
   - ✅ Deployed on Vercel

2. **API Design**
   - ✅ RESTful API
   - ✅ No real-time updates (polling/manual refresh for MVP)
   - ✅ Standard REST conventions

3. **Backend Architecture**
   - ✅ NestJS + TypeScript (for type safety in financial calculations)
   - ✅ Prisma ORM (type-safe database access)
   - ✅ Bull for background jobs (Redis-backed)
   - ✅ Modular architecture (domain-driven design)

4. **Backend Authentication**
   - ✅ Privy JWT Access Tokens
   - ✅ NestJS verifies tokens via Privy API
   - ✅ User profile synced on first login

5. **Blockchain Integration**
   - ✅ Base Network (Ethereum L2)
   - ✅ Backend-only smart contract interaction
   - ✅ Privy Server SDK for admin wallet control
   - ✅ Privy Gas Sponsorship for gasless transactions
   - ✅ OCP (Open Cap Table Protocol) as foundation
   - ✅ Brazilian extensions for Ltda./S.A. structures

6. **Deployment & Infrastructure**
   - ✅ Frontend: Vercel
   - ✅ Backend: Railway (NestJS + PostgreSQL + Redis)
   - ✅ Database: Railway managed PostgreSQL
   - ✅ Auto SSL via platform providers

7. **Data Flow & Jobs**
   - ✅ Bull queue for background jobs (Redis-backed)
   - ✅ Transaction monitoring via polling
   - ✅ Event-driven cap table sync

8. **External Services**
   - ✅ AWS S3 for file storage
   - ✅ AWS SES for email notifications

9. **Domain Entities**
   - ✅ Users (Investors, Employees, Shareholders)
   - ✅ Companies (Ltda. / S.A.)
   - ✅ Shareholders (CPF/CNPJ, tax residency)
   - ✅ Share Classes (quotas, ações ordinárias, ações preferenciais)
   - ✅ Cap Tables (on-chain + off-chain mirror)
   - ✅ Transactions (issuances, transfers, conversions)
   - ✅ Investment Instruments (Mútuo conversível, Investimento-Anjo, MISTO/MAIS)
   - ✅ Funding Rounds
   - ✅ Option Plans & Grants
   - ✅ Vesting Schedules
   - ✅ Documents & Templates
   - ✅ Signatures (Ethereum EIP-712)
   - ✅ Historical Snapshots

## Database Schema (ERD)

```mermaid
erDiagram
    User ||--o{ CompanyRole : has
    User ||--o{ Shareholder : is
    User ||--o{ OptionGrant : receives
    User ||--o{ Document : signs

    Company ||--|| CapTable : maintains
    Company ||--o{ ShareClass : defines
    Company ||--o{ Shareholder : has
    Company ||--o{ FundingRound : creates
    Company ||--o{ OptionPlan : maintains
    Company ||--|| AdminWallet : owns
    Company ||--o{ Document : generates

    CapTable ||--o{ CapTableEntry : contains
    CapTable ||--o{ HistoricalSnapshot : snapshots

    ShareClass ||--o{ CapTableEntry : tracks
    ShareClass ||--o{ Transaction : involves

    Shareholder ||--o{ CapTableEntry : owns
    Shareholder ||--o{ Transaction : participates_in

    Transaction ||--|| BlockchainTransaction : recorded_in
    Transaction }o--|| ShareClass : affects

    FundingRound ||--o{ ConvertibleInstrument : contains
    FundingRound ||--o{ Transaction : generates

    ConvertibleInstrument ||--o| Transaction : converts_to

    OptionPlan ||--o{ OptionGrant : contains
    OptionGrant ||--|| VestingSchedule : has
    OptionGrant ||--o{ OptionExerciseRequest : has_requests

    OptionExerciseRequest ||--o| Transaction : creates_when_confirmed

    Document ||--o{ Signature : requires
    Document ||--|| DocumentTemplate : from

    User {
        uuid id PK
        string privy_user_id UK
        string email UK
        string wallet_address UK
        string first_name
        string last_name
        string profile_picture_url
        string cpf_cnpj
        string nationality
        string tax_residency
        datetime created_at
        datetime updated_at
    }

    Company {
        uuid id PK
        string name
        enum entity_type
        string cnpj
        text description
        string logo_url
        date founded_date
        enum status
        jsonb oct_metadata
        datetime created_at
    }

    AdminWallet {
        uuid id PK
        uuid company_id FK
        string wallet_address UK
        string privy_wallet_id UK
        boolean is_active
        datetime created_at
    }

    CompanyRole {
        uuid id PK
        uuid user_id FK
        uuid company_id FK
        enum role
        jsonb permissions
        datetime created_at
    }

    ShareClass {
        uuid id PK
        uuid company_id FK
        string name
        enum type
        decimal votes_per_share
        decimal liquidation_preference_multiple
        boolean participating_rights
        boolean right_of_first_refusal
        jsonb oct_data
        string blockchain_token_id
        datetime created_at
    }

    Shareholder {
        uuid id PK
        uuid company_id FK
        uuid user_id FK
        string legal_name
        string cpf_cnpj
        string wallet_address
        text address
        string nationality
        string tax_residency
        enum shareholder_type
        datetime created_at
    }

    CapTable {
        uuid id PK
        uuid company_id FK
        decimal total_shares
        integer total_shareholders
        jsonb oct_data
        datetime last_updated
        string blockchain_state_hash
    }

    CapTableEntry {
        uuid id PK
        uuid cap_table_id FK
        uuid shareholder_id FK
        uuid share_class_id FK
        decimal shares
        decimal percentage
        decimal voting_power
        datetime acquired_at
        datetime updated_at
    }

    HistoricalSnapshot {
        uuid id PK
        uuid cap_table_id FK
        timestamp snapshot_date
        jsonb oct_data
        jsonb entries
        string blockchain_state_hash
        datetime created_at
    }

    Transaction {
        uuid id PK
        uuid company_id FK
        enum transaction_type
        uuid from_shareholder_id FK
        uuid to_shareholder_id FK
        uuid share_class_id FK
        decimal quantity
        decimal price_per_share
        text notes
        enum status
        datetime occurred_at
        datetime created_at
    }

    BlockchainTransaction {
        uuid id PK
        uuid transaction_id FK
        string transaction_hash UK
        string from_address
        string to_address
        string contract_address
        jsonb transaction_data
        enum status
        integer block_number
        datetime submitted_at
        datetime confirmed_at
    }

    FundingRound {
        uuid id PK
        uuid company_id FK
        string name
        enum round_type
        decimal target_amount
        decimal current_amount
        decimal pre_money_valuation
        decimal post_money_valuation
        date start_date
        date end_date
        enum status
        datetime created_at
    }

    ConvertibleInstrument {
        uuid id PK
        uuid funding_round_id FK
        uuid shareholder_id FK
        enum instrument_type
        decimal principal_amount
        decimal interest_rate
        decimal discount_rate
        decimal valuation_cap
        date maturity_date
        jsonb conversion_terms
        enum status
        datetime created_at
    }

    OptionPlan {
        uuid id PK
        uuid company_id FK
        string name
        decimal total_options
        decimal options_granted
        decimal options_exercised
        decimal options_available
        enum status
        datetime created_at
    }

    OptionGrant {
        uuid id PK
        uuid option_plan_id FK
        uuid user_id FK
        decimal quantity
        decimal strike_price
        date grant_date
        date expiration_date
        enum status
        datetime created_at
    }

    VestingSchedule {
        uuid id PK
        uuid option_grant_id FK
        date vesting_start_date
        integer cliff_months
        integer vesting_months
        enum vesting_frequency
        boolean single_trigger_acceleration
        boolean double_trigger_acceleration
        jsonb custom_schedule
        datetime created_at
    }

    OptionExerciseRequest {
        uuid id PK
        uuid option_grant_id FK
        uuid user_id FK
        decimal quantity_requested
        decimal amount_due
        enum status
        datetime requested_at
        datetime payment_confirmed_at
        uuid confirmed_by_user_id FK
        string payment_reference
        text payment_notes
        string blockchain_tx_hash
        datetime created_at
    }

    DocumentTemplate {
        uuid id PK
        string name
        enum document_type
        string version
        jsonb template_schema
        text template_content
        boolean is_active
        datetime created_at
    }

    Document {
        uuid id PK
        uuid company_id FK
        uuid template_id FK
        string title
        enum document_type
        string s3_url
        string document_hash
        jsonb form_data
        enum status
        string blockchain_tx_hash
        datetime generated_at
        datetime finalized_at
    }

    Signature {
        uuid id PK
        uuid document_id FK
        uuid user_id FK
        string wallet_address
        string signature
        string signature_type
        timestamp signed_at
        datetime created_at
    }
```

## Project Structure

### Frontend (`/frontend`)
```
frontend/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/              # Auth route group
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/         # Protected routes
│   │   │   ├── companies/
│   │   │   │   └── [id]/
│   │   │   │       ├── cap-table/
│   │   │   │       ├── shareholders/
│   │   │   │       ├── transactions/
│   │   │   │       ├── rounds/
│   │   │   │       ├── options/
│   │   │   │       ├── documents/
│   │   │   │       └── reports/
│   │   │   └── settings/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── auth/                # Auth-related components
│   │   ├── cap-table/           # Cap table components
│   │   ├── shareholders/        # Shareholder components
│   │   ├── documents/           # Document components
│   │   ├── options/             # Option plan components
│   │   └── shared/              # Shared components
│   ├── lib/
│   │   ├── privy.ts            # Privy config
│   │   ├── api-client.ts       # NestJS API client
│   │   ├── utils.ts            # Utilities
│   │   ├── constants.ts
│   │   └── viem.ts             # Blockchain client
│   ├── hooks/
│   │   ├── use-auth.ts         # Auth context hook
│   │   ├── use-cap-table.ts
│   │   ├── use-transactions.ts
│   │   └── use-documents.ts
│   ├── contexts/
│   │   └── auth-context.tsx    # Auth state management
│   ├── types/
│   │   ├── user.ts
│   │   ├── company.ts
│   │   ├── cap-table.ts
│   │   ├── shareholder.ts
│   │   ├── transaction.ts
│   │   ├── oct.ts              # OCT standard types
│   │   └── document.ts
│   ├── messages/               # i18n translations
│   │   ├── en.json
│   │   └── pt-BR.json
│   └── styles/
│       └── globals.css
├── public/
│   ├── images/
│   └── icons/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

### Backend (`/backend`)
```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   └── privy.strategy.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── decorators/
│   │       ├── current-user.decorator.ts
│   │       └── roles.decorator.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   ├── kyc/
│   │   ├── kyc.module.ts
│   │   ├── kyc.controller.ts
│   │   ├── kyc.service.ts
│   │   ├── verifik/
│   │   │   ├── verifik.service.ts
│   │   │   ├── verifik.client.ts
│   │   │   └── verifik.types.ts
│   │   ├── validators/
│   │   │   ├── cpf.validator.ts
│   │   │   ├── cnpj.validator.ts
│   │   │   └── document.validator.ts
│   │   ├── processors/
│   │   │   ├── kyc-verification.processor.ts
│   │   │   └── aml-screening.processor.ts
│   │   ├── guards/
│   │   │   ├── kyc-required.guard.ts
│   │   │   └── kyc-approved.guard.ts
│   │   └── dto/
│   │       ├── verify-cpf.dto.ts
│   │       ├── verify-cnpj.dto.ts
│   │       ├── upload-document.dto.ts
│   │       └── verify-face.dto.ts
│   ├── companies/
│   │   ├── companies.module.ts
│   │   ├── companies.controller.ts
│   │   ├── companies.service.ts
│   │   └── dto/
│   ├── shareholders/
│   │   ├── shareholders.module.ts
│   │   ├── shareholders.controller.ts
│   │   ├── shareholders.service.ts
│   │   └── dto/
│   ├── share-classes/
│   │   ├── share-classes.module.ts
│   │   ├── share-classes.controller.ts
│   │   ├── share-classes.service.ts
│   │   └── dto/
│   ├── cap-table/
│   │   ├── cap-table.module.ts
│   │   ├── cap-table.controller.ts
│   │   ├── cap-table.service.ts
│   │   ├── calculations/
│   │   │   ├── ownership.calculator.ts
│   │   │   ├── dilution.calculator.ts
│   │   │   └── waterfall.calculator.ts
│   │   ├── oct/
│   │   │   ├── oct.service.ts
│   │   │   ├── oct.validator.ts
│   │   │   └── oct.exporter.ts
│   │   └── dto/
│   ├── transactions/
│   │   ├── transactions.module.ts
│   │   ├── transactions.controller.ts
│   │   ├── transactions.service.ts
│   │   ├── validators/
│   │   │   ├── transaction.validator.ts
│   │   │   └── transfer-restrictions.validator.ts
│   │   └── dto/
│   ├── funding-rounds/
│   │   ├── funding-rounds.module.ts
│   │   ├── funding-rounds.controller.ts
│   │   ├── funding-rounds.service.ts
│   │   └── dto/
│   ├── convertible-instruments/
│   │   ├── convertible-instruments.module.ts
│   │   ├── convertible-instruments.controller.ts
│   │   ├── convertible-instruments.service.ts
│   │   ├── types/
│   │   │   ├── mutuo-conversivel.ts
│   │   │   ├── investimento-anjo.ts
│   │   │   └── misto-mais.ts
│   │   └── dto/
│   ├── options/
│   │   ├── options.module.ts
│   │   ├── option-plans.controller.ts
│   │   ├── option-grants.controller.ts
│   │   ├── option-exercises.controller.ts
│   │   ├── option-plans.service.ts
│   │   ├── option-grants.service.ts
│   │   ├── option-exercises.service.ts
│   │   ├── vesting/
│   │   │   ├── vesting.calculator.ts
│   │   │   └── vesting.service.ts
│   │   └── dto/
│   │       ├── request-exercise.dto.ts
│   │       └── confirm-payment.dto.ts
│   ├── documents/
│   │   ├── documents.module.ts
│   │   ├── documents.controller.ts
│   │   ├── documents.service.ts
│   │   ├── templates/
│   │   │   ├── template.service.ts
│   │   │   ├── template.renderer.tsx
│   │   │   └── templates/
│   │   │       ├── shareholder-agreement.tsx
│   │   │       ├── share-certificate.tsx
│   │   │       ├── ata-assembleia.tsx
│   │   │       └── mutuo-conversivel.tsx
│   │   ├── generation/
│   │   │   ├── pdf.generator.ts
│   │   │   └── preview.service.ts
│   │   ├── signatures/
│   │   │   ├── signatures.controller.ts
│   │   │   ├── signatures.service.ts
│   │   │   └── ethereum-signature.validator.ts
│   │   └── dto/
│   ├── blockchain/
│   │   ├── blockchain.module.ts
│   │   ├── blockchain.service.ts
│   │   ├── contracts/
│   │   │   ├── ocp.contract.ts
│   │   │   ├── brazilian-cap-table.contract.ts
│   │   │   └── abis/
│   │   ├── admin-wallets/
│   │   │   ├── admin-wallet.service.ts
│   │   │   └── privy-wallet.provider.ts
│   │   ├── monitoring/
│   │   │   ├── transaction-monitor.service.ts
│   │   │   └── sync.service.ts
│   │   └── dto/
│   ├── reports/
│   │   ├── reports.module.ts
│   │   ├── reports.controller.ts
│   │   ├── reports.service.ts
│   │   ├── generators/
│   │   │   ├── cap-table-report.ts
│   │   │   ├── investor-report.ts
│   │   │   └── waterfall-report.ts
│   │   └── dto/
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.service.ts
│   │   ├── email/
│   │   │   ├── email.service.ts
│   │   │   └── templates/
│   │   └── dto/
│   ├── jobs/
│   │   ├── jobs.module.ts
│   │   ├── processors/
│   │   │   ├── transaction-monitor.processor.ts
│   │   │   ├── notification.processor.ts
│   │   │   └── cap-table-sync.processor.ts
│   │   └── queues/
│   │       ├── blockchain.queue.ts
│   │       └── email.queue.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── utils/
│   │       ├── decimal.utils.ts
│   │       ├── date.utils.ts
│   │       └── brazilian.utils.ts
│   └── config/
│       ├── database.config.ts
│       ├── redis.config.ts
│       ├── aws.config.ts
│       ├── privy.config.ts
│       └── blockchain.config.ts
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── test/
│   ├── unit/
│   └── e2e/
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env
```

## API Endpoints Overview

### Authentication
- `POST /api/v1/auth/login` - Login with Privy token
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user profile

### KYC & Identity Verification
- `POST /api/v1/kyc/start` - Start KYC verification session
- `POST /api/v1/kyc/verify-cpf` - Verify CPF with Verifik
- `POST /api/v1/kyc/verify-cnpj` - Verify company CNPJ
- `POST /api/v1/kyc/upload-document` - Upload identity document (RG/CNH/RNE)
- `POST /api/v1/kyc/verify-face` - Submit selfie for facial recognition
- `GET /api/v1/kyc/status` - Get current KYC verification status
- `POST /api/v1/kyc/webhook/verifik` - Webhook for Verifik callbacks
- `GET /api/v1/kyc/verifications` - List user's KYC verification attempts (admin)

### Companies
- `POST /api/v1/companies` - Create company
- `GET /api/v1/companies` - List user's companies
- `GET /api/v1/companies/:id` - Get company details
- `PUT /api/v1/companies/:id` - Update company
- `GET /api/v1/companies/:id/roles` - Get company roles

### Shareholders
- `POST /api/v1/companies/:id/shareholders` - Add shareholder
- `GET /api/v1/companies/:id/shareholders` - List shareholders
- `GET /api/v1/companies/:id/shareholders/:shareholderId` - Get shareholder details
- `PUT /api/v1/companies/:id/shareholders/:shareholderId` - Update shareholder
- `DELETE /api/v1/companies/:id/shareholders/:shareholderId` - Remove shareholder

### Share Classes
- `POST /api/v1/companies/:id/share-classes` - Create share class
- `GET /api/v1/companies/:id/share-classes` - List share classes
- `PUT /api/v1/companies/:id/share-classes/:classId` - Update share class

### Cap Table
- `GET /api/v1/companies/:id/cap-table` - Get current cap table
- `GET /api/v1/companies/:id/cap-table/fully-diluted` - Get fully-diluted cap table
- `GET /api/v1/companies/:id/cap-table/snapshot` - Get point-in-time snapshot
- `GET /api/v1/companies/:id/cap-table/history` - Get cap table history
- `GET /api/v1/companies/:id/cap-table/export/oct` - Export as OCT JSON
- `GET /api/v1/companies/:id/cap-table/export/pdf` - Export as PDF
- `POST /api/v1/companies/:id/cap-table/reconcile` - Reconcile on-chain/off-chain

### Transactions
- `POST /api/v1/companies/:id/transactions` - Create transaction
- `GET /api/v1/companies/:id/transactions` - List transactions
- `GET /api/v1/companies/:id/transactions/:txId` - Get transaction details
- `POST /api/v1/companies/:id/transactions/:txId/approve` - Approve transaction
- `POST /api/v1/companies/:id/transactions/:txId/cancel` - Cancel transaction
- `GET /api/v1/companies/:id/transactions/:txId/blockchain` - Get blockchain details

### Funding Rounds
- `POST /api/v1/companies/:id/rounds` - Create funding round
- `GET /api/v1/companies/:id/rounds` - List rounds
- `GET /api/v1/companies/:id/rounds/:roundId` - Get round details
- `PUT /api/v1/companies/:id/rounds/:roundId` - Update round
- `POST /api/v1/companies/:id/rounds/:roundId/close` - Close round
- `GET /api/v1/companies/:id/rounds/:roundId/proforma` - Get pro-forma cap table

### Convertible Instruments
- `POST /api/v1/companies/:id/convertibles` - Create convertible instrument
- `GET /api/v1/companies/:id/convertibles` - List convertible instruments
- `GET /api/v1/companies/:id/convertibles/:convertibleId` - Get details
- `POST /api/v1/companies/:id/convertibles/:convertibleId/convert` - Convert to equity
- `GET /api/v1/companies/:id/convertibles/scenarios` - Model conversion scenarios

### Option Plans
- `POST /api/v1/companies/:id/option-plans` - Create option plan
- `GET /api/v1/companies/:id/option-plans` - List option plans
- `GET /api/v1/companies/:id/option-plans/:planId` - Get plan details
- `PUT /api/v1/companies/:id/option-plans/:planId` - Update plan

### Option Grants
- `POST /api/v1/companies/:id/option-grants` - Create grant
- `GET /api/v1/companies/:id/option-grants` - List grants
- `GET /api/v1/companies/:id/option-grants/:grantId` - Get grant details
- `GET /api/v1/companies/:id/option-grants/:grantId/vesting` - Get vesting status

### Option Exercises
- `POST /api/v1/option-grants/:grantId/request-exercise` - Request option exercise (employee)
- `GET /api/v1/companies/:id/option-exercises` - List exercise requests (admin)
- `GET /api/v1/option-exercises/:requestId` - Get exercise request details
- `POST /api/v1/option-exercises/:requestId/confirm-payment` - Confirm payment received (admin only)
- `POST /api/v1/option-exercises/:requestId/cancel` - Cancel exercise request

### Documents
- `GET /api/v1/documents/templates` - List document templates
- `POST /api/v1/documents/generate` - Generate document from template
- `GET /api/v1/companies/:id/documents` - List company documents
- `GET /api/v1/documents/:docId` - Get document details
- `GET /api/v1/documents/:docId/preview` - Preview document
- `GET /api/v1/documents/:docId/download` - Download document
- `POST /api/v1/documents/:docId/request-signatures` - Request signatures
- `POST /api/v1/documents/:docId/signatures` - Submit signature
- `GET /api/v1/documents/:docId/signatures` - Get signature status

### Reports
- `GET /api/v1/companies/:id/reports/ownership` - Ownership report
- `GET /api/v1/companies/:id/reports/dilution` - Dilution analysis
- `GET /api/v1/companies/:id/reports/waterfall` - Exit waterfall
- `GET /api/v1/companies/:id/reports/due-diligence` - Due diligence package

## Smart Contract Architecture

### Base Contracts (OCP Foundation)

```solidity
// Open Cap Table Protocol (OCP) base contracts
// Source: https://github.com/Open-Cap-Table-Coalition/OCT-Protocol

interface IOCPIssuer {
    function issueShares(
        address to,
        uint256 classId,
        uint256 amount,
        bytes calldata data
    ) external returns (uint256 certificateId);

    function transferShares(
        address from,
        address to,
        uint256 classId,
        uint256 amount
    ) external;

    function getShareholderBalance(
        address shareholder,
        uint256 classId
    ) external view returns (uint256);
}
```

### Brazilian Extensions

```solidity
// BrazilianCapTable.sol
// Extends OCP for Brazilian Ltda. and S.A. structures

pragma solidity ^0.8.20;

import "./OCP/OCPIssuer.sol";

contract BrazilianCapTable is OCPIssuer {
    enum EntityType {
        LTDA,
        SA_CAPITAL_FECHADO,
        SA_CAPITAL_ABERTO
    }

    enum ShareType {
        QUOTA,                    // Sociedade Limitada (quotas)
        COMMON_SHARES,            // Ações Ordinárias (S.A. common shares)
        PREFERRED_SHARES          // Ações Preferenciais (S.A. preferred shares)
    }

    struct BrazilianShareClass {
        uint256 octClassId;           // Link to OCP class
        ShareType shareType;
        uint256 votingRights;         // Votes per share
        uint256 liquidationPreference; // Multiplier (1x, 2x)
        bool participatingRights;
        bool rightOfFirstRefusal;     // Direito de Preferência (right of first refusal)
        uint256 lockupPeriod;         // Lock-up in seconds
    }

    struct TransferRestriction {
        bool requiresBoardApproval;
        bool requiresShareholderApproval;
        uint256 minimumHoldingPeriod;
        address[] preferentialBuyers;
    }

    mapping(uint256 => BrazilianShareClass) public shareClasses;
    mapping(uint256 => TransferRestriction) public transferRestrictions;
    mapping(address => mapping(uint256 => uint256)) public lockupExpiry;

    event SharesIssued(
        address indexed to,
        uint256 indexed classId,
        uint256 amount,
        uint256 timestamp
    );

    event SharesTransferred(
        address indexed from,
        address indexed to,
        uint256 indexed classId,
        uint256 amount,
        uint256 timestamp
    );

    event TransferRestrictionEnforced(
        address indexed from,
        address indexed to,
        uint256 indexed classId,
        string reason
    );

    function createBrazilianShareClass(
        string memory name,
        ShareType shareType,
        uint256 votingRights,
        uint256 liquidationPreference,
        bool participatingRights,
        bool rightOfFirstRefusal
    ) external onlyAdmin returns (uint256 classId) {
        // Create OCP base class
        classId = _createOCPClass(name);

        // Add Brazilian extensions
        shareClasses[classId] = BrazilianShareClass({
            octClassId: classId,
            shareType: shareType,
            votingRights: votingRights,
            liquidationPreference: liquidationPreference,
            participatingRights: participatingRights,
            rightOfFirstRefusal: rightOfFirstRefusal,
            lockupPeriod: 0
        });
    }

    function issueSharesWithLockup(
        address to,
        uint256 classId,
        uint256 amount,
        uint256 lockupPeriod
    ) external onlyAdmin returns (uint256 certificateId) {
        certificateId = issueShares(to, classId, amount, "");

        if (lockupPeriod > 0) {
            lockupExpiry[to][classId] = block.timestamp + lockupPeriod;
        }

        emit SharesIssued(to, classId, amount, block.timestamp);
    }

    function transferWithRestrictions(
        address from,
        address to,
        uint256 classId,
        uint256 amount
    ) external {
        // Check lockup
        require(
            block.timestamp >= lockupExpiry[from][classId],
            "Shares are locked"
        );

        // Check right of first refusal (direito de preferência)
        BrazilianShareClass memory class = shareClasses[classId];
        if (class.rightOfFirstRefusal) {
            require(
                _preferentialRightsExercised(from, to, classId, amount),
                "Preferential rights not exercised"
            );
        }

        // Check transfer restrictions
        TransferRestriction memory restriction = transferRestrictions[classId];
        if (restriction.requiresBoardApproval) {
            require(
                _hasBoardApproval(from, to, classId, amount),
                "Board approval required"
            );
        }

        // Execute transfer
        transferShares(from, to, classId, amount);

        emit SharesTransferred(from, to, classId, amount, block.timestamp);
    }

    function _preferentialRightsExercised(
        address from,
        address to,
        uint256 classId,
        uint256 amount
    ) internal view returns (bool) {
        // Logic to check if existing shareholders had opportunity to buy
        // This would involve an off-chain process with on-chain confirmation
        // Implementation depends on business requirements
        return true; // Simplified
    }

    function _hasBoardApproval(
        address from,
        address to,
        uint256 classId,
        uint256 amount
    ) internal view returns (bool) {
        // Check if board has approved this specific transfer
        // Would use a separate approval mapping
        return true; // Simplified
    }
}
```

### Option Vesting Contract

#### Exercise Flow

The option exercise process uses a two-step workflow:
1. **Employee requests exercise** - Creates on-chain request with calculated amount due
2. **Admin confirms payment** - After receiving bank transfer, admin confirms and triggers share issuance

This approach separates payment processing (off-chain via bank transfer) from share issuance (on-chain via smart contract), providing flexibility while maintaining blockchain benefits for equity records.

```solidity
// BrazilianOptionPlan.sol

pragma solidity ^0.8.20;

contract BrazilianOptionPlan {
    struct VestingSchedule {
        uint256 totalOptions;
        uint256 startDate;
        uint256 cliffMonths;
        uint256 vestingMonths;
        uint256 exercisePrice;
        bool singleTriggerAcceleration;
        bool doubleTriggerAcceleration;
    }

    mapping(address => VestingSchedule) public grants;
    mapping(address => uint256) public exercised;

    event OptionGranted(
        address indexed employee,
        uint256 totalOptions,
        uint256 exercisePrice,
        uint256 timestamp
    );

    event OptionsExercised(
        address indexed employee,
        uint256 quantity,
        uint256 amountPaid,
        uint256 timestamp
    );

    function calculateVested(address employee) external view returns (uint256) {
        VestingSchedule memory schedule = grants[employee];

        if (block.timestamp < schedule.startDate) {
            return 0;
        }

        uint256 elapsedMonths = (block.timestamp - schedule.startDate) / 30 days;

        // Cliff check
        if (elapsedMonths < schedule.cliffMonths) {
            return 0;
        }

        // Calculate vested amount
        if (elapsedMonths >= schedule.vestingMonths) {
            return schedule.totalOptions;
        }

        return (schedule.totalOptions * elapsedMonths) / schedule.vestingMonths;
    }

    // Two-step exercise process: Request + Admin confirmation

    struct ExerciseRequest {
        address employee;
        uint256 quantity;
        uint256 amountDue;
        uint256 requestedAt;
        bool isPaid;
        bool isExecuted;
    }

    mapping(uint256 => ExerciseRequest) public exerciseRequests;
    uint256 public requestIdCounter;

    event ExerciseRequested(address indexed employee, uint256 requestId, uint256 quantity, uint256 amountDue);
    event PaymentConfirmed(uint256 indexed requestId, address indexed employee, uint256 quantity);

    // Step 1: Employee creates exercise request
    function requestExercise(uint256 quantity) external returns (uint256 requestId) {
        VestingSchedule memory schedule = grants[msg.sender];
        uint256 vested = this.calculateVested(msg.sender);
        uint256 exercisable = vested - exercised[msg.sender];

        require(quantity <= exercisable, "Insufficient vested options");

        uint256 totalCost = quantity * schedule.exercisePrice;

        requestId = requestIdCounter++;
        exerciseRequests[requestId] = ExerciseRequest({
            employee: msg.sender,
            quantity: quantity,
            amountDue: totalCost,
            requestedAt: block.timestamp,
            isPaid: false,
            isExecuted: false
        });

        emit ExerciseRequested(msg.sender, requestId, quantity, totalCost);
    }

    // Step 2: Admin confirms payment received off-chain
    function confirmPaymentAndIssueShares(uint256 requestId) external onlyAdmin {
        ExerciseRequest storage request = exerciseRequests[requestId];
        require(!request.isExecuted, "Already executed");
        require(!request.isPaid, "Already marked as paid");

        request.isPaid = true;
        request.isExecuted = true;

        exercised[request.employee] += request.quantity;

        // Issue shares in cap table contract
        // brazilianCapTable.issueShares(request.employee, commonClassId, request.quantity, "");

        emit PaymentConfirmed(requestId, request.employee, request.quantity);
        emit OptionsExercised(request.employee, request.quantity, request.amountDue, block.timestamp);
    }
}
```

## Option Exercise Flow (Payment Confirmation)

```mermaid
sequenceDiagram
    participant Employee
    participant NextJS as Next.js Frontend
    participant NestJS as NestJS API
    participant OptionContract as Option Plan Contract
    participant Admin
    participant CapTable as Cap Table Contract
    participant DB as PostgreSQL
    participant Email as Email Service

    Employee->>NextJS: Click "Exercise 10,000 options"
    NextJS->>NextJS: Show payment instructions<br/>(Bank details, amount due)
    Employee->>NextJS: Confirm request

    NextJS->>NestJS: POST /api/v1/option-grants/{id}/request-exercise<br/>{quantity: 10000}
    NestJS->>OptionContract: Call requestExercise(10000)
    OptionContract->>OptionContract: Validate exercisable amount
    OptionContract-->>NestJS: Request ID + Amount due

    NestJS->>DB: Store exercise request<br/>(status: "pending_payment")
    NestJS->>Email: Notify employee with payment instructions
    NestJS->>Email: Notify admin of exercise request
    NestJS-->>NextJS: {requestId, amountDue, bankDetails}
    NextJS-->>Employee: Show payment instructions

    Note over Employee,Admin: Employee makes bank transfer<br/>(outside platform - 1-3 days)

    Admin->>NextJS: Reviews pending exercises
    NextJS->>NestJS: GET /api/v1/option-exercises?status=pending
    NestJS->>DB: Fetch pending requests
    NestJS-->>NextJS: List of pending exercises

    Admin->>Admin: Verifies payment in bank account
    Admin->>NextJS: Click "Confirm Payment Received"

    NextJS->>NestJS: POST /api/v1/option-exercises/{id}/confirm-payment
    NestJS->>OptionContract: confirmPaymentAndIssueShares(requestId)
    OptionContract->>OptionContract: Mark as paid & executed
    OptionContract->>CapTable: issueShares(employee, quantity)
    CapTable-->>OptionContract: Shares issued
    OptionContract-->>NestJS: Transaction confirmed

    NestJS->>DB: Update exercise status = "completed"
    NestJS->>Email: Notify employee: "Shares issued!"
    NestJS-->>NextJS: Success
    NextJS-->>Admin: Exercise completed
```

## Security Considerations

### Authentication & Authorization
- All API endpoints require valid Privy JWT token (except public endpoints)
- NestJS guards verify token with Privy on each request
- Role-based access control (RBAC) for admin/finance/legal/investor permissions
- Wallet address tied to user account for blockchain verification

### Data Protection
- Sensitive documents encrypted in S3 with server-side encryption
- Database encryption at rest (Railway PostgreSQL)
- HTTPS/TLS for all communications
- CORS configured for Vercel frontend only
- API rate limiting via NestJS throttler

### Blockchain Security
- Private keys managed by Privy (never exposed to backend)
- Backend uses Privy Server SDK for controlled wallet access
- Transaction signing happens in secure Privy environment
- Gas sponsorship managed by Privy (prevents gas fee manipulation)
- Smart contract addresses validated before interaction
- Smart contract audits required before production deployment

### Financial Calculation Security
- TypeScript compile-time type checking for all calculations
- decimal.js for precise decimal math (no floating point errors)
- Transaction-level database guarantees (ACID compliance)
- Reconciliation checks between on-chain and off-chain data
- Extensive unit tests for waterfall and dilution calculations

### File Upload Security
- File type validation (PDF, PNG, JPG only)
- File size limits (max 10MB)
- Virus scanning before S3 upload
- Signed URLs for temporary document access
- S3 bucket policies restrict public access

### Brazilian Compliance (LGPD)
- Data minimization principles
- User consent tracking
- Right to deletion implementation
- Data processing logs
- Data residency considerations (AWS São Paulo region)

## Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_BASE_CHAIN_ID=8453
```

### Backend (.env)
```bash
# Node/NestJS
NODE_ENV=development
PORT=3001

# Database (Railway provides)
DATABASE_URL=postgresql://user:pass@host:port/db

# Redis (Railway provides)
REDIS_URL=redis://host:port

# Privy
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret
PRIVY_VERIFICATION_KEY=your_verification_key

# Verifik (KYC)
VERIFIK_API_URL=https://api.verifik.co/v2
VERIFIK_API_TOKEN=your_verifik_api_token
VERIFIK_WEBHOOK_SECRET=your_webhook_secret
VERIFIK_ENVIRONMENT=production

# AWS
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET_NAME=velafund-documents
AWS_REGION=sa-east-1

# AWS SES
AWS_SES_REGION=us-east-1
AWS_SES_FROM_EMAIL=noreply@velafund.com

# Base Network
BASE_RPC_URL=https://mainnet.base.org
BASE_CHAIN_ID=8453

# Smart Contracts
OCP_CAP_TABLE_ADDRESS=your_ocp_contract_address
BRAZILIAN_CAP_TABLE_ADDRESS=your_brazilian_contract_address
OPTION_PLAN_ADDRESS=your_option_plan_address

# CORS
CORS_ORIGINS=http://localhost:3000,https://your-app.vercel.app

# Security
JWT_SECRET=your_jwt_secret
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

## Deployment Checklist

### Frontend (Vercel)
- [ ] Connect GitHub repository
- [ ] Set environment variables in Vercel dashboard
- [ ] Configure build command: `npm run build`
- [ ] Set output directory: `.next`
- [ ] Enable automatic deployments on push to main
- [ ] Configure custom domain (optional)
- [ ] Set up preview deployments for PRs

### Backend (Railway)
- [ ] Create new project from GitHub
- [ ] Add PostgreSQL database service
- [ ] Add Redis service
- [ ] Set environment variables
- [ ] Configure build command: `npm run build`
- [ ] Set start command: `npm run start:prod`
- [ ] Enable auto-deployments
- [ ] Configure health check endpoint (`/health`)
- [ ] Set up database backups

### AWS Setup
- [ ] Create S3 bucket (sa-east-1 for LGPD compliance)
- [ ] Configure bucket policies (private access)
- [ ] Enable server-side encryption
- [ ] Set up IAM user with S3 permissions
- [ ] Create SES identity and verify domain
- [ ] Set up SES SMTP credentials
- [ ] Move SES out of sandbox mode

### Privy Setup
- [ ] Create Privy app in dashboard
- [ ] Enable Email, Google, Apple OAuth
- [ ] Configure embedded wallets
- [ ] Set up Base network support
- [ ] Enable gas sponsorship for Base transactions
- [ ] Configure allowed origins (Vercel URL)
- [ ] Get API keys and verification key
- [ ] Set up webhook endpoints (if needed)

### Verifik Setup (KYC)
- [ ] Create Verifik account at https://verifik.co
- [ ] Verify business account for production access
- [ ] Enable Brazilian verification modules (CPF, CNPJ, document validation)
- [ ] Configure liveness detection settings
- [ ] Enable AML screening features (PEP, sanctions lists)
- [ ] Get API token from dashboard
- [ ] Set up webhook endpoint for verification callbacks
- [ ] Configure webhook secret for payload verification
- [ ] Test in sandbox environment (https://api-sandbox.verifik.co/v2/)
- [ ] Move to production environment
- [ ] Set up monitoring for KYC completion rates
- [ ] Configure S3 bucket for encrypted KYC document storage (separate from main documents)

### Smart Contracts
- [ ] Write and test OCP extension contracts
- [ ] Write Brazilian cap table contracts
- [ ] Write option plan contracts
- [ ] Audit smart contracts (external auditor)
- [ ] Deploy to Base testnet
- [ ] Test all contract functions
- [ ] Deploy to Base mainnet
- [ ] Verify contracts on Basescan
- [ ] Set up contract monitoring

### Monitoring & Observability
- [ ] Set up Sentry for error tracking
- [ ] Configure log aggregation
- [ ] Set up uptime monitoring
- [ ] Configure alerting for critical errors
- [ ] Set up performance monitoring

## Next Steps

1. ✅ Architecture design complete
2. Initialize Next.js project with TypeScript and Tailwind
3. Initialize NestJS project with recommended structure
4. Set up Prisma with database models and migrations
5. Implement Privy authentication flow
6. Create core API endpoints (companies, shareholders, cap table)
7. Implement smart contract interaction layer
8. Build document generation system
9. Implement Ethereum signature workflow
10. Set up Bull queues for background jobs
11. Deploy to Vercel and Railway
12. Test end-to-end cap table flows

## OCT (Open Cap Table Coalition) Standard Implementation

### OCT Data Format
The platform stores cap table data in OCT-compatible JSON format as specified by the Open Cap Table Coalition standard. This ensures interoperability with other cap table systems and provides a standardized data structure.

### OCT Schema Storage
- Full OCT-format data stored in PostgreSQL JSONB columns
- Real-time validation against OCT JSON schema
- Historical snapshots maintained in OCT format
- Export functionality for OCT JSON files

### Brazilian Adaptations
- Map Ltda. quotas to OCT stock classes
- Map S.A. ações ordinárias/preferenciais to OCT share types
- Store Brazilian-specific fields in OCT custom extensions
- Maintain backward compatibility with standard OCT format

## Performance Requirements

- **Accuracy**: 100% accuracy required for all cap table calculations
- **Data Consistency**: Zero discrepancies between on-chain and off-chain data
- **Scalability**: Support up to 500 shareholders per company
- **Document Generation**: < 30 seconds per document
- **Page Load**: < 2 seconds for cap table views
- **Blockchain Sync**: < 30 seconds after on-chain confirmation
- **Report Generation**: < 10 seconds for standard reports

## Success Metrics

- Accurate cap table calculations (100% accuracy required)
- On-chain and off-chain data consistency (zero discrepancies)
- Document generation time < 30 seconds
- Page load time < 2 seconds
- Blockchain sync latency < 30 seconds after confirmation
- API response time < 500ms (p95)
- Zero financial calculation errors
