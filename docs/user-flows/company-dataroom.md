# Company Dataroom — User Flows

**Feature**: Upload, manage, and share documents (pitch decks, financials, legal docs) via the company profile's dataroom
**Actors**: ADMIN (full CRUD), FINANCE (upload/delete/reorder), all members (read/download), public visitors (download via slug)
**Preconditions**: Company exists and has a CompanyProfile; user is authenticated (except public download)
**Related Flows**: [Company Profile](./company-profile.md), [Document Generation](./document-generation.md)

---

## Flow Map

```
Member navigates to Profile > Documents
  │
  ├─ [ADMIN/FINANCE] Upload Document
  │     │
  │     ├─ [valid file + under limits] ─→ S3 upload + DB record ─→ Document listed
  │     │     │
  │     │     ├─ [PDF file] ─→ Page count extracted from buffer
  │     │     └─ [non-PDF file] ─→ pageCount = null
  │     │
  │     ├─ [invalid MIME type] ─→ 422 PROFILE_DOC_INVALID_TYPE
  │     ├─ [magic bytes mismatch] ─→ 422 PROFILE_DOC_INVALID_TYPE
  │     ├─ [file > 25 MB] ─→ 422 PROFILE_DOC_TOO_LARGE
  │     ├─ [total storage > 500 MB] ─→ 422 PROFILE_STORAGE_LIMIT
  │     ├─ [S3 unavailable] ─→ 422 SYS_S3_UNAVAILABLE
  │     └─ [no file attached] ─→ 422 PROFILE_DOC_FILE_REQUIRED
  │
  ├─ [ADMIN/FINANCE] Delete Document
  │     │
  │     ├─ [document exists] ─→ S3 delete (graceful) + DB delete ─→ Success
  │     └─ [document not found] ─→ 404 PROFILEDOCUMENT_NOT_FOUND
  │
  ├─ [ADMIN/FINANCE] Reorder Documents
  │     │
  │     ├─ [all IDs valid] ─→ Atomic order update via $transaction ─→ Reordered list
  │     └─ [invalid document ID] ─→ 404 PROFILEDOCUMENT_NOT_FOUND
  │
  ├─ [Any member] List Documents
  │     │
  │     ├─ [profile exists] ─→ Documents list + storage info
  │     ├─ [with category filter] ─→ Filtered documents list
  │     └─ [profile not found] ─→ 404 COMPANYPROFILE_NOT_FOUND
  │
  ├─ [Any member] Download Document (authenticated)
  │     │
  │     ├─ [document exists + S3 available] ─→ Pre-signed URL (15-min expiry)
  │     ├─ [document not found] ─→ 404 PROFILEDOCUMENT_NOT_FOUND
  │     └─ [S3 unavailable] ─→ 422 SYS_S3_UNAVAILABLE
  │
  └─ [Public visitor] Download Document (via slug)
        │
        ├─ [profile access granted] ─→ Pre-signed URL + download recorded
        │     │
        │     ├─ [with viewer email] ─→ Email stored in download record
        │     └─ [without email] ─→ IP-only download record (redacted to /24)
        │
        ├─ [profile requires password] ─→ 422 PROFILE_PASSWORD_REQUIRED
        ├─ [profile requires email] ─→ 422 PROFILE_EMAIL_REQUIRED
        ├─ [wrong password] ─→ 422 PROFILE_PASSWORD_INVALID
        └─ [document not found] ─→ 404 PROFILEDOCUMENT_NOT_FOUND
```

---

## Flows

### Happy Path: Upload Document

```
PRECONDITION: Company has a profile; user is ADMIN or FINANCE member
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks "Upload Document" button

1. [UI] User navigates to Company Profile > Documents tab
2. [UI] User clicks "Upload Document"
3. [UI] User selects file from file picker and chooses category (PITCH_DECK, FINANCIALS, etc.)
4. [UI] User optionally provides a custom display name
5. [Frontend] Sends POST /api/v1/companies/:companyId/profile/documents (multipart/form-data)
6. [Backend] AuthGuard validates session
   → IF unauthenticated: return 401
7. [Backend] RolesGuard validates role is ADMIN or FINANCE
   → IF unauthorized: return 404 (prevent enumeration)
8. [Backend] Validates file is present
   → IF no file: throw 422 PROFILE_DOC_FILE_REQUIRED
9. [Backend] Resolves CompanyProfile by companyId
   → IF not found: throw 404 COMPANYPROFILE_NOT_FOUND
10. [Backend] Validates file MIME type against allowed list
    → IF invalid MIME: throw 422 PROFILE_DOC_INVALID_TYPE
11. [Backend] Validates file magic bytes match declared MIME type
    → IF mismatch: throw 422 PROFILE_DOC_INVALID_TYPE
12. [Backend] Validates file size ≤ 25 MB
    → IF too large: throw 422 PROFILE_DOC_TOO_LARGE
13. [Backend] Calculates total storage used + new file
    → IF exceeds 500 MB: throw 422 PROFILE_STORAGE_LIMIT
14. [Backend] Checks S3 availability
    → IF unavailable: throw 422 SYS_S3_UNAVAILABLE
15. [Backend] Generates unique S3 key: profiles/{profileId}/documents/{randomHex}.{ext}
16. [Backend] Uploads file buffer to S3 with content type
17. [Backend] Extracts PDF page count (if PDF)
18. [Backend] Creates ProfileDocument record in database
19. [Backend] Returns 201 with document object
20. [UI] Shows success toast, document appears in list

POSTCONDITION: Document stored in S3 and indexed in database
SIDE EFFECTS: Audit log (DOCUMENT_UPLOADED via @Auditable)
```

