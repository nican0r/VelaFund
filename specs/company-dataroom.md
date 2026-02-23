# Company Dataroom Specification

**Topic of Concern**: Document management for the company profile dataroom — upload, storage, download, categorization, and thumbnail generation for investor-facing documents

**One-Sentence Description**: The system allows company admins to upload, organize, and serve documents (pitch decks, financials, legal documents, etc.) via the company profile dataroom, with categorization, PDF metadata extraction, thumbnail generation, and secure pre-signed URL downloads.

---

## Overview

The Company Dataroom is the document management subsystem of the Company Profile (see [company-profile.md](./company-profile.md)). It enables founders to upload and organize files that prospective investors can browse and download through the shareable profile link.

Dataroom documents are **manually curated** files uploaded by the company admin — they are distinct from:
- **Generated legal documents** (managed in `document-generation.md` / `document-signatures.md`)
- **Due diligence package exports** (auto-generated ZIPs from `reports-analytics.md`)

Documents are stored in a dedicated S3 bucket (`navia-profile-documents`) with SSE-S3 encryption, served via pre-signed URLs with 15-minute expiry. PDF files receive automatic page count extraction and first-page thumbnail generation via a background Bull job.

---

## User Stories

### US-1: Upload Dataroom Documents
**As an** admin user
**I want to** upload documents (pitch deck, financials, term sheet, etc.) to the company profile
**So that** investors can review key materials without needing separate file-sharing tools

### US-2: Organize Documents by Category
**As an** admin user
**I want to** categorize and reorder documents in the dataroom
**So that** investors can find relevant materials quickly

### US-3: Download Dataroom Documents
**As an** investor viewing a shared profile
**I want to** download documents from the dataroom
**So that** I can review materials offline or share them with my team

---

## Functional Requirements

### FR-4: Dataroom Document Upload
- System MUST allow uploading documents organized by category
- Document categories:
  - `PITCH_DECK` — Pitch deck presentations
  - `FINANCIALS` — Financial statements, projections, unit economics
  - `LEGAL` — Articles of incorporation, shareholder agreements, term sheets
  - `PRODUCT` — Product documentation, demos, technical architecture
  - `TEAM` — Team bios, org charts, advisory board
  - `OTHER` — Miscellaneous documents
- Each document has:
  - `name`: display name (auto-populated from filename, editable)
  - `category`: one of the predefined categories
  - `fileKey`: S3 object key
  - `fileSize`: file size in bytes
  - `mimeType`: file MIME type
  - `pageCount`: page count for PDFs (extracted server-side, null for non-PDFs)
  - `order`: display order within category (0-indexed)
  - `uploadedAt`: timestamp
  - `uploadedById`: user who uploaded the file
- Allowed file types: PDF, PNG, JPG, JPEG, XLSX, PPTX, DOCX
- Maximum file size: 25 MB per file
- Maximum total storage per company profile: 500 MB
- System MUST generate a thumbnail preview for PDF first pages
- System MUST extract page count from uploaded PDFs
- Documents are served via pre-signed S3 URLs (15-minute expiry) — never directly public

---

## Data Models

### ProfileDocument Entity

```typescript
interface ProfileDocument {
  id: string;                          // UUID, primary key
  profileId: string;                   // Foreign key to CompanyProfile
  name: string;                        // Display name
  category: DocumentCategory;          // PITCH_DECK | FINANCIALS | LEGAL | PRODUCT | TEAM | OTHER
  fileKey: string;                     // S3 object key
  fileSize: number;                    // File size in bytes
  mimeType: string;                    // MIME type
  pageCount: number | null;            // Page count (PDFs only)
  thumbnailKey: string | null;         // S3 key for PDF first-page thumbnail
  order: number;                       // Display order within category
  uploadedById: string;                // Foreign key to User
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

enum DocumentCategory {
  PITCH_DECK = 'PITCH_DECK',
  FINANCIALS = 'FINANCIALS',
  LEGAL = 'LEGAL',
  PRODUCT = 'PRODUCT',
  TEAM = 'TEAM',
  OTHER = 'OTHER',
}
```

