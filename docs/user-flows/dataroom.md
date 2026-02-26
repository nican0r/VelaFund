# Dataroom — User Flows

**Feature**: Upload, view, download, and delete documents in the company dataroom that investors see on the public profile page
**Actors**: ADMIN (full CRUD), FINANCE (upload/delete), all company members (read/download), public visitors (download via slug)
**Preconditions**: User is authenticated; company exists and has a CompanyProfile; user is a member of the company
**Related Flows**:
- **Depends on**: [Authentication](./authentication.md) -- user must be logged in for all management endpoints
- **Depends on**: [Company Profile](./company-profile.md) -- profile must exist before documents can be uploaded
- **Feeds into**: [Company Profile](./company-profile.md) -- documents appear in the dataroom section of the public profile page
- **See also**: [Company Dataroom (Backend API)](./company-dataroom.md) -- backend endpoint details, allowed MIME types, magic bytes validation

---

## Flow Map

```
User navigates to Dataroom page
  |
  +-- [page loads] --> Fetch GET /api/v1/companies/:companyId/profile/documents
  |     |
  |     +-- [profile exists + documents found] --> Render document list + storage bar + category tabs
  |     +-- [profile exists + no documents] --> Render empty state with upload CTA
  |     +-- [profile not found] --> 404 COMPANYPROFILE_NOT_FOUND
  |     +-- [unauthenticated] --> 401 --> redirect to login
  |     +-- [not a company member] --> 404 (prevents enumeration)
  |
  +-- [ADMIN/FINANCE] Upload Document
  |     |
  |     +-- User clicks "Upload Document" button --> Upload dialog opens (drag-and-drop zone)
  |     |
  |     +-- User selects/drops file + selects category + optional display name
  |     |     |
  |     |     +-- [client-side: invalid file type] --> Inline error in dialog, STOP
  |     |     +-- [client-side: file > 25 MB] --> Inline error in dialog, STOP
  |     |
  |     +-- User clicks "Upload" --> POST multipart/form-data /api/v1/companies/:companyId/profile/documents
  |           |
  |           +-- [valid file + under limits] --> S3 upload + DB record created
  |           |     |
  |           |     +-- [PDF file] --> Page count extracted from buffer
  |           |     +-- [non-PDF file] --> pageCount = null
  |           |     |
  |           |     +-- 201 Created --> Success toast, dialog closes, document list refreshes
  |           |
  |           +-- [invalid MIME type] --> 422 PROFILE_DOC_INVALID_TYPE --> Error toast
  |           +-- [magic bytes mismatch] --> 422 PROFILE_DOC_INVALID_TYPE --> Error toast
  |           +-- [file > 25 MB] --> 422 PROFILE_DOC_TOO_LARGE --> Error toast
  |           +-- [total storage > 500 MB] --> 422 PROFILE_STORAGE_LIMIT --> Error toast
  |           +-- [S3 unavailable] --> 422 SYS_S3_UNAVAILABLE --> Error toast
  |           +-- [no file attached] --> 422 PROFILE_DOC_FILE_REQUIRED --> Error toast
  |           +-- [profile not found] --> 404 COMPANYPROFILE_NOT_FOUND --> Error toast
  |
  +-- [Any member] Download Document
  |     |
  |     +-- User clicks download button on document row
  |     +-- GET /api/v1/companies/:companyId/profile/documents/:documentId/download
  |           |
  |           +-- [document exists + S3 available] --> Pre-signed URL (15-min expiry) --> Opens in new tab
  |           +-- [document not found] --> 404 PROFILEDOCUMENT_NOT_FOUND --> Error toast
  |           +-- [S3 unavailable] --> 422 SYS_S3_UNAVAILABLE --> Error toast
  |
  +-- [ADMIN/FINANCE] Delete Document
  |     |
  |     +-- User clicks delete button on document row --> Confirmation dialog opens
  |           |
  |           +-- [user cancels] --> Dialog closes, no action
  |           +-- [user confirms] --> DELETE /api/v1/companies/:companyId/profile/documents/:documentId
  |                 |
  |                 +-- [document exists] --> S3 delete (file + thumbnail, graceful) + DB delete
  |                 |     |
  |                 |     +-- 204 No Content --> Success toast, document removed from list
  |                 |
  |                 +-- [document not found] --> 404 PROFILEDOCUMENT_NOT_FOUND --> Error toast
  |
  +-- [Any member] Filter by Category
        |
        +-- User clicks category tab (All, PITCH_DECK, FINANCIALS, LEGAL, PRODUCT, TEAM, OTHER)
        +-- [Frontend] Filters displayed documents client-side (or re-fetches with ?category= param)
        +-- Filtered list shown with count per category
```

