# Document Generation Specification

**Topic of Concern**: Template-based legal document creation

**One-Sentence Description**: The system generates legal documents from database-stored templates by filling user-selected form fields, with real-time preview and PDF export.

---

## Overview

Navia generates Brazilian corporate documents (shareholder agreements, meeting minutes, share certificates, etc.) from templates stored in the database. Users fill structured forms that map to template variables, see real-time previews, and generate final PDFs. Templates are editable via admin UI without code deployment.

**Document Types**:
- Share/quota certificates
- Atas de assembleia (shareholder meeting minutes)
- Atas de reuniao de diretoria (board minutes)
- Alteracoes contratuais (contract amendments)
- Acordos de acionistas (shareholder agreements)
- Option grant letters
- Investment agreements (Mutuo conversivel, Investimento-Anjo)

---

## User Stories

### US-1: Select Document Template
**As an** admin user
**I want to** select a document template (e.g., "Shareholder Agreement")
**So that** I can generate a customized version for my company

### US-2: Fill Document Form
**As an** admin user
**I want to** fill a structured form with dropdowns and inputs
**So that** the document auto-populates with my selections

### US-3: Real-Time Preview
**As an** admin user
**I want to** see a live preview of the document as I fill the form
**So that** I can verify it looks correct before generating

### US-4: Generate Final PDF
**As an** admin user
**I want to** generate a final PDF document
**So that** I can download, print, or send for signature

---

## Functional Requirements

### FR-1: Database-Stored Templates
- Templates stored in PostgreSQL (not code)
- Template content uses Mustache/Handlebars syntax
- Template schema defines required fields and types
- Admins can edit templates via UI (future)

### FR-2: Structured Form Generation
- System auto-generates form from template schema
- Field types: text, number, date, dropdown, boolean, array
- Dynamic fields (e.g., add multiple shareholders)
- Field validation (required, format, min/max)

### FR-3: Real-Time Preview
- Preview updates as user types
- Preview shows formatted document (HTML)
- Preview matches final PDF layout

### FR-4: PDF Generation
- Convert HTML preview to PDF via Puppeteer
- Include company branding (logo, colors)
- Page numbers, headers, footers
- Proper page breaks

### FR-5: Document Metadata
- Store: template_id, form_data, generated PDF URL
- Link to company, shareholders, transactions
- Version control for templates

---

## Data Models

```typescript
interface DocumentTemplate {
  id: string;
  name: string;                      // "Shareholder Agreement"
  document_type: 'SHAREHOLDER_AGREEMENT' | 'MEETING_MINUTES' | 'SHARE_CERTIFICATE' | 'OPTION_LETTER' | 'INVESTMENT_AGREEMENT';
  version: string;                   // "1.0.0"

  // Template Content (Handlebars)
  template_content: string;          // HTML with {{variables}}

  // Form Schema (JSON Schema)
  template_schema: {
    fields: {
      name: string;
      type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'array';
      label: string;
      required: boolean;
      options?: string[];            // For select fields
      default?: any;
    }[];
  };

  is_active: boolean;
  created_at: Date;
}

interface Document {
  id: string;
  company_id: string;
  template_id: string;
  title: string;

  // Form Data (filled by user)
  form_data: object;                 // JSON matching template schema

  // Generated Document
  s3_url: string;                    // PDF storage location
  document_hash: string;             // SHA-256 hash for verification

  // Status
  status: 'DRAFT' | 'GENERATED' | 'PENDING_SIGNATURES' | 'FULLY_SIGNED';

  // Blockchain Anchoring
  blockchain_tx_hash: string | null; // Hash anchored on-chain when signed

  generated_at: Date;
  finalized_at: Date | null;

  created_at: Date;
  created_by: string;
}
```

---

## API Endpoints

### List Document Templates

```
GET /api/v1/companies/:companyId/document-templates
```

Returns available document templates for the company.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `type` | string | — | Filter by document_type enum |
| `search` | string | — | Search by template name |
| `sort` | string | `-createdAt` | Sort field (prefix `-` for descending) |