### Happy Path: Delete Document

```
PRECONDITION: Document exists in profile's dataroom
ACTOR: ADMIN or FINANCE member
TRIGGER: User clicks delete icon on document row

1. [UI] User clicks delete icon next to document
2. [UI] Confirmation dialog shown
3. [Frontend] Sends DELETE /api/v1/companies/:companyId/profile/documents/:documentId
4. [Backend] AuthGuard + RolesGuard validate (ADMIN/FINANCE)
5. [Backend] Resolves profile by companyId
   → IF not found: throw 404 COMPANYPROFILE_NOT_FOUND
6. [Backend] Finds document by ID scoped to profile
   → IF not found: throw 404 PROFILEDOCUMENT_NOT_FOUND
7. [Backend] Deletes file from S3 (graceful — failure logged but doesn't block)
8. [Backend] Deletes thumbnail from S3 if exists (graceful)
9. [Backend] Deletes ProfileDocument from database (cascades to downloads)
10. [Backend] Returns 204 No Content
11. [UI] Removes document from list, shows success toast

POSTCONDITION: Document removed from S3 and database; download history cascaded
SIDE EFFECTS: Audit log (DOCUMENT_DELETED via @Auditable)
```

### Happy Path: Reorder Documents

```
PRECONDITION: Profile has multiple documents
ACTOR: ADMIN or FINANCE member
TRIGGER: User drags document to new position

1. [UI] User drags a document row to a new position
2. [Frontend] Computes new order values for affected documents
3. [Frontend] Sends PUT /api/v1/companies/:companyId/profile/documents/order
4. [Backend] AuthGuard + RolesGuard validate (ADMIN/FINANCE)
5. [Backend] Resolves profile by companyId
6. [Backend] Validates all document IDs belong to the profile
   → IF any ID invalid: throw 404 PROFILEDOCUMENT_NOT_FOUND
7. [Backend] Updates order values atomically via $transaction
8. [Backend] Returns reordered document list
9. [UI] Updates document order in UI

POSTCONDITION: Documents reflect new ordering
```

### Happy Path: List Documents

```
PRECONDITION: User is an authenticated company member
ACTOR: Any company member
TRIGGER: User navigates to Profile > Documents

1. [UI] User navigates to Company Profile > Documents tab
2. [Frontend] Sends GET /api/v1/companies/:companyId/profile/documents
3. [Backend] AuthGuard validates session
4. [Backend] Resolves profile by companyId
   → IF not found: throw 404 COMPANYPROFILE_NOT_FOUND
5. [Backend] Queries documents ordered by category + order
6. [Backend] Calculates total storage used
7. [Backend] Returns { documents, totalStorage, maxStorage }
8. [UI] Renders document list with storage usage indicator

POSTCONDITION: User sees document list with storage usage
```

### Happy Path: Authenticated Download

```
PRECONDITION: User is an authenticated company member
ACTOR: Any company member
TRIGGER: User clicks download button on document

1. [UI] User clicks download icon on a document
2. [Frontend] Sends GET /api/v1/companies/:companyId/profile/documents/:documentId/download
3. [Backend] AuthGuard validates session
4. [Backend] Resolves profile and document
   → IF not found: throw 404
5. [Backend] Checks S3 availability
   → IF unavailable: throw 422 SYS_S3_UNAVAILABLE
6. [Backend] Generates pre-signed S3 URL (15-minute expiry)
7. [Backend] Returns { downloadUrl, expiresIn: 900 }
8. [Frontend] Opens downloadUrl in new tab / triggers browser download

POSTCONDITION: User downloads document via time-limited S3 URL
```

### Happy Path: Public Download (via Profile Slug)

