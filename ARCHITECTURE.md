# Navia MVP - Architecture Documentation

> **Platform Purpose**: Company Page product enabling Brazilian startups to create investor-ready company pages with AI-powered document intelligence, Open Finance bank connections, and an investor portal for post-investment tracking.

## System Architecture

```
                                   EXTERNAL SERVICES
                    ┌──────────────────────────────────────────────┐
                    │  Privy (Auth)     Verifik (KYC)              │
                    │  Claude API (AI)  BigDataCorp (Enrichment)   │
                    │  Open Finance APIs (Bank Data)               │
                    └──────────┬──────────────┬────────────────────┘
                               │              │
    CLIENT LAYER               │   API LAYER  │         DATA LAYER
   ┌──────────────┐  HTTPS  ┌──┴──────────────┴──┐   ┌──────────────────┐
   │              │────────>│                      │   │                  │
   │  Next.js 14  │         │   NestJS REST API    │──>│  PostgreSQL 15+  │
   │  App Router  │<────────│                      │   │  + pgvector      │
   │  TypeScript  │   JSON  │  ┌────────────────┐  │   │                  │
   │  shadcn/ui   │         │  │ Auth (Privy JWT)│  │   │  Users, Docs,   │
   │  Tailwind    │   SSE   │  │ Business Logic  │  │   │  Embeddings,    │
   │  TanStack Q  │<────────│  │ AI/RAG Engine   │  │   │  Financials     │
   │              │  stream │  │ SSE Streaming   │  │   └────────┬─────────┘
   └──────┬───────┘         │  └────────────────┘  │            │
          │                 │                      │   ┌────────┴─────────┐
          │  OAuth          │  ┌────────────────┐  │   │                  │
          └────────>Privy   │  │ Bull Queue Jobs │  │──>│  Redis           │
                            │  │ Doc Processing  │  │   │  Job Queues      │
                            │  │ Report Gen      │  │   │  Cache           │
                            │  │ Email Sending   │  │   └──────────────────┘
                            │  │ Audit Logging   │  │
                            │  └────────────────┘  │   ┌──────────────────┐
                            │                      │──>│  AWS S3           │
                            └──────────────────────┘   │  Documents, KYC   │
                                                       │  Reports          │
                              Vercel        Railway     └──────────────────┘
```

### Data Flow

```
 Founder uploads document                    Investor asks question
         │                                           │
         v                                           v
   POST /documents                            POST /chat (SSE)
         │                                           │
         v                                           v
   Store in S3 ──> Queue Processing Job       Generate query embedding
                        │                            │
                        v                            v
                   Extract text (PDF/OCR)     pgvector similarity search
                        │                    (scoped to company docs)
                        v                            │
                   Claude API classifies             v
                   + extracts metadata        Retrieve top-K chunks
                        │                            │
                        v                            v
                   Chunk at semantic          Claude API generates answer
                   boundaries                 (context + question)
                        │                            │
                        v                            v
                   Generate embeddings        Stream tokens via SSE
                        │                            │
                        v                            v
                   Store in pgvector          Display with citations
```

## Technology Stack

### Frontend (Vercel)
- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **State Management**: React Context + Hooks + TanStack Query
- **Styling**: Tailwind CSS + shadcn/ui components
- **Auth**: Privy React SDK
- **Form Handling**: React Hook Form + Zod validation
- **Internationalization**: next-intl (PT-BR / EN)
- **Streaming**: EventSource API for SSE (AI chat, report generation)
- **Charts**: Recharts (financial data visualization)

### Backend (Railway)
- **Framework**: NestJS 10+ (Node.js + TypeScript)
- **Language**: TypeScript 5.0+
- **Database**: PostgreSQL 15+ with pgvector extension (Railway managed)
- **ORM**: Prisma (type-safe database access)
- **API Style**: RESTful API + SSE for streaming responses
- **Validation**: class-validator + Zod
- **Background Jobs**: Bull (Redis-backed queue)
- **File Storage**: AWS S3 via AWS SDK
- **AI**: Anthropic SDK (Claude API) for document processing, report generation, and Q&A
- **Embeddings**: pgvector for vector storage and similarity search (RAG)
- **Decimal Math**: decimal.js (precise financial calculations)

