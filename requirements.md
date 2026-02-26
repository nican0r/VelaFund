# Navia — Investor-Ready Company Pages for Brazilian Startups

## Project Overview

Build a platform that enables Brazilian startups to create professional, investor-ready company pages powered by AI intelligence. Founders publish a branded company page with a secure dataroom, connect their bank accounts for automatic financial snapshots, and let AI process their documents into standardized reports. Investors browse company pages, access tiered information based on their permission level, and ask questions answered by AI grounded in the company's actual documents and financials.

**All UI pages and user-facing content must support both English and Portuguese (Brazil) languages.**

**All user flows must be documented in markdown format**, describing how each flow is expected to be executed, including step-by-step interactions, decision points, validation rules, and expected outcomes.

---

## User Roles

| Role | Description |
|------|-------------|
| **Founder** | Creates and manages the company page, uploads documents, connects bank accounts, controls investor access |
| **Investor** | Views company pages, accesses dataroom based on tier, asks AI-powered questions, tracks portfolio |

---

## Core Requirements

### 1. Company Page

#### 1.1 Profile Editor
- Structured company profile with:
  - Company name, CNPJ, founding date
  - Logo, banner image, brand colors
  - Mission/vision statement
  - Team members with roles and bios
  - Key metrics (custom fields defined by founder)
  - Social links and contact information
- Rich text editor for company description
- Real-time preview of published page

#### 1.2 Dataroom
- Secure document repository organized by category (financials, legal, pitch decks, contracts)
- Drag-and-drop file upload with folder structure
- Version control for all documents
- Per-document and per-folder access control (which tier can see what)
- Document hashes stored for tamper-proof verification

#### 1.3 Slug-Based Publishing
- Custom URL slug per company (e.g., `navia.com.br/empresa/acme`)
- Publish/unpublish toggle
- SEO metadata (title, description, Open Graph tags)

#### 1.4 Access Control
- Three access modes:
  - **Public**: Anyone can view the page
  - **Password-protected**: Requires a shared password
  - **Email-gated**: Requires email submission; founder approves or auto-approves by domain
- Founders manage access lists and pending requests

#### 1.5 View Analytics
- Track page views, unique visitors, and time on page
- Document download counts per file
- Visitor log with email (for email-gated pages)
- Geographic and referral source breakdown

---

### 2. AI Document Intelligence

#### 2.1 Document Processing
- Upload documents (PDF, DOCX, XLSX, images)
- Process documents via Claude API for extraction and summarization
- Extract structured data: key terms, financial figures, dates, parties
- Support for Portuguese and English documents

#### 2.2 Embedding & RAG
- Generate vector embeddings for all uploaded documents using pgvector
- Chunk documents intelligently (respect section boundaries, tables, paragraphs)
- Store embeddings alongside document metadata for filtered retrieval
- Hybrid search: vector similarity + keyword matching

#### 2.3 Standardized Report Generation
- AI-generated company summary report from uploaded documents
- Financial overview extracted from financial statements
- Risk assessment based on litigation data and document analysis
- Reports regenerated automatically when new documents are uploaded

#### 2.4 Investor Q&A Chat
- Chat interface for investors to ask questions about the company
- Responses grounded in the company's actual documents and financials (RAG)
- Server-Sent Events (SSE) for streaming responses
- Citation links to source documents in every answer
- Conversation history per investor per company
- Founder can view all Q&A conversations

---

### 3. Open Finance

#### 3.1 Bank Connections
- Integration with Brazilian Open Finance APIs
- Connect multiple bank accounts per company
- OAuth-based consent flow per Open Finance regulations
- Automatic periodic data sync (daily)

#### 3.2 Financial Data Ingestion
- Ingest transaction history, balances, and statements
- Categorize transactions automatically (revenue, expenses, payroll, taxes)
- Reconcile data across multiple bank accounts

#### 3.3 Financial Snapshots
- Auto-calculated metrics from ingested bank data:
  - **Burn rate**: Monthly cash outflow trend
  - **Runway**: Months of cash remaining at current burn
  - **MRR** (Monthly Recurring Revenue): Identified from recurring inflows
- Historical charts for each metric
- Snapshots included in the company page (visible per access tier)
- Manual override for founders to correct categorization

---

### 4. Investor Portal

#### 4.1 Tiered Access Management
- Three permission tiers per investor per company:
  - **VIEW**: Public profile, team, basic metrics
  - **VIEW_FINANCIALS**: Everything in VIEW + financial snapshots, select dataroom folders
  - **FULL**: Everything in VIEW_FINANCIALS + complete dataroom, AI Q&A chat
- Founders assign tiers per investor or by investor group
- Tier upgrades/downgrades logged in audit trail

#### 4.2 Company Updates
- Founders post updates visible to their investors (text + attachments)
- Updates scoped by tier (some updates visible only to FULL-access investors)
- Email notification to investors when new updates are posted
- Update feed on the investor portal

#### 4.3 Portfolio View
- Investors see all companies they have access to in one dashboard
- Summary cards per company: name, logo, tier, last update date, key metrics
- Filter and sort by industry, stage, last activity

