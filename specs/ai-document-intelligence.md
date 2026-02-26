# AI Document Intelligence Specification

**Topic of Concern**: AI-powered document understanding for text extraction, semantic search, RAG-based Q&A, and automated report generation using Claude API

**One-Sentence Description**: The system processes uploaded dataroom documents through an AI pipeline — extracting text, generating vector embeddings, enabling semantic search via RAG, and producing AI-generated company intelligence reports — all powered by the Anthropic Claude API with cost tracking and budget enforcement.

**Complements**:
- `company-dataroom.md` — source documents (ProfileDocument) that feed into the AI pipeline
- `reports-analytics.md` — AI-generated reports integrate with the existing export/report infrastructure
- `api-standards.md` — response envelope, pagination, async job patterns
- `error-handling.md` — error codes and PII redaction in AI prompts
- `audit-logging.md` — audit events for AI processing operations
- `security.md` — PII handling, company data isolation, encryption
- `user-permissions.md` — role-based access to AI features

---

## Table of Contents

1. [Overview](#overview)
2. [MVP Scope](#mvp-scope)
3. [User Stories](#user-stories)
4. [Data Models](#data-models)
5. [Document Ingestion Pipeline](#document-ingestion-pipeline)
6. [Embedding and Vector Search](#embedding-and-vector-search)
7. [RAG-Based Q&A](#rag-based-qa)
8. [Report Generation](#report-generation)
9. [Cost Management](#cost-management)
10. [API Endpoints](#api-endpoints)
11. [Frontend Specification](#frontend-specification)
12. [Error Codes](#error-codes)
13. [Business Rules](#business-rules)
14. [Edge Cases](#edge-cases)
15. [Dependencies](#dependencies)
16. [Technical Implementation](#technical-implementation)
17. [Security Considerations](#security-considerations)
18. [Success Criteria](#success-criteria)
19. [Related Specifications](#related-specifications)

---

## Overview

The AI Document Intelligence module adds an AI layer on top of the existing Company Dataroom (see `company-dataroom.md`). When a document is uploaded to the dataroom, it can be processed by the AI pipeline to:

1. **Extract text** from PDFs, DOCX, XLSX, and images (via Claude Vision)
2. **Chunk and embed** the extracted text into vector representations stored in PostgreSQL via `pgvector`
3. **Answer questions** about the company's documents using retrieval-augmented generation (RAG)
4. **Generate intelligence reports** summarizing the company's documentation, financials, and market position

Processing is fully **asynchronous** — all AI operations are queued via Bull and executed in the background. The original API request is never blocked by AI processing. Users see real-time status updates on document processing progress.

The system uses Claude API exclusively (no OpenAI dependency):
- **claude-sonnet-4-6** for cost-efficient document processing, summarization, and report generation
- **Claude Embeddings** (or a dedicated embedding model) for vector generation

---

## MVP Scope

### In Scope (MVP)

| Feature | Notes |
|---------|-------|
| **Text extraction** | PDF (pdf-parse), DOCX (mammoth), XLSX (xlsx), images (Claude Vision) |
| **Chunking and embedding** | 1000-token chunks with 200-token overlap, stored in pgvector |
| **Document processing status** | Per-document status tracking (PENDING, PROCESSING, COMPLETED, FAILED) |
| **Company AI summary** | One-click generation of an AI summary from all processed documents |
| **Token budget tracking** | Per-company monthly token usage with configurable budget |
| **Processing status UI** | AI status badges on document cards, processing progress indicators |
| **Company AI dashboard** | Tokens used, budget remaining, documents processed |

### Out of Scope (Post-MVP)

| Feature | Notes |
|---------|-------|
| **Interactive RAG Q&A chat** | Conversational interface for asking questions about documents |
| **Custom report templates** | User-defined report structures and prompts |
| **Cross-company intelligence** | Comparing metrics across multiple companies |
| **Real-time streaming responses** | Server-sent events for streaming AI output |
| **Document comparison** | Side-by-side AI analysis of document versions |
| **Automatic processing on upload** | Documents must be manually triggered for AI processing in MVP |

---

## User Stories

### US-1: Process Document with AI

**As an** admin user, **I want to** trigger AI processing on a dataroom document, **so that** the system can extract and understand its contents for future analysis.

**Acceptance Criteria**:
- "Process with AI" button appears on each unprocessed document in the dataroom
- Processing runs asynchronously; the user sees a progress indicator
- On completion, the document card shows an "AI Processed" badge
- Failed processing shows an error state with a retry option

### US-2: Process All Documents

**As an** admin user, **I want to** process all unprocessed documents in my dataroom at once, **so that** I don't have to trigger each document individually.

**Acceptance Criteria**:
- "Process All" button on the dataroom page header
- Only processes documents not yet processed (skips already completed ones)
- Shows a progress summary (e.g., "Processing 5 of 12 documents")
- Respects the monthly token budget; stops if budget is exceeded

### US-3: Generate Company Summary

**As an** admin user, **I want to** generate an AI summary of my company based on all processed documents, **so that** I can get an intelligent overview of my company's documentation.

**Acceptance Criteria**:
- Summary includes key findings from pitch deck, financials, legal documents, etc.
- Cached: regenerating only re-processes if source documents have changed
- Summary is displayed in a card on the AI dashboard

### US-4: View AI Processing Status

**As an** admin user, **I want to** see the AI processing status and token usage for my company, **so that** I can monitor costs and processing progress.

**Acceptance Criteria**:
- Dashboard shows: tokens used this month, budget remaining, documents processed count
- Each processed document shows its token cost
- Warning when approaching budget limit (80% used)

---

## Data Models

### Prisma Schema

```prisma
// =============================================================================
// AI DOCUMENT INTELLIGENCE
// =============================================================================

model DocumentChunk {
  id          String   @id @default(uuid())
  documentId  String   @map("document_id")
  companyId   String   @map("company_id")
  content     String   // chunk text content
  chunkIndex  Int      @map("chunk_index")
  tokenCount  Int      @map("token_count")
  embedding   Unsupported("vector(1536)")? // pgvector
  metadata    Json?    // { pageNumber, sectionTitle, sourceType }
  createdAt   DateTime @default(now()) @map("created_at")

  document ProfileDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  company  Company         @relation(fields: [companyId], references: [id])

  @@index([companyId])
  @@index([documentId])
  @@map("document_chunks")
}

model AIProcessingJob {
  id          String      @id @default(uuid())
  companyId   String      @map("company_id")
  documentId  String?     @map("document_id")
  jobType     AIJobType   @map("job_type")
  status      AIJobStatus @default(QUEUED)
  progress    Int         @default(0) // 0-100 percentage
  tokensUsed  Int         @default(0) @map("tokens_used")
  cost        Decimal     @default(0) @db.Decimal(10, 6) // estimated cost in USD
  error       String?
  result      Json?       // structured output for summary/report jobs
  startedAt   DateTime?   @map("started_at")
  completedAt DateTime?   @map("completed_at")
  createdAt   DateTime    @default(now()) @map("created_at")

  company  Company         @relation(fields: [companyId], references: [id])
  document ProfileDocument? @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@index([companyId, createdAt])
  @@index([companyId, jobType, status])
  @@index([documentId])
  @@index([status])
  @@map("ai_processing_jobs")
}

model AICompanySummary {
  id                  String   @id @default(uuid())
  companyId           String   @unique @map("company_id")
  summary             String   // AI-generated company summary text
  keyFindings         Json?    @map("key_findings") // structured findings array
  sourceDocumentIds   String[] @map("source_document_ids") // document IDs used
  sourceDocumentHash  String   @map("source_document_hash") // hash of source doc IDs + updatedAts for cache invalidation
  tokensUsed          Int      @map("tokens_used")
  generatedAt         DateTime @map("generated_at")
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id])

  @@map("ai_company_summaries")
}

enum AIJobType {
  DOCUMENT_EXTRACTION
  EMBEDDING_GENERATION
  SUMMARY_GENERATION
  REPORT_GENERATION
  QA_ANSWER

  @@map("ai_job_type")
}

enum AIJobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED

  @@map("ai_job_status")
}
```

### ProfileDocument Extensions

The existing `ProfileDocument` model (see `company-dataroom.md`) requires new fields to track AI processing state:

```prisma
model ProfileDocument {
  // ... existing fields from company-dataroom.md ...

  // AI processing fields (new)
  aiProcessingStatus   AIDocProcessingStatus @default(PENDING) @map("ai_processing_status")
  extractedTextKey     String?               @map("extracted_text_key") // S3 key for extracted text
  chunkCount           Int?                  @map("chunk_count")
  aiTokensUsed         Int                   @default(0) @map("ai_tokens_used")
  aiProcessedAt        DateTime?             @map("ai_processed_at")
  aiError              String?               @map("ai_error")

  // Relations (new)
  chunks               DocumentChunk[]
  aiJobs               AIProcessingJob[]
}

enum AIDocProcessingStatus {
  PENDING         // Not yet processed
  EXTRACTING      // Text extraction in progress
  EMBEDDING       // Embedding generation in progress
  COMPLETED       // Fully processed (text + embeddings)
  FAILED          // Processing failed
  SKIPPED         // Unsupported format or empty content

  @@map("ai_doc_processing_status")
}
```

### TypeScript Interfaces

```typescript
interface DocumentChunk {
  id: string;
  documentId: string;
  companyId: string;
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata: ChunkMetadata | null;
  createdAt: string; // ISO 8601
}

interface ChunkMetadata {
  pageNumber?: number;
  sectionTitle?: string;
  sourceType: 'pdf' | 'docx' | 'xlsx' | 'image';
}

interface AIProcessingJob {
  id: string;
  companyId: string;
  documentId: string | null;
  jobType: AIJobType;
  status: AIJobStatus;
  progress: number;
  tokensUsed: number;
  cost: string; // Decimal as string
  error: string | null;
  result: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface AICompanySummary {
  id: string;
  companyId: string;
  summary: string;
  keyFindings: KeyFinding[] | null;
  sourceDocumentIds: string[];
  tokensUsed: number;
  generatedAt: string;
}

interface KeyFinding {
  category: string;      // e.g., "Financial", "Legal", "Product", "Team"
  title: string;         // brief title
  description: string;   // detailed finding
  confidence: 'high' | 'medium' | 'low';
  sourceDocumentId: string;
}

interface AIProcessingStatus {
  companyId: string;
  documentsTotal: number;
  documentsProcessed: number;
  documentsProcessing: number;
  documentsFailed: number;
  documentsPending: number;
  tokensUsedThisMonth: number;
  tokenBudget: number;
  budgetRemainingPercentage: string; // e.g., "65.00"
  lastProcessedAt: string | null;
}

type AIJobType =
  | 'DOCUMENT_EXTRACTION'
  | 'EMBEDDING_GENERATION'
  | 'SUMMARY_GENERATION'
  | 'REPORT_GENERATION'
  | 'QA_ANSWER';

type AIJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
```

---

## Document Ingestion Pipeline

### Pipeline Stages

The ingestion pipeline processes a single document through the following stages:

```
Document Upload (existing, via company-dataroom.md)
       │
       ▼
  User clicks "Process with AI"
       │
       ▼
  POST /api/v1/companies/:companyId/ai/documents/:id/process
       │
       ├─ [budget check] ─→ Budget exceeded? → 422 AI_BUDGET_EXCEEDED
       ├─ [format check] ─→ Unsupported? → 422 AI_UNSUPPORTED_FORMAT
       ├─ [size check]   ─→ Too large? → 422 AI_DOCUMENT_TOO_LARGE
       │
       ▼
  Create AIProcessingJob (QUEUED)
  Update ProfileDocument.aiProcessingStatus = EXTRACTING
  Return 202 Accepted with jobId
       │
       ▼
  Bull Queue: ai-processing (Stage 1: EXTRACTION)
       │
       ├─ PDF  → pdf-parse → extracted text
       ├─ DOCX → mammoth → extracted text
       ├─ XLSX → xlsx → structured text (sheet names, headers, cell data)
       └─ Image (PNG, JPG) → Claude Vision API → extracted text
       │
       ├─ [no text extracted] → Update status = SKIPPED, error = "No extractable content"
       │
       ▼
  Store extracted text in S3 (extractedTextKey)
  Update ProfileDocument.aiProcessingStatus = EMBEDDING
       │
       ▼
  Bull Queue: ai-processing (Stage 2: CHUNKING + EMBEDDING)
       │
       ├─ Split text into chunks (1000 tokens, 200 overlap)
       ├─ Respect section boundaries (headings, page breaks)
       ├─ For each chunk:
       │     ├─ Generate embedding via Claude Embeddings API
       │     └─ Store DocumentChunk with embedding vector
       │
       ▼
  Update ProfileDocument:
    - aiProcessingStatus = COMPLETED
    - chunkCount = N
    - aiTokensUsed = total tokens
    - aiProcessedAt = now()
  Update AIProcessingJob: status = COMPLETED, tokensUsed
       │
       ▼
  Create notification: AI_PROCESSING_COMPLETE
```

### Text Extraction Rules

| File Type | Library | Extraction Strategy |
|-----------|---------|-------------------|
| PDF | `pdf-parse` | Extract all text pages sequentially. Preserve page boundaries as metadata. |
| DOCX | `mammoth` | Convert to plain text. Preserve heading hierarchy for section boundaries. |
| XLSX | `xlsx` | Extract sheet names as section titles. Convert each sheet to a structured text representation: `"Sheet: {name}\n{header row}\n{data rows}"`. Skip empty sheets. |
| PNG, JPG, JPEG | Claude Vision API | Send image to Claude with prompt: "Extract all visible text from this image. Preserve the original structure and formatting as much as possible." |
| PPTX | Not supported in MVP | Return AI_UNSUPPORTED_FORMAT. PPTX support is post-MVP. |

### Chunking Strategy

```typescript
interface ChunkingConfig {
  maxTokensPerChunk: 1000;      // target chunk size
  overlapTokens: 200;           // overlap between consecutive chunks
  minChunkTokens: 50;           // discard chunks smaller than this
  sectionBoundaryRespect: true; // prefer splitting at section boundaries
}
```

**Chunking algorithm**:

1. Split extracted text by section boundaries (double newlines, page breaks, heading markers).
2. For each section:
   - If section fits within `maxTokensPerChunk`: keep as one chunk.
   - If section exceeds `maxTokensPerChunk`: split by sentence boundaries with `overlapTokens` overlap.
3. Discard chunks with fewer than `minChunkTokens` tokens (likely noise).
4. Assign sequential `chunkIndex` values (0-indexed).
5. Store `metadata.pageNumber` and `metadata.sectionTitle` when available.

**Token counting**: Use `tiktoken` (or equivalent) with the `cl100k_base` encoding for accurate token counts. Approximation (`text.length / 4`) is acceptable for budget estimation but not for chunking.

---

## Embedding and Vector Search

### pgvector Setup

The `pgvector` PostgreSQL extension must be enabled:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

This is added via a Prisma migration. The `DocumentChunk.embedding` field uses `vector(1536)` dimensionality.

### Embedding Generation

Each document chunk is embedded using the Claude Embeddings API (or a compatible embedding model):

```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await anthropic.embeddings.create({
    model: 'voyage-3', // or Anthropic's embedding model when available
    input: text,
  });
  return response.data[0].embedding; // vector(1536)
}
```

**Note**: If Anthropic does not offer a native embedding model at implementation time, use Voyage AI (`voyage-3`) which is recommended by Anthropic for use with Claude. The embedding dimension (1536) matches Voyage-3.

### Vector Similarity Search

Search for relevant chunks using cosine similarity:

```sql
SELECT id, content, metadata,
       1 - (embedding <=> $1::vector) AS similarity
FROM document_chunks
WHERE company_id = $2
ORDER BY embedding <=> $1::vector
LIMIT $3;
```

**Index**: Create an IVFFlat index for efficient approximate nearest neighbor search:

```sql
CREATE INDEX idx_document_chunks_embedding
ON document_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

The number of lists should be approximately `sqrt(total_rows)`. Rebuild the index periodically as data grows.

---

## RAG-Based Q&A

> **Note**: Interactive Q&A is post-MVP. This section documents the architecture for future implementation.

### RAG Pipeline

```
User submits question
       │
       ▼
  Embed the question → query vector
       │
       ▼
  Vector similarity search (top-k=5 chunks, filtered by companyId)
       │
       ▼
  Construct prompt:
    System: "You are a document analyst for {companyName}. Answer questions based only on the provided context."
    Context: [Top-k chunk contents, with source document names]
    User: "{question}"
       │
       ▼
  Claude API call (claude-sonnet-4-6)
       │
       ▼
  Return answer with source citations
```

### RAG Configuration

```typescript
interface RAGConfig {
  topK: 5;                           // number of chunks to retrieve
  similarityThreshold: 0.7;          // minimum cosine similarity
  maxContextTokens: 4000;            // max tokens for context window
  model: 'claude-sonnet-4-6';   // cost-efficient model for Q&A
  temperature: 0.2;                  // low temperature for factual answers
}
```

### Answer Format

```typescript
interface RAGAnswer {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources: Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    relevance: number;       // cosine similarity score
    excerpt: string;         // relevant excerpt from the chunk
  }>;
  tokensUsed: number;
}
```

---

## Report Generation

### AI Company Summary

The summary is generated from all processed document chunks for a company:

```typescript
async function generateCompanySummary(companyId: string): Promise<AICompanySummary> {
  // 1. Fetch all processed documents and their chunks
  const documents = await getProcessedDocuments(companyId);

  // 2. Check cache: compute hash of document IDs + updatedAt timestamps
  const sourceHash = computeSourceHash(documents);
  const existing = await findExistingSummary(companyId);
  if (existing && existing.sourceDocumentHash === sourceHash) {
    return existing; // Cache hit — source data hasn't changed
  }

  // 3. Select representative chunks per document category
  //    (max 3 chunks per document, prioritize first chunks which often contain key info)
  const contextChunks = selectRepresentativeChunks(documents, maxTotalTokens: 8000);

  // 4. Construct prompt
  const prompt = buildSummaryPrompt(companyName, contextChunks);

  // 5. Call Claude API
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  });

  // 6. Parse structured response
  const { summary, keyFindings } = parseStructuredResponse(response);

  // 7. Store/update summary
  return upsertSummary(companyId, summary, keyFindings, sourceHash, tokensUsed);
}
```

### Summary Prompt Template

```
You are a startup analyst reviewing documents for {companyName}.

Based on the following document extracts, generate:
1. A concise company summary (2-3 paragraphs) covering: what the company does, its market position, team, financials, and any notable strengths or risks.
2. A list of key findings categorized as Financial, Legal, Product, or Team. Each finding should have a title, description, and confidence level (high/medium/low).

IMPORTANT:
- Only state facts found in the documents. Do not speculate.
- If information is missing or unclear, note it as a gap.
- Format your response as JSON with the structure: { "summary": "...", "keyFindings": [...] }

Document extracts:
---
{contextChunks}
---
```

### AI Report Generation (Integration with Reports Module)

For full AI-generated reports (PDF), the system integrates with the existing report infrastructure (see `reports-analytics.md`):

1. Collect all company data: profile metadata, document chunks, financial metrics from CompanyProfile
2. Construct a structured prompt with the report template
3. Claude generates report sections using `claude-sonnet-4-6`
4. Format the structured JSON response, then render to PDF via Puppeteer (same pipeline as existing report exports)
5. Store PDF in S3, create ExportJob record
6. Send `AI_REPORT_READY` notification

This reuses the existing `ExportJob` model and `report-export` Bull queue from `reports-analytics.md`, with a new `ExportJobType`:

```prisma
enum ExportJobType {
  CAP_TABLE_EXPORT
  DUE_DILIGENCE
  AI_REPORT       // new
}
```

---

## Cost Management

### Token Budget System

Each company has a configurable monthly AI token budget:

```prisma
model CompanyProfile {
  // ... existing fields ...

  aiTokenBudget     Int @default(100000) @map("ai_token_budget") // monthly token limit
}
```

| Budget Tier | Monthly Tokens | Approximate Cost (USD) | Use Case |
|-------------|---------------|----------------------|----------|
| Free | 100,000 | ~$0.30 | Basic document processing |
| Standard | 500,000 | ~$1.50 | Full dataroom processing + summaries |
| Premium | 2,000,000 | ~$6.00 | Heavy processing + reports |

### Budget Enforcement

Before any AI operation, the system checks the remaining budget:

```typescript
async function checkBudget(companyId: string, estimatedTokens: number): Promise<void> {
  const startOfMonth = startOfCurrentMonth();

  const usedThisMonth = await prisma.aIProcessingJob.aggregate({
    where: {
      companyId,
      createdAt: { gte: startOfMonth },
      status: { in: ['COMPLETED', 'PROCESSING'] },
    },
    _sum: { tokensUsed: true },
  });

  const budget = await getCompanyTokenBudget(companyId);
  const remaining = budget - (usedThisMonth._sum.tokensUsed || 0);

  if (remaining < estimatedTokens) {
    throw new BusinessRuleException(
      'AI_BUDGET_EXCEEDED',
      'errors.ai.budgetExceeded',
      {
        budget,
        used: usedThisMonth._sum.tokensUsed || 0,
        remaining,
        estimated: estimatedTokens,
      },
    );
  }
}
```

### Token Estimation

Before processing, estimate the token cost to avoid surprise overruns:

| Operation | Estimation Formula |
|-----------|-------------------|
| Text extraction (PDF/DOCX/XLSX) | File size in bytes / 4 (rough text-to-token ratio) |
| Image text extraction (Claude Vision) | ~1000 tokens per image (fixed estimate) |
| Embedding generation | Chunk token count * 1.1 (small overhead per chunk) |
| Summary generation | Context tokens + 2000 output tokens |
| Report generation | Context tokens + 4000 output tokens |

### Cost Tracking

Each `AIProcessingJob` records:
- `tokensUsed`: actual tokens consumed (input + output)
- `cost`: estimated cost in USD, computed as `tokensUsed * pricePerToken`

Current pricing reference (Claude Sonnet):
- Input: $3.00 / 1M tokens
- Output: $15.00 / 1M tokens

### Summary Caching

To avoid unnecessary re-processing:
- The `AICompanySummary.sourceDocumentHash` stores a SHA-256 hash of `documentIds + updatedAt` timestamps.
- Before regenerating a summary, compute the current hash and compare.
- If unchanged, return the cached summary without calling Claude API.
- If changed (documents added, removed, or re-processed), regenerate.

---

## API Endpoints

### POST /api/v1/companies/:companyId/ai/documents/:documentId/process

**Description**: Trigger AI processing for a single dataroom document.

**Auth**: Required. User must be ADMIN or FINANCE.

**Request**: Empty body. The document is identified by URL parameter.

**Response** (`202 Accepted`):

```json
{
  "success": true,
  "data": {
    "jobId": "job-uuid-123",
    "documentId": "doc-uuid-456",
    "status": "QUEUED",
    "estimatedTokens": 12500,
    "pollUrl": "/api/v1/companies/:companyId/ai/jobs/job-uuid-123"
  }
}
```

**Error Responses**:
- `404 Not Found` — Document does not exist or does not belong to this company
- `409 Conflict` — Document is already being processed (existing job in QUEUED or PROCESSING state)
- `422 Unprocessable Entity` — `AI_BUDGET_EXCEEDED`, `AI_DOCUMENT_TOO_LARGE`, `AI_UNSUPPORTED_FORMAT`

---

### POST /api/v1/companies/:companyId/ai/documents/process-all

**Description**: Trigger AI processing for all unprocessed documents in the company dataroom.

**Auth**: Required. User must be ADMIN or FINANCE.

**Request**: Empty body.

**Response** (`202 Accepted`):

```json
{
  "success": true,
  "data": {
    "jobIds": ["job-uuid-1", "job-uuid-2", "job-uuid-3"],
    "documentsQueued": 3,
    "documentsSkipped": 2,
    "estimatedTotalTokens": 45000,
    "skippedReasons": [
      { "documentId": "doc-uuid-7", "reason": "ALREADY_PROCESSED" },
      { "documentId": "doc-uuid-8", "reason": "UNSUPPORTED_FORMAT" }
    ]
  }
}
```

**Behavior**:
- Skips documents with `aiProcessingStatus` in `COMPLETED`, `EXTRACTING`, or `EMBEDDING`
- Skips unsupported file types (PPTX in MVP)
- Estimates total token cost; if it would exceed budget, only queues documents that fit within remaining budget, and includes a warning in the response
- Returns the list of created job IDs and skipped document reasons

**Error Responses**:
- `422 Unprocessable Entity` — `AI_BUDGET_EXCEEDED` (only if zero documents can be processed)

---

### GET /api/v1/companies/:companyId/ai/jobs/:jobId

**Description**: Get the status of an AI processing job.

**Auth**: Required. User must be a member of the company.

**Response** (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": "job-uuid-123",
    "companyId": "company-uuid",
    "documentId": "doc-uuid-456",
    "jobType": "DOCUMENT_EXTRACTION",
    "status": "PROCESSING",
    "progress": 65,
    "tokensUsed": 0,
    "cost": "0.000000",
    "error": null,
    "startedAt": "2026-02-26T10:30:00.000Z",
    "completedAt": null,
    "createdAt": "2026-02-26T10:29:55.000Z"
  }
}
```

---

### GET /api/v1/companies/:companyId/ai/status

**Description**: Get the overall AI processing status for the company.

**Auth**: Required. User must be ADMIN, FINANCE, or LEGAL.

**Response** (`200 OK`):

```json
{
  "success": true,
  "data": {
    "companyId": "company-uuid",
    "documentsTotal": 12,
    "documentsProcessed": 8,
    "documentsProcessing": 1,
    "documentsFailed": 1,
    "documentsPending": 2,
    "tokensUsedThisMonth": 65000,
    "tokenBudget": 100000,
    "budgetRemainingPercentage": "35.00",
    "lastProcessedAt": "2026-02-25T14:00:00.000Z"
  }
}
```

---

### POST /api/v1/companies/:companyId/ai/summary

**Description**: Generate (or retrieve cached) an AI company summary.

**Auth**: Required. User must be ADMIN, FINANCE, or LEGAL.

**Response** (`200 OK` if cached, `202 Accepted` if generating):

**Cached response** (`200 OK`):

```json
{
  "success": true,
  "data": {
    "id": "summary-uuid",
    "companyId": "company-uuid",
    "summary": "LuminaTech is a B2B SaaS company focused on...",
    "keyFindings": [
      {
        "category": "Financial",
        "title": "Strong MRR growth",
        "description": "Monthly recurring revenue grew 25% QoQ according to the Q4 2025 financial report.",
        "confidence": "high",
        "sourceDocumentId": "doc-uuid-fin"
      },
      {
        "category": "Legal",
        "title": "Pending trademark registration",
        "description": "The legal documents reference a pending trademark application filed in October 2025.",
        "confidence": "medium",
        "sourceDocumentId": "doc-uuid-legal"
      }
    ],
    "sourceDocumentIds": ["doc-uuid-1", "doc-uuid-2", "doc-uuid-3"],
    "tokensUsed": 3500,
    "generatedAt": "2026-02-25T14:00:00.000Z"
  }
}
```

**Generating response** (`202 Accepted`):

```json
{
  "success": true,
  "data": {
    "jobId": "job-uuid-789",
    "status": "QUEUED",
    "message": "Summary is being generated. This may take up to 30 seconds."
  }
}
```

**Error Responses**:
- `422 Unprocessable Entity` — `AI_NO_CONTENT` (no documents have been processed yet)
- `422 Unprocessable Entity` — `AI_BUDGET_EXCEEDED`

---

### GET /api/v1/companies/:companyId/ai/jobs

**Description**: List all AI processing jobs for the company.

**Auth**: Required. User must be ADMIN, FINANCE, or LEGAL.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `status` | string | — | Filter by status: QUEUED, PROCESSING, COMPLETED, FAILED |
| `jobType` | string | — | Filter by job type |
| `documentId` | UUID | — | Filter by document |
| `sort` | string | `-createdAt` | Sort field |

**Response** (`200 OK`): Standard paginated response (see `api-standards.md`).

---

## Frontend Specification

### Navigation

AI features are accessible from the company dataroom page and a dedicated AI dashboard:

| Sidebar Label | URL | Component |
|---------------|-----|-----------|
| Documents (existing) | `/companies/:companyId/documents` | `DataroomPage` (enhanced with AI buttons) |
| AI Intelligence | `/companies/:companyId/ai` | `AIIntelligencePage` |

### Dataroom Page Enhancements

The existing dataroom page (see `company-dataroom.md`) receives the following additions:

**Page header**: Add a "Process All with AI" button next to the existing "+ Upload Document" button. Uses secondary variant. Only visible to ADMIN and FINANCE roles.

**Document item**: Each `DocumentItem` component gains:
- An AI status badge below the existing category badge
- A "Process with AI" ghost icon button (only for unprocessed documents)

**AI Status Badge on Document Items**:

| Status | Badge | Color |
|--------|-------|-------|
| PENDING | — (no badge shown) | — |
| EXTRACTING | "AI Processing..." | blue-100, blue-600 text, animated |
| EMBEDDING | "AI Processing..." | blue-100, blue-600 text, animated |
| COMPLETED | "AI Processed" | green-100, green-700 text |
| FAILED | "AI Failed" | red-50, destructive text |
| SKIPPED | "AI Skipped" | gray-100, gray-500 text |

### AI Intelligence Dashboard Page

**URL**: `/companies/:companyId/ai`

```
+-------------------------------------------------------------+
|  h1: AI Intelligence                                         |
|  body-sm: Document analysis and AI-generated insights        |
+-------------------------------------------------------------+
|                                                               |
|  +-- Summary Cards (3) ------------------------------------+ |
|  | Documents Processed | Tokens Used      | Budget Remaining| |
|  | 8 / 12              | 65.000 / 100.000 | 35%            | |
|  +----------------------------------------------------------+ |
|                                                               |
|  +-- Budget Progress Bar -----------------------------------+ |
|  | [============================..........] 65% used         | |
|  +----------------------------------------------------------+ |
|                                                               |
|  +-- Company Summary Card ----------------------------------+ |
|  |  h3: Company Summary              [Regenerate]           | |
|  |                                                           | |
|  |  "LuminaTech is a B2B SaaS company focused on..."       | |
|  |                                                           | |
|  |  Key Findings:                                            | |
|  |  * Financial: Strong MRR growth (high confidence)        | |
|  |  * Legal: Pending trademark (medium confidence)          | |
|  |  * Product: Feature-complete MVP (high confidence)       | |
|  |                                                           | |
|  |  Generated: 25/02/2026 14:00  |  Tokens: 3.500          | |
|  +----------------------------------------------------------+ |
|                                                               |
|  +-- Processing Jobs Table ---------------------------------+ |
|  | Document        | Type        | Status    | Tokens | Date | |
|  | PitchDeck.pdf   | Extraction  | Completed | 2.500  | 25/02| |
|  | Financials.xlsx | Extraction  | Completed | 1.200  | 25/02| |
|  | Logo.png        | Extraction  | Skipped   | 0      | 25/02| |
|  +----------------------------------------------------------+ |
+-------------------------------------------------------------+
```

#### Summary Cards (3)

| Card | Value | Format | Icon |
|------|-------|--------|------|
| Documents Processed | `{processed} / {total}` | Integer | `FileCheck` |
| Tokens Used | `{used} / {budget}` | Brazilian number (e.g., `65.000 / 100.000`) | `Zap` |
| Budget Remaining | `{percentage}%` | Percentage | `Wallet` |

#### Budget Progress Bar

- Uses shadcn/ui `Progress` component
- Color thresholds: `blue-600` (0-79%), `cream-600` (80-94%), `destructive` (95%+)
- Label: "{used} / {budget} tokens utilizados" / "{used} / {budget} tokens used"

#### Company Summary Card

- Card with white background, `radius-lg`, `shadow-sm`
- Title: "Company Summary" / "Resumo da Empresa" with "Regenerate" button (secondary variant, ghost)
- Summary text in `body` style, `gray-700`
- Key findings as a bulleted list with confidence badge next to each
- Footer: generation date + token count in `caption` style, `gray-500`
- When no summary exists: empty state with "Generate Summary" CTA button
- When generating: skeleton placeholder with "Generating summary..." text

#### Processing Jobs Table

| Column | Field | Alignment | Format | Sortable |
|--------|-------|-----------|--------|----------|
| Document | `document.name` | left | Text (truncated) | Yes |
| Type | `jobType` | left | Badge (Extraction, Embedding, Summary) | Yes |
| Status | `status` | left | `AsyncJobStatusBadge` component | Yes |
| Tokens | `tokensUsed` | right | Brazilian number | Yes |
| Date | `completedAt` or `createdAt` | right | dd/MM/yyyy | Yes |

### TanStack Query Hooks

```typescript
// frontend/src/hooks/use-ai-intelligence.ts

/**
 * useAIStatus(companyId: string)
 * GET /api/v1/companies/:companyId/ai/status
 * Returns: AIProcessingStatus
 * Query key: ['ai-status', companyId]
 * Refetch interval: 10s when any document is in PROCESSING state
 */

/**
 * useProcessDocument(companyId: string)
 * Mutation: POST /api/v1/companies/:companyId/ai/documents/:documentId/process
 * onSuccess: invalidate ['ai-status', companyId] and ['profile-documents', companyId]
 * onError: show error toast with messageKey translation
 */

/**
 * useProcessAllDocuments(companyId: string)
 * Mutation: POST /api/v1/companies/:companyId/ai/documents/process-all
 * onSuccess: invalidate ['ai-status', companyId] and ['profile-documents', companyId], show toast with count
 * onError: show error toast
 */

/**
 * useAISummary(companyId: string)
 * GET /api/v1/companies/:companyId/ai/summary (lazy, triggered by page load or regenerate)
 * Returns: AICompanySummary | null
 * Query key: ['ai-summary', companyId]
 */

/**
 * useGenerateSummary(companyId: string)
 * Mutation: POST /api/v1/companies/:companyId/ai/summary
 * onSuccess: invalidate ['ai-summary', companyId], show success toast
 * onError: show error toast
 */

/**
 * useAIJobs(companyId: string, params?)
 * GET /api/v1/companies/:companyId/ai/jobs
 * Returns: paginated AIProcessingJob[]
 * Query key: ['ai-jobs', companyId, params]
 * Refetch interval: 5s when any job is QUEUED or PROCESSING
 */

/**
 * useAIJobStatus(companyId: string, jobId: string | null)
 * GET /api/v1/companies/:companyId/ai/jobs/:jobId
 * Returns: AIProcessingJob
 * Query key: ['ai-job', jobId]
 * Refetch interval: 3s when status is QUEUED or PROCESSING, stops on COMPLETED/FAILED
 */
```

### Component List

| Component | File Path | Description |
|-----------|-----------|-------------|
| `AIIntelligencePage` | `frontend/src/app/(dashboard)/companies/[companyId]/ai/page.tsx` | Main AI dashboard page |
| `AIStatusCards` | `frontend/src/components/ai/AIStatusCards.tsx` | Summary cards showing documents processed, tokens used, budget |
| `AIBudgetBar` | `frontend/src/components/ai/AIBudgetBar.tsx` | Progress bar for token budget usage |
| `AICompanySummaryCard` | `frontend/src/components/ai/AICompanySummaryCard.tsx` | Displays AI-generated company summary with key findings |
| `AIKeyFindingItem` | `frontend/src/components/ai/AIKeyFindingItem.tsx` | Single key finding with category, title, confidence badge |
| `AIJobsTable` | `frontend/src/components/ai/AIJobsTable.tsx` | Paginated table of AI processing jobs |
| `AIDocumentBadge` | `frontend/src/components/ai/AIDocumentBadge.tsx` | AI processing status badge for document items |
| `AIProcessButton` | `frontend/src/components/ai/AIProcessButton.tsx` | "Process with AI" button for individual documents |
| `AIProcessAllButton` | `frontend/src/components/ai/AIProcessAllButton.tsx` | "Process All" button for dataroom page header |
| `AIEmptyState` | `frontend/src/components/ai/AIEmptyState.tsx` | Empty state for AI dashboard when no documents processed |

### Loading States

- **AI dashboard initial load**: 3 skeleton stat cards + skeleton progress bar + skeleton summary card + skeleton table (5 rows)
- **Document processing**: `AIDocumentBadge` shows animated "AI Processing..." badge with `Loader2` spinning icon
- **Summary generating**: Summary card shows skeleton lines with "Generating summary..." label
- **Process All**: Button shows spinner + "Processing..." label, disabled until all jobs complete

### Error States

| Error | Display | Recovery |
|-------|---------|----------|
| AI budget exceeded | Error toast + budget bar turns destructive | Admin increases budget or waits for month reset |
| Document too large | Error toast: "Document exceeds the 50 MB / 500 page limit for AI processing" | User uploads a smaller version |
| Unsupported format | Error toast: "This file type is not supported for AI processing" | User converts to supported format |
| Processing failed | "AI Failed" badge on document + error details in jobs table | User clicks retry button |
| No processable content | "AI Skipped" badge on document | No recovery needed |
| Claude API unavailable | Error toast: "AI service is temporarily unavailable. Please try again later." | User retries |

### i18n Keys

All user-facing strings added to both `messages/pt-BR.json` and `messages/en.json`:

**PT-BR translations**:

| Key | PT-BR Value |
|-----|-------------|
| `ai.title` | Inteligencia AI |
| `ai.subtitle` | Analise de documentos e insights gerados por IA |
| `ai.status.documentsProcessed` | Documentos Processados |
| `ai.status.tokensUsed` | Tokens Utilizados |
| `ai.status.budgetRemaining` | Orcamento Restante |
| `ai.budget.label` | {used} / {budget} tokens utilizados |
| `ai.budget.warning` | Orcamento de tokens proximo do limite |
| `ai.budget.exceeded` | Orcamento de tokens excedido. Aguarde o proximo mes ou aumente o limite. |
| `ai.summary.title` | Resumo da Empresa |
| `ai.summary.regenerate` | Regenerar |
| `ai.summary.generate` | Gerar Resumo |
| `ai.summary.generating` | Gerando resumo... |
| `ai.summary.keyFindings` | Principais Descobertas |
| `ai.summary.confidence.high` | Alta confianca |
| `ai.summary.confidence.medium` | Media confianca |
| `ai.summary.confidence.low` | Baixa confianca |
| `ai.summary.generatedAt` | Gerado em {date} |
| `ai.summary.tokens` | {count} tokens |
| `ai.summary.empty.title` | Nenhum resumo disponivel |
| `ai.summary.empty.description` | Processe documentos e gere um resumo da empresa |
| `ai.summary.noDocuments` | Nenhum documento processado. Processe ao menos um documento para gerar um resumo. |
| `ai.jobs.title` | Jobs de Processamento |
| `ai.jobs.document` | Documento |
| `ai.jobs.type` | Tipo |
| `ai.jobs.status` | Status |
| `ai.jobs.tokens` | Tokens |
| `ai.jobs.date` | Data |
| `ai.jobs.type.extraction` | Extracao |
| `ai.jobs.type.embedding` | Embedding |
| `ai.jobs.type.summary` | Resumo |
| `ai.jobs.type.report` | Relatorio |
| `ai.jobs.type.qa` | Pergunta |
| `ai.process.button` | Processar com IA |
| `ai.process.all` | Processar Todos com IA |
| `ai.process.processing` | Processando... |
| `ai.process.success` | Documento processado com sucesso |
| `ai.process.allSuccess` | {count} documentos enfileirados para processamento |
| `ai.process.allSkipped` | {count} documentos ignorados |
| `ai.badge.processing` | IA Processando... |
| `ai.badge.completed` | IA Processado |
| `ai.badge.failed` | IA Falhou |
| `ai.badge.skipped` | IA Ignorado |
| `ai.empty.title` | Nenhum documento processado |
| `ai.empty.description` | Processe documentos do dataroom para habilitar analise por IA |
| `ai.empty.action` | Ir para Documentos |

**EN translations**:

| Key | EN Value |
|-----|----------|
| `ai.title` | AI Intelligence |
| `ai.subtitle` | Document analysis and AI-generated insights |
| `ai.status.documentsProcessed` | Documents Processed |
| `ai.status.tokensUsed` | Tokens Used |
| `ai.status.budgetRemaining` | Budget Remaining |
| `ai.budget.label` | {used} / {budget} tokens used |
| `ai.budget.warning` | Token budget approaching limit |
| `ai.budget.exceeded` | Token budget exceeded. Wait for the next month or increase the limit. |
| `ai.summary.title` | Company Summary |
| `ai.summary.regenerate` | Regenerate |
| `ai.summary.generate` | Generate Summary |
| `ai.summary.generating` | Generating summary... |
| `ai.summary.keyFindings` | Key Findings |
| `ai.summary.confidence.high` | High confidence |
| `ai.summary.confidence.medium` | Medium confidence |
| `ai.summary.confidence.low` | Low confidence |
| `ai.summary.generatedAt` | Generated on {date} |
| `ai.summary.tokens` | {count} tokens |
| `ai.summary.empty.title` | No summary available |
| `ai.summary.empty.description` | Process documents and generate a company summary |
| `ai.summary.noDocuments` | No documents processed. Process at least one document to generate a summary. |
| `ai.jobs.title` | Processing Jobs |
| `ai.jobs.document` | Document |
| `ai.jobs.type` | Type |
| `ai.jobs.status` | Status |
| `ai.jobs.tokens` | Tokens |
| `ai.jobs.date` | Date |
| `ai.jobs.type.extraction` | Extraction |
| `ai.jobs.type.embedding` | Embedding |
| `ai.jobs.type.summary` | Summary |
| `ai.jobs.type.report` | Report |
| `ai.jobs.type.qa` | Q&A |
| `ai.process.button` | Process with AI |
| `ai.process.all` | Process All with AI |
| `ai.process.processing` | Processing... |
| `ai.process.success` | Document processed successfully |
| `ai.process.allSuccess` | {count} documents queued for processing |
| `ai.process.allSkipped` | {count} documents skipped |
| `ai.badge.processing` | AI Processing... |
| `ai.badge.completed` | AI Processed |
| `ai.badge.failed` | AI Failed |
| `ai.badge.skipped` | AI Skipped |
| `ai.empty.title` | No documents processed |
| `ai.empty.description` | Process dataroom documents to enable AI analysis |
| `ai.empty.action` | Go to Documents |

### Accessibility Requirements

- AI process buttons have `aria-label` attributes (e.g., `aria-label="Process PitchDeck.pdf with AI"`)
- Processing status badges include `aria-live="polite"` for screen reader announcements on status changes
- Budget progress bar has `aria-label` with current usage (e.g., "65% of AI token budget used")
- Key findings list items use semantic `<ul>` elements
- Regenerate button has `aria-label="Regenerate company AI summary"`
- Empty states use `role="status"` for screen reader announcement

---

## Error Codes

### AI — Error Codes

| Code | messageKey | HTTP | PT-BR | EN |
|------|-----------|------|-------|-----|
| `AI_PROCESSING_FAILED` | `errors.ai.processingFailed` | 500 | Falha no processamento de IA | AI processing failed |
| `AI_BUDGET_EXCEEDED` | `errors.ai.budgetExceeded` | 422 | Orcamento de tokens de IA excedido para este mes | AI token budget exceeded for this month |
| `AI_DOCUMENT_TOO_LARGE` | `errors.ai.documentTooLarge` | 422 | Documento excede o limite de 50 MB ou 500 paginas para processamento de IA | Document exceeds 50 MB or 500 page limit for AI processing |
| `AI_SERVICE_UNAVAILABLE` | `errors.ai.serviceUnavailable` | 502 | Servico de IA temporariamente indisponivel | AI service temporarily unavailable |
| `AI_UNSUPPORTED_FORMAT` | `errors.ai.unsupportedFormat` | 422 | Formato de arquivo nao suportado para processamento de IA | File format not supported for AI processing |
| `AI_NO_CONTENT` | `errors.ai.noContent` | 422 | Nenhum conteudo extraivel encontrado no documento | No extractable content found in document |
| `AI_JOB_NOT_FOUND` | `errors.ai.jobNotFound` | 404 | Job de processamento de IA nao encontrado | AI processing job not found |
| `AI_ALREADY_PROCESSING` | `errors.ai.alreadyProcessing` | 409 | Documento ja esta sendo processado | Document is already being processed |

### Audit Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `AI_DOCUMENT_PROCESSED` | ProfileDocument | SYSTEM | Document text extraction + embedding completed |
| `AI_DOCUMENT_PROCESSING_FAILED` | ProfileDocument | SYSTEM | Document processing failed after all retries |
| `AI_SUMMARY_GENERATED` | AICompanySummary | USER | Company summary generated or regenerated |
| `AI_REPORT_GENERATED` | ExportJob | USER | AI-powered report generated |
| `AI_BUDGET_WARNING` | Company | SYSTEM | Company reached 80% of monthly token budget |

---

## Business Rules

### BR-1: Document Size Limits for AI Processing

- Maximum file size: 50 MB
- Maximum page count (PDFs): 500 pages
- Documents exceeding these limits return `AI_DOCUMENT_TOO_LARGE`

### BR-2: Token Budget Enforcement

- Budget is checked before processing starts
- If estimated tokens exceed remaining budget, the job is rejected
- Budget resets on the 1st of each month at 00:00 UTC
- ADMIN can adjust `aiTokenBudget` in company settings

### BR-3: Processing Deduplication

- A document can only have one active processing job (QUEUED or PROCESSING) at a time
- Re-processing a completed document creates a new job and replaces existing chunks
- Failed documents can be retried immediately

### BR-4: Summary Cache Invalidation

- Summary is cached until source documents change (based on document ID + updatedAt hash)
- Adding, removing, or re-processing any document invalidates the cache
- Manually clicking "Regenerate" always bypasses the cache

### BR-5: Supported File Types

| File Type | MIME Types | AI Support |
|-----------|-----------|------------|
| PDF | `application/pdf` | Full text extraction + page-aware chunking |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Full text extraction |
| XLSX | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Structured text extraction (sheet-aware) |
| PNG | `image/png` | Claude Vision text extraction |
| JPG/JPEG | `image/jpeg` | Claude Vision text extraction |
| PPTX | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | Not supported in MVP (AI_UNSUPPORTED_FORMAT) |

---

## Edge Cases

### EC-1: Document with No Extractable Text

**Scenario**: A scanned PDF with no OCR text layer, or an image with no visible text.
**Handling**: After extraction attempt, if the extracted text is empty or below `minChunkTokens` (50 tokens), set `aiProcessingStatus = SKIPPED` and `aiError = "No extractable content"`. The document is not embedded.

### EC-2: Claude API Rate Limiting

**Scenario**: The Anthropic API returns a 429 rate limit error during batch processing.
**Handling**: Bull queue retries with exponential backoff (1s, 2s, 4s). Maximum 3 retries. If all retries fail, the job status becomes FAILED and the user can retry manually.

### EC-3: Concurrent Processing of Same Document

**Scenario**: User clicks "Process with AI" twice quickly, or processes a document while "Process All" is running.
**Handling**: Before creating a job, check for existing QUEUED/PROCESSING jobs for the same document. Return `409 AI_ALREADY_PROCESSING` if found.

### EC-4: Document Deleted During Processing

**Scenario**: User deletes a document from the dataroom while AI processing is in progress.
**Handling**: The `ProfileDocument` has `onDelete: Cascade` on `DocumentChunk` and `onDelete: SetNull` on `AIProcessingJob`. The Bull job catches the "document not found" error and marks the job as FAILED with a descriptive message.

### EC-5: Budget Exceeded Mid-Batch

**Scenario**: "Process All" starts 10 documents, but the budget runs out after 6.
**Handling**: Each document's processing checks the budget independently before starting. Documents 7-10 fail with `AI_BUDGET_EXCEEDED`. The user sees which documents were processed and which were not.

### EC-6: Very Large Spreadsheet

**Scenario**: An XLSX file with 50 sheets and 100,000 rows.
**Handling**: Limit extraction to the first 20 sheets and 10,000 rows per sheet. Include a metadata note: `"truncated": true` in the chunk metadata. This prevents excessive token usage on a single file.

### EC-7: Image-Only PDF

**Scenario**: A PDF where all pages are scanned images (no text layer).
**Handling**: First attempt `pdf-parse` for text. If text is empty or minimal (<50 tokens total), fall back to Claude Vision API for the first 10 pages. If still no text, set status to SKIPPED.

---

## Dependencies

### External Dependencies

| Dependency | Package | Purpose | Notes |
|------------|---------|---------|-------|
| Anthropic Claude API | `@anthropic-ai/sdk` | Text understanding, vision OCR, summary generation | claude-sonnet-4-6 for processing |
| Voyage AI Embeddings | `voyageai` | Vector embedding generation | Recommended by Anthropic; 1536 dimensions |
| pdf-parse | `pdf-parse` | PDF text extraction | Already used in dataroom for page count |
| mammoth | `mammoth` | DOCX to plain text conversion | Lightweight, no native dependencies |
| xlsx | `xlsx` (SheetJS) | Spreadsheet parsing | Community edition, no native dependencies |
| pgvector | PostgreSQL extension | Vector similarity search | Requires `CREATE EXTENSION vector` migration |
| Bull queue | `@nestjs/bull` | Async job processing | Reuses existing Redis infrastructure |
| tiktoken | `tiktoken` | Accurate token counting | Uses cl100k_base encoding |

### Internal Dependencies

| Dependency | Relationship |
|------------|-------------|
| `company-dataroom.md` | Source `ProfileDocument` entities that feed into the AI pipeline |
| `reports-analytics.md` | AI reports use the existing `ExportJob` model and report generation pipeline |
| `company-profile.md` | `aiTokenBudget` field on `CompanyProfile` |
| `notifications.md` | `AI_PROCESSING_COMPLETE` notification events |
| `user-permissions.md` | ADMIN and FINANCE roles can trigger AI processing |
| `audit-logging.md` | AI processing events are audit-logged |
| `security.md` | PII redaction before sending data to Claude API |

---

## Technical Implementation

### Backend Module Structure

```
backend/src/ai-intelligence/
  ai-intelligence.module.ts          # NestJS module definition
  ai-intelligence.controller.ts       # API endpoints
  services/
    claude-client.service.ts           # Wrapper around @anthropic-ai/sdk
    document-processor.service.ts      # Text extraction pipeline
    embedding.service.ts               # Chunking + embedding generation
    rag.service.ts                     # Retrieval-augmented generation (post-MVP)
    report-generator.service.ts        # AI report generation
    ai-budget.service.ts               # Token budget checking and tracking
  processors/
    ai-processing.processor.ts         # Bull queue processor for document processing
    ai-summary.processor.ts            # Bull queue processor for summary generation
  dto/
    process-document.dto.ts
    ai-status.dto.ts
    ai-summary.dto.ts
```

### Claude Client Service

```typescript
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class ClaudeClientService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async generateText(params: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: params.maxTokens || 2000,
      temperature: params.temperature || 0.3,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.prompt }],
    });

    const textBlock = response.content.find((b) => b.type === 'text');

    return {
      content: textBlock?.text || '',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }

  async extractTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<{
    text: string;
    inputTokens: number;
    outputTokens: number;
  }> {
    const base64 = imageBuffer.toString('base64');

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/png' | 'image/jpeg',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Extract all visible text from this image. Preserve the original structure and formatting. Return only the extracted text, no commentary.',
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');

    return {
      text: textBlock?.text || '',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  }
}
```

### Document Processor Service

```typescript
import { Injectable } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

@Injectable()
export class DocumentProcessorService {
  async extractText(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ text: string; metadata: Record<string, unknown> }> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractFromPdf(buffer);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractFromDocx(buffer);
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return this.extractFromXlsx(buffer);
      case 'image/png':
      case 'image/jpeg':
        // Delegate to ClaudeClientService for vision extraction
        throw new Error('Use ClaudeClientService.extractTextFromImage for images');
      default:
        throw new BusinessRuleException(
          'AI_UNSUPPORTED_FORMAT',
          'errors.ai.unsupportedFormat',
          { mimeType },
        );
    }
  }

  private async extractFromPdf(buffer: Buffer): Promise<{
    text: string;
    metadata: Record<string, unknown>;
  }> {
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      metadata: {
        pageCount: data.numpages,
        sourceType: 'pdf',
      },
    };
  }

  private async extractFromDocx(buffer: Buffer): Promise<{
    text: string;
    metadata: Record<string, unknown>;
  }> {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value,
      metadata: { sourceType: 'docx' },
    };
  }

  private async extractFromXlsx(buffer: Buffer): Promise<{
    text: string;
    metadata: Record<string, unknown>;
  }> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets: string[] = [];

    // Limit to first 20 sheets
    const sheetNames = workbook.SheetNames.slice(0, 20);

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' });

      // Limit to first 10,000 rows per sheet
      const rows = csv.split('\n').slice(0, 10000);
      sheets.push(`Sheet: ${sheetName}\n${rows.join('\n')}`);
    }

    return {
      text: sheets.join('\n\n---\n\n'),
      metadata: {
        sourceType: 'xlsx',
        sheetCount: workbook.SheetNames.length,
        truncated: workbook.SheetNames.length > 20,
      },
    };
  }
}
```

### Embedding Service

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { encode } from 'tiktoken';

interface Chunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class EmbeddingService {
  constructor(private prisma: PrismaService) {}

  chunkText(text: string, metadata: Record<string, unknown>): Chunk[] {
    const maxTokens = 1000;
    const overlapTokens = 200;
    const minTokens = 50;

    // Split by section boundaries first
    const sections = text.split(/\n{2,}/);
    const chunks: Chunk[] = [];
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionTokens = this.countTokens(section);

      if (sectionTokens <= maxTokens) {
        if (sectionTokens >= minTokens) {
          chunks.push({
            content: section.trim(),
            chunkIndex: chunkIndex++,
            tokenCount: sectionTokens,
            metadata,
          });
        }
      } else {
        // Split large sections by sentences with overlap
        const sentences = section.match(/[^.!?]+[.!?]+/g) || [section];
        let currentChunk = '';
        let currentTokens = 0;

        for (const sentence of sentences) {
          const sentenceTokens = this.countTokens(sentence);

          if (currentTokens + sentenceTokens > maxTokens && currentTokens >= minTokens) {
            chunks.push({
              content: currentChunk.trim(),
              chunkIndex: chunkIndex++,
              tokenCount: currentTokens,
              metadata,
            });

            // Keep overlap from end of current chunk
            const overlapText = this.getOverlapText(currentChunk, overlapTokens);
            currentChunk = overlapText + sentence;
            currentTokens = this.countTokens(currentChunk);
          } else {
            currentChunk += sentence;
            currentTokens += sentenceTokens;
          }
        }

        // Don't forget the last chunk
        if (currentTokens >= minTokens) {
          chunks.push({
            content: currentChunk.trim(),
            chunkIndex: chunkIndex++,
            tokenCount: currentTokens,
            metadata,
          });
        }
      }
    }

    return chunks;
  }

  async storeChunksWithEmbeddings(
    documentId: string,
    companyId: string,
    chunks: Chunk[],
    embeddingFn: (text: string) => Promise<number[]>,
  ): Promise<{ totalTokens: number; chunkCount: number }> {
    let totalTokens = 0;

    for (const chunk of chunks) {
      const embedding = await embeddingFn(chunk.content);

      // Use raw SQL for pgvector insert
      await this.prisma.$executeRaw`
        INSERT INTO document_chunks (id, document_id, company_id, content, chunk_index, token_count, embedding, metadata, created_at)
        VALUES (gen_random_uuid(), ${documentId}, ${companyId}, ${chunk.content}, ${chunk.chunkIndex}, ${chunk.tokenCount}, ${embedding}::vector, ${JSON.stringify(chunk.metadata)}::jsonb, NOW())
      `;

      totalTokens += chunk.tokenCount;
    }

    return { totalTokens, chunkCount: chunks.length };
  }

  async searchSimilar(
    companyId: string,
    queryEmbedding: number[],
    topK: number = 5,
    threshold: number = 0.7,
  ): Promise<Array<{ id: string; content: string; similarity: number; metadata: any }>> {
    const results = await this.prisma.$queryRaw`
      SELECT id, content, metadata,
             1 - (embedding <=> ${queryEmbedding}::vector) AS similarity
      FROM document_chunks
      WHERE company_id = ${companyId}
        AND 1 - (embedding <=> ${queryEmbedding}::vector) >= ${threshold}
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT ${topK}
    `;

    return results as any[];
  }

  private countTokens(text: string): number {
    try {
      const encoder = encode(text);
      return encoder.length;
    } catch {
      // Fallback approximation
      return Math.ceil(text.length / 4);
    }
  }

  private getOverlapText(text: string, overlapTokens: number): string {
    const words = text.split(/\s+/);
    const approxWordCount = overlapTokens * 0.75; // rough tokens-to-words ratio
    return words.slice(-Math.ceil(approxWordCount)).join(' ') + ' ';
  }
}
```

### Bull Queue Processor

```typescript
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { ClaudeClientService } from '../services/claude-client.service';
import { DocumentProcessorService } from '../services/document-processor.service';
import { EmbeddingService } from '../services/embedding.service';
import { AIBudgetService } from '../services/ai-budget.service';
import { AuditService } from '../../audit/audit.service';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

@Processor('ai-processing')
export class AIProcessingProcessor {
  private s3: S3Client;

  constructor(
    private prisma: PrismaService,
    private claude: ClaudeClientService,
    private processor: DocumentProcessorService,
    private embedding: EmbeddingService,
    private budget: AIBudgetService,
    private audit: AuditService,
  ) {
    this.s3 = new S3Client({ region: 'sa-east-1' });
  }

  @Process('process-document')
  async handleProcessDocument(job: Job<{
    jobId: string;
    documentId: string;
    companyId: string;
  }>) {
    const { jobId, documentId, companyId } = job.data;

    try {
      // Update job status
      await this.updateJob(jobId, { status: 'PROCESSING', startedAt: new Date() });
      await this.updateDocStatus(documentId, 'EXTRACTING');
      await job.progress(10);

      // 1. Fetch document from S3
      const document = await this.prisma.profileDocument.findUniqueOrThrow({
        where: { id: documentId },
      });

      const s3Response = await this.s3.send(new GetObjectCommand({
        Bucket: 'navia-profile-documents',
        Key: document.fileKey,
      }));
      const buffer = Buffer.from(await s3Response.Body.transformToByteArray());

      await job.progress(20);

      // 2. Extract text
      let extractedText: string;
      let extractionMetadata: Record<string, unknown>;
      let extractionTokens = 0;

      if (['image/png', 'image/jpeg'].includes(document.mimeType)) {
        const result = await this.claude.extractTextFromImage(buffer, document.mimeType);
        extractedText = result.text;
        extractionMetadata = { sourceType: 'image' };
        extractionTokens = result.inputTokens + result.outputTokens;
      } else {
        const result = await this.processor.extractText(buffer, document.mimeType);
        extractedText = result.text;
        extractionMetadata = result.metadata;
      }

      await job.progress(40);

      // 3. Check if any text was extracted
      if (!extractedText || extractedText.trim().length < 50) {
        await this.updateJob(jobId, {
          status: 'COMPLETED',
          tokensUsed: extractionTokens,
          completedAt: new Date(),
        });
        await this.updateDocStatus(documentId, 'SKIPPED', 'No extractable content');
        return;
      }

      // 4. Store extracted text in S3
      const textKey = `ai-extractions/${companyId}/${documentId}.txt`;
      await this.s3.send(new PutObjectCommand({
        Bucket: 'navia-profile-documents',
        Key: textKey,
        Body: extractedText,
        ContentType: 'text/plain',
      }));

      await this.prisma.profileDocument.update({
        where: { id: documentId },
        data: { extractedTextKey: textKey },
      });

      await job.progress(50);

      // 5. Chunk text
      await this.updateDocStatus(documentId, 'EMBEDDING');
      const chunks = this.embedding.chunkText(extractedText, extractionMetadata);

      await job.progress(60);

      // 6. Delete existing chunks (if re-processing)
      await this.prisma.documentChunk.deleteMany({ where: { documentId } });

      // 7. Generate embeddings and store chunks
      const embeddingResult = await this.embedding.storeChunksWithEmbeddings(
        documentId,
        companyId,
        chunks,
        async (text) => {
          // Use Voyage AI or Anthropic embedding model
          return this.generateEmbeddingVector(text);
        },
      );

      await job.progress(90);

      // 8. Update document and job
      const totalTokens = extractionTokens + embeddingResult.totalTokens;

      await this.prisma.profileDocument.update({
        where: { id: documentId },
        data: {
          aiProcessingStatus: 'COMPLETED',
          chunkCount: embeddingResult.chunkCount,
          aiTokensUsed: totalTokens,
          aiProcessedAt: new Date(),
          aiError: null,
        },
      });

      await this.updateJob(jobId, {
        status: 'COMPLETED',
        tokensUsed: totalTokens,
        progress: 100,
        completedAt: new Date(),
      });

      // 9. Audit log
      await this.audit.log({
        actorType: 'SYSTEM',
        action: 'AI_DOCUMENT_PROCESSED',
        resourceType: 'ProfileDocument',
        resourceId: documentId,
        companyId,
        changes: {
          before: null,
          after: {
            chunkCount: embeddingResult.chunkCount,
            tokensUsed: totalTokens,
          },
        },
      });

    } catch (error) {
      await this.updateJob(jobId, {
        status: 'FAILED',
        error: error.message,
        completedAt: new Date(),
      });
      await this.updateDocStatus(documentId, 'FAILED', error.message);

      await this.audit.log({
        actorType: 'SYSTEM',
        action: 'AI_DOCUMENT_PROCESSING_FAILED',
        resourceType: 'ProfileDocument',
        resourceId: documentId,
        companyId,
        metadata: { error: error.message },
      });

      throw error; // Re-throw for Bull retry
    }
  }

  private async generateEmbeddingVector(text: string): Promise<number[]> {
    // Implementation depends on chosen embedding provider
    // Voyage AI example:
    // const response = await voyageClient.embed({ input: text, model: 'voyage-3' });
    // return response.data[0].embedding;
    throw new Error('Implement with chosen embedding provider');
  }

  private async updateJob(jobId: string, data: Record<string, unknown>) {
    await this.prisma.aIProcessingJob.update({
      where: { id: jobId },
      data,
    });
  }

  private async updateDocStatus(
    documentId: string,
    status: string,
    error?: string,
  ) {
    await this.prisma.profileDocument.update({
      where: { id: documentId },
      data: {
        aiProcessingStatus: status as any,
        aiError: error || null,
      },
    });
  }
}
```

### Bull Queue Configuration

```typescript
const AI_QUEUE_CONFIG = {
  name: 'ai-processing',
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: true,
    removeOnFail: false, // Keep failed jobs for inspection
    timeout: 300000, // 5-minute timeout per job
  },
};
```

### Controller

```typescript
import {
  Controller, Get, Post, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { RequireAuth } from '../auth/decorators/require-auth.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auditable } from '../audit/auditable.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Controller('api/v1/companies/:companyId/ai')
@RequireAuth()
export class AIIntelligenceController {
  constructor(
    private aiService: AIIntelligenceService,
    private budgetService: AIBudgetService,
  ) {}

  @Post('documents/:documentId/process')
  @Roles('ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.ACCEPTED)
  @Auditable({
    action: 'AI_DOCUMENT_PROCESSED',
    resourceType: 'ProfileDocument',
    resourceIdParam: 'documentId',
  })
  async processDocument(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.aiService.processDocument(companyId, documentId);
  }

  @Post('documents/process-all')
  @Roles('ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.ACCEPTED)
  async processAllDocuments(
    @Param('companyId') companyId: string,
  ) {
    return this.aiService.processAllDocuments(companyId);
  }

  @Get('status')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  async getStatus(@Param('companyId') companyId: string) {
    return this.aiService.getProcessingStatus(companyId);
  }

  @Post('summary')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateSummary(@Param('companyId') companyId: string) {
    return this.aiService.generateOrGetSummary(companyId);
  }

  @Get('summary')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  async getSummary(@Param('companyId') companyId: string) {
    return this.aiService.getCachedSummary(companyId);
  }

  @Get('jobs')
  @Roles('ADMIN', 'FINANCE', 'LEGAL')
  async listJobs(
    @Param('companyId') companyId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('documentId') documentId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.aiService.listJobs(companyId, {
      page: pagination.page,
      limit: pagination.limit,
      status,
      jobType,
      documentId,
      sort,
    });
  }

  @Get('jobs/:jobId')
  async getJob(
    @Param('companyId') companyId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.aiService.getJob(companyId, jobId);
  }
}
```

---

## Security Considerations

### SEC-1: Company Data Isolation

- All vector searches are filtered by `companyId` — a company's document chunks are never returned to users from another company
- The `companyId` filter is applied at the query level (WHERE clause), not post-query, ensuring data isolation at the database level
- RAG prompts only include chunks from the authenticated user's company

### SEC-2: PII Redaction in AI Prompts

Before sending any text to the Claude API, PII is redacted using the shared `redactPii()` utility (see `error-handling.md`):

| Field | Redaction in AI prompts |
|-------|----------------------|
| CPF | Replaced with `[CPF REDACTED]` |
| Email addresses | Replaced with `[EMAIL REDACTED]` |
| Phone numbers | Replaced with `[PHONE REDACTED]` |
| Bank account numbers | Replaced with `[BANK REDACTED]` |

**Note**: Names and company names are NOT redacted — they are needed for meaningful AI analysis.

### SEC-3: API Key Security

- The `ANTHROPIC_API_KEY` environment variable is stored in Railway secrets, never in the codebase
- The API key is only used server-side; it is never exposed to the frontend
- Key rotation: manually rotate annually or on suspected compromise

### SEC-4: Document Access Control Propagation

AI processing respects the same access controls as the underlying documents:
- Only ADMIN and FINANCE roles can trigger AI processing (matches document upload permissions)
- AI summaries and job status are viewable by ADMIN, FINANCE, and LEGAL roles
- INVESTOR and EMPLOYEE roles cannot access AI features

### SEC-5: Audit Logging

All AI operations are audit-logged per the audit logging specification:
- `AI_DOCUMENT_PROCESSED` — successful document processing
- `AI_DOCUMENT_PROCESSING_FAILED` — failed processing
- `AI_SUMMARY_GENERATED` — summary generation
- `AI_REPORT_GENERATED` — report generation
- `AI_BUDGET_WARNING` — budget threshold reached

### SEC-6: Rate Limiting

AI endpoints use the `write` rate limit tier (30 requests per minute) to prevent abuse and excessive API costs. The `GET /ai/status` and `GET /ai/jobs` endpoints use the `read` tier (100 requests per minute).

---

## Success Criteria

### Functional

- [ ] Document text extraction works for PDF, DOCX, XLSX file types
- [ ] Image text extraction works via Claude Vision for PNG and JPG files
- [ ] Chunking produces appropriately sized chunks (800-1200 tokens) with overlap
- [ ] Embeddings are generated and stored in pgvector
- [ ] Vector similarity search returns relevant chunks (cosine similarity > 0.7)
- [ ] Company summary generation produces well-structured output with key findings
- [ ] Summary caching prevents unnecessary re-generation when source documents are unchanged
- [ ] Token budget enforcement prevents processing when budget is exceeded
- [ ] All operations are async and non-blocking via Bull queue
- [ ] Processing status is visible in the UI with real-time updates

### Performance

- [ ] Text extraction completes in < 30 seconds for documents up to 50 MB
- [ ] Embedding generation processes at least 10 chunks per second
- [ ] Vector similarity search returns results in < 500ms
- [ ] Summary generation completes in < 60 seconds
- [ ] AI status endpoint responds in < 200ms

### Reliability

- [ ] Failed processing jobs are retried up to 3 times with exponential backoff
- [ ] Documents deleted during processing do not cause system errors
- [ ] Claude API rate limiting is handled gracefully with retries
- [ ] Budget calculations are accurate to within 5% of actual token usage

### Security

- [ ] Company data isolation: no cross-company data leakage in vector search
- [ ] PII is redacted before sending to Claude API
- [ ] Only authorized roles can access AI features
- [ ] All AI operations are audit-logged
- [ ] API key is never exposed to the frontend

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-dataroom.md](./company-dataroom.md) | Source documents (ProfileDocument) that feed into the AI pipeline; AI status badges on document cards |
| [company-profile.md](./company-profile.md) | `aiTokenBudget` field on CompanyProfile for budget management |
| [reports-analytics.md](./reports-analytics.md) | AI reports use the existing ExportJob model and report generation pipeline; new AI_REPORT ExportJobType |
| [notifications.md](./notifications.md) | AI_PROCESSING_COMPLETE notification events when document processing finishes |
| [user-permissions.md](./user-permissions.md) | ADMIN and FINANCE can trigger processing; LEGAL can view results; INVESTOR/EMPLOYEE have no access |
| [api-standards.md](../.claude/rules/api-standards.md) | Response envelope format, pagination, async job patterns (202 Accepted), HTTP status codes |
| [error-handling.md](../.claude/rules/error-handling.md) | Error code conventions (AI_ prefix), PII redaction utility for AI prompts |
| [audit-logging.md](../.claude/rules/audit-logging.md) | AI audit events (AI_DOCUMENT_PROCESSED, AI_SUMMARY_GENERATED, etc.) |
| [security.md](../.claude/rules/security.md) | PII handling, company data isolation, API key management, S3 encryption |
| [i18n.md](../.claude/rules/i18n.md) | AI namespace translations in PT-BR and EN; Brazilian number formatting for token counts |
| [design-system.md](../.claude/rules/design-system.md) | AI dashboard follows standard card, table, badge, and progress bar patterns |
