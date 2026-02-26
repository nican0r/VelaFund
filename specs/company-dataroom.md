# Company Dataroom Specification

**Topic of Concern**: Document management for the company profile dataroom — upload, storage, download, categorization, thumbnail generation, and AI processing for investor-facing documents

**One-Sentence Description**: The system allows company admins to upload, organize, and serve documents (pitch decks, financials, legal documents, etc.) via the company profile dataroom, with categorization, PDF metadata extraction, thumbnail generation, secure pre-signed URL downloads, and optional AI processing for text extraction and embedding generation.

---

## Overview

The Company Dataroom is the document management subsystem of the Company Profile (see [company-profile.md](./company-profile.md)). It enables founders to upload and organize files that prospective investors can browse and download through the shareable profile link.

Dataroom documents are **manually curated** files uploaded by the company admin — they are distinct from:
- **Generated legal documents** (managed in `document-generation.md` / `document-signatures.md`)
- **Due diligence package exports** (auto-generated ZIPs from `reports-analytics.md`)

Documents are stored in a dedicated S3 bucket (`navia-profile-documents`) with SSE-S3 encryption, served via pre-signed URLs with 15-minute expiry. PDF files receive automatic page count extraction and first-page thumbnail generation via a background Bull job.

Uploaded documents can optionally be processed with AI to extract text and generate embeddings for downstream features (e.g., AI-powered Q&A, document search). AI processing is queued asynchronously via Bull and tracked per document with a dedicated status field.

---

## MVP Scope

### In Scope (MVP)
- **Upload with drag-drop zone**: Users can drag files onto a drop zone or click to browse, with progress indicator
- **Category selection**: Dropdown to assign a category (Pitch Deck, Financials, Legal, Product, Team, Other) during upload
- **Document list with category tabs**: Filterable view with one tab per category plus an "All" tab
- **Delete with confirmation**: ADMIN/FINANCE can delete documents with a confirmation dialog
- **PDF thumbnail display**: First-page thumbnail generated server-side, displayed in document list
- **Download via pre-signed URLs**: Authenticated download for company members
- **Public download for shared profile visitors**: Unauthenticated download through the public profile link, with download tracking
- **Storage usage indicator**: Visual bar showing used vs. total storage (500 MB limit)
- **AI processing trigger**: Manual or automatic queuing of documents for AI text extraction and embedding generation
- **AI processing status tracking**: Per-document status badge showing processing state (Pending, Processing, Completed, Failed)

### Out of Scope (Post-MVP)
- **Document reordering**: No drag-and-drop reorder. Documents are ordered by upload date (newest first) within each category
- **Document name editing after upload**: Name is set at upload time from the filename; cannot be changed afterwards
- **Inline PDF viewer**: No in-browser PDF preview. Users download the file to view it
- **Bulk upload**: Single file upload per operation
- **Document versioning**: No version history; delete and re-upload to replace
- **Access analytics dashboard**: Download tracking is recorded but no analytics UI in MVP
- **AI-powered Q&A interface**: Text extraction and embeddings are generated but the conversational AI interface is post-MVP

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

### US-4: Process Documents with AI
**As an** admin user
**I want to** trigger AI processing on uploaded documents
**So that** the platform can extract text and generate embeddings for future AI-powered features

### US-5: View AI Processing Status
**As an** admin user
**I want to** see the AI processing status of each document
**So that** I know which documents are ready for AI features and which need attention

---

## Frontend Specification

### Page Routing

The dataroom document management UI is accessible from two routes:

1. **Company Profile editor tab**: `/companies/:companyId/profile` — Documents tab within the profile editor. This is the primary entry point when editing the company profile.
2. **Standalone documents page**: `/companies/:companyId/documents` — Direct access from the sidebar navigation. Renders the same document management UI as the profile tab.

Both routes render the same `DataroomPage` component with identical functionality.

**Public profile route**: `/p/:slug` — The public-facing company profile includes a read-only documents section. Visitors can browse by category and download files, but cannot upload or delete.

### Dataroom Page Layout

```
+---------------------------------------------------------+
|  h1: Documentos             [+ Upload Document]          |
|  body-sm: Gerencie os documentos da sua empresa          |
+----------------------------------------------------------+
|  Category Tabs:                                          |
|  [Todos] [Pitch Deck] [Financeiro] [Juridico] [Produto] [Equipe] [Outros] |
+----------------------------------------------------------+
|  Storage: 45 MB / 500 MB used                            |
+----------------------------------------------------------+
|  Document Grid/List                                      |
|  +----------------------------------------------------+  |
|  | [Thumbnail] | Document Name.pdf      | 2.4 MB     |  |
|  |  or icon    | Pitch Deck * 12 pages  | 20/02/2026 |  |
|  |             | [AI: Completed]        | [DL] [DEL] |  |
|  +----------------------------------------------------+  |
|  +----------------------------------------------------+  |
|  | [Thumbnail] | Financials_Q4.xlsx     | 1.1 MB     |  |
|  |  or icon    | Financeiro             | 18/02/2026 |  |
|  |             | [AI: Pending]          | [DL] [DEL] |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
|  Empty State (when no docs in selected category):        |
|  "Nenhum documento nesta categoria"                      |
|  [Upload Document]                                       |
+----------------------------------------------------------+
```

**Layout details**:
- Page header follows the standard page header pattern (see design-system.md Section 5.5): title left-aligned, primary action button ("+ Upload Document") right-aligned
- Category tabs use shadcn/ui `Tabs` component, horizontally scrollable on mobile
- Storage usage bar sits below the tabs, using a `Progress` bar component with text label
- Document list is a vertical stack of document item cards, ordered by `uploadedAt` descending (newest first) within the selected category
- When the "Todos" (All) tab is active, documents are grouped by category with category headers, each group ordered by `uploadedAt` descending

### Upload Modal/Dialog

Triggered by the "+ Upload Document" button. Uses shadcn/ui `Dialog`.