---

## Flows

### Happy Path: Upload Document

```
PRECONDITION: Company has a profile; user is ADMIN or FINANCE member
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "Upload Document" button on the Dataroom page

1.  [UI] User navigates to the Dataroom page
2.  [UI] User clicks "Upload Document" button
3.  [UI] Upload dialog opens with:
    - Drag-and-drop zone (accepts PDF, PNG, JPG, XLSX, PPTX, DOCX)
    - File browser fallback button
    - Category dropdown (PITCH_DECK, FINANCIALS, LEGAL, PRODUCT, TEAM, OTHER)
    - Optional display name text field
    - Upload button (disabled until file is selected)
4.  [UI] User drags a file into the drop zone or clicks to browse and selects a file
5.  [Frontend] Validates file type client-side against allowed extensions
    -> IF invalid type: show inline error in dialog "Tipo de arquivo nao suportado", STOP
6.  [Frontend] Validates file size client-side (max 25 MB)
    -> IF too large: show inline error in dialog "Arquivo excede o limite de 25 MB", STOP
7.  [UI] File name, size, and type icon displayed in the dialog as preview
8.  [UI] User selects a category from the dropdown (required)
9.  [UI] User optionally enters a display name (defaults to original file name if empty)
10. [UI] User clicks "Upload"
11. [Frontend] Constructs multipart/form-data with file, category, and displayName fields
12. [Frontend] Sends POST /api/v1/companies/:companyId/profile/documents
13. [Backend] AuthGuard validates session cookie
    -> IF unauthenticated: return 401, frontend redirects to login
14. [Backend] RolesGuard validates role is ADMIN or FINANCE
    -> IF unauthorized: return 404 (prevents enumeration)
15. [Backend] Validates file is present in request
    -> IF no file: throw 422 PROFILE_DOC_FILE_REQUIRED
16. [Backend] Resolves CompanyProfile by companyId
    -> IF not found: throw 404 COMPANYPROFILE_NOT_FOUND
17. [Backend] Validates file MIME type against allowed list
    -> IF invalid MIME: throw 422 PROFILE_DOC_INVALID_TYPE
18. [Backend] Validates file magic bytes match declared MIME type
    -> IF mismatch: throw 422 PROFILE_DOC_INVALID_TYPE
19. [Backend] Validates file size <= 25 MB
    -> IF too large: throw 422 PROFILE_DOC_TOO_LARGE
20. [Backend] Calculates total storage used by this profile + new file size
    -> IF total exceeds 500 MB: throw 422 PROFILE_STORAGE_LIMIT
21. [Backend] Checks S3 availability
    -> IF unavailable: throw 422 SYS_S3_UNAVAILABLE
22. [Backend] Generates unique S3 key: profiles/{profileId}/documents/{randomHex}.{ext}
23. [Backend] Uploads file buffer to S3 with content type
24. [Backend] Extracts PDF page count from buffer (if file is PDF)
    -> IF non-PDF: pageCount = null
25. [Backend] Creates ProfileDocument record in database with:
    - profileId, fileName, displayName, mimeType, fileSize, s3Key, category, pageCount, order
26. [Backend] Returns 201 Created with document object
27. [UI] Upload dialog closes
28. [UI] Success toast: "Documento enviado com sucesso"
29. [UI] Document list refreshes to include the new document
30. [UI] Storage usage bar updates to reflect new total

POSTCONDITION: Document stored in S3 and indexed in database; storage usage updated
SIDE EFFECTS: Audit log (DOCUMENT_UPLOADED via @Auditable)
```

### Happy Path: View Documents (Page Load)