### Authentication
- **Auth Provider**: Privy (Email, Google OAuth, Apple OAuth)
- **Wallet**: Privy Embedded Wallets (server-side SDK)
- **Backend Auth**: JWT Access Tokens (Privy-issued)
- **Session**: HTTP-only cookies with CSRF protection

### AI & Document Intelligence
- **LLM**: Claude API (Anthropic SDK) for document analysis, report generation, and investor Q&A
- **Vector Store**: pgvector (PostgreSQL extension) for document embeddings
- **RAG Pipeline**: Document chunking, embedding generation, semantic search, context-augmented generation
- **Streaming**: Server-Sent Events (SSE) for real-time AI responses

### External Services
- **KYC/Identity**: Verifik (CPF/CNPJ validation, facial recognition, liveness detection, AML screening)
- **Data Enrichment**: BigDataCorp (company data, financial information, litigation checks)
- **Open Finance**: Brazilian Open Finance APIs (bank connections, account data, transaction history)
- **File Storage**: AWS S3 (documents, reports, KYC documents)
- **Email**: AWS SES (notifications, investor updates)
- **Encryption**: AWS KMS (application-level encryption for PII)
- **Monitoring**: Sentry (error tracking)

### Infrastructure
- **Frontend Hosting**: Vercel (auto-deploy from Git)
- **Backend Hosting**: Railway (NestJS + PostgreSQL + Redis)
- **CDN**: Vercel Edge Network
- **SSL**: Automatic (Vercel + Railway)
- **Environments**: Development, Staging, Production

## Core Modules

### 1. Company Page Builder

Founders create and publish investor-ready company pages with structured profiles, datarooms, and financial snapshots.

**Key capabilities**:
- Company profile (description, team, traction metrics, fundraising status)
- Document dataroom (organized by category with access controls)
- Financial snapshots from Open Finance data
- Public/private page publishing with shareable links
- Access tier management (public preview vs. full dataroom access)

### 2. AI Document Intelligence

Claude API processes uploaded documents to extract structured data, generate standardized investor reports, and power a Q&A chat interface.

**Pipeline**:
```
Document Upload (PDF, XLSX, CSV, images)
    |
    +-- Text Extraction (PDF parsing, OCR for images)
    |
    +-- AI Processing (Claude API)
    |     +-- Document classification and metadata extraction
    |     +-- Financial data extraction and normalization
    |     +-- Key metrics identification
    |
    +-- Embedding Generation
    |     +-- Document chunking (semantic boundaries)
    |     +-- Vector storage in pgvector
    |
    +-- Downstream Uses
          +-- Standardized Report Generation (financial summaries, KPIs)
          +-- RAG-powered Q&A Chat (investors ask questions about the company)
          +-- Data validation and cross-referencing
```

**RAG Architecture**:
- Documents chunked at semantic boundaries (paragraphs, sections, tables)
- Embeddings stored in pgvector with metadata (document ID, company ID, chunk position)
- Retrieval: cosine similarity search scoped to company documents
- Generation: Claude API with retrieved context + system prompt for accurate, sourced answers

### 3. Open Finance Integration

Brazilian Open Finance API integration for automatic bank data ingestion, providing real-time financial visibility to investors.

**Flow**:
```
Founder Initiates Bank Connection
    |
    +-- OAuth Consent Flow (Open Finance standard)
    |     +-- Founder authorizes data sharing with Navia
    |
    +-- Account Data Ingestion
    |     +-- Account balances
    |     +-- Transaction history
    |     +-- Bank statements
    |
    +-- AI Processing
    |     +-- Transaction categorization
    |     +-- Cash flow analysis
    |     +-- Financial health scoring
    |
    +-- Financial Snapshots
          +-- Monthly/quarterly summaries
          +-- Burn rate calculation
          +-- Runway estimation
          +-- Revenue metrics
```

### 4. Investor Portal

Post-investment tracking dashboard where investors view company updates, ask AI-powered questions, and monitor portfolio performance.

**Access Tiers**:

| Tier | Access Level | Who |
|------|-------------|-----|
| Public | Company profile, basic metrics | Anyone with the link |
| Preview | Profile + selected documents | Prospective investors |
| Full | Complete dataroom, financials, Q&A | Approved investors |
| Admin | Everything + management | Founders, team |