#### 4.4 Q&A Chat
- Per-company chat interface (same as section 2.4, investor-facing)
- Investors can only ask questions within their tier's document scope
- Founders receive notifications for new questions

---

### 5. KYC Verification

#### 5.1 Founder Identity Verification (via Verifik)
- **CPF Validation**: Verify founder's CPF against government databases
- **Document OCR**: Extract data from identity documents (RG, CNH)
- **Facial Recognition**: Liveness check matching document photo to selfie
- **AML Screening**: Check against PEP lists, sanctions, and adverse media

#### 5.2 Verification Flow
1. Founder initiates KYC from profile settings
2. CPF submitted and validated
3. Identity document uploaded and OCR-processed
4. Selfie captured for facial recognition
5. AML screening runs in background
6. Verification status updated: PENDING, APPROVED, REJECTED
- KYC status displayed on the company page as a trust badge
- KYC events never store PII in audit logs (status transitions only)

---

### 6. Data Enrichment

#### 6.1 Company Data Retrieval (via BigDataCorp)
- Fetch company registration data from CNPJ
- Auto-fill company profile fields (legal name, address, founding date, partners)
- Periodic refresh to detect changes

#### 6.2 Litigation Verification (via BigDataCorp)
- Check for active litigation involving the company or its founders
- Flag lawsuits by type and status
- Include litigation summary in AI-generated risk assessment
- Founders can add context notes to flagged items

---

### 7. Communication & Notifications

#### 7.1 Email Notification System
- Automated email notifications for key events:
  - **Access requests**: Notify founder when an investor requests page access
  - **Access granted**: Notify investor when tier is assigned or upgraded
  - **New updates**: Notify investors when founder posts a company update
  - **Document uploads**: Notify FULL-tier investors when new dataroom documents are added
  - **Q&A activity**: Notify founder of new investor questions
  - **KYC status changes**: Notify founder of verification progress
  - **Financial sync alerts**: Notify founder of bank connection issues or new snapshots
- Email templates for each notification type (PT-BR and EN)
- User email preferences and notification settings
- Unsubscribe functionality for non-critical notifications

---

## Technical Requirements

### Architecture
- Modern web application (responsive design)
- Mobile-friendly interface
- Secure cloud hosting (Brazilian data residency - LGPD)
- Server-Sent Events (SSE) for AI chat streaming
- Background job processing for document ingestion and financial sync
- pgvector for embedding storage and similarity search

### Security
- End-to-end encryption for sensitive data
- LGPD (Lei 13.709/2018) compliance
- Application-level encryption for CPF and sensitive fields
- Pre-signed URLs for document access (time-limited)
- Session management and timeout policies

### Performance
- Page load time < 2 seconds
- Document processing < 60 seconds per document
- AI chat first-token latency < 2 seconds (SSE streaming)
- Financial sync < 5 minutes per bank account
- Support for companies with up to 500 documents in dataroom

### Localization
- **Full bilingual support: Portuguese (Brazil) and English**
- All UI elements, labels, and messages translated
- Language toggle accessible from any page
- User language preference saved in profile
- Brazilian date formats (DD/MM/YYYY)
- Brazilian number formatting (1.234,56)
- Brazilian currency formatting (R$ X.XXX,XX)

### Accessibility
- WCAG 2.1 AA compliance
- Keyboard navigation for all interactive components
- Screen reader support with semantic HTML and ARIA labels
- Minimum contrast ratios for all text/background combinations

---

## Development Phases

### Phase 1: Company Page (MVP)
- Profile editor and slug-based publishing
- Dataroom with file upload and folder organization
- Access control (public, password, email-gated)
- View analytics
- User authentication via Privy
- KYC verification for founders
- Bilingual UI (PT-BR / EN)

### Phase 2: AI Intelligence
- Document processing via Claude API
- Embedding generation and RAG pipeline with pgvector
- Standardized AI report generation
- Investor Q&A chat with SSE streaming

### Phase 3: Open Finance
- Brazilian Open Finance API integration
- Bank account connection and data ingestion
- Automated financial snapshots (burn rate, runway, MRR)

### Phase 4: Investor Portal
- Tiered access management (VIEW / VIEW_FINANCIALS / FULL)
- Company updates feed
- Portfolio view dashboard
- Data enrichment via BigDataCorp

---

## Success Metrics

- Company page publish time < 30 minutes (from signup to live page)
- AI Q&A response accuracy > 90% (grounded in uploaded documents)
- Document processing success rate > 95%
- Financial snapshot accuracy within 5% of manual calculation
- Page load time < 2 seconds
- Zero PII leaks in audit logs or AI responses

---

## References

- LGPD (Lei 13.709/2018)
- Brazilian Open Finance regulations (BCB)
- Complementary Law 155/2016 (Investidor-Anjo)
- Law 14.063/2020 (Electronic Signatures)
- Verifik KYC documentation
- BigDataCorp API documentation
- Anthropic Claude API documentation
- pgvector extension for PostgreSQL
- Privy documentation