```
PRECONDITION: User is an authenticated company member
ACTOR: Any company member
TRIGGER: User navigates to the Dataroom page

1.  [UI] User navigates to the Dataroom page (via sidebar navigation)
2.  [UI] Page renders loading skeleton (document list placeholder)
3.  [Frontend] Sends GET /api/v1/companies/:companyId/profile/documents
4.  [Backend] AuthGuard validates session
    -> IF unauthenticated: return 401, frontend redirects to login
5.  [Backend] RolesGuard validates user is a company member (any role)
    -> IF not a member: return 404
6.  [Backend] Resolves CompanyProfile by companyId
    -> IF not found: throw 404 COMPANYPROFILE_NOT_FOUND
7.  [Backend] Queries ProfileDocument records ordered by category + order
8.  [Backend] Calculates total storage used across all documents
9.  [Backend] Returns 200 with { documents, totalStorage, maxStorage }
10. [UI] Skeleton replaced with document list displaying:
    - File type icon (PDF, image, spreadsheet, presentation, document)
    - Document display name (or original file name)
    - File size (formatted: KB, MB)
    - Page count (PDFs only, shown as "X pages")
    - Upload date (formatted as dd/MM/yyyy)
    - Category badge (colored pill: PITCH_DECK, FINANCIALS, LEGAL, PRODUCT, TEAM, OTHER)
    - Download button (all members)
    - Delete button (ADMIN/FINANCE only)
11. [UI] Storage usage bar renders at the top showing used/max (e.g., "120 MB / 500 MB")
12. [UI] Category tabs render: All | Pitch Deck | Financials | Legal | Product | Team | Other
    - Each tab shows document count for that category
    - "All" tab is active by default

POSTCONDITION: User sees document list with storage usage and category filtering
```

### Alternative Path: View Documents (Empty State)

```
PRECONDITION: User is an authenticated company member; profile exists but has no documents
ACTOR: Any company member
TRIGGER: User navigates to the Dataroom page

1.  [UI] User navigates to the Dataroom page
2.  [Frontend] Sends GET /api/v1/companies/:companyId/profile/documents
3.  [Backend] Returns 200 with { documents: [], totalStorage: 0, maxStorage: 524288000 }
4.  [UI] Empty state displayed:
    - Illustration or document icon (gray-300 tint, 64px)
    - Title: "Nenhum documento no dataroom"
    - Description: "Envie documentos como pitch deck, financeiros e contratos para compartilhar com investidores"
    - CTA button: "Upload Document" (ADMIN/FINANCE only; hidden for other roles)
5.  [UI] Storage bar shows "0 MB / 500 MB"

POSTCONDITION: User sees empty state with upload prompt (if authorized)
```

### Happy Path: Download Document

```
PRECONDITION: Document exists in the dataroom; user is an authenticated company member
ACTOR: Any company member
TRIGGER: User clicks the download button on a document row

1.  [UI] User clicks the download icon/button on a document row
2.  [Frontend] Sends GET /api/v1/companies/:companyId/profile/documents/:documentId/download
3.  [Backend] AuthGuard validates session
    -> IF unauthenticated: return 401
4.  [Backend] RolesGuard validates user is a company member (any role)
    -> IF not a member: return 404
5.  [Backend] Resolves CompanyProfile by companyId
    -> IF not found: throw 404 COMPANYPROFILE_NOT_FOUND
6.  [Backend] Finds ProfileDocument by documentId scoped to profile
    -> IF not found: throw 404 PROFILEDOCUMENT_NOT_FOUND
7.  [Backend] Checks S3 availability
    -> IF unavailable: throw 422 SYS_S3_UNAVAILABLE
8.  [Backend] Generates pre-signed S3 URL with 15-minute expiry
9.  [Backend] Returns 200 with { downloadUrl, expiresIn: 900 }
10. [Frontend] Opens downloadUrl in a new browser tab (triggers browser download)

POSTCONDITION: User downloads the document via time-limited pre-signed S3 URL
```

### Happy Path: Delete Document

