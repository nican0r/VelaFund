# Document Generation -- User Flows

**Feature**: Generate legal documents (shareholder agreements, meeting minutes, share certificates, option letters, investment agreements) from Handlebars templates with form data interpolation, PDF rendering via Puppeteer, and S3 storage
**Actors**: ADMIN (full CRUD + generate + delete), LEGAL (create + generate + update), FINANCE (read-only), System (Puppeteer PDF, S3 upload)
**Preconditions**: User is authenticated. User has a role in the company (ADMIN, LEGAL, or FINANCE). Company has document templates seeded.
**Related Flows**:
- **Depends on**: [Authentication](./authentication.md) -- user must be logged in
- **Depends on**: [Company Management](./company-management.md) -- company must exist
- **Feeds into**: [Document Signatures](./document-signatures.md) -- generated documents can be sent for signing
- **Triggers**: Audit log events (DOCUMENT_GENERATED, DOCUMENT_DRAFT_CREATED, DOCUMENT_UPDATED, DOCUMENT_UPLOADED, DOCUMENT_DELETED)

---

## Flow Map

```
User navigates to Documents page
  |
  +-- List Templates: GET /api/v1/companies/:companyId/document-templates
  |     |
  |     +-- [ADMIN/FINANCE/LEGAL] --> paginated template list (type filter, search, sort)
  |     +-- [INVESTOR/EMPLOYEE] --> 404 (role guard)
  |
  +-- View Template Detail: GET /api/v1/companies/:companyId/document-templates/:templateId
  |     |
  |     +-- [template exists] --> template with formSchema
  |     +-- [template not found] --> 404
  |
  +-- Create Draft: POST /api/v1/companies/:companyId/documents/draft
  |     |
  |     +-- [ADMIN/LEGAL + valid template + active] --> Document created (DRAFT)
  |     +-- [template not found] --> 404
  |     +-- [template inactive] --> 422 DOC_TEMPLATE_INACTIVE
  |     +-- [FINANCE/INVESTOR/EMPLOYEE] --> 404 (role guard)
  |
  +-- Update Draft: PUT /api/v1/companies/:companyId/documents/:documentId
  |     |
  |     +-- [ADMIN/LEGAL + document is DRAFT] --> Document updated
  |     +-- [document not found] --> 404
  |     +-- [document not DRAFT] --> 422 DOC_NOT_DRAFT
  |
  +-- Generate from Draft: POST /api/v1/companies/:companyId/documents/:documentId/generate
  |     |
  |     +-- [ADMIN/LEGAL + DRAFT + form complete] --> PDF generated, status --> GENERATED
  |     |     |
  |     |     +-- [Handlebars compile] --> HTML with interpolated data
  |     |     +-- [Puppeteer render] --> PDF buffer
  |     |     +-- [SHA-256 hash] --> contentHash computed
  |     |     +-- [S3 upload] --> s3Key stored (graceful skip if S3 unavailable)
  |     |
  |     +-- [not DRAFT] --> 422 DOC_NOT_DRAFT
  |     +-- [missing required fields] --> 422 DOC_INCOMPLETE_FORM { missingFields }
  |     +-- [Puppeteer crash] --> 422 DOC_GENERATION_FAILED
  |
  +-- Generate Directly: POST /api/v1/companies/:companyId/documents
  |     |
  |     +-- [ADMIN/LEGAL + valid template + form complete] --> Document created as GENERATED
  |     +-- [template not found] --> 404
  |     +-- [template inactive] --> 422 DOC_TEMPLATE_INACTIVE
  |     +-- [missing required fields] --> 422 DOC_INCOMPLETE_FORM
  |     +-- [generation error] --> 422 DOC_GENERATION_FAILED
  |
  +-- Preview: GET /api/v1/companies/:companyId/documents/:documentId/preview
  |     |
  |     +-- [ADMIN/FINANCE/LEGAL + document exists] --> HTML response (Content-Type: text/html)
  |     +-- [document not found] --> 404
  |
  +-- Download: GET /api/v1/companies/:companyId/documents/:documentId/download
  |     |
  |     +-- [ADMIN/FINANCE/LEGAL + document has s3Key] --> { downloadUrl, expiresAt, filename }
  |     +-- [document not found] --> 404
  |     +-- [no s3Key (draft or failed)] --> 422 DOC_NOT_GENERATED
  |
  +-- Upload File: POST /api/v1/companies/:companyId/documents/upload
  |     |
  |     +-- [ADMIN/LEGAL + valid file type (PDF/JPEG/PNG)] --> Document created as GENERATED
  |     +-- [invalid magic bytes] --> 422 DOC_INVALID_FILE_TYPE
  |     +-- [file > 10MB] --> 422 (MaxFileSizeValidator)
  |
  +-- Delete: DELETE /api/v1/companies/:companyId/documents/:documentId
        |
        +-- [ADMIN + DRAFT or GENERATED + no signers] --> 204 No Content
        +-- [document not found] --> 404
        +-- [has signers] --> 422 DOC_HAS_SIGNATURES
        +-- [status is PENDING_SIGNATURE/SIGNED/ANCHORED] --> 422 DOC_HAS_SIGNATURES
        +-- [LEGAL/FINANCE/INVESTOR/EMPLOYEE] --> 404 (role guard)
```