**Features**:
- Portfolio dashboard (all invested companies)
- Company-specific detail pages with dataroom access
- AI-powered Q&A chat (ask questions about company documents and financials)
- Company updates feed (founder-published updates)
- Financial data visualization (from Open Finance)

### 5. KYC Verification (Verifik)

Identity verification for founders using Verifik's Brazilian-focused KYC infrastructure.

**Verification flow**: CPF validation -> Document upload -> Facial recognition -> AML screening

### 6. Data Enrichment (BigDataCorp)

Automated company data enrichment from public and proprietary Brazilian data sources.

**Capabilities**: CNPJ data, corporate structure, litigation checks, financial indicators, partner/shareholder registry.

## Authentication Flow

```
User            Next.js Frontend      Privy Auth         NestJS API        PostgreSQL
 |                    |                    |                   |                |
 |  Click "Sign In"  |                    |                   |                |
 |───────────────────>|                    |                   |                |
 |                    |  Open Privy Modal  |                   |                |
 |                    |───────────────────>|                   |                |
 |  Login (Email/     |                    |                   |                |
 |  Google/Apple)     |                    |                   |                |
 |───────────────────────────────────────->|                   |                |
 |                    |                    |  Create Embedded  |                |
 |                    |                    |  Wallet           |                |
 |                    |  Access Token +    |                   |                |
 |                    |  Wallet Address    |                   |                |
 |                    |<───────────────────|                   |                |
 |                    |                    |                   |                |
 |                    |  POST /auth/login (Privy Token)        |                |
 |                    |───────────────────────────────────────>|                |
 |                    |                    |  Verify Token     |                |
 |                    |                    |<──────────────────|                |
 |                    |                    |  Token Valid      |                |
 |                    |                    |──────────────────>|                |
 |                    |                    |                   |  Get/Create    |
 |                    |                    |                   |  User          |
 |                    |                    |                   |───────────────>|
 |                    |                    |                   |  User Record   |
 |                    |                    |                   |<───────────────|
 |                    |  User Profile + Session Cookie         |                |
 |                    |<───────────────────────────────────────|                |
 |  Redirect to       |                    |                   |                |
 |  Dashboard         |                    |                   |                |
 |<───────────────────|                    |                   |                |
```

## AI Document Processing Flow

```
Founder          Next.js          NestJS API         AWS S3       Bull Queue      Claude API      pgvector
   |                |                 |                 |              |               |              |
   | Upload doc     |                 |                 |              |               |              |
   |───────────────>| POST /documents |                 |              |               |              |
   |                |────────────────>| Store file      |              |               |              |
   |                |                 |────────────────>|              |               |              |
   |                |                 | Create record (PROCESSING)     |               |              |
   |                |  {status:       |                 |              |               |              |
   |                |   processing}   |                 |              |               |              |
   |                |<────────────────| Queue job       |              |               |              |
   |                |                 |─────────────────────────────>|               |              |
   |                |                 |                 |              |               |              |
   |                |                 |                 | Fetch doc    |               |              |
   |                |                 |                 |<─────────────|               |              |
   |                |                 |                 |              | Extract text  |              |
   |                |                 |                 |              |───────────────>| Classify +   |
   |                |                 |                 |              |               | extract      |
   |                |                 |                 |              |<──────────────| metadata     |
   |                |                 |                 |              |               |              |
   |                |                 |                 |              | Chunk + embed |              |
   |                |                 |                 |              |──────────────────────────────>|
   |                |                 |                 |              | Update record (READY)        |
   |                |                 |                 |              |               |              |
   |                | SSE: doc ready  |                 |              |               |              |
   |                |<────────────────|                 |              |               |              |
   | Notification   |                 |                 |              |               |              |
   |<───────────────|                 |                 |              |               |              |
```

## Investor Q&A Chat Flow