```
PRECONDITION: Document exists in the dataroom; user is ADMIN or FINANCE member
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks the delete button on a document row

1.  [UI] User clicks the delete icon/button on a document row
2.  [UI] Confirmation dialog opens with:
    - Title: "Excluir documento"
    - Message: "Tem certeza que deseja excluir '{documentName}'? Esta acao nao pode ser desfeita."
    - Document name displayed for clarity
    - "Cancel" button (secondary variant)
    - "Delete" button (destructive variant)
3.  [UI] User clicks "Delete" to confirm
4.  [Frontend] Sends DELETE /api/v1/companies/:companyId/profile/documents/:documentId
5.  [Backend] AuthGuard validates session
    -> IF unauthenticated: return 401
6.  [Backend] RolesGuard validates role is ADMIN or FINANCE
    -> IF unauthorized: return 404 (prevents enumeration)
7.  [Backend] Resolves CompanyProfile by companyId
    -> IF not found: throw 404 COMPANYPROFILE_NOT_FOUND
8.  [Backend] Finds ProfileDocument by documentId scoped to profile
    -> IF not found: throw 404 PROFILEDOCUMENT_NOT_FOUND
9.  [Backend] Deletes file from S3 (graceful -- failure logged but does not block)
10. [Backend] Deletes thumbnail from S3 if one exists (graceful)
11. [Backend] Deletes ProfileDocument record from database (cascades to ProfileDocumentDownload records)
12. [Backend] Returns 204 No Content
13. [UI] Confirmation dialog closes
14. [UI] Success toast: "Documento excluido com sucesso"
15. [UI] Document removed from the list (optimistic or refetch)
16. [UI] Storage usage bar updates to reflect reduced total

POSTCONDITION: Document removed from S3 and database; download history cascaded; storage freed
SIDE EFFECTS: Audit log (DOCUMENT_DELETED via @Auditable)
```

### Alternative Path: Delete Cancelled

```
PRECONDITION: User opened the delete confirmation dialog
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "Cancel" in the confirmation dialog

1. [UI] User clicks "Cancel" button in the confirmation dialog
2. [UI] Dialog closes
3. No API call made

POSTCONDITION: Document is unchanged
```

### Alternative Path: Filter by Category

```
PRECONDITION: Dataroom page is loaded with documents
ACTOR: Any company member
TRIGGER: User clicks a category tab

1.  [UI] User clicks a category tab (e.g., "Financials")
2.  [Frontend] Filters the document list to show only documents matching the selected category
    (client-side filter on already-fetched data, or re-fetch with ?category=FINANCIALS param)
3.  [UI] Selected tab highlighted as active
4.  [UI] Filtered document list displayed
5.  [UI] Document count updates for the active tab
6.  [UI] User can click "All" tab to return to full list

POSTCONDITION: Document list filtered by selected category (no data mutation)
```

### Error Path: Upload Unsupported File Type

```
PRECONDITION: User has opened the upload dialog
ACTOR: ADMIN or FINANCE member

1.  [UI] User drops or selects a file with unsupported type (e.g., .exe, .zip, .mp4)
2.  [Frontend] Client-side validation detects unsupported file extension
3.  [UI] Inline error in dialog: "Tipo de arquivo nao suportado. Formatos aceitos: PDF, PNG, JPG, XLSX, PPTX, DOCX"
4.  [UI] Upload button remains disabled

POSTCONDITION: No upload attempted; user informed of allowed types
```

### Error Path: Upload File Too Large

```
PRECONDITION: User has opened the upload dialog
ACTOR: ADMIN or FINANCE member

1.  [UI] User drops or selects a file larger than 25 MB
2.  [Frontend] Client-side validation detects file exceeds 25 MB limit
3.  [UI] Inline error in dialog: "Arquivo excede o limite de 25 MB"
4.  [UI] Upload button remains disabled

POSTCONDITION: No upload attempted; user informed of size limit
```

### Error Path: Storage Limit Exceeded

```
PRECONDITION: Profile storage usage is near 500 MB; user attempts to upload a file that would exceed the limit
ACTOR: ADMIN or FINANCE member

1. [UI] User selects a valid file and clicks "Upload"
2. [Frontend] Sends POST /api/v1/companies/:companyId/profile/documents
3. [Backend] All validations pass (MIME, magic bytes, file size)
4. [Backend] Calculates total storage: current usage + new file > 500 MB
5. [Backend] Returns 422 PROFILE_STORAGE_LIMIT
6. [UI] Error toast: "Limite de armazenamento excedido. Libere espaco excluindo documentos existentes."
7. [UI] Upload dialog remains open; user can cancel or choose a smaller file

POSTCONDITION: No document uploaded; user informed storage is full
```

### Error Path: S3 Unavailable During Upload