---

## Flows

### Happy Path: Generate Document from Template

```
PRECONDITION: Company exists. User is ADMIN or LEGAL. Templates have been seeded.
ACTOR: ADMIN or LEGAL member
TRIGGER: User clicks "Generate Document" from documents page

1. [UI] User navigates to /companies/:companyId/documents
2. [Frontend] Sends GET /api/v1/companies/:companyId/document-templates
3. [Backend] Validates auth + role (ADMIN/FINANCE/LEGAL)
4. [Backend] Returns paginated template list
5. [UI] User selects a template (e.g., "Acordo de Acionistas")
6. [Frontend] Sends GET /api/v1/companies/:companyId/document-templates/:templateId
7. [Backend] Returns template with formSchema
8. [UI] Renders dynamic form based on formSchema fields
9. [UI] User fills in all required fields (companyName, shareholders, votingRights, effectiveDate)
10. [UI] User clicks "Generate"
11. [Frontend] Validates required fields client-side
    → IF missing required fields: show field-level errors, STOP
12. [Frontend] Sends POST /api/v1/companies/:companyId/documents { templateId, title, formData }
13. [Backend] Validates authentication
    → IF unauthenticated: return 401
14. [Backend] Validates authorization (ADMIN or LEGAL)
    → IF unauthorized: return 404
15. [Backend] Finds template by ID and companyId
    → IF not found: return 404 DOCUMENTTEMPLATE_NOT_FOUND
16. [Backend] Checks template is active
    → IF inactive: return 422 DOC_TEMPLATE_INACTIVE
17. [Backend] Validates form data against formSchema
    → IF missing required fields: return 422 DOC_INCOMPLETE_FORM { missingFields }
18. [Backend] Compiles Handlebars template with form data (formatNumber, formatCurrency, formatDate helpers)
19. [Backend] Launches Puppeteer headless Chrome
20. [Backend] Renders HTML to PDF (A4, 2cm margins, page numbers)
21. [Backend] Computes SHA-256 content hash of PDF buffer
22. [Backend] Uploads PDF to S3 (documents/{companyId}/{timestamp}-{hash}.pdf)
    → IF S3 unavailable: logs warning, continues without upload
23. [Backend] Creates Document record (status: GENERATED, s3Key, contentHash, generatedAt)
24. [Backend] Returns 201 with document data
25. [UI] Shows success toast: "Documento gerado com sucesso"
26. [UI] Navigates to document detail page

POSTCONDITION: Document exists with status GENERATED, PDF stored in S3
SIDE EFFECTS: Audit log DOCUMENT_GENERATED
```

### Alternative Path: Save as Draft, Then Generate