```
Investor         Next.js          NestJS API        pgvector         Claude API
   |                |                 |                 |                 |
   | Type question  |                 |                 |                 |
   |───────────────>| POST /chat      |                 |                 |
   |                |────────────────>|                 |                 |
   |                |                 | Generate query  |                 |
   |                |                 | embedding       |                 |
   |                |                 |────────────────>| Cosine          |
   |                |                 |                 | similarity      |
   |                |                 |  Top-K chunks   | (company-scoped)|
   |                |                 |<────────────────|                 |
   |                |                 |                 |                 |
   |                |                 | Prompt: context + question       |
   |                |                 |────────────────────────────────>|
   |                |                 |                 |                 |
   |                |                 |     SSE: streamed answer tokens  |
   |                |  SSE: chunks    |<─────────────────────────────────|
   |                |<────────────────|                 |                 |
   | Real-time      |                 |                 |                 |
   | answer with    |                 | Store chat      |                 |
   | citations      |                 | history         |                 |
   |<───────────────|                 |                 |                 |
```

## Database Schema (ERD)

```
  User                    Company                 CompanyPage
  ─────────────           ─────────────           ─────────────
  id (PK)                 id (PK)                 id (PK)
  privy_user_id (UK)      name                    company_id (FK, UK)
  email (UK)              cnpj (UK)               slug (UK)
  wallet_address (UK)     description             is_public
  name                    logo_url                sections (JSONB)
  role (FOUNDER|          website                 access_default
       INVESTOR)          stage (enum)            published_at
  locale                  status (enum)
  kyc_status              metrics (JSONB)
  created_at              created_at
  updated_at
       |                       |
       |   CompanyMember       |         Document               DocumentChunk
       |   ─────────────       |         ─────────────           ─────────────
       +-->id (PK)        <----+    +--->id (PK)            +--->id (PK)
           user_id (FK)             |    company_id (FK)     |    document_id (FK)
           company_id (FK)          |    uploaded_by (FK)    |    chunk_index
           role (ADMIN|MEMBER)      |    title               |    content (TEXT)
           status                   |    category (enum)     |    metadata (JSONB)
           created_at               |    s3_key              |    created_at
                                    |    mime_type           |
       InvestorAccess               |    file_size           |    Embedding
       ─────────────                |    processing_status   |    ─────────────
       id (PK)                      |    ai_metadata (JSONB) +--->id (PK)
       company_id (FK)              |    access_tier              chunk_id (FK)
       investor_id (FK)             |    created_at               company_id (FK)
       access_tier                  |                              embedding (vector)
       granted_at                   |                              created_at
       expires_at                   |
                                    |
  ChatConversation       ChatMessage          AIReport
  ─────────────          ─────────────        ─────────────
  id (PK)                id (PK)              id (PK)
  company_id (FK)        conversation_id (FK) company_id (FK)
  user_id (FK)           role (USER|          report_type (enum)
  title                       ASSISTANT)      report_data (JSONB)
  created_at             content (TEXT)       s3_key
                         sources (JSONB)      generated_at
                         created_at

  CompanyUpdate                   OpenFinanceConnection        FinancialSnapshot
  ─────────────                   ─────────────                ─────────────
  id (PK)                         id (PK)                      id (PK)
  company_id (FK)                 company_id (FK)              connection_id (FK)
  author_id (FK)                  institution_id               company_id (FK)
  title                           institution_name             snapshot_date
  content (TEXT)                   consent_id                   balances (JSONB)
  visibility (enum)               status (enum)                cash_flow (JSONB)
  published_at                    connected_at                 metrics (JSONB)
                                  expires_at                   created_at

  KYCVerification
  ─────────────
  id (PK)
  user_id (FK)
  status (enum)
  cpf_verified
  document_verified
  face_verified
  aml_cleared
  created_at
  updated_at
```