### ProfileDocumentDownload Entity

```typescript
interface ProfileDocumentDownload {
  id: string;                          // UUID, primary key
  documentId: string;                  // Foreign key to ProfileDocument
  profileId: string;                   // Foreign key to CompanyProfile
  viewerEmail: string | null;          // Email (if available)
  viewerIp: string;                    // Redacted to /24 subnet
  downloadedAt: Date;
}
```

### Prisma Schema

```prisma
model ProfileDocument {
  id           String           @id @default(uuid())
  profileId    String           @map("profile_id")
  name         String
  category     DocumentCategory
  fileKey      String           @map("file_key")
  fileSize     Int              @map("file_size")
  mimeType     String           @map("mime_type")
  pageCount    Int?             @map("page_count")
  thumbnailKey String?          @map("thumbnail_key")
  order        Int              @default(0)
  uploadedById String           @map("uploaded_by_id")
  uploadedAt   DateTime         @map("uploaded_at")
  createdAt    DateTime         @default(now()) @map("created_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")

  profile      CompanyProfile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  uploadedBy   User             @relation(fields: [uploadedById], references: [id])
  downloads    ProfileDocumentDownload[]

  @@index([profileId, category, order])
  @@map("profile_documents")
}

model ProfileDocumentDownload {
  id           String   @id @default(uuid())
  documentId   String   @map("document_id")
  profileId    String   @map("profile_id")
  viewerEmail  String?  @map("viewer_email")
  viewerIp     String   @map("viewer_ip")
  downloadedAt DateTime @default(now()) @map("downloaded_at")

  document     ProfileDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([profileId, downloadedAt])
  @@map("profile_document_downloads")
}

enum DocumentCategory {
  PITCH_DECK
  FINANCIALS
  LEGAL
  PRODUCT
  TEAM
  OTHER
}
```

---

## API Endpoints

### Document Upload

#### POST /api/v1/companies/:companyId/profile/documents
**Description**: Upload a document to the dataroom.

**Auth**: Required. User must be ADMIN or FINANCE.

**Request**: `multipart/form-data`
- `file`: the document file
- `category`: document category enum value
- `name`: optional display name (defaults to filename)

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "doc_001",
    "name": "LuminaTech_PitchDeck_2024.pdf",
    "category": "PITCH_DECK",
    "fileSize": 2456789,
    "mimeType": "application/pdf",
    "pageCount": 12,
    "thumbnailUrl": "https://s3.amazonaws.com/navia/thumbnails/doc_001.png",
    "order": 0,
    "uploadedAt": "2026-02-20T15:00:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` — Invalid file type or missing category
- `413 Payload Too Large` — File exceeds 25 MB
- `422 Unprocessable Entity` — Total storage for profile exceeds 500 MB

---

#### DELETE /api/v1/companies/:companyId/profile/documents/:documentId
**Description**: Remove a document from the dataroom. Deletes the file from S3.

**Auth**: Required. User must be ADMIN or FINANCE.

**Response**: `204 No Content`

---

#### PUT /api/v1/companies/:companyId/profile/documents/order
**Description**: Reorder documents within their categories.

**Auth**: Required. User must be ADMIN or FINANCE.

**Request**:
```json
{
  "documents": [
    { "id": "doc_001", "order": 0 },
    { "id": "doc_002", "order": 1 }
  ]
}
```

**Response** (200 OK): Returns updated documents with new order.

---

#### GET /api/v1/companies/:companyId/profile/documents/:documentId/download
**Description**: Generate a pre-signed S3 URL for downloading a document. For authenticated company members.