```
PRECONDITION: Same as happy path
ACTOR: ADMIN or LEGAL member
TRIGGER: User wants to save progress before generating

1. [UI] User fills in partial form data
2. [UI] User clicks "Save Draft"
3. [Frontend] Sends POST /api/v1/companies/:companyId/documents/draft { templateId, title, formData }
4. [Backend] Validates template exists and is active
5. [Backend] Creates Document record (status: DRAFT)
6. [Backend] Returns 201 with draft data
7. [UI] Shows success toast: "Rascunho salvo"

--- Later ---

8. [UI] User returns to draft, updates form data
9. [Frontend] Sends PUT /api/v1/companies/:companyId/documents/:documentId { title?, formData? }
10. [Backend] Validates document is DRAFT
    → IF not DRAFT: return 422 DOC_NOT_DRAFT
11. [Backend] Updates document fields
12. [Backend] Returns 200 with updated data

--- Ready to generate ---

13. [UI] User clicks "Generate PDF"
14. [Frontend] Sends POST /api/v1/companies/:companyId/documents/:documentId/generate
15. [Backend] Validates document is DRAFT
16. [Backend] Validates form data completeness
    → IF incomplete: return 422 DOC_INCOMPLETE_FORM
17. [Backend] Compiles template, generates PDF, uploads to S3
18. [Backend] Updates document (status: GENERATED, s3Key, contentHash, generatedAt)
19. [Backend] Returns 200 with updated data
20. [UI] Shows success toast, shows download button

POSTCONDITION: Document updated from DRAFT to GENERATED
SIDE EFFECTS: Audit log DOCUMENT_DRAFT_CREATED, DOCUMENT_UPDATED, DOCUMENT_GENERATED
```

### Alternative Path: Upload Existing Document

```
PRECONDITION: User has a pre-existing PDF/image document to upload
ACTOR: ADMIN or LEGAL member
TRIGGER: User clicks "Upload Document"

1. [UI] User clicks "Upload" button on documents page
2. [UI] User selects file from filesystem and enters title
3. [Frontend] Validates file size client-side (max 10MB)
    → IF too large: show error, STOP
4. [Frontend] Sends POST /api/v1/companies/:companyId/documents/upload (multipart: file, title)
5. [Backend] ParseFilePipe validates file size (MaxFileSizeValidator 10MB)
    → IF too large: return 422
6. [Backend] Validates file type via magic bytes
    → IF not PDF/JPEG/PNG: return 422 DOC_INVALID_FILE_TYPE
7. [Backend] Computes SHA-256 content hash
8. [Backend] Determines file extension from magic bytes
9. [Backend] Uploads to S3
10. [Backend] Creates Document record (status: GENERATED, no templateId)
11. [Backend] Returns 201 with document data
12. [UI] Shows success toast

POSTCONDITION: Uploaded document stored in S3 with integrity hash
SIDE EFFECTS: Audit log DOCUMENT_UPLOADED
```

### Alternative Path: Preview Document

```
PRECONDITION: Document exists (DRAFT or GENERATED)
ACTOR: ADMIN, FINANCE, or LEGAL member
TRIGGER: User clicks "Preview"

1. [Frontend] Sends GET /api/v1/companies/:companyId/documents/:documentId/preview
2. [Backend] Finds document with template
3. [Backend] Compiles Handlebars template with stored formData
4. [Backend] Returns HTML response (Content-Type: text/html)
5. [UI] Renders HTML in preview modal or new tab

POSTCONDITION: No state change
```

### Alternative Path: Download Generated Document

```
PRECONDITION: Document exists with status GENERATED (has s3Key)
ACTOR: ADMIN, FINANCE, or LEGAL member
TRIGGER: User clicks "Download"

1. [Frontend] Sends GET /api/v1/companies/:companyId/documents/:documentId/download
2. [Backend] Finds document
    → IF no s3Key: return 422 DOC_NOT_GENERATED
3. [Backend] Generates S3 pre-signed URL (15-minute expiry)
4. [Backend] Returns { downloadUrl, expiresAt, filename }
5. [Frontend] Opens downloadUrl in new tab or triggers browser download

POSTCONDITION: No state change. Pre-signed URL expires in 15 minutes.
```