**Response** (200 OK):

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "name": "Shareholder Agreement",
      "documentType": "SHAREHOLDER_AGREEMENT",
      "version": "1.0.0",
      "isActive": true,
      "createdAt": "2026-01-15T10:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "name": "Share Certificate",
      "documentType": "SHARE_CERTIFICATE",
      "version": "1.0.0",
      "isActive": true,
      "createdAt": "2026-01-10T08:00:00.000Z"
    }
  ],
  "meta": {
    "total": 7,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Get Document Template Detail

```
GET /api/v1/companies/:companyId/document-templates/:templateId
```

Returns template details including the form schema for rendering the structured form.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "uuid-1",
    "name": "Shareholder Agreement",
    "documentType": "SHAREHOLDER_AGREEMENT",
    "version": "1.0.0",
    "templateSchema": {
      "fields": [
        {
          "name": "company_name",
          "type": "text",
          "label": "Company Name",
          "required": true
        },
        {
          "name": "shareholders",
          "type": "array",
          "label": "Shareholders",
          "required": true
        },
        {
          "name": "voting_rights",
          "type": "select",
          "label": "Voting Rights",
          "required": true,
          "options": ["pro-rata", "majority", "unanimous"]
        }
      ]
    },
    "isActive": true,
    "createdAt": "2026-01-15T10:00:00.000Z"
  }
}
```

**Error Response** (404 Not Found):

```json
{
  "success": false,
  "error": {
    "code": "DOC_TEMPLATE_NOT_FOUND",
    "message": "Modelo de documento nao encontrado",
    "messageKey": "errors.doc.templateNotFound"
  }
}
```

### Generate Document (Create)

```
POST /api/v1/companies/:companyId/documents
```

Generates a document from a template by filling in the form data.

**Request Body**:

```json
{
  "templateId": "uuid",
  "title": "Shareholder Agreement - Series A",
  "locale": "pt-BR",
  "formData": {
    "company_name": "Startup XYZ Ltda.",
    "shareholders": [
      {"name": "Joao Founder", "cpf": "012.345.678-01", "shares": 600000},
      {"name": "Investor ABC", "cpf": "98.765.432/0001-00", "shares": 150000}
    ],
    "effective_date": "2026-01-20",
    "voting_rights": "pro-rata",
    "transfer_restrictions": true
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `templateId` | UUID | Yes | ID of the template to generate from |
| `title` | string | Yes | Document title |
| `locale` | string | No | Language for the document (`pt-BR` default, `en`) |
| `formData` | object | Yes | JSON matching the template schema |

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Shareholder Agreement - Series A",
    "templateId": "uuid",
    "status": "GENERATED",
    "documentHash": "sha256-hash",
    "previewUrl": "/api/v1/companies/:companyId/documents/uuid/preview",
    "generatedAt": "2026-01-20T14:30:00.000Z",
    "createdAt": "2026-01-20T14:30:00.000Z",
    "createdBy": "user-uuid"
  }
}
```

**Error Response** (404 — template not found):

```json
{
  "success": false,
  "error": {
    "code": "DOC_TEMPLATE_NOT_FOUND",
    "message": "Modelo de documento nao encontrado",
    "messageKey": "errors.doc.templateNotFound"
  }
}
```

**Error Response** (422 — generation failure):

```json
{
  "success": false,
  "error": {
    "code": "DOC_GENERATION_FAILED",
    "message": "Falha na geracao do documento. Tente novamente",
    "messageKey": "errors.doc.generationFailed"
  }
}
```

**Error Response** (400 — validation):

```json
{
  "success": false,
  "error": {
    "code": "VAL_INVALID_INPUT",
    "message": "Dados de entrada invalidos",
    "messageKey": "errors.val.invalidInput",
    "validationErrors": [
      {
        "field": "templateId",
        "message": "ID invalido",
        "messageKey": "errors.val.invalidUuid"
      }
    ]
  }
}
```

### List Documents

```
GET /api/v1/companies/:companyId/documents
```

Returns paginated list of documents for the company.

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `status` | string | — | Filter by status enum |
| `type` | string | — | Filter by document type |
| `search` | string | — | Search by title |
| `sort` | string | `-createdAt` | Sort field |

**Response** (200 OK):

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "title": "Shareholder Agreement - Series A",
      "templateId": "template-uuid",
      "status": "FULLY_SIGNED",
      "documentHash": "sha256-hash",
      "generatedAt": "2026-01-20T14:30:00.000Z",
      "finalizedAt": "2026-01-22T10:00:00.000Z",
      "createdAt": "2026-01-20T14:30:00.000Z",
      "createdBy": "user-uuid"
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Get Document Detail

```
GET /api/v1/companies/:companyId/documents/:documentId
```

Returns full document details including form data and blockchain anchoring info.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "companyId": "company-uuid",
    "templateId": "template-uuid",
    "title": "Shareholder Agreement - Series A",
    "formData": {
      "company_name": "Startup XYZ Ltda.",
      "shareholders": [
        {"name": "Joao Founder", "shares": 600000},
        {"name": "Investor ABC", "shares": 150000}
      ],
      "voting_rights": "pro-rata"
    },
    "status": "GENERATED",
    "documentHash": "sha256-hash",
    "blockchainTxHash": null,
    "generatedAt": "2026-01-20T14:30:00.000Z",
    "finalizedAt": null,
    "createdAt": "2026-01-20T14:30:00.000Z",
    "createdBy": "user-uuid"
  }
}
```