**Auth**: Required. User must be a member of the company.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://s3.amazonaws.com/navia/documents/...?X-Amz-Signature=...",
    "expiresIn": 900
  }
}
```

---

### Public Document Download

#### GET /api/v1/profiles/:slug/documents/:documentId/download
**Description**: Generate a pre-signed download URL for a public profile document. Records a download event.

**Auth**: None required (but respects profile access controls — password/email).

**Headers**:
- `X-Profile-Password`: password (if password-protected)

**Query Parameters**:
- `email`: viewer email (if email-gated)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://s3.amazonaws.com/navia/documents/...?X-Amz-Signature=...",
    "expiresIn": 900
  }
}
```

---

## Business Rules

### BR-5: Document Storage Limit
- Total storage for all documents in a profile is capped at 500 MB
- Individual files are capped at 25 MB
- Exceeding either limit returns `413 Payload Too Large` or `422 Unprocessable Entity`

### BR-9: Document File Validation
- Files are validated by both MIME type and magic bytes (not just file extension)
- PDF page count is extracted server-side using a PDF parsing library
- Thumbnails are generated asynchronously via Bull job after upload

---

## Edge Cases & Error Handling

### EC-2: Document Upload During Publish
**Scenario**: User uploads a document while the profile is published.
**Handling**: Document is added immediately and visible to external viewers. No republish needed.

### EC-4: Large File Upload Timeout
**Scenario**: User uploads a 25 MB file on a slow connection.
**Handling**: Frontend shows upload progress bar. Backend accepts with a 60-second timeout for the upload endpoint. If timeout occurs, partial S3 upload is cleaned up via S3 lifecycle rule.

### EC-5: PDF Thumbnail Generation Fails
**Scenario**: Uploaded PDF is corrupt or password-protected, thumbnail generation fails.
**Handling**: Document is stored successfully. Thumbnail is null. Frontend shows a generic PDF icon instead.

---

## Dependencies

### Internal Dependencies
- **company-profile.md**: ProfileDocument belongs to CompanyProfile (foreign key relationship)
- **user-permissions.md**: ADMIN and FINANCE role checks for document management
- **authentication.md**: Authenticated endpoints require Privy JWT; public download respects profile access controls
- **audit-logging.md**: Document upload and deletion events are audit-logged
- **security.md**: File upload validation (MIME + magic bytes), EXIF stripping, S3 pre-signed URLs

### External Dependencies
- **AWS S3**: Document storage (`navia-profile-documents` bucket), thumbnail storage
  - SSE-S3 encryption (not KMS — profile documents are not high-sensitivity PII)
  - Pre-signed URLs with 15-minute expiry for downloads
  - Lifecycle rule: delete incomplete multipart uploads after 24 hours
- **Bull (Redis-backed)**: PDF thumbnail generation queue
  - Queue: `profile-thumbnails` — Retry: 2 attempts, 5-second backoff
- **sharp**: Image processing for EXIF stripping on image uploads
- **pdf-lib or pdf-parse**: PDF page count extraction and thumbnail generation

---

## Technical Implementation

### ProfileDocumentService