```
PRECONDITION: S3 service is down or misconfigured
ACTOR: ADMIN or FINANCE member

1. [UI] User selects a valid file and clicks "Upload"
2. [Frontend] Sends POST /api/v1/companies/:companyId/profile/documents
3. [Backend] All input validations pass
4. [Backend] S3 availability check fails or upload throws
5. [Backend] Returns 422 SYS_S3_UNAVAILABLE
6. [UI] Error toast: "Servico de armazenamento indisponivel. Tente novamente em alguns minutos."
7. [UI] Upload dialog remains open for retry

POSTCONDITION: No document uploaded; user informed of service issue
```

### Error Path: S3 Unavailable During Download

```
PRECONDITION: Document exists in database but S3 is unavailable
ACTOR: Any company member

1. [UI] User clicks download button on a document
2. [Frontend] Sends GET /api/v1/companies/:companyId/profile/documents/:documentId/download
3. [Backend] Document found in database
4. [Backend] S3 availability check fails
5. [Backend] Returns 422 SYS_S3_UNAVAILABLE
6. [UI] Error toast: "Servico de armazenamento indisponivel. Tente novamente em alguns minutos."

POSTCONDITION: No download initiated; user informed of service issue
```

### Error Path: Document Not Found (Download or Delete)

```
PRECONDITION: Document was deleted by another user or ID is invalid
ACTOR: Any company member (download) or ADMIN/FINANCE (delete)

1. [UI] User clicks download or delete on a document row
2. [Frontend] Sends GET (download) or DELETE request with documentId
3. [Backend] Document not found for the given ID and profile
4. [Backend] Returns 404 PROFILEDOCUMENT_NOT_FOUND
5. [UI] Error toast: "Documento nao encontrado"
6. [UI] Document list refetches to sync with current state

POSTCONDITION: User informed; list refreshed to remove stale entry
```

### Error Path: No Company Profile

```
PRECONDITION: Company exists but has no CompanyProfile created yet
ACTOR: Any company member

1. [UI] User navigates to the Dataroom page
2. [Frontend] Sends GET /api/v1/companies/:companyId/profile/documents
3. [Backend] CompanyProfile not found for this companyId
4. [Backend] Returns 404 COMPANYPROFILE_NOT_FOUND
5. [UI] Error state displayed:
   - Message: "Crie um perfil da empresa para acessar o dataroom"
   - CTA button: "Create Profile" (links to profile creation, ADMIN only)

POSTCONDITION: User directed to create a company profile first
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 5 (upload) | Client file type | Unsupported extension | Error | Inline error in dialog, upload blocked |
| 6 (upload) | Client file size | File > 25 MB | Error | Inline error in dialog, upload blocked |
| 13 (upload) | Auth check | No valid session | Error | 401, redirect to login |
| 14 (upload) | Role check | Not ADMIN or FINANCE | Error | 404 (prevents enumeration) |
| 15 (upload) | File presence | No file in request | Error | 422 PROFILE_DOC_FILE_REQUIRED |
| 16 (upload) | Profile existence | No profile for company | Error | 404 COMPANYPROFILE_NOT_FOUND |
| 17 (upload) | MIME validation | Invalid MIME type | Error | 422 PROFILE_DOC_INVALID_TYPE |
| 18 (upload) | Magic bytes | Bytes don't match MIME | Error | 422 PROFILE_DOC_INVALID_TYPE |
| 19 (upload) | File size (server) | File > 25 MB | Error | 422 PROFILE_DOC_TOO_LARGE |
| 20 (upload) | Storage limit | Total > 500 MB | Error | 422 PROFILE_STORAGE_LIMIT |
| 21 (upload) | S3 availability | S3 not available | Error | 422 SYS_S3_UNAVAILABLE |
| 24 (upload) | File type | PDF | Happy | Page count extracted from buffer |
| 24 (upload) | File type | Non-PDF | Happy | pageCount = null |
| 6 (download) | Document lookup | Not found | Error | 404 PROFILEDOCUMENT_NOT_FOUND |
| 7 (download) | S3 availability | S3 not available | Error | 422 SYS_S3_UNAVAILABLE |
| 8 (delete) | Document lookup | Not found | Error | 404 PROFILEDOCUMENT_NOT_FOUND |
| 3 (delete) | User confirmation | User cancels | Alternative | Dialog closes, no action |
| 3 (view) | Documents exist | Empty list | Alternative | Empty state with upload CTA |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| ProfileDocument | -- | -- | created | Document uploaded (POST) |
| ProfileDocument | -- | exists | deleted | Document deleted (DELETE), cascades to ProfileDocumentDownload |
| CompanyProfile | totalStorage (derived) | N bytes | N + fileSize bytes | Document uploaded |
| CompanyProfile | totalStorage (derived) | N bytes | N - fileSize bytes | Document deleted |

---

## Permission Matrix

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE | Public |
|--------|-------|---------|-------|----------|----------|--------|
| View document list | Yes | Yes | Yes | Yes | Yes | No (401) |
| Upload document | Yes | Yes | No (404) | No (404) | No (404) | No (401) |
| Download document | Yes | Yes | Yes | Yes | Yes | No (401) |
| Delete document | Yes | Yes | No (404) | No (404) | No (404) | No (401) |
| Filter by category | Yes | Yes | Yes | Yes | Yes | No (401) |

Notes:
- Non-members receive 404 (not 403) to prevent company enumeration per security.md.
- Public visitors can download documents via the public profile slug endpoint (see [Company Dataroom (Backend API)](./company-dataroom.md) for that flow).

---

## API Endpoints Summary

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/api/v1/companies/:companyId/profile/documents` | Required | All members | List documents with storage info |
| POST | `/api/v1/companies/:companyId/profile/documents` | Required | ADMIN, FINANCE | Upload document (multipart/form-data) |
| GET | `/api/v1/companies/:companyId/profile/documents/:documentId/download` | Required | All members | Get pre-signed download URL (15 min expiry) |
| DELETE | `/api/v1/companies/:companyId/profile/documents/:documentId` | Required | ADMIN, FINANCE | Delete document from S3 and database |