### Error Path: Delete Document

```
PRECONDITION: Document exists
ACTOR: ADMIN only
TRIGGER: User clicks "Delete" with confirmation

1. [Frontend] Shows confirmation dialog
2. [Frontend] Sends DELETE /api/v1/companies/:companyId/documents/:documentId
3. [Backend] Finds document with signer count
    → IF not found: return 404
    → IF has signers: return 422 DOC_HAS_SIGNATURES
    → IF status is PENDING_SIGNATURE/SIGNED/ANCHORED: return 422 DOC_HAS_SIGNATURES
4. [Backend] Deletes S3 object if s3Key exists
    → IF S3 delete fails: logs warning, continues
5. [Backend] Deletes document record
6. [Backend] Returns 204 No Content
7. [UI] Removes document from list, shows success toast

POSTCONDITION: Document and S3 object deleted
SIDE EFFECTS: Audit log DOCUMENT_DELETED
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 13 | Auth check | No valid token | Error | 401 Unauthorized |
| 14 | Role check | Not ADMIN/LEGAL | Error | 404 Not Found |
| 15 | Template lookup | Template not found | Error | 404 DOCUMENTTEMPLATE_NOT_FOUND |
| 16 | Template active | Template inactive | Error | 422 DOC_TEMPLATE_INACTIVE |
| 17 | Form validation | Missing required fields | Error | 422 DOC_INCOMPLETE_FORM |
| 19-20 | PDF generation | Puppeteer crash | Error | 422 DOC_GENERATION_FAILED |
| 22 | S3 upload | S3 unavailable | Warning | Continues without S3 (graceful degradation) |
| - | File upload | Invalid magic bytes | Error | 422 DOC_INVALID_FILE_TYPE |
| - | File upload | File > 10MB | Error | 422 (ParseFilePipe) |
| - | Delete | Has signers | Error | 422 DOC_HAS_SIGNATURES |
| - | Delete | Status not DRAFT/GENERATED | Error | 422 DOC_HAS_SIGNATURES |
| - | Update draft | Status not DRAFT | Error | 422 DOC_NOT_DRAFT |
| - | Download | No s3Key | Error | 422 DOC_NOT_GENERATED |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| Document | status | -- | DRAFT | createDraft |
| Document | status | -- | GENERATED | createAndGenerate |
| Document | status | DRAFT | GENERATED | generateFromDraft |
| Document | s3Key | null | documents/{companyId}/{ts}-{hash}.pdf | generateFromDraft / createAndGenerate |
| Document | contentHash | null | SHA-256 hex | generateFromDraft / createAndGenerate |
| Document | generatedAt | null | now() | generateFromDraft / createAndGenerate |
| Document | -- | exists | deleted | deleteDocument |

---

## By Role

| Action | ADMIN | LEGAL | FINANCE | INVESTOR | EMPLOYEE |
|--------|-------|-------|---------|----------|----------|
| List templates | Yes | Yes | Yes | No (404) | No (404) |
| View template | Yes | Yes | Yes | No (404) | No (404) |
| List documents | Yes | Yes | Yes | No (404) | No (404) |
| View document | Yes | Yes | Yes | No (404) | No (404) |
| Create draft | Yes | Yes | No (404) | No (404) | No (404) |
| Generate document | Yes | Yes | No (404) | No (404) | No (404) |
| Update draft | Yes | Yes | No (404) | No (404) | No (404) |
| Preview | Yes | Yes | Yes | No (404) | No (404) |
| Download | Yes | Yes | Yes | No (404) | No (404) |
| Upload document | Yes | Yes | No (404) | No (404) | No (404) |
| Delete document | Yes | No (404) | No (404) | No (404) | No (404) |
