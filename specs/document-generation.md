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

### DocumentTemplate Entity

Matches the Prisma schema `DocumentTemplate` model:

```typescript
interface DocumentTemplate {
  id: string;
  companyId: string;                   // FK to Company
  name: string;                        // "Acordo de Acionistas"
  documentType: 'SHAREHOLDER_AGREEMENT' | 'MEETING_MINUTES' | 'SHARE_CERTIFICATE' | 'OPTION_LETTER' | 'INVESTMENT_AGREEMENT';
  content: string;                     // Handlebars HTML template with {{variables}}
  formSchema: FormSchema | null;       // JSON schema for dynamic form generation
  version: number;                     // Integer version (default 1)
  isActive: boolean;                   // Soft-disable templates
  createdBy: string;                   // User ID who created/seeded
  createdAt: Date;
  updatedAt: Date;
}
```

### FormSchema Definition

The `formSchema` JSON defines the dynamic form that the frontend renders for each template:

```typescript
interface FormSchema {
  fields: FormField[];
}

interface FormField {
  name: string;                        // Variable name matching Handlebars template
  type: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'currency' | 'array';
  label: string;                       // Display label (PT-BR)
  labelEn: string;                     // Display label (EN)
  required: boolean;
  placeholder?: string;                // Placeholder text
  helpText?: string;                   // Helper text below field
  options?: { value: string; label: string; labelEn: string }[];  // For 'select' fields
  default?: unknown;                   // Default value
  min?: number;                        // For 'number'/'currency'
  max?: number;                        // For 'number'/'currency'
  maxLength?: number;                  // For 'text'
  // For 'array' type: schema for each item in the array
  itemSchema?: FormField[];            // Sub-fields per array item
}
```

**Example FormSchema** (Shareholder Agreement):

```json
{
  "fields": [
    {
      "name": "companyName",
      "type": "text",
      "label": "Nome da Empresa",
      "labelEn": "Company Name",
      "required": true,
      "placeholder": "Ex: Acme Ltda."
    },
    {
      "name": "shareholders",
      "type": "array",
      "label": "Acionistas",
      "labelEn": "Shareholders",
      "required": true,
      "itemSchema": [
        { "name": "name", "type": "text", "label": "Nome", "labelEn": "Name", "required": true },
        { "name": "cpf", "type": "text", "label": "CPF/CNPJ", "labelEn": "CPF/CNPJ", "required": true },
        { "name": "shares", "type": "number", "label": "Acoes", "labelEn": "Shares", "required": true, "min": 1 }
      ]
    },
    {
      "name": "votingRights",
      "type": "select",
      "label": "Direito de Voto",
      "labelEn": "Voting Rights",
      "required": true,
      "options": [
        { "value": "pro-rata", "label": "Pro-rata", "labelEn": "Pro-rata" },
        { "value": "majority", "label": "Maioria simples", "labelEn": "Simple majority" },
        { "value": "unanimous", "label": "Unanimidade", "labelEn": "Unanimous" }
      ]
    },
    {
      "name": "effectiveDate",
      "type": "date",
      "label": "Data de Vigencia",
      "labelEn": "Effective Date",
      "required": true
    },
    {
      "name": "transferRestrictions",
      "type": "boolean",
      "label": "Restricoes de Transferencia",
      "labelEn": "Transfer Restrictions",
      "required": false,
      "default": true
    }
  ]
}
```

### Document Entity

Matches the Prisma schema `Document` model:

```typescript
interface Document {
  id: string;
  companyId: string;                   // FK to Company
  templateId: string | null;           // FK to DocumentTemplate (null for uploaded docs)
  title: string;
  status: 'DRAFT' | 'GENERATED' | 'PENDING_SIGNATURES' | 'PARTIALLY_SIGNED' | 'FULLY_SIGNED';
  formData: object | null;            // JSON matching template formSchema
  s3Key: string | null;               // S3 object key for generated PDF
  contentHash: string | null;          // SHA-256 hash for verification and signatures
  blockchainTxHash: string | null;     // Set after all signatures → on-chain anchoring
  locale: string;                      // "pt-BR" (default) or "en"
  generatedAt: Date | null;            // When PDF was generated
  anchoredAt: Date | null;             // When hash was anchored on-chain
  createdBy: string;                   // User ID
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Template Seeding Strategy

Templates are pre-seeded per company during company onboarding. There is no template CRUD UI in the MVP.

### Seeding Flow

1. When a company transitions to `ACTIVE` status (after CNPJ validation + contract deployment), a Bull job seeds 5 default templates.
2. Templates are stored in the `document_templates` table with the company's `companyId`.
3. Template content is loaded from static files: `backend/src/templates/documents/{documentType}/{locale}.hbs`.

### Pre-Seeded Templates (MVP)

| documentType | Name (PT-BR) | Name (EN) |
|-------------|-------------|-----------|
| `SHAREHOLDER_AGREEMENT` | Acordo de Acionistas | Shareholder Agreement |
| `MEETING_MINUTES` | Ata de Assembleia | Meeting Minutes |
| `SHARE_CERTIFICATE` | Certificado de Acoes | Share Certificate |
| `OPTION_LETTER` | Carta de Outorga de Opcoes | Option Grant Letter |
| `INVESTMENT_AGREEMENT` | Acordo de Investimento | Investment Agreement |

### Template Content Format

Templates use **Handlebars** syntax for variable interpolation:

```handlebars
<h1>ACORDO DE ACIONISTAS</h1>
<p>
  Os abaixo-assinados, na qualidade de acionistas da empresa
  <strong>{{companyName}}</strong>, CNPJ {{companyCnpj}},
  neste ato representada, celebram o presente Acordo de Acionistas:
</p>