```
+----------------------------------------+
|  Upload Document                    [X] |
+----------------------------------------+
|  +----------------------------------+  |
|  |                                   |  |
|  |  [cloud upload icon]              |  |
|  |  Arraste um arquivo ou clique     |  |
|  |  para selecionar                  |  |
|  |                                   |  |
|  |  PDF, PNG, JPG, XLSX, PPTX, DOCX |  |
|  |  Maximo 25 MB                     |  |
|  |                                   |  |
|  +----------------------------------+  |
|                                         |
|  Category: [Dropdown selector]          |
|  Name: [Auto-filled from filename]      |
|                                         |
|  -- Upload Progress --                  |
|  [xxxxxxxxxxxx--------] 65%            |
|                                         |
|  [Cancel]                   [Upload]    |
+----------------------------------------+
```

**Upload dialog behavior**:
1. User opens dialog via "+ Upload Document" button
2. User drags a file onto the drop zone or clicks to open the file browser
3. On file selection:
   - Frontend validates file type (PDF, PNG, JPG, JPEG, XLSX, PPTX, DOCX) and size (max 25 MB) immediately
   - If invalid: show inline error in the drop zone (red border, error message)
   - If valid: populate the "Name" field from the filename (without extension), show file icon/name in the drop zone
4. User selects a category from the dropdown (required, no default)
5. User optionally edits the display name
6. User clicks "Upload":
   - "Upload" button becomes disabled, shows spinner
   - Progress bar appears below the form fields showing upload percentage
   - On success: dialog closes, document list refreshes, success toast shown
   - On failure: error toast shown (file type, size, or storage limit error), dialog stays open for retry
7. "Cancel" button closes the dialog and aborts any in-progress upload

**Auto AI processing**: If `autoProcessWithAI` is enabled on the CompanyProfile (default true), the uploaded document is automatically queued for AI processing after successful upload. The document appears in the list with an AI status badge of "Pending" immediately.

**Drop zone states**:
- Default: dashed `gray-300` border, `gray-50` background, cloud upload icon in `gray-400`
- Drag hover: dashed `blue-600` border, `blue-50` background, icon color `blue-600`
- File selected: solid `gray-200` border, shows filename and file size, replace icon with file type icon
- Error: dashed `destructive` border, `red-50` background, error message below the zone

### Document Item Component

Each document is displayed as a horizontal card with the following layout:

```
+-------------------------------------------------------------+
|  +----------+  Document Name.pdf                 2,4 MB    |
|  | Thumbnail |  [Pitch Deck badge] * 12 paginas  20/02/2026|
|  |  64x64    |  [AI: Completed]                  [DL] [DEL]|
|  +----------+                                               |
+-------------------------------------------------------------+
```

**Thumbnail/icon** (64x64px, `radius-md`):
- PDF files with a successful thumbnail: display the S3 thumbnail image (loaded via the `thumbnailKey` pre-signed URL)
- PDF files without a thumbnail (generation failed or pending): `FileText` Lucide icon in `red-500` on `gray-50` background
- XLSX/XLS files: `Sheet` Lucide icon in `green-600` on `gray-50` background
- PPTX/PPT files: `Presentation` Lucide icon in `orange-500` on `gray-50` background
- DOCX/DOC files: `FileText` Lucide icon in `blue-600` on `gray-50` background
- Image files (PNG, JPG, JPEG): `Image` Lucide icon in `gray-500` on `gray-50` background

