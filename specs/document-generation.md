# Document Generation Specification

**Topic of Concern**: Template-based legal document creation

**One-Sentence Description**: The system generates legal documents from database-stored templates by filling user-selected form fields, with real-time preview and PDF export.

---

## Overview

VelaFund generates Brazilian corporate documents (shareholder agreements, meeting minutes, share certificates, etc.) from templates stored in the database. Users fill structured forms that map to template variables, see real-time previews, and generate final PDFs. Templates are editable via admin UI without code deployment.

**Document Types**:
- Share/quota certificates
- Atas de assembleia (shareholder meeting minutes)
- Atas de reunião de diretoria (board minutes)
- Alterações contratuais (contract amendments)
- Acordos de acionistas (shareholder agreements)
- Option grant letters
- Investment agreements (Mútuo conversível, Investimento-Anjo)

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

### GET /api/v1/documents/templates
List available document templates

### GET /api/v1/documents/templates/:templateId
Get template details and form schema

### POST /api/v1/documents/generate
Generate document from template

**Request**:
```json
{
  "template_id": "uuid",
  "title": "Shareholder Agreement - Series A",
  "form_data": {
    "company_name": "Startup XYZ Ltda.",
    "shareholders": [
      {"name": "João Founder", "cpf": "012.345.678-01", "shares": 600000},
      {"name": "Investor ABC", "cpf": "98.765.432/0001-00", "shares": 150000}
    ],
    "effective_date": "2024-01-20",
    "voting_rights": "pro-rata",
    "transfer_restrictions": true
  }
}
```

**Response** (201 Created):
```json
{
  "document_id": "uuid",
  "title": "Shareholder Agreement - Series A",
  "preview_url": "https://api.velafund.com/documents/uuid/preview",
  "status": "GENERATED"
}
```

### GET /api/v1/documents/:documentId/preview
Get HTML preview

### GET /api/v1/documents/:documentId/download
Download PDF

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
1. Admin clicks "Documents" → "Generate New Document"
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
**Handling**: Highlight missing field in red, show error message, prevent generation

### EC-2: PDF Generation Timeout
**Scenario**: Puppeteer takes > 30 seconds (complex document)
**Handling**: Show progress indicator, allow up to 60 seconds, retry once if fails

### EC-3: Template Variable Not Found
**Scenario**: Template references {{variable}} not in form_data
**Handling**: Replace with empty string or default value, log warning

---

## Dependencies

- **Companies**: Document generation uses company data
- **Shareholders**: Many documents reference shareholders
- **Transactions**: Some documents linked to specific transactions
- **S3**: Storage for generated PDFs
- **Puppeteer**: HTML to PDF conversion

---

## Success Criteria

- Document generation: < 10 seconds for standard documents
- PDF matches preview exactly
- Support all standard Brazilian corporate documents
- Zero data loss during generation
- 100% template variable substitution accuracy