---

## Allowed File Types

| MIME Type | Extension | Max Size |
|-----------|-----------|----------|
| application/pdf | .pdf | 25 MB |
| image/jpeg | .jpg, .jpeg | 25 MB |
| image/png | .png | 25 MB |
| application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | .xlsx | 25 MB |
| application/vnd.openxmlformats-officedocument.presentationml.presentation | .pptx | 25 MB |
| application/vnd.openxmlformats-officedocument.wordprocessingml.document | .docx | 25 MB |

**Storage limit**: 500 MB total per company profile.

---

## Document Categories

| Category | Display Label | Usage |
|----------|--------------|-------|
| PITCH_DECK | Pitch Deck | Investor presentation slides |
| FINANCIALS | Financials | Financial statements, projections, reports |
| LEGAL | Legal | Corporate documents, contracts, bylaws |
| PRODUCT | Product | Product roadmaps, technical documentation |
| TEAM | Team | Team bios, org charts |
| OTHER | Other | Miscellaneous documents |

---

## UI Components

### Document List Item

Each document row displays:
- **File type icon**: Visual indicator based on MIME type (PDF icon, image icon, spreadsheet icon, etc.)
- **Display name**: Custom name or original filename
- **File size**: Human-readable format (e.g., "2.4 MB")
- **Page count**: For PDFs only, shown as "12 pages"
- **Upload date**: Formatted as dd/MM/yyyy (Brazilian format per i18n rules)
- **Category badge**: Colored pill badge matching the category
- **Actions**: Download button (all members), Delete button (ADMIN/FINANCE only)

### Storage Usage Bar

- Horizontal progress bar at the top of the document list
- Shows "{used} MB / 500 MB" label
- Color transitions: blue (< 80%), warning/cream (80-95%), destructive/red (> 95%)

### Upload Dialog

- Modal with drag-and-drop zone
- File type icons showing accepted formats
- Category dropdown (required)
- Display name text field (optional)
- Upload progress indicator during upload
- Cancel and Upload buttons in footer

### Category Tabs

- Horizontal tab bar: All | Pitch Deck | Financials | Legal | Product | Team | Other
- Each tab shows document count in parentheses
- "All" tab active by default
- Tabs with zero documents still visible but show "(0)"

---

## Cross-References

**Depends on**: [Authentication](./authentication.md) -- authenticated endpoints require valid session
**Depends on**: [Company Profile](./company-profile.md) -- profile must exist before uploading documents
**Feeds into**: [Company Profile](./company-profile.md) -- documents appear on the public profile page dataroom section
**See also**: [Company Dataroom (Backend API)](./company-dataroom.md) -- backend API details including public download via slug, reorder endpoint, magic bytes validation