**Relationships**:
- User 1--* CompanyMember, InvestorAccess, KYCVerification
- Company 1--* CompanyMember, Document, CompanyUpdate, InvestorAccess, OpenFinanceConnection, ChatConversation, AIReport
- Company 1--1 CompanyPage
- Document 1--* DocumentChunk; DocumentChunk 1--* Embedding
- ChatConversation 1--* ChatMessage
- OpenFinanceConnection 1--* FinancialSnapshot

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
│   │   │   │       ├── page/        # Company page builder
│   │   │   │       ├── documents/    # Document management
│   │   │   │       ├── financials/   # Open Finance data
│   │   │   │       ├── investors/    # Investor management
│   │   │   │       ├── updates/      # Company updates
│   │   │   │       ├── reports/      # AI-generated reports
│   │   │   │       └── settings/
│   │   │   └── portfolio/       # Investor portfolio view
│   │   ├── (public)/            # Public company pages
│   │   │   └── [slug]/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── auth/                # Auth components
│   │   ├── company-page/        # Page builder components
│   │   ├── documents/           # Document upload & viewer
│   │   ├── chat/                # AI Q&A chat interface
│   │   ├── financials/          # Financial data components
│   │   ├── investors/           # Investor management
│   │   └── shared/              # Shared components
│   ├── lib/
│   │   ├── privy.ts            # Privy config
│   │   ├── api-client.ts       # NestJS API client
│   │   ├── sse-client.ts       # SSE streaming client
│   │   ├── utils.ts
│   │   └── constants.ts
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-company.ts
│   │   ├── use-documents.ts
│   │   ├── use-chat.ts
│   │   └── use-financials.ts
│   ├── contexts/
│   │   ├── auth-context.tsx
│   │   └── company-context.tsx
│   ├── types/
│   │   ├── user.ts
│   │   ├── company.ts
│   │   ├── document.ts
│   │   ├── chat.ts
│   │   └── financial.ts
│   ├── messages/               # i18n translations
│   │   ├── en.json
│   │   └── pt-BR.json
│   └── styles/
│       └── globals.css
├── public/
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
│   ├── kyc/
│   │   ├── kyc.module.ts
│   │   ├── kyc.controller.ts
│   │   ├── kyc.service.ts
│   │   ├── verifik/
│   │   │   ├── verifik.service.ts
│   │   │   └── verifik.types.ts
│   │   └── dto/
│   ├── companies/
│   │   ├── companies.module.ts
│   │   ├── companies.controller.ts
│   │   ├── companies.service.ts
│   │   └── dto/
│   ├── company-pages/
│   │   ├── company-pages.module.ts
│   │   ├── company-pages.controller.ts
│   │   ├── company-pages.service.ts
│   │   └── dto/
│   ├── documents/
│   │   ├── documents.module.ts
│   │   ├── documents.controller.ts
│   │   ├── documents.service.ts
│   │   ├── processing/
│   │   │   ├── document-processor.service.ts
│   │   │   ├── text-extractor.service.ts
│   │   │   ├── chunker.service.ts
│   │   │   └── document-processing.processor.ts
│   │   └── dto/
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── claude.service.ts          # Claude API client
│   │   ├── embedding.service.ts       # Embedding generation
│   │   ├── rag.service.ts             # RAG retrieval + generation
│   │   ├── report-generator.service.ts # AI report generation
│   │   └── chat/
│   │       ├── chat.controller.ts     # SSE chat endpoint
│   │       ├── chat.service.ts
│   │       └── dto/
│   ├── open-finance/
│   │   ├── open-finance.module.ts
│   │   ├── open-finance.controller.ts
│   │   ├── open-finance.service.ts
│   │   ├── consent.service.ts
│   │   ├── data-ingestion.service.ts
│   │   ├── financial-snapshot.service.ts
│   │   └── dto/
│   ├── investors/
│   │   ├── investors.module.ts
│   │   ├── investors.controller.ts
│   │   ├── investors.service.ts
│   │   ├── access.service.ts
│   │   └── dto/
│   ├── updates/
│   │   ├── updates.module.ts
│   │   ├── updates.controller.ts
│   │   ├── updates.service.ts
│   │   └── dto/
│   ├── reports/
│   │   ├── reports.module.ts
│   │   ├── reports.controller.ts
│   │   ├── reports.service.ts
│   │   └── dto/
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.service.ts
│   │   ├── email/
│   │   │   ├── email.service.ts
│   │   │   └── templates/
│   │   └── dto/
│   ├── enrichment/
│   │   ├── enrichment.module.ts
│   │   ├── bigdatacorp.service.ts
│   │   └── dto/
│   ├── jobs/
│   │   ├── jobs.module.ts
│   │   ├── processors/
│   │   │   ├── document-processing.processor.ts
│   │   │   ├── financial-ingestion.processor.ts
│   │   │   ├── report-generation.processor.ts
│   │   │   ├── notification.processor.ts
│   │   │   └── audit-log.processor.ts
│   │   └── queues/
│   ├── audit/
│   │   ├── audit.module.ts
│   │   ├── audit.service.ts
│   │   ├── audit.interceptor.ts
│   │   └── audit-log.processor.ts
│   ├── common/
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── utils/
│   │       ├── pii-redaction.ts
│   │       ├── decimal.utils.ts
│   │       └── brazilian.utils.ts
│   └── config/
│       ├── database.config.ts
│       ├── redis.config.ts
│       ├── aws.config.ts
│       ├── privy.config.ts
│       ├── claude.config.ts
│       └── open-finance.config.ts
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
- `GET /api/v1/users/me` - Get current user profile
- `PUT /api/v1/users/me` - Update user profile