**Metadata display**:
- **Document name**: `body` (14px), `gray-800`, truncated with ellipsis if too long (max 1 line)
- **Category badge**: Colored pill badge (see design-system.md Section 6.5) using the category label
- **Page count** (PDFs only): " * {n} paginas" appended after the category badge, `body-sm`, `gray-500`
- **AI processing status badge**: Displayed on the second line below the category badge (see [AI Processing Status Badges](#ai-processing-status-badges))
- **File size**: Formatted in Brazilian style ("2,4 MB"), `body-sm`, `gray-500`, right-aligned
- **Upload date**: `dd/MM/yyyy` format, `body-sm`, `gray-500`, right-aligned

**Action buttons** (right side, visible on hover for desktop, always visible on mobile):
- **Download**: Ghost icon button with `Download` Lucide icon. On click, fetches pre-signed URL via `useDocumentDownloadUrl` and opens in a new tab.
- **Process with AI**: Ghost icon button with `Sparkles` Lucide icon in `gray-500`, hover `blue-600`. Only visible when `aiProcessingStatus` is `PENDING` or `FAILED`. Only visible to ADMIN and FINANCE roles. On click, calls `useProcessDocumentWithAI` mutation.
- **Delete**: Ghost icon button with `Trash2` Lucide icon in `gray-500`, hover `destructive`. Only visible to ADMIN and FINANCE roles. On click, opens the delete confirmation dialog.

**Category badge colors**:
| Category | Background | Text |
|----------|-----------|------|
| Pitch Deck | `blue-50` | `blue-600` |
| Financeiro | `green-100` | `green-700` |
| Juridico | `cream-100` | `cream-700` |
| Produto | `navy-50` | `navy-700` |
| Equipe | `blue-100` | `blue-700` |
| Outros | `gray-100` | `gray-600` |

### AI Processing Status Badges

Each document displays an AI processing status badge below the category badge. The badge is only visible to authenticated company members (not on the public profile view).

| Status | Background | Text/Icon | Display |
|--------|-----------|-----------|---------|
| `PENDING` | `gray-100` | `gray-500` text, no icon | "IA: Pendente" |
| `PROCESSING` | `blue-50` | `blue-600` text, animated spinner icon (16px) | "IA: Processando..." |
| `COMPLETED` | `green-100` | `green-700` text, `Check` Lucide icon (14px) | "IA: Concluido" |
| `FAILED` | `red-50` (`#FEE2E2`) | `destructive-text` (`#991B1B`), `X` Lucide icon (14px) | "IA: Falhou" |

**Badge behavior**:
- Badge size: `caption` (12px), weight 500, padding `2px 8px`, `radius-full` (pill)
- When status is `PROCESSING`, the spinner animates continuously. The frontend polls the document list every 5 seconds while any document in the list has `PROCESSING` status.
- When status is `FAILED`, hovering the badge shows a tooltip: "O processamento falhou. Clique no botao de IA para tentar novamente."
- When status is `COMPLETED`, the badge also shows the chunk count if available: "IA: Concluido (24 chunks)"

### Delete Confirmation Dialog

Uses shadcn/ui `AlertDialog`.

```
+----------------------------------------+
|  Excluir Documento                      |
|                                         |
|  Tem certeza que deseja excluir         |
|  "LuminaTech_PitchDeck.pdf"?            |
|  Esta acao nao pode ser desfeita.       |
|                                         |
|  [Cancelar]          [Excluir] (red)    |
+----------------------------------------+
```

- Document name displayed in bold within the confirmation message
- "Excluir" button uses `destructive` variant
- On confirm: calls `useDeleteDocument` mutation, shows success toast on completion, refreshes document list
- On cancel: closes dialog, no action taken

### Storage Usage Bar

Displays current storage usage relative to the 500 MB limit.

- Uses shadcn/ui `Progress` component
- Label format: "{used} MB / 500 MB utilizados" (e.g., "45 MB / 500 MB utilizados")
- Bar color: `blue-600` when under 80%, `cream-600` (warning) at 80-95%, `destructive` at 95%+
- Sizes are formatted in Brazilian number format (comma as decimal separator)

### Public Profile Document View

The public profile page (`/p/:slug`) includes a read-only document section.

**Layout**: Same category tabs and document list as the management view, but:
- No "+ Upload Document" button
- No delete buttons on document items
- No storage usage bar
- No AI processing status badges (AI status is internal only)
- No "Process with AI" buttons
- Download button is always visible (not hover-only)
- Download triggers the public download endpoint (`GET /api/v1/profiles/:slug/documents/:documentId/download`) which records a `ProfileDocumentDownload` event

**Access control**: Respects the profile's access settings (password protection, email gating). If the profile requires a password or email, the visitor must provide it before seeing documents (handled at the profile level, not per-document).

### Component List

| Component | File Path | Description |
|-----------|-----------|-------------|
| `DataroomPage` | `frontend/src/app/(dashboard)/companies/[companyId]/documents/page.tsx` | Standalone page wrapper, fetches data and renders the document management UI |
| `DocumentCategoryTabs` | `frontend/src/components/dataroom/DocumentCategoryTabs.tsx` | Horizontal tab bar for filtering by category. Uses shadcn/ui `Tabs`. Tabs: Todos, Pitch Deck, Financeiro, Juridico, Produto, Equipe, Outros |
| `DocumentList` | `frontend/src/components/dataroom/DocumentList.tsx` | Renders the list of `DocumentItem` components, handles grouping by category when "Todos" tab is active |
| `DocumentItem` | `frontend/src/components/dataroom/DocumentItem.tsx` | Single document card with thumbnail, metadata, AI status badge, and action buttons |
| `DocumentUploadDialog` | `frontend/src/components/dataroom/DocumentUploadDialog.tsx` | Modal dialog containing the drop zone, category selector, name input, and upload progress |
| `DocumentDropZone` | `frontend/src/components/dataroom/DocumentDropZone.tsx` | Drag-and-drop file area with visual states (default, hover, selected, error). Uses native HTML5 drag events |
| `DocumentUploadProgress` | `frontend/src/components/dataroom/DocumentUploadProgress.tsx` | Progress bar with percentage label, shown during active upload |
| `DocumentDeleteDialog` | `frontend/src/components/dataroom/DocumentDeleteDialog.tsx` | Confirmation dialog for document deletion. Uses shadcn/ui `AlertDialog` |
| `DocumentTypeIcon` | `frontend/src/components/dataroom/DocumentTypeIcon.tsx` | Maps MIME type to the appropriate Lucide icon and color |
| `StorageUsageBar` | `frontend/src/components/dataroom/StorageUsageBar.tsx` | Progress bar showing storage used vs. 500 MB limit with color thresholds |
| `DocumentEmptyState` | `frontend/src/components/dataroom/DocumentEmptyState.tsx` | Empty state illustration with message and upload CTA button |
| `AIProcessingBadge` | `frontend/src/components/dataroom/AIProcessingBadge.tsx` | Pill badge showing AI processing status with icon and label. Handles all four states (PENDING, PROCESSING, COMPLETED, FAILED) |

### TanStack Query Hooks

```typescript
// frontend/src/hooks/use-profile-documents.ts

/**
 * useProfileDocuments(companyId: string)
 * Fetches all documents for the company profile.
 * GET /api/v1/companies/:companyId/profile/documents
 * Returns: ProfileDocument[]
 * Query key: ['profile-documents', companyId]
 * Refetch: on window focus, after upload/delete mutations
 * Polling: refetchInterval 5000ms when any document has aiProcessingStatus === 'PROCESSING'
 */

/**
 * useUploadDocument(companyId: string)
 * Mutation: POST /api/v1/companies/:companyId/profile/documents
 * Content-Type: multipart/form-data
 * Body: { file, category, name? }
 * onSuccess: invalidate ['profile-documents', companyId], show success toast
 * onError: show error toast with messageKey translation
 * Supports upload progress tracking via XMLHttpRequest or fetch with ReadableStream
 */

/**
 * useDeleteDocument(companyId: string)
 * Mutation: DELETE /api/v1/companies/:companyId/profile/documents/:documentId
 * onSuccess: invalidate ['profile-documents', companyId], show success toast
 * onError: show error toast with messageKey translation
 */

/**
 * useDocumentDownloadUrl(companyId: string, documentId: string)
 * Lazy query (enabled: false by default, triggered on demand)
 * GET /api/v1/companies/:companyId/profile/documents/:documentId/download
 * Returns: { downloadUrl: string, expiresIn: number }
 * On success: open downloadUrl in new tab via window.open()
 * No caching (staleTime: 0) — pre-signed URLs expire
 */

/**
 * useProcessDocumentWithAI(companyId: string)
 * Mutation: POST /api/v1/companies/:companyId/profile/documents/:documentId/process
 * onSuccess: invalidate ['profile-documents', companyId], show info toast "Documento enviado para processamento"
 * onError: show error toast with messageKey translation
 * Returns 202 Accepted — processing happens asynchronously
 */
```

### Loading States

- **Initial page load**: Skeleton cards matching the document item layout — a `gray-200` pulsing rectangle (64x64) for the thumbnail, two skeleton lines for name/metadata, and small rectangles for action buttons. Show 3 skeleton cards.
- **Upload in progress**: Progress bar with percentage inside the upload dialog. "Upload" button disabled with spinner. Drop zone shows the selected filename.
- **Download in progress**: Download icon button shows a spinner while the pre-signed URL is being fetched (typically < 200ms).
- **Delete in progress**: "Excluir" button in the confirmation dialog shows a spinner and is disabled until the mutation completes.
- **AI processing trigger**: "Process with AI" icon button shows a brief spinner while the POST request completes. On success, the AI status badge transitions from PENDING/FAILED to PROCESSING.

### Error States

| Error | Display | Recovery |
|-------|---------|----------|
| Invalid file type selected | Inline error in drop zone: "Tipo de arquivo nao suportado. Use PDF, PNG, JPG, XLSX, PPTX ou DOCX" | User selects a different file |
| File exceeds 25 MB | Inline error in drop zone: "Arquivo excede o limite de 25 MB" | User selects a smaller file |
| Storage limit exceeded (500 MB) | Error toast: "Limite de armazenamento de 500 MB excedido" | User deletes existing documents to free space |
| Upload network failure | Error toast: "Falha ao enviar documento. Tente novamente." | User retries upload |
| Delete failure | Error toast: "Falha ao excluir documento. Tente novamente." | User retries delete |
| Download URL generation failure | Error toast: "Falha ao gerar link de download. Tente novamente." | User retries download |
| Document list fetch failure | Error state in document list area with retry button | User clicks retry |
| AI processing trigger failure | Error toast: "Falha ao iniciar processamento de IA. Tente novamente." | User retries via "Process with AI" button |
| AI document unsupported type | Error toast: "Tipo de arquivo nao suportado para processamento de IA" | User cannot process this file type; only PDF, DOCX, PPTX, XLSX supported |
| AI processing already in progress | Warning toast: "Documento ja esta sendo processado" | User waits for current processing to complete |

### Empty States

**No documents at all** (company has zero documents uploaded):
- Centered illustration (document/folder icon, 64px, `gray-300`)
- Title: "Nenhum documento" (`h3`, `gray-700`)
- Description: "Adicione documentos ao seu dataroom para compartilhar com investidores" (`body`, `gray-500`, max-width 400px)
- CTA: "Upload Document" button (primary variant)

**No documents in selected category** (other categories have documents):
- Centered, smaller than the full empty state
- Text: "Nenhum documento nesta categoria" (`body`, `gray-500`)
- CTA: "Upload Document" button (secondary variant)

### Frontend i18n Keys

All user-facing strings must be added to both `messages/pt-BR.json` and `messages/en.json`.

**PT-BR translations**:

| Key | PT-BR Value |
|-----|-------------|
| `dataroom.title` | Documentos |
| `dataroom.subtitle` | Gerencie os documentos da sua empresa |
| `dataroom.upload.title` | Upload de Documento |
| `dataroom.upload.dropzone` | Arraste um arquivo ou clique para selecionar |
| `dataroom.upload.formats` | PDF, PNG, JPG, XLSX, PPTX, DOCX |
| `dataroom.upload.maxSize` | Maximo 25 MB |
| `dataroom.upload.button` | Enviar |
| `dataroom.upload.progress` | Enviando... {percent}% |
| `dataroom.upload.success` | Documento enviado com sucesso |
| `dataroom.upload.error` | Falha ao enviar documento. Tente novamente. |
| `dataroom.upload.invalidType` | Tipo de arquivo nao suportado. Use PDF, PNG, JPG, XLSX, PPTX ou DOCX |
| `dataroom.upload.tooLarge` | Arquivo excede o limite de 25 MB |
| `dataroom.upload.nameLabel` | Nome |
| `dataroom.upload.categoryLabel` | Categoria |
| `dataroom.category.all` | Todos |
| `dataroom.category.pitchDeck` | Pitch Deck |
| `dataroom.category.financials` | Financeiro |
| `dataroom.category.legal` | Juridico |
| `dataroom.category.product` | Produto |
| `dataroom.category.team` | Equipe |
| `dataroom.category.other` | Outros |
| `dataroom.document.pages` | {count} paginas |
| `dataroom.document.page` | 1 pagina |
| `dataroom.document.download` | Baixar |
| `dataroom.document.delete` | Excluir |
| `dataroom.document.processAI` | Processar com IA |
| `dataroom.delete.title` | Excluir Documento |
| `dataroom.delete.message` | Tem certeza que deseja excluir "{name}"? Esta acao nao pode ser desfeita. |
| `dataroom.delete.confirm` | Excluir |
| `dataroom.delete.cancel` | Cancelar |
| `dataroom.delete.success` | Documento excluido com sucesso |
| `dataroom.delete.error` | Falha ao excluir documento. Tente novamente. |
| `dataroom.storage.label` | {used} MB / {total} MB utilizados |
| `dataroom.empty.title` | Nenhum documento |
| `dataroom.empty.message` | Adicione documentos ao seu dataroom para compartilhar com investidores |
| `dataroom.empty.action` | Upload de Documento |
| `dataroom.empty.categoryMessage` | Nenhum documento nesta categoria |
| `dataroom.download.error` | Falha ao gerar link de download. Tente novamente. |
| `dataroom.ai.pending` | IA: Pendente |
| `dataroom.ai.processing` | IA: Processando... |
| `dataroom.ai.completed` | IA: Concluido |
| `dataroom.ai.completedWithChunks` | IA: Concluido ({count} chunks) |
| `dataroom.ai.failed` | IA: Falhou |
| `dataroom.ai.failedTooltip` | O processamento falhou. Clique no botao de IA para tentar novamente. |
| `dataroom.ai.queued` | Documento enviado para processamento |
| `dataroom.ai.triggerError` | Falha ao iniciar processamento de IA. Tente novamente. |
| `dataroom.ai.unsupportedType` | Tipo de arquivo nao suportado para processamento de IA |
| `dataroom.ai.alreadyProcessing` | Documento ja esta sendo processado |

**EN translations**:

| Key | EN Value |
|-----|----------|
| `dataroom.title` | Documents |
| `dataroom.subtitle` | Manage your company documents |
| `dataroom.upload.title` | Upload Document |
| `dataroom.upload.dropzone` | Drag a file or click to browse |
| `dataroom.upload.formats` | PDF, PNG, JPG, XLSX, PPTX, DOCX |
| `dataroom.upload.maxSize` | Maximum 25 MB |
| `dataroom.upload.button` | Upload |
| `dataroom.upload.progress` | Uploading... {percent}% |
| `dataroom.upload.success` | Document uploaded successfully |
| `dataroom.upload.error` | Failed to upload document. Please try again. |
| `dataroom.upload.invalidType` | Unsupported file type. Use PDF, PNG, JPG, XLSX, PPTX or DOCX |
| `dataroom.upload.tooLarge` | File exceeds the 25 MB limit |
| `dataroom.upload.nameLabel` | Name |
| `dataroom.upload.categoryLabel` | Category |
| `dataroom.category.all` | All |
| `dataroom.category.pitchDeck` | Pitch Deck |
| `dataroom.category.financials` | Financials |
| `dataroom.category.legal` | Legal |
| `dataroom.category.product` | Product |
| `dataroom.category.team` | Team |
| `dataroom.category.other` | Other |
| `dataroom.document.pages` | {count} pages |
| `dataroom.document.page` | 1 page |
| `dataroom.document.download` | Download |
| `dataroom.document.delete` | Delete |
| `dataroom.document.processAI` | Process with AI |
| `dataroom.delete.title` | Delete Document |
| `dataroom.delete.message` | Are you sure you want to delete "{name}"? This action cannot be undone. |
| `dataroom.delete.confirm` | Delete |
| `dataroom.delete.cancel` | Cancel |
| `dataroom.delete.success` | Document deleted successfully |
| `dataroom.delete.error` | Failed to delete document. Please try again. |
| `dataroom.storage.label` | {used} MB / {total} MB used |
| `dataroom.empty.title` | No documents |
| `dataroom.empty.message` | Add documents to your dataroom to share with investors |
| `dataroom.empty.action` | Upload Document |
| `dataroom.empty.categoryMessage` | No documents in this category |
| `dataroom.download.error` | Failed to generate download link. Please try again. |
| `dataroom.ai.pending` | AI: Pending |
| `dataroom.ai.processing` | AI: Processing... |
| `dataroom.ai.completed` | AI: Completed |
| `dataroom.ai.completedWithChunks` | AI: Completed ({count} chunks) |
| `dataroom.ai.failed` | AI: Failed |
| `dataroom.ai.failedTooltip` | Processing failed. Click the AI button to try again. |
| `dataroom.ai.queued` | Document queued for AI processing |
| `dataroom.ai.triggerError` | Failed to start AI processing. Please try again. |
| `dataroom.ai.unsupportedType` | File type not supported for AI processing |
| `dataroom.ai.alreadyProcessing` | Document is already being processed |

### Accessibility Requirements

- Upload drop zone is keyboard accessible: focusable with `tabindex="0"`, activates file browser on `Enter` or `Space`
- Category tabs support keyboard navigation with arrow keys
- All action buttons have `aria-label` attributes (e.g., `aria-label="Download Document Name.pdf"`, `aria-label="Process Document Name.pdf with AI"`)
- Delete confirmation dialog traps focus when open
- Upload progress is announced to screen readers via `aria-live="polite"` region
- File type icons have `aria-hidden="true"` (decorative, the file name provides context)
- Empty states use `role="status"` for screen reader announcement
- AI processing status badge has `aria-label` describing the current state (e.g., `aria-label="AI processing status: Completed"`)
- When AI processing status changes from PROCESSING to COMPLETED or FAILED, the change is announced via `aria-live="polite"`

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
  - `aiProcessingStatus`: current AI processing state (PENDING, PROCESSING, COMPLETED, FAILED)
  - `aiProcessedAt`: timestamp when AI processing completed (null if not yet processed)
  - `extractedTextKey`: S3 key for extracted text file (null if not yet processed)
  - `chunkCount`: number of embedding chunks generated (null if not yet processed)
- Allowed file types: PDF, PNG, JPG, JPEG, XLSX, PPTX, DOCX
- Maximum file size: 25 MB per file
- Maximum total storage per company profile: 500 MB
- System MUST generate a thumbnail preview for PDF first pages
- System MUST extract page count from uploaded PDFs
- Documents are served via pre-signed S3 URLs (15-minute expiry) — never directly public

### FR-5: AI Document Processing
- System MUST support queuing documents for AI text extraction and embedding generation
- AI processing is triggered either:
  - **Automatically** on upload, when `CompanyProfile.autoProcessWithAI` is `true` (default)
  - **Manually** via the "Process with AI" button on individual documents
- Supported file types for AI processing: PDF, DOCX, PPTX, XLSX (image files PNG/JPG are not supported for text extraction)
- AI processing is asynchronous via Bull queue (`ai-document-processing`)
- Processing pipeline:
  1. Extract raw text from the document (PDF text extraction, DOCX/PPTX/XLSX parsing)
  2. Store extracted text in S3 (`navia-profile-documents/extracted/{documentId}.txt`)
  3. Chunk text into segments suitable for embedding (target ~500 tokens per chunk)
  4. Generate embeddings for each chunk (embedding model and storage are handled by downstream AI services)
  5. Update `ProfileDocument` with `aiProcessingStatus = COMPLETED`, `aiProcessedAt`, `extractedTextKey`, and `chunkCount`
- On processing failure: set `aiProcessingStatus = FAILED`, log the error, allow manual retry
- Deleting a document also deletes its extracted text from S3 and any associated embeddings

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
  aiProcessingStatus: AIProcessingStatus; // AI processing state
  aiProcessedAt: Date | null;          // When AI processing completed
  extractedTextKey: string | null;     // S3 key for extracted text file
  chunkCount: number | null;           // Number of embedding chunks generated
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

enum AIProcessingStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
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

### CompanyProfile Addition

The following field is added to the existing `CompanyProfile` model (defined in `company-profile.md`):

```typescript
interface CompanyProfile {
  // ... existing fields ...
  autoProcessWithAI: boolean;          // Whether to auto-queue docs for AI processing on upload (default true)
}
```

### Prisma Schema

```prisma
model ProfileDocument {
  id                  String              @id @default(uuid())
  profileId           String              @map("profile_id")
  name                String
  category            DocumentCategory
  fileKey             String              @map("file_key")
  fileSize            Int                 @map("file_size")
  mimeType            String              @map("mime_type")
  pageCount           Int?                @map("page_count")
  thumbnailKey        String?             @map("thumbnail_key")
  order               Int                 @default(0)
  aiProcessingStatus  AIProcessingStatus  @default(PENDING) @map("ai_processing_status")
  aiProcessedAt       DateTime?           @map("ai_processed_at")
  extractedTextKey    String?             @map("extracted_text_key")
  chunkCount          Int?                @map("chunk_count")
  uploadedById        String              @map("uploaded_by_id")
  uploadedAt          DateTime            @map("uploaded_at")
  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt @map("updated_at")

  profile      CompanyProfile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  uploadedBy   User             @relation(fields: [uploadedById], references: [id])
  downloads    ProfileDocumentDownload[]

  @@index([profileId, category, order])
  @@index([profileId, aiProcessingStatus])
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

enum AIProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}
```

**CompanyProfile schema addition** (add to existing model in `company-profile.md`):

```prisma
model CompanyProfile {
  // ... existing fields ...
  autoProcessWithAI Boolean @default(true) @map("auto_process_with_ai")
}
```

---

## API Endpoints

### Document Upload

#### POST /api/v1/companies/:companyId/profile/documents
**Description**: Upload a document to the dataroom. If `autoProcessWithAI` is enabled on the profile, the document is automatically queued for AI processing after upload.

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
    "aiProcessingStatus": "PENDING",
    "aiProcessedAt": null,
    "chunkCount": null,
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
**Description**: Remove a document from the dataroom. Deletes the file from S3, thumbnail from S3, and extracted text from S3 (if present).

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

#### POST /api/v1/companies/:companyId/profile/documents/:documentId/process
**Description**: Queue a document for AI processing (text extraction and embedding generation). Returns immediately with 202 Accepted. Processing happens asynchronously via Bull queue.

**Auth**: Required. User must be ADMIN or FINANCE.

**Validation**:
- Document must exist and belong to the company's profile
- Document MIME type must be supported for AI processing (PDF, DOCX, PPTX, XLSX)
- Document must not already be in `PROCESSING` status

**Response** (202 Accepted):
```json
{
  "success": true,
  "data": {
    "id": "doc_001",
    "aiProcessingStatus": "PROCESSING",
    "message": "Document queued for AI processing"
  }
}
```

**Error Responses**:
- `404 Not Found` — Document not found or not in this company
- `409 Conflict` — Document is already being processed (`AI_PROCESSING_IN_PROGRESS`)
- `422 Unprocessable Entity` — File type not supported for AI processing (`AI_DOCUMENT_UNSUPPORTED_TYPE`)

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

### BR-10: AI Processing Eligibility
- Only documents with MIME types `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX), `application/vnd.openxmlformats-officedocument.presentationml.presentation` (PPTX), and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX) are eligible for AI processing
- Image files (PNG, JPG, JPEG) are not supported for AI text extraction in MVP
- Re-processing a document that is already `COMPLETED` is allowed — it overwrites the previous extracted text and embeddings
- Re-processing a document that is `PROCESSING` is blocked with a 409 Conflict

### BR-11: Auto AI Processing
- When `CompanyProfile.autoProcessWithAI` is `true` (default), uploading a document automatically queues it for AI processing if the file type is eligible
- When `autoProcessWithAI` is `false`, documents are uploaded with `aiProcessingStatus = PENDING` and must be manually triggered
- Ineligible file types (images) are always uploaded with `aiProcessingStatus = PENDING` regardless of the auto-process setting, since they cannot be processed

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

### EC-6: AI Processing Fails
**Scenario**: AI text extraction fails due to corrupt/encrypted document or downstream service error.
**Handling**: `aiProcessingStatus` is set to `FAILED`. The error is logged to the Bull job's failure metadata. The user sees a "Failed" badge and can retry via the "Process with AI" button. The document remains fully functional for download regardless of AI processing status.

### EC-7: Document Deleted During AI Processing
**Scenario**: User deletes a document while it is being processed by AI.
**Handling**: The document is deleted from the database and S3 immediately. When the AI processing Bull job completes and tries to update the document, it finds no record and silently discards the result (job completes without error). Any partially written extracted text in S3 is cleaned up by the delete operation if the key was already set.

### EC-8: Auto AI Processing with Unsupported File Type
**Scenario**: User uploads a PNG file with `autoProcessWithAI` enabled.
**Handling**: The document is uploaded successfully. Since PNG is not eligible for AI processing, the `aiProcessingStatus` remains `PENDING` and no job is queued. The "Process with AI" button on the document will show the unsupported type error if clicked manually.

---

## Dependencies

### Internal Dependencies
- **company-profile.md**: ProfileDocument belongs to CompanyProfile (foreign key relationship); `autoProcessWithAI` field on CompanyProfile
- **user-permissions.md**: ADMIN and FINANCE role checks for document management
- **authentication.md**: Authenticated endpoints require Privy JWT; public download respects profile access controls
- **audit-logging.md**: Document upload, deletion, and AI processing events are audit-logged
- **security.md**: File upload validation (MIME + magic bytes), EXIF stripping, S3 pre-signed URLs

### External Dependencies
- **AWS S3**: Document storage (`navia-profile-documents` bucket), thumbnail storage, extracted text storage
  - SSE-S3 encryption (not KMS — profile documents are not high-sensitivity PII)
  - Pre-signed URLs with 15-minute expiry for downloads
  - Lifecycle rule: delete incomplete multipart uploads after 24 hours
  - Extracted text stored under `extracted/` prefix in the same bucket
- **Bull (Redis-backed)**: PDF thumbnail generation queue and AI document processing queue
  - Queue `profile-thumbnails`: Retry 2 attempts, 5-second backoff
  - Queue `ai-document-processing`: Retry 3 attempts, exponential backoff (5s, 15s, 45s), 5-minute job timeout
- **sharp**: Image processing for EXIF stripping on image uploads
- **pdf-lib or pdf-parse**: PDF page count extraction and thumbnail generation
- **pdf-parse / mammoth / xlsx**: Text extraction from PDF, DOCX, XLSX files for AI processing

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

const AI_PROCESSABLE_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

@Injectable()
export class ProfileDocumentService {
  private s3: S3Client;
  private bucket = 'navia-profile-documents';

  constructor(
    private prisma: PrismaService,
    @InjectQueue('profile-thumbnails') private thumbnailQueue: Queue,
    @InjectQueue('ai-document-processing') private aiProcessingQueue: Queue,
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
        aiProcessingStatus: 'PENDING',
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

    // Auto-queue AI processing if enabled and file type is supported
    const profile = await this.prisma.companyProfile.findUnique({
      where: { id: profileId },
      select: { autoProcessWithAI: true },
    });

    if (
      profile?.autoProcessWithAI &&
      AI_PROCESSABLE_MIME_TYPES.includes(file.mimetype)
    ) {
      await this.queueAIProcessing(document.id, fileKey, file.mimetype);
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

    // Delete extracted text from S3 if exists
    if (document.extractedTextKey) {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: document.extractedTextKey,
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

  async triggerAIProcessing(documentId: string): Promise<void> {
    const document = await this.prisma.profileDocument.findUniqueOrThrow({
      where: { id: documentId },
    });

    // Validate MIME type is supported for AI processing
    if (!AI_PROCESSABLE_MIME_TYPES.includes(document.mimeType)) {
      throw new BusinessRuleException(
        'AI_DOCUMENT_UNSUPPORTED_TYPE',
        'errors.ai.documentUnsupportedType',
        { mimeType: document.mimeType },
      );
    }

    // Prevent re-processing if already in progress
    if (document.aiProcessingStatus === 'PROCESSING') {
      throw new ConflictException(
        'AI_PROCESSING_IN_PROGRESS',
        'errors.ai.processingInProgress',
        { documentId },
      );
    }

    await this.queueAIProcessing(document.id, document.fileKey, document.mimeType);
  }

  private async queueAIProcessing(
    documentId: string,
    fileKey: string,
    mimeType: string,
  ): Promise<void> {
    // Update status to PROCESSING
    await this.prisma.profileDocument.update({
      where: { id: documentId },
      data: { aiProcessingStatus: 'PROCESSING' },
    });

    // Queue the job
    await this.aiProcessingQueue.add(
      'process-document',
      {
        documentId,
        fileKey,
        mimeType,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 15s, 45s
        },
        timeout: 5 * 60 * 1000, // 5 minutes
      },
    );
  }
}
```

### AI Document Processing Worker

```typescript
// /backend/src/profile/ai-document-processing.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

@Processor('ai-document-processing')
export class AIDocumentProcessingProcessor {
  private s3: S3Client;
  private bucket = 'navia-profile-documents';

  constructor(private prisma: PrismaService) {
    this.s3 = new S3Client({ region: 'sa-east-1' });
  }

  @Process('process-document')
  async handleProcessDocument(job: Job<{
    documentId: string;
    fileKey: string;
    mimeType: string;
  }>) {
    const { documentId, fileKey, mimeType } = job.data;

    try {
      // Verify document still exists (may have been deleted during processing)
      const document = await this.prisma.profileDocument.findUnique({
        where: { id: documentId },
      });
      if (!document) {
        return; // Document deleted, silently discard
      }

      // 1. Download file from S3
      const fileResponse = await this.s3.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      }));
      const fileBuffer = Buffer.from(await fileResponse.Body.transformToByteArray());

      // 2. Extract text based on MIME type
      const extractedText = await this.extractText(fileBuffer, mimeType);

      // 3. Store extracted text in S3
      const extractedTextKey = `extracted/${documentId}.txt`;
      await this.s3.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: extractedTextKey,
        Body: extractedText,
        ContentType: 'text/plain; charset=utf-8',
      }));

      // 4. Chunk text for embeddings
      const chunks = this.chunkText(extractedText);

      // 5. Generate embeddings (delegate to embedding service)
      // await this.embeddingService.generateAndStore(documentId, chunks);

      // 6. Update document record
      await this.prisma.profileDocument.update({
        where: { id: documentId },
        data: {
          aiProcessingStatus: 'COMPLETED',
          aiProcessedAt: new Date(),
          extractedTextKey,
          chunkCount: chunks.length,
        },
      });
    } catch (error) {
      // Update status to FAILED
      await this.prisma.profileDocument.update({
        where: { id: documentId },
        data: { aiProcessingStatus: 'FAILED' },
      }).catch(() => {
        // Document may have been deleted — ignore update failure
      });

      throw error; // Re-throw to trigger Bull retry
    }
  }

  private async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        // Use pdf-parse for text extraction
        const pdfData = await require('pdf-parse')(buffer);
        return pdfData.text;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // Use mammoth for DOCX
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        // PPTX extraction (use pptx-parser or similar)
        // Implementation delegated to a specialized utility
        return ''; // Placeholder
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        // Use xlsx for spreadsheet text extraction
        const XLSX = require('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheets = workbook.SheetNames.map((name: string) =>
          XLSX.utils.sheet_to_csv(workbook.Sheets[name]),
        );
        return sheets.join('\n\n');
      default:
        throw new Error(`Unsupported MIME type for text extraction: ${mimeType}`);
    }
  }

  private chunkText(text: string, targetTokens: number = 500): string[] {
    // Simple chunking by paragraphs, targeting ~500 tokens per chunk
    // A more sophisticated implementation may use recursive character splitting
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const estimatedTokens = (currentChunk + paragraph).length / 4; // rough estimate
      if (estimatedTokens > targetTokens && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
      } else {
        currentChunk += '\n\n' + paragraph;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
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

  @Post('companies/:companyId/profile/documents/:documentId/process')
  @RequireAuth()
  @Roles('ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.ACCEPTED)
  @Auditable({ action: 'PROFILE_DOCUMENT_AI_PROCESSING_TRIGGERED', resourceType: 'ProfileDocument', resourceIdParam: 'documentId' })
  async triggerAIProcessing(
    @Param('companyId') companyId: string,
    @Param('documentId') documentId: string,
  ) {
    await this.documentService.triggerAIProcessing(documentId);
    return {
      id: documentId,
      aiProcessingStatus: 'PROCESSING',
      message: 'Document queued for AI processing',
    };
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

### PROFILE -- Document-Related Error Codes

| Code | messageKey | HTTP | PT-BR | EN |
|------|-----------|------|-------|-----|
| `PROFILE_STORAGE_LIMIT` | `errors.profile.storageLimit` | 422 | Limite de armazenamento de 500 MB excedido | 500 MB storage limit exceeded |

### AI -- AI Processing Error Codes

| Code | messageKey | HTTP | PT-BR | EN |
|------|-----------|------|-------|-----|
| `AI_PROCESSING_QUEUED` | `errors.ai.processingQueued` | — (info, not an error) | Documento enviado para processamento de IA | Document queued for AI processing |
| `AI_DOCUMENT_UNSUPPORTED_TYPE` | `errors.ai.documentUnsupportedType` | 422 | Tipo de arquivo nao suportado para processamento de IA | File type not supported for AI processing |
| `AI_PROCESSING_IN_PROGRESS` | `errors.ai.processingInProgress` | 409 | Documento ja esta sendo processado | Document is already being processed |

### Audit Events

| Action | Resource Type | Actor Type | When Triggered |
|--------|-------------|-----------|---------------|
| `PROFILE_DOCUMENT_UPLOADED` | ProfileDocument | USER | Document uploaded to dataroom |
| `PROFILE_DOCUMENT_DELETED` | ProfileDocument | USER | Document removed from dataroom |
| `PROFILE_DOCUMENT_AI_PROCESSING_TRIGGERED` | ProfileDocument | USER | AI processing manually triggered for a document |
| `PROFILE_DOCUMENT_AI_PROCESSING_COMPLETED` | ProfileDocument | SYSTEM | AI processing completed successfully |
| `PROFILE_DOCUMENT_AI_PROCESSING_FAILED` | ProfileDocument | SYSTEM | AI processing failed after all retries |

---

## Security Considerations

### SEC-3: Document Security
- Documents are stored in a separate S3 bucket from internal company documents (`navia-profile-documents`)
- S3 bucket has BlockPublicAccess enabled
- All downloads go through pre-signed URLs generated by the backend
- File uploads validated by MIME type + magic bytes (not just extension)
- EXIF metadata stripped from image uploads

### SEC-4: AI Processing Security
- Extracted text is stored in the same S3 bucket under the `extracted/` prefix with SSE-S3 encryption
- Extracted text files are not directly accessible — no pre-signed URL endpoint is exposed for them
- AI processing jobs run in the backend context with the same database access controls
- Document content is not logged during AI processing (only document ID and status transitions)

---

## Success Criteria

### Performance
- Document upload (25 MB): < 30 seconds
- Pre-signed URL generation: < 200ms
- Thumbnail generation: < 10 seconds after upload
- AI processing trigger (queue submission): < 500ms
- AI text extraction (PDF, < 50 pages): < 30 seconds
- AI text extraction (DOCX/XLSX): < 15 seconds

### Accuracy
- PDF page count extraction: 99%+ accuracy for valid PDFs
- AI text extraction: 95%+ accuracy for standard text PDFs (scanned/image PDFs may have lower accuracy)

### User Experience
- Document upload: drag-and-drop with progress indicator
- AI processing status visible at a glance via color-coded badge
- Automatic polling refreshes AI status without manual page reload

---

## Related Specifications

| Specification | Relationship |
|---------------|-------------|
| [company-profile.md](./company-profile.md) | ProfileDocument belongs to CompanyProfile; documents appear in the profile page and shared link; `autoProcessWithAI` field on CompanyProfile |
| [document-generation.md](./document-generation.md) | Dataroom documents are separate from generated legal documents; different storage prefix |
| [reports-analytics.md](./reports-analytics.md) | Due diligence package (auto-generated ZIP) is distinct from dataroom (manually curated) |
| [user-permissions.md](./user-permissions.md) | Only ADMIN and FINANCE roles can upload/delete documents and trigger AI processing |
| [security.md](../.claude/rules/security.md) | File upload validation (MIME + magic bytes), EXIF stripping, S3 pre-signed URLs, BlockPublicAccess |
| [audit-logging.md](../.claude/rules/audit-logging.md) | Document upload, deletion, and AI processing events are audit-logged |
| [api-standards.md](../.claude/rules/api-standards.md) | Endpoints follow standard envelope responses |