```typescript
// /backend/src/profile/profile-document.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import * as pdfParse from 'pdf-parse';

@Injectable()
export class ProfileDocumentService {
  private s3: S3Client;
  private bucket = 'navia-profile-documents';

  constructor(
    private prisma: PrismaService,
    @InjectQueue('profile-thumbnails') private thumbnailQueue: Queue,
  ) {
    this.s3 = new S3Client({ region: 'sa-east-1' });
  }

  async upload(
    profileId: string,
    userId: string,
    file: Express.Multer.File,
    category: string,
    name?: string,
  ) {
    // Validate total storage
    const currentStorage = await this.prisma.profileDocument.aggregate({
      where: { profileId },
      _sum: { fileSize: true },
    });
    const totalAfterUpload = (currentStorage._sum.fileSize || 0) + file.size;
    if (totalAfterUpload > 500 * 1024 * 1024) {
      throw new BusinessRuleException(
        'PROFILE_STORAGE_LIMIT',
        'errors.profile.storageLimit',
      );
    }

    // Upload to S3
    const fileKey = `profiles/${profileId}/${randomUUID()}-${sanitizeFilename(file.originalname)}`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));

    // Extract PDF page count
    let pageCount: number | null = null;
    if (file.mimetype === 'application/pdf') {
      try {
        const pdfData = await pdfParse(file.buffer);
        pageCount = pdfData.numpages;
      } catch {
        pageCount = null;
      }
    }

    // Get next order value
    const maxOrder = await this.prisma.profileDocument.aggregate({
      where: { profileId, category: category as any },
      _max: { order: true },
    });

    const document = await this.prisma.profileDocument.create({
      data: {
        profileId,
        name: name || file.originalname,
        category: category as any,
        fileKey,
        fileSize: file.size,
        mimeType: file.mimetype,
        pageCount,
        order: (maxOrder._max.order ?? -1) + 1,
        uploadedById: userId,
        uploadedAt: new Date(),
      },
    });

    // Queue thumbnail generation for PDFs
    if (file.mimetype === 'application/pdf') {
      await this.thumbnailQueue.add('generate', {
        documentId: document.id,
        fileKey,
      });
    }

    return document;
  }

  async delete(documentId: string) {
    const document = await this.prisma.profileDocument.findUniqueOrThrow({
      where: { id: documentId },
    });

    // Delete from S3
    await this.s3.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: document.fileKey,
    }));

    // Delete thumbnail from S3 if exists
    if (document.thumbnailKey) {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: document.thumbnailKey,
      }));
    }

    // Delete from database
    await this.prisma.profileDocument.delete({
      where: { id: documentId },
    });
  }

  async getDownloadUrl(documentId: string): Promise<string> {
    const document = await this.prisma.profileDocument.findUniqueOrThrow({
      where: { id: documentId },
    });

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: document.fileKey,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 900 }); // 15 minutes
  }

  async getPublicDownloadUrl(
    documentId: string,
    slug: string,
    viewerEmail?: string,
    viewerIp?: string,
  ): Promise<string> {
    const document = await this.prisma.profileDocument.findUniqueOrThrow({
      where: { id: documentId },
      include: { profile: { select: { id: true, slug: true } } },
    });

    // Verify the document belongs to this profile
    if (document.profile.slug !== slug) {
      throw new NotFoundException('Document not found');
    }

    // Record download event
    await this.prisma.profileDocumentDownload.create({
      data: {
        documentId,
        profileId: document.profileId,
        viewerEmail: viewerEmail || null,
        viewerIp: viewerIp || 'unknown',
      },
    });

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: document.fileKey,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 900 });
  }

  async reorder(profileId: string, documents: Array<{ id: string; order: number }>) {
    await this.prisma.$transaction(
      documents.map((doc) =>
        this.prisma.profileDocument.update({
          where: { id: doc.id, profileId },
          data: { order: doc.order },
        }),
      ),
    );

    return this.prisma.profileDocument.findMany({
      where: { profileId },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });
  }
}
```

### Document Controller Endpoints

These endpoints are registered in the `ProfileController` (see [company-profile.md](./company-profile.md)) or in a dedicated `ProfileDocumentController`:

```typescript
// /backend/src/profile/profile-document.controller.ts
import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  Headers, UseInterceptors, UploadedFile, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequireAuth } from '../auth/decorators/require-auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Auditable } from '../audit/auditable.decorator';

@Controller('api/v1')
export class ProfileDocumentController {
  constructor(
    private profileService: ProfileService,
    private documentService: ProfileDocumentService,
  ) {}

  @Post('companies/:companyId/profile/documents')
  @RequireAuth()
  @Roles('ADMIN', 'FINANCE')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  @HttpCode(HttpStatus.CREATED)
  @Auditable({ action: 'PROFILE_DOCUMENT_UPLOADED', resourceType: 'ProfileDocument', captureAfterState: true })
  async uploadDocument(
    @Param('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('category') category: string,
    @Body('name') name?: string,
  ) {
    const profile = await this.profileService.getByCompanyId(companyId);
    return this.documentService.upload(profile.id, /* userId */, file, category, name);
  }

  @Delete('companies/:companyId/profile/documents/:documentId')
  @RequireAuth()
  @Roles('ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Auditable({ action: 'PROFILE_DOCUMENT_DELETED', resourceType: 'ProfileDocument', captureBeforeState: true })
  async deleteDocument(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.documentService.delete(documentId);
  }

  @Put('companies/:companyId/profile/documents/order')
  @RequireAuth()
  @Roles('ADMIN', 'FINANCE')
  async reorderDocuments(
    @Param('companyId') companyId: string,
    @Body() dto: ReorderDocumentsDto,
  ) {
    const profile = await this.profileService.getByCompanyId(companyId);
    return this.documentService.reorder(profile.id, dto.documents);
  }

  @Get('companies/:companyId/profile/documents/:documentId/download')
  @RequireAuth()
  async downloadDocument(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
  ) {
    const url = await this.documentService.getDownloadUrl(documentId);
    return { downloadUrl: url, expiresIn: 900 };
  }

  @Get('profiles/:slug/documents/:documentId/download')
  @Public()
  async downloadPublicDocument(
    @Param('slug') slug: string,
    @Param('documentId') documentId: string,
    @Headers('x-profile-password') password?: string,
    @Query('email') email?: string,
  ) {
    await this.profileService.validatePublicAccess(slug, password, email);
    const url = await this.documentService.getPublicDownloadUrl(documentId, slug, email);
    return { downloadUrl: url, expiresIn: 900 };
  }
}
```

---

## Error Codes

### PROFILE — Document-Related Error Codes

| Code | messageKey | HTTP | PT-BR | EN |
|------|-----------|------|-------|-----|
| `PROFILE_STORAGE_LIMIT` | `errors.profile.storageLimit` | 422 | Limite de armazenamento de 500 MB excedido | 500 MB storage limit exceeded |

### Audit Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `PROFILE_DOCUMENT_UPLOADED` | ProfileDocument | USER | Document uploaded to dataroom |
| `PROFILE_DOCUMENT_DELETED` | ProfileDocument | USER | Document removed from dataroom |

---

## Security Considerations

### SEC-3: Document Security
- Documents are stored in a separate S3 bucket from internal company documents (`navia-profile-documents`)
- S3 bucket has BlockPublicAccess enabled
- All downloads go through pre-signed URLs generated by the backend
- File uploads validated by MIME type + magic bytes (not just extension)
- EXIF metadata stripped from image uploads

---

## Success Criteria

### Performance
- Document upload (25 MB): < 30 seconds
- Pre-signed URL generation: < 200ms
- Thumbnail generation: < 10 seconds after upload

### Accuracy
- PDF page count extraction: 99%+ accuracy for valid PDFs

### User Experience
- Document upload: drag-and-drop with progress indicator

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-profile.md](./company-profile.md) | ProfileDocument belongs to CompanyProfile; documents appear in the profile page and shared link |
| [document-generation.md](./document-generation.md) | Dataroom documents are separate from generated legal documents; different storage prefix |
| [reports-analytics.md](./reports-analytics.md) | Due diligence package (auto-generated ZIP) is distinct from dataroom (manually curated) |
| [user-permissions.md](./user-permissions.md) | Only ADMIN and FINANCE roles can upload/delete documents |
| [security.md](../.claude/rules/security.md) | File upload validation (MIME + magic bytes), EXIF stripping, S3 pre-signed URLs, BlockPublicAccess |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Document upload and deletion events are audit-logged |
| [api-standards.md](../.claude/rules/api-standards.md) | Endpoints follow standard envelope responses |