<h2>ACIONISTAS</h2>
{{#each shareholders}}
<p>{{this.name}}, inscrito(a) no CPF/CNPJ sob o nº {{this.cpf}},
   titular de {{formatNumber this.shares}} ações.</p>
{{/each}}

{{#if transferRestrictions}}
<h2>RESTRICOES DE TRANSFERENCIA</h2>
<p>As partes concordam que nenhuma transferência de ações...</p>
{{/if}}
```

---

## Client-Side Preview Architecture

The document preview is rendered **client-side** using Handlebars.js for instant feedback as the user fills the form. The final PDF is generated **server-side** using Puppeteer.

### Preview Flow

```
User fills form field
  │
  ├─ [Client] React Hook Form updates formData state
  ├─ [Client] Handlebars.compile(template.content)(formData)
  ├─ [Client] Rendered HTML displayed in preview panel
  └─ (No API call — instant preview)

User clicks "Gerar PDF"
  │
  ├─ [Frontend] POST /api/v1/companies/:companyId/documents
  ├─ [Backend] Validates formData against formSchema
  ├─ [Backend] Compiles template with Handlebars
  ├─ [Backend] Renders HTML → PDF via Puppeteer
  ├─ [Backend] Uploads PDF to S3
  ├─ [Backend] Computes SHA-256 contentHash
  ├─ [Backend] Creates Document record (status: GENERATED)
  └─ [Backend] Returns document with download URL
```

### Why Client-Side Preview

- **Instant feedback**: No network latency. Preview updates as user types.
- **Template exposure**: Template content is already fetched for the form schema. Exposing it client-side has no security downside — templates are company-owned data, not secrets.
- **Consistent rendering**: Both client preview and server PDF use the same Handlebars engine with the same helpers.

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

Returns template details including the `content` (Handlebars HTML) and `formSchema` for rendering the structured form and client-side preview.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "uuid-1",
    "name": "Acordo de Acionistas",
    "documentType": "SHAREHOLDER_AGREEMENT",
    "version": 1,
    "content": "<h1>ACORDO DE ACIONISTAS</h1><p>Os abaixo-assinados...</p>...",
    "formSchema": {
      "fields": [
        {
          "name": "companyName",
          "type": "text",
          "label": "Nome da Empresa",
          "labelEn": "Company Name",
          "required": true
        },
        {
          "name": "shareholders",
          "type": "array",
          "label": "Acionistas",
          "labelEn": "Shareholders",
          "required": true,
          "itemSchema": [
            { "name": "name", "type": "text", "label": "Nome", "labelEn": "Name", "required": true },
            { "name": "shares", "type": "number", "label": "Acoes", "labelEn": "Shares", "required": true }
          ]
        },
        {
          "name": "votingRights",
          "type": "select",
          "label": "Direito de Voto",
          "labelEn": "Voting Rights",
          "required": true,
          "options": [
            { "value": "pro-rata", "label": "Pro-rata", "labelEn": "Pro-rata" },
            { "value": "majority", "label": "Maioria simples", "labelEn": "Simple majority" }
          ]
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

### Save Document Draft

```
POST /api/v1/companies/:companyId/documents/draft
```

Saves a document as DRAFT without generating the PDF. Allows users to save progress and return later.

**Request Body**:

```json
{
  "templateId": "uuid",
  "title": "Acordo de Acionistas - Series A",
  "locale": "pt-BR",
  "formData": {
    "companyName": "Startup XYZ Ltda.",
    "shareholders": [
      { "name": "Joao Founder", "shares": 600000 }
    ]
  }
}
```

**Response** (201 Created):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Acordo de Acionistas - Series A",
    "templateId": "uuid",
    "status": "DRAFT",
    "locale": "pt-BR",
    "formData": { "companyName": "Startup XYZ Ltda.", "shareholders": [...] },
    "createdAt": "2026-01-20T14:30:00.000Z",
    "createdBy": "user-uuid"
  }
}
```

---

### Update Document Draft

```
PUT /api/v1/companies/:companyId/documents/:documentId
```

Updates the form data and/or title of a DRAFT document. Only DRAFT documents can be updated.

**Request Body**:

```json
{
  "title": "Acordo de Acionistas - Series A (updated)",
  "formData": {
    "companyName": "Startup XYZ Ltda.",
    "shareholders": [
      { "name": "Joao Founder", "shares": 600000 },
      { "name": "Investor ABC", "shares": 150000 }
    ],
    "votingRights": "pro-rata"
  }
}
```

**Response** (200 OK): Same format as save draft.

**Error Response** (422 — document not in DRAFT status):

```json
{
  "success": false,
  "error": {
    "code": "DOC_NOT_DRAFT",
    "message": "Somente documentos em rascunho podem ser editados",
    "messageKey": "errors.doc.notDraft"
  }
}
```

---

### Generate PDF from Draft

```
POST /api/v1/companies/:companyId/documents/:documentId/generate
```

Generates the PDF for a DRAFT document. Transitions status from `DRAFT` to `GENERATED`.

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Acordo de Acionistas - Series A",
    "status": "GENERATED",
    "contentHash": "sha256-hash",
    "generatedAt": "2026-01-20T14:35:00.000Z"
  }
}
```

**Error Response** (422 — missing required fields):

```json
{
  "success": false,
  "error": {
    "code": "DOC_INCOMPLETE_FORM",
    "message": "Campos obrigatorios nao preenchidos",
    "messageKey": "errors.doc.incompleteForm",
    "details": {
      "missingFields": ["votingRights", "effectiveDate"]
    }
  }
}
```

---

### Delete Document

```
DELETE /api/v1/companies/:companyId/documents/:documentId
```

Deletes a DRAFT or GENERATED document. Documents with signatures cannot be deleted.

**Response** (204 No Content)

**Error Response** (422 — document has signatures):

```json
{
  "success": false,
  "error": {
    "code": "DOC_HAS_SIGNATURES",
    "message": "Documentos com assinaturas nao podem ser excluidos",
    "messageKey": "errors.doc.hasSignatures"
  }
}
```

---

## Permission Matrix

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE |
|--------|-------|---------|-------|----------|----------|
| List templates | Yes | Yes | Yes | No | No |
| View template detail | Yes | Yes | Yes | No | No |
| Create document (draft or generate) | Yes | No | Yes | No | No |
| Update draft | Yes | No | Yes | No | No |
| Generate PDF from draft | Yes | No | Yes | No | No |
| List documents | Yes | Yes | Yes | Own only | Own only |
| View document detail | Yes | Yes | Yes | Own only | Own only |
| Download PDF | Yes | Yes | Yes | Own only | Own only |
| Upload document | Yes | No | Yes | No | No |
| Delete document (DRAFT/GENERATED) | Yes | No | No | No | No |

---

## Error Codes

| Code | HTTP Status | messageKey | Description |
|------|-------------|-----------|-------------|
| `DOC_NOT_FOUND` | 404 | `errors.doc.notFound` | Document does not exist or user has no access |
| `DOC_TEMPLATE_NOT_FOUND` | 404 | `errors.doc.templateNotFound` | Document template does not exist |
| `DOC_GENERATION_FAILED` | 422 | `errors.doc.generationFailed` | PDF generation failed (Puppeteer error, timeout) |
| `DOC_UPLOAD_TOO_LARGE` | 422 | `errors.doc.uploadTooLarge` | Uploaded file exceeds 10 MB limit |
| `DOC_INVALID_FILE_TYPE` | 422 | `errors.doc.invalidFileType` | File type not PDF, PNG, or JPG |
| `DOC_NOT_DRAFT` | 422 | `errors.doc.notDraft` | Document is not in DRAFT status (cannot edit) |
| `DOC_INCOMPLETE_FORM` | 422 | `errors.doc.incompleteForm` | Required form fields are missing |
| `DOC_HAS_SIGNATURES` | 422 | `errors.doc.hasSignatures` | Document has signatures and cannot be deleted/modified |
| `DOC_TEMPLATE_INACTIVE` | 422 | `errors.doc.templateInactive` | Template is deactivated |

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

# Frontend Specification

---

## Table of Contents (Frontend)

1. [Frontend Architecture](#frontend-architecture)
2. [Page Routes](#page-routes)
3. [Component Hierarchy](#component-hierarchy)
4. [Component Specifications](#component-specifications-frontend)
5. [Frontend User Flows](#frontend-user-flows)
6. [UI States and Error Handling](#ui-states-and-error-handling)
7. [TanStack Query Integration](#tanstack-query-integration)
8. [i18n Keys](#i18n-keys)
9. [Frontend Success Criteria](#frontend-success-criteria)

---

## Frontend Architecture

### MVP Scope

The document generation frontend consists of:

1. **Documents list page** (`/dashboard/documents`) — Table of all company documents with status badges, search, and filters.
2. **Document creation wizard** (`/dashboard/documents/new`) — Two-step split-pane wizard: select template → fill form + live preview → generate PDF.
3. **Document detail page** (`/dashboard/documents/:id`) — View document details, download PDF, manage signatures.
4. **Document upload modal** — Simple file upload for manually created documents.

### State Management

- Document list: TanStack Query with pagination and filters.
- Document creation wizard: React Hook Form for form state, local state for the current wizard step.
- Template preview: Client-side Handlebars compilation triggered by form data changes (debounced 300ms).
- Generated document status: TanStack Query.

### Client-Side Preview Dependencies

The frontend bundles `handlebars` as a client-side dependency for instant template preview:

```typescript
import Handlebars from 'handlebars';

// Register custom helpers matching the backend
Handlebars.registerHelper('formatNumber', (num: number) =>
  new Intl.NumberFormat('pt-BR').format(num),
);
Handlebars.registerHelper('formatCurrency', (num: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num),
);
Handlebars.registerHelper('formatDate', (date: string) =>
  new Intl.DateTimeFormat('pt-BR').format(new Date(date)),
);
```

---

## Page Routes

| Route | Layout | Auth | Description |
|-------|--------|------|-------------|
| `/dashboard/documents` | Dashboard shell | Yes + ADMIN, FINANCE, or LEGAL | Documents list page |
| `/dashboard/documents/new` | Dashboard shell | Yes + ADMIN or LEGAL | Document creation wizard |
| `/dashboard/documents/:id` | Dashboard shell | Yes + ADMIN, FINANCE, LEGAL (or own docs for INVESTOR/EMPLOYEE) | Document detail page |

---

## Component Hierarchy

```
app/(dashboard)/documents/page.tsx ─→ DocumentsListPage
  ├─ DocumentsPageHeader (title + "Novo Documento" button + "Upload" button)
  ├─ DocumentsFilters (status filter, type filter, search)
  └─ DocumentsTable
       ├─ DocumentStatusBadge (per row)
       └─ DocumentActionsMenu (per row: view, download, delete)

app/(dashboard)/documents/new/page.tsx ─→ DocumentCreationWizard
  ├─ Step 1: TemplateSelectionStep
  │    └─ TemplateCard (per template type)
  └─ Step 2: DocumentFormStep (split pane)
       ├─ DynamicFormPanel (left, 50%)
       │    ├─ DynamicFormField (per field from formSchema)
       │    ├─ ArrayFormField (for 'array' type with add/remove)
       │    └─ FormActions (Salvar Rascunho | Gerar PDF)
       └─ DocumentPreviewPanel (right, 50%)
            └─ (Handlebars-rendered HTML preview)

app/(dashboard)/documents/[id]/page.tsx ─→ DocumentDetailPage
  ├─ DocumentHeader (title, status badge, actions)
  ├─ DocumentPreviewEmbed (iframe with generated HTML or PDF)
  ├─ DocumentMetadata (creation date, hash, template name)
  └─ DocumentSignaturesSection (→ see document-signatures.md)

components/documents/document-upload-modal.tsx ─→ DocumentUploadModal
```

### Component Registry

| Component | File | Description |
|-----------|------|-------------|
| `DocumentsListPage` | `app/(dashboard)/documents/page.tsx` | Documents list with table |
| `DocumentsTable` | `components/documents/documents-table.tsx` | Paginated table of documents |
| `DocumentStatusBadge` | `components/documents/document-status-badge.tsx` | Status badge for document |
| `DocumentCreationWizard` | `app/(dashboard)/documents/new/page.tsx` | Template selection + form wizard |
| `TemplateSelectionStep` | `components/documents/template-selection-step.tsx` | Step 1: select template |
| `TemplateCard` | `components/documents/template-card.tsx` | Card for each template type |
| `DocumentFormStep` | `components/documents/document-form-step.tsx` | Step 2: split pane form + preview |
| `DynamicFormPanel` | `components/documents/dynamic-form-panel.tsx` | Dynamic form from formSchema |
| `DynamicFormField` | `components/documents/dynamic-form-field.tsx` | Individual form field renderer |
| `ArrayFormField` | `components/documents/array-form-field.tsx` | Array field with add/remove items |
| `DocumentPreviewPanel` | `components/documents/document-preview-panel.tsx` | Client-side Handlebars preview |
| `DocumentDetailPage` | `app/(dashboard)/documents/[id]/page.tsx` | Document detail view |
| `DocumentUploadModal` | `components/documents/document-upload-modal.tsx` | File upload dialog |

---

## Component Specifications (Frontend)

### 1. TemplateSelectionStep

**File**: `components/documents/template-selection-step.tsx`

**Props**:
```typescript
interface TemplateSelectionStepProps {
  companyId: string;
  onSelect: (templateId: string) => void;
}
```

**Visual Structure**:
```
+--------------------------------------------------+
|                                                  |
|  Novo Documento                                  |  ← h1, navy-900
|  Selecione o modelo de documento                 |  ← body-sm, gray-500
|                                                  |
|  +--------------------+  +--------------------+  |
|  |  📄                |  |  📄                |  |  ← icon, 48px, gray-400
|  |  Acordo de         |  |  Ata de            |  |  ← h4, gray-800
|  |  Acionistas        |  |  Assembleia        |  |
|  |                    |  |                    |  |
|  |  Acordo entre      |  |  Atas de reuniao   |  |  ← body-sm, gray-500
|  |  acionistas da     |  |  de acionistas     |  |
|  |  empresa           |  |                    |  |
|  +--------------------+  +--------------------+  |
|                                                  |
|  +--------------------+  +--------------------+  |
|  |  📄                |  |  📄                |  |
|  |  Certificado de    |  |  Carta de Outorga  |  |
|  |  Acoes             |  |  de Opcoes         |  |
|  +--------------------+  +--------------------+  |
|                                                  |
|  +--------------------+                          |
|  |  📄                |                          |
|  |  Acordo de         |                          |
|  |  Investimento      |                          |
|  +--------------------+                          |
|                                                  |
+--------------------------------------------------+
```

**TemplateCard**: White bg, `radius-lg`, `1px solid gray-200`, `padding 24px`, hover `shadow-md` + `blue-50` border, click selects and advances to Step 2.

**Grid**: 2 columns on desktop, 1 on mobile, `gap-6`.

---

### 2. DocumentFormStep (Split Pane)

**File**: `components/documents/document-form-step.tsx`

**Props**:
```typescript
interface DocumentFormStepProps {
  companyId: string;
  templateId: string;
  existingDocumentId?: string; // If editing a DRAFT
}
```

**Visual Structure**:
```
+---------------------------+---------------------------+
|  DynamicFormPanel (50%)   |  DocumentPreviewPanel     |
|                           |  (50%)                    |
|  Titulo do Documento *    |                           |
|  +---------------------+ |  +---------------------+  |
|  | Acordo de Acionistas| |  | ACORDO DE           |  |
|  +---------------------+ |  | ACIONISTAS           |  |
|                           |  |                     |  |
|  Nome da Empresa *        |  | Os abaixo-assinados |  |
|  +---------------------+ |  | na qualidade de     |  |
|  | Startup XYZ Ltda.   | |  | acionistas da       |  |
|  +---------------------+ |  | empresa Startup XYZ |  |
|                           |  | Ltda., CNPJ...      |  |
|  Acionistas *             |  |                     |  |
|  +---------------------+ |  | ACIONISTAS          |  |
|  | Joao Founder  600K  | |  | Joao Founder,       |  |
|  | [Remover]           | |  | 600.000 acoes       |  |
|  +---------------------+ |  |                     |  |
|  [+ Adicionar Acionista]  |  | Investor ABC,       |  |
|                           |  | 150.000 acoes       |  |
|  Direito de Voto *        |  |                     |  |
|  +---------------------+ |  |                     |  |
|  | Pro-rata          [v]| |  |                     |  |
|  +---------------------+ |  |                     |  |
|                           |  |                     |  |
|  [Salvar Rascunho]        |  |                     |  |
|  [Gerar PDF]              |  |                     |  |
+---------------------------+---------------------------+
```

**Layout**: CSS Grid `grid-cols-2` with `gap-0`. Left pane has `padding 24px` + `border-r gray-200`. Right pane has `padding 24px` + `gray-50` bg + scrollable.

**DynamicFormPanel** behavior:
1. Fetches template detail: `GET /api/v1/companies/:companyId/document-templates/:templateId`.
2. Dynamically renders form fields from `formSchema.fields`.
3. For `array` fields: renders sub-form with add/remove buttons.
4. React Hook Form manages all field state.
5. "Salvar Rascunho": saves to `POST /draft` or `PUT /:id`. Secondary button.
6. "Gerar PDF": validates all required fields, then calls `POST /documents` (new) or `POST /:id/generate` (from draft). Primary button.

**DocumentPreviewPanel** behavior:
1. On template load: compiles Handlebars template from `content`.
2. On form change (debounced 300ms): re-renders preview with current `formData`.
3. Preview is read-only HTML rendered in a styled container mimicking A4 paper.
4. Shows placeholder text `{{variableName}}` for unfilled fields (gray-400 color).

**DynamicFormField** — renders the correct input based on field type:

| FormField type | Rendered Component |
|---------------|-------------------|
| `text` | Standard text input |
| `number` | Number input with Brazilian formatting |
| `currency` | Currency input with R$ prefix, Brazilian formatting |
| `date` | Date picker (dd/MM/yyyy) |
| `select` | shadcn/ui Select with options from field.options |
| `boolean` | shadcn/ui Switch |
| `array` | ArrayFormField with repeatable sub-form |

---

### 3. DocumentsTable

**File**: `components/documents/documents-table.tsx`

**Visual Structure** follows the design-system table pattern:

| Column | Content | Alignment | Sortable |
|--------|---------|-----------|----------|
| Titulo | Document title (link) | Left | Yes |
| Modelo | Template name | Left | No |
| Status | DocumentStatusBadge | Left | Yes |
| Criado em | createdAt (dd/MM/yyyy) | Left | Yes |
| Acoes | Dropdown menu (view, download, delete) | Right | No |

**DocumentStatusBadge variants**:

| Status | Background | Text |
|--------|-----------|------|
| `DRAFT` | `gray-100` | `gray-600` |
| `GENERATED` | `blue-50` | `blue-600` |
| `PENDING_SIGNATURES` | `cream-100` | `cream-700` |
| `PARTIALLY_SIGNED` | `cream-100` | `cream-700` |
| `FULLY_SIGNED` | `green-100` | `green-700` |

---

### 4. DocumentUploadModal

**File**: `components/documents/document-upload-modal.tsx`

**Props**:
```typescript
interface DocumentUploadModalProps {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
}
```

**Visual Structure**:
```
+--------------------------------------------------+
|  Upload de Documento                     [X]     |
+--------------------------------------------------+
|                                                  |
|  Titulo *                                        |
|  +--------------------------------------------+ |
|  | Ex: Contrato Assinado                      | |
|  +--------------------------------------------+ |
|                                                  |
|  +--------------------------------------------+ |
|  |                                            | |
|  |     📄 Arraste um arquivo aqui ou          | |  ← Dropzone
|  |        clique para selecionar              | |
|  |                                            | |
|  |     PDF, PNG ou JPG (max 10 MB)            | |
|  |                                            | |
|  +--------------------------------------------+ |
|                                                  |
+--------------------------------------------------+
|  [Cancelar]                       [Fazer Upload]  |
+--------------------------------------------------+
```

Accepts drag-and-drop or click-to-select. Shows file name and size after selection. "Fazer Upload" calls `POST /documents/upload` with multipart/form-data.

---

## Frontend User Flows

### Flow: Create Document from Template

```
User clicks "Novo Documento" on Documents page
  │
  ├─ Step 1: TemplateSelectionStep
  │     │
  │     └─ User clicks a template card ─→ Advance to Step 2
  │
  ├─ Step 2: DocumentFormStep (split pane)
  │     │
  │     ├─ [User fills form fields] ─→ Preview updates in real-time (client-side)
  │     │
  │     ├─ [User clicks "Salvar Rascunho"] ─→ POST /draft
  │     │     │
  │     │     ├─ [201 success] ─→ Toast "Rascunho salvo", URL updates to /documents/:id/edit
  │     │     └─ [error] ─→ Error toast
  │     │
  │     └─ [User clicks "Gerar PDF"] ─→ Client-side validation
  │           │
  │           ├─ [valid] ─→ POST /documents (or POST /:id/generate for draft)
  │           │     │
  │           │     ├─ [201/200 success] ─→ Redirect to /documents/:id with success toast
  │           │     ├─ [422 incomplete form] ─→ Highlight missing fields
  │           │     └─ [422 generation failed] ─→ Error toast, allow retry
  │           │
  │           └─ [invalid] ─→ Show field-level errors
  │
  └─ Document Detail Page shows generated document with download button
```

### Flow: Upload Manual Document

```
User clicks "Upload" on Documents page
  │
  ├─ DocumentUploadModal opens
  │     │
  │     ├─ User enters title and selects/drops file
  │     │
  │     └─ User clicks "Fazer Upload"
  │           │
  │           ├─ [201 success] ─→ Modal closes, table refreshes, success toast
  │           ├─ [422 too large] ─→ Inline error "Arquivo excede 10 MB"
  │           └─ [422 invalid type] ─→ Inline error "Tipo de arquivo nao permitido"
  │
  └─ New document appears in table with GENERATED status
```

---

## UI States and Error Handling

### DocumentCreationWizard States

| State | Visual |
|-------|--------|
| Loading templates | Skeleton grid of 5 template cards |
| No templates | Empty state: "Nenhum modelo disponivel" |
| Loading template detail | Skeleton split pane |
| Form filling | Normal form + live preview |
| Saving draft | "Salvar Rascunho" shows spinner, form disabled |
| Generating PDF | "Gerar PDF" shows spinner + progress text "Gerando documento..." |
| Generation timeout | After 60s: error toast + retry button |

### DocumentsTable States

| State | Visual |
|-------|--------|
| Loading | 5 skeleton table rows |
| Empty (no documents) | Centered: document icon + "Nenhum documento" + "Novo Documento" button |
| Empty (no results) | "Nenhum documento encontrado" + "Limpar filtros" link |
| Error | Error card with retry button |

---

## TanStack Query Integration

### Query Key Factory

```typescript
export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (companyId: string, filters?: Record<string, unknown>) =>
    [...documentKeys.lists(), companyId, filters] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (companyId: string, documentId: string) =>
    [...documentKeys.details(), companyId, documentId] as const,
};

export const templateKeys = {
  all: ['documentTemplates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (companyId: string) =>
    [...templateKeys.lists(), companyId] as const,
  detail: (companyId: string, templateId: string) =>
    [...templateKeys.all, 'detail', companyId, templateId] as const,
};
```

### Hooks

```typescript
export function useDocumentTemplates(companyId: string) {
  return useQuery({
    queryKey: templateKeys.list(companyId),
    queryFn: () =>
      api.getList(`/api/v1/companies/${companyId}/document-templates`),
  });
}

export function useDocumentTemplate(companyId: string, templateId: string) {
  return useQuery({
    queryKey: templateKeys.detail(companyId, templateId),
    queryFn: () =>
      api.get(`/api/v1/companies/${companyId}/document-templates/${templateId}`),
    enabled: !!templateId,
  });
}

export function useDocuments(
  companyId: string,
  params?: { page?: number; limit?: number; status?: string; search?: string },
) {
  return useQuery({
    queryKey: documentKeys.list(companyId, params),
    queryFn: () => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.status) query.set('status', params.status);
      if (params?.search) query.set('search', params.search);
      return api.getList(`/api/v1/companies/${companyId}/documents?${query}`);
    },
  });
}