**Error Response** (404 Not Found):

```json
{
  "success": false,
  "error": {
    "code": "DOC_NOT_FOUND",
    "message": "Documento nao encontrado",
    "messageKey": "errors.doc.notFound"
  }
}
```

### Get Document Preview

```
GET /api/v1/companies/:companyId/documents/:documentId/preview
```

Returns HTML preview of the generated document.

**Response** (200 OK): HTML content with `Content-Type: text/html`.

### Download Document PDF

```
GET /api/v1/companies/:companyId/documents/:documentId/download
```

Returns a pre-signed S3 URL for the PDF download.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://s3.amazonaws.com/navia-documents/...",
    "expiresAt": "2026-01-20T15:00:00.000Z",
    "filename": "shareholder-agreement-series-a.pdf"
  }
}
```

### Upload Document

```
POST /api/v1/companies/:companyId/documents/upload
```

Uploads a manually created document (not generated from template). Accepts `multipart/form-data`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | PDF, PNG, or JPG (max 10 MB) |
| `title` | string | Yes | Document title |

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Uploaded Agreement",
    "status": "GENERATED",
    "documentHash": "sha256-hash",
    "createdAt": "2026-01-20T14:30:00.000Z",
    "createdBy": "user-uuid"
  }
}
```

**Error Response** (422 — file too large):

```json
{
  "success": false,
  "error": {
    "code": "DOC_UPLOAD_TOO_LARGE",
    "message": "Arquivo excede o tamanho maximo de 10 MB",
    "messageKey": "errors.doc.uploadTooLarge"
  }
}
```

**Error Response** (422 — invalid file type):

```json
{
  "success": false,
  "error": {
    "code": "DOC_INVALID_FILE_TYPE",
    "message": "Tipo de arquivo nao permitido. Use PDF, PNG ou JPG",
    "messageKey": "errors.doc.invalidFileType"
  }
}
```

---

## Error Codes

| Code | HTTP Status | messageKey | Description |
|------|-------------|-----------|-------------|
| `DOC_NOT_FOUND` | 404 | `errors.doc.notFound` | Document does not exist or user has no access |
| `DOC_TEMPLATE_NOT_FOUND` | 404 | `errors.doc.templateNotFound` | Document template does not exist |
| `DOC_GENERATION_FAILED` | 422 | `errors.doc.generationFailed` | PDF generation failed (Puppeteer error, timeout) |
| `DOC_UPLOAD_TOO_LARGE` | 422 | `errors.doc.uploadTooLarge` | Uploaded file exceeds 10 MB limit |
| `DOC_INVALID_FILE_TYPE` | 422 | `errors.doc.invalidFileType` | File type not PDF, PNG, or JPG |

---

## Business Rules

### BR-1: Template Schema Validation
- Form data MUST match template schema
- Required fields MUST be filled
- Field types MUST be correct (date as date, number as number)