### KYC & Identity Verification
- `POST /api/v1/kyc/start` - Start KYC verification session
- `POST /api/v1/kyc/verify-cpf` - Verify CPF with Verifik
- `POST /api/v1/kyc/verify-cnpj` - Verify company CNPJ
- `POST /api/v1/kyc/upload-document` - Upload identity document
- `POST /api/v1/kyc/verify-face` - Submit selfie for facial recognition
- `GET /api/v1/kyc/status` - Get current KYC verification status

### Companies
- `POST /api/v1/companies` - Create company
- `GET /api/v1/companies` - List user's companies
- `GET /api/v1/companies/:id` - Get company details
- `PUT /api/v1/companies/:id` - Update company
- `GET /api/v1/companies/:id/members` - List company members
- `POST /api/v1/companies/:id/members` - Invite member

### Company Pages
- `GET /api/v1/companies/:id/page` - Get company page config
- `PUT /api/v1/companies/:id/page` - Update company page
- `POST /api/v1/companies/:id/page/publish` - Publish company page
- `GET /api/v1/pages/:slug` - Get public company page (no auth required)

### Documents
- `POST /api/v1/companies/:id/documents` - Upload document
- `GET /api/v1/companies/:id/documents` - List documents
- `GET /api/v1/companies/:id/documents/:docId` - Get document details
- `DELETE /api/v1/companies/:id/documents/:docId` - Delete document
- `GET /api/v1/companies/:id/documents/:docId/download` - Download document (pre-signed URL)

### AI Chat & Q&A
- `POST /api/v1/companies/:id/chat` - Send message (SSE streaming response)
- `GET /api/v1/companies/:id/chat/conversations` - List conversations
- `GET /api/v1/companies/:id/chat/conversations/:convId` - Get conversation history

### AI Reports
- `POST /api/v1/companies/:id/reports/generate` - Generate AI report (SSE streaming)
- `GET /api/v1/companies/:id/reports` - List generated reports
- `GET /api/v1/companies/:id/reports/:reportId` - Get report
- `GET /api/v1/companies/:id/reports/:reportId/export` - Export report (PDF/XLSX/CSV)

### Open Finance
- `POST /api/v1/companies/:id/open-finance/connect` - Initiate bank connection
- `GET /api/v1/companies/:id/open-finance/connections` - List bank connections
- `DELETE /api/v1/companies/:id/open-finance/connections/:connId` - Revoke connection
- `GET /api/v1/companies/:id/open-finance/snapshots` - Get financial snapshots
- `POST /api/v1/companies/:id/open-finance/sync` - Trigger manual data sync

### Investor Management
- `POST /api/v1/companies/:id/investors/invite` - Invite investor
- `GET /api/v1/companies/:id/investors` - List investors with access
- `PUT /api/v1/companies/:id/investors/:investorId/access` - Update access tier
- `DELETE /api/v1/companies/:id/investors/:investorId/access` - Revoke access

### Company Updates
- `POST /api/v1/companies/:id/updates` - Create update
- `GET /api/v1/companies/:id/updates` - List updates
- `PUT /api/v1/companies/:id/updates/:updateId` - Edit update
- `DELETE /api/v1/companies/:id/updates/:updateId` - Delete update

### Investor Portfolio (Investor-scoped)
- `GET /api/v1/users/me/portfolio` - List companies with investor access
- `GET /api/v1/users/me/portfolio/:companyId` - Get company detail (investor view)

### Data Enrichment
- `POST /api/v1/companies/:id/enrich` - Enrich company data from BigDataCorp

### Audit Logs
- `GET /api/v1/companies/:id/audit-logs` - List audit logs
- `GET /api/v1/companies/:id/audit-logs/:logId` - Get audit log detail
- `GET /api/v1/companies/:id/audit-logs/export` - Export audit logs