```
PRECONDITION: Company profile is published; document exists
ACTOR: Public visitor (unauthenticated)
TRIGGER: Visitor clicks download link on public profile page

1. [UI] Visitor views public profile at /{slug}
2. [UI] Visitor clicks download on a document
3. [Frontend] Sends GET /api/v1/profiles/:slug/documents/:documentId/download
4. [Backend] Validates profile access (slug + password/email if required)
   → IF password required but not provided: throw 422 PROFILE_PASSWORD_REQUIRED
   → IF wrong password: throw 422 PROFILE_PASSWORD_INVALID
   → IF email required but not provided: throw 422 PROFILE_EMAIL_REQUIRED
5. [Backend] Finds document scoped to profile slug
   → IF not found: throw 404 PROFILEDOCUMENT_NOT_FOUND
6. [Backend] Checks S3 availability
   → IF unavailable: throw 422 SYS_S3_UNAVAILABLE
7. [Backend] Records download event asynchronously (fire-and-forget)
   - Stores: documentId, profileId, viewerEmail (if provided), viewerIp (redacted to /24)
8. [Backend] Generates pre-signed S3 URL (15-minute expiry)
9. [Backend] Returns { downloadUrl, expiresIn: 900 }
10. [Frontend] Opens downloadUrl for download

POSTCONDITION: Visitor downloads document; download event recorded for analytics
SIDE EFFECTS: ProfileDocumentDownload record created (async, fire-and-forget)
```

---

## Decision Points

| # | Decision Point | Condition | Path | Outcome |
|---|---------------|-----------|------|---------|
| 8 | File presence | No file attached | Error | 422 PROFILE_DOC_FILE_REQUIRED |
| 10 | MIME validation | Invalid MIME type | Error | 422 PROFILE_DOC_INVALID_TYPE |
| 11 | Magic bytes | Bytes don't match MIME | Error | 422 PROFILE_DOC_INVALID_TYPE |
| 12 | File size | File > 25 MB | Error | 422 PROFILE_DOC_TOO_LARGE |
| 13 | Storage limit | Total > 500 MB | Error | 422 PROFILE_STORAGE_LIMIT |
| 14 | S3 availability | S3 not configured | Error | 422 SYS_S3_UNAVAILABLE |
| 17 | File type | PDF file uploaded | Happy | Page count extracted from buffer |
| 17 | File type | Non-PDF file | Happy | pageCount set to null |
| 4 (public) | Profile access | Password required | Error | 422 PROFILE_PASSWORD_REQUIRED |
| 4 (public) | Profile access | Email required | Error | 422 PROFILE_EMAIL_REQUIRED |

---

## State Transitions

| Entity | Field | Before | After | Trigger |
|--------|-------|--------|-------|---------|
| ProfileDocument | — | — | created | Document uploaded |
| ProfileDocument | order | N | M | Documents reordered |
| ProfileDocument | — | exists | deleted | Document deleted (cascade to downloads) |
| ProfileDocumentDownload | — | — | created | Public download event |

---

## Permission Matrix

| Action | ADMIN | FINANCE | LEGAL | INVESTOR | EMPLOYEE | Public |
|--------|-------|---------|-------|----------|----------|--------|
| List documents | Yes | Yes | Yes | Yes | Yes | No |
| Upload document | Yes | Yes | No | No | No | No |
| Delete document | Yes | Yes | No | No | No | No |
| Reorder documents | Yes | Yes | No | No | No | No |
| Download (authenticated) | Yes | Yes | Yes | Yes | Yes | No |
| Download (public via slug) | N/A | N/A | N/A | N/A | N/A | Yes (if profile access granted) |

---

## API Endpoints Summary

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/api/v1/companies/:companyId/profile/documents` | Yes | All members | List documents with storage info |
| POST | `/api/v1/companies/:companyId/profile/documents` | Yes | ADMIN, FINANCE | Upload document (multipart) |
| DELETE | `/api/v1/companies/:companyId/profile/documents/:documentId` | Yes | ADMIN, FINANCE | Delete document |
| PUT | `/api/v1/companies/:companyId/profile/documents/order` | Yes | ADMIN, FINANCE | Reorder documents |
| GET | `/api/v1/companies/:companyId/profile/documents/:documentId/download` | Yes | All members | Get presigned download URL |
| GET | `/api/v1/profiles/:slug/documents/:documentId/download` | No | Public | Get public presigned download URL |

---

## Allowed File Types

| MIME Type | Extension | Magic Bytes |
|-----------|-----------|-------------|
| application/pdf | .pdf | %PDF (0x25 0x50 0x44 0x46) |
| image/jpeg | .jpg | 0xFF 0xD8 0xFF |
| image/png | .png | 0x89 0x50 0x4E 0x47 |
| application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | .xlsx | PK (0x50 0x4B 0x03 0x04) |
| application/vnd.openxmlformats-officedocument.presentationml.presentation | .pptx | PK (0x50 0x4B 0x03 0x04) |
| application/vnd.openxmlformats-officedocument.wordprocessingml.document | .docx | PK (0x50 0x4B 0x03 0x04) |

---

## Cross-References

**Depends on**: [Company Profile](./company-profile.md) — profile must exist before uploading documents
**Depends on**: [Authentication](./authentication.md) — authenticated endpoints require valid session
**Feeds into**: [Company Profile](./company-profile.md) — documents appear on public profile page