### BR-2: PDF Generation
- PDF generated via Puppeteer from HTML preview
- PDF stored in S3 with encryption
- Generate unique document_hash (SHA-256) for verification

### BR-3: Document Versioning
- Templates have version numbers (1.0.0, 1.1.0)
- Documents store template_id + version used
- Old documents unaffected by template updates

### BR-4: Brazilian Legal Requirements
- Documents MUST include: company CNPJ, date, location
- Meeting minutes MUST include quorum information
- Share certificates MUST include share class details

---

## User Flows

### Flow 1: Generate Shareholder Agreement

```
1. Admin clicks "Documents" -> "Generate New Document"
2. System displays template list
3. Admin selects "Shareholder Agreement"
4. System loads template schema
5. System displays form with sections:
   - Company Information (pre-filled from company profile)
   - Shareholders (dropdown to select from cap table)
   - Voting Rights (dropdown: pro-rata, majority, unanimous)
   - Transfer Restrictions (toggles for various clauses)
   - Dispute Resolution (select: arbitration, court)
6. Admin fills form, adds 3 shareholders
7. Real-time preview updates on right side
8. Preview shows formatted agreement with filled data
9. Admin reviews preview
10. Admin clicks "Generate PDF"
11. System calls Puppeteer to convert HTML to PDF
12. System uploads PDF to S3
13. System calculates document_hash
14. System creates Document record
15. System shows: "Document generated! Download PDF or send for signatures"
16. Admin can download PDF or proceed to signature workflow

POSTCONDITION: Legal document generated, stored, ready for signatures
```

---

## Edge Cases

### EC-1: Missing Required Field
**Scenario**: User tries to generate without filling required field
**Handling**: Return `VAL_INVALID_INPUT` (400) with `validationErrors` listing each missing field. Frontend highlights missing fields in red, prevents generation.

### EC-2: PDF Generation Timeout
**Scenario**: Puppeteer takes > 30 seconds (complex document)
**Handling**: Show progress indicator, allow up to 60 seconds, retry once if fails. If retry also fails, return `DOC_GENERATION_FAILED` (422). Admin can retry manually.

### EC-3: Template Variable Not Found
**Scenario**: Template references `{{variable}}` not in form_data
**Handling**: Replace with empty string or default value, log warning to Sentry. Document is still generated but admin is warned about missing variables in the response.

---

## Dependencies

- **Companies**: Document generation uses company data
- **Shareholders**: Many documents reference shareholders
- **Transactions**: Some documents linked to specific transactions
- **S3**: Storage for generated PDFs
- **Puppeteer**: HTML to PDF conversion

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [document-signatures.md](./document-signatures.md) | Signature collection and on-chain anchoring after document generation |
| [transactions.md](./transactions.md) | Documents are linked to specific transactions (issuance, transfer) |
| [shareholder-registry.md](./shareholder-registry.md) | Documents reference shareholders for agreements and certificates |
| [company-management.md](./company-management.md) | Documents are scoped to a company; templates tied to company settings |
| [notifications.md](./notifications.md) | Email notifications when documents are ready for review or signing |
| [api-standards.md](../.claude/rules/api-standards.md) | API response envelope, pagination, and URL conventions for document endpoints |
| [error-handling.md](../.claude/rules/error-handling.md) | Error codes: DOC_NOT_FOUND, DOC_TEMPLATE_NOT_FOUND, DOC_GENERATION_FAILED, DOC_UPLOAD_TOO_LARGE, DOC_INVALID_FILE_TYPE |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Audit events: DOCUMENT_GENERATED, DOCUMENT_UPLOADED |
| [i18n.md](../.claude/rules/i18n.md) | Document templates stored in PT-BR and EN; locale selected at generation time |
| [security.md](../.claude/rules/security.md) | S3 encryption, pre-signed URLs with 15-minute expiry, file upload security |

---

## Success Criteria

- Document generation: < 10 seconds for standard documents
- PDF matches preview exactly
- Support all standard Brazilian corporate documents
- Zero data loss during generation
- 100% template variable substitution accuracy
- All API responses use standard envelope format
- Error responses include proper error codes and messageKeys