## Security Considerations

### Authentication & Authorization
- All API endpoints require valid Privy JWT token (except public pages)
- NestJS guards verify token with Privy on each request
- Role-based access control: Founder (ADMIN, MEMBER) and Investor (tier-based)
- Company page access controlled by access tier (PUBLIC, PREVIEW, FULL)
- Investor access scoped to granted companies only

### Data Protection
- Sensitive documents encrypted in S3 with server-side encryption (SSE-KMS for KYC)
- Database encryption at rest (Railway PostgreSQL)
- Application-level encryption for PII (CPF, bank details) via AWS KMS
- HTTPS/TLS for all communications
- CORS configured for Vercel frontend only
- CSRF protection via double-submit cookie
- API rate limiting via NestJS throttler

### AI Security
- Document content sent to Claude API scoped to company context only
- RAG queries filtered by company ID (no cross-company data leakage)
- Chat history stored per-user per-company
- AI responses include source citations for traceability
- No PII sent to Claude API (redacted before processing)

### File Upload Security
- File type validation (PDF, XLSX, CSV, PNG, JPG only)
- File size limits (10 MB documents, 5 MB images)
- Virus scanning before S3 upload
- Pre-signed URLs for temporary document access (15-minute expiry)
- S3 bucket policies restrict public access
- EXIF metadata stripped from uploaded images

### Open Finance Security
- OAuth 2.0 consent flow for bank connections
- Consent tokens stored encrypted
- Connection expiry tracked and users notified before renewal
- Financial data never exposed beyond granted access tier

### Brazilian Compliance (LGPD)
- Data minimization principles
- User consent tracking with versioned records
- Right to access, rectification, and deletion
- Data processing records maintained
- Data residency: AWS sa-east-1 (Sao Paulo region)
- PII masking in audit logs and error reporting
- 30-day grace period for account deletion with anonymization

## Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Backend (.env)
```bash
# Node/NestJS
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# Database (Railway provides)
DATABASE_URL=postgresql://user:pass@host:port/db

# Redis (Railway provides)
REDIS_URL=redis://host:port

# Privy
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# Verifik (KYC)
VERIFIK_API_URL=https://api.verifik.co/v2
VERIFIK_API_TOKEN=your_verifik_api_token

# BigDataCorp (Enrichment)
BIGDATACORP_API_URL=https://api.bigdatacorp.com.br
BIGDATACORP_API_TOKEN=your_bigdatacorp_token

# Claude AI (Anthropic)
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# AWS
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=sa-east-1
AWS_S3_BUCKET_DOCUMENTS=navia-documents
AWS_S3_BUCKET_KYC=navia-kyc
AWS_KMS_KEY_ARN=your_kms_key_arn

# AWS SES
AWS_SES_FROM_EMAIL=noreply@navia.com.br

# Encryption
BLIND_INDEX_KEY=your_blind_index_key

# Open Finance
OPEN_FINANCE_CLIENT_ID=your_client_id
OPEN_FINANCE_CLIENT_SECRET=your_client_secret
OPEN_FINANCE_REDIRECT_URI=https://api.navia.com.br/api/v1/open-finance/callback

# CORS
CORS_ORIGINS=http://localhost:3000

# Monitoring
SENTRY_DSN=your_sentry_dsn
```

## Performance Requirements

- **Page Load**: < 2 seconds for company pages and dashboards
- **Document Processing**: < 60 seconds for AI processing of uploaded documents
- **AI Chat Response**: First token < 2 seconds, full response streaming via SSE
- **Report Generation**: < 30 seconds for AI-generated reports
- **Open Finance Sync**: < 10 seconds for financial data ingestion
- **API Response Time**: < 500ms (p95) for non-AI endpoints
- **Search**: < 200ms for semantic search (pgvector) queries
- **Scalability**: Support up to 10,000 documents per company, 500 investors per company

## Success Metrics

- Document processing accuracy (AI classification and extraction)
- AI Q&A answer relevance (user feedback thumbs up/down)
- Company page publishing rate (founders completing setup)
- Investor engagement (Q&A usage, update views)
- Open Finance connection success rate
- API response time < 500ms (p95)
- Zero cross-company data leakage
- LGPD compliance audit pass