export function useDocument(companyId: string, documentId: string) {
  return useQuery({
    queryKey: documentKeys.detail(companyId, documentId),
    queryFn: () =>
      api.get(`/api/v1/companies/${companyId}/documents/${documentId}`),
  });
}

export function useCreateDocument(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocumentDto) =>
      api.post(`/api/v1/companies/${companyId}/documents`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function useSaveDraft(companyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveDraftDto) =>
      api.post(`/api/v1/companies/${companyId}/documents/draft`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}

export function useGenerateFromDraft(companyId: string, documentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post(
        `/api/v1/companies/${companyId}/documents/${documentId}/generate`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail(companyId, documentId),
      });
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() });
    },
  });
}
```

---

## i18n Keys

| Key | PT-BR | EN |
|-----|-------|----|
| `documents.title` | `Documentos` | `Documents` |
| `documents.description` | `Gerencie documentos da empresa` | `Manage company documents` |
| `documents.newDocument` | `Novo Documento` | `New Document` |
| `documents.upload` | `Upload` | `Upload` |
| `documents.table.title` | `Titulo` | `Title` |
| `documents.table.template` | `Modelo` | `Template` |
| `documents.table.status` | `Status` | `Status` |
| `documents.table.createdAt` | `Criado em` | `Created at` |
| `documents.table.actions` | `Acoes` | `Actions` |
| `documents.table.empty` | `Nenhum documento encontrado` | `No documents found` |
| `documents.status.draft` | `Rascunho` | `Draft` |
| `documents.status.generated` | `Gerado` | `Generated` |
| `documents.status.pendingSignatures` | `Aguardando Assinaturas` | `Pending Signatures` |
| `documents.status.partiallySigned` | `Parcialmente Assinado` | `Partially Signed` |
| `documents.status.fullySigned` | `Totalmente Assinado` | `Fully Signed` |
| `documents.wizard.selectTemplate` | `Selecione o modelo de documento` | `Select document template` |
| `documents.wizard.fillForm` | `Preencha os campos do documento` | `Fill in the document fields` |
| `documents.wizard.preview` | `Pre-visualizacao` | `Preview` |
| `documents.wizard.saveDraft` | `Salvar Rascunho` | `Save Draft` |
| `documents.wizard.generatePdf` | `Gerar PDF` | `Generate PDF` |
| `documents.wizard.generating` | `Gerando documento...` | `Generating document...` |
| `documents.wizard.draftSaved` | `Rascunho salvo` | `Draft saved` |
| `documents.wizard.generated` | `Documento gerado com sucesso` | `Document generated successfully` |
| `documents.detail.download` | `Baixar PDF` | `Download PDF` |
| `documents.detail.delete` | `Excluir Documento` | `Delete Document` |
| `documents.detail.hash` | `Hash do Documento` | `Document Hash` |
| `documents.detail.generatedAt` | `Gerado em` | `Generated at` |
| `documents.upload.title` | `Upload de Documento` | `Upload Document` |
| `documents.upload.dropzone` | `Arraste um arquivo aqui ou clique para selecionar` | `Drag a file here or click to select` |
| `documents.upload.formats` | `PDF, PNG ou JPG (max 10 MB)` | `PDF, PNG or JPG (max 10 MB)` |
| `documents.upload.button` | `Fazer Upload` | `Upload` |
| `documents.upload.success` | `Documento enviado com sucesso` | `Document uploaded successfully` |
| `documents.template.shareholderAgreement` | `Acordo de Acionistas` | `Shareholder Agreement` |
| `documents.template.meetingMinutes` | `Ata de Assembleia` | `Meeting Minutes` |
| `documents.template.shareCertificate` | `Certificado de Acoes` | `Share Certificate` |
| `documents.template.optionLetter` | `Carta de Outorga de Opcoes` | `Option Grant Letter` |
| `documents.template.investmentAgreement` | `Acordo de Investimento` | `Investment Agreement` |
| `documents.addItem` | `Adicionar {item}` | `Add {item}` |
| `documents.removeItem` | `Remover` | `Remove` |

---

## Frontend Success Criteria

- [ ] Template selection step shows all active templates as cards
- [ ] Dynamic form correctly renders all field types (text, number, date, select, boolean, array)
- [ ] Array fields support add/remove with proper validation
- [ ] Client-side Handlebars preview updates in real-time as user types (debounced 300ms)
- [ ] Preview shows placeholder text for unfilled required fields
- [ ] "Salvar Rascunho" creates DRAFT document without generating PDF
- [ ] "Gerar PDF" validates all required fields before submission
- [ ] PDF generation shows loading state with progress text
- [ ] Documents table supports pagination, status filtering, and search
- [ ] DocumentStatusBadge renders correct variant for all 5 statuses
- [ ] Document upload modal accepts drag-and-drop and click-to-select
- [ ] Upload validates file type and size client-side before submission
- [ ] Download button generates pre-signed URL for PDF download
- [ ] All user-facing strings use i18n keys (no hardcoded text)
- [ ] Number formatting uses Brazilian format (1.234,56)
- [ ] Date formatting uses Brazilian format (dd/MM/yyyy)
- [ ] Components follow design-system.md conventions
- [ ] Split-pane layout is responsive (stacks vertically on mobile)

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
